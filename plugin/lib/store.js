// État partagé en fichiers JSON, écritures atomiques (tmp + rename).
const fs = require('fs');
const os = require('os');
const path = require('path');

const SUBDIRS = ['cards', 'sessions', 'uploads'];

function stateDir() {
  const dir = process.env.CONTROL_ROOM_DIR || path.join(os.homedir(), '.claude', 'control-room');
  for (const d of SUBDIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });
  return dir;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJson(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function appendHistory(entry) {
  fs.appendFileSync(path.join(stateDir(), 'history.jsonl'), JSON.stringify({ at: Date.now(), ...entry }) + '\n');
}

// Événements courts pour le résumé au retour (« build réussi », « test ajouté »…).
const MAX_EVENTS = 200;
function eventsFile() { return path.join(stateDir(), 'events.jsonl'); }
function addEvent(text) {
  fs.appendFileSync(eventsFile(), JSON.stringify({ at: Date.now(), text }) + '\n');
}
function readEvents() {
  try {
    return fs.readFileSync(eventsFile(), 'utf8').trim().split('\n').slice(-MAX_EVENTS)
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// Dernières lignes d'historique, la plus récente d'abord.
function readHistory(n = 30) {
  try {
    return fs.readFileSync(path.join(stateDir(), 'history.jsonl'), 'utf8').trim().split('\n').slice(-n).reverse()
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

module.exports = { stateDir, readJson, writeJson, appendHistory, readHistory, addEvent, readEvents };
