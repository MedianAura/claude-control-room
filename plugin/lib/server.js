// Serveur HTTP autonome : sert la page, détient l'état, relaie les réponses.
const fs = require('fs');
const path = require('path');
const http = require('http');
const cards = require('./cards');
const conversation = require('./conversation');
const { isClient, isPage, same } = require('./auth');
const { appendHistory, readHistory } = require('./store');

const UI_FILE = path.join(__dirname, '..', 'ui', 'index.html');
const MAX_WAIT_S = 870;

// Au-delà de la limite, on continue de lire sans garder : req.destroy() couperait la connexion avant le 413.
function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, tooLarge = false; const chunks = [];
    req.on('data', (d) => {
      size += d.length;
      if (size > limit) { tooLarge = true; chunks.length = 0; return; }
      chunks.push(d);
    });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(new Error('trop lourd'), { status: 413 }));
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

function createServer({ pageSecret, bootstrapKey, clientSecret, deliver, state = () => ({}), routes = [], approvalIdleMs = 90000 }) {
  const waiters = new Map(); // id -> Set(resolve)
  const polls = new Map();   // id d'approbation -> { active, last } : son hook attend-il encore ?

  // Une approbation dont le hook est parti (délai, session interrompue) ne doit ni bloquer la file ni faire
  // croire à l'utilisateur qu'il a autorisé quelque chose (revue #1).
  function expireStaleApprovals() {
    const now = Date.now();
    for (const c of cards.pendingCards()) {
      if (c.kind !== 'approval') continue;
      const p = polls.get(c.id);
      if (p && p.active > 0) continue;
      if (now - (p ? p.last : c.created) > approvalIdleMs) { cards.expireCard(c.id); polls.delete(c.id); }
    }
  }
  let key = bootstrapKey; // à usage unique : une URL qui traîne (sortie, historique) ne vaut plus rien

  function wake(id) {
    for (const r of waiters.get(id) || []) r();
    waiters.delete(id);
  }

  async function waitAnswer(id, seconds) {
    const deadline = Date.now() + seconds * 1000;
    for (;;) {
      const c = cards.readCard(id);
      if (c && c.status !== 'pending') return c;
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
        expireStaleApprovals();
        return send(res, 200, { pending: cards.pendingCards(), cancelled: cards.recentCancelled(), recent: readHistory(30), conversation: conversation.readConversation(), sessions: [], right: { board: { error: null }, tests: [], plans: [], todos: [] }, events: [], ...state() });
      }

      if (req.method === 'POST' && url.pathname === '/api/answer') {
        if (!page(true)) return send(res, 403, 'Interdit.');
        const { id, choice, note } = await readBody(req);
        expireStaleApprovals();
        const r = cards.answerCard(id, { choice, note });
        if (!r.ok) return send(res, r.reason === 'not-found' ? 404 : 409, { error: r.reason });
        wake(id);
        appendHistory({ text: cards.historyLine(r.card) });
        if (r.card.owner === 'orchestrator') {
          // « Lu » sur une réponse ou une erreur ne réveille pas l'orchestratrice ; une note, si (revue #5).
          for (const c of cards.takeUndelivered('orchestrator')) {
            if (c.kind === 'decision' || c.answer.note) await deliver(cards.formatAnswer(c), c);
          }
        }
        return send(res, 200, { ok: true });
      }

      if (req.method === 'POST' && url.pathname === '/api/cards') {
        if (!client()) return send(res, 403, 'Interdit.');
        const body = await readBody(req);
        // Une réponse de l'orchestratrice va dans le fil de discussion : la place de la carte est réservée aux
        // décisions et aux approbations.
        if (body && body.kind === 'reply') return send(res, 200, { id: conversation.fromReplyCard(body).id });
        const card = cards.createCard(body);
        return send(res, 200, { id: card.id });
      }

      const m = url.pathname.match(/^\/api\/cards\/([\w-]+)\/answer$/);
      if (req.method === 'GET' && m) {
        if (!client()) return send(res, 403, 'Interdit.');
        const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, MAX_WAIT_S));
        const p = polls.get(m[1]) || { active: 0, last: Date.now() };
        p.active++; p.last = Date.now(); polls.set(m[1], p);
        let c;
        try { c = await waitAnswer(m[1], wait); } finally { p.active--; p.last = Date.now(); }
        if (!c) { res.writeHead(204); return res.end(); }
        if (c.status !== 'answered') return send(res, 410, { error: c.status });
        return send(res, 200, { choice: c.answer.choice, note: c.answer.note });
      }

      const x = url.pathname.match(/^\/api\/cards\/([\w-]+)\/expire$/);
      if (req.method === 'POST' && x) {
        if (!client()) return send(res, 403, 'Interdit.');
        const c = cards.readCard(x[1]);
        if (!c || c.kind !== 'approval') return send(res, 404, { error: 'approbation introuvable' });
        cards.expireCard(c.id); wake(c.id);
        return send(res, 200, { ok: true });
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
