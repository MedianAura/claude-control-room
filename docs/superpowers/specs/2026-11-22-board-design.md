# Le tableau : tests et TODO au format control-room — design

Date : 2026-11-22. Couvre les entrées « À tester repensé » et « TODO priorisé » de `docs/TODO.md`. Remplace, dans
`2026-11-21-control-room-design.md`, la lecture du plan maître (« La page, colonne de droite » : À tester et TODO,
rattachement et identifiant des tests) et l'anti-objectif « le plan maître versionné reste la seule source ».

## Pourquoi

control-room sert quand il y a beaucoup à faire et plusieurs sessions ; pour un petit projet, superpowers et le
volet plan-glance suffisent. À cette échelle, les tests `(user)` lus dans le markdown deviennent illisibles : un
bloc qui change tout le temps, des copies entre plan du sujet et plan maître qui divergent (OK coche la copie,
l'original reste ouvert), des tests rangés sous une section au lieu de leur tâche, aucun ordre d'importance.

L'utilisateur veut :
- À tester rangé par plan › tâche, le plus important d'abord ;
- le TODO priorisé ;
- citer un test ou une entrée par un identifiant court (« Clarifie #45BG ») au lieu de copier son texte ;
- que le projet s'adapte à control-room, et non que control-room devine les conventions de chaque projet.

## Le modèle

```
session de travail ──(superpowers : design + plan.md)──► orchestratrice
orchestratrice ──(transpose : tests, TODO)──► tableau JSON ──► page
page ──(OK / KO / décision / #45BG)──► orchestratrice ──► session : met à jour son plan.md
                                                       └─► session morte : l'orchestratrice met le plan.md à jour
```

- **Les sessions de travail** gardent superpowers pour leur design et leur `plan.md`. Elles ignorent le tableau.
- **L'orchestratrice transpose** : quand une session lui rend un plan, elle inscrit au tableau ce qui concerne
  l'utilisateur — les vérifications qu'il doit faire (tests) et le travail à venir (TODO) — par ses outils MCP.
- **Le tableau est la source pour l'utilisateur.** Le `plan.md` reste le document de travail de la session ; il est
  mis à jour par relais (la session, ou l'orchestratrice si la session est morte), jamais par le serveur.
- **Plans actifs** ne change pas : `set_plan` + progression lue en direct dans les `plan.md`.

## Objectifs

1. Un fichier JSON par projet, écrit seulement par le serveur control-room.
2. À tester : groupes plan › tâche ; dans chaque tâche, tri par poids puis par texte.
3. TODO : groupes facultatifs ; tri par poids puis par texte.
4. Poids High / Medium / Low, Medium par défaut, sur les tests et les entrées TODO.
5. Identifiants courts générés par le serveur, affichés sur la page, développés dans ce qui part vers
   l'orchestratrice.
6. control-room s'en sert pour lui-même : `docs/TODO.md` et les tests `(user)` ouverts de ce dépôt migrent dans son
   tableau.

## Non-objectifs

- Transposer les tâches et étapes des plans : elles restent dans les `plan.md` des sessions.
- Lire ou écrire un format markdown de tests ou de TODO. Le parseur du plan maître (`parseMaster`, `tickTest`)
  disparaît ; `planOutline` reste pour Plans actifs.
- Un script de migration : la migration se fait une fois, par l'orchestratrice, avec ses outils.
- Éditer le tableau à la main : possible (c'est du JSON lisible) mais pas un chemin prévu.

## Anti-objectifs

- Le serveur écrit dans un fichier du projet autre que le tableau (aucune réécriture des `plan.md`).
- Une session de travail doit connaître le format du tableau.
- L'orchestratrice coche un test : OK reste un clic de l'utilisateur dans la page.

## Contraintes

- Node built-ins seulement : JSON, pas de YAML (pas de parseur sans dépendance).
- Écriture atomique (fichier temporaire + `rename`), comme `store.writeJson`.
- Le secret client crée et modifie des éléments ; seul le secret de la page coche un test (règle des deux secrets).
- `plugin/ui/index.html` est en cours de refonte dans une autre session (passe de design) : le travail sur la page
  part du commit de cette passe.

## Approches

Le format a été choisi en deux temps.

**Où vivent les identifiants** (quand les tests restaient en markdown) :
- A. Calculés (empreinte du texte), rien dans le fichier — l'identifiant change si le texte change.
- B. Écrits dans le fichier — **retenue** : stables, et le projet suit les conventions de control-room. Elle a mené
  l'utilisateur à proposer un format propre à control-room plutôt qu'un balisage du markdown.

**Où vit le JSON** :
- **A. Un fichier par projet, dans le projet** — **retenue.** Chemin donné au `claim`. Versionné avec le projet ;
  un seul fichier, un seul écrivain, identifiants uniques par construction.
- B. Un fichier par plan dans son dossier + un fichier projet : les tests suivent le dossier à l'archivage, mais
  l'orchestratrice écrirait dans les dossiers des sessions, plusieurs fichiers à lire, unicité à vérifier entre
  fichiers.
- C. Dans l'état de control-room (`~/.claude/control-room/`) : rien à versionner, mais le tableau quitte le projet
  et changer de projet l'escamote.

## Ce qui est décidé

### Le fichier

`control-room claim --project <dossier> --plans <dossier des plans> --board <fichier>` ; `--master` disparaît.
Fichier absent : tableau vide, créé à la première écriture (dossier compris). Fichier illisible (JSON cassé) : la
page l'affiche dans la colonne, aucune écriture tant qu'il n'est pas réparé.

```json
{
  "version": 1,
  "items": [
    {
      "id": "45BG",
      "kind": "test",
      "text": "`60`: Scan → no-gain rows excluded, reagent line shows bags / vault / withdraw",
      "detail": "withdraw by hand → dimmed rows light up; Upgrade → covered rows done, others skipped",
      "weight": "high",
      "plan": "crucible-quick-upgrade",
      "task": "Task 4: Deploy and accept",
      "origin": { "file": "crucible-quick-upgrade/plan.md", "step": "Step 4" },
      "state": "open",
      "notes": [{ "at": "2026-11-22T21:40:00Z", "by": "orchestrator", "text": "scan seen OK, withdraw waits for dusts" }],
      "createdAt": "2026-11-22T20:00:00Z",
      "closedAt": null
    },
    {
      "id": "K2P9",
      "kind": "todo",
      "text": "Bag cleaner",
      "detail": "clean dungeon clutter out of the bags: pet whistles and companions already known…",
      "weight": "low",
      "group": "Bags",
      "plan": null,
      "state": "open",
      "notes": [],
      "createdAt": "2026-11-22T20:00:00Z",
      "closedAt": null
    }
  ]
}
```

- `id` : 4 caractères dans `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sans 0, O, 1, I, L), tiré au hasard par le serveur,
  unique dans le fichier (éléments fermés compris). Un seul espace pour tests et TODO.
- `weight` : `high` | `medium` | `low` ; absent = `medium`.
- Test : `plan` (nom tel que donné à `set_plan`, ou `null` = « Hors plan »), `task` (texte libre, `null` = sous le
  plan seul), `origin` facultatif (`file` relatif au dossier des plans, `step` libre) : ce que l'orchestratrice doit
  faire cocher, et à qui.
- TODO : `group` facultatif (texte libre, `null` = « Divers »), `plan` facultatif (le plan qui le réalise, une fois
  confié).
- `state` : test `open` | `ok` | `removed` ; TODO `open` | `done` | `dropped` | `removed`.
- `notes` : historique daté (`by` : `orchestrator` ou `user`), jamais réécrit.

### Outils de l'orchestratrice (MCP, secret client)

- `add_test {text, detail?, weight?, plan?, task?, origin?}` → `{id}`
- `add_todo {text, detail?, weight?, group?, plan?}` → `{id}`
- `update_item {id, text?, detail?, weight?, plan?, task?, group?, origin?}` : sans changer l'identifiant.
- `close_todo {id, state: "done" | "dropped", note?}`
- `add_note {id, text}`
- `remove_item {id, reason}` : `state: removed`, un événement le dit sur la page (comme `cancel_decision`).
- `list_board {kind?, state?}` : pour retrouver un identifiant ou vérifier la transposition.

Aucun outil ne passe un test à `ok`.

### Ce que fait la page (secret de la page)

- **À tester** : tests `open`, groupés par plan (libellé de `active-plans.json` s'il y est, sinon le nom ; `null`
  → « Hors plan » en dernier) puis par tâche (`null` en premier, sans titre). Dans une tâche : `high`, `medium`,
  `low`, puis texte. Chaque test montre `#id`, la marque de poids, le texte ; le détail et les notes se déplient.
- **TODO** : entrées `open`, groupées par `group` (« Divers » en dernier), même tri.
- **OK** : `POST /api/test {id, result: "ok"}` → `state: ok`, `closedAt`, événement, et livraison à l'orchestratrice :
  `[control-room] Test OK #45BG — <plan> › <tâche> : <texte> (origine : <file>, <step>)`, pour qu'elle fasse cocher
  le `plan.md`.
- **KO** : `{id, result: "fail", note}` → note ajoutée au test (`by: user`), test toujours ouvert, livraison :
  `[control-room] Test KO #45BG — <plan> › <tâche> : <texte> (origine : …)` + `Note : …`.
- **Identifiant inconnu ou test déjà fermé** : 409, carte d'erreur, rien d'écrit.
- **Archivage** : quand un OK ferme le dernier test `open` d'un plan qui en avait, livraison « Tous les tests de
  <plan> sont OK : propose l'archivage ». `set_plan state: "archived"` ne touche pas au tableau.
- Un clic sur `#id` l'insère dans la zone de message.

### Citer un identifiant

Dans un message libre, une note de KO ou la note d'une réponse à une carte, chaque `#XXXX` qui existe au tableau
est développé à la fin du texte livré :

```
[control-room] Message de l'utilisateur : Clarifie #45BG, je ne comprends pas « withdraw ».
#45BG (test, crucible-quick-upgrade › Task 4: Deploy and accept, high) : `60`: Scan → … — withdraw by hand → …
  origine : crucible-quick-upgrade/plan.md, Step 4
```

Un `#XXXX` inconnu reste tel quel. La correspondance ignore la casse à la saisie (`#45bg`).

### Le skill de l'orchestratrice

Nouvelle section « Le tableau », qui remplace « À tester » et l'archivage par fonctionnalité :
- au `claim`, `--board` (chemin dans le `CLAUDE.md` du projet, sinon le demander par une carte) ;
- à la remise d'un plan : un `add_test` par étape `(user)` du plan, avec `plan`, `task`, `origin`, poids si le plan
  ou la session l'indique ; les suites à faire en `add_todo` ;
- `Test OK` / `Test KO` : relayer à la session qui a le plan (cocher l'étape, ou la note à traiter) ; session morte
  (retirée du bandeau) : modifier le `plan.md` soi-même ;
- `#XXXX` développé : répondre par `reply` avec la clarification ; si le test est mal écrit, `update_item` ;
- ne jamais créer un test sans `plan` quand il en vient d'un ;
- archivage : sur « Tous les tests de <plan> sont OK », carte « Archiver <plan> ? » ;
- **commits du tableau** (choix de l'utilisateur) : l'orchestratrice seule commite le fichier du tableau, dans un
  commit à part (`board: <ce qui a changé>`), après chaque transposition et à l'archivage d'un plan, selon les règles
  de commit du projet. Elle demande à chaque session confiée de ne jamais l'ajouter (`git add` par chemin, pas
  `-A` sur ce fichier).

### Migration (une fois)

- **control-room** : ce dépôt prend `--board .control-room/board.json` (versionné). Les entrées ouvertes de
  `docs/TODO.md` et les étapes `(user)` ouvertes de `docs/superpowers/plans/2026-11-21-control-room.md` y sont
  transposées ; `docs/TODO.md` disparaît, la section « Plan maître » du `README.md` et du `CLAUDE.md` suivent.
- **SoloConquest** : l'orchestratrice transpose le plan maître `solo-power-creep/plan.md` (tests ouverts, TODO
  ouvert avec P1 → high, P2 → medium, P3 → low, notes datées en `notes`) puis retire ces sections du markdown. Fait
  dans le projet, selon ses règles de commit, pas dans ce dépôt.

### Ordre des groupes (décision du designer)

- Plans : poids le plus fort parmi leurs tests ouverts, puis ordre de `active-plans.json`, puis nom ; « Hors plan »
  en dernier.
- Tâches d'un plan : ordre de création de leur premier test (l'orchestratrice transpose un plan dans l'ordre, donc
  « Task 4 » vient avant « Task 10 »).
- Groupes TODO : poids le plus fort, puis nom ; « Divers » en dernier.

### Plans en un seul fichier (décision du designer)

`set_plan` accepte `file` (le markdown du plan) en plus de `dir` (`dir/plan.md`, comportement actuel) : les plans
superpowers de ce dépôt sont des fichiers datés (`docs/superpowers/plans/2026-11-21-control-room.md`), pas des
dossiers. L'archivage déplace le dossier si le plan a le sien, sinon le fichier. `origin.file` est relatif au dossier
des plans dans les deux cas.

### OK cliqué par erreur (décision du designer)

L'utilisateur l'écrit à l'orchestratrice (« #45BG cliqué OK par erreur ») ; outil `reopen_item {id, reason}`
(secret client) : test → `open`, TODO fermé → `open`, note ajoutée. Rouvrir n'atteste rien à la place de
l'utilisateur, la règle des deux secrets tient.

### Ordre de livraison (décision du designer)

Le serveur garde la forme actuelle de `/api/test` et de `right` tant que la page n'est pas reprise : le changement du
serveur et celui de la page arrivent dans le même commit, après le commit de la passe de design. Le serveur lancé
par l'utilisateur tourne depuis le dépôt ; un état où la page et le serveur ne s'accordent pas casserait sa salle
de contrôle en cours d'usage.

## Laissé au constructeur

- Découpage en modules (un `lib/board.js` pour le modèle et les écritures paraît naturel).
- Marques visuelles du poids et du dépliage, dans le respect de `DESIGN.md` et de la passe de design.
- Forme exacte des erreurs MCP (identifiant inconnu, champ invalide).
- Relecture du fichier : à chaque `state()` ou en cache invalidé par `mtime`.
