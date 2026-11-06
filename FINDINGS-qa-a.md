# FINDINGS — QA reader A (v5.85, `0004032`)

Read-only audit, 2026-11-02. Heroes: **arakni, azalea, blaze, boltyn, bravo, briar, dash, dorinthea**.

## Coverage

All 8 heroes are covered at the TABLE (3 games each). The TRAINER page drives (2 games x 2 heroes)
are **NOT COVERED** beyond the smoke check and one incomplete Dorinthea drive (see PAGE). Bravo's
`bravo enigma 51` (815 lines) and `bravo viserai 53`, `boltyn gravy 41`, `boltyn kayo 43`,
`briar boltyn 62`, `briar iyslander 63`, `dash azalea 72`, `dash gravy 73` and `arakni enigma 13`
were checked by scanning the rare lines and life deltas, not read line by line.

## Method

- **Table:** 24 full self-play games (3 per hero) through `tools/selfplay.js`, every game to a life
  win (no stalls, 0 policy refusals, 0 invariant violations, 0 NO-ZONE). The hero's seat is Sharp
  (`LA.seats` = hero key, i.e. `SPXLA=<hero>`, search settings at their defaults); the other seat is
  Sharp in game 1 of each hero and Steady in games 2 and 3. Every feed was read against
  `data/pool.js`. Doubtful lines were re-driven: the state was replayed to the decision and the
  engine was asked directly (`judge.legal`, `sparring.act` with `{search:true|false}`, `explain`,
  life, zones).
- **Driver** (not committed; copy it into a scratch dir to reuse). `run.js hero opp seed first sharpOpp out`:
  `SP.LA.seats=[hero(,opp)]; g=S.match(hero,opp,seed,first); S.play(g,4000,{timeline:true})`.
  Games (hero opp seed first sharpOpp):
  `arakni kayo 11 0 1 · arakni dorinthea 12 1 0 · arakni enigma 13 0 0 · azalea viserai 21 0 1 ·
  azalea briar 22 1 0 · azalea lyath 23 0 0 · blaze iyslander 31 0 1 · blaze bravo 32 1 0 ·
  blaze fai 33 0 0 · boltyn gravy 41 0 1 · boltyn dash 42 1 0 · boltyn kayo 43 0 0 ·
  bravo enigma 51 0 1 · bravo arakni 52 1 0 · bravo viserai 53 0 0 · briar fai 61 0 1 ·
  briar boltyn 62 1 0 · briar iyslander 63 0 0 · dash lyath 71 0 1 · dash azalea 72 1 0 ·
  dash gravy 73 0 0 · dorinthea blaze 81 0 1 · dorinthea bravo 82 1 0 · dorinthea kayo 83 0 0`.
  "Tn" below is `game.turn`.
- **Page:** `node tools/page.js` (offline, deps in a scratch dir): **65/65 screens clean, 0 page
  errors.** Trainer games: see the PAGE section.

## Counts

| class | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| S | 0 | 2 | 2 | 0 |
| H | 0 | 2 | 3 | 0 |
| FEED | 0 | 0 | 1 | 3 |
| RULING | — | — | — | — (2 questions) |
| P | 0 (trainer drives NOT COVERED — see PAGE) |

---

## S — state defects

### S-1 · P1 · dominate does not count a defence reaction played from hand
**Heroes:** azalea, bravo (attacker); arakni, viserai (defender). Every dominate attack in these
games that met a hand-played defence reaction got two hand cards against it.

**Text.** TORCH.md: *"Dominate — defender can't defend with / play more than 1 defending card or
defense reaction from hand this chain link."* Azalea: *"…If it's an arrow, it gets **dominate**
until end of turn."* Bravo: *"…If it has crush, it gets +2{p} and **dominate** this turn."*
Pulping: *"…If a card with 6 or more {p} is discarded this way, this gets **dominate**."*

**Repro (driven with the engine).** `arakni kayo 11 0 1`, T16: Kayo's Pulping *"gains dominate"*
(`pend.defCap = {n:1, count:"hand"}`). Arakni declares Spike with Bloodrot from hand
(`blockH=[30]`). Now `judge.legal(defend Mark the Prey)` refuses, but
`judge.legal({t:"play",uid:15 /*Lair of the Spider, in HAND*/})` returns **null** (legal). Lair is
played, and the wall is *"Spike with Bloodrot 3, Lair of the Spider 3 — stops 6"*: two hand cards.

Other instances in the same 24 games:
- `azalea viserai 21 0 1` T5: Drill Shot *"came out of the arsenal with dominate"*. Viserai declares
  Shrill of Skullform, then plays Sigil of Suffering from hand: *"Wall of 7 — Shrill of Skullform 3,
  Sigil of Suffering 4"*.
- the same game, T7 (Infecting Shot: Condemn to Slaughter + Reduce to Runechant) and T13
  (Entangling Shot: Shrill of Skullform + Reduce to Runechant).
- `bravo arakni 52 1 0` T4 (Cartilage Crush: Shred + Inertia Trap) and T8 (Chokeslam: Spike with
  Bloodrot + Den of the Spider).

**Fix area.** `parser.defCapWhy` is asked only on the declare route (`judge.legal`, the
`a.t==="defend"` branch at about line 1029; trainer `index.html:5319`). The play route for a defence
reaction in the reaction step must ask the same cap, counting `rxDefenders(sd).fromHand` beside
`blockH`. Check both boards.

### S-2 · P1 · Sadistic Scowl's "Intimidate target hero" does nothing at the table, and says "the dummy"
**Hero:** Lyath (seen in `azalea lyath 23 0 0`).

**Text.** Sadistic Scowl: *"Your next attack this turn gets +5{p}. / **Intimidate** target hero. /
**Go again**"*.

**Repro.** `azalea lyath 23 0 0`, T8. The feed reads *"Sadistic Scowl: live — the dummy loses a card
at random when this attacks."* Afterwards Azalea's hand still holds all 4 cards (Lace with Frailty,
Widowmaker, Ravenous Rabble, Murkmire Grapnel) and `sides[0].intimidated` is `[]`. Titan's Fist then
attacks into a full hand.

**Cause.** `parser.js:3727` reads the clause as a `NOOP`, and the noop's text describes the trainer
dummy. The real intimidate (`effects.js:5217`, `hasKw(card,"intimidate")`) runs only inside the
attack-declaration branch, so it fires for an attack that carries the keyword and never for a
non-attack action that prints "Intimidate target hero". **Fix area:** parser.js:3727 → a real op
(the same random face-down banish, returned in the end phase) on the play route. Also remove "the
dummy" from table text (see FEED-1).

### S-3 · P2 · Arakni's stealth/marked +1{p} is fixed at declaration, so a mark that arrives (or leaves) mid-link is ignored
**Hero:** arakni.

**Text.** Arakni, Web of Deceit: *"Your attacks with **stealth** that are attacking a **marked** hero
get +1{p} and "When this hits, this gets **go again**.""* This is a static ability, so it should be
read continuously. Prey Spotters: *"**Attack Reaction** - Destroy this: **Mark** target opposing
hero."*

**Repro.** `bravo arakni 52 1 0`, T1. Arakni plays Infect (stealth, 3), plus Night's Embrace (+1),
and Bravo blocks with Fault Line (3). Prey Spotters then marks Bravo during the reaction step:
*"Bravo, Flattering Showman is marked"*. Infect *"resolves for 1"*; Bravo's life goes 19 → 18. With
the hero's +1 it would be 5 power, 2 damage, and a go-again rider. The reverse also happens:
`arakni dorinthea 12 1 0` T2 declares Mark of the Funnel Web at +1 while marked, and then Danger
Digits' hit removes the mark (*"Dorinthea is hit, and the mark wears off"*). The +1 stays (that
board re-marked with Prey Spotters, so the total came out right there by luck).

**Cause.** `effects.js:4686–4713`: the comment says *"THREE GATES, ALL SETTLED AT DECLARATION … the
mark is already on the opposing hero"*. With Prey Spotters and Danger Digits in Arakni's own deck,
that is not true. **Fix area:** read it as a late/continuous condition at damage (as other "if …"
pumps are read), or mark it RULING if the user wants declaration-time.

### S-4 · P2 · "they lose N{h}" is parsed as damage (preventable, and it reads "N damage")
**Heroes:** azalea (Searing Shot), arakni (Tarantula's *"they lose 1{h}"*).

**Text.** Searing Shot: *"When this hits a hero, they lose 1{h}."* Life loss is not damage, so
ward and prevention should not apply to it.

**Where.** `parser.js:2333`: `/^(?:they|the defending hero|target hero) loses? (\d+)\s*\{h\}$/ →
["dmg", N]`. `effects.js:2482` runs `dmg` through `preventDamage`. The feed says *"Searing Shot: 1
damage."* (`azalea briar 22 1 0` T12, `azalea lyath 23 0 0` T7). It did not change a life total in
these games, because the on-hit ward was always already spent: prevented combat damage is not a
hit, so leftover ward cannot be present at an on-hit. A source-chosen ward (Oasis Respite *"by a
source of your choice"*) or a damage-watching trigger would see it. **Fix area:** a `loseLife` op
that skips `preventDamage` and damage triggers, with its own feed verb.

---

## H — AI blunders

### H-1 · P1 · Sharp throws away a known, playable arrow with Azalea's ability after loading it with pumps
**Hero:** azalea (Sharp only; Steady plays the arrow).

**Repro 1.** `azalea viserai 21 0 1`, T9. Azalea is at 8 and Viserai at 13. Take Aim (Reload puts
Ridge Rider Shot, cost 0, into the arsenal), Lace with Bloodrot, then Call in the Big Guns: three
grants on the next arrow, which would be **13 power**. Then the hero ability sends Ridge Rider Shot
to the bottom and flips Scout the Periphery (not an arrow). End of turn: *"Azalea: 3 unspent "this
turn" grants expire"*.
At the decision: `act(g,0,{search:false})` = `play Ridge Rider Shot from arsenal`;
`act(g,0,{search:true})` = `activate hpow`, with the reason *"Start with this. Play each opening out
to the end of your turn and this one lands the most damage once they block."* (`laHit`). Driven,
the arrow line deals 3 and leaves a Bloodrot Pox: Viserai 13 → 10.

**Repro 2 (same shape).** `azalea lyath 23 0 0`, T3. Ridge Rider Shot is face-up in the arsenal
(placed by Death Dealer), and Nimblism, Call in the Big Guns and Drop the Anchor are all played.
Then the ability bins it and flips Take Aim: *"3 unspent grants expire"*. Steady = play the arrow;
Sharp = `hpow`.

**Read.** The search samples the deck top once (`dets: 1`) and scores a flip into an arrow with
dominate above a certain 13-power swing. **Fix area:** `sparring.laSearch` / `laCands`: never
score the hero-ability flip over playing the arsenal card it would bin, or average over more than
one determinization when a candidate reveals hidden information.

### H-2 · P1 · Dorinthea passes with an action point, Blossom of Spring and an unswung Dawnblade while +3 waits for it (opponent at 4)
**Hero:** dorinthea (Steady seat in `arakni dorinthea 12 1 0`). T17: Arakni is at 4 and Dorinthea
at 1. Hand Scar for a Scar + Agile Engagement, Warrior's Valor in the arsenal, gear Blossom of
Spring + Dawnblade. She plays Warrior's Valor (*"next WEAPON attack +3"*), then attacks with Scar
for a Scar (not a weapon), so the Agility go-again goes to it. Then she ends the turn at
**ap 1, res 0** with Blossom of Spring unused. Driven: Blossom (+1, go again) then Dawnblade =
**6 power** at a 4-life Arakni. It forced Mark of the Black Widow + Orb-Weaver Spinneret into the
wall, which are the cards Arakni killed her with next turn (T18: Black Widow + Two Sides = 6 into
1 life). **Fix area:** `sparring` turn planning: a weapon grant that is pending should rank the
weapon swing (and the equipment that pays for it) before ending the turn.

### H-3 · P2 · Dorinthea never destroys Refraction Bolters for go again, so her hero's second swing is never taken
**Hero:** dorinthea. **Text.** Refraction Bolters: *"When a weapon attack you control hits, you
may destroy this. If you do, the attack gets **go again**."* Dorinthea: *"The first time your
weapon attack hits each turn, you may attack an additional time with that weapon this turn."*
Declined **16 of 16** times across 4 games. Repro: `arakni dorinthea 12 1 0` T1. Dawnblade hits,
1 resource is floating, and the prompt is declined (`payNo`: *"Don't pay. It isn't worth the
cards."*). Then *"(e) 1 floating resource(s) fizzle."* Driven with `pay`: go again → second
Dawnblade swing → 3 more damage **and** the +1{p} counter (*"Dawnblade connects again — a +1{p}
counter is forged onto it"*). Arakni ends at 14, not 17. The same pattern recurs at T5, T11 and
T13. The reason text is also wrong: the cost is a piece of equipment, not cards (FEED-3).
**Fix area:** `effects.payPolicy`'s destroy-cost branch / sparring's `payNo`.

### H-4 · P2 · Arcane-barrier soaks pitch a whole card to stop 1 damage
**Heroes:** azalea (Bull's Eye Bracers), blaze (Spellfire Cloak), and the same for the opposing
Iyslander. **37 soak lines** in the 24 games, almost all *"soaks 1 of N … Pitched <card> at instant
speed"* with 0 floating. Examples: `azalea viserai 21 0 1` T2 (Drop the Anchor and Nimblism pitched,
one Runechant point each) and T6 (an **arrow**, Drill Shot, pitched for 1). `blaze iyslander 31 0 1`
T3 (Iyslander pitches a blue Winter's Bite, +3, to stop 1). **Cause:** `effects.soakPolicy`
(about line 11313) weighs `o.cost` in resources against the points soaked. Pitching a card on the
opponent's turn wastes the rest of the pitch and the card. **Fix area:** soakPolicy should price a
pitch as a card (as `payPolicy` does) unless the damage is lethal.

### H-5 · P2 · Bolt'n Boots spent to give go again to an arrow that already has it
**Hero:** azalea. **Text.** Bolt'n Boots: *"**Attack Reaction** - {r}, destroy this: Target arrow
attack with {p} greater than its base gets **go again**."* Bolt'n' Shot: *"If this card's {p} is
greater than its base, it gets **go again**…"*. Swift Shot: *"When this is put face-up into your
arsenal, it gets go again this turn."*
`azalea briar 22 1 0` T10: Bolt'n' Shot is at 7 (printed 4). Boots are destroyed and Infecting Shot
is pitched to pay, and then the feed says *"Bolt'n' Shot: pumped above base — go again!"*.
`azalea lyath 23 0 0` T1: Swift Shot *"goes face up — it will go again this turn"*, then Boots are
spent on it anyway. **Fix area:** the reader the AI asks before a go-again reaction should report a
link that already has (or will have) go again.

(Not re-filed: Boltyn's Glisten dying on a non-weapon link is QUEUE H25, measured negative.
Blaze activating its hero ability and choosing nothing every turn is harmless, because no action
point or counters are spent.)

---

## FEED

### FEED-1 · P2 · table feed says "the dummy"
*"Sadistic Scowl: live — the dummy loses a card at random when this attacks."* (`azalea lyath 23 0 0`
T8, a table game with no dummy). It is also untrue (S-2). Source: `parser.js:3727`.

### FEED-2 · P3 · noop self-descriptions read as engine internals at resolution
These are printed when an attack resolves, and they leak implementation language to the player:
- *"Zipper Hit: printed keyword — carried by the engine's keyword system."* (Dash, on every boost
  attack's resolution)
- *"Thunder Quake: printed keyword — offered at the arsenal step, when the card can be heaved."*
- *"Rune Flash: a cost reduction — taken off the price when it is played."*
- *"Rally the Coast Guard: a condition on the ability — it can only be used when that holds."*
- *"A Drop in the Ocean: deckbuilding marker — one copy per deck."*
- *"Mark of the Funnel Web: qualifier only — other cards check an attack for it."*

"The engine's keyword system" is the worst of them.

### FEED-3 · P3 · grouped-source prefixes and duplicated lines
- One trigger's damage is named after two tokens: *"Bloodrot Pox, Frailty: 2 damage — Lyath
  Goldmane to 4{h}."* (`azalea lyath 23 0 0` T8 end). There is also *"Bloodrot Pox, Bloodrot Pox:
  2 damage"* printed once per pox (`azalea viserai 21 0 1` T8).
- *"Flurry pops — Raydn, Duskbane may swing once more this turn."* is printed three times on ONE
  line when three Flurries pop (`boltyn dash 42 1 0` T12).
- *"Boltyn charges X into Boltyn's hero's soul"* should read "into Boltyn's soul".
- "Fully blocked — on-hit effects fizzle." is printed when the damage was prevented by two Toe the
  Line and nothing blocked (`boltyn dash 42 1 0` T7).
- The `payNo` reason *"It isn't worth the cards."* is shown for a destroy-equipment cost (H-3).

### FEED-4 · P3 · "Searing Shot: 1 damage." for a life loss (see S-4).

---

## RULING — questions, not decided here

- **R-a** Arakni's static +1{p} (S-3): should it be read at declaration (the engine) or
  continuously (TORCH's general rule for statics)? Card text is quoted in S-3.
- **R-b** Danger Digits + Mark of the Huntsman: *"…the dagger has hit. Destroy the dagger."* against
  Huntsman's *"When this hits a hero, you may choose to destroy this and **mark** them."* The engine
  says the dagger is already gone, so *"the rider does not resolve"* and there is no mark. That is
  plausible, but it is a rules call.
- Already recorded (not re-filed): Arakni returning to the brood and becoming an Agent again in the
  same end phase (`tools/approx.js`, "waits on a RULING"). Seen at `arakni kayo 11 0 1` T5, T19
  and `bravo arakni 52 1 0` T9.

---

## PAGE

- `node tools/page.js`: **PASS 65/65, 0 page errors, 144.5 s** (offline, routed).
- Trainer games: **NOT COVERED.** The run was stopped to wrap up. One Dorinthea trainer game was
  driven on the page (393x852, offline): it ended over (Dorinthea at -2 on turn 5, Dummy 42) with
  **0 page errors and no stuck state**. My scripted driver could not block or attack, though: the
  board's tiles are labelled by stats ("HAND 1 0 4 2 ATTACK"), not by card name, and the driver
  tapped by name. That was a defect in the probe, not the page, so this game says nothing about
  blocking, pitching or reactions in the trainer. The second Dorinthea game and both Azalea
  trainer games were not run. Next reader: tap `.board` tiles by index (as tools/phone/deadtap.js
  does) and read `state.log` incrementally, because the trainer's `log` is capped (only 8 lines were
  left at the end).
- **P findings: none** (smoke check clean; nothing seen in the one drive).

---

## CLEAN — checked and correct (do not redo)

- Puncture / Out for Blood / Overpower (reprise *instead* +6 replaces +4), Stroke of Foresight,
  Agile Engagement (Agility only when an attack action defends), Warrior's Valor, Hit and Run,
  Goblet of Bloodrun Wine, Lead with Speed, Dawnblade's second-hit counter, Dorinthea's extra swing,
  piercing vs equipment.
- Arakni: Mark of the Huntsman (+1 vs marked, once per turn, go again, Hyper Inflation correctly
  does NOT raise an activation), Danger Digits (non-active dagger, counts as hit, destroyed),
  Prey Spotters, Scar Tissue, Two Sides to the Blade (both modes), Shred (−N{d} for the chain),
  Stains of the Redback, Orb-Weaver Spinneret + Graphene Chelicera, Funnel Web (arsenal banish),
  Black Widow (hand banish), Concoct Disorder (go again only if 2 put; full arsenal counted),
  Redback/Black Widow/Tarantula/Trap-Door swaps and the no-+1 while an Agent, the traps' conditions
  (Lair go again, Den/Inertia pumped above base, Frailty go again), Hyper Inflation cost tax.
- Azalea: hero ability (arsenal to bottom, top face-up, dominate only on arrows), Death Dealer
  (empty arsenal, draw), Bull's Eye Bracers (+1 rider, tap via Entangling Shot), Crow's Nest aim
  payment, Take Aim reload (refused when the arsenal is occupied), Call in the Big Guns (arsenal
  occupied, rest resolves), Scout the Periphery (from arsenal only), Nimblism (cost ≤1), Ravenous
  Rabble's reveal −X, Lace with Bloodrot/Frailty/Inertia riders, Murkmire Grapnel unpreventable,
  Spire Sniping's look.
- Blaze: Crucible/Cindering/Absorb in Aether amp (+1/+2, expiring), energy from opt, Talismanic
  Lens, Voltic Bolt/Turn to Mindfire numbers, Arcane Polarity 1 vs 4.
- Boltyn: charge, his +1 when an attack action defends after a charge, soul-banish go again (only
  when above base), Raydn's +3 when charged, Toe the Line ×2 on one hit (4 prevented, 2 Flurries),
  Flurry's double swing, Glisten counters wiped at end phase, Banneret's solflare life.
- Bravo: hero flip (+2 and dominate on crush), Seismic Surge discount, Chokeslam's crush (Arakni's
  next attack actions can't gain {p}: Black Widow +3 correctly ignored), Pummel both modes and its
  discard rider, Zealous Belting go again from the pitch zone, Sledge of Anvilheim {r}×4, Crash and
  Bash reveal.
- Briar: Embodiment of Earth (+1{d} to non-attack actions) and its turn-start crumble, fusion
  (Entwine, Arcanic Shockwave arcane on attack, Weave's fused go-again), Rush of Power's quickstrike
  denial, Lightning Surge only from arsenal, Cloud Cover's partial prevention.
- Dash: Boost go-again on Mechanologist banish, Re-Charge! +4 to the boosted attack, Boom Grenade
  4 damage on hit, Talishar's rust, Under Loop to the bottom on hit, Out Pace's equipment ban,
  Drag Down's shave.
- Life arithmetic: every hp delta in all 24 timelines checked against "resolves for N" + arcane +
  pox lines; no mismatch found.
