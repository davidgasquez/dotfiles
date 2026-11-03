// Checks the sidebar's brand row (sandbox-chrome): the shipped workspace-chrome plus History and the new-pi key.
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
      else if (key === "child") node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.key = args[0];
      else if (key.startsWith("on_")) node.handlers[key === "on_mouse_down" ? `${key}:${args[0]}` : key] = key === "on_mouse_down" ? args[1] : args[0];
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

function texts(node) {
  if (typeof node === "string") return [node];
  return node && typeof node === "object" ? node.items.flatMap(texts) : [];
}

const plain = (x) => JSON.parse(JSON.stringify(x));

function chrome({ platform = "linux", width = 268, footer = false, commands = [] } = {}) {
  const f = { calls: [], shared: {}, jobs: [] };
  const env = {
    View: class {}, div: element, image: element, svg: element, h_flex: element, v_flex: element,
    theme: () => ({}), props: () => (footer ? { footer: true } : {}), window: () => ({ platform }),
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: width } }] }),
    updates: () => ({ app: { ready: false } }),
    shared: (k) => f.shared[k], setShared: (k, v) => { f.shared[k] = v; },
    run: (...args) => f.calls.push(args),
    nextCommand: () => (commands.length ? Promise.resolve(commands.shift()) : new Promise(() => {})),
    // The brand must not read the active space any more.
    spaces: () => [{ id: "s1", name: "nixos", active: true }],
  };
  const src = fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
  vm.runInContext(src, vm.createContext(env), { filename: "sandbox-chrome/main.js" });
  f.mod = new env.Mod();
  f.mod.init({}, { spawn: (fn) => f.jobs.push(fn) });
  f.tree = f.mod.render();
  return f;
}

test("the brand row shows Herdr, not the active space's name", () => {
  const f = chrome();
  assert.ok(texts(f.tree).includes("Herdr"));
  assert.equal(texts(f.tree).includes("nixos"), false);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "main.js"), "utf8"), /spaces\(\)/);
});

test("sandbox-chrome is the shipped workspace-chrome plus a History button and the new-pi key", (t) => {
  const file = path.join(process.env.HERDR_APP_HOME || path.join(require("node:os").homedir(), ".config/herdr-app"), "mods/workspace-chrome/main.js");
  if (!fs.existsSync(file)) return t.skip("no shipped workspace-chrome here");
  const stock = fs.readFileSync(file, "utf8").split("mods/workspace-chrome/").join("mods/sandbox-chrome/").split("\n");
  const ours = fs.readFileSync(path.join(__dirname, "main.js"), "utf8").split("\n");
  assert.deepEqual(stock.filter((l) => !ours.includes(l)), ['import { theme, run, props, window, shared, setShared, updates, layout } from "herdr";']);
  assert.deepEqual(ours.filter((l) => !stock.includes(l)), [
    'import { theme, run, props, window, shared, setShared, updates, layout, nextCommand } from "herdr";',
    "  init(_props, cx) {", "    if (props()?.footer) return;", "    cx.spawn(async (cx) => {", "      for (;;) {",
    "        const command = await nextCommand();", "        cx.notify();",
    '        if (command === "new-pi") run("tab.new", { name: "Pi", argv: ["pi"] });', "      }", "    });",
    '      .when(!collapsed, el => el.child(this.button("history", svg("mods/sandbox-chrome/clock.svg").size(15), () => run("mod.open", { name: "pi-history" }))))',
  ]);
});

test("the brand row keeps the shipped search and toggle, with History between them", () => {
  const f = chrome();
  assert.deepEqual(f.tree.items.map((n) => n.key).filter(Boolean), ["search", "history", "sidebar-toggle"]);
  find(f.tree, "search").handlers.on_click();
  find(f.tree, "history").handlers.on_click();
  assert.deepEqual(plain(f.calls), [["mod.open", { name: "picker" }], ["mod.open", { name: "pi-history" }]]);
  assert.equal(find(chrome({ width: 44 }).tree, "history"), null);
});

test("the new-pi key starts Pi in a new tab; a stale loop stops first; the footer doesn't listen", async () => {
  const f = chrome({ commands: ["other", "new-pi"] });
  assert.equal(f.jobs.length, 1);
  f.jobs[0]({ notify() {} }); await new Promise(setImmediate);
  assert.deepEqual(plain(f.calls), [["tab.new", { name: "Pi", argv: ["pi"] }]]);
  const stale = chrome({ commands: ["new-pi"] });
  await assert.rejects(stale.jobs[0]({ notify() { throw new Error("view closed"); } }), /view closed/);
  assert.deepEqual(stale.calls, []);
  assert.equal(chrome({ footer: true }).jobs.length, 0);
});

test("the sidebar toggle folds to the rail and stops the window drag", () => {
  const f = chrome();
  const toggle = find(f.tree, "sidebar-toggle");
  assert.ok(toggle.handlers["on_mouse_down:left"]);
  toggle.handlers.on_click();
  assert.deepEqual(plain(f.calls), [["layout.resize", { id: "sidebar", px: 44 }]]);
  assert.equal(f.shared["sidebar.width"], 268);
});

test("macOS keeps room for the traffic lights; its rail leaves the row to them", () => {
  const mac = chrome({ platform: "macos" });
  assert.deepEqual(mac.tree.style.pl, [76], "the last pl wins");
  assert.ok(texts(mac.tree).includes("Herdr"));
  const macRail = chrome({ platform: "macos", width: 76 });
  assert.equal(find(macRail.tree, "sidebar-toggle"), null);
  assert.equal(texts(macRail.tree).includes("Herdr"), false);
  const rail = chrome({ width: 44 });
  assert.ok(find(rail.tree, "sidebar-toggle"));
  assert.equal(texts(rail.tree).includes("Herdr"), false);
});

test("the footer keeps Settings and Add machine", () => {
  const f = chrome({ footer: true });
  find(f.tree, "settings").handlers.on_click();
  find(f.tree, "machine").handlers.on_click();
  assert.deepEqual(plain(f.calls), [["app.settings"], ["mod.open", { name: "machine-add" }]]);
});
