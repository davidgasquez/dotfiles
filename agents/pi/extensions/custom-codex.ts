import {
  SettingsManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  clampThinkingLevel,
  streamOpenAICodexResponses,
} from "@earendil-works/pi-ai/compat";

const SETTINGS_KEY = "pi-custom-codex";
const PROVIDER = "openai-codex";
const API = "openai-codex-responses";
const DEFAULT_CONFIG = {
  fast: true,
  verbosity: "low",
} as const;
type Verbosity = "low" | "medium" | "high";
type Config = {
  fast: boolean;
  verbosity: Verbosity;
};

type InternalSettingsManager = SettingsManager & {
  globalSettings: Record<string, unknown>;
  markModified(field: string, nestedKey?: string): void;
  save(): void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeVerbosity(value: unknown): Verbosity | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return undefined;
}

function mergeSettings(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key];
    if (isObject(baseValue) && isObject(overrideValue)) {
      merged[key] = mergeSettings(baseValue, overrideValue);
      continue;
    }
    merged[key] = overrideValue;
  }

  return merged;
}

function parseConfig(settingsManager: SettingsManager): Config {
  const settings = mergeSettings(
    settingsManager.getGlobalSettings() as Record<string, unknown>,
    settingsManager.getProjectSettings() as Record<string, unknown>,
  );
  const raw = isObject(settings[SETTINGS_KEY]) ? settings[SETTINGS_KEY] : {};

  return {
    fast: typeof raw.fast === "boolean" ? raw.fast : DEFAULT_CONFIG.fast,
    verbosity: normalizeVerbosity(raw.verbosity) ?? DEFAULT_CONFIG.verbosity,
  };
}

async function loadConfig(
  cwd: string,
): Promise<{ config: Config; settingsManager: SettingsManager }> {
  const settingsManager = SettingsManager.create(cwd);
  await settingsManager.reload();
  return {
    config: parseConfig(settingsManager),
    settingsManager,
  };
}

async function saveConfig(
  cwd: string,
  config: Config,
): Promise<SettingsManager> {
  const settingsManager = SettingsManager.create(
    cwd,
  ) as InternalSettingsManager;
  await settingsManager.reload();
  settingsManager.globalSettings[SETTINGS_KEY] = {
    fast: config.fast,
    verbosity: config.verbosity,
  };
  settingsManager.markModified(SETTINGS_KEY);
  settingsManager.save();
  await settingsManager.flush();
  return settingsManager;
}

function notify(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (!ctx.hasUI) return;
  ctx.ui.notify(message, level);
}

function reportSettingsErrors(
  settingsManager: SettingsManager,
  ctx: ExtensionContext,
  action: "load" | "write",
): void {
  for (const { scope, error } of settingsManager.drainErrors()) {
    notify(
      ctx,
      `custom-codex: failed to ${action} ${scope} settings: ${error.message}`,
      "warning",
    );
  }
}

function formatConfig(config: Config): string {
  return `custom-codex fast=${config.fast ? "on" : "off"} verbosity=${config.verbosity}`;
}

export default function customCodexExtension(pi: ExtensionAPI): void {
  let activeConfig: Config = { ...DEFAULT_CONFIG };
  let settingsWriteQueue: Promise<void> = Promise.resolve();

  async function reloadConfig(ctx: ExtensionContext): Promise<void> {
    await settingsWriteQueue.catch(() => undefined);

    try {
      const { config, settingsManager } = await loadConfig(ctx.cwd);
      reportSettingsErrors(settingsManager, ctx, "load");
      activeConfig = config;
    } catch (error) {
      activeConfig = { ...DEFAULT_CONFIG };
      const message = error instanceof Error ? error.message : String(error);
      notify(
        ctx,
        `custom-codex: failed to load settings: ${message}`,
        "warning",
      );
    }
  }

  async function persistConfig(
    config: Config,
    ctx: ExtensionContext,
  ): Promise<void> {
    activeConfig = config;

    settingsWriteQueue = settingsWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const settingsManager = await saveConfig(ctx.cwd, config);
        reportSettingsErrors(settingsManager, ctx, "write");
      });

    try {
      await settingsWriteQueue;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(
        ctx,
        `custom-codex: failed to write settings: ${message}`,
        "warning",
      );
    }
  }

  pi.registerCommand("custom-codex", {
    description: "Show custom-codex settings",
    handler: async (_args, ctx) => {
      notify(ctx, formatConfig(activeConfig));
    },
  });

  pi.registerCommand("custom-codex-fast", {
    description: "Set custom-codex fast mode: on | off | toggle",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "toggle";
      if (!["on", "off", "toggle"].includes(action)) {
        notify(ctx, "Usage: /custom-codex-fast [on|off|toggle]", "warning");
        return;
      }

      const fast = action === "toggle" ? !activeConfig.fast : action === "on";
      await persistConfig({ ...activeConfig, fast }, ctx);
      notify(ctx, formatConfig({ ...activeConfig, fast }));
    },
  });

  pi.registerCommand("custom-codex-verbosity", {
    description: "Set custom-codex verbosity: low | medium | high",
    handler: async (args, ctx) => {
      const verbosity = normalizeVerbosity(args.trim().toLowerCase());
      if (!verbosity) {
        notify(
          ctx,
          "Usage: /custom-codex-verbosity <low|medium|high>",
          "warning",
        );
        return;
      }

      await persistConfig({ ...activeConfig, verbosity }, ctx);
      notify(ctx, formatConfig({ ...activeConfig, verbosity }));
    },
  });

  pi.registerProvider(PROVIDER, {
    api: API,
    streamSimple(model, context, options) {
      const reasoning = options?.reasoning
        ? clampThinkingLevel(model, options.reasoning)
        : undefined;

      return streamOpenAICodexResponses(model, context, {
        ...options,
        reasoningEffort: reasoning === "off" ? undefined : reasoning,
        serviceTier: activeConfig.fast ? "priority" : undefined,
        textVerbosity: activeConfig.verbosity,
      });
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await reloadConfig(ctx);
  });
}
