import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const FLAG_NAME = "output-schema";
const TOOL_NAME = "submit_output";
const MAX_REPAIR_ATTEMPTS = 2;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: Json[];
  description?: string;
  [key: string]: unknown;
};

type SubmitOutputParams = Record<string, Json>;

type AgentEndEvent = {
  messages?: Array<{
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonSchema(value: unknown): JsonSchema {
  if (!isRecord(value)) {
    throw new Error("output schema must be a JSON object");
  }
  return value as JsonSchema;
}

function assertSupportedSchema(
  schema: JsonSchema,
  path = "$",
  isRoot = true,
): void {
  for (const key of [
    "$ref",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "if",
    "then",
    "else",
    "patternProperties",
  ]) {
    if (key in schema) {
      throw new Error(
        `${FLAG_NAME}: unsupported schema feature at ${path}: ${key}`,
      );
    }
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      throw new Error(
        `${FLAG_NAME}: enum at ${path} must be a non-empty array`,
      );
    }
    return;
  }

  const type = schema.type;
  if (typeof type !== "string") {
    throw new Error(
      `${FLAG_NAME}: schema at ${path} must declare a string type`,
    );
  }

  if (isRoot && type !== "object") {
    throw new Error(`${FLAG_NAME}: root schema must be an object`);
  }

  if (
    ![
      "object",
      "array",
      "string",
      "number",
      "integer",
      "boolean",
      "null",
    ].includes(type)
  ) {
    throw new Error(`${FLAG_NAME}: unsupported type at ${path}: ${type}`);
  }

  if (type === "object") {
    const properties = schema.properties;
    if (!isRecord(properties)) {
      throw new Error(
        `${FLAG_NAME}: object schema at ${path} must define properties`,
      );
    }

    if (schema.required !== undefined && !Array.isArray(schema.required)) {
      throw new Error(
        `${FLAG_NAME}: required at ${path} must be an array of strings`,
      );
    }

    for (const [key, child] of Object.entries(properties)) {
      assertSupportedSchema(asJsonSchema(child), `${path}.${key}`, false);
    }
    return;
  }

  if (type === "array") {
    if (schema.items === undefined) {
      throw new Error(
        `${FLAG_NAME}: array schema at ${path} must define items`,
      );
    }
    assertSupportedSchema(asJsonSchema(schema.items), `${path}[]`, false);
  }
}

function isJson(value: unknown): value is Json {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJson);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function jsonEquals(left: Json, right: Json): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateValue(
  schema: JsonSchema,
  value: unknown,
  path = "$",
  errors: string[] = [],
): string[] {
  if (schema.enum !== undefined) {
    if (
      !isJson(value) ||
      !schema.enum.some((item) => jsonEquals(item, value))
    ) {
      errors.push(`${path} must be one of the enum values`);
    }
    return errors;
  }

  switch (schema.type) {
    case "object": {
      if (!isRecord(value) || Array.isArray(value)) {
        errors.push(`${path} must be an object`);
        return errors;
      }

      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? schema.required : [];

      for (const key of required) {
        if (!(key in value)) {
          errors.push(`${path}.${key} is required`);
        }
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in properties)) {
            errors.push(`${path}.${key} is not allowed`);
          }
        }
      }

      for (const [key, childSchema] of Object.entries(properties)) {
        if (!(key in value)) continue;
        validateValue(
          asJsonSchema(childSchema),
          value[key],
          `${path}.${key}`,
          errors,
        );
      }
      return errors;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
        return errors;
      }

      const itemSchema = asJsonSchema(schema.items);
      for (let index = 0; index < value.length; index += 1) {
        validateValue(itemSchema, value[index], `${path}[${index}]`, errors);
      }
      return errors;
    }
    case "string": {
      if (typeof value !== "string") errors.push(`${path} must be a string`);
      return errors;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${path} must be a finite number`);
      }
      return errors;
    }
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push(`${path} must be an integer`);
      }
      return errors;
    }
    case "boolean": {
      if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
      return errors;
    }
    case "null": {
      if (value !== null) errors.push(`${path} must be null`);
      return errors;
    }
    default: {
      errors.push(
        `${path} has unsupported schema type ${describeValue(schema.type)}`,
      );
      return errors;
    }
  }
}

function getFinalAssistantText(event: AgentEndEvent): string | undefined {
  const messages = event.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const text = (message.content ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return text;
  }
  return undefined;
}

function buildSystemPrompt(basePrompt: string, schemaPath: string): string {
  return `${basePrompt}\n\n[Structured output contract]\nThe user started pi with --${FLAG_NAME} ${schemaPath}.\nYou must finish by calling ${TOOL_NAME} exactly once with arguments that match the provided JSON schema.\n- ${TOOL_NAME} must be your final tool call.\n- Do not end with prose, markdown, or explanations.\n- After the tool call, your final assistant text must be exactly the same JSON object and nothing else.\n- If the tool rejects your arguments, fix them and call ${TOOL_NAME} again.`;
}

export default function outputSchemaExtension(pi: ExtensionAPI): void {
  let enabled = false;
  let schemaPath: string | undefined;
  let schema: JsonSchema | undefined;
  let acceptedJson: string | undefined;
  let repairAttempts = 0;
  let repairing = false;
  let toolRegistered = false;

  function isActive(): boolean {
    return enabled && schema !== undefined && schemaPath !== undefined;
  }

  function ensureToolRegistered(): void {
    if (toolRegistered || !schema) return;

    pi.registerTool({
      name: TOOL_NAME,
      label: "Submit Output",
      description:
        "Submit the final JSON output. Use this exactly once as the final tool call.",
      promptSnippet:
        "Submit the final response as JSON matching the requested schema.",
      promptGuidelines: [
        `Call ${TOOL_NAME} exactly once when the task is complete.`,
        "Pass arguments that match the active output schema exactly.",
        "After the tool call, emit exactly the same JSON and nothing else.",
      ],
      parameters: Type.Unsafe<Record<string, Json>>(schema as never),
      async execute(_toolCallId: string, params: SubmitOutputParams) {
        if (!isActive() || !schema) {
          throw new Error(
            `${TOOL_NAME} is only available when --${FLAG_NAME} is set`,
          );
        }

        const errors = validateValue(schema, params);
        if (errors.length > 0) {
          throw new Error(
            `output does not match schema:\n- ${errors.join("\n- ")}`,
          );
        }

        acceptedJson = JSON.stringify(params);
        repairing = false;
        return {
          content: [{ type: "text", text: acceptedJson }],
          details: { output: params },
        };
      },
    });

    toolRegistered = true;
  }

  function ensureToolActive(): void {
    if (!toolRegistered) return;
    const activeTools = new Set(pi.getActiveTools());
    if (activeTools.has(TOOL_NAME)) return;
    activeTools.add(TOOL_NAME);
    pi.setActiveTools([...activeTools]);
  }

  function resetState(): void {
    enabled = false;
    schemaPath = undefined;
    schema = undefined;
    acceptedJson = undefined;
    repairAttempts = 0;
    repairing = false;
  }

  pi.registerFlag(FLAG_NAME, {
    description:
      "Path to a JSON Schema file that the final response must match",
    type: "string",
  });

  pi.on("session_start", async (_event, ctx) => {
    resetState();

    const flagValue = pi.getFlag(FLAG_NAME);
    if (typeof flagValue !== "string" || flagValue.trim().length === 0) {
      return;
    }

    schemaPath = resolve(ctx.cwd, flagValue);
    const raw = readFileSync(schemaPath, "utf8");
    schema = asJsonSchema(JSON.parse(raw));
    assertSupportedSchema(schema);
    enabled = true;
    ensureToolRegistered();
    ensureToolActive();
  });

  pi.on("before_agent_start", async (event) => {
    if (!isActive() || !schemaPath) return;
    ensureToolActive();

    if (!repairing) {
      acceptedJson = undefined;
      repairAttempts = 0;
    }

    return {
      systemPrompt: buildSystemPrompt(event.systemPrompt, schemaPath),
    };
  });

  pi.on("agent_end", async (event: AgentEndEvent, ctx) => {
    if (!isActive() || !schemaPath) return;
    if (repairAttempts >= MAX_REPAIR_ATTEMPTS) return;

    if (!acceptedJson) {
      repairAttempts += 1;
      repairing = true;
      const followUp = `You stopped without calling ${TOOL_NAME}. Call ${TOOL_NAME} now with JSON that matches ${schemaPath}. After the tool call, output exactly the same JSON and nothing else.`;
      if (ctx.isIdle()) pi.sendUserMessage(followUp);
      else pi.sendUserMessage(followUp, { deliverAs: "followUp" });
      return;
    }

    const finalAssistantText = getFinalAssistantText(event);
    if (finalAssistantText === acceptedJson) {
      repairAttempts = 0;
      repairing = false;
      return;
    }

    repairAttempts += 1;
    repairing = true;
    const correction = `Your final response must be exactly this JSON and nothing else:\n${acceptedJson}`;
    if (ctx.isIdle()) pi.sendUserMessage(correction);
    else pi.sendUserMessage(correction, { deliverAs: "followUp" });
  });
}
