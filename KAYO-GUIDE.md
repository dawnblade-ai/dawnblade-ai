# The Kayo guide

Everything one session of table-testing (v2.51, table 8HX8, Kayo mirror)
turned up, plus the pool's ground truth pulled straight from
`tools/audit.json` so none of it is from memory. Written to make the next
pass — nailing down every card's text, tuning Claude's call, or just testing
faster — start from what's already known instead of re-discovering it.

**This is a field guide, not the procedure.** For *how* to do card work, read
`JOB-AID-TESTERS.md` (the BUILDER/JUDGE loop) and `PROMPT-KAYO-MIRROR.md`
(why Kayo, and the milestone plan). This file is the *what* — Kayo's actual
cards, numbers, and the traps a tester will hit — kept separate so the
procedure docs don't bloat every time someone learns something.

**Numbers here will drift.** Re-derive rather than trust a stale count:

```bash
export PATH="$HOME/node/bin:$PATH"   # node isn't on PATH by default on this machine
node -e 'const A=require("./tools/audit.json"); console.log(A.heroes.kayo)'
node -e 'const A=require("./tools/audit.json"); Object.keys(A.cards).filter(k=>A.cards[k].tt&&/kayo/i.test(JSON.stringify(A.usage[k]||[]))).forEach(k=>console.log(k, A.cards[k].tier))'
```

---

## 1. Ground truth

| | |
|---|---|
| Class | Brute |
| Life | **20** |
| Intellect | **4** |
| Weapon zones | 1 (hero ability line 1) |
| Deck (default loadout) | **47 cards + 8 gear**, trimmed to 40 for Blitz |
| Unique pitch cards | 18 |
| Unique gear | 8 (4 armor slots + weapon + 3 spares) |
| Coverage (2026-08-04, v2.51) | **14 / 18 pitch cards `full`**, hero ability **0 / 3 clauses** |

Kayo was picked for the mirror precisely because it's the **best-covered,
simplest-built** hero in the pool: no runechants, no frostbite, no soul, no
charge, no combo, no arsenal instants. Every hero-specific flag in the
trainer's `built` object that other heroes need is one Kayo doesn't touch.

---

## 2. The card catalog — verified against `tools/audit.json`

Cost and defense are **constant across a card's pitch printings**; only power
moves (down as pitch goes up — the standard FaB trade). Don't trust the small
hand-thumbnail's corner pips over this table — see §5 for why.

| card | pitch | cost | pow | def | tier | text |
|---|---|---|---|---|---|---|
| Bare Fangs | 1 | 2 | 6 | — | full | When this attacks, draw a card then discard a random card. If a card with 6+{p} is discarded this way, Bare Fangs gains +2{p}. |
| Bare Fangs | 2 | 2 | 5 | — | full | *(same text)* |
| Buckwild | 1 | 3 | 7 | 2 | full | If there is a card with 6+{p} in your pitch zone, this gets **go again**. |
| Buckwild | 3 | 3 | 5 | 2 | full | *(same text)* |
| Clash of Agility | 1 | 2 | 6 | 3 | full | When this defends, **clash** with the attacking hero. The winner creates an Agility token. |
| Clash of Might | 1 | 2 | 6 | 3 | full | When this defends, **clash** with the attacking hero. The winner creates a Might token. |
| Clash of Might | 2 | 2 | 5 | 3 | full | *(same text)* |
| High Pitched Howl | 1 | 2 | 6 | 3 | full | When this attacks, if there is a card with 6+{p} in your pitch zone, create a Vigor token. |
| Pulping | 1 | 2 | 6 | — | **part** | When this attacks, draw then discard a random card. If 6+{p} discarded, gets **dominate**. If defended by <2 non-equipment cards, gets **go again**. *(dominate clause unread)* |
| Rough Up | 1 | 2 | 6 | 3 | full | When this attacks, if 6+{p} in your pitch zone, this gets +1{p}. |
| Savage Feast | 1 | 1 | 6 | 3 | full | Additional cost: discard a random card. When you attack with this, if 6+{p} was discarded as that cost, draw a card. |
| Strongest Survive | 1 | 3 | 7 | 3 | full | When this hits a hero, they discard a card unless they reveal a card from hand with {p} greater than the damage dealt. |
| Strongest Survive | 2 | 3 | 6 | 3 | full | *(same text)* |
| Strongest Survive | 3 | 3 | 5 | 3 | full | *(same text)* |
| Test of Might | 1 | — | — | 4 | full | **Block.** When this defends, clash with the attacking hero. Winner creates a Might token. |
| Wild Ride | 1 | 2 | 6 | — | full | When this attacks, draw then discard a random card. If 6+{p} discarded, gets **go again**. |
| Wild Ride | 2 | 2 | 5 | — | full | *(same text)* |
| Agile Windup | 3 | 3 | 5 | 2 | **none** | Instant - Discard this: Create an Agility token. |
| Bear Hug | 3 | 2 | 5 | 3 | full | Play this only if you've pitched a card with 6+{p} this turn. |
| Rally the Coast Guard | 3 | 3 | 5 | 2 | **part** | Once per Turn Instant - Discard a card: +3{d}, only while defending. *(rider unread — the cost's own gate is read)* |
| Reincarnate | 3 | 3 | 5 | 3 | full | When this is discarded at random, put it on the bottom of its owner's deck. |
| Run Roughshod | 3 | 1 | 5 | 3 | full | Play this only if you've discarded a card with 6+{p} this turn. |
| Smash Instinct | 3 | 3 | 5 | 3 | full | When this attacks, **intimidate**. |
| Unexpected Backhand | 3 | 3 | 5 | 3 | full | When you win a clash revealing this, deal 1 damage to the other hero. |

Gear (all full except the one below):

| gear | slot | def | tier | text |
|---|---|---|---|---|
| Beaten Trackers | Legs | 1 | **part** | Whenever you discard a random card with 6+{p}, you may destroy this. If you do, gain 1 action point. Battleworn. *(the "if you do" rider is unread)* |
| Blade Beckoner Gauntlets | Arms | 1 | full | +1{d} while defending a weapon attack. Guardwell. |
| Knucklehead | Head | 2 | full | Kayo Specialization — Action, destroy this: roll a d6, base intellect = roll until end of turn. Temper. |
| Mandible Claw | Weapon (1H, Claw) | — (pow 3) | full | Once per Turn Action - {r}{r}: Attack. If you've discarded a card with 6+{p} this turn, this weapon's attacks get go again. |
| Nullrune Gloves / Hood / Robe | Arms/Head/Chest | 0 | full | Arcane Barrier 1 (×3, generic, shared with 6 other heroes) |
| Predatory Plating | Chest | 2 | full | Instant - Destroy this: Gain {r}. Only if you control a card with 6+{p}. Guardwell. |

Tokens Kayo actually makes:

| token | text |
|---|---|
| Might | At the start of your turn, destroy this, then your next attack this turn gets +1{p}. |
| Agility | At the start of your turn, destroy this, then your next attack this turn gets go again. |
| Vigor | At the start of your turn, destroy this, then gain {r}. |

All three are `fx: full` already — the token *math* has never been the gap,
only the **hero ability** that makes Might in the first place.

---

## 3. The hero ability — BUILT in v2.55–v2.56 (was 0 of 3)

> **STATUS (2026-08-08): all three clauses are live.** Clause 1 was already
> covered by the generic equipment slot rules. Clause 2 is
> `parser.zonePow`/`pow6`, fed by the `atkPowOffChain` passive that
> `build.js` reads off the printed text. Clause 3 is `afterDiscard` in
> `effects.js`, latched per action phase. `test/kayo.test.js` pins all of
> it and four sabotages were proven to bite.
>
> **The measured effect of clause 2: 22 of 47 deck cards satisfied a
> "6 or more {p}" check before, 45 of 47 after.** The two left out are the
> Test of Might copies, which are `Block` cards and not attack actions.
> The section below is the original analysis and is still the right way to
> think about the clause — read it before touching any of it.

### The original analysis

```
You have 1 weapon zone.
Attack action cards you own get +1{p} while they are in any zone
other than the combat chain.
The first time you discard a card with 6 or more {p} during each of
your action phases, create a Might token.
```

Clause 1 is bookkeeping (equipment slot rules already model weapon zones
generically — check `build.js` before assuming this needs new code at all).
Clause 3 is a straightforward attack-phase-once trigger, same shape as
existing "first time you X this turn" clauses elsewhere in the pool.

**Clause 2 is the one to slow down on.** The +1{p} applies in hand, arsenal,
pitch, graveyard, deck — everywhere **except** the combat chain, which is the
one place the power actually strikes for damage. So it's a **display and
threshold** rule, not a damage rule:

- A 5-power card sitting in Kayo's hand **displays and counts as 6-power**
  for every "6 or more {p}" check in the deck — which is most of it (see §4).
- The moment that same card is declared as an attack and moves to the chain,
  it reverts to its printed value for the strike.

Get this backwards in either direction and it changes what half the deck
does. Read PROMPT-KAYO-MIRROR.md's take on it before writing the rule — it's
already worked through the implication list once.

---

## 4. The mechanical spine: "6 or more {p}"

Once you see it, most of the deck is the **same three shapes** wearing
different words. Worth internalizing before touching any of the four open
cards, because the fix for one is close to the fix for all of them:

| shape | cards |
|---|---|
| **"if 6+{p} in your pitch zone"** — a static check of what's already pitched | Buckwild (go again), High Pitched Howl (token), Rough Up (+1{p}) |
| **"discard random, then check if it was 6+{p}"** — draw-then-discard engines | Bare Fangs (+2{p}), Wild Ride (go again), Savage Feast (draw), Pulping (dominate) |
| **"play only if you've discarded/pitched 6+{p} this turn"** — a play-gate | Run Roughshod, Bear Hug |

Plus the hero ability (clause 3, Might on the *first* 6+{p} discard per
action phase) and Mandible Claw / Beaten Trackers, which key off the same
discard event from the equipment side.

`parser.js` already has both conditions as first-class: `cond:"pitch6"` (the
static pitch-zone check) and `cond:"discard6"` (the discard-triggered one) —
grep `engine/parser.js` for either before assuming a new pattern is needed.

---

## 5. Pip literacy — read this before trusting a screenshot

**I got this backwards once this session and filed a false bug because of
it.** On the small hand-rail thumbnail, the two top corners are:

```
top-left  = PITCH value, colored to match the card's pitch (red/yellow/blue)
top-right = COST, in a neutral/grey circle
bottom-left  = POWER
bottom-right = DEFENSE
```

Buckwild red printing reads `1 / 3` on the corners — that's **pitch 1, cost
3**, not "costs 1." The full card-inspect modal (tap the card, or `ℹ inspect`
mode) spells it out in text underneath ("Buckwild · pitch 1 (red)") — **when
in doubt, open that, don't trust the corner pips at a glance.** The game's
own cost-prompt ("Buckwild costs 3 and you hold 0 — pitch, or cancel.") was
right the whole time; I was reading the corners backwards.

---

## 6. Claude's call — what it actually does, mode by mode

`engine/advisor.js`, 172 lines, pure function `advise(g, ctx) -> {line, why}`.
**Solo trainer only** — it reads `g.mode` (`"pay"`, `"stack"`, `"arsenal"`,
`"block"`, `"act"`), which is the trainer's vocabulary. The table speaks
`phase`/`step`/`priority` out of `priority.js` instead, and per
`CLAUDE.md`'s table section, the advisor is deliberately **not** shown there
— it would coach card text that doesn't resolve at the table (see §7).

| `g.mode` | what it coaches |
|---|---|
| `pay` | which cards to pitch — `advBestPitch` picks the tightest cover (least waste, then least "value" given up), scored by `advValue` |
| `stack` | react-or-pass during the opponent's attack, off raw self-buff value |
| `arsenal` | arrows go to arsenal unconditionally ("arrows only fire from there"); otherwise banks the highest-value card |
| `block` | **race math** — compares your turns-to-kill vs. theirs (`myTTK`/`dTTK`), then picks the cheapest blockers that cover the target overage, gear before hand-cards once you're below 14 life |
| `act` *(default)* | scores every legal play (hand, arsenal, weapon, hero power, ally swing) with `advValue`, and specifically rewards go-again lines by adding the value of whatever swings next |

**A known gap worth checking before trusting its Kayo coaching:** `advCardOut`
— the function that estimates an attack's damage for scoring purposes — only
special-cases two conditional bonuses, `cond:"atk"` and `cond:"non"`
("another attack/non-attack this turn"). It does **not** add the `pitch6` or
`discard6` bonus into its damage estimate, even when the condition is
currently true. That's exactly Kayo's whole deck (§4). Concretely: if you've
already got a 6+{p} card in your pitch zone, Buckwild's true value is "always
goes again" — but `advValue` will likely still score it as a plain 7-power
swing, because the go-again there is conditional (`fx.conds`) rather than the
unconditional `fx.ga` the value formula checks. **Verify this in play before
assuming the advisor's Kayo line-picks account for pitch-zone state** — if
confirmed, it's a real, scoped fix: teach `advCardOut`/`advValue` to read
`fx.conds` for `pitch6`/`discard6` the same way it already reads `atk`/`non`.

---

## 7. Where card text resolves — the split that will save you time

**Card text only resolves in solo play (`Battle`, vs. the dummy).** The table
(`judge.js`, two real seats) moves cards, charges printed costs, and runs the
real CR turn structure — but `runOps`/`execute`/`resolveStack` are still
closures inside the trainer, so **none of a card's actual rules text fires at
the table.** I spent a chunk of this session confirming table mechanics
(turn structure, combat chain, damage math) that were never in doubt, while
the thing Phase 3 actually needs — does Buckwild's go-again trigger
correctly, does Savage Feast's discard-then-draw work — **cannot be observed
at the table at all right now.**

So:

- **Card-functionality testing → solo play against the dummy.** This is
  where `JOB-AID-TESTERS.md`'s JUDGE checklist actually applies.
- **Table testing → engine/connectivity only.** Turn structure, priority,
  the chain, payment math, room-code handshake, seat symmetry. Useful, but
  it will never catch a card being read wrong, by design (`CLAUDE.md`: "a
  transport failure and a card being read wrong must never be confusable").

If you're handed "test the Kayo mirror," **ask which of these two jobs is
meant** before spending a session on the wrong board.

---

## 8. Table UI survival notes (from this session, v2.51)

For whoever picks the table testing back up:

- **Navigation:** top bar is `Leave · ▲ <opponent hero> · Chain · You ▼`.
  The opponent-board and your-board panels each swipe right for their
  graveyard/banish. `Chain` shows the live chain + your hand + Pass/End Turn.
  **`JUDGE!!` and the log live inside the opponent-hero panel**, reached via
  `▲ <name>` then scrolling past their gear to "log" / "JUDGE!!" / "play →".
  Non-obvious the first time; both seats have their own, independently.
- **End Turn takes two passes** (v2.46 rule, working correctly): your press
  signals intent, the other seat's Pass or End Turn actually closes the
  phase. "waiting on Kayo" on your screen while it's still nominally "your"
  turn is correct, not stuck.
- **Defend step gives priority to the ATTACKER**, not the defender (CR
  7.3.3) — confirmed working. The defending seat sees "declare your blockers
  — Kayo still holds priority" instead of a dead Pass button. That's the UI
  correctly naming a real rule, not a bug.
- **Damage math confirmed correct**: a 5-power attack blocked by 2 defense
  landed exactly 3 (life 20→17), logged as `"<attack> resolves for 3. Wall of
  2 — <blocker> 2 — stops 2."`
- **Suspected real bug, reproduced 4×, filed via JUDGE!!:** during a
  "Paying `<card>` — tap cards below to pitch" flow, the two-tap commit
  (peek, then tap again) reliably works for hand cards in **slot 1–2** and
  reliably fails — silently un-peeks, nothing pitched — for **slot 3–4**,
  specifically when that card is being used as *pitch fuel* for a different
  card's cost (playing the same card as the *primary* action from the same
  slot worked fine). Best guess: the centered peek/verb-label overlay sits
  on top of the hand row for cards under its footprint during payment mode —
  the same pointer-events class of bug already fixed once elsewhere
  (`CLAUDE.md` v2.36/v2.37). Not fully ruled out as a browser-automation
  timing artifact — **needs a human phone test**, pitching specifically from
  the 3rd/4th card mid-payment, before treating it as confirmed.
- **The "Find an opponent" screen's blurb is stale.** It still says "Table
  play runs the drill decks — blank cards..." — that was true when
  `PROMPT-KAYO-MIRROR.md` was written and is no longer true as of v2.49; the
  table screen you actually land on says the correct thing ("two real hero
  decks through engine/judge.js... Card text does not resolve yet"). Minor,
  but confusing to a fresh reader — worth a one-line fix.

---

## 9. Coverage checklist

Tick a row only after watching it **actually resolve in solo play** and
checking the number against this file's table — not from memory, not from a
table-play observation (§7). Pattern borrowed from
`JOB-AID-TESTERS.md §5.1` / `PROMPT-KAYO-MIRROR.md`'s coverage-checklist idea.

**Hero ability**
- [ ] Clause 1 — 1 weapon zone
- [ ] Clause 2 — out-of-chain +1{p} display/threshold rule
- [ ] Clause 3 — first 6+{p} discard per action phase → Might

**Cards already `full` — spot-check, not re-derive**
- [ ] Bare Fangs (p1) · [ ] Bare Fangs (p2)
- [ ] Buckwild (p1) · [ ] Buckwild (p3)
- [ ] Clash of Agility (p1)
- [ ] Clash of Might (p1) · [ ] Clash of Might (p2)
- [ ] High Pitched Howl (p1)
- [ ] Rough Up (p1)
- [ ] Savage Feast (p1)
- [ ] Strongest Survive (p1/p2/p3)
- [ ] Test of Might (p1)
- [ ] Wild Ride (p1) · [ ] Wild Ride (p2)
- [ ] Bear Hug (p3)
- [ ] Reincarnate (p3)
- [ ] Run Roughshod (p3)
- [ ] Smash Instinct (p3) — intimidate
- [ ] Unexpected Backhand (p3) — clash payoff
- [ ] Mandible Claw, Knucklehead, Predatory Plating, Blade Beckoner Gauntlets, Nullrune ×3

**The four still open — this is Phase 3's actual Kayo work**
- [ ] Pulping (p1) — dominate rider
- [ ] Rally the Coast Guard (p3) — the `+3{d}` rider (cost-gate already reads)
- [ ] Beaten Trackers — the "if you do, gain 1 action point" rider
- [ ] Agile Windup (p3) — tier `none`; also listed under the (possibly
      stale, dated 2026-07-25) `token-library` ruling in `rulings.json` as
      "unmodelled" — check whether that mechanic actually landed since (High
      Pitched Howl, listed in the same ruling, is now `full`) before assuming
      Agile Windup needs more than the standard discard-instant treatment.

**Tokens**
- [ ] Might · [ ] Agility · [ ] Vigor

---

## 10. How this file was built

Ground truth pulled live from `tools/audit.json` (`A.heroes.kayo`, and
`A.cards["<name>|<pitch>"]` for each of the 18 uniques + 8 gear), the deck
list parsed straight out of `index.html`'s `kayo:` template string, and
`rulings.json` grepped for anything Kayo-relevant (nothing card-specific
found — clause 2's read is still an open call). Everything in §5–§8 is from
directly playing a Kayo-mirror table match this session, table 8HX8, v2.51.
