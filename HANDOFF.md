# Handoff — Dawnblade, at v2.64

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## THE PLAN, AND WHERE WE ARE IN IT

```
1. ENGINE       ✔ done
2. MULTIPLAYER  ✔ done — two humans, two hero decks, one game state
3. CARD RULING TESTING (the text boxes)   ← YOU ARE HERE
     KAYO ✔ complete — every card in his deck and gear is built
     next hero: see "WHICH HERO NEXT" below
```

**Phase 3 is being done ONE HERO AT A TIME.** Kayo was the pilot and is
finished. The method that worked is written down under "HOW A HERO GETS
DONE"; follow it rather than inventing a new one.

---

## WHERE THINGS STAND

- `npm test` → **834 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way.
- `npm run audit` → 405 unique pool cards, **305 full / 78 part / 22 none**.
  The coverage baseline was repinned at v2.64 after review.
- **v2.64 on `main`, pushed and live.** `origin` is
  `git@github.com:dawnblade-ai/dawnblade-ai.git` over SSH and **a push IS
  the deploy** — Pages serves `main` at the repo root. The user has given
  standing authorization to push without asking (2026-08-03).
- **Verify the deploy, not just the tests.** Check the URL returns 200 *and*
  that all **21** `engine/*.js` files do. Pages sometimes takes several
  minutes and a few polls to rebuild; poll until `APP_VER` matches.
- `node` is at `~/node/bin`, **not on PATH** —
  `export PATH="$HOME/node/bin:$PATH"`.

### THE EFFECTS PORT IS DONE (v2.53 + v2.62)

`runOps`, `execute` and `resolveStack` all live in **`engine/effects.js`**.
There is exactly **one copy of the card semantics** in the project. The
first two moved byte-identically by script; the third was
`() => setG(s=>{…})`, so its BODY moved and the wrapper stayed behind.

`makeEffects(ctx)` takes the trainer closures explicitly and **throws on a
missing key**. `test/effects.test.js` fails if the trainer's context literal
and the module's `CTX_KEYS` drift apart.

### WHAT THE NETWORKED TABLE STILL NEEDS

**Not location.** It is that `execute` does two jobs at once: it applies the
card's effect *and* **advances the turn structure** (it calls
`dummyDefence` inline and sets `mode:"stack"`), while `judge.js` drives
combat through `phase`/`step`/`chainCards`.

Separating *"what the card does"* from *"what happens next"* is the
remaining structural job, and the inline `dummyDefence` call is the first
knot in it. Until then:

```
SOLO  play  ->  Battle     every card effect, the regression harness
TABLE play  ->  judge.js   real decks, real costs, real CR turn structure,
                           and NO card text
```

### THE SOLO MIRROR IS REAL (v2.63)

Pick a hero, then set the **opponent dropdown on the loadout screen**
(`#foesel`) to the same hero. Seat 1 plays actual cards: `foePick` takes the
biggest attack it can pay for, `foePlay` pitches cheapest-first and swings
for printed power. The `[3,4,5]` escalation survives only for the **vanilla
dummy**, whose job is to be the one deck where nothing can be faked.

**The actor stays 0 for the swing.** `execute` calls `dummyDefence`, and the
whole block path (`toggleBlock`/`finishBlock`/`takeIt`) reads
`act(s).blockH` — flipping the actor would ask the attacker to block its own
attack. The actor is borrowed **only** around `runOps` for the card's own
effects.

*Limit:* only the opponent's **unconditional** effects fire. Conditional
attack triggers live in `fx.conds`, which only `execute` evaluates, and
copying that logic would be a second copy of the semantics.

`window.THROW_MODE = "coin"` replaces rock-paper-scissors while testing.
`rps.js` and the whole throw UI are untouched — set it to `"rps"` to restore
it, which is the plan before launch.

---

## HOW A HERO GETS DONE (the Kayo method)

1. **Find the hero's ONE mechanic.** Kayo's whole deck is "a card with 6 or
   more {p}" wearing three different sets of words. Read the deck list and
   the hero's printed text together before touching code.
2. **Read the hero ability first.** Kayo's clause 2 was worth *half the
   deck* — 22 of 47 cards satisfied his own threshold before it, 45 after.
   A hero ability that looks like bookkeeping can be the engine.
3. **Diff what the card PRINTS against what the engine GRANTS**, card by
   card. Every real bug this cycle looked like this, and **every affected
   card reported tier `full`** — they were read, and read *wrong*.
4. **Fix the RULE, not the card.** Five separate spellings of
   `(c.power||0)>=6` became `parser.pow6`. Never special-case a card by
   name; a drill should fail if a card's name appears in the wiring.
5. **Write the drill, then SABOTAGE it.** Non-negotiable — see below.
6. **Play it.** Several bugs this cycle were invisible to every tool.

---

## THE RULES THAT CAUGHT EVERY BUG

**1. NEVER INVENT CARD EFFECTS.** Teach the parser to read the text; never
special-case by name.

**2. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier and makes the audit claim it works.
(`fx.handAbility` deliberately does *not* touch `tier` for this reason.)

**3. READ THE WHOLE PHRASE OR REFUSE.** A loose substring silently drops
printed restrictions.

**4. SABOTAGE EVERY NEW DRILL.** Reintroduce the bug, watch it fail,
restore. **This caught three drills that proved nothing in one session** —
Strongest Survive shipped with no drill at all, Beaten Trackers' drill
grepped for a variable that survives deleting the gate, and a "never
reaches damage" guard keyword-matched a log string. **Pin the gate, not the
identifier.**

**5. ASSERT ON STATE, NEVER ON LOG PROSE.** Hands, life, zones, counters.

**6. THE USER READS CARDS FOR A LIVING. ASK THEM.** Every ruling this cycle
came from asking. They have explicitly invited it.

---

## THE TRAPS, IN ONE PLACE

- **A LOCAL MAY NEVER SHADOW `act`/`foe`/`you`/`opp`.** Block-scoped, it
  puts the global in the temporal dead zone for the *whole block including
  lines above it*. This shipped a crash (v2.54). `test/shadow.test.js`
  guards it.
- **THE TDZ BITES TWICE.** v2.63: `foeSwing` was called from a `useState`
  initializer — safe for a hoisted `function`, fatal once it reached for
  `gy` and `_EFX`, which are `const`s declared further down the component.
- **"YOUR ACTION PHASE" IS NOT `phase === "action"`.** In FaB the combat
  chain lives inside the TURN PLAYER's action phase, so defending on their
  turn is still "action". Gate on `turnPlayer === actorOf(n)` too.
- **WHEN A RULES FUNCTION MOVES, THE LEDGERS MUST FOLLOW IT.** A source
  guard aimed at the wrong file **passes by finding nothing**;
  `test/actor.test.js`'s anchors name their source file.
- **The database states the type twice** and they disagree on 5 records.
  `card.ty` is the authority; DFCs parse the front face of `tt`.
- **`youMut()`/`oppMut()` to write, always.** A per-side field written as a
  top-level game key silently does nothing.
- **Store the rng back** (`n.rng = rng`).
- **The browser caches `engine/*.js` hard.** Re-fetch with `cache:"reload"`
  then navigate with a fresh `?v=` before believing anything.
- **Driving the UI from JS needs one click per tool call** — two in a tick
  batch into one React render and the two-tap interaction re-arms.
- **Test at phone dimensions (393×852).**

---

## WHICH HERO NEXT

Ranked live by how much of each deck the parser reads (regenerate with the
snippet in `KAYO-GUIDE.md` §1). The best-covered heroes are the cheapest to
finish; the interesting question is which *axis* they test.

**Recommended: DORINTHEA (Warrior, chapter 2).** 22 full / 3 part / **0
unreadable**, and a **single** hero clause. She is the project's namesake —
the Dawnblade is the one Marvel-printing card pinned in `cards.js`. Above
all she tests the **weapon** path, which Kayo barely touched: her deck is
built on swinging one weapon repeatedly, and `CLAUDE.md` already flags "two
limits on a weapon swing, and they are different rules" (`oncePerTurn` vs
the tap) as a hazard nobody has exercised.

Alternatives, both reasonable:
- **Viserai** (Runeblade, ch1) — 20 full / 3 part / 0 none, hero ability
  already built. Tests runechants and arcane, a different axis again, and
  chapter 1 is the gentler curve.
- **Lyath Goldmane** — technically the best-covered deck (22/23) but
  chapter 3, and its crowd/boo mechanic is the least conventional.

**Leave Arakni for last** — 9 full / 7 part / 7 none is by far the least
built, and traps/marks are their own subsystem.

---

## THE JOB

**Build carefully, one piece at a time, and never claim more than is true.**
Read `CLAUDE.md` first, in full. Most entries exist because breaking the
rule already cost a real bug.
