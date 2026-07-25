import type { UserMessage } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

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
  return capped || undefined;
}

async function deriveLabel(
  prompt: string,
  ctx: ExtensionContext,
): Promise<string | undefined> {
  const model = ctx.model;
  if (!model) throw new Error("no model is selected");

  const provider = ctx.modelRegistry.getProvider(model.provider);
  if (!provider) throw new Error(`provider ${model.provider} is unavailable`);

  const auth = await ctx.modelRegistry.getProviderAuth(model.provider);
  if (!auth) throw new Error(`provider ${model.provider} is not authenticated`);

  const requestModel = auth.auth.baseUrl
    ? { ...model, baseUrl: auth.auth.baseUrl }
    : model;
  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
  };
  const response = await provider
    .streamSimple(
      requestModel,
      { systemPrompt: NAMING_PROMPT, messages: [userMessage] },
      {
        apiKey: auth.auth.apiKey,
        headers: auth.auth.headers,
        env: auth.env,
        maxTokens: 24,
        cacheRetention: "none",
        signal: ctx.signal,
      },
    )
    .result();

  if (response.stopReason === "aborted") return undefined;
  if (response.stopReason === "error") {
    throw new Error(response.errorMessage ?? "provider request failed");
  }
  return sanitizeLabel(extractText(response.content));
}

export default function sessionTopicExtension(pi: ExtensionAPI): void {
  let namingStarted = false;
  let sessionToken = 0;

  pi.on("session_start", () => {
    sessionToken += 1;
    namingStarted = false;
  });

  pi.on("session_shutdown", () => {
    sessionToken += 1;
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (pi.getSessionName() || namingStarted) return;

    const prompt = event.prompt.trim();
    if (!prompt) return;

    namingStarted = true;
    const requestToken = sessionToken;

    void deriveLabel(prompt, ctx)
      .then((label) => {
        if (requestToken !== sessionToken || pi.getSessionName() || !label)
          return;
        pi.setSessionName(label);
      })
      .catch((error) => {
        if (requestToken !== sessionToken) return;
        namingStarted = false;
        const message = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.notify(`Session naming failed: ${message}`, "warning");
        } else {
          console.error(`Session naming failed: ${message}`);
        }
      });
  });
}
