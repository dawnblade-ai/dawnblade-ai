# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAEHGDJRHeNPdYa83U, 2026-11-21, at v6.57)

**State:** live = **v6.57** on `main`, livecheck ALL PASS. Function `table` version 66 = `v6.57 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. Session branch `claude/keen-hopper-gumd4k` == main.

**Vision this thread: the stranger.** The AI plays like someone who means it, and a person who has never held a FaB card can pick
the game up. **Shipped — v6.57** (CHANGELOG has every number):
- **How to play** sheet under the roster (six paragraphs, coach voice; `tools/page.js` walks it). **Link preview**: description +
  Open Graph + `icons/share.png` (original art, `tools/icon.js` writes it with PAGE_DEPS' fonts).
- **SPXRXPUMP** (`judge.pumpsNow`): the attacking reaction window casts only an attack reaction, a pump/hit rider, or a permanent.
  All 11 affected heroes within the band (sum 1872 -> 1885 of 4224); ships for the advice it corrects.
- **SPXTOKENPIECE** (`judge.tokenPiece`, `TOKEN_DEF` 1): Runehold Release / Flat Trackers before the attack.
  Viserai BW 136 -> 141 of 768, **Boltyn 224 -> 253 of 768**.

**Measured and RULED OUT this thread (don't chase again):**
- Holding auras/items out of the attacking window: **Lyath 133 -> 95 of 384** (Suspense auras belong in the arena). Permanents stay in.
- Stand Strong (Lyath) via tokenPiece: it costs {r}{r}{r}, not admitted; identical either way.

**NEXT, in order:**
1. **Gravy's Timesnap Potion** ("Destroy this: Gain 2 action points") 63 / 2 and **Jittery Bones** 69 / 8. Timesnap is worth it
   when the hand holds 2+ more plays than the one point covers (an `apNeed` judge reader); run `never.js gravy 1` first.
2. Viserai BW is still bottom (18-22 on the ladder). Runechant of Lust/Sloth at opp turn (suspense shape, expect negative). Look
   at what she pitches vs plays (`experiments/census/rx.js`-style census of her calls).
3. **Newcomer path, next steps:** a first-game nudge (the How to play button is quiet text; a first visit could open it once —
   store a flag, try/catch storage), and the hero sheet could say each hero's style in one line (data, not prose in code).
4. Compass of Sunken Depths (Gravy) — info the AI cannot use; skip unless Sharp's mask learns it (view.js).
5. Phase 4 (Outbreak, 2027-02): when the lists publish, ROADMAP-NEWDECKS.md. Wire: next cut if needed is HZOOM (~500 B/seat).

**ASK THE USER (defaults standing — overrule any):** the cup (all heroes qualify, top 16 bracket); Prism as an AI seat; Spectra resolves at
once (`spectra-trigger-at-once`); Prism's block named "Usurp the Shadow Throne"; hero select kept 6 across rather than the roadmap's 4;
sound defaults ON; Prism as the 2nd-strongest AI (default: fine for a sparring partner).

**Cheap habits:** the census `experiments/census/never.js <hero> <seeds>` (copy it out with `git archive origin/findings/queue
experiments | tar x`; it requires main's tools by absolute path). A/B: `SPXFOO=none node tools/tourney.js hero '' 12` vs on, AND
`'' hero 12` — four in parallel ~5 min. **A subGate is ON when its env var is empty** — an experiment you do not ship must be
deleted, not left gated. A self-play fixture (a seed a drill replays) moves whenever a hero's policy moves: re-anchor it (search
seeds for the same key), never weaken it. After pushing main, curl until the page serves the new APP_VER, THEN livecheck — it fails
on the build handshake until `tools/supabase-deploy.js` has run.
