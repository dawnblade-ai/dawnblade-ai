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

# SERVER S4.2 — running log (branch `claude/inspiring-ritchie-630ocp`)

## Step 1 — the project side, LIVE (2026-11-14)
- Anonymous sign-in ENABLED (user's yes, 2026-11-14): `PATCH /v1/projects/{ref}/config/auth` body `{"external_anonymous_users_enabled":true}` -> 200 (field name VERIFIED;
  took a few seconds to apply). Sign in: `POST /auth/v1/signup` body `{}` with the publishable `apikey` -> `{access_token, refresh_token, expires_in:3600, user:{is_anonymous:true}}`.
  `GET /auth/v1/user`: 200 with a real token, 403 with a garbage one (mkIdentify already treats 401/403 as null). No captcha; 30 anonymous sign-ins per hour per address.
- `002_players.sql` RUN on the project (`database/query` -> 201, `[{"dawnblade_players":"ok"}]`); the publishable key is refused on players/identities/recovery (404) and identity_resolve (401).
- Function redeployed with the S4.1 referee (version 11; build id unchanged `v6.28 · sage-v17`, so v6.28 phones handshake as before), stamped (digest 68fb00be0da6).
- `mkIdentify` VERIFIED LIVE: two real anonymous players joined one table (`owned:true`, `names:["Ritchie","Franklin"]`), the same token asked again got the same
  seat, a forged token -> `identity`, a one-letter name -> `bad-request field:name reason:short`, a third casual join -> `full`; no token or subject in any answer.
- `tools/livecheck.js` against the v6.28 page + the new function: ALL PASS (push 43, fallback 0, median 313 ms, p95 550).

## Step 2 — op "me" and unique names (server/referee.js, 003_names.sql)
- `{op:"me", identity:{token}, name?}`: no name reads the stored one; a name is validated by `validateName`, stored through `deps.rename(player, name, fold)`
  ("ok" | "taken"), unique on `nameFold` (RULING user 2026-11-14). A name at a JOIN is now refused (`bad-request`, `field:"name"`, `reason:"at-join"`): it would
  let anyone wear another player's name. `003_names.sql`: `players.name_fold`, a unique partial index, `player_rename` (service_role only). PGlite: all three files
  twice -> ok; sabotage (non-unique index; anon execute) each raised.
## Step 3 — entry `mkRename`, stub `player_rename`, Deno rehearsal single + folder: ALL PASS.
## Step 4 — the phone (engine/servertable.js): `supabaseIdentity` (lazy anonymous sign-in kept under `who.id`; refresh; an outage is never a refusal),
  `open` sends `identity:{token}` on an unkeyed join and falls back to a casual join when refused; `names()`/`owned()`/`onNames`; `taken` (push, request, resume);
  `whoAmI`/`setName`; `defaultIdentity` (drive seam `window.__dawnServerIdentity`). Drills `test/serverwho.test.js` (10, each with sabotage).
## Step 5 — the page: "Playing as …" row + name sheet (`srv-name`), `SrvNames` in the lobby, `taken` wording. `tools/serverpage.js`: 99 passed.
## Step 6 — release v6.29 (2026-11-14)
- `003_names.sql` RUN on the project -> `[{"dawnblade_names":"ok"}]`. Refresh VERIFIED live: `POST /auth/v1/token?grant_type=refresh_token` 200; a bad refresh token 400.
- npm test: 4216 tests, 4211 pass, 0 fail, 5 skipped. scenes 107/0. fairness: no findings. Both babel blocks compile. Repinned with notes: slicecensus (stylesheet
  69,669 -> 70,334), tapdoor (12 -> 13). CR-INDEX.md regenerated (line numbers only).
- KNOWN LIMITS: identity is per phone until S4.3 (recovery code); a lost refresh ANSWER can cost the session (Supabase rotates refresh tokens; reuse is only
  tolerated for a few seconds) -> new player; two tabs of one browser are one player; names are not on the board, only the lobby.
