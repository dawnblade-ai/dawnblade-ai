# Handoff — evaluate the state of Dawnblade

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## The job

**Evaluate, don't build.** The last stretch (v2.13 → v2.19) landed a lot: the
two-player state migration, the prompt machinery, the pregame throw, a new
sweep tool, and a UI pass. Nothing has been pushed. Before more is added,
someone should look hard at what is actually there and say what is solid, what
is approximate, and what is wrong.

**Read `CLAUDE.md` first, in full.** It carries the hard constraints, the golden
rule, the access rules, and an honest list of known approximations. Several of
those entries exist because breaking the rule already cost real bugs.

## Where things stand (v2.19)

- `npm test` → **253 drills, all green.** Never leave them red.
- Pool: **405 unique cards · 258 full / 112 part / 35 none** — unchanged across
  the whole migration, which is the evidence that none of it broke card coverage.
- `tools/rulings.json` holds **119 rulings**. `npm run stack` → **0 open.**
- `npm run sweep` → **170 entries** across three axes the stack never covered.
- Everything is **local**. The Pages repo still has v2.13.

### What landed, version by version

| ver | what |
|---|---|
| 2.14 | `engine/sides.js` (symmetric state + lossless bridge), `engine/priority.js` (phases, chain steps, priority), `engine/rps.js` + the pregame throw where the winner *chooses* seating |
| 2.15 | opponent's zones + life onto `sides[1]` |
| 2.16 | player's zones + life onto `sides[0]`; dummy gains arsenal/pitch/banish/soul |
| 2.17 | `engine/prompts.js` — five side-addressed prompt variants as data specs |
| 2.18 | counters + statuses migrate; `flatRemaining` hits **0**; both seats 41/41 |
| 2.19 | two-tap card interaction, equipment-ability art, five v2.18 bug fixes |

## What to evaluate, in rough priority order

**1. Is the sides[] migration actually sound?**
`flatRemaining` is 0 and both seats are built by one `makeSide` call, but the
migration was largely scripted. Two bug classes escaped the drills and were
caught by eye:
- reads (`X.field`) were guarded, **object keys were not** — five side fields
  were being written onto the game object (see CLAUDE.md, the access rule);
- `boardRed` had **drifted silently** between `index.html` and `engine/parser.js`
  because it was never in the sync guard's SHARED list.

Both are fixed and drilled. The question for a reviewer is whether a *third*
class is hiding. Suggested attack: pick a few reducers (`execute`,
`resolveStack`, `runOps`, `newTurn`, `takeIt`) and read them end to end against
the access rule.

**2. Does it still play correctly?**
The drills cover the parser and the pure modules; they do **not** cover
`Battle`'s state flow. Everything below was verified by driving a real game and
reading React state, and that is the only evidence for it:
- nine of ten zones exercised in play — **`soul` was never exercised**, because
  the on-hit trigger needs an attack to connect and the dummy blocked everything.
  It is untested, not proven. Drive Gravy Bones by hand.
- all five prompt variants driven in the real UI, including the decline case.
- both seatings, including the opponent-first opening swing.

**3. Is the rules fidelity honest?**
This is judged to pro-tour standards and the "Known approximations" list is the
contract. Verify a few entries are still true, and look for approximations that
have crept in *without* being listed. The crumbling-aura bug (v2.16) is the
cautionary tale: it was real, shipped, and invisible until someone read the
line.

**4. Is the difficulty still tuned?**
Untouched since before the migration, and **opponent-first was never tuned at
all** — the dummy's turn-1 swing value gets used twice when you go second. Play
a few games on both seatings.

## Things I would flag as genuinely open

- **`engine/priority.js` is not wired in.** The trainer still gates windows with
  `mode`/`bphase`. This is the last step of roadmap item 1 and the one that
  changes control flow rather than field names. Mind the clock: `priority.js`
  counts player-turns in `turn` and rounds in `round`; the trainer's `turn`
  counts only your own turns, and both the escalation table and the score read it.
- **Hero abilities are the biggest content gap** — 13 of 15 heroes, **32 unread
  clauses**, never charged by the stack. Azalea, Kayo, Fai and Briar are 100%
  unread. `npm run sweep` is the review station for this.
- **Five tokens have no engine handling** — `Confidence`, `Fealty`, `Flurry`,
  `Graphene Chelicera`, `Courage`.
- **147 cards are ruled but not built.** Understood ≠ built.
- The dummy still has **no action phase** — its swing is the scripted
  `[3,4,5][(turn-1)%3]` escalation in `foeSwing`, which is the seam a real
  played card slots into.

## Validation loop

```bash
npm test                              # 253 drills — must stay green
npm run audit                         # regenerate AUDIT.md, read the diff
node tools/audit.js --write-baseline  # ONLY after reviewing the tier diff
npm run stack                         # STACK.md + tools/review.html (0 open)
npm run sweep                         # SWEEP.md + tools/sweep.html (170 entries)
```

Also open `index.html` in a browser and actually play. Several bugs this cycle
— crumbling auras, stale defenders, the pitch selection carrying over — were
only ever visible in play or by reading, never from a red test.

## Hard constraints that still apply

- **One `index.html`.** No build step, no modules, no framework CLI.
- **Never invent card effects.** Teach the parser to read the text.
- **The sync guard is real**, and it only covers what is listed in
  `test/sync.test.js`. Anything shared with `engine/` must be in that list or
  it is unguarded — that is exactly how `boardRed` drifted.
- **Bump `DATA_VER`** if anything is added to `NEEDED`.
- `you()`/`opp()` read, `youMut()`/`oppMut()` write. Never write a side field as
  a top-level key.

## Definition of done for the evaluation

A written assessment covering: what is solid, what is approximate-and-listed,
what is approximate-and-*not*-listed (the dangerous category), and a ranked list
of what to fix first. Plus any bug found, with the reproduction.
