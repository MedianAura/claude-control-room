// Écriture dans la boîte de réception d'une session Claude Code (canal nommé sous Windows).
// Format NON documenté, trouvé dans le binaire 2.1.330 (voir docs/superpowers/specs/2026-11-21-inbox-spike.md).
// Seul un processus enfant de la session livre : c'est `control-room listen` qui appelle ceci.
const net = require('net');

function deliverTo({ socket, token }, text, { from = 'control-room' } = {}) {
  return new Promise((resolve, reject) => {
    const c = net.createConnection(socket);
    c.on('error', reject);
    c.on('connect', () => {
      c.write(JSON.stringify({ type: 'auth', token }) + '\n');
      c.end(JSON.stringify({ type: 'user', from, message: { content: text } }) + '\n', resolve);
    });
  });
}

module.exports = { deliverTo };
