# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xCkP4yVbvz1X7saGFP, 2026-11-21, at v6.52)

**State:** live = **v6.52** on `main`, livecheck ALL PASS. Function `table` version 56 = `v6.52 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/serene-hopper-di9us5` == main.

**Done this thread (v6.50–v6.52) — the UX roadmap is FINISHED (steps 1–9):**
- **v6.50 sound** (`Sfx`: hit thud / block clank / prevention hiss, synthesized with Web Audio, no files; `LinkSfx` beside `LinkStamp` on
  both boards; ♪ mute on the nav row, `dawnblade.sound`). **Type scale** `--fs-*` (166 sizes named), no inline fontSize left.
- **v6.50 rules: watery grave counted only blue ATTACKS** (`hist.blueGY` bumped in `fileAttack` alone). `playZoneWhy` now also reads the
  graveyard's `_gy` stamps. **AI `gravePlays` (SPXGRAVE)**: Gravy 61 -> 79 of 288 own-seat games.
- **v6.51 motion**: `Glide` + `FeatCard` fly the committed card from its rail tile to the featured slot (FLIP, 240 ms, 17 ms frames at 4x
  throttle, off under reduced motion). The trainer's coach now names graveyard plays.
- **v6.52 Lyath boos while defending** (`judge.defActGainNow`, `rxBoo`, SPXBOO): 117 -> 140 of 384 own-seat; ladder Lyath 30 -> 35.

**The census that found both AI wins** (`npm run play '' '' 6`, 1632 games, ~3 min, before v6.50): wins of 32 a seed — Briar 28.3, Kayo 25.3,
Dorinthea 24.5 ... Blaze 10.5, Lyath 9.2, Boltyn 8.2, Viserai BW 7.5, Gravy 7.2. **The method that worked twice:** for a bottom hero, count
what the AI NEVER does that `legal` offers (probe: tally actions by kind and zone over 16 games; then ask `legal` at each decision for the
missing kind). Gravy: zero graveyard plays. Lyath: hero ability legal ~every turn, used only on his own turn where half of it is dead.
Ruled out (don't chase): Lyath's wall (halving is applied at build), end-turn "holds" of resource gear (deliberate), Boltyn's charging
(long measured history in QUEUE-ARCHIVE, v5.68 H24).

**NEXT, in order:**
1. **Same method on Blaze (ladder 32), Viserai BW (20), Boltyn (27), Gravy (24)**: Blaze's hero ability is legal in 149 of 201 turns and used
   in 41 (an instant that makes a Wizard non-attack an instant — when does that pay?). Gravy's own ability (destroy a Gold: draw, discard)
   legal 31 turns, used 16. Gravy still bottom-3: Mage Master Boots held 16 times as "land nothing".
2. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
3. The UX roadmap is done; next UI work would be POLISH.md's bar or a phone pass on the real device (DESKTOP-TASKS.md).
4. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
**sound defaults ON** (a ♪ toggle mutes it; iOS's ringer switch also silences Web Audio).

**Cheap habits:** `npm run quick` inner loop (~2.5 min). The full `npm test` is ~10 min: run it ONCE at the end, and read failures with
`node --test "test/*.test.js" 2>/dev/null | grep "^not ok"`. A gated A/B on one hero: `SPXFOO=none npm run play hero '' 12` vs on, AND the
other chair (`'' hero 12`) — four runs in parallel take ~3 min. Source-order pins exist for the policy (allyseat now anchors on
`tag("heroAbility", ...)`); keycensus pins the judge-only parser readers. page.js deps: `npm install --prefix <scratch>/deps ...` (its
header); a board drive needs the coin screen: click `.rseatpick button` 0 before `.lo .actbar [data-start=...]`. After pushing main, curl the
page until it serves the new APP_VER, THEN `livecheck.js`.
