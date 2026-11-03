// The sandbox sidebar: sandbox-agents (shipped agents, grouped or flat), sandbox-toolbar, and the title rule
// (name.js) that sandbox-tabs and sandbox-pane share. Run: node --test config/mods/sandbox-agents/check-sidebar.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const MODS = path.join(__dirname, "..");
const plain = (value) => JSON.parse(JSON.stringify(value));

// A stand-in for gpui-kit elements: records ids, children, handlers and styles.
function element(src) {
  const node = { key: null, src, items: [], handlers: {}, style: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (["child", "content", "trigger"].includes(key)) node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.key = args[0];
      else if (key === "on_mouse_down" || key === "on_mouse_up") node.handlers[key + ":" + args[0]] = args[1];
      else if (key.startsWith("on_")) node.handlers[key] = args[0];
      else node.style[key] = args;
      return proxy;
    };
  } });
  return proxy;
}
const walk = (node, fn) => { if (node && typeof node === "object") { fn(node); node.items.forEach((c) => walk(c, fn)); } };
function find(tree, id) { let hit = null; walk(tree, (n) => { if (!hit && n.key === id) hit = n; }); return hit; }
const ids = (tree) => { const out = []; walk(tree, (n) => n.key && out.push(n.key)); return out; };
const texts = (node) => typeof node === "string" ? [node] : node && typeof node === "object" ? node.items.flatMap(texts) : [];
const has = (tree, fn) => { let hit = false; walk(tree, (n) => { hit ||= fn(n); }); return hit; };

const THEME = { working: "working", blocked: "blocked", done: "done", idle: "idle", dim: "dim", foreground: "fg", muted: "muted" };

function fixture() {
  const f = { rows: [], terms: [], calls: [], overlays: [], order: [], jobs: [], shared: new Map(), data: new Map(), sidebar: 268,
    machines: [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }],
    spaces: [{ id: "s1", name: "One", machine: null, active: true, tabs: [] }, { id: "s2", name: "Two", machine: null, tabs: [] }] };
  f.cx = {
    notify() { f.notified = true; }, stop_propagation() {}, spawn: (fn) => f.jobs.push(fn),
    timer: { every() {}, after() {} }, focus_handle: () => ({ focus() {} }),
  };
  f.env = {
    View: class {}, div: element, image: element, svg: element, v_flex: element, h_flex: element, Popover: { new: element },
    agents: () => f.rows, terminals: () => f.terms, panes: () => [], spaces: () => f.spaces, machines: () => f.machines,
    focused: () => ({ agent: f.rows.find((a) => a.focused)?.address }),
    run: (...args) => f.calls.push(plain(args)), openOverlay: (spec) => f.overlays.push(plain(spec)), closeOverlay: () => {},
    theme: () => THEME, settings: () => ({}), props: () => f.props ?? {}, window: () => ({ platform: "linux" }), home: () => "/home/test",
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: f.sidebar } }] }),
    shared: (k) => f.shared.get(k) ?? null, setShared: (k, v) => f.shared.set(k, plain(v)),
    setAgentOrder: (xs) => { f.order = plain(xs); },
    nextCommand: () => (f.commands?.length ? Promise.resolve(f.commands.shift()) : new Promise(() => {})),
    localStorage: { getItem: (k) => f.data.get(k) ?? null, setItem: (k, v) => f.data.set(k, v) },
  };
  f.add = (address, status = "idle", space = "s1") => {
    const tab = "tab-" + address;
    f.spaces.find((s) => s.id === space).tabs.push({ id: tab, name: String(f.rows.length + 1), named: false });
    const row = { address, status, space, space_name: f.spaces.find((s) => s.id === space).name, tab, pane: "p-" + address,
      title: "π - Fix " + address, seq: f.rows.length + 1, focused: false, program: { key: "pi", name: "Pi", agent: true, icon: null } };
    f.rows.push(row);
    f.terms.push({ address, status, state: "live", labels: {} });
    return row;
  };
  f.load = (name, props) => {
    const load = (file) => fs.readFileSync(path.join(MODS, name, file), "utf8").replace(/^import .*;\r?\n/gm, "");
    const context = vm.createContext({ ...f.env, props: () => props ?? f.env.props() });
    const names = fs.existsSync(path.join(MODS, name, "name.js")) ? load("name.js").replace("export function", "function") : "";
    vm.runInContext(names + load("main.js").replace("export default class", "globalThis.Mod = class"), context, { filename: name + "/main.js" });
    const mod = new context.Mod();
    mod.init(props ?? {}, f.cx);
    return mod;
  };
  f.render = (mod = f.mod) => (f.tree = mod.render(f.cx));
  f.event = (id, name, e = {}) => {
    const node = find(f.tree, id);
    assert.ok(node, "missing " + id);
    assert.ok(node.handlers[name], "missing " + name + " on " + id);
    node.handlers[name]({ modifiers: {}, ...e }, f.cx);
  };
  return f;
}
const agentsFixture = () => { const f = fixture(); f.mod = f.load("sandbox-agents"); return f; };
const toolbarFixture = () => { const f = fixture(); f.mod = f.load("sandbox-toolbar"); return f; };

// --- sandbox-agents ---

test("grouped by space is the default, with no priority sections, and the order never follows status", () => {
  const f = agentsFixture(); f.add("A", "working"); f.add("B", "blocked"); f.add("C", "done", "s2");
  f.render();
  const heads = ids(f.tree).filter((k) => /^(sp|sec|pinned)-?/.test(k));
  assert.deepEqual(heads, ["sp-s1", "sp-s2"]);
  assert.deepEqual(f.order, ["A", "B", "C"]);
  for (const s of ["Working", "Done", "Idle"]) assert.equal(texts(f.tree).includes(s), false, "no " + s + " section");
  f.rows[0].status = "idle"; f.rows[2].status = "blocked"; f.render();
  assert.deepEqual(f.order, ["A", "B", "C"], "stable: no recency churn");
});

test("flat lists pins, then agents() order, naming each row's space; an unknown or old sort reads as grouped", () => {
  const f = agentsFixture(); f.add("A"); f.add("B", "working", "s2"); f.add("C");
  f.shared.set("agents.pins", ["C"]);
  f.shared.set("sandbox-agents.sort", "flat"); f.render();
  assert.equal(ids(f.tree).some((k) => k.startsWith("sp-") || k === "pinned"), false);
  assert.deepEqual(f.order, ["C", "A", "B"]);
  assert.ok(texts(find(f.tree, "ag-B")).includes("Two"));
  assert.ok(texts(find(f.tree, "ag-B")).includes("\u00b7 Fix B"));
  f.shared.set("sandbox-agents.sort", "priority"); f.render();
  assert.deepEqual(ids(f.tree).filter((k) => /^(sp-|sec-|pinned)/.test(k)), ["pinned", "sp-s1", "sp-s2"]);
});

test("the sort menu offers only grouped and flat, under its own shared key", () => {
  const f = agentsFixture(); f.add("A"); f.render();
  f.event("ag-sort", "on_click");
  assert.deepEqual(f.overlays, [{ mod: "sandbox-agents", kind: "popup", width: 200, height: 110, props: { sortMenu: true } }]);
  const menu = f.load("sandbox-agents", { sortMenu: true, overlay: "o1" });
  f.render(menu);
  assert.deepEqual(ids(f.tree).filter((k) => k.startsWith("sort-")), ["sort-grouped", "sort-flat"]);
  f.event("sort-flat", "on_click");
  assert.equal(f.shared.get("sandbox-agents.sort"), "flat");
  assert.equal(f.shared.get("agents.sort"), undefined, "the shipped agents list's sort is left alone");
});

test("titles come from name.js: Pi's own title, π prefix dropped; grouped rows don't repeat the space", () => {
  const f = agentsFixture(); f.add("A"); f.render();
  assert.ok(texts(find(f.tree, "ag-A")).includes("Fix A"));
  assert.equal(texts(find(f.tree, "ag-A")).includes("One"), false);
});

test("sub-agents show depth first with branches; a click peeks without focusing; folding hides them", () => {
  const f = agentsFixture(); f.add("A");
  f.terms.push(
    { address: "child", parent: "A", state: "live", status: "working", name: "luna-hosts" },
    { address: "nested", parent: "child", state: "live", status: "error", template: "reviewer" },
    { address: "exited", parent: "A", state: "finished", status: "done" },
    { address: "other", parent: "B", state: "live", status: "working" },
  );
  f.render();
  assert.deepEqual(plain(f.mod.tree(f.terms, "A").map((s) => [s.t.address, s.lines])), [["child", ["└"]], ["nested", ["", "└"]]]);
  assert.ok(texts(find(f.tree, "sub-child")).includes("luna-hosts"));
  assert.ok(texts(find(f.tree, "sub-nested")).includes("reviewer"));
  assert.equal(find(f.tree, "sub-exited"), null);
  assert.equal(find(f.tree, "sub-other"), null);
  f.event("sub-nested", "on_click");
  assert.deepEqual(f.calls, [["terminal.peek", { terminal: "nested" }]]);
  f.calls = [];
  f.event("fold-A", "on_click"); f.render();
  assert.equal(find(f.tree, "sub-child"), null);
  assert.deepEqual(f.calls, []);
});

test("status icons: working spins, blocked needs you, done is a dot, idle a ring", () => {
  const f = agentsFixture(); f.add("W", "working"); f.add("B", "blocked"); f.add("D", "done"); f.add("I", "idle");
  f.render();
  assert.ok(has(find(f.tree, "ag-W"), (n) => n.style.spin?.[0] === 900 && /spinner\.svg$/.test(n.src)));
  assert.ok(texts(find(f.tree, "ag-B")).includes("Needs you"));
  assert.ok(has(find(f.tree, "ag-D"), (n) => n.style.bg?.[0] === "done"));
  assert.ok(has(find(f.tree, "ag-I"), (n) => n.style.border_color?.[0] === "idle"));
});

test("pins are the shared agents.pins: kept from before, toggled on hover, dropped when their agent ends", () => {
  const f = agentsFixture(); f.add("A"); f.add("B");
  f.shared.set("agents.pins", ["B", "tau/t9"]); f.render();
  assert.deepEqual(f.order, ["B", "A"]);
  assert.ok(find(f.tree, "pinned"));
  f.event("ag-A", "on_hover", true); f.render();
  f.event("pin-A", "on_click");
  assert.deepEqual(f.shared.get("agents.pins"), ["B", "tau/t9", "A"]);
  f.terms[1].state = "finished"; f.rows.splice(1, 1); f.render();
  assert.deepEqual(f.shared.get("agents.pins"), ["tau/t9", "A"], "a machine not heard from keeps its pins");
});

test("right-click opens conversation-menu for that agent, without running anything", () => {
  const f = agentsFixture(); f.add("A").focused = true; f.add("tau/t7");
  f.render(); f.event("ag-tau/t7", "on_mouse_down:right");
  assert.deepEqual(f.overlays, [{ mod: "conversation-menu", kind: "popup", width: 260, props: { target: { terminal: "tau/t7", title: "Fix tau/t7" } } }]);
  assert.deepEqual(f.calls, []);
});

// --- sandbox-toolbar ---

const controls = (f) => find(f.tree, "toolbar").items.map((n) => n.key ?? n.items.find((c) => c && typeof c === "object" && c.key)?.key);

test("one toolbar row: search, Pi history, machine, new agent; no duplicate search or new space", () => {
  const f = toolbarFixture(); f.render();
  assert.deepEqual(controls(f), ["toolbar-search", "toolbar-history", "toolbar-machine", "toolbar-new-agent"]);
  assert.equal(ids(f.tree).filter((k) => /search/.test(k)).length, 1);
  assert.equal(ids(f.tree).some((k) => /space/.test(k)), false);
  f.event("toolbar-search", "on_click");
  f.event("toolbar-history", "on_click");
  assert.deepEqual(f.calls, [["mod.open", { name: "picker" }], ["mod.open", { name: "pi-history" }]]);
  f.event("toolbar-new-agent", "on_click");
  assert.deepEqual(f.overlays, [{ mod: "new-menu", kind: "popup", width: 250, height: 512 }]);
});

test("the new-pi command starts Pi in a new tab of the shown space", async () => {
  const f = fixture(); f.commands = ["other", "new-pi"]; f.mod = f.load("sandbox-toolbar");
  assert.equal(f.jobs.length, 1);
  f.jobs[0](f.cx); await new Promise(setImmediate);
  assert.deepEqual(f.calls, [["tab.new", { name: "Pi", argv: ["pi"] }]]);
});

test("a stale toolbar command loop stops before launching Pi", async () => {
  const f = fixture(); f.commands = ["new-pi"]; f.load("sandbox-toolbar");
  const stale = { notify() { throw new Error("view closed"); } };
  await assert.rejects(f.jobs[0](stale), /view closed/);
  assert.deepEqual(f.calls, []);
});

test("the machine picker reuses a machine's space, creates one when none, and leaves offline machines alone", () => {
  const f = toolbarFixture();
  f.spaces.push({ id: "r1", name: "Remote", machine: "tau", tabs: [] });
  f.render(); f.event("toolbar-machine-tau", "on_click");
  assert.deepEqual(f.calls, [["space.select", { id: "r1" }]]);
  f.calls = []; f.spaces.pop(); f.render(); f.event("toolbar-machine-tau", "on_click");
  assert.deepEqual(f.calls, [["space.new", { machine: "tau" }]]);
  f.calls = []; f.machines[1].layout = "unavailable"; f.render(); f.event("toolbar-machine-tau", "on_click");
  assert.deepEqual(f.calls, []);
  f.spaces = [{ id: "r1", name: "Remote", machine: "tau", active: true, tabs: [] }];
  f.render(); f.event("toolbar-machine-local", "on_click");
  assert.deepEqual(f.calls, [["space.new", {}]], "Local doesn't inherit the shown remote machine");
  assert.ok(texts(find(f.tree, "toolbar-machine")).includes("tau"));
});

test("on the rail the toolbar keeps only new agent", () => {
  const f = toolbarFixture(); f.sidebar = 44; f.render();
  assert.deepEqual(ids(f.tree), ["toolbar", "toolbar-new-agent"]);
});

// --- name.js and the tabs/pane headers (moved from the former t3-focus checks) ---

test("terminal titles beat generic Pi tabs without losing deliberate names or trusting stale bridge labels", () => {
  const f = fixture();
  const tab = { id: "tb1", name: "Pi", named: true };
  f.spaces = [{ tabs: [tab] }];
  f.terms = [{ address: "A", labels: {} }];
  for (const mod of ["sandbox-agents", "sandbox-tabs", "sandbox-pane"]) {
    const context = vm.createContext({ ...f.env });
    vm.runInContext(fs.readFileSync(path.join(MODS, mod, "name.js"), "utf8").replace(/^import .*;\r?\n/gm, "").replace("export function", "function"), context);
    const title = context.namer(), a = { address: "A", tab: "tb1", status: "idle", title: "π - Fix login - repo", program: { key: "pi", name: "Pi", agent: true } };
    tab.name = "Pi"; assert.equal(title(a), "Fix login - repo", mod);
    tab.name = "My deliberate name"; assert.equal(title(a), "My deliberate name");
    f.terms[0].labels["pi.session"] = "Old session name"; assert.equal(title(a), "My deliberate name");
    delete f.terms[0].labels["pi.session"]; tab.name = "Pi"; a.title = "Pi";
    assert.equal(title(a), "Pi · A");
  }
});

test("tabs and pane headers hide only settled done indicators and retain other agents' status", () => {
  const f = fixture();
  const tab = { id: "tb1", name: "Pi", named: true, active: true, status: "done" };
  const p = { pane: "p1", terminal: "A", tab: "tb1", status: "done", title: "π - Fix login", program: { key: "pi", name: "Pi", agent: true } };
  const ps = [p];
  Object.assign(f.env, { spaces: () => [{ id: "s1", active: true, tabs: [tab] }], panes: () => ps, props: () => ({ pane: "p1" }) });
  f.terms = [{ address: "A", labels: { settled: "500:0" } }];
  const tabs = f.load("sandbox-tabs"), pane = f.load("sandbox-pane");
  const bg = (mod, color) => has(mod.render(f.cx), (n) => n.style.bg?.[0] === color);
  const fg = (mod, color) => has(mod.render(f.cx), (n) => n.style.text_color?.[0] === color);
  assert.equal(bg(tabs, "done"), false);
  assert.equal(bg(pane, "done"), false);
  assert.ok(texts(pane.render(f.cx)).includes("Fix login"));
  delete f.terms[0].labels.settled;
  assert.equal(bg(tabs, "done"), true);
  assert.equal(bg(pane, "done"), true);
  f.terms[0].labels.settled = "500:0"; p.status = "working";
  assert.equal(fg(tabs, "working"), true);
  assert.equal(fg(pane, "working"), true);
  p.status = "blocked";
  assert.equal(bg(tabs, "blocked"), true);
  assert.ok(texts(pane.render(f.cx)).includes("Needs you"));
  p.status = "done";
  ps.push({ ...p, pane: "p2", terminal: "B", status: "done" });
  assert.equal(bg(tabs, "done"), true, "an unsettled reply in the same tab still counts");
  ps[1].status = "working";
  assert.equal(fg(tabs, "working"), true, "settled done does not hide a working split");
});
