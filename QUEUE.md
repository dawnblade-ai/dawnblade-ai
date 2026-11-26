# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAN4aifuqFXPZjRZsD, 2026-11-26, at v7.16)

**DIRECTION (user, 2026-11-25, standing):** gameplay first, keep it simple; the **major graphical interface changes**
are GO. The board is the Stage table (`docs/GRAPHICS-PLAN.md` §2/§3 on main — READ IT FIRST; the old mockup is
`design/STAGE.md` + `design/prototype/` on `design/stage`). **G1 is done**, with one reversal:

**THE WHEEL IS RETIRED (user, 2026-11-26):** *"the current hand 'wheel' really doesn't work well, we need a better more
fluid system — maybe ... we just need to make the hand endlessly scrollable in the old flat layout."* Do NOT bring an
arc, a spin or a magnified-top-card hand back. The hand is `HandRow` (index.html, shared by both boards).

**SHIPPED THIS CEO (alone, no workers):**
- **v7.16 the hand row**: `HandRow` replaces `HandWheel`. A native horizontal scroller (the phone's own momentum and
  rubber band, NO snap, `overscroll-behavior-x: contain` so a flick at the end never swipes Safari back), every card
  upright and one size (`--hcw`: 96 px at 393, 76..104; 76 under 700 px tall — the 320x568 stage grew ~96 → 146 px),
  centred while it fits, `+N` on each edge (sticky, cards whose middle is past it). Two-tap rule untouched; the peeked
  card glides whole into view (clear of the edge fade, pad 28). Desktop: mouse wheel → sideways, mouse drag pulls.
  The v7.14 "dim the art, not the numbers" rule now covers every hand row. Drill `handJudge` (+ `handTo`, both
  exported from tools/page.js, replacing `wheelJudge`/`wheelTo`): rows trainer 393, trainer 320x568 (commit), TABLE
  (new; the wheel had no table row). 6 sabotages each FAIL. tapjudge's EXEMPT list is now empty. NOTE for drives:
  headless Chromium scrolls natively on CDP `Input.dispatchTouchEvent`, NOT on `Input.synthesizeScrollGesture`.
- Gates (v7.16): npm test 4627/4622/0/5 · babel 4/4 · page.js 350/350 · serverpage 490/0 · trainchaos CLEAN 18 ·
  livecheck ALL PASS. Function v184.
  Shots `docs/ux/after-handrow.jpg`, `after-handrow-320.jpg`. slicecensus `<style>` pin 109,376 → 109,918.

**State:** live = **v7.16** on `main`. **WIRE_V 50**, DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.** SQL unchanged
(001..012). Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (any order; G2–G5 may go to parallel Sonnet workers, `experiments/WORKER-PROMPT-UI.txt` — UPDATE its CEO session id
to yours first; branches `ship/AG-…`, next letter **AG**):**
- **Ask the user how the hand row feels on the phone** before building more on it (DESKTOP-TASKS item 11). Ideas if they
  want more: a long-press to open a card large (today a tap on an unplayable card does it); hold the row's scroll
  position per turn; sort (playable first) as an option. "Endlessly" was read as "one free flick end to end", not a
  looping carousel (a loop duplicates cells and confuses a 7-card hand) — offer the loop only if they ask again.
- **G2 the card face legible at hand-row size** (76..104 px now; offline it's a grey stand-in — judge type offline, art
  on a phone). **G3 motion** · **G4 menus one grammar** · **G5 the end screen** (GRAPHICS-PLAN §3).
- **Prompts as a hand source** (was "wheel follow-ups": STAGE C.1 pick/target/modal/opt/alloc/reveal → the row + hub
  confirms; opt ORDER = QUEUE S12). The wheel's mouse `pointercancel` debt is gone with the wheel.
- **Small board debts:** the table's JUDGE!! reaches 21 px below (`::after`). Player names (`[data-pname]`) only show
  inside the sheets — consider them on the strips. `.dhand` CSS is dead. Under 700 px tall the peek dock is its bar
  alone (no room for the card): fine with 76-px cards, revisit if G2 changes the face.
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–11 + v7.06–v7.16 items; v7.14: the hub under either thumb; v7.15: tap a strip, read a sheet, close
  it; v7.16: flick the hand row, tap a half-shown card).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. See QUEUE-ARCHIVE.md for the full wording.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header), run with `PAGE_DEPS=$SP/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`. page.js takes ~8 min, serverpage ~20+ min: run serverpage in the BACKGROUND
(a 10-min foreground timeout kills it). npm test regenerates CR-INDEX.md line numbers — commit them. Next letter: **AG**.
