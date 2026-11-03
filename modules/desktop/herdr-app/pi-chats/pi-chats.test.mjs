// node --test: pi-chats against fixture session stores.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, lines, list, newChat, search } from "./pi-chats.mjs";

const CLI = fileURLToPath(new URL("./pi-chats.mjs", import.meta.url));

function store() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-chats-test-"));
  const home = path.join(root, "home");
  const agent = path.join(home, ".pi", "agent");
  const sessions = path.join(agent, "sessions");
  fs.mkdirSync(sessions, { recursive: true });
  const saved = { ...process.env };
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  delete process.env.PI_CODING_AGENT_SESSION_DIR;
  let tick = Date.parse("2026-01-01T00:00:00Z");
  const stamp = () => (tick += 1000);
  const message = (id, parentId, role, content, extra = {}) => {
    const t = stamp();
    return { type: "message", id, parentId, timestamp: new Date(t).toISOString(), message: { role, content, timestamp: t, ...extra } };
  };
  // Writes a session: a header unless header is false, then entries (strings are written raw).
  const add = (id, entries, { dir = path.join(sessions, "--p--"), cwd = path.join(root, "work"), header = true, tail = "\n" } = {}) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
    const lines = header ? [{ type: "session", version: 3, id, timestamp: new Date(stamp()).toISOString(), cwd }] : [];
    lines.push(...entries);
    const file = path.join(dir, id + ".jsonl");
    fs.writeFileSync(file, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + tail);
    return file;
  };
  const chat = (id, user, assistant, opts) =>
    add(id, [message(id + "1", null, "user", user), message(id + "2", id + "1", "assistant", [{ type: "text", text: assistant }])], opts);
  return {
    root, home, agent, sessions, add, chat, message,
    done() {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

const digest = (dir) => {
  const h = createHash("sha256");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else h.update(p).update(fs.readFileSync(p)).update(String(fs.statSync(p).mtimeMs));
  });
  walk(dir);
  return h.digest("hex");
};

test("list: every conversation across projects, newest activity first, read-only", async () => {
  const f = store();
  try {
    f.chat("old", "first question", "answer");
    f.chat("new", [{ type: "text", text: "  newer\n question " }], "answer", { dir: path.join(f.sessions, "--other--") });
    f.add("named", [f.message("n1", null, "user", "hi"), { type: "session_info", id: "n2", parentId: "n1", name: " Fix login " }]);
    f.add("cleared", [f.message("c1", null, "user", "hi"), { type: "session_info", id: "c2", parentId: "c1", name: "Old" }, { type: "session_info", id: "c3", parentId: "c2", name: "" }]);
    f.add("empty", []);
    f.add("headerless", [f.message("h1", null, "user", "no header")], { header: false });
    f.add("nested", [f.message("x1", null, "user", "subagent")], { dir: path.join(f.sessions, "--p--", "subagent-artifacts") });
    f.add("long", [f.message("l1", null, "user", "x".repeat(1000))]);
    f.add("broken", ["{not json", f.message("b1", null, "user", "still here"), '{"type":"message","id":"b2","parentId":"b1","message":{"role":"assistant","content":[{"type":"te'], { tail: "" });
    const before = digest(f.root);
    const out = await list();
    assert.equal(out.root, f.sessions);
    assert.deepEqual(out.sessions.map((s) => s.id), ["broken", "long", "cleared", "named", "new", "old"]);
    const by = Object.fromEntries(out.sessions.map((s) => [s.id, s]));
    assert.equal(by.named.name, "Fix login");
    assert.equal(by.cleared.name, null);
    assert.equal(by.new.first, "newer question");
    assert.equal(by.long.first.length, 241);
    assert.equal(by.broken.messages, 2, "an in-progress last line still counts");
    assert.equal(by.broken.first, "still here");
    assert.equal(by.old.cwd, path.join(f.root, "work"));
    assert.deepEqual([out.truncated, out.more, out.unreadable], [null, false, 0]);
    assert.equal(digest(f.root), before, "listing writes nothing");
  } finally { f.done(); }
});

test("session root: PI_CODING_AGENT_SESSION_DIR, then the sessionDir setting, then the agent folder", async () => {
  const f = store();
  try {
    f.chat("default", "a", "b");
    f.chat("custom", "a", "b", { dir: path.join(f.root, "custom") });
    f.chat("env", "a", "b", { dir: path.join(f.home, "fromenv") });
    f.chat("agentdir", "a", "b", { dir: path.join(f.root, "agent2", "sessions", "--x--") });
    assert.deepEqual((await list()).sessions.map((s) => s.id), ["default"]);
    fs.writeFileSync(path.join(f.agent, "settings.json"), JSON.stringify({ sessionDir: path.join(f.root, "custom") }));
    assert.deepEqual((await list()).sessions.map((s) => s.id), ["custom"]);
    process.env.PI_CODING_AGENT_SESSION_DIR = "~/fromenv";
    assert.deepEqual((await list()).sessions.map((s) => s.id), ["env"]);
    delete process.env.PI_CODING_AGENT_SESSION_DIR;
    process.env.PI_CODING_AGENT_DIR = path.join(f.root, "agent2");
    assert.deepEqual((await list()).sessions.map((s) => s.id), ["agentdir"]);
  } finally { f.done(); }
});

test("a missing root lists nothing; an unreadable one is an error, not an empty list", async (t) => {
  const f = store();
  try {
    fs.rmSync(f.sessions, { recursive: true });
    assert.deepEqual((await list()).sessions, []);
    if (process.getuid?.() === 0) return t.skip("root reads everything");
    fs.mkdirSync(f.sessions);
    fs.chmodSync(f.sessions, 0);
    await assert.rejects(list(), /Cannot read Pi sessions/);
    await assert.rejects(search("x"), /Cannot read Pi sessions/);
    fs.chmodSync(f.sessions, 0o700);
  } finally { f.done(); }
});

test("search: every word across title, folder and user/assistant text; never tool output, thinking or prompts", async () => {
  const f = store();
  try {
    const m = f.message;
    const a = f.add("a", [
      m("s", null, "system", "", { sections: { preamble: "secretprompt" } }),
      m("u", "s", "user", "Deploy the zebra service"),
      m("a1", "u", "assistant", [{ type: "thinking", thinking: "secretthought" }, { type: "toolCall", id: "c", name: "bash", arguments: { command: "secretargs" } }, { type: "text", text: "Done: zebra is live" }]),
      m("r", "a1", "toolResult", [{ type: "text", text: "secretoutput zebra" }], { toolCallId: "c", toolName: "bash" }),
      { type: "session_info", id: "i", parentId: "r", name: "Infra work" },
    ], { cwd: path.join(f.root, "projects", "farm") });
    f.chat("b", "Something about giraffes", "ok");
    f.add("bare", [], { cwd: path.join(f.root, "projects", "farm") });
    for (const q of ["secretprompt", "secretthought", "secretargs", "secretoutput", "  "]) assert.deepEqual((await search(q)).hits, [], q);
    assert.deepEqual((await search("ZEBRA live")).hits.map((h) => h.path), [a]);
    assert.deepEqual((await search("infra farm deploy")).hits.map((h) => h.path), [a], "name + folder + text");
    assert.deepEqual((await search("zebra giraffes")).hits, []);
    assert.deepEqual((await search("farm")).hits.map((h) => h.path), [a], "a session without messages is never a hit, as in list");
    const listed = (await list()).sessions.find((s) => s.path === a);
    const [hit] = (await search("deploy")).hits;
    assert.deepEqual([hit.name, hit.first, hit.messages, hit.snippet], ["Infra work", "Deploy the zebra service", 4, undefined]);
    assert.equal(hit.messages, listed.messages, "every message counted, even after the match");
  } finally { f.done(); }
});

test("search finds text Pi wrote with JSON unicode escapes", async () => {
  const f = store();
  try {
    const line = '{"type":"message","id":"u","parentId":null,"timestamp":"2026-01-01T00:00:05.000Z","message":{"role":"user","content":"Caf\\u00e9 cr\\u00e8me","timestamp":1}}';
    const file = f.add("esc", [line]);
    assert.deepEqual((await search("café")).hits.map((h) => h.path), [file]);
  } finally { f.done(); }
});

test("search is bounded: a result limit and a time budget report truncation", async () => {
  const f = store();
  try {
    for (let i = 0; i < 5; i++) f.chat("s" + i, "common word", "ok");
    const limited = await search("common", { limit: 2 });
    assert.deepEqual([limited.hits.length, limited.truncated], [2, "limit"]);
    await assert.rejects(search("common", { deadline: Date.now() - 1 }), (e) => e.code === "BUDGET");
    const full = await search("common");
    assert.deepEqual([full.hits.length, full.truncated, full.scanned], [5, null, 5]);
    const sized = await search("common", { max: 600 });
    assert.ok(sized.hits.length >= 1 && sized.hits.length < 5 && sized.truncated === "limit");
  } finally { f.done(); }
});

test("oversized lines are never buffered whole: skipped and reported, the next message still counts", async () => {
  const f = store();
  try {
    const m = f.message;
    const huge = "x".repeat(5 << 20);
    const file = f.add("big", [
      m("u1", null, "user", "small start"),
      m("a1", "u1", "assistant", [{ type: "text", text: huge + " needle" }]),
      m("r1", "a1", "toolResult", [{ type: "text", text: huge }], { toolCallId: "c" }),
      m("u2", "r1", "user", "after the giant"),
    ]);
    const seen = [];
    for await (const item of lines(file)) seen.push(typeof item === "string" ? item.length : { big: item.big.length });
    assert.deepEqual(seen.filter((x) => typeof x !== "number"), [{ big: 4096 }, { big: 4096 }]);
    const [s] = (await list()).sessions;
    assert.deepEqual([s.id, s.messages, s.first], ["big", 4, "small start"]);
    const found = await search("after giant");
    assert.deepEqual([found.hits.map((h) => h.path), found.skipped], [[file], 1], "the giant message was passed over, and said so");
    assert.deepEqual([found.hits[0].messages, found.hits[0].first], [4, "small start"], "the same total as list");
    const early = await search("small");
    assert.deepEqual([early.hits[0].messages, early.skipped], [4, 0], "past an early match, giants are counted, not searched");
    assert.deepEqual(s.preview, { note: "an entry is too large to check" }, "a giant line can't be checked: no preview, no guess");
    assert.deepEqual(found.hits[0].preview, s.preview);
    const needle = await search("needle");
    assert.deepEqual([needle.hits, needle.skipped], [[], 1]);
    await assert.rejects(async () => { for await (const _ of lines(file, Date.now() - 1)); }, (e) => e.code === "BUDGET");
  } finally { f.done(); }
});

test("list covers the COUNT newest files afresh: a file that moved ahead is never skipped", async () => {
  const f = store();
  try {
    const old = f.chat("old", "q", "a");
    f.chat("middle", "q", "a");
    f.chat("new", "q", "a");
    const later = new Date(Date.now() + 1000);
    fs.utimesSync(path.join(f.sessions, "--p--", "new.jsonl"), later, later);
    const first = await list({ count: 1 });
    assert.deepEqual([first.sessions.map((s) => s.id), first.more, first.total, first.truncated], [["new"], true, 3, null]);
    // An unseen session is written to before Load older: it is in the next, longer list.
    fs.appendFileSync(old, JSON.stringify(f.message("x", "old2", "user", "again")) + "\n");
    const muchLater = new Date(Date.now() + 5000);
    fs.utimesSync(old, muchLater, muchLater);
    const more = await list({ count: 2 });
    assert.deepEqual([more.sessions.map((s) => s.id).sort(), more.more], [["new", "old"], true]);
    const all = await list({ count: 3 });
    assert.deepEqual([all.sessions.length, all.more], [3, false]);
    const sized = await list({ max: 400 });
    assert.equal(sized.truncated, "size");
    await assert.rejects(list({ deadline: Date.now() - 1 }), (e) => e.code === "BUDGET");
    const now = Date.now;
    const deadline = now() + 60_000;
    let calls = 0;
    Date.now = () => (++calls > 4 ? deadline + 1 : now());
    const timed = await list({ deadline }).finally(() => { Date.now = now; });
    assert.deepEqual([timed.truncated, timed.more], ["time", true]);
  } finally { f.done(); }
});

test("scope: the folder and what's inside it, never siblings sharing a prefix; missing and odd folders too", async () => {
  const f = store();
  try {
    const root = path.join(f.root, "proj");
    const quoted = path.join(f.root, "it's \"q\" $(x)");
    f.chat("root", "in root", "a", { cwd: root });
    f.chat("child", "in child", "a", { cwd: path.join(root, "src", "deep") });
    f.chat("sibling", "in sibling", "a", { cwd: root + "-other" });
    f.chat("sibling2", "in sibling", "a", { cwd: root + "2" });
    const gone = f.chat("gone", "in gone", "a", { cwd: path.join(root, "removed") });
    fs.rmSync(path.join(root, "removed"), { recursive: true });
    f.chat("quoted", "in quoted", "a", { cwd: quoted });
    f.chat("tmp", "legacy", "a", { cwd: path.join(f.root, "tmp", "pi-session.x") });
    const ids = async (dir) => (await list({ dir })).sessions.map((s) => s.id).sort();
    assert.deepEqual(await ids(root), ["child", "gone", "root"]);
    assert.deepEqual(await ids(root + "/"), ["child", "gone", "root"]);
    assert.deepEqual(await ids(path.join(root, "src")), ["child"]);
    assert.deepEqual(await ids(quoted), ["quoted"]);
    assert.deepEqual(await ids(path.join(f.root, "nowhere")), []);
    const nocwd = f.chat("nocwd", "no folder", "a");
    fs.writeFileSync(nocwd, fs.readFileSync(nocwd, "utf8").replace(/,"cwd":"[^"]*"/, ""));
    assert.equal((await list({ dir: "/" })).sessions.some((s) => s.id === "nocwd"), false, "no folder: in no scope, even /");
    assert.ok((await list({ dir: "/" })).sessions.some((s) => s.id === "root"));
    assert.ok((await list()).sessions.some((s) => s.id === "nocwd"), "unscoped lists it");
    assert.equal((await list({ dir: root })).total, 3, "pages and counts only see the scope");
    assert.deepEqual((await search("in", { dir: root })).hits.map((h) => h.id).sort(), ["child", "gone", "root"]);
    assert.deepEqual((await search("sibling", { dir: root })).hits, []);
    assert.deepEqual((await search("in", { dir: root, limit: 1 })).hits.length, 1);
    assert.equal((await check(gone)).cwdExists, false);
    const env = { ...process.env, HOME: f.home };
    const cli = (...a) => JSON.parse(spawnSync(process.execPath, [CLI, ...a], { env, encoding: "utf8" }).stdout);
    assert.deepEqual(cli("list", "--in", quoted).sessions.map((s) => s.id), ["quoted"]);
    assert.deepEqual(cli("search", "--in", quoted, "quoted").hits.map((h) => h.id), ["quoted"]);
    assert.deepEqual(cli("list", "--in", root, "1").sessions.length, 1);
  } finally { f.done(); }
});

test("responses stay far below exec's 8 MiB: long names are clipped, identities never are", async () => {
  const f = store();
  try {
    const cwd = path.join(f.root, "a".repeat(200));
    for (let i = 0; i < 3; i++)
      f.add("n" + i, [f.message("u", null, "user", "named"), { type: "session_info", id: "i", parentId: "u", name: "N".repeat(3 << 20) }], { cwd });
    const out = await list();
    assert.equal(out.sessions.length, 3);
    assert.ok(out.sessions.every((s) => s.name.length === 201 && s.cwd === cwd && s.path.endsWith(s.id + ".jsonl")));
    assert.ok(Buffer.byteLength(JSON.stringify(out)) < 8 << 10);
    const found = await search("named nnnn");
    assert.deepEqual(found.hits.map((h) => [h.id, h.cwd, h.name.length]).sort(), [["n0", cwd, 201], ["n1", cwd, 201], ["n2", cwd, 201]]);
  } finally { f.done(); }
});

test("check: the exact file, its id, and whether its folder is still a folder", async () => {
  const f = store();
  try {
    const cwd = path.join(f.root, "gone");
    const file = f.chat("exact", "q", "a", { cwd });
    assert.deepEqual(await check(file), { id: "exact", cwd, cwdExists: true });
    fs.rmSync(cwd, { recursive: true });
    assert.equal((await check(file)).cwdExists, false);
    fs.writeFileSync(cwd, "now a file");
    assert.equal((await check(file)).cwdExists, false);
    const bad = path.join(f.root, "bad.jsonl");
    fs.writeFileSync(bad, '{"type":"session","cwd":"/"}\n');
    await assert.rejects(check(bad), /Not a Pi session file/);
    await assert.rejects(check(path.join(f.root, "missing.jsonl")));
  } finally { f.done(); }
});

test("new: a durable dated chat folder, unique each time", () => {
  const f = store();
  try {
    const now = new Date(2026, 10, 3, 9, 30);
    const a = newChat(now);
    const b = newChat(now);
    assert.equal(path.dirname(a), path.join(f.home, "Documents", "Pi", "Chats", "2026-11-03"));
    assert.match(path.basename(a), /^chat-[A-Za-z0-9]{6}$/);
    assert.notEqual(a, b);
    assert.ok(fs.statSync(a).isDirectory() && fs.statSync(b).isDirectory());
  } finally { f.done(); }
});

test("CLI: paths and queries are plain arguments, JSON out, errors on stderr", () => {
  const f = store();
  try {
    const dir = path.join(f.root, "it's $(odd) dir; |x|");
    const file = f.chat("cli", "find $(this) 'one'", "ok", { cwd: dir });
    const env = { ...process.env, HOME: f.home };
    const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8" });
    assert.equal(JSON.parse(run("check", file).stdout).cwd, dir);
    assert.deepEqual(JSON.parse(run("search", "$(this)").stdout).hits.map((h) => [h.path, h.messages]), [[file, 2]]);
    assert.equal(JSON.parse(run("list").stdout).sessions[0].path, file);
    const made = execFileSync(process.execPath, [CLI, "new"], { env, encoding: "utf8" }).trim();
    assert.ok(made.startsWith(path.join(f.home, "Documents", "Pi", "Chats") + path.sep));
    const missing = run("check", path.join(f.root, "nope.jsonl"));
    assert.deepEqual([missing.status, missing.stderr.trim()], [1, "Session file not found"]);
    assert.equal(run("check").status, 1);
    assert.match(run("show", file).stderr, /^usage: /, "no preview command remains");
  } finally { f.done(); }
});

const said = (p) => p.note ?? [p.opening.map((m) => m.role[0] + ":" + m.text), p.omitted, p.recent.map((m) => m.role[0] + ":" + m.text)];
const talks = (m, ids, up, text = (id) => id) => ids.map((id, i) => m(id, i ? ids[i - 1] : up, i % 2 ? "assistant" : "user", i % 2 ? [{ type: "text", text: text(id) }] : text(id)));

test("preview: the active branch's opening and latest user/assistant text, with times and how many between", async () => {
  const f = store();
  try {
    const m = f.message;
    const e = [
      m("u1", null, "user", "Deploy the zebra service"),
      m("a1", "u1", "assistant", [{ type: "thinking", thinking: "secretthought" }, { type: "toolCall", id: "c", name: "bash", arguments: { command: "secretargs" } }]),
      m("r1", "a1", "toolResult", [{ type: "text", text: "secretoutput" }], { toolCallId: "c" }),
      m("s1", "r1", "custom", "secretprompt"),
      m("a2", "s1", "assistant", [{ type: "thinking", thinking: "secretthought" }, { type: "text", text: "Zebra\nis   live" }]),
    ];
    let up = "a2";
    for (let i = 0; i < 8; i++) {
      e.push(m("q" + i, up, "user", "question " + i), m("w" + i, "q" + i, "assistant", [{ type: "text", text: "answer " + i + " " + "x".repeat(300) }]));
      up = "w" + i;
    }
    // q6..w7 were abandoned: Pi went back to w5 and went on from there, then named it.
    e.push(m("n1", "w5", "user", "new direction"), m("n2", "n1", "assistant", [{ type: "text", text: "on it" }]), { type: "session_info", id: "i", parentId: "n2", name: "Zebra" });
    const file = f.add("tree", e);
    const [s] = (await list()).sessions;
    assert.equal(s.messages, 23, "counts every message on every branch, as before");
    assert.deepEqual(said(s.preview), [["u:Deploy the zebra service", "a:Zebra is live"], 11, ["a:" + ("answer 5 " + "x".repeat(300)).slice(0, 120) + "…", "u:new direction", "a:on it"]]);
    const times = [...s.preview.opening, ...s.preview.recent].map((x) => x.time);
    assert.ok(times.every((t, i) => typeof t === "number" && (!i || t > times[i - 1])), "each excerpt has its time, in order");
    assert.ok(!JSON.stringify(s.preview).match(/secret|question 6|answer 7/), "no tool output, thinking, prompts or abandoned branch");
    const [hit] = (await search("zebra")).hits;
    assert.deepEqual([hit.path, hit.preview], [file, s.preview], "search hits carry the same preview");
  } finally { f.done(); }
});

test("preview: small talks once each; a rewritten first message; sessions from before the tree", async () => {
  const f = store();
  try {
    const m = f.message;
    f.chat("small", "hi", "hello");
    f.add("root", [m("u1", null, "user", "first try"), m("a1", "u1", "assistant", [{ type: "text", text: "meh" }]),
      m("u2", null, "user", "second try"), m("a2", "u2", "assistant", [{ type: "text", text: "better" }])]);
    const old = [];
    for (let i = 0; i < 3; i++) for (const role of ["user", "assistant"]) {
      const { id, parentId, ...rest } = m("x", null, role, role === "user" ? "ask " + i : [{ type: "text", text: "tell " + i }]);
      old.push(rest);
    }
    const linear = f.add("linear", old);
    fs.writeFileSync(linear, fs.readFileSync(linear, "utf8").replace('"version":3', '"version":1'));
    const by = Object.fromEntries((await list()).sessions.map((s) => [s.id, said(s.preview)]));
    assert.deepEqual(by.small, [["u:hi", "a:hello"], 0, []]);
    assert.deepEqual(by.root, [["u:second try", "a:better"], 0, []]);
    assert.deepEqual(by.linear, [["u:ask 0", "a:tell 0"], 1, ["a:tell 1", "u:ask 2", "a:tell 2"]]);
  } finally { f.done(); }
});

test("preview: the active branch's ends even when other branches fill what one pass keeps", async () => {
  const f = store();
  try {
    const m = f.message;
    const ids = (p, n) => Array.from({ length: n }, (_, i) => p + i);
    // A, then 25 messages on an abandoned B, then Pi back on A (session_info is the leaf).
    f.add("short", [...talks(m, ids("a", 4), null), ...talks(m, ids("b", 25), "a1"), { type: "session_info", id: "i", parentId: "a3", name: "A" }]);
    f.add("long", [...talks(m, ids("a", 20), null), ...talks(m, ids("b", 25), "a4"), { type: "label", id: "l", parentId: "a19", targetId: "a2", label: "x" }]);
    f.add("reroot", [...talks(m, ids("o", 14), null), ...talks(m, ids("r", 6), null)]);
    f.add("rerootlate", [...talks(m, ids("o", 30), null), ...talks(m, ids("r", 4), null), ...talks(m, ids("z", 14), "o9")]);
    const out = await list();
    const by = Object.fromEntries(out.sessions.map((s) => [s.id, said(s.preview)]));
    assert.deepEqual(by.short, [["u:a0", "a:a1"], 0, ["u:a2", "a:a3"]]);
    assert.deepEqual(by.long, [["u:a0", "a:a1"], 15, ["a:a17", "u:a18", "a:a19"]], "read again for ends the first pass didn't keep");
    assert.deepEqual(by.reroot, [["u:r0", "a:r1"], 1, ["a:r3", "u:r4", "a:r5"]]);
    assert.deepEqual(by.rerootlate, [["u:o0", "a:o1"], 19, ["a:z11", "u:z12", "a:z13"]]);
    const query = { short: "a3", long: "a19", reroot: "r5", rerootlate: "z13" };
    for (const s of out.sessions) assert.deepEqual((await search(query[s.id])).hits.find((h) => h.id === s.id)?.preview, s.preview, s.id);
  } finally { f.done(); }
});

test("preview: every line is checked as Pi reads it; what can't be checked or placed stops it", async () => {
  const f = store();
  try {
    const m = f.message;
    const start = [m("u", null, "user", "start"), m("a", "u", "assistant", [{ type: "text", text: "actual latest" }])];
    f.add("twobad", [...start, '{"type":"custom","id":"bad1","parentId":"u",', '{"type":"custom","id":"bad2","parentId":"bad1",']);
    f.add("midbad", [m("u", null, "user", "start"), '{"type":"custom","id":"bad","parentId":"u",', m("a", "bad", "assistant", [{ type: "text", text: "orphan" }])]);
    f.add("half", [...start, m("u2", "a", "user", "three"), '{"type":"message","id":"a2","parentId":"u2","timestamp":"2026-01-01T00:01:00.000Z","message":{"role":"assistant","content":[{"type":"text","text":"half wri'], { tail: "" });
    f.add("nonewline", [...start, m("u2", "a", "user", "complete")], { tail: "" });
    const giant = "x".repeat(5 << 20);
    f.add("bigend", [...start, '{"type":"custom","payload":"' + giant + '","id":"c","parentId":null}']);
    f.add("bigmid", [...start, '{"type":"custom","data":"' + giant + '","id":"c","parentId":"u"}', m("u3", "c", "user", "after")]);
    f.add("bigcut", [...start, '{"type":"message","id":"a2","parentId":"a","timestamp":"2026-01-01T00:01:00.000Z","message":{"role":"assistant","content":[{"type":"text","text":"' + giant + '"}]}}'], { tail: "" });
    f.add("noid", [...start, '{"type":"custom","parentId":"a"}']);
    f.add("longid", [...start, m("i".repeat(129), "a", "user", "long id")]);
    const by = Object.fromEntries((await list()).sessions.map((s) => [s.id, s]));
    assert.deepEqual(said(by.twobad.preview), [["u:start", "a:actual latest"], 0, []], "Pi skips both broken lines");
    assert.deepEqual(said(by.midbad.preview), [["a:orphan"], 0, []], "a skipped entry breaks the chain as in Pi");
    assert.deepEqual(said(by.half.preview), [["u:start", "a:actual latest"], 0, ["u:three"]]);
    assert.deepEqual(said(by.nonewline.preview), [["u:start", "a:actual latest"], 0, ["u:complete"]]);
    for (const id of ["bigend", "bigmid", "bigcut"]) assert.equal(by[id].preview.note, "an entry is too large to check", id);
    assert.equal(by.noid.preview.note, "an entry has no place in the conversation");
    assert.equal(by.longid.preview.note, "an entry id is too long");
    assert.deepEqual([by.half.messages, by.bigcut.messages, by.bigmid.first, by.bigmid.messages], [4, 3, "start", 3], "counts and titles as before");
  } finally { f.done(); }
});

test("preview bounds: clipped excerpts, counted in the response limit; giant sessions say so", async () => {
  const f = store();
  try {
    const m = f.message;
    const e = [];
    for (let i = 0; i < 6; i++) e.push(m("u" + i, i ? "a" + (i - 1) : null, "user", "q".repeat(10000)), m("a" + i, "u" + i, "assistant", [{ type: "text", text: "a".repeat(10000) }]));
    f.add("long1", e);
    f.add("long2", e);
    const out = await list();
    for (const s of out.sessions) {
      assert.deepEqual([s.preview.opening.length, s.preview.recent.length, s.preview.omitted], [2, 3, 7]);
      assert.ok([...s.preview.opening, ...s.preview.recent].every((x) => x.text.length === 121));
      assert.ok(Buffer.byteLength(JSON.stringify(s)) < 1500);
    }
    const one = Buffer.byteLength(JSON.stringify(out.sessions[0])) + 1;
    const sized = await list({ max: one + 10 });
    assert.deepEqual([sized.sessions.length, sized.truncated], [1, "size"]);
    const hits = await search("qqqq", { max: one + 10 });
    assert.deepEqual([hits.hits.length, hits.truncated], [1, "limit"]);
    const lines = [JSON.stringify({ type: "session", version: 3, id: "huge", timestamp: "2026-01-01T00:00:00.000Z", cwd: f.root }), JSON.stringify(m("u", null, "user", "hello"))];
    for (let i = 0; i < 100000; i++) lines.push('{"type":"custom","id":"c' + i + '","parentId":"' + (i ? "c" + (i - 1) : "u") + '"}');
    fs.writeFileSync(path.join(f.sessions, "--p--", "huge.jsonl"), lines.join("\n") + "\n");
    const huge = (await list()).sessions.find((s) => s.id === "huge");
    assert.deepEqual([huge.messages, huge.first, huge.preview], [1, "hello", { note: "too long to preview" }]);
  } finally { f.done(); }
});
