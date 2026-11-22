const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseMaster, tickTest, planProgress } = require('../plugin/lib/plan-file');

const FIXTURE = path.join(__dirname, 'fixtures', 'master-plan.md');
const fixture = fs.readFileSync(FIXTURE, 'utf8');

function tempCopy(text = fixture) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cr-plan-')), 'plan.md');
  fs.writeFileSync(f, text);
  return f;
}

test('dungeon speed owns its seven (user) tests, all done', () => {
  const t = parseMaster(fixture).tests.filter(x => x.parent === 'Dungeon speed');
  assert.equal(t.length, 7);
  assert.equal(t.filter(x => x.done).length, 7);
});

test('in-game checks keep their section as parent', () => {
  assert.ok(parseMaster(fixture).tests.some(x => x.parent === 'In-game checks' && x.text.startsWith('Mob behaviour')));
});

test('a test text is its first line, without the (user) tag', () => {
  const t = parseMaster(fixture).tests.find(x => x.text.startsWith('Sprint, Dash'));
  assert.equal(t.text, 'Sprint, Dash, Aspect of the Cheetah or a Swiftness Potion (`.additem 2459`, +50%) in a dungeon:');
});

test('a todo links its plan folder when it cites one', () => {
  const td = parseMaster(fixture).todos;
  assert.equal(td.find(x => x.name === 'Dungeon speed').planDir, '.agents/plans/dungeon-speed/');
  assert.equal(td.find(x => x.name.startsWith('Profession filter')).planDir, null);
});

test('todos are only the top-level bold entries of To do', () => {
  const names = parseMaster(fixture).todos.map(x => x.name);
  assert.deepEqual(names.slice(0, 4), ['Profession filter "never absorbed"', 'Altoholic + DataStore on CoA', 'Missing keeps its position', 'Dungeon speed']);
  assert.ok(!names.some(n => n.startsWith('Mob behaviour')));
});

test('tickTest ticks the one matching line and nothing else', () => {
  const f = tempCopy();
  const text = parseMaster(fixture).tests.find(x => !x.done).text;
  assert.equal(tickTest(f, text), 'ok');
  const before = fixture.split('\n'), after = fs.readFileSync(f, 'utf8').split('\n');
  const changed = before.map((l, i) => l !== after[i] ? i : -1).filter(i => i >= 0);
  assert.equal(changed.length, 1);
  assert.match(after[changed[0]], /- \[x\] \(user\)/);
});

test('tickTest finds the line after it moved', () => {
  const text = parseMaster(fixture).tests.find(x => !x.done).text;
  const f = tempCopy('# Moved\n\n\n\n\n' + fixture);
  assert.equal(tickTest(f, text), 'ok');
  assert.ok(parseMaster(fs.readFileSync(f, 'utf8')).tests.find(x => x.text === text).done);
});

test('tickTest refuses an ambiguous line and writes nothing', () => {
  const line = fixture.split('\n').find(l => /^\s*- \[ \] \(user\)/.test(l));
  const f = tempCopy(fixture + '\n' + line.trim() + '\n');
  const before = fs.readFileSync(f, 'utf8');
  assert.equal(tickTest(f, parseMaster(line.trim()).tests[0].text), 'ambiguous');
  assert.equal(fs.readFileSync(f, 'utf8'), before);
});

test('tickTest reports a vanished line and writes nothing', () => {
  const f = tempCopy();
  assert.equal(tickTest(f, 'Ce test n\'existe pas'), 'not-found');
  assert.equal(fs.readFileSync(f, 'utf8'), fixture);
});

test('tickTest keeps CRLF line endings', () => {
  const f = tempCopy(fixture.replace(/\r?\n/g, '\r\n'));
  const text = parseMaster(fixture).tests.find(x => !x.done).text;
  assert.equal(tickTest(f, text), 'ok');
  assert.ok(!/[^\r]\n/.test(fs.readFileSync(f, 'utf8')));
});

test('planProgress counts checked and total boxes', () => {
  const f = tempCopy('# P\n### Task 1: a\n- [x] **Step 1**\n- [ ] **Step 2**\n  - [x] nested\n');
  assert.deepEqual(planProgress(f), { done: 2, total: 3 });
});
