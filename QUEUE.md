# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAn5x4zoxKdGhex4st, 2026-11-25, at v7.07)

**DIRECTION (user, 2026-11-25, standing — supersedes 11-24's ordering):** "marching toward the finish line — less is more,
keep things simple, **let the gameplay be the main focus**. Once the necessary foundation is laid we focus on the **major
graphical interface changes**." So: small, player-felt foundation first (a game that runs smoothly from invite to recap);
the big visual redesign is the NEXT phase, not piecemeal now. AI strength stays on the back burner; a card that plays
wrong is still a bug: fix it.

**SHIPPED THIS CEO (CEO alone, no workers):**
- **v7.06** — the screen stays awake while a board is up (`useWakeLock`, script0; `Battle` + `TableBoard` call it): Screen
  Wake Lock, asked again on return from hidden, released on leave, silent where unsupported. page.js wake-lock row
  (stand-in `navigator.wakeLock`); sabotage (TableBoard's call removed) FAILS it 302/303. Function v164 stamped; livecheck ALL PASS.
- **v7.07** — *Share the table number* (`ShareCode`, script1b) under the number on the direct host and unranked server host
  screens: share sheet with the page's address, else copy (says so; blocked clipboard says so). Two page.js rows; sabotage
  (drop it from the direct host) FAILS. Sabotage FAILS both rows 303/305. Function v166 stamped; livecheck ALL PASS.
- Gates each release: npm test 4623/4618/0/5 · babel 4/4 · page.js all clean · serverpage 490/0 · livecheck ALL PASS.

**State:** live = **v7.07** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged (001..012).
Weekly sweep Mondays 06:17 UTC — glance at Monday's run. 70 merged `ship/` branches on origin (delete pushes refused).

**NEXT — the foundation, in order (each a release of its own; then the graphical phase):**
1. **Join from the link** — the shared text carries the page URL; add `?join=CODE` to it and have the page open straight
   on *Join a table* with the number filled (direct and server tables differ: the code's shape or a `&srv=1` says which).
   Strip the param after reading so a reload does not rejoin. Completes v7.07: a friend taps once, not types.
2. **End-of-game recap** — turns, damage dealt/taken, biggest hit, cards played, from state/traces on BOTH boards (never
   feed prose). The most visible gameplay polish left. Design it in a task file first; keep it one card, not a page.
3. **Your record on the hero tiles** — "×n · W–L" chip from `rec.mine` + `rec.pvp.mine` (nothing at 0); watch 320 width.
4. **Add to Home Screen** — static `manifest.webmanifest` + icons (`icons/` exists), `display: standalone`; check iOS
   standalone keeps PeerJS/Supabase and storage; `file://` ignores it.
5. Then **the graphical phase**: write `docs/GRAPHICS-PLAN.md` (from UI-GUIDE.md + POLISH.md), get the user's yes on the
   direction, and run it with parallel Sonnet workers (`experiments/WORKER-PROMPT-UI.txt`).
- Parked: matchmaking SQL 013 (re-query `select ranked, count(*), max(at) from public.seek_wait_log group by ranked`; was 0
  rows); presence (needs SQL + a user yes); serverpage's 9 px advisories; real-iPhone pass (DESKTOP-TASKS 1–10 + v7.06 the
  screen stays lit, v7.07 the share sheet).

**ASK THE USER (defaults standing — overrule any):** earlier defaults stand (QUEUE-ARCHIVE.md). NEW: the share button is
hidden on RANKED host screens (ranked is the queue); its text is "Join my Dawnblade table — table number XXXX. Open <url>,
tap Join a table and type it in." Presence waits on a yes.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05 handoffs). Lesson this CEO: while one release's
gates run, draft the next as a patch script in the scratchpad (never edit the tree under a running gate); run a sabotage
on a COPY of the tree (`tar --exclude=.git` into the scratchpad) in parallel with the real gates; deploy the function from
a `git worktree` at the shipped commit when the tree already holds the next release. Next letter: **AG**.
