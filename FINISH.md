# FINISH — the blueprint to done

**Rewritten 2026-09-01 at v3.69.** Every number below was **measured this
session**, with the command that produces it, so a future session can
re-derive rather than trust. Where a number is a judgement call it says so.
The previous version of this file was written at v2.83 and refreshed at
v3.16; its numbers had rotted by roughly a third, which is itself the
argument for §4.

Read `CLAUDE.md` first, in full. That file says *how to work and why*, and
almost every line of it exists because breaking the rule cost a real bug.
This file says *what is left, in what order, and what we are choosing not
to do*.

---

## 0. THE FINDING THAT SHOULD REORDER EVERYTHING

Six live defects were found in the last seven releases. **Five of them were
in cards the coverage audit called finished**, and three were sitting at
`tier: full` at the moment they were found:

| card | audit said | what it actually did |
|---|---|---|
| Take Aim | `full` | reload put the card **face up** — a free action point off Azalea's arrows |
| Cloud Cover | `full` | ward did **nothing at the table** |
| Macho Grande | `full` | dominate was enforced by **nothing at the table** |
| Prey Spotters | `full` (pre-v3.59) | an attack reaction offered at **action speed** |
| Stalker's Steps | `full` (pre-v3.59) | granted go again with **no attack to target** |
| Danger Digits | — | dealt 1 damage from nothing, its printed drawback dropped |

Re-derive:

```bash
node -e 'const P=require("./engine/parser"),pool=require("./data/pool.json");
for(const n of ["Take Aim","Cloud Cover","Macho Grande"]){const r=pool.find(x=>x.name===n);
P.fxReset();console.log(n, P.fxParse({name:n+"|x",tx:r.functional_text,tt:r.type_text,
ty:r.types,kw:r.card_keywords,pitch:r.pitch,cost:r.cost,power:r.power,def:r.defense}).tier)}'
```

**`npm run audit` measures whether text was READ. It cannot measure whether
the reading was OBEYED.** `npm run fairness` covers one direction of that
(cards stronger than printed) and is deliberately one-sided.
`tools/failstates.js` grades unread text. **Nothing in this repo drives a
card and checks what happened** — and that is the gap every one of the six
fell through.

That is the single most important sentence in this document, and §3 is the
answer to it.

---

## 1. WHAT "DONE" MEANS — re-cut around the player

The previous definition had five conditions, four of them internal. The risk
that framing carries is real: **you can satisfy all five and still have a
thing nobody enjoys, and you can chase condition 2 forever because it is not
reachable.** So it is re-cut here around what a person sitting with a phone
actually experiences.

| # | done when | measured by | today |
|---|---|---|---|
| **P1** | **the hero you pick plays like the hero** | 0 unread hero-ability clauses | **10 of 15 heroes fail** · 20 clauses |
| **P2** | **a tap does what it says** | every prompt surface exercised on a device | **13 sites, 0 validated** |
| **P3** | **a game you start, ends** | 0 stalls in `npm run play` | **10 of 210** |
| **P4** | **the card does what it prints** | audit `full` **and** a driven scenario asserts the outcome | 358/405 read · **0 driven** |
| **P5** | **the opponent is worth playing** | a play session says the curve is right — *not a drill* | trainer tuned · **table dummy wins 29/45** |
| **E1** | **one engine** | `Battle`'s rules gone | **154 `mode` + 27 `bphase` refs** |
| **E2** | **two humans can finish a game** | lobby ready gate + a networked match, 0 desyncs | gate unbuilt |

P1–P5 are the product. E1–E2 are the engineering that makes P1–P5 keep
working. **If time runs out, P1–P3 shipped is a product; E1–E2 shipped
without them is not.**

---

## 2. WHERE WE ARE — measured at v3.69

```
npm test          1664 drills · 0 fail · 4 skipped (drift, reads the live
                  wire on purpose) · 31 seconds
npm run audit     405 unique pool cards — 358 full / 35 part / 12 none
npm run fairness  clean
npm run sweep     10 heroes with unread ability clauses (20 total)
tools/failstates  0 UNFAIR · 37 WRONG · 34 LOST VALUE · 2 INERT
npm run play      210 games · 0 refusals · 0 invariant violations · 10 stalls
deployed          APP_VER 3.69 on main; all 21 engine/*.js resolve
```

### Per-hero deck coverage

```bash
node -e 'const a=require("./tools/audit.json");const per={};
for(const[k,u]of Object.entries(a.usage))for(const x of u){if(x.hero==="dummy")continue;
(per[x.hero]=per[x.hero]||{full:0,n:0});per[x.hero].n++;
if((a.cards[k]||{}).tier==="full")per[x.hero].full++;}
console.log(Object.entries(per).map(([h,v])=>h+" "+Math.round(100*v.full/v.n)+"%").join("\n"))'
```

| | |
|---|---|
| **bravo** 100% · **iyslander / kayo / blaze** 97% · **viserai** 94% | the deck is not the problem |
| **arakni** 75% · **gravy** 79% · **boltyn** 84% | the long tail |

**The deck coverage is no longer the binding constraint anywhere.** The
worst hero in the pool reads three quarters of its own deck. Compare P1:
**Azalea reads 88% of her deck and 0% of her hero.**

### Hero abilities — the real gap

```bash
npm run sweep    # §1
```

| hero | unread / total | |
|---|---|---|
| **Azalea** | **4 / 4** | her ability does nothing at all |
| **Bravo, Flattering Showman** | **3 / 3** | ditto — and his deck is 100% |
| **Arakni, Web of Deceit** | **2 / 2** | ditto |
| **Boltyn** | **2 / 2** | ditto |
| **Enigma** | **2 / 2** | ditto |
| Fai | 2 / 3 | |
| Lyath Goldmane | 2 / 4 | |
| Briar · Gravy Bones · Iyslander | 1 each | |

**Five heroes of fifteen have a hero ability that is entirely inert.** In a
game where the hero *is* the deck's thesis, that is the most player-visible
defect in the project, and it is currently ranked below card coverage.

### Self-play health

210 games, 0 refusals, 0 invariant violations, **10 stalls**. The stalls
concentrate:

| hero | appears in |
|---|---|
| iyslander | 7 stalls |
| blaze | 5 |
| enigma | 4 |
| azalea | 3 |

**Do not read the win table as balance.** `sparring.act` reads no card text
by contract, so every deck is played on printed numbers alone; the field
comes out flat (43–50%) because the *policy* is flat, not because the decks
are. Seat is not the cause either — first player wins 51%, and 80 of 99
mirror pairings were won by the same hero from both seats. **`npm run play`
is a correctness instrument. It cannot measure balance and should never be
cited as if it could.**

---

## 3. THE MISSING INSTRUMENT — and it is the highest-value thing to build

Every static tool here answers a question about *text*. The six defects in
§0 were all about *behaviour*. The gap has a shape:

```
npm run audit       was the clause read?          text
npm run fairness    is it stronger than printed?  text, one direction
failstates.js       is it unread and dangerous?   text
npm run play        does the machine stay legal?  behaviour, no card text
                                                  ↑ by contract
─────────────────────────────────────────────────────────────────
MISSING             does this card DO what it     behaviour, card text
                    prints, in a real game?
```

**`npm run scenes` — a scripted scenario suite.** Per hero, a handful of
hand-authored scripts that set up a board, play the hero's actual mechanic,
and assert on the outcome — hands, life, zones, counters, action points.
Not on the feed (v2.45).

It is not a new engine: it is `test/helpers/judged.js` plus a fixture
format, and several drills in `test/` are already scenario-shaped
(`kayo.test.js`, `dorinthea.test.js`, `judge.test.js`'s two-precon game).
What is missing is that they are per-*mechanic* rather than per-*hero*, so
no one can answer "does Azalea work" without reading code.

**Every one of the six would have been caught by one:**

| defect | the scene that catches it |
|---|---|
| reload face-up | play Take Aim, reload Swift Shot, assert `ap` unchanged |
| ward inert at table | swing 5 into a ward 3 at the table, assert `hp` |
| dominate unenforced | declare two blockers against Macho Grande, assert refused |
| reaction at action speed | activate Prey Spotters in the action phase, assert refused |
| Danger Digits | activate it, assert the dagger is destroyed |

Build it **before** the next card. It is the control that makes every later
card cheap to trust.

---

## 4. THE CONTROLS — cheap, permanent, and they retire whole risk classes

These are the insurance policy. Each is small, each stops a category of loss
rather than an instance of it, and none of them is card work.

### C1 · CI on push — *nothing but a human runs the tests today*

```bash
ls .github/workflows   # → does not exist
```

The project has **zero dependencies** and `npm test` takes 31 seconds. A
twenty-line workflow removes, permanently, the risk that a session ships
without running the suite. **This is the cheapest risk reduction available
and it has never been done.**

### C2 · Deploy verification — *every "shipped" claim this session has an asterisk*

The sandbox's egress policy denies `github.io`, so the live URL cannot be
fetched from a session. The half that can be checked (every script tag
resolves in the pushed commit, `.nojekyll` present) is checked, and the
difference is reported honestly — but **nobody has confirmed the deployed
page serves 200s in weeks.** The same CI job can `curl` the live URL and the
21 script paths after a push. Zero cost, and it closes the gap between
"pushed" and "live".

### C3 · The one-board ledger — *the most productive bug class in the project*

Five of the last seven releases fixed a rule that existed on one board.
It has a measurable shape:

```bash
# which shared effects.js bodies does exactly one board call?
node tools/oneboard.js     # to be written; prototype in this session's notes
```

Measured today: **8 of 36 shared bodies are called by exactly one board, and
every one has a documented reason** (`resolveStack` is the trainer's path;
`allyDeath` needs ally targeting the trainer deliberately lacks; the rest
are reached through a shared caller). That is what a good guard looks like —
quiet on a correct codebase, loud on a new one.

Make it a ledger like `wire.test.js`'s `HEADLESS` list: a body appearing on
it is a **deliberate edit**. Write the scanner to know all three call forms
(`_EFX.x(`, `DawnEffects.x(`, and the bare bridged name) — aimed at one
form it reports nothing and passes by finding nothing, which is the trap
`CLAUDE.md` names three times.

### C4 · The doc-claim sweep — *29 standing claims that something is unbuilt*

```bash
grep -ciE '(is (deliberately )?(not|un)(built|wired|modelled|read)|no such|nothing (reads|calls|consumes)|has no (route|caller|reader)|not modelled|still (refuses|unbuilt)|cannot yet)' CLAUDE.md
# → 29
```

v3.69 proved one of these stale: `reload` was fully built and
`tools/ledger.js` still called it `pending`, so `failstates.js` was scoring
a gap that had been closed for versions. v3.53 found two more. **A doc claim
is a test with no assertion**, and there are 29 of them.

Not all are automatable, but the keyword ledger is: assert every
`status: "pending"` keyword really has no reader, and every `"live"` one
does. That is a drill, and it is small.

### C5 · `npm run doctor` — *stop this file from rotting*

The previous FINISH.md had numbers a third wrong. One script that re-derives
every number in §2 and diffs it against what this file claims. Run it at the
top of a session; a mismatch is a doc bug, not a code bug, and it takes a
minute to fix instead of a session to discover.

---

## 5. THE SEQUENCE — ordered by risk-adjusted value

Not by what is easy to measure, and not by what is nearly done.

| # | phase | why here | size |
|---|---|---|---|
| ~~**1**~~ | ~~**C1 + C2 + C4**~~ **DONE at v3.70** — CI on push, live-deploy verification, the ledger drill. The drill found two stale records on its first run (`charge`, `surge`) | ~~½ session~~ |
| ~~**2**~~ | ~~**`npm run scenes`**~~ **DONE at v3.70** — 21 scenes across 6 heroes. All eight defects reintroduced and caught; building it found a ninth (`selfDiscard` credited no discard event) | ~~1 session~~ |
| **3** | **P1 — hero abilities** · 20 clauses, 10 heroes, **Azalea and Bravo first** | the most player-visible gap in the project. Bravo's deck is already 100%; his hero is 0%. The method is proven (Kayo, v2.55–v2.63): read the hero ability *before* the cards | 3–4 sessions |
| **4** | **P2 — the phone pass** | 13 prompt surfaces, none validated. **Needs a device and therefore needs scheduling** — it cannot be done from a session and has been carried ~25 versions | 1 session, yours |
| **5** | **P3 — the 10 stalls** | a player can hit this. Concentrated in iyslander/blaze/enigma — low-aggression decks the policy cannot pilot. Fix is likely in `sparring.act`, not the engine | 1 session |
| **6** | **C3 — the one-board ledger** | after §3, because scenes are the better detector; this is the cheap standing guard behind them | ½ session |
| **7** | **P4 — the long tail**, minus §6's retained list | ~30 cards once the ruling-blocked ones are subtracted. Each is now genuinely one reader | ongoing |
| **8** | **E1 — retire `Battle`** · 154 `mode` refs | the multiplier, and it must sequence **with** P5: retiring `Battle` retires the *tuned* `[3,4,5]` dummy, and the table's untuned dummy wins 29 of 45 | 2 sessions |
| **9** | **P5 — tuning** · **E2 — the lobby gate** | last. Tuning is a play session, not a drill. E2 has an external dependency (two devices, a relay) | yours |

**Phases 1–2 are three-quarters of a session and change the odds of every
phase after them.** That is the whole argument for putting tooling ahead of
cards when the tooling is this cheap.

---

## 6. RETAINED RISK — what we are choosing not to do

Stating these is what stops them counting against done and makes the finish
line stop receding.

| accepted | why |
|---|---|
| **hidden information** | both peers hold full state including the opponent's hand. `ROADMAP-MULTIPLAYER.md`'s deliberate Phase B position — a peer that cannot see the state cannot run the reducer. Fixing it needs an authoritative server, which is a different product. **Never present the current layer as cheat-resistant.** |
| **405/405 `full` is not the target** | some cards are blocked on a **ruling**, not on code: `overpower` and `piercing` are unreviewed in `tools/ledger.js` and need CR wording; Ice Eternal is the pool's only X-cost card; `fusion` is 7 cards behind one unbuilt cost mechanic. Counting them makes the target unreachable. **Subtract them, name them, and P4 becomes finite.** |
| **`npm run play` cannot measure balance** | by contract — the policy reads no card text. Treat it as a correctness instrument only |
| **CR 4.1.8a trigger ordering** | simultaneous triggers are not ordered by the first-turn-player. No pool card makes it observable |
| **the layer step (CR 7.1.2)** | an attack goes straight onto the chain. The reaction window that follows is equivalent for every card in this pool |
| **the trainer's attack-target choice** | measured dead code (v3.46): the dummy is 12 vanilla attacks with no allies, so there is never a target to choose |

---

## 7. THE ONE-PAGE VERSION

> **The engine is in good shape and the product is not finished.** 358 of
> 405 cards read, 1664 drills green, zero unfair cards, zero invariant
> violations in 210 games.
>
> **What is missing is not more parser.** Five heroes have an ability that
> does nothing. Thirteen tap-surfaces have never been touched on a phone.
> Ten games in two hundred never end. And the tools all said `full` while
> six live defects sat in front of them.
>
> **Build the behavioural instrument, then the heroes, then get it on a
> phone.** Everything else is either cheap insurance or an honest deferral.
