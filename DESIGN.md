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

<!-- impeccable:design-map -->
Name: control-room
Colors: primary: go-green #35d07f; secondary: standby-amber #f2a93b; tertiary: stop-red #ff4d42; neutral: blackout #0c0d10; secondary: amber-ink #f2a93b; tertiary: red-ink #ff7a70 (+7 more in the sidecar)
Fonts: Segoe UI (headline, body, body-dense, meta, caption, label); Consolas (mono, key)
Spacing: xs 6px, sm 10px, md 14px, lg 24px, xl 40px
Radius: pip 2px, xs 3px, sm 4px, md 6px, round 50%
North Star: "La régie"
Rules:
- The Fixed Jobs Rule. Green is go / OK / done and progress; amber is what waits on you (your decision, the recommendation, a session's context filling up); red is stop (approval, breakage, a session that must hand off and clear); blue is the away summary and nothing else.
- The Ink Rule. Coloured text on a panel uses the ink tokens (Amber Ink, Red Ink); the fill tokens are for borders, dots, bars and filled buttons.
- The Token-Only Rule. Every colour comes from the `:root` custom properties.
- The One Loud Line Rule. Only the card summary is large.
- The Caption Not Eyebrow Rule. Tracked caps name a panel or sit inline beside content (Proposition, recommandé); nothing sits in caps above a title.
- The Tabular Rule. Times, counts and ratios that update in place use `tabular-nums`.
- The Priority Order Rule. The page order is the user's order of importance: decision, conversation, tests (OK / Pas OK / Clarifier), plans in progress, what to build next, connected sessions last and pinned.
- The Still Page Rule. Nothing re-renders under the pointer or the reading eye.
- The No-Shadow Rule. No drop shadows, glows or blur.
- The Cue Light Rule. The lamp beside the title tells whether the keys answer: off while arming, green when live, red when the server is lost.
- The Drawn Icon Rule. Icons are authored inline SVG on a 16x16 grid, 1.5 stroke, round caps, `currentColor`, 12px rendered; chevrons are CSS-drawn.
Don't:
- Don't add drop shadows, glows or elevation; separate by tone and 1px rails.
- Don't re-render, replace, reflow or auto-scroll anything under the pointer or the reading eye; a vanished card becomes a tombstone, hovered columns freeze.
- Don't put a caps eyebrow above a title.
- Don't use a Unicode glyph as an icon; draw it in SVG.
- Don't add a light theme or "new" badges; the away banner is the only catch-up.
- Don't move a block above the decision card or out of the priority order.
Full: .impeccable/design-full.md (read a section when you need its detail)
