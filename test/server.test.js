const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders } = require('./helpers');

let t, dir;
test.beforeEach(async () => { dir = tempStateDir('cr-server-'); t = await startTestServer(); });
test.afterEach(async () => { await t.close(); });

async function newCard(body = { kind: 'decision', agent: 'Quick Upgrade', summary: 'Retrait auto ?', options: ['Auto', 'Bouton'] }) {
  const r = await request(t.port, 'POST', '/api/cards', { body, headers: clientHeaders(t) });
  assert.equal(r.status, 200);
  return r.json.id;
}
const pageAnswer = (id, choice, extra = {}) =>
  request(t.port, 'POST', '/api/answer', { body: { id, choice }, headers: { ...pageHeaders(t), ...extra } });

test('a card cannot be created without the client secret', async () => {
  const r = await request(t.port, 'POST', '/api/cards', { body: { agent: 'A', summary: 'q', options: ['x'] } });
  assert.equal(r.status, 403);
});

test('the client secret cannot answer a card', async () => {
  const id = await newCard();
  const r = await request(t.port, 'POST', '/api/answer', { body: { id, choice: '1' }, headers: clientHeaders(t) });
  assert.equal(r.status, 403);
});

test('a page write from another origin is refused', async () => {
  const id = await newCard();
  assert.equal((await pageAnswer(id, '1', { origin: 'http://evil.test' })).status, 403);
});

test('a page write with a foreign Host is refused', async () => {
  const id = await newCard();
  assert.equal((await pageAnswer(id, '1', { host: `evil.test:${t.port}` })).status, 403);
});

test('a page write with a wrong cookie is refused', async () => {
  const id = await newCard();
  assert.equal((await pageAnswer(id, '1', { cookie: 'cr_page=00' })).status, 403);
});

test('answering delivers once and a second answer gets 409', async () => {
  const id = await newCard();
  assert.equal((await pageAnswer(id, '2')).status, 200);
  assert.equal((await pageAnswer(id, '1')).status, 409);
  assert.equal(t.delivered.length, 1);
  assert.match(t.delivered[0], /Quick Upgrade/);
});

test('an approval answer is not delivered to the orchestrator', async () => {
  const id = await newCard({ kind: 'approval', agent: 'Builds', summary: 'docker compose build', session: 's1' });
  assert.equal((await pageAnswer(id, 'allow')).status, 200);
  assert.equal(t.delivered.length, 0);
});

test('the long poll returns the answer as soon as it exists', async () => {
  const id = await newCard({ kind: 'approval', agent: 'Builds', summary: 'rm', session: 's1' });
  setTimeout(() => pageAnswer(id, 'deny', {}), 200);
  const started = Date.now();
  const r = await request(t.port, 'GET', `/api/cards/${id}/answer?wait=5`, { headers: clientHeaders(t) });
  assert.equal(r.status, 200);
  assert.equal(r.json.choice, 'deny');
  assert.ok(Date.now() - started < 1500);
});

test('the long poll gives 204 when nobody answers in time', async () => {
  const id = await newCard({ kind: 'approval', agent: 'Builds', summary: 'rm', session: 's1' });
  const r = await request(t.port, 'GET', `/api/cards/${id}/answer?wait=1`, { headers: clientHeaders(t) });
  assert.equal(r.status, 204);
});

test('the key URL sets an HttpOnly cookie and redirects to /', async () => {
  const r = await request(t.port, 'GET', `/?k=${t.bootstrapKey}`);
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/');
  assert.equal(r.headers['set-cookie'][0], `cr_page=${t.pageSecret}; HttpOnly; SameSite=Strict; Path=/`);
});

test('the key URL works only once', async () => {
  assert.equal((await request(t.port, 'GET', `/?k=${t.bootstrapKey}`)).status, 302);
  assert.equal((await request(t.port, 'GET', `/?k=${t.bootstrapKey}`)).status, 403);
});

test('the page secret itself is not a valid key', async () => {
  assert.equal((await request(t.port, 'GET', `/?k=${t.pageSecret}`)).status, 403);
});

test('the page without the cookie asks for the launcher URL', async () => {
  const r = await request(t.port, 'GET', '/');
  assert.equal(r.status, 401);
  assert.match(r.text, /control-room start/);
});

test('the state lists pending cards for the page only', async () => {
  await newCard();
  assert.equal((await request(t.port, 'GET', '/api/state')).status, 403);
  const r = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } });
  assert.equal(r.status, 200);
  assert.equal(r.json.pending.length, 1);
});

test('the page secret never reaches the state dir', async () => {
  const id = await newCard();
  await pageAnswer(id, '1');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(dir)) assert.ok(!fs.readFileSync(f, 'utf8').includes(t.pageSecret), f);
});
