import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const hcBin = process.env.PI_WORKERS_HC ?? "hc";
const run = promisify(execFile);
const watches = new Map();
const instructions =
  "In a local desktop chat, call hc_watch with each worker address returned by `hc run`. Register again if a watch is lost. If you need the result and the notice hasn't arrived, use `hc wait <terminal>`, including when registration or delivery fails. Notices carry status only. Collect and verify results with `hc read --lines 100 <terminal>`. See the subagents skill and `hc --skill` for the worker lifecycle.";
const tool = {
  name: "hc_watch",
  description:
    "Notify this chat when an hc terminal completes, blocks, errors, is cancelled, or exits. Notices are brief; read output with `hc read --lines 100 <terminal>`. Calling it again returns the latest notice and delivery error and resubscribes a lost watch.",
  inputSchema: {
    type: "object",
    properties: {
      terminal: { type: "string", description: "Address or name from hc run." },
    },
    required: ["terminal"],
    additionalProperties: false,
  },
};

// MCP stdio and hc events are JSON lines; readline splits only on CR/LF, never U+2028/U+2029.
function readJsonLines(stream, onRecord, onError) {
  createInterface({ input: stream }).on("line", (line) => {
    if (!line.trim()) return;
    try {
      onRecord(JSON.parse(line));
    } catch (error) {
      onError(error);
    }
  });
}

function owner(metadata = {}) {
  let turn = metadata["x-codex-turn-metadata"];
  if (typeof turn === "string") turn = JSON.parse(turn);
  const threadId =
    turn?.thread_id ?? metadata["openai/threadId"] ?? metadata.thread_id;
  if (typeof threadId !== "string" || !threadId.trim())
    throw new Error(
      "Codex thread metadata is required; run this MCP from the desktop chat.",
    );
  return { threadId, turnId: turn?.turn_id ?? `mcp-turn-${randomUUID()}` };
}

// The desktop's private app-tools pipe uses a four-byte LE length before JSON-RPC.
function appCall(context, tool, args) {
  return new Promise((resolve, reject) => {
    const path = process.env.CODEX_APP_TOOLS_PIPE_PATH;
    if (!path)
      return reject(
        new Error(
          "CODEX_APP_TOOLS_PIPE_PATH is missing; launch from the desktop app.",
        ),
      );
    const socket = createConnection(path);
    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(
      () => finish(new Error("Desktop callback timed out")),
      30_000,
    );
    function finish(error, result) {
      clearTimeout(timeout);
      socket.destroy();
      error ? reject(error) : resolve(result);
    }
    socket.on("error", finish);
    socket.on("end", () =>
      finish(new Error("Desktop pipe closed before responding")),
    );
    socket.on("connect", () => {
      const body = Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            callerSource: "codex",
            hostId: process.env.CODEX_APP_TOOLS_CALLER_HOST_ID ?? "local",
            threadId: context.threadId,
            turnId: context.turnId,
            callId: `mcp-call-${randomUUID()}`,
            namespace: "codex_app",
            tool,
            arguments: args,
          },
        }),
      );
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length);
      socket.write(Buffer.concat([header, body]));
    });
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const size = buffer.readUInt32LE();
      if (size > 8 * 1024 * 1024)
        return finish(new Error("Desktop frame exceeds 8 MiB"));
      if (buffer.length < size + 4) return;
      try {
        const response = JSON.parse(buffer.subarray(4, size + 4).toString());
        if (response.error) throw new Error(response.error.message);
        if (!response.result?.success)
          throw new Error(JSON.stringify(response.result));
        finish(null, response.result);
      } catch (error) {
        finish(error);
      }
    });
  });
}

// hc reports errors as {error: {message}} JSON on stderr.
async function hcGet(terminal) {
  try {
    const { stdout } = await run(hcBin, ["get", "--json", "--", terminal]);
    return JSON.parse(stdout);
  } catch (error) {
    let message = error.stderr?.trim() || error.message;
    try {
      message = JSON.parse(message).error.message;
    } catch {}
    throw new Error(`hc get: ${message}`);
  }
}

function snapshot(watch) {
  const { terminal, name, status, notice, deliveryError } = watch;
  return { terminal, name, status, notice, deliveryError };
}

function notify(watch, text, keep = true) {
  if (keep) watch.notice = text;
  const prompt = `[hc ${watch.terminal}${watch.name ? ` ${watch.name}` : ""}] ${text}\nOutput: hc read --lines 100 ${watch.terminal}`;
  watch.delivery = watch.delivery.then(async () => {
    try {
      await appCall(watch.owner, "send_message_to_thread", {
        threadId: watch.owner.threadId,
        hostId: "local",
        prompt,
      });
      delete watch.deliveryError;
    } catch (error) {
      watch.deliveryError = error.message;
      console.error(`${watch.terminal}: callback failed: ${error.message}`);
    }
  });
}

// Notices follow status transitions; hc's turn counter (bumped when the status leaves working)
// exposes new work hidden in a snapshot gap. Status events carry no turn and the turn event
// follows them, so a live exit from working advances it at once in case the stream drops between.
function observeStatus(watch, status, turn) {
  const previous = watch.status;
  const state = status?.state;
  const newWork =
    typeof turn === "number" && watch.turn !== undefined && turn !== watch.turn;
  watch.status = state;
  if (typeof turn === "number") watch.turn = turn;
  else if (
    previous === "working" &&
    state &&
    state !== "working" &&
    typeof watch.turn === "number"
  )
    watch.turn++;
  if (state === previous && !newWork) return;
  if (state === "done") notify(watch, "completed");
  else if (state === "error")
    notify(watch, `error${status.msg ? `: ${status.msg}` : ""}`);
  else if (state === "blocked")
    notify(
      watch,
      `blocked${status.kind ? ` (${status.kind})` : ""}${status.msg ? `: ${status.msg}` : ""}; needs a person`,
    );
  else if (
    state === "idle" &&
    (newWork || ["working", "blocked"].includes(previous))
  )
    notify(watch, "cancelled");
}

function observeExit(watch, { reason, exit_code, signal }) {
  if (watch.finished) return;
  watch.finished = true;
  watch.status = "finished";
  watch.child?.kill();
  notify(
    watch,
    `exited (${reason}${exit_code != null ? `, code ${exit_code}` : signal != null ? `, signal ${signal}` : ""})`,
  );
}

function observeTerminals(watch, seq, terminals) {
  watch.seq = seq;
  for (const record of terminals) {
    if (record.address !== watch.terminal) continue;
    if (record.state === "finished") observeExit(watch, record);
    else observeStatus(watch, record.status, record.turn);
  }
}

function subscribe(watch) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      hcBin,
      ["events", "--json", "--terminal", watch.terminal],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    watch.child = child;
    let stderr = "";
    let started = false;
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    readJsonLines(
      child.stdout,
      (record) => {
        if (record.terminals) {
          started = true;
          resolve();
          observeTerminals(watch, record.seq, record.terminals);
        } else if (record.method === "missed")
          observeTerminals(watch, record.params.seq, record.params.terminals);
        else if (record.method === "event" && record.params.seq > watch.seq) {
          const { type, data } = record.params;
          watch.seq = record.params.seq;
          if (type === "status") observeStatus(watch, data.status);
          else if (type === "turn" && typeof data.turn === "number")
            watch.turn = data.turn;
          else if (type === "finished") observeExit(watch, data);
          else if (type === "removed") observeExit(watch, { reason: "removed" });
        }
      },
      (error) => console.error(`hc events: ${error.message}`),
    );
    child.on("error", reject);
    child.on("close", () => {
      watch.events = undefined;
      const message = `hc events ended: ${stderr.trim() || "no output"}`;
      reject(new Error(message));
      if (started && !watch.finished && !closing)
        notify(watch, `watch lost (${message}); call hc_watch again`, false);
    });
  });
}

async function watch(args, context) {
  if (!process.env.CODEX_APP_TOOLS_PIPE_PATH)
    throw new Error(
      "CODEX_APP_TOOLS_PIPE_PATH is missing; launch from the desktop app.",
    );
  // Retained watches answer by address even after the terminal was removed with hc rm.
  let watch = watches.get(args.terminal);
  if (!watch) {
    const record = await hcGet(args.terminal);
    watch = watches.get(record.address) ?? {
      terminal: record.address,
      name: record.name,
      owner: context,
      seq: 0,
      delivery: Promise.resolve(),
    };
    watches.set(record.address, watch);
  }
  if (watch.owner.threadId !== context.threadId)
    throw new Error("Terminal is watched by another chat");
  if (!watch.finished && !closing) await (watch.events ??= subscribe(watch));
  return snapshot(watch);
}

async function callTool({ name, arguments: args, _meta }) {
  if (name !== tool.name) throw new Error(`Unknown tool: ${name}`);
  if (typeof args?.terminal !== "string" || Object.keys(args).length !== 1)
    throw new Error("Expected only a terminal string");
  return watch(args, owner(_meta));
}

function output(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

const toolResult = (value, isError = false) => ({
  content: [{ type: "text", text: isError ? value : JSON.stringify(value) }],
  isError,
});

async function handle(request) {
  const { id, method, params } = request ?? {};
  if (request?.jsonrpc !== "2.0" || typeof method !== "string")
    return output({
      id: id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request" },
    });
  if (id === undefined) return;
  const supported = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
  if (method === "initialize")
    output({
      id,
      result: {
        protocolVersion: supported.includes(params?.protocolVersion)
          ? params.protocolVersion
          : supported.at(-1),
        capabilities: { tools: {} },
        serverInfo: { name: "pi-workers", version: "3.0.0" },
        instructions,
      },
    });
  else if (method === "ping") output({ id, result: {} });
  else if (method === "tools/list") output({ id, result: { tools: [tool] } });
  else if (method === "tools/call")
    output({
      id,
      result: await callTool(params).then(toolResult, (error) =>
        toolResult(error.message, true),
      ),
    });
  else
    output({
      id,
      error: { code: -32601, message: `Unknown method: ${method}` },
    });
}

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  for (const watch of watches.values()) watch.child?.kill();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.stdin.on("end", shutdown);
process.stdout.on("error", shutdown);
readJsonLines(
  process.stdin,
  (request) => {
    if (!closing) void handle(request);
  },
  (error) =>
    output({ id: null, error: { code: -32700, message: error.message } }),
);
