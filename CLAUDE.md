# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que c'est

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session « orchestratrice » qui
coordonne d'autres sessions par `SendMessage`. Cartes de décision une à la fois, bandeau d'état des sessions,
approbations de permission depuis la page, colonne TODO → Plan → À tester lue depuis les plans du projet.

Le design fait foi : `docs/superpowers/specs/2026-11-21-control-room-design.md`. Le plan et ses décisions :
`docs/superpowers/plans/2026-11-21-control-room.md`. Usage : `README.md`.

## Commandes

- Tests : `node --test` (découverte auto ; `node --test test/` ne marche pas en Node 24). Un fichier :
  `node --test test/cards.test.js`. Les tests utilisent toujours `CONTROL_ROOM_DIR` temporaire.
- Valider le plugin : `claude plugin validate ./plugin` et `claude plugin validate .` (marketplace).
- Lancer : `control-room start` — **dans le terminal de l'utilisateur seulement**. Lancé depuis une session Claude,
  il n'affiche pas l'URL (pas de TTY) ; ne contourne pas ça.

## Architecture

- `plugin/lib/server.js` : serveur HTTP autonome (cartes, réponses, attente longue) ; les autres modules ajoutent
  des `routes` (`right.js`, `delivery.js`, `orchestrator-routes.js`, `sessions.js`) et un `state()` pour la page.
- `plugin/bin/control-room.js` : `start`, `claim`, `listen`, `label`, `hook <permission|stop|status>`.
- `plugin/mcp/server.js` : outils MCP de l'orchestratrice, clients HTTP du serveur (`lib/client.js`).
- `plugin/hooks/hooks.json` + `lib/hooks.js` : bandeau, approbations, accusés, relance de l'orchestratrice.
- `plugin/ui/index.html` : la page (un fichier, forké de decision-inbox).

## Contraintes qui ne se lisent pas dans le code

- Node built-ins uniquement, pas de `npm install`. Node v24, Windows 10 en premier.
- **Livraison à l'orchestratrice** : seul un processus *enfant* de sa session peut écrire dans sa boîte de
  réception (essai : `docs/superpowers/specs/2026-11-21-inbox-spike.md`). D'où `control-room listen`, lancé par
  elle. Le format de ligne n'est pas documenté (binaire 2.1.330) : l'accusé `[cr:<id>]` + les alertes détectent
  une casse après mise à jour.
- **Deux secrets** : celui des clients (fichier `client.secret`) crée des cartes et lit leurs réponses, jamais ne
  répond, n'approuve ni ne coche ; celui de la page vit en mémoire et en cookie `HttpOnly`, jamais sur disque. La
  clé d'URL `?k=` est distincte et à usage unique. `Origin` + `Host` vérifiés sur les écritures de la page.
- Le hook de permission n'intercepte que les sessions inscrites (`control-room label`), sinon une session hors
  équipe paraîtrait figée jusqu'à 900 s.
- Rien de codé en dur pour un projet : chemins donnés par `claim`. Les tests `(user)` du plan maître s'identifient
  par leur texte, pas leur numéro de ligne.

## Git

Dépôt local, jamais poussé. Commits sur `main`.
