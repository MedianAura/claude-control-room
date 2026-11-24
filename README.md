# control-room

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session orchestratrice et ses
sessions de travail. Une décision à la fois, une ligne par session, les approbations de permission depuis la page,
et la colonne À tester / Plans actifs / TODO lue depuis le tableau du projet. Rien ne défile.

Node pur, aucune dépendance. État dans `~/.claude/control-room/`.

## Installation (une fois)

1. Ajouter `E:\workspaces\claude\control-room` au `PATH` (pour `control-room.cmd`). Linux / WSL : lien symbolique
   du lanceur, `ln -s <dépôt>/control-room ~/.local/bin/` ; sans le dépôt (plugin installé depuis une
   marketplace), copier le lanceur seul dans `~/.local/bin/` : il lance la version installée.
2. Dans Claude Code : `/plugin marketplace add E:\workspaces\claude\control-room`, puis
   `/plugin install control-room@control-room`.
3. Sessions de travail en **mode auto** : la plupart des actions ne demandent rien ; le reste passe par la page.

## Chaque séance

1. Dans **ton** terminal : `control-room start`. La page s'ouvre. Ne laisse pas une session Claude le lancer :
   l'adresse ouverte contient une clé (à usage unique) qui permet d'approuver.
2. Lance l'orchestratrice et dis-lui : « Utilise le skill control-room. » Elle se déclare (`claim`, qui lui donne
   un code de confiance) et lance son écouteur (`listen --claim …`).
3. Lance les sessions de travail. L'orchestratrice leur demande de s'inscrire (`control-room label …`).

Commencer avec 2 ou 3 sessions.

## Raccourcis de la page

| Touche | Action |
|---|---|
| `1`–`9` | choisir l'option (approbation : 1 Autoriser, 2 Refuser) |
| `Entrée` | accepter la proposition, ou « Lu » |
| `N` | réponse libre / note |
| `Maj` + chiffre | choisir et ajouter une note |
| `Ctrl` + `Entrée` | envoyer la note ou le message |
| `Ctrl` + `V` dans la zone de message | joindre une capture |

## Le tableau

Un fichier JSON par projet (`--board`), écrit seulement par le serveur, à la demande de l'orchestratrice (outils
`add_test`, `add_todo`, `update_item`, `close_todo`, `add_note`, `remove_item`, `reopen_item`, `list_board`). Il
remplace les tests `(user)` et la section `## To do` du plan maître. À tester : plan › tâche, le plus important
d'abord ; TODO : groupes, même tri. Chaque entrée a un identifiant `#XXXX` qu'on peut citer dans un message
(« Clarifie #45BG ») : l'orchestratrice le reçoit développé. Seul l'utilisateur coche un test (OK / KO dans la
page). L'orchestratrice seule commite le fichier. Fichier absent : tableau vide ; JSON cassé : la page le signale.

## Projet SoloConquest

Chemins à donner à `claim` (à mettre dans le `CLAUDE.md` du projet) :

```
control-room claim --project F:\AzerothCoreCOA --plans F:\AzerothCoreCOA\.agents\plans --board <fichier du tableau>
```

## Sans MCP

Si une politique de l'organisation bloque le serveur MCP du plugin (`/mcp` ne liste pas control-room), les mêmes
outils passent par `control-room tool <nom> --json -` (arguments en JSON sur stdin) ; `control-room tool --list`
les décrit. La skill le dit à l'orchestratrice. Pour éviter une validation par appel : autoriser
`Bash(control-room tool:*)`.

## WSL

- La page écoute sur `127.0.0.1` (détection automatique de WSL ; `CONTROL_ROOM_HOST` reste prioritaire) : le relais
  localhost de WSL2 vers Windows ne transmet que cette adresse. Contrepartie : le cookie de la page part aussi vers
  les autres serveurs locaux en `127.0.0.1`.
- La page s'ouvre dans le navigateur Windows par `cmd.exe` ; `start --no-open` sinon, puis ouvrir l'adresse
  affichée (`127.0.0.1`, pas `localhost`).

## Jauge de contexte

Chaque pastille de « Connectés » affiche le % de contexte de la session (ambre ≥ 40, rouge ≥ 70), le même chiffre
que la statusline. Le module `plugin/hooks/register.ts` le lit par `$.session.usage()` en fin de tour (et une
minuterie de repli, 60 s), puis le pousse par `control-room hook context`, seulement quand il change de palier
(5 points). Les hooks classiques ne voient pas ce chiffre ; un module de mod, si. Rien à configurer.

## Limites connues

- La page vit sur `http://127.83.82.1:4242` (bouclage dédié : son cookie n'est pas envoyé aux autres serveurs
  locaux). Surcharge : `CONTROL_ROOM_HOST`. Un redémarrage du navigateur demande de relancer `control-room start`.

- La livraison à l'orchestratrice écrit dans sa boîte de réception de session avec un format **non documenté**
  (trouvé dans Claude Code 2.1.330). Une mise à jour peut le casser : la page l'affiche alors en rouge et les
  réponses sont rendues à l'orchestratrice à la fin de son tour.
- Une session non inscrite garde ses demandes de permission dans son terminal.
