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
