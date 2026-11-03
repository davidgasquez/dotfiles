// node --test check-menu.cjs: the conversation menu and its Pi fork helper, with Herdr stubbed.
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
      else if (key === "on_mouse_down") node.handlers[`on_mouse_down:${args[0]}`] = args[1];
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
const texts = (node) => typeof node === "string" ? [node] : node && typeof node === "object" ? node.items.flatMap(texts) : [];
const plain = (v) => JSON.parse(JSON.stringify(v));
const source = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");

function fixture({ target = { terminal: "A", title: "Work" }, tab } = {}) {
  const f = { rows: [], terms: [], ps: [], pins: [], calls: [], hcCalls: [], notes: [], closed: [], jobs: [], hcResult: { code: 0, stdout: "{}", stderr: "" } };
  const cx = {
    notify() {}, stop_propagation() {},
    write_to_clipboard(v) { f.clipboard = v; },
    focus_handle: () => ({ focus() {} }),
    spawn: (fn) => { f.jobs.push(fn(cx)); },
  };
  f.env = {
    View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
    agents: () => f.rows, terminals: () => f.terms, panes: () => f.ps,
    run: (...a) => f.calls.push(a), notify: (n) => f.notes.push(n), theme: () => ({}),
    shared: (k) => (k === "agents.pins" ? f.pins : null), setShared: (k, v) => { if (k === "agents.pins") f.pins = Array.from(v); },
    props: () => ({ target, tab, overlay: "menu-1" }), closeOverlay: (id) => f.closed.push(id),
    hc: async (args) => { f.hcCalls.push(args); if (f.hcResult instanceof Error) throw f.hcResult; return f.hcResult; },
  };
  const strip = (s) => s.replace(/^import .*;\r?\n/gm, "").replace(/export (const|function|async function) /g, "$1 ");
  const src = strip(source("pi-fork.js")) + strip(source("main.js")).replace("export default class", "globalThis.Menu = class")
    + "\nglobalThis.helper = { forkState, forkConversation, FORK_KEY };";
  const ctx = vm.createContext(f.env);
  vm.runInContext(src, ctx, { filename: "conversation-menu" });
  f.helper = ctx.helper;
  f.add = (address, { app = "pi", status = "idle", raw = status, focused = false } = {}) => {
    f.rows.push({ address, app, status, title: "π - " + address, focused });
    f.terms.push({ address, state: "live", status: raw, cwd: "/start" });
    f.ps.push({ pane: "p-" + address, terminal: address, cwd: "/project" });
  };
  f.open = () => { f.menu = new ctx.Menu(); f.menu.init({}, cx); f.render(); return f.menu; };
  f.render = () => (f.tree = f.menu.render(cx));
  f.ids = () => plain(f.menu.items().map((i) => i.id));
  f.item = (id) => f.menu.items().find((i) => i.id === id);
  f.click = async (id) => {
    const node = find(f.tree, "conversation-menu-" + id);
    assert.ok(node, "missing " + id);
    node.handlers.on_click({}, cx);
    await Promise.all(f.jobs.splice(0));
  };
  f.key = async (key) => { find(f.tree, "conversation-menu").handlers.on_key_down({ key }, cx); await Promise.all(f.jobs.splice(0)); f.render(); };
  return f;
}

test("an idle, done or errored Pi forks with the native key in exactly the clicked terminal, local or remote", async () => {
  for (const [address, raw] of [["A", "idle"], ["tau/t7", "done"], ["A", "error"]]) {
    const f = fixture({ target: { terminal: address, title: "Work" } });
    f.add("other", { focused: true }); f.add(address, { raw, status: raw === "error" ? "idle" : raw });
    f.open();
    assert.deepEqual(f.ids(), ["open", "fork", "reference", "address", "project", "pin"]);
    assert.equal(f.item("fork").enabled, true);
    await f.click("fork");
    assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: address }]]);
    assert.deepEqual(plain(f.hcCalls), [["keys", address, "ctrl+alt+shift+f"]]);
    assert.deepEqual(f.closed, ["menu-1"]);
    assert.equal(f.notes.length, 0);
  }
});

test("terminal right-click preserves pane actions and forks the clicked remote Pi", async () => {
  const f = fixture({ tab: "pane", target: { terminal: "tau/t7", pane: "tau/p7" } });
  f.add("other", { focused: true }); f.add("tau/t7"); f.open();
  assert.deepEqual(f.ids(), ["split-right", "split-down", "zoom", "fork", "right-click", "close"]);
  await f.click("fork");
  assert.deepEqual(plain(f.hcCalls), [["keys", "tau/t7", "ctrl+alt+shift+f"]]);
  assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "tau/t7" }]]);
});

test("ordinary shells keep the native terminal menu without Fork", async () => {
  const f = fixture({ tab: "pane", target: { terminal: "shell", pane: "p-shell" } });
  f.terms = [{ address: "shell", state: "live" }]; f.open();
  assert.deepEqual(f.ids(), ["split-right", "split-down", "zoom", "right-click", "close"]);
  for (const id of ["split-right", "split-down", "zoom", "right-click", "close"]) await f.click(id);
  assert.deepEqual(plain(f.calls), [
    ["pane.split", { direction: "right", pane: "p-shell" }],
    ["pane.split", { direction: "down", pane: "p-shell" }],
    ["pane.zoom", { pane: "p-shell" }],
    ["terminal.right_click", { terminal: "shell", to: "program" }],
    ["pane.close", { pane: "p-shell" }],
  ]);
  assert.deepEqual(f.hcCalls, []);
});

test("terminal menu keeps send-back and right-click routing; busy Pis cannot fork", async () => {
  const f = fixture({ tab: "pane", target: { terminal: "A", pane: "pA" } });
  f.add("A", { status: "working" });
  f.terms[0].parent = "parent"; f.terms[0].labels = { "herdr.right-click": "program" };
  f.terms.push({ address: "parent", name: "Parent" }); f.open();
  assert.equal(f.item("fork").enabled, false);
  await f.click("fork"); assert.equal(f.hcCalls.length, 0);
  assert.equal(f.item("right-click").label, "Use Herdr right-click menu");
  await f.click("right-click"); await f.click("park");
  assert.deepEqual(plain(f.calls), [
    ["terminal.right_click", { terminal: "A", to: "menu" }],
    ["terminal.park", { terminal: "A" }],
  ]);
});

test("sandbox terminal right-click is wired to the conversation menu", () => {
  const layout = JSON.parse(fs.readFileSync(path.join(__dirname, "../../layouts/sandbox.json"), "utf8"));
  assert.equal(layout.terminal_menu, "conversation-menu");
});

test("the fork hint tells the in-place, native picker semantics and that the original stays saved", () => {
  const f = fixture(); f.add("A"); f.open();
  const hint = find(f.tree, "conversation-menu-fork").style.tooltip[0];
  assert.match(hint, /Pi's message picker/);
  assert.match(hint, /in place/);
  assert.match(hint, /original stays saved/);
  assert.match(hint, /replaces any unsent draft/);
  assert.match(hint, /Esc cancels and keeps the draft/);
});

test("working or blocked Pi: Fork is disabled with the reason and nothing is pressed", async () => {
  for (const [status, raw] of [["working", "working"], ["blocked", "blocked"], ["idle", "working"], ["working", "idle"]]) {
    const f = fixture(); f.add("A", { status, raw }); f.open();
    assert.equal(f.item("fork").enabled, false);
    assert.equal(f.item("fork").hint, "Pi is busy. Fork when it is idle.");
    await f.click("fork");
    assert.equal(f.hcCalls.length, 0); assert.equal(f.calls.length, 0); assert.equal(f.closed.length, 0);
  }
});

test("other agents get no Fork item; their menu is otherwise the same", () => {
  const f = fixture(); f.add("A", { app: "claude-code" }); f.open();
  assert.deepEqual(f.ids(), ["open", "reference", "address", "project", "pin"]);
  assert.equal(f.helper.forkState("A").why, "Only Pi conversations can be forked here.");
});

test("the state is rechecked at click time: a Pi that started working or ended is not pressed", async () => {
  const f = fixture(); f.add("A"); f.open();
  f.terms[0].status = "working";
  f.render(); await f.click("fork");
  await assert.rejects(f.helper.forkConversation("A"), /busy/);
  assert.equal(f.hcCalls.length, 0);
  f.terms[0].status = "idle"; f.terms[0].state = "finished";
  await assert.rejects(f.helper.forkConversation("A"), /no longer open/);
  assert.equal(f.hcCalls.length, 0); assert.equal(f.calls.length, 0);
});

test("a menu whose conversation ended offers nothing", async () => {
  const f = fixture(); f.add("A"); f.open();
  f.rows = []; f.render();
  assert.deepEqual(f.ids(), []);
  assert.ok(texts(f.tree).includes("This conversation is no longer open."));
  f.menu.choose(0, {});
  assert.equal(f.calls.length + f.hcCalls.length, 0);
});

test("hc failures and rejections are reported once and close the menu", async () => {
  for (const failure of [{ code: 3, stdout: "", stderr: "not_found" }, new Error("cannot start hc")]) {
    const f = fixture(); f.add("A"); f.open(); f.hcResult = failure;
    await f.click("fork");
    assert.equal(f.hcCalls.length, 1);
    assert.equal(f.notes.length, 1);
    assert.equal(f.notes[0].level, "error");
    assert.match(f.notes[0].body, failure instanceof Error ? /cannot start hc/ : /not_found/);
    assert.deepEqual(f.closed, ["menu-1"]);
  }
});

test("open, copies and pins act on the right-clicked conversation, never the focused one", async () => {
  const f = fixture({ target: { terminal: "tau/t7", title: "Fix  login" } });
  f.add("A", { focused: true }); f.add("tau/t7"); f.pins = ["B"]; f.open();
  await f.click("open"); assert.deepEqual(plain(f.calls), [["agent.focus", { terminal: "tau/t7" }]]);
  await f.click("reference");
  assert.equal(f.clipboard, "Conversation: Fix login\nMachine: tau\nProject: /project\nLive terminal: tau/t7");
  await f.click("address"); assert.equal(f.clipboard, "tau/t7");
  await f.click("project"); assert.equal(f.clipboard, "/project");
  await f.click("pin"); assert.deepEqual(f.pins, ["B", "tau/t7"]);
  f.render(); assert.equal(f.item("pin").label, "Unpin conversation");
  await f.click("pin"); assert.deepEqual(f.pins, ["B"]);
  assert.equal(f.hcCalls.length, 0);
});

test("keyboard: arrows skip disabled items, Enter runs, Escape closes", async () => {
  const f = fixture(); f.add("A", { status: "working", raw: "working" }); f.ps = []; f.terms[0].cwd = ""; f.open();
  assert.equal(f.menu.at, 0);
  await f.key("down"); assert.equal(f.ids()[f.menu.at], "reference");
  await f.key("down"); await f.key("down"); assert.equal(f.ids()[f.menu.at], "pin");
  await f.key("enter"); assert.deepEqual(f.pins, ["A"]);
  await f.key("escape"); assert.equal(f.closed.at(-1), "menu-1");
});

test("never types into a conversation or reads its screen or session files", () => {
  const code = source("main.js") + source("pi-fork.js");
  assert.doesNotMatch(code, /"send"|"read"|readTextFile|exec\(|timer|session-file|pi\.session/);
  assert.match(source("pi-fork.js"), /hc\(\["keys", address, FORK_KEY\]\)/);
});

test("FORK_KEY matches Pi's app.session.fork binding in the Nix config, when it is there", () => {
  const f = fixture();
  assert.equal(f.helper.FORK_KEY, "ctrl+alt+shift+f");
  const nix = ["../../../../../agents/pi.nix", "/etc/nixos/modules/agents/pi.nix"].map((p) => path.resolve(__dirname, p)).find((p) => fs.existsSync(p));
  const bound = nix && fs.readFileSync(nix, "utf8").match(/"app\.session\.fork"\s*=\s*"([^"]+)"/);
  if (bound) assert.equal(bound[1], f.helper.FORK_KEY);
});
