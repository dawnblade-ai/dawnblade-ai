# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xA6vFW9WwQ3FBuhVEU, 2026-11-28, at v7.23)

**THE USER'S DIRECTION (2026-11-27/28): CRESCENDO — the release UI**, and this thread: "establish the framework that
will elevate this to a timeless addicting competitive game". "Out with the old, in with the new — push push push."
Its own handoff is **`docs/crescendo/README.md` on main**: START THERE.

**SHIPPED THIS CEO (three releases, all live, livecheck ALL PASS):** **v7.21** the CRESCENDO build lands on main
(`play.html` beside the classic page, which is still the default). **v7.22** THE CIRCUIT (`ui/circuit*.js`,
SCREENS-CIRCUIT.md C1–C9): Your record, hero mastery, the Road through every AI hero, Today's challenge (one deal per
UTC day for everyone), the ladder, the result plate; plus the engine's effects context built once per db
(`judge.withFx`; self-play byte-identical). **v7.23** ranked from play.html (FRIENDLY | RANKED on F3, no coach at a
table with a person, the rating plate on both phones).

**State:** live = **v7.23** on `main`; function v7.23 stamped. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. SQL
unchanged. **WORKERS: NONE.**

**NEXT:** (1) **`docs/crescendo/REVIEW-2.md`** — the second design review with real art, 25 findings, NONE fixed: the
table is ~45% empty while gear/arena read as ~30 px thumbnails, HIT FOR is tiny, life shows -1 at the end (check the
CR before clamping), the result pad has no "one more" hook, C2's portraits are washed out. A design pass then a build.
(2) **The real iPhone** on `play.html` (the user), then (3) **ask to make play.html the default** (the user leans yes).

**NEW ITEMS:** **S** WebKit T1 box-match flakes under CPU load (the world 4.2 px low; passes on a quiet machine; the
settle now waits for animations; still open). **S** the AI tick's worst is ~400 ms at 4x (on the Sharp bound; the
profile is flat: `legal`/`settle`/`stalemateCheck` inside search). **H** (standing) the coach loses slow attrition games
to the Dummy. The Worker still parses `data/pool.js` a second time. **S** Playwright's Chromium on file:// loses the
stored Ranked choice across a reload on ~4 of 15 runs (the page reads it back; a second page never sees it; no page code
removes the key); `tools/ui-flow-drive.js` is strict on WebKit and NOTES it on Chromium: prove it over http (or on a
real Android phone) and make Chromium strict again.

**NEEDS A RULING (defaults standing):** README Q1–Q14, SCREENS-CIRCUIT.md Q1–Q20 (LSS event names for the road's
tiers; UTC day; streak on, informational) and the ranked builder's: coach absent at friendly AND ranked (F8, applied).

**How to run the shop:** as before (QUEUE-ARCHIVE.md, top). This thread: Sonnet workers with disjoint file sets, the
CEO checkpointing their WIP on the stop hook; release gates run in a CLEAN `git worktree` of the release commit
(a worker editing `ui/` makes a shared-tree drive meaningless); `npm run play` compared byte-for-byte across releases.
