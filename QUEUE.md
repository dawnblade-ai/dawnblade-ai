# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8nRjrUMDyVuG21srj, 2026-11-22, at v6.68)

**State:** live = **v6.68** on `main`, livecheck ALL PASS. Function `table` version 88 = `v6.68 · sage-v19`, stamped, `--check` OK.
**WIRE_V 49** (`boardcost`). DATA_VER sage-v19. 17 heroes. Session branch `claude/friendly-shannon-a0k6f5` == main (trainchaos merged).
page.js 89/89 at 393x852 as of v6.66 (no UI change since). **Approximation ledger: 0 open** (21 stated, 42 closed). Pool 455/455 full.
Ladder v6.68 (rule policy, 816 games, 48 each): briar 81 prism 76 kayo 71 azalea 61 dorinthea 59 enigma 57 dash 49 fai 48 bravo 44
viserai 41 arakni 39 iyslander 35 boltyn 35 blaze 34 gravy 34 lyath 28 viseraibw 22. 0 refusals / violations / stalls.

**Shipped today (v6.68):** Iyslander casts an ARSENAL Frost Spike on the opponent's turn: two Frostbites (spike + hero trigger).
`judge.oppTurnTrigger` / `oppTurnTriggerPlay`, SPXOPPICE, reason `oppIce`, drill test/oppice.test.js. Own seat 75->79, other 60->62 of 192.
**THE LESSON, twice in one day: a hand card cast off-turn is a pitch card missing from your own turn.** Iyslander hand-cast 75->67;
Blaze hand-cast of Cindering Foresight (any colour) 64->48. Off-turn casts ship from the ARSENAL (unpitchable) or not at all, unless
the census shows the pitch was not needed. Also: a reader that names a whole talent ("Ice") held Ice Bolt too: 75->21. Name the kind.
Closed, no gap: Gravy's Timesnap Potion and Jittery Bones (both blue pitch cards; Gravy ends turns with an empty hand).
Chaos: table salt d6 (EPS 0.3, 289 games) + Iyslander salt `ice` (EPS 0.4): 0 findings.

**WORKERS IN FLIGHT (assigned 2026-11-22 ~21:50Z by CEO session_013xG9xADa79zsMdfx4Ha7Ri, env_011rwpp2MyBTt3cEsZKDoVGk):**
- `session_013xG9xCPAciqbr5nPRbgoCS` (Opus) — NEXT 1 done (negative); now NEXT 3: Iyslander remaining cards + Viserai BW census; pushes ONLY `ship/blaze-energy-offturn`.
- `session_013xG9x8VDdx8D1FfSJq5SjC` (Opus) — NEXT 4 Spellfire Cloak census + NEXT 3 Boltyn census; pushes ONLY `ship/cloak-boltyn-census`.
Both report via send_message to the CEO; neither pushes main. A limit stop sends NO report: check with get_session
(status_bucket failed) / list_events and nudge. A new CEO tells both its session id. The CEO replays + re-validates + ships.

**NEXT, in order:**
1. ~~Blaze off-turn, energy -> arcane cast~~ **CLOSED NEGATIVE (worker A, 2026-11-22)**: ~95% of what an off-turn cast spends is
   next turn's card (taker held into the next opp turn 4%, its pitch cards 6%); 12 seeds own/other of 192: off 64/61, first window
   48/49, late window 57/50, lethal-only 64/61. 0 refusals/violations. Cards limit Blaze, not energy; his hero banishes from HAND,
   so no arsenal version exists. `experiments/H33-blaze-energy-offturn-{NEGATIVE.patch,NOTES.md}`, census/blazeoff-*.js.
2. Chaos, further: trainer (`node tools/trainchaos.js '' 3 3`, ~45 min, after any `Battle` change); table salt d7 CLEAN (289 games, EPS 0.3, 0 findings, 2026-11-22); next salt **d8**; staged decks
   wait for Outbreak (`tools/staged-play.js`).
3. Weakest seats, by census (`never.js <hero> 1`): not yet run for Boltyn (35) or Iyslander's remaining cards; Lyath is a deck ceiling.
   Untried: Viserai BW's Runechant of Sloth/Lust off-turn (43/0, 35/0 — likely loses the usurp synergy).
4. Spellfire Cloak as the off-turn payment (Iyslander, Blaze: 251/0, 276/0). By today's lesson it is the RIGHT kind of off-turn
   resource (it costs no hand card), so a census is worth it: how often does an off-turn payment pitch a card the next turn needed?
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
