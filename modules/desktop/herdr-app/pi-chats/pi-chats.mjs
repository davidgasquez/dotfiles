// Bounded, read-only access to Pi's own session files for Herdr's History, and
// durable folders for standalone chats.
//   pi-chats new            create ~/Documents/Pi/Chats/YYYY-MM-DD/chat-XXXXXX, print it
//   pi-chats list [--in DIR] [COUNT]   conversations in the COUNT most recently written files
//     (each with a hover preview: the active branch's opening and latest user/assistant text)
//   pi-chats search [--in DIR] QUERY   sessions whose title, folder or user/assistant text has every word
//   (--in DIR: only sessions whose folder is DIR or inside it)
//   pi-chats check FILE     whether FILE is still that session and its folder exists
// Every command stops within WORK_MS and answers in under RESPONSE_BYTES (Herdr's exec
// allows 30 s and 8 MiB), saying where it stopped.

import { closeSync, createReadStream, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORK_MS = 20_000;
const RESPONSE_BYTES = 6 << 20;
const PAGE = 500;
const SEARCH_LIMIT = 300;
const FIRST_CHARS = 240;
const NAME_CHARS = 200;
// Lines above LINE_LIMIT characters aren't buffered: only their first PREFIX characters
// (type, ids, role) are kept, and they're skipped (and counted) rather than parsed.
const LINE_LIMIT = 4 << 20;
const PREFIX = 4096;
const HEADER_BYTES = 1 << 20;
// Previews: the active branch's first OPENING and last RECENT user/assistant texts, EXCERPT_CHARS
// each. A pass keeps entry ids (at most MAX_ENTRIES, META_BYTES, ID_CHARS each) and the KEEP
// first and last excerpts; only when those miss the branch's ends is the file read again.
const OPENING = 2;
const RECENT = 3;
const EXCERPT_CHARS = 120;
const KEEP = 12;
const MAX_ENTRIES = 100_000;
const META_BYTES = 4 << 20;
const ID_CHARS = 128;

const due = () => Date.now() + WORK_MS;
const budget = () => Object.assign(new Error("Pi's sessions took too long to read"), { code: "BUDGET" });
const home = () => process.env.HOME || homedir();
const expand = (p) => (p === "~" ? home() : p.startsWith("~/") ? join(home(), p.slice(2)) : resolve(home(), p));
const bytes = (v) => Buffer.byteLength(JSON.stringify(v)) + 1;

// Pi's order: PI_CODING_AGENT_SESSION_DIR, then the global sessionDir setting (both flat
// folders of sessions), else its agent folder's sessions/<project>/.
export function sessionRoot() {
  const env = process.env.PI_CODING_AGENT_SESSION_DIR;
  if (env) return { dir: expand(env), flat: true };
  const agent = process.env.PI_CODING_AGENT_DIR ? expand(process.env.PI_CODING_AGENT_DIR) : join(home(), ".pi", "agent");
  try {
    const { sessionDir } = JSON.parse(readFileSync(join(agent, "settings.json"), "utf8"));
    if (typeof sessionDir === "string" && sessionDir.trim()) return { dir: expand(sessionDir.trim()), flat: true };
  } catch {}
  return { dir: join(agent, "sessions"), flat: false };
}

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// A missing root is no chats yet; an unreadable one is an error, not an empty list.
function entries(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw new Error("Cannot read Pi sessions in " + dir + ": " + (e.code ?? e.message));
  }
}

const jsonl = (dir) => entries(dir).filter((e) => e.name.endsWith(".jsonl")).map((e) => join(dir, e.name));

// Whether a session's (absolute) folder is DIR or inside it: a path boundary, not a string
// prefix. DIR "/" takes every absolute folder; a session without one is never in a scope.
export function inScope(cwd, dir) {
  if (!cwd.startsWith("/")) return false;
  const d = dir.replace(/\/+$/, "");
  return !d || cwd === d || cwd.startsWith(d + "/");
}

// The header line alone, read in small pieces like Pi's own discovery; null if it isn't one.
function readHeader(path) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    let n = 0;
    for (let got; n < buf.length && (got = readSync(fd, buf, n, Math.min(65536, buf.length - n), null)) > 0;) {
      const nl = buf.indexOf(10, n);
      n += got;
      if (nl >= 0 && nl < n) return header(buf.toString("utf8", 0, nl));
    }
    return n < buf.length ? header(buf.toString("utf8", 0, n)) : null;
  } finally {
    closeSync(fd);
  }
}

// Session files, most recently written first; with `dir`, only sessions whose folder is in it.
// `unreadable` counts project folders and files skipped.
export function sessionFiles(deadline = due(), root = sessionRoot(), dir = null) {
  let files = [];
  let unreadable = 0;
  if (root.flat) files = jsonl(root.dir);
  else {
    for (const e of entries(root.dir)) {
      if (Date.now() > deadline) throw budget();
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      try {
        files.push(...jsonl(join(root.dir, e.name)));
      } catch {
        unreadable++;
      }
    }
  }
  const found = [];
  for (const [i, path] of files.entries()) {
    if ((dir || i % 256 === 0) && Date.now() > deadline) throw budget();
    try {
      const s = statSync(path);
      if (!s.isFile()) continue;
      if (dir) {
        const h = readHeader(path);
        if (!h || !inScope(typeof h.cwd === "string" ? h.cwd : "", dir)) continue;
      }
      found.push({ path, mtime: s.mtimeMs });
    } catch {
      unreadable++;
    }
  }
  found.sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
  return Object.assign(found, { unreadable });
}

// Yields each line as a string, or { big: prefix } for one over LINE_LIMIT. Past the deadline
// it throws a "BUDGET" error, even in the middle of a line.
export async function* lines(path, deadline = Infinity) {
  let rest = "";
  let big = null;
  for await (const chunk of createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 })) {
    if (Date.now() > deadline) throw budget();
    for (let from = 0; ;) {
      const nl = chunk.indexOf("\n", from);
      const piece = chunk.slice(from, nl < 0 ? undefined : nl);
      if (big === null && rest.length + piece.length > LINE_LIMIT) {
        big = (rest + piece.slice(0, PREFIX)).slice(0, PREFIX);
        rest = "";
      }
      if (big === null) rest += piece;
      if (nl < 0) break;
      if (big !== null) yield { big };
      else yield rest;
      rest = "";
      big = null;
      from = nl + 1;
    }
  }
  if (big !== null) yield { big };
  else if (rest) yield rest;
}

const unpack = (item) => (typeof item === "string" ? [item, false] : [item.big, true]);

const parse = (line) => {
  try {
    const v = JSON.parse(line);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

const header = (line) => {
  const h = parse(line);
  return h?.type === "session" && typeof h.id === "string" ? h : null;
};

// A message line's role without parsing it: Pi writes `"message":{"role":"…"` near the start.
// Lines laid out otherwise are parsed.
function roleOf(line) {
  const i = line.indexOf('"message":{"role":"');
  if (i < 0 || i > 400) return parse(line)?.message?.role;
  const from = i + 19;
  return line.slice(from, line.indexOf('"', from));
}

export function textOf(message) {
  const c = message?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join(" ");
}

const isTalk = (role) => role === "user" || role === "assistant";
const clip = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);
const flat = (s) => s.replace(/\s+/g, " ").trim();
const nameOf = (e) => (typeof e.name === "string" ? clip(flat(e.name), NAME_CHARS) || null : null);
const timeOf = (e) => (typeof e.message?.timestamp === "number" ? e.message.timestamp : Date.parse(e.timestamp) || null);

// A copy that doesn't keep the (possibly huge) line it was cut from alive.
const own = (s) => Buffer.from(s, "utf8").toString("utf8");

// A message's user/assistant text as a short excerpt; tool output, thinking and prompts never.
function quote(e) {
  const role = e?.type === "message" ? e.message?.role : null;
  if (!isTalk(role)) return null;
  const text = clip(flat(textOf(e.message).slice(0, EXCERPT_CHARS * 8)), EXCERPT_CHARS);
  return text ? { role, time: timeOf(e), text: own(text) } : null;
}

// The active branch as Pi resumes it: lines that don't parse are skipped, the last entry that
// does is the leaf and its parentId chain is the branch; sessions from before the tree (version
// < 2) chain in order, as Pi's migration does. An entry that can't be checked or placed (over
// LINE_LIMIT, no id, too many) stops the preview with a note rather than a guess.
function branch(version) {
  const linear = !(version >= 2);
  const parent = new Map();
  const talky = new Set();
  const head = [];
  const tail = [];
  let size = 0;
  let last = null;
  let at = null;
  let why = null;
  return {
    // The parsed entry (null if Pi would skip it), or undefined once the preview has stopped.
    entry(item) {
      at = null;
      if (why) return undefined;
      const [line, big] = unpack(item);
      if (big) { why = "an entry is too large to check"; return undefined; }
      let e;
      try { e = JSON.parse(line); } catch { return null; }
      const id = linear ? "#" + parent.size : e?.id;
      const up = linear ? last : e?.parentId ?? null;
      if (!e || typeof e !== "object" || typeof id !== "string" || (up !== null && typeof up !== "string")) why = "an entry has no place in the conversation";
      else if (id.length > ID_CHARS || up?.length > ID_CHARS) why = "an entry id is too long";
      else if (parent.size >= MAX_ENTRIES || (size += id.length + (up?.length ?? 0)) > META_BYTES) why = "too long to preview";
      else parent.set(at = last = own(id), up === null ? null : own(up));
      return e && typeof e === "object" ? e : null;
    },
    // The entry just placed, if it's a message with user/assistant text.
    talk(e) {
      const q = at === null ? null : quote(e);
      if (!q) return;
      talky.add(at);
      const c = { id: at, ...q };
      if (head.length < KEEP) head.push(c);
      else if (tail.push(c) > KEEP) tail.shift();
    },
    async done(path, deadline) {
      if (why) return { note: why };
      const on = new Set();
      for (let id = last; id !== null && parent.has(id) && !on.has(id); id = parent.get(id)) on.add(id);
      let talk = 0;
      for (const id of on) if (talky.has(id)) talk++;
      if (!talk) return { note: "no user or assistant text" };
      const early = head.filter((c) => on.has(c.id));
      const late = tail.filter((c) => on.has(c.id));
      let mine = [...early, ...late];
      if (mine.length < talk && (early.length < OPENING || late.length < RECENT)) {
        try {
          mine = await reread(path, deadline, linear, on);
        } catch (e) {
          return { note: e.code === "BUDGET" ? "ran out of time" : "the file changed while reading" };
        }
      }
      const text = ({ role, time, text }) => ({ role, time, text });
      const opening = mine.slice(0, OPENING).map(text);
      const recent = mine.slice(OPENING).slice(-RECENT).map(text);
      return { opening, recent, omitted: Math.max(0, talk - opening.length - recent.length) };
    },
  };
}

// The branch's first OPENING and last RECENT excerpts, read again when the first pass's kept
// ones missed them, placing entries exactly as branch() does.
async function reread(path, deadline, linear, on) {
  const first = [];
  const ring = [];
  let header = true;
  let n = 0;
  for await (const item of lines(path, deadline)) {
    const [line, big] = unpack(item);
    if (!line.trim()) continue;
    if (header) { header = false; continue; }
    if (big) throw new Error("changed");
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!on.has(linear ? "#" + n++ : e?.id)) continue;
    const q = quote(e);
    if (!q) continue;
    if (first.length < OPENING) first.push(q);
    else if (ring.push(q) > RECENT) ring.shift();
  }
  return [...first, ...ring];
}

// What /resume shows of a session: null when the file isn't one (no header first).
export async function summarize(path, deadline = due()) {
  let head = null;
  let name = null;
  let count = 0;
  let first = "";
  let last = 0;
  let trail = null;
  for await (const item of lines(path, deadline)) {
    const [line, big] = unpack(item);
    if (!line.trim()) continue;
    if (!head) {
      head = header(line);
      if (!head) return null;
      trail = branch(head.version);
      continue;
    }
    const got = trail.entry(item);
    const read = () => (got === undefined ? parse(line) : got);
    if (line.includes('"session_info"')) {
      const e = read();
      if (e?.type === "session_info") {
        name = nameOf(e);
        continue;
      }
    }
    if (!line.includes('"message"')) continue;
    const role = roleOf(line);
    if (role === undefined) continue;
    count++;
    if (!isTalk(role) || big) continue;
    const e = read();
    if (e?.type !== "message") continue;
    trail.talk(e);
    const t = timeOf(e);
    if (t > last) last = t;
    if (!first && role === "user") first = clip(flat(textOf(e.message)), FIRST_CHARS);
  }
  if (!head) return null;
  const created = Date.parse(head.timestamp);
  return {
    path,
    id: head.id,
    cwd: typeof head.cwd === "string" ? head.cwd : "",
    name,
    first,
    created: Number.isNaN(created) ? null : created,
    modified: last || (Number.isNaN(created) ? 0 : created),
    messages: count,
    preview: await trail.done(path, deadline),
  };
}

// Conversations in the `count` most recently written session files (in `dir`), read afresh
// each time so a longer list never misses files that changed meanwhile. `more`: older files
// remain; `truncated`: the list stopped early ("time" or "size").
export async function list({ count = PAGE, dir = null, deadline = due(), max = RESPONSE_BYTES } = {}) {
  const root = sessionRoot();
  const files = sessionFiles(deadline, root, dir);
  const sessions = [];
  let unreadable = files.unreadable;
  let size = 0;
  let cut = null;
  let i = 0;
  for (; i < files.length && i < count; i++) {
    let s;
    try {
      if (Date.now() > deadline) throw budget();
      s = await summarize(files[i].path, deadline);
    } catch (e) {
      if (e.code !== "BUDGET") { unreadable++; continue; }
      cut = "time";
      break;
    }
    if (!s?.messages) continue;
    s.modified ||= files[i].mtime;
    if (size + bytes(s) > max) { cut = "size"; break; }
    size += bytes(s);
    sessions.push(s);
  }
  sessions.sort((a, b) => b.modified - a.modified || b.path.localeCompare(a.path));
  return { root: root.dir, sessions, more: i < files.length, total: files.length, truncated: cut, unreadable };
}

export const words = (query) => [...new Set(String(query).toLowerCase().split(/\s+/).filter(Boolean))];

// Every word must appear in the session's name, folder or user/assistant text (not tool
// output, thinking or prompts). Newest files first, so a cut-off search keeps recent ones.
// Each hit carries enough to show and resume it without the list: id, cwd, name, first user
// text, file time, its whole message count as the list counts them and the same preview (the
// rest of a matched file is still read for them).
export async function search(query, { dir = null, limit = SEARCH_LIMIT, deadline = due(), max = RESPONSE_BYTES } = {}) {
  const want = words(query);
  const files = sessionFiles(deadline, sessionRoot(), dir);
  const hits = [];
  let scanned = 0;
  let skipped = 0;
  let size = 0;
  let unreadable = files.unreadable;
  let cut = null;
  if (!want.length) return { hits, scanned, total: files.length, truncated: null, skipped, unreadable };
  const raw = want.every((w) => !/["\\]/.test(w));
  for (const f of files) {
    if (hits.length >= limit) { cut = "limit"; break; }
    if (Date.now() > deadline) { cut = "time"; break; }
    const found = new Set();
    let head = null;
    let name = null;
    let first = "";
    let messages = 0;
    let trail = null;
    const see = (text) => {
      const lower = text.toLowerCase();
      for (const w of want) if (lower.includes(w)) found.add(w);
    };
    try {
      for await (const item of lines(f.path, deadline)) {
        const [line, big] = unpack(item);
        if (!line.trim()) continue;
        if (!head) {
          head = header(line);
          if (!head) break;
          if (typeof head.cwd === "string") see(head.cwd);
          trail = branch(head.version);
          continue;
        }
        const got = trail.entry(item);
        if (line.includes('"session_info"')) {
          const e = got === undefined ? parse(line) : got;
          if (e?.type === "session_info") {
            name = nameOf(e);
            if (typeof e.name === "string") see(e.name);
            continue;
          }
        }
        if (!line.includes('"message"')) continue;
        const role = roleOf(line);
        if (role === undefined) continue;
        messages++;
        if (isTalk(role) && got) trail.talk(got);
        const looking = found.size < want.length;
        const opening = !first && role === "user";
        if (!isTalk(role) || (!looking && !opening)) continue;
        if (big) { if (looking) skipped++; continue; }
        if (!opening && raw && !line.includes("\\u")) {
          const lower = line.toLowerCase();
          if (!want.some((w) => !found.has(w) && lower.includes(w))) continue;
        }
        const e = got === undefined ? parse(line) : got;
        if (e?.type !== "message" || !isTalk(e.message?.role)) continue;
        if (opening) first = clip(flat(textOf(e.message)), FIRST_CHARS);
        if (looking) see(textOf(e.message));
      }
    } catch (e) {
      if (e.code !== "BUDGET") { unreadable++; continue; }
      cut = "time";
      break;
    }
    scanned++;
    if (!head || !messages || found.size < want.length) continue;
    const hit = { path: f.path, id: head.id, cwd: typeof head.cwd === "string" ? head.cwd : "", name, first, modified: f.mtime, messages, preview: await trail.done(f.path, deadline) };
    if (size + bytes(hit) > max) { cut = "limit"; break; }
    size += bytes(hit);
    hits.push(hit);
  }
  return { hits, scanned, total: files.length, truncated: cut, skipped, unreadable };
}

export async function check(path) {
  for await (const item of lines(path, due())) {
    const [line] = unpack(item);
    if (!line.trim()) continue;
    const h = header(line);
    if (!h) break;
    const cwd = typeof h.cwd === "string" ? h.cwd : "";
    return { id: h.id, cwd, cwdExists: Boolean(cwd) && isDir(cwd) };
  }
  throw new Error("Not a Pi session file");
}

export function newChat(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = join(home(), "Documents", "Pi", "Chats", now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()));
  mkdirSync(day, { recursive: true });
  return mkdtempSync(join(day, "chat-"));
}

async function main([command, ...args]) {
  if (command === "new") return void console.log(newChat());
  const dir = args[0] === "--in" && args.length > 1 ? args.splice(0, 2)[1] : null;
  const [arg] = args;
  const count = Number(arg ?? PAGE);
  const out = command === "list" && Number.isInteger(count) && count > 0 ? await list({ count, dir })
    : command === "search" ? await search(arg ?? "", { dir })
    : command === "check" && arg ? await check(arg)
    : null;
  if (!out) throw new Error("usage: pi-chats new | list [--in DIR] [COUNT] | search [--in DIR] QUERY | check FILE");
  process.stdout.write(JSON.stringify(out));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(String(e?.code === "ENOENT" ? "Session file not found" : e?.message ?? e) + "\n");
    process.exit(1);
  });
}
