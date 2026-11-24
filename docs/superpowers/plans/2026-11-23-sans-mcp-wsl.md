# Mode sans MCP et WSL Ubuntu — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** les outils de l'orchestratrice utilisables par `control-room tool` quand le MCP est bloqué, et control-room
utilisable sous WSL Ubuntu sans réglage à la main.

**Architecture:** `callTool` sort de `mcp/server.js` vers `lib/tools.js`, que le MCP et la nouvelle sous-commande
`tool` emballent chacun à sa façon. WSL est détecté dans `lib/host.js` (hôte, commande d'ouverture du navigateur) ;
un lanceur POSIX à la racine rejoint `control-room.cmd`.

**Tech Stack:** Node 24, modules intégrés seulement, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-23-sans-mcp-wsl-design.md`

## Global Constraints

- Node built-ins uniquement, pas de `npm install`. Windows 10 en premier.
- Tests : `node --test` (pas `node --test test/`) ; toujours un `CONTROL_ROOM_DIR` temporaire (`tempStateDir`).
- Textes affichés en français, dans le ton des messages existants.
- Session avec MCP : sortie des outils inchangée.
- Commits sur `main`, un par tâche, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Texte français par stdin (`l'utilisateur`, accents, emoji `⚔️`) : arrive intact dans le fil → test Task 2.
2. `--json` illisible : code 2, rien n'est envoyé au serveur → test Task 2.
3. `wait_answers` par la CLI : l'attente longue va au bout (le client HTTP reçoit `timeoutMs`), pas de sortie
   prématurée → test Task 2 avec `timeout_seconds: 1`.
4. Erreur du serveur (id inconnu) : code 1 et le message du serveur sur stderr → test Task 2.
5. Lanceur copié seul sans entrée `control-room@*` dans `installed_plugins.json` : message clair, code ≠ 0, pas de
   `node` lancé sur un chemin vide → vérification manuelle Task 3 (sh non testé par `node --test`).

---

### Task 1: `lib/tools.js`, source unique des outils

**Files:**
- Create: `plugin/lib/tools.js`
- Modify: `plugin/mcp/server.js` (ne garde que la boucle JSON-RPC)
- Test: `test/tools.test.js` ; `test/mcp.test.js` reste inchangé et doit passer

**Interfaces:**
- Produces :
  - `TOOLS` : le tableau actuel de `mcp/server.js`, déplacé tel quel.
  - `DOWN` : le message actuel « control-room ne tourne pas… ».
  - `async runTool(name: string, args = {}): Promise<object|string>` — le `switch` actuel, qui rend le résultat
    brut (`{queued}`, `{shown}`, `{ok:true}`, `'Retirée.'`…). Lève `Error` avec `.down = true` si le serveur est
    absent, `.unknown = true` (message `Outil inconnu : <name>`) si l'outil n'existe pas, sinon `Error(message du
    serveur)`.
  - `format(result): string` — chaîne telle quelle, objet en `JSON.stringify(o, null, 2)` (le texte du MCP
    aujourd'hui).
- `mcp/server.js` : `tools/call` → `text(format(await runTool(...)))`, erreur → `text(e.message, true)`.
  `serverInfo.version` lu dans `plugin/.claude-plugin/plugin.json`.

- [ ] **Step 1: tests qui échouent** dans `test/tools.test.js` (même montage que `mcp.test.js` : `tempStateDir`,
  `startTestServer` avec les routes orchestratrice + tableau) :
  - `runTool('reply', {text:'Salut'})` rend un objet avec `shown` ; la conversation de `/api/state` finit par `Salut`.
  - `runTool('nope')` rejette avec `e.unknown === true`.
  - serveur fermé et `server.json` supprimé : `runTool('list_pending')` rejette avec `e.down === true` et
    `e.message === DOWN`.
  - `format('Retirée.') === 'Retirée.'` ; `format({a:1}) === '{\n  "a": 1\n}'`.
  - dans `mcp.test.js`, ajouter : `initialize` rend `serverInfo.version` égal à la `version` de `plugin.json`.
- [ ] **Step 2:** `node --test` → les nouveaux tests échouent (module absent).
- [ ] **Step 3:** créer `lib/tools.js`, réduire `mcp/server.js`.
- [ ] **Step 4:** `node --test` → tout passe, `mcp.test.js` compris.
- [ ] **Step 5:** commit `refactor(outils): lib/tools.js, source unique pour le MCP et la CLI`.

### Task 2: `control-room tool` et la skill « Sans MCP »

**Files:**
- Modify: `plugin/bin/control-room.js` (commande `tool`, `USAGE`)
- Modify: `plugin/skills/control-room/SKILL.md` (section « Sans MCP » après « Démarrage »)
- Test: `test/cli-tool.test.js`

**Interfaces:**
- Consumes : `TOOLS`, `runTool`, `format`, `DOWN` de Task 1.
- Produces : `control-room tool <nom> [--json '<objet>' | --json -]`, `control-room tool --list`.
  - Sans `--json` : `{}`. `--json -` : lit tout stdin en UTF-8.
  - `--list` : `JSON.stringify(TOOLS, null, 2)`.
  - Succès : `format(résultat)` sur stdout, code 0. Erreur du serveur ou outil inconnu : message sur stderr, code 1.
    Pas de nom, JSON illisible ou non-objet : message + usage sur stderr, code 2. Serveur absent : `DOWN` sur
    stderr, code 3.

- [ ] **Step 1: tests qui échouent** dans `test/cli-tool.test.js` ; la CLI lancée par
  `spawn(process.execPath, [bin, 'tool', ...])` avec `CONTROL_ROOM_DIR` du test, stdin écrit puis fermé :
  - `tool reply --json -` avec `{"text":"Je confie ça à l'utilisateur ⚔️ — prêt"}` : code 0, stdout parse en objet
    avec `shown` ; le dernier message de la conversation vaut exactement ce texte.
  - `tool queue_decision --json '{"agent":"A","summary":"S ?","options":["x","y"]}'` : code 0 ; la carte est dans
    `pending` de `/api/state`.
  - `tool --list` : code 0 ; les noms parsés contiennent `reply`, `queue_decision`, `wait_answers` (15 en tout).
  - `tool reply --json '{pas du json'` : code 2 ; la conversation n'a pas changé.
  - `tool` sans nom : code 2.
  - `tool nope` : code 1, stderr contient `Outil inconnu`.
  - `tool add_note --json '{"id":"ZZZZ","text":"t"}'` : code 1, stderr non vide (erreur du serveur).
  - `tool wait_answers --json '{"claim":"<claimId de claimAs>","timeout_seconds":1}'` : code 0 après ≥ 1 s,
    stdout contient `messages`.
  - `CONTROL_ROOM_DIR` vide (pas de `server.json`) : `tool list_pending` → code 3, stderr contient
    `control-room ne tourne pas`.
- [ ] **Step 2:** `node --test test/cli-tool.test.js` → échec (commande inconnue, code 2 partout).
- [ ] **Step 3:** ajouter `tool` à `commands` dans `bin/control-room.js` et la ligne à `USAGE`.
- [ ] **Step 4:** `node --test` → tout passe.
- [ ] **Step 5:** section « Sans MCP » dans la skill, contenu fixé par le spec : si l'outil `reply` n'est pas
  offert, `control-room tool --list` une fois, puis `control-room tool <nom> --json -` avec un heredoc `<<'EOF'`
  (pas `--json '…'` : les apostrophes du français le cassent), mêmes noms et arguments ; code 3 = page pas lancée,
  le dire à l'utilisateur ; l'utilisateur peut autoriser `Bash(control-room tool:*)`. Un exemple `reply`.
- [ ] **Step 6:** commit `feat(cli): control-room tool, les outils sans MCP`.

### Task 3: WSL Ubuntu

**Files:**
- Modify: `plugin/lib/host.js`
- Modify: `plugin/bin/control-room.js` (`openBrowser`)
- Create: `control-room` (lanceur POSIX, racine), `.gitattributes`
- Modify: `README.md` (section WSL, ligne d'installation Linux)
- Test: `test/host.test.js`

**Interfaces:**
- Produces, dans `lib/host.js` :
  - `isWsl({ platform = process.platform, env = process.env, osrelease = <lu dans /proc/sys/kernel/osrelease, '' si
    illisible> } = {}): boolean` — `platform === 'linux'` et (`env.WSL_DISTRO_NAME` ou `/microsoft/i` dans
    `osrelease`).
  - `pickHost({ env, wsl }): string` — `env.CONTROL_ROOM_HOST` || (`wsl` ? `'127.0.0.1'` : `'127.83.82.1'`).
  - `HOST = pickHost({ env: process.env, wsl: isWsl() })` (export inchangé).
  - `browserCommand(url, { platform, wsl }): [cmd, argv, opts]` — win32 : l'actuel ; WSL :
    `['cmd.exe', ['/c', 'start', url], { cwd: '/mnt/c' }]` ; darwin : `open` ; sinon `xdg-open`.
    `openBrowser` l'utilise et garde `detached`, `stdio: 'ignore'`, `unref()`.

- [ ] **Step 1: tests qui échouent** dans `test/host.test.js` :
  - `isWsl({platform:'linux', env:{WSL_DISTRO_NAME:'Ubuntu'}, osrelease:''})` → true ;
    `isWsl({platform:'linux', env:{}, osrelease:'5.15.167.4-microsoft-standard-WSL2'})` → true ;
    `isWsl({platform:'linux', env:{}, osrelease:'6.8.0-45-generic'})` → false ;
    `isWsl({platform:'win32', env:{WSL_DISTRO_NAME:'Ubuntu'}, osrelease:''})` → false.
  - `pickHost({env:{}, wsl:true})` → `'127.0.0.1'` ; `pickHost({env:{}, wsl:false})` → `'127.83.82.1'` ;
    `pickHost({env:{CONTROL_ROOM_HOST:'127.0.0.5'}, wsl:true})` → `'127.0.0.5'`.
  - `browserCommand('http://h/?k=x', {platform:'linux', wsl:true})` → cmd `cmd.exe`, argv
    `['/c','start','http://h/?k=x']`, `opts.cwd === '/mnt/c'` ; `{platform:'linux', wsl:false}` → `xdg-open`.
- [ ] **Step 2:** `node --test test/host.test.js` → échec.
- [ ] **Step 3:** implémenter `host.js` ; `openBrowser` passe par `browserCommand` (`browserCommand` vit dans
  `host.js` pour que `bin/` reste sans logique testable).
- [ ] **Step 4:** `node --test` → tout passe.
- [ ] **Step 5:** lanceur `control-room` (`#!/bin/sh`) : résout son propre chemin (`readlink -f "$0"`) ; si
  `plugin/bin/control-room.js` existe à côté, `exec node` dessus ; sinon `node -e` lit
  `~/.claude/plugins/installed_plugins.json`, prend le premier `installPath` d'une clé `control-room@*` et
  `exec node "<installPath>/bin/control-room.js" "$@"` ; rien trouvé → `control-room : plugin introuvable (ni à côté
  du lanceur, ni dans installed_plugins.json).` sur stderr, code 1.
  `.gitattributes` : `control-room text eol=lf`. `git add --chmod=+x control-room`.
- [ ] **Step 6:** vérifier dans Git Bash : `sh ./control-room tool --list | head -3` (cas « à côté ») ; copie du
  lanceur dans le scratchpad lancée par `sh` → cas `installPath` (ici 0.1.0 du cache, peu importe : `--list`
  inconnu de 0.1.0 donne l'usage, ce qui prouve le chemin) ; `installed_plugins.json` introuvable via
  `HOME=<dossier vide>` → le message ci-dessus, code 1 ; `git ls-files --eol control-room` → `i/lf w/lf`.
- [ ] **Step 7:** README : sous « Installation », Linux / WSL : `ln -s <dépôt>/control-room ~/.local/bin/` ou
  copier le lanceur seul quand le plugin vient d'une marketplace ; section « WSL » : `127.0.0.1` automatique (et
  `CONTROL_ROOM_HOST` qui reste prioritaire), le cookie de la page qui part alors vers les autres serveurs locaux
  en `127.0.0.1`, la page ouverte par `cmd.exe`, `--no-open` sinon.
- [ ] **Step 8:** commit `feat(wsl): hôte, navigateur et lanceur POSIX pour WSL Ubuntu`.

### Task 4: version 0.3.0

**Files:**
- Modify: `plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

- [ ] **Step 1:** `version` → `0.3.0` dans les deux.
- [ ] **Step 2:** `node --test` (le test de version de Task 1 suit `plugin.json`) ; `claude plugin validate ./plugin`
  et `claude plugin validate .` → valides.
- [ ] **Step 3:** commit `chore: 0.3.0`.

### Acceptation

- [ ] (user) Poste perso, après `/plugin` mise à jour en 0.3.0 : session avec MCP, `reply` et `queue_decision` par
  le MCP, rien n'a changé.
- [ ] (user) Travail, MCP bloqué : `claim` → `listen` en arrière-plan → message depuis la page →
  `control-room tool reply` → la réponse apparaît dans le fil.
- [ ] (user) Travail : `control-room tool queue_decision` → carte → clic → réponse relayée par `listen`.
- [ ] (user) WSL sans `CONTROL_ROOM_HOST` : `control-room start` ouvre la page dans le navigateur Windows.
