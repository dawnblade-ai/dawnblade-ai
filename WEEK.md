# The week — finish the card logic by building READERS, not heroes

> **Written 2026-08-29, at v3.51.** Every number here was measured, with the
> command to re-derive it. Read `CLAUDE.md` first, then this.

---

## THE REFRAME — the remaining work does not sort by hero

Phase C was scoped **one hero at a time**, and that was right for Kayo: he was
the pilot, and the method was the deliverable. It is the wrong shape for what
is left.

**Measured:** 70 of 405 pool cards are not `full` (59 `part`, 11 `none`), and
**52 of those 70 are ONE clause away.** Those clauses cluster into five
families that cut straight across the hero list:

| cards | family | what it needs | machinery? |
|---|---|---|---|
| **12** | **pick from a zone** — graveyard, deck, banish | a reader that emits a `pick` spec | **BUILT** (`prompts.js`, v2.17) |
| **10** | **counters on a permanent** — steam, +1{p}, aim | a *targeted* counter put | half — `counters` exist, keyed by uid |
| **9** | **create a token on a trigger** | wire the trigger; the mint is generic | **BUILT** (v3.33 gave tokens their real names) |
| **8** | **"you may …, if you do …"** | two unwired queue sites | **BUILT** (`optCost`, v3.20) |
| **7** | a granted/conditional keyword | `hasKwNow` / rider plumbing | **BUILT** |
| 24 | unclustered one-offs | each its own reading | — |

**Four readers close roughly 46 of 70 cards.** None of them is new machinery:
`prompts.js` has had the `pick` variant since v2.17 and `optCost` has had two
queue sites marked "still to wire" since v3.20. **The gap is not
understanding and it is not plumbing — it is readers nobody has written.**

**And the rulings are effectively done.** `npm run stack` reports **4 open, 5
cards** (`charge`, plus three one-offs). 119 rulings recorded, and the
distance left is the one CLAUDE.md names: *understood ≠ built.* **You should
expect to answer almost no new rules questions this week.**

Re-derive all of it:

```sh
npm run audit && npm run stack        # 335 full / 59 part / 11 none · 4 open
node -e '…'                           # the family clustering — see below
```

---

## THE ORDER — highest cards-per-hour first

### 1. `pick` from a zone — 12 cards · **start here**

Twelve cards say some version of *"return / put / banish target card from
your graveyard."* `prompts.js` has done this since v2.17 and no parser rule
emits the spec.

```
Beckoning Haunt · Crown of Dichotomy · Hope Merchant's Hood · Call in the Big
Guns · Flamecall Awakening · Rise from the Ashes · Pass Over · Preserve
Tradition · Pick Up the Point · Up Sticks and Run · Halo of Illumination ·
Compass of Sunken Depths
```

**The whole job is `optFilter`'s sibling on the OTHER side of the cost.**
`optFilter` already reads a subject phrase into a prompts filter from printed
fields only, and **refuses what it cannot read honestly** (v2.29). Reuse it —
do not write a second subject reader, or the two will drift.

**Watch for:** `to` is the destination and accepts `deckTop`/`deckBottom`;
omit it and the pick is a reveal that moves nothing (v3.33's Crash and Bash).
`Pass Over` reads an **opposing** graveyard, so the zone carries a side.

### 2. Counters on a permanent — 10 cards

*"Put a steam counter on a Hyper Driver you control", "three +1{p} counters
on target aura with ward", "if this has an aim counter, it gets piercing 1."*

`counters` is already a per-side map keyed by **uid**, and `aim` (v3.39) is
the worked example of a targeted put. What is missing is the general one: a
counter KIND, an amount, and a target chosen from a filter.

**Do NOT invent counter kinds.** Read the kind off the printed line, the way
`fx.rustDestroy` reads its threshold off the card (v3.17). A hardcoded list is
the no-op blind spot waiting to happen.

**Watch for:** a counter the ability SPENDS must be on screen (v3.39) — the
display half is part of the job, not a follow-up.

### 3. Two unwired `optCost` queue sites — 8 cards

`fx.optCost.trigger` already names which trigger a card wants. **`play` and
`attacks` are live; `hits` and `defends` are not** — v3.20 says so in as many
words and the note has been sitting there for thirty versions.

Each is a queue site, not new machinery. **v3.20's own lesson applies:** its
only queue site sat inside `if(attacking)` while every card that needed it was
a non-attack, so the feature existed and was never once offered. **Drive the
real entry point** — a drill that builds its own spec proves the fixture.

### 4. Token-on-a-trigger — 9 cards

The mint is generic and correct since v3.33. What is missing is the trigger:
*"if it's defended by an attack action card, create an Agility token"*, *"when
this is destroyed, create a Spectral Shield token."*

**`defends` and `destroyed` are schedules — ask which board runs each** (v3.01),
and put the body in `effects.js` where both callers reach it.

### 5. Then, and only then, the one-offs

24 cards, each its own reading. Several are already recorded decisions rather
than work — **Ice Eternal** (X-cost, refused on purpose), **Cosmo** (see
below), **Walk in My Shoes** (halves base {p} and {d}, no reader).

---

## THE STREAMLINING — three things that would pay for themselves

These are the "simplify the process" half of the brief, and each is small.

**1. `npm run gaps` — the family clustering as a tool.** The analysis at the
top of this file was a one-off `node -e` script. It is the single most useful
view of the remaining work and it should be a command beside `audit` /
`stack` / `fairness`, so the next session opens with *"what closes the most
cards"* instead of re-deriving it. ~40 lines, reads `tools/audit.json`.

**2. A `readers` checklist in the audit.** Every one of the five families is
"a clause shape with no reader." The audit already lists skipped clauses per
card; grouping them by shape and printing the top ten would make the next
family obvious without any clustering script at all.

**3. Stop hand-rolling the ship loop.** Nine versions shipped this month and
every one ran the same sequence by hand: `npm test` → fairness → failstates →
audit diff → babel compile → bump → CHANGELOG → CLAUDE.md → HANDOFF → commit.
**The babel compile is the one that is deliberately not a drill** (no
dependencies on a fresh clone) — but it can still be a script that documents
the order. A `tools/ship.js` that RUNS the checks and PRINTS the remaining
manual steps would remove the only part of this project that is genuinely
tedious.

---

## STANDING WORK — carried, with reasons

| | |
|---|---|
| **the phone pass** | v3.42-v3.51 shipped on drills and self-play; **ally combat has never been played on a phone**. Deploy an ally, tap it to swing, watch the defend step and the action point. A tap that does nothing is this project's worst failure mode and only a phone finds it |
| **tuning the table seat** | the brown button's opponent wins **29 of 45** (v3.51, measured). `npm run play` makes this measurable for the first time — the levers are `sparring.js`'s `DEFAULTS` (`takeUpTo`, `maxPitch`). **A play session, not a drill** |
| **`sparring.act` cannot pilot a control hero** | Iyslander: 0 wins in 210 games, and all remaining stalls. It ranks attacks and her deck has none. See PLAYNOTES.md finding 3 |
| **nothing attacks an ALLY** | so Oysten's death trigger still has no driver. The policy always names the hero (CR 1.4.5) — a deliberate refusal to guess, not an oversight |
| **Cosmo swings for 0 power** | judge routes on `types.isWeaponType` where `build.js` routes on `parser.isWeapon`. Tested as a fix at v3.49 and it did **not** help the stalls, so it is recorded rather than shipped on a guess. It makes a card inert, which is a decision |
| **Lyath** | the cheapest remaining hero — three versions converged on him without anyone aiming. `HANDOFF.md` carries his measured state |

---

## THE BAR — unchanged, and it is why this works

Every entry in `CLAUDE.md` is a bug that shipped. The four that pay off most
often on this kind of work:

1. **Never invent card effects.** Teach the parser to read the text.
2. **A reader that cannot read the whole subject REFUSES.** Weaker than
   printed and visible beats stronger than printed and silent (v2.29).
3. **Sabotage every new drill — and sabotage the guard too.** Four of eight
   sabotages last week found a weak drill rather than a weak engine.
4. **When you close a recorded gap, delete the record** (v3.41).

And the newest one, which this plan exists because of:

> **A feature with no caller looks exactly like a feature that works, until
> you count.** Four of the five families above are machinery that was built,
> documented, and never wired to a reader. Before building anything new this
> week, check whether it already exists.
