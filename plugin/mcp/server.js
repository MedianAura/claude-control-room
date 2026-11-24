#!/usr/bin/env node
// Serveur MCP (stdio, JSON-RPC une ligne par message) des outils de l'orchestratrice.
// Boucle reprise de decision-inbox ; les outils sont dans lib/tools.js, partagés avec control-room tool.
const { TOOLS, runTool, format } = require('../lib/tools');

const VERSION = require('../.claude-plugin/plugin.json').version;

const text = (o, isError) => ({ content: [{ type: 'text', text: format(o) }], ...(isError ? { isError: true } : {}) });

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'control-room', version: VERSION } } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      let result;
      try { result = text(await runTool(params.name, params.arguments)); } catch (e) { result = text(e.message, true); }
      return send({ jsonrpc: '2.0', id, result });
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e && e.message || e) } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { process.stderr.write(`[control-room] ligne illisible : ${e.message}\n`); }
  }
});
process.stdin.on('end', () => process.exit(0));
