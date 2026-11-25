# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9DXLn3m3oYiBkfzrH, 2026-11-25, at v7.05)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO (CEO alone, no workers):**
- **v7.05** — *Against whom?* (old NEXT 3): a button under *Against people* on the Record tab lists the same games by the
  hero ACROSS the table (`pvp.foes`), "vs <hero> ×n W–L(–D)"; tap again hides. Page only. page.js row extended (hidden
  before the tap, one row, fits 393, 44 px); sabotage (read `pvp.mine`) FAILS it (301/302), restored.
- Gates: npm test 4623/4618/0/5; babel 4/4; page.js 302/302; serverpage 490/0 (611 s). Function `table` v162 =
  `v7.05 · sage-v19`, stamped; livecheck ALL PASS. CI `drills` green on the v7.04 stamp (v7.05's was running at handoff).
- Housekeeping: CLAUDE.md's doc map now lists `HIDDEN-HANDS.md` (cited by six engine modules, was missing).
  DESKTOP-TASKS step 10 gains the v7.05 tap. `seek_wait_log` re-queried: still **0 rows** (2026-11-25 evening).

**State:** live = **v7.05** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). 70 merged `ship/` branches remain on origin (delete pushes are refused; leave them). Weekly sweep Mondays
06:17 UTC — glance at Monday's run.

**NEXT (each a release of its own; ranked by what a player would notice per hour of work):**
1. **Keep the screen awake at a table** (`navigator.wakeLock.request("screen")` while a table/trainer game is mounted,
   released on leave/visibility; iOS Safari 16.4+; silently nothing where unsupported). A phone dimming mid-turn is real.
2. **Share the table code** with the phone's share sheet (`navigator.share`, falling back to the existing clipboard copy)
   on the direct-table host screen. Friends are the matchmaking we have while the queue is empty.
3. **Your record on the hero tiles**: a small "×n · W–L" chip on each hero in the grid from `rec.mine` + `rec.pvp.mine`
   (nothing when 0). Pure read; watch the tile width at 320.
4. **End-of-game recap**: turns, damage dealt/taken, biggest hit, cards played — from state/traces, both boards, never
   feed prose. Medium; the most visible polish left. Design it in a task file first.
5. **Add to Home Screen**: a static `manifest.webmanifest` + icons (`display: standalone`), no build step; check iOS
   standalone does not break PeerJS/Supabase or `file://` (manifest is ignored there).
6. **Matchmaking SQL 013: STILL NOT YET** (0 rows): `select ranked, count(*), max(at) from public.seek_wait_log group by ranked`.
7. **Presence** for the friendly wait (AE's finding): needs SQL + a user yes. Ask; until then the honest "nobody" stands.
8. serverpage's SMALL advisory 9 px texts — harmless at floor 9. Real-iPhone pass (DESKTOP-TASKS steps 1–10) when the
   user has two phones.

**ASK THE USER (defaults standing — overrule any):** all earlier defaults stand (QUEUE-ARCHIVE.md). NEW: *Against whom?* is
behind a tap (not always shown) to keep the Record page short; rows say "vs <hero>". Presence (NEXT 7) waits on a yes.

**How to run the shop:** unchanged — QUEUE-ARCHIVE.md (the v6.99 and v7.04 handoffs). This CEO: one small release alone
is cheapest — edit, babel, then npm test → page.js → serverpage chained in ONE background command (~25 min), a sabotage
page.js run after, push main, curl until Pages serves the APP_VER, `tools/supabase-deploy.js` (--dry-run first; every
APP_VER bump redeploys, page-only or not), commit DEPLOYED.json, livecheck. For two+ items use parallel Sonnet workers
(`experiments/WORKER-PROMPT-UI.txt`, edit the CEO session id). Next letter: **AG**.
