# The road to online multiplayer

Written 2026-07-26 at v2.20. This is the plan for turning a solo trainer into
two humans playing real Flesh and Blood at each other over a network, and
eventually a ranked ladder. It supersedes roadmap items 1–3 in `CLAUDE.md`,
which it expands rather than contradicts.

**Two decisions are already made** (user, 2026-07-26):

1. **Multiplayer is phased** — serverless friend-vs-friend first, a hosted
   backend for the ELO ladder second.
2. **The single-file rule is relaxed** to `index.html` + `engine/*.js`, done in
   v2.20. **There is still no build step, ever.** Plain UMD `<script src>` tags.

---

## Where we actually are

The rules engine is strong: 220 drills, a parser that reads real card text,
119 rulings, and a `sides[]` state shape where both seats already carry all 41
fields. What exists is a **solo trainer**, and three things stand between it
and online play:

| blocker | status |
|---|---|
| **There is no second player** | `engine/priority.js` is written and drilled but not wired in; the dummy has no action phase |
| **There is no network** | zero transport; GitHub Pages is static hosting |
| **There is no persistence** | the ladder needs trusted stored state a static page cannot hold |

Only the first is hard, and it is hard for a reason worth stating precisely.

---

## The four facts that shape everything

### 1. `you()` means "side 0", not "the player acting"

This is **the** architectural blocker, and it is invisible because today the two
readings coincide.

```js
const you = s => s.sides[0];   // 380 call sites
const opp = s => s.sides[1];   //  78 call sites
```

Every rule in `runOps`, `execute`, `resolveStack` and `newTurn` is written as
"the player draws / pitches / takes damage", and *player* is hardcoded to slot 0.
The moment a second human occupies slot 1, `runOps` drawing cards for "you"
draws from the wrong deck.

Two distinct concepts are conflated in one helper:

- **perspective** — whose board do I *render*? (this client's seat)
- **actor** — whose effect is *resolving*? (a rules question)

They must come apart. The target shape:

```js
act(s)      // s.sides[s.actor]   — the side whose effect is resolving
foe(s)      // s.sides[1-s.actor] — its opponent
seat(s)     // s.sides[s.seat]    — what THIS CLIENT renders (UI only)
```

`you()`/`opp()` keep working as UI-perspective helpers; the **rules** functions
stop calling them. This is a mechanical but large change (458 call sites), and
it is safest done *before* the dummy can act, not after — every per-side feature
added first doubles the work.

**Do this first. It is the whole ballgame.**

### 2. Nothing is deterministic yet

Four game-affecting calls to `Math.random()`:

| site | what |
|---|---|
| `engine/game.js` `shuffle` | opening decks |
| `engine/rps.js` `rpsThrow` | the pregame throw |
| `index.html:2060` | Knucklehead's d6 |
| `index.html:2255` | intimidate's random pick from the opponent's hand |

(Three more are cosmetic — taunts, trophy text, the random-hero button — and can
stay as they are.)

For networked play both clients must derive the *same* shuffle from the *same*
seed, or the two boards diverge on turn one. Replace these with a seeded PRNG
carried in game state (`s.rng`), advanced explicitly.

The payoff is much bigger than netcode: **a seeded game is a replayable game**,
and a replayable game makes `Battle` testable for the first time. Which is
fact 3.

### 3. `Battle` is 1567 lines of untested reducer

`Battle` (`index.html:1675–3242`) holds `runOps`, `execute`, `resolveStack`,
`newTurn`, `takeIt`, `tryPlay`, `foeSwing` — the entire rules core — as closures
inside a React component, mutating through 22 `setG(s => …)` calls.

**The drills do not cover any of it.** Every bug found this cycle — crumbling
auras, stale defenders, the pitch selection carrying over, the five side-fields
written as game keys — was found by eye or in play, never by a red test. That is
not an accident; it is the shape of the code.

The fix is the same move that enables netcode: make each `setG` body a **named,
serializable action** applied by a pure reducer that lives in `engine/judge.js`.

```js
// from
setG(s => { …fifty lines of zone shuffling… });
// to
dispatch({type:"play", card:uid, from:"hand"});
// where reduce(state, action) -> state is pure, in engine/, and drillable
```

Then: the network ships **actions, not state**; a game is its action log; a
replay is a re-application; and `Battle` shrinks to rendering plus dispatch.

### 4. Hidden information decides how much server you need

Right now the client holds everything, including the dummy's hand. Between two
humans that is a cheat vector: anyone can read the opponent's hand from the
console.

- **Friend play (Phase B):** accept it. Both clients hold full state, and the
  social contract does the rest. This is how most casual webcam-adjacent play
  works and it is not worth engineering around.
- **Ranked play (Phase C):** not acceptable. The server must hold authoritative
  state and send each client only its own view.

Designing the action log now (fact 3) is what makes the Phase C upgrade a
*relocation of the reducer*, not a rewrite.

---

## Phase A — two humans, one device

**No network at all.** Everything here is rules work, and it is the majority of
the remaining effort.

1. **Split actor from perspective.** Introduce `act()`/`foe()`, migrate the
   rules functions off `you()`/`opp()`, leave the UI on perspective helpers.
   Guard it: a drill that fails if a rules function references `you(`.
2. **Seed the RNG.** `s.rng` + a small xorshift in `engine/rng.js`; thread it
   through `shuffle`, the d6 and intimidate. Pin a known seed in the drills.
3. **Wire `engine/priority.js` into `Battle`.** Replace the `mode`/`bphase`
   gates with the phase/step machine and real priority passing. **Rename the
   three pinned collisions** (`endTurn`, `other`, `you`) as you go — see
   `test/sync.test.js`. Mind the clock: `priority.js` counts player-turns in
   `turn` and rounds in `round`, while the trainer's `turn` counts only your own
   turns, and **both the escalation table and the score read it**.
4. **Give seat 1 a real action phase.** The dummy's scripted
   `[3,4,5][(turn-1)%3]` escalation in `foeSwing` is the seam; a human in seat 1
   replaces it. Keep the dummy as a selectable solo opponent — it is the
   regression harness for everything above.
5. **Hotseat UI.** Pass-and-play on one device, with a between-turns shield so
   hands stay secret. This is the first build where the whole two-player rules
   engine is exercised by real play.

**Ship Phase A on its own.** Hotseat FaB on a phone is a genuinely useful thing
and it validates the entire rules core before any networking risk is added.

## Phase B — two humans, two devices

6. **Extract the reducer** into `engine/judge.js` as `reduce(state, action)`,
   pure and drillable. Actions become serializable.
7. **Transport.** WebRTC over a CDN-loaded P2P lib (Trystero or PeerJS) — room
   codes, no backend, no accounts, no build step. Both peers run the same
   reducer over the same ordered action log from the same seed.
8. **Reconnect + desync detection.** Hash the state after each action and
   compare; on mismatch, resync from the log. Do not skip this — silent desync
   is the characteristic failure of lockstep netcode and it is miserable to
   debug after the fact.

## Phase C — the ladder

9. **Backend** (Firebase or Supabase; both are CDN-loadable, free-tier, and need
   no build step): accounts, matchmaking, persisted results.
10. **Authoritative state.** Move `reduce` server-side; clients send intents and
    receive their own view. This is where hidden information becomes real.
11. **ELO** over the 15 Silver Age decks, plus the deck-legality checks the
    trainer already has the data for.

---

## Phase D — the broadcast view (recorded 2026-08-23, not scheduled)

From a Calling Hamburg stream the user was watching: two hero panels with
records and flags, a top-down table with both boards laid out, a life
counter between them, the card currently being resolved shown large at the
side, a turn/round/clock strip — and a chat rail beside it.

**Why it is worth writing down rather than doing.** Almost every piece of
data on that screen already exists in this engine: `report.js` names every
zone for both seats, `priority.js` owns turn/phase/step, `pend` holds the
card being resolved, and the table already renders both boards. What is
missing is a **spectator seat** — a third connection that receives state
and sends nothing — and that is a Phase C question, not a rendering one:
today both peers hold full state including the opponent's hand, so a
spectator view built now would be a cheat panel wearing a broadcast coat.

So the honest order is:

1. **Phase C's authoritative state first.** A spectator gets a redacted
   view or it gets nothing. Same rule that gates hidden information.
2. **Then the layout**, which is mostly a third arrangement of components
   the table already has (`ArmorGrid`, `InPlayRow`, `GravePane`,
   `CardFrame`) rather than new drawing code.
3. **Then chat**, which is one more `{ch:"chat"}` on the existing demuxed
   channel — the lobby/net split already proved that seam.
4. **Then, maybe, 3D.** Animated cards, hands, webcams or avatars. This is
   the only item that is genuinely new engineering, and it is the only one
   that risks the no-build-step rule — a WebGL library that ships UMD and
   loads from a CDN keeps it (the PeerJS-over-Trystero precedent); an
   ESM-only one does not. **Pick on that basis, not on features.**

**None of this is a card.** It does not compete with Phase C's heroes for
a session; it competes with the ladder.

---

## What not to do

- **Do not build a deck-piloting AI.** Decided 2026-07-25 and still right. The
  dummy is a training partner and a test fixture, not an opponent to grow.
- **Do not add per-side features before step 1.** Every one doubles the actor
  migration.
- **Do not introduce a build step** to get modules. The bridge works, ships, and
  runs from `file://`.
- **Do not network before Phase A is played on a real phone.** Netcode over an
  unvalidated rules engine debugs two problems at once.
- **Do not skip the seed.** It is thirty lines and it unlocks replay, drills for
  `Battle`, and lockstep all at once.

---

## The honest ordering

Everything in Phase A is rules work that must happen for a two-player game to
exist at all — it is the same work whether the second player is across the table
or across the internet. Phase B is then a transport detail rather than an
architecture. That is the whole reason to do it in this order.

The other open content gaps — 32 unread hero-ability clauses, five unhandled
tokens, 147 ruled-but-not-built cards (`npm run sweep`) — are **parallel work**.
They do not block multiplayer and multiplayer does not block them. They are the
natural thing to feed from `tools/sweep.html`.
