# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que c'est

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session « orchestratrice » qui
coordonne d'autres sessions par `SendMessage`. Cartes de décision une à la fois, bandeau d'état des sessions,
approbations de permission depuis la page, colonne TODO → Plan → À tester lue depuis le tableau JSON du projet (`claim --board`), plus les plans pour la
progression.

Le design fait foi : `docs/superpowers/specs/2026-11-21-control-room-design.md` et, pour le tableau, `docs/superpowers/specs/2026-11-22-board-design.md` ; plan et décisions : `docs/superpowers/plans/2026-11-21-control-room.md` ; usage : `README.md`.

## Commandes

- Tests : `node --test` (découverte auto ; `node --test test/` ne marche pas en Node 24). Un fichier :
  `node --test test/cards.test.js`. Les tests utilisent toujours `CONTROL_ROOM_DIR` temporaire.
- Valider le plugin : `claude plugin validate ./plugin` et `claude plugin validate .` (marketplace).
- Orchestratrice de ce dépôt (chemins absolus : `claim` ne résout que `--board`) :
  `control-room claim --project E:\workspaces\claude\control-room --plans E:\workspaces\claude\control-room\docs\superpowers\plans --board E:\workspaces\claude\control-room\.control-room\board.json`
- Lancer : `control-room start` — **dans le terminal de l'utilisateur seulement**. Lancé depuis une session Claude,
  il n'affiche pas l'URL (pas de TTY) ; ne contourne pas ça.

## Architecture

- `plugin/lib/server.js` : serveur HTTP autonome (cartes, réponses, attente longue) ; les autres modules ajoutent
  des `routes` (`right.js`, `delivery.js`, `orchestrator-routes.js`, `sessions.js`) et un `state()` pour la page.
- `plugin/bin/control-room.js` : `start`, `claim`, `listen --claim <id>`, `label`, `hook <permission|stop|status>`.
- `plugin/mcp/server.js` : outils MCP de l'orchestratrice, clients HTTP du serveur (`lib/client.js`).
- `plugin/hooks/hooks.json` + `lib/hooks.js` : bandeau, approbations, accusés, relance de l'orchestratrice.
- `plugin/ui/index.html` : la page (un fichier, forké de decision-inbox).

## Contraintes qui ne se lisent pas dans le code

- Node built-ins uniquement, pas de `npm install`. Node v24, Windows 10 en premier.
- **Livraison à l'orchestratrice** : seul un processus *enfant* de sa session peut écrire dans sa boîte de
  réception (essai : `docs/superpowers/specs/2026-11-21-inbox-spike.md`). D'où `control-room listen`, lancé par
  elle. Le format de ligne n'est pas documenté (binaire 2.1.330) : l'accusé `[cr:<id>:<code>]` + les alertes détectent
  une casse après mise à jour.
- **Deux secrets** : celui des clients (fichier `client.secret`) crée des cartes et lit leurs réponses, jamais ne
  répond, n'approuve ni ne coche ; celui de la page vit en mémoire et en cookie `HttpOnly`, jamais sur disque. La
  clé d'URL `?k=` est distincte et à usage unique. `Origin` + `Host` vérifiés sur les écritures de la page.
- Le hook de permission n'intercepte que les sessions inscrites (`control-room label`), sinon une session hors
  équipe paraîtrait figée jusqu'à 900 s.
- **Confiance** : `claim` rend un identifiant (pour `listen`/`wait_answers`) et un code de 6 caractères qui signe
  chaque message `[cr:<id>:<code>]` ; `orchestrator.json` ne garde que des empreintes. Serveur sur `127.83.82.1`
  (`lib/host.js`) pour que le cookie de la page ne parte pas vers les autres serveurs locaux.
- Une approbation dont le hook ne tire plus depuis 90 s expire (plus d'« Autoriser » dans le vide).
- Rien de codé en dur pour un projet : chemins donnés par `claim`.
- **Tableau** (`plugin/lib/board.js`) : écrit seulement par le serveur, via les outils MCP du secret client ; le
  client ne coche jamais un test (OK = clic de la page). Les `plan.md` ne sont jamais réécrits par le serveur.
  **L'orchestratrice seule commite le tableau** (`board: …`, commit à part) ; les sessions ne l'ajoutent jamais.

## Git

Commits sur `main`, poussés sur GitHub (`origin` : `git@github.com:MedianAura/claude-control-room.git`, public à
terme) : rien de propre à une machine ni de secret dans le dépôt.
