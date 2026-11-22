// Routes utilisées par les outils MCP de l'orchestratrice, et message libre de l'utilisateur depuis la page.
const fs = require('fs');
const path = require('path');
const { stateDir, addEvent } = require('./store');
const cards = require('./cards');

const MAX_IMAGE = 10 * 1024 * 1024;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function handleMessage(req, res, url, { readBody, send, deliver }) {
  const { text = '', image } = await readBody(req, 16 * 1024 * 1024);
  let file = null;
  if (image) {
    const m = String(image).match(/^data:([\w/+.-]+);base64,(.*)$/s);
    if (!m || !IMAGE_TYPES[m[1]]) return send(res, 415, { error: 'image PNG, JPEG ou WebP attendue' });
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > MAX_IMAGE) return send(res, 413, { error: '10 Mo maximum' });
    file = path.join(stateDir(), 'uploads', `${new Date().toISOString().replace(/[:.]/g, '-')}.${IMAGE_TYPES[m[1]]}`);
    fs.writeFileSync(file, bytes);
  }
  if (!text.trim() && !file) return send(res, 400, { error: 'message vide' });
  await deliver(`[control-room] Message de l'utilisateur : ${text.trim()}${file ? `\nCapture : ${file}` : ''}`);
  addEvent(file ? 'message et capture envoyés à l\'orchestratrice' : 'message envoyé à l\'orchestratrice');
  return send(res, 200, { ok: true });
}

const routes = [
  { method: 'POST', match: p => p === '/api/message', auth: 'page', handle: handleMessage },
  { method: 'GET', match: p => p === '/api/pending', auth: 'client', handle: async (req, res, url, { send }) =>
    send(res, 200, cards.pendingCards().filter(c => c.owner === 'orchestrator').map(({ id, kind, agent, summary }) => ({ id, kind, agent, summary }))) },
  { method: 'POST', match: p => /^\/api\/cards\/[\w-]+\/cancel$/.test(p), auth: 'client', handle: async (req, res, url, { send }) => {
    const id = url.pathname.split('/')[3];
    const c = cards.readCard(id);
    if (!c) return send(res, 404, { error: 'carte introuvable' });
    if (c.owner !== 'orchestrator') return send(res, 403, { error: 'seules les cartes de l\'orchestratrice peuvent être retirées' });
    if (c.status !== 'pending') return send(res, 409, { error: 'carte déjà traitée' });
    cards.cancelCard(id);
    return send(res, 200, { ok: true });
  } },
];

module.exports = { routes };
