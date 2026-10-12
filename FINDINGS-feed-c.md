# FINDINGS — feed read, group C (fai, gravy, iyslander) — v5.08

Read-only audit; no engine/test/doc file changed. Feeds were read line by line
(noise-filtered with grep for the routine step headers). Repro for each feed:
`node -e 'const SP=require("./tools/selfplay.js");const r=SP.play(SP.match(H,O,SEED));for(const x of r.game.feed)console.log(x)'`

## 1. Look Tuff says "can't pay" while the hand holds pitchable cards

- hero: iyslander (also any Look Tuff deck, e.g. enigma) · card: Look Tuff (Generic Action - Attack, 8 power)
- printed: "When this attacks, it gets -1{p} unless you pay {r}."
- feed: `Look Tuff: can't pay 1 — takes -1{p}.` / `Iyslander plays Look Tuff — 7 power on the chain (printed 8).`
- wrong: the payment is tested against FLOATING resources only (`act(n).res >= cost`). The seat had 0 floating but two pitchable cards left in hand (Voltic Bolt p3, Winter's Bite p3), so under the pitch-on-demand ruling (2026-08-01) it could have paid {r}. The player is denied the option and the line says they cannot. Not in `tools/approx.js`; the code comment calls it an "honest approximation" but the feed text states a falsehood.
- direction: weaker (and feed-text)
- repro: `SP.match("iyslander","viserai","s2")` — drive with `SP.SP.act` / `SP.J.reduce`; at the step whose new feed lines contain "can't pay", `state.sides[0].res === 0` and `state.sides[0].hand` = [Voltic Bolt, Winter's Bite]. Same line appears in iyslander-kayo/dash/enigma c1 and gravy-enigma c1.
- site: engine/effects.js:4423-4427
- confidence: high (state shown); medium on whether it is intended — it is a declared approximation but unledgered.

## 2. "…unless they pay" accepted line says "the rider resolves"

- hero: iyslander · cards: Winter's Bite, Cold Snap
- printed: "Target hero discards a card unless they pay {r}." / "Target hero may pay {r}. If they don't, freeze a card…"
- feed: `Iyslander plays Winter's Bite.` … `Kayo paid 1 — the rider resolves.` (no discard follows; same for `Dash paid 1`, `Enigma paid 1`, `Viserai paid 1` on Cold Snap)
- wrong: for the payOr family the payment AVERTS the consequence (`ops: []`, consequence lives in `elseOps`). Nothing resolves, yet the shared accept-line announces that the rider does. A reader concludes the discard/freeze happened. Contradictory feed line.
- direction: feed-text
- repro: `SP.match("iyslander","kayo","c1")`, Iyslander turn 5 (feed excerpt above); hand sizes are unchanged after the line.
- site: engine/prompts.js:1268 (accept message) fed by engine/effects.js:1155-1161 (`payOr`, `ops:[]`, `elseOps`)
- confidence: high

## 3. One-event prevention says the unused remainder "goes with this hit"

- hero: gravy · card: Throw Caution to the Wind (also Cloud Cover / Toe the Line, same shield path)
- printed: "The next time you would be dealt damage this turn, prevent X of that damage…"
- feed: `Golden Tipple is pitch 3 — … 3 of it is prevented.` / `Throw Caution to the Wind: 1 of that damage is prevented — the other 2 goes with this hit.` / `Strongest Survive resolves for 0.`
- wrong: only 1 damage was incoming; the shield's other 2 points are LOST with the event (v5.06's own rule), not damage that "goes with this hit". The hit resolves for 0. The wording is a leftover of the pre-v5.06 budget phrasing and is also ungrammatical ("2 goes").
- direction: feed-text
- repro: `SP.match("gravy","kayo","c1")` Kayo turn 2; also gravy-dash c1 turn 2, gravy-enigma c1 turn 2.
- site: engine/effects.js:839-840
- confidence: high

## 4. "no additional-cost discard to feed — bonus skips" printed on cards that have no additional cost

- hero: gravy/fai opponents (Kayo cards) — surfaces in every feed with Kayo · cards: Bare Fangs, Wild Ride, Mandible Claw (the `discard6way` family)
- printed: Bare Fangs "When this attacks, draw a card, then discard a random card. If a card with 6 or more {p} is discarded this way, this gets +2{p}."
- feed: `Bare Fangs: discarded Rally the Coast Guard (6{p}) at random.` … `Bare Fangs: no additional-cost discard to feed — bonus skips.` … `Kayo plays Bare Fangs — 8 power on the chain (printed 6).`
- wrong: the bonus did NOT skip (6+2 = 8; Wild Ride gets go again the same way). The "this way" gate is settled by the late pass; the declaration-time else-branch prints a false line for any `discard6way` card because they have no `addCost`. The state is right, the feed contradicts it (and refers to a cost the card does not print).
- direction: feed-text
- repro: `SP.match("gravy","kayo","c1")` Kayo turns 6/8/14; `fai`/`iyslander` vs kayo likewise.
- site: engine/effects.js:4636-4638
- confidence: high

## 5. (low) Compass of Sunken Depths "reveals" a card it only looks at

- hero: gravy · card: Compass of Sunken Depths — "Instant - {t}: Look at the top card of your deck."
- feed: `Compass of Sunken Depths — ability reveals Saltwater Swell (pitch 1) off the top — it stays there.` (every Gravy turn)
- wrong: looking is private; the shared feed names the card to the opponent too (information leak). Parser comment at parser.js:3113 states "for the trainer both just put the top card in front of you", i.e. deliberate, but at the table the feed is read by both seats.
- direction: feed-text (hidden-information leak at the table)
- site: engine/parser.js:3115 (maps look to `reveal`), engine/effects.js:2690
- confidence: low (recorded design choice; flagged only because of the two-seat table)

## Checked and found consistent (no finding)
Fai: hero-power discount per Draconic link, Brand with Cinderclaw → Draconic grant spent once, Flamecall "another red card" gate, Hot on Their Heels ladder, Enflame ladder, Mounting Anger, Pouncing Paws / Tearing Shuko ephemeral Crouching Tiger, Searing Emberblade gate. Gravy: Swiftwater Sloop / Battalion Barque High Tide gates (pitch-zone blue count), Saltwater Swell reveal/pitch resource, Murderous Rabble pitch value, Portside Exchange discard-then-draw order, Oysten Gold on death, watery-grave allies face-down, hero power (Gold destroyed, tap), Mage Master Boots grant, Jittery Bones modal. Iyslander: Frost Spike + hero Frostbite on opponent's turn, Winter's Bite from arsenal on opponent's turn, Fusion reveals (fused only with an Ice card revealed), Ice Eternal X pricing and Frostbite shatter, Amp grants, Absorb in Aether, Emeritus Scolding opponent-turn gate, Brain Freeze hand reveal. Life totals reconciled for gravy-azalea (Bloodrot Pox to 16 / 8). Incidental: the second-person literal "The crowd boos you" for seat 1 (Lyath) is the known 52-literal debt in judge.test.js, not re-reported.

## Coverage
18 games (fai, gravy, iyslander × 6 opponents each): seeds c1 vs kayo/dash/enigma and s2/s3/s4 vs viserai/azalea/lyath. 10,198 feed lines read (noise-filtered with grep for step headers, pitch prompts and routine lines; every other line read). One extra state-level driven repro for finding 1.
