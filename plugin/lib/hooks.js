// Gestionnaires de hooks (lancés par Claude Code, entrée JSON sur stdin).
// Règle commune : serveur absent ou erreur → ne rien écrire et sortir en 0, la session continue comme sans plugin.
const { call } = require('./client');

const LONG_POLL_S = 60;
const APPROVAL_BUDGET_S = 870; // sous le timeout 900 du hook

function readStdin() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => { s += d; });
    process.stdin.on('end', () => { try { resolve(JSON.parse(s)); } catch { resolve({}); } });
  });
}

const keyOf = (input) => process.env.CLAUDE_CODE_MESSAGING_SOCKET || input.session_id;

function reportStatus(input) {
  return call('POST', '/api/sessions/event', {
    key: keyOf(input), session_id: input.session_id, cwd: input.cwd, event: input.hook_event_name,
    tool_name: input.tool_name, tool_input: input.tool_input && { description: input.tool_input.description },
    reason: input.reason, notification_type: input.notification_type,
    prompt: typeof input.prompt === 'string' ? input.prompt.slice(-2000) : undefined,
  }, { timeoutMs: 3000 });
}

async function permission(input) {
  const key = keyOf(input);
  const who = await call('GET', `/api/sessions/enrolled?key=${encodeURIComponent(key)}`, undefined, { timeoutMs: 3000 });
  if (who.status !== 200 || !who.json.enrolled) return null; // hors équipe : la demande normale s'affiche
  const label = who.json.label;
  const created = await call('POST', '/api/cards', {
    kind: 'approval', agent: label, session: key,
    summary: `${label} veut utiliser ${input.tool_name}`,
    tool: { name: input.tool_name, input: input.tool_input },
  });
  if (created.status !== 200) return null;
  const deadline = Date.now() + APPROVAL_BUDGET_S * 1000;
  while (Date.now() < deadline) {
    const wait = Math.min(LONG_POLL_S, Math.ceil((deadline - Date.now()) / 1000));
    const r = await call('GET', `/api/cards/${created.json.id}/answer?wait=${wait}`, undefined, { timeoutMs: (wait + 10) * 1000 });
    if (r.status === 0 || r.status === 410) return null;
    if (r.status !== 200) continue;
    const decision = r.json.choice === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: `Refusé depuis control-room${r.json.note ? ` : ${r.json.note}` : '.'}` };
    return { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } };
  }
  // Délai dépassé : la carte expire (la page ne doit plus proposer d'autoriser) et la demande normale
  // s'affiche dans le terminal.
  await call('POST', `/api/cards/${created.json.id}/expire`, undefined, { timeoutMs: 3000 });
  return null;
}

async function stop(input) {
  await reportStatus({ ...input, hook_event_name: 'Stop' });
  if (input.stop_hook_active) return null; // jamais deux relances d'affilée
  const socket = process.env.CLAUDE_CODE_MESSAGING_SOCKET;
  if (!socket) return null;
  const r = await call('GET', `/api/outbox/stale?socket=${encodeURIComponent(socket)}`, undefined, { timeoutMs: 3000 });
  if (r.status !== 200 || !r.json.messages.length) return null;
  const reason = [
    'Réponses de l\'utilisateur dans control-room qui ne t\'étaient pas parvenues (livraison en panne) :',
    ...r.json.messages.map(m => m.text),
    r.json.listenerMissing ? 'Ton écouteur ne tourne plus : relance `control-room listen` en arrière-plan.' : 'La livraison par ta boîte de réception ne répond pas : signale-le à l\'utilisateur par une carte (reply).',
  ].join('\n\n');
  return { decision: 'block', reason };
}

async function runHook(kind) {
  const input = await readStdin();
  let out = null;
  try {
    if (kind === 'permission') out = await permission(input);
    else if (kind === 'stop') out = await stop(input);
    else await reportStatus(input);
  } catch { out = null; }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

async function label(text) {
  const key = process.env.CLAUDE_CODE_MESSAGING_SOCKET;
  if (!key || !text) { console.error('Usage, depuis le Bash d\'une session : control-room label "<emoji> <libellé>"'); process.exit(2); }
  const r = await call('POST', '/api/sessions/label', { key, label: text });
  if (r.status === 0) { console.error('control-room ne tourne pas.'); process.exit(1); }
  console.log(r.status === 200 ? `Session inscrite : ${text}. Tes demandes de permission passeront par la page control-room.` : `Refusé (${r.status}).`);
}

module.exports = { runHook, label };
