# Historique : une liste des décisions prises

Statut : conçu (grilling g2, 2026-11-24/25). Rien d'implémenté. Vocabulaire : `GLOSSARY.md`, section Cartes.

## Le problème

L'historique de la page (`#histPanel`, « Historique des réponses ») reçoit une ligne pour **toute** carte répondue :
`POST /api/answer` (`plugin/lib/server.js:109`) ajoute `{at, text}` à `history.jsonl`, `text` étant déjà mis en forme
par `cards.historyLine()` (`plugin/lib/cards.js:117`), sans le type de carte. On y trouve donc des décisions, des
approbations (`Autorisé — <commande>`) et des « → lu » sur les cartes `reply`/`error`.

État réel constaté (machine de l'utilisateur) : 48 lignes, dont 29 « → lu » (cartes `reply` d'avant le fil de
discussion, `server.js:124` n'en crée plus), 1 approbation, ~18 décisions. L'historique est surtout du bruit.

## Décisions

1. **Contenu : les décisions répondues, rien d'autre.** Seules les cartes `kind: 'decision'` en `status: 'answered'`.
   Sortent : les approbations (leur trace reste dans le terminal de la session), le « Lu » des cartes `error`, les
   décisions annulées ou expirées (une annulation est déjà signalée 30 min par `recentCancelled`). Une approbation
   n'est pas une décision (glossaire).

2. **Source : `cards/`, plus `history.jsonl`.** Le serveur construit la liste à partir des cartes enregistrées :
   décisions répondues, triées par `answer.at` décroissant, 30 au plus. `cards/` contient déjà tout en structuré
   (session, question, options, proposition, choix, note, heure) ; rien n'est purgé et `allCards()` est déjà relu à
   chaque `GET /api/state`. Les ~20 décisions passées sont dans `cards/` : la liste repart sans perte ni migration.
   `history.jsonl` n'a plus de rôle. Alternative écartée : un journal structuré séparé, qui ne se justifierait que si
   l'on purgeait un jour les cartes (non prévu) ; il faudrait alors le reconsidérer.

3. **Une ligne par décision.** `heure · session — question → choix`, la note en retrait dessous si elle existe ; la
   date s'ajoute à l'heure quand la réponse n'est pas d'aujourd'hui. Le choix suit `choiceLabel()` (option,
   « proposition acceptée : … », « réponse libre » avec le texte en note). Récapitulatif, options écartées et
   recommandation ne s'affichent pas ; ils restent sur disque.

4. **Nom et place.** Bouton « Historique » (`#histBtn`) inchangé dans l'en-tête du panneau Orchestratrice ;
   panneau titré « Décisions prises » (au lieu de « Historique des réponses »), fermé par défaut, sous le fil, comme
   aujourd'hui.
   Coordination avec g3 : pas de tiroir, les textes de terminal de l'orchestratrice vont dans le fil
   (2026-11-24-chat-complet.md) ; aucun autre panneau près de « Décisions prises ». ~~Le fil montre aussi les
   réponses de carte de l'utilisateur~~ : abandonné au shape du 2026-11-25, les décisions ne vont plus dans le fil
   (pas de doublon).

**Révisé au shape (2026-11-25), remplace la place du point 4 :** le bouton quitte l'en-tête de la discussion.
Placé là, il faisait lire la discussion comme « l'historique ». Il s'appelle « Décisions prises » et va dans
l'en-tête du panneau de la carte de décision : les décisions passées à côté de la décision en cours. Il reste là
quand aucune carte n'attend. Le panneau « Décisions prises » s'ouvre sous la carte, fermé par défaut. Le panneau
de discussion s'appelle « Discussion » (au lieu d'« Orchestratrice »).

## Affichage (shape Impeccable, 2026-11-25)

Mesuré sur les 46 décisions réelles : question 124 car. en médiane (185 max), session 18, choix 20 (166 max pour
une proposition acceptée), note sur 8 décisions sur 46 (251 max). À ~140 car. par ligne dans la colonne gauche, une
décision fait **deux lignes** en moyenne : « une ligne » (décision 3) veut dire une entrée, pas une ligne visuelle.

- **La question s'affiche en entier**, à la ligne si besoin, jamais coupée par « … » : c'est par elle qu'on
  reconnaît la décision cherchée, et Ctrl+F doit trouver ce qui se voit.
- **Le choix est l'ancre** : après `→`, couleur du texte principal, un peu plus gras ; heure (Consolas,
  `tabular-nums`) et session en muted. Pas de vert (le vert dit « go / OK », pas « tranché »).
- **La note** en retrait dessous, en muted (retrait seul, pas de filet).
- **Moitié de l'écran au plus** (`50vh`), avec son propre défilement : 30 entrées font ~1 700 px et poussaient la
  discussion hors de l'écran (vu sur la maquette).
- Heure seule aujourd'hui, « 22 nov 14 h 03 » sinon, dans une colonne étroite en Consolas.
- Maquette validée le 2026-11-25 (vraies décisions, 1440×900) avec celle de la discussion.
- **Rien ne bouge sous l'œil** : une décision arrivée pendant que le pointeur est sur la liste attend qu'il en
  sorte (même gel que le fil, `talkHover`).
- Vide : « Aucune décision prise. »

## Coût côté serveur et stockage

- `GET /api/state` : `recent` devient une liste structurée (`{at, agent, summary, choice, note}` ou équivalent)
  calculée depuis `allCards()`, déjà lu pour `pendingCards()`/`recentCancelled()` ; pas d'E/S en plus.
- Code mort à retirer à l'implémentation : `appendHistory`, `readHistory` (`store.js`), `historyLine` (`cards.js`),
  l'appel `server.js:109`.
- `history.jsonl` existant : laissé tel quel à cette étape (aucun fichier existant touché) ; son sort (effacé ou
  ignoré) se règle à l'implémentation.

## Ce qui devra suivre (hors de cette étape)

- `test/review.test.js` #6 attend une approbation dans l'historique : à réécrire (décision présente, approbation et
  « Lu » absents, ordre, 30 au plus).
- `docs/superpowers/specs/2026-11-21-control-room-design.md` : l. 128 (« seul endroit où le passé s'accumule » :
  désormais le passé *des décisions*) et l. 180 (les refus `PermissionDenied` vont dans `events.jsonl`, pas dans
  l'historique — déjà vrai dans le code).
- `PRODUCT.md` l. 64 (« history of answered cards ») : « history of decisions taken ».

Pas d'ADR : le choix est réversible (les cartes gardent tout) et sans compromis surprenant.
