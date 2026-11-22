// Client HTTP du serveur control-room (MCP, hooks, claim, listen), authentifié par le secret des clients.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { stateDir, readJson } = require('./store');
const { HOST } = require('./host');

function serverInfo() {
  const dir = stateDir();
  const s = readJson(path.join(dir, 'server.json'));
  let secret = null;
  try { secret = fs.readFileSync(path.join(dir, 'client.secret'), 'utf8').trim(); } catch {}
  return s && secret ? { port: s.port, secret } : null;
}

// Serveur absent ou injoignable : { status: 0 }.
function call(method, urlPath, body, { timeoutMs = 10000 } = {}) {
  const info = serverInfo();
  if (!info) return Promise.resolve({ status: 0 });
  return new Promise((resolve) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ host: HOST, port: info.port, method, path: urlPath, timeout: timeoutMs,
      headers: { 'x-cr-secret': info.secret, host: `${HOST}:${info.port}`, ...(data ? { 'content-type': 'application/json' } : {}) } }, (res) => {
      let buf = '';
      res.on('data', d => { buf += d; });
      res.on('end', () => { let json; try { json = JSON.parse(buf); } catch {} resolve({ status: res.statusCode, json }); });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve({ status: 0 }));
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { call, serverInfo };
