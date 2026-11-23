# control-room

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session orchestratrice et ses
sessions de travail. Une décision à la fois, une ligne par session, les approbations de permission depuis la page,
et la colonne À tester / Plans actifs / TODO lue depuis le tableau du projet. Rien ne défile.

Node pur, aucune dépendance. État dans `~/.claude/control-room/`.

## Installation (une fois)

1. Ajouter `E:\workspaces\claude\control-room` au `PATH` (pour `control-room.cmd`).
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

## Limites connues

- La page vit sur `http://127.83.82.1:4242` (bouclage dédié : son cookie n'est pas envoyé aux autres serveurs
  locaux). Surcharge : `CONTROL_ROOM_HOST`. Un redémarrage du navigateur demande de relancer `control-room start`.

- La livraison à l'orchestratrice écrit dans sa boîte de réception de session avec un format **non documenté**
  (trouvé dans Claude Code 2.1.330). Une mise à jour peut le casser : la page l'affiche alors en rouge et les
  réponses sont rendues à l'orchestratrice à la fin de son tour.
- Une session non inscrite garde ses demandes de permission dans son terminal.
