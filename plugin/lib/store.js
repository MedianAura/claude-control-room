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

module.exports = { stateDir, readJson, writeJson, appendHistory };
