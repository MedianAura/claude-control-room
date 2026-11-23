const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { planOutline } = require('../plugin/lib/plan-file');

function tempCopy(text) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cr-plan-')), 'plan.md');
  fs.writeFileSync(f, text);
  return f;
}

test('planOutline counts checked and total boxes, nested ones included', () => {
  const f = tempCopy('# P\n### Task 1: a\n- [x] **Step 1**\n- [ ] **Step 2**\n  - [x] nested\n');
  const { done, total } = planOutline(f);
  assert.deepEqual({ done, total }, { done: 2, total: 3 });
});

test('planOutline groups the boxes by task, steps titled by their bold text', () => {
  const f = tempCopy([
    '# P', '- [x] préalable hors tâche',
    '### Task 1: Essai', '- [x] **Step 1: écrire** le script', '- [x] **Step 2: lancer**',
    '### Task 2: Cartes', '- [x] **Step 1: tests**', '- [ ] **Step 2: implémenter**', '  - [x] sous-case', '- [ ] Étape sans gras',
  ].join('\r\n'));
  assert.deepEqual(planOutline(f), {
    done: 5, total: 7,
    tasks: [
      { title: 'Task 1: Essai', done: 2, total: 2, steps: [{ text: 'Step 1: écrire', done: true }, { text: 'Step 2: lancer', done: true }] },
      { title: 'Task 2: Cartes', done: 2, total: 4, steps: [{ text: 'Step 1: tests', done: true }, { text: 'Step 2: implémenter', done: false }, { text: 'Étape sans gras', done: false }] },
    ],
  });
});

test('planOutline of a missing file is empty', () => {
  assert.deepEqual(planOutline('Z:/nope/plan.md'), { done: 0, total: 0, tasks: [] });
});

test('a step whose bold title ends with a colon keeps the text after it', () => {
  const f = tempCopy('### Task 9: Skill\n- [ ] **Step 4 (user):** Vérifier la page dans le navigateur\n');
  assert.equal(planOutline(f).tasks[0].steps[0].text, 'Step 4 (user): Vérifier la page dans le navigateur');
});
