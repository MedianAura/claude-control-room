// Progression des plans actifs, lue dans leur plan.md (jamais écrit).
const fs = require('fs');

const BOX = /^\s*[-*] \[([ xX])\]/;

const compact = (s) => s.replace(/\s+/g, ' ').trim();

// Plan déplié dans la page : progression globale, puis par tâche (titre `###`) avec ses étapes de premier niveau.
// Les cases imbriquées comptent dans leur tâche sans être des étapes ; celles avant la première tâche ne comptent
// que dans le total.
const H3 = /^###\s+(.*?)\s*$/;
const STEP = /^[-*] \[([ xX])\] (.*)$/;
function planOutline(planFile) {
  const out = { done: 0, total: 0, tasks: [] };
  let text;
  try { text = fs.readFileSync(planFile, 'utf8'); } catch { return out; }
  let task = null;
  for (const l of text.split(/\r?\n/)) {
    const h = l.match(H3);
    if (h) { task = { title: h[1], done: 0, total: 0, steps: [] }; out.tasks.push(task); continue; }
    const m = l.match(BOX);
    if (!m) continue;
    const done = m[1] !== ' ';
    out.total++; if (done) out.done++;
    if (!task) continue;
    task.total++; if (done) task.done++;
    const s = l.match(STEP);
    if (s) {
      // Le gras sert de titre ; s'il finit par « : », le contenu est dans la suite (« **Step 4 (user):** Vérifier… »).
      const bold = s[2].match(/^\*\*(.+?)\*\*(.*)$/);
      const title = !bold ? s[2] : /:\s*$/.test(bold[1]) ? `${bold[1]} ${bold[2]}` : bold[1];
      task.steps.push({ text: compact(title.replace(/\*\*/g, '')).slice(0, 160), done });
    }
  }
  return out;
}

module.exports = { planOutline };
