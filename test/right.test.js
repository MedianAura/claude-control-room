const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request, pageHeaders } = require('./helpers');
const right = require('../plugin/lib/right');
const { rightState, routes } = right;
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const board = require('../plugin/lib/board');
const { writeJson } = require('../plugin/lib/store');
const { pendingCards } = require('../plugin/lib/cards');
const { projectKey } = require('../plugin/lib/active-plans');

let t, dir, boardPath, plansRoot;

test.beforeEach(async () => {
  dir = tempStateDir('cr-right-');
  plansRoot = path.join(dir, 'plans');
  fs.mkdirSync(path.join(plansRoot, 'dungeon-speed'), { recursive: true });
  fs.writeFileSync(path.join(plansRoot, 'dungeon-speed', 'plan.md'), '- [x] a\n- [ ] b\n');
  boardPath = path.join(dir, '.control-room', 'board.json');
  writeJson(path.join(dir, 'orchestrator.json'), { project: dir, plans: plansRoot, board: boardPath });
  t = await startTestServer({ routes, state: () => ({ right: rightState() }) });
});
test.afterEach(async () => { await t.close(); });

// Élément à identifiant choisi (« 45BG ») : on souffle les tirages à board._random.
function addWithId(id, kind, fields) {
  const real = board._random;
  const draws = [...id].map(c => board.ID_ALPHABET.indexOf(c));
  board._random = () => draws.shift();
  try { return board.addItem(boardPath, kind, fields); } finally { board._random = real; }
}
const ok = (id, headers = pageHeaders(t)) => request(t.port, 'POST', '/api/test', { body: { id, result: 'ok' }, headers });
const ko = (id, note) => request(t.port, 'POST', '/api/test', { body: { id, result: 'fail', note }, headers: pageHeaders(t) });
const item = (id) => board.readBoard(boardPath).items.find(i => i.id === id);

test('the right column shows open items grouped by the board view', () => {
  writeJson(path.join(dir, 'active-plans.json'), { [projectKey(dir)]: [{ name: 'dungeon-speed', dir: path.join(plansRoot, 'dungeon-speed'), label: '🏃 dungeon-speed' }] });
  const a = board.addItem(boardPath, 'test', { text: 'scan', plan: 'dungeon-speed', task: 'Task 4: Deploy' });
  const b = board.addItem(boardPath, 'test', { text: 'hors plan', weight: 'high' });
  const c = board.addItem(boardPath, 'test', { text: 'déjà vu', plan: 'dungeon-speed', task: 'Task 4: Deploy' });
  board.tickTest(boardPath, c.id);
  const d = board.addItem(boardPath, 'todo', { text: 'Bag cleaner', weight: 'low', group: 'Bags' });
  const r = rightState();
  assert.deepEqual(Object.keys(r), ['board', 'tests', 'plans', 'todos']);
  assert.deepEqual(r.board, { error: null });
  assert.deepEqual(r.tests.map(g => [g.plan, g.label, g.tasks.map(k => [k.task, k.items.map(i => i.id)])]), [
    ['dungeon-speed', '🏃 dungeon-speed', [['Task 4: Deploy', [a.id]]]],
    [null, 'Hors plan', [[null, [b.id]]]],
  ]);
  assert.deepEqual(r.todos.map(g => [g.group, g.label, g.items.map(i => i.id)]), [['Bags', 'Bags', [d.id]]]);
  assert.deepEqual(r.plans, [{ name: 'dungeon-speed', label: '🏃 dungeon-speed', done: 1, total: 2, tasks: [] }]);
});

test('the column only shows the plans of the declared project', () => {
  const plan = { name: 'dungeon-speed', dir: path.join(plansRoot, 'dungeon-speed'), label: '🏃' };
  writeJson(path.join(dir, 'active-plans.json'), { [projectKey(path.join(dir, 'other'))]: [plan] });
  assert.deepEqual(rightState().plans, []);
});

test('an old-format plans file (one list for every project) shows no plan', () => {
  writeJson(path.join(dir, 'active-plans.json'), [{ name: 'dungeon-speed', dir: path.join(plansRoot, 'dungeon-speed'), label: '🏃' }]);
  assert.deepEqual(rightState().plans, []);
});

test('without a claimed orchestrator the column is empty', () => {
  fs.unlinkSync(path.join(dir, 'orchestrator.json'));
  assert.deepEqual(rightState(), { board: { error: null }, tests: [], plans: [], todos: [] });
});

test('an unreadable board is shown, not emptied', async () => {
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(boardPath, '{ "items": [ cassé');
  const r = rightState();
  assert.ok(r.board.error);
  assert.deepEqual(r.tests, []);
  assert.equal((await ok('45BG')).status, 409);
  assert.equal(fs.readFileSync(boardPath, 'utf8'), '{ "items": [ cassé');
  assert.equal(pendingCards().filter(c => c.kind === 'error').length, 1);
  assert.deepEqual(t.delivered, []);
});

test('OK ticks the test and tells the orchestrator', async () => {
  addWithId('45BG', 'test', { text: 'scan', plan: 'p', task: 'Task 4' });
  addWithId('K2P9', 'test', { text: 'autre', plan: 'p' });
  const r = await ok('45BG');
  assert.equal(r.status, 200);
  assert.equal(item('45BG').state, 'ok');
  assert.deepEqual(t.delivered, ['[control-room] Test OK #45BG : fais cocher son étape dans le plan.']);
});

test('KO keeps the test open, stores the note and delivers it', async () => {
  addWithId('45BG', 'test', { text: 'scan', plan: 'p' });
  const r = await ko('45BG', 'le son boucle encore');
  assert.equal(r.status, 200);
  const it = item('45BG');
  assert.equal(it.state, 'open');
  assert.deepEqual(it.notes.map(n => [n.by, n.text]), [['user', 'le son boucle encore']]);
  assert.deepEqual(t.delivered, ['[control-room] Test KO #45BG\nNote : le son boucle encore']);
});

test('a second OK on the same test is refused and delivers nothing', async () => {
  addWithId('45BG', 'test', { text: 'scan', plan: 'p' });
  addWithId('K2P9', 'test', { text: 'autre', plan: 'p' });
  await ok('45BG');
  const before = t.delivered.length;
  assert.equal((await ok('45BG')).status, 409);
  assert.equal(t.delivered.length, before);
});

test('an unknown id → 409 and an error card', async () => {
  board.addItem(boardPath, 'test', { text: 'scan' });
  const before = fs.readFileSync(boardPath, 'utf8');
  const r = await ok('ZZZZ');
  assert.equal(r.status, 409);
  assert.equal(pendingCards().filter(c => c.kind === 'error').length, 1);
  assert.equal(fs.readFileSync(boardPath, 'utf8'), before);
  assert.deepEqual(t.delivered, []);
});

test('the client secret cannot tick a test', async () => {
  addWithId('45BG', 'test', { text: 'scan' });
  const r = await ok('45BG', { 'x-cr-secret': t.clientSecret });
  assert.equal(r.status, 403);
  assert.equal(item('45BG').state, 'open');
});

test('wrapDeliver appends the refs block', async () => {
  addWithId('45BG', 'test', { text: 'scan', plan: 'crucible', task: 'Task 4', weight: 'high', origin: { file: 'crucible/plan.md', step: 'Step 4' } });
  const delivered = [];
  const s = await startTestServer({ routes: orchRoutes.routes, deliver: right.wrapDeliver(async (x) => { delivered.push(x); }) });
  try {
    const r = await request(s.port, 'POST', '/api/message', { body: { text: 'Clarifie #45bg, et #ZZZZ' }, headers: pageHeaders(s) });
    assert.equal(r.status, 200);
  } finally { await s.close(); }
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0], "[control-room] Message de l'utilisateur : Clarifie #45bg, et #ZZZZ\n#45BG (test, crucible › Task 4, high) : scan\n  origine : crucible/plan.md, Step 4");
});

test('withRefs leaves a text without known ids untouched', () => {
  assert.equal(right.withRefs('rien #ZZZZ'), 'rien #ZZZZ');
});

test('a KO without a note and a malformed body → 400, nothing written', async () => {
  addWithId('45BG', 'test', { text: 'scan' });
  const before = fs.readFileSync(boardPath, 'utf8');
  assert.equal((await ko('45BG', '  ')).status, 400);
  assert.equal((await ko('45BG')).status, 400);
  for (const body of [{ id: '45BG', result: 'maybe' }, { result: 'ok' }, { id: 3, result: 'ok' }]) {
    assert.equal((await request(t.port, 'POST', '/api/test', { body, headers: pageHeaders(t) })).status, 400, JSON.stringify(body));
  }
  assert.equal((await request(t.port, 'POST', '/api/test', { raw: '{pas du json', headers: pageHeaders(t) })).status, 400);
  assert.equal(fs.readFileSync(boardPath, 'utf8'), before);
  assert.deepEqual(t.delivered, []);
});

test('OK accepts a lowercase id and delivers the canonical one', async () => {
  addWithId('45BG', 'test', { text: 'scan' });
  assert.equal((await ok('45bg')).status, 200);
  assert.equal(item('45BG').state, 'ok');
  assert.deepEqual(t.delivered, ['[control-room] Test OK #45BG : fais cocher son étape dans le plan.']);
});

test('OK through wrapDeliver carries the refs block with the closed state', async () => {
  addWithId('45BG', 'test', { text: 'scan', plan: 'p', task: 'Task 4' });
  addWithId('K2P9', 'test', { text: 'autre', plan: 'p' });
  const delivered = [];
  const s = await startTestServer({ routes, deliver: right.wrapDeliver(async (x) => { delivered.push(x); }) });
  try {
    assert.equal((await request(s.port, 'POST', '/api/test', { body: { id: '45BG', result: 'ok' }, headers: pageHeaders(s) })).status, 200);
  } finally { await s.close(); }
  assert.deepEqual(delivered, ['[control-room] Test OK #45BG : fais cocher son étape dans le plan.\n#45BG (test, p › Task 4, medium, ok) : scan']);
});

test('a claimed orchestrator without a board says so instead of an empty column', async () => {
  writeJson(path.join(dir, 'orchestrator.json'), { plans: plansRoot });
  const r = rightState();
  assert.equal(r.board.error, 'aucun tableau déclaré : refaire control-room claim … --board <fichier>');
  const res = await ok('45BG');
  assert.equal(res.status, 409);
  assert.equal(res.json.error, r.board.error);
});

test('a board that view cannot render is reported, not a 500', (t2) => {
  addWithId('45BG', 'test', { text: 'scan' });
  const real = board.view;
  board.view = () => { throw new TypeError('x.localeCompare is not a function'); };
  t2.after(() => { board.view = real; });
  const r = rightState();
  assert.match(r.board.error, /localeCompare/);
  assert.deepEqual([r.tests, r.todos], [[], []]);
});

test('withRefs lists cited ids it cannot expand when the board is unreadable', () => {
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(boardPath, '{ cassé');
  assert.equal(right.withRefs('voir #45bg et #K2P9, #45BG'), 'voir #45bg et #K2P9, #45BG\n(tableau illisible : #45BG, #K2P9 non développés)');
  assert.equal(right.withRefs('rien à citer #1'), 'rien à citer #1');
});
