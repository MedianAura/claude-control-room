// Routes utilisées par les outils MCP de l'orchestratrice, et message libre de l'utilisateur depuis la page.
const fs = require('fs');
const path = require('path');
const { stateDir, addEvent } = require('./store');
const cards = require('./cards');
const { appendMessage } = require('./conversation');

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_BODY = Math.ceil(MAX_IMAGES * MAX_IMAGE * 4 / 3) + 1024 * 1024; // base64 + texte
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Toutes les images sont validées avant d'en écrire une : un message refusé ne laisse aucun fichier.
async function handleMessage(req, res, url, { readBody, send, deliver }) {
  const { text = '', image, images } = await readBody(req, MAX_BODY);
  const list = [...(Array.isArray(images) ? images : []), ...(image ? [image] : [])];
  if (list.length > MAX_IMAGES) return send(res, 413, { error: `${MAX_IMAGES} images maximum` });
  const decoded = [];
  for (const img of list) {
    const m = String(img).match(/^data:([\w/+.-]+);base64,(.*)$/s);
    if (!m || !IMAGE_TYPES[m[1]]) return send(res, 415, { error: 'image PNG, JPEG ou WebP attendue' });
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > MAX_IMAGE) return send(res, 413, { error: '10 Mo maximum par image' });
    decoded.push({ bytes, ext: IMAGE_TYPES[m[1]] });
  }
  if (!text.trim() && !decoded.length) return send(res, 400, { error: 'message vide' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const files = decoded.map(({ bytes, ext }, i) => {
    const file = path.join(stateDir(), 'uploads', `${stamp}${decoded.length > 1 ? `-${i + 1}` : ''}.${ext}`);
    fs.writeFileSync(file, bytes);
    return file;
  });
  const shots = files.length === 1 ? `\nCapture : ${files[0]}`
    : files.length ? `\nCaptures :\n${files.map(f => `- ${f}`).join('\n')}` : '';
  await deliver(`[control-room] Message de l'utilisateur : ${text.trim()}${shots}`);
  appendMessage({ by: 'user', text: text.trim(), captures: files.length });
  const what = files.length > 1 ? `message et ${files.length} captures envoyés` : files.length ? 'message et capture envoyés' : 'message envoyé';
  addEvent(`${what} à l'orchestratrice`);
  return send(res, 200, { ok: true });
}

const routes = [
  { method: 'POST', match: p => p === '/api/message', auth: 'page', handle: handleMessage },
  { method: 'GET', match: p => p === '/api/pending', auth: 'client', handle: async (req, res, url, { send }) =>
    send(res, 200, cards.pendingCards().filter(c => c.owner === 'orchestrator').map(({ id, kind, agent, summary }) => ({ id, kind, agent, summary }))) },
  { method: 'POST', match: p => /^\/api\/cards\/[\w-]+\/cancel$/.test(p), auth: 'client', handle: async (req, res, url, { readBody, send }) => {
    const id = url.pathname.split('/')[3];
    const c = cards.readCard(id);
    if (!c) return send(res, 404, { error: 'carte introuvable' });
    if (c.owner !== 'orchestrator') return send(res, 403, { error: 'seules les cartes de l\'orchestratrice peuvent être retirées' });
    if (c.status !== 'pending') return send(res, 409, { error: 'carte déjà traitée' });
    const { reason = '' } = await readBody(req);
    cards.cancelCard(id, String(reason).trim());
    addEvent(`carte annulée par l'orchestratrice : « ${c.summary} »${reason ? ` (${reason})` : ''}`);
    return send(res, 200, { ok: true });
  } },
];

module.exports = { routes };
