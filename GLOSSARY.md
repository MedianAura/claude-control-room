# control-room

Salle de contrôle dans un onglet de navigateur : l'utilisateur y tranche ce que l'orchestratrice et les sessions
qu'elle coordonne lui soumettent.

## Cartes

**Carte** :
Ce que la page présente à l'utilisateur, une à la fois, en attendant son geste : une décision, une approbation ou
une erreur.
_Éviter_ : notification, demande

**Décision** :
Une question de l'orchestratrice à l'utilisateur, tranchée par un choix (une option, la proposition, ou une réponse
libre) et éventuellement une note. Une décision annulée ou expirée n'a pas été prise.
_Éviter_ : réponse, choix

**Approbation** :
L'autorisation ou le refus, par l'utilisateur, d'un outil qu'une session veut lancer. Ce n'est pas une décision.
_Éviter_ : permission, décision

**Historique** :
La liste des décisions prises, la plus récente d'abord. Ni approbations, ni messages, ni décisions annulées.
_Éviter_ : historique des réponses, journal

## Fil

**Fil** :
La conversation entre l'utilisateur et l'orchestratrice telle que la page la montre : ses messages adressés à
l'utilisateur, ses textes de terminal, les messages de l'utilisateur (décisions prises comprises, avec choix et
note) et les déclencheurs. Le terminal de l'orchestratrice reste la vue complète.
_Éviter_ : chat, chat complet, discussion, conversation

**Texte de terminal** :
Ce que l'orchestratrice écrit dans son propre terminal, hors appels d'outils et hors réflexion. Il apparaît dans le
fil, atténué, et ne compte pas comme non lu.
_Éviter_ : réponse, sortie, log

**Déclencheur** :
Une ligne du fil qui dit ce qui a fait parler l'orchestratrice quand ce n'est pas l'utilisateur, par exemple le
compte rendu d'une session (« ← g1 »), sans son contenu.
_Éviter_ : source, origine

## Déclaration et plans

**Déclaration** :
L'acte par lequel une orchestratrice se fait reconnaître du serveur pour un projet ; une seule est en vigueur à la
fois, la suivante remplace la précédente.
_Éviter_ : inscription (réservé aux sessions d'équipe), connexion

**Projet déclaré** :
Le projet nommé par la déclaration en vigueur ; c'est lui qui décide de ce que la page montre.
_Éviter_ : projet courant, dépôt

**Plan actif** :
Un plan que l'orchestratrice d'un projet a confié à une session et pas encore archivé. Il appartient à ce projet et
ne se montre que lorsque ce projet est le projet déclaré.
_Éviter_ : plan en cours, plan ouvert
