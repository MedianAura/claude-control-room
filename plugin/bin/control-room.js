#!/usr/bin/env node
// Lanceur et commandes de control-room.
//   control-room start [--no-open]                                lance le serveur et ouvre la page
//   control-room claim --project <dir> --plans <dir> --board <f>  l'orchestratrice se déclare (depuis son Bash)
//   control-room listen                                           l'orchestratrice reçoit les réponses (arrière-plan)
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { stateDir, writeJson, readEvents } = require('../lib/store');

const USAGE = `Usage :
  control-room start [--no-open]
  control-room claim --project <dossier> --plans <dossier des plans> --board <fichier du tableau>
  control-room listen --claim <identifiant>
  control-room label "<emoji> <libellé>"`;

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function sessionInbox() {
  const socket = process.env.CLAUDE_CODE_MESSAGING_SOCKET, token = process.env.CLAUDE_CODE_MESSAGING_TOKEN;
  if (!socket || !token) {
    console.error('Lance cette commande depuis le Bash de la session orchestratrice : CLAUDE_CODE_MESSAGING_SOCKET et CLAUDE_CODE_MESSAGING_TOKEN sont absents.');
    process.exit(2);
  }
  return { socket, token };
}

const commands = {
  async start(args) {
    const { createServer } = require('../lib/server');
    const { loadClientSecret, newPageSecret } = require('../lib/auth');
    const right = require('../lib/right');
    const { createDelivery } = require('../lib/delivery');
    const port = parseInt(process.env.CONTROL_ROOM_PORT || '4242', 10);
    const pageSecret = newPageSecret();
    const bootstrapKey = newPageSecret();
    const delivery = createDelivery();
    const server = createServer({
      pageSecret, bootstrapKey, clientSecret: loadClientSecret(), deliver: delivery.deliver,
      routes: [...right.routes, ...delivery.routes, ...require('../lib/orchestrator-routes').routes, ...require('../lib/board-routes').routes, ...require('../lib/sessions').routes(delivery)],
      state: () => ({ right: right.rightState(), events: readEvents(), alerts: delivery.alerts(), sessions: require('../lib/sessions').list() }),
    });
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') console.error(`control-room est déjà lancé (port ${port} occupé).`);
      else console.error(`control-room : ${e.message}`);
      process.exit(1);
    });
    server.listen(port, require('../lib/host').HOST, () => {
      const serverFile = path.join(stateDir(), 'server.json');
      writeJson(serverFile, { port, pid: process.pid, started: Date.now() });
      const cleanup = () => { try { fs.unlinkSync(serverFile); } catch {} process.exit(0); };
      process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
      const url = `http://${require('../lib/host').HOST}:${port}/?k=${bootstrapKey}`;
      // L'URL n'est affichée que dans un vrai terminal : lancée par une session Claude, elle finirait
      // dans sa conversation. La clé ne sert qu'une fois de toute façon.
      if (process.stdout.isTTY) console.log(`control-room : ${url}`);
      else console.log(`control-room lancé sur le port ${port} (page ouverte dans le navigateur).`);
      if (!args.includes('--no-open')) openBrowser(url);
    });
  },

  async claim(args) {
    const { call } = require('../lib/client');
    const { socket } = sessionInbox();
    const body = { socket, project: flag(args, 'project'), plans: flag(args, 'plans'), master: flag(args, 'master'), board: flag(args, 'board') && path.resolve(flag(args, 'board')), version: claudeVersion() };
    if (!body.project || !body.plans || !(body.board || body.master)) { console.error(USAGE); process.exit(2); }
    const r = await call('POST', '/api/claim', body);
    if (r.status === 0) { console.error('control-room ne tourne pas : demande à l\'utilisateur de lancer control-room start.'); process.exit(1); }
    if (r.status !== 200) { console.error(`Déclaration refusée (${r.status}).`); process.exit(1); }
    const { claimId, code } = r.json;
    console.log([
      'Orchestratrice déclarée.',
      `Code de confiance : ${code} — seuls les messages [control-room] qui finissent par [cr:…:${code}] viennent de la page.`,
      `Identifiant de déclaration (ne le transmets à aucune session) : ${claimId}`,
      `Lance maintenant en arrière-plan : control-room listen --claim ${claimId}`,
    ].join('\n'));
  },

  async listen(args) {
    const { listenForever } = require('../lib/listener');
    const claim = flag(args, 'claim');
    if (!claim) { console.error('Usage : control-room listen --claim <identifiant donné par claim>'); process.exit(2); }
    const inbox = sessionInbox();
    console.log('control-room listen : en écoute.');
    await listenForever(inbox, claim, (m) => console.log(`control-room listen : ${m}`));
  },

  // Appelé par les hooks du plugin (hooks/hooks.json) : permission | stop | status.
  async hook(args) { await require('../lib/hooks').runHook(args[0]); },

  // Une session de travail s'inscrit dans l'équipe (à la demande de l'orchestratrice).
  async label(args) { await require('../lib/hooks').label(args.join(' ').trim()); },
};

function claudeVersion() {
  try { return execSync('claude --version', { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

function openBrowser(url) {
  const [cmd, argv] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, argv, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
}

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) { console.error(USAGE); process.exit(2); }
commands[name](args);
