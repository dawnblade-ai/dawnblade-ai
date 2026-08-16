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

`npm test` → **988 drills green** · `npm run fairness` clean ·
`npm run audit` → 405 pool cards, **306 full / 77 part / 22 none**.
All 21 `engine/*.js` verified serving 200. `node` is at `~/node/bin`,
**not on PATH** — `export PATH="$HOME/node/bin:$PATH"`.
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
3. THE MERGE — IN PROGRESS.  v2.76 shipped the flow.
```

## ➡ THE CURRENT JOB IS THE MERGE — read `HANDOFF-MERGE.md`

One flow, one engine: whether seat 1 is the vanilla Dummy, a real hero
deck, or a person on another phone, the same engine handles the table state.
**`HANDOFF-MERGE.md` carries the plan, the measurements and the
compatibility findings** — including the one that changes the size of the
job (`judge.js` already has the identical actor discipline `effects.js`
expects) and the one assumption to verify first (the mutable/pure seam).

Order, decided by the user 2026-08-16:
`v2.77` judge.js resolves card text · `v2.78` local session so seat 1 needs
no network · `v2.79` one board, Battle's rules retire.

**`Battle` is the regression harness and does not retire until the merged
path passes the same drills.**

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
