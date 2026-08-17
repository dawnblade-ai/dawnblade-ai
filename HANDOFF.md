# Handoff — Dawnblade, at v2.84 · THE FEATURE GAP IS CLOSED

> **v2.80–v2.84 happened after most of this file was written.** Where the
> two disagree, the prompt and "WHERE WE ARE" blocks below are current
> and the prose further down is history. Specifically: the five gate
> drills now drive `judge.reduce` (v2.80), the dummy is always vanilla
> (v2.81), two-tab table play is verified over the real relay (v2.82),
> the Advisor, the score and the trophy reach the table (v2.83), and
> boost lands (v2.84) — which **closes the feature gap entirely**.

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then **`FINISH.md`** — the blueprint to done.
> Most entries in both exist because breaking that rule already cost a
> real bug.
>
> **The two engines are merged and the retirement gate is PASSED.** There
> is ONE copy of the card semantics (`engine/effects.js`) and two turn
> structures that call it: `Battle` for solo, `judge.reduce` for the
> table. The table is reachable without a network, so solo can BE the
> table — and as of v2.84 **the feature gap between the two boards is
> closed**: the Advisor, the score, the trophy and boost are all there.
>
> **YOUR JOB IS PHASE A, AND WHAT IS LEFT OF IT IS MECHANICAL:**
>
> 1. **Route solo to the merged board.** One "Fight" button. Keep
>    `Battle` reachable behind a flag for exactly one version, so the
>    regression harness still exists while the first real games are
>    played on the merged path.
> 2. **Repoint the 70 drill anchors** that resolve inside `Battle` —
>    `priority` 33, `mirror` 21, `dorinthea` 6, `kayo` 5, `sides` 5.
>    **This is the real work; the deletion is the easy half.** Prefer
>    moving each decision into a pure engine function you can DRIVE over
>    re-aiming a source scan.
> 3. **Delete.** `foeVanilla`/`foeBegin`/`foeStep`/`foeEnd`,
>    `dummyDefence`, `takeIt`, `finishBlock`, `resolveStack`, `newTurn`,
>    `endPhaseCF` go together.
>
> **Two things that will bite:** whatever replaces `setG` must keep the
> invariant-judge funnel or the guard rails go dark; and retiring
> `Battle` retires the TUNED `[3,4,5]` escalation with it, so Phase E
> (tuning) becomes load-bearing the moment this lands — the table's
> dummy currently wins 11 of 15.
>
> **`HANDOFF-MERGE.md` is the record of the merge** — what it took and
> the eight things it learned the hard way.
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

## WHERE WE ARE — v2.84, pushed and live

`npm test` → **1053 drills green** · `npm run fairness` clean ·
`npm run audit` → 405 pool cards, **306 full / 77 part / 22 none**.
All 22 `engine/*.js` verified serving 200 and the deployed page serving
`APP_VER "2.84"`. `node` is at `~/node/bin`, **not on PATH** —
`export PATH="$HOME/node/bin:$PATH"`.
**A push IS the deploy** (standing authorization, 2026-08-03). Verify the
deploy, not just the tests.

```
1. ENGINE
     ✔ step 1 (v2.71) seat 1 takes a real turn
     ✔ step 2 (v2.72) instant-speed activation on their turn
     ✔ step 4 (v2.73) execute declares and stops
     ✔ step 3 (v2.74–v2.75) Frostbite, arcane prevention, the "unless they
                            pay" escape hatch, Inertia
       ☐ freeze (Cold Snap) — the last piece; RULED, not built
2. HEROES   KAYO ✔ · DORINTHEA ✔ · IYSLANDER unblocked and recommended next
3. THE MERGE
     ✔ v2.76 the flow (hero → throw → sideboard → game)
     ✔ v2.77 judge.js resolves card text — ONE copy of the semantics
     ✔ v2.78 the table can answer a prompt
     ✔ v2.79 a session with no network — solo can BE the table
     ✔ v2.80 THE GATE — the five semantics drills drive judge.reduce
     ✔ v2.81 the dummy is a punching bag, never a hero
     ✔ v2.82 two-tab table play over the real relay, 0 desyncs
     ✔ v2.83 the Advisor, the score and the trophy reach the table
     ✔ v2.84 boost — the feature gap is CLOSED
       ☐ retire Battle's rules — mechanical now: route, repoint, delete
```

## ➡ THE CURRENT JOB — retire `Battle`'s rules

**The gate is PASSED (v2.80)** and the feature gap is measured, then
CLOSED (v2.83–v2.84). What is left is deleting the loser.

### Why it is worth finishing, concretely

**The CR 4.4.3 end phase is implemented TWICE** — `Battle.endPhaseCF`
and `judge.js` — and so is the combat path. That is what makes wiring a
card a two-place job: the semantics are one copy (`effects.js`), but the
*schedule the card fires on* is not. Every hero from here pays that tax
until `Battle` goes.

### The gap, censused v2.83 and closed at v2.84

| feature | verdict |
|---|---|
| Advisor | **DONE** — `advView` + both call sites explicit |
| score / trophy | **DONE** — local wins only; `wasted` was already tracked |
| boost | **done** (v2.84) — the semantics were already shared; only the question was missing |
| next-swing prediction | **drop** — reads the `[3,4,5]` fabrication; a card-playing seat has no such number |
| `[3,4,5]` tuning | recorded decision: retuning is a play session, not a drill |

### What it costs

`Battle` is **2,377 lines**, and **70 drill anchors resolve inside it**
across five files — `priority` 33, `mirror` 21, `dorinthea` 6, `kayo` 5,
`sides` 5. (An earlier note said "~100 references"; 70 is the measured
number of anchors that actually land in `Battle`, and the rest of the 109
scanned point elsewhere in `index.html`.) Whatever replaces `setG`
**must keep the invariant-judge funnel** or the guard rails go dark.
Budget the drill repointing as the real work; the deletion is the easy
half.

**Read `HANDOFF-MERGE.md`** for what the merge took and the eight things
it learned the hard way.

### Also open, and small

- **`engine/effects.js` has 44 second-person literals.** A log line is
  read by both seats and must name one; a *refusal* is returned to
  whoever acted and correctly says "you". Telling them apart is a
  judgement per line. Pinned as a ledger in `test/judge.test.js`.
- ~~the hardcoded dummy~~ **FIXED at v2.84** — six player-facing strings
  in `effects.js` named "the dummy" and now read `foe(n).name`; the one
  in `parser.js` is seat-neutral, because at parse time there is no game
  state to name anybody. Pinned, and the guard excludes the keyword
  LEDGER notes by name rather than tolerating them with a loose regex.
- **Those ledger notes are stale**, and that is a docs job: several say
  "the dummy pays no costs" / "has no action phase", both false since
  v2.71. They reach `AUDIT.md`, never a player.
- **The boost line lands in the feed AFTER the play it paid for**,
  because `execute` accumulates it into `declNote`. In a training sim the
  sequence is the lesson, so it belongs with the voice pass above.

---

## HOW A HERO GETS DONE (the Kayo method)

**Dorinthea confirmed the method and added one step.** Her whole deck is
"a WEAPON attack, swung twice" — the hero ability frees the blade for a
second swing, the Dawnblade rewards its *second* hit each turn, and the
Reprise family pays you for the opponent blocking from hand. Reading the
hero ability first explained the deck's go-again density before a line of
code was written.

**THE NEW STEP IS 3a: CENSUS THE SHAPE ACROSS THE WHOLE POOL BEFORE FIXING
IT.** Every fix this cycle turned out to be a rule with a list behind it,
and the list was always longer than the hero:

| the shape | on her deck | in the pool |
|---|---|---|
| a gated pump read twice | 6 cards | **7 cards, 4 heroes** |
| a printed `instead` summed | 4 cards | 4 cards, 3 keyword gates |
| a target restriction dropped | 9 cards | **13 cards, 6 heroes** |
| a quoted granted ability dropped | 6 cards | **7 cards, 3 heroes** |

One `node -e` over `tools/audit.json` gives the list in a minute, and it is
what turns "fix the card" into "fix the rule" — which is rule 4 below with
evidence attached rather than as an aspiration.

1. **Find the hero's ONE mechanic.** Kayo's whole deck is "a card with 6 or
   more {p}" wearing three different sets of words. Read the deck list and
   the hero's printed text together before touching code.
2. **Read the hero ability first.** Kayo's clause 2 was worth *half the
   deck* — 22 of 47 cards satisfied his own threshold before it, 45 after.
   A hero ability that looks like bookkeeping can be the engine.
3. **Diff what the card PRINTS against what the engine GRANTS**, card by
   card. Every real bug this cycle looked like this, and **every affected
   card reported tier `full`** — they were read, and read *wrong*.
4. **Fix the RULE, not the card.** Five separate spellings of
   `(c.power||0)>=6` became `parser.pow6`. Never special-case a card by
   name; a drill should fail if a card's name appears in the wiring.
5. **Write the drill, then SABOTAGE it.** Non-negotiable — see below.
6. **Play it.** Several bugs this cycle were invisible to every tool.

---

## THE RULES THAT CAUGHT EVERY BUG

**1. NEVER INVENT CARD EFFECTS.** Teach the parser to read the text; never
special-case by name.

**2. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier and makes the audit claim it works.
(`fx.handAbility` deliberately does *not* touch `tier` for this reason.)

**3. READ THE WHOLE PHRASE OR REFUSE.** A loose substring silently drops
printed restrictions.

**4. SABOTAGE EVERY NEW DRILL.** Reintroduce the bug, watch it fail,
restore. **This caught three drills that proved nothing in one session** —
Strongest Survive shipped with no drill at all, Beaten Trackers' drill
grepped for a variable that survives deleting the gate, and a "never
reaches damage" guard keyword-matched a log string. **Pin the gate, not the
identifier.**

**4a. VERIFY THE SABOTAGE ACTUALLY CHANGED THE FILE.** Three sabotages in
the Dorinthea cycle silently matched nothing — a `==` written for a `===`, a
comment that did not match the comment in the file, a regex against text
that was never there. **A sabotage that edits nothing looks exactly like a
drill that does not bite**, and reads as a pass. Hash the file before and
after, or diff it.

**4b. A GREP IS SATISFIED BY A COMMENT — IN BOTH DIRECTIONS.** v2.68 shipped
a drill that stayed green with the gate replaced by `if(false)`, because the
identifier it searched for was sitting in the comment above the gate: a false
**pass**, which is worse than no drill. v2.66 hit the mirror image, where a
comment containing an example of a bug tripped a scan that was working
correctly — there the fix is to reword the prose, never to weaken the scan.
Prefer moving the decision into a pure engine function you can DRIVE
(`parser.idleCounterWipes`, `parser.rxPump` were both extracted for exactly
this); when you must scan source, strip comments first.

**4c. TAKE BACKUPS UNCONDITIONALLY.** `fairness | grep … && cp file /tmp/bak`
did not copy anything, because the summary line reads `4 finding(s)` and the
grep pattern said `findings`. The `&&` short-circuited, and the "restore"
afterwards reverted the file to a snapshot from an earlier round — silently
deleting a finished fix. Never chain a backup behind a test.

**5. ASSERT ON STATE, NEVER ON LOG PROSE.** Hands, life, zones, counters.

**6. THE USER READS CARDS FOR A LIVING. ASK THEM.** Every ruling this cycle
came from asking. They have explicitly invited it.

---

## THE TRAPS, IN ONE PLACE

- **A LOCAL MAY NEVER SHADOW `act`/`foe`/`you`/`opp`.** Block-scoped, it
  puts the global in the temporal dead zone for the *whole block including
  lines above it*. This shipped a crash (v2.54). `test/shadow.test.js`
  guards it.
- **THE TDZ BITES TWICE.** v2.63: `foeSwing` was called from a `useState`
  initializer — safe for a hoisted `function`, fatal once it reached for
  `gy` and `_EFX`, which are `const`s declared further down the component.
- **"YOUR ACTION PHASE" IS NOT `phase === "action"`.** In FaB the combat
  chain lives inside the TURN PLAYER's action phase, so defending on their
  turn is still "action". Gate on `turnPlayer === actorOf(n)` too.
- **WHEN A RULES FUNCTION MOVES, THE LEDGERS MUST FOLLOW IT.** A source
  guard aimed at the wrong file **passes by finding nothing**;
  `test/actor.test.js`'s anchors name their source file.
- **The database states the type twice** and they disagree on 5 records.
  `card.ty` is the authority; DFCs parse the front face of `tt`.
- **`youMut()`/`oppMut()` to write, always.** A per-side field written as a
  top-level game key silently does nothing.
- **Store the rng back** (`n.rng = rng`).
- **The browser caches `engine/*.js` hard.** Re-fetch with `cache:"reload"`
  then navigate with a fresh `?v=` before believing anything.
- **Driving the UI from JS needs one click per tool call** — two in a tick
  batch into one React render and the two-tap interaction re-arms.
- **Test at phone dimensions (393×852).**
- **`computer` clicks time out on the deployed page; `javascript_tool` works.**
  Drive taps with `document.querySelectorAll('button')[i].click()`, still one
  click per tool call. Find a card by its image `alt` and its class prefix
  (`g ` = gear, `hc ` = hand rail) rather than by index, which shifts.
- **A `dummyDefence` stub must return `{n, note}`, not the state.** The Kayo
  test ctx returns the bare state and gets away with it because those drills
  only ever drive `runOps`; the moment you drive `execute` it reads
  `undefined.log` and dies.

---

## WHAT IS STILL OPEN ON THE TWO FINISHED HEROES

**Both end in the same place, and it is one rule, not seven cards.**

| hero | card | the unread clause |
|---|---|---|
| Kayo | Beaten Trackers | "you may destroy this. **If you do**, gain 1 action point" |
| Dorinthea | Refraction Bolters | "you may destroy this. **If you do**, the attack gains go again" |

That is the **"If you do, …" family**, deliberately unread since v2.04
because running the rider without charging the cost is the free-ability bug
that version fixed. The machinery to ask properly now exists —
`engine/prompts.js`'s `pay` variant, and `pick` with `min:0` — so this is a
spec object plus a queue site, not new machinery. **Build it once and both
heroes close**, along with the rest of the 24-card family (see CLAUDE.md,
"Optional costs").

The rest are genuinely separate, and each is small:

- Kayo: Agile Windup (`Instant - Discard this:` on a card in HAND),
  Rally the Coast Guard (the `+3{d}` rider).
- Dorinthea: Agile Engagement ("defended by an attack action card"),
  Oasis Respite (a life comparison across heroes), Wreck Havoc (turning a
  card in an opponent's arsenal face up).

---

## WHICH HERO NEXT

Regenerate this table rather than trusting it — the snippet is in
`KAYO-GUIDE.md` §1, and a per-hero version is in this session's scratchpad
pattern (walk `W.DECKS[k]`, normalise `name|pitch`, read `A.cards[...].tier`).

```
hero          full part none   hero ability
  lyath         29    2    0   UNBUILT
  iyslander     28    3    0   UNBUILT
  viserai       25    4    0   built
  dorinthea     29    4    0   built    <- done
  briar         23    5    0   UNBUILT
  kayo          27    2    1   built    <- done
  ...
  azalea        19    3    3   UNBUILT
  arakni        11    9    2   UNBUILT  <- leave for last
```

**Recommended: IYSLANDER, and she is now UNBLOCKED.** 28 full / 3 part /
**0 unreadable** — the second-best-covered deck — and her hero ability is
genuinely unbuilt, so the "find the hero's one mechanic" exercise is real
rather than already done.

**Both axes she was going to test are now BUILT and verified in play**
(v2.71–v2.75), so plan around them existing rather than around discovering
them:

1. **playing at instant speed from the arsenal** (her clause 1) — live;
   driven in a real game by playing Cold Snap from arsenal during the
   opponent's turn.
2. **acting during the opponent's turn** (Ice → Frostbite) — live; the
   token lands on the opponent's board, taxes through `effCost`, and thaws
   in the shared end phase. `foeTurnIce` mints a real token.

What is left on her is **freeze (Cold Snap)** — ruled, not built, see
`HANDOFF-MERGE.md` — and **Aether Icevein's rider**, which sits behind the
unbuilt Ice Fusion condition.

Alternatives, both reasonable:
- **Viserai** (Runeblade, ch1) — 25/4/0, hero ability already built, tests
  runechants and arcane. The gentlest curve left.
- **Lyath** — the best-covered deck (29/2/0) but chapter 3, and its
  crowd/boo mechanic is the least conventional in the pool.

**Leave Arakni for last** — 11 full / 9 part / 2 none, and traps/marks are
their own subsystem.

---

## THE JOB

**Build carefully, one piece at a time, and never claim more than is true.**
Read `CLAUDE.md` first, in full. Most entries exist because breaking the
rule already cost a real bug.
