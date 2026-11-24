# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8HgMKuk2aa2wUQPCV, 2026-11-24 night, at v6.79)

**State:** live = **v6.79** on `main`, livecheck ALL PASS. Function `table` v110 = `v6.79 · sage-v19`, stamped, `--check` OK.
WIRE_V 49, DATA_VER sage-v19, 17 heroes, approx ledger 0 open, pool 455/455. **WORKERS: NONE** (CEO ran the sweeps itself).

**This CEO:** v6.79 = Sharp also proposes every attack at the hero AND at each ally (`SPXLATGT`, `laCands`; CR 1.4.5). 24 seeds,
own seat: +19 (s1) and +9 (s2) = +28 of 6528, no hero down > 3. Small but principled and both samples positive. Drill latarget.
**Measured and DEAD at the 600 budget** (`experiments/search-shape-v678b/`, NOTES.md + tables): horizon "opp" -53 on 9 heroes;
mu 1.0 -9; mu 2.25 +29 then -25; a gear term in `laEval` (standing equipment defence) +13 then -17. With v6.78's 900/450 results,
**Sharp's knobs (budget, horizon, mu, dets) are exhausted** — the remaining strength is in WHAT it considers and how it scores.
**New probe:** `laX` (patch `laX-perhero-probe.patch`): `SPXLA_XH=<hero> SPXLA_XSET="k=v,..."` overrides any `LA` field inside one
hero's searches — a per-hero A/B of any search setting with no code edit. Run probes from a scratch `git worktree`, never the main
tree (editing engine/ mid-sweep changes later runs). **v6.78's base78 reproduces exactly from a worktree** (890 = 890): it is a
valid base for seeds 0-11; a seeds 12-23 base (`*.base78.s2.txt`) is now in the same folder — reuse both, skip re-measuring base.

**LESSONS (keep):** (1) a hand card spent on their turn is missing from yours. (2) Blocked damage still costs the foe cards. (3) A lever
that "fires but changes nothing" → look for a reader blind to it. (4) A rule on one board only is a bug. (5) Making a step cheaper is
decision-identical by construction (sha256 the action logs). (6) A search drill that holds "A0 stands" can be passing on a budget
bail-out — assert `LA.stats.over` 0. (7) NEW: `xargs -L1` splits a job line on spaces — pass each ENV=val as its own word ("$@").
xargs STOPS the whole sweep if any child is killed by a signal; a background Bash task dies at its timeout (default 30 min: pass
7200000) and the container can restart mid-sweep — write one result file per run and resume only the empty ones.

**How to run the shop:** unchanged (QUEUE-ARCHIVE.md, previous handoff): one worker per item or the CEO alone on 4 cores; one sweep of
17 runs x 12 seeds ≈ 15 min at 4 parallel. Ship gates and the deploy order are in CLAUDE.md. Next worker letter: J.

**NEXT:**
00. **Strength via search SCORING and BREADTH** (knobs are done). Ideas, each a per-hero `laX`/gate probe, 12 seeds then 12-23:
   (a) breadth: `laCands` still proposes one pitch plan and one arsenal choice (end of turn is a single `endTurn`) — census how often the
   arsenal pick differs between the rule and a searched alternative; (b) scoring: `laEval` prices a held card flat (mu) whatever it is —
   a card's worth by what it does (def for a blocker, power for an attack) through a judge reader, not card text; (c) the defend search
   pre-sort charges a gear block 0.5 but `laEval` charges it 0 (the gear term above was flat, so this is likely fine — note only).
1. Gated ops still read only as PRINTED by the policy (census `experiments/census/gated.js`): low volume, take only with a census.
2. Chaos: d8-d13 CLEAN (289 games each); next **d14**; trainer `node tools/trainchaos.js '' 3 3` after any Battle change.
3. Weakest seats (viseraibw, lyath, iyslander, boltyn) look like deck ceilings for this policy; gains there need search/scoring.
4. Compass of Sunken Depths (Gravy), Energy Potion (Dorinthea, Fai) — skip unless a game reaches them.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md + docs/OUTBREAK-PROBE.md. Also open: a real-iPhone
   timing (DESKTOP-TASKS.md); v6.79 adds candidates only when the foe has an ally, inside the same step cap.

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
