# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A developer who runs several Claude Code sessions in parallel (one per topic), coordinated by an "orchestrator"
session that relays decisions to them and their answers back to the sessions. First user: the repo's owner,
French-speaking, 20+ years of experience, on several projects (a game server, a wrestling game, work projects).
The plugin is meant to be published: nothing in it may assume one project, one domain or one person's setup.
Each user runs it locally for themselves; the page never serves more than one person.

## Product Purpose

Move the whole orchestrator relationship out of a terminal that scrolls too fast and into one browser tab:
decisions as cards (one at a time, with a recommendation), a one-line-per-session status strip, permission
approvals from the page, free text to the orchestrator (screenshots via Ctrl+V), and the TODO → active plan →
to-test cycle read from the project's master plan.

What the page is for, in the user's order of importance (the layout follows it):

1. Take a decision when one is waiting (decisions and approvals, one at a time).
2. Talk with the orchestrator, especially in reply to what she just sent: her messages and the user's live in
   one conversation thread, not in the decision slot.
3. See what is ready to test and answer fast: OK, Pas OK, or Clarifier.
4. See the plans in progress and how far along they are.
5. See what could be built next (TODO).
6. Last, and only as a nice-to-have: who is connected and what each session is doing.

Success: the user almost never returns to the terminal, and always knows where things stand after looking away.

## Positioning

Nothing moves under the user's eyes. A card never changes while it is read; what arrives meanwhile waits. A
permission approval can only come from a click in this page, never from another process, tab or Claude session.
The project's versioned master plan stays the single source of truth for tests and TODOs; the page reads and
ticks it, it never keeps a copy.

## Operating Context

- The tab lives on a **second monitor, always visible**, while the user works or tests on the main one, usually
  in a dark room with a desk lamp. It is read in peripheral vision and at a glance, then read up close when a
  decision is due.
- The user sometimes switches to another browser tab and comes back; on return after more than 2 minutes, one
  dismissible line summarizes what happened in between. No other "new" markers.
- Started each session from the user's own terminal (`control-room start`), which opens the page with a one-time
  key. Typically 2–3 working sessions plus the orchestrator.
- Projects plug in by paths given to `claim` (plans folder, board); nothing is hard-coded for a project.

## Capabilities and Constraints

- Plain Node built-ins, no dependencies, no build step. The page is a single file, `plugin/ui/index.html`.
- Windows 10 first, Node v24, Claude Code 2.1.330. Served on `127.83.82.1:4242`, desktop browser only.
- UI language: French.
- Keyboard-first: `1`–`9` pick an option (approval: 1 Allow, 2 Deny), `Entrée` accepts the proposal, `N` free
  answer, `Maj`+digit picks and adds a note, `Ctrl`+`Entrée` sends, `Ctrl`+`V` attaches a screenshot.
- Card fields: agent, summary, recap, options, proposition, recommended, urgent, free answer. Approval cards are
  prioritized in the same queue. Pending cards appear as upcoming markers, not a feed.
- Session states: working, waiting for a decision, waiting for an approval, blocked, idle.
- The conversation with the orchestrator shows its last exchanges in place; the history of answered cards stays
  closed by default.
- Security model is binding: client secret creates cards only; the page secret (memory + `HttpOnly` cookie) is the
  only one that answers, approves or ticks; `Origin` + `Host` checked on page writes.
- Approvals whose hook stopped polling for 90 s expire and lose their Allow button.

## Brand Commitments

None beyond the name "control-room" and the French UI copy already in the page.

## Evidence on Hand

- Brainstorm mockup: `F:\AzerothCoreCOA\.superpowers\brainstorm\269611-1795301586\content\layout-v2.html`.
- Design spec: `docs/superpowers/specs/2026-11-21-control-room-design.md`; master plan with usage feedback:
  `docs/superpowers/plans/_archive/2026-11-21-control-room.md`.
- No other users, testimonials or metrics; do not invent any.

## Product Principles

1. Stillness over liveliness: no auto-scrolling zone, no content shifting under a reading eye.
2. Glanceable from the side: state must read in peripheral vision on a second monitor; detail only when looked at.
3. One thing at a time: one decision visible, the rest waits in plain sight but quiet.
4. The page is the only hand that approves: affordances for approve/answer/tick are unmistakable and never
   triggered by anything but a deliberate user action.
5. The project files are the truth: the page reflects and edits them, never duplicates them.

## Accessibility & Inclusion

Full keyboard operation is a requirement (the shortcuts above), not a nicety.
