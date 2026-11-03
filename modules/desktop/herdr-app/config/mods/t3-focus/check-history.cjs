const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "history.js"), "utf8").split("export const sessionKey")[0]
  .replace(/^import .*;\r?\n/, "").replace(/export const /g, "const ");
const script = vm.runInNewContext(source + "\nSESSION_SCRIPT");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-history-check-"));
  const agent = path.join(root, "agent"), project = path.join(root, "project");
  fs.mkdirSync(project);
  const env = { ...process.env, PI_CODING_AGENT_DIR: agent };
  if (process.env.PI_TEST_PACKAGE) {
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    fs.symlinkSync(path.join(process.env.PI_TEST_PACKAGE, "dist/cli.js"), path.join(bin, "pi"));
    env.PATH = bin + path.delimiter + env.PATH;
  }
  const add = (directory, id) => {
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, id + ".jsonl"), timestamp = new Date().toISOString();
    fs.writeFileSync(file, [
      { type: "session", version: 3, id, timestamp, cwd: project },
      { type: "message", id: "entry", parentId: null, timestamp,
        message: { role: "user", content: [{ type: "text", text: "Saved " + id }], timestamp: Date.now() } },
    ].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
    return file;
  };
  const standard = path.join(agent, "sessions", "--project--"), custom = path.join(root, "custom");
  const defaultFile = add(standard, "default"), customFile = add(custom, "custom");
  const counts = path.join(root, "reads.json"), hook = path.join(root, "count-reads.cjs");
  fs.writeFileSync(hook, `
    const fs = require("node:fs");
    const original = fs.createReadStream, counts = {};
    fs.createReadStream = function(file, ...args) {
      const key = String(file); counts[key] = (counts[key] || 0) + 1;
      return original.call(this, file, ...args);
    };
    require("node:module").syncBuiltinESMExports();
    process.on("exit", () => fs.writeFileSync(process.env.TEST_READ_COUNTS, JSON.stringify(counts)));
  `);
  const read = (request) => {
    const output = execFileSync(process.execPath, ["--require", hook, "--input-type=module", "-e", script, JSON.stringify(request)], {
      env: { ...env, TEST_READ_COUNTS: counts }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { sessions: JSON.parse(output), reads: JSON.parse(fs.readFileSync(counts)) };
  };
  return { root, standard, custom, defaultFile, customFile, project, read };
}

test("native Pi discovery does not re-read default project roots, and still discovers custom sessions", () => {
  const f = fixture();
  try {
    const baseline = f.read({});
    const expanded = f.read({ directories: [f.standard, f.standard + "/.", f.custom, f.custom] });
    assert.deepEqual(expanded.sessions.map((s) => s.id).sort(), ["custom", "default"]);
    assert.ok(baseline.reads[f.defaultFile] > 0, "instrumentation observes real SDK file reads");
    assert.equal(expanded.reads[f.defaultFile], baseline.reads[f.defaultFile], "remembered default folders add no transcript reads");
    assert.equal(expanded.reads[f.customFile], baseline.reads[f.defaultFile], "custom folders are scanned once");
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("native validation accepts only the exact saved identity and existing original project", () => {
  const f = fixture();
  try {
    const saved = f.read({ path: f.customFile, id: "custom" }).sessions;
    assert.equal(saved.path, f.customFile);
    assert.equal(saved.cwd, f.project);
    assert.throws(() => f.read({ path: f.customFile, id: "different" }), /no saved, resumable Pi session/);
    fs.rmdirSync(f.project);
    assert.throws(() => f.read({ path: f.customFile, id: "custom" }));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
