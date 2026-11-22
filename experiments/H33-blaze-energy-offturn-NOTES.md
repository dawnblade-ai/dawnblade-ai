# H33 — Blaze energy -> off-turn arcane cast (QUEUE NEXT 1): a measured NO

Patch: `H33-blaze-energy-offturn-NEGATIVE.patch` (SPXBLAZEOFF subGate; `BLZT` env picks the timing).
On the opponent's turn, outside a chain/pend/stack: activate the hero (energyPick's card, `judge.ctrPickTakers`),
then play the banished arcane from banish ("as though it were an instant"). Census scripts in `census/`
(`blazeoff-first.js`, `blazeoff-late.js`, `keys.js` counts reason keys by turn).

## Census (blaze, 3 seeds, 96 games)
- First legal off-turn window: 496 of 712 opponent turns Blaze holds energy AND an affordable X-matching taker
  (energy is plentiful: 2-12 typical, ~4.9 unspent at game end). That card's fate: it BLOCKS that same turn
  321/496 (blockLethal 146, blockHand 141, blockSpare 34), pitched next own turn 62, arsenalled 16, held 12.
- LAST off-turn window (after combat): 247 of 740 opponent turns. Taker's fate next own turn: pitched 104,
  banished by the own-turn energy pick 101, arsenalled 26, held into the next opp turn 11 (4%).
  Its pitch cards (255): pitched 152, played 38, arsenalled 19, held 16 (6%). Hand at that window: 2-3 cards.
- So ~95% of what an off-turn cast spends is next turn's card. And it cannibalises the own-turn energy pick:
  own-turn banishes 98 -> 12 (first window) / 30 (late) per 32 games. A time-shift that costs a card.

## A/B, 12 seeds each chair, Blaze wins of 192 (own seat / other chair), 0 refusals/violations/stalls in all
- off (SPXBLAZEOFF=none): 64 / 61
- first window:           48 / 49   (-28 of 384)
- late (opp ap 0):        57 / 50   (-18 of 384)
- lethal only (arc >= opp hp): 64 / 61 (unchanged; ~26 casts in 192 games; those kills land on his own turn anyway)

Verdict: not shipped. The lesson holds a third time: a hand card cast off-turn is next turn's card. Blaze's
hero banishes from HAND only, so there is no arsenal version of this line. The energy surplus is real but
cards, not energy, bind Blaze's turn.
