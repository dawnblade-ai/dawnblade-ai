# LOOKAHEAD — phase 1 spike (research/lookahead, 2026-11-02)

Branch `research/lookahead`, base `218a5fe` (v5.73). **Gated OFF**: `sparring.LA.seats` is empty
unless `SPXLA=<hero,hero…>` is set, and `test/lookahead.test.js` holds `act === actBase` move for move
with the gate off. Nothing here is on `main`.

## What it is

At the seat's **own action decision** (it holds priority at action speed, nothing on the stack, no
chain link open, no payment, no prompt, not the arsenal step) the rule policy proposes **A0** as it
always has. The search then lists every distinct legal way to start from here (each card in hand and
arsenal — attacks aimed by the policy's own `targetFor` — each gear/weapon activation, each board
entry, the hero ability, and ending the turn; two copies of one card in one zone count once), plays
each one out through `judge.reduce` with **the rule policy driving both seats** for the rest of the
horizon, scores the end state, and keeps the best. A0 stands unless an alternative beats it by more
than `margin` (0.5).

It is one step of policy improvement over the rule policy (a "rollout"), not a game tree: the rules
remain the player; the search overrules them only when it can show a better outcome. Every move the
rollout makes is `judge.legal`'s to refuse, and the chosen action is re-checked with `legal` on the
real state before it is returned (fallback: A0).

### Why this decision

The action decision is where the rule policy's choices are coarsest (one ranked list: keeps-AP,
biggest attack, weapon, hero ability, end turn) and where the hand-written hunts H25–H31 kept hitting
noise. It is also the narrowest decision whose consequence the engine can show within a turn pair:
order (weapon or go-again first), what to hold, and when to stop. Blocks, pitch and reactions stay on
the rules (they are inside the rollout, so their quality bounds the search's).

### Evaluation (from the searching seat's side, at the horizon)

```
v = (opponent life lost) − (own life lost) + μ · (own cards held − opponent cards held)
    held = hand + arsenal;  μ = 1.5;  a win +1000, a loss −1000, a draw 0
```

Horizon `opp` (default): through the opponent's next turn, i.e. until the turn counter reaches
`root.turn + 2`. Defence of the eval: life is the only win condition and no-deck-out (CR 4.5.3) makes
the deck irrelevant at this range. Card counts matter because FaB refills to intellect at your OWN end
phase: at the horizon the opponent has just refilled (constant), so the card term measures what the
searching seat has left for its next turn after blocking, plus the arsenal. Through the opponent's
turn, the cost of emptying the hand (nothing left to block with) shows up as life lost, which is
what the rule policy's `maxPitch` / `takeUpTo` guess at. `μ = 1.5` is a card worth a bit less than a
typical 3-defence block, since a held card's value is partly its pitch.

### No hidden information

The search never runs on the real state. `laMask(g, seat, k)` builds the root from what the seat may
know: the opponent's hand, face-down arsenal and deck are pooled, sorted by name/pitch/uid (never by
where they sat) and dealt back at random; the seat's own deck is reshuffled the same way; `game.rng`
is replaced. The stream is a separate `RNG.make` seeded from public facts only (turn, seat, feed
length, zone sizes, the seat's own hand). So any swap of hidden cards leaves the choice unchanged.

`test/lookahead.test.js`:
1. real self-play positions where the search **overruled** the rules (Briar, Dash, Bravo games); each
   is scrambled (opponent hand card ↔ deck card of another name, hidden arsenal ↔ deck card, both
   decks reversed, fresh rng) and must return the same action and reason;
2. a scrambled root masks to the identical position, and the mask is not the identity;
3. gate off: `act` equals `actBase` move for move.
Sabotaged twice (mask returns the real state; pool not sorted): drills 1 and 2 fail both times.

The opponent model inside the rollout is the rule policy holding a random deal of its unseen cards.

### Determinism and card text

No card text (candidates go to `judge.legal`; the score reads life and zone sizes). Total order:
score, then A0, then candidate order (zone order, uid). A **step budget**, not a clock (peers agree):
`stepCap` 400 per rollout, `budget` 2400 per decision; a rollout that runs out leaves A0 standing.
`game.rng` is never read or advanced on the real state.

### How it explains itself (`CALL_WHY`)

If the search agrees with the rules, the rules' own reason is shown unchanged. If it overrules, the
key is the score term that moved most between its line and A0's:

| key | the call says |
|---|---|
| `laHit` | Played out, every other way to start this turn lands less once they block. This one hits hardest. |
| `laSafe` | Played out through their next turn, this line leaves you taking the least back. |
| `laKeep` | Played out, this line does as much and leaves you more cards for next turn. |
| `laHold` | Stop here. Played out, every card you could still play costs you more than it gets you. |

The four are pinned as unreached in `test/explain.test.js` (gate off) and reached by
`test/lookahead.test.js`.

## Feasibility (node, this container)

`node experiments/LA-probe.js 30` (30 self-play games, 13,299 steps, base policy):

- **State cloning is free.** State is persistent (every `reduce` returns a new shallow-copied object),
  so a rollout branches from a root by reference. The masked root also drops `feed`/`log` so the
  feed copy in `say` does not grow inside a rollout.
- `judge.reduce` **111 µs/step** (real games, feed included) · `sparring.act` **42 µs/call** (called
  for both seats per step) · `judge.legal` **20 µs/call** · ~21 steps per player-turn (max 69).
- Action decisions: mean 2.7 distinct legal candidates; **52% have 2+** (the only ones searched);
  of those, the typical decision has 4–7 (histogram 2:228 3:157 4:198 5:200 6:202 7:116 8:51 9+:25).
- Inside the search (measured over 69,541 searched decisions, 4 processes on 4 cores):
  **0.14 ms per engine step** including both seats' policy calls — **~7,000 nodes/s** per core.

## A/B — own seat, paired

`experiments/LA-abs.sh <out> <from> <to> SPXLA_H=…` then `node experiments/LA-sum.js <out…>`.
Per seed index the hero meets all 14 others in both seat orders (tourney.js's own seeds and chairs),
search OFF then ON for the hero's seat only. Wins of 28 per seed; diff and t are paired over seeds.

**Horizon `opp` (default), 12 seeds = two independent sets (0–5 and 6–11), 336 games per hero per arm:**

| hero | off | on | diff | t | seeds up/down | overruled |
|---|---|---|---|---|---|---|
| arakni | 9.67 | 19.08 | **+9.42** | 16.1 | 12/0 | 43% |
| dorinthea | 12.17 | 20.42 | **+8.25** | 9.2 | 12/0 | 41% |
| viserai | 15.58 | 19.50 | +3.92 | 5.3 | 11/0 | 42% |
| dash | 18.42 | 21.58 | +3.17 | 4.1 | 10/1 | 37% |
| gravy | 6.83 | 9.83 | +3.00 | 4.0 | 11/1 | 32% |
| bravo | 12.25 | 14.75 | +2.50 | 2.6 | 9/3 | 36% |
| boltyn | 7.75 | 10.00 | +2.25 | 2.7 | 8/2 | 27% |
| lyath | 8.00 | 10.25 | +2.25 | 3.1 | 10/2 | 32% |
| enigma | 14.67 | 16.75 | +2.08 | 2.9 | 8/1 | 26% |
| kayo | 21.92 | 23.58 | +1.67 | 2.1 | 8/2 | 39% |
| fai | 17.50 | 19.08 | +1.58 | 2.3 | 8/2 | 31% |
| iyslander | 13.42 | 14.83 | +1.42 | 2.1 | 8/3 | 24% |
| briar | 24.25 | 24.83 | +0.58 | 1.1 | 8/3 | 18% |
| blaze | 9.58 | 9.92 | +0.33 | 0.6 | 6/5 | 16% |
| azalea | 17.42 | 17.58 | +0.17 | 0.3 | 6/4 | 26% |

Pooled **+2.84 wins of 28 per hero-seed** (180 hero-seeds). Set 0–5 alone: +2.91; set 6–11 alone:
+2.77, so the second set reproduces the first. No hero is negative; 12 of 15 have t > 2. Refusals
0, violations 0, stalls 0 (both arms), 21 draws.
Search cost: 26.6 ms and 190 engine steps per searched decision (max 863 steps).

**Horizon `own` (stop at the end of the seat's own turn), seeds 0–5:** pooled **+3.11** (Arakni
+11.8, Dorinthea +10.0, Boltyn +3.5 t 7.0, Fai +3.5 t 6.2 … Azalea −0.33 t −0.3), at **12.0 ms
and 82 steps per decision (max 493)** — less than half the cost for at least the same gain on one
set. It had **1 stall**: `iyslander-enigma-3`, Iyslander's deck and hand empty at 1 life, Enigma
holding a full hand (deck not empty) that the RULE policy never plays — the R8 class
(`blaze-enigma-46`, ruling pending). Not a search fault, but the search's different trajectory
reached it.

**Why Arakni gains most** (`node experiments/LA-why.js arakni`): most overrules swing **Mark of the
Huntsman** (a go-again dagger that marks on hit) before the card the rules wanted (Reaper's Call,
Up Sticks and Run, Infect, Pick Up the Point…). The rule policy ranks the weapon late; leading
with it keeps the action point and marks for the stealth cards. That is a real line, found by the
engine rather than by reading the card. Dorinthea, Viserai and Dash overrule as often (37–43%).

## Ladder, every seat on

`SPXLA=<all 15> node tools/tourney.js <hero> '' 3` per hero (4 at a time), summed by
`node experiments/LA-ladder.js` — horizon `opp`, 630 games:

**REFUSALS 0 · VIOLATIONS 0 · stalls 0 · draws 0** · MALFORMED 0 · SECOND-PERSON 0 · NO-ZONE 0

| | briar | kayo | dorinthea | dash | viserai | enigma | arakni | fai | azalea | bravo | iyslander | lyath | boltyn | blaze | gravy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| all on | 72 | 64 | 56 | 55 | 50 | 49 | 46 | 45 | 42 | 33 | 26 | 25 | 25 | 22 | 20 |
| v5.73 | 78 | 66 | 31 | 53 | 42 | 41 | 31 | 51 | 49 | 44 | 42 | 28 | 21 | 31 | 20 |

stdev 15.7 (v5.73: 15.5), spread 52 (58). **With every seat searching the field is NOT more even**:
everyone gets stronger, the order reshuffles (Dorinthea +25, Arakni +15; Iyslander −16, Blaze −9,
Bravo −11), and Gravy/Boltyn stay at the bottom. The search is a strength lift against the rule
policy, not a balancer. Gate off, the ladder is byte-identical to v5.73 (`npm run play '' '' 3`).

## Phone budget

Assume a phone is 3–5× slower than this container.

| horizon | node mean | node worst (steps × 0.14 ms) | phone mean | phone worst |
|---|---|---|---|---|
| `opp` | 26.6 ms | ~120 ms (863 steps) | 80–135 ms | 360–600 ms |
| `own` | 12.0 ms | ~70 ms (493 steps) | 36–60 ms | 210–350 ms |

Only decisions with 2+ candidates are searched (about half the action decisions; ~5 per AI turn),
and the table's AI loop (`engine/local.js`) runs synchronously, so a whole AI turn would add roughly
5 × the mean: ~0.2–0.3 s with `own`, ~0.4–0.7 s with `opp`. **`own` meets "well under 100 ms" on the
mean, not on the worst case; `opp` does not.** The worst case is bounded by the step budget, which
is currently loose (2400); a budget of ~300 steps caps a phone at ~130–210 ms, untested for strength.

Also: the advisor box calls `explain` for BOTH seats on every render (index.html, "<Hero>'s
call"), so a gated search would run per render — phase 2 must memoize `explain` on the state object.

## Recommendation for phase 2

**GO.** One rollout step through the real engine is the first AI change in this project with a
large, reproducible gain: +2.84 wins of 28 per hero-seed over two independent 6-seed sets, every hero
non-negative, 12 of 15 at t > 2, 0 refusals / 0 violations / 0 stalls on the opp-horizon ladder,
and it found a real line (Huntsman first) that the hand-written hunts never reached. Phase 2, in order:

1. **Fit the phone.** Make `own` the default (cheaper, at least as strong on its set — confirm on
   6–11), then sweep the step budget (150/300/600) for gain vs time, and measure on the real page
   with `tools/page.js` under CPU throttling (CDP `Emulation.setCPUThrottlingRate` 4). Memoize
   `explain`.
2. **Decide what the search is for (user question).** Every seat on = a stronger partner, same
   spread. Selective seats (weak heroes only) or a difficulty dial = a more even field. Both are one
   array; it is a product choice.
3. **Widen the search only where measured:** the arsenal choice and blocks are the next decisions;
   K > 1 determinizations, `μ` and `margin` are untuned (one setting tried).
4. **The coach line can carry the number** ("lands 3 more than the next best start"); today it
   names the term that moved most.
5. **R8 matters more now:** a search trajectory reached the held-full-hand stall class once.

Rules questions: none arose. Do not ship to main until 1 is done and the gain is re-measured at the
shipped budget.

## Files

- `engine/sparring.js` — `act` is now the gate over `actBase` (the old `act`, unchanged); the
  LOOKAHEAD section (`LA`, `laMask`, `laCands`, `laEval`, `laRollout`, `laSearch`, `laWhy`); four
  reasons. `rng.js` is a new dependency of the module (it already loads first on the page).
- `test/lookahead.test.js`, `test/explain.test.js` (pin).
- `experiments/LA-probe.js` (feasibility), `LA-ab.js` + `LA-abs.sh` + `LA-sum.js` (own-seat A/B,
  every hero, 4 at a time), `LA-why.js` (what the search overrules, by card), `LA-ladder.js` (sums the sliced all-on ladder).
- `experiments/LA-results/` — the raw runs: `opp15` (seeds 0–5), `opp612` (6–11), `own06`, `ladder/`.

# PHASE 2 (ship/lookahead, rebased on v5.75)

## (a) the search on for the table's AI hero — settings chosen inside the phone bound

Sweep, own-seat paired A/B, seeds 0–5 (`experiments/LA-results/p2/`, one OFF arm `off/` for seeds
0–11, summed by `node experiments/LA-pair.js <off> <on>`):

| setting | pooled /28 | t | over budget | steps p50 / p95 / max |
|---|---|---|---|---|
| own/2400 | +3.11 | 7.4 | 0% | 70 / 190 / 490 |
| own/600 | +3.11 | 7.4 | 0% | (identical: no decision reaches 600) |
| **own/300** | **+3.09** | 7.4 | 0.6% | 70 / 190 / 300 |
| own/150 | +2.92 | 7.9 | 12.2% | 70 / 150 / 150 |
| opp/600 | +2.86 | 7.3 | 0.3% | 170 / 380 / 600 |
| opp/300 | +2.47 | 6.9 | 14.3% | 170 / 300 / 300 |

Page, 4x CPU throttling, 400 positions where node's search ran (`experiments/LA-phone.js`):

| setting | p50 | p95 | worst | ms/step |
|---|---|---|---|---|
| own/2400 | 36.5 | 104.8 | 208.9 | 0.47 |
| **own/300** | **33.7** | **95.8** | **152.8** | 0.43 |
| own/150 | 36.2 | 89.9 | 182.7 | 0.50 |
| opp/600 | 94.8 | 221.5 | 319.4 | 0.49 |
| opp/300 | 93.8 | 200.3 | 331.7 | 0.52 |

Pick **own/300**: the most gain the bound allows (own/2400's extra +0.02 is noise, and its worst case
is unbounded by construction), and the cap makes the worst case ~300 × 0.5 ms plus GC. `opp` fails
p95 at any budget that keeps its gain. Held out, seeds 6–11: **+3.03, t 8.3** (`own-300-ho/`); all 12
seeds +3.06 (t 11.1), no hero negative. One synchronous call fits, so nothing yields.
Ladder every seat on (`ladder-own300/`): 630 games, 0/0/0, 0 draws, spread 52 (v5.75 58).
Search off: `npm run play '' '' 3` byte-identical to origin/main (v5.75).

# PHASE (c) (research/lookahead-c, base v5.82 f6d59a6)

Shipped on the branch as ONE piece (commit 63c76cd + CR-INDEX regen 4603d3f): **blocks**. The arsenal
search and the action-search retune did not pay and are recorded here only.

Method: own-seat paired A/B against **v5.77's search** (`experiments/LA-abc.js <hero> <from> <to>
base|trial`, `LA-abcs.sh <snap> <out> …` 4 at a time from a frozen engine snapshot; `base` forces
blocks off and v5.77 settings, `trial` reads the `SPXLA_*` env). One base arm for seeds 0–11
(`LA-results/pc/base/`), summed with `LA-pair.js <base> <trial>`. Wins of 28 per hero-seed.

## 1. Blocks — PAYS, shipped

At each declaration (`canDeclareDefenders`, an attack on the hero) the candidates are block SETS that
contain the wall already declared: the rules' own completion (`nextBlocker` iterated), taking the rest
of the hit, and the `blockN` best other sets of 1–3 more defenders by a first-order score (life stopped
minus μ_b per hand card, 0.5 per armour piece); a set with a card that stops nothing the rest would not
is never listed; copies are one card. Each set is declared on the masked root (armour first, then hand,
by uid), and the rollout's rule policy adds nothing more to that link (`wallSet`). The next card of the
best set is returned; one call per card, stateless. The mask's seed names the link instead of the feed
length, so every card of one wall plays the same deal. "Take the rest" has no action when the seat lacks
priority: `act` returns the rules' move with the wall fixed, `explain` reports `laTake`.

| setting (seeds 0–5) | pooled | t | neg | over budget | steps p50/p95 |
|---|---|---|---|---|---|
| horizon "next" (to the seat's next decision), N 4 | +1.44 | 5.5 | 3 (Arakni −1.33 t −4) | 0.4% | 60/180 |
| "next", N 8 | +1.44 | 5.5 | 3 | 1.9% | 70/220 |
| "next", N 2 | +1.47 | 5.6 | 3 | 0.2% | 50/160 |
| "next", μ_b 2.5 | +1.82 | 7.5 | 1 | 0.4% | 60/180 |
| **"own" (through the seat's next turn), μ_b 1.5** | +4.11 | 11.4 | 0 | 4.7% | 110/290 |
| "own", μ_b 2.5 | +4.18 | 12.9 | 0 | 5.0% | 110/300 |
| **"own", μ_b 2 (picked)** | **+4.43** | 12.2 | 0 | 4.8% | 110/290 |

The three "own" settings are within noise; μ_b 2 had the best pooled. **Held out, seeds 6–11: +4.72,
t 12.9, 14/15 t > 2, none negative.** All 12: **+4.58, t 17.8, 15/15 t > 2**, 0 refusals / violations
/ stalls (17 draws over 2,520 games in the ON arm). Biggest: Bravo +10 / +8.8, Blaze +8.2 / +9.8,
Boltyn +9.2 / +7.3, Iyslander +7.2 / +7.0. Why "own" matters: a card kept from a block is worth what the
next turn does with it; to the decision only, μ is the only thing valuing it and Arakni (whose turn
spends its whole hand on stealth/mark lines) blocked away its attacks.

Ladder, every AI seat Sharp (`SPXLA=all tourney.js <hero> '' 3`, `LA-results/pc/ladder/`): 630 games,
REFUSALS 0 · VIOLATIONS 0 · stalls 0 · draws 0; stdev 15.1, spread 58. Order: briar 71, kayo 62, dash 55,
bravo 53, enigma 49, iyslander 49, dorinthea 45, azalea 42, viserai 40, fai 38, blaze 36, arakni 34,
lyath 22, boltyn 21, gravy 13. Again a strength lift, not a balancer. Search off: `npm run play '' '' 3`
byte-identical to v5.82.

Phone (`LA-phonec.js 4 200 '{"blocks":1}'`, real page, CDP 4x throttling, 200 positions per type):

| type | p50 | p95 | worst | steps p50/p95/max | ms/step |
|---|---|---|---|---|---|
| action | 35.4 | 96.0 | 158.3 | 83/220/288 | 0.44 |
| block | 46.8 | 125.4 | 198.9 | 138/300/300 | 0.37 |

Drills: `test/lookahead.test.js` — overruled walls (laBlock and laTake both reached) survive the scramble
of every hidden card (sabotaged: the block search on the real state → fails); blocks off, the wall is
the rules' with the action search on.

## 2. Arsenal — does NOT pay, not shipped

The arsenal step is a distinct action (`{t:"arsenal", uid|null}`, CR 4.4.3b). Candidates: the rules'
card, each distinct hand card, none; rolled out from the masked view.
- to the seat's next decision: **−0.11 (t −2.2)**, overruled 2% of 7,100 searched;
- through the seat's next turn: **−0.22 (t −1.6)**, 9 heroes negative, overruled 11%.
The rules' "biggest attack face down" is as good as the eval can see. Code removed from the branch.

## 3. Tuning the action search (K / μ / margin) — does NOT pay

Seeds 0–5 against v5.77's settings (K 1, μ 1.5, margin 0.5, own/300): K 2 −0.14 (over budget 12.4%:
two deals do not fit 300 steps); μ 1 −0.24; μ 2 +0.13 (t 1.2); margin 0 −0.07; margin 1 −0.11. All
noise; v5.77's settings stand.

Rules questions: none arose. `LA-results/pc/`: base, blk-*, ars-*, tune-*, ladder, play-search-off.txt.
