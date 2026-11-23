// Cartes : décisions, approbations, réponses de l'orchestratrice, erreurs.
// Forké de decision-inbox (server.js, writeCard/allCards/takeAnswers), avec un propriétaire stable.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stateDir, readJson, writeJson } = require('./store');

const KIND_RANK = { approval: 0 };

function cardsDir() { return path.join(stateDir(), 'cards'); }
function cardPath(id) { return path.join(cardsDir(), `${String(id).replace(/[^\w-]/g, '')}.json`); }
function readCard(id) { return readJson(cardPath(id)); }
function writeCard(card) { writeJson(cardPath(card.id), card); }

function allCards() {
  return fs.readdirSync(cardsDir()).filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(cardsDir(), f))).filter(Boolean);
}

function normalizeOptions(options = []) {
  return options.map((o, i) => typeof o === 'string'
    ? { id: String(i + 1), label: o }
    : { id: String(o.id ?? i + 1), label: o.label, detail: o.detail });
}

function createCard(input) {
  const kind = input.kind || 'decision';
  const card = {
    id: `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    kind,
    owner: kind === 'approval' ? `hook:${input.session}` : 'orchestrator',
    created: Date.now(),
    status: 'pending',
    urgent: !!input.urgent,
    agent: input.agent || 'Agent',
    summary: input.summary || '',
    recap: input.recap || '',
    options: normalizeOptions(input.options),
    proposition: input.proposition || '',
    recommended: input.recommended != null ? String(input.recommended) : null,
    session: input.session || null,
    tool: input.tool || null,
  };
  writeCard(card);
  return card;
}

function pendingCards() {
  const rank = c => KIND_RANK[c.kind] ?? (c.urgent ? 1 : 2);
  return allCards().filter(c => c.status === 'pending')
    .sort((a, b) => rank(a) - rank(b) || a.created - b.created);
}

function answerCard(id, { choice, note }) {
  const card = readCard(id);
  if (!card) return { ok: false, reason: 'not-found' };
  if (card.status !== 'pending') return { ok: false, reason: 'not-pending' };
  card.status = 'answered';
  card.answer = { choice: String(choice), note: note || '', at: Date.now() };
  writeCard(card);
  return { ok: true, card };
}

function expireCard(id) {
  const card = readCard(id);
  if (!card || card.status !== 'pending') return false;
  card.status = 'expired';
  writeCard(card);
  return true;
}

function cancelCard(id, reason) {
  const card = readCard(id);
  if (!card || card.status !== 'pending') return false;
  card.status = 'cancelled';
  card.cancel = { reason: reason || '', at: Date.now() };
  writeCard(card);
  return true;
}

// Annulations récentes : la page dit pourquoi la carte affichée a disparu.
const CANCEL_WINDOW_MS = 30 * 60 * 1000;
function recentCancelled() {
  const since = Date.now() - CANCEL_WINDOW_MS;
  return allCards().filter(c => c.status === 'cancelled' && c.cancel && c.cancel.at > since)
    .map(c => ({ id: c.id, agent: c.agent, summary: c.summary, reason: c.cancel.reason, at: c.cancel.at }));
}

function takeUndelivered(owner) {
  const out = [];
  for (const c of allCards()) {
    if (c.owner === owner && c.status === 'answered' && !c.delivered) {
      c.delivered = Date.now();
      writeCard(c);
      out.push(c);
    }
  }
  return out.sort((a, b) => a.answer.at - b.answer.at);
}

function choiceLabel(card) {
  const { choice } = card.answer;
  if (choice === 'proposition') return `proposition acceptée : ${card.proposition}`;
  if (choice === 'note') return 'réponse libre';
  const opt = card.options.find(o => o.id === choice);
  return opt ? opt.label : choice;
}

function formatAnswer(card) {
  if (card.kind !== 'decision') return `[control-room] Réponse de l'utilisateur à « ${card.summary} » :\n${card.answer.note}`;
  let t = `[control-room] ${card.agent} — « ${card.summary} » → ${choiceLabel(card)}`;
  if (card.answer.note) t += `\nNote : ${card.answer.note}`;
  return t;
}

// Ligne d'historique (tiroir 🕘).
function historyLine(card) {
  const note = card.answer.note ? ` (${card.answer.note})` : '';
  if (card.kind === 'approval') {
    const cmd = card.tool && card.tool.input && card.tool.input.command;
    return `${card.agent} : ${card.answer.choice === 'allow' ? 'Autorisé' : 'Refusé'}${cmd ? ` — ${cmd}` : ''}${note}`;
  }
  if (card.kind !== 'decision') return `${card.agent} — « ${card.summary} » → lu${note}`;
  return `${card.agent} — « ${card.summary} » → ${choiceLabel(card)}${note}`;
}

module.exports = { createCard, readCard, pendingCards, answerCard, cancelCard, recentCancelled, expireCard, takeUndelivered, formatAnswer, historyLine, allCards };
