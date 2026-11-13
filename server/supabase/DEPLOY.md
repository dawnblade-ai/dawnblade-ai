# DEPLOY — the hosted referee on Supabase

**State today:** built and rehearsed, **not deployed**. The page's "Join a server table" is switched **off**
(`window.SERVER_TABLE.on = false` in `index.html`), so nobody can reach a half-finished door. Two steps turn it on:
deploy the function (below), then flip that one value in a release.

**Project:** `https://fokcpzplomjsraquaaid.supabase.co`

## What is public and what is secret

| value | public? | where it lives |
|---|---|---|
| project URL `https://fokcpzplomjsraquaaid.supabase.co` | public | `index.html` (`SERVER_TABLE.url`) |
| publishable key `sb_publishable_…` | **public** by design | `index.html` (`SERVER_TABLE.key`) |
| **service-role / secret key** | **SECRET** | only the function's own environment (Supabase provides it) — never in a repo, a chat, a commit, an issue |
| **Supabase access token** (`sbp_…`, for path B) | **SECRET** | only the cloud environment's secure credential form — never in chat |
| a table's seat keys, channel names, claim tokens | secret per table | the `tables` row, which only the function can read |

Nothing in this repo is secret. `server/supabase/dist/` (generated) holds code and the public config only.

## What gets deployed (two generated forms of the same function)

`node tools/supabase-bundle.js` (plain Node, no install) cuts `server/supabase/dist/` — git-ignored, so it is **not on
GitHub**; run it in a checkout, or ask Claude to cut it and hand you the file.

- `dist/table.single.ts` — ONE file (about 3.5 MB), nothing to upload but itself. For the dashboard editor (path A).
- `dist/supabase/functions/table/` — the same code as a folder (`index.ts` plus straight copies of the engine files) and
  `dist/supabase/config.toml` (`verify_jwt = false`). For the CLI (path B).

The function is named exactly **`table`** (the page calls `/functions/v1/table`). It uses no `eval` and reads no files.

## Path A — dashboard only (works from a phone)

1. **Create the table.** Dashboard → project → **SQL Editor** → **New query** → paste all of
   `server/supabase/001_tables.sql` (GitHub: open the file, copy icon) → **Run**. The last result is one row,
   `ok` (the file checks itself: row-level security on and forced, no access for `anon`/`authenticated`, the
   compare-and-set function behaves). Then **Table Editor** → `tables` should show RLS enabled and **no policies**. A policy
   there means stop and ask: the row holds both seats' secrets. *(If the self-check's first insert fails with a
   row-level-security error, the editor's role does not bypass RLS; tell Claude, the deploy itself is unaffected.)*
2. **Create the function.** **Edge Functions** → **Deploy a new function** → **Via Editor** → name it `table` → select
   everything in the editor, paste `table.single.ts` → **Deploy**. *(UNVERIFIED: that the editor accepts a file this
   size from a phone. If it chokes, use path B, or ask Claude to hand you the folder.)*
3. **Turn JWT verification OFF for `table`.** Edge Functions → `table` → **Details/Settings** → the toggle named
   **Verify JWT** (the newer dashboard words it "Verify JWT with legacy secret"; UNVERIFIED label) → **off** → save.
   *Why:* the page calls the function with the publishable key in an `apikey` header, which is not a user's JWT, so a
   function that insists on a JWT turns every player away. The function authenticates a **seat** by its seat key, never a user.
4. **Secrets: normally nothing to do.** Supabase hands every function `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   *(UNVERIFIED on projects using the newer API keys.)* If the function's **Logs** say it "has no SUPABASE_URL / service
   key", open **Edge Functions → Secrets** and add `TABLE_SERVICE_KEY` = the project's service-role (secret) key,
   pasted by you, on your device. Do not send it to anyone.
5. **Realtime: nothing to do** unless you changed defaults. Seats listen on **public** channels with unguessable names;
   the project's Realtime must allow public channels (the default; **Realtime → Settings → "Allow public access"** if
   shown). Do not switch Realtime to private-only.
6. **Check it.** Open `https://fokcpzplomjsraquaaid.supabase.co/functions/v1/table` in a browser: expect
   `{"service":"dawnblade-table","build":"v6.25 · sage-v17"}` (the build must equal the page's, shown in-game). If the
   browser says a key is needed, that is the gateway; the game itself sends it (UNVERIFIED which way the gateway asks).
7. **Switch the page on.** Tell Claude "turn the server table on": a release sets `on: true`. Then open the game, *Find an
   opponent* → *Join a server table* → *Open a server table*: a six-character code appears. If it says the service is not
   answering, read `table`'s **Logs**.

## Path B — CLI or Management API, from the cloud environment

Needs the environment's network to allow `api.supabase.com` (the Management API and the CLI both use it) and, to
install the CLI, the host(s) its npm package downloads a binary from (`github.com`, `objects.githubusercontent.com` —
UNVERIFIED which). `fokcpzplomjsraquaaid.supabase.co` already works from the sandbox. *Today `api.supabase.com` and
`supabase.com` are blocked there and nothing in this path has been run.*

1. **Allow the hosts** (the environment's network settings; Claude can propose the exact edit, you approve it).
2. **Give Claude the access token the safe way.** Create a personal access token (dashboard → account → Access Tokens), then
   let Claude open the environment's **secure credential form** for host `api.supabase.com` and paste it **there**.
   Never in chat. Revoke the token when the deploy is done.
3. Claude runs, in a checkout:
   ```sh
   node tools/supabase-bundle.js
   cd server/supabase/dist
   supabase db query --linked -f ../001_tables.sql        # or paste the SQL in the dashboard (path A step 1)
   supabase functions deploy table --project-ref fokcpzplomjsraquaaid     # config.toml already says verify_jwt = false
   ```
   (the proxy injects the token; every command is UNVERIFIED here). The Management API equivalents are
   `POST /v1/projects/fokcpzplomjsraquaaid/database/query` and `POST /v1/projects/fokcpzplomjsraquaaid/functions/deploy?slug=table`.
4. Then steps 3 (JWT off, if the CLI did not apply `config.toml`), 6 and 7 of path A.

## Every release after that (the function must match the page)

A page of another release than the function reads as "different versions of the game" on the lobby screen. So, with every release
that changes `APP_VER`, `DATA_VER`, the pool, or any engine file the function loads:

```sh
node tools/supabase-bundle.js --check     # exit 1 = STALE; it says whether the generated copy or the deployed stamp is old
node tools/supabase-bundle.js             # regenerate
# redeploy (path A step 2 or path B step 3), then record it:
node tools/supabase-bundle.js --stamp     # writes server/supabase/DEPLOYED.json — commit it
```
`--check` also fails if the stamp is older than the tree, which is how a forgotten redeploy shows up. Before the first
deploy there is no stamp; `--check` then compares the generated copy only.

## What was checked, and what was not (2026-11-13; publishable key only, from the build sandbox through its egress proxy)

**VERIFIED against the real project**
- A function that does not exist answers HTTP 404 JSON `{"code":"NOT_FOUND","message":"Requested function was not found"}`,
  header `sb-error-code: NOT_FOUND`, `access-control-allow-origin: *` (POST with or without `apikey`, and OPTIONS). The page reads any non-2xx as "unavailable".
- Realtime over the HTTP endpoint: `POST /realtime/v1/api/broadcast` **needs the `apikey` header** (the publishable key works, status 202,
  no `Authorization` needed); `Authorization: Bearer <key>` alone and no header both answer 401 "No API key found in request". Body
  `{"messages":[{"topic","event","payload","private"}]}`; a missing `event` answers 422.
- Payload size: 1 KB, 32 KB, 80 KB, 100 KB, 150 KB, 200 KB and 250,000 bytes accepted (202); 260,000 and above answers 422
  `Payload size exceeds tenant limit`. The function refuses to send above 240,000. The largest push in a rehearsed game was about 23 KB.
- supabase-js 2.115.0 (Node 22, through the proxy with `NODE_USE_ENV_PROXY=1`): `createClient(url, publishableKey)` joins a **public**
  broadcast channel with no user; status strings seen: `SUBSCRIBED`, then `CLOSED` after `removeChannel`; two clients on one topic
  exchanged a client `send` (so any client can publish into a public channel: the reason pushes are sealed) and HTTP-endpoint pushes
  reached both, up to 248 KB; a topic `table:<code>:<64 hex>` joins; a **private** channel without a user is refused (`CHANNEL_ERROR`,
  "Unauthorized: You do not have permissions to read from this Channel topic"). The page's own `supabaseTransport.subscribe` received a
  sealed payload this way.
- `001_tables.sql`, run on PGlite (a WASM Postgres) with Supabase's three role names created: runs, self-check prints `ok`, `table_put`
  returns 1 / 0 / 2 for create / stale / update, `anon` is refused the table and the function.
- The generated function, under Deno 2.9.6, against local stand-ins for PostgREST and the Broadcast endpoint: `tools/supabase-rehearse.js`.

**STILL UNVERIFIED (could not be checked without a secret, a deployed function or a browser)**
- That a deployed function accepts the publishable key in `apikey` alone with Verify JWT off, and its CORS preflight (the function answers OPTIONS itself).
- Dashboard labels (Verify JWT, Allow public access, the editor's accepted size) and the Edge Functions' own limits (CPU time, memory, bundle size) for a 3.5 MB bundle that builds a 797-card database on a cold start (about 0.4 to 0.7 s under Deno locally).
- That `SUPABASE_SERVICE_ROLE_KEY` is provided on this project (new API keys), and PostgREST's behaviour with a new-style key (`sb_secret_…`, sent in `apikey` alone).
- jsdelivr's UMD URL for 2.115.0: the file exists in the npm package and defines the global `supabase`, but the sandbox proxy blocks `cdn.jsdelivr.net` (403), so no HEAD request could be made.
- A real browser's websocket to Realtime (only Node was exercised); `TIMED_OUT` status; behaviour at the free plan's connection and message quotas.
- Everything in path B (`api.supabase.com` is blocked in the sandbox).

## Known limits of the casual stage (see `001_tables.sql` for the channel decision)
- Public channels: anyone who learns a seat's channel name can listen to that seat's hand and cannot be revoked; they cannot forge a frame (every push is sealed under the seat key). Private channels with sign-in are S4.
- The function is callable by anyone who knows the project URL (JWT verification is off): a stranger can open empty tables. Forget old rows with the optional `pg_cron` job at the end of `001_tables.sql`; real abuse limits come with sign-in.

## Rolling back
Delete nothing. Set `on: false` in a release (the page stops offering it), or undeploy the function (the page then reads "not
answering" and offers the direct table). Table rows are small and the optional cleanup job expires them.
