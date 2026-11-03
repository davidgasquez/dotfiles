// Pi's saved sessions, read through Pi's own public SDK (SessionManager.listAll, as /resume's "All").
// Nothing is indexed or cached here; every read asks the Pi installed on that machine.
import { exec } from "herdr";

// Finds the Pi package that `pi` runs (an npm install, else its Nix closure) and runs SCRIPT with
// Node (PATH's, else the one in Pi's closure). Passed inline, so other machines need nothing installed.
export const LOCATE = String.raw`set -eu
pi=$(command -v pi) || { echo "Pi is not installed on this machine" >&2; exit 127; }
real=$(readlink -f "$pi")
pkg=
node=$(command -v node || true)
dir=$(dirname "$real")
while [ "$dir" != / ]; do
  if [ -f "$dir/package.json" ] && grep -q '"name": *"@earendil-works/pi-coding-agent"' "$dir/package.json"; then pkg=$dir; break; fi
  dir=$(dirname "$dir")
done
if [ -z "$pkg" ] || [ -z "$node" ]; then
  if command -v nix-store >/dev/null; then
    for p in $(nix-store --query --requisites "$real"); do
      c=$p/lib/pi/node_modules/@earendil-works/pi-coding-agent
      if [ -z "$pkg" ] && [ -f "$c/package.json" ]; then pkg=$c; fi
      if [ -z "$node" ] && [ -x "$p/bin/node" ]; then node=$p/bin/node; fi
    done
  fi
fi
[ -n "$pkg" ] || { echo "Cannot find Pi's package for $real" >&2; exit 1; }
[ -n "$node" ] || { echo "Cannot find a Node runtime for Pi" >&2; exit 1; }
exec "$node" --input-type=module -e "$1" "$pkg" "$2"
`;

// {} lists; {path, id, cwd} checks that exact saved session still exists, reading headers only.
export const SCRIPT = String.raw`
const [pkg, raw] = process.argv.slice(1);
try {
  const { readFileSync, existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { dirname, join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const meta = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  const sdk = await import(pathToFileURL(join(pkg, meta.exports?.["."]?.import ?? meta.main)).href);
  const { SessionManager, SettingsManager, getAgentDir } = sdk;
  const request = JSON.parse(raw);
  if (request.path) {
    const found = request.cwd ? SessionManager.findById(request.cwd, request.id, dirname(request.path)) : existsSync(request.path) && request.path;
    if (found !== request.path) throw new Error("This saved Pi session is gone or changed. Refresh History.");
    console.log(JSON.stringify({ cwdExists: Boolean(request.cwd) && existsSync(request.cwd) }));
  } else {
    // Pi's own order: PI_CODING_AGENT_SESSION_DIR, else the global sessionDir setting, else its default root.
    const env = process.env.PI_CODING_AGENT_SESSION_DIR;
    const dir = env ? env.replace(/^~(?=$|\/)/, homedir()) : SettingsManager.create(homedir(), getAgentDir(), { projectTrusted: false }).getSessionDir();
    const sessions = await SessionManager.listAll(dir);
    console.log(JSON.stringify(sessions.filter((s) => s.messageCount > 0).map((s) => ({
      path: s.path, id: s.id, cwd: s.cwd, name: s.name ?? null, firstMessage: s.firstMessage.slice(0, 300),
      modified: s.modified.getTime(), messageCount: s.messageCount,
    }))));
  }
} catch (e) {
  process.stderr.write(String(e?.message ?? e));
  process.exit(1);
}
`;

export async function readSessions(machine, request = {}) {
  const r = await exec("sh", ["-c", LOCATE, "pi-history", SCRIPT, JSON.stringify(request)], { on: machine });
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Pi history exited with " + r.code);
  return JSON.parse(r.stdout);
}

export const title = (s) => s.name || s.firstMessage.split("\n")[0].trim() || "(no text)";

export function matches(sessions, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return sessions.filter((s) => {
    const text = [title(s), s.firstMessage, s.cwd, s.id, s.machine ?? "Local"].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// One command that resumes it with Pi itself: a tab in a space already at its folder on its machine, else a new
// space there. A folder that's gone starts in home, where Pi asks where to continue.
export function resumePlan(s, cwdExists, sp, ps) {
  const argv = ["pi", "--session", s.path], machine = s.machine ?? null, on = machine ? { machine } : {};
  if (!cwdExists) return ["space.new", { ...on, argv }];
  const space = sp.find((x) => (x.machine ?? null) === machine
    && (x.folder === s.cwd || ps.some((p) => p.cwd === s.cwd && x.tabs.some((t) => t.id === p.tab))));
  return space ? ["tab.new", { space: space.id, folder: s.cwd, argv }] : ["space.new", { ...on, folder: s.cwd, argv }];
}
