const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { tempStateDir, startTestServer, request, claimAs } = require('./helpers');
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const { createDelivery } = require('../plugin/lib/delivery');

const BIN = path.join(__dirname, '..', 'plugin', 'bin', 'control-room.js');

// La CLI dans un processus à part, comme l'orchestratrice la lance depuis son Bash.
function cli(args, { stdin, dir: stateDir } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, CONTROL_ROOM_DIR: stateDir || dir } });
    let stdout = '', stderr = '';
    p.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; });
    p.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
    p.stdin.end(stdin === undefined ? '' : stdin, 'utf8');
  });
}

let t, dir;
test.beforeEach(async () => {
  dir = tempStateDir('cr-cli-');
  const delivery = createDelivery({ ackTimeoutMs: 300 });
  t = await startTestServer({ deliver: delivery.deliver, routes: [...delivery.routes, ...orchRoutes.routes, ...require('../plugin/lib/board-routes').routes] });
});
test.afterEach(async () => { await t.close(); });

const state = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json;

test('tool reply reads French text from stdin intact', async () => {
  const text = "Je confie ça à l'utilisateur ⚔️ — prêt";
  const r = await cli(['tool', 'reply', '--json', '-'], { stdin: JSON.stringify({ text }) });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).shown);
  assert.equal((await state()).conversation.at(-1).text, text);
});

test('tool queue_decision with inline JSON puts a card in the queue', async () => {
  const r = await cli(['tool', 'queue_decision', '--json', '{"agent":"A","summary":"S ?","options":["x","y"]}']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal((await state()).pending[0].summary, 'S ?');
});

test('tool --list prints the 15 tools with their schemas', async () => {
  const r = await cli(['tool', '--list']);
  assert.equal(r.code, 0, r.stderr);
  const tools = JSON.parse(r.stdout);
  assert.equal(tools.length, 15);
  for (const n of ['reply', 'queue_decision', 'wait_answers']) assert.ok(tools.find(x => x.name === n && x.inputSchema), n);
});

test('tool with unreadable JSON exits 2 and sends nothing', async () => {
  const before = (await state()).conversation.length;
  const r = await cli(['tool', 'reply', '--json', '{pas du json']);
  assert.equal(r.code, 2);
  assert.equal((await state()).conversation.length, before);
});

test('tool without a name exits 2', async () => {
  assert.equal((await cli(['tool'])).code, 2);
});

test('tool with an unknown name exits 1', async () => {
  const r = await cli(['tool', 'nope']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Outil inconnu/);
});

test('tool exits 1 with the server error for an unknown id', async () => {
  await claimAs(t, 'A');
  const r = await cli(['tool', 'add_note', '--json', '{"id":"ZZZZ","text":"t"}']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /élément inconnu : ZZZZ/);
});

test('tool with --json and no value exits 2 and sends nothing', async () => {
  const before = (await state()).conversation.length;
  const r = await cli(['tool', 'reply', '--json'], { stdin: '{"text":"perdu"}' });
  assert.equal(r.code, 2);
  assert.equal((await state()).conversation.length, before);
});

test('tool missing a required argument exits 2 and sends nothing', async () => {
  const before = (await state()).conversation.length;
  const r = await cli(['tool', 'reply']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /text/);
  assert.equal((await state()).conversation.length, before);
});

test('tool wait_answers waits out its long poll', async () => {
  const { claimId } = await claimAs(t, 'A');
  const t0 = Date.now();
  const r = await cli(['tool', 'wait_answers', '--json', JSON.stringify({ claim: claimId, timeout_seconds: 1 })]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(Date.now() - t0 >= 1000);
  assert.ok(Array.isArray(JSON.parse(r.stdout).messages));
});

test('tool exits 3 when control-room is not running', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-cli-down-'));
  const r = await cli(['tool', 'list_pending'], { dir: empty });
  assert.equal(r.code, 3);
  assert.match(r.stderr, /control-room ne tourne pas/);
});
