# FIX QUEUE — triaged by the CEO thread (v2; v1 from v5.08, v2 at v5.13)

Sources: `origin/findings/feed-a`, `feed-b`, `feed-c` (FINDINGS-*.md, with repro scripts).
v2 adds `feed-d`, `review-a` and `review-b`. **All six audits are in; this is the complete queue.**
**Work the ORDER below ("THE ORDER — v2"); it supersedes v1's numbering.**

**Rules for the shipper:** one item per release, top to bottom. Re-verify each item yourself
before fixing. If it does not reproduce, skip it and say so in your release summary. Every
"CEO-verified" item below was re-driven in the CEO thread and reproduced. Measure the blast
radius (pool census) before widening any reader, and drive a fixture that bites.

## HANDOFF — START HERE (CEO, 2026-10-31, at v5.58)

**This section is the handoff.** Root `HANDOFF.md`/`WEEK.md` were retired to `docs/archive/` on
2026-10-31; do not start a new root handoff file — rewrite this section instead.

- **Live: v5.55** (`0813ae7`) plus a docs commit (`9051f58`). Verified: 3742 drills, 0 fail,
  5 skipped; scenes 107/0; fairness clean; both babel blocks compile; 21 engine scripts +
  `.nojekyll` in the pushed commit; CI green on v5.53, v5.54, v5.55. The live URL and the CDNs are
  blocked from the cloud sandbox, so the real page was not driven this session.
- **Shipped this session (CEO thread, Opus):**
  - v5.53 S15: Display Loyalty's Fealty rider reads (`parser.quotedAtkHero`); Fealty reads in full
    (`dracCard` grant + `_drac` stamp; end-phase clock, `hist.madeNames`). Found under it: no ATTACK
    ever entered `hist.playTy`, so Static Shock / Star Fall never counted a Lightning attack. Fixed.
  - v5.54 FEED 21: class/talent capitals (`parser.CLASS_TALENT_WORDS`), riders say what they do
    (`effects.riderWords`), Flying High's colour after the pump. Ladder byte-identical.
  - v5.55 R5 (ruling below): an attack counts its own chain link (`parser.dracNow`,
    `dracLinksNow`, `pend.linked`). 6 seeds vs v5.54: Fai 105 -> 114, nothing else moved > 4.
  - Docs: eleven finished plans/handoffs moved to `docs/archive/` (with an index); `CLAUDE.md` has a
    docs map and derives the version instead of stating it.
- **Round 2 (CEO + Sonnet agents in worktrees, 2026-10-31):** `fe947a8` **`tools/page.js`**, an
  offline harness that drives the real page at 393×852 (CDNs + card DB served locally; deps in a
  scratch dir — see its header). **v5.56** Death Dealer's put never pitches its only arrow + AI
  `resUnlock` (6-seed stalls 2 -> 1). **v5.57** Cloaked card back (`cloaked-display` CLOSED — the
  ledger has 0 open records). **v5.58** H20: the AI cashes arena abilities (`judge.arenaUseful`;
  Lyath 259 -> 296, Gravy 150 -> 172 over 72 paired seeds). Agents do the build and measurement;
  the CEO verifies each patch on main (suite, scenes, fairness, babel, ladder, harness) and pushes.
- **Two rulings asked of the user (2026-10-31), do not build until answered:**
  - **R6, dead position.** `node tools/tourney.js '' '' 6` still has ONE stall (arakni-dash-5 or
    azalea-gravy-3 after v5.56): both decks empty, nobody can ever deal damage, CR 4.5.3 has no
    deck-out loss. Draw? AI concedes? Something else?
  - **R7, V of the Vanguard** (`attack-grant-misses-own-attack`): does "Your attacks this combat
    chain get +1{p} for each Light card charged this way" include V itself? Today only later attacks.
- **How to work** (unchanged): `CLAUDE.md` is the core; one item per release; re-verify before
  fixing; sabotage every new drill; ladder at 3 seeds (6+ for a balance claim, both sides of the
  change). Work in fresh sessions. A Sonnet shipper suits a mechanical release; keep judgement work
  (rules readings, new mechanics) in Opus.
- **NEXT, in order:**
  1. ~~Two stalls outside the standard ladder~~ — one fixed at v5.56, the other is R6 (a ruling).
     Original note: **Two stalls outside the standard ladder** (CEO, 2026-10-31). `node tools/tourney.js '' '' 6`
     stalls `azalea-gravy-3` (turn 686) and `arakni-dash-5` (turn 1768), identically on v5.54 and
     v5.55; seeds 0–2 have none, so `npm run play '' '' 3` does not see them. Replay one with
     `tools/selfplay.js` (`match(a, b, seed, first)` then `play`) and read what both seats do near
     the end before deciding: a policy loop is an H-item, a game with no way to end is a rules
     question for the user (CR 4.5.3: there is no deck-out loss).
  2. ~~`cloaked-display`~~ SHIPPED v5.57. Next instead: weak-hero policy (Gravy, Blaze, Bravo,
     Enigma trail at 5–9 wins a seed) and player-facing choices the ledger auto-picks
     (`soul-banish-cost-auto-picked` was in flight at v5.58). Original note: **`cloaked-display`** (open approx record): the card back on the board. A UI job; read
     `UI-GUIDE.md` first and drive the page at 393×852 — which needs a machine that can reach the CDN.
  3. The unresolved H-items in THE ORDER below.
- **Latent, recorded:** (a) a non-permanent played FROM THE GRAVEYARD still files to banish (R2
  covered banish only); every watery-grave card in the pool is an ally, so no pool card reaches it —
  ask the user before changing. (b) Synthetic only: a quoted "gain 1{h}" rider is relocated by a loose
  life matcher (NEEDS A RULING section, second bullet). Record, don't build.

## R2-R4 — THREE RULINGS (user, 2026-10-31)

> RULING (user, 2026-10-31): *"To grave like normal even if it is played from banish."*
> RULING (user, 2026-10-31): Unity counts a defence reaction played from hand: *"Yes"*.
> RULING (user, 2026-10-31): *"Soul is public."*

- **R2 (engine): a card played from the banished zone goes to the GRAVEYARD after it resolves**, like
  any card, turn-stamped (`_gy`). Today both filing paths put it back into banish: `effects.js`
  `execute` (non-attacks) and `fileAttack` (attacks). S9's play-permission strip stays (the card must
  not keep `_playTurn`/`_asInstant`). An ephemeral card (Crouching Tiger) still ceases to exist on its
  way to the graveyard (`parser.ceasesToExist`). Close the approx record
  `played-from-banish-files-to-banish` with its probe turned round. Drill the real routes: Blaze's
  ability (Snapback), Pouncing Paws (Crouching Tiger), Mounting Anger / Rising Resentment's banished
  attack. Check what else reads a banished card that was played (Art of Desire-style "banished" counts).
- **R3 (engine): Unity counts a defence reaction played from hand.** Unity prints "When this defends
  together with a card from hand"; `handDefenders` counts declared hand cards (`blockH`) only, so a
  defence reaction played from hand later in the same link does not lift it (44 times at 3 seeds).
  `parser.rxDefenders(..., fromHand)` (v5.21) is the reader that already knows those cards. Both boards.
  Drill: Gauntlets/Helm of Unity defending with only a played-from-hand defence reaction gets its bonus;
  one played from the ARSENAL does not.
- **R4 (no change): the soul is public.** The feed lines that name charged/soul cards are right.
  Nothing to build; recorded so nobody hides them.

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

**H4. SHIPPED as v5.38 (`fa7b7e0`), CEO-verified 2026-10-24.**
- 3635 drills, 0 fail, 5 skipped; scenes 107/107.
- 21 engine script tags and `.nojekyll` are in the pushed commit; CI drills and Pages are green.
- Gravy Bones (11.3) and Fai (18.3) match the experiment exactly.
- **The shipped reader is wider than the experiment, and that is measured rather than assumed.** The
  merge into one `keepsActionPoint` adds an AURA attack carrying a +1{p} counter, which is Cosmo's
  printed go-again rider, `auraAttackOf().gaWithCounters`.
  - On the full ladder Enigma reads 11.7 against 8.7 for the experiment and 9.7 for v5.37.
  - Her own-seat A/B with and without that branch overlaps: [7,5,6] against [6,3,4]. The direction
    is consistent; the size is unresolved at 3 seeds.
  - It is a faithful reading of a printed rider, so it stays.
- v5.38 full ladder: briar 26.0, dash 23.0, dorinthea 20.7, kayo 18.7, fai 18.3, arakni 18.3,
  viserai 18.0, enigma 11.7, gravy 11.3, bravo 10.3, azalea 8.0, lyath 8.0, blaze 7.3, boltyn 5.7,
  iyslander 4.0.

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

**H5. SHIPPED as v5.39 (`10f41e2`), CEO-verified 2026-10-24:** 3640 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; the full 3-seed ladder is byte-identical to the CEO's re-measure of the gated experiment
(nobody moves beyond it). v5.39 ladder: briar 26.0, dash 22.7, dorinthea 20.0, kayo 19.3, fai 17.7,
arakni 17.7, viserai 17.0, iyslander 12.3, gravy 10.7, enigma 10.3, bravo 9.3, azalea 7.3,
blaze 7.3, lyath 6.7, boltyn 5.3. Stalls: 1 (`gravy-briar-2`, a no-damage draw).

**H5. A non-attack that spends the action point: the biggest printed arcane goes first.** One
release (v5.39). Measured by an investigator on v5.38 (`fa7b7e0`) and re-measured by the CEO in a
fresh copy; the numbers below are the CEO's. Re-measure in the real tree before shipping. The
experiment, gated on `SPX`, is `experiments/H5-iyslander-experiment.patch` on this branch and
applies to `fa7b7e0`. Ship the RULE, never the gate.
- **The gap.** When the seat has no attack to make, `sparring.offence` ranks its non-attacks
  CHEAPEST first, so it spends Iyslander's one action point on the smallest damage. In her 42 games
  she made 153 non-attack plays that spent the point, and in 79 of them a legal non-attack printing
  more arcane was in hand or arsenal: +1 x13, +2 x10, +3 x20, +4 x15, +5 x21. That is about 258
  arcane, roughly 6 a game, left unplayed. A typical case is a 1-arcane Frosting played with a
  5-arcane Ice Bolt legal in the same hand.
- **The rule.** Among the non-attacks the seat would spend its action on, play the one printing the
  most UNCONDITIONAL arcane damage first. Ties fall back to the existing order: cost, then pitch,
  then uid. A non-attack printing no arcane ranks as 0.
  - H2's go-again step runs before this, so a card that keeps the action point still goes first.
- **The reader.** `judge.arcaneOf(g, seat, uid, from)` returns the card's printed arcane through
  `parser.arcAmount`. That is the same reader Blaze's ability prices with: unconditional ops only, so
  a gated "instead deal N" is not counted and an X is not guessed. A card the seat does not hold in
  that zone (hand or arsenal) answers 0.
  - `keycensus.test.js`'s one-board reader pin moves deliberately, because `arcAmount` is now also
    asked by judge (the v5.37 `boostPays` and v5.38 `abilityGa` precedent). Give the reason line.
- **Measured** (3 seeds; wins a seed):

  | | v5.38 | with the rule |
  |---|---|---|
  | Iyslander, own seat only (`tourney.js iyslander '' 3`, of 14) | 5 · 1 · 2 | 6 · 6 · 8 (two runs byte-identical) |
  | Iyslander, full ladder, rule on every seat | 4.0 [3,5] | 12.3 [9,14], disjoint |
  | every other hero, full ladder | | moves by at most 1.4, inside the band (MAX 5) |
  | refusals · violations · stalls | 0 · 0 · 2 | 0 · 0 · 1 (`gravy-briar-2`, the existing no-damage draw) |

  - The probe confirms the mechanism. Plays made while a higher-arcane alternative was legal went
    79 -> 0, and 5-arcane plays went 25 -> 54.
  - Blaze, the other arcane deck, does not move (7.3 -> 7.3). Do not claim the rule helps him.
- **Drills.**
  - `arcaneOf` reads the printed number (two cards differing only in arcane), ignores a gated
    "instead" rider, and answers 0 for a card not held.
  - The policy plays the 5-arcane card over the cheaper 1-arcane one in the same hand.
  - A go-again non-attack still goes first (H2 is unchanged).
  - Ties fall back to cost.
  - Sabotage: the sort key dropped, the key inverted, and the reader counting a gated rider.
- **Also measured, not built (H6+ candidates for Iyslander):**
  - A Block card (On the Horizon) set in the arsenal is never played from there.
  - Crucible of Aetherweave's amp is activated and then wasted on 278 of her turns.
  - Both A/Bs overlapped at 3 seeds (`all-hypotheses.patch` in the investigator's scratchpad), so
    they stay recorded rather than built.

**S8. SHIPPED as v5.40 (`844ee9d`), CEO-verified 2026-10-24.**
- 3650 drills, 0 fail, 5 skipped; scenes 107/107.
- 21 engine script tags and `.nojekyll` are in the pushed commit; CI drills and Pages are green.
- The repro's Bolt of Courage#29 now lands in `banish`.
- The new self-play fault NO-ZONE reads 0. It read 202 on v5.39: 134 soul banishes, plus 68
  transcends, a second vanishing-card defect it found. A transcended card now keeps its uid.
- Ladder: Boltyn 5.3 -> 5.7, nobody else beyond 0.6. The policy, not the gate, is Boltyn's binding
  constraint (H6).
- The cost choice is recorded as `soul-banish-cost-auto-picked` (stated).

**S8. A soul card banished as a cost goes to NO zone, and Duty Bound Blitz's gate reads the soul
instead of the event. ENGINE, ships BEFORE H6 (v5.40).** Found by the Boltyn investigator on v5.39;
CEO-reproduced with `experiments/S8-soul-repro.js` (`node experiments/S8-soul-repro.js <tree>`).
- **The vanishing card.** `effects.js:3396` pays `abSoulCost` with
  `actMut(n).soul = act(n).soul.slice(_sc)` and puts the cards nowhere. Boltyn's hero ability and
  Radiant Touch both pay it.
  - Repro: in Boltyn v Dorinthea, seed `boltyn-dorinthea-0`, turn 5, the hero ability banishes
    Bolt of Courage#29, which ends up in NO zone.
  - `effects.js:1871` (`soulSpend`) is the same shape. v4.50 measured zero claimants for it, so it is
    probably latent; fix it through the same body anyway.
  - The cards go to the BANISHED zone. A banish from the soul is a banish, and both lines say so in
    the feed.
  - **No guard here sees a card in no zone.** `invariants.js` catches a card in TWO zones, and one in
    none falls out of the census silently. That is CLAUDE.md's own warning from v2.21 and v3.07.
    Consider a self-play fault for it: a non-token, non-ephemeral uid present in one state and in no
    zone in the next. It would have caught this, and it is how this family stops recurring. Size it
    honestly; if it is more than a small instrument, record it as its own item instead.
- **The gate.** Duty Bound Blitz prints "Play this only if a yellow card has been put into your soul
  this turn". That is an EVENT. `effects.playIfOk`'s `soulPitch` (`effects.js:9877`) asks whether a
  yellow card stamped `_soulT === turn` is IN the soul now.
  - Boltyn's ability banishes the freshest soul card. So in the same repro, a yellow card is charged
    and then banished, and `judge.legal` refuses the face-up Duty Bound Blitz with "no yellow card
    has been put into your soul this turn". Weaker than printed, and live in his deck.
  - Record the event: for example, `hist` keeps the pitch of every card put into the soul this turn,
    written by the three soul writers (`effects.js:3833` charge, `:8183` ascend, `prompts.js:1051`
    pick to soul). CR 4.4.4 clears it with `hist`, and the gate reads it.
  - v4.90's source census of the three writers is the place to hold all three to it.
- **Which soul card is banished is the engine's choice, not the player's.** The front, which is the
  card just charged. Search the repo for a verbatim CR quote about who chooses a cost's object before
  building anything.
  - If the choice is cheap through v4.85's `discost` pending shape, build it.
  - Otherwise record it beside `cost-discard-auto-picked`, for example as
    `soul-banish-cost-auto-picked` (stated, with a probe).
  - The event-gate fix above makes the choice matter less.
- Drills: drive the repro (the card lands in `banish`; the gate opens after a yellow is charged and
  banished in one turn; it stays shut with no yellow put in); census the soul writers; sabotage each.
  Re-measure the ladder; expect Boltyn to move, since Duty Bound Blitz becomes playable more often.
  Name any hero that moves.

**H6. SHIPPED as v5.41 (`5a76ddf`), CEO-verified 2026-10-25:** 3658 drills, 0 fail, 5 skipped;
scenes 107/107; 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages
green; NO-ZONE 0. Boltyn 5.7 -> 11.3 [10,14] on the full ladder, disjoint; nobody else separates.
v5.41 ladder: briar 26.0, dash 22.7, dorinthea 20.3, kayo 18.7, arakni 18.0, fai 17.3, viserai 16.7,
iyslander 11.3, boltyn 11.3, gravy 10.3, enigma 10.0, bravo 8.7, azalea 7.0, blaze 5.7, lyath 5.7.

**H6. Boltyn: charge first, then swing the weapon the charge pumped. POLICY, ships AFTER S8
(v5.41).** Measured by the investigator on v5.39 (`10f41e2`) and CEO re-measured in a fresh copy;
re-measure on top of S8 before shipping, because S8 changes his games. The experiment is
`experiments/H6-boltyn-experiment.patch` on this branch, gated on `SPX` (and `SPH`). Ship the RULE.
- **The gap.** Boltyn's deck turns on "if you've charged this turn", and the policy ranks attacks on
  printed power alone. Over 42 games and 377 Boltyn turns:
  - 302 turns make exactly one attack.
  - Only 148 turns are charged, and 109 of those end without Raydn swinging, though Raydn is 0 power
    and +3 once charged.
  - Take Flight, which has go again only once charged, went first in 47 of the 113 turns it was held.
  - Uncharged 4-power attacks were walled on 90 of 92 swings.
- **The rule.**
  - Before the seat has charged this turn, an attack that offers an additional-cost charge outranks
    the other attacks, if the hand can pay its cost and keep a card to charge. One whose go again the
    charge switches on goes first among those.
  - Once charged, such an attack counts as keeping the action point.
  - A weapon whose swing the charge pumped above its printed base swings before any hand attack that
    does not keep the point.
- **The reader.** `judge.chargeView(g, seat, uid, from)` gives, off the parse:
  - `charged` (`hist.charged`);
  - `offers` (`fx.chargeCost`);
  - `gaIf` (a `charged`-gated `ga`);
  - `base` (`effects.basePowOf`);
  - `power` (base, plus +1{p} counters on a weapon, plus every charge-gated `self` pump once charged).

  `chargeRoom` in sparring uses printed numbers only. Consider whether `chargeView` should fold into
  an existing reader (v3.61); one record per fact.
- **Measured on v5.39** (3 seeds; wins a seed):

  | | v5.39 | with the rule |
  |---|---|---|
  | Boltyn, own seat only (of 14) | 1 · 2 · 2 | 6 · 4 · 8 (two runs byte-identical) |
  | Boltyn, full ladder, rule on every seat | 5.3 [4,7] | 11.0 [10,13], disjoint |
  | everyone else | | inside the band (MAX 4); only Boltyn charges, so all 546 non-Boltyn games are identical |
  | refusals · violations · stalls | 0 · 0 · 1 | 0 · 0 · 1 (the same `gravy-briar-2` draw) |
  | `npm test` with the gated patch | | 3640, 0 fail, 5 skipped |

- **Measured, not built (A/B overlapped H1 alone):**
  - Charge the colour a rider or a held gate asks for; this cut missed-yellow charges from 61 to 2,
    but did not move wins.
  - Set a play-restricted card face down into the arsenal last.
- Drills: `chargeView` answers per field; the policy picks the charge-offering attack first when it
  can keep a card to charge, swings the pumped weapon once charged, and does neither when uncharged
  with no charge card. Sabotage the rank, `chargeRoom`, and the weapon candidate.

**S9. SHIPPED as v5.42 (`469d8e3`), CEO-verified 2026-10-25:** 3665 drills, 0 fail, 5 skipped; scenes
107/107; all 21 engine script tags and `.nojekyll` in the pushed commit; CI drills and Pages green; the
3-seed ladder byte-identical to v5.41 (the AI never played from banish). The repro under the H7 policy
reads 25 banish plays and 0 replays on v5.42, where v5.41 finds a replay by the third game.

**S9. A card played from banish under "you may play it this turn" goes back into banish STILL
PLAYABLE, so it can be played again, without limit. ENGINE.**
Found by the Blaze investigator on v5.41 (`5a76ddf`); CEO-reproduced.
- **The defect.** Both filing paths put a card played from banish (or the graveyard) back into
  banish: `effects.js:~5433` (`execute`, non-attacks) and `fileAttack` `:~6583` (attacks). Its
  play-permission stamps (`_playTurn`, `_asInstant`) travel with it, so `parser.playableFromZone`
  (`:~9646`) answers "playable" again the same turn.
  - Repro: `SPX=blaze node experiments/S9-banish-replay-repro.js <tree>`, run against a tree carrying
    `experiments/H7-blaze-negative.patch`, whose policy plays from banish. It prints "blaze-boltyn-0
    turn 7: Snapback#15 played from banish, back in banish with _playTurn=7, legal to play AGAIN:
    true".
  - `execute` is shared, so a HUMAN on either board can do it today. Crouching Tiger (Pouncing
    Paws; cost 0, go again) then gives unlimited attacks in one turn. With that policy on every
    seat, 35 Fai games livelock at turn 1-2.
  - It is invisible to today's ladder only because the AI never plays from banish (Blaze's pick
    parses `min:0`, and `autoAnswer` declines it). It is sev-3, illegal play allowed.
- **The fix that needs no ruling.** "You may play it this turn" is ONE permission. Strip the
  play-permission stamps when the played card is filed after it resolves, on BOTH paths, through one
  helper.
  - Drill it on the real routes: Blaze's ability (Snapback), Pouncing Paws (Crouching Tiger), and
    Mounting Anger / Rising Resentment's banished attack.
  - Each is playable once, then refused with a sentence.
- **The feed and the state disagree for Crouching Tiger.** It is ephemeral, and the feed says "it
  ceases to exist" while the card lands back in banish. Make the two agree with whatever destination
  rules.
- **Minor, same release.** `mkBanish` (`effects.js:~2438`) mints with the deck ENTRY's lowercased
  name (`{...rec}` keeps "crouching tiger"); v5.28 fixed only the "springs into" line. Use the
  database's name, as v3.33's token mint does.
- **The destination is a RULING, not a build** (see NEEDS A RULING). The filing comment calls
  banish-on-resolution "the printed rule for the cards that reach back into those zones". Measured
  over the pool, no card that grants a play from banish prints that: Blaze's ability, Pouncing Paws,
  Mounting Anger, Rising Resentment, Gate to i'Arathael. The repo has no verbatim CR quote either
  way. Keep the destination unchanged and record it as stated with a probe, e.g.
  `played-from-banish-files-to-banish`.

**H7 (Blaze): a CLEAN NEGATIVE once S9's defect is neutralised; nothing to ship.** Measured on v5.41
by the investigator; the experiment is kept at `experiments/H7-blaze-negative.patch`.
- On the frozen engine, "play the banished card, and hold instants on the opponent's turn" read
  Blaze [5,2,3] -> [10,9,8]. 293 of 401 banish plays in the probe were REPLAYS through the S9
  defect.
- With the defect neutralised, the result is [7,5,5], which overlaps and is not real.
- "Hold instants on the opponent's turn" also costs Boltyn his defensive instants (Toe the Line,
  Glisten): his interval falls [10,14] -> [5,7]. It must not ship as a blanket rule.
- Measured leaks, recorded:
  - 9.8 energy unspent per Blaze turn.
  - Cindering Foresight's amp lapses on the opponent's turn 261 times.
  - Crucible's {r} amp pitches the last card in hand 207 times.
  - Every "arcane before attacks" or "spend energy" variant was negative in probes.
- Re-measure after S9 ships; the honest answer today is that the policy's Blaze gap is not yet
  found.

**THE USER'S BUG REPORT, 2026-10-25** (`dawnblade-bug-kayo-t1-1792898007684.json`, v5.40, the table, Kayo v
an AI Blaze, opponent first). Four observations; all four are real, and they make three items.
> *"my blaze opp whispered on t1 and I got to opt, also while opting unjustly I couldn't figure out how to
> reorder cards. Lastly I think guardwell on the predatory plating might be coded slightly wrong - the piece
> should remain in play with -2 defense after blocking with it but one time it went to grave after blocking
> … I do like the 'usable' equipment and hero cards etc to show up in the hand rail but they don't in the vs
> ai mode."*

**S10. SHIPPED as v5.43 (`c5d4e02`), CEO-verified 2026-10-25:** 3673 drills, 0 fail, 5 skipped; scenes
107/107; both repros now answer the right seat; all 21 engine script tags and `.nojekyll` in the pushed
commit; CI drills and Pages green; the 3-seed ladder byte-identical to v5.42. New census
`test/promptside.test.js` (every `promptQ` push names a side) and `test/platingseat.test.js`.

**S10. Two seat defects, ENGINE, after S9 (v5.43). CEO-reproduced and fixed in a scratch copy:
`experiments/S10-opt-seat-controlpow.patch` (3 lines), suite 0 fail / 5 skipped.**
- **(a) An opt resolved by seat 1 opens on SEAT 0, over seat 0's deck.** The two opt specs
  (`effects.js:2070`, `opt`; `:2105`, `lookOrder`) carry no `side`, and `prompts.buildPrompt` defaults a
  missing side to 0. In the report, Blaze (seat 1) played Whisper of the Oracle and the sheet offered Kayo
  the top three of KAYO's deck. Blaze's energy still landed, because it is credited at the queue.
  - It is a free opt for whoever sits in seat 0, at the table and over the network alike. The trainer
    cannot reach it, because its seat 1 never opts.
  - Every existing opt drill runs at seat 0, the one seat where the default happens to be right.
  - Repro: `node experiments/S10-opt-seat.js <tree>` prints `actor 1 opt: prompt.side=0 cards=Wild Ride,
    Buckwild, Bare Fangs`.
  - Fix: `side: actorOf(n)` on both specs.
  - Census the family: every `promptQ` push in `effects.js` names a `side` or goes through a `*Spec(…,
    side)` builder. Measured, these two were the only ones without one. Pin that set, so that a new spec
    without a side fails a drill rather than defaulting to seat 0. Drive the opt at seat 1 on both variants.
- **(b) "Activate this only if you control a card with 6 or more {p}" counts the OPPONENT's attack.**
  `activateIfOk`'s `controlPow` (`effects.js:9814`) adds `s.pend.card` whoever declared it.
  - Repro: `node experiments/S10-plating.js <tree>`. Dorinthea (seat 1) swings a 6-power attack.
    Kayo's Predatory Plating "Destroy this: Gain {r}" is then LEGAL for seat 0 in the attack, defend,
    reaction, damage and resolution steps. It must be refused in all five, with the card's own sentence.
  - Fix: count `pend.card` only when `pend.by` is the asking seat, the test `chainAtkOf` already makes.
  - Positive control: Kayo's own 6-power attack still enables it (checked).
  - This is half of the user's Guardwell report; S11 has the other half. **Guardwell itself is right:**
    the SKA006 printing reads "When the combat chain closes, if this defended, put -1{d} counters on it
    equal to its {d}". The piece stays in play at 0. Upstream's `keyword.csv` has an empty Guardwell row;
    record the printing in CLAUDE.md the way Heave and Retrieve were.
- **Measured:** the 3-seed full ladder is BYTE-IDENTICAL with the patch (630 games, 0 refusals, 0 violations,
  1 stall gravy-briar-2, as v5.41). The policy never reorders an opt and never fires the Plating on the
  opponent's turn, so neither defect could move a ladder number. Both are human-facing.

**S11. SHIPPED as v5.44 (`5f0ea7a`), CEO-verified 2026-10-25:** 3679 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; it
touches `index.html` only, and the 3-seed ladder is byte-identical to v5.43. The Shipper drove it at 393x852:
Kayo's Plating declares and survives, the rail offers its ability on Kayo's turn, and Gravy replays
Limpit from the graveyard. Its "Limpit keeps its point" finding is the Compass working as printed
(FEED TEXT item 20).

**S11. The table's hand rail and gear tiles, UI (v5.44).** Reported by the user; CEO-read in source.
- **The rail.** The trainer's hand rail appends `playables` (`index.html:5443`): weapon swings, each
  equipment ability's powCard, the hero power, and cards playable from the graveyard or banish. The
  table's rail (`:7409`) shows the hand and the arsenal only. Build the same rail at the table.
  - Each entry is an ACTION, lit when `mine(a)` (judge.legal) and dim otherwise, two-tap to commit. The UI
    reads no card text (v3.84), so judge decides what is legal.
  - **The graveyard and banish half is a missing ROUTE, not only a missing button.** `judge.legal`
    accepts `from: "grave"` / `"banish"`, but the table has no control that sends one. A human Gravy
    Bones cannot replay a watery-grave ally there, and a human Kayo cannot play Crouching Tiger. Offer
    exactly the cards `judge.legal` accepts from those zones, so a 30-card graveyard does not flood the
    rail.
  - Keep the armour grid's tiles as well. The user likes the rail, so the rail is the addition.
- **The tile's one tap picks the ABILITY over DEFEND** (`:7133`, `cellAct = swing ? : ability ? : defend`).
  In the defend step, once the attacker passes, the defender holds priority. If the piece's instant is
  legal there, the tile commits the ability. With S10(b) unfixed that is exactly how the Plating "went
  to grave after blocking": a double tap meant to block destroyed it for {r}.
  - Rule: while `defend` (or "stop defending") is legal for the piece, the tile's tap is the
    declaration. The ability is reached from the rail entry above, which is the trainer's shape: two rows
    for two routes.
  - Pin it with a census in the style of `test/tapdoor.test.js`.
- Drive it on the phone page at 393x852 (the v4.28 step): Kayo blocking a 6-power swing with the
  Plating. The tap declares it, the rail offers the ability only on Kayo's own turn, and no tap is dead.

**S12. SHIPPED as v5.45 (`cbbc0ae`), CEO-verified 2026-10-25:** 3692 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; CI and
Pages green; the 3-seed ladder byte-identical to v5.44. The Shipper drove a reorder at 393x852 on both
boards.

**S12. Opt can only send cards to the bottom; it cannot ORDER the ones kept on top. UI + prompts (v5.45).**
- The ruling `effects.js:2059` records: "look at the top X, then put them back on top or bottom IN ANY
  ORDER". The sheet (`PromptSheet`, `index.html:2367`, shared by both boards) offers only the top/bottom
  toggle, and `applyPrompt` keeps the kept cards in the order they were dealt. It is weaker than printed,
  on every opt card in the pool, and the user looked for the control and found none.
- **The model.** `prompt.order`, a permutation of the kept indices (default: dealt order), and one
  reader `promptMove(prompt, i, dir)` in `prompts.js`, used by both boards.
  - `applyPrompt` writes the kept cards in `order`.
  - The table needs a new action in `PROMPT_ACTIONS`; `test/promptctl.test.js` will demand the control
    (v4.61).
  - The ORDER of the cards sent to the bottom stays a stated approximation: no pool record reads the
    bottom of a deck (`applyPrompt`'s own note).
- **The control** (CEO's call, one-hand phone):
  - The sheet shows the cards in their RESULTING order, left to right as drawn, each labelled
    "1st draw", "2nd draw"… or "bottom".
  - Tapping a card still toggles top/bottom.
  - Each kept card carries two arrows under it, "◀" (earlier) and "▶" (later), each at least 36x28.
  - The hint says both: "Tap a card to send it to the bottom. ◀ ▶ change the order you draw them in."
- **`keepTop` (Spire Sniping) gets the arrows too.** Its "tap to put it under the rest" toggle stays
  as it is.
- **Policy:** `autoAnswer` keeps the dealt order, so the ladder is unchanged by construction. Say so,
  and prove it by running it.
- **Design note for the stage (Appendix C.1):** on the wheel, the arrows become the wheel's order. A
  spin decides the draw order, and a tap on the top card sends it to the bottom. The CEO updates
  STAGE.md.

**H8. SHIPPED as v5.46 (`97b4b75`), CEO-verified 2026-10-25:** 3696 drills, 0 fail, 5 skipped; scenes
107/107; both babel blocks compile; all 21 engine script tags and `.nojekyll` in the pushed commit; the
3-seed ladder is identical to the CEO's H8 measurement. New drill: `test/defending.test.js`.

**H8 (Lyath). While it defends, the seat plays only a card that helps the link. POLICY, after S12
(v5.46). CEO-measured on v5.44; the patch is ready: `experiments/H8-lyath-defending.patch`
(3 files, 78 lines).**
- **The gap.** `sparring.reaction` plays the cheapest legal card in every reaction window, and
  on the opponent's turn that includes any instant.
  - So Lyath spent his Guardian Instant Auras (The Suspense is Killing Me, Edge of Their Seats,
    Tension in the Air, Act of Glory) and Concealed Object while being attacked. That was 194
    plays and 105 pitches on the opponent's turn in 28 games; Briar pitches once there and Kayo
    plays nothing.
  - He began his own action phase with two cards or fewer in about 70 of 219 turns. He never made
    a second attack in a turn, and made none in 67.
  - Probes: `experiments/H8-handsize.js`, `H8-turns.js`, `H8-zero.js`, `H8-conds.js`,
    `H8-read.js`. Each takes `<tree> <hero>`.
- **The rule.** While the seat is defending (`pend.by` is the other seat), the reaction branch
  proposes only a card that helps this link: a defence reaction, or a card whose payload prevents
  damage. Everything else waits for the seat's own turn.
- **Judge reader:** `judge.defendsNow(g, seat, uid, from)` is true when `fxParse(card).dr` holds,
  or when an op is one of `ward`, `revWard`, `arcShield`, `awd`. Drill it on Drag Down, Oasis
  Respite, Toe the Line and Throw Caution (true) and on Edge of Their Seats and Concealed Object
  (false), and pin the op set.
- **Measured (3 seeds, `node tools/tourney.js lyath '' 3`):**
  - Lyath's own seat: [2,3,3] -> [5,6,6], DISJOINT.
  - Rejected: E2, "play instants before the attack on your own turn", read [1,2,4] alone and
    [4,4,3] together with E1.
  - With the rule on Azalea's or Gravy's own seat only, the results are byte-identical; on
    Boltyn's, [4,9] -> [5,8], overlapping.
- **Full ladder with the rule on every seat:** 0 refusals, 0 violations, **0 stalls** (v5.44: 1),
  and no hero's interval separates. Means v5.44 -> rule:
  - up: lyath 5.7->7.7, blaze 5.7->7.7, bravo 8.7->10.7, enigma 10.0->10.7;
  - down: gravy 10.3->7.7, azalea 7.0->5.0, boltyn 11.3->9.7, iyslander 11.3->10.7;
  - the top seven are within one win either way.
  - The dips are opponents improving, not the rule on their own seat (above).
- **The census moves.** `test/speccensus.test.js` loses `ctrStamp` (v4.58's shape). The patch adds
  a 39th leg, Fai v Enigma with Enigma's chair first (seed `ctr-7-8-1`), measured as the first
  pairing that still reaches it. Every other field is unchanged, and the suite is 0 fail.
- Drills:
  - Lyath defending holds Edge of Their Seats and plays Drag Down.
  - On his own turn the held aura is still playable.
  - Sabotage the `defending` test, the reader's `dr` half, and each op.

**S14. SHIPPED as v5.49 (`4616e81`), CEO-verified 2026-10-26:** 3710 drills, 0 fail, 5 skipped; scenes
107/0; babel ok; scripts + `.nojekyll` present; CI and Pages green; ladder byte-identical to v5.47. The
CEO's mislabel probe reads 0 of 16 `chargeFirst` calls on a card without a charge (was 38 of 54).

**S14 (original item). The call's reason names a charge for a card that offers none. VOICE ONLY (with feed 19-20).**
Found by the CEO on v5.47, tracing Fai. `sparring.js` `pickWhy` tests `rankC(x) < 3 && x.cv &&
!x.cv.charged` before `x.kap`; `judge.chargeView` answers an object for every hand/arsenal card
(`offers:false` for one with no charge), and `rankC` is 0 for any attack that keeps the point. So
every go-again attack, for a seat that has not charged, is labelled `chargeFirst` ("Swing the attack
that lets you charge first…"). Measured over 15 self-play games, one per hero: 54 `chargeFirst`
calls, 38 on a card that offers no charge (Fai 16, Gravy 7, Arakni/Briar/Azalea 4, Viserai 2,
Enigma 1). Repro: Fai v Kayo seed 0, turn 1, Ronin Renegade. Order the key `kap` first, then the
charge rank; the action never moves, so the ladder stays byte-identical. Drill: `chargeFirst` only
names a card whose `chargeView.offers` is true (Boltyn positive, Fai's Ronin Renegade near-miss).
Sent to the Shipper 2026-10-26 with feed 19-20.

**H12 + H13 + H14a SHIPPED as v5.50 (`c24c6b4`) by Shipper 3, CEO-verified 2026-10-31** (see HANDOFF).

**H12 (policy, every hero with a free optional pick). MEASURED REAL — ship it.** `judge.autoAnswer` answers a
`min:0` pick with an empty selection, so the AI declines every optional pick, including ones it has
already paid for. Census, 60 self-play games on v5.47 (pick | zone->to | rider | times declined):
- **paid, then its payload declined:** Death Dealer's put (the {r} paid) 18, Bull's Eye Bracers' put
  (the piece destroyed) 8, Blaze's hero power banish 18.
- **free cards declined:** Rise from the Ashes (Phoenix Flame back to hand) 2, Flamecall Awakening's
  deck search 3, Jack Be Quick's graveyard banish for +1 and go again 4, Sigil of Silphidae's
  graveyard banish for 1 arcane 3, Crash and Bash's reveal for a Seismic Surge 8, reloads 5.
- **priced, left alone:** Pick Up the Point / Up Sticks and Run retrieve ({r}), Condemn to
  Slaughter, Golden Tipple's discard, Mounting Anger / Rising Resentment's hand banish.
- Experiment (judge.js, `SPX`-gated): take the pick when it is cost 0, no `filters`/`discard`/
  `maxAll`, and is either a dead zone (grave/deck/banish) to hand or banish, a reveal, or hand to an
  empty arsenal. Best card by printed power, ties on uid. Blaze's banish is NOT in it: the policy
  never plays from banish (H7).
- **Result (CEO, v5.47, `experiments/H12-free-picks.patch`, census `experiments/H12-optpicks-census.js`).**
  - Azalea own seat, 12 seeds: [6,4,3,3,2,2,2,4,1,2,2,2] (2.8) -> [11,6,9,9,3,9,12,10,9,6,10,9] (8.6),
    up on 12 of 12 seeds. One seed (s4: 3) keeps the own-seat intervals touching.
  - `PCLS=ars` alone gives the IDENTICAL result, so the hand-to-arsenal put (Death Dealer, Bull's Eye
    Bracers, reload) carries all of it. `dead` and `rev` are free by construction and move nothing
    measurable (Fai 8.3 -> 9.3 at 6 seeds, Briar/Viserai/Bravo noise at 3).
  - Full ladder with every seat on (the shipping configuration), 3 seeds: Azalea [11,6,5] (7.3) ->
    [21,15,21] (19.0), DISJOINT. Every other hero inside the band. 0 refusals, 0 violations, 0 stalls.
- **Build it ungated in `judge.autoAnswer`** as a named reader (e.g. `judge.freePick(p)` answering the
  class or null), so a pick's freeness is stated once. Keep the exclusions exactly: any `cost`,
  `filters`, `discard`, `maxAll`, a caller-supplied pool (`zone == null`), a board or gear zone, a
  hand-to-banish or hand-to-graveyard move.
- **Drills (real cards):** taken: Death Dealer and Bull's Eye Bracers (the arrow reaches the arsenal,
  Death Dealer draws), Rise from the Ashes and Flamecall Awakening (a Phoenix Flame to hand), Crash and
  Bash (the reveal mints a Seismic Surge). Still declined: Pick Up the Point's retrieve ({r}),
  Condemn to Slaughter, Golden Tipple's discard, Mounting Anger's hand banish, Blaze's hand banish.
  Sabotage each class and each exclusion.
- **The call's voice:** `explain` keys a taken optional pick as `pickMin` ("Choose this one."). A key
  of its own reads better, e.g. "Take it. It costs you nothing."
- **The spec census may move** (Azalea's games change): more legs, not a looser claim.

**H13 (policy, Enigma/Bravo/Iyslander/Kayo). Ship WITH H12: the arsenal step never stores a card
that cannot leave it.** Found by the CEO on v5.47 (`experiments/H13-apleft.js enigma`): at the end
of Enigma's turns her arsenal held Test of Strength 48 times and On the Horizon 43. The arsenal
step takes the highest-power card in hand, so a hand with no attack stores a BLOCK card (or an
Inner Chi), which has no play, cannot be pitched or declared as a defender from the arsenal, and
clogs the slot for the rest of the game.
- **The fix:** `judge.arsenalUsable(g, seat, uid)` answers `types.isPlayable`, and the arsenal step
  filters on it; with no usable card it leaves the arsenal empty and the card stays in hand to block
  or pitch. Patch: `experiments/H13-arsenal-usable.patch`; with H12: `experiments/H12-H13-combined.patch`.
- **Measured: noise in wins, dominant by construction.** Enigma [5,4,4,7,6,5] (5.2) -> [5,6,5,5,7,5]
  (5.5) at 6 seeds; Bravo and Kayo byte-identical, Iyslander noise. Full ladder with H12+H13 on every
  seat: 0 refusals, 0 violations, 0 stalls; Azalea 19.0 as with H12 alone.
- **Why ship a noise move:** "[Hero]'s call" shows this branch to the player, and it currently says
  "Keep your biggest attack face down" while storing a Block card. H11's reason. Give the arsenal
  step's reason a second key for a non-attack ("Keep it face down. It can be played from there.")
  and say "arsenalSkip" when only unusable cards are left.
- **Drills:** Enigma's hand of Test of Strength + On the Horizon leaves the arsenal empty; a hand
  with an attack still stores it; Inner Chi is never stored. Sabotage the filter.

**H14a (policy, Boltyn). Ship WITH H12 + H13: charge the colour the card asks for.** Found by the
CEO on v5.47 tracing Boltyn. The charge answer takes the LOWEST pitch, and Beaming Bravado ("if a
yellow card is charged this way, this gets +1{p}") and Light the Way (go again on hit if a yellow
was charged) pay off only for a yellow, so the AI charged a red over a yellow in hand.
- **The fix:** `judge.chargePitchWanted(g)` answers the pitch the pending card's `chargedPitchN`
  condition asks for (null if none); the charge answer prefers that pitch, then the lowest, then uid.
  Patch: `experiments/H14a-boltyn-charge-colour.patch`; all three: `experiments/H12-H13-H14a-combined.patch`.
- **Measured: noise in wins.** Boltyn [6,3,4,2,5,8] (4.7) -> [5,4,7,2,7,8] (5.5) at 6 seeds. Full
  ladder with H12+H13+H14a on every seat: 0 refusals, 0 violations, 0 stalls; Boltyn 9.3, Azalea 19.0.
- **Why ship it:** the call says "Charge your lowest-pitch card" while the card in play prints "if a
  yellow card is charged". Give it a reason of its own ("Charge a yellow card. This card pays off
  for yellow.").
- **Drill:** Beaming Bravado with a red and a yellow in hand charges the yellow; Bolt of Courage
  (asks no colour) still charges the red. Sabotage the preference.
- **Not built, recorded:** Duty Bound Blitz ("play this only if a yellow card has been put into your
  soul this turn") in hand also wants a yellow charged, from ANOTHER card; and a charge attack with no
  go again can spend the last action point before the Raydn swing the charge pumped (Boltyn T7,
  Dorinthea seed 0). Both are sequencing judgements, measure before building.

**H15 (policy): a last-resort ability never pitches a card. NEGATIVE, not shipped.** CEO, measured
on top of H12+H13+H14a (`experiments/H15-no-pitch-fallback-NEGATIVE.patch`, census
`experiments/H15-abpitch-census.js`). The census over 120 games found the gear/hero fallback paying
by pitch often: Crucible of Aetherweave (Blaze 70, Iyslander 54), Lyath's hero ability 23, Death
Dealer 15, Fai 10, Enigma 9 + Uphold Tradition 6, Bravo 6, Beckoning Haunt 4.
- Holding every such activation, own seat at 3 seeds: Iyslander [5,4,8] -> [8,7,8] (overlapping);
  Blaze, Fai, Enigma flat; Lyath 4.3 -> 3.3, Viserai 8.3 -> 6.0, Azalea 8.7 -> 6.0, Bravo 5.3 -> 3.7.
- Read: a pitched ability is often worth its card. Lyath's end-of-turn boo makes a Might token for his
  next attack, and Death Dealer's put (H12) needs its {r}. If anything, the lead is Crucible's amp
  alone (it lapses at end of turn with no arcane left to play), and it overlaps.

**H16 (policy, Blaze/Fai): take Blaze's banish and play from banish, WITHOUT H7's "hold instants".
NOISE, not shipped.** On H12+H13+H14a: Blaze [1,2,5,1,4,3] (2.7) -> [2,3,3,3,5,3] (3.2) at 6 seeds;
Fai identical. H7's reading stands.

**H17 (policy, Gravy): rank an ally DEPLOY apart from a swing. NEGATIVE both ways, not shipped.**
On H12+H13+H14a, Gravy 179 of 277 turns end with an ally able to attack and no action point. The
offence ranks an ally card in hand by printed power as though deploying it were a swing
(`experiments/H17-ally-deploy-last.patch`, `judge.allyDeploy`). Deploy last: [3,2,4,1,4,2] (2.7)
-> [3,3,5,0,2,2] (2.5); deploy first (`DEPFIRST`): [1,3,2,2,3,3] (2.3). The ordering is not
Gravy's lever. His 1-life allies die to any swing at them, which the opponent's policy correctly takes
(CR 7.3.2a), and 12 of his cards print no defence.

**H19 (policy, Lyath): boo with the hero ability before an attack that wants a boo. NOISE, not
shipped.** Mocking Blow gets +N "if you've been booed this turn"; 15 of its swings came before any boo
in 28 games. `judge.wantsBoo` + `judge.heroBoos` (`experiments/H19-lyath-boo-first-NOISE.patch`)
moved the boo first: "no boo this turn" 15 -> 0, damage per swing 1.8 -> 2.1, but wins [4,3,6,4,6,2]
(4.2) -> [5,3,4,5,7,4] (4.7) at 6 seeds. The ability's {r}{r} is paid by a pitched card either way.

**H18 (policy, Blaze/Iyslander): an amp-only ability waits for an arcane card to take it. CONSISTENT
PAIRED GAIN, interval rule NOT met; queue for the next policy release.** Found by the CEO tracing
Blaze on H12+H13+H14a. With no attack in hand the gear fallback runs before the non-attack branch,
so Crucible of Aetherweave ("the next card you play this turn with an arcane damage effect … plus
1") was activated FIRST every turn, pitching a card. On turn 3 (Blaze v Dorinthea seed 0) it pitched
Emeritus Scolding, the arcane card, to amp an Arcane Polarity that deals none.
- **The rule:** `judge.abAmpTakers(g, seat, uid)` answers null unless the piece's whole payout is
  `amp`, else its effective cost and the arcane cards (`arcaneOf > 0`) in hand and arsenal. The
  fallback holds it unless the seat can pay BOTH the ability and one taker out of floating plus the
  rest of the hand. v5.38's `grantOK` (a pure grant waits for its taker), one route over.
  Patch: `experiments/H18-amp-takers.patch` (on top of the combined H12-H14a tree, `SPX4`-gated).
- **Measured at 12 seeds, own seat:** Blaze [1,2,5,1,4,3,2,4,8,1,2,1] (2.8) ->
  [2,3,5,3,6,2,6,6,7,5,2,4] (4.3), paired +1.4 (8 up, 2 down, 2 level; paired t about 2.8).
  Iyslander [5,4,8,5,7,3,4,7,6,4,2,6] (5.1) -> [7,7,9,4,8,5,6,7,4,7,8,5] (6.4), paired +1.3 (8 up,
  3 down; t about 2.1). Min/max intervals overlap for both.
- Ship it with the next policy release on the principle and the call: today "[Hero]'s call" tells the
  player to pitch their damage card for an amp nothing will take. Give the held case no key (it is
  simply not proposed); the activation keeps `gearAbility`, or better "Amp it. An arcane card follows."
- Drills: Crucible with only a non-arcane card left is not activated; with an affordable arcane card
  it is, and the arcane card then deals +1; Spellfire Cloak / Talismanic Lens are unaffected.

**S15 (engine): Display Loyalty's granted rider and the Fealty token it creates. Fai's deck. Weaker
than printed, visible in the audit.** Found by the CEO in a refreshed `npm run audit` on v5.49 (the
committed AUDIT.md still reads v5.01; refresh it with the next release).
- Display Loyalty prints "If you control 2 or more Draconic chain links, this gets go again and
  \"When this attacks a hero, create a Fealty token.\"" The head (`drac2` -> `ga`) reads; the rider
  is `fx.quotedUnread`, refused on purpose at v3.10 ("triggers on *attacks* rather than hits").
  It is the LAST unread quoted rider in the pool.
- The machinery exists now: a condition entry carries `atkHero` (v3.46), and the condition loop runs
  an attack's conditions at declaration, which is when a granted "when this attacks a hero" fires.
  So the rider is one more `{cond: "drac2", op: <token Fealty>, atkHero: true}` entry.
- **Build Fealty with it, or not at all** (v3.72: building a source makes what it creates
  reachable). Fealty reads `none` today: "Instant - Destroy this: The next card you play this turn
  is Draconic" and "At the beginning of your end phase, if you haven't created a Fealty token or
  played a Draconic card this turn, destroy this." Without the clock a Fealty sits in the arena
  forever. The grant is for the next CARD (not attack) and must be spent by it (v4.06's `dracNext`
  lesson). `hist.playTy` already records the structured types, Draconic included; "created a Fealty
  token this turn" needs a record of its own.
- The AI never activates an arena ability (v4.47), so the ladder will barely move; the human playing
  Fai gets the printed card. Drills: the rider fires only at 2+ Draconic links and only at a hero; the
  token's ability makes the next card Draconic once; the clock keeps it while the condition holds
  and destroys it when it does not.

**S13. SHIPPED as v5.47 (`91fb2ba`), CEO-verified 2026-10-26:** 3705 drills, 0 fail, 5 skipped;
scenes 107/0; both babel blocks compile; 21 engine scripts + `.nojekyll` in the pushed commit; CI
and Pages green. Ladder at 3 seeds byte-identical to the CEO's H8+S13 measurement
(`full-s13b`), 0 refusals / 0 violations / 0 stalls. The trainer's box is labelled "Coach's call"
and still runs `advise`, because `sparring.explain` needs a judge state and the trainer's seat 1 is
the tuned `[3,4,5]` dummy. The table's box is "<Hero>'s call".

**S13 (original item). "[Hero]'s call": the advisor box says what the hero AI would do in your seat. UI + sparring
(v5.46).** RULING (user, 2026-10-25): *"Instead of 'Claude's call' replace it with '[kayo]'s call'
which tells the player what the hero ai would do in each situation."*
- **The call is the policy, run for the player's seat.** At the table (local sessions, seat 0, the
  same gate the Advisor has today at `index.html:7380`), the box runs `sparring.act(g, mySeat)` and
  says that action in words. The AI seat across the table runs the same function, so the box and the
  opponent cannot disagree about how the AI plays. It reads nothing the player cannot see; the policy
  is already held to that.
- **One body: `sparring.explain(g, seat)` → `{action, line, why}`.**
  - `action` is exactly what `act` returns. A drill drives self-play and asserts
    `explain(g,s).action` deep-equals `act(g,s)` on every state.
  - `line` names the action with card NAMES only, and names are not card text. It is the imperative
    addressed to the player: "Play Bare Fangs", "Pitch Wild Ride", "Block with Predatory Plating",
    "Swing Mandible Claw", "Use Kayo's ability", "Put Bare Fangs in your arsenal", "Boost it",
    "Opt: keep all three on top", "Pass", "End your turn".
  - Every action type the policy can emit has a line. Census it both ways: drive self-play over the
    ladder seeds, collect every `a.t`, and fail on any type with no line.
- **`why` is the branch that decided, never a guess written afterwards.** `act` gains an OPT-IN
  note out-param (v3.58), `act(g, seat, o, note)`, and each branch sets `note.why` to a key. The
  keys and their sentences live in one table beside `act`. Measured branches, each with a reason
  the code already states:
  - **pending:** the cheapest pitch that covers the cost; boost when half the remaining deck pays
    for it (H3); the lowest-pitch charge (v4.99); declining a price it cannot weigh (v4.24).
  - **prompt:** decline what is optional; take the printed minimum; keep an opt's order.
  - **arsenal:** the biggest attack goes face down.
  - **defend:** blocks to stay out of lethal; takes up to N rather than spend a card; equipment
    first, because iron wears instead of leaving.
  - **offence:** a non-attack that keeps the action point goes first (H2); arcane first (H5); the
    go-again chain (H4); charge, then swing the pumped weapon (H6); the biggest affordable attack;
    an ally that dies to this swing (v3.81); non-attacks last (v3.80).
  - **reaction:** the cheapest legal reaction, one per link.
  - **nothing to do:** pass or end the turn.
  - Each sentence is coach-voiced and plain, with no version numbers and no identifiers.
    `test/noopvoice.test.js`'s rules apply.
- **Waiting is a call too.** When the seat cannot act (`act` returns null), the line says who holds
  priority: "Dorinthea is deciding."
- **The label.** "✦ Kayo's call", taken from the seat's hero name before the comma, as the rail's
  `them.name.split(",")[0]` does. `build.js:815`'s turn-one read is "Kayo's read", and
  "Claude's read" goes with it.
- **The trainer cannot run the policy** (its state is `mode`/`bphase`, not the CR machine). It
  keeps `advisor.js`, relabelled "✦ Coach's call", so no box claims to be the hero AI where it
  is not. The CEO reports that choice to the user. A drill: the string "Claude's call" appears
  nowhere in `index.html`.
- **THE ENGINE HALF IS BUILT AND MEASURED (CEO, 2026-10-25):** `experiments/S13-explain-H11.patch`,
  402 lines over judge.js, sparring.js and speccensus, REBASED onto v5.46 (`97b4b75`): it applies cleanly,
  the suite is 0 fail, and the ladder is identical to the prototype.
  - `sparring.explain(g, seat)` returns `{action, key, why, line}`. A module-level `NOTE` is set
    only inside `explain`, and every return site calls `tag(key, action)`, so `act` alone is
    unchanged. The reason table is `sparring.CALL_WHY`, 46 keys. `BY_TYPE` gives the reason for
    a site a drill pins verbatim (`addPay`).
  - **Checked by `experiments/S13-explain-check.js <tree>`.** Over 30 self-play games and 15,076
    states, for both seats: 0 mismatches between `explain(...).action` and `act(...)`, 0 actions
    without a reason, and 0 with no line. Make it a drill. Eleven keys are not reached by that
    sample, which is expected.
  - **Names that collide with the guards were renamed:** `allyAttack` is a banned parser name, and
    `WHY` is read as a bare call in index.html's prose. Keep `CALL_WHY`.
  - **H11 is folded in, because the call shows this branch to the player.** The gear fallback
    activated any legal equipment ability, so Blossom of Spring, Garland of Spring and Predatory
    Plating were destroyed for {r} at the end of a turn with nothing to spend it on.
    `judge.abPieceForRes` holds a self-destroying ability whose whole payout is resources. A blunter
    first draft also blocked Beckoning Haunt's aura return, and the census showed it (`xPay` left).
    - The full ladder with H8+H11 is 0/0/0, and every hero's interval overlaps H8 alone.
    - The census swaps its `keepTop` leg to `fs-5-0-1` (Azalea v Kayo, Kayo's chair first). The
      suite is 0 fail.
  - **What is left for the Shipper:**
    - the drills: equality over self-play, every action type has a line, the reason sentences
      under `noopvoice`'s rules, and sabotage of `tag` sites;
    - the UI: the box label, the table wiring, the trainer relabel and the "Claude's call" absence
      drill;
    - the phone drive.
- **Drive it on the phone page at 393x852:**
  - Kayo v the AI: the box updates on every state, at the action phase, the defend step, a pitch
    payment, an opt sheet and the arsenal step.
  - Doing what the box says never meets a refusal.
  - The ladder is byte-identical (the note out-param is unused there). Run it to prove that.

**H9 (Azalea): a CLEAN NEGATIVE.** CEO-measured on v5.44 with H8 applied, 3 seeds.
- **The lead.** Azalea's hero ability, her engine, is used 26 times in 28 games. The policy proposes
  a hero ability after every attack, and once her arsenal arrow has been shot the ability has
  nothing to put on the bottom. She takes 38 "no aim counter" misses, and Crow's Nest is offered
  19 times.
- **The experiment.** An action-speed hero ability whose own go again is unconditional goes before
  the attack. The reader is `heroKeepsAP`; Azalea and Bravo qualify, and Boltyn's attack-reaction
  ability does not.
  - Always first: Azalea [2,3,4] -> [0,1,2], WORSE, because it cycles away the arrow she would
    have shot. Bravo [7,2,7] -> [7,1,7].
  - Only when the arsenal card is not a legal attack: Azalea [2,2,4], Bravo [6,2,5], both noise.
- Nothing ships. Her gap is still open: aim counters, and the 185 arrows she blocks with
  from hand, are the next leads.

**H7b (Blaze) re-measured after S9, on H8: overlapping, not shipped.** Playing the card Blaze's
ability banishes "this turn" (the H7 patch's `playNowPick` and banish play):
- 6 seeds: [3,2,5,3,6,3] (3.7) -> [5,5,6,6,9,4] (5.8). The intervals overlap at [4,6].
- H7's stricter "reactions only on the opponent's turn" hold adds nothing on top of H8
  (identical numbers).
- The same patch without H8, on v5.44: [5,2,3,1,4,2] (2.8) -> [7,5,5,7,10,5] (6.5). The intervals
  touch at 5.
- Recorded rather than shipped, under the standard every H item has met.

**H10 (Bravo): noise, not shipped.** CEO-measured on H8, 6 seeds.
- **The lead.** He deals 1.4 a swing (8.4 power into a 5.9 wall) and uses his hero ability 18
  times in 28 games. The ability flips a face-down arsenal card, and one with crush gets +2{p} and
  dominate.
- **The experiment.** Flip first when the arsenal is face down, then attack with the card stamped
  this turn.
  - It fires: ability uses 18 -> 75, damage per swing 1.4 -> 1.9.
  - Wins [7,2,7,7,4,2] (4.8) -> [5,1,7,8,6,3] (5.0), overlapping.

**H8+.** One gap at a time, one investigator at a time, each rebased on the latest release.
Waiting, by the v5.44 ladder: Bravo (8.7), Gravy (10.3, 7.7 under H8); Lyath has H8, Azalea H9 and Blaze H7b are recorded;
then Blaze again after S9. **Order: H12 + H13 + H14a (one policy release; feed 19-20 shipped v5.48, S14 v5.49), then S15,
then the next census lead, one at a time.**

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

**Items 11–18 SHIPPED** in v5.28 (11–15) and v5.29 (16–18); CEO-checked against v5.44 source on
2026-10-25. **19 and 20 SHIPPED as v5.48 (`9f8f20a`), CEO-verified 2026-10-26** (3709 drills, 0 fail,
5 skipped; CI green; ladder byte-identical to v5.47). The feed batch is closed.

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
19. Deploying an ally prints `<ally>: the weapon's attack — its cost is paid when it swings.`
    (CEO, 2026-10-24, from the H4 investigation.) It is `parser.js:721`'s noop reason for
    every `Action - …: Attack` line, and `classifyClause` cannot see the card's type.
    - Measured over the pool, 26 cards carry it: 10 allies, 13 weapons, Bait (a token aura) and
      Teklovossen.
    - It reaches the feed only on an ally DEPLOY, because weapons are equipped, never played, and
      tokens are minted. That is the 10 allies, for example Riggermortis (Gravy Bones v Dorinthea,
      seed 0, turn 5).
    - Fix: one neutral wording true of both, such as `its attack — the cost is paid each time it
      attacks`. No drill pins the string (`grep "weapon's attack" test/` finds only an unrelated
      test title). `noopvoice.test.js` holds the voice.
20. A Compass of Sunken Depths go again does not name the Compass (CEO, 2026-10-25, from the S11
    report). Playing Limpit from the graveyard with the Compass equipped prints "Go again — action
    point kept." with no source.
    - The Shipper read it as an engine defect ("an ally from the graveyard keeps its point"). Measured,
      the engine is right: with the Compass the point is kept (1 -> 1), and without it the point is
      spent (1 -> 0). Repro: `node experiments/S11-limpit-compass.js <tree>`.
    - A line that leaves out its source reads as a bug even to us, so name the grant's source, as
      `heroAbilityName` does for hero triggers (v5.08): "Compass of Sunken Depths: the first
      watery-grave card from the graveyard this turn goes again."

21. **Grant lines lowercase printed class names and hide the rider** (CEO, 2026-10-26, reading v5.49
    self-play feeds). `parser.qualLabel` joins `qual.g` as stored, so the feed prints "Next draconic or
    ninja attack action card +3." (Rise from the Ashes), "Next runeblade attack", "Next pirate ally
    attack", "Next lightning or elemental attack". The cards print the class capitalised ("Draconic or
    Ninja"); subtypes such as arrow and dagger are lowercase in rules text too, so capitalise only
    the CLASS and TALENT words (`ACTION_CLASSES` and the talent list are the vocabulary).
    - `effects.riderWords` falls back to ", and a granted ability" for any rider it cannot name, so
      Yo Ho Ho! and the Loot cards print "Next pirate ally attack, and a granted ability." Name the
      quoted rider's own words, or say what it does ("…, and its hit makes a Gold token").
    - "Next attack if it is blue +N." (Flying High) reads backwards; "Next blue attack +N" or
      "Next attack +N if it is blue".
    - Voice only. `effects.js:1658` is the line, `parser.js:4086` the label.

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

- **ANSWERED 2026-10-31 and SHIPPED as v5.55:** *"Yes, an attack counts its own chain link."*
  **R5 (asked 2026-10-31, CEO). Does an attack count ITS OWN chain link?** Fai's "If you control 2
  or more Draconic chain links" cards (Cinderskin Devotion, Display Loyalty, Hot on Their Heels,
  Phoenix Flame, Enflame's rungs, Searing Emberblade's static) are read at declaration against
  `parser.dracLinks(chain)`, and the asking attack is not on the strip yet (`linkPayload` pushes
  it). So the SECOND Draconic attack in a row does not get go again; the THIRD does. Driven
  (`effects.execute`, Cinderskin/Display Loyalty/Enflame, 0/1/2 prior Draconic links): `ga` false,
  false, true. Against it: the user's ruling of 2026-07-25 ("the first attack each turn is chain
  link 1"), and the engine's own Rupture reader (`chainLinkGe`), which counts `chain.length + 1`.
  If the attack counts itself, the fix is one reader (`dracLinks` plus a Draconic `pend`) and every
  `dracN` gate, Fai's discount and Mounting Anger's bound move with it; Fai gets markedly stronger,
  so it ships with a ladder at 3+ seeds. No CR quote in the repo; do not build until ruled.
- **Latent, synthetic only (CEO, 2026-10-31):** a quoted rider whose payload is "gain 1{h}" is
  RELOCATED: `"…this gets go again and \"When this attacks, gain 1{h}.\""` parses as `{drac2, life 1}`
  with the go again lost and no `quotedUnread` flag (a loose life matcher claims the sentence ahead
  of the "gets go again and" branch). No pool card prints it; `npm run unanchored` only walks the
  pool. Record, don't build.

- **ANSWERED 2026-10-31, see R2-R4.** **Where does a card played from the banished zone go after it resolves?** The graveyard, or
  back to banish? Blaze's ability, Pouncing Paws' Crouching Tiger, Mounting Anger and Rising
  Resentment grant "you may play it this turn" from banish, and none prints a destination. The
  engine files it back into banish (`effects.js:~5433`, `fileAttack`), and the repo has no CR quote
  either way. S9 closes the replay loop without deciding this. Asked 2026-10-25.

- ~~**May the AI pilot a hero?**~~ **RULED 2026-10-18, see v4 at the top.** Original note: (Stage §8.3.) RULING 2026-08-16 says a seat the dummy fills is
  always the vanilla pile (CLAUDE.md:12059). The Stage design's vs-AI tiers, its L9 lesson
  and AI-vs-AI exhibitions need a hero-piloting AI. Asked 2026-10-17.
- **ANSWERED 2026-10-31, see R2-R4.** **Unity and a defence reaction from hand.** Unity prints "When this defends together with
  a card from hand". `handDefenders` counts declared hand cards (`blockH`) only, so a defence
  reaction played from hand later does not lift it (44 times at 3 seeds). Timing says that is
  right; v5.21's rule (every count of a wall sees a played reaction) points the other way.
- **ANSWERED 2026-10-31, see R2-R4.** **Is the soul hidden?** Not sourced in the repo. If it is, "`X charges <card> into X's
  hero's soul`" (`effects.js:1099`, 127 lines), "`<card> goes from the hand to the soul`"
  (`prompts.js:1218`) and Banneret's pay-off line (`effects.js:1647`) name hidden cards too.

- ~~**Mark never expires.**~~ **RULED 2026-10-14, see R1.** Original note: Nothing clears `marked` once it is set (`sides.js:171` is the only
  `false`), so Arakni's Agents and Black Widow / Funnel Web riders keep reading it for the
  rest of the game. The repo has no sourced rule for when a mark ends. Ask the user.
