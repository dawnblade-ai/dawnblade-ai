# SERVER S5.1 — running log (branch `claude/relaxed-fermi-erc3gs`, on v6.31) — ranked tables: results and ratings. OFFLINE ONLY: nothing pushed, deployed or run on the project.

Scope: S5.1 only. The forfeit clock and the leaderboard screen are LATER releases. SQL 001-005 are run on the live project and untouched; new SQL is `006_ratings.sql`.

## Who goes first (checked, nothing built)
A server table ALREADY decides it the way the user ruled for ranked: the table's lobby (engine/lobby.js, run by the hub inside the referee) is the two-phone path's
rock-paper-scissors — each seat SEALS its throw (SHA-256 commitment), a throw is opened only once BOTH are sealed (an open before both seals is refused), ties replay, and
the WINNER CHOOSES who goes first (`rpsSeat`). It runs through the referee as ordinary lobby frames, so no throw leaks before both are in (lobby.js MSG.OPEN refuses it).
So ranked tables need no change: casual and ranked tables use the same method. (The match seed is also two-sided: the judge's half stays hidden until the game is over.)

## Step 1 — the referee (server/referee.js)
- Row v4 = a ranked table (`ranked:true`, `ratings:[r0,r1]` as each player SAT DOWN, later `result`); written only by a ranked create, so a v6.31 function refuses it as `wire` (a rollback can never turn a ranked table into a casual one that records nothing). Reads 2, 3, 4.
- `{op:"create", identity, ranked:true}`: refusals `ranked-signin` (no identity), `ranked-name` (nameless creator), `unavailable` (no `record`/`rating` dep), `identity`, `bad-request` (ranked that is not true), plus the old `table-cap`/`exists`. Casual create is untouched.
- Join at a ranked table, unkeyed: `ranked-signin` (no identity), `ranked-name` (player has no chosen name); a keyed join (a phone that holds its chair) is not asked again; a player who already holds a chair takes THAT chair over (never both) so two chairs = two different players. Answers carry `ranked`, `ratings`, and once recorded `result`.
- THE RESULT: after the move that ends a ranked game is SAVED (row marked `over`), before the other seat is pushed, the function reads winner/how/turns/heroes from ITS OWN hub's game state, calls `deps.record(...)`, stores the public summary in the row (`result`) and answers it to the caller. Order: save the move, then record (not record, then save), so a lost version race can never leave a recorded result for a move that did not commit.
- A failed record never undoes the game: it is logged and the NEXT request of any kind on that table (or `close`) finds a ranked game that is over without a `result` and records it (idempotent). A `close` refuses `internal` rather than closing over an unrecordable result.
- Concede: the reducer's `concede` action exists on the server table (the board's Concede button) -> `how:"concession"`, the conceding seat loses. Other endings: `life`, `stalemate` (the engine's dead-position draw = a draw). There is no leave/abandon op: a phone that walks away just stops (the forfeit clock, a later release, is the answer).
- A ranked table closed by its creator MID-GAME records NOTHING in this release (the gap the forfeit clock closes; it also lets a creator dodge a loss by closing — recorded as a known gap). A decided game's table is never closed (its row is already `over`), so close cannot erase a result.
- `me` also answers `rating, games, wins, losses, draws` when `deps.rating` is wired (`meCore` is S4.2's `me`, unchanged, so its sabotage anchors held).
- The arithmetic is in SQL only; the referee imports no rating rule (ledger drill).

## Step 2 — 006_ratings.sql (NOT RUN on the project)
- `ratings(player_id pk -> players on delete cascade, rating, games, wins, losses, draws, check games = w+l+d)`, `results(game_id pk, table_id, player_0/1, names, heroes, winner null=draw, how in life|concession|stalemate, turns, build, rating before/after both, started_at, ended_at, recorded_at; check winner null iff stalemate; check player_0<>player_1)`. RLS forced, no policy, anon/authenticated revoked, service_role only.
- Constants in ONE place: `rating_start() = 1200`, `rating_k() = 32`. `rating_get(player)`, `result_record(...) -> jsonb {recorded, ratings:[{from,to},{from,to}]}`.
- Elo IN SQL (chosen over the referee): the transaction is the only place that can read both ratings after holding both locks and write both new ones atomically; the function would need a read-modify-write across HTTP calls. result_record takes one `pg_advisory_xact_lock` per player, LOWER ID FIRST (no deadlock when two games share a player), reads the ratings only after both locks are held, writes ratings + result in one transaction; duplicate = the stored answer, `recorded:false`, nothing moves. The result key `game_id` is the table code + the moment the table was made (a code drawn again after the 48 h sweep is a new game; plain table id would silently drop that game's result).
- `results` has no FK to players (history outlives a player row); `ratings` cascades with the player.
- PGlite (`PGLITE_DIR=<scratch> node tools/sql-pglite.js`, default list 001..006): 006 twice -> `ok`; anon refused on both tables and every function. The Elo arithmetic is fed `test/fixtures/elo-vectors.json` (11 cases: 1200v1200 win both ways and draw, 1300v1200 win/loss/draw, 1000v1500, ...) — the same table the drills hold the fake backend to.
- Sabotage (20, each caught; scratch `sqlsab6.js`): no locks / only one player's lock (self-check counts both), no idempotency, K 16, draw scores 0, expected sign flipped, truncated not rounded, scale 800 (only the vectors see it), loser's rating from the winner's side, wins/losses swapped, draws not counted, anon may record, results RLS not forced, anon may read ratings, no `how` check, same player twice, a winner in a stalemate, start time dropped, unrated player reads 0, rating row made for an unknown player.
- REAL Postgres 16 (`tools/sql-race.sh start|rate|ratenolock`, 0.4 s pause after the duplicate check): ONE PLAYER, TWO GAMES AT ONCE (X beats Y and X beats Z): with the locks X = 1231, games 2, wins 2 (the second applied on the first's rating); with both lock lines deleted X = 1216 (a lost update). TEN COPIES OF ONE GAME at once: recorded=1, one results row, ratings moved once (the primary key is the second backstop; the other nine fail with a duplicate key).
  (A first attempt put the rating rows in after the race and the no-lock variant looked fine: a first INSERT ... ON CONFLICT makes the second caller wait for the whole transaction. The script pre-creates the rating rows; that masking is worth knowing.)

## Step 3 — entry template, stub, fakes
`mkRating`/`mkRecord` (rating_get table-return, result_record jsonb-return) wired as `deps.rating`/`deps.record` (UNVERIFIED over PostgREST until 006 is run). `tools/supabase-stub.js`: rating_get + result_record stand-ins (once per game id, Elo K 32). `test/helpers/serverfakes.js` `withRatings` (the fake backend; knobs `noIdempotent`, `k`, `failing`); `serverhub.js` gained `ranked` + `rankDeps`.

## Step 4 — drills (test/serverranked.test.js, 21 tests; test/serverrankedphone.test.js, 8)
Requirements and refusals; exactly one result with exact Elo (1200 v 1200 win both ways, 1300 v 1200 both ways, 1300 v 1200 draw 1296/1204, 1200 v 1200 draw, a whole game to its end); never twice (replayed ending frame, resyncs, takeovers, keyed return, second concede, a row that lost its result healed with the STORED change, a failed record healed later, close refused while unrecordable); forgery (forged intent fields, a forged seat, requests of every op carrying a winner/result/rating, new ops); close (mid-game records nothing; after a decided game changes nothing); privacy (ids/tokens in no answer/broadcast/frame/summary; every answer key on a public list; the result summary has exactly its public fields; broadcast envelopes unchanged); `me`; ledger (no Elo, no SQL in referee.js; constants stated once in SQL). Each has a sabotage that fails it.
Existing drills touched: `serverid.test.js` row-version drill (v5 is now the refused one; v4 is read) — nothing else.

## Step 5 — the phone (engine/servertable.js)
`o.ranked` on a create (a small transport wrapper adds `ranked:true`, so the casual create line and its sabotage anchors are untouched; NO casual fallback for ranked); words `ranked-signin`, `ranked-name`, `identity`, `unavailable`; `rank()` -> {ranked, ratings, result}, `onRank`, `result(tries, gapMs)` (the other seat asks; a casual table answers null and asks nothing); `whoAmI`/`setName` carry rating + record.

## Step 6 — Deno rehearsal (single + folder): ALL PASS, 12 ranked rows each (me 1200; refusals; v4 row; lobby ratings; forged request refused; a conceded game recorded once and both phones read 1200 -> 1216 / 1184; resyncs/takeover record nothing; close erases nothing; no token/subject/player id anywhere; stub saw no malformed call).

## Step 7 — the page, livecheck, release prep (v6.32; nothing pushed or deployed)
- Page: a Friendly/Ranked switch (default Friendly), "Open a ranked table", Ranked chip + ratings in the lobby line, ratings beside names on the board and "ranked" on the pane flag, rating and record on the chooser and name sheet, "Your rating rose from 1300 → 1312 (+12)" on the end screen (RankChange), refusal sentences (ranked-name, ranked-signin, identity), refusals scrolled into view. `tools/serverpage.js`: 195 passed, 0 failed (3 ranked phases). Page sabotage (rating dropped from the board, end-screen change removed) -> 7 FAILs, restored. The existing `me`-count assertion now counts saves (a name field); reads are new.
- livecheck (f): lightest ranked check with the phones' own sign-ins (me rating 1200; nameless ranked create refused; named ranked create accepted; anonymous join refused; host join says ranked; close). WRITTEN BUT UNRUN on live.
- APP_VER 6.32, WIRE_V 40 and DATA_VER unchanged (no wire payload, prompt or game key changed). slicecensus stylesheet repin 71,449 -> 72,329 with a note. npm test: 4286 tests, 4280+ pass; the one failure was that repin (fixed, rerun 6/6); skipped 5. scenes 107/0; fairness exit 0. Both babel blocks compile.

---

# SERVER S5.2 — running log (same branch, on v6.32) — ranked integrity: the forfeit clock. OFFLINE ONLY: nothing pushed, deployed or run on the project.

Scope: the three gaps S5.1 recorded. SQL 001-006 are run on the live project and untouched; new SQL is `007_forfeit.sql`.

## What "started" means (Gap 1)
STARTED = the match has been DEALT: the stored row holds the spec (`row.hub.spec`), which only happens when both players are seated and the who-goes-first lobby (heroes, throws,
seat choice, sideboards, seed) is finished, and the game is not over. It is read from the row, never from a phone. `close` by the creator:
- ranked, started, undecided, creator holds a chair: the function CONCEDES for the creator's seat through the hub's own seat and the reducer's `concede` (exactly the board's Concede
  button: `how:"concession"`, the closer the loser), saves, records. The table is NOT closed over it: it is over with a result, so the other phone reads the ending (a push and `result`),
  a decided game is never erased, and closing again is `{ok:true}` and writes nothing. The answer is `{ok:true, conceded:true, result}`.
- ranked, not started (lobby, or empty): free, `closed`, records nothing (as before); a creator who holds no chair (never sat) also closes free;
- a decided, unrecorded game: recorded first (S5.1), unchanged; casual tables: byte for byte unchanged (the casual close line and its sabotage anchors were left untouched).
The page says it BEFORE the confirm: the cap list's Close now asks first ("Closing now counts as a loss if table X is a ranked table with a game under way: it ends the game for both of
you, your opponent takes the win, and your rating moves. A ranked table that has not started yet, and any friendly table, closes without a trace.") with "Yes, close it" / "Keep it".
There is no other close button in the page (the board has Concede); the page cannot tell which listed table is ranked or started (codes only), so the sentence is conditional.

## The clock (Gap 2)
- THE ONE LIMIT: `FORFEIT_MS = 5 * 60 * 1000` in `server/referee.js`, once (a drill counts the literal). `deps.forfeitMs` replaces it (the drills' injected clock). The page and the phone's
  channel never restate it: the function tells each phone `limit` with the clock. A placeholder the user may rule on.
- THE STAMP lives in the row: `row.clock = {on: seat, since: server ms}` (ranked rows only; `deps.now` is `Date.now()` in the real function). It is rewritten after every saved frame by
  `stampClock`: the wait restarts (`since = now`) when the waited-on seat moves ("any accepted move by that player restarts it") or when the wait changes seat; a move by the OTHER seat
  (declaring defenders) leaves it running; reads (resync, join), refused and stale frames write nothing and cannot move it.
- WHO IS WAITED ON: `judge.waitingOn(fullGame)` (engine/judge.js, new, READ-ONLY, ~10 lines; exported; no rule changed): a pending cost or question (`pending.seat`), else a live sheet
  (`prompt.side`), else the end-phase arsenal choice (`arsenalFor`), else the priority holder (`priority.holder`). NOT guessed from whose turn it is: the drill plays a whole game and
  asserts that at every step the seat it names is the seat that then acts (declaring defenders excepted), and that a turn-based guess fails the same drill. Before the deal, the
  who-goes-first lobby: `lobby.waitingOn`, and only once BOTH heroes are chosen; a seat is waited on when it alone owes the step (seal or open of a throw, the seat choice, the
  sideboard, the seed answer).
- NO CLOCK runs when: the game is over; priority is null with no pending question, sheet or arsenal choice (the engine walks on by itself: start/end phases, the close step); the lobby is
  still choosing heroes (a table where somebody sat down and never picked is not a game: it ages out); both seats owe the lobby step (both unsealed, both unopened, both without a
  sideboard) - a wait on both is a wait on neither. (In the defend step the engine waits on the turn-player, who holds priority (CR 7.3.3), while the defender declares; the clock is on the
  priority holder. If the attacker's phone is present it passes at once; see the questions below.)
- THE CLAIM: `{op:"claim", table, seat, key}` (the claimant's own seat key, as a frame). The function re-reads its own row and rehydrates the hub, and checks IN THIS ORDER:
  key (`auth`, and `bad-request`/`no-table`/`wire` as for any op), ranked (`claim-casual`: "Only ranked tables have a forfeit clock."), not over/decided (`claim-over`: "That game has already
  finished."), a clock is running (`claim-idle`: "The game is not waiting on them any more."), the claimant is not the waited-on seat (`claim-self`: "The game is waiting on you, so
  there is nothing to claim."), the stamp is older than the limit by the SERVER's clock (`claim-early` + `left` ms: "Not quite yet - they still have a little time."), and the hub's own
  `waitingOn` STILL names the stamped seat (else `claim-idle`: the stamp is old news). Each refusal writes nothing, pushes nothing, records nothing (drilled by byte-comparing the row,
  its version, the pushes and the rating backend). A due claim makes the absent seat concede through the reducer (the other phone is pushed the ending like any move), marks the row
  `over` + `forfeit:{loser}`, saves under the version check and records `how:"forfeit"`, winner = the claimant. Answer `{ok:true, claimed:true, frames, result}`.
- A claim before the match was dealt (the lobby clock) has no game to end: the row is marked over with the forfeit, nothing is dealt, the result is recorded with the lobby's heroes and 0
  turns; a late lobby frame from the absent player then changes nothing (it reads the ending).
- THE RACE with the absent player's late move: both read the row at version v and both write with `put(row, v)`; the store's compare-and-set lets exactly one through; the loser is
  `conflict` (retry:true) and, asked again, meets the truth: a claim after the move wins meets `claim-early`/`claim-idle`; a move after the claim wins meets "the game is over". Drilled both
  orders with a lagged store (both requests read before either writes); the sabotage (a store that ignores the version) lets both win and is seen. No new SQL is involved: the version check
  is `table_put` of 001, already proven on real Postgres in S4.4's race script. (A claim and a move are the same kind of write; `sql-race.sh` was NOT re-run for 007 because 007 adds no race claim.)
- WHAT THE PHONES SEE: the clock rides to each seat as a SEALED frame of its own (`{ch:"clock", m:{on, age, limit}}`, inside the push's seal, so a listener on the public channel cannot
  forge it; a phone that does not know the channel skips it) and as `clock:{on, age, limit}` in every join/resync answer of a ranked table. `age` is the server's count; the phone adds only
  the time elapsed on its own clock since it heard (`channel.clock().left`). The waited-on phone shows a calm countdown only in the last two minutes; the waiting phone is told after a
  minute of waiting how long until it may claim, and gets "Claim the win" only when the countdown is out. NOTHING that reveals what is being decided: only that the game waits on a seat,
  which both seats' views already show (`pending`, `priority` and a sheet's `side` are public; the sheet's cards are not and are not sent).
- AGES OUT: a ranked game that neither player finishes nor claims is not recorded by anything: the row is forgotten 48 hours after its last write (`table_put`/`table_create_capped`
  sweep), and until then it counts as an open table for its creator (cap). A drill asserts a quiet ranked table never calls `record` from reads. (Also: a creator who closes it is a loss.)

## Gap 3 - recovery and ratings (007_forfeit.sql)
RULE CHOSEN: a throwaway player with a RANKED FOOTPRINT (a rated game, a `results` row naming it, or a seat at an unfinished ranked table) is KEPT, ORPHANED BUT INTACT after the redeem:
row, rating, record and results stay; its display name is freed; its unused recovery codes are deleted; no sign-in points at it. The recovered player's rating and record are never
written. A throwaway with no footprint is deleted exactly as in v6.30. The redeem itself is never refused for this.
WHY NOT the alternatives: DELETE (v6.32) loses real rating history and, worse, makes an unfinished ranked game unrecordable (`result_record` needs both players to exist), so leaving a
lost game by recovering away would dodge it. MERGE would let one player's record flow into another's. REFUSE strands the rightful owner of a lost phone for good once the new phone
played a single ranked game, with no in-app way to "choose". Orphan-intact changes nobody's rating, leaves the opponent's result standing and the game recordable; the price is a dormant row.
A player can already make a fresh anonymous player at will (no sybil defence exists), so keeping the orphan hands out nothing new. 007 REPLACES `recovery_redeem` (004) with a body identical
except for the delete branch; 004's self-check expectations (a throwaway without a footprint is deleted, its name freed) still hold and 007's self-check re-asserts them.
CAUTION: re-running 004 or 006 after 007 puts the old bodies back: run 007 again.
007 also widens `results.how` to include 'forfeit' (constraint re-added) and REPLACES `result_record` with 006's body whose only change is that list; a forfeit still names a winner.
PGlite: 001..007 each twice -> `ok` (`dawnblade_forfeit`); 14 sabotages (`tools/sql-sab-007.js`) each caught: table constraint not widened, function still refuses forfeit, a forfeit with no
winner accepted, no idempotency, a player lock lost, every throwaway deleted, the unfinished-table footprint ignored, a finished table counted as a footprint, ratings/results ignored,
the orphan keeps its name, keeps its codes, is merged into the recovered player, a footprint refuses the redeem instead, anon may redeem. anon refused on everything as before.

## Wire, rows, versions
- `WIRE_V` is UNCHANGED (40): no game state, snapshot, prompt or game key changed; the clock is transport (a new push frame channel, a new answer key) and the claim is a new request op.
  An old page ignores the unknown frame channel (its `ingest` skips what it does not know) - and a page of another build is refused at the handshake anyway.
- Ranked rows are now v5 (clock, forfeit); v4 ranked rows (made by v6.32) are still READ and get a clock at their next saved move; a v6.32 function refuses v5 as `wire` (rollback cannot play a
  ranked game without its clock). Casual rows: untouched (v2/v3), no clock key, no forfeit key, no clock frame (drilled).
- `DATA_VER` unchanged.

## Drills and proof (offline)
test/serverforfeit.test.js (24): reader honest through a whole game + a turn-guess fails; the stamp (restart on own move, not on the other's, not on reads) including through a whole game; every
refusal changes nothing; a due claim records ONE forfeit with the exact Elo move, both phones read it, repeats and a late move change nothing; the lobby claim; the race both orders; close
(concession, free before start, casual unchanged); privacy (ids, tokens, keys in every new answer/push/summary; every answer key public; the clock frame sealed, casual has none); the limit
in one place; ageing out; the recovery rule through the function's ops on the fakes. test/serverforfeitphone.test.js (6): the phone's countdown (server age + its own elapsed time), claimWin,
closeTable. Each has a sabotage that fails it (confirmed). Existing drills adapted: serverranked (row v5; (6) is now "close is a concession"), serverrankedphone (v5), serverid (row versions),
the shared fakes accept the forfeit ending.

## Final numbers (offline; nothing pushed, deployed or run on live)
- `npm test`: 4316 tests, 4311 pass, 0 fail, 5 skipped (the live-wire drills). Two drills of older releases were adapted on the way (servernames anchors follow `pub(row, deps)`; the stylesheet slice repinned 72,329 -> 73,060 for `.ffbar`, with a note). `CR-INDEX.md` regenerated by the run and reverted, not committed.
- `npm run scenes`: 107 passing, 0 failing. `npm run fairness`: exit 0. `npm run play '' '' 3` (run although only a read-only reader was added to judge.js): 630 games, stalls 0, draws 0, POLICY REFUSALS 0, INVARIANT VIOLATIONS 0.
- Both `text/babel` blocks compile (@babel/standalone, react preset, sourceType script).
- PGlite: 001..007 each twice `ok`; 11 Elo vectors; anon refused everywhere; `tools/sql-sab-007.js` 14/14 sabotages seen. Real Postgres was NOT used for 007 (no new race claim; the claim/late-move race rests on `table_put`'s version check from 001).
- Deno rehearsal (single + folder): ALL PASS, 148 rows (12 new per variant for the forfeit phase, 5 minutes aged in the stub's store rather than waited).
- `tools/serverpage.js` at 393x852: 233 passed, 0 failed (the first run had 3 real findings, fixed: the claim button was below the fold -> the bar is fixed at the top; the close warning is scrolled into view; one unrelated "reload: the game went on" count (4 of 10 moves) did not reproduce on rerun - timing). Page sabotage: no close warning -> 7 FAILs and a crash at the first missing control; countdown removed / forfeit line removed -> 6 FAILs. (A disabled claim button was not sabotaged separately.) Restored.
- Not run: `tools/livecheck.js` (the new claim-idle / forged-key rows are UNRUN on live), `supabase-bundle.js --stamp`, any deploy.

---

# SERVER S5.3 — running log (same branch, on v6.33) — the leaderboard. OFFLINE ONLY: nothing pushed, deployed or run on the project.

Scope: a public ladder op, the last ten results, the Ladder screen, `tools/liveranked.js`. SQL 001-007 are run on the live project and untouched; new SQL is `008_ladder.sql`. Engine rules were not touched.

## The op
`{op:"ladder", identity?:{token}}` -> `{ok:true, floor:3, cap:50, ladder:[{rank,name,rating,games,wins,losses,draws}], recent:[{names:[a,b],heroes:[a,b],winner:0|1|null,how,at}], you?:{name|null,rating,games,wins,losses,draws,listed,rank|null,toGo}}`.
- Public: the same publishable key as every request; no sign-in needed; a request with no identity, a malformed one, a forged or expired token, a provider that throws or rejects, or a function with no provider is answered WITHOUT `you` (never refused, never `identity`). Looking does not sign a phone in (the page passes an identity only when the phone already holds a sign-in).
- LISTED = a chosen name (display_name and name_fold set) + at least 3 recorded ranked games (`LADDER_FLOOR`, ONE constant in referee.js, passed to the database; SQL only bounds it 1..1000) + at least one sign-in pointing at the player (so 007's orphans, whose name is freed and sign-ins gone, never appear; double protection: the name is null too). Nameless players never appear.
- ORDER: rating desc, more games, then name_fold in byte order (`collate "C"`; the fold is unique, so the order is total). `rank` = position 1..n. Top 50 (`LADDER_CAP`). Recent: last 10 (`LADDER_RECENT`), newest first (ended_at, then game id).
- THE CALLER'S LINE: when the token identifies, `you` has name, rating and record (starting 1200 / 0 games for a player nobody rated; the function reads, never creates), `listed`, `rank` (their position among LISTED players, also below the cap, by one COUNT with the same ordering) and `toGo` = max(0, 3 - games). A player with games but no name: `listed:false, toGo:0, name:null` (the page says "Choose a player name..."). A player id the database does not know gets no line.
- NOTHING ELSE LEAVES: the referee rebuilds every row, recent entry and the caller's line from public fields only (a backend that adds an id is stripped; the SQL answer is itself scanned for ids/subjects/table codes/game ids in its self-check). The referee also checks the backend's answer against the rules (<= cap rows, none under the floor, rating/games order, ranks 1..n, recent <= 10, draw iff stalemate, a listed caller has a rank): a backend that breaks them is `internal`, never shown.
- NO WRITES: `ladder_get` is STABLE (cannot write); the referee never calls `store`; drilled (no table row, put, rating row for a stranger, result, broadcast, rename).
- CACHING: none added. One function call = one `ladder_get` statement (two indexes, one count for the caller): cheap enough, and a cache would show a stale ladder right after the player's own game (a bug-looking state). The page reads once per open, with a retry button. If it ever matters: a short `s-maxage` is not possible on a POST; an in-isolate 10-second memo of the PUBLIC part (not `you`) would be the smallest step. Recommendation: leave it.

## 008_ladder.sql (NOT RUN on the project)
`ratings_ladder_idx (rating desc, games desc)`, `results_ended_idx (ended_at desc, game_id desc)`, `ladder_get(p_floor, p_limit, p_recent, p_player default null) -> jsonb` (STABLE, security invoker, service_role only, same grant/revoke discipline). Self-check (idempotent, leaves nothing; runs on a project with real players so it asserts on its own "Zz Lad" players): grants, STABLE, indexes; order Aye/Dee/Bee/Cee (rating, more games, name); the floor as a parameter; provisional, nameless, orphaned and unrated players excluded; ranks 1..n; the cap parameter and the three bounds; the caller's line for listed (checked against an independent count), listed below the cap, provisional, unrated, nameless-with-games, orphan, stranger, none; recent order/cap/shape (exact public keys); no leak (the answer as text holds no id, subject, game id or table code); no writes (row counts and last_seen_at sums unchanged); cleanup.
PGlite: 001..008 each twice -> `ok` (`dawnblade_ladder`); anon refused on `ladder_get` and everything else. `tools/sql-sab-008.js`: 19 sabotages each caught (no floor, orphans listed, nameless listed, no more-games tie-break, names descending, cap ignored, rank off by one, an id leaked in a row, table code leaked in a result, recent oldest first, recent cap ignored, VOLATILE, anon may call, caller listed without the floor, caller's rank ignoring orphans, a stranger gets a line, an id in the caller's line, a write on read, stale games). (First run: the nameless sabotage was only caught by a downstream check; an explicit "no nameless row" assertion was added and confirmed.)
Real Postgres was NOT used (no race claim: the function is read-only).

## Function, stub, fakes
`mkLadder` (entry.template.ts; wired whether or not identity is: the ladder is public); `tools/supabase-stub.js` `ladder_get`; `test/helpers/serverfakes.js` `withLadder` (knobs noFloor, noName, noOrphan, noCap, noGames, byNameDesc, leakId, badRank, unsorted, touch).

## Drills (21 + 6)
test/serverladder.test.js: floor/listing, order and tie-breaks (insertion order irrelevant), cap 50 (60 players; the 51st knows their rank), the caller's line in every case, a public read with no/malformed/forged/throwing/rejecting/missing provider (and the async path), recent results (12 games -> last 10; draw; concession; empty project; a REAL conceded game through the referee and two phones), no leak, no writes, the backend's contract, a ledger drill (constants once, the function wires the ladder with identity off). Each has a sabotage that fails it (confirmed; a sabotage whose anchor no longer matches throws out instead of passing for the wrong reason). test/serverladderphone.test.js: the phone call's answer, public call (identity sent only when there is one), failures are `unavailable`.

## The page and the drives
`SrvLadder` (index.html): reached from the first screen's server group ("The ladder"), the server table screen and the name sheet ("See the ladder"); Back returns to where it was opened. Rows are plain text (no control, drilled). `tools/serverpage.js`: 298 passed, 0 failed (crowd at 393 and at 320 with 16-letter names "Abcdefghijklmnop", "WWWWWWWWWWWWWWWW" and four-digit ratings: rows inside the screen, no name cut or under the rating, no horizontal overflow; order; highlighted caller row; the caller's line; latest games in words; empty state; provisional "2 more ranked games"; nameless; failure and Try again; anonymous phone sends no identity and is never signed in; Back from each entry point). Page sabotage (highlight removed, empty-state words changed, name cut, rows made tappable, toGo dropped, identity always sent) -> 12 FAILs, restored.

## tools/liveranked.js — proved offline only
Plays one ranked game between two fresh phones through names, a ranked table, the lobby, a concession, both end screens, `me` (1216 / 1184), the ladder (neither listed, "2 to go"), recent results and the page's Ladder screen. Needs `--go`. It shares livecheck's helpers (`openPhone`, `walkLobby`, `phoneToken`, `functionPost`, `makeRow`: livecheck now exports them and only runs as a script when it is the main file). Offline: `tools/serverpage.js` drives `run` against the fake referee with the ratings and ladder backends (18 checks pass), and two sabotages (a K of 16; a ladder that lists players under the floor) each make it FAIL. UNRUN ON LIVE.
Left behind on live, for good: two test players (one game each, 1216 and 1184), one result row, one ranked table row.

## livecheck (h)
Read-only: the public ladder over HTTPS with no sign-in, with the host's, with a forged token (well-formed lists, exact public keys, no id); a fresh phone opens the Ladder screen and is not signed in by looking. `ladderOverHttp` is also run offline in the Deno rehearsal (one copy). UNRUN ON LIVE.

## Release prep
APP_VER 6.34. WIRE_V (40) and DATA_VER UNCHANGED: no payload, prompt, game key, snapshot or loader field changed (a request op and an engine call). The function must still be re-bundled and redeployed (APP_VER is part of the build id). Census repins with notes: tapdoor plain-arrow onClick 15 -> 18 (the three ladder buttons), slicecensus stylesheet 73,060 -> 74,307. A local named `you` was renamed (shadow drill: `you` is a side helper).
