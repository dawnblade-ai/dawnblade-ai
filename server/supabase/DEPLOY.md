# DEPLOY — putting the referee on Supabase (DRAFT, UNVERIFIED)

> **Status.** Nothing here has been run. The build sandbox cannot reach Supabase, so every dashboard label,
> menu name and command below is written from memory of the product and must be checked against what you
> actually see. Where a step depends on code that does not exist yet (the function's entry file), it says so.
> The page works today without any of this: until a function answers, "Join a server table" says the server is
> not answering and offers the direct two-phone table.

**Project:** `https://fokcpzplomjsraquaaid.supabase.co` (public). The publishable key is already in `index.html`
(`window.SERVER_CFG`); it is meant to be public.

**Never paste a secret key into a chat, an issue, a commit or a file in this repo.** The only place a secret
goes is the dashboard's secrets screen (step 4), typed or pasted by you, on your own device.

## Steps (all doable from a phone, except step 3's CLI option)

1. **Open the project.** Go to supabase.com/dashboard, sign in, tap the project `fokcpzplomjsraquaaid`.
2. **Create the table.** Tap *SQL Editor* → *New query*. Paste the whole of `server/supabase/001_tables.sql`
   (on GitHub: open the file, tap the copy icon). Tap *Run*. You should see "Success". Then tap *Table Editor*
   and check a table named `tables` exists and shows a lock / "RLS enabled" and **no policies**. If it shows a
   policy, stop and ask: the row holds both seats' keys.
3. **Deploy the function** named `referee`. The entry file does not exist yet (stage S3 writes it from
   `server/supabase/entry.template.ts` and bundles `engine/*.js`, `server/referee.js` and `data/pool.js`, 1.4 MB).
   Two ways, once it exists:
   - *Dashboard:* *Edge Functions* → *Deploy a new function* → *Via Editor* (UNVERIFIED that the editor takes a
     multi-file bundle this size), name it `referee`.
   - *CLI, from a computer:* `supabase login`, then `supabase link --project-ref fokcpzplomjsraquaaid`, then
     `supabase functions deploy referee --no-verify-jwt`.
   **`--no-verify-jwt` matters:** the page calls the function with the publishable key in an `apikey` header,
   which is not a user's JWT. The function authenticates a *seat* by its seat key, never a user. (UNVERIFIED
   whether the platform accepts the key in `apikey` alone once JWT checking is off.)
4. **Secrets.** *Edge Functions* → *Secrets* (or *Project Settings* → *Edge Functions*). The function needs the
   project URL and the **service-role key** (a "secret" key in the newer dashboard). Supabase normally supplies
   both to every function automatically as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (UNVERIFIED); if the
   dashboard asks you to add them, add them *there*. Do not send them to anyone.
5. **Realtime.** *Realtime* → *Settings*. Broadcast must be on. Whether the channel is private (Option A) or
   public with unguessable names (Option B) is the S3 decision at the end of `001_tables.sql`; until it is made,
   do not turn on anything that lets a stranger subscribe to `table:*`.
6. **Match the page.** The function must deal exactly as the page does, or the two phones' handshake refuses
   with "card data mismatch" / "build mismatch":
   - `build` = `DawnLobby.buildId(APP_VER, DATA_VER)` for the page it serves — bump it on **every** page release
     (a stale function reads as "different versions of the game" on the lobby screen);
   - `deal(spec)` = `index.html`'s `JudgeRoom.deal` (`build.buildMatch` over `data/pool.js`, the catalog from the
     *builds'* deck, gear and start item — not from the dealt state), after
     `DawnCards.setCDN(window.CDN)` with the same address the page uses (a card carries its image address,
     and the catalog hash covers it). `tools/serverpage.js` builds its fake the same way and is the reference.
7. **Check it from the phone.** Open the game → *Find an opponent* → *Join a server table* → *Open a server
   table*. A six-character code should appear. If instead it says the service is not answering, the function is
   missing, paused, or answering something that is not the referee (open *Edge Functions* → `referee` → *Logs*).

## Rolling back

Delete nothing. To switch the page off the server, undeploy the function: the page then reads "not answering"
and offers the direct table. The `tables` rows can stay (they are small and expire if you enabled the optional
cleanup at the end of the SQL file).
