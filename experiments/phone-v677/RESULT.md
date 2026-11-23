# Phone bound at v6.77 — page, 4x CPU throttle (worker H, 2026-11-23)

Driver: experiments/phone-v675 (time.js, gen.js). 80 own-turn + 80 opp-turn positions per hero, same box, v6.76 (bfd71ca) and
v6.77 interleaved, 3 runs each. p95 columns = median of 3 runs; worst = max of 3. Cells: v6.76 / v6.77 (ms). Bound: p95 < 150, worst < 400.

hero | p95 | worst | ownP95 | oppP95
arakni | 144/89 | 361/199 | 111/81 | 156/90
azalea | 120/73 | 208/186 | 110/73 | 127/74
blaze | 88/67 | 164/137 | 62/49 | 125/77
boltyn | 119/81 | 375/171 | 87/47 | 133/82
bravo | 101/68 | 226/190 | 43/41 | 136/78
briar | 137/66 | 426/124 | 117/64 | 156/79
dash | 98/69 | 207/163 | 84/73 | 111/74
dorinthea | 102/75 | 263/119 | 44/33 | 125/83
enigma | 106/60 | 159/118 | 87/50 | 125/71
fai | 129/87 | 183/155 | 97/86 | 146/87
gravy | 110/67 | 296/161 | 135/90 | 106/67
iyslander | 80/40 | 306/67 | 29/21 | 92/49
kayo | 98/69 | 241/128 | 62/36 | 101/74
lyath | 100/74 | 162/178 | 84/74 | 127/106
prism | 132/90 | 284/179 | 134/73 | 130/85
viserai | 95/62 | 266/130 | 78/36 | 106/70
viseraibw | 127/82 | 300/236 | 108/79 | 140/89

v6.77: every hero inside the bound on this box (max p95 ~90, worst 236 viseraibw). Max p50 19 ms. A cloud box, not an iPhone.
Remaining heavy calls: opp-turn defend (laBlock/blockGear/blockHand) 100-235 ms. Next levers if ever needed: laTake memo, block cap 1 (A/B).
