#!/usr/bin/env node
// Serveur MCP (stdio, JSON-RPC une ligne par message) des outils de l'orchestratrice.
// Boucle reprise de decision-inbox ; chaque outil est un appel HTTP au serveur control-room.
const { call } = require('../lib/client');

const DOWN = 'control-room ne tourne pas : lance `control-room start` (l\'utilisateur, dans son propre terminal).';

const WEIGHT = { type: 'string', enum: ['high', 'medium', 'low'], description: 'Poids ; défaut medium.' };
const ID = { type: 'string', description: 'Identifiant à 4 caractères, ex. 45BG.' };
const FIELD = (d) => ({ type: 'string', description: d });
const BOARD_NOTE = " Le tableau est celui déclaré par control-room claim --board.";

const TOOLS = [
  {
    name: 'queue_decision',
    description: "Met une décision dans la file de l'utilisateur (page control-room), une carte à la fois. Non bloquant : sa réponse t'arrivera comme un message dans ta conversation, marqué [control-room].",
    inputSchema: { type: 'object', required: ['agent', 'summary', 'options'], properties: {
      agent: { type: 'string', description: "Sujet ou session concernée, toujours le même nom, ex. '⚔️ Quick Upgrade'." },
      summary: { type: 'string', description: 'La question à trancher, en une phrase compréhensible sans contexte.' },
      recap: { type: 'string', description: '2 à 5 puces : ce qui est fait, ce qui bloque, ce qui est en jeu.' },
      options: { type: 'array', description: '2 à 4 options.', items: { anyOf: [{ type: 'string' }, { type: 'object', required: ['label'], properties: { id: { type: 'string' }, label: { type: 'string' }, detail: { type: 'string' } } }] } },
      proposition: { type: 'string', description: 'Ta recommandation et sa raison principale, 1 à 3 phrases.' },
      recommended: { type: 'string', description: "id (numéro à partir de 1) de l'option recommandée." },
      urgent: { type: 'boolean', description: 'Seulement si une session est bloquée et que rien d’autre ne peut avancer.' },
      session: { type: 'string', description: 'Libellé de la session qui attend cette décision (bandeau).' },
    } },
  },
  {
    name: 'reply',
    description: "Répond à un message libre de l'utilisateur sous forme de carte à lire (rien ne défile). Utilise-le au lieu d'écrire ta réponse dans le terminal.",
    inputSchema: { type: 'object', required: ['text'], properties: { agent: { type: 'string', description: 'Défaut : Orchestratrice.' }, summary: { type: 'string', description: 'Titre court (défaut : première ligne).' }, text: { type: 'string' } } },
  },
  {
    name: 'set_plan',
    description: "Déclare un plan actif (quand tu le confies à une session) ou archivé (après accord de l'utilisateur), pour la colonne Plans actifs.",
    inputSchema: { type: 'object', required: ['name', 'state'], properties: {
      name: { type: 'string', description: 'Nom du dossier du plan, ex. dungeon-speed.' },
      dir: { type: 'string', description: 'Chemin absolu du dossier du plan (contient plan.md). Pour active : dir ou file.' },
      file: { type: 'string', description: 'Chemin absolu du plan quand il tient en un seul fichier markdown. Pour active : dir ou file.' },
      label: { type: 'string', description: 'Libellé affiché, ex. 🏃 dungeon-speed.' },
      state: { type: 'string', enum: ['active', 'archived'] },
    } },
  },
  { name: 'add_test', description: "Ajoute un test que l'utilisateur doit faire lui-même (colonne À tester). Rend son identifiant #XXXX. Tu ne peux pas le cocher : seul l'utilisateur le fait, depuis la page." + BOARD_NOTE, inputSchema: { type: 'object', required: ['text'], properties: {
    text: FIELD("Ce qu'il doit vérifier, en une phrase."), detail: FIELD("Comment, si ce n'est pas évident."), weight: WEIGHT,
    plan: FIELD('Nom du plan (dossier ou fichier) auquel le test appartient.'), task: FIELD('Tâche du plan, ex. Task 4.'),
    origin: { type: 'object', required: ['file', 'step'], description: "D'où vient le test dans le plan.", properties: { file: { type: 'string' }, step: { type: 'string' } } },
  } } },
  { name: 'add_todo', description: "Ajoute un TODO (colonne TODO). Rend son identifiant #XXXX." + BOARD_NOTE, inputSchema: { type: 'object', required: ['text'], properties: {
    text: FIELD('Le travail à faire, en une phrase.'), detail: FIELD('Contexte utile.'), weight: WEIGHT, group: FIELD("Groupe d'affichage ; sans groupe : Divers."), plan: FIELD("Plan concerné, s'il y en a un."),
  } } },
  { name: 'update_item', description: "Modifie les champs d'un test ou d'un TODO ; null efface un champ facultatif. Ne change jamais son état." + BOARD_NOTE, inputSchema: { type: 'object', required: ['id'], properties: {
    id: ID, text: { type: 'string' }, detail: { type: ['string', 'null'] }, weight: { type: ['string', 'null'], enum: ['high', 'medium', 'low', null] },
    plan: { type: ['string', 'null'] }, task: { type: ['string', 'null'], description: 'Tests seulement.' }, group: { type: ['string', 'null'], description: 'TODO seulement.' },
    origin: { type: ['object', 'null'], description: 'Tests seulement.', properties: { file: { type: 'string' }, step: { type: 'string' } } },
  } } },
  { name: 'close_todo', description: "Ferme un TODO : fait ou abandonné. Les tests ne se ferment pas ici : seul l'utilisateur les coche." + BOARD_NOTE, inputSchema: { type: 'object', required: ['id', 'state'], properties: {
    id: ID, state: { type: 'string', enum: ['done', 'dropped'], description: 'done = fait, dropped = abandonné.' }, note: { type: 'string', description: 'Pourquoi, si utile.' },
  } } },
  { name: 'add_note', description: "Ajoute une note datée à un test ou un TODO." + BOARD_NOTE, inputSchema: { type: 'object', required: ['id', 'text'], properties: { id: ID, text: { type: 'string' } } } },
  { name: 'remove_item', description: "Retire un test ou un TODO du tableau (il reste dans le fichier, état removed) avec la raison." + BOARD_NOTE, inputSchema: { type: 'object', required: ['id', 'reason'], properties: { id: ID, reason: { type: 'string' } } } },
  { name: 'reopen_item', description: "Rouvre un test coché (par erreur) ou un TODO fermé, avec la raison." + BOARD_NOTE, inputSchema: { type: 'object', required: ['id', 'reason'], properties: { id: ID, reason: { type: 'string' } } } },
  { name: 'list_board', description: "Liste les tests et TODO du tableau, avec leurs notes." + BOARD_NOTE, inputSchema: { type: 'object', properties: {
    kind: { type: 'string', enum: ['test', 'todo'] }, state: { type: 'string', enum: ['open', 'ok', 'done', 'dropped', 'removed'], description: 'Filtre de lecture.' },
  } } },
  { name: 'cancel_decision', description: "Retire une de tes cartes en attente devenue inutile. La page affiche la raison à l'utilisateur, qui a peut-être la carte sous les yeux.", inputSchema: { type: 'object', required: ['id', 'reason'], properties: {
    id: { type: 'string' },
    reason: { type: 'string', description: "Pourquoi tu la retires, en une phrase, ex. « remplacée par une question plus précise »." },
  } } },
  { name: 'release_session', description: "Retire du bandeau une session de travail dont tu as fini (travail terminé, session fermée). Elle n'est plus de l'équipe : ses demandes de permission restent dans son terminal.", inputSchema: { type: 'object', required: ['label'], properties: {
    label: { type: 'string', description: 'Le libellé exact donné à control-room label, ex. 🔨 Builds · b2.' },
  } } },
  { name: 'list_pending', description: 'Liste tes cartes encore en attente de réponse.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'wait_answers',
    description: "Mode secours seulement (la page signale que la livraison est cassée) : attend et renvoie les réponses de l'utilisateur.",
    inputSchema: { type: 'object', required: ['claim'], properties: {
      claim: { type: 'string', description: 'Identifiant de déclaration donné par control-room claim.' },
      timeout_seconds: { type: 'number', description: 'Défaut 240, max 600.' },
    } },
  },
];

const text = (o, isError) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }], ...(isError ? { isError: true } : {}) });

async function http(method, path, body, opts) {
  const r = await call(method, path, body, opts);
  if (r.status === 0) throw Object.assign(new Error(DOWN), { down: true });
  if (r.status >= 400) throw new Error((r.json && r.json.error) || `erreur ${r.status}`);
  return r.json;
}

async function callTool(name, a = {}) {
  switch (name) {
    case 'queue_decision': {
      const r = await http('POST', '/api/cards', { kind: 'decision', ...a });
      return text({ queued: r.id });
    }
    case 'reply': {
      const lines = String(a.text || '').trim().split('\n');
      const summary = a.summary || lines[0].slice(0, 140);
      const recap = a.summary ? a.text : lines.slice(1).join('\n').trim() || '';
      const r = await http('POST', '/api/cards', { kind: 'reply', agent: a.agent || 'Orchestratrice', summary, recap });
      return text({ shown: r.id });
    }
    case 'set_plan': await http('POST', '/api/plans', a); return text({ ok: true });
    case 'add_test': case 'add_todo': {
      const r = await http('POST', '/api/board/items', { ...a, kind: name === 'add_test' ? 'test' : 'todo' });
      return text({ id: r.id });
    }
    case 'update_item': { const { id, ...fields } = a; return text(await http('POST', `/api/board/items/${encodeURIComponent(id || '')}`, fields)); }
    case 'close_todo': return text(await http('POST', `/api/board/items/${encodeURIComponent(a.id || '')}/close`, { state: a.state, note: a.note }));
    case 'add_note': return text(await http('POST', `/api/board/items/${encodeURIComponent(a.id || '')}/note`, { text: a.text }));
    case 'remove_item': return text(await http('POST', `/api/board/items/${encodeURIComponent(a.id || '')}/remove`, { reason: a.reason }));
    case 'reopen_item': return text(await http('POST', `/api/board/items/${encodeURIComponent(a.id || '')}/reopen`, { reason: a.reason }));
    case 'list_board': {
      const q = new URLSearchParams(Object.entries({ kind: a.kind, state: a.state }).filter(([, v]) => v));
      return text(await http('GET', `/api/board${q.size ? `?${q}` : ''}`));
    }
    case 'cancel_decision': await http('POST', `/api/cards/${encodeURIComponent(a.id)}/cancel`, { reason: a.reason || '' }); return text('Retirée.');
    case 'release_session': return text(await http('POST', '/api/sessions/release', { label: a.label || '' }));
    case 'list_pending': return text(await http('GET', '/api/pending'));
    case 'wait_answers': {
      const wait = Math.max(1, Math.min(a.timeout_seconds || 240, 600));
      const r = await http('GET', `/api/outbox/drain?claim=${encodeURIComponent(a.claim || '')}&wait=${wait}`, undefined, { timeoutMs: (wait + 15) * 1000 });
      return text(r.messages.length ? r : { messages: [], note: 'Pas encore de réponse. Rappelle wait_answers.' });
    }
    default: return text(`Outil inconnu : ${name}`, true);
  }
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'control-room', version: '0.2.0' } } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      let result;
      try { result = await callTool(params.name, params.arguments); } catch (e) { result = text(e.message, true); }
      return send({ jsonrpc: '2.0', id, result });
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e && e.message || e) } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { process.stderr.write(`[control-room] ligne illisible : ${e.message}\n`); }
  }
});
process.stdin.on('end', () => process.exit(0));
