const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders } = require('./helpers');
const { deliverTo } = require('../plugin/lib/inbox');
const { createDelivery } = require('../plugin/lib/delivery');
const { readJson } = require('../plugin/lib/store');

// Faux canal nommé qui enregistre les lignes reçues, comme la boîte d'une session.
async function fakeInbox() {
  const name = process.platform === 'win32' ? `\\\\.\\pipe\\cr-test-${crypto.randomBytes(4).toString('hex')}` : path.join(require('os').tmpdir(), `cr-${crypto.randomBytes(4).toString('hex')}.sock`);
  const lines = [];
  const srv = net.createServer((c) => { let buf = ''; c.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(buf.slice(0, i)); buf = buf.slice(i + 1); } }); });
  await new Promise(r => srv.listen(name, r));
  return { socket: name, lines, close: () => new Promise(r => srv.close(r)) };
}

let t, dir, delivery;
test.beforeEach(async () => {
  dir = tempStateDir('cr-claim-');
  delivery = createDelivery({ ackTimeoutMs: 300 });
  t = await startTestServer({ deliver: delivery.deliver, routes: delivery.routes, state: () => ({ alerts: delivery.alerts() }) });
});
test.afterEach(async () => { await t.close(); });

const claim = (body) => request(t.port, 'POST', '/api/claim', { body: { project: 'F:/p', plans: 'F:/p/plans', master: 'F:/p/plans/m/plan.md', ...body }, headers: clientHeaders(t) });
const outbox = (socket, wait = 0) => request(t.port, 'GET', `/api/outbox?socket=${encodeURIComponent(socket)}&wait=${wait}`, { headers: clientHeaders(t) });
async function answeredCard() {
  const r = await request(t.port, 'POST', '/api/cards', { body: { kind: 'decision', agent: 'Quick Upgrade', summary: 'Retrait ?', options: ['Auto', 'Bouton'] }, headers: clientHeaders(t) });
  await request(t.port, 'POST', '/api/answer', { body: { id: r.json.id, choice: '2' }, headers: pageHeaders(t) });
}

test('deliverTo writes the auth line then a user message', async () => {
  const inbox = await fakeInbox();
  await deliverTo({ socket: inbox.socket, token: 't0' }, 'bonjour');
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(JSON.parse(inbox.lines[0]), { type: 'auth', token: 't0' });
  assert.deepEqual(JSON.parse(inbox.lines[1]), { type: 'user', from: 'control-room', message: { content: 'bonjour' } });
  await inbox.close();
});

test('claim then answer: one listener round delivers the auth line then the message', async () => {
  const { listenOnce } = require('../plugin/lib/listener');
  const inbox = await fakeInbox();
  try {
    await claim({ socket: inbox.socket, token: 't0' });
    await answeredCard();
    const r = await listenOnce({ socket: inbox.socket, token: 't0' }, { wait: 0 });
    await new Promise(res => setTimeout(res, 50));
    assert.equal(r.delivered, 1);
    assert.deepEqual(JSON.parse(inbox.lines[0]), { type: 'auth', token: 't0' });
    assert.match(JSON.parse(inbox.lines[1]).message.content, /Quick Upgrade/);
  } finally { await inbox.close(); }
});

test('a re-claim by the same inbox resends what was never acked', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  await outbox('A');
  await claim({ socket: 'A', token: 'ta' });
  assert.equal((await outbox('A')).json.messages.length, 1);
});

test('claim records the orchestrator and its project paths', async () => {
  assert.equal((await claim({ socket: 'A', token: 'ta' })).status, 200);
  const o = readJson(path.join(dir, 'orchestrator.json'));
  assert.equal(o.socket, 'A');
  assert.equal(o.master, 'F:/p/plans/m/plan.md');
});

test('claim needs the client secret', async () => {
  const r = await request(t.port, 'POST', '/api/claim', { body: { socket: 'A', token: 'ta' } });
  assert.equal(r.status, 403);
});

test('an answer goes to the claimed orchestrator outbox with its ack mark', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  const r = await outbox('A');
  assert.equal(r.json.messages.length, 1);
  assert.match(r.json.messages[0].text, /Quick Upgrade/);
  assert.match(r.json.messages[0].text, new RegExp(`\\[cr:${r.json.messages[0].id}\\]`));
});

test('the outbox long poll wakes as soon as a message exists', async () => {
  await claim({ socket: 'A', token: 'ta' });
  setTimeout(answeredCard, 200);
  const started = Date.now();
  const r = await outbox('A', 5);
  assert.equal(r.json.messages.length, 1);
  assert.ok(Date.now() - started < 1500);
});

test('a new claim takes over and warns the previous inbox', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await claim({ socket: 'B', token: 'tb' });
  const a = await outbox('A');
  assert.match(a.json.messages[0].text, /Une autre orchestratrice a pris le relais/);
  assert.equal(a.json.superseded, true);
  await answeredCard();
  assert.equal((await outbox('B')).json.messages.length, 1);
});

test('pending answers survive a takeover', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  await claim({ socket: 'B', token: 'tb' });
  const b = await outbox('B');
  assert.ok(b.json.messages.some(m => /Quick Upgrade/.test(m.text)));
});

test('an acked message leaves the outbox and raises no alert', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  const m = (await outbox('A')).json.messages[0];
  assert.equal((await request(t.port, 'POST', '/api/ack', { body: { id: m.id }, headers: clientHeaders(t) })).status, 200);
  await new Promise(r => setTimeout(r, 400));
  assert.deepEqual(delivery.alerts(), []);
  assert.equal((await outbox('A')).json.messages.length, 0);
});

test('a message handed out but never acked raises an alert', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  await outbox('A');
  await new Promise(r => setTimeout(r, 400));
  assert.match(delivery.alerts()[0], /Livraison à l'orchestratrice/);
});

test('a message nobody picks up raises the missing-listener alert', async () => {
  await claim({ socket: 'A', token: 'ta' });
  await answeredCard();
  await new Promise(r => setTimeout(r, 400));
  assert.match(delivery.alerts()[0], /control-room listen/);
});

test('active plans are declared by the orchestrator', async () => {
  const r = await request(t.port, 'POST', '/api/plans', { body: { name: 'dungeon-speed', dir: 'F:/p/plans/dungeon-speed', label: '🏃', state: 'active' }, headers: clientHeaders(t) });
  assert.equal(r.status, 200);
  assert.deepEqual(readJson(path.join(dir, 'active-plans.json')), [{ name: 'dungeon-speed', dir: 'F:/p/plans/dungeon-speed', label: '🏃' }]);
  await request(t.port, 'POST', '/api/plans', { body: { name: 'dungeon-speed', state: 'archived' }, headers: clientHeaders(t) });
  assert.deepEqual(readJson(path.join(dir, 'active-plans.json')), []);
});
