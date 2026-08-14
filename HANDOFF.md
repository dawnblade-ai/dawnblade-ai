# Handoff — Dawnblade, at v2.73

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then `HANDOFF.md`. Most entries in both exist
> because breaking that rule already cost a real bug.
>
> **Your job, in this order:**
>
> **1. Engine step 3 — make Frostbite and Arcane Barrier real.** They are
> the last blocker for Iyslander, and both are currently filed `noop` in
> `parser.js` with a justification that is a fact about the old training
> dummy rather than about the rules. Those justifications expired in
> v2.71 when seat 1 got a real turn.
>
> - **Frostbite is a number on the screen with no rule behind it.**
>   Nothing creates one except a hardcoded line in `foeTurnIce`, and
>   **nothing consumes `frost` at all** — `effCost` does not read it,
>   `effects.js` never mentions it. Frost Spike's "create a Frostbite
>   token" resolves to nothing. Make it a real Aura under *their* control
>   that modifies `effCost`. This is exactly the v2.23 runechant move: a
>   bare counter made seven pool cards blind to runechants, and the same
>   is true here.
>   **RULING (user, 2026-08-10):** Frostbite taxes **one** play or
>   activation and is then destroyed — so the play that destroys it *is*
>   the one that is taxed.
> - **Arcane Barrier is 24 cards across all 15 heroes**, and a `noop`. It
>   is a payment made when the hero would be dealt arcane damage.
> - Seat 1 must be able to be *asked* to pay and to answer (Winter's Bite,
>   Cold Snap, Aether Icevein). `prompts.js`'s `pay` variant is already
>   side-addressed, and seat 1 can already pitch (`foePlay`).
>
> Ship it, push it (push IS the deploy), and verify the deploy.
>
> **2. Then: unify the two engines and give seat 1 to a policy.** See
> `HANDOFF.md` → "THE NEW DIRECTION". Do not start this with step 3
> half-built. Read "WHAT THE UNIFICATION ACTUALLY COSTS" before scoping
> it — `engine/sparring.js` already IS `act(game, seat)`, but
> `effects.js` still takes ~19 trainer closures.
>
> **How to work:**
>
> - **Census the shape pool-wide before fixing it** (`HANDOFF.md` step
>   3a). Every fix last cycle turned out to be a rule with a list behind
>   it, and the list was always longer than the hero.
> - **Fix the RULE, not the card.** Never special-case a card by name.
> - **Never invent card effects** — teach the parser to read the text.
> - **Write the drill, then SABOTAGE it**, and verify the sabotage
>   actually changed the file. Three drills went green against completely
>   broken code last cycle. Prefer a decision you can DRIVE over a source
>   scan; when you must scan, strip comments first.
> - **Assert on state — hands, life, zones, counters — never on log
>   prose.**
> - **Play it.** Three of the four bugs found last cycle were invisible to
>   every drill and to `invariants.js`. `npm test` green is the floor, not
>   the proof.
> - **Ask me about rules.** I read cards for a living and I would rather
>   be asked than have it guessed.
>
> Never claim more than is true.

---

## THE PLAN WAS REORDERED (user, 2026-08-12)

```
1. ENGINE          core mechanics, numbers & card types, phases & priority
2. HEROES & CARD TEXT
3. UI & NETWORK
```

Multiplayer/table/network was the OLD phase 2 and is already largely
built — under the new order it is **phase 3 work that landed early, and it
is FROZEN.** Do not extend the table or the netcode until phase 2 is done.

**Why the reorder matters, in one sentence:** the customer pulling on "one
rules engine" used to be the networked table; it is now phase 2 itself,
and it is more demanding — 13 more heroes of card text will be written
into whichever engine you point them at.

### Where we are

```
1. ENGINE   Four steps were planned; THREE SHIPPED this cycle.
     ✔ step 1 (v2.71) seat 1 takes a real turn
     ✔ step 2 (v2.72) instant-speed activation on their turn
     ✔ step 4 (v2.73) execute declares and stops
     ✔ step 3 (v2.74) Frostbite is an Aura; arcane damage has ONE choke
                      point, and the four preventions that were dead
                      state now hang off it. IYSLANDER IS UNBLOCKED.
   NEXT: unify the engines + give seat 1 to a policy — see below.
2. HEROES   KAYO ✔ (27 full / 2 part / 1 none) · DORINTHEA ✔ (29/4/0)
3. UI & NETWORK — frozen
```

---

## THE NEW DIRECTION (user, 2026-08-14) — AFTER STEP 3

**Unify the two engines, and give the opponent's seat to a policy.**

Those are one job, not two. Today:

```
SOLO  play  ->  Battle     every card effect; the opponent is a BRANCH
                           inside the rules (foePick/foePlay/foeVanilla/
                           dummyDefence)
TABLE play  ->  judge.js   real CR turn structure, real costs, and NO
                           card text
```

Nothing routes between them. The opponent has nowhere to *sit* because it
is not a seat — it is an `if` in the middle of the rules.

### THIS REVERSES A STANDING DECISION, DELIBERATELY

CLAUDE.md carried, from 2026-07-25: *"no AI opponent. The goal is real
multiplayer — two humans... do not build a deck-piloting AI."* The user
changed that on **2026-08-14**. Both dates are recorded so nobody
re-litigates it from the old note. Real multiplayer is still the goal; a
policy in seat 1 is now also a goal, not a detour.

### MOST OF THE GROUNDWORK EXISTS, AND v2.73 IS WHAT UNBLOCKED IT

| module | what it already is | state |
|---|---|---|
| `engine/sparring.js` | **`act(game, seat) -> action \| null` — a seat as a policy.** This IS the idea, already built and drilled (11 drills). | the ONLY module still in `wire.test.js`'s `HEADLESS` list, because nothing calls it |
| `engine/judge.js` | `reduce(state, action, seat)` — the CR turn structure as a pure function | live at the table |
| `engine/effects.js` | ALL the card semantics — and **phase-free since v2.73** | live in the trainer only |

v2.73 is the reason this is now reachable: `execute` used to run the defend
step itself, so only a caller with a dummy could use it. It declares and
stops; `afterDefenders` is the post-declaration hook; there are **zero
`mode` writes** in the module and `dummyDefence` is out of its context.

So the target shape is already three real modules:

```
judge.reduce   the turn structure     (has no card text)
effects.*      the card semantics     (has no phase)
sparring.act   the seat               (has neither)
```

### WHAT THE UNIFICATION ACTUALLY COSTS — read before promising a date

1. **`judge.js` must call `execute` / `afterDefenders` / `resolveStack`** at
   its DEFEND and RESOLUTION steps. This is the wiring v2.73 enables and it
   is **not started**.
2. **`effects.js` still takes ~19 trainer closures** in `CTX_KEYS` — `L`,
   `gy`, `gyDisc`, `openPrompt`, `winCheck`, `bAct`, `built`, `mkRune`,
   `tokSeq`… `judge.js` would have to supply every one. That is the next
   seam of the same kind `dummyDefence` was, and it is bigger.
3. **`effects.js` still READS `mode` in 4 places**, pinned by a drill
   (`"engine/effects.js states no PHASE"`): `resolveStack`'s own guard, the
   block-mode damage shave, and the two-branch `foeTurn` fallback. Those
   must speak `phase`/`step` before judge.js can drive them.
4. **`Battle` is still written against `mode`/`bphase`** throughout, and so
   is the whole solo UI.
5. **`sparring.js` reads NO card text on purpose**, and a drill fails on
   `require("./parser")`, on `fxParse`/`effCost`/`weaponCost`, and on
   reading `.tx`/`.kw`. A policy that pilots real decks *well* will want
   to. **That is a decision to make explicitly, not to drift into** — the
   reason for the rule is that a sparring partner playing badly and a card
   being read wrong must never be confusable.

### WHAT MUST SURVIVE

- **The trainer is the regression harness.** It plays every card effect
  today and is the only proof the semantics are right. Do not retire
  `Battle` before the unified path passes the same drills.
- **The vanilla dummy's `[3,4,5]` escalation is TUNED**; real cards are
  not. Retuning is a play session, not a drill.
- **`sparring.js`'s three properties**, each drilled and each proven to
  bite: it proposes and `judge.legal` disposes (a refusal is always a bug
  in the policy); it reads no card text; it is deterministic and never
  touches `game.rng` (ties broken on uid, or two equal blockers desync).
- **The winner follows the HERO, not the chair** — Kayo beats Dorinthea
  from seat 0 and from seat 1. That property is what says seat 1 is
  genuinely occupiable.

### THE TRAP THIS IDEA ALREADY WALKED INTO ONCE

Porting `dummyDefence` unchanged into `sparring.js` made the game
degenerate: **both seats blocked 41 of 41 attacks** and one finished a
21-turn game on full life. The heuristic was written for a seat with **no
action phase**, where a card in hand had no use but to block. Both seats
have an action phase now (v2.71), so `takeUpTo` — the damage a seat will
simply take rather than spend a card on — is load-bearing, and **lethal
overrides it**. A regression run that never deals damage never exercises
the damage step.

### ORDERING — DECIDED (user, 2026-08-14)

**Step 3 first. Then unify.** Not a judgement call any more — build it.

The reasoning that settled it: step 3 is card semantics, so it lands in
`effects.js` / `parser.js`, and the unification does not move either of
those. Nothing is thrown away by doing it first, and Iyslander ships
sooner.

**The one thing that would be wrong is starting the unification with step
3 half-built**, because then Frostbite and Arcane Barrier exist on one path
and not the other — which is the two-unrelated-bodies shape that let clash
fire on the wrong trigger for five versions. Finish step 3, ship it, then
start the unification from a clean base.

---

### WHY IYSLANDER FORCED ENGINE WORK FIRST

Five mechanics were filed `noop` in `parser.js`, and **every one gave a
reason about the training PROP rather than about the rules**:

| parser.js | the reason it gave |
|---|---|
| arcane barrier | "stops arcane damage — the dummy throws only fists" — **BUILT v2.74** |
| frostbite | "frostbite — dummy pays no costs" — **BUILT v2.74** |
| inertia | "taxes the opponent's action phase — the dummy has none" |
| freeze (Cold Snap) | "idle against the dummy's scripted swing" |
| "target hero may pay" | "the dummy pays no costs, so it always declines" |

A `noop` counts as ACCOUNTED FOR, so all of it reports tier `full` and **no
coverage tool can see any of it.** Iyslander's deck is built on those five,
which is why her `28 full / 3 part / 0 none` was measuring the wrong thing.

Steps 1 and 2 removed the *justifications*. **Step 3 made four of the five real** —
frostbite and arcane barrier in v2.74, inertia and "unless they pay" in
v2.75. **One is left:**

| noop | status |
|---|---|
| inertia | **BUILT v2.75.** The reason was wrong about the MECHANIC, not just the prop — it is a hand wipe at the beginning of its controller's end phase, not an action-phase tax. `DawnEffects.resolveInertia`. |
| "target hero may pay" / "unless they pay" | **BUILT v2.75.** `payOr` + `prompts.js` `elseOps` + `DawnEffects.payPolicy`. Winter's Bite had been deleting the opponent's printed escape entirely. |
| freeze (Cold Snap) | **STILL OPEN** — the last one. Ruled but not built; see below. |

**FREEZE IS THE ONE THING LEFT IN STEP 3.** RULING (user, 2026-08-14):
the opponent is prompted to pay; if they decline, **the CASTER** is
prompted to choose from the opponent's arsenal or an ally they control;
that object is frozen **until the start of the caster's next turn**, and a
frozen card cannot be played and its abilities cannot be activated. The
arsenal is chosen **blind** — pick the zone, not the identity, so hidden
information is preserved.

What it needs: a `frozen` marker with an expiry turn, a gate on
play/activation, a chained prompt back to the caster (`payOr`'s `elseOps`
resolve at the ASKED side, so the freeze op has to queue a sheet addressed
to `1-actorOf`), and Cold Snap's two sentences paired in `fxParse` the way
`optCost` pairs its halves — the splitter breaks them on the period.

The machinery all three want now exists: the `soak` prompt variant is
side-addressed, `DawnEffects.soakPolicy` lets seat 1 answer, and
`openPrompt` routes a seat-1 sheet to it. Two of those log lines are still
printed verbatim in play — see them by playing Cold Snap in the mirror.

### STEP 3 — what is left (Frostbite, Arcane Barrier)

- **Frostbite is a number on the screen with no rule behind it.** Nothing
  creates one except a hardcoded line in `foeTurnIce`, and **nothing
  consumes `frost` at all** — `effCost` does not read it, `effects.js`
  never mentions it. Frost Spike's "create a Frostbite token" resolves to
  nothing. Make it a real Aura under *their* control that modifies
  `effCost`, exactly the v2.23 runechant move (a counter made seven cards
  blind to runechants; the same is true here).
  **RULING (user, 2026-08-10):** it taxes ONE play/activation and is then
  destroyed — so the play that destroys it *is* the one that is taxed.
- **Arcane Barrier is 24 cards across all 15 heroes** and is a `noop`.
  It is a payment made when the hero would be dealt arcane damage.
- Seat 1 must be able to be *asked* to pay and to answer (Winter's Bite,
  Cold Snap, Aether Icevein). `prompts.js`'s `pay` variant is already
  side-addressed; seat 1 can already pitch (`foePlay`).

### STEP 4 IS DONE (v2.73) — what it means for phase 2

`execute` no longer advances the turn. `engine/effects.js` contains **zero
`mode` writes** and no longer takes `dummyDefence` in its context; the
trainer's `resolvePlay` owns the defend step, the reaction window and the
action phase.

```
execute  ->  _declared?  ->  defend step  ->  afterDefenders  ->  window
```

**This was taken out of order, before Iyslander, deliberately** — the
coupling was four sites in 455 lines, and every hero built on top of it
would have made it bigger. Card text can now be written without also
writing turn structure, which is what phase 2 needs.

`afterDefenders` is where text that needs the DEFENDERS TO EXIST resolves
(phantasm reads what was declared against the attack). If a new card needs
the same, it goes there, not back into `execute`.

**Still not routed to the table**: `judge.js` calls none of this yet. The
split is what MAKES that possible; wiring it is phase 3.

**"Complete" means the hero ability and the deck's mechanical spine are
built, not that every clause in every card is read.** Both finished heroes
still carry a handful of `part` cards, listed under "WHAT IS STILL OPEN"
below. Say it that way rather than "done" — a previous handoff said Kayo was
complete while the audit was quietly reporting all three of his hero clauses
as unrecognized, and nobody compared the two for eleven versions.

**Phase 3 is being done ONE HERO AT A TIME.** Kayo was the pilot and is
finished. The method that worked is written down under "HOW A HERO GETS
DONE"; follow it rather than inventing a new one.

---

## WHERE THINGS STAND

- `npm test` → **922 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way. It gained three checks
  in v2.66–v2.69 and each was verified to shout when its bug returns.
- `npm run audit` → 405 unique pool cards, **306 full / 77 part / 22 none**.
- **v2.73 on `main`, pushed and live**, verified serving: all 21 `engine/*.js`
  return 200 and the deployed `parser.js` carries the new symbols. `origin` is
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

### WHAT THE NETWORKED TABLE STILL NEEDS (updated v2.73)

**The separation is DONE** — `execute` declares and stops, and the caller
owns what happens next. What is left is purely wiring: `judge.js` must call
`execute`/`afterDefenders`/`resolveStack` at its own DEFEND and RESOLUTION
steps. That is phase 3 and it is frozen. Until it happens:

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

**Dorinthea confirmed the method and added one step.** Her whole deck is
"a WEAPON attack, swung twice" — the hero ability frees the blade for a
second swing, the Dawnblade rewards its *second* hit each turn, and the
Reprise family pays you for the opponent blocking from hand. Reading the
hero ability first explained the deck's go-again density before a line of
code was written.

**THE NEW STEP IS 3a: CENSUS THE SHAPE ACROSS THE WHOLE POOL BEFORE FIXING
IT.** Every fix this cycle turned out to be a rule with a list behind it,
and the list was always longer than the hero:

| the shape | on her deck | in the pool |
|---|---|---|
| a gated pump read twice | 6 cards | **7 cards, 4 heroes** |
| a printed `instead` summed | 4 cards | 4 cards, 3 keyword gates |
| a target restriction dropped | 9 cards | **13 cards, 6 heroes** |
| a quoted granted ability dropped | 6 cards | **7 cards, 3 heroes** |

One `node -e` over `tools/audit.json` gives the list in a minute, and it is
what turns "fix the card" into "fix the rule" — which is rule 4 below with
evidence attached rather than as an aspiration.

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

**4a. VERIFY THE SABOTAGE ACTUALLY CHANGED THE FILE.** Three sabotages in
the Dorinthea cycle silently matched nothing — a `==` written for a `===`, a
comment that did not match the comment in the file, a regex against text
that was never there. **A sabotage that edits nothing looks exactly like a
drill that does not bite**, and reads as a pass. Hash the file before and
after, or diff it.

**4b. A GREP IS SATISFIED BY A COMMENT — IN BOTH DIRECTIONS.** v2.68 shipped
a drill that stayed green with the gate replaced by `if(false)`, because the
identifier it searched for was sitting in the comment above the gate: a false
**pass**, which is worse than no drill. v2.66 hit the mirror image, where a
comment containing an example of a bug tripped a scan that was working
correctly — there the fix is to reword the prose, never to weaken the scan.
Prefer moving the decision into a pure engine function you can DRIVE
(`parser.idleCounterWipes`, `parser.rxPump` were both extracted for exactly
this); when you must scan source, strip comments first.

**4c. TAKE BACKUPS UNCONDITIONALLY.** `fairness | grep … && cp file /tmp/bak`
did not copy anything, because the summary line reads `4 finding(s)` and the
grep pattern said `findings`. The `&&` short-circuited, and the "restore"
afterwards reverted the file to a snapshot from an earlier round — silently
deleting a finished fix. Never chain a backup behind a test.

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
- **`computer` clicks time out on the deployed page; `javascript_tool` works.**
  Drive taps with `document.querySelectorAll('button')[i].click()`, still one
  click per tool call. Find a card by its image `alt` and its class prefix
  (`g ` = gear, `hc ` = hand rail) rather than by index, which shifts.
- **A `dummyDefence` stub must return `{n, note}`, not the state.** The Kayo
  test ctx returns the bare state and gets away with it because those drills
  only ever drive `runOps`; the moment you drive `execute` it reads
  `undefined.log` and dies.

---

## WHAT IS STILL OPEN ON THE TWO FINISHED HEROES

**Both end in the same place, and it is one rule, not seven cards.**

| hero | card | the unread clause |
|---|---|---|
| Kayo | Beaten Trackers | "you may destroy this. **If you do**, gain 1 action point" |
| Dorinthea | Refraction Bolters | "you may destroy this. **If you do**, the attack gains go again" |

That is the **"If you do, …" family**, deliberately unread since v2.04
because running the rider without charging the cost is the free-ability bug
that version fixed. The machinery to ask properly now exists —
`engine/prompts.js`'s `pay` variant, and `pick` with `min:0` — so this is a
spec object plus a queue site, not new machinery. **Build it once and both
heroes close**, along with the rest of the 24-card family (see CLAUDE.md,
"Optional costs").

The rest are genuinely separate, and each is small:

- Kayo: Agile Windup (`Instant - Discard this:` on a card in HAND),
  Rally the Coast Guard (the `+3{d}` rider).
- Dorinthea: Agile Engagement ("defended by an attack action card"),
  Oasis Respite (a life comparison across heroes), Wreck Havoc (turning a
  card in an opponent's arsenal face up).

---

## WHICH HERO NEXT

Regenerate this table rather than trusting it — the snippet is in
`KAYO-GUIDE.md` §1, and a per-hero version is in this session's scratchpad
pattern (walk `W.DECKS[k]`, normalise `name|pitch`, read `A.cards[...].tier`).

```
hero          full part none   hero ability
  lyath         29    2    0   UNBUILT
  iyslander     28    3    0   UNBUILT
  viserai       25    4    0   built
  dorinthea     29    4    0   built    <- done
  briar         23    5    0   UNBUILT
  kayo          27    2    1   built    <- done
  ...
  azalea        19    3    3   UNBUILT
  arakni        11    9    2   UNBUILT  <- leave for last
```

**Recommended: IYSLANDER.** 28 full / 3 part / **0 unreadable** — the
second-best-covered deck — and her hero ability is genuinely unbuilt, so the
"find the hero's one mechanic" exercise is real rather than already done.
Above all she tests **the two axes nothing has touched yet**:

1. **playing at instant speed from the arsenal** (her clause 1), which is
   the only hero ability that changes *when* a card may be played; and
2. **acting during the opponent's turn** (Ice → Frostbite). CLAUDE.md has
   long flagged that effects keyed to the opponent's turn stay inert — the
   solo mirror (v2.63) gives seat 1 real cards, so this is finally testable.
   Check that before planning around it.

Alternatives, both reasonable:
- **Viserai** (Runeblade, ch1) — 25/4/0, hero ability already built, tests
  runechants and arcane. The gentlest curve left.
- **Lyath** — the best-covered deck (29/2/0) but chapter 3, and its
  crowd/boo mechanic is the least conventional in the pool.

**Leave Arakni for last** — 11 full / 9 part / 2 none, and traps/marks are
their own subsystem.

---

## THE JOB

**Build carefully, one piece at a time, and never claim more than is true.**
Read `CLAUDE.md` first, in full. Most entries exist because breaking the
rule already cost a real bug.
