// Adresse de bouclage dédiée : les cookies ne sont pas isolés par port, donc sur 127.0.0.1 le cookie de la
// page partirait vers tout autre serveur local (serveur de dev d'une session, autre plugin…). Windows et Linux
// routent tout 127.0.0.0/8 en local.
// Sous WSL2 (NAT), le relais localhost vers Windows ne transmet que 127.0.0.1 : on y perd l'isolation du cookie,
// sinon le navigateur Windows ne joint pas la page.
const fs = require('fs');

function osrelease() {
  try { return fs.readFileSync('/proc/sys/kernel/osrelease', 'utf8'); } catch { return ''; }
}

function isWsl({ platform = process.platform, env = process.env, osrelease: rel } = {}) {
  if (platform !== 'linux') return false;
  return Boolean(env.WSL_DISTRO_NAME) || /microsoft/i.test(rel === undefined ? osrelease() : rel);
}

const pickHost = ({ env, wsl }) => env.CONTROL_ROOM_HOST || (wsl ? '127.0.0.1' : '127.83.82.1');

const HOST = pickHost({ env: process.env, wsl: isWsl() });

// Commande qui ouvre la page dans le navigateur par défaut : [commande, arguments, options de spawn].
// Sous WSL, le navigateur est celui de Windows ; cmd.exe lancé depuis /mnt/c évite l'avertissement de chemin UNC.
function browserCommand(url, { platform = process.platform, wsl = isWsl() } = {}) {
  if (platform === 'win32') return ['cmd', ['/c', 'start', '""', url], { windowsVerbatimArguments: true }];
  if (wsl) return ['cmd.exe', ['/c', 'start', url], { cwd: '/mnt/c' }];
  if (platform === 'darwin') return ['open', [url], {}];
  return ['xdg-open', [url], {}];
}

module.exports = { HOST, isWsl, pickHost, browserCommand };
