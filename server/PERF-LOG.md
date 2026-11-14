# PERF LOG — why a real two-phone server game felt "very slow" (2026-11-14)

Report (user): a real two-phone game through `?server=1` worked but was "very slow". Everything below is measured; each number names its source.
Machine: build sandbox (Node 22.23, Deno 2.9.6 via npm, Chromium 1243 via Playwright), egress through the agent proxy. Project `fokcpzplomjsraquaaid` (us-east-1).

## Step 1: server timing instrumentation (entry.template.ts)
Every response now carries headers `Server-Timing: ready, get, put, bc, app, total (ms)` and `x-table-meta: inst;seq;cold;rowb;nbc;up` (never the body). Rehearsal under Deno, both variants: ALL PASS (single cold 419 ms; folder cold 333 ms, 266 actions / 301 requests).

## Step 2: requests per action, offline fake (/tmp scratch script, 2 phones kayo v dash, page deal)
- Lobby/deal: 27 posts to reach ready (create 1, join 3 + 4 claim/heal, hello 4, hero 2, seedg 2, throw 4, open 4, seat 1, board 2).
- Mid-game: 260 actions = 260 requests, EXACTLY 1 request per action, no retries on the clean fake. Uplink 172 B avg per action; downlink grows with the log: 242 B at action 5, 2.1 KB at 100, 4.3 KB at 250 (the actor's own commit frames).
- Stored row (offline, 260 actions): 48,340 bytes.
