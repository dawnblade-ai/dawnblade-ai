# QUEUE ARCHIVE — superseded handoffs and the v1–v4 item lists (moved out of QUEUE.md on 2026-11-19, word for word). grep it, don't read it.

### PREVIOUS (CEO session_013xG9xAFGZ4AhbF5jwTxmNc, 2026-11-25, at v6.99)

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

### PREVIOUS (CEO session_013xG9xBFTVGypYS8a5s157i, 2026-11-24 night, at v6.82)

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

### PREVIOUS (CEO session_013xG9x9UVm71YberhKraFde, 2026-11-24 evening, at v6.80 — the first UI/matchmaking handoff)

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

### PREVIOUS (CEO session_013xG9xCCHmaDbKTPm38cqzb, 2026-11-24 afternoon, at v6.79 — the last AI-strength handoff)

**State:** live = **v6.79** on `main`, unchanged this session (nothing measured positive, so nothing shipped). Function `table` v110 =
`v6.79 · sage-v19`. WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS: NONE** (J and K reported, archived).

**This CEO (all DEAD, 0 refusals / violations in every run; files under `experiments/` on this branch):**
- **Arsenal search** (CEO, `arsenal-search-v679/`): Sharp picks the face-down card by playing each out through the foe's turn and its
  own next turn. -26 of 3264 (margin 3: -6, noise). The rule's "best attack face down" holds.
- **Pitch-choice search** (worker J, `j-pitchsearch/`): 64% of own-turn payments have a real alternative card, but the score cannot tell
  them apart (flat mu, own horizon ends after the draw-up): +8 of 6528 over 24 seeds, Gravy -21.
- **Hand worth by printed numbers** (worker K, `handworth/`): def-weighted hand in laEval -19; arsenal card by power -114 (Sharp hoards);
  the same def term in the block search -40.
- **Gravy is the canary, not a bug:** it lost in every arm because it leans on Sharp most: rule policy 23 wins of 384 vs Sharp 89.
- Chaos **d14 and d15 CLEAN** (289 games each, ~33.6k random legal moves). Next salt **d16**.
- v6.79's base reproduces exactly on main (dash 108, lyath 59, arakni 106): the `tgt` files in `search-shape-v678b/` ARE the v6.79
  base for seeds 0-11 (`*.tgt.txt`) and 12-23 (`*.tgt.s2.txt`). Reuse them; do not remeasure.

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours. (2) Blocked damage still costs the foe cards. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Making a step cheaper is
decision-identical by construction (sha256 the action logs). (6) A search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` 0. (7) `xargs -L1` splits on spaces: each ENV=val its own word; one result file per run.
(8) NEW: **Sharp's search is saturated in shape AND score.** Budget, horizon, mu, dets, targets (shipped), arsenal, pitch, hand
worth and gear have all been measured. Everything that looks past this turn's end or prices specific held cards LOSES. A new choice
the score cannot tell apart ties to A0 and measures flat. Do not open another search-shape probe without a new instrument.

**How to run the shop:** unchanged (QUEUE-ARCHIVE.md). Workers = Sonnet via create_session, self-contained prompt; this session's
prompt preamble (`experiments/WORKER-PROMPT-PREAMBLE.txt`) worked first time for both (rules + measurement + base files + report-and-stop), at ~$0.80 each. Next letter: **L**.

**NEXT:**
00. **Strength now lives in the ROLLOUT POLICY, not the search.** Sharp plays the rule policy (`actBase`) inside every rollout, so
   a better rule is a better Steady AND a better Sharp. Census the weakest seats (viseraibw 43, boltyn 47, lyath 59, gravy 41 of 192)
   with `never.js` / `calls.js` for a decision the rule gets wrong, then fix it as a rule (SPX gate, A/B the hero's seat with SPXLA=all).
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): low volume, take only with a census.
2. Chaos: d8-d15 CLEAN; next **d16**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change.
3. Compass of Sunken Depths (Gravy), Energy Potion (Dorinthea, Fai) — skip unless a game reaches them.
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md. Also open: a real-iPhone
   timing (DESKTOP-TASKS.md).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action), **`calls.js <hero> <seeds> "<card>"` (new:
every call that touched the card — played/pitched/blocked/arsenalled, own or opp turn, with the reason key)**. Each runs in ~10 s at 1 seed.
**An experiment can surface an engine bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count.** A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores; a variant probe is an env
var read inline (delete it after; keep the diff as `experiments/*.patch`). **A subGate is ON when its env var is empty.** A result
inside ~10 wins of 192 at 12 seeds is noise: go to 24 seeds (new seeds 12-23 are the honest second sample). A new reason key moves
test/explain.test.js's unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves
test/keycensus.test.js. `npm test` rewrites CR-INDEX.md line numbers: `npm run crindex` before committing. After pushing main, curl
until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json, THEN livecheck.

### PREVIOUS (CEO session_013xG9x8HgMKuk2aa2wUQPCV, 2026-11-24 night, at v6.79)

**State:** live = **v6.79** on `main`, livecheck ALL PASS. Function `table` v110 = `v6.79 · sage-v19`, stamped, `--check` OK.
WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS IN FLIGHT (CEO session_013xG9xCCHmaDbKTPm38cqzb, 2026-11-24 14:28Z, Sonnet):** J `session_013xG9x8wauLXTKFuj1vwrUY` (ship/j-pitchsearch: Sharp searches WHICH card to pitch, item 00a) · K `session_013xG9xBb6BYLKcSfaSMLzkX` (ship/k-handworth: hand composition by printed def in laEval, item 00b). CEO: chaos d14.

**This CEO:** v6.79 = Sharp also proposes every attack at the hero AND at each ally (`SPXLATGT`, `laCands`; CR 1.4.5). 24 seeds,
own seat: +19 (s1) and +9 (s2) = +28 of 6528, no hero down > 3. Small but principled and both samples positive. Drill latarget.
**Measured and DEAD at the 600 budget** (`experiments/search-shape-v678b/`, NOTES.md + tables): horizon "opp" -53 on 9 heroes;
mu 1.0 -9; mu 2.25 +29 then -25; a gear term in `laEval` (standing equipment defence) +13 then -17. With v6.78's 900/450 results,
**Sharp's knobs (budget, horizon, mu, dets) are exhausted** — the remaining strength is in WHAT it considers and how it scores.
**New probe:** `laX` (patch `laX-perhero-probe.patch`): `SPXLA_XH=<hero> SPXLA_XSET="k=v,..."` overrides any `LA` field inside one
hero's searches — a per-hero A/B of any search setting with no code edit. Run probes from a scratch `git worktree`, never the main
tree (editing engine/ mid-sweep changes later runs). **v6.78's base78 reproduces exactly from a worktree** (890 = 890): it is a
valid base for seeds 0-11; a seeds 12-23 base (`*.base78.s2.txt`) is now in the same folder — reuse both, skip re-measuring base.

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours. (2) Blocked damage still costs the foe cards. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Making a step cheaper is
decision-identical by construction (sha256 the action logs). (6) A search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` 0. (7) NEW: `xargs -L1` splits a job line on spaces — pass each ENV=val as its own word ("$@").
xargs STOPS the whole sweep if any child is killed by a signal; a background Bash task dies at its timeout (default 30 min: pass
7200000) and the container can restart mid-sweep — write one result file per run and resume only the empty ones.

**How to run the shop:** unchanged (QUEUE-ARCHIVE.md, previous handoff): one worker per item or the CEO alone on 4 cores; one sweep of
17 runs x 12 seeds ≈ 15 min at 4 parallel. Ship gates and the deploy order are in CLAUDE.md. Next worker letter: J.

**NEXT:**
00. **Strength via search SCORING and BREADTH** (knobs are done). Ideas, each a per-hero `laX`/gate probe, 12 seeds then 12-23:
   (a) breadth: `laCands` still proposes one pitch plan and one arsenal choice (end of turn is a single `endTurn`) — census how often the
   arsenal pick differs between the rule and a searched alternative; (b) scoring: `laEval` prices a held card flat (mu) whatever it is —
   a card's worth by what it does (def for a blocker, power for an attack) through a judge reader, not card text; (c) the defend search
   pre-sort charges a gear block 0.5 but `laEval` charges it 0 (the gear term above was flat, so this is likely fine — note only).
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): low volume, take only with a census.
2. Chaos: d8-d13 CLEAN (289 games each); next **d14**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change.
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) look like deck ceilings for this policy; gains there need search/scoring.
4. Compass of Sunken Depths (Gravy), Energy Potion (Dorinthea, Fai) — skip unless a game reaches them.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md. Also open: a real-iPhone
   timing (DESKTOP-TASKS.md); v6.79 adds candidates only when the foe has an ally, inside the same step cap.

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action), **`calls.js <hero> <seeds> "<card>"` (new:
every call that touched the card — played/pitched/blocked/arsenalled, own or opp turn, with the reason key)**. Each runs in ~10 s at 1 seed.
**An experiment can surface an engine bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count.** A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores; a variant probe is an env
var read inline (delete it after; keep the diff as `experiments/*.patch`). **A subGate is ON when its env var is empty.** A result
inside ~10 wins of 192 at 12 seeds is noise: go to 24 seeds (new seeds 12-23 are the honest second sample). A new reason key moves
test/explain.test.js's unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves
test/keycensus.test.js. `npm test` rewrites CR-INDEX.md line numbers: `npm run crindex` before committing. After pushing main, curl
until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json, THEN livecheck.

### PREVIOUS (CEO session_013xG9xB8VHgWznFkVzaV77n, 2026-11-23 evening, at v6.78)


**State:** live = **v6.78** on `main`, livecheck ALL PASS. Function `table` v108 = `v6.78 · sage-v19`, stamped, `--check` OK.
WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS: NONE** (this CEO ran everything itself on
the 4 cores — cheaper than workers for A/B sweeps; one sweep of 51 runs x 12 seeds = ~45 min).

**This CEO:** v6.78 = Sharp's OWN-TURN search budget 300 -> 600 steps (`LA.budgetOwn`, env `SPXLA_BO`; the defend search keeps
`LA.budget` 300). A/B each hero's own seat, 24 seeds (two samples): 3215 -> 3300 of 6528, no hero down > 1; 2 determinizations
won the same (3303) at 2x steps and cost Arakni 18 — not taken. Page at 4x: max p95 110 (own 123 fai), worst 194. Evidence:
`experiments/sharp-budget-v678/` (tables, run.sh, time2.js = H's time.js + XB/XK/TAG env). A drill (aiqa "does not bin a known
arrow") had been passing on a BUDGET BAIL-OUT; moved az6 -> az10 and now asserts `over` 0 / `unverified` >= 1. `tools/tourney.js`
takes `TOURNEY_S0=12` (seeds 12-23 without re-running 0-11). **RULING (user, 2026-11-23): only cards a precon list prints** —
recorded in CLAUDE.md, ROADMAP-NEWDECKS.md, docs/OUTBREAK-PROBE.md.
**Budget is SATURATED at 600 (measured after the ship, v6.78 baseline, 12 seeds, own seat):** own-turn 900 = 1592 vs 1590,
defend budget 450 = 1598 vs 1590 of 3264 — both noise, 0 refusals/violations (`table2.txt`). Do not spend more steps; spend
them DIFFERENTLY (below). Per-hero probe: `experiments/sharp-budget-v678/perhero-budget-probe.patch` (SPXLA_XH + XB/XBO/XK).

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours — off-turn pitch is CLOSED; a resource that is not a
card (the Cloak) is its positive form. (2) Blocked damage still costs the foe cards — never rank on landed damage alone. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Sharp's budget is
engine STEPS, so making a step cheaper is decision-identical by construction — prove it with sha256 of full action logs; the profile
is now flat (no single function >5%). (6) NEW: a search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` is 0 before trusting it.

**How to run the shop (works well):** one Sonnet worker per item via create_session with a SELF-CONTAINED prompt (git log of this
file 2026-11-23 has the shape: rules preamble + one task + "report with send_message to the CEO session, then stop"). Workers push
only ship/<letter>-*, never main, never bump APP_VER. Archive each on its report. A limit stop sends NO report: set a send_later
check-in (~90 min), then get_session + list_events. The CEO cherry-picks onto main (CR-INDEX.md conflict: take main's, `npm run
crindex`), re-gates (npm test fail 0 / skipped 5, scenes, fairness, `npm run play '' '' 3`, chaos; babel + trainchaos if index.html's
babel blocks moved), bumps APP_VER + CHANGELOG, pushes main, curls until Pages serves the new APP_VER, `tools/supabase-deploy.js`
(--dry-run first), commits DEPLOYED.json, `node tools/livecheck.js`. Next worker letter: J.

**NEXT:**
00. **Strength via search, continued.** v6.78 took own-turn 600; more steps (900) and a bigger
   defend budget (450) are flat. Remaining levers are SHAPE, not size: (a) `laCands` breadth — what lines the search even
   considers (census which A0-overrules exist vs which candidates were never listed, gravy/boltyn/viseraibw first); (b) horizon
   "opp" was flat at 300 — retest at 600 now that the cap no longer bites; (c) `mu`/`bMu` (held-card worth) sweep at the new
   budget; (d) 2 dets only for heroes that gained (azalea +14 extra, lyath, viseraibw) is cherry-picking — skip unless a principle
   (e.g. dets for decks with random reveals) explains it. Each: per-hero probe, 12 seeds, then 12-23 with TOURNEY_S0. Also open: a real-iPhone
   measurement (DESKTOP-TASKS.md). Weak-seat ideas: Sharp's `laCands` breadth (what candidates it even considers) for gravy/boltyn.
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): token/draw/gainKw/buffNext/arcane —
   each 1-8 cards; low volume, take only with a census showing the gate holds often.
2. Chaos: d8-d11 CLEAN (289 games each; d11 also EPS=0.6, v6.77); next **d12**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change (v6.69 run: clean).
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) have all been censused today and look like deck ceilings for this policy;
   a further gain there likely needs Sharp/search, not a rule.
4. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it. Energy Potion (Dorinthea, Fai) would need cloakFirst to
   scan `sd.board`; no game reaches it.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md (reader build order). Wire: next cut if needed is HZOOM (~500 B/seat).


### PREVIOUS (CEO session_013xG9x9iZ6h3pqkkhaHmRjq, 2026-11-22, at v6.67; tools-only since)

**State:** live = **v6.67** on `main`, livecheck ALL PASS. Function `table` version 86 = `v6.67 · sage-v19`, stamped, `--check` OK.
**WIRE_V 49** (`boardcost`). DATA_VER sage-v19. 17 heroes. Branch `claude/elegant-einstein-st9zq6` = main + `tools/trainchaos.js` + its CLAUDE.md line (tools only, NOT on main yet: merge it with the next release).
page.js 89/89 at 393x852 as of v6.66. **Approximation ledger: 0 open** (21 stated, 42 closed). Pool 455/455 full.

**Shipped today:**
- **v6.66 rules:** Runebleed Robe's "destroy this and a Runechant you control" asks WHICH when a token and a Runechant of
  Lust/Sloth are both there (CR 1.8.8). `parser.boardCostOffer`, judge `boardcost` pending (3 activation routes), trainer
  `boardpick` (both doors), `_destroyUid` in HELD_DECL, AI `judge.boardCostAnswer`. Closed the ledger's last open record.
  Drill test/boardcost.test.js. Unreachable with today's built decks (Robe = Viserai, Lust/Sloth = Viserai BW).
- **New tool `tools/chaos.js`** (in CLAUDE.md's validation list): random LEGAL moves mixed into self-play at rate EPS; reports
  legal/reduce disagreement, throws, invariants, NO-ZONE, wire round-trip + replay divergence (the two phones), view throws,
  rule-policy and Sharp refusals. ~1M random legal moves over the day across all 289 pairings: **0 engine findings.**
- **v6.67 AI:** the one finding — a payment over-pitched by someone else got `payConfirm` (refused); now `payBack` takes a card
  back. Ladder byte-identical to v6.66. Drill test/payback.test.js.

**NEXT, in order:**
0. **Chaos, further** (cheap, high yield for "a person could, the policy never did"):
   (a) DONE (session_013xG9x9iZ6h3pqkkhaHmRjq): **`tools/trainchaos.js`** taps random enabled buttons on the REAL page (page.js
   offline, 393x852) through whole trainer games, every hero; reads pageerror/console.error and `window.__dawnJudge`. 56 games, all to
   game over, **0 findings** (an earlier 18 found only the tool artifact below). Lesson in its header: two `.click()`s in ONE page task both read the pre-render closure and a peeked
   card commits twice (CARD-DUP-IN-ZONE) — not reachable by a thumb (React flushes between real events), so taps are separate tasks.
   Next: more seeds (`node tools/trainchaos.js '' 3 3`, ~45 min); run it after any `Battle` change (CLAUDE.md lists it).
   (b) chaos on the STAGED decks before they open (`tools/staged-play.js` builds them) — waits for Outbreak.
   (c) table chaos: d1–d5 done, 2,023 games, 761,284 random legal moves, 0 findings (d4 EPS 0.4, d5 EPS 0.6 this session). Next salt: d6.
1. Weakest ladder seats (rule policy, 48 games each, v6.65 ladder): Viserai BW 22, Lyath 28, Iyslander 33, Gravy/Blaze 34 of 96.
   Lyath looks like a deck/halving ceiling; BW is strong under Sharp (the page's AI). Prefer correcting advice over chasing wins:
   run `never.js <hero> 1` for each and look for a printed play the call never offers. Done for BW/Gravy/Blaze/Lyath
   (2026-11-22): left untried — BW's Runechant of Sloth/Lust off-turn (43/0, 35/0; likely loses the usurp synergy),
   Gravy's Timesnap Potion (62/2) and Jittery Bones (67/8).
2. Spellfire Cloak as a payment source on the opponent's turn (instead of pitching a card) — only if a census shows the off-turn
   pitch is often a card she needed. A/B per the habits.
3. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action, new). **An experiment can surface an engine
bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count** (v6.64's two fixes came from one). A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores. **A subGate is ON when its
env var is empty** — an experiment you do not ship must be deleted, not left gated. A new reason key moves test/explain.test.js's
unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves test/keycensus.test.js.
After pushing main, curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.

### PREVIOUS (CEO session_013xG9x8zcxAkbX2jCAXysk4, 2026-11-22, at v6.65)

**State:** live = **v6.65** on `main`, livecheck ALL PASS. Function `table` version 82 = `v6.65 · sage-v19`, stamped, `--check` OK.
**WIRE_V 48** (a held layer's `price`). DATA_VER sage-v19. 17 heroes. Session branch `claude/quirky-brahmagupta-2pr645` == main.
page.js 89/89 at 393x852 as of v6.63 (deps: `npm install --prefix <scratch>/pagedeps ...` per its header; v6.65 touched no UI).

**Shipped v6.65:**
- **Rules: a held play pays the price it was PLAYED at** (CR 5.1.6/5.1.7/5.1.10, quoted in judge.holdPlay and LESSONS "CR READINGS").
  v6.64's Frostbite was one input of a class: `execute` re-read the whole price at resolution. Rune Flash waiting with one Runechant,
  a second made at instant speed -> refunded 1 (silent); one destroyed (Runebleed Robe) -> charged 1 more. `holdPlay` records `price`,
  `execute` charges it (`_heldPrice`). Audit: `costOff` is only Seismic Surge (start of action phase), `nextTurn` taxes are born
  not-ready, so neither can be born in the window. A probe over the full ladder found 0 held plays whose price moved (the rule
  policy never did it; a person or Sharp could). Drill test/heldprice.test.js.
- **SPXOPPAMP:** Crucible of Aetherweave amps Iyslander's off-turn arsenal cast. 266 -> 279 of 768 (both chairs up), reason `oppArsAmp`.
- **Measured and dropped:** Spellfire Cloak paying for those casts — its {r} never unlocked one (0/111 windows; on == off over 384
  games). Its real value is SAVING a pitched card on an off-turn cast (a card for Arcane Barrier 1) — a payment-policy question.

**Measured after v6.65 shipped (Blaze, 12 seeds each chair, wins of 384; both deleted — do not retry as-is):**
- SPXOPPHAND — a free hand card granted instant speed off-turn (Cindering Foresight) cast in the opponent's last window:
  125 -> 85. Its amp and energy are worth more on Blaze's own turn.
- SPXOPPENERGY — Blaze's hero pick (and the spell it banished) in the opponent's last window: 125 -> 97. The energy and the
  pitch come out of his own turn. Emeritus Scolding's off-turn 6 alone might differ, but the AI cannot read that clause.

**Earlier (v6.64):** Frostbite-in-the-window fix (`frostAt`), SPXOPPARS (Iyslander casts her arsenal on the opponent's turn),
Gravy's discard-cost pitch. Dropped then (do not retry as-is): Lyath's Suspense auras in the opponent's last window (127 -> 112).

### PREVIOUS (CEO session_013xG9xCE5fBQAM6Mkv8rwdc, 2026-11-21, at v6.59)

**State:** live = **v6.59** on `main`, livecheck ALL PASS. Function `table` version 70 = `v6.59 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. Session branch `claude/nice-fermi-nw1gm0` == main.

**Shipped v6.59** (CHANGELOG has every number):
- **SPXRIDER** (`judge.riderPick` / `judge.riderLead`): Embrace Ursur's "banish a card from hand" sheet was declined 15/15, and
  a Gloomblade was swung BEFORE Embrace Ursur. Now a card that still plays from banish and fires a rider is banished, and
  Embrace Ursur leads while a payable Gloomblade waits. **Viserai BW, own seat, 12 seeds each chair: rule policy 76 -> 114 of
  384; Sharp (`SPXLA=all`) 92 -> 104.** Ladder clean. Drill test/embraceursur.test.js.
- First game points at the Coach's call once per phone (`coachSeen`, `.advnew`); page.js 83/83.
- Ruled out: Jittery Bones (Gravy) — never held while a turn ended; the point always went to a bigger or go-again play.

**NEXT, in order:**
1. **Sharp under-uses SPXRIDER** (+12 vs the rule policy's +38). Census Sharp's root picks (`SPXLA=all`, `SP.explain` keys) on
   Viserai BW turns where `J.riderLead` is true: does `laHit` pick a Gloomblade first? Its playout scores damage only to the end of
   the turn, so the Runechant (dealt later) may be under-counted, or the mask may hide the banish follow-up.
2. Viserai BW's other census rows (`experiments/census/never.js viseraibw 1`): Murmuring Gloomblade from banish 50/10,
   Bloodfrenzy from banish 44/15. Check the same way (what was played instead, never just legal-vs-used).
3. **Newcomer path:** the hero sheet could say each hero's play style in one line (data in HEROES, sourced from the precon's
   own product text, not invented prose). Drive at 393x852.
4. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).


### PREVIOUS (CEO session_013xG9xAEHGDJRHeNPdYa83U, 2026-11-21, at v6.58)
**State:** live = **v6.58** on `main`, livecheck ALL PASS. Function `table` version 68 = `v6.58 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. Session branch `claude/keen-hopper-gumd4k` == main.

**Vision this thread: the stranger.** The AI plays like someone who means it, and a person who has never held a FaB card can pick
the game up. **Shipped — v6.57 and v6.58** (CHANGELOG has every number):
- **How to play** sheet under the roster (six paragraphs, coach voice; `tools/page.js` walks it). **Link preview**: description +
  Open Graph + `icons/share.png` (original art, `tools/icon.js` writes it with PAGE_DEPS' fonts).
- **SPXRXPUMP** (`judge.pumpsNow`): the attacking reaction window casts only an attack reaction, a pump/hit rider, or a permanent.
  All 11 affected heroes within the band (sum 1872 -> 1885 of 4224); ships for the advice it corrects.
- **SPXTOKENPIECE** (`judge.tokenPiece`, `TOKEN_DEF` 1): Runehold Release / Flat Trackers before the attack.
  Viserai BW 136 -> 141 of 768, **Boltyn 224 -> 253 of 768**.
- v6.58: How to play wears a gold frame on a phone that has never opened it (`howSeen`), quiet text after.

**Measured and RULED OUT this thread (don't chase again):**
- Holding auras/items out of the attacking window: **Lyath 133 -> 95 of 384** (Suspense auras belong in the arena). Permanents stay in.
- Stand Strong (Lyath) via tokenPiece: it costs {r}{r}{r}, not admitted; identical either way.
- Timesnap Potion (Gravy, 62 / 2): every legal state competes with an attack for the same point, and it pitches 3. Not a leak.
- Runechant of Lust / Sloth on the opponent's turn: becoming a plain Runechant early discards the printed usurp rider.

**NEXT, in order:**
1. **Jittery Bones** (Gravy) 69 / 8 — an attack ranked below his bigger ones; check whether its mill-for-go-again rider is ever
   the better line before calling it a leak.
2. Viserai BW is still bottom (18-22 on the ladder). Look at what she pitches vs plays (`experiments/census/rx.js`-style census of her calls).
3. **Newcomer path, next steps:** the hero sheet could say each hero's play style in one line (data in HEROES, sourced, not prose
   in code); the first trainer turn could point at the Coach's call once. Drive both at 393x852.
4. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min. **A subGate is ON when its env var is empty** — an experiment you do not ship must be
deleted, not left gated. A self-play fixture (a seed a drill replays) moves whenever a hero's policy moves: re-anchor it (search
seeds for the same key), never weaken it. After pushing main, curl until the page serves the new APP_VER, THEN livecheck — it fails
on the build handshake until `tools/supabase-deploy.js` has run.

### PREVIOUS (CEO session_013xG9x8RqUofeXdc97YwD9o, 2026-11-21, at v6.55)


**State:** live = **v6.55** on `main`, livecheck ALL PASS. Function `table` version 62 = `v6.55 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/nifty-cray-ahkvfc` == main.

**Shipped this thread:** **v6.55 Gravy takes the Tipple** (`judge.cyclePick`, SPXCYCLE): Golden Tipple's "discard a yellow, draw +
Gold" was declined 49/272. Own seat **103 -> 135 of 384**; ladder Gravy 24 -> 30.

**Measured and RULED OUT (don't chase again):**
- **Arakni's retrieves** (dagger back for {r}): taken whenever reachable, own seat 174 -> **143** (the {r} is a pitched card). Taken
  only from floating resources: 172 vs 174, level. The structural decline is right.
- **Suspense auras at the close of the opponent's turn** (Lyath; a reader on `printedKw(c,"suspense")`, played after the turn player
  passed on an empty stack): own seat 128 -> 120, noise-to-negative. Same lesson as QUEUE v4 H8 (`reaction`'s comment): cards pitched
  on their turn are next turn's hand.
- **Gate to i'Arathael never activated** (Viserai BW, 0/38): on 12 of 14 legal turns every banished blood-debt card was already
  playable; the Gate is redundant there.
- **Corrupted Crown / Embrace Ursur** (a whole card for +1) and Condemn to Slaughter: trade-offs, not leaks.
- **Opponents attack Suraya** 122 of 207 swings while she is out — but `targetFor` only names an ally it KILLS (unblockable, CR
  7.3.2a), and she is Ward 4 plus an attacker every turn. Not a leak.

**The probes** (`experiments/census/` on this branch): `never.js <hero> <seeds>` — per card/ability, the turns it was LEGAL vs USED,
split own/opp turn (~1 min a seed). `gate.js`, `suraya.js` as above. `experiments/energy/decline.js` (the optional-pick census) now
lists only the ruled-out rows. **Finding from never.js:** the AI plays NO instant on the opponent's turn outside a reaction window
(Glisten 0/116, Lyath's suspense 0/~300, Arcane Polarity 0/42). The suspense test says that's mostly right; Glisten's counters
survive to the end of HIS next end phase, so a Glisten at their turn's close is +4 weapon power for a whole turn — untested.

**NEXT, in order:**
1. **Boltyn (23, 2nd from bottom):** Garland of Spring legal 266 own turns, used 7 (resource gear hold — probably deliberate, check
   `landsNothing`); Glisten at the close of the opponent's turn (above) — A/B it as its own gate.
2. **Gravy still low (30):** Mage Master Boots legal 432 / used 1, Timesnap Potion 62 / 1, Limpit 127 / 5, Carrion Crown 66 / 2.
   `never.js gravy 2` then read why each is held (idle? landsNothing?).
3. Viserai BW (18, bottom): Blossom of Spring 204 / 12, Runehold Release 157 / 23 (gear "destroy this: gain {r}" / Runechant) — the
   rest of his never-does list was clean.
4. Blaze opp-turn energy (219 windows, 0 uses) — same shape as the suspense test, expect negative; low priority.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** `npm run quick` inner loop. Full `npm test` ~10 min: once at the end. A gated A/B: `SPXFOO=none node tools/tourney.js
hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min. The decline census is ~20 s, not 2 min. Don't edit engine files while a
background suite runs. After pushing main, curl the page until it serves the new APP_VER, THEN `livecheck.js`.

---

### Previous handoff (v6.52), kept for its census notes

**The census that found both AI wins** (`npm run play '' '' 6`, 1632 games, ~3 min, before v6.50): wins of 32 a seed — Briar 28.3, Kayo 25.3,
Dorinthea 24.5 ... Blaze 10.5, Lyath 9.2, Boltyn 8.2, Viserai BW 7.5, Gravy 7.2. **The method that worked twice:** for a bottom hero, count
what the AI NEVER does that `legal` offers (probe: tally actions by kind and zone over 16 games; then ask `legal` at each decision for the
missing kind). Gravy: zero graveyard plays. Lyath: hero ability legal ~every turn, used only on his own turn where half of it is dead.
Ruled out (don't chase): Lyath's wall (halving is applied at build), end-turn "holds" of resource gear (deliberate), Boltyn's charging
(long measured history in QUEUE-ARCHIVE, v5.68 H24).


### PREVIOUS (CEO session_013xG9xBabg1FM1NrVtAAD1y, 2026-11-21, at v6.49)

**State:** live = **v6.49** on `main`, livecheck ALL PASS. Function `table` version 50 = `v6.49 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/dazzling-wright-tsnh88` == main.

**Done this thread (v6.49):**
- **UX step 7 done (prompt sheets):** a `target` sheet drew NO cards (Confirm dark forever; no producer yet); the soak sheet printed a
  literal "{r}"; its running total is now a `PStat` (big "2/3 still gets through"); selection tags moved off the pitch pip.
  Every prompt kind can be rendered without a game: mount `PromptSheet` with hand-made `p` objects via `ReactDOM.render` inside
  `open()` (it is a page global). The script: `experiments/ui/sheets.js` on this branch.
- **Wire budget:** opening snapshot 15821 -> 15202 B (`rulesBuild` slims `heroRec.pr` to codes + back-face markers + `_first`).
- **H: awaken timing measured NULL:** instant hero ability first fired earlier (15/20 with an action point left, vs 6/17) but Prism won
  82 vs 86 of 192 (12 seeds). Patch: `experiments/awaken-first/`. `npm run play prism '' 12` takes ~1 min: A/B is cheap.

**NEXT, in order:**
1. **UX steps 6, 8, 9** (motion, type tokens, sound) — docs/ux/UX-ROADMAP.md §3. Step 8 is mechanical (inline fontSize -> `--fs-*`).
   Step 9 needs sound files we may legally ship (self-made or CC0, under `assets/`).
2. **AI ideas need a NEW angle** — Prism awaken (null), Viserai BW (four nulls, QUEUE-ARCHIVE "VISERAI BW POLICY"). Try a
   win-rate census per hero first (`npm run play '' '' 6`) and attack the weakest hero's numbers, not a guess.
3. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
4. Wire: next cut if needed is HZOOM (~500 B/seat; `_first` art could be re-derived).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4.

**Cheap habits:** `npm run quick` inner loop (~2 min). The full `npm test` is ~10 min: run it ONCE at the end, in the background, and
read failures with `node --test "test/*.test.js" > tap.txt; grep -n "^not ok" tap.txt` (npm test swallows `--test-reporter`). Source-
order pins exist for the policy (allyseat: hero ability AFTER the attacks) — a gated experiment that moves a branch trips them, so
keep experiments as patches. A `<style>` change moves `slicecensus`'s phasebar pin; a PromptSheet change moves promptctl's width pin.
page.js deps: `npm install --prefix <scratch>/deps ...` (its header), pass `deps:` to `open()`. After pushing main, curl the page until
it serves the new APP_VER, THEN `livecheck.js`.

### PREVIOUS (CEO session_013xG9xAAoQteCjpQ2SqFUcp, 2026-11-21, at v6.48)

**State:** live = **v6.48** on `main`, livecheck ALL PASS. Function `table` version 48 = `v6.48 · sage-v19`, stamped, `--check` OK.
**WIRE_V 45** (a chain entry gained `out`). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/stoic-rubin-3lscdg` == main.

**Done this thread (v6.48):**
- **UX step 5 finished:** every resolved chain link records `out` = hit / blocked / prevented (`effects.linkOutcome`, fed by judge's strike,
  the trainer's strike and the dummy's `takeIt`); the featured slot stamps it (`LinkStamp`), chain tiles dim/ring (test/linkout.test.js).
- **UX step 4 done:** roster tiles show the illustration, a picked-hero banner (`HeroBanner`) under the roster, the legend names every group.
  Kept 6 across (4 across pushes Battle off the first screen). Real art CAN be checked from the sandbox: curl the LSS S3 images into scratch
  and serve them through `page.route` (docs/ux/UX-ROADMAP.md §2 rows I-J say how).
- **The "AI never awakens" note was stale:** 12 seated Prism games, 10 awakenings (last-resort branch `heroAbility`, legal at 315/3014 decisions).

**NEXT, in order:**
1. **UX roadmap steps 6–9** (motion, prompt sheet pass, type tokens, sound) — docs/ux/UX-ROADMAP.md §3. Step 7 (prompt sheets) is the
   most player-visible. Drive with `tools/page.js`'s `open()`; play a card from the rail = tap, then tap the PEEKED tile again
   (re-measure its box: the peek lifts it), and confirm "Pitch & play" once the status line says covered.
2. **H-item: awaken timing for Prism** (an earlier awaken, Suraya's Ward 4 / attack): SPX-gate, 3 seeds, then the ladder. Then Viserai BW's
   starvation (QUEUE-ARCHIVE "VISERAI BW POLICY").
3. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
4. Wire budget: opening snapshot ~15.8 KB of 16384 (table.test.js); next cut `heroRec` (~1.2 KB/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4.

**Cheap habits:** `npm run quick` inner loop (~2 min); a digest of failing drills (`--test-reporter=spec | awk '/failing tests/{p=1} p'`);
a UI change that grows `<style>` moves `slicecensus`'s phasebar pin (read, note, repin). After pushing main, wait for Pages to serve the
new APP_VER BEFORE `livecheck.js` (curl the page until it does), or the handshake rightly refuses the mixed builds.

### PREVIOUS (CEO session_013xG9x9bRibS57y9pv9vJyZ, 2026-11-18, at v6.46) — PRISM IN PROGRESS, UNRELEASED
**NEXT THREAD, START HERE (in this order):**
1. **Take the unreleased work first:** `git fetch origin claude/epic-feynman-cewlp0 && git merge --no-edit FETCH_HEAD`
   into your own session branch. `main` (live v6.46) does NOT have it. Run `npm test` (expect fail 0, skipped 5).
2. **Release plan (user, 2026-11-18, "the most important thing is ... keep making progress without hitting our limits"):**
   do NOT release per reader. Keep building Prism on the branch; ship ONE release (APP_VER, CHANGELOG, DATA_VER, function
   redeploy, livecheck) when she opens. Nothing on the branch changes the live pool, so waiting costs players nothing.
3. **Continue Prism at ROADMAP-NEWDECKS.md Phase 3** (the authority on order and status). Next reader: the hero's trigger
   "whenever a card with Herald in its name is put into your soul during an action phase, you may search your deck for a
   figment, put it into the arena, then shuffle" (a soul-entry event + an existing deck-search pick with `to` arena).
   Then Suraya as an ally ("{r}{r}: Attack", Ward 4), Iris, Spectra/phantasm-loss, -1{p}, Lay Low, Herald of Judgment.
4. **Owed before she opens:** the cup cuts a 17th hero silently (`tools/tournament.js` FIELD, noted there): ask the user
   (32 seats with byes, or a play-in). The AI never awakens a figment (policy work is on the back burner, so a person
   piloting her is the target; she may open as a person-only hero if the user agrees: ASK).
- **RULINGS (user):** 2026-11-17 "throw the player vs ai development on the back burner and move along to prism";
  2026-11-18 "The training dummy out of the tournament is a great thing!" (recorded in tools/tournament.js).
- **On the branch (all validated per commit: npm test 0 fail/5 skipped, audit 430/430, scenes 107/0, fairness clean,
  babel OK):** byCode front face; Prism readers 1 (soul + rider), 2a ("with Herald in its name"), 3 (figments enter the
  arena; Prism's awaken -> Suraya; front filed off the arena + invariant BACK-FACE-OFF-ARENA); the cup ruling.
- **Pins to unpin when she opens:** anchors.test.js (3 staged-only parser lines), crindex 111/101, slicecensus prompts.js.
- **Cheap habits that worked:** probes with staged cards (`test/figment.test.js` `withStaged`); `npm test` piped through
  `grep -E '^# (tests|pass|fail|skipped)|^not ok'`; a sonnet agent for read-only diagnosis. Expensive: Sharp A/B
  (`SPXLA=all`, ~55 s / 45 games) — not needed for Prism readers.

### PREVIOUS (CEO session_013xG9x9bRibS57y9pv9vJyZ, 2026-11-17, at v6.46) — VISERAI BW POLICY: FOUR LEADS, ALL NULL
- **State:** live still v6.46 (0cdb3e2). UNRELEASED on `claude/epic-feynman-cewlp0`: `buildMaps`' `byCode` keeps the FRONT
  face under a shared print code (both copies, cards.js + index.html; 13 codes moved, SBW001 among them; drill in
  traverse.test.js, sabotaged; npm test 4430/0/5). Not user-visible (names resolve first): ride the next release.
- **MEASURE FIRST: `npm run play` (tourney) runs the RULE policy in both seats; Sharp needs `SPXLA=all`** (~55 s per 45 games).
  Baseline viseraibw at 3 seeds: rules 10/45, Sharp-all 13/45. Probe (Sharp-all, 60 games): 146 of 455 own turns pass at an
  action point, but 61 with an empty hand and 79 with one unaffordable card: starvation, not missed plays.
- **TRIED AND REVERTED (measured; do not redo without a new idea)** — probes in `experiments/viseraibw-policy/`:
  (1) Gate to i'Arathael "never activated": correct. Every blood-debt action in his deck prints its own banish line, so the
  Gate unlocks nothing here (an `arenaUseful` "banPlay" kind was built, found idle, removed). Matters only for a future deck.
  (2) Hold heal-only cards (Arcane Polarity) until the 4-life gate: LOSES (viseraibw 10->8, blaze 16->11, briar 42->34, fai =,
  3 seeds): casting the free card thins the hand for the end-phase draw. Burning it is right.
  (3) Go-again non-attacks first in the no-attack branch: viseraibw 19 = 19 at 6 seeds (no effect).
  (4) Sharp counts playable banished cards as held (`fromBan`): Sharp-all 13 -> 9. Worse.
- **NEXT:** policy ideas for him should start from the starvation numbers (what he pitches vs plays per turn, arsenal use),
  not from the pass count. Or accept he is a weak AI seat and move to (2) Prism (soul zone first, ROADMAP-NEWDECKS.md).
- **ASK THE USER (still open):** the cup's dummy fills only while heroes < 16, so it is out now; confirm.

### PREVIOUS (CEO session_013xG9xAMiFN6pmpxfvY4LPe, 2026-11-17, at v6.46) — VISERAI, BETWEEN WORLDS IS OPEN
- **State:** live = v6.46 on `main` (0cdb3e2), livecheck ALL PASS. Function `table` version 44 = build `v6.46 · sage-v18`,
  stamped; `--check` OK. WIRE_V 44, **DATA_VER sage-v18**. No unreleased work. 16 heroes; `npm run play '' '' 3` = 720 games.
- **DONE v6.46:** key `viseraibw`, `short: "Viserai BW"` (new `heroShort(h)`: every label used to cut at the comma, so two tiles
  read "VISERAI"), `blk` names his block. Pool via `node tools/pin-pool.js --add-staged` (new; 27 records, nothing else moved).
  `SA_SETS` + SBW. Fixed by dealing him: Murmuring Gloomblade's "when this attacks OR hits" read only the hit half; the audit's
  token scan ("Arathael") and go-again check (it missed riders; 6 older false flags cleared too). Ledger knows Blood Debt / Usurp /
  Traverse. Cup: the dummy fills only while heroes < 16 (it is out now): **confirm with the user** (it read the 2026-08-16 ruling's reason).
- **AI:** traverse sheet keys `traverseStay` / `traverseBack` (gate SPXTRAV, off; 17 v 15 wins, noise). **He is a weak AI
  opponent (~1 in 9 seated games)**: not the engine (all 25 cards `full`), mostly not sequencing (66% of usurp attacks find a
  Runechant); printed attacks average 2.6{p} and the deck lives on combos. Policy work, measured per CLAUDE.md, is NEXT.
- **STILL OWED:** drive the trainer's traverse sheet on the page (needs 3 Runechants in a turn; shared openPrompt path, undriven);
  the AI never raises Olde Leather Boots (0{d}) for its +2; `byCode` lets the back face shadow the front under SBW001 (heroes
  resolve by NAME first, so nothing breaks; check before Prism adds more double-faced records).
- **NEXT:** (1) Viserai BW AI policy (seated probe: `node tools/staged-play.js` still works but the ladder seats him now:
  `npm run play viseraibw '' 6`). (2) Prism: soul zone first (ROADMAP-NEWDECKS.md).

### PREVIOUS (CEO session_013xG9xAMiFN6pmpxfvY4LPe, 2026-11-17, at v6.45)
- **State:** live = v6.45 on `main` (1a45fcd), livecheck ALL PASS. Function `table` version 42 = build `v6.45 · sage-v17`,
  stamped; `--check` OK. WIRE_V 44. No unreleased work. The v6.44 block below still holds except where this one says.
- **DONE v6.45, the 0{d} ruling** (user, 2026-11-16: "0 defense can be declared as a blocker (blank cannot)"):
  `game.gearDeclareWhy`, one body both boards call; `zero-defence-gear-refused` CLOSED; `test/defcap.test.js` (4 drills, sabotaged
  4 ways). The AI's wall still takes only pieces above 0, so it never raises Olde Leather Boots for their +2 (policy work).
- **NEXT:** the opening release for Viserai, Between Worlds (item 2 of the v6.44 NEXT list), then his AI policy, then Prism.
  Scouted: two heroes would show as "Viserai" (`HEROES[].n` must be the full name); `resolveHero` takes byName first, then
  byCode, then a substring match, so the old deck's `H|Viserai|0|SVI001` must keep resolving to the old record.

### PREVIOUS (CEO session_013xG9xAMiFN6pmpxfvY4LPe, 2026-11-16, at v6.44)
- **State:** live = v6.44 on `main` (e532f80), livecheck ALL PASS. Function `table` version 40 = build `v6.44 · sage-v17`,
  stamped; `--check` OK. WIRE_V 44. No unreleased work. Everything in the blocks below still holds.
- **DONE v6.44, reader 7: the double-faced hero and traverse** (`test/traverse.test.js`, sabotaged 24 ways). `effects.traverse`
  (CR 8.5.60 / 8.5.60a) swaps the ability half of the build, the brood's route; `build.facesOf` finds the other face (hero
  records sharing a print code where exactly one image is `_BACK`; upstream has a promo code shared by two unrelated heroes);
  the build remembers `_face`. Passives `runeBanish` / `runeTraverse` / `firstAtkGaKw` / `endTraverse`; per-turn facts
  `hist.runes` / `actNames` / `atkKws`. `effects.runesMade` is called once per creation EVENT at all four Runechant sites.
  The end-phase "you may traverse" is step (10) of `beginEndPhase`, a two-mode sheet, staying first (the AI stays).
- **RULINGS (user, 2026-11-16):** (1) life carries over on a traverse ("Perfect"; `traverse-life-carries`, stated).
  (2) "0 defense can be declared as a blocker (blank cannot)": `zero-defence-gear-refused` is to be BUILT next (a dealt-card
  change: 27 pool 0{d} pieces; `test/defcap.test.js` pins the old refusal; measure the ladder).
- **THE ROADMAP GATE IS MET:** `node tools/staged-play.js viseraiBetweenWorlds 21` (new; seats a staged hero): 630 games,
  0 refusals / violations / stalls, 225 games ended on the other face. Census: no gap, both faces.
- **BUT THE AI CANNOT PILOT HIM: 72 won, 558 lost.** Measured over 12 games: 12.3 plays from hand and 1.1 from banish per game,
  3.8 life lost to blood debt, 23 of 86 own turns ended with the action point unspent, the opponent left on 11 life. Seen in
  feeds: a go-again non-attack (Runehold Release, Malefic Incantation, Otherworldly Sins) and then a pass. Seven Sin Nebula
  needs a banish play first. This is the H-work before he is an AI opponent; a PERSON piloting him is unaffected.
- **NEXT, in order:** (1) the 0{d} ruling. (2) the opening release: `pin-pool.js` takes staged records AND both faces (the back is
  on no list); `cards.buildMaps` `byCode` lets the back overwrite the front under the shared code (heroes resolve by name
  first: check every `byCode` reader); `DECKS` / `HEROES` entry, art path (the back's art is `_BACK`), DATA_VER, formats.json;
  drive the trainer's traverse sheet on the page (`tools/page.js`). (3) AI policy for Viserai, measured per CLAUDE.md
  (`keepsActionPoint` reads no banished card's own go again yet, only the Usurper's grant). (4) Prism.
- **RELEASE NOTES:** pins that moved: `anchors` (runOps vocabulary 101, `traverse` has no parser emitter), `crindex` (103 / 93),
  `approx` (62 records, 20 stated), `dichotomy` + `wire` (WIRE_V), `dorinthea` needs a `HERO_STATICS` row per new passive.
  Do NOT restore a sabotage with `git checkout <file>` when the file has uncommitted real edits (lost one edit that way).

### PREVIOUS (CEO session_013xG9xBdjSPqxKpK2H4msnK, 2026-11-16, at v6.43)
- **State:** live = v6.43 on `main` (c50ea36 = 762e3a3 + the stamp), livecheck ALL PASS. Function `table` version 38 = build
  `v6.43 · sage-v17`, stamped; `--check` OK. WIRE_V 43. No unreleased work. Everything in the blocks below still holds.
- **DONE v6.42, reader 6: the special Runechants** (`test/runechants.test.js`). They count as Runechants (CR 1.8.8); usurp asks
  WHICH Runechant through a `usurp` pending. CORRECTION: "When this is destroyed, create a Runechant token" did NOT already
  work (v6.41's note was wrong): `onDestroy` was only paid on phantasm pops; it is now paid at every destroy site. Runebleed
  Robe is a second "destroy a Runechant" consumer.
- **DONE v6.43, reader 8: the small conditionals** (`test/conditionals.test.js`). Three per-turn facts: `hist.attacked`,
  `hist.heroDmg`, `hist.banPlay`; a `bancost` pending (optional graveyard banish as an additional cost). Usurp item (b) is
  CLOSED: `effPowerNow` and the Coach count the +2.
- **NEEDS A RULING / OPEN (all recorded in tools/approx.js):**
  - `zero-defence-gear-refused`: CR 7.3.2b says "0 is a value", yet both boards refuse to declare a 0{d} piece, so Olde Leather
    Boots' +2 is unreachable and no pool 0{d} piece can defend. `test/defcap.test.js` pins the refusal. **ASK THE USER.**
  - `dealt-damage-reads-attacks`: Second Strike (a dealt card) fires after a swing blocked to nothing: stronger than printed.
  - `destroy-a-runechant-cost-unasked`: the Robe never asks which Runechant.
  - `test/referee.test.js`'s leak scanner now skips a hex `h` state hash: worth a second look.
  - Usurp (c) "the PLAYER usurped" still has no per-turn fact. Older lists (reader 4 a/b; reader 5 trainer route + AI policy
    for WHEN to open a Gate) still stand.
- **MEASURE:** `node tools/newdecks-census.js`: Viserai rows 35 full / 0 part / 0 none; Prism 21 full / 4 part / 7 none.
- **NEXT: reader 7, the double-faced hero: the LAST thing before Viserai can open.** Scout: nothing in engine/ has two faces
  (grep traverse/face finds only face-down gear and arsenal); staged "Viserai, Between Worlds" and "Viserai, Usurper" are
  separate and unlinked. Traverse = CR 8.5.60 / 8.5.60a, double-faced cards = CR 9.1: quote verbatim when built. Hero -> seat is
  build.js `parseHeroPower` / `heroAbilityLine` (one hero record, one ability shape today). "3 or more Runechants created this
  turn" can read `hist.made`/`madeNames` (must count special Runechants). "created or activated a Gate this turn" needs an
  activation fact. Usurper: "first attack action card with blood debt you play each turn gets go again". The CR does not say
  whether a Young/Demon hero pair shares life or which double-faced category it is: read 9.1 in full first, ask the user if
  unsettled. After 7: the opening release (pin-pool.js takes staged records, DATA_VER bump, formats.json), then Prism.
- **RELEASE NOTES:** pins that moved: v6.42 `approx`, `crindex`, `dichotomy`, `explain`, `sheetdoors`, `slicecensus`,
  `soulcost`, `split`, `wire` tests + audit.json; v6.43 the same plus `condcensus`, `referee`, `runechants` (and WIRE_V 42, 43).
  The permission system refused a SUBAGENT's push to main; the CEO session pushed it after the user approved: ask early.

### PREVIOUS (CEO session_013xG9xApGfLDx12ufVr73HU, 2026-11-16, at v6.41)
- **State:** live = v6.41 on `main` (8ffc0bb), livecheck ALL PASS. Function `table` version 36 = build `v6.41 · sage-v17`,
  stamped; `--check` OK. No unreleased work. Everything in the blocks below still holds. WIRE_V unchanged (41).
- **DONE v6.41, reader 5: the Gate to i'Arathael's grant** (`test/gate.test.js`, sabotaged thirteen ways). `RX_BAN_PLAY` in
  parser.js: a `pickPrompt` over `zone:"banish"`, no `to`, `tgt` (declared at activation, v5.72's route), `banStamp
  {playThisTurn}` -> `_playTurn`, which `playZoneWhy` already reads. "blood debt" joined `KW_VOCAB_SRC`. Both boards' target
  buttons look in banish too. `tools/pin-pool.js` `tokenNames` reads the Gate's whole name.
- **CORRECTION TO THE BLOCK BELOW (ask the engine, not the note):** open item (c) there was wrong. The Gate record IS in the
  pinned pool and Pull from Beyond minted it already; only the ability was unread. Also: EVERY staged blood debt card prints
  its own banished-zone line, so in this deck the Gate changes nothing about what is playable; it matters for Viserai,
  Usurper's "created or activated a Gate this turn" (reader 7), which has NO per-turn fact yet (creation by name exists
  since v5.53; activation does not).
- **OPEN FROM READER 5 (owed before Viserai opens):** the trainer's route for the Gate is undriven; the AI declares a target
  when asked (`abtarget`) but has no policy for WHEN to open a Gate and no reason key. The older open lists (reader 4 a/b,
  Usurp a/b/c) still stand.
- **MEASURE:** `node tools/newdecks-census.js`: Viserai rows 27 full / 8 part / 0 none; Prism 21 / 4 / 7.
- **NEXT: reader 6**, the special Runechants (Runechant of Lust / Sloth, "Runeblade Instant - Aura"): "This counts as a
  Runechant" (`parser.isRunechant`; `usurpTarget` must return CANDIDATES and the cost becomes a `pending`, Usurp open item
  a), "When an attack usurps this, create a Runechant token / it gets go again" (reads `pend.usurped` plus the destroyed
  card), "At the beginning of your action phase or when you play an attack action card, destroy this" (unread);
  "When this is destroyed, create a Runechant token" already reads. Then 7 (hero, traverse), 8 (small conditionals).
- **RELEASE NOTES FOR THE NEXT READER:** a reader that takes a record out of a "reads nothing" set moves SIX pins, all
  read-then-repin: `approx.test.js` (tokens reading nothing), `arenaability.test.js` (census, both halves),
  `dichotomy.test.js` (activation-pick family; the own-card hazard), `speccensus.test.js` (`ANSWER_READS`),
  `stilettos.test.js` (tier counts). The scratchpad does not survive a worker restart: commit to the dev branch before a
  long validation run, and run the chain with the background flag, not `&`.

### PREVIOUS (CEO session_013xG9x8TRjNcbSSsM6xnoj1, 2026-11-15, at v6.40)
- **State:** live = v6.40 on `main` (162578c), livecheck ALL PASS. Function `table` version 34 = build `v6.40 · sage-v17`,
  stamped; `--check` OK. No unreleased work. Everything in the blocks below still holds. **WIRE_V is 41** (was 40).
- **DONE v6.40, reader 4: banish a card, then ask what it was** (`test/banishif.test.js`, sabotaged ten ways).
  Pull from Beyond = new op `banTop` (own deck; colour rider on `op[2]`, `foeBanishTop`'s twin). Embrace Ursur =
  `optCost.classRiders` (list form of Halo's `classRider`; closed class list `RIDER_CLASSES` in parser.js). Corrupted Crown =
  the existing `optCost` defends offer; a bare "card" reads only with banish + the printed hand; `defUid` now rides on a pick.
- **NEW ENGINE FACTS:** (1) what a card prints AFTER an opt waits for the opt: `fxParse` folds a `banTop` into the opt op
  (`op[2].then`), the sheet carries it as `ops`, it runs when the sheet is answered. Only `banTop` is folded; any other op
  after an opt still runs first (no pool card has one: measure again when a new deck prints one). (2) in `defendsTriggers`
  a pick that moves a hand card excludes the caller's `wall` (filter `notUids`); that body must never read `blockH`
  (`test/bravo.test.js`). (3) `test/helpers/v628scenario.js` reads the row's `wireV` back as 40 before hashing, so a
  WIRE_V bump no longer breaks the v6.28 fixture.
- **OPEN FROM READER 4 (owed before Viserai opens):** (a) the trainer's wall is undriven for the Crown (the shared body is
  called, but whether its `wall` holds the player's declared cards there is unchecked); (b) the AI's answers to the two new
  sheets are whatever `judge.autoAnswer` does with an optional pick: unmeasured, needs a reason key; (c) Pull from Beyond's
  payout names the Gate token, which cannot be minted until reader 5 (it logs "no card named" and creates nothing).
- **STILL OPEN FROM USURP (v6.39):** (a) special Runechants make WHICH Runechant a choice: `usurpTarget` must return
  candidates and the cost becomes a `pending`; (b) `judge.effPowerNow` and the Coach do not count the +2; (c) 8.3.49a's
  "the PLAYER usurped" has no per-turn fact.
- **MEASURE:** `node tools/newdecks-census.js`: Viserai rows 26 full / 8 part / 1 none (was 19 / 12 / 4); Prism 21 / 4 / 7.
- **NEXT: reader 5** (the Gate to i'Arathael token and its grant; the token-name scan reads it as "arathael": probe in
  staged.test.js; the token op must resolve a STAGED record, and the judge's db is the pool), then 6, 7, 8.
- **RELEASE NOTES FOR THE NEXT READER:** pins that move with any parser/effects/prompts edit, all "read first, then repin":
  `test/anchors.test.js` (unreached `classifyClause` lines by whole source line; the `runOps` vocabulary count and its
  no-emitter list), `test/slicecensus.test.js` + `test/dichotomy.test.js` (the pick branch of `buildPrompt`),
  `test/promptside.test.js` (a `promptQ` push must be a literal with `side`, a known builder, or `Object.assign(builder(`).
  A prompt field = a WIRE_V bump (wire.js header, `test/wire.test.js`, `test/dichotomy.test.js`). The validation chain in one
  background command takes ~8 minutes; `tools/page.js` (~140 s) afterwards, never beside `npm test`.

### PREVIOUS (CEO session_013xG9xBi58nHH6Jvs5J1qrM, 2026-11-15, at v6.39)
- **State:** live = v6.39 on `main` (34e1a47), livecheck ALL PASS. Function `table` version 32 = build `v6.39 · sage-v17`,
  stamped; `--check` OK. No unreleased work. Everything in the two blocks below still holds.
- **DONE v6.38, reader 2: Blood Debt** (CR 8.3.11 / 8.3.11a). One life per carrier in the seat's own `banish`, in
  `effects.beginEndPhase` step (6a); life loss, not damage. `parser.bloodDebt`, `test/blooddebt.test.js`.
  NEW ENGINE FACT: a beginning-of-end-phase trigger can end the game (`judge.doEndTurn` runs `winCheck` after the triggers and
  returns before step (a); the trainer's `endTurn` / `foeEnd` ask the same).
- **DONE v6.39, reader 3: Usurp** (CR 8.3.49 / 8.3.49a). Paid at the top of `effects.executeInner`, BEFORE `atkTrigAt` is
  captured (the usurped Runechant deals no arcane; the rest pop); +2 is a gain under the cap; the link carries `pend.usurped`.
  "If able" = no question asked. `parser.usurps`, `parser.usurpTarget`, `test/usurp.test.js`.
- **OPEN FROM USURP (owed before Viserai opens):** (a) reader 6's special Runechants make WHICH Runechant a player's choice:
  `usurpTarget` must return candidates and the cost becomes a `pending`; "when an attack usurps this" reads `pend.usurped` plus
  the destroyed card; (b) `judge.effPowerNow` and the Coach (`advisor.js`) do not count the +2, so the AI and the call
  under-read a Gloomblade by 2; (c) 8.3.49a's "the PLAYER is considered to have usurped" has no per-turn fact (no staged
  card asks yet).
- **NEXT: reader 4** (banish-then-colour/type conditionals: Pull from Beyond, Embrace Ursur, Corrupted Crown), then 5-8.
- **RELEASE NOTES FOR THE NEXT READER:** a new `classifyClause` line no pool card reaches is pinned in `test/anchors.test.js`
  BY ITS WHOLE SOURCE LINE. A CR number first cited in engine source needs a drill that names it (`npm run crindex`; repin
  `test/crindex.test.js`, now 93 cited / 83 guarded). `tools/page.js` takes ~140 s; do not run it beside `npm test`.
  The whole validation set chained in one background command takes ~7 minutes.

### NEW DECKS — READ THIS FIRST (CEO session_013xG9x9uyRyTvTysrhdXW6D, 2026-11-15, at v6.37)
- **State:** live = v6.37 on `main` (9d61853), livecheck ALL PASS. Function `table` version 28 = build `v6.37 · sage-v17`,
  stamped; `--check` OK. No unreleased work. The older block below (v6.36) still holds for everything else.
- **RULINGS (user, 2026-11-15, "Yes to all"):** (1) the pool is NO LONGER frozen at fifteen: a new Silver Age precon joins when
  the engine reads its whole list (`data/formats.json` `dawnblade.growth`); bans and benches still never remove anything;
  (2) pin the new text NOW from the-fab-cube's unmerged branch `usurp-the-shadow-throne` (develop still has 15 sets).
- **THE PLAN is `ROADMAP-NEWDECKS.md` on main.** Order: Viserai, Between Worlds (SBW) -> Prism, Advent of Thrones (SAT) ->
  Outbreak (SLV Mortimer, SFC α-01, 2027-02: spoilers only, no lists; ask the user for `fabrary.net` when lists publish).
- **STAGED, NOT POOLED:** `data/staged.js` (`tools/pin-staged.js`, source = ONE upstream commit; `test/staged.test.js`) holds
  both decks' records. The page does not load it. Readers are built and drilled against it. The day a hero opens, `pin-pool.js`
  must learn to take a record develop lacks from the staged file (that release bumps DATA_VER).
- **MEASURE:** `node tools/newdecks-census.js` (no network). Viserai rows now 12 full / 19 part / 4 none; Prism 21 / 4 / 7.
- **DONE v6.37, reader 1:** "You may play this from your banished zone" (`test/banroute.test.js`). The route already existed
  (`playZoneWhy`, `fx.fromBan`); the soul zone exists too (Boltyn). A reader no pool card reaches must be added to the pin in
  `test/anchors.test.js` ("every parser reading the pool never reaches").
- **NEXT, in order (ROADMAP "Viserai" list):** 2 Blood Debt -> 3 Usurp -> 4 banish-then-colour/type conditionals -> 5 Gate to
  i'Arathael token (the token-name scan reads it as "arathael": probe in staged.test.js) -> 6 special Runechants -> 7 the
  double-faced hero and traverse -> 8 small conditionals. Quote the CR verbatim (rules.fabtcg.com/en/cr/08-keywords/ is reachable).
  Do not cite a CR number in docs before the rule is built (`test/crindex.test.js` pins prose-only citations).
- **Each reader is a full release** (engine file changes -> function redeploy -> stamp -> main -> livecheck), even though no
  dealt card changes. A plain `git push` of docs/data that the page does not load needs no version bump (done once, 817e5c7).

### NEW THREAD: READ THIS BLOCK FIRST (written 2026-11-15 by CEO session_013xG9x9AK7kNX6rG3LLzLuR)
- **State:** live = v6.36 on `main` (e58200c), livecheck ALL PASS. Function `table` version 26 = build `v6.36 · sage-v17`,
  stamped; `--check` OK. SQL 001-008 unchanged. No unreleased work.
- **v6.36 = THE USER'S ANSWERS (2026-11-15), all RULINGS:** (1) NO AUTO-PASS, ever ("gives too much info to the opp"); instead the
  player's own Pass button is GREEN when nothing else can be started and PURPLE when an action point is unspent and something
  could be started (Pass, "Pass — let X block", Done defending, End turn; `data-pass` = free / hold). One reader:
  `judge.moves(g, seat)` (new, read-only; `test/moves.test.js`, sabotaged). (2) THE CONCEDE BUTTON IS REMOVED from the board
  ("It has no place there completely remove it"); the engine action and "closing a started ranked table = concession" stay.
  (3) Forfeit: the absent player loses and the winner waits the clock out; an honour system, nothing to build.
- **NOT DECIDED:** the CR-shaped defend step (defender declares, then the attacker gets priority; engine + AI + wire). The user
  answered the auto-pass route with the colours and did not say "go" on the rework. Asked again; do not start it unasked.
- **NOT DONE:** the trainer's Pass / End buttons (`Battle`) have no colours (table only). A real forfeit claim is still unproven
  on live. There is now no in-game way to concede a casual or AI game except Leave.
- **HOW THIS THREAD WORKED:** inline, no subagents. Scratch deps: the PAGE_DEPS list in `tools/page.js`'s header; playwright from
  `/opt/node-tools/node_modules`. `test/slicecensus.test.js` pins the size of `TableBoard`: repin after reading the diff.
- **Supabase access / EVERY RELEASE / parked AI items / known limits:** unchanged, see the archived sections below.


## Superseded handoff (CEO session_013xG9x9AaVs72uwn8QKys7W, at v6.86; archived 2026-11-24 by session_013xG9xBhp1ZDNBkoYpUuM35)

### (was) HANDOFF (CEO session_013xG9x9AaVs72uwn8QKys7W, 2026-11-24 late, at v6.86)

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



## HANDOFF ARCHIVE (CEO session_013xG9xADa79zsMdfx4Ha7Ri, superseded 2026-11-23 at v6.73)

### (was) HANDOFF (CEO session_013xG9xADa79zsMdfx4Ha7Ri, 2026-11-22, at v6.72)

**State:** live = **v6.72** on `main`, livecheck ALL PASS. Function `table` version 96 = `v6.72 · sage-v19`, stamped, `--check` OK.
**WIRE_V 49**. DATA_VER sage-v19. 17 heroes. Approximation ledger: 0 open. Pool 455/455.
Ladder v6.69 (816 games, 48 each): briar 81 prism 76 kayo 71 dorinthea 60 azalea 59 enigma 57 dash 50 fai 48 viserai 42 bravo 42
blaze 39 arakni 38 gravy 37 boltyn 32 iyslander 30 lyath 28 viseraibw 24. 0 refusals / violations / stalls (2 draws). Noise band max 9.

**Shipped v6.70:** Bravo SPXARSPAY (arsenal never stores a card next turn cannot pay, `judge.arsenalPayable`) + SPXFLIPCRUSH
(hero flip only when the rider applies, before the attack; `judge.arsTurnPays`, one body `parser.arsGrantMet`): **309 -> 371 of
768**. Dash's 19/199 changed arsenal steps are late-game empty-deck cases (correct; 12 seeds neutral). Trainer chaos v6.69 clean.
**The new shape to hunt: a free/cheap ability the policy never looks at** (Bravo's flip; Fai's Fealty 221/0 — worker A on it).

**Shipped today (v6.69):** SPXCLOAK (`cloakPay`: Spellfire Cloak pays an off-turn cost when the seat's own line, played out
both ways, pitches fewer cards; Iyslander 287->308, Blaze 246->270 of 768 at 24 seeds/chair; phone p95 9 ms) and SPXSTIRIDLE
(advice fix: an arsenal Stir with no taker is held; `judge.instantNextTakers`). Measured NOs: Blaze energy off-turn, Viserai BW
Runechants off-turn, Boltyn charge-keep. **The off-turn lesson held four times; the Cloak is its positive form (a resource
that is not a card).** Latent: Energy Potion (Dorinthea, Fai) would need cloakFirst to scan `sd.board`; no game reaches it.

**Lesson sweep (worker A, `experiments/census/offsweep.js`, rerun after any off-turn policy change):** every off-turn play from hand,
forked to see what its pitch would have done. Only defence plays pitch next turn's card >70%. Both candidates NOISE at 24 seeds:
H36 Lyath boo only for leak >= 2 (230 -> 228 of 768; the Might token pays), H37 hold 1-point defence reactions (blaze +6, enigma -4,
iyslander +4). `experiments/H36-H37-NOTES.md`. Off-turn pitch is now closed as a lever.

**H38 Fai Fealty — ZERO effect (`experiments/H38-fai-fealty-NOTES.md`):** spending Fealty fires but changes nothing, because
**`judge.keepsActionPoint` cannot see CONDITIONAL go again** (cond-gated `ga`: drac2 Cinderskin Devotion / Hot on Their Heels /
Enflame / Display Loyalty, lifeLt Scar for a Scar). **SPXCONDGA SHIPPED v6.71: Fai 431 -> 464 of 768**; 13 heroes print gated ga;
Fealty on top still noise (H40, `experiments/H40-*`).

**Never-sweep v6.70 (worker B, 16 heroes, legal>=50 / used<=5%):** the "free ability never looked at" shape does NOT recur.
Own-turn abilities are used or have nothing to pay; off-turn ones all cost a hand card (out by the lesson). Leads: Blaze Aether
Quickening 1/96 played; Dash Hyper Driver 51/2 (expected noise, skipped). **H39 SPXARCRANK NEGATIVE** (rank arcane by landed
damage vs attack power minus expected block): Blaze 136->109, Iyslander 134->116 of 384. **LESSON: blocked damage still has value —
it costs the foe hand cards. Never rank on landed damage alone.** `experiments/H39-arcane-rank-NEGATIVE.patch` (has judge.arcaneSoakOf).

**Rules-gap audit v6.70 (worker B):** audit 455/455 full, 0 one-clause gaps, no noop that matters. ONE real bug: **Out Pace
("can't be defended by equipment") was enforced only in the trainer — FIXED v6.72 (CR 1.0.2)** (`fx.noEquipDefend` read at index.html, no judge reader): at the
table 18 equipment defends in 48 Dash games that should be illegal. Worker B fixing (parser reader, one body, judge.legal). Also:
failstates.js/sweep.js grep only index.html for keyword carriers — 44 stale false positives; fix in a separate commit.

**Gated-op census (worker A, `experiments/census/gated.js`):** of ops under `conds`, power (effPowerNow), ga (v6.71) and life
are read gated-now; token/draw/gainKw/arcane/buffNext are not read at all. Next: Lyath Mocking Blow's on-attack self-boo makes its
own +4 (worker A, SPXBOOSELF). Dorinthea Hit and Run: CLOSED NO (deck runs only the blue +1; Dawnblade's swing never keeps the AP
when H&R is legal: 0 swing-first chances in 96 games).

**WORKERS IN FLIGHT (assigned 2026-11-22 ~21:50Z by CEO session_013xG9xADa79zsMdfx4Ha7Ri, env_011rwpp2MyBTt3cEsZKDoVGk):**
- `session_013xG9xCPAciqbr5nPRbgoCS` (Opus) — shipped SPXSTIRIDLE (v6.69), SPXARSPAY/SPXFLIPCRUSH (v6.70); now SPXBOOSELF (Lyath) — pushes ONLY `ship/fai-fealty` (and its earlier ship/* branches).
- `session_013xG9x8VDdx8D1FfSJq5SjC` (Opus) — shipped SPXCLOAK (v6.69); trainchaos clean; SPXARCRANK negative; shipped Out Pace (v6.72); Hit and Run closed NO; now the ONE-BOARD LOGIC sweep (trainer-inline rules vs judge) + chaos d8 on `ship/oneboard`.
Both report via send_message to the CEO; neither pushes main. A limit stop sends NO report: check with get_session
(status_bucket failed) / list_events and nudge. A new CEO tells both its session id. The CEO replays + re-validates + ships.

**NEXT, in order:**
1. ~~Blaze off-turn, energy -> arcane cast~~ **CLOSED NEGATIVE (worker A, 2026-11-22)**: ~95% of what an off-turn cast spends is
   next turn's card (taker held into the next opp turn 4%, its pitch cards 6%); 12 seeds own/other of 192: off 64/61, first window
   48/49, late window 57/50, lethal-only 64/61. 0 refusals/violations. Cards limit Blaze, not energy; his hero banishes from HAND,
   so no arsenal version exists. `experiments/H33-blaze-energy-offturn-{NEGATIVE.patch,NOTES.md}`, census/blazeoff-*.js.
2. Chaos, further: trainer (`node tools/trainchaos.js '' 3 3`, ~45 min, after any `Battle` change); table salt d7 CLEAN (289 games, EPS 0.3, 0 findings, 2026-11-22); next salt **d8**; staged decks
   wait for Outbreak (`tools/staged-play.js`).
3. Weakest seats, by census (worker A, 2026-11-22; `experiments/H34-H35-NEXT3-NOTES.md`): Iyslander's low-use cards are blue
   pitch/blockers doing their job. **MISPLAY:** Stir the Aetherwinds cast off-turn from the arsenal (SPXOPPARS) 16x/96 games, each
   pitching hand cards, never followed by a Wizard card. SPXSTIRIDLE (`judge.instantNextTakers`) is win-noise (24 seeds 287->284 of
   768) but corrects the call: worker A is finishing it (drill + CALL_WHY) to ship as an advice fix. Viserai BW Runechant of
   Lust/Sloth off-turn: NEGATIVE (114 -> 94 / 100 of 384; destroyed at his action phase, never usurped). Viserai BW and Lyath look
   like deck ceilings. Boltyn: worker B. Unmeasured, low value: Gate to i'Arathael activation (98/0, 71/0).
4. ~~Spellfire Cloak as the off-turn payment~~ **SHIPPING v6.69 (worker B, SPXCLOAK, key `cloakPay`)**: census 70/130 of Iyslander's
   off-turn pitches were one card for one last point with the Cloak legal. v2 plays the seat's own line out both ways (opponent
   passes only) and spends the piece only when fewer cards are pitched. 24 seeds/chair: Iyslander 287->308, Blaze 246->270 of 768.
   Boltyn: charge-keep (`experiments/H33-boltyn-chargekeep-NOISE.patch`) 238->244 noise; Glisten off-turn not a line; deck ceiling.
5. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it (view.js).
6. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).


## SUPERSEDED HANDOFF (CEO session_013xG9xAXQ9r9hWnresN2KmP, 2026-11-22, at v6.62)

**State:** live = **v6.62** on `main`, livecheck ALL PASS (at v6.60 a first run reported 1 failed check that reruns did not
reproduce — watch for a flaky server-table check). Function `table` version 76 = `v6.62 · sage-v19`, stamped, `--check` OK. **WIRE_V 46**
(`hist.dmg`). DATA_VER sage-v19. 17 heroes. Session branch `claude/determined-curie-6rl15k` == main.

**Shipped v6.62:** SPXARSPOW (`judge.arsenalPower`): the arsenal step ranks on power FROM the arsenal, so Lyath's Power Play
(+5 from arsenal) is stored and swung (Lyath 126 -> 127, noise; ships for the advice). Ladder clean. Note: `never.js` does not
count arsenal plays reliably — `experiments/census/arsenal.js` / `arsenal-trace.js` follow the stored card instead.

**Shipped v6.61:** a zoomed card's keywords open their CR rules (`CardKw` in `CardModal`, every board); the hero sheet prints the
hero card's ability verbatim. page.js 88/88. **Settled: Sharp is NOT worse on Viserai BW** — own seat only (`SPXLA=viseraibw`) he
wins 277/384 vs the rule policy's 115 (the v6.59 "104" had Sharp in every seat); the wall search is worth 69 of those.

**Shipped v6.60** (CHANGELOG has every number):
- **Keywords on the hero banner/sheet, tap for the CR definition.** `cards.deckKeywords` (from `card_keywords`, params folded,
  deck-building keywords out) + `cards.crKeyword` over **`data/crkw.js`** — pinned verbatim from CR chapter 8 by
  **`tools/pin-crkw.js`** (130 rows; `--check` each release cycle, CLAUDE.md says so). Drill test/crkw.test.js; page.js 86/86.
- **Rules: `dealtDmg` reads `hist.dmg`** (damage that landed, hero or ally) — approx `dealt-damage-reads-attacks` CLOSED (open 1 left:
  `destroy-a-runechant-cost-unasked`, which never arises: the Robe is in Viserai's list, the special Runechants in Viserai BW's).
  Briar 164 -> 156 of 192 (Second Strike no longer goes again after a blocked swing). Ladder clean.
- **SPXBANFIRST**: on a power/cost tie the banished copy is played first (Viserai BW 114 -> 115, ships for the advice).
- Ruled out: Sharp skipping the Embrace Ursur lead (keeps it 13/16); Viserai BW's Gloomblades in banish (never left unplayed at
  end of turn; misses are fair rankings). Censuses: `experiments/census/sharprider.js`, `over.js`, `banins.js`.

**NEXT, in order:**
1. The in-game peek (`PeekDock`, tap-to-close) shows no keywords; a newcomer mid-game meets "Phantasm" there first. A keyword line
   that does not steal the closing tap (POLISH condition 1) — design it at 393x852 before building.
2. AI census next targets: the weakest ladder seats (Viserai BW 22, Lyath 29, Iyslander 32 of 96). Lyath's other rows: Brothers in
   Arms 47/8, Act of Glory 27/5 (own turn) — run `instead.js`. Then Iyslander.
3. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). **A better census asks what was played INSTEAD**
(`experiments/census/instead.js <hero> <card>`, new): legal-vs-used counts flag cards that simply lost a fair ranking. Prompt answers
hide too: grep the census for `declineOptional` per sheet `src`. A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min (Sharp: prefix `SPXLA=all`, ~15 min at 12 seeds). **A subGate is ON when its env var is
empty** — an experiment you do not ship must be deleted, not left gated. After pushing main, curl until the page serves the new
APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.

## SUPERSEDED HANDOFF (CEO session_013xG9xA52ADmXDnyNU3TXDV, 2026-11-21, at v6.56)

**State:** live = **v6.56** on `main`, livecheck ALL PASS. Function `table` version 64 = `v6.56 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/intelligent-galileo-46nta8` == main.

**Shipped this thread — v6.56, the AI spends what it held** (five gates, CHANGELOG has every number):
SPXPIECE (0-defence resource piece pays for the next play: Garland/Blossom), SPXGLISTEN (`judge.weaponPumpOf`; Glisten before the
swing, and a weapon ranks on printed power + its +1{p} counters), SPXBOOTS (`gaNextPiece`, `nonAtkHeld`: Boots -> non-attack keeps the
point -> attack), SPXCROWN (`discardDrawPiece`: Carrion Crown's discard is free when the ally plays from the graveyard), SPXPOLARITY
(`effects.lifeNow` / `judge.lifeGainOf`: a life gain is played when its "instead" is true). Ladder vs gates off: **Gravy 30 -> 40,
Boltyn 23 -> 28, Viserai BW 18 -> 21**; 0 refusals/violations/stalls. Drill: test/gearpolicy.test.js.

**Measured and RULED OUT this thread (don't chase again):**
- **Glisten at the close of the opponent's turn:** equal to the start of his own turn (counters last to HIS end phase either way).
- **Holding Arcane Polarity until it is worth 4** (and out of the attack reaction window): 80 -> 64 of 384. It clogs hand AND arsenal.
- **Gravy deploys allies before hand attacks:** 165 -> 143 of 384.
- Arakni's ladder dip with SPXPIECE on (47 -> 38) is the field: her own seat A/B'd level (164 vs 163).

**NEXT, in order:**
1. **The attacking reaction window casts the cheapest instant as a "pump"** (`reaction()` in sparring.js, `rxAttack`): when NOT
   defending there is no `defendsNow`-style filter, so any legal instant goes (that is how Polarity was spent for 1). The defending
   side was fixed by QUEUE v4 H8. A narrow test (life gains only) measured negative because it also held the card; try a filter of
   "affects this link" (a judge reader, `pumpsNow`) as its own gate, A/B several heroes — expect it to matter for Briar/Viserai/BW.
2. **Compass of Sunken Depths** (Gravy): legal on 433 opposing turns, used 0 ("{t}: look at the top card"). The AI uses no info;
   only worth it if the look feeds Sharp's mask (view.js). Probably skip.
3. **Gravy's Timesnap Potion** 63 / 2 and **Jittery Bones** 69 / 8; Boltyn's **Flat Trackers** 53 / 5 (destroy: Agility token).
   Run `never.js <hero> 1` first — the probe is ~1 min a seed.
4. Viserai BW is still bottom (21): Runehold Release 157 / 23 (destroy: Runechant) and Runechant of Lust/Sloth at opp turn 0 / ~40 —
   the latter is the suspense shape (expect negative).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

## HANDOFF ARCHIVE (CEO, 2026-11-15, at v6.35) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

### NEW THREAD: READ THIS BLOCK FIRST (written 2026-11-15 by CEO session_013xG9xBLTcXdm4N76msAF64)
- **State:** live = v6.35 on `main` (3e45fbe), livecheck ALL PASS (median 297 ms, p95 493). Function `table` version 24 =
  build `v6.35 · sage-v17`, stamped; `--check` OK. SQL 001-008 unchanged. No unreleased work.
- **v6.35 = THE USER'S SEVEN ANSWERS (2026-11-15), all RULINGS now:** (1) `FORFEIT_MS` = 7.5 minutes; (2) the clock is a
  CHESS CLOCK, on whoever must decide, NEVER paused ("I do expect it to be tricky") - `judge.waitingOn` and the stamp are
  UNCHANGED (engine truth: in the defend step the attacker holds priority until it passes, CR 7.3.3, then the defender);
  the attacker's button now reads "Pass — let <hero> block" so a polite attacker knows the table waits on that tap;
  (3) the 0-turn lobby forfeit stays; (4) short games count - honour system, "let chaos reign"; (5) a named phone may redeem a
  recovery code - "as much freedom as possible to start"; (6) ladder floor 3 / top 50 / last 10 stay; (7) the two liveranked
  test players and their one result were DELETED from the project (results 0, rated players 0 afterwards).
- **OPEN, the honest remainder of (2):** while the attacker has not tapped Pass, the defender's thinking burns the ATTACKER's
  clock. A true fix needs one of: the page passing for an attacker who has nothing but Pass (needs a legal-action
  enumerator; reveals "no instant in hand" by speed), or a CR-shaped declare-then-priority defend step in `judge.js`
  (engine + AI + wire change). Not built; told to the user.
- **ALSO OPEN:** Concede is offered only in the defend step and asks no confirmation (a misclick is a ranked loss); a real
  forfeit claim has never been waited out on live (offline only); `tools/serverpage.js` now derives its clock jumps from the limit.
- **HOW THIS THREAD WORKED:** inline, no subagents (small release). Scratch deps for `tools/serverpage.js`: the PAGE_DEPS
  list in `tools/page.js`'s header; playwright from `/opt/node-tools/node_modules`.
- **Supabase access / EVERY RELEASE / parked AI items / known limits:** unchanged, see the archived section just below.

## HANDOFF ARCHIVE (CEO, 2026-11-15, at v6.34) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

### NEW THREAD: READ THIS BLOCK FIRST (written 2026-11-14 by CEO session_013xG9xCQHaLR2DeWf3gSrzu)
- **State:** live = v6.34 on `main` (cd326b5), livecheck ALL PASS (push 40, fallback 0, median 293 ms, p95 395). Function
  `table` version 22 = build `v6.34 · sage-v17`, stamped; `--check` OK. SQL 001-008 all RUN on the project (re-running 004
  or 006 restores old function bodies: run 007 again after). No unreleased work. THE S4/S5 PLAN IS COMPLETE.
- **v6.34 = S5.3 SHIPPED** (`server/S5-LOG.md`, `docs/progress/v6.34.md`): public `{op:"ladder"}` (`008_ladder.sql`
  `ladder_get`, read-only): top 50 named players with >= 3 ranked games, rating desc / games / name; the caller's own line;
  last 10 results. Ladder screen from the first screen, the server table screen and the name sheet. No caching.
- **FULL RANKED GAME PROVEN ON LIVE** (`NODE_PATH=/opt/node-tools/node_modules node tools/liveranked.js --go`, ALL PASS,
  2026-11-15): two fresh players, ranked table, concession, 1216/1184 in `me`, both end screens, recent results, ladder
  floor. It LEFT on the project: players Lcmwh6nttgH / Lcmwh6nttgG (1 game each), one result row visible under "Latest
  games". Do not run it routinely (each run adds two players and a public result). Offered the user to delete them.
- **v6.33:** forfeit clock (ranked, claim-based, `FORFEIT_MS` 5 min, `judge.waitingOn`), close of a started ranked game =
  concession, recovery keeps a throwaway with a ranked footprint. **v6.32:** ranked tables, Elo 1200/K32 (`006`).
  **v6.31:** board names, 5-table cap, close.
- **STILL UNPROVEN ON LIVE:** a real 5-minute forfeit claim (offline only).
- **ASKED THE USER, UNANSWERED (defaults are what is built):** (1) forfeit limit 5 min? (2) pause the clock in the defend
  step? today it runs on the ATTACKER (CR 7.3.3, they must pass) — CEO recommends pausing; (3) a 0-turn lobby forfeit after
  both heroes are chosen — keep? (4) friends trading concessions — a minimum game length? (5) refuse a recovery redeem when
  the phone's own player already has a name? (6) ladder floor 3 / top 50 / last 10 — keep? (7) delete the two test players?
- **NEXT (no order given by the user yet):** act on the answers above; a live forfeit proof needs a clock override or a
  5-minute wait; the Concede button exists only in the defend step (found by liveranked) — worth a look; parked AI items.
- **Subagents hit the 5-hour limit silently (status failed):** work is committed step by step; resume with SendMessage after reset.
- **v6.30 = S4.3 SHIPPED** (`server/S4-LOG.md`, CHANGELOG, `docs/progress/v6.30.md`): ops `recovery-mint` (code shown once,
  15 chars / 74 bits, only its SHA-256 stored, 730 days, a new code retires the old) and `recovery-redeem` (the new phone's
  sign-in is re-pointed to the code's player in one transaction; its throwaway player is deleted; wrong/used/expired = one
  answer; 8 wrong tries per sign-in per hour = limited; refused while the throwaway is seated at a table the page lists).
  Name sheet has "Get a recovery code" / "I have a code". WIRE_V stays 40.
- **NEXT, in order:** S5 ranked
  (results/ratings written only by the function, Elo 1200, forfeit clock, leaderboard).
- **ASKED the user 2026-11-14, unanswered (default built = allowed):** a phone whose player already has a NAME and redeems a
  code gives that player up (name freed). Refuse instead?
- **KNOWN LIMITS:** the seated-throwaway check only knows the tables the page sends (a seat at an unlisted table is left
  with a deleted player); each livecheck run leaves one named player ("Lc…") on the project and uses 4 of the 30
  anonymous sign-ins per hour per address; a LOST refresh answer can still cost the session (now recoverable by code);
  two tabs of one browser are one player.
- **USER ANSWERS (2026-11-14, "Yes to all"), still standing:** recovery code is enough for the first ladder (no email/Google);
  cap 5 open tables per player; names unique; one player on two phones: last one wins.
- **HOW THIS THREAD WORKED (user asked: low context, cheaper Claudes do the work):** the CEO stays thin; ONE in-session
  `sonnet` subagent per feature with a self-contained brief (read CLAUDE.md + S4-LOG, commit after every step, offline only,
  no push/deploy, release prep included, factual report); the CEO re-runs npm test/scenes/fairness, reads the SQL, runs the
  SQL + deploys + stamps + pushes main + livecheck. Session branch fast-forwarded into `main`. The user is kind and brief.
- **Supabase access:** the access token lives ONLY in the environment's credential store for `api.supabase.com` (worked all
  session). Approved scope: this project only, the SQL files, the function `table`, the auth switch. Nothing else without asking.
- **EVERY RELEASE:** validate -> run any new SQL -> bundle + deploy `table` (folder variant, multipart, DEPLOY.md) +
  `--stamp` (commit the stamp) -> push main -> `NODE_PATH=/opt/node-tools/node_modules node tools/livecheck.js` -> CI
  `drills` green -> update this section.
- **Parked AI items:** Lyath (`experiments/lyath-*`, `lyath2-*`; lead = aura pumps unseen by `effPowerNow`). Unverified: the
  4x-throttled phone bound for Sharp after v6.24.

## HANDOFF ARCHIVE (CEO, 2026-11-14, at v6.29) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

### NEW THREAD: READ THIS BLOCK FIRST (written 2026-11-14 by CEO session_013xG9x96ShtY8zh3QNW5NzA)
- **State:** live = v6.29 on `main` (3662cce), livecheck ALL PASS (both phones signed in; push 42, fallback 0, median 287 ms,
  p95 404). Function `table` version 12 = build `v6.29 · sage-v17`, stamped; `supabase-bundle --check` OK. No unreleased work.
- **v6.29 = S4.1 + S4.2 SHIPPED** (`server/S4-LOG.md`, CHANGELOG, `docs/progress/v6.29.md`): anonymous sign-in is ON in the
  project; `002_players.sql` + `003_names.sql` are RUN; the page signs in lazily at a server table (`servertable.supabaseIdentity`,
  session kept under `who.id`); a seat belongs to its player; same player on a second phone takes the seat (old phone reads
  "taken"); player names via `{op:"me"}` (`whoAmI`/`setName`), UNIQUE on `referee.nameFold` (capitals, spaces, look-alikes);
  a name at a join is refused; the lobby shows both names. Sign-in failing = a casual table, as v6.28.
- **VERIFIED live:** `PATCH .../config/auth {"external_anonymous_users_enabled":true}`; `POST /auth/v1/signup {}`;
  `POST /auth/v1/token?grant_type=refresh_token` (bad token 400); `/auth/v1/user` (bad token 403); `identity_resolve` and
  `player_rename` through the function (two real anonymous players, look-alike name refused).
- **NEXT, in order:** S4.3 recovery code (`recovery` table + `recovery_use` exist in 002; needs: a function op that mints a
  code for the signed-in player and one that redeems it INTO the new phone's anonymous identity, a sheet on the page, livecheck
  covers reclaim) -> names on the board during the game (lobby only today) -> cap 5 open tables per player -> S5 ranked
  (results/ratings written only by the function, Elo 1200, forfeit clock, leaderboard).
- **KNOWN LIMITS (told to the user):** identity is per phone until S4.3; a LOST refresh answer can cost the session (Supabase
  rotates refresh tokens) = a new player; two tabs of one browser are one player (cannot hold both seats of a table);
  30 anonymous sign-ins per hour per address, no captcha.
- **USER ANSWERS (2026-11-14, "Yes to all"), still standing:** recovery code is enough for the first ladder (no email/Google);
  cap 5 open tables per player; names unique; one player on two phones: last one wins.
- **HOW THIS THREAD WORKED:** one session did the work inline (no subagents), commit after every step, branch
  `claude/inspiring-ritchie-630ocp` fast-forwarded into `main`. Scratch deps it needed: `@electric-sql/pglite` (sql-pglite),
  `deno` (rehearse), PAGE_DEPS with the exact versions in `tools/page.js`'s header. The user is kind and brief.
- **Supabase access:** the access token lives ONLY in the environment's credential store for `api.supabase.com` (worked all
  session). Approved scope: this project only, the SQL files, the function `table`, the auth switch above. Nothing else without asking.
- **EVERY RELEASE:** validate -> bundle + deploy `table` + `--stamp` (commit the stamp) -> push main ->
  `NODE_PATH=/opt/node-tools/node_modules node tools/livecheck.js` -> CI `drills` green -> update this section.
- **Parked AI items:** Lyath (`experiments/lyath-*`, `lyath2-*`; lead = aura pumps unseen by `effPowerNow`). Unverified: the
  4x-throttled phone bound for Sharp after v6.24.

## HANDOFF ARCHIVE (CEO, 2026-11-14, at v6.28) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

### NEW THREAD: READ THIS BLOCK FIRST (written 2026-11-14 by CEO session_013xG9xCPR11GYcDV7QGiWyX, which is ending)
- **State:** live = v6.28 on `main` (dc2ee48), CI green, livecheck ALL PASS. The hosted server table (Supabase)
  is OPEN to everyone and fast (user's two-phone test: "things happen in an instant now").
- **Unreleased work:** branch `claude/amazing-franklin-ycg51z` = main + 5 commits (S4.1 sign-in core, offline;
  `server/S4-LOG.md`). Start from that branch. `supabase-bundle --check` is STALE there by design.
- **USER ANSWERS (2026-11-14, "Yes to all"):** (1) ENABLE anonymous sign-in on the Supabase project — approved,
  NOT yet done (try Management API `PATCH /v1/projects/fokcpzplomjsraquaaid/config/auth`, UNVERIFIED field name;
  else ask the user to flip the dashboard toggle); (2) a recovery code is enough for the first ladder (no
  email/Google yet); (3) cap 5 open tables per player; (4) display names UNIQUE (case-folded); (5) one player on
  two phones: last one wins. Also confirmed earlier: no legal target -> unplayable (RULING 2026-11-13); the four
  independent-effect cards (Edict of Steel, Preserve Tradition, Pass Over, A Drop in the Ocean) were asked about
  and never contradicted.
- **NEXT, in order:** S4.2 (page signs in lazily when a server table is opened + display-name sheet; run
  `002_players.sql`; redeploy; verify `mkIdentify` against the real `/auth/v1/user`) -> S4.3 recovery code +
  livecheck covers reclaim -> table cap -> S5 ranked (results/ratings written only by the function, Elo 1200,
  forfeit clock, leaderboard). Plan details: the S4 bullets below and `server/S4-LOG.md`.
- **HOW THIS THREAD WORKED (user asked for low context + cheapest agents):** the CEO stays thin; every job goes
  to an in-session `sonnet` subagent (haiku for read-only scouting) with a self-contained brief, "commit after
  every step" (containers restart without warning; work in worktrees/branches survived every time), no push;
  the CEO reviews the report, fast-forwards `main`, runs livecheck, confirms CI. The two old Opus worker
  sessions were never woken. The user is kind and brief: ask at most a few plain questions, recommend an answer.
- **Supabase access:** project URL/key are public (below). The access token lives ONLY in the cloud
  environment's credential store for `api.supabase.com` (still saved as of this writing; the user may revoke
  it — then ask again through request_credential, never chat). Approved scope so far: this project only, the
  SQL files, the one function `table`, and now enabling anonymous sign-in. Nothing else without asking.
- **EVERY RELEASE:** validate -> push main -> re-bundle + redeploy `table` + `--stamp` when APP_VER/DATA_VER or
  a bundled file changed (the page and function must report the same build) ->
  `NODE_PATH=/opt/node-tools/node_modules node tools/livecheck.js` -> CI `drills` green -> update this section.
- **Parked AI items:** Lyath (two diagnoses filed: `experiments/lyath-*`, `lyath2-*`; lead = aura pumps unseen
  by `effPowerNow`). Unverified: the 4x-throttled phone bound for Sharp after v6.24.

- **Live: v6.28** (WIRE_V 40, DATA_VER sage-v17). Progress reports: `docs/progress/v6.27.md`, `v6.28.md`.
- **v6.28: THE SERVER TABLE IS OPEN TO EVERYONE** (user, 2026-11-14: "Go ahead and open it up"; project is
  unannounced). `SERVER_TABLE.on: true`; `?server=0` hides it on one phone. After every push run
  `NODE_PATH=/opt/node-tools/node_modules node tools/livecheck.js` (live page + function build + a real two-seat
  game in Chromium; the env now allows the live page and its CDNs). v6.28 livecheck: ALL PASS, 40/40 by push,
  median 284 ms, p95 561. NEXT: S4 sign-in (needs the user's OK to enable anonymous sign-ins in Supabase).
- **S4.1 BUILT, UNRELEASED** (session branch `claude/amazing-franklin-ycg51z`, ahead of main; `server/S4-LOG.md`):
  `referee.join` takes `identity:{token,name?}` via `deps.identify`; seat owners in the row (ROW_V 3, reads v2;
  casual rows stay v2, byte-identical to v6.28); takeover retires the old key; `validateName`; draft
  `server/supabase/002_players.sql` (PGlite ok, NOT run on the project); entry `mkIdentify` UNVERIFIED, undeployed.
  `supabase-bundle --check` reads STALE on that branch by design. Plan: S4.2 page signs in lazily + name sheet
  (needs anonymous sign-in ON) -> S4.3 recovery code -> S5 ranked (results/ratings written only by the function).
  ASKED 2026-11-14, unanswered: (1) enable anonymous sign-in? (2) recovery code enough, no email/Google?
  (3) cap 5 open tables per player? Open design: unique names? two phones of one player = last one wins.
- **CEO since 2026-11-13: `session_013xG9xCPR11GYcDV7QGiWyX`** (Fable; user asked for LOW CONTEXT and the cheapest
  agents: in-session haiku/sonnet subagents did v6.23; the two Opus workers were NOT woken, still standing by).
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** workers in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO; replay each ship/* branch onto main
  with cherry-pick (only the fix commits, never experiments/ commits), re-validate, CEO alone pushes main, confirm
  CI `drills`. Workers hit the 5-hour limit with NO report: get_session (status_bucket failed), nudge after reset.

**v6.16:** grantHold (`SPXGRANTPAY`, `judge.grantTakers` o.idlePick, key `grantHold`): a grant waits when no
swing it pumps can be paid for. Lost dagger grants 19→6; Arakni rule 12.33→13.00, Sharp 24.33→26.00 (3 seeds).
Ladder 0/0/0/0. CI green on main 53f7c7c (drills run 42534449390, live URL verified).
**v6.17:** grantBeforeSwing (`SPXWPNFIRST`): with only a weapon swing to follow, a grant that pumps it goes first.
Census 100→0 (Dorinthea 85). Dorinthea 18.00→19.00 (+1 every seed), Viserai 12.33→13.00, Arakni 13.00→13.67. Ladder 0/0/0.
**v6.18:** `parser.arsenalPutSource` + `test/arsenalsrc.test.js` + invariant COUNTERS-INTO-ARSENAL: no pool card moves
a permanent arena→arsenal (hand/deck only), so the counters-route item is CLOSED. No behaviour change. Ladder 0/0/0.
Sharp reaction search PARKED after pass 2 (`experiments/sharp-reactions-2.patch` 798f59e: Dor −1.00, Gravy −0.50 at 6 seeds).
**v6.19:** Line Crossers scoped re-pin (`pin-pool.js --only`; lifeTie reads "as (a|another) hero"); DATA_VER
sage-v16. NOT taken: Hyper Inflation yellow/blue power drift (decks play red only) — `pin-pool --check` says STALE
until a deliberate full re-pin. Ladder 0/0/0.
**CEO SUCCESSION:** session_013xG9xCnjwgSC6P9f3uUE9W hit the lineage-depth limit (8); the USER is starting a Fable
CEO thread from a fresh session. The new CEO tells both workers its id. Referee host: user asked which is cheapest —
answer Cloudflare Workers + DO (free plan, no pause; Supabase free projects pause after 7 idle days); awaiting confirm.

**v6.23:** full re-pin (38 records; no deck-played text/number moved; Hyper Inflation item CLOSED) + Silver Age
legality DERIVED from the pinned DB (`tools/silver-age.js`, drill in `test/formats.test.js`): 9 bans, Briar as
`kind: hero`, `benched` null (the DB has no bench field). Residual in DESKTOP-TASKS.md: fabtcg.com unread (403).
**H-LYATH-ATTACK DIAGNOSED, nothing shipped** (`experiments/lyath-attack-census.js`): 414/14,148 own-turn first
actions differ rule vs Sharp; gap is DIFFUSE (attack search ~+6 wins/seed, blocks ~+4). Largest single class
attack->attack ~+2.5/seed: rule ranks printed power then cost, Sharp picks cost-0 attacks with conditional
self-pumps (Mocking Blow +4 once booed). SPXNETPOW (power minus cost) PARKED: Lyath +0.83 @12 (t 2.1) but Bravo
-1.17 (t -2.9), Gravy -1.00; `experiments/lyath-netpow-NEGATIVE.patch`. NEXT IDEA (unbuilt): a judge reader for a
card's EFFECTIVE power now (conds live inline in `effects.execute`; needs a dry-run), ceiling ~+2.5/seed.
**v6.24:** effPower (`SPXEFFPOW` default ON, `effects.condMetNow` one body, `judge.effPowerNow`, key `effPower`):
hand attacks rank by the power they would have NOW (decidable-and-true self-pumps only; 22 of 38 cond entries
decided, 16 stay printed: pumped, reprise, discard6way, chargedPitch, pitch6, defLt, chainLinkGe, hasGa, pitchBlue).
Rule: Lyath +0.67 @24 (t 2.64); fai/bravo/viserai/iyslander/boltyn noise @24, blaze/briar noise @12; 7 heroes
byte-identical. Sharp @6: lyath +1.33 (t 1.58), no loss. Ladder 0/0/0. NOT RE-RUN: the 4x-throttled phone p95
(unthrottled 12-18 ms per searched decision; step cap untouched). Probes: `experiments/effpow-*`, `sharp-ab/`.
Lyath's remaining gap: activate-first (133 diffs) and free non-attack first (65) classes — undiagnosed.
**v6.25:** (i) RULING (user, 2026-11-13) no legal target -> unplayable; was already built at v6.00, gap closed for
Scuttle Toes' ability (`effects.playTargetWhy` untapAlly). ASKED, unanswered: confirm it covers Edict of Steel,
Preserve Tradition, Pass Over, A Drop in the Ocean (independent effects). (ii) SERVER S1: `server/referee.js`
`handle(request, deps)` — stateless, rehydrates the hub from a stored row per request, version check, per-seat
broadcast; fakes `test/helpers/serverfakes.js`; drill `test/serverref.test.js`; ~20 ms/action, cold 82-93 ms
(Node/Deno), row <= 77 KB; log `server/S1-LOG.md`. (iii) LEAK FIXED: uid-KEYED maps (`weaponUsed`, `counters`,
`hist.wpnHits`) are redacted in `view.js` `redactKeyed`; charge pending `picked` scrubbed in `referee.js`;
scanners now read uids inside KEYS. 210-pair sweep clean.
**SERVER = SUPABASE (user, 2026-11-13).** Project `https://fokcpzplomjsraquaaid.supabase.co`, publishable key
`sb_publishable_E-p8S8CA_F2C-RD25nLiuw_xPZttEAu` (both public). Host is on the env allowlist; auth health 200,
no functions deployed, anonymous sign-ins OFF. NEVER ask for the service-role key or an access token in chat
(request_credential or dashboard). PLAN: S2 page transport + "join a server table" vs the fake (no account
needed) -> S3 SQL migration + deploy + two-phone smoke + keep-alive ping (free projects pause ~7 idle days)
-> S4 anonymous sign-in, seat = auth.uid() -> S5 = H4 ranked. Supabase API details are UNVERIFIED (docs
unreachable; verify at S3). ASKED, unanswered: casual table first? paused-project fallback to the direct
table OK? deploy via this env (needs api.supabase.com + token) or the user's dashboard?
**v6.26 — THE SERVER TABLE IS DEPLOYED (2026-11-14), behind a tester's door.** Supabase function `table`
(verify_jwt off; folder bundle 25 files/3.5 MB; health `GET /functions/v1/table` reports the build) + SQL
`public.tables`/`table_put` (RLS forced, 0 policies; rows idle > 48 h deleted on create). Page: `engine/servertable.js`,
`window.SERVER_TABLE.on` false; `?server=1` opts a phone in (`?server=0` forgets). Per-seat public channels with
derived names + HMAC seal over CANONICAL JSON (Realtime re-sorts keys). Live: median ~190 ms, p95 ~440 ms, cold ~530 ms.
Keep-alive: `.github/workflows/keepalive.yml`. Logs: `server/S3-DEPLOY-LOG.md`, `server/supabase/DEPLOY.md`;
repeatable live drill `tools/supabase-live.js`. Also fixed: the page never registered the card DB with the judge
(`DawnJudge.setDb`) so its own replay could not find tokens.
- **EVERY RELEASE: re-bundle + redeploy + `--stamp`** (CLAUDE.md Release). Needs a Supabase access token in the
  env credential store for `api.supabase.com` (user may have revoked it after v6.26: ask via request_credential,
  never chat). Until redeployed, the server table's handshake refuses.
- **v6.27 (2026-11-14):** the user's two-phone test WORKED but moves took up to ~5 s to reach the other phone.
  Cause: `servertable.loadSupabase` asked the PROJECT address for supabase-js, so no browser ever got a push
  (drills injected the library). Fixed + 2 s fallback heal while push is down; real page in Chromium vs live:
  push 234 ms median, p95 475. Function v7 = build v6.27, stamped. `server/PERF-LOG.md`. UNEXPLAINED: user saw
  <=5 s where the bug measured ~20 s. ASKED the user to re-test.
- **RE-TEST PASSED (user, 2026-11-14, v6.27):** "Like night and day ... things happen in an instant now." A real
  two-phone server game works and is fast. ANSWERED: opened in v6.28.
- **(superseded) two-phone test address:** `https://dawnblade-ai.github.io/dawnblade-ai/?server=1`
  (UNVERIFIED: a real phone browser's websocket + the jsdelivr supabase-js path). If it passes: flip `on: true`.
- **NEXT:** S4 anonymous sign-in (currently OFF in the project), seat = auth.uid(), private channels; then H4 ranked.
**H-LYATH2 DIAGNOSED, PARKED** (`experiments/lyath2-NOTES.md`): Sharp's pre-attack plays are all Instants or
the hero ability. Ceilings @12: free instant first +1.83, hero ability first +1.17. Blanket rules lose (always
hero ability first -2.17). `judge.instantFirst` (SPXINSTFIRST, dry-run + effPowerNow) faded: +0.92 @12, +0.58
@24, +0.18 @72 (t 1.09) -> NOT shipped (`experiments/lyath2-instantfirst-ship-OFF.patch`). LEAD: Suspense is an
aura pumping the first attack each turn; effPowerNow cannot see aura pumps.

**CLOSED / PARKED (v6.16 wave):**
- **H-OVERBLOCK** CLOSED, not a misplay: filter −1.83 (t −3.19); Sharp price SPXOBPRICE 1/2/4 → +0.00/−0.17/−1.17.
  Patches `experiments/spxoverblock.patch`, `spxobprice.patch`.
- **H-SHIELD** PARKED: SPXSHIELD2 (hold only at the attacker's last link at an ally; `judge.linkLastAtAlly`) at 12
  seeds split rule 6.50→5.92 (t≈−2.2) vs Sharp 7.92→8.42 (t≈+1.7). Patch `experiments/spxshield2.patch` (982bc26
  on ship/s-items-counters-scout). Own-turn casts feed Gravy's watery-grave engine; go-again ally links fire 20/22.

**IN FLIGHT (2026-11-10):**
- **H-GRANTSWING-LYATH FIXED in v6.20:** `judge.grantedSwings` counts a grant only when no hand/arsenal attack could take
  it. Lyath 8.00=8.00 (12 seeds 7.33→7.42); Arakni/Dorinthea gains hold; 12 heroes byte-identical.
- **SPX GATE AUDIT CLEAN** (RXFIT, GRANTPAY, WPNFIRST, IDLE, PAY, SOAK, LOOK; own seat, rule, all 15, 3 seeds): no
  resolved loss; Blaze/SOAK −1 at 3 seeds → −0.17 (t≈−0.5) at 12 = noise. SPXLABOARD all-hero audit (Sharp seat): gains lyath +3,
  enigma +3, blaze +1.67, bravo +1.33, boltyn +1, iyslander +0.67; fai/dash/briar flat; arakni noise (−0.25 @12);
  AZALEA FIXED in v6.22: foe-side debuff tokens carry `madeBy` and count for the maker (Azalea 23.67→24.08 @12;
  Gravy/Viserai gains hold). WIRE_V 40.
  `session_013xG9xAMN9v4UxqgJGzXBSH` STANDING BY.
- **H-BOARD SHIPPED v6.21** (`SPXLABOARD`, key laBoard): Sharp's laEval prices permanents by printed numbers. Gravy
  7.75→13.25 /28 (t 4.89, 12 seeds), Viserai 23.17→25.42, Kayo +1, Dorinthea +0.67; phone p95 ≤103 ms. bW tuning:
  KEEP 1 (0.5 = same; 2 loses: Gravy −3.17, Viserai −1.67 at 6 seeds). Census #3 stays parked (hidden-info gamble).
  Lyath RULE walls PARKED (SPXFODDER, `experiments/spxfodder.patch` 13e6e97: −2.33 at 3 seeds both variants; Lyath's
  halved {p}/{d} make the hand look like threats; Sharp's block edge needs its action search). Lyath's
  defender buff PARKED (SPXDEFBUFF, `experiments/spxdefbuff.patch` 10f4d34: −2.67 / −1.00 at 3 seeds; the own-turn
  Might rider is worth {r}{r}). Lyath's Steady gap is attack play, not walls or the buff.
  `session_013xG9xCgDniyTy1T4jVmNfK`: Azalea fixed (v6.22); STANDING BY for the server deploy.
- Census also: Lyath's gap is POLICY (rule 9/84 vs Sharp 41/84); Gravy's is mostly deck. Rare and parked: Sharp dies to a
  go-again follow-up after relying on a reaction (4/1,260).
- Wins/84 at v6.18 (Sharp seat vs the 14 others): briar 83, bravo 76, dorinthea 76, kayo 75, dash 74, arakni 72, azalea 72,
  iyslander 69, viserai 69, fai 64, enigma 62, blaze 58, boltyn 57, lyath 41, gravy 28.
- **LESSON:** a policy gate must be A/B'd own-seat on EVERY hero it can fire for, not just the target heroes.

**WAITING ON THE USER (asked 2026-11-08, re-asked at v6.15 and v6.16):** (1) server for the referee: Cloudflare
Workers+DO (recommended), Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until
they answer. (2) a real two-phone (and judge) game — DESKTOP-TASKS.md. If they report, act on it first.

**NEXT:** the server deploy (a WebSocket URL + "join a server table"), then **H4 · ranked** (HIDDEN-HANDS.md
§6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** parked: sudden death · carried UNRESOLVED: Blaze soak (shipped because it corrects the call).

## HANDOFF ARCHIVE (CEO, 2026-11-08, at v6.15) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.15** (WIRE_V 39). Progress reports: `docs/progress/v6.14.md`, `v6.15.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** unchanged (workers in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO, replay each ship/* branch
  onto main, re-validate, CEO alone pushes main, confirm CI `drills`). Workers hit the 5-hour limit with NO
  report: get_session (status_bucket failed) and nudge after the reset.

**v6.15:** grantSwing (`SPXGRANTSWING`, `judge.grantedSwings`, key `grantSwing`): a weapon a pending grant
pumps ranks at its pumped power. H-DAGGER: lost dagger grants 34/38 → 19/39; Arakni rule 11.67→12.67, Sharp
23.00→24.33; Dorinthea 16.67→18.00 (3 seeds). Ladder 0/0/0/0.

**AI OPEN:**
- **H-OVERBLOCK** CLOSED, measured not a misplay: filter −1.83 (t −3.19); Sharp price SPXOBPRICE 1/2/4 →
  +0.00 / −0.17 / −1.17 (t −2.13) at 12 seeds. Patches `experiments/spxoverblock.patch`, `spxobprice.patch`.
- **SHARP REACTIONS** (ASSIGNED, H3 author): extend Sharp's search into reaction windows (H-SHIELD's real fix).
- **H-SHIELD** Gravy's Throw Caution on ally attacks: PARKED. SPXSHIELD lost wins (own-turn casts feed his
  watery-grave engine; ally links with go again fire 20/22). SPXSHIELD2 (hold only at the attacker's LAST link
  at an ally; `judge.linkLastAtAlly`, key rxAllyLastHold) at 12 seeds: rule 6.50→5.92 (t≈−2.2), Sharp
  7.92→8.42 (t≈+1.7). Opposite directions, not shipped; patch `experiments/spxshield2.patch` (982bc26 on
  ship/s-items-counters-scout). Real fix = Sharp searching reaction windows (bigger item).
- **H-DAGGER residue:** 19 grants still lost, 0 of them correct trades (Up Sticks played with no affordable swing to
  follow; 7 turns made no attack after it). ASSIGNED to the AI worker.
- **UNRESOLVED (carried):** Blaze soak A/B 12 seeds (8.50→8.25, t≈−0.8), shipped because it corrects the call.

**WAITING ON THE USER (asked 2026-11-08, re-asked at v6.15):** (1) server for the referee: Cloudflare
Workers+DO (recommended), Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until
they answer. (2) a real two-phone (and judge) game — DESKTOP-TASKS.md. If they report, act on it first.

**WORKERS (both report to the current CEO):**
- CEO since 2026-11-08 (after v6.15): `session_013xG9xCnjwgSC6P9f3uUE9W`.
- `session_013xG9xCgDniyTy1T4jVmNfK` (Opus, H3 author): H-OVERBLOCK closed; ASSIGNED Sharp reaction-window
  search; first in line for the server deploy.
- `session_013xG9xAMN9v4UxqgJGzXBSH` (Opus, AI, pushes ONLY `ship/s-items-counters-scout`): ASSIGNED H-SHIELD
  re-think DONE (parked); now ASSIGNED the H-DAGGER residue.

**NEXT:** the server deploy (a WebSocket URL + "join a server table"), then **H4 · ranked** (HIDDEN-HANDS.md
§6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** a board→arsenal move would keep counters (no route today) · Line Crossers re-pin ·
parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-08, at v6.14) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.14** (WIRE_V 39). Progress reports: `docs/progress/v6.13.md`, `v6.14.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** unchanged from the archive below (workers in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO,
  replay each ship/* branch onto main, re-validate, CEO alone pushes main, confirm CI `drills`). Workers hit the
  5-hour limit with NO report: get_session (status_bucket failed) and nudge after the reset.

**v6.14:** rxFit (`SPXRXFIT`, key `rxFit`): defending, the reaction that alone covers the leak goes first.
Enigma rule 13.67→14.50 (6 seeds, t≈3.5), Sharp noise. FEED-7 CLOSED: Bravo's Carapace order was already right
since v5.99; `test/payorder.test.js` pins it on both boards.

**AI OPEN (from the v6.14 census, Sharp, 84 games/hero):**
- **H-SHIELD** Gravy's Throw Caution: 14 of 20 unused shields were cast at attacks on his ALLIES (CR 7.3.2a).
  A hold (SPXSHIELD, linkAtAlly + own-turn self-shield) cut unused 20→1 but lost wins at 12 seeds (rule
  6.25→5.50, t≈−1.7; ally-only 6.25→5.75). Not shipped. Patch in worker session_013xG9xAMN9v4UxqgJGzXBSH's
  scratchpad. Suspects: a shield still catches a later hero hit; Pirate-card synergies.
- **H-DAGGER** Arakni: Up Sticks and Run's +4 dagger grant lost when Danger Digits throws the dagger (51/38/8).
- **H-OVERBLOCK** Enigma: block-step planning blocks a hand card, then casts a reaction that alone covered it.
- Probe artefacts, not misplays: Lyath/Enigma wards as "grantExpired", Gravy resFizzle, Blaze Absorb rider.
- **UNRESOLVED (carried):** Blaze soak A/B 12 seeds (8.50→8.25, t≈−0.8), shipped because it corrects the call.

**WAITING ON THE USER (asked 2026-11-08):** (1) server for the referee: Cloudflare Workers+DO (recommended),
Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until they answer. (2) a real
two-phone (and judge) game — DESKTOP-TASKS.md, never tested on real PeerJS. If they report, act on it first.

**WORKERS (both report to the current CEO):**
- `session_013xG9xCgDniyTy1T4jVmNfK` (Opus, H3 author): IDLE, standing by for the server deploy.
- `session_013xG9xAMN9v4UxqgJGzXBSH` (Opus, AI, pushes ONLY `ship/s-items-counters-scout`): assigned
  H-DAGGER at v6.14; merges main (dc44922) in first.

**NEXT:** the server deploy (a WebSocket URL + "join a server table"), then **H4 · ranked** (HIDDEN-HANDS.md
§6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** a board→arsenal move would keep counters (no route today) · Line Crossers re-pin ·
parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-08, at v6.13) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.13** (WIRE_V 39). Progress reports: `docs/progress/v6.12.md`, `v6.13.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** workers as cloud sessions in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO at once, Sonnet
  mechanical / Opus rules-AI-design; workers push `ship/*` and report under 30 lines via send_message. The CEO
  **replays each branch onto current main** (cherry-pick; regenerate CR-INDEX.md on conflict with
  `npm run crindex`, never hand-merge it), re-validates there (suite fail 0 / skipped 5, scenes, fairness,
  babel if index.html's babel blocks moved, `tools/page.js` for UI, `TWOPHONE_SEED=N node tools/twophone.js`
  + `... judge` for table work, `tools/serverrun.js` DENO=<bin> for referee work, the 630-game ladder), is the
  only one who pushes main, and confirms CI (`drills`). Page deps + deno go in a scratch dir (tools/page.js
  header; `npm install --prefix <dir> deno`). **WIRE_V:** the second branch to ship takes the next number.
  **Workers hit the 5-hour usage limit and a limit stop sends NO report.** Check idle workers with
  get_session (status_bucket failed) and nudge them. Tell them to push after every green fix.
  **Never instruct a worker to force-push** (the auto-mode classifier blocks it): have it merge main in.

**v6.13:** FEED-7 play-line order (Big Bertha, Oasis Respite; `test/feedorder.test.js`) and one SPX gate per
AI misplay fix (SPXPAY, SPXIDLE, SPXSOAK, SPXLOOK inside SPXFIX). Dorinthea's v6.10 jump is ALL the Bolters fix.
**UNRESOLVED (carried):** Blaze soak A/B at 12 seeds (8.50→8.25, t≈−0.8), shipped because it corrects the call.

**WAITING ON THE USER (asked 2026-11-08):** (1) server for the referee: Cloudflare Workers+DO (recommended),
Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until they answer. (2) a real
two-phone (and judge) game — DESKTOP-TASKS.md, never tested on real PeerJS. If they report, act on it first.

**WORKERS IN FLIGHT (both assigned 2026-11-08 ~15:00Z by CEO session_013xG9xAQUh8vzsEbNZBXUNs):**
- `session_013xG9xAMN9v4UxqgJGzXBSH` (Opus, AI, may push ONLY `ship/s-items-counters-scout`): misplay census
  of the AI hero for Fai, Enigma, Arakni, Blaze, Gravy, Lyath; fix the top one or two via judge readers, each
  its own SPX gate + CALL_WHY key; A/B own seat 3 seeds (6–12 if unresolved), ladder. Merges main in first.
- `session_013xG9xCgDniyTy1T4jVmNfK` (Opus, H3 author): FEED-7's Bravo case ("paid 1 and tapped Magmatic
  Carapace" prints before the pitch, pay-sheet path) on `ship/feed-order-bravo` from cace5fc; drill both
  boards; ladder identical. Reuse it for the server deploy once a provider is chosen.

**NEXT:** the server deploy (a WebSocket URL + "join a server table"), then **H4 · ranked** (HIDDEN-HANDS.md
§6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** a board→arsenal move would keep counters (no route today) · Line Crossers re-pin ·
parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-08, at v6.12) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.12** (WIRE_V 39). Progress reports: `docs/progress/v6.11.md` (v6.10–6.11), `v6.12.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** workers as cloud sessions in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO at once, Sonnet
  mechanical / Opus rules-AI-design; workers push `ship/*` and report under 30 lines via send_message. The CEO
  **replays each branch onto current main** (branches are often cut from an older main), re-validates there
  (suite fail 0 / skipped 5, scenes, fairness, babel if index.html's babel blocks moved, `tools/page.js` for
  UI, `TWOPHONE_SEED=N node tools/twophone.js` + `... judge` for table work, `tools/serverrun.js` DENO=<bin>
  for referee work, the 630-game ladder), is the only one who pushes main, and confirms CI (`drills`).
  Page deps + deno go in a scratch dir (tools/page.js header; `npm install --prefix <dir> deno`).
  **WIRE_V:** two branches may bump it to the same number; the second to ship takes the next number.
  **Workers hit the 5-hour usage limit and a limit stop sends NO report.** Check idle workers with
  get_session (status_bucket failed) and nudge them. Tell them to push after every green fix.
  The AI worker may push ONLY to `ship/s-items-counters-scout` (its designated branch).

**v6.10:** six carried AI misplays fixed (judge readers `landsNothing`, `gaAbilityRedundant`/`linkGoesAgain`,
`payBuysGoAgain`, `soakPolicy` card price; gates SPXFIX/SPXSOAK). **UNRESOLVED:** Blaze soak A/B at 12 seeds
(8.50→8.25, t≈−0.8), shipped because it corrects the call. **v6.11:** hand reveals public (`_kh`). **v6.12:** `judge.takerPlays` (boots' taker), `judge.lookChoice` (SPXLOOK).

**WAITING ON THE USER (asked 2026-11-08):** (1) server for the referee: Cloudflare Workers+DO (recommended),
Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until they answer. (2) a real
two-phone (and judge) game — DESKTOP-TASKS.md, never tested on real PeerJS. If they report, act on it first.

**WORKERS IN FLIGHT:**
- `session_013xG9xAMN9v4UxqgJGzXBSH` (Opus, AI): idle. **TO SHIP:** `d701b61` on `ship/s-items-counters-scout`
  (one gate per fix: SPXPAY, SPXIDLE beside SPXSOAK/SPXLOOK, all inside SPXFIX; default unchanged). Replay
  onto main, suite + ladder, push (no APP_VER bump needed). Dorinthea's 11.67→17.33 is ALL the Bolters fix
  (per-seed [9,13,13]→[18,17,17], identical with only SPXPAY on). Free for the next AI item.
- `session_013xG9xCgDniyTy1T4jVmNfK` (Opus, H3 author): idle. **TO SHIP:** `ship/feed-order` @ `fb4b61e` (from
  900e2f1): FEED-7 play-line order, effects.execute only (Big Bertha's boost line + trigger now after the
  declaration line via `boostAfter`; Oasis Respite's play line before its riders). Drill
  `test/feedorder.test.js` (5, sabotaged). Worker's run: suite 0 fail/5 skipped, page.js 78/78, ladder
  identical to baseline. Replay onto main, re-validate (incl. page.js and twophone), ship as v6.13.
  Open from FEED-7: Bravo's "paid 1 and tapped Magmatic Carapace" prints before the pitch (pay-sheet path) —
  offer it to this worker. Reuse it for the server deploy once a provider is chosen.

**NEXT:** the server deploy (a WebSocket URL + "join a server table"), then **H4 · ranked** (HIDDEN-HANDS.md
§6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** a board→arsenal move would keep counters (no route today) · trainer QA for Fai,
Enigma, Arakni, Blaze, Gravy, Lyath · Line Crossers re-pin · parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-08, at v6.09) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.09** (release `b6a5529`; then `607c7fc` seeded/strict page drives; report `b579ca6`).
  Progress report: `docs/progress/v6.09.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** workers as cloud sessions in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO at once, Sonnet
  mechanical / Opus rules-AI-design; workers push `ship/*` and report under 30 lines via send_message; the CEO
  re-validates on the MERGED tree (suite fail 0 / skipped 5, scenes, fairness, babel, `tools/page.js` screens,
  `tools/twophone.js` + `tools/twophone.js judge` with `TWOPHONE_SEED` for table work, `tools/serverrun.js`
  with DENO=<binary> for referee work, the 630-game ladder), is the only one who pushes main, confirms CI.
  Page deps + deno install into a scratch dir (tools/page.js header; `npm install --prefix <dir> deno`).
  **Workers hit the 5-hour usage limit and a limit stop sends NO report** — check idle workers with
  get_session (status_bucket failed) and nudge them; tell them to push after every green fix.

**H3 SHIPPED (v6.08–v6.09):** judge mode (`engine/hub.js`, LOBBY_V 3: a third browser holds the deck, both
phones blind, seat keys, seed from all three); `net.refereeHost` serves N seats; host/judge save every commit;
`net.wsAdapter` + Workers-shaped isolate (`test/helpers/isolate.js`) + Deno prove the referee server-side.
`test/helpers/blind.js` is THE blindness check (names every legitimate grant: `_kb _kt _kh`, Scout's look,
both-seat reveals); twophone fails hard on it after every action. v6.08: counters reset on leaving the arena
(`game.resetLeavers`), Scout the Periphery reads the target's deck (WIRE_V 37).

**WAITING ON THE USER (asked 2026-11-08):** (1) server for the referee: Cloudflare Workers+DO (CEO's
recommendation), Supabase Edge (also H4 accounts), or neither — needs an account; build nothing until they
answer. (2) a real two-phone (and judge) game — DESKTOP-TASKS.md, never tested on real PeerJS.

**WORKERS IN FLIGHT:**
- `session_013xG9xAMN9v4UxqgJGzXBSH` (Opus) — the six carried AI misplays (Refraction Bolters go-again, soak
  pitching, Bolt'n Boots on an arrow with go again, Gravy's boots taker, Enigma Uphold, Frost Spike) on
  `ship/ai-misplays`, each measured per CLAUDE.md. It hit the usage limit once with nothing pushed; resumed.
- `session_013xG9xCgDniyTy1T4jVmNfK` (Opus, H3 author) — standing by; reuse it for the server deploy.

**NEXT:** the server deploy once a provider is chosen (a WebSocket URL + a "join a server table" button), then
**H4 · ranked** (HIDDEN-HANDS.md §6: accounts, Elo, result authority, forfeit clocks).

**SMALLER OPEN ITEMS:** hand-reveal variants beyond foeReveal/fusion (clash, Strongest Survive…) not marked
known (stay hidden, the safe side) · Scout's AI choice is always the opponent's deck (not weighed) · a
board→arsenal move would keep counters (no route today) · play-line ORDER in the feed (Big Bertha / Oasis) ·
trainer QA for Fai, Enigma, Arakni, Blaze, Gravy, Lyath · Line Crossers re-pin · parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-07, at v6.07) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.07** (main `843053b`; report `beec9cf`). Progress report: `docs/progress/v6.07.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** workers as cloud sessions in env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO at once, Sonnet
  mechanical / Opus rules-AI-design; workers push `ship/*` and report under 30 lines via send_message; the CEO
  re-validates on the MERGED tree (suite fail 0 / skipped 5, scenes, fairness, babel, `tools/page.js` screens
  + FAILs, `tools/twophone.js` for table work, the 630-game ladder), is the only one who pushes main, then
  confirms CI. **Loop any new multi-game drill (≥10x) before trusting it** (v6.07's candidate flaked 1 in 2).
  The account's 5-hour usage limit can stop a worker: tell workers to push each increment as soon as it is green.

**H2 SHIPPED (v6.03–v6.07):** sha256 + sealed throw (LOBBY_V 2); `engine/referee.js` host authority; the
two-phone table runs through it (guest holds only its view, seed commit-reveal, pause/persist/resume/rejoin,
post-game reveal + Verify this game); honest "host's phone holds the deck" line; AI table filters feed by
`feedTo`; known top `_kt` / known in hand `_kh` (game.js KNOWN_MARKS). WIRE_V 36.
**RULINGS (user, 2026-11-07), now in view.SWITCHES:** SOUL_PUBLIC true, OWNER_SEES_INTIMIDATED true,
PITCH_ORDER_PUBLIC false. Soul public moved Azalea's Sharp −0.25/14 over 12 seeds (all vs Boltyn).

**NOT YET TESTED:** two real phones over real PeerJS (every check used a stubbed network). Worth a
DESKTOP-TASKS.md entry or asking the user to play one game across two phones.

**NEXT — H3 · neutral referee (M–L, 2–3 sessions):** the same `referee.js` in a third browser (judge mode
for a store table) and proven server-side behind `net.wsAdapter`. Scope and drills: HIDDEN-HANDS.md §6.
Then H4 (ranked: accounts, Elo, result authority).

**SMALLER OPEN ITEMS:** NEW: counters bag outlives its card leaving the arena (Malefic Incantation bounced
to hand may re-enter with stale counters — S-item) · hand-reveal variants beyond foeReveal/fusion (clash,
Strongest Survive…) are not marked known (stay hidden, the safe side) · Scout the Periphery reads "target
hero's deck" but the engine looks at the actor's own deck (S-item, rules). CARRIED: six AI misplays (Refraction
Bolters go-again, soak pitching, Bolt'n Boots on an arrow with go again, Gravy's boots taker, Enigma Uphold,
Frost Spike) · play-line ORDER in the feed (Big Bertha / Oasis) · trainer QA for Fai, Enigma, Arakni, Blaze,
Gravy, Lyath · Line Crossers re-pin · parked: sudden death. RESOLVED this thread: page.js screen count (AI
table now seeded in drives; 73/73) and the 4 old layout FAILs (absent on every v6.03–v6.07 run).

## HANDOFF ARCHIVE (CEO, 2026-11-07, at v6.02) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.02** (main `501bc4f`, Hidden hands H1). Progress report: `docs/progress/v6.02.md`.
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
- **HOW TO WORK:** unchanged from the v6.01 handoff below (workers as cloud sessions in
  env_011rwpp2MyBTt3cEsZKDoVGk, at most TWO at once, Sonnet mechanical / Opus rules-AI-design, workers push
  `ship/*` and report under 30 lines via send_message, the CEO re-validates on the merged tree, is the only
  one who pushes main, then confirms CI test + deploy). **Count page.js screens, not just FAILs**
  (v6.02: 72 vs 73 — an opportunistic check dropped out when the AI's path shifted).

**H1 SHIPPED (v6.02):** `engine/view.js` on the page; `view(state, seat)`; `CARRIERS` census; own deck as
composition (`_unordered`), foe `unseen`/`unseenGear`; known slots `_kb` (`judge.clearKnown`); laMask =
`determinize(view)`; per-seat `revealed._to` + `feedTo` game key; WIRE_V 34. Drills: `test/view.test.js`.

**NEXT — H2 (L), FIRST SHIPPABLE:** `engine/referee.js` run by the host; guest gets views + per-seat commits;
WIRE_V 35; slot handles for P3; desync canary on view hashes; seed + throw commit-reveal (pure-JS SHA-256);
post-game seed/log reveal with "verify this game" replay; UI filters the feed by `feedTo`; honest UI line
"host holds the deck". Scope and drills: HIDDEN-HANDS.md §6 (on main since v6.02). One Opus worker.
**H1 leftovers to fold into H2:** a known slot for a revealed top card (the table never clears `revealed`),
a card a reveal showed in a hand, Brain Freeze's hand-to-top.

**RULINGS (user, 2026-11-07) — the three view questions are ANSWERED:** SOUL_PUBLIC = true ("Yes"), OWNER_SEES_INTIMIDATED = true ("Yes"), PITCH_ORDER_PUBLIC = false ("No"). Being built by the H2 worker (session_013xG9xCX29A7TysLXVsSQNC) as `ship/h2-rulings` → v6.03, measured (SOUL_PUBLIC moves Azalea's Sharp), then H2 continues on top.

**SMALLER OPEN ITEMS:** NEW: Scout the Periphery reads "target hero's deck" but the engine looks at the
actor's own deck (S-item, rules) · Azalea Sharp −0.89 over 9 seeds vs v6.01 (t −1.5, unresolved; all from
the hidden soul) · page.js: 4 pre-existing layout FAILs (jump rows' hit areas 42 < 44, a crowded table action
bar) and the table skip-hit-area check is path-dependent — make it deterministic. CARRIED: six AI misplays
(Refraction Bolters go-again, soak pitching, Bolt'n Boots on an arrow with go again, Gravy's boots taker,
Enigma Uphold, Frost Spike) · play-line ORDER in the feed (Big Bertha / Oasis) · trainer QA for Fai, Enigma,
Arakni, Blaze, Gravy, Lyath · Line Crossers re-pin · parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-07, at v6.01) — superseded by the section above

**Keep this section SHORT (under ~50 lines).** History lives in the archived handoffs below, CHANGELOG.md
and `docs/progress/` on main. Do not start a root handoff file.

- **Live: v6.01** (main `5beae0e`). Progress report: `docs/progress/v6.01.md` (covers v5.73 -> v6.01).
- **MISSION (user, 2026-11-07):** the ultimate FaB Silver Age precon competitive gaming environment and
  judging engine — 100% fan-made, non-profit, for fun and glory, no ads, forever.
- **CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread."
  Each shipped release wave -> `docs/progress/vX.YY.md` on main + a fresh CEO session from this handoff;
  the old CEO stands down.
- **HOW TO WORK (lessons paid for):** the CEO stays small and dispatches workers as cloud sessions
  (`create_session`, `environment_id` env_011rwpp2MyBTt3cEsZKDoVGk = the `dawnblade-ai` environment,
  which can read rules.fabtcg.com). **At most two workers at once** (five Opus workers spent the weekly
  usage limit in a day once and froze work for four days). Sonnet for mechanical shippers, Opus for
  rules, AI and design. Workers push `ship/*` / `research/*` / `findings/*` branches and report in
  under 30 lines via send_message; the CEO renumbers if needed (APP_VER + CHANGELOG per commit),
  re-validates on the merged tree (suite, scenes, fairness, babel, `tools/page.js`, ladder; plus
  `SPXLA=all` for AI changes) and pushes main. Then confirm CI (test + deploy jobs) green.
- **RULINGS 2026-11-07:** coin = vs AI forever, rock-paper-scissors = ranked ladder · hidden hands is
  a must · a card that needs a target needs a legal one (shipped v6.00).

**NEXT — HIDDEN HANDS (the big project).** Design: `research/hidden-hands` -> `HIDDEN-HANDS.md`,
`engine/view.js` (spike), `test/view.test.js`, `tools/hidden-census.js`, `tools/hidden-spike.js`.
One `engine/referee.js` holds the full state and sends each seat `view(state, seat)` + reveals; judge
stays the one rules body. Spike: 13,231/13,231 actions legal from the actor's own view; 5.8% of steps
need a mid-resolution reveal; 2.2% can't be observer-validated (affordability before pitch).
Leaks to close: game.rng in shared state (future draws computable), uids name cards (decklist index),
the lobby throw is sent in the clear, Compass's private look sits in shared `revealed`.
Census: 117 printings / 87 names touch hidden info, 13 protocol cases (hardest: random pick from a
hidden hand, Flamecall Awakening search+shuffle, legality that reads a hidden hand, Clash, boost).
- **H1 (M):** real `view()` + card-carrier census + scramble drill; laMask = determinize(view); per-seat
  feed and `revealed`.  **H2 (L) FIRST SHIPPABLE:** host-as-referee, WIRE_V 34, seed + throw
  commit-reveal, post-game replay verify; guest sees nothing hidden (host still can — say so in the UI).
  **H3 (M-L):** neutral referee (third device / free-tier server).  **H4 (L):** ranked Elo ladder.
- **QUESTIONS FOR THE USER (asked in docs/progress/v6.01.md):** is the soul public (charge)? may the
  owner look at their face-down intimidated card? is the order of pitched cards on the deck bottom known
  to the opponent? Do not decide without a verbatim CR quote or the user's answer.

**SMALLER OPEN ITEMS:** six AI misplays with causes (Refraction Bolters go-again, soak pitching, Bolt'n
Boots on an arrow with go again, Gravy's boots taker, Enigma Uphold, Frost Spike) · play-line ORDER in the
feed (Big Bertha before the boost banish; Oasis +1 life before the play line) · trainer QA not yet
covering Fai, Enigma, Arakni, Blaze, Gravy, Lyath · Line Crossers upstream rewording waits for a
deliberate re-pin · parked: sudden death.

## HANDOFF ARCHIVE (CEO, 2026-11-02..07, v5.73 -> v6.01) — superseded by the section above

**Keep this section SHORT (under ~50 lines): current state, decisions, who is doing what, next.**
History goes in the archived handoffs below it and in CHANGELOG.md. Do not start a root handoff file.

- **Live: v5.99** (`841f322`). Session start was v5.73 (`218a5fe`). Shipped 2026-11-02: v5.74 pinned pool ·
  v5.75 R8 draw · v5.76 P0 trainer block crash · v5.77 lookahead search on the AI hero (+3.06 of 28,
  t 11.1, 0/0/0; phone p95 96 ms) · v5.78 Sharp/Steady · v5.79 table results/copy · v5.80 layout + 44px
  hit areas · v5.81 feed/voice · v5.82 home-screen icon (original, `icons/`, not standalone) · docs:
  player README, `tools/page-audit.js`, `docs/archive/POLISH-AUDIT-1.0.md` · v5.83 the AI-opponent picker
  gets its own loadout screen (v5.78 had crushed deck trimming to 15px) · v5.84 a per-device W-L-D record
  per AI hero and level (`dawnblade.aiRecord`, engine/local.js) · v5.85 Sharp searches its BLOCKS too
  (+4.58 of 28 over v5.77, t 17.8, held-out +4.72; block p95 125 ms). Arsenal search and K/mu/margin
  tuning did NOT pay (experiments/LOOKAHEAD.md "PHASE (c)").
- **How the CEO works now (context is the scarce resource):** every build/measure job runs in its
  own cloud session (`create_session`, outcome branch `ship/*` or `research/*`), which messages the
  CEO a short report when its branch is pushed. Workers never push `main`; the CEO re-verifies
  (suite, scenes, fairness, ladder) and deploys. One release = one item.

**DECISIONS (user, 2026-11-02):**
- **R8 — YES.** "Nothing at all changes for 20 turns" ends the game as a DRAW even with cards in a
  deck (`blaze-enigma-46`). **SHIPPED v5.75** (`5c5553f`): ladder 0/0/0, same 2 draws; blaze-enigma-46 draws at turn 55.
- **Card data — PINNED POOL ONLY. SHIPPED v5.74** (`aa15b16`): `data/pool.js` (UMD, `window.DAWN_POOL`)
  is the one copy the page loads and every drill requires; no live fetch, no card cache; first load
  23.5 MB -> 1.43 MB. Verified by the CEO: 3896 drills 0 fail 5 skipped, scenes 107/0, fairness clean,
  babel ok, `tools/page.js` 28/28. Open from it: (a) upstream reworded **Line Crossers** ("as a hero"
  -> "as another hero"; the parser reads it part instead of full) — the pool keeps the old text until
  a deliberate re-pin, which must decide whether that is errata or a database fix; (b) the old live
  filter kept 19 extra hero printings (e.g. "Kayo, Berserker Runt"); pin-pool drops them and all 15
  heroes resolve to the same record.
- **Next big project — LOOKAHEAD AI** (chosen over hidden hands for two phones). Phase 1 spike in
  flight on `research/lookahead`: feasibility, one searched decision behind a gate, house A/B.
  Constraints: no hidden information, no card text, deterministic, `explain` keeps reason keys,
  phone budget well under 100 ms a decision.
  **Phase 1 = GO** (`research/lookahead`, `experiments/LOOKAHEAD.md`): own-action search, rule policy
  drives both seats in rollouts, hidden info masked (`laMask`), eval = life swing + 1.5 x cards held.
  Own-seat A/B 12 seeds: every hero up, pooled +2.84 of 28, 12/15 at t>2; ladder 0/0/0 but the
  spread is unchanged (stdev 15.7). **Phase 2 decisions (CEO):** purpose = a STRONGER partner on
  every AI seat (no handicapping strong decks); loadout gets "Sharp" (search, default) / "Steady"
  (rules); phone bound p95 < 150 ms, worst < 400 ms at 4x CPU throttle; ship (a) search default-on,
  (b) the control, (c) arsenal/blocks later, each measured.
- **R9 — UNDECIDED, research needed** (user: "Not sure on that, we'll have to research"). The
  sandbox's network policy blocks `rules.fabtcg.com` and `fabtcg.com`, so the CR text on when an
  activated ability declares its target could not be read. Unblock: the user allows those domains,
  or a desktop session quotes CR 5.2 / the play-steps rule verbatim. Patch still held:
  `experiments/R9-activation-target-declared.patch` (base 71192de; re-pin approx counts on apply).
- **R10 — CLOSED AS STATED (CEO, under the user's trust grant).** Accepting Crank on Dash's
  pregame item would only spend a steam counter for an action point the action phase overwrites
  (`ap:1`), so no player would take it; `start-item-crank-unasked` stays stated, nothing to build.

**QA SWEEP DONE (v5.85):** findings/qa-a (S 4 incl. P1 S-1 dominate vs hand defence reactions, P1 S-2
Sadistic Scowl Intimidate noop at the table; H 5 incl. P1 Azalea bins arrow, P1 Dorinthea passes with AP;
FEED 4; RULING R-a, R-b) and findings/qa-b (no S; H 5 incl. Fai never plays Crouching Tiger; FEED 7;
RULING Preserve Tradition with no target). Trainer feeds NOT COVERED by either reader.
**CR IS REACHABLE (2026-11-06):** the user approved a personal cloud environment `dawnblade-ai`
(env_011rwpp2MyBTt3cEsZKDoVGk) that allows rules.fabtcg.com + fabtcg.com. Start rules work there.
R9 SETTLED by verbatim CR 5.2.2b + 5.1.4a + 1.8.5: targets are declared on activation.
**SHIPPED v5.86-v5.91 (rules-qa):** R9 targets on activation (CR 5.2.2b/5.1.4a/1.8.5; fizzle per 1.8.9 +
5.3.4b; WIRE_V 33) · dominate counts hand defence reactions (8.3.4b) · Intimidate on both boards (8.5.10) ·
life loss is not damage (8.5.12b) · Arakni's bonus read continuously (6.2.3c/d) · Huntsman still marks
after Danger Digits (1.8.3b's own example; reverses v5.17). Quotes in LESSONS.md "CR READINGS".
**NEEDS A RULING (user):** Preserve Tradition / Pass Over with NO legal target: playable? (CR 5.1.4a/5.1.5 do
not say outright; 6.6.6a covers triggers only.) CEO lean: not playable.
**AI-QA SHIPPED v5.93-v5.96:** Fai plays banished cards (banishPlays) · weapons unlock a held resource
piece (resUnlockWeapon) · Sharp re-checks a lucky-deal winner on 4 deals (laLucky; Azalea +2.67/+1.33 t>=3.7)
· honest endTurnKeep / payNoPiece reasons. Did NOT pay: verifying every overrule (-0.37), every lucky winner.
**TRAINER QA (findings/qa-c, v5.96):** 10 games / 9 heroes on the page: 0 crashes, 0 state defects. COACH
P1: the Coach never advises a weapon swing (advisor advCardOut uses isAttack). 3 COACH P2 + 7 FEED/UI.
SHIPPED v5.97 (Coach advises weapon swings) · v5.98 (COACH-2/3/4) · v5.99 (trainer FEED-1..7). Left: FEED-7's
play-line ORDER (Big Bertha before the boost banish; Oasis +1 life before the play line) needs a restructure
of the play path's announce/pitch/trigger order; COACH-5 (P3). Not covered: Fai, Enigma, Arakni, Blaze,
Gravy, Lyath trainer games; a trainer win.
**CI FIX (7a511fd):** the deploy check now waits for the pushed APP_VER (v5.92's red run was Pages lag).
**OPEN H-ITEMS (not built, measured leads):** QA-A H-3 Refraction Bolters never destroyed for go again
(effects.payPolicy/autoAnswer) · H-4 soaks pitch a whole card for 1 point (effects.soakPolicy) · H-5 Bolt'n
Boots on an arrow that already has go again · QA-B H-3 Gravy pays for Mage Master Boots with no taker (needs
a grantTakers-style reader for gear) · H-4 Enigma Uphold · H-5 Frost Spike.
**BUDGET LESSON (CEO, 2026-11-06):** five concurrent Opus worker sessions in one day spent the account's
weekly limit and froze everything for four days. Run at most two workers at once, use Sonnet for
mechanical merges/shippers, and keep Opus for rules reading, search design and audits.
**MISSION (user, 2026-11-07):** "the ultimate FABTCG silver age precon competitive gaming environment and
judging engine. 100% fan made non profit for fun for glory no ads forever."
**RULINGS (user, 2026-11-07):**
- COIN: "Keep the coin flip for now I like the speed of it. Let's plan for the ranked Elo ladder we will use
  rock paper scissors but for vs ai use coin flip." -> vs AI = coin (permanent); RPS = the future ranked ladder.
- HIDDEN HANDS: "Hidden hands is a must." -> the next big project (`peers-hold-full-state`); prerequisite for
  a ranked ladder.
- PRESERVE TRADITION / PASS OVER: "You're right - target required." -> a card whose effect needs a target
  cannot be played without a legal target (CR 5.1.4a + 5.1.5 + this ruling).
**CADENCE (user, 2026-11-07):** "With each version make a progress report and start a new CEO thread." ->
each shipped release wave gets `docs/progress/vX.YY.md` + a fresh CEO session that starts from this handoff.
**OPEN DECISIONS (older; A, PT and hidden hands now RULED above):** (A, USER) the coin screen says "the throw returns for launch" — bring back
rock-paper-scissors for 1.0 or drop the line? (D) SHIPPED v5.84. Parked: hidden hands, sudden death.

**AI policy hunts are paused:** H25, H27, H28, H30, H31 did not ship (the hand-written vein is
thin; detail in the archive below). Their patches are in `experiments/`.

## HANDOFF ARCHIVE (CEO, 2026-11-01, at v5.73) — superseded by the section above

**This section is the handoff.** Root `HANDOFF.md`/`WEEK.md` were retired to `docs/archive/` on
2026-10-31; do not start a new root handoff file — rewrite this section instead.

- **Live: v5.55** (`0813ae7`) plus a docs commit (`9051f58`). Verified: 3742 drills, 0 fail,
  5 skipped; scenes 107/0; fairness clean; both babel blocks compile; 21 engine scripts +
  `.nojekyll` in the pushed commit; CI green on v5.53, v5.54, v5.55. The live URL and the CDNs are
  blocked from the cloud sandbox, so the real page was not driven this session.
- **Shipped this session (CEO thread, Opus):**
  - v5.53 S15: Display Loyalty's Fealty rider reads (`parser.quotedAtkHero`); Fealty reads in full
    (`dracCard` grant + `_drac` stamp; end-phase clock, `hist.madeNames`). Found under it: no ATTACK
    ever entered `hist.playTy`, so Static Shock / Star Fall never counted a Lightning attack. Fixed.
  - v5.54 FEED 21: class/talent capitals (`parser.CLASS_TALENT_WORDS`), riders say what they do
    (`effects.riderWords`), Flying High's colour after the pump. Ladder byte-identical.
  - v5.55 R5 (ruling below): an attack counts its own chain link (`parser.dracNow`,
    `dracLinksNow`, `pend.linked`). 6 seeds vs v5.54: Fai 105 -> 114, nothing else moved > 4.
  - Docs: eleven finished plans/handoffs moved to `docs/archive/` (with an index); `CLAUDE.md` has a
    docs map and derives the version instead of stating it.
- **Round 2 (CEO + Sonnet agents in worktrees, 2026-10-31):** `fe947a8` **`tools/page.js`**, an
  offline harness that drives the real page at 393×852 (CDNs + card DB served locally; deps in a
  scratch dir — see its header). **v5.56** Death Dealer's put never pitches its only arrow + AI
  `resUnlock` (6-seed stalls 2 -> 1). **v5.57** Cloaked card back (`cloaked-display` CLOSED — the
  ledger has 0 open records). **v5.58** H20: the AI cashes arena abilities (`judge.arenaUseful`;
  Lyath 259 -> 296, Gravy 150 -> 172 over 72 paired seeds). Agents do the build and measurement;
  the CEO verifies each patch on main (suite, scenes, fairness, babel, ladder, harness) and pushes.
- **RULED 2026-10-31 (user), in flight with Sonnet agents:**
  > RULING (user, 2026-10-31): *"A match can certainly end in a draw - in the future we may need a
  > sudden death mechanic, there is one in place for tournaments already."*
  > RULING (user, 2026-10-31): V of the Vanguard's bonus includes V itself: *"Yes."*
  - R6 -> the table ends a dead position (both decks empty, nothing changing for N full turns) as a
    DRAW; the ladder reports `draws` apart from `stalls`. Sudden death: record, don't build.
  - R7 -> V of the Vanguard counts itself (closes `attack-grant-misses-own-attack`).
- **SHIPPED after the rulings:** **v5.61** R7 V of the Vanguard counts itself. **v5.62** R6 a dead
  position is a DRAW at the table (`judge.reduce`, 20 still turns, `over.how: "stalemate"`; ladder
  reports `draws` apart from `stalls`; WIRE_V 30). **v5.63** H21b spare-card block (`blockSpare`):
  a deliberate field shift — Kayo 43 -> 68, Bravo 25 -> 37, Enigma 26 -> 37, Blaze 20 -> 30, Gravy
  17 -> 25; Dorinthea 51 -> 30, Arakni 47 -> 31, Boltyn 33 -> 23, Lyath 23 -> 16 (spread unchanged,
  stdev 17.2 -> 17.5). Revert `a1bf6c9` to undo. The losers' own play is unchanged; their chip hits
  now meet blocks. NEXT for balance: Lyath (16) and the chip decks; Briar still leads (79).
- **v5.64** H22 `rxHold`: a defender holds its defence reaction when the wall already stops the hit
  (37-51% of the chip decks' reactions were wasted). Ladder wins at 3 seeds now: briar 79 · kayo 67 ·
  dash 53 · fai 52 · azalea 48 · viserai 46 · bravo 46 · enigma 44 · iyslander 43 · blaze 32 ·
  dorinthea 29 · arakni 27 · gravy 22 · lyath 20 · boltyn 20; 0/0/0, 2 draws. Negatives measured with
  it (not shipped): holding against small leaks, a one-point cushion, skipping an attacker's reaction
  on a lookahead. NEXT for balance: Briar (79) and Kayo (67) lead by a wide margin; Boltyn, Lyath and
  Gravy trail at ~20.
- **v5.65** Jack Be Quick keeps its go again (an answered late prompt puts it on the attacker's
  link). The same audit found NO over-grant behind Briar's or Kayo's lead (census in CHANGELOG):
  their lead is deck and policy. **v5.66** H23 Duty Bound Blitz setup (`gateColour` / `gateKeep` /
  `gateFirst`; Boltyn own-seat 5.92 -> 7.19 of 28, 48 seeds). Ladder now: briar 79 · kayo 67 · dash
  53 · fai 52 · azalea 48 · viserai 46 · bravo 45 · enigma 44 · iyslander 42 · blaze 31 · dorinthea 29
  · arakni 27 · gravy 23 · boltyn 22 · lyath 20; 0/0/0, 2 draws.
- **v5.67** R6 tightened: a repeating dead position (by-name loop tracker `still.loop`, 8-turn ring,
  20 turns) draws; over 10,080 games only `lyath-boltyn-24` is a new draw. WIRE_V 31. **v5.68** H24:
  the AI charges V of the Vanguard with every spare Light card (`judge.chargeMore`; Boltyn t 2.0 and
  3.0 on two 96-seed sets). Ladder identical to v5.66.
- **R8 ASKED of the user (2026-11-01), do not build until answered:** `blaze-enigma-46` stalls —
  Enigma holds a full hand (= intellect) she never plays, so she never draws from the 8 cards left in
  her deck; Blaze has nothing; 1 life each; nothing changes from turn 35. Proposed: "nothing at all
  changes for 20 turns -> draw, even with cards in a deck" (trade-off: two humans idling that long
  get a forced draw).
- **v5.69** H26 `markFirst`: the AI's FIRST hand-ability activation (Reaper's Call marks before a
  stealth attack); Arakni 27 -> 33. **H27 NEGATIVE:** pay with the least-waste card (Gravy 8.00 ->
  3.38 naive, 7.63 value-safe) — highest-pitch-first is right. In flight: the other hand abilities
  the AI never uses (Agile Windup, Arcane Twining, Photon Splicing…).
- **v5.70** the trainer's instant doors ask fusion and X (`trainer-instant-doors-no-declarations`
  CLOSED). **v5.71** Bloodrot Pox payable by pitching (`end-phase-unless-floating-only` CLOSED;
  `endHold` on the table, WIRE_V 32; a dummy's Pox no longer bills the player). Ledger: 0 open,
  23 stated, 35 closed. Ladder at v5.71: briar 78 · kayo 66 · dash 54 · fai 51 · azalea 50 · bravo 45
  · enigma 44 · viserai 42 · iyslander 41 · arakni 33 · blaze 32 · dorinthea 30 · boltyn 22 · gravy
  21 · lyath 19; 0/0/0, 2 draws. Candidate next stated items for players: `trainer-no-stalemate-draw`
  (R6's trainer twin), `activation-choices-at-resolution`, `start-item-crank-unasked`,
  `peers-hold-full-state` (hidden hands over the network — large).
- **v5.72** the trainer draws a dead position through the table's `judge.stalemateCheck`
  (`trainer-no-stalemate-draw` CLOSED). Ledger: 0 open, 22 stated, 36 closed. NOTE: the held R9
  patch (base 71192de) touches `tools/approx.js` and `test/approx.test.js` counts too — when the
  user rules, apply it with `git apply --3way` on current main and re-pin the counts (stated/closed).
- **v5.73** H29 (Lyath): a pump grant waits until it and its attack are affordable together, and the
  pitch keeps that attack (`judge.grantReserve`, keys `grantKeep` / `grantWait`); Lyath 19 -> 28.
  Ladder at v5.73: briar 78 · kayo 66 · dash 53 · fai 51 · azalea 49 · bravo 44 · viserai 42 ·
  iyslander 42 · enigma 41 · blaze 31 · arakni 31 · dorinthea 31 · lyath 28 · boltyn 21 · gravy 20;
  0/0/0, 2 draws. Bottom now: Gravy 20, Boltyn 21. A direction question is open with the user:
  hidden hands for two-phone play (`peers-hold-full-state`) as the next big project?
- **H30 HELD (CEO, 2026-11-01):** block more when a seat fizzles resources (`judge.wastePerTurn` >= 0.5
  per own turn lowers `takeUpTo` by one; key `blockWaste`). Gravy own-seat +1.08 (t 3.5) / +0.42
  (t 1.0) / +0.38 (t 1.9) of 14 on three sets; ladder Gravy 20 -> 35 — BUT Lyath 28 -> 19 (own seat
  -0.75, t -3.6, 3 up / 15 down), Dash -0.25..-0.4, Fai -0.1..-0.25, and it widened an existing
  drill's band. Not shipped: no second independent set resolves, and it regresses the hero just
  lifted. Patch `experiments/H30-wasteblock-HELD.patch`. Leads it found: (1) 85% of Gravy's 503
  ally deploys die before swinging (the survivors swing ~6 times each) — deploy timing / protection;
  (2) Gold is rarely kept for the hero's loot ability because the arena draw spends it first.
- **H31 NOISE (2026-11-01):** Gravy's allies dying unswung is BY DESIGN. 196 of 198 deploys spend the
  turn's last action point and nothing in the deck lets an ally swing the turn it enters, so every
  deploy is a one-swing decoy the opponent correctly kills next turn (`targetFor`, CR 7.3.2a; 197 of
  198 killing attacks had 3+ power vs ally life 1-4). Every hold/deploy-first variant was negative;
  "free ally first when none is out" pooled +0.09 of 14 over four clean 40-seed sets (noise). No other
  hero has an ally. Patch `experiments/H31-ally-decoy-NOISE.patch`.
- **THE AI-POLICY VEIN IS THIN:** of the last eight policy hunts, four shipped (H26, H29 and the
  earlier H23/H24) and H25, H27, H28, H30, H31 did not. Further balance gains likely need a different
  approach (e.g. a lookahead / search for the action choice, or deck-specific plans), which is a
  direction question for the user rather than another leak hunt.
- **R10 ASKED of the user (2026-11-01), low stakes, not built:** does Dash's "You may start the game
  with a Mechanologist item with cost 2 or less in the arena" make the item ENTER the arena for
  Crank ("As this enters the arena, you may remove a steam counter from it. If you do, gain an action
  point")? The repo already treats the placement as entering for Boom Grenade's "enters with a steam
  counter" (v5.13). But a pregame action point is overwritten (priority.js sets `ap:1` entering the
  action phase), so accepting would only cost the counter; a yes also needs WHEN the point lands.
  Build if yes: a pending Crank pay prompt at `newMatch` and the trainer's opening, AI declines,
  WIRE_V 33.
- **R9 ASKED of the user (2026-11-01), BUILT AND HELD:** is an ACTIVATED ability's target (and X)
  declared when it is ACTIVATED, before the opponent may respond (as CR 1.4.5 says for an
  attack-target), or chosen when it resolves? The repo quotes no CR text for a non-attack ability's
  target. In the pool only Beckoning Haunt (Viserai; Action speed, rests on the stack, picks a card)
  is affected; the other target-printing abilities are instant/reaction and resolve at once. Patch
  `experiments/R9-activation-target-declared.patch` (base 71192de; table `abtarget` pending, trainer
  `targetpick`, fizzle if the target is gone, WIRE_V 33; 3894 drills, 16 sabotages, page drive on
  both boards, ladder byte-identical). Ship it if the user says "declared on activation".
- **H28 NOISE (2026-11-01):** the other hand abilities the AI never uses. Census: 12 printings in
  the pool, 5 cards in decks — Reaper's Call (done, v5.69), Arcane Twining and Photon Splicing (Amp 1;
  Iyslander, Blaze), Agile Windup (Agility token; Kayo), Rally the Coast Guard (+3 defence while
  defending; Kayo, legal in only 10 states over 196 games). Iyslander amp, pooled over 396 seeds:
  about +0.10 of 14 (noise); Blaze amp leans negative (-0.46 t -2.6 at worst, never positive); Kayo
  token +0.06..+0.10 (noise). Patch `experiments/H28-hand-abilities-NOISE.patch` (env-gated, do
  not apply). The AI-policy vein is thinning: H25, H27 negative and H28 noise in a row.
- **H25 NEGATIVE (2026-11-01):** hold instants that change nothing on the seat's own turn
  (prevent-only cards, Glisten off a weapon link; reader `rxWaste`, key `rxWait`). Own-seat, 24
  paired seeds: Boltyn 7.04 -> 6.50 (t -1.4), Glisten-only -0.46 (t -1.8), Lyath 0, Gravy +0.17
  (t 0.9). Cause: the "wasted" play is free CYCLING — a held dead card occupies a hand slot and costs
  a draw (blockSpare's reason, the other way round). Patch `experiments/H25-rxwait-negative.patch`.
  Leads it saw, untested: Gravy floats ~1 resource per own turn because `pitchPick` takes the highest
  pitch first even when a lower card pays exactly (also high in won games — may not be a leak);
  Arakni holds its mark cards (Reaper's Call, Mark the Prey, Lair of the Spider) at turn end about
  twice as often in losses as in wins.
- **NEXT (measured leads, not built):**
  1. ~~R6 detection gap~~ SHIPPED v5.67. Original note: **R6 detection gap:** a dead position where a hero ability keeps cycling cards (Lyath) never
     trips "nothing changing" — `lyath-boltyn-24` stalled in a 48-seed run (outside the ladder's
     seeds). Refine the test (e.g. both decks empty AND no LIFE change for N turns AND no card that
     can deal damage is playable) — ask the user only if the refinement is a rules choice.
  2. ~~V of the Vanguard charges once~~ SHIPPED v5.68.
  3. Glisten sits dead in 1.2 hands per lost Boltyn game.
  4. Briar/Kayo lead by deck+policy: the remaining balance work is the bottom four
     (Lyath, Boltyn, Gravy, Arakni ~20-27).
- **Open for the next session:** the trainer's twin of the R6 draw and sudden death (both stated in
  `tools/approx.js`); 23 stated approximations remain (`node tools/approx.js`), 0 open.
- **v5.59** soul-banish cost asks which card (`soul-banish-cost-auto-picked` CLOSED). **v5.60** the
  nameless "Go again granted." line removed (split out of H21).
- **The two rulings as they were asked (2026-10-31):**
  - **R6, dead position.** `node tools/tourney.js '' '' 6` still has ONE stall (arakni-dash-5 or
    azalea-gravy-3 after v5.56): both decks empty, nobody can ever deal damage, CR 4.5.3 has no
    deck-out loss. Draw? AI concedes? Something else?
  - **R7, V of the Vanguard** (`attack-grant-misses-own-attack`): does "Your attacks this combat
    chain get +1{p} for each Light card charged this way" include V itself? Today only later attacks.
- **H21 (policy, MEASURED, HELD — CEO 2026-10-31).** `sparring.nextBlocker`: a hand bigger than
  `maxPitch + 1` holds a spare card, and a spare card blocks any hit that would leak (reason
  `blockSpare`, via `J.handFree`; patch `experiments/H21-spare-block.patch`, built by a Sonnet agent).
  Own-seat A/B, 12 seeds paired: Bravo 8.1 -> 11.8 (t 5.9, 12/0), Blaze 7.6 -> 9.7 (t 4.2), Gravy
  4.2 -> 5.6 (t 3.4), Enigma 10.2 -> 11.3 (t 2.1). **Not shipped:** with every seat on, the 3-seed
  ladder has 1 stall (`gravy-viserai-2`, a dead position — R6's class) and the collateral is large
  and unexplained: Kayo 14.3 -> 23.0, Arakni 15.7 -> 8.7, Dorinthea 17 -> 10.7, Lyath 7.7 -> 4.3.
  Next: rule R6 first (dead positions), then find out why Kayo gains ~9 (likely her 6-power hits
  meeting fewer blocks, or Kayo's own blocking changing) before shipping; consider the rule only
  against hits that would actually leak damage the seat cannot afford. The patch also drops a
  nameless "Go again granted." feed line in effects.js — split that out as its own FEED fix.
- **How to work** (unchanged): `CLAUDE.md` is the core; one item per release; re-verify before
  fixing; sabotage every new drill; ladder at 3 seeds (6+ for a balance claim, both sides of the
  change). Work in fresh sessions. A Sonnet shipper suits a mechanical release; keep judgement work
  (rules readings, new mechanics) in Opus.
- **NEXT, in order:**
  1. ~~Two stalls outside the standard ladder~~ — one fixed at v5.56, the other is R6 (a ruling).
     Original note: **Two stalls outside the standard ladder** (CEO, 2026-10-31). `node tools/tourney.js '' '' 6`
     stalls `azalea-gravy-3` (turn 686) and `arakni-dash-5` (turn 1768), identically on v5.54 and
     v5.55; seeds 0–2 have none, so `npm run play '' '' 3` does not see them. Replay one with
     `tools/selfplay.js` (`match(a, b, seed, first)` then `play`) and read what both seats do near
     the end before deciding: a policy loop is an H-item, a game with no way to end is a rules
     question for the user (CR 4.5.3: there is no deck-out loss).
  2. ~~`cloaked-display`~~ SHIPPED v5.57. Next instead: weak-hero policy (Gravy, Blaze, Bravo,
     Enigma trail at 5–9 wins a seed) and player-facing choices the ledger auto-picks
     (`soul-banish-cost-auto-picked` was in flight at v5.58). Original note: **`cloaked-display`** (open approx record): the card back on the board. A UI job; read
     `UI-GUIDE.md` first and drive the page at 393×852 — which needs a machine that can reach the CDN.
  3. The unresolved H-items in THE ORDER below.
- **Latent, recorded:** (a) a non-permanent played FROM THE GRAVEYARD still files to banish (R2
  covered banish only); every watery-grave card in the pool is an ally, so no pool card reaches it —
  ask the user before changing. (b) Synthetic only: a quoted "gain 1{h}" rider is relocated by a loose
  life matcher (NEEDS A RULING section, second bullet). Record, don't build.

## R2-R4 — THREE RULINGS (user, 2026-10-31)

> RULING (user, 2026-10-31): *"To grave like normal even if it is played from banish."*
> RULING (user, 2026-10-31): Unity counts a defence reaction played from hand: *"Yes"*.
> RULING (user, 2026-10-31): *"Soul is public."*

- **R2 (engine): a card played from the banished zone goes to the GRAVEYARD after it resolves**, like
  any card, turn-stamped (`_gy`). Today both filing paths put it back into banish: `effects.js`
  `execute` (non-attacks) and `fileAttack` (attacks). S9's play-permission strip stays (the card must
  not keep `_playTurn`/`_asInstant`). An ephemeral card (Crouching Tiger) still ceases to exist on its
  way to the graveyard (`parser.ceasesToExist`). Close the approx record
  `played-from-banish-files-to-banish` with its probe turned round. Drill the real routes: Blaze's
  ability (Snapback), Pouncing Paws (Crouching Tiger), Mounting Anger / Rising Resentment's banished
  attack. Check what else reads a banished card that was played (Art of Desire-style "banished" counts).
- **R3 (engine): Unity counts a defence reaction played from hand.** Unity prints "When this defends
  together with a card from hand"; `handDefenders` counts declared hand cards (`blockH`) only, so a
  defence reaction played from hand later in the same link does not lift it (44 times at 3 seeds).
  `parser.rxDefenders(..., fromHand)` (v5.21) is the reader that already knows those cards. Both boards.
  Drill: Gauntlets/Helm of Unity defending with only a played-from-hand defence reaction gets its bonus;
  one played from the ARSENAL does not.
- **R4 (no change): the soul is public.** The feed lines that name charged/soul cards are right.
  Nothing to build; recorded so nobody hides them.

## v4 — THE AI PILOTS HEROES (CEO, 2026-10-18)

> RULING (user, 2026-10-18): *"Yes it is time for the ai to learn to play the heroes - I'm
> confident the cards are suitable :)"*

This **supersedes the 2026-08-16 seat ruling** ("a seat the dummy fills is ALWAYS the vanilla
pile. There is no hero the dummy plays as", CLAUDE.md:12091 on v5.34) for the TABLE's AI seat.
The trainer (`Battle`) keeps the tuned `[3,4,5]` dummy; nothing about it changes. A networked
seat is still a person who picks their own hero. Answers Stage §8.3 / open question 3.

**H1. Seat a hero AI at the table.** ~~One release.~~ **SHIPPED v5.35, CEO-verified:** 3611 tests, 0 fail,
5 skipped, scenes 107/107, all 21 script tags in the pushed commit, CI and Pages green, and the 210-game
ladder byte-identical to v5.34.
- **Record the ruling** verbatim with its date in CLAUDE.md, in place of the 2026-08-16
  paragraph (keep the old one, struck through, with "superseded 2026-10-18"), in
  HANDOFF-MERGE.md's DECISIONS list, and in `tools/rulings.json` if seat rulings live there.
- **The choice.** On the loadout's "Fight the new engine" path the player picks the opponent:
  **The Dummy** (the vanilla pile, as today) or **any of the 15 heroes**, plus **Random**. Reuse
  the P1 hero list and art (`HeroArt`), never a second roster. One state field holds the key, or
  null for the dummy. Do not name it `oppH`: that name was retired with the old picker, and a
  fresh name keeps the history readable.
- **The build.** `index.html:7732` passes `heroes: [seating.h.k, <choice>]`. The AI seat's
  loadout is `build.defaultPicks`, the same as self-play. `sparring.act` already drives
  seat 1 through `local.js`, so no policy change belongs in this release.
- **`VsStrip`** shows the chosen hero's portrait, name and printed life for P2, or the dummy.
- **The note under the button must say only what is measured.** "An AI pilots <hero> with the
  policy self-play uses. Untuned." Quote no win rate unless it was measured for that pair on
  this release (`node tools/tourney.js <yours> <theirs> 3`).
- **Mirrors** (the same hero on both sides) are allowed. The ladder skips them (v4.31), so they
  are unmeasured; say so in the changelog.
- **Guards.** `test/flow.test.js:80-100` pins "no opponent picker" and "the trainer and the
  table seat the SAME punching bag". Retire those two claims deliberately and pin the new ones:
  the trainer still deals `buildVanilla(DUMMY_DECK…)`; the table seats exactly the chosen key
  or null; no second roster; and the networked lobby is untouched.
- **Drive it on the phone page at 393x852** (the v4.28 pre-ship browser step): pick a hero,
  play to the first strike, check no dead tap and no overflow. Measure one game per hero for
  `POLICY REFUSALS 0` and `INVARIANT VIOLATIONS 0` through `local.js`, not just `selfplay.js`.

**H2. SHIPPED as v5.36 (`9e79547`), CEO-verified 2026-10-18:** 3615 drills, 0 fail, 5 skipped;
scenes 107/107; all 21 engine script tags in the pushed commit; CI drills and Pages green; the
3-seed ladder is byte-identical to the CEO's scratch experiment.

**H2. A non-attack that keeps the action point goes BEFORE the attack.** One release. CEO-measured
on v5.34 in a scratch copy (method below); re-measure in the real tree before shipping.
- **The gap.** `sparring.offence` ranks every attack first and every non-attack last
  (sparring.js:455-600). So Azalea fires her arrow, spends the turn's action point, and her
  "your next arrow attack gets +N … Go again" cards (Lace with Frailty/Bloodrot/Inertia, Take Aim,
  Read the Glide Path, Nimblism, Call in the Big Guns) never land on it. Measured on v5.34: 1 win in
  28 games, 0.7 a seed over 3 seeds.
- **The rule.** If the seat has an attack available (a card with printed power in hand or arsenal,
  or a board attacker), first play the cheapest affordable non-attack that **keeps the action
  point**, ties on pitch then uid. Then the existing ranking runs as before.
- **"Keeps the action point" is one judge reader, not card text in sparring.js** (its contract):
  `judge.keepsActionPoint(g, seat, uid, from)`, true when the card's own printed go again is
  unconditional, the same fact `execute` grants (`fxParse(card).ga === true`; v2.31's layout
  rule). The `boardAttackOf` / `abWindowOf` / `chiNeed` seam (v3.84, v4.38, v4.54). Do NOT widen
  it to instants or to conditional go again in this release: neither was measured.
- **The experiment patch** (inside `offence`, just above `const pick = from`):
  ```js
  const haveAtk = from.some(x => x.c && num(x.c, "power") > 0) || allies.length > 0;
  if(haveAtk){
    const first = from.map(x => ({c: x.c, uid: x.c && x.c.uid, from: x.from}))
      .filter(x => x.c && num(x.c, "power") <= 0 && KEEPS_AP(x.c))   /* → judge.keepsActionPoint */
      .filter(x => affordableWithin(sd, x.c, o))
      .sort((a, b) => num(a.c, "cost") - num(b.c, "cost") || num(a.c, "pitch") - num(b.c, "pitch") || byUid(a, b))
      .find(x => legal(g, {t: "play", uid: x.uid, from: x.from}, seat));
    if(first) return {t: "play", uid: first.uid, from: first.from};
  }
  ```
- **Measured, the change on ONE hero's seat only, every opponent on the old policy** (A/B; 14
  games a seed, 3 seeds, `tourney.js <hero> '' 3`):

  | hero | old | new | |
  |---|---|---|---|
  | Azalea | 1·0·0 (0.3) | 4·2·6 (4.0) | disjoint, REAL |
  | Lyath | 3·2·4 (3.0) | 7·6·9 (7.3) | REAL |
  | Viserai | 10·5·4 (6.3) | 14·12·11 (12.3) | REAL |
  | Briar | 12·11·9 (10.7) | 14·14·14 (14.0) | REAL |
  | the other 11 | | | within ±1–2, overlapping (noise) |

  On the full ladder (both seats on the new policy), Blaze 17.3 → 10.3 and Iyslander 16.7 → 8.3.
  **That is the zero-sum ladder, not self-harm**: with only their own seat switched they are
  unchanged (8.7 → 8.3 each). Report both tables; the full ladder is what `npm run play` shows.
- **Stalls 0 → 1 on the full ladder** (Gravy v Azalea 3 and Enigma v Iyslander 1 in the A/B runs).
  All are genuine draws: both decks and hands empty, or a hand of four cards with no play
  (Unmovable, two Put in Context, Astral Etchings with no aura). CR 4.5.3 has no deck-out loss
  (v3.80, v4.58). Record it in the changelog; do not invent a rule to end them.
- **Drill it** in `test/sparring.test.js`: a go-again non-attack plus an attack in hand → the
  non-attack is proposed first; a non-attack WITHOUT go again plus an attack → the attack first;
  no attack available → unchanged order. The drill must not depend on the parser in sparring.js.
  Sabotage the reader and the ordering.
- **sparring.js's header still says "NOT an AI opponent … should stay legible rather than become
  good" (sparring.js:48-54).** The 2026-10-18 ruling supersedes the first half: say so, and keep the
  legibility half, which still holds.

**H3. SHIPPED as v5.37 (`0d82fbf`), CEO-verified 2026-10-18:** 3623 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; the 3-seed ladder is byte-identical to the CEO's scratch experiment; `boost` route 0 -> 825.

**H3. The AI seat boosts when its own deck makes boost pay.** One release. CEO-measured on v5.36
(`9e79547`) in a scratch copy; re-measure in the real tree before shipping.
- **The gap.** `sparring.payAction` declines every boost (`if(p.kind === "boost") return {t:"boost",
  yes:false}`, sparring.js:144), on the reasoning that the banished card "is hidden from it — so
  there is nothing to weigh". Boost's reminder pays go again when the banished card is a
  Mechanologist card, and **Dash's deck is 44 of 44 Mechanologist**, so declining costs him every
  go again his deck is built on. He was the weakest hero on the v5.36 ladder (4.7 wins a seed).
- **Why the old reasoning no longer holds.** The ORDER of the deck is hidden; its COMPOSITION is
  not. A player knows their decklist minus every card they have seen, which is exactly the
  remaining deck as a multiset. So the policy weighs a probability the seat legitimately has, not
  a card it cannot see. Rewrite the v2.84 comment to say this, and keep its point that the policy
  never peeks at `deck[0]`.
- **The fix.** `judge.boostShare(g, seat)`: the share of `g.sides[seat].deck` (the remaining deck
  only; never the hand, never the order) that a boost would pay off for. `sparring` accepts boost
  when the share is at least 1/2, else declines. It reads no card text: judge answers, as with
  `keepsActionPoint`, `boardAttackOf` and `chiNeed`.
- **One reader of "does this banished card pay boost".** effects.js:4722 tests
  `/mechanologist/i.test(top.tt)`. Move it to one parser reader (for example
  `parser.boostPays(card)`) that reads the structured array `ty` (v2.39: the array is the
  authority), and have both effects.js and `boostShare` ask it. Measured: `tt` and `ty` agree on
  all 797 pool records, so this moves nothing today and is right the day they diverge. Pin that.
- **Measured** (3 seeds, scratch copy):

  | | before | after |
  |---|---|---|
  | Dash, only his seat on the rule (`tourney.js dash '' 3`, 42 games a side) | 2 · 3 · 4 (3.0 of 14) | 12 · 10 · 12 (11.3 of 14) |
  | Dash's average game length | 22.7 turns | 12.7 turns |
  | Full ladder, every seat on the rule (`tourney.js '' '' 3`) | Dash 4.7 a seed | Dash 22.3 a seed |
  | refusals · violations · stalls (full ladder) | 0 · 0 · 1 | 0 · 0 · 1 (the same deck-out draw, `gravy-azalea-2`) |

  Intervals disjoint by a wide margin: real. The others move down a little, which is the
  zero-sum ladder, not self-harm (H2's per-seat method).
- **The threshold is a stated choice that this pool never tests.** Only Dash's deck holds a boost
  card (38 of 44 print it) and his share at the deal is 1.0, so 1/2 and "always" give identical
  ladders (measured: SPBT 0, 0.5 and 0.7 all give 12 · 10 · 12). Pin both premises as drills: the
  set of decks holding a printed boost is {dash}, and its share at the deal is 1.0. The day a second
  boost deck arrives, somebody re-measures the threshold.
- **Drills.** `boostShare` counts the remaining deck and not the hand (a fixture with Mechanologist
  cards in hand only answers 0); the policy accepts at a share of 1/2 and declines just below it
  (synthetic decks); `sparring` still reads no card text (the existing guard). Add a `boost` route
  counter to `tools/selfplay.js` on the engine's own phrase (`Boost: <card> banished`), pinned
  against the engine's spelling (v3.81), and confirm it is non-zero after the fix and 0 before it.
  Sabotage: the threshold, the hand/deck split, and the reader move.
- **The ladder line in CLAUDE.md and FINISH.md that names the policy declining boost** should be
  updated in the same release, so no doc still says the seat never boosts.

**H4. SHIPPED as v5.38 (`fa7b7e0`), CEO-verified 2026-10-24.**
- 3635 drills, 0 fail, 5 skipped; scenes 107/107.
- 21 engine script tags and `.nojekyll` are in the pushed commit; CI drills and Pages are green.
- Gravy Bones (11.3) and Fai (18.3) match the experiment exactly.
- **The shipped reader is wider than the experiment, and that is measured rather than assumed.** The
  merge into one `keepsActionPoint` adds an AURA attack carrying a +1{p} counter, which is Cosmo's
  printed go-again rider, `auraAttackOf().gaWithCounters`.
  - On the full ladder Enigma reads 11.7 against 8.7 for the experiment and 9.7 for v5.37.
  - Her own-seat A/B with and without that branch overlaps: [7,5,6] against [6,3,4]. The direction
    is consistent; the size is unresolved at 3 seeds.
  - It is a faithful reading of a printed rider, so it stays.
- v5.38 full ladder: briar 26.0, dash 23.0, dorinthea 20.7, kayo 18.7, fai 18.3, arakni 18.3,
  viserai 18.0, enigma 11.7, gravy 11.3, bravo 10.3, azalea 8.0, lyath 8.0, blaze 7.3, boltyn 5.7,
  iyslander 4.0.

**H4. Sequence the go-again chain: the attack that keeps the action point goes first, and a
next-attack grant waits for an attack to take it.** One release (v5.38). Measured by an investigator on v5.37
(`0d82fbf`) and re-measured by the CEO in a fresh copy; numbers below are the CEO's. Re-measure in
the real tree before shipping. The experiment, gated on `SPX`, is
`experiments/H4-gravy-experiment.patch` on this branch (applies cleanly to `0d82fbf`); ship the
RULE, never the gate.
- **The gap, half 1 (ranking).** `sparring.offence` ranks attacks on printed power alone, so a
  go-again attack (Golden Tipple, Saltwater Swell, 1-3 power) sits behind a bigger attack or an ally
  deploy that spends the action point, and is then stranded. In Gravy Bones' 42 games, 231 of 305
  plays that spent the last action point were made while an affordable attack that keeps its own
  point was in hand (Golden Tipple stranded 229 times, Saltwater Swell 139).
- **The gap, half 2 (grants with no taker).** H2's "go-again non-attack first" step asks only
  whether any card with power exists, so a pure next-attack grant is played when no attack can take
  it: an ally card in hand or an unaffordable attack counts. Pirate-ally grants (Avast Ye!, Loot the
  Arsenal, Loot the Hold, Yo Ho Ho!): 162 played, 40 used. Flying High: 56 played, 26 used. With the
  rule: 69 played / 61 used, and 46 / 46.
- **The rule.**
  - Among the attacks the seat can make, the one that keeps the action point goes first. That means
    its own unconditional go again, an arsenal stamp, or a waiting `gaNext` / `gaNextQ` grant it
    matches.
  - Ties fall back to the existing order: power, then cost, then uid.
  - A non-attack whose WHOLE payload is next-attack grants (`buffNext` / `gaNext` ops, no conditions,
    no optional cost) is held until an attack the grant's qualifier admits is legal now and
    affordable without the grant card.
- **Two judge readers, and one may be the existing one.**
  - The experiment adds `judge.attackKeepsActionPoint(g, seat, uid, from)` beside H2's
    `keepsActionPoint`, plus `judge.grantTakers(g, seat, uid, from)` (null unless a pure grant; else
    the legal attacks its qualifier admits, as `{uid, from, cost}`, through `qualMatches`).
  - **Prefer ONE reader of "does this play keep the action point"**: extend `keepsActionPoint` to
    answer for attacks and board allies too, rather than shipping a sibling with a near-identical
    name (v3.61, two records of one fact). If the merge moves H2's non-attack answers (a non-attack
    can match a `gaNextQ`, e.g. Mage Master Boots), measure it; if it moves the ladder, keep two
    readers and say why in the header.
  - **Either way, fix the latent defect the investigator found in `keepsActionPoint`.** It answers
    TRUE for Limpit, Hop-a-long and Cutty Shark in hand, because `fx.ga` carries the go again from
    the ally's ATTACK line, while `execute` grants a deploy nothing (`abilityGa`). Repro: seed
    `gravy-arakni-0`, turn 9; `keepsActionPoint(Limpit, "hand")` is true, and the deploy takes ap
    1 -> 0. It is latent today only because H2's caller filters to power <= 0. Pin it.
- **Measured** (3 seeds; wins a seed):

  | | v5.37 | with the rule |
  |---|---|---|
  | Gravy Bones, own seat only (`tourney.js gravy '' 3`, of 14) | 3 · 4 · 2 | 6 · 6 · 8 (two runs byte-identical) |
  | Gravy Bones, full ladder, rule on every seat | 5.3 [4,6] | 11.3 [11,12], disjoint |
  | Fai, full ladder | 12.7 [11,15] | 18.3 [18,19], disjoint |
  | Bravo · Lyath · Iyslander, full ladder | 13.3 · 10.7 · 6.7 | 10.7 · 8.0 · 4.0, none disjoint (zero-sum) |
  | refusals · violations · stalls | 0 · 0 · 1 | 0 · 0 · 2 |
  | `npm test` (rule gated) | | 3618 pass, 0 fail, 5 skipped |

- **The two stalls are draws in which no seat can deal damage, CEO-checked, and both seats are not
  empty-handed in the strict sense.**
  - `iyslander-azalea-1`: both decks and hands are empty and both arsenals hold one card. Iyslander's
    is On the Horizon (a Block). Azalea's is Lace with Frailty, which is LEGAL, but it is a grant with
    no attack to take it, so the rule holds it.
  - `gravy-briar-2`: Gravy's Cutty Shark, Quick Clip costs 1 to attack and he cannot raise it. Briar's
    Scorpio needs a Lightning attack on the chain.
  - CR 4.5.3 has no deck-out loss. `aiseat.test.js`'s draw check reads deck and hand only (not the
    arsenal), so it would accept the first; say so in that drill's comment, or tighten the drill to
    "no seat has a legal play that can deal damage" if that is cheap.
- **Drills.**
  - The reader(s):
    - own go again keeps the point;
    - an ally deploy does not;
    - a board ally whose attack line prints go again does;
    - a waiting bare `gaNext` does;
    - a `gaNextQ` entry matches or misses by its qualifier;
    - a conditional go again does not.
  - `grantTakers`:
    - null for a card that prints anything besides grants;
    - never lists the grant itself;
    - respects the qualifier: a Pirate-ally grant with only a non-Pirate attack lists nothing.
  - The policy:
    - holds a pure grant with no taker and plays it with one;
    - ranks a 1-power go-again attack before a 5-power one without go again.
  - Sabotage each: drop the `kap` key, drop `grantOK`, count the grant card as its own taker, and
    restore the ally false positive.
  - `keycensus.test.js` gains `abilityGa` and `qualMatches` as judge-only readers, with the reason.
- **Recorded, not built (feed text, for the next feed batch).** Deploying an ally prints "<ally>:
  the weapon's attack — its cost is paid when it swings". This is `parser.js:721`'s noop reason for
  every `Action - …: Attack` line, so an ally's attack line is called a weapon's. Repro: Gravy Bones v
  Dorinthea, seed 0, turn 5, "Riggermortis: the weapon's attack — …". The rules are right; only the
  line is wrong.
- **Also seen, not built:**
  - Golden Tipple's optional discard is always declined.
  - Offence never proposes a graveyard play (watery grave).
  - Every ally deploy spends the last action point, 40 of them while a board ally could still attack.
  Candidates for H5+ once measured.

**H5. SHIPPED as v5.39 (`10f41e2`), CEO-verified 2026-10-24:** 3640 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; the full 3-seed ladder is byte-identical to the CEO's re-measure of the gated experiment
(nobody moves beyond it). v5.39 ladder: briar 26.0, dash 22.7, dorinthea 20.0, kayo 19.3, fai 17.7,
arakni 17.7, viserai 17.0, iyslander 12.3, gravy 10.7, enigma 10.3, bravo 9.3, azalea 7.3,
blaze 7.3, lyath 6.7, boltyn 5.3. Stalls: 1 (`gravy-briar-2`, a no-damage draw).

**H5. A non-attack that spends the action point: the biggest printed arcane goes first.** One
release (v5.39). Measured by an investigator on v5.38 (`fa7b7e0`) and re-measured by the CEO in a
fresh copy; the numbers below are the CEO's. Re-measure in the real tree before shipping. The
experiment, gated on `SPX`, is `experiments/H5-iyslander-experiment.patch` on this branch and
applies to `fa7b7e0`. Ship the RULE, never the gate.
- **The gap.** When the seat has no attack to make, `sparring.offence` ranks its non-attacks
  CHEAPEST first, so it spends Iyslander's one action point on the smallest damage. In her 42 games
  she made 153 non-attack plays that spent the point, and in 79 of them a legal non-attack printing
  more arcane was in hand or arsenal: +1 x13, +2 x10, +3 x20, +4 x15, +5 x21. That is about 258
  arcane, roughly 6 a game, left unplayed. A typical case is a 1-arcane Frosting played with a
  5-arcane Ice Bolt legal in the same hand.
- **The rule.** Among the non-attacks the seat would spend its action on, play the one printing the
  most UNCONDITIONAL arcane damage first. Ties fall back to the existing order: cost, then pitch,
  then uid. A non-attack printing no arcane ranks as 0.
  - H2's go-again step runs before this, so a card that keeps the action point still goes first.
- **The reader.** `judge.arcaneOf(g, seat, uid, from)` returns the card's printed arcane through
  `parser.arcAmount`. That is the same reader Blaze's ability prices with: unconditional ops only, so
  a gated "instead deal N" is not counted and an X is not guessed. A card the seat does not hold in
  that zone (hand or arsenal) answers 0.
  - `keycensus.test.js`'s one-board reader pin moves deliberately, because `arcAmount` is now also
    asked by judge (the v5.37 `boostPays` and v5.38 `abilityGa` precedent). Give the reason line.
- **Measured** (3 seeds; wins a seed):

  | | v5.38 | with the rule |
  |---|---|---|
  | Iyslander, own seat only (`tourney.js iyslander '' 3`, of 14) | 5 · 1 · 2 | 6 · 6 · 8 (two runs byte-identical) |
  | Iyslander, full ladder, rule on every seat | 4.0 [3,5] | 12.3 [9,14], disjoint |
  | every other hero, full ladder | | moves by at most 1.4, inside the band (MAX 5) |
  | refusals · violations · stalls | 0 · 0 · 2 | 0 · 0 · 1 (`gravy-briar-2`, the existing no-damage draw) |

  - The probe confirms the mechanism. Plays made while a higher-arcane alternative was legal went
    79 -> 0, and 5-arcane plays went 25 -> 54.
  - Blaze, the other arcane deck, does not move (7.3 -> 7.3). Do not claim the rule helps him.
- **Drills.**
  - `arcaneOf` reads the printed number (two cards differing only in arcane), ignores a gated
    "instead" rider, and answers 0 for a card not held.
  - The policy plays the 5-arcane card over the cheaper 1-arcane one in the same hand.
  - A go-again non-attack still goes first (H2 is unchanged).
  - Ties fall back to cost.
  - Sabotage: the sort key dropped, the key inverted, and the reader counting a gated rider.
- **Also measured, not built (H6+ candidates for Iyslander):**
  - A Block card (On the Horizon) set in the arsenal is never played from there.
  - Crucible of Aetherweave's amp is activated and then wasted on 278 of her turns.
  - Both A/Bs overlapped at 3 seeds (`all-hypotheses.patch` in the investigator's scratchpad), so
    they stay recorded rather than built.

**S8. SHIPPED as v5.40 (`844ee9d`), CEO-verified 2026-10-24.**
- 3650 drills, 0 fail, 5 skipped; scenes 107/107.
- 21 engine script tags and `.nojekyll` are in the pushed commit; CI drills and Pages are green.
- The repro's Bolt of Courage#29 now lands in `banish`.
- The new self-play fault NO-ZONE reads 0. It read 202 on v5.39: 134 soul banishes, plus 68
  transcends, a second vanishing-card defect it found. A transcended card now keeps its uid.
- Ladder: Boltyn 5.3 -> 5.7, nobody else beyond 0.6. The policy, not the gate, is Boltyn's binding
  constraint (H6).
- The cost choice is recorded as `soul-banish-cost-auto-picked` (stated).

**S8. A soul card banished as a cost goes to NO zone, and Duty Bound Blitz's gate reads the soul
instead of the event. ENGINE, ships BEFORE H6 (v5.40).** Found by the Boltyn investigator on v5.39;
CEO-reproduced with `experiments/S8-soul-repro.js` (`node experiments/S8-soul-repro.js <tree>`).
- **The vanishing card.** `effects.js:3396` pays `abSoulCost` with
  `actMut(n).soul = act(n).soul.slice(_sc)` and puts the cards nowhere. Boltyn's hero ability and
  Radiant Touch both pay it.
  - Repro: in Boltyn v Dorinthea, seed `boltyn-dorinthea-0`, turn 5, the hero ability banishes
    Bolt of Courage#29, which ends up in NO zone.
  - `effects.js:1871` (`soulSpend`) is the same shape. v4.50 measured zero claimants for it, so it is
    probably latent; fix it through the same body anyway.
  - The cards go to the BANISHED zone. A banish from the soul is a banish, and both lines say so in
    the feed.
  - **No guard here sees a card in no zone.** `invariants.js` catches a card in TWO zones, and one in
    none falls out of the census silently. That is CLAUDE.md's own warning from v2.21 and v3.07.
    Consider a self-play fault for it: a non-token, non-ephemeral uid present in one state and in no
    zone in the next. It would have caught this, and it is how this family stops recurring. Size it
    honestly; if it is more than a small instrument, record it as its own item instead.
- **The gate.** Duty Bound Blitz prints "Play this only if a yellow card has been put into your soul
  this turn". That is an EVENT. `effects.playIfOk`'s `soulPitch` (`effects.js:9877`) asks whether a
  yellow card stamped `_soulT === turn` is IN the soul now.
  - Boltyn's ability banishes the freshest soul card. So in the same repro, a yellow card is charged
    and then banished, and `judge.legal` refuses the face-up Duty Bound Blitz with "no yellow card
    has been put into your soul this turn". Weaker than printed, and live in his deck.
  - Record the event: for example, `hist` keeps the pitch of every card put into the soul this turn,
    written by the three soul writers (`effects.js:3833` charge, `:8183` ascend, `prompts.js:1051`
    pick to soul). CR 4.4.4 clears it with `hist`, and the gate reads it.
  - v4.90's source census of the three writers is the place to hold all three to it.
- **Which soul card is banished is the engine's choice, not the player's.** The front, which is the
  card just charged. Search the repo for a verbatim CR quote about who chooses a cost's object before
  building anything.
  - If the choice is cheap through v4.85's `discost` pending shape, build it.
  - Otherwise record it beside `cost-discard-auto-picked`, for example as
    `soul-banish-cost-auto-picked` (stated, with a probe).
  - The event-gate fix above makes the choice matter less.
- Drills: drive the repro (the card lands in `banish`; the gate opens after a yellow is charged and
  banished in one turn; it stays shut with no yellow put in); census the soul writers; sabotage each.
  Re-measure the ladder; expect Boltyn to move, since Duty Bound Blitz becomes playable more often.
  Name any hero that moves.

**H6. SHIPPED as v5.41 (`5a76ddf`), CEO-verified 2026-10-25:** 3658 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; NO-ZONE 0. Boltyn 5.7 -> 11.3 [10,14] on the full ladder, disjoint; nobody else separates.
v5.41 ladder: briar 26.0, dash 22.7, dorinthea 20.3, kayo 18.7, arakni 18.0, fai 17.3, viserai 16.7,
iyslander 11.3, boltyn 11.3, gravy 10.3, enigma 10.0, bravo 8.7, azalea 7.0, blaze 5.7, lyath 5.7.

**H6. Boltyn: charge first, then swing the weapon the charge pumped. POLICY, ships AFTER S8
(v5.41).** Measured by the investigator on v5.39 (`10f41e2`) and CEO re-measured in a fresh copy;
re-measure on top of S8 before shipping, because S8 changes his games. The experiment is
`experiments/H6-boltyn-experiment.patch` on this branch, gated on `SPX` (and `SPH`). Ship the RULE.
- **The gap.** Boltyn's deck turns on "if you've charged this turn", and the policy ranks attacks on
  printed power alone. Over 42 games and 377 Boltyn turns:
  - 302 turns make exactly one attack.
  - Only 148 turns are charged, and 109 of those end without Raydn swinging, though Raydn is 0 power
    and +3 once charged.
  - Take Flight, which has go again only once charged, went first in 47 of the 113 turns it was held.
  - Uncharged 4-power attacks were walled on 90 of 92 swings.
- **The rule.**
  - Before the seat has charged this turn, an attack that offers an additional-cost charge outranks
    the other attacks, if the hand can pay its cost and keep a card to charge. One whose go again the
    charge switches on goes first among those.
  - Once charged, such an attack counts as keeping the action point.
  - A weapon whose swing the charge pumped above its printed base swings before any hand attack that
    does not keep the point.
- **The reader.** `judge.chargeView(g, seat, uid, from)` gives, off the parse:
  - `charged` (`hist.charged`);
  - `offers` (`fx.chargeCost`);
  - `gaIf` (a `charged`-gated `ga`);
  - `base` (`effects.basePowOf`);
  - `power` (base, plus +1{p} counters on a weapon, plus every charge-gated `self` pump once charged).

  `chargeRoom` in sparring uses printed numbers only. Consider whether `chargeView` should fold into
  an existing reader (v3.61); one record per fact.
- **Measured on v5.39** (3 seeds; wins a seed):

  | | v5.39 | with the rule |
  |---|---|---|
  | Boltyn, own seat only (of 14) | 1 · 2 · 2 | 6 · 4 · 8 (two runs byte-identical) |
  | Boltyn, full ladder, rule on every seat | 5.3 [4,7] | 11.0 [10,13], disjoint |
  | everyone else | | inside the band (MAX 4); only Boltyn charges, so all 546 non-Boltyn games are identical |
  | refusals · violations · stalls | 0 · 0 · 1 | 0 · 0 · 1 (the same `gravy-briar-2` draw) |
  | `npm test` with the gated patch | | 3640, 0 fail, 5 skipped |

- **Measured, not built (A/B overlapped H1 alone):**
  - Charge the colour a rider or a held gate asks for; this cut missed-yellow charges from 61 to 2,
    but did not move wins.
  - Set a play-restricted card face down into the arsenal last.
- Drills: `chargeView` answers per field; the policy picks the charge-offering attack first when it
  can keep a card to charge, swings the pumped weapon once charged, and does neither when uncharged
  with no charge card. Sabotage the rank, `chargeRoom`, and the weapon candidate.

**S9. SHIPPED as v5.42 (`469d8e3`), CEO-verified 2026-10-25:** 3665 drills, 0 fail, 5 skipped; scenes
107/107; all 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages green; the
3-seed ladder byte-identical to v5.41 (the AI never played from banish). The repro under the H7 policy
reads 25 banish plays and 0 replays on v5.42, where v5.41 finds a replay by the third game.

**S9. A card played from banish under "you may play it this turn" goes back into banish STILL
PLAYABLE, so it can be played again, without limit. ENGINE.**
Found by the Blaze investigator on v5.41 (`5a76ddf`); CEO-reproduced.
- **The defect.** Both filing paths put a card played from banish (or the graveyard) back into
  banish: `effects.js:~5433` (`execute`, non-attacks) and `fileAttack` `:~6583` (attacks). Its
  play-permission stamps (`_playTurn`, `_asInstant`) travel with it, so `parser.playableFromZone`
  (`:~9646`) answers "playable" again the same turn.
  - Repro: `SPX=blaze node experiments/S9-banish-replay-repro.js <tree>`, run against a tree carrying
    `experiments/H7-blaze-negative.patch`, whose policy plays from banish. It prints "blaze-boltyn-0
    turn 7: Snapback#15 played from banish, back in banish with _playTurn=7, legal to play AGAIN:
    true".
  - `execute` is shared, so a HUMAN on either board can do it today. Crouching Tiger (Pouncing
    Paws; cost 0, go again) then gives unlimited attacks in one turn. With that policy on every
    seat, 35 Fai games livelock at turn 1-2.
  - It is invisible to today's ladder only because the AI never plays from banish (Blaze's pick
    parses `min:0`, and `autoAnswer` declines it). It is sev-3, illegal play allowed.
- **The fix that needs no ruling.** "You may play it this turn" is ONE permission. Strip the
  play-permission stamps when the played card is filed after it resolves, on BOTH paths, through one
  helper.
  - Drill it on the real routes: Blaze's ability (Snapback), Pouncing Paws (Crouching Tiger), and
    Mounting Anger / Rising Resentment's banished attack.
  - Each is playable once, then refused with a sentence.
- **The feed and the state disagree for Crouching Tiger.** It is ephemeral, and the feed says "it
  ceases to exist" while the card lands back in banish. Make the two agree with whatever destination
  rules.
- **Minor, same release.** `mkBanish` (`effects.js:~2438`) mints with the deck ENTRY's lowercased
  name (`{...rec}` keeps "crouching tiger"); v5.28 fixed only the "springs into" line. Use the
  database's name, as v3.33's token mint does.
- **The destination is a RULING, not a build** (see NEEDS A RULING). The filing comment calls
  banish-on-resolution "the printed rule for the cards that reach back into those zones". Measured
  over the pool, no card that grants a play from banish prints that: Blaze's ability, Pouncing Paws,
  Mounting Anger, Rising Resentment, Gate to i'Arathael. The repo has no verbatim CR quote either
  way. Keep the destination unchanged and record it as stated with a probe, e.g.
  `played-from-banish-files-to-banish`.

**H7 (Blaze): a CLEAN NEGATIVE once S9's defect is neutralised; nothing to ship.** Measured on v5.41
by the investigator; the experiment is kept at `experiments/H7-blaze-negative.patch`.
- On the frozen engine, "play the banished card, and hold instants on the opponent's turn" read
  Blaze [5,2,3] -> [10,9,8]. 293 of 401 banish plays in the probe were REPLAYS through the S9
  defect.
- With the defect neutralised, the result is [7,5,5], which overlaps and is not real.
- "Hold instants on the opponent's turn" also costs Boltyn his defensive instants (Toe the Line,
  Glisten): his interval falls [10,14] -> [5,7]. It must not ship as a blanket rule.
- Measured leaks, recorded:
  - 9.8 energy unspent per Blaze turn.
  - Cindering Foresight's amp lapses on the opponent's turn 261 times.
  - Crucible's {r} amp pitches the last card in hand 207 times.
  - Every "arcane before attacks" or "spend energy" variant was negative in probes.
- Re-measure after S9 ships; the honest answer today is that the policy's Blaze gap is not yet
  found.

**THE USER'S BUG REPORT, 2026-10-25** (`dawnblade-bug-kayo-t1-1792898007684.json`, v5.40, the table, Kayo v
an AI Blaze, opponent first). Four observations; all four are real, and they make three items.
> *"my blaze opp whispered on t1 and I got to opt, also while opting unjustly I couldn't figure out how to
> reorder cards. Lastly I think guardwell on the predatory plating might be coded slightly wrong - the piece
> should remain in play with -2 defense after blocking with it but one time it went to grave after blocking
> … I do like the 'usable' equipment and hero cards etc to show up in the hand rail but they don't in the vs
> ai mode."*

**S10. SHIPPED as v5.43 (`c5d4e02`), CEO-verified 2026-10-25:** 3673 drills, 0 fail, 5 skipped; scenes
107/107; both repros now answer the right seat; all 21 engine script tags and `.nojekyll` in the pushed
commit; CI drills and Pages green; the 3-seed ladder byte-identical to v5.42. New census
`test/promptside.test.js` (every `promptQ` push names a side) and `test/platingseat.test.js`.

**S10. Two seat defects, ENGINE, after S9 (v5.43). CEO-reproduced and fixed in a scratch copy:
`experiments/S10-opt-seat-controlpow.patch` (3 lines), suite 0 fail / 5 skipped.**
- **(a) An opt resolved by seat 1 opens on SEAT 0, over seat 0's deck.** The two opt specs
  (`effects.js:2070`, `opt`; `:2105`, `lookOrder`) carry no `side`, and `prompts.buildPrompt` defaults a
  missing side to 0. In the report, Blaze (seat 1) played Whisper of the Oracle and the sheet offered Kayo
  the top three of KAYO's deck. Blaze's energy still landed, because it is credited at the queue.
  - It is a free opt for whoever sits in seat 0, at the table and over the network alike. The trainer
    cannot reach it, because its seat 1 never opts.
  - Every existing opt drill runs at seat 0, the one seat where the default happens to be right.
  - Repro: `node experiments/S10-opt-seat.js <tree>` prints `actor 1 opt: prompt.side=0 cards=Wild Ride,
    Buckwild, Bare Fangs`.
  - Fix: `side: actorOf(n)` on both specs.
  - Census the family: every `promptQ` push in `effects.js` names a `side` or goes through a `*Spec(…,
    side)` builder. Measured, these two were the only ones without one. Pin that set, so that a new spec
    without a side fails a drill rather than defaulting to seat 0. Drive the opt at seat 1 on both variants.
- **(b) "Activate this only if you control a card with 6 or more {p}" counts the OPPONENT's attack.**
  `activateIfOk`'s `controlPow` (`effects.js:9814`) adds `s.pend.card` whoever declared it.
  - Repro: `node experiments/S10-plating.js <tree>`. Dorinthea (seat 1) swings a 6-power attack.
    Kayo's Predatory Plating "Destroy this: Gain {r}" is then LEGAL for seat 0 in the attack, defend,
    reaction, damage and resolution steps. It must be refused in all five, with the card's own sentence.
  - Fix: count `pend.card` only when `pend.by` is the asking seat, the test `chainAtkOf` already makes.
  - Positive control: Kayo's own 6-power attack still enables it (checked).
  - This is half of the user's Guardwell report; S11 has the other half. **Guardwell itself is right:**
    the SKA006 printing reads "When the combat chain closes, if this defended, put -1{d} counters on it
    equal to its {d}". The piece stays in play at 0. Upstream's `keyword.csv` has an empty Guardwell row;
    record the printing in CLAUDE.md the way Heave and Retrieve were.
- **Measured:** the 3-seed full ladder is BYTE-IDENTICAL with the patch (630 games, 0 refusals, 0 violations,
  1 stall gravy-briar-2, as v5.41). The policy never reorders an opt and never fires the Plating on the
  opponent's turn, so neither defect could move a ladder number. Both are human-facing.

**S11. SHIPPED as v5.44 (`5f0ea7a`), CEO-verified 2026-10-25:** 3679 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; it
touches `index.html` only, and the 3-seed ladder is byte-identical to v5.43. The Shipper drove it at 393x852:
Kayo's Plating declares and survives, the rail offers its ability on Kayo's turn, and Gravy replays
Limpit from the graveyard. Its "Limpit keeps its point" finding is the Compass working as printed
(FEED TEXT item 20).

**S11. The table's hand rail and gear tiles, UI (v5.44).** Reported by the user; CEO-read in source.
- **The rail.** The trainer's hand rail appends `playables` (`index.html:5443`): weapon swings, each
  equipment ability's powCard, the hero power, and cards playable from the graveyard or banish. The
  table's rail (`:7409`) shows the hand and the arsenal only. Build the same rail at the table.
  - Each entry is an ACTION, lit when `mine(a)` (judge.legal) and dim otherwise, two-tap to commit. The UI
    reads no card text (v3.84), so judge decides what is legal.
  - **The graveyard and banish half is a missing ROUTE, not only a missing button.** `judge.legal`
    accepts `from: "grave"` / `"banish"`, but the table has no control that sends one. A human Gravy
    Bones cannot replay a watery-grave ally there, and a human Kayo cannot play Crouching Tiger. Offer
    exactly the cards `judge.legal` accepts from those zones, so a 30-card graveyard does not flood the
    rail.
  - Keep the armour grid's tiles as well. The user likes the rail, so the rail is the addition.
- **The tile's one tap picks the ABILITY over DEFEND** (`:7133`, `cellAct = swing ? : ability ? : defend`).
  In the defend step, once the attacker passes, the defender holds priority. If the piece's instant is
  legal there, the tile commits the ability. With S10(b) unfixed that is exactly how the Plating "went
  to grave after blocking": a double tap meant to block destroyed it for {r}.
  - Rule: while `defend` (or "stop defending") is legal for the piece, the tile's tap is the
    declaration. The ability is reached from the rail entry above, which is the trainer's shape: two rows
    for two routes.
  - Pin it with a census in the style of `test/tapdoor.test.js`.
- Drive it on the phone page at 393x852 (the v4.28 step): Kayo blocking a 6-power swing with the
  Plating. The tap declares it, the rail offers the ability only on Kayo's own turn, and no tap is dead.

**S12. SHIPPED as v5.45 (`cbbc0ae`), CEO-verified 2026-10-25:** 3692 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; CI and
Pages green; the 3-seed ladder byte-identical to v5.44. The Shipper drove a reorder at 393x852 on both
boards.

**S12. Opt can only send cards to the bottom; it cannot ORDER the ones kept on top. UI + prompts (v5.45).**
- The ruling `effects.js:2059` records: "look at the top X, then put them back on top or bottom IN ANY
  ORDER". The sheet (`PromptSheet`, `index.html:2367`, shared by both boards) offers only the top/bottom
  toggle, and `applyPrompt` keeps the kept cards in the order they were dealt. It is weaker than printed,
  on every opt card in the pool, and the user looked for the control and found none.
- **The model.** `prompt.order`, a permutation of the kept indices (default: dealt order), and one
  reader `promptMove(prompt, i, dir)` in `prompts.js`, used by both boards.
  - `applyPrompt` writes the kept cards in `order`.
  - The table needs a new action in `PROMPT_ACTIONS`; `test/promptctl.test.js` will demand the control
    (v4.61).
  - The ORDER of the cards sent to the bottom stays a stated approximation: no pool record reads the
    bottom of a deck (`applyPrompt`'s own note).
- **The control** (CEO's call, one-hand phone):
  - The sheet shows the cards in their RESULTING order, left to right as drawn, each labelled
    "1st draw", "2nd draw"… or "bottom".
  - Tapping a card still toggles top/bottom.
  - Each kept card carries two arrows under it, "◀" (earlier) and "▶" (later), each at least 36x28.
  - The hint says both: "Tap a card to send it to the bottom. ◀ ▶ change the order you draw them in."
- **`keepTop` (Spire Sniping) gets the arrows too.** Its "tap to put it under the rest" toggle stays
  as it is.
- **Policy:** `autoAnswer` keeps the dealt order, so the ladder is unchanged by construction. Say so,
  and prove it by running it.
- **Design note for the stage (Appendix C.1):** on the wheel, the arrows become the wheel's order. A
  spin decides the draw order, and a tap on the top card sends it to the bottom. The CEO updates
  STAGE.md.

**H8. SHIPPED as v5.46 (`97b4b75`), CEO-verified 2026-10-25:** 3696 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; the
3-seed ladder is identical to the CEO's H8 measurement. New drill: `test/defending.test.js`.

**H8 (Lyath). While it defends, the seat plays only a card that helps the link. POLICY, after S12
(v5.46). CEO-measured on v5.44; the patch is ready: `experiments/H8-lyath-defending.patch`
(3 files, 78 lines).**
- **The gap.** `sparring.reaction` plays the cheapest legal card in every reaction window, and
  on the opponent's turn that includes any instant.
  - So Lyath spent his Guardian Instant Auras (The Suspense is Killing Me, Edge of Their Seats,
    Tension in the Air, Act of Glory) and Concealed Object while being attacked. That was 194
    plays and 105 pitches on the opponent's turn in 28 games; Briar pitches once there and Kayo
    plays nothing.
  - He began his own action phase with two cards or fewer in about 70 of 219 turns. He never made
    a second attack in a turn, and made none in 67.
  - Probes: `experiments/H8-handsize.js`, `H8-turns.js`, `H8-zero.js`, `H8-conds.js`,
    `H8-read.js`. Each takes `<tree> <hero>`.
- **The rule.** While the seat is defending (`pend.by` is the other seat), the reaction branch
  proposes only a card that helps this link: a defence reaction, or a card whose payload prevents
  damage. Everything else waits for the seat's own turn.
- **Judge reader:** `judge.defendsNow(g, seat, uid, from)` is true when `fxParse(card).dr` holds,
  or when an op is one of `ward`, `revWard`, `arcShield`, `awd`. Drill it on Drag Down, Oasis
  Respite, Toe the Line and Throw Caution (true) and on Edge of Their Seats and Concealed Object
  (false), and pin the op set.
- **Measured (3 seeds, `node tools/tourney.js lyath '' 3`):**
  - Lyath's own seat: [2,3,3] -> [5,6,6], DISJOINT.
  - Rejected: E2, "play instants before the attack on your own turn", read [1,2,4] alone and
    [4,4,3] together with E1.
  - With the rule on Azalea's or Gravy's own seat only, the results are byte-identical; on
    Boltyn's, [4,9] -> [5,8], overlapping.
- **Full ladder with the rule on every seat:** 0 refusals, 0 violations, **0 stalls** (v5.44: 1),
  and no hero's interval separates. Means v5.44 -> rule:
  - up: lyath 5.7->7.7, blaze 5.7->7.7, bravo 8.7->10.7, enigma 10.0->10.7;
  - down: gravy 10.3->7.7, azalea 7.0->5.0, boltyn 11.3->9.7, iyslander 11.3->10.7;
  - the top seven are within one win either way.
  - The dips are opponents improving, not the rule on their own seat (above).
- **The census moves.** `test/speccensus.test.js` loses `ctrStamp` (v4.58's shape). The patch adds
  a 39th leg, Fai v Enigma with Enigma's chair first (seed `ctr-7-8-1`), measured as the first
  pairing that still reaches it. Every other field is unchanged, and the suite is 0 fail.
- Drills:
  - Lyath defending holds Edge of Their Seats and plays Drag Down.
  - On his own turn the held aura is still playable.
  - Sabotage the `defending` test, the reader's `dr` half, and each op.

**S14. SHIPPED as v5.49 (`4616e81`), CEO-verified 2026-10-26:** 3710 drills, 0 fail, 5 skipped; scenes
107/0; babel ok; scripts + `.nojekyll` present; CI and Pages green; ladder byte-identical to v5.47. The
CEO's mislabel probe reads 0 of 16 `chargeFirst` calls on a card without a charge (was 38 of 54).

**S14 (original item). The call's reason names a charge for a card that offers none. VOICE ONLY (with feed 19-20).**
Found by the CEO on v5.47, tracing Fai. `sparring.js` `pickWhy` tests `rankC(x) < 3 && x.cv &&
!x.cv.charged` before `x.kap`; `judge.chargeView` answers an object for every hand/arsenal card
(`offers:false` for one with no charge), and `rankC` is 0 for any attack that keeps the point. So
every go-again attack, for a seat that has not charged, is labelled `chargeFirst` ("Swing the attack
that lets you charge first…"). Measured over 15 self-play games, one per hero: 54 `chargeFirst`
calls, 38 on a card that offers no charge (Fai 16, Gravy 7, Arakni/Briar/Azalea 4, Viserai 2,
Enigma 1). Repro: Fai v Kayo seed 0, turn 1, Ronin Renegade. Order the key `kap` first, then the
charge rank; the action never moves, so the ladder stays byte-identical. Drill: `chargeFirst` only
names a card whose `chargeView.offers` is true (Boltyn positive, Fai's Ronin Renegade near-miss).
Sent to the Shipper 2026-10-26 with feed 19-20.

**H12 + H13 + H14a SHIPPED as v5.50 (`c24c6b4`) by Shipper 3, CEO-verified 2026-10-31** (see HANDOFF).

**H12 (policy, every hero with a free optional pick). MEASURED REAL — ship it.** `judge.autoAnswer` answers a
`min:0` pick with an empty selection, so the AI declines every optional pick, including ones it has
already paid for. Census, 60 self-play games on v5.47 (pick | zone->to | rider | times declined):
- **paid, then its payload declined:** Death Dealer's put (the {r} paid) 18, Bull's Eye Bracers' put
  (the piece destroyed) 8, Blaze's hero power banish 18.
- **free cards declined:** Rise from the Ashes (Phoenix Flame back to hand) 2, Flamecall Awakening's
  deck search 3, Jack Be Quick's graveyard banish for +1 and go again 4, Sigil of Silphidae's
  graveyard banish for 1 arcane 3, Crash and Bash's reveal for a Seismic Surge 8, reloads 5.
- **priced, left alone:** Pick Up the Point / Up Sticks and Run retrieve ({r}), Condemn to
  Slaughter, Golden Tipple's discard, Mounting Anger / Rising Resentment's hand banish.
- Experiment (judge.js, `SPX`-gated): take the pick when it is cost 0, no `filters`/`discard`/
  `maxAll`, and is either a dead zone (grave/deck/banish) to hand or banish, a reveal, or hand to an
  empty arsenal. Best card by printed power, ties on uid. Blaze's banish is NOT in it: the policy
  never plays from banish (H7).
- **Result (CEO, v5.47, `experiments/H12-free-picks.patch`, census `experiments/H12-optpicks-census.js`).**
  - Azalea own seat, 12 seeds: [6,4,3,3,2,2,2,4,1,2,2,2] (2.8) -> [11,6,9,9,3,9,12,10,9,6,10,9] (8.6),
    up on 12 of 12 seeds. One seed (s4: 3) keeps the own-seat intervals touching.
  - `PCLS=ars` alone gives the IDENTICAL result, so the hand-to-arsenal put (Death Dealer, Bull's Eye
    Bracers, reload) carries all of it. `dead` and `rev` are free by construction and move nothing
    measurable (Fai 8.3 -> 9.3 at 6 seeds, Briar/Viserai/Bravo noise at 3).
  - Full ladder with every seat on (the shipping configuration), 3 seeds: Azalea [11,6,5] (7.3) ->
    [21,15,21] (19.0), DISJOINT. Every other hero inside the band. 0 refusals, 0 violations, 0 stalls.
- **Build it ungated in `judge.autoAnswer`** as a named reader (e.g. `judge.freePick(p)` answering the
  class or null), so a pick's freeness is stated once. Keep the exclusions exactly: any `cost`,
  `filters`, `discard`, `maxAll`, a caller-supplied pool (`zone == null`), a board or gear zone, a
  hand-to-banish or hand-to-graveyard move.
- **Drills (real cards):** taken: Death Dealer and Bull's Eye Bracers (the arrow reaches the arsenal,
  Death Dealer draws), Rise from the Ashes and Flamecall Awakening (a Phoenix Flame to hand), Crash and
  Bash (the reveal mints a Seismic Surge). Still declined: Pick Up the Point's retrieve ({r}),
  Condemn to Slaughter, Golden Tipple's discard, Mounting Anger's hand banish, Blaze's hand banish.
  Sabotage each class and each exclusion.
- **The call's voice:** `explain` keys a taken optional pick as `pickMin` ("Choose this one."). A key
  of its own reads better, e.g. "Take it. It costs you nothing."
- **The spec census may move** (Azalea's games change): more legs, not a looser claim.

**H13 (policy, Enigma/Bravo/Iyslander/Kayo). Ship WITH H12: the arsenal step never stores a card
that cannot leave it.** Found by the CEO on v5.47 (`experiments/H13-apleft.js enigma`): at the end
of Enigma's turns her arsenal held Test of Strength 48 times and On the Horizon 43. The arsenal
step takes the highest-power card in hand, so a hand with no attack stores a BLOCK card (or an
Inner Chi), which has no play, cannot be pitched or declared as a defender from the arsenal, and
clogs the slot for the rest of the game.
- **The fix:** `judge.arsenalUsable(g, seat, uid)` answers `types.isPlayable`, and the arsenal step
  filters on it; with no usable card it leaves the arsenal empty and the card stays in hand to block
  or pitch. Patch: `experiments/H13-arsenal-usable.patch`; with H12: `experiments/H12-H13-combined.patch`.
- **Measured: noise in wins, dominant by construction.** Enigma [5,4,4,7,6,5] (5.2) -> [5,6,5,5,7,5]
  (5.5) at 6 seeds; Bravo and Kayo byte-identical, Iyslander noise. Full ladder with H12+H13 on every
  seat: 0 refusals, 0 violations, 0 stalls; Azalea 19.0 as with H12 alone.
- **Why ship a noise move:** "[Hero]'s call" shows this branch to the player, and it currently says
  "Keep your biggest attack face down" while storing a Block card. H11's reason. Give the arsenal
  step's reason a second key for a non-attack ("Keep it face down. It can be played from there.")
  and say "arsenalSkip" when only unusable cards are left.
- **Drills:** Enigma's hand of Test of Strength + On the Horizon leaves the arsenal empty; a hand
  with an attack still stores it; Inner Chi is never stored. Sabotage the filter.

**H14a (policy, Boltyn). Ship WITH H12 + H13: charge the colour the card asks for.** Found by the
CEO on v5.47 tracing Boltyn. The charge answer takes the LOWEST pitch, and Beaming Bravado ("if a
yellow card is charged this way, this gets +1{p}") and Light the Way (go again on hit if a yellow
was charged) pay off only for a yellow, so the AI charged a red over a yellow in hand.
- **The fix:** `judge.chargePitchWanted(g)` answers the pitch the pending card's `chargedPitchN`
  condition asks for (null if none); the charge answer prefers that pitch, then the lowest, then uid.
  Patch: `experiments/H14a-boltyn-charge-colour.patch`; all three: `experiments/H12-H13-H14a-combined.patch`.
- **Measured: noise in wins.** Boltyn [6,3,4,2,5,8] (4.7) -> [5,4,7,2,7,8] (5.5) at 6 seeds. Full
  ladder with H12+H13+H14a on every seat: 0 refusals, 0 violations, 0 stalls; Boltyn 9.3, Azalea 19.0.
- **Why ship it:** the call says "Charge your lowest-pitch card" while the card in play prints "if a
  yellow card is charged". Give it a reason of its own ("Charge a yellow card. This card pays off
  for yellow.").
- **Drill:** Beaming Bravado with a red and a yellow in hand charges the yellow; Bolt of Courage
  (asks no colour) still charges the red. Sabotage the preference.
- **Not built, recorded:** Duty Bound Blitz ("play this only if a yellow card has been put into your
  soul this turn") in hand also wants a yellow charged, from ANOTHER card; and a charge attack with no
  go again can spend the last action point before the Raydn swing the charge pumped (Boltyn T7,
  Dorinthea seed 0). Both are sequencing judgements, measure before building.

**H15 (policy): a last-resort ability never pitches a card. NEGATIVE, not shipped.** CEO, measured
on top of H12+H13+H14a (`experiments/H15-no-pitch-fallback-NEGATIVE.patch`, census
`experiments/H15-abpitch-census.js`). The census over 120 games found the gear/hero fallback paying
by pitch often: Crucible of Aetherweave (Blaze 70, Iyslander 54), Lyath's hero ability 23, Death
Dealer 15, Fai 10, Enigma 9 + Uphold Tradition 6, Bravo 6, Beckoning Haunt 4.
- Holding every such activation, own seat at 3 seeds: Iyslander [5,4,8] -> [8,7,8] (overlapping);
  Blaze, Fai, Enigma flat; Lyath 4.3 -> 3.3, Viserai 8.3 -> 6.0, Azalea 8.7 -> 6.0, Bravo 5.3 -> 3.7.
- Read: a pitched ability is often worth its card. Lyath's end-of-turn boo makes a Might token for his
  next attack, and Death Dealer's put (H12) needs its {r}. If anything, the lead is Crucible's amp
  alone (it lapses at end of turn with no arcane left to play), and it overlaps.

**H16 (policy, Blaze/Fai): take Blaze's banish and play from banish, WITHOUT H7's "hold instants".
NOISE, not shipped.** On H12+H13+H14a: Blaze [1,2,5,1,4,3] (2.7) -> [2,3,3,3,5,3] (3.2) at 6 seeds;
Fai identical. H7's reading stands.

**H17 (policy, Gravy): rank an ally DEPLOY apart from a swing. NEGATIVE both ways, not shipped.**
On H12+H13+H14a, Gravy 179 of 277 turns end with an ally able to attack and no action point. The
offence ranks an ally card in hand by printed power as though deploying it were a swing
(`experiments/H17-ally-deploy-last.patch`, `judge.allyDeploy`). Deploy last: [3,2,4,1,4,2] (2.7)
-> [3,3,5,0,2,2] (2.5); deploy first (`DEPFIRST`): [1,3,2,2,3,3] (2.3). The ordering is not
Gravy's lever. His 1-life allies die to any swing at them, which the opponent's policy correctly takes
(CR 7.3.2a), and 12 of his cards print no defence.

**H19 (policy, Lyath): boo with the hero ability before an attack that wants a boo. NOISE, not
shipped.** Mocking Blow gets +N "if you've been booed this turn"; 15 of its swings came before any boo
in 28 games. `judge.wantsBoo` + `judge.heroBoos` (`experiments/H19-lyath-boo-first-NOISE.patch`)
moved the boo first: "no boo this turn" 15 -> 0, damage per swing 1.8 -> 2.1, but wins [4,3,6,4,6,2]
(4.2) -> [5,3,4,5,7,4] (4.7) at 6 seeds. The ability's {r}{r} is paid by a pitched card either way.

**H18 (policy, Blaze/Iyslander): an amp-only ability waits for an arcane card to take it. CONSISTENT
PAIRED GAIN, interval rule NOT met; queue for the next policy release.** Found by the CEO tracing
Blaze on H12+H13+H14a. With no attack in hand the gear fallback runs before the non-attack branch,
so Crucible of Aetherweave ("the next card you play this turn with an arcane damage effect … plus
1") was activated FIRST every turn, pitching a card. On turn 3 (Blaze v Dorinthea seed 0) it pitched
Emeritus Scolding, the arcane card, to amp an Arcane Polarity that deals none.
- **The rule:** `judge.abAmpTakers(g, seat, uid)` answers null unless the piece's whole payout is
  `amp`, else its effective cost and the arcane cards (`arcaneOf > 0`) in hand and arsenal. The
  fallback holds it unless the seat can pay BOTH the ability and one taker out of floating plus the
  rest of the hand. v5.38's `grantOK` (a pure grant waits for its taker), one route over.
  Patch: `experiments/H18-amp-takers.patch` (on top of the combined H12-H14a tree, `SPX4`-gated).
- **Measured at 12 seeds, own seat:** Blaze [1,2,5,1,4,3,2,4,8,1,2,1] (2.8) ->
  [2,3,5,3,6,2,6,6,7,5,2,4] (4.3), paired +1.4 (8 up, 2 down, 2 level; paired t about 2.8).
  Iyslander [5,4,8,5,7,3,4,7,6,4,2,6] (5.1) -> [7,7,9,4,8,5,6,7,4,7,8,5] (6.4), paired +1.3 (8 up,
  3 down; t about 2.1). Min/max intervals overlap for both.
- Ship it with the next policy release on the principle and the call: today "[Hero]'s call" tells the
  player to pitch their damage card for an amp nothing will take. Give the held case no key (it is
  simply not proposed); the activation keeps `gearAbility`, or better "Amp it. An arcane card follows."
- Drills: Crucible with only a non-arcane card left is not activated; with an affordable arcane card
  it is, and the arcane card then deals +1; Spellfire Cloak / Talismanic Lens are unaffected.

**S15 (engine): Display Loyalty's granted rider and the Fealty token it creates. Fai's deck. Weaker
than printed, visible in the audit.** Found by the CEO in a refreshed `npm run audit` on v5.49 (the
committed AUDIT.md still reads v5.01; refresh it with the next release).
- Display Loyalty prints "If you control 2 or more Draconic chain links, this gets go again and
  \"When this attacks a hero, create a Fealty token.\"" The head (`drac2` -> `ga`) reads; the rider
  is `fx.quotedUnread`, refused on purpose at v3.10 ("triggers on *attacks* rather than hits").
  It is the LAST unread quoted rider in the pool.
- The machinery exists now: a condition entry carries `atkHero` (v3.46), and the condition loop runs
  an attack's conditions at declaration, which is when a granted "when this attacks a hero" fires.
  So the rider is one more `{cond: "drac2", op: <token Fealty>, atkHero: true}` entry.
- **Build Fealty with it, or not at all** (v3.72: building a source makes what it creates
  reachable). Fealty reads `none` today: "Instant - Destroy this: The next card you play this turn
  is Draconic" and "At the beginning of your end phase, if you haven't created a Fealty token or
  played a Draconic card this turn, destroy this." Without the clock a Fealty sits in the arena
  forever. The grant is for the next CARD (not attack) and must be spent by it (v4.06's `dracNext`
  lesson). `hist.playTy` already records the structured types, Draconic included; "created a Fealty
  token this turn" needs a record of its own.
- The AI never activates an arena ability (v4.47), so the ladder will barely move; the human playing
  Fai gets the printed card. Drills: the rider fires only at 2+ Draconic links and only at a hero; the
  token's ability makes the next card Draconic once; the clock keeps it while the condition holds
  and destroys it when it does not.

**S13. SHIPPED as v5.47 (`91fb2ba`), CEO-verified 2026-10-26:** 3705 drills, 0 fail, 5 skipped;
scenes 107/0; both babel blocks compile; 21 engine scripts + `.nojekyll` in the pushed commit; CI
and Pages green. Ladder at 3 seeds byte-identical to the CEO's H8+S13 measurement
(`full-s13b`), 0 refusals / 0 violations / 0 stalls. The trainer's box is labelled "Coach's call"
and still runs `advise`, because `sparring.explain` needs a judge state and the trainer's seat 1 is
the tuned `[3,4,5]` dummy. The table's box is "<Hero>'s call".

**S13 (original item). "[Hero]'s call": the advisor box says what the hero AI would do in your seat. UI + sparring
(v5.46).** RULING (user, 2026-10-25): *"Instead of 'Claude's call' replace it with '[kayo]'s call'
which tells the player what the hero ai would do in each situation."*
- **The call is the policy, run for the player's seat.** At the table (local sessions, seat 0, the
  same gate the Advisor has today at `index.html:7380`), the box runs `sparring.act(g, mySeat)` and
  says that action in words. The AI seat across the table runs the same function, so the box and the
  opponent cannot disagree about how the AI plays. It reads nothing the player cannot see; the policy
  is already held to that.
- **One body: `sparring.explain(g, seat)` → `{action, line, why}`.**
  - `action` is exactly what `act` returns. A drill drives self-play and asserts
    `explain(g,s).action` deep-equals `act(g,s)` on every state.
  - `line` names the action with card NAMES only, and names are not card text. It is the imperative
    addressed to the player: "Play Bare Fangs", "Pitch Wild Ride", "Block with Predatory Plating",
    "Swing Mandible Claw", "Use Kayo's ability", "Put Bare Fangs in your arsenal", "Boost it",
    "Opt: keep all three on top", "Pass", "End your turn".
  - Every action type the policy can emit has a line. Census it both ways: drive self-play over the
    ladder seeds, collect every `a.t`, and fail on any type with no line.
- **`why` is the branch that decided, never a guess written afterwards.** `act` gains an OPT-IN
  note out-param (v3.58), `act(g, seat, o, note)`, and each branch sets `note.why` to a key. The
  keys and their sentences live in one table beside `act`. Measured branches, each with a reason
  the code already states:
  - **pending:** the cheapest pitch that covers the cost; boost when half the remaining deck pays
    for it (H3); the lowest-pitch charge (v4.99); declining a price it cannot weigh (v4.24).
  - **prompt:** decline what is optional; take the printed minimum; keep an opt's order.
  - **arsenal:** the biggest attack goes face down.
  - **defend:** blocks to stay out of lethal; takes up to N rather than spend a card; equipment
    first, because iron wears instead of leaving.
  - **offence:** a non-attack that keeps the action point goes first (H2); arcane first (H5); the
    go-again chain (H4); charge, then swing the pumped weapon (H6); the biggest affordable attack;
    an ally that dies to this swing (v3.81); non-attacks last (v3.80).
  - **reaction:** the cheapest legal reaction, one per link.
  - **nothing to do:** pass or end the turn.
  - Each sentence is coach-voiced and plain, with no version numbers and no identifiers.
    `test/noopvoice.test.js`'s rules apply.
- **Waiting is a call too.** When the seat cannot act (`act` returns null), the line says who holds
  priority: "Dorinthea is deciding."
- **The label.** "✦ Kayo's call", taken from the seat's hero name before the comma, as the rail's
  `them.name.split(",")[0]` does. `build.js:815`'s turn-one read is "Kayo's read", and
  "Claude's read" goes with it.
- **The trainer cannot run the policy** (its state is `mode`/`bphase`, not the CR machine). It
  keeps `advisor.js`, relabelled "✦ Coach's call", so no box claims to be the hero AI where it
  is not. The CEO reports that choice to the user. A drill: the string "Claude's call" appears
  nowhere in `index.html`.
- **THE ENGINE HALF IS BUILT AND MEASURED (CEO, 2026-10-25):** `experiments/S13-explain-H11.patch`,
  402 lines over judge.js, sparring.js and speccensus, REBASED onto v5.46 (`97b4b75`): it applies cleanly,
  the suite is 0 fail, and the ladder is identical to the prototype.
  - `sparring.explain(g, seat)` returns `{action, key, why, line}`. A module-level `NOTE` is set
    only inside `explain`, and every return site calls `tag(key, action)`, so `act` alone is
    unchanged. The reason table is `sparring.CALL_WHY`, 46 keys. `BY_TYPE` gives the reason for
    a site a drill pins verbatim (`addPay`).
  - **Checked by `experiments/S13-explain-check.js <tree>`.** Over 30 self-play games and 15,076
    states, for both seats: 0 mismatches between `explain(...).action` and `act(...)`, 0 actions
    without a reason, and 0 with no line. Make it a drill. Eleven keys are not reached by that
    sample, which is expected.
  - **Names that collide with the guards were renamed:** `allyAttack` is a banned parser name, and
    `WHY` is read as a bare call in index.html's prose. Keep `CALL_WHY`.
  - **H11 is folded in, because the call shows this branch to the player.** The gear fallback
    activated any legal equipment ability, so Blossom of Spring, Garland of Spring and Predatory
    Plating were destroyed for {r} at the end of a turn with nothing to spend it on.
    `judge.abPieceForRes` holds a self-destroying ability whose whole payout is resources. A blunter
    first draft also blocked Beckoning Haunt's aura return, and the census showed it (`xPay` left).
    - The full ladder with H8+H11 is 0/0/0, and every hero's interval overlaps H8 alone.
    - The census swaps its `keepTop` leg to `fs-5-0-1` (Azalea v Kayo, Kayo's chair first). The
      suite is 0 fail.
  - **What is left for the Shipper:**
    - the drills: equality over self-play, every action type has a line, the reason sentences
      under `noopvoice`'s rules, and sabotage of `tag` sites;
    - the UI: the box label, the table wiring, the trainer relabel and the "Claude's call" absence
      drill;
    - the phone drive.
- **Drive it on the phone page at 393x852:**
  - Kayo v the AI: the box updates on every state, at the action phase, the defend step, a pitch
    payment, an opt sheet and the arsenal step.
  - Doing what the box says never meets a refusal.
  - The ladder is byte-identical (the note out-param is unused there). Run it to prove that.

**H9 (Azalea): a CLEAN NEGATIVE.** CEO-measured on v5.44 with H8 applied, 3 seeds.
- **The lead.** Azalea's hero ability, her engine, is used 26 times in 28 games. The policy proposes
  a hero ability after every attack, and once her arsenal arrow has been shot the ability has
  nothing to put on the bottom. She takes 38 "no aim counter" misses, and Crow's Nest is offered
  19 times.
- **The experiment.** An action-speed hero ability whose own go again is unconditional goes before
  the attack. The reader is `heroKeepsAP`; Azalea and Bravo qualify, and Boltyn's attack-reaction
  ability does not.
  - Always first: Azalea [2,3,4] -> [0,1,2], WORSE, because it cycles away the arrow she would
    have shot. Bravo [7,2,7] -> [7,1,7].
  - Only when the arsenal card is not a legal attack: Azalea [2,2,4], Bravo [6,2,5], both noise.
- Nothing ships. Her gap is still open: aim counters, and the 185 arrows she blocks with
  from hand, are the next leads.

**H7b (Blaze) re-measured after S9, on H8: overlapping, not shipped.** Playing the card Blaze's
ability banishes "this turn" (the H7 patch's `playNowPick` and banish play):
- 6 seeds: [3,2,5,3,6,3] (3.7) -> [5,5,6,6,9,4] (5.8). The intervals overlap at [4,6].
- H7's stricter "reactions only on the opponent's turn" hold adds nothing on top of H8
  (identical numbers).
- The same patch without H8, on v5.44: [5,2,3,1,4,2] (2.8) -> [7,5,5,7,10,5] (6.5). The intervals
  touch at 5.
- Recorded rather than shipped, under the standard every H item has met.

**H10 (Bravo): noise, not shipped.** CEO-measured on H8, 6 seeds.
- **The lead.** He deals 1.4 a swing (8.4 power into a 5.9 wall) and uses his hero ability 18
  times in 28 games. The ability flips a face-down arsenal card, and one with crush gets +2{p} and
  dominate.
- **The experiment.** Flip first when the arsenal is face down, then attack with the card stamped
  this turn.
  - It fires: ability uses 18 -> 75, damage per swing 1.4 -> 1.9.
  - Wins [7,2,7,7,4,2] (4.8) -> [5,1,7,8,6,3] (5.0), overlapping.

**H8+.** One gap at a time, one investigator at a time, each rebased on the latest release.
Waiting, by the v5.44 ladder: Bravo (8.7), Gravy (10.3, 7.7 under H8); Lyath has H8, Azalea H9 and Blaze H7b are recorded;
then Blaze again after S9. **Order: H12 + H13 + H14a (one policy release; feed 19-20 shipped v5.48, S14 v5.49), then S15,
then the next census lead, one at a time.**

## v3 — STAGE INCREMENT 1 INPUTS (CEO, 2026-10-17)

The v2 queue is complete. These come from the Stage design (`design/STAGE.md` on branch
`design/stage`, Appendix B), measured over the 210-game self-play corpus at `4d42c58`. Every
line reference below was re-read on `origin/main` at `4d42c58`. They are the feed and state
work of **increment 1, "Truth first" (v5.31)**, which changes no look. Same rules as v2: one
item per release unless it says batch, re-verify first, and update `tools/selfplay.js`'s route
regexes in the same commit as any wording change (v3.81).

**S1. `strike` records the power it subtracted the wall from as `pend.power`.** Neither
`pend.total` (the declared power) nor `pend._struck` (stamped before the late bonuses,
`effects.js:7442`) is that number. Counting prevention, an equation `power − wall → dealt`
is wrong on 282 of 4,224 hero strikes against `total`, 97 against `_struck`, and 0 against
the total `linkPumps` returns (`pre.total` in `strike`). One key at `judge.js:2220`. State
hashes change once, deliberately: re-pin them in that commit and say so.

**S2. The shared feed names hidden cards: 2,124 lines, 10 shapes, every game.** Compass and
Scout the Periphery are already recorded (`look-named-in-shared-feed`, v5.30). Not yet:
- `(b) <card> is set in the arsenal, face down.` — `judge.js:3457`, 1,347 lines, 210 games.
  Name the seat, not the card.
- Opt and Spire Sniping's reorder: `prompts.js:1179-1184` (214 lines). The "sent to the
  bottom" branch (`:1184`) never fired, but it names cards the same way.
- Azalea's ability names the face-down arsenal card it sends to the deck: `effects.js:1435`
  (46 of 61 lines of that shape).
- Hand-to-deck moves with no printed reveal (Rising Sun, Setting Moon; Stroke of Foresight's
  mode): `prompts.js:1218-1221` (29 lines).
- Boulder Drop's crush names the card forced from the defender's hand: `effects.js:1283` (3).
Batch into one release. Check the trainer's feed for the same lines.

**S3. Second person in the shared feed: 1,716 engine-voice lines in 27 shapes.** Both seats
read the feed (v2.83). Largest first, with where the text is written:
- noop reasons: `parser.js:1713` (299), `parser.js:2510` (263), `parser.js:880/882` (152),
  `parser.js:3146` (44), `parser.js:1925` (2);
- `condWhy` phrases: `effects.js:3002-3025` (13 shapes, about 445 lines);
- `effects.js:581` (118), **`effects.js:8151`** (118, Dorinthea's "your hero ability frees
  it"), `effects.js:2699` (86), `effects.js:2675` (52), `effects.js:2241`, `2324`, `4033`,
  `4359`, and the next-attack labels from `parser.js:4086-4087` via `effects.js:1629`.
The 845 quoted token lines (`effects.js:1996`, `created on X's board — <printed line>`) are
the card's own printed text and are NOT a defect. Batch; widen `test/noopvoice.test.js` so a
noop reason cannot say "you"/"your".

**S4. Hard-coded names and a lowercased name in engine strings.** `effects.js:581` prints
"Kayo makes Might" and `parser.js:1713` prints "Gravy Bones'": a hero and a token named
inside the engine (golden rule). `effects.js:2430` prints `norm(v)`, so the feed reads
"Your next crouching tiger". Rides with S3.

**S5. Every attack prints its declaration twice.** `judge.js:3377` ("attacks with / swings")
and `effects.js:5076` ("— N power on the chain"), 4,443 of 4,443 attacks. Keep one line that
carries both facts. Mind the `swing`/`attack` route counters (v4.46).

**S6. A defender the feed never names.** When the wall totals 0, `strike` prints no Wall line,
so a card that defended for 0 (a halved card hit by Shred, 3 strikes in 2,100 games) is never
mentioned. Print the wall when anything was declared.

**S7. Doc fixes (ride with any release).** `ROADMAP-MULTIPLAYER.md:232` still calls the
2026-07-25 "no AI opponent" decision "still right"; it was reversed 2026-08-14. CLAUDE.md
points to `HANDOFF.md` ("THE NEW DIRECTION") for that reversal; it lives in
`HANDOFF-MERGE.md:188`.

**Not for the shipper (UI, increment 5):** the trainer's `onState` funnel calls
`DawnInvariants.errors(st)` (`index.html:6809`), so the warn band is still unread on the page
(v4.39). The Stage judge's eye reads `check()`.

## THE ORDER — v2 (work this list; numbers in brackets point at the item text)

Done: [1] v5.12, [2] v5.13. Also shipped from the trigger-order measurement: v5.09, v5.10,
v5.11. **Order items 1–7 are SHIPPED** as v5.14 (N1), v5.15 (N2), v5.16 ([3]), v5.17 ([4]),
v5.18 ([5]), v5.19 (N3) and v5.20 ([6]). The CEO verified v5.20: 3541 tests, 0 fail, 5 skipped,
fairness clean, scenes 107/107, every script tag present in the pushed commit.
Then **item 8 ([7]+N4+N5) v5.21, 9b ([8] Shred) v5.22, and 10 (N6) v5.23** shipped. The CEO
verified v5.23: 3559 tests, 0 fail, 5 skipped, scenes 107/107, every script tag present.
Then **11 v5.24, R1 v5.25, 12 v5.26, 13 v5.27 (recorded, unsourced), 14 v5.28 + v5.29, and
15 v5.30 (recorded)** shipped. **THE QUEUE IS COMPLETE.** The CEO verified v5.30: 3594 tests,
0 fail, 5 skipped, scenes 107/107, fairness clean, every script tag present. The approximation
ledger reads 24 stated, 1 open (`cloaked-display`, a UI job) and 29 closed.
**v3 (S1–S7) is SHIPPED** as v5.31 (S1 `pend.power`), v5.32 (S2 hidden cards), v5.33 (S3+S4 seat voice,
names) and v5.34 (S5 one declaration line, S6 a wall worth 0 is named, S7 doc pointers). The CEO verified
v5.34: 3607 tests, 0 fail, 5 skipped, scenes 107/107, fairness clean, all 21 script tags and `.nojekyll` in
the pushed commit, and the 210-game ladder byte-identical to v5.32 (0 stalls, 0 refusals, 0 violations,
every route counter unchanged). **Increment 1 of the Stage design is complete.** The three items under
NEEDS A RULING stay open.

1. **[N1] A declared defender's "Discard this" hand ability is legal and pulls it out of
   the wall.** Sev-3, both boards. CEO-verified on v5.13.
2. **[N2] The trainer's aura-attack door has no action-point gate.** Waxing Specter swings
   at 0 AP and leaves `ap: -1`. Sev-3, trainer only.
3. [3] Tokens in graveyards.
4. [4] Mark of the Huntsman paid with a card that's already gone.
5. [5] Late go again dropped at the table.
6. **[N3] Malefic Incantation's Runechant is made AFTER the "played or created an aura
   this turn" gate is read.** CEO-verified on v5.13.
7. [6] Run Through's "your next sword attack" rider.
8. [7] A played defense reaction is in the wall but not in the counts. Fold in **[N4]**
   and **[N5]**.
9. **[R1] THE MARK RULING (user, 2026-10-14) — build next, after item 8.** See "R1" below.
9b. [8] Shred is legal with nothing to target.
10. **[N6] `playTargetWhy` treats an untargeted `ctrPut` as targeted.** It refuses Uphold
    Tradition's flip on the trainer. This is the other half of v1's rejection note.
11. [9] Look Tuff's "unless you pay" tests floating resources only.
12. **[N7] Murkmire Grapnel's "can't be prevented" does nothing.** Verify first.
13. [10] Counters on an attacking aura after declaration.
14. FEED BATCH: [11]–[18] plus **[N8]–[N11]**. One or two releases.
15. [19] Record the Compass hidden-information leak; [N12] doc fix rides with any release.

## v2 ITEMS

**N1. A declared defender's "Discard this" hand ability is legal, and it pulls the card out
of the wall.** Source: review-b §1. CEO-verified on v5.13: `legal: null`, then the card is in
the graveyard while `blockH` still lists it, and amp is 1.
- v5.04 censused the hand readers and missed this door. `handAbilityOK`
  (`effects.js:~9494`) checks `handFree` for a "Discard a card" cost, but never asks
  `P.isDeclaredDefender` for a `cost:"self"` ability.
- So the seat blocks, sees the attack, withdraws the 3{d} for value (Arcane Twining amp 1,
  Agile Windup's Agility, Reaper's Call's mark), and the damage step skips the missing card.
- Rally the Coast Guard's "Discard a card", gated "while defending", must stay legal.
- Add the door to `test/defenderzone.test.js`'s census. Both boards: `judge.js:~1091` and
  the trainer's `activateHand`.

**N2. The trainer's aura-attack door has no action-point gate.** Source: review-b §2.
- The trainer's only AP gate is `costsAP(card) && act(s).ap<1`, which reads the AURA's own
  type line. Waxing Specter is a Mystic Illusionist **Instant** - Aura, but Cosmo's grant
  is an **Action** ("Once per Turn Action - {r}: Attack").
- So at 0 AP she swings, and `linkPayload` charges the point she doesn't have
  (`NEGATIVE-AP`, CR 4.4.3e).
- The table refuses it ("no action point left"). Refuse on `ap < 1` in the aura block, and
  the ally block for symmetry, whatever the card's own type. `index.html:~3977`, `~4207`.
- Repro: review-b §2.

**N3. Malefic Incantation's Runechant is created after the aura-turn gate is read.** Source:
feed-d §1. CEO-verified on v5.13 (viserai v dash, seed `d11`, first 1).
- Feed: "Runerager Swarm: condition not met (no aura played or created this turn)", then
  Malefic's verse comes off, then "+1 Runechant".
- `auraTurn` is evaluated in the condition loop (`effects.js:~4027`), and
  `ctrClock(n, "atkPlay")` fires Malefic afterwards (`~4617`).
- Runerager Swarm loses its go again; Hit the High Notes loses +2 and Shrill of Skullform
  +3. The next card that turn does see it.
- CR 7.2-style reasoning (a "when you play" trigger resolves above the card) says the
  Runechant exists before the attack resolves. So either fire the play clock before the
  loop, or settle `auraTurn` late like `pumped`.
- Measure which "when you play an attack action card" creators exist (the Runechant pop
  site at v2.23 is the precedent) and drive both orders. Repro: feed-d §1.

**N4. (with [7]) The trainer's defence-reaction doors count `handDefenders` off the wrong
structure.** Source: review-a F2.
- `playRx` and `playRxA` (`index.html:~3438`, `~3492`) pass
  `s.stack.filter(l=>l.k==="def"&&l.gi==null)`. Those are the DUMMY's defenders on the
  PLAYER's attack.
- In the defence window the player's declared hand defenders are `you(s).blockH`, which is
  what the trainer's own wall and judge's wall use.
- Latent today: only the Unity line emits `withHandDefender`, and both Unity records are
  equipment. Fix it while you are in [7].

**N5. (with [7]) `playAtSpeed`'s `handBlockers` forward is load-bearing and undrilled.**
Source: review-a F1.
- Sabotaging `handBlockers: o.handBlockers || 0` to `0` was SILENT on the full suite, yet it
  is the only way the trainer's reaction doors feed reprise (Ironsong Response +3 vs +0).
- Add the both-halves drill.

**N6. `playTargetWhy` treats every `ctrPut` as targeted.** Source: review-b §3.
- Uphold Tradition prints "Put a +1{p} counter on **an** aura you control with ward". That is
  untargeted, and the flip itself turns its Ward 1 on (ruling 2026-10-04).
- But the trainer's `tryPlay` (`index.html:~4050`) asks `playTargetWhy` for powCards too, and
  with no ward aura it refuses ("nothing it can target"). The table allows it, and so does the
  trainer on the opponent's turn: the trainer disagrees with itself.
- Re-Charge! prints the same untargeted shape and escapes only through its `buffNext`.
- Mark `ctrPut` targeted off the printed word "target", and keep the census of
  `playTargetWhy`'s claimants (review-b lists them) both directions.

**N7. Murkmire Grapnel's "can't be prevented" sets `n._unpreventable`, which nothing reads.**
Source: review-b, noted out of scope. Verify it first. If it is real, the damage is
preventable against its printed text (weaker). Drive it against a ward and a one-event shield.

FEED (add to the batch):
- **N8.** "N unspent 'this turn' grants expire". `preventDamage` never decrements `wardTurn`,
  so a fully spent Oasis Respite still counts. `held` sums `buffNext` as a NUMBER, so one +6
  grant prints "6 grants". `effects.js:~10298-10345`. (feed-d §3)
- **N9.** Lyath's boo line `effects.js:~2674`: "The crowd boos you — Reviled, and your Bravo
  cards know it." It is hard-coded second person in a shared feed, and **no pool card prints
  "Bravo"** (CEO grep), so the second half is false. Name the seat with `sv`, and check the
  45-literal ledger moves. (feed-d §4)
- **N10.** Pouncing Paws: "crouching tiger springs into your banished zone". Lowercase card
  name, and a hand-rolled "your" (use `sp`). (feed-d, out-of-scope note)
- **N11.** Wax On: "Wax On answers at instant speed — +3 defence" prints the card's own
  defence as if it were a bonus. Also the noop reason "Pouncing Paws — ability: playable this
  turn — the flag is set when the card is created" joins [12]. (feed-d notes)

DOC:
- **N12.** CLAUDE.md still tells readers to widen `parser.pumpRead` (deleted at v5.02), at
  ~line 7013 ("ADD IT TO BOTH LISTS — `parser.pumpRead` and `fairness.PUMP_OPS`") and ~483
  ("The fallback's existing magnitude test is what suppresses it"). Correct both in the next
  release's CLAUDE.md edit. (review-b §4)

INFORMATIONAL (no action): review-a F3 (the trainer's CR 7.3.2b refusal can't fire, because
its opponent's turn is one link) and F4 (`needEmpty`/`arsFree` coincide while `arsCap` is
always 1). Both are measured and stated; don't build anything for them.

## STATE DEFECTS — v1 item text (numbers referenced above)

1. ~~SHIPPED v5.12~~ **A played attack reaction's go again is the TARGET's, not its controller's** — CEO-verified.
   Stains of the Redback ×3 and Run Through ×3 grant go again to their target AND bank an
   instant's "+1 action point" for the player who played them (`ap 1 -> 2` on play; arakni v
   viserai seed `ar3`, first 1). That is a free action point and steals games. v3.74 fixed
   this for ABILITIES (`_attackRx`); a played AR card falls through to `fx.ga`.
   Sites: `engine/effects.js:~3635` (the ga chain), `~5437` (the AP arithmetic). Census the
   pool's attack reactions that carry `fx.ga`: does any print a go again of its OWN?
   Repro: FINDINGS-feed-a.md §1. Direction: stronger.

2. ~~SHIPPED v5.13~~ **Dash's starting item enters with no counters and no clock** — CEO-verified.
   `build.js:~829` places the item as a bare entry: Hyper Driver has no steam counters (a
   boost yields no {r}), and Boom Grenade has no steam counter and no `sd` stamp, so its
   printed "destroy this unless you remove a steam counter" never runs (3 start sweeps, still
   on the board). Route the placement through the same enters-the-arena body `execute` uses
   (`effects.js:~5315/5330`). Whether crank is offered at game start is a separate RULING:
   record it, don't guess it. Repro: FINDINGS-feed-b.md §3 (C hd.js, D bg.js).
   Direction: Grenade stronger, Driver weaker.

3. **Tokens reach graveyards (a token that leaves the arena ceases to exist)** — CEO-verified.
   End of enigma v lyath (seed s3, first 1): Lyath's graveyard holds 12 Might tokens. Pass
   Over then offers a token as a legal banish target. Ephemeral already has a "ceases to
   exist" path (`parser.isEphemeral`, `gy()`/`toGrave`); a token should share it. Census
   every writer into a graveyard and every reader that counts or picks from one, and consider
   an invariant (a token in a graveyard is an error). Repro: FINDINGS-feed-b.md §7 (H tokg.js).

4. **Mark of the Huntsman's "destroy this and mark them" is paid with a card that's already
   gone** — CEO-verified. Danger Digits' jab makes the dagger hit and its last sentence
   destroys it; the queued pay sheet then carries `destroyUid` for a card in the graveyard.
   Accepting destroys nothing (`gear.find` misses silently at `effects.js:~5948`), the mark
   still lands, and the feed claims "destroyed Mark of the Huntsman". Rule: an unpayable cost
   is inert, never free (v2.04). At minimum, refuse at answer time (the rider must not
   resolve) and lapse the sheet as declined, with a true feed line. Repro:
   FINDINGS-feed-a.md §3 (a3.js). Direction: stronger when accepted.

5. **A late go again is dropped at the table** — CEO-verified. Pulping and Bolt'n' Shot
   ("defended by fewer than 2 non-equipment cards" / "pumped") get `pend.ga = true` in
   `linkPumps`, but `judge.strike` rebuilds `pend` from the pre-pump `link`
   (`judge.js:~2200`), so the point never arrives (1 declared blocker → ap 0, want 1).
   `_struck` is dropped by the same line. Repro: FINDINGS-feed-b.md §1 (A pulp.js).
   Direction: weaker, CR-exact board only.

6. **Run Through's "your NEXT sword attack this turn gets +N{p}" pumps the attack it targets**
   — CEO-verified (rx layer pump 2, `buffQ` empty). That attack is already on the chain, so
   "next" is a later sword attack (Dorinthea's hero hands her one). Read it as a
   sword-qualified `buffQ` grant. Census the attack reactions printing "your next … attack"
   so the v3.11 "a reaction pumps the attack it's played on" rule keeps every card it was
   right for. Repro: FINDINGS-feed-b.md §4 (E rt.js).

7. **A played defense reaction is in the wall but not in the "defended by / with" counts** —
   reader-verified, not re-run here. Reprise ("defended with a card from their hand") and
   defLt2/defLt2any count `blockH`/`blockG` and never `blockRx`, while the wall already adds
   its defence. A resolved defense reaction is a defending card, so it should count, with
   timing as played. Sites: `judge.js:~2275` (`declaredWall`), `strike`'s `handBlockers`
   (`~2034–2129`), and the trainer's equivalents. Repro: FINDINGS-feed-b.md §2 (B rep.js).

8. **Shred is legal with nothing to target** — reader-verified. `rxNoTargetWhy` reads
   `modes`/`selfQ`/`gaQ`, and `fx.defDebuff` is a FOURTH home of a target qualifier, so Shred
   is played and spent with an empty wall or against a non-Assassin attack. This is the v4.88
   lesson again. Repro: FINDINGS-feed-a.md §2.

9. **Look Tuff's "unless you pay {r}" tests floating resources only** — reader-verified.
   "Look Tuff: can't pay 1" prints while the hand holds pitchable cards (pitch-on-demand
   ruling, 2026-08-01). Offer the payment the way the shared pay sheet does, and census the
   other self "unless you pay" clauses. Site: `effects.js:~4423`. Repro: FINDINGS-feed-c.md §1.

10. **+1{p} counters put on an attacking aura after declaration never reach the attack** —
    reader-verified, MEDIUM rules reading. Astral Etchings (instant speed with a Spectral
    Shield) on a Cosmo-armed attacking aura: the counters land and `pend.total` is unchanged.
    `powCtr` is read once at declaration (`effects.js:~4502`). Find a sourced CR quote in the
    repo about an attack-proxy's power following its source before building; if there isn't
    one, record it in `tools/approx.js` as stated and move on. Repro: FINDINGS-feed-b.md §5.

## FEED TEXT — batch into one or two releases

**Items 11–18 SHIPPED** in v5.28 (11–15) and v5.29 (16–18); CEO-checked against v5.44 source on
2026-10-25. **19 and 20 SHIPPED as v5.48 (`9f8f20a`), CEO-verified 2026-10-26** (3709 drills, 0 fail,
5 skipped; CI green; ladder byte-identical to v5.47). The feed batch is closed.

11. Pick result lines print raw state keys: `Swift Shot → deckTop from grave.` (also the
    sheet hint `From your grave → deckTop`). Use `promptZoneWord` and a destination word.
    `prompts.js:~1167`, `~492`. (feed-a §4)
12. Noop reasons leak engine voice into the feed: `off fx.noDrx`, `cost read by the weapon
    reader` (every swing), `activation gate — checked before the ability can be used`. Reword
    them, and widen `test/noopvoice.test.js` to ban dotted `fx.` fields and "reader".
    `parser.js:~3776, ~721, ~3672, ~3146`. (feed-a §7, feed-b §8a)
13. Payment-averts lines: `Kayo paid 1 — the rider resolves.` for Winter's Bite / Cold Snap,
    where the payment PREVENTS the consequence (`ops: []`, `elseOps`). `prompts.js:~1268`.
    (feed-c §2)
14. v5.06 leftover: `Throw Caution to the Wind: 1 of that damage is prevented — the other 2
    goes with this hit.` The unused points are lost with the event. `effects.js:~839`.
    (feed-c §3)
15. False skip line on discard6way cards: `Bare Fangs: no additional-cost discard to feed —
    bonus skips.` while the bonus lands (6 → 8). `effects.js:~4636`. (feed-c §4)
16. Start-phase trigger lines print BEFORE `— X's turn N —`, so they read as the previous end
    phase. Say the header first. `judge.js:~3647` vs `~3612–3640`; check the trainer too.
    (feed-a §5)
17. Waxing Specter's enters-clause condition is evaluated when it ATTACKS as a Cosmo weapon:
    `condition not met (no blue card in Enigma's pitch zone)` on every swing. State is
    unaffected; the line is noise. (feed-b §8b)
18. Equipment "Destroy this:" abilities print the effect, then `The piece shatters — cost
    paid.` The piece is only marked destroyed after `runOps`, so it is live during its own
    effect (latent state). Pay the cost first. `effects.js:~5244`. (feed-a §6)
19. Deploying an ally prints `<ally>: the weapon's attack — its cost is paid when it swings.`
    (CEO, 2026-10-24, from the H4 investigation.) It is `parser.js:721`'s noop reason for
    every `Action - …: Attack` line, and `classifyClause` cannot see the card's type.
    - Measured over the pool, 26 cards carry it: 10 allies, 13 weapons, Bait (a token aura) and
      Teklovossen.
    - It reaches the feed only on an ally DEPLOY, because weapons are equipped, never played, and
      tokens are minted. That is the 10 allies, for example Riggermortis (Gravy Bones v Dorinthea,
      seed 0, turn 5).
    - Fix: one neutral wording true of both, such as `its attack — the cost is paid each time it
      attacks`. No drill pins the string (`grep "weapon's attack" test/` finds only an unrelated
      test title). `noopvoice.test.js` holds the voice.
20. A Compass of Sunken Depths go again does not name the Compass (CEO, 2026-10-25, from the S11
    report). Playing Limpit from the graveyard with the Compass equipped prints "Go again — action
    point kept." with no source.
    - The Shipper read it as an engine defect ("an ally from the graveyard keeps its point"). Measured,
      the engine is right: with the Compass the point is kept (1 -> 1), and without it the point is
      spent (1 -> 0). Repro: `node experiments/S11-limpit-compass.js <tree>`.
    - A line that leaves out its source reads as a bug even to us, so name the grant's source, as
      `heroAbilityName` does for hero triggers (v5.08): "Compass of Sunken Depths: the first
      watery-grave card from the graveyard this turn goes again."

21. **Grant lines lowercase printed class names and hide the rider** (CEO, 2026-10-26, reading v5.49
    self-play feeds). `parser.qualLabel` joins `qual.g` as stored, so the feed prints "Next draconic or
    ninja attack action card +3." (Rise from the Ashes), "Next runeblade attack", "Next pirate ally
    attack", "Next lightning or elemental attack". The cards print the class capitalised ("Draconic or
    Ninja"); subtypes such as arrow and dagger are lowercase in rules text too, so capitalise only
    the CLASS and TALENT words (`ACTION_CLASSES` and the talent list are the vocabulary).
    - `effects.riderWords` falls back to ", and a granted ability" for any rider it cannot name, so
      Yo Ho Ho! and the Loot cards print "Next pirate ally attack, and a granted ability." Name the
      quoted rider's own words, or say what it does ("…, and its hit makes a Gold token").
    - "Next attack if it is blue +N." (Flying High) reads backwards; "Next blue attack +N" or
      "Next attack +N if it is blue".
    - Voice only. `effects.js:1658` is the line, `parser.js:4086` the label.

## RECORD, DON'T BUILD

19. Compass of Sunken Depths "looks at" the top card and the shared table feed NAMES it to
    both seats. This is a hidden-information leak at the table, by recorded design
    (`parser.js:~3113`). Record it in `tools/approx.js` (table board) with a probe. A per-seat
    feed is a UI decision. (feed-c §5)

## REJECTED

- feed-b §6, Uphold Tradition activated with no aura: its line is "Put a +1{p} counter on an
  aura you control with ward" — NOT targeted — and the flip itself turns its Ward 1 on. The
  activation is legal and not a paid no-op.

## R1 — THE MARK RULING (user, 2026-10-14)

> "Marks wear off when the hero is hit by an opponent's attack or an effect but otherwise
> sticks around — I'd say even if a hero transforms the mark will stay on!"

Record it verbatim, with the date, wherever rulings are recorded (`tools/rulings.json`, and
`tools/approx.js` if a stated record is affected). Nothing clears `marked` today; `sides.js`
is the only place it is ever `false`. Build it this way:

- **Cleared by a HIT from an opponent's attack.** CR 7.5.5: damage actually dealt. A swing
  blocked to nothing or fully prevented is not a hit and does not clear. A hit on an ally does
  not clear the hero's mark.
- **The hit fiction counts.** Danger Digits' "the dagger has hit" is a hit by definition.
- **Order inside the hit.** Snapshot marked-ness AT the hit, then clear it, then resolve the
  on-hit triggers.
  - "When this hits a MARKED hero" (Mark of the Black Widow, Mark of the Funnel Web) must
    still fire off the snapshot.
  - "When this hits a hero, mark them" (Mark the Prey, Scar Tissue, Two Sides, Hot on Their
    Heels, Mark of the Huntsman) re-marks AFTER the clear, so the hero ends that hit marked.
  - Drill both: a two-case drill can't tell clear-then-trigger from trigger-then-clear.
- **Persists through transformation.** Arakni becoming an Agent, and returning to the brood,
  changes nothing about anyone's mark. Pin it with a drill.
- **"Or an effect" — ANSWERED (user, 2026-10-14): "the effect would specifically need to
  remove a mark."** Non-attack damage (arcane, a Runechant) does NOT clear a mark. Only an
  effect whose text says to remove the mark does, and over the pinned pool NO card prints one,
  so there is nothing to build for that half. Record both quotes verbatim. Pin the premise as a
  drill: a census proving no pool record removes a mark, so the day one arrives it is a
  decision rather than a silent no-op. No `stated` record is needed.
- **Measure the ladder on both sides.** Arakni's whole deck reads marks (Agents,
  Black Widow, Funnel Web, Stains' discount, Graphene Chelicera), so expect her to move.
  Report it, and don't retune the policy inside the rules fix.

## NEEDS A RULING FROM THE USER (do not build)

- **ANSWERED 2026-10-31 and SHIPPED as v5.55:** *"Yes, an attack counts its own chain link."*
  **R5 (asked 2026-10-31, CEO). Does an attack count ITS OWN chain link?** Fai's "If you control 2
  or more Draconic chain links" cards (Cinderskin Devotion, Display Loyalty, Hot on Their Heels,
  Phoenix Flame, Enflame's rungs, Searing Emberblade's static) are read at declaration against
  `parser.dracLinks(chain)`, and the asking attack is not on the strip yet (`linkPayload` pushes
  it). So the SECOND Draconic attack in a row does not get go again; the THIRD does. Driven
  (`effects.execute`, Cinderskin/Display Loyalty/Enflame, 0/1/2 prior Draconic links): `ga` false,
  false, true. Against it: the user's ruling of 2026-07-25 ("the first attack each turn is chain
  link 1"), and the engine's own Rupture reader (`chainLinkGe`), which counts `chain.length + 1`.
  If the attack counts itself, the fix is one reader (`dracLinks` plus a Draconic `pend`) and every
  `dracN` gate, Fai's discount and Mounting Anger's bound move with it; Fai gets markedly stronger,
  so it ships with a ladder at 3+ seeds. No CR quote in the repo; do not build until ruled.
- **Latent, synthetic only (CEO, 2026-10-31):** a quoted rider whose payload is "gain 1{h}" is
  RELOCATED: `"…this gets go again and \"When this attacks, gain 1{h}.\""` parses as `{drac2, life 1}`
  with the go again lost and no `quotedUnread` flag (a loose life matcher claims the sentence ahead
  of the "gets go again and" branch). No pool card prints it; `npm run unanchored` only walks the
  pool. Record, don't build.

- **ANSWERED 2026-10-31, see R2-R4.** **Where does a card played from the banished zone go after it resolves?** The graveyard, or
  back to banish? Blaze's ability, Pouncing Paws' Crouching Tiger, Mounting Anger and Rising
  Resentment grant "you may play it this turn" from banish, and none prints a destination. The
  engine files it back into banish (`effects.js:~5433`, `fileAttack`), and the repo has no CR quote
  either way. S9 closes the replay loop without deciding this. Asked 2026-10-25.

- ~~**May the AI pilot a hero?**~~ **RULED 2026-10-18, see v4 at the top.** Original note: (Stage §8.3.) RULING 2026-08-16 says a seat the dummy fills is
  always the vanilla pile (CLAUDE.md:12059). The Stage design's vs-AI tiers, its L9 lesson
  and AI-vs-AI exhibitions need a hero-piloting AI. Asked 2026-10-17.
- **ANSWERED 2026-10-31, see R2-R4.** **Unity and a defence reaction from hand.** Unity prints "When this defends together with
  a card from hand". `handDefenders` counts declared hand cards (`blockH`) only, so a defence
  reaction played from hand later does not lift it (44 times at 3 seeds). Timing says that is
  right; v5.21's rule (every count of a wall sees a played reaction) points the other way.
- **ANSWERED 2026-10-31, see R2-R4.** **Is the soul hidden?** Not sourced in the repo. If it is, "`X charges <card> into X's
  hero's soul`" (`effects.js:1099`, 127 lines), "`<card> goes from the hand to the soul`"
  (`prompts.js:1218`) and Banneret's pay-off line (`effects.js:1647`) name hidden cards too.

- ~~**Mark never expires.**~~ **RULED 2026-10-14, see R1.** Original note: Nothing clears `marked` once it is set (`sides.js:171` is the only
  `false`), so Arakni's Agents and Black Widow / Funnel Web riders keep reading it for the
  rest of the game. The repo has no sourced rule for when a mark ends. Ask the user.

## SUPERSEDED HANDOFF (CEO session_013xG9xBJwLD8vUGmMy4KUA1, 2026-11-21, at v6.47)

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

## (superseded 2026-11-21 by the v6.54 handoff) HANDOFF (CEO session_013xG9xCkP4yVbvz1X7saGFP, 2026-11-21, at v6.52)

**State:** live = **v6.52** on `main`, livecheck ALL PASS. Function `table` version 56 = `v6.52 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/serene-hopper-di9us5` == main.

**Done this thread (v6.50–v6.52) — the UX roadmap is FINISHED (steps 1–9):**
- **v6.50 sound** (`Sfx`: hit thud / block clank / prevention hiss, synthesized with Web Audio, no files; `LinkSfx` beside `LinkStamp` on
  both boards; ♪ mute on the nav row, `dawnblade.sound`). **Type scale** `--fs-*` (166 sizes named), no inline fontSize left.
- **v6.50 rules: watery grave counted only blue ATTACKS** (`hist.blueGY` bumped in `fileAttack` alone). `playZoneWhy` now also reads the
  graveyard's `_gy` stamps. **AI `gravePlays` (SPXGRAVE)**: Gravy 61 -> 79 of 288 own-seat games.
- **v6.51 motion**: `Glide` + `FeatCard` fly the committed card from its rail tile to the featured slot (FLIP, 240 ms, 17 ms frames at 4x
  throttle, off under reduced motion). The trainer's coach now names graveyard plays.
- **v6.52 Lyath boos while defending** (`judge.defActGainNow`, `rxBoo`, SPXBOO): 117 -> 140 of 384 own-seat; ladder Lyath 30 -> 35.

**The census that found both AI wins** (`npm run play '' '' 6`, 1632 games, ~3 min, before v6.50): wins of 32 a seed — Briar 28.3, Kayo 25.3,
Dorinthea 24.5 ... Blaze 10.5, Lyath 9.2, Boltyn 8.2, Viserai BW 7.5, Gravy 7.2. **The method that worked twice:** for a bottom hero, count
what the AI NEVER does that `legal` offers (probe: tally actions by kind and zone over 16 games; then ask `legal` at each decision for the
missing kind). Gravy: zero graveyard plays. Lyath: hero ability legal ~every turn, used only on his own turn where half of it is dead.
Ruled out (don't chase): Lyath's wall (halving is applied at build), end-turn "holds" of resource gear (deliberate), Boltyn's charging
(long measured history in QUEUE-ARCHIVE, v5.68 H24).

**NEXT, in order:**
1. **Same method on Blaze (ladder 32), Viserai BW (20), Boltyn (27), Gravy (24)**: Blaze's hero ability is legal in 149 of 201 turns and used
   in 41 (an instant that makes a Wizard non-attack an instant — when does that pay?). Gravy's own ability (destroy a Gold: draw, discard)
   legal 31 turns, used 16. Gravy still bottom-3: Mage Master Boots held 16 times as "land nothing".
2. **Phase 4 (Outbreak, 2027-02)**: when the lists publish, ROADMAP-NEWDECKS.md.
3. The UX roadmap is done; next UI work would be POLISH.md's bar or a phone pass on the real device (DESKTOP-TASKS.md).
4. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
**sound defaults ON** (a ♪ toggle mutes it; iOS's ringer switch also silences Web Audio).

**Cheap habits:** `npm run quick` inner loop (~2.5 min). The full `npm test` is ~10 min: run it ONCE at the end, and read failures with
`node --test "test/*.test.js" 2>/dev/null | grep "^not ok"`. A gated A/B on one hero: `SPXFOO=none npm run play hero '' 12` vs on, AND the
other chair (`'' hero 12`) — four runs in parallel take ~3 min. Source-order pins exist for the policy (allyseat now anchors on
`tag("heroAbility", ...)`); keycensus pins the judge-only parser readers. page.js deps: `npm install --prefix <scratch>/deps ...` (its
header); a board drive needs the coin screen: click `.rseatpick button` 0 before `.lo .actbar [data-start=...]`. After pushing main, curl the
page until it serves the new APP_VER, THEN `livecheck.js`.

---

## Superseded handoff (CEO session_013xG9xAAQbamsKsHUf7TJLq, 2026-11-21, at v6.54)

**State:** live = **v6.54** on `main`, livecheck ALL PASS. Function `table` version 60 = `v6.54 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/upbeat-darwin-ofj5u7` == main.

**Done this thread — two AI leaks, both "a paid/free optional pick the AI declined":**
- **v6.53 Blaze spends his energy** (`judge.ctrPickTakers`, SPXENERGY): the ability was activated 93x/32 games and the banish sheet
  declined every time (~10 energy unspent per game). Own seat 113 -> 136 of 384; ladder Blaze 32 -> 40.
- **v6.54 Prism takes her figment** (`judge.freePick` class "put", SPXPUT): the Herald search (deck -> arena) was declined 157x/272
  games. Own seat **170 -> 307 of 384**, all 24 seeds up; ladder Prism 38 -> 81 (2nd behind Briar 85).

**The new method (cheaper than the never-does census):** `experiments/energy/decline.js` — one seed of every pairing (272 games, ~2 min),
tallies every optional pick the AI answered with `declineOptional`, by hero and source. `experiments/energy/blaze-census.js` is the
per-hero ability census (NB `J.legal` returns the REFUSAL, null = legal — the first version of the probe read it inverted).

**NEXT, in order:**
1. **The rest of the decline census** (each its own gate + A/B, 12 seeds both chairs): Arakni's dagger retrieves, Pick Up the Point 45 +
   Up Sticks and Run 31 (grave -> gear, priced {r} by the retrieve keyword; a dagger back for 1 is probably right when a slot is free);
   Golden Tipple 51 (discard a yellow: draw + Gold — card-neutral plus a Gold, likely right); then the real tradeoffs: Corrupted Crown 32
   (hand banish for +1{d}), Condemn to Slaughter 18, Embrace Ursur 6, Mounting Anger 6.
2. **Opponents attack Suraya** (Ward 4 ally) instead of Prism — seen in prism-kayo-3 (7 and 5 power swung at her). Maybe right (she
   attacks back), maybe a foe-policy leak now that she shows up every game; count it before touching it.
3. Blaze still ends ~5 energy up: the ability is never used on the opponent's turn (219 legal windows, 0 uses). Unmeasured.
4. Viserai BW (bottom, 6.0/seed), Gravy (8.0), Boltyn (8.0): the never-does census, as in the v6.52 handoff (Gravy's own ability legal
   31 turns used 16; Mage Master Boots held as "land nothing").
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON. **New: Prism is now the 2nd-strongest AI** (her deck finally does its thing) — fine for a sparring partner? Default: yes.

**Cheap habits:** `npm run quick` inner loop (~2.5 min). The full `npm test` is ~10 min: run it ONCE at the end. A gated A/B on one hero:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND the other chair (`'' hero 12`) — four in parallel take ~5 min. Don't edit
engine files while a background suite runs (it reads them). page.js deps: `npm install --prefix <scratch>/deps ...`. After pushing main,
curl the page until it serves the new APP_VER, THEN `livecheck.js`.

---

## Superseded handoff (archived 2026-11-25 by CEO session_013xG9x8sybtytAYZSGDYiE1)

## HANDOFF — START HERE (CEO session_013xG9x8sybtytAYZSGDYiE1 took over 2026-11-24 late, at v6.93; previous CEO session_013xG9xBhp1ZDNBkoYpUuM35)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**State:** live = **v6.97** on `main`. Function `table` v146 = `v6.97 · sage-v19`, stamped; **livecheck ALL PASS**. SQL **001..012** on the
project (012 `ladder_get` + `mine`, run 2026-11-25). WIRE_V 49, DATA_VER sage-v19, 17 heroes. Gates at v6.96: npm test 4608/4603/0/5,
page.js 219/219, serverpage 437/0. Weekly sweep workflow (`tapsweep-weekly.yml`) first run (by hand, 2026-11-25) SUCCESS in 20 min.
**WORKERS OUT (Sonnet):** (W server-screen contrast DONE -> v6.97) · X `session_013xG9xAY7oyHzHXwYybp97V`
the found-match window: countdown, *Not now*, expiry, the other side re-seeks (TASK-X; may need SQL 013). Next letter: **Y**.

**CEO session_013xG9x8 (v6.94-v6.96, workers S T U V):** v6.94 (U) WCAG AA contrast measure `tools/contrast.js` in the tap sweep,
fixed in tokens (`--r` darker, new text inks `--rt`/`--bt`, `--fs-xs` 10px) · v6.95 (S) trainer drill door `?drill=1` ->
`window.__battle`, `promptsweep --trainer` 612/612, weekly CI · v6.96 (T+V) found-match chime + hidden-tab title flash; *Your last
ranked games* on the Ladder (SQL 012) · v6.97 (W) contrast rows on the server screens; `--rt` -> #F5817B. Merging tip: S/U/V each repin slicecensus's phasebar slice — they ADD (95030 +288 +472).

**Previous CEO (seven releases, workers O P Q R; briefs experiments/WORKER-PROMPT-UI.txt + experiments/ui/TASK-*.txt):**
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

## Superseded handoff (CEO session_013xG9x8sybtytAYZSGDYiE1, at v6.98; archived 2026-11-25 by session_013xG9xAFGZ4AhbF5jwTxmNc)

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
