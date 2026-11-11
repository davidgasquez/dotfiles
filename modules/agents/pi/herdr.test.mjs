// node --test: extensions/herdr.ts against Pi's SessionManager and a stubbed herdr-app.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

function piPackage() {
  if (process.env.PI_PACKAGE) return process.env.PI_PACKAGE;
  const wrapper = execFileSync("sh", ["-c", "command -v pi"], { encoding: "utf8" }).trim();
  const wrapped = fs.readFileSync(wrapper, "utf8").match(/"(\/nix\/store\/[^"]+\/\.pi-wrapped)"/)?.[1];
  const cli = fs.readFileSync(wrapped ?? wrapper, "utf8").match(/(\/nix\/store\/\S+\/pi-coding-agent)\/dist\//)?.[1];
  if (!cli) throw new Error("Set PI_PACKAGE to the pi-coding-agent package directory");
  return cli;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-ext-"));
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }));
const pkg = path.join(root, "node_modules/@earendil-works/pi-coding-agent");
fs.mkdirSync(path.dirname(pkg), { recursive: true });
fs.symlinkSync(piPackage(), pkg);
const extension = path.join(root, "herdr.ts");
fs.copyFileSync(fileURLToPath(new URL("extensions/herdr.ts", import.meta.url)), extension);
const { SessionManager } = await import(pathToFileURL(path.join(pkg, "dist/index.js")));
const { default: herdrExtension } = await import(pathToFileURL(extension));

const bin = path.join(root, "bin");
const scenario = path.join(root, "scenario.json");
const log = path.join(root, "calls.jsonl");
fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, "herdr-app"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");
const reply = JSON.parse(fs.readFileSync(${JSON.stringify(scenario)}, "utf8"))[args[0] === "do" ? args[1] : args[0]];
if (reply.stderr) process.stderr.write(reply.stderr);
process.stdout.write(typeof reply.stdout === "string" ? reply.stdout : JSON.stringify(reply.stdout ?? ""));
process.exit(reply.code ?? 0);
`, { mode: 0o755 });

const ID = "t1zz";
const layout = (terminals) => ({
  spaces: [
    { id: "spActive", tabs: [{ id: "tbA", terminals: [{ terminal: "t1aa", sub_agents: [ID] }] }] },
    { id: "spOwn", tabs: [{ id: "tbB", terminals: terminals }] },
  ],
});
const visible = layout([{ terminal: ID, sub_agents: [] }]);
const created = { stdout: { space: "spOwn", tab: "tbNew", terminal: "t2aa" } };

function assistant(text) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-opus-5-5",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function session(cwd) {
  const sm = SessionManager.create(cwd, path.join(cwd, "sessions"));
  sm.appendModelChange("anthropic", "claude-opus-5-5");
  sm.appendThinkingLevelChange("high");
  sm.appendMessage({ role: "user", content: "first", timestamp: Date.now() });
  sm.appendMessage(assistant("one"));
  return sm;
}

function load({ env = { HC_TERMINAL_ID: ID, XDG_RUNTIME_DIR: path.join(root, "run") } } = {}) {
  const saved = { HC_TERMINAL_ID: process.env.HC_TERMINAL_ID, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR };
  Object.assign(process.env, { HC_TERMINAL_ID: "", XDG_RUNTIME_DIR: "" }, env);
  const handlers = {};
  const commands = {};
  const shortcuts = {};
  herdrExtension({
    on: (name, handler) => { handlers[name] = handler; },
    registerCommand: (name, options) => { commands[name] = options; },
    registerShortcut: (key, options) => { shortcuts[key] = options; },
  });
  Object.assign(process.env, saved);
  return { handlers, commands, shortcuts };
}

// Only notify: the editor's draft is never read, replaced or submitted.
function context({ sm, cwd, idle, mode, notes, touched }) {
  const ui = new Proxy({ notify: (message, level) => notes.push({ level, message }) }, {
    get: (target, key) => (key === "notify" ? target.notify : touched.push(key)),
  });
  return { mode, cwd, sessionManager: sm, isIdle: () => idle, hasPendingMessages: () => false, ui };
}

const triggers = {
  command: (ext, ctx) => ext.commands.branch.handler("", ctx),
  shortcut: (ext, ctx) => ext.shortcuts.f6.handler(ctx),
};

async function branch({ sm, cwd, replies, idle = true, mode = "tui", pathDir = bin, via = "command", times = 1 }) {
  fs.writeFileSync(scenario, JSON.stringify(replies));
  fs.rmSync(log, { force: true });
  const notes = [];
  const touched = [];
  const before = fs.readdirSync(sm.getSessionDir()).sort();
  const PATH = process.env.PATH;
  process.env.PATH = pathDir;
  try {
    const ext = load();
    const ctx = context({ sm, cwd, idle, mode, notes, touched });
    await Promise.all(Array.from({ length: times }, () => triggers[via](ext, ctx)));
  } finally {
    process.env.PATH = PATH;
  }
  const calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
  const added = fs.readdirSync(sm.getSessionDir()).filter((f) => !before.includes(f));
  assert.deepEqual(touched, []);
  return { notes, calls, added: added.map((f) => path.join(sm.getSessionDir(), f)) };
}

const read = (file) => fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse);
const tempCwd = (name) => fs.mkdtempSync(path.join(root, name));

for (const via of Object.keys(triggers)) test(`${via}: opens the snapshot in the caller's own space, not the active one`, async () => {
  const cwd = tempCwd(`it's "$(echo x)" ü `);
  const sm = session(cwd);
  const origin = fs.readFileSync(sm.getSessionFile(), "utf8");
  const { notes, calls, added } = await branch({ sm, cwd, via, replies: { ls: { stdout: visible }, "tab.new": created } });

  assert.equal(added.length, 1);
  const [snapshot] = added;
  assert.deepEqual(calls, [
    ["ls"],
    ["do", "tab.new", JSON.stringify({ space: "spOwn", name: "Pi fork", folder: cwd, argv: ["exec", "pi", "--session", snapshot] })],
  ]);
  assert.deepEqual(notes, [{ level: "info", message: "Opened a snapshot fork in Herdr (t2aa)" }]);

  assert.equal(fs.readFileSync(sm.getSessionFile(), "utf8"), origin);
  const [header, ...entries] = read(snapshot);
  assert.equal(header.parentSession, sm.getSessionFile());
  assert.equal(header.cwd, cwd);
  assert.notEqual(header.id, sm.getSessionId());
  assert.deepEqual(entries.map((e) => e.id), sm.getBranch().map((e) => e.id));
  assert.deepEqual(entries.filter((e) => e.type === "model_change").map((e) => e.modelId), ["claude-opus-5-5"]);
});

test("F6 is the same /branch, with the same description", () => {
  const { commands, shortcuts } = load();
  assert.deepEqual(Object.keys(shortcuts), ["f6"]);
  assert.equal(shortcuts.f6.description, commands.branch.description);
});

test("a second trigger while one is opening forks nothing more", async () => {
  const cwd = tempCwd("twice-");
  const sm = session(cwd);
  const { notes, calls, added } = await branch({ sm, cwd, via: "shortcut", times: 2, replies: { ls: { stdout: visible }, "tab.new": created } });

  assert.equal(added.length, 1);
  assert.deepEqual(calls.map((c) => c[1] ?? c[0]), ["ls", "tab.new"]);
  assert.deepEqual(notes, [
    { level: "warning", message: "A fork is already being opened" },
    { level: "info", message: "Opened a snapshot fork in Herdr (t2aa)" },
  ]);
  const again = await branch({ sm, cwd, via: "shortcut", replies: { ls: { stdout: visible }, "tab.new": created } });
  assert.equal(again.added.length, 1, "free again once settled");
});

test("a busy session forks from the last completed turn", async () => {
  const cwd = tempCwd("busy-");
  const sm = session(cwd);
  const completed = sm.getLeafId();
  sm.appendMessage({ role: "user", content: "in flight", timestamp: Date.now() });
  const { notes, added } = await branch({ sm, cwd, idle: false, via: "shortcut", replies: { ls: { stdout: visible }, "tab.new": created } });

  assert.equal(read(added[0]).at(-1).id, completed);
  assert.equal(notes[0].message, "Opened a fork from the last completed turn in Herdr (t2aa)");
});

for (const [name, ls, expected] of [
  ["a caller shown only as a sub-agent", { stdout: layout([{ terminal: "t1bb", sub_agents: [ID] }]) }, `Terminal ${ID} is not shown in a Herdr tab`],
  ["no window", { code: 2, stderr: "herdr-app: no Herdr window at /x/herdr-app.sock\n" }, "herdr-app: no Herdr window at /x/herdr-app.sock"],
  ["an app error", { code: 1, stdout: { error: "layout unavailable" } }, "layout unavailable"],
  ["malformed ls", { stdout: "not json" }, "herdr-app ls returned invalid JSON"],
]) {
  test(`fails before snapshotting on ${name}`, async () => {
    const cwd = tempCwd("lookup-");
    const sm = session(cwd);
    const { notes, calls, added } = await branch({ sm, cwd, replies: { ls } });

    assert.deepEqual(calls, [["ls"]]);
    assert.deepEqual(added, []);
    assert.deepEqual(notes, [{ level: "error", message: `Failed to branch session: ${expected}` }]);
  });
}

for (const [name, reply, expected] of [
  ["an app error", { code: 1, stdout: { error: "folder does not exist" } }, "folder does not exist"],
  ["malformed JSON", { stdout: "{" }, "herdr-app do tab.new returned invalid JSON"],
  ["another space", { stdout: { space: "spActive", tab: "tb", terminal: "t3" } }, 'herdr-app do tab.new returned an unexpected reply: {"space":"spActive","tab":"tb","terminal":"t3"}'],
  ["missing IDs", { stdout: { space: "spOwn" } }, 'herdr-app do tab.new returned an unexpected reply: {"space":"spOwn"}'],
]) {
  test(`reports the kept snapshot once when tab.new returns ${name}`, async () => {
    const cwd = tempCwd("launch-");
    const sm = session(cwd);
    const { notes, calls, added } = await branch({ sm, cwd, replies: { ls: { stdout: visible }, "tab.new": reply } });

    assert.equal(calls.filter((c) => c[1] === "tab.new").length, 1);
    assert.equal(added.length, 1);
    assert.deepEqual(notes, [{ level: "error", message: `Failed to open fork: ${expected}. Snapshot saved at ${added[0]}` }]);
  });
}

test("reports a missing herdr-app", async () => {
  const cwd = tempCwd("missing-");
  const sm = session(cwd);
  const { notes, added } = await branch({ sm, cwd, replies: {}, pathDir: path.join(root, "empty") });

  assert.deepEqual(added, []);
  assert.deepEqual(notes, [{ level: "error", message: "Failed to branch session: herdr-app is not installed" }]);
});

test("stays out of non-interactive modes", async () => {
  const cwd = tempCwd("print-");
  const sm = session(cwd);
  const { notes, calls, added } = await branch({ sm, cwd, mode: "rpc", via: "shortcut", replies: {} });

  assert.deepEqual([calls, added], [[], []]);
  assert.equal(notes[0].level, "warning");
});

test("registers nothing outside a Herdr terminal", () => {
  for (const id of ["", "../x"]) {
    assert.deepEqual(load({ env: { HC_TERMINAL_ID: id } }), { handlers: {}, commands: {}, shortcuts: {} });
  }
});

test("keeps the final reply preview for the terminal", () => {
  const runtime = path.join(root, "run");
  const { handlers } = load();
  const file = path.join(runtime, "herdr-pi", ID);
  const ctx = { sessionManager: { getBranch: () => [{ type: "message", message: assistant("done\u0007 now") }] } };

  handlers.agent_settled({ aborted: false }, ctx);
  assert.equal(fs.readFileSync(file, "utf8"), "done now");
  handlers.session_shutdown();
  assert.equal(fs.existsSync(file), false);
});
