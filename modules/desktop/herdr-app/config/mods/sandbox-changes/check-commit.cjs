const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function element() {
  const node = { items: [], styles: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === "when") { if (args[0]) args[1](proxy); }
      else if (key === "child") node.items.push(args[0]);
      else if (key === "children") node.items.push(...args[0]);
      else if (key === "id") node.id = args[0];
      else node.styles[key] = args;
      return proxy;
    };
  } });
  return proxy;
}

function fixture(machine = null) {
  const f = { jobs: [], calls: [], cwd: "/repo", answer: async () => ({ code: 0, stdout: "🔧 Improve configuration\n", stderr: "" }) };
  const state = { text: "", handlers: {}, value() { return this.text; },
    set_value(text) { this.text = text; this.handlers.change?.({}, f.cx); },
    on(event, fn) { this.handlers[event] = fn; },
    set_soft_wrap(value) { this.wrap = value; },
    set_auto_grow(min, max) { this.rows = [min, max]; } };
  const env = { View: class {}, div: element, svg: element, v_flex: element, h_flex: element,
    v_virtual_list: element, Scrollbar: { vertical: element }, Textarea: { new: element },
    TextareaState: { new: () => state }, settings: () => ({}), theme: () => ({}),
    spaces: () => [{ active: true, folder: f.cwd, machine }], focused: () => null, panes: () => [],
    exec: async (cmd, args, opts) => {
      f.calls.push({ cmd, args, opts });
      assert.equal(opts.cwd, "/repo"); assert.equal(opts.on, machine);
      if (cmd === "pi") return f.answer();
      assert.equal(cmd, "git");
      assert.ok(args.includes("--no-optional-locks")); assert.ok(args.includes("core.fsmonitor=false"));
      let stdout = "";
      if (args.includes("status")) stdout = " M tracked.txt\0?? new.txt\0";
      else if (args.includes("rev-parse")) stdout = "head\n";
      else if (args.includes("log")) stdout = "🔧 Follow repository style\n";
      else if (args.includes("--no-index")) return { code: 1, stdout: "+new file content\n", stderr: "" };
      else if (args.includes("diff")) stdout = "+tracked file content\n";
      else assert.fail("Unexpected Git command");
      return { code: 0, stdout, stderr: "" };
    } };
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("export default class", "globalThis.Mod = class"), env);
  f.cx = { notify() {}, spawn: (fn) => f.jobs.push(fn), focus_handle: () => ({}),
    bind_keys() {}, timer: { every() {} } };
  f.mod = new env.Mod(); f.mod.refresh = () => {};
  f.mod.init({}, f.cx);
  Object.assign(f.mod, { context: JSON.stringify({ cwd: "/repo", on: machine }), root: "/repo", on: machine,
    files: [{ path: "tracked.txt", add: 1, del: 0 }] });
  f.flush = async () => { while (f.jobs.length) await f.jobs.shift()(f.cx); };
  f.generate = async () => { f.mod.generate(f.cx); await f.flush(); };
  f.state = state;
  return f;
}

test("wrapping textarea grows from one to five rows and has no fixed field height", () => {
  const f = fixture(); assert.equal(f.state.wrap, true); assert.deepEqual(f.state.rows, [1, 5]);
  const subject = "🔧 Keep long generated commit messages fully readable in a narrow Changes panel";
  f.state.set_value(subject); assert.equal(f.mod.message, subject);
  const find = (node, id) => typeof node === "object" && node !== null
    ? node.id === id ? node : node.items?.map((child) => find(child, id)).find(Boolean) : undefined;
  const tree = f.mod.render(f.cx), field = find(tree, "commit-message");
  assert.ok(field); assert.equal(field.styles.h, undefined);
  assert.equal(field.items[0].styles.h_full, undefined);
  assert.ok(find(tree, "generate-commit"));
});

test("textarea Enter never commits; the Commit button stays explicit", async () => {
  const f = fixture();
  f.state.set_value("Review this message\n");
  f.state.handlers.submit?.({}, f.cx);
  await f.flush();
  assert.equal(f.calls.length, 0);
  let committed = 0;
  f.mod.commit = () => committed++;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.id === "commit") node.styles.on_click[0]({}, f.cx);
    else node.items?.forEach(visit);
  };
  visit(f.mod.render(f.cx));
  assert.equal(committed, 1);
});

test("wand fills the existing field using tracked and untracked changes without committing", async () => {
  const f = fixture(); await f.generate();
  assert.equal(f.state.value(), "🔧 Improve configuration");
  assert.equal(f.mod.message, f.state.value()); assert.equal(f.mod.generation, null);
  const pi = f.calls.find((c) => c.cmd === "pi");
  assert.match(pi.args.at(-1), /tracked file content/); assert.match(pi.args.at(-1), /new file content/);
  for (const flag of ["--no-session", "--no-tools", "--no-extensions", "--no-mcp"]) assert.ok(pi.args.includes(flag));
  assert.ok(!f.calls.some((c) => c.cmd === "git" && (c.args.includes("add") || c.args.includes("commit"))));
});

test("duplicate generation and Commit are blocked while the wand is running", async () => {
  const f = fixture(); f.state.set_value("Existing message");
  f.mod.generate(f.cx); f.mod.generate(f.cx); f.mod.commit(f.cx);
  assert.equal(f.jobs.length, 1); await f.flush();
});

test("typing while generation runs keeps the user's draft", async () => {
  const f = fixture();
  f.answer = async () => { f.state.set_value("My draft"); return { code: 0, stdout: "Old result", stderr: "" }; };
  await f.generate(); assert.equal(f.state.value(), "My draft");
});

test("switching repositories discards a late result", async () => {
  const f = fixture();
  f.answer = async () => { f.cwd = "/other"; return { code: 0, stdout: "Wrong repo result", stderr: "" }; };
  await f.generate(); assert.equal(f.state.value(), "");
});

test("generation errors preserve existing text", async () => {
  const f = fixture(); f.state.set_value("Existing message");
  f.answer = async () => ({ code: 1, stdout: "", stderr: "Please log in to Pi" });
  await f.generate(); assert.equal(f.state.value(), "Existing message");
  assert.match(f.mod.note, /Please log in/); assert.equal(f.mod.generation, null);
});

test("malformed model output is rejected without overwriting the field", async () => {
  const f = fixture();
  f.answer = async () => ({ code: 0, stdout: "Subject\nUnwanted explanation", stderr: "" });
  await f.generate(); assert.equal(f.state.value(), ""); assert.match(f.mod.note, /single concise/);
});

test("remote generation preserves machine routing", async () => {
  const f = fixture("tau"); await f.generate(); assert.equal(f.state.value(), "🔧 Improve configuration");
});
