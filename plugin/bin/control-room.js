#!/usr/bin/env node
// Lanceur et commandes de control-room.
//   control-room start [--no-open]   lance le serveur et ouvre la page
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { stateDir, writeJson } = require('../lib/store');

const commands = {
  async start(args) {
    const { createServer } = require('../lib/server');
    const { loadClientSecret, newPageSecret } = require('../lib/auth');
    const port = parseInt(process.env.CONTROL_ROOM_PORT || '4242', 10);
    const pageSecret = newPageSecret();
    const bootstrapKey = newPageSecret();
    const server = createServer({ pageSecret, bootstrapKey, clientSecret: loadClientSecret(), deliver: async () => {} });
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') console.error(`control-room est déjà lancé (port ${port} occupé).`);
      else console.error(`control-room : ${e.message}`);
      process.exit(1);
    });
    server.listen(port, '127.0.0.1', () => {
      const serverFile = path.join(stateDir(), 'server.json');
      writeJson(serverFile, { port, pid: process.pid, started: Date.now() });
      const cleanup = () => { try { fs.unlinkSync(serverFile); } catch {} process.exit(0); };
      process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
      const url = `http://127.0.0.1:${port}/?k=${bootstrapKey}`;
      // L'URL n'est affichée que dans un vrai terminal : lancée par une session Claude, elle finirait
      // dans sa conversation. La clé ne sert qu'une fois de toute façon.
      if (process.stdout.isTTY) console.log(`control-room : ${url}`);
      else console.log(`control-room lancé sur le port ${port} (page ouverte dans le navigateur).`);
      if (!args.includes('--no-open')) openBrowser(url);
    });
  },
};

function openBrowser(url) {
  const [cmd, argv] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, argv, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
}

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) {
  console.error('Usage : control-room start [--no-open]');
  process.exit(2);
}
commands[name](args);
