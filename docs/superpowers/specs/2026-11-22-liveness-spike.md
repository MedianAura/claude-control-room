# Essai : savoir si une session est vivante en sondant son socket

Date : 2026-11-22. Claude Code 2.1.330, Windows 10. Suite de `2026-11-21-inbox-spike.md`.

## Question

Le bandeau garde une session inscrite qui a planté jusqu'à 2 h (`SESSION_TTL_MS`) : une session fermée sans
`SessionEnd` et une session inactive se taisent toutes les deux. La clé d'une session est son
`CLAUDE_CODE_MESSAGING_SOCKET` (`\\.\pipe\LOCAL\cc-msg-<32 hex>`). Le serveur peut-il savoir si ce pipe existe
encore ?

## Sonde

`net.createConnection(pipe)`, puis `end()` dès `connect`, sans ligne d'authentification ni message. Délai 2 s.

## Résultats

| Cas | Processus sondeur | Résultat |
|---|---|---|
| Session vivante (celle de l'essai) | enfant de la session | `connect` en 2 ms |
| Session vivante | **non enfant** (créé par WMI, parent `WmiPrvSE`) | `connect` en 2 ms |
| Session `claude -p` terminée | enfant | `ENOENT` en 3 ms |
| Nom bien formé jamais créé | enfant | `ENOENT` en 3 ms |

Le serveur (`control-room start`, non enfant) peut donc sonder : il ne peut pas livrer (essai précédent, d), mais
la connexion aboutit.

**Effet sur la session sondée** : 5 sondes vides sur la session de l'essai, dont une non enfant ; aucun message ni
tour déclenché. Le gestionnaire `[uds-messaging]` ignore une connexion fermée sans ligne.

## Piège rencontré

Sous Git Bash, un chemin `'\\.\pipe\…'` passé en argument perd une barre oblique inverse (`\.\pipe\…`) et donne
un faux `ENOENT`. Passer le nom par l'environnement ou le construire en Node.

## Décision

- Mort = `ENOENT` (pipe Windows absent) ou `ECONNREFUSED` (socket Unix resté sur disque). Toute autre erreur ou
  un délai dépassé compte comme vivante : un pipe occupé (`EBUSY`) appartient à une session vivante, et retirer à
  tort une session vivante est pire que garder un fantôme quelques secondes.
- Sonder seulement les clés qui ont la forme d'un pipe ou d'un chemin absolu ; jamais plus d'une fois par
  session toutes les 30 s.
