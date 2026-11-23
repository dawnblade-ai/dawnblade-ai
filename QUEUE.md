# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xC8LtKqHaSNpJD2zxV, 2026-11-23 afternoon, at v6.77 — session ENDED clean)

**State:** live = **v6.77** on `main` (+ a docs-only roadmap commit), livecheck ALL PASS. Function `table` v106 = `v6.77 · sage-v19`,
stamped, `--check` OK. WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. Noise band max ~9.
**WORKERS: NONE IN FLIGHT** (E F G H I all archived; each cost $0.6-0.9 on Sonnet, ~20-45 min).

**This CEO:** v6.77 = Sharp ~1/3 faster with decisions byte-identical (types.cardType memo per card object, parser norm/clean memo)
+ the effects.js second-person ledger became an exact allow-list (the one feed line fixed) + chaos d11 (also EPS=0.6) and trainchaos
54 games CLEAN. Ladder 816 0/0/0, 3 draws. **THE PHONE BOUND IS MET** on the page at 4x throttle (cloud box): every hero p95 <= 90 ms,
worst 236 (`experiments/phone-v677/RESULT.md`); only a real-iPhone check is open (DESKTOP-TASKS.md). **Outbreak probe:**
`docs/OUTBREAK-PROBE.md` on main — upstream `outbreak` has SLV 4 + SFC 1 + a 41-card OBK set; no lists (fabrary.net 403); reader
build order recorded; Cure/Veil are not in the CR yet. The two earlier CEOs today shipped v6.69-v6.76 (CHANGELOG.md; old handoff text
in git history of this file).

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours — off-turn pitch is CLOSED; a resource that is not a
card (the Cloak) is its positive form. (2) Blocked damage still costs the foe cards — never rank on landed damage alone. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) NEW: Sharp's budget is
engine STEPS, so making a step cheaper is decision-identical by construction — prove it with sha256 of full action logs; the profile
is now flat (no single function >5%).

**How to run the shop (works well):** one Sonnet worker per item via create_session with a SELF-CONTAINED prompt (git log of this
file 2026-11-23 has the shape: rules preamble + one task + "report with send_message to the CEO session, then stop"). Workers push
only ship/<letter>-*, never main, never bump APP_VER. Archive each on its report. A limit stop sends NO report: set a send_later
check-in (~90 min), then get_session + list_events. The CEO cherry-picks onto main (CR-INDEX.md conflict: take main's, `npm run
crindex`), re-gates (npm test fail 0 / skipped 5, scenes, fairness, `npm run play '' '' 3`, chaos; babel + trainchaos if index.html's
babel blocks moved), bumps APP_VER + CHANGELOG, pushes main, curls until Pages serves the new APP_VER, `tools/supabase-deploy.js`
(--dry-run first), commits DEPLOYED.json, `node tools/livecheck.js`. Next worker letter: J.

**NEXT:**
00. **SPEND THE HEADROOM ON STRENGTH (best next lever).** v6.77 left every hero's page p95 at <= 90 ms against a 150 bound, and
   the weakest seats (item 3) look like deck ceilings for the RULE policy — so the gain is in Sharp. Try a bigger own-turn budget
   (`SPXLA_B`, today 300 steps) and/or more determinizations (`LA.dets`): A/B strength per CLAUDE.md (hero's own seat, 12 seeds,
   24 if inside noise), then re-measure the page with `experiments/phone-v675` time.js (H's method, `experiments/phone-v677`) —
   ship only if p95 stays < 150 and worst < 400 at 4x throttle. Also open: a real-iPhone measurement (DESKTOP-TASKS.md).
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): token/draw/gainKw/buffNext/arcane —
   each 1-8 cards; low volume, take only with a census showing the gate holds often.
2. Chaos: d8-d11 CLEAN (289 games each; d11 also EPS=0.6, v6.77); next **d12**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change (v6.69 run: clean).
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) have all been censused today and look like deck ceilings for this policy;
   a further gain there likely needs Sharp/search, not a rule.
4. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it. Energy Potion (Dorinthea, Fai) would need cloakFirst to
   scan `sd.board`; no game reaches it.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md (reader build order). Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** OBK-only heroes (Azalea's new card, Huxley, Min, Vyle) in Dawnblade scope? (default: precon lists only); the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
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
