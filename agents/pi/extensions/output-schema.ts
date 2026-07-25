import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const FLAG_NAME = "output-schema";
const TOOL_NAME = "submit_output";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonSchema = Record<string, unknown>;
type SubmitOutputParams = Record<string, Json>;

function readSchema(path: string): JsonSchema {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as JsonSchema).type !== "object"
  ) {
    throw new Error(`${FLAG_NAME}: root schema must be an object schema`);
  }
  return value as JsonSchema;
}

function buildSystemPrompt(basePrompt: string, schemaPath: string): string {
  return `${basePrompt}\n\n[Structured output contract]\nThe user started pi with --${FLAG_NAME} ${schemaPath}.\nFinish by calling ${TOOL_NAME} exactly once with arguments matching the provided JSON schema.\n- ${TOOL_NAME} must be the only tool call in the final tool batch.\n- Do not emit prose, markdown, or another assistant response after calling it.\n- If the tool rejects the arguments, correct them and try again.`;
}

export default function outputSchemaExtension(pi: ExtensionAPI): void {
  let schemaPath: string | undefined;

  pi.registerFlag(FLAG_NAME, {
    description:
      "Path to a JSON Schema file that the final response must match",
    type: "string",
  });

  pi.on("session_start", (_event, ctx) => {
    const flagValue = pi.getFlag(FLAG_NAME);
    if (typeof flagValue !== "string" || !flagValue.trim()) return;

    schemaPath = resolve(ctx.cwd, flagValue);
    const schema = readSchema(schemaPath);

    pi.registerTool({
      name: TOOL_NAME,
      label: "Submit Output",
      description:
        "Submit the final JSON output as the only tool call in the final tool batch.",
      promptSnippet:
        "Submit the final response as JSON matching the requested schema",
      promptGuidelines: [
        `Call ${TOOL_NAME} exactly once when the task is complete.`,
        `Call ${TOOL_NAME} alone in its final tool batch.`,
      ],
      parameters: Type.Unsafe<SubmitOutputParams>(schema as never),
      async execute(_toolCallId, params) {
        return {
          content: [{ type: "text", text: JSON.stringify(params) }],
          details: { output: params },
          terminate: true,
        };
      },
    });

    pi.setActiveTools([...new Set([...pi.getActiveTools(), TOOL_NAME])]);
  });

  pi.on("before_agent_start", (event) => {
    if (!schemaPath) return;
    return { systemPrompt: buildSystemPrompt(event.systemPrompt, schemaPath) };
  });
}
