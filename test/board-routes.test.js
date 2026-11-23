const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs } = require('./helpers');
const { createDelivery } = require('../plugin/lib/delivery');
const { readEvents } = require('../plugin/lib/store');
const { readBoard } = require('../plugin/lib/board');

let t, dir, boardPath;
test.beforeEach(async () => {
  dir = tempStateDir('cr-board-routes-');
  boardPath = path.join(dir, 'proj', 'board.json');
  const delivery = createDelivery();
  t = await startTestServer({ deliver: delivery.deliver, routes: [...delivery.routes, ...require('../plugin/lib/board-routes').routes] });
});
test.afterEach(async () => { await t.close(); });

const post = (p, body, headers = clientHeaders(t)) => request(t.port, 'POST', p, { body, headers });
const get = (p, headers = clientHeaders(t)) => request(t.port, 'GET', p, { headers });
const events = () => readEvents().map(e => e.text);

test('add_test via the client secret returns an id and an event', async () => {
  await claimAs(t, 'A', { board: boardPath });
  const r = await post('/api/board/items', { kind: 'test', text: 'scan', plan: 'p' });
  assert.equal(r.status, 200);
  assert.match(r.json.id, /^[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(readBoard(boardPath).items[0].text, 'scan');
  assert.ok(events().includes(`test ajouté #${r.json.id} : scan`));
});

test('the page secret cannot use the board routes', async () => {
  await claimAs(t, 'A', { board: boardPath });
  assert.equal((await post('/api/board/items', { kind: 'test', text: 'x' }, pageHeaders(t))).status, 403);
  assert.equal((await get('/api/board', pageHeaders(t))).status, 403);
});

test('no board claimed → 409 no-board', async () => {
  let r = await post('/api/board/items', { kind: 'todo', text: 'x' });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'no-board');
  await claimAs(t, 'A');
  r = await get('/api/board');
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'no-board');
});

test('an unknown id → 404, bad input → 400, wrong state → 409', async () => {
  await claimAs(t, 'A', { board: boardPath });
  assert.equal((await post('/api/board/items/ZZZZ/note', { text: 'x' })).status, 404);
  assert.equal((await post('/api/board/items', { kind: 'test', text: '' })).status, 400);
  assert.equal((await post('/api/board/items', { kind: 'test', text: 'x', plan: 3 })).status, 400);
  const { id } = (await post('/api/board/items', { kind: 'test', text: 'x' })).json;
  assert.equal((await post(`/api/board/items/${id}/close`, { state: 'done' })).status, 409);
});

test('an unreadable board → 409 and the file is untouched', async () => {
  await claimAs(t, 'A', { board: boardPath });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(boardPath, '{pas du json');
  const r = await post('/api/board/items', { kind: 'test', text: 'x' });
  assert.equal(r.status, 409);
  assert.ok(r.json.error);
  assert.equal(fs.readFileSync(boardPath, 'utf8'), '{pas du json');
});

test('update, note, close, remove and reopen work and log events', async () => {
  await claimAs(t, 'A', { board: boardPath });
  const tid = (await post('/api/board/items', { kind: 'test', text: 'a' })).json.id;
  const did = (await post('/api/board/items', { kind: 'todo', text: 'b' })).json.id;
  assert.equal((await post(`/api/board/items/${tid}`, { weight: 'high' })).json.item.weight, 'high');
  assert.equal((await post(`/api/board/items/${tid}/note`, { text: 'n' })).json.item.notes.length, 1);
  assert.equal((await post(`/api/board/items/${did}/close`, { state: 'dropped', note: 'inutile' })).json.item.state, 'dropped');
  assert.equal((await post(`/api/board/items/${did}/reopen`, { reason: 'si' })).json.item.state, 'open');
  assert.equal((await post(`/api/board/items/${tid}/remove`, { reason: 'doublon' })).json.item.state, 'removed');
  const log = events();
  for (const s of [`TODO #${did} abandonné`, `#${did} rouvert : si`, `#${tid} retiré : doublon`]) assert.ok(log.includes(s), s);
});

test('GET /api/board filters by kind and state', async () => {
  await claimAs(t, 'A', { board: boardPath });
  const a = (await post('/api/board/items', { kind: 'test', text: 'a' })).json.id;
  await post('/api/board/items', { kind: 'todo', text: 'b' });
  await post(`/api/board/items/${a}/remove`, { reason: 'x' });
  assert.equal((await get('/api/board')).json.items.length, 2);
  assert.deepEqual((await get('/api/board?kind=todo')).json.items.map(i => i.text), ['b']);
  assert.deepEqual((await get('/api/board?state=removed')).json.items.map(i => i.text), ['a']);
  assert.equal((await get('/api/board')).json.error, null);
});
