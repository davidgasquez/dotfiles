import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const MAX_PREVIEW_LENGTH = 300;

function previewFile(): string | undefined {
  const runtime = process.env.XDG_RUNTIME_DIR;
  const terminal = process.env.HC_TERMINAL_ID;
  if (!runtime || !terminal || !/^[\w-]+$/.test(terminal)) return undefined;
  return join(runtime, "herdr-pi", terminal);
}

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

export default function herdrPreviewExtension(pi: ExtensionAPI): void {
  const file = previewFile();
  if (!file) return;

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
