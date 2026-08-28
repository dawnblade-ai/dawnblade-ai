# Play notes — the first self-play session (2026-08-26, at v3.49)

**The table had never actually been PLAYED since ally combat landed.** Every
version from v3.42 to v3.48 was verified by drills, and a drill asks about one
clause. This session asked the other question: *what happens when two seats
play 210 complete games?*

## The harness

`sparring.act` in **both** seats, driven through `judge.reduce`, with
`invariants.check` run against **every intermediate state** rather than the
end state — a game that finishes clean can still have passed through a broken
board. Every hero against every other hero, alternating who is on the play.

```js
for(const s of [0, 1]){
  const a = SP.act(n, s);              // the policy proposes
  const out = J.reduce(n, a, s);       // the judge disposes
  if(out.error) errs.push(...);        // a refusal is ALWAYS a policy bug
  n = out.state;
  for(const v of INV.errors(n)) viols.push(...);
  break;                               // re-ask from the top
}
```

The harness lives in the scratchpad, not the repo — it is a **measuring
instrument, not a drill**. Anything it proves that should stay proven belongs
in `test/` where `npm test` will run it. (`test/intellect.test.js` is this
session's example.)

## The headline result

```
210 games · 0 policy refusals · 0 invariant violations · 0 malformed feed lines
```

That is a real result and worth keeping. `sparring.js`'s contract is that a
refusal is always a bug in the policy; across 210 full games and roughly
130,000 state transitions, **not one action the policy proposed was refused**,
and the invariant judge never once found a card in two zones, a negative
resource, an asymmetric pair of seats or a NaN. The rules machine is solid.

**Everything below was found in spite of that**, which is the point: a clean
audit is not a played game.

---

## FINDING 1 — Knucklehead's intellect never came back (FIXED, v3.49)

14 of 210 games ran **past turn 1900 without ending**. Pulling one apart:

```
turn 1955   Iyslander hp 5, hand 4, deck 40
            Kayo      hp 19, hand 1, deck 42   ← intellect 1
            both seats: pass, endTurn, pass, endTurn, forever
```

Knucklehead prints *"**until end of turn**, your base {i} is the number
rolled"*. `effects.intRoll` stashes the printed value on `intWas`, the trainer
read it back inline, and **`judge.js` never did** — so at the table the rolled
value was permanent. A roll of 1 crippled the hero for the rest of the game;
a roll of 6 was a permanent +2, which is the direction that steals games.

Fixed as `effects.settleIntellect`, called by both boards **after** the (f)
draw. Full write-up in the v3.49 CHANGELOG entry. Worth 4 wins to Kayo
(23 → 27) and one stalled game.

> **The lesson, for the next reader:** `beginEndPhase` was the obvious home
> and would have been WRONG — it runs before (a)-(f), so restoring there hands
> the draw the printed value and makes the card do nothing. **When you move a
> schedule into a shared body, check what it has to happen AFTER.**

---

## FINDING 2 — ally combat has no driver (**FIXED, v3.50** — and it found a bug)

`engine/sparring.js` contains **zero** occurrences of `board`, `arena` or
`ally`. Measured over five ally-heavy matchups:

| | |
|---|---|
| states with an untapped ally on the acting board | 1077 |
| …of those, on its controller's own action phase | 549 |
| ally attacks **proposed** by the policy | **0** |
| ally attacks **accepted** | **0** |
| gear activations proposed | 133 |
| **hero-ability activations proposed** | **0** |

Across all 210 games the `death` and `gold` feed triggers — Oysten's Gold
token, the whole of v3.46 — **fired exactly zero times.**

So v3.44-v3.48 built the route and nothing drives it. A human can tap an ally
at the table; the sparring seat never will, and neither will it ever use a
hero ability. **This is v3.46's "measure before building" lesson with the sign
flipped**: there, a planned job turned out to be dead code; here, a finished
feature turned out to have no caller.

The refusal reasons the machinery gives are correct and informative, which is
how the measurement was possible at all:

```
1091  no action-speed window — an ally cannot attack here
 775  no action point left
  12  Swabbie costs 2 to attack and you cannot raise it
```

**FIXED IN v3.50.** `sparring.act` got an arena branch and a hero branch —
allies ranked WITH the hand rather than after it, because both cost the turn's
one action point. Driven: *"Gravy Bones attacks with Swabbie for 7"*,
seventeen times in one game, and his win rate went **5 → 19** over the same
210 matchups.

**AND THE FIRST RUN WITH A DRIVER REPORTED 3761 INVARIANT VIOLATIONS** — an
attacking ally on the board AND in `chainCards`. `declareAttack` already
excluded a weapon from that list and v3.44 added the second activation route
without giving the guard its sibling. **The invariant judge had been correct
and silent since v2.21 because nothing had ever handed it the state that
breaks.** That is the argument for this harness, stated from the other end:
a guard rail is only as good as the states that reach it.

**`death` and `gold` are STILL 0, and now for a stated reason.** The policy
always names the hero as its attack-target — CR 1.4.5 makes the choice
mandatory and the hero is the one answer always available. Choosing an ally
is a judgement about playing well (allies heal every turn under CR 4.4.3a, so
it is a per-turn race rather than attrition) and a policy that reads no card
text should not guess at it. **Oysten's death trigger therefore still has no
driver** — the remaining half of this finding.

---

## FINDING 3 — the policy cannot pilot a control hero (OPEN)

**Iyslander: 0 wins in 210 games**, and she is in all 13 remaining stalls.
Driven to the stalled state and asked directly:

```
seat0 Iyslander (ap 1, res 0)
   Stir the Aetherwinds   Wizard Action            -> LEGAL
   Ice Bolt               Ice Wizard Action        -> LEGAL
   Arcane Twining         Wizard Action            -> LEGAL
   Aether Icevein         Elemental Wizard Action  -> LEGAL
   policy proposes: {"t":"endTurn"}
```

**Four legal plays, an action point in hand, and the policy passes.** It ranks
attacks; her deck is nearly all non-attacks, so it has nothing to say. This is
not an engine bug — it is CLAUDE.md's own note (*"a deck with no rules text
suits a policy that reads no card text"*) at its extreme.

**It also means the hero ladder below says more about the policy than about
the decks.** Do not tune from it.

---

## FINDING 4 — Cosmo swings for 0 power, 413 times (OPEN, recorded at v3.44)

```
0-POWER SWINGS BY CARD          in 40 of 210 games
   413  Cosmo, Scroll of Ancestral Tapestry
   100  Raydn, Duskbane
```

They are **two different things**, and telling them apart matters:

- **Cosmo is the bug.** `power: null`, `parser.isWeapon` says **false**, and
  judge routes on `types.isWeaponType` (the TYPE) instead — so it swings a
  card with no power. Its printed text grants the attack to *auras you
  control*, not to itself, which is why `build.js` gives it no `powCard`
  either. The honest answer is that Cosmo has **no swing at all**.
- **Raydn is correct.** It is a real Weapon printing **power 0** with
  *"if you've charged this turn, this gets +3{p}"* — and **charge is unbuilt**
  (`pending` in the ledger). Its 0-power swing is the honest weaker-than-printed
  direction, and it will fix itself when Boltyn's soul engine lands.

**Tested as a fix this session and it did NOT help** — stalls went 14 → 15, so
the hypothesis that Cosmo drove the livelock was wrong. Reverted rather than
shipped on a guess. The change is one guard (`if(!PR.isWeapon(piece))` in
judge's weapon branch, both sites) and it deserves its own version with drills,
because it makes a card inert and that is a decision.

---

## The hero ladder — read it as a POLICY measurement

210 games, one seed per pairing. **This is not a balance report.** Finding 3
means it measures how well `sparring.act` pilots each deck, and it reads
attacks only.

```
hero        W   L    win%   avg turns to win   avg hp left
kayo       27   1    96%       17.6             9.3
viserai    24   4    86%       26.9             5.3
fai        24   4    86%       15.3             7.5
bravo      22   6    79%       25.1             8.1
dash       21   7    75%       34.1             6.6
boltyn     15  12    56%       22.5             8.6
arakni     15  13    54%       30.1             7.0
lyath      15  13    54%       40.1             6.7
dorinthea  10  18    36%       45.0             8.1
briar      10  18    36%       28.3             5.6
azalea      6  19    24%       31.5             4.2
gravy       5  20    20%       29.0             8.2
blaze       2  20     9%       41.5             1.0
enigma      1  23     4%       13.0             2.0
iyslander   0  19     0%        0.0             0.0
```

What is worth reading out of it anyway:

- **The aggressive decks that need no text win.** Kayo's whole deck is "a card
  with 6 or more {p}" and the policy plays exactly that.
- **Lyath takes 40 turns to win.** His halving static is unbuilt, so his cards
  fight at full printed power — and he still grinds. Worth re-measuring the day
  it lands; it is the biggest single unbuilt static in the pool.
- **Gravy Bones at 20%** is Finding 2 in one number: six allies in the deck,
  and the seat never attacks with any of them.
- **Enigma at 4%, winning in 13 turns when it wins** — a deck that either
  connects fast or does nothing, and Cosmo is a dead gear slot for it.

---

## For next time — how to use this

1. **Re-run after any rules change.** The harness is ~80 lines and takes about
   four minutes for 210 games. The three numbers that matter are the ones at
   the top: refusals, violations, malformed feed.
2. **Watch the STALL count.** It is the cheapest livelock detector this project
   has, and it is what found Finding 1.
3. **Watch the route coverage.** `death 0, gold 0` across 210 games is how
   Finding 2 announced itself — a feature with no caller looks exactly like a
   feature that works, until you count.
4. **A degenerate game is a bug report.** Both stalls here were real: one an
   engine bug, one a policy gap. Neither was visible to any tool in the repo.
5. **Do not tune from the ladder until Finding 3 is fixed.** A seat that cannot
   play non-attacks is measuring itself, not the decks.
