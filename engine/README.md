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
  being handed it. Mirrored into `index.html` (the pregame UI calls it), so it
  is under the lockstep rule. Browser: `window.DawnRPS`.
- **prompts.js** — the choice machinery a quarter of the recorded rulings were
  waiting on: `opt`, `pick`, `modal`, `pay` (pay-or-decline) and `reveal`, all
  driven by spec objects rather than a branch per card. Prompts are addressed to
  a **side**, so a ruling can ask the opponent. Runs no effects and touches no
  resources — `applyPrompt` returns `{game, msgs, ops, pay}` and the trainer
  does the rest, which is what keeps an unpaid optional cost from firing its
  payload. Mirrored into `index.html`. Browser: `window.DawnPrompts`.

`sides.js` and `priority.js` are engine-only so far — the trainer still runs on
the flat state and gates windows with `mode`/`bphase`. They are the target
shape, drilled independently; adoption is roadmap item 1.

Not yet here: `judge.js` (`runOps` / `execute` / `resolveStack` still live
inside the trainer's Battle component).

## The lockstep rule

Until the trainer imports these files, every shared function exists in **both**
`index.html` and `engine/`. `test/sync.test.js` asserts the bodies are textually
identical — **edit one side, mirror the other, run the tests.**

## Tests

```
npm test        # node --test "test/*.test.js"
```

252 drills: the historical ad-hoc node drills formalized (weaponCost,
classifyClause conditionals, the {p} pump parser), the Kayo printed-vs-granted
keyword regression, the fxParse memo gotcha (fixture names must be unique),
equipment wear, deck integrity (15 decks × 55 = deck + gear), bracket balance
of both babel blocks, and the engine↔trainer sync guard.
