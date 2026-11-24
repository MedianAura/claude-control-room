# Mode sans MCP et WSL Ubuntu — design

Date : 2026-11-23. Origine : handoff « control-room sans MCP » (essai au travail, control-room 0.2.0, Claude Code
2.1.330, WSL). Petit changement : design court.

## Pourquoi

Au travail, une politique gérée (`allowedMcpServers`, poussée à distance) bloque les serveurs MCP des plugins hors
liste. Le plugin est admis (hooks et skill chargés), mais `mcp/server.js` ne démarre jamais : l'orchestratrice fait
`claim` et `listen`, reçoit les messages de la page, mais ne peut ni répondre (`reply`), ni poser une carte
(`queue_decision`), ni toucher au tableau. Le poste du travail est sous WSL Ubuntu, où `control-room` n'est pas dans
le `PATH`, où `127.83.82.1` n'est pas joignable depuis le navigateur Windows et où `xdg-open` manque ; le matin du
23, tout ça a été contourné à la main (shim, `CONTROL_ROOM_HOST=127.0.0.1`, `start --no-open`).

## Objectifs

- Les 15 outils de l'orchestratrice utilisables sans MCP, par une commande, avec les mêmes noms et arguments.
- Une seule source de vérité pour les outils, MCP et CLI.
- control-room utilisable sous WSL Ubuntu sans réglage à la main.

## Non-objectifs

- Raccourcis par outil (`reply --text`, `board add-test`…) : doublent la surface et la doc pour rien.
- Avertissement « MCP absent » dans `claim` : `mcp/server.js` ne parle au serveur qu'à l'appel d'un outil, il n'y a
  rien à détecter. L'orchestratrice voit elle-même si l'outil `reply` lui est offert.
- Mode réseau WSL `mirrored`, IP de la VM WSL, macOS : non traités, non testés.

## Anti-objectifs

- Contourner la politique de l'org. La CLI ne lance pas de serveur MCP (c'était le défaut du contournement
  temporaire, qui pilotait `mcp/server.js` en JSON-RPC) : elle appelle l'API HTTP comme `claim`, `listen` et les
  hooks, déjà admis.
- Changer quoi que ce soit pour une session où le MCP marche.

## Approches

1. **Commande générique `control-room tool <nom>`** sur un module d'outils partagé avec le MCP. Choisie : une seule
   définition, la skill garde les mêmes noms.
2. Une sous-commande par outil avec des drapeaux. Rejetée : 15 interfaces de plus à tenir alignées sur le MCP.
3. Garder le script qui pilote `mcp/server.js`. Rejetée : zone grise vis-à-vis de la politique.

Pour WSL, une seule voie sensée : détecter WSL là où le comportement diffère (hôte, ouverture du navigateur) et
fournir un lanceur POSIX.

## Le design

### Outils partagés

- `plugin/lib/tools.js` exporte `TOOLS` (noms, descriptions, schémas, tels qu'aujourd'hui) et
  `runTool(name, args)`, qui rend l'objet résultat brut ou lève une erreur (`down: true` si le serveur ne tourne
  pas ; outil inconnu : erreur). Le corps est le `callTool` actuel sans l'emballage MCP.
- `plugin/mcp/server.js` ne garde que la boucle JSON-RPC et emballe (`content: [{type:'text'}]`, `isError`).
  Sa version vient de `plugin/.claude-plugin/plugin.json`, plus écrite en dur.

### `control-room tool`

```
control-room tool <nom> [--json '<objet>' | --json -]   exécute l'outil ; sans --json : {}
control-room tool --list                                 les outils, descriptions et schémas, en JSON
```

- Sortie : le résultat en JSON sur stdout (indenté comme le MCP), messages d'erreur sur stderr.
- Codes : 0 succès ; 1 erreur du serveur ou outil inconnu ; 2 usage (pas de nom, JSON illisible) ; 3 serveur
  absent (même message `DOWN` que le MCP).
- `--list` existe parce que, sans MCP, l'orchestratrice ne voit pas les schémas : la skill ne décrit les arguments
  qu'en prose.
- La CLI refuse (code 2) un `--json` sans valeur et un argument `required` absent du schéma : le client MCP voit
  ces `required`, la CLI doit faire de même, sinon un `reply` sans texte poste une bulle vide. Le reste, le
  serveur le tranche.

### Skill : section « Sans MCP »

Si l'outil `reply` ne t'est pas offert : `control-room tool --list` une fois, puis
`control-room tool <nom> --json -` avec un heredoc `<<'EOF'` (forme par défaut : le texte en français est plein
d'apostrophes, qui cassent `--json '…'`). Mêmes noms, mêmes arguments. Rappel : l'utilisateur peut autoriser
`Bash(control-room tool:*)` pour ne pas valider chaque appel.

### WSL

- **Hôte** (`plugin/lib/host.js`) : `CONTROL_ROOM_HOST` d'abord ; sinon `127.0.0.1` sous WSL (Linux avec
  `WSL_DISTRO_NAME`, ou `microsoft` dans `/proc/sys/kernel/osrelease`) ; sinon `127.83.82.1`. Le relais localhost
  de WSL2 en NAT ne transmet que `127.0.0.1`. Coût, documenté dans le README : sous WSL, le cookie de la page part
  vers tout serveur local en `127.0.0.1`.
- **Navigateur** (`openBrowser`) : sous WSL, `cmd.exe /c start <url>` avec `cwd` sur `/mnt/c` (pas d'avertissement
  de chemin UNC). L'URL n'a pas de guillemets ni de `&`, donc pas de titre `""` à passer.
- **Lanceur** `control-room` (POSIX, racine du dépôt, pendant de `control-room.cmd`) : exécute
  `plugin/bin/control-room.js` situé à côté de lui (lien symbolique résolu) ; s'il n'y en a pas (lanceur copié
  seul, plugin installé depuis une marketplace), lit `installPath` de l'entrée `control-room@*` dans
  `~/.claude/plugins/installed_plugins.json`. Survit aux changements de version du cache.
- **Fins de ligne** : `.gitattributes` force `eol=lf` sur le lanceur (`core.autocrlf=true` sur le poste Windows) ;
  bit exécutable dans git.
- **README** : section WSL (lien symbolique dans `~/.local/bin`, ce que fait la détection, le coût du cookie).

### Version

0.3.0 dans `plugin/.claude-plugin/plugin.json` et `.claude-plugin/marketplace.json` (le cache des plugins est indexé
par version, le miroir du travail en dépend).

## Laissé au constructeur

Découpage interne de `tools.js`, lecture de stdin, forme exacte du lanceur, tests (le module d'outils et la CLI
contre un serveur de test ; la détection de l'hôte par une fonction pure).

## Test d'acceptation (utilisateur, au travail)

- MCP bloqué : `claim` → `listen` en arrière-plan → message depuis la page → `control-room tool reply` → la réponse
  apparaît dans le fil.
- `control-room tool queue_decision` → carte affichée → clic → réponse relayée par `listen`.
- WSL sans `CONTROL_ROOM_HOST` : `control-room start` ouvre la page dans le navigateur Windows.
- Session avec MCP (poste perso) : rien ne change.
