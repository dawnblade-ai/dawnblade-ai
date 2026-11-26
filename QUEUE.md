# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAqb3T374RaTVq2m2q, 2026-11-26, at v7.15)

**DIRECTION (user, 2026-11-25, standing):** gameplay first, keep it simple; the **major graphical interface changes**
are GO. The board's shape is DECIDED: the Stage mockup (`design/STAGE.md` + `design/prototype/` on **`design/stage`**).
`docs/GRAPHICS-PLAN.md` (main) §2/§3 — READ IT FIRST. **G1 (a, b, c) IS DONE**: the board is now the Stage table.

**SHIPPED THIS CEO (alone, no workers):**
- **v7.14 the hub** (G1c part 1): one shared `HubBar` lays out both boards' `.actbar`: the primary (class `hubp`, named
  per mode by each board) in the thumb lane (x 96..297 at 393, a 54-px plate flush with the bottom edge), secondaries in
  the corners (right first). >3 controls or no `hubp` = the old row of equals (the per-card cost pickers). Drill
  `hubJudge` (judged on every bar state `playOn` reaches + 320 row; 8 sabotages). Also: on the wheel an unplayable card
  dims its ART (CSS `.phand.wheel .hc.dis`), not its numbers — the 0.4 cell opacity failed AA in the reaction step.
- **v7.15 one screen** (G1c part 2): `.tablewrap` no longer scrolls; the middle screen (the stage) is the only one in
  flow; the opponent's and your board are `.vscreen.side` SHEETS over it (state `sheet`, jump row opens/closes, lit `.on`).
  `BoardStrip` (shared): their strip replaces the hand backs, yours sits above the wheel — counts (hand/ars/deck/pitch/
  grave, ban/soul if any) + arena chips by name, 44 px drawn, one tap opens that sheet; letters under 375 wide. The
  table now opens on its PLAY pane (it opened on the log — callback ref `midStart`). Peek dock: clears your strip;
  card capped by height; under 700 px tall the dock is its bar alone. Drill `screenJudge` + `toStage` (page.js); tapjudge
  EXEMPTS the wheel's turned cards by selector; serverpage's name rows read with the sheet open (they passed on 0x0).
- Gates (v7.15): npm test 4627/4622/0/5 · babel 4/4 · page.js 347/347 · serverpage 490/0 · trainchaos CLEAN 18 ·
  livecheck ALL PASS. Function v182. slicecensus `<style>` pin 104,653 → 109,376. Shots `docs/ux/after-hub*.jpg`,
  `after-onescreen*.jpg`.

**State:** live = **v7.15** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (any order; G2–G5 may go to parallel Sonnet workers, `experiments/WORKER-PROMPT-UI.txt` — UPDATE its CEO session id
to yours first; branches `ship/AG-…`, next letter **AG**):**
- **G2 the card face legible at wheel size** (the wheel's top card is the main read now; offline it's a grey stand-in —
  judge type offline, art on a phone). **G3 motion** · **G4 menus one grammar** · **G5 the end screen** (GRAPHICS-PLAN §3).
- **Wheel follow-ups (CEO, touches both boards):** prompts as a wheel source (STAGE C.1: pick/target/modal/opt/alloc/
  reveal → wheel + hub confirms; opt ORDER = QUEUE S12); mouse drag on desktop gets `pointercancel`.
- **Small board debts seen this run:** at 320x568 the stage is ~96 px tall (two strips + wheel 176 + hub) — the featured
  card is tiny; consider a compact wheel under ~650 px tall. The table's JUDGE!! now reaches 21 px below (`::after`).
  Player names (`[data-pname]`) only show inside the sheets now — consider them on the strips. `.dhand` CSS is dead.
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–10 + v7.06–v7.15 items; v7.14: the hub under either thumb; v7.15: tap a strip, read a sheet, close it).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. See QUEUE-ARCHIVE.md for the full wording.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header), run with `PAGE_DEPS=$SP/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`. page.js takes ~8 min, serverpage ~20+ min: run serverpage in the BACKGROUND
(a 10-min foreground timeout kills it). npm test regenerates CR-INDEX.md line numbers — commit them. Next letter: **AG**.
