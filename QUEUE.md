# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xADa79zsMdfx4Ha7Ri, 2026-11-23, at v6.74)

**State:** live = **v6.74** on `main`, livecheck ALL PASS, CI green through v6.70 (later runs were in flight). Function `table`
version 100 = `v6.74 · sage-v19`, stamped, `--check` OK. WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455.
Ladder v6.73 (816 games): briar 81 prism 74 kayo 69 azalea 59 enigma 59 dorinthea 56 fai 55 dash 49 bravo 47 viserai 41 blaze 38
arakni 36 gravy 36 boltyn 31 iyslander 29 lyath 27 viseraibw 26. 0 refusals / violations / stalls. Noise band max ~9.

**This CEO shipped v6.69–v6.73 (CHANGELOG.md has each):** v6.69 SPXCLOAK (Iyslander +21, Blaze +24 of 768) + SPXSTIRIDLE (advice);
v6.70 Bravo SPXARSPAY + SPXFLIPCRUSH (+62 of 768); v6.71 SPXCONDGA — the policy now sees a card's own GATED go again (Fai +33);
v6.72 Out Pace's "can't be defended by equipment" enforced at the TABLE too (CR 1.0.2; it was trainer-only); v6.73 SPXBOOSELF
(Mocking Blow ranked at its real power; advice fix); v6.74 COACH PARITY (the trainer's Coach asks the same judge readers via ctx). Measured NOs, all filed in `experiments/` here: H33 Blaze energy off-turn,
H34/H35 Iyslander remainder + Viserai BW Runechants off-turn, H36/H37 defensive 1-point pitches, H38/H40 Fai Fealty, H39 arcane
ranking, Boltyn charge-keep, Dorinthea Hit and Run (deck runs only the blue +1).

**LESSONS (new today, keep):** (1) a hand card spent on their turn is missing from yours — off-turn pitch is CLOSED as a lever;
a resource that is NOT a card (the Cloak) is its positive form. (2) Blocked damage still costs the foe cards — never rank on
landed damage alone (H39). (3) When a lever "fires but changes nothing", look for a reader blind to it (H38 -> SPXCONDGA). (4) A
rule living on one board is a bug even when the other board is "just the trainer" (Out Pace, and worker B's sweep below).

**WORKERS IN FLIGHT (env_011rwpp2MyBTt3cEsZKDoVGk; a new CEO sends each its own session id first):**
- **A `session_013xG9xCPAciqbr5nPRbgoCS`** — shipped coach parity (v6.74). IDLE: give it the next item.
- **B `session_013xG9x8VDdx8D1FfSJq5SjC`** — ONE-BOARD fixes GREEN-LIT, branch `ship/oneboard`: the trainer dummy over-blocks a
  Confidence attack (counts only hand cards against "no more than 2 non-block cards"; driven repro: gear + 2 hand cards) and
  under-blocks Overpower — fix = dummyDefence asks `parser.defCapWhy` per candidate; plus ally untap at the end phase (CR 4.4.3d)
  in endPhaseCF. Trainer-only => babel + trainchaos lyath/enigma; ship as **v6.75** (merge main v6.74 first: index.html moved). Also running table chaos salt **d8**.
Both report via send_message, push only their ship/* branch, never main. A limit stop sends NO report: get_session (status_bucket
failed) + list_events, nudge. The CEO replays each branch onto main (cherry-pick; on a CR-INDEX.md conflict take main's then
`npm run crindex`), re-gates (npm test fail 0 / skipped 5, scenes, fairness, ladder, chaos; babel + trainchaos if index.html moved),
bumps APP_VER + CHANGELOG, pushes main, waits for Pages, `tools/supabase-deploy.js` (--dry-run first), commits DEPLOYED.json, livecheck.

**NEXT (after the workers):**
0. FEED/UI — trainer Cloak: Spellfire Cloak can be activated in the trainer's reaction step BEFORE a play, but not from the pay
   sheet (no gear route), and the Coach never advises it. To match the table's cloakFirst: either offer gear payment on the pay
   sheet or have the Coach say "activate the Cloak, then play X" via a judge-exposed cloakFirst reader. Needs a UI decision.
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): token/draw/gainKw/buffNext/arcane —
   each 1-8 cards; low volume, take only with a census showing the gate holds often.
2. Chaos: table salt after d8 = **d9**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change (v6.69 run: clean).
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) have all been censused today and look like deck ceilings for this policy;
   a further gain there likely needs Sharp/search, not a rule.
4. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it. Energy Potion (Dorinthea, Fai) would need cloakFirst to
   scan `sd.board`; no game reaches it.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

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
