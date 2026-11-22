# control-room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Steps tagged `(user)` are checked by the user in their real setup.

**Goal:** Un plugin Claude Code qui donne à une orchestratrice et à ses sessions de travail une salle de contrôle dans un onglet de navigateur : cartes de décision une à la fois, bandeau des sessions, approbations depuis la page, colonne TODO → Plan → À tester.

**Architecture:** Un serveur HTTP autonome (lanceur `control-room start`) détient l'état en fichiers JSON et sert la page. Le serveur MCP de l'orchestratrice, les hooks de toutes les sessions et la commande `control-room claim` en sont des clients HTTP authentifiés par le secret des clients ; la page seule détient le secret qui répond et approuve. Les réponses destinées à l'orchestratrice lui sont livrées dans sa boîte de réception de session.

**Tech Stack:** Node v24, modules intégrés uniquement (`http`, `net`, `fs`, `crypto`, `node:test`). Windows 10 en premier. Plugin distribué par une marketplace locale `directory` (ce dépôt).

**Spec:** `docs/superpowers/specs/2026-11-21-control-room-design.md`

## Global Constraints

- Aucune dépendance npm, aucun `package.json` requis pour tourner. Tests : `node --test test/` (un fichier : `node --test test/cards.test.js`).
- HTTP lié à `127.0.0.1` uniquement. Port par défaut `4242`, surcharge `CONTROL_ROOM_PORT`.
- Dossier d'état : `~/.claude/control-room/`, surcharge `CONTROL_ROOM_DIR` (les tests l'utilisent toujours, dans un dossier temporaire).
- Écritures de fichiers d'état atomiques (fichier `.tmp` puis `rename`), comme decision-inbox.
- Secret des clients : 32 octets hex dans `<dir>/client.secret`, en-tête `x-cr-secret`. Il ne peut **jamais** répondre à une carte, approuver, ni cocher un test.
- Secret de la page : 32 octets hex générés par `start`, en mémoire du serveur, jamais écrit sur disque ; reçu une fois en `?k=`, puis cookie `cr_page` `HttpOnly; SameSite=Strict; Path=/`.
- Écritures de la page : `Origin` ∈ {`http://127.0.0.1:<port>`, `http://localhost:<port>`} et `Host` ∈ {`127.0.0.1:<port>`, `localhost:<port>`}, sinon 403.
- L'identité de l'orchestratrice est le rôle `orchestrator`, jamais un `pid`.
- Rien de propre à SoloConquest dans le code : le dossier des plans et le plan maître viennent de `claim`.
- Textes de l'interface en français.
- Hooks de statut en `async: true` (aucune latence ajoutée aux sessions) ; hook `PermissionRequest` synchrone, `timeout: 900`.

## Review Focus

- **Deux onglets ou un double clic répondent à la même carte** : la deuxième réponse reçoit 409, une seule livraison. Test dans la tâche 3.
- **Le plan maître change entre l'affichage et le clic OK** (une session l'édite) : le test est retrouvé par son texte ; introuvable ou en double → aucune écriture, carte d'erreur. Test dans la tâche 5.
- **Serveur arrêté quand un hook se déclenche** : le hook n'écrit rien et sort en 0, la demande normale s'affiche dans le terminal. Test dans la tâche 8.
- **Nouvelle orchestratrice (relais ou relance)** : les cartes en attente et les réponses non livrées passent à la nouvelle ; l'ancienne reçoit un avis. Test dans la tâche 6.
- **Capture collée trop lourde ou qui n'est pas une image** : au-delà de 10 Mo ou hors `image/png|jpeg|webp`, refus 413/415 et message dans la page, rien n'est livré. Test dans la tâche 7.

---

### Task 1: Essai jetable — écrire dans la boîte de réception d'une session sous Windows

Le format des messages n'est pas documenté (seule la ligne `{"type":"auth","token":"<token>"}` l'est, obligatoire sous Windows, puis des lignes complètes en moins de 30 s). Cet essai décide de la livraison de la tâche 6. Aucun code gardé, seulement la note.

**Files:**
- Create (jetable) : `spike/inbox-probe.js`
- Create : `docs/superpowers/specs/2026-11-21-inbox-spike.md`

**Interfaces:**
- Produces : la note donne (a) le format de ligne qui livre un message, (b) le texte tel que la session le reçoit, (c) si `CLAUDE_CODE_MESSAGING_SOCKET` est visible dans l'environnement d'un hook, (d) la voie de livraison retenue : `server` (le serveur écrit), `listener` (un processus lancé par l'orchestratrice écrit dans sa propre boîte) ou `poll` (`wait_answers`).

- [x] **Step 1: Écrire `spike/inbox-probe.js <variant> <delaySec>`** : attend `delaySec`, ouvre `net.createConnection(process.env.CLAUDE_CODE_MESSAGING_SOCKET)`, écrit la ligne d'auth avec `CLAUDE_CODE_MESSAGING_TOKEN`, puis une ligne selon `variant` : `plain` (texte brut), `json-text` (`{"type":"message","text":…}`), `json-message` (`{"message":…}`), `json-content` (`{"content":…}`) ; affiche tout ce que la connexion renvoie avant de fermer.
- [x] **Step 2: Depuis une session Claude Code, lancer chaque variante en arrière-plan** (`node spike/inbox-probe.js plain 15`, un à la fois, la session restant inactive pendant le délai). Résultat attendu : au moins une variante fait démarrer un tour avec le texte envoyé. Noter le texte reçu mot pour mot et toute réponse du canal.
- [x] **Step 3: Vérifier qu'un processus non enfant peut livrer** : copier chemin et jeton dans un fichier, puis lancer la variante gagnante depuis un autre terminal (pas un enfant de la session). Noter si le message arrive, est retenu pour approbation, ou est refusé.
- [x] **Step 4: Vérifier l'environnement des hooks** : un hook `SessionStart` temporaire (`.claude/settings.local.json` de ce dépôt) écrit `CLAUDE_CODE_MESSAGING_SOCKET` dans un fichier. Noter s'il est présent et identique à celui de Bash. Retirer le hook.
- [x] **Step 5: Écrire la note** `docs/superpowers/specs/2026-11-21-inbox-spike.md` (points a–d, plus la version de Claude Code). Choix de voie : `server` si l'étape 3 livre ; sinon `listener` si l'étape 2 livre ; sinon `poll`.
- [x] **Step 6: Supprimer `spike/` et commiter la note**

```bash
git add docs/superpowers/specs/2026-11-21-inbox-spike.md
git commit -m "docs: résultat de l'essai sur la boîte de réception"
```

---

### Task 2: Squelette du plugin, stockage et cartes (fork de decision-inbox)

**Files:**
- Create : `.claude-plugin/marketplace.json` (marketplace `control-room`, un plugin `control-room`, `source: "./plugin"`)
- Create : `plugin/.claude-plugin/plugin.json`
- Create : `plugin/lib/store.js`, `plugin/lib/cards.js`
- Test : `test/cards.test.js`

**Interfaces:**
- Produces (`store.js`) : `stateDir(): string` (crée les sous-dossiers `cards`, `sessions`, `uploads`), `readJson(file): object|null`, `writeJson(file, obj): void` (atomique), `appendHistory(entry): void` (`history.jsonl`).
- Produces (`cards.js`) :
  - `createCard(input: {kind: 'decision'|'approval'|'reply'|'error', agent, summary, recap?, options?, proposition?, recommended?, urgent?, session?, tool?: {name, input}}): Card` — `id`, `created`, `status: 'pending'`, `owner: 'orchestrator'` (approbations : `owner: 'hook:<session_id>'`).
  - `pendingCards(): Card[]` — tri : approbations d'abord, puis `urgent`, puis `created`.
  - `answerCard(id, {choice, note}): {ok: true, card} | {ok: false, reason: 'not-pending'|'not-found'}`.
  - `takeUndelivered(owner): Card[]` — réponses non livrées de ce propriétaire, marquées livrées.
  - `formatAnswer(card): string` — le texte livré à l'orchestratrice.

- [x] **Step 1: Écrire les tests**

```js
test('approval cards sort before urgent and normal cards', () => {
  const a = createCard({ kind: 'decision', agent: 'Quick Upgrade', summary: 'q', options: ['x'] });
  const u = createCard({ kind: 'decision', agent: 'Vol', summary: 'q', options: ['x'], urgent: true });
  const p = createCard({ kind: 'approval', agent: 'Builds', summary: 'docker compose build', session: 's1' });
  assert.deepEqual(pendingCards().map(c => c.id), [p.id, u.id, a.id]);
});
test('a second answer to the same card is refused', () => {
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'q', options: ['x', 'y'] });
  assert.equal(answerCard(c.id, { choice: '2' }).ok, true);
  assert.deepEqual(answerCard(c.id, { choice: '1' }), { ok: false, reason: 'not-pending' });
});
test('answers are delivered once, to the orchestrator role', () => {
  const c = createCard({ kind: 'decision', agent: 'A', summary: 'q', options: ['x'] });
  answerCard(c.id, { choice: 'proposition', note: 'vas-y' });
  assert.equal(takeUndelivered('orchestrator').length, 1);
  assert.equal(takeUndelivered('orchestrator').length, 0);
});
test('formatAnswer names the agent, the choice label and the note', () => {
  const c = createCard({ kind: 'decision', agent: 'Quick Upgrade', summary: 'Retrait auto ?', options: ['Auto', 'Bouton Retirer'] });
  answerCard(c.id, { choice: '2', note: 'avec confirmation' });
  const t = formatAnswer(takeUndelivered('orchestrator')[0]);
  assert.match(t, /Quick Upgrade/); assert.match(t, /Bouton Retirer/); assert.match(t, /avec confirmation/);
});
```

Chaque test fixe `process.env.CONTROL_ROOM_DIR` sur un dossier `fs.mkdtempSync`.

- [x] **Step 2: Lancer `node --test test/cards.test.js`** — attendu : FAIL, modules absents.
- [x] **Step 3: Implémenter `store.js` et `cards.js`** en reprenant `writeCard`/`allCards`/`takeAnswers` de decision-inbox (`C:\Users\Aura\Downloads\decision-inbox.zip`, `server/server.js` l. 24-77), propriétaire stable au lieu de `hostname-pid-hasard`. `formatAnswer` : `[control-room] <agent> — « <summary> » → <libellé du choix>` + `\nNote : <note>` si présente ; `choice: 'proposition'` → « proposition acceptée : <proposition> », `choice: 'note'` → « réponse libre ».
- [x] **Step 4: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 5: Commit** `feat: stockage et cartes, propriétaire stable`

---

### Task 3: Serveur HTTP, deux secrets et lanceur

**Files:**
- Create : `plugin/lib/auth.js`, `plugin/lib/server.js`, `plugin/bin/control-room.js`, `control-room.cmd` (racine : `@node "%~dp0plugin\bin\control-room.js" %*`)
- Test : `test/server.test.js`

**Interfaces:**
- Consumes : `cards.js`, `store.js` (tâche 2).
- Produces (`auth.js`) : `loadClientSecret(): string` (crée le fichier au besoin), `newPageSecret(): string`, `isClient(req, clientSecret): boolean`, `isPage(req, pageSecret, port): boolean` (cookie + `Origin` + `Host`).
- Produces (`server.js`) : `createServer({port, pageSecret, clientSecret, deliver}): http.Server` où `deliver(text: string): Promise<void>` est injecté (tâche 6). Routes :
  - `GET /?k=<page>` → pose le cookie, 302 vers `/` ; `GET /` sans cookie valide → 401 avec « Ouvre l'URL donnée par control-room start ».
  - `GET /api/state` (page) → `{pending, recent, sessions, right, events}`.
  - `POST /api/answer` (page) `{id, choice, note}` → 200, 409 si déjà répondue ; carte `owner: 'orchestrator'` → `deliver(formatAnswer(card))`.
  - `POST /api/cards` (client) → `{id}`.
  - `GET /api/cards/:id/answer?wait=<s>` (client) → réponse ou 204 au bout de `wait` (max 870).
- Produces (`control-room.js`) : sous-commande `start` : écrit `<dir>/server.json` `{port, pid}`, écoute, ouvre le navigateur sur `http://127.0.0.1:<port>/?k=<page>` (`start ""` sous Windows) et affiche l'URL ; port occupé → message « déjà lancé » et sortie 1.

- [x] **Step 1: Écrire les tests** (serveur sur `port: 0`, `deliver` espion)

```js
test('the client secret cannot answer a card', async () => {
  const r = await post('/api/answer', { id, choice: '1' }, { 'x-cr-secret': clientSecret });
  assert.equal(r.status, 403);
});
test('a page write from another origin is refused', async () => {
  const r = await post('/api/answer', { id, choice: '1' }, { cookie: `cr_page=${pageSecret}`, origin: 'http://evil.test' });
  assert.equal(r.status, 403);
});
test('a page write with a foreign Host is refused', async () => { /* Host: evil.test:<port> → 403 */ });
test('answering delivers once and a second answer gets 409', async () => {
  assert.equal((await pageAnswer(id, '2')).status, 200);
  assert.equal((await pageAnswer(id, '1')).status, 409);
  assert.equal(delivered.length, 1);
});
test('the long poll returns the answer as soon as it exists', async () => { /* approval card, answer after 200 ms, poll wait=5 resolves < 1 s */ });
test('the page secret never reaches the state dir', () => { /* grep every file under CONTROL_ROOM_DIR for pageSecret → none */ });
```

- [x] **Step 2: Lancer `node --test test/server.test.js`** — attendu : FAIL.
- [x] **Step 3: Implémenter `auth.js`, `server.js`, `start`** ; comparaison des secrets en `crypto.timingSafeEqual`.
- [x] **Step 4: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 5: Commit** `feat: serveur autonome, deux secrets, lanceur`

---

### Task 4: Page — carte, file, réponse libre, historique

**Files:**
- Create : `plugin/ui/index.html` (forké de `server/ui.html` de decision-inbox)
- Modify : `plugin/lib/server.js` (servir `ui/index.html`)

**Interfaces:**
- Consumes : `GET /api/state`, `POST /api/answer` (tâche 3).
- Produces : la mise en page des maquettes `F:\AzerothCoreCOA\.superpowers\brainstorm\269611-1795301586\content\layout-v2.html` : bandeau Sessions (vide jusqu'à la tâche 8), « À trancher n/m · ensuite : … », carte, zone « Écrire à l'orchestratrice… », bouton 🕘, colonne de droite (vide jusqu'à la tâche 5).

- [x] **Step 1: Forker `ui.html`** : garder `esc`, `md`, `render`, raccourcis 1–9 / Entrée / N / Maj+chiffre / Ctrl+Entrée. Les cartes `approval` montrent la commande (`tool.input.command` ou JSON) et deux boutons « Autoriser » / « Refuser » + note. Les cartes `reply` n'ont qu'un bouton « Lu ».
- [x] **Step 2: Règle « rien ne bouge »** : le rafraîchissement (toutes les 1,5 s) ne remplace jamais la carte affichée tant qu'elle n'est pas répondue ; seuls « ensuite : … », le compteur et le bandeau changent. 🕘 ouvre un tiroir avec `recent` (réponses et événements), fermé par défaut.
- [x] **Step 3: Résumé au retour** : sur `visibilitychange`/`focus` après plus de 120 s d'absence, une ligne « Pendant ton absence (N min) : … » liste les `events` postérieurs au départ (cartes arrivées, tests ajoutés, changements d'état des sessions) ; elle reste jusqu'au clic sur ✕.
- [x] **Step 4: Vérifier avec `node --test test/`** (aucune régression), puis lancer `control-room start`, créer 3 cartes au secret des clients (`curl`) et répondre au clavier.
- [ ] **Step 5 (user):** la carte ne change pas pendant qu'on la lit alors que deux cartes arrivent ; le résumé apparaît après 2 min dans une autre fenêtre.
- [x] **Step 6: Commit** `feat: page de la salle de contrôle`

---

### Task 5: Colonne de droite — À tester, Plans actifs, TODO

**Files:**
- Create : `plugin/lib/plan-file.js`, `test/fixtures/master-plan.md` (copie de `F:\AzerothCoreCOA\.agents\plans\solo-power-creep\plan.md` au moment de la tâche)
- Modify : `plugin/lib/server.js` (`right` dans `/api/state`, `POST /api/test`), `plugin/ui/index.html`
- Test : `test/plan-file.test.js`

**Interfaces:**
- Produces :
  - `parseMaster(text): {tests: {text, done, parent}[], todos: {name, done, planDir: string|null}[]}` — `text` = première ligne après `(user) `, espaces compactés ; `parent` = nom `**…**` de l'entrée englobante de `## To do`, sinon le titre `##`. `todos` = entrées de premier niveau `- [ ] **Nom**` de `## To do` ; `planDir` = premier `.agents/plans/<nom>/` cité dans l'entrée (lignes de continuation comprises).
  - `tickTest(file, text): 'ok'|'not-found'|'ambiguous'` — écriture atomique, `[ ]` → `[x]` sur la seule ligne correspondante.
  - `planProgress(planFile): {done, total}`.
  - `POST /api/test` (page) `{text, result: 'ok'|'fail', note}` : `ok` → `tickTest` ; `fail` → `deliver("[control-room] Test KO — <parent> : <text>\nNote : <note>")`, sans toucher au fichier. Échec de `tickTest` → carte `kind: 'error'`.

- [x] **Step 1: Écrire les tests sur la fixture**

```js
test('dungeon speed owns its seven (user) tests, two done', () => {
  const t = parseMaster(fixture).tests.filter(x => x.parent === 'Dungeon speed');
  assert.equal(t.length, 7); assert.equal(t.filter(x => x.done).length, 2);
});
test('in-game checks keep their section as parent', () => {
  assert.ok(parseMaster(fixture).tests.some(x => x.parent === 'In-game checks' && x.text.startsWith('Mob behaviour')));
});
test('a todo links its plan folder when it cites one', () => {
  const td = parseMaster(fixture).todos;
  assert.equal(td.find(x => x.name === 'Dungeon speed').planDir, '.agents/plans/dungeon-speed/');
  assert.equal(td.find(x => x.name.startsWith('Profession filter')).planDir, null);
});
test('tickTest refuses an ambiguous or vanished line and writes nothing', () => { /* duplicate a line → 'ambiguous', file unchanged; unknown text → 'not-found' */ });
test('tickTest finds the line after it moved', () => { /* insert 5 lines above, tick → 'ok', only that line changed */ });
```

- [x] **Step 2: Lancer `node --test test/plan-file.test.js`** — attendu : FAIL.
- [x] **Step 3: Implémenter `plan-file.js`**, puis `right` dans `/api/state` : `tests` non cochés groupés par `parent`, `plans` = `active-plans.json` (tâche 6) avec `planProgress`, `todos` non cochés. Relecture des fichiers à chaque `/api/state` (pas de cache).
- [x] **Step 4: UI** : trois sections repliables « À tester par toi (n) », « Plans actifs (n) », « TODO (n) » ; sur un test, OK / Problème (+ note). Rien ne se réordonne pendant qu'une section est survolée.
- [x] **Step 5: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 6: Commit** `feat: colonne À tester / Plans / TODO lue depuis le plan maître`

---

### Task 6: Déclaration de l'orchestratrice et livraison

**Files:**
- Create : `plugin/lib/inbox.js`, `plugin/lib/client.js`
- Modify : `plugin/bin/control-room.js` (sous-commande `claim`), `plugin/lib/server.js` (`POST /api/claim`, `POST /api/plans`)
- Test : `test/claim.test.js`

**Interfaces:**
- Consumes : la voie choisie à la tâche 1.
- Produces :
  - `client.js` : `call(method, path, body?): Promise<{status, json}>` (lit `server.json` et `client.secret` ; serveur absent → `{status: 0}`).
  - `control-room claim --project <dir> --plans <dir> --master <file>` : envoie `{socket: CLAUDE_CODE_MESSAGING_SOCKET, token: CLAUDE_CODE_MESSAGING_TOKEN, project, plans, master}`.
  - `POST /api/claim` (client) → écrit `orchestrator.json` ; une déclaration précédente avec un autre `socket` reçoit « [control-room] Une autre orchestratrice a pris le relais. ».
  - `inbox.js` : `deliverTo({socket, token}, text): Promise<void>` au format trouvé par la tâche 1 ; échec → le texte reste dans `<dir>/undelivered.jsonl` et part à la prochaine livraison réussie ou au prochain `claim`.
  - `POST /api/plans` (client) `{name, dir, label, state: 'active'|'archived'}` → `active-plans.json`.
  - Voie `listener` : `control-room listen` (lancé en arrière-plan par l'orchestratrice) attend les messages du serveur en long poll et les écrit dans sa propre boîte. Voie `poll` : `deliver` ne fait que garder le message pour `wait_answers` (tâche 7).

- [x] **Step 1: Écrire les tests** (faux canal : `net.createServer` sur un canal nommé de test `\\.\pipe\cr-test-<hasard>` qui enregistre les lignes reçues)

```js
test('claim then answer delivers the auth line then the message', async () => {
  await claim({ socket: pipe, token: 't0' });
  await pageAnswer(cardId, '1');
  assert.deepEqual(JSON.parse(lines[0]), { type: 'auth', token: 't0' });
  assert.match(lines[1], /Quick Upgrade/);
});
test('a new claim takes over and warns the previous inbox', async () => { /* claim A, claim B → A received the takeover line; next answer goes to B */ });
test('pending answers survive a takeover', async () => { /* answer while A's pipe is down → undelivered.jsonl; claim B → B receives it */ });
```

- [x] **Step 2: Lancer `node --test test/claim.test.js`** — attendu : FAIL.
- [x] **Step 3: Implémenter** `client.js`, `inbox.js`, `claim`, les deux routes ; `start` branche `deliver` sur `deliverTo(orchestrator.json)`.
- [x] **Step 4: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 5 (user):** dans une vraie session, `control-room claim …`, répondre à une carte dans la page : la session se réveille avec le texte de la réponse.
- [x] **Step 6: Commit** `feat: déclaration de l'orchestratrice et livraison dans sa boîte`

---

### Task 7: Serveur MCP de l'orchestratrice et messages libres

**Files:**
- Create : `plugin/mcp/server.js`, `plugin/.mcp.json` (`node ${CLAUDE_PLUGIN_ROOT}/mcp/server.js`)
- Modify : `plugin/lib/server.js` (`POST /api/message`)
- Test : `test/mcp.test.js`

**Interfaces:**
- Consumes : `client.js` (tâche 6). Boucle JSON-RPC stdio reprise de decision-inbox (`server.js` l. 249-281).
- Produces, outils MCP :
  - `queue_decision {agent, summary, recap?, options, proposition?, recommended?, urgent?, session?}` → `{queued: id}`.
  - `reply {agent, text}` → carte `kind: 'reply'`.
  - `set_plan {name, dir, label?, state}`. (Pas d'outil d'étiquetage : c'est la session de travail qui lance `control-room label`, tâche 8.)
  - `cancel_decision {id}`, `list_pending {}`.
  - `wait_answers {timeout_seconds?}` — seulement pour la voie `poll`.
  - Serveur absent : chaque outil répond `isError` « control-room ne tourne pas : lance `control-room start` ».
- Produces, `POST /api/message` (page) `{text, image?: dataURL}` : image → `<dir>/uploads/<horodatage>.png` ; livre `[control-room] Message de l'utilisateur : <text>` + `\nCapture : <chemin absolu>` ; > 10 Mo → 413, type hors `image/png|jpeg|webp` → 415.

- [x] **Step 1: Écrire les tests** : `tools/list` contient les 6 outils ; `queue_decision` crée une carte visible dans `/api/state` ; outil appelé serveur arrêté → `isError` avec le texte ci-dessus ; `/api/message` avec une image de 11 Mo → 413, rien de livré ; avec `data:text/html…` → 415.
- [x] **Step 2: Lancer `node --test test/mcp.test.js`** — attendu : FAIL.
- [x] **Step 3: Implémenter** le serveur MCP et la route ; UI : Ctrl+V d'une image dans la zone de saisie → aperçu + envoi.
- [x] **Step 4: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 5: Commit** `feat: outils MCP de l'orchestratrice et messages libres avec capture`

---

### Task 8: Hooks — bandeau des sessions et approbations

**Files:**
- Create : `plugin/hooks/hooks.json`
- Modify : `plugin/bin/control-room.js` (sous-commandes `hook <event>` et `label`), `plugin/lib/server.js` (`POST /api/sessions/event`, `POST /api/sessions/label`), `plugin/ui/index.html` (bandeau)
- Test : `test/hooks.test.js`

**Interfaces:**
- Consumes : `client.js`, `cards.js`, long poll de la tâche 3.
- Produces :
  - Clé d'une session : `CLAUDE_CODE_MESSAGING_SOCKET` (vu par les hooks et par Bash, confirmé à la tâche 1), repli `session_id`.
  - `hooks.json`, forme exec (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/bin/control-room.js", "hook", "<event>"]`) :
    - `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`, `Notification`, `PermissionDenied` : `async: true`, envoient `{key, session_id, cwd, event, activity}` ; `activity` = `tool_input.description` sinon `tool_name` (PreToolUse), « inactive » (Stop, `idle_prompt`), « refus du mode auto : <reason> » (PermissionDenied).
    - `PermissionRequest` : synchrone, `timeout: 900` ; crée une carte `approval` (`agent` = libellé de la session, `tool`), attend la réponse en long poll jusqu'à 870 s ; « Autoriser » → `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` ; « Refuser » → `{"behavior":"deny","message":"Refusé depuis control-room : <note>"}` ; serveur absent, délai dépassé ou erreur → n'écrit rien, sortie 0.
  - États du bandeau : `working`, `decision` (une carte `session` = cette session attend), `approval`, `idle` ; libellé par défaut `<dossier cwd> · <4 premiers caractères de session_id>`.
  - `control-room label "<emoji> <libellé>"` (exécuté par la session de travail, à la demande de l'orchestratrice) → `POST /api/sessions/label` avec sa clé.

- [x] **Step 1: Écrire les tests** (le hook lancé en sous-processus avec un JSON sur stdin)

```js
test('PermissionRequest allow prints the allow decision', async () => { /* spawn hook, answer the approval card 'allow' via page → stdout JSON behavior 'allow' */ });
test('PermissionRequest deny carries the note', async () => { /* → behavior 'deny', message contains the note */ });
test('PermissionRequest with the server down prints nothing and exits 0', async () => { /* no server.json → stdout '' , code 0 */ });
test('the approval card cannot be answered with the client secret', async () => { /* 403 */ });
test('PreToolUse updates the session line in place', async () => { /* two events, same key → one session, activity = last description */ });
```

- [x] **Step 2: Lancer `node --test test/hooks.test.js`** — attendu : FAIL.
- [x] **Step 3: Implémenter** hooks, routes, `label`, bandeau dans l'UI (une ligne par session, pastille, activité, heure ; jamais de nouvelle ligne pour un événement).
- [x] **Step 4: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 5: Commit** `feat: bandeau des sessions et approbations depuis la page`

---

### Task 9: Skill de l'orchestratrice, installation et essai réel

**Files:**
- Create : `plugin/skills/control-room/SKILL.md`, `README.md`
- Modify : `CLAUDE.md` (commandes : `node --test test/`, `control-room start`)

**Interfaces:**
- Consumes : tous les outils et commandes précédents.
- Produces : les règles de la spec, section « Méthode de travail », écrites pour l'orchestratrice : `control-room claim` au démarrage (avec les chemins du projet) ; chaque décision en carte, une ligne d'état dans le terminal ; `reply` pour répondre au texte libre ; `set_plan` actif quand elle confie un plan ; carte « Archiver <plan> ? » quand tous les tests `(user)` de la fonctionnalité sont cochés, et sur accord déplacement du dossier dans `<plans>/_archive/` puis `set_plan state: 'archived'` ; demander à chaque session confiée de lancer `control-room label …` et de cocher son plan à chaque tâche finie ; ne jamais répondre elle-même à une carte d'approbation.

- [x] **Step 1: Écrire `SKILL.md` et `README.md`** (installation : `/plugin marketplace add E:\workspaces\claude\control-room`, puis `/plugin install control-room@control-room` dans chaque session ; mode auto conseillé pour les sessions de travail).
- [x] **Step 2: Lancer `node --test test/`** — attendu : PASS.
- [x] **Step 3: Commit** `docs: skill de l'orchestratrice et installation`
- [ ] **Step 4 (user):** installer le plugin, `control-room start`, une orchestratrice + 2 sessions de travail sur SoloConquest (conseil de decision-inbox : 2-3 sessions pour commencer).
- [ ] **Step 5 (user):** une décision complète sans ouvrir de terminal : demande écrite dans la page → délégation → carte → réponse → la session concernée reçoit la décision.
- [ ] **Step 6 (user):** une approbation depuis la page (par exemple `docker compose build` chez la session des builds) : Autoriser fait continuer la session ; Refuser + note lui renvoie la note.
- [ ] **Step 7 (user):** un test OK coche la case dans `plan.md` ; un test KO renvoie la note à la bonne session.
- [ ] **Step 8 (user):** ménage ponctuel de SoloConquest par l'orchestratrice : archiver coa-stats-weight, crucible-absorb-all, crucible-stat-pins ; faire cocher fly-anywhere et gathering-yield.
