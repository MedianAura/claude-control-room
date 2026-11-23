// Corrections de la revue finale (une par test, numéros de la revue).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs, HOST } = require('./helpers');
const { createDelivery } = require('../plugin/lib/delivery');
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const right = require('../plugin/lib/right');
const sessions = require('../plugin/lib/sessions');
const board = require('../plugin/lib/board');
const { writeJson } = require('../plugin/lib/store');
const { pendingCards } = require('../plugin/lib/cards');

let t, dir, delivery;
async function boot(opts = {}) {
  dir = tempStateDir('cr-review-');
  delivery = createDelivery({ ackTimeoutMs: 300 });
  t = await startTestServer({
    deliver: delivery.deliver,
    routes: [...delivery.routes, ...orchRoutes.routes, ...right.routes, ...sessions.routes(delivery)],
    state: () => ({ sessions: sessions.list() }),
    ...opts,
  });
}
test.afterEach(async () => { await t.close(); });
const state = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json;
const newCard = async (body) => (await request(t.port, 'POST', '/api/cards', { body, headers: clientHeaders(t) })).json.id;
const answer = (id, choice, note) => request(t.port, 'POST', '/api/answer', { body: { id, choice, note }, headers: pageHeaders(t) });

test('#1 an approval nobody waits for anymore expires and cannot be approved', async () => {
  await boot({ approvalIdleMs: 200 });
  const id = await newCard({ kind: 'approval', agent: 'b2', summary: 'rm', session: 'K1' });
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await state()).pending.length, 0);
  assert.equal((await answer(id, 'allow')).status, 409);
});

test('#1 an approval stays while its hook is still waiting', async () => {
  await boot({ approvalIdleMs: 200 });
  const id = await newCard({ kind: 'approval', agent: 'b2', summary: 'rm', session: 'K1' });
  const poll = request(t.port, 'GET', `/api/cards/${id}/answer?wait=2`, { headers: clientHeaders(t) });
  await new Promise(r => setTimeout(r, 400));
  assert.equal((await state()).pending.length, 1);
  assert.equal((await answer(id, 'allow')).status, 200);
  assert.equal((await poll).json.choice, 'allow');
});

test('#1 the hook can expire its own approval card', async () => {
  await boot();
  const id = await newCard({ kind: 'approval', agent: 'b2', summary: 'rm', session: 'K1' });
  assert.equal((await request(t.port, 'POST', `/api/cards/${id}/expire`, { headers: clientHeaders(t) })).status, 200);
  assert.equal((await state()).pending.length, 0);
});

test('#4 a capture far over the limit gets 413, not a reset connection', async () => {
  await boot();
  const big = JSON.stringify({ text: 'x', image: 'data:image/png;base64,' + Buffer.alloc(13 * 1024 * 1024, 1).toString('base64') });
  const r = await request(t.port, 'POST', '/api/message', { raw: big, headers: pageHeaders(t) });
  assert.equal(r.status, 413);
});

test('#5 clicking Lu on a reply card does not wake the orchestrator', async () => {
  dir = tempStateDir('cr-review-');
  t = await startTestServer(); // collecteur t.delivered : toute livraison s'y voit
  const id = await newCard({ kind: 'reply', agent: 'Orchestratrice', summary: 'Build lancé.' });
  assert.equal((await answer(id, 'read')).status, 200);
  assert.deepEqual(t.delivered, []);
});

test('#5 a reply card answered with a note does reach the orchestrator', async () => {
  await boot();
  await claimAs(t, 'A');
  const id = await newCard({ kind: 'reply', agent: 'Orchestratrice', summary: 'Build lancé.' });
  await answer(id, 'note', 'relance-le après le souper');
  assert.match(delivery.pendingFor()[0].text, /relance-le après le souper/);
});

test('#6 answers and approvals appear in the history, newest first', async () => {
  await boot();
  const d = await newCard({ kind: 'decision', agent: 'Vol', summary: 'Patch ?', options: ['Oui', 'Non'] });
  await answer(d, '1');
  const a = await newCard({ kind: 'approval', agent: 'b2', summary: 'b2 veut utiliser Bash', session: 'K1', tool: { name: 'Bash', input: { command: 'docker compose build' } } });
  await answer(a, 'deny');
  const recent = (await state()).recent;
  assert.match(recent[0].text, /b2.*Refusé/);
  assert.match(recent[1].text, /Vol — « Patch \? » → Oui/);
});

test('#9 the page only answers on its dedicated loopback host', async () => {
  await boot();
  assert.notEqual(HOST, '127.0.0.1');
  const r = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}`, host: `127.0.0.1:${t.port}` } });
  assert.equal(r.status, 403);
});

test('#11 the last open test of a plan asks for archiving, once', async () => {
  dir = tempStateDir('cr-review-');
  t = await startTestServer({ routes: right.routes }); // collecteur t.delivered, sans file de livraison
  const file = path.join(dir, '.control-room', 'board.json');
  writeJson(path.join(dir, 'orchestrator.json'), { plans: dir, board: file });
  const first = board.addItem(file, 'test', { text: 'premier test', plan: 'feature-a', task: 'Task 1' });
  const second = board.addItem(file, 'test', { text: 'second test', plan: 'feature-a', task: 'Task 2' });
  const other = board.addItem(file, 'test', { text: 'autre test', plan: 'feature-b' });
  const loose = board.addItem(file, 'test', { text: 'hors plan' });
  const ok = (id) => request(t.port, 'POST', '/api/test', { body: { id, result: 'ok' }, headers: pageHeaders(t) });
  const notices = () => t.delivered.filter(x => /propose l'archivage/.test(x));
  await ok(first.id);
  assert.equal(notices().length, 0);
  await ok(second.id);
  assert.deepEqual(notices(), ["[control-room] Tous les tests de « feature-a » sont OK : propose l'archivage."]);
  assert.equal((await ok(second.id)).status, 409);
  await ok(loose.id);
  assert.equal(notices().length, 1);
  assert.equal(board.readBoard(file).items.find(i => i.id === other.id).state, 'open');
});

test('#12 SessionEnd removes the session line', async () => {
  await boot();
  const ev = (event) => request(t.port, 'POST', '/api/sessions/event', { body: { key: 'K1', session_id: 'abcd', cwd: 'F:/x', event }, headers: clientHeaders(t) });
  await ev('SessionStart');
  await request(t.port, 'POST', '/api/sessions/label', { body: { key: 'K1', label: 'w' }, headers: clientHeaders(t) });
  assert.equal((await state()).sessions.length, 1);
  await ev('SessionEnd');
  assert.equal((await state()).sessions.length, 0);
});

test('#12 a session silent for hours drops off the strip', async () => {
  await boot();
  await request(t.port, 'POST', '/api/sessions/event', { body: { key: 'K1', session_id: 'abcd', cwd: 'F:/x', event: 'PreToolUse', tool_name: 'Bash' }, headers: clientHeaders(t) });
  await request(t.port, 'POST', '/api/sessions/label', { body: { key: 'K1', label: 'w' }, headers: clientHeaders(t) });
  assert.equal((await state()).sessions.length, 1);
  const f = fs.readdirSync(path.join(dir, 'sessions'))[0];
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'sessions', f), 'utf8'));
  s.at = Date.now() - 3 * 3600e3;
  fs.writeFileSync(path.join(dir, 'sessions', f), JSON.stringify(s));
  assert.equal((await state()).sessions.length, 0);
});
