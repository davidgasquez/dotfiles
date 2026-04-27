import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const APP_NAME = "Pi";
const BODY = "Ready for input";
const ICON = join(tmpdir(), "pi-notify-icon.svg");

writeFileSync(
  ICON,
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#8CAAEE"/><text x="64" y="84" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="72" fill="#303446">π</text></svg>`,
  "utf8",
);

type HyprWindow = {
  address?: string;
  mapped?: boolean;
  hidden?: boolean;
  title?: string;
  workspace?: { id?: number };
};

type HyprMonitor = {
  activeWorkspace?: { id?: number };
};

type TargetWindow = {
  address: string;
  workspace: number;
};

function hyprJson<T>(command: string): T | undefined {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) return undefined;

  try {
    const output = execFileSync("hyprctl", ["-j", command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    });
    return JSON.parse(output) as T;
  } catch {
    return undefined;
  }
}

function isThisSessionWindow(
  window: HyprWindow,
  title: string,
  cwd: string,
): boolean {
  const windowTitle = window.title ?? "";
  if (!windowTitle.startsWith("π - ")) return false;
  if (title !== APP_NAME && windowTitle.includes(title)) return true;
  return windowTitle.includes(basename(cwd));
}

function findSessionWindow(
  ctx: ExtensionContext,
  title: string,
): TargetWindow | undefined {
  const clients = hyprJson<HyprWindow[]>("clients") ?? [];
  const window = clients.find(
    (client) =>
      client.mapped !== false &&
      client.hidden !== true &&
      typeof client.address === "string" &&
      typeof client.workspace?.id === "number" &&
      isThisSessionWindow(client, title, ctx.cwd),
  );

  if (!window?.address || typeof window.workspace?.id !== "number")
    return undefined;
  return { address: window.address, workspace: window.workspace.id };
}

function isVisible(target: TargetWindow): boolean {
  const active = hyprJson<HyprWindow>("activewindow");
  if (active?.address === target.address) return true;

  const monitors = hyprJson<HyprMonitor[]>("monitors") ?? [];
  return monitors.some(
    (monitor) => monitor.activeWorkspace?.id === target.workspace,
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function notify(title: string, target?: TargetWindow): void {
  const args = ["--app-name", APP_NAME, "--icon", ICON];

  if (target) {
    args.push("--action", "default=Open");
  }

  args.push(title, BODY);

  const command = target
    ? `if [ "$(notify-send ${args.map(shellQuote).join(" ")})" = default ]; then hyprctl dispatch workspace ${target.workspace}; hyprctl dispatch focuswindow address:${target.address}; fi`
    : `notify-send ${args.map(shellQuote).join(" ")}`;

  const child = spawn("bash", ["-lc", command], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => undefined);
  child.unref();
}

export default function notifyExtension(pi: ExtensionAPI): void {
  pi.on("agent_end", async (_event, ctx) => {
    const title = pi.getSessionName() ?? APP_NAME;
    const target = findSessionWindow(ctx, title);

    if (!ctx.hasUI || ctx.hasPendingMessages() || (target && isVisible(target)))
      return;
    notify(title, target);
  });
}
