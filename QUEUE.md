# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAXQ9r9hWnresN2KmP, 2026-11-22, at v6.62)

**State:** live = **v6.62** on `main`, livecheck ALL PASS (at v6.60 a first run reported 1 failed check that reruns did not
reproduce — watch for a flaky server-table check). Function `table` version 76 = `v6.62 · sage-v19`, stamped, `--check` OK. **WIRE_V 46**
(`hist.dmg`). DATA_VER sage-v19. 17 heroes. Session branch `claude/determined-curie-6rl15k` == main.

**Shipped v6.62:** SPXARSPOW (`judge.arsenalPower`): the arsenal step ranks on power FROM the arsenal, so Lyath's Power Play
(+5 from arsenal) is stored and swung (Lyath 126 -> 127, noise; ships for the advice). Ladder clean. Note: `never.js` does not
count arsenal plays reliably — `experiments/census/arsenal.js` / `arsenal-trace.js` follow the stored card instead.

**Shipped v6.61:** a zoomed card's keywords open their CR rules (`CardKw` in `CardModal`, every board); the hero sheet prints the
hero card's ability verbatim. page.js 88/88. **Settled: Sharp is NOT worse on Viserai BW** — own seat only (`SPXLA=viseraibw`) he
wins 277/384 vs the rule policy's 115 (the v6.59 "104" had Sharp in every seat); the wall search is worth 69 of those.

**Shipped v6.60** (CHANGELOG has every number):
- **Keywords on the hero banner/sheet, tap for the CR definition.** `cards.deckKeywords` (from `card_keywords`, params folded,
  deck-building keywords out) + `cards.crKeyword` over **`data/crkw.js`** — pinned verbatim from CR chapter 8 by
  **`tools/pin-crkw.js`** (130 rows; `--check` each release cycle, CLAUDE.md says so). Drill test/crkw.test.js; page.js 86/86.
- **Rules: `dealtDmg` reads `hist.dmg`** (damage that landed, hero or ally) — approx `dealt-damage-reads-attacks` CLOSED (open 1 left:
  `destroy-a-runechant-cost-unasked`, which never arises: the Robe is in Viserai's list, the special Runechants in Viserai BW's).
  Briar 164 -> 156 of 192 (Second Strike no longer goes again after a blocked swing). Ladder clean.
- **SPXBANFIRST**: on a power/cost tie the banished copy is played first (Viserai BW 114 -> 115, ships for the advice).
- Ruled out: Sharp skipping the Embrace Ursur lead (keeps it 13/16); Viserai BW's Gloomblades in banish (never left unplayed at
  end of turn; misses are fair rankings). Censuses: `experiments/census/sharprider.js`, `over.js`, `banins.js`.

**NEXT, in order:**
1. The in-game peek (`PeekDock`, tap-to-close) shows no keywords; a newcomer mid-game meets "Phantasm" there first. A keyword line
   that does not steal the closing tap (POLISH condition 1) — design it at 393x852 before building.
2. AI census next targets: the weakest ladder seats (Viserai BW 22, Lyath 29, Iyslander 32 of 96). Lyath's other rows: Brothers in
   Arms 47/8, Act of Glory 27/5 (own turn) — run `instead.js`. Then Iyslander.
3. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
4. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). **A better census asks what was played INSTEAD**
(`experiments/census/instead.js <hero> <card>`, new): legal-vs-used counts flag cards that simply lost a fair ranking. Prompt answers
hide too: grep the census for `declineOptional` per sheet `src`. A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min (Sharp: prefix `SPXLA=all`, ~15 min at 12 seeds). **A subGate is ON when its env var is
empty** — an experiment you do not ship must be deleted, not left gated. After pushing main, curl until the page serves the new
APP_VER, THEN `tools/supabase-deploy.js`, THEN livecheck.
