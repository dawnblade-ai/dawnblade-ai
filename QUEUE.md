# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAFGZ4AhbF5jwTxmNc, 2026-11-25, at v6.99)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO: v6.99** — both user asks (2026-11-25) are live:
- **Title screen** (worker Z): first screen on EVERY load; four modes (Train against the Dummy · Play the AI · Find an
  opponent · Two phones, one table) + How to play / Judge's quiz / Trophies; *‹ Title* back everywhere; format note moved
  there. `?title=0` skips it (page.js `open()` default; CLAUDE.md says so).
- **Opponent before the sideboard** (worker Y): `FoePick` step after Battle, before the throw; Random drawn at the tap and
  named; Loadout shows the foe + *Change opponent*. **Joined (CEO):** `goBattle` in App reads `soloMode` — "ai" opens the step
  with a random hero drawn; "dummy" skips it (Back -> hero grid); null (title skipped) opens it on the Dummy.
- **AA:** serverpage row K1b4 (practising page closed mid-window); `TWO_MINUTES_MS` shared by found + rematch windows.
- Gates at v6.99: npm test 4609/4604/0/5; page.js 286/286 (6 join rows, both sabotages caught); serverpage 483/0 (it now
  takes ~600 s — give it a longer timeout than 595 s); trainchaos CLEAN 18 games (816 s — background it, 30 min limit);
  babel 4/4. Function `table` v150 = `v6.99 · sage-v19`, stamped; livecheck ALL PASS. SQL unchanged (001..012).
- DESKTOP-TASKS.md two-iPhone pass now has steps 6 (v6.94–v6.98) and 7 (title + opponent step).

**State:** live = **v6.99** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE** (Y, Z, AA integrated;
their sessions are idle). Weekly sweep `.github/workflows/tapsweep-weekly.yml` (Mondays 06:17 UTC) — glance at Monday's run.

**Polish noticed while joining (small, unassigned):** in *Play the AI* mode the opponent step still offers the Dummy tile
(harmless, but the mode says AI); serverpage's SMALL list shows the step's `.fname`/header at 8.5 px under the found
banner — fold into the text-size floor (NEXT 1).

**NEXT (each a release of its own):**
1. **Text-size floor:** board chrome is 6–9.5 px (`.b-typ` 6, `.hlbl`/`.wempty` 8, `fname` 8.5, `taunt` 9) — `READ_SMALL=1 node
   tools/tapsweep.js 393x852` lists them. Decide a floor (8?) with board-width measurements; gate it once chosen.
2. **Matchmaking:** a give-back costs the waiting player their queue place (only the clock carries). If live `seek_wait_log`
   shows give-backs matter, keep the place (SQL 013).
3. **Ladder/profile:** a player's own page (rating over their last games, favourite heroes) from `mine` — no new table.
   It is a natural fourth door on the new title screen.
4. The real-iPhone pass is written up (DESKTOP-TASKS.md, two-iPhone section, steps 1–7, title + opponent step included);
   ask the user to walk it when they have two phones to hand.

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; Find a match open to every
phone that can reach the server (ranked needs a name); *Find another match* keeps the kind; the honest lines live in a sheet; a
rematch goes back to hero pick, 2 minutes to say yes; the ranked window opens fully at 3 min; *Play the AI while you wait* after
1 min. NEW (this CEO): `--fs-xs` 9->10 px; red words coral #F5817B, fills #BA2C27; the found chime = two rising notes, title
flashes every 1 s only while the tab is hidden; Ladder shows your last 10; the found window is 2 min, *Not now* has no confirm,
the waiting player gives up after window+10 s of silence, the gave-back bar hides after 12 s.

NEW defaults this CEO (overrule any): the title shows on EVERY load; a random opponent is revealed on its own step before
the throw and the sideboard; the Dummy door skips that step; Back from the sideboard returns to the step (not the throw);
bottom tabs kept once past the title.

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
