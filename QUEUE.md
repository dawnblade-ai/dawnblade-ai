# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9AaVs72uwn8QKys7W, 2026-11-24 late, at v6.86)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.86** on `main`. Function `table` v124 = `v6.86 · sage-v19`, stamped, `--check` OK; **livecheck ALL PASS**
(now also proves the live function knows `op:"rematch"`). SQL **001..011** on the project (011 run 2026-11-24). WIRE_V 49
(unchanged: Rematch rides its own sealed `rematch` channel, not the game payload), DATA_VER sage-v19, 17 heroes.
**v6.87 SHIPPED (P, item 4): Leave takes the rematch ask back, cap line, live rematch probe in livecheck — function v126 stamped, livecheck ALL PASS.** Follow-up: inline Close buttons for the cap's open codes in RematchRow.
**v6.88 SHIPPED (O, items 2+3): practice grid tidy, practice measured at 4x (nothing to fix) — function v128, livecheck ALL PASS.**
**v6.89 SHIPPED (Q, item 5): "Players usually find a match in about N s" — SQL 011 run on live, function v130, livecheck ALL PASS. livecheck now deletes its own 0 s probe wait from seek_wait_log (Management API; WARN if unreachable) — any OTHER live seek probe must do the same.**
**v6.90 SHIPPED (P follow-up): Close a full table on the rematch screen, then Ask again — function v132, livecheck ALL PASS. O's feed-voice audit: 0 feed lines speak to "you" (pin stays 19).**
**v6.91 SHIPPED (Q+P): typical wait on the practice bar; trainer babel split into 3 blocks (trainer ~331k / server UI ~158k / App+mount ~12k; html-balance caps 450k each, mount last). New page code: top-level statements only use EARLIER blocks' names; new components go in the small blocks. Function v134, livecheck ALL PASS.**
**WORKERS OUT (CEO session_013xG9xBhp1ZDNBkoYpUuM35, 2026-11-24 eve):** O `ship/O-practice` (items 2+3) session_013xG9x91mB8js1JxFxUvTtU · P `ship/P-rematch` (item 4) session_013xG9x9W7FG6U7PY1jZdzei · Q `ship/Q-waitview` (item 5, SQL 011) session_013xG9xADdaJFbcBqyZcCLSp · R `ship/R-promptsweep` (item 6) session_013xG9xB1Bzw2ykQJmN9bTer. Briefs: experiments/WORKER-PROMPT-UI.txt + experiments/ui/TASK-<L>.txt. If this CEO died: read each branch and integrate.

**This CEO (four releases, workers L, M, N):**
- **v6.83 Rematch** (CEO): `op:"rematch"` in server/referee.js (seat key; game over; both asks within REMATCH_MS 2 min -> the
  completing player opens a NEW table of the same kind; both seats get its code by sealed push and in join/resync `rematch`;
  a lost race closes its orphan). servertable `rematch()/onRematch/askRematch`. Page `RematchRow` on the server end screen;
  App routes the code through TableScreen `again.rematch` -> `srvSit("join")`. `.bigbtn.alt` min-height 44 px. Drills
  test/serverrematch.test.js (7), test/serverrematchphone.test.js (2), serverpage RM rows.
- **v6.84 Ranked pairing by rating** (L): 010_rating_window.sql, ±100 +50/20 s on the LONGER wait, opens fully at 180 s (CEO
  default), tools/sql-sab-010.js 15/15, serverseek drill 9.
- **v6.85 Play the AI while you wait** (N): after 60 s on Find a match, a practice game while the search heartbeats; a
  *Your match is ready* banner with *Join them*. serverpage K1b (11 rows).
- **v6.86 The tap is never lost** (M): 44 px hit areas everywhere at 393 and 320 (one CSS block), `.reveal` scrolls when the
  end panel is too tall (320 + Rematch). New `tools/tapjudge.js` (real hit area via elementFromPoint) + `tools/tapsweep.js`
  (every screen, ~2 min); page.js now 133 screens; serverpage 364 rows.

**NEXT — UI/UX and matchmaking (in order; each a release of its own):**
1. **A real-iPhone pass** of the whole online path (DESKTOP-TASKS.md): find a match on two phones, a game, the end screen,
   **Rematch** both ways, *Find another match*, practice while waiting + the banner, the hands sheet.
2. **Measure practice-while-waiting** at 4x CPU throttle (tools/perf-page.js; N reasoned the cost, did not measure it).
3. **Practice mode is tidy:** the hero grid in practice still carries the lobby's format note and How to play below it; hide
   them while the *Still looking* bar is up.
4. **Rematch, the loose ends:** *Leave the table* after asking should take the ask back (today it goes stale in 2 min); a
   ranked player at their open-table cap gets a refusal sentence — check it reads well on the page; a full live rematch (two
   phones, a game, both ask) in livecheck instead of the op probe.
5. **Matchmaking visibility:** "how long others typically waited" (needs a server read: a small 011 view of recent seek
   waits, public numbers only), or a ranked "players looking near your rating" count.
6. **Sweep the rest with the new tools:** `tools/tapsweep.js` / `tools/page-audit.js` at 320 for every hero's prompts (M
   covered 3 table prompts and the trainer's); jump row reads 43 px by a half-pixel probe (left alone).

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
`<scratch>/pagedeps/node_modules/@babel/standalone` and transform both `text/babel` blocks. Run the two drives one after the
other, not at once (CPU). SQL on live: `POST https://api.supabase.com/v1/projects/fokcpzplomjsraquaaid/database/query`
`{"query": <file>}` (the proxy injects the token; send `Authorization: Bearer dummy`). **The first screen makes NO request to
the server while a player only looks** (serverpage's door rows). A copy change on *Find an opponent* moves serverpage's
text anchors (`no direct link needed`, `Server table Get matched`, the hands sheet's three lines). A CSS edit early in
index.html can move `test/slicecensus.test.js`'s pinned slice lengths: read the diff, repin the one number. After pushing
main: curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json,
THEN `node tools/livecheck.js`. Workers = Sonnet via create_session with `experiments/WORKER-PROMPT-PREAMBLE.txt` (rewrite
its middle for UI work). Next letter: **S**.
