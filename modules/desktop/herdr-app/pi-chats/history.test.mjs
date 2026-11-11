// node --test: the History, Spaces, Menu and Palette mods with gpui and herdr stubbed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const MODS = new URL("../config/mods/", import.meta.url);
const source = (mod, file = "main.js") => fs.readFileSync(new URL(mod + "/" + file, MODS), "utf8")
  .replace(/^import [^;]+;\r?\n/gm, "")
  .replace(/^export (async function|function|const) /gm, "$1 ")
  .replace("export default class", "globalThis.Mod = class");
const plain = (v) => JSON.parse(JSON.stringify(v));
const settle = () => new Promise((r) => setImmediate(r));

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
      else if (key === "tooltip") node.tooltip = args[0];
      else if (key.startsWith("on_")) {
        if (inItemRenderer) throw new Error(key + " in a virtual list renderer");
        node.handlers[key] = args[0];
      } else node.style[key] = args.length ? args[0] : true;
      return proxy;
    };
  } });
  return proxy;
}
const find = (n, id) => !n || typeof n !== "object" ? null : n.key === id ? n : n.items.reduce((h, c) => h ?? find(c, id), null);
const texts = (n) => typeof n === "string" ? [n] : n && typeof n === "object" ? n.items.flatMap(texts) : [];
const rowKeys = (tree) => (find(tree, "history-rows")?.rendered ?? []);
const clickable = (n) => !n || typeof n !== "object" ? [] : [...(n.handlers.on_click ? [n.key] : []), ...n.items.flatMap(clickable)];

function harness(mod, extra = {}) {
  const f = { execs: [], runs: [], closed: [], notes: [], timers: [], picks: [], query: "", spaces: [], panes: [], ...extra };
  const cx = {
    notify() {}, stop_propagation() {}, focus_handle: () => ({ focus() {} }),
    spawn: (fn) => { fn(cx); },
    timer: { after: (ms, fn) => { const t = { ms, fn, cancelled: false, cancel() { t.cancelled = true; } }; f.timers.push(t); return t; }, every() {} },
  };
  const env = {
    View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
    Input: { new: element }, Scrollbar: { vertical: element },
    VirtualListScrollHandle: { new: () => ({ scroll_to_item(i) { f.scrolled = i; } }) },
    v_virtual_list: (id, n, size, key, render) => {
      const el = element("list"); el.key = id;
      inItemRenderer = true;
      try { render({ start: 0, end: n }).forEach((r) => el.child(r)); } finally { inItemRenderer = false; }
      el.rendered = Array.from({ length: n }, (_, i) => key(i));
      return el;
    },
    InputState: { new: () => ({ on: (e, fn) => { f["on_" + e] = fn; }, value: () => f.query, focus() {} }) },
    localStorage: { getItem: () => null, setItem() {} },
    spaces: () => f.spaces, panes: () => f.panes, home: () => "/home/u", props: () => f.props ?? { overlay: "o1" },
    run: (...a) => f.runs.push(plain(a)), theme: () => f.theme ?? {}, closeOverlay: (id) => f.closed.push(id),
    notify: (n) => f.notes.push(n), pickFolder: (o) => new Promise((resolve) => f.picks.push({ o, resolve })),
    exec: (cmd, args, options) => new Promise((resolve, reject) => f.execs.push({ cmd, args, options, resolve, reject })),
    shared: () => f.saved ?? [], setShared() {}, agents: () => [], terminals: () => f.terminals ?? [], focused: () => f.focused ?? null,
    keys: () => [], commands: () => [], layouts: () => [],
    layout: () => null, setAgentOrder() {}, machines: () => f.machines ?? [{ name: null, layout: "ready" }], window: () => null, nextCommand: () => new Promise(() => {}), openOverlay: (o) => (f.overlays ??= []).push(plain(o)),
  };
  const context = vm.createContext(env);
  vm.runInContext(source(mod), context, { filename: mod });
  for (const file of extra.files ?? []) vm.runInContext(source(mod, file), context, { filename: file });
  f.ctx = context;
  f.cx = cx;
  f.mod = new context.Mod();
  f.init = () => { f.mod.init({}, cx); return f; };
  f.render = () => (f.tree = f.mod.render(cx));
  // Answers the oldest pending exec with that subcommand (and last argument).
  f.answer = async (sub, value, code = 0, arg) => {
    const i = f.execs.findIndex((e) => e.args[0] === sub && !e.done && (arg === undefined || e.args.at(-1) === arg));
    assert.ok(i >= 0, "no pending " + sub);
    const e = f.execs[i];
    e.done = true;
    e.resolve(code === 0 ? { code, stdout: JSON.stringify(value), stderr: "" } : { code, stdout: "", stderr: value });
    await settle();
    f.render();
  };
  f.type = (q) => { f.query = q; f.on_change({}, cx); f.render(); };
  f.fire = async (ms) => {
    for (const t of f.timers.filter((t) => !t.cancelled && !t.fired && (ms === undefined || t.ms === ms))) { t.fired = true; t.fn(cx); }
    await settle();
    f.render();
  };
  f.click = async (id) => { const n = find(f.tree, id); assert.ok(n, "missing " + id); n.handlers.on_click({}, cx); await settle(); f.render(); };
  return f;
}

const S = (id, modified, extra = {}) => ({ path: "/s/" + id + ".jsonl", id, cwd: "/w/" + id, name: null, first: "about " + id, created: 1, modified, messages: 2, ...extra });

const CHATS = "/home/u/Documents/Pi/Chats";

async function opened(sessions, extra) {
  const { next, ...rest } = extra ?? {};
  if (rest.folder) rest.props = { overlay: "o1", folder: rest.folder, label: rest.label };
  const f = harness("sandbox-history", rest).init();
  f.render();
  assert.ok(texts(f.tree).includes("Loading conversations…"));
  assert.deepEqual(plain(f.execs.map((e) => [e.cmd, e.args])), [["pi-chats", ["list", "--in", (rest.folder ?? CHATS).replace(/\/+$/, ""), "500"]]]);
  await f.answer("list", { root: "/r", sessions, more: Boolean(next), total: sessions.length, truncated: null, unreadable: 0 });
  return f;
}

test("one line per conversation: title, folder, date and message count; rows register no handlers", async () => {
  const f = await opened([S("b", 20, { name: "Named", messages: 7 }), S("a", 10, { cwd: "/home/u/Documents/Pi/Chats/2026-11-03/chat-x", messages: 1 })]);
  assert.deepEqual(rowKeys(f.tree), ["/s/b.jsonl", "/s/a.jsonl"]);
  const [title, folder, date, count] = texts(find(f.tree, "row-/s/b.jsonl"));
  assert.deepEqual([title, folder, count], ["Named", "/w/b", "7 msgs"]);
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual([find(f.tree, "title-/s/b.jsonl").tooltip, find(f.tree, "cwd-/s/a.jsonl").tooltip], ["Named\n\nPreview unavailable", "/home/u/Documents/Pi/Chats/2026-11-03/chat-x"]);
  assert.ok(texts(find(f.tree, "row-/s/a.jsonl")).includes("2026-11-03/chat-x"), "folders in the scope by their path from it");
  assert.ok(texts(find(f.tree, "row-/s/a.jsonl")).includes("1 msg"));
  assert.ok(!texts(f.tree).includes("about b"), "no transcript or first message beside a title");
});

test("a long title gets the row: the folder keeps its own size up to a cap beside a compact date and count", async () => {
  const long = "Refactor ".repeat(40).trim();
  const folder = "/home/u/proj";
  const f = await opened([S("a", 20, { name: long, cwd: folder + "/a/very/deep/sub/folder/that/goes/on" }), S("b", 10, { cwd: folder })], { folder, label: "proj" });
  const row = find(f.tree, "row-/s/a.jsonl");
  assert.deepEqual(row.items.map((n) => n.key), ["title-/s/a.jsonl", "cwd-/s/a.jsonl", "meta-/s/a.jsonl"]);
  assert.equal(row.style.h, 34, "still one compact line");
  const [title, cwd, meta] = row.items;
  assert.deepEqual([title.style.flex_1, title.style.min_w, title.style.truncate, title.items[0]], [true, 0, true, long]);
  const tip = title.tooltip.split("\n");
  assert.ok(tip[0].startsWith("Refactor Refactor") && tip[1].endsWith("…") && tip[2] === "", "the title, wrapped to two lines, opens its hover");
  assert.ok(tip.every((l) => l.length <= 72));
  assert.deepEqual([cwd.style.max_w, cwd.style.min_w, cwd.style.truncate, cwd.style.w, cwd.style.flex_1], [140, 0, true, undefined, undefined]);
  assert.deepEqual([cwd.items[0], cwd.tooltip], ["a/very/deep/sub/folder/that/goes/on", folder + "/a/very/deep/sub/folder/that/goes/on"]);
  assert.deepEqual(texts(find(f.tree, "cwd-/s/b.jsonl")), ["proj"]);
  assert.equal(meta.style.flex_none, true);
  assert.ok(meta.items.every((n) => n.style.w <= 66), "date and count stay compact");
  assert.equal(meta.tooltip, title.tooltip, "date and count show the same hover");
});

test("hover preview: roles and times, opening and recent excerpts split by what came between", () => {
  const f = harness("sandbox-history");
  const preview = (s) => vm.runInContext("preview", f.ctx)(s);
  const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
  const long = "word ".repeat(24).trim();
  const tip = preview(S("a", 1, { name: "Ship it", preview: {
    opening: [{ role: "user", time: at(3, 9, 5), text: "Deploy the zebra service" }, { role: "assistant", time: at(3, 9, 6), text: long }],
    recent: [{ role: "user", time: at(6, 14, 0), text: "Is it still up?" }, { role: "assistant", time: null, text: "fine" }],
    omitted: 12,
  } }));
  assert.equal(tip, [
    "Ship it", "",
    "You · 2026-11-03 09:05", "  Deploy the zebra service",
    "Pi · 09:06", "  " + "word ".repeat(14).trim(), "  " + "word ".repeat(10).trim(),
    "··· 12 more messages · 3 d 4 h later ···",
    "You · 2026-11-06 14:00", "  Is it still up?",
    "Pi", "  fine",
  ].join("\n"));
  const small = preview(S("b", 1, { preview: { opening: [{ role: "user", time: at(3, 9, 5), text: "hi" }, { role: "assistant", time: at(3, 9, 6), text: "hello" }], recent: [], omitted: 0 } }));
  assert.equal(small, "about b\n\nYou · 2026-11-03 09:05\n  hi\nPi · 09:06\n  hello", "nothing between: no marker, each message once");
  const most = preview(S("e", 1, { name: "T".repeat(240), preview: { opening: [0, 1].map(() => ({ role: "user", time: 1, text: "w".repeat(120) + "…" })), recent: [0, 1, 2].map(() => ({ role: "assistant", time: 2, text: "abcdefghijklm ".repeat(8) + "…" })), omitted: 99 } }));
  assert.ok(most.split("\n").length <= 19 && most.split("\n").every((l) => l.length <= 72), "the longest preview stays short");
  assert.match(most, /\n  abcdefghijklm.*…\n/, "a third line is cut short");
  const later = preview(S("c", 1, { preview: { opening: [{ role: "user", time: at(3, 9, 5), text: "a" }], recent: [{ role: "assistant", time: at(4, 9, 5), text: "b" }], omitted: 0 } }));
  assert.match(later, /\n··· 1 day later ···\n/, "a long pause is marked even with nothing between");
  assert.equal(preview(S("d", 1, { preview: { note: "too long to preview" } })), "about d\n\nPreview unavailable: too long to preview");
  assert.deepEqual(plain(vm.runInContext("[5e3, 25 * 6e4, 90 * 6e4, 26 * 36e5, 9 * 864e5].map(elapsed)", f.ctx)), ["moments", "25 min", "1 h 30 min", "1 d 2 h", "9 days"]);
});

test("selecting by click or keys only selects: nothing is read or launched until Resume", async () => {
  const f = await opened([S("b", 20), S("a", 10)]);
  const timers = f.timers.length;
  find(f.tree, "history-rows").handlers.on_item_click("/s/a.jsonl", f.cx);
  f.render();
  assert.equal(f.mod.selected, "/s/a.jsonl");
  f.mod.move(-1, f.cx);
  assert.deepEqual([f.mod.selected, f.scrolled], ["/s/b.jsonl", 0]);
  await f.fire();
  assert.deepEqual([f.execs.length, f.runs, f.closed, f.timers.length], [1, [], [], timers]);
  assert.deepEqual(clickable(f.tree), ["close", "resume"], "the header only dismisses; the footer acts on the selection");
});

test("double-clicking a row resumes it like Resume; slow or different-row clicks only select, once at a time", async () => {
  const f = await opened([S("b", 20), S("a", 10)]);
  let now = 1000;
  vm.runInContext("Date", f.ctx).now = () => now;
  const click = (key, ms = 0) => { now += ms; find(f.tree, "history-rows").handlers.on_item_click(key, f.cx); f.render(); };
  const checks = () => f.execs.filter((e) => e.args[0] === "check").map((e) => e.args[1]);
  click("/s/a.jsonl");
  click("/s/a.jsonl", 600);
  click("/s/b.jsonl", 100);
  assert.deepEqual([f.mod.selected, checks()], ["/s/b.jsonl", []], "too slow, then another row: selection only");
  click("/s/b.jsonl", 200);
  click("/s/b.jsonl", 100);
  click("/s/b.jsonl", 100);
  click("/s/a.jsonl", 100);
  click("/s/a.jsonl", 100);
  f.on_submit({}, f.cx);
  assert.deepEqual([checks(), f.runs], [["/s/b.jsonl"], []], "one check while busy");
  await f.answer("check", { id: "b", cwd: "/w/b", cwdExists: true });
  assert.deepEqual([f.closed, f.runs], [["o1"], [["space.new", { folder: "/w/b", argv: ["exec", "pi", "--session", "/s/b.jsonl"] }]]]);
});

test("the header: History over its scope, a quiet search, and a close button that only dismisses, like Esc", async () => {
  const theme = { border: "border", input: "input", accent: "accent", dim: "dim", muted: "muted" };
  const f = await opened([S("a", 1, { cwd: "/home/u/proj/src" })], { folder: "/home/u/proj/", label: "proj", theme });
  const scope = find(f.tree, "scope");
  assert.deepEqual([texts(scope), scope.tooltip], [["History", "proj"], "/home/u/proj"]);
  assert.ok(!texts(f.tree).includes("Esc"), "no raw key text");
  assert.deepEqual([find(f.tree, "close").tooltip, find(f.tree, "close").style.accessibility_label], ["Close · Esc", "Close history"]);
  const frame = () => find(f.tree, "search").style.border_color;
  const spinner = () => find(f.tree, "search").items.some((n) => n.kind === "mods/workspace-chrome/spinner.svg");
  assert.equal(frame(), "border", "a quiet frame");
  f.on_focus({}, f.cx); f.render();
  assert.equal(frame(), "input", "focus firms it up, never in accent");
  f.on_blur({}, f.cx); f.render();
  assert.equal(frame(), "border");
  f.type("zebra");
  assert.ok(spinner(), "a quiet spinner while text is searched");
  f.type("");
  assert.ok(!spinner());
  await f.click("close");
  assert.deepEqual([f.closed, f.runs, f.execs.map((e) => e.args[0])], [["o1"], [], ["list"]], "closing reads and launches nothing");
  const g = await opened([S("a", 1)]);
  find(g.tree, "history").handlers.on_key_down({ key: "escape" }, g.cx);
  assert.deepEqual([g.closed, g.runs, g.execs.length], [["o1"], [], 1]);
  assert.deepEqual(texts(find(g.tree, "scope")), ["History", "Chats"]);
});

test("empty and failing lists say so, and Retry reloads", async () => {
  const f = await opened([]);
  assert.ok(texts(f.tree).includes("No saved Pi conversations in Chats yet."));
  const g = harness("sandbox-history").init();
  await g.answer("list", "Cannot read Pi sessions in /r: EACCES", 1);
  assert.ok(texts(g.tree).includes("Couldn't read Pi conversations: Cannot read Pi sessions in /r: EACCES"));
  await g.click("retry");
  await g.answer("list", { sessions: [S("x", 1)] });
  assert.deepEqual(rowKeys(g.tree), ["/s/x.jsonl"]);
});

test("typing filters titles and folders at once and searches text only after a pause, one search at a time", async () => {
  const f = await opened([S("alpha", 30, { name: "Fix login" }), S("beta", 20), S("gamma", 10)]);
  const searches = () => f.execs.filter((e) => e.args[0] === "search").map((e) => e.args.at(-1));
  f.type("l");
  f.type("lo");
  f.type("login");
  assert.deepEqual(rowKeys(f.tree), ["/s/alpha.jsonl"], "title match before any search");
  assert.deepEqual(searches(), [], "no search per keystroke");
  assert.equal(f.timers.filter((t) => t.ms === 300 && !t.cancelled).length, 1, "earlier debounces cancelled");
  await f.fire(300);
  assert.deepEqual(searches(), ["login"]);
  assert.ok(texts(f.tree).some((x) => /searching conversation text/.test(x)));
  // Two more settled queries while the first runs: only the latest runs next.
  f.type("logout"); await f.fire(300);
  f.type("Deploy  NOW"); await f.fire(300);
  assert.deepEqual(searches(), ["login"]);
  await f.answer("search", { hits: [{ path: "/s/gamma.jsonl", first: "stale login hit", messages: 2 }], scanned: 3, total: 3, truncated: null });
  assert.deepEqual(searches(), ["login", "deploy now"]);
  assert.ok(!texts(f.tree).includes("stale login hit"), "a stale query's hits never show");
  await f.answer("search", { hits: [{ path: "/s/beta.jsonl", first: "about beta", messages: 2 }], scanned: 3, total: 3, truncated: null });
  assert.deepEqual(rowKeys(f.tree), ["/s/beta.jsonl"]);
});

test("search failures and truncation are reported", async () => {
  const f = await opened([S("a", 2), S("b", 1)]);
  f.type("zzz"); await f.fire(300);
  await f.answer("search", "boom", 1);
  assert.ok(texts(f.tree).some((x) => /text search failed: boom/.test(x)));
  assert.ok(texts(f.tree).includes("No conversations match."));
  f.type("yyy"); await f.fire(300);
  await f.answer("search", { hits: [{ path: "/s/b.jsonl", first: "about b", messages: 2 }], scanned: 1, total: 2, truncated: "time", skipped: 1 });
  assert.ok(texts(f.tree).some((x) => /stopped after 20 s \(1 of 2 newest searched\).*1 oversized messages skipped/.test(x)));
});

test("a workspace counts as open where its terminals are now, not where it was made", () => {
  const f = harness("sandbox-history");
  const openAt = (cwd, sp, ps) => vm.runInContext("openAt", f.ctx)(cwd, sp, ps)?.id ?? null;
  const A = { id: "A", machine: null, folder: "/a", tabs: [{ id: "ta" }] };
  const B = { id: "B", machine: null, folder: "/c", tabs: [{ id: "tb" }] };
  const C = { id: "C", machine: null, folder: "/a", tabs: [{ id: "tc" }] };
  const R = { id: "R", machine: "tau", folder: "/a", tabs: [{ id: "tr" }] };
  const ps = [{ tab: "ta", cwd: "/b" }, { tab: "tb", cwd: "/a/" }];
  assert.equal(openAt("/a", [A, B], ps), "B", "the live match wins over A's old folder");
  assert.equal(openAt("/a", [A], ps), null, "A moved away");
  assert.equal(openAt("/a", [A, C, R], ps), "C", "no live folder known: its own folder");
  assert.equal(openAt("/a", [R], []), null, "other machines' folders aren't here");
});

test("text matches older than the loaded list show their own message totals and resume", async () => {
  const f = await opened([S("new", 50)], { next: 1 });
  f.type("ancient"); await f.fire(300);
  const preview = { opening: [{ role: "user", time: 5, text: "the ancient bug" }], recent: [{ role: "assistant", time: 6, text: "fixed it" }], omitted: 10 };
  await f.answer("search", { hits: [{ path: "/s/old.jsonl", id: "old", cwd: "/w/old", name: null, first: "the ancient bug", modified: 5, messages: 12, preview }], scanned: 2, total: 2, truncated: null });
  assert.deepEqual(rowKeys(f.tree), ["/s/old.jsonl"]);
  assert.ok(texts(f.tree).includes("the ancient bug"));
  assert.ok(texts(find(f.tree, "row-/s/old.jsonl")).includes("12 msgs"));
  assert.match(find(f.tree, "title-/s/old.jsonl").tooltip, /^the ancient bug\n\nYou · .*\n  the ancient bug\n··· 10 more messages · moments later ···\nPi · .*\n  fixed it$/, "its own preview from the search");
  await f.click("resume");
  await f.answer("check", { id: "old", cwd: "/w/old", cwdExists: true });
  assert.deepEqual(f.runs, [["space.new", { folder: "/w/old", argv: ["exec", "pi", "--session", "/s/old.jsonl"] }]]);
});

test("Load older asks for a longer fresh list; a failure shows in the footer and can be retried", async () => {
  const f = await opened([S("b", 50), S("a", 40)], { next: true });
  assert.ok(texts(f.tree).some((x) => /older ones not loaded/.test(x)));
  await f.click("older");
  assert.deepEqual(plain(f.execs.at(-1).args), ["list", "--in", CHATS, "1000"]);
  await f.answer("list", "Pi's sessions took too long to read", 1);
  assert.deepEqual(rowKeys(f.tree), ["/s/b.jsonl", "/s/a.jsonl"]);
  assert.ok(texts(f.tree).some((x) => /couldn't load: Pi's sessions took too long to read/.test(x)));
  await f.click("older");
  assert.deepEqual(plain(f.execs.at(-1).args), ["list", "--in", CHATS, "1000"]);
  await f.answer("list", { sessions: [S("b", 50), S("z", 45), S("a", 40), S("y", 10)], more: false, total: 4, truncated: null, unreadable: 1 });
  assert.deepEqual(rowKeys(f.tree), ["/s/b.jsonl", "/s/z.jsonl", "/s/a.jsonl", "/s/y.jsonl"]);
  assert.equal(find(f.tree, "older"), null);
  assert.ok(texts(f.tree).some((x) => /1 unreadable/.test(x)));
});

test("History is scoped: props {folder, label} go to every helper call; default is Chats", async () => {
  const folder = '/home/u/it\'s "proj"';
  const f = await opened([S("a", 1, { cwd: folder + "/src" })], { folder: folder + "/", label: "proj" });
  assert.ok(texts(f.tree).includes("proj"));
  assert.ok(texts(f.tree).includes("History"));
  f.type("bug"); await f.fire(300);
  assert.deepEqual(plain(f.execs.find((e) => e.args[0] === "search").args), ["search", "--in", folder, "bug"]);
  const g = await opened([]);
  assert.ok(texts(g.tree).includes("Chats"));
  assert.ok(texts(g.tree).includes("No saved Pi conversations in Chats yet."));
});

test("no open workspace: Resume or Enter checks the exact file, then opens a space there with that session", async () => {
  const s = S("a", 1, { path: "/s/it's $(x).jsonl" });
  const f = await opened([s]);
  assert.deepEqual(clickable(f.tree), ["close", "resume"]);
  assert.equal(find(f.tree, "resume").tooltip, "Open a new workspace with pi --session /s/it's $(x).jsonl");
  await f.click("resume");
  assert.deepEqual(plain(f.execs.at(-1).args), ["check", "/s/it's $(x).jsonl"]);
  assert.deepEqual(f.runs, []);
  await f.answer("check", { id: "a", cwd: "/w/a", cwdExists: true });
  assert.deepEqual(f.closed, ["o1"]);
  assert.deepEqual(f.runs, [["space.new", { folder: "/w/a", argv: ["exec", "pi", "--session", "/s/it's $(x).jsonl"] }]]);
  const g = await opened([S("b", 2), s]);
  g.mod.move(1, g.cx);
  g.on_submit({}, g.cx);
  await settle();
  assert.deepEqual([g.runs, plain(g.execs.at(-1).args)], [[], ["check", "/s/it's $(x).jsonl"]]);
  await g.answer("check", { id: "a", cwd: "/w/a", cwdExists: true });
  assert.deepEqual(g.runs, [["space.new", { folder: "/w/a", argv: ["exec", "pi", "--session", "/s/it's $(x).jsonl"] }]]);
});

test("open workspace in that folder: only Resume, which checks the exact file and opens it in a new tab there", async () => {
  const sessions = [S("b", 2, { cwd: "/w/a" }), S("a", 1)];
  const spaces = [{ id: "sp1", name: "proj", machine: null, folder: "/elsewhere", tabs: [{ id: "t1" }] }, { id: "sp2", name: "remote", machine: "tau", folder: "/w/a", tabs: [] }];
  const f = await opened(sessions, { spaces, panes: [{ tab: "t1", cwd: "/w/a/" }] });
  assert.deepEqual(clickable(f.tree), ["close", "resume"]);
  assert.ok(!texts(f.tree).some((x) => /double-write|Workspace open/.test(x)), "no visible warning");
  assert.match(find(f.tree, "resume").tooltip, /^Open a new tab in proj with pi --session \/s\/b\.jsonl\. If that workspace is already running this conversation, two Pi sessions will write to the same file\.$/);
  await f.click("resume");
  assert.deepEqual([f.runs, plain(f.execs.at(-1).args)], [[], ["check", "/s/b.jsonl"]]);
  await f.answer("check", { id: "b", cwd: "/w/a", cwdExists: true });
  assert.deepEqual(f.closed, ["o1"]);
  assert.deepEqual(f.runs, [["space.select", { id: "sp1" }], ["tab.new", { space: "sp1", folder: "/w/a", argv: ["exec", "pi", "--session", "/s/b.jsonl"] }]]);
  // Enter resumes the selected file, not whatever the workspace in its folder runs; once at a time.
  const h = await opened(sessions, { spaces, panes: [{ tab: "t1", cwd: "/w/a" }] });
  h.mod.move(1, h.cx);
  h.on_submit({}, h.cx);
  h.on_submit({}, h.cx);
  await settle();
  assert.deepEqual([h.runs, h.execs.filter((e) => e.args[0] === "check").map((e) => plain(e.args))], [[], [["check", "/s/a.jsonl"]]]);
  await h.answer("check", { id: "a", cwd: "/w/a", cwdExists: true });
  assert.deepEqual(h.runs, [["space.select", { id: "sp1" }], ["tab.new", { space: "sp1", folder: "/w/a", argv: ["exec", "pi", "--session", "/s/a.jsonl"] }]]);
});

test("missing folder: says why, asks for a replacement before launching; cancelling launches nothing", async () => {
  const s = S("a", 1);
  const f = await opened([s]);
  await f.click("resume");
  await f.answer("check", { id: "a", cwd: "/w/a", cwdExists: false });
  assert.deepEqual([f.picks.length, f.notes[0].level], [1, "warning"]);
  assert.match(f.notes[0].body, /^\/w\/a\. Choose a folder to resume in; Pi will ask to continue there\.$/);
  f.picks[0].resolve(null);
  await settle();
  f.render();
  assert.deepEqual([f.runs, f.closed], [[], []]);
  await f.click("resume");
  await f.answer("check", { id: "a", cwd: "/w/a", cwdExists: false });
  f.picks[1].resolve("/new place");
  await settle();
  assert.deepEqual(f.runs, [["space.new", { folder: "/new place", argv: ["exec", "pi", "--session", "/s/a.jsonl"] }]]);
});

test("a folder that vanished after listing still asks first, even with a workspace open there", async () => {
  const s = S("a", 1);
  const f = await opened([s], { spaces: [{ id: "sp1", name: "p", machine: null, folder: "/w/a", tabs: [] }] });
  await f.click("resume");
  await f.answer("check", { id: "a", cwd: "/w/a", cwdExists: false });
  f.picks[0].resolve("/other");
  await settle();
  assert.deepEqual(f.runs, [["space.new", { folder: "/other", argv: ["exec", "pi", "--session", "/s/a.jsonl"] }]]);
});

test("a replaced or unreadable file is reported and nothing launches; closing drops late answers", async () => {
  const s = S("a", 1);
  const f = await opened([s]);
  await f.click("resume");
  await f.answer("check", { id: "other", cwd: "/w/a", cwdExists: true });
  assert.match(f.notes[0].body, /another session/);
  await f.click("resume");
  await f.answer("check", "Session file not found", 1);
  assert.equal(f.notes[1].body, "Session file not found");
  await f.click("resume");
  await f.mod.close();
  await f.answer("check", { id: "a", cwd: "/w/a", cwdExists: true });
  assert.deepEqual([f.runs, f.notes.length], [[], 2]);
});

test("Spaces: each saved space, other local spaces and Chats open their own History", () => {
  const f = harness("sandbox-spaces", {
    saved: [{ name: "proj", folder: "/home/u/proj", color: "ansi6" }],
    spaces: [{ id: "s9", name: "misc", folder: "/made/here", machine: null, tabs: [{ id: "t9" }] }],
    panes: [{ tab: "t9", cwd: "/now/there", terminal: "x" }],
  });
  const hist = () => (f.overlays ?? []).filter((o) => o.mod === "sandbox-history").map((o) => o.props);
  f.props = {};
  f.init();
  f.mod.hovered = "saved-0";
  f.render();
  find(f.tree, "hist-0").handlers.on_click({}, f.cx);
  find(f.tree, "history").handlers.on_click({}, f.cx);
  assert.deepEqual(hist(), [{ folder: "/home/u/proj", label: "proj" }, { folder: "/home/u/Documents/Pi/Chats", label: "Chats" }]);
  const menu = harness("sandbox-spaces", { saved: [{ name: "proj", folder: "/home/u/proj", color: "ansi6" }], spaces: f.spaces, panes: f.panes, props: { overlay: "m", menu: { saved: "/home/u/proj" } } }).init();
  menu.render();
  find(menu.tree, "m-history").handlers.on_click({}, menu.cx);
  const other = harness("sandbox-spaces", { spaces: f.spaces, panes: f.panes, props: { overlay: "m", menu: { space: "s9" } } }).init();
  other.render();
  find(other.tree, "m-history").handlers.on_click({}, other.cx);
  assert.deepEqual([...menu.overlays, ...other.overlays].map((o) => o.props), [{ folder: "/home/u/proj", label: "proj" }, { folder: "/now/there", label: "misc" }]);
  // Other rows: a hover History button in the space's live folder; remote ones say it's local only.
  const remote = { id: "r1", name: "vps", folder: "/now/there", machine: "tau", tabs: [] };
  const row = harness("sandbox-spaces", { spaces: [...f.spaces, remote], panes: f.panes, props: {} }).init();
  row.mod.hovered = "space-s9";
  row.render();
  find(row.tree, "hist-s9").handlers.on_click({}, row.cx);
  assert.deepEqual(row.overlays.map((o) => o.props), [{ folder: "/now/there", label: "misc" }]);
  row.mod.hovered = "space-r1";
  row.render();
  assert.equal(find(row.tree, "hist-r1").handlers.on_click, undefined);
});

test("Spaces: new chats get a durable folder from pi-chats; dated and legacy /tmp chats group under Chats", async () => {
  const f = harness("sandbox-spaces", {
    saved: [{ name: "proj", folder: "/home/u/proj", color: "ansi6" }],
    spaces: [
      { id: "s1", folder: "/home/u/Documents/Pi/Chats/2026-11-03/chat-ab12cd", machine: null, tabs: [{ id: "t1" }] },
      { id: "s2", folder: "/tmp/pi-session.XYZ", machine: null, tabs: [{ id: "t2" }] },
      { id: "s3", folder: "/home/u/proj/sub", machine: null, tabs: [{ id: "t3" }] },
      { id: "s4", folder: "/home/u/Documents", machine: null, tabs: [{ id: "t4" }] },
    ],
  });
  const g = vm.runInContext("grouped()", f.ctx);
  assert.deepEqual(plain([g.chats.map((s) => s.id), g.of.get("/home/u/proj").map((s) => s.id), g.other.map((s) => s.id)]), [["s1", "s2"], ["s3"], ["s4"]]);
  vm.runInContext("chatNow()", f.ctx);
  assert.deepEqual(plain(f.execs.map((e) => [e.cmd, e.args])), [["pi-chats", ["new"]]]);
  f.execs[0].resolve({ code: 0, stdout: "/home/u/Documents/Pi/Chats/2026-11-03/chat-new\n", stderr: "" });
  await settle();
  assert.deepEqual(f.runs, [["space.new", { folder: "/home/u/Documents/Pi/Chats/2026-11-03/chat-new", argv: ["exec", "pi"] }]]);
  vm.runInContext("chatNow()", f.ctx);
  f.execs[1].resolve({ code: 1, stdout: "", stderr: "EACCES" });
  await settle();
  assert.deepEqual([f.runs.length, f.notes[0].body], [1, "EACCES"]);
});

const PI_ = ["exec", "pi"];
const launchWorld = () => {
  const proj = { name: "proj", folder: "/home/u/proj", color: "ansi6" };
  const live = { name: "live", folder: "/home/u/live", color: "ansi3" };
  const spaces = [
    { id: "l1", name: "live", folder: "/home/u/live", machine: null, tabs: [{ id: "lt" }] },
    { id: "s9", name: "misc", folder: "/made/here", machine: null, tabs: [] },
    { id: "tau/a", name: "first", folder: "/srv/a", machine: "tau", tabs: [] },
    { id: "tau/b", name: "second", folder: "/srv/b", machine: "tau", tabs: [{ id: "tau/tb" }] },
    { id: "vps/c", name: "down", folder: "/srv/c", machine: "vps", tabs: [] },
  ];
  const panes = [{ tab: "tau/tb", cwd: "/srv/b/src", terminal: "tau/t1" }];
  const machines = [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }, { name: "vps", layout: "unavailable" }];
  const f = harness("sandbox-spaces", { saved: [proj, live], spaces, panes, machines, props: {} }).init();
  f.execs.splice(0);
  f.press = (row, id) => { f.mod.hovered = row; f.render(); find(f.tree, id).handlers.on_click({}, f.cx); };
  f.tips = (id) => [find(f.tree, "commit-" + id)?.tooltip, find(f.tree, "pi-" + id)?.tooltip];
  // Answers the oldest pending git rev-parse with a repo top.
  f.top = async (top, code = 0) => {
    const e = f.execs.find((e) => e.cmd === "git" && !e.done);
    assert.ok(e, "no pending git");
    e.done = true;
    e.resolve(code === 0 ? { code, stdout: top + "\n", stderr: "" } : { code, stdout: "", stderr: top });
    await settle();
  };
  return f;
};
const gits = (f) => plain(f.execs.filter((e) => e.cmd === "git").map((e) => [e.args, e.options]));

test("Spaces: saved and remote rows offer Commit & push and New Pi chat; New Pi chat opens where it did", () => {
  const f = launchWorld();
  f.press("saved-0", "pi-0");
  f.press("saved-1", "pi-1");
  assert.deepEqual(f.tips(1), ["Commit & push", "New Pi chat"]);
  assert.equal(find(f.tree, "term-1"), null, "no New terminal button");
  f.press("space-tau/b", "pi-tau/b");
  assert.deepEqual(f.tips("tau/b"), ["Commit & push", "New Pi chat"]);
  assert.equal(find(f.tree, "commit-tau/a"), null, "only the hovered row");
  assert.deepEqual(f.runs.splice(0), [
    ["space.new", { name: "proj", machine: "", folder: "/home/u/proj", argv: PI_ }],
    ["space.select", { id: "l1" }], ["tab.new", { space: "l1", folder: "/home/u/live", argv: PI_ }],
    ["space.select", { id: "tau/b" }], ["tab.new", { space: "tau/b", argv: PI_ }],
  ]);
  assert.equal(find(f.tree, "hist-tau/b").handlers.on_click, undefined, "History stays local-only");

  f.mod.hovered = "space-s9"; f.render();
  assert.deepEqual([f.tips("s9"), typeof find(f.tree, "hist-s9").handlers.on_click], [[undefined, undefined], "function"], "local other rows unchanged");
  f.mod.hovered = "space-vps/c"; f.render();
  assert.deepEqual(f.tips("vps/c"), [undefined, undefined], "no launch on an unavailable machine");
  assert.deepEqual([f.runs, f.execs], [[], []]);

  const menu = harness("sandbox-spaces", { saved: f.saved, spaces: f.spaces, props: { overlay: "m", menu: { saved: "/home/u/proj" } } }).init();
  menu.render();
  find(menu.tree, "m-term").handlers.on_click({}, menu.cx);
  assert.deepEqual(menu.runs, [["space.new", { name: "proj", machine: "", folder: "/home/u/proj" }]], "the menu keeps New terminal");
});

test("Spaces: Commit & push opens a named Pi tab at the repo top on the row's machine, with its task", async () => {
  const f = launchWorld();
  f.press("saved-0", "commit-0");
  f.press("saved-1", "commit-1");
  f.press("space-tau/b", "commit-tau/b");
  assert.deepEqual(gits(f), [
    [["rev-parse", "--show-toplevel"], { cwd: "/home/u/proj", on: null }],
    [["rev-parse", "--show-toplevel"], { cwd: "/home/u/live", on: null }],
    [["rev-parse", "--show-toplevel"], { cwd: "/srv/b/src", on: "tau" }],
  ], "git runs where each row's folder is");
  assert.deepEqual(f.runs, [], "nothing opens before git answers");
  await f.top("/home/u/proj");
  await f.top("/home/u/live");
  await f.top("/srv/b");
  const task = f.runs.find((r) => r[0] === "space.new")[1].task;
  assert.deepEqual(f.runs.map(([name, args]) => [name, args.task ? { ...args, task: "…" } : args]), [
    ["space.new", { name: "proj", machine: "", tab: "Commit & push", folder: "/home/u/proj", argv: PI_, task: "…" }],
    ["space.select", { id: "l1" }], ["tab.new", { space: "l1", name: "Commit & push", folder: "/home/u/live", argv: PI_, task: "…" }],
    ["space.select", { id: "tau/b" }], ["tab.new", { space: "tau/b", name: "Commit & push", folder: "/srv/b", argv: PI_, task: "…" }],
  ]);
  assert.ok(f.runs.filter((r) => r[1].task).every((r) => r[1].task === task), "one task for all");
  for (const word of [/Fetch/, /secrets/, /atomic commits/, /safely integrate upstream/, /push the current branch/, /summarize/, /Ask only if blocked or unsure/, /Never force push or discard work/])
    assert.match(task, word);
});

test("Spaces: one Commit & push per repo: a second click shows the open tab; other repos and machines still start", async () => {
  const f = launchWorld();
  f.press("saved-1", "commit-1");
  f.press("saved-1", "commit-1");
  await f.top("/home/u/live");
  await f.top("/home/u/live");
  assert.equal(f.runs.filter((r) => r[0] === "tab.new").length, 1, "a double click while starting opens one");
  f.runs.splice(0);
  f.timers.find((t) => t.ms === 5000).fn(f.cx);

  // The started tab shows up: led by its Pi at the repo top, even from a subfolder click.
  f.spaces[0].tabs.push({ id: "ct", name: "Commit & push", named: true, status: "working" });
  f.panes.push({ tab: "ct", cwd: "/home/u/live", terminal: "t5", program: { agent: true } });
  f.press("saved-1", "commit-1");
  await f.top("/home/u/live");
  assert.deepEqual(f.runs.splice(0), [["space.select", { id: "l1" }], ["tab.select", { id: "ct" }]]);

  // Same path on another machine is another repo.
  f.spaces[3].folder = "/home/u/live";
  f.panes[0].cwd = "/home/u/live";
  f.press("space-tau/b", "commit-tau/b");
  await f.top("/home/u/live");
  assert.deepEqual(f.runs.splice(0).map((r) => r[0]), ["space.select", "tab.new"]);

  // Closed: a new run starts.
  f.spaces[0].tabs.pop();
  f.press("saved-1", "commit-1");
  await f.top("/home/u/live");
  assert.deepEqual(f.runs.splice(0).map((r) => r[0]), ["space.select", "tab.new"]);
});

test("Spaces: Commit & push outside a repo or on an unreachable machine says why and opens nothing", async () => {
  const f = launchWorld();
  f.press("saved-0", "commit-0");
  await f.top("fatal: not a git repository", 128);
  f.press("space-tau/b", "commit-tau/b");
  f.execs.find((e) => !e.done).reject(new Error("tau unreachable"));
  await settle();
  assert.deepEqual([f.runs, f.notes.map((n) => [n.level, n.body])],
    [[], [["error", "fatal: not a git repository"], ["error", "tau unreachable"]]]);
});

// Two local tabs, each led by a Pi; the second tab's Pi isn't its focused pane.
const forkWorld = () => ({
  spaces: [
    { id: "sp1", machine: null, tabs: [{ id: "tb1" }, { id: "tb2" }] },
    { id: "tau/sp", machine: "tau", tabs: [{ id: "tau/tb" }] },
  ],
  panes: [
    { pane: "p1", tab: "tb1", terminal: "t1", app: "pi", status: "idle", program: { agent: true }, focused: true },
    { pane: "p2", tab: "tb2", terminal: "t2", app: null, status: null, program: { agent: false }, focused: true },
    { pane: "p3", tab: "tb2", terminal: "t3", app: "pi", status: "done", program: { agent: true }, focused: false },
    { pane: "p4", tab: "tau/tb", terminal: "tau/t4", app: "pi", status: "idle", program: { agent: true }, focused: true },
  ],
  terminals: ["t1", "t2", "t3", "tau/t4"].map((address) => ({ address, state: "live" })),
});
const menuOn = (tab, space = "sp1", world = forkWorld()) => {
  const f = harness("sandbox-menu", { ...world, files: ["link.js"], props: { overlay: "m", tab: "tab", target: { id: tab, space } } }).init();
  f.render();
  return f;
};
const labels = (f) => [...Array(9).keys()].map((i) => find(f.tree, `mi-${i}`)).filter(Boolean).map((n) => texts(n)[0]);
const keyPresses = (f) => f.execs.map((e) => [e.cmd, ...e.args]);

test("Menu: Fork conversation presses F6 in the clicked tab's own Pi and closes only once it's delivered", async () => {
  const f = menuOn("tb2");
  assert.deepEqual(labels(f), ["Rename", "New tab", "Copy link to chat", "Fork conversation", "Close"]);
  await f.click("mi-3");
  await f.click("mi-3");
  assert.deepEqual(keyPresses(f), [["hc", "keys", "t3", "f6"]], "the clicked tab's Pi, not the focused shell or the active tab; once");
  assert.equal(f.execs[0].options.timeout, 15000);
  assert.deepEqual([f.closed, f.runs, f.notes], [[], [], []], "stays open while the key goes");
  f.execs[0].resolve({ code: 0, stdout: "{}", stderr: "" });
  await settle();
  assert.deepEqual([f.closed, f.runs, f.notes], [["m"], [], []], "no claim that the fork opened: Pi says so");
});

test("Menu: no Fork for a shell-led, other-agent or remote tab", () => {
  const world = forkWorld();
  world.panes[0] = { ...world.panes[0], app: "claude" };
  assert.ok(!labels(menuOn("tb1", "sp1", world)).includes("Fork conversation"));
  world.panes = world.panes.filter((p) => p.pane !== "p3");
  assert.ok(!labels(menuOn("tb2", "sp1", world)).includes("Fork conversation"));
  assert.ok(!labels(menuOn("tau/tb", "tau/sp")).includes("Fork conversation"));
});

for (const [name, change, why] of [
  ["busy", (w) => { w.panes[2].status = "working"; }, "Pi is busy; try again once it's waiting for you."],
  ["blocked", (w) => { w.panes[2].status = "blocked"; }, "Pi is busy; try again once it's waiting for you."],
  ["moved to another tab", (w) => { w.panes[2].tab = "tb1"; }, "That conversation is no longer in its tab."],
  ["now another program", (w) => { w.panes[2].app = "claude"; }, "That pane is no longer Pi."],
  ["ended", (w) => { w.terminals[2].state = "finished"; }, "That Pi has ended."],
]) {
  test(`Menu: a shown Fork whose Pi is ${name} by the click presses nothing and runs nothing else`, async () => {
    const f = menuOn("tb2");
    change(f);
    await f.click("mi-3");
    assert.deepEqual([f.execs, f.runs, f.closed], [[], [], ["m"]]);
    assert.deepEqual(plain(f.notes), [{ title: "Couldn't ask Pi to fork", body: why, level: "error" }]);
  });
}

test("Menu: Enter acts on the item shown, not whatever slid into its place", async () => {
  const f = menuOn("tb2");
  f.mod.at = 3;
  f.render();
  f.panes.splice(2, 1);
  find(f.tree, "menu").handlers.on_key_down({ key: "enter" }, f.cx);
  await settle();
  assert.deepEqual([f.runs, f.execs], [[], []], "not Close");
  assert.equal(f.notes[0].body, "That conversation is no longer in its tab.");
});

for (const [name, fail, body] of [
  ["exits nonzero", (e) => e.resolve({ code: 1, stdout: "", stderr: "finished: t3 has exited\n" }), "finished: t3 has exited"],
  ["times out", (e) => e.reject(new Error("timed out after 15000 ms")), "timed out after 15000 ms"],
]) {
  test(`Menu: when hc keys ${name} it says so once, without retrying`, async () => {
    const f = menuOn("tb2");
    await f.click("mi-3");
    fail(f.execs[0]);
    await settle();
    assert.deepEqual([f.execs.length, f.closed, plain(f.notes)], [1, ["m"], [{ title: "Couldn't ask Pi to fork", body, level: "error" }]]);
  });
}

const paletteOn = (focus, world = forkWorld()) => {
  const f = harness("sandbox-palette", { ...world, focused: focus, props: { overlay: "pal" } });
  f.ctx.win = () => null;
  f.init();
  f.type("fork");
  return f;
};
const forkRow = (f) => f.mod.rows().find((r) => r.e.name === "chat.fork")?.e;

test("Palette: Fork focused Pi conversation targets the focused pane's own Pi, captured when chosen", async () => {
  const f = paletteOn({ space: "sp1", tab: "tb1", pane: "p1", terminal: "t1" });
  assert.deepEqual(plain(forkRow(f)), { name: "chat.fork", args: {}, target: { space: "sp1", tab: "tb1", terminal: "t1" }, group: "Tab", title: "Fork focused Pi conversation", words: "branch fork snapshot pi conversation", id: "chat.fork:{}" });
  f.on_submit({}, f.cx);
  f.focused = { space: "sp1", tab: "tb2", pane: "p3", terminal: "t3" };
  f.on_submit({}, f.cx);
  assert.deepEqual(keyPresses(f), [["hc", "keys", "t1", "f6"]], "once, and never retargeted");
  assert.deepEqual([f.closed, f.runs], [[], []]);
  f.execs[0].resolve({ code: 0, stdout: "", stderr: "" });
  await settle();
  assert.deepEqual([f.closed, f.runs, f.notes], [["pal"], [], []]);
});

test("Palette: no Fork entry unless the focused model pane itself is a local Pi", () => {
  for (const focus of [
    null,
    { space: "sp1", tab: "tb2", pane: "p2", terminal: "t2" },
    { space: "sp1", tab: "tb1", pane: null, terminal: "t1" },
    { space: "tau/sp", tab: "tau/tb", pane: "p4", terminal: "tau/t4" },
  ]) assert.equal(forkRow(paletteOn(focus)), undefined, JSON.stringify(focus));
});

test("Palette: a stale row whose Pi got busy presses nothing and says why", async () => {
  const f = paletteOn({ space: "sp1", tab: "tb1", pane: "p1", terminal: "t1" });
  f.panes[0].status = "working";
  find(f.tree, "pl-0").handlers.on_click({}, f.cx);
  await settle();
  assert.deepEqual([f.execs, f.runs, f.closed], [[], [], ["pal"]]);
  assert.equal(f.notes[0].body, "Pi is busy; try again once it's waiting for you.");
});
