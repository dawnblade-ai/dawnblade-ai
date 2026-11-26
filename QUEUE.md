# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAD84uGkxF8L7UGHXS, 2026-11-26, at v7.12)

**DIRECTION (user, 2026-11-25, standing):** gameplay first, keep it simple; the **major graphical interface changes**
are GO. **The board's shape is DECIDED**: the old Stage mockup (`design/STAGE.md` + `design/prototype/` on branch
**`design/stage`**: §2.1 phone bands, §3.1 bars, Appendix C.1 the hand wheel + thumb lane + hub), with *"the equipment
showing up in the hand wheel when it can be blocked with."* `docs/GRAPHICS-PLAN.md` (main) §2/§3 — READ IT FIRST.

**SHIPPED THIS CEO (alone, no workers):**
- **v7.12 — G1a the HUD.** One shared `StageHud` (script0, beside `LifeNum`; `LifeBar`, `HandPips`) between the nav row
  and the three screens on BOTH boards, always on: two skewed bars (±10°), the numeral a flat sibling BESIDE each bar,
  red trail (hold 350 ms, drain 500 ms), gain grows 400 ms, danger rim at ≤ ¼, turn box with a marker at the turn
  player (trainer: `mode` block/foeturn = theirs; table: `turnPlayer`), hand pips (5 then xN), your AP/res chips,
  trainer ❄ count. `LifeHud` is GONE (it lived in the log pane). `--hudh` 52px: `.board .tablewrap/.vscreen`
  subtract it (393: screen 700 → 648; 320x568: 364). `hudJudge(page, truth?)` is exported from tools/page.js —
  reuse it for G1b/G1c. 4 page.js rows (trainer 393, after a block, table defend step vs engine life + turn,
  trainer 320x568); 5 sabotages FAIL. Before/after: `docs/ux/before-hud.jpg`, `after-hud.jpg`, `after-hud-320.jpg`.
  Gates: npm test 4627/4622/0/5 · babel 4/4 · page.js 326/326 · serverpage 490/0 · trainchaos CLEAN 18 ·
  livecheck ALL PASS. Function v176. slicecensus `<style>` pin 100,271 → 103,205.

**State:** live = **v7.12** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT — G1b the hand wheel (GRAPHICS-PLAN §3), one release, alone:**
- One shared `HandWheel` fed by the rail's entries — trainer: `playables` (index.html ~6878, already lists gear in
  the defend step) rendered in `.phand` (~7088); table: `railPlays` (~10013, v7.11 gear-in-defend) in `.phand`
  (~10287). Top card magnified, spin + snap, tap top = commit, tap other = spin it up (the two-tap rule as motion,
  `PeekDock` ~3090 stays the peek); the hub (the primary `.actbar` button) in the thumb lane x 96..297. Gear appears
  ONLY when it has a legal play. Prompts on the wheel can follow later. Keep the existing rail rows green (page.js
  rows on `.phand .hc`, `data-rail-def`) or move them to the wheel's selectors in the same release.
- Then **G1c one screen** (strips as counts/chips, the stage, panes → sheets). Then G2–G5 may go to parallel Sonnet
  workers (`experiments/WORKER-PROMPT-UI.txt`: CEO id updated 2026-11-26; branches `ship/AG-…`).
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–10 + v7.06–v7.12 items; v7.12: read both life bars mid-fight, a hit's red trail drains).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. See QUEUE-ARCHIVE.md for the full wording.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header), run with `PAGE_DEPS=$SP/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`. page.js takes ~8 min, serverpage ~20+ min: run serverpage in the BACKGROUND
(a 10-min foreground timeout kills it). npm test regenerates CR-INDEX.md line numbers — commit them. Next letter: **AG**.
