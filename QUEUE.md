# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8sybtytAYZSGDYiE1, 2026-11-25, at v6.98)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.98** on `main`. Function `table` v148 = `v6.98 · sage-v19`, stamped; **livecheck ALL PASS**. SQL **001..012** on
the project (012 = `ladder_get` + `mine`, run 2026-11-25). WIRE_V 49, DATA_VER sage-v19, 17 heroes. Gates at v6.98: npm test
4608/4603/0/5, page.js 219/219, serverpage 477/0. Weekly sweep `.github/workflows/tapsweep-weekly.yml` (Mondays 06:17 UTC; tap
sweep + both prompt sweeps; first run by hand 2026-11-25 SUCCESS, 20 min) — glance at Monday's run.
**WORKERS: NONE** (S T U V W X integrated and stopped). Briefs: experiments/WORKER-PROMPT-UI.txt + experiments/ui/TASK-*.txt.

**This CEO (five releases, workers S..X):**
- **v6.94** (U) `tools/contrast.js`: real rendered WCAG AA (alpha, opacity, composited bg) in the tap sweep, a readability row
  per screen; fixed in TOKENS: `--r` #BA2C27 (fills), new text inks `--rt`/`--bt` (red/blue WORDS), `--fs-xs` 10px. One theme.
- **v6.95** (S) trainer drill door: `?drill=1` -> `window.__battle` {state, raise} (absent otherwise, a page.js row proves it);
  `promptsweep --trainer` 612/612 clean; the weekly workflow.
- **v6.96** (T+V) match found: `found` chime (Sfx CUES), title flash while hidden. *Your last ranked games* on the Ladder (SQL 012).
- **v6.97** (W) readability rows on every server screen in serverpage.js; `--rt` -> #F5817B.
- **v6.98** (X) the found-match window: *join within 1:42* countdown, *Not now*, expiry gives the seat back (`closeTable`); the
  waiting player is told, and goes back to looking (same kind, clock carries on) on close or window+10 s of silence.
- **Merging tip:** workers each repin slicecensus's phasebar slice from the same base — the deltas ADD; run the file to confirm.
  Generated CR-INDEX.md conflicts: take either side, `npm run crindex`.

**NEXT — UI/UX and matchmaking (each a release of its own):**
1. **A real-iPhone pass** (DESKTOP-TASKS.md; add these there): Leave withdrawing a rematch ask; the cap's Close + Ask again;
   the typical-wait line; prompt sheets at 320 (SE); the new inks (does coral red read as red?); the found chime on iOS
   (Web Audio needs a prior tap — is the context unlocked by then?); the countdown + *Not now*; the Ladder's own-games card.
2. **Text-size floor:** board chrome is 6–9.5 px (`.b-typ` 6, `.hlbl`/`.wempty` 8, `fname` 8.5, `taunt` 9) — `READ_SMALL=1 node
   tools/tapsweep.js 393x852` lists them. Decide a floor (8?) with board-width measurements; gate it once chosen.
3. **Found-match late path:** "the practising player closed the page" (B gives up after window+10 s) is code-covered, not driven
   — add a serverpage row (close A's page mid-window).
4. **Matchmaking next:** a give-back currently costs the waiting player their queue place (only the clock carries). If live
   `seek_wait_log` shows give-backs matter, keep the place (SQL 013). Also consider: rematch/found windows from one constant.
5. **Ladder/profile:** a player's own page (rating over their last games, favourite heroes) from `mine` — no new table.

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; Find a match open to every
phone that can reach the server (ranked needs a name); *Find another match* keeps the kind; the honest lines live in a sheet; a
rematch goes back to hero pick, 2 minutes to say yes; the ranked window opens fully at 3 min; *Play the AI while you wait* after
1 min. NEW (this CEO): `--fs-xs` 9->10 px; red words coral #F5817B, fills #BA2C27; the found chime = two rising notes, title
flashes every 1 s only while the tab is hidden; Ladder shows your last 10; the found window is 2 min, *Not now* has no confirm,
the waiting player gives up after window+10 s of silence, the gave-back bar hides after 12 s.

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
a task file in experiments/ui/; it names the CEO session to report to — edit that id). Next letter: **Y**.
