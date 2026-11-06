import { View, div } from "gpui-kit";
import { agents, appHome, exec, readTextFile, run, terminals } from "herdr";

const what = { blocked: "needs you", done: "finished" };
const PREVIEW_LENGTH = 200;

export function plain(text, max = PREVIEW_LENGTH) {
  const flat = (text ?? "").replace(/[`*#]+/g, "").replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim();
  const cut = flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, "")}…` : flat;
  return cut.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function topLevel() {
  const list = terminals();
  const children = new Set(list.filter((t) => t.parent).map((t) => t.address));
  const reports = new Map(list.map((t) => [t.address, t.report]));
  return agents()
    .filter((a) => !children.has(a.address))
    .map((a) => ({ ...a, report: reports.get(a.address) }));
}

export default class Notify extends View {
  init(_props, cx) {
    this.pending = new Map();
    this.runtime = exec("printenv", ["XDG_RUNTIME_DIR"]).then((r) => r.stdout.trim(), () => "");
    this.last = new Map(topLevel().map((a) => [a.address, a.status]));
    cx.timer.every(1000, () => {
      const list = topLevel();
      for (const a of list) {
        const was = this.last.get(a.address);
        if (was !== undefined && was !== a.status && what[a.status]) this.send(a);
      }
      this.last = new Map(list.map((a) => [a.address, a.status]));
    });
  }

  async preview(a) {
    const runtime = await this.runtime;
    if (a.status !== "done" || !runtime || !/^[\w-]+$/.test(a.address)) return "";
    return plain(await readTextFile(`${runtime}/herdr-pi/${a.address}`).catch(() => null));
  }

  async send(a) {
    const session = (a.status === "done" && a.report?.msg) || a.title.replace(/^π - /, "");
    const summary = `${session || a.program.name}${a.status === "blocked" ? " · needs you" : ""}`;
    const body = [await this.preview(a), plain(`${a.space_name} · ${a.tab_name}`)].filter(Boolean).join("\n");
    const icon = a.app === "pi"
      ? `${appHome()}/mods/sandbox-notify/pi.png`
      : a.program.icon ? `${appHome()}/${a.program.icon}` : "herdr-app";
    const args = ["-a", "Herdr", "-u", "normal", "-i", icon, "-A", "default=Open", "-h", `string:x-canonical-private-synchronous:herdr-${a.address}`];
    const token = {};
    this.pending.set(a.address, token);
    return exec("notify-send", [...args, "--", summary, body])
      .then((r) => {
        if (r.code) console.log(`sandbox-notify: notify-send exited ${r.code}: ${r.stderr.trim()}`);
        else if (r.stdout.trim() === "default" && this.pending.get(a.address) === token) return this.open(a.address);
      })
      .catch((e) => console.log(`sandbox-notify: ${e}`))
      .finally(() => this.pending.get(a.address) === token && this.pending.delete(a.address));
  }

  open(address) {
    if (!/^[\w./-]+$/.test(address) || !terminals().some((t) => t.address === address)) return;
    run("agent.focus", { terminal: address });
    return exec("sh", ["-c", "herdr-app status >/dev/null 2>&1 && exec herdr-app"])
      .catch((e) => console.log(`sandbox-notify: ${e}`));
  }

  render() {
    return div();
  }
}
