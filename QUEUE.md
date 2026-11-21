# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xA52ADmXDnyNU3TXDV, 2026-11-21, at v6.56)

**State:** live = **v6.56** on `main`, livecheck ALL PASS. Function `table` version 64 = `v6.56 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/intelligent-galileo-46nta8` == main.

**Shipped this thread — v6.56, the AI spends what it held** (five gates, CHANGELOG has every number):
SPXPIECE (0-defence resource piece pays for the next play: Garland/Blossom), SPXGLISTEN (`judge.weaponPumpOf`; Glisten before the
swing, and a weapon ranks on printed power + its +1{p} counters), SPXBOOTS (`gaNextPiece`, `nonAtkHeld`: Boots -> non-attack keeps the
point -> attack), SPXCROWN (`discardDrawPiece`: Carrion Crown's discard is free when the ally plays from the graveyard), SPXPOLARITY
(`effects.lifeNow` / `judge.lifeGainOf`: a life gain is played when its "instead" is true). Ladder vs gates off: **Gravy 30 -> 40,
Boltyn 23 -> 28, Viserai BW 18 -> 21**; 0 refusals/violations/stalls. Drill: test/gearpolicy.test.js.

**Measured and RULED OUT this thread (don't chase again):**
- **Glisten at the close of the opponent's turn:** equal to the start of his own turn (counters last to HIS end phase either way).
- **Holding Arcane Polarity until it is worth 4** (and out of the attack reaction window): 80 -> 64 of 384. It clogs hand AND arsenal.
- **Gravy deploys allies before hand attacks:** 165 -> 143 of 384.
- Arakni's ladder dip with SPXPIECE on (47 -> 38) is the field: her own seat A/B'd level (164 vs 163).

**NEXT, in order:**
1. **The attacking reaction window casts the cheapest instant as a "pump"** (`reaction()` in sparring.js, `rxAttack`): when NOT
   defending there is no `defendsNow`-style filter, so any legal instant goes (that is how Polarity was spent for 1). The defending
   side was fixed by QUEUE v4 H8. A narrow test (life gains only) measured negative because it also held the card; try a filter of
   "affects this link" (a judge reader, `pumpsNow`) as its own gate, A/B several heroes — expect it to matter for Briar/Viserai/BW.
2. **Compass of Sunken Depths** (Gravy): legal on 433 opposing turns, used 0 ("{t}: look at the top card"). The AI uses no info;
   only worth it if the look feeds Sharp's mask (view.js). Probably skip.
3. **Gravy's Timesnap Potion** 63 / 2 and **Jittery Bones** 69 / 8; Boltyn's **Flat Trackers** 53 / 5 (destroy: Agility token).
   Run `never.js <hero> 1` first — the probe is ~1 min a seed.
4. Viserai BW is still bottom (21): Runehold Release 157 / 23 (destroy: Runechant) and Runechant of Lust/Sloth at opp turn 0 / ~40 —
   the latter is the suspense shape (expect negative).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min. **A subGate is ON when its env var is empty** — an experiment you do not ship must be
deleted, not left gated. A self-play fixture (a seed a drill replays) moves whenever a hero's policy moves: re-anchor it (search
seeds for the same key), never weaken it. After pushing main, curl until the page serves the new APP_VER, THEN livecheck — it fails
on the build handshake until `tools/supabase-deploy.js` has run.
