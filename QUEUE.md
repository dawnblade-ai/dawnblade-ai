# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAuThfeKyJFDbK32Gd, 2026-11-25, at v7.00)

**DIRECTION (user, 2026-11-24, standing): the AI logic is on the BACK BURNER**; lead with **graphical UI / UX polish and
matchmaking**. Do not open AI-strength probes. A card that plays wrong is still a bug: fix it.

**SHIPPED THIS CEO: v7.00** (page only; no engine, rule, wire, AI or SQL change) — old NEXT 1 and NEXT 3:
- **Text floor = 8 px**, measured on the board at 393 and 320: only the card-type chip `.b-typ` was under it (7 / 6 px). At
  8 px it is wider than the gap between the power/defense badges, so on a card that prints either it sits above them
  (`.cfw:has(.b-atk,.b-def)`; 0 overlaps both widths). Gate: tapsweep's `text floor WxH` row (page.js, both sizes);
  sabotage `TEXT_FLOOR=9 node tools/tapsweep.js 393x852` fails on 48 texts (these are the 8–9.5 px list if you raise it).
- **Your record**: a fourth button under the title's modes (the four "more" buttons are now 2x2) and a *Record* tab: AI
  record per foe from `DawnLocal.loadRecord` (Sharp+Steady summed), Dummy clears, and for a signed-in phone *Show my ranked
  games* (rating, place, W–L, an SVG rating line from `mine` read backwards from today's rating, heroes played most). Reads
  the ladder only on that button. `srvTransport` (script0) is now the ONE builder of the server transport (servertable drill).
- Gates: npm test 4609/4604/0/5; page.js 295/295; serverpage 488/0 (~700 s); babel 4/4; trainchaos not run (CSS only on the
  trainer). Function `table` v152 = `v7.00 · sage-v19`, stamped; livecheck ALL PASS. DESKTOP-TASKS two-iPhone pass: step 8.
- **GitHub Pages hiccup:** the first v7.00 Pages deploy failed with a GitHub 500 and the rerun API 500'd too; a fresh push to
  main rebuilt it. If the page does not serve the new APP_VER within ~3 min, check the "pages build and deployment" run.

**State:** live = **v7.00** on `main`. WIRE_V 49, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged (001..012).
Weekly sweep `.github/workflows/tapsweep-weekly.yml` (Mondays 06:17 UTC) — glance at Monday's run.

**NEXT (each a release of its own):**
1. **Matchmaking — keep the queue place on a give-back (SQL 013): NOT YET.** Live `seek_wait_log` held 0 rows for the last
   7 days (queried 2026-11-25): no one has been matched through the queue, so there is no evidence give-backs matter.
   Re-query (`select ranked, count(*) from public.seek_wait_log group by ranked`) before building it.
2. **Play the AI still offers the Dummy tile** on the opponent step. Harmless, left on purpose: ~10 drives pick `.aifoe button`
   by POSITION (page.js 633/777/859, tapsweep 54-55, promptsweep 85/221, page-audit 158). First move them to aria-label
   pickers (page.js:377 already has the pattern), then hide the tile when `soloMode==="ai"`.
3. **Text floor 9?** The 48 texts at 8–9.5 px (`.hlbl` hand-rail labels 8, `.wempty` 8, `.fname` 8.5, opponent-step / loadout
   pane flags 8.5, `.bugmeta`, prompt `.sub` 9.5) — raise per class with board-width checks, then set TEXT_FLOOR=9.
4. **Your record, deeper:** the AI record is keyed by FOE only; "favourite heroes" vs the AI needs the player's own hero in
   `recordResult` (engine/local.js — a record shape change: `v:2`, migrate v1). Friendly/direct games are not kept anywhere.
5. Ask the user to walk the real-iPhone pass (DESKTOP-TASKS.md two-iPhone section, steps 1–8) when they have two phones.

**ASK THE USER (defaults standing — overrule any):** all earlier defaults (see the v6.99 handoff in QUEUE-ARCHIVE.md) stand.
NEW this CEO: the floor is 8 px; the type chip moves above the badges rather than shrinking; *Your record* is a title button
AND a fourth bottom tab (*Record*); the ranked card loads only on a tap; the rating line covers the last 10 ranked games.

**How to run the shop:** unchanged — see the v6.99 handoff's "How to run the shop" in QUEUE-ARCHIVE.md (PGlite, Deno rehearsal,
page drives with `PAGE_DEPS`, babel on all 4 blocks, SQL on live through the proxy with `Authorization: Bearer dummy`, after
pushing main: curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit
DEPLOYED.json, THEN `node tools/livecheck.js`). A CSS edit early in index.html moves `test/slicecensus.test.js`'s phasebar pin
(read the diff, repin the one number). Workers = Sonnet via create_session with `experiments/WORKER-PROMPT-UI.txt` (edit the CEO
session id in it). Next letter: **AB**.
