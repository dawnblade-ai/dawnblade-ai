# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xANWs8F7hM5BDPZsWV, 2026-11-25, at v7.11)

**DIRECTION (user, 2026-11-25, standing):** gameplay first, keep it simple; the **major graphical interface changes**
are now GO. **The board's shape is DECIDED** (user, this session, answering GRAPHICS-PLAN §2): *"I don't think there is
enough room to show the equipment on the main screen with the hand. Reference our old mockup with the health bars and
the hand wheel - make sure the equipment is showing up in the hand wheel when it can be blocked with."* The old mockup =
`design/STAGE.md` + `design/prototype/` on branch **`design/stage`** (§2.1 phone bands, §3 health bars, Appendix C.1 the
hand wheel + thumb lane + hub). `docs/GRAPHICS-PLAN.md` (main) §2/§3 are rewritten to it — READ IT FIRST.

**SHIPPED THIS CEO (alone, no workers):**
- **v7.11** — at the TABLE, equipment that can block joins the hand rail in the defend step (`railPlays`, script1b: every
  piece `judge.legal` lets you `defend`, listed first, ⛨ DEF once declared; `data-rail-def` on the cell). The trainer's
  `playables()` already did this, so the wheel has a complete source on both boards. A declared rail piece's zone chip
  steps under ⛨ DEF (`.hc.sel .b-zone`). 2 page.js rows (AI goes first → first defend step: rail set == legal set, two
  taps declare); sabotage FAILS (rail empty). Gates: npm test 4627/4622/0/5 · babel 4/4 · page.js 321/321 · serverpage
  490/0 · livecheck ALL PASS (first run hit Pages mid-propagation: "different builds" — rerun once `curl` shows the new
  APP_VER). Function v174. slicecensus `<style>` pin 100,125 → 100,271.

**State:** live = **v7.11** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT — G1, in order, each a release, alone (GRAPHICS-PLAN §3):**
1. **G1a the HUD**: two skewed fighting-game life bars, numeral BESIDE each bar (STAGE §3.1 + App. B P2: never over it),
   chip trail, hand pips, turn; one shared component replacing `LifeHud` on both boards; no HUD text under a transformed
   ancestor (drill it); boxes at 393x852 and 320x568.
2. **G1b the hand wheel**: one shared `HandWheel` fed by the rail entries (trainer: hand + `playables()`; table: hand +
   `railPlays()` + arsenal) — top card magnified, spin/snap, tap top = commit, tap other = spin it up (the two-tap rule
   as motion); the hub (primary button) in the thumb lane x 96..297. Gear appears ONLY when it has a legal play (block in
   defend, swing, ability). Prompts on the wheel (STAGE C.1) can follow in a later step.
3. **G1c one screen**: strips as counts/chips with NO gear tiles, the stage (chain + wall row, gear in the wall), the
   three panes become sheets. Then G2 (card faces at wheel size), G3 motion, G4 menus, G5 end screen — G2–G5 may go to
   parallel Sonnet workers (`experiments/WORKER-PROMPT-UI.txt`: CEO id updated 2026-11-25; branches `ship/AG-…`).
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–10 + v7.06–v7.11 items; v7.11: block with a piece from the hand rail at a table).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. See QUEUE-ARCHIVE.md for the full wording.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). This CEO: page deps install into the
scratchpad (`npm install --prefix $SP/pagedeps …`, tools/page.js's header) and `PAGE_DEPS=` names them; page.js's `open()`
waits for the hero grid's card count, so a drive of a URL that skips the grid opens as usual and then `page.goto`s
(`kj.href + "?join=…"`). Next letter: **AG**.
