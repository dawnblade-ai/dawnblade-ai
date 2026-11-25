# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAX44vpAEVDHqYmyye, 2026-11-25, at v7.04)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO (two Sonnet workers in parallel, joined by the CEO; old NEXT 2, 3):**
- **v7.03** — *Who else is looking* (worker AE): a waiting seek answer carries `looking` = none|one|few(2-4)|many(5+)
  (other live untaken seeks of the same kind, from SQL 009's `seek_count` minus your own; server/referee.js
  `crowdWord`). The seek card says it in words, never a number; on "none" it offers *Play the AI while you wait* at
  once. No SQL, WIRE_V unchanged. NOTE: a friendly seeker hears "nobody" almost always BY CONSTRUCTION (another untaken
  friendly seek would have matched); the bigger words show only for ranked seekers outside each other's window.
- **v7.04** — *Against people* (worker AF): `engine/local.js` record `v:3` = v2 + `pvp:{mine,foes,seen}`; TableBoard
  records a finished friendly/direct game once per phone (game id = table|seedC|seedG kept in `seen`, last 40); ranked
  NOT recorded locally (the Ranked card has it). Record tab: *Against people* (total + rows by the hero you played).
- Gates (CEO side, both): npm test 4614/4609/0/5 (v7.03), 4623/4618/0/5 (v7.04); babel 4/4; page.js 299/299 then
  302/302; serverpage 490/0 both; Deno rehearsal ALL PASS. Function `table` v158 = v7.03, v160 = `v7.04 · sage-v19`,
  stamped; livecheck ALL PASS both. CI `drills` on the v7.04 stamp commit was still running at handoff: glance at it.
  DESKTOP-TASKS two-iPhone pass: step 10 added.

**State:** live = **v7.04** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE** (AE, AF idle; their
ship/ branches are merged — the CEO's delete push was refused, leave them). SQL unchanged (001..012).
`seek_wait_log` re-queried 19:40 UTC: still **0 rows**. Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (each a release of its own):**
1. **Matchmaking — SQL 013 (keep the queue place on a give-back): STILL NOT YET** (0 rows). Re-query before building:
   `select ranked, count(*), max(at) from public.seek_wait_log group by ranked`.
2. **Presence ("phones on the Find screen"), so the friendly wait can ever say more than "nobody"** — AE's finding. A
   heartbeat needs SQL (a tiny `presence` table or a `seen_at` on players, TTL'd) and a ruling-light default: same
   approximate buckets, never names. Only worth it if the user wants it — ask; until then the honest "nobody" stands.
3. **Show the by-opponent-hero pvp counts** (`pvp.foes` is stored, not shown) — e.g. a tap on *Against people* opens
   "against whom"; tiny UI release.
4. serverpage's SMALL advisory still lists 9 px texts ("Who are you up against?", `.fname`) — harmless at floor 9.
5. Ask the user to walk the real-iPhone pass (DESKTOP-TASKS.md two-iPhone section, steps 1–10) when they have two phones.

**ASK THE USER (defaults standing — overrule any):** all earlier defaults stand (QUEUE-ARCHIVE.md). NEW this CEO: the
wait word is approximate buckets only (none/one/few/many, "many" at 5+ others); the lonely nudge + AI button shows at
once when nobody else is looking; ranked games are not kept in the local record (Ranked card shows them); *Against
people* rows are by the hero YOU played; record v3 is not readable by an older build (matters only on a downgrade).

**How to run the shop:** unchanged — the v6.99 handoff's "How to run the shop" in QUEUE-ARCHIVE.md. Worked well this
CEO: two parallel workers on disjoint files; join one at a time onto updated main (merge, bump APP_VER, CHANGELOG, npm
test, babel, page.js + serverpage chained in ONE background command ~17 min, push, curl until Pages serves the APP_VER,
`tools/supabase-deploy.js` — DEPLOYED.json lives at `server/supabase/DEPLOYED.json` — commit, push, livecheck).
`engine/local.js` is in the function bundle: a record change needs a redeploy too. Workers = Sonnet via create_session
with `experiments/WORKER-PROMPT-UI.txt` (edit the CEO session id in it). Next letter: **AG**.
