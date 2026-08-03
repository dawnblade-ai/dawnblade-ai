# Handoff — Dawnblade, at v2.48

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## THE PLAN, AND WHERE WE ARE IN IT

**Three phases, in this order (user, 2026-08-02):**

```
1. ENGINE      ← YOU ARE HERE
2. MULTIPLAYER
3. CARD RULING TESTING  (the text boxes)
```

Phase 2 was started, made real progress, and was **deliberately stopped**
because every remaining multiplayer step was blocked on the same thing:
the rules lived inside a 2,505-line React component instead of a pure
reducer.

**The user's scoping instruction for Phase 1, verbatim (2026-08-02):**

> "focus on the card types and the numbers rather than the text boxes —
> we will tackle the text boxes in phase 3. ensure everything moves
> around properly in a 2 player game and the comprehensive rules are
> followed carefully to dictate turn structure, priority and the function
> of each different card type and their full usability from pitch to
> play."

So: **types and numbers YES, card text NO.** `runOps`/`execute` — the
parser's 700 lines of card semantics — are explicitly Phase 3 work. Do
not port them as part of Phase 1.

---

## WHERE THINGS STAND

- `npm test` → **713 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way.
- Branch `multiplayer-hero-select`, at **v2.48**. `main` is at v2.38.
- **Unpushed.** The user uploads to GitHub Pages manually — no remote, no
  `gh`, no stored credential. Deploying is not your job.
- `node` is at `~/node/bin`, **not on PATH** —
  `export PATH="$HOME/node/bin:$PATH"`.

### What Phase 1 has landed (v2.42–v2.45)

| module | what | status |
|---|---|---|
| `engine/build.js` | how a seat becomes a hero: `buildSide`, `defaultPicks`, slot rules | **live** — loaded, bridged, in `MODULES` |
| `engine/judge.js` | `reduce(state, action, seat)` — the rules as a pure function | **headless** |
| `engine/types.js` | what a card IS, off its structured type array | **headless** |
| `engine/sparring.js` | `act(game, seat)` — a seat as a policy | **headless** |

All three headless modules are declared in `test/wire.test.js`'s
`HEADLESS` list. **Coming off that list must be the same edit that adds
them to `test/sync.test.js`'s `MODULES`.**

`judge.js` models the CR turn structure (4.2–4.4), the combat chain
(7.x), resource payment on demand, defenders from hand and equipment,
printed power against printed defence, go again as a GAIN, instants
costing no action point, the arsenal, fatigue, and the ordered end
phase. Verified by driving two real precons at each other: 17 turns, 261
actions, zero invariant violations, every dealt card in exactly one zone.

**It does not model card EFFECTS, and must not until Phase 3.**

### v2.45 — the CR review, and what it cost

A pass over the turn structure and priority windows grounded against the
**published CR** rather than the code's memory of it. **Nine bugs, and
not one was a card being read wrong** — every affected card parsed
perfectly. See CHANGELOG.md for the full list; the ones worth carrying:

- **CR 4.4.3f drew for the wrong hero.** (e) calls `priority.endTurn`,
  which does CR 4.4.4's *handoff* as well as 4.4.3e's fizzle, so
  `n.turnPlayer` at (f) is the INCOMING player. It inverts block-or-hold:
  you refill at the end of YOUR turn so you can block during THEIRS.
- **CR 4.4.3a ran only in the log.** `resetAllyLife` returns the GAME,
  not `{game,msgs}` — a wounded ally never healed while "(a) Allies
  recover." printed every turn.
- **An invented deck-out loss.** CR 4.5.3 has exactly three: life to
  zero / no hero, an effect says so, concede.
- **Two priority windows never opened**: a play or a declaration did not
  break the pass "succession", so the attacker never got to answer a
  defence reaction; and CR 4.3.4's mutual pass never ended the action
  phase, leaving a window nobody could act in.
- **Allies could not be attacked** (CR 1.4.5) — now wired, with the
  target riding on the ACTION rather than a prompt.

**TWO OF THESE LIVED UNDER GREEN DRILLS THAT READ THE LOG.** Assert on
hands, life and zones, never on `feed` prose.

---

### v2.46 — a seat becomes a policy, and three more CR fixes

`engine/sparring.js` is `act(game, seat) -> action | null`. The rules no
longer know who is driving a seat, so solo / hotseat / network are the
same game with a policy, a tap, or a packet calling `reduce`. It
**proposes and `judge.legal` disposes** (a refusal is always a bug in the
policy), it **reads no card text** (printed numbers only — drilled), and
it is **deterministic and never touches `game.rng`**. Driven at each
other across six matchups and both seatings: 144 games, zero refusals,
zero invariant violations. **The winner follows the hero, not the chair.**

Porting `dummyDefence` unchanged made the game degenerate — both seats
blocked 41 of 41 attacks and one finished on full life — because that
heuristic was written for a seat with no action phase, where a card in
hand had no use but to block. `takeUpTo` is the fix, with lethal
overriding it.

Three CR fixes found while proving it:

- **A wall defends ONE chain link.** `blockG` stood until the chain
  closed, so link 2 got the same iron for free. Nearly invisible: Silver
  Age equipment is almost all battleworn and wears to 0 after one block.
- **`endTurn` skipped the opponent's last priority window (CR 4.3.4).**
  It is now a pass carrying intent; ending a turn takes two actions.
- **CR 4.4.3d untapped only the gear zone**, and `weaponUsed` conflated a
  TAP (lifts at the controller's untap step) with a per-turn ALLOWANCE
  (renews for both seats every turn).

---

## THE REMAINING PHASE 1 WORK

1. **Wire `Battle` to `dispatch`** and retire the 97 `mode`/`bphase`
   references. Whatever replaces `setG` **must keep the invariant-judge
   funnel**, or the guard rails go dark. `foeSwing` and `dummyDefence`
   die here — `sparring.js` is what replaces them, so this is now a
   deletion rather than a rewrite.
2. **Retune with a play session.** Seat 1 has a real action phase in
   `judge.js` and plays real cards, so the `[3,4,5]` escalation's
   difficulty curve no longer applies. This is a play question, not a
   drill question.

Known and deliberately unbuilt, each honest rather than hidden:
the **layer-step window** (CR 7.1.2 — an attack goes straight onto the
chain instead of sitting on the stack first; the equivalent instant
window still exists in the ATTACK step, so what is missing is the
stack/chain distinction, which no Phase 1 rule asks about); **allies do
not attack** (they are attackABLE, and CR 4.4.3d's arena untap is now
built ahead of it); the **mandatory half of CR 1.4.5** (the caller must
offer the target choice); and **`index.html` still carries the invented
fatigue loss**, left alone because the dummy reshuffles its graveyard,
making it a solo-play decision rather than a rules fix.

Mind the clock throughout: `priority.js` counts player-turns in `turn`
and rounds in `round`; the trainer's `turn` counts only *your* turns and
feeds **both the escalation table and the score**.

---

## THE FOUR RULES THAT CAUGHT EVERY BUG THIS STRETCH

**1. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier. Parse a card the trainer does not act on
and the audit starts claiming it works.

**2. READ THE WHOLE PHRASE OR REFUSE.** A loose substring match silently
drops printed restrictions. Look-alike cards are the hazard, not exotic
ones.

**3. COVERAGE AND FAIRNESS BOTH MISS WHOLE CLASSES OF BUG.** Neither can
see "too many of a legal thing" (the eight-gear bug), a card being
*weaker* than printed (fairness is deliberately one-sided), or a card
being the **wrong type** (v2.44 — the text parsed perfectly). Only
opening the game, or reading the card, finds those.

**4. THE USER READS CARDS FOR A LIVING. ASK THEM.** v2.44 exists because
they looked at one line of output and said "that's wrong". They have
explicitly invited questions — take them up on it rather than guessing
at a type line, a keyword, or a ruling.

---

## THE TRAPS, IN ONE PLACE

- **The database says the type twice and the two disagree** on 5 of 4,862
  records. `card.ty` (structured) is the authority; `card.tt`
  (`type_text`) is a display string. **Exception: a double-faced card
  flattens both faces into `ty`**, so DFCs parse the front face of `tt`.
- **A hardcoded seat index is the same bug as `you()`.** Sweep for
  literal `0`/`1` as each function migrates.
- **A per-side field written as a top-level game key** silently does
  nothing. `youMut()`/`oppMut()` to write, always.
- **Store the rng back** (`n.rng = rng`) or the next draw repeats.
- **When you add a zone, check the census still sees it.**
  `invariants.js` catches a card in *two* zones; a card in *none* falls
  out silently. That is why the combat chain is `g.chainCards`.
- **A loader schema change means bumping `DATA_VER` and editing the
  mirror in `index.html`** — `mapDbCard` exists in both.
- **Driving this UI from JS needs one click per tool call.** Two
  `.click()`s in one tick batch into a single React render, so the
  two-tap card interaction re-arms instead of committing.
- **Test at phone dimensions (393×852)**, not a tall desktop window —
  two shipped layout bugs existed only there.

---

## VALIDATION LOOP

```bash
npm test                              # 679 drills — must stay green
npm run fairness                      # must stay clean
npm run audit                         # regenerate AUDIT.md, READ the tier diff
node tools/audit.js --write-baseline  # ONLY after reviewing that diff
```

A tier drop is **not automatically a regression** — several times it has
been a correction, because the previous number was an over-claim.

Then **open it and play**. Serve with `python3 -m http.server 8099`
(`.claude/launch.json`). The browser caches `engine/*.js` aggressively
and `location.reload(true)` does not revalidate them.

**Prove a new drill bites.** The convention here is to reintroduce the
bug and watch the drill fail, then restore. Several drills in this repo
were written, passed, and proved nothing until that was done — including
two of mine this session.

---

## REPO MAP

| file | what |
|---|---|
| `index.html` | the trainer (UI + `Battle`, the reducer-to-be) |
| `engine/judge.js` | `reduce(state, action, seat)` — headless, Phase 1 |
| `engine/types.js` | card types off the structured array — headless |
| `engine/build.js` | hero builds + equipment slot rules |
| `engine/priority.js` | the CR turn/priority machine — the spine |
| `engine/parser.js` | card text (Phase 3 territory) |
| `engine/invariants.js` | the guard rails, wired into `setG` |
| `engine/wire/net/room/actions.js` | the sync layer, wired, blank decks |
| `CLAUDE.md` | conventions and known approximations — **read in full first** |
| `CHANGELOG.md` | what each version changed and why |
| `ROADMAP-MULTIPLAYER.md` | the road to online play (Phase 2) |

## THE JOB

**Build carefully, one piece at a time, and never claim more than is
true.** Phase 1 is a rebuild of how the rules are *held*, not of what
they say. Both reward reading over typing.

**Read `CLAUDE.md` first, in full.** Several entries exist because
breaking the rule already cost a real bug.
