import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  const terminal = process.env.HC_TERMINAL_ID;
  if (!terminal) return;
  let warned = false;

  async function publish(_event: unknown, ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI) return;
    try {
      const result = await pi.exec("hc", [
        "label", terminal,
        `pi.session=${pi.getSessionName() ?? ""}`,
        `pi.session-file=${ctx.sessionManager.getSessionFile() ?? ""}`,
        `pi.session-id=${ctx.sessionManager.getSessionId()}`,
        `pi.session-dir=${ctx.sessionManager.getSessionDir()}`,
      ], { timeout: 3000 });
      if (result.code !== 0) throw new Error(result.stderr.trim() || "hc label failed");
      warned = false;
    } catch (error) {
      if (!warned) ctx.ui.notify(`Cannot publish Pi session to Herdr: ${String(error)}`, "warning");
      warned = true;
    }
  }

  pi.on("session_start", publish);
  pi.on("session_info_changed", publish);
  pi.on("agent_settled", publish);
}
