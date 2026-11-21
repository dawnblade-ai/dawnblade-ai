# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAAoQteCjpQ2SqFUcp, 2026-11-21, at v6.48)

**State:** live = **v6.48** on `main`, livecheck ALL PASS. Function `table` version 48 = `v6.48 · sage-v19`, stamped, `--check` OK.
**WIRE_V 45** (a chain entry gained `out`). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/stoic-rubin-3lscdg` == main.

**Done this thread (v6.48):**
- **UX step 5 finished:** every resolved chain link records `out` = hit / blocked / prevented (`effects.linkOutcome`, fed by judge's strike,
  the trainer's strike and the dummy's `takeIt`); the featured slot stamps it (`LinkStamp`), chain tiles dim/ring (test/linkout.test.js).
- **UX step 4 done:** roster tiles show the illustration, a picked-hero banner (`HeroBanner`) under the roster, the legend names every group.
  Kept 6 across (4 across pushes Battle off the first screen). Real art CAN be checked from the sandbox: curl the LSS S3 images into scratch
  and serve them through `page.route` (docs/ux/UX-ROADMAP.md §2 rows I-J say how).
- **The "AI never awakens" note was stale:** 12 seated Prism games, 10 awakenings (last-resort branch `heroAbility`, legal at 315/3014 decisions).

**NEXT, in order:**
1. **UX roadmap steps 6–9** (motion, prompt sheet pass, type tokens, sound) — docs/ux/UX-ROADMAP.md §3. Step 7 (prompt sheets) is the
   most player-visible. Drive with `tools/page.js`'s `open()`; play a card from the rail = tap, then tap the PEEKED tile again
   (re-measure its box: the peek lifts it), and confirm "Pitch & play" once the status line says covered.
2. **H-item: awaken timing for Prism** (an earlier awaken, Suraya's Ward 4 / attack): SPX-gate, 3 seeds, then the ladder. Then Viserai BW's
   starvation (QUEUE-ARCHIVE "VISERAI BW POLICY").
3. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
4. Wire budget: opening snapshot ~15.8 KB of 16384 (table.test.js); next cut `heroRec` (~1.2 KB/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4.

**Cheap habits:** `npm run quick` inner loop (~2 min); a digest of failing drills (`--test-reporter=spec | awk '/failing tests/{p=1} p'`);
a UI change that grows `<style>` moves `slicecensus`'s phasebar pin (read, note, repin). After pushing main, wait for Pages to serve the
new APP_VER BEFORE `livecheck.js` (curl the page until it does), or the handshake rightly refuses the mixed builds.
