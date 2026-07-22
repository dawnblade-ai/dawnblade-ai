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
- After any change: validate (below), then the file is uploaded/pushed to the Pages repo.
- Keep a one-line summary of what each version changed.

---

## Validation — run before every ship

1. **Bracket balance** on both `text/babel` blocks. The checker must be string- and
   template-literal-aware. It is *not* regex-literal-aware, so pre-neutralize the
   three regexes containing apostrophes: `code.replace("hero'?s?", "heroQsQ")`.
2. **Deck integrity:** exactly 15 decks, each summing to exactly 55 cards.
3. **Node drills** for any parser change — extract the function from `index.html`,
   stub its helpers, assert expected output. Existing drills cover `weaponCost`,
   `classifyClause` conditionals, and the `{p}` pump parser.
4. **Marker sweep** — grep for the new identifiers to confirm every edit landed.

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
