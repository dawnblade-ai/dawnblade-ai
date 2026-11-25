# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAFGZ4AhbF5jwTxmNc, 2026-11-25, at v6.98)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**USER ASKS (2026-11-25, this thread) — the two headline features:**
- **A dedicated TITLE SCREEN** laying out the modes before character select (worker **Z**, brief experiments/ui/TASK-Z.txt).
- **Pick the opponent BEFORE the sideboard screen**, so a *random* opponent is revealed before you board (worker **Y**,
  TASK-Y.txt). Today `aiFoe` lives inside Loadout and "random" resolves only at Start.
- **Joining them (CEO, after both land):** Y and Z both edit `App()`; merge Z first, then Y, then wire the title's mode in:
  *Play the AI* -> hero pick -> the opponent step; *Train against the Dummy* -> hero pick -> skip the opponent step (Dummy).
  Rerun page.js + serverpage.js + trainchaos + tapsweep (393x852 and 320x568) on the joined tree; ship as ONE release
  (v6.99) or two if the merge is clean enough to land Z alone first.

**State:** live = **v6.98** on `main`. Function `table` v148 = `v6.98 · sage-v19`, stamped; livecheck ALL PASS. SQL **001..012**
on the project. WIRE_V 49, DATA_VER sage-v19, 17 heroes. Gates at v6.98: npm test 4608/4603/0/5, page.js 219/219, serverpage
477/0. Weekly sweep `.github/workflows/tapsweep-weekly.yml` (Mondays 06:17 UTC) — glance at Monday's run.
Unmerged doc commit: branch `claude/charming-clarke-pqna39` (a0419cc) adds the v6.94–v6.98 checks to DESKTOP-TASKS.md's
two-iPhone pass (step 6) — fold it into main with the next release (handoff item 1 of the last CEO, done).

**WORKERS OUT (Sonnet, report to this CEO session by send_message; if this session is gone, read their branches):**
- **Y** session_013xG9x9vtWG6wuXA7TjckBP -> `ship/Y-foefirst` (opponent before sideboard).
- **Z** session_013xG9xAFgbeR6Da7AgooLV6 -> `ship/Z-title` (title screen).
- **AA** session_013xG9xBZLmLcUGoJbgwyUAt -> `ship/AA-foundlate` (serverpage row: practising player closes the page
  mid-found-window; one constant for the rematch + found windows if they mean the same 2 min). Independent of Y/Z.
  **AA REPORTED DONE (12:46):** row K1b4 (5 checks, sabotaged), `TWO_MINUTES_MS` shared; npm test 4608/4603/0/5. It did NOT
  run page.js, the babel compile, tapsweep or the Deno rehearsal, and its serverpage run had ONE unrelated FAIL ("real
  loader … supabase-js from the CDN") — likely its scratch installed the latest supabase-js, not the pinned 2.115.0. Rerun
  all of them on the merged tree before shipping; land AA with Y/Z.
Check: `mcp__claude-code-remote__get_session` / `list_events`; `git fetch origin 'refs/heads/ship/*:refs/remotes/origin/ship/*'`.

**NEXT after Y/Z/AA (each a release of its own):**
1. **Text-size floor:** board chrome is 6–9.5 px (`.b-typ` 6, `.hlbl`/`.wempty` 8, `fname` 8.5, `taunt` 9) — `READ_SMALL=1 node
   tools/tapsweep.js 393x852` lists them. Decide a floor (8?) with board-width measurements; gate it once chosen.
2. **Matchmaking:** a give-back costs the waiting player their queue place (only the clock carries). If live `seek_wait_log`
   shows give-backs matter, keep the place (SQL 013).
3. **Ladder/profile:** a player's own page (rating over their last games, favourite heroes) from `mine` — no new table.
   It is a natural fourth door on the new title screen.
4. The real-iPhone pass is written up (DESKTOP-TASKS.md, two-iPhone section, steps 1–6); add the title screen and the
   opponent step to it once they ship.

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; Find a match open to every
phone that can reach the server (ranked needs a name); *Find another match* keeps the kind; the honest lines live in a sheet; a
rematch goes back to hero pick, 2 minutes to say yes; the ranked window opens fully at 3 min; *Play the AI while you wait* after
1 min. NEW (this CEO): `--fs-xs` 9->10 px; red words coral #F5817B, fills #BA2C27; the found chime = two rising notes, title
flashes every 1 s only while the tab is hidden; Ladder shows your last 10; the found window is 2 min, *Not now* has no confirm,
the waiting player gives up after window+10 s of silence, the gave-back bar hides after 12 s.

NEW defaults this CEO set in the briefs (overrule any): the title shows on EVERY load (not just the first); a random
opponent is revealed on its own step before the throw and the sideboard.

**How to run the shop / cheap habits (server work):** PGlite: `npm install --prefix <scratch>/pg @electric-sql/pglite`, then
`PGLITE_DIR=<scratch>/pg node tools/sql-pglite.js` and `tools/sql-sab-00N.js`. Deno rehearsal: `npm install --prefix
<scratch>/deno deno`, `DENO=<scratch>/deno/node_modules/.bin/deno node tools/supabase-rehearse.js --variant single|folder`.
Page drives: deps per tools/page.js's header into `<scratch>/pagedeps`, `NODE_PATH=/opt/node22/lib/node_modules`
(playwright), `PAGE_DEPS=<scratch>/pagedeps node tools/serverpage.js` (~5 min; page.js ~2.5 min). Babel check: require
`<scratch>/pagedeps/node_modules/@babel/standalone` and transform EVERY `text/babel` block (4). Run the two drives one after the
other, not at once (CPU). SQL on live: `POST https://api.supabase.com/v1/projects/fokcpzplomjsraquaaid/database/query`
`{"query": <file>}` (the proxy injects the token; send `Authorization: Bearer dummy`). **The first screen makes NO request to
the server while a player only looks** (serverpage's door rows). A copy change on *Find an opponent* moves serverpage's
text anchors (`no direct link needed`, `Server table Get matched`, the hands sheet's three lines). A CSS edit early in
index.html can move `test/slicecensus.test.js`'s pinned slice lengths: read the diff, repin the one number. After pushing
main: curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json,
THEN `node tools/livecheck.js`. Workers = Sonnet via create_session; UI/server work uses `experiments/WORKER-PROMPT-UI.txt` (point the worker at it plus
a task file in experiments/ui/; it names the CEO session to report to — edit that id). Next letter: **AB**.
