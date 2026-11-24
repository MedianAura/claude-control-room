const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs } = require('./helpers');
const { createDelivery } = require('../plugin/lib/delivery');
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const { pendingCards } = require('../plugin/lib/cards');
const sessions = require('../plugin/lib/sessions');

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
  t = await startTestServer({ deliver: delivery.deliver, routes: [...delivery.routes, ...orchRoutes.routes, ...require('../plugin/lib/board-routes').routes, ...sessions.routes(delivery)], state: () => ({ sessions: sessions.list() }) });
  mcp = mcpClient({ CONTROL_ROOM_DIR: dir });
  await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
});
test.afterEach(async () => { mcp.close(); await t.close(); });

test('the base orchestrator tools are listed', async () => {
  const r = await mcp.rpc('tools/list', {});
  assert.deepEqual(r.result.tools.map(x => x.name).filter(n => !/^(add_|update_item|close_todo|remove_item|reopen_item|list_board)/.test(n)).sort(), ['cancel_decision', 'list_pending', 'queue_decision', 'release_session', 'reply', 'set_plan', 'wait_answers']);
});

test('initialize reports the version from plugin.json', async () => {
  const r = await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(r.result.serverInfo.version, version);
});

test('queue_decision creates a card the page can see', async () => {
  const r = await mcp.call('queue_decision', { agent: 'Quick Upgrade', summary: 'Retrait ?', options: ['Auto', 'Bouton'], recommended: '2' });
  assert.ok(!r.result.isError);
  const s = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } });
  assert.equal(s.json.pending[0].summary, 'Retrait ?');
});

const conversation = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json.conversation;

test('reply posts to the conversation thread, not to the cards', async () => {
  await mcp.call('reply', { agent: 'Orchestratrice', text: 'Je confie la vitesse en donjon à bd.' });
  assert.deepEqual(pendingCards(), []);
  const m = (await conversation()).at(-1);
  assert.equal(m.by, 'orchestrator');
  assert.equal(m.text, 'Je confie la vitesse en donjon à bd.');
});

test('a multi-line reply keeps every line, title first', async () => {
  await mcp.call('reply', { text: 'Build lancé.\n- b2 compile\n- redémarrage après' });
  assert.equal((await conversation()).at(-1).text, 'Build lancé.\n- b2 compile\n- redémarrage après');
});

test('list_pending and cancel_decision manage the orchestrator cards', async () => {
  await mcp.call('queue_decision', { agent: 'A', summary: 'q', options: ['x'] });
  const list = JSON.parse((await mcp.call('list_pending')).result.content[0].text);
  assert.equal(list.length, 1);
  await mcp.call('cancel_decision', { id: list[0].id });
  assert.equal(pendingCards().length, 0);
});

test('cancel_decision passes its reason to the page', async () => {
  await mcp.call('queue_decision', { agent: 'A', summary: 'Test X ?', options: ['x'] });
  const id = pendingCards()[0].id;
  await mcp.call('cancel_decision', { id, reason: 'remplacée' });
  const s = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } });
  assert.deepEqual(s.json.cancelled.map(c => [c.id, c.reason]), [[id, 'remplacée']]);
});

test('release_session takes a worker off the strip by its label', async () => {
  for (const [key, label] of [['W1', '🔨 Builds · b2'], ['W2', '🧪 Tests · t1']])
    await request(t.port, 'POST', '/api/sessions/label', { body: { key, label }, headers: clientHeaders(t) });
  const r = await mcp.call('release_session', { label: '🔨 Builds · b2' });
  assert.ok(!r.result.isError);
  const s = await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } });
  assert.deepEqual(s.json.sessions.map(x => x.label), ['🧪 Tests · t1']);
});

test('release_session with an unknown label is an error', async () => {
  const r = await mcp.call('release_session', { label: 'personne' });
  assert.ok(r.result.isError);
  assert.match(r.result.content[0].text, /aucune session inscrite/);
});

test('cancel_decision cannot touch an approval card', async () => {
  const r = await request(t.port, 'POST', '/api/cards', { body: { kind: 'approval', agent: 'B', summary: 'rm', session: 's1' }, headers: clientHeaders(t) });
  const c = await mcp.call('cancel_decision', { id: r.json.id });
  assert.ok(c.result.isError);
  assert.equal(pendingCards().length, 1);
});

test('wait_answers drains the answers in fallback mode', async () => {
  const { claimId } = await claimAs(t, 'A');
  await mcp.call('queue_decision', { agent: 'Vol', summary: 'Patch ?', options: ['Oui', 'Non'] });
  const id = pendingCards()[0].id;
  await request(t.port, 'POST', '/api/answer', { body: { id, choice: '1' }, headers: pageHeaders(t) });
  const r = JSON.parse((await mcp.call('wait_answers', { claim: claimId, timeout_seconds: 1 })).result.content[0].text);
  assert.match(r.messages[0].text, /Vol/);
  assert.equal(delivery.pendingFor().length, 0);
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
  const { claimId } = await claimAs(t, 'A');
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'regarde ça', image: png(2000) }, headers: pageHeaders(t) });
  assert.equal(r.status, 200);
  const m = delivery.pendingFor()[0].text;
  assert.match(m, /Message de l'utilisateur : regarde ça/);
  const file = m.match(/Capture : (.+\.png)/)[1];
  assert.equal(fs.statSync(file).size, 2000);
});

test('several pasted images are all saved and listed in the message', async () => {
  await claimAs(t, 'A');
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'trois', images: [png(100), png(200), png(300)] }, headers: pageHeaders(t) });
  assert.equal(r.status, 200);
  const files = [...delivery.pendingFor()[0].text.matchAll(/^- (.+.png)$/gm)].map(m => m[1]);
  assert.deepEqual(files.map(f => fs.statSync(f).size), [100, 200, 300]);
});

test('more than five images are refused and nothing is written', async () => {
  await claimAs(t, 'A');
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'x', images: Array(6).fill(png(10)) }, headers: pageHeaders(t) });
  assert.equal(r.status, 413);
  assert.equal(delivery.pendingFor().length, 0);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'uploads')), []);
});

test('one bad image refuses the whole message, no file left behind', async () => {
  await claimAs(t, 'A');
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'x', images: [png(10), 'data:text/html;base64,PGI+'] }, headers: pageHeaders(t) });
  assert.equal(r.status, 415);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'uploads')), []);
});

test('an image over 10 MB is refused and nothing is delivered', async () => {
  const { claimId } = await claimAs(t, 'A');
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'gros', image: png(11 * 1024 * 1024) }, headers: pageHeaders(t) });
  assert.equal(r.status, 413);
  assert.equal(delivery.pendingFor().length, 0);
});

test('a non-image data URL is refused', async () => {
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'x', image: 'data:text/html;base64,PGI+' }, headers: pageHeaders(t) });
  assert.equal(r.status, 415);
});

test('the client secret cannot send a message as the user', async () => {
  const r = await request(t.port, 'POST', '/api/message', { body: { text: 'faux' }, headers: clientHeaders(t) });
  assert.equal(r.status, 403);
});

test('tools/list exposes the board tools and none sets a test ok', async () => {
  const r = await mcp.rpc('tools/list', {});
  const names = r.result.tools.map(x => x.name);
  for (const n of ['add_test', 'add_todo', 'update_item', 'close_todo', 'add_note', 'remove_item', 'reopen_item', 'list_board']) assert.ok(names.includes(n), n);
  assert.deepEqual([...names].sort(), ['add_note', 'add_test', 'add_todo', 'cancel_decision', 'close_todo', 'list_board', 'list_pending', 'queue_decision', 'release_session', 'remove_item', 'reopen_item', 'reply', 'set_plan', 'update_item', 'wait_answers']);
  assert.deepEqual(r.result.tools.find(x => x.name === 'close_todo').inputSchema.properties.state.enum, ['done', 'dropped']);
  assert.deepEqual(r.result.tools.find(x => x.name === 'add_test').inputSchema.properties.weight.enum, ['high', 'medium', 'low']);
});

test('add_test and list_board go through the board routes', async () => {
  const boardPath = path.join(dir, 'b', 'board.json');
  await claimAs(t, 'A', { board: boardPath });
  const a = await mcp.call('add_test', { text: 'scan', plan: 'p' });
  assert.ok(!a.result.isError, a.result.content[0].text);
  const list = JSON.parse((await mcp.call('list_board', { kind: 'test' })).result.content[0].text);
  assert.equal(list.items[0].text, 'scan');
});
