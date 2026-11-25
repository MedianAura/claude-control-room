# Le fil recopie les textes de terminal depuis le transcript de l'orchestratrice

**Statut : abandonnée (2026-11-25), jamais implémentée.** Recopier le terminal ramenait un flux qui bouge dans une
page faite pour que rien ne bouge. Le besoin est traité autrement : l'orchestratrice répond toujours dans la page
(voir `docs/superpowers/specs/2026-11-24-chat-complet.md`, encadré en tête).

Les textes que l'orchestratrice écrit dans son terminal ne sont exposés par aucun hook. Le serveur les lit donc dans
son transcript JSONL (`~/.claude/projects/<dossier>/<session_id>.jsonl`), un format non documenté de Claude Code
(2.1.330). Il en lit seulement la fin, depuis le dernier point lu, et recopie les lignes reconnues dans le fil
(`conversation.jsonl`).

Le fichier est désigné en deux temps. `claim` le trouve par `CLAUDE_CODE_SESSION_ID`. Après un `/clear`, le hook
`SessionStart` de la même boîte de réception le fait suivre (`transcript_path`). Ce suivi n'est accepté que si le
chemin est sous `~/.claude/projects`, si le fichier se nomme `<session_id>.jsonl` et si ses lignes portent ce
`sessionId`.

## Considered Options

- **Hooks seuls** (`Stop`, `PostToolUse`…) : ils ne transmettent pas le texte de l'assistante, donc pas de
  textes de terminal.
- **Relire le transcript à chaque chargement, sans copie** : les textes d'avant un `/clear` ou un changement
  d'orchestratrice disparaîtraient du fil, alors que les `reply` y restent.
- **`claim` seul, à refaire après `/clear`** : la confiance la plus forte, mais si elle oublie, la panne est
  silencieuse.
- **N'importe quel événement de hook fixe le fichier** : le moindre événement forgé déplacerait la lecture.

## Consequences

- Le nom de la boîte de réception n'est pas secret, puisqu'il figure dans chaque `SendMessage`. Une session peut donc
  faire suivre au serveur un autre transcript de l'utilisateur. Les garde-fous bornent ce risque aux transcripts du
  même compte, et il est accepté, comme le reste du risque local (design, « Sécurité »).
- Une mise à jour de Claude Code peut casser la lecture sans erreur, comme pour la boîte de réception
  (`docs/superpowers/specs/2026-11-21-inbox-spike.md`). La panne doit donc se voir : voir la spec
  `docs/superpowers/specs/2026-11-24-chat-complet.md`.
