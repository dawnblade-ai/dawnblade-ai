# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xBJwLD8vUGmMy4KUA1, 2026-11-21, at v6.47)

**State:** live = **v6.47** on `main` (`git log origin/main -1`), livecheck ALL PASS (two-phone server game seated).
Function `table` version 46 = build `v6.47 · sage-v19`, stamped, `--check` OK. WIRE_V unchanged. **DATA_VER sage-v19.**
17 heroes. No unreleased work. Session branch `claude/adoring-edison-xzk7s2` == main plus nothing.

**Done this thread (v6.47, one release):**
- **Prism, Advent of Thrones OPENED** (17th hero). Readers 5–7 (Spectra CR 8.3.14, "loses and can't gain phantasm",
  Pierce Reality, Heralds' -1{p}, Lay Low, Herald of Judgment's lock, Luminaris' or-group) by a worker; the opening (pool,
  DATA_VER sage-v19, 40 census repins, each noted) finished here. **Found by the repins:** Ironhide Gauntlet dropped its
  quoted "When the combat chain closes, destroy this." (stronger than printed): now `breakAtClose` (test/ironhide.test.js).
- **UX overhaul started** — `docs/ux/UX-ROADMAP.md` is the plan (audit, what is built, steps 1–9; before/after shots in
  `docs/ux/`). Built: `EndPanel` (one result screen), `LifeHud` + `LifeNum` (life totals, flashes), tap feedback,
  `RailMore` (hand rail "+N"), board-pane fit on short phones, ONE primary loadout button named for the foe (it used to
  start the trainer with an AI hero picked). Roadmap steps 1–3 done, step 5 half (needs an engine hit/prevented fact
  on a chain entry, in `effects.js`).
- **Cheaper sessions:** `npm run quick` (inner loop, skips the server family, ~2.3 min vs ~5); `node tools/supabase-deploy.js`
  (cut + deploy + stamp; `--dry-run`); CHANGELOG.md trimmed to v6.30+ (54 KB, was 1.4 MB); this file (3 KB, was 209 KB).
- **Cup past 16 heroes** (CEO default, for the user to overrule): all heroes play the qualifier, the top 16 make the bracket.

**NEXT, in order:**
1. **UX roadmap step 4** (hero-select with art: check online, offline art is grey stand-ins), **step 5's second half**
   (chain-link hit/block/prevented flash: add the fact in `effects.js`, then the UI), then 6–9. One worker per step in a
   worktree works well: give it the roadmap and `npm run quick`; tell it NOT to touch engine/ while an engine worker runs.
2. **H-item: the AI never awakens a figment** (Prism wins ~44% of seated games without it). Measure per CLAUDE.md (SPX gate,
   3 seeds, then the ladder). Then Viserai BW's starvation (QUEUE-ARCHIVE "VISERAI BW POLICY": four leads tried, all null).
3. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
4. Wire budget: the opening snapshot is ~15.8 KB of 16384 (table.test.js); the next cut is `heroRec` (~1.2 KB/seat).

**ASK THE USER (decisions made by default this thread — overrule any):**
- The cup: every hero plays the qualifier, the top 16 make the bracket (tools/tournament.js).
- Prism opens as an AI seat too, though the AI never awakens (she wins 44% anyway).
- Spectra resolves at once (`spectra-trigger-at-once`, stated, table only): no stack layer of its own.
- Prism's loadout block is "Usurp the Shadow Throne" (both new decks came from that upstream branch) — confirm the product name.

**Cheap habits (measured this thread):**
- Agents in worktrees for independent work (one engine, one UI) halve the wall time; the CEO merges. Agents can hit the usage
  limit mid-task: commit their worktree as WIP and finish by hand (this thread did).
- A digest of failing drills, not raw output: `node --test --test-reporter=spec test/X.test.js | awk '/failing tests/{p=1} p'`
  then grep `actual:|expected:` lines. A census repin is read, annotated in the drill, and only then moved.
- Opening a hero moves ~40 census pins (pool counts, families). Budget a session for it, or do it in the same worker that
  built the readers.
