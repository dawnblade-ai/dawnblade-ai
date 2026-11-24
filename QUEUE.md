# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xCCHmaDbKTPm38cqzb, 2026-11-24 afternoon, at v6.79)

**State:** live = **v6.79** on `main`, unchanged this session (nothing measured positive, so nothing shipped). Function `table` v110 =
`v6.79 · sage-v19`. WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS: NONE** (J and K reported, archived).

**This CEO (all DEAD, 0 refusals / violations in every run; files under `experiments/` on this branch):**
- **Arsenal search** (CEO, `arsenal-search-v679/`): Sharp picks the face-down card by playing each out through the foe's turn and its
  own next turn. -26 of 3264 (margin 3: -6, noise). The rule's "best attack face down" holds.
- **Pitch-choice search** (worker J, `j-pitchsearch/`): 64% of own-turn payments have a real alternative card, but the score cannot tell
  them apart (flat mu, own horizon ends after the draw-up): +8 of 6528 over 24 seeds, Gravy -21.
- **Hand worth by printed numbers** (worker K, `handworth/`): def-weighted hand in laEval -19; arsenal card by power -114 (Sharp hoards);
  the same def term in the block search -40.
- **Gravy is the canary, not a bug:** it lost in every arm because it leans on Sharp most: rule policy 23 wins of 384 vs Sharp 89.
- Chaos **d14 and d15 CLEAN** (289 games each, ~33.6k random legal moves). Next salt **d16**.
- v6.79's base reproduces exactly on main (dash 108, lyath 59, arakni 106): the `tgt` files in `search-shape-v678b/` ARE the v6.79
  base for seeds 0-11 (`*.tgt.txt`) and 12-23 (`*.tgt.s2.txt`). Reuse them; do not remeasure.

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours. (2) Blocked damage still costs the foe cards. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Making a step cheaper is
decision-identical by construction (sha256 the action logs). (6) A search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` 0. (7) `xargs -L1` splits on spaces: each ENV=val its own word; one result file per run.
(8) NEW: **Sharp's search is saturated in shape AND score.** Budget, horizon, mu, dets, targets (shipped), arsenal, pitch, hand
worth and gear have all been measured. Everything that looks past this turn's end or prices specific held cards LOSES. A new choice
the score cannot tell apart ties to A0 and measures flat. Do not open another search-shape probe without a new instrument.

**How to run the shop:** unchanged (QUEUE-ARCHIVE.md). Workers = Sonnet via create_session, self-contained prompt; this session's
prompt preamble (`experiments/WORKER-PROMPT-PREAMBLE.txt`) worked first time for both (rules + measurement + base files + report-and-stop), at ~$0.80 each. Next letter: **L**.

**NEXT:**
00. **Strength now lives in the ROLLOUT POLICY, not the search.** Sharp plays the rule policy (`actBase`) inside every rollout, so
   a better rule is a better Steady AND a better Sharp. Census the weakest seats (viseraibw 43, boltyn 47, lyath 59, gravy 41 of 192)
   with `never.js` / `calls.js` for a decision the rule gets wrong, then fix it as a rule (SPX gate, A/B the hero's seat with SPXLA=all).
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): low volume, take only with a census.
2. Chaos: d8-d15 CLEAN; next **d16**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change.
3. Compass of Sunken Depths (Gravy), Energy Potion (Dorinthea, Fai) — skip unless a game reaches them.
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md. Also open: a real-iPhone
   timing (DESKTOP-TASKS.md).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action), **`calls.js <hero> <seeds> "<card>"` (new:
every call that touched the card — played/pitched/blocked/arsenalled, own or opp turn, with the reason key)**. Each runs in ~10 s at 1 seed.
**An experiment can surface an engine bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count.** A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores; a variant probe is an env
var read inline (delete it after; keep the diff as `experiments/*.patch`). **A subGate is ON when its env var is empty.** A result
inside ~10 wins of 192 at 12 seeds is noise: go to 24 seeds (new seeds 12-23 are the honest second sample). A new reason key moves
test/explain.test.js's unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves
test/keycensus.test.js. `npm test` rewrites CR-INDEX.md line numbers: `npm run crindex` before committing. After pushing main, curl
until the page serves the new APP_VER, THEN `tools/supabase-deploy.js` (--dry-run first), commit DEPLOYED.json, THEN livecheck.
