# Dawnblade — Flesh and Blood AI Training Sim

A single-file browser game: a Flesh and Blood sparring simulator where the player
pilots a real hero deck against an iron-armored training dummy, with an AI advisor
("Claude's call") reading the board.

**Live at:** dawnblade-ai.github.io (GitHub Pages)
**Current version:** v1.20

---

## The one hard constraint

**Everything ships as a single `index.html`.** No build step, no bundler, no module
imports, no external project files. It is served directly by GitHub Pages and opened
on an iPhone. Do not split it into modules, do not add a package.json build, do not
introduce a framework CLI. React and Babel come from CDN `<script>` tags.

File structure inside `index.html`:
- one `<style>` block (single `</style>` — CSS is appended before it)
- `script0` (`text/babel`) — loader, card resolver, UI shell
- `script1` (`text/babel`) — engine: FX parser, advisor, Ticker, ChainLink, CardFrame,
  Battle, WinPanel, Loadout, App
- a plain data `<script>` — CDN paths, `APP_VER`, `DATA_VER`, `HEROES`, `DECKS`, etc.

---

## Card data — the golden rule

**Never invent or hardcode card effects.** Card text streams at runtime from the
public Flesh and Blood card database and is parsed by `classifyClause` / `fxParse`.
If a card does something new, the fix is *always* to teach the parser to read its
text — never to special-case the card by name.

- `DATA_VER` (e.g. `"sage-v6"`) keys the localStorage cache. **Bump it whenever the
  loader's schema or card-field handling changes**, or users will run on stale data.
- Printed keywords (`card_keywords`) and *granted* keywords (`granted_keywords`) must
  stay separate. Merging them caused the Kayo bug: conditional go-again was granted
  unconditionally.

---

## Versioning & release

- `APP_VER` bumps by 0.01 per release. It is displayed in-game.
- **v2.0x line starts at v2.01** (2026-07-22): marks the engine/ extraction +
  pool audit system. Below 2.0 = single-file-only history; 2.0+ = engine/ and
  index.html co-exist under the sync-guard rule (see below).
- After any change: validate (below), then the file is uploaded/pushed to the Pages repo.
- Keep a one-line summary of what each version changed.

---

## Validation — run before every ship

Fast path, no network, run on every change:
```
npm test
```
This is `node --test "test/*.test.js"` — currently 109 drills:
1. **Bracket balance** on both `text/babel` blocks (`test/html-balance.test.js`).
   String- and template-literal-aware, not regex-literal-aware — the three
   regexes with apostrophes are pre-neutralized inside the checker.
2. **Deck integrity** (`test/decks.test.js`): exactly 15 decks, each deck +
   gear summing to exactly 55 cards.
3. **Parser/game/advisor drills** (`test/parser.test.js`, `game.test.js`,
   `advisor.test.js`): `weaponCost`, `classifyClause` conditionals, the `{p}`
   pump parser, the Kayo printed-vs-granted regression, equipment wear, the
   fxParse memo gotcha.
4. **Sync guard** (`test/sync.test.js`): the parser/game/advisor/cards logic
   now also lives in `engine/*.js` (Phase 1 extraction), textually identical
   to the copies inside `index.html`. **Edit one side, mirror the other** —
   this test fails on drift. (index.html is still what ships; engine/ is not
   yet imported by it.)
5. **Marker sweep** — grep for the new identifiers to confirm every edit landed.

Slower path, needs network the first time, run before shipping any card-text
or parser change:
```
npm run audit          # regenerate AUDIT.md — read it, look for new gaps/flags
node tools/audit.js --write-baseline   # only once you've reviewed the diff —
                                        # repins the coverage floor so future
                                        # runs fail if a card's tier regresses
```
`test/coverage.test.js` then checks every pool card still resolves and no
card's `fxParse` tier dropped below the pinned baseline (skips cleanly if
`tools/.cache/card.json` / `tools/coverage-baseline.json` aren't present).

Always, regardless of what the tests say:
6. **On a real phone.** Type checking and drills verify the parser is
   correct, not that the feature is fun or legible — validate on-device
   per the roadmap's loop (play → record → extract frames → fix) before
   calling anything shipped.

### Drill gotcha
`fxParse` memoizes on `name|pitch`. Test cards **must have unique `name` fields**
or results silently collide in the cache and produce misleading passes.

---

## Editing conventions

When making many edits in one pass, apply them **resiliently**: record misses to a
list and continue, then write the file and print the misses. Never abort the whole
batch on one bad anchor — that discards all the good edits. (With Claude Code editing
files directly this matters less, but the principle stands for scripted passes.)

---

## Rules fidelity

This is a rules-accurate sim, judged to pro-tour standards. Combat follows the
Comprehensive Rules: Attack → Defend → Reaction → Damage → Resolution.

Key implemented rules:
- Defenders are declared free and simultaneously; printed defense required; zero counts.
- Defense reactions **cannot** be declared as defending cards — instant speed only,
  during the reaction step.
- The combat chain stays open after an attack; non-attack actions require closing it.
- Arcane damage bypasses equipment; only ward/arcane barrier stops it.
- Runechants pop **all at once and mandatorily** on any attack, each a separate source.
- Crush = "deals 4+ damage to a hero"; dominate = defender limited to 1 card from hand.
- Tapping is a High Seas cost (the down-arrow symbol) — **not** a generic "weapon used"
  state. Only rotate cards whose text actually uses tap.

---

## Known approximations — state these honestly, never paper over them

- The dummy has **no hand and no action phase**. Effects that target an opponent's hand
  or turn (dominate, forced discard, Crush debuffs, frostbite, reprise, intimidate) are
  parsed and logged as *inert*, not faked.
- Clash: the dummy pantomimes a reveal rather than truly pitching.
- Ally swings are simplified (no action point consumed).
- Auto-pitch/auto-discard picks the lowest advisor-valued card rather than prompting.
- A runechant created by *playing* an attack pops on that same swing; strictly it should
  survive to the next.
- The steam-builder is once-per-turn in the model.

---

## Roadmap (highest leverage first)

1. **Give the dummy a hand** — a sparring opponent that holds cards, blocks from hand,
   and takes a turn. This single change flips the entire "inert" category live.
2. Finish **Dash** (pregame item pick, Hyper Driver discount) and **Bravo**
   (pay-to-dominate ability, Seismic Surge tokens).
3. **Combo** keyword — unlocks Fai (Ninja) and Dorinthea (Warrior).
4. **Reload / Charge** — brings Azalea online.
5. Remaining hero abilities: Boltyn, Briar, Gravy Bones, Lyath.
6. Timing-precision pass; token library (Seismic Surge, Vigor, misc).

---

## Tone

The advisor and log speak like a sharp, warm coach at the table — concise, evocative,
never patronizing. Keep that voice in any new game text.
