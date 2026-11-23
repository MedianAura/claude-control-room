const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs } = require('./helpers');
const { createDelivery } = require('../plugin/lib/delivery');
const sessions = require('../plugin/lib/sessions');
const { pendingCards } = require('../plugin/lib/cards');

const CLI = path.join(__dirname, '..', 'plugin', 'bin', 'control-room.js');

function runHook(event, input, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [CLI, 'hook', event], { env: { ...process.env, CONTROL_ROOM_DIR: dir, CLAUDE_CODE_MESSAGING_SOCKET: 'K1', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('close', code => resolve({ code, out }));
    p.stdin.end(JSON.stringify({ session_id: 'abcd1234-ef', cwd: 'F:\\AzerothCoreCOA\\SoloConquest', ...input }));
  });
}
const label = (key, text) => request(t.port, 'POST', '/api/sessions/label', { body: { key, label: text }, headers: clientHeaders(t) });
const state = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json;
async function answerApprovalWhenItAppears(choice, note) {
  for (let i = 0; i < 50; i++) {
    const c = pendingCards().find(x => x.kind === 'approval');
    if (c) return request(t.port, 'POST', '/api/answer', { body: { id: c.id, choice, note }, headers: pageHeaders(t) });
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('aucune carte d\'approbation');
}

let t, dir, delivery;
test.beforeEach(async () => {
  dir = tempStateDir('cr-hooks-');
  delivery = createDelivery({ ackTimeoutMs: 200 });
  t = await startTestServer({ deliver: delivery.deliver, routes: [...delivery.routes, ...sessions.routes(delivery)], state: () => ({ sessions: sessions.list() }) });
});
test.afterEach(async () => { await t.close(); });

const bashInput = { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'docker compose build ac-worldserver', description: 'Rebuild' } };

test('PermissionRequest allow prints the allow decision', async () => {
  await label('K1', '🔨 Builds · b2');
  const hook = runHook('permission', bashInput);
  await answerApprovalWhenItAppears('allow');
  const r = await hook;
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out), { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
});

test('PermissionRequest deny carries the note', async () => {
  await label('K1', '🔨 Builds · b2');
  const hook = runHook('permission', bashInput);
  await answerApprovalWhenItAppears('deny', 'attends que je sois déconnecté');
  const d = JSON.parse((await hook).out).hookSpecificOutput.decision;
  assert.equal(d.behavior, 'deny');
  assert.match(d.message, /attends que je sois déconnecté/);
});

test('the approval card shows the session label and the command', async () => {
  await label('K1', '🔨 Builds · b2');
  const hook = runHook('permission', bashInput);
  for (let i = 0; i < 50 && !pendingCards().length; i++) await new Promise(r => setTimeout(r, 100));
  const c = pendingCards()[0];
  assert.equal(c.agent, '🔨 Builds · b2');
  assert.equal(c.tool.input.command, 'docker compose build ac-worldserver');
  await answerApprovalWhenItAppears('allow'); await hook;
});

test('PermissionRequest from a session that never enrolled answers nothing at once', async () => {
  const started = Date.now();
  const r = await runHook('permission', bashInput);
  assert.equal(r.out, '');
  assert.equal(r.code, 0);
  assert.equal(pendingCards().length, 0);
  assert.ok(Date.now() - started < 3000);
});

test('PermissionRequest with the server down prints nothing and exits 0', async () => {
  fs.unlinkSync(path.join(dir, 'server.json'));
  const r = await runHook('permission', bashInput);
  assert.deepEqual(r, { code: 0, out: '' });
});

test('the approval card cannot be answered with the client secret', async () => {
  await label('K1', 'b2');
  const hook = runHook('permission', bashInput);
  for (let i = 0; i < 50 && !pendingCards().length; i++) await new Promise(r => setTimeout(r, 100));
  const r = await request(t.port, 'POST', '/api/answer', { body: { id: pendingCards()[0].id, choice: 'allow' }, headers: clientHeaders(t) });
  assert.equal(r.status, 403);
  await answerApprovalWhenItAppears('deny'); await hook;
});

test('a session that never enrolled stays off the strip', async () => {
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } });
  assert.equal((await state()).sessions.length, 0);
});

test('the orchestrator shows on the strip without enrolling', async () => {
  await claimAs(t, 'K1');
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } });
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } }, { CLAUDE_CODE_MESSAGING_SOCKET: 'K2' });
  assert.deepEqual((await state()).sessions.map(x => x.key), ['K1']);
});

test('PreToolUse updates the session line in place', async () => {
  await claimAs(t, 'K1');
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { description: 'Lancer les tests' } });
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } });
  const s = (await state()).sessions;
  assert.equal(s.length, 1);
  assert.equal(s[0].status, 'working');
  assert.equal(s[0].activity, 'Read');
  assert.equal(s[0].label, 'SoloConquest · abcd');
});

test('Stop marks the session idle', async () => {
  await label('K1', 'w');
  await runHook('status', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { description: 'x' } });
  await runHook('stop', { hook_event_name: 'Stop', stop_hook_active: false });
  assert.equal((await state()).sessions[0].status, 'idle');
});

test('a label replaces the default name', async () => {
  await runHook('status', { hook_event_name: 'SessionStart' });
  await label('K1', '🔨 Builds · b2');
  assert.equal((await state()).sessions[0].label, '🔨 Builds · b2');
});

test('PermissionDenied shows the auto-mode refusal as activity', async () => {
  await label('K1', 'w');
  await runHook('status', { hook_event_name: 'PermissionDenied', tool_name: 'Bash', reason: 'commande destructrice' });
  assert.match((await state()).sessions[0].activity, /refus du mode auto : commande destructrice/);
});

test('the orchestrator receiving a [cr:id] message acks it', async () => {
  const { code } = await claimAs(t, 'K1');
  await delivery.deliver('réponse');
  const id = delivery.pendingFor()[0].id;
  await runHook('status', { hook_event_name: 'UserPromptSubmit', prompt: `[control-room] réponse\n[cr:${id}:${code}]` });
  assert.equal(delivery.pendingFor().length, 0);
});

test('Stop pushes stale answers back to the orchestrator once', async () => {
  await claimAs(t, 'K1');
  await delivery.deliver('[control-room] Vol — « Patch ? » → Oui');
  await new Promise(r => setTimeout(r, 300));
  const r = await runHook('stop', { hook_event_name: 'Stop', stop_hook_active: false });
  const o = JSON.parse(r.out);
  assert.equal(o.decision, 'block');
  assert.match(o.reason, /Vol — « Patch \? » → Oui/);
  assert.match(o.reason, /control-room listen/);
  assert.equal(delivery.pendingFor().length, 0);
  assert.equal((await runHook('stop', { hook_event_name: 'Stop', stop_hook_active: true })).out, '');
});
