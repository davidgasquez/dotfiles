import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
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
  provider: string;
  model: string;
  thinking: string;
};
type State = {
  pid: number;
  state: "starting" | "busy" | "idle" | "exited" | "error";
  started: boolean;
  error?: string;
};
type InboxMessage = { prompt: string; followUp: boolean };

function writeJson(path: string, value: unknown): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}

function runDir(ctx: ExtensionContext, id: string): string {
  if (!/^[a-f0-9]{8}$/.test(id)) throw new Error("Invalid subagent id");
  return join(ROOT, ctx.sessionManager.getSessionId(), id);
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
  const state: State = JSON.parse(
    readFileSync(join(dir, "state.json"), "utf8"),
  );
  return state.pid > 0 && !isRunning(state.pid)
    ? { ...state, state: "exited" }
    : state;
}

function runs(ctx: ExtensionContext): Run[] {
  const root = join(ROOT, ctx.sessionManager.getSessionId());
  if (!existsSync(root)) return [];
  return readdirSync(root).map((id) =>
    JSON.parse(readFileSync(join(root, id, "run.json"), "utf8")),
  );
}

function queue(dir: string, message: InboxMessage): void {
  writeJson(join(dir, "inbox", `${Date.now()}-${randomUUID()}.json`), message);
}

async function launch(
  dir: string,
  run: Run,
  signal?: AbortSignal,
): Promise<void> {
  const log = openSync(join(dir, "terminal.log"), "a", 0o600);
  const child = spawn(
    "/usr/bin/ghostty",
    [
      `--class=${APP_ID}${run.id}`,
      "--gtk-single-instance=false",
      "--quit-after-last-window-closed=true",
      `--working-directory=${run.cwd}`,
      "-e",
      "/usr/bin/env",
      `PI_SUBAGENT_RUN_DIR=${dir}`,
      "/usr/bin/pi",
      "--session",
      join(dir, "session.jsonl"),
      "--provider",
      run.provider,
      "--model",
      run.model,
      "--thinking",
      run.thinking,
    ],
    { cwd: run.cwd, detached: true, stdio: ["ignore", "ignore", log] },
  );
  closeSync(log);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      if (child.exitCode !== null || child.signalCode !== null) break;
      const state = readState(dir);
      if (state.state === "error") throw new Error(state.error);
      if (state.pid > 0 && (state.state === "idle" || state.state === "busy"))
        return;
      await delay(100, undefined, { signal });
    }
    throw new Error(`Pi did not start; inspect ${join(dir, "terminal.log")}`);
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    child.unref();
  }
}

function windowSelector(id: string): string {
  return `class:^${APP_ID.replaceAll(".", "[.]")}${id}$`;
}

async function stop(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  const { pid } = readState(dir);
  if (isRunning(pid)) {
    const run: Run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
    execFileSync(
      "/usr/bin/hyprctl",
      [
        "dispatch",
        `hl.dsp.window.close({ window = ${JSON.stringify(windowSelector(run.id))} })`,
      ],
      { timeout: 1000 },
    );
    const deadline = Date.now() + 5_000;
    while (isRunning(pid)) {
      if (Date.now() >= deadline)
        throw new Error(`Subagent did not close: ${dir}`);
      await delay(100);
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

function childBridge(pi: ExtensionAPI, dir: string): void {
  let ctx: ExtensionContext;
  let timer: ReturnType<typeof setInterval>;
  let started = readState(dir).started;
  const publish = (state: State["state"], error?: string): void => {
    writeJson(join(dir, "state.json"), {
      pid: process.pid,
      state,
      started,
      error,
    });
  };

  pi.on("session_start", (_event, context) => {
    ctx = context;
    const run: Run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
    pi.setSessionName(`subagent ${run.name} (${run.id})`);
    publish(ctx.isIdle() ? "idle" : "busy");
    timer = setInterval(() => {
      try {
        for (const name of readdirSync(join(dir, "inbox")).sort()) {
          if (!name.endsWith(".json")) continue;
          const path = join(dir, "inbox", name);
          const message: InboxMessage = JSON.parse(readFileSync(path, "utf8"));
          started = true;
          publish("busy");
          if (ctx.isIdle()) pi.sendUserMessage(message.prompt);
          else {
            pi.sendUserMessage(message.prompt, {
              deliverAs: message.followUp ? "followUp" : "steer",
            });
          }
          unlinkSync(path);
        }
      } catch (error) {
        publish("error", String(error));
        clearInterval(timer);
      }
    }, 250);
    timer.unref();
  });
  pi.on("agent_start", () => {
    started = true;
    publish("busy");
  });
  pi.on("agent_settled", () => {
    if (ctx.isIdle() && !ctx.hasPendingMessages()) publish("idle");
  });
  pi.on("session_shutdown", (event) => {
    clearInterval(timer);
    if (event.reason !== "reload") publish("exited");
  });
}

export default function subagentExtension(pi: ExtensionAPI): void {
  const childDir = process.env.PI_SUBAGENT_RUN_DIR;
  if (childDir) {
    childBridge(pi, childDir);
    return;
  }

  pi.on("resources_discover", () => ({
    skillPaths: [join(dirname(fileURLToPath(import.meta.url)), "skills")],
  }));

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate independent work to Pi in a Ghostty window on the magic scratchpad. " +
      "spawn requires name and prompt and returns an id. list shows this session's children. " +
      "send requires id and prompt: steer busy work, or use followUp to queue another turn. " +
      "wait requires id and returns the final response, waiting up to timeout seconds (default 60). " +
      "stop requires id and closes the child, deleting its transcript and metadata. " +
      "Children share your working directory and inherit your model and configuration, not your conversation. " +
      "Stop children when no more follow-up work is needed; do not concurrently edit the same files.",
    parameters: Type.Object({
      action: Type.Union(
        ["spawn", "list", "send", "wait", "stop"].map((action) =>
          Type.Literal(action),
        ),
      ),
      id: Type.Optional(Type.String({ pattern: "^[a-f0-9]{8}$" })),
      name: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 64,
          pattern: "^[^\\x00-\\x1f\\x7f]+$",
        }),
      ),
      prompt: Type.Optional(Type.String({ minLength: 1 })),
      followUp: Type.Optional(Type.Boolean()),
      timeout: Type.Optional(Type.Integer({ minimum: 1, maximum: 1800 })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      let text: string;
      let id = params.id;
      let fullOutput = join(ROOT, ctx.sessionManager.getSessionId());
      if (params.action === "list") {
        text = JSON.stringify(
          runs(ctx).map((run) => ({
            id: run.id,
            name: run.name,
            ...readState(runDir(ctx, run.id)),
            session: join(runDir(ctx, run.id), "session.jsonl"),
          })),
        );
      } else if (params.action === "spawn") {
        if (ctx.mode !== "tui")
          throw new Error("Subagents require interactive Pi on Hyprland");
        if (!params.name?.trim() || !params.prompt?.trim())
          throw new Error("spawn requires name and prompt");
        if (!ctx.model) throw new Error("No model selected");
        const run: Run = {
          id: randomUUID().slice(0, 8),
          name: params.name.trim(),
          cwd: ctx.cwd,
          provider: ctx.model.provider,
          model: ctx.model.id,
          thinking: pi.getThinkingLevel(),
        };
        id = run.id;
        const dir = runDir(ctx, run.id);
        mkdirSync(join(dir, "inbox"), { recursive: true, mode: 0o700 });
        writeJson(join(dir, "run.json"), run);
        writeFileSync(join(dir, "session.jsonl"), "", {
          mode: 0o600,
          flag: "wx",
        });
        writeJson(join(dir, "state.json"), {
          pid: 0,
          state: "starting",
          started: false,
        });
        try {
          await launch(dir, run, signal);
          queue(dir, { prompt: params.prompt, followUp: false });
        } catch (error) {
          writeJson(join(dir, "state.json"), {
            pid: 0,
            state: "error",
            started: false,
            error: String(error),
          });
          throw error;
        }
        text = `Spawned ${run.name} (${run.id}) on special:magic`;
      } else {
        if (!params.id) throw new Error(`${params.action} requires id`);
        const dir = runDir(ctx, params.id);
        if (!existsSync(dir)) throw new Error(`Unknown subagent: ${params.id}`);
        if (params.action === "stop") {
          await stop(dir);
          text = `Stopped ${params.id}; deleted its transcript and metadata`;
        } else if (params.action === "send") {
          if (!params.prompt?.trim()) throw new Error("send requires prompt");
          const state = readState(dir).state;
          if (state === "exited" || state === "error")
            throw new Error(`Subagent ${params.id} is ${state}`);
          queue(dir, {
            prompt: params.prompt,
            followUp: params.followUp ?? false,
          });
          text = `Sent to ${params.id}`;
        } else {
          const deadline = Date.now() + (params.timeout ?? 60) * 1000;
          while (true) {
            signal?.throwIfAborted();
            const state = readState(dir);
            if (state.state === "error") throw new Error(state.error);
            if (state.state === "exited")
              throw new Error(
                `Subagent ${params.id} closed; transcript: ${join(dir, "session.jsonl")}`,
              );
            const pending = readdirSync(join(dir, "inbox")).some((name) =>
              name.endsWith(".json"),
            );
            if (state.started && state.state === "idle" && !pending) break;
            if (Date.now() >= deadline) {
              return {
                content: [
                  {
                    type: "text",
                    text: `${params.id} is still ${state.state}`,
                  },
                ],
                details: state,
              };
            }
            await delay(250, undefined, { signal });
          }
          const session = join(dir, "session.jsonl");
          const message = SessionManager.open(session)
            .getBranch()
            .flatMap((entry) =>
              entry.type === "message" && entry.message.role === "assistant"
                ? [entry.message]
                : [],
            )
            .at(-1);
          if (!message)
            throw new Error("Subagent finished without an assistant response");
          if (
            message.stopReason === "error" ||
            message.stopReason === "aborted"
          ) {
            throw new Error(
              message.errorMessage ?? `Subagent ${message.stopReason}`,
            );
          }
          text = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
          fullOutput = session;
        }
      }
      const output = truncateHead(text);
      return {
        content: [
          {
            type: "text",
            text:
              output.content +
              (output.truncated
                ? `\n[Truncated; full data: ${fullOutput}]`
                : ""),
          },
        ],
        details: { id },
      };
    },
  });

  pi.registerCommand("subagent", {
    description: "Focus a child Pi window on the magic scratchpad",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return;
      const active = runs(ctx).filter(
        (run) =>
          !["exited", "error"].includes(readState(runDir(ctx, run.id)).state),
      );
      if (!active.length) {
        ctx.ui.notify("No active subagents", "info");
        return;
      }
      const choices = active.map((run) => `${run.name} (${run.id})`);
      const selected = await ctx.ui.select("Subagents", choices);
      if (!selected) return;
      const run = active[choices.indexOf(selected)];
      const result = await pi.exec("/usr/bin/hyprctl", [
        "--batch",
        'dispatch hl.dsp.focus({ workspace = "special:magic" }); ' +
          `dispatch hl.dsp.focus({ window = ${JSON.stringify(windowSelector(run.id))} })`,
      ]);
      if (result.code !== 0)
        ctx.ui.notify(result.stderr || result.stdout, "error");
    },
  });

  let timer: ReturnType<typeof setInterval>;
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    const refresh = (): void => {
      const active = runs(ctx)
        .map((run) => `${run.name}:${readState(runDir(ctx, run.id)).state}`)
        .filter((label) => !label.endsWith(":exited"));
      ctx.ui.setWidget(
        "subagents",
        active.length ? [`subagents: ${active.join(" | ")}`] : undefined,
        { placement: "belowEditor" },
      );
    };
    refresh();
    timer = setInterval(refresh, 1000);
    timer.unref();
  });
  pi.on("session_shutdown", async (event, ctx) => {
    clearInterval(timer);
    ctx.ui.setWidget("subagents", undefined);
    if (event.reason !== "reload")
      await Promise.all(runs(ctx).map((run) => stop(runDir(ctx, run.id))));
  });
}
