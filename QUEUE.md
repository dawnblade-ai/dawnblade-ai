# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9x8RqUofeXdc97YwD9o, 2026-11-21, at v6.55)

**State:** live = **v6.55** on `main`, livecheck ALL PASS. Function `table` version 62 = `v6.55 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/nifty-cray-ahkvfc` == main.

**Shipped this thread:** **v6.55 Gravy takes the Tipple** (`judge.cyclePick`, SPXCYCLE): Golden Tipple's "discard a yellow, draw +
Gold" was declined 49/272. Own seat **103 -> 135 of 384**; ladder Gravy 24 -> 30.

**Measured and RULED OUT (don't chase again):**
- **Arakni's retrieves** (dagger back for {r}): taken whenever reachable, own seat 174 -> **143** (the {r} is a pitched card). Taken
  only from floating resources: 172 vs 174, level. The structural decline is right.
- **Suspense auras at the close of the opponent's turn** (Lyath; a reader on `printedKw(c,"suspense")`, played after the turn player
  passed on an empty stack): own seat 128 -> 120, noise-to-negative. Same lesson as QUEUE v4 H8 (`reaction`'s comment): cards pitched
  on their turn are next turn's hand.
- **Gate to i'Arathael never activated** (Viserai BW, 0/38): on 12 of 14 legal turns every banished blood-debt card was already
  playable; the Gate is redundant there.
- **Corrupted Crown / Embrace Ursur** (a whole card for +1) and Condemn to Slaughter: trade-offs, not leaks.
- **Opponents attack Suraya** 122 of 207 swings while she is out — but `targetFor` only names an ally it KILLS (unblockable, CR
  7.3.2a), and she is Ward 4 plus an attacker every turn. Not a leak.

**The probes** (`experiments/census/` on this branch): `never.js <hero> <seeds>` — per card/ability, the turns it was LEGAL vs USED,
split own/opp turn (~1 min a seed). `gate.js`, `suraya.js` as above. `experiments/energy/decline.js` (the optional-pick census) now
lists only the ruled-out rows. **Finding from never.js:** the AI plays NO instant on the opponent's turn outside a reaction window
(Glisten 0/116, Lyath's suspense 0/~300, Arcane Polarity 0/42). The suspense test says that's mostly right; Glisten's counters
survive to the end of HIS next end phase, so a Glisten at their turn's close is +4 weapon power for a whole turn — untested.

**NEXT, in order:**
1. **Boltyn (23, 2nd from bottom):** Garland of Spring legal 266 own turns, used 7 (resource gear hold — probably deliberate, check
   `landsNothing`); Glisten at the close of the opponent's turn (above) — A/B it as its own gate.
2. **Gravy still low (30):** Mage Master Boots legal 432 / used 1, Timesnap Potion 62 / 1, Limpit 127 / 5, Carrion Crown 66 / 2.
   `never.js gravy 2` then read why each is held (idle? landsNothing?).
3. Viserai BW (18, bottom): Blossom of Spring 204 / 12, Runehold Release 157 / 23 (gear "destroy this: gain {r}" / Runechant) — the
   rest of his never-does list was clean.
4. Blaze opp-turn energy (219 windows, 0 uses) — same shape as the suspense test, expect negative; low priority.
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** `npm run quick` inner loop. Full `npm test` ~10 min: once at the end. A gated A/B: `SPXFOO=none node tools/tourney.js
hero '' 12` vs on, AND `'' hero 12` — four in parallel ~5 min. The decline census is ~20 s, not 2 min. Don't edit engine files while a
background suite runs. After pushing main, curl the page until it serves the new APP_VER, THEN `livecheck.js`.

---

### Previous handoff (v6.52), kept for its census notes

**The census that found both AI wins** (`npm run play '' '' 6`, 1632 games, ~3 min, before v6.50): wins of 32 a seed — Briar 28.3, Kayo 25.3,
Dorinthea 24.5 ... Blaze 10.5, Lyath 9.2, Boltyn 8.2, Viserai BW 7.5, Gravy 7.2. **The method that worked twice:** for a bottom hero, count
what the AI NEVER does that `legal` offers (probe: tally actions by kind and zone over 16 games; then ask `legal` at each decision for the
missing kind). Gravy: zero graveyard plays. Lyath: hero ability legal ~every turn, used only on his own turn where half of it is dead.
Ruled out (don't chase): Lyath's wall (halving is applied at build), end-turn "holds" of resource gear (deliberate), Boltyn's charging
(long measured history in QUEUE-ARCHIVE, v5.68 H24).
