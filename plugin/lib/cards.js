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
  let t = `[control-room] ${card.agent} — « ${card.summary} » → ${choiceLabel(card)}`;
  if (card.answer.note) t += `\nNote : ${card.answer.note}`;
  return t;
}

module.exports = { createCard, readCard, pendingCards, answerCard, takeUndelivered, formatAnswer, allCards };
