# SERVER S4.1 — running log (branch `claude/amazing-franklin-ycg51z`, on v6.28)

Scope: OFFLINE ONLY. "A seat can belong to a player." No push, no deploy, no SQL run, no Supabase call. APP_VER/CHANGELOG untouched.

## Step 1 — referee: identity at join (server/referee.js)
- `join` takes `identity:{token, name?}`; `deps.identify(token) -> {player, name?}|null` is the only seam. No identity = v6.28 body untouched.
- Recorded the v6.28 casual run (scratch worktree at dc2ee48) -> `test/fixtures/referee-v628.json`; the new code reproduces every hash.

## Step 2 — drills (test/serverid.test.js, helpers in serverfakes.js / serverhub.js, fixture referee-v628.json)
18 tests, each drill with its sabotage; about 11 s (one whole game). `memIdentity()` is the fake provider; `makeServerHub` gained
`identify / identities / lose / secrets` (additive: unset = the old behaviour; the serverref suite is unchanged apart from its ROW_V assertion).
