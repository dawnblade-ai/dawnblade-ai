# Dawnblade — changelog

Extracted from the `APP_VER` comment in `index.html` at v2.32, where 19
versions of prose had accumulated on a single 14,723-character line that
shipped to every player on every page load. `index.html` now carries the
version and a one-line summary; the history lives here.

Newest first. `APP_VER` bumps by 0.01 per release (see CLAUDE.md).

---

## v2.73 — execute declares, and stops

**The knot the whole Phase 1 rebuild is named after.** `execute` did two
jobs at once: it applied the card's effect AND advanced the turn structure
— calling `dummyDefence` inline and setting `mode:"stack"` itself. That is
why the table could never call the card semantics: `judge.js` drives combat
through `phase`/`step`/`chainCards` and has no dummy to ask.

```
execute  ->  _declared?  ->  defend step  ->  afterDefenders  ->  window
```

`execute` now declares and returns. `resolvePlay` — the TRAINER's wrapper —
runs `dummyDefence`, calls `afterDefenders`, and says which phase follows. A
second caller brings its own.

**`afterDefenders` exists because some card text cannot resolve until the
DEFENDERS DO.** Phantasm reads the cards declared against the attack, so it
was never declaration-time text — and folding it in was what forced
`execute` to run the defend step itself.

### The measurable results

| | |
|---|---|
| `mode` writes in `engine/effects.js` | **0**, was 5 — pinned by a drill that strips comments first |
| `dummyDefence` in `CTX_KEYS` | **gone** — the one context key that described the trainer's opponent rather than cards |
| `activateInstant`'s capture-and-restore | **deleted** — v2.72 needed it because `execute` opened with `mode:"act"`; the window now simply survives |

### TWO REAL BUGS, BOTH FOUND BY PLAYING

**1. Going second opened turn 1 with ZERO action points.** v2.71 gave seat 1
a real end phase, and CR 4.4.3e says *all* players lose their points — so
seat 1's end phase correctly zeroed the point the initial state had handed
you, and the opening handoff never passes through `newTurn`, which is where
CR 4.3.2 issues one. You could not play a single action card on your first
turn. **Not an illegal STATE** — zero action points is what you have for
most of the game — so `invariants.js` cannot see it by construction, and all
914 drills were green.

**2. Seat 1 got 6 from Emeritus Scolding on its own turn, where it prints
4.** The `foeTurn` condition read `mode === "block"`, which means "they are
swinging at me" — but during the mirror's swing `foePlay` BORROWS THE ACTOR
to seat 1, and it is seat 1's turn. Stronger than printed, and
`npm run fairness` is one-sided against ever seeing it because the clause is
consumed either way. It now asks `turnPlayer !== actorOf`, which is the
question the CR actually asks.

### Trap 4b, three times in one change

Three drills went green against broken code before being rewritten:

- the routing drill grepped for the call it guarded, so `if(false)` left it
  passing **with the whole feature off**;
- a `mode:` scan tripped on its own explanatory COMMENT — the same trap in
  the failing direction;
- the `foeTurn` drill matched `turnPlayer !== actorOf(s)` in the source,
  which survives disabling the guard around it.

Each is now DRIVEN — `parser.instantAbilityReady` is a function a drill
calls, and the `foeTurn` pair runs Emeritus Scolding's printed text through
`execute` and reads the damage off the ACTOR'S FOE (hardcoding seat 1 there
reports a flat 0 the moment the actor is borrowed). **Every sabotage was
verified to change the file (rule 4a) and to bite.**

Driven end to end: pay → declare → dummy defends → reaction window →
resolve → action phase, and the opening handoff issues its action point.
0 invariant violations. **922 drills.**

---

## v2.72 — the half of the iron that had no window

**Spellfire Cloak prints `Activate this ability only during an opponent's
turn`, and `fx.activateIf.kind === "foeTurn"` has read that gate for
versions. The only function that consults it — `tryPlay` — refuses
outright while `mode === "block"`.** So the printed gate named a window
the engine could never be asked about while it was in it. Tapping iron on
their turn either declared a defender or opened the zoom modal; there was
no third thing it could do.

It is Iyslander's **only Chest piece**, so it is equipped in every game she
plays and was dead in every one of them. Crucible of Aetherweave
(`Once per Turn Instant`) was in the same position.

`activateInstant` is the route. It asks `priority.js` for the window
rather than restating CR 8.1.6, so it correctly refuses in the DEFEND step
where the turn-player holds priority (CR 7.3.3) — a refusal that is a rule
rather than an oversight.

**It resolves nothing itself.** The destroy cost, the graveyard stamp and
the ops are card semantics and there is exactly one copy of those, so it
calls `execute` and **restores the window afterwards**: `execute` returns
`mode:"act"`, and leaving that would hand the player their own action
phase in the middle of the opponent's turn — sev-3, illegal play allowed.

### Two limits that expire differently, now that they can diverge

`perTurnCleared` moved from `judge.js` to `parser.js` — the trainer
needed the same answer, and a second copy is the no-mirror rule broken in
slow motion. A TAP lifts only at its controller's untap step (CR 4.4.3d); a
`Once per Turn` **allowance** comes back at every turn boundary for both
seats. They coincide for a weapon swing and stop coinciding at the first
`Instant - Once per Turn` equipment ability, which is now reachable.

**Two real bugs were found by the drills, not by the code:**

1. `weaponCost` requires `": attack"`, so an equipment ability's line read
   as null and every ability was treated as an allowance —
   `tapsToActivate` reads the cost segment for `{t}`.
2. An ability's flag is namespaced (`"gp"+uid`) so it cannot collide with
   the piece's own swing — and the uid is a NUMBER while the flag is a
   string, so stripping `"gp9"` gave `"9"`, which never `===` 9. The
   piece was never found and a tapped ability untapped at the wrong
   boundary. Compared as strings now.

### A drill that went green against a disabled route

The first version of the routing drill grepped for
`activateInstant(gr.powCard,"hero",i)`. Replacing the gate with
`if(false)` leaves that text sitting in the source, so **it passed with
the whole feature switched off** — a false PASS, worse than no drill, and
exactly HANDOFF.md rule 4b. The decision is now
`parser.instantAbilityReady`, a pure function a drill can CALL. Both the
tap route and the window-opening check ask it, so they cannot disagree.

Driven: Spellfire Cloak activated in the reaction step of the opponent's
turn — 0 → 1 resource, the piece shattered, `mode`/`bphase` unchanged, no
action point spent, 0 invariant violations.

**8 new drills. 913 total.**

---

## v2.71 — the turn the opponent never took

**Five mechanics were filed `noop` in `parser.js`, and every one gave a
reason about the PROP rather than about the rules:**

| parser.js | the reason it gave |
|---|---|
| arcane barrier | "stops arcane damage — the dummy throws only fists" |
| frostbite | "frostbite — dummy pays no costs" |
| inertia | "taxes the opponent's action phase — the dummy has none" |
| freeze (Cold Snap) | "idle against the dummy's scripted swing" |
| "target hero may pay" | "the dummy pays no costs, so it always declines" |

Those are statements about a training dummy, not about Flesh and Blood —
and a `noop` counts as ACCOUNTED FOR, so all of it reports tier `full`
and no coverage tool can see any of it. **Iyslander's entire deck is built
on top of those five**, which is why she was the hero that forced this.

### Seat 1 takes a turn

`foeSwing` was one fabricated swing between two of your turns. It is now
a turn: `foeBegin` (start phase, CR 4.3.2's action point, a fresh
`hist`), `foeStep` (one action, called again after every chain link
closes), `foeWindowOrEnd` and `foeEnd`.

**`finishBlock` returns to `foeStep` instead of `newTurn`**, so go again
chains a second link for seat 1 the way it does for you — the escalation
could only ever swing once. Go again is a GAIN (CR 5.3.5), spelled out
rather than folded into a ternary, and read through `hasKwNow` so a
conditional grant does not hand out a free action.

### ONE END PHASE, NOT TWO

CR 4.4.3 (c)-(f) existed for seat 0 alone; seat 1's "end phase" was a
stand-in refill buried in `newTurn`. That is the same two-unrelated-bodies
shape that let clash fire on the wrong trigger for five versions.
`endPhaseCF(s, si)` is one copy, actor-relative throughout, and
`test/actor.test.js` moves it into MIGRATED — **6 of 7 now, was 5.**

ROADMAP-OPPONENT.md's warning was explicit: *"adding that one without
removing this one draws twice"*. Both halves landed together, and there is
a drill for the removal — because a double draw just looks like a generous
opponent.

### The window that did not exist

The only window on the opponent's turn was the reaction step of an
incoming swing — a window that exists **only if they attack**. `foeturn`
is the rest of it: their action phase with priority passed to you, mapped
in `priority.js` so `speedAllowed` returns instants only (CR 8.1.6) and
`canAct` cannot contradict it.

**RULING (user, 2026-08-10):** *"as though it were an instant"* is more
than dropping the action point — an instant may be played **any time the
player has priority**, where an action is confined to its own action
phase. So Iyslander's clause 1 is gated on "not your turn and you hold
priority", not on one combat step.

**A window with nothing in it does not open** — the rule `buildPrompt`
already follows — so solo play against the vanilla dummy gains no dead
tap. Verified: 0 windows opened across a Kayo-vs-Dummy game.

Iyslander's clause 2 moved out of `playArsenalInstant` into
`foeTurnIce`: it is an EVENT ("whenever you play an Ice card during an
opponent's turn"), and as a property of one route an Ice instant from
hand triggered nothing.

### Driven, not just drilled

Iyslander mirror: played Voltic Bolt from arsenal at instant speed during
their action phase — 18 → 15, a window that did not exist before. Kayo vs
the vanilla dummy: **3 swings across 3 turns**, the tuned [3,4,5] curve
untouched, end phases alternating, no doubled draw. **0 invariant
violations in both.**

**12 new drills, all sabotaged with the file hash checked (rule 4a).** 907
total.

---

## v2.70 — the half of the card that was thrown away

**Warrior's Valor prints two things and the engine kept one.**

> Your next weapon attack this turn gets +3{p}
> and **"When this hits, it gets go again."**

The `buffNext` rule stopped at the pump, so the whole quoted ability — the
half that makes the card a staple — was dropped. **Six physical cards across
her three pitches**, every one reporting tier `full`, because the clause was
consumed either way. Weaker than printed, so `npm run fairness` is one-sided
against ever seeing it.

**FaB prints a granted ability in QUOTES, and that is what makes this
readable rather than guessable.** The quoted text is a clause in its own
right, so it goes back through `classifyClause` instead of being
pattern-matched — `"When this hits, it gets go again"` already read as an
on-hit `ga`. Nothing is special-cased to a card, and the same rule picks up
**four more**: Azalea's Lace with Frailty / Bloodrot / Inertia and Gravy
Bones' Yo Ho Ho!. Seven cards, three heroes, one rule.

The rider travels on the **buffQ entry**, not on the card that granted it,
because it belongs to whichever attack eventually collects the pump. A buff
whose qualifier does not match keeps its rider and waits — verified with a
control, because a drill without one passes just as well when the qualifier
is ignored and every attack collects everything.

Driven end to end: play Valor, swing the Dawnblade at 3+3, it connects, and
the action point is **kept**. Swing a non-weapon attack instead and it takes
neither the pump nor the ability, and the buff is still waiting.

**5 new drills, all sabotaged.** 895 total.

### Dorinthea, after five versions

| | |
|---|---|
| hero ability | built — 1 of 1 clauses, was 0 |
| deck coverage | **29 full / 4 part / 0 unreadable** |
| bugs fixed | 2 stronger-than-printed, 3 weaker-than-printed, all reporting `full` |
| cards touched beyond her deck | 7 doubled pumps, 2 summed replacements, 13 dropped restrictions, 4 dropped riders — across Kayo, Azalea, Boltyn, Arakni, Gravy Bones and Enigma |

Still open on her deck, all four genuinely unbuilt rather than misread:
Refraction Bolters ("if you do" rider), Agile Engagement (defended-by-an-
attack-action check), Oasis Respite (the life comparison), Wreck Havoc
(turning a card in an opponent's arsenal face up).

---

## v2.69 — the restriction the reactions never had

**`buffNext` has carried its target restriction in `op[2]` since v2.30 —
that was the arrow-buff-landing-on-a-sword fix. `self`, the op every
REACTION uses, never got it.** The clause reader swallowed the words
between "target" and "attack" in a `[^.]*`, so **eleven pool cards granted
their pump to whatever happened to be swinging**:

| card | prints | granted it to |
|---|---|---|
| Puncture ×2 | "target **sword or dagger** attack gains +3{p} and piercing 1" | a bow |
| Pummel | "target **club or hammer weapon** attack gets +8{p}" | anything |
| Agile Engagement | "target **Warrior** attack gets +3{p}" | anything |
| Overpower ×2 · Ironsong Response ×2 · Out for Blood · Stroke of Foresight | "target **weapon** attack" | any attack action card |
| Scar Tissue · Two Sides to the Blade | "target **dagger** attack" | anything |

Sev-2, *an effect reaches illegal targets*. A restriction is a **legality**,
not a modifier — with no legal target the card cannot be played at all — so
the qualifier rides on the card (`fx.selfQ` / `fx.gaQ`) rather than on one
op, and `playRx` refuses by name instead of dead-tapping.

**And Run Through was half a card.** "Target sword attack gains go again"
parsed fine and the attack branch never read `fx.ga`, so its +2{p} rider
landed and the go again it is printed for did nothing. Weaker than printed —
the direction the sweep deliberately does not look in. No attack reaction in
the pool prints the keyword for itself, so on a reaction `fx.ga` can only
mean the target's.

### The sweep's third blind spot in one hero

`RESTRICTION-DROPPED` matched only the "your/the **next** … attack" wording
and only `fx.ops`, so it never looked at the reaction family at all. It now
reads the "**target** … attack" phrasing, and asks the CARD rather than an
op — `fx.self` and `fx.ga` are folded out of `fx.ops` by the dispatcher, so
an op-only check finds nothing to look at and then accuses a card that was
read correctly. The first version of this check did exactly that to Overpower
and Ironsong Response.

Reintroducing the bug reports **13 findings**, naming every card above.

### Two process failures worth writing down

**A backup chained behind a grep is not a backup.** The verification ran
`fairness | grep -E "…findings" && cp parser.js /tmp/bak`. The summary line
reads `4 finding(s)`, the grep matched nothing, the `&&` short-circuited, the
copy never happened — and the "restore" afterwards reverted `parser.js` to a
snapshot from an earlier round, silently deleting the whole fix. Take backups
unconditionally.

**A sabotage must be verified to have changed the file.** Three this cycle
matched nothing (a `==` for a `===`, a note that did not match the note in
the file, a regex against text that was never there). A sabotage that edits
nothing looks exactly like a drill that does not bite.

**6 new drills.** 890 total.

---

## v2.68 — the blade remembers

**The Dawnblade earns its own counters.** The project's namesake card sat at
tier `part` with both of its real clauses unread:

> The second time this hits each turn, put a +1{p} counter on it.
> At the beginning of your end phase, if this hasn't hit this turn, remove
> all +1{p} counters from it.

**RULING (user, 2026-08-09): the counters PERSIST and accumulate across
turns.** The removal clause only makes sense under that reading — it exists
precisely to punish a turn where the blade never connected. So the blade
grows while you keep hitting with it and falls back to printed the first turn
you do not. Driven end to end: it swings at 3, then 4, then 5.

Two swings is also exactly what the hero ability allows in a turn, which is
why the card rewards its **second** hit and not its third. That is the
design, and it is why the **ordinal is read off the clause** rather than
assumed — a fixture printing "the third time" reads as three.

Both clauses are **schedules, not on-play effects**, so `fxParse` hoists them
out of `fx.ops`. Left there, `runOps` would hand over the counter the moment
the weapon was activated, before it had hit anything.

The per-turn hit tally rides on `hist`, keyed by uid, for one reason: CR
4.4.4 already clears `hist` at the turn boundary, so "each turn" needs no
reset site of its own. Put beside the rust on `counters` it would never be
cleared, and every swing after the second would count as a second one. The
counters themselves *do* live on `counters`, because they outlive the turn.

The gear tile shows them in gold, distinct from steam and rust: a permanent
gain reads differently from a status.

### A drill that proved nothing, and the tell

The end-phase wipe lived inside `endTurn`, a Battle closure, so the only way
to check it was to grep the trainer's source for `hist.wpnHits` — **and that
string was sitting in the comment above the gate.** Replacing the whole
condition with `if(false)` left the drill green.

A grep satisfied by prose is a false **pass**, which is worse than no drill:
v2.66 hit the mirror image of this when a comment containing an example of a
bug tripped a scan that was working correctly. So the decision moved into
`parser.idleCounterWipes`, pure and driven with real gear, and the four
drills over it bite on the gate, on the printed-text read, and on the caller.

**Sabotage must be verified to have changed the file.** Two of this cycle's
sabotages silently matched nothing — one a `==` for a `===`, one a note that
did not match the note in the file — and a sabotage that edits nothing looks
exactly like a drill that does not bite.

**11 new drills.** Dorinthea's deck: **29 full / 4 part / 0 unreadable.**

---

## v2.67 — the blade swings twice

**Dorinthea's hero ability, built.** It read as **zero of one clause** — the
audit's own flag said so, and it is the whole reason her deck looks the way
it does:

> Once per turn Effect - When a weapon you control hits, you may attack an
> additional time with that weapon this turn.

Nearly every card in the deck either pumps a **weapon** attack or pays off a
**Reprise**, and both want the blade swinging more than once. Same role
Kayo's clause 2 played for him: a hero ability that reads like bookkeeping
and is actually the engine.

**RULING (user, 2026-08-09): it waives the weapon's own "Once per Turn"
limit and nothing else.** The extra activation pays the printed {r} again
and spends an action point again — which is exactly why the deck carries go
again on Sharpen Steel, all three Warrior's Valor, Hit and Run, Trot Along
and the Goblet. Handing it a free action point would have made the hero
strictly stronger than printed.

`weaponUsed[uid]` **is** the once-per-turn limit in this trainer, so the
ability is modelled by clearing that one key. The latch rides on `hist`,
which CR 4.4.4 already clears at the turn boundary.

Four things it deliberately does not do, each drilled:

| | |
|---|---|
| a swing **blocked to nothing** never refreshes | CR 7.5.5 — a hit is damage actually dealt |
| an attack **action card** never refreshes | the text says "a weapon" |
| a **second** hit never refreshes again | spent by triggering, not by being useful — which is why the Dawnblade rewards its *second* hit each turn and not its third |
| **another** weapon stays tapped | "that weapon" is literal |

`pend` now records the zone the attack was declared from. Inferring it at
resolution would mean re-deciding a question already answered.

### The audit ledger had drifted, silently, for eleven versions

`tools/audit.js`'s `HERO_STATICS` decides whether a hero clause reports as
recognized; `build.js` decides whether the passive exists. Two hand-written
copies of one question, and **nothing compared them** — so **Kayo's three
clauses reported "not recognized by any ability reader" ever since they were
built in v2.55**, while `HANDOFF.md` called the hero complete. Under-reporting
is the safe direction, but only if somebody is looking.

Both heroes now report **zero** uncovered clauses, and a drill fails if a
recognizer and the build it names ever disagree again — in either direction.

**14 new drills, every one proven to bite.** One sabotage looked like it
passed and turned out not to have matched the file at all; checking that the
sabotage actually changed something is part of the sabotage.

---

## v2.66 — the reaction that paid twice

**Phase 3, hero 2: Dorinthea.** The first pass over her deck found two
bugs in the *reaction* family, each affecting cards across several heroes,
and `npm run fairness` was **clean through both** — which turned out to be
structural rather than luck.

### The fallback read the same words twice

`fxParse` ends with a whole-text fallback: a non-attack whose "+N{p}" never
became an op still queues that pump. Its guard named **one** place an op can
live (`fx.ops`, and only a `buffNext`). A pump the parser had already routed
to `fx.conds` was therefore read a *second* time into `fx.self` — which both
**doubles it and deletes its gate**.

Ironsong Response is a single conditional clause:

> Reprise - If the defending hero has defended with a card from their hand
> this chain link, target weapon attack gains +3{p}.

It granted **+3 with the reprise unmet** (printed: nothing) and **+6 with it
met** (printed: +3). Seven cards across four heroes were doubled the same
way — Ironsong Response ×2 pitches, Hit and Run, Flying High, Mark of the
Huntsman, Raydn Duskbane, Courageous Steelhand — and **every one reported
tier `full`.** The guard now matches the pump's magnitude against all four
places an op can sit, so a card printing two different pumps still gets its
genuinely unread one.

### "Instead" was not read inside a keyword gate

v2.32 established that **`instead` REPLACES**. The generic if/when/while
handler has marked it ever since; **Reprise, High Tide and Surge each
hand-rolled their own two lines and none of the three did.** Overpower:

> Target weapon attack gains +4{p}.
> Reprise - ... instead it gains +6{p}.

Parsed as an addition, and `playRx` summed them: **+10 where the card prints
+6.** That is v2.32's Emeritus Scolding bug returning through a door the
original fix never covered. The three gates now share one helper, so a
fourth cannot reintroduce it.

### Why the sweep was blind, and what it reads now

`COND-BYPASSED` and `VALUE-DOUBLED` both read `uncondOps(fx)` — that is,
`fx.ops`. **`fx.self` is a first-class grant that does not live there**, so
the sweep built for exactly this bug class could not see it in the one field
it never read. `VALUE-DOUBLED` now scans conditional and on-hit ops too, and
a new **`INSTEAD-ADDED`** check catches a printed replacement being summed.

Verified rather than assumed: reintroducing the two bugs makes the sweep
report **7** and **2** findings respectively, naming the right cards.

### The arithmetic moved somewhere it can be drilled

The reaction pump was one hand-rolled line inside `playRx`, a React closure
no drill could reach — which is why a plain sum survived there long after
v2.32 settled the rule. It is now `parser.rxPump(fx, fired)`: pure, with
*which* conditions fired left to the caller, since that is the half that
needs the board.

**17 new drills, each proven to bite by sabotage.** One of them caught its
own comment — a code example of the bug reads exactly like the bug — and the
prose was reworded rather than the scan weakened, same discipline as
`sync.test.js`'s.

---

## v2.65 — the turn that never ended

**A three-tester round on the Kayo mirror, and the mirror could not finish
a game.** Two testers drove the engine headlessly; one played it at
393×852. The one that played it found the game-breaker, and that split is
the story of the round: **no tool in this project could have found it.**

### The soft-lock

`foeSwing`'s no-play branch — reached when seat 1 holds nothing it can pay
for — handed the turn back with a bare `mode:"act"`. `newTurn` is the ONLY
site that refills seat 1's hand, ticks the clock, closes the chain and
issues the player's action point, and the branch reached none of it.

**It is self-perpetuating by construction:** `foePick` needs cards in hand,
the hand only refills in `newTurn`, and `newTurn` is exactly what the
branch skipped. Once it fired it could never un-fire. The turn counter
froze, END TURN reproduced the position byte-for-byte, and the whole hand
stayed lit in the rail — the "looks playable, does nothing when tapped"
failure mode, on every card at once.

It hit on the **first opportunity** in a normal line: the opponent opened
with Buckwild, pitching two cards for three, and went to one card in hand.

`invariants.js` reported **zero violations** throughout, and correctly: a
control-flow dead end is not an illegal STATE. All 834 drills were green.
It is also **not Kayo-specific** — every real hero in seat 1 takes that
branch, and the vanilla dummy never does, which is why a year of solo play
never saw it.

### Three ways the mirror leaked value to the player

Each found independently, each confirmed against printed text:

- **the opponent's prompt was answered by the player.** `afterDiscard`
  queues Beaten Trackers' modal with `side: actorOf(n)`, but `promptConfirm`
  charged `youMut` and ran the ops at the ambient actor — so the sheet was
  drained on the player's next `execute`. `destroyGear` looked for seat 1's
  uid in seat 0's gear and skipped (its `return` exits one op, not the
  option), and the `["ap",1]` still fired. **A free action point every game,
  and the opponent kept the iron it was printed to destroy.** `spec.side`
  has meant "whose call is this" since v2.17; now the payout honours it.
- **`foePick` never read `fx.playIf`.** Bear Hug ("Play this only if you've
  pitched a card with 6 or more {p} this turn") and Run Roughshod swung with
  their gate unmet — sev-3 *illegal play allowed*, 4 deck copies. The gate is
  now one `playIfOk` both seats ask, borrowed as seat 1 so it reads seat 1's
  board rather than the player's.
- **Savage Feast's additional cost was never paid.** "As an additional cost
  to play Savage Feast discard a random card" — the opponent simply did not
  discard. The one place the mirror ran *stronger* than printed.

### One printed value the board was inventing

The hero row read the `[3,4,5]` escalation table **unconditionally**, so it
announced "NEXT SWING 3" while a real hero held real cards and swung for 7.
That is the "the player *trusts* the number on screen" category, and the
advisor's race maths sits beside it. A real opponent's next card is not
knowable, so it now reports what IS known — how many cards the hand holds.

### `payAddCost` — one copy, and it was already two

The additional-cost discard existed **twice, verbatim**, in `execute`'s
attack and non-attack branches; the mirror needed a third caller, which is
what surfaced it. Extracted to `engine/effects.js` as a **pure move** — the
body is byte-faithful, so a diff can tell the extraction from a behaviour
change. It deliberately does **not** carry the conditional payoff that
follows it in the attack branch: that is `execute`'s to evaluate, and the
mirror not firing it is the documented limit. Paying a cost without
collecting the bonus is the safe direction.

### The drill that proved nothing until it was sabotaged

`test/mirror.test.js` adds 10 drills, and **all 12 sabotages were run**.
One came back BLIND: the guard for `_opening` was written `/_opening/` and
passed with the entire gate deleted, because the **comment above it says
the word**. Pin the gate, not the identifier — the same lesson three drills
learned in v2.60–2.63, learned again.

---

## v2.64 — housekeeping, and a bonus that never reached the wall

### The bug the mirror found

Rally the Coast Guard's `+3{d}` was written to `s.defBonus` and then
**thrown away one line before the wall was totalled**: `takeIt`'s no-pause
path called `finishBlock(s, clashDef, {})`. A 2+3 defender locked the
defence at 3.

The whole suite was green, and reasonably so — `defBonus` had only ever
been *produced and consumed inside a single defpay cycle*, so nothing had
cause to check the other path. An activated ability that raises a defender
before `takeIt` is ever reached is new as of v2.61.

Both call sites carry it now, and it is **cleared in `finishBlock`** where
`blockH`/`blockG` clear (v2.46's rule) — otherwise a defender would carry
its `+{d}` into the next link for free. Both directions sabotaged.

### Round 1's findings, closed

Filed 2026-08-04 by a JUDGE pass, fixed now, both exactly where the
write-up said they were — reproduced from the report alone:

- **the table's seat-choice screen was unstyled.** It rendered
  `className="lobseat"` while every rule is scoped `.rps .rtitle` /
  `.rps .rsub` / `.rps .rseatpick`, so the winner's call arrived as
  unspaced run-on text: *"I go firsttake the initiativeThey go firstkeep
  the extra card"*. Clickable, and illegible. The solo `Pregame` wraps in
  `.rps` and always looked right, which is how the copy drifted.
- **the card preview rendered off-screen from the board panel.**
  `PeekDock` used `querySelector(".phand, .chand, .hand")`, which returns
  the first match in DOCUMENT order — on the table's three stacked screens
  that was the chain screen's rail, sitting mostly-but-not-quite off the
  top, which cleared the old "is it off screen" guard and produced a
  ~893px offset. The preview landed at y ≈ -365, invisible, for every card
  interaction on that screen.

  It now considers **every** rail and picks by **visible height**. That
  needs no refs and no knowledge of which board is rendering, which is what
  keeps one component serving both.

### Documentation

`HANDOFF.md` rewritten for the current state — it was two phases stale.
`CLAUDE.md` gains a Phase 3 section recording the **method** Kayo produced,
not just the cards: find the hero's one mechanic, read the hero ability
first, diff printed against granted, fix the rule rather than the card,
and sabotage every drill. The audit was regenerated and the coverage
baseline repinned after review — **40 tiers up, zero down**.

---

## v2.63 — the opponent plays real cards

**A true Kayo mirror, in single player.** With a hero in seat 1 the
opponent already had a real deck, real gear and real printed passives —
everything except a turn. Roadmap item 3 gives it one:

```
Kayo pitches Strongest Survive for 2.
Kayo plays High Pitched Howl — 6 power. Priority to you — react, block, or take it.
```

It picks the biggest attack it can pay for, pitches cheapest-first to cover
the cost, and swings for printed power. The `[3,4,5]` escalation remains
only for the **vanilla dummy**, whose whole job is to be the one deck where
nothing can be faked, and whose curve the difficulty is tuned to.

### Why the actor stays 0 for the swing

The obvious move is `actor:1` through `execute`, and it does not work:
`execute` calls `dummyDefence`, which picks blocks for seat 1, and the
entire block path (`toggleBlock`, `finishBlock`, `takeIt`) reads
`act(s).blockH` — with the actor flipped, the attacker would be asked to
block its own attack. That is the same actor work `foeSwing` is still
PENDING for.

So the swing is assembled directly and the actor is borrowed **only**
around the card's own effects, where `runOps` is fully actor-relative and
drilled to be. Everything the player then does runs on the unchanged path.

*Limit, stated:* only the card's **unconditional** effects fire for the
opponent. A conditional attack trigger (High Pitched Howl's "if there is a
card with 6+{p} in your pitch zone") lives in `fx.conds`, which only
`execute` evaluates — and replicating that here would be a second copy of
the card semantics, which is the one thing this codebase does not do. It
comes free once the defence hand-back lets the opponent's attack go
through `execute`.

### The temporal dead zone, again

The opening swing used to happen inside the `useState` initializer, which
is safe for a hoisted `function` — but what `foeSwing` *does* changed. A
real card play reaches for `gy` and `_EFX`, both `const`s declared further
down the component, and during the first render those are still in their
TDZ: `gy is not a function`, and the match died on load.

**Exactly the shape of the v2.54 clash crash** — a name that looks
available and is not yet initialised. The opening swing moved to a mount
effect. The cost is one frame in the action phase before the block step
appears, which the initializer existed to avoid; a visible flicker is a
fair trade for a match that starts.

### Housekeeping: the log names the card you played

Reported from play. The feed showed the pitch that paid for an attack and
then the opponent's defence, with **no line naming the attack itself** — so
the one thing the player actually did was the one thing the sequence never
mentioned. In a training sim the sequence is the lesson.

Attacks and non-attacks both announce themselves now, and the printed value
is shown alongside whenever the total differs, because "6 → 8" is exactly
what the player is trying to learn.

---

## v2.62 — one copy of the card semantics

`resolveStack` (122 lines) joins `runOps` and `execute` in
`engine/effects.js`. **All three are now in one place, and there is exactly
one copy of the card semantics in the project.**

It was the awkward one. The other two were plain closures and moved
verbatim; this was `() => setG(s => {…})`, so what moved is its **body** —
which was already a pure `s => s'` — leaving the React wrapper behind as
`() => setG(_EFX.resolveStack)`. The body itself is unchanged, and it
needed **no new context keys**: only `gearDef` and `gearBlockApply`, which
are `game.js` exports the module can import directly.

Verified in play, because `resolveStack` is the damage path and a drill
that reads source cannot see a wrong number: Agile Windup's ability
discarded it, created an Agility token, minted Might off clause 3 and left
the action point untouched — with the attack resolution path intact
underneath.

Two more drills had to follow the code, the same lesson as v2.53: one in
`priority.test.js` sliced `resolveStack` out of `index.html`, where it now
finds only the one-line wrapper. **A source guard aimed at the wrong file
passes by finding nothing**, so it is repointed and now also asserts the
slice is non-empty.

### What this does NOT do, stated plainly

**The table still runs no card text**, and location is no longer the
reason. The remaining obstacle is that the two engines speak different
state languages:

| | drives combat through |
|---|---|
| `execute` / `resolveStack` | the trainer's `mode` / `pend` / `stack` |
| `judge.js` | the CR machine's `phase` / `step` / `chainCards` |

`execute` does not merely apply a card's effect — it also **advances the
turn structure**, calling `dummyDefence` inline and setting `mode:"stack"`.
Separating *what the card does* from *what happens next* is the real
remaining work, and that inline `dummyDefence` call is the first knot in
it. Both are named in the module header rather than left to be
rediscovered.

---

## v2.61 — a card in your hand can have an activated ability

The last two unbuilt Kayo cards were blocked on the same missing thing, and
it was not a parser gap — it was that **there was no route**. Only gear
(`build.js`) and arena permanents (`boardPow`) ever got a `powCard`, so an
`Instant - Discard this: …` printed on a card in HAND was unreachable even
though its effect parses perfectly.

| | |
|---|---|
| Agile Windup | `Instant - Discard this: Create an Agility token` |
| Rally the Coast Guard | `Once per Turn Instant - Discard a card: This gets +3{d}` + *"Activate this only while this card is defending"* |

`parseHandAbility` is a **separate reader**, not a relaxation of
`parseHeroPower` — that one deliberately refuses a discard cost, and its
comment explains why (loosening it would raise the tier of cards nothing
wires). This exists because the trainer now wires it.

**The cost is the distinction that matters.** "Discard THIS" spends the
card itself; "discard A CARD" spends another one. Different costs, and the
caller has to tell them apart — the second also has to skip cards already
committed to the block.

**The ability is its own cell in the hand rail**, appearing only while it
can actually be activated. That is not decoration: Agile Windup is both a
playable attack action *and* a discard-for-a-token instant, and both are
legal in your own action phase — discarding it is a real Kayo line, since
a printed 5 is a 6 to him and the discard makes Might. One tap target
cannot mean two things.

**Rally's +3{d} does not go through `runOps`.** `finishBlock` reads a
per-uid bonus map, which is how `confirmDefPay` already routes a defence
buff onto one specific defender; `runOps` has no way to raise one.

**Three more pool cards come online for free** — Arcane Twining, Photon
Splicing and Reaper's Call all print the same shape. Nothing is
special-cased by name, and a drill fails if either Kayo card's name appears
in the wiring at all.

### And a bug found by watching it work

Activating Rally to block on the **opponent's** turn minted a **Might
token**. Clause 3 says *"during each of **your** action phases"*, and the
gate only checked `phase === "action"` — which is true there, because **in
Flesh and Blood the combat chain lives inside the TURN PLAYER's action
phase**. Defending against their swing is still an action phase; it is just
not yours. The turn now has to be the actor's own.

Confirmed live in exactly the state that produced it: `phase: "action"`
with `turnPlayer: 1`. No drill in this repo asked that question, and no
tool could — the card parses perfectly and the phase really was "action".

*Known limit, stated:* "discard a card" is the player's choice, and the
trainer auto-picks the lowest advisor value rather than prompting — the
standing approximation `CLAUDE.md` already records for every other cost. A
`pick` prompt is the upgrade, and it needs a uid-exclusion the spec does
not carry yet.

---

## v2.60 — Beaten Trackers, and the word the hero ability doesn't have

> "Whenever you discard a **random** card with 6 or more {p}, you may
> destroy this. If you do, gain 1 action point. Battleworn."

Both clauses were unread. It now hangs off the same `afterDiscard` hook
clause 3 uses — **but not on the same event**, and that is the whole care
in this change:

| | triggers on |
|---|---|
| Kayo clause 3 | **any** discard of a 6 or more, first per action phase |
| Beaten Trackers | only a **random** one |

Reading the two as the same event would hand out a free action point every
time a cost was paid by choice. The two discard call sites now say which
kind they are, and Savage Feast reports itself as random because its own
text says so.

**"You may" is a real decision**, so — RULING (user, 2026-08-08) — it
prompts every time it triggers, as a `modal` with the piece named and the
alternative spelled out. An action point against a block is a genuine
trade, and Kayo triggers this often enough that taking it silently would
be making the choice for the player.

Matched on the piece's **printed text**, never by name; a drill fails if
the string "Beaten Trackers" appears in the trigger at all.

**Two sabotages, and the first one caught a weak drill.** Removing the
`&& atRandom` gate produced **zero** failures, because the check merely
grepped for the variable — and deleting it from the condition leaves the
declaration behind. It pins the gate itself now, and bites.

---

## v2.59 — the escape hatch Strongest Survive prints

> "When this hits a hero, they discard a card **unless they reveal a card
> from their hand with {p} greater than the damage dealt this way**."

`classifyClause` returned **byte-identical output with and without that
second half** — `[["foeDiscard",1]]` either way. The defender's escape did
not exist, so all six copies in Kayo's deck discarded unconditionally:
stronger than printed, which is the direction that steals games.

Three things the fix has to get right, each drilled and each sabotaged:

| | |
|---|---|
| **the damage DEALT** | what actually landed, after blocks (`lastDmg`) — not the attack's printed power. A 7-power swing stopped to 3 is beaten by a 4. |
| **whose build** | the revealed card is read with the DEFENDER'S own build, so in a Kayo mirror their clause 2 lifts their hand exactly as yours lifts yours. `bFoe`, never `bAct` — the same mistake that helper was created to prevent in the clash. |
| **who decides** | RULING (user, 2026-08-08): the dummy reveals whenever it legally can, so the card plays at full printed strength against you rather than being quietly better than printed. |

Ordered **above** the bare `foeDiscard` rule so the qualified sentence is
claimed by the qualified reader — the same hazard as the unanchored draw
that swallowed a discard in v2.55.

**The sabotage pass earned its keep here.** The first run of it showed the
strike-total guard biting and the reveal guard *not* — because I had
written the fix without writing a drill for it at all. Dropping the escape
produced zero failures. Three drills now cover it and all three bite:
removing the escape, reading the defender's hand with the attacker's build,
and comparing against printed power instead of damage dealt.

That same pass caught a **false positive in my own earlier drill**: the
"clause 2 never reaches the damage path" check keyword-matched whole lines,
and flagged a log string containing the word "dealt" plus a `zonePow`
reading a card in the defender's *hand* — a perfectly legal threshold. It
strips template strings and looks for assignment into a damage quantity
now, with a positive assertion beside it so it cannot pass by finding
nothing.

---

## v2.58 — a cost that was never paid, and a chest piece that was never live

### Savage Feast

> "As an additional cost to play **Savage Feast** discard a **random** card.
> When you attack with Savage Feast, if a card with 6 or more {p} was
> discarded as that cost, draw a card."

**Two things in one printed line defeated the pattern**, and `fx.addCost`
was therefore never set on any card in Kayo's deck:

1. the card **names itself** instead of saying "this", with no comma after
   the name. `chargeCost` on the very next line already allows that
   alternative and explains why; `addCost` never got it;
2. `discard (a|…) cards?` cannot span the word **random**.

So the cost went unpaid and the rider asking about it read an unrelated
event — cost skipped, payload collected, the exact shape v2.04 fixed
elsewhere.

**`random` is captured, not merely tolerated.** The engine's auto-discard
picks your **lowest-value** card, which is strictly better than a card that
prints "random". It is a seeded random draw now, so a replay and a peer
feed the cost the same card.

The cost discard also stamps `gyDisc` and records `_discWay` — without
either it is indistinguishable from a card that was merely played, and
neither the card's own rider nor Kayo's clause 3 can see it. And a third
wording joins the resolution-scoped condition: *"discarded as an additional
cost to play it"* means the same as "this way".

### Predatory Plating

> "Instant - Destroy this: Gain {r}. Only if you control a card with 6 or
> more {p}."

`controlPow` read the arena and equipment only. Kayo's highest-power object
in either is Mandible Claw at **3**, so the ability was unactivatable in his
deck and read as a dead card.

RULING (user, 2026-08-08): **arena + equipment + an attack on the combat
chain** — which is what makes a chest piece that pays you for committing to
a big swing reachable at all.

*Limit, stated rather than hidden:* only the LIVE attack is counted, not
links that have already resolved. The trainer's chain history keeps a name
and an image rather than the card object, and widening it would put a full
card on every link — which is what the 16KB table-snapshot budget exists to
prevent. The live attack is the window this is used in.

`zonePow` is deliberately not used here: the chain is the one zone clause 2
excludes, and gear is not an attack action card.

---

## v2.57 — the keyword that was never earned, and a coin

### Pulping had dominate on every swing

> "If a card with 6 or more {p} is discarded this way, this gets dominate."

`hasKw` answers from **either** `card_keywords` **or** the raw text, and
dominate appears in both — inside its own conditional sentence. So the
defender was held to one card on every Pulping swing and the printed gate
was decoration.

**This is v2.31's lesson, four versions late.** That release established
that `card_keywords` is an INDEX, not a claim of unconditional possession,
and fixed it for `fx.ga`. It was never applied to `hasKw`, which is what
the trainer asks for every *other* keyword.

`kwGated` generalises the discriminator, and **a trigger is not a gate**:
*"When this attacks, intimidate"* (Smash Instinct) fires every swing, so
treating it as conditional would turn the card off — the opposite error.
`if`/`unless` gate; a bare `when`/`whenever` does not, unless the
when-clause carries a nested `if` (Spectral Rider). Across the whole pool
exactly three keywords are gated this way, and the third is Smash
Instinct's, which this correctly does **not** flag.

**Refusing the grant is only half a fix** — it would leave the card doing
nothing. `this gets dominate` now parses to `gainKw`, so the keyword
arrives when the condition actually fires.

### The sweep that should have caught it

`tools/fairness.js` listed six keywords, computed both discriminators, and
ended with `&& k === "go again" && fx.ga`. **Five of the six were
discarded** — the list was decoration, which is exactly why the sweep sat
clean over a live sev-3. It compares the printed text against
`hasKwNow` now, the same predicate the trainer asks, so it is a real
comparison rather than a restatement of the parser's own opinion.

Reintroducing the bare-`hasKw` reading makes it report Pulping and
Spectral Rider, and nothing else — verified.

**It also caught my own bug on the way in.** A first cut ran the
standalone-line check against `clean()`ed text, which collapses the
newlines that rule depends on, and reported Loot the Arsenal and Loot the
Hold — both of which print "Go again" on its own final line and happen to
carry an "If you do, …" inside a *quoted* ability granted to another card.
The layout rule reads raw text now.

### A Block has no play

Test of Might prints no cost, 4 defence and *"When this defends, …"*. Read
as an ordinary non-attack it was a **free 0-cost play** that spent your
action point and did nothing — sev-3 "illegal play allowed". `judge.js`
has refused this since v2.47 through `types.js`; the trainer never did, and
Kayo runs two copies. It now asks `DawnTypes.isBlock` and says why.

### The coin (a testing affordance)

`window.THROW_MODE = "coin"` replaces rock-paper-scissors, whose ties
replay and can cost half a dozen taps before a game starts. **`rps.js` and
every line of the throw UI are untouched and still drilled** — set the flag
to `"rps"` and it returns exactly as it was, which is the plan for launch.

Two things deliberately unchanged: the flip is drawn from the **same seeded
sub-stream**, so a match is still reproducible from its seed; and the
**winner still chooses** the seating, because "the winner decides who goes
first" is the rule, not a feature of throwing hands. A coin that seated you
directly would be a rules change wearing a convenience hat.

---

## v2.56 — the tokens fire, and clash learns to count

**Might, Agility and Vigor parsed perfectly and could never happen.** All
three print *"At the start of your turn, destroy this, then …"*, all three
resolve to exactly the right ops — `buffNext 1`, `gaNext`, `res 1` — and
all three were **inert**, because nothing in the engine had a start-of-turn
schedule for them to fire on. They accumulated on the board forever.

That silently made **seven of Kayo's cards decoration**: Clash of Agility,
both Clash of Mights, Test of Might and High Pitched Howl all exist to
create one. A coverage tool cannot see this — every card reads `full`.

The trigger goes in the start phase, which is where CR 4.2 puts turn-start
triggers and where the code's own comment already said they belonged; the
crumbling auras were the only ones there. It matches on the **printed
text**, never on a token's name, and runs the token's own parsed ops.

*Stated rather than hidden:* a token that leaves the arena strictly ceases
to exist, and these go to the graveyard like the crumbling auras above
them. Nothing reads them there — Kayo's discard checks require the `_disc`
stamp — so it is a display difference, not a rules one.

### Clause 3

> "The first time you discard a card with 6 or more {p} during each of your
> action phases, create a Might token."

Three things in that sentence do work: a **latch** (only the first), the
shared **6+** test (so clause 2 applies to it), and **"during each of your
action phases"** — RULING (user, 2026-08-08): a discard in the end phase,
or on the opponent's turn, makes no Might. So it asks the CR phase, not
merely whose turn it is. The additional-cost discard is the one path not
yet wired to it, which is a gap rather than a decision.

### Clash was comparing the wrong numbers

Clash compares the power of the top card of each deck — and **a deck is a
zone other than the combat chain**, so Kayo's clause 2 reaches it. Watching
a real clash resolve showed `Wild Ride (6)` where the card is a 7.

This is the first rule that asks about **the other hero's build**, which is
the condition CLAUDE.md set for `bFoe` existing at all. Each revealed card
is read against its own owner's build; one shared helper would apply the
revealer's buff to both cards, and a drill bites on exactly that mistake.

Also noticed, not yet chased: the dummy's pregame throw tied four times in
a row while cycling rock → paper → scissors in lockstep. It may be the
seeded stream for that seed, or the throw may not be drawing randomly.
Recorded here rather than asserted either way.

---

## v2.55 — Kayo learns to read

Phase 3 proper: the first hero taken card by card. Three things were
wrong, and **the coverage audit reported `full` on every affected card**
— they were read, and read wrong.

### Clause 2 — the hero ability that was doing nothing

> "Attack action cards you own get +1{p} while they are in any zone other
> than the combat chain."

**The combat chain is where an attack strikes, so this is not a damage
buff — it is a THRESHOLD rule.** A printed-5 attack action is a 6 in
hand, in the pitch zone, in the graveyard, in the arsenal and in the
deck, and reverts to 5 the instant it is declared.

That distinction is the whole hero. Kayo's 47-card deck holds 22 cards
printing 6 or more and **23 attack actions printing exactly 5** — and
those 23 are precisely the pitch-2 and pitch-3 cards you pitch for
resources. So *"if there is a card with 6 or more {p} in your pitch
zone"* (Buckwild, High Pitched Howl, Rough Up) almost never fired: you
pitch blues, and blues print 5. **22 of 47 → 45 of 47**, and the two
that stay out are the Test of Might copies, which are `Block` cards and
not attack actions at all.

RULING (user, 2026-08-08): every 6+ check reads the buffed value; the
strike reads the printed one. Verified in play — a Wild Ride resolving
with `total: 6` against a printed 6 while the same engine called a
discarded Strongest Survive a 7.

**One question, asked in one place.** `(c.power||0)>=6` was written out
five separate times across `index.html` and `effects.js`. That is the
shape `rxAllowed` replaced in v2.40 and it drifts the same way, so it is
now `parser.pow6(card, build)`. The +1 is read off the hero's printed
text rather than hardcoded — the clause names its own number, and
inventing it in the engine would be inventing card text.

`atkPowOffChain` is a **number**, which broke two drills asserting every
passive is a boolean. Rather than force it into a boolean and hide the 1
somewhere else, `PASSIVE_TYPE` now records what each passive answers in,
and a drill holds every build to it.

### The discard that was silently deleted

> "When this attacks, draw a card then discard a random card."

`classifyClause` matched `draw (a|an|...) cards?` **unanchored**, so it
returned `[["draw",1]]`, filed the clause `run`, and the discard ceased
to exist. There was no "discard a random card" pattern in the parser at
all. Bare Fangs, Wild Ride and Pulping drew for free and never paid.

### "This way" is not "this turn", and neither is "the graveyard"

The riders hanging off that discard read *"if a card with 6 or more {p}
is discarded **this way**"* — the discard the card itself just made. It
was implemented as `had6ThisTurn`, which asked whether **any** 6+ card
had reached the graveyard this turn. **An attack card is put into the
graveyard at DECLARATION**, so the condition was satisfiable by any
6-power attack already played that turn — including, at some points in
the resolution, by the attacking card itself.

Three separate things now:

| | |
|---|---|
| `discard6way` | what THIS resolution discarded (`_discWay`, cleared per resolution) |
| `discard6` | a real discard **this turn** — `_disc`, stamped only by an actual discard |
| the graveyard | no longer answers either question |

`discardRandom` is a real op: seeded (two peers and a replay must discard
the same card), and it honours Reincarnate, which prints *"When this is
discarded at random, put it on the bottom of its owner's deck"* — so it
is discarded (and still answers "this way") without ever reaching the
graveyard.

`had6ThisTurn` also read `you(` rather than `act(` — a rules question
answered from seat 0's perspective, the v2.24 bug class. Fixed in the
same line.

**`test/kayo.test.js` pins all of it**, and four sabotages were run and
all four bite: deleting clause 2, letting it lift a `Block`, dropping the
discard half again, and counting the whole graveyard again. One drill
guards the direction that steals games — `zonePow` may never appear on a
line that computes damage.

---

## v2.54 — the clash that crashed the trainer

**Blocking with any clash card threw and took the game down.** In
`takeIt`'s clash loop:

```js
const myTop = act(clashState).deck[0], foeTop = foe(clashState).deck[0];
const mine  = myTop ? (myTop.power||0) : 0, foe = foeTop ? (foeTop.power||0) : 0;
```

The `const foe` on the second line is **block-scoped**, so it puts the
global `foe()` helper into the temporal dead zone for the *whole* block —
including the line above it. `foe(clashState)` therefore binds to the
number, not the function. Native ES throws *"Cannot access 'foe' before
initialization"*; Babel rewrites the const to a hoisted `var _foe`, which
is why what actually shipped was **`TypeError: _foe is not a function`**.

**Seven of Kayo's 55 cards are clash cards.** Clash is his mechanic.

**Why nothing caught it.** Clash resolves on **defence** (v2.12 moved it
there, correctly), so it only fires when you *block* — and every
attack-side drill and play session goes straight past it. It is invisible
to the audit and to the fairness sweep by construction: the card parses
perfectly and is granted exactly what it prints. Nothing here is a rules
question at all. It was found by reading a browser console after two
testing sessions died without reporting, one of them stopping on the
words *"A crash."*

**`test/shadow.test.js` is the guard**, and it is the generalisation
rather than a patch: **no local binding may shadow `act`/`foe`/`you`/
`opp`/their Mut forms/`actorOf`**, as a declaration *or* as a parameter.
CLAUDE.md has warned about this class since v2.25, when `tapTwice`'s
third parameter was renamed from `act` to `commit` — but a warning in
prose is not a guard, and the same shape was sitting in `takeIt` the
whole time. Both sabotages were run and both bite.

Two further shadows were found and renamed to `cellAct` while they were
still harmless: the table board's gear and hand cells each declared a
local `act` meaning "the action this cell fires". Neither reaches for the
acting side today, which is precisely how the crashing one survived.

Verified in play, not just by drills: Kayo blocks a swing with Test of
Might, the clash reveals Buckwild (7) against Critical Strike (4), the
Might token is created, and the trainer does not fall over.

---

## v2.53 — the effects port, part one

**Phase 3 begins, and it begins structurally.** Card rules text resolved in
solo play and nowhere else, for one reason: `runOps`, `execute` and
`resolveStack` were closures inside the `Battle` component, so `judge.js` —
which runs the two-seat table — had no way to reach them. That split was
deliberate while it lasted (*a control-flow bug and a card being read wrong
must never be confusable*) and it ends the way the v2.20 no-mirror rule
ended the last one: by there being exactly **one copy**.

**`engine/effects.js` now holds `runOps` (234 lines) and `execute` (455).**

**THE BODIES WERE MOVED, NOT REWRITTEN.** They were extracted by script and
were byte-identical at the commit that moved them — verified, not asserted.
That is the whole safety property: the live trainer plays every card effect
today, so it is the regression harness for its own port, and any port that
*changes* its behaviour is wrong by definition. Fixes come afterwards, as
their own commits with their own drills, never smuggled into a move where no
diff can tell the two apart.

**What the move is guarded by**, since a port is exactly the kind of change
that rots quietly:

- `makeEffects(ctx)` **throws on a missing context key** rather than letting
  a moved body silently capture a browser global. All 17 are named.
- `test/effects.test.js` fails if the trainer's context literal and the
  module's `CTX_KEYS` **drift apart** — adding a dependency and forgetting
  the call site is the failure this port could otherwise hide for weeks.
- the **no-mirror rule** is pinned per moved function: re-declaring `runOps`
  or `execute` back inside `index.html` fails a drill by name.
- **all three sabotages were run and all three bite**, then restored.

**`test/actor.test.js` FOLLOWS the functions rather than losing them.** The
actor ledger slices bodies out of `index.html` by anchor pairs; two of its
anchors just left the file. A ledger that stops scanning a body keeps
reporting it green, which is worse than never having scanned it — so anchors
now name their source file, and `runOps`/`execute` are still held to the
actor rule in their new home. Three other drills that pinned a line of
`execute` by reading the source were repointed for the same reason: **a
source guard aimed at the wrong file passes by finding nothing.**

**Verified in a real game, not just by drills.** Kayo vs. the dummy at phone
dimensions: pitch → pay → play → the dummy's defence → resolution → back to
the action phase, with zero console errors and zero invariant violations.
The port is only true if the trainer still plays.

**What is NOT done, stated plainly:** `resolveStack` is still in `Battle` —
it is `() => setG(...)`, React-coupled, so it is a small refactor rather than
a move. And **the table still does not run card text**: reaching that needs
`judge.js` wired to call this module, and `execute`'s inline `dummyDefence`
call turned into a hand-back so the defend step can run. Both seams are named
in the module header rather than left to be rediscovered.

Also: the `APP_VER` comment had grown back to 3,711 characters shipped on
every page load. It is one sentence again, per the rule that created this
file.

---

## v2.52 — the preview that ate the tap, at the table

**Reported from a real table (2026-08-04):** during a payment, the two-tap
commit worked for the leftmost hand cards and silently failed for the ones
nearer the middle — the card un-peeked and nothing was pitched, with no
refusal shown. The reporter named the failure class correctly: it is
v2.36/v2.37's pointer-events bug, reached by a different door.

**`--peekbot` was measured in a `uE` inside `Battle`.** The table renders
the same `PeekDock` and had no such effect, so its dock fell back to the
CSS's flat `112px`. Measured on the hand screen at 393×852 the rail spans
y 628..754 and the correct offset is **233px**; at 112px the preview lands
*inside* the rail, and since `.peekwrap>*` takes pointer events (v2.36's
own fix) a tap on a covered card bubbles to the wrapper's dismiss handler.
Verified by hit-testing the live board: at 233px every hand card resolves
to itself, at the fallback cards 2 and 3 resolve to the overlay.

**The mirror is the actual defect.** `Battle` was rendering a hand-copied
duplicate of the dock's markup instead of the shared component, so the
positioning could live in one and not the other with nothing watching —
exactly what the no-mirror rule exists to stop, one layer up from the
engine. There is one `.peekwrap` in the file now, both boards render
`PeekDock`, and the measurement lives with the thing it positions.

**And it is TRACKED, not sampled.** Measuring once is not enough: the rail
is still moving when the tap that opens the preview lands, which put the
offset at 146px against a rail that came to rest at 628 — the same overlap
at a different instant. A scroll listener does not cover it either, and
this was tried: the rail slid **86px with `scrollTop` unchanged**, moved by
content above it settling rather than by a scroll. Between snap, image and
font loads, rotation and React's own re-layout there is no provably complete
list of events, so while the preview is open it re-measures every frame and
writes only on change. A rail that has flicked off screen returns to the
flat clearance rather than being chased off the top of the viewport.

`test/priority.test.js` slices `PeekDock` rather than a board, and pins the
mirror directly: exactly one `.peekwrap`, exactly two `<PeekDock` renders.
Both sabotages were verified to bite — stripping the effect, and restoring
`Battle`'s inline copy.

**Also:** the *Find an opponent* screen still told players table play "runs
the drill decks — blank cards". True before v2.49, wrong since; the lobby's
own note already said otherwise. Stale copy that under-sells is still stale.

**Not fixed, and not claimed:** the first bug report in the same batch was
retracted by its reporter — Buckwild's "costs 3" is correct, the pips were
misread. Nothing in the cost machinery changed.

---

## v2.51 — JUDGE!! is a module, and its Copy button was broken

Housekeeping before Phase 3, and one of the items turned out to be a real
defect in the tool Phase 3 depends on most.

**THE COPY BUTTON DID NOT WORK.** `navigator.clipboard.writeText` rejects
with `NotAllowedError — Write permission denied` even on a genuine tap, in
a secure context, with the document focused — verified on the deployed
site, not inferred. There was no fallback, so the fastest path from
noticing a bug to reporting it dead-ended at *"copy failed — use
Download"*. Worse, the `else` branch reported **success** when
`navigator.clipboard` was absent entirely: a report that was never copied,
announced as copied.

`copyText` now tries the async API, falls back to the legacy
`execCommand` path (which needs no permission), and if both fail says so
**in red** and points at Save report. Never dress a failed copy as a
success.

**The report is now `engine/report.js`.** It was a closure inside
`Battle`, which meant two things: the table board could not produce a
report at all — the screen where a bug is hardest to reconstruct, because
there are *two* boards and the first question is which one is wrong — and
no drill could reach the one artefact a bug report depends on.

Both boards now share it, and the table's carries the seat, the table code
and net.js's counters, so *"two peers on different hashes at the same
`seq`"* is a desync stated in one line. The table also gets the **invariant
judge** wired to its own funnel (`net.js`'s `onState`, which fires for
local submits, remote commits and snapshot adoptions alike) — the guard
rails had been dark there.

`test/report.test.js` pins the properties that make a report useful, and
the first is the least obvious: **it never throws.** A report that dies
while describing a broken board fails on exactly the board you most needed
described, so a state the invariant judge cannot read is captured as a
field rather than propagated. Also pinned: the replay key survives
(`seed` + stream position + draw count), every zone is named rather than
counted, the graveyard keeps its `_gy` stamps, `you`/`opponent` follow
`mySeat`, and the whole thing serializes even holding a cyclic card.

**`machine.lang` names which state vocabulary is authoritative.** Every
game carries both — `makeGame` seeds `mode`/`bphase` into judge's state
too, and the trainer has carried a derived `phase`/`step` since v2.27's
shadow pass — so neither being present says which engine is driving. A
table report showing `bphase:"defend"` would send a reader into the
trainer hunting a bug that is not there. Nothing is hidden; the
authoritative one is labelled.

Housekeeping alongside: `HANDOFF.md` rewritten for Phase 3 (it still said
Phase 1, v2.48, and "unpushed — no remote"), the `README` replaced (it was
GitHub's profile-repo boilerplate, and this repo's README is the public
face of the project), and the stale `judgeReport()` references cleaned out
of `index.html` and `CLAUDE.md`.

---

## v2.50 — Phase 2: the table IS the trainer's board

v2.49 put two real hero decks across the wire and drew them on a plain
diagnostic board — a list of zone counts and six buttons. It proved the
transport and it looked nothing like the game. **In a training sim that is
a real defect, not a cosmetic one: the layout is the lesson.** A player
who learns the game on the three-screen board and then sits at a table
that looks like a debug panel has to learn it twice.

So the table now renders the trainer's board with a person in seat 1:
the three vertical flick screens and their `screennav`, the armour grid,
the hero row with weapons, the arsenal / deck / pitch columns, the arena,
the graveyard pane, the log pane with its `Ticker` and scorebar, the play
pane with chain / featured / defend columns, the hand rail of real
readable cards, the status line, the status pips, the two-tap peek and
the docked action bar.

**THE SHARED PIECES ARE SHARED FOR REAL.** Drawing the same seat twice is
the no-mirror rule one layer up from the functions it was written for, so
`ArmorGrid`, `DeckPitchCol`, `InPlayRow`, `GravePane`, `usePeek` and
`PeekDock` are extracted as pure props-only components and **both** boards
render them. The trainer was migrated onto them in the same pass and
verified byte-identical against the deployed build — the opponent screen
pixel-for-pixel, the whole "You" screen text-for-text. A divergence here
would not crash anything; it would just quietly stop looking like the
game, which is exactly what this pass exists to prevent.

**What is deliberately NOT shared is the state language.** The trainer
speaks `mode`/`bphase`; the table speaks the CR machine —
`phase`/`step`/`priority` out of `priority.js`. Those are the two things
the Phase 1 rebuild exists to separate, and folding them back together to
share a few more lines of JSX would undo it.

Three things the trainer shows that the table cannot, each stated rather
than faked: **no Advisor** (it reads the trainer's `built` and would coach
card text that does not resolve here), **no boost toggle**, and **no
next-swing prediction** — seat 1 is a person, so there is nothing to
predict.

Two fixes the browser found:

- **A permanently dead "Done defending" button.** CR 7.3.3 gives the
  TURN-PLAYER priority in the defend step while the DEFENDER declares, so
  the defender genuinely cannot pass until the attacker has. A greyed-out
  button reads as a broken screen rather than as the rule it is; the bar
  now says *"declare your blockers — Kayo still holds priority"*.
- **A weapon was painting a blue `0` defence badge.** `gearDef` returns 0
  for a piece that prints no defence, and passing that straight to
  `CardFrame` put a defence value on every sword. The trainer's `gearBtn`
  asks whether the piece has a printed or current defence at all; so does
  the table's now.

**`WinPanel` is deliberately not reused.** It says "DUMMY DESTROYED" and
pulls a random trophy — right for the solo loop, wrong for beating a
person, and a trophy handed out for a real match would quietly devalue
the case. Same visual language, honest words, no reward.

Verified by driving two browsers over the public relay through a full
exchange: Kayo pitching two cards to pay for Agile Windup, swinging for
5, Bravo declaring Blade Beckoner Helm off the armour grid, and 4 landing
— eleven sequenced actions, identical state hashes throughout, zero
desyncs and zero refusals.

**Still outstanding at the table:** card text does not resolve (unchanged
— `runOps`/`execute`/`resolveStack` are still closures inside `Battle`),
and there is no JUDGE!! panel yet. `window.__dawnTable.report()` covers
the same ground from the console in the meantime.

---

## v2.49 — Phase 2: two humans, two hero decks, one game state

The table screen has connected two phones since v2.44. What it dealt them
was `engine/actions.js`'s **blank decks** — real CR turn structure over
cards with no text and no names — because `net.js` needs a pure reducer to
drive and the trainer has none. Both halves now exist, so the table plays
Flesh and Blood.

**The flow the screen was missing.** Connect → **hero** → **throw** →
**sideboard** → game. `engine/lobby.js` is the negotiation, and it is a
new module rather than a branch inside `net.js` for a reason worth
stating: `net.js` needs a sequencer because CR 7.3.2 lets both seats act
in the same instant, and **nothing in a lobby has that problem.** Every
message writes only its own seat's slot and every slot is WRITE-ONCE, so
the reducer is a monotone accumulator — the writes commute, replays are
refused, and two phones applying the same messages in different orders
land in the same place. `test/lobby.test.js` walks all 16 interleavings
and asserts one outcome rather than trusting the argument.

**Write-once is the load-bearing part.** Make a hero pick overwritable
and the lobby diverges: seat 0 changes its mind at the moment seat 1
confirms, so seat 0 applies the change locally while it is still
choosing and seat 1 refuses it for arriving after the step closed. Two
phones, two heroes, no error anywhere. The step is **derived** from the
slots (`stepOf`) rather than stored, because a stored step is a
transition and a transition has an order.

**Nothing about a card crosses the wire.** The lobby ships four small
values — two hero keys, two loadouts, a seating call — and each peer runs
`build.js` over its own database to arrive at an identical state.
`buildMatch` is that, and three things make it deterministic, each a real
way to break it: the rng stream is **seat-specific** (one stream makes
seat 1's deck a continuation of seat 0's), the uid counter is **shared
and threaded in seat order** (a repeat is `CARD-IN-TWO-ZONES` wearing a
disguise), and the seats are built in **index order, never the local
client's**. The table code is the seed, so the whole opening is
reproducible from the code alone.

**The bug that cost the most, and that no drill here could see.** The
opening snapshot measured **97KB**. A WebRTC data channel drops a message
that size *with no error at either end*, so the guest sat in
`handshaking` forever holding a board that looked perfectly correct —
because it had built the same opening itself. Every one of the 765 drills
passed. Two things were wrong:

1. `judge.newMatch` retained the build's `deck` and `gear`. They are
   **construction inputs**, already dealt into `sides`, so the same 43
   cards were in the game object twice — **62KB of the 67KB**, dead to
   every rule (`bAct` exists for the printed passives, which stay).
2. the session was given no **catalog**, so every card shipped its full
   definition instead of a bare `name|pitch` key.

Worst case across all 225 matchups is now **13.7KB**, and
`test/table.test.js` pins a 16KB budget with the reason written next to
it. A handshake that stalls also now says so on screen: the failure was
invisible precisely because every visible thing was right.

**`judge.js` and `types.js` come off the headless list — for the table
only.** The Phase 1 rule was that loading judge would put a second,
quieter rules engine beside the trainer's. That reasoning still stands
and is exactly why the two never meet: **solo play is `Battle` and keeps
every card effect; table play is `judge.js` and keeps the second seat.**
No path routes between them. `wire.test.js`'s `HEADLESS` is down to
`sparring` alone.

**Stated plainly, because the screen looks finished: card TEXT does not
resolve at the table.** Real: two hero decks off the actual database,
printed life and intellect, the CR turn structure, priority, the combat
chain, costs paid by pitching on demand, defenders from hand and iron,
printed power against printed defence, the ordered end phase. Not real:
`runOps`/`execute`/`resolveStack`, which are still closures inside
`Battle`. Moving them to a shared `engine/effects.js` both callers use is
the next pass and the last big one.

Three smaller things the browser found that the drills could not:

- **`netFirst` was a seat INDEX read as an answer**, so both seats were
  told they were on the draw. Renamed `netOnPlay` and made a boolean —
  the same actor-versus-perspective slip as `you()` meaning seat 0.
- **`board` as a lobby export collided** with the arena zone every other
  file means by that name; `test/sync.test.js` caught it on the first
  run. Renamed `sideboard`.
- a **JSX comment mid-sentence** suppressed the whitespace join and
  rendered "solotrainer" on the phone.

Verified by driving two real browsers at each other over the public
relay: hero select, a tied throw replayed, the seating call, both
sideboards, then Kayo pitching Bare Fangs to pay for Pulping, swinging
for 6, Dorinthea blocking with Gauntlets of Unity, and 5 landing — with
both phones on an identical state hash at every step.

---

## v2.48 — Phase 1: the foundation guarded

Two new drill files, and both are about surfaces nothing was watching.

### `test/loader.test.js` — the pool comes in faithfully

Everything in this repo reasons about a card **after** two steps:
`mapDbCard` turns a raw database record into the engine's shape, and
`resolveEntry` turns a deck entry into the card actually played. If
either drops or mistypes a printed value, nothing above it can notice.
The card is simply a different card — consistently, everywhere, and it
agrees with itself.

**`mapDbCard` is the one mirror the no-mirror rule could not delete.**
v2.20 made `engine/` the only copy of every shared function; this is the
exception, and not by choice — the live version lives inside `useCardDB`,
a React hook, so it is not extractable and cannot be loaded from
`engine/`. CLAUDE.md said "change both, and bump DATA_VER", which is a
note to a human, and notes to humans are what the sync guard exists
because we stopped trusting.

Drift would be worse than an ordinary bug: the Node tools would audit one
pool and the phone would play another, **both internally consistent**, so
every finding either made would be about a game the other was not
playing.

Guarded as a **field map** — key to expression — rather than as text,
since the two blocks sit in different surroundings and carry different
comments. The printing loop is guarded the same way: it decides which
face a card wears, and drift there is fifteen decks showing four art
treatments side by side, only on the phone. The field list is pinned, so
adding one is a deliberate edit — which is where the reminder to bump
`DATA_VER` belongs, because a warm cache written under the old schema
will not carry it.

Also pinned:

- **Every printed value survives resolution.** `resolveEntry` has
  silently narrowed the record twice — `life`, so an ally was not a
  living object (CR 1.4.5a) and could not be attacked at all; then `ty`,
  so `tt`'s stray word made a defence reaction playable on its own turn.
- **Every hero is seated at its printed life and intellect** — thirty
  numbers, three of which are the point. Iyslander 18, Blaze 17 and
  Lyath's intellect 5 are named explicitly, because a defaulting bug
  would look perfectly normal on the other twelve.
- **Pitch is the one normalised value.** A record with no printed pitch
  arrives as 0, which is deliberate — no card prints a pitch of 0. Stated
  as a rule (*resolves to pitch 0 iff Equipment or Weapon*) rather than
  excused, so a real action card losing its pitch cannot hide among the
  73 that legitimately have none.

Verified by drift: defence read from the wrong field, `ty` silently
dropped, the printing loop taking the last printing per set, and
`resolveEntry` dropping ally life. All four caught.

**Checked and clean, no change needed:** all 488 deck entries resolve,
all 15 decks total exactly 55 cards, every card has art, and the live
parser's `tt`-reading agrees with `types.js`'s `ty`-reading on
`isAttack`, `isAR`, `isDR` and `isInstant` across all 401 pool cards — so
the `tt`/`ty` conflict on 5 of 4,862 records is a **latent hazard, not a
live bug**. `isWeapon`'s four disagreements are the pinned split.

### `test/fuzz.test.js` — the reducer is a public surface

`net.js`'s contract is that `legal` is asked twice: on the guest before
sending, and on the sequencer before committing. That makes `reduce` a
surface fed by **JSON off a wire** — a stale action from before a resync,
a guest on an older build, a crafted packet, or simply somebody's bug.

Four properties, each a way a real session dies:

| property | what breaks without it |
|---|---|
| never THROWS | an exception kills the session instead of refusing one move |
| never MUTATES on refusal | a bad packet costs the caller its state |
| `legal` and `reduce` AGREE | a guest sends what the sequencer refuses — the two peers diverge |
| a seat cannot use the other's cards | seats are decoration |

Driven over states sampled from real games (mid-payment, mid-chain, in
the defend step, waiting on an arsenal) rather than the opening position,
against 45 malformed action shapes and 13 seat values — 5,000+
combinations.

**TWO OF THESE DRILLS WERE WRITTEN WRONG, AND SABOTAGE IS WHAT FOUND
IT.** A drill that accepts *any* refusal passes on a broken engine: the
non-priority seat is refused by "you do not hold priority" long before
ownership or the zone is ever read, so making every lookup read seat 0
changed nothing either drill could see. Both now **give priority to the
seat under test and assert the reason**, with a control that the seat's
own hand is still reachable — without which the drill passes just as
happily when nothing can be found at all.

`__proto__`, `constructor` and `toString` resolve to something truthy on
any object, so a zone check that asks "is it there" walks into a
function. `legal` asks `Array.isArray`; the drill pins the *zone*
refusal specifically rather than settling for a refusal.

### Notes

- **713 drills** (was 701), all green; fairness clean.
- Every drill in both files proven to bite.
- `find`'s own `Array.isArray` guard is now redundant belt-and-braces —
  `legal` guards first — and is kept anyway. Removing a defensive guard
  because a drill cannot detect its absence is backwards.

---

## v2.47 — Phase 1: the journey census

`test/journey.test.js` — **all 401 pool cards, every journey their
printed type promises and every one it forbids**, driven through the real
reducer.

The Phase 1 brief was "the function of each different card type and their
full usability from pitch to play". Every other drill in the suite asks
about one card or one clause; this asks four questions of all of them,
and every expectation comes from the printed TYPE rather than from a
rules box.

| journey | count |
|---|---|
| pitched for its printed pitch value | 328 |
| played → **chain** | 175 |
| played → **arena** | 23 |
| played → **graveyard** | 91 |
| declared as a defender | 332 |
| **refused**, with a reason naming the card | 112 |

Every count is **asserted, not reported** — a census that quietly stopped
driving anything would otherwise pass by finding nothing. The 112 is a
partition and it is pinned: Equipment 58, Weapon 15, Block 4, Attack
Reaction 20, Defense Reaction 15.

That 15 reconciles with CLAUDE.md's independently-derived "eleven
swinging weapons": four Weapon-typed cards print no power (Death Dealer,
Plasma Barrel Shot, Cosmo, Crucible of Aetherweave) and are activated for
a non-attack ability instead. It is the pinned `types.isWeaponType` vs
`parser.isWeapon` split, counted from the other end.

### THE FINDING: A ONE-SIDED CENSUS IS A COVERAGE TOOL IN A JUDGE'S COAT

Written asking only *can this card do what its type promises*, the census
reported a clean **401 out of 401** — while a Block card was a free
0-cost play and a defence reaction could be declared as a defending card.
Both are sev-3 *illegal play allowed*, the direction that steals games.

It could not see either, **by construction**: a card doing MORE than its
type allows still does everything its type promises. Same shape as the
audit measuring consumption rather than faithfulness, and as
`fairness.js` being deliberately one-sided towards too-strong.

With the refusals written, making a Block playable trips **three** drills
instead of none, and a declarable defence reaction trips one. All four
sabotages verified: Block playable, defence reaction declarable,
permanents resolving to the graveyard, and a card pitching for itself.

### Also checked, and clean

A pass over whether the **live trainer** still misreads any card's type,
now that `types.js` reads the structured `ty` array and `parser.js` still
reads the `tt` display string. Across all 401 pool cards, `isAttack`,
`isAR`, `isDR` and `isInstant` **agree exactly** — so the `tt`/`ty`
conflict on 5 of the database's 4,862 records is a latent hazard rather
than a live bug. Den of the Spider is refused in the action phase either
way, because `tryPlay` asks `isRx` before anything else and "Defense
Reaction" is a substring of the display line.

`isWeapon`'s four disagreements are the deliberately pinned split.

### Notes

- **701 drills** (was 694), all green; fairness clean.
- The census reads **no card text**: expectations from `types.js`,
  answers from `judge.legal`. A failure is always the machine getting a
  type wrong, never a card being read wrong.
- It runs in under a second — one seated match is dealt and forked 401
  times rather than reshuffled.

---

## v2.46 — Phase 1: a seat becomes a policy

`engine/sparring.js`, and the three CR fixes found while proving it works.

### THE MODULE — the rules stop knowing who is driving

The trainer's opponent is not a seat somebody occupies, it is a **branch
inside the rules**: `foeSwing` fabricates the swing as
`[3,4,5][(turn-1)%3]` and `dummyDefence` picks the blocks itself. That is
why there is nowhere for a second human to sit, and why the same CR
procedure is written twice — one body of code for when you swing, another
for when it swings.

`sparring.js` is one function, `act(game, seat) -> action | null`. A seat
is now just something that answers *what do you do*, and solo, hotseat and
network are the same game with different things calling `reduce`: a
policy, a tap, or a packet. None of them is a special case in the rules.

Three properties, each drilled and each proven to bite:

- **It proposes; the judge disposes.** Every action is offered to
  `judge.legal` before it is returned, so a refusal is always a bug in
  the policy. That is what lets the heuristics stay simple — the policy
  never restates a rule in order to avoid breaking one, and a rule that
  changes in `judge.js` changes here for free. **144 games across six
  matchups and both seatings: zero refusals, zero invariant violations,
  every dealt card in exactly one zone.**
- **It reads no card text.** It ranks on printed NUMBERS — power, pitch,
  defence, cost — and asks `legal` for everything else. Same discipline
  that kept `actions.js` free of card text: a sparring partner playing
  badly and a card being read wrong must never be confusable, and they
  would be the moment this started interpreting rules boxes. A drill
  fails on `require("./parser")`, on `fxParse`/`effCost`/`weaponCost`,
  and on reading `.tx` or `.kw`.
- **It is deterministic and never touches the rng.** No `Math.random`,
  and every ranking is a TOTAL order with ties broken on uid, so two
  peers choose the same card from the same state. A policy that consumed
  the seeded stream would shift every later shuffle, so replaying a seed
  would diverge the moment a human took over a seat it used to drive.

**The winner follows the HERO, not the chair.** Kayo's precon beats
Dorinthea's from seat 0 and from seat 1, which is the property that says
seat 1 is genuinely occupiable rather than a weaker shape wearing a deck.

#### The heuristic that had to change, and why it is not tuning

Ported unchanged, the trainer's blocking rule made the game degenerate:
both seats blocked **41 of 41 attacks** and one of them finished a
21-turn game on **full life**. A regression harness that never deals
damage never exercises the damage step.

The cause is not the numbers, it is that the rule was written for a seat
with **no action phase**, where a card in hand had no use except to
block, so spending two on every swing cost nothing. Both seats have an
action phase now: a card in hand is an attack or a pitch, and a hero who
blocks with everything never threatens anyone. `takeUpTo` is the damage a
seat will simply take rather than spend a card on — with lethal
overriding it, because nothing in hand is worth more than being alive.
Games went from 20-life blowouts to finishing at 1 and 2 life.

**Iron stays greedy**: equipment wears rather than leaving, so raising it
costs no card.

It is deliberately **not** an AI opponent — the standing decision
(2026-07-25) is that the goal is two humans. It is a handful of legible
heuristics and it should stay legible rather than become good. It is also
**not a difficulty curve**: the `[3,4,5]` escalation it replaces was
*tuned*, and real cards from a real hand are not.

### THREE MORE CR FIXES, ALL FOUND BY PROBING STATE

**A wall defends ONE chain link (CR 7.3.2).** `chainBlocked` correctly
stopped a spent piece being re-*declared* (CR 7.3.2b), but the
declaration itself stood until the chain **closed** — so `strike` re-read
`blockG` on link 2 and counted the same iron again, with nothing declared
and nothing paid.

The pool hides this almost perfectly: Silver Age equipment is nearly all
battleworn, so it wears to 0 defence after one block and the second
helping is worth nothing. Against a piece that does **not** wear, a
3-defence plate blocked every link of the chain for free. Hand blockers
escaped by accident rather than by rule — they leave the hand at the
strike, so the link-2 lookup finds nothing.

**`endTurn` skipped the opponent's last priority window (CR 4.3.4).** The
rule ends the action phase "when the stack is empty, the combat chain is
closed, and **both** players pass priority in succession". The explicit
`endTurn` action ran the whole end phase on the spot — the turn player
deciding, alone, that the opponent had nothing to say. Invisible in a
solo trainer, because the dummy never had anything to say; with a human
in seat 1 it silently deletes their last instant window on **every turn
of the game**.

`endTurn` is now a **pass carrying the turn-player's intent**: identical
machinery to `pass`, refused where "end my turn" would be a lie (out of
turn, mid-chain, without priority), and the phase ends on the mutual
pass like the CR says.

**The untap step reached only the gear zone (CR 4.4.3d).** "The turn
player untaps all permanents they control" is the whole arena, not just
the gear zone; a board permanent's `spent` flag never reset. Nothing taps
an ally yet, so this is the step being *complete* rather than a bug being
fixed — and it is the half that has to exist before allies can attack.

And `weaponUsed` conflated **two limits that expire under different
rules**. A TAP is a state the permanent is in and only its controller's
untap step lifts it; `Once per Turn` is a per-turn **allowance** that
comes back for both seats at every turn boundary. They coincide for a
weapon swing — action speed, so a seat only reaches it on its own turn —
which is exactly the kind of coincidence this project keeps getting
bitten by. They stop coinciding at the first `Instant - Once per Turn`
equipment ability, which would otherwise be spent until the end of its
user's *next* turn, having been used once across two.

### Notes

- **694 drills** (was 679), all green; fairness clean.
- Four new judge drills and eleven sparring drills, **every one proven to
  bite** by reintroducing the bug and watching it fail.
- Two drills had to be edited deliberately: they sent one `endTurn` and
  expected the turn to be over, which is the shortcut this removed.
  `passTurn` in `judge.test.js` now ends a turn the way a table does.
- `instantSpeed` deleted from `judge.js` — defined, never called, and
  sitting under a shorter name than the right question
  (`playWindowFor` / `typeCostsAP`). Same reasoning as `DawnGame.shuffle`.
- `sparring.js` is **headless**, in `wire.test.js`'s `HEADLESS` list with
  `judge` and `types`.

---

## v2.45 — Phase 1: the turn structure, against the CR itself

A review pass over the core structure — card types, the numbers, the
turn, and the priority windows — grounded against the published
Comprehensive Rules rather than against the code's own memory of them.
**Nine bugs, and not one of them was a card being read wrong.** Every
affected card parsed perfectly; what was wrong was the machine the cards
run inside, which is exactly the half Phase 1 exists to rebuild.

Eight of the nine were invisible to every tool this project has. The
audit measures coverage, the fairness sweep looks for cards stronger than
printed, and `failstates.js` asks what goes wrong at the table — none of
them asks *whose* hand refills at the end of a turn.

### THE ONE THAT MATTERED MOST — the wrong hero drew (CR 4.4.3f)

> "The turn-player draws cards until the number of cards in their hand is
> equal to their hero's intellect."

Step (e) calls `priority.js`'s `endTurn`, which performs CR 4.4.4's
handoff as well as 4.4.3e's fizzle — so by the time (f) ran,
`n.turnPlayer` was already the **incoming** player. Every turn after the
first refilled the wrong hero, and turn one hid it because there both
seats draw anyway.

**It inverts the decision the whole game is built on.** You refill at the
end of *your* turn so that you have cards to block with during *theirs*.
Drawing for the incoming player instead means every hero walks into the
opponent's turn on whatever survived, and opens their own turn with a
full grip — block-or-hold stops being a choice.

The existing CR 4.4.3f drill read the **log line**, not the hands, so it
was green throughout. The new one counts cards.

### (a) ANNOUNCED ITSELF AND DID NOTHING (CR 4.4.3a)

`resetAllyLife` returns **the game**, not `{game, msgs}`. `judge.js` read
`out.game`, got `undefined`, fell through the `||` to the unchanged state
and threw the reset away — while logging *"(a) Allies recover."* on every
turn of every game. A wounded ally never healed.

The drill that checks the end phase runs a–f **in the CR's order** reads
the log, so it could never see this. A step that announces itself and
does nothing is worse than a missing one.

### AN INVENTED LOSS CONDITION (CR 4.5.3)

CR 4.5.3 lists every way a player loses and there are exactly three:
their hero's life reaches zero or they control no hero (a), an effect
says they lose (b), or they concede (c). **An empty deck is not one of
them.** `drawTo` ended the game by "fatigue" — handing a win to a player
whose opponent was still alive and still holding cards.

A hero who runs their deck out keeps playing, keeps blocking with what is
in hand, and loses on life like anyone. A drill now pins that the only
`how` values the reducer can produce are `life` and `concession`.

**`index.html` carries the same invented rule** (a "Deck empty —
fatigued" loss). Left alone deliberately: the trainer's dummy already
reshuffles its graveyard so it never decks out, so changing it is a
gameplay decision about solo play rather than a rules fix.

### TWO PRIORITY WINDOWS THAT NEVER OPENED

**1. "In succession" is half of every step-end rule.** CR 7.3.4, 7.4.3,
7.5.4, 7.6.4 and 4.3.4 are all worded *"when the stack is empty and all
players pass **in succession**"*. A card resolving between two passes
breaks that succession, and the turn-player gains priority again
(CR 4.2.2 / 7.7.4).

The pass record survived a play, and the shape that produced is the
expensive kind:

```
attacker passes            passed = [true, false]
defender plays a defence reaction     passed = [true, false]   <-- still
defender passes            passed = [true, true]  -> DAMAGE STEP
```

**The attacker never got a window to answer the card just played at
them.** Declaring a defender had the same hole: a turn-player who passed
early never saw the wall they were about to be measured against.

**2. The action phase never ended (CR 4.3.4).** `advance` has no
transition out of the layer step — that step belongs to `declareAttack` —
so a mutual pass left the game in a window **nobody could act in**:
`speedAllowed` correctly returned `[]` for both seats, the turn-player
was refused with "you do not hold priority", and the only way out was an
explicit `endTurn` the CR does not require. `actionPhaseEnds` was right
all along and nothing called it.

### AN UNAFFORDABLE PLAY WAS DECLARED LEGAL

`playableWhy` checked the action point and never asked whether the cost
could be raised at all. `legal` said yes, `doPlay` opened a payment that
could never be completed, and the only move left was to cancel back into
the identical state — **a live-lock for any driver that trusts `legal`**,
which is the reducer's contract and is how both the guest client and the
sequencer decide what to send. It is also a dead tap for a human.

`payCeiling` is the honest maximum: the floating pool plus every pitch
value left in hand.

### ALLIES COULD NOT BE ATTACKED (CR 1.4.5)

An ally is a **living object** (CR 1.4.5a) — it has life, so it is
attackable, and CR 1.4.5 makes declaring an attack-target mandatory.
Allies had been reaching the arena since v2.43 (19 of them across a
15-pairing sweep) and **nothing could touch them**: a body that blocks
nothing, dies to nothing and costs the opponent nothing to ignore.

Every helper already existed in `game.js`, drilled, and called by nobody.
The target now rides on the **action** (`{t:"play", uid, target}`) rather
than in a prompt, so the reducer stays pure and serializable — the same
action drives a tap, a replay and a peer.

**CR 7.3.2a is what makes it a decision.** Only a hero attack-target may
have defending cards declared for it, so an attack on an ally always
connects and it kills. Omitting `target` still means the hero, which is
always a legal choice; offering the choice is the caller's half.

### AND TWO SMALLER ONES

- **CR 4.4.4** — the per-turn ledger (`hist`) cleared only for the
  incoming seat, so a card asking "have you pitched a blue this turn"
  during the opponent's turn read *your* turn's answer.
- **A `Resource` card reported playable with no window to play it in.**
  `Inner Chi` is a `Mystic Resource - Chi`: no cost, no rules text, pitch
  3. It was refused two steps later with "cannot be played in the action
  phase", which reads like a timing problem rather than what it is.
  `isPlayable` now asks the window table instead of a second list, so the
  two cannot disagree. The drill that would have caught it never looked
  at the card — `pool()` in `types.test.js` covered the fifteen decks and
  not the dummy's pile or the two runtime-minted records.

### WHAT WAS CHECKED AND FOUND CORRECT

Worth recording, because a review that only lists faults is not a review:

- **Lyath Goldmane's intellect is 5**, every other hero's is 4, and that
  number flows correctly from the database through `buildSide` to a
  five-card opening hand.
- **The type census is a true partition** — 434 unique cards over nine
  card types, none typed twice, nothing untyped.
- **A chain link walks all six CR windows** in order with the right seat
  holding each: attack (7.2.4), defend (7.3.3 — the *turn-player*, while
  the defender declares), reaction (7.4.2, split by attacker), damage
  (7.5.3, dealt on **entering**), resolution (7.6.3, action speed for a
  second link), close (7.7.1, nobody holds priority).
- **Equipment wear**: battleworn, temper, guardwell and blade break all
  apply, `chainBlocked` stops a piece re-blocking the same chain, and a
  0-defence piece is refused as a defender.
- **The damage arithmetic is CR 7.5.2** — power minus the summed printed
  defence of the declared cards, floored at zero.

### MEASURED

A greedy policy driving all fifteen precons at each other, before and
after:

| | games finished | actions | invariant violations |
|---|---|---|---|
| before | 8 / 15 | 29,463 | 0 |
| after | **15 / 15** | 3,198 | 0 |

The 10× drop in actions is the draw fix: hands now deplete the way they
do at a table, so a greedy bot runs out of things to do instead of
playing forever off a hand that silently refilled. Every game ends on
life, which is CR 4.5.3a and now the only way a game can end.

679 drills. Each of the nine fixes has a drill, and **each was verified
to bite** by reintroducing the bug and watching it fail by name.

---

## v2.44 — a reaction cannot be an action

**Reported by the user, who reads cards for a living, and they were
right.** v2.43 claimed Den of the Spider and Lair of the Spider were
dual-typed `Action Defense Reaction` cards. They are not. They are
Defense Reactions, and `Assassin / Warrior` is **deck legality** — who
may include the card, and how other cards refer to it — not a claim
about what the card is.

### The database says it twice, and the two disagree

| field | Den of the Spider |
|---|---|
| `types` (structured) | `["Assassin","Warrior","Defense Reaction","Trap"]` |
| `type_text` (display) | `"Assassin / Warrior Action Defense Reaction - Trap"` |

`mapDbCard` read `type_text` and threw the structured array away. A
sweep of all **4,862** database records found the two fields disagree on
exactly **5**: the two Spiders (display adds a stray `Action`) and Comet
Collision ×3 (display says `Instant`, array says `Action` — not in the
Silver Age pool).

**The consequence was a sev-3 illegal play.** Both Spiders were playable
in the action phase for an action point. No card-level tool could see
it: the card's *text* parsed perfectly, coverage said `full`, and the
fairness sweep looks for over-granted effects, not for a card being the
wrong type.

### The fix, and the one exception

`mapDbCard` and `resolveEntry` now carry `ty` alongside `tt`, the loader
in `index.html` mirrors both, and **`DATA_VER` is `sage-v11`** — a warm
`sage-v10` cache has no `ty` on any card and would silently fall back to
parsing the display string.

**A double-faced card is the one place the display string knows more.**
`Arcane Seeds // Life` flattens to `["Runeblade","Action","Earth",
"Instant"]`; only `type_text` keeps the `//` boundary. You play the
FRONT face, so DFCs parse the front of the string. Reading the flat
array calls two real action cards instants and hands each of them a free
action point — v2.39's bug returning through another door, now drilled.

Also fixed on the way: an equipment slot word was landing in `classes`
(`Necromancer Equipment - Head` → `["Necromancer","Head"]`).

### The census is now an exact partition

Seven card-type counts summing to **exactly** 401 unique cards, none
typed twice. That is the shape that catches this class of misread, and
it did not hold in v2.43 — the two Spiders were double-counted and the
drill absorbed it as "2 dual-typed". Five drills now fail if the display
string is trusted again, verified by reintroducing the bug.

---

## v2.43 — Phase 1: card types, and the numbers

The half of Flesh and Blood that needs no text box. Phase 3 takes the
text boxes; this pass makes every card *type* behave correctly from
pitch to play, in a two-player game, under the CR's turn structure.

### `engine/types.js`

The pool prints **138 distinct type lines** over 401 unique cards, and
they are regular: `[classes and talents] <TYPE>… [ - <SUBTYPE>… ]`.
`cardType()` parses one into a structure and every question is asked of
that — one parse, one answer, instead of the six ad-hoc regexes the
trainer spreads the same question across.

Validated against the whole pool: it agrees with `parser.js` on attack,
reaction and instant for **all 401 cards**, and with `game.js` on every
equipment slot.

**Three things the pool prints that a naive reader gets wrong:**

1. **A card can have TWO types.** Den of the Spider and Lair of the
   Spider are `Action Defense Reaction` — playable in the action phase
   for an action point, or in the defence window for none. A reader that
   matches one type and stops refuses them half the time.
2. **`Block` is a type with no play.** Test of Might, Test of Strength,
   On the Horizon, Crash and Bash. No printed cost, 4 defence, all
   reading "When this defends, …". Treated as ordinary non-attacks they
   were free 0-cost plays that did nothing.
3. **`Reaction` contains `action`.** A scan that is not word-boundary
   anchored and longest-first reads every reaction as an Action.

**Permanents now reach the arena.** An Aura, Item or Ally that resolves
to the graveyard is a card the player paid for and never receives — 12
auras, 5 items and 6 allies in the pool. Allies carry printed life onto
the board, which is what makes them attackable (CR 1.4.5a). Verified in
a real game: Gravy Bones fielding three allies against Viserai's sigils,
zero invariant violations.

**A null cost does not mean unplayable.** `Ice Eternal` and `Night's
Embrace` carry `cost: null` because their cost is X or absent from the
record. Playability is decided by TYPE, always.

**The type census is a partition, and a drill proves it**: seven card
types summing to 403, minus 2 dual-typed, equals 401 cards exactly —
with `attack` (175) a *subset* of `action` (269) rather than a peer.

### A correction to v2.42

v2.42 claimed Sledge of Anvilheim and Scorpio, Comet Tail were both
repeatable because neither prints "Once per Turn". **Half wrong.**
Scorpio pays `{t}` — it taps, and a tapped permanent does not untap
until CR 4.4.3d. It is limited to one swing per turn for a completely
different reason. Only the Sledge is genuinely repeatable.

Reading only `oncePerTurn` would have made Scorpio **stronger** than
printed, which is the direction that steals games. `weaponCost` now
returns `taps` as well, and `judge.js` honours both.

### `legal()` threw instead of refusing

Playing from the arsenal crashed the reducer: the arsenal holds one card
or null, not a list, and the list path ran straight into it. A legality
check that throws breaks the reducer's contract in the caller rather
than returning a reason.

The "never throws" drill missed it because it only ever probed
`from:"hand"`. It now sweeps every zone, on two states, and both it and
the arsenal round-trip drill are verified to fail when the bug is put
back.

---

## v2.42 — Phase 1: the rules leave the component

The first landing of the engine rebuild. Two new modules, 46 new drills,
and three real bugs that only became findable once the code was somewhere
a drill could reach it.

### `engine/build.js` — how a seat becomes a hero

`buildSide` and the equipment slot rules moved out of `index.html`. Both
are rules: a build reads a hero's printed passives off its own text and
deals from the seeded stream, and `defaultPicks` decides how much iron a
hero may legally wear. Neither had a drill, which is precisely why the
v2.41 eight-gear bug shipped — every card was read correctly and the
*quantity* was illegal, a question no card-level tool asks.

`buildSide` takes no seat argument and branches on no seat; a drill
enforces that. `buildSideDefault` equips and builds in one call, so both
seats reach one set of slot rules rather than two.

**A BOW PRINTS NO POWER, AND THAT DISQUALIFIED IT.** `defaultPicks` gated
the two-hander on `twoH.c.power != null`. Azalea's Death Dealer is a
`Ranger Weapon - Bow (2H)` with `power: null`, so she defaulted to **no
weapon and no quiver** — for the player's own loadout as much as the
opponent's, and her whole deck is arrows. The check never did any work:
`slotOf` only returns `z:"2h"` for a printed `2H` type line. Gone, and
two drills fail if it comes back.

Not "every hero gets a weapon", though — Gravy Bones's precon prints none
at all (four armour slots and an off-hand compass), so the drill asks the
honest question: is a *printed* weapon ever left in the box.

### `engine/judge.js` — the rules as a pure function

`reduce(state, action, seat) -> state`, and **the one thing it replaces
is that the trainer resolves the same CR procedure through two unrelated
bodies of code**:

```
you attack   tryPlay -> execute -> dummyDefence -> mode:"stack" -> resolveStack
they attack  foeSwing -> mode:"block" -> toggleBlock -> finishBlock -> takeIt
```

One fabricates the attack as `[3,4,5][(turn-1)%3]`; the other auto-picks
the blocks. Neither can serve a second human, and a rule fixed in one
stays broken in the other — which is how clash fired on the wrong trigger
for five versions. Here there is one path and the swinging seat is an
argument.

It restates **no** priority rule: `canAct`, `speedAllowed`,
`canDeclareDefenders`, `passOutcome`, `advance` and `endTurn` all come
from `priority.js`. There is no `mode` and no `bphase`, and a drill fails
if either appears.

Two corrections to `actions.js`'s reference shape, both real:

- **Damage lands on ENTERING the damage step, not on leaving it** (CR
  7.5). A blank game has nothing hanging off a hit; a real one has a
  window in which the hit has already happened.
- **The combat chain is a ZONE.** A declared attack has left its hand and
  not reached a graveyard. Held in a private field it is in no zone at
  all — and `invariants.js` catches a card in *two* zones while a card in
  *none* falls out of the census silently. `chainCards` is now censused,
  and a drill duplicates a chain card into a graveyard to prove the judge
  names it.

Verified by driving two real precons at each other: a 17-turn game, 261
actions, zero invariant violations, every dealt card in exactly one zone,
and both seats attacking, defending, drawing and ending turns through the
same code.

**It is deliberately HEADLESS** — declared so in `test/wire.test.js`'s
ledger. It models the turn structure, the chain and the costs, but not
yet card *effects*; those are still `runOps`/`execute` in the trainer.
Loading it now would put a second, quieter rules engine on the page next
to the real one.

### "Once per turn" is printed, not universal — and it is not the only limit

Found while giving `judge.js` a weapon swing. Of the pool's eleven
swinging weapons, nine print `Once per Turn`. **Two do not, and they are
not the same case as each other:**

| | printed | why it is limited |
|---|---|---|
| Sledge of Anvilheim | `Action - {r}{r}{r}{r}: Attack` | **it isn't.** Pay four again, swing again. |
| Scorpio, Comet Tail | `Action - {t}: Attack. …` | the **tap**. A tapped permanent does not untap until CR 4.4.3d. |

Gating every weapon on a blanket "already swung" flag — which is what
the trainer does — makes the Sledge strictly **weaker than printed**.
Reading only `oncePerTurn` and ignoring `{t}` would make Scorpio
**stronger** than printed, which is the direction that steals games.
`weaponCost` now returns both `oncePerTurn` and `taps`, and `judge.js`
honours both.

Neither sweep can see either one. `npm run fairness` is deliberately
one-sided towards cards that are too *strong*; coverage says `full` for
both, because the text was read correctly and then **charged** wrongly.
Same shape as the instant that ate an action point in v2.39.

---

## v2.41 — the opponent picks a hero

`ROADMAP-OPPONENT.md` Phase 1, and step 2 of the honest order in
`HANDOFF.md`. Seat 1 is built by `buildSide` like any hero: real life
total, real intellect, real equipment, real 55-card deck. It still takes
**no action phase**, so it blocks with printed defence and nothing more —
which is why a real deck is safe here. The roadmap's standing warning
("do not give it a real deck until the opponent can resolve the cards in
that deck") is about *playing* cards, and blocking with printed defence
works for any card without the parser reading a word.

**The Dummy stays selectable and stays the default.** It is the
regression harness for every phase above this one, and its vanilla pile
is the one deck where nothing can be faked.

### The hero passives were seat 0's, silently

`built.viseraiPassive` meant *the player's* Viserai — the same
seat-0-means-the-actor confusion the actor/perspective split fixed for
zones in v2.24, one layer up. `built.both[i]` is the ledger and `bAct(s)`
is its reader; five rules sites moved onto it (`viseraiPassive`,
`lyathBoo`, `iceFrostbite`, `arsenalInstant`). Only the UI still reaches
`built.*` directly, because the UI renders seat 0 by definition.

There is deliberately **no `bFoe`** — nothing needs one, and a dead
helper beside a live one is how `sides.js`'s `you`/`foe` came to be
deleted in v2.24.

### The landmine, defused

`DUMMY_INT` is gone from `newTurn`; the refill reads `opp(s).int`, a
property of whoever is sitting there. It is still the stand-in for the
turn seat 1 never takes, and it is still the **only** refill site — which
is exactly what the roadmap warned about. When seat 1 gets a real end
phase the draw moves there and becomes turn-1-only for both seats (CR
4.4.3f); adding that without removing this draws twice.

**The graveyard recycle stays a dummy affordance.** "A sparring partner
that decked out would stop sparring" is true of the prop and false of a
hero, so a real opponent runs its deck down and simply has fewer blockers.
It does not yet *lose* for it — what decking out costs is a win condition
the player cannot currently reach, and the roadmap says to decide that
once, at Phase 2. Both approximations are logged rather than silent.

### Caught in play: the opponent was wearing eight pieces of iron

Passing `{}` for the opponent's loadout handed Azalea all **eight**
printed pieces — two helms, two legs, the lot — where the slot rules
allow about five. Not cosmetic: `dummyDefence` raises one piece per
attack and `chainBlocked` only stops a piece re-blocking the *same*
chain, so every extra piece is another free block later in the turn.
Strictly stronger than printed, which is the direction that steals games.
Both seats now go through `defaultPicks`, the same function the loadout
screen uses, so one set of slot rules governs both.

Found by opening the game and reading the dealt state, not by a drill —
as usual.

### Where it is chosen

The **scout panel**, not the throw: you see the opponent's hero and *then*
you sideboard. Putting the pick after the loadout would show you the
matchup too late to use it, which is the one thing that panel exists to
prevent. It rides in `cfg`, which already flows Loadout → Pregame →
Battle. Deliberately **not** saved per hero the way the loadout is — the
opponent is a property of the match, not of your deck.

The scripted swing now announces itself every time (*"Azalea swings for 3
— scripted escalation, not a card from hand"*), per Phase 0's rule that
the sequence is the lesson. Roughly two dozen log and UI strings that said
"the dummy" now read the seat's own name, via `foe(n).name` / `opp(g).name`
so they stay correct once seat 1 acts.

### Known, and pre-existing

- `CHAIN-CLOSED-WITH-LINKS` fires on the opponent-first opening —
  `foeSwing` pushes a link without opening the chain. Confirmed present
  before this change; not introduced here.
- `defaultPicks` gates 2H selection on `power != null`, and **bows print
  no power**, so Azalea defaults to no weapon and no quiver. Affects the
  player's own loadout too. Harmless while seat 1 never attacks; it
  matters at Phase 2.

---

## v2.40 — a reaction belongs to the reaction step, and to one seat in it

Found while fixing v2.39 and fixed on the user's call. Two rules, and the
trainer honoured neither:

| CR | |
|---|---|
| 8.1.2a | an attack reaction "can only be played/activated by a player who **controls the attack** during the Reaction Step of combat" |
| 8.1.3a | a defense reaction "can only be played/activated by a player who **controls a hero as an attack-target** during the Reaction Step" |

**1. `tryPlay` accepted a reaction straight out of the action phase — 23 pool
cards.** The gate only asked whether `fxParse` had found something playable and
never looked at the printed type, so Reduce to Runechant minted a runechant on
your own turn and the four Warrior reprise attack reactions fired with no
attack to react to. That is the sev-3 "illegal play allowed" category: the
player wins games they should lose, and the sim teaches wrong play. It now
refuses and names the window the card belongs to.

**2. The attack-reaction window admitted any non-attack carrying a pump.** The
test was `isAR(c) || instant || (!isAttack(c) && fx.self > 0)`, and that third
disjunct let three plain **Action** cards — Flying High, Hit and Run, and Cutty
Shark, Quick Clip — be played in the reaction step, where no action card is
legal.

**3. Five hand-rolled copies of one question.** `playRx`, `playRxA`, `handAct`,
`handCell`'s dim and the arsenal row in `playables` each spelled out
`fx.dr || (isInstantT(c) && fx.ops.length > 0)` for themselves. Five chances to
drift, and the dim drifting from `playRx` is precisely a card that looks
playable and does nothing when tapped. `DawnParser.rxAllowed(card, window)` is
now the single statement and all five ask it; `fx.dr` is `isDR`'s answer rather
than a second copy of the regex.

`speedAllowed` already split the reaction step into two windows by attacker
(v2.27) — the gap was only ever the card half of the question. The seat half
needed no change, which is what made this small.

The refusals **say why** rather than dead-tapping, in both directions: an
attack reaction tapped in the defending player's window is told whose window it
is. `advisor.js` no longer offers a reaction as an action-phase candidate —
coaching a play the game then refuses is worse than not coaching it.

Seven drills, each verified to bite by reintroducing the bug it names.

---

## v2.39 — the action point is an ACTION's cost, not a per-play tax

Reported from the table: **instants were consuming the action point.** They
were, at two sites, and both were hand-rolled answers to one rule:

| CR | |
|---|---|
| 8.1.1 | "An action card/activated ability has the additional asset-cost of one action point to play/activate." |
| 8.1.6 | "A card/activated ability with the type instant can be played/activated any time the player has priority." — no such cost |
| 5.3.5 | "If the layer has go again, the controlling player gains 1 action point." |

`tryPlay` refused *any* play at 0 action points, and `execute` settled every
non-attack with `ga ? keep : -1`. So an instant cost a card **and** the turn's
action:

| card | printed | what it did |
|---|---|---|
| Energy Potion | Instant - Destroy this: Gain {r}{r} | spent your action to gain 2 resources |
| Achilles Accelerator | Instant - Destroy this: **Gain 1 action point** | netted to **zero** — the equipment did nothing at all |
| Frost Spike, Memorial Ground, Act of Glory … | 24 instant cards in the pool | each one ended your action phase |

**Coverage could not see any of it.** Every card above reads as tier `full` —
the text was read correctly and then *charged* wrongly, the same blind spot
the fairness sweep exists for (and the sweep is one-sided by design: this is a
card being weaker than printed, not stronger).

`DawnParser.costsAP` states the rule once and both trainer sites ask it.
The arithmetic is now spelled out rather than folded into a ternary —
`ap - apCost + (ga ? 1 : 0)` — because CR 5.3.5 is a **gain**, not a refund:
for an action that is spend-then-gain (the familiar "kept"), and for an instant
it is a genuine +1. Identical arithmetic to before for every action card.

**26 pool cards also carry an "Instant - …" activated ability** — Spellfire
Cloak, Talismanic Lens, Pouncing Paws, Seeker's Mitts and the rest. They answer
through the same helper via the `_instant` flag `parseHeroPower` already
stamped on their powCard, so equipment did not need its own branch.

**The double-faced type line is read front-face-first, and that guard is what
keeps the fix honest.** `isInstantT` tested the whole printed line, so
`Arcane Seeds // Life` and `Burn Up // Shock` — "Runeblade Action // Earth
Instant" — read as instants. You play the *front* face; the back is reachable
only by melding. Left alone, the fix would have handed two real action cards a
free action point: strictly stronger than printed, the direction that steals
games. `isAR` reads the front face for the same reason.

`advisor.js` returned "End turn — action point spent." the moment the point was
gone, which now coaches past a live instant. It builds its candidates either
way and filters to what is still legal (instants, plus the ally swing the
trainer models as free and says so).

Seven drills, each verified to bite by reintroducing the bug it names.

---

## v2.38 — a table number, and two devices at it

The sync layer is no longer headless. All four modules are in index.html's
script tags and in `test/sync.test.js`'s `MODULES`; `wire.test.js`'s `HEADLESS`
list is now empty.

**`engine/room.js` — the only file in the engine that knows a network exists.**
PeerJS rather than Trystero, for one reason: PeerJS ships a **UMD build** that
loads with a plain `<script src>`, and Trystero is ESM-only, which would mean
`type="module"` and no `file://`. It loads **lazily**, on the first tap of *Find
an opponent*, so the solo trainer and a `file://` page pay nothing for it.

The table number falls out of PeerJS's model instead of being bolted on: a peer
may claim a chosen id, so the host claims the table's and the guest dials it.
"That table is taken" and "nobody is sitting there" become real answers from the
relay rather than states we invent.

Three things that are not optional, each with a drill:

- **The id is namespaced** (`dawnblade-v1-<CODE>`). The public relay is shared
  with every other PeerJS app in the world; an unqualified "42" would collide
  with a stranger's project and look like a Dawnblade bug.
- **The channel is `{reliable:true}`.** PeerJS does not default to it, and
  `net.js` treats a sequence gap as a dead channel rather than reassembling — an
  unordered channel would resync in a loop.
- **A third phone is turned away** before its channel opens. A second guest
  would become a second actor whose intents the sequencer would interleave into
  somebody else's match.

The **table code is the match seed**, which is rng.js's own stated goal: both
peers derive the same seed from the same room code without exchanging it. The
code alphabet drops I, L, O, 0 and 1 — it is read off one phone and typed into
another across a table, so legibility beats entropy.

**The message sink buffers until somebody listens.** The channel opens before
there is a session to feed it, because the session needs the `send` the channel
provides. Anything arriving in that gap is held and flushed on `listen`; without
it the handshake is dropped and the guest sits on "connecting" with no error.

**`test/sync.test.js` caught a real collision on the first run.** `TableMatch`
declared `const seat = host ? 0 : 1` — and `priority.js` exports a `seat` helper
meaning "seat a game". Same name, different meaning: the exact trap that made
`tapTwice`'s `act` shadow the actor helper in v2.25. Renamed to `mySeat` rather
than pinned, per the standing rule.

**Played across two clients over the real public relay**, not just drilled:
table QZHF, both clients on hash `c048c95cd0709361` at the deal, an attack and a
defender declaration crossing the wire, damage resolving 5 − 3 = 2, and both
ending the chain on `5873c4d96a63e637` with clean consoles and both graveyards
filed.

### What the table cannot do yet, and why

**Two hero decks still cannot cross the wire, and that is a rules gap rather
than a network one.** `foeSwing` fabricates the opponent's attack as
`[3,4,5][(turn-1)%3]` — seat 1 emits a *number*, not a played card, so there is
nothing for a second human to occupy. `Battle` is also 22 `setG` closures rather
than a `reduce(state, action)`, so there is no reducer for `net.js` to drive
even once seat 1 can act. That is Phase A step 4 plus Phase B step 6, and it is
the same work whether the opponent is across the table or across the internet.

Until then the table runs the blank decks: a real two-player game of the CR turn
structure, priority and combat chain, just not of Flesh and Blood cards.

505 -> 522 drills.

---

## (engine only, no APP_VER bump) — the sync layer: two phones, one game

**`index.html` is untouched, so nothing ships to players and `APP_VER` stays
at v2.37.** This is `ROADMAP-MULTIPLAYER.md` Phase B steps 7 and 8 built
headless: three modules, 72 drills, no UI. `test/wire.test.js` pins that they
are *deliberately* not loaded — every `engine/*.js` file is either in
index.html's script tags or in its `HEADLESS` list, so wiring one up without
updating `test/sync.test.js`'s `MODULES` fails a drill by name.

### `engine/wire.js` — the game as one JSON object

Cards are interned as `[dictIndex, overrides, deletions?]`, the overrides
found by **structural diff** rather than a hardcoded field list — so `uid`,
`_gy`, gear's `curDef`/`destroyed` and the arsenal's `_faceUp`/`_arsPow`
stamps all ride automatically, and a card that grows a field ships it without
a code change. **Nothing here reads card text.** With a catalog (the loader's
own cache) definitions stay off the wire entirely: 8818 -> 3705 bytes on a
blank opening board, and far more on a real one where `name|pitch` repeats.

`decode` refuses four ways rather than guessing — wrong `WIRE_V`, a catalog
hash mismatch (**two clients on different `DATA_VER` are refused at the
handshake, not discovered on turn six**), a bare key with no catalog, and a
rebuild that does not match the sender's fingerprint.

**The hash excludes `log` and `feed`, and that is not an oversight.** Taunts
and trophy text are on `Math.random` by design, so two honest peers are
*guaranteed* to differ there and hashing them would report a desync on every
action. `inspect`/`boostOn` (per-client UI) and art URLs are out for the same
class of reason. `rng` is in — `rng.n` is the canary rng.js already names.

`JSON.stringify` could not be the fingerprint: it preserves insertion order,
so a peer rebuilt from a snapshot would hash differently from one that
reached the same game through the reducer, and **every reconnect would look
like a desync**.

`diffPaths` is the payoff — a mismatch arrives as `/sides/1/grave/0/uid`
instead of two hex strings.

### `engine/net.js` — the session

Transport-agnostic on purpose: it takes `send`, exposes `receive`, and a
drill scans it (comments stripped) for any transport name. **The
recommendation is WebRTC DataChannel** — GitHub Pages has no server to
terminate a WebSocket, so `ws://` is a backend to build, which is Phase C.
`wsAdapter` is written anyway so the Phase C seam is proven; `loopback()`
with `drop`/`delay` is what the drills run on.

**Priority is the lock — except in the defend step.** CR 7.3.2 makes
declaring defenders free and simultaneous while CR 7.3.3 gives the
turn-player priority in the same step, so there and only there both seats can
legally act at once. Hence a **sequencer**: one peer orders actions and
nothing else. It is not authoritative over outcomes — both peers run the
identical reducer and both verify — which keeps Phase C a relocation rather
than a rewrite.

**Two bugs found by the drills, not by eye:**

1. **An infinite repair loop.** A diverged peer is level on `seq`, so every
   cheap resync test concluded it needed nothing — or sent it a log replay,
   which reproduced the same wrong answer over the same wrong state, so it
   asked again. `force` is now checked *first* in the RESYNC handler.
2. **The race drill proved nothing.** A guest applying optimistically
   diverges, gets caught by the hash, and is snapped back — so the end states
   agree and the test went green. It now pins `desyncs === 0 && resyncs === 0`:
   ordering must make the divergence *impossible*, not survivable.

Three mutations were reintroduced and each makes its drill fail: dropping
`rng` from the hash, undoing the `force` ordering, and the optimistic apply.

### `engine/actions.js` — six blank actions

`pitch · pass · attack · defend · roll · endTurn` over cards with `tx: ""`
and no keywords. **No card from the pool is touched** — one drill reads every
card in a match and fails on any rules text, another fails if the module ever
imports the parser. It is a real driver of `priority.js` (nothing about
priority is restated) and explicitly *not* the game's rules; `judge.js`
replaces it wholesale, which is why `net.js` takes `reduce` as a parameter.

**The close step was a deadlock.** CR 7.7.1 gives nobody priority there, so
no player action can drive it out and the game parked in a step neither seat
could leave. `priority.js` already said so — `advance` is the one step it
lets through without checking `windowClosed` — and the caller has to honour
it. Also: chain cards are now filed to the graveyard at close, turn-stamped.
A card in *two* zones is what `invariants.js` catches; a card in *none* falls
out of the census entirely, so a drill counts cards before and after.

**Still true, and stated rather than papered over:** both peers hold full
state, including the opponent's hand. That is fact 4's deliberate Phase B
position and it is not fixable by redaction — a peer that cannot see the
state cannot run the reducer. Hidden information needs Phase C's server.

432 -> 505 drills.

---

## v2.37 — the preview gets out of the way, and priority gets its first consumer

### The preview sits above the hand now

v2.36 stopped `.peekwrap` *eating* the tap. It was still **hiding** it: a flat
`bottom:112px` cleared the action bar, but on a 393x852 phone the hand rail
landed directly underneath the preview, so the two-tap asked you to choose
between cards you could no longer see.

The offset is now **measured** off the live rail rather than guessed — the
rail's height depends on which screen is showing and on card size, so a
hardcoded number would be wrong again at the next layout change. A `uE`
measures `.phand`/`.chand`/`.hand`, sets `--peekbot` to the distance from the
viewport bottom to the rail's **top** edge plus a small gap, and re-measures on
resize so a rotation cannot strand it. The old flat 112px survives as the
fallback for the first frame and for screens with no rail.

Verified at 393x852: `--peekbot` resolves to 235px, the preview's bottom edge
lands at y617 against a rail top of y626 — it clears. The whole hand stays
visible under the preview with the tapped card highlighted, and the second tap
commits (played Lace with Bloodrot end to end, zero invariant violations).

### `playRx` is the first consumer off `mode`/`bphase`

Roadmap item 1's last step starts here. `playRx` hand-rolled its window as
`inAtk = s.mode==="stack"` plus an inline reaction test — and **that test
cannot express the rule it stands in for**: the reaction split follows the
ATTACKER, not the seat number. With one acting side those coincide, so it was
right by accident. It now asks `DawnPriority.speedAllowed(s, 0)`.

Behaviour-identical today, correct the moment seat 1 attacks. One deliberate
change falls out: a finished game now opens no window at all, where the old
`mode` test would still have let a reaction through with `mode:"stack"` after
the game ended.

Six drills pin the mapping per trainer state, and a seventh fails if `playRx`
reads `s.mode` or `s.bphase` again — proven to bite by restoring the old test.

**87 `mode`/`bphase` references remain.** The next consumer is the hand-dim
logic in `handCell`, which duplicates `playRx`'s old expressions verbatim
(`rxD`/`rxA`) — migrating it removes the duplication rather than moving it.

**413 drills**, green.

## v2.36 — hand cards were unplayable on a phone

Found by testing at a real **393x852** phone viewport instead of a tall
desktop window. It is invisible on a tall window, and it is a showstopper on
the only device this game is built for.

`.peekwrap` — the two-tap preview — is `position:fixed`, full width, and
mostly empty space. With `pointer-events:auto` that empty space sat **on top of
the hand rail**:

1. first tap arms the peek;
2. the peek panel renders over the rail;
3. second tap hits the wrapper's own `onClick={()=>setPeek(null)}` instead of
   the card — so it *dismisses* rather than commits.

Tap, peek, tap, peek, forever. **No card in hand could be played.** On a tall
window the rail sits below the panel and nothing overlaps, which is why every
previous session's testing missed it.

The CSS comment above the rule had said the right thing all along — *"the rail
underneath stays visible and the second tap has somewhere to land"* — it just
was not true. `.peekwrap` now takes no pointer events and `.peekwrap>*` takes
them back, so the visible preview still dismisses on tap while the empty area
falls through to the card.

Verified at 393x852 with the peek open: `elementFromPoint` at the card's centre
returns the card (was `DIV.peekwrap`), and the second tap reaches `tryPlay`.
Pinned by a drill, proven to bite. `.peekwrap` was the only mostly-empty
full-width overlay — `.modal`, `.psheet`, `.actbar` and `.bugwrap` are opaque
or all-controls by design.

**406 drills**, green.

## v2.35 — printings, the turn structure, and the arena

Three things the user asked for, none of which the drills could have found.

### Every card wears its Silver Age face

`resolveEntry` fell back to `pr._first` — whatever printing the card database
happened to list first, which is arbitrary order rather than a choice. That is
why an Azalea deck showed GEM, 1HP, PEN and DDD art side by side.

The order is now: an explicit code on the deck entry, then this hero's own
Silver Age set, then any Silver Age set, then `_first`. Measured across all
503 deck entries: **467 resolve to their own hero's precon set** and 34 to
another Silver Age set (deliberate explicit codes for cards not printed in
their own). Nineteen codes pointing outside Silver Age were removed.

**The Dawnblade is the only Marvel card in the pool**, and an explicit code now
*wins* over the set preference — without that fix it silently reverted to
SDO002, overriding the author's choice without a word. One honest exception
remains: Enigma Chimera at pitch 2 has no Silver Age printing at all, so it
falls through rather than being given a face that does not exist.

`DATA_VER` → `sage-v10`: cards carry a new `prs` map (image per set), and a
warm `sage-v9` cache has none of it.

### The end phase follows CR 4.4.3, in the CR's order

Grounded against `rules.fabtcg.com`. The procedure is **ordered**, and the
trainer ran `e → c → b → f` with two steps missing entirely:

| CR | step | before |
|---|---|---|
| a | allies reset to base life | **never happened anywhere** |
| b | turn-player may arsenal | ran after (c) |
| c | pitch to the bottom of the deck | ran before (b) |
| d | turn-player untaps | folded into *next* turn's setup |
| e | **all players** lose points | only the turn-player |
| f | turn-player draws to intellect | ✓ |

(d) and (e) are invisible while one seat acts and are real two-player bugs the
moment a second seat has a turn between yours — a permanent would stay tapped
through the opponent's turn, and a hero who banks a resource during your turn
would keep it. The action point also moved to the beginning of the **action**
phase where CR 4.3.2 puts it, behind a real start phase (CR 4.2).

**The arsenal set is an end-phase step, not an action.** `fromTrainer` mapped
`mode:"arsenal"` to the action phase with the player holding priority, which
CR 4.4.1 forbids — and which `PRIORITY-IN-CLOSED-PHASE` could never catch while
the mapping itself said otherwise.

### More log, and the turn structure narrates itself

Every CR 4.4.3 step now announces itself, including when it does nothing —
in a *training* sim the sequence is the lesson. Declaring or withdrawing a
defender used to be completely silent and now logs. The on-screen strip went
from 4 lines to 8.

### A permanent in the arena can be activated

The board's `onClick` opened the zoom modal for anything that was not an ally,
so **Energy Potion** and **Timesnap Potion** — both "Destroy this: …" — were
decoration. Board permanents now build a `powCard` the way gear does, routed
through the same pool-first-then-pitch-or-cancel flow, and `execute` pays the
destroy cost into the turn-stamped graveyard.

Allies keep `allySwing` for now: their attacks are costed (`{r}`, `{t}`) and
belong with the attack-target wiring (CR 1.4.5), which is a bigger job.

**403 → 405 drills**, fairness clean, pool unchanged at 265 full.

## v2.34 — the arsenal cluster closes

v2.33 built the face-up mechanism and one enabler. This finishes the other
two, and each was inert for a *different* reason:

- **Bull's Eye Bracers** — `parseHeroPower` refused any conditional effect, so
  the whole ability was dropped and the equipment had no button at all.
- **Death Dealer** — a Bow, so it took the weapon path; `weaponCost` requires
  `": attack"` and this ability is a put, so nothing claimed it. Weapons can
  now carry a non-attack activated ability, through a door deliberately narrow
  enough that no other weapon grows a button nothing is wired to run.

**Three bugs found on the way, none of which the coverage audit could see:**

1. **The Bracers were pumping themselves.** "It gains +1{p} until end of turn"
   — "it" is the **arrow that was just put**, not the equipment. Both the
   clause router and the whole-text self-pump fallback read it as the source's
   own pump. Same wrong-subject shape as v2.30's arrow buff landing on a sword.
2. **The stamp was being dropped entirely.** `buildPrompt` carries only the
   fields it knows, so `arsStamp` never reached `promptConfirm` and the +1
   would have silently done nothing. Caught by a drill, not by eye.
3. **Death Dealer's rider was filed unread**, holding it at `part` after it was
   genuinely wired. The clause ledger is corrected only when the ops are
   actually claimed.

**Arsenal capacity is modelled, not assumed.** Two printed wordings that are
not the same question: a plain put needs a **free slot**, while "if you have no
cards in your arsenal" means **zero**. They coincide at capacity 1, which is
exactly why hardcoding 1 would have hidden the difference. `arsCap` / `arsFree`
/ `arsEmpty` live in `parser.js` beside `runeCount`; the storage is unchanged.

**Measured:** 263 → **265 full**, 110 → 108 part. `npm run fairness` clean.
381 → **391 drills**, and the two that matter are proven to bite by
reintroducing the bug.

**Still unclaimed on purpose:** Entangling Shot (taps a hero, not modelled) and
Spire Sniping (a *reorder*, which `opt` is not — `opt` permits bottoming, which
would be strictly more powerful than printed).

## v2.33

THE ARSENAL GOES FACE UP — Azalea's engine, 3 cards none -> full. The trainer's
end-of-turn arsenal sets cards FACE DOWN; these arrows trigger on FACE UP, which
is a different event reached only by an enabler that says so. Conflating the two
would fire triggers the cards do not have. Built machinery-first so the parser
reading came on LAST — never parse ahead of wiring. A card put face up carries
`_faceUp`/`_upTurn` on the card itself (like a minted card's `_playTurn`), so no
new side field: the arrow's payload is STAMPED onto it (`_arsPow`, `_arsGA`)
rather than run immediately, because "+2{p} this turn" and "go again this turn"
must survive until the arrow is actually played later that same turn — and
expire if it is not. Dry Powder Shot 3 -> 5 power the turn it is set, back to 3
after; Swift Shot goes again that turn only. Enabler wired: Call in the Big Guns,
whose subject is read ("an arrow") so it cannot put a non-arrow, and whose FIRST
effect resolves whether or not the put happens (user ruling 2026-07-28: only the
put is skipped when a slot is occupied; arsenal capacity is a seam, normally 1
and two with New Horizon). Entangling Shot and Spire Sniping deliberately stay
unclaimed: tapping a hero is not modelled, and "put them back in any order" is a
REORDER, which `opt` is not — opt lets you bottom cards, which would be strictly
more powerful. Death Dealer and Bull's Eye Bracers are the two remaining
enablers.

## v2.32

THE FAIRNESS SWEEP — tools/fairness.js asks "is any card STRONGER than printed?", which is a different question from the audit's "how much did we read?" and the one that decides whether a game is fair. Three bugs shipped in a week with the audit reporting IDENTICAL tiers before and after each; every affected card said full. On its FIRST run the sweep found two more: Aether Quickening and Swiftwater Sloop x2 granted go again outright because their gated clause starts "Surge -" / "High Tide -" rather than "If", so the conditional handler never saw it and a rule matching the TAIL "it gets go again" fired — now anchored at both ends. And Emeritus Scolding x3 read "INSTEAD deal 4" as an ADDITION, dealing 6 where the card prints 4; "instead" now REPLACES, with execute suppressing the base op when the condition fires. The sweep is deliberately one-sided (too-weak is failstates.js's job) and test/fairness.test.js pins that it stays quiet, with each check backed by a real card — reintroducing the four bug classes makes it report 41/33/22/3.

## v2.31

PRINTED go again vs MENTIONED go again. The database's card_keywords is a keyword INDEX — it lists every keyword appearing on the card, including ones the text only grants conditionally — so keeping it apart from granted_keywords (the Kayo fix) was necessary but NOT sufficient. Seeding fx.ga from it gave 27 pool cards unconditional go again against their own printed text: Buckwild went again on an empty pitch zone, and Runerager Swarm logged "condition not met" and then went again anyway, which was visible in a play session and not noticed. Go again keeps your action point, so it is the most valuable keyword in the game to get wrong. The discriminator is the printed layout: a real keyword line stands alone in its own paragraph while a granted one sits inside a sentence; if the text never mentions it, trust the list. 77 cards keep it, 27 lose it, and the conditional path still grants it when the condition is MET.

## v2.30

NEXT-ATTACK BUFFS WERE WRONG TWICE OVER, and the coverage audit could see neither — every affected card reported tier full. They were read, and read WRONG. (1) The QUALIFIER was swallowed on 24 cards: "your next ARROW attack gets +3{p}" emitted a bare buffNext, so an arrow buff landed on a sword and a Runeblade buff on a Generic. attackQual now reads it off the printed type line, distinguishing "Brute or Warrior" (OR) from "Pirate ally" (AND), and qualified buffs ride on a new side field buffQ — where a buff that does not match is NOT spent, it waits for an attack it applies to. (2) The buff was COUNTED TWICE on 34 cards: fxParse's whole-text fallback for "gains +N{p}" matched the same clause the buffNext rule already took, and execute added both — Act of Glory granted +12 from a printed +6, the Lace cycle +6 from +3. The fallback now refuses when a buffNext op already read that pump, while still catching a genuine self-pump. Both regressions drilled and both drills proven to bite.

## v2.29

optFilter must consume the WHOLE subject phrase or refuse. v2.28 read it with loose substring tests, which shipped a real bug: Mounting Anger says "banish an attack action card from your hand WITH COST LESS THAN THE NUMBER OF DRACONIC CHAIN LINKS YOU CONTROL", the test saw "attack action card", returned {type:attack} and silently dropped the limit — so any attack card in hand became a legal banish, strictly better than printed. Its look-alike Rising Resentment escaped only because its PAYLOAD was unreadable, not its filter. Now three shapes refuse and are drilled: a dynamic limit, "ANOTHER aura" (an exclusion a field filter cannot express), and "a card with crush" (a rules-text qualifier). Mounting Anger correctly drops full -> part and the coverage baseline is repinned DOWN on purpose — the previous number was an over-claim.

## v2.28

OPTIONAL COSTS ARE READ. "You may banish an aura from your graveyard. If you do, deal 1 arcane damage" — 24 pool cards are shaped like this and NOT ONE was fully read, because the rider hangs off an optional cost and running it free is the bug v2.04 fixed. prompts.js's `pick` variant gains an `ops` rider that fires ONLY when cards actually moved, so declining costs nothing and grants nothing; the parser pairs the two clauses in fxParse (they arrive separately, split on the period) into fx.optCost and reads the cost's subject into a prompts filter from printed fields only, refusing anything it cannot read honestly rather than guessing. Wired for the `attacks` trigger, queued via promptQ and addressed to the ACTOR. Pool goes 258 -> 264 full, 35 -> 33 none. Also in this version, from a spun-off task: the runechant pop now credits hist.arc, so arcDealt and the "arcane dealt" pip finally see Viserai's primary arcane source.

## v2.27

THE PRIORITY MACHINE, IN SHADOW. Roadmap Phase A step 4 is the one that changes CONTROL FLOW rather than field names, so it lands in two moves; this is the first. DawnPriority.fromTrainer derives phase/step/priority/turnPlayer/attacker from the trainer's mode/bphase and setG merges them into every state, but nothing consumes them yet. Two payoffs: it turns FOUR dormant invariants on (BAD-PHASE, BAD-STEP, BAD-PRIORITY and PRIORITY-IN-CLOSED-PHASE all guard with != null, and the trainer carried none of those fields, so they had never fired on a real game since v2.21); and it proves the mapping before any control flow depends on it. The CR-counter-intuitive case is verified live: in the defend step the TURN-PLAYER holds priority (CR 7.3), so while the dummy swings canAct(you) is false while canDeclareDefenders(you) is true — declaring blockers is a free simultaneous game-state action (CR 7.3.2), not a priority action. Attack vs defense reaction windows now come out of speedAllowed correctly on both sides. The clock is deliberately NOT wired: priority.js counts player-turns while the trainer's turn counts only your own and feeds the escalation table and the score. ALSO: html-balance.test.js now rejects an orphaned comment terminator — a block comment closed twice, so the prose after it becomes code. That exact bug shipped during this version and broke the page completely while all 338 drills stayed green, because the orphaned prose had balanced brackets.

## v2.26

THE SEEDED RNG. engine/rng.js is a pure, serializable random source (mulberry32) carried IN game state as s.rng, and every game-affecting draw now comes off it: both opening shuffles, the pregame throw, Knucklehead's d6, intimidate's pick from the opponent's hand, and the dummy's graveyard recycle. A match now has ONE seed, stamped when the match begins and threaded Loadout -> Pregame -> Battle through cfg; the throw runs on a derived sub-stream so the opponent's hand does not correlate with anyone's deck. rng.seed is the replay key and rng.n a draw counter that doubles as a desync canary, and both now ride in the JUDGE!! report so "this looked wrong" becomes a reproducible game. The unseeded DawnGame.shuffle was DELETED rather than left beside the seeded one under a shorter name — the same reasoning that removed sides.js's you/foe in v2.24. Also fixes mkRune, which minted runechants and credited made/aura history to seat 0 whoever played the card — the same seat-hardcoding class as popRunechants. Cosmetic randomness (taunts, trophy text, the random-hero button) is deliberately left on Math.random.

## v2.25

THE RULES CORE SPEAKS IN ACTOR TERMS. Five of the seven functions ROADMAP-MULTIPLAYER.md names as the rules core — runOps, execute, resolveStack, tryPlay, takeIt — now resolve relative to s.actor instead of a hardcoded seat 0 (~430 call sites). Two genuine seat-hardcodings fixed on the way: popRunechants(n, 0, ...) popped SEAT 0's runechants whoever was swinging, and tapTwice's `act` parameter silently shadowed the global act() helper for that whole closure (renamed `commit`). A literal sides[0]/sides[1] inside a migrated function is now a drill failure — it is the same bug as you(), wearing a different hat. The ledger also grew an honest denominator: it tracks exactly the seven functions the roadmap names, so newTurn and foeSwing are visibly PENDING rather than quietly missing; both stay last on purpose because they encode the DUMMY specifically and get replaced when seat 1 gains a real action phase.

## v2.24

THE ACTOR SEAM — ROADMAP-MULTIPLAYER.md Phase A step 1, "the whole ballgame". you() means SEAT 0, not "the player acting", and the two readings only coincide because one seat ever acts; the moment a second human sits down, every rules function draws from the wrong deck. So perspective and actor come apart: you()/opp() stay as UI helpers, and act()/foe()/actMut()/foeMut() read a new shared s.actor for the RULES. actor defaults to 0, so act(s)===you(s) today and every swap is behaviour-identical NOW while being correct for seat 1 later — which is what makes this migratable a function at a time instead of big-bang. runOps is migrated (92 call sites); execute/resolveStack/tryPlay/takeIt are pinned as PENDING in the new test/actor.test.js ledger, which fails if a migrated function reaches for you( again. Also DELETED sides.js's dead seat-hardcoded you/foe rather than pinning them: the trainer's actor-relative foe would have collided with DIFFERENT semantics (sides[1] vs sides[1-actor]), so KNOWN_COLLISIONS SHRANK to [endTurn, other].

## v2.23

RUNECHANTS ARE AURAS, NOT A COUNTER. The printed token is a "Runeblade Token - Aura", and seven pool cards ask about auras generically ("if you control 3 or more auras", "you may destroy an aura you control", "whenever you play an aura") — none of which could ever see an integer. They are now real board permanents, so they render the actual token art instead of the text chip "Runechant ×2", and runeCount/auraCount read the board. Two rules fixes fall out: the trigger fires on PLAY, so a runechant the attack itself conjures (Viserai's rite) no longer pops on that same attack; and because a triggered ability sits above the attack on the stack, the arcane resolves at declaration BEFORE the attack's damage rather than after it. Also: attack targets (CR 1.4.5) — resolveEntry carries an ally's life, engine/game.js gains attackTargets/damageAlly/resetAllyLife and prompts.js a sixth `target` variant; an attack on an ally cannot be blocked (CR 7.3.2a). Trainer wiring for the target prompt is still to do — see CLAUDE.md.

## v2.22

JUDGE!! — a bug report written at the table. The button sits on the log pane and captures the whole board with the note (zones with uids, counters, chain, prompt, the feed, and any invariant violations), so the note can be one line; Copy or Save Report. Also fixes a real rules bug: CR 4.4.3f says "if it is the first turn of the game, all other players draw cards until the number of cards in their hand is equal to their hero's intellect" — the non-turn player refills on turn one only. The opponent-first opening never did it, so going second cost an extra swing AND left you short-handed for your first action phase. That is a large part of why opponent-first played harder than it should.

## v2.21

THE GUARD RAILS. engine/invariants.js is a judge that audits the STATE rather than the cards — a card in two zones at once, a per-side field written to the game object, a defending card re-declared on a second chain link (CR 7.3.2b), priority held in a phase that has none (CR 4.2.1/4.4.1). It is wired into setG, so every state change in a real game is audited; it never throws. Four genuine CR violations fixed in engine/priority.js: priority was granted during the start and end phases, the defend step handed priority to the defender instead of the turn-player (CR 7.3), only the turn player's floating resources fizzled instead of BOTH players' (CR 4.4.3e — a real two-player bug), and the action point was issued in the end phase instead of the action phase (CR 4.3.2). New: tools/failstates.js re-reads every card and asks how it goes WRONG at the table rather than how much text is unread, and feeds sweep.html a ranked section 4. It found the noop blind spot: phantasm and watery grave are filed as "does nothing", so Spears of Surreality, Enigma Chimera and five Gravy Bones allies report tier=FULL from coverage alone. CORRECTED in v2.23 — the tool now cross-checks the trainer by name the way the sweep does, because phantasm IS enforced (the trainer pops the attack at declaration) and reporting it ignored from parser status was an over-claim. Watery grave is the real half-built one: the permission to replay from the graveyard exists, the face-down rule does not.

## v2.20

THE MIRRORS ARE GONE — index.html now LOADS engine/*.js with plain script tags instead of carrying a hand-mirrored copy of every shared function. 51 duplicated definitions deleted (-55KB, ~20% of the file); one copy of each function now exists in the project and drift is impossible by construction. sync.test.js flips from "the two copies must match" to "there must be no second copy", and pins the three engine/trainer name collisions (endTurn, other, you) that wiring priority.js will have to resolve. Still no build step: plain UMD scripts, works over file://.

## v2.19

Two-tap hand — first tap peeks the card at a readable size, second commits (play, pitch, defend, react, arsenal all through one cell). Equipment abilities show their own art instead of a text placeholder. Fixes five v2.18 leftovers where ward/hist/blockH/blockG/blockRx/paySel were written to the game object instead of the side.

## v2.18

THE MIGRATION IS DONE — every counter and status joins the zones on sides[], both seats are built by one makeSide, and flatRemaining hits 0. Cost readers now take a SIDE, not the game.

## v2.17

The prompt sheet becomes general — pick-a-card, choose-one modal, pay-or-decline, reveal, plus opt, all as DATA specs in engine/prompts.js rather than a branch per card. Prompts are addressed to a SIDE, so a ruling can ask the opponent.

## v2.16

The player's zones and life join the opponent's on sides[] — both seats now declare an identical zone set, and the dummy gains the arsenal, pitch, banish and soul it never had. Reads via you()/opp(), writes via youMut()/oppMut(). Fixes a pre-existing bug where auras that crumbled at the top of your turn were restored to the board on the same line.

## v2.15

The opponent's deck, hand, graveyard, iron, board and life move off the flat d* stubs and onto sides[1].

## v2.14

Multiplayer groundwork — engine/sides.js (symmetric two-sided state + lossless legacy bridge), engine/priority.js (phases, chain steps, priority passing), and the rock-paper-scissors pregame whose winner CHOOSES the seating.

