# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8sybtytAYZSGDYiE1 took over 2026-11-24 late, at v6.93; previous CEO session_013xG9xBhp1ZDNBkoYpUuM35)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.93** on `main`. Function `table` v138 = `v6.93 · sage-v19`, stamped; **livecheck ALL PASS** (now plays a
whole live REMATCH and takes its own seek wait back out of `seek_wait_log`). SQL **001..011** on the project (011 run
2026-11-24). WIRE_V 49, DATA_VER sage-v19, 17 heroes. Gates at v6.93: npm test 4600/4595/0/5, page.js 153/153, serverpage 401/0,
tapsweep 44/44.
**WORKERS OUT (Sonnet, briefs experiments/ui/TASK-S..V.txt):** S `session_013xG9x8DbXrpdtDWbNVJnmE` trainer prompt sweep + weekly CI (items 2+6) ·
T `session_013xG9x888sBosASnUZGyQae` match-found sound/title (3) · U `session_013xG9xAs667zrcqQiEeKrXZ` contrast tokens (4) ·
V `session_013xG9x8zLqJcDjVxXa7mnqk` own ranked history (5). Branches ship/<L>-*. Next letter: **W**.

**This CEO (seven releases, workers O P Q R; briefs experiments/WORKER-PROMPT-UI.txt + experiments/ui/TASK-*.txt):**
- **v6.87** (P) Leave takes the rematch ask back; table-cap line; `tools/rematchprobe.js` in livecheck + Deno rehearsal.
- **v6.88** (O) practice grid tidy while *Still looking*; `tools/perf-practice.js`: the heartbeat costs nothing measurable at 4x.
- **v6.89** (Q) *Players usually find a match in about N s*: 011 `seek_wait_log` (kind+seconds only) + `seek_wait_stats`
  (median of 24 h, n>=5, else nothing); rides the seek answer. **Any new LIVE seek probe must delete its own row** (livecheck's
  `probeWaitQuery`, pinned by test/livecheckwait.test.js).
- **v6.90** (P) Close a full table right on the rematch screen, then *Ask again* (`servertable.closeOwn`).
- **v6.91** (Q+P) the typical wait on the practice bar; **index.html now has 4 text/babel blocks** (script0 · trainer ·
  server UI · App+mount LAST); html-balance caps each at 450k (Babel's 500k note crashes the drives). Top-level statements use
  only EARLIER blocks' names; new components go in the small blocks.
- **v6.92** (R) `tools/promptsweep.js` (real games, every hero, 393+320): opt/arrows/tags to 44 px / xs; the zoom modal above
  sheets; the jump row's 43 px was REAL (border), now 45. O's audit: no feed line speaks to "you" (pin 19 is all prompts/refusals).
- **v6.93** (R) `promptsweep --inject`: all 8 prompt kinds x 17 heroes x 393/320 forced via real specs (612 sheets); a 4-option
  soak at 320 pushed CONFIRM off screen -> the sheet's list scrolls. page.js drill (153 screens).

**NEXT — UI/UX and matchmaking (each a release of its own):**
1. **A real-iPhone pass** (DESKTOP-TASKS.md) — now also: Leave withdrawing a rematch ask, the cap's Close + Ask again, the
   typical-wait line on the seek card and the practice bar, the prompt sheets at 320 (iPhone SE).
2. The **trainer** prompt sheets: `--inject` covers the TABLE only (the trainer's state is not on window); expose it or inject
   through Battle, then sweep all 17 heroes.
3. **Match found while practising:** the banner is silent — a short sound (sound is ON by default) + the tab title flashing,
   so a player in another tab or looking away does not miss the 2-minute window. Measure it does not fire for the AI game.
4. **Readability sweep:** text contrast (WCAG AA) and minimum sizes on every screen in BOTH themes at 393/320 — tools/page-audit.js
   is the base; fix in the CSS tokens, not per element.
5. **Ladder / profile polish:** a player's own last ranked games (heroes, result, rating change) on the Ladder screen — data
   already in `recent`/`you`; no new table without a reason.
6. **Small:** `tools/promptsweep.js` and `tools/tapsweep.js` are by-hand tools — consider a weekly CI job (no live wire).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra
resolves at once; Prism's block named "Usurp the Shadow Throne"; hero select 6 across; sound ON; Find a match open to every
phone that can reach the server (ranked needs a name); *Find another match* keeps the kind; the honest lines live in a sheet.
NEW: a **rematch goes back to hero pick** (heroes are not kept), each player has **2 minutes** to say yes; the ranked window
**opens fully at 3 minutes**; *Play the AI while you wait* appears after **1 minute**.

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
a task file in experiments/ui/; it names the CEO session to report to — edit that id). Next letter: **W**.
