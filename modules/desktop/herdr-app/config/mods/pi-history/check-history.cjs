// node --test check-history.cjs: the SDK helper against real Pi and fixture stores, then the dialog with stubs.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync, spawnSync } = require("node:child_process");
const { test } = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");
const sessionsSource = read("sessions.js"), mainSource = read("main.js");
const plain = (v) => JSON.parse(JSON.stringify(v));
// sessions.js's helper strings, without the module's herdr import.
const { LOCATE, SCRIPT } = vm.runInNewContext(sessionsSource.split("export async function readSessions")[0]
  .replace(/^import .*;\r?\n/gm, "").replace(/export const /g, "const ") + "\n({ LOCATE, SCRIPT })");
const SH = fs.existsSync("/bin/sh") ? "/bin/sh" : execFileSync("sh", ["-c", "command -v sh"], { encoding: "utf8" }).trim();

function locate(script, request, env) {
  return spawnSync(SH, ["-c", LOCATE, "pi-history", script, JSON.stringify(request)], { env, encoding: "utf8" });
}
const printPackage = "console.log(process.argv[1])";
const PKG = locate(printPackage, {}, process.env).stdout.trim();

// A bin folder holding only the tools LOCATE needs, so tests control what PATH offers.
function tools(root, extra = {}) {
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin, { recursive: true });
  for (const tool of ["readlink", "dirname", "grep"]) {
    const found = execFileSync(SH, ["-c", "command -v " + tool], { encoding: "utf8" }).trim();
    fs.symlinkSync(found, path.join(bin, tool));
  }
  for (const [name, target] of Object.entries(extra)) fs.symlinkSync(target, path.join(bin, name));
  return bin;
}

function store() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-history-check-"));
  const home = path.join(root, "home"), agent = path.join(root, "agent");
  fs.mkdirSync(home);
  let tick = Date.parse("2026-01-01T00:00:00Z");
  const add = (dir, id, { cwd = path.join(root, "project"), name, cleared, messages = 1, text = "Saved " + id, header = true } = {}) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
    const stamp = () => new Date(tick += 1000).toISOString();
    const lines = header ? [{ type: "session", version: 3, id, timestamp: stamp(), cwd }] : [];
    let parent = null;
    for (let i = 0; i < messages; i++) {
      const at = stamp();
      lines.push({ type: "message", id: id + i, parentId: parent, timestamp: at,
        message: { role: "user", content: [{ type: "text", text: i ? "more" : text }], timestamp: Date.parse(at) } });
      parent = id + i;
    }
    if (name) lines.push({ type: "session_info", id: id + "n", parentId: parent, timestamp: stamp(), name });
    if (cleared) lines.push({ type: "session_info", id: id + "c", parentId: id + "n", timestamp: stamp(), name: "" });
    const file = path.join(dir, id + ".jsonl");
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    return file;
  };
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agent };
  delete env.PI_CODING_AGENT_SESSION_DIR;
  const run = (request, extra = {}) => {
    const r = locate(SCRIPT, request, { ...env, ...extra });
    return { code: r.status, out: r.status === 0 ? JSON.parse(r.stdout) : null, err: r.stderr };
  };
  return { root, home, agent, sessions: path.join(agent, "sessions"), add, run, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("the locator finds the installed Pi package through Pi's public package.json", () => {
  assert.ok(PKG, "locator printed a package");
  assert.equal(JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8")).name, "@earendil-works/pi-coding-agent");
});

test("npm-style installs resolve by walking up from the pi symlink, without nix-store", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-history-npm-"));
  try {
    const bin = tools(root, { pi: path.join(PKG, "dist/cli.js"), node: process.execPath });
    const r = locate(printPackage, {}, { PATH: bin });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), fs.realpathSync(PKG));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Nix installs find Pi's package and Node in the closure when node is not on PATH", (t) => {
  const real = execFileSync(SH, ["-c", "readlink -f \"$(command -v pi)\""], { encoding: "utf8" }).trim();
  let nixStore = "";
  try { nixStore = execFileSync(SH, ["-c", "command -v nix-store"], { encoding: "utf8" }).trim(); } catch {}
  if (!nixStore || real.startsWith(fs.realpathSync(PKG))) return t.skip("pi is not a Nix wrapper here");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-history-nix-"));
  try {
    const bin = tools(root, { pi: real, "nix-store": nixStore });
    const r = locate("console.log(process.argv[1], process.execPath)", {}, { PATH: bin });
    assert.equal(r.status, 0, r.stderr);
    const [pkg, node] = r.stdout.trim().split(" ");
    assert.equal(pkg, PKG);
    assert.match(node, /^\/nix\/store\/.*\/bin\/node$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a machine without pi says so", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-history-none-"));
  try {
    const r = locate(printPackage, {}, { PATH: tools(root) });
    assert.equal(r.status, 127);
    assert.match(r.stderr, /Pi is not installed on this machine/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("listing matches Pi's All scope: project folders only, saved names, no empty sessions, read-only", () => {
  const f = store();
  try {
    const a = path.join(f.sessions, "--a--"), b = path.join(f.sessions, "--b--");
    f.add(a, "plain");
    f.add(a, "named", { name: "Fix login" });
    f.add(b, "cleared", { name: "Old name", cleared: true, text: "First line\nsecond line" });
    f.add(b, "long", { text: "x".repeat(1000) });
    f.add(b, "empty", { messages: 0 });
    f.add(path.join(b, "subagent-artifacts"), "child");
    f.add(a, "headerless", { header: false });
    const hash = () => execFileSync(SH, ["-c", "find . -type f | sort | xargs sha256sum"], { cwd: f.root, encoding: "utf8" });
    const before = hash();
    const { code, out, err } = f.run({});
    assert.equal(code, 0, err);
    assert.deepEqual(out.map((s) => s.id).sort(), ["cleared", "long", "named", "plain"]);
    const by = Object.fromEntries(out.map((s) => [s.id, s]));
    assert.equal(by.named.name, "Fix login");
    assert.equal(by.cleared.name, null);
    assert.equal(by.cleared.firstMessage, "First line\nsecond line");
    assert.equal(by.long.firstMessage.length, 300);
    assert.equal(by.plain.cwd, path.join(f.root, "project"));
    assert.deepEqual(Object.keys(by.plain).sort(), ["cwd", "firstMessage", "id", "messageCount", "modified", "name", "path"]);
    assert.ok(out.every((s, i) => i === 0 || out[i - 1].modified >= s.modified), "newest first");
    assert.equal(f.run({ path: by.plain.path, id: "plain", cwd: by.plain.cwd }).code, 0);
    assert.equal(hash(), before, "listing and checking write nothing");
  } finally { f.done(); }
});

test("Pi's session folder settings decide where History looks", () => {
  const f = store();
  try {
    f.add(path.join(f.sessions, "--a--"), "default");
    f.add(path.join(f.root, "custom"), "custom");
    f.add(path.join(f.home, "fromenv"), "env");
    fs.mkdirSync(f.agent, { recursive: true });
    fs.writeFileSync(path.join(f.agent, "settings.json"), JSON.stringify({ sessionDir: path.join(f.root, "custom") }));
    assert.deepEqual(f.run({}).out.map((s) => s.id), ["custom"]);
    assert.deepEqual(f.run({}, { PI_CODING_AGENT_SESSION_DIR: "~/fromenv" }).out.map((s) => s.id), ["env"]);
  } finally { f.done(); }
});

test("the resume check accepts only that exact saved session and reports a missing folder", () => {
  const f = store();
  try {
    const cwd = path.join(f.root, "gone");
    const file = f.add(path.join(f.sessions, "--gone--"), "exact", { cwd });
    assert.deepEqual(f.run({ path: file, id: "exact", cwd }).out, { cwdExists: true });
    const wrong = f.run({ path: file, id: "other", cwd });
    assert.equal(wrong.code, 1);
    assert.equal(wrong.err, "This saved Pi session is gone or changed. Refresh History.");
    fs.rmSync(cwd, { recursive: true });
    assert.deepEqual(f.run({ path: file, id: "exact", cwd }).out, { cwdExists: false });
    fs.rmSync(file);
    assert.equal(f.run({ path: file, id: "exact", cwd }).code, 1);
  } finally { f.done(); }
});

// The dialog, with gpui and herdr stubbed. Like the app, handlers throw inside a virtual list's item renderer.
let inItemRenderer = false;
function element(kind) {
  const node = { kind, key: null, items: [], handlers: {}, style: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (key === "child") node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.key = args[0];
      else if (key.startsWith("on_")) {
        if (inItemRenderer) throw new Error("`" + key + "` cannot be registered from a virtual list's item renderer");
        node.handlers[key] = args[0];
      }
      else node.style[key] = args;
      return proxy;
    };
  } });
  return proxy;
}
const find = (node, id) => !node || typeof node !== "object" ? null : node.key === id ? node
  : node.items.reduce((hit, child) => hit ?? find(child, id), null);
const texts = (node) => typeof node === "string" ? [node] : node && typeof node === "object" ? node.items.flatMap(texts) : [];
const rowKeys = (node, out = []) => {
  if (node && typeof node === "object") { if (node.key?.startsWith("row-")) out.push(node.key.slice(4)); else node.items.forEach((c) => rowKeys(c, out)); }
  return out;
};

function dialog({ machines = [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }, { name: "vps", layout: "unavailable" }], spaces = [], panes = [] } = {}) {
  const f = { execs: [], pending: [], runs: [], overlays: [], closed: [], notes: [], query: "", inputs: {}, machines, spaces, panes };
  // Spawned tasks run at once; tests settle them by answering their exec and letting the event loop turn.
  const cx = { notify() {}, stop_propagation() {}, focus_handle: () => ({ focus() {} }), spawn: (fn) => { fn(cx); } };
  const env = {
    View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
    Input: { new: element }, Scrollbar: { vertical: element },
    VirtualListScrollHandle: { new: () => ({ scroll_to_item(i) { f.scrolled = i; } }) },
    v_virtual_list: (id, n, size, key, render) => {
      const el = element("list"); el.key = id;
      inItemRenderer = true;
      try { render({ start: 0, end: n }).forEach((r) => el.child(r)); } finally { inItemRenderer = false; }
      f.keys = Array.from({ length: n }, (_, i) => key(i));
      return el;
    },
    InputState: { new: () => ({ on: (e, fn) => { f.inputs[e] = fn; }, value: () => f.query, focus() {} }) },
    machines: () => f.machines, spaces: () => f.spaces, panes: () => f.panes,
    run: (...a) => f.runs.push(a), theme: () => ({}), props: () => ({ overlay: "o1" }),
    closeOverlay: (id) => f.closed.push(id), openOverlay: (spec) => f.overlays.push(spec), notify: (n) => f.notes.push(n),
    exec: (cmd, args, options) => new Promise((resolve) => {
      f.execs.push({ cmd, args, on: options.on, request: JSON.parse(args[4]) });
      f.pending.push({ on: options.on, request: JSON.parse(args[4]), resolve });
    }),
  };
  const src = sessionsSource + "\n" + mainSource;
  const code = src.replace(/^import .*;\r?\n/gm, "").replace(/^export (async function|function|const) /gm, "$1 ")
    .replace("export default class", "globalThis.Mod = class");
  const context = vm.createContext(env);
  vm.runInContext(code, context, { filename: "pi-history" });
  f.mod = new context.Mod();
  f.mod.init({}, cx);
  f.cx = cx;
  f.render = () => (f.tree = f.mod.render(cx));
  const settle = () => new Promise((r) => setImmediate(r));
  // Answers the oldest (or newest) pending exec for that machine, then lets the task that awaited it finish.
  f.answer = async (on, value, code = 0, newest = false) => {
    const i = newest ? f.pending.findLastIndex((p) => p.on === on) : f.pending.findIndex((p) => p.on === on);
    assert.ok(i >= 0, "no pending exec on " + on);
    const [p] = f.pending.splice(i, 1);
    p.resolve(code === 0 ? { code, stdout: JSON.stringify(value), stderr: "" } : { code, stdout: "", stderr: value });
    await settle();
    f.render();
  };
  f.click = async (id) => {
    const node = find(f.tree, id);
    assert.ok(node, "missing " + id);
    if (id.startsWith("row-")) find(f.tree, "history-rows").handlers.on_item_click(id.slice(4), cx);
    else node.handlers.on_click({}, cx);
    await settle();
    f.render();
  };
  return f;
}
const session = (id, modified, extra = {}) => ({ path: "/s/" + id + ".jsonl", id, cwd: "/work/" + id, name: null, firstMessage: "about " + id, modified, messageCount: 3, ...extra });

test("source stays standalone: only gpui, herdr and its own helper; no shared state, labels, titles or uploads claims", () => {
  for (const src of [sessionsSource, mainSource]) {
    const imports = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
    assert.ok(imports.every((m) => ["gpui-kit", "gpui-base", "herdr", "./sessions.js"].includes(m)), imports.join());
    assert.doesNotMatch(src, /shared\(|setShared|localStorage|labels|\.title\b|terminals\(|agents\(|t3-focus/);
  }
  assert.doesNotMatch(mainSource, /no transcript/i);
  assert.match(mainSource, /no uploads/);
});

test("the user-facing name is History, not Pi history", () => {
  assert.equal(JSON.parse(read("mod.json")).title, "History");
  const f = dialog();
  f.render();
  assert.ok(texts(f.tree).includes("History"));
  for (const src of [mainSource, sessionsSource, read("mod.json"), fs.readFileSync(path.join(__dirname, "../sandbox-chrome/main.js"), "utf8")])
    assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /Pi history/i);
});

test("this computer's saved chats list even before its layout document is ready", async () => {
  const f = dialog({ machines: [{ name: null, layout: "loading" }, { name: "tau", layout: "loading" }] });
  assert.deepEqual(f.execs.map((e) => e.on), [null]);
  await f.answer(null, [session("early", 1)]);
  assert.deepEqual(rowKeys(f.tree), [":/s/early.jsonl"]);
  const g = dialog({ machines: [] });
  assert.deepEqual(g.execs.map((e) => e.on), [null]);
});

test("rows register no handlers in the virtual list renderer; the list's on_item_click resumes by key", async () => {
  const f = dialog();
  await f.answer(null, [session("a", 2), session("b", 1)]);
  await f.answer("tau", []);
  const list = find(f.tree, "history-rows");
  assert.equal(typeof list.handlers.on_item_click, "function");
  assert.ok(list.items.every((r) => Object.keys(r.handlers).length === 0));
  assert.deepEqual(f.keys, [":/s/a.jsonl", ":/s/b.jsonl"]);
  list.handlers.on_item_click("unknown", f.cx);
  assert.equal(f.execs.length, 2);
  list.handlers.on_item_click(":/s/b.jsonl", f.cx);
  assert.equal(f.pending.at(-1).request.path, "/s/b.jsonl");
});

test("every ready machine is asked for its own list; rows merge newest first with their machine", async () => {
  const f = dialog();
  assert.deepEqual(f.execs.map((e) => [e.cmd, e.on, e.request]), [["sh", null, {}], ["sh", "tau", {}]]);
  assert.equal(f.execs[0].args[0], "-c");
  f.render();
  assert.ok(texts(f.tree).includes("Loading saved Pi chats…"));
  await f.answer("tau", [session("remote", 20)]);
  await f.answer(null, [session("old", 10), session("new", 30, { name: "Named chat" })]);
  assert.deepEqual(rowKeys(f.tree), [":/s/new.jsonl", "tau:/s/remote.jsonl", ":/s/old.jsonl"]);
  assert.ok(texts(f.tree).includes("Named chat"));
  assert.ok(texts(f.tree).includes("remote · tau"));
  assert.ok(texts(f.tree).includes("old · Local"));
  assert.ok(texts(f.tree).some((x) => /^3 chats · Pi's All projects · no uploads$/.test(x)));
});

test("search needs every word across title, first message, folder, ID and machine; scope keeps one machine", async () => {
  const f = dialog();
  await f.answer(null, [session("alpha", 2, { name: "Fix login" }), session("beta", 1)]);
  await f.answer("tau", [session("gamma", 3, { firstMessage: "deploy login page" })]);
  f.query = "login tau"; f.render();
  assert.deepEqual(rowKeys(f.tree), ["tau:/s/gamma.jsonl"]);
  f.query = "work/beta"; f.render();
  assert.deepEqual(rowKeys(f.tree), [":/s/beta.jsonl"]);
  f.query = ""; f.render();
  await f.click("scope-tau");
  assert.deepEqual(rowKeys(f.tree), ["tau:/s/gamma.jsonl"]);
  await f.click("scope-all");
  assert.equal(rowKeys(f.tree).length, 3);
});

test("a failing machine is labelled with its error while others still list; Refresh drops stale answers", async () => {
  const f = dialog();
  await f.answer("tau", "Pi is not installed on this machine", 127);
  await f.answer(null, [session("one", 1)]);
  assert.ok(texts(f.tree).includes("tau · unavailable"));
  assert.equal(find(f.tree, "scope-tau").style.tooltip[0], "Pi is not installed on this machine");
  assert.deepEqual(rowKeys(f.tree), [":/s/one.jsonl"]);
  // Two refreshes in a row: the first one's answers arrive late and must not win.
  await f.click("refresh");
  await f.click("refresh");
  assert.equal(f.execs.length, 6);
  await f.answer(null, [session("fresh", 5)], 0, true);
  await f.answer("tau", [session("fresh-remote", 4)], 0, true);
  await f.answer(null, [session("stale", 9)]);
  await f.answer("tau", "stale failure", 1);
  assert.deepEqual(rowKeys(f.tree), [":/s/fresh.jsonl", "tau:/s/fresh-remote.jsonl"]);
  assert.ok(texts(f.tree).includes("tau"), "a stale failure doesn't mark the machine unavailable");
});

test("a click checks and resumes exactly the clicked session, asking first; nothing runs before confirmation", async () => {
  const f = dialog({ spaces: [{ id: "s1", machine: null, folder: "/elsewhere", tabs: [{ id: "t1" }] }], panes: [{ tab: "t1", cwd: "/work/b" }] });
  await f.answer(null, [session("a", 3), session("b", 2), session("c", 1)]);
  await f.answer("tau", []);
  await f.click("row-:/s/b.jsonl");
  // The list changes before the check answers; the clicked session still routes.
  f.query = "a"; f.render();
  assert.deepEqual(f.pending.at(-1).request, { path: "/s/b.jsonl", id: "b", cwd: "/work/b" });
  await f.answer(null, { cwdExists: true });
  assert.deepEqual(f.runs, []);
  assert.deepEqual(f.closed, ["o1"]);
  const confirm = plain(f.overlays[0]);
  assert.equal(confirm.mod, "confirm");
  assert.deepEqual(confirm.props.command, { name: "tab.new", args: { space: "s1", folder: "/work/b", argv: ["pi", "--session", "/s/b.jsonl"] } });
  assert.match(confirm.props.detail, /both will write to the same session file/);
});

test("Enter resumes the selected row after arrow keys", async () => {
  const f = dialog();
  await f.answer(null, [session("a", 3), session("b", 2)]);
  await f.answer("tau", []);
  find(f.tree, "pi-history").handlers.on_key_down({ key: "down" }, f.cx);
  assert.equal(f.scrolled, 1);
  f.inputs.submit({}, f.cx);
  assert.equal(f.pending.at(-1).request.path, "/s/b.jsonl");
});

test("remote sessions are checked on their machine and resume there; a gone folder lets Pi ask", async () => {
  const remoteSpace = { id: "tau/s9", machine: "tau", folder: "/work/r1", tabs: [{ id: "tau/t9" }] };
  const f = dialog({ spaces: [{ id: "s1", machine: null, folder: "/work/r2", tabs: [] }, remoteSpace] });
  await f.answer(null, []);
  await f.answer("tau", [session("r1", 2), session("r2", 1)]);
  await f.click("row-tau:/s/r1.jsonl");
  assert.equal(f.execs.at(-1).on, "tau");
  await f.answer("tau", { cwdExists: true });
  assert.deepEqual(plain(f.overlays[0].props.command), { name: "tab.new", args: { space: "tau/s9", folder: "/work/r1", argv: ["pi", "--session", "/s/r1.jsonl"] } });
  // A local space at the same path is another machine's folder: a new space on tau instead.
  const g = dialog({ spaces: [{ id: "s1", machine: null, folder: "/work/r2", tabs: [] }] });
  await g.answer(null, []);
  await g.answer("tau", [session("r2", 1)]);
  await g.click("row-tau:/s/r2.jsonl");
  await g.answer("tau", { cwdExists: true });
  assert.deepEqual(plain(g.overlays[0].props.command), { name: "space.new", args: { machine: "tau", folder: "/work/r2", argv: ["pi", "--session", "/s/r2.jsonl"] } });
  const h = dialog();
  await h.answer(null, [session("gone", 1)]);
  await h.answer("tau", []);
  await h.click("row-:/s/gone.jsonl");
  await h.answer(null, { cwdExists: false });
  assert.deepEqual(plain(h.overlays[0].props.command), { name: "space.new", args: { argv: ["pi", "--session", "/s/gone.jsonl"] } });
  assert.match(h.overlays[0].props.detail, /Pi will ask where to continue/);
});

test("a failed check reports and keeps the dialog; closing first drops late answers", async () => {
  const f = dialog();
  await f.answer(null, [session("a", 1)]);
  await f.answer("tau", []);
  await f.click("row-:/s/a.jsonl");
  await f.answer(null, "This saved Pi session is gone or changed. Refresh History.", 1);
  assert.equal(f.notes[0].body, "This saved Pi session is gone or changed. Refresh History.");
  assert.deepEqual(f.overlays, []);
  await f.click("row-:/s/a.jsonl");
  await f.mod.close();
  await f.answer(null, { cwdExists: true });
  assert.deepEqual([f.overlays, f.runs, f.notes.length], [[], [], 1]);
  const g = dialog();
  await g.mod.close();
  await g.answer(null, [session("late", 1)]);
  assert.deepEqual(rowKeys(g.tree), []);
});

test("Pi's own picker opens on the scoped machine for full-text search, rename and delete", async () => {
  const f = dialog();
  await f.answer(null, []);
  await f.answer("tau", []);
  await f.click("native-picker");
  assert.deepEqual(plain(f.runs), [["space.new", { argv: ["pi", "--resume"] }]]);
  await f.click("scope-tau");
  await f.click("native-picker");
  assert.deepEqual(plain(f.runs[1]), ["space.new", { machine: "tau", argv: ["pi", "--resume"] }]);
});
