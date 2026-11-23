---
name: control-room
description: The stage manager's call desk in one dark browser tab, one cue in standby at a time, called with a single GO.
colors:
  blackout: "#0c0d10"
  worklight-panel: "#131929"
  well-blue: "#0f1422"
  rail-line: "#232d47"
  rail-line-soft: "#1a2236"
  script-paper: "#e9e6df"
  house-grey: "#8a90a3"
  go-green: "#35d07f"
  standby-amber: "#f2a93b"
  stop-red: "#ff4d42"
  away-blue: "#6f8cff"
  amber-ink: "#f2a93b"
  red-ink: "#ff7a70"
typography:
  headline:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  body-dense:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  meta:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Consolas, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
  key:
    fontFamily: "Consolas, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 600
rounded:
  pip: "2px"
  xs: "3px"
  sm: "4px"
  md: "6px"
  round: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "24px"
  xl: "40px"
components:
  panel:
    backgroundColor: "{colors.worklight-panel}"
    textColor: "{colors.script-paper}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  card:
    backgroundColor: "{colors.worklight-panel}"
    textColor: "{colors.script-paper}"
    rounded: "{rounded.md}"
    padding: "18px 24px"
  option:
    backgroundColor: "{colors.well-blue}"
    textColor: "{colors.script-paper}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  button-go:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.blackout}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-send:
    backgroundColor: "{colors.script-paper}"
    textColor: "{colors.blackout}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.script-paper}"
    rounded: "{rounded.sm}"
    padding: "7px 15px"
  test-answer:
    textColor: "{colors.script-paper}"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  test-answer-ok:
    textColor: "{colors.go-green}"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  test-answer-ko:
    textColor: "{colors.red-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  textarea:
    backgroundColor: "{colors.well-blue}"
    textColor: "{colors.script-paper}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  code-well:
    backgroundColor: "{colors.well-blue}"
    textColor: "{colors.script-paper}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  cue-light:
    backgroundColor: "{colors.go-green}"
    rounded: "{rounded.round}"
    size: "14px"
---

# Design System: control-room

## Overview

**Creative North Star: "La régie"**

The page is the stage manager's call desk. One cue sits in standby at a time, its light beside the caption, and it is called with a single GO. Around it the desk stays dark: a blackout ground (the house is dark, the tab lives on a second monitor in a dark room), panels lit by blue work light, recessed wells a shade deeper for anything the user types or reads as raw text. Paper-white script text, blue-grey for everything that can wait.

The desk refuses the grey dashboard of equal panels. The decision and the conversation own the left column; the right column holds the quieter panels in the user's order of importance (tests, plans in progress, what to build next, connected sessions last). Colour is not decoration here: each cue colour has one fixed job, so a glance from the side reads the state without reading a word. Density is that of a working tool (13.5 to 14.5px body, 11px tracked captions); only the decision's summary is large.

Stillness is a material property of this world. Nothing re-renders under the pointer or the reading eye: the decision card is never replaced while it is read, a card that vanished stays as a tombstone, the conversation and the right column freeze while hovered. Dark only, flat, no drop shadows.

**Key Characteristics:**
- Dark only: blackout ground, blue work-light panels, deeper wells.
- Four cue colours with fixed jobs; tints derived by `color-mix()` against the panel.
- One loud line (the 22px card summary); everything else is dense and quiet.
- 1px rails and tone separate surfaces; no elevation.
- Authored 16x16 SVG icons at 1.5 stroke, CSS-drawn chevrons; no glyph icons.
- French copy, keyboard-first: key digits printed on the controls.

## Colors

A blackout-and-work-light neutral base carrying four cue colours whose jobs never change.

### Primary
- **Go Green** (go-green): GO, OK, done. The filled GO button, the live cue light, the OK test answer, a finished session's dot, the plan progress bar, the Autoriser border on an approval.

### Secondary
- **Standby Amber** (standby-amber): your decision. The recommended option's border and key digit, the "recommandé" tag, the Proposition legend, the card meta line, an urgent card's name in "Ensuite", a session waiting on your decision, the unread count, text selection tint.
- **Amber Ink** (amber-ink): amber text on a panel. Currently the same value as Standby Amber; kept as its own token so text contrast can be tuned without moving the fill.

### Tertiary
- **Stop Red** (stop-red): approval and breakage. An approval card's border, the held cue light, a session waiting on your approval, the server alert banner, Refuser and Pas OK borders.
- **Red Ink** (red-ink): red text on a panel (approval meta, "Pas OK", lost connection, held message, send failure). Lighter than Stop Red for AA contrast on the work-light panel.
- **Away Blue** (away-blue): the away summary banner only.

### Neutral
- **Blackout** (blackout): page ground, the text on filled buttons, the band that masks scrolling content above the pinned Connectés panel.
- **Work-light Panel** (worklight-panel): every panel and the decision card.
- **Well Blue** (well-blue): recessed surfaces: options, textareas, command and code wells.
- **Rail Line** (rail-line): 1px panel and control borders, scrollbar thumb, empty progress track.
- **Soft Rail** (rail-line-soft): dividers between rows inside a panel (messages, board items).
- **Script Paper** (script-paper): primary text, focus ring, the picked option's border, the Envoyer fill.
- **House Grey** (house-grey): muted text, captions, timestamps, key digits at rest, hover border on controls.

### Named Rules
**The Fixed Jobs Rule.** Green is go / OK / done and progress; amber is your decision and the recommendation; red is approval and breakage; blue is the away summary and nothing else. A colour never borrows another's job, and a new state picks the job it shares or stays neutral.

**The Ink Rule.** Coloured text on a panel uses the ink tokens (Amber Ink, Red Ink); the fill tokens are for borders, dots, bars and filled buttons.

**The Token-Only Rule.** Every colour comes from the `:root` custom properties. Tints are `color-mix()` of a cue colour into the panel (10 to 12% for banner grounds, 40 to 70% for tinted borders), never new hex values.

## Typography

**Body Font:** Segoe UI (with system-ui, -apple-system, sans-serif)
**Label/Mono Font:** Consolas (with ui-monospace, monospace)

**Character:** The operating system's own sans, set dense, because the desk is a tool read at a glance; Consolas marks what is literal: ids, commands, key digits.

### Hierarchy
- **Headline** (600, 22px, 1.3): the decision card's summary only, max 46ch.
- **Body** (400, 14.5px, 1.5): recap and default text; recap max 72ch.
- **Body dense** (400, 13.5px): options, conversation messages, board items.
- **Meta** (600, 13px): the line under the card summary (agent and nature), in the kind's ink.
- **Caption** (400, 12px): hints, group titles, timestamps, counts, test answers.
- **Label** (700, 11px, 0.14em, uppercase): panel captions, the inline Proposition legend, the Commande / Outil label over a command well; the "recommandé" tag uses 0.1em.
- **Mono** (12.5px inline code, 13px/1.45 command well): ids such as `#K3F9`, commands, paths.
- **Key** (600, 14px Consolas): the digit printed at the head of each option.

### Named Rules
**The One Loud Line Rule.** Only the card summary is large. Panel captions stay 11px tracked caps in House Grey so the summary is the only thing the eye lands on from across the room.

**The Caption Not Eyebrow Rule.** Tracked caps name a panel or sit inline beside content (Proposition, recommandé); nothing sits in caps above a title. The card's nature goes on the meta line under the summary.

**The Tabular Rule.** Times, counts and ratios that update in place use `tabular-nums`.

## Layout

Two columns inside a 1360px max page: the left column fluid (decision card, then the conversation panel), the right column 420px (360px below 1180px), with 24px between them and 24px / 40px page padding (20px sides below 1180px). The right column is sticky at 20px, scrolls inside itself (thin scrollbar), and pins Connectés to its bottom, with a 14px blackout band above it so scrolling content fades into the gap instead of being cut against the frame. Left column gap 12px, right column gap 14px.

Below 860px the page becomes one column in the same priority order (decision, conversation, tests, plans, to build, connected), the right column flows with the page, and nothing is pinned. Under a coarse pointer the test answers grow to a 40px target.

Inside panels, rows are separated by Soft Rail dividers, not cards in cards. Options stack with 6px gaps; actions sit in one row with "Ensuite" (the queue) pushed to its right end on one line.

### Named Rules
**The Priority Order Rule.** The page order is the user's order of importance: decision, conversation, tests (OK / Pas OK / Clarifier), plans in progress, what to build next, connected sessions last and pinned. A new block takes its rank in that list, never the top by default.

**The Still Page Rule.** Nothing re-renders under the pointer or the reading eye. The card is never replaced while unanswered; a vanished card stays as a tombstone (dashed border, struck summary, muted cue) until dismissed; the conversation and the right column freeze while hovered or while a field inside has focus. Nothing auto-scrolls.

## Elevation & Depth

Flat. Depth is three tones and a rail: Blackout ground, Work-light Panel above it, Well Blue recessed into the panel, each edge a 1px Rail Line. The only `box-shadow` in the page is an inset 1.5px ring that draws a hollow dot (unarmed cue light, idle session); it is line drawing, not elevation. Focus is a 2px Script Paper outline offset 2px.

### Named Rules
**The No-Shadow Rule.** No drop shadows, glows or blur. Separate surfaces by tone and 1px rails.

## Shapes

Gently squared: 6px on panels, the card and banners; 4px on controls, options, wells and test buttons; 3px on inline code and key caps; 2px on bars and the square session pip. Circles are reserved for lights: the 14px cue light (with a 1px outline at 3px offset, like a lamp in its bezel) and the 8px session dots. Shape doubles colour in the session strip: round = the session lives its own life (grey working, hollow idle, green done), square = it waits on you (amber decision, red approval). A dashed border means absence: the empty state and the tombstone.

## Components

### Buttons
Few, flat, unmistakable.
- **Shape:** 4px radius, no border on filled buttons.
- **GO (primary):** Go Green fill, Blackout text, 800 weight, 0.06em tracking, label "GO" with the Entrée key legend; the only green fill on the page, present only when the card carries a proposition.
- **Envoyer:** Script Paper fill, Blackout text; the conversation's send.
- **Ghost (Autre / nuancer (N)):** 1px Rail Line border, Script Paper text; hover moves the border to House Grey.
- **Links (Historique, plus, refs):** bare House Grey text that turns Script Paper on hover.
- **Disabled during arming or when held:** the options and buttons drop to 45% opacity; they never disappear.

### Options (decision rows)
- Grid of a 34px key column and the text; Well Blue ground, 1px Rail Line, 4px radius, 9px 12px padding.
- Key digit in Consolas House Grey; label 600; detail House Grey 13.5px inline.
- **Recommended:** Standby Amber border and key digit, inline "recommandé" tag in Amber Ink caps.
- **Approval:** Autoriser with a 70% green border, Refuser with a 70% red border.
- **Picked (Maj+digit, note pending):** Script Paper border, key digit inverted (Script Paper ground, Blackout digit).

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Work-light Panel; Rail Line border; approval cards take a Stop Red border.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 18px 24px on the card, 14px 16px on panels.
- **Panel caption:** Label style in House Grey with the count at the right; on the right column the caption is a real button with a CSS-drawn chevron (down open, right closed).
- **Proposition:** not a box; a running line under a Rail Line rule, Amber Ink caps legend at its left.

### Inputs / Fields
- **Style:** Well Blue ground, 1px Rail Line, 4px radius, 10px 12px padding, inherited font, Script Paper caret, House Grey placeholder.
- **Focus:** border moves to House Grey plus the 2px Script Paper outline at 0 offset.
- **Command well:** same well, Consolas 13px, scrolls inside after 10 lines so Autoriser / Refuser stay near it.

### Banners
- 6px radius, 9px 14px padding, an SVG close at the right.
- **Away summary:** Away Blue at 12% into the panel, 40% blue border; the only catch-up mechanism.
- **Server alert:** Stop Red at 12%, full red border.
- **Send failure:** Stop Red at 10%, 45% red border (one step below the server alert).

### Test answers
- OK / Pas OK / Clarifier as 12px buttons, 1px border, 4px radius; OK in Go Green with a 55% green border, Pas OK in Red Ink with a 55% red border, Clarifier neutral. 40px tall under a coarse pointer.

### Session chips
- One wrapping line of 12.5px House Grey names with an 8px dot; waiting sessions get a 9px square pip and their name in the job's ink at 600. The caption count reads "N à toi" in amber (red if an approval is among them). A lost server drops the chips to 45%.

### Cue Light (signature)
The 14px lamp left of the card summary's first line, in a 1px outline bezel at 3px offset.
- **Off (arming):** hollow (inset 1.5px House Grey ring, Rail Line bezel) for 400ms after a card appears, 800ms for an approval; keys do not answer yet.
- **Green:** keys are live.
- **Red:** held, the server is lost; a Red Ink line replaces the hint.
- **Off on a tombstone.**
- Transition 320ms `cubic-bezier(.16, 1, .3, 1)` on fill and bezel; none under reduced motion.

### Named Rules
**The Cue Light Rule.** The lamp beside the title tells whether the keys answer: off while arming, green when live, red when the server is lost. Nothing else on the card blinks or moves.

**The Drawn Icon Rule.** Icons are authored inline SVG on a 16x16 grid, 1.5 stroke, round caps, `currentColor`, 12px rendered; chevrons are CSS-drawn. Never a Unicode glyph as an icon.

## Do's and Don'ts

### Do:
- **Do** keep the page dark only: Blackout ground, Work-light Panel surfaces, Well Blue for anything typed or literal.
- **Do** give each cue colour its one job: green go / OK / done and progress, amber your decision and the recommendation, red approval and breakage, blue the away summary only.
- **Do** derive tints with `color-mix()` against the panel and use the ink tokens for coloured text.
- **Do** keep the card summary the only large text (22px/600) and every panel caption 11px tracked caps in House Grey.
- **Do** double colour with shape in the session strip: round lives its own life, square waits on you.
- **Do** print the key on the control it triggers (option digits, "(N)", the Entrée legend on GO); the hint line carries only what no control shows.
- **Do** arm a new card before its keys answer (400ms, 800ms for an approval) and show it on the cue light.
- **Do** use `tabular-nums` for times, counts and ratios.

### Don't:
- **Don't** add drop shadows, glows or elevation; separate by tone and 1px rails.
- **Don't** re-render, replace, reflow or auto-scroll anything under the pointer or the reading eye; a vanished card becomes a tombstone, hovered columns freeze.
- **Don't** put a caps eyebrow above a title.
- **Don't** use a Unicode glyph as an icon; draw it in SVG.
- **Don't** add a light theme or "new" badges; the away banner is the only catch-up.
- **Don't** move a block above the decision card or out of the priority order.
