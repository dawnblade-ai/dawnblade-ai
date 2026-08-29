# The week — two MECHANISMS, measured against the parser first

> **Written 2026-08-29, at v3.59, with v3.53–v3.59 LIVE on `main`.** Every
> number here was measured, with the command to re-derive it. Read
> `CLAUDE.md` first, then this. The previous week's plan and its outcome
> are in `CHANGELOG.md` (v3.53–v3.59) and `HANDOFF.md`.

---

## WHERE LAST WEEK LANDED

**335 → 350 full · 59 → 43 `part`.** Sixteen cards closed, two
over-reporting cards deliberately corrected, and seven versions shipped.

**Five of the ten findings were not cards at all** — they were machinery
that existed and had no caller, or a reader that lied:

| | |
|---|---|
| the arsenal FACE-UP put | queue site inside `if(attacking)`; **all three cards that print one are non-attacks**, so it had never fired |
| `moveFoe` | carried `{from,to}` for three versions with a consumer that ignored both |
| destroyed gear | never reached a graveyard, so `retrieve` could never find a dagger |
| a gated leave-trigger | **dropped its condition entirely**, and `npm run fairness` structurally cannot see that |
| `Attack Reaction - …` | an unguarded activation prefix, so Prey Spotters read `full` and could not be activated at all |

---

## THE ONE RULE THIS WEEK INHERITS

> **A family label is a claim about MACHINERY. The clustering can only see
> what a card SAYS. Before building a family, ask the PARSER which records
> carry the field the family names.**

Last week that check moved **two of five** families. This week it moved a
**third**: `npm run gaps` files five cards under *"a granted / conditional
keyword — needs rider plumbing"*, and measured, they need five different
things (a `pumped` gate, an unmodelled `overpower`, a cross-seat arsenal
put, a "this way" record, and a rider on a `buffQ` grant).

**So this plan is organised by MECHANISM, not by text pattern**, and each
item below states what was measured and how.

---

## 1. THE "…THIS WAY" RECORD — 7 cards, one mechanism · **start here**

*"If a yellow card is discarded **this way**"*, *"if damage is dealt **this
way**"*, *"if you prevent damage **this way**"*. The phrase means **what
this card's own resolution just did** — not the turn's history.

**Measured: 17 pool cards print it. 8 already read, 7 are unfinished, 2
are heroes.**

```sh
node -e 'const p=require("./data/pool.json");const arr=Array.isArray(p)?p:(p.cards||Object.values(p));
const s=new Set();for(const c of arr){const t=c.functional_text_plain||"";
for(const m of t.matchAll(/[^.\n]*\bthis way\b[^.\n]*/gi))s.add(c.name)}console.log(s.size,[...s])'
```

| card | tier | what "this way" refers to |
|---|---|---|
| ~~Portside Exchange~~ | **BUILT v3.60** | the card its own `selfDiscard` just discarded — and the discard was being DROPPED entirely, so the card drew for free |
| Path of Same Ends | part | did its own preceding arcane actually LAND (CR 7.5.5) |
| Toe the Line | part | did the prevention it set up actually prevent — **delayed** |
| V of the Vanguard | part | how many Light cards its own charge charged |
| Throw Caution to the Wind | part | the pitch of the card it revealed — **delayed** |
| Concoct Disorder | none | how many cards its own cross-seat arsenal put moved |
| Danger Digits | none | did the dagger's 1 damage land |

**THE EIGHT THAT WORK WERE EACH HAND-BUILT** — `discard6way`,
`chargedPitch`, the reveal ops — one card at a time, with its own
condition name. A general record would unify them, and that is the
argument for doing this as a mechanism rather than seven readings.

### THE STRUCTURAL BLOCKER — **SOLVED at v3.60**, and the shape is reusable

**`fx.conds` is evaluated BEFORE `fx.ops` runs.** In `effects.js`,
`fx.conds.forEach` is at ~line 1583 and `runOps(n, fx.ops…)` at ~line
2175. So a condition asking "what did my own ops just do" is **always
answered against an empty trace**.

This needed a **late-cond pass** — conditions evaluated after the card's
own ops. `pend.lateConds` was the precedent on the attack path (`defLt2`,
`pumped`, in `linkPumps`); v3.60 built its non-attack twin.

**The shape is now in place for the rest of the family:** a `way:`-prefixed
condition is skipped by the main loop and answered by `thisWayMet` against
`n._thisWay`, a trace the ops populate as they run. Adding a card means
recording the fact its own op produced (`selfDiscard` records the cards it
discarded) and teaching `thisWayMet` one more question.

**Do the two immediate cards first** (Portside Exchange, Path of Same
Ends) and leave the two DELAYED ones (Toe the Line, Throw Caution to the
Wind) — their "this way" refers to an effect that resolves on a later
turn-event, which is a different and larger problem. Say so rather than
half-building them.

---

## 2. THE ATTACK-REACTION ABILITY ROUTE — 5 cards, fully scoped

Five pool records print `Attack Reaction - <cost>: <effect>` and **none
has a route**. v3.59 made them refuse honestly rather than report `full`
while inert; building the route is this job.

```
Prey Spotters · Stalker's Steps · Bolt'n Boots · Danger Digits · Boltyn (hero)
```

Every step was measured last week:

1. `parseHeroPower` to accept the prefix, returning `kind:"attackRx"`;
2. **`build.js`'s `_abLine` matches `action|instant` only** — without this
   no powCard is built at all, which is why the cards are currently
   unreachable;
3. a `_attackRx` flag on the powCard. **`_instant` is the exact shape to
   copy** — see `judge.js`'s `playWindows` / `playWindowFor`;
4. `speedAllowed` has distinguished the `attack-reaction` window since
   v2.27, so the window itself already exists;
5. the payloads — *"target attack with &lt;qualifier&gt; gets go again"* —
   onto the open link via **`effects.attackRx`** (v3.11), which already
   does exactly this for attack-reaction CARDS. `attackQual` reads the
   qualifiers (`arrow`, `with stealth`) and `pumped` is the cond for
   *"with {p} greater than its base"*;
6. **the trainer's own offering path in `index.html`** — the half no drill
   can validate, and the reason this was not built in v3.59.

**THE RISK IS STEP 6, AND IT IS A REAL ONE.** An ability offered in the
wrong window is *"illegal play allowed"* — sev-3, the direction that
steals games. Drive `judge.legal` for the window in a drill, and get the
trainer half onto a phone before calling it done.

---

## 3. STANDING WORK — carried, and one item is now overdue

| | |
|---|---|
| **the phone pass — NOW THE TOP NON-CARD RISK** | last week added **six sheets a player must TAP**: the graveyard pick, retrieve, the counter target, the boost-banish counter, the arsenal put and the Waxing Specter enters-with. **The arsenal put has never been offered in a real game before this week.** A tap that does nothing is this project's worst failure mode and only a phone finds it |
| **tuning the table seat** | the brown button's opponent wins **29 of 45** (v3.51, measured). Levers are `sparring.js`'s `DEFAULTS` (`takeUpTo`, `maxPitch`). A play session, not a drill |
| **`sparring.act` cannot pilot a low-aggression hero** | **Re-measured 2026-08-29 from `tools/.cache/games.json`, and the carried claim was wrong.** It said Iyslander accounts for "all remaining stalls"; she is in **7 of 10**, and the stalls cluster across three heroes — **iyslander 7, blaze 5, enigma 4** (a stall names two heroes, so these overlap). Iyslander still wins **0 of 210**. The policy ranks ATTACKS and these decks are short of them, so this is a policy gap rather than one hero's. See `PLAYNOTES.md`, and re-derive with: `node -e 'const g=require("./tools/.cache/games.json");…'` |
| **nothing attacks an ALLY** | so Oysten's death trigger still has no driver. A deliberate refusal to guess (CR 1.4.5), not an oversight |
| **Cosmo swings for 0 power** | judge routes on `types.isWeaponType`, `build.js` on `parser.isWeapon`. Tested as a fix at v3.49 and it did **not** help the stalls, so it is recorded rather than shipped on a guess. It also gates the payoff for Astral Etchings' and Uphold Tradition's +1{p} counters, which land correctly and have nothing to spend themselves on until Cosmo works |

---

## 4. KNOWN REFUSALS — do not "fix" these without a ruling

Each is deliberate, and each would be a card doing something the text does
not say if read:

| | |
|---|---|
| **Ice Eternal** | the pool's only X-cost card. Reading `create X tokens` as one token is quietly weaker than printed |
| **Beckoning Haunt** | *"target aura **with cost X**"* — the subject cannot be consumed whole, so the clause stays unclaimed rather than dropping a printed limit |
| **Mounting Anger · Rising Resentment** | a **dynamic** filter (*"cost less than the number of Draconic chain links"*) that no printed field expresses |
| **Waning Vengeance** | a gated leave-trigger whose schedule cannot fire — `fx.onLeave`'s only caller is `tickSuspense`, and the card prints no suspense |
| **Crankshaft-style unknown triggers** | the when-handler's vocabulary is CLOSED on purpose; an unknown trigger refuses the whole clause |
| **`piercing`, `overpower`** | not modelled at all. Drill Shot and Spectral Rider refuse for want of the keyword, not the condition — these need a ruling before they need code |

---

## THE BAR — unchanged, and last week is why

1. **Never invent card effects.** Teach the parser to read the text.
2. **A reader that cannot read the whole subject REFUSES.** Weaker than
   printed and visible beats stronger than printed and silent.
3. **Sabotage every new drill — and sabotage the guard too.** Last week ran
   **48 sabotages across six new drill files**; **five found a WEAK DRILL**
   rather than a weak engine, and two more were errors in the sabotage
   HARNESS that would have read as "the drill is fine". The engine was
   right every time. **Check that a sabotage APPLIED before believing the
   drill is strong** — one of last week's changed no behaviour at all.
4. **When you close a recorded gap, delete the record** — and when a
   recorded gap turns out to be EMPTY, say so.

And the two newest, both of which cost something last week:

> **A `noop` is a CLAIM that something reads the clause; `null` is the
> claim that nothing does.** Filing a `noop` that names a reader which does
> not run is how a card goes from `part` to `full` while staying inert.

> **A probe must ask the function that holds the reader.** Two refusal
> probes asked `classifyClause` about a whole-card reader living in
> `fxParse`, and passed green against a sabotaged engine — twice.
