import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

async function until(check) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const value = await check();
    if (value) return value;
    await delay(10);
  }
  throw new Error("Timed out waiting for condition");
}

test("MCP lifecycle, Pi RPC and desktop callbacks", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "pi-workers-test-"));
  const socket = join(dir, "app.sock");
  const messages = [];
  let rejectDelivery = false;
  const app = createServer((connection) => {
    let buffer = Buffer.alloc(0);
    connection.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4 || buffer.length < buffer.readUInt32LE() + 4)
        return;
      const request = JSON.parse(buffer.subarray(4).toString());
      if (request.params.tool === "send_message_to_thread")
        messages.push(request.params);
      const body = Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            success:
              !rejectDelivery ||
              request.params.tool !== "send_message_to_thread",
            contentItems: [],
          },
        }),
      );
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length);
      connection.write(header.subarray(0, 2));
      setImmediate(() =>
        connection.end(Buffer.concat([header.subarray(2), body])),
      );
    });
  });
  await new Promise((resolve) => app.listen(socket, resolve));
  const fake = join(dir, "pi");
  await writeFile(
    fake,
    `#!${process.execPath}
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const session = process.argv[process.argv.indexOf('--session') + 1];
writeFileSync(session, String(process.pid));
let remembered, busy = false, queued;
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n');
function done(text) {
  emit({type:'message_end',message:{role:'assistant',content:[{type:'thinking',thinking:'hidden'},{type:'text',text}],stopReason:'stop'}});
  emit({type:'agent_end'});
  setTimeout(() => {
    if (queued) { const next = queued; queued = undefined; done(next); }
    else { busy = false; emit({type:'agent_settled',aborted:false}); }
  }, 60);
}
createInterface({input:process.stdin}).on('line', line => {
  const record = JSON.parse(line);
  if (record.type === 'set_session_name') emit({type:'response',id:record.id,success:true});
  if (record.type !== 'prompt') return;
  emit({type:'response',id:record.id,success:true,data:{disposition:record.message === '/handled' ? 'handled' : busy ? 'queued' : 'started'}});
  if (record.message === '/handled') return;
  if (record.message === 'crash') process.exit(7);
  if (busy) { queued = record.streamingBehavior + ':' + record.message; return; }
  busy = true;
  emit({type:'agent_start'});
  if (record.message === 'hang') {
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'inherit'});
    writeFileSync(session + '.child', String(child.pid));
    return;
  }
  if (record.message === 'recall') done(remembered);
  else { remembered = record.message; done(record.message); }
});
`,
    { mode: 0o700 },
  );
  const server = spawn(
    process.execPath,
    [new URL("./pi-workers.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        CODEX_HOME: dir,
        PI_WORKER_BIN: fake,
        CODEX_APP_TOOLS_PIPE_PATH: socket,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const pending = new Map();
  const closed = new Promise((resolve) => server.on("close", resolve));
  createInterface({ input: server.stdout }).on("line", (line) => {
    const response = JSON.parse(line);
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  });
  let nextId = 0;
  async function request(method, params = {}) {
    const id = ++nextId;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`MCP timeout: ${method}; ${stderr}`)),
        5000,
      );
      pending.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
    server.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
    return response;
  }
  async function call(
    name,
    args = {},
    parent = "parent-a",
    allowError = false,
  ) {
    const response = await request("tools/call", {
      name,
      arguments: args,
      _meta: {
        "x-codex-turn-metadata": JSON.stringify({
          thread_id: parent,
          turn_id: "turn-test",
        }),
      },
    });
    if (allowError) return response.result;
    assert.equal(
      response.result.isError,
      undefined,
      response.result.content[0].text,
    );
    return JSON.parse(response.result.content[0].text);
  }
  t.after(async () => {
    server.stdin.end();
    await closed;
    await new Promise((resolve) => app.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });

  assert.equal(
    (await request("initialize", { protocolVersion: "2025-03-26" })).result
      .protocolVersion,
    "2025-03-26",
  );
  assert.deepEqual(
    (await request("tools/list")).result.tools.map((tool) => tool.name),
    ["pi_start", "pi_send", "pi_status", "pi_stop"],
  );
  assert.equal((await request("unknown")).error.code, -32601);
  assert.equal(
    (await request("tools/call", { name: "pi_status" })).result.isError,
    true,
  );
  assert.equal(
    (await call("pi_start", { task: "x", cwd: "relative" }, "parent-a", true))
      .isError,
    true,
  );

  const text = "ñ\u2028\u2029" + "x".repeat(5000);
  const first = await call("pi_start", { task: text, cwd: dir, name: "test" });
  const id = first.worker_id;
  assert.equal(first.disposition, "started");
  assert.equal(messages.length, 0, "agent_end must not trigger a callback");
  await until(() => messages.length === 1);
  assert.equal(messages[0].threadId, "parent-a");
  assert.equal(messages[0].arguments.threadId, "parent-a");
  assert.ok(messages[0].arguments.prompt.includes(text));
  assert.ok(!messages[0].arguments.prompt.includes("hidden"));
  assert.equal(
    (await call("pi_send", { worker_id: id, message: "recall" })).disposition,
    "started",
  );
  await until(() => messages.length === 2);
  assert.ok(messages[1].arguments.prompt.includes(text));
  assert.equal(
    (await call("pi_status", { worker_id: id }, "parent-b", true)).isError,
    true,
  );
  assert.deepEqual(await call("pi_status", {}, "parent-b"), []);

  await call("pi_send", { worker_id: id, message: "queued test" });
  assert.equal(
    (await call("pi_send", { worker_id: id, message: "next", mode: "steer" }))
      .disposition,
    "queued",
  );
  await until(() => messages.length === 3);
  assert.match(messages[2].arguments.prompt, /steer:next/);
  assert.equal(
    (await call("pi_send", { worker_id: id, message: "/handled" })).disposition,
    "handled",
  );

  rejectDelivery = true;
  await call("pi_send", { worker_id: id, message: "retained result" });
  await until(
    async () => (await call("pi_status", { worker_id: id })).deliveryError,
  );
  assert.equal(
    (await call("pi_status", { worker_id: id })).result,
    "retained result",
  );
  rejectDelivery = false;
  await call("pi_send", { worker_id: id, message: "crash" });
  await until(
    async () => (await call("pi_status", { worker_id: id })).status === "error",
  );
  assert.match(
    (await call("pi_status", { worker_id: id })).result,
    /Pi exited \(7\)/,
  );

  const hanging = await call("pi_start", { task: "hang", cwd: dir });
  const pid = Number(await readFile(hanging.session, "utf8"));
  const childPid = Number(
    await until(() =>
      readFile(hanging.session + ".child", "utf8").catch(() => null),
    ),
  );
  assert.equal(
    (await call("pi_stop", { worker_id: hanging.worker_id })).status,
    "stopped",
  );
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  await until(() => {
    try {
      process.kill(childPid, 0);
      return false;
    } catch (error) {
      return error.code === "ESRCH";
    }
  });
  const shutdownWorker = await call("pi_start", { task: "hang", cwd: dir });
  const shutdownPid = Number(await readFile(shutdownWorker.session, "utf8"));
  server.stdin.end();
  assert.equal(await closed, 0);
  assert.throws(() => process.kill(shutdownPid, 0), { code: "ESRCH" });
});
