# Search SHAPE at the v6.78 budget (CEO 2026-11-23 night)

Each arm changes Sharp for ONE hero's seat only (`laX` probe: `SPXLA_XH=<hero> SPXLA_XSET="k=v,..."`
overrides any `LA` field inside that seat's searches), hero vs every hero, 12 seeds (192 games a hero),
against v6.78's own `base78` (experiments/sharp-budget-v678). All arms 0 refusals / violations / stalls.

| arm | what | seeds 0-11 (of 3264) |
|---|---|---|
| hopp | horizon "opp" (rollouts through the opponent's next turn) | 9 heroes: 926 vs 979, **-53** (kayo -24, enigma -15, dorinthea -15; viserai/iyslander +11). DEAD. |
| mu1 | held card worth 1.0 (was 1.5) | 1581 vs 1590, -9: noise |
| mu2 | held card worth 2.25 | 1619 vs 1590, +29 |
| tgt | `laCands` also tries every attack at the hero AND at each ally (gate SPXLATGT) | 1609, +19 (16 of 17 heroes >= 0) |
| gw1 | `laEval` gear term: standing equipment defence, mine minus theirs, 1/point | 1603, +13 |

Second sample (seeds 12-23, `TOURNEY_S0=12`, new base78.s2 measured alongside): see table-s2.txt.
Patches: laX-perhero-probe.patch (main tree), gw-tgt-probe.patch (worktree: laX + gW + tgt).
Runner gotcha: `xargs -L1` splits on spaces — pass each ENV=val as its own word ("$@"), never one string.
A SPX subGate is ON when its env is EMPTY: a probe gate must default OFF or every seat gets it.
Chaos d12 (salt d12, 289 games, 32,559 random legal moves): 0 findings (chaos-d12.txt).
