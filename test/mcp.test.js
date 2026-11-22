const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders } = require('./helpers');
const { createDelivery } = require('../plugin/lib/delivery');
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const { pendingCards } = require('../plugin/lib/cards');

const MCP = path.join(__dirname, '..', 'plugin', 'mcp', 'server.js');

function mcpClient(env) {
  const p = spawn(process.execPath, [MCP], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '', id = 0; const waiting = new Map();
  p.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); }
  });
  const rpc = (method, params) => new Promise((r) => { const n = ++id; waiting.set(n, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  return { rpc, call: (name, args = {}) => rpc('tools/call', { name, arguments: args }), close: () => p.kill() };
}

let t, dir, delivery, mcp;
test.beforeEach(async () => {
  dir = tempStateDir('cr-mcp-');
  delivery = createDelivery({ ackTimeoutMs: 300 });
  t = await startTestServer({ deliver: delivery.deliver, routes: [...delivery.routes, ...orchRoutes.routes] });
  mcp = mcpClient({ CONTROL_ROOM_DIR: dir });
  await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
});
test.afterEach(async () => { mcp.close(); await t.close(); });

test('the six orchestrator tools are listed', async () => {
  const r = await mcp.rpc('tools/list', {});
  assert.deepEqual(r.result.tools.map(x => x.name).sort(), ['cancel_decision', 'list_pending', 'queue_decision', 'reply', 'set_plan', 'wait_answers']);
});

test('queue_decision creates a card the page can see', async () => {
  const r = await mcp.call('queue_decision', { agent: 'Quick Upgrade', summary: 'Retrait ?', options: ['Auto', 'Bouton'], recommended: '2' });
  assert.ok(!r.result.isError);
  const s = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } });
  assert.equal(s.json.pending[0].summary, 'Retrait ?');
});

test('reply makes a read-only card', async () => {
  await mcp.call('reply', { agent: 'Orchestratrice', text: 'Je confie la vitesse en donjon à bd.' });
  const c = pendingCards()[0];
  assert.equal(c.kind, 'reply');
  assert.equal(c.summary, 'Je confie la vitesse en donjon à bd.');
});

test('a multi-line reply keeps its first line as title and the rest as body', async () => {
  await mcp.call('reply', { text: 'Build lancé.\n- b2 compile\n- redémarrage après' });
  const c = pendingCards()[0];
  assert.equal(c.summary, 'Build lancé.');
  assert.match(c.recap, /b2 compile/);
});

test('list_pending and cancel_decision manage the orchestrator cards', async () => {
  await mcp.call('queue_decision', { agent: 'A', summary: 'q', options: ['x'] });
  const list = JSON.parse((await mcp.call('list_pending')).result.content[0].text);
  assert.equal(list.length, 1);
  await mcp.call('cancel_decision', { id: list[0].id });
  assert.equal(pendingCards().length, 0);
});

test('cancel_decision cannot touch an approval card', async () => {
  const r = await request(t.port, 'POST', '/api/cards', { body: { kind: 'approval', agent: 'B', summary: 'rm', session: 's1' }, headers: clientHeaders(t) });
  const c = await mcp.call('cancel_decision', { id: r.json.id });
  assert.ok(c.result.isError);
  assert.equal(pendingCards().length, 1);
});

test('wait_answers drains the answers in fallback mode', async () => {
  await request(t.port, 'POST', '/api/claim', { body: { socket: 'A', token: 'ta', project: 'p', plans: 'p', master: 'm' }, headers: clientHeaders(t) });
  await mcp.call('queue_decision', { agent: 'Vol', summary: 'Patch ?', options: ['Oui', 'Non'] });
  const id = pendingCards()[0].id;
  await request(t.port, 'POST', '/api/answer', { body: { id, choice: '1' }, headers: pageHeaders(t) });
  const r = JSON.parse((await mcp.call('wait_answers', { timeout_seconds: 1 })).result.content[0].text);
  assert.match(r.messages[0].text, /Vol/);
  assert.equal(delivery.pendingFor('A').length, 0);
});

test('every tool says how to start control-room when the server is down', async () => {
  fs.unlinkSync(path.join(dir, 'server.json'));
  const r = await mcp.call('queue_decision', { agent: 'A', summary: 'q', options: ['x'] });
  assert.ok(r.result.isError);
  assert.match(r.result.content[0].text, /control-room ne tourne pas : lance `control-room start`/);
});

// ---------- message libre depuis la page ----------
const png = (bytes) => 'data:image/png;base64,' + Buffer.alloc(bytes, 1).toString('base64');

test('a free message with a pasted image is saved and delivered with its path', async () => {
  await request(t.port, 'POST', '/api/claim', { body: { socket: 'A', token: 'ta', project: 'p', plans: 'p', master: 'm' }, headers: clientHeaders(t) });
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'regarde ça', image: png(2000) }, headers: pageHeaders(t) });
  assert.equal(r.status, 200);
  const m = delivery.pendingFor('A')[0].text;
  assert.match(m, /Message de l'utilisateur : regarde ça/);
  const file = m.match(/Capture : (.+\.png)/)[1];
  assert.equal(fs.statSync(file).size, 2000);
});

test('an image over 10 MB is refused and nothing is delivered', async () => {
  await request(t.port, 'POST', '/api/claim', { body: { socket: 'A', token: 'ta', project: 'p', plans: 'p', master: 'm' }, headers: clientHeaders(t) });
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'gros', image: png(11 * 1024 * 1024) }, headers: pageHeaders(t) });
  assert.equal(r.status, 413);
  assert.equal(delivery.pendingFor('A').length, 0);
});

test('a non-image data URL is refused', async () => {
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'x', image: 'data:text/html;base64,PGI+' }, headers: pageHeaders(t) });
  assert.equal(r.status, 415);
});

test('the client secret cannot send a message as the user', async () => {
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'faux' }, headers: clientHeaders(t) });
  assert.equal(r.status, 403);
});
