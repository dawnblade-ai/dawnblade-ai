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
