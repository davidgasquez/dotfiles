// The sandbox sidebar is Herdr's own: shipped spaces, a near-copy of the shipped agents list (sandbox-agents) and the
// brand row (sandbox-chrome, checked in check-chrome.cjs). Also the title rule (name.js) of sandbox-tabs and sandbox-pane.
// Run: node --test config/mods/sandbox-agents/check-sidebar.cjs
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

const SHIPPED = path.join(process.env.HERDR_APP_HOME || path.join(require("node:os").homedir(), ".config/herdr-app"));
const shipped = (file) => fs.existsSync(path.join(SHIPPED, file)) ? fs.readFileSync(path.join(SHIPPED, file), "utf8") : null;
const CONFIG = path.join(MODS, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(CONFIG, file), "utf8"));
const lineDiff = (from, to) => {
  const a = from.split("\n"), b = to.split("\n");
  return { removed: a.filter((l) => !b.includes(l)), added: b.filter((l) => !a.includes(l)) };
};

// --- stock parity ---

test("sandbox-agents is the shipped agents list plus shared pins and a right-click menu", (t) => {
  const stock = shipped("mods/agents/main.js");
  if (!stock) return t.skip("no shipped agents mod here");
  assert.deepEqual(lineDiff(stock, fs.readFileSync(path.join(MODS, "sandbox-agents/main.js"), "utf8")), {
    removed: [
      '    this.pins = JSON.parse(localStorage.getItem("pins") ?? "[]");',
      "    this.pins = pins;",
      '    localStorage.setItem("pins", JSON.stringify(pins));',
      '                .on_click(() => openOverlay({ mod: "agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } }))',
    ],
    added: [
      "  // Shared with conversation-menu, which pins and unpins too.",
      "  get pins() {",
      '    return shared("agents.pins") ?? [];',
      '    setShared("agents.pins", pins);',
      '        .on_mouse_down("right", (_e, cx) => {',
      '          openOverlay({ mod: "conversation-menu", kind: "popup", width: 260, props: { target: { terminal: a.address, title: a.title } } });',
      '                .on_click(() => openOverlay({ mod: "sandbox-agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } }))',
    ],
  });
});

test("the sidebar is the shipped one with only the brand row and agents list swapped for their clones", (t) => {
  const stock = shipped("layouts/main.json");
  if (!stock) return t.skip("no shipped main layout here");
  const ours = json("layouts/sandbox.json");
  const clones = { "sandbox-chrome": "workspace-chrome", "sandbox-agents": "agents" };
  const swapped = JSON.parse(JSON.stringify(ours.children[0]), (k, v) => (k === "mod" ? clones[v] ?? v : v));
  assert.deepEqual(swapped, JSON.parse(stock).children[0]);
  assert.equal("terminal_menu" in ours, false);
  assert.equal(json("keys.json")["layout:sandbox"]["ctrl-shift-a"], "sandbox-chrome.new-pi");
  assert.equal(fs.existsSync(path.join(MODS, "sandbox-toolbar")), false);
});

// --- sandbox-agents deltas ---

test("pins are the shared agents.pins: kept from before, toggled on hover, dropped when their agent ends", () => {
  const f = agentsFixture(); f.add("A"); f.add("B");
  f.shared.set("agents.pins", ["B", "tau/t9"]); f.render();
  assert.deepEqual(f.order, ["B", "A"]);
  assert.ok(find(f.tree, "pinned"));
  f.event("ag-A", "on_hover", true); f.render();
  f.event("pin-A", "on_click");
  assert.deepEqual(f.shared.get("agents.pins"), ["B", "tau/t9", "A"]);
  assert.equal(f.data.has("pins"), false);
  f.terms[1].state = "finished"; f.rows.splice(1, 1); f.render();
  assert.deepEqual(f.shared.get("agents.pins"), ["tau/t9", "A"], "a machine not heard from keeps its pins");
});

test("right-click opens conversation-menu (Fork) for the clicked chat row, never the focused one, running nothing", () => {
  const f = agentsFixture(); f.add("A").focused = true; f.add("tau/t7");
  f.render(); f.event("ag-tau/t7", "on_mouse_down:right");
  assert.deepEqual(f.overlays, [{ mod: "conversation-menu", kind: "popup", width: 260, props: { target: { terminal: "tau/t7", title: "π - Fix tau/t7" } } }]);
  assert.deepEqual(f.calls, []);
});

test("the sort menu is the shipped one, opened as this clone", () => {
  const f = agentsFixture(); f.add("A"); f.render();
  f.event("ag-sort", "on_click");
  assert.deepEqual(f.overlays, [{ mod: "sandbox-agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } }]);
});

// --- name.js and the tabs/pane headers, outside the sidebar ---

test("terminal titles beat generic Pi tabs without losing deliberate names or trusting stale bridge labels", () => {
  const f = fixture();
  const tab = { id: "tb1", name: "Pi", named: true };
  f.spaces = [{ tabs: [tab] }];
  f.terms = [{ address: "A", labels: {} }];
  for (const mod of ["sandbox-tabs", "sandbox-pane"]) {
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
