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
   Coordination avec g3 (tiroir « chat de l'orchestratrice ») : s'il devient un tiroir, son lien précède
   « Historique » dans l'en-tête, il s'ouvre au plus près du fil, « Décisions prises » dessous ; les deux sont
   indépendants (ouverture non exclusive) et sans contenu commun. Le contenu d'une décision (choix, note) n'apparaît
   que dans l'historique ; le fil peut seulement signaler qu'une décision a déclenché un message de l'orchestratrice
   (ligne « ← décision « … » », proposée par g3, sans choix ni note).

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
