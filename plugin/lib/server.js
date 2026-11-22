// Serveur HTTP autonome : sert la page, détient l'état, relaie les réponses.
const fs = require('fs');
const path = require('path');
const http = require('http');
const cards = require('./cards');
const { isClient, isPage, same } = require('./auth');

const UI_FILE = path.join(__dirname, '..', 'ui', 'index.html');
const MAX_WAIT_S = 870;

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (d) => {
      size += d.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string';
  res.writeHead(status, { 'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json', ...headers });
  res.end(body === undefined ? undefined : isText ? body : JSON.stringify(body));
}

function createServer({ pageSecret, bootstrapKey, clientSecret, deliver, state = () => ({}), routes = [] }) {
  const waiters = new Map(); // id -> Set(resolve)
  let key = bootstrapKey; // à usage unique : une URL qui traîne (sortie, historique) ne vaut plus rien

  function wake(id) {
    for (const r of waiters.get(id) || []) r();
    waiters.delete(id);
  }

  async function waitAnswer(id, seconds) {
    const deadline = Date.now() + seconds * 1000;
    for (;;) {
      const c = cards.readCard(id);
      if (c && c.status === 'answered') return c;
      const left = deadline - Date.now();
      if (left <= 0) return null;
      await new Promise((resolve) => {
        const set = waiters.get(id) || new Set();
        const done = () => { clearTimeout(timer); set.delete(done); resolve(); };
        const timer = setTimeout(done, Math.min(left, 5000));
        set.add(done); waiters.set(id, set);
      });
    }
  }

  const ctx = { deliver, cards, readBody, send, wake };

  const server = http.createServer(async (req, res) => {
    const port = req.socket.localPort;
    const url = new URL(req.url, 'http://x');
    const page = (write) => isPage(req, pageSecret, port, { write });
    const client = () => isClient(req, clientSecret);
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        const k = url.searchParams.get('k');
        if (k !== null) {
          if (!key || !same(k, key)) return send(res, 403, 'Clé invalide ou déjà utilisée : relance control-room start.');
          key = null;
          return send(res, 302, '', { location: '/', 'set-cookie': `cr_page=${pageSecret}; HttpOnly; SameSite=Strict; Path=/` });
        }
        if (!page(false)) return send(res, 401, 'Ouvre l\'URL donnée par control-room start.');
        let html = '<!doctype html><title>control-room</title><p>Page à venir.</p>';
        try { html = fs.readFileSync(UI_FILE, 'utf8'); } catch {}
        return send(res, 200, html, { 'content-type': 'text/html; charset=utf-8' });
      }

      if (req.method === 'GET' && url.pathname === '/api/state') {
        if (!page(false)) return send(res, 403, 'Interdit.');
        return send(res, 200, { pending: cards.pendingCards(), recent: [], sessions: [], right: { tests: [], plans: [], todos: [] }, events: [], ...state() });
      }

      if (req.method === 'POST' && url.pathname === '/api/answer') {
        if (!page(true)) return send(res, 403, 'Interdit.');
        const { id, choice, note } = await readBody(req);
        const r = cards.answerCard(id, { choice, note });
        if (!r.ok) return send(res, r.reason === 'not-found' ? 404 : 409, { error: r.reason });
        wake(id);
        if (r.card.owner === 'orchestrator') {
          for (const c of cards.takeUndelivered('orchestrator')) await deliver(cards.formatAnswer(c), c);
        }
        return send(res, 200, { ok: true });
      }

      if (req.method === 'POST' && url.pathname === '/api/cards') {
        if (!client()) return send(res, 403, 'Interdit.');
        const card = cards.createCard(await readBody(req));
        return send(res, 200, { id: card.id });
      }

      const m = url.pathname.match(/^\/api\/cards\/([\w-]+)\/answer$/);
      if (req.method === 'GET' && m) {
        if (!client()) return send(res, 403, 'Interdit.');
        const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, MAX_WAIT_S));
        const c = await waitAnswer(m[1], wait);
        if (!c) { res.writeHead(204); return res.end(); }
        return send(res, 200, { choice: c.answer.choice, note: c.answer.note });
      }

      for (const route of routes) {
        if (route.method === req.method && route.match(url.pathname)) {
          if (route.auth === 'page' && !page(route.write !== false)) return send(res, 403, 'Interdit.');
          if (route.auth === 'client' && !client()) return send(res, 403, 'Interdit.');
          return await route.handle(req, res, url, ctx);
        }
      }
      return send(res, 404, 'Introuvable.');
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  });
  server.ctx = ctx;
  return server;
}

module.exports = { createServer, readBody, send };
