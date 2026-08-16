# THE MERGE — done, at v2.79

## WHAT HAPPENED

The plan in this file (written at v2.76) was three versions: judge resolves
card text, a local session, one board. **The first two shipped and are
live.** The third is deliberately not done, and the reason is in "WHAT IS
LEFT" below.

```
v2.76  the flow (hero → throw → sideboard → game)        ✔
v2.77  judge.js resolves card text                       ✔
v2.78  the table can answer a prompt                     ✔
v2.79  a session with no network — solo IS the table     ✔
       one board; Battle's rules retire                  ☐  ← the last step
```

`npm test` → **1025 drills green**. `npm run fairness` → clean. All 22
`engine/*.js` verified serving 200 at
https://dawnblade-ai.github.io/dawnblade-ai/ .
`node` is at `~/node/bin`, **not on PATH** —
`export PATH="$HOME/node/bin:$PATH"`.

---

## THE SHAPE IT ENDED UP IN

```
   hero + opponent
        ↓
      throw
        ↓
    sideboard
        ↓
  ┌──────────────┐         ┌────────────────────────────────┐
  │   Battle     │         │  judge.reduce  the CR structure│
  │  (solo, the  │         │  effects.*     the card text   │  ← ONE engine
  │   tuned      │         │  sparring.act  seat 1, local   │
  │   dummy)     │         │  local.js / net.js  the session│
  └──────────────┘         └────────────────────────────────┘
        │                            │              │
   the regression              TableBoard      TableBoard
      harness                   (local)         (a person)
```

**Both boards resolve every card effect, through the same `effects.js`.**
There is exactly one copy of the semantics and two turn structures that
call it. That was the whole job.

### How judge calls the semantics

| judge.js | effects.js | what it is |
|---|---|---|
| `effectsFor(g)` / `withEffects` | `makeEffects(ctx)` | the 17-key context, built FRESH per call over a uid cell that is written back — the one thing that does not fit a pure reducer for free |
| `commitPlay` | `execute(s, card, from, idx, {window})` | the card resolves, and its text resolves with it |
| `declareAttack` | — | merges into the pend `execute` already built; **never replaces it**, or the card's whole payload becomes a number |
| `strike` | `linkPumps` → *(judge's own wall + CR 1.4.5 damage routing)* → `linkPayload` | the split that made the table callable at all |
| `closeChain` | `fileAttack` | WHERE a spent card goes; WHEN is the caller's |
| `promptConfirm` | `applyAnswer` | one shared body, both boards |

`judge.setDb(db)` registers the card database. It is **not state** — a
lookup table identical on both peers, checked by the lobby before a hero
is chosen — and an unregistered one REFUSES rather than throwing.

---

## WHAT IS LEFT, AND WHY IT IS NOT DONE

**`Battle` is the regression harness and does not retire until the merged
path passes the same drills.** That rule has not moved and it is the whole
reason there are still two boards. Concretely, before deleting anything in
`Battle`:

> `test/kayo.test.js`, `test/dorinthea.test.js`, `test/frostbite.test.js`,
> `test/arcane.test.js` and `test/paytoll.test.js` must pass **driving
> `judge.reduce`** rather than a hand-rolled effects context.

Those five files build their own `ctx` and call `runOps`/`execute`
directly. Repointing them at `judge.reduce` is the next session's job, and
it is the honest gate: they are the only proof the semantics are right,
and today they prove it about a context a test wrote rather than the one
a player gets.

Two more things belong to that step:

- **The `[3,4,5]` escalation is TUNED and `sparring.act` is not.** The
  local table's opponent is a printed-numbers policy that reads no card
  text; it is a weaker sparring partner than the trainer's dummy, by
  design. Retuning is a play session, not a drill.
- **`Battle`'s 97 `mode`/`bphase` references.** Whatever replaces `setG`
  must keep the invariant-judge funnel, or the guard rails go dark.

---

## WHAT THIS MERGE LEARNED THE HARD WAY

Every one of these was found by a drill or by opening the game, not by
reading, and each is a shape that will recur.

1. **AN ATTACK WAS FILED TO THE GRAVEYARD WHILE STILL ON THE CHAIN.**
   `execute` filed it at DECLARATION — which is not something a card
   does, it is what a board with no combat chain to hold a card has to do
   instead. Delegating handed that model to judge.js, whose `chainCards`
   then held the same card: **175 pool cards reported `want chain, got
   grave`**, and in judge it would have been CARD-IN-TWO-ZONES. The fix
   is the split that keeps recurring — `fileAttack` answers WHERE, the
   caller answers WHEN.
2. **GO AGAIN WAS ABOUT TO PAY TWICE.** `linkPayload` charges the
   attack's action point and judge's `resolveLink` also added one. Two
   points for one go again is the direction that steals games, and no
   coverage tool can see it.
3. **A DRILL THAT PASSED BY READING TOO MUCH.** `priority.test.js` sliced
   `resolveStack` between two anchors and its END anchor had gone stale
   in v2.73 — `indexOf` returned -1, the slice ran to the end of the
   file, and it passed by reading everything. **Assert both anchors are
   found.** The mirror image of "a source guard aimed at the wrong file
   passes by finding nothing".
4. **TWO DRILLS WERE ASSERTING THINGS THEY COULD NOT SHOW.** The chair
   mirror compared two games that were never mirrors — both seats build
   from one seeded stream in seat order, so swapping the heroes swaps
   their shuffles — on a premise (printed power decides it) that card
   text then overturned. And `judge.test.js`'s driver proposed a weapon
   swing it had not checked it could pay for, then recorded its own
   optimism as an engine refusal.
5. **A PINNED SAMPLE IS NOT A PINNED RULE.** The chair mirror was pinned
   at exactly 6-6; with prompts resolving it is 5-7. Pinning an emergent
   count turns every honest card fix into a red drill and trains the
   reader to edit the number without thinking. It asserts a BAND now —
   the shape it guards is "a weaker seat loses all twelve", which no band
   of four hides.
6. **THE GATE WITHOUT THE ANSWER STOPS THE GAME.** Making a live prompt
   block both seats — correct, because whatever queued it is
   mid-resolution — turned **seven drills red** with one symptom: *the
   game never ended*. Every seat must be able to answer, which is why
   `judge.autoAnswer` exists and why `sparring.act` calls it.
7. **AN UNREGISTERED DATABASE MUST REFUSE, NOT THROW.** `resolveEntry`
   reads `db.byName` unguarded, so a bare `{}` is a TypeError from inside
   a reducer whose contract is that it never throws. It gets an empty
   BUILT db.
8. **PROSE TRIPS SCANS IN BOTH DIRECTIONS.** A comment containing the
   words `youMut` and `you(s).res` — describing the bug that was fixed —
   failed the actor ledger. Reword the prose; never weaken the scan.

---

## DECISIONS — do not re-litigate

| decision | date | what |
|---|---|---|
| **Keep the `sparring.js` wall** | 2026-08-16 | It reads NO card text, and that stays. v2.78 added one call — `judge.autoAnswer`, so a seat that is ASKED can answer — which reads no card text either; the two answers that cost real money delegate to `soakPolicy`/`payPolicy`, the same pure policies the trainer uses. |
| **Two-player is the only mode** | 2026-08-16 | Opponent picked on the hero screen; vanilla Dummy is the default. |
| **Sideboard follows the throw** | 2026-08-16 | v2.76. |
| **Build the seat** | 2026-08-14 | Reverses the 2026-07-25 "no AI opponent" note. Both dates kept so nobody re-litigates from the old one. |
| **`Battle` retires last** | 2026-08-16 | And only once the five semantics drills pass driving `judge.reduce`. |

---

## WHAT MUST SURVIVE

- **No build step, ever.** Plain UMD scripts, `file://` must work.
- **Never invent card effects.** Teach the parser to read the text.
- **One copy of the semantics.** `effects.js` is it.
- `you()`/`opp()` read and `youMut()`/`oppMut()` write — **UI only**.
  Rules use `act()`/`foe()`, builds use `bAct()`. **Never write a side
  field as a top-level game key.**
- **Store the rng back** (`n.rng = rng`).
- `instead` REPLACES · go again is a **GAIN** · an instant costs **no**
  action point.
- **`sparring.js`'s three properties**: it proposes and `judge.legal`
  disposes; it reads no card text; it is deterministic and never touches
  `game.rng`.
- **A live prompt stops BOTH seats.** Letting play continue around it is
  how a deferred payload gets abandoned.
- **`autoAnswer` is never called from `reduce`.** The session asks for it;
  the rules never volunteer an answer on a player's behalf.
