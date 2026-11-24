# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9UVm71YberhKraFde, 2026-11-24 evening, at v6.80)

**DIRECTION (user, 2026-11-24): the AI logic is on the BACK BURNER** ("it will always have room for improvement"); lead with
**graphical UI / UX polish and matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.
The AI-strength handoff that came before is the top entry of QUEUE-ARCHIVE.md (its census tools still live in `experiments/`).

**State:** live = **v6.80** on `main` (Find a match). Function `table` = `v6.80 · sage-v19`. SQL 001..009 run on the project
(009_seek.sql 2026-11-24, `ok` twice on real Postgres). WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.**
Function `table` v112, stamped, `--check` OK; **livecheck ALL PASS** with a real match through the queue on live (2026-11-24).

**This CEO (v6.80, SERVER S6.1):** matchmaking. `op:"seek"` (a queue: nobody waiting -> the function opens a table for the
seeker, who sits in chair one with a heartbeat every 20 s; somebody waiting -> sent to THEIR table) and `op:"looking"` (public
count). Page: *Find a match* leads the server group of *Find an opponent*; the server table screen has it too (ranked by the
switch); a ticking waiting card with *Stop looking*; a buzz + tab title when found. Drills test/serverseek.test.js (8),
`tools/sql-sab-009.js` (15), serverpage +22 rows, livecheck + rehearse play one real match through the queue.

**NEXT — UI/UX and matchmaking (pick in order; each is a release of its own):**
1. **Rematch / play again.** The end screen of a server game offers *Find another match* (same kind) and, when both agree,
   *Rematch* at the same table (a new deal, same two players). Today a player walks back through three screens.
2. **Waiting is lonely.** After ~60 s with nobody, the seek card offers *Play the AI while you wait* (a trainer game that a
   match interrupts with a banner) — or at least shows how long others typically wait. Measure what the phone can afford.
3. **Ranked pairing by rating** (oldest-first today): a window that widens with time waited (e.g. ±100, +50 per 20 s),
   decided in `seek_step` under the same lock; drill it like 009's self-check (sabotage file `tools/sql-sab-009.js`).
4. **Find an opponent is long.** Four honest-line paragraphs sit under the buttons; fold them into one "How each table keeps
   hands hidden" sheet. `tools/page.js` and `tools/serverpage.js` read those words: move the assertions with them.
5. **A real-iPhone pass** of the whole online path (DESKTOP-TASKS.md): find a match on two phones, a game, the end screen.
6. **POLISH.md condition 1 (the tap is never lost)** sweep with `tools/page.js` + `tools/page-audit.js` at 393x852 and 320.
7. **Open finding:** `tools/serverpage.js` card-database probe reads 0 missing tokens (its seeded Viserai game no longer
   reaches a token the sabotage removes). It fails identically on clean v6.79 (checked), so it predates S6.1. Give it a seed that mints a token, or check the token directly.

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; NEW: Find a match is open to
every phone that can reach the server (no name needed for friendly; ranked needs a name), oldest seek first, no rating window.

**How to run the shop / cheap habits (server work):** PGlite: `npm install --prefix <scratch>/pg @electric-sql/pglite`, then
`PGLITE_DIR=<scratch>/pg node tools/sql-pglite.js` and `tools/sql-sab-00N.js`. Deno rehearsal: `npm install --prefix
<scratch>/deno deno`, `DENO=<scratch>/deno/node_modules/.bin/deno node tools/supabase-rehearse.js --variant single|folder`.
Page drives: deps per tools/page.js's header into `<scratch>/pagedeps`, `NODE_PATH=/opt/node22/lib/node_modules`
(playwright), `PAGE_DEPS=<scratch>/pagedeps node tools/serverpage.js` (~5 min). SQL on live: `POST
https://api.supabase.com/v1/projects/fokcpzplomjsraquaaid/database/query` `{"query": <file>}` (the proxy injects the token;
send `Authorization: Bearer dummy`); run new SQL BEFORE deploying the function that calls it. **The first screen makes NO
request to the server while a player only looks** (serverpage's door rows): server reads belong on the server table screen.
A copy change on *Find an opponent* moves serverpage's text anchors (`no direct link needed`, `Server table Get matched`).
After pushing main: curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit
DEPLOYED.json, THEN `node tools/livecheck.js`. Workers = Sonnet via create_session with
`experiments/WORKER-PROMPT-PREAMBLE.txt` (it is AI-measurement flavoured: rewrite its middle for UI work). Next letter: **L**.
