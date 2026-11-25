# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAqQ8yBeZyP13vQUPa, 2026-11-25, at v7.02)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO (three Sonnet workers in parallel, joined by the CEO; old NEXT 2, 3, 4):**
- **v7.01** — *Text floor 9 px* (worker AC): 19 CSS rules raised to 9 px, nothing shrunk; tapsweep `TEXT_FLOOR` default 9
  (sabotage `TEXT_FLOOR=10`, 65 texts). CEO measured the 9 px zone chip in an 80 px hand card: max 66 px ("graveyard").
  *No Dummy in Play the AI* (worker AB): `FoePick noDummy={soloMode==="ai"}`; every drive picks opponent tiles by
  aria-label (page.js, tapsweep, promptsweep, page-audit); tapsweep reloads (title skipped) after visiting the AI door.
- **v7.02** — *Your heroes* (worker AD): `engine/local.js` record `v:2` = `{foes, mine:{heroKey|"unknown":{w,l,d}}}`; v1
  migrates on load (no write), its games under "unknown", never shown. Record tab lists *Your heroes* (×games, W–L).
- Gates (both): npm test 4613/4608/0/5 (v7.02); babel 4/4; page.js 299/299; serverpage 488/0 (~11 min); tapsweep 110/110.
  Function `table` v154 = v7.01, v156 = `v7.02 · sage-v19`, stamped; livecheck ALL PASS both. trainchaos not run (CSS only
  on the trainer). DESKTOP-TASKS two-iPhone pass: step 9 added.

**State:** live = **v7.02** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE** (AB, AC, AD sessions
idle; their ship/ branches are merged). SQL unchanged (001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (each a release of its own):**
1. **Matchmaking — SQL 013 (keep the queue place on a give-back): STILL NOT YET.** `seek_wait_log` (columns id, ranked,
   waited_s, at) held **0 rows** on 2026-11-25 (re-queried twice). Re-query before building:
   `select ranked, count(*), max(at) from public.seek_wait_log group by ranked`.
2. **Matchmaking UX while nobody else is online** (the real problem the empty log shows): the *Find an opponent* wait
   could say how many phones are looking right now / were seen today (one cheap count read, no new table if `seeks`
   holds it — check the 001..012 SQL first), so a lone player knows to practise instead of staring at a spinner.
   Needs a user ruling if it exposes any count publicly — default: an approximate "a few / nobody yet", never names.
3. **Record friendly/direct table games** locally (today only the AI is kept): same `mine` bucket or a separate `pvp`
   key in the v2 record (`engine/local.js`); the board call site is TableBoard's `recordResult` effect (gated `local`).
4. serverpage's SMALL advisory still lists 9 px texts under the found banner ("Who are you up against?", `.fname`):
   SMALL's own threshold is 10; harmless, but if the floor goes to 10 these are the first.
5. Ask the user to walk the real-iPhone pass (DESKTOP-TASKS.md two-iPhone section, steps 1–9) when they have two phones.

**ASK THE USER (defaults standing — overrule any):** all earlier defaults (v6.99 and v7.00 handoffs in QUEUE-ARCHIVE.md)
stand. NEW this CEO: the floor is 9 px everywhere on the page; *Play the AI* hides the Dummy tile (the title-skipped path
still shows it); *Your heroes* sums Sharp+Steady and shows a draw only when there is one; v1 history feeds per-foe totals
only, never a hero row.

**How to run the shop:** unchanged — see the v6.99 handoff's "How to run the shop" in QUEUE-ARCHIVE.md. Notes from this
CEO: workers report page.js FAILs when their sandbox lacks fonts (identical on the parent commit) — rerun the page drives
on the CEO side with the full `PAGE_DEPS` (fonts included) before trusting or doubting them. serverpage takes ~11-12 min:
background it, never cap it under 15 min. Ship separate releases one after another: push main, wait for Pages, deploy +
stamp + livecheck, then merge the next branch onto the updated main. Workers = Sonnet via create_session with
`experiments/WORKER-PROMPT-UI.txt` (edit the CEO session id in it). Next letter: **AE**.
