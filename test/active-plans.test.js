const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tempStateDir } = require('./helpers');
const { readJson, writeJson } = require('../plugin/lib/store');
const { projectKey, isUnder, plansOf, setPlanFor, adopt } = require('../plugin/lib/active-plans');

let dir;
const file = () => path.join(dir, 'active-plans.json');
const legacyFile = () => path.join(dir, 'active-plans-legacy.json');
test.beforeEach(() => { dir = tempStateDir('cr-plans-'); });

test('projectKey normalizes separators, trailing slash and, on Windows, case', { skip: process.platform !== 'win32' }, () => {
  assert.equal(projectKey('F:/p'), projectKey('F:\\p\\'));
  assert.equal(projectKey('F:/p'), projectKey('f:\\P'));
});

test('projectKey is null without a path', () => {
  assert.equal(projectKey(''), null);
  assert.equal(projectKey(undefined), null);
  assert.equal(projectKey(42), null);
});

test('isUnder accepts the folder itself and below, not a sibling with a shared prefix', () => {
  assert.equal(isUnder('F:/p/plans/x', 'F:/p/plans'), true);
  assert.equal(isUnder('F:/p/plans', 'F:/p/plans'), true);
  assert.equal(isUnder('F:/p/plans-old/x', 'F:/p/plans'), false);
  assert.equal(isUnder('G:/x', 'F:/p'), false);
  assert.equal(isUnder(undefined, 'F:/p'), false);
});

test('a plan set for one project is not seen by another, and archiving removes it', () => {
  setPlanFor('F:/a', { name: 'x', dir: 'F:/a/plans/x', label: 'X', state: 'active' });
  assert.deepEqual(plansOf('F:/a'), [{ name: 'x', dir: 'F:/a/plans/x', label: 'X' }]);
  assert.deepEqual(plansOf('F:/b'), []);
  setPlanFor('F:/a', { name: 'x', state: 'archived' });
  assert.deepEqual(plansOf('F:/a'), []);
});

test('plansOf skips entries without a name and returns [] without a project', () => {
  setPlanFor('F:/a', { name: 'x', file: 'F:/a/plans/x.md', state: 'active' });
  const all = readJson(file());
  all[projectKey('F:/a')].push(null, { dir: 'F:/a/plans/y' });
  writeJson(file(), all);
  assert.deepEqual(plansOf('F:/a').map(p => p.name), ['x']);
  assert.deepEqual(plansOf(undefined), []);
});

test('an old-format file (array) shows nothing and is not rewritten by a read', () => {
  const old = [{ name: 'x', dir: 'F:/a/plans/x', label: 'X' }];
  writeJson(file(), old);
  assert.deepEqual(plansOf('F:/a'), []);
  assert.deepEqual(readJson(file()), old);
});

test('adopt moves the old list aside and takes only the plans under the plans folder', () => {
  writeJson(file(), [
    { name: 'x', dir: 'F:/a/plans/x', label: 'X' },
    { name: 'y', dir: 'F:/b/plans/y', label: 'Y' },
    { name: 'z', file: 'F:/a/plans/z.md', label: 'Z' },
  ]);
  assert.deepEqual(adopt('F:/a', 'F:/a/plans'), ['x', 'z']);
  assert.deepEqual(plansOf('F:/a').map(p => p.name), ['x', 'z']);
  assert.deepEqual(readJson(legacyFile()), [{ name: 'y', dir: 'F:/b/plans/y', label: 'Y' }]);
  assert.ok(!Array.isArray(readJson(file())));
  assert.deepEqual(adopt('F:/b', 'F:/b/plans'), ['y']);
  assert.deepEqual(plansOf('F:/b').map(p => p.name), ['y']);
  assert.equal(fs.existsSync(legacyFile()), false);
});

test('adopt with nothing to take back creates no file', () => {
  assert.deepEqual(adopt('F:/a', 'F:/a/plans'), []);
  assert.equal(fs.existsSync(file()), false);
  assert.equal(fs.existsSync(legacyFile()), false);
});

test('adopt does not overwrite a plan of the same name already declared for the project', () => {
  setPlanFor('F:/a', { name: 'x', dir: 'F:/a/plans/x', label: 'new', state: 'active' });
  writeJson(legacyFile(), [{ name: 'x', dir: 'F:/a/plans/x', label: 'old' }]);
  assert.deepEqual(adopt('F:/a', 'F:/a/plans'), []);
  assert.deepEqual(plansOf('F:/a'), [{ name: 'x', dir: 'F:/a/plans/x', label: 'new' }]);
  assert.equal(fs.existsSync(legacyFile()), false);
});
