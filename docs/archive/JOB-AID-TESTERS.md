# JOB AID — the two-tester card pass

For the paired **BUILDER** / **JUDGE** agents bringing the remaining pool cards
online. Read this once, in full. It is the whole procedure; you should not need
to re-read `CLAUDE.md` end to end (it auto-loads — skim the sections this aid
names and no more).

**Baseline (v2.51, 2026-08-04 — the start of Phase 3):**

| | |
|---|---|
| `npm test` | **790 drills, all green** |
| `npm run fairness` | **clean** |
| Pool | 405 unique cards — **304 full · 79 part · 22 none** |
| Heroes | 2 / 15 fully read · Tokens 7 / 17 |

Your job is to move those numbers **without ever moving the first two.**

**The pool numbers have not moved since v2.40, and that is correct** —
everything between was the engine and the multiplayer layer, which touch no
card text. Phase 3 is where they start moving.

**Two things changed under you since this aid was written**, and both matter
to the card pass:

- **JUDGE!!** is now `engine/report.js` and works on both boards. It captures
  every zone by `name#uid`, both hands, the chain, the feed and the RNG replay
  key, so *"Look Tuff attacked for 4, should have been 3"* plus one saved
  report is a reproducible game rather than a screenshot to squint at.
- **Card effects still only resolve in the SOLO trainer.** `runOps`/`execute`/
  `resolveStack` live in `Battle`; the table runs `judge.js`, which moves cards
  and charges costs but does not read text. **So verify card behaviour in solo
  play**, not at a table, until the effects port lands.

---

## 0. The one sentence version

Make each remaining card do **exactly** what its printed text says — no more,
no less — by teaching the parser to read the language, and prove it with a
drill that would fail if you got it wrong.

---

## 1. Roles, and why there are two of you

The single most important fact this project learned the hard way:

> **The coverage audit cannot see a card being read WRONG.** Four separate bugs
> shipped with `tier: full` before and after. Act of Glory printed +6 and gave
> **+12**. An *arrow* buff landed on a sword. Go again fired against the card's
> own printed condition. Emeritus Scolding dealt **6** where it prints 4.

Coverage counts clauses consumed. It does not check that the consumption was
faithful. That gap is what the second agent exists to close.

**BUILDER** — picks cards off the queue, reads the printed text, teaches the
parser, wires the trainer, writes drills.

**JUDGE** — never writes engine code in their round. Takes BUILDER's diff and
tries to *prove the card is wrong*: stronger than printed, weaker than printed,
or firing at the wrong time. Writes the drill that catches it.

**Swap roles every round.** The agent who wrote the code is the worst person to
audit it, and the agent who just spent a round attacking parser rules is the
best person to write the next batch.

---

## 2. THE GOLDEN RULE, and the one sanctioned exception

**Never invent a card effect. Teach the parser to read the printed text.**

Card text streams from the public FaB card database at runtime. If a card does
something new, the fix is *always* a new clause pattern in `classifyClause` /
`fxParse` that reads its language — because the next card with that wording gets
it free, and a hardcoded card silently rots when the database wording changes.

### When a generic rule genuinely cannot express it: `CARD_OVERRIDES`

`engine/parser.js:676`. This is the guarded escape hatch and it is the **only**
sanctioned way to special-case a card by name. Two conditions, both enforced by
`applyOverride` at runtime:

1. the entry **pins the exact printed text** it was written against;
2. every run re-checks that text against the live card and **refuses itself** —
   falling back to whatever the generic reader produced — the instant the
   database text no longer matches.

```js
"card name|pitch": {
  text: "the exact printed text, whitespace-normalised as clean() does",
  read: (card, fx) => ({ ops:[["arcane",2]], clausesRun:true })
}
```

`clausesRun` marks printed clauses satisfied so the audit tiers stay honest.
Return `null` to decline a sub-case the override does not actually cover.

**Budget your overrides.** An override is a *confession* that the language was
not generalizable. If you find yourself writing a third override with the same
shape, you have found a generic rule — go write that instead. The JUDGE should
challenge every override: *"what wording, exactly, could not be read?"*

---

## 3. NEVER PARSE AHEAD OF WIRING

Reading a clause marks it consumed, which raises the card's tier. **Parse a
clause the trainer does not act on and the audit starts claiming the card
works.** This shipped once (v2.28) and was caught twice more before shipping.

> If you cannot wire it in this round, **do not parse it.** Leave the card
> unclaimed and say so in the round log.

The corollary: a tier that goes *up* without a matching trainer edit is a red
flag, not a win. The JUDGE checks this on every diff.

---

## 4. READ THE WHOLE PHRASE, OR REFUSE

A loose substring match silently drops printed restrictions. This is the second
bug class that keeps recurring:

> **Mounting Anger** — "banish an attack action card from your hand **with cost
> less than the number of Draconic chain links you control**"

A matcher that saw `attack action card` and returned `{type:"attack"}` dropped
the limit, making **any** attack card in hand a legal banish. Strictly better
than printed — the sev-3 *illegal play allowed* category.

Three shapes must **refuse** rather than approximate, each already pinned by a
drill you must not weaken:

| phrase | why it refuses |
|---|---|
| `with cost less than the number of …` | a **dynamic** limit; no printed field expresses it |
| `another aura` | an **exclusion** — a field filter cannot say "not this one" |
| `a card with crush` | a **rules-text** qualifier; filters read printed fields only |

**Look-alike cards are the hazard, not exotic ones.** Mounting Anger and Rising
Resentment share a cost clause verbatim and differ only in the rider. Whenever
you write a rule, grep the pool for its near-twins before you commit.

---

## 5. The BUILDER's loop

### 5.1 Pull the next batch

```bash
node -e "const A=require('./tools/audit.json');Object.keys(A.cards).map(k=>({k,c:A.cards[k],u:(A.usage[k]||[]).length})).filter(r=>r.c.tier!=='full').sort((a,b)=>(a.c.skipped||[]).length-(b.c.skipped||[]).length||b.u-a.u).slice(0,8).forEach(r=>console.log((r.c.skipped||[]).length+' unread · '+r.u+' decks · '+r.c.tier+' · '+r.c.name+' [p'+(r.c.pitch||0)+']\n    '+(r.c.skipped||[]).join(' | ')))"
```

Sorted by **fewest unread clauses, then most decks affected** — cheapest real
wins first. `AUDIT.md` has the verbatim clause text; `STACK.md` says which
mechanic a gap is waiting on; `tools/rulings.json` holds 119 recorded human
rulings — **check it before asking a question that has already been answered.**

**Take 3–5 cards per round. Not more.** A big batch makes the JUDGE's review
shallow, and a shallow review is how all four historic bugs shipped.

### 5.2 Read the printed text verbatim

From `AUDIT.md` or `tools/audit.json` — never from memory, never from another
FaB implementation. If a printing's reminder text would settle a question, the
card **images** carry reminder text that `functional_text` does not.

### 5.3 Decide: generic rule, or override

Generic is the default. Ask: *would the next card with this wording work too?*
If yes, it belongs in `classifyClause`. If it is a one-off multi-branch
state-dependent gate, it belongs in `CARD_OVERRIDES` with its text pinned.

### 5.4 Write the rule

`engine/parser.js`:

| what | where |
|---|---|
| `classifyClause` — one printed clause → ops | line 28 |
| **whole-clause patterns** (must sit ABOVE the if/when splitter) | line 44 |
| `CARD_OVERRIDES` | line 676 |
| `fxParse` — the whole card, where clause pairs are matched | line 712 |

**The ordering trap:** the `if/when/while` handler splits on the first comma.
Any pattern that must be read as ONE unit goes **above** it or it is silently
lost. This structural fault hid a lot of working machinery once.

Also: FaB prints `gains +1{p}`, `gets +1{p}` **and** `has +1{p}`. Accept all three.

### 5.5 Wire the trainer

`index.html`:

| what | where |
|---|---|
| the bridge (engine exports → bare names) | ~1264 |
| `openPrompt` / `promptQ` drain | ~2190 |
| `runOps` — the op dispatch | 2298 |
| `execute` — declaration, costs, triggers | 2533 |
| `playRx` / `playRxA` — reactions | 2989 / 3074 |
| `resolveStack` | 3118 |
| `tryPlay` — legality gates, cost prompts | 3246 |
| `takeIt` — blocks, clash, defence | 3604 |

Rules of the house, all of which have cost a real bug:

- **`you()`/`opp()` READ, `youMut()`/`oppMut()` WRITE.** `let n = {...s}` is
  shallow; writing `n.sides[0].hp` corrupts a state React already rendered.
- **Rules functions use `act()`/`foe()`**, never `you()`/`opp()` — those mean
  *seat 0*, not *the acting player*. `test/actor.test.js` is the ledger.
- **Never write a side field as a top-level game key.** `{...s, ward}` writes to
  the game object; the side keeps its old value and the write does nothing.
- **Queue prompts, never open them inline** — `n.promptQ = [...]`. The action
  must finish resolving first.
- A prompt spec only carries fields **`buildPrompt` knows about**. Add a new
  field there or it is silently dropped.
- Store the rng back after every draw: `n.rng = rng`.
- Stamp anything entering the graveyard via `gy(turn, ...)`.
- If you add anything to `NEEDED`, **bump `DATA_VER`**.

### 5.6 Drill it — and prove the drill bites

Add to `test/parser.test.js` (or the topical file). Then:

> **Reintroduce the bug and watch your drill fail.** A drill that has never
> been seen red is a guess. This project pins that discipline for the four
> historic bugs; hold yourself to it.

**Gotcha:** `fxParse` memoizes on `name|pitch`. Test cards **must** have unique
`name` fields or results silently collide and produce misleading passes.

### 5.7 Hand off

Write the round log (§8) and stop. Do not start the next batch.

---

## 6. The JUDGE's checklist

You are looking for the card being **wrong**, not for the card being **absent**.
Go through every card in BUILDER's batch against its verbatim printed text.

### 6.1 The five archetypes coverage cannot see

| # | shape | the tell |
|---|---|---|
| 1 | **VALUE-DOUBLED** | one printed number applied by two paths — a `+N{p}` read by both a `buffNext` rule and the whole-text self-pump fallback |
| 2 | **RESTRICTION-DROPPED** | a printed limit (type, cost, "another", "from your hand") that no op carries |
| 3 | **KEYWORD-UNGATED** | a keyword in `card_keywords` that the text only grants *conditionally*. `card_keywords` is an **index**, not a claim of possession |
| 4 | **`instead` READ AS ADDITION** | `instead` **replaces**. `execute` must suppress the unconditional base op of the same kind |
| 5 | **CHARGED WRONG** | the text is read right and the *cost* is wrong. An **instant costs no action point** (CR 8.1.1 / 8.1.6); go again is a **gain**, not a refund (CR 5.3.5) |

Archetype 5 is invisible to `npm run fairness` too — the sweep is deliberately
one-sided and that bug made cards **weaker** than printed. Only a human reading
the cost arithmetic catches it. That is you.

### 6.2 Also check

- **Whose "it" is it?** Bull's Eye Bracers: "put an arrow into your arsenal.
  **It** gains +1{p}" — "it" is the **arrow**, not the equipment. Same
  wrong-subject shape as the arrow-buff-on-a-sword bug.
- **The double-faced type line.** Both pool DFCs print *"Runeblade Action //
  Earth Instant"*. You play the **front** face. Any helper answering a question
  about *the card being played* must ask it of `frontFace`.
- **Did the tier rise without a trainer edit?** §3 violation.
- **Is there a near-twin card** that shares this wording and now behaves
  differently, or wrongly inherits the new rule?
- **Is the override justified?** Ask BUILDER what wording could not be read
  generically. "It was easier" is not an answer.
- **Does the new drill actually bite?** Break the code and watch it go red.

### 6.3 Play it

Nearly every bug this project has had was found **in play or by reading**,
never by a red test. Open `index.html`, load the deck the card is in, and play
the card. Verify at **phone dimensions (393×852)**, not a tall desktop window —
one whole bug class only exists there.

The browser caches `engine/*.js` hard and `location.reload(true)` does not
revalidate. Fetch and re-eval the module if a change seems not to have landed.

---

## 7. Validation — the gate every round must pass

```bash
npm test          # 580 drills — must stay green, and go UP
npm run fairness  # must stay clean — run it after EVERY batch
npm run audit     # regenerate AUDIT.md — READ the tier diff, don't skim it
npm run progress  # refresh CARD_PROGRESS.md
```

Optional, cheap, worth it when a batch touched costs or keywords:

```bash
node tools/failstates.js   # how cards go WRONG at the table, ranked by damage
```

**A tier DROP is not automatically a regression.** Three times it was a
*correction*, because the previous number was an over-claim. Read the diff and
decide. Only then:

```bash
node tools/audit.js --write-baseline   # repins the coverage floor. Deliberate act.
```

`npm run audit` runs offline from `tools/.cache/card.json` — no network needed.

**Green tests are the floor, not the goal.** All 580 stayed green through a bug
that broke the page completely, and through all four faithfulness bugs.

---

## 8. The round log — your handoff protocol

Append to `ROUNDS.md` at the repo root. Keep it short; it is a baton, not a
report.

```markdown
## Round N — BUILDER: <agent> · JUDGE: <agent> · <date>

**Cards taken:** Name (pitch) ×N
**Read as:** generic rule in classifyClause | override (reason)
**Wired at:** index.html:LINE — what fires it
**Drills added:** test/x.test.js — "name", proven to bite by <how>
**Numbers:** tests A→B · full A→B · fairness clean/N findings

**JUDGE verdict:** PASS | REWORK — <what, specifically>
**Left unclaimed:** card + the exact phrase that could not be read honestly
**Open question for the human:** <only if genuinely blocked>
```

"Left unclaimed" is a **success line, not a failure line.** A card you honestly
refused is worth more than a card you guessed at.

---

## 9. Budget rules — this project is on a hard budget

1. **3–5 cards per round.** Never a "let me just do the rest" sweep.
2. **Do not re-read large files you have already read.** `CLAUDE.md` is 100KB
   and auto-loads; skim only the sections this aid names.
3. **Do not run `npm run stack`, `npm run sweep`, or regenerate the HTML
   stations** unless you are specifically working that axis. They write
   300KB artifacts and answer questions you are not asking.
4. **Do not open the multiplayer work.** `priority.js` wiring, seat 1's action
   phase and `judge.js` are a different, larger job. If a card seems to need
   them, mark it unclaimed and move on.
5. **Do not refactor.** Not the trainer, not the tests, not the tools. If you
   see something ugly, note it in the round log and leave it.
6. **No commits unless asked.** No pushes ever — there is no remote; the human
   uploads to GitHub Pages manually.
7. **Stop and ask** when: a card needs a rules ruling not in
   `tools/rulings.json`; two readings of a phrase give different games; or the
   JUDGE and BUILDER disagree twice on the same card. One clear question beats
   twenty exploratory tool calls.

---

## 10. Hard constraints — non-negotiable

- **No build step, ever.** Plain UMD `<script src>`; must run from `file://`.
  No bundler, no ES modules, no `package.json` build.
- **One copy of every shared function, and it lives in `engine/`.** Never
  re-declare an engine export inside `index.html` — it shadows the module and
  puts us back to two copies with nothing watching them. `test/sync.test.js`
  guards this.
- **Add a new engine export to the bridge** (`index.html` ~1264) or the trainer
  gets a `ReferenceError` no other drill will catch.
- **Never invent card effects.** If it cannot be read honestly, leave it
  unclaimed.
- **Talishar is an oracle, not a source.** GPL-3.0 — read it to settle a rules
  question, never copy from it. See `TORCH.md`.

---

## 11. Tone

The advisor and log speak like a sharp, warm coach at the table — concise,
evocative, never patronizing. Any game text you write matches that voice.
