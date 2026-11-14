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

# SERVER S4.3 — running log (branch `claude/relaxed-fermi-erc3gs`, on v6.29) — recovery code. OFFLINE ONLY: nothing pushed, deployed or run on the project.

## Step 1 — 004_recovery.sql (NOT RUN on the project; 002/003 untouched)
- New: `recovery_attempts` (RLS forced, no policy, service_role only), `recovery_mint(player, hash, days=730)` -> ok|unknown (deletes the player's older UNUSED
  codes, stores the new hash; the player row is locked so two mints cannot leave two live codes), `recovery_redeem(provider, subject, hash)` -> (status, display_name):
  ok | refused (unknown, used, expired: one UPDATE that matches or not) | limited | unknown. One transaction: spend the code, move the identity, delete the
  throwaway player when it is left with no identity (its name is freed; its codes cascade).
- EXPIRY: 730 days (two years), sent by the function; the column only needs expires_at > created_at. Minting again retires the old code and starts a new two years.
- BRAKE: 8 refused tries per sign-in per hour -> `limited` (a limited try does not look at the code, so a good code is not spent by it). Per sign-in, not global, on
  purpose: a global brake would let anyone lock every player out. A storm of fresh sign-ins is bounded by the auth service's own limit (30 anonymous sign-ins per hour
  per address, S4.2) and the code is 15 characters of a 31-letter alphabet = 74.4 bits: even at 150 tries an hour from one address that is ~10^15 years.
- PGlite (`PGLITE_DIR=<scratch> node tools/sql-pglite.js`, default list now 001..004): 004 run twice -> `ok`; anon refused on recovery_attempts, recovery_mint, recovery_redeem.
  Sabotage (10, each raised the named error): mint keeps older codes; throwaway kept; no brake; expiry ignored; code not spent; identity not moved; anon may redeem;
  attempts RLS not forced; throwaway deleted though it has another identity; a limited try spends the code.

## Step 2 — the function: ops `recovery-mint` and `recovery-redeem` (server/referee.js), entry `mkMint`/`mkRedeem`, stub stand-ins
- `{op:"recovery-mint", identity:{token}}` -> `{ok:true, code:"XXXXX-XXXXX-XXXXX", days:730}` (the ONLY place a code exists in the clear). `{op:"recovery-redeem", identity:{token}, code, tables?:[ids]}` ->
  `{ok:true, name}` | `{ok:false, refused:"recovery"}` (wrong/used/expired/retired/malformed: one answer) | `recovery-limited` | `recovery-seated` | `identity` | `bad-request` | `unavailable` | `internal`.
- Code: 15 chars of ABCDEFGHJKMNPQRSTUVWXYZ23456789 (31, no 0 O 1 I L), 74.3 bits, `crypto.getRandomValues` with rejection at 248, never Math.random. Hash = plain SHA-256 hex of the normalised (upper case, alphanumerics only) code.
- Throwaway player: SQL deletes it when the redeeming sign-in leaves it with no identity. A seat it holds is the referee's business: the phone names the tables it has sat at (`tables`) and the redeem is refused `recovery-seated`
  before anything changes. The server only knows the tables it is told of; the page sends its saved seats.
- Drills `test/serverrecover.test.js` (18, each with its sabotage; backend fake `withRecovery` in serverfakes.js behaves like 004).

## Step 3 — the phone, the page, the rehearsal, livecheck, release prep (v6.30; nothing pushed or deployed)
- `engine/servertable.js`: `recoveryMint(o)` -> {code, days}; `recoveryRedeem(o, code, tables?)` -> {name}; rejects `.why` unavailable | identity | recovery | recovery-limited | recovery-seated.
  Drills `test/serverrecoverphone.test.js` (6, each with sabotage). (Referee helpers are named `opMintCode`/`opRedeemCode`: `recoveryMint`/`recoveryRedeem` collided with the engine exports and `serverref.test.js`'s no-mirror ledger said so.)
- Page (index.html, name sheet = mode "srv-name"): second card "If you lose this phone": Get a recovery code / I have a code; the code is in component state only. `tools/serverpage.js` 131 passed, 0 failed:
  mint on page 1 (box 351x50 inside 393, thumb-sized buttons, no overflow, code not in DOM/storage after "I wrote it down"), redeem on page 2 (wrong code plain words, right code typed lower-case with spaces
  -> "Welcome back, Dawn Smith", same player as the old sign-in, throwaway removed, used code refused the same way). Page sabotage (code written to localStorage; a refusal that says "used or expired") -> 3 FAILs, restored.
- Rehearsal: `tools/supabase-rehearse.js` single + folder under Deno 2.9.6: ALL PASS (8 recovery rows each; the bundled entry compiles with mkMint/mkRedeem).
- livecheck: after the real game a third fresh context redeems seat 0's code; WRITTEN BUT NOT RUN against live (004 and the new function are not deployed). Seat 0's phone first takes a one-run name ("Lc" + clock base 36) so the recovered player is recognisable.
- Release prep: APP_VER 6.30, CHANGELOG, docs/progress/v6.30.md. WIRE_V stays 40 (no wire payload, prompt or game key changed; the ops ride the request envelope). `--check` reads STALE as expected; NOT stamped.
- Repins with notes: slicecensus stylesheet 70,334 -> 70,922 (`.tblrec`, `.tblrecin`, `.tblok`), tapdoor plain-arrow onClick 13 -> 15 (two screen-state buttons). npm test: 4240 tests, 4235 pass, 0 fail, 5 skipped. scenes 107/0. fairness: exit 0.

# SERVER S4.4 — running log (branch `claude/relaxed-fermi-erc3gs`, on v6.30) — names on the board + at most 5 open tables per player. OFFLINE ONLY: nothing pushed, deployed or run on the project.

## Step 1 — 005_table_cap.sql (NOT RUN on the project; 001-004 untouched)
- `table_create_capped(id, row, creator, cap) -> jsonb` ({version} | {version:0, exists} | {version:0, capped, open:[ids]}), service_role only, one transaction under
  `pg_advisory_xact_lock(hashtextextended('dawnblade-open-tables|' || creator, 0))`. Sweep (48 h idle) first, then taken-code, then count, then insert. Count reads the row's own jsonb
  (`row->>'creator'`, `row->>'over'`, `updated_at`), so `table_put` (001) needed no change; partial index on `(row->>'creator')`.
- PGlite (`PGLITE_DIR=<scratch> node tools/sql-pglite.js`, default list now 001..005): 005 twice -> `ok`; anon refused. Sabotage (ten, each raised the named error): no lock, finished tables
  counted, idle tables counted, count ignores the creator, casual rows counted, off-by-one cap, refusal stores the row, anon may create, row naming another creator, taken code not reported.
- REAL concurrency: PGlite is one connection. A real Postgres 16 (Ubuntu's server binaries, run as the `postgres` user) took ten simultaneous callers for a player at four open, with a
  0.4 s pause between count and insert: with the lock created=1 capped=9 (5 stored); the same file with the lock line deleted created=10 (14 stored). `tools/sql-race.sh`.

## Step 2 — referee, phone, fakes, drills
- `create` with `identity` -> `createAs`: `deps.store.createCapped(id, row, creator, 5)`; the row is stamped v3 with `creator`; refusal `table-cap` (+`cap`, `open`); a store with no `createCapped` -> `unavailable`
  (never an unchecked table for a signed-in player). No identity: the casual create, byte for byte (the v6.28 fixture drill still passes). `frame` sets `row.over` when the session ends (creator rows only).
  `{op:"close"}` (creator only; `not-creator`, `no-table`, `identity`); a closed row answers `no-table` to join/frame/resync.
- Phone (`engine/servertable.js`): the sign-in token is asked BEFORE a create (it moved up); `{op:"create", identity}`; `identity` refusal falls back to a casual create AND a casual sit-down; `table-cap` -> `.why` with
  `.open` (codes) and `.cap`; new `closeTable(o, code)`.
- Drills: `test/servertablecap.test.js` (15) and `test/servernames.test.js` (2), every one with sabotage that fails; `test/serverid.test.js`'s whole-game drill now has seat 0's player CREATE the table signed in, so its scans also
  read the creator row and the `over` marker. Two of my first edits tripped existing sabotage anchors (text no longer unique): reworded mine, never weakened theirs.

## Step 3 — entry `createCappedRpc`, stub `table_create_capped`, Deno rehearsal cap phase (single + folder ALL PASS, 12 rows each)

## Step 4 — the page
- `useSrvNames(table)` hook (SrvNames uses it); TableBoard draws `.pname` (`data-pname="me"|"foe"`) in each seat's `.heromid`; `.heromid{min-width:0}` + `.pname` one line with an ellipsis.
- `TableScreen`: `SRV_WHY["table-cap"]`, the list of open codes with a Close button each (`closeMine`), a note when one is closed.
- `tools/serverpage.js`: names on the board (both seats), after a reload, after a takeover of the opponent's seat, long (16 letters; and 320 wide: cut with an ellipsis), a nameless opponent, the joiner's board, the
  cap refusal text, the five codes, Close freeing exactly one slot. Page sabotage (foe name not drawn; an identifier in the cap sentence; `min-width:0` removed) each FAILed, restored.
- `tools/livecheck.js`: after both phones reach the board, seat 0's one-run name is on BOTH boards. WRITTEN BUT NOT RUN on live.
- WIRE_V stays 40 and DATA_VER unchanged: names ride the function's own answers (`names`), create/close ride the request envelope, the cap refusal is the function's own answer; no wire.js payload, prompt or game key moved.
