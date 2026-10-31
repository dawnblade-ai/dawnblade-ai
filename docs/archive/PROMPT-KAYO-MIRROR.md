# Launch prompt — the Kayo mirror

Paste everything below the line into a fresh Sonnet Claude Code thread in this repo.

---

You are building **Kayo vs Kayo** — the first real matchup in Dawnblade, a
rules-accurate Flesh and Blood sim. Today the game is one hero against an iron
training dummy. Your job is to make one *matchup* perfect, end to end, playing
it as you go, and to stop and report the moment you hit something that needs a
decision.

Read **`JOB-AID-TESTERS.md`** first — it is the card-work procedure and the
rules of the house, and it tells you which parts of `CLAUDE.md` to skim and
which to skip. Then read **`ROADMAP-OPPONENT.md`**. Skip everything else until
you need it.

You work in two alternating roles, described below: **BUILDER** teaches the
engine, **JUDGE** plays the game and tries to break it. Both are you. Switch
deliberately and say in the round log which hat you are wearing.

---

## Why the mirror, and why Kayo

**A mirror match is a symmetry test.** Both seats have the same hero, the same
55 cards, the same life, the same intellect. So *any* difference in behaviour
between seat 0 and seat 1 is a bug **by construction** — you do not need to
reason about whether it should differ. `engine/invariants.js` already ships
`SIDES-ASYMMETRIC` and `engine/sides.js` ships `symmetryGap()`; nothing has
ever exercised them against real cards. The mirror is what does.

**Kayo is the right hero**, for reasons you should verify rather than trust:

- Its pool is **32 unique cards, 28 already at tier `full`** — the best-covered
  hero in the game. Four remain.
- It is a Brute: **no runechants, no frostbite, no soul, no charge, no combo,
  no arsenal instants.** Every hero-specific flag in the trainer's `built`
  object (`viseraiPassive`, `iceFrostbite`, `arsenalInstant`, `wateryGrave`,
  `lyathBoo`) is one Kayo does **not** use — so the Kayo mirror needs the
  fewest per-side build fields split apart.
- Both its tokens (**Might**, **Agility**) already read at `fx: full`.

---

## What the table can and cannot do — read before planning

The eventual goal is two browser tabs, *Find an opponent*, Kayo on both sides.
**That is not possible today, and the app says so itself** on the table screen:

> Table play runs the **drill decks** — blank cards, real Flesh and Blood turn
> structure. Hero decks need seat 1's action phase before they can cross the wire.

There is no hero picker on that screen. It runs `engine/actions.js`'s blank
decks — real CR turn structure and priority, no card text anywhere — and that
was deliberate: a transport failure and a card being read wrong must never be
confusable. The opponent today is `{id:1, name:"The Dummy", hp:42, int:4}`
holding 30 vanilla Generic attacks, with no hero, no hero power, no hero build
and no action phase. Its swing is a scripted `[3,4,5][(turn-1)%3]` escalation —
a *number*, not a card played from hand.

So the two-tab mirror is the **destination**, reached through the milestones
below. Do not start by opening two tabs; you will find no hero picker and learn
only what this paragraph already told you.

---

## M1 — Kayo's cards and hero ability *(no blockers; start here)*

Buildable today against the dummy. Follow the BUILDER loop in
`JOB-AID-TESTERS.md` §5, drills included.

**Four pool cards below `full`:**

| card | unread |
|---|---|
| Beaten Trackers (p0) | "Whenever you discard a random card with 6 or more {p}, you may destroy this" / "If you do, gain 1 action point." |
| Pulping (p1) | "If a card with 6 or more {p} is discarded this way, this gets dominate." |
| Agile Windup (p3) | "Instant - Discard this: Create an Agility token." |
| Rally the Coast Guard (p3) | "Once per Turn Instant - Discard a card: This gets +3{d}" |

**Kayo's hero ability — 0 of 3 clauses read.** The substantial half of M1:

1. `You have 1 weapon zone.`
2. `Attack action cards you own get +1{p} while they are in any zone other than the combat chain.`
3. `The first time you discard a card with 6 or more {p} during each of your action phases, create a Might token.`

**Clause 2 is a trap and you must get it exactly right.** The +1{p} applies in
hand, arsenal, pitch, graveyard and deck — and **stops applying the moment the
card is on the combat chain**, the one place its power actually strikes. So it
changes what the player *sees* and what the discard-threshold cards *count*,
without changing damage dealt. Note what that means for the "6 or more {p}"
family running through Kayo's whole identity (clause 3, Beaten Trackers,
Pulping, Mandible Claw's rider, `discard6`): **a 5-power card in hand is a
6-power card while it is in hand.** Decide that reading deliberately, write it
in the round log, and drill it. Wrong in either direction changes every game
Kayo plays.

Beware the historic **Kayo bug** (`CLAUDE.md`, golden rule section): printed
keywords and *granted* keywords stay separate, and `card_keywords` is an
**index**, not a claim of unconditional possession.

**M1 gate:** four cards at `full`, three hero clauses read, `npm test` green
with new drills you have **proven bite**, `npm run fairness` clean, and the
JUDGE pass below completed.

---

## The JUDGE pass — play it, systematically

**This is the half that finds the bugs.** Nearly every bug this project has had
was found in play or by reading, never by a red test — all 580 drills stayed
green through four separate bugs where cards were read *wrong*.

### Running it

```bash
npm test   # never play on a red suite
```

Start the app with the preview tools (`preview_start` with name `dawnblade` —
it serves on :8099; do **not** run a server with Bash). Open `index.html`,
pick Kayo, play. Verify at **phone dimensions, 393×852** — one whole bug class
only exists there, and a tall desktop window hides it.

The browser caches `engine/*.js` hard and `location.reload(true)` does not
revalidate them. If a change seems not to have landed, fetch and re-eval the
module before concluding anything.

### Your instruments

- **`window.__dawnJudge`** — every invariant violation seen this game. The
  invariant judge is wired into `setG`, so every state change in a real game is
  audited. It never throws (a violation must not cost a player their game) —
  it logs. **Read it after every card.**
- **The JUDGE!! button** on the log pane — dumps both sides' zones with `_gy`
  stamps, every counter, `hist`, chain, stack, prompts, the whole feed, and
  `rng.seed` + `rng.n`. A finding reported with this is a reproducible game.
- **`javascript_tool`** to inspect React state directly rather than squinting
  at the screen.
- **The seed.** `cfg.seed` is threaded through Loadout → Pregame → Battle. Pin
  it and a game is replayable — that is what makes a finding reproducible and a
  fix verifiable.

### The systematic part — and the trap in it

You asked for every card and token covered. **Clicking through games is a bad
way to achieve that**: a 55-card deck drawing 4 a turn means many cards are
simply never drawn, and a card never drawn is a card never tested. Random play
will feel thorough and cover maybe half the pool.

So keep an explicit **coverage checklist in `ROUNDS.md`** — one row per Kayo
card (32) and per token (Might, Agility). A row is ticked **only** when you
have watched that card actually resolve in a real game and verified its
printed numbers against what the board did. Untested rows stay visible.

Then drive coverage deliberately rather than hoping:

- pin seeds and replay to reach a specific card;
- use the loadout to bias what is in the deck where the UI allows it;
- for anything you genuinely cannot reach in play, say so in the log and cover
  it with a parser drill instead — and mark the row **drill-only**, not done.

### What you are looking for

Work `JOB-AID-TESTERS.md` §6's five archetypes, plus the mirror-specific ones:

1. **Any asymmetry between the seats.** In a mirror there is no innocent
   explanation. Check `symmetryGap()` and `SIDES-ASYMMETRIC`.
2. **Displayed number ≠ printed number.** Especially with Kayo's clause 2
   live — that is a *display* rule, so the screen is the thing under test.
3. **A card that looks playable and does nothing when tapped.** The failure
   mode this codebase cares most about. It comes from a dim/legality test
   drifting from the play path.
4. **Cost charged wrong.** An instant costs no action point; go again is a
   *gain*, not a refund. Invisible to both the audit and the fairness sweep.
5. **Legibility.** This is a *training* sim — if the log does not say why
   something happened, that is a finding, not a nitpick.

Log every finding with its seed and turn. Then switch to BUILDER and fix it.

---

## M2 — the opponent becomes Kayo *(`ROADMAP-OPPONENT.md` Phase 1)*

The opponent gets a hero, life, intellect, equipment and a real Kayo deck. **It
still does not take an action phase.** It blocks — already strictly more honest
than the dummy, and enough to make the mirror's symmetry checks meaningful.

The real work is that `built` is one object captured in closure and it is **the
player's** hero build. Both sides need their own. Kayo is the cheap first case,
but build the **general seam**, not a Kayo special case.

**Landmine from the roadmap:** `DUMMY_INT` disappears here and the opponent
draws to *its hero's* intellect. The `newTurn` refill that tops the dummy up
every turn — standing in for the turn it never takes — must go at the same
moment, **or the opponent draws twice.**

**M2 gate:** `symmetryGap()` and `SIDES-ASYMMETRIC` clean with both seats
holding real Kayo decks; tests green; a played game where the opponent blocks
with real Kayo cards and its hero and equipment render.

---

## M3 — the opponent takes a turn — **STOP HERE AND REPORT**

**Do not start this.** This is the known roadblock and it deserves a fresh
thread with clean context.

Seat 1 cannot act while `mode`/`bphase` encode "the player is acting" as an
invariant — **97 such references** in `index.html` (45 `g.mode`, 23 `s.mode`,
23 `bphase`, 6 `n.mode`). Retiring them means wiring `engine/priority.js` in
for real, which changes **control flow** rather than field names.

At the M2 gate, write up what M3 will require based on what you actually
learned in M1 and M2 — especially anything that surprised you about `built`,
the end phase, or the mirror's symmetry — and hand back.

## Beyond M3, so you know where this is going (do not build)

Two tabs at a table is **not** the next step after M3, and it is worth knowing
why before you plan anything around it:

- **A playable mirror arrives sooner via hotseat** — one tab, both seats driven
  from the same page. `ROADMAP-MULTIPLAYER.md` sequences hotseat first
  precisely because it needs no network and no reducer extraction.
- **The two-tab table needs one more thing on top of M3:** `net.js` takes
  `reduce` as a parameter, but `Battle` is **22 `setG` closures**, not a
  `reduce(state, action)`. Real decks cannot cross the wire until `judge.js` is
  extracted (`ROADMAP-MULTIPLAYER.md` Phase B step 6). Then the table screen
  needs a hero picker.

---

## Effort

**Default effort. No extended thinking for M1's card work** — reading a clause
and adding a regex does not need it. Turn it on for exactly two things: Kayo's
clause 2 (the out-of-chain +1{p} and what it means for every "6 or more {p}"
card), and the `built` split in M2. Say in the round log when you used it.

Small batches, logged to `ROUNDS.md` per `JOB-AID-TESTERS.md` §8, with the
coverage checklist kept current. **Stop and ask me** rather than guessing when:
a phrase has two readings that give different games; a card needs a ruling not
already in `tools/rulings.json` (check it — there are 119); or M2's build split
wants a decision about how per-side hero state should be shaped.

One clear question beats twenty exploratory tool calls. We are on a hard budget.

## Never

- **Invent a card effect.** Teach the parser to read the printed text. If it
  cannot be read honestly, leave the card unclaimed and say so — a success
  line, not a failure.
- **Parse ahead of wiring.** Reading a clause raises the card's tier, so a
  clause the trainer does not act on makes the audit claim the card works.
- **Special-case a card by name** outside `CARD_OVERRIDES`
  (`engine/parser.js:676`), which pins the printed text and refuses itself when
  the database wording drifts.
- **Give the opponent cards the parser cannot read** — that is why M1 precedes M2.
- **Run a dev server with Bash.** Use the preview tools.
- **Add a build step.** Plain UMD `<script src>`, must run from `file://`.
- **Commit or push.** There is no remote; the human deploys manually.

## Every milestone ends green

```bash
npm test          # 580 drills — must stay green and go UP
npm run fairness  # must stay clean
npm run audit     # then READ the tier diff, don't skim it
npm run progress
```

Green tests are the floor, not the goal. Coverage counts clauses consumed, not
whether the consumption was faithful — **the mirror, played, is the real test.**

**Start by confirming the ground truth for yourself** — Kayo's four open cards
and three hero clauses — then tell me your M1 plan before you edit anything.
