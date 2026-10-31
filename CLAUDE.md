# Dawnblade — Flesh and Blood AI Training Sim

A browser game: a Flesh and Blood sparring simulator where the player pilots a real
hero deck, either against an iron-armored training dummy (the trainer) or against an
AI-piloted hero (the table), with an advisor reading the board ("<Hero>'s call" at
the table, "Coach's call" in the trainer).

**It plays DAWNBLADE, a fan-made sub-format of Silver Age (declared 2026-09-26).**
The pool is FROZEN at the fifteen Chapter 1–3 precons as printed, and it does
NOT follow Silver Age's rolling ban list or its seasonal hero bench: a card
Silver Age has banned stays legal here. That is `data/formats.json`, held by
`test/formats.test.js`. **Do not "fix" a banned card out of a deck list.**
Silver Age's own legality is recorded BESIDE the format (`silverAge.banned`),
and is `null` until the desktop task in `DESKTOP-TASKS.md` fills it.

**Live at:** https://dawnblade-ai.github.io/dawnblade-ai/ (GitHub Pages)
**Current version:** `grep APP_VER index.html` (a version written here rots in one release)

---

## How this file works — read this first

This is the CORE: what a session must know and must not break. It is loaded into
every session on every step, so **it stays short (budget: under 30 KB)**.

- **The why behind every rule** — one section per version, ~14,000 lines — is in
  **`LESSONS.md`** (this file until 2026-10-31, moved word for word). Search it,
  don't read it: `grep -n -i "<topic>" LESSONS.md`. Older code comments that say
  "CLAUDE.md's …" mean LESSONS.md.
- **Per-release summaries** are at the top of `CHANGELOG.md`.
- **START HERE: the handoff and the work list** are `QUEUE.md` on the branch
  `findings/queue` — its top section is the current handoff (S-items = engine,
  H-items = AI policy, FEED items = feed text, NEEDS A RULING = questions for the
  user). `git fetch origin findings/queue && git show origin/findings/queue:QUEUE.md`.
  Experiment patches and probes live in `experiments/` on that branch.
- **The other docs.** Generated (rerun the tool, never hand-edit): `AUDIT.md`,
  `CARD_PROGRESS.md`, `CR-INDEX.md`, `STACK.md`, `SWEEP.md`. Reference:
  `ARCHITECTURE.md`, `UI-GUIDE.md` (any screen work), `POLISH.md` (the user's quality
  bar), `TORCH.md` (FaB rules and lore), `DESKTOP-TASKS.md` (jobs the sandbox cannot
  reach). Future plans: `ROADMAP-MULTIPLAYER.md`, `SUPABASE.md`, `GEMMY.md`.
  **`docs/archive/`** holds finished plans and old handoffs (`HANDOFF.md`, `WEEK.md`,
  `FINISH.md`, …) — frozen history; code comments that cite them mean that folder.
  Do not start a new root handoff file: update `QUEUE.md`'s HANDOFF section.
- **When a release teaches something:** write it in CHANGELOG.md. Add ONE line
  here only if it is a new rule every session must know. Long-form goes in LESSONS.md.
- **Derive numbers, never state them.** Counts in prose rot; give the command.

---

## The one hard constraint — no build step, ever

No bundler, no ES modules, no framework CLI, no `package.json` build. GitHub Pages
serves the repo as authored, it is played on an iPhone, and it must run from
`file://`. React and Babel come from CDN `<script>` tags.

- **What ships is `index.html` + `engine/*.js`.** Engine modules are plain UMD
  scripts loaded by `<script src>`; `parser.js` loads before its dependents; a small
  plain-JS **bridge** (declares real globals with `var`) lifts engine exports into
  the bare names the babel blocks call.
- `index.html` layout: one `<style>` block · a data `<script>` (`APP_VER`,
  `DATA_VER`, `HEROES`, `DECKS`, CDN paths) · engine script tags + bridge · `script0`
  (`text/babel`: loader, card resolver, UI shell) · `script1` (`text/babel`: trainer —
  Battle, table board, loadout, App).
- Both babel blocks compile as *scripts*, not modules: top-level `const` becomes a
  global, which is how `script1` sees `script0`. Load-bearing — do not "fix" it.
- **The no-mirror rule.** One copy of every shared function, in `engine/`. Never
  re-declare an engine export inside `index.html` (it would silently shadow the
  module). `test/sync.test.js` guards load order, the bridge, and this; it scans raw
  source including comments, so reword prose that reads like a call rather than
  weakening the scan. Known name collisions: `endTurn`, `other`.
- Headless modules (not loaded by the page) are listed in `test/wire.test.js`'s
  `HEADLESS` (`actions`).

## Card data — the golden rule

**Never invent or hardcode card effects.** Card text streams at runtime from the
public card database and is parsed (`classifyClause`, `fxParse`). If a card does
something new, teach the parser to read its text — never special-case a card by name.

- **The text is upstream's and it moves.** The game streams the-fab-cube's `develop`
  branch live. `data/pool.json` is the pinned fixture (fetched by `tools/pin-pool.js`,
  never authored) that every drill reads, so the suite needs no network.
  `test/drift.test.js` is the ONLY drill that reads the live wire; refresh with
  `node tools/audit.js --refresh` at the start of a release cycle.
- **Read both wordings.** Upstream prints contractions both ways at once. `parser.js`'s
  `SYNONYMS` levels idioms (synonyms only, never a change of meaning) before
  `classifyClause` sees a word — write anchors against the LEVELLED text.
- **`DATA_VER`** keys the localStorage card cache: bump it whenever the loader's
  schema or card-field handling changes. `mapDbCard` is mirrored in `index.html`'s
  `useCardDB` (a React hook) — change both; `test/loader.test.js` guards the field map.
- **Types:** the structured array (`ty`) beats the type line (`tt`) where they conflict
  (ruling 2026-08-02). "Reaction" contains "action" — never substring-test types.
  `engine/types.js` answers what a card IS.
- **Keywords:** `card_keywords` is an index, not possession. Printed and granted
  keywords stay separate. Three predicates, three questions:
  `hasKw` (appears anywhere), `hasKwNow` (no if/unless gates it), `printedKw` (the card
  CARRIES it as printed rules text — use it for costs like boost).
- **Honest gaps.** An unreadable clause REFUSES (weaker than printed and visible beats
  a guess). A `noop` must describe its own clause and name the reader that makes it
  real. An unanchored match hides an unbuilt clause. An unpayable cost is inert,
  never free.
- `fxParse` memoizes on `name|pitch`: drill cards need unique names, and never store a
  per-game number in a parse.

## Release

- `APP_VER` bumps 0.01 per release (displayed in-game); its comment is ONE sentence.
  The release summary goes at the top of `CHANGELOG.md`.
- Validate (below), then **`git push origin main` — that is the deploy** (Pages serves
  `main`). One worker pushes `main` at a time.
- **Verify the push:** every script the page loads exists in the pushed commit, and
  `.nojekyll` is present:
  ```sh
  for f in $(git show origin/main:index.html | grep -o '<script src="engine/[a-z]*\.js"' | sed 's/.*src="//;s/"//' | sort -u) .nojekyll; do git cat-file -e origin/main:$f || echo MISSING $f; done
  ```
  CI (`.github/workflows/ci.yml`) runs the suite on a fresh clone and checks the live
  URL after a push. If you cannot reach the live URL, say so.
- **`WIRE_V`** (engine/wire.js) bumps on any payload or prompt shape change, including
  a new top-level game key. A new per-side field goes in `SIDE_FIELDS`, `wire.js` and
  `report.js`'s `seat()`.

## Validation — before every ship

```sh
npm test 2>&1 | grep -E '^# (tests|pass|fail|skipped)'   # fail 0; skipped exactly 5
npm run scenes        # does each card DO what it prints (named observations)
npm run fairness      # is any card STRONGER than printed (exits non-zero on a finding)
```
- **Skipped must read 5** (the live-wire drills in `drift.test.js`; CI pins it). A drill
  that skipped is not a drill that passed.
- After parser/card-text changes: `npm run audit` (read AUDIT.md; `--write-baseline`
  only after reading the diff), `npm run anchors`, `npm run unanchored`.
- After `index.html` edits: compile both `text/babel` blocks with `@babel/standalone`
  (`presets:["react"], sourceType:"script"`), installed into a scratch dir so the repo
  keeps zero dependencies. Bracket balance alone cannot see a broken page.
- After rules or AI changes: `npm run play '' '' 3` (630 self-play games). Read
  POLICY REFUSALS · INVARIANT VIOLATIONS · stalls first — all must be 0 (`draws`, the
  engine ending a dead position, are reported apart and are not a failure). Win counts are
  reproducible, not repeatable: the noise band is a median of ~3 wins and up to ~10, so
  a balance claim needs several seeds on both sides of the change.
- UI changes: drive the real page at phone size (393×852) and assert on element boxes,
  not screenshots. `node tools/page.js` does it offline (CDNs and the card DB served
  locally; deps in a scratch dir, see its header) and exports `open()` for drives.

## Engine map (`engine/`)

| module | job |
|---|---|
| `parser.js` | card text → effects (`classifyClause`, `fxParse`), costs, keyword predicates, zone/legality readers |
| `types.js` | what a card IS, from its structured type array |
| `game.js` | zone and token helpers, `sv`/`sp` feed voice helpers |
| `sides.js` | the per-seat state shape (`makeSide`, `SIDE_FIELDS`) |
| `priority.js` | phases, combat-chain steps, who holds priority (CR-grounded) |
| `rng.js` | seeded RNG — every draw returns a new rng; store it back |
| `prompts.js` | choices as DATA: `opt pick modal pay reveal target alloc soak` |
| `effects.js` | ALL card semantics (`execute`, `runOps`, `linkPumps`, `linkPayload`, `beginEndPhase`…) — one copy, both boards call it |
| `judge.js` | `reduce(state, action, seat)` / `legal` — the CR turn structure; the table's engine; readers the AI asks |
| `build.js` | how a seat becomes a hero (`buildSide`, `buildMatch`, `buildVanilla`, powCard builders) |
| `sparring.js` | the AI seat policy: `act(game, seat)`, `explain(game, seat)` |
| `advisor.js` | the trainer's Coach's call (`advise`) |
| `invariants.js` | state judge (`check`), wired into every state change and self-play |
| `report.js` | JUDGE!! bug reports, both boards |
| `local.js` `lobby.js` `room.js` `net.js` `wire.js` | play alone / two-phone table (PeerJS), negotiation, sync, serialization |
| `cards.js` · `actions.js` | card resolver (printings) · blank reference reducer (headless, not on the page) |

**Two boards.** The TABLE (`judge.js`) is the CR-exact engine and seats a person or the
AI. The TRAINER (`Battle` in `index.html`) runs the tuned `[3,4,5]` dummy and is the
regression harness; it does not retire until the merged path passes the same drills.
Both resolve card text through `effects.js`.

## Rules of the code (one line each — history in LESSONS.md)

**State and seats**
- `you()`/`opp()` = seat 0/1, the client's PERSPECTIVE (UI only). `act()`/`foe()` = the
  ACTOR (rules). Write only through `youMut`/`oppMut`/`actMut`/`foeMut` (state is
  shallow-copied). Never write a per-side field as a top-level game key. Builds: `bAct(s)`.
- A seat the dummy fills is always the vanilla pile; a person picks their own hero. An
  AI hero may pilot seat 1 at the table (ruling 2026-10-18).
- When you add a zone or a per-side field, check `invariants.js`'s census sees it.

**Rules engine**
- A rule, schedule, route or gate that lives on one board does not exist on the other:
  when you find a rule in the trainer, grep `judge.js` for it (and vice versa). Shared
  bodies in `effects.js` are the fix.
- Go again is a GAIN (CR 5.3.5). An instant costs no action point (CR 8.1.6). `instead`
  REPLACES. Pitch only on demand, never to bank (ruling 2026-08-01).
- Prevented damage is not dealt and not a hit (CR 7.5.5); record a trace where the fact
  becomes true. The end phase is CR 4.4.3's fixed order, in `effects.beginEndPhase`.
  There is no deck-out loss (CR 4.5.3); a dead position (both decks empty, nothing
  changing for 20 turns) ends as a DRAW at the table (ruling R6, `judge.reduce`).
- Attack-targets ride on the action as a SPEC (`judge.targetSpec`, CR 1.4.5); an attack
  on an ally cannot be defended (CR 7.3.2a).
- Choices are `prompts.js` specs queued on `promptQ`, addressed to a side. A spec only
  carries fields `buildPrompt` names (`test/speccensus.test.js`); every answer the module
  accepts needs a control on the sheet (`test/promptctl.test.js`). A COST is a `pending`
  settled before the card resolves, never a queued prompt.
- Tokens are real cards on the board (Runechant, Frostbite… are auras); token uids are
  namespaced; a token leaving the arena ceases to exist (`parser.ceasesToExist`).
  Graveyard entries are turn-stamped (`_gy`).
- Rules questions: the CR site is unreachable from the sandbox. Without a verbatim
  quote in the repo, do not decide it — record it in `tools/approx.js` and ask the user.
  User rulings are marked `RULING (user, date)`; grep LESSONS.md and the source.

**The AI (`sparring.js`)**
- `act` proposes one action; `judge.legal` disposes. A refusal is always a policy bug.
- It reads NO card text — knowledge comes only through judge readers
  (`keepsActionPoint`, `chargeView`, `arcaneOf`, `grantTakers`, `defendsNow`,
  `abPieceForRes`, …). Deterministic: total orders, uid tie-breaks, never `game.rng`.
- `explain` = `act` plus the reason key at the branch that decided (`CALL_WHY`); it
  powers "<Hero>'s call". Every new decision gets its own key.
- A policy change ships only when measured: gate it per seat (`SPX`), A/B the hero's
  own seat at 3 seeds (6–12 if unresolved), then the full ladder with every seat on
  (0 refusals / violations / stalls). Record results that do not resolve in QUEUE.md;
  correcting advice the call would show a player can justify a noise-level change.

**Feed and voice**
- The feed is the lesson. A line in the shared feed names the seat (`sv`/`sp`; seat 0 is
  literally named "You"); only a refusal returned to the actor speaks in second person.
  No identifiers, field names or version numbers in player-facing text
  (`noopvoice`, `feedvoice` drills). Keep the advisor's voice: a sharp, warm coach.

**Drills**
- Assert on hands, life, zones, counters and action points — never on feed prose, except
  where the line IS the observable (say so in the drill).
- Use `test/helpers/judged.js` for a real effects context; don't hand-roll one.
- Sabotage every new drill and check the sabotage applied. A fixture where two things
  coincide tests neither; ask for the refusal, not only the match.
- Ask the engine, not the note: a recorded reason is only as good as the day it was
  measured.

## Ledgers and tools

`tools/approx.js` (approximation ledger: stated/open/closed, each with a driven probe) ·
`tools/ledger.js` (keyword status) · `npm run gaps` · `npm run sweep` ·
`npm run crindex` (which CR rules a drill guards) · `npm run cup` / `npm run eight`
(brackets) · `tools/selfplay.js` (the self-play driver every probe builds on).

## Editing conventions

When applying many scripted edits in one pass, record misses and continue, then report
them — never abort a whole batch on one bad anchor. Assert a replacement anchor is
unique before writing.
