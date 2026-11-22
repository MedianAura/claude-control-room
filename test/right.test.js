const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request, pageHeaders } = require('./helpers');
const { rightState, routes } = require('../plugin/lib/right');
const { writeJson } = require('../plugin/lib/store');
const { parseMaster } = require('../plugin/lib/plan-file');
const { pendingCards } = require('../plugin/lib/cards');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'master-plan.md'), 'utf8');
let t, dir, master, plansRoot;

test.beforeEach(async () => {
  dir = tempStateDir('cr-right-');
  plansRoot = path.join(dir, 'plans');
  fs.mkdirSync(path.join(plansRoot, 'dungeon-speed'), { recursive: true });
  fs.writeFileSync(path.join(plansRoot, 'dungeon-speed', 'plan.md'), '- [x] a\n- [ ] b\n');
  master = path.join(dir, 'master.md');
  fs.writeFileSync(master, fixture);
  writeJson(path.join(dir, 'orchestrator.json'), { master, plans: plansRoot });
  t = await startTestServer({ routes, state: () => ({ right: rightState() }) });
});
test.afterEach(async () => { await t.close(); });

const openTest = () => parseMaster(fixture).tests.find(x => !x.done);

test('the right column lists only open tests and open todos', () => {
  const r = rightState();
  assert.equal(r.tests.length, parseMaster(fixture).tests.filter(x => !x.done).length);
  assert.ok(!r.todos.some(x => x.name === 'Dungeon speed'));
});

test('active plans show their progress from their own plan file', () => {
  writeJson(path.join(dir, 'active-plans.json'), [{ name: 'dungeon-speed', dir: path.join(plansRoot, 'dungeon-speed'), label: '🏃 dungeon-speed' }]);
  assert.deepEqual(rightState().plans, [{ name: 'dungeon-speed', label: '🏃 dungeon-speed', done: 1, total: 2 }]);
});

test('without a claimed orchestrator the column is empty', () => {
  fs.unlinkSync(path.join(dir, 'orchestrator.json'));
  assert.deepEqual(rightState(), { tests: [], plans: [], todos: [] });
});

test('OK from the page ticks the box in the master plan', async () => {
  const r = await request(t.port, 'POST', '/api/test', { body: { text: openTest().text, result: 'ok' }, headers: pageHeaders(t) });
  assert.equal(r.status, 200);
  assert.ok(parseMaster(fs.readFileSync(master, 'utf8')).tests.find(x => x.text === openTest().text).done);
  assert.equal(t.delivered.length, 0);
});

test('a problem sends the note to the orchestrator and leaves the box open', async () => {
  const o = openTest();
  const r = await request(t.port, 'POST', '/api/test', { body: { text: o.text, result: 'fail', note: 'le son boucle encore' }, headers: pageHeaders(t) });
  assert.equal(r.status, 200);
  assert.equal(t.delivered.length, 1);
  assert.match(t.delivered[0], new RegExp(`Test KO — ${o.parent}`));
  assert.match(t.delivered[0], /Note : le son boucle encore/);
  assert.equal(fs.readFileSync(master, 'utf8'), fixture);
});

test('a vanished test makes an error card and writes nothing', async () => {
  const r = await request(t.port, 'POST', '/api/test', { body: { text: 'disparu', result: 'ok' }, headers: pageHeaders(t) });
  assert.equal(r.status, 409);
  assert.equal(pendingCards().filter(c => c.kind === 'error').length, 1);
  assert.equal(fs.readFileSync(master, 'utf8'), fixture);
});

test('the client secret cannot tick a test', async () => {
  const r = await request(t.port, 'POST', '/api/test', { body: { text: openTest().text, result: 'ok' }, headers: { 'x-cr-secret': t.clientSecret } });
  assert.equal(r.status, 403);
});
