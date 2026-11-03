const assert = require("node:assert/strict");
const { realpathSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");

const piPackage = process.env.PI_TEST_PACKAGE || path.join(
  path.dirname(path.dirname(realpathSync(execFileSync("sh", ["-c", "command -v pi"], { encoding: "utf8" }).trim()))),
  "lib/pi/node_modules/@earendil-works/pi-coding-agent",
);
const jiti = require(require.resolve("jiti", { paths: [piPackage] }))(__filename);

async function setup(terminal = "test-terminal") {
  const plugin = await jiti.import(path.join(__dirname, "extensions/herdr-session.ts"), { default: true });
  const f = { calls: [], handlers: new Map(), warnings: [], name: "Fix tray startup", failure: null };
  const before = process.env.HC_TERMINAL_ID;
  if (terminal) process.env.HC_TERMINAL_ID = terminal; else delete process.env.HC_TERMINAL_ID;
  plugin({
    on: (event, handler) => f.handlers.set(event, handler),
    getSessionName: () => f.name,
    exec: async (...args) => {
      f.calls.push(args);
      if (f.failure instanceof Error) throw f.failure;
      return f.failure || { code: 0, stderr: "" };
    },
  });
  if (before === undefined) delete process.env.HC_TERMINAL_ID; else process.env.HC_TERMINAL_ID = before;
  f.context = (file = "/sessions/current.jsonl", id = "current", hasUI = true) => ({
    hasUI, ui: { notify: (...args) => f.warnings.push(args) },
    sessionManager: { getSessionFile: () => file, getSessionId: () => id, getSessionDir: () => "/sessions" },
  });
  return f;
}

test("the bridge stays inactive outside Herdr and in headless children", async () => {
  assert.equal((await setup(null)).handlers.size, 0);
  const f = await setup();
  for (const handler of f.handlers.values()) await handler({}, f.context("/child.jsonl", "child", false));
  assert.equal(f.calls.length, 0);
  assert.equal(f.warnings.length, 0);
});

test("startup, reload, new, resume and fork publish the exact session and the UI title label", async () => {
  const f = await setup();
  for (const reason of ["startup", "reload", "new", "resume", "fork"]) {
    await f.handlers.get("session_start")({ reason }, f.context("/sessions/" + reason + ".jsonl", reason));
    assert.deepEqual(f.calls.at(-1), ["hc", [
      "label", "test-terminal", "pi.session=Fix tray startup",
      "pi.session-file=/sessions/" + reason + ".jsonl", "pi.session-id=" + reason, "pi.session-dir=/sessions",
    ], { timeout: 3000 }]);
  }
});

test("renaming or clearing the session updates the title without waiting for a turn", async () => {
  const f = await setup();
  for (const name of ["Renamed conversation", undefined]) {
    f.name = name;
    await f.handlers.get("session_info_changed")({ name }, f.context());
    assert.ok(f.calls.at(-1)[1].includes("pi.session=" + (name ?? "")));
  }
});

test("settled ephemeral sessions clear the old saved-file label", async () => {
  const f = await setup();
  const ctx = f.context(); ctx.sessionManager.getSessionFile = () => undefined;
  await f.handlers.get("agent_settled")({}, ctx);
  assert.ok(f.calls[0][1].includes("pi.session-file="));
});

test("failed hc exits and spawn errors notify once per outage, then recover", async () => {
  for (const failure of [{ code: 1, stderr: "core unavailable" }, new Error("cannot start hc")]) {
    const f = await setup(); f.failure = failure;
    for (const event of ["session_start", "session_info_changed", "agent_settled", "agent_settled"])
      await f.handlers.get(event)({}, f.context());
    assert.equal(f.warnings.length, 1);
    assert.equal(f.warnings[0][1], "warning");
    assert.match(f.warnings[0][0], /Cannot publish Pi session to Herdr/);
    f.failure = null; await f.handlers.get("agent_settled")({}, f.context());
    f.failure = failure; await f.handlers.get("agent_settled")({}, f.context());
    assert.equal(f.warnings.length, 2);
  }
});
