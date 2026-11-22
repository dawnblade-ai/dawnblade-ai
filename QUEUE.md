# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xADa79zsMdfx4Ha7Ri, 2026-11-22, at v6.70)

**State:** live = **v6.70** on `main`, livecheck ALL PASS. Function `table` version 92 = `v6.70 · sage-v19`, stamped, `--check` OK.
**WIRE_V 49**. DATA_VER sage-v19. 17 heroes. Approximation ledger: 0 open. Pool 455/455.
Ladder v6.69 (816 games, 48 each): briar 81 prism 76 kayo 71 dorinthea 60 azalea 59 enigma 57 dash 50 fai 48 viserai 42 bravo 42
blaze 39 arakni 38 gravy 37 boltyn 32 iyslander 30 lyath 28 viseraibw 24. 0 refusals / violations / stalls (2 draws). Noise band max 9.

**Shipped v6.70:** Bravo SPXARSPAY (arsenal never stores a card next turn cannot pay, `judge.arsenalPayable`) + SPXFLIPCRUSH
(hero flip only when the rider applies, before the attack; `judge.arsTurnPays`, one body `parser.arsGrantMet`): **309 -> 371 of
768**. Dash's 19/199 changed arsenal steps are late-game empty-deck cases (correct; 12 seeds neutral). Trainer chaos v6.69 clean.
**The new shape to hunt: a free/cheap ability the policy never looks at** (Bravo's flip; Fai's Fealty 221/0 — worker A on it).

**Shipped today (v6.69):** SPXCLOAK (`cloakPay`: Spellfire Cloak pays an off-turn cost when the seat's own line, played out
both ways, pitches fewer cards; Iyslander 287->308, Blaze 246->270 of 768 at 24 seeds/chair; phone p95 9 ms) and SPXSTIRIDLE
(advice fix: an arsenal Stir with no taker is held; `judge.instantNextTakers`). Measured NOs: Blaze energy off-turn, Viserai BW
Runechants off-turn, Boltyn charge-keep. **The off-turn lesson held four times; the Cloak is its positive form (a resource
that is not a card).** Latent: Energy Potion (Dorinthea, Fai) would need cloakFirst to scan `sd.board`; no game reaches it.

**Lesson sweep (worker A, `experiments/census/offsweep.js`, rerun after any off-turn policy change):** every off-turn play from hand,
forked to see what its pitch would have done. Only defence plays pitch next turn's card >70%. Both candidates NOISE at 24 seeds:
H36 Lyath boo only for leak >= 2 (230 -> 228 of 768; the Might token pays), H37 hold 1-point defence reactions (blaze +6, enigma -4,
iyslander +4). `experiments/H36-H37-NOTES.md`. Off-turn pitch is now closed as a lever.

**H38 Fai Fealty — ZERO effect (`experiments/H38-fai-fealty-NOTES.md`):** spending Fealty fires but changes nothing, because
**`judge.keepsActionPoint` cannot see CONDITIONAL go again** (cond-gated `ga`: drac2 Cinderskin Devotion / Hot on Their Heels /
Enflame / Display Loyalty, lifeLt Scar for a Scar). Worker A on SPXCONDGA (via `effects.gatesMetNow`); Fealty re-measured after.

**Never-sweep v6.70 (worker B, 16 heroes, legal>=50 / used<=5%):** the "free ability never looked at" shape does NOT recur.
Own-turn abilities are used or have nothing to pay; off-turn ones all cost a hand card (out by the lesson). Leads: Blaze Aether
Quickening 1/96 played (arcane ranked like physical power; worker B on SPXARCRANK); Dash Hyper Driver 51/2 (expected noise, skipped).

**WORKERS IN FLIGHT (assigned 2026-11-22 ~21:50Z by CEO session_013xG9xADa79zsMdfx4Ha7Ri, env_011rwpp2MyBTt3cEsZKDoVGk):**
- `session_013xG9xCPAciqbr5nPRbgoCS` (Opus) — shipped SPXSTIRIDLE (v6.69), SPXARSPAY/SPXFLIPCRUSH (v6.70); now Fai Fealty (SPXFEALTY) — pushes ONLY `ship/fai-fealty` (and its earlier ship/* branches).
- `session_013xG9x8VDdx8D1FfSJq5SjC` (Opus) — shipped SPXCLOAK (v6.69); trainchaos clean; never-sweep done; now SPXARCRANK (arcane vs physical ranking, Blaze first) on `ship/arcane-rank`.
Both report via send_message to the CEO; neither pushes main. A limit stop sends NO report: check with get_session
(status_bucket failed) / list_events and nudge. A new CEO tells both its session id. The CEO replays + re-validates + ships.

**NEXT, in order:**
1. ~~Blaze off-turn, energy -> arcane cast~~ **CLOSED NEGATIVE (worker A, 2026-11-22)**: ~95% of what an off-turn cast spends is
   next turn's card (taker held into the next opp turn 4%, its pitch cards 6%); 12 seeds own/other of 192: off 64/61, first window
   48/49, late window 57/50, lethal-only 64/61. 0 refusals/violations. Cards limit Blaze, not energy; his hero banishes from HAND,
   so no arsenal version exists. `experiments/H33-blaze-energy-offturn-{NEGATIVE.patch,NOTES.md}`, census/blazeoff-*.js.
2. Chaos, further: trainer (`node tools/trainchaos.js '' 3 3`, ~45 min, after any `Battle` change); table salt d7 CLEAN (289 games, EPS 0.3, 0 findings, 2026-11-22); next salt **d8**; staged decks
   wait for Outbreak (`tools/staged-play.js`).
3. Weakest seats, by census (worker A, 2026-11-22; `experiments/H34-H35-NEXT3-NOTES.md`): Iyslander's low-use cards are blue
   pitch/blockers doing their job. **MISPLAY:** Stir the Aetherwinds cast off-turn from the arsenal (SPXOPPARS) 16x/96 games, each
   pitching hand cards, never followed by a Wizard card. SPXSTIRIDLE (`judge.instantNextTakers`) is win-noise (24 seeds 287->284 of
   768) but corrects the call: worker A is finishing it (drill + CALL_WHY) to ship as an advice fix. Viserai BW Runechant of
   Lust/Sloth off-turn: NEGATIVE (114 -> 94 / 100 of 384; destroyed at his action phase, never usurped). Viserai BW and Lyath look
   like deck ceilings. Boltyn: worker B. Unmeasured, low value: Gate to i'Arathael activation (98/0, 71/0).
4. ~~Spellfire Cloak as the off-turn payment~~ **SHIPPING v6.69 (worker B, SPXCLOAK, key `cloakPay`)**: census 70/130 of Iyslander's
   off-turn pitches were one card for one last point with the Cloak legal. v2 plays the seat's own line out both ways (opponent
   passes only) and spends the piece only when fewer cards are pitched. 24 seeds/chair: Iyslander 287->308, Blaze 246->270 of 768.
   Boltyn: charge-keep (`experiments/H33-boltyn-chargekeep-NOISE.patch`) 238->244 noise; Glisten off-turn not a line; deck ceiling.
5. Compass of Sunken Depths (Gravy) — skip unless Sharp's mask learns it (view.js).
6. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

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
