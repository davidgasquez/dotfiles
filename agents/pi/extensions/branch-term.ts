import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";

const TERMINAL_FLAG = "branch-terminal";
const WINDOW_TITLE = "branch";

type LaunchMode = "terminal" | "tmux" | "ghostty";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function renderTerminalCommand(
  template: string,
  values: Record<string, string>,
): string {
  let command = template;
  for (const [key, value] of Object.entries(values)) {
    command = command.replaceAll(`{${key}}`, shellQuote(value));
  }
  return template.includes("{session}")
    ? command
    : `${command} ${shellQuote(values.session)}`;
}

function spawnDetached(
  command: string,
  args: string[],
  cwd: string,
  onOpen: () => void,
  onError: (error: Error) => void,
): void {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.once("spawn", onOpen);
  child.once("error", onError);
  child.unref();
}

function notifyOpened(
  ctx: ExtensionCommandContext,
  excludedInflightTurn: boolean,
  mode: LaunchMode,
): void {
  const location =
    mode === "tmux"
      ? "new tmux window"
      : mode === "ghostty"
        ? "new Ghostty window"
        : "new terminal";
  const snapshot = excludedInflightTurn
    ? "snapshot fork from the last completed turn"
    : "snapshot fork";
  ctx.ui.notify(`Opened ${snapshot} in a ${location}`, "info");
}

function notifyLaunchError(
  ctx: ExtensionCommandContext,
  launcher: string,
  error: Error,
  snapshotFile: string,
): void {
  ctx.ui.notify(`${launcher} failed to open: ${error.message}`, "warning");
  ctx.ui.notify(`Run: pi --session ${snapshotFile}`, "info");
}

function selectSnapshotLeaf(ctx: ExtensionCommandContext): {
  leafId: string;
  excludedInflightTurn: boolean;
} {
  const currentLeafId = ctx.sessionManager.getLeafId();
  if (!currentLeafId) {
    throw new Error("The current session has no conversation to branch");
  }

  if (ctx.isIdle() && !ctx.hasPendingMessages()) {
    return { leafId: currentLeafId, excludedInflightTurn: false };
  }

  const branch = ctx.sessionManager.getBranch(currentLeafId);
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry.type !== "message" || entry.message.role !== "user") continue;

    const hasEarlierAssistant = branch.slice(0, index).some(
      (candidate) =>
        candidate.type === "message" &&
        candidate.message.role === "assistant",
    );
    if (entry.parentId && hasEarlierAssistant) {
      return { leafId: entry.parentId, excludedInflightTurn: true };
    }
    break;
  }

  return { leafId: currentLeafId, excludedInflightTurn: false };
}

function createSnapshot(ctx: ExtensionCommandContext): {
  snapshotFile: string;
  excludedInflightTurn: boolean;
} {
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile || !existsSync(sessionFile)) {
    throw new Error(
      "This session has not been saved yet; wait for the first assistant response",
    );
  }

  const selection = selectSnapshotLeaf(ctx);
  const source = SessionManager.open(
    sessionFile,
    ctx.sessionManager.getSessionDir(),
  );
  const snapshotFile = source.createBranchedSession(selection.leafId);
  if (!snapshotFile) throw new Error("Failed to create a persisted branch");

  return { snapshotFile, ...selection };
}

async function openSnapshotTerminal(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  snapshotFile: string,
  excludedInflightTurn: boolean,
  terminalCommand: string | undefined,
): Promise<void> {
  if (terminalCommand) {
    const command = renderTerminalCommand(terminalCommand, {
      session: snapshotFile,
      cwd: ctx.cwd,
      title: WINDOW_TITLE,
    });
    spawnDetached(
      "bash",
      ["-lc", command],
      ctx.cwd,
      () => notifyOpened(ctx, excludedInflightTurn, "terminal"),
      (error) => notifyLaunchError(ctx, "Terminal command", error, snapshotFile),
    );
    return;
  }

  if (process.env.TMUX) {
    const result = await pi.exec("tmux", [
      "new-window",
      "-n",
      WINDOW_TITLE,
      "-c",
      ctx.cwd,
      "pi",
      "--session",
      snapshotFile,
    ]);
    if (result.code !== 0) {
      notifyLaunchError(
        ctx,
        "tmux",
        new Error(result.stderr || result.stdout || "tmux new-window failed"),
        snapshotFile,
      );
      return;
    }
    notifyOpened(ctx, excludedInflightTurn, "tmux");
    return;
  }

  spawnDetached(
    "ghostty",
    [
      "+new-window",
      `--working-directory=${ctx.cwd}`,
      `--title=${WINDOW_TITLE}`,
      "-e",
      "pi",
      "--session",
      snapshotFile,
    ],
    ctx.cwd,
    () => notifyOpened(ctx, excludedInflightTurn, "ghostty"),
    (error) => notifyLaunchError(ctx, "Ghostty", error, snapshotFile),
  );
}

export default function (pi: ExtensionAPI) {
  pi.registerFlag(TERMINAL_FLAG, {
    description:
      "Command used by /branch. Supports {session}, {cwd}, and {title} placeholders.",
    type: "string",
  });

  pi.registerCommand("branch", {
    description: "Open a snapshot fork in a new terminal",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/branch is only available in interactive mode", "warning");
        return;
      }

      try {
        const { snapshotFile, excludedInflightTurn } = createSnapshot(ctx);
        const flag = pi.getFlag(TERMINAL_FLAG);
        const terminalCommand =
          typeof flag === "string" && flag.trim() ? flag.trim() : undefined;
        await openSnapshotTerminal(
          pi,
          ctx,
          snapshotFile,
          excludedInflightTurn,
          terminalCommand,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Failed to branch session: ${message}`, "error");
      }
    },
  });
}
