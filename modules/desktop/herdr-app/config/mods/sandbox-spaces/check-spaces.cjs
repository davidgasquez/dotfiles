const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const helpers = fs.readFileSync(path.join(__dirname, "projects.js"), "utf8").replace(/^export /gm, "");
const plain = (value) => JSON.parse(JSON.stringify(value));
const project = { name: "nixos", folder: "/etc/nixos", machine: null };
const key = JSON.stringify([null, "/etc/nixos"]);
const id = "project-" + key;
const plus = "project-terminal-" + key;

function element() {
  const node = { key: null, items: [], handlers: {}, style: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (key === "child") node.items.push(args[0]);
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
const find = (node, id) => !node || typeof node !== "object" ? null
  : node.key === id ? node : node.items.reduce((hit, c) => hit ?? find(c, id), null);
const texts = (node) => typeof node === "string" ? [node] : node && typeof node === "object" ? node.items.flatMap(texts) : [];

function fixture(options = {}) {
  const f = { sp: [], ps: [], projects: [project], sidebar: 268, calls: [], jobs: [], execs: [], overlays: [],
    machines: [{ name: null, layout: "ready" }, { name: "tau", layout: "ready" }], ...options };
  f.cx = { notify() {}, stop_propagation() { f.stopped = true; },
    spawn: (fn) => f.jobs.push(fn), timer: { every() {} } };
  const env = {
    View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
    spaces: () => f.sp, panes: () => f.ps, machines: () => f.machines, props: () => f.nullProps ? null : ({ projects: f.projects }),
    run: (...args) => f.calls.push(plain(args)), openOverlay: (spec) => f.overlays.push(plain(spec)),
    theme: () => ({}), shared: () => null, setShared() {},
    watchFolder: () => new Promise(() => {}), window: () => ({ active: false }),
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: f.sidebar } }] }),
    localStorage: { getItem: () => null, setItem() {} },
    hc: async () => ({ code: 0, stdout: JSON.stringify({ machines: [{ name: "tau", state: "connected" }] }), stderr: "" }),
    exec: async (...args) => { f.execs.push(args); return f.hostname ? f.hostname() : { code: 0, stdout: "zephyr\n", stderr: "" }; },
  };
  const context = vm.createContext(env);
  vm.runInContext(helpers + source.replace(/^import .*;\r?\n/gm, "")
    .replace(/^export function/gm, "function").replace("export default class", "globalThis.Mod = class"), context);
  f.helpers = context;
  f.mod = new context.Mod();
  f.mod.init({}, f.cx);
  f.settle = async () => { while (f.jobs.length) await f.jobs.shift()(f.cx); };
  f.render = () => (f.tree = f.mod.render(f.cx));
  f.event = (id, event = "on_click") => {
    const node = find(f.render(), id);
    assert.ok(node, "missing " + id);
    assert.ok(node.handlers[event], "missing " + event);
    node.handlers[event]({}, f.cx);
  };
  return f;
}

test("git tracking, live-space rows and worktree ordering retain shipped behavior", (t) => {
  const file = path.join(process.env.HERDR_APP_HOME || path.join(os.homedir(), ".config/herdr-app"), "mods/spaces/main.js");
  if (!fs.existsSync(file)) return t.skip("no shipped spaces mod here");
  const stock = fs.readFileSync(file, "utf8");
  assert.equal(source.slice(source.indexOf("  checkNew("), source.indexOf("  // Spaces in order")),
    stock.slice(stock.indexOf("  checkNew("), stock.indexOf("  // Spaces in order")));
  assert.equal(source.slice(source.indexOf("  ordered()"), source.indexOf("    const pinned =")),
    stock.slice(stock.indexOf("  ordered()"), stock.indexOf("    return out;")));
  assert.equal(source.slice(source.indexOf("  // Only what's unusual")), stock.slice(stock.indexOf("  // Only what's unusual")));
});

test("hostname is asked once locally; remote headings and fallback stay", async () => {
  const f = fixture(); await f.settle(); f.render();
  assert.ok(texts(find(f.tree, "machine-local")).includes("zephyr"));
  assert.ok(texts(find(f.tree, "machine-tau")).includes("tau"));
  assert.deepEqual(f.execs, [["hostname"]]);
  for (const hostname of [async () => { throw Error("missing"); }, async () => ({ code: 1 }), async () => ({ code: 0, stdout: " \n" })]) {
    const g = fixture({ hostname }); await g.settle(); g.render();
    assert.ok(texts(find(g.tree, "machine-local")).includes("This computer"));
  }
});

test("projects are normalized, deduplicated per machine and validated", () => {
  const { configuredProjects: projects } = fixture().helpers;
  assert.deepEqual(plain(projects([{ folder: "/etc/nixos/" }, project, { folder: "/etc/nixos", machine: "tau" }, { folder: "/" } ])),
    [project, { ...project, machine: "tau" }, { name: "/", folder: "/", machine: null }]);
  assert.deepEqual(plain(projects()), []);
  for (const invalid of [null, {}, [{ folder: "~" }], [{ folder: "/x", machine: "" }], [{ folder: "/x", name: 5 }]])
    assert.throws(() => projects(invalid));
});

test("an empty project stays visible and starts exactly one terminal at its configured folder", () => {
  const f = fixture(); f.render();
  assert.ok(texts(find(f.tree, id)).includes("nixos"));
  assert.deepEqual(f.calls, [], "render never starts anything");
  f.event(id);
  assert.deepEqual(f.calls, [["space.new", { name: "nixos", folder: "/etc/nixos" }]]);
});

test("plus creates a terminal for an unopened project without bubbling to the row", () => {
  const f = fixture(); f.event(plus);
  assert.equal(f.stopped, true);
  assert.deepEqual(f.calls, [["space.new", { name: "nixos", folder: "/etc/nixos" }]]);
  for (const event of ["on_mouse_down:left", "on_mouse_up:left"]) {
    f.stopped = false; f.event(plus, event); assert.equal(f.stopped, true);
  }
  assert.equal(f.calls.length, 1);
});

test("a running project is shown once; row selects it and plus opens another tab at the fixed root", () => {
  const f = fixture({ sp: [{ id: "s1", name: "nixos", folder: "/etc/nixos", machine: null, active: true, tabs: [{ id: "tb1" }] }],
    ps: [{ tab: "tb1", cwd: "/elsewhere" }] });
  f.render();
  assert.equal(find(f.tree, "space-s1"), null);
  f.event(id); f.event(plus);
  assert.deepEqual(f.calls, [["space.select", { id: "s1" }], ["tab.new", { space: "s1", folder: "/etc/nixos" }]]);
  f.event(id, "on_mouse_down:right");
  assert.equal(f.overlays[0].props.target.id, "s1");
});

test("after the last terminal closes the shortcut remains and reopens the project", () => {
  const f = fixture({ sp: [{ id: "s1", folder: "/etc/nixos/", tabs: [] }] });
  f.event(id); f.sp = []; f.event(id);
  assert.deepEqual(f.calls, [["space.select", { id: "s1" }], ["space.new", { name: "nixos", folder: "/etc/nixos" }]]);
});

test("matches by machine and stored folder first, then live pane folder; never by name alone", () => {
  const { projectSpace } = fixture().helpers;
  const sp = [{ id: "wrong", name: "nixos", folder: "/home/test", tabs: [{ id: "t1" }] },
    { id: "remote", folder: "/etc/nixos", machine: "tau", tabs: [] },
    { id: "root", folder: "/etc/nixos/", tabs: [] }];
  assert.equal(projectSpace(project, sp, [{ tab: "t1", cwd: "/etc/nixos" }]).id, "root");
  assert.equal(projectSpace(project, sp.slice(0, 2), [{ tab: "t1", cwd: "/etc/nixos" }]).id, "wrong");
  assert.equal(projectSpace(project, sp.slice(0, 2), []), undefined);
});

test("remote shortcuts stay visible offline, target only their machine, and use remote tabs when running", () => {
  const p = { ...project, machine: "tau" }, remote = JSON.stringify(["tau", "/etc/nixos"]);
  const f = fixture({ projects: [p], machines: [{ name: null, layout: "ready" }, { name: "tau", layout: "unavailable" }] });
  f.event("project-" + remote); assert.deepEqual(f.calls, []);
  f.machines[1].layout = "ready"; f.event("project-" + remote);
  assert.deepEqual(f.calls, [["space.new", { name: "nixos", folder: "/etc/nixos", machine: "tau" }]]);
  f.sp = [{ id: "tau/s1", folder: "/etc/nixos", machine: "tau", tabs: [] }];
  f.event("project-terminal-" + remote);
  assert.deepEqual(f.calls[1], ["tab.new", { space: "tau/s1", folder: "/etc/nixos" }]);
});

test("loading local layouts never spawn a terminal", () => {
  const f = fixture({ machines: [{ name: null, layout: "loading" }] });
  f.event(id); f.event(plus); assert.deepEqual(f.calls, []);
});

test("collapsed rail keeps a clickable project shortcut", () => {
  const f = fixture({ sidebar: 44 }); f.event(id);
  assert.equal(find(f.tree, plus), null);
  assert.deepEqual(f.calls, [["space.new", { name: "nixos", folder: "/etc/nixos" }]]);
});

test("projects follow live props and configured ordering without starting terminals", () => {
  const f = fixture(); f.render(); f.projects = [{ name: "Other", folder: "/tmp" }, project];
  const rows = plain(f.mod.ordered()).filter((r) => r.project).map((r) => r.project.name);
  assert.deepEqual(rows, ["Other", "nixos"]);
  f.projects = []; assert.equal(find(f.render(), id), null);
  assert.deepEqual(f.calls, []);
});

test("a standalone mod check works without props", () => {
  const f = fixture({ nullProps: true });
  assert.doesNotThrow(() => f.render());
  assert.deepEqual(f.calls, []);
});

test("sandbox layout configures nixos as a persistent project shortcut", () => {
  const layout = JSON.parse(fs.readFileSync(path.join(__dirname, "../../layouts/sandbox.json"), "utf8"));
  const spaces = layout.children[0].children.find((n) => n.id === "sidebar-lists").children.find((n) => n.id === "spaces");
  assert.equal(spaces.content.mod, "sandbox-spaces");
  assert.deepEqual(spaces.content.props.projects, [{ name: "nixos", folder: "/etc/nixos" }]);
});
