# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que c'est

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session « orchestratrice » qui
coordonne d'autres sessions par `SendMessage`. Cartes de décision une à la fois, bandeau d'état des sessions,
approbations de permission depuis la page, colonne TODO → Plan → À tester lue depuis les plans du projet.

Le design fait foi : `docs/superpowers/specs/2026-11-21-control-room-design.md`. Lis-le avant tout changement.

## État

Design seulement, aucun code. Étape suivante : le plan d'implémentation (superpowers:writing-plans), puis un essai
jetable sur le risque principal : écrire dans la boîte de réception d'une session (`CLAUDE_CODE_MESSAGING_SOCKET`,
canal nommé sous Windows) depuis un autre processus.

Le code part d'un fork de `decision-inbox` (zip d'origine : `C:\Users\Aura\Downloads\decision-inbox.zip`,
serveur MCP stdio + page HTML + état en fichiers JSON).

## Contraintes qui ne se lisent pas dans le code

- Node built-ins uniquement, pas de `npm install`. Node v24, Windows 10 en premier.
- Un seul plugin pour toutes les sessions : l'orchestratrice utilise les outils MCP, les sessions de travail
  seulement les hooks. Installé par une marketplace locale de type `directory`.
- Le serveur HTTP est un processus autonome démarré par le lanceur, jamais hébergé par un serveur MCP. Lié à
  `127.0.0.1`.
- Deux secrets : celui des hooks crée une carte et lit sa réponse, sans pouvoir approuver ; celui de la page
  (le seul qui approuve) vit en mémoire du serveur et dans le navigateur, jamais sur disque. Vérification
  d'`Origin` sur les écritures.
- Rien de codé en dur pour un projet : le dossier des plans et le plan maître viennent du projet de
  l'orchestratrice. Projet de référence pour les tests réels : `F:\AzerothCoreCOA\.agents\plans\`
  (plan maître `solo-power-creep/plan.md`).
- Les tests `(user)` du plan maître s'identifient par leur texte, pas par leur numéro de ligne.

## Git

Dépôt local, jamais poussé. Commits sur `main`.
