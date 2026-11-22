// Livraison vers l'orchestratrice, voie « listener » (essai de la tâche 1) :
// le serveur garde une file par boîte de réception ; `control-room listen`, enfant de l'orchestratrice,
// la vide et écrit dans sa propre boîte ; le hook UserPromptSubmit renvoie l'accusé `[cr:<id>]`.
const path = require('path');
const crypto = require('crypto');
const { stateDir, readJson, writeJson, addEvent } = require('./store');

const TAKEOVER = '[control-room] Une autre orchestratrice a pris le relais. Arrête control-room listen ; tes cartes en attente passent à la nouvelle.';

function createDelivery({ ackTimeoutMs = 30000 } = {}) {
  const outboxFile = () => path.join(stateDir(), 'outbox.json');
  const orchFile = () => path.join(stateDir(), 'orchestrator.json');
  const plansFile = () => path.join(stateDir(), 'active-plans.json');
  const load = () => readJson(outboxFile()) || [];
  const save = (box) => writeJson(outboxFile(), box);
  const waiters = new Set();
  const wakeAll = () => { for (const w of waiters) w(); waiters.clear(); };
  const superseded = new Set();

  function push(socket, text) {
    const id = crypto.randomBytes(4).toString('hex');
    const box = load();
    box.push({ id, socket, text: `${text}\n[cr:${id}]`, at: Date.now(), sentAt: null });
    save(box);
    wakeAll();
    return id;
  }

  async function deliver(text) {
    const o = readJson(orchFile());
    push(o ? o.socket : null, text);
  }

  function claim(info) {
    const prev = readJson(orchFile());
    writeJson(orchFile(), { ...info, claimedAt: Date.now() });
    const box = load();
    // Tout message non acquitté de l'ancienne boîte (ou sans boîte) passe à la nouvelle ; ceux de la boîte
    // qui se redéclare sont remis en circulation (écouteur relancé) : un doublon vaut mieux qu'une perte.
    for (const m of box) {
      if (m.socket === info.socket || m.socket === null || (prev && m.socket === prev.socket && m.text.indexOf(TAKEOVER) !== 0)) {
        m.socket = info.socket; m.sentAt = null;
      }
    }
    save(box);
    if (prev && prev.socket !== info.socket) {
      superseded.add(prev.socket);
      push(prev.socket, TAKEOVER);
      addEvent('une nouvelle orchestratrice a pris le relais');
    }
    superseded.delete(info.socket);
    wakeAll();
  }

  async function take(socket, waitS) {
    const deadline = Date.now() + waitS * 1000;
    for (;;) {
      const box = load();
      const mine = box.filter(m => m.socket === socket && m.sentAt === null);
      if (mine.length || Date.now() >= deadline) {
        for (const m of mine) m.sentAt = Date.now();
        if (mine.length) save(box);
        return { messages: mine.map(({ id, text }) => ({ id, text })), superseded: superseded.has(socket) };
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

  // Messages non acquittés pour cette boîte (le hook Stop de l'orchestratrice les lui repousse).
  function pendingFor(socket) { return load().filter(m => m.socket === socket).map(({ id, text }) => ({ id, text })); }

  function alerts() {
    const now = Date.now();
    const box = load();
    const out = [];
    if (box.some(m => m.sentAt !== null && now - m.sentAt > ackTimeoutMs)) {
      out.push('Livraison à l\'orchestratrice sans accusé de réception : format de boîte peut-être changé par une mise à jour de Claude Code. Mode secours : tes réponses restent en attente et lui seront repoussées à la fin de son prochain tour.');
    }
    if (box.some(m => m.sentAt === null && now - m.at > ackTimeoutMs)) {
      out.push(readJson(orchFile())
        ? 'L\'orchestratrice n\'écoute pas : demande-lui de relancer control-room listen.'
        : 'Aucune orchestratrice déclarée : elle doit lancer control-room claim puis control-room listen.');
    }
    return out;
  }

  function setPlan({ name, dir, label, state }) {
    const plans = (readJson(plansFile()) || []).filter(p => p.name !== name);
    if (state !== 'archived') plans.push({ name, dir, label });
    writeJson(plansFile(), plans);
    addEvent(state === 'archived' ? `plan archivé : ${name}` : `plan actif : ${label || name}`);
  }

  const routes = [
    { method: 'POST', match: p => p === '/api/claim', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const b = await readBody(req);
      if (!b.socket || !b.token) return send(res, 400, { error: 'socket et token requis (lance claim depuis le Bash de l\'orchestratrice)' });
      claim({ socket: b.socket, token: b.token, project: b.project, plans: b.plans, master: b.master, version: b.version });
      return send(res, 200, { ok: true });
    } },
    { method: 'GET', match: p => p === '/api/outbox', auth: 'client', handle: async (req, res, url, { send }) => {
      const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, 120));
      return send(res, 200, await take(url.searchParams.get('socket'), wait));
    } },
    { method: 'GET', match: p => p === '/api/outbox/pending', auth: 'client', handle: async (req, res, url, { send }) =>
      send(res, 200, { messages: pendingFor(url.searchParams.get('socket')) }) },
    // Mode secours (wait_answers) : la file de l'orchestratrice déclarée, remise et acquittée d'un coup.
    { method: 'GET', match: p => p === '/api/outbox/drain', auth: 'client', handle: async (req, res, url, { send }) => {
      const o = readJson(orchFile());
      if (!o) return send(res, 200, { messages: [] });
      const wait = Math.max(0, Math.min(Number(url.searchParams.get('wait')) || 0, 600));
      const r = await take(o.socket, wait);
      for (const m of r.messages) ack(m.id);
      return send(res, 200, { messages: r.messages });
    } },
    { method: 'POST', match: p => p === '/api/ack', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const { id } = await readBody(req);
      return send(res, ack(id) ? 200 : 404, { ok: true });
    } },
    { method: 'POST', match: p => p === '/api/plans', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      setPlan(await readBody(req));
      return send(res, 200, { ok: true });
    } },
  ];

  return { deliver, claim, take, ack, pendingFor, alerts, setPlan, routes };
}

module.exports = { createDelivery, TAKEOVER };
