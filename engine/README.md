# engine/ — THE JUDGE (Phase 1)

Pure JS rules engine, zero DOM, runs in Node and the browser. Extracted from
`index.html` per the TORCH roadmap; the single-file trainer is untouched and
still ships as-is.

## Modules

- **parser.js** — the crown jewel: `classifyClause`, `fxParse`, `parseHeroPower`,
  `weaponCost`, `runeRed`/`effCost`, card predicates. Node: `require`; browser:
  `window.DawnParser`.
- **game.js** — pure state helpers: `parseDeck`, `gearDef`/`gearBlockApply`
  (Blade Break / Battleworn / Temper / Guardwell), `slotOf`, `shuffle`.
  Browser: `window.DawnGame`.
- **advisor.js** — "Claude's call": `advise` and its evaluation stack.
  Browser: `window.DawnAdvisor`.

### Phase 2 — the two-player groundwork (v2.14)

- **sides.js** — the shape a second human can occupy. `makeSide()` (41 fields,
  identical for both seats), `makeGame()`, `withSide()`, and the lossless
  legacy bridge `toSides()` / `fromSides()` plus the `P_MAP` / `O_MAP` /
  `GAME_KEYS` migration ledger. `symmetryGap()` reports how far along the
  collapse is. Browser: `window.DawnSides`.
- **priority.js** — who may act, right now. Phases, combat-chain steps,
  priority passing, seating and the turn handoff. Owns no zones and reads no
  card text. Browser: `window.DawnPriority`.
- **rps.js** — the pregame throw. The winner *chooses* the seating rather than
  being handed it. Driven by the pregame UI. Browser: `window.DawnRPS`.
- **prompts.js** — the choice machinery a quarter of the recorded rulings were
  waiting on: `opt`, `pick`, `modal`, `pay` (pay-or-decline) and `reveal`, all
  driven by spec objects rather than a branch per card. Prompts are addressed to
  a **side**, so a ruling can ask the opponent. Runs no effects and touches no
  resources — `applyPrompt` returns `{game, msgs, ops, pay}` and the trainer
  does the rest, which is what keeps an unpaid optional cost from firing its
  payload. Rendered by the trainer. Browser: `window.DawnPrompts`.

`priority.js` is the one module the trainer does not call yet — it still gates
windows with `mode`/`bphase` and the player holds priority by construction. It
is the target shape, drilled independently; adoption is roadmap item 1, step 4.

Not yet here: `judge.js` (`runOps` / `execute` / `resolveStack` still live
inside the trainer's Battle component).

## The no-mirror rule (v2.20)

**`engine/` is the only copy. Edit here, never in `index.html`.**

Until v2.20 every shared function existed twice — here and hand-copied into
`index.html` — kept identical by a drift test. `index.html` now loads these
files with plain `<script src>` tags (no build step; still fine over
`file://`) and a small bridge lifts each export into the bare name the
trainer calls. 51 duplicated definitions were deleted, ~20% of the file.

`test/sync.test.js` now guards the inverse: every module is loaded,
`parser.js` loads before its dependents, every bare-called export is
bridged, and **no export is re-declared inside `index.html`** (which would
silently shadow the module). Adding a new export? Add it to the bridge too.

Three names collide with trainer-local ones on purpose — `endTurn`, `other`,
`you` — and the drill pins that set. Rename when `priority.js` is wired in.

## Tests

```
npm test        # node --test "test/*.test.js"
```

220 drills: the historical ad-hoc node drills formalized (weaponCost,
classifyClause conditionals, the {p} pump parser), the Kayo printed-vs-granted
keyword regression, the fxParse memo gotcha (fixture names must be unique),
equipment wear, deck integrity (15 decks × 55 = deck + gear), bracket balance
of both babel blocks, and the no-mirror guard.

(It was 253 before v2.20: 48 body-comparison drills retired with the mirrors,
15 sharper structural ones added in their place.)
