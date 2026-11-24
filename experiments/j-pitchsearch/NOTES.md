# Worker J — pitch-card search (laPaySearch): NEGATIVE / noise

**Census** (CENSUS probe, 1 seed, all 17 heroes, 272 games, SPXLA=all): 4077 own-turn paySel
decisions (~15/game, both seats); 2595 (64%) had at least one distinct (name/pitch) alternative to
the rule's card, 4104 alternatives in all. Real choices are common, so step 2 ran.
`view.determinize` keeps the pending payment (checked: pending, hand and paySel identical in the mask;
rule's paySel legal in it). No hack needed.

**Probe** (`laPaySearch-probe.patch`, gate `SPXLA_PAY=<heroes|all>`, default OFF): at an own-turn paySel
the candidates are the rule's card (A0, first) plus each distinct legal pitch card; laSearch is reused
(candFn), so budgetOwn 600, margin 0.5, laLucky/verify and the over-budget bail-out (A0 stands) are
unchanged; scored by laEval.

**Base**: stored `<hero>.tgt*.txt` (v6.79). Arakni reproduced exactly on current main (106, identical WINS line).

**Result** (hero's seat vs every hero, 192 games per cell; tables.txt, ab/):
- seeds 0-11:  base 1609, probe 1615 (+6)
- seeds 12-23: base 1664, probe 1666 (+2)
- 24 seeds: +8 of 6528 — noise. Both samples are barely positive, but
  Gravy is -9 and -12 (-21 over 24 seeds; gate allows ~-5). Lyath -6, Azalea -2.
- 0 refusals, 0 invariant violations in all 34 runs.

**Why it is flat** (reading, not measured): laEval's flat mu scores held cards by count, and the
own-horizon rollout ends after the draw-up, so which of two same-pitch cards stays in hand barely
moves the score; the candidates mostly tie and A0 stands (Kayo, Iyslander, Arakni are exactly 0 on sample 1).
Gravy's loss suggests the rollout's score prefers lines that keep a card the rule policy pitches on purpose.

Not shipped; engine left as on main. No engine bugs found.
