---
name: control-room
description: A still, glanceable control tower in one browser tab for an orchestrator and its Claude sessions.
colors:
  tower-night: "#111214"
  console-slate: "#1a1c20"
  graphite-rule: "#2a2d33"
  screen-white: "#e7e7ea"
  instrument-grey: "#9a9ca3"
  runway-amber: "#e0a84f"
  amber-wash: "#2b2418"
  clearance-green: "#6cc28b"
  hold-red: "#e0645b"
  radar-blue: "#5b8def"
  amber-ink: "#e0a84f"
  red-ink: "#f08a80"
  tower-night-light: "#f5f4f1"
  console-slate-light: "#ffffff"
  graphite-rule-light: "#e3e1dc"
  screen-white-light: "#1c1c1e"
  instrument-grey-light: "#6b6b70"
  runway-amber-light: "#b4741a"
  amber-wash-light: "#fbf2e2"
  clearance-green-light: "#2f8a52"
  hold-red-light: "#c0453c"
  radar-blue-light: "#2f63c9"
  amber-ink-light: "#8a560c"
  red-ink-light: "#a5352d"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  body-dense:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.1em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
rounded:
  lamp: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  option: "9px"
  banner: "10px"
  lg: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "26px"
components:
  panel:
    backgroundColor: "{colors.console-slate}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.console-slate}"
    rounded: "{rounded.lg}"
    padding: "20px 22px"
  button-primary:
    backgroundColor: "{colors.runway-amber}"
    textColor: "#111111"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  button-ghost:
    textColor: "{colors.instrument-grey}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  option:
    textColor: "{colors.screen-white}"
    rounded: "{rounded.option}"
    padding: "10px 13px"
  option-recommended:
    backgroundColor: "{colors.amber-wash}"
    rounded: "{rounded.option}"
    padding: "10px 13px"
  agent-badge:
    backgroundColor: "{colors.graphite-rule}"
    textColor: "{colors.screen-white}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  queue-pill:
    backgroundColor: "{colors.console-slate}"
    textColor: "{colors.screen-white}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  textarea:
    backgroundColor: "{colors.tower-night}"
    textColor: "{colors.screen-white}"
    rounded: "{rounded.md}"
    padding: "10px"
---

# Design System: control-room

## Overview

**Creative North Star: "La tour de contrôle"**

The page is a control tower seen from the side: a second monitor that stays lit while the user works on the main one. Like flight strips on a controller's desk, each session is one quiet line that changes in place, and only one clearance is handed over at a time. The tower never shouts; it holds. Whatever arrives while the user is reading waits its turn in plain sight.

The look is a dark, flat instrument panel. Surfaces separate by tone and a single hairline, not by shadow. One warm amber carries attention, red marks what holds on the user, green clears, blue reports. Type is the system stack at a compact operational density: the decision summary is the only large text, every section heading is a small uppercase caption. Light mode exists and follows the OS (`prefers-color-scheme`); dark is the reference.

Rejected by construction (see PRODUCT.md principles): anything that scrolls by itself, a card that changes while read, "new" badges scattered over the page.

**Key Characteristics:**
- Dark, flat, tonal layering; no shadows.
- One warm accent (amber) and three signal colors (red, green, blue), each with a fixed meaning.
- System font stack, 15px body, 11px uppercase captions, one 19px headline per screen.
- Two columns: the decision alone at the top of the left column; the session strip, then the plan cycle, in a sticky 380px column on the right.
- Keyboard affordances printed on the controls themselves (`1`, `2`… key caps, "(N)", "↵"); the hint line only says what no control shows.

## Colors

A near-black graphite base with a single runway amber and three signal lamps.

### Primary
- **Runway Amber** (light theme `#b4741a`): the "your move" colour. It marks a session waiting for your decision (square lamp, row tint, state word), the recommended option and its tag, the proposition block's border, the primary button, urgent queue pills and the card's "● urgent" tag. Text on amber grounds uses Amber Ink (`--accent-ink`, light `#8a560c`).
- **Amber Wash** (light `#fbf2e2`): the tinted ground behind amber content: recommended option, proposition block.

### Tertiary (signal lamps)
- **Hold Red** (light `#c0453c`): blocked or broken. Session waiting for an approval (square lamp, row tint, state word), approval card border, header status line ("connexion perdue", "⚠ alerte"), approval queue pill, Deny option, alert banners and the failed-send notice, error text, the "approbation / erreur" kind tag. Text on red tints uses Red Ink (`--ko-ink`, light `#a5352d`).
- **Clearance Green** (light `#2f8a52`): cleared or done. Allow option, "done" session lamp, OK hover on a test.
- **Radar Blue** (light `#2f63c9`): information only, the "while you were away" banner.

### Neutral
- **Tower Night** (light `#f5f4f1`): page ground, and the recessed well inside inputs, `code` and command blocks.
- **Console Slate** (light `#ffffff`): panels, the decision card, queue pills.
- **Graphite Rule** (light `#e3e1dc`): every 1px border and divider, progress-bar track, zebra on session rows (mixed at 35%).
- **Screen White** (light `#1c1c1e`): primary text.
- **Instrument Grey** (light `#6b6b70`): captions, activity text, timestamps, hints, ghost buttons, idle lamp.

### Named Rules
**The Lamp Rule.** In the session strip, colour means "waits on you": an amber square is your decision, a red square an approval blocking a session; living sessions stay neutral round lamps (grey working, hollow idle, green done). Elsewhere red only marks Deny and breakage, green clears, blue informs. Shape and the state word always double the colour. Tints are derived with `color-mix()` against `--panel` at 12–14% for banner grounds and 30–45% for their borders, never new hex values.

**The Token-Only Rule.** Every color comes from the ten `:root` custom properties, redefined once for light mode. The only literal is `#111` text on the amber button.

## Typography

**Body Font:** system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`)
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo, monospace`

**Character:** native and operational; the OS font keeps the page feeling like an instrument, not a website.

### Hierarchy
- **Headline** (600, 19px, 1.35): the decision summary on the card. One per screen.
- **Title** (600, 17px): the empty-state heading ("Rien à trancher").
- **Body** (400, 15px, 1.55): card recap, options, composer text.
- **Body dense** (400, 13.5px): session rows, right-column items, option details, queue pills (13px).
- **Label** (600, 11px, 0.1em, uppercase, Instrument Grey): panel headings and card section captions (Résumé, Options, Proposition). The agent badge is its 12px / 0.08em sibling on a neutral chip.
- **Caption** (400, 12px, Instrument Grey): timestamps, hint line, counts, key caps, kind tag, test buttons.
- **Mono** (13px; 12px for key caps): commands under approval, inline `code`, the `1`–`9` key caps.
- Timestamps and counts use `font-variant-numeric: tabular-nums` so they don't jitter as they update.

### Named Rules
**The One Voice Rule.** Only the card summary is large. Everything else is body, dense body or caption, so the eye lands on the decision first from across the desk.

## Layout

A centered grid, max 1280px, padding 22px 20px 60px: a fluid left column and a fixed 380px right column, gap 26px.

The left column carries the decision path and nothing sits above the card: only the away summary, which lands while the user was gone. In order: away summary, the card (with the failure notice and the "Envoyé" trace rendered inside the same slot), "Ensuite" queue, alerts, then one deliberate 26px interval before the composer and its closed-by-default history. Everything that belongs to deciding is 8px apart; the composer is the only generous break. At 1280x800 the card, its actions, "Ensuite" and the composer all fit the first screen.

The right column stacks the session strip, then À tester par toi, Plans actifs and TODO, 14px apart. It is `position: sticky` (top 20px) with its own scroll capped at the viewport. The three plan-cycle panels collapse by clicking their caption; the state persists in `localStorage`.

Below 980px the columns stack (left first) and the right column becomes static: no sticky, no inner scroll inside the scrolling page.

### Named Rules
**The Still Column Rule.** Nothing re-renders under the pointer or the focus. The right column skips updates while hovered or focused, and the session strip freezes its height while the pointer is over that column (a new session scrolls inside the strip). The displayed card is never replaced by another one: answered, it gives way to the next; gone without an answer from the page, it stays in place as a tombstone until "Continuer ↵". Later cards wait as pills in "Ensuite".

## Elevation & Depth

Flat. Depth is tonal: Tower Night ground, Console Slate surfaces, Tower Night again for recessed wells (inputs, code, command blocks), and a 1px Graphite Rule border on every container. There is no exception: waiting-on-you lamps differ by shape and row tint, not by a halo.

### Named Rules
**The No-Shadow Rule.** No drop shadows. Emphasis comes from border color (amber, red, green) and the Amber Wash ground, never from lifting a surface.

## Shapes

Softly rounded rectangles stepping down with size: 12px for panels, the card and the empty state; 10px for banners; 9px for options; 8px for buttons, text fields and command blocks; 6px for session rows, the agent badge and test buttons; 4–5px for inline code and key caps. Queue pills are full capsules. Session lamps are 9px circles; lamps that wait on the user are 10px squares (2px radius). Dashed borders mean "nothing to act on here": the empty state and the tombstone card are the only dashed lines in the system.

## Components

### Buttons
- **Shape:** gently rounded (8px), no border on primary.
- **Primary:** Runway Amber ground, near-black text, 600 / 14px, padding 8px 15px. Used for the validating action ("Go avec la proposition ↵", "Lu ↵", "Envoyer").
- **Ghost:** transparent with a Graphite Rule border and Instrument Grey text ("Autre / nuancer (N)", history 🕘).
- **Small test buttons:** 12px text, 1px 9px padding, 6px radius; hover tints border and text to green (OK) or red (Problème).

### Decision Card (signature)
- Console Slate, 12px radius, 1px border (Hold Red for an approval), padding 20px 22px.
- Top: neutral agent badge, then an optional kind tag: red for "● approbation" and "● erreur", Amber Ink for "● urgent" (same colour as its queue pill).
- Headline summary, then captioned sections: the tool well ("Commande Bash", or "Outil <name>" for non-shell input; mono, capped at 10 lines with its own thin scroll so Allow / Deny stay next to it), Résumé (bullets), Options, Proposition.
- **Options:** full-width rows, 9px radius, 1px border, a mono key cap column (26px) then label and grey detail. Hover/focus brightens the border to Instrument Grey. Recommended: amber border, Amber Wash ground, amber "recommandé" tag. Approval options: Allow has a green border, Deny a red one. **Picked** (Shift+digit, waiting for its note): Screen White border and an inverted key cap (Screen White ground, Tower Night digit), `aria-pressed`; the note placeholder names the option.
- **Proposition:** Amber Wash ground with a full 1px amber border (accent at 55%), 8px radius. No one-sided rule.
- Footer: action buttons, a hidden note textarea (N), and a grey hint line that appears only on decisions with options and says only "Maj+chiffre : choisir avec une note" (everything else is printed on the controls).
- **States.** *Arming* (400 ms, 800 ms for an approval) and *held* (server lost) both dim options and actions to 45%; held replaces the hint with a red "Réponses suspendues" line. *Tombstone*: the same card with a dashed border, the summary struck through in Instrument Grey, the reason (cancelled with the orchestrator's reason, approval expired, or answered elsewhere) and a single "Continuer ↵".

### Session Strip (signature)
- First panel of the right column. One grid row per session: 9px lamp, bold label (`clamp(100px, 22%, 190px)`, ellipsis, full label in `title`), grey activity, 40px right-aligned tabular time, 8px gaps. 13.5px, 6px radius, zebra on odd rows. Column widths never depend on content, so rows stay aligned.
- Lamps: grey dot working, hollow ring idle, green dot done; amber square + amber row tint + bold amber state word waiting for your decision; red square + red row tint + bold red state word waiting for your approval. The state word always shows in full and never shrinks; only the activity after it truncates. Header count reads "N à toi · total" (red when an approval blocks); the favicon becomes an amber or red square while something waits.
- Header status line (red, 12px, one line, ellipsis, full sentence in `title`): "hors ligne depuis HH h MM" when the server is lost (rows dim to 45%), "⚠ alerte · détail sous la carte" otherwise. Showing it never grows the header.

### Queue Pills
- "Ensuite" followed by up to five capsules (max 26ch, ellipsis), Console Slate with a Graphite Rule border; amber border if urgent, red if approval; "+N" for the rest.

### Banners
- 10px radius, padding 9px 14px, close ✕ pushed right. Away = blue tint, alert = red tint with solid red border, notice = red tint with a 45% red border (a breakage, quieter than the server alert). The notice (an answer that failed to send) is rendered with the card, inside its slot, never inserted above a card being read.

### Inputs / Fields
- **Style:** Tower Night well, 1px Graphite Rule border, 8px radius, 10px padding, inherited font.
- The composer is a grid: auto-growing textarea (44–200px), primary Envoyer, ghost history. Pasted screenshots show as 80px thumbnails with a round ✕.

### Right Column Items
- Group caption (12px, 600, grey), optional task sub-caption (12px, grey), then items separated by 1px rules at 13.5px. Each test or TODO starts with its citable `#ID` (mono 12px, grey, Screen White on hover; a click quotes it into the composer) and a weight mark (▲ high in Screen White, ▽ low in grey, nothing for medium). Detail and notes fold under a grey "▸ détail · N notes" toggle, notes stamped with a tabular date. Tests carry OK / Problème; KO swaps the buttons for an inline field. Plans show a right-aligned tabular done-over-total count and a 4px grey (Instrument Grey) progress bar on a Graphite Rule track. An unreadable board shows a red alert banner at the top of the plan cycle.

## Do's and Don'ts

### Do:
- **Do** take every color from the ten `:root` tokens and their light-mode redefinition; derive tints with `color-mix()`.
- **Do** keep colour for what waits on you: amber square = your decision, red square = blocked on your approval; everything else in the strip stays neutral.
- **Do** print the keyboard shortcut on the control it triggers (key caps, "(N)", "↵"); the hint line only carries what no control shows.
- **Do** use `tabular-nums` for any time, count or ratio that updates in place.
- **Do** keep section captions at 11px uppercase grey so the card summary stays the only loud text.

### Don't:
- **Don't** add drop shadows or elevation; separate by tone and 1px borders.
- **Don't** animate, auto-scroll or reflow content the user may be reading; the card and the hovered column hold still.
- **Don't** add "new" badges or highlight outlines to announce changes; the away banner is the only catch-up.
