// Modèle du tableau d'un projet : tests et TODO dans un fichier JSON. Ne sait rien de HTTP.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WEIGHTS = ['high', 'medium', 'low'];
// Sans 0/O/1/I/L : lisibles à voix haute et à l'écran.
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ID_LENGTH = 4;
const TEST_FIELDS = ['text', 'detail', 'weight', 'plan', 'task', 'origin'];
const TODO_FIELDS = ['text', 'detail', 'weight', 'group', 'plan'];

class BoardError extends Error {
  constructor(code, message) { super(message); this.name = 'BoardError'; this.code = code; }
}

function readBoard(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return { items: [], error: null };
    return { items: [], error: `lecture impossible : ${e.message}` };
  }
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return { items: [], error: 'le fichier n\'a pas de tableau « items »' };
    return { items: data.items, error: null };
  } catch (e) {
    return { items: [], error: `JSON invalide : ${e.message}` };
  }
}

// Lit, refuse un fichier illisible, applique fn, écrit en atomique (tmp + rename).
function mutate(file, fn) {
  const { items, error } = readBoard(file);
  if (error) throw new BoardError('unreadable', error);
  const result = fn(items);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items }, null, 2));
  fs.renameSync(tmp, file);
  return result;
}

function newId(items) {
  const taken = new Set(items.map(i => i.id));
  for (;;) {
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[module.exports._random(ID_ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
}

function find(items, id) {
  const it = items.find(i => i.id === id);
  if (!it) throw new BoardError('not-found', `élément inconnu : ${id}`);
  return it;
}

function checkWeight(w) {
  if (w !== null && !WEIGHTS.includes(w)) throw new BoardError('invalid', `poids inconnu : ${w}`);
}
function checkText(t) {
  if (typeof t !== 'string' || !t.trim()) throw new BoardError('invalid', 'texte vide');
}

const STRING_FIELDS = ['detail', 'plan', 'task', 'group'];
function checkField(k, v) {
  if (k === 'text') return checkText(v);
  if (STRING_FIELDS.includes(k) && v !== null && typeof v !== 'string') throw new BoardError('invalid', `${k} doit être un texte`);
  if (k === 'origin' && v !== null && !(v && typeof v === 'object' && typeof v.file === 'string' && typeof v.step === 'string'))
    throw new BoardError('invalid', 'origin doit être { file, step } (textes)');
}

// Copie les champs permis qui sont présents ; null efface (sauf text).
function applyFields(it, fields, allowed) {
  // Tout est validé avant d'écrire quoi que ce soit dans l'élément.
  for (const k of allowed) if (fields[k] !== undefined) checkField(k, fields[k]);
  for (const k of allowed) {
    if (fields[k] === undefined) continue;
    const v = fields[k];
    if (k === 'weight') {
      checkWeight(v);
      if (v === null) { delete it.weight; continue; }
    }
    it[k] = v;
  }
}

function addItem(file, kind, fields = {}) {
  if (kind !== 'test' && kind !== 'todo') throw new BoardError('invalid', `genre inconnu : ${kind}`);
  const allowed = kind === 'test' ? TEST_FIELDS : TODO_FIELDS;
  checkText(fields.text);
  if (fields.weight !== undefined) checkWeight(fields.weight);
  return mutate(file, (items) => {
    const it = { id: newId(items), kind, state: 'open' };
    for (const k of allowed) if (k !== 'weight') it[k] = null;
    it.notes = [];
    it.createdAt = new Date().toISOString();
    it.closedAt = null;
    applyFields(it, fields, allowed);
    items.push(it);
    return it;
  });
}

function updateItem(file, id, fields = {}) {
  return mutate(file, (items) => {
    const it = find(items, id);
    applyFields(it, fields, it.kind === 'test' ? TEST_FIELDS : TODO_FIELDS);
    return it;
  });
}

function pushNote(it, by, text) {
  it.notes.push({ at: new Date().toISOString(), by, text });
}

function closeTodo(file, id, state, note) {
  if (state !== 'done' && state !== 'dropped') throw new BoardError('invalid', `état de fermeture inconnu : ${state}`);
  return mutate(file, (items) => {
    const it = find(items, id);
    if (it.kind !== 'todo' || it.state !== 'open') throw new BoardError('state', `${id} n'est pas un TODO ouvert`);
    it.state = state;
    it.closedAt = new Date().toISOString();
    if (note) pushNote(it, 'orchestrator', note);
    return it;
  });
}

function addNote(file, id, text, by) {
  if (by !== 'orchestrator' && by !== 'user') throw new BoardError('invalid', `auteur inconnu : ${by}`);
  checkText(text);
  return mutate(file, (items) => {
    const it = find(items, id);
    pushNote(it, by, text);
    return it;
  });
}

function removeItem(file, id, reason) {
  checkText(reason);
  return mutate(file, (items) => {
    const it = find(items, id);
    it.state = 'removed';
    pushNote(it, 'orchestrator', reason);
    return it;
  });
}

function reopenItem(file, id, reason) {
  checkText(reason);
  return mutate(file, (items) => {
    const it = find(items, id);
    const reopenable = it.kind === 'test' ? it.state === 'ok' : (it.state === 'done' || it.state === 'dropped');
    if (!reopenable) throw new BoardError('state', `${id} ne peut pas être rouvert (${it.state})`);
    it.state = 'open';
    it.closedAt = null;
    pushNote(it, 'orchestrator', reason);
    return it;
  });
}

function tickTest(file, id) {
  return mutate(file, (items) => {
    const it = find(items, id);
    if (it.kind !== 'test' || it.state !== 'open') throw new BoardError('state', `${id} n'est pas un test ouvert`);
    it.state = 'ok';
    it.closedAt = new Date().toISOString();
    return it;
  });
}

const rank = (it) => WEIGHTS.indexOf(it.weight ?? 'medium');
const byWeightThenText = (a, b) => rank(a) - rank(b) || String(a.text).localeCompare(String(b.text));

// Regroupe par clé (null comprise), dans l'ordre de première apparition.
function groupBy(items, keyOf) {
  const map = new Map();
  for (const it of items) {
    const k = keyOf(it) ?? null;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}
const bestRank = (list) => Math.min(...list.map(rank));

function view(items, plans = []) {
  const open = items.filter(i => i.state === 'open');
  const planIndex = (name) => { const i = plans.findIndex(p => p.name === name); return i < 0 ? plans.length : i; };

  const tests = [...groupBy(open.filter(i => i.kind === 'test'), i => i.plan)]
    .sort(([ka, la], [kb, lb]) => {
      if (ka === null || kb === null) return (ka === null) - (kb === null);
      return bestRank(la) - bestRank(lb) || planIndex(ka) - planIndex(kb) || ka.localeCompare(kb);
    })
    .map(([plan, list]) => {
      const tasks = [...groupBy(list, i => i.task)]
        .map(([task, ti]) => ({ task, first: items.indexOf(ti[0]), items: ti.sort(byWeightThenText) }))
        .sort((a, b) => (a.task === null ? -1 : b.task === null ? 1 : a.first - b.first))
        .map(({ task, items: ti }) => ({ task, items: ti }));
      const label = plan === null ? 'Hors plan' : plans.find(p => p.name === plan)?.label ?? plan;
      return { plan, label, tasks };
    });

  const todos = [...groupBy(open.filter(i => i.kind === 'todo'), i => i.group)]
    .sort(([ka, la], [kb, lb]) => {
      if (ka === null || kb === null) return (ka === null) - (kb === null);
      return bestRank(la) - bestRank(lb) || ka.localeCompare(kb);
    })
    .map(([group, list]) => ({ group, label: group === null ? 'Divers' : group, items: list.sort(byWeightThenText) }));

  return { tests, todos };
}

// Bloc de références : une entrée par #XXXX connu, dans l'ordre d'apparition.
function refsBlock(items, text) {
  const seen = new Set();
  const out = [];
  for (const m of String(text).matchAll(/(?<![\w#])#([A-Za-z0-9]+)(?![\w])/g)) {
    const id = m[1].toUpperCase();
    if (seen.has(id)) continue;
    const it = items.find(i => i.id === id);
    if (!it) continue;
    seen.add(id);
    const where = it.kind === 'test'
      ? `test, ${it.plan ?? 'Hors plan'}${it.task ? ` › ${it.task}` : ''}`
      : `todo, ${it.group ?? 'Divers'}`;
    const state = it.state === 'open' ? '' : `, ${it.state}`;
    let line = `#${id} (${where}, ${it.weight ?? 'medium'}${state}) : ${it.text}`;
    if (it.detail) line += ` — ${it.detail}`;
    if (it.origin) line += `\n  origine : ${it.origin.file}, ${it.origin.step}`;
    out.push(line);
  }
  return out.join('\n');
}

module.exports = {
  BoardError, readBoard, addItem, updateItem, closeTodo, addNote, removeItem, reopenItem, tickTest,
  view, refsBlock, WEIGHTS, ID_ALPHABET,
  _random: (n) => crypto.randomInt(n),
};
