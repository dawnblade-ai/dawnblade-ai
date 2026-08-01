# The Opponent — sunsetting the dummy

**Decision (user, 2026-08-01):** the dummy stops being a training prop and
becomes an **opponent** — a fully playable side of the board that picks a hero
and is driven by very simple strategy. Everything from here is built
multiplayer-first. This document is the plan; it is deliberately slower than
the work it describes.

> Read `ROADMAP-MULTIPLAYER.md` alongside this. That document sequences the
> *state* work (actor/perspective, seeded RNG, pure reducer, hotseat → P2P →
> hosted). This one is about the *opponent* specifically: what it is, what it
> knows, and what it decides.

---

## Why the dummy has to go

The dummy is not a weak opponent. It is a **differently shaped** one, and that
shape has leaked into the engine in ways that will cost more the longer it
stays:

| the dummy | a player |
|---|---|
| never takes an action phase | takes one every turn |
| pays no costs, never pitches | pitches to pay for everything |
| swings a scripted `[3,4,5][(turn-1)%3]` escalation | plays a card from hand |
| holds a 30-card pile of vanilla Generic attacks with **no rules text** | holds a real 55-card hero deck |
| refills to `DUMMY_INT` every turn to stand in for the turn it never takes | draws to intellect in its own end phase |
| reshuffles its graveyard rather than decking out | decks out and loses |
| has no hero, no hero power, no equipment abilities | has all three |

Every one of those is a **special case somewhere in the trainer**, and each one
is a place where a rule is implemented once for you and not at all for them.
`newTurn` and `foeSwing` are the last two of the seven rules functions still off
the actor seam precisely because they encode the dummy rather than an opponent.

**The deck choice was correct and should be honoured on the way out.** The
dummy's pile is vanilla *on purpose* — it blocks with printed defence and
nothing about its behaviour is faked. Do not replace it with a real deck until
the opponent can actually resolve the cards in that deck. Trading an honest
approximation for a dishonest one is a step backwards even if it looks like
progress.

---

## What "very simple strategy" has to mean

The user's words, and the constraint is doing real work: **simple** is a
promise about *legibility*, not a licence to be arbitrary.

Three rules for the opponent's decision-making, in priority order:

1. **It may only do things the engine can already resolve.** If the parser
   cannot read a card, the opponent does not play it. This is the golden rule
   pointed at the AI: no special-casing a card by name to make the opponent
   look smart.
2. **Every choice it makes is logged with its reason.** "The opponent swings
   Head Jab (4) — its cheapest attack that still threatens." A sparring partner
   whose reasoning is visible teaches; one that plays well silently does not.
   This is also how its bugs get found.
3. **It never bluffs and never pretends to evaluate what it does not.** The
   existing seating call is the model: *"if it wins the throw it always elects
   to swing first, and the log says so. It is not evaluating the matchup, and
   it should not pretend to."* Keep that honesty everywhere.

A deliberately **non**-goal: strength. This is not an AI opponent project (that
decision stands from 2026-07-25 and is unchanged — the goal is two humans). The
opponent exists so that (a) the second seat is exercised by something, and
(b) solo play stays useful. If it plays badly but legally and legibly, it has
done its job.

---

## The phases

Each phase leaves the game **playable and honest**. No phase requires the next
one to have landed.

### Phase 0 — say what is fake (do this first, it is cheap)

Before changing behaviour, make the current approximations visible *in the
game* rather than only in `CLAUDE.md`. The log already narrates the CR turn
structure as of v2.35; extend it to the opponent's side:

- announce the opponent's start / action / end phases even while they are stubs
- when the scripted escalation fires, say so: *"The opponent swings 4 — scripted
  escalation, not a card from hand."*

**Why first:** it costs an afternoon, it makes every later phase's diff obvious
in play, and it is the honest thing to ship in the meantime.

### Phase 1 — the opponent picks a hero

The user: *"the opponent will always select a hero."*

- Pregame gains an opponent-hero choice (explicit pick, or random from the 15).
- `Battle` builds **both** sides through the same `built` path. Today `built.*`
  is the player's hero build captured in closure — `built.viseraiPassive`,
  `built.runeDmg`, `built.iceFrostbite`, `built.arsenalInstant`. **This is the
  real work of Phase 1**: each side needs its own build. CLAUDE.md already
  flags it as "the next layer after the helper migration".
- The opponent still does not act. It has a hero, a life total, equipment and a
  deck, and it blocks — which is strictly more honest than the dummy already.

**Landmine:** `DUMMY_INT` disappears here and the opponent draws to *its hero's*
intellect. The turn-1 refill (`newTurn` topping it up every turn to stand in for
the turn it never takes) must go at the same time, or the opponent draws twice.

### Phase 2 — the opponent takes an action phase

This is the phase that retires `foeSwing` and the `[3,4,5]` escalation, and it
is where `newTurn` and `foeSwing` come off the actor seam **together** — doing
them separately is wasted work, as the ledger has said since v2.24.

The decision procedure, smallest thing that is a real turn:

```
while it has an action point and a legal play:
  1. can it attack?  play the attack with the highest power it can pay for
  2. else can it play a non-attack the parser fully reads?  play the cheapest
  3. else pass
pitch only when a chosen card needs resources it does not have;
  pitch the lowest-value card that covers the cost (the advisor already ranks)
```

Note what is *absent*: no lookahead, no bluffing, no holding cards for a better
turn, no evaluating the player's board. Those are all things it would have to
do honestly or not at all, and "not at all" is the answer for now.

**Difficulty retunes here.** Change it with a play session, not with drills.
The escalation table and the score both read the trainer's `turn`, which counts
only *your* turns — reconciling that with `priority.js`'s player-turn clock is
part of this phase, not a separate one.

### Phase 3 — the opponent defends and reacts like a player

`dummyDefence` is already the most player-like thing the dummy does (printed
defence, declared free and simultaneously, equipment first, spends from hand
only while the swing still threatens). What it lacks:

- defence reactions from hand (instant speed, reaction step only)
- its own equipment abilities and hero power
- pitching to pay for any of that

### Phase 4 — the seat is a socket

At this point "the opponent" is just *the side that is not you*, and whether a
human or the simple strategy is driving it is one branch. That is the join with
`ROADMAP-MULTIPLAYER.md`'s hotseat phase, and it should be the moment the
opponent code stops being special at all.

---

## What has to be true before Phase 2 starts

These are not optional and each one already has a home:

1. **`priority.js` is wired for real.** The opponent cannot take an action
   phase while `mode`/`bphase` encode "the player is acting" as an invariant.
   This is roadmap item 1's last step and it blocks everything here.
2. **Both seats have their own hero build** (Phase 1 above).
3. **The invariant judge covers the opponent's zones.** It already censuses
   both sides; confirm it still sees every zone once the opponent has an
   arsenal, pitch and banish in active use rather than sitting at defaults.
4. **`judgeReport()` carries the opponent's decisions.** A bug in the
   opponent's play is exactly the kind that is hard to reconstruct afterwards,
   which is the problem JUDGE!! was built to solve.

---

## What to watch for

- **The escalation table is load-bearing for difficulty and for the score.**
  Removing `foeSwing` removes both. Decide what score means before, not after.
- **Going second is already untuned** (CLAUDE.md, "Known approximations"): the
  opponent-first opening reuses the turn-1 swing value and deliberately does
  not tick the clock. A real opponent turn changes this completely — retune the
  whole curve once, at Phase 2, rather than patching it twice.
- **The opponent must be able to LOSE by decking out.** The graveyard recycle
  is a dummy affordance ("a sparring partner that decked out would stop
  sparring"). A real opponent decks out and loses; that is a win condition the
  player currently cannot achieve.
- **Do not give the opponent cards the parser cannot read.** The moment it
  holds a real hero deck, every unread card in that deck is a card it will
  either misplay or refuse to play. `npm run audit` and `npm run fairness` are
  the gate, and the 32 `none`-tier cards are the list.
