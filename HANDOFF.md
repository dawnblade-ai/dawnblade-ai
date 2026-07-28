# Handoff — Dawnblade, at v2.29

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## The job

**Build carefully, one piece at a time.** The rules engine is strong and the
guard rails are real; the work now is (a) finishing the two-player migration and
(b) bringing the remaining pool cards online. Both reward reading over typing.

**Read `CLAUDE.md` first, in full**, then `ROADMAP-MULTIPLAYER.md`. Several
entries in them exist because breaking the rule already cost a real bug.

## Where things stand (v2.29)

- `npm test` → **360 drills, all green.** Never leave them red.
- Pool: **405 unique cards · 263 full / 109 part / 33 none**.
- **The project is under git now** (9 commits, `main`). It was not before —
  10.6K lines had no version control at all.
- **The user pushes to GitHub Pages manually.** Do not attempt to deploy: there
  is no remote, no `gh`, no credentials, and none of that is your job here.
- `npm run stack` → **2 open entries** (`charge`, `arsenal-triggers`), both
  carrying specific follow-up questions in `tools/followups.json`.

### What landed this stretch

| ver | what |
|---|---|
| 2.24 | the **actor seam** — `act()`/`foe()` read `s.actor`; `you()`/`opp()` demoted to UI-only |
| 2.25 | the rules core speaks in actor terms — **5 of 7** functions migrated (~430 call sites) |
| 2.26 | the **seeded RNG** (`engine/rng.js`) — replay, drills, lockstep |
| 2.27 | the **priority machine in shadow** — turned on four dormant invariants |
| 2.28 | **optional costs are read** — "you may X. If you do, Y" |
| 2.29 | `optFilter` refuses what it cannot fully read (fixes a v2.28 bug) |

## The next piece, already cut to fit

**`arsenal-triggers` — 8 cards, one small mechanism.** Everything needed to
start is in `tools/followups.json` under that slug. In short:

- The trainer's end-of-turn arsenal sets cards **face DOWN**. All these arrows
  trigger on **face UP**. They are different events — do not conflate them.
  (An earlier note in this file claimed otherwise; it was wrong.)
- The face-up path is a **hand → arsenal** move and it exists in the pool:
  **3 enablers** (Bull's Eye Bracers, Death Dealer, Call in the Big Guns) feed
  **5 payoffs** (Dry Powder Shot, Swift Shot, Entangling Shot, Ridge Rider Shot,
  Spire Sniping).
- Sizing, verified: `sd.arsenal` holds a card and is written in only **4**
  places, so the card can carry a `_faceUp` flag the way minted cards carry
  `_playTurn`. The mechanism is small; the work is the three enablers.
- **One reading still open**: Call in the Big Guns lacks the "if you have no
  cards in your arsenal" gate the other two have — may it overwrite an occupied
  arsenal, or does it fizzle? Ask before building that one.

## The two rules that caught real bugs this stretch

**1. Never parse ahead of wiring.** `fx.optCost` marks its clauses as read,
which raises a card's tier. Parse a card the trainer does not act on and the
audit starts claiming it works. That is the same over-claim as the `noop` blind
spot in `CLAUDE.md`, and it shipped once (v2.28) before being caught.

**2. Read the whole phrase or refuse.** `optFilter` matched its subject with
loose substring tests and silently dropped a qualifier it could not express:

> Mounting Anger — "banish an attack action card from your hand **with cost less
> than the number of Draconic chain links you control**"

It returned `{type:"attack"}`, dropping the limit — so any attack card became a
legal banish, strictly better than printed. Look-alike cards are the hazard, not
exotic ones: Rising Resentment shares that clause verbatim and differs in its
rider, and in both, "it" is the *banished* card, not the attacker.

## What is left, ranked

1. **`arsenal-triggers`** (8 cards) — see above, ready to build.
2. **`newTurn` + `foeSwing`** — the last 2 of 7 rules functions. Both encode the
   DUMMY specifically, so they migrate together with giving seat 1 a real action
   phase; doing them separately is work you throw away.
3. **Wire `priority.js` for real** — v2.27 put it in shadow and proved the
   mapping. Replace `playRx`'s hand-rolled speed gates and the hand-dim logic
   with `speedAllowed`/`canAct`, then retire `mode`/`bphase`. Mind the clock:
   `priority.js` counts player-turns, the trainer's `turn` counts only your own
   and feeds both the escalation table and the score.
4. **Brothers in Arms** needs somewhere for a buff to an already-declared
   defender to live (`blockH` holds bare uids). Design question is recorded.
5. **Hero abilities** — 13 of 15 heroes, 32 unread clauses. `npm run sweep`.

## Validation loop

```bash
npm test                              # 360 drills — must stay green
npm run audit                         # regenerate AUDIT.md, read the tier diff
node tools/audit.js --write-baseline  # ONLY after reviewing that diff
npm run stack                         # STACK.md + tools/review.html
npm run sweep                         # hero abilities, tokens, ruled-not-built
```

Then **open it and play**. Nearly every bug this project has had was found in
play or by reading, never by a red test. The browser caches `engine/*.js`
aggressively and `location.reload(true)` does not revalidate them — fetch and
re-eval the module if a change seems not to have landed.

## Hard constraints that still apply

- **No build step, ever.** Plain UMD `<script src>`; must run from `file://`.
- **Never invent card effects.** Teach the parser to read the text. If it cannot
  be read honestly, leave the card unclaimed — do not guess.
- `you()`/`opp()` **read**, `youMut()`/`oppMut()` **write**, and rules functions
  use `act()`/`foe()`. Never write a side field as a top-level game key.
- **Bump `DATA_VER`** if anything is added to `NEEDED`.
- Store the rng back after every draw (`n.rng = rng`), or the next draw repeats.
