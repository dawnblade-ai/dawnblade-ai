# Hand WORTH in laEval (worker K) — NEGATIVE

Probe (handworth-probe.patch = laX per-hero switch + LA fields handA/handArs/arsP/bHandA, all default 0/off):
laEval adds, for MY seat only (foe hand is hidden, kept at count*mu):
- h5: handA=0.5 — sum over my hand+arsenal of 0.5*(printed def - 2), own-turn search
- ap: arsP=0.5 — arsenal card worth 0.5*power (attack) or 0.5*pitch (other)
- bh: bHandA=0.5 — the same def term inside laBlockSearch's eval
Base = v6.79 `tgt` files (seeds 0-11); reproduced Lyath on current main exactly (59 wins, identical line) first.
Seeds 0-11 (192 games/hero, 3264 total, base 1609 for the heroes' own seats): h5 -19, ap -114, bh -40.
No arm positive, so seeds 12-23 were not run. 0 refusals / violations / stalls in every run.
Per-hero table: table-s1.txt; raw tourney lines: raw/. ap hurts bravo -22, kayo -21, iyslander -20, enigma -16, blaze -15:
pricing an arsenal attack by its power makes the search hold cards the rule policy would play. handA/bHandA (a=0.25 not tried; 0.5 is already flat-to-negative) is noise.
Conclusion: hand quality is not a missing term; the flat mu already prices what the own-turn horizon can see.
