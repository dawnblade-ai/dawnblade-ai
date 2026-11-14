# PERF LOG — why a real two-phone server game felt "very slow" (2026-11-14)

Report (user): a real two-phone game through `?server=1` worked but was "very slow". Everything below is measured; each number names its source.
Machine: build sandbox (Node 22.23, Deno 2.9.6 via npm, Chromium 1243 via Playwright), egress through the agent proxy. Project `fokcpzplomjsraquaaid` (us-east-1).

## Step 1: server timing instrumentation (entry.template.ts)
Every response now carries headers `Server-Timing: ready, get, put, bc, app, total (ms)` and `x-table-meta: inst;seq;cold;rowb;nbc;up` (never the body). Rehearsal under Deno, both variants: ALL PASS (single cold 419 ms; folder cold 333 ms, 266 actions / 301 requests).

## Step 2: requests per action, offline fake (/tmp scratch script, 2 phones kayo v dash, page deal)
- Lobby/deal: 27 posts to reach ready (create 1, join 3 + 4 claim/heal, hello 4, hero 2, seedg 2, throw 4, open 4, seat 1, board 2).
- Mid-game: 260 actions = 260 requests, EXACTLY 1 request per action, no retries on the clean fake. Uplink 172 B avg per action; downlink grows with the log: 242 B at action 5, 2.1 KB at 100, 4.3 KB at 250 (the actor's own commit frames).
- Stored row (offline, 260 actions): 48,340 bytes.

## Step 3: LIVE function, Node phones (tools/perf-live.js, 120 actions kayo v dash, no think time; instrumented function v6, 2026-11-14)
Per request (client wall): median 194.7 ms, p95 354, max 2434. Function itself (Server-Timing total): median 116.5, p95 204. Split (medians): row SELECT 29.6, table_put 35.3, broadcast call 30.6, app (parse+rehydrate+apply) 19.4. Client minus function (network + gateway): median 71 ms, p95 137.
1 request per action (120/120). Bytes: up 167 B median; down median 247 B, p95 3.5 KB; stored row 25 KB median, 35 KB max at 120 actions.
Cold: 4 of 151 requests were the first on a new instance (331-445 ms each, function app 98 ms + ready 39 ms); 5 instances served the one game.
Conflicts (version races): 5 of 151 requests, 5 of the first 27 lobby requests... (lobby hello/hero/throw); each costs a jittered 60-180 ms pause + a retry.
Tail: 2 of 120 actions took 1.3 s and 2.4 s (one was Postgres table_put = 1844 ms inside the function, one pure network: function total 128 ms).
Push: the function awaits the broadcast before answering, so the OTHER seat's push arrives a median -10 ms vs the actor's own answer (131 of 137 pushes arrive BEFORE the answer); POST sent -> other seat's websocket message: median 187 ms, p95 326.
=> from Node the server table is ~200 ms per move both ways. This does not explain "up to 5 seconds".

## Step 4 (user detail: "up to 5 s between pressing the button and the other player receiving the move"): THE REAL BROWSER
Chromium (Playwright 1.63) CAN open a websocket to wss://fokcpzplomjsraquaaid.supabase.co/realtime/v1/websocket through the proxy (open in 208 ms), so a live page drive is possible (tools/perf-page.js live).
ROOT CAUSE, reproduced on the real page v6.26 against the live function: `engine/servertable.js loadSupabase(o)` set `el.src = o.url || SUPABASE_JS`, and `supabaseTransport` calls `loadSupabase(config)` where `config.url` is the PROJECT address. The page therefore requested
`<script src="https://fokcpzplomjsraquaaid.supabase.co/">` (the project root, a 404 JSON body; Chromium: net::ERR_BLOCKED_BY_ORB), supabase-js never loaded, `window.supabase` stayed undefined, NO websocket was ever created (0 `ws-new` events in the page), the status read "Lost touch - trying again...". Every Node drill/rehearsal passed `lib:` so the CDN path was never run.
Consequence in v6.26: in a browser there is NO push, ever. Fallbacks: heal poll `pollMs: 20000` only. And `ingest` never moved a "reconnecting" channel to "seated", so the host's lobby stayed shut: in the live drive the page (host) was still on "Lost touch" with the guest seated 90 s later (polls every 20 s answered 200 but changed nothing).
(The user's game "worked": not explained by this drive; open question in the final report.)

## Step 5: the real page (Chromium 393x852, CPU throttled 4x via CDP), tools/perf-page.js
Page-side cost (main-thread TaskDuration per move incl. React render, 4x throttle): offline fake with 200 ms/post + 150 ms/push, 172-action game (ended there): own move median 58 ms (p95 87), incoming frame median 55 ms (p95 77); by quarter of the game 55 / 56 / 58 / 63 ms: FLAT, no growth with game length (no whole-log replay per frame). Sampled: action 10 = 58 ms, action 100 = 59 ms (action 250 not reached on this deal: the game ended at 172).
Live function, page fixed (the websocket opens in Chromium through the proxy, `ws-new`, `ws-open` +400 ms), 60 actions: page's own move -> its board 303 ms median (p95 380); page move -> the OTHER seat sees it 252 ms (p95 332); other seat's move -> page sees it by push 240 ms median (p95 423); page cost 63 ms median per move at 4x. Lobby to board 4.2 s (incl. 1.5 s of my own fixed wait).
NO-PUSH on the real page (--nopush: the subscription reads lost and nothing arrives, which is what every v6.26 browser got):
- v6.26 behaviour: host lobby never opened in 90 s against the live function (stuck "Lost touch"); with a silently dead push (subscription claimed joined) the other seat's move reached the page after 19.4 s median (max 19.8), lobby to board 80 s (the 20 s idle poll is the only fallback).
- fixed (fallbackMs 2000): lobby to board 8.1 s, other seat's move seen by the page after 1.4 s median, 2.0 s max (a 2 s poll + a 200 ms post).
Cost of the fallback: one function call (a row SELECT, ~120 ms of function time) per phone per 2 s ONLY while the push subscription is not joined; it stops when one joins. A 20 minute game on a phone with no push = 600 calls; the free tier's 500,000 invocations a month = about 800 such phone-games.
Not found as causes: page replay/render storms, whole-state hashing (task time flat), timers near 5 s (the only 5 s timer is `probeMs`, used when posts fail), the actor's own tap waits only on its own POST (one frame in flight; 1 request per action measured live and on the fake).

## Step 6: fixes, validation, deploy state
Fixes (page files, so they ship with the next release; APP_VER NOT bumped, WIRE_V not changed, no envelope/row shape changed):
- engine/servertable.js `loadSupabase`: script address is `o.libUrl || SUPABASE_JS` (was `o.url`, the project address). Drill: test/servertable.test.js "PERF: the library is loaded from the pinned CDN address..." (sabotage: the old line is applied to a copy and must take the project URL).
- `fallbackMs` (page sets 2000): while the push subscription is not joined, `heal()` every 2 s; stops with the table. A successful heal (the table answered) takes a "reconnecting" channel back to waiting/seated, so a host's lobby opens. `report().push` = "joined" | "polling" (the debug status). The library load is retried every 10 s (was never). Drills: "PERF: with no push the other seat is still heard within one fallback tick..." (sabotages: fallback 0; the status clearing removed) and tools/serverpage.js row "push lost: the other seat's move still reaches the page by the fallback poll" (1036 ms; sabotaged with fallbackMs 0 -> fails). The old "reconnecting banner" drive row is replaced by it (the banner no longer sits on while the table answers).
Function: ONLY the timing headers changed (bundle digest cad9599e6d9e); deployed as version 6 (compatible with the live v6.26 page: bodies and shapes unchanged). Live game on it: 323 actions, 357 requests, median 206 ms, p95 441, cold first 763 ms; fingerprints = in-process referee, shuffles verify true/true, blindness scan clean, 337 pushes on 2 topics, wrong key refused. `--stamp` run, `--check` OK.
Validation: npm test 4185 / pass 4180 / fail 0 / skipped 5; scenes 107 passing 0 failing; fairness nothing found; serverrun --isolate ALL PASS; serverpage 70 passed 0 failed; both text/babel blocks compile (2 blocks, 0 errors); rehearsal (Deno) ALL PASS.


## v6.27 release (2026-11-14)
- Bundle v6.27 · sage-v17, digest 98ee78422715; `--check` before deploy STALE (stamp v6.26) as expected; Deno rehearsal both variants ALL PASS (single cold 513 ms, folder cold 333 ms).
- Deploy `POST /v1/projects/{ref}/functions/deploy?slug=table` (folder) -> 201, version 7, ACTIVE, verify_jwt false. Health x3: `{"service":"dawnblade-table","build":"v6.27 · sage-v17"}`.
- Live two-client game on it (Node, real HTTP + Realtime): 275 actions, 309 requests, median 205 ms, p95 430, max 2933, cold first 783 ms; fingerprints = in-process referee, shuffles true/true, blindness scan clean, 289 pushes on 2 topics, wrong key refused.
- Live REAL PAGE (Chromium, 4x CPU throttle, websocket through the proxy), 80 actions: the other seat's move reached the page by push every time (33 of 33 by websocket, 0 by poll): median 234 ms, p95 475, max 538; page move to its own board median 284 (p95 428); page move to the other seat median 230 (p95 315); page task time 61-70 ms median per move; lobby to board 4.3 s (includes a 1.5 s fixed wait of the driver).
- `--stamp` -> DEPLOYED.json v6.27 · sage-v17 98ee78422715; `--check` OK.
- CONSEQUENCE: until `main` is pushed, live v6.26 pages (build `v6.26 · sage-v17`) cannot handshake with the function ("different versions of the game"); the door is testers-only (`?server=1`), so only testers meet it.
- Validation on the final v6.27 tree: npm test 4186 / pass 4181 / fail 0 / skipped 5; scenes 107 passing 0 failing; fairness nothing found; serverrun --isolate ALL PASS; serverpage 71 passed 0 failed; both text/babel blocks compile (2 blocks, 0 errors); `supabase-bundle.js --check` OK (98ee78422715).
