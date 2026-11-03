// Extended locally to check the Pi shortcut and built-in agent menu integration.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function element() {
  const node = { key: null, items: [], handlers: {}, style: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (["child", "content", "trigger"].includes(key)) node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.key = args[0];
      else if (key === "on_mouse_down" || key === "on_mouse_up") node.handlers[`${key}:${args[0]}`] = args[1];
      else if (key.startsWith("on_")) node.handlers[key] = args[0];
      else node.style[key] = args;
      return proxy;
    };
  } });
  return proxy;
}

function find(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.key === id) return node;
  for (const child of node.items) { const hit = find(child, id); if (hit) return hit; }
  return null;
}

function cards(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.key?.startsWith("card-")) out.push(node.key.slice(5));
  else for (const child of node.items) cards(child, out);
  return out;
}

function texts(node) {
  if (typeof node === "string") return [node];
  return node && typeof node === "object" ? node.items.flatMap(texts) : [];
}

function fixture() {
  const f = { now: 1000, rows: [], terms: [], order: [], calls: [], jobs: [], timers: [], intervals: [], writes: [], data: new Map(), pins: [], mode: "focus", notifications: [], overlays: [], closedOverlays: [], requests: [], ps: [], saved: [], machines: [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }] };
  const cx = {
    notify() { f.notified = true; }, stop_propagation() {},
    write_to_clipboard(value) { f.clipboard = value; f.clipboardWrites = (f.clipboardWrites ?? 0) + 1; },
    focus_handle: () => ({ focus() { f.keys = true; } }),
    spawn: (fn) => f.jobs.push(fn),
    timer: {
      every: (ms, fn) => { f.intervals.push({ ms, fn }); return {}; },
      after(ms, fn) {
        const timer = { at: f.now + ms, fn, cancelled: false, cancel() { this.cancelled = true; } };
        f.timers.push(timer);
        return timer;
      },
    },
  };
  const env = {
    View: class {}, div: element, image: element, svg: element, v_flex: element, h_flex: element,
    Popover: { new: element }, Input: { new: element }, Button: { new: element },
    InputState: { new: () => ({ on() {}, value: () => "", set_value() {}, focus() {} }) },
    namer: () => (a) => a.address, Date: { now: () => f.now },
    localStorage: { getItem: (k) => f.data.get(k) ?? null, setItem: (k, v) => { f.writes.push(k); f.data.set(k, v); } },
    agents: () => f.rows, terminals: () => f.terms, panes: () => f.ps,
    spaces: () => [{ id: "s1", name: "One", machine: null, folder: "/project", tabs: f.ps.map((p) => ({ id: p.tab })) }, { id: "s2", name: "Two", tabs: [] }],
    machines: () => f.machines,
    focused: () => { const a = f.rows.find((a) => a.focused); return { agent: a?.address, pane: a?.pane, space: a?.space, tab: a?.tab }; },
    theme: () => ({}), settings: () => ({}), props: () => ({}),
    layout: () => ({ id: "sidebar-lists", active: f.mode }),
    shared: (k) => k === "agents.pins" ? f.pins : null,
    setShared: (k, v) => { if (k === "agents.pins") f.pins = Array.from(v); },
    setAgentOrder: (xs) => { f.order = Array.from(xs); },
    run: (...args) => f.calls.push(args), notify: (n) => f.notifications.push(n), openOverlay: (spec) => f.overlays.push(spec), closeOverlay: (id) => f.closedOverlays.push(id),
    readSessions: async (machine, request) => {
      f.requests.push({ machine, request });
      if (f.read) return f.read(machine, request);
      if (request.path) {
        const saved = f.saved.find((s) => s.path === request.path && (!request.id || s.id === request.id));
        if (!saved) throw new Error("Missing saved session");
        return saved;
      }
      return f.saved.filter((s) => s.machine === machine);
    },
    nextCommand: () => new Promise(() => {}),
  };
  // tree.js, the shared status rule, is inlined as each mod's own copy is.
  const tree = fs.readFileSync(path.join(__dirname, "tree.js"), "utf8").replace(/export (function|const) /g, "$1 ");
  const history = fs.readFileSync(path.join(__dirname, "history.js"), "utf8")
    .split("export const sessionKey")[1].split("export async function readSessions")[0]
    .replace(/export (function|const) /g, "$1 ");
  const src = tree + "const sessionKey" + history + fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
  const context = vm.createContext(env);
  vm.runInContext(src, context, { filename: "t3-focus/main.js" });
  f.mod = new context.Mod(); f.mod.init({}, cx);
  f.add = (address, status = "idle", ms = 100) => {
    const row = { address, status, seq: f.rows.length + 1, space: "s1", space_name: "One", pane: address, tab: "tab-" + address, program: { key: "pi", name: "Pi" }, focused: false };
    f.rows.push(row);
    const session = { path: "/sessions/" + address + ".jsonl", id: "id-" + address, cwd: "/project", title: address, modified: ms, directory: "/sessions", machine: address.includes("/") ? address.split("/")[0] : null };
    f.saved.push(session);
    f.terms.push({ address, cwd: "/project", status, status_ms: ms, state: "live", turn: 0, labels: { "pi.session-file": session.path, "pi.session-id": session.id } });
    f.ps.push({ pane: address, terminal: address, tab: row.tab, cwd: "/project" });
    return row;
  };
  f.render = (now = f.now) => {
    f.now = now;
    for (const timer of f.timers) if (!timer.cancelled && timer.at <= now) { timer.cancel(); timer.fn(cx); }
    f.tree = f.mod.render(cx);
    return f.tree;
  };
  f.working = () => cards(find(f.tree, "shelves"));
  f.active = () => cards(find(f.tree, "focus-list")).filter((a) => !f.working().includes(a) && !f.pins.includes(a));
  f.event = (id, name, e = {}) => {
    const node = find(f.tree, id);
    assert.ok(node, `missing ${id}`);
    assert.ok(node.handlers[name], `missing ${name} on ${id}`);
    node.handlers[name]({ position: { x: 20, y: 100 }, local_position: { x: 20, y: 100 }, bounds: { height: 82 }, modifiers: {}, ...e }, cx);
  };
  f.archive = () => f.mod.archiveKey(cx);
  f.flush = async () => { while (f.jobs.length > 1) await f.jobs.splice(1, 1)[0](cx); };
  f.showHistory = async () => { f.render(); f.event("history-header", "on_click"); await f.flush(); f.render(); };
  f.cx = cx;
  f.env = env;
  return f;
}

test("done moves to the inbox immediately; resuming starts a new Working run", () => {
  const f = fixture(), a = f.add("A", "working", 100); f.add("B", "working", 200); f.mod.workOpen = true;
  f.render(); assert.deepEqual(f.working(), ["B", "A"]);
  a.status = "done"; f.render(1100);
  assert.deepEqual(f.working(), ["B"]);
  assert.deepEqual(f.active(), ["A"]);
  assert.ok(texts(find(f.tree, "state-A")).includes("Done"));
  assert.equal(f.timers.length, 0);
  a.status = "working"; f.render(1300);
  assert.deepEqual(f.working(), ["A", "B"]);
});

test("idle and blocked move to Active without waiting for a timer", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  assert.deepEqual(f.working(), ["B"]);
  assert.deepEqual(f.active(), ["A"]);
  assert.equal(f.timers.length, 0);
  f.terms[0].turn++; f.render(2000);
  assert.deepEqual(f.active(), ["A"]);
  b.status = "blocked"; f.render(3200); assert.deepEqual(f.active(), ["B", "A"]);
  f.terms.push({ address: "kid", parent: "A", state: "live", status: "error" });
  a.status = "working"; f.render(3300); assert.deepEqual(f.active(), ["A", "B"]);
});

test("looking, seq and data order don't reshuffle; equal times go by address", () => {
  const f = fixture(), a = f.add("B", "done"); f.add("A", "done");
  f.render(); assert.deepEqual(f.order, ["A", "B"]);
  a.status = "idle"; a.focused = true; a.seq = 99; f.rows.reverse(); f.render(1500);
  assert.deepEqual(f.order, ["A", "B"]);
  for (const k of f.terms) k.labels.settled = "500:0";
  f.render(1600); f.rows.reverse(); f.render(1700); assert.deepEqual(f.order, ["A", "B"]);
});

test("a short absence and a restart keep each agent's place", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B"), c = f.add("C", "idle", 1500);
  f.render(1600); a.status = "done"; f.render(2000); f.render(4100);
  assert.deepEqual(f.order, ["A", "C", "B"]);
  f.rows = [b, c]; b.status = "working"; f.render(4200);
  f.rows = [a, b, c]; f.render(4300); assert.deepEqual(f.order, ["A", "C", "B"]);
  const g = fixture(); g.data = f.data; g.rows = f.rows; g.terms = f.terms; g.mod.init({}, g.cx);
  g.render(4400); assert.deepEqual(g.order, f.order);
  f.terms[0].state = "exited"; f.rows = [b, c]; c.status = "working"; f.render(4500);
  assert.equal(f.mod.changed.A, undefined);
});

test("a turn that ended unseen is news", () => {
  const f = fixture(), a = f.add("A", "idle", 200); f.add("B", "idle", 100);
  f.render(); assert.deepEqual(f.order, ["A", "B"]);
  f.terms[1].turn++; f.render(1500); assert.deepEqual(f.order, ["B", "A"]);
  assert.deepEqual(f.working(), []);
});

test("a pause for the person keeps the run's Working place", () => {
  const f = fixture(), a = f.add("A", "working", 100); f.add("B", "working", 200); f.mod.workOpen = true;
  f.render(); a.status = "blocked"; f.render(1100); assert.deepEqual(f.active(), ["A"]);
  a.status = "working"; f.render(9000); assert.deepEqual(f.working(), ["B", "A"]);
});

test("a reply while sub-agents work comes to Active; read, the run goes on from its start", () => {
  const f = fixture(), a = f.add("A", "idle"); f.mod.workOpen = true;
  f.render(1000); f.terms.push({ address: "kid", parent: "A", state: "live", status: "working" });
  f.render(2000); assert.deepEqual(f.working(), ["A"]);
  a.status = "done"; f.render(3000); assert.deepEqual([f.active(), f.working()], [["A"], []]);
  a.status = "idle"; f.render(4000); assert.deepEqual(f.working(), ["A"]);
  assert.equal(f.mod.changed.A.at, 2000);
});

test("a later arrival stays above an earlier finished agent", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  assert.deepEqual(f.active(), ["A"]);
  b.status = "blocked"; f.render(2000); assert.deepEqual(f.active(), ["B", "A"]);
  f.render(3100); assert.deepEqual(f.active(), ["B", "A"]);
});

test("pinned agents skip the grace: unpinned right after stopping, it's in Active", () => {
  const f = fixture(), a = f.add("A", "working"); f.pins = ["A"]; f.mod.workOpen = true;
  f.render(); a.status = "idle"; f.render(1100);
  f.pins = []; f.render(1200);
  assert.deepEqual(f.active(), ["A"]); assert.deepEqual(f.working(), []);
});


test("times read as T3's", () => {
  const f = fixture(), a = f.add("A", "working"), b = f.add("B", "working"); f.mod.workOpen = true;
  f.render(); f.render(1000 + 3720000);
  assert.ok(texts(find(f.tree, "card-A")).includes("1h 2m"));
  b.status = "idle"; f.render(4000000); f.render(4002000);
  assert.ok(texts(find(f.tree, "state-B")).includes("just now"));
  f.render(4002000 + 9 * 86400000); assert.ok(texts(find(f.tree, "state-B")).includes("9d"));
});

test("a new scope starts the history page over", () => {
  const f = fixture(); f.mod.limit = 35; f.mod.pick({ id: "s1" }, false, f.cx);
  assert.equal(f.mod.limit, 10);
});

test("a plain click on Archive leaves no sweep behind to swallow the next click", () => {
  const f = fixture(), a = f.add("A", "idle", 100); f.add("B", "idle", 50); f.add("C", "idle", 30); a.focused = true;
  f.render(); f.mod.hovered = "A"; f.render();
  f.event("archive-A", "on_mouse_down:left");
  // The button's click stops its release there: the sidebar's own mouse-up never comes.
  f.event("archive-A", "on_click"); f.render(1100);
  f.event("t3-focus-root", "on_mouse_move", { position: { x: 20, y: 300 } });
  assert.equal(f.keys, undefined, "the sidebar doesn't take the keyboard");
  f.event("card-C", "on_click");
  assert.deepEqual([f.calls.at(-1)[0], f.calls.at(-1)[1].terminal], ["agent.focus", "C"], "the next click opens the card at once");
});


test("the new-pi command launches Pi in a new tab without an explicit space override", async () => {
  const f = fixture();
  let first = true;
  f.env.nextCommand = () => first ? (first = false, Promise.resolve("new-pi")) : new Promise(() => {});
  f.jobs[0](f.cx);
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [["tab.new", { name: "Pi", argv: ["pi"] }]]);
});

test("the creation button opens the built-in agent popup", () => {
  const f = fixture(); f.render();
  f.event("focus-new-agent", "on_click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.overlays)), [{ mod: "new-menu", kind: "popup", width: 250, height: 512 }]);
});


test("machine picker reuses an existing remote space", () => {
  const f = fixture();
  f.env.spaces = () => [{ id: "local", name: "Local space", machine: null, tabs: [], active: true }, { id: "remote", name: "Remote space", machine: "tau", tabs: [] }];
  f.render(); f.event("focus-machine-tau", "on_click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [["space.select", { id: "remote" }]]);
});

test("machine picker creates a remote space when necessary and leaves offline machines alone", () => {
  const f = fixture();
  f.render(); f.event("focus-machine-tau", "on_click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [["space.new", { machine: "tau" }]]);
  f.calls = []; f.machines[1].layout = "unavailable";
  f.render(); f.event("focus-machine-tau", "on_click");
  assert.deepEqual(f.calls, []);
});

test("Local selects a local space, or creates one without inheriting the remote machine", () => {
  const f = fixture();
  f.env.spaces = () => [{ id: "remote", name: "Remote space", machine: "tau", tabs: [], active: true }];
  f.render(); f.event("focus-machine-local", "on_click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [["space.new", {}]]);
  f.calls = [];
  f.env.spaces = () => [{ id: "remote", name: "Remote space", machine: "tau", tabs: [], active: true }, { id: "local", name: "Local space", machine: null, tabs: [] }];
  f.render(); f.event("focus-machine-local", "on_click");
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [["space.select", { id: "local" }]]);
});

function presentation(name, env) {
  const folder = path.join(__dirname, "../", name);
  const load = (file) => fs.readFileSync(path.join(folder, file), "utf8").replace(/^import .*;\r?\n/gm, "");
  const context = vm.createContext({ ...env });
  vm.runInContext(load("name.js").replace("export function", "function")
    + load("main.js").replace("export default class", "globalThis.Mod = class"), context);
  const mod = new context.Mod(); mod.init();
  return mod;
}

test("Pi session names and terminal titles beat generic Pi tabs, without losing deliberate names", () => {
  const f = fixture();
  const tab = { id: "tb1", name: "Pi", named: true };
  f.env.spaces = () => [{ tabs: [tab] }];
  f.terms = [{ address: "A", labels: {} }];
  const env = vm.createContext(f.env);
  const src = fs.readFileSync(path.join(__dirname, "name.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
  vm.runInContext(src, env);
  const title = env.namer(), a = { address: "A", tab: "tb1", status: "idle", title: "π - Fix login - repo", program: { key: "pi", name: "Pi", agent: true } };
  assert.equal(title(a), "Fix login - repo");
  tab.name = "My deliberate name"; assert.equal(title(a), "My deliberate name");
  f.terms[0].labels["pi.session"] = "Session name"; assert.equal(title(a), "Session name");
  delete f.terms[0].labels["pi.session"]; tab.name = "Pi"; a.title = "Pi";
  assert.equal(title(a), "Pi · A");
});

function hasStyle(node, style, value) {
  return Boolean(node && typeof node === "object" &&
    (node.style[style]?.[0] === value || node.items.some((child) => hasStyle(child, style, value))));
}

test("tabs and pane headers hide only settled done indicators and retain other agents' status", () => {
  const f = fixture();
  const tab = { id: "tb1", name: "Pi", named: true, active: true, status: "done" };
  const p = { pane: "p1", terminal: "A", tab: "tb1", status: "done", title: "π - Fix login", program: { key: "pi", name: "Pi", agent: true } };
  const ps = [p];
  const env = { ...f.env, spaces: () => [{ id: "s1", active: true, tabs: [tab] }], panes: () => ps,
    props: () => ({ pane: "p1" }), home: () => "/home/test",
    window: () => ({}), theme: () => ({ done: "done", working: "working", blocked: "blocked" }) };
  f.terms = [{ address: "A", labels: { settled: "500:0" } }];
  const tabs = presentation("sandbox-tabs", env), pane = presentation("sandbox-pane", env);
  assert.equal(hasStyle(tabs.render(), "bg", "done"), false);
  assert.equal(hasStyle(pane.render(), "bg", "done"), false);
  assert.ok(texts(pane.render()).includes("Fix login"));
  delete f.terms[0].labels.settled;
  assert.equal(hasStyle(tabs.render(), "bg", "done"), true);
  assert.equal(hasStyle(pane.render(), "bg", "done"), true);
  f.terms[0].labels.settled = "500:0"; p.status = "working";
  assert.equal(hasStyle(tabs.render(), "text_color", "working"), true);
  assert.equal(hasStyle(pane.render(), "text_color", "working"), true);
  p.status = "blocked";
  assert.equal(hasStyle(tabs.render(), "bg", "blocked"), true);
  assert.ok(texts(pane.render()).includes("Needs you"));
  p.status = "done";
  ps.push({ ...p, pane: "p2", terminal: "B", status: "done" });
  assert.equal(hasStyle(tabs.render(), "bg", "done"), true, "an unsettled reply in the same tab still counts");
  ps[1].status = "working";
  assert.equal(hasStyle(tabs.render(), "text_color", "working"), true, "settled done does not hide a working split");
});

const plain = (value) => JSON.parse(JSON.stringify(value));
const closing = (f) => f.calls.filter(([name]) => name === "pane.close" || name === "tab.close");

test("Archive verifies the saved session before closing its tab, without deleting the chat", async () => {
  const f = fixture(), a = f.add("A", "done"); a.focused = true;
  f.render(); f.archive(); await f.flush();
  assert.deepEqual(plain(closing(f)), [["tab.close", { id: a.tab, confirmed: true }]]);
  assert.deepEqual(plain(f.requests.at(-1)), { machine: null, request: { path: f.saved[0].path, id: f.saved[0].id } });
  assert.equal(f.mod.history[0].id, f.saved[0].id);
  assert.equal(f.terms[0].labels["pi.session-id"], f.saved[0].id);
  f.rows = []; f.ps = []; f.terms[0].state = "exited";
  assert.equal(f.mod.historyRows([])[0].id, f.saved[0].id);
  assert.equal(f.mod.open, true);
});

test("Archive refuses missing identities, even when launch arguments name an older session", async () => {
  const f = fixture(), a = f.add("A"); f.terms[0].labels = {};
  f.terms[0].argv = ["pi", "--session", f.saved[0].path];
  f.mod.archive([a], f.cx); await f.flush();
  assert.equal(closing(f).length, 0);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.requests.length, 0);
});

test("working, blocked, pinned, and agents with busy descendants cannot be archived", async () => {
  for (const state of ["working", "blocked", "pinned", "child-working", "child-error"]) {
    const f = fixture(), a = f.add("A", ["working", "blocked"].includes(state) ? state : "idle");
    if (state === "pinned") f.pins = ["A"];
    if (state.startsWith("child-")) f.terms.push({ address: "kid", parent: "A", state: "live", status: state.slice(6) });
    f.mod.archive([a], f.cx); await f.flush();
    assert.equal(closing(f).length, 0, state);
  }
});

test("a new turn during validation cancels Archive without closing anything", async () => {
  const f = fixture(), a = f.add("A"); await f.flush();
  f.read = (_machine, request) => {
    assert.equal(request.path, f.saved[0].path);
    f.terms[0].turn++; a.status = "working";
    return f.saved[0];
  };
  f.mod.archive([a], f.cx); await f.flush();
  assert.equal(closing(f).length, 0);
  assert.match(f.notifications.at(-1).body, /working again/);
});

test("Archive is guarded against duplicate clicks", async () => {
  const f = fixture(), a = f.add("A"); await f.flush();
  f.mod.archive([a], f.cx); f.mod.archive([a], f.cx); await f.flush();
  assert.equal(f.requests.filter((r) => r.request.path).length, 1);
  assert.equal(closing(f).length, 1);
});

test("a failed batch validation leaves every eligible conversation open", async () => {
  const f = fixture(), a = f.add("A"), b = f.add("B");
  f.saved.pop();
  f.mod.archive([a, b], f.cx); await f.flush();
  assert.equal(closing(f).length, 0);
});

test("a saved-session ID mismatch prevents closure", async () => {
  const f = fixture(), a = f.add("A"); f.saved[0].id = "different-id";
  f.mod.archive([a], f.cx); await f.flush();
  assert.equal(closing(f).length, 0);
});

test("archiving a split leaves the other pane alone", async () => {
  const f = fixture(), a = f.add("A"); f.add("B"); f.ps[1].tab = a.tab;
  f.mod.archive([a], f.cx); await f.flush();
  assert.deepEqual(plain(closing(f)), [["pane.close", { pane: "A" }]]);
});

test("archiving every split closes that tab once", async () => {
  const f = fixture(), a = f.add("A"), b = f.add("B"); f.ps[1].tab = a.tab;
  f.mod.archive([a, b], f.cx); await f.flush();
  assert.deepEqual(plain(closing(f)), [["tab.close", { id: a.tab, confirmed: true }]]);
});

test("ordinary closure appears in History and survives a fresh mod instance", async () => {
  const f = fixture(); f.add("A"); await f.showHistory();
  assert.equal(f.mod.historyRows([]).length, 0);
  f.rows = []; f.ps = [];
  assert.equal(f.mod.historyRows([]).length, 1);
  const g = fixture(); g.data = f.data; g.mod.init({}, g.cx);
  assert.equal(g.mod.historyRows([])[0].path, f.saved[0].path);
});

test("History suppresses open sessions by exact identity, separately for each machine", async () => {
  const f = fixture(); f.add("A"); await f.flush();
  f.mod.history.push({ ...f.saved[0], machine: "tau" });
  assert.deepEqual(plain(f.mod.historyRows([]).map((s) => s.machine)), ["tau"]);
});

test("project filtering uses live folders, not a space's original folder", async () => {
  const f = fixture(); f.add("A"); await f.showHistory(); f.rows = [];
  f.env.spaces = () => [{ id: "s1", machine: null, folder: "/old-home", tabs: [{ id: f.ps[0].tab }] }];
  assert.equal(f.mod.historyRows(["s1"]).length, 1);
  assert.equal(f.mod.historyRows(["other-space"]).length, 0);
});

test("history clicks reopen the exact saved session in the existing project's space", async () => {
  const f = fixture(); f.add("A"); f.rows = []; await f.showHistory();
  f.event("history-" + JSON.stringify([null, f.saved[0].path]), "on_click");
  await f.flush();
  assert.deepEqual(plain(f.calls), [["tab.new", { space: "s1", folder: "/project", name: "Pi", argv: ["pi", "--session", f.saved[0].path] }]]);
});

test("remote resumption validates on tau and starts Pi there in its original folder", async () => {
  const f = fixture(); f.add("tau/A"); f.rows = []; await f.flush();
  f.env.spaces = () => [{ id: "tau/space", machine: "tau", folder: "/project", tabs: [] }];
  f.mod.resume(f.saved[0], f.cx); await f.flush();
  assert.equal(f.requests.at(-1).machine, "tau");
  assert.deepEqual(plain(f.calls), [["tab.new", { space: "tau/space", folder: "/project", name: "Pi", argv: ["pi", "--session", f.saved[0].path] }]]);
});

test("resuming creates the original machine/project rather than inheriting the current machine", async () => {
  for (const machine of [null, "tau"]) {
    const f = fixture(); f.add(machine ? "tau/A" : "A"); f.rows = []; f.ps = []; await f.flush();
    f.env.spaces = () => [{ id: "unrelated", machine: machine ? null : "tau", folder: "/elsewhere", tabs: [] }];
    f.mod.resume(f.saved[0], f.cx); await f.flush();
    assert.deepEqual(plain(f.calls), [["space.new", { machine, folder: "/project", argv: ["pi", "--session", f.saved[0].path] }]]);
  }
});

test("rapid history clicks launch only one Pi", async () => {
  const f = fixture(); f.add("A"); f.rows = []; await f.flush();
  f.mod.resume(f.saved[0], f.cx); f.mod.resume(f.saved[0], f.cx); await f.flush();
  assert.equal(f.calls.filter(([name]) => name === "tab.new").length, 1);
  assert.equal(f.mod.historyRows([]).length, 0);
});

test("an already-open history session focuses its Pi without launching another", () => {
  const f = fixture(); f.add("A");
  f.mod.resume(f.saved[0], f.cx);
  assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "A" }]]);
});

test("offline and missing sessions do not launch Pi or discard history", async () => {
  const f = fixture(); f.add("tau/A"); f.rows = []; await f.showHistory();
  f.machines[1].layout = "unavailable";
  f.mod.resume(f.saved[0], f.cx); await f.flush(); assert.equal(f.calls.length, 0);
  f.machines[1].layout = "ready";
  f.read = () => { throw new Error("Session file is missing"); };
  f.mod.resume(f.saved[0], f.cx); await f.flush();
  assert.equal(f.calls.length, 0);
  assert.match(f.notifications.at(-1).body, /missing/);
  assert.equal(f.mod.history.length, 1);
});

test("a session opened while validation runs is focused instead of duplicated", async () => {
  const f = fixture(), a = f.add("A"); f.rows = []; await f.flush();
  f.read = () => { f.rows = [a]; return f.saved[0]; };
  f.mod.resume(f.saved[0], f.cx); await f.flush();
  assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "A" }]]);
});

test("the archive command and shortcut use the new action name", async () => {
  const f = fixture(), a = f.add("A"); a.focused = true; f.render();
  let first = true;
  f.env.nextCommand = () => first ? (first = false, Promise.resolve("archive")) : new Promise(() => {});
  f.jobs[0](f.cx); await new Promise(setImmediate); await f.flush();
  assert.equal(closing(f).length, 1);
  const keys = JSON.parse(fs.readFileSync(path.join(__dirname, "../../keys.json"), "utf8"));
  assert.equal(keys["layout:sandbox"]["ctrl-shift-s"], "t3-focus.archive");
});

function conversationMenu(f, target) {
  const jobs = f.jobs.length;
  f.env.props = () => ({ conversationMenu: target, overlay: "test-menu" });
  const menu = new f.mod.constructor();
  menu.init({}, f.cx);
  assert.equal(f.jobs.length, jobs, "the menu starts no background jobs or command consumer");
  f.mod = menu;
  f.render();
  return menu;
}

test("right-click opens a context menu on inbox, Working and Pinned cards without selecting them", () => {
  for (const kind of ["inbox", "working", "pinned"]) {
    const f = fixture(); f.add("A", kind === "working" ? "working" : "idle");
    f.mod.workOpen = true; if (kind === "pinned") f.pins = ["A"];
    f.render(); f.event("card-A", "on_mouse_down:right");
    assert.deepEqual(plain(f.overlays), [{ mod: "t3-focus", kind: "popup", width: 260, props: { conversationMenu: { address: "A", title: "A" } } }]);
    assert.equal(f.calls.length, 0);
  }
});

test("History entries have the same right-click entry point, including offline sessions", async () => {
  const f = fixture(); f.add("tau/A"); f.rows = []; await f.showHistory(); f.machines[1].layout = "unavailable";
  f.render();
  f.event("history-" + JSON.stringify(["tau", f.saved[0].path]), "on_mouse_down:right");
  assert.deepEqual(plain(f.overlays[0].props), plain({ conversationMenu: { session: f.mod.history[0] } }));
  assert.equal(f.calls.length, 0);
});

test("Copy session link uses a private file URI and never launches or uploads anything", () => {
  const f = fixture(); f.add("A"); conversationMenu(f, { address: "A", title: "A" });
  f.event("conversation-menu-link", "on_click");
  assert.equal(f.clipboard, "file:///sessions/A.jsonl");
  assert.equal(new URL(f.clipboard).protocol, "file:");
  assert.deepEqual(f.closedOverlays, ["test-menu"]);
  assert.equal(f.requests.length, 0); assert.equal(f.calls.length, 0);
  assert.equal(f.clipboardWrites, 1);
});

test("session links escape spaces, Unicode, fragments, percent signs, quotes and parentheses", () => {
  const f = fixture(); f.add("A");
  f.terms[0].labels["pi.session-file"] = "/sessions/π #?% '().jsonl";
  conversationMenu(f, { address: "A", title: "A" });
  f.event("conversation-menu-link", "on_click");
  assert.equal(f.clipboard, "file:///sessions/%CF%80%20%23%3F%25%20%27%28%29.jsonl");
});

test("remote history references retain machine, project, session identity and file link while offline", () => {
  const f = fixture(); f.add("tau/A"); const session = { ...f.saved[0], title: "Fix\n  deployment" };
  f.rows = []; f.machines[1].layout = "unavailable";
  const menu = conversationMenu(f, { session });
  assert.equal(menu.menuItems()[menu.menuAt].id, "reference");
  f.event("conversation-menu-open", "on_click"); assert.equal(f.calls.length, 0);
  f.event("conversation-menu-reference", "on_click");
  assert.equal(f.clipboard, "Conversation: Fix deployment\nSession link: file://tau/sessions/tau/A.jsonl\nSession ID: id-tau/A\nMachine: tau\nProject: /project");
  assert.equal(f.requests.length, 0);
});

test("metadata updates while a menu is open are used instead of the old session", () => {
  const f = fixture(); f.add("A"); conversationMenu(f, { address: "A", title: "A" });
  f.terms[0].labels["pi.session-file"] = "/sessions/new-session.jsonl";
  f.terms[0].labels["pi.session-id"] = "new-session";
  f.event("conversation-menu-link", "on_click");
  assert.equal(f.clipboard, "file:///sessions/new-session.jsonl");
});

test("an untracked live Pi can share its terminal reference but not an invented session link", () => {
  const f = fixture(); f.add("A", "working"); f.terms[0].labels = {};
  const menu = conversationMenu(f, { address: "A", title: "Work" });
  assert.equal(menu.menuItems().find((i) => i.id === "link").enabled, false);
  assert.equal(menu.menuItems().find((i) => i.id === "id").enabled, false);
  f.event("conversation-menu-link", "on_click"); assert.equal(f.clipboard, undefined);
  f.event("conversation-menu-reference", "on_click");
  assert.equal(f.clipboard, "Conversation: Work\nMachine: Local\nProject: /project\nLive terminal: A");
  assert.equal(f.calls.length, 0);
});

test("other agents do not inherit a previous Pi program's session identity", () => {
  const f = fixture(); f.add("A"); f.rows[0].program = { key: "claude", name: "Claude" };
  const menu = conversationMenu(f, { address: "A", title: "Claude" });
  assert.equal(menu.menuItems().find((i) => i.id === "link").enabled, false);
  assert.equal(find(f.tree, "conversation-menu-archive"), null);
  f.event("conversation-menu-address", "on_click"); assert.equal(f.clipboard, "A");
});

test("session ID, project path and terminal address can be copied independently", () => {
  for (const [id, expected] of [["id", "id-A"], ["project", "/project"], ["address", "A"]]) {
    const f = fixture(); f.add("A"); conversationMenu(f, { address: "A", title: "A" });
    f.event("conversation-menu-" + id, "on_click"); assert.equal(f.clipboard, expected);
  }
});

test("context-menu pinning updates the existing shared pins", () => {
  const f = fixture(); f.add("A"); f.pins = ["B"];
  const menu = conversationMenu(f, { address: "A", title: "A" });
  f.event("conversation-menu-pin", "on_click"); assert.deepEqual(f.pins, ["B", "A"]);
  f.render(); assert.equal(menu.menuItems().find((i) => i.id === "pin").label, "Unpin conversation");
  f.event("conversation-menu-pin", "on_click"); assert.deepEqual(f.pins, ["B"]);
});

test("Archive is absent for busy, pinned and unidentified chats", () => {
  for (const kind of ["working", "blocked", "pinned", "unknown", "child"]) {
    const f = fixture(); f.add("A", ["working", "blocked"].includes(kind) ? kind : "idle");
    if (kind === "pinned") f.pins = ["A"];
    if (kind === "unknown") f.terms[0].labels = {};
    if (kind === "child") f.terms.push({ address: "kid", parent: "A", state: "live", status: "working" });
    const menu = conversationMenu(f, { address: "A", title: "A" });
    assert.equal(find(f.tree, "conversation-menu-archive"), null, kind);
    assert.equal(f.calls.length, 0, kind);
  }
});

test("context actions target the right-clicked conversation, never the focused one", () => {
  const f = fixture(); f.add("A").focused = true; f.add("B");
  conversationMenu(f, { address: "B", title: "B" });
  f.event("conversation-menu-open", "on_click");
  assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "B" }]]);
  f.calls = []; f.event("conversation-menu-archive", "on_click");
  assert.equal(f.calls[0][0], "t3-focus.archive:" + encodeURIComponent(JSON.stringify("B")));
});

test("History Resume routes through the sidebar, not a task destroyed with the popup", () => {
  const f = fixture(); f.add("A"); f.rows = [];
  conversationMenu(f, { session: f.saved[0] });
  f.event("conversation-menu-open", "on_click");
  assert.equal(f.calls[0][0], "t3-focus.resume:" + encodeURIComponent(JSON.stringify(f.saved[0])));
  assert.deepEqual(f.closedOverlays, ["test-menu"]);
});

test("keyboard navigation skips unavailable actions and Escape closes the menu", () => {
  const f = fixture(); f.add("A", "working"); f.terms[0].labels = {};
  const menu = conversationMenu(f, { address: "A", title: "A" });
  f.event("conversation-menu", "on_key_down", { key: "down" });
  assert.equal(menu.menuItems()[menu.menuAt].id, "reference");
  f.event("conversation-menu", "on_key_down", { key: "down" });
  assert.equal(menu.menuItems()[menu.menuAt].id, "address");
  f.event("conversation-menu", "on_key_down", { key: "enter" }); assert.equal(f.clipboard, "A");
  f.event("conversation-menu", "on_key_down", { key: "escape" }); assert.equal(f.closedOverlays.at(-1), "test-menu");
});

test("a conversation ending while its menu is open cannot trigger stale actions", () => {
  const f = fixture(); f.add("A"); const menu = conversationMenu(f, { address: "A", title: "A" });
  f.rows = [];
  menu.chooseMenu(0, f.cx);
  assert.equal(f.calls.length, 0); assert.equal(f.clipboard, undefined);
});

test("context Archive revalidates status and an invalid command does not kill the command loop", async () => {
  const f = fixture(); f.add("A", "working");
  const commands = ["archive:" + encodeURIComponent(JSON.stringify("A")), "resume:%ZZ", "new-pi"];
  f.env.nextCommand = () => commands.length ? Promise.resolve(commands.shift()) : new Promise(() => {});
  f.jobs[0](f.cx); await new Promise(setImmediate); await f.flush();
  assert.equal(closing(f).length, 0);
  assert.ok(f.notifications.some((n) => n.title === "Couldn't open conversation action"));
  assert.ok(f.calls.some(([name]) => name === "tab.new"));
});

test("unsupported entries do not poison a batch of saved idle Pi chats", async () => {
  const f = fixture(), good = f.add("Pi"), claude = f.add("Claude"), unknown = f.add("Unknown"), busy = f.add("Busy", "working");
  claude.program = { key: "claude", name: "Claude" };
  f.terms[2].labels = {};
  f.mod.archive([claude, good, unknown, busy], f.cx); await f.flush();
  assert.deepEqual(plain(closing(f)), [["tab.close", { id: good.tab, confirmed: true }]]);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].request.path, f.saved[0].path);
  assert.equal(f.notifications.length, 0);
});

test("unsupported chats have neither hover nor shortcut nor drag-to-History Archive actions", async () => {
  for (const kind of ["claude", "unknown", "working", "blocked", "pinned", "child"]) {
    const f = fixture(), a = f.add("A", ["working", "blocked"].includes(kind) ? kind : "idle");
    a.focused = true;
    if (kind === "claude") a.program = { key: "claude" };
    if (kind === "unknown") f.terms[0].labels = {};
    if (kind === "pinned") f.pins = ["A"];
    if (kind === "child") f.terms.push({ address: "kid", parent: "A", state: "live", status: "working" });
    f.mod.hovered = "A"; f.render();
    assert.equal(find(f.tree, "archive-A"), null, kind);
    f.archive(); await f.flush();
    f.event("card-A", "on_mouse_down:left");
    f.event("t3-focus-root", "on_mouse_move", { position: { x: 20, y: 125 } });
    f.render();
    f.event("history-header", "on_mouse_move"); f.render();
    assert.equal(find(f.tree, "history-placeholder"), null, kind);
    assert.equal(find(f.tree, "badge-archive"), null, kind);
    f.event("t3-focus-root", "on_mouse_up:left"); await f.flush();
    assert.equal(closing(f).length, 0, kind);
    if (kind === "pinned") assert.deepEqual(f.pins, ["A"]);
  }
});

test("a sweep skips unsupported chats between eligible conversations", async () => {
  const f = fixture(); f.add("A"); const other = f.add("Claude"); f.add("B");
  other.program = { key: "claude" };
  f.mod.hovered = "A"; f.render();
  f.event("archive-A", "on_mouse_down:left");
  f.event("t3-focus-root", "on_mouse_move", { position: { x: 20, y: 125 } });
  f.event("card-B", "on_mouse_move"); f.render();
  f.event("t3-focus-root", "on_mouse_up:left"); await f.flush();
  assert.deepEqual(plain(closing(f)), [
    ["tab.close", { id: "tab-A", confirmed: true }],
    ["tab.close", { id: "tab-B", confirmed: true }],
  ]);
  assert.equal(f.notifications.length, 0);
});

test("switching sessions during Archive validation leaves the new chat open", async () => {
  const f = fixture(), a = f.add("A");
  f.read = () => {
    f.terms[0].labels["pi.session-file"] = "/sessions/new.jsonl";
    f.terms[0].labels["pi.session-id"] = "new";
    return f.saved[0];
  };
  f.mod.archive([a], f.cx); await f.flush();
  assert.equal(closing(f).length, 0);
  assert.match(f.notifications.at(-1).body, /switched sessions/);
});

test("History opens with its event context, stays idle on UI timers and avoids unchanged cache writes", async () => {
  const f = fixture(); f.add("A"); await f.flush();
  assert.equal(f.requests.length, 0, "closed History does not scan on startup");
  f.tree = f.mod.render({ ...f.cx, spawn() { throw new Error("stale render context"); } });
  f.event("history-header", "on_click"); await f.flush();
  assert.equal(f.requests.length, 2);
  for (const timer of f.intervals) timer.fn(f.cx);
  await f.flush();
  assert.equal(f.requests.length, 2, "UI timers never rescan sessions");
  f.render(); f.event("history-header", "on_click");
  await f.showHistory();
  assert.equal(f.requests.length, 4, "reopening refreshes online machines");
  assert.equal(f.writes.filter((key) => key === "history").length, 1);
});
