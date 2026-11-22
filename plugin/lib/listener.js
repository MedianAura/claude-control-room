// `control-room listen` : lancé en arrière-plan par l'orchestratrice (donc son enfant, seul cas où
// Claude Code accepte le message), il vide la file du serveur et écrit dans la boîte de sa session.
const { call } = require('./client');
const { deliverTo } = require('./inbox');

async function listenOnce(inbox, { wait = 60 } = {}) {
  const r = await call('GET', `/api/outbox?socket=${encodeURIComponent(inbox.socket)}&wait=${wait}`, undefined, { timeoutMs: (wait + 10) * 1000 });
  if (r.status !== 200) return { delivered: 0, down: true };
  let delivered = 0;
  for (const m of r.json.messages) { await deliverTo(inbox, m.text); delivered++; }
  return { delivered, superseded: r.json.superseded && r.json.messages.length === 0 };
}

async function listenForever(inbox, log = () => {}) {
  for (;;) {
    let r;
    try { r = await listenOnce(inbox); } catch (e) { log(`livraison impossible : ${e.message}`); r = { delivered: 0, down: true }; }
    if (r.superseded) { log('une autre orchestratrice a pris le relais : arrêt.'); return; }
    if (r.down) await new Promise(res => setTimeout(res, 5000));
  }
}

module.exports = { listenOnce, listenForever };
