// Routes du tableau pour les outils MCP de l'orchestratrice (secret client). Le fichier du tableau est celui que
// `claim --board` a déclaré ; la page, elle, ne passe jamais par ici (elle coche ses tests dans right.js).
const { stateDir, readJson, addEvent } = require('./store');
const path = require('path');
const board = require('./board');

const STATUS = { 'not-found': 404, invalid: 400, state: 409, unreadable: 409, busy: 503 };
// orchestrator.json sans « board » (déclaration d'avant --board) : la page et les outils disent quoi faire.
const NO_BOARD = 'aucun tableau déclaré : refaire control-room claim … --board <fichier>';

function boardFile() {
  const o = readJson(path.join(stateDir(), 'orchestrator.json'));
  return o && typeof o.board === 'string' && o.board ? o.board : null;
}

const ITEM = /^\/api\/board\/items\/([^/]+)(?:\/(close|note|remove|reopen))?$/;

// Enveloppe commune : fichier du tableau, corps JSON, BoardError → statut HTTP.
const guarded = (fn) => async (req, res, url, { readBody, send }) => {
  const file = boardFile();
  if (!file) return send(res, 409, { error: NO_BOARD });
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { error: 'corps JSON objet attendu' });
    return send(res, 200, await fn({ file, url, body }));
  } catch (e) {
    if (e instanceof board.BoardError) return send(res, STATUS[e.code] || 400, { error: e.message });
    throw e;
  }
};

const routes = [
  { method: 'POST', match: p => p === '/api/board/items', auth: 'client', handle: guarded(({ file, body }) => {
    const { kind, ...fields } = body;
    const it = board.addItem(file, kind, fields);
    addEvent(`${kind === 'test' ? 'test' : 'TODO'} ajouté #${it.id} : ${it.text}`);
    return { id: it.id };
  }) },
  { method: 'POST', match: p => ITEM.test(p), auth: 'client', handle: (req, res, url, ctx) => {
    const [, id, action] = url.pathname.match(ITEM);
    return guarded(({ file, body }) => {
      switch (action) {
        case undefined: return { item: board.updateItem(file, id, body) };
        case 'close': {
          const item = board.closeTodo(file, id, body.state, body.note);
          addEvent(`TODO #${item.id} ${body.state === 'done' ? 'fait' : 'abandonné'}`);
          return { item };
        }
        case 'note': return { item: board.addNote(file, id, body.text, 'orchestrator') };
        case 'remove': {
          const item = board.removeItem(file, id, body.reason);
          addEvent(`#${item.id} retiré : ${body.reason.trim()}`);
          return { item };
        }
        case 'reopen': {
          const item = board.reopenItem(file, id, body.reason);
          addEvent(`#${item.id} rouvert : ${body.reason.trim()}`);
          return { item };
        }
      }
    })(req, res, url, ctx);
  } },
  { method: 'GET', match: p => p === '/api/board', auth: 'client', handle: guarded(({ file, url }) => {
    const kind = url.searchParams.get('kind'), state = url.searchParams.get('state');
    const { items, error } = board.readBoard(file);
    return { items: items.filter(i => (!kind || i.kind === kind) && (!state || i.state === state)), error };
  }) },
];

module.exports = { boardFile, routes, NO_BOARD };
