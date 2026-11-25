// Colonne de droite : À tester et TODO lus au tableau du projet, Plans actifs lus dans leurs plan.md.
const path = require('path');
const { stateDir, readJson, addEvent } = require('./store');
const { planOutline } = require('./plan-file');
const { plansOf } = require('./active-plans');
const board = require('./board');
const { boardFile, NO_BOARD } = require('./board-routes');
const cards = require('./cards');

function orchestrator() { return readJson(path.join(stateDir(), 'orchestrator.json')); }
function activePlans() { const o = orchestrator(); return o ? plansOf(o.project) : []; }

function readCurrentBoard() {
  const file = boardFile();
  return file ? { file, ...board.readBoard(file) } : { file: null, items: [], error: null };
}

function rightState() {
  if (!orchestrator()) return { board: { error: null }, tests: [], plans: [], todos: [] };
  const plans = activePlans();
  const { file, items, error } = readCurrentBoard();
  // Un tableau que view ne sait pas ranger ne doit pas faire tomber /api/state (cartes et approbations avec).
  let shown = { tests: [], todos: [] }, viewError = null;
  try { shown = board.view(items, plans); } catch (e) { viewError = `affichage impossible : ${e.message}`; }
  const { tests, todos } = shown;
  return {
    board: { error: file ? error || viewError : NO_BOARD },
    tests,
    plans: plans.filter(p => p.file || p.dir).map(p => ({ name: p.name, label: p.label || p.name, ...planOutline(p.file || path.join(p.dir, 'plan.md')) })),
    todos,
  };
}

// Tout texte livré à l'orchestratrice : chaque #XXXX connu du tableau est développé à la fin. Tableau illisible :
// les #XXXX cités sont nommés, pour qu'elle sache qu'il lui manque leur contexte.
function withRefs(text) {
  const { items, error } = readCurrentBoard();
  if (error) {
    const ids = board.citedIds(text).filter(board.looksLikeId);
    return ids.length ? `${text}\n(tableau illisible : ${ids.map(id => `#${id}`).join(', ')} non développés)` : text;
  }
  const block = items.length ? board.refsBlock(items, text) : '';
  return block ? `${text}\n${block}` : text;
}
const wrapDeliver = (deliver) => (text, ...rest) => deliver(withRefs(text), ...rest);

// Refus : carte d'erreur pour l'utilisateur, rien d'écrit, rien de livré.
function refuse(send, res, id, why) {
  cards.createCard({ kind: 'error', agent: 'control-room', summary: 'Impossible de traiter ce test', recap: `#${id} : ${why}. Rien n'a été écrit.` });
  return send(res, 409, { error: why });
}

async function handleTest(req, res, url, { readBody, send, deliver }) {
  const body = await readBody(req);
  const { result } = body || {};
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (typeof body?.id !== 'string' || (result !== 'ok' && result !== 'fail')) return send(res, 400, { error: 'id et result (ok | fail) attendus' });
  if (result === 'fail' && !note) return send(res, 400, { error: 'note requise pour un KO' });
  const id = body.id.toUpperCase();
  const { file, items, error } = readCurrentBoard();
  if (!file) return send(res, 409, { error: NO_BOARD });
  if (error) return refuse(send, res, id, `tableau illisible (${error})`);
  const it = items.find(i => i.id === id);
  if (!it || it.kind !== 'test') return refuse(send, res, id, 'test inconnu au tableau');
  if (it.state !== 'open') return refuse(send, res, id, `test déjà fermé (${it.state})`);
  try {
    if (result === 'fail') board.addNote(file, id, note, 'user');
    else board.tickTest(file, id);
  } catch (e) {
    if (e instanceof board.BoardError) return refuse(send, res, id, e.message);
    throw e;
  }
  if (result === 'fail') {
    addEvent(`test KO #${id} : ${it.text}`);
    await deliver(`[control-room] Test KO #${id}\nNote : ${note}`);
    return send(res, 200, { ok: true });
  }
  addEvent(`test OK #${id} : ${it.text}`);
  await deliver(`[control-room] Test OK #${id} : fais cocher son étape dans le plan.`);
  // Dernier test ouvert d'un plan : l'orchestratrice doit proposer l'archivage (revue #11).
  if (it.plan !== null && it.plan !== undefined) {
    const after = board.readBoard(file).items;
    if (!after.some(i => i.kind === 'test' && i.state === 'open' && i.plan === it.plan)) {
      addEvent(`tous les tests OK : ${it.plan}`);
      await deliver(`[control-room] Tous les tests de « ${it.plan} » sont OK : propose l'archivage.`);
    }
  }
  return send(res, 200, { ok: true });
}

const routes = [
  { method: 'POST', match: (p) => p === '/api/test', auth: 'page', handle: handleTest },
];

module.exports = { rightState, routes, withRefs, wrapDeliver, orchestrator, activePlans };
