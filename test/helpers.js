// Outils de test : dossier d'état temporaire, serveur sur un port libre, requêtes HTTP.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

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
  const clientSecret = loadClientSecret();
  const server = createServer({ pageSecret, clientSecret, deliver: async (t) => { delivered.push(t); }, ...opts });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { server, port, pageSecret, clientSecret, delivered, close: () => new Promise(r => server.close(r)) };
}

function request(port, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath,
      headers: { host: `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
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
  return { cookie: `cr_page=${t.pageSecret}`, origin: `http://127.0.0.1:${t.port}` };
}
function clientHeaders(t) { return { 'x-cr-secret': t.clientSecret }; }

module.exports = { tempStateDir, startTestServer, request, pageHeaders, clientHeaders };
