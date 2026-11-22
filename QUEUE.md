# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8yu495hm1tWftyUNr, 2026-11-22, at v6.64)

**State:** live = **v6.64** on `main`, livecheck ALL PASS. Function `table` version 80 = `v6.64 · sage-v19`, stamped, `--check` OK.
**WIRE_V 47** (a held layer's `frostAt`). DATA_VER sage-v19. 17 heroes. Session branch `claude/quirky-newton-rbqe42` == main.
page.js 89/89 at 393x852 (deps: `npm install --prefix <scratch>/pagedeps ...` per its header, ~1 min; `PAGE_DEPS=` + `NODE_PATH=$(npm root -g)`).

**Shipped v6.64:**
- **Rules (a real engine bug, found by an AI experiment):** a Frostbite made while a play waits on the table's stack taxed that
  already-paid play at resolution (resources to -1, NEGATIVE-RES 784x/192 games). `holdPlay` records `frostAt`, `resolveHeld` sets late
  Frostbites aside. Drill test/frostheld.test.js. **Same class, not checked:** any OTHER cost modifier born in the window (a `costOff`
  discount, a `nextTurn` tax) is also read at resolution, not at the play — a discount would refund a paid card (stronger than printed,
  no invariant sees it). Find whether any pool card can create one at instant speed before building anything.
- **SPXOPPARS** (`judge.grantedInstant`): Iyslander casts her arsenal blue non-attack on the opponent's turn at the first window outside
  a defence (her hero's printed play; census 80 legal / 0 used before). 263 -> 266 of 768 (noise; ships for the call, reason `oppArs`).
  The LAST window measured 128/384 = off (the Frostbite dies at their end phase).
- Gravy's payment pitched the card already named for a discard cost (policy refusal) — fixed in `payAction`, test/discpitch.test.js.

**Shipped v6.63:** the in-game peek (`PeekDock`, both boards) names the card's keywords as plain text (`PeekKw`) — no tap of its own,
the next tap opens the full card with the CR chips. page.js row added (peeks until a keyworded card; sabotaged).

**Measured and dropped (do not retry as-is):** Lyath casting leave-payout Suspense auras in the opponent's last window: 127 -> 112/384
(card economy: the pitch to pay 2-4 on their turn is his own turn's swing). Settled fair: Lyath's Brothers in Arms (a blocker), Act of
Glory (pitched, never stranded: 0 castable cards left at 291/291 turn ends); Viserai BW's Gate to i'Arathael 0/66 activations (every
Gloomblade already plays from banish; the Gate's traverse back is SPXTRAV, measured noise).

**NEXT, in order:**
1. The cost-in-the-window audit above (Frostbite's siblings). Cheap: grep the pool for instants whose ops make `costOff`/`nextTurn`.
2. Iyslander, now that she casts on the opponent's turn: Spellfire Cloak ("Gain {r}. Activate only during an opponent's turn", 277
   legal / 0) could pay for those casts; Crucible of Aetherweave's amp likewise (275 / 0 on their turn). Census with
   `experiments/census/never.js iyslander 1`, then A/B per the habits below.
3. Weakest ladder seats now (rule policy, 48 games each): Viserai BW 22, Lyath 29, Iyslander 33 of 96. Lyath looks like a deck/halving
   ceiling, not a misplay; BW is strong under Sharp (the page's AI). Prefer correcting advice over chasing ladder wins.
4. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

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
