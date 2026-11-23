const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createCard, pendingCards, answerCard, takeUndelivered, formatAnswer } = require('../plugin/lib/cards');

test.beforeEach(() => {
  process.env.CONTROL_ROOM_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-cards-'));
});

test('approval cards sort before urgent and normal cards', () => {
  const a = createCard({ kind: 'decision', agent: 'Quick Upgrade', summary: 'q', options: ['x'] });
  const u = createCard({ kind: 'decision', agent: 'Vol', summary: 'q', options: ['x'], urgent: true });
  const p = createCard({ kind: 'approval', agent: 'Builds', summary: 'docker compose build', session: 's1' });
  assert.deepEqual(pendingCards().map(c => c.id), [p.id, u.id, a.id]);
});

test('a second answer to the same card is refused', () => {
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'q', options: ['x', 'y'] });
  assert.equal(answerCard(c.id, { choice: '2' }).ok, true);
  assert.deepEqual(answerCard(c.id, { choice: '1' }), { ok: false, reason: 'not-pending' });
});

test('answering an unknown card reports not-found', () => {
  assert.deepEqual(answerCard('nope', { choice: '1' }), { ok: false, reason: 'not-found' });
});

test('answers are delivered once, to the orchestrator role', () => {
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'q', options: ['x'] });
  answerCard(c.id, { choice: 'proposition', note: 'vas-y' });
  assert.equal(takeUndelivered('orchestrator').length, 1);
  assert.equal(takeUndelivered('orchestrator').length, 0);
});

test('approval answers never go to the orchestrator', () => {
  const p = createCard({ kind: 'approval', agent: 'Builds', summary: 'rm', session: 's1' });
  answerCard(p.id, { choice: 'allow' });
  assert.equal(takeUndelivered('orchestrator').length, 0);
  assert.equal(takeUndelivered('hook:s1').length, 1);
});

test('formatAnswer names the agent, the choice label and the note', () => {
  const c = createCard({ kind: 'decision', agent: 'Quick Upgrade', summary: 'Retrait auto ?', options: ['Auto', 'Bouton Retirer'] });
  answerCard(c.id, { choice: '2', note: 'avec confirmation' });
  const t = formatAnswer(takeUndelivered('orchestrator')[0]);
  assert.match(t, /Quick Upgrade/);
  assert.match(t, /Bouton Retirer/);
  assert.match(t, /avec confirmation/);
});

test('formatAnswer spells out an accepted proposition', () => {
  const c = createCard({ kind: 'decision', agent: 'Vol', summary: 'Patch ?', options: ['a'], proposition: 'Régénérer patch-Y' });
  answerCard(c.id, { choice: 'proposition' });
  assert.match(formatAnswer(takeUndelivered('orchestrator')[0]), /proposition acceptée : Régénérer patch-Y/);
});

test('cards survive in files, written atomically', () => {
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'q', options: ['x'] });
  const dir = path.join(process.env.CONTROL_ROOM_DIR, 'cards');
  assert.deepEqual(fs.readdirSync(dir), [`${c.id}.json`]);
});

test('a cancelled card keeps its reason and shows in recentCancelled', () => {
  const { cancelCard, recentCancelled } = require('../plugin/lib/cards');
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'Test X ?', options: ['x'] });
  cancelCard(c.id, 'remplacée par une question plus précise');
  assert.deepEqual(recentCancelled().map(({ id, summary, reason }) => ({ id, summary, reason })),
    [{ id: c.id, summary: 'Test X ?', reason: 'remplacée par une question plus précise' }]);
});
