# FIX QUEUE — triaged by the CEO thread (v2; v1 from v5.08, v2 at v5.13)

Sources: `origin/findings/feed-a`, `feed-b`, `feed-c` (FINDINGS-*.md, with repro scripts).
v2 adds `feed-d`, `review-a` and `review-b`. **All six audits are in; this is the complete queue.**
**Work the ORDER below ("THE ORDER — v2"); it supersedes v1's numbering.**

**Rules for the shipper:** one item per release, top to bottom. Re-verify each item yourself
before fixing. If it does not reproduce, skip it and say so in your release summary. Every
"CEO-verified" item below was re-driven in the CEO thread and reproduced. Measure the blast
radius (pool census) before widening any reader, and drive a fixture that bites.

## v4 — THE AI PILOTS HEROES (CEO, 2026-10-18)

> RULING (user, 2026-10-18): *"Yes it is time for the ai to learn to play the heroes - I'm
> confident the cards are suitable :)"*

This **supersedes the 2026-08-16 seat ruling** ("a seat the dummy fills is ALWAYS the vanilla
pile. There is no hero the dummy plays as", CLAUDE.md:12091 on v5.34) for the TABLE's AI seat.
The trainer (`Battle`) keeps the tuned `[3,4,5]` dummy; nothing about it changes. A networked
seat is still a person who picks their own hero. Answers Stage §8.3 / open question 3.

**H1. Seat a hero AI at the table.** ~~One release.~~ **SHIPPED v5.35, CEO-verified:** 3611 tests, 0 fail,
5 skipped, scenes 107/107, all 21 script tags in the pushed commit, CI and Pages green, and the 210-game
ladder byte-identical to v5.34.
- **Record the ruling** verbatim with its date in CLAUDE.md, in place of the 2026-08-16
  paragraph (keep the old one, struck through, with "superseded 2026-10-18"), in
  HANDOFF-MERGE.md's DECISIONS list, and in `tools/rulings.json` if seat rulings live there.
- **The choice.** On the loadout's "Fight the new engine" path the player picks the opponent:
  **The Dummy** (the vanilla pile, as today) or **any of the 15 heroes**, plus **Random**. Reuse
  the P1 hero list and art (`HeroArt`), never a second roster. One state field holds the key, or
  null for the dummy. Do not name it `oppH`: that name was retired with the old picker, and a
  fresh name keeps the history readable.
- **The build.** `index.html:7732` passes `heroes: [seating.h.k, <choice>]`. The AI seat's
  loadout is `build.defaultPicks`, the same as self-play. `sparring.act` already drives
  seat 1 through `local.js`, so no policy change belongs in this release.
- **`VsStrip`** shows the chosen hero's portrait, name and printed life for P2, or the dummy.
- **The note under the button must say only what is measured.** "An AI pilots <hero> with the
  policy self-play uses. Untuned." Quote no win rate unless it was measured for that pair on
  this release (`node tools/tourney.js <yours> <theirs> 3`).
- **Mirrors** (the same hero on both sides) are allowed. The ladder skips them (v4.31), so they
  are unmeasured; say so in the changelog.
- **Guards.** `test/flow.test.js:80-100` pins "no opponent picker" and "the trainer and the
  table seat the SAME punching bag". Retire those two claims deliberately and pin the new ones:
  the trainer still deals `buildVanilla(DUMMY_DECK…)`; the table seats exactly the chosen key
  or null; no second roster; and the networked lobby is untouched.
- **Drive it on the phone page at 393x852** (the v4.28 pre-ship browser step): pick a hero,
  play to the first strike, check no dead tap and no overflow. Measure one game per hero for
  `POLICY REFUSALS 0` and `INVARIANT VIOLATIONS 0` through `local.js`, not just `selfplay.js`.

**H2. SHIPPED as v5.36 (`9e79547`), CEO-verified 2026-10-18:** 3615 drills, 0 fail, 5 skipped;
scenes 107/107; all 21 engine script tags in the pushed commit; CI drills and Pages green; the
3-seed ladder is byte-identical to the CEO's scratch experiment.

**H2. A non-attack that keeps the action point goes BEFORE the attack.** One release. CEO-measured
on v5.34 in a scratch copy (method below); re-measure in the real tree before shipping.
- **The gap.** `sparring.offence` ranks every attack first and every non-attack last
  (sparring.js:455-600). So Azalea fires her arrow, spends the turn's action point, and her
  "your next arrow attack gets +N … Go again" cards (Lace with Frailty/Bloodrot/Inertia, Take Aim,
  Read the Glide Path, Nimblism, Call in the Big Guns) never land on it. Measured on v5.34: 1 win in
  28 games, 0.7 a seed over 3 seeds.
- **The rule.** If the seat has an attack available (a card with printed power in hand or arsenal,
  or a board attacker), first play the cheapest affordable non-attack that **keeps the action
  point**, ties on pitch then uid. Then the existing ranking runs as before.
- **"Keeps the action point" is one judge reader, not card text in sparring.js** (its contract):
  `judge.keepsActionPoint(g, seat, uid, from)`, true when the card's own printed go again is
  unconditional, the same fact `execute` grants (`fxParse(card).ga === true`; v2.31's layout
  rule). The `boardAttackOf` / `abWindowOf` / `chiNeed` seam (v3.84, v4.38, v4.54). Do NOT widen
  it to instants or to conditional go again in this release: neither was measured.
- **The experiment patch** (inside `offence`, just above `const pick = from`):
  ```js
  const haveAtk = from.some(x => x.c && num(x.c, "power") > 0) || allies.length > 0;
  if(haveAtk){
    const first = from.map(x => ({c: x.c, uid: x.c && x.c.uid, from: x.from}))
      .filter(x => x.c && num(x.c, "power") <= 0 && KEEPS_AP(x.c))   /* → judge.keepsActionPoint */
      .filter(x => affordableWithin(sd, x.c, o))
      .sort((a, b) => num(a.c, "cost") - num(b.c, "cost") || num(a.c, "pitch") - num(b.c, "pitch") || byUid(a, b))
      .find(x => legal(g, {t: "play", uid: x.uid, from: x.from}, seat));
    if(first) return {t: "play", uid: first.uid, from: first.from};
  }
  ```
- **Measured, the change on ONE hero's seat only, every opponent on the old policy** (A/B; 14
  games a seed, 3 seeds, `tourney.js <hero> '' 3`):

  | hero | old | new | |
  |---|---|---|---|
  | Azalea | 1·0·0 (0.3) | 4·2·6 (4.0) | disjoint, REAL |
  | Lyath | 3·2·4 (3.0) | 7·6·9 (7.3) | REAL |
  | Viserai | 10·5·4 (6.3) | 14·12·11 (12.3) | REAL |
  | Briar | 12·11·9 (10.7) | 14·14·14 (14.0) | REAL |
  | the other 11 | | | within ±1–2, overlapping (noise) |

  On the full ladder (both seats on the new policy), Blaze 17.3 → 10.3 and Iyslander 16.7 → 8.3.
  **That is the zero-sum ladder, not self-harm**: with only their own seat switched they are
  unchanged (8.7 → 8.3 each). Report both tables; the full ladder is what `npm run play` shows.
- **Stalls 0 → 1 on the full ladder** (Gravy v Azalea 3 and Enigma v Iyslander 1 in the A/B runs).
  All are genuine draws: both decks and hands empty, or a hand of four cards with no play
  (Unmovable, two Put in Context, Astral Etchings with no aura). CR 4.5.3 has no deck-out loss
  (v3.80, v4.58). Record it in the changelog; do not invent a rule to end them.
- **Drill it** in `test/sparring.test.js`: a go-again non-attack plus an attack in hand → the
  non-attack is proposed first; a non-attack WITHOUT go again plus an attack → the attack first;
  no attack available → unchanged order. The drill must not depend on the parser in sparring.js.
  Sabotage the reader and the ordering.
- **sparring.js's header still says "NOT an AI opponent … should stay legible rather than become
  good" (sparring.js:48-54).** The 2026-10-18 ruling supersedes the first half: say so, and keep the
  legibility half, which still holds.

**H3. SHIPPED as v5.37 (`0d82fbf`), CEO-verified 2026-10-18:** 3623 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; the 3-seed ladder is byte-identical to the CEO's scratch experiment; `boost` route 0 -> 825.

**H3. The AI seat boosts when its own deck makes boost pay.** One release. CEO-measured on v5.36
(`9e79547`) in a scratch copy; re-measure in the real tree before shipping.
- **The gap.** `sparring.payAction` declines every boost (`if(p.kind === "boost") return {t:"boost",
  yes:false}`, sparring.js:144), on the reasoning that the banished card "is hidden from it — so
  there is nothing to weigh". Boost's reminder pays go again when the banished card is a
  Mechanologist card, and **Dash's deck is 44 of 44 Mechanologist**, so declining costs him every
  go again his deck is built on. He was the weakest hero on the v5.36 ladder (4.7 wins a seed).
- **Why the old reasoning no longer holds.** The ORDER of the deck is hidden; its COMPOSITION is
  not. A player knows their decklist minus every card they have seen, which is exactly the
  remaining deck as a multiset. So the policy weighs a probability the seat legitimately has, not
  a card it cannot see. Rewrite the v2.84 comment to say this, and keep its point that the policy
  never peeks at `deck[0]`.
- **The fix.** `judge.boostShare(g, seat)`: the share of `g.sides[seat].deck` (the remaining deck
  only; never the hand, never the order) that a boost would pay off for. `sparring` accepts boost
  when the share is at least 1/2, else declines. It reads no card text: judge answers, as with
  `keepsActionPoint`, `boardAttackOf` and `chiNeed`.
- **One reader of "does this banished card pay boost".** effects.js:4722 tests
  `/mechanologist/i.test(top.tt)`. Move it to one parser reader (for example
  `parser.boostPays(card)`) that reads the structured array `ty` (v2.39: the array is the
  authority), and have both effects.js and `boostShare` ask it. Measured: `tt` and `ty` agree on
  all 797 pool records, so this moves nothing today and is right the day they diverge. Pin that.
- **Measured** (3 seeds, scratch copy):

  | | before | after |
  |---|---|---|
  | Dash, only his seat on the rule (`tourney.js dash '' 3`, 42 games a side) | 2 · 3 · 4 (3.0 of 14) | 12 · 10 · 12 (11.3 of 14) |
  | Dash's average game length | 22.7 turns | 12.7 turns |
  | Full ladder, every seat on the rule (`tourney.js '' '' 3`) | Dash 4.7 a seed | Dash 22.3 a seed |
  | refusals · violations · stalls (full ladder) | 0 · 0 · 1 | 0 · 0 · 1 (the same deck-out draw, `gravy-azalea-2`) |

  Intervals disjoint by a wide margin: real. The others move down a little, which is the
  zero-sum ladder, not self-harm (H2's per-seat method).
- **The threshold is a stated choice that this pool never tests.** Only Dash's deck holds a boost
  card (38 of 44 print it) and his share at the deal is 1.0, so 1/2 and "always" give identical
  ladders (measured: SPBT 0, 0.5 and 0.7 all give 12 · 10 · 12). Pin both premises as drills: the
  set of decks holding a printed boost is {dash}, and its share at the deal is 1.0. The day a second
  boost deck arrives, somebody re-measures the threshold.
- **Drills.** `boostShare` counts the remaining deck and not the hand (a fixture with Mechanologist
  cards in hand only answers 0); the policy accepts at a share of 1/2 and declines just below it
  (synthetic decks); `sparring` still reads no card text (the existing guard). Add a `boost` route
  counter to `tools/selfplay.js` on the engine's own phrase (`Boost: <card> banished`), pinned
  against the engine's spelling (v3.81), and confirm it is non-zero after the fix and 0 before it.
  Sabotage: the threshold, the hand/deck split, and the reader move.
- **The ladder line in CLAUDE.md and FINISH.md that names the policy declining boost** should be
  updated in the same release, so no doc still says the seat never boosts.

**H4. Sequence the go-again chain: the attack that keeps the action point goes first, and a
next-attack grant waits for an attack to take it.** One release (v5.38). Measured by an investigator on v5.37
(`0d82fbf`) and re-measured by the CEO in a fresh copy; numbers below are the CEO's. Re-measure in
the real tree before shipping. The experiment, gated on `SPX`, is
`experiments/H4-gravy-experiment.patch` on this branch (applies cleanly to `0d82fbf`); ship the
RULE, never the gate.
- **The gap, half 1 (ranking).** `sparring.offence` ranks attacks on printed power alone, so a
  go-again attack (Golden Tipple, Saltwater Swell, 1-3 power) sits behind a bigger attack or an ally
  deploy that spends the action point, and is then stranded. In Gravy Bones' 42 games, 231 of 305
  plays that spent the last action point were made while an affordable attack that keeps its own
  point was in hand (Golden Tipple stranded 229 times, Saltwater Swell 139).
- **The gap, half 2 (grants with no taker).** H2's "go-again non-attack first" step asks only
  whether any card with power exists, so a pure next-attack grant is played when no attack can take
  it: an ally card in hand or an unaffordable attack counts. Pirate-ally grants (Avast Ye!, Loot the
  Arsenal, Loot the Hold, Yo Ho Ho!): 162 played, 40 used. Flying High: 56 played, 26 used. With the
  rule: 69 played / 61 used, and 46 / 46.
- **The rule.**
  - Among the attacks the seat can make, the one that keeps the action point goes first. That means
    its own unconditional go again, an arsenal stamp, or a waiting `gaNext` / `gaNextQ` grant it
    matches.
  - Ties fall back to the existing order: power, then cost, then uid.
  - A non-attack whose WHOLE payload is next-attack grants (`buffNext` / `gaNext` ops, no conditions,
    no optional cost) is held until an attack the grant's qualifier admits is legal now and
    affordable without the grant card.
- **Two judge readers, and one may be the existing one.**
  - The experiment adds `judge.attackKeepsActionPoint(g, seat, uid, from)` beside H2's
    `keepsActionPoint`, plus `judge.grantTakers(g, seat, uid, from)` (null unless a pure grant; else
    the legal attacks its qualifier admits, as `{uid, from, cost}`, through `qualMatches`).
  - **Prefer ONE reader of "does this play keep the action point"**: extend `keepsActionPoint` to
    answer for attacks and board allies too, rather than shipping a sibling with a near-identical
    name (v3.61, two records of one fact). If the merge moves H2's non-attack answers (a non-attack
    can match a `gaNextQ`, e.g. Mage Master Boots), measure it; if it moves the ladder, keep two
    readers and say why in the header.
  - **Either way, fix the latent defect the investigator found in `keepsActionPoint`.** It answers
    TRUE for Limpit, Hop-a-long and Cutty Shark in hand, because `fx.ga` carries the go again from
    the ally's ATTACK line, while `execute` grants a deploy nothing (`abilityGa`). Repro: seed
    `gravy-arakni-0`, turn 9; `keepsActionPoint(Limpit, "hand")` is true, and the deploy takes ap
    1 -> 0. It is latent today only because H2's caller filters to power <= 0. Pin it.
- **Measured** (3 seeds; wins a seed):

  | | v5.37 | with the rule |
  |---|---|---|
  | Gravy Bones, own seat only (`tourney.js gravy '' 3`, of 14) | 3 · 4 · 2 | 6 · 6 · 8 (two runs byte-identical) |
  | Gravy Bones, full ladder, rule on every seat | 5.3 [4,6] | 11.3 [11,12], disjoint |
  | Fai, full ladder | 12.7 [11,15] | 18.3 [18,19], disjoint |
  | Bravo · Lyath · Iyslander, full ladder | 13.3 · 10.7 · 6.7 | 10.7 · 8.0 · 4.0, none disjoint (zero-sum) |
  | refusals · violations · stalls | 0 · 0 · 1 | 0 · 0 · 2 |
  | `npm test` (rule gated) | | 3618 pass, 0 fail, 5 skipped |

- **The two stalls are draws in which no seat can deal damage, CEO-checked, and both seats are not
  empty-handed in the strict sense.**
  - `iyslander-azalea-1`: both decks and hands are empty and both arsenals hold one card. Iyslander's
    is On the Horizon (a Block). Azalea's is Lace with Frailty, which is LEGAL, but it is a grant with
    no attack to take it, so the rule holds it.
  - `gravy-briar-2`: Gravy's Cutty Shark, Quick Clip costs 1 to attack and he cannot raise it. Briar's
    Scorpio needs a Lightning attack on the chain.
  - CR 4.5.3 has no deck-out loss. `aiseat.test.js`'s draw check reads deck and hand only (not the
    arsenal), so it would accept the first; say so in that drill's comment, or tighten the drill to
    "no seat has a legal play that can deal damage" if that is cheap.
- **Drills.**
  - The reader(s):
    - own go again keeps the point;
    - an ally deploy does not;
    - a board ally whose attack line prints go again does;
    - a waiting bare `gaNext` does;
    - a `gaNextQ` entry matches or misses by its qualifier;
    - a conditional go again does not.
  - `grantTakers`:
    - null for a card that prints anything besides grants;
    - never lists the grant itself;
    - respects the qualifier: a Pirate-ally grant with only a non-Pirate attack lists nothing.
  - The policy:
    - holds a pure grant with no taker and plays it with one;
    - ranks a 1-power go-again attack before a 5-power one without go again.
  - Sabotage each: drop the `kap` key, drop `grantOK`, count the grant card as its own taker, and
    restore the ally false positive.
  - `keycensus.test.js` gains `abilityGa` and `qualMatches` as judge-only readers, with the reason.
- **Recorded, not built (feed text, for the next feed batch).** Deploying an ally prints "<ally>:
  the weapon's attack — its cost is paid when it swings". This is `parser.js:721`'s noop reason for
  every `Action - …: Attack` line, so an ally's attack line is called a weapon's. Repro: Gravy Bones v
  Dorinthea, seed 0, turn 5, "Riggermortis: the weapon's attack — …". The rules are right; only the
  line is wrong.
- **Also seen, not built:**
  - Golden Tipple's optional discard is always declined.
  - Offence never proposes a graveyard play (watery grave).
  - Every ally deploy spends the last action point, 40 of them while a board ally could still attack.
  Candidates for H5+ once measured.

**H5+.** One gap at a time, one investigator at a time. Waiting with unmeasured experiments in the
scratchpad, in order: Boltyn (6.3), Azalea (6.7), Iyslander (6.7), Blaze (8.3).

## v3 — STAGE INCREMENT 1 INPUTS (CEO, 2026-10-17)

The v2 queue is complete. These come from the Stage design (`design/STAGE.md` on branch
`design/stage`, Appendix B), measured over the 210-game self-play corpus at `4d42c58`. Every
line reference below was re-read on `origin/main` at `4d42c58`. They are the feed and state
work of **increment 1, "Truth first" (v5.31)**, which changes no look. Same rules as v2: one
item per release unless it says batch, re-verify first, and update `tools/selfplay.js`'s route
regexes in the same commit as any wording change (v3.81).

**S1. `strike` records the power it subtracted the wall from as `pend.power`.** Neither
`pend.total` (the declared power) nor `pend._struck` (stamped before the late bonuses,
`effects.js:7442`) is that number. Counting prevention, an equation `power − wall → dealt`
is wrong on 282 of 4,224 hero strikes against `total`, 97 against `_struck`, and 0 against
the total `linkPumps` returns (`pre.total` in `strike`). One key at `judge.js:2220`. State
hashes change once, deliberately: re-pin them in that commit and say so.

**S2. The shared feed names hidden cards: 2,124 lines, 10 shapes, every game.** Compass and
Scout the Periphery are already recorded (`look-named-in-shared-feed`, v5.30). Not yet:
- `(b) <card> is set in the arsenal, face down.` — `judge.js:3457`, 1,347 lines, 210 games.
  Name the seat, not the card.
- Opt and Spire Sniping's reorder: `prompts.js:1179-1184` (214 lines). The "sent to the
  bottom" branch (`:1184`) never fired, but it names cards the same way.
- Azalea's ability names the face-down arsenal card it sends to the deck: `effects.js:1435`
  (46 of 61 lines of that shape).
- Hand-to-deck moves with no printed reveal (Rising Sun, Setting Moon; Stroke of Foresight's
  mode): `prompts.js:1218-1221` (29 lines).
- Boulder Drop's crush names the card forced from the defender's hand: `effects.js:1283` (3).
Batch into one release. Check the trainer's feed for the same lines.

**S3. Second person in the shared feed: 1,716 engine-voice lines in 27 shapes.** Both seats
read the feed (v2.83). Largest first, with where the text is written:
- noop reasons: `parser.js:1713` (299), `parser.js:2510` (263), `parser.js:880/882` (152),
  `parser.js:3146` (44), `parser.js:1925` (2);
- `condWhy` phrases: `effects.js:3002-3025` (13 shapes, about 445 lines);
- `effects.js:581` (118), **`effects.js:8151`** (118, Dorinthea's "your hero ability frees
  it"), `effects.js:2699` (86), `effects.js:2675` (52), `effects.js:2241`, `2324`, `4033`,
  `4359`, and the next-attack labels from `parser.js:4086-4087` via `effects.js:1629`.
The 845 quoted token lines (`effects.js:1996`, `created on X's board — <printed line>`) are
the card's own printed text and are NOT a defect. Batch; widen `test/noopvoice.test.js` so a
noop reason cannot say "you"/"your".

**S4. Hard-coded names and a lowercased name in engine strings.** `effects.js:581` prints
"Kayo makes Might" and `parser.js:1713` prints "Gravy Bones'": a hero and a token named
inside the engine (golden rule). `effects.js:2430` prints `norm(v)`, so the feed reads
"Your next crouching tiger". Rides with S3.

**S5. Every attack prints its declaration twice.** `judge.js:3377` ("attacks with / swings")
and `effects.js:5076` ("— N power on the chain"), 4,443 of 4,443 attacks. Keep one line that
carries both facts. Mind the `swing`/`attack` route counters (v4.46).

**S6. A defender the feed never names.** When the wall totals 0, `strike` prints no Wall line,
so a card that defended for 0 (a halved card hit by Shred, 3 strikes in 2,100 games) is never
mentioned. Print the wall when anything was declared.

**S7. Doc fixes (ride with any release).** `ROADMAP-MULTIPLAYER.md:232` still calls the
2026-07-25 "no AI opponent" decision "still right"; it was reversed 2026-08-14. CLAUDE.md
points to `HANDOFF.md` ("THE NEW DIRECTION") for that reversal; it lives in
`HANDOFF-MERGE.md:188`.

**Not for the shipper (UI, increment 5):** the trainer's `onState` funnel calls
`DawnInvariants.errors(st)` (`index.html:6809`), so the warn band is still unread on the page
(v4.39). The Stage judge's eye reads `check()`.

## THE ORDER — v2 (work this list; numbers in brackets point at the item text)

Done: [1] v5.12, [2] v5.13. Also shipped from the trigger-order measurement: v5.09, v5.10,
v5.11. **Order items 1–7 are SHIPPED** as v5.14 (N1), v5.15 (N2), v5.16 ([3]), v5.17 ([4]),
v5.18 ([5]), v5.19 (N3) and v5.20 ([6]). The CEO verified v5.20: 3541 tests, 0 fail, 5 skipped,
fairness clean, scenes 107/107, every script tag present in the pushed commit.
Then **item 8 ([7]+N4+N5) v5.21, 9b ([8] Shred) v5.22, and 10 (N6) v5.23** shipped. The CEO
verified v5.23: 3559 tests, 0 fail, 5 skipped, scenes 107/107, every script tag present.
Then **11 v5.24, R1 v5.25, 12 v5.26, 13 v5.27 (recorded, unsourced), 14 v5.28 + v5.29, and
15 v5.30 (recorded)** shipped. **THE QUEUE IS COMPLETE.** The CEO verified v5.30: 3594 tests,
0 fail, 5 skipped, scenes 107/107, fairness clean, every script tag present. The approximation
ledger reads 24 stated, 1 open (`cloaked-display`, a UI job) and 29 closed.
**v3 (S1–S7) is SHIPPED** as v5.31 (S1 `pend.power`), v5.32 (S2 hidden cards), v5.33 (S3+S4 seat voice,
names) and v5.34 (S5 one declaration line, S6 a wall worth 0 is named, S7 doc pointers). The CEO verified
v5.34: 3607 tests, 0 fail, 5 skipped, scenes 107/107, fairness clean, all 21 script tags and `.nojekyll` in
the pushed commit, and the 210-game ladder byte-identical to v5.32 (0 stalls, 0 refusals, 0 violations,
every route counter unchanged). **Increment 1 of the Stage design is complete.** The three items under
NEEDS A RULING stay open.

1. **[N1] A declared defender's "Discard this" hand ability is legal and pulls it out of
   the wall.** Sev-3, both boards. CEO-verified on v5.13.
2. **[N2] The trainer's aura-attack door has no action-point gate.** Waxing Specter swings
   at 0 AP and leaves `ap: -1`. Sev-3, trainer only.
3. [3] Tokens in graveyards.
4. [4] Mark of the Huntsman paid with a card that's already gone.
5. [5] Late go again dropped at the table.
6. **[N3] Malefic Incantation's Runechant is made AFTER the "played or created an aura
   this turn" gate is read.** CEO-verified on v5.13.
7. [6] Run Through's "your next sword attack" rider.
8. [7] A played defense reaction is in the wall but not in the counts. Fold in **[N4]**
   and **[N5]**.
9. **[R1] THE MARK RULING (user, 2026-10-14) — build next, after item 8.** See "R1" below.
9b. [8] Shred is legal with nothing to target.
10. **[N6] `playTargetWhy` treats an untargeted `ctrPut` as targeted.** It refuses Uphold
    Tradition's flip on the trainer. This is the other half of v1's rejection note.
11. [9] Look Tuff's "unless you pay" tests floating resources only.
12. **[N7] Murkmire Grapnel's "can't be prevented" does nothing.** Verify first.
13. [10] Counters on an attacking aura after declaration.
14. FEED BATCH: [11]–[18] plus **[N8]–[N11]**. One or two releases.
15. [19] Record the Compass hidden-information leak; [N12] doc fix rides with any release.

## v2 ITEMS

**N1. A declared defender's "Discard this" hand ability is legal, and it pulls the card out
of the wall.** Source: review-b §1. CEO-verified on v5.13: `legal: null`, then the card is in
the graveyard while `blockH` still lists it, and amp is 1.
- v5.04 censused the hand readers and missed this door. `handAbilityOK`
  (`effects.js:~9494`) checks `handFree` for a "Discard a card" cost, but never asks
  `P.isDeclaredDefender` for a `cost:"self"` ability.
- So the seat blocks, sees the attack, withdraws the 3{d} for value (Arcane Twining amp 1,
  Agile Windup's Agility, Reaper's Call's mark), and the damage step skips the missing card.
- Rally the Coast Guard's "Discard a card", gated "while defending", must stay legal.
- Add the door to `test/defenderzone.test.js`'s census. Both boards: `judge.js:~1091` and
  the trainer's `activateHand`.

**N2. The trainer's aura-attack door has no action-point gate.** Source: review-b §2.
- The trainer's only AP gate is `costsAP(card) && act(s).ap<1`, which reads the AURA's own
  type line. Waxing Specter is a Mystic Illusionist **Instant** - Aura, but Cosmo's grant
  is an **Action** ("Once per Turn Action - {r}: Attack").
- So at 0 AP she swings, and `linkPayload` charges the point she doesn't have
  (`NEGATIVE-AP`, CR 4.4.3e).
- The table refuses it ("no action point left"). Refuse on `ap < 1` in the aura block, and
  the ally block for symmetry, whatever the card's own type. `index.html:~3977`, `~4207`.
- Repro: review-b §2.

**N3. Malefic Incantation's Runechant is created after the aura-turn gate is read.** Source:
feed-d §1. CEO-verified on v5.13 (viserai v dash, seed `d11`, first 1).
- Feed: "Runerager Swarm: condition not met (no aura played or created this turn)", then
  Malefic's verse comes off, then "+1 Runechant".
- `auraTurn` is evaluated in the condition loop (`effects.js:~4027`), and
  `ctrClock(n, "atkPlay")` fires Malefic afterwards (`~4617`).
- Runerager Swarm loses its go again; Hit the High Notes loses +2 and Shrill of Skullform
  +3. The next card that turn does see it.
- CR 7.2-style reasoning (a "when you play" trigger resolves above the card) says the
  Runechant exists before the attack resolves. So either fire the play clock before the
  loop, or settle `auraTurn` late like `pumped`.
- Measure which "when you play an attack action card" creators exist (the Runechant pop
  site at v2.23 is the precedent) and drive both orders. Repro: feed-d §1.

**N4. (with [7]) The trainer's defence-reaction doors count `handDefenders` off the wrong
structure.** Source: review-a F2.
- `playRx` and `playRxA` (`index.html:~3438`, `~3492`) pass
  `s.stack.filter(l=>l.k==="def"&&l.gi==null)`. Those are the DUMMY's defenders on the
  PLAYER's attack.
- In the defence window the player's declared hand defenders are `you(s).blockH`, which is
  what the trainer's own wall and judge's wall use.
- Latent today: only the Unity line emits `withHandDefender`, and both Unity records are
  equipment. Fix it while you are in [7].

**N5. (with [7]) `playAtSpeed`'s `handBlockers` forward is load-bearing and undrilled.**
Source: review-a F1.
- Sabotaging `handBlockers: o.handBlockers || 0` to `0` was SILENT on the full suite, yet it
  is the only way the trainer's reaction doors feed reprise (Ironsong Response +3 vs +0).
- Add the both-halves drill.

**N6. `playTargetWhy` treats every `ctrPut` as targeted.** Source: review-b §3.
- Uphold Tradition prints "Put a +1{p} counter on **an** aura you control with ward". That is
  untargeted, and the flip itself turns its Ward 1 on (ruling 2026-10-04).
- But the trainer's `tryPlay` (`index.html:~4050`) asks `playTargetWhy` for powCards too, and
  with no ward aura it refuses ("nothing it can target"). The table allows it, and so does the
  trainer on the opponent's turn: the trainer disagrees with itself.
- Re-Charge! prints the same untargeted shape and escapes only through its `buffNext`.
- Mark `ctrPut` targeted off the printed word "target", and keep the census of
  `playTargetWhy`'s claimants (review-b lists them) both directions.

**N7. Murkmire Grapnel's "can't be prevented" sets `n._unpreventable`, which nothing reads.**
Source: review-b, noted out of scope. Verify it first. If it is real, the damage is
preventable against its printed text (weaker). Drive it against a ward and a one-event shield.

FEED (add to the batch):
- **N8.** "N unspent 'this turn' grants expire". `preventDamage` never decrements `wardTurn`,
  so a fully spent Oasis Respite still counts. `held` sums `buffNext` as a NUMBER, so one +6
  grant prints "6 grants". `effects.js:~10298-10345`. (feed-d §3)
- **N9.** Lyath's boo line `effects.js:~2674`: "The crowd boos you — Reviled, and your Bravo
  cards know it." It is hard-coded second person in a shared feed, and **no pool card prints
  "Bravo"** (CEO grep), so the second half is false. Name the seat with `sv`, and check the
  45-literal ledger moves. (feed-d §4)
- **N10.** Pouncing Paws: "crouching tiger springs into your banished zone". Lowercase card
  name, and a hand-rolled "your" (use `sp`). (feed-d, out-of-scope note)
- **N11.** Wax On: "Wax On answers at instant speed — +3 defence" prints the card's own
  defence as if it were a bonus. Also the noop reason "Pouncing Paws — ability: playable this
  turn — the flag is set when the card is created" joins [12]. (feed-d notes)

DOC:
- **N12.** CLAUDE.md still tells readers to widen `parser.pumpRead` (deleted at v5.02), at
  ~line 7013 ("ADD IT TO BOTH LISTS — `parser.pumpRead` and `fairness.PUMP_OPS`") and ~483
  ("The fallback's existing magnitude test is what suppresses it"). Correct both in the next
  release's CLAUDE.md edit. (review-b §4)

INFORMATIONAL (no action): review-a F3 (the trainer's CR 7.3.2b refusal can't fire, because
its opponent's turn is one link) and F4 (`needEmpty`/`arsFree` coincide while `arsCap` is
always 1). Both are measured and stated; don't build anything for them.

## STATE DEFECTS — v1 item text (numbers referenced above)

1. ~~SHIPPED v5.12~~ **A played attack reaction's go again is the TARGET's, not its controller's** — CEO-verified.
   Stains of the Redback ×3 and Run Through ×3 grant go again to their target AND bank an
   instant's "+1 action point" for the player who played them (`ap 1 -> 2` on play; arakni v
   viserai seed `ar3`, first 1). That is a free action point and steals games. v3.74 fixed
   this for ABILITIES (`_attackRx`); a played AR card falls through to `fx.ga`.
   Sites: `engine/effects.js:~3635` (the ga chain), `~5437` (the AP arithmetic). Census the
   pool's attack reactions that carry `fx.ga`: does any print a go again of its OWN?
   Repro: FINDINGS-feed-a.md §1. Direction: stronger.

2. ~~SHIPPED v5.13~~ **Dash's starting item enters with no counters and no clock** — CEO-verified.
   `build.js:~829` places the item as a bare entry: Hyper Driver has no steam counters (a
   boost yields no {r}), and Boom Grenade has no steam counter and no `sd` stamp, so its
   printed "destroy this unless you remove a steam counter" never runs (3 start sweeps, still
   on the board). Route the placement through the same enters-the-arena body `execute` uses
   (`effects.js:~5315/5330`). Whether crank is offered at game start is a separate RULING:
   record it, don't guess it. Repro: FINDINGS-feed-b.md §3 (C hd.js, D bg.js).
   Direction: Grenade stronger, Driver weaker.

3. **Tokens reach graveyards (a token that leaves the arena ceases to exist)** — CEO-verified.
   End of enigma v lyath (seed s3, first 1): Lyath's graveyard holds 12 Might tokens. Pass
   Over then offers a token as a legal banish target. Ephemeral already has a "ceases to
   exist" path (`parser.isEphemeral`, `gy()`/`toGrave`); a token should share it. Census
   every writer into a graveyard and every reader that counts or picks from one, and consider
   an invariant (a token in a graveyard is an error). Repro: FINDINGS-feed-b.md §7 (H tokg.js).

4. **Mark of the Huntsman's "destroy this and mark them" is paid with a card that's already
   gone** — CEO-verified. Danger Digits' jab makes the dagger hit and its last sentence
   destroys it; the queued pay sheet then carries `destroyUid` for a card in the graveyard.
   Accepting destroys nothing (`gear.find` misses silently at `effects.js:~5948`), the mark
   still lands, and the feed claims "destroyed Mark of the Huntsman". Rule: an unpayable cost
   is inert, never free (v2.04). At minimum, refuse at answer time (the rider must not
   resolve) and lapse the sheet as declined, with a true feed line. Repro:
   FINDINGS-feed-a.md §3 (a3.js). Direction: stronger when accepted.

5. **A late go again is dropped at the table** — CEO-verified. Pulping and Bolt'n' Shot
   ("defended by fewer than 2 non-equipment cards" / "pumped") get `pend.ga = true` in
   `linkPumps`, but `judge.strike` rebuilds `pend` from the pre-pump `link`
   (`judge.js:~2200`), so the point never arrives (1 declared blocker → ap 0, want 1).
   `_struck` is dropped by the same line. Repro: FINDINGS-feed-b.md §1 (A pulp.js).
   Direction: weaker, CR-exact board only.

6. **Run Through's "your NEXT sword attack this turn gets +N{p}" pumps the attack it targets**
   — CEO-verified (rx layer pump 2, `buffQ` empty). That attack is already on the chain, so
   "next" is a later sword attack (Dorinthea's hero hands her one). Read it as a
   sword-qualified `buffQ` grant. Census the attack reactions printing "your next … attack"
   so the v3.11 "a reaction pumps the attack it's played on" rule keeps every card it was
   right for. Repro: FINDINGS-feed-b.md §4 (E rt.js).

7. **A played defense reaction is in the wall but not in the "defended by / with" counts** —
   reader-verified, not re-run here. Reprise ("defended with a card from their hand") and
   defLt2/defLt2any count `blockH`/`blockG` and never `blockRx`, while the wall already adds
   its defence. A resolved defense reaction is a defending card, so it should count, with
   timing as played. Sites: `judge.js:~2275` (`declaredWall`), `strike`'s `handBlockers`
   (`~2034–2129`), and the trainer's equivalents. Repro: FINDINGS-feed-b.md §2 (B rep.js).

8. **Shred is legal with nothing to target** — reader-verified. `rxNoTargetWhy` reads
   `modes`/`selfQ`/`gaQ`, and `fx.defDebuff` is a FOURTH home of a target qualifier, so Shred
   is played and spent with an empty wall or against a non-Assassin attack. This is the v4.88
   lesson again. Repro: FINDINGS-feed-a.md §2.

9. **Look Tuff's "unless you pay {r}" tests floating resources only** — reader-verified.
   "Look Tuff: can't pay 1" prints while the hand holds pitchable cards (pitch-on-demand
   ruling, 2026-08-01). Offer the payment the way the shared pay sheet does, and census the
   other self "unless you pay" clauses. Site: `effects.js:~4423`. Repro: FINDINGS-feed-c.md §1.

10. **+1{p} counters put on an attacking aura after declaration never reach the attack** —
    reader-verified, MEDIUM rules reading. Astral Etchings (instant speed with a Spectral
    Shield) on a Cosmo-armed attacking aura: the counters land and `pend.total` is unchanged.
    `powCtr` is read once at declaration (`effects.js:~4502`). Find a sourced CR quote in the
    repo about an attack-proxy's power following its source before building; if there isn't
    one, record it in `tools/approx.js` as stated and move on. Repro: FINDINGS-feed-b.md §5.

## FEED TEXT — batch into one or two releases

11. Pick result lines print raw state keys: `Swift Shot → deckTop from grave.` (also the
    sheet hint `From your grave → deckTop`). Use `promptZoneWord` and a destination word.
    `prompts.js:~1167`, `~492`. (feed-a §4)
12. Noop reasons leak engine voice into the feed: `off fx.noDrx`, `cost read by the weapon
    reader` (every swing), `activation gate — checked before the ability can be used`. Reword
    them, and widen `test/noopvoice.test.js` to ban dotted `fx.` fields and "reader".
    `parser.js:~3776, ~721, ~3672, ~3146`. (feed-a §7, feed-b §8a)
13. Payment-averts lines: `Kayo paid 1 — the rider resolves.` for Winter's Bite / Cold Snap,
    where the payment PREVENTS the consequence (`ops: []`, `elseOps`). `prompts.js:~1268`.
    (feed-c §2)
14. v5.06 leftover: `Throw Caution to the Wind: 1 of that damage is prevented — the other 2
    goes with this hit.` The unused points are lost with the event. `effects.js:~839`.
    (feed-c §3)
15. False skip line on discard6way cards: `Bare Fangs: no additional-cost discard to feed —
    bonus skips.` while the bonus lands (6 → 8). `effects.js:~4636`. (feed-c §4)
16. Start-phase trigger lines print BEFORE `— X's turn N —`, so they read as the previous end
    phase. Say the header first. `judge.js:~3647` vs `~3612–3640`; check the trainer too.
    (feed-a §5)
17. Waxing Specter's enters-clause condition is evaluated when it ATTACKS as a Cosmo weapon:
    `condition not met (no blue card in Enigma's pitch zone)` on every swing. State is
    unaffected; the line is noise. (feed-b §8b)
18. Equipment "Destroy this:" abilities print the effect, then `The piece shatters — cost
    paid.` The piece is only marked destroyed after `runOps`, so it is live during its own
    effect (latent state). Pay the cost first. `effects.js:~5244`. (feed-a §6)

## RECORD, DON'T BUILD

19. Compass of Sunken Depths "looks at" the top card and the shared table feed NAMES it to
    both seats. This is a hidden-information leak at the table, by recorded design
    (`parser.js:~3113`). Record it in `tools/approx.js` (table board) with a probe. A per-seat
    feed is a UI decision. (feed-c §5)

## REJECTED

- feed-b §6, Uphold Tradition activated with no aura: its line is "Put a +1{p} counter on an
  aura you control with ward" — NOT targeted — and the flip itself turns its Ward 1 on. The
  activation is legal and not a paid no-op.

## R1 — THE MARK RULING (user, 2026-10-14)

> "Marks wear off when the hero is hit by an opponent's attack or an effect but otherwise
> sticks around — I'd say even if a hero transforms the mark will stay on!"

Record it verbatim, with the date, wherever rulings are recorded (`tools/rulings.json`, and
`tools/approx.js` if a stated record is affected). Nothing clears `marked` today; `sides.js`
is the only place it is ever `false`. Build it this way:

- **Cleared by a HIT from an opponent's attack.** CR 7.5.5: damage actually dealt. A swing
  blocked to nothing or fully prevented is not a hit and does not clear. A hit on an ally does
  not clear the hero's mark.
- **The hit fiction counts.** Danger Digits' "the dagger has hit" is a hit by definition.
- **Order inside the hit.** Snapshot marked-ness AT the hit, then clear it, then resolve the
  on-hit triggers.
  - "When this hits a MARKED hero" (Mark of the Black Widow, Mark of the Funnel Web) must
    still fire off the snapshot.
  - "When this hits a hero, mark them" (Mark the Prey, Scar Tissue, Two Sides, Hot on Their
    Heels, Mark of the Huntsman) re-marks AFTER the clear, so the hero ends that hit marked.
  - Drill both: a two-case drill can't tell clear-then-trigger from trigger-then-clear.
- **Persists through transformation.** Arakni becoming an Agent, and returning to the brood,
  changes nothing about anyone's mark. Pin it with a drill.
- **"Or an effect" — ANSWERED (user, 2026-10-14): "the effect would specifically need to
  remove a mark."** Non-attack damage (arcane, a Runechant) does NOT clear a mark. Only an
  effect whose text says to remove the mark does, and over the pinned pool NO card prints one,
  so there is nothing to build for that half. Record both quotes verbatim. Pin the premise as a
  drill: a census proving no pool record removes a mark, so the day one arrives it is a
  decision rather than a silent no-op. No `stated` record is needed.
- **Measure the ladder on both sides.** Arakni's whole deck reads marks (Agents,
  Black Widow, Funnel Web, Stains' discount, Graphene Chelicera), so expect her to move.
  Report it, and don't retune the policy inside the rules fix.

## NEEDS A RULING FROM THE USER (do not build)

- **May the AI pilot a hero?** (Stage §8.3.) RULING 2026-08-16 says a seat the dummy fills is
  always the vanilla pile (CLAUDE.md:12059). The Stage design's vs-AI tiers, its L9 lesson
  and AI-vs-AI exhibitions need a hero-piloting AI. Asked 2026-10-17.
- **Unity and a defence reaction from hand.** Unity prints "When this defends together with
  a card from hand". `handDefenders` counts declared hand cards (`blockH`) only, so a defence
  reaction played from hand later does not lift it (44 times at 3 seeds). Timing says that is
  right; v5.21's rule (every count of a wall sees a played reaction) points the other way.
- **Is the soul hidden?** Not sourced in the repo. If it is, "`X charges <card> into X's
  hero's soul`" (`effects.js:1099`, 127 lines), "`<card> goes from the hand to the soul`"
  (`prompts.js:1218`) and Banneret's pay-off line (`effects.js:1647`) name hidden cards too.

- ~~**Mark never expires.**~~ **RULED 2026-10-14, see R1.** Original note: Nothing clears `marked` once it is set (`sides.js:171` is the only
  `false`), so Arakni's Agents and Black Widow / Funnel Web riders keep reading it for the
  rest of the game. The repo has no sourced rule for when a mark ends. Ask the user.
