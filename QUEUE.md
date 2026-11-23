# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xB8VHgWznFkVzaV77n, 2026-11-23 evening, at v6.78)

**State:** live = **v6.78** on `main`, livecheck ALL PASS. Function `table` v108 = `v6.78 · sage-v19`, stamped, `--check` OK.
WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS: NONE** (this CEO ran everything itself on
the 4 cores — cheaper than workers for A/B sweeps; one sweep of 51 runs x 12 seeds = ~45 min).

**This CEO:** v6.78 = Sharp's OWN-TURN search budget 300 -> 600 steps (`LA.budgetOwn`, env `SPXLA_BO`; the defend search keeps
`LA.budget` 300). A/B each hero's own seat, 24 seeds (two samples): 3215 -> 3300 of 6528, no hero down > 1; 2 determinizations
won the same (3303) at 2x steps and cost Arakni 18 — not taken. Page at 4x: max p95 110 (own 123 fai), worst 194. Evidence:
`experiments/sharp-budget-v678/` (tables, run.sh, time2.js = H's time.js + XB/XK/TAG env). A drill (aiqa "does not bin a known
arrow") had been passing on a BUDGET BAIL-OUT; moved az6 -> az10 and now asserts `over` 0 / `unverified` >= 1. `tools/tourney.js`
takes `TOURNEY_S0=12` (seeds 12-23 without re-running 0-11). **RULING (user, 2026-11-23): only cards a precon list prints** —
recorded in CLAUDE.md, ROADMAP-NEWDECKS.md, docs/OUTBREAK-PROBE.md.
**Budget is SATURATED at 600 (measured after the ship, v6.78 baseline, 12 seeds, own seat):** own-turn 900 = 1592 vs 1590,
defend budget 450 = 1598 vs 1590 of 3264 — both noise, 0 refusals/violations (`table2.txt`). Do not spend more steps; spend
them DIFFERENTLY (below). Per-hero probe: `experiments/sharp-budget-v678/perhero-budget-probe.patch` (SPXLA_XH + XB/XBO/XK).

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours — off-turn pitch is CLOSED; a resource that is not a
card (the Cloak) is its positive form. (2) Blocked damage still costs the foe cards — never rank on landed damage alone. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Sharp's budget is
engine STEPS, so making a step cheaper is decision-identical by construction — prove it with sha256 of full action logs; the profile
is now flat (no single function >5%). (6) NEW: a search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` is 0 before trusting it.

**How to run the shop (works well):** one Sonnet worker per item via create_session with a SELF-CONTAINED prompt (git log of this
file 2026-11-23 has the shape: rules preamble + one task + "report with send_message to the CEO session, then stop"). Workers push
only ship/<letter>-*, never main, never bump APP_VER. Archive each on its report. A limit stop sends NO report: set a send_later
check-in (~90 min), then get_session + list_events. The CEO cherry-picks onto main (CR-INDEX.md conflict: take main's, `npm run
crindex`), re-gates (npm test fail 0 / skipped 5, scenes, fairness, `npm run play '' '' 3`, chaos; babel + trainchaos if index.html's
babel blocks moved), bumps APP_VER + CHANGELOG, pushes main, curls until Pages serves the new APP_VER, `tools/supabase-deploy.js`
(--dry-run first), commits DEPLOYED.json, `node tools/livecheck.js`. Next worker letter: J.

**NEXT:**
00. **Strength via search, continued.** v6.78 took own-turn 600; more steps (900) and a bigger
   defend budget (450) are flat. Remaining levers are SHAPE, not size: (a) `laCands` breadth — what lines the search even
   considers (census which A0-overrules exist vs which candidates were never listed, gravy/boltyn/viseraibw first); (b) horizon
   "opp" was flat at 300 — retest at 600 now that the cap no longer bites; (c) `mu`/`bMu` (held-card worth) sweep at the new
   budget; (d) 2 dets only for heroes that gained (azalea +14 extra, lyath, viseraibw) is cherry-picking — skip unless a principle
   (e.g. dets for decks with random reveals) explains it. Each: per-hero probe, 12 seeds, then 12-23 with TOURNEY_S0. Also open: a real-iPhone
   measurement (DESKTOP-TASKS.md). Weak-seat ideas: Sharp's `laCands` breadth (what candidates it even considers) for gravy/boltyn.
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): token/draw/gainKw/buffNext/arcane —
   each 1-8 cards; low volume, take only with a census showing the gate holds often.
2. Chaos: d8-d11 CLEAN (289 games each; d11 also EPS=0.6, v6.77); next **d12**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change (v6.69 run: clean).
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) have all been censused today and look like deck ceilings for this policy;
   a further gain there likely needs Sharp/search, not a rule.
4. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it. Energy Potion (Dorinthea, Fai) would need cloakFirst to
   scan `sd.board`; no game reaches it.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md (reader build order). Wire: next cut if needed is HZOOM (~500 B/seat).

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
