// Colonne de droite : À tester / Plans actifs / TODO, lue depuis les fichiers du projet de l'orchestratrice.
const fs = require('fs');
const path = require('path');
const { stateDir, readJson, addEvent } = require('./store');
const { parseMaster, tickTest, planOutline } = require('./plan-file');
const cards = require('./cards');

function orchestrator() { return readJson(path.join(stateDir(), 'orchestrator.json')); }
function activePlans() { return readJson(path.join(stateDir(), 'active-plans.json')) || []; }

function readMaster() {
  const o = orchestrator();
  if (!o || !o.master) return null;
  try { return { file: o.master, ...parseMaster(fs.readFileSync(o.master, 'utf8')) }; } catch { return null; }
}

function rightState() {
  const m = readMaster();
  if (!m) return { tests: [], plans: [], todos: [] };
  return {
    tests: m.tests.filter(x => !x.done).map(({ text, parent }) => ({ text, parent })),
    plans: activePlans().filter(p => p && (p.file || p.dir)).map(p => ({ name: p.name, label: p.label || p.name, ...planOutline(p.file || path.join(p.dir, 'plan.md')) })),
    todos: m.todos.filter(x => !x.done).map(({ name, planDir }) => ({ name, planDir })),
  };
}

const MESSAGES = { 'not-found': 'introuvable dans le plan maître (modifié entre-temps ?)', ambiguous: 'présent plusieurs fois dans le plan maître' };

async function handleTest(req, res, url, { readBody, send, deliver }) {
  const { text, result, note } = await readBody(req);
  const m = readMaster();
  if (!m) return send(res, 409, { error: 'no-orchestrator' });
  const t = m.tests.find(x => x.text === text);
  if (result === 'fail') {
    await deliver(`[control-room] Test KO — ${t ? t.parent : '?'} : ${text}${note ? `\nNote : ${note}` : ''}`);
    addEvent(`test KO : ${text}`);
    return send(res, 200, { ok: true });
  }
  const r = tickTest(m.file, text);
  if (r !== 'ok') {
    cards.createCard({ kind: 'error', agent: 'control-room', summary: 'Impossible de cocher ce test', recap: `« ${text} » est ${MESSAGES[r]}. Rien n'a été écrit.` });
    return send(res, 409, { error: r });
  }
  addEvent(`test OK : ${text}`);
  // Dernier test ouvert d'une fonctionnalité de « To do » : l'orchestratrice doit proposer l'archivage (revue #11).
  if (t && m.todos.some(td => td.name === t.parent)) {
    const after = parseMaster(fs.readFileSync(m.file, 'utf8'));
    if (!after.tests.some(x => x.parent === t.parent && !x.done)) {
      const td = after.todos.find(x => x.name === t.parent);
      await deliver(`[control-room] Tous les tests (user) de « ${t.parent} » sont OK : propose l'archivage de son plan${td && td.planDir ? ` (${td.planDir})` : ''}.`);
      addEvent(`tous les tests OK : ${t.parent}`);
    }
  }
  return send(res, 200, { ok: true });
}

const routes = [
  { method: 'POST', match: (p) => p === '/api/test', auth: 'page', handle: handleTest },
];

module.exports = { rightState, routes, orchestrator, activePlans };
