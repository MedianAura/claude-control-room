# Essai : écrire dans la boîte de réception d'une session (tâche 1)

Date : 2026-11-22 (UTC). Claude Code 2.1.330, Windows 10, session en mode auto.

## a. Format qui livre

Après la ligne d'authentification, une ligne JSON :

```
{"type":"auth","token":"<CLAUDE_CODE_MESSAGING_TOKEN>"}
{"type":"user","from":"control-room","message":{"content":"<texte>"}}
```

Champs lus par Claude Code (binaire 2.1.330, gestionnaire `[uds-messaging]`) : `type` (`"user"` ou `"control"`),
`message.content` (chaîne non vide, sinon ignoré), `from` (nom affiché, défaut `unknown`), facultatifs `priority`,
`session_id` (si présent, doit être celui de la session, sinon message jeté), `uuid`, `msg_id`, `file_attachments`.
Le canal ne renvoie rien : une écriture réussit même si le message est ignoré.

**Non documenté** : trouvé dans le binaire, peut changer à toute mise à jour.

Formats essayés qui ne livrent **rien**, sans erreur : texte brut, `{"type":"message","text":…}`, `{"message":…}`,
`{"content":…}`.

## b. Réception

La session inactive démarre un tour avec le texte tel quel (`SONDE control-room variante=user`), présenté comme
venant d'une autre session. Le hook `UserPromptSubmit` se déclenche avec `prompt` = ce texte.

## c. Environnement des hooks

`CLAUDE_CODE_MESSAGING_SOCKET` et `CLAUDE_CODE_MESSAGING_TOKEN` sont présents dans l'environnement d'un hook,
identiques à ceux de Bash (`\\.\pipe\LOCAL\cc-msg-<32 hex>`). L'entrée du hook donne aussi `session_id`, `cwd`,
`permission_mode`. La clé de session par canal est donc utilisable par les hooks et par Bash.

## d. Voie retenue : `listener`

- Processus **enfant** de la session (lancé depuis son Bash) : livré.
- Processus **non enfant** (créé par WMI, même jeton, même format) : **pas livré**, aucune demande affichée,
  aucune erreur. Le serveur autonome ne peut donc pas écrire directement dans la boîte de l'orchestratrice.

La livraison passe par `control-room listen`, lancé en arrière-plan par l'orchestratrice : il attend les messages
du serveur et les écrit dans sa propre boîte. Comme il peut être tué (Claude Code tue les shells d'arrière-plan
quand la mémoire manque), l'accusé de réception (`[cr:<id>]` renvoyé par le hook `UserPromptSubmit`) détecte la
panne ; voir les décisions de la tâche 6 dans le registre.
