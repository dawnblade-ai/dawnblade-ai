# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xBabg1FM1NrVtAAD1y, 2026-11-21, at v6.49)

**State:** live = **v6.49** on `main`, livecheck ALL PASS. Function `table` version 50 = `v6.49 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/dazzling-wright-tsnh88` == main.

**Done this thread (v6.49):**
- **UX step 7 done (prompt sheets):** a `target` sheet drew NO cards (Confirm dark forever; no producer yet); the soak sheet printed a
  literal "{r}"; its running total is now a `PStat` (big "2/3 still gets through"); selection tags moved off the pitch pip.
  Every prompt kind can be rendered without a game: mount `PromptSheet` with hand-made `p` objects via `ReactDOM.render` inside
  `open()` (it is a page global). The script: `experiments/ui/sheets.js` on this branch.
- **Wire budget:** opening snapshot 15821 -> 15202 B (`rulesBuild` slims `heroRec.pr` to codes + back-face markers + `_first`).
- **H: awaken timing measured NULL:** instant hero ability first fired earlier (15/20 with an action point left, vs 6/17) but Prism won
  82 vs 86 of 192 (12 seeds). Patch: `experiments/awaken-first/`. `npm run play prism '' 12` takes ~1 min: A/B is cheap.

**NEXT, in order:**
1. **UX steps 6, 8, 9** (motion, type tokens, sound) — docs/ux/UX-ROADMAP.md §3. Step 8 is mechanical (inline fontSize -> `--fs-*`).
   Step 9 needs sound files we may legally ship (self-made or CC0, under `assets/`).
2. **AI ideas need a NEW angle** — Prism awaken (null), Viserai BW (four nulls, QUEUE-ARCHIVE "VISERAI BW POLICY"). Try a
   win-rate census per hero first (`npm run play '' '' 6`) and attack the weakest hero's numbers, not a guess.
3. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
4. Wire: next cut if needed is HZOOM (~500 B/seat; `_first` art could be re-derived).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4.

**Cheap habits:** `npm run quick` inner loop (~2 min). The full `npm test` is ~10 min: run it ONCE at the end, in the background, and
read failures with `node --test "test/*.test.js" > tap.txt; grep -n "^not ok" tap.txt` (npm test swallows `--test-reporter`). Source-
order pins exist for the policy (allyseat: hero ability AFTER the attacks) — a gated experiment that moves a branch trips them, so
keep experiments as patches. A `<style>` change moves `slicecensus`'s phasebar pin; a PromptSheet change moves promptctl's width pin.
page.js deps: `npm install --prefix <scratch>/deps ...` (its header), pass `deps:` to `open()`. After pushing main, curl the page until
it serves the new APP_VER, THEN `livecheck.js`.

