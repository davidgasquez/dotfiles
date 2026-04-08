import { complete, type UserMessage } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "session-topic";
const MAX_LABEL_LENGTH = 60;
const NAMING_PROMPT = `You create short session title for coding tasks.

Return text only.

Requirements:
- 2 to 10 words
- no quotes
- no punctuation unless clearly needed
- capture the user's concrete project or task
- avoid vague summaries`;

type TextPart = {
  type?: string;
  text?: string;
};

function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";

  return parts
    .filter((part): part is TextPart => {
      return (
        typeof part === "object" &&
        part !== null &&
        (part as TextPart).type === "text" &&
        typeof (part as TextPart).text === "string"
      );
    })
    .map((part) => part.text ?? "")
    .join(" ");
}

function sanitizeLabel(value: string): string | undefined {
  const normalized = value
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();

  if (!normalized) return undefined;

  const capped = normalized.slice(0, MAX_LABEL_LENGTH).trim();
  return capped.length > 0 ? capped : undefined;
}

function clearStatus(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus(STATUS_KEY, undefined);
}

async function deriveLabel(
  prompt: string,
  ctx: ExtensionContext,
): Promise<string | undefined> {
  const model = ctx.model;
  if (!model) return undefined;

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) return undefined;

  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
  };

  const response = await complete(
    model,
    {
      systemPrompt: NAMING_PROMPT,
      messages: [userMessage],
    },
    {
      apiKey: auth.apiKey,
      headers: auth.headers,
      maxTokens: 24,
      signal: ctx.signal,
    },
  );

  if (response.stopReason === "aborted") return undefined;
  return sanitizeLabel(extractText(response.content));
}

export default function sessionTopicExtension(pi: ExtensionAPI): void {
  let namingStarted = false;
  let sessionToken = 0;

  pi.on("session_start", async (_event, ctx) => {
    sessionToken += 1;
    namingStarted = false;
    clearStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    sessionToken += 1;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (pi.getSessionName() || namingStarted) return;

    const prompt = event.prompt.trim();
    if (!prompt) return;

    namingStarted = true;
    const requestToken = sessionToken;

    void deriveLabel(prompt, ctx)
      .then((label) => {
        if (requestToken !== sessionToken || pi.getSessionName()) return;
        if (!label) return;

        pi.setSessionName(label);
      })
      .catch(() => {});
  });
}
