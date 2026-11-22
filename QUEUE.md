# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x9iZ6h3pqkkhaHmRjq, 2026-11-22, at v6.67; tools-only since)

**State:** live = **v6.67** on `main`, livecheck ALL PASS. Function `table` version 86 = `v6.67 · sage-v19`, stamped, `--check` OK.
**WIRE_V 49** (`boardcost`). DATA_VER sage-v19. 17 heroes. Branch `claude/elegant-einstein-st9zq6` = main + `tools/trainchaos.js` + its CLAUDE.md line (tools only, NOT on main yet: merge it with the next release).
page.js 89/89 at 393x852 as of v6.66. **Approximation ledger: 0 open** (21 stated, 42 closed). Pool 455/455 full.

**Shipped today:**
- **v6.66 rules:** Runebleed Robe's "destroy this and a Runechant you control" asks WHICH when a token and a Runechant of
  Lust/Sloth are both there (CR 1.8.8). `parser.boardCostOffer`, judge `boardcost` pending (3 activation routes), trainer
  `boardpick` (both doors), `_destroyUid` in HELD_DECL, AI `judge.boardCostAnswer`. Closed the ledger's last open record.
  Drill test/boardcost.test.js. Unreachable with today's built decks (Robe = Viserai, Lust/Sloth = Viserai BW).
- **New tool `tools/chaos.js`** (in CLAUDE.md's validation list): random LEGAL moves mixed into self-play at rate EPS; reports
  legal/reduce disagreement, throws, invariants, NO-ZONE, wire round-trip + replay divergence (the two phones), view throws,
  rule-policy and Sharp refusals. ~1M random legal moves over the day across all 289 pairings: **0 engine findings.**
- **v6.67 AI:** the one finding — a payment over-pitched by someone else got `payConfirm` (refused); now `payBack` takes a card
  back. Ladder byte-identical to v6.66. Drill test/payback.test.js.

**NEXT, in order:**
0. **Chaos, further** (cheap, high yield for "a person could, the policy never did"):
   (a) DONE (session_013xG9x9iZ6h3pqkkhaHmRjq): **`tools/trainchaos.js`** taps random enabled buttons on the REAL page (page.js
   offline, 393x852) through whole trainer games, every hero; reads pageerror/console.error and `window.__dawnJudge`. 56 games, all to
   game over, **0 findings** (an earlier 18 found only the tool artifact below). Lesson in its header: two `.click()`s in ONE page task both read the pre-render closure and a peeked
   card commits twice (CARD-DUP-IN-ZONE) — not reachable by a thumb (React flushes between real events), so taps are separate tasks.
   Next: more seeds (`node tools/trainchaos.js '' 3 3`, ~45 min); run it after any `Battle` change (CLAUDE.md lists it).
   (b) chaos on the STAGED decks before they open (`tools/staged-play.js` builds them) — waits for Outbreak.
   (c) table chaos: d1–d5 done, 2,023 games, 761,284 random legal moves, 0 findings (d4 EPS 0.4, d5 EPS 0.6 this session). Next salt: d6.
1. Weakest ladder seats (rule policy, 48 games each, v6.65 ladder): Viserai BW 22, Lyath 28, Iyslander 33, Gravy/Blaze 34 of 96.
   Lyath looks like a deck/halving ceiling; BW is strong under Sharp (the page's AI). Prefer correcting advice over chasing wins:
   run `never.js <hero> 1` for each and look for a printed play the call never offers. Done for BW/Gravy/Blaze/Lyath
   (2026-11-22): left untried — BW's Runechant of Sloth/Lust off-turn (43/0, 35/0; likely loses the usurp synergy),
   Gravy's Timesnap Potion (62/2) and Jittery Bones (67/8).
2. Spellfire Cloak as a payment source on the opponent's turn (instead of pitching a card) — only if a census shows the off-turn
   pitch is often a card she needed. A/B per the habits.
3. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** censuses in `experiments/census/` (copy out with `git archive origin/findings/queue experiments | tar x`; they require
main's tools by absolute path): `never.js <hero> <seeds>` (legal vs used), `instead.js <hero> <seeds> "<card>"` (what was played
instead), `endaura.js <hero> <seeds>` (what was still castable at the turn's last action, new). **An experiment can surface an engine
bug — read INVARIANT VIOLATIONS and REFUSALS in every A/B, not only the win count** (v6.64's two fixes came from one). A/B:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min on 4 cores. **A subGate is ON when its
env var is empty** — an experiment you do not ship must be deleted, not left gated. A new reason key moves test/explain.test.js's
unreached pin; a newly reached prompt field moves test/speccensus.test.js; a new judge-only parser reader moves test/keycensus.test.js.
After pushing main, curl until the page serves the new APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.
