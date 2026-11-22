// Lecture et écriture du plan maître : tests (user), entrées TODO, progression des plans.
const fs = require('fs');

const H2 = /^##\s+(.*?)\s*$/;
const ENTRY = /^- \[([ xX])\] \*\*(.+?)\*\*/;          // entrée de premier niveau de « To do »
const USER_TEST = /^(\s*)- \[([ xX])\] \(user\) (.*)$/;
const TOP_BULLET = /^[-*] /;
const PLAN_DIR = /\.agents\/plans\/[\w.-]+\//;
const BOX = /^\s*[-*] \[([ xX])\]/;

const compact = (s) => s.replace(/\s+/g, ' ').trim();

function parseMaster(text) {
  const tests = [], todos = [];
  let section = null, entry = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(H2);
    if (h) { section = h[1]; entry = null; continue; }
    if (/^#/.test(line)) { entry = null; continue; }
    const inTodo = section === 'To do';
    const e = inTodo && line.match(ENTRY);
    if (e) {
      entry = { name: e[2], done: e[1] !== ' ', planDir: null };
      todos.push(entry);
    } else if (TOP_BULLET.test(line)) {
      entry = null;
    }
    const u = line.match(USER_TEST);
    if (u) {
      const nested = u[1].length > 0;
      tests.push({ text: compact(u[3]), done: u[2] !== ' ', parent: nested && entry ? entry.name : section });
    } else if (entry && !entry.planDir) {
      const p = line.match(PLAN_DIR);
      if (p) entry.planDir = p[0];
    }
  }
  return { tests, todos };
}

function tickTest(file, text) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = compact(text);
  const hits = [];
  lines.forEach((l, i) => {
    const u = l.match(USER_TEST);
    if (u && u[2] === ' ' && compact(u[3]) === want) hits.push(i);
  });
  if (hits.length === 0) return 'not-found';
  if (hits.length > 1) return 'ambiguous';
  lines[hits[0]] = lines[hits[0]].replace('- [ ]', '- [x]');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.join(eol));
  fs.renameSync(tmp, file);
  return 'ok';
}

function planProgress(planFile) {
  let done = 0, total = 0;
  try {
    for (const l of fs.readFileSync(planFile, 'utf8').split(/\r?\n/)) {
      const m = l.match(BOX);
      if (m) { total++; if (m[1] !== ' ') done++; }
    }
  } catch {}
  return { done, total };
}

module.exports = { parseMaster, tickTest, planProgress };
