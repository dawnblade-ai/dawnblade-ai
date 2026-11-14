# S3 DEPLOY LOG — Supabase project `fokcpzplomjsraquaaid` ("Referee", us-east-1), 2026-11-14

Request paths and status codes only; no bodies that could hold secrets.

1. `node tools/supabase-bundle.js` + `--check`: OK, v6.25 · sage-v17, digest 005370a610f6; single 3,539,288 B, folder 3,538,736 B / 25 files.
   Deno 2.9.6 rehearsal, both variants: ALL PASS (single: 387 actions, median 23 ms, cold 2178 ms; folder: median 23 ms, cold 386 ms).
2. Read-only state: `GET api.supabase.com/v1/projects/{ref}` 200; `GET /v1/projects/{ref}/functions` 200 -> `[]`;
   `POST /v1/projects/{ref}/database/query` (read_only select) 201 -> `public.tables` and `table_put` absent, 0 tables in `public`.
3. SQL: `POST /v1/projects/{ref}/database/query` with all of 001_tables.sql -> 201, self-check result `[{"dawnblade_tables":"ok"}]`.
   Read-only confirm: RLS on + forced, 0 policies, 0 rows. From outside with the publishable key: `GET /rest/v1/tables` 401 (42501 permission denied),
   `POST /rest/v1/tables` 401 (42501), `POST /rest/v1/rpc/table_put` 401 (42501 permission denied for function); rows still 0.
