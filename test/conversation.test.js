// Fil de discussion avec l'orchestratrice : ses réponses et les messages de la page, dans l'ordre, hors de la file
// des cartes (la place de la carte est réservée aux décisions et aux approbations).
const test = require('node:test');
const assert = require('node:assert');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders } = require('./helpers');
const orchRoutes = require('../plugin/lib/orchestrator-routes');

let t;
test.beforeEach(async () => { tempStateDir('cr-conv-'); t = await startTestServer({ routes: orchRoutes.routes }); });
test.afterEach(async () => { await t.close(); });

const state = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json;
const reply = (body) => request(t.port, 'POST', '/api/cards', { body: { kind: 'reply', ...body }, headers: clientHeaders(t) });
const say = (body) => request(t.port, 'POST', '/api/message', { body, headers: pageHeaders(t) });

test('a reply from the orchestrator lands in the conversation, never in the pending cards', async () => {
  const r = await reply({ agent: 'Orchestratrice', summary: 'Build lancé.', recap: '- b2 compile' });
  assert.equal(r.status, 200);
  assert.ok(r.json.id, 'the MCP reply tool still gets an id back');
  const s = await state();
  assert.deepEqual(s.pending, []);
  const last = s.conversation.at(-1);
  assert.equal(last.by, 'orchestrator');
  assert.equal(last.agent, 'Orchestratrice');
  assert.equal(last.text, 'Build lancé.\n- b2 compile');
  assert.equal(typeof last.at, 'number');
});

test('a reply never wakes the orchestrator', async () => {
  await reply({ summary: 'Point d\'étape.' });
  assert.deepEqual(t.delivered, []);
});

test('a message sent from the page lands in the conversation as the user\'s, with its capture count', async () => {
  await say({ text: 'relance-le après le souper' });
  const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
  await say({ text: 'regarde', images: [png, png] });
  const conv = (await state()).conversation;
  assert.deepEqual(conv.map(m => [m.by, m.text, m.captures || 0]), [['user', 'relance-le après le souper', 0], ['user', 'regarde', 2]]);
});

test('the conversation interleaves both sides in order, oldest first, and keeps the last 50', async () => {
  for (let i = 0; i < 30; i++) { await say({ text: `u${i}` }); await reply({ summary: `o${i}` }); }
  const conv = (await state()).conversation;
  assert.equal(conv.length, 50);
  assert.equal(conv[0].text, 'u5');
  assert.equal(conv.at(-1).text, 'o29');
});

test('an error card stays a card: it is not a message from the orchestrator', async () => {
  await request(t.port, 'POST', '/api/cards', { body: { kind: 'error', agent: 'control-room', summary: 'Impossible' }, headers: clientHeaders(t) });
  const s = await state();
  assert.equal(s.pending[0].kind, 'error');
  assert.deepEqual(s.conversation, []);
});
