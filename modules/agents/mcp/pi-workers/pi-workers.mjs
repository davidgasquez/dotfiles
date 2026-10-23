import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

const workers = new Map();
const instructions =
  "Delegate with pi_start instead of built-in subagents. Give each a focused task and necessary context. Results return automatically to this chat. Use pi_send for follow-ups or steering, pi_status for recovery, and pi_stop when finished.";
const string = { type: "string", minLength: 1 };
const workerId = { ...string, description: "Worker id returned by pi_start." };
const schema = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const tools = [
  {
    name: "pi_start",
    description:
      "Start a persistent Pi worker and return immediately. Results arrive in this chat automatically. Omit model to use Pi's configured model.",
    inputSchema: schema(
      {
        task: {
          ...string,
          description:
            "Focused task with relevant context, constraints, expected output, and verification criteria.",
        },
        cwd: {
          ...string,
          description:
            "Existing absolute working directory on the shared filesystem.",
        },
        name: string,
        model: string,
        thinking: {
          type: "string",
          enum: ["off", "minimal", "low", "medium", "high", "xhigh"],
        },
      },
      ["task", "cwd"],
    ),
  },
  {
    name: "pi_send",
    description:
      "Continue a worker with its existing context. When busy, followUp queues work and steer redirects the current task; either starts immediately when idle.",
    inputSchema: schema(
      {
        worker_id: workerId,
        message: string,
        mode: {
          type: "string",
          enum: ["followUp", "steer"],
          default: "followUp",
        },
      },
      ["worker_id", "message"],
    ),
  },
  {
    name: "pi_status",
    description:
      "Recover worker state: latest result, session path, and callback errors. Omit worker_id to list this chat's workers. Results arrive automatically; avoid polling.",
    inputSchema: schema({ worker_id: workerId }),
  },
  {
    name: "pi_stop",
    description:
      "Stop a worker and its commands, preserving its transcript and latest result. Workers also stop when this MCP connection closes.",
    inputSchema: schema({ worker_id: workerId }, ["worker_id"]),
  },
];

// Both MCP stdio and Pi RPC use LF-delimited JSON, including literal U+2028/U+2029.
function readJsonLines(stream, onRecord, onError) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        onRecord(JSON.parse(line));
      } catch (error) {
        onError(error);
      }
    }
    if (buffer.length > 8 * 1024 * 1024) {
      buffer = "";
      onError(new Error("JSON record exceeds 8 MiB"));
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

function snapshot(worker) {
  const { id, name, cwd, session, status, result, deliveryError } = worker;
  return {
    id,
    name,
    cwd,
    session,
    status,
    result,
    deliveryError,
  };
}

function notify(worker, message) {
  const prompt = `[Pi worker ${worker.id}: ${worker.name}]\n${message}\nSession: ${worker.session}`;
  worker.delivery = worker.delivery.then(async () => {
    try {
      await appCall(worker.owner, "send_message_to_thread", {
        threadId: worker.owner.threadId,
        hostId: "local",
        prompt,
      });
      delete worker.deliveryError;
    } catch (error) {
      worker.deliveryError = error.message;
      console.error(`Pi ${worker.id}: callback failed: ${error.message}`);
    }
  });
}

function signal(worker, signal) {
  if (!worker.child.pid) return;
  try {
    process.kill(-worker.child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function stop(worker) {
  worker.stopping = true;
  if (!worker.exited) {
    signal(worker, "SIGTERM");
    const timer = setTimeout(() => signal(worker, "SIGKILL"), 3_000);
    await worker.closed;
    clearTimeout(timer);
    signal(worker, "SIGKILL");
  }
  worker.status = "stopped";
  return snapshot(worker);
}

function rpc(worker, type, fields = {}) {
  return new Promise((resolve, reject) => {
    if (worker.exited || worker.stopping)
      return reject(new Error("Worker has stopped"));
    const id = randomUUID();
    const timer = setTimeout(() => {
      worker.pending.delete(id);
      reject(
        new Error(`Pi ${type} timed out; inspect pi_status before retrying`),
      );
    }, 30_000);
    worker.pending.set(id, (record) => {
      clearTimeout(timer);
      record.success ? resolve(record.data) : reject(new Error(record.error));
    });
    worker.child.stdin.write(`${JSON.stringify({ id, type, ...fields })}\n`);
  });
}

function event(worker, record) {
  if (record.type === "response") {
    worker.pending.get(record.id)?.(record);
    worker.pending.delete(record.id);
  } else if (record.type === "agent_start") {
    worker.revision++;
    worker.status = "busy";
    delete worker.assistant;
  } else if (
    record.type === "message_end" &&
    record.message?.role === "assistant"
  ) {
    worker.assistant = record.message;
  } else if (record.type === "agent_settled" && !worker.stopping) {
    worker.revision++;
    const message = worker.assistant;
    const failed =
      record.aborted || ["error", "aborted"].includes(message?.stopReason);
    worker.status = failed ? "error" : "idle";
    worker.result = failed
      ? `Error: ${message?.errorMessage ?? "Run aborted"}`
      : message?.content
          ?.filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n") || "No assistant text returned.";
    const output =
      worker.result.length > 24_000
        ? `${worker.result.slice(0, 24_000)}\n[Truncated; full output is in the session transcript.]`
        : worker.result;
    notify(
      worker,
      `${worker.status === "idle" ? "Completed" : "Failed"}:\n${output}`,
    );
  }
}

async function start(args, context) {
  if (!isAbsolute(args.cwd) || !(await stat(args.cwd)).isDirectory())
    throw new Error("cwd must be an existing absolute directory");
  // Check the return channel before starting potentially expensive work.
  await appCall(context, "read_thread", {
    threadId: context.threadId,
    hostId: "local",
    turnLimit: 1,
    includeOutputs: false,
    maxOutputCharsPerItem: 0,
  });
  if (closing) throw new Error("MCP is shutting down");
  const root = join(
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    "pi-workers",
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "worker-"));
  if (closing) throw new Error("MCP is shutting down");
  const id = randomUUID().slice(0, 8);
  const session = join(directory, "session.jsonl");
  const argv = [
    "--mode",
    "rpc",
    "--session",
    session,
    "--append-system-prompt",
    "You are a worker for a Codex orchestrator. Complete the assigned task. You share files with other agents. Preserve their changes. Return a concise result with verification outcomes and any blockers.",
  ];
  if (args.model) argv.push("--model", args.model);
  if (args.thinking) argv.push("--thinking", args.thinking);
  const child = spawn(process.env.PI_WORKER_BIN ?? "pi", argv, {
    cwd: args.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  const worker = {
    id,
    name: args.name ?? id,
    cwd: args.cwd,
    session,
    owner: context,
    child,
    status: "starting",
    revision: 0,
    pending: new Map(),
    delivery: Promise.resolve(),
    stderr: "",
  };
  workers.set(id, worker);
  const fail = (error) => {
    worker.stderr = error.message;
    for (const callback of worker.pending.values())
      callback({ success: false, error: error.message });
    worker.pending.clear();
  };
  worker.closed = new Promise((resolve) =>
    child.once("close", (code, terminationSignal) => {
      worker.exited = true;
      const reason = `Pi exited (${terminationSignal ?? code})${worker.stderr ? `: ${worker.stderr}` : ""}`;
      fail(new Error(reason));
      if (!worker.stopping) {
        worker.status = "error";
        worker.result = reason;
        notify(worker, reason);
      }
      resolve();
    }),
  );
  child.once("exit", () => signal(worker, "SIGKILL"));
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    worker.stderr = (worker.stderr + chunk).slice(-4000);
  });
  readJsonLines(
    child.stdout,
    (record) => event(worker, record),
    (error) => {
      fail(error);
      worker.result = `Invalid Pi output: ${error.message}`;
      notify(worker, worker.result);
      void stop(worker);
    },
  );
  try {
    await rpc(worker, "set_session_name", { name: worker.name });
    worker.status = "idle";
    return { ...(await send(worker, args.task)), worker_id: id };
  } catch (error) {
    await stop(worker);
    throw new Error(`${error.message}; session: ${session}`);
  }
}

async function send(worker, message, mode = "followUp") {
  const { status, revision } = worker;
  if (["idle", "error"].includes(status) && !worker.exited)
    worker.status = "busy";
  try {
    const data = await rpc(worker, "prompt", {
      message,
      streamingBehavior: mode,
    });
    if (data?.disposition === "handled" && worker.revision === revision)
      worker.status = status;
    return { ...snapshot(worker), disposition: data?.disposition };
  } catch (error) {
    if (worker.revision === revision && !worker.exited) worker.status = status;
    throw error;
  }
}

function validate(args, definition) {
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("Expected an arguments object");
  for (const key of definition.required)
    if (!(key in args)) throw new Error(`Missing ${key}`);
  for (const [key, value] of Object.entries(args)) {
    const rule = definition.properties[key];
    if (
      !rule ||
      (rule.type && typeof value !== rule.type) ||
      (rule.minLength && !value.trim()) ||
      (rule.enum && !rule.enum.includes(value))
    )
      throw new Error(`Invalid ${key}`);
  }
}

async function callTool(params) {
  const tool = tools.find((item) => item.name === params.name);
  if (!tool) throw new Error(`Unknown tool: ${params.name}`);
  const args = params.arguments ?? {};
  validate(args, tool.inputSchema);
  const context = owner(params._meta);
  if (tool.name === "pi_start") return start(args, context);
  if (tool.name === "pi_status" && !args.worker_id)
    return [...workers.values()]
      .filter((worker) => worker.owner.threadId === context.threadId)
      .map(snapshot);
  const worker = workers.get(args.worker_id);
  if (!worker || worker.owner.threadId !== context.threadId)
    throw new Error("Worker not found in this chat");
  if (tool.name === "pi_status") return snapshot(worker);
  if (tool.name === "pi_stop") return stop(worker);
  return send(worker, args.message, args.mode);
}

function output(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

async function handle(request) {
  if (
    !request ||
    request.jsonrpc !== "2.0" ||
    typeof request.method !== "string"
  ) {
    output({
      id: request?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request" },
    });
    return;
  }
  if (request.id === undefined) return;
  const { id, method } = request;
  if (method === "initialize") {
    const supported = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
    output({
      id,
      result: {
        protocolVersion: supported.includes(request.params?.protocolVersion)
          ? request.params.protocolVersion
          : supported.at(-1),
        capabilities: { tools: {} },
        serverInfo: { name: "pi-workers", version: "1.0.0" },
        instructions,
      },
    });
  } else if (method === "ping") output({ id, result: {} });
  else if (method === "tools/list") output({ id, result: { tools } });
  else if (method === "tools/call") {
    try {
      output({
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(await callTool(request.params)),
            },
          ],
        },
      });
    } catch (error) {
      output({
        id,
        result: {
          content: [{ type: "text", text: error.message }],
          isError: true,
        },
      });
    }
  } else
    output({
      id,
      error: { code: -32601, message: `Unknown method: ${method}` },
    });
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await Promise.allSettled(
    [...workers.values()].filter((worker) => !worker.exited).map(stop),
  );
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
