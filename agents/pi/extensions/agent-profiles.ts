import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  getAgentDir,
  parseFrontmatter,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";

type AgentSource = "user" | "project" | "path";
type PiModel = NonNullable<ReturnType<ExtensionContext["modelRegistry"]["find"]>>;

interface ParsedAgentConfig {
  model?: string;
  tools?: string[];
  systemPrompt?: string;
}

interface ResolvedAgent extends ParsedAgentConfig {
  name: string;
  configPath: string;
  source: AgentSource;
}

const AGENT_FLAG = "agent";
const ALLOWED_AGENT_KEYS = new Set([
  "name",
  "description",
  "model",
  "tools",
]);

function getAgentArg(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function normalizeAgentName(value: string): string {
  return stripMarkdownExtension(value.trim().toLowerCase());
}

function getUserAgentsDir(): string {
  return join(getAgentDir(), "agents");
}

function getAncestorDirs(start: string): string[] {
  const dirs: string[] = [];
  let current = resolve(start);
  while (true) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

function hasMarkdownExtension(value: string): boolean {
  return /\.md$/i.test(value);
}

function isAgentPath(value: string): boolean {
  return (
    value === "~" ||
    value.startsWith("~/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    isAbsolute(value) ||
    value.includes("/")
  );
}

function resolveAgentFilePath(value: string, cwd: string): string {
  if (value === "~" || value.startsWith("~/")) {
    return resolve(join(homedir(), value.slice(2)));
  }
  if (value.startsWith("~")) {
    throw new Error(`Unsupported home path "${value}"; use ~/path instead`);
  }
  if (isAbsolute(value)) return resolve(value);
  return resolve(cwd, value);
}

function findNamedAgent(agentName: string, cwd: string): { path: string; source: AgentSource } {
  for (const dir of getAncestorDirs(cwd)) {
    const path = join(dir, ".pi", "agents", `${agentName}.md`);
    if (existsSync(path)) return { path, source: "project" };
  }

  const userPath = join(getUserAgentsDir(), `${agentName}.md`);
  if (existsSync(userPath)) return { path: userPath, source: "user" };

  throw new Error(
    `Agent "${agentName}" not found in project .pi/agents or ${getUserAgentsDir()}`,
  );
}

function resolveAgentSelection(
  value: string,
  cwd: string,
): { name: string; configPath: string; source: AgentSource } {
  const explicitPath = isAgentPath(value);

  if (explicitPath || hasMarkdownExtension(value)) {
    const configPath = resolveAgentFilePath(value, cwd);
    if (existsSync(configPath)) {
      return {
        name: normalizeAgentName(basename(configPath)),
        configPath,
        source: "path",
      };
    }

    if (explicitPath) throw new Error(`Agent file not found: ${configPath}`);
  }

  const name = normalizeAgentName(value);
  if (name.length === 0) throw new Error("Agent name cannot be empty");

  const found = findNamedAgent(name, cwd);
  return { name, configPath: found.path, source: found.source };
}

function parseTools(value: unknown, configPath: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);
  }
  if (Array.isArray(value) && value.every((tool) => typeof tool === "string")) {
    return value.map((tool) => tool.trim()).filter((tool) => tool.length > 0);
  }
  throw new Error(`${configPath}: "tools" must be a comma-separated string or string list`);
}

function parseAgentMarkdown(content: string, configPath: string): ParsedAgentConfig {
  const { frontmatter: data, body } = parseFrontmatter<Record<string, unknown>>(content);

  for (const key of Object.keys(data)) {
    if (!ALLOWED_AGENT_KEYS.has(key)) {
      throw new Error(`${configPath}: unsupported key "${key}"`);
    }
  }

  const model = data.model;
  if (model !== undefined && (typeof model !== "string" || model.trim().length === 0)) {
    throw new Error(`${configPath}: "model" must be a string`);
  }

  const config: ParsedAgentConfig = {};
  if (typeof model === "string") config.model = model.trim();

  const tools = parseTools(data.tools, configPath);
  if (tools !== undefined) config.tools = tools;

  const systemPrompt = body.trim();
  if (systemPrompt.length > 0) config.systemPrompt = systemPrompt;

  return config;
}

function loadAgent(agentArg: string, cwd: string): ResolvedAgent {
  const selection = resolveAgentSelection(agentArg, cwd);
  const config = parseAgentMarkdown(
    readFileSync(selection.configPath, "utf8"),
    selection.configPath,
  );
  return {
    name: selection.name,
    configPath: selection.configPath,
    source: selection.source,
    ...config,
  };
}

function findModel(ctx: ExtensionContext, modelSpec: string): PiModel | undefined {
  const slashIndex = modelSpec.indexOf("/");
  if (slashIndex <= 0 || slashIndex === modelSpec.length - 1) {
    throw new Error(`model must be provider/id: ${modelSpec}`);
  }

  return ctx.modelRegistry.find(
    modelSpec.slice(0, slashIndex),
    modelSpec.slice(slashIndex + 1),
  );
}

function setAgentStatus(
  ctx: ExtensionContext,
  text?: string,
  kind: "active" | "error" = "active",
): void {
  if (!ctx.hasUI) return;
  if (!text) {
    ctx.ui.setStatus("agent", undefined);
    return;
  }

  const value =
    kind === "error"
      ? ctx.ui.theme.fg("error", ctx.ui.theme.bold(text))
      : ctx.ui.theme.fg("accent", text);
  ctx.ui.setStatus("agent", value);
}

function notifyOrLog(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
    return;
  }
  if (level === "info") return;
  const output = level === "error" ? console.error : console.warn;
  output(message);
}

function applyAgentTools(pi: ExtensionAPI, ctx: ExtensionContext, agent: ResolvedAgent): boolean {
  if (!agent.tools) return true;
  const available = new Set(pi.getAllTools().map((tool) => tool.name));
  const unknown = agent.tools.filter((tool) => !available.has(tool));
  if (unknown.length > 0) {
    notifyOrLog(
      ctx,
      `Agent "${agent.name}": unknown tool(s): ${unknown.join(", ")}`,
      "error",
    );
    setAgentStatus(ctx, "agent:error", "error");
    return false;
  }
  pi.setActiveTools(agent.tools);
  return true;
}

export default function agentExtension(pi: ExtensionAPI) {
  let activeAgentArg: string | undefined;
  let activeAgentCwd: string | undefined;
  let activeAgent: ResolvedAgent | undefined;
  let loadError: string | undefined;

  function getSelectedAgentArg(): string | undefined {
    return getAgentArg(pi.getFlag(AGENT_FLAG));
  }

  function clearState(): void {
    activeAgentArg = undefined;
    activeAgentCwd = undefined;
    activeAgent = undefined;
    loadError = undefined;
  }

  function ensureAgentLoaded(cwd: string = process.cwd()): ResolvedAgent | undefined {
    const agentArg = getSelectedAgentArg();
    if (!agentArg) {
      clearState();
      return undefined;
    }

    if (activeAgent && activeAgentArg === agentArg && activeAgentCwd === cwd) {
      return activeAgent;
    }

    try {
      const agent = loadAgent(agentArg, cwd);
      activeAgentArg = agentArg;
      activeAgentCwd = cwd;
      activeAgent = agent;
      loadError = undefined;
      return agent;
    } catch (error) {
      activeAgentArg = agentArg;
      activeAgentCwd = cwd;
      activeAgent = undefined;
      loadError = error instanceof Error ? error.message : String(error);
      return undefined;
    }
  }

  pi.registerFlag(AGENT_FLAG, {
    description: "Load a named agent or Markdown agent file path",
    type: "string",
  });

  pi.on("session_start", async (_event, ctx) => {
    const agentArg = getSelectedAgentArg();
    if (!agentArg) {
      clearState();
      setAgentStatus(ctx, undefined);
      return;
    }

    const agent = ensureAgentLoaded(ctx.cwd);
    if (!agent) {
      const message = loadError ?? `Failed to load agent "${agentArg}"`;
      notifyOrLog(ctx, message, "error");
      setAgentStatus(ctx, "agent:error", "error");
      return;
    }

    if (agent.model) {
      let model: PiModel | undefined;
      try {
        model = findModel(ctx, agent.model);
      } catch (error) {
        loadError = `Agent "${agent.name}": ${error instanceof Error ? error.message : String(error)}`;
        notifyOrLog(ctx, loadError, "error");
        setAgentStatus(ctx, "agent:error", "error");
        return;
      }

      if (!model) {
        loadError = `Agent "${agent.name}": model not found: ${agent.model}`;
        notifyOrLog(ctx, loadError, "error");
        setAgentStatus(ctx, "agent:error", "error");
        return;
      }

      const setModelOk = await pi.setModel(model);
      if (!setModelOk) {
        loadError = `Agent "${agent.name}": no API key for ${agent.model}`;
        notifyOrLog(ctx, loadError, "error");
        setAgentStatus(ctx, "agent:error", "error");
        return;
      }
    }

    if (!applyAgentTools(pi, ctx, agent)) return;

    setAgentStatus(ctx, `${agent.name}:${agent.source}`);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    const agent = ensureAgentLoaded(ctx.cwd);
    if (!agent?.systemPrompt) return undefined;

    return { systemPrompt: agent.systemPrompt };
  });
}
