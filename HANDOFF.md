# Handoff — Dawnblade, at v4.83 (updated through v4.88)

**Written 2026-09-28. Every number below was re-derived this session, with
the command that produces it.** Re-derive before you quote one; this file
has rotted before, and so has every document that stated a count.

The previous handoff had grown to 3,067 lines of per-version layers, from
v4.02 to v4.62, under a banner saying it was stale from v4.76. The
per-version detail lives in `CHANGELOG.md`, and the rules it taught are in
`CLAUDE.md`. The old file is in git history:

```sh
git show a183e2b:HANDOFF.md | less
```

Read `CLAUDE.md` first, in full. It says how to work and why; this file says
where things stand and what is next.

---

## WHERE THINGS STAND

| measure | value | command |
|---|---|---|
| version | v4.88, live on GitHub Pages | `grep APP_VER index.html` |
| drills | 3322 · 0 fail · 5 skipped (the drift probes) | `npm test 2>&1 \| grep -E '^# (tests\|pass\|fail\|skipped)'` |
| pool coverage | **405 of 405** unique cards read in full · 0 part · 0 none | `npm run audit`, top of `AUDIT.md` |
| unfinished cards | 0, and 0 one clause away | `npm run gaps` |
| approximation ledger | 45 records: 27 closed · **15 stated · 3 open** | `node tools/approx.js` |
| CR rules cited | 61 distinct · 51 guarded · 3 unguarded (section pointers, pinned) | `node tools/crindex.js` |
| fail states | 0 UNFAIR · 3 WRONG (all known, below) | `npm run sweep` |
| scenes | 107 passing | `npm run scenes` |
| ladder, 3 seeds | 630 games · 0 refusals · 0 violations · **2 stalls** · noise band median 2–3 | `npm run play '' '' 3` |

**The engine reads every card in the pool.** What is left is not unread text.
It is the *rules machine* the cards run inside (the ledger's stated and open
records) and *readings that are consumed but wrong*, which no coverage tool
can see. The last eight versions were all the second kind.

---

## WHAT LANDED SINCE THE LAST HANDOFF (v4.76 → v4.83)

| ver | what |
|---|---|
| 4.77 | Damage is judged when it lands. Surge reads what was dealt; a hit deferred into an arcane-barrier sheet carries its "this way" riders (`wayRider`); a lapsed soak keeps its damage |
| 4.78 | Two "when this attacks" payloads (Hyper Inflation's tax, Pick Up the Point's retrieve) fire at declaration |
| 4.79 | A destroyed piece is filed to the graveyard when it is destroyed, not at the end phase, so Arakni's Mark → retrieve loop works inside one turn |
| 4.80 | A "when this attacks" **sheet** opens at declaration on both boards, where it used to open after the damage. 218 sheets per ladder seed moved |
| 4.81 | A discard that prints no randomness is asked of the discarder, with the rest of the effect riding on the sheet |
| 4.82 | The plain draw is anchored. "Draw a card AND …" reads both halves: Golden Tipple's Gold, Fire that Burns Within's +2{p}, two put-backs, and Art of Desire's banish trigger. Transcend flips at the filing |
| 4.83 | A census of every unanchored match found three more: Aether Spindle's opt X (was always 1), Spectral Manifestations' gated counters, and The Suspense is Killing Me's standing first-attack bonus |

Every one of those cards read `tier: full` before its fix.

---

## THE PLAN — IN ORDER, WITH THE REASON FOR THE ORDER

### 1. ~~Promote the unanchored-match census to a standing drill~~ — DONE at v4.84

`npm run unanchored` and `test/unanchored.test.js`. Its first standing run
found a tenth defect (the if/when handler did not know `whenever`). What
follows is the original note, kept for the recipe.

v4.82 and v4.83 found **nine live defects** with one scratch script: it
instruments every `c.match` inside `classifyClause`, parses the pool, and
records each `run` clause whose producing match did not cover the sentence.
72 sentences remain, and every one is accounted for: a target or window left
to another reader, an `instead` payload, or a sentence a whole-card reader
claims later.

**The pool is frozen by the Dawnblade format** (`data/formats.json`), so that
list only moves when the PARSER moves, which makes it an ideal pinned set.
Build it the way v4.42 promoted `fxcensus` and `speccensus`:
- a `vm`-loaded copy of `parser.js` with the matches instrumented;
- the 72 pinned by regex family with a reason each;
- a synthetic control proving the instrument alive.

The scratch version is the recipe. It is two short scripts and is described
in `CHANGELOG.md` v4.83.

### 2. The three OPEN records

| record | what it needs |
|---|---|
| `simultaneous-trigger-order` | CR 4.1.8a hands the order to the turn-player; the engine resolves in printed order. Needs an ordering prompt, and a measurement of which pairs of triggers actually co-occur in the pool (v4.67 found one ordering decided wrongly by an unreachable fixture) |
| `cloaked-face-down-values` | **a user ruling**: does a face-down Cloaked piece keep its printed defence and its Ward 1? |
| `cloaked-display` | the card back on the board. A UI job; see §4 |

### 3. The STATED records most worth re-asking

A stated record is argued, but v3.69's rule applies: *when a record says a
thing is unbuilt or unobservable, go and ask the engine.* Four stated records
have gone false in the last two weeks. The ones most likely to be wrong
today:

- ~~**`cost-discard-auto-picked`**~~ The activation half was **built at
  v4.85** (`activation-discard-cost-asked`, closed). What is left is a
  non-random additional-cost discard (no pool card) and a payment made from
  a sheet.
- ~~**Hyper Inflation's tax reaches abilities**~~ **Fixed at v4.86**, with
  Frostbite and Cartilage Crush: `parser.costTaxes` is the one reader of
  which payments a tax reaches.
- **`instant-speed-plays-resolve-on-play`** (table). An instant or reaction
  resolves the moment it is played. v4.66 built the stack window for plays
  at action speed; the reaction half is the remaining collapse.
- **`attack-ops-at-resolution`**. Which bare "when this attacks" payloads
  still ride to resolution, and is each one still unobservable? v4.78
  re-asked two and moved both.
- **`activation-choices-at-resolution`**. An activated ability's target is
  chosen when it resolves, not when it is activated.

### 4. Then the fun part: graphics, UI and UX

**Start from the dead-tap sweep (v4.88).** It is in the repo as
`tools/phone/` — `serve.sh` builds the real page against a scratch directory
with no network at run time, `deadtap.js` sweeps one hero, `sweep.sh` all
fifteen. It sweeps ⚡ tiles only; weapon tiles, hand cards and the arsenal
tile go through the same doors and are the obvious widening. Its attack
pick is a heuristic, so an opening holding only arrows reports `NOSTACK`:
a limit of the probe, not a defect. It found one display bug it did not fix: on the lower "YOU" screen the peek preview
renders ABOVE the viewport (its box measured at top −367, once, by a probe
that scrolled the tile into view the way a flick does), so a gear tile's
first tap shows nothing. `PeekDock`'s measurement assumes the hand rail is on
screen. That belongs to the UI pass.

The user's stated direction is to *finish the engine, then dive into the
graphics and UI and UX and fun stuff*. The engine is at the point where every
card reads and what remains is the rules machine's edges, so the UI phase can
begin whenever the user wants it. Queued for it:

- the Cloaked card back (`cloaked-display`);
- `UI-GUIDE.md` and `POLISH.md` hold the design notes;
- `test/phasebar.test.js` and the phone-dimension recipe in `CLAUDE.md`
  ("AND THE PAGE CAN BE DRIVEN AT PHONE DIMENSIONS") are the instruments.
  **Assert on boxes, never on a screenshot.**

---

## WAITING ON THE USER — `DESKTOP-TASKS.md`

This sandbox cannot reach the web freely, so three jobs are flagged for a
desktop:
1. **Silver Age legality.** Which cards and heroes has Silver Age banned or
   benched? Recorded *beside* the Dawnblade format (`silverAge.banned`),
   never used to edit a deck list. Dawnblade keeps them all.
2. **The 2026-09-17 rules update.** The start-of-game procedure.
3. **The two new precons** (Prism, Viserai Between Worlds). Nothing to do
   until the-fab-cube publishes them; `test/drift.test.js`'s live probe goes
   red the day it does.

---

## THE METHOD, WHICH KEEPS PAYING

- **Census the family, not the member you found** (v4.21). v4.82 fixed one
  matcher and v4.83's census of the rest found three more.
- **A green tier is a claim about consumption, not faithfulness.** Every
  defect in the last eight versions read `tier: full`.
- **Drive the real entry point** (`judge.reduce` through
  `test/helpers/judged.js`), and assert on hands, life and zones, never on
  feed prose. The one exception is a feed-only fix, and the drill says so.
- **Sabotage every new drill**, and read a silent sabotage as a question
  about the fixture before the engine.
- **Run the ladder at 3 seeds on both sides**; a move inside the band is
  noise, however consistent its direction looks.
- **A drill can pin a bug.** `chi.test.js` pinned Spectral Manifestations'
  bare mint as "already read" (v4.83). When a fix breaks a drill, read the
  fixture before reshaping the assertion.
