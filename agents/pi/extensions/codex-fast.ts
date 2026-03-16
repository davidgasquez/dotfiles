import type { AssistantMessage } from "@mariozechner/pi-ai";
import {
  SettingsManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

const SETTINGS_KEY = "pi-codex-fast";
const PROFILE_FLAG = "profile";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type InternalSettingsManager = SettingsManager & {
  globalSettings: Record<string, unknown>;
  markModified(field: string, nestedKey?: string): void;
  save(): void;
};

const settingsManagers = new Map<string, SettingsManager>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function supportsPriorityServiceTier(ctx: ExtensionContext): boolean {
  return (
    ctx.model?.provider === "openai" || ctx.model?.provider === "openai-codex"
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getSettingsManager(cwd: string): SettingsManager {
  const existing = settingsManagers.get(cwd);
  if (existing) return existing;

  const settingsManager = SettingsManager.create(cwd);
  settingsManagers.set(cwd, settingsManager);
  return settingsManager;
}

function mergeSettings(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key];
    if (isRecord(baseValue) && isRecord(overrideValue)) {
      merged[key] = mergeSettings(baseValue, overrideValue);
      continue;
    }
    merged[key] = overrideValue;
  }
  return merged;
}

function getEffectiveSettings(
  settingsManager: SettingsManager,
): Record<string, unknown> {
  return mergeSettings(
    settingsManager.getGlobalSettings() as Record<string, unknown>,
    settingsManager.getProjectSettings() as Record<string, unknown>,
  );
}

function loadPersistedFastMode(cwd: string): boolean | undefined {
  const settingsManager = getSettingsManager(cwd);
  settingsManager.reload();
  const settings = getEffectiveSettings(settingsManager);
  const extensionSettings = asObject(settings[SETTINGS_KEY]);
  return typeof extensionSettings?.enabled === "boolean"
    ? extensionSettings.enabled
    : undefined;
}

function persistFastMode(enabled: boolean, cwd: string): SettingsManager {
  const settingsManager = getSettingsManager(cwd) as InternalSettingsManager;
  settingsManager.reload();
  const globalSettings = settingsManager.getGlobalSettings() as Record<
    string,
    unknown
  >;
  const extensionSettings = asObject(globalSettings[SETTINGS_KEY]) ?? {};
  settingsManager.globalSettings[SETTINGS_KEY] = {
    ...extensionSettings,
    enabled,
  };
  settingsManager.markModified(SETTINGS_KEY);
  settingsManager.save();
  return settingsManager;
}

function reportSettingsErrors(
  settingsManager: SettingsManager,
  ctx: ExtensionContext,
  action: "load" | "write",
): void {
  if (!ctx.hasUI) return;
  for (const { scope, error } of settingsManager.drainErrors()) {
    ctx.ui.notify(
      `pi-codex-fast: failed to ${action} ${scope} settings: ${error.message}`,
      "warning",
    );
  }
}

function normalizeProfileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return undefined;
  return trimmed.replace(/\.(yaml|yml)$/i, "");
}

function formatThousands(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
}

function buildFooterLeft(ctx: ExtensionContext): string {
  let cost = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const message = entry.message as AssistantMessage;
    cost += message.usage.cost.total;
  }

  const usage = ctx.getContextUsage();
  const contextWindow = ctx.model?.contextWindow;
  const usageText =
    contextWindow && contextWindow > 0
      ? `${((((usage?.tokens ?? 0) as number) / contextWindow) * 100).toFixed(1)}%/${formatThousands(contextWindow)}`
      : "0.0%/0";

  return `$${cost.toFixed(3)} (sub) ${usageText} (auto)`;
}

function buildFooterRight(
  ctx: ExtensionContext,
  theme: ExtensionContext["ui"]["theme"],
  thinking: ThinkingLevel,
  fastModeEnabled: boolean,
  profileName?: string,
  statuses: readonly string[] = [],
): string {
  const provider = ctx.model?.provider ?? "no-provider";
  const modelId = ctx.model?.id ?? "no-model";

  let text = theme.fg("dim", `(${provider}) ${modelId} • ${thinking}`);
  if (fastModeEnabled) {
    text += theme.fg("accent", " · ⚡");
  }
  if (statuses.length > 0) {
    text += theme.fg("dim", " · ") + statuses.join(theme.fg("dim", " · "));
  }
  if (profileName) {
    text += theme.fg("dim", "  •  ") + theme.fg("warning", theme.bold(profileName));
  }

  return text;
}

export default function codexFastExtension(pi: ExtensionAPI): void {
  let fastModeEnabled = false;
  let settingsWriteQueue: Promise<void> = Promise.resolve();
  let footerRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  function getSelectedProfileName(): string | undefined {
    return normalizeProfileName(pi.getFlag(PROFILE_FLAG));
  }

  function applyFooter(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width: number): string[] {
          const left = theme.fg("dim", buildFooterLeft(ctx));
          const statuses = Array.from(footerData.getExtensionStatuses().entries())
            .filter(([key, value]) => key !== "profile" && value.length > 0)
            .map(([, value]) => value);
          const right = buildFooterRight(
            ctx,
            theme,
            pi.getThinkingLevel(),
            fastModeEnabled,
            getSelectedProfileName(),
            statuses,
          );
          const gap = " ".repeat(
            Math.max(1, width - visibleWidth(left) - visibleWidth(right)),
          );
          return [truncateToWidth(left + gap + right, width)];
        },
      };
    });
  }

  function refreshFooter(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (footerRefreshTimer) clearTimeout(footerRefreshTimer);
    footerRefreshTimer = setTimeout(() => {
      footerRefreshTimer = undefined;
      applyFooter(ctx);
    }, 0);
  }

  function persistState(enabled: boolean, ctx: ExtensionContext): void {
    const cwd = ctx.cwd;
    settingsWriteQueue = settingsWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const settingsManager = persistFastMode(enabled, cwd);
        await settingsManager.flush();
        reportSettingsErrors(settingsManager, ctx, "write");
      });

    void settingsWriteQueue.catch((error) => {
      if (!ctx.hasUI) return;
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(
        `pi-codex-fast: failed to write settings: ${message}`,
        "warning",
      );
    });
  }

  function notifyState(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (!fastModeEnabled) {
      ctx.ui.notify(
        "Fast mode disabled. OpenAI/OpenAI Codex requests will use the default service tier.",
        "info",
      );
      return;
    }

    if (supportsPriorityServiceTier(ctx)) {
      ctx.ui.notify(
        "Fast mode enabled. OpenAI/OpenAI Codex requests will send service_tier=priority.",
        "info",
      );
      return;
    }

    const modelLabel = ctx.model
      ? `${ctx.model.provider}/${ctx.model.id}`
      : "no active model";
    ctx.ui.notify(
      `Fast mode enabled. It will apply once you switch to an OpenAI or OpenAI Codex model (current: ${modelLabel}).`,
      "info",
    );
  }

  function setFastMode(
    enabled: boolean,
    ctx: ExtensionContext,
    options?: { persist?: boolean; notify?: boolean },
  ): void {
    fastModeEnabled = enabled;
    if (options?.persist !== false) persistState(enabled, ctx);
    refreshFooter(ctx);
    if (options?.notify !== false) notifyState(ctx);
  }

  async function reloadFastModeState(
    ctx: ExtensionContext,
    options?: { includeStartupFlag?: boolean },
  ): Promise<void> {
    await settingsWriteQueue.catch(() => undefined);
    fastModeEnabled = false;

    try {
      const settingsManager = getSettingsManager(ctx.cwd);
      const persistedEnabled = loadPersistedFastMode(ctx.cwd);
      reportSettingsErrors(settingsManager, ctx, "load");
      if (typeof persistedEnabled === "boolean") {
        fastModeEnabled = persistedEnabled;
      }
    } catch (error) {
      if (ctx.hasUI) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `pi-codex-fast: failed to load settings: ${message}`,
          "warning",
        );
      }
    }

    if (options?.includeStartupFlag && pi.getFlag("fast") === true) {
      fastModeEnabled = true;
    }

    refreshFooter(ctx);
  }

  pi.registerFlag("fast", {
    description:
      "Start with fast mode enabled (adds service_tier=priority to OpenAI/OpenAI Codex requests)",
    type: "boolean",
    default: false,
  });

  pi.registerCommand("codex-fast", {
    description: "Toggle OpenAI/OpenAI Codex priority service tier",
    handler: async (_args, ctx) => {
      setFastMode(!fastModeEnabled, ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await reloadFastModeState(ctx, { includeStartupFlag: true });
  });

  pi.on("session_switch", async (_event, ctx) => {
    await reloadFastModeState(ctx, { includeStartupFlag: true });
  });

  pi.on("model_select", async (_event, ctx) => {
    refreshFooter(ctx);
  });

  pi.on("session_shutdown", async () => {
    if (footerRefreshTimer) clearTimeout(footerRefreshTimer);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (
      !fastModeEnabled ||
      !supportsPriorityServiceTier(ctx) ||
      !isRecord(event.payload)
    ) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(event.payload, "service_tier")) {
      return;
    }

    return {
      ...event.payload,
      service_tier: "priority",
    };
  });
}
