// Checks the sidebar's brand row and footer (sandbox-chrome): static Herdr branding, no search of its own.
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

function chrome({ platform = "linux", width = 268, footer = false } = {}) {
  const f = { calls: [], shared: {} };
  const env = {
    View: class {}, div: element, image: element, svg: element, h_flex: element, v_flex: element,
    theme: () => ({}), props: () => (footer ? { footer: true } : {}), window: () => ({ platform }),
    layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: width } }] }),
    updates: () => ({ app: { ready: false } }),
    shared: (k) => f.shared[k], setShared: (k, v) => { f.shared[k] = v; },
    run: (...args) => f.calls.push(args),
    // The brand must not read the active space any more.
    spaces: () => [{ id: "s1", name: "nixos", active: true }],
  };
  const src = fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class");
  vm.runInContext(src, vm.createContext(env), { filename: "sandbox-chrome/main.js" });
  f.mod = new env.Mod();
  f.tree = f.mod.render();
  return f;
}

test("the brand row shows Herdr, not the active space's name", () => {
  const f = chrome();
  assert.ok(texts(f.tree).includes("Herdr"));
  assert.equal(texts(f.tree).includes("nixos"), false);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "main.js"), "utf8"), /spaces\(\)/);
});

test("the brand row has no search of its own; the toolbar below owns it", () => {
  const f = chrome();
  assert.equal(find(f.tree, "search"), null);
  assert.ok(find(f.tree, "sidebar-toggle"));
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
