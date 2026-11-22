// Deux secrets. Celui des clients (hooks, MCP, claim) vit dans un fichier et ne peut ni répondre ni approuver.
// Celui de la page vit en mémoire du serveur et dans un cookie HttpOnly, jamais sur disque.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stateDir } = require('./store');

function clientSecretPath() { return path.join(stateDir(), 'client.secret'); }

function loadClientSecret() {
  const f = clientSecretPath();
  try {
    const s = fs.readFileSync(f, 'utf8').trim();
    if (/^[0-9a-f]{64}$/.test(s)) return s;
  } catch {}
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

function newPageSecret() { return crypto.randomBytes(32).toString('hex'); }

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function cookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

function hostOk(req, port) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host);
}

function isClient(req, clientSecret) {
  return same(req.headers['x-cr-secret'], clientSecret);
}

// Lecture par la page : cookie + Host. Écriture : en plus, Origin du serveur lui-même.
function isPage(req, pageSecret, port, { write = false } = {}) {
  if (!same(cookie(req, 'cr_page'), pageSecret) || !hostOk(req, port)) return false;
  if (!write) return true;
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin);
}

module.exports = { loadClientSecret, newPageSecret, isClient, isPage, same };
