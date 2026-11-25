# Textes de terminal de l'orchestratrice dans le fil

Date : 2026-11-24. Statut : décidé par grilling (g3, questions Q1 à Q9 relayées en cartes par l'orchestratrice). Pas de
code modifié à cette étape. Vocabulaire : `GLOSSARY.md` (section Fil). Décision d'architecture :
`docs/adr/0001-fil-lu-dans-le-transcript.md`.

## Intention

L'utilisateur voulait « le chat complet de l'orchestratrice dans control-room, sans le thinking ». Le grilling l'a
ramené à : **ses réponses**. Les appels d'outils restent dans son terminal (« si je veux les tool calls, j'ai mon
terminal à côté »). Le fil de la page montre donc, en plus de ses `reply`, ce qu'elle écrit dans son terminal, et
ce à quoi elle répond.

## Verdict de faisabilité

Faisable en Node built-ins, par lecture du transcript JSONL de la session (`~/.claude/projects/<dossier>/<session_id>.jsonl`).
Aucun hook ne transmet le texte de l'assistante. Le format n'est pas documenté (Claude Code 2.1.330) : même risque
que la boîte de réception, traité de la même façon (une panne visible, Q8).

### Essai en lecture seule (2026-11-24, transcript de l'orchestratrice, 167 lignes, 887 Ko en 4 min)

| Entrée (`type` : contenu) | Sens | Retenue |
|---|---|---|
| `user` : chaîne, `origin.kind:"human"` | message tapé par l'utilisateur dans son terminal | oui, message de l'utilisateur |
| `user` : chaîne, `origin.kind:"peer"`, `from:"control-room"`, `isMeta:true` | message de la page, décision, alerte livrée par `listen` | non : déjà dans le fil par le serveur |
| `user` : chaîne, `origin.kind:"peer"`, `from:"uds:…"`, `isMeta:true` | compte rendu d'une session (SendMessage) | déclencheur seulement (nom de la session, pas le contenu) |
| `assistant` : `text` | texte de terminal | oui |
| `assistant` : `thinking` | réflexion | non (et déjà vide : 8 blocs, 0 caractère en clair, signature seule) |
| `assistant` : `tool_use` / `user` : `tool_result` | appels d'outils et résultats | non |
| `user` : `text` avec `isMeta:true` sans `origin` peer | texte des skills, rappels | non |
| `api-request*`, `mode`, `atis-latch`, `attachment`, `system/*`… | tuyauterie | non |

À retenir :
- **Filtrer par `origin.kind`, pas par `isMeta`**, car les messages entre sessions sont marqués `isMeta:true`.
- Le nom du déclencheur se lit dans l'en-tête `<cross-session-message … from-name="control-room-5e">` du contenu, faute
  de mieux dans `origin`. Le libellé inscrit (`control-room label`) se retrouve par le socket (`from`), via les sessions
  connues du serveur.
- `sessionId` et `timestamp` (ISO, UTC) sont présents sur chaque ligne de conversation.
- Les blocs d'un même message assistant (`message.id`) arrivent en plusieurs lignes, une par bloc, chacune avec son
  propre `uuid` : 40 messages sur 114 dans l'essai. Un texte de terminal correspond à une ligne `text`, et le `uuid`
  sert de repère de reprise.
- Environ la moitié des lignes, et la plupart des octets, sont de la tuyauterie. On ne lit donc jamais le fichier
  entier : seulement la fin, depuis le dernier offset.

## Ce qui est décidé

1. **Pas de tiroir : le fil** (Q1, puis Q1bis). Les textes de terminal vont dans le fil existant (`#thread`), entre
   les messages. Avis impeccable : la règle d'ordre de priorité et le brief (« les messages de l'orchestratrice
   vivent dans le fil »). Un panneau en plus ou un mode caché éclaterait la conversation en deux endroits. Le
   panneau « Décisions prises » de g2 ne change pas.
2. **Contenu** (Q2 révisée, Q2bis) : ses textes de terminal, les messages de l'utilisateur (page **et** terminal),
   ses décisions, et une ligne de **déclencheur** « ← g1 » quand le compte rendu d'une session l'a fait parler, sans
   le contenu. Aucun appel d'outil, aucun résultat, aucun ⚠ d'outil, aucune réflexion. Rien n'est retiré du
   terminal ni du transcript.
3. **Décisions dans le fil** (Q4) : une décision prise s'affiche comme un message de l'utilisateur, avec choix et
   note (`toi · décision « Release 0.4.0 » → Attendre`, la note dessous). Elle figure aussi dans « Décisions prises » :
   le fil raconte, l'historique recense. La spec de g2 est corrigée en ce sens (e3e2fed).
4. **Rendu** (Q1bis) : texte de terminal en encre atténuée (`--muted`), légende « terminal », aucune nouvelle couleur
   (règle des emplois fixes), **hors non-lus**. Le gel au survol s'applique comme aujourd'hui. Seule une `reply` compte
   comme non lu.
5. **`reply` reste** (Q5) : `reply` pour ce qui est adressé à l'utilisateur ; le terminal se limite à une ligne
   d'état courte qui ne répète pas la `reply`. Phrase à ajouter au skill (`plugin/skills/control-room/SKILL.md`,
   l. 8-10), **pas encore appliquée** : « Ce que tu écris dans ton terminal remonte aussi dans le fil, atténué :
   une ligne d'état par tour, jamais la redite de ta `reply`. »
6. **Recopie** (Q6) : le serveur lit la fin du transcript suivi depuis le dernier point lu et ajoute à
   `conversation.jsonl` les lignes reconnues (`by: 'terminal'` pour ses textes ; `by: 'user', via: 'terminal'` pour les
   messages tapés ; un déclencheur). Le fil reste un seul fichier en ajout seul, continu malgré les `/clear` et les
   relais, et la page n'en lit toujours que les 50 derniers.
7. **Identification** (Q7, ADR 0001) : `claim` envoie `CLAUDE_CODE_SESSION_ID` ; le serveur retient
   `~/.claude/projects/*/<session_id>.jsonl`, qu'il trouve sans connaître la règle de nommage des dossiers. Après un
   `/clear`, le hook `SessionStart` de la même boîte de réception (empreinte du socket = celle de la déclaration en
   vigueur) fait suivre le `transcript_path` reçu, si et seulement si : le chemin est sous `~/.claude/projects`, le
   fichier se nomme `<session_id>.jsonl`, et ses lignes portent ce `sessionId`.
8. **Panne visible** (Q8) : si le transcript grossit mais qu'aucune ligne n'est reconnue pendant 3 fins de tour
   (hook `Stop` de l'orchestratrice), ou si le fichier suivi disparaît ou change de `sessionId`, une ligne d'alerte
   s'ajoute au fil, **une fois**, en encre rouge (`--ko-ink`), plus un événement dans « Pendant ton absence ». Exemple :
   « Ses textes de terminal ne sont plus lus (format du transcript changé ? Claude Code 2.1.331). Ses `reply` arrivent
   toujours. »
9. **Point de départ** (Q9) : la recopie commence à la fin du fichier au moment où le suivi commence (déclaration ou
   suivi après `/clear`). Le fil ne reprend jamais le passé d'un fichier ; ce qui précède reste dans le terminal.

## Sécurité et vie privée

- Lecture : `/api/state` exige déjà le secret de la page. Le secret des clients ne lit pas le fil, et ce changement
  ne lui donne aucune lecture nouvelle.
- Les textes recopiés sont des données de l'utilisateur, dans son dossier d'état, à côté des `reply`, et jamais dans
  le dépôt. Les résultats d'outils (fichiers lus, sorties de commandes, secrets éventuels) ne sont **jamais** recopiés.
- Faux suivi : voir l'ADR. Il est borné aux transcripts du même compte et entre dans le risque local accepté.
- Les textes sont rendus par le `md()` existant de la page, comme les `reply` (même échappement).

## Laissé au constructeur

- Déclencher la lecture : sur `Stop`/`UserPromptSubmit` de l'orchestratrice, sur une minuterie, ou par `fs.watch`. Une
  seule lecture à la fois, avec un offset persistant (fichier d'état) et le `uuid` de la dernière ligne recopiée.
- Une ligne coupée en fin de fichier (écriture en cours) se relit au tour suivant : n'avancer l'offset que jusqu'au
  dernier `\n`.
- Les décisions dans le fil (point 3) : les ajouter à `conversation.jsonl` au moment où la page répond
  (`/api/answer`), plutôt que de les relire dans le transcript, où elles arrivent comme message `control-room`, ignoré.
- `transcript_path` à ajouter à l'événement de statut (`lib/hooks.js`). Les hooks tournent depuis le cache du
  plugin : le changement ne prend effet qu'après une nouvelle version installée.
- La forme exacte des lignes de déclencheur et d'alerte, dans les règles de DESIGN.md.

## Non-objectifs

- Les sessions de travail : seul le terminal de l'orchestratrice remonte.
- Écrire dans le terminal depuis la page : on y répond toujours par la zone de saisie (boîte de réception).
- Remplacer le terminal : il reste la vue complète.
