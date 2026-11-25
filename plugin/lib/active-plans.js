// Plans actifs, rangés par projet déclaré : { "<clé du projet>": [{ name, dir | file, label }] }.
// L'ancien format (un tableau commun à tous les projets) est mis à part au premier claim dans
// active-plans-legacy.json ; chaque projet qui se déclare y reprend les plans rangés sous son dossier des plans.
const fs = require('fs');
const path = require('path');
const { stateDir, readJson, writeJson } = require('./store');

const plansFile = () => path.join(stateDir(), 'active-plans.json');
const legacyFile = () => path.join(stateDir(), 'active-plans-legacy.json');
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function projectKey(p) {
  if (typeof p !== 'string' || !p.trim()) return null;
  const abs = path.resolve(p);
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
}

function isUnder(child, parent) {
  const c = projectKey(child), p = projectKey(parent);
  if (!c || !p) return false;
  const rel = path.relative(p, c);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function readMap() { const v = readJson(plansFile()); return isMap(v) ? v : {}; }

function plansOf(project) {
  const key = projectKey(project);
  if (!key) return [];
  const list = readMap()[key];
  return Array.isArray(list) ? list.filter(p => p && p.name) : [];
}

function setPlanFor(project, { name, dir, file, label, state }) {
  const key = projectKey(project);
  const all = readMap();
  const list = (Array.isArray(all[key]) ? all[key] : []).filter(p => p && p.name !== name);
  if (state !== 'archived') list.push(file ? { name, file, label } : { name, dir, label });
  all[key] = list;
  writeJson(plansFile(), all);
}

function adopt(project, plansDir) {
  const current = readJson(plansFile());
  if (Array.isArray(current)) {
    const prev = readJson(legacyFile());
    writeJson(legacyFile(), [...(Array.isArray(prev) ? prev : []), ...current]);
    writeJson(plansFile(), {});
  }
  const legacy = readJson(legacyFile());
  if (!Array.isArray(legacy)) return [];
  const key = projectKey(project);
  const mine = (p) => p && p.name && isUnder(p.file || p.dir, plansDir);
  const taken = legacy.filter(mine);
  if (!key || !taken.length) return [];
  const all = readMap();
  const list = Array.isArray(all[key]) ? all[key] : [];
  const adopted = taken.filter(p => !list.some(q => q && q.name === p.name));
  all[key] = [...list, ...adopted];
  writeJson(plansFile(), all);
  const rest = legacy.filter(p => !mine(p));
  if (rest.length) writeJson(legacyFile(), rest); else fs.rmSync(legacyFile(), { force: true });
  return adopted.map(p => p.name);
}

module.exports = { projectKey, isUnder, plansOf, setPlanFor, adopt };
