// node --test: the History and Spaces mods with gpui and herdr stubbed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const MODS = new URL("../config/mods/", import.meta.url);
const source = (mod) => fs.readFileSync(new URL(mod + "/main.js", MODS), "utf8")
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
    timer: { after: (ms, fn) => { const t = { ms, fn, cancelled: false, cancel() { t.cancelled = true; } }; f.timers.push(t); return t; } },
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
    exec: (cmd, args) => new Promise((resolve) => f.execs.push({ cmd, args, resolve })),
    shared: () => f.saved ?? [], setShared() {}, agents: () => [], terminals: () => [], focused: () => null,
    layout: () => null, setAgentOrder() {}, nextCommand: () => new Promise(() => {}), openOverlay: (o) => (f.overlays ??= []).push(plain(o)),
  };
  const context = vm.createContext(env);
  vm.runInContext(source(mod), context, { filename: mod });
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
