# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xBFTVGypYS8a5s157i, 2026-11-24 night, at v6.82)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.82** on `main`. Function `table` v116 = `v6.82 · sage-v19`, stamped, `--check` OK; **livecheck ALL PASS**
(2026-11-24, a real match through the queue). SQL 001..009 on the project (nothing new this session). WIRE_V 49, DATA_VER
sage-v19, 17 heroes. **WORKERS (CEO session_013xG9x9AaVs72uwn8QKys7W, spawned 2026-11-24 18:03): L ship/L-rating-window (NEXT 3, SQL 010) session_013xG9xAVpuhxsYPvo46VCU7 · M ship/M-tap-sweep (NEXT 5+6) session_013xG9x9phS7odKaeNo2rX11 · N ship/N-waiting (NEXT 2) session_013xG9xBJq9Cee5CJBN1WBHt. CEO: **v6.83 Rematch SHIPPED** (live, function v118 stamped, livecheck ALL PASS; no SQL). **v6.84 rating window SHIPPED** (010 run on live 2026-11-24; function v120; livecheck ALL PASS incl. a live rematch probe). N merged on the CEO branch, v6.85 gating. M still out.**

**This CEO (two releases, page only — no engine, rule, wire, AI or SQL change):**
- **v6.81 Play again** (NEXT 1, first half): a server game's end screen offers *Find another match* / *Find another ranked
  match*; one tap opens the server table screen already searching the same kind (`TableBoard` `onAgain` -> App `seekAgain` ->
  `TableScreen` `again`). A finished table does not count toward the cap (005). Also fixed the v6.80 open finding:
  serverpage's card-database probe sums three seeds (one seed no longer reached a token made through the database).
- **v6.82 Find an opponent is short** (NEXT 4): the three honest lines (server / direct / judged: who holds the deck) are
  one sheet, `HiddenHandsSheet`, behind *How each table keeps hands hidden*; words unchanged. `.bugrow .bigbtn` gets a
  44 px minimum (Got it was 37 px on How to play, JUDGE!! and the new sheet). page.js / serverpage.js / twophone.js open the
  sheet before they read those words. `test/slicecensus.test.js` repinned one slice (+16 chars, that CSS).
- Drives at ship: `tools/serverpage.js` 330/0, `tools/page.js` 89/89; each new row sabotaged and seen failing.

**NEXT — UI/UX and matchmaking (in order; each a release of its own):**
1. **Rematch at the same table** (the other half of old NEXT 1). Both players tap *Rematch* on the end screen; when both
   have, the referee deals a new game at the SAME table, same two players (a new seed half each, the lobby again or straight
   to hero pick). Needs: a referee op (e.g. `op:"rematch"`, per seat a flag on the row, decided under the table's version
   CAS like `frame`), a WIRE_V bump if the payload grows a key, a page control with "waiting for them to agree" + timeout,
   drills in the S6.1 style (test/serverseek.test.js shape; serverpage rows in the ranked drives, where `rankedKit` already
   carries the queue). Ranked rematch counts as a new ranked game. Decide: does a rematch keep heroes? (Default: back to
   hero pick, same as a fresh table.) If the referee change is too big for one release, ship the page half behind a check.
2. **Waiting is lonely.** After ~60 s with nobody, the seek card offers *Play the AI while you wait* (a trainer game that a
   match interrupts with a banner), or at least how long others typically waited. Measure what the phone can afford.
3. **Ranked pairing by rating** (oldest-first today): a window that widens with time waited (e.g. ±100, +50 per 20 s),
   decided in `seek_step` under the same lock; a self-check and sabotages like `tools/sql-sab-009.js`. Run SQL on the project
   BEFORE deploying the function.
4. **A real-iPhone pass** of the whole online path (DESKTOP-TASKS.md): find a match on two phones, a game, the end screen,
   *Find another match*, the hands sheet.
5. **POLISH.md condition 1 (the tap is never lost)** sweep with `tools/page.js` + `tools/page-audit.js` at 393x852 and 320.
   v6.82 fixed the sheet row; look next at every `.a` action-bar button and `.tblsw` at 320 wide.
6. **End screen at 320 wide:** a ranked server game's end panel now stacks rating change + Find another match + Verify + Leave;
   check nothing is pushed below the fold on a small phone (serverpage drives 393 only).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; Find a match open to every
phone that can reach the server (ranked needs a name), oldest seek first, no rating window; NEW: *Find another match* keeps
the kind (ranked after ranked); the honest lines live in a sheet, not under the buttons.

**How to run the shop / cheap habits (server work):** PGlite: `npm install --prefix <scratch>/pg @electric-sql/pglite`, then
`PGLITE_DIR=<scratch>/pg node tools/sql-pglite.js` and `tools/sql-sab-00N.js`. Deno rehearsal: `npm install --prefix
<scratch>/deno deno`, `DENO=<scratch>/deno/node_modules/.bin/deno node tools/supabase-rehearse.js --variant single|folder`.
Page drives: deps per tools/page.js's header into `<scratch>/pagedeps`, `NODE_PATH=/opt/node22/lib/node_modules`
(playwright), `PAGE_DEPS=<scratch>/pagedeps node tools/serverpage.js` (~5 min; page.js ~2.5 min). Babel check: require
`<scratch>/pagedeps/node_modules/@babel/standalone` and transform both `text/babel` blocks. Run the two drives one after the
other, not at once (CPU). SQL on live: `POST https://api.supabase.com/v1/projects/fokcpzplomjsraquaaid/database/query`
`{"query": <file>}` (the proxy injects the token; send `Authorization: Bearer dummy`). **The first screen makes NO request to
the server while a player only looks** (serverpage's door rows). A copy change on *Find an opponent* moves serverpage's
text anchors (`no direct link needed`, `Server table Get matched`, the hands sheet's three lines). A CSS edit early in
index.html can move `test/slicecensus.test.js`'s pinned slice lengths: read the diff, repin the one number. After pushing
main: curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json,
THEN `node tools/livecheck.js`. Workers = Sonnet via create_session with `experiments/WORKER-PROMPT-PREAMBLE.txt` (rewrite
its middle for UI work). Next letter: **L**.
