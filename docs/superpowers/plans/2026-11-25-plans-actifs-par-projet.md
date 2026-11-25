# Plans actifs par projet déclaré — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un projet ne voit plus les plans actifs d'un autre (TODO #8A2P) : la liste est rangée par projet déclaré,
l'ancienne liste globale est reprise au claim par chemin, `set_plan` sans claim est refusé.

**Architecture:** un module `lib/active-plans.js` possède le fichier `active-plans.json` (désormais
`{ "<clé du projet>": [plans] }`) et l'ancienne liste mise à part dans `active-plans-legacy.json`. `delivery.js`
(claim, `set_plan`) et `right.js` (colonne, tableau) passent par lui, avec le projet de `orchestrator.json`.

**Tech Stack:** Node 24, modules intégrés seulement, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-24-plans-actifs-fantomes.md`

## Global Constraints

- Node built-ins uniquement. Windows 10 en premier.
- Tests : `node --test` ; toujours un `CONTROL_ROOM_DIR` temporaire (`tempStateDir`).
- Le serveur et la page tournent depuis le dépôt : le changement prend effet au prochain `control-room start`. Le
  MCP et les hooks tournent depuis le cache du plugin ; ils ne changent pas ici (`set_plan` garde son schéma, le
  409 passe par le message d'erreur du serveur déjà relayé).
- Textes affichés en français, dans le ton des messages existants.
- Commits sur `main`, un par tâche, `git add <chemin>` seulement, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Clé du projet : `F:/p`, `F:\p\` et `f:\P` donnent la même clé sous Windows → test Task 1.
2. Adoption : seulement sous `--plans`, et pas un dossier voisin au préfixe commun (`F:/p/plans-old` n'est pas sous
   `F:/p/plans`) → test Task 1.
3. Ancien fichier (tableau) lu avant tout claim : la colonne est vide, rien n'est réécrit → test Task 2.
4. Un projet qui se déclare garde ses plans au re-claim ; un autre projet ne les voit pas → test Task 2.

---

### Task 1: `lib/active-plans.js`

**Files:**
- Create: `plugin/lib/active-plans.js`
- Test: `test/active-plans.test.js`

**Interfaces:**
- `projectKey(p): string|null` : `path.resolve(p)`, en minuscules sous Windows ; `null` si `p` n'est pas une chaîne
  non vide.
- `isUnder(child, parent): boolean` : `child` est `parent` ou sous lui, après `projectKey` des deux.
- `plansOf(project): Plan[]` : la liste du projet, entrées sans `name` écartées ; `[]` si pas de projet, pas de
  fichier, ou fichier à l'ancien format (tableau).
- `setPlanFor(project, { name, dir, file, label, state })` : retire `name` de la liste du projet, l'y remet sauf
  `state === 'archived'`.
- `adopt(project, plansDir): string[]` : si `active-plans.json` est un tableau, il passe tel quel dans
  `active-plans-legacy.json` (ajouté à celui qui existe) et devient `{}`. Les plans de la liste mise à part dont
  `dir` ou `file` est sous `plansDir` passent dans la liste du projet (sans écraser un plan du même nom déjà déclaré)
  et sortent de la liste mise à part ; celle-ci est supprimée une fois vide. Rend les noms repris.

- [x] **Step 1: tests qui échouent** dans `test/active-plans.test.js` :
  - `projectKey('F:/p')`, `projectKey('F:\\p\\')`, `projectKey('f:\\P')` égaux sous Windows ; `projectKey('')` et
    `projectKey(undefined)` → `null`.
  - `isUnder('F:/p/plans/x', 'F:/p/plans')` vrai, `isUnder('F:/p/plans', 'F:/p/plans')` vrai,
    `isUnder('F:/p/plans-old/x', 'F:/p/plans')` faux, `isUnder('G:/x', 'F:/p')` faux.
  - `setPlanFor('F:/a', …)` puis `plansOf('F:/a')` rend le plan, `plansOf('F:/b')` rend `[]` ; archivé → retiré.
  - fichier tableau : `plansOf('F:/a')` → `[]`, le fichier n'est pas réécrit.
  - `adopt('F:/a', 'F:/a/plans')` avec un tableau `[x sous F:/a/plans, y sous F:/b/plans, z file F:/a/plans/z.md]` :
    rend `['x', 'z']`, `plansOf('F:/a')` les contient, la liste mise à part ne garde que `y` ; puis
    `adopt('F:/b', 'F:/b/plans')` rend `['y']` et `active-plans-legacy.json` n'existe plus.
  - `adopt` sans liste mise à part ni tableau : rend `[]`, ne crée aucun fichier.
  - `adopt` ne remplace pas un plan du même nom déjà déclaré pour le projet.
- [x] **Step 2:** `node --test test/active-plans.test.js` → échec (module absent).
- [x] **Step 3:** écrire `plugin/lib/active-plans.js` (lecture/écriture par `store.readJson`/`writeJson`).
- [x] **Step 4:** `node --test` → tout passe.
- [x] **Step 5:** commit `feat(plans): liste des plans actifs par projet, reprise de l'ancienne liste`.

### Task 2: brancher le claim, `set_plan` et la colonne

**Files:**
- Modify: `plugin/lib/delivery.js` (`claim` appelle `adopt` ; `setPlan` écrit sous le projet déclaré ; route
  `/api/plans` → 409 sans claim)
- Modify: `plugin/lib/right.js` (`activePlans()` → `plansOf(orchestrator().project)`)
- Test: `test/claim.test.js`, `test/right.test.js`

**Interfaces:**
- `POST /api/plans` sans `orchestrator.json` : 409 `{ error: 'aucune orchestratrice déclarée, lance control-room claim' }`,
  rien n'est écrit. Les 400 existants (`name` requis, `dir` ou `file` requis) passent avant.
- Événement du claim quand des plans sont repris : `plans repris : <noms>`.

- [x] **Step 1: tests qui échouent** :
  - `claim.test.js` : les tests `/api/plans` existants font `claimAs` d'abord et lisent la liste du projet
    (`readJson(active-plans.json)[projectKey('F:/p')]`).
  - nouveau : `set_plan` sans claim → 409, `active-plans.json` absent.
  - nouveau : claim A (`F:/a`), `set_plan` x ; claim B (`F:/b`) : `rightState().plans` vide ; re-claim A : x revient.
  - nouveau : `active-plans.json` à l'ancien format avec un plan sous `F:/p/plans` et un sous `F:/q/plans` ; avant
    claim, rien n'est réécrit ; `claimAs` (projet `F:/p`) → le premier est dans la liste de `F:/p`, le second reste
    dans `active-plans-legacy.json`.
  - `right.test.js` : le montage écrit `orchestrator.json` avec `project` et `active-plans.json` au nouveau format ;
    un fichier tableau donne une colonne vide.
- [x] **Step 2:** `node --test` → les nouveaux tests échouent.
- [x] **Step 3:** brancher `delivery.js` et `right.js`.
- [x] **Step 4:** `node --test` → tout passe.
- [x] **Step 5:** commit `fix(plans): les plans actifs suivent le projet déclaré`.

### Task 3: vérification par l'utilisateur

- [ ] **Step 1 (user):** relancer `control-room start` dans ton terminal (le serveur tourne depuis le dépôt).
- [ ] **Step 2 (user):** sur la page de control-room, « Plans en cours » ne montre plus stat-gains ni
  crucible-quick-upgrade.
- [x] **Step 3:** l'orchestratrice refait son claim : l'ancienne liste passe dans `active-plans-legacy.json`, qui
  garde les deux plans d'AzerothCoreCOA (ils ne sont pas sous les plans de control-room).
- [ ] **Step 4 (user):** au prochain claim de l'orchestratrice d'AzerothCoreCOA, ses deux plans réapparaissent
  dans sa page.
