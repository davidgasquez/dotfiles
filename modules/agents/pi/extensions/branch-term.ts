import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";

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

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("branch", {
    description: "Open a snapshot fork in a new Ghostty window",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/branch is only available in interactive mode", "warning");
        return;
      }

      try {
        const { snapshotFile, excludedInflightTurn } = createSnapshot(ctx);
        const child = spawn(
          "ghostty",
          [
            "+new-window",
            `--working-directory=${ctx.cwd}`,
            "-e",
            "pi",
            "--session",
            snapshotFile,
          ],
          { cwd: ctx.cwd, detached: true, stdio: "ignore" },
        );
        await new Promise<void>((resolve, reject) => {
          child.once("spawn", resolve);
          child.once("error", reject);
        });
        child.unref();
        ctx.ui.notify(
          excludedInflightTurn
            ? "Opened a fork from the last completed turn in Ghostty"
            : "Opened a snapshot fork in Ghostty",
          "info",
        );
      } catch (error) {
        ctx.ui.notify(`Failed to branch session: ${String(error)}`, "error");
      }
    },
  });
}
