# The week — finish the card logic by building READERS, not heroes

> **Written 2026-08-29, at v3.51. REVISED at v3.53**, after the first family
> was built and the other four were re-measured against the parser rather
> than against card text. Every number here was measured, with the command
> to re-derive it. Read `CLAUDE.md` first, then this.

> ### WHAT v3.53 CHANGED IN THIS PLAN
>
> **The families are TEXT-PATTERN clusters, and two of the "needs:" lines
> did not survive contact with the parser.** `gaps.js` says so itself — *a
> card lands in the FIRST family it matches* — but the `needs:` line is a
> CLAIM about machinery, and a claim is a test with no assertion (v3.41).
> Checked one at a time:
>
> | family | the plan said | measured |
> |---|---|---|
> | pick from a zone (12) | one reader | **3 were one reader** and shipped; the other 9 are a deck SEARCH, an X-cost, a two-target pick, a hand→soul put, a shuffle-redraw, a per-turn go-again, and one that was already BUILT |
> | *"you may …, if you do"* (8) | the `hits`/`defends` queue sites | **none of the 8 is an `optCost` card.** Each needs a different COST shape — destroy-this, pay `{r}{r}{r}`, a modal "discard a card OR destroy the top of your deck" |
> | token on a trigger (9) | wire the trigger | the mint is generic, but each card needs its own **condition** — *"if a yellow card is discarded this way"*, *"if you prevent damage this way"*, *"when this is destroyed"* — so it is nine readings, not one lever |
> | counters on a permanent (10) | a targeted counter put | **holds up.** The one family whose label survived |
>
> **`defends` WAS ALREADY WIRED — v3.33 built it**, and `hits` has **zero**
> pool cards. So "two unwired queue sites" was one site with no customers.
> `CLAUDE.md`'s *"Still to wire: the `hits` and `defends` triggers"* was
> stale in the same way; both are corrected.
>
> **AND THE FIRST FAMILY HID A WORSE BUG THAN THE ONE IT WAS SCOPED FOR.**
> The arsenal FACE-UP put's queue site sat inside `if(attacking)` and not
> one of the three pool cards that prints one is an attack — v3.20's defect
> verbatim, one mechanic over. See CLAUDE.md, "A FIX FOR ONE MECHANIC IS
> NOT A FIX FOR THE SHAPE".
>
> **THE LESSON FOR THE REST OF THE WEEK:** `npm run gaps` is the right
> place to start and the wrong place to stop. Before building a family,
> ask the PARSER which cards actually carry the field the family names —
> `fx.optCost`, `fx.arsenalPut` — rather than trusting the label. That
> check is a two-minute script and it moved two of five families.
> **`tools/gaps.js`'s own `needs:` lines were corrected at v3.55**, so the
> tool no longer oversells them.

> ### WHERE THE WEEK GOT TO — v3.52 → v3.55
>
> **335 → 347 full · 59 → 47 `part`.** Twelve cards closed, and three of the
> five findings were not cards at all:
>
> | ver | what |
> |---|---|
> | **3.53** | three `pick` readers (Preserve Tradition, Rise from the Ashes, Pass Over) — and the **arsenal face-up put had never fired from `execute`**, its queue site inside `if(attacking)` while all three cards that print one are non-attacks. `moveFoe` had carried `{from,to}` for three versions with a consumer that ignored both |
> | **3.54** | **destroyed gear goes to the graveyard** (RULING, user) — an approximation invisible only because the one thing that would read it was unbuilt. Then `retrieve`, settled by READING THE PRINTING: *"(Pay {r} to equip it.)"* |
> | **3.55** | the **targeted counter put** — kind, amount and target all off the printed line, kind vocabulary closed to what something reads |
> | **3.56** | the **boost-banish trigger** — a schedule that fires from the DECK, on a card its controller never played |
>
> **What is left, honestly** — see `npm run gaps`, whose family lines now
> say it: nine token-on-a-trigger cards each needing their own condition;
> eight *"you may"* cards needing five different cost shapes; seven
> counters cards each needing a TRIGGER (boost-banish, arrow-put,
> enters-with) plus a reader for *"if this has an aim counter"*; and six
> pick cards that are a deck search, an X-cost, a two-target pick, a
> hand→soul put and a shuffle-redraw.
>
> **The standing work below is untouched and still the highest-value
> non-card item** — above all the phone pass, which nothing in these three
> releases could substitute for.

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

### 1. `pick` from a zone — ~~12 cards~~ **DONE at v3.53 (4 closed)**

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

**BUILT at v3.53.** Preserve Tradition (grave → deck bottom), Rise from the
Ashes (grave → hand, optional), Pass Over (their grave → banish), and Call
in the Big Guns — which turned out to be **already built and mis-reported**,
its `arsenalPut` unreachable because the queue site was in the wrong branch.
`pickSubject` is the subject reader, deferring to `optFilter` for everything
but a bare "card". `foePickTop` generalised to `foePick`.

**WHAT IS LEFT OF THIS FAMILY, honestly:**

| card | what it actually needs |
|---|---|
| Pick Up the Point · Up Sticks and Run | `retrieve` — **settled at v3.53**: the SAR017 printing reads *"(Pay {r} to equip it.)"*, and it needed destroyed gear to reach the graveyard first (RULING, user, 2026-08-29) |
| Beckoning Haunt | an **X-cost** — refused on purpose, pinned by a drill |
| Crown of Dichotomy | **two** targets with different filters, ordered |
| Halo of Illumination | hand → **soul**, with a rider on the picked card's class |
| Hope Merchant's Hood | shuffle-any-number and redraw — deck manipulation, still genuinely open |
| Flamecall Awakening | a deck **SEARCH** — a hidden zone, not a graveyard pick |
| Compass of Sunken Depths | **not a pick at all** — a per-turn go-again on watery-grave plays |

**Watch for:** `to` is the destination and accepts `deckTop`/`deckBottom`;
omit it and the pick is a reveal that moves nothing (v3.33's Crash and Bash).
`Pass Over` reads an **opposing** graveyard, so the zone carries a side.

### 2. Counters on a permanent — ~~10 cards~~ **the PUT landed at v3.55 (3 closed)**

*"Put a steam counter on a Hyper Driver you control", "three +1{p} counters
on target aura with ward", "if this has an aim counter, it gets piercing 1."*

`counters` is already a per-side map keyed by **uid**, and `aim` (v3.39) is
the worked example of a targeted put. What is missing is the general one: a
counter KIND, an amount, and a target chosen from a filter.

**Do NOT invent counter kinds.** Read the kind off the printed line, the way
`fx.rustDestroy` reads its threshold off the card (v3.17). A hardcoded list is
the no-op blind spot waiting to happen.

**Watch for:** a counter the ability SPENDS must be on screen (v3.39) — the
display half is part of the job, not a follow-up. *(Checked at v3.55: the
BOARD already renders counters generically on both boards, and gear renders
steam/rust/pow, so this was already satisfied for everything `ctrPut`
emits.)*

**BUILT at v3.55 — `ctrPut`.** Re-Charge!, Astral Etchings and Uphold
Tradition. The kind, the amount and the target all come off the printed
line; the kind vocabulary is CLOSED to the four counters something actually
reads. **What is left in this family is a TRIGGER each**, not a put:

| card | needs |
|---|---|
| ~~Crankshaft ×2 · Big Bertha~~ | **BUILT at v3.56** — the boost-banish trigger, `fx.boostBanish`, fired at the one site that banishes a card for boosting |
| Crow's Nest | *"whenever an arrow is put face-up into your arsenal from your deck"* |
| Waxing Specter | *"this **enters the arena with** a +1{p} counter"* |
| Drill Shot | a READER, not a put: *"if this has an aim counter, it gets piercing 1"* |
| Plasma Barrel Shot | a self-targeted put behind *"if this has no steam counters"* |

### 3. ~~Two unwired `optCost` queue sites — 8 cards~~ — **THE LABEL WAS WRONG**

**Re-measured at v3.53 by asking the parser instead of the card text.** Every
pool card that sets `fx.optCost`, by trigger:

```
attacks: Fire that Burns Within · Golden Tipple · Jack Be Quick · Runic Fellingsong
defends: Crash and Bash            (WIRED — v3.33, in afterDefenders)
play:    Condemn to Slaughter       entersLeaves: Sigil of Silphidae
hits:    (none)
```

**`defends` has been wired since v3.33 and `hits` has no pool cards at all**,
so there is no queue-site work here. And **none of the eight cards the family
listed is an `optCost` card** — they match the *"you may …, if you do"* text
and each needs a different COST shape:

| shape | cards |
|---|---|
| *"you may destroy **this**"* — the source, not a filtered pick | Beaten Trackers, Refraction Bolters |
| *"you may pay {r}{r}{r}"* — the `pay` variant | Silent Stilettos |
| *"discard a card **or** destroy the top card of your deck"* — a **modal** cost | Washed Up Wave, Jittery Bones |
| a **dynamic** filter (*"cost less than the number of Draconic chain links"*) | Mounting Anger, Rising Resentment — refused on purpose |
| its own reading | Wreck Havoc |

**The generalisable piece here is `optCost` learning a `self` cost kind**
(*"you may destroy this"*), which is two cards and is not a queue site.

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
