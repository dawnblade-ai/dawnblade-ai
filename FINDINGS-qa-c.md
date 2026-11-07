# FINDINGS — QA reader C (TRAINER, v5.96, `ddbc581`)

Read-only audit of the **trainer** (you vs the iron dummy, "Coach's call"). The earlier readers
(findings/qa-a, findings/qa-b) covered the table and could not tap cards in the trainer. This
pass could.

## Coverage

10 trainer games on the real page, offline, 393×852 (`tools/page.js`'s `open()`). 9 heroes:
| hero | turns | result | notes |
|---|---|---|---|
| Kayo | 1 + 7 | two short probes (turn caps 4 and 6) | first one found the "Pay 0" sheet |
| Dash | 7 | lost (0 / 42) | boost, Teklo Trebuchet, Talishar, Boom Grenade |
| Dorinthea | 13 | turn cap (7 / 27) | Dawnblade, Warrior's Valor, Sharpen Steel, reprise reactions, Refraction Bolters |
| Viserai | 12 | lost (−5 / 42) | Reaping Blade, Beckoning Haunt, Hit the High Notes |
| Boltyn | 8 | lost (−3 / 39) | charge, Glisten, Banneret, Raydn, Toe the Line |
| Azalea | 12 | lost (−4 / 42) | arrows from the arsenal, Scout the Periphery, Memorial Ground, Lace, Call in the Big Guns |
| Iyslander | 13 | turn cap (2 / 34) | Cold Snap, Crucible amp, Emeritus Scolding, Photon Splicing, Look Tuff, foe-turn window |
| Bravo | 11 | turn cap (9 / 38) | **defence step + reactions**, Edge of Their Seats / Suspense auras, hero power, Magmatic Carapace, Clash of Vigor |
| Briar | 11 | turn cap (14 / 38) | **defence reactions from hand and arsenal** (Sigil of Suffering), Cloud Cover, Sizzle, Nimblism, Arcane Polarity, split card |

The losses are the driver's play (random lines into a dummy that walls every swing), not the
engine. Every game: **0 page errors, 0 invariant violations (`window.__dawnJudge` empty), 0 stuck
states, no blank screen.** Every Coach's call shown was logged next to the hand, arsenal,
resources and action points it was given, and every feed was read in full (the first six by
pattern plus full reads of Dash, Dorinthea, Viserai, Bravo and Briar).

## Method

- Driver: **`experiments/qa-c-trainer-drive.js`**. It reads the live `Battle` state through the
  React fiber of `.board` (the trainer has no window hook), maps each `.phand .hc` button to a
  card by its React key (the card uid) and taps twice to commit, exactly as a thumb does. It
  handles pay (pitches blue first, confirms when the status line says "covered"), arsenal, the
  defend step (hand + equipment), "Defend → reactions" then defence reactions, attack reactions
  in the stack window, the bottom-bar modes (boost, fuse, charge, X…) and sheets (`.psheet`).
  Output JSON: the steps, every distinct Coach's call with the state it saw, and the full `g.feed`.
  `HEROES=4,12 GAMES_SEED=31 TURNS=10 OUT=x.json PAGE_DEPS=… NODE_PATH=$(npm root -g) node experiments/qa-c-trainer-drive.js`
- Coach's call findings were re-verified **headless** with `experiments/qa-c-probe-coach.js`
  (calls `engine/advisor.js`'s `advise` on minimal states; `node experiments/qa-c-probe-coach.js`).
- Card text: `data/pool.js`. Recorded approximations (`node tools/approx.js`) skipped.

## Counts

| class | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| P (crash / stuck / dead tap) | 0 | 0 | 0 | 0 |
| S (state / rules) | 0 | 0 | 0 | 0 |
| COACH | 0 | 1 | 3 | 1 |
| FEED / UI text | 0 | 0 | 2 | 5 |

---

## COACH

### COACH-1 · P1 · The Coach's call never recommends a weapon swing, and says "End turn" over a pumped weapon
- **Heroes:** every weapon hero. Seen with Dorinthea (Dawnblade), Viserai (Reaping Blade), Dash
  (Talishar), Kayo (Mandible Claw), Boltyn (Raydn). In ~60 act-window calls across those games,
  no call ever named a weapon.
- **Steps (page):** Dorinthea, turn 2: play Warrior's Valor (pitch Overpower), Blossom of Spring,
  Sharpen Steel. Now 3 floating, 1 action point, Dawnblade unswung, +5 waiting on the next weapon
  attack.
- **Evidence:** the call at that moment (hand: Oasis Respite; res 3, ap 1):
  `End turn — save the hand for blocks and tomorrow. Every play from here trades down.`
  The swing was taken anyway: `You swing Dawnblade — 8 power on the chain (printed 3).` …
  `Dawnblade resolves for 1.` … `Dawnblade connects — Dorinthea's hero ability frees it for one more swing this turn.`
  Ending the turn would have thrown away both pumps already paid for. On turn 4
  (hand: Nip at the Heels, Ironsong Response; res 0, ap 1) it said `End turn — save the hand…`
  with Dawnblade available.
- **Headless:** `qa-c-probe-coach.js` → a 3-power weapon on its own, and with `buffNext: 5` and
  3 floating, gives `advCardOut = 0` and `End turn — save the hand for blocks and tomorrow.`
- **Cause:** `engine/advisor.js` `advCardOut` adds damage only `if(isAttack(c))`, and the advisor's
  `isAttack` is `parser.isAttack` (`/attack/` AND `/action/` in the type line), which is false for
  "Weapon - Sword (2H)". So every weapon candidate is valued at `0 − cost×0.15` and never clears
  the 0.4 floor. Pending weapon-only grants (Warrior's Valor, Sharpen Steel) are not read either.
- **Fix area:** `advisor.js` `advCardOut` / `advValue`: value a weapon swing by its power plus
  pending next-weapon-attack grants (the judge readers the AI uses), not by `isAttack`.

### COACH-2 · P2 · A defence reaction in the arsenal is coached as an action-phase play
- **Hero:** Viserai (turns 7, 9, 10).
- **Steps (page):** arsenal Sigil of Suffering at an end phase; on your next action phase read the call.
- **Evidence:** state `ars: Sigil of Suffering, hand: Rune Flash, Reduce to Runechant, res 0, ap 1` →
  `Play Sigil of Suffering from arsenal → 1 dmg. Best value line available right now.`
  Tapping it, the trainer refuses: `Sigil of Suffering is a defense reaction — it can only be played in the reaction step, by the player being attacked.`
- **Headless:** the same card in HAND is correctly skipped (`End turn. Nothing profitable left`);
  in the ARSENAL it is the call.
- **Card text:** Sigil of Suffering — Runeblade **Defense Reaction**: "Deal 1 arcane damage to the attacking hero…"
- **Fix area:** `advisor.js` act branch: the hand candidates skip `isRx(c)` but the arsenal
  candidate does not. Ask the same filter (or `playZoneWhy`/`rxAllowed`) for the arsenal.

### COACH-3 · P2 · Azalea's hero power is coached with an empty arsenal
- **Hero:** Azalea, turn 1 (arsenal empty).
- **Evidence:** state `ars: null, res 0, ap 1` → `Play Azalea — hero power → go again. Chain it: go again keeps your action point.`
  The trainer refuses the play: `Azalea: your arsenal is empty — nothing to cycle.`
- **Headless:** reproduced with Azalea's printed text as `ctx.hpow` and `arsenal:null`.
- **Card text:** Azalea — "Once per Turn Action - 0: Put a card from your arsenal on the bottom of
  your deck. If you do, put the top card of your deck face-up into your arsenal…"
- **Fix area:** `advisor.js`: the `ctx.hpow` candidate is checked only for cost and
  `weaponUsed.hpow`. Ask the same "can this activate now" reader the trainer's refusal uses.

### COACH-4 · P2 · Coached "Play Oasis Respite → effect" on your own turn, where its prevention can't be used
- **Hero:** Dorinthea, turn 2 (seen once on the page, not probed).
- **Evidence:** hand `Oasis Respite, Sharpen Steel`, res 3, ap 1 →
  `Play Oasis Respite → effect. Best value line available right now.`
  The dummy only attacks on its own turn, so the feed later says
  `You: 1 unspent “this turn” grant expires with the turn.` "→ effect" also tells a learner nothing.
- **Card text:** Oasis Respite — "Prevent the next 4 damage that would be dealt to target hero
  **this turn** by a source of your choice…"
- **Fix area:** `advisor.js` `advValue` values `ward` ops at a flat 0.4 each, whatever the
  window. A this-turn prevention in your own action phase against the dummy is worth 0.

### COACH-5 · P3 · "Arsenal X — it swings again tomorrow" for cards that never swing
- **Heroes:** Dash (`Arsenal Boom Grenade — it swings again tomorrow.`, an item), Kayo
  (`Arsenal Pulping — it swings again tomorrow.` before it ever swung), Dorinthea (`Arsenal Sharpen Steel — it swings again tomorrow.`, a non-attack).
- **Fix area:** `advisor.js` arsenal branch: say "it's ready tomorrow" or word it by card type.

---

## FEED / UI text

### FEED-1 · P2 · An instant-speed pitch for a "may pay" price names no seat, so it reads as the player's
- **Hero:** Iyslander, turn 1. Cold Snap (blue) aimed at the dummy.
- **Evidence:** `Cold Snap: go again — action point kept.` → `Pitched Wounding Blow at instant speed (+3).`
  → `The Dummy paid 1 — and avoids what declining costs.` Wounding Blow is the **dummy's** card,
  but every other `Pitched …` line in the feed is the player's. Shared code, so at the table it
  reads the same when the AI pays.
- **Card text:** Cold Snap — "Target hero may pay {r}. If they don't, freeze a card in their arsenal…"
- **Fix area:** `engine/effects.js` `autoPitch` (both `Pitched ${p.name} at instant speed` lines,
  ~5827 / 5838): prefix with the seat, e.g. `${sv(act(n),"pitch")} …` → "The Dummy pitches Wounding Blow…".

### FEED-2 · P2 · Lightning Press tapped in the action phase says "no scripted effect yet", but it is scripted
- **Hero:** Briar (4 times in one game).
- **Evidence:** `Lightning Press: no scripted effect yet — pitch it, block with it, or ℹ to read it.`
  `fxParse(Lightning Press)` → `self: 3`, `tier: "full"`, and `test/instantpump.test.js` drives it
  (it pumps your own cost-1-or-less attack). The real reason is that there is no attack of yours
  to target. Telling a learner a card is unbuilt when it works teaches them to pitch it.
- **Card text:** Lightning Press (Lightning **Instant**) — "Target attack action card with cost 1 or less gets +3{p}."
- **Fix area:** `index.html` `tryPlay` ~4389: the `!fx.playable` gate does not count a `self`
  pump on an instant. Name the missing target instead (the reason `effects.pumpTargetWhy` gives).

### FEED-3 · P3 · "You draws back up to 4 — first turn of the game"
- **Heroes:** every game the dummy went first (Kayo, Dash, Azalea).
- **Fix area:** `index.html` ~5117 builds `${foe(n).name} draws` by hand; use `sv(foe(n),"draw")`.

### FEED-4 · P3 · "You" capitalised mid-sentence, and "You: their next …"
- `Kayo's hero ability: the first card with 6 or more {p} You have discarded this action phase makes a Might token.` (`effects.js:659`, `sv(act(n),"have")`)
- `Banneret of Salvation: the next time You hit this turn, it pays off.` · `Toe the Line: the next time You would be dealt damage this turn, 2 of it is prevented.` · `Cloud Cover: the next time You would …` · `Second Strike: condition not met (You have not dealt damage this turn).`
- `You: their next Guardian attack action card costs 1 less.` (Bravo, Seismic Surge, `effects.js:1768`; also `:1785` "may be played at instant speed"). For seat 0 it should be "your next".
- Shared feed, so both boards. **Fix area:** a mid-sentence form of `sv` (lower-case "you"), and a possessive in place of "their" at 1768 / 1785.

### FEED-5 · P3 · A destroy-only price shows a button that says "Pay 0"
- **Hero:** Kayo, turn 1. Bare Fangs discarded Clash of Might at random, and Beaten Trackers offered its rider.
- **Evidence (sheet buttons):** `Pay 0 · 7 from pool and hand` / `Decline · the rider does not resolve`, under the title "Destroy Beaten Trackers?".
- **Card text:** Beaten Trackers — "Whenever you discard a random card with 6 or more {p}, you may destroy this. If you do, gain 1 action point."
- **Fix area:** `index.html` the `p.tag==="pay"` block of the prompt sheet (~2593): when `p.destroyUid && !p.cost`, label it "Destroy Beaten Trackers" and drop the pool line (`effects.payCostSpec` already names it).

### FEED-6 · P3 · "Take it" stays the label with defenders selected, and it declares them
- Any hero: in the defend step, tap two cards (they show ⛨ DEF), then the bar still offers
  `Take it` beside `Defend → reactions`. "Take it" declares the selection and skips the reaction
  step (`Blocked 5, took 0.`). A learner reads "Take it" as taking the hit unblocked.
- **Fix area:** `index.html` actbar block branch (~6197): rename to "Defend — no reactions" while `blockH`/`blockG` is non-empty.

### FEED-7 · P3 · Results logged before their causes
- Bravo: `You paid 1 and tapped Magmatic Carapace — the rider resolves.` comes **before** `Pitched Edge of Their Seats at instant speed (+3).` (the pitch that paid it).
- Dash: `Big Bertha: You control nothing that can take a steam counter.` comes before `You play Crankshaft…`, and the boost banish that triggered it is two lines later.
- Dorinthea / Oasis Respite: `+1 life.` comes before `You play Oasis Respite.`, so it reads as the Goblet pitched on the line above.
- **Fix area:** the order of the `L(...)` calls in the pay-sheet answer path and the boost/play paths of `effects.js`.

---

## CLEAN — checked on the trainer and correct (do not redo)

- **Page:** 10 games with no page error, no invariant violation and no stuck state. Every tap
  that refused named its reason (no dead taps). Sheets, the pay step, the arsenal step (tap and
  skip), the defend step (hand + equipment), "Defend → reactions", defence reactions from hand
  **and from the arsenal**, the stack window's attack reactions, boost yes/no, the foe-turn
  window ("Pass — let The Dummy end") and the game-over panel all worked.
- **Dummy:** the scripted [3,4,5] escalation (later 4,5,6), its walls (1 + 3 + 3) and
  `Wall of N — … — stops M` arithmetic in every resolution line read. Ironrot pieces are destroyed
  after one block. Blocked/took arithmetic matches the declared defenders every time.
- **Rules:** a non-attack action with the combat chain open is refused ("close it (⛓)"). That is
  correct by CR 7.6.3a ("The turn-player may play or activate attacks or attack-layers during the
  Resolution Step"); only attacks continue a chain. Arrows only from the arsenal. Reactions refused
  outside their step with the right reason. An instant costs no action point. Go again keeps the point.
- **Kayo:** Bare Fangs (+2 on a 6+ random discard), Kayo's Might from the first 6+ discard,
  Knucklehead Temper (2 → 1 → destroyed), Buckwild go again from a 6+ card in the pitch zone,
  Test of Might clash (tie → no token; win → Might; Might +1 next turn), Mandible Claw no go
  again without a 6+ discard, Predatory Plating refused with nothing 6+.
- **Dash:** Teklo Trebuchet's +2 to the next boosted attack (Crankshaft 3 → 5), boost go again
  on a Mechanologist banish, Boom Grenade steam upkeep then crumble, Talishar rust counters.
- **Dorinthea:** Warrior's Valor (+2/+3 and go again on hit), Sharpen Steel, Agile Engagement
  (+3, Agility only when an attack action defends), Ironsong Response / Stroke of Foresight /
  Out for Blood / Overpower reprise numbers (Overpower +4 replaces +2), Stroke's draw-then-put-back
  sheet, Refraction Bolters go again after resolution (CR 5.3.5), Scar for a Scar go again when
  behind on life, Dorinthea's extra swing on a hit.
- **Viserai:** Reaping Blade's life lock, Beckoning Haunt X=0 return from the graveyard, Hit the
  High Notes condition, Read the Runes ×3.
- **Boltyn:** charge, his +1 when an attack action defends after charging, Banneret's life on the
  next hit, Glisten 4 counters then wiped in the end phase, Raydn 0 power uncharged.
- **Azalea:** Scout the Periphery +3 to the arsenal attack (Murkmire Grapnel 4 → 7), Lace with
  Inertia / Call in the Big Guns +3, aim-counter conditions, Memorial Ground.
- **Iyslander:** Cold Snap's "may pay" and go again, Crucible amp (expires at the end of turn),
  Emeritus Scolding 2 on your own turn, Photon Splicing 2, Look Tuff's −1 when unpaid, the CR 4.3.4
  foe-turn window.
- **Bravo:** Edge of Their Seats / The Suspense is Killing Me suspense ticks and payout (+3 →
  Thunder Quake 8 → 11), hero power turns Pummel face up and correctly gives no crush bonus,
  Magmatic Carapace → Seismic Surge, Clash of Vigor loss gives the dummy Vigor.
- **Briar:** Sigil of Suffering arcane then +1{d} (defends for 4, from hand and from the arsenal),
  Sizzle +3 (Second Strike 3 → 6), Nimblism +3 on cost ≤1 (Static Shock 4 → 7), Arcane Polarity +1
  without arcane taken, Lightning Surge only from arsenal, Arcane Seeds // Life split prompt and runechant.
- **Coach, correct:** the block calls' take-N arithmetic, the pay calls' exact-pitch sums,
  stack-window reaction calls (Agile Engagement +3, Stroke of Foresight +3), the arrow arsenal call.

## NOT COVERED

- Fai, Enigma, Arakni, Blaze, Gravy and Lyath trainer games (not run, to stay in budget).
- A trainer **win**: the random driver never felled the dummy, so the win panel and score were not seen.
- Following the Coach's call turn by turn (the driver plays randomly; the calls were logged and read, not obeyed).
- Element-box checks (small targets, overlap): `tools/page-audit.js` already does those.
