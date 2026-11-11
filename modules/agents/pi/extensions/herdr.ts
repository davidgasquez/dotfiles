import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";

const MAX_PREVIEW_LENGTH = 300;
const HERDR_APP_TIMEOUT_MS = 15_000;

const execFileAsync = promisify(execFile);

type HerdrLayout = {
  spaces?: {
    id?: string;
    tabs?: { terminals?: { terminal?: string }[] }[];
  }[];
};

function finalReply(ctx: ExtensionContext): string {
  const entry = ctx.sessionManager
    .getBranch()
    .findLast(
      (entry) => entry.type === "message" && entry.message.role === "assistant",
    );
  if (entry?.type !== "message" || entry.message.role !== "assistant")
    return "";
  return entry.message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PREVIEW_LENGTH);
}

function registerPreview(pi: ExtensionAPI, terminal: string): void {
  const runtime = process.env.XDG_RUNTIME_DIR;
  if (!runtime) return;
  const file = join(runtime, "herdr-pi", terminal);

  const clear = () => rmSync(file, { force: true });

  pi.on("agent_settled", (event, ctx) => {
    const text = event.aborted ? "" : finalReply(ctx);
    if (!text) return clear();
    mkdirSync(join(file, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(file, text, { mode: 0o600 });
  });

  pi.on("session_compact", clear);
  pi.on("session_shutdown", clear);
}

function selectSnapshotLeaf(ctx: ExtensionContext): {
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

function createSnapshot(ctx: ExtensionContext): {
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

async function herdrApp(args: string[]): Promise<Record<string, unknown>> {
  const command = `herdr-app ${args.slice(0, args[0] === "do" ? 2 : 1).join(" ")}`;
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("herdr-app", args, {
      timeout: HERDR_APP_TIMEOUT_MS,
    }));
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };
    if (failure.code === "ENOENT")
      throw new Error("herdr-app is not installed");
    if (failure.killed) throw new Error(`${command} timed out`);
    let message = failure.stderr?.trim() || failure.message;
    try {
      message = JSON.parse(failure.stdout ?? "").error ?? message;
    } catch {}
    throw new Error(message);
  }

  let reply: unknown;
  try {
    reply = JSON.parse(stdout);
  } catch {
    throw new Error(`${command} returned invalid JSON`);
  }
  if (typeof reply !== "object" || reply === null || Array.isArray(reply)) {
    throw new Error(`${command} returned an unexpected reply`);
  }
  if ("error" in reply) throw new Error(String(reply.error));
  return reply as Record<string, unknown>;
}

async function findSpace(terminal: string): Promise<string> {
  const layout = (await herdrApp(["ls"])) as HerdrLayout;
  const space = layout.spaces?.find((space) =>
    space.tabs?.some((tab) =>
      tab.terminals?.some((entry) => entry.terminal === terminal),
    ),
  );
  if (!space?.id) {
    throw new Error(`Terminal ${terminal} is not shown in a Herdr tab`);
  }
  return space.id;
}

async function openFork(
  space: string,
  folder: string,
  snapshotFile: string,
): Promise<string> {
  const reply = await herdrApp([
    "do",
    "tab.new",
    JSON.stringify({
      space,
      name: "Pi fork",
      folder,
      argv: ["exec", "pi", "--session", snapshotFile],
    }),
  ]);
  const { tab, terminal } = reply;
  if (
    reply.space !== space ||
    typeof tab !== "string" ||
    !tab ||
    typeof terminal !== "string" ||
    !terminal
  ) {
    throw new Error(
      `herdr-app do tab.new returned an unexpected reply: ${JSON.stringify(reply)}`,
    );
  }
  return terminal;
}

function registerBranch(pi: ExtensionAPI, terminal: string): void {
  let pending = false;

  const branch = async (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("/branch is only available in interactive mode", "warning");
      return;
    }
    if (pending) {
      ctx.ui.notify("A fork is already being opened", "warning");
      return;
    }

    pending = true;
    let snapshotFile: string | undefined;
    try {
      const space = await findSpace(terminal);
      const snapshot = createSnapshot(ctx);
      snapshotFile = snapshot.snapshotFile;
      const fork = await openFork(space, ctx.cwd, snapshotFile);
      ctx.ui.notify(
        snapshot.excludedInflightTurn
          ? `Opened a fork from the last completed turn in Herdr (${fork})`
          : `Opened a snapshot fork in Herdr (${fork})`,
        "info",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(
        snapshotFile
          ? `Failed to open fork: ${message}. Snapshot saved at ${snapshotFile}`
          : `Failed to branch session: ${message}`,
        "error",
      );
    } finally {
      pending = false;
    }
  };

  pi.registerCommand("branch", {
    description: "Open a snapshot fork in a new Herdr tab",
    handler: (_args, ctx) => branch(ctx),
  });
  pi.registerShortcut("f6", {
    description: "Open a snapshot fork in a new Herdr tab",
    handler: branch,
  });
}

export default function herdrExtension(pi: ExtensionAPI): void {
  const terminal = process.env.HC_TERMINAL_ID;
  if (!terminal || !/^[\w-]+$/.test(terminal)) return;

  registerPreview(pi, terminal);
  registerBranch(pi, terminal);
}
