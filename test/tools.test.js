const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir, startTestServer, request } = require('./helpers');
const orchRoutes = require('../plugin/lib/orchestrator-routes');
const { runTool, format, DOWN } = require('../plugin/lib/tools');

let t, dir;
test.beforeEach(async () => {
  dir = tempStateDir('cr-tools-');
  t = await startTestServer({ routes: [...orchRoutes.routes, ...require('../plugin/lib/board-routes').routes] });
});
test.afterEach(async () => { await t.close(); });

const conversation = async () => (await request(t.port, 'GET', '/api/state', { headers: { cookie: `cr_page=${t.pageSecret}` } })).json.conversation;

test('runTool reply returns the raw result and posts to the thread', async () => {
  const r = await runTool('reply', { text: 'Salut' });
  assert.ok(r.shown);
  assert.equal((await conversation()).at(-1).text, 'Salut');
});

test('runTool rejects an unknown tool', async () => {
  await assert.rejects(runTool('nope'), (e) => e.unknown === true && /Outil inconnu : nope/.test(e.message));
});

test('runTool says the server is down when it is not running', async () => {
  await t.close();
  fs.unlinkSync(path.join(dir, 'server.json'));
  await assert.rejects(runTool('list_pending'), (e) => e.down === true && e.message === DOWN);
  t = { close: async () => {} };
});

test('format keeps strings and indents objects like the MCP text', () => {
  assert.equal(format('Retirée.'), 'Retirée.');
  assert.equal(format({ a: 1 }), '{\n  "a": 1\n}');
});
