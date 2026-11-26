# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xBY86Tykao3nx1GLWn, 2026-11-26, at v7.13)

**DIRECTION (user, 2026-11-25, standing):** gameplay first, keep it simple; the **major graphical interface changes**
are GO. **The board's shape is DECIDED**: the old Stage mockup (`design/STAGE.md` + `design/prototype/` on branch
**`design/stage`**: §2.1 phone bands, §3.1 bars, Appendix C.1 the hand wheel + thumb lane + hub), with *"the equipment
showing up in the hand wheel when it can be blocked with."* `docs/GRAPHICS-PLAN.md` (main) §2/§3 — READ IT FIRST.

**SHIPPED (CEOs alone, no workers):** v7.12 G1a the HUD (`StageHud`, `hudJudge`) · **v7.13 G1b the hand wheel.**
- One shared `HandWheel` (script0, after `PeekDock`'s neighbours; replaced `RailMore`) is a LAYOUT over each board's own
  rail cells (trainer `handCell`+`playables` ~7190; table `handCell`+`railPlays`+arsenal ~10380): arc R 260, centre 348
  below the wheel top, 24°/card, top 1.45x centred in the thumb lane, `k / n` chip, `TAP · LOOK` on an unpeeked top.
  Two-tap rule untouched: the wheel FOLLOWS THE PEEK (tap other = spin up + peek; tap peeked top = commit); a touch
  drag turns 1:1, coasts, snaps, peeks (`spinPeeks`, off in inspect). Shown window measured off the wheel (±2 at 393,
  ±1 at 320). `overflow:clip` (a `hidden` box is a scroller: scrollIntoView slid it off centre). No distance fade (AA).
  Selectors kept: `.phand .hc`, `.peek`, `.sel`, `data-rail-def`; new `.phand.wheel`, `.wtop`, `data-wslot`.
- Drill: `wheelJudge(page, prefix, {commit})` + `wheelTo(page, css)` exported from tools/page.js (wheelTo SWIPES:
  tapping an edge card that can't be played opens the zoom sheet and eats every later click). 8 rows; 6 sabotages FAIL.
  Gates: npm test 4627/4622/0/5 · babel 4/4 · page.js 332/332 · serverpage 490/0 · trainchaos CLEAN 18 · livecheck
  ALL PASS. Function v178. slicecensus `<style>` pin 103,205 → 104,653. Shots: `docs/ux/after-wheel.jpg`, `-defend.jpg`.

**State:** live = **v7.13** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT — G1c one screen + the hub (GRAPHICS-PLAN §3), one release, alone:**
- **The hub** (deferred from G1b, CEO call): the actbar's primary button moves into the thumb lane (x 96..297 at 393,
  a 212x54 half-disc on the bottom edge); secondaries to the corners (bottom-right; resources/AP read-only bottom-left).
  The actbar has 1–4 buttons per mode on both boards (trainer ~7330, table ~10520): decide primary per mode, keep the
  page.js/serverpage rows that click `.actbar` by text green. Mind long secondary labels ("Defend — no reactions").
- **One screen:** strips (counts and chips, no gear tiles) + the stage; the three panes become sheets; equipment only in
  the wheel and the wall row. The wheel then moves to the bottom thumb lane (fixed), above the hub; `--peekbot` already
  measures `.phand`. Wheel height today 176 px inside the chain pane.
- Wheel follow-ups (any release): prompts as a wheel source (STAGE C.1: pick/target/modal/opt/alloc/reveal — the opt
  ORDER is QUEUE S12); mouse drag on desktop gets `pointercancel` (touch is fine; phones are the target).
- Then G2–G5 may go to parallel Sonnet workers (`experiments/WORKER-PROMPT-UI.txt`: CEO id updated 2026-11-26 to this
  session; branches `ship/AG-…`). G2 is now "the card face legible at wheel size".
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–10 + v7.06–v7.13 items; v7.13: spin the wheel one-handed, both thumbs; a swipe never plays a card).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. See QUEUE-ARCHIVE.md for the full wording.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header), run with `PAGE_DEPS=$SP/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`. page.js takes ~8 min, serverpage ~20+ min: run serverpage in the BACKGROUND
(a 10-min foreground timeout kills it). npm test regenerates CR-INDEX.md line numbers — commit them. Next letter: **AG**.
