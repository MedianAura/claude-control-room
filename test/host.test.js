const test = require('node:test');
const assert = require('node:assert');
const { isWsl, pickHost, browserCommand } = require('../plugin/lib/host');

test('isWsl: Linux with WSL_DISTRO_NAME or a microsoft kernel, nothing else', () => {
  assert.equal(isWsl({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' }, osrelease: '' }), true);
  assert.equal(isWsl({ platform: 'linux', env: {}, osrelease: '5.15.167.4-microsoft-standard-WSL2' }), true);
  assert.equal(isWsl({ platform: 'linux', env: {}, osrelease: '6.8.0-45-generic' }), false);
  assert.equal(isWsl({ platform: 'win32', env: { WSL_DISTRO_NAME: 'Ubuntu' }, osrelease: '' }), false);
});

test('pickHost: 127.0.0.1 under WSL, the dedicated address elsewhere, the variable first', () => {
  assert.equal(pickHost({ env: {}, wsl: true }), '127.0.0.1');
  assert.equal(pickHost({ env: {}, wsl: false }), '127.83.82.1');
  assert.equal(pickHost({ env: { CONTROL_ROOM_HOST: '127.0.0.5' }, wsl: true }), '127.0.0.5');
});

test('browserCommand: cmd.exe from /mnt/c under WSL, xdg-open on plain Linux', () => {
  const url = 'http://h/?k=x';
  const [cmd, argv, opts] = browserCommand(url, { platform: 'linux', wsl: true });
  assert.equal(cmd, 'cmd.exe');
  assert.deepEqual(argv, ['/c', 'start', url]);
  assert.equal(opts.cwd, '/mnt/c');
  assert.equal(browserCommand(url, { platform: 'linux', wsl: false })[0], 'xdg-open');
});
