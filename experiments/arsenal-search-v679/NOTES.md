# Arsenal search (CEO session_013xG9xCCHmaDbKTPm38cqzb, 2026-11-24, at v6.79) — DEAD

Probe `laArsSearch` (ars-probe.patch, on top of laX-perhero-probe.patch): at the arsenal step (CR 4.4.3b) Sharp tries
every distinct usable hand card face down (and none), plays each line out from the same laMask root through the
opponent's turn AND this seat's next turn (`arsH` 3 turns, `arsB` 900 steps; max seen 449, 1 bail-out in 17x192
games), scores with laEval. Per hero (`SPXLA_XSET=ars=1`), 12 seeds, against v6.79's base (= the `tgt` arm of
experiments/search-shape-v678b; dash reproduced exactly, 108 = 108).

| arm | overrules | total (of 3264) |
|---|---|---|
| ars (margin 0.5) | ~10% of arsenal picks | 1583 vs 1609, **-26** (7 up, 9 down; azalea/enigma/gravy -7) |
| arsm3 (margin 3) | ~3% | 1603, -6 (noise; gravy -8 again) |

0 refusals / violations in every run. Reading: a rollout through the opponent's turn misjudges (same as horizon "opp",
-53); the rule's "best attack face down" is at least as good. Gravy is hurt in both arms. Do not retry without a
different scorer. Chaos d14 (289 games, 33,555 random legal moves): 0 findings (experiments/chaos-d14.txt).

Gravy Steady vs Sharp (seat search off, every other seat on): seeds 0-11 10 vs 41, seeds 12-23 13 vs 48 (gravy.steady*.txt).
