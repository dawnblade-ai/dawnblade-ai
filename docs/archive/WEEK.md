# The week ahead — the delayed grant, the last three `none`s, and two rulings

> **Written 2026-09-11 at v4.39.** Every number here was measured, with the
> command to re-derive it beside it — a live count is only true at the
> moment it is taken (v4.17). Read `CLAUDE.md` first, then this. The
> previous fortnight's plan and its outcome are in `CHANGELOG.md`
> (v4.19–v4.39) and `HANDOFF.md`.

---

## WHERE THIS FORTNIGHT LANDED

**Twenty-one versions, v4.19 → v4.39.** Coverage went **377 → 389 `full`**
and **4 → 3 `none`**, which badly understates it, because most of the work
was not coverage at all:

| | |
|---|---|
| **Nine findings were cards that read `tier: full` and did nothing, or did the wrong thing** | an escalating ladder read as one gate (v4.19) · a keyword in the vocabulary nothing consumed (v4.20) · a counter clock eleven records printed and one card ran (v4.23) · a mandatory watcher filed into a list an Item never opens (v4.25) · fusion's reveal taken without being paid (v4.27) · charge taken without being offered (v4.33) · `Ward N` banked as a pool instead of paid by its permanent (v4.34) · a prevention that never stopped arcane (v4.35) · a destroy dropped and a "you may" made unrefusable (v4.37) |
| **Four were a feature with no CALLER** | phantasm's two dropped restrictions were unreachable by the ladder at all (v4.31) · the reaction window had no ability caller, nine records (v4.38) · Oasis Respite's rider had read nothing since the card was dealt (v4.36) · the invariant judge's whole WARN band (v4.39) |
| **Five were the INSTRUMENTS, not the engine** | a fault reported as a route (v4.17, carried) · one scan with two consumers giving two verdicts (v4.25) · a report that read its own documentation (v4.27) · a disclosure nobody could read at phone width (v4.28) · a revert-anchor check that threw before reverting (v4.37) |

**And three method lessons were paid for in wasted work**, all now written
into `CLAUDE.md`:

1. **A revert anchor must be UNIQUE, and you revert BEFORE you report**
   (v4.36, v4.37). An inverse edit anchored on a string two folds contain
   put the sabotage back at the wrong site; a harness that asserted
   uniqueness *before* writing the revert left the engine broken and then
   reported eleven consecutive "BITES" against it. Every sabotage is a
   REPLACEMENT now — **an empty string is never a unique anchor.**
2. **A feature with no caller looks exactly like a feature that works,
   until you count.** Fifth, sixth and seventh outings this fortnight.
3. **When you hire an instrument, read everything it produces.** v4.39's
   whole finding was a severity band four years of callers had filtered out.

---

## THE ONE RULE THIS WEEK INHERITS

> **A short tie is a test of variance, not of decks** — and the corollary
> for every measurement in this project: *ask how big the sample needs to
> be before you believe the direction.*

Measured at the Invitational (`npm run cup`, and `PLAYNOTES.md` for the
working): Arakni beats Blaze **74-6 over 80 games**, and 92% still loses a
best-of-three about once in 180 — which the first running produced. In a
close matchup the **chair is worth about 2:1** (Dorinthea beats Arakni 24
times with the chair and 12 without).

So: the 210-game ladder is the evidence; a handful of games is a story.
When a change moves the ladder by one or two wins, that is noise, and
`CHANGELOG.md` should say so rather than claim a balance effect.

---

## THE PLAN, RANKED

### 1. `hitNext` — a delayed on-hit grant, and it is SPENT BY A MISS

**The sharpest single item in the project right now, because it closes a
live defect AND the last reachable `none` card in one build.**

> *"**The next time an attack you control hits a hero this turn**, deal 4
> arcane damage to them."* — BURN UP // SHOCK ×2, Briar's list
>
> *"**Solflare** - When this is charged to your soul, **the next time you
> hit this turn**, gain 1{h}."* — BANNERET OF SALVATION, Boltyn's, `none`

**Measured: exactly two pool records print the shape**, and they are these
two — one live and wrong, one unread.

```sh
node -e 'const fs=require("fs");for(const r of JSON.parse(fs.readFileSync("data/pool.json","utf8")))
  if(/the next time .{0,30}hit/i.test(r.functional_text||"")) console.log(r.name,"|",r.pitch)'
```

**THE DEFECT.** Burn Up's grant is expressed as
`["buffNext", 0, null, {onHit: […]}]` — a next-attack POWER grant of zero
carrying an on-hit rider. `buffNext` is spent by the next attack **whether
or not it hits**, so a fully blocked swing consumes the grant and the feed
says *"Fully blocked — on-hit effects fizzle"* with `grantLeft: 0`. The
card prints *"the next time an attack … HITS"*. **Weaker than printed, and
`tier: full` throughout** — the clause IS consumed, so coverage is blind,
and weaker-than-printed is the direction the one-sided sweep is built not
to look in.

**IT IS A DIFFERENT KIND OF GRANT, NOT A FLAG ON `buffNext`.** v3.87's
standing-versus-single-shot split, one predicate over: `buffNext` is spent
by an ATTACK and this is spent by a HIT. A flag on the existing entry means
every reader of `buffNext` has to ask about it, and the taker is in
`linkPumps` where the hit has not happened yet.

The shape, which is the same five-place checklist every side field in this
project has to satisfy (v3.29):

| | |
|---|---|
| parser | a `hitNext` op off the printed clause, with the payload back through `classifyClause` so nothing is invented |
| `runOps` | a case, because a grant that arrives through a prompt has no other door (v3.99) |
| spent | in **`linkPayload`**, on a hit, where `heroHit` is already the caller's answer (v3.45) — and *"an attack you control hits a **hero**"* is hero-gated while Banneret's bare *"you hit"* is not, so the two records differ and the difference is printed |
| expired | `beginEndPhase` step (8), with the other *"this turn"* grants — v4.07's census, whose whole point is that a field swept outside `held` expires only by coincidence |
| carried | `SIDE_FIELDS` (or `SIDES-ASYMMETRIC`), `wire.js` with a **`WIRE_V` bump and its shape digest** (v4.26), and `report.js`'s `seat()` |

**Both halves or the drill proves nothing**: a blocked swing must NOT spend
it, and a hit must. And the near-miss is real rather than synthetic —
Banneret's *"the next time you hit"* names no target, so a hero gate
applied to both is wrong on one of them.

Expect: **389 → 390 `full`, 3 → 2 `none`**, and re-pin the coverage floor
after reading the diff.

### 2. The last two `none` cards, and neither needs a reader

```
Glisten (pitch 1) · Boltyn
  "Distribute up to four +1{p} counters among any number of weapons you control."
  "At the beginning of your end phase, remove all +1{p} counters from weapons you control."

Hope Merchant's Hood (pitch 0) · Dash, Fai
  "Instant - Destroy this: Shuffle any number of cards from your hand into
   your deck, then draw that many cards."
```

**GLISTEN IS A DISTRIBUTION SHEET AND THE MACHINERY IS MOSTLY THERE.**
`ctrPut` reads a kind, an amount and a target off the printed line (v3.55),
the `pow` kind is consumed by `powCtr` and by the idle wipe, and
`idleCounterWipes` (v3.66) already answers the second sentence's shape —
but that one asks the PIECE's own printed line, and here the wipe is on
**Glisten**, about *"weapons you control"*, which is a different subject.
**Before building machinery, check whether the machinery is the shape you
already have** (v3.58, v3.73): the open question is whether the existing
stamp can carry a wipe whose subject is a class of permanent rather than
one named card.

What is genuinely new is *"distribute up to four … among any number"* — a
sheet that allocates N counters across a chosen set, which no prompt
variant expresses. `prompts.js` has five variants and none is an
allocator. **That is the decision to make before writing any of it**, and
the honest fallback is to refuse rather than to distribute evenly: four
counters spread one-per-weapon is a different card.

**HOPE MERCHANT'S HOOD IS DECK MANIPULATION**, recorded as genuinely open
since the stack was emptied. *"Shuffle any number of cards from your hand
into your deck, then draw that many cards"* needs a `pick` with
`to: "deck"` **plus a shuffle plus a draw of the same count** — and the
count is the answer's own size, which no spec field carries. It is the one
remaining card whose blocker is a real gap in `prompts.js` rather than in
the parser.

### 3. Two rulings are needed, and the work is BLOCKED on them, not on code

`tools/approx.js` has **seven `open` records**, and two of them are
questions for the user rather than engineering:

| record | the question |
|---|---|
| `cloaked-face-down-values` | does a face-down equipment keep its printed **defence** and its **Ward**? v3.99 built the flip deliberately narrow — it gates the one thing the card's own text spends it on — because half-building a value change is worse than the honest gap (v3.23) |
| `cloaked-display` | the *"show card back on the player's board"* half is **deferred with the UI pass** and the ledger says so. Not work; it is parked on purpose |

The other four open records are each a stated design decision with a probe
(`layer-step-window`, `simultaneous-trigger-order`, `x-cost`,
`crush-halving-rider`) and none is this week's work. **`unbuilt-three` is
GONE** — it closed at v4.44 as `pool-deck-complete` when Glisten, its last
claimant, was built; every deck card in the pool now reads something.

### 4. Two keyword leads, from the file upstream actually ships

v4.31's finding was that `csvs/english/keyword.csv` — a sibling of the file
the game already fetches — carries real definitions for **26 of the
ledger's keywords**, and this project had read exactly one row of it.
Two entries are still unresolved and both are cheap to look up:

- **`temper`** — the ledger has it as presenting a choice at 1{d}. Read the
  row and a printing before booking anything.
- **`surge`** — the ledger says `partial` and `tools/approx.js` carries
  `surge-approximated`: it is read into a `surgeOverN` condition and
  evaluated, but the condition is approximated as `amp > 0` rather than
  **the damage actually dealt**. That is a real fidelity gap with a
  standing record, and it is the one of the two that is definitely work.

**Try the printing first** — twelfth outing, and v4.34 was the first where
the CARD was sharper than the keyword file, so read both.

---

## WHAT IS DELIBERATELY NOT NEXT

- **The two new precons (SAT / SBW) — but the date is now known.**
  *Silver Age: Usurp the Shadow Throne* is announced for **2026-09-18**,
  which falls **inside this week**. That changes nothing about the work and
  one thing about the watch:

  **THE STREET DATE IS NOT THE ORACLE.** What decides buildability is
  whether the-fab-cube's `develop` carries the sets — the golden rule's own
  question — and upstream publishes on its own schedule, not the printer's.
  **Re-measured 2026-09-11**, one week out: `set.csv` still lists exactly
  15 Silver Age sets, 4,952 records, **SAT 0 printings, SBW 0**, all 15
  blocking names still absent. So nothing is buildable yet and the probe is
  correctly green.

  **DO NOT POLL FOR IT.** `drift.test.js`'s fifth drill asserts the
  DEVIATION and goes RED by itself the day the set appears — that is what a
  `stated`/`open` probe is for (v4.02), and a note somebody has to remember
  to check is not a probe (v3.61). `npm test` is the watch.

  **WHEN IT DOES GO RED, it is a DATA DROP and the drill says so in its own
  failure message**: re-pin with `node tools/pin-pool.js`, add the hero to
  `HEROES`/`DECKS` in `index.html`, re-measure `upstreamMissing` /
  `cardsBlocked`, **bump `DATA_VER`** (a warm cache has no new hero), and
  update the drill's premise. Budget for the parser work separately —
  Prism's 10 blocked cards and Viserai's 34 are unread text, not just an
  absent record. Standing instruction unchanged: *don't worry about the new
  heroes until the official updates* — this is the official update's date,
  not the update.
- **The phone/UI pass**, including Cloaked's display half. A separate
  project, desktop-only, recorded in the ledger as outstanding.
- **Supabase** (accounts, saved games, reporting) — investigated and
  deferred to desktop; the note is in the repo.
- **Retiring `Battle`.** The gate has been passed since v2.80 and what
  stands in the way is 97 `mode`/`bphase` references. It is still a
  multiplier and it still sequences with tuning rather than before it
  (`FINISH.md`), and it is not a week's work alongside card fidelity.
- **Tuning.** Fifteen heroes span **26 wins to 3** on the ladder and the
  spread is real, but `sparring.act` is UNTUNED by design and a policy
  change moves every number in every report. It belongs at the end.

---

## HOW TO RE-DERIVE EVERY NUMBER IN THIS FILE

```sh
npm test 2>&1 | grep -E '^# (tests|pass|fail|skipped)'   # 2571 / 2566 / 0 / 5
npm run audit                                            # 389 full / 13 part / 3 none
npm run fairness                                         # clean
npm run scenes                                           # 79 passing / 0 failing
node tools/crindex.js --check                            # the 3 allowed pointers
node tools/approx.js | head -6                           # 12 stated / 7 open / 11 closed
npm run play                                             # the 210-game ladder
npm run cup                                              # the bracket + four judges
```

**And a doc claim is a test with no assertion** (v3.41). Every count above
is in the present tense and will rot; the commands are the truth.
