// Livraison vers l'orchestratrice, voie « listener » (essai de la tâche 1) :
// le serveur garde une file ; `control-room listen --claim <id>`, enfant de l'orchestratrice, la vide et écrit
// dans sa propre boîte ; le hook UserPromptSubmit renvoie l'accusé `[cr:<id>:<code>]`.
//
// Confiance (revue #7/#8) : `claim` rend un identifiant de déclaration connu de la seule orchestratrice.
// orchestrator.json ne garde que des empreintes (socket, claim) : une autre session ne peut ni vider la file
// (il faut le claimId) ni recevoir les réponses en souffrance (il faut le socket de l'orchestratrice). Le code
// de 6 caractères, montré à l'orchestratrice, signe chaque message : le skill lui demande de le vérifier.
const path = require('path');
const crypto = require('crypto');
const { stateDir, readJson, writeJson, addEvent } = require('./store');

const TAKEOVER = '[control-room] Une autre orchestratrice a pris le relais. Arrête control-room listen ; tes cartes en attente passent à la nouvelle.';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const codeOf = (claimId) => sha(`code:${claimId}`).slice(0, 6);

function createDelivery({ ackTimeoutMs = 120000, foreignTtlMs = 10 * 60000 } = {}) {
  const outboxFile = () => path.join(stateDir(), 'outbox.json');
  const orchFile = () => path.join(stateDir(), 'orchestrator.json');
  const plansFile = () => path.join(stateDir(), 'active-plans.json');
  const load = () => readJson(outboxFile()) || [];
  const save = (box) => writeJson(outboxFile(), box);
  const current = () => readJson(orchFile());
  const waiters = new Set();
  const wakeAll = () => { for (const w of [...waiters]) w(); };
  const superseded = new Set(); // empreintes de déclarations remplacées

  function push(owner, code, text) {
    const id = crypto.randomBytes(4).toString('hex');
    const box = load();
    box.push({ id, owner, code, text, at: Date.now(), sentAt: null });
    save(box);
    wakeAll();
    return id;
  }
  const withMark = (m) => `${m.text}\n[cr:${m.id}${m.code ? `:${m.code}` : ''}]`;

  async function deliver(text) {
    const o = current();
    push(o ? o.claimHash : null, o ? o.code : null, text);
  }

  function claim({ socket, project, plans, master, board, version }) {
    const prev = current();
    const claimId = crypto.randomBytes(16).toString('hex');
    const next = { claimHash: sha(claimId), socketHash: sha(socket), code: codeOf(claimId), project, plans, master, board, version: version || null, claimedAt: Date.now() };
    writeJson(orchFile(), next);
    const box = load();
    for (const m of box) {
      const fromPrev = prev && m.owner === prev.claimHash && m.text !== TAKEOVER;
      if (fromPrev || m.owner === null) { m.owner = next.claimHash; m.code = next.code; m.sentAt = null; }
    }
    save(box);
    if (prev) {
      superseded.add(prev.claimHash);
      if (prev.socketHash !== next.socketHash) {
        push(prev.claimHash, prev.code, TAKEOVER);
        addEvent('une nouvelle orchestratrice a pris le relais');
      }
    }
    wakeAll();
    return { claimId, code: next.code };
  }

  // `isGone()` : la requête de l'écouteur a été abandonnée (écouteur tué) — ne rien lui remettre.
  async function take(claimId, waitS, isGone = () => false) {
    const owner = sha(claimId);
    const o = current();
    if (!(o && o.claimHash === owner) && !superseded.has(owner)) return null;
    const deadline = Date.now() + waitS * 1000;
    for (;;) {
      if (isGone()) return { messages: [], superseded: false };
      const box = load();
      const mine = box.filter(m => m.owner === owner && m.sentAt === null);
      if (mine.length || Date.now() >= deadline || superseded.has(owner)) {
        for (const m of mine) m.sentAt = Date.now();
        if (mine.length) save(box);
        return { messages: mine.map(m => ({ id: m.id, text: withMark(m) })), superseded: superseded.has(owner) };
      }
      await new Promise((r) => {
        const done = () => { clearTimeout(timer); waiters.delete(done); r(); };
        const timer = setTimeout(done, Math.min(deadline - Date.now(), 5000));
        waiters.add(done);
      });
    }
  }

  function ack(id) {
    const box = load();
    const i = box.findIndex(m => m.id === id);
    if (i < 0) return false;
    box.splice(i, 1);
    save(box);
    return true;
  }

  // File de l'orchestratrice en cours (tests et diagnostic).
  function pendingFor() {
    const o = current();
    return o ? load().filter(m => m.owner === o.claimHash).map(m => ({ id: m.id, text: withMark(m) })) : [];
  }

  const isStale = (m, now) => (m.sentAt !== null ? now - m.sentAt : now - m.at) > ackTimeoutMs;

  // Messages en souffrance de l'orchestratrice dont c'est le socket : rendus et retirés de la file, pour que
  // son hook Stop les lui donne à la fin de son tour.
  function takeStale(socket) {
    const o = current();
    if (!o || o.socketHash !== sha(socket)) return { messages: [], listenerMissing: false };
    const now = Date.now();
    const box = load();
    const stale = box.filter(m => m.owner === o.claimHash && isStale(m, now));
    if (stale.length) save(box.filter(m => !stale.includes(m)));
    return { messages: stale.map(m => ({ id: m.id, text: m.text })), listenerMissing: stale.some(m => m.sentAt === null) };
  }

  function alerts() {
    const o = current();
    const now = Date.now();
    let box = load();
    const keep = box.filter(m => (o && m.owner === o.claimHash) || now - m.at < foreignTtlMs);
    if (keep.length !== box.length) { save(keep); box = keep; }
    const mine = box.filter(m => (o ? m.owner === o.claimHash : m.owner === null) && isStale(m, now));
    const out = [];
    if (mine.some(m => m.sentAt !== null)) {
      out.push('Pas d\'accusé de réception de l\'orchestratrice depuis plus de 2 min. Si elle est dans une longue tâche, c\'est normal ; sinon le format de sa boîte a peut-être changé avec une mise à jour de Claude Code. Tes réponses lui seront rendues à la fin de son prochain tour.');
    }
    if (mine.some(m => m.sentAt === null)) {
      out.push(o ? 'L\'orchestratrice n\'écoute pas : demande-lui de relancer control-room listen.'
        : 'Aucune orchestratrice déclarée : elle doit lancer control-room claim puis control-room listen.');
    }
    return out;
  }

  function setPlan({ name, dir, file, label, state }) {
    const plans = (readJson(plansFile()) || []).filter(p => p.name !== name);
    if (state !== 'archived') plans.push(file ? { name, file, label } : { name, dir, label });
    writeJson(plansFile(), plans);
    addEvent(state === 'archived' ? `plan archivé : ${name}` : `plan actif : ${label || name}`);
  }

  // Attente abandonnée quand la réponse ne peut plus partir (client parti).
  function goneFlag(res) {
    let gone = false;
    res.on('close', () => { if (!res.writableEnded) { gone = true; wakeAll(); } });
    return () => gone || res.destroyed;
  }

  const routes = [
    { method: 'POST', match: p => p === '/api/claim', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const b = await readBody(req);
      if (!b.socket) return send(res, 400, { error: 'socket requis (lance claim depuis le Bash de l\'orchestratrice)' });
      return send(res, 200, claim(b));
    } },
    { method: 'GET', match: p => p === '/api/outbox', auth: 'client', handle: async (req, res, url, { send }) => {
      const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, 120));
      const r = await take(url.searchParams.get('claim'), wait, goneFlag(res));
      if (!r) return send(res, 403, { error: 'déclaration inconnue' });
      if (res.destroyed) return;
      return send(res, 200, r);
    } },
    // Mode secours (wait_answers) : la file de l'orchestratrice, remise et acquittée d'un coup.
    { method: 'GET', match: p => p === '/api/outbox/drain', auth: 'client', handle: async (req, res, url, { send }) => {
      const claimId = url.searchParams.get('claim');
      const o = current();
      if (!o || o.claimHash !== sha(claimId)) return send(res, 403, { error: 'déclaration inconnue' });
      const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, 600));
      const r = await take(claimId, wait, goneFlag(res));
      if (res.destroyed) return;
      for (const m of r.messages) ack(m.id);
      return send(res, 200, { messages: r.messages });
    } },
    { method: 'GET', match: p => p === '/api/outbox/stale', auth: 'client', handle: async (req, res, url, { send }) =>
      send(res, 200, takeStale(url.searchParams.get('socket'))) },
    { method: 'POST', match: p => p === '/api/ack', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const { id } = await readBody(req);
      return send(res, ack(id) ? 200 : 404, { ok: true });
    } },
    { method: 'POST', match: p => p === '/api/plans', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const b = await readBody(req);
      const has = (v) => typeof v === 'string' && v.trim();
      if (!b || typeof b !== 'object' || !has(b.name)) return send(res, 400, { error: 'name requis' });
      if (b.state !== 'archived' && !has(b.dir) && !has(b.file)) return send(res, 400, { error: 'dir ou file requis pour un plan actif' });
      setPlan(b);
      return send(res, 200, { ok: true });
    } },
  ];

  return { deliver, claim, take, ack, pendingFor, takeStale, alerts, setPlan, routes };
}

module.exports = { createDelivery, TAKEOVER, codeOf };
