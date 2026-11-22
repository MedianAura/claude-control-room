// Bandeau des sessions : une ligne par session, mise à jour sur place par les hooks.
// Clé d'une session : son CLAUDE_CODE_MESSAGING_SOCKET (vu par les hooks et par Bash, essai de la tâche 1).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stateDir, readJson, writeJson, addEvent } = require('./store');
const cards = require('./cards');

const fileOf = (key) => path.join(stateDir(), 'sessions', crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 16) + '.json');
const read = (key) => readJson(fileOf(key));
const write = (s) => writeJson(fileOf(s.key), s);

function defaultLabel({ cwd, session_id }) {
  return `${path.basename(String(cwd || '').replace(/[\\/]+$/, '')) || 'session'} · ${String(session_id || '').slice(0, 4)}`;
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

// Une session muette depuis 2 h (fermée sans SessionEnd, tuée) quitte le bandeau (revue #12).
const SESSION_TTL_MS = 2 * 3600e3;

function list() {
  const dir = path.join(stateDir(), 'sessions');
  const pending = cards.pendingCards();
  const now = Date.now();
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir, f))).filter(Boolean)
    .filter(s => now - (s.at || 0) < SESSION_TTL_MS)
    .map(({ key, label, status, activity, at }) => {
      if (pending.some(c => c.kind === 'approval' && c.session === key)) status = 'approval';
      else if (pending.some(c => c.kind === 'decision' && c.session && c.session === label)) status = 'decision';
      return { key, label, status, activity, at };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function routes(delivery) {
  return [
    { method: 'POST', match: p => p === '/api/sessions/event', auth: 'client', handle: async (req, res, url, { readBody, send }) => {
      const e = await readBody(req, 4 * 1024 * 1024);
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
    { method: 'GET', match: p => p === '/api/sessions/enrolled', auth: 'client', handle: async (req, res, url, { send }) => {
      const s = read(url.searchParams.get('key'));
      return send(res, 200, { enrolled: !!(s && s.enrolled), label: s ? s.label : null });
    } },
  ];
}

module.exports = { routes, list, defaultLabel };
