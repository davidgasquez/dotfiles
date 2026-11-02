import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const hcBin = process.env.PI_WORKERS_HC ?? "hc";
const run = promisify(execFile);
const watches = new Map();
const instructions =
  'Delegate to interactive Pi workers in hc terminals instead of built-in subagents. Run `hc --skill` once to learn hc. Launch each worker with its own absolute session file and a focused task with context, constraints, expected output, and verification, e.g. `hc run --bg --name review --cwd /repo pi --session /tmp/review.jsonl "<task>"`, then call hc_watch with the returned terminal and that session. Completions, errors, blocks, cancellations, and exits then arrive in this chat automatically; do not poll. Use hc send, interrupt, read, and kill to steer, inspect, and clean up.';
const tool = {
  name: "hc_watch",
  description:
    "Relay an hc terminal running interactive Pi to this chat: each completion (final text from the Pi session), error, block, cancellation, and exit arrives automatically. Calling it again returns the latest result and any delivery error.",
  inputSchema: {
    type: "object",
    properties: {
      terminal: { type: "string", description: "Address or name from hc run." },
      session: { type: "string", description: "Absolute pi --session path." },
    },
    required: ["terminal", "session"],
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
  const { terminal, name, session, status, result, deliveryError } = watch;
  return { terminal, name, session, status, result, deliveryError };
}

function report(watch, result) {
  watch.result = result;
  deliver(watch, result);
}

function deliver(watch, result) {
  const text =
    result.length > 24_000
      ? `${result.slice(0, 24_000)}\n[Truncated; full output is in the session.]`
      : result;
  const prompt = `[Pi worker ${watch.terminal}${watch.name ? ` ${watch.name}` : ""}]\n${text}\nSession: ${watch.session}`;
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

function lastAssistant(session) {
  const lines = readFileSync(session, "utf8").trimEnd().split("\n").reverse();
  // The newest record is always parsed so a partial tail is reported, not skipped.
  for (const [index, line] of lines.entries()) {
    if (index > 0 && !line.includes('"assistant"')) continue;
    const entry = JSON.parse(line);
    if (entry.type === "message" && entry.message?.role === "assistant")
      return entry;
  }
}

// A repeated done counts when the transcript has a new assistant entry or read error (e.g. after a rebind).
function observeOutcome(watch, status, previous) {
  let entry, unreadable;
  try {
    entry = lastAssistant(watch.session);
  } catch (error) {
    unreadable = `Session transcript unreadable (${error.message}); check the session path or hc read ${watch.terminal}.`;
  }
  const key = entry?.id ?? unreadable;
  const fresh = key !== undefined && key !== watch.reported;
  if (
    !fresh &&
    (status.state === previous || (status.state === "done" && entry))
  )
    return;
  watch.reported = key ?? watch.reported;
  const message = fresh && entry ? entry.message : {};
  const text = message.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  report(
    watch,
    status.state === "error"
      ? `Error: ${message.errorMessage ?? status.msg ?? "unknown"}${unreadable ? `\n${unreadable}` : ""}`
      : unreadable
        ? `Completed, but ${unreadable}`
        : `Completed:\n${text || "No assistant text in the session."}`,
  );
}

// Pi reports done/error when a run settles, idle when it is cancelled, and blocked for dialogs.
// hc may not emit a turn event for blocked -> done, so outcomes follow status words.
function observeStatus(watch, status) {
  const previous = watch.status;
  watch.status = status?.state;
  if (status?.state === "done" || status?.state === "error")
    observeOutcome(watch, status, previous);
  else if (status?.state === "blocked" && previous !== "blocked")
    report(
      watch,
      `Blocked (${status.kind ?? "needs a person"})${status.msg ? `: ${status.msg}` : ""}\nAnswer with: hc attach ${watch.terminal}`,
    );
  else if (
    status?.state === "idle" &&
    ["working", "blocked"].includes(previous)
  )
    report(watch, "Cancelled.");
}

function observeExit(watch, { reason, exit_code, signal }) {
  if (watch.finished) return;
  watch.finished = true;
  watch.status = "finished";
  watch.child?.kill();
  report(
    watch,
    `Exited (${reason}${exit_code != null ? `, code ${exit_code}` : signal != null ? `, signal ${signal}` : ""}).`,
  );
}

function observeTerminals(watch, seq, terminals) {
  watch.seq = seq;
  for (const record of terminals) {
    if (record.address !== watch.terminal) continue;
    if (record.state === "finished") observeExit(watch, record);
    else observeStatus(watch, record.status);
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
          else if (type === "finished") observeExit(watch, data);
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
        deliver(watch, `Watch lost (${message}); call hc_watch again.`);
    });
  });
}

async function watch(args, context) {
  if (!isAbsolute(args.session))
    throw new Error("session must be an absolute Pi session path");
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
      session: args.session,
      owner: context,
      seq: 0,
      delivery: Promise.resolve(),
    };
    watches.set(record.address, watch);
  }
  if (watch.owner.threadId !== context.threadId)
    throw new Error("Terminal is watched by another chat");
  if (watch.session !== args.session)
    throw new Error(`Terminal is watched with session ${watch.session}`);
  if (!watch.finished && !closing) await (watch.events ??= subscribe(watch));
  return snapshot(watch);
}

async function callTool({ name, arguments: args, _meta }) {
  if (name !== tool.name) throw new Error(`Unknown tool: ${name}`);
  if (typeof args?.terminal !== "string" || typeof args.session !== "string")
    throw new Error("Expected terminal and session strings");
  return watch(args, owner(_meta));
}

function output(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

const toolResult = (value, isError) => ({
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
        serverInfo: { name: "pi-workers", version: "2.0.0" },
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
