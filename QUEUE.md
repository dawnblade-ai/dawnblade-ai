# QUEUE — the CEO handoff and the open work list

**Keep this file SHORT (under ~80 lines).** Superseded handoffs, the v1–v4 item lists, the old ORDER and the
answered NEEDS-A-RULING notes are in `QUEUE-ARCHIVE.md` on this branch (grep it, don't read it). History lives in
CHANGELOG.md (v6.30 on; older in `docs/archive/CHANGELOG-to-v6.29.md`) and LESSONS.md on main.

## HANDOFF — START HERE (CEO session_013xG9xAEHGDJRHeNPdYa83U, 2026-11-21, at v6.58)

**State:** live = **v6.58** on `main`, livecheck ALL PASS. Function `table` version 68 = `v6.58 · sage-v19`, stamped, `--check` OK.
WIRE_V 45 (unchanged). DATA_VER sage-v19. 17 heroes. Session branch `claude/keen-hopper-gumd4k` == main.

**Vision this thread: the stranger.** The AI plays like someone who means it, and a person who has never held a FaB card can pick
the game up. **Shipped — v6.57 and v6.58** (CHANGELOG has every number):
- **How to play** sheet under the roster (six paragraphs, coach voice; `tools/page.js` walks it). **Link preview**: description +
  Open Graph + `icons/share.png` (original art, `tools/icon.js` writes it with PAGE_DEPS' fonts).
- **SPXRXPUMP** (`judge.pumpsNow`): the attacking reaction window casts only an attack reaction, a pump/hit rider, or a permanent.
  All 11 affected heroes within the band (sum 1872 -> 1885 of 4224); ships for the advice it corrects.
- **SPXTOKENPIECE** (`judge.tokenPiece`, `TOKEN_DEF` 1): Runehold Release / Flat Trackers before the attack.
  Viserai BW 136 -> 141 of 768, **Boltyn 224 -> 253 of 768**.
- v6.58: How to play wears a gold frame on a phone that has never opened it (`howSeen`), quiet text after.

**Measured and RULED OUT this thread (don't chase again):**
- Holding auras/items out of the attacking window: **Lyath 133 -> 95 of 384** (Suspense auras belong in the arena). Permanents stay in.
- Stand Strong (Lyath) via tokenPiece: it costs {r}{r}{r}, not admitted; identical either way.
- Timesnap Potion (Gravy, 62 / 2): every legal state competes with an attack for the same point, and it pitches 3. Not a leak.
- Runechant of Lust / Sloth on the opponent's turn: becoming a plain Runechant early discards the printed usurp rider.

**NEXT, in order:**
1. **Jittery Bones** (Gravy) 69 / 8 — an attack ranked below his bigger ones; check whether its mill-for-go-again rider is ever
   the better line before calling it a leak.
2. Viserai BW is still bottom (18-22 on the ladder). Runechant of Lust/Sloth at opp turn (suspense shape, expect negative). Look
   at what she pitches vs plays (`experiments/census/rx.js`-style census of her calls).
3. **Newcomer path, next steps:** the hero sheet could say each hero's play style in one line (data in HEROES, sourced, not prose
   in code); the first trainer turn could point at the Coach's call once. Drive both at 393x852.
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
