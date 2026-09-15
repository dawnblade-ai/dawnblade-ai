# Dawnblade AI — Architecture

Dawnblade AI is a fan-made, non-commercial training tool for the Flesh and Blood
Silver Age (SAGE) format: single player versus a training dummy, or two players
at a table over a room code. It is in no way affiliated with Legend Story
Studios. Flesh and Blood™ and set names are trademarks of Legend Story
Studios®. All card names, card text, characters, and artwork are © Legend Story
Studios.

> **THIS FILE IS A MAP, NOT A SPEC.** It describes what is here; it asserts
> nothing. **A doc claim is a test with no assertion** (`CLAUDE.md`, v3.41), and
> this file proved it — every engineering section below was rewritten at v4.54
> because the previous text described a prototype whose modules no longer exist
> and still read as the design (see "The prototype this file used to
> describe"). So every count here carries the command that reproduces it.
> **Re-derive before trusting.**
>
> Last measured against the source at **v4.54, 2026-09-15**.
> `CLAUDE.md` is the working manual and the accurate one; this is orientation.

## How we use FaB materials (the Talishar logic)

Talishar holds no special license. It operates as an unaffiliated fan project
under LSS's published Terms of Use for game and studio assets: it credits every
card image "© Legend Story Studios," displays a clear non-affiliation
disclaimer, is free to play, and sells nothing bearing LSS assets. Dawnblade AI
follows the same posture. Concretely: the disclaimer above appears in the app
and every repo README; card images, if displayed, are credited to LSS and never
baked into merchandise or paid features; the project stays free. The rules
engine itself is the safest layer of all, because game mechanics are not
copyrightable — the code here is entirely original and implements procedures,
not card text. (Orientation, not legal advice.)

**The engine implements procedures; the cards are read, never written.** No card
effect is hardcoded anywhere in this repository. Card text streams at runtime
from the public community dataset and is interpreted by a parser, so what ships
is a reader — not a transcription of anyone's rules text. That is the golden
rule in `CLAUDE.md`, and it is also why the legal posture above is comfortable:
the only card text in the repo is fetched data, pinned for the offline test
suite and never authored.

## What we take from Talishar's workflow

Talishar is split into a backend that owns all game logic and a thin frontend
that renders state. Card data lives apart from the engine, and each card is
wired to engine behaviour rather than containing logic itself. We keep the
split; we do not keep their two entry points.

The equivalent contract here is **one pure reducer**:

```js
judge.reduce(state, action, seat) -> { state, error }
```

`engine/judge.js` owns the CR turn structure and is a pure function of state and
a serializable action, which is what lets the same engine back a React UI, a
replay, a self-play harness and a networked peer without modification. There is
no `getView` — a client reads the state object directly and `engine/wire.js`
serializes it — and there is no `processInput`. Both names survive in this
repository in exactly two dead files:

```sh
grep -rl 'getView\|processInput' --include='*.js' --include='*.html' .
```

Where we diverge from Talishar deliberately: **cards are not wired to behaviour
by an association table.** `engine/parser.js` reads the printed text at runtime
(`classifyClause` for one sentence, `fxParse` for a whole card) and emits ops
that `engine/effects.js` resolves. Implementing a card therefore means teaching
the reader a printed *shape*, never adding a row for a card name. When a card
does something new, the fix is always a parser rule.

## The one hard constraint

**No build step. Ever.** No bundler, no ES modules on the page, no framework
CLI, no `package.json` build script. `index.html` plus plain UMD scripts in
`engine/`, loaded with ordinary `<script src>` tags; React and Babel come from a
CDN. GitHub Pages serves the repository root as-is and the whole thing runs from
`file://`.

```sh
git clone git@github.com:dawnblade-ai/dawnblade-ai.git
cd dawnblade-ai && open index.html      # that is the whole setup
```

`npm` is used only to run the test suite and the offline tools (`node --test`,
zero dependencies). `test/sync.test.js` enforces the constraint: every engine
module is loaded in the right order, the bridge lifts every export the page
calls bare, and no engine export may be re-declared inside `index.html`.

## Engine layout

**22 modules; 21 are loaded by the page and one is deliberately headless.**
Re-derive both halves:

```sh
ls engine/*.js | wc -l
grep -o '<script src="engine/[a-z]*\.js"' index.html | sed 's/.*src="//;s/"//' | sort -u
```

`test/wire.test.js` holds the ledger — a module is either loaded or declared
`HEADLESS`, so crossing that line is one deliberate edit.

**The rules**

| module | what |
|---|---|
| `judge.js` | the CR turn structure as `reduce(state, action, seat)`. Phases, steps, the combat chain, costs, legality |
| `effects.js` | **the one copy of the card semantics.** `runOps`, `execute`, `linkPumps`, `linkPayload`, the end phase. Phase-free on purpose, so both boards call it |
| `parser.js` | the reading eye. `classifyClause`, `fxParse`, every printed-shape reader and keyword predicate |
| `priority.js` | who may act, right now. CR-grounded and counter-intuitive where the CR is |
| `types.js` | what a card *is*, off its structured type array — where it may be played from, in which window, where it goes afterwards |
| `build.js` | how a seat becomes a hero: the deal, the equipment slot rules, the three powCard builders |
| `sides.js` | the shape a second human can occupy — the per-side field ledger |
| `prompts.js` | the choice machinery. Eight spec-driven variants; runs no effects and touches no resources |
| `game.js` | pure state helpers: deck parsing, equipment wear, gear slotting, ally life |
| `cards.js` | deck entry → database record, and which printing a card wears |
| `invariants.js` | the guard rails. A judge that audits the **state**, not the cards |

**The seats and the session**

| module | what |
|---|---|
| `sparring.js` | a seat as a policy: `act(game, seat) -> action`. Reads **no** card text — it proposes and `judge.legal` disposes |
| `local.js` | a session with no network: the merged engine, played alone |
| `lobby.js` | the pre-game negotiation — hero, throw, sideboard. Write-once, so it needs no sequencer |
| `rps.js` | the pregame throw |
| `rng.js` | a seeded, pure, serializable random source. One seed per match |

**The wire**

| module | what |
|---|---|
| `wire.js` | the game as one JSON object, and the fingerprint that proves two phones agree |
| `net.js` | the session: handshake, sequencing, desync detection, resync, reconnect. Names no transport |
| `room.js` | the only file that knows a network exists. PeerJS over WebRTC, loaded lazily |
| `report.js` | **JUDGE!!** — the whole board written down, from either board |

**Not rules**

| module | what |
|---|---|
| `advisor.js` | "Claude's call" — pure move evaluation. State in, coaching out |
| `actions.js` | **headless.** A blank reference reducer — six actions over cards with no rules text, kept as proof that `priority.js` can drive a whole game with no card semantics in it |

## The two boards

There are two turn structures and **one copy of the card semantics**. This is
the single most important thing to know before changing a rule.

```
SOLO  →  index.html's `Battle`   speaks mode / bphase   the tuned [3,4,5] dummy
TABLE →  engine/judge.js         speaks phase / step / priority
              ↓                        ↓
              └──────  engine/effects.js  ──────┘
```

Both resolve real card text through the same module. What differs is the
machine the cards run inside, and the recurring defect in this project is
**a rule that exists on one board only** — `CLAUDE.md` names it v3.01's shape
and it has cost well over a dozen bugs. When you add a schedule, a route, a
legality or a feed line, ask which board runs it.

`Battle` is still the regression harness: it plays every card effect and the
drills that prove the semantics are right were written against it. It also owns
the *tuned* difficulty curve, which is why retiring it is sequenced with tuning
rather than before it (`FINISH.md`).

## Card data pipeline

Card stats are never typed from memory, and there are two consumers with two
different needs.

**The game streams the live database** — the-fab-cube's
`flesh-and-blood-cards`, `develop` branch:

```sh
grep -o 'window.DBSRC = "[^"]*"' index.html
```

`index.html` fetches it, keeps the records the pool can reach (every deck entry,
plus tokens and Demi-Heroes by *type*, plus a small `NEEDED` set for cards an
effect can mint), maps them into the engine's shape and caches the result in
`localStorage` under `window.DATA_VER`. **Streaming is deliberate: it is what
lets errata reach a player.** Bump `DATA_VER` whenever the loader's schema or
field handling changes, or a warm cache will serve the old shape — the
`DATA_VER` comment in `index.html` is a running list of exactly what each bump
was for.

Two field maps have to agree — `engine/cards.js`'s `mapDbCard` and the mirror
inside `index.html`'s loader hook, which cannot be shared because it lives
inside a React hook. `test/loader.test.js` guards the pair as a field map and
pins the field list, so adding one is a deliberate edit. **That is where the
reminder to bump `DATA_VER` lives.**

**The tools and the drills read a pinned copy.**

`tools/pin-pool.js` writes `data/pool.json` — **797 raw upstream records**,
fetched data in the database's own schema, never authored:

```sh
node -e 'console.log(require("./data/pool.json").length)'     # 797
```

That file is why `npm test` needs no network and skips nothing. Before it
existed a fresh clone ran 749 passes and **304 silent skips**, which hid 22 pool
cards that had stopped resolving. `test/loader.test.js` pins the count *and* the
claim it stands for: every card a match can deal resolves out of the pinned file
with no live database in the process.

**Upstream moves under you.** The dataset is the-fab-cube's `develop` branch and
it is edited — one editorial pass reworded **138 of this pool's 405 cards**
(measured at v3.00; 22 of them stopped resolving, in production, while every
tool here reported success).
`test/drift.test.js` is the one drill allowed to read the live wire; it compares
what the *parser* makes of each database rather than the text, so a rewording
read identically is not an event. Refresh with `node tools/audit.js --refresh`
at the start of a release cycle.

## How much of the pool is actually read

Coverage is not faithfulness, so there are several instruments and each asks a
different question. None of them is the others' substitute.

```sh
npm test          # 2856 drills, no network. `# fail 0`, `# skipped 5`
npm run audit     # how much of each card's printed text the parser READS
npm run fairness  # is any card STRONGER than printed? (one-sided, on purpose)
npm run sweep     # hero abilities, tokens, rulings understood but not built
npm run scenes    # does the card DO what it prints? (drives it, reads no text)
npm run anchors   # which parser READERS has the pool never reached?
npm run play      # 210 self-play games, with the invariant judge on every state
npm run cup       # the same instrument as a bracket; `npm run eight` to READ one
node tools/approx.js   # the approximation ledger — every stated deviation
```

**The approximation ledger is where "what this does not model" lives**, and it
is data with a drill behind it rather than prose: every record carries a status,
a CR rule, the board it lives on and a probe that *drives the engine*. A
`stated`/`open` record's probe asserts the deviation, so it goes red the day
somebody closes the gap — which forces the record to be updated rather than
leaving a stale sentence behind. That mechanism exists because prose does not
do it: this file's own "Current simplifications" section made four claims and
every one of them had stopped being true.

## The prototype this file used to describe

Everything above was rewritten at v4.54. The previous text described an
`engine/engine.js` state machine with `getView(state)` / `processInput(state,
input)`, an `engine/state.js`, an `effects.js` that was an *"association layer"*
where *"cards never contain code"* and abilities were `{trigger, effect, params}`
tuples, a `data/ingest-fab-cube.js` pipeline emitting `data/sage-pool.json`, and
a dummy that *"never attacks, defends, or holds cards, so there is no defense
step, no defense reactions, no attack reactions, and no opposing turn."*

**None of that is true, and most of it has not been true since v2.0.** The dummy
has held a real hand since v2.05 and seat 1 has had a real action phase since
v2.71. Measured:

```sh
ls engine/engine.js engine/state.js        # No such file or directory
node demo.js                               # ERR_MODULE_NOT_FOUND
```

Four files from that prototype are still in the tree and **none of them is
reachable**: nothing in `index.html`, `engine/`, `test/` or `tools/` references
any of them, and the two entry points throw on import because the modules they
need were deleted.

| file | state |
|---|---|
| `demo.js` · `sim/demo.js` | byte-identical duplicates (`md5 aeb68bb7…`); import `engine/state.js` and `engine/engine.js`, which do not exist |
| `data/demo-cards.js` | **invented placeholder cards** — hand-typed stats and abilities. Imported only by the two dead demos |
| `data/ingest-fab-cube.js` | emits `data/sage-pool.json`, which does not exist. The real pipeline is `tools/pin-pool.js` → `data/pool.json` |

They are recorded here rather than quietly deleted, because that is a call for
the repo's owner to make — but the debt is real and it is the reason this file
rotted. `data/demo-cards.js` in particular is the one file in the repository
with hand-typed Flesh and Blood card data, which is the exact shape the golden
rule forbids; it is labelled a placeholder and it still reads like permission.
Removing the lot is one command:

```sh
git rm demo.js sim/demo.js data/demo-cards.js data/ingest-fab-cube.js
```

No drill pins them, deliberately: **a guard that pins an anomaly legitimises
it** (`CLAUDE.md`, v3.13).

## Where the real documentation is

| file | what |
|---|---|
| `CLAUDE.md` | **the working manual.** Conventions, traps, and every rule that cost a real bug. The accurate one |
| `CHANGELOG.md` | per-version history, newest first |
| `HANDOFF.md` | current state and what to pick up next |
| `FINISH.md` | what "finished" means, as five measurable conditions, and the order |
| `UI-GUIDE.md` | the UI surface: components, screens, the design system, the interaction contract |
| `ROADMAP-MULTIPLAYER.md` | the road to online play, and why in this order |
| `CR-INDEX.md` | every CR rule this project cites, and whether a drill guards it |
