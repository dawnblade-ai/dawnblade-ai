# Handoff — Dawnblade, at v2.40

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## IN FLIGHT — branch `multiplayer-hero-select`

**Goal (user, 2026-08-02):** the *Find an opponent* screen should let each
player pick a hero and start a real game.

**Landed:** `buildSide(h, db, opts, rng, ctr)` — module-level in `index.html`,
just above `Battle`. One hero, one build, called once per seat. `built` now
calls it for seat 0 and keeps the dummy's two stubs. Verified in a live Kayo
game: 86 cards, 86 distinct uids, invariant judge clean, 580 drills green.
Two things it deliberately guards, both of which would have failed silently —
the uid counter is **passed in and shared** (two independent calls would hand
both seats uid 1..N, i.e. `CARD-IN-TWO-ZONES`), and the rng threads
seat 0 → seat 1 → Battle in a **fixed order** so two peers dealing from the
same table code deal the same decks.

### DO NOT PUT THE HERO PICKER ON THE TABLE SCREEN FIRST

It would build a screen that lies. The table runs `engine/actions.js`'s
**blank drill decks** — two players would pick Kayo and Iyslander and then
play vanilla cards with no rules text. That is precisely what
`ROADMAP-OPPONENT.md` warns against: *"Trading an honest approximation for a
dishonest one is a step backwards even if it looks like progress."*

The honest order, each step leaving the game playable:

1. ✅ `buildSide` — done, committed.
2. **Opponent picks a hero in the SOLO game** (`ROADMAP-OPPONENT.md` Phase 1).
   Real hero, real deck, real equipment; it **blocks** with printed defence and
   still takes no action phase. Safe today — the roadmap's "do not give it a
   real deck" warning is about *playing* cards, and blocking with printed
   defence works for any card. Landmine: `DUMMY_INT` goes here and `newTurn`'s
   every-turn refill must go **at the same moment** or the opponent draws twice.
3. **Seat 1 takes an action phase** (Phase 2) — needs `priority.js` wired for
   real. **97** `mode`/`bphase` refs in `index.html` (45 `g.mode`, 23 `s.mode`,
   23 `bphase`, 6 `n.mode`). The hard one; own thread.
4. **Then** the table, and only then the picker.

### The table's architecture fork — decide at step 4, not before

Both peers currently must run the same reducer, and `Battle` is 22 `setG`
closures rather than a `reduce(state, action)`. Two ways out:

| | cost | trade |
|---|---|---|
| **A — lockstep** (the documented design) | extract `judge.js`: the whole rules core into a pure reducer | what `net.js` was built for; Phase C's server move is a relocation of the sequencer |
| **B — host-authoritative** | far smaller: `net.js` **already has a `SNAPSHOT` message** ("host → guest: the whole game, one JSON object") and the guest already `adopt`s it | host runs all rules, guest is a thin client; host dropping ends the match |

B is much cheaper and the machinery is already built and drilled. It departs
from `ROADMAP-MULTIPLAYER.md`'s stated design, so it is the user's call.
**Steps 2 and 3 are required either way** — do them first and decide later.

If B: the hero exchange fits the existing handshake. HELLO carries an opaque
`setup` payload, the host builds the real state from it before its existing
`WELCOME` + `SNAPSHOT`, and the guest adopts. `net.js` never learns what a
hero is.

---

## The job

**Build carefully, one piece at a time, and never claim more than is true.**
The rules engine is strong and the guard rails are real. The work now is (a)
bringing the remaining pool cards online and (b) finishing the two-player
migration. Both reward reading over typing.

**Read `CLAUDE.md` first, in full**, then `ROADMAP-MULTIPLAYER.md`. Several
entries in them exist because breaking the rule already cost a real bug.

## Where things stand

- `npm test` → **522 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way; see below.
- Pool: **405 unique cards · 265 full / 108 part / 32 none**.
- Under git, `main` at v2.38. **The user uploads to GitHub manually** — there is
  no remote, no `gh`, no stored credential. Deploying is not this thread's job,
  and do not try to route around it.
- **Phase B of `ROADMAP-MULTIPLAYER.md` is BUILT and PROVEN** — see "The sync
  layer" and "The table" in `CLAUDE.md`. Two devices can sit at a table code and
  play in lockstep. What they cannot yet play is *Flesh and Blood*; read the
  next section before assuming multiplayer is done.
- `npm run stack` → **3 open** (`charge`, `high-tide`, `surge`); `charge`,
  `phantasm` and `arsenal-reorder` each carry a specific question in
  `tools/followups.json`.

## READ THIS BEFORE TOUCHING MULTIPLAYER

**The network is finished. The second player does not exist.** It is easy to
look at the table screen, see two phones in sync, and conclude Phase 2 is done.
It is not, and the gap is not in the transport:

- `foeSwing` fabricates the opponent's attack as `[3,4,5][(turn-1)%3]`. **Seat 1
  emits a number, not a played card.** It has no action phase, no hand it plays
  from, and pays no costs — so there is nothing for a second human to occupy.
- `Battle` is **22 `setG` closures**, not a `reduce(state, action)`. `net.js`
  takes `reduce` as a parameter precisely so `judge.js` can drop in, but that
  reducer does not exist yet.

So the table runs `engine/actions.js`'s **blank decks**: real CR turn structure,
real priority, a real combat chain, and no card text anywhere. That was
deliberate — a transport failure and a card being read wrong must never be
confusable — and there are drills that fail if a pool card ever appears there.

**Both blockers are the same work as sunsetting the dummy.** Give seat 1 an
action phase (`ROADMAP-OPPONENT.md` Phase 2) and extract the reducer
(`ROADMAP-MULTIPLAYER.md` Phase B step 6), and the existing sync layer carries
real decks with no changes to `wire.js`, `net.js` or `room.js`.

## Start here: `priority.js`, then the opponent

**The user's direction (2026-08-01): sunset the dummy.** It becomes an
*opponent* — a fully playable side that picks a hero and is driven by very
simple strategy. Everything from here is built multiplayer-first.
**`ROADMAP-OPPONENT.md` is the plan**; read it before starting, it explains
why the phases are in that order and what "simple strategy" is allowed to mean.

### Scoped, so it can start immediately

**88 `mode`/`bphase` references** in `index.html` (25 `s.mode`, 43 `g.mode`,
7 `n.mode`, 22 `bphase`). Do **not** try to remove them in one pass. The safe
order, each step behaviour-identical *today* and correct the moment seat 1
acts:

1. **`playRx`'s speed gate first — it is the smallest and the most wrong.**
   It hand-rolls the window as `inAtk = s.mode==="stack"` and then an inline
   `isAR(c) || (isInstantT(c) && …)` test. That is `speedAllowed(g, seat)`
   stated once, and `speedAllowed` already knows the window follows the
   ATTACKER rather than the seat number — which the hand-rolled version
   cannot express at all.
2. **The hand-dim / playability logic**, same substitution.
3. **Then** retire `mode`/`bphase` as the source of truth, and only then.

`fromTrainer` is already proven against live play and v2.35 corrected its
one wrong mapping (arsenal is an end-phase step). Trust it.

The blocking item is unchanged and is now the *only* thing in the way:
**wire `priority.js` for real.** The opponent cannot take an action phase while
`mode`/`bphase` encode "the player is acting" as an invariant. v2.27 put the
machine in shadow and proved the mapping; v2.35 corrected the arsenal mapping
(it is an end-phase step, not an action). What is left is moving the consumers:
`playRx`'s hand-rolled speed gates and the hand-dim logic become
`speedAllowed`/`canAct`, then `mode`/`bphase` retire.

**Mind the clock.** `priority.js` counts player-turns and ticks on every
handoff; the trainer's `turn` counts only *your* turns and feeds both the
escalation table and the score. Reconciling them is part of giving seat 1 a
turn, not a separate job.

## What v2.35 changed that you should know about

- **Printings.** Every card resolves to its Silver Age face; the Dawnblade is
  the only Marvel card and a drill enforces it. `mapDbCard` and the loader in
  `index.html` both build `prs` — **change both**, and bump `DATA_VER`.
- **The end phase runs CR 4.4.3 in order**, each step marked `CR 4.4.3<letter>`
  and pinned by a drill. Reordering them is a rules change.
- **Pitching is on demand, never proactive** (user ruling) — see CLAUDE.md.
- **Arena abilities activate.** `boardPow` + `peekables` + `execute`'s
  `from==="board"` branch. Allies still use `allySwing`.

## The two rules that caught every bug this stretch

**1. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed, which
raises the card's tier. Parse a card the trainer does not act on and the audit
starts claiming it works. This shipped once (v2.28) and was caught twice more
before shipping. If you cannot wire it this session, do not parse it.

**2. READ THE WHOLE PHRASE OR REFUSE.** A loose substring match silently drops
printed restrictions:

> Mounting Anger — "banish an attack action card from your hand **with cost less
> than the number of Draconic chain links you control**"

`{type:"attack"}` dropped the limit, so any attack card became a legal banish.
**Look-alike cards are the hazard, not exotic ones**: Rising Resentment shares
that clause verbatim and differs only in its rider.

## `npm run fairness` — run it after every card batch

It asks *"is any card STRONGER than printed?"*, which the coverage audit
**cannot see**. Four bugs this stretch had identical tiers before and after:

| cards | what |
|---|---|
| 34 | a `+N{p}` applied twice — Act of Glory printed +6, gave **+12** |
| 27 | go again granted unconditionally against the card's own text |
| 24 | a type qualifier dropped — an **arrow** buff landing on a sword |
| 3 | `instead` read as an ADDITION — Emeritus Scolding dealt **6** where it prints 4 |

It is cheap, and it has found something every time it has been pointed at new
ground. `test/fairness.test.js` pins that it stays quiet.

## What is left, ranked

1. **Wire `priority.js` for real** — see above. Blocks the opponent work.
   Then **seat 1's action phase** and **`judge.js`**, which together are the
   only thing between the working sync layer and real two-player FaB.
2. **`newTurn` + `foeSwing`** — the last 2 of 7 rules functions on the actor
   seam. Both encode the DUMMY, so they migrate together with giving seat 1 a
   real action phase (`ROADMAP-OPPONENT.md` Phase 2).
3. **Brothers in Arms** — needs somewhere for a buff to an already-declared
   defender to live. `blockH` holds bare uids; `defBuff` exists but `runOps`
   only *logs* it (it is really applied by `playRx`, for cards played as
   reactions). Design options are in the followup.
4. **Hero abilities** — 13 of 15 heroes, 32 unread clauses. `npm run sweep`.

## Validation loop

```bash
npm test                              # 522 drills — must stay green
npm run fairness                      # must stay clean
npm run audit                         # regenerate AUDIT.md, READ the tier diff
node tools/audit.js --write-baseline  # ONLY after reviewing that diff
npm run stack                         # STACK.md + tools/review.html
npm run sweep                         # hero abilities, tokens, ruled-not-built
```

A tier drop is **not automatically a regression** — three times this stretch it
was a correction, because the previous number was an over-claim. Read the diff
and decide, then repin deliberately.

Then **open it and play**. Nearly every bug this project has had was found in
play or by reading, never by a red test. The browser caches `engine/*.js`
aggressively and `location.reload(true)` does not revalidate them — fetch and
re-eval the module if a change seems not to have landed.

## Hard constraints

- **No build step, ever.** Plain UMD `<script src>`; must run from `file://`.
- **Never invent card effects.** Teach the parser to read the text. If it cannot
  be read honestly, leave the card unclaimed — do not guess.
- `you()`/`opp()` **read**, `youMut()`/`oppMut()` **write**, and rules functions
  use `act()`/`foe()`. Never write a side field as a top-level game key.
- **Bump `DATA_VER`** if anything is added to `NEEDED`.
- Store the rng back after every draw (`n.rng = rng`), or the next draw repeats.
- **Talishar is an oracle, not a source.** GPL-3.0; see `TORCH.md`.

## Repo map

| file | what |
|---|---|
| `index.html` | the trainer (UI + `Battle`, the reducer) |
| `engine/*.js` | the pure rules engine — parser, sides, priority, prompts, rng, invariants |
| `engine/wire.js` | the game as one JSON object + the rules fingerprint (`hash`, `diffPaths`) |
| `engine/net.js` | the session: handshake, sequencing, desync detection, resync |
| `engine/actions.js` | six **blank** actions — the reference reducer, no cards in it |
| `engine/room.js` | the transport: PeerJS, table codes, the only file that knows a network exists |
| `test/*.js` | 522 drills |
| `tools/audit.js` | coverage — how much text is read |
| `tools/fairness.js` | faithfulness — is anything stronger than printed |
| `tools/failstates.js` | how cards go wrong at the table |
| `tools/stack.js` · `sweep.js` | what the pool is still waiting on |
| `CLAUDE.md` | conventions, golden rule, known approximations |
| `ROADMAP-MULTIPLAYER.md` | the road to online play |
| `ROADMAP-OPPONENT.md` | sunsetting the dummy into a real opponent |
| `CHANGELOG.md` | what each version changed |
| `TORCH.md` | the world, the rules codex, licensing posture |

`tools/review.html` and `tools/sweep.html` are **generated** and no longer
versioned — regenerate with `npm run stack --html` / `npm run sweep --html`.
