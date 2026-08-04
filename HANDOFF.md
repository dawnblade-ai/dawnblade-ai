# Handoff — Dawnblade, at v2.51

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## THE PLAN, AND WHERE WE ARE IN IT

**Three phases, in this order (user, 2026-08-02):**

```
1. ENGINE       ✔ done
2. MULTIPLAYER  ✔ done — two humans, two hero decks, one game state
3. CARD RULING TESTING (the text boxes)   ← YOU ARE HERE
```

Phases 1 and 2 landed. The rules are a pure reducer, two people can sit
at a table over a room code and play real hero decks at each other, and
the board they play on is the trainer's board.

**Phase 3 is the text boxes.** The user's original scoping instruction
deferred them deliberately:

> "focus on the card types and the numbers rather than the text boxes —
> we will tackle the text boxes in phase 3."

That deferral is now the whole remaining job.

---

## THE ONE THING THAT MATTERS MOST RIGHT NOW

**Card TEXT does not resolve at the table.** `runOps` (234 lines),
`execute` (455) and `resolveStack` (124) — the parser's card semantics —
are still closures inside `Battle`. So:

```
SOLO  play  ->  Battle     every card effect, the regression harness
TABLE play  ->  judge.js   the second seat, cards move zones and cost
                           what they print, and their text does nothing
```

Nothing routes between the two, and that separation is deliberate: a
control-flow bug and a card being read wrong must never be confusable.
**They converge when those three functions become a shared
`engine/effects.js` that BOTH callers use.** That is the next big piece
and the last structural one.

Their closure dependencies are small and known: `L`, `tokSeq`, `mkRune`,
`gy`, `had6ThisTurn`, `winCheck`, `openPrompt`, `bAct`, `built`, `db`,
`advValue`, `dummyDefence`. **`execute` calling `dummyDefence` inline is
the seam** — in `judge.js` it must hand control back and let the defend
step run.

Do it with the live trainer as a regression harness the whole way: it
plays every card effect today, so any port that changes its behaviour is
wrong.

---

## WHERE THINGS STAND

- `npm test` → **790 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way.
- **v2.51 on `main`, pushed and live.** `origin` is
  `git@github.com:dawnblade-ai/dawnblade-ai.git` over SSH and **a push IS
  the deploy** — GitHub Pages serves `main` at the repo root, live in
  about a minute. The user has given standing authorization to push
  without asking (2026-08-03).
- **Verify the deploy, not just the tests.** Pages can serve
  `index.html` and 404 every script, which looks fine until a tap does
  nothing. Check the URL returns 200 *and* that all **19** `engine/*.js`
  files do.
- `node` is at `~/node/bin`, **not on PATH** —
  `export PATH="$HOME/node/bin:$PATH"`.

### The engine, as it stands

| module | what |
|---|---|
| `parser.js` | card text — **Phase 3 territory** |
| `judge.js` | `reduce(state, action, seat)` — the rules as a pure function |
| `types.js` | what a card IS, off its structured type array |
| `priority.js` | the CR turn/priority machine — the spine |
| `build.js` | hero builds, slot rules, `buildMatch` (both seats from one spec) |
| `lobby.js` | the pre-game negotiation: hero → throw → sideboard |
| `wire/net/room/actions.js` | the sync layer |
| `report.js` | JUDGE!! — the board written down, for both boards |
| `invariants.js` | the guard rails, wired into both boards' funnels |
| `sparring.js` | `act(game, seat)` — a seat as a policy. **The only headless module left** |

`sparring.js` stays off the page on purpose: nothing calls it, and a
thing that proposes actions sitting next to a trainer with its own dummy
is the second-quiet-engine hazard `wire.test.js`'s `HEADLESS` list names.
It is the regression driver for `judge.js` in the drills.

---

## THE TOOL PHASE 3 RUNS ON

**JUDGE!!** — the button on the log pane, on **both** boards. It captures
every zone by `name#uid`, both hands, every counter, the chain, the feed,
the invariant violations, and the **RNG replay key** (`seed` plus stream
position), so a bug note can be one line and still be reproducible.

- `engine/report.js`, drilled in `test/report.test.js`.
- **When you add a zone or a per-side field, add it to `report.js`'s
  `seat()`** — a report that silently omits state is worse than none.
- A table report also carries the seat, the table code and net.js's
  counters: two peers on different hashes at the same `seq` is a desync
  stated in one line.
- `machine.lang` names which state vocabulary is authoritative, because
  every game carries both.

---

## THE FIVE RULES THAT CAUGHT EVERY BUG SO FAR

**1. NEVER INVENT CARD EFFECTS.** Card text streams from the public
database and is parsed. If a card does something new, teach the parser to
read its text — never special-case the card by name. This is the golden
rule and Phase 3 is where it is under most pressure.

**2. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier. Parse a card the trainer does not act on
and the audit starts claiming it works.

**3. READ THE WHOLE PHRASE OR REFUSE.** A loose substring match silently
drops printed restrictions. Look-alike cards are the hazard, not exotic
ones — Mounting Anger and Rising Resentment share a cost clause verbatim.

**4. COVERAGE AND FAIRNESS BOTH MISS WHOLE CLASSES OF BUG.** Neither can
see "too many of a legal thing" (the eight-gear bug), a card *weaker*
than printed (fairness is deliberately one-sided towards too-strong), a
card of the **wrong type** (the text parses perfectly), or a bug in the
machine rather than in a card. Only opening the game, or reading the
card, finds those. **A drill that asserts on the log cannot see the bug**
— assert on hands, life and zones.

**5. THE USER READS CARDS FOR A LIVING. ASK THEM.** v2.44 exists because
they looked at one line of output and said "that's wrong". They have
explicitly invited questions — take them up on it rather than guessing at
a type line, a keyword or a ruling.

---

## THE TRAPS, IN ONE PLACE

- **The database states the type twice and the two disagree** on 5 of
  4,862 records. `card.ty` (structured) is the authority; `card.tt`
  (`type_text`) is a display string. **Exception: a double-faced card
  flattens both faces into `ty`**, so DFCs parse the front face of `tt`.
- **A hardcoded seat index is the same bug as `you()`.** Rules code uses
  `act()`/`foe()`; `you()`/`opp()` are UI perspective only.
- **A per-side field written as a top-level game key** silently does
  nothing. `youMut()`/`oppMut()` to write, always.
- **Store the rng back** (`n.rng = rng`) or the next draw repeats.
- **When you add a zone, check the census still sees it.**
  `invariants.js` catches a card in *two* zones; a card in *none* falls
  out silently. That is why the combat chain is `g.chainCards`.
- **A loader schema change means bumping `DATA_VER` and editing the
  mirror in `index.html`** — `mapDbCard` exists in both, guarded field by
  field by `test/loader.test.js`.
- **Shared UI components are shared for real.** `ArmorGrid`,
  `DeckPitchCol`, `InPlayRow`, `GravePane`, `usePeek`, `PeekDock` and
  `JudgeSheet` are rendered by both boards. A change to one changes both,
  which is the point.
- **Driving this UI from JS needs one click per tool call.** Two
  `.click()`s in one tick batch into a single React render, so the
  two-tap card interaction re-arms instead of committing.
- **The browser caches `engine/*.js` aggressively** and a plain reload
  does not revalidate them. Re-fetch with `cache:"reload"` then reload,
  or you will debug the previous build.
- **Test at phone dimensions (393×852)**, not a tall desktop window — two
  shipped layout bugs existed only there.
- **Comments are scanned by the guards.** `test/sync.test.js` reads raw
  source, so English prose that reads like a call trips it; reword the
  prose rather than weakening the scan.

---

## VALIDATION LOOP

```bash
export PATH="$HOME/node/bin:$PATH"
npm test                              # 790 drills — must stay green
npm run fairness                      # must stay clean
npm run audit                         # regenerate AUDIT.md, READ the tier diff
node tools/audit.js --write-baseline  # ONLY after reviewing that diff
```

A tier drop is **not automatically a regression** — several times it has
been a correction, because the previous number was an over-claim.

Then **open it and play**. `.claude/launch.json` serves it on 8099. For
two-player work, open two browser tabs and have one host and one join —
the public relay works fine between them.

**Prove a new drill bites.** The convention here is to reintroduce the
bug and watch the drill fail, then restore. Several drills in this repo
were written, passed, and proved nothing until that was done.

---

## THE JOB

**Build carefully, one piece at a time, and never claim more than is
true.** Phase 3 is hundreds of small semantic changes to how printed text
is read, found by playing. The tools are the audit (coverage), the
fairness sweep (faithfulness), the sweep (hero abilities, tokens, rulings
understood but not built), `tools/rulings.json` (119 recorded rulings) and
JUDGE!!.

**Read `CLAUDE.md` first, in full.** Most entries exist because breaking
the rule already cost a real bug.
