// Outils de test : dossier d'état temporaire, serveur sur un port libre, requêtes HTTP.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { HOST } = require('../plugin/lib/host');

function tempStateDir(prefix = 'cr-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.CONTROL_ROOM_DIR = dir;
  return dir;
}

async function startTestServer(opts = {}) {
  const { createServer } = require('../plugin/lib/server');
  const { loadClientSecret, newPageSecret } = require('../plugin/lib/auth');
  const delivered = [];
  const pageSecret = newPageSecret();
  const bootstrapKey = newPageSecret();
  const clientSecret = loadClientSecret();
  const server = createServer({ pageSecret, bootstrapKey, clientSecret, deliver: async (t) => { delivered.push(t); }, ...opts });
  await new Promise(r => server.listen(0, HOST, r));
  const port = server.address().port;
  fs.writeFileSync(path.join(process.env.CONTROL_ROOM_DIR, 'server.json'), JSON.stringify({ port, pid: process.pid }));
  return { server, port, pageSecret, bootstrapKey, clientSecret, delivered, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}

function request(port, method, urlPath, { body, headers = {}, raw } = {}) {
  return new Promise((resolve, reject) => {
    const data = raw !== undefined ? raw : body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({ host: HOST, port, method, path: urlPath,
      headers: { host: `${HOST}:${port}`, ...(data ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
      let buf = '';
      res.on('data', d => { buf += d; });
      res.on('end', () => {
        let json; try { json = JSON.parse(buf); } catch { json = undefined; }
        resolve({ status: res.statusCode, headers: res.headers, text: buf, json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function pageHeaders(t) {
  return { cookie: `cr_page=${t.pageSecret}`, origin: `http://${HOST}:${t.port}` };
}
function clientHeaders(t) { return { 'x-cr-secret': t.clientSecret }; }

// Déclare une orchestratrice ; rend { claimId, code }.
async function claimAs(t, socket, extra = {}) {
  const r = await request(t.port, 'POST', '/api/claim', { body: { socket, project: 'F:/p', plans: 'F:/p/plans', master: 'F:/p/plans/m/plan.md', ...extra }, headers: clientHeaders(t) });
  if (r.status !== 200) throw new Error(`claim ${r.status}`);
  return r.json;
}

module.exports = { tempStateDir, startTestServer, request, pageHeaders, clientHeaders, claimAs, HOST };
