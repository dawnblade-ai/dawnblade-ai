# FINDINGS — QA reader B (v5.85, origin/main 0004032)

Heroes: enigma, fai, gravy, iyslander, kayo, lyath, viserai. Read-only audit.
Wrapped up early on the CEO's instruction (budget): partial coverage, marked below.

**Counts:** S 0 · P 1 (P3) · FEED 7 (P2 1, P3 6) · H 5 (P2 3, P3 2) · RULING 1. **No P0 or P1.**

## How it was driven

Self-play: `tools/selfplay.js` `match(a,b,seed,first)` + `play(g,6000)`, with the hero's
seat on Sharp through `SPXLA=<hero>` (the default LA settings). Second listed hero = the
other seat on Sharp too (`SPXLA=<hero>,<opp>`); otherwise the other seat is Steady.
Driver scripts: `drive.js` (feed dump), `trace.js` (feed plus zone snapshots when a
pattern hits), `passes.js` (every `endTurn` where `judge.reduce` would still accept a
play or activation). They are not committed; each repro below runs on the stock harness.

| game (a b seed first) | Sharp seats | result |
|---|---|---|
| enigma kayo 1 0 | enigma | kayo T34 |
| enigma briar 2 1 | both | briar T15 |
| enigma dorinthea 3 0 | enigma | enigma T25 |
| fai bravo 1 1 | fai | bravo T25 |
| fai azalea 2 0 | both | azalea T10 |
| fai boltyn 3 1 | fai | fai T14 |
| gravy dash 1 0 | gravy | dash T12 |
| gravy arakni 2 1 | both | gravy T30 |
| gravy blaze 3 0 | gravy | blaze T26 |
| iyslander kayo 1 1 | iyslander | kayo T21 |
| iyslander dorinthea 2 0 | both | dorinthea T14 |
| iyslander briar 3 1 | iyslander | iyslander T16 |
| kayo bravo 1 0 | kayo | kayo T27 |
| kayo lyath 2 1 | both | kayo T18 |
| kayo azalea 3 0 | kayo | kayo T11 |
| lyath dash 1 1 | lyath | lyath T24 |
| lyath viserai 2 0 | both | viserai T22 |
| lyath boltyn 3 1 | lyath | lyath T24 |
| viserai fai 1 0 | viserai | viserai T23 |
| viserai gravy 2 1 | both | gravy T35 |
| viserai arakni 3 0 | viserai | viserai T23 |

All 21 games: 0 policy refusals, 0 invariant violations, 0 warnings, 0 NO-ZONE, 0 stalls.

---

## H — AI blunders

### H-1 · P2 · Fai — pays for Crouching Tiger with two equipment pieces, then never plays it
- **Repro:** `SPXLA=fai`, `match("fai","boltyn","3",1)`, Fai's turn 2. Seen in 3 of the 4 Fai
  games: also `viserai fai 1 0` (SPXLA=viserai, Fai on Steady) on turn 2, and
  `fai azalea 2 0` (SPXLA=fai,azalea) on turn 1. Steady and Sharp both do it.
- **Evidence (fai boltyn, T2):** `Fai plays Pouncing Paws — ability` → `Crouching Tiger springs
  into Fai's banished zone — playable this turn`; `Tearing Shuko — ability: Fai's next Crouching
  Tiger this turn gets +2 power`; then Searing Emberblade; then `Fai passes the turn.`
  State at the `endTurn`: Fai `ap=1`, `banish=[Crouching Tiger]`, both pieces in the graveyard.
  `J.reduce(n,{t:"play",uid:<tiger>,from:"banish"},0)` at that moment is **accepted**:
  `Crouching Tiger was primed — +2 power.` `Fai plays Crouching Tiger — 2 power on the chain
  (printed 0), and it goes again.` The call reads `endTurn`, saying "End your turn. Nothing worth
  doing is left." That is wrong advice to show a player, and it is also FEED-1 below.
- **Card text:** Pouncing Paws: "Instant - Destroy this: Create a Crouching Tiger in your banished
  zone. You may play it this turn." Tearing Shuko: "Instant - Destroy this: The next Crouching
  Tiger you play this turn gets +2{p}." Crouching Tiger: 0 cost, 0{p}, Ephemeral, Go again.
- **Engine is right:** on turn 4 the same banished Tiger is refused ("nothing lets it be played
  from banishment this turn").
- **Fix area:** `engine/sparring.js`, the action-phase candidate list. Plays from banish
  (`from:"banish"`) never seem to be offered. Activating Paws/Shuko should also be gated on
  the Tiger actually following.

### H-2 · P2 · Kayo (Sharp) — opens turn 1 by destroying Knucklehead instead of attacking
- **Repro:** `SPXLA=kayo`, `match("kayo","bravo","1",0)`, first decision.
  `SP.explain(n,0,{search:true})` → `Activate Knucklehead`, key `laKeep`, reason "Start with
  this. Played out, it hits as hard as anything else and keeps more cards in hand for their swing
  back." On Steady (`{search:false}`) the call is `Play Rough Up` (`biggestAttack`).
- **Evidence:** `Knucklehead — ability: d6 comes up 1.` `Base intellect is 1 until end of turn`,
  then `Kayo passes the turn.` Kayo deals no damage, has lost a 2{d} head, and has spent its
  only action point. Hand was Bear Hug, Rally the Coast Guard, High Pitched Howl, Rough Up.
- **Card text:** Knucklehead: "Action - Destroy this: Roll a 6 sided die. Until end of turn,
  your base {i} is the number rolled. Temper."
- **Note:** the call's reason says Knucklehead "hits as hard as anything else". It deals no
  damage. With horizon "own", a fully blocked Rough Up scores 0, the same as a non-attack. The
  reason prose overstates the case (FEED-2).
- **Fix area:** `sparring.js` `laSearch`/`laWhy`. Count lost equipment and the variance of the
  intellect gamble, or don't let a tie with zero damage dealt be read as "hits as hard".

### H-3 · P2 · Gravy Bones — pays {r} and Mage Master Boots for a grant that can never be used
- **Repro:** `SPXLA=gravy`, `match("gravy","dash","1",0)`, Gravy's turn 1. Happened in 2 of the
  4 Boots activations across the Gravy games.
- **Evidence:** before the activation: `res=2 hand=[Battalion Barque]` (an attack, cost 4). After:
  `res=1`, Boots in the graveyard. `Gravy Bones passes the turn.` →
  `Gravy Bones: 1 unspent "this turn" grant expires with the turn.`
- **Card text:** Mage Master Boots: "Action - {r}, destroy this: The next non-attack action card
  you play this turn gets go again. Go again"
- **Fix area:** `sparring.js`. Gate the activation on a non-attack action card being playable
  afterwards (hand, arsenal, or the watery-grave graveyard).

### H-4 · P3 · Enigma — turns Uphold Tradition face-up and pays {r} with no ward aura to target
- **Repro:** `SPXLA=enigma`, `match("enigma","kayo","1",0)`, Enigma's turn 3.
- **Evidence:** `Pitched Astral Etchings for 1.` `Uphold Tradition is turned face-up`, then
  `Uphold Tradition — ability: Enigma controls nothing that can take a +1{p} counter.` Board was
  empty. Enigma's whole turn was this plus Preserve Tradition (see RULING-1), then a pass.
- **Card text:** Uphold Tradition: "Cloaked. Instant - {r}, turn this face-up: Put a +1{p}
  counter on an aura you control with ward. Ward 1"
- **Fix area:** `sparring.js`. Require a ward aura before activating it. The parser already
  knows the ability has nothing to land on.

### H-5 · P3 · Iyslander — plays Frost Spike when it can only fizzle
- **Repro:** `SPXLA=iyslander,dorinthea`, `match("iyslander","dorinthea","2",0)`, turn 1.
- **Evidence:** `Iyslander plays Frost Spike.` `Frost Spike: Dorinthea has no exposed armour
  zone — the Frostbite has nowhere to land, and fizzles.` That spent a card for nothing.
- **Card text:** "Create a Frostbite token in an exposed head, chest, arms, or legs zone."
- **Fix area:** `sparring.js`. Skip it when the opponent has no exposed zone; keep it to pitch,
  fuse or block with.

## FEED

- **FEED-1 · P2** — The `endTurn` call "End your turn. Nothing worth doing is left." is shown
  while a free 2-power go-again Crouching Tiger is playable (H-1). The player reads wrong advice.
  `sparring.js` CALL_WHY `endTurn`.
- **FEED-2 · P3** — The Sharp reason for Knucklehead claims "it hits as hard as anything else"
  (H-2). `sparring.js` `laWhy`.
- **FEED-3 · P3** — `Pitched Limpit, Hop-a-long, Swabbie for 4.` These are two cards joined with
  commas, and Limpit's own name contains a comma, so it reads as one card pitched for 4.
  Repro: `gravy dash 1 0`, Gravy's turn 3, `pitch=[Limpit, Hop-a-long, Swabbie]`. Fix: join
  with " and ", or "·", in the pitch line (`effects.js`/`judge.js` pay line).
- **FEED-4 · P3** — `Look Tuff: 1 can't be raised, even by pitching — it takes -1{p}.` The "1"
  is the {r} amount, and the sentence doesn't parse. Repro: `SPXLA=iyslander`,
  `iyslander briar 3 1`, turn 10 (hand empty, so the penalty itself is right).
  `engine/effects.js:4668`. Suggest "Look Tuff: the extra {r} can't be paid — it gets -1{p}."
- **FEED-5 · P3** — `Next arrow attack +3, and if it hits a hero, create a Inertia token under
  their control.` "a Inertia" should be "an Inertia". Repro: `fai azalea 2 0`, Azalea's turn 4
  (Lace with Inertia).
- **FEED-6 · P3** — `Throttle: printed keyword — carried by the engine's keyword system.` (also
  Zero to Sixty, Crankshaft, Big Bertha). It names "the engine" in the shared feed and is printed
  after resolution as if it were an event. Same family: `Spectral Shield: ward 1 — it destroys
  itself to prevent that much damage to its controller.`, printed when a Spectral Shield
  ATTACK resolves, though the shield is not destroyed (it was still on the board afterwards,
  `enigma kayo 1 0`, line ~516). And `Prime the Crowd: Revered is a static talent — nothing to
  resolve.`, where the clause is "the crowd cheers each Revered hero", not a static.
  These are noop lines in the shared feed (`parser.js` NOOP texts).
- **FEED-7 · P3** — Confidence's payout is attributed to the hero: `Lyath Goldmane: the next
  attack action card played this turn can't be defended by more than 2 non-block cards.` It
  comes right after "Confidence crumbles at the top of the turn". Repro: `kayo lyath 2 1` turn 3,
  `lyath boltyn 3 1` turn 16. It should name Confidence.

## P — page

- **P-1 · P3** — Lobby, host side, offline: after "Cannot reach the matchmaking relay — check
  the connection." the status line under the table code keeps a bare `…` beside the error.
  `PHRASE` (index.html ~6881) has no entry for the failed state. There is also no retry
  button: Back is the only way out (Back works, and returns to the roster).

## RULING

- **RULING-1** — Can Preserve Tradition be played with no legal target? Enigma played it
  (`enigma kayo 1 0`, turn 3) with only Test of Strength and On the Horizon (both **Block**
  cards, not actions) in the graveyard. The engine allowed it, moved nothing (deck stayed 42),
  and said only "condition not met (no other blue card played this turn)". Card text: "Put
  **target** action card from your graveyard on the bottom of your deck. If you've played
  another blue card this turn, transcend." Pass Over ("Banish target card from an opposing
  hero's graveyard") is in the same family. Not decided here. If it needs a legal target, it's
  a `judge.legal` gate; if not, the feed should say "no action card to target".

---

## CLEAN — checked and correct (don't redo)

- **Lyath** halving (base {p}/{d} halved, rounded up) on attacks, blocks and Titan's Fist
  (3 → 2). Titan's Fist +1 only with cost-3+ in pitch (Power Play yes; Suspense / Concealed
  Object no). Crowd boos → Might. Hero ability taps and untaps in the end phase. Mocking Blow
  boo and booed bonus (1 +1 Might +4 Villainous Pose +4 = 10). Full of Bravado with two Mights
  (3+1+1+1 = 6). Suspense counters tick and pay out.
- **Viserai** rite (Runechant when a non-attack action is already down). Malefic Incantation
  verse counters ([2] = 2; once per turn on an attack *action* card, not on a weapon swing).
  A Runechant created by Malefic's play trigger does not pop on that same play (correct by
  Runechant text). Reaping Blade life lock. Blade Beckoner Helm +1{d} vs weapon. Reduce to
  Runechant.
- **Fai** hero power cost drops by the number of Draconic links (3 links → free). Brand with
  Cinderclaw's Draconic grant is spent. Phoenix Flame +1 only with 2+ Draconic links. Lava
  Burst rupture needs link 4. Searing Emberblade go again. Fealty stays/destroy rules. A
  banished Crouching Tiger is refused on a later turn.
- **Kayo** +1{p} off the chain (6+ checks in hand, pitch and discard). Might from the first 6+
  discard per action phase. Bare Fangs +2, Wild Ride go again, Pulping dominate and its go-again
  when blocked by fewer than 2 non-equipment cards. Rough Up pitch check. Savage Feast's random
  discard cost. Knucklehead intellect set until end of turn, then back to 4. Beaten Trackers
  prompt (always declined; not judged a blunder).
- **Iyslander** Crucible amp +1, Absorb in Aether amp +2 (Ice Bolt [1] 5+1 = 6). Aether
  Icevein fusion (revealed ice card) and its discard-unless-pay rider. Winter's Bite pay or
  discard. Frostbite +{r} and shatter. Frost Spike exposed-zone rule. Look Tuff penalty with an
  empty hand.
- **Enigma** hero power paid with Chi (3 Chi from Inner Chi). Spectral Shield +1 counter. Cosmo
  makes a ward aura a weapon (ward 1 + 1 counter = 2, go again). Ward soaks on damage. Transcend
  (Homage / Pass Over flip to Inner Chi). Big Blue Sky. Spectral Rider's overpower condition.
- **Gravy** Carrion Crown (ally discard cost). Murderous Rabble reveal + pitch. Compass look.
  Battalion Barque high tide. Watery-grave cards offered from the graveyard. Boom Grenade (on
  Dash's side) 4 on hit.
- **Page:** `node tools/page.js` smoke check 66/66 PASS, 0 page errors. This includes a natural
  table game vs an AI hero won and lost by concession, W-L recorded per hero and level on the
  picker (Lyath 1–0, Iyslander 0–1), the Steady record kept apart, and the "no storage" case.
  Trainer arsenal step: "skip" and the card tap both work (re-checked by hand).
- **Lobby (two pages, offline):** Open a table shows a 4-character code. Join normalises
  lowercase input, disables Sit down for an invalid code, and shows the relay error. Back
  works on both sides. No crash.

## NOT COVERED

- **Trainer games with feed reading** (blocking / pitching / reactions on the real page): my
  pilot driver stalled at the arsenal step. That was a driver bug, not the page: re-checked,
  skip and tap both work. Only the first dummy swing and one block were read. Fai and Viserai
  trainer feeds are NOT COVERED.
- **A natural (non-concession) table game vs an AI hero on the page:** NOT COVERED by me. The
  smoke check's concession endings do cover the W-L record.
- **Full start-to-finish reading of every feed:** fai boltyn, fai azalea, gravy dash, iyslander
  kayo, and viserai fai turns 1–6 were read in full. The rest were scanned by pattern
  (condition lines, noop lines, hero lines, passes with legal plays). enigma briar/dorinthea,
  gravy blaze, kayo lyath/azalea and lyath viserai were NOT read line by line.
