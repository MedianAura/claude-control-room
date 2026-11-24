// Bandeau des sessions : une ligne par session, mise à jour sur place par les hooks.
// Clé d'une session : son CLAUDE_CODE_MESSAGING_SOCKET (vu par les hooks et par Bash, essai de la tâche 1).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { stateDir, readJson, writeJson, addEvent } = require('./store');
const cards = require('./cards');

const fileOf = (key) => path.join(stateDir(), 'sessions', crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 16) + '.json');
const read = (key) => readJson(fileOf(key));
const write = (s) => writeJson(fileOf(s.key), s);

function defaultLabel({ cwd, session_id }) {
  return `${path.basename(String(cwd || '').replace(/[\\/]+$/, '')) || 'session'} · ${String(session_id || '').slice(0, 4)}`;
}

// Jauge de contexte (0.4.0) : poussée par le module de mod (hooks/register.ts), seul à voir le % que la
// statusline affiche. Le module ne connaît pas toujours le socket de messagerie ; il donne le session_id, que les
// hooks classiques ont déjà rangé dans la fiche. Ne touche ni à l'état, ni à `at` (l'heure de la dernière activité).
function setContext({ key, session_id, pct }) {
  const n = Math.round(Number(pct));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  const s = (key && read(key)) || (session_id && readAll().find(x => x.session_id === session_id));
  if (!s) return null;
  write({ ...s, context: { pct: n, at: Date.now() } });
  return s;
}

function update(key, patch) {
  const s = { key, label: null, enrolled: false, status: 'idle', activity: '', ...read(key), ...patch, at: Date.now() };
  if (!s.label) s.label = defaultLabel(s);
  write(s);
  return s;
}

const STATUS = {
  SessionStart: () => ({ status: 'idle', activity: '' }),
  UserPromptSubmit: () => ({ status: 'working', activity: 'reçoit un message' }),
  PreToolUse: (e) => ({ status: 'working', activity: (e.tool_input && e.tool_input.description) || e.tool_name || '' }),
  Stop: () => ({ status: 'idle', activity: '' }),
  PermissionDenied: (e) => ({ activity: `refus du mode auto : ${e.reason || e.tool_name || ''}` }),
  Notification: (e) => e.notification_type === 'permission_prompt' ? { status: 'approval', activity: 'attend une approbation dans son terminal' }
    : e.notification_type === 'idle_prompt' ? { status: 'idle', activity: '' } : {},
};

// Le bandeau montre l'équipe de l'orchestratrice, pas toutes les sessions où le plugin tourne : les sessions
// inscrites (control-room label, à sa demande) et l'orchestratrice elle-même, reconnue par l'empreinte du
// socket que claim a gardée dans orchestrator.json.
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function inTeam() {
  const o = readJson(path.join(stateDir(), 'orchestrator.json'));
  return (s) => s.enrolled || (!!o && sha256(s.key) === o.socketHash);
}

// Une session muette depuis 2 h (fermée sans SessionEnd, tuée) quitte le bandeau (revue #12).
const SESSION_TTL_MS = 2 * 3600e3;

const readAll = () => {
  const dir = path.join(stateDir(), 'sessions');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir, f))).filter(Boolean);
};

// Test de vie (essai docs/superpowers/specs/2026-11-22-liveness-spike.md) : une connexion vide au socket de la
// session, fermée aussitôt, sans effet sur elle. Morte seulement si le socket n'existe plus (ENOENT, pipe Windows)
// ou refuse (ECONNREFUSED, socket Unix resté sur disque) ; tout le reste compte comme vivante, car retirer une
// session vivante est pire que garder un fantôme 30 s de plus.
const PROBE_EVERY_MS = 30e3;
const probeable = (key) => /^\\\\[.?]\\pipe\\/i.test(String(key)) || path.isAbsolute(String(key));
function alive(key) {
  return new Promise((resolve) => {
    let s;
    const end = (v) => { if (s) s.destroy(); resolve(v); };
    try { s = net.createConnection(key); } catch { return resolve(true); }
    s.setTimeout(2000, () => end(true));
    s.on('connect', () => end(true));
    s.on('error', (e) => end(e.code !== 'ENOENT' && e.code !== 'ECONNREFUSED'));
  });
}

let lastSweep = 0, sweeping = null;
async function sweep() {
  lastSweep = Date.now();
  const team = inTeam();
  await Promise.all(readAll().filter(s => team(s) && probeable(s.key)).map(async (s) => {
    if (await alive(s.key)) return;
    try { fs.unlinkSync(fileOf(s.key)); } catch {}
    addEvent(`session fermée : ${s.label}`);
  }));
}

function list() {
  if (!sweeping && Date.now() - lastSweep > PROBE_EVERY_MS) sweeping = sweep().catch(() => {}).finally(() => { sweeping = null; });
  const pending = cards.pendingCards();
  const now = Date.now();
  const team = inTeam();
  return readAll()
    .filter(s => team(s) && now - (s.at || 0) < SESSION_TTL_MS)
    .map(({ key, label, status, activity, at, context }) => {
      if (pending.some(c => c.kind === 'approval' && c.session === key)) status = 'approval';
      else if (pending.some(c => c.kind === 'decision' && c.session && c.session === label)) status = 'decision';
      return { key, label, status, activity, at, context: context || null };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function routes(delivery) {
  return [
    { method: 'POST', match: p => p === '/api/sessions/event', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const e = await readBody(req, 4 * 1024 * 1024);
      if (e.event === 'Context') return send(res, 200, { ok: !!setContext({ key: e.key, session_id: e.session_id, pct: e.context_pct }) });
      if (!e.key) return send(res, 400, { error: 'key requise' });
      if (e.event === 'SessionEnd') { try { fs.unlinkSync(fileOf(e.key)); } catch {} return send(res, 200, { ok: true }); }
      const map = STATUS[e.event];
      const s = update(e.key, { session_id: e.session_id, cwd: e.cwd, ...(map ? map(e) : {}) });
      if (e.event === 'PermissionDenied') addEvent(`${s.label} : ${s.activity}`);
      // Accusé de réception : un message [cr:<id>] vient d'arriver dans la session.
      if (e.event === 'UserPromptSubmit' && typeof e.prompt === 'string') for (const m of e.prompt.matchAll(/\[cr:([0-9a-f]+)(?::[0-9a-f]+)?\]/g)) delivery.ack(m[1]);
      return send(res, 200, { ok: true });
    } },
    { method: 'POST', match: p => p === '/api/sessions/label', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const { key, label } = await readBody(req);
      if (!key || !label) return send(res, 400, { error: 'key et label requis' });
      const s = update(key, { label, enrolled: true });
      addEvent(`session inscrite : ${s.label}`);
      return send(res, 200, { ok: true });
    } },
    // L'orchestratrice a fini avec un worker : il quitte l'équipe (bandeau, interception des permissions).
    { method: 'POST', match: p => p === '/api/sessions/release', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const { label } = await readBody(req);
      const dir = path.join(stateDir(), 'sessions');
      const hit = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir, f)))
        .filter(s => s && s.enrolled && s.label === label);
      if (!hit.length) return send(res, 404, { error: `aucune session inscrite sous « ${label} »` });
      for (const s of hit) write({ ...s, enrolled: false });
      addEvent(`session libérée : ${label}`);
      return send(res, 200, { released: hit.length });
    } },
    { method: 'GET', match: p => p === '/api/sessions/enrolled', auth: 'client', handle: async (req, res, url, { send }) => {
      const s = read(url.searchParams.get('key'));
      return send(res, 200, { enrolled: !!(s && s.enrolled), label: s ? s.label : null });
    } },
  ];
}

module.exports = { routes, list, sweep, defaultLabel, setContext };
