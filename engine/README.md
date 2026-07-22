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

Not yet here: `judge.js` and the two-player state machine (`runOps` / `execute` /
`resolveStack` still live inside the trainer's Battle component). They move in
Phase 2, when the dummy gets a hand.

## The lockstep rule

Until the trainer imports these files, every shared function exists in **both**
`index.html` and `engine/`. `test/sync.test.js` asserts the bodies are textually
identical — **edit one side, mirror the other, run the tests.**

## Tests

```
npm test        # node --test "test/*.test.js"
```

104 drills: the historical ad-hoc node drills formalized (weaponCost,
classifyClause conditionals, the {p} pump parser), the Kayo printed-vs-granted
keyword regression, the fxParse memo gotcha (fixture names must be unique),
equipment wear, deck integrity (15 decks × 55 = deck + gear), bracket balance
of both babel blocks, and the engine↔trainer sync guard.
