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
  const f = { now: 1000, rows: [], terms: [], order: [], calls: [], jobs: [], timers: [], intervals: [], writes: [], data: new Map(), pins: [], mode: "focus", notifications: [], overlays: [], closedOverlays: [], ps: [], machines: [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }] };
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
    nextCommand: () => new Promise(() => {}),
  };
  // tree.js, the shared status rule, is inlined as each mod's own copy is.
  const tree = fs.readFileSync(path.join(__dirname, "tree.js"), "utf8").replace(/export (function|const) /g, "$1 ");
  const src = tree + fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
  const context = vm.createContext(env);
  vm.runInContext(src, context, { filename: "t3-focus/main.js" });
  f.mod = new context.Mod(); f.mod.init({}, cx);
  f.add = (address, status = "idle", ms = 100) => {
    const row = { address, status, seq: f.rows.length + 1, space: "s1", space_name: "One", pane: address, tab: "tab-" + address, program: { key: "pi", name: "Pi" }, focused: false };
    f.rows.push(row);
    f.terms.push({ address, cwd: "/project", status, status_ms: ms, state: "live", turn: 0, labels: {} });
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
  f.flush = async () => { while (f.jobs.length > 1) await f.jobs.splice(1, 1)[0](cx); };
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

test("space filtering remains independent of the removed history feature", () => {
  const f = fixture(); f.add("A"); f.add("B").space = "s2";
  f.mod.pick({ id: "s1" }, false, f.cx); f.render();
  assert.deepEqual(f.order, ["A"]);
  f.mod.pick({ id: "s2" }, true, f.cx); f.render();
  assert.deepEqual(f.order, ["A", "B"]);
  f.mod.pick({ id: null }, false, f.cx); f.render();
  assert.deepEqual(f.order, ["A", "B"]);
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

test("terminal titles beat generic Pi tabs without losing deliberate names or trusting stale bridge labels", () => {
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
  f.terms[0].labels["pi.session"] = "Old session name"; assert.equal(title(a), "My deliberate name");
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

test("live conversation references need no Pi extension, locally or remotely", () => {
  for (const address of ["A", "tau/A"]) {
    const f = fixture(); f.add(address);
    const menu = conversationMenu(f, { address, title: "Work" });
    assert.deepEqual(plain(menu.menuItems().map((i) => i.id)), ["open", "reference", "address", "project", "pin"]);
    f.event("conversation-menu-reference", "on_click");
    assert.equal(f.clipboard, `Conversation: Work\nMachine: ${address.includes("/") ? "tau" : "Local"}\nProject: /project\nLive terminal: ${address}`);
    assert.deepEqual(f.closedOverlays, ["test-menu"]);
    assert.equal(f.calls.length, 0);
  }
});

test("project paths and terminal addresses can be copied independently", () => {
  for (const [id, expected] of [["project", "/project"], ["address", "A"]]) {
    const f = fixture(); f.add("A"); conversationMenu(f, { address: "A" });
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

test("context actions target the right-clicked conversation, never the focused one", () => {
  const f = fixture(); f.add("A").focused = true; f.add("B");
  conversationMenu(f, { address: "B", title: "B" });
  f.event("conversation-menu-open", "on_click");
  assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "B" }]]);
});

test("keyboard navigation skips unavailable actions and Escape closes the menu", () => {
  const f = fixture(); f.add("A"); delete f.terms[0].cwd;
  const menu = conversationMenu(f, { address: "A", title: "A" });
  for (let i = 0; i < 3; i++) f.event("conversation-menu", "on_key_down", { key: "down" });
  assert.equal(menu.menuItems()[menu.menuAt].id, "pin");
  f.event("conversation-menu", "on_key_down", { key: "escape" });
  assert.equal(f.closedOverlays.at(-1), "test-menu");
});

test("a conversation ending while its menu is open cannot trigger stale actions", () => {
  const f = fixture(); f.add("A"); const menu = conversationMenu(f, { address: "A", title: "A" });
  f.rows = [];
  menu.chooseMenu(0, f.cx);
  assert.equal(f.calls.length, 0); assert.equal(f.clipboard, undefined);
});

test("History and Archive stay absent even with old persisted state and bridge labels", async () => {
  const f = fixture(); f.add("A").focused = true;
  f.data.set("open", "true"); f.data.set("history", JSON.stringify([{ path: "/old.jsonl" }]));
  f.terms[0].labels = { "pi.session-file": "/old.jsonl", "pi.session-id": "old" };
  f.mod.init({}, f.cx); f.render();
  assert.equal(find(f.tree, "history"), null);
  assert.equal(find(f.tree, "archive-A"), null);
  for (const timer of f.intervals) timer.fn(f.cx);
  assert.equal(f.jobs.length, 2, "only command consumers, no session scans");
  assert.ok(!f.writes.includes("history"));
  const keys = JSON.parse(fs.readFileSync(path.join(__dirname, "../../keys.json"), "utf8"));
  assert.equal(keys["layout:sandbox"]["ctrl-shift-s"], undefined);
  assert.equal(keys["layout:sandbox"]["ctrl-shift-a"], "t3-focus.new-pi");
  const commands = ["archive", "settle", "resume:%ZZ", "new-pi"];
  f.env.nextCommand = () => commands.length ? Promise.resolve(commands.shift()) : new Promise(() => {});
  f.jobs[0](f.cx); await new Promise(setImmediate);
  assert.deepEqual(plain(f.calls), [["tab.new", { name: "Pi", argv: ["pi"] }]]);
});

function lift(f, address) {
  f.render();
  f.event("card-" + address, "on_mouse_down:left");
  f.event("t3-focus-root", "on_mouse_move", { position: { x: 20, y: 150 } });
  f.render();
}

test("dragging still pins and unpins live agents without closing anything", () => {
  const f = fixture(); f.add("A").focused = true; f.add("B");
  lift(f, "B"); f.event("pinned", "on_mouse_move"); f.render();
  f.event("t3-focus-root", "on_mouse_up:left");
  assert.deepEqual(f.pins, ["B"]);
  lift(f, "B"); f.event("active", "on_mouse_move"); f.render();
  f.event("t3-focus-root", "on_mouse_up:left");
  assert.deepEqual(f.pins, []);
  assert.ok(!f.calls.some(([name]) => name.endsWith(".close")));
  assert.equal(f.mod.drag, null);
});

test("Escape cancels a drag and a working card cannot be lifted", () => {
  const f = fixture(); f.add("A"); f.add("B", "working"); f.mod.workOpen = true;
  lift(f, "A"); f.event("pinned", "on_mouse_move"); f.render();
  f.event("t3-focus-root", "on_key_down", { keystroke: "escape" });
  assert.equal(f.mod.drag, null); assert.deepEqual(f.pins, []);
  lift(f, "B");
  assert.equal(f.mod.drag, null);
});
