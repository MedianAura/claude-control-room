const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { tempStateDir } = require('./helpers');
const board = require('../plugin/lib/board');
const { readBoard, addItem, updateItem, closeTodo, addNote, removeItem, reopenItem, tickTest, view, refsBlock } = board;

let dir, file;
beforeEach(() => {
  dir = tempStateDir('cr-board-');
  file = path.join(dir, '.control-room', 'board.json');
});

test('creates the board and its folder on first write', () => {
  const it = addItem(file, 'test', { text: 'scan', plan: 'p', task: 'Task 1' });
  assert.match(it.id, /^[2-9A-HJKMNP-Z]{4}$/);
  const b = readBoard(file);
  assert.equal(b.error, null);
  assert.equal(b.items[0].state, 'open');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, 1);
  assert.deepEqual(readBoard(path.join(dir, 'absent.json')), { items: [], error: null });
});

test('addItem sets defaults: nulls, no weight, empty notes', () => {
  const it = addItem(file, 'todo', { text: 'x' });
  assert.equal(it.kind, 'todo');
  assert.equal(it.state, 'open');
  assert.deepEqual(it.notes, []);
  assert.equal(it.closedAt, null);
  assert.equal(it.group, null);
  assert.equal(it.detail, null);
  assert.ok(!('weight' in it));
  assert.ok(!Number.isNaN(Date.parse(it.createdAt)));
});

test('ids are unique across open and closed items, a collision draws again', () => {
  for (let i = 0; i < 300; i++) {
    const it = addItem(file, 'todo', { text: `t${i}` });
    if (i % 2) closeTodo(file, it.id, 'done');
  }
  const ids = readBoard(file).items.map(i => i.id);
  assert.equal(new Set(ids).size, 300);

  const real = board._random;
  const draws = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
  board._random = () => draws.shift() ?? real(31);
  try {
    const first = addItem(file, 'todo', { text: 'a' });
    const second = addItem(file, 'todo', { text: 'b' });
    assert.equal(first.id, '2222');
    assert.equal(second.id, '3333');
  } finally { board._random = real; }
});

test('refuses to write an unreadable board', () => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ cassé');
  assert.throws(() => addItem(file, 'todo', { text: 'x' }), { code: 'unreadable' });
  assert.equal(fs.readFileSync(file, 'utf8'), '{ cassé');
  assert.ok(readBoard(file).error);
  fs.writeFileSync(file, '{"items": 3}');
  assert.ok(readBoard(file).error);
});

test('rejects an unknown weight, kind and an empty text', () => {
  assert.throws(() => addItem(file, 'todo', { text: 'x', weight: 'urgent' }), { code: 'invalid' });
  assert.throws(() => addItem(file, 'todo', { text: '  ' }), { code: 'invalid' });
  assert.throws(() => addItem(file, 'bug', { text: 'x' }), { code: 'invalid' });
  const it = addItem(file, 'todo', { text: 'x' });
  assert.throws(() => updateItem(file, it.id, { text: '' }), { code: 'invalid' });
  assert.throws(() => updateItem(file, it.id, { weight: 'urgent' }), { code: 'invalid' });
  assert.throws(() => closeTodo(file, it.id, 'ok'), { code: 'invalid' });
  assert.equal(readBoard(file).items.length, 1);
});

test('updateItem changes only given fields of its kind, never id, kind, state, notes', () => {
  const it = addItem(file, 'test', { text: 'a', plan: 'p', task: 'T' });
  const up = updateItem(file, it.id, { text: 'b', weight: 'high', group: 'nope', id: 'ZZZZ', state: 'ok', notes: [1], kind: 'todo' });
  assert.equal(up.text, 'b');
  assert.equal(up.weight, 'high');
  assert.equal(up.plan, 'p');
  assert.equal(up.id, it.id);
  assert.equal(up.kind, 'test');
  assert.equal(up.state, 'open');
  assert.deepEqual(up.notes, []);
  assert.ok(!('group' in up));
  assert.throws(() => updateItem(file, 'ZZZZ', { text: 'x' }), { code: 'not-found' });
});

test('tickTest only moves an open test to ok', () => {
  const t = addItem(file, 'test', { text: 'a' });
  const ok = tickTest(file, t.id);
  assert.equal(ok.state, 'ok');
  assert.ok(!Number.isNaN(Date.parse(ok.closedAt)));
  assert.throws(() => tickTest(file, t.id), { code: 'state' });
  const td = addItem(file, 'todo', { text: 'b' });
  assert.throws(() => tickTest(file, td.id), { code: 'state' });
  assert.throws(() => tickTest(file, 'ZZZZ'), { code: 'not-found' });
});

test('reopenItem brings an ok test back with a note', () => {
  const t = addItem(file, 'test', { text: 'a' });
  tickTest(file, t.id);
  const r = reopenItem(file, t.id, 'cliqué par erreur');
  assert.equal(r.state, 'open');
  assert.equal(r.closedAt, null);
  const n = r.notes.at(-1);
  assert.equal(n.by, 'orchestrator');
  assert.equal(n.text, 'cliqué par erreur');
  assert.ok(n.at);
  assert.throws(() => reopenItem(file, t.id, 'encore'), { code: 'state' });
  const td = addItem(file, 'todo', { text: 'b' });
  closeTodo(file, td.id, 'dropped');
  assert.equal(reopenItem(file, td.id, 'finalement').state, 'open');
  removeItem(file, td.id, 'doublon');
  assert.throws(() => reopenItem(file, td.id, 'non'), { code: 'state' });
});

test('closeTodo, removeItem and addNote keep the note history', () => {
  const td = addItem(file, 'todo', { text: 'a' });
  addNote(file, td.id, 'premier', 'user');
  const closed = closeTodo(file, td.id, 'done', 'fait');
  assert.equal(closed.state, 'done');
  assert.ok(closed.closedAt);
  assert.deepEqual(closed.notes.map(n => [n.by, n.text]), [['user', 'premier'], ['orchestrator', 'fait']]);
  assert.throws(() => closeTodo(file, td.id, 'done'), { code: 'state' });
  const t = addItem(file, 'test', { text: 'b' });
  assert.throws(() => closeTodo(file, t.id, 'done'), { code: 'state' });
  const rm = removeItem(file, t.id, 'obsolète');
  assert.equal(rm.state, 'removed');
  assert.deepEqual(rm.notes.map(n => [n.by, n.text]), [['orchestrator', 'obsolète']]);
  assert.throws(() => addNote(file, td.id, 'x', 'robot'), { code: 'invalid' });
  assert.deepEqual(readBoard(file).items.find(i => i.id === td.id).notes.map(n => n.text), ['premier', 'fait']);
});

test('view groups tests by plan then task, sorted by weight then text', () => {
  const mk = (text, plan, task, weight) => addItem(file, 'test', { text, plan, task, weight });
  mk('b', 'p1', 'T1', 'medium'); mk('a', 'p1', 'T1', 'low'); mk('c', 'p1', 'T1', 'high');
  mk('z', 'p1', null); mk('x', 'p2', 'T9', 'high'); mk('y', 'p2', 'T10'); mk('h', null, null);
  const v = view(readBoard(file).items, [{ name: 'p1', label: '⚔️ p1' }, { name: 'p2', label: '📊 p2' }]);
  assert.deepEqual(v.tests.map(g => g.plan), ['p1', 'p2', null]);
  assert.equal(v.tests[0].label, '⚔️ p1');
  assert.equal(v.tests[2].label, 'Hors plan');
  assert.deepEqual(v.tests[0].tasks.map(t => [t.task, t.items.map(i => i.text)]), [[null, ['z']], ['T1', ['c', 'b', 'a']]]);
  assert.deepEqual(v.tests[1].tasks.map(t => t.task), ['T9', 'T10']);
});

test('view puts a plan with a high test before a plan without', () => {
  addItem(file, 'test', { text: 'a', plan: 'p1', task: 'T', weight: 'low' });
  addItem(file, 'test', { text: 'b', plan: 'p2', task: 'T', weight: 'high' });
  const v = view(readBoard(file).items, [{ name: 'p1', label: 'p1' }, { name: 'p2', label: 'p2' }]);
  assert.deepEqual(v.tests.map(g => g.plan), ['p2', 'p1']);
});

test('view keeps tests whose plan is not active, under the plan name', () => {
  addItem(file, 'test', { text: 'a', plan: 'p1', weight: 'high' });
  addItem(file, 'test', { text: 'b', plan: 'gone', weight: 'high' });
  addItem(file, 'test', { text: 'c', weight: 'high' });
  const v = view(readBoard(file).items, [{ name: 'p1', label: 'p1' }]);
  assert.deepEqual(v.tests.map(g => [g.plan, g.label]), [['p1', 'p1'], ['gone', 'gone'], [null, 'Hors plan']]);
});

test('view shows only open items', () => {
  const a = addItem(file, 'test', { text: 'a', plan: 'p' });
  addItem(file, 'test', { text: 'b', plan: 'p' });
  const c = addItem(file, 'todo', { text: 'c' });
  tickTest(file, a.id);
  closeTodo(file, c.id, 'done');
  const v = view(readBoard(file).items, []);
  assert.deepEqual(v.tests[0].tasks[0].items.map(i => i.text), ['b']);
  assert.deepEqual(v.todos, []);
});

test('view groups todos by group, Divers last', () => {
  const mk = (text, group, weight) => addItem(file, 'todo', { text, group, weight });
  mk('loose', null, 'high'); mk('b', 'Zeta'); mk('a', 'Alpha'); mk('c', 'Zeta', 'high'); mk('d', 'Beta', 'high');
  const v = view(readBoard(file).items, []);
  assert.deepEqual(v.todos.map(g => g.group), ['Beta', 'Zeta', 'Alpha', null]);
  assert.equal(v.todos[3].label, 'Divers');
  assert.deepEqual(v.todos[1].items.map(i => i.text), ['c', 'b']);
});

test('refsBlock expands known ids once, case-insensitive, whole tokens only', () => {
  const a = addItem(file, 'test', { text: 'scan', detail: 'à la main', weight: 'high', plan: 'p1', task: 'T1', origin: { file: 'f', step: 'Step 4' } });
  const items = readBoard(file).items;
  items[0].id = '45BG';
  const block = refsBlock(items, 'voir #45bg et #45BG, pas #45BGX ni #ZZZZ');
  assert.equal(block.split('\n').filter(l => l.startsWith('#')).length, 1);
  assert.ok(block.startsWith('#45BG (test, p1 › T1, high) : scan — à la main'));
  assert.ok(block.includes('\n  origine : f, Step 4'));
  assert.equal(refsBlock(items, 'rien'), '');
  const td = { ...items[0], id: 'K2P9', kind: 'todo', group: null, state: 'done', origin: null, detail: null, weight: undefined };
  assert.equal(refsBlock([td], '#k2p9'), '#K2P9 (todo, Divers, medium, done) : scan');
  assert.ok(a.id);
});
