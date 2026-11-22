# NEXT 3 — weakest seats by census (Iyslander, Viserai BW): two measured NOs

never.js at 3 seeds: `census/never-iyslander-3.txt`, `census/never-viseraibw-3.txt` (legal / used per card window).

## Iyslander (H34, `H34-iyslander-stir-idle-NOISE.patch`, SPXSTIRIDLE, reader judge.instantNextTakers)
Leaving out Spellfire Cloak (NEXT 4, another worker), Frost Spike and Ice Bolt. Low-use hand cards
(Arcane Twining 70/1, Aether Hail 43/2, Pyroglyphic 46/4, Brain Freeze 67/9, Photon Splicing 73/8) are
blue pitch/block cards: calls.js shows them pitched and blocked, which is their job. No gap there.
Misuse found: Stir the Aetherwinds (whole payload "your next Wizard non-attack card this turn as though
it were an instant", `instantNext`) cast from the ARSENAL on the opponent's turn by SPXOPPARS 16 times in
96 games. Every cast pitched hand cards for its {r}{r}, and none was followed by a Wizard card
(`census/stir-follow.js`). So it spent next turn's cards for nothing.
Fix tried: don't cast off-turn a pure instant-speed grant with no ARSENAL taker (instantNextTakers -> {hand, arsenal}).
A/B, Iyslander wins (own seat / other chair):
- 12 seeds of 192: off 79 / 62 = 141, on 77 / 64 = 141
- 24 seeds of 384: off 146 / 141 = 287, on 145 / 139 = 284 (noise; seeds 12-23 alone 67/79 -> 68/75)
0 refusals / violations / stalls (1 draw on, iyslander-enigma-17). Not shipped. A held Stir clogs the arsenal.
It could ship only as an advice fix (the call should not tell a player to cast it), which is the CEO's call.

## Viserai BW (H35, `H35-viseraibw-runechant-offturn-NEGATIVE.patch`, SPXRUNEOFF + RUNEOFF env)
Runechant of Lust / Sloth (0-cost Runeblade Instant auras) legal on the opponent's turn 118/0 and 117/0.
Experiment: cast the 0-cost hand instant on the opponent's turn, outside a chain (~73 casts in 32 games).
12 seeds, Viserai BW wins of 192 (own seat / other chair):
- off: 56 / 58 = 114
- first window: 39 / 55 = 94 (-20)
- late (opponent at 0 action points): 44 / 56 = 100 (-14)
0 refusals / violations / stalls. As suspected: off-turn they are destroyed at his action phase and never
usurped (on his own turn calls.js shows them played as rxAttack 54 / 72 times, i.e. usurped), and the card
is a 2-pitch card out of next turn. The lesson holds a fourth time.
Also seen, not tested: Gate to i'Arathael activation 98/0 own, 71/0 opp. His Gloomblades already play
from banish by their own text, so its grant adds nothing. The only thing activating it buys is
Viserai, Usurper's traverse, and SPXTRAV owns that decision. Low value.
