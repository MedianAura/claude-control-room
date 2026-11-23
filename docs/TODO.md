# control-room — plan maître

Format lu par `plugin/lib/plan-file.js` : entrées `- [ ] **Nom**` de premier niveau sous `## To do`.

## To do

- [x] **Annulation visible** : quand l'orchestratrice annule la carte affichée, la page passe à la suivante sans
  rien dire et ça ressemble à un bug. Afficher « Carte <titre> annulée par l'orchestratrice : <raison> » ;
  `cancel_decision` n'a pas de paramètre de raison aujourd'hui, à ajouter (MCP, route, `cards.js`).
- [x] **Plusieurs images par message** : la zone de saisie n'en garde qu'une (`shot` unique dans
  `ui/index.html`, champ `image` unique dans `POST /api/message`) ; en accepter plusieurs.
- [x] **Carte masquée au clic** : masquer la carte dès qu'on répond, la remettre si l'orchestratrice la repose.
  Évite le double clic quand on croit que ça n'a pas marché.
- [x] **Sessions déconnectées** : le bandeau ne montre que l'équipe (orchestratrice + inscrites) ;
  `release_session` retire un worker dont l'orchestratrice a fini.
- [ ] **Test de vie des sessions** : une session inscrite qui plante reste affichée jusqu'à 2 h. Piste : se
  connecter à son `CLAUDE_CODE_MESSAGING_SOCKET` (clé de la session) ; essai d'abord, pour vérifier qu'une
  connexion de sonde n'a pas d'effet sur sa boîte de réception.
- [ ] **TODO priorisé** : priorité par entrée, tri sur la page.
- [ ] **À tester repensé** : priorité, regroupement par tâche, identifiant unique par test (aujourd'hui
  l'identité d'un test est son texte normalisé).
- [ ] **Plans actifs dépliables** : déplier un plan pour voir ses tâches et étapes, pas seulement la progression.
- [x] **« À trancher » = la file** : le compteur 5/5 → 6/6 n'apporte rien ; afficher la file de ce que j'ai à
  faire.
- [ ] **Page soignée** : passe de design de la page avec les skills (`frontend-design`).
