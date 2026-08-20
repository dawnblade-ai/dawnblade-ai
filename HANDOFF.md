# Handoff — Dawnblade, at v3.05 · PHASE C, IYSLANDER IS TWO CARDS FROM DONE

> **v3.00–v3.01 happened after most of this file was written.** Where the
> two disagree, this block and `FINISH.md` are current and the prose
> further down is history.

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then **`FINISH.md`** — the blueprint to done.
> Most entries in both exist because breaking that rule cost a real bug.
>
> **The two engines are merged, the pool is PINNED, and Phase B is
> DONE.** `npm test` is **1070 drills** and every card drill runs
> offline; `tools/failstates.js` reports **0 UNFAIR**. Run `npm test` and
> check the SKIP count, not just the fails — a fresh clone used to skip
> 304 drills silently, which is how 22 broken cards survived a green
> suite.
>
> **YOUR JOB IS PHASE C — THE HEROES. 13 left, and IYSLANDER IS TWO CARDS
> FROM DONE.** Freeze (v3.03), equipment abilities (v3.04) and hand
> abilities (v3.05) are all built, on both boards.
>
> | card | what is unread |
> |---|---|
> | **Brain Freeze** | the fused rider: "put an action card with cost 0 from their hand on top of their deck" — a hand-to-deck-top move, and `fused` is already a real condition |
> | Ice Eternal | X-cost, deliberately unbuilt — the pool's only one, and CLAUDE.md records the decision |
> | *(Stir the Aetherwinds)* | the instant-speed grant, unread on purpose since v3.00. It is one of THREE cards printing "play … as though it were an instant" (with Iyslander's own clause 1, which IS built as `arsenalInstant`), so it is a small rule with a list — worth doing when you build the next Wizard. |
>
> **Ice Fusion is genuinely built** — `fused` is a real condition, so
> Aether Icevein (×3) and Polar Cap resolve in full. Do not re-derive it.
> Her hero ability's two axes are live and verified in play: instant-speed
> play from arsenal, and acting during the opponent's turn.
>
> **THEN PICK THE NEXT HERO.** Regenerate the coverage table rather than
> trusting it — the snippet is in `FINISH.md` §1. Viserai (passive already
> built, gentlest curve) or Lyath (best-covered deck, but chapter 3 and
> the crowd/boo mechanic). Leave Arakni for last.
>
> **READ THE THREE v3.00–v3.01 FINDS FIRST. They are one shape and it
> will bite you again:** phantasm, watery grave and suspense were each a
> rule that existed on ONE board. `effects.js` holds the semantics once,
> but the SCHEDULE a card fires on is still written per board. The last
> three known ones were closed at v3.07 (`thawFrost`, `resolveInertia`
> and the aura sweep, now `effects.sweepArena`) — and finishing them
> turned up three MORE of the same shape, including one above rate.
> **When you build anything that fires on a schedule, ask which board
> runs it.** `effects.tickSuspense` and `effects.sweepArena` are the
> worked examples: pure, shared, and they hand the payload back to the
> caller rather than running it.
>
> **How to work:**
>
> - **Find the hero's ONE mechanic, and read the hero ability FIRST.**
>   Kayo's clause 2 was worth half his deck.
> - **Census the shape pool-wide before fixing it.** Every fix turns out
>   to be a rule with a list behind it, and the list is always longer
>   than the hero. Both v3.01 keywords were worth more than their cards.
> - **Fix the RULE, not the card.** Never special-case a card by name.
> - **Never invent card effects** — teach the parser to read the text.
> - **Write the drill, then SABOTAGE it**, and verify the sabotage
>   actually changed the file.
> - **Assert on state — hands, life, zones, counters — never on log
>   prose.**
> - **Play it.** `npm test` green is the floor, not the proof.
> - **Ask me about rules.** I read cards for a living and I would rather
>   be asked than have it guessed.
>
> Never claim more than is true.

---

## WHERE WE ARE — v3.16

`npm test` → **1160 drills, 0 failed** (0 skipped with a live DB cached;
4 drift drills skip without one) · `npm run fairness` clean ·
`npm run audit` → 405 pool cards, **308 full / 75 part / 22 none** ·
`tools/failstates.js` → **0 UNFAIR**.

**305 went to 304 and back, and the round trip is the point.** Cold Snap
reported `full` while doing nothing (v3.02 dropped it to the truth), and
now reports `full` because the card works. A number that goes down
because a lie was removed is the number improving.
`node` is at `~/node/bin`, **not on PATH** —
`export PATH="$HOME/node/bin:$PATH"`.
**A push to `main` IS the deploy** (standing authorization, 2026-08-03).

```
1. ENGINE   ✔ merged · ✔ pool pinned · ✔ drift guarded
2. PHASE B  ✔ DONE — 0 UNFAIR (watery grave + suspense, v3.01)
3. PHASE C  ✔ IYSLANDER — freeze (v3.03), equipment abilities (v3.04),
              hand abilities (v3.05), Brain Freeze (v3.06). 31/33 full;
              the two left are RECORDED DECISIONS, not work — see below
            ▸ NEXT HERO — 12 remain; Viserai is the gentlest curve
4. PHASE A  ☐ retire Battle — carries the tuning debt, needs a phone
```

### IYSLANDER IS DONE, AND TWO CARDS ARE STILL `part`

That is not a contradiction and it must not be read as one. Both are
**recorded decisions** with the reason written down, and building either
would make the card *wrong* rather than *more complete*:

| card | why it stays |
|---|---|
| **Ice Eternal** | the pool's only X-cost card. `create X ... tokens` is REFUSED rather than read as one — creating a single token for a card that charges for X is quietly weaker than printed, and coverage reads that as `full` |
| **Stir the Aetherwinds** | its bonus half IS read; the instant-speed grant is not. Its `full` at v2.99 was an unanchored regex swallowing a whole sentence and modelling half of it — the tier was lowered ON PURPOSE at v3.00 |

**A hero is finished when every card is either built or has a written
reason.** Chasing the last two tiers here buys a number and costs the
truth of the number.

### NEXT HERO — the shortlist, and why

Twelve remain. **Viserai** is the recommendation: his passive is already
built (`bAct(n).viseraiPassive`), runechants are real board auras since
v2.23, and his deck's one mechanic — the rite — has a live schedule to
hang off. **Lyath** is the best-covered on paper but his chapter-3 text
is the pool's densest. **Leave Arakni last**: stealth-as-qualifier is
filed `noop` by ruling, so his deck's coverage number is the least
honest one in the pool.

Find the hero's ONE mechanic first, and **read the hero ability before
the cards** — Kayo's clause 2 was worth half his deck.

### The five things v3.00–v3.01 found, and why no tool saw them

| find | why it was invisible |
|---|---|
| Under Loop in a deck AND on the chain | the census walk had parked against a boost pending it could not answer |
| 22 cards stopped resolving | the 22MB database is gitignored, so every card drill SKIPPED |
| phantasm inert at the table | the tool grading it counted mentions in a file the semantics left in v2.53 |
| every graveyard card playable at the table | the zone rule lived in the trainer's UI, where no reducer could reach it |
| suspense paid on the way IN | no arena-departure schedule existed on either board |

**All five are one family**: a guard aimed at the wrong thing reports
success by finding nothing, and a rule kept on one board is a rule the
other board does not have.

## RETIRING `Battle` — the standing detail (option A above)

> **This was "THE CURRENT JOB" through v2.84 and is now one of two.** The
> cost below is still accurate; what changed at v3.00 is that the reason
> to hold it became explicit — it carries the tuning debt, so sequence it
> with a play session. See `FINISH.md` Phase A step 2.

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
