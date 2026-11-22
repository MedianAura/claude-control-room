// Adresse de bouclage dédiée : les cookies ne sont pas isolés par port, donc sur 127.0.0.1 le cookie de la
// page partirait vers tout autre serveur local (serveur de dev d'une session, autre plugin…). Windows et Linux
// routent tout 127.0.0.0/8 en local.
const HOST = process.env.CONTROL_ROOM_HOST || '127.83.82.1';
module.exports = { HOST };
