# SERVER S1 — running log (branch `ship/server-s1`, on v6.24)

Decision (user, 2026-11-13): the hosted referee runs on Supabase, as a stateless Edge Function
(Deno) invoked per action, table state in a service-role-only Postgres row, each seat's frames
pushed on its own private Realtime Broadcast channel. No account yet: S1 is built and drilled
OFFLINE. Nothing in this directory is Supabase-specific except the clearly marked, UNVERIFIED
sketch `supabase-entry.example.ts`.

## What S1 is

- `server/referee.js` — `handle(request, deps)` (Promise) and `handleNow` (same body, synchronous
  deps). Load row → rehydrate a `hub.js` hub → apply ONE frame → save with an optimistic version
  check → push each seat only its own frames. Frame and payload shapes are hub.js / net.js /
  wire.js's own; the only new shape is the request envelope `{op, table, seat, key, n, frame}`.
- `test/helpers/serverfakes.js` (versioned store, recording bus, promise-lagged variants),
  `test/helpers/serverhub.js` (the server dressed as a hub, so `judgedGame`'s scans run on it
  unchanged), `test/serverref.test.js` (drills a–e + sabotage), `tools/serverrun.js` (Deno list +
  isolate half), `tools/servermeasure.js` (the numbers below).
- Engine changes (both drilled in `test/serverref.test.js`):
  1. `engine/hub.js` `persistTable()` + pre-deal `resume` (the lobby log replays silently). The
     page's own `persist()` is unchanged (still `null` before the deal).
  2. `engine/referee.js` `restore()` sets `rebuilt`; `intent()` then derives a seat's delta base
     from the previous state's view. Without it every commit after a rehydration carried the
     WHOLE view (largest commit in a game: 90,851 B rehydrated vs 10,313 B continuous; different
     seeds, same pair).

## Decisions

- WIRE_V NOT bumped: no wire payload or prompt shape changed (frames are hub.js's; `persistTable`
  is a stored shape, and a saved game still carries `v: WIRE_V` and is refused on a mismatch).
  A row carries its own `v` (ROW_V) and `wireV`; a mismatch answers `refused: "wire"`.
- Response = the caller's frames, in order. Broadcast = the OTHER seat's frames only (so nothing
  is delivered twice). A caller that lost its response sends `resync`. The join response is the
  only thing that ever carries a key.
- Replay protection: per-seat frame counter `n`, stored in the row, advanced only by a frame that
  changed the table. A claim answers where `n` resumes.
- Auth is checked twice: `keyEq` in `referee.js`, then hub.js's own claim. The (c) sabotage removes
  both doors.

## Measurements (this machine, shared CPU; read medians)

COLD LOAD (fresh process, before the first request):
- Node v22.23.4: engine modules 36.6 ms · data/pool.js (1.4 MB, 797 records) 29.7 ms · card maps
  13.3 ms · hero/deck data 2.4 ms · total 81.9 ms
- Deno 2.9.6 (`npm install --prefix <scratch> deno`): 31.1 / 35.6 / 12.1 / 14.2 · total 93.1 ms

ONE ACTION (rehydrate + apply + save + push, over the in-memory fakes; 1058 actions, 3 games):
- Node: median 22.0 ms · p95 30.4 ms · max 82.3 ms
- Deno: median 18.2 ms · p95 26.4 ms · max 65.3 ms
- (Network, Postgres and Realtime round trips are NOT in these numbers.)

STORED ROW (JSON text, bytes):
- mid-game 38,677 (kayo v dash, 327 actions) · 34,966 (briar v lyath, 256) · 55,672 (arakni v
  viserai, 475); at the end 60,755 · 59,738 · 75,940; LARGEST 76,915 (arakni v viserai).
- It grows with the log, which the row keeps whole.
- Largest single response 31,091 B (a snapshot, sent as 12,000-char parts); largest message after
  reassembly 12,942 B (kayo v dash). Realtime's payload limit is UNVERIFIED.

## Finding (pre-existing, not S1): a hidden uid leaks through `weaponUsed` keys

`weaponUsed` carries keys `"ct"+uid`, `"ally"+uid`, `"aura"+uid` (effects.js:355, 3972, 3984). A
commit delta to the OTHER seat deleted `sides[1].weaponUsed.ct100083` after that card had gone back
to seat 1's hand, so seat 0 learns "that hidden card is the one played earlier". Reproduced on a
CONTINUOUS in-process referee (not a rehydration artefact): arakni v viserai, seed key `srv-2`,
seq 96, uid 100083. `view.js` does not map prefixed keys. judgetable's drills pass only because
their seeds do not reach it. Not fixed here (out of S1's scope); S1's drill games avoid that seed.
Repro: `node tools/servermeasure.js` does not scan; use test/helpers/judgetable.js `judgedGame`
with `makeServerHub({seedKey: "srv-2"})` for arakni v viserai.

## Open risks

- Realtime private-channel authorization (who may subscribe to `table:<id>:seatN`), payload size
  limits, delivery order and Edge Function limits (CPU time, memory, 1.4 MB pool cold start) are
  all UNVERIFIED — no Supabase docs from the sandbox.
- Two requests on one table are serialised only by the version check; a busy table will see
  `conflict` + retry. Clients must retry with a FRESH `n` only if their frame did not apply.
- The row keeps the whole log (needed for the post-game reveal and verify); a very long game grows
  it. Compact later if it matters.
- `rand` falls back to crypto when `deps.rand` is absent (hub.js/sha256.js); the drills seed it.
