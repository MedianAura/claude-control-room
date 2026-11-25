# Plans actifs fantômes — cause et décisions

Date : 2026-11-24. Grilling mené par la session g1 pour l'orchestratrice, réponses de l'utilisateur par cartes.
Pas de code modifié à cette étape. Termes : `GLOSSARY.md` (Déclaration, Projet déclaré, Plan actif).

## Symptôme

La colonne « Plans en cours » de la page, avec control-room déclaré, montre `stat-gains` et
`crucible-quick-upgrade`, deux plans d'AzerothCoreCOA.

## Cause

- `active-plans.json` est **un seul fichier global**, dans `stateDir()` (`~/.claude/control-room/`). `set_plan`
  (`plugin/lib/delivery.js:135`) y ajoute ou retire un plan par son nom ; `rightState()` (`plugin/lib/right.js:10`)
  le lit tel quel. `claim()` (`delivery.js:43`) n'y touche pas, et aucun des deux ne regarde le projet déclaré.
- Les deux plans ont été déclarés le 2026-11-22 (événements « plan actif : 📊 stat-gains » à 18:15 UTC,
  « ⚔️ crucible-quick-upgrade » à 19:19) par l'orchestratrice d'AzerothCoreCOA, avec
  `dir = F:\AzerothCoreCOA\.agents\plans\<nom>`.
- Ce **ne sont pas des résidus** : ils sont réellement en cours (3 et 4 tâches non cochées dans leur `plan.md`,
  absents de `_archive/`). C'est l'état qui fuit d'un projet à l'autre, pas un archivage oublié.
- Ils pèsent aussi sur le tableau : `board.view(items, plans)` prend libellés et ordre des groupes dans cette liste.

## Décisions

1. **Les plans actifs appartiennent au projet déclaré** (Q1). Le fichier devient
   `{ "<projet>": [plans…] }`, la clé étant le `--project` du claim normalisé (`path.resolve`, plus minuscules
   sous Windows). `set_plan` écrit sous le projet déclaré, `rightState()` et `board.view` lisent sous lui. Un
   re-claim du même projet retrouve ses plans ; les plans d'un autre projet attendent le retour de leur
   orchestratrice. Même nom dans deux projets : deux plans indépendants.
   - Écartés : vider la liste à chaque claim (un redémarrage perd les plans en cours) ; filtrer le fichier global
     par chemin (dépend de la normalisation des chemins, cache un plan `file` hors de `--plans`) ; ranger les plans
     dans le dépôt à côté de `board.json` (contredit le spec du tableau, mêle les plans aux commits du tableau).
2. **Migration : adoption au claim** (Q2). L'ancienne liste (tableau sans projet) est gardée à part. Quand un
   projet se déclare, il prend les plans de cette liste qui sont sous son dossier, et ils en sortent. La liste
   disparaît une fois vide. AzerothCoreCOA retrouvera ses deux plans à son prochain claim, sans rien faire.
   - Écartés : abandonner l'ancien format (l'orchestratrice d'AzerothCoreCOA ne saurait pas qu'il faut
     redéclarer) ; un rattachement à la main au déploiement (étape à se rappeler, rien pour un autre poste).
3. **Le dossier de référence de l'adoption est `--plans`** (Q3), pas `--project`. Aucun vol entre projets
   imbriqués (un projet `E:\workspaces\claude` ne prend pas les plans de `…\claude\control-room`). Un ancien plan
   hors de `--plans` reste orphelin, ce qui est accepté. L'ancienne liste n'en contient aucun.
4. **`set_plan` sans orchestratrice déclarée est refusé** (Q4) : 409, « aucune orchestratrice déclarée, lance
   control-room claim ». La reprise par chemin reste une migration ponctuelle et ne devient pas un mécanisme
   permanent.

Pas d'ADR : changement réversible à faible coût, sans surprise pour un lecteur futur.

## Pistes notées, hors de ce changement

- **Claim aux chemins mangés.** Le 2026-11-24, `orchestrator.json` contenait
  `project = "E:workspacesclaudecontrol-room"` et un `board` résolu en
  `…\control-room\workspacesclaudecontrol-room.control-roomboard.json` : Git Bash avait retiré les antislashs de
  chemins non quotés. La commande de `CLAUDE.md` (section Commandes) les donne non quotés et reproduit le piège.
  Lancé depuis Git Bash, `claim` pourrait refuser un chemin sans séparateur ou inexistant. Ce cas compte aussi pour
  la décision 1 : la clé du projet est le chemin du claim, et un chemin mangé donnerait une clé fantôme.
- **Orchestratrice remplacée encore vivante** : son `set_plan` atterrirait dans la liste du nouveau projet,
  comme ses écritures au tableau atterrissent déjà dans le nouveau tableau. Suivi au tableau : TODO #SWDH.
