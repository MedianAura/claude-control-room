#!/usr/bin/env node
// Serveur MCP (stdio, JSON-RPC une ligne par message) des outils de l'orchestratrice.
// Boucle reprise de decision-inbox ; chaque outil est un appel HTTP au serveur control-room.
const { call } = require('../lib/client');

const DOWN = 'control-room ne tourne pas : lance `control-room start` (l\'utilisateur, dans son propre terminal).';

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
      dir: { type: 'string', description: 'Chemin absolu du dossier du plan (contient plan.md). Requis pour active.' },
      label: { type: 'string', description: 'Libellé affiché, ex. 🏃 dungeon-speed.' },
      state: { type: 'string', enum: ['active', 'archived'] },
    } },
  },
  { name: 'cancel_decision', description: "Retire une de tes cartes en attente devenue inutile.", inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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
    case 'cancel_decision': await http('POST', `/api/cards/${encodeURIComponent(a.id)}/cancel`); return text('Retirée.');
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
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'control-room', version: '0.1.0' } } });
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
