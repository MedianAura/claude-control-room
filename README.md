# control-room

Plugin Claude Code : une salle de contrôle dans un onglet de navigateur pour une session orchestratrice et ses
sessions de travail. Une décision à la fois, une ligne par session, les approbations de permission depuis la page,
et la colonne À tester / Plans actifs / TODO lue depuis le plan maître du projet. Rien ne défile.

Node pur, aucune dépendance. État dans `~/.claude/control-room/`.

## Installation (une fois)

1. Ajouter `E:\workspaces\claude\control-room` au `PATH` (pour `control-room.cmd`).
2. Dans Claude Code : `/plugin marketplace add E:\workspaces\claude\control-room`, puis
   `/plugin install control-room@control-room`.
3. Sessions de travail en **mode auto** : la plupart des actions ne demandent rien ; le reste passe par la page.

## Chaque séance

1. Dans **ton** terminal : `control-room start`. La page s'ouvre. Ne laisse pas une session Claude le lancer :
   l'adresse ouverte contient une clé (à usage unique) qui permet d'approuver.
2. Lance l'orchestratrice et dis-lui : « Utilise le skill control-room. » Elle se déclare (`claim`) et lance son
   écouteur (`listen`).
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

## Projet SoloConquest

Chemins à donner à `claim` (à mettre dans le `CLAUDE.md` du projet) :

```
control-room claim --project F:\AzerothCoreCOA --plans F:\AzerothCoreCOA\.agents\plans --master F:\AzerothCoreCOA\.agents\plans\solo-power-creep\plan.md
```

## Limites connues

- La livraison à l'orchestratrice écrit dans sa boîte de réception de session avec un format **non documenté**
  (trouvé dans Claude Code 2.1.330). Une mise à jour peut le casser : la page l'affiche alors en rouge et les
  réponses sont rendues à l'orchestratrice à la fin de son tour.
- Une session non inscrite garde ses demandes de permission dans son terminal.
