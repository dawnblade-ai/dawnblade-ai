# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xC2gp6ZU3xUkekmsVm, 2026-11-26, at v7.18)

**THE DESIGN MISSION IS ITS OWN TRACK (user, 2026-11-26: "reimagine the entire interface … for ranked mode we want to
mimic [a real table] as close as possible — no log of game actions just a simple scratch sheet of life total changes …
bold announcements of game actions as if the opp is dictating their plays").** Its vision, research (TRP 5.1 / 5.8, PPG
3.2, quoted) and OWN handoff are **`docs/TABLE-TALK.md` on main** ("Table Talk"), with a flow mockup at
`docs/design/flow.html`. **Work it only when the user asks for the design mission**; this file stays the busy work.
G2–G5 below overlap it: read TABLE-TALK.md §11 before starting one (TT1/TT3/TT4 cover G3/G4/G5 for the new table).

**STANDING (unchanged):** gameplay first, keep it simple; the hand is the flat `HandRow` (the wheel is retired — never
bring an arc back); the classic board is the Stage table (`docs/GRAPHICS-PLAN.md`), Table Talk sits beside it behind
a switch until the user makes it the default.

**SHIPPED THIS CEO (alone, no workers):**
- **v7.17 the glance** ("the card previews broke"): v7.15 hid the peek card under 700 px tall and v7.16 kept the hide —
  every iPhone in Safari (~660 px tall) showed a tapped card's NAME ONLY. The card shows at every height, >= 150 px where
  there is room, under the jump row; tapjudge reports controls under the open glance as exempt. Drill `peekJudge` at
  **393x660** (the iPhone's real height — new to the drives) and 320x568, both boards; the v7.15 hide put back FAILS.
- **v7.18 Table Talk, a preview** (TABLE-TALK.md has it all): `engine/announce.js` (new), `local.js` pace/onStep/
  nudge/dispose, TableBoard's pieces built once (`askEl` … `overlaysEl`; the classic board renders identical DOM),
  `TalkTable` behind the title's "Try the new table" / `?talk=1`. Drills: test/announce.test.js, test/local.test.js,
  tools/talk.js (page.js runs it at 393x660, 393x852, 320x568). test/tabletarget.test.js now follows a NAMED arena cell.
- Gates: v7.17 — npm test 4627/4622/0/5 · babel 4/4 · page.js 354/354 · serverpage 490/0 · trainchaos CLEAN 18 ·
  scenes 107/0 · fairness clean · livecheck ALL PASS · function v186. v7.18 — npm test 4642/4637/0/5 · babel 4/4 ·
  page.js 372/372 (the 18 talk rows new) · serverpage 490/0 · trainchaos CLEAN 18 · scenes 107/0 · fairness clean ·
  livecheck ALL PASS · the LIVE new table driven through the proxy (real fonts incl. Caveat, real art): 6 glimpses,
  0 errors (`docs/ux/talk-live-glimpse-pitch.jpg`) · function v188.

**State:** live = **v7.18** on `main`. **WIRE_V 50** (no wire change), DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.**
SQL unchanged (001..012). Function v188. Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (any order; workers allowed per `experiments/WORKER-PROMPT-UI.txt` — UPDATE its CEO session id; next letter **AG**):**
- **Ask the user** how the hand row and the new table feel on the phone (DESKTOP-TASKS 11 + the Table Talk questions in
  TABLE-TALK.md §13, which this session's message asked).
- **G2 the card face legible at hand-row size** (76..104 px) — Table Talk already drops the type label across the art.
- **Prompts as a hand source** (STAGE C.1 pick/target/modal/opt/alloc/reveal → the row + hub; opt ORDER = QUEUE S12).
- **Small board debts:** the table's JUDGE!! reaches 21 px below (`::after`); player names only inside the sheets;
  `.dhand` CSS is dead.
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–11 + v7.06–v7.18 items; v7.17: tap a card at the iPhone's own height and read it; v7.18: the switch,
  a game on the new table, the voice in the menu).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C (no standalone mode) unless the user says yes
to the storage split; share text as v7.08; presence waits on a yes. Table Talk's own questions: TABLE-TALK.md §13.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header; add `@fontsource/caveat` for the pad's face), run with
`PAGE_DEPS=$SP/pagedeps NODE_PATH=/opt/node22/lib/node_modules`. page.js takes ~12 min now (the talk rows), serverpage
~12–20 min: run them in the BACKGROUND, on a worktree of the commit you ship (`git worktree add --detach`), so the tree
you keep editing is not what is measured. npm test regenerates CR-INDEX.md line numbers — commit them.
