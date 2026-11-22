# control-room : salle de contrôle visuelle pour une orchestratrice Claude

Date : 2026-11-21. Statut : design relu par un constructeur, en attente d'approbation.

## Intention

L'utilisateur fait travailler plusieurs sessions Claude Code en parallèle (une par sujet), coordonnées par une
session « orchestratrice » qui reçoit les comptes rendus par `SendMessage`, lui relaie une décision à la fois avec
une recommandation, puis renvoie sa réponse à la session concernée. La méthode marche ; le support ne marche pas :
dans le terminal, tout défile trop vite. Pendant qu'il teste quelque chose en jeu, le fil a avancé et il ne sait
plus où il en est, et il doit passer d'une fenêtre à l'autre pour suivre les sessions.

control-room déplace toute cette relation dans **un seul onglet de navigateur**. Le but : ne presque plus revenir
au terminal. Il lance l'outil, lance ses sessions, écrit ce qu'il veut à l'orchestratrice depuis la page, et les
décisions, les tests et l'état des sessions viennent à lui.

Point de départ : le plugin `decision-inbox` (Node pur, serveur MCP stdio + page HTML sur localhost, état en
fichiers JSON), qu'on forke et étend. Sa copie est dans
`C:\Users\Aura\AppData\Local\Temp\claude\f11207cbfbe9a362\d612478b-1e67-47b3-9d79-88a54e83c0f9\scratchpad\decision-inbox-src`
et le zip d'origine dans `C:\Users\Aura\Downloads\decision-inbox.zip`.

## Objectifs

1. **Rien ne bouge sous les yeux.** Aucune zone qui défile toute seule. Ce qui arrive pendant qu'on lit attend.
2. **Une décision à la fois**, sous forme de carte : Qui, Quoi, Résumé, Options, Proposition, réponse libre.
3. **Voir vivre les sessions** sans changer de fenêtre : une ligne par session, mise à jour sur place.
4. **Parler à l'orchestratrice depuis la page**, captures d'écran comprises (Ctrl+V).
5. **Approuver les permissions depuis la page**, au lieu d'aller cliquer dans le terminal de la session.
6. **Voir le cycle des fonctionnalités** : TODO → Plan actif → À tester, lu depuis les fichiers du projet.

## Non-objectifs

- Remplacer le terminal des sessions de travail : elles restent des sessions Claude Code interactives.
- Une orchestratrice sans terminal (Agent SDK) : écarté, voir Approches.
- Plusieurs machines, mobile, accès distant. Tout est en local, `127.0.0.1`.
- Publier sur GitHub. Dépôt git local seulement.

## Anti-objectifs (échec même si ça marche)

- Un fil qui défile, ou une carte qui change pendant qu'on la lit.
- Une deuxième source de vérité pour les tests ou les TODO : le plan maître versionné reste la seule.
- Une approbation de permission qui pourrait venir d'autre chose qu'un clic de l'utilisateur dans la page
  (autre processus local, autre onglet, autre session Claude). Ce serait du blanchiment de permission.
- Une orchestratrice qui brûle des tours de modèle à attendre (boucle `wait_answers` toutes les 4 minutes).

## Contraintes

- Windows 10, Claude Code 2.1.330, Node v24. Node built-ins uniquement, pas de `npm install` (comme decision-inbox).
- Livré comme **un seul plugin**, installé par une marketplace locale de type `directory` (comme
  `token-saving-mods` dans `~/.claude/plugins/known_marketplaces.json`), chargé par toutes les sessions.
  L'orchestratrice utilise les outils MCP ; les sessions de travail n'utilisent que les hooks.
- Indépendant du projet : rien de codé en dur sur SoloConquest. Les chemins (dossier des plans, plan maître)
  viennent d'une configuration par projet.
- Faits vérifiés dans la doc (https://code.claude.com/docs/en/hooks.md, `cross-session-messaging.md`,
  `plugins-reference.md`) :
  - `PermissionRequest` : entrée `tool_name`, `tool_input`, `session_id`, `cwd` ; sortie
    `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` ou
    `{"behavior":"deny","message":"…"}`. Timeout par défaut 600 s, réglable par hook. Un hook qui expire ou ne
    répond rien laisse la demande normale s'afficher dans le terminal.
  - En mode auto, `PermissionRequest` ne se déclenche que pour une vraie demande (règles `ask`, outils
    interactifs, seuils de blocage atteints). Un refus du classificateur déclenche `PermissionDenied`
    (notification seulement, ne peut pas renverser le refus).
  - Chaque session expose sa boîte de réception : `CLAUDE_CODE_MESSAGING_SOCKET` (canal nommé sous Windows) et
    `CLAUDE_CODE_MESSAGING_TOKEN`, exportés aux hooks et à Bash. Sous Windows, la première ligne doit être
    `{"type":"auth","token":"<token>"}`. Une session inactive démarre un tour à la réception. Un message entre
    sessions ne peut jamais approuver une permission.
  - `Notification` (matchers `permission_prompt`, `idle_prompt`, `agent_needs_input`, `agent_completed`), `Stop`,
    `UserPromptSubmit` (se déclenche aussi à la réception d'un `SendMessage`).

## Approches

1. **Forker decision-inbox et l'étendre** — retenue. La base (cartes, file, raccourcis clavier, stockage en
   fichiers atomiques, partage du port entre sessions) est testée de bout en bout. On débranche son modèle de
   to-dos en JSON et on ajoute le reste. Environ la moitié de `server.js` change.
2. **Repartir de zéro, même technologie.** Code taillé pour le cycle, mais refait ce que decision-inbox fait
   déjà, pour un gain faible.
3. **Orchestratrice sans terminal via l'Agent SDK, la page comme seule fenêtre.** Seule option sans aucun
   terminal, mais l'orchestratrice perd ce qu'elle a en Claude Code (skills, mémoire, mode auto, commandes) et la
   facturation passe par l'API. La boîte de réception donne presque le même résultat.

Écarté aussi : un panneau dans Claude Code (comme plan-glance). Il resterait dans le terminal, ce qu'on veut quitter.

L'utilisateur a choisi l'approche 1.

## Ce qui est décidé

### La page, colonne de gauche

```
┌ Sessions (mises à jour sur place) ──────────────────────────┐
│ ● 🔨 Builds · b2      build n°3 en cours… 14 min      17:37 │
│ ● 🏃 Donjon · bd      écrit le test 4                 17:52 │
│ ● ⚔️ Quick Up. · c9   attend ta décision              17:49 │
├ Pendant ton absence (12 min) ─────────────────────────── ✕ ┤
│ build n°3 réussi · test 6 ajouté à Vérifier · 1 nouvelle carte│
├ À trancher 1/2 · ensuite : ✈️ Voler partout ─────────────────┤
│ ⚔️ QUICK UPGRADE · c9                                        │
│ Le palier « All to 80 » doit-il retirer seul les réactifs ?  │
│ • résumé en 2 à 5 puces                                      │
│ [1 · Retrait auto] [2 · Bouton Retirer ★] [3 · Laisser]      │
│ Proposition : 2, garde le contrôle sur le coffre.            │
│ [Réponse libre… (N)]                                         │
├──────────────────────────────────────────────────────────────┤
│ [💬 Écrire à l'orchestratrice… (Ctrl+V pour une capture)] [🕘]│
└──────────────────────────────────────────────────────────────┘
```

- **Bandeau des sessions** : une ligne par session, jamais de nouvelle ligne pour un événement. Pastille d'état :
  travaille, attend une décision, attend une approbation, bloquée, inactive. Texte = activité courante en une
  ligne, heure du dernier changement. Alimenté par les hooks des sessions (voir plus bas), pas par l'orchestratrice.
- **Résumé au retour** : quand l'onglet reprend le focus après plus de 2 minutes, une ligne liste ce qui s'est
  passé pendant l'absence. Elle reste jusqu'à ce qu'on la ferme. Pas de liseré ni de marqueur « nouveau » ailleurs.
- **Carte** : celle de decision-inbox (champs `agent`, `summary`, `recap`, `options`, `proposition`,
  `recommended`, `urgent`, réponse libre, raccourcis 1–9 / Entrée / N). La carte affichée ne change jamais tant
  qu'on n'y a pas répondu ; les suivantes attendent dans « ensuite : … ».
- **Réponses de l'orchestratrice au texte libre** : elles arrivent aussi en cartes (sans options, ou avec), pour
  que rien ne défile.
- **Approbations** : une carte de type approbation (« b2 veut lancer `docker compose build …` » : Autoriser /
  Refuser + note), dans la même file, prioritaire.
- **Zone de saisie** vers l'orchestratrice. Ctrl+V d'une image l'enregistre en PNG dans le dossier d'état ; le
  message envoyé contient son chemin absolu, que l'orchestratrice lit avec son outil de lecture.
- **Historique** (🕘) : fermé par défaut, ouvert à la demande ; c'est le seul endroit où le passé s'accumule.

### La page, colonne de droite : le cycle TODO → Plan → À tester

Trois sections repliables, lues depuis les fichiers du projet, relues en direct.

- **À tester par toi** : toutes les cases `- [ ] (user)` non cochées du plan maître, groupées par la fonctionnalité
  ou la section qui les contient. OK coche la case dans le fichier ; KO demande une note et l'envoie à
  l'orchestratrice, qui la relaie à la session concernée.
- **Plans actifs** : les plans superpowers déclarés actifs par l'orchestratrice (elle sait ce qu'elle a confié),
  avec la progression calculée sur leurs cases cochées. Quand tous les tests d'une fonctionnalité sont OK,
  l'orchestratrice propose une carte « Archiver <plan> ? » ; accepter déplace le dossier du plan dans un dossier
  d'archive et le retire de la section.
- **TODO** : les entrées de premier niveau `- [ ] **Nom**` de la section `## To do` du plan maître : les
  fonctionnalités que l'utilisateur veut faire ensuite.

Formats réels dans SoloConquest : plan maître `F:\AzerothCoreCOA\.agents\plans\solo-power-creep\plan.md` (titres
`##`, pas de `### Task`) ; plans par fonctionnalité `F:\AzerothCoreCOA\.agents\plans\<nom>\plan.md` avec titres
`### Task N:` et cases.

**Rattachement des tests** (décision du designer, vérifiée sur le fichier) : chaque ligne `- [ ] (user)` apparaît
**une seule fois** et appartient à son parent le plus proche : l'entrée de fonctionnalité `- [ ] **Nom**` sous
laquelle elle est imbriquée dans `## To do`, sinon la section `##` qui la contient (`## In-game checks`,
`## Crucible features…`). Pas de doublon à gérer.

- **Identifiant d'un test** : son texte normalisé (espaces compactés), pas son numéro de ligne, qui bouge quand
  les sessions éditent le fichier. Cocher = relire le fichier, trouver la ligne par son texte, `[ ]` → `[x]`,
  écriture atomique. Si le texte est introuvable ou trouvé plusieurs fois : aucune écriture, carte d'erreur.
- **Lien fonctionnalité ↔ plan** : l'entrée de fonctionnalité cite son dossier de plan (`.agents/plans/<nom>/`),
  comme c'est déjà l'usage (« Planned in `.agents/plans/dungeon-speed/` »). La carte « Archiver ? » apparaît
  quand toutes les lignes `(user)` sous cette entrée sont cochées.

### Livraison vers l'orchestratrice : la boîte de réception, pas la boucle

Une réponse à une carte, un texte libre, un KO ou une approbation qui la concerne est **déposé dans la boîte de
réception de l'orchestratrice** (canal nommé + jeton), comme un `SendMessage`. Elle dort tant que personne ne lui
parle et se réveille avec le message. `wait_answers` reste disponible mais ne sert plus de boucle.

**Risque principal, à lever en premier par un essai jetable** : écrire dans le canal nommé depuis un autre
processus sous Windows (le chemin et le jeton arrivent par `control-room claim`, voir Identité). Si l'essai
échoue, repli : `wait_answers` en boucle comme decision-inbox, avec un délai long.

### Les approbations depuis la page (mode auto + hook)

- Les sessions de travail tournent en mode auto : la plupart des actions ne demandent rien.
- Un hook `PermissionRequest` (plugin) transforme chaque vraie demande en carte d'approbation et attend le clic,
  timeout environ 900 s. Sans réponse à temps, il ne décide rien et la demande normale s'affiche dans le terminal.
- Les refus du classificateur (`PermissionDenied`) apparaissent dans le bandeau ou l'historique, sans boutons.
- La réponse d'approbation ne transite **que** par un clic dans la page, authentifié (voir Sécurité). Une session
  Claude, y compris l'orchestratrice, ne peut pas répondre à une carte d'approbation.

### Sécurité

- HTTP lié à `127.0.0.1` uniquement.
- **Deux secrets** (choix de l'utilisateur) :
  - **Secret des clients** (hooks, serveurs MCP, `control-room claim`) : créer une carte, mettre à jour un état,
    lire la réponse à sa propre carte. Il ne peut **pas** répondre à une carte, approuver, ni cocher un test. Il
    peut vivre dans un fichier lisible par les sessions.
  - **Secret de la page** : le seul qui répond, approuve et coche. Généré par le lanceur, gardé en mémoire du
    serveur et dans le navigateur (URL au premier chargement, puis cookie `HttpOnly`), **jamais écrit sur disque**.
  - Vérification d'`Origin` (et de `Host`, contre le DNS rebinding) sur toutes les écritures de la page.
- Risque résiduel accepté : une session sous le même compte Windows qui irait délibérément lire les cookies du
  navigateur ou la mémoire du serveur. Une protection parfaite est impossible sur une seule machine.

### Processus et lancement (décision du designer)

- **Un lanceur** (`control-room`) que l'utilisateur démarre en premier : il lance le serveur HTTP comme processus
  autonome (pas à l'intérieur d'un serveur MCP), génère le secret de la page en mémoire et ouvre le navigateur
  sur l'URL qui le contient.
- **Une seule instance globale.** Les serveurs MCP (orchestratrice) et les hooks (toutes les sessions) en sont des
  clients HTTP. Serveur absent : les hooks ne décident rien (la demande normale s'affiche dans le terminal), les
  outils MCP répondent « lance control-room ».
- Le dossier des plans et le plan maître viennent du projet de l'orchestratrice (configuration lue à sa
  déclaration, voir plus bas). Les sessions de travail n'ont pas besoin d'être rattachées à un projet : elles ne
  font que remonter leur état.

### Identité et rôles (décision du designer)

- **Déclaration de l'orchestratrice** : au démarrage, son skill lui fait exécuter une commande Bash
  (`control-room claim`). Bash reçoit `CLAUDE_CODE_MESSAGING_SOCKET` et `CLAUDE_CODE_MESSAGING_TOKEN` : la
  commande enregistre auprès du serveur sa boîte de réception, son rôle et son projet. C'est aussi la réponse au
  problème « comment le serveur obtient le canal de l'orchestratrice ».
- L'identité est **stable** (le rôle, pas le `pid`) : une orchestratrice relancée ou un passage de relais
  retrouve les cartes en attente. decision-inbox utilisait `hostname-pid-hasard`, qui rend les cartes orphelines.
- Une seule orchestratrice : une nouvelle déclaration **prend le relais**, et l'ancienne en est avertie par sa
  boîte de réception.
- **Nom des sessions dans le bandeau** : avant tout, le dossier `cwd` + l'identifiant court de session. Quand
  l'orchestratrice confie un travail, elle donne à la session un libellé et un emoji (« 🔨 Builds · b2 »).
  À vérifier pendant la construction : comment relier le nom vu par `ListAgents` (`soloconquest-b2`) au
  `session_id` reçu par les hooks.

### Méthode de travail (nouvelles règles, livrées dans le skill du plugin)

- L'orchestratrice met chaque décision en carte et n'écrit dans son terminal qu'une ligne d'état.
- Elle déclare actif un plan quand elle le confie, propose l'archivage quand ses tests sont OK.
- Chaque session de travail coche les cases de son plan à chaque tâche finie (sinon la barre ne bouge pas).
- Les tests en jeu s'écrivent dans le plan maître avec `(user)`, comme aujourd'hui.
- Mise en route ponctuelle dans SoloConquest : archiver coa-stats-weight, crucible-absorb-all,
  crucible-stat-pins (100 %) ; faire cocher fly-anywhere et gathering-yield (en jeu mais à 0 %).

## Laissé au constructeur

- Le découpage de `server.js` et de `ui.html`, la forme des fichiers d'état, le nom du dossier d'archive.
- Les hooks exacts qui alimentent le bandeau (`SessionStart`, `PreToolUse` avec la `description` des commandes,
  `Stop`, `Notification`…) et la façon de les envoyer au serveur.
- Le format de la configuration par projet.
- Le style visuel, à partir des maquettes du brainstorm (`F:\AzerothCoreCOA\.superpowers\brainstorm\269611-1795301586\content\layout-v2.html`).
