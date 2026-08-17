# FINISH — the blueprint to done

**Written 2026-08-16 at v2.83; refreshed at v3.00.** Every number here was
**measured**, not estimated; the commands that produce each one are given so a
future session can re-derive rather than trust. Where a number is a judgement
call it says so.

> **v3.00 CHANGED THREE OF THESE NUMBERS AND THE REASON MATTERS MORE THAN THE
> NUMBERS.** A fresh clone of this repo ran `npm test` as **749 passes and 304
> SILENT SKIPS** — every drill that needs a card gated on a 22MB gitignored
> download — so "1053 green" meant "green on the machine that had happened to
> fetch". The pool is pinned in `data/pool.json` now, and the only drills that
> still skip are the 4 in `test/drift.test.js`, which read the live database
> on purpose. **Re-derive before trusting any table below**; the commands are
> given, and on a fresh clone they now work offline.

Read `CLAUDE.md` first, in full. This file says *what is left and in what
order*; that one says *how to work and why*, and almost every line of it
exists because breaking the rule cost a real bug.

---

## 0. WHAT "DONE" MEANS

Dawnblade is a **rules-accurate Flesh and Blood training sim, judged to
pro-tour standards, that runs from a `file://` URL on a phone with no build
step**. Finished means all five of these are true at once:

| # | done when | measurable as |
|---|---|---|
| 1 | **one engine** — a card is wired in exactly one place | `Battle`'s rules are gone; the CR 4.4.3 end phase exists once |
| 2 | **the pool resolves faithfully** | `npm run audit` → 405/405 full · `npm run fairness` clean · `tools/failstates.js` reports 0 UNFAIR |
| 3 | **every hero is playable as printed** | 0 unread hero-ability clauses in `npm run sweep` §1 |
| 4 | **two humans can finish a game** | the lobby ready gate exists; a networked match plays start to finish with 0 desyncs |
| 5 | **it is tuned** | a play session says the difficulty curve is right — *not a drill* |

**Explicitly OUT of scope, and stated rather than implied:** hidden
information. Both peers hold full state including the opponent's hand. That
is `ROADMAP-MULTIPLAYER.md`'s deliberate Phase B position — a peer that
cannot see the state cannot run the reducer — and fixing it needs an
authoritative server, which is a different product. **Never present the
current layer as cheat-resistant.**

---

## 1. WHERE WE ARE — measured at v2.83, refreshed at v3.00

```
npm test          1060 green — 0 skipped with a live DB cached, and
                  only the 4 drift drills skip without one
npm run fairness  clean
npm run audit     405 unique pool cards — 305 full / 78 part / 22 none
npm run sweep     11 heroes with unread ability clauses (26 total)
tools/failstates  11 UNFAIR — 6 watery grave, 5 suspense
deployed          APP_VER 3.00, all 22 engine/*.js serving 200
```

**Three of those moved at v3.00 and none of them by drifting:**

* **1053 → 1060 drills and 304 → 0 skips.** `data/pool.json` pins every
  record the pool can reach, so the suite measures the same engine on every
  machine. `test/drift.test.js` is the one drill allowed to read the live
  database, and it compares what the PARSER makes of each rather than the
  text — upstream's wording is upstream's business.
* **306 → 305 full**, and the pool went to 286 in between. Upstream reworded
  **138 of the 405 cards**; the parser survived 116 and 22 stopped resolving,
  silently, in production. All 22 are read again, in **both** wordings,
  because `DATA_VER` keys a localStorage cache and the two populations
  coexist. The missing 306th is Stir the Aetherwinds, lowered on purpose:
  its `full` was an unanchored match swallowing a clause nobody built.
* **17 → 11 UNFAIR.** Four were phantasm and were genuinely fixed; the
  rest of the drop is `tools/failstates.js` no longer grading a keyword by
  counting its mentions in a file the semantics left in v2.53. See Phase B.

There is **one copy of the card semantics** (`engine/effects.js`) and **two
turn structures that call it**: `Battle` (solo, the tuned dummy) and
`judge.reduce` (the table, local or networked).

### Per-hero deck coverage

Unique `name|pitch` across deck + gear, read from the audit's own `usage`
map — **not** from the deck list, because pitch normalises on resolution and
keying the raw entry silently mismatches ~12 cards a hero.

```bash
node -e 'const a=require("./tools/audit.json");const per={};
for(const[k,u]of Object.entries(a.usage))for(const x of u){if(x.hero==="dummy")continue;
(per[x.hero]=per[x.hero]||{full:0,n:0});per[x.hero].n++;
if((a.cards[k]||{}).tier==="full")per[x.hero].full++;}
console.log(Object.entries(per).map(([h,v])=>h+" "+Math.round(100*v.full/v.n)+"%").join("\n"))'
```

| hero | uniq | full | part | none | %full | passive wired |
|---|---|---|---|---|---|---|
| lyath | 32 | 30 | 2 | 0 | **94%** | ✔ `lyathBoo` |
| kayo | 32 | 29 | 2 | 1 | **91%** | ✔ **done** |
| iyslander | 33 | 29 | 4 | 0 | **88%** | ✔ partial |
| dorinthea | 33 | 29 | 4 | 0 | **88%** | ✔ **done** |
| bravo | 33 | 28 | 3 | 2 | 85% | ✘ |
| viserai | 32 | 27 | 5 | 0 | 84% | ✔ |
| dash | 33 | 26 | 6 | 1 | 79% | ✘ |
| boltyn | 32 | 25 | 5 | 2 | 78% | ✘ |
| azalea | 32 | 25 | 3 | 4 | 78% | ✘ |
| fai | 34 | 26 | 6 | 2 | 76% | ✘ |
| briar | 32 | 24 | 8 | 0 | 75% | ✘ |
| blaze | 31 | 23 | 8 | 0 | 74% | ✘ |
| enigma | 34 | 23 | 9 | 2 | 68% | ✘ |
| gravy | 33 | 22 | 9 | 2 | 67% | ✔ `wateryGrave` |
| **arakni** | 32 | 15 | 10 | 7 | **47%** | ✘ |

**6 of 15 heroes have a wired passive** (`DawnBuild.PASSIVES` has 8 entries).
"Passive wired" is not the same as "hero ability built" — Dash's discounts
live in `boardRed`, not in a passive flag — so treat the column as a hint and
`npm run sweep` §1 as the authority.

---

## 2. THE ORDER, AND THE ARGUMENT FOR IT

```
A. ONE ENGINE        retire Battle          ← everything after is cheaper
B. THE UNFAIR 11     rules broken today     ← correctness, two keywords
C. THE HEROES        13 left                ← the bulk of the work
D. THE TABLE         ready gate + voice     ← small, and owed
E. TUNE              play sessions          ← last, needs C
```

**A goes first because it is a multiplier, not because it is urgent.** The
CR 4.4.3 end phase is implemented **twice** — `Battle.endPhaseCF` and
`judge.js` — and so is the combat path. `effects.js` holds the semantics
once, but *the schedule a card fires on* is duplicated. Every hero built
before A costs double at the point where a card needs a trigger window. C is
the biggest phase; paying its tax 13 times is the expensive mistake.

**B goes before C because those 11 cards break a rule every time they are
played**, and they are TWO keywords rather than eleven problems — 6 watery
grave and 5 suspense. Fixing a rule with a list behind it is the cheapest
correctness in the project.

**E goes last because it depends on C.** Tuning against a pool that is 76%
built measures the gaps, not the difficulty.

---

## PHASE A — ONE ENGINE

**Retire `Battle`'s rules.** The gate that governed this has been passed
since v2.80: the five semantics drills (`kayo`, `dorinthea`, `frostbite`,
`arcane`, `paytoll`) drive `judge.reduce` through `test/helpers/judged.js`.

### The measured cost

```
Battle            2,377 lines · 90 top-level declarations
                  137 mode/bphase references · 29 setG call sites
drill anchors     70 resolve INSIDE Battle, across 5 files
                  priority 33 · mirror 21 · dorinthea 6 · kayo 5 · sides 5
```

**The drill repointing is the real work; the deletion is the easy half.**

### The remaining feature gap — censused v2.83

| feature | verdict |
|---|---|
| Advisor | **done** (v2.83) — `advisor.advView` + both call sites explicit |
| score / trophy | **done** (v2.83) — local wins only; `wasted` was already tracked |
| boost | **done** (v2.84) — a pending, a legality gate and two buttons; the semantics were already in `effects.js`. `parser.printedKw` is the new predicate that keeps a card which only *mentions* boost from being offered it. |
| next-swing prediction | **drop** — it reads the `[3,4,5]` fabrication; a card-playing seat has no such number |
| `[3,4,5]` tuning | standing decision: retuning is a play session, not a drill |

### Steps

1. ~~**Boost at the table.**~~ **DONE (v2.84).** It cost less than scoped,
   because the semantics were already shared — only the QUESTION was
   missing. **There is now no feature gap left**: the table does
   everything the trainer does except the two things deliberately dropped.
2. **Route solo to the merged board.** One "Fight" button. Keep `Battle`
   reachable behind a flag for exactly one version so the harness still
   exists while the first real games are played on the merged path.

   **NOT DONE AT v3.00, AND DELIBERATELY.** The routing is already there —
   `App` branches on `cfg.table` and the local table builds through
   `buildMatch` with a null hero key — so the edit is close to one line.
   What stops it is the second-order cost: retiring the trainer retires the
   **TUNED** `[3,4,5]` escalation with it, and the table's dummy is measured
   winning **11 of 15** heroes (8 of 15 even at 20 life, so it is not the
   life total). Flipping the default ships a known regression to the default
   experience, and Phase E is a play session rather than a drill.

   **So sequence it with E, not before it.** Either land A and E in the same
   cycle, or land A behind a toggle the player chooses and watch a real game
   on it first. Do not flip the default from a session that cannot play the
   game on a phone.
3. **Repoint the 70 anchors.** Prefer moving each decision into a pure
   engine function you can DRIVE over re-aiming a source scan —
   `parser.idleCounterWipes` and `parser.rxPump` were both extracted for
   this reason. Anchors that survive must name their source file.
4. **Delete.** Then `foeVanilla`/`foeBegin`/`foeStep`/`foeEnd`,
   `dummyDefence`, `takeIt`, `finishBlock`, `resolveStack`, `newTurn`,
   `endPhaseCF` all go together.

### Traps specific to A

- **Whatever replaces `setG` must keep the invariant-judge funnel**, or
  `DawnInvariants` goes dark on the board where a bad state is hardest to
  reconstruct. `TableBoard` already funnels through the session's `onState`;
  that is the pattern.
- **When a rules function moves, the LEDGERS must follow it.**
  `test/actor.test.js` slices bodies by anchor pairs; an anchor pointing at a
  file the function has left **passes by finding nothing**.
- **A ledger that widens its own slice reports the wrong body.** Removing an
  anchor without replacing it lets the previous slice run on and swallow the
  next function — this bit during the v2.83 burn and was caught only because
  `endPhaseCF` is on the MIGRATED list.

---

## PHASE B — THE UNFAIR 11

```bash
node tools/failstates.js     # ranked; the UNFAIR block is at the top
```

**These break a rule every time the card is played** — the sev-3 "illegal
play allowed" and "drawback skipped" categories, where the player wins games
they should lose and the sim teaches wrong play.

> **THIS SAID 17 UNTIL v3.00 AND THE NUMBER WAS AN ARTIFACT.**
> `tools/failstates.js` graded a no-op keyword by counting its mentions in
> `index.html` — a file the card semantics left in **v2.53**. Measured with
> the tool's own regex: phantasm 2 mentions there and **11 across the
> engine**, watery grave 2 and 13, suspense 2 and 11. All three sat under
> the ≥3 threshold, so the whole block was one scan aimed at the wrong file.
> A source scan aimed at the wrong file passes by finding nothing; this one
> FAILED by finding nothing, which is the same defect with the opposite sign.
>
> Repointing it alone would have been worse than leaving it — the count
> would then have cleared the block, including two keywords nobody built. So
> the **LEDGER outranks the grep** (`tools/ledger.js` records what is
> BUILT), and a **DRAWBACK is held to a higher bar than an upside**: half a
> keyword is fine for a bonus and is exactly the wrong shape for a penalty.

**The 11 are TWO keywords, not eleven problems.** That is the whole reason
this phase is cheap:

| keyword | cards | state |
|---|---|---|
| **watery grave** | 6 | the UPSIDE is live and the drawback is not |
| **suspense** | 5 | `pending` in the ledger — not built at all |

**WATERY GRAVE — build the half that is missing.** Gravy Bones already
replays allies out of the graveyard (`built.wateryGrave` plus the
blue-in-graveyard check). Nothing turns a dead ally **face-down**, which is
the entire reason the ruling exists: *"they must be turned face down when
they die so they can not be used infinitely."* The ledger said `live` and
now says `partial`, with the gap named. The ruling also asks that a player
may inspect their OWN face-down cards and not their opponent's.

**SUSPENSE — build it.** The ruling is recorded and unambiguous: enters with
2 counters (the same on every suspense card), ticks at the start of turn,
is destroyed at 0 and **the payload fires then**. The counter machinery
already exists — verse counters and steam counters both tick on a schedule
— so this is a schedule plus a payload, not new machinery.

**Phantasm was the third of these and it is DONE (v3.00)** — and it was not
a mis-filing at all. It worked in the trainer and did **nothing at the
table**, because `effects.afterDefenders` was only ever called from
`index.html`. See the changelog; the shape is the WHERE/WHEN split in the
reader rather than the writer, and it is worth reading before building the
other two, because both of them will have to fire on *both* boards.

**The 12th entry is Lyath Goldmane, "drawback skipped"** — reported by
`npm run sweep` rather than by `failstates.js`, which counts cards.

**Neither `npm run audit` nor `npm run fairness` can see any of this** —
coverage counts clauses consumed, and the fairness sweep is deliberately
one-sided toward too-strong. The no-op blind spot is why: `noop` counts as
"accounted for", so these cards report `tier: full` with their mechanic
ignored.

```
Spears of Surreality   tier = FULL   kw = [Phantasm, Go again]
Barnacle               tier = FULL   kw = [Watery Grave]
```

---

## PHASE C — THE HEROES

**13 to go.** Kayo ✔ and Dorinthea ✔ are done and the method is the
deliverable as much as the cards are — see `HANDOFF.md` "HOW A HERO GETS
DONE" and `KAYO-GUIDE.md`.

```
99 cards still short of full   (22 read nothing · 77 partial)
26 unread hero-ability clauses across 11 heroes
10 tokens need a look — 6 with unread text and near-zero mentions
```

### Recommended order

**Take the well-covered heroes first**, so each pass is mostly hero ability
and a short tail rather than a rewrite:

1. **Iyslander** (88%, ability partly built) — both axes she needed are live
   since v2.71–v2.75: instant-speed play from arsenal, and acting during the
   opponent's turn. What is left is **freeze (Cold Snap)** — RULED, not built
   — and Aether Icevein's rider behind the unbuilt Ice Fusion condition.
2. **Lyath** (94%, the best-covered deck) — but chapter 3, and the crowd/boo
   mechanic is the least conventional in the pool.
3. **Viserai** (84%, passive already built) — the gentlest curve; tests
   runechants and arcane, both of which are real board auras now.
4. **Bravo** (85%) then **Dash** (79%) — Dash lands naturally *after* Phase A
   because boost is built there. Then Boltyn, Azalea (reload/charge), Fai and
   Briar (combo), Blaze.
5. **Enigma** (68%) and **Gravy Bones** (67%) — both carry Phase B's no-op
   keywords, so B makes them cheaper.
6. **Arakni LAST** (47%, 7 cards reading nothing). Traps and marks are their
   own subsystem.

### The method, compressed

1. Find the hero's **ONE mechanic**. Kayo's whole deck is "a card with 6 or
   more {p}" in three sets of words.
2. **Read the hero ability first.** Kayo's clause 2 was worth *half the
   deck* — 22 of 47 cards met his threshold before it, 45 after.
3. **Diff what the card PRINTS against what the engine GRANTS.** Every real
   bug in this phase so far reported tier `full`.
4. **Census the shape pool-wide, then fix the RULE.** Every fix last cycle
   had a list behind it and the list was always longer than the hero.
5. **Write the drill, then SABOTAGE it** — and verify the sabotage changed
   the file.
6. **Play it.**

---

## PHASE D — THE TABLE

Small, and the first item is **owed to the user**.

1. **THE LOBBY READY GATE — asked for, not built.** Both seats press Ready
   before the game starts. It belongs in `engine/lobby.js` as a **write-once
   slot per seat** — the same monotone accumulator as hero/throw/sideboard,
   so the writes commute and **no sequencer is needed** — derived into
   `stepOf` (never stored: a stored step is a transition, a transition has an
   order, and an order is the thing that module is built not to need), with
   UI in `TableRoom`. `test/lobby.test.js` enumerates all 16 interleavings;
   follow that.
2. **The second-person feed pass.** `engine/effects.js` has **44** literals
   containing you/your. A `say()` goes into the shared feed and must NAME the
   seat; a returned **refusal** is addressed to whoever acted and correctly
   says "you". Telling them apart is a judgement per line, not a regex.
   Pinned as a ledger in `test/judge.test.js` — the ledger pins the **source
   count**, because a driven count is emergent.
3. ~~One refusal hardcodes the dummy~~ — **fixed at v2.84.** Six
   player-facing strings in `effects.js` named "the dummy" and now read
   `foe(n).name`; `parser.js`'s copy is seat-neutral, because at parse
   time there is no game state to name anybody. Pinned in
   `test/judge.test.js`.
4. **The keyword LEDGER notes in `parser.js` are stale** — several say
   "the dummy pays no costs" or "has no action phase", both false since
   v2.71. They reach `AUDIT.md`, never a player, so this is a docs job.
5. **The boost line lands in the feed after the play it paid for**
   (`execute` accumulates it into `declNote`). In a training sim the
   sequence is the lesson.

---

## PHASE E — TUNE

**Not a drill. A play session.**

The local table's dummy is **untuned and too strong: it wins 11 of 15
heroes, and 8 of 15 even at 20 life** — so it is not the life total. A deck
with no rules text *suits* a policy that reads no card text: `sparring.act`
plays 30 vanilla attacks better than it plays a real hero's deck.

The trainer is unaffected while it exists — it runs the tuned `[3,4,5]`
escalation — but **Phase A retires that**, so E becomes load-bearing the
moment A lands. Sequence it accordingly: A creates the tuning debt, C is what
makes tuning meaningful, E pays it.

Also untuned and honest about it: **going second costs an extra swing**, and
the difficulty curve was built around going first.

---

## THE RULES THAT DO NOT CHANGE

These survive every phase. Each one cost a real bug.

- **No build step. Ever.** Plain UMD scripts, `file://` must work.
- **Never invent card effects.** Teach the parser to read the text; never
  special-case a card by name.
- **One copy of the semantics.** `effects.js` is it.
- **Never parse ahead of wiring** — reading a clause marks it consumed and
  makes the audit claim the card works.
- **Read the whole phrase or refuse.** A loose substring drops printed
  restrictions silently.
- `you()`/`opp()` read and `youMut()`/`oppMut()` write — **UI only**. Rules
  use `act()`/`foe()`, builds use `bAct()`. **Never write a side field as a
  top-level game key.**
- **Store the rng back** (`n.rng = rng`).
- `instead` **REPLACES** · go again is a **GAIN** · an instant costs **no**
  action point.
- **Assert on state — hands, life, zones, counters — never on log prose.**
- **Sabotage every new drill**, and verify the sabotage changed the file.
- **A source guard aimed at the wrong file, or the wrong shape, passes by
  finding nothing.**
- **A pinned sample is not a pinned rule.** Pinning an emergent count trains
  the reader to edit the number without thinking.
- **A DRILL THAT SKIPPED IS NOT A DRILL THAT PASSED.** 304 of 1053 skipped
  on a fresh clone and the suite reported green. Check the skip count, not
  just the fail count.
- **A WALK THAT STOPPED WALKING PASSES A CENSUS BY FINDING NOTHING.** Assert
  that the driver FINISHED and was never refused, or a harness parked
  against a pending it cannot answer reads exactly like a clean game.
- **THE CARD TEXT IS UPSTREAM'S, AND IT MOVES.** 138 of 405 cards were
  reworded in one pass. Anchors must read both wordings — a warm
  localStorage cache holds the old text — and `test/drift.test.js` is the
  guard. Run `node tools/audit.js --refresh` before a release cycle.
- **A SOURCE SCAN CAN FAIL BY FINDING NOTHING, not only pass by it.** Both
  directions are the same defect: the scan is aimed at the wrong file.
- **The user reads cards for a living. Ask them.**
