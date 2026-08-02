# Handoff — Dawnblade, at v2.41

Paste everything below the line into a fresh Claude Code thread in this repo.

---

## THE PLAN, AND WHERE WE ARE IN IT

**Three phases, in this order (user, 2026-08-02):**

```
1. ENGINE  ←  YOU ARE HERE (deliberately regressed to it)
2. MULTIPLAYER
3. CARD RULING TESTING
```

Phase 2 was started and made real progress (v2.41, below). It was stopped
on purpose: **every remaining multiplayer step is blocked on the same
thing, and that thing is the engine.** Rather than keep bolting network
features onto a 2,505-line React component, the call is to rebuild the
core properly and then let multiplayer fall out of it.

That is the right call and this document exists to make it cheap.

---

## READ THIS FIRST — the architecture fork is now MOOT

Earlier in Phase 2 the user was asked to choose between:

| | |
|---|---|
| **A — lockstep** | extract `judge.js`: the rules core as a pure `reduce(state, action)`. What `net.js` was built for. |
| **B — host-authoritative** | host runs `Battle`; guest sends intents and renders snapshots. Much cheaper. |

**They chose B — specifically to avoid the big refactor.** Then they
decided to do the big refactor anyway (this document's Phase 1).

**So do not build B.** Its entire reason for existing was to dodge the
reducer extraction. Once `reduce(state, action)` is pure and drillable,
lockstep is nearly free, it is the documented design in
`ROADMAP-MULTIPLAYER.md`, and Phase C's server becomes a relocation of the
sequencer rather than a client rewrite. `net.js` already takes `reduce` as
a parameter for exactly this.

If the rebuild stalls and multiplayer becomes urgent, B is still there as
a fallback — `net.js`'s `SNAPSHOT` message and the guest's `adopt` are
built and drilled. But it is a fallback now, not the plan.

---

## Where things stand

- `npm test` → **580 drills, all green.** Never leave them red.
- `npm run fairness` → **clean.** Keep it that way.
- Pool: **405 unique cards · 265 full / 108 part / 32 none**.
- Branch `multiplayer-hero-select`, at **v2.41** (`110cdaf`). `main` is at
  v2.38. **The user uploads to GitHub Pages manually** — there is no
  remote, no `gh`, no stored credential. Deploying is not your job.
- A background task may have landed a fix for **`defaultPicks` skipping
  bows** (see "Known bugs" below). Check `git log` before re-fixing it.

### What v2.41 landed (and why it survives the rebuild)

`ROADMAP-OPPONENT.md` Phase 1. **Seat 1 is a real hero build** — real life
total, intellect, equipment and 55-card deck, chosen at the scout panel.
It still takes **no action phase**, so it blocks with printed defence and
nothing more.

The part that matters for the rebuild is not the feature, it is the
**seam**:

```js
built.both[i]   // [seat 0's build, seat 1's build]
bAct(s)         // RULES — the build of whoever is resolving
built.X         // UI ONLY — seat 0, because the UI renders seat 0
```

`built.viseraiPassive` used to mean *the player's* Viserai. That is the
same seat-0-means-the-actor confusion the v2.24 actor/perspective split
fixed for zones, one layer up — and it is exactly the class of bug the
rebuild must not reintroduce. **Both seats are now symmetric in state,
zones, counters and build.** Nothing about seat 0 is privileged any more.

Also: `DUMMY_INT` is gone from `newTurn` (the refill reads `opp(s).int`
and is the **only** refill site), and both seats equip through
`defaultPicks` — the opponent was briefly wearing eight gear pieces, which
is strictly stronger than printed.

---

## PHASE 1 — the engine rebuild

### The honest measurements

| | |
|---|---|
| `Battle` | **2,505 lines** (index.html 1953–4458). `ROADMAP-MULTIPLAYER.md` measured it at 1,567 — **it has grown 60% since**. |
| `setG` closures | **23** |
| `mode`/`bphase` refs | **97** (45 `g.mode`, 23 `s.mode`, 6 `n.mode`, 23 `bphase`) |
| actor seam | **5 of 7** migrated; `newTurn` + `foeSwing` PENDING |

That growth number is the argument for doing this now. Every version
spent adding features to `Battle` makes the extraction more expensive, and
the last three versions all added to it.

### The target

`ROADMAP-MULTIPLAYER.md` fact 3, unchanged and still right:

```js
// from
setG(s => { …fifty lines of zone shuffling… });
// to
dispatch({type:"play", card:uid, from:"hand"});
// where reduce(state, action) -> state is pure, in engine/judge.js, drillable
```

Then: the network ships **actions, not state**; a game is its action log;
a replay is a re-application; and `Battle` shrinks to rendering plus
dispatch.

### The order that keeps the game playable

Each step should leave `npm test` green and the game openable. Do **not**
attempt this as one big-bang rewrite — the repo's whole history says that
is how silent bugs ship here.

1. **Finish the actor seam.** `newTurn` + `foeSwing` are the last 2 of 7,
   and `test/actor.test.js` pins them. They migrate **together** because
   both encode the *dummy* rather than an opponent — the ledger has said
   so since v2.24, and v2.41 removed the last excuse by giving seat 1 a
   real build.
2. **Wire `priority.js` for real.** It has been in shadow since v2.27 and
   `fromTrainer` is proven against live play. The scoped order from the
   previous handoff still holds:
   1. `playRx`'s speed gate — smallest and most wrong; it hand-rolls what
      `speedAllowed(g, seat)` already states, and `speedAllowed` knows the
      window follows the ATTACKER, which the hand-rolled version cannot
      express at all.
   2. the hand-dim / playability logic, same substitution.
   3. **then** retire `mode`/`bphase` as the source of truth.
3. **Extract `judge.js`.** One `setG` closure at a time into a pure
   reducer. 23 of them. `engine/actions.js` is the reference shape — it is
   a real driver of `priority.js` with no cards in it.
4. **Seat 1 takes an action phase** (`ROADMAP-OPPONENT.md` Phase 2). This
   is where the difficulty curve retunes; do it with a play session, not
   with drills.

**Mind the clock throughout.** `priority.js` counts player-turns in `turn`
and rounds in `round`; the trainer's `turn` counts only *your* turns and
feeds **both the escalation table and the score**. Reconciling them is
part of step 4, not a separate job.

### What must survive the rebuild

These are not style preferences — each one cost a real bug:

- **No build step, ever.** Plain UMD `<script src>`; must run from `file://`.
- **Never invent card effects.** Teach the parser to read the text. If it
  cannot be read honestly, leave the card unclaimed.
- `you()`/`opp()` **read**, `youMut()`/`oppMut()` **write**, rules use
  `act()`/`foe()`, and hero builds use `bAct()`. **Never write a side
  field as a top-level game key** — five shipped that way in v2.18.
- **The invariant judge is wired into `setG`.** Whatever replaces `setG`
  must keep that funnel, or the guard rails go dark.
- **Store the rng back** after every draw (`n.rng = rng`), or the next
  draw repeats.
- **`instead` REPLACES**; go again is a **GAIN**, not a refund; an instant
  costs **no** action point.

---

## Known bugs — found in v2.41, not fixed

Both were confirmed **pre-existing**, not introduced by v2.41.

1. **`CHAIN-CLOSED-WITH-LINKS` on the opponent-first opening.** `foeSwing`
   pushes a link onto `n.chain` without setting `chainOpen`, so the
   invariant judge flags every opponent-first game from turn 1.
   **Deliberately not patched:** the correct fix depends on what
   `chainOpen` *means* once the opponent has a real attack chain, and the
   `mode:"block"` flow does not model that at all. It is entangled with
   step 2 above — fix it as part of wiring `priority.js`, not before.
2. **`defaultPicks` skips bows.** It gates 2H selection on
   `twoH.c.power != null`, and **bows print no power** (Azalea's Death
   Dealer is `Ranger Weapon - Bow (2H)`, `power: null`). So Azalea
   defaults to **no weapon and no quiver** — for the player's own loadout
   as well as the opponent's. Harmless while seat 1 never attacks; it
   matters at step 4. *A background task was started on this — check
   `git log` first.*

---

## Validation loop

```bash
npm test                              # 580 drills — must stay green
npm run fairness                      # must stay clean
npm run audit                         # regenerate AUDIT.md, READ the tier diff
node tools/audit.js --write-baseline  # ONLY after reviewing that diff
npm run stack                         # STACK.md + tools/review.html
npm run sweep                         # hero abilities, tokens, ruled-not-built
```

`node` is at `~/node/bin` and is **not on PATH** — `export PATH="$HOME/node/bin:$PATH"`.

A tier drop is **not automatically a regression** — several times it has
been a correction, because the previous number was an over-claim. Read the
diff and repin deliberately.

Then **open it and play**. Nearly every bug this project has had was found
in play or by reading, never by a red test — including the eight-gear bug
in v2.41, which every drill and the fairness sweep passed straight over.
Serve it with `python3 -m http.server 8099` (`.claude/launch.json`), and
**test at phone dimensions (393×852), not a tall desktop window** — two
shipped layout bugs existed only there.

The browser caches `engine/*.js` aggressively and `location.reload(true)`
does not revalidate them; fetch and re-eval the module if a change seems
not to have landed.

---

## The two rules that caught every bug this stretch

**1. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier. Parse a card the trainer does not act on and
the audit starts claiming it works.

**2. READ THE WHOLE PHRASE OR REFUSE.** A loose substring match silently
drops printed restrictions. Look-alike cards are the hazard, not exotic
ones.

And the one this version added:

**3. COVERAGE AND FAIRNESS BOTH MISS "TOO MANY OF A LEGAL THING."** The
eight-gear bug was not a misread card — every card was read correctly.
The *quantity* was illegal. No tool in the repo asks that question; only
opening the game and reading the dealt state did.

---

## Repo map

| file | what |
|---|---|
| `index.html` | the trainer (UI + `Battle`, the reducer-to-be) |
| `engine/*.js` | the pure rules engine — parser, sides, priority, prompts, rng, invariants |
| `engine/wire.js` | the game as one JSON object + the rules fingerprint |
| `engine/net.js` | the session: handshake, sequencing, desync detection, resync |
| `engine/actions.js` | six **blank** actions — the reference reducer, no cards in it |
| `engine/room.js` | the transport: PeerJS, table codes, the only file that knows a network exists |
| `test/*.js` | 580 drills |
| `tools/audit.js` | coverage — how much text is read |
| `tools/fairness.js` | faithfulness — is anything stronger than printed |
| `CLAUDE.md` | conventions, golden rule, known approximations — **read in full first** |
| `ROADMAP-MULTIPLAYER.md` | the road to online play (Phase 2) |
| `ROADMAP-OPPONENT.md` | sunsetting the dummy into a real opponent |
| `CHANGELOG.md` | what each version changed |
| `TORCH.md` | the world, the rules codex, licensing posture |

`tools/review.html` and `tools/sweep.html` are **generated** — regenerate
with `npm run stack --html` / `npm run sweep --html`.

## The job

**Build carefully, one piece at a time, and never claim more than is
true.** The rules engine is strong and the guard rails are real. Phase 1
is a rebuild of how the rules are *held*, not of what they say — the
parser, the drills and the rulings all stay. Both reward reading over
typing.

**Read `CLAUDE.md` first, in full**, then `ROADMAP-MULTIPLAYER.md`.
Several entries exist because breaking the rule already cost a real bug.
