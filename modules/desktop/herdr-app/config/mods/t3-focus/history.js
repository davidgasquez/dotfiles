import { exec } from "herdr";

// Use the Node runtime already in Pi's Nix closure when it isn't on PATH (e.g. tau).
export const NODE_RUNTIME = `
set -eu
node=$(command -v node || true)
if [ -z "$node" ]; then
  pi=$(command -v pi)
  root=$(dirname "$(dirname "$(readlink -f "$pi")")")
  for store in $(nix-store --query --requisites "$root"); do
    if [ -x "$store/bin/node" ]; then node="$store/bin/node"; break; fi
  done
fi
[ -n "$node" ] || { echo "Pi's Node runtime is unavailable" >&2; exit 1; }
exec "$node" --input-type=module -e "$1" "$2"
`;

export const SESSION_SCRIPT = String.raw`
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const pi = realpathSync(execFileSync("sh", ["-c", "command -v pi"], { encoding: "utf8" }).trim());
const sdk = [
  join(dirname(pi), "core/session-manager.js"),
  join(dirname(dirname(pi)), "lib/pi/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js"),
].find(existsSync);
if (!sdk) throw new Error("Cannot locate the installed Pi session API");
const { SessionManager } = await import(pathToFileURL(sdk).href);
const { getSessionsDir } = await import(new URL("../config.js", pathToFileURL(sdk)).href);
const request = JSON.parse(process.argv[1]);
const present = (s) => ({
  path: s.path, id: s.id, cwd: s.cwd, directory: dirname(s.path),
  title: (s.name || s.firstMessage || "Pi conversation").replace(/\s+/g, " ").slice(0, 120),
  modified: s.modified.getTime(),
});
if (request.path) {
  const file = resolve(request.path);
  await stat(file);
  const session = (await SessionManager.listAll(dirname(file))).find((s) => s.path === file && (!request.id || s.id === request.id));
  if (!session || !session.cwd || !session.messageCount) throw new Error("This conversation has no saved, resumable Pi session");
  if (!(await stat(session.cwd)).isDirectory()) throw new Error("The original project folder is unavailable");
  console.log(JSON.stringify(present(session)));
} else {
  const sessions = await SessionManager.listAll();
  const root = resolve(getSessionsDir());
  for (const directory of new Set((request.directories || []).map((d) => resolve(d)))) {
    // listAll() already reads the default root's project folders, but not deeper custom folders.
    if (dirname(directory) !== root) sessions.push(...await SessionManager.listAll(directory));
  }
  const unique = new Map(sessions.filter((s) => s.cwd && s.messageCount > 0).map((s) => [s.path, s]));
  console.log(JSON.stringify([...unique.values()].map(present).sort((a, b) => b.modified - a.modified)));
}
`;

export const sessionKey = (session) => JSON.stringify([session.machine ?? null, session.path]);
export const machineOf = (address) => address.includes("/") ? address.split("/")[0] : null;

export function sessionOf(terminal) {
  // Launch arguments become stale after /new, /resume or /fork; only trust the running Pi.
  const labels = terminal?.labels ?? {};
  const file = labels["pi.session-file"];
  return { path: typeof file === "string" && file.startsWith("/") ? file : null, id: labels["pi.session-id"] || null };
}

export function sessionLink(session) {
  if (!session?.path?.startsWith("/")) return null;
  const encode = (part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `file://${session.machine ? encode(session.machine) : ""}${session.path.split("/").map(encode).join("/")}`;
}

export function conversationReference(session) {
  return [
    `Conversation: ${(session.title || "Pi conversation").replace(/\s+/g, " ")}`,
    sessionLink(session) && `Session link: ${sessionLink(session)}`,
    session.id && `Session ID: ${session.id}`,
    `Machine: ${session.machine ?? "Local"}`,
    session.cwd && `Project: ${session.cwd}`,
    session.address && `Live terminal: ${session.address}`,
  ].filter(Boolean).join("\n");
}

export async function readSessions(machine, request = {}) {
  const result = await exec("sh", ["-c", NODE_RUNTIME, "pi-history", SESSION_SCRIPT, JSON.stringify(request)], { on: machine });
  if (result.code !== 0) throw new Error(result.stderr.trim() || "Cannot read Pi history");
  return JSON.parse(result.stdout);
}
