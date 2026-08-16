# Handoff — Dawnblade, at v2.76 · THE MERGE

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then `HANDOFF.md`. Most entries in both exist
> because breaking that rule already cost a real bug.
>
> **Your job: merge the two engines into ONE flow.** Whether seat 1 is the
> vanilla Dummy, a real hero deck, or a person on another phone, the same
> engine handles the table state behind the scenes. Two-player is the only
> mode; solo is just two-player where seat 1 is not a person.
>
> The plan, the measurements and the compatibility findings are in
> **`HANDOFF-MERGE.md`** — read it before scoping anything. It is written
> so you do not have to rediscover what this session measured.
>
> **How to work:**
>
> - **Census the shape pool-wide before fixing it.** Every fix last cycle
>   turned out to be a rule with a list behind it, and the list was always
>   longer than the hero.
> - **Fix the RULE, not the card.** Never special-case a card by name.
> - **Never invent card effects** — teach the parser to read the text.
> - **Write the drill, then SABOTAGE it**, and verify the sabotage actually
>   changed the file. Prefer a decision you can DRIVE over a source scan;
>   when you must scan, strip comments first.
> - **Assert on state — hands, life, zones, counters — never on log prose.**
> - **Play it.** `npm test` green is the floor, not the proof.
> - **Ask me about rules.** I read cards for a living and I would rather be
>   asked than have it guessed.
>
> Never claim more than is true.

---

## WHERE WE ARE — v2.76, pushed and live

`npm test` → **988 drills green**. `npm run fairness` → clean.
`npm run audit` → 405 pool cards, **306 full / 77 part / 22 none**.
All 21 `engine/*.js` verified serving 200. `node` is at `~/node/bin`,
**not on PATH** — `export PATH="$HOME/node/bin:$PATH"`.

**A push IS the deploy.** The user has standing authorization to push
without asking (2026-08-03). Verify the deploy, not just the tests: poll
until `APP_VER` matches AND all 21 engine files return 200.

### The four versions this session shipped

| ver | what |
|---|---|
| 2.74 | Frostbite is a real Aura; arcane damage gets ONE choke point and four dead preventions wake up |
| 2.75 | the printed "unless they pay" escape hatch exists; Inertia is a hand wipe |
| 2.76 | the pre-game order matches the rules: **hero → throw → sideboard → game** |

Engine **step 3 is done except freeze** (see "STILL OPEN" below).

---

## THE TARGET — one flow, one engine

```
   hero + opponent          opponent = Dummy | a hero | a person
        ↓                   (picked on the hero screen — v2.76)
      throw                 seating decided
        ↓
    sideboard               you board knowing matchup AND seating
        ↓
       game
        ↓
  ┌─────────────────────────────────────────┐
  │  judge.reduce   the CR turn structure   │   ← one rules engine
  │  effects.*      the card semantics      │
  │  sparring.act   seat 1, when local      │
  └─────────────────────────────────────────┘
        ↓                        ↓
   local session          net.js session
   (Dummy / hero)         (a person)
        └────────── TableBoard ──────────┘
```

**Solo and table stop being two things.** They become one game with
different things answering *what do you do* in seat 1.

---

## WHY THIS IS NOW TRACTABLE — measured 2026-08-16, not guessed

The old handoff said the unification was blocked on "~19 trainer closures"
and called it "the next seam of the same kind `dummyDefence` was, and it is
bigger." **That estimate is stale, and the reason is good news.**

### 1. `judge.js` ALREADY HAS THE SAME ACTOR DISCIPLINE

This is the finding that changes the size of the job. `judge.js` lines
126–170 already define, in the identical shape `effects.js` expects:

```js
const actorOf = g => g.actor != null ? g.actor : g.turnPlayer;
const act = g => g.sides[actorOf(g)];
const foe = g => g.sides[P.other(actorOf(g))];
const at  = (g, i) => g.sides[i];
const put = (g, i, o) => S.withSide(g, i, o);
const bAct = g => (g.builds || [])[actorOf(g)] || {};
const bOf  = (g, i) => (g.builds || [])[i] || {};
const say  = (g, msg) => …            // this is `L`
const toGrave = (g, i, cards) => …    // this is `gy`
function mint(g, tag){ … }            // uid minting
```

and it carries `g.actor`, `g.builds`, `g.tokSeq`, `g.sides`, `g.pend`,
`g.stack`, `g.turn`, `g.rng`. **It is not a foreign state shape — it is the
same one, written functionally.**

### 2. THE 18-KEY CONTEXT IS MOSTLY ALREADY THERE

`E.CTX_KEYS` is 18. Mapping them to what `judge.js` already has:

| ctx key | judge.js | note |
|---|---|---|
| `act`, `foe`, `actorOf` | **identical** | no work |
| `bAct` | **identical** | no work |
| `bFoe` | `bOf(g, other)` | one line |
| `L` | `say` | one line |
| `gy` / `gyDisc` | `toGrave` | `_gy` / `_disc` stamps |
| `tokSeq` | `g.tokSeq` + `mint` | one line |
| `built` | `bOf(g,0)` | **UI only** — never a rules read (v2.41) |
| `db` | passed in | no work |
| `actMut`, `foeMut` | **the one real difference** | see below |
| `winCheck` | judge has its own loss check | small |
| `openPrompt` | **does not exist in judge** | real work |
| `mkRune` | `game.addRunechants` | small |
| `had6ThisTurn` | one pure line | small |
| `typeAbbr` | already module-level | move it |

**380 of ~500 context uses are the five seat accessors**, and four of those
five are already identical. Only `openPrompt` is genuinely new work.

### 3. THE MUTABLE/PURE MISMATCH IS COMPATIBLE — CHECK THIS FIRST

`effects.js` uses the trainer's idiom:

```js
actMut(n).hp -= 4        // clones sides[] and the side, returns it mutable
```

`judge.js` is purely functional (`put(g, i, s => ({...s, hp: s.hp-4}))`).

They are **compatible**, and the reason matters: `actMut` clones
`n.sides` and `n.sides[i]` *itself* before handing back a mutable side. So
if `judge` passes a shallow clone `{...g}` into an effects call and takes
the returned object as its new state, nothing outside is ever mutated —
which is exactly what `Battle` already does through `setG`.

**VERIFIED 2026-08-16, not assumed.** Driven: a judge-shaped state was
shallow-cloned into `runOps([["arcane",5]])`; the result changed
(`sides[1].hp` 20 → 15) and `JSON.stringify(input)` was **byte-identical
before and after**. And every accessor was supplied using only names
`judge.js` already exports — all ten present:

```
actorOf ✓  act ✓  foe ✓  at ✓  put ✓  bAct ✓  bOf ✓  say ✓  toGrave ✓  mint ✓
```

**Turn that probe into a real drill as the first commit of v2.77**, because
it is the property the whole merge rests on and it must keep being true as
`effects.js` grows. The scratch version is in this session's transcript;
the shape is: build the ctx from judge's exports only, snapshot the input,
run an op, assert the snapshot is unchanged.

### 4. THE BOARD ALREADY SPEAKS THE TARGET LANGUAGE

`TableBoard` renders `phase`/`step` out of `priority.js` and shares
`ArmorGrid`, `DeckPitchCol`, `InPlayRow`, `GravePane`, `PeekDock` with the
trainer. **It has exactly ONE dispatch point:**

```js
const fire = a => { const why = sess.current.submit(a); setNote(why||null); };
```

and the session is built with `reduce: DawnJudge.reduce`. So a **local
session** with the same interface (`submit`, `status`, `seq`, `hash`,
`stats`) that applies `reduce` directly is a small, well-bounded piece.
`net.js`'s `loopback()` already proves the shape in drills.

### 5. WHAT IS ACTUALLY LEFT

| # | work | size |
|---|---|---|
| 1 | `effects.js` stops reading `mode` (2 real sites) | small |
| 2 | `judge.js` supplies the ctx and calls `execute`/`afterDefenders`/`resolveStack` | **the real job** |
| 3 | a prompt queue + drain in `judge.js` (`openPrompt`) | medium |
| 4 | local session; seat 1 = `sparring.act` or a hero policy | small |
| 5 | one board; retire `Battle`'s rules | medium |

---

## THE ORDER — decided by the user, 2026-08-16

```
v2.76  the flow                                        ✔ SHIPPED
v2.77  judge.js resolves card text  (items 1–3)
v2.78  local session, seat 1 without a network (item 4)
v2.79  one board; Battle's rules retire (item 5)
```

**Chosen deliberately over "switch the flow now and fill in card effects
after."** The table resolves NO card text today, so switching first would
make the game worse for a version or two. This order means **nothing ever
regresses.**

### THE RULE THAT GOVERNS THE WHOLE MERGE

> **`Battle` is the regression harness and does not retire until the merged
> path passes the same drills.** It plays every card effect today and is the
> only proof the semantics are right.

Concretely: before deleting anything in `Battle`, `test/kayo.test.js`,
`test/dorinthea.test.js`, `test/frostbite.test.js`, `test/arcane.test.js`
and `test/paytoll.test.js` must pass **driving `judge.reduce`** rather than
a hand-rolled effects context.

---

## DECISIONS ALREADY MADE — do not re-litigate

| decision | date | what |
|---|---|---|
| **Keep the `sparring.js` wall** | 2026-08-16 | It reads NO card text, and that stays. Seat 1 is printed-numbers-only. Accepting a weaker seat 1 was chosen explicitly over letting the policy read the parser, because "a sparring partner playing badly and a card being read wrong must never be confusable." `sparring.js` is **untouched** by this merge. |
| **Two-player is the only mode** | 2026-08-16 | Opponent picked on the hero screen; vanilla Dummy is the default. |
| **Sideboard follows the throw** | 2026-08-16 | Shipped in v2.76. `lobby.js` had ruled it since it was written; solo was the only thing doing it backwards. |
| **Build the seat** | 2026-08-14 | Reverses the 2026-07-25 "no AI opponent" note. Both dates are kept so nobody re-litigates from the old one. |

---

## WHAT MUST SURVIVE THE MERGE

- **No build step, ever.** Plain UMD scripts, `file://` must work.
- **Never invent card effects.** Teach the parser to read the text.
- **One copy of the semantics.** `effects.js` is it. The whole point of
  this merge is that there is one rules engine, not two.
- `you()`/`opp()` read and `youMut()`/`oppMut()` write — **UI only**.
  Rules use `act()`/`foe()`, builds use `bAct()`. **Never write a side
  field as a top-level game key.**
- **Store the rng back** (`n.rng = rng`).
- `instead` REPLACES · go again is a **GAIN** · an instant costs **no**
  action point.
- **The vanilla dummy's `[3,4,5]` escalation is TUNED**; real cards are
  not. Retuning is a play session, not a drill.
- **`sparring.js`'s three properties**: it proposes and `judge.legal`
  disposes (a refusal is always a bug in the policy); it reads no card
  text; it is deterministic and never touches `game.rng` (ties broken on
  uid, or two equal blockers desync).
- **The winner follows the HERO, not the chair.**

---

## THE TRAP THIS IDEA ALREADY WALKED INTO ONCE

Porting `dummyDefence` unchanged into `sparring.js` made the game
degenerate: **both seats blocked 41 of 41 attacks** and one finished a
21-turn game on full life. The heuristic was written for a seat with **no
action phase**, where a card in hand had no use but to block. Both seats
have an action phase now (v2.71), so `takeUpTo` — the damage a seat will
simply take rather than spend a card on — is load-bearing, and **lethal
overrides it**. A regression run that never deals damage never exercises
the damage step.

The same lesson bit twice more this session and both fixes are in
`effects.js`: `soakPolicy` will not pay more resources than the damage is
worth, and `payPolicy` will not pitch its **last** card to avoid discarding
a card. **Any new seat-1 policy needs the same brake.**

---

## STILL OPEN — engine step 3's last piece

**Freeze (Cold Snap)** is the only one of the five expired `noop`s not
built. **RULING (user, 2026-08-14):**

> The opponent is prompted to pay. If they pay, nothing happens. If they
> decline, **the CASTER** is prompted to choose from the opponent's arsenal
> or an ally they control. That object is frozen **until the start of the
> caster's next turn**. A frozen card cannot be played and its abilities
> cannot be activated. The arsenal is chosen **blind** — you pick the zone,
> not the identity, so hidden information is preserved.

What it needs: a `frozen` marker with an expiry turn; a gate on
play/activation; a chained prompt back to the caster (`payOr`'s `elseOps`
resolve at the ASKED side, so the freeze op has to queue a sheet addressed
to `1-actorOf`); and Cold Snap's two sentences paired in `fxParse` the way
`optCost` pairs its halves — the splitter breaks them on the period.

**It is card semantics, so it lands in `parser.js`/`effects.js` and the
merge does not move either.** Safe to do before, during or after.

### Also open, and each is small

- **Aether Icevein's rider** sits behind the unbuilt **Ice Fusion**
  condition, so its "unless they pay {r}{r}" never fires. Fusion is
  `unreviewed` in the ledger.
- **Winter's Bite was never drawn in live play.** The engine path is driven
  end to end; the trainer's seat-1 pay routing is so far pinned only by a
  source scan.
- **The "If you do, …" family** (24 cards) — Kayo's Beaten Trackers and
  Dorinthea's Refraction Bolters both end here. The machinery now exists
  (`pay` with `elseOps`, `pick` with `min:0`).
- **`window.THROW_MODE = "coin"`** is still the testing default. Set it to
  `"rps"` before launch; `rps.js` and the throw UI are untouched.

---

## WHAT THIS SESSION LEARNED THE HARD WAY

Four drills went green against broken code and only sabotage found them.
Every one is a shape that will recur:

1. **A grep is satisfied by what survives deleting the gate.** The
   end-phase thaw drill searched `endPhaseCF` for `isFrostbite`; neutering
   the gate with `const thawed = 0` left the identifier sitting in the dead
   block. → the rule moved into pure `DawnEffects.thawFrost` and is driven.
2. **A drill can assert on a fixture it built itself.** The stale-`avail`
   drill checked a spec the *test* constructed, so sabotaging the engine
   changed nothing. → drive the real queue.
3. **A guard can have no case that needs it.** `soakPolicy`'s "already
   covered" check and `payPolicy`'s affordability check were both masked by
   other guards until a case was written that only they could catch.
4. **A drill can fail for the wrong reason.** A non-greedy regex stopping
   at a nested `</div>` looked like a real failure.

And two bugs were invisible to **all 961 drills** and to `invariants.js`,
found only by opening the game:

- `avail` frozen at prompt-queue time went stale across three chained
  Runechant soaks — would have fired an unpaid prevention.
- An unpayable soak answer granted the prevention anyway.

**Play it. Every time.**

---
