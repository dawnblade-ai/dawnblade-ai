# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAG79cJkbJ6nxVKsk3, 2026-11-26, at v7.19)

**THE USER'S DIRECTION NOW (2026-11-26, this CEO's opening):** "We are currently focused on polishing the design. Things
need to be as simple as possible — focus on the cards and the experience of playing in real life — but still with the
health bar callout to a fighting game." **The design mission (Table Talk) is the current focus**: its vision, research
and OWN handoff are **`docs/TABLE-TALK.md` on main** — start there, then this file's busy work if asked. G2–G5 below
overlap it: read TABLE-TALK.md §11 first.

**STANDING (unchanged):** gameplay first, keep it simple; the hand is the flat `HandRow` (never bring an arc back); the
classic board is the Stage table (`docs/GRAPHICS-PLAN.md`); Table Talk sits beside it behind a switch (`?talk=1`, the
title's "Try the new table") until the user makes it the default.

**SHIPPED THIS CEO (alone, no workers):**
- **v7.19 the bout** (TABLE-TALK.md §5, §11 TT1a): the new table opens with both lives as fighting-game bars in ONE
  strip across the top (`TalkBout`, reusing the classic HUD's `LifeBar`/`LifeNum`, read off the pad's marks; a damage
  pop; the turn as a round timer; a tap opens the pad). The pad left the mat (the chain has the full width); the heroes
  left the side rows; the call starts below the bout so the bars stay in view; "Any blocks?" / "No response" on the
  hub; the stack's ask line dropped, the defend ask shortened (talk only — the classic board is unchanged).
- Gates: npm test 4642/4637/0/5 · babel 4/4 · page.js 370/372 on the first cut (2 glimpse-size FAILs, fixed: talk.js
  clean at all three sizes after) · serverpage 490/0 · livecheck ALL PASS · function v190. Not run (no engine/rules/AI/
  trainer change): scenes, fairness, play, chaos, trainchaos.

**State:** live = **v7.19** on `main`. **WIRE_V 50** (no wire change), DATA_VER sage-v19, 17 heroes. **WORKERS: NONE.**
SQL unchanged (001..012). Function v190. Weekly sweep Mondays 06:17 UTC — glance at Monday's run.

**NEXT (any order; workers allowed per `experiments/WORKER-PROMPT-UI.txt` — UPDATE its CEO session id; next letter **AG**):**
- **Ask the user** how the bout and the new table feel on the phone (TABLE-TALK.md §13 Q2–Q7 still open; Q1 answered).
- **Table Talk next steps** are in TABLE-TALK.md's handoff (gear as small cards, TT1 rest, TT2, TT3).
- **G2 the card face legible at hand-row size** (76..104 px).
- **Prompts as a hand source** (STAGE C.1 pick/target/modal/opt/alloc/reveal → the row + hub; opt ORDER = QUEUE S12).
- **Small board debts:** the table's JUDGE!! reaches 21 px below (`::after`); player names only inside the sheets;
  `.dhand` CSS is dead.
- Parked (unchanged): matchmaking SQL 013; presence (SQL + a yes); serverpage 9 px advisories; real-iPhone pass
  (DESKTOP-TASKS 1–11 + v7.06–v7.19 items; v7.19: the bout on the phone, a hit's pop, a tap on the bars opens the pad).

**NEEDS A RULING (defaults standing):** Add to Home Screen stays decision C unless the user says yes to the storage
split; share text as v7.08; presence waits on a yes. Table Talk's own questions: TABLE-TALK.md §13.

**How to run the shop:** as before (QUEUE-ARCHIVE.md, v6.99/v7.04/v7.05/v7.07 handoffs). Page deps:
`npm install --prefix $SP/pagedeps …` (tools/page.js header, incl. `@fontsource/caveat`), run with
`PAGE_DEPS=$SP/pagedeps NODE_PATH=/opt/node22/lib/node_modules`. page.js ~11 min, serverpage ~13 min: run them in the
BACKGROUND on a worktree of the commit you ship. A CSS change moves `test/slicecensus.test.js`'s `<style>` pin (read
the diff, repin with a history line). After the push, wait for Pages to serve the new APP_VER before `livecheck.js`
(it fails on mixed builds until then). npm test regenerates CR-INDEX.md line numbers — commit them.
