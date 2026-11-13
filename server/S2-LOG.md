# SERVER S2 — running log (branch `ship/server-s2`, on v6.25)

Decision (user, 2026-11-13): the hosted referee runs on Supabase (project `fokcpzplomjsraquaaid`; URL and
publishable key are public config, `window.SERVER_CFG`). Nothing is deployed there; S2 is built and drilled
against the offline fake and degrades to "unavailable" when the real backend is absent.

## What S2 is

- `engine/servertable.js` (plain UMD, `<script src>` after hub.js, reached as `DawnServerTable.*` like
  room/hub, not bridged). `startTable | sitAt | reclaim({transport, keep, code, tune, onStatus, have})` resolve
  with room.js's channel shape `{send, listen, first, close, status}` plus `peerHeard, closedWhy, quietFor,
  setHave, heal, forget, counter, pending, events, report`. Owns: counter `n` (one frame in flight; moves on
  any ok answer, see the header for why that is safe), conflict retry (same n, jittered backoff, cap, then
  "unavailable" and probe — frames are never dropped), lost-answer handling (stale -> claiming join says where
  n stands), `heal` (claiming join replays the lobby before a game; `resync` during one), broadcast dedup by
  `ver`, late payloads not delivered + resync, subscription lost/joined -> reconnecting/heal, optional idle
  poll, seat key in memory + the page's `store` under `srv.<code>`, honest status values.
- Transports: `supabaseTransport(config)` (plain fetch to `<url>/functions/v1/referee` with `apikey`; lazy
  supabase-js 2.115.0 UMD from jsdelivr for subscribe; 404/5xx/non-referee body = unavailable) and the FAKE,
  `test/helpers/servertransport.js` (S1's referee + store + bus with fault injection) — never in a script tag.
- Page: "Join a server table" on the table screen (open / enter code / resume seat; code shown while waiting;
  unavailable card with "Use a direct table instead"; not-found, full, wrong-version messages), `SrvBanner`
  (reconnecting, unavailable, seat gone, opponent quiet 45 s) on the lobby and board.
- Engine change: `hub.js` `persistTable()` now keeps `lobLog` after the deal and `resume` replays it, so a
  phone that reloads mid-game is replayed the lobby on its claim (without it the lobby never reached "ready").
  The page's own `persist()` is unchanged.
- Tests: `test/servertable.test.js` (16 tests, ~29 s), helpers `serverphone.js`, `servertransport.js`.
  Drive: `tools/serverpage.js` (48 assertions). `tools/page.js` now routes scoped jsdelivr/unpkg packages.
- Repins (deliberate): `test/slicecensus.test.js` phasebar slice 68988 -> 69328; `test/tapdoor.test.js` 8 -> 12;
  `test/sync.test.js` MODULES gains `servertable`.
- Drafts for the next stage: `server/supabase/001_tables.sql`, `server/supabase/DEPLOY.md`.

## WIRE_V / DATA_VER

WIRE_V not bumped: no payload or prompt shape changed (frames are hub.js's; the stored row gained a field,
`hub.lobLog`, and an old row simply replays no lobby). DATA_VER not bumped: no loader schema, card-field handling
or pool change. APP_VER and CHANGELOG untouched, per the brief.

## Findings

- The catalog hash covers a card's image address (set from `window.CDN`) and the page builds its catalog from the
  BUILDS' cards, not the dealt state. A server `deal` that differs in either gets "card data mismatch" at the
  handshake. The hosted function must deal as `JudgeRoom.deal` does (DEPLOY.md step 6).
- The server's `build` string must be bumped with every page release.
- An unkeyed `join` that conflicts writes nothing and is retried; one whose ANSWER is lost leaves a seat dealt to
  nobody (the retry takes the other seat or "full"). A client-chosen claim token would close it (S3).
- An instant `sleep` in a retry loop starves the event loop: the fake's sleep yields a macrotask.

## UNVERIFIED Supabase details (all in comments tagged UNVERIFIED)

1. Edge Functions gateway accepts the publishable (non-JWT) key in `apikey` alone with JWT verification off.
2. A missing function answers 404 / paused project 5xx (read as unavailable either way).
3. supabase-js 2.115.0 UMD path `dist/umd/supabase.js` on jsdelivr (SUPABASE.md measured the file; the CDN URL itself
   is unfetched).
4. `createClient(url,key,{auth,realtime})`, `channel(topic,{config:{broadcast:{self:false}}})`,
   `.on("broadcast",{event:"frame"},cb)`, `.subscribe(statusCb)` with SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED,
   `removeChannel`.
5. Broadcast event name `frame` (from the S1 sketch) and payload size limits.
6. Whether a channel can be joined with the publishable key and no user; private-channel authorization.
7. service_role bypasses RLS; `table_put` RPC semantics; pg_cron availability.
8. Dashboard labels and the Edge Function editor's multi-file and size limits (DEPLOY.md).

## Channel privacy (S3 question)

Seat topics carry a seat's own hand. Option A: private channels + RLS on `realtime.messages`, needs anonymous-auth
users and a JWT forwarded to `join`. Option B (simplest honest): public channels, topic derived from the seat key
(`topic` option already exists); secrecy equals a 256-bit name, anyone with it can listen and inject, cannot be
revoked. Details at the foot of `001_tables.sql`.

## Not done

Real-backend drive (nothing to call), the function entry file and bundle (S3), seat-key topics, presence-based
"opponent dropped" (the banner is a silence heuristic, 45 s without a frame while it is their turn), a mid-lobby
reload that lost an unopened sealed throw (the throw's opening lives only in memory).
