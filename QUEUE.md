# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xCE5fBQAM6Mkv8rwdc, 2026-11-21, at v6.59)

**State:** live = **v6.59** on `main`, livecheck ALL PASS. Function `table` version 70 = `v6.59 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. Session branch `claude/nice-fermi-nw1gm0` == main.

**Shipped v6.59** (CHANGELOG has every number):
- **SPXRIDER** (`judge.riderPick` / `judge.riderLead`): Embrace Ursur's "banish a card from hand" sheet was declined 15/15, and
  a Gloomblade was swung BEFORE Embrace Ursur. Now a card that still plays from banish and fires a rider is banished, and
  Embrace Ursur leads while a payable Gloomblade waits. **Viserai BW, own seat, 12 seeds each chair: rule policy 76 -> 114 of
  384; Sharp (`SPXLA=all`) 92 -> 104.** Ladder clean. Drill test/embraceursur.test.js.
- First game points at the Coach's call once per phone (`coachSeen`, `.advnew`); page.js 83/83.
- Ruled out: Jittery Bones (Gravy) — never held while a turn ended; the point always went to a bigger or go-again play.

**NEXT, in order:**
1. **Sharp under-uses SPXRIDER** (+12 vs the rule policy's +38). Census Sharp's root picks (`SPXLA=all`, `SP.explain` keys) on
   Viserai BW turns where `J.riderLead` is true: does `laHit` pick a Gloomblade first? Its playout scores damage only to the end of
   the turn, so the Runechant (dealt later) may be under-counted, or the mask may hide the banish follow-up.
2. Viserai BW's other census rows (`experiments/census/never.js viseraibw 1`): Murmuring Gloomblade from banish 50/10,
   Bloodfrenzy from banish 44/15. Check the same way (what was played instead, never just legal-vs-used).
3. **Newcomer path:** the hero sheet could say each hero's play style in one line (data in HEROES, sourced from the precon's
   own product text, not invented prose). Drive at 393x852.
4. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). **A better census asks what was played INSTEAD**
(`experiments/census/instead.js <hero> <card>`, new): legal-vs-used counts flag cards that simply lost a fair ranking. Prompt answers
hide too: grep the census for `declineOptional` per sheet `src`. A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min (Sharp: prefix `SPXLA=all`, ~15 min at 12 seeds). **A subGate is ON when its env var is
empty** — an experiment you do not ship must be deleted, not left gated. After pushing main, curl until the page serves the new
APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.
