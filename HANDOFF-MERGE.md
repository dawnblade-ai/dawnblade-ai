# THE MERGE — done, at v2.79; the gate passed at v2.80

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
v2.80  the five gate drills drive judge.reduce           ✔  ← the gate
v2.81  the dummy is a punching bag, not a hero           ✔
       one board; Battle's rules retire                  ☐  ← the last step
```

`npm test` → **1039 drills green**. `npm run fairness` → clean. All 22
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

**THE GATE IS PASSED (v2.80).** The rule has not moved — *`Battle` is the
regression harness and does not retire until the merged path passes the
same drills* — but the condition it names is now met:

> `test/kayo.test.js`, `test/dorinthea.test.js`, `test/frostbite.test.js`,
> `test/arcane.test.js` and `test/paytoll.test.js` must pass **driving
> `judge.reduce`** rather than a hand-rolled effects context. ✔

They go through `test/helpers/judged.js`, which is `judge.withEffects` —
judge's own context — and each of the five drives `reduce` for the plays
its subject is actually about. `test/sync.test.js` holds both halves: no
drill file may build its own effects context outside the three sanctioned
seam files, and those five must reach the reducer.

**That UNBLOCKS retiring `Battle`'s rules. It does not retire them.**
The remaining work is unchanged in size, and is the two bullets below.

### What repointing them found

Three things, each invisible until the drills ran on the real context:

1. **`effCost` is read TWICE and the reads are different questions.**
   `execute` charges the cost; `doPlay` asks whether the seat can AFFORD
   it, and only that second read decides whether a payment opens.
   Replacing `doPlay`'s `effCost` with the printed cost left every
   existing drill green.
2. **Judge's wall had NO drill.** `resolveStack` is the trainer's path —
   judge does not call it, because the body was split so each caller
   keeps its own wall and its own CR 1.4.5 routing between `linkPumps`
   and `linkPayload`. All 14 dorinthea drills measured the half of the
   engine the table does not use.
3. **A fabricated `pend` is the answer, not the question.** `total` was
   supplied by the fixture, so the blocked-to-nothing case was asserted
   by writing 0 into the link rather than by anyone blocking.

Two more things belong to the retirement step:

- **The `[3,4,5]` escalation is TUNED and `sparring.act` is not, and the
  untuned one is STRONGER — measured, not assumed.** Against the vanilla
  pile at the local table the dummy wins **11 of 15**; at 20 life it
  still wins 8, so it is not the life total. A deck with no rules text
  SUITS a policy that reads no card text: `sparring.act` plays 30 vanilla
  attacks better than it plays a real hero's deck. This file used to say
  the table's seat was "a weaker sparring partner by design" — that was
  written before anyone measured it, and it is backwards. The trainer is
  unaffected. Retuning is a play session, not a drill.
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
| **Two-player is the only mode** | 2026-08-16 | Seat 1 is a PERSON, who picks their own hero when they join a table, or the DUMMY, which is always the vanilla pile. The opponent picker is gone (v2.81) — there is no hero the dummy plays as. |
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
