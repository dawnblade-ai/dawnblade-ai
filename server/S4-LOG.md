# SERVER S4.1 — running log (branch `claude/amazing-franklin-ycg51z`, on v6.28)

Scope: OFFLINE ONLY. "A seat can belong to a player." No push, no deploy, no SQL run, no Supabase call. APP_VER/CHANGELOG untouched.

## Step 1 — referee: identity at join (server/referee.js)
- `join` takes `identity:{token, name?}`; `deps.identify(token) -> {player, name?}|null` is the only seam. No identity = v6.28 body untouched.
- Recorded the v6.28 casual run (scratch worktree at dc2ee48) -> `test/fixtures/referee-v628.json`; the new code reproduces every hash.

## Step 2 — drills (test/serverid.test.js, helpers in serverfakes.js / serverhub.js, fixture referee-v628.json)
18 tests, each drill with its sabotage; about 11 s (one whole game). `memIdentity()` is the fake provider; `makeServerHub` gained
`identify / identities / lose / secrets` (additive: unset = the old behaviour; the serverref suite is unchanged apart from its ROW_V assertion).

## Step 3 — SQL draft (server/supabase/002_players.sql, NOT run on the project)
`players`, `identities(provider, subject -> player_id)`, `recovery` (sha256 hex only, one-time via `recovery_use`), `identity_resolve()`
(race-safe first-sight upsert). RLS enabled+FORCED, zero policies, anon/authenticated revoked, service_role only; self-check ends `ok`.
PGlite (`PGLITE_DIR=<scratch> node tools/sql-pglite.js`; PGlite installed with `npm install --prefix <scratch> @electric-sql/pglite`):
001 and 002 each run twice -> `ok`; anon refused on every table and function. Sabotage (each raised the named error): RLS not forced,
anon select grant, a policy, anon execute, recovery not one-time, recovery ignores expiry, key without provider, unbounded name.
Two sabotages are NOT caught by the serial self-check ("identity re-pointed on conflict", "orphan player kept"): both live on the
simultaneous-first-sight path, which one PGlite connection cannot exercise.

## Step 4 — entry template `identify` seam + stub + Deno rehearsal
`entry.template.ts`: `mkIdentify` (verify with `GET /auth/v1/user`, 401/403 -> null, other failure throws -> `internal`; map with
`POST /rest/v1/rpc/identity_resolve`), wired as `deps.identify` unless `TABLE_IDENTITY=off`; only ever called when a join presents a
token. Marked UNVERIFIED in the file. `tools/supabase-stub.js` gained `/auth/v1/user` and `identity_resolve` stand-ins (+`issueUser`, `authDown`).
`tools/supabase-rehearse.js` gained an identity phase per variant (13 rows). Deno 2.9.6: single and folder both ALL PASS (both games'
fingerprints equal the in-process referee; identity rows pass).
**`node tools/supabase-bundle.js --check` now reads STALE for the deployed stamp (and the dist copy): EXPECTED — `server/referee.js` and the
template are bundled files and changed. NOT stamped. The live function is still the v6.28 one (stamp's digest).**

## Step 5 — validation (2026-11-14)
npm test: tests 4204, pass 4199, fail 0, skipped 5 (tools/.cache/card.json moved aside for the run, restored). scenes 107 passing / 0 failing.
fairness: no findings. serverrun --isolate: ALL PASS. Deno rehearsal (single + folder incl. identity phase): ALL PASS. serverpage (PAGE_DEPS scratch): 74 passed, 0 failed.
(`npm test` rewrote CR-INDEX.md; reverted, not part of this stage.)

## Decisions
- WIRE_V NOT bumped: wire.js payloads, prompts and game keys are untouched; `identity` rides the request envelope and `names`/`owned`/`taken`/`owners`/`retired` the function's own envelope and row (same reasoning as `claim`/`mac` in S3).
- Row: ROW_V=3 newest; reads 2 and 3; a row is written v3 only when an identity binds (casual rows stay v2, byte-identical to v6.28, and v6.28 can still read them; v6.28 refuses v3 as `wire` = safe rollback). v2 reads as owners/names [null,null], retired [[],[]], nothing rewritten by reading.
- Bundled files changed: `server/referee.js` and `server/supabase/entry.template.ts` ONLY (engine/*.js, data/*, index.html unchanged). Shipping the repo without redeploying the function is safe (live function = v6.28 referee, unaffected); `--check` stays STALE until a redeploy + `--stamp`.
