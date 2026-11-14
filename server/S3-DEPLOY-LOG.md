# S3 DEPLOY LOG — Supabase project `fokcpzplomjsraquaaid` ("Referee", us-east-1), 2026-11-14

Request paths and status codes only; no bodies that could hold secrets.

1. `node tools/supabase-bundle.js` + `--check`: OK, v6.25 · sage-v17, digest 005370a610f6; single 3,539,288 B, folder 3,538,736 B / 25 files.
   Deno 2.9.6 rehearsal, both variants: ALL PASS (single: 387 actions, median 23 ms, cold 2178 ms; folder: median 23 ms, cold 386 ms).
2. Read-only state: `GET api.supabase.com/v1/projects/{ref}` 200; `GET /v1/projects/{ref}/functions` 200 -> `[]`;
   `POST /v1/projects/{ref}/database/query` (read_only select) 201 -> `public.tables` and `table_put` absent, 0 tables in `public`.
3. SQL: `POST /v1/projects/{ref}/database/query` with all of 001_tables.sql -> 201, self-check result `[{"dawnblade_tables":"ok"}]`.
   Read-only confirm: RLS on + forced, 0 policies, 0 rows. From outside with the publishable key: `GET /rest/v1/tables` 401 (42501 permission denied),
   `POST /rest/v1/tables` 401 (42501), `POST /rest/v1/rpc/table_put` 401 (42501 permission denied for function); rows still 0.
4. Deploy: `POST /v1/projects/{ref}/functions/deploy?slug=table` (multipart, FOLDER variant: metadata + 25 file parts; 3.5 MB total, no size complaint) -> 201,
   function id `300f721a-ded8-459b-8ddd-7d9394226eaf`, ACTIVE, verify_jwt=false (set in the deploy metadata; the page sends the publishable key, not a user JWT).
   Version 1 (digest 005370a610f6), version 2 (66cb4f50e3ae, seal fix), version 3 (5e0ef37ef8dd, replay fix) = the one stamped in `DEPLOYED.json`.
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` were present (the function read and wrote the table); nothing was set.
5. Smoke, publishable key only: `GET /functions/v1/table` 200 (health, build v6.25 · sage-v17); `OPTIONS` with Origin github.io 204 (ACAO echoes the origin);
   `POST` `{op:"resync",table:"ZZZZZZ"}` 200 `{"ok":false,"refused":"no-table"}` with and without `apikey`.
   FIRST LIVE GAME FAILED: every push was ignored as "unsealed". Cause: Supabase Realtime re-encodes broadcasts with sorted object keys; the seal was over insertion-order JSON.
   Fix (`engine/sha256.js` `canon`, used by `frameMac`) -> redeploy v2. Second finding: `referee.replay` compared the game result as order-sensitive JSON, so a seat whose
   reveal arrived by Realtime push failed "verify" -> canonical compare -> redeploy v3. Both have drills with sabotage checks.
   Final runs on v3 (real Realtime, 350 ms settle window between actions; 4 games at once, so latencies include contention):
   - fr (kayo,dash, reload mid-game at action 60), fa (bravo,lyath), fb (arakni,azalea), fc (blaze,enigma); per-request latency
     (ms) median 183 to 189, p95 380 to 433, max 1.5 to 3.2 s; cold first answer 359 to 501 ms; 175 to 449 actions per game; every no-reload game: ended,
     seat views == in-process referee, shuffles verify true/true, blindness scan clean, pushes on exactly 2 derived topics.
   - Earlier v2 runs: 6 more no-reload games, 5 clean; 1 failed verify (the replay `over` key order, fixed in v3).
   - Reload game: seat 1 reclaimed (counter 35 to 38 after 60 actions), game finished, views equal referee; its verify fails because the harness's reloaded phone has a different seedG in its replayed lobby (specs differ across phones). Not a server fault; unfixed.
   Wrong key: `ST.reclaim` with a bad key -> `why=auth`, seat record forgotten.
6. Left behind (read-only count via `database/query`): 22 rows in `public.tables`, 311,412 bytes of row JSON, 6,840,320 bytes total relation size. No expiry job installed (the optional pg_cron line stays commented). Nothing deleted.
   `GET /rest/v1/tables` with the publishable key after all games: 401.

## v6.26 release work (continued after a container restart)

Job 1, the tester's door (index.html `SRV_TESTER`, engine/servertable.js `testerDoor`): `window.SERVER_TABLE.on` stays false. `?server=1` opts a phone in, remembered through the page's `store` seam (key `dawnblade.server`);
`?server=0` forgets it. The option's blurb now says it is an early test. Drills: `test/servertable.test.js` (gate; sabotaged by removing the `?server=0` branch -> fails, restored) and 8 rows in `tools/serverpage.js` (driven in the real page; `open({query})` added to tools/page.js).
serverpage after the door rows: 64 passed, 0 failed.

Job 2, the reloaded seat's failing "verify this game" (ROOT CAUSE FOUND; it was NOT the seed half and NOT the reload):
- Drove the real page's own reload through `tools/serverpage.js` to the end of a game and pressed its own "Verify this game". First result: the lobby held the table's own seed half before and after the reload (equal to the table's `hub.spec.seedG`), and the page's rebuilt opening state was byte-identical (canonical JSON) to the server's deal, yet the page's verdict was intermittently "Not verified: after action N the replay differs" (N = 25, 31, 33, 35, 62, 89 over runs; some runs passed).
- The same replay run in Node with the page's own log, hashes and spec passed. Diffing the page's replayed state with Node's at the first failing action showed `Goblet of Bloodrun Wine: no card named "vigor" in the database — token not created` in the PAGE's replay and the token made in the server's.
- Cause: `index.html` never registered its card database with the judge engine (`DawnJudge.setDb` is called by every drill and by the function, never by the page), so on the real page `judge.reduce` could not look a token up. Not specific to reload: any server game in which a token-minting card is played fails the page's verify. Measured in the page, seeded Viserai v Dorinthea, 600-action cap: unregistered 1 "token not created" and 25 Runechant lines; registered 0 and 33.
  Side finding, UNVERIFIED beyond that probe: the page's direct and AI tables ran their rules without a database too, so token creation by card text refused there (the trainer's `Battle` has its own context and is unaffected).
- Fix at the root: `loadPool()` registers the database it returns (`DawnJudge.setDb(db)`), one place. Drills: `test/servertable.test.js` (source), `tools/serverpage.js` rows "card database" (the probe is run unregistered first and must see the missing token = the sabotage, then registered must see none), and the end-of-game rows (reloaded seat's own Verify passes; the never-reloaded scripted seat verifies the same game; finished game equals the in-process referee). After the fix: reload to the end, verify -> "Verified" (several runs, below).
- Harness note: the earlier "different seedG in the replayed lobby" reading was a mistaken diagnosis; `serverpage` now asserts seedG equality directly and it holds.
Job 3, the serverpage flake: the "unavailable mid-game" check now drives the scripted phone until the page has a move (a state), asserts that, then cuts the server. 
Job 4: `.github/workflows/keepalive.yml` (daily 06:23 UTC + workflow_dispatch; GET health with the publishable key; fails on non-200 or `service` != `dawnblade-table`); the same request from here answers 200 `{"service":"dawnblade-table","build":"v6.25 · sage-v17"}`.
Job 5, expiry: `table_put` on a CREATE first deletes rows with `updated_at < now() - interval '48 hours'` (`updated_at` is set on insert and on every update; no pg_cron). The self-check now inserts a 3-day-old and a 1-day-old row, creates a table, and requires the old one gone and the young one kept (sabotage: interval '99 days' on PGlite -> "a table idle for 3 days was not forgotten"; real SQL on PGlite -> ok).
  Run on the project: `POST /v1/projects/{ref}/database/query` 201, last result `[{"dawnblade_tables":"ok"}]`. After: RLS on and forced, 0 policies, 22 rows (oldest 2026-11-14 00:03 UTC, so nothing was due), 0 self-check leftovers. Publishable key: `GET /rest/v1/tables` 401, `POST /rest/v1/tables` 401, `POST /rest/v1/rpc/table_put` 401. No row was hand-deleted.

Job 3 result: tools/serverpage.js, 5 consecutive runs after the fixes (including the reload-to-end and verify rows): 71 passed, 0 failed in 61 s, 57 s, 57 s, 66 s, 58 s.

Job 7, redeploy for v6.26 (WIRE_V not bumped: no payload, prompt shape or top-level game key changed; DATA_VER not bumped: no loader schema, card-field handling or pool change, `sage-v17` stays; the page change is registering the already-loaded database with the judge; the function's build id is `v6.26 · sage-v17` from APP_VER):
- `node tools/supabase-bundle.js` -> v6.26 · sage-v17, digest 3d08c4fb5964; single 3,539,999 B, folder 3,539,447 B / 25 files; `--check` before deploy: STALE (stamp v6.25) as expected.
- Deno 2.9.6 rehearsal, both variants: ALL PASS. single: 191 actions, 225 requests, median 17 ms, cold 964 ms; folder: 360 actions, 394 requests, median 16 ms, cold 333 ms.
- Deploy: `POST /v1/projects/{ref}/functions/deploy?slug=table` (folder variant, metadata + 25 files) -> 201, ACTIVE, version 4, verify_jwt false. Health x3: 200 `{"service":"dawnblade-table","build":"v6.26 · sage-v17"}`.
- Live games (publishable key, real HTTP + Realtime websocket from Node, `tools/supabase-live.js`; two games ran at the same time so latencies include contention):
  - fa (kayo, dash; no reload): 303 actions in 180.8 s, 337 requests; per request median 199 ms, p95 444, max 1152; cold first answer 533 ms; ended, both seat views equal the in-process referee, shuffles verify true/true, blindness scan clean, 317 pushes on exactly 2 derived topics, wrong key refused (`auth`).
  - fr (arakni, azalea; seat 1 closed and reclaimed at action 60, counter resumed at 37): 198 actions in 117.5 s, 240 requests; median 186 ms, p95 434, max 854; cold 532 ms; same checks all pass, shuffles verify true/true ON THE RELOADED SEAT. (A first run on the same build before the harness fix, kayo/dash: reload verify false for the harness's reloaded phone only; see below.)
- Harness fix (the log's "reloaded phone re-derives a different seedG"): the harness's reloaded phone (`test/helpers/serverphone.js`) answered the seed again as soon as it saw the commitment, before the table's replay reached its own earlier answer; the lobby is write-once, so the replayed original was refused locally and its local seed half differed (second 32 hex characters differed, first half equal). A reloaded seat has already answered: `P.reclaimed` now makes it only start the game once the replay reaches ready. The page's seat is unaffected as driven: its lobby takes the whole replay in one React batch before its answer effect runs; `tools/serverpage.js` asserts its seedG equals the table's before and after reload (5 runs).
- `node tools/supabase-bundle.js --stamp` -> `DEPLOYED.json` v6.26 · sage-v17 3d08c4fb5964; `--check` OK.
- CONSEQUENCE: from this redeploy until `main` is pushed, live v6.25 pages (build `v6.25 · sage-v17`) cannot use the server table: the function's build id is v6.26, so the handshake reads "different versions of the game". The v6.25 page hides the server option (`on: false`), so no player meets it.

Job 8, validation on the final tree: `npm test` (tools/.cache moved aside) 4182 tests, pass 4177, fail 0, skipped 5; `npm run scenes` 107 passing, 0 failing; `npm run fairness` nothing found; `npm run play '' '' 3` 630 games, stalls 0, draws 0, policy refusals 0, invariant violations 0, malformed 0; `node tools/serverrun.js --isolate` ALL PASS; `tools/serverpage.js` x5 on the final tree: 71 passed, 0 failed (61, 64, 57, 64, 61 s); both text/babel blocks compile (2 blocks, 0 errors); `node tools/supabase-bundle.js --check` OK against the stamp (v6.26 · sage-v17, 3d08c4fb5964).

## v6.28 (2026-11-14): the server table opens (user: "Go ahead and open it up")
Step 1: `SERVER_TABLE.on` true; `?server=0` kept as a per-phone kill switch (remembered; `?server=1` brings it back); table screen in three labelled groups (Server table / Direct table / Judge's table). serverpage 74 passed, 0 failed.
Step 2: `tools/livecheck.js` written; first run against LIVE v6.27 (`?server=1` added automatically, the live switch is closed), real CDNs, two Chromium contexts at 393x852, through the egress proxy: page 200, APP_VER 6.27 / DATA_VER sage-v17, 30 of 30 scripts 200; function health `v6.27 · sage-v17` equals the page; seated yes (guest tap to both on the fighter screen 946 ms; lobby walked to the board in 3.6 s); 41 moves (host 21, guest 20), 41 by push, 0 by fallback, 0 lost; tap to other seat median 313 ms, p95 471 (host moves median 324 / p95 471 / max 539; guest moves median 303 / p95 581 / max 581); no banner; no console or page errors; 36 s. Exit 0; a wrong URL exits 1.
Step 4, redeploy for v6.28 (WIRE_V and DATA_VER not bumped: no payload or loader change; build id `v6.28 · sage-v17` from APP_VER):
- `node tools/supabase-bundle.js` -> v6.28 · sage-v17, digest e0dfe849f591, single 3,541,984 B, folder 3,541,432 B / 25 files; `--check` before: STALE (stamp v6.27).
- Deno 2.9.6 rehearsal (both variants): ALL PASS (folder: median request 27 ms, 366 saves).
- Deploy: `POST /v1/projects/{ref}/functions/deploy?slug=table` (folder variant, metadata + 25 files) -> 201, ACTIVE, version 9, verify_jwt false. Health x3: 200 `{"service":"dawnblade-table","build":"v6.28 · sage-v17"}`.
- Live game (publishable key, real HTTP + Realtime from Node, `tools/supabase-live.js full kayo,dash noreload`): 251 actions in 161.8 s, 282 requests, per request median 246 ms, p95 473, max 1238; cold first answer 158 ms; both seat views equal the in-process referee, shuffles verify true/true, blindness scan clean, 265 pushes on 2 derived topics, wrong key refused (`auth`). ALL PASS.
- `--stamp` -> DEPLOYED.json v6.28 · sage-v17 e0dfe849f591; `--check` OK.
- CONSEQUENCE: from this redeploy until the CEO pushes `main`, live v6.27 pages (build `v6.27 · sage-v17`) cannot handshake with the function ("different versions of the game"). The v6.27 page keeps the server table closed except with `?server=1`, so no ordinary player meets it; a v6.27 tester does. After the push, `node tools/livecheck.js`.
