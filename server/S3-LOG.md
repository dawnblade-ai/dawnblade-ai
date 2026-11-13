# SERVER S3 — running log (branch `claude/amazing-franklin-ycg51z`, on v6.25 + S2)

Decisions (CEO, 2026-11-13): Supabase; casual-stage channel privacy = **Option B** (public channels, topic derived from the seat key);
the page's server door stays hidden until the function is deployed.

## What S3 is
1. **The switch.** `index.html` data script: `window.SERVER_TABLE = {on:false, url, key, fn:"table"}` (replaces `SERVER_CFG`).
   Off: "Join a server table" and its blurb are not rendered, `srvSit` returns, and `DawnServerTable.defaultTransport` hands back an
   inert transport (no request, no script tag). Drilled in `test/servertable.test.js` (source gate + transport) and
   `tools/serverpage.js` (shipped value, forced OFF, forced ON).
2. **Option B, end to end.** `sha256.js` gains `hmac`, `seatTopic(code, seat, key)` (= `table:<code>:<sha256 of code|seat|key>`) and
   `frameMac`. The referee pushes each seat on its derived topic with `{ver, frames, mac}`; the phone derives its own topic, never receives
   any topic, and `onPayload` ignores any push whose HMAC (under its seat key, over code/seat/ver/frames) does not verify. Chosen over
   "confirm by resync": a seal costs one hash and no round trip, and a listener who learns the name can read but cannot forge, so injection
   cannot change a client's game. Residual: replay of a genuine push is a repeated/lower `ver` (dropped or one resync); a flood of valid
   replays costs resyncs, not state. Drills: serverref (b) topics/seals/no-name-in-response + sabotage (cross-seat forward, key in name,
   name in frame); servertable (h) forged/unsealed/wrong-seal pushes ignored, replay harmless, sabotage (no seal check).
3. **Orphan seat closed.** An unkeyed `join` carries `claim` (128 random bits from `sha256.nonce()`, never `o.rand`). The referee saves
   seat + token in one write (`row.claims`) and answers a repeat with the same seat, key, counter, lobby. The phone retries a join that
   failed in the network (2 retries; a 404 is final). Drills: serverref (g) + sabotage; servertable (i) lost answer lands on same seat +
   sabotage (no token), 404/network retry counts.
4. **The function as files.** `tools/supabase-bundle.js` (zero deps) writes git-ignored `server/supabase/dist/`: `table.single.ts` and
   `supabase/functions/table/` (+ `config.toml` verify_jwt=false) from `server/supabase/entry.template.ts`. No eval, no file reads: the
   engine files are straight copies loaded by `import`, pool and page data wrapped byte-for-byte in a function. Build id computed in the
   function from the carried page data (`v6.25 · sage-v17` = `DawnLobby.buildId`). `--check` (stale generated copy or stale stamp),
   `--stamp` (tracked `server/supabase/DEPLOYED.json`, written after a deploy). Drills: `test/supabasebundle.test.js`.
   Sizes: single file 3,538,842 bytes; folder 3,538,290 bytes in 25 files (entry 9,294).
5. **Deno rehearsal.** `tools/supabase-rehearse.js` + `tools/supabase-stub.js` (PostgREST select, `table_put`, Broadcast endpoint stand-ins),
   Deno 2.9.6. Both variants played a full seeded game through `supabaseTransport.post` over real HTTP: fingerprint equals the in-process
   referee, both phones agree, every shuffle verifies, blindness scan clean, all pushes public/sealed/derived-topic, no function error.
   single: 319 actions, 352 requests, median request 24 ms, cold first answer 527 ms, largest row 58,496 B; folder: 341 actions, 375
   requests, median 26 ms, cold 359 ms, largest row 55,638 B. (Single deals from uid 100000 via the TABLE_UID0 test hook so the hidden-uid
   scan is sound; the folder run deals as deployed, uid from 0, because the catalog hash covers card uids.)
6. **Live checks** (publishable key only): recorded in `server/supabase/DEPLOY.md` "What was checked" and the comment block above
   `supabaseTransport`. Highlights: broadcast endpoint needs `apikey` (202), Bearer alone 401; limit 250,000 B (260,000 -> 422); public
   channel joins with no user, private refused; supabase-js statuses SUBSCRIBED/CLOSED/CHANNEL_ERROR; missing function = 404
   `{"code":"NOT_FOUND",...}` with ACAO `*`; jsdelivr/unpkg/cdnjs blocked by the sandbox proxy (UMD URL stays UNVERIFIED).
   Websocket worked from Node with `NODE_USE_ENV_PROXY=1`; not a browser.
7. **DEPLOY.md** rewritten (paths A and B, public/secret table, release check).
8. **SQL**: channel decision recorded, `grant all ... to service_role` stated, a self-check block; run on PGlite (WASM Postgres) with the
   three Supabase role names: self-check `ok`, `table_put` 1/0/2, anon refused.

## WIRE_V / row version / DATA_VER
- WIRE_V NOT bumped: no wire.js payload, prompt shape or top-level game key changed. The new `mac` rides the function's own broadcast
  envelope, `claim` its request envelope, `claims` the stored row.
- Row `v` 1 -> 2 (`ROW_V`, `claims`; the S2 `hub.lobLog` was never deployed, so it needs no separate bump). Old rows answer `refused:"wire"`.
- DATA_VER, APP_VER, CHANGELOG untouched.

## Not done / watch
- Nothing deployed; every deploy step is rehearsed offline only. Path B unverified (api.supabase.com blocked).
- `tools/serverrun.js` Deno list was not extended; the rehearsal is its own tool.
- The single file is 3.5 MB: whether the dashboard editor accepts it is UNVERIFIED.
