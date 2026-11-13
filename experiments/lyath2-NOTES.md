# lyath2 running log (v6.24, worktree agent-af076a8a208569be0, branch exp/lyath2)
- census (experiments/lyath-attack-census.js, lyath 0..3, rule vs Sharp own action points): 14002 points, 395 diffs
  (v6.23 baseline was 414/14148). Top: ATK=>non 65, ATK=>hero-ability 57, ATK=>ATK 48, non+GA=>non 35, ATK=>weapon 34, non+GA=>ATK 33, non+GA=>hero-ability 32.
- census2 (experiments/lyath2/census2.js; rows in c2-s0-3.json): rule->Sharp class: ATK=>non 66, ATK=>HERO 57, ATK=>ATK 48, non=>non 41, ATK=>WPN 34, non=>ATK 33, non=>HERO 32. Sharp HERO total 111, WPN 48, ACT 11.
  ATK=>non: 34 of 66 are cost-0 non-attack with key laHit (not go again).
  non(go again)=>*: rule key is always keepsAP.
- Overrule ceilings (temporary SPXOVR env hack in act(), Lyath own seat, SPXLA_BLK=0 so blocks stay rule, let Sharp's choice through for ONE class of Sharp action;
  12 seeds, paired vs rule-off; wins of 28; ref/viol/stall all 0): off 8.17
  HERO +1.17 (t 2.65, 7up/2dn) | WPN +0.08 (t 0.29) | NONFREE(cost-0 non-attack) +1.83 (t 4.00, 9up/1dn) | NONPAID +1.08 (t 2.40) | ATK +1.92 (t 4.81, 11up/0dn) | ACT 0.00 | ALL own-turn classes +4.33 (t 6.73, 11up/0dn)
- Sharp's non-attack choices at those diffs are ALL Instant-typed cards (95 of ~130 are cost-0 Instants: The Suspense is Killing Me, Concealed Object; also Tension in the Air, Act of Glory, Edge of Their Seats at cost 2-4), plus the hero ability (an Instant for Lyath: {r}{r},{t}: crowd boos -> Might token; Mocking Blow gets +4 once booed).
  Rule plays them only as the last-resort nonAtk branch, after the attack (and markFirst is the only 'instants cost no AP' precedent, `judge.markFirst`).
- FIRST FIX ATTEMPT (hack, SPXINST gate + judge.instantsFirst): play legal, non-idle, Instant-typed non-attack of printed cost <= SPXINSMAX before the attack. Lyath own seat rule policy 12 seeds vs off 8.17:
  max0 (free instants only) -0.08 (t -0.14, 5up/4dn) | max2 -0.75 (t -1.15) | max4 -1.50 (t -1.94). Census with it on: ATK=>non 66 -> 13 diffs, so the order is matched, yet no win gain: the ceiling of NONFREE is NOT 'play free instants first'.
- Why not blanket: census3 (c3.json): at own action points (ap>=1) with an eligible free Instant (292 pts), Sharp plays it first in ~1/3 (selective; not explained by hand size / #attacks / turn / hp).
  Rule HERO-first blanket (SPXHEROF hack; dry-run activation + the rule's own payment; <=1 card lost): -2.17 (t -2.55, 2up/9dn) @12; with loss 0 it never fires (+0.00).
- GAIN-GATED (dry-run the instant/ability incl. payment through J.reduce + actBase, ask effPowerNow of every hand attack before/after; fire only if best effective power rises by >= G):
  free instants first, G>=1: +0.92 (t 2.42, 7up/1dn) @12 | G>=3: +0.58 (t 2.55, 5up/0dn) @12 (fires ~10x per 28 games)
  hero ability first (<=1 card lost), G>=1: +0.33 (t 1.48, 4up/1dn) | G>=3: +0.08 (t 0.21)
- CLEAN IMPLEMENTATION (ship/lyath2): judge.instantFirst(g,seat,atks,fits) (free Instant-typed non-attack, dry-run on a copy, effPowerNow before/after over attacks still payable, gain>=1), gate SPXINSTFIRST, key instantFirst.
  Heroes not byte-identical (own seat rule, seeds 0-5, 15 heroes): ONLY lyath (14 identical).
  Lyath rule own seat @24: +0.58 (t 1.69, 12up/3dn); per-seed [1,2,1,0,1,0,1,0,4,2,0,-1,0,0,2,0,-5,-1,1,2,3,0,0,1]
  Lyath SHARP own seat @6 with gate shared: 18.50 -> 18.00 = -0.50 (t -2.24, 0up/3dn). Exempting the search seat (no branch in Sharp's rule move or rollouts): byte-identical outcomes (w/ref/viol/stall/draw/sig/searched/overruled all equal) 18.50.
- Lyath rule own seat, SPXINSTFIRST=lyath vs none, 72 seeds (0-71): +0.18 wins/seed (t 1.09, 29up/16dn); thirds: seeds 0-23 +0.58, 24-47 -0.13, 48-71 +0.08. UNRESOLVED (noise band ~3). Early +0.92@12 was a tail.
  14 other heroes byte-identical (seeds 0-5). Decision: gate default OFF (opt-in env SPXINSTFIRST=<heroes>|all), patch kept.
- Drill test/instantfirst.test.js (12 drills); sabotages (each applied once, restored): paid-instants-tried (bit after adding a floating-pool cost-1 fixture), fits ignored, gain threshold 0 (3 drills), reader writes (2), search seat takes branch, gate always on, hero list ignored all bit. 'non-instants tried' does NOT bite alone: a non-Instant goes on the stack unresolved, which the stack guard already refuses (guards redundant; Booze! drill covers the pair).
- test/explain.test.js census list gets instantFirst (unreachable with gate off).
