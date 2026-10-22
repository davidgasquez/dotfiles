import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import {
  type ExtensionAPI,
  type ExtensionContext,
  SessionManager,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const ROOT = join(homedir(), ".pi/agent/subagents");
const APP_ID = "com.mitchellh.ghostty.subagent.h";

type Run = {
  id: string;
  name: string;
  cwd: string;
  model: string;
  thinking: string;
  args: string[];
  delivered: number;
};
type State = {
  pid: number;
  state: "starting" | "busy" | "idle" | "exited" | "error";
  settled: number;
  error?: string;
};
type InboxMessage = { prompt: string; followUp: boolean };

function writeJson(path: string, value: unknown): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sessionRoot(ctx: ExtensionContext): string {
  return join(ROOT, ctx.sessionManager.getSessionId());
}

function runDir(ctx: ExtensionContext, id: string): string {
  if (!/^[a-f0-9]{8}$/.test(id)) throw new Error(`Invalid subagent id: ${id}`);
  return join(sessionRoot(ctx), id);
}

function isRunning(pid: number): boolean {
  if (pid === 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return false;
  }
}

function readState(dir: string): State {
  const state = readJson<State>(join(dir, "state.json"));
  if (state.pid === 0 || isRunning(state.pid)) return state;
  if (state.state === "idle" && !pending(dir))
    return { ...state, state: "exited" };
  return {
    ...state,
    state: "exited",
    settled: state.settled + 1,
    error: state.error ?? "Subagent exited while working",
  };
}

function runs(ctx: ExtensionContext): Run[] {
  const root = sessionRoot(ctx);
  if (!existsSync(root)) return [];
  return readdirSync(root).map((id) => readJson(join(root, id, "run.json")));
}

function pending(dir: string): boolean {
  return readdirSync(join(dir, "inbox")).some((name) => name.endsWith(".json"));
}

function queue(dir: string, message: InboxMessage): void {
  writeJson(join(dir, "inbox", `${Date.now()}-${randomUUID()}.json`), message);
}

function finished(dir: string, state: State): boolean {
  return (
    state.settled > 0 &&
    (state.state === "exited" || (state.state === "idle" && !pending(dir)))
  );
}

function finalResponse(dir: string, state: State): string {
  if (state.error) return `Error: ${state.error}`;
  const session = join(dir, "session.jsonl");
  const message = SessionManager.open(session)
    .getBranch()
    .flatMap((entry) => (entry.type === "message" ? [entry.message] : []))
    .findLast(
      (message) => message.role === "user" || message.role === "assistant",
    );
  if (message?.role !== "assistant") return "Error: no response";
  if (message.stopReason === "error" || message.stopReason === "aborted")
    return `Error: ${message.errorMessage ?? message.stopReason}`;
  const output = truncateHead(
    message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n"),
  );
  return output.truncated
    ? `${output.content}\n[Truncated; full transcript: ${session}]`
    : output.content;
}

function markDelivered(dir: string, run: Run, state: State): void {
  writeJson(join(dir, "run.json"), { ...run, delivered: state.settled });
}

async function launch(
  dir: string,
  run: Run,
  signal?: AbortSignal,
): Promise<void> {
  const args = [...run.args];
  if (args.includes("--no-extensions") || args.includes("-ne"))
    args.push("--extension", fileURLToPath(import.meta.url));
  const log = join(dir, "stderr.log");
  // Ghostty occasionally maps a window without ever running its command; retry those.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const child = spawn(
      "ghostty",
      [
        `--class=${APP_ID}${run.id}`,
        "--gtk-single-instance=false",
        "--quit-after-last-window-closed=true",
        `--working-directory=${run.cwd}`,
        "-e",
        "sh",
        "-c",
        'exec pi "$@" 2>"$PI_SUBAGENT_RUN_DIR/stderr.log"',
        "sh",
        "--session",
        join(dir, "session.jsonl"),
        "--model",
        run.model,
        "--thinking",
        run.thinking,
        ...args,
      ],
      {
        cwd: run.cwd,
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PI_SUBAGENT_RUN_DIR: dir },
      },
    );
    child.unref();
    try {
      await once(child, "spawn");
      const stuck = Date.now() + 5_000;
      const deadline = Date.now() + 30_000;
      while (existsSync(log) || Date.now() < stuck) {
        const state = readState(dir);
        if (state.state === "error") throw new Error(state.error);
        if (state.state === "idle" || state.state === "busy") return;
        if (child.exitCode !== null || Date.now() >= deadline) {
          const reason = existsSync(log)
            ? stripVTControlCharacters(readFileSync(log, "utf8")).trim()
            : "";
          throw new Error(`Pi did not start${reason && `: ${reason}`}`);
        }
        await delay(100, undefined, { signal });
      }
    } catch (error) {
      child.kill();
      throw error;
    }
    child.kill();
  }
  throw new Error("Pi did not start: Ghostty never ran it");
}

async function stop(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  const { pid } = readState(dir);
  if (isRunning(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    const deadline = Date.now() + 5_000;
    while (isRunning(pid)) {
      if (Date.now() >= deadline)
        throw new Error(`Subagent did not exit: ${dir}`);
      await delay(100);
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

function windowSelector(id: string): string {
  return `class:^${APP_ID.replaceAll(".", "[.]")}${id}$`;
}

function childBridge(pi: ExtensionAPI, dir: string): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let settled = readState(dir).settled;
  let submitted = 0;
  const publish = (state: State["state"], error?: string): void => {
    writeJson(join(dir, "state.json"), {
      pid: process.pid,
      state,
      settled,
      error,
    });
  };

  pi.on("session_start", (_event, ctx) => {
    const run = readJson<Run>(join(dir, "run.json"));
    pi.setSessionName(`subagent ${run.name} (${run.id})`);
    publish(ctx.isIdle() ? "idle" : "busy");
    timer = setInterval(() => {
      try {
        const idle = ctx.isIdle();
        if (submitted && idle) {
          if (Date.now() - submitted < 10_000) return;
          submitted = 0;
          settled += 1;
          publish("idle", "Prompt did not start; see the subagent window");
        }
        for (const name of readdirSync(join(dir, "inbox")).sort()) {
          if (!name.endsWith(".json")) continue;
          const path = join(dir, "inbox", name);
          const message = readJson<InboxMessage>(path);
          publish("busy");
          if (idle) {
            pi.sendUserMessage(message.prompt);
            submitted = Date.now();
          } else
            pi.sendUserMessage(message.prompt, {
              deliverAs: message.followUp ? "followUp" : "steer",
            });
          unlinkSync(path);
          if (idle) break;
        }
      } catch (error) {
        publish("error", String(error));
        clearInterval(timer);
      }
    }, 250);
    timer.unref();
  });
  pi.on("agent_start", () => {
    submitted = 0;
    publish("busy");
  });
  pi.on("agent_settled", () => {
    settled += 1;
    publish("idle");
  });
  pi.on("session_shutdown", () => clearInterval(timer));
}

export default function subagentExtension(pi: ExtensionAPI): void {
  const childDir = process.env.PI_SUBAGENT_RUN_DIR;
  if (childDir) {
    childBridge(pi, childDir);
    return;
  }

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate one focused task to a child agent that starts with no context. " +
      "Its prompt should state the goal, only the context that matters and why, the expected output, and how to verify it is done. " +
      "spawn(name, prompt) returns an id; the child inherits your model, thinking, cwd, and Pi config unless overridden (args are extra Pi CLI flags). " +
      "Its final response arrives automatically after your turn, so don't poll; wait(id, timeout=600s) blocks for it. " +
      "send(id, prompt) starts a turn, steers, or queues with followUp. list shows children; stop closes one and deletes its transcript. " +
      "Children share the filesystem, so give each its own files, and stop them when done.",
    parameters: Type.Object({
      action: Type.Union(
        ["spawn", "list", "send", "wait", "stop"].map((action) =>
          Type.Literal(action),
        ),
      ),
      id: Type.Optional(Type.String()),
      name: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
      prompt: Type.Optional(Type.String({ minLength: 1 })),
      followUp: Type.Optional(Type.Boolean()),
      timeout: Type.Optional(Type.Integer({ minimum: 1 })),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(Type.String()),
      cwd: Type.Optional(Type.String()),
      args: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const reply = (text: string, id?: string) => ({
        content: [{ type: "text" as const, text }],
        details: { id },
      });

      if (params.action === "list") {
        return reply(
          JSON.stringify(
            runs(ctx).map((run) => ({
              id: run.id,
              name: run.name,
              state: readState(runDir(ctx, run.id)).state,
            })),
          ),
        );
      }

      if (params.action === "spawn") {
        if (!params.name || !params.prompt)
          throw new Error("spawn requires name and prompt");
        const model =
          params.model ??
          (ctx.model && `${ctx.model.provider}/${ctx.model.id}`);
        if (!model) throw new Error("No model selected");
        const run: Run = {
          id: randomUUID().slice(0, 8),
          name: params.name,
          cwd: resolve(ctx.cwd, params.cwd ?? "."),
          model,
          thinking: params.thinking ?? pi.getThinkingLevel(),
          args: params.args ?? [],
          delivered: 0,
        };
        const dir = runDir(ctx, run.id);
        mkdirSync(join(dir, "inbox"), { recursive: true, mode: 0o700 });
        writeJson(join(dir, "run.json"), run);
        writeFileSync(join(dir, "session.jsonl"), "", { mode: 0o600 });
        writeJson(join(dir, "state.json"), {
          pid: 0,
          state: "starting",
          settled: 0,
        });
        try {
          await launch(dir, run, signal);
        } catch (error) {
          await stop(dir);
          throw error;
        }
        queue(dir, { prompt: params.prompt, followUp: false });
        return reply(`Spawned ${run.name} (${run.id})`, run.id);
      }

      if (!params.id) throw new Error(`${params.action} requires id`);
      const dir = runDir(ctx, params.id);
      if (!existsSync(dir)) throw new Error(`Unknown subagent: ${params.id}`);

      if (params.action === "stop") {
        await stop(dir);
        return reply(`Stopped ${params.id}`, params.id);
      }

      if (params.action === "send") {
        if (!params.prompt) throw new Error("send requires prompt");
        const { state } = readState(dir);
        if (state === "exited" || state === "error")
          throw new Error(`Subagent ${params.id} is ${state}`);
        queue(dir, {
          prompt: params.prompt,
          followUp: params.followUp ?? false,
        });
        return reply(`Sent to ${params.id}`, params.id);
      }

      const deadline = Date.now() + (params.timeout ?? 600) * 1000;
      while (true) {
        const state = readState(dir);
        if (state.state === "error") throw new Error(state.error);
        if (finished(dir, state)) {
          const text = finalResponse(dir, state);
          markDelivered(dir, readJson(join(dir, "run.json")), state);
          return reply(text, params.id);
        }
        if (state.state === "exited")
          throw new Error(`Subagent ${params.id} exited`);
        if (Date.now() >= deadline)
          return reply(`${params.id} is still ${state.state}`, params.id);
        await delay(250, undefined, { signal });
      }
    },
  });

  pi.registerCommand("subagent", {
    description: "Focus a subagent window on the magic scratchpad",
    handler: async (_args, ctx) => {
      const active = runs(ctx).filter(
        (run) => readState(runDir(ctx, run.id)).state !== "exited",
      );
      if (!active.length) {
        ctx.ui.notify("No active subagents", "info");
        return;
      }
      const choices = active.map((run) => `${run.name} (${run.id})`);
      const selected = await ctx.ui.select("Subagents", choices);
      if (!selected) return;
      const run = active[choices.indexOf(selected)];
      const result = await pi.exec("hyprctl", [
        "--batch",
        'dispatch hl.dsp.focus({ workspace = "special:magic" }); ' +
          `dispatch hl.dsp.focus({ window = ${JSON.stringify(windowSelector(run.id))} })`,
      ]);
      if (result.code !== 0)
        ctx.ui.notify(result.stderr || result.stdout, "error");
    },
  });

  let timer: ReturnType<typeof setInterval> | undefined;
  pi.on("session_start", (_event, ctx) => {
    timer = setInterval(() => {
      try {
        const labels: string[] = [];
        for (const run of runs(ctx)) {
          const dir = runDir(ctx, run.id);
          const state = readState(dir);
          if (state.state !== "exited")
            labels.push(`${run.name}:${state.state}`);
          if (
            !ctx.isIdle() ||
            !finished(dir, state) ||
            state.settled <= run.delivered
          )
            continue;
          const text = finalResponse(dir, state);
          markDelivered(dir, run, state);
          pi.sendMessage(
            {
              customType: "subagent",
              content: `Subagent ${run.name} (${run.id}) finished:\n\n${text}`,
              display: true,
              details: { id: run.id },
            },
            { triggerTurn: true },
          );
        }
        if (ctx.hasUI)
          ctx.ui.setWidget(
            "subagents",
            labels.length ? [`subagents: ${labels.join(" | ")}`] : undefined,
            { placement: "belowEditor" },
          );
      } catch (error) {
        clearInterval(timer);
        if (ctx.hasUI) ctx.ui.notify(`subagent: ${error}`, "error");
      }
    }, 1000);
    timer.unref();
  });
  pi.on("session_shutdown", async (event, ctx) => {
    clearInterval(timer);
    if (ctx.hasUI) ctx.ui.setWidget("subagents", undefined);
    if (event.reason === "reload") return;
    await Promise.all(runs(ctx).map((run) => stop(runDir(ctx, run.id))));
    rmSync(sessionRoot(ctx), { recursive: true, force: true });
  });
}
