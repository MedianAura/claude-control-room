// Fil de discussion avec l'orchestratrice : ses réponses (outil MCP reply) et les messages envoyés depuis la page.
// Fichier JSONL en ajout seul ; la page en lit les derniers échanges, du plus ancien au plus récent.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stateDir } = require('./store');

const KEEP = 50;
const file = () => path.join(stateDir(), 'conversation.jsonl');

function appendMessage({ by, agent, text, captures }) {
  const msg = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), by, ...(agent ? { agent } : {}), text,
    ...(captures ? { captures } : {}) };
  fs.appendFileSync(file(), JSON.stringify(msg) + '\n');
  return msg;
}

function readConversation(n = KEEP) {
  let raw;
  try { raw = fs.readFileSync(file(), 'utf8'); } catch { return []; }
  return raw.split('\n').filter(Boolean).slice(-n).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
}

// Une carte « reply » de l'orchestratrice (format de l'outil MCP, qui tourne parfois d'une version en cache)
// devient un message du fil : titre puis corps.
function fromReplyCard({ agent, summary, recap }) {
  const text = [summary, recap].map(s => String(s || '').trim()).filter(Boolean).join('\n');
  return appendMessage({ by: 'orchestrator', agent: agent || 'Orchestratrice', text });
}

module.exports = { appendMessage, readConversation, fromReplyCard };
