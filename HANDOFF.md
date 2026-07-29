# Handoff — Dawnblade, at v2.32

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## The job

**Build carefully, one piece at a time, and never claim more than is true.**
The rules engine is strong and the guard rails are real. The work now is (a)
bringing the remaining pool cards online and (b) finishing the two-player
migration. Both reward reading over typing.

**Read `CLAUDE.md` first, in full**, then `ROADMAP-MULTIPLAYER.md`. Several
entries in them exist because breaking the rule already cost a real bug.

## Where things stand

- `npm test` → **377 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way; see below.
- Pool: **405 unique cards · 260 full / 110 part / 35 none**.
- Under git, `main`. **The user pushes to GitHub Pages manually** — there is no
  remote, no `gh`, no credentials. Deploying is not this thread's job.
- `npm run stack` → **2 open** (`charge`, `arsenal-triggers`), each carrying a
  specific question in `tools/followups.json`.

## Start here: the arsenal cluster (8 cards, fully specified)

Everything needed is in `tools/followups.json` under `arsenal-triggers`. The
short version:

- The trainer's end-of-turn arsenal sets cards **face DOWN**. Every one of these
  arrows triggers on **face UP**. They are different events — do not conflate
  them. (An earlier note claimed otherwise and was wrong.)
- The face-up path is a **hand → arsenal** move and it exists in the pool:
  **3 enablers** (Bull's Eye Bracers, Death Dealer, Call in the Big Guns) feed
  **5 payoffs** (Dry Powder Shot, Swift Shot, Entangling Shot, Ridge Rider Shot,
  Spire Sniping).
- **Sizing, verified:** `sd.arsenal` holds a card and is written in only 4
  places, so the card can carry a `_faceUp` flag the way minted cards carry
  `_playTurn`. `prompts.js`'s `moveCards` already supports `to:"arsenal"`. What
  is missing is stamping the picked card and firing **its own** ops — a
  `+2{p} this turn` has to live on the card until it is played.
- Of the 5 payoffs, **3 are readable now** (Dry Powder Shot `self:2`, Swift Shot
  `ga`, Ridge Rider Shot `opt 1`). Two are **not**, and should stay unclaimed:
  Entangling Shot taps a hero (not modelled) and Spire Sniping's "put them back
  in any order" is a **reorder**, which `opt` is not — `opt` lets you bottom
  cards, which would be strictly more powerful.

**The user has already ruled** (2026-07-28): Call in the Big Guns' first effect
resolves regardless; only the arsenal put is skipped when a card is already
there. Arsenal has a **capacity** (normally 1, two with New Horizon, which is
not in the pool), and the wordings differ — "no cards in your arsenal" means
**zero**, so Death Dealer and Bull's Eye Bracers need every slot empty, while
Call in the Big Guns needs only a free one. Model capacity; do not hardcode 1.

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

1. **`arsenal-triggers`** (8 cards) — specified above, ready to build.
2. **Brothers in Arms** — needs somewhere for a buff to an already-declared
   defender to live. `blockH` holds bare uids; `defBuff` exists but `runOps`
   only *logs* it (it is really applied by `playRx`, for cards played as
   reactions). Design options are in the followup.
3. **`newTurn` + `foeSwing`** — the last 2 of 7 rules functions on the actor
   seam. Both encode the DUMMY specifically, so they migrate together with
   giving seat 1 a real action phase; doing them separately is wasted work.
4. **Wire `priority.js` for real** — v2.27 put it in shadow and proved the
   mapping. Replace `playRx`'s hand-rolled speed gates and the hand-dim logic
   with `speedAllowed`/`canAct`, then retire `mode`/`bphase`. **Mind the clock:**
   `priority.js` counts player-turns; the trainer's `turn` counts only your own
   and feeds both the escalation table and the score.
5. **Hero abilities** — 13 of 15 heroes, 32 unread clauses. `npm run sweep`.

## Validation loop

```bash
npm test                              # 377 drills — must stay green
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
| `test/*.js` | 377 drills |
| `tools/audit.js` | coverage — how much text is read |
| `tools/fairness.js` | faithfulness — is anything stronger than printed |
| `tools/failstates.js` | how cards go wrong at the table |
| `tools/stack.js` · `sweep.js` | what the pool is still waiting on |
| `CLAUDE.md` | conventions, golden rule, known approximations |
| `ROADMAP-MULTIPLAYER.md` | the road to online play |
| `CHANGELOG.md` | what each version changed |
| `TORCH.md` | the world, the rules codex, licensing posture |

`tools/review.html` and `tools/sweep.html` are **generated** and no longer
versioned — regenerate with `npm run stack --html` / `npm run sweep --html`.
