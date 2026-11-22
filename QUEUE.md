# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8zcxAkbX2jCAXysk4, 2026-11-22, at v6.65)

**State:** live = **v6.65** on `main`, livecheck ALL PASS. Function `table` version 82 = `v6.65 · sage-v19`, stamped, `--check` OK.
**WIRE_V 48** (a held layer's `price`). DATA_VER sage-v19. 17 heroes. Session branch `claude/quirky-brahmagupta-2pr645` == main.
page.js 89/89 at 393x852 as of v6.63 (deps: `npm install --prefix <scratch>/pagedeps ...` per its header; v6.65 touched no UI).

**Shipped v6.65:**
- **Rules: a held play pays the price it was PLAYED at** (CR 5.1.6/5.1.7/5.1.10, quoted in judge.holdPlay and LESSONS "CR READINGS").
  v6.64's Frostbite was one input of a class: `execute` re-read the whole price at resolution. Rune Flash waiting with one Runechant,
  a second made at instant speed -> refunded 1 (silent); one destroyed (Runebleed Robe) -> charged 1 more. `holdPlay` records `price`,
  `execute` charges it (`_heldPrice`). Audit: `costOff` is only Seismic Surge (start of action phase), `nextTurn` taxes are born
  not-ready, so neither can be born in the window. A probe over the full ladder found 0 held plays whose price moved (the rule
  policy never did it; a person or Sharp could). Drill test/heldprice.test.js.
- **SPXOPPAMP:** Crucible of Aetherweave amps Iyslander's off-turn arsenal cast. 266 -> 279 of 768 (both chairs up), reason `oppArsAmp`.
- **Measured and dropped:** Spellfire Cloak paying for those casts — its {r} never unlocked one (0/111 windows; on == off over 384
  games). Its real value is SAVING a pitched card on an off-turn cast (a card for Arcane Barrier 1) — a payment-policy question.

**Earlier (v6.64):** Frostbite-in-the-window fix (`frostAt`), SPXOPPARS (Iyslander casts her arsenal on the opponent's turn),
Gravy's discard-cost pitch. Dropped then (do not retry as-is): Lyath's Suspense auras in the opponent's last window (127 -> 112).

**NEXT, in order:**
1. Weakest ladder seats (rule policy, 48 games each, v6.65 ladder): Viserai BW 22, Lyath 28, Iyslander 33, Gravy/Blaze 34 of 96.
   Lyath looks like a deck/halving ceiling; BW is strong under Sharp (the page's AI). Prefer correcting advice over chasing wins:
   run `never.js <hero> 1` for each and look for a printed play the call never offers.
2. Spellfire Cloak as a payment source on the opponent's turn (instead of pitching a card) — only if a census shows the off-turn
   pitch is often a card she needed. A/B per the habits.
3. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action, new). **An experiment can surface an engine
bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count** (v6.64's two fixes came from one). A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores. **A subGate is ON when its
env var is empty** — an experiment you do not ship must be deleted, not left gated. A new reason key moves test/explain.test.js's
unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves test/keycensus.test.js.
After pushing main, curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.
