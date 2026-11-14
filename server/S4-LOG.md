# SERVER S4.1 — running log (branch `claude/amazing-franklin-ycg51z`, on v6.28)

Scope: OFFLINE ONLY. "A seat can belong to a player." No push, no deploy, no SQL run, no Supabase call. APP_VER/CHANGELOG untouched.

## Step 1 — referee: identity at join (server/referee.js)
- `join` takes `identity:{token, name?}`; `deps.identify(token) -> {player, name?}|null` is the only seam. No identity = v6.28 body untouched.
- Recorded the v6.28 casual run (scratch worktree at dc2ee48) -> `test/fixtures/referee-v628.json`; the new code reproduces every hash.
