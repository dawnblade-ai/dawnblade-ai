# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9AaVs72uwn8QKys7W, 2026-11-24 late, at v6.85)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.85** on `main`. Function `table` v122 = `v6.85 · sage-v19`, stamped, `--check` OK; **livecheck ALL PASS**
(now also proves the live function knows `op:"rematch"`). SQL **001..010** on the project (010 run 2026-11-24). WIRE_V 49
(unchanged: Rematch rides its own sealed `rematch` channel, not the game payload), DATA_VER sage-v19, 17 heroes.
**WORKERS: M ship/M-tap-sweep (NEXT 5+6, session_013xG9x9phS7odKaeNo2rX11) — see the line below for whether it landed.**

**This CEO (three releases, workers L and N, M out):**
- **v6.83 Rematch** (CEO): `op:"rematch"` in server/referee.js (seat key; game over; both asks within REMATCH_MS 2 min -> the
  completing player opens a NEW table of the same kind; both seats get its code by sealed push and in join/resync `rematch`;
  a lost race closes its orphan). servertable `rematch()/onRematch/askRematch`. Page `RematchRow` on the server end screen;
  App routes the code through TableScreen `again.rematch` -> `srvSit("join")`. `.bigbtn.alt` min-height 44 px. Drills
  test/serverrematch.test.js (7), test/serverrematchphone.test.js (2), serverpage RM rows.
- **v6.84 Ranked pairing by rating** (L): 010_rating_window.sql, ±100 +50/20 s on the LONGER wait, opens fully at 180 s (CEO
  default), tools/sql-sab-010.js 15/15, serverseek drill 9.
- **v6.85 Play the AI while you wait** (N): after 60 s on Find a match, a practice game while the search heartbeats; a
  *Your match is ready* banner with *Join them*. serverpage K1b (11 rows).

**NEXT — UI/UX and matchmaking (in order; each a release of its own):**
1. **Integrate M** if it has not landed (ship/M-tap-sweep: POLISH condition 1 at 393 and 320, the end panel at 320 — it is
   taller since v6.83). Merge (no force), gates, release.
2. **A real-iPhone pass** of the whole online path (DESKTOP-TASKS.md): find a match on two phones, a game, the end screen,
   **Rematch** both ways, *Find another match*, practice while waiting + the banner, the hands sheet.
3. **Measure practice-while-waiting** at 4x CPU throttle (tools/perf-page.js; N reasoned the cost, did not measure it).
4. **Practice mode is tidy:** the hero grid in practice still carries the lobby's format note and How to play below it; hide
   them while the *Still looking* bar is up.
5. **Rematch, the loose ends:** *Leave the table* after asking should take the ask back (today it goes stale in 2 min); a
   ranked player at their open-table cap gets a refusal sentence — check it reads well on the page; a full live rematch (two
   phones, a game, both ask) in livecheck instead of the op probe.
6. **Matchmaking visibility:** "how long others typically waited" (needs a server read: a small 011 view of recent seek
   waits, public numbers only), or a ranked "players looking near your rating" count.

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
its middle for UI work). Next letter: **L**.
