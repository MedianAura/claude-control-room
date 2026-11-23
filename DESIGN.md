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

<!-- impeccable:design-map -->
Name: control-room
Colors: primary: runway-amber #e0a84f; tertiary: clearance-green #6cc28b; neutral: tower-night #111214; primary: amber-wash #2b2418; tertiary: hold-red #e0645b; tertiary: radar-blue #5b8def (+4 more in the sidecar)
Fonts: ui-sans-serif (headline, title, body, body-dense, label); ui-monospace (mono)
Spacing: xs 4px, sm 8px, md 14px, lg 20px, xl 26px
Radius: xs 4px, sm 6px, md 8px, option 9px, banner 10px, lg 12px, full 999px
North Star: "La tour de contrôle"
Rules:
- The Lamp Rule. In the session strip, colour means "waits on you": an amber square is your decision, a red square an approval blocking a session; living sessions stay neutral round lamps (grey working, hollow idle, green done). Elsewhere red only marks Deny and breakage, green clears, blue informs. Shape and the state word always double the colour.
- The Token-Only Rule. Every color comes from the ten `:root` custom properties, redefined once for light mode.
- The One Voice Rule. Only the card summary is large.
- The Still Column Rule. Nothing re-renders under the pointer or the focus. Nothing sits above the card; a card gone unanswered stays as a tombstone until "Continuer".
- The No-Shadow Rule. No drop shadows.
Don't:
- Don't add drop shadows or elevation; separate by tone and 1px borders.
- Don't animate, auto-scroll or reflow content the user may be reading; the card and the hovered column hold still.
- Don't add "new" badges or highlight outlines to announce changes; the away banner is the only catch-up.
Do:
- Do take every color from the ten `:root` tokens and their light-mode redefinition; derive tints with `color-mix()`.
- Do keep colour for what waits on you: amber square = your decision, red square = blocked on your approval; everything else in the strip stays neutral.
- Do print the keyboard shortcut on the control it triggers (key caps, "(N)", "↵"); the hint line only carries what no control shows.
- Do use `tabular-nums` for any time, count or ratio that updates in place.
- Do keep section captions at 11px uppercase grey so the card summary stays the only loud text.
Full: .impeccable/design-full.md (read a section when you need its detail)
