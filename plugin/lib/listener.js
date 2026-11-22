// `control-room listen --claim <id>` : lancé en arrière-plan par l'orchestratrice (donc son enfant, seul cas où
// Claude Code accepte le message), il vide la file du serveur et écrit dans la boîte de sa session.
const { call } = require('./client');
const { deliverTo } = require('./inbox');

async function listenOnce(inbox, { claim, wait = 60 } = {}) {
  const r = await call('GET', `/api/outbox?claim=${encodeURIComponent(claim)}&wait=${wait}`, undefined, { timeoutMs: (wait + 10) * 1000 });
  if (r.status === 403) return { delivered: 0, superseded: true };
  if (r.status !== 200) return { delivered: 0, down: true };
  let delivered = 0;
  for (const m of r.json.messages) { await deliverTo(inbox, m.text); delivered++; }
  return { delivered, superseded: r.json.superseded && r.json.messages.length === 0 };
}

async function listenForever(inbox, claim, log = () => {}) {
  for (;;) {
    let r;
    try { r = await listenOnce(inbox, { claim }); } catch (e) { log(`livraison impossible : ${e.message}`); r = { delivered: 0, down: true }; }
    if (r.superseded) { log('cette déclaration n\'est plus la bonne (autre orchestratrice ou nouveau claim) : arrêt.'); return; }
    if (r.down) await new Promise(res => setTimeout(res, 5000));
  }
}

module.exports = { listenOnce, listenForever };
