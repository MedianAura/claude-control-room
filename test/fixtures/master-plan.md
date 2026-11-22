# Solo Power-Creep — Remaining Work

Restarted 2026-11-20 from `archive-2026-11-20.md` (Tasks 1-7, decisions, findings and everything done up to
2026-11-20). Only open items are kept here; look up context in the archive by its task/step name.

Build: `docker compose build ac-worldserver ac-db-import`, then `docker compose up -d ac-worldserver`
(`docker restart` keeps the old image). Log every config/SQL/Lua change in `F:\AzerothCoreCOA\SoloConquest`
(CHANGELOG.md) and commit there.

## In-game checks

- [ ] (user) Mob behaviour in CoA-reworked open-world zones (archive Task 7 Step 3): chase, evade, wander, flee,
  pathing around CoA buildings on Kalimdor, the Eastern Kingdoms and Outland. CoA's custom maps have no mmaps:
  straight-line movement there is expected.
- [ ] (user) Crucible plate + 50-60, when the main character gets there (archive Task 5 Step 3): absorb a plate
  item (no stock green plate below RequiredLevel 40), upgrade one 50-60 item to 100%, relog, compare health/mana,
  `.crucible stats`.
- [ ] (user) Crucible above 60: an item whose progression level is > 60 (`RequiredLevel` 0, `ItemLevel` > 60)
  must not stall silently; Task 1 only covers 50..60. Report what the UI shows.
- [x] (user) Quest log "send to Extra Quests" (fork `ebfae71ef..720e8c53d`, 2026-11-19, plan
  `.agents/plans/quest-log-demote/`; built, never recorded as checked in game): send a native quest to Extra
  Quests, it is not promoted back on its own; relog, every quest keeps its slot and the parked one stays parked.

## Crucible features (brainstorm before any code)

- [x] **Stats page pins**: done 2026-11-21, per character, accepted in game (Crucible `983b056..7f0d58d`,
  design and plan in `.agents/plans/crucible-stat-pins/`).
- [ ] **Quick Upgrade tab**: built 2026-11-21 (Crucible up to `a2f509d`, deployed to the client), tiers "All to
  40 / 60 / 80" that only take essences already at the tier below; reagents counted from bags + Abyssal vault.
  Design and plan in `.agents/plans/crucible-quick-upgrade/`.
  - [ ] (user) `/reload`, Quick Upgrade tab, `40 (73)`: Scan → 73 rows, pinned-stat gainers first, gold total;
    Upgrade → all done, `40 (0)` and `60 (73)` after. First try ran out of gold (96 copper left): re-test after
    farming, compare the footer "Gold: X needed, Y owned" with the bag gold (coverage looked off by x10).
  - [ ] (user) `60`: Scan → no-gain rows excluded, reagent line shows bags / vault / withdraw; withdraw by hand →
    dimmed rows light up; Upgrade → covered rows done, others refused with their reason.
  - [ ] (user) During a run: click an essence in the list → Upgrade tab, its button disabled; back to Quick
    Upgrade, run still going; Stop works.
  - [ ] (user) Crucible window tab bar was clipped next to Progression (screenshot 2026-11-21, minor): check it
    after the redeploy.

## To do

- [ ] **Profession filter "never absorbed"**: a filter in the tradeskill window (AdvancedTradeSkillWindow or the
  stock one) showing the profession items never absorbed in the Crucible.
- [ ] **Altoholic + DataStore on CoA**: get them working on the CoA client.
- [ ] **Missing keeps its position**: the Missing window does not keep its position after a drag and drop.
- [x] **Dungeon speed** (was "Install mod-sprint"): walking through dungeons takes too long. mod-sprint rejected
  (see `docs/decisions.md`); built as the local C++ module `modules/mod-dungeon-speed`: hidden aura
  `spell_dbc` 150101 (aura 129), run speed +62% live (dist 50) in dungeons and raids, out of combat only.
  Planned in `.agents/plans/dungeon-speed/`. In game since the build of 2026-11-21 15:44 (log `DungeonSpeed:
  enabled, +62% …`).
  - [x] (user) 5-man dungeon out of combat: run speed ~×1.62, no aura icon, no client error.
  - [x] (user) Pull a mob: speed drops at once; after the fight it comes back, not faster than before.
  - [x] (user) Sprint, Dash, Aspect of the Cheetah or a Swiftness Potion (`.additem 2459`, +50%) in a dungeon:
    ~243% out of combat (1.62 × 1.5), 150% outside. 162% means they don't stack.
  - [x] (user) Leave the dungeon: normal speed. Log out inside, log back in: speed applied again.
  - [x] (user) Die and resurrect inside: no speed while dead, back once alive and out of combat.
  - [x] (user) Manastorm run: speed applies between packs.
  - [x] (user) `.reload config` with `DungeonSpeed.Percent = 100` inside a dungeon: changes without leaving;
    set back to 62.
- [ ] **Bag scan for quest starters and unknown recipes**: an easy way to see bag items that start a quest
  and/or recipes the character can learn and does not know yet.
- [x] **Gathering yield x3 (Ore, Herb, Cloth, Woodcutting, Skinning)**: local C++ module
  `modules/mod-gathering-yield` (`97cfdb9..0bb5be1`), x3 at loot time, one rate per category in
  `serverconf/modules/gathering_yield.conf`, fishing left at 1x. In game since the grouped build of 2026-11-21
  15:19 (log `GatheringYield: Mining x3 … Cloth x3`). The old SQL-port notes are in the archive and
  `.agents/plans/gathering-yield/`.
  - [x] (user) Cloth from humanoids: every looted stack is a multiple of 3; the rest of the loot is normal.
  - [x] (user) Copper Vein: ~3x Copper Ore (stock 1–4 → 3–12); a gem, when one drops, comes as 3.
  - [x] (user) An herb node and a tree: herb ~3x; Forestwood 3–9; a Magical log, when one drops, comes as 3.
  - [x] (user) A skinned beast ~3x leather.
  - [x] (user) A world chest's non-cloth items unchanged.
  - [x] (user) A fishing pool stays normal.
  - [x] (user) `GatheringYield.Rate.Woodcutting = 1`, `.reload config`, a tree gives 1–3 again; set it back to 3.
  - [x] (user) Auto-gather: a node and a skinned beast gathered by `mod-auto-gather` give x3 like manual. Was 1x
    (loot had no source GUID); fixed in mod-auto-gather `95d210a`, live since the restart of 2026-11-21 18:21.
- [x] **Fly anywhere (CoA adaptation of mod-fly-anywhere)**: flying in the Eastern Kingdoms and Kalimdor with
  Expert Riding. Fork option `CoA.OldWorldFlight = 1` (live config), 1354 areas made flyable; plan in
  `.agents/plans/fly-anywhere/`. Gameplay scenarios pass (Docker, 2026-11-21): Stormwind (Expert flies, 150
  grounded), Eversong, Kodo Rock no-fly area. CoA gives Artisan riding at creation, so level 30 flies (380%).
  Flying works in game without `patch-Y.MPQ` (Barrens, Eversong Woods). Review fixes live since 2026-11-21 17:40
  (fork `dec6d6c30`): flagless Wetlands sub-areas no longer dismount flying-only mounts mid-air; scaling mounts
  (Celestial Steed) fly in Azeroth. Scenarios pass on that build: Stormwind (hybrid, flying-only, scaling; 150
  grounded), Eversong (flying-only), Upper Marshes (flagless). `patch-Y.MPQ` regenerated with the same 1354 areas.
  - [x] (user) Mount sound when flying high in Eversong Woods: still there with `patch-Y.MPQ` (2026-11-21). The
    mount climbs and moves, but moving forward up high sounds like hitting a wall. Known limitation, accepted by
    the user; likely the client's terrain flight bounds (MFBO) on map 530, not the area flags. `patch-Y.MPQ` kept.
  - [x] (user) Fly a while over a CoA-reworked area (Eastern Kingdoms or Kalimdor): no invisible ceiling, no
    forced landing.
  - [x] (user) No-fly area: fly into Kodo Rock (Red Cloud Mesa, Mulgore; around x -3017, y -717): the mount is
    removed. The Den has no terrain in CoA's maps.
- [ ] **Fishing x3: not done on purpose**: mod-autofish already brings full bags, so the gathering-yield module
  leaves fishing at 1x. Revisit only if fishing yield becomes a problem.
- [ ] **Quick Upgrade auto-withdraw from the Abyssal vault**: later, if withdrawing reagents by hand becomes a
  chore. Before the run, withdraw from the vault what the bags lack (`AbyssalStoragePlus:Withdraw`, client side,
  no rebuild), wait for the bags, then run. Quick Upgrade itself only shows bags + vault and what to withdraw
  (`.agents/plans/crucible-quick-upgrade/`).
- [ ] **Enchanting mats advisor (craft → disenchant path)**: Crucible mastery from 40% on burns enchanting mats
  (dusts, essences, shards) in bulk. An addon (+ probably a server module) that scans the character's known
  profession recipes and owned mats (bags, bank, Abyssal vault) and proposes the best path to get a given
  enchanting mat: which item to craft, then disenchant, at what material cost. Needs a full brainstorm first:
  where disenchant outcomes come from (client has no DE table; server `disenchant_loot_template`), what "best"
  means (cheapest mats, fewest crafts, uses what's already owned), and whether it plugs into Quick Upgrade's
  "missing N" reagent line.

## Observations (not investigated)

- [ ] Client tooltip for item 5344 shows RequiredLevel 2 / ItemLevel 2; `item_template` has 9 / 14.
