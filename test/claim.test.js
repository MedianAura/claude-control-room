const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs, HOST } = require('./helpers');
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

const outbox = (claimId, wait = 0) => request(t.port, 'GET', `/api/outbox?claim=${claimId}&wait=${wait}`, { headers: clientHeaders(t) });
async function answeredCard() {
  const r = await request(t.port, 'POST', '/api/cards', { body: { kind: 'decision', agent: 'Quick Upgrade', summary: 'Retrait ?', options: ['Auto', 'Bouton'] }, headers: clientHeaders(t) });
  await request(t.port, 'POST', '/api/answer', { body: { id: r.json.id, choice: '2' }, headers: pageHeaders(t) });
}

test('deliverTo writes the auth line then a user message', async () => {
  const inbox = await fakeInbox();
  try {
    await deliverTo({ socket: inbox.socket, token: 't0' }, 'bonjour');
    await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(JSON.parse(inbox.lines[0]), { type: 'auth', token: 't0' });
    assert.deepEqual(JSON.parse(inbox.lines[1]), { type: 'user', from: 'control-room', message: { content: 'bonjour' } });
  } finally { await inbox.close(); }
});

test('claim then answer: one listener round delivers the auth line then the message', async () => {
  const { listenOnce } = require('../plugin/lib/listener');
  const inbox = await fakeInbox();
  try {
    const { claimId, code } = await claimAs(t, inbox.socket);
    await answeredCard();
    const r = await listenOnce({ socket: inbox.socket, token: 't0' }, { claim: claimId, wait: 0 });
    await new Promise(res => setTimeout(res, 50));
    assert.equal(r.delivered, 1);
    assert.deepEqual(JSON.parse(inbox.lines[0]), { type: 'auth', token: 't0' });
    const content = JSON.parse(inbox.lines[1]).message.content;
    assert.match(content, /Quick Upgrade/);
    assert.match(content, new RegExp(`\\[cr:[0-9a-f]+:${code}\\]$`));
  } finally { await inbox.close(); }
});

test('claim returns a claim id and a 6-character trust code', async () => {
  const r = await claimAs(t, 'A');
  assert.match(r.claimId, /^[0-9a-f]{32}$/);
  assert.match(r.code, /^[0-9a-f]{6}$/);
});

test('the orchestrator file keeps only fingerprints, never the socket, token or claim id', async () => {
  const { claimId } = await claimAs(t, 'A', { token: 'secret-token' });
  const raw = JSON.stringify(readJson(path.join(dir, 'orchestrator.json')));
  assert.ok(!raw.includes('"A"') && !raw.includes('secret-token') && !raw.includes(claimId));
  assert.equal(readJson(path.join(dir, 'orchestrator.json')).master, 'F:/p/plans/m/plan.md');
});

test('claim needs the client secret', async () => {
  const r = await request(t.port, 'POST', '/api/claim', { body: { socket: 'A' } });
  assert.equal(r.status, 403);
});

test('an outbox read needs the current claim id', async () => {
  await claimAs(t, 'A');
  await answeredCard();
  assert.equal((await outbox('0'.repeat(32))).status, 403);
});

test('an answer goes to the claimed orchestrator outbox with its ack mark', async () => {
  const { claimId } = await claimAs(t, 'A');
  await answeredCard();
  const r = await outbox(claimId);
  assert.equal(r.json.messages.length, 1);
  assert.match(r.json.messages[0].text, /Quick Upgrade/);
  assert.match(r.json.messages[0].text, new RegExp(`\\[cr:${r.json.messages[0].id}:`));
});

test('the outbox long poll wakes as soon as a message exists', async () => {
  const { claimId } = await claimAs(t, 'A');
  setTimeout(answeredCard, 200);
  const started = Date.now();
  const r = await outbox(claimId, 5);
  assert.equal(r.json.messages.length, 1);
  assert.ok(Date.now() - started < 1500);
});

test('a new claim takes over and warns the previous inbox', async () => {
  const a = await claimAs(t, 'A');
  const b = await claimAs(t, 'B');
  const ra = await outbox(a.claimId);
  assert.match(ra.json.messages[0].text, /Une autre orchestratrice a pris le relais/);
  assert.equal(ra.json.superseded, true);
  await answeredCard();
  assert.equal((await outbox(b.claimId)).json.messages.length, 1);
});

test('pending answers survive a takeover', async () => {
  await claimAs(t, 'A');
  await answeredCard();
  const b = await claimAs(t, 'B');
  assert.ok((await outbox(b.claimId)).json.messages.some(m => /Quick Upgrade/.test(m.text)));
});

test('a re-claim by the same inbox resends what was never acked, without a takeover notice', async () => {
  const a1 = await claimAs(t, 'A');
  await answeredCard();
  await outbox(a1.claimId);
  const a2 = await claimAs(t, 'A');
  const r = await outbox(a2.claimId);
  assert.equal(r.json.messages.length, 1);
  assert.ok(!r.json.messages.some(m => /pris le relais/.test(m.text)));
});

test('an acked message leaves the outbox and raises no alert', async () => {
  const { claimId } = await claimAs(t, 'A');
  await answeredCard();
  const m = (await outbox(claimId)).json.messages[0];
  assert.equal((await request(t.port, 'POST', '/api/ack', { body: { id: m.id }, headers: clientHeaders(t) })).status, 200);
  await new Promise(r => setTimeout(r, 400));
  assert.deepEqual(delivery.alerts(), []);
  assert.equal((await outbox(claimId)).json.messages.length, 0);
});

test('a message handed out but never acked raises an alert', async () => {
  const { claimId } = await claimAs(t, 'A');
  await answeredCard();
  await outbox(claimId);
  await new Promise(r => setTimeout(r, 400));
  assert.match(delivery.alerts()[0], /accusé de réception/);
});

test('a message nobody picks up raises the missing-listener alert', async () => {
  await claimAs(t, 'A');
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

// ---------- revue finale ----------

test('review #2: a long poll whose listener died does not swallow the next answer', async () => {
  const { claimId } = await claimAs(t, 'A');
  await new Promise((resolve) => {
    const req = http.request({ host: HOST, port: t.port, path: `/api/outbox?claim=${claimId}&wait=5`, headers: { host: `${HOST}:${t.port}`, ...clientHeaders(t) } });
    req.on('error', () => {});
    req.end();
    setTimeout(() => { req.destroy(); setTimeout(resolve, 100); }, 150);
  });
  await answeredCard();
  await new Promise(r => setTimeout(r, 100));
  assert.equal((await outbox(claimId)).json.messages.length, 1);
});

test('review #3: a relaunched orchestrator with a healthy listener shows no alert', async () => {
  await claimAs(t, 'OLD');
  const b = await claimAs(t, 'NEW');
  await answeredCard();
  for (const m of (await outbox(b.claimId)).json.messages) await request(t.port, 'POST', '/api/ack', { body: { id: m.id }, headers: clientHeaders(t) });
  await new Promise(r => setTimeout(r, 400));
  assert.deepEqual(delivery.alerts(), []);
});

test('review #7: wait_answers drain needs the current claim id', async () => {
  const { claimId } = await claimAs(t, 'A');
  await answeredCard();
  assert.equal((await request(t.port, 'GET', `/api/outbox/drain?claim=${'1'.repeat(32)}&wait=0`, { headers: clientHeaders(t) })).status, 403);
  const r = await request(t.port, 'GET', `/api/outbox/drain?claim=${claimId}&wait=0`, { headers: clientHeaders(t) });
  assert.equal(r.json.messages.length, 1);
  assert.equal(delivery.pendingFor().length, 0);
});

test('review #7: stale answers are only given to the orchestrator socket', async () => {
  await claimAs(t, 'A');
  await answeredCard();
  await new Promise(r => setTimeout(r, 400));
  assert.equal((await request(t.port, 'GET', '/api/outbox/stale?socket=WORKER', { headers: clientHeaders(t) })).json.messages.length, 0);
  assert.equal((await request(t.port, 'GET', '/api/outbox/stale?socket=A', { headers: clientHeaders(t) })).json.messages.length, 1);
});
