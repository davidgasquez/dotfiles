import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function customCodexExtension(pi: ExtensionAPI): void {
  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "openai-codex" || !isRecord(event.payload)) {
      return;
    }

    const text = isRecord(event.payload.text) ? event.payload.text : {};
    return {
      ...event.payload,
      service_tier: "priority",
      text: { ...text, verbosity: "low" },
    };
  });
}
