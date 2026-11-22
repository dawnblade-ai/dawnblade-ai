# H36 / H37 — the off-turn sweep's two candidates (census/offsweep.js): both NOISE

## H36 Lyath rxBoo (`H36-lyath-boo-cheap-NOISE.patch`, SPXBOOCHEAP, BOOMIN=2)
Sweep: the defensive boo pitched a next-turn card 87% of the time to save 1.42 life (exactly 1 in 130 of 246).
Gate: boo only when the leak it stops (min(gain, leak)) is >= 2, or the hero ability's printed cost is
covered by floating resources. Boos per 32 games 91 -> 48. Lyath wins (own seat / other chair):
- 12 seeds of 192: 67/60 -> 64/57
- 24 seeds of 384: 113/117 = 230 -> 114/114 = 228 of 768
0 refusals / violations / stalls. Noise. The boo's Might token (offence next turn) likely pays for the poor life rate.

## H37 one-point defence-reaction pitch (`H37-rx1-hold-NOISE.patch`, SPXRX1 + RX1 env)
Gate (placed before rxFit): hold a defence reaction when the leak is <= 1 and the cheapest legal
defender needs a hand pitch (printed cost > floating resources). Wins of 768 at 24 seeds (own + other chair):
- blaze 112+134 = 246 -> 112+140 = 252
- enigma 204+215 = 419 -> 197+218 = 415
- iyslander 146+141 = 287 -> 151+140 = 291
(12 seeds: 125->131, 200->202, 141->145.) 0 refusals / violations / stalls. Noise in every case, which agrees with H22's
earlier finding that a one-point cushion does not pay.
