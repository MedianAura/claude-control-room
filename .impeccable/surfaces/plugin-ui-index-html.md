---
version: 1
slug: "plugin-ui-index-html"
primary_target: "plugin/ui/index.html"
related_targets: []
---

# Surface brief: control-room page (plugin/ui/index.html)

Scope: the whole page, the only surface. Visitor mode: Operate.

Audience and job: one developer at a time, on their second monitor in a dark room, coordinating Claude Code
sessions through an orchestrator. Jobs in order: decide, talk with the orchestrator, answer tests (OK / Pas OK /
Clarifier), follow plans, see what to build next, and last who is connected. Constraints: single HTML file, no
dependencies, French copy, full keyboard operation, nothing moves under a reading eye.

Chosen direction: "La régie", the stage manager's call desk. Memorable moment: the cue light beside the card
caption lighting green the instant the keys go live, and the green GO.

Resolved since the brief: Clarifier cites the test's #id into the conversation (no server change); orchestrator
messages live in the conversation thread, which the server keeps in both directions. Added after the brief (0.4.0):
a context gauge (% of the session's context window) after each name in Connectés.

## Direction contract

THESIS: The page is the stage manager's desk: one cue in standby at a time, called with a single GO. It refuses the
category's grey dashboard of equal panels; the decision and the conversation own the left, everything else waits
in quieter panels on the right, in the user's order of importance.

OWN-WORLD: Blackout ground (#0c0d10) under work-light blue panels (#131929, 1px #232d47, 6px radius), recessed
wells in deeper blue. Paper-white text, blue-grey muted text. Cue-light colours with fixed jobs: green = go / OK /
done, amber = what waits on you, red = stop (approval, breakage). System sans, 11px tracked caps for captions, Consolas
for ids and key digits.

STORY: The user glances over, sees a lit cue and its caption, reads one decision, hits GO or a digit, then replies
to the orchestrator in the thread right below; on the right they tick tests, check plan progress and pick the next
build without leaving the page.

FIRST VIEWPORT: At 1440x900, left column (fluid, max 1360 page): the decision panel at top (caption with cue
light, 22px summary, recap, one-line options, proposition, GO + Autre, "Ensuite" inline in the footer), the
conversation panel directly under it (last exchanges, field, Envoyer). Right column 420px: À tester par toi (OK /
Pas OK / Clarifier), Plans en cours (bar + current task), À builder ensuite, Connectés as one line of dots, each name followed by its context %.

FORM: La régie, position 1 of my ordered list (the roll assigned 7, the user chose the pick); seed:86e6e4c701665753.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
