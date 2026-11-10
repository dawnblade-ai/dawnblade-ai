# Misplay census at v6.18 (aa5f7f4), Sharp on the hero's seat, 84 games/hero

Drivers (paths inside are absolute to the worker's checkout; edit `R` to rerun):
- `census.js <heroes> [rule]` — flags read off the state before each hero action; one JSON line per hero.
- `drive.js <flag> <a> <b> <seed> <first> <hero>` — replays one census game to its first flag and prints the decision.
- `disagree.js <hero>` — in rule-policy games, where Sharp would decide differently, by Steady's call key.
- `perm.js <heroes>` — Sharp vs Steady when Steady plays an ally/aura/item.
- `ab.js <hero> <seed> <rule|sharp>` + `sum2.js` — own-seat A/B (28 games/seed), paired summary.

Headline: v6.15's SPXGRANTSWING costs Lyath's own seat 4.33 wins of 28 on the rule policy
(7.42 -> 3.08, t -7.45, 12/12 seeds; `ab-grantswing-lyath-rule-12seeds.jsonl`, "on" = shipped default,
"off" = gate on for every seat but Lyath's). On Sharp it is noise (14.67 -> 14.17, 6 seeds).
