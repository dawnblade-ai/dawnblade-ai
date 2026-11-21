# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAAQbamsKsHUf7TJLq, 2026-11-21, at v6.54)

**State:** live = **v6.54** on `main`, livecheck ALL PASS. Function `table` version 60 = `v6.54 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. No unreleased work. Session branch `claude/upbeat-darwin-ofj5u7` == main.

**Done this thread — two AI leaks, both "a paid/free optional pick the AI declined":**
- **v6.53 Blaze spends his energy** (`judge.ctrPickTakers`, SPXENERGY): the ability was activated 93x/32 games and the banish sheet
  declined every time (~10 energy unspent per game). Own seat 113 -> 136 of 384; ladder Blaze 32 -> 40.
- **v6.54 Prism takes her figment** (`judge.freePick` class "put", SPXPUT): the Herald search (deck -> arena) was declined 157x/272
  games. Own seat **170 -> 307 of 384**, all 24 seeds up; ladder Prism 38 -> 81 (2nd behind Briar 85).

**The new method (cheaper than the never-does census):** `experiments/energy/decline.js` — one seed of every pairing (272 games, ~2 min),
tallies every optional pick the AI answered with `declineOptional`, by hero and source. `experiments/energy/blaze-census.js` is the
per-hero ability census (NB `J.legal` returns the REFUSAL, null = legal — the first version of the probe read it inverted).

**NEXT, in order:**
1. **The rest of the decline census** (each its own gate + A/B, 12 seeds both chairs): Arakni's dagger retrieves, Pick Up the Point 45 +
   Up Sticks and Run 31 (grave -> gear, priced {r} by the retrieve keyword; a dagger back for 1 is probably right when a slot is free);
   Golden Tipple 51 (discard a yellow: draw + Gold — card-neutral plus a Gold, likely right); then the real tradeoffs: Corrupted Crown 32
   (hand banish for +1{d}), Condemn to Slaughter 18, Embrace Ursur 6, Mounting Anger 6.
2. **Opponents attack Suraya** (Ward 4 ally) instead of Prism — seen in prism-kayo-3 (7 and 5 power swung at her). Maybe right (she
   attacks back), maybe a foe-policy leak now that she shows up every game; count it before touching it.
3. Blaze still ends ~5 energy up: the ability is never used on the opponent's turn (219 legal windows, 0 uses). Unmeasured.
4. Viserai BW (bottom, 6.0/seed), Gravy (8.0), Boltyn (8.0): the never-does census, as in the v6.52 handoff (Gravy's own ability legal
   31 turns used 16; Mage Master Boots held as "land nothing").
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON. **New: Prism is now the 2nd-strongest AI** (her deck finally does its thing) — fine for a sparring partner? Default: yes.

**Cheap habits:** `npm run quick` inner loop (~2.5 min). The full `npm test` is ~10 min: run it ONCE at the end. A gated A/B on one hero:
`SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND the other chair (`'' hero 12`) — four in parallel take ~5 min. Don't edit
engine files while a background suite runs (it reads them). page.js deps: `npm install --prefix <scratch>/deps ...`. After pushing main,
curl the page until it serves the new APP_VER, THEN `livecheck.js`.

---

### Previous handoff (v6.52), kept for its census notes

**The census that found both AI wins** (`npm run play '' '' 6`, 1632 games, ~3 min, before v6.50): wins of 32 a seed — Briar 28.3, Kayo 25.3,
Dorinthea 24.5 ... Blaze 10.5, Lyath 9.2, Boltyn 8.2, Viserai BW 7.5, Gravy 7.2. **The method that worked twice:** for a bottom hero, count
what the AI NEVER does that `legal` offers (probe: tally actions by kind and zone over 16 games; then ask `legal` at each decision for the
missing kind). Gravy: zero graveyard plays. Lyath: hero ability legal ~every turn, used only on his own turn where half of it is dead.
Ruled out (don't chase): Lyath's wall (halving is applied at build), end-turn "holds" of resource gear (deliberate), Boltyn's charging
(long measured history in QUEUE-ARCHIVE, v5.68 H24).
