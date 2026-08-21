# Dawnblade — changelog

Extracted from the `APP_VER` comment in `index.html` at v2.32, where 19
versions of prose had accumulated on a single 14,723-character line that
shipped to every player on every page load. `index.html` now carries the
version and a one-line summary; the history lives here.

Newest first. `APP_VER` bumps by 0.01 per release (see CLAUDE.md).

---

## v3.22 — one trigger, four tokens, and the weapon half that keeps it honest

**Briar's Embodiment of Lightning needed building, and the census found
it was never one card.** Four pool tokens print the same trigger:

| token | fires on | payload | before |
|---|---|---|---|
| Runechant | attack card **or weapon** | 1 arcane damage | built, by NAME |
| Courage | attack card **or weapon** | the attack gets +1{p} | **nothing** |
| Quicken | attack card **or weapon** | the attack gets go again | **nothing** |
| Embodiment of Lightning | attack card **only** | the attack gets go again | **nothing** |

Runechant worked through `isRunechantEntry` — a name match — and a
hardcoded pop block. The other three read `tier: none` and did nothing at
all; Courage was already on the sweep's "unread and barely named" list.
Building only the Embodiment would have left the same bug twice, which is
the method's rule 4 with a list behind it: **fix the RULE, not the card.**

### The weapon half is part of the printed trigger

Three of them say *"or activate a weapon attack"* and the Embodiment does
not. Dropping that distinction makes Briar's token strictly stronger than
printed — the direction that steals games — so it rides in the parse as
`weaponToo` and is checked at the pop. Driven: on a weapon swing the other
three pop and the Embodiment **stays on the board**.

### Where the pop moved, and why

Two of the four payloads MODIFY THE ATTACK, and the old block fired
*after* `pend` was built — by which point the total is already baked into
the link and its label. The pop now runs just before the attack is
declared, so Courage's +1{p} is part of the declared total.

Runechant's arcane body was **moved, not rewritten**: it keeps its
per-source loop (Pyroglyphic Protection prevents per source, Arcane
Barrier triggers per threat — pooling them pushes through more damage than
the cards print), its `hist.arc` credit, and its win check. A port that
changes behaviour is wrong by definition.

**The firing set is captured before the card acts**, which is v2.23's rule
generalised: a token this very attack conjures was not there when it was
played. That is load-bearing rather than theoretical — Viserai's rite
mints *inside* `execute`, before the pop site, so the new token is
genuinely on the board when the pop runs and survives only because the
set was captured by uid.

### Three drills changed deliberately, and one of them by failing

`test/runechant.test.js` **threw** — *"the runechant pop block moved —
re-anchor this drill"* — rather than quietly measuring nothing. That is
exactly why anchors name what they slice, and it is the good outcome.

The drill pinning `bAct(n).runeDmg` was rewritten, because the mechanism
it pinned is retired. `runeDmg` is a **cache of a card fact**, parsed off
the Runechant record by a second regex at build time, so the divergence it
relied on cannot occur in a real game. v3.07 settled this shape for
`arcShield` and `lifeLock`: *ask the card through `fxParse`, never a
second regex.* The property is pinned harder now — seat 1's tokens print
THREE, seat 0 holds a decoy printing ONE, and only reading the actor's own
board at the printed value lands on 6.

A third drill's probe token carried `tx: ""` and still popped, because the
old pop matched by name. It carries its printed line now: **a token with
no text does nothing**, which is the golden rule working rather than a
regression — nothing can create one without the real database record.

### And the memo bit, in the lucky direction

`fxParse` caches on `name|pitch`, and the pop reads its payload out of
that parse — so a drill giving "Runechant" a 3-damage line poisoned a
later drill using the same name. It surfaced as a FAILING assertion; the
documented hazard is a misleading pass.

```
npm test          1228 drills, 0 failed, 0 skipped
npm run audit     405 cards — 311 full / 72 part / 22 none
npm run sweep     tokens needing a look 9 -> 7
npm run fairness  clean
tools/failstates  0 UNFAIR
```

All four tokens read `full` now, and the number is honest: the clause is
marked consumed because it is WIRED. Rule 2 forbids parsing ahead of
wiring; its other half is that a clause which really is built must stop
reporting as unread.

---

## v3.21 — Briar's Embodiments, and a pool the fixture could not see

**Phase C, hero four.** Briar's one mechanic is visible from her printed
text before a line of code: *both* clauses of "Essence of Earth and
Lightning" mint a token, so the Embodiments are her engine and nothing
else in the deck can matter until they exist.

They did not exist.

### The pinned pool could not see either token

`data/pool.json` is what every tool and every drill reads; the browser
reads the live database. They need the same rule for what to keep, and
for tokens they had two:

| | kept a token when |
|---|---|
| `index.html` (the phone) | the record's **TYPE** says Token |
| `tools/pin-pool.js` (the fixture) | a **NAME** scraped out of card text matched |

The scrape required every word capitalised, so *"create an Embodiment of
Earth token"* captured **`Earth`** — a name no card has. It added it,
matched nothing, and said nothing. **A scan aimed at the wrong shape
passes by finding nothing.**

So the phone could mint both Embodiments while every Node tool and all
1204 drills were blind to them — the fixture and production reasoning
about different pools, each internally consistent. The fix is not a wider
regex: the pinner keeps a token **by its type**, the way the loader does.
764 → 788 records, and no name's spelling can decide whether a card
exists. (The scan is widened too, because `drift.test.js` uses it; nothing
lost, exactly the two Embodiments gained, 17 → 19.)

### The hero ability

Two per-turn latches, and Kayo's neighbour is per *action phase* because
his text says so — they must not be copied onto each other.

**Neither mint site names a token.** The build carries the name read off
Briar's own printed line, the same reason Kayo's clause 2 carries its
magnitude rather than a flag; writing "Embodiment of Earth" into
`effects.js` is inventing card text one level up. That made the passive a
`string`, which was a deliberate widening of `PASSIVE_TYPE`'s ledger.

Earth's three gates each name a way to be wrong: an attack **action
card** (not a weapon swing), that **deals damage** (CR 7.5.5 — prevented
damage is not a hit), to an opposing **hero** (never an ally). *Where the
damage landed is the caller's answer* — judge routes by CR 1.4.5
attack-target and the trainer wires no ally targeting, so a body guessing
inside `linkPayload` would be right on one board and wrong on the other.
The latch lives in the shared body, so **both boards** get it.

Lightning fires on exactly the **second** non-attack — not the second and
every one after, which a `>= 2` test would mint and which is the
direction that steals games.

Each token arrives carrying its own printed clock: Earth's *"at the
beginning of your action phase, destroy this"* is read off the token's
text and swept by `sweepArena`. Both are Auras, which is load-bearing
rather than flavour — seven pool cards count auras generically.

### Two guards, because both failures were invisible

`test/loader.test.js`: **every token name the pool's own text can create
must resolve in the pool.** The scan count is asserted too — a scan that
stops matching returns an empty set, and an empty set satisfies "all of
them resolve" perfectly.

`test/dorinthea.test.js` gained **the other direction**. Its existing
check walks `HERO_STATICS` and asks the build about each entry, so a
passive with no ledger entry was never asked about at all. That is how
Kayo's three clauses reported "unrecognized" for eleven versions after
they were built — and Briar's two repeated it exactly: the ability
worked, every drill was green, and the audit still called the hero
unread. **A one-sided census is a coverage tool wearing a judge's coat.**

### Driving it found what the suite could not

The token reached the board named **"embodiment of lightning"**, in
lowercase — `resolveEntry` returns the *entry's* name, not the database
record's, so a name captured off the lowercased hero text rides all the
way onto the card. The whole suite was green. It is captured with its
printed capitalisation now.

```
npm test          1219 drills, 0 failed, 0 skipped (live DB cached)
npm run audit     405 cards — 311 full / 72 part / 22 none
npm run sweep     hero abilities 26 -> 24 unread clauses
npm run fairness  clean
tools/failstates  0 UNFAIR
```

Briar's remaining hero "unread" line is **"Essence of Earth and
Lightning"** — the ability's NAME, not a rule. Iyslander, a finished
hero, carries the identical line for the same reason. Recorded, not work.

No `DATA_VER` bump: the loader's rule for what to keep did not change and
`mapDbCard`'s fields did not change. Only the fixture was blind.

---

## v3.20 — "another" is an exclusion, and the offer nobody was reaching

**Sigil of Silphidae is built, and the card that came with it had been
inert for two versions.** Viserai's last buildable card needed three
pieces, and looking for the third found a live bug in a card everything
reported as finished.

### "another aura" — carried, not refused

`optFilter` refused `another <subject>` outright, and that was the honest
answer while nothing could express it: a prompts filter reads printed
fields and cannot say "not this one", and flattening it to "an aura"
offers an illegal choice.

It is carried as `notSelf` now — a **structural** fact rather than a
field. The uid is deliberately not in the parse: `fxParse` memoizes on
`name|pitch`, so one parse serves every copy of the card in the match,
and a uid stored there would name whichever copy was parsed first and go
on excluding that one forever. The **queue site** supplies it as
`notUid`, and a `notSelf` filter that never receives one refuses every
candidate rather than offering the source — weaker than printed, which is
the honest direction v2.04 settled for costs.

**The exclusion is load-bearing on exactly one of the two triggers.** By
the time the LEAVE trigger asks, `sweepArena` has already filed the Sigil
into the graveyard it is banishing *from*: it is an Aura sitting among
its own legal choices. Without `another` it eats itself for a free point
of arcane damage, every turn, forever.

### One printed clause, two schedules

"When this enters or leaves the arena" is one sentence and two events, so
it maps to one trigger name (`entersLeaves`) that two sites answer to —
`execute` when the aura reaches the arena, `sweepArena` when the card's
own printed clock takes it away. A schedule is written per board; the
name is shared and the sites are not.

### THE QUEUE SITE WAS INSIDE `if(attacking)` — and no card that needs it attacks

Building the enters half is what exposed it. The only `optCost` queue
site in `execute` sat inside the attacking branch, and **every
`play`-trigger optional-cost card in the pool is a non-attack** — all
three printings of Condemn to Slaughter. So from v3.18 until now its
printed *"you may destroy an aura you control"* was **never once offered
at either board**.

No tool here could see it. Coverage read the card `full`, because the
clause is consumed faithfully — it counts consumption, not whether
anything ever asks. The fairness sweep is one-sided toward too-strong and
this is too-weak. And the drills could not see it either, because **they
built the spec by hand and passed it to `buildPrompt`**, which measures
the sheet rather than whether anything opens it. *A drill that constructs
its own fixture proves the fixture.* There is a driven drill now.

The three spec literals this would have made became one `optCostSpec` —
the no-mirror rule, inside a single file.

### The tools that had to be taught, not silenced

`RESTRICTION-DROPPED` flagged the finished card, because its model said
"another" is inexpressible. Teaching it that `notSelf` **is** the
expression is the same edit it needed at v3.12 for `fx.modes[].q`; the
check still bites when the flag is genuinely absent, verified by
sabotage. A model that has gone stale and a card that has gone wrong look
identical in a report.

Two drills that pinned the old refusal were changed **deliberately**, and
both said in prose "the reason Sigil of Silphidae is still unbuilt". What
they pin is unchanged: the exclusion must never go missing. There are two
ways for that now instead of one — the flag absent, or the flag present
with no uid — and both are pinned.

### Also settled: the handoff's one open question

`2|Sigil of Suffering|0|` was flagged as needing the printed product,
since the card prints at pitch 1, 2 and 3 and `0` means "the only
printing". **The database answers it:** pitch 1 is printed in **SVI019**
and **SBA023** — Viserai's and Briar's own Silver Age sets — while pitch
2 and 3 exist only in ELE, which neither precon draws from. The resolver
already picks 1, and the v3.14 oracle **does** catch a regression here,
contrary to the note: sabotaged to the highest pitch it names both decks
and both sets. No deck-list change, and the question is closed.

```
npm test          1204 drills, 0 failed (4 drift drills skip without a live DB)
npm run audit     405 cards — 311 full / 72 part / 22 none   (+1 full: the Sigil)
npm run fairness  clean
tools/failstates  0 UNFAIR
```

The coverage baseline was stale since v3.16, so repinning it also moved
Condemn's two entries to `full` — v3.18's work, not this one's.

---

## v3.19 — the log screen says where you are

A small thing asked for from play, and it turned out to have the project's
favourite hazard inside it.

The feed says what just happened and the board says what you hold, and
nothing on screen said which part of the turn you were standing in. In a
training sim the phase **is** the lesson — *"you cannot play that here"*
only teaches something if the player can see where "here" is. So the log
pane now carries a bar: **turn number, and the current phase.**

### Two labels, because the two boards speak different languages

`phaseLabel(mode, bphase, over)` for the trainer, `stepLabel(g, seat)` for
the table. That is not duplication, it is the v2.83 hazard avoided:

> **judge.js seeds `mode` into its opening state and never writes it
> again.** One shared label reading `mode` would print *"your action
> phase"* from the first draw to the last point of life — present,
> plausible, and frozen, which reads as an answer. It is the sev-2 shape
> the advisor was one line from shipping.

So each board's label reads the state its own engine maintains, and a
drill fails `TableBoard` for calling `phaseLabel` at all.

Two details the labels have to get right, both of which have bitten before:

- **`block` splits on `bphase`.** Defending and reacting are different
  windows (CR 7.3 vs the reaction step), and which one you are in decides
  what you may play. Collapsing them would be a label that is technically
  true and useless.
- **"your action phase" is NOT `phase === "action"`.** The combat chain
  lives inside the TURN PLAYER's action phase, so while you defend against
  their swing the phase is still action and simply is not yours.
  `stepLabel` takes the seat, and follows it from either chair.

An unrecognised mode is shown rather than blanked — that is how the next
one gets noticed.

`test/phasebar.test.js` (10), both labels lifted out of the source and
driven. Sabotages verified: pointing the table at the frozen label turns 1
red, and hardcoding seat 0 in `stepLabel` turns 1 red.

1187 → **1197** drills, 0 skipped.

---

## v3.18 — Condemn to Slaughter, and a cost paid out of the arena

> *"Your next Runeblade attack this turn gets +N{p}.*
> *You may destroy an aura you control. If you do, each opponent destroys*
> *an aura permanent they control.*
> *Go again"*

Two of Viserai's cards (pitch 1 and pitch 3 — his list runs no pitch 2,
though the database prints one). The head resolved and **the entire middle
sentence was unread**: `fx.optCost` came back `undefined`, because the
"you may X. If you do, Y" pairing accepted only `banish` and `discard` as
cost verbs.

### Two things make this card different from the optional costs already built

**The cost is paid out of the ARENA.** You cannot destroy a card in a hand
or a graveyard, so the zone is the board — and the default the pairing
would otherwise have fallen back to is the graveyard, which is the
"printed zone wins" bug from v2.29 in a new place.

That makes *"an aura **you control**"* the one phrase a seat-addressed
board zone genuinely restates, so it is consumed. **This is not the
subject-consumption rule being relaxed**, and the drills say so by
example: `another aura`, `an aura you control with cost less than the
number of Draconic chain links you control`, and `a card with crush you
control` all still refuse, each for its own reason (an exclusion, a
dynamic limit, a rules-text qualifier).

**The rider is CROSS-SEAT, and the choice is theirs.** *"Each opponent
destroys an aura permanent they control"* — picking which of their auras
dies would be inventing a decision, so `foeDestroyAura` opens a prompt
addressed to the other seat. That works because `applyAnswer` ends in
`openPrompt`, so a prompt queued from inside a rider's ops opens like any
other. `min:1`: the destruction is mandatory once the cost is paid, there
being no "you may" in the rider. An opponent controlling no aura skips it
and the feed says so — *"nothing happened"* and *"they chose not to"* are
different lessons.

"Permanent" is not a second restriction. An aura in the arena **is** a
permanent; the word is the card distinguishing it from an aura in a
graveyard.

### Also

- **The `play` trigger is wired**, joining `attacks`. Condemn prints its
  optional cost with no trigger prefix at all. `hits` and `defends` remain
  unwired and the parser still names which in `fx.optCost.trigger`, so
  each is a queue site rather than new machinery.
- **The second-person ledger moved 45 → 46**, deliberately and for the
  v3.03 reason: the rider's sheet is titled *"Destroy an aura you
  control"* and a prompt is addressed to ONE side, so "you" is that side.
  Its siblings are the check — the hint names the condemning player and
  the empty-board feed line names the seat, because the table reads both.

### The drills

`test/condemn.test.js` (10). Five sabotages, all verified to bite:
dropping `destroy` from the verbs (2 red), not consuming "you control"
(2), letting the zone fall back to the graveyard (1), addressing the rider
to the wrong seat (2), and making the rider optional (1).

The decline path is the one that matters and it is drilled cross-seat:
decline, and the opponent's board must be **untouched**. Running the rider
anyway is v2.04's free-ability bug wearing a new coat — and here it would
destroy an opponent's card for a cost nobody paid.

One drill was wrong first and is worth recording: `prompt.sel` holds
**indices**, not uids. Passing a uid selects nothing, and the drill then
reports a rider that did not fire — which looks exactly like the bug it
was written to catch.

Coverage 308 → **310 full**, 75 → 73 part. 1177 → **1187** drills, 0
skipped. Fairness clean, UNFAIR 0.

Still open on Viserai (29/32): **Sigil of Silphidae** needs the
`enters or leaves the arena` trigger and the `another` exclusion — which
is buildable now that a prompt carries its source, and is load-bearing
precisely there, because a Sigil that has just *left* the arena is sitting
in the graveyard it would be banishing from. **Beckoning Haunt** is an
X-cost (a recorded refusal class) and **Crown of Dichotomy** is a
two-target ability with no reader.

---

## v3.17 — one description of the beginning of the end phase

**Found by a tool built to answer a different question.** James White is
teasing "FaB 3.0", and `CLAUDE.md`'s claim that this architecture absorbs a
rules revision — *"a rules change is a parser change plus a drill, not a
rewrite"* — is testable rather than reassuring. `tools/crindex.js` tests it:
it indexes every Comprehensive Rules citation in the engine, the trainer and
the drills, then asks one question per rule that is **not** "is it cited":

> a rule cited in CODE and in NO DRILL is a rule this project believes but
> does not check. Change it upstream and every test stays green while the
> game plays the old game.

**63 distinct rules, 866 citations, 50 guarded.** And `CR 4.1.8a` came back
UNGUARDED — cited on *both* boards, in a comment claiming they deliberately
run their end-phase triggers in the **same order** so they cannot disagree.
A claim about behaviour, pinned by nothing.

Reading the two sites to check it found something worse than a disagreement
about order.

### Three CR 4.4.2 events that were not in the shared body at all

`beginEndPhase` existed in the trainer and held Inertia and the arena sweep.
Three more beginning-of-end-phase events sat **outside** it, inline in
`endTurn`, written against `you(n)` — so they ran for seat 0, on one board,
and the table had none of them:

| event | card | at the table | on the trainer |
|---|---|---|---|
| rust destruction | Talishar, the Lost Prince | **absent** — it swung on past the death it prints, forever | seat 0 only, against a literal `3` |
| the idle counter wipe | Dawnblade | **absent** — the blade kept the +{p} counters it prints to lose | seat 0 only |
| intimidate's return | any intimidate | **absent** — a permanent theft | seat 0 only |

All three fail **stronger than printed**, the direction that steals games.
Intimidate is the sharpest: v2.10 fixed exactly this ("the first pass
banished it forever") and it came back on the board nobody had checked.

**None was visible to any card-level tool.** Two are consumed by ops; the
third was a `noop` whose stated reason — *"the end phase already destroys it
at 3 counters"* — named a payload living in one board's inline filter. That
is v3.16's shape one level up, and the audit reads Talishar `tier: full`
before and after this fix. Coverage is byte-identical apart from its
timestamp.

### What changed

- **`effects.beginEndPhase(game, seat)`** — the whole event, pure and
  seat-relative, returning `{game, msgs, ops, fired}` (the contract
  `sweepArena` already keeps, and for its reason: an op is actor-relative
  and the two boards reach `runOps` differently). Six steps in one fixed
  order. Both boards call it and restate nothing.
- **The rust threshold is the CARD's number.** `fx.rustDestroy` off the
  printed line, `parser.rustedThrough` beside `idleCounterWipes`. A piece
  printing 5 must not shatter at 3 because a board's filter said so.
- **`thawFrost` moved into it, ahead of the sweep, and the order is the
  point.** Frostbite prints *"at the beginning of your end phase, destroy
  this"*, so the token is minted with `sd:"end"` and the generic sweep would
  take it. Two readers of one rule: the specific one goes first so the feed
  names the token and says what it cost. The trainer had them reversed —
  state right, lesson silent.
- **`judge.js` stopped assembling the event itself**, which also retired a
  latent `n = sw.game` that only ran when the sweep had something to say.

### The drills

`test/endphase.test.js` (17), plus four repointed. Every one was sabotaged
and every sabotage verified to have changed the file: removing rust turns 4
red, the idle wipe 4, intimidate 3, hardcoding the threshold to 3 turns 1,
and regrowing the trainer's own copy turns 1.

Two are **driven through `judge.reduce`** over Dash's real Talishar rather
than calling the body — the difference between "the shared body is right"
and "the table reaches it", which is the whole finding. The Dorinthea drill
was **upgraded from a grep to a drive**: it used to scan `index.html` for
the trainer's own call, which was the right guard while the call lived there
and was hiding the bigger thing — that the call lived *only* there.

`test/arena.test.js`'s two scans were repointed the same way. They used to
check each board for its own calls to the three schedules, which is what you
write when the event is assembled twice — and it passes happily while the
two assemblies drift.

### The tool's own caveat, learned on its first run

**An `UNGUARDED` verdict is a lead, not a finding.** It measures *citation*
coverage, not *behaviour* coverage, and it misreads both ways: `CR 8.1.3` was
cited in `judge.js` where the rule is `8.1.3a`, whose behaviour is driven
over all fifteen of the pool's defence reactions — guarded, loosely cited
(now tightened). `CR 4.1.8a` was the opposite. The scan also learned that a
range is a run: `CR 4.3.1-4.3.3` cites three rules and an alternation of only
`,` `/` `&` reads one, silently dropping the far end of every range in the
source.

And one for the file of guards aimed at the wrong shape: the first version of
the no-regrowth drill asserted the trainer contains no `rust` at all. It does
— `.cc.rust` styles the counter chip, the chip renderer reads `ct.rust`, and
Dorinthea's deck list contains Valiant Th**rust**. Anchor to the payload, not
the word.

UNGUARDED: 7 → **3**, all three genuine section pointers. 1160 → **1177**
drills, 0 skipped. Fairness clean, UNFAIR 0, coverage 308 full / 75 part /
22 none.

---

## v3.16 — crush runs the card's own rider

**Twelve pool cards across two heroes print a crush rider. Every one of
them ran Boulder Drop's.** Two separate things pointed at the same card:

| | |
|---|---|
| the parser | one rule anchored to the crush **prefix** returned a noop whose text asserts a payload — *"the keyword system forces a card from their hand onto their deck"* |
| the engine | the trigger site pushed a card from hand to deck, **hardcoded**, for anything carrying the keyword |

So Buckling Blow's -1{d} counter, Wee Wrecking Ball's arsenal destruction
and nine others were not merely unbuilt. They were **SUBSTITUTED** — the
card did something real, and something else. And all twelve reported
`tier: full`, because a `noop` counts as accounted for.

This is the blind spot CLAUDE.md names, at twelve cards: *"where a ruling
says a keyword does nothing on its own, `noop` is right; where it
describes real behaviour, `noop` is a mis-filing."* This one described
real behaviour — someone else's.

### Seven built, five refused

The rule now reads each card's **own** payload with the ordinary reader,
and the threshold is the printed number rather than a literal 4.

| built | payload |
|---|---|
| Boulder Drop | a card from hand onto their deck *(the old behaviour, now READ rather than hardcoded)* |
| Short Shrift | they discard a card |
| Buckling Blow | a -1{d} counter on their equipment |
| Wee Wrecking Ball | destroy a card in their arsenal |
| Disable | their arsenal card to the bottom of the deck |
| Fault Line | **all** arsenals to the bottom — the caster's too, because the card says all |
| Flatten the Field | destroy a Seismic Surge they control |

The five that reach into the **opponent's next turn** — Cartilage Crush,
Chokeslam, Debilitate, Crush the Weak, Walk in My Shoes — need a schedule
that does not exist, so the clause **refuses**. They now do nothing and
say so, where before they quietly did Boulder Drop's thing. A card doing
the WRONG thing teaches wrong play; a card doing nothing looks like a card
doing nothing.

### Coverage went DOWN, and that is the number improving

**315 → 308 full.** Seven cards dropped to their honest tier. Drill Shot
went the other way, `none` → `part`, because the -1{d} payload it shares
with Buckling Blow now reads. Same principle as v3.02's Cold Snap: a
number that falls because a lie was removed is the number getting better.

### A payload drill is not a trigger drill

Sabotaging the trigger — disabling the line that fires the rider — left
**every drill green**, because they all called `runOps` on the payload
directly. That is the third time this session the same gap has appeared
(the arena sweep, `attackRx`, now this). Four drills now drive
`linkPayload`, and the sabotage turns them red.

### And a tool that pointed at the wrong seat

Making the clauses honest surfaced **UNFAIR: 2** — Chokeslam, filed
"illegal play allowed". Wrong: its restriction binds the **opponent**
(*"attack action cards **they** control can't gain {p}"*), so leaving it
unbuilt makes the Chokeslam player weaker, not stronger.

`failstates.js` already had the helper — `otherSubject`, with the comment
*"a penalty pattern in it is the controller's upside"* — and it was wired
to one category only. Extended to `illegal-play`, Chokeslam moves to LOST
VALUE where it belongs and **UNFAIR returns to 0**. The finding was
invisible until this version, because the noop had kept the clause from
ever reaching the matcher.

`test/crush.test.js` — 11 drills, four sabotages proven to bite.

---

## v3.15 — an audit of the guard rails themselves

Prompted by v3.13, where a drill had pinned a bug as an expected fact. If
one guard could do that, the rest were worth reading with the same
suspicion. Four checks were run over all 55 drill files.

### 1. Source-scan anchors — clean

**42 anchors, all resolve.** No drill is aimed at code that has moved,
which is the failure this session hit twice while working (`mirror.test.js`
after `activateIfOk` left `index.html`; two Kayo drills after the
start-of-turn sweep was unified).

### 2. Ledgers — live and shrinking

| ledger | state |
|---|---|
| `actor.test.js` PENDING | `["newTurn"]` — was two |
| `sides.js` symmetryGap | 39 — was 41 before v3.09 retired two counters |
| `riders.test.js` census | 19 of 28 — was 7 before v3.10 |
| `wire.test.js` HEADLESS | empty… and that turned out to be wrong. See below |

### 3. A module shipped and unreachable — `engine/actions.js`

The blank reference reducer: six actions over cards with **no rules text**,
written to prove `priority.js` can drive a whole game and that a transport
bug can never be confused with a card being read wrong.

CLAUDE.md said from the start what would become of it — *"when judge.js
lands (Phase B step 6) it replaces this reducer wholesale; net.js takes
`reduce` as a parameter for exactly that reason."* **judge.js landed.** The
table passes `DawnJudge.reduce` at both session sites, and `DawnActions`
then appeared exactly **three times in the whole repository**: its own
factory line and two comments.

Nobody removed the script tag. So **20K of unreachable reducer shipped on
every page load** — and worse, a second quiet rules engine sat on the page,
which is precisely the hazard the HEADLESS list exists to name.

**The module stays; only the script tag went.** Its 21 drills are a
specification for `priority.js` that nothing else provides. `HEADLESS` is
`["actions"]` again, and the paired edit — out of `sync.test.js`'s
`MODULES` — went with it, exactly as CLAUDE.md prescribes for a module
crossing that line in either direction.

### 4. Negative source scans over a slice — one found, one fixed

A negative assertion (`assert.ok(!/…/.test(src))`) passes **for free** if
the thing it scans is empty. Over a whole file that is safe —
`readFileSync` throws if the file vanishes. Over a **slice** it is not:
move an anchor and the drill goes green having read nothing.

Five tests assert only negatives against source; four read whole files.
The fifth, `build.test.js`'s "buildSide takes no seat argument", sliced
between two anchors — so renaming either would have silently disabled all
four of its checks. It now asserts the slice exists and is plausibly sized
before asserting anything about its contents, and moving the end anchor
turns it red.

**Nothing else was found to be stale, vacuous, or unnecessary.** The
priority shadow is still genuinely shadowing (73 `mode`/`bphase` reads
remain in the trainer), and every other loaded module is reachable.

---

## v3.14 — the hero's own set becomes an oracle on the deck list

v3.13 fixed one wrong card. This makes the class of bug findable.

**A wrong card of the right COUNT is invisible to everything here.** The
deck still sums to 55, the hero line is there, the gear is there, the card
text parses perfectly, and the fairness sweep compares each card to its
own printing and finds nothing amiss. Every existing check passes.

But there is a partial oracle sitting in the data: **each hero's Silver Age
set essentially IS their precon.** So two questions can be asked, and both
now are:

| direction | catches |
|---|---|
| a deck card at a pitch its hero's set never printed | v3.13's bug exactly — Chimera at yellow when SEN prints red and blue |
| a set card that appears in no deck | a card silently swapped for another, which leaves a hole on the other side |

Verified by sabotage in both directions. Restoring `\|2\|` fails the first;
swapping one card for another of the same count fails the second (along
with three type-census drills, which is a pleasant surprise).

**Stated as partial, because it is.** A precon legitimately contains shared
cards printed in OTHER Silver Age sets — every Nullrune and Blade Beckoner
piece — so this can only speak about cards the hero's own set printed. It
is not a substitute for the printed product. It is the difference between
zero automated coverage of deck-list correctness and some.

### The two documented absences

The reverse check finds exactly two cards a set prints that no deck lists,
and they are the two CLAUDE.md already names as **minted at runtime**:
**Crouching Tiger** (banished, playable that turn) and **Inner Chi**
(transcend). Both are in the loader's `NEEDED` list precisely because no
deck contains them. The oracle finding those two and nothing else is a
good sign that it is measuring what it claims to.

**And it asserts its own work.** `compared > 400` — a check that examines
nothing also reports zero, which is the failure mode this repo keeps
paying for.

---

## v3.13 — a deck-list error, and the guard that had legitimised it

**Reported by a player**, checking Enigma's list against fabrary: the
yellow Enigma Chimera isn't in the precon. They were right.

| pitch | printings | in the Silver Age Enigma set? |
|---|---|---|
| 1 red | DRO020, MON098, **SEN010**, TNP058 | ✓ |
| **2 yellow** | MON099, PSM027, TNP059 | **none** |
| 3 blue | MON100, PSM028, **SEN021**, TNP060 | ✓ |

SEN prints Chimera at red and blue and never at yellow. Our list had two
yellow copies and **no blue ones at all** — a transcription slip of one
character, `|2|` where `|3|` belongs. The deck still totalled 55, so every
count-based check passed; the wrong card simply sat there, 7 power instead
of 6, wearing a **Monarch** face in an otherwise all-Silver-Age lineup.

### The evidence was visible and had been written down as a fact

`test/printings.test.js` asserted *exactly one* non-Silver-Age card and
named it:

> *"Enigma Chimera (pitch 2) is the single genuine exception — it has no
> Silver Age printing at all. If this count ever moves, read the diff: a
> NEW name here means a printing regressed, not that the floor changed."*

Every word of that is accurate and it points in the wrong direction. **A
guard that pins an anomaly legitimises it.** The missing face was the
symptom of a bad deck entry, and pinning the symptom turned it into a
specification — the comment even tells the next reader to suspect the
resolver rather than the list.

Worse, I had gone looking at this exact card two sessions earlier, called
it "the one card in the pool with no Silver Age printing", and wrote it up
as a poignant detail. It was a bug I walked straight past because a drill
told me it was expected.

**The floor is now zero.** Every one of the 488 deck and gear entries
resolves to a Silver Age face, with the Dawnblade's Marvel printing the one
deliberate exception (and its own drill). Putting `|2|` back turns the
guard red.

### What this says about the tooling

Nothing in this repo could have found it. The audit reads card TEXT, the
fairness sweep compares a card to its own printing, `decks.test.js` counts
to 55 — and a wrong card of the right count is invisible to all three.
**The only oracle for "is this the right card" is the printed product**,
which means a human with the real decklist. That is worth knowing before
the next fifteen decks arrive.

---

## v3.12 — "Choose 1;" is a choice, and it was being summed

Two pool cards print a modal choice, and the clause loop added **both**
modes:

| card | prints | granted |
|---|---|---|
| Pummel (Bravo) | +4 per mode | **+8** |
| Two Sides to the Blade (Arakni) | +3 per mode | **+6** |

Driven on a real board: **Sledge of Anvilheim went from 6 to 14** where it
should reach 10. A card doing literally double what it prints, on both
boards, since the modes were first parsed.

### The fairness sweep could not see it, and that is a tool bug

`VALUE-DOUBLED` looks for **one printed value applied by two paths**. A
modal sum prints the value **twice** — once per mode — and consumes both,
so there is only ever one path and nothing to compare. A doubling this
plain went unreported for the tool's entire existence.

So the shape gets its own check rather than a widening of the old one.
**`MODAL-SUMMED`** is check 3b, and it is verified by sabotage: disabling
the parser's modal branch makes it report both cards with their printed
numbers — *"prints 4 / 4 across its modes and the card grants 8"*.

`RESTRICTION-DROPPED` also learned that a modal card parks its qualifier
on `fx.modes[].q` rather than `fx.selfQ`. Without that it reported both
cards as unrestricted — **the tool's model going stale, not the card going
wrong**, which is worth naming because it looked identical to a real
finding.

### The board picks the mode — no prompt needed

The printed target restrictions are **disjoint**: a WEAPON attack and an
ATTACK ACTION CARD cannot be the same object, so at most one mode can ever
be legal against what is actually swinging. `attackRx` chooses it.

**Only a mode whose restriction we can READ is selectable.** `attackQual`
reads the words between "target" and "attack", which covers *"target
dagger attack"* and not *"target attack action card **with stealth**"* — so
the second mode of both cards parses no qualifier. Treating that as
"matches anything" would let Pummel pump a card it cannot legally target;
refusing leaves it visibly weaker than printed instead. Same call v2.04
made for unpayable costs: **inert is honest where free is above rate.**

### And the targeted grant carries its rider

*"Target dagger attack gets +3{p} and \"When this hits a hero, mark
them.\""* — Scar Tissue and Spike with Bloodrot, both now `full`. The
rider belongs to the **attack**, not to the reaction: a reaction never hits
anything itself, so `attackRx` stamps it onto the open link where
`linkPayload` fires it if the attack connects.

`quotedOnHit` became a **function declaration** rather than a `const` in
the same pass — the targeted pump rule sits above it in the file and a
`const` arrow is in the temporal dead zone there. Hoisting is the point,
not an accident.

### Measured

Granted riders carried: **15 → 19 of 28**. The nine that remain are honest
refusals — an `attacks` trigger rather than a hit, or a payload with no
reader. Pool tiers unchanged at 315 / 73 / 17; Pummel and Two Sides stay
`part` because their second mode's restriction is still unread, which is
the truth rather than a rounding.

`test/reactions.test.js` grew to 12 drills, three more sabotages proven to
bite.

---

## v3.11 — an attack reaction resolves onto the open link

`linkPumps` has read `{k:"rx"}` layers off the stack since v2.77, and
**only the trainer ever pushed one.**

At the table an attack reaction was played legally, left the hand and paid
its cost — and its pump fell through to `buffNext`. It landed on the
player's **next** attack while the current one resolved for its base, and
the feed announced it:

> *"Puncture: +3 power queued for your next attack."*

Nothing refused. Nothing failed. The number on screen was simply wrong —
sev-2, the category the player **trusts**. **14 pool cards across four
heroes**, eight of them Dorinthea's, which is her entire reaction game.

### The printed target restriction went with it

`buffNext` asks no qualifier, so at the table **Puncture** — *"target sword
or dagger attack gets +3{p}"* — pumped whatever happened to be swinging.
That is v2.30's arrow-buff-landing-on-a-sword, on the board nobody had
looked at. The trainer has refused it since v2.69.

It is a **legality**, not a modifier: a card with no legal target cannot be
played at all. So it moved into `judge.legal`, where the play is refused
before the card is spent. Refusing it after — as a log line, with the card
already in the graveyard — costs the player a card for a play the rules
never allowed, which is the worst kind of dead tap.

### The third shared piece

`effects.attackRx` joins `linkPumps` and `linkPayload`, and the split note
above them already predicted its shape:

| | |
|---|---|
| `attackRx` | the reaction's own resolution — conditions, `rxPump`, the target's go again, and the layer |
| `linkPumps` | everything that changes the total before the wall |
| `linkPayload` | everything the link does once damage is dealt |

**The hand-blocker count is the caller's answer**, exactly as
`equipDefenders` already is. Reprise asks whether a card from hand met the
attack, and the trainer files declared defenders as `{k:"def"}` layers
while judge holds them on `blockH`. A shared body that read either one is
a body the other board cannot call — which is precisely how phantasm came
to be inert at the table for three versions. A drill fails if `attackRx`
ever goes looking for either representation.

### Measured

The same attack that resolved for **7** at the table now resolves for
**10**. Pool tiers are unchanged at 315 / 73 / 17 — every one of these
cards read `full` throughout, because the clause was always parsed
correctly and then *charged* to the wrong attack.

`test/reactions.test.js` — 7 drills, three sabotages proven to bite. Two
Dorinthea drills were repointed rather than deleted, and one of them became
a **drive**: it scanned `playRx`'s source because the rule lived in a
closure, and the rule is a callable function now.

---

## v3.10 — a granted ability rides alongside, so read it

FaB prints a granted ability in **quotes**, which is what makes it readable
rather than guessable: the quoted text is a clause in its own right, so it
goes back through `classifyClause`. The next-attack pump rule has done that
since v2.30. **Three other printed shapes did not**, and each dropped the
rider its own way.

**28 pool cards grant a quoted ability. Seven carried it.** Every card fixed
here reported `tier: full` throughout — coverage counts the clause as
consumed either way, which is exactly why the census had to be written
before the fix.

### A trigger stripped of its trigger is stronger than printed

The worst of it was not the dropping. `^(?:this|it) gains? "(.+)"$` spelled
only **gains**, and the cards print **gets** — so the quoted text fell past
that anchor into the loose payload matchers below, which found the payload
inside it and returned that op **with no `onHit`**:

| card | printed | did |
|---|---|---|
| Bolt of Courage ×2 | *"…gets \"When this hits, draw a card.\""* | drew a card **on play** |
| Engulfing Light ×2 | *"…gets \"When this hits, put it into your soul.\""* | fired on play |
| Hot on Their Heels | *"…gets go again and \"…mark them.\""* | marked on play, **and lost the go again** |

Hot on Their Heels is the one worth staring at: unanchored, it fell to the
loose `mark them` matcher, so the card was **weaker than printed in its head
and stronger in its rider, in the same clause**. CLAUDE.md has said since
v2.12 that FaB prints all three of gains/gets/has and every anchor must
accept all three; this one didn't.

### The count was a boolean

Mauvrion Skies prints **3** Runechants at red, **2** at yellow, **1** at
blue. The reader tested for the bare string `"create a runechant"` — so only
the **blue** copy matched, and `runeHitNext` was a `boolean`, which could not
have carried 3 even if it had. Red and yellow forged **nothing**. Viserai's
own card, and Runechants are his whole engine.

### What was built

| piece | |
|---|---|
| `quotedOnHit` | one reader for the quoted ability, shared by every shape |
| the grant verb | `gains` **and** `gets` **and** `has` |
| `riderOnHit` | routed by `fxParse` — the only place that can see whether the clause also carried a condition |
| `runeHitNext` | a **count**, read off the printed number |

**A gated rider is `condOnHit`, never `onHit`.** Filing Fai's pair as a plain
on-hit would mark the hero on every hit whether or not the Draconic chain
links were ever there — the KEYWORD-UNGATED shape `npm run fairness` exists
to catch.

**And an unreadable rider refuses.** Display Loyalty's rider triggers on
*attacks*, not hits — a different schedule; Goon Tactics' payload has no
reader. Both keep their printed head and claim nothing else, which leaves
the gap visible in the audit instead of hiding it behind a guess.

### Measured

**Riders carried: 7 → 15 of 28.** Eight cards across four heroes — Boltyn
×4, Fai ×2 (one head-only), Lyath ×2 (one head-only), Viserai ×3. Pool tiers
are **unchanged at 315 / 73 / 17**, and that is the point: not one of these
was visible to the audit.

`test/riders.test.js` — 10 drills, three sabotages proven to bite, and the
census pinned so a regression is a number rather than folklore.

**Still dropped, and named:** the *targeted* grant (Scar Tissue, Spike with
Bloodrot) and the *modal* grant (Pummel, Two Sides to the Blade). Both need
a reaction to attach a rider to the attack it is pumping, which is a
per-board question — where the trainer files `{k:"rx"}` on the stack, judge
holds it differently — and that is the next slice rather than a guess here.

---

## v3.09 — the last two counters become the Auras they print

Frailty and Bloodrot Pox both print **`Generic Token - Aura`**. Both were
side counters — `fra` and `rot` — and each was read in exactly ONE place
inside the trainer, so **at the table neither did anything at all.** Nine
pool cards create them, across three heroes.

Most of what building them took was **deleting** the two parser lines that
intercepted them. The generic token rule underneath already routes "under
their control" to the correct side, and every one of the nine says exactly
that — so **the token sits with the hero it hurts**, with no convention to
invent. The counters were the thing taking the token's place.

Same move Runechant made at v2.23 and Frostbite at v2.74, and it buys the
same three things: the token expires on its own printed schedule
(`sweepArena`, both boards), the seven pool cards that count auras
generically can see it, and there is no bespoke state to keep in step.

### Both were stronger than printed, and RULING was to build to print

| | the counter did | the card prints |
|---|---|---|
| `fra` | a blanket −1 to **any** incoming swing | −1 to attack actions played **from arsenal** and to **weapon** attacks — an attack action from hand is untouched |
| `rot` | an unavoidable, **never-expiring** per-turn drain | a **one-shot** at your end phase, and you may pay `{r}{r}{r}` to shrug it off |

`fra` had **never once been SET in a real game** — its only source, Frailty
Trap, read `none` until v3.08 — so the storage convention it used was
untested rather than settled, and replacing it cost nothing.

### A payment with no window to pause in resolves inline

The first build of Bloodrot queued a `pay` prompt, and **nothing drained
it**: `openPrompt` runs at the tail of `execute`, which the end phase never
calls. The feed said *"it pays out as it goes"* and no damage landed —
completely silent, and found by driving rather than by any drill.

CR 4.4.1 gives nobody priority in the end phase, and this project already
had the ruling for a payment demanded where there is no room to pause (the
trainer's auto-pitch note says so in as many words). So `selfPayOr` resolves
inline, and pays from **floating resources only** — it never pitches on the
player's behalf, because three cards for 2 life is usually a losing trade
and a training sim that quietly makes it is teaching bad play. Floating
resources fizzle at CR 4.4.3e anyway, so spending them costs nothing the
player was keeping.

**`selfPayOr` is not `payOr`.** `payOr` is Cold Snap's shape — "target hero
may pay" — and bills `1-actorOf(n)`. This bills the actor. Same self/foe
pairing `selfDiscard`/`foeDiscard` already keep, and mixing them up hands
the bill to the wrong player behind a plausible-looking prompt.

### Two fields left the side shape

`symmetryGap` goes **41 → 39**. Three counters have now left it — `frost`
at v2.74, `rot` and `fra` here — and all three departures are the same
fact: an integer standing beside a token that is really an Aura on the
board is a second source of truth for something the board already knows.
**The right number of bespoke per-token counters is zero.**

### Also settled this version

Two long-standing questions answered by the user rather than guessed:

- **A clash tie is no winner** — CLAUDE.md had carried "that reading is
  still awaiting confirmation" since v2.07. Confirmed; the caveat is gone.
- **A Trap is played from hand** like any other Defence Reaction. The
  subtype carries no zone restriction, so v3.08's build is complete rather
  than provisional.

`test/pox.test.js` — 8 drills, three sabotages proven to bite.

---

## v3.08 — Arakni's four Traps, and the zone they were sitting in

Den of the Spider, Lair of the Spider, Frailty Trap and Inertia Trap are a
**2x2** — two conditions over two payloads — and all four read `tier:
none`. Not partially read: **nothing**, the whole card.

| the attack this defends | payload | card |
|---|---|---|
| has **go again** | mark the attacking hero | Lair of the Spider |
| has **go again** | Frailty under the attacker | Frailty Trap |
| **{p} above its base** | mark the attacking hero | Den of the Spider |
| **{p} above its base** | Inertia under the attacker | Inertia Trap |

Both payload ops already existed. What was missing was the **qualifier on
the attack**: `^this defends(?: an attack)?$` is anchored, so "when this
defends an attack **with go again**" fell straight past it and the card
was never claimed. One reader, four cards.

**The subject is the incoming attack, and that is why neither condition
reuses `pumped`.** `pumped` asks whether MY attack beat its own base and
is settled in `linkPumps` after the total is struck. These ask about the
attack I am *defending against*, at the moment the trap resolves. Same
words, opposite side of the chain — the same-name-different-meaning trap
`KNOWN_COLLISIONS` polices one layer up, so they are `defGA` and
`defPumped`.

A `pend` belongs to whoever **declared** it, so the ownership test is
load-bearing: drop it and a trap reads its holder's own swing and marks
the wrong hero, with a payload that looks perfectly correct in the feed.
That is the same test `atkMinus` already makes, named rather than
translated.

### And building them made a zone bug visible

`fx.perm` was set off a `\btrap\b` match on the **printed type line**, so
all four resolved **into the arena** and stayed there for the rest of the
game — inflating every permanent count on the board. `types.destination`
has said `grave` for every one of them the whole time.

This is v2.39's ruling — *where `tt` and `ty` conflict, the structured
array wins* — one layer further down than anyone had looked. It is also
why nobody found it: **a card that does nothing is a card nobody
follows.** All four read `none`, so no one ever asked where they went.

Cleared for **any** Defence Reaction rather than by deleting the trap
branch. The defect is not that "trap" was the wrong word; it is that a
reaction is not a permanent whatever its subtype says, and a future DR
printing "Aura" would walk into the identical bug.

`test/traps.test.js` — 8 drills, four sabotages each proven to bite. The
last one is the guard that would have caught this in the first place:
**`fx.perm` and `types.destination` must agree across the whole pool.**
They decide the same question from the two different fields and nothing
compared them.

### Measured

**315 full / 73 part / 17 none**, from 311 / 73 / 21 — every one of the
four, `none` to `full`. Fail states: LOST VALUE 57 → 54, INERT 8 → 7,
UNFAIR still 0.

### Stated, not hidden

Three of the four work on **both** boards; **Frailty Trap's payload does
not.** `fra` is read in exactly one place — the trainer's `foeSwing`,
where the swing is a fabricated scalar — so at the table the counter is
written and never spent. Bloodrot (`rot`) is the same shape, from three
more cards. The Traps' *triggers* are built on both boards; the counters
are the next schedule-per-board job, and the storage convention wants
deciding first: `fra` has never been set in a real game (Frailty Trap
read `none` until now), the trainer stores it on the side whose OPPONENT
is weakened, and the UI paints it as a bad pip on your own status.

---

## v3.07 — the arena has a clock, and it runs on both boards

Five pool cards and fifteen tokens print a self-destruct schedule. The
parser has read the plain form for a long time and `execute` stamps it
onto the board entry as `sd`, so a permanent has been carrying its own
expiry since the moment it entered the arena. What was missing was a
reader — four of them, as it turned out.

| | before v3.07 |
|---|---|
| `sd:"turn"` | swept in the TRAINER only, written out inline inside `newTurn` |
| `sd:"end"` | swept on **NEITHER** board |
| a token | never stamped at all — the mint skips `execute` |
| `…, then X` | the schedule swallowed by a loose temporal-prefix match |

**The "end" half is above rate, not below it.** Concealed Object is a
Lyath Item printing *"Instant - {t}: Target attack gets +1{p}"* and *"at
the beginning of your end phase, destroy this"*. The tap is what makes it
once; the destroy is what makes it once EVER. Never destroyed, CR 4.4.3d
untaps it and it hands its controller a free +1{p} every turn for the rest
of the game. Pyroglyphic Protection is the same shape in the other zone:
prevent 1–3 arcane damage, forever, at the table.

### No tool here could see it, and each missed it for its own reason

Coverage reads both cards `full` — the clause IS read, faithfully, and the
op IS consumed by `runOps`. The fairness sweep is five checks over a
card's PARSE, and this is a defect in the board's turn boundary.
`failstates.js` has a *"no schedule to fire on"* category and fills it by
looking for UNREAD text, so a schedule that parses and then evaporates is
exactly the case it cannot reach.

### Three more, found by finishing the first

- **A token carried no clock.** `execute` stamps `sd` onto a permanent
  played from hand; the mint skips that path. For a token typed `Aura`
  that also inflates every *"auras you control"* count on the board.
- **"…destroy this, THEN X" swallowed the schedule.** Might parsed to
  `[["buffNext",1]]` — payload, no destroy. Same shape as Stir the
  Aetherwinds at v3.00. The trainer had grown a SECOND sweep that
  re-reads the raw printed line to find these three tokens, which is why
  solo play worked and the table had no start-of-turn trigger at all.
  **It is one sweep now**, and a drill fails if either board grows
  another.
- **"Enters OR leaves" is two occasions.** The reader tested for "leaves"
  first and filed the whole payload as a departure, losing the entry.
  Booze! was the only card where that was the card's entire effect — and
  with nothing consuming `onLeave` either, the crowd booed **zero** times
  for a card whose printed job is to boo twice. For Lyath that is a Might
  token per boo, which is his whole engine.

### The payload rides after the destroy, in printed order

That is what lets one sweep pay a departing card without re-running its
on-play statics. Pyroglyphic Protection reads `[arcShield 3, selfDestruct
turn]` and pays nothing on the way out; Might reads `[selfDestruct turn,
buffNext 1]` and pays. No card is named and no kind is stored on the
entry — the printed sentence order does the work.

### And a teardown predicate must ask the card, not a second regex

Both of the trainer's were always FALSE, each for its own reason, and
both were invisible because being wrong in that direction only ever tears
an effect down EARLY — which looks like the effect expiring.

| flag | why it never matched |
|---|---|
| `arcShield` | matched *"prevent N arcane damage that source"*, a wording upstream **stopped printing**. v3.00's drift, in a predicate instead of in a card |
| `lifeLock` | scanned the BOARD for Reaping Blade, which is a **Sword** and lives in `gear` — so any aura crumbling on Viserai's turn silently unlocked life-gain while his sword was still equipped. Both cards are in the same deck |

Both flags are a CACHE of a board fact, so `sweepArena` re-derives them
through `fxParse` over the board and the gear alike. One reader of a
printed line, asked.

### The drills drive, and one of them had to be re-earned

`test/arena.test.js` — 13 drills, every claim proven to bite. The old
Kayo drill that grepped `newTurn` became a DRIVE of `sweepArena`, which
was right about the rule and wrong about the call: deleting the trainer's
sweep afterwards left the whole suite green, because the surviving source
claim only asked whether `sweepArena` appeared in the file at all — and
it appears three times. A drive proves the rule works; only a call-site
claim proves the board runs it. Both are pinned now.

**Also shared at v3.07:** judge.js calls `resolveInertia` and `thawFrost`
at the beginning of its end phase. Both were pure and shared-shaped in
`effects.js` and the table called neither, so Inertia never wiped a hand
there and a Frostbite the frozen seat never spent followed them into the
next turn.

---

## v3.06 — Brain Freeze reaches into the other seat's hand

*"...if you've played an ice card and a lightning card this turn, put an
action card with cost 2 or less from their hand on top of their deck."*
Iyslander's fused rider — the last card of hers anything could be done
about — and the first payload in the project that **moves a card the
acting seat does not own**.

The census first, because one card is not a rule: **four pool cards move a
card to the top of a deck**, across four heroes. Two were already built
(Boulder Drop through Crush, Memorial Ground through a pick prompt); Brain
Freeze and Crown of Dichotomy read `part`. Brain Freeze is now `full`;
Crown of Dichotomy prints a two-target ability nothing here can express
and is left honestly unread.

| piece | where |
|---|---|
| `["foePickTop", {filter}]` | `parser.js` — one payload rule, anchored end to end so a phrase it cannot read refuses |
| `{ty:"action"}`, exact `with cost N` | `optFilter` — the filter's two new printed-field readings |
| `ty` | `promptFilter` — it could ask `tt` and could not ask the structured array |
| `moveFoe` | `buildPrompt` + `applyAnswer` — the cross-seat move |

### The display type line would have mistyped two real cards

`an action card` is the obvious thing to read off `tt`, and `tt` is wrong
on exactly the cards this filter would offer: **Den of the Spider** and
**Lair of the Spider** print `Assassin / Warrior Action Defense Reaction -
Trap`, and both are in the pool. A `tt`-based filter offers a defence
reaction as an action card. `promptFilter` asks `ty` — the same ruling
v2.39 settled for playability, applied to a filter — and a drill fails if
it is read the other way.

### And the prompt spec has to carry the field

`moveFoe` had to be added to `buildPrompt` explicitly. Until it was, the
prompt opened, the right card was offered, the tap registered and
**nothing moved** — the `arsStamp` trap from v2.34, verbatim, found by
driving the flow rather than by any drill.

`test/brainfreeze.test.js` — 6 drills, three sabotages each proven to
bite: reading `tt` turns 3 red, dropping the cost lower bound turns 2 red,
dropping `moveFoe` turns 1 red.

**Also corrected:** Boulder Drop's crush note in the parser still described
the dummy having no action phase — false since v2.71.

---

## v3.05 — an activated ability on a card in hand

*"Instant - Discard this: Amp 1"*. **Four pool cards across three heroes**
print one — Agile Windup (Kayo), Arcane Twining and Photon Splicing
(Iyslander), Reaper's Call (Arakni) — so it is a rule with a list rather
than one hero's card. The route was built in `Battle` at v2.63 and lived
there, so none of the four could be activated at the table.

| piece | where |
|---|---|
| `handAbilityOK` | `effects.js`, **module scope** — `judge.legal` is pure and holds no effects context, the same reasoning that placed `activateIfOk` there at v3.04 |
| `activateHandAbility` | pays the printed cost, runs the ops, **returns** the defence buff |
| the action | `{t:"activate", uid, from:"hand"}` |
| the trainer | delegates, keeping only its own `defBonus` routing |

Two deliberate changes while sharing it:

- **The whole gate is asked.** The trainer's version tested only
  `activateIf.kind === "defending"` — the one restriction its own pool card
  prints — so every other, including v3.04's `unreadable`, went straight
  through.
- **The defence buff is returned, not written.** `runOps` cannot raise
  *one* defender, so a +{d} needs the caller's per-defender map. Same split
  as `linkPumps`/`linkPayload`.

### The fifth card is an impostor

`parseHandAbility` matches to the first period, so **Rally the Coast
Guard**'s printed *"Activate this only while this card is defending"* is
truncated away from `handAbility` and survives only on `fx.activateIf`. A
route built off `handAbility` alone would let it buff defence from hand at
any time — the sev-3 direction.

It is refused, and the refusal names the **printed** reason. Ordered the
other way, a player who simply is not defending was told about a missing
board feature instead of the rule their card prints; a refusal that names
the wrong thing teaches the wrong lesson.

**What this board does not do is said out loud:** Rally's +{d} is refused
by name at the table until judge keeps a per-defender bonus map. Dropping
it silently would be a card that does nothing.

### Tier counts it now

`fx.handAbility` withheld coverage credit from v2.63 to v3.05 — *"the
audit keeps reporting Agile Windup as unread **until its clause is
properly consumed**"*, which is the never-parse-ahead-of-wiring rule
holding the line while only the parser could read it. It is consumed now,
on both boards, so the comment is honoured rather than overridden. Only
the ability's own line is credited: a card whose other text is still
unread stays `part`.

```
npm test          1089 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 310 full / 74 part / 21 none
tools/failstates  0 UNFAIR
```

---

## v3.04 — equipment abilities work at the table, and four printed restrictions start being read

Phase C's next item was a hand-ability route. Censusing it turned up
something bigger first, and then something bigger again.

### 17 abilities, 12 heroes, dead at the table

`judge.legal` refused every non-weapon piece with *"equipment, not a
weapon"*, so no equipment ability could be activated there at all —
Spellfire Cloak, Knucklehead, Predatory Plating, Bull's Eye Bracers,
Pouncing Paws, all of them. Measured by driving it, not by reading.

The same shape as v3.00's phantasm and v3.01's graveyard rule: **the route
existed only in `Battle`, as UI.** `judge` makes the same
`commitPlay(g, ab, "hero", seat)` call the trainer's
`tryPlay(gr.powCard, "hero", i)` makes, so `execute` marks the
once-per-turn flag for both boards and nothing describes an ability twice.

### The gate came with it — and had holes

`activateIfOk` lived inside `Battle`, so **no printed "Activate this
only …" was enforced at the table**. Sharing it meant making it
board-agnostic first: two of its six cases asked `s.mode`, which judge
seeds and never writes, so a straight port would have answered FALSE for
`defending` and `foeTurn` in every step of every table game. `defending`
is asked of the **card's** place in the declared wall now; `foeTurn`
shares one expression with the foeTurn condition, which is the only phase
read left in `effects.js`.

Then the census: **four of the pool's ten printed activation restrictions
were never read.**

| card | why |
|---|---|
| Spellfire Cloak · Achilles Accelerator | the pattern demanded the word *"ability"* the card does not print — and the contraction *"you've"* the v3.00 rewording introduced. Six sibling patterns already had both optional. |
| Scorpio, Comet Tail · Stand Strong | no pattern at all, so the gate was left **undefined** and the ability ran unrestricted |

An unread restriction is filed `unreadable` and **refuses**. v2.04 settled
the same question for costs: inert is honest, free is a card above rate.

### Two side-field writes, one line each, two rules each

`delete act(n).gaNext` removed a field `makeSide` **declares** — that is
`SIDES-ASYMMETRIC`, an error-severity invariant — *and* wrote through the
**read** helper into a side React had already rendered. It never fired
because nothing at the table could reach those lines until this version.
Found by the invariant judge inside a driven game.

### The chair mirror is a band now

It pinned one matchup on one seed, and abilities resolving flipped it.
Measured across five matchups at the same moment: **seat 0 won 5 of 10** —
no bias at all. HANDOFF-MERGE lesson 5, which the *other* chair drill had
already been converted for and this one had been missed by.

```
npm test          1082 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 305 full / 78 part / 22 none
tools/failstates  0 UNFAIR
```

---

## v3.03 — freeze is built, and Iyslander's signature card resolves

v3.02 stopped Cold Snap claiming a mechanic nobody had built. This builds
it, to the ruling's own words — the offer, the choice, the freeze and the
thaw — and it lands on **both** boards.

| piece | where |
|---|---|
| the two printed sentences read as one | `parser.js`, PAIRED where the whole card is visible |
| `["payOr", 1, [["freeze", 1]]]` | declining is what makes the consequence happen |
| a `pick` over **caller-supplied** candidates | `prompts.js` — the freeze spans the arsenal AND allies, two zones |
| the choice reported **structurally** | `applyPrompt` returns `picked`, not just prose |
| the `_frozenBy` stamp | `applyAnswer`, the shared body |
| "cannot be played" | `parser.playableFromZone` — one copy, both boards |
| the thaw | `effects.thawFreeze`, called at **both** turn boundaries |

**The mark records the SEAT, not a deadline.** "Until the start of your
next turn" is stored as *whose* freeze it is, so the thaw needs no
arithmetic — `judge.js` counts `turn` in player-turns and the trainer
counts only your own, and a stored deadline would quietly mean two
different things on the two boards.

**Two seats, and they were inverted first.** `payOr`'s `elseOps` resolve
at the side that was **asked**, so inside the freeze the actor is the
*declining* hero: the objects to freeze are theirs and the choice belongs
to the other seat. Written the other way round it read the caster's own
board and logged *"Iyslander has nothing to freeze"*. The sabotage that
reproduces it turns three drills red.

**Honest about what it does not do:** the *"or activated"* half has
nothing to bite on yet, because allies do not attack. The stamp is on the
board entry and will be read the moment they do — said in the code rather
than implied by silence.

One line moved the second-person ledger 44 → 45, deliberately: a prompt
**hint** is addressed to one side, so "until the start of *your* next
turn" is correct there for the same reason it is correct in a refusal.
The matching feed line names the seat instead.

```
npm test          1076 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 305 full / 78 part / 22 none
tools/failstates  0 UNFAIR
```

---

## v3.02 — Cold Snap stops claiming a mechanic nobody built

Phase C opened on **Iyslander**, and the first thing the census found was
not a missing card — it was her signature card reporting `tier: full`
while doing nothing at all.

```
[noop] "Target hero may pay {r}"
   -> "cost offer — the dummy pays no costs, so it always declines"
[noop] "If they don't, freeze a card in their arsenal or an ally they
        control until the start of your next turn."
   -> "Freeze taxes a play/activation — idle against the dummy's
       scripted swing, same as Frostbite/Inertia"
```

Both reasons stopped being true in **v2.71**, when seat 1 gained a real
action phase and started paying costs. A `noop` counts as **accounted
for**, so this is the no-op blind spot again — the one that hid watery
grave and suspense — and v2.74 had already removed exactly this for
Frostbite, calling it *"a fact about the old training prop and not about
the rules"*. Cold Snap was the last card carrying it.

**Unread rather than approximated**, and the direction is the point.
`payOr` exists and would ask the opponent to pay (Winter's Bite uses it),
but with the freeze unbuilt as its `elseOps` it would ask a question with
**no consequence** — which makes paying strictly a waste, and is worse
than not asking.

So the card reports `part`, the coverage baseline is lowered on purpose,
and `tools/failstates.js` names the gap instead of the card looking done.
The two drills that asserted `noop` and `tier: full` were rewritten: they
were pinning the false claim, which is how it survived this long.

### The Iyslander census, for whoever builds her

Her one mechanic is **Ice Fusion**, and it is genuinely built — `fused`
is a real condition, so Aether Icevein (×3) and Polar Cap resolve in
full. What is actually left is five cards, and only two of them are hers
alone:

| card | what is unread |
|---|---|
| **Cold Snap** | freeze — RULED, specced in `parser.js`, not built |
| Brain Freeze | the fused rider's hand-to-top-of-deck payload |
| Arcane Twining · Photon Splicing | `Instant - Discard this: Amp 1` — an activated ability on a card in HAND, the same shape as Kayo's Agile Windup |
| Ice Eternal | X-cost, deliberately unbuilt (the pool's only one) |
| Stir the Aetherwinds | "play your next Wizard non-attack as though it were an instant" — exposed by v3.00's rewording, unread on purpose |

**Freeze needs no machinery that has to be invented**, and the spec is
written into `parser.js` where the noop used to be: `payOr` for the
offer, a `pick` that reports its choice structurally over
caller-supplied candidates (two zones — arsenal AND allies — the way
`target` already takes them), a `_frozen` stamp honoured by
`playableFromZone` and the activation gate on **both** boards, and a
thaw beside `effects.tickSuspense`, which is that schedule.

```
npm test          1070 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 304 full / 79 part / 22 none
tools/failstates  0 UNFAIR
```

---

## v3.01 — PHASE B: the UNFAIR block is empty

Two keywords, eleven cards, and both were the **no-op blind spot** — the
keyword parses to a `noop`, a noop counts as accounted for, and so every
one of the eleven reported `tier: full` with its mechanic ignored.
Neither `npm run audit` nor `npm run fairness` can see that by
construction; `tools/failstates.js` is the only tool that asks.

```
UNFAIR   16 (v3.00, and 17 by the sweep's count)  ->  0
```

### Watery grave — the drawback, and the hole under it

Six Pirate Necromancer allies print it, and Gravy Bones replays them from
the graveyard once a blue card has hit it. The **upside** was live. The
drawback was not, so those six were an infinite loop.

RULING 2026-07-25, verbatim: *"Because gravy can often play allies from
the grave - they must be turned face down when they die so they can not
be used infinitely. allow the player to check their own faced down cards
but not their opponents."*

An ally that dies is stamped `_fd` on the way into the graveyard,
`parser.playableFromZone` refuses a face-down card, and `GravePane` shows
you your own face-down cards and a **back** for theirs.

**BUILDING IT FOUND SOMETHING MUCH BIGGER.** The rule that decides whether
a graveyard card may be played *at all* lived in `playables()` — the
trainer's UI — so `judge.legal` never had it. Driven: a vanilla Brutal
Assault, no watery grave anywhere near it, went from the graveyard
straight onto the combat chain with `legal` returning `null`. **Every card
in a graveyard was playable at the table.** Sev-3 *illegal play allowed*,
over the whole pool rather than over a keyword — and the same shape as
v3.00's phantasm: a rule that exists on one board only, because the board
that has it keeps it somewhere the other cannot reach.

Two more, both the loose-predicate family:

- the gate read `hasKw`, which is "appears ANYWHERE — list or text". The
  hero prints "cards **with** watery grave", and three pool cards only
  *ask* about it (Jittery Bones, Compass of Sunken Depths, Washed Up
  Wave) — all three were replayable against their own printed text. It
  reads `printedKw` now.
- `fx.fromGY` matched any card that *talks about* graveyard plays.
  Compass of Sunken Depths was the only pool card either flag ever fired
  on, and it is Equipment, which is never played from anywhere. Both
  flags now require the card to grant **itself** the route.

### Suspense — a delay that was being paid as a bonus

RULING 2026-07-25: *"these 'tick' down at the beginning of the turn.
unlike steam-powered it is destroyed immediately when it has none. The
effect activates when the aura is destroyed"*, plus *"suspense always
comes in with 2 counters"*.

There was no arena-departure schedule anywhere, so the payload was queued
**on play**: Act of Glory handed you +6{p} the moment the aura landed
rather than two turns later.

`"when this leaves the arena, X"` is a **departure trigger** now, tagged
`onLeave` the way `onHit` already is. An aura that prints suspense enters
with 2 counters. `effects.tickSuspense` is a pure shared schedule — tick,
destroy at zero, hand the payload back — and **both** boards call it: the
trainer at the top of its turn, `judge.js` in the START PHASE, whose own
comment predicted this ("it becomes a real pause the moment one of them
exists").

**It reintroduced v2.30's VALUE-DOUBLED bug for exactly one edit.** The
whole-text self-pump fallback refuses to fire when an op already read that
same "+N{p}" — and it checks `fx.ops`, so moving the op into `onLeave`
made it blind and the aura paid +6 on the way in *and* on the way out.
The guard reads every trigger list now. Caught by driving the play.

### What is left of Phase B

One entry, and it is not a keyword: **Lyath Goldmane**, *"the base {p} and
{d} of cards you control are halved, rounded up"* — a hero ability, so it
belongs with Lyath in Phase C rather than here.

```
npm test          1070 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 305 full / 78 part / 22 none
tools/failstates  0 UNFAIR
```

---

## v3.00 — THE MERGED ENGINE, and what a fresh clone found

The version that celebrates one copy of the card semantics. It was going
to be Phase A — routing solo to the merged board — and it is not, because
cloning this repo and running `npm test` turned up three things first,
and two of them were live.

**`npm test` on a fresh clone was 749 passes and 304 SILENT SKIPS.** Every
drill that needs a card gated on `tools/.cache/card.json`, a 22MB download
that is gitignored. "1053 green" meant "green on the machine that had
happened to fetch". Fetching it turned nine drills red.

### 1. A card that redirects itself must leave the combat chain with it

Found by driving a whole Viserai/Dash game. Under Loop — *"when this hits,
put it on the bottom of its owner's deck"* — ended up in a deck **and** on
the combat chain, and the duplicate propagated into a graveyard.

The WHERE/WHEN split, again. Two callers file a spent attack at two
different moments and both are right for their own turn structure: the
trainer at DECLARATION, judge.js at the CLOSE step. `bottomSelf` was
written against the first and lifted the card out of the graveyard only,
so on judge's path it found nothing there and pushed a second reference
onto the deck. `soulSelf` had already learned this; the rule existed once
and was missed once. It is `liftSelf` now.

**And the harness that should have caught it was parked.** The census walk
could not answer a boost pending, so from v2.84 every Boost card was a
wall it walked into: the Viserai/Dash seating stalled on turn 1 with 3,591
unread refusals, and the drill went green because it filtered `errs` to
INVARIANT and no card can be in two zones when no card is ever played.
**A walk that stopped walking passes a census by finding nothing.** It
answers boost now, asserts it FINISHED, and drives four seatings.

### 2. The card database is somebody else's `develop` branch

Upstream ran an editorial pass between v2.84 and v3.00: contractions
expanded, "it" resolved to "this", "its owner's deck" to "your deck", "or
greater" levelled to "or more". **138 of this pool's 405 cards were
reworded.** The parser survived 116 and **22 stopped resolving** — plus
seven of the fifteen hero abilities and the Inertia token.

Nothing invented a new rule; the same effect is spelled differently. And
nothing reported it. `npm run audit` measures COVERAGE and printed the
new, lower number without comparing it to anything. `npm run fairness` is
one-sided toward cards STRONGER than printed, and a card that stops being
read is weaker. `npm test` was green, because it had skipped.

```
data/pool.json      764 records — every card the pool can reach, whole,
                    with `printings` slimmed to the fields mapDbCard
                    reads. FETCHED DATA, NEVER AUTHORED.
tools/pin-pool.js   writes it; --check fails if it is stale
test/drift.test.js  the one drill allowed to read the live wire
```

**The suite now reads the pin: 1060 drills, and every card drill runs
offline.** The only skips left are the four in `test/drift.test.js`, which
need a live database on purpose. The GAME still streams it at runtime —
pinning the fixture must not pin the player, or errata stop reaching
anybody.

The drift guard compares **what the parser makes of** each database, not
the text: upstream's wording is upstream's business, and a rewording read
identically is not an event. It fails only when one costs a card, and
names the card, the tier it fell to and both texts. It covers cards,
**hero passives and tokens** — written for deck entries alone it would
have missed Dorinthea, whose ability stopped being recognised entirely.

**Both wordings are read, and not for tidiness.** `DATA_VER` keys a
localStorage cache, so a player who opened the game last week still holds
the old text while a player opening it today gets the new. The two
populations coexist until every cache turns over. One levelling table in
`parser.js` for the recurring idioms — each entry a synonym of one printed
form, never a change of meaning, which is why `has` is levelled only where
it governs a pump and never where it asks a question — plus 13 anchors
widened where the two wordings are genuinely not synonyms.

Coverage is back to **305 full** from 286. The 306th is deliberate: Stir
the Aetherwinds' `full` was an **unanchored match** swallowing an
instant-speed grant it never modelled, and upstream splitting the sentence
in two is what exposed it. Its bonus-arcane half is read; the grant is
left UNREAD rather than nooped, and the baseline is lowered to `part` —
the honest tier. A noop counts as accounted for, and the card would go
back to claiming it works.

### 3. Phantasm did nothing at the table

`effects.afterDefenders` — which is phantasm, entire — was only ever
called from `index.html`. Driven, a 6-power blocker met Spears of
Surreality, the feed printed *"a single 6+ power blocker pops this
attack"*, and the attack resolved for 2 anyway.

The same split in the reader rather than the writer: `afterDefenders`
looked the wall up itself, as `{k:"def"}` entries on `stack`, which is the
trainer's representation. The wall is the **caller's** answer now, and
judge.js calls it on the defend → reaction transition (CR 7.3.4 → 7.4),
closing a popped link through `closeChain` so a destroyed attack still
lands in exactly one zone.

**And the tool that grades it read the wrong file.**
`tools/failstates.js` counted a keyword's mentions in `index.html` — which
the semantics left in v2.53. With its own regex: phantasm 2 there and 11
across the engine, watery grave 2 and 13, suspense 2 and 11. All three sat
under the ≥3 threshold, so **all 16 UNFAIR entries were one scan aimed at
the wrong file.** A source scan aimed at the wrong file passes by finding
nothing; this one failed by finding nothing.

Repointing it alone would have been worse than leaving it — the count
would then have cleared the whole block, including two keywords nobody
built. So the **ledger outranks the grep**, and a **drawback is held to a
higher bar than an upside**: suspense is `pending` and stays UNFAIR;
watery grave was recorded `live` when only its upside is (nothing turns a
dead ally face-down, which is the entire reason its ruling exists) and is
corrected to `partial`, which counts as built for meaning and never for a
drawback.

**UNFAIR goes 17 → 11**, and the 11 are two real groups — 6 watery grave,
5 suspense — rather than a threshold artifact. The phantasm cards left
because they were fixed.

### What this version deliberately does NOT do

**Solo still routes to `Battle`.** Phase A's remaining step is one line;
what stops it is that retiring the trainer retires the TUNED `[3,4,5]`
escalation with it, and the table's dummy is measured winning 11 of 15.
Flipping the default without a play session ships a known regression to
the default experience, and tuning is a play session rather than a drill.
The routing is unchanged and the decision is recorded rather than taken
quietly.

```
npm test          1060 green (4 drift drills skip without a live DB)
npm run fairness  clean
npm run audit     405 unique pool cards — 305 full / 78 part / 22 none
tools/failstates  11 UNFAIR (6 watery grave, 5 suspense)
```

---

## v2.84a — housekeeping: the shared feed stops naming the training prop

Low-hanging fruit found by asking what a line reads like with a **person**
in seat 1. `engine/effects.js` is reached by both boards and hardcoded
"the dummy" in six player-facing strings:

```
"Frailty — dummy's next swing -2."
"Crush lands, but the dummy's hand is empty."
"it's your turn, not the dummy's"
```

At a networked table those describe a human being as the training prop.
All six now read `foe(n).name` — and because the trainer's dummy is
literally called *The Dummy*, **the trainer's own wording is unchanged**.

`parser.js` carried the same sentence at PARSE time, where no game state
exists to name anybody, so that one is seat-neutral instead. Two copies of
one sentence is a small mirror; both were fixed.

Pinned in `test/judge.test.js` and sabotaged. The guard **excludes the
keyword LEDGER notes by name** rather than tolerating them with a loose
regex — those describe the prop to a reader of `AUDIT.md` and never reach
a player. They are also **stale** (several say the dummy pays no costs or
has no action phase, both false since v2.71), which is a docs job and is
now written down as one rather than left as folklore.

Driven check: a full Kayo-vs-Dorinthea game produces **227 feed lines and
zero naming the dummy**.

1053 drills green.

---

## v2.84 — boost, and the third keyword predicate

**The last feature gap before `Battle` can retire.** `judge.js` had no boost
action, so 19 pool printings — every one of them Dash's — could not pay their
printed additional cost at the table.

### The semantics were already shared; only the QUESTION was missing

`effects.js` has resolved boost since the port, off `n._doBoost`. Judge simply
never asked. So this is a pending, a legality gate and two buttons — not a
port.

The printed reminder text, read **off the card image**, because the database
carries none for keywords and guessing one would break the golden rule at the
keyword level:

> **Boost** *(As an additional cost to play this, **you may** banish the top
> card of your deck. If it's a **Mechanologist** card, this gains **go again**.)*

Three things do work in that sentence and all three were already true of the
engine: it is an **additional cost** (settled at play time, beside the
resource cost), it is **optional**, and the go again rides on the **banished
card's type** rather than on the attack's. Payment first, then boost —
matching the trainer, so a player who learns one board is not surprised by
the other.

### `parser.printedKw` — the third predicate

Building it surfaced a real bug, in the direction that steals games.

```
hasKw      the keyword appears ANYWHERE — list or text. Deliberately loose,
           and load-bearing: 58 pool cards grant go again inside a sentence
hasKwNow   ...and no if/unless gates every mention of it
printedKw  the card CARRIES it as printed rules text            <- NEW
```

**An additional cost cannot be conditionally granted.** Boost is printed on
the card or it is not — so *"when you boost a card"* (Hyper Driver) and *"the
next attack you boost this turn"* (Re-Charge!) are **references to the
mechanic**, and `hasKw` answers TRUE for both. Offering their controller
boost's cost is strictly stronger than printed.

The trainer escaped only because `maybeBoost` also tests `isAttack`, and both
cards are Mechanologist **non-attacks**. That is an accident rather than the
rule: a non-attack that genuinely printed Boost would be wrong there. The
discriminator is v2.31's layout rule — a real keyword line stands alone in
the printed paragraph, a reference sits inside a sentence.

### Six sabotages, six bites, and one drill measuring the wrong thing

Every new guard was sabotaged and each edit hash-checked to confirm it landed.

**The go-again drill asserted on the seat's action point, and passed on both
arms.** An attack's action point is charged when the link RESOLVES, in
`linkPayload`, not when it is declared — so both arms read 3 while the attack
sat on the chain, and the drill would have passed on an engine where boost did
nothing. It reads `pend.ga` now, which is the flag boost actually sets.

The census in `journey.test.js` also **asserts the question was asked**.
Without that it passes just as well on an engine that never opens the pending,
because declining and never being asked land the card in the same place.

### Played, not assumed

Dash at the table, 375x812: Crankshaft paid 2, then took the boost with **Out
Pace — a Mechanologist card — on top of the deck**.

```
deck 39 -> 38 · Out Pace -> banish · pend.ga true · 0 invariant failures
"Boost: Out Pace banished — Mechanologist, go again!"
```

**Re-Charge! sat in the same hand and was correctly not offered the cost.**

Known and cosmetic: the boost line lands in the feed *after* the play it paid
for, because `execute` accumulates it into `declNote`. In a training sim the
sequence is the lesson, so it is worth fixing — with the rest of the shared
feed's voice, not inside a commit about boost.

1052 drills green. `npm run fairness` clean.

---

## v2.83 — Claude's call reaches the table

The advisor is the product's namesake and the table did not have it. The
stated reason — it *"would coach card text that does not resolve here"* —
has been **false since v2.77**, when judge.js started resolving every card
effect through `engine/effects.js`.

### What was actually missing, and why it was worse than a crash

`advise` read `g.mode`. **judge.js seeds `mode` into its opening state and
never writes it again** — every game carries both vocabularies, deliberately,
so that neither being present says which engine is driving. So a table game
carries `mode:"act"` from the first draw to the last point of life.

Ported unchanged, the advisor would therefore **not fail**. It would coach,
confidently, off a frozen field: action-phase advice in every step of every
turn. That is the *"displayed value is wrong"* category — the one the player
**trusts** — and no drill that checks the advisor returns a line could see it.

`advisor.advView(g, seat)` derives the window from the CR machine instead,
asking `priority.js` for `canDeclareDefenders` rather than adding a sixth
hand-rolled copy of a CR rule. **Both boards now pass the window explicitly
and `advise` REFUSES without one** — a fallback to `g.mode` would put the
same silent wrongness back one layer down, which is where it would live
longest.

Driven at 375x812 against the vanilla dummy, with `mode` frozen at `"act"`
throughout:

| real window | what it says |
|---|---|
| arsenal (CR 4.4.3b) | *"Arsenal Run Roughshod — it swings again tomorrow."* |
| defend (CR 7.3.2) | *"Block with Unexpected Backhand (3) — take 1."* |

`incoming` comes off `pend.total`, because judge never writes `g.incoming`
either. Seat 0 and local sessions only, both stated in the source rather
than assumed: `advise` reads its own hand through `you(g)` = `sides[0]`, so
deriving the window for seat 1 would coach the wrong player's hand.

### A local win is a win over the same punching bag

`WinPanel` was deliberately not reused at the table because *"a trophy handed
out for beating a person would quietly devalue the case"*. That rule has not
changed — **v2.81 changed who is sitting opposite.** A seat the dummy fills
is always the vanilla pile, so a local win is scored the same way the
trainer's is (turns + wasted, and `wasted` has been kept for both seats
since `priority.endTurn` started fizzling both) and earns the same pull. A
networked win is still over a person and still gets honest words and no
reward.

Verified by playing: a 26-turn game won on life at 2 life, `best: {kayo: 29}`,
the trophy in the case, **zero invariant failures**.

### Found by playing, not by a drill

The dummy's own payment appeared in the shared feed as *"Brutal Assault
costs 2 and **you** hold 0"*. The distinction is real and both halves are
load-bearing:

```
say(...)         goes into feed, which BOTH seats read   -> NAME the seat
return "reason"  goes back to whoever acted              -> "you" is right
```

11 refusals were already right; 3 log lines were not. The wider census found
the same defect in `effects.js` — **44 literals, a real share of them
refusals where "you" is correct**, so telling them apart is a judgement per
line rather than a regex. That is a separate pass and it is a **pinned
ledger**, not a silent fix.

**The ledger pins the SOURCE, not a game's output.** The obvious version
counts second-person lines in a driven feed, and that count is emergent — 3
on one seed, 4 on the next — so pinning it would turn every honest card fix
into a red drill. That is HANDOFF-MERGE.md's lesson 5 in a fresh disguise.

### Burned

`foePick`/`foePlay` — **103 lines**, dead since v2.81 made the dummy always
vanilla, still reading as live rules. Their drills are replaced the way v2.81
replaced the picker's: with the claim that matters, that none of it is
there. **Except the go again arithmetic, which was REPOINTED at `execute`**,
where the rule actually lives and is asked of the *acting* seat — a rule with
no drill is worse than a drill aimed at a retired copy.

`sync.test.js`'s load-order guard now **reads each module's factory
arguments** instead of a hardcoded triple that was true when written and
silently stopped being the whole truth. Sabotaging it surfaced a dependency
the old list never knew about: `invariants.js` -> `priority.js`.

### The drill that passed by finding nothing

The first version of the driven feed check built `newMatch({builds:[null,null]})`
— two heroes with no deck and no hand. It ran **101 turns and produced 1002
feed lines, every one an end-phase step, and not one payment**, then asserted
`feed.length > 0`. True and meaningless. It was caught only because the source
scan beside it went red under the same sabotage. It drives two real precons
now and **asserts it saw a payment before asserting anything about how one
reads**.

The `APP_VER` comment is one sentence again — it had reached 2,969 characters
and 12 versions, which is exactly the drift v2.32 extracted this file for.

1046 drills green. `npm run fairness` clean.

---

## v2.82 — what two tabs found

**Played a real game against myself over the public relay** — two tabs,
PeerJS, host and guest. Everything the engine does was right; everything
wrong was on the one screen that serves two masters, and **no drill in
the project could have found any of it**, because `Loadout` is the solo
sideboard AND the table's board step and every drill only ever asked it
the solo question.

| what | whose |
|---|---|
| the scout panel showed **The Dummy at 42** where a person was sitting | pre-existing — the panel read `oppH`, which is null for a networked game, so it fell through to the prop |
| **two buttons offering to start a solo game** on the table's own board step, one of them against the dummy, mid-negotiation | v2.81's, from making the table button unconditional |
| the blurb still said **"card text does not resolve yet"** | stale since v2.77 |

A networked sideboard now shows the opponent's real portrait and printed
life, and offers one button that says what it does: **Lock the
sideboard**. All three are pinned, and all three were sabotaged.

### What the session proved

```
lobby     hero → throw → sideboard, both seats, write-once
combat    play → pay → declare → defend → reaction
sync      9 commits · 0 desyncs · 0 resyncs · 0 nacks
snapshot  10.8KB, against the pinned 16KB budget
```

Every rule that matters showed up on screen. The **pitch was demanded,
not banked** — Rally the Coast Guard costs 2 against 0 resources, so the
payment opened and `Pitch & play` stayed refused until enough was
selected; that is the affordability gate, and it looks exactly like the
live-lock it is not. **CR 7.3.3** appeared as prose rather than a dead
control: *"declare your blockers — Kayo still holds priority"*, becoming
**Done defending** the moment the attacker passed. Both peers held the
same hash at every single commit.

### And two drill anchors that were wrong

Found while pinning the fixes, both the shapes this project keeps paying
for: `indexOf('<div className="featfoe">')` matched the FIRST of two, in
`Battle`'s featured-card area rather than the scout panel; and an anchor
built from the explanatory comment above the action bar could never
match, because `CODE` strips comments before scanning. **A drill that
fails for a reason unrelated to its claim is one edit away from being
"fixed" by weakening the claim.**

1042 drills green.

---

## v2.81 — the dummy is a punching bag, not a hero

**RULING (user, 2026-08-16): seat 1 is either a PERSON, who picks their own
hero when they join a table, or the dummy — and a seat the dummy fills is
always the vanilla pile.** There is no hero the dummy plays as.

The picker is gone: no dropdown, no `oppH`, no branch anywhere asking
which kind of opponent this is. It was never load-bearing, and what it
cost was a branch carried by the trainer, the loadout, the pregame, the
scout panel, the next-swing prediction and the table — the sort of
question that multiplies quietly and is paid for at every later step.

### `build.buildVanilla` — one copy of the deal

The dealing lived inside `Battle`, which made it a second description of
a build sitting where no drill could reach it. It is in the engine now,
and `buildMatch` reads a **null hero key** as the dummy. The seat is
filled differently; it is not a different KIND of seat — same
sub-stream, same place in the uid threading, same build order — which is
what keeps `judge.reduce` unable to tell them apart.

The deck list stays DATA and is passed in, exactly as `buildSide` takes
`d` rather than looking it up; `hp` and `int` are the caller's too, since
42 life is a training prop's tuning and not a rule.

**So both boards now face the same opponent**, and the only thing that
differs between them is which engine is driving — which is precisely what
makes them comparable while `Battle` is still the regression harness.

### The drills that had to change, and what replaced them

Seven went red, which is the guard working. Five pinned the picker (where
it sat, what it offered, that the slot around it was not a button — a
`<select>` inside one swallows its own clicks). They are replaced by the
claim that matters now: **none of it is there**, asserted on `oppH`
appearing anywhere in live code, because a picker comes back one branch
at a time.

Two were retargeted rather than deleted, and both got *stronger*:

- the passive ledger read `DUMMY_BUILD`'s literal out of `index.html`; it
  now drives `buildVanilla` and asserts every entry in `PASSIVES` is
  answered rather than `undefined`;
- the next-swing prediction was gated on there being no real hero (v2.65,
  after the board announced "NEXT SWING 3" while a hero swung for 7).
  With the seat always vanilla there is nothing to gate on, so the honest
  claim is the stronger one: **the number displayed is the same
  expression `foeVanilla` swings.** A prediction and a swing that compute
  separately is how they drift.

### Driven, not assumed

All 15 heroes play a full game against the vanilla dummy through the
merged engine: every game ends, **zero invariant failures, zero
refusals**. Verified in the browser at 375x812 on both paths — the
trainer opens on the scripted `INCOMING 3`, the table seats The Dummy at
42 with its four Ironrot pieces and 26 left in deck.

**One honest finding, and it is a tuning matter rather than a bug:** at
the local table the dummy wins 11 of 15. At 20 life it still wins 8, so
it is not the life total — a deck with no rules text suits a policy that
reads no card text, and `sparring.act` plays 30 vanilla attacks better
than it plays a real hero's deck. The TRAINER is unaffected and still
runs the tuned `[3,4,5]` escalation. Retuning the table's seat is a play
session, not a drill.

1039 drills green. `npm run fairness` clean.

---

## v2.80 — the gate `Battle` retires behind

**`Battle` does not retire until the merged path passes the same drills.**
That rule has governed the whole merge, and the five drills it names —
`kayo`, `dorinthea`, `frostbite`, `arcane`, `paytoll` — now pass driving
`judge.reduce`. The gate is PASSED, which unblocks retiring `Battle`'s
rules; it does not retire them. That is still the next step, and it is
still 97 `mode`/`bphase` references and a `setG` replacement that has to
keep the invariant-judge funnel.

### What the hand-rolled contexts were hiding

Each of the five carried its own ~20-key `ctx()` literal — the no-mirror
rule broken in the drills instead of in the engine. It had already
drifted, in every direction at once:

| stub | what it meant |
|---|---|
| `dummyDefence`, `built` | dead keys — neither has been in `CTX_KEYS` since v2.73 / v2.77 |
| `mkRune: s => s` | a runechant was never minted |
| `openPrompt: s => s` | a prompt never opened |
| `winCheck: s => s` | nobody ever won |
| `had6ThisTurn: () => false` | a CONSTANT for the condition half of Kayo's deck turns on |
| `bAct` and `bFoe` returning ONE build | no drill could tell the two seats apart |

`test/helpers/judged.js` is the one way in now: `judge.withEffects`, over
`makeSide`'s shape rather than a partial side literal per file, with the
build on `g.builds` where `bAct` reads it and the database registered
through `judge.setDb`.

### The three things it found

1. **`effCost` IS READ TWICE, and the reads are different questions.**
   `execute` charges the cost; `doPlay` asks whether the seat can AFFORD
   it, and only that second read decides whether a payment opens.
   Nothing drove the second — replacing `doPlay`'s `effCost` with the
   printed cost left every existing drill green.
2. **JUDGE'S WALL HAD NO DRILL AT ALL.** `resolveStack` is the trainer's
   path; judge does not call it, because the body was split so each
   caller keeps its own wall and its own CR 1.4.5 damage routing between
   `linkPumps` and `linkPayload`. All 14 dorinthea drills measured the
   half of the engine the table does not use. Blinding judge's `strike`
   to every declared defender used to change nothing; it now fails two.
3. **A FABRICATED `pend` IS THE ANSWER, NOT THE QUESTION.** `total` was
   supplied by the fixture, so "an attack blocked to nothing does not
   refresh" was asserted by writing 0 into the link rather than by
   anyone blocking, and "it hit, so go again was granted" was asserted
   about a hit the drill had arranged.

### And the guard's own defect, found by sabotaging it

The new guard in `test/sync.test.js` fails any drill file that builds its
own effects context outside the three sanctioned seam files
(`effects.test.js` proves `makeEffects` REFUSES an incomplete context and
must hand it one; `merge.test.js` measures the clone property;
`mirror.test.js` is Battle's context, not judge's).

Written first as `[^.\w]makeEffects\(` — the idiom borrowed from the
bare-name guard beside it, where excluding a property access is right —
it **excluded every call it existed to catch**, and the sabotage that
re-grew a context in a drill file passed. A source guard aimed at the
wrong SHAPE passes by finding nothing, exactly as one aimed at the wrong
file does.

The second half of the guard caught a real gap the same way: kayo reached
judge's context but never the reducer. It does now, with Bare Fangs —
one printed sentence that exercises the draw, the discard that was
silently deleted before v2.55, the `_disc` stamp, the 6+ threshold clause
2 lifts and clause 3's Might token, on one tap.

1032 drills green. `npm run fairness` clean.

---

## v2.79 — a session with no network

**The last thing keeping solo and table apart was not the engine, it was
the way in.** After v2.77 and v2.78 there is one rules engine — judge
drives the CR turn structure and calls `effects.js` for the card
semantics — but the only way to REACH it was `net.js`, a session that
needs a second phone. So a player alone still went to `Battle`, which is
a different engine with the opponent written into the rules as a branch.

`engine/local.js` is the same session with the network taken out. It
exposes exactly the surface `TableBoard` already drives — `submit`,
`state`, `seq`, `hash`, `stats` — so **the board does not learn a second
way to play a game**. net.js's own `loopback()` proved that shape was
enough for two peers; this proves it needs no channel at all.

What makes it a game rather than half of one is the other seat. It takes
a `policy` — `sparring.act` — and after every accepted action lets that
seat act until it has nothing left to say. **Solo, hotseat and network
now differ only in what is calling `reduce`**, which is what the whole
rebuild was for.

### Three rules it keeps, each because breaking it cost something

| | |
|---|---|
| the policy proposes, the judge disposes | every policy action goes through the same `reduce`, and a refusal is RECORDED rather than swallowed. `sparring.js`'s contract is that a refusal is always a bug in the policy, and a session that ate them would make that unenforceable from the only place it can be enforced |
| it never answers for the player | a sheet addressed to the local seat stays live and waits. A session that helpfully answered your prompt would be making your decisions |
| it terminates | the policy loop is bounded and a bound that is hit is reported as a **stall** rather than spun on. An unanswerable prompt is a real failure mode — it turned seven drills red in v2.78 — and it has to look like one |

The stall drill is the one that is driven against a **stub reducer**, and
deliberately: against the real judge a repeating policy is stopped by a
REFUSAL long before the bound, so the drill would have passed without the
bound existing at all. That was its first version.

### `sparring.js` is on the page, and the HEADLESS ledger is empty

It stayed off for as long as nothing called it — a thing that proposes
actions sitting beside a trainer with its own dummy is the second quiet
engine that list exists to name. `local.js` calls it. Coming off
`test/wire.test.js`'s HEADLESS list is the same edit that adds both
modules to `test/sync.test.js`'s MODULES, which is what keeps the guard
from going dark.

### How you reach it

A **second button** on the sideboard screen: *Fight at the table — one
engine*. It needs a real hero opposite, because the vanilla Dummy is 30
Generic attacks and a scripted escalation with no build to sit in a seat
with.

It is a second button rather than a replacement, deliberately. **`Battle`
is the regression harness and does not retire until the merged path
passes the same drills**, and the `[3,4,5]` escalation it runs is TUNED
where a real hand of cards is not. Retuning is a play session.

### Played, not just drilled

Kayo against a real Dorinthea, on the phone: her Dawnblade equipped, the
end phase running (c)-(f) in the CR's order with the first-turn-only
both-draw, and on her turn 2 she pitched Puncture for 3, paid for Wreck
Havoc and put 6 power on the chain — leaving the defend step with the
turn-player's priority slid to me after her pass, which is CR 7.3.3
exactly. Invariant judge clean throughout.

**1025 drills green.** Fairness clean.

---

## v2.78 — the table can answer a prompt

**v2.77 gave the table card text; this gives it the half of card text
that stops and asks.** Prompts have been addressed to a SIDE since v2.17,
and until now only the trainer could resolve one — `promptConfirm` was a
`setG` reducer inside `Battle`. That is not a missing screen. Several
cards defer their **whole payload** into the answer: `arcaneHit` rides the
damage out on a soak, and a printed "unless they pay" hangs its
consequence off a toll. An unanswerable sheet is arcane damage that never
lands and a printed cost that is never charged.

| moved | to | why |
|---|---|---|
| the prompt ANSWER | `effects.js` `applyAnswer` | it is more than plumbing — it borrows the actor to the addressed side (v2.65's free action point), it pitches for an unaffordable payment rather than forgiving it, and it does the arsenal face-up stamping, which is a real card rule |
| `autoPitch` | `effects.js` | the answer reaches for it: a toll charged on someone else's turn has no other way to find an {r}, and a second copy of "which card do I give up" is a second engine's judgement about one decision |
| `promptDecline` | `prompts.js` | which sheets CAN be declined is prompt data, and both boards ask it now |

### A live sheet stops BOTH seats

That is the point of it: whatever queued the sheet is mid-resolution. The
asked seat may only answer; the other may do nothing. Letting play
continue around it is exactly how a deferred payload gets abandoned.

Which means **every seat must be able to answer**, and at a regression run
or in a local game one of them is not a person. `judge.autoAnswer` is the
answer a seat with nobody in it gives, and it is **never called from
`reduce`** — a policy quietly answering a modal nobody knew was there is
the kind of thing that surfaces in a game weeks later. The session asks
for it; the rules never volunteer it. The two answers that cost real money
delegate to `soakPolicy` / `payPolicy`, the same pure printed-number
policies the trainer already uses for seat 1, so the two cannot disagree
about whether a soak is worth paying for.

`sparring.js` answers a sheet addressed to its seat. **The wall stands** —
it reads no card text; it hands the question to `autoAnswer`.

### The measurement that made this necessary

Adding the gate without the answering turned **seven drills red** —
whole-game drivers, the wire round trip and the chair mirror — all with
the same symptom: *the game never ended*. That is what an unanswerable
sheet looks like from the outside, and it is why "prompts stay live and
somebody will get to them" was not an option.

### And a drill that was pinning a sample rather than a rule

The chair-neutrality mirror was pinned at exactly **6-6**. With prompts
resolving it is **5-7** — still balanced, and the pin would have turned
every honest card fix into a red drill and trained the reader to edit the
number without thinking. It asserts a BAND now (four of twelve to each
chair), because the shape it guards is not the sample: a structurally
weaker seat loses all twelve, and a privileged chair takes ten or eleven.

**1015 drills green.** Sabotaged by neutering the gate: three of the four
new drills go red.

---

## v2.77 — judge.js resolves card text · ONE engine

**Solo play and table play stop being two engines.** `engine/judge.js`
modelled the CR turn structure, the combat chain and the costs, and
resolved no card text at all; `engine/effects.js` held every card
semantic and only the trainer could reach it. That is why solo play ran
every card in the pool and the table ran none. judge.js is now a CALLER
of effects.js and contributes no semantics of its own.

The split before it was deliberate and load-bearing — getting the
orchestration right was the part that did not exist, the semantics
already worked, and keeping them apart meant a control-flow bug could
never be confused for a card being read wrong. What ended it is that the
customer changed: it used to be the networked table, and it is now every
hero of card text that would otherwise have to be written into whichever
engine you point them at.

### What it took, in the order it landed

| | |
|---|---|
| `built` off the context | the last key that named a SEAT rather than a role. Four rules sites read `built.runeDmg` — seat 0's build, captured for the UI — and now ask `bAct`. 18 keys → 17. Supplying it would have written a seat-0 rules read into a brand-new caller. |
| two `mode` strings out | `resolveStack`'s guard was a duplicate of the test the trainer's own wrapper makes one line above the call; the "-N power" shave read `mode==="block"`, which answers FALSE in judge.js — a defence reaction's whole payload would have gone nowhere. |
| the context | seventeen names, sixteen of them already exported here or a two-line adapter. The uid counter is the one that does not fit a pure reducer for free: it lives ON the state, so the context is built fresh per call over a cell and written back. The database is registered with `setDb` rather than carried — it is a lookup table, identical on both peers, and 62KB on a wire that drops large messages silently. |
| `commitPlay` delegates | the zone move, the cost, the colour history, the action point, go again, arena placement and the graveyard filing were all restated in judge.js. Every one was a second answer to a question effects.js already answers. |
| `resolveStack` splits | into `linkPumps` (everything that changes the total before the wall) and `linkPayload` (everything the link DOES once damage lands), with each caller keeping its own wall in between. That is the piece judge.js could never call: it holds defenders on `blockG`/`blockH` and routes damage by CR 1.4.5 attack-target. |

### Three things the census and the drills caught

**AN ATTACK WAS FILED TO THE GRAVEYARD WHILE IT WAS STILL ON THE CHAIN.**
`execute` filed it at DECLARATION — which is not something a card does,
it is what a board with no combat chain to hold a card has to do instead.
Delegating handed that model to judge.js, whose `chainCards` then held
the same card too: 175 pool cards reported `want chain, got grave`, and
in judge it would have been CARD-IN-TWO-ZONES. `fileAttack` is now the
one copy of WHERE, and WHEN belongs to the caller — the trainer files
immediately and is unchanged, judge.js files at the close step.

**GO AGAIN WAS ABOUT TO PAY TWICE.** `linkPayload` charges the attack's
action point (`ap = ga ? ap : ap - 1`, spelled out so CR 5.3.5's GAIN
composes with CR 8.1.1's cost) and judge.js's `resolveLink` also added
one. Two points for one go again is the direction that steals games, and
no coverage tool can see it.

**A DRILL THAT PASSED BY READING TOO MUCH.** priority.test.js sliced
`resolveStack` between two anchors, and its END anchor had gone stale in
v2.73 — indexOf returned -1, so the slice ran to the end of the file and
it passed by reading everything rather than the right thing. Both anchors
are asserted found now.

### Two drills that were asserting things they could not show

- **sparring.js's chair-neutrality drill** ran Kayo against Dorinthea both
  ways and asserted Kayo won both, on the premise that his precon
  out-powers hers "on printed numbers alone with no card text in play".
  Card text resolves at this table now, so the premise expired — and the
  two games were never mirrors anyway, because both seats are built from
  one seeded stream in seat order, so swapping the heroes hands them each
  other's shuffles. Replaced with a real mirror: same hero in both chairs,
  six seeds, both seatings. It splits **6-6**.
- **judge.test.js's driver** proposed a weapon swing it had not checked it
  could pay for, then recorded its own optimism as an engine refusal. The
  card branch had always asked `playableWhy`; the weapon branch read only
  the printed line.

### What is proven, and how

Driven through `judge.reduce` against the real database, asserting on the
board rather than the log: Viserai's rite fires, mints the **printed**
Runechant token out of the card database with a namespaced uid, and the
token then **pops at declaration** on the next Runeblade attack for its
printed arcane — past the wall, because a triggered ability resolves above
the attack that triggered it. A queued "+3 to your next attack" reaches
the chain link. All three sabotaged, file hashes checked.

**1011 drills green.** `Battle` is untouched and remains the regression
harness; it does not retire until the merged path passes the same drills.

---

## v2.76 — the pre-game order matches the rules

**`engine/lobby.js` has ruled this since it was written** — `STEPS =
["fault","hero","throw","seat","board","ready"]`, with the reason stated
in as many words: *"The sideboard comes AFTER the throw on purpose: you
sideboard knowing the matchup and knowing whether you are on the play."*
The table path always obeyed it. **The solo path did the opposite** —
Loadout → Pregame → Battle, so every boarding choice was made before the
throw, and the two facts that make sideboarding a decision were shown too
late to use.

Two descriptions of one rule, and the one nobody was reading was wrong.
That is the shape that let clash fire on the wrong trigger for five
versions.

```
was:  hero -> sideboard -> throw -> game
now:  hero -> throw -> sideboard -> game
```

**The opponent picker moved to the hero screen**, into the P2 slot of the
vs strip, because the throw now needs to know the matchup before the
loadout exists. The vanilla **Dummy stays the default** — 30 Generic
attack actions with no rules text, the one deck where nothing can be
faked. `Loadout` takes `oppH` and `onPlay` as props rather than owning the
choice; a second copy would let the throw and the sideboard disagree about
who is across the table.

The P2 slot had to stop being a `<button>`: a `<select>` inside one
swallows its own clicks, so the picker would have looked fine and done
nothing. The dummy's taunt keeps a nested button of its own.

7 drills pin the ORDER against `lobby.js`'s, not the pixels — a change
there is a rules change. All 9 sabotages verified to bite.

Verified in play at 393x852: hero + opponent → coin → sideboard showing
"You are ON THE PLAY" → Kayo vs Dorinthea dealt correctly, zero invariant
violations, no console errors.

---

## v2.75 — the printed escape hatch exists; Inertia is a hand wipe

Two of the three remaining `noop`s whose stated reasons had expired. Both
reasons were about the old training prop; one was also wrong about the
mechanic.

### "…unless they pay {r}{r}{r}"

**Winter's Bite made a hero holding NINE resources discard without ever
being offered the chance to pay.** `classifyClause` returned BYTE-IDENTICAL
output with and without the second half of the sentence — the same shape as
Strongest Survive in v2.66 — so the escape hatch simply did not exist. It
reported tier `full`, and `npm run fairness` was CLEAN, because the sweep
asks whether a card grants its CONTROLLER more than it prints, not whether
it deleted the OPPONENT'S printed escape.

`payOr` queues a `pay` sheet addressed to the TARGET hero. `prompts.js`
gains `elseOps` — the consequence of declining, without which "unless" has
no teeth. The payload is `selfDiscard`, actor-relative to the asked side,
because a sheet resolves at the actor of the side it was addressed to;
written as `foeDiscard` it would have discarded from the caster's own hand.

The cost is COUNTED off the print — Winter's Bite prints `{r}` on one
printing and `{r}{r}{r}` on another, so a hardcoded 3 would be wrong on the
copy the player drew.

**`avail` moved onto the addressed side.** `openPrompt` used to patch in
`you(s).res` — seat 0's floating resources whoever the sheet was for, and
without counting what they could pitch. A latent seat-hardcoding bug of the
kind v2.25 fixed in the rules helpers; it had never fired because no card
queued a `pay` spec until now.

Seat 1 answers through the pure `DawnEffects.payPolicy`: spend the floating
pool freely, but never pitch the last card in hand to avoid discarding a
card — a seat that pays every toll every time is the shape that made both
seats block 41 of 41 attacks.

### Inertia

The noop said "the dummy has no action phase". The census says the reason
was wrong about the MECHANIC. The printed token:

> "At the beginning of your end phase, destroy Inertia, then put all cards
> from your hand and arsenal on the bottom of your deck."

Not a tax on anything — a hand wipe, and the harshest token in the pool,
which is why two real cards (Lace with Inertia, Inertia Trap) did nothing.
`DawnEffects.resolveInertia` is pure and runs from `beginEndPhase`, ahead
of (a) and (b): it has to land before the arsenal step or the seat is
invited to choose a card that is about to be swept away anyway. Cards go to
the BOTTOM of the deck, not the graveyard, so nothing is stamped `_gy`.

### Notes

17 drills; every sabotage verified to bite with a hash check. Two proved
nothing until sabotage found them — one read `avail` off the post-answer
state, and the policy's affordability guard had no case that needed it
(an empty hand is refused by the last-card rule anyway).

**Still open: freeze (Cold Snap)** — the third noop. Ruled by the user on
2026-08-14 but not built: it needs a `frozen` state with an expiry, a
chained prompt back to the CASTER to choose the target, and a gate on
playing or activating a frozen object.

---

## v2.74 — Frostbite is an Aura; arcane damage has one choke point

**Engine step 3.** Both halves were filed `noop` in `parser.js` with
reasons that were facts about the old training prop rather than about the
rules, and both expired in v2.71 when seat 1 got a real turn.

### Frostbite

`frost` was an integer on the side that NOTHING read — not `effCost`, not
effects.js — and the only writer in the project was one hardcoded line in
`foeTurnIce`. Frost Spike's "create a Frostbite token" resolved to nothing
at all, and because a `noop` counts as accounted for, it and Polar Cap
both reported tier `full`.

Exactly the v2.23 runechant move: the board is the single source of truth
(`parser.frostCount`), so "3 or more auras" can count it and "destroy an
aura" can remove it. The tax lives in `effCost` — already the one place a
card from hand, a weapon swing and an equipment ability all meet, so
"cards and abilities cost you an additional {r} to play or activate"
reaches all fourteen call sites without any of them opting in. The
reduction floors at 0 BEFORE the tax adds, or a spare {r} of discount
silently eats a Frostbite.

RULING (user 2026-08-10): the play that destroys it IS the one that is
taxed. RULING (2026-08-14): three Frostbites make one play cost +3 and all
three shatter on it; a Frostbite is handed to the OPPONENT, and lands in an
exposed armour zone only where the card prints that placement (Frost
Spike), fizzling with none — which makes it weaker, not stronger.

Ice Eternal's "Create X" is REFUSED rather than read as one: its printed
cost is XX, nothing models an X cost, and creating one token for a card
that charges for X is quietly weaker than printed. It stays a visible gap.

### Arcane damage

Driven against the pre-fix engine, **five arcane damage through arcane
ward 3 AND Pyroglyphic shield 3 dealt five.** `awd` and `arcShield` were
written by the parser, stored on the side and rendered as pips — and never
read. Arcane Barrier (21 pieces of iron across ALL FIFTEEN heroes) and
Spellvoid were `noop` for want of an event to hang off. Thirty pool cards
deal arcane damage across six heroes and nothing could stop any of it.

No tool here could see it: every affected card reads tier `full` (read
correctly, then never charged) and the fairness sweep is deliberately
one-sided towards cards that are too strong.

`arcaneHit` is now the one place a hero takes arcane damage, and the order
is free-then-draining-then-paid: `arcShield` (per source, no drain), then
`awd` (one pool), then the printed keywords. The hit is DEFERRED into the
prompt's answer when there is something to ask — prompts drain after the
action resolves, so damage applied at its own site would arrive before the
hero was ever asked.

RULINGS (user 2026-08-14): Arcane Barrier N is prompted, costs the full N
even to prevent less, and the piece survives; Spellvoid N destroys the
permanent instead and costs no resources; every instance triggers. Each
Runechant is its own source, so three are three 1-point threats a hero may
answer three times rather than one 3-point threat. Spellvoid X is refused
— the chain it counts belongs to the attacker, not the frozen hero.

`prompts.js` gains a sixth variant, `soak`, and it is the first whose whole
point is being addressed to the side that is NOT acting. Seat 1 answers its
own through the pure `DawnEffects.soakPolicy` and the same `applyPrompt`
the player's confirm uses.

### Notes

39 new drills; every sabotage verified to bite, with a hash check that each
edit actually landed. Two drills proved nothing until sabotage found them —
the end-phase thaw grepped for an identifier that survived deleting its
gate (rule 4b), and the policy's "already covered" guard had no case that
needed it. Both rules were moved into pure functions and are now driven.

Coverage is unchanged at 306/77/22, which is the point: a `noop` and a real
op both count as consumed.

---

## v2.73 — execute declares, and stops

**The knot the whole Phase 1 rebuild is named after.** `execute` did two
jobs at once: it applied the card's effect AND advanced the turn structure
— calling `dummyDefence` inline and setting `mode:"stack"` itself. That is
why the table could never call the card semantics: `judge.js` drives combat
through `phase`/`step`/`chainCards` and has no dummy to ask.

```
execute  ->  _declared?  ->  defend step  ->  afterDefenders  ->  window
```

`execute` now declares and returns. `resolvePlay` — the TRAINER's wrapper —
runs `dummyDefence`, calls `afterDefenders`, and says which phase follows. A
second caller brings its own.

**`afterDefenders` exists because some card text cannot resolve until the
DEFENDERS DO.** Phantasm reads the cards declared against the attack, so it
was never declaration-time text — and folding it in was what forced
`execute` to run the defend step itself.

### The measurable results

| | |
|---|---|
| `mode` writes in `engine/effects.js` | **0**, was 5 — pinned by a drill that strips comments first |
| `dummyDefence` in `CTX_KEYS` | **gone** — the one context key that described the trainer's opponent rather than cards |
| `activateInstant`'s capture-and-restore | **deleted** — v2.72 needed it because `execute` opened with `mode:"act"`; the window now simply survives |

### TWO REAL BUGS, BOTH FOUND BY PLAYING

**1. Going second opened turn 1 with ZERO action points.** v2.71 gave seat 1
a real end phase, and CR 4.4.3e says *all* players lose their points — so
seat 1's end phase correctly zeroed the point the initial state had handed
you, and the opening handoff never passes through `newTurn`, which is where
CR 4.3.2 issues one. You could not play a single action card on your first
turn. **Not an illegal STATE** — zero action points is what you have for
most of the game — so `invariants.js` cannot see it by construction, and all
914 drills were green.

**2. Seat 1 got 6 from Emeritus Scolding on its own turn, where it prints
4.** The `foeTurn` condition read `mode === "block"`, which means "they are
swinging at me" — but during the mirror's swing `foePlay` BORROWS THE ACTOR
to seat 1, and it is seat 1's turn. Stronger than printed, and
`npm run fairness` is one-sided against ever seeing it because the clause is
consumed either way. It now asks `turnPlayer !== actorOf`, which is the
question the CR actually asks.

### Trap 4b, three times in one change

Three drills went green against broken code before being rewritten:

- the routing drill grepped for the call it guarded, so `if(false)` left it
  passing **with the whole feature off**;
- a `mode:` scan tripped on its own explanatory COMMENT — the same trap in
  the failing direction;
- the `foeTurn` drill matched `turnPlayer !== actorOf(s)` in the source,
  which survives disabling the guard around it.

Each is now DRIVEN — `parser.instantAbilityReady` is a function a drill
calls, and the `foeTurn` pair runs Emeritus Scolding's printed text through
`execute` and reads the damage off the ACTOR'S FOE (hardcoding seat 1 there
reports a flat 0 the moment the actor is borrowed). **Every sabotage was
verified to change the file (rule 4a) and to bite.**

Driven end to end: pay → declare → dummy defends → reaction window →
resolve → action phase, and the opening handoff issues its action point.
0 invariant violations. **922 drills.**

---

## v2.72 — the half of the iron that had no window

**Spellfire Cloak prints `Activate this ability only during an opponent's
turn`, and `fx.activateIf.kind === "foeTurn"` has read that gate for
versions. The only function that consults it — `tryPlay` — refuses
outright while `mode === "block"`.** So the printed gate named a window
the engine could never be asked about while it was in it. Tapping iron on
their turn either declared a defender or opened the zoom modal; there was
no third thing it could do.

It is Iyslander's **only Chest piece**, so it is equipped in every game she
plays and was dead in every one of them. Crucible of Aetherweave
(`Once per Turn Instant`) was in the same position.

`activateInstant` is the route. It asks `priority.js` for the window
rather than restating CR 8.1.6, so it correctly refuses in the DEFEND step
where the turn-player holds priority (CR 7.3.3) — a refusal that is a rule
rather than an oversight.

**It resolves nothing itself.** The destroy cost, the graveyard stamp and
the ops are card semantics and there is exactly one copy of those, so it
calls `execute` and **restores the window afterwards**: `execute` returns
`mode:"act"`, and leaving that would hand the player their own action
phase in the middle of the opponent's turn — sev-3, illegal play allowed.

### Two limits that expire differently, now that they can diverge

`perTurnCleared` moved from `judge.js` to `parser.js` — the trainer
needed the same answer, and a second copy is the no-mirror rule broken in
slow motion. A TAP lifts only at its controller's untap step (CR 4.4.3d); a
`Once per Turn` **allowance** comes back at every turn boundary for both
seats. They coincide for a weapon swing and stop coinciding at the first
`Instant - Once per Turn` equipment ability, which is now reachable.

**Two real bugs were found by the drills, not by the code:**

1. `weaponCost` requires `": attack"`, so an equipment ability's line read
   as null and every ability was treated as an allowance —
   `tapsToActivate` reads the cost segment for `{t}`.
2. An ability's flag is namespaced (`"gp"+uid`) so it cannot collide with
   the piece's own swing — and the uid is a NUMBER while the flag is a
   string, so stripping `"gp9"` gave `"9"`, which never `===` 9. The
   piece was never found and a tapped ability untapped at the wrong
   boundary. Compared as strings now.

### A drill that went green against a disabled route

The first version of the routing drill grepped for
`activateInstant(gr.powCard,"hero",i)`. Replacing the gate with
`if(false)` leaves that text sitting in the source, so **it passed with
the whole feature switched off** — a false PASS, worse than no drill, and
exactly HANDOFF.md rule 4b. The decision is now
`parser.instantAbilityReady`, a pure function a drill can CALL. Both the
tap route and the window-opening check ask it, so they cannot disagree.

Driven: Spellfire Cloak activated in the reaction step of the opponent's
turn — 0 → 1 resource, the piece shattered, `mode`/`bphase` unchanged, no
action point spent, 0 invariant violations.

**8 new drills. 913 total.**

---

## v2.71 — the turn the opponent never took

**Five mechanics were filed `noop` in `parser.js`, and every one gave a
reason about the PROP rather than about the rules:**

| parser.js | the reason it gave |
|---|---|
| arcane barrier | "stops arcane damage — the dummy throws only fists" |
| frostbite | "frostbite — dummy pays no costs" |
| inertia | "taxes the opponent's action phase — the dummy has none" |
| freeze (Cold Snap) | "idle against the dummy's scripted swing" |
| "target hero may pay" | "the dummy pays no costs, so it always declines" |

Those are statements about a training dummy, not about Flesh and Blood —
and a `noop` counts as ACCOUNTED FOR, so all of it reports tier `full`
and no coverage tool can see any of it. **Iyslander's entire deck is built
on top of those five**, which is why she was the hero that forced this.

### Seat 1 takes a turn

`foeSwing` was one fabricated swing between two of your turns. It is now
a turn: `foeBegin` (start phase, CR 4.3.2's action point, a fresh
`hist`), `foeStep` (one action, called again after every chain link
closes), `foeWindowOrEnd` and `foeEnd`.

**`finishBlock` returns to `foeStep` instead of `newTurn`**, so go again
chains a second link for seat 1 the way it does for you — the escalation
could only ever swing once. Go again is a GAIN (CR 5.3.5), spelled out
rather than folded into a ternary, and read through `hasKwNow` so a
conditional grant does not hand out a free action.

### ONE END PHASE, NOT TWO

CR 4.4.3 (c)-(f) existed for seat 0 alone; seat 1's "end phase" was a
stand-in refill buried in `newTurn`. That is the same two-unrelated-bodies
shape that let clash fire on the wrong trigger for five versions.
`endPhaseCF(s, si)` is one copy, actor-relative throughout, and
`test/actor.test.js` moves it into MIGRATED — **6 of 7 now, was 5.**

ROADMAP-OPPONENT.md's warning was explicit: *"adding that one without
removing this one draws twice"*. Both halves landed together, and there is
a drill for the removal — because a double draw just looks like a generous
opponent.

### The window that did not exist

The only window on the opponent's turn was the reaction step of an
incoming swing — a window that exists **only if they attack**. `foeturn`
is the rest of it: their action phase with priority passed to you, mapped
in `priority.js` so `speedAllowed` returns instants only (CR 8.1.6) and
`canAct` cannot contradict it.

**RULING (user, 2026-08-10):** *"as though it were an instant"* is more
than dropping the action point — an instant may be played **any time the
player has priority**, where an action is confined to its own action
phase. So Iyslander's clause 1 is gated on "not your turn and you hold
priority", not on one combat step.

**A window with nothing in it does not open** — the rule `buildPrompt`
already follows — so solo play against the vanilla dummy gains no dead
tap. Verified: 0 windows opened across a Kayo-vs-Dummy game.

Iyslander's clause 2 moved out of `playArsenalInstant` into
`foeTurnIce`: it is an EVENT ("whenever you play an Ice card during an
opponent's turn"), and as a property of one route an Ice instant from
hand triggered nothing.

### Driven, not just drilled

Iyslander mirror: played Voltic Bolt from arsenal at instant speed during
their action phase — 18 → 15, a window that did not exist before. Kayo vs
the vanilla dummy: **3 swings across 3 turns**, the tuned [3,4,5] curve
untouched, end phases alternating, no doubled draw. **0 invariant
violations in both.**

**12 new drills, all sabotaged with the file hash checked (rule 4a).** 907
total.

---

## v2.70 — the half of the card that was thrown away

**Warrior's Valor prints two things and the engine kept one.**

> Your next weapon attack this turn gets +3{p}
> and **"When this hits, it gets go again."**

The `buffNext` rule stopped at the pump, so the whole quoted ability — the
half that makes the card a staple — was dropped. **Six physical cards across
her three pitches**, every one reporting tier `full`, because the clause was
consumed either way. Weaker than printed, so `npm run fairness` is one-sided
against ever seeing it.

**FaB prints a granted ability in QUOTES, and that is what makes this
readable rather than guessable.** The quoted text is a clause in its own
right, so it goes back through `classifyClause` instead of being
pattern-matched — `"When this hits, it gets go again"` already read as an
on-hit `ga`. Nothing is special-cased to a card, and the same rule picks up
**four more**: Azalea's Lace with Frailty / Bloodrot / Inertia and Gravy
Bones' Yo Ho Ho!. Seven cards, three heroes, one rule.

The rider travels on the **buffQ entry**, not on the card that granted it,
because it belongs to whichever attack eventually collects the pump. A buff
whose qualifier does not match keeps its rider and waits — verified with a
control, because a drill without one passes just as well when the qualifier
is ignored and every attack collects everything.

Driven end to end: play Valor, swing the Dawnblade at 3+3, it connects, and
the action point is **kept**. Swing a non-weapon attack instead and it takes
neither the pump nor the ability, and the buff is still waiting.

**5 new drills, all sabotaged.** 895 total.

### Dorinthea, after five versions

| | |
|---|---|
| hero ability | built — 1 of 1 clauses, was 0 |
| deck coverage | **29 full / 4 part / 0 unreadable** |
| bugs fixed | 2 stronger-than-printed, 3 weaker-than-printed, all reporting `full` |
| cards touched beyond her deck | 7 doubled pumps, 2 summed replacements, 13 dropped restrictions, 4 dropped riders — across Kayo, Azalea, Boltyn, Arakni, Gravy Bones and Enigma |

Still open on her deck, all four genuinely unbuilt rather than misread:
Refraction Bolters ("if you do" rider), Agile Engagement (defended-by-an-
attack-action check), Oasis Respite (the life comparison), Wreck Havoc
(turning a card in an opponent's arsenal face up).

---

## v2.69 — the restriction the reactions never had

**`buffNext` has carried its target restriction in `op[2]` since v2.30 —
that was the arrow-buff-landing-on-a-sword fix. `self`, the op every
REACTION uses, never got it.** The clause reader swallowed the words
between "target" and "attack" in a `[^.]*`, so **eleven pool cards granted
their pump to whatever happened to be swinging**:

| card | prints | granted it to |
|---|---|---|
| Puncture ×2 | "target **sword or dagger** attack gains +3{p} and piercing 1" | a bow |
| Pummel | "target **club or hammer weapon** attack gets +8{p}" | anything |
| Agile Engagement | "target **Warrior** attack gets +3{p}" | anything |
| Overpower ×2 · Ironsong Response ×2 · Out for Blood · Stroke of Foresight | "target **weapon** attack" | any attack action card |
| Scar Tissue · Two Sides to the Blade | "target **dagger** attack" | anything |

Sev-2, *an effect reaches illegal targets*. A restriction is a **legality**,
not a modifier — with no legal target the card cannot be played at all — so
the qualifier rides on the card (`fx.selfQ` / `fx.gaQ`) rather than on one
op, and `playRx` refuses by name instead of dead-tapping.

**And Run Through was half a card.** "Target sword attack gains go again"
parsed fine and the attack branch never read `fx.ga`, so its +2{p} rider
landed and the go again it is printed for did nothing. Weaker than printed —
the direction the sweep deliberately does not look in. No attack reaction in
the pool prints the keyword for itself, so on a reaction `fx.ga` can only
mean the target's.

### The sweep's third blind spot in one hero

`RESTRICTION-DROPPED` matched only the "your/the **next** … attack" wording
and only `fx.ops`, so it never looked at the reaction family at all. It now
reads the "**target** … attack" phrasing, and asks the CARD rather than an
op — `fx.self` and `fx.ga` are folded out of `fx.ops` by the dispatcher, so
an op-only check finds nothing to look at and then accuses a card that was
read correctly. The first version of this check did exactly that to Overpower
and Ironsong Response.

Reintroducing the bug reports **13 findings**, naming every card above.

### Two process failures worth writing down

**A backup chained behind a grep is not a backup.** The verification ran
`fairness | grep -E "…findings" && cp parser.js /tmp/bak`. The summary line
reads `4 finding(s)`, the grep matched nothing, the `&&` short-circuited, the
copy never happened — and the "restore" afterwards reverted `parser.js` to a
snapshot from an earlier round, silently deleting the whole fix. Take backups
unconditionally.

**A sabotage must be verified to have changed the file.** Three this cycle
matched nothing (a `==` for a `===`, a note that did not match the note in
the file, a regex against text that was never there). A sabotage that edits
nothing looks exactly like a drill that does not bite.

**6 new drills.** 890 total.

---

## v2.68 — the blade remembers

**The Dawnblade earns its own counters.** The project's namesake card sat at
tier `part` with both of its real clauses unread:

> The second time this hits each turn, put a +1{p} counter on it.
> At the beginning of your end phase, if this hasn't hit this turn, remove
> all +1{p} counters from it.

**RULING (user, 2026-08-09): the counters PERSIST and accumulate across
turns.** The removal clause only makes sense under that reading — it exists
precisely to punish a turn where the blade never connected. So the blade
grows while you keep hitting with it and falls back to printed the first turn
you do not. Driven end to end: it swings at 3, then 4, then 5.

Two swings is also exactly what the hero ability allows in a turn, which is
why the card rewards its **second** hit and not its third. That is the
design, and it is why the **ordinal is read off the clause** rather than
assumed — a fixture printing "the third time" reads as three.

Both clauses are **schedules, not on-play effects**, so `fxParse` hoists them
out of `fx.ops`. Left there, `runOps` would hand over the counter the moment
the weapon was activated, before it had hit anything.

The per-turn hit tally rides on `hist`, keyed by uid, for one reason: CR
4.4.4 already clears `hist` at the turn boundary, so "each turn" needs no
reset site of its own. Put beside the rust on `counters` it would never be
cleared, and every swing after the second would count as a second one. The
counters themselves *do* live on `counters`, because they outlive the turn.

The gear tile shows them in gold, distinct from steam and rust: a permanent
gain reads differently from a status.

### A drill that proved nothing, and the tell

The end-phase wipe lived inside `endTurn`, a Battle closure, so the only way
to check it was to grep the trainer's source for `hist.wpnHits` — **and that
string was sitting in the comment above the gate.** Replacing the whole
condition with `if(false)` left the drill green.

A grep satisfied by prose is a false **pass**, which is worse than no drill:
v2.66 hit the mirror image of this when a comment containing an example of a
bug tripped a scan that was working correctly. So the decision moved into
`parser.idleCounterWipes`, pure and driven with real gear, and the four
drills over it bite on the gate, on the printed-text read, and on the caller.

**Sabotage must be verified to have changed the file.** Two of this cycle's
sabotages silently matched nothing — one a `==` for a `===`, one a note that
did not match the note in the file — and a sabotage that edits nothing looks
exactly like a drill that does not bite.

**11 new drills.** Dorinthea's deck: **29 full / 4 part / 0 unreadable.**

---

## v2.67 — the blade swings twice

**Dorinthea's hero ability, built.** It read as **zero of one clause** — the
audit's own flag said so, and it is the whole reason her deck looks the way
it does:

> Once per turn Effect - When a weapon you control hits, you may attack an
> additional time with that weapon this turn.

Nearly every card in the deck either pumps a **weapon** attack or pays off a
**Reprise**, and both want the blade swinging more than once. Same role
Kayo's clause 2 played for him: a hero ability that reads like bookkeeping
and is actually the engine.

**RULING (user, 2026-08-09): it waives the weapon's own "Once per Turn"
limit and nothing else.** The extra activation pays the printed {r} again
and spends an action point again — which is exactly why the deck carries go
again on Sharpen Steel, all three Warrior's Valor, Hit and Run, Trot Along
and the Goblet. Handing it a free action point would have made the hero
strictly stronger than printed.

`weaponUsed[uid]` **is** the once-per-turn limit in this trainer, so the
ability is modelled by clearing that one key. The latch rides on `hist`,
which CR 4.4.4 already clears at the turn boundary.

Four things it deliberately does not do, each drilled:

| | |
|---|---|
| a swing **blocked to nothing** never refreshes | CR 7.5.5 — a hit is damage actually dealt |
| an attack **action card** never refreshes | the text says "a weapon" |
| a **second** hit never refreshes again | spent by triggering, not by being useful — which is why the Dawnblade rewards its *second* hit each turn and not its third |
| **another** weapon stays tapped | "that weapon" is literal |

`pend` now records the zone the attack was declared from. Inferring it at
resolution would mean re-deciding a question already answered.

### The audit ledger had drifted, silently, for eleven versions

`tools/audit.js`'s `HERO_STATICS` decides whether a hero clause reports as
recognized; `build.js` decides whether the passive exists. Two hand-written
copies of one question, and **nothing compared them** — so **Kayo's three
clauses reported "not recognized by any ability reader" ever since they were
built in v2.55**, while `HANDOFF.md` called the hero complete. Under-reporting
is the safe direction, but only if somebody is looking.

Both heroes now report **zero** uncovered clauses, and a drill fails if a
recognizer and the build it names ever disagree again — in either direction.

**14 new drills, every one proven to bite.** One sabotage looked like it
passed and turned out not to have matched the file at all; checking that the
sabotage actually changed something is part of the sabotage.

---

## v2.66 — the reaction that paid twice

**Phase 3, hero 2: Dorinthea.** The first pass over her deck found two
bugs in the *reaction* family, each affecting cards across several heroes,
and `npm run fairness` was **clean through both** — which turned out to be
structural rather than luck.

### The fallback read the same words twice

`fxParse` ends with a whole-text fallback: a non-attack whose "+N{p}" never
became an op still queues that pump. Its guard named **one** place an op can
live (`fx.ops`, and only a `buffNext`). A pump the parser had already routed
to `fx.conds` was therefore read a *second* time into `fx.self` — which both
**doubles it and deletes its gate**.

Ironsong Response is a single conditional clause:

> Reprise - If the defending hero has defended with a card from their hand
> this chain link, target weapon attack gains +3{p}.

It granted **+3 with the reprise unmet** (printed: nothing) and **+6 with it
met** (printed: +3). Seven cards across four heroes were doubled the same
way — Ironsong Response ×2 pitches, Hit and Run, Flying High, Mark of the
Huntsman, Raydn Duskbane, Courageous Steelhand — and **every one reported
tier `full`.** The guard now matches the pump's magnitude against all four
places an op can sit, so a card printing two different pumps still gets its
genuinely unread one.

### "Instead" was not read inside a keyword gate

v2.32 established that **`instead` REPLACES**. The generic if/when/while
handler has marked it ever since; **Reprise, High Tide and Surge each
hand-rolled their own two lines and none of the three did.** Overpower:

> Target weapon attack gains +4{p}.
> Reprise - ... instead it gains +6{p}.

Parsed as an addition, and `playRx` summed them: **+10 where the card prints
+6.** That is v2.32's Emeritus Scolding bug returning through a door the
original fix never covered. The three gates now share one helper, so a
fourth cannot reintroduce it.

### Why the sweep was blind, and what it reads now

`COND-BYPASSED` and `VALUE-DOUBLED` both read `uncondOps(fx)` — that is,
`fx.ops`. **`fx.self` is a first-class grant that does not live there**, so
the sweep built for exactly this bug class could not see it in the one field
it never read. `VALUE-DOUBLED` now scans conditional and on-hit ops too, and
a new **`INSTEAD-ADDED`** check catches a printed replacement being summed.

Verified rather than assumed: reintroducing the two bugs makes the sweep
report **7** and **2** findings respectively, naming the right cards.

### The arithmetic moved somewhere it can be drilled

The reaction pump was one hand-rolled line inside `playRx`, a React closure
no drill could reach — which is why a plain sum survived there long after
v2.32 settled the rule. It is now `parser.rxPump(fx, fired)`: pure, with
*which* conditions fired left to the caller, since that is the half that
needs the board.

**17 new drills, each proven to bite by sabotage.** One of them caught its
own comment — a code example of the bug reads exactly like the bug — and the
prose was reworded rather than the scan weakened, same discipline as
`sync.test.js`'s.

---

## v2.65 — the turn that never ended

**A three-tester round on the Kayo mirror, and the mirror could not finish
a game.** Two testers drove the engine headlessly; one played it at
393×852. The one that played it found the game-breaker, and that split is
the story of the round: **no tool in this project could have found it.**

### The soft-lock

`foeSwing`'s no-play branch — reached when seat 1 holds nothing it can pay
for — handed the turn back with a bare `mode:"act"`. `newTurn` is the ONLY
site that refills seat 1's hand, ticks the clock, closes the chain and
issues the player's action point, and the branch reached none of it.

**It is self-perpetuating by construction:** `foePick` needs cards in hand,
the hand only refills in `newTurn`, and `newTurn` is exactly what the
branch skipped. Once it fired it could never un-fire. The turn counter
froze, END TURN reproduced the position byte-for-byte, and the whole hand
stayed lit in the rail — the "looks playable, does nothing when tapped"
failure mode, on every card at once.

It hit on the **first opportunity** in a normal line: the opponent opened
with Buckwild, pitching two cards for three, and went to one card in hand.

`invariants.js` reported **zero violations** throughout, and correctly: a
control-flow dead end is not an illegal STATE. All 834 drills were green.
It is also **not Kayo-specific** — every real hero in seat 1 takes that
branch, and the vanilla dummy never does, which is why a year of solo play
never saw it.

### Three ways the mirror leaked value to the player

Each found independently, each confirmed against printed text:

- **the opponent's prompt was answered by the player.** `afterDiscard`
  queues Beaten Trackers' modal with `side: actorOf(n)`, but `promptConfirm`
  charged `youMut` and ran the ops at the ambient actor — so the sheet was
  drained on the player's next `execute`. `destroyGear` looked for seat 1's
  uid in seat 0's gear and skipped (its `return` exits one op, not the
  option), and the `["ap",1]` still fired. **A free action point every game,
  and the opponent kept the iron it was printed to destroy.** `spec.side`
  has meant "whose call is this" since v2.17; now the payout honours it.
- **`foePick` never read `fx.playIf`.** Bear Hug ("Play this only if you've
  pitched a card with 6 or more {p} this turn") and Run Roughshod swung with
  their gate unmet — sev-3 *illegal play allowed*, 4 deck copies. The gate is
  now one `playIfOk` both seats ask, borrowed as seat 1 so it reads seat 1's
  board rather than the player's.
- **Savage Feast's additional cost was never paid.** "As an additional cost
  to play Savage Feast discard a random card" — the opponent simply did not
  discard. The one place the mirror ran *stronger* than printed.

### One printed value the board was inventing

The hero row read the `[3,4,5]` escalation table **unconditionally**, so it
announced "NEXT SWING 3" while a real hero held real cards and swung for 7.
That is the "the player *trusts* the number on screen" category, and the
advisor's race maths sits beside it. A real opponent's next card is not
knowable, so it now reports what IS known — how many cards the hand holds.

### `payAddCost` — one copy, and it was already two

The additional-cost discard existed **twice, verbatim**, in `execute`'s
attack and non-attack branches; the mirror needed a third caller, which is
what surfaced it. Extracted to `engine/effects.js` as a **pure move** — the
body is byte-faithful, so a diff can tell the extraction from a behaviour
change. It deliberately does **not** carry the conditional payoff that
follows it in the attack branch: that is `execute`'s to evaluate, and the
mirror not firing it is the documented limit. Paying a cost without
collecting the bonus is the safe direction.

### The drill that proved nothing until it was sabotaged

`test/mirror.test.js` adds 10 drills, and **all 12 sabotages were run**.
One came back BLIND: the guard for `_opening` was written `/_opening/` and
passed with the entire gate deleted, because the **comment above it says
the word**. Pin the gate, not the identifier — the same lesson three drills
learned in v2.60–2.63, learned again.

---

## v2.64 — housekeeping, and a bonus that never reached the wall

### The bug the mirror found

Rally the Coast Guard's `+3{d}` was written to `s.defBonus` and then
**thrown away one line before the wall was totalled**: `takeIt`'s no-pause
path called `finishBlock(s, clashDef, {})`. A 2+3 defender locked the
defence at 3.

The whole suite was green, and reasonably so — `defBonus` had only ever
been *produced and consumed inside a single defpay cycle*, so nothing had
cause to check the other path. An activated ability that raises a defender
before `takeIt` is ever reached is new as of v2.61.

Both call sites carry it now, and it is **cleared in `finishBlock`** where
`blockH`/`blockG` clear (v2.46's rule) — otherwise a defender would carry
its `+{d}` into the next link for free. Both directions sabotaged.

### Round 1's findings, closed

Filed 2026-08-04 by a JUDGE pass, fixed now, both exactly where the
write-up said they were — reproduced from the report alone:

- **the table's seat-choice screen was unstyled.** It rendered
  `className="lobseat"` while every rule is scoped `.rps .rtitle` /
  `.rps .rsub` / `.rps .rseatpick`, so the winner's call arrived as
  unspaced run-on text: *"I go firsttake the initiativeThey go firstkeep
  the extra card"*. Clickable, and illegible. The solo `Pregame` wraps in
  `.rps` and always looked right, which is how the copy drifted.
- **the card preview rendered off-screen from the board panel.**
  `PeekDock` used `querySelector(".phand, .chand, .hand")`, which returns
  the first match in DOCUMENT order — on the table's three stacked screens
  that was the chain screen's rail, sitting mostly-but-not-quite off the
  top, which cleared the old "is it off screen" guard and produced a
  ~893px offset. The preview landed at y ≈ -365, invisible, for every card
  interaction on that screen.

  It now considers **every** rail and picks by **visible height**. That
  needs no refs and no knowledge of which board is rendering, which is what
  keeps one component serving both.

### Documentation

`HANDOFF.md` rewritten for the current state — it was two phases stale.
`CLAUDE.md` gains a Phase 3 section recording the **method** Kayo produced,
not just the cards: find the hero's one mechanic, read the hero ability
first, diff printed against granted, fix the rule rather than the card,
and sabotage every drill. The audit was regenerated and the coverage
baseline repinned after review — **40 tiers up, zero down**.

---

## v2.63 — the opponent plays real cards

**A true Kayo mirror, in single player.** With a hero in seat 1 the
opponent already had a real deck, real gear and real printed passives —
everything except a turn. Roadmap item 3 gives it one:

```
Kayo pitches Strongest Survive for 2.
Kayo plays High Pitched Howl — 6 power. Priority to you — react, block, or take it.
```

It picks the biggest attack it can pay for, pitches cheapest-first to cover
the cost, and swings for printed power. The `[3,4,5]` escalation remains
only for the **vanilla dummy**, whose whole job is to be the one deck where
nothing can be faked, and whose curve the difficulty is tuned to.

### Why the actor stays 0 for the swing

The obvious move is `actor:1` through `execute`, and it does not work:
`execute` calls `dummyDefence`, which picks blocks for seat 1, and the
entire block path (`toggleBlock`, `finishBlock`, `takeIt`) reads
`act(s).blockH` — with the actor flipped, the attacker would be asked to
block its own attack. That is the same actor work `foeSwing` is still
PENDING for.

So the swing is assembled directly and the actor is borrowed **only**
around the card's own effects, where `runOps` is fully actor-relative and
drilled to be. Everything the player then does runs on the unchanged path.

*Limit, stated:* only the card's **unconditional** effects fire for the
opponent. A conditional attack trigger (High Pitched Howl's "if there is a
card with 6+{p} in your pitch zone") lives in `fx.conds`, which only
`execute` evaluates — and replicating that here would be a second copy of
the card semantics, which is the one thing this codebase does not do. It
comes free once the defence hand-back lets the opponent's attack go
through `execute`.

### The temporal dead zone, again

The opening swing used to happen inside the `useState` initializer, which
is safe for a hoisted `function` — but what `foeSwing` *does* changed. A
real card play reaches for `gy` and `_EFX`, both `const`s declared further
down the component, and during the first render those are still in their
TDZ: `gy is not a function`, and the match died on load.

**Exactly the shape of the v2.54 clash crash** — a name that looks
available and is not yet initialised. The opening swing moved to a mount
effect. The cost is one frame in the action phase before the block step
appears, which the initializer existed to avoid; a visible flicker is a
fair trade for a match that starts.

### Housekeeping: the log names the card you played

Reported from play. The feed showed the pitch that paid for an attack and
then the opponent's defence, with **no line naming the attack itself** — so
the one thing the player actually did was the one thing the sequence never
mentioned. In a training sim the sequence is the lesson.

Attacks and non-attacks both announce themselves now, and the printed value
is shown alongside whenever the total differs, because "6 → 8" is exactly
what the player is trying to learn.

---

## v2.62 — one copy of the card semantics

`resolveStack` (122 lines) joins `runOps` and `execute` in
`engine/effects.js`. **All three are now in one place, and there is exactly
one copy of the card semantics in the project.**

It was the awkward one. The other two were plain closures and moved
verbatim; this was `() => setG(s => {…})`, so what moved is its **body** —
which was already a pure `s => s'` — leaving the React wrapper behind as
`() => setG(_EFX.resolveStack)`. The body itself is unchanged, and it
needed **no new context keys**: only `gearDef` and `gearBlockApply`, which
are `game.js` exports the module can import directly.

Verified in play, because `resolveStack` is the damage path and a drill
that reads source cannot see a wrong number: Agile Windup's ability
discarded it, created an Agility token, minted Might off clause 3 and left
the action point untouched — with the attack resolution path intact
underneath.

Two more drills had to follow the code, the same lesson as v2.53: one in
`priority.test.js` sliced `resolveStack` out of `index.html`, where it now
finds only the one-line wrapper. **A source guard aimed at the wrong file
passes by finding nothing**, so it is repointed and now also asserts the
slice is non-empty.

### What this does NOT do, stated plainly

**The table still runs no card text**, and location is no longer the
reason. The remaining obstacle is that the two engines speak different
state languages:

| | drives combat through |
|---|---|
| `execute` / `resolveStack` | the trainer's `mode` / `pend` / `stack` |
| `judge.js` | the CR machine's `phase` / `step` / `chainCards` |

`execute` does not merely apply a card's effect — it also **advances the
turn structure**, calling `dummyDefence` inline and setting `mode:"stack"`.
Separating *what the card does* from *what happens next* is the real
remaining work, and that inline `dummyDefence` call is the first knot in
it. Both are named in the module header rather than left to be
rediscovered.

---

## v2.61 — a card in your hand can have an activated ability

The last two unbuilt Kayo cards were blocked on the same missing thing, and
it was not a parser gap — it was that **there was no route**. Only gear
(`build.js`) and arena permanents (`boardPow`) ever got a `powCard`, so an
`Instant - Discard this: …` printed on a card in HAND was unreachable even
though its effect parses perfectly.

| | |
|---|---|
| Agile Windup | `Instant - Discard this: Create an Agility token` |
| Rally the Coast Guard | `Once per Turn Instant - Discard a card: This gets +3{d}` + *"Activate this only while this card is defending"* |

`parseHandAbility` is a **separate reader**, not a relaxation of
`parseHeroPower` — that one deliberately refuses a discard cost, and its
comment explains why (loosening it would raise the tier of cards nothing
wires). This exists because the trainer now wires it.

**The cost is the distinction that matters.** "Discard THIS" spends the
card itself; "discard A CARD" spends another one. Different costs, and the
caller has to tell them apart — the second also has to skip cards already
committed to the block.

**The ability is its own cell in the hand rail**, appearing only while it
can actually be activated. That is not decoration: Agile Windup is both a
playable attack action *and* a discard-for-a-token instant, and both are
legal in your own action phase — discarding it is a real Kayo line, since
a printed 5 is a 6 to him and the discard makes Might. One tap target
cannot mean two things.

**Rally's +3{d} does not go through `runOps`.** `finishBlock` reads a
per-uid bonus map, which is how `confirmDefPay` already routes a defence
buff onto one specific defender; `runOps` has no way to raise one.

**Three more pool cards come online for free** — Arcane Twining, Photon
Splicing and Reaper's Call all print the same shape. Nothing is
special-cased by name, and a drill fails if either Kayo card's name appears
in the wiring at all.

### And a bug found by watching it work

Activating Rally to block on the **opponent's** turn minted a **Might
token**. Clause 3 says *"during each of **your** action phases"*, and the
gate only checked `phase === "action"` — which is true there, because **in
Flesh and Blood the combat chain lives inside the TURN PLAYER's action
phase**. Defending against their swing is still an action phase; it is just
not yours. The turn now has to be the actor's own.

Confirmed live in exactly the state that produced it: `phase: "action"`
with `turnPlayer: 1`. No drill in this repo asked that question, and no
tool could — the card parses perfectly and the phase really was "action".

*Known limit, stated:* "discard a card" is the player's choice, and the
trainer auto-picks the lowest advisor value rather than prompting — the
standing approximation `CLAUDE.md` already records for every other cost. A
`pick` prompt is the upgrade, and it needs a uid-exclusion the spec does
not carry yet.

---

## v2.60 — Beaten Trackers, and the word the hero ability doesn't have

> "Whenever you discard a **random** card with 6 or more {p}, you may
> destroy this. If you do, gain 1 action point. Battleworn."

Both clauses were unread. It now hangs off the same `afterDiscard` hook
clause 3 uses — **but not on the same event**, and that is the whole care
in this change:

| | triggers on |
|---|---|
| Kayo clause 3 | **any** discard of a 6 or more, first per action phase |
| Beaten Trackers | only a **random** one |

Reading the two as the same event would hand out a free action point every
time a cost was paid by choice. The two discard call sites now say which
kind they are, and Savage Feast reports itself as random because its own
text says so.

**"You may" is a real decision**, so — RULING (user, 2026-08-08) — it
prompts every time it triggers, as a `modal` with the piece named and the
alternative spelled out. An action point against a block is a genuine
trade, and Kayo triggers this often enough that taking it silently would
be making the choice for the player.

Matched on the piece's **printed text**, never by name; a drill fails if
the string "Beaten Trackers" appears in the trigger at all.

**Two sabotages, and the first one caught a weak drill.** Removing the
`&& atRandom` gate produced **zero** failures, because the check merely
grepped for the variable — and deleting it from the condition leaves the
declaration behind. It pins the gate itself now, and bites.

---

## v2.59 — the escape hatch Strongest Survive prints

> "When this hits a hero, they discard a card **unless they reveal a card
> from their hand with {p} greater than the damage dealt this way**."

`classifyClause` returned **byte-identical output with and without that
second half** — `[["foeDiscard",1]]` either way. The defender's escape did
not exist, so all six copies in Kayo's deck discarded unconditionally:
stronger than printed, which is the direction that steals games.

Three things the fix has to get right, each drilled and each sabotaged:

| | |
|---|---|
| **the damage DEALT** | what actually landed, after blocks (`lastDmg`) — not the attack's printed power. A 7-power swing stopped to 3 is beaten by a 4. |
| **whose build** | the revealed card is read with the DEFENDER'S own build, so in a Kayo mirror their clause 2 lifts their hand exactly as yours lifts yours. `bFoe`, never `bAct` — the same mistake that helper was created to prevent in the clash. |
| **who decides** | RULING (user, 2026-08-08): the dummy reveals whenever it legally can, so the card plays at full printed strength against you rather than being quietly better than printed. |

Ordered **above** the bare `foeDiscard` rule so the qualified sentence is
claimed by the qualified reader — the same hazard as the unanchored draw
that swallowed a discard in v2.55.

**The sabotage pass earned its keep here.** The first run of it showed the
strike-total guard biting and the reveal guard *not* — because I had
written the fix without writing a drill for it at all. Dropping the escape
produced zero failures. Three drills now cover it and all three bite:
removing the escape, reading the defender's hand with the attacker's build,
and comparing against printed power instead of damage dealt.

That same pass caught a **false positive in my own earlier drill**: the
"clause 2 never reaches the damage path" check keyword-matched whole lines,
and flagged a log string containing the word "dealt" plus a `zonePow`
reading a card in the defender's *hand* — a perfectly legal threshold. It
strips template strings and looks for assignment into a damage quantity
now, with a positive assertion beside it so it cannot pass by finding
nothing.

---

## v2.58 — a cost that was never paid, and a chest piece that was never live

### Savage Feast

> "As an additional cost to play **Savage Feast** discard a **random** card.
> When you attack with Savage Feast, if a card with 6 or more {p} was
> discarded as that cost, draw a card."

**Two things in one printed line defeated the pattern**, and `fx.addCost`
was therefore never set on any card in Kayo's deck:

1. the card **names itself** instead of saying "this", with no comma after
   the name. `chargeCost` on the very next line already allows that
   alternative and explains why; `addCost` never got it;
2. `discard (a|…) cards?` cannot span the word **random**.

So the cost went unpaid and the rider asking about it read an unrelated
event — cost skipped, payload collected, the exact shape v2.04 fixed
elsewhere.

**`random` is captured, not merely tolerated.** The engine's auto-discard
picks your **lowest-value** card, which is strictly better than a card that
prints "random". It is a seeded random draw now, so a replay and a peer
feed the cost the same card.

The cost discard also stamps `gyDisc` and records `_discWay` — without
either it is indistinguishable from a card that was merely played, and
neither the card's own rider nor Kayo's clause 3 can see it. And a third
wording joins the resolution-scoped condition: *"discarded as an additional
cost to play it"* means the same as "this way".

### Predatory Plating

> "Instant - Destroy this: Gain {r}. Only if you control a card with 6 or
> more {p}."

`controlPow` read the arena and equipment only. Kayo's highest-power object
in either is Mandible Claw at **3**, so the ability was unactivatable in his
deck and read as a dead card.

RULING (user, 2026-08-08): **arena + equipment + an attack on the combat
chain** — which is what makes a chest piece that pays you for committing to
a big swing reachable at all.

*Limit, stated rather than hidden:* only the LIVE attack is counted, not
links that have already resolved. The trainer's chain history keeps a name
and an image rather than the card object, and widening it would put a full
card on every link — which is what the 16KB table-snapshot budget exists to
prevent. The live attack is the window this is used in.

`zonePow` is deliberately not used here: the chain is the one zone clause 2
excludes, and gear is not an attack action card.

---

## v2.57 — the keyword that was never earned, and a coin

### Pulping had dominate on every swing

> "If a card with 6 or more {p} is discarded this way, this gets dominate."

`hasKw` answers from **either** `card_keywords` **or** the raw text, and
dominate appears in both — inside its own conditional sentence. So the
defender was held to one card on every Pulping swing and the printed gate
was decoration.

**This is v2.31's lesson, four versions late.** That release established
that `card_keywords` is an INDEX, not a claim of unconditional possession,
and fixed it for `fx.ga`. It was never applied to `hasKw`, which is what
the trainer asks for every *other* keyword.

`kwGated` generalises the discriminator, and **a trigger is not a gate**:
*"When this attacks, intimidate"* (Smash Instinct) fires every swing, so
treating it as conditional would turn the card off — the opposite error.
`if`/`unless` gate; a bare `when`/`whenever` does not, unless the
when-clause carries a nested `if` (Spectral Rider). Across the whole pool
exactly three keywords are gated this way, and the third is Smash
Instinct's, which this correctly does **not** flag.

**Refusing the grant is only half a fix** — it would leave the card doing
nothing. `this gets dominate` now parses to `gainKw`, so the keyword
arrives when the condition actually fires.

### The sweep that should have caught it

`tools/fairness.js` listed six keywords, computed both discriminators, and
ended with `&& k === "go again" && fx.ga`. **Five of the six were
discarded** — the list was decoration, which is exactly why the sweep sat
clean over a live sev-3. It compares the printed text against
`hasKwNow` now, the same predicate the trainer asks, so it is a real
comparison rather than a restatement of the parser's own opinion.

Reintroducing the bare-`hasKw` reading makes it report Pulping and
Spectral Rider, and nothing else — verified.

**It also caught my own bug on the way in.** A first cut ran the
standalone-line check against `clean()`ed text, which collapses the
newlines that rule depends on, and reported Loot the Arsenal and Loot the
Hold — both of which print "Go again" on its own final line and happen to
carry an "If you do, …" inside a *quoted* ability granted to another card.
The layout rule reads raw text now.

### A Block has no play

Test of Might prints no cost, 4 defence and *"When this defends, …"*. Read
as an ordinary non-attack it was a **free 0-cost play** that spent your
action point and did nothing — sev-3 "illegal play allowed". `judge.js`
has refused this since v2.47 through `types.js`; the trainer never did, and
Kayo runs two copies. It now asks `DawnTypes.isBlock` and says why.

### The coin (a testing affordance)

`window.THROW_MODE = "coin"` replaces rock-paper-scissors, whose ties
replay and can cost half a dozen taps before a game starts. **`rps.js` and
every line of the throw UI are untouched and still drilled** — set the flag
to `"rps"` and it returns exactly as it was, which is the plan for launch.

Two things deliberately unchanged: the flip is drawn from the **same seeded
sub-stream**, so a match is still reproducible from its seed; and the
**winner still chooses** the seating, because "the winner decides who goes
first" is the rule, not a feature of throwing hands. A coin that seated you
directly would be a rules change wearing a convenience hat.

---

## v2.56 — the tokens fire, and clash learns to count

**Might, Agility and Vigor parsed perfectly and could never happen.** All
three print *"At the start of your turn, destroy this, then …"*, all three
resolve to exactly the right ops — `buffNext 1`, `gaNext`, `res 1` — and
all three were **inert**, because nothing in the engine had a start-of-turn
schedule for them to fire on. They accumulated on the board forever.

That silently made **seven of Kayo's cards decoration**: Clash of Agility,
both Clash of Mights, Test of Might and High Pitched Howl all exist to
create one. A coverage tool cannot see this — every card reads `full`.

The trigger goes in the start phase, which is where CR 4.2 puts turn-start
triggers and where the code's own comment already said they belonged; the
crumbling auras were the only ones there. It matches on the **printed
text**, never on a token's name, and runs the token's own parsed ops.

*Stated rather than hidden:* a token that leaves the arena strictly ceases
to exist, and these go to the graveyard like the crumbling auras above
them. Nothing reads them there — Kayo's discard checks require the `_disc`
stamp — so it is a display difference, not a rules one.

### Clause 3

> "The first time you discard a card with 6 or more {p} during each of your
> action phases, create a Might token."

Three things in that sentence do work: a **latch** (only the first), the
shared **6+** test (so clause 2 applies to it), and **"during each of your
action phases"** — RULING (user, 2026-08-08): a discard in the end phase,
or on the opponent's turn, makes no Might. So it asks the CR phase, not
merely whose turn it is. The additional-cost discard is the one path not
yet wired to it, which is a gap rather than a decision.

### Clash was comparing the wrong numbers

Clash compares the power of the top card of each deck — and **a deck is a
zone other than the combat chain**, so Kayo's clause 2 reaches it. Watching
a real clash resolve showed `Wild Ride (6)` where the card is a 7.

This is the first rule that asks about **the other hero's build**, which is
the condition CLAUDE.md set for `bFoe` existing at all. Each revealed card
is read against its own owner's build; one shared helper would apply the
revealer's buff to both cards, and a drill bites on exactly that mistake.

Also noticed, not yet chased: the dummy's pregame throw tied four times in
a row while cycling rock → paper → scissors in lockstep. It may be the
seeded stream for that seed, or the throw may not be drawing randomly.
Recorded here rather than asserted either way.

---

## v2.55 — Kayo learns to read

Phase 3 proper: the first hero taken card by card. Three things were
wrong, and **the coverage audit reported `full` on every affected card**
— they were read, and read wrong.

### Clause 2 — the hero ability that was doing nothing

> "Attack action cards you own get +1{p} while they are in any zone other
> than the combat chain."

**The combat chain is where an attack strikes, so this is not a damage
buff — it is a THRESHOLD rule.** A printed-5 attack action is a 6 in
hand, in the pitch zone, in the graveyard, in the arsenal and in the
deck, and reverts to 5 the instant it is declared.

That distinction is the whole hero. Kayo's 47-card deck holds 22 cards
printing 6 or more and **23 attack actions printing exactly 5** — and
those 23 are precisely the pitch-2 and pitch-3 cards you pitch for
resources. So *"if there is a card with 6 or more {p} in your pitch
zone"* (Buckwild, High Pitched Howl, Rough Up) almost never fired: you
pitch blues, and blues print 5. **22 of 47 → 45 of 47**, and the two
that stay out are the Test of Might copies, which are `Block` cards and
not attack actions at all.

RULING (user, 2026-08-08): every 6+ check reads the buffed value; the
strike reads the printed one. Verified in play — a Wild Ride resolving
with `total: 6` against a printed 6 while the same engine called a
discarded Strongest Survive a 7.

**One question, asked in one place.** `(c.power||0)>=6` was written out
five separate times across `index.html` and `effects.js`. That is the
shape `rxAllowed` replaced in v2.40 and it drifts the same way, so it is
now `parser.pow6(card, build)`. The +1 is read off the hero's printed
text rather than hardcoded — the clause names its own number, and
inventing it in the engine would be inventing card text.

`atkPowOffChain` is a **number**, which broke two drills asserting every
passive is a boolean. Rather than force it into a boolean and hide the 1
somewhere else, `PASSIVE_TYPE` now records what each passive answers in,
and a drill holds every build to it.

### The discard that was silently deleted

> "When this attacks, draw a card then discard a random card."

`classifyClause` matched `draw (a|an|...) cards?` **unanchored**, so it
returned `[["draw",1]]`, filed the clause `run`, and the discard ceased
to exist. There was no "discard a random card" pattern in the parser at
all. Bare Fangs, Wild Ride and Pulping drew for free and never paid.

### "This way" is not "this turn", and neither is "the graveyard"

The riders hanging off that discard read *"if a card with 6 or more {p}
is discarded **this way**"* — the discard the card itself just made. It
was implemented as `had6ThisTurn`, which asked whether **any** 6+ card
had reached the graveyard this turn. **An attack card is put into the
graveyard at DECLARATION**, so the condition was satisfiable by any
6-power attack already played that turn — including, at some points in
the resolution, by the attacking card itself.

Three separate things now:

| | |
|---|---|
| `discard6way` | what THIS resolution discarded (`_discWay`, cleared per resolution) |
| `discard6` | a real discard **this turn** — `_disc`, stamped only by an actual discard |
| the graveyard | no longer answers either question |

`discardRandom` is a real op: seeded (two peers and a replay must discard
the same card), and it honours Reincarnate, which prints *"When this is
discarded at random, put it on the bottom of its owner's deck"* — so it
is discarded (and still answers "this way") without ever reaching the
graveyard.

`had6ThisTurn` also read `you(` rather than `act(` — a rules question
answered from seat 0's perspective, the v2.24 bug class. Fixed in the
same line.

**`test/kayo.test.js` pins all of it**, and four sabotages were run and
all four bite: deleting clause 2, letting it lift a `Block`, dropping the
discard half again, and counting the whole graveyard again. One drill
guards the direction that steals games — `zonePow` may never appear on a
line that computes damage.

---

## v2.54 — the clash that crashed the trainer

**Blocking with any clash card threw and took the game down.** In
`takeIt`'s clash loop:

```js
const myTop = act(clashState).deck[0], foeTop = foe(clashState).deck[0];
const mine  = myTop ? (myTop.power||0) : 0, foe = foeTop ? (foeTop.power||0) : 0;
```

The `const foe` on the second line is **block-scoped**, so it puts the
global `foe()` helper into the temporal dead zone for the *whole* block —
including the line above it. `foe(clashState)` therefore binds to the
number, not the function. Native ES throws *"Cannot access 'foe' before
initialization"*; Babel rewrites the const to a hoisted `var _foe`, which
is why what actually shipped was **`TypeError: _foe is not a function`**.

**Seven of Kayo's 55 cards are clash cards.** Clash is his mechanic.

**Why nothing caught it.** Clash resolves on **defence** (v2.12 moved it
there, correctly), so it only fires when you *block* — and every
attack-side drill and play session goes straight past it. It is invisible
to the audit and to the fairness sweep by construction: the card parses
perfectly and is granted exactly what it prints. Nothing here is a rules
question at all. It was found by reading a browser console after two
testing sessions died without reporting, one of them stopping on the
words *"A crash."*

**`test/shadow.test.js` is the guard**, and it is the generalisation
rather than a patch: **no local binding may shadow `act`/`foe`/`you`/
`opp`/their Mut forms/`actorOf`**, as a declaration *or* as a parameter.
CLAUDE.md has warned about this class since v2.25, when `tapTwice`'s
third parameter was renamed from `act` to `commit` — but a warning in
prose is not a guard, and the same shape was sitting in `takeIt` the
whole time. Both sabotages were run and both bite.

Two further shadows were found and renamed to `cellAct` while they were
still harmless: the table board's gear and hand cells each declared a
local `act` meaning "the action this cell fires". Neither reaches for the
acting side today, which is precisely how the crashing one survived.

Verified in play, not just by drills: Kayo blocks a swing with Test of
Might, the clash reveals Buckwild (7) against Critical Strike (4), the
Might token is created, and the trainer does not fall over.

---

## v2.53 — the effects port, part one

**Phase 3 begins, and it begins structurally.** Card rules text resolved in
solo play and nowhere else, for one reason: `runOps`, `execute` and
`resolveStack` were closures inside the `Battle` component, so `judge.js` —
which runs the two-seat table — had no way to reach them. That split was
deliberate while it lasted (*a control-flow bug and a card being read wrong
must never be confusable*) and it ends the way the v2.20 no-mirror rule
ended the last one: by there being exactly **one copy**.

**`engine/effects.js` now holds `runOps` (234 lines) and `execute` (455).**

**THE BODIES WERE MOVED, NOT REWRITTEN.** They were extracted by script and
were byte-identical at the commit that moved them — verified, not asserted.
That is the whole safety property: the live trainer plays every card effect
today, so it is the regression harness for its own port, and any port that
*changes* its behaviour is wrong by definition. Fixes come afterwards, as
their own commits with their own drills, never smuggled into a move where no
diff can tell the two apart.

**What the move is guarded by**, since a port is exactly the kind of change
that rots quietly:

- `makeEffects(ctx)` **throws on a missing context key** rather than letting
  a moved body silently capture a browser global. All 17 are named.
- `test/effects.test.js` fails if the trainer's context literal and the
  module's `CTX_KEYS` **drift apart** — adding a dependency and forgetting
  the call site is the failure this port could otherwise hide for weeks.
- the **no-mirror rule** is pinned per moved function: re-declaring `runOps`
  or `execute` back inside `index.html` fails a drill by name.
- **all three sabotages were run and all three bite**, then restored.

**`test/actor.test.js` FOLLOWS the functions rather than losing them.** The
actor ledger slices bodies out of `index.html` by anchor pairs; two of its
anchors just left the file. A ledger that stops scanning a body keeps
reporting it green, which is worse than never having scanned it — so anchors
now name their source file, and `runOps`/`execute` are still held to the
actor rule in their new home. Three other drills that pinned a line of
`execute` by reading the source were repointed for the same reason: **a
source guard aimed at the wrong file passes by finding nothing.**

**Verified in a real game, not just by drills.** Kayo vs. the dummy at phone
dimensions: pitch → pay → play → the dummy's defence → resolution → back to
the action phase, with zero console errors and zero invariant violations.
The port is only true if the trainer still plays.

**What is NOT done, stated plainly:** `resolveStack` is still in `Battle` —
it is `() => setG(...)`, React-coupled, so it is a small refactor rather than
a move. And **the table still does not run card text**: reaching that needs
`judge.js` wired to call this module, and `execute`'s inline `dummyDefence`
call turned into a hand-back so the defend step can run. Both seams are named
in the module header rather than left to be rediscovered.

Also: the `APP_VER` comment had grown back to 3,711 characters shipped on
every page load. It is one sentence again, per the rule that created this
file.

---

## v2.52 — the preview that ate the tap, at the table

**Reported from a real table (2026-08-04):** during a payment, the two-tap
commit worked for the leftmost hand cards and silently failed for the ones
nearer the middle — the card un-peeked and nothing was pitched, with no
refusal shown. The reporter named the failure class correctly: it is
v2.36/v2.37's pointer-events bug, reached by a different door.

**`--peekbot` was measured in a `uE` inside `Battle`.** The table renders
the same `PeekDock` and had no such effect, so its dock fell back to the
CSS's flat `112px`. Measured on the hand screen at 393×852 the rail spans
y 628..754 and the correct offset is **233px**; at 112px the preview lands
*inside* the rail, and since `.peekwrap>*` takes pointer events (v2.36's
own fix) a tap on a covered card bubbles to the wrapper's dismiss handler.
Verified by hit-testing the live board: at 233px every hand card resolves
to itself, at the fallback cards 2 and 3 resolve to the overlay.

**The mirror is the actual defect.** `Battle` was rendering a hand-copied
duplicate of the dock's markup instead of the shared component, so the
positioning could live in one and not the other with nothing watching —
exactly what the no-mirror rule exists to stop, one layer up from the
engine. There is one `.peekwrap` in the file now, both boards render
`PeekDock`, and the measurement lives with the thing it positions.

**And it is TRACKED, not sampled.** Measuring once is not enough: the rail
is still moving when the tap that opens the preview lands, which put the
offset at 146px against a rail that came to rest at 628 — the same overlap
at a different instant. A scroll listener does not cover it either, and
this was tried: the rail slid **86px with `scrollTop` unchanged**, moved by
content above it settling rather than by a scroll. Between snap, image and
font loads, rotation and React's own re-layout there is no provably complete
list of events, so while the preview is open it re-measures every frame and
writes only on change. A rail that has flicked off screen returns to the
flat clearance rather than being chased off the top of the viewport.

`test/priority.test.js` slices `PeekDock` rather than a board, and pins the
mirror directly: exactly one `.peekwrap`, exactly two `<PeekDock` renders.
Both sabotages were verified to bite — stripping the effect, and restoring
`Battle`'s inline copy.

**Also:** the *Find an opponent* screen still told players table play "runs
the drill decks — blank cards". True before v2.49, wrong since; the lobby's
own note already said otherwise. Stale copy that under-sells is still stale.

**Not fixed, and not claimed:** the first bug report in the same batch was
retracted by its reporter — Buckwild's "costs 3" is correct, the pips were
misread. Nothing in the cost machinery changed.

---

## v2.51 — JUDGE!! is a module, and its Copy button was broken

Housekeeping before Phase 3, and one of the items turned out to be a real
defect in the tool Phase 3 depends on most.

**THE COPY BUTTON DID NOT WORK.** `navigator.clipboard.writeText` rejects
with `NotAllowedError — Write permission denied` even on a genuine tap, in
a secure context, with the document focused — verified on the deployed
site, not inferred. There was no fallback, so the fastest path from
noticing a bug to reporting it dead-ended at *"copy failed — use
Download"*. Worse, the `else` branch reported **success** when
`navigator.clipboard` was absent entirely: a report that was never copied,
announced as copied.

`copyText` now tries the async API, falls back to the legacy
`execCommand` path (which needs no permission), and if both fail says so
**in red** and points at Save report. Never dress a failed copy as a
success.

**The report is now `engine/report.js`.** It was a closure inside
`Battle`, which meant two things: the table board could not produce a
report at all — the screen where a bug is hardest to reconstruct, because
there are *two* boards and the first question is which one is wrong — and
no drill could reach the one artefact a bug report depends on.

Both boards now share it, and the table's carries the seat, the table code
and net.js's counters, so *"two peers on different hashes at the same
`seq`"* is a desync stated in one line. The table also gets the **invariant
judge** wired to its own funnel (`net.js`'s `onState`, which fires for
local submits, remote commits and snapshot adoptions alike) — the guard
rails had been dark there.

`test/report.test.js` pins the properties that make a report useful, and
the first is the least obvious: **it never throws.** A report that dies
while describing a broken board fails on exactly the board you most needed
described, so a state the invariant judge cannot read is captured as a
field rather than propagated. Also pinned: the replay key survives
(`seed` + stream position + draw count), every zone is named rather than
counted, the graveyard keeps its `_gy` stamps, `you`/`opponent` follow
`mySeat`, and the whole thing serializes even holding a cyclic card.

**`machine.lang` names which state vocabulary is authoritative.** Every
game carries both — `makeGame` seeds `mode`/`bphase` into judge's state
too, and the trainer has carried a derived `phase`/`step` since v2.27's
shadow pass — so neither being present says which engine is driving. A
table report showing `bphase:"defend"` would send a reader into the
trainer hunting a bug that is not there. Nothing is hidden; the
authoritative one is labelled.

Housekeeping alongside: `HANDOFF.md` rewritten for Phase 3 (it still said
Phase 1, v2.48, and "unpushed — no remote"), the `README` replaced (it was
GitHub's profile-repo boilerplate, and this repo's README is the public
face of the project), and the stale `judgeReport()` references cleaned out
of `index.html` and `CLAUDE.md`.

---

## v2.50 — Phase 2: the table IS the trainer's board

v2.49 put two real hero decks across the wire and drew them on a plain
diagnostic board — a list of zone counts and six buttons. It proved the
transport and it looked nothing like the game. **In a training sim that is
a real defect, not a cosmetic one: the layout is the lesson.** A player
who learns the game on the three-screen board and then sits at a table
that looks like a debug panel has to learn it twice.

So the table now renders the trainer's board with a person in seat 1:
the three vertical flick screens and their `screennav`, the armour grid,
the hero row with weapons, the arsenal / deck / pitch columns, the arena,
the graveyard pane, the log pane with its `Ticker` and scorebar, the play
pane with chain / featured / defend columns, the hand rail of real
readable cards, the status line, the status pips, the two-tap peek and
the docked action bar.

**THE SHARED PIECES ARE SHARED FOR REAL.** Drawing the same seat twice is
the no-mirror rule one layer up from the functions it was written for, so
`ArmorGrid`, `DeckPitchCol`, `InPlayRow`, `GravePane`, `usePeek` and
`PeekDock` are extracted as pure props-only components and **both** boards
render them. The trainer was migrated onto them in the same pass and
verified byte-identical against the deployed build — the opponent screen
pixel-for-pixel, the whole "You" screen text-for-text. A divergence here
would not crash anything; it would just quietly stop looking like the
game, which is exactly what this pass exists to prevent.

**What is deliberately NOT shared is the state language.** The trainer
speaks `mode`/`bphase`; the table speaks the CR machine —
`phase`/`step`/`priority` out of `priority.js`. Those are the two things
the Phase 1 rebuild exists to separate, and folding them back together to
share a few more lines of JSX would undo it.

Three things the trainer shows that the table cannot, each stated rather
than faked: **no Advisor** (it reads the trainer's `built` and would coach
card text that does not resolve here), **no boost toggle**, and **no
next-swing prediction** — seat 1 is a person, so there is nothing to
predict.

Two fixes the browser found:

- **A permanently dead "Done defending" button.** CR 7.3.3 gives the
  TURN-PLAYER priority in the defend step while the DEFENDER declares, so
  the defender genuinely cannot pass until the attacker has. A greyed-out
  button reads as a broken screen rather than as the rule it is; the bar
  now says *"declare your blockers — Kayo still holds priority"*.
- **A weapon was painting a blue `0` defence badge.** `gearDef` returns 0
  for a piece that prints no defence, and passing that straight to
  `CardFrame` put a defence value on every sword. The trainer's `gearBtn`
  asks whether the piece has a printed or current defence at all; so does
  the table's now.

**`WinPanel` is deliberately not reused.** It says "DUMMY DESTROYED" and
pulls a random trophy — right for the solo loop, wrong for beating a
person, and a trophy handed out for a real match would quietly devalue
the case. Same visual language, honest words, no reward.

Verified by driving two browsers over the public relay through a full
exchange: Kayo pitching two cards to pay for Agile Windup, swinging for
5, Bravo declaring Blade Beckoner Helm off the armour grid, and 4 landing
— eleven sequenced actions, identical state hashes throughout, zero
desyncs and zero refusals.

**Still outstanding at the table:** card text does not resolve (unchanged
— `runOps`/`execute`/`resolveStack` are still closures inside `Battle`),
and there is no JUDGE!! panel yet. `window.__dawnTable.report()` covers
the same ground from the console in the meantime.

---

## v2.49 — Phase 2: two humans, two hero decks, one game state

The table screen has connected two phones since v2.44. What it dealt them
was `engine/actions.js`'s **blank decks** — real CR turn structure over
cards with no text and no names — because `net.js` needs a pure reducer to
drive and the trainer has none. Both halves now exist, so the table plays
Flesh and Blood.

**The flow the screen was missing.** Connect → **hero** → **throw** →
**sideboard** → game. `engine/lobby.js` is the negotiation, and it is a
new module rather than a branch inside `net.js` for a reason worth
stating: `net.js` needs a sequencer because CR 7.3.2 lets both seats act
in the same instant, and **nothing in a lobby has that problem.** Every
message writes only its own seat's slot and every slot is WRITE-ONCE, so
the reducer is a monotone accumulator — the writes commute, replays are
refused, and two phones applying the same messages in different orders
land in the same place. `test/lobby.test.js` walks all 16 interleavings
and asserts one outcome rather than trusting the argument.

**Write-once is the load-bearing part.** Make a hero pick overwritable
and the lobby diverges: seat 0 changes its mind at the moment seat 1
confirms, so seat 0 applies the change locally while it is still
choosing and seat 1 refuses it for arriving after the step closed. Two
phones, two heroes, no error anywhere. The step is **derived** from the
slots (`stepOf`) rather than stored, because a stored step is a
transition and a transition has an order.

**Nothing about a card crosses the wire.** The lobby ships four small
values — two hero keys, two loadouts, a seating call — and each peer runs
`build.js` over its own database to arrive at an identical state.
`buildMatch` is that, and three things make it deterministic, each a real
way to break it: the rng stream is **seat-specific** (one stream makes
seat 1's deck a continuation of seat 0's), the uid counter is **shared
and threaded in seat order** (a repeat is `CARD-IN-TWO-ZONES` wearing a
disguise), and the seats are built in **index order, never the local
client's**. The table code is the seed, so the whole opening is
reproducible from the code alone.

**The bug that cost the most, and that no drill here could see.** The
opening snapshot measured **97KB**. A WebRTC data channel drops a message
that size *with no error at either end*, so the guest sat in
`handshaking` forever holding a board that looked perfectly correct —
because it had built the same opening itself. Every one of the 765 drills
passed. Two things were wrong:

1. `judge.newMatch` retained the build's `deck` and `gear`. They are
   **construction inputs**, already dealt into `sides`, so the same 43
   cards were in the game object twice — **62KB of the 67KB**, dead to
   every rule (`bAct` exists for the printed passives, which stay).
2. the session was given no **catalog**, so every card shipped its full
   definition instead of a bare `name|pitch` key.

Worst case across all 225 matchups is now **13.7KB**, and
`test/table.test.js` pins a 16KB budget with the reason written next to
it. A handshake that stalls also now says so on screen: the failure was
invisible precisely because every visible thing was right.

**`judge.js` and `types.js` come off the headless list — for the table
only.** The Phase 1 rule was that loading judge would put a second,
quieter rules engine beside the trainer's. That reasoning still stands
and is exactly why the two never meet: **solo play is `Battle` and keeps
every card effect; table play is `judge.js` and keeps the second seat.**
No path routes between them. `wire.test.js`'s `HEADLESS` is down to
`sparring` alone.

**Stated plainly, because the screen looks finished: card TEXT does not
resolve at the table.** Real: two hero decks off the actual database,
printed life and intellect, the CR turn structure, priority, the combat
chain, costs paid by pitching on demand, defenders from hand and iron,
printed power against printed defence, the ordered end phase. Not real:
`runOps`/`execute`/`resolveStack`, which are still closures inside
`Battle`. Moving them to a shared `engine/effects.js` both callers use is
the next pass and the last big one.

Three smaller things the browser found that the drills could not:

- **`netFirst` was a seat INDEX read as an answer**, so both seats were
  told they were on the draw. Renamed `netOnPlay` and made a boolean —
  the same actor-versus-perspective slip as `you()` meaning seat 0.
- **`board` as a lobby export collided** with the arena zone every other
  file means by that name; `test/sync.test.js` caught it on the first
  run. Renamed `sideboard`.
- a **JSX comment mid-sentence** suppressed the whitespace join and
  rendered "solotrainer" on the phone.

Verified by driving two real browsers at each other over the public
relay: hero select, a tied throw replayed, the seating call, both
sideboards, then Kayo pitching Bare Fangs to pay for Pulping, swinging
for 6, Dorinthea blocking with Gauntlets of Unity, and 5 landing — with
both phones on an identical state hash at every step.

---

## v2.48 — Phase 1: the foundation guarded

Two new drill files, and both are about surfaces nothing was watching.

### `test/loader.test.js` — the pool comes in faithfully

Everything in this repo reasons about a card **after** two steps:
`mapDbCard` turns a raw database record into the engine's shape, and
`resolveEntry` turns a deck entry into the card actually played. If
either drops or mistypes a printed value, nothing above it can notice.
The card is simply a different card — consistently, everywhere, and it
agrees with itself.

**`mapDbCard` is the one mirror the no-mirror rule could not delete.**
v2.20 made `engine/` the only copy of every shared function; this is the
exception, and not by choice — the live version lives inside `useCardDB`,
a React hook, so it is not extractable and cannot be loaded from
`engine/`. CLAUDE.md said "change both, and bump DATA_VER", which is a
note to a human, and notes to humans are what the sync guard exists
because we stopped trusting.

Drift would be worse than an ordinary bug: the Node tools would audit one
pool and the phone would play another, **both internally consistent**, so
every finding either made would be about a game the other was not
playing.

Guarded as a **field map** — key to expression — rather than as text,
since the two blocks sit in different surroundings and carry different
comments. The printing loop is guarded the same way: it decides which
face a card wears, and drift there is fifteen decks showing four art
treatments side by side, only on the phone. The field list is pinned, so
adding one is a deliberate edit — which is where the reminder to bump
`DATA_VER` belongs, because a warm cache written under the old schema
will not carry it.

Also pinned:

- **Every printed value survives resolution.** `resolveEntry` has
  silently narrowed the record twice — `life`, so an ally was not a
  living object (CR 1.4.5a) and could not be attacked at all; then `ty`,
  so `tt`'s stray word made a defence reaction playable on its own turn.
- **Every hero is seated at its printed life and intellect** — thirty
  numbers, three of which are the point. Iyslander 18, Blaze 17 and
  Lyath's intellect 5 are named explicitly, because a defaulting bug
  would look perfectly normal on the other twelve.
- **Pitch is the one normalised value.** A record with no printed pitch
  arrives as 0, which is deliberate — no card prints a pitch of 0. Stated
  as a rule (*resolves to pitch 0 iff Equipment or Weapon*) rather than
  excused, so a real action card losing its pitch cannot hide among the
  73 that legitimately have none.

Verified by drift: defence read from the wrong field, `ty` silently
dropped, the printing loop taking the last printing per set, and
`resolveEntry` dropping ally life. All four caught.

**Checked and clean, no change needed:** all 488 deck entries resolve,
all 15 decks total exactly 55 cards, every card has art, and the live
parser's `tt`-reading agrees with `types.js`'s `ty`-reading on
`isAttack`, `isAR`, `isDR` and `isInstant` across all 401 pool cards — so
the `tt`/`ty` conflict on 5 of 4,862 records is a **latent hazard, not a
live bug**. `isWeapon`'s four disagreements are the pinned split.

### `test/fuzz.test.js` — the reducer is a public surface

`net.js`'s contract is that `legal` is asked twice: on the guest before
sending, and on the sequencer before committing. That makes `reduce` a
surface fed by **JSON off a wire** — a stale action from before a resync,
a guest on an older build, a crafted packet, or simply somebody's bug.

Four properties, each a way a real session dies:

| property | what breaks without it |
|---|---|
| never THROWS | an exception kills the session instead of refusing one move |
| never MUTATES on refusal | a bad packet costs the caller its state |
| `legal` and `reduce` AGREE | a guest sends what the sequencer refuses — the two peers diverge |
| a seat cannot use the other's cards | seats are decoration |

Driven over states sampled from real games (mid-payment, mid-chain, in
the defend step, waiting on an arsenal) rather than the opening position,
against 45 malformed action shapes and 13 seat values — 5,000+
combinations.

**TWO OF THESE DRILLS WERE WRITTEN WRONG, AND SABOTAGE IS WHAT FOUND
IT.** A drill that accepts *any* refusal passes on a broken engine: the
non-priority seat is refused by "you do not hold priority" long before
ownership or the zone is ever read, so making every lookup read seat 0
changed nothing either drill could see. Both now **give priority to the
seat under test and assert the reason**, with a control that the seat's
own hand is still reachable — without which the drill passes just as
happily when nothing can be found at all.

`__proto__`, `constructor` and `toString` resolve to something truthy on
any object, so a zone check that asks "is it there" walks into a
function. `legal` asks `Array.isArray`; the drill pins the *zone*
refusal specifically rather than settling for a refusal.

### Notes

- **713 drills** (was 701), all green; fairness clean.
- Every drill in both files proven to bite.
- `find`'s own `Array.isArray` guard is now redundant belt-and-braces —
  `legal` guards first — and is kept anyway. Removing a defensive guard
  because a drill cannot detect its absence is backwards.

---

## v2.47 — Phase 1: the journey census

`test/journey.test.js` — **all 401 pool cards, every journey their
printed type promises and every one it forbids**, driven through the real
reducer.

The Phase 1 brief was "the function of each different card type and their
full usability from pitch to play". Every other drill in the suite asks
about one card or one clause; this asks four questions of all of them,
and every expectation comes from the printed TYPE rather than from a
rules box.

| journey | count |
|---|---|
| pitched for its printed pitch value | 328 |
| played → **chain** | 175 |
| played → **arena** | 23 |
| played → **graveyard** | 91 |
| declared as a defender | 332 |
| **refused**, with a reason naming the card | 112 |

Every count is **asserted, not reported** — a census that quietly stopped
driving anything would otherwise pass by finding nothing. The 112 is a
partition and it is pinned: Equipment 58, Weapon 15, Block 4, Attack
Reaction 20, Defense Reaction 15.

That 15 reconciles with CLAUDE.md's independently-derived "eleven
swinging weapons": four Weapon-typed cards print no power (Death Dealer,
Plasma Barrel Shot, Cosmo, Crucible of Aetherweave) and are activated for
a non-attack ability instead. It is the pinned `types.isWeaponType` vs
`parser.isWeapon` split, counted from the other end.

### THE FINDING: A ONE-SIDED CENSUS IS A COVERAGE TOOL IN A JUDGE'S COAT

Written asking only *can this card do what its type promises*, the census
reported a clean **401 out of 401** — while a Block card was a free
0-cost play and a defence reaction could be declared as a defending card.
Both are sev-3 *illegal play allowed*, the direction that steals games.

It could not see either, **by construction**: a card doing MORE than its
type allows still does everything its type promises. Same shape as the
audit measuring consumption rather than faithfulness, and as
`fairness.js` being deliberately one-sided towards too-strong.

With the refusals written, making a Block playable trips **three** drills
instead of none, and a declarable defence reaction trips one. All four
sabotages verified: Block playable, defence reaction declarable,
permanents resolving to the graveyard, and a card pitching for itself.

### Also checked, and clean

A pass over whether the **live trainer** still misreads any card's type,
now that `types.js` reads the structured `ty` array and `parser.js` still
reads the `tt` display string. Across all 401 pool cards, `isAttack`,
`isAR`, `isDR` and `isInstant` **agree exactly** — so the `tt`/`ty`
conflict on 5 of the database's 4,862 records is a latent hazard rather
than a live bug. Den of the Spider is refused in the action phase either
way, because `tryPlay` asks `isRx` before anything else and "Defense
Reaction" is a substring of the display line.

`isWeapon`'s four disagreements are the deliberately pinned split.

### Notes

- **701 drills** (was 694), all green; fairness clean.
- The census reads **no card text**: expectations from `types.js`,
  answers from `judge.legal`. A failure is always the machine getting a
  type wrong, never a card being read wrong.
- It runs in under a second — one seated match is dealt and forked 401
  times rather than reshuffled.

---

## v2.46 — Phase 1: a seat becomes a policy

`engine/sparring.js`, and the three CR fixes found while proving it works.

### THE MODULE — the rules stop knowing who is driving

The trainer's opponent is not a seat somebody occupies, it is a **branch
inside the rules**: `foeSwing` fabricates the swing as
`[3,4,5][(turn-1)%3]` and `dummyDefence` picks the blocks itself. That is
why there is nowhere for a second human to sit, and why the same CR
procedure is written twice — one body of code for when you swing, another
for when it swings.

`sparring.js` is one function, `act(game, seat) -> action | null`. A seat
is now just something that answers *what do you do*, and solo, hotseat and
network are the same game with different things calling `reduce`: a
policy, a tap, or a packet. None of them is a special case in the rules.

Three properties, each drilled and each proven to bite:

- **It proposes; the judge disposes.** Every action is offered to
  `judge.legal` before it is returned, so a refusal is always a bug in
  the policy. That is what lets the heuristics stay simple — the policy
  never restates a rule in order to avoid breaking one, and a rule that
  changes in `judge.js` changes here for free. **144 games across six
  matchups and both seatings: zero refusals, zero invariant violations,
  every dealt card in exactly one zone.**
- **It reads no card text.** It ranks on printed NUMBERS — power, pitch,
  defence, cost — and asks `legal` for everything else. Same discipline
  that kept `actions.js` free of card text: a sparring partner playing
  badly and a card being read wrong must never be confusable, and they
  would be the moment this started interpreting rules boxes. A drill
  fails on `require("./parser")`, on `fxParse`/`effCost`/`weaponCost`,
  and on reading `.tx` or `.kw`.
- **It is deterministic and never touches the rng.** No `Math.random`,
  and every ranking is a TOTAL order with ties broken on uid, so two
  peers choose the same card from the same state. A policy that consumed
  the seeded stream would shift every later shuffle, so replaying a seed
  would diverge the moment a human took over a seat it used to drive.

**The winner follows the HERO, not the chair.** Kayo's precon beats
Dorinthea's from seat 0 and from seat 1, which is the property that says
seat 1 is genuinely occupiable rather than a weaker shape wearing a deck.

#### The heuristic that had to change, and why it is not tuning

Ported unchanged, the trainer's blocking rule made the game degenerate:
both seats blocked **41 of 41 attacks** and one of them finished a
21-turn game on **full life**. A regression harness that never deals
damage never exercises the damage step.

The cause is not the numbers, it is that the rule was written for a seat
with **no action phase**, where a card in hand had no use except to
block, so spending two on every swing cost nothing. Both seats have an
action phase now: a card in hand is an attack or a pitch, and a hero who
blocks with everything never threatens anyone. `takeUpTo` is the damage a
seat will simply take rather than spend a card on — with lethal
overriding it, because nothing in hand is worth more than being alive.
Games went from 20-life blowouts to finishing at 1 and 2 life.

**Iron stays greedy**: equipment wears rather than leaving, so raising it
costs no card.

It is deliberately **not** an AI opponent — the standing decision
(2026-07-25) is that the goal is two humans. It is a handful of legible
heuristics and it should stay legible rather than become good. It is also
**not a difficulty curve**: the `[3,4,5]` escalation it replaces was
*tuned*, and real cards from a real hand are not.

### THREE MORE CR FIXES, ALL FOUND BY PROBING STATE

**A wall defends ONE chain link (CR 7.3.2).** `chainBlocked` correctly
stopped a spent piece being re-*declared* (CR 7.3.2b), but the
declaration itself stood until the chain **closed** — so `strike` re-read
`blockG` on link 2 and counted the same iron again, with nothing declared
and nothing paid.

The pool hides this almost perfectly: Silver Age equipment is nearly all
battleworn, so it wears to 0 defence after one block and the second
helping is worth nothing. Against a piece that does **not** wear, a
3-defence plate blocked every link of the chain for free. Hand blockers
escaped by accident rather than by rule — they leave the hand at the
strike, so the link-2 lookup finds nothing.

**`endTurn` skipped the opponent's last priority window (CR 4.3.4).** The
rule ends the action phase "when the stack is empty, the combat chain is
closed, and **both** players pass priority in succession". The explicit
`endTurn` action ran the whole end phase on the spot — the turn player
deciding, alone, that the opponent had nothing to say. Invisible in a
solo trainer, because the dummy never had anything to say; with a human
in seat 1 it silently deletes their last instant window on **every turn
of the game**.

`endTurn` is now a **pass carrying the turn-player's intent**: identical
machinery to `pass`, refused where "end my turn" would be a lie (out of
turn, mid-chain, without priority), and the phase ends on the mutual
pass like the CR says.

**The untap step reached only the gear zone (CR 4.4.3d).** "The turn
player untaps all permanents they control" is the whole arena, not just
the gear zone; a board permanent's `spent` flag never reset. Nothing taps
an ally yet, so this is the step being *complete* rather than a bug being
fixed — and it is the half that has to exist before allies can attack.

And `weaponUsed` conflated **two limits that expire under different
rules**. A TAP is a state the permanent is in and only its controller's
untap step lifts it; `Once per Turn` is a per-turn **allowance** that
comes back for both seats at every turn boundary. They coincide for a
weapon swing — action speed, so a seat only reaches it on its own turn —
which is exactly the kind of coincidence this project keeps getting
bitten by. They stop coinciding at the first `Instant - Once per Turn`
equipment ability, which would otherwise be spent until the end of its
user's *next* turn, having been used once across two.

### Notes

- **694 drills** (was 679), all green; fairness clean.
- Four new judge drills and eleven sparring drills, **every one proven to
  bite** by reintroducing the bug and watching it fail.
- Two drills had to be edited deliberately: they sent one `endTurn` and
  expected the turn to be over, which is the shortcut this removed.
  `passTurn` in `judge.test.js` now ends a turn the way a table does.
- `instantSpeed` deleted from `judge.js` — defined, never called, and
  sitting under a shorter name than the right question
  (`playWindowFor` / `typeCostsAP`). Same reasoning as `DawnGame.shuffle`.
- `sparring.js` is **headless**, in `wire.test.js`'s `HEADLESS` list with
  `judge` and `types`.

---

## v2.45 — Phase 1: the turn structure, against the CR itself

A review pass over the core structure — card types, the numbers, the
turn, and the priority windows — grounded against the published
Comprehensive Rules rather than against the code's own memory of them.
**Nine bugs, and not one of them was a card being read wrong.** Every
affected card parsed perfectly; what was wrong was the machine the cards
run inside, which is exactly the half Phase 1 exists to rebuild.

Eight of the nine were invisible to every tool this project has. The
audit measures coverage, the fairness sweep looks for cards stronger than
printed, and `failstates.js` asks what goes wrong at the table — none of
them asks *whose* hand refills at the end of a turn.

### THE ONE THAT MATTERED MOST — the wrong hero drew (CR 4.4.3f)

> "The turn-player draws cards until the number of cards in their hand is
> equal to their hero's intellect."

Step (e) calls `priority.js`'s `endTurn`, which performs CR 4.4.4's
handoff as well as 4.4.3e's fizzle — so by the time (f) ran,
`n.turnPlayer` was already the **incoming** player. Every turn after the
first refilled the wrong hero, and turn one hid it because there both
seats draw anyway.

**It inverts the decision the whole game is built on.** You refill at the
end of *your* turn so that you have cards to block with during *theirs*.
Drawing for the incoming player instead means every hero walks into the
opponent's turn on whatever survived, and opens their own turn with a
full grip — block-or-hold stops being a choice.

The existing CR 4.4.3f drill read the **log line**, not the hands, so it
was green throughout. The new one counts cards.

### (a) ANNOUNCED ITSELF AND DID NOTHING (CR 4.4.3a)

`resetAllyLife` returns **the game**, not `{game, msgs}`. `judge.js` read
`out.game`, got `undefined`, fell through the `||` to the unchanged state
and threw the reset away — while logging *"(a) Allies recover."* on every
turn of every game. A wounded ally never healed.

The drill that checks the end phase runs a–f **in the CR's order** reads
the log, so it could never see this. A step that announces itself and
does nothing is worse than a missing one.

### AN INVENTED LOSS CONDITION (CR 4.5.3)

CR 4.5.3 lists every way a player loses and there are exactly three:
their hero's life reaches zero or they control no hero (a), an effect
says they lose (b), or they concede (c). **An empty deck is not one of
them.** `drawTo` ended the game by "fatigue" — handing a win to a player
whose opponent was still alive and still holding cards.

A hero who runs their deck out keeps playing, keeps blocking with what is
in hand, and loses on life like anyone. A drill now pins that the only
`how` values the reducer can produce are `life` and `concession`.

**`index.html` carries the same invented rule** (a "Deck empty —
fatigued" loss). Left alone deliberately: the trainer's dummy already
reshuffles its graveyard so it never decks out, so changing it is a
gameplay decision about solo play rather than a rules fix.

### TWO PRIORITY WINDOWS THAT NEVER OPENED

**1. "In succession" is half of every step-end rule.** CR 7.3.4, 7.4.3,
7.5.4, 7.6.4 and 4.3.4 are all worded *"when the stack is empty and all
players pass **in succession**"*. A card resolving between two passes
breaks that succession, and the turn-player gains priority again
(CR 4.2.2 / 7.7.4).

The pass record survived a play, and the shape that produced is the
expensive kind:

```
attacker passes            passed = [true, false]
defender plays a defence reaction     passed = [true, false]   <-- still
defender passes            passed = [true, true]  -> DAMAGE STEP
```

**The attacker never got a window to answer the card just played at
them.** Declaring a defender had the same hole: a turn-player who passed
early never saw the wall they were about to be measured against.

**2. The action phase never ended (CR 4.3.4).** `advance` has no
transition out of the layer step — that step belongs to `declareAttack` —
so a mutual pass left the game in a window **nobody could act in**:
`speedAllowed` correctly returned `[]` for both seats, the turn-player
was refused with "you do not hold priority", and the only way out was an
explicit `endTurn` the CR does not require. `actionPhaseEnds` was right
all along and nothing called it.

### AN UNAFFORDABLE PLAY WAS DECLARED LEGAL

`playableWhy` checked the action point and never asked whether the cost
could be raised at all. `legal` said yes, `doPlay` opened a payment that
could never be completed, and the only move left was to cancel back into
the identical state — **a live-lock for any driver that trusts `legal`**,
which is the reducer's contract and is how both the guest client and the
sequencer decide what to send. It is also a dead tap for a human.

`payCeiling` is the honest maximum: the floating pool plus every pitch
value left in hand.

### ALLIES COULD NOT BE ATTACKED (CR 1.4.5)

An ally is a **living object** (CR 1.4.5a) — it has life, so it is
attackable, and CR 1.4.5 makes declaring an attack-target mandatory.
Allies had been reaching the arena since v2.43 (19 of them across a
15-pairing sweep) and **nothing could touch them**: a body that blocks
nothing, dies to nothing and costs the opponent nothing to ignore.

Every helper already existed in `game.js`, drilled, and called by nobody.
The target now rides on the **action** (`{t:"play", uid, target}`) rather
than in a prompt, so the reducer stays pure and serializable — the same
action drives a tap, a replay and a peer.

**CR 7.3.2a is what makes it a decision.** Only a hero attack-target may
have defending cards declared for it, so an attack on an ally always
connects and it kills. Omitting `target` still means the hero, which is
always a legal choice; offering the choice is the caller's half.

### AND TWO SMALLER ONES

- **CR 4.4.4** — the per-turn ledger (`hist`) cleared only for the
  incoming seat, so a card asking "have you pitched a blue this turn"
  during the opponent's turn read *your* turn's answer.
- **A `Resource` card reported playable with no window to play it in.**
  `Inner Chi` is a `Mystic Resource - Chi`: no cost, no rules text, pitch
  3. It was refused two steps later with "cannot be played in the action
  phase", which reads like a timing problem rather than what it is.
  `isPlayable` now asks the window table instead of a second list, so the
  two cannot disagree. The drill that would have caught it never looked
  at the card — `pool()` in `types.test.js` covered the fifteen decks and
  not the dummy's pile or the two runtime-minted records.

### WHAT WAS CHECKED AND FOUND CORRECT

Worth recording, because a review that only lists faults is not a review:

- **Lyath Goldmane's intellect is 5**, every other hero's is 4, and that
  number flows correctly from the database through `buildSide` to a
  five-card opening hand.
- **The type census is a true partition** — 434 unique cards over nine
  card types, none typed twice, nothing untyped.
- **A chain link walks all six CR windows** in order with the right seat
  holding each: attack (7.2.4), defend (7.3.3 — the *turn-player*, while
  the defender declares), reaction (7.4.2, split by attacker), damage
  (7.5.3, dealt on **entering**), resolution (7.6.3, action speed for a
  second link), close (7.7.1, nobody holds priority).
- **Equipment wear**: battleworn, temper, guardwell and blade break all
  apply, `chainBlocked` stops a piece re-blocking the same chain, and a
  0-defence piece is refused as a defender.
- **The damage arithmetic is CR 7.5.2** — power minus the summed printed
  defence of the declared cards, floored at zero.

### MEASURED

A greedy policy driving all fifteen precons at each other, before and
after:

| | games finished | actions | invariant violations |
|---|---|---|---|
| before | 8 / 15 | 29,463 | 0 |
| after | **15 / 15** | 3,198 | 0 |

The 10× drop in actions is the draw fix: hands now deplete the way they
do at a table, so a greedy bot runs out of things to do instead of
playing forever off a hand that silently refilled. Every game ends on
life, which is CR 4.5.3a and now the only way a game can end.

679 drills. Each of the nine fixes has a drill, and **each was verified
to bite** by reintroducing the bug and watching it fail by name.

---

## v2.44 — a reaction cannot be an action

**Reported by the user, who reads cards for a living, and they were
right.** v2.43 claimed Den of the Spider and Lair of the Spider were
dual-typed `Action Defense Reaction` cards. They are not. They are
Defense Reactions, and `Assassin / Warrior` is **deck legality** — who
may include the card, and how other cards refer to it — not a claim
about what the card is.

### The database says it twice, and the two disagree

| field | Den of the Spider |
|---|---|
| `types` (structured) | `["Assassin","Warrior","Defense Reaction","Trap"]` |
| `type_text` (display) | `"Assassin / Warrior Action Defense Reaction - Trap"` |

`mapDbCard` read `type_text` and threw the structured array away. A
sweep of all **4,862** database records found the two fields disagree on
exactly **5**: the two Spiders (display adds a stray `Action`) and Comet
Collision ×3 (display says `Instant`, array says `Action` — not in the
Silver Age pool).

**The consequence was a sev-3 illegal play.** Both Spiders were playable
in the action phase for an action point. No card-level tool could see
it: the card's *text* parsed perfectly, coverage said `full`, and the
fairness sweep looks for over-granted effects, not for a card being the
wrong type.

### The fix, and the one exception

`mapDbCard` and `resolveEntry` now carry `ty` alongside `tt`, the loader
in `index.html` mirrors both, and **`DATA_VER` is `sage-v11`** — a warm
`sage-v10` cache has no `ty` on any card and would silently fall back to
parsing the display string.

**A double-faced card is the one place the display string knows more.**
`Arcane Seeds // Life` flattens to `["Runeblade","Action","Earth",
"Instant"]`; only `type_text` keeps the `//` boundary. You play the
FRONT face, so DFCs parse the front of the string. Reading the flat
array calls two real action cards instants and hands each of them a free
action point — v2.39's bug returning through another door, now drilled.

Also fixed on the way: an equipment slot word was landing in `classes`
(`Necromancer Equipment - Head` → `["Necromancer","Head"]`).

### The census is now an exact partition

Seven card-type counts summing to **exactly** 401 unique cards, none
typed twice. That is the shape that catches this class of misread, and
it did not hold in v2.43 — the two Spiders were double-counted and the
drill absorbed it as "2 dual-typed". Five drills now fail if the display
string is trusted again, verified by reintroducing the bug.

---

## v2.43 — Phase 1: card types, and the numbers

The half of Flesh and Blood that needs no text box. Phase 3 takes the
text boxes; this pass makes every card *type* behave correctly from
pitch to play, in a two-player game, under the CR's turn structure.

### `engine/types.js`

The pool prints **138 distinct type lines** over 401 unique cards, and
they are regular: `[classes and talents] <TYPE>… [ - <SUBTYPE>… ]`.
`cardType()` parses one into a structure and every question is asked of
that — one parse, one answer, instead of the six ad-hoc regexes the
trainer spreads the same question across.

Validated against the whole pool: it agrees with `parser.js` on attack,
reaction and instant for **all 401 cards**, and with `game.js` on every
equipment slot.

**Three things the pool prints that a naive reader gets wrong:**

1. **A card can have TWO types.** Den of the Spider and Lair of the
   Spider are `Action Defense Reaction` — playable in the action phase
   for an action point, or in the defence window for none. A reader that
   matches one type and stops refuses them half the time.
2. **`Block` is a type with no play.** Test of Might, Test of Strength,
   On the Horizon, Crash and Bash. No printed cost, 4 defence, all
   reading "When this defends, …". Treated as ordinary non-attacks they
   were free 0-cost plays that did nothing.
3. **`Reaction` contains `action`.** A scan that is not word-boundary
   anchored and longest-first reads every reaction as an Action.

**Permanents now reach the arena.** An Aura, Item or Ally that resolves
to the graveyard is a card the player paid for and never receives — 12
auras, 5 items and 6 allies in the pool. Allies carry printed life onto
the board, which is what makes them attackable (CR 1.4.5a). Verified in
a real game: Gravy Bones fielding three allies against Viserai's sigils,
zero invariant violations.

**A null cost does not mean unplayable.** `Ice Eternal` and `Night's
Embrace` carry `cost: null` because their cost is X or absent from the
record. Playability is decided by TYPE, always.

**The type census is a partition, and a drill proves it**: seven card
types summing to 403, minus 2 dual-typed, equals 401 cards exactly —
with `attack` (175) a *subset* of `action` (269) rather than a peer.

### A correction to v2.42

v2.42 claimed Sledge of Anvilheim and Scorpio, Comet Tail were both
repeatable because neither prints "Once per Turn". **Half wrong.**
Scorpio pays `{t}` — it taps, and a tapped permanent does not untap
until CR 4.4.3d. It is limited to one swing per turn for a completely
different reason. Only the Sledge is genuinely repeatable.

Reading only `oncePerTurn` would have made Scorpio **stronger** than
printed, which is the direction that steals games. `weaponCost` now
returns `taps` as well, and `judge.js` honours both.

### `legal()` threw instead of refusing

Playing from the arsenal crashed the reducer: the arsenal holds one card
or null, not a list, and the list path ran straight into it. A legality
check that throws breaks the reducer's contract in the caller rather
than returning a reason.

The "never throws" drill missed it because it only ever probed
`from:"hand"`. It now sweeps every zone, on two states, and both it and
the arsenal round-trip drill are verified to fail when the bug is put
back.

---

## v2.42 — Phase 1: the rules leave the component

The first landing of the engine rebuild. Two new modules, 46 new drills,
and three real bugs that only became findable once the code was somewhere
a drill could reach it.

### `engine/build.js` — how a seat becomes a hero

`buildSide` and the equipment slot rules moved out of `index.html`. Both
are rules: a build reads a hero's printed passives off its own text and
deals from the seeded stream, and `defaultPicks` decides how much iron a
hero may legally wear. Neither had a drill, which is precisely why the
v2.41 eight-gear bug shipped — every card was read correctly and the
*quantity* was illegal, a question no card-level tool asks.

`buildSide` takes no seat argument and branches on no seat; a drill
enforces that. `buildSideDefault` equips and builds in one call, so both
seats reach one set of slot rules rather than two.

**A BOW PRINTS NO POWER, AND THAT DISQUALIFIED IT.** `defaultPicks` gated
the two-hander on `twoH.c.power != null`. Azalea's Death Dealer is a
`Ranger Weapon - Bow (2H)` with `power: null`, so she defaulted to **no
weapon and no quiver** — for the player's own loadout as much as the
opponent's, and her whole deck is arrows. The check never did any work:
`slotOf` only returns `z:"2h"` for a printed `2H` type line. Gone, and
two drills fail if it comes back.

Not "every hero gets a weapon", though — Gravy Bones's precon prints none
at all (four armour slots and an off-hand compass), so the drill asks the
honest question: is a *printed* weapon ever left in the box.

### `engine/judge.js` — the rules as a pure function

`reduce(state, action, seat) -> state`, and **the one thing it replaces
is that the trainer resolves the same CR procedure through two unrelated
bodies of code**:

```
you attack   tryPlay -> execute -> dummyDefence -> mode:"stack" -> resolveStack
they attack  foeSwing -> mode:"block" -> toggleBlock -> finishBlock -> takeIt
```

One fabricates the attack as `[3,4,5][(turn-1)%3]`; the other auto-picks
the blocks. Neither can serve a second human, and a rule fixed in one
stays broken in the other — which is how clash fired on the wrong trigger
for five versions. Here there is one path and the swinging seat is an
argument.

It restates **no** priority rule: `canAct`, `speedAllowed`,
`canDeclareDefenders`, `passOutcome`, `advance` and `endTurn` all come
from `priority.js`. There is no `mode` and no `bphase`, and a drill fails
if either appears.

Two corrections to `actions.js`'s reference shape, both real:

- **Damage lands on ENTERING the damage step, not on leaving it** (CR
  7.5). A blank game has nothing hanging off a hit; a real one has a
  window in which the hit has already happened.
- **The combat chain is a ZONE.** A declared attack has left its hand and
  not reached a graveyard. Held in a private field it is in no zone at
  all — and `invariants.js` catches a card in *two* zones while a card in
  *none* falls out of the census silently. `chainCards` is now censused,
  and a drill duplicates a chain card into a graveyard to prove the judge
  names it.

Verified by driving two real precons at each other: a 17-turn game, 261
actions, zero invariant violations, every dealt card in exactly one zone,
and both seats attacking, defending, drawing and ending turns through the
same code.

**It is deliberately HEADLESS** — declared so in `test/wire.test.js`'s
ledger. It models the turn structure, the chain and the costs, but not
yet card *effects*; those are still `runOps`/`execute` in the trainer.
Loading it now would put a second, quieter rules engine on the page next
to the real one.

### "Once per turn" is printed, not universal — and it is not the only limit

Found while giving `judge.js` a weapon swing. Of the pool's eleven
swinging weapons, nine print `Once per Turn`. **Two do not, and they are
not the same case as each other:**

| | printed | why it is limited |
|---|---|---|
| Sledge of Anvilheim | `Action - {r}{r}{r}{r}: Attack` | **it isn't.** Pay four again, swing again. |
| Scorpio, Comet Tail | `Action - {t}: Attack. …` | the **tap**. A tapped permanent does not untap until CR 4.4.3d. |

Gating every weapon on a blanket "already swung" flag — which is what
the trainer does — makes the Sledge strictly **weaker than printed**.
Reading only `oncePerTurn` and ignoring `{t}` would make Scorpio
**stronger** than printed, which is the direction that steals games.
`weaponCost` now returns both `oncePerTurn` and `taps`, and `judge.js`
honours both.

Neither sweep can see either one. `npm run fairness` is deliberately
one-sided towards cards that are too *strong*; coverage says `full` for
both, because the text was read correctly and then **charged** wrongly.
Same shape as the instant that ate an action point in v2.39.

---

## v2.41 — the opponent picks a hero

`ROADMAP-OPPONENT.md` Phase 1, and step 2 of the honest order in
`HANDOFF.md`. Seat 1 is built by `buildSide` like any hero: real life
total, real intellect, real equipment, real 55-card deck. It still takes
**no action phase**, so it blocks with printed defence and nothing more —
which is why a real deck is safe here. The roadmap's standing warning
("do not give it a real deck until the opponent can resolve the cards in
that deck") is about *playing* cards, and blocking with printed defence
works for any card without the parser reading a word.

**The Dummy stays selectable and stays the default.** It is the
regression harness for every phase above this one, and its vanilla pile
is the one deck where nothing can be faked.

### The hero passives were seat 0's, silently

`built.viseraiPassive` meant *the player's* Viserai — the same
seat-0-means-the-actor confusion the actor/perspective split fixed for
zones in v2.24, one layer up. `built.both[i]` is the ledger and `bAct(s)`
is its reader; five rules sites moved onto it (`viseraiPassive`,
`lyathBoo`, `iceFrostbite`, `arsenalInstant`). Only the UI still reaches
`built.*` directly, because the UI renders seat 0 by definition.

There is deliberately **no `bFoe`** — nothing needs one, and a dead
helper beside a live one is how `sides.js`'s `you`/`foe` came to be
deleted in v2.24.

### The landmine, defused

`DUMMY_INT` is gone from `newTurn`; the refill reads `opp(s).int`, a
property of whoever is sitting there. It is still the stand-in for the
turn seat 1 never takes, and it is still the **only** refill site — which
is exactly what the roadmap warned about. When seat 1 gets a real end
phase the draw moves there and becomes turn-1-only for both seats (CR
4.4.3f); adding that without removing this draws twice.

**The graveyard recycle stays a dummy affordance.** "A sparring partner
that decked out would stop sparring" is true of the prop and false of a
hero, so a real opponent runs its deck down and simply has fewer blockers.
It does not yet *lose* for it — what decking out costs is a win condition
the player cannot currently reach, and the roadmap says to decide that
once, at Phase 2. Both approximations are logged rather than silent.

### Caught in play: the opponent was wearing eight pieces of iron

Passing `{}` for the opponent's loadout handed Azalea all **eight**
printed pieces — two helms, two legs, the lot — where the slot rules
allow about five. Not cosmetic: `dummyDefence` raises one piece per
attack and `chainBlocked` only stops a piece re-blocking the *same*
chain, so every extra piece is another free block later in the turn.
Strictly stronger than printed, which is the direction that steals games.
Both seats now go through `defaultPicks`, the same function the loadout
screen uses, so one set of slot rules governs both.

Found by opening the game and reading the dealt state, not by a drill —
as usual.

### Where it is chosen

The **scout panel**, not the throw: you see the opponent's hero and *then*
you sideboard. Putting the pick after the loadout would show you the
matchup too late to use it, which is the one thing that panel exists to
prevent. It rides in `cfg`, which already flows Loadout → Pregame →
Battle. Deliberately **not** saved per hero the way the loadout is — the
opponent is a property of the match, not of your deck.

The scripted swing now announces itself every time (*"Azalea swings for 3
— scripted escalation, not a card from hand"*), per Phase 0's rule that
the sequence is the lesson. Roughly two dozen log and UI strings that said
"the dummy" now read the seat's own name, via `foe(n).name` / `opp(g).name`
so they stay correct once seat 1 acts.

### Known, and pre-existing

- `CHAIN-CLOSED-WITH-LINKS` fires on the opponent-first opening —
  `foeSwing` pushes a link without opening the chain. Confirmed present
  before this change; not introduced here.
- `defaultPicks` gates 2H selection on `power != null`, and **bows print
  no power**, so Azalea defaults to no weapon and no quiver. Affects the
  player's own loadout too. Harmless while seat 1 never attacks; it
  matters at Phase 2.

---

## v2.40 — a reaction belongs to the reaction step, and to one seat in it

Found while fixing v2.39 and fixed on the user's call. Two rules, and the
trainer honoured neither:

| CR | |
|---|---|
| 8.1.2a | an attack reaction "can only be played/activated by a player who **controls the attack** during the Reaction Step of combat" |
| 8.1.3a | a defense reaction "can only be played/activated by a player who **controls a hero as an attack-target** during the Reaction Step" |

**1. `tryPlay` accepted a reaction straight out of the action phase — 23 pool
cards.** The gate only asked whether `fxParse` had found something playable and
never looked at the printed type, so Reduce to Runechant minted a runechant on
your own turn and the four Warrior reprise attack reactions fired with no
attack to react to. That is the sev-3 "illegal play allowed" category: the
player wins games they should lose, and the sim teaches wrong play. It now
refuses and names the window the card belongs to.

**2. The attack-reaction window admitted any non-attack carrying a pump.** The
test was `isAR(c) || instant || (!isAttack(c) && fx.self > 0)`, and that third
disjunct let three plain **Action** cards — Flying High, Hit and Run, and Cutty
Shark, Quick Clip — be played in the reaction step, where no action card is
legal.

**3. Five hand-rolled copies of one question.** `playRx`, `playRxA`, `handAct`,
`handCell`'s dim and the arsenal row in `playables` each spelled out
`fx.dr || (isInstantT(c) && fx.ops.length > 0)` for themselves. Five chances to
drift, and the dim drifting from `playRx` is precisely a card that looks
playable and does nothing when tapped. `DawnParser.rxAllowed(card, window)` is
now the single statement and all five ask it; `fx.dr` is `isDR`'s answer rather
than a second copy of the regex.

`speedAllowed` already split the reaction step into two windows by attacker
(v2.27) — the gap was only ever the card half of the question. The seat half
needed no change, which is what made this small.

The refusals **say why** rather than dead-tapping, in both directions: an
attack reaction tapped in the defending player's window is told whose window it
is. `advisor.js` no longer offers a reaction as an action-phase candidate —
coaching a play the game then refuses is worse than not coaching it.

Seven drills, each verified to bite by reintroducing the bug it names.

---

## v2.39 — the action point is an ACTION's cost, not a per-play tax

Reported from the table: **instants were consuming the action point.** They
were, at two sites, and both were hand-rolled answers to one rule:

| CR | |
|---|---|
| 8.1.1 | "An action card/activated ability has the additional asset-cost of one action point to play/activate." |
| 8.1.6 | "A card/activated ability with the type instant can be played/activated any time the player has priority." — no such cost |
| 5.3.5 | "If the layer has go again, the controlling player gains 1 action point." |

`tryPlay` refused *any* play at 0 action points, and `execute` settled every
non-attack with `ga ? keep : -1`. So an instant cost a card **and** the turn's
action:

| card | printed | what it did |
|---|---|---|
| Energy Potion | Instant - Destroy this: Gain {r}{r} | spent your action to gain 2 resources |
| Achilles Accelerator | Instant - Destroy this: **Gain 1 action point** | netted to **zero** — the equipment did nothing at all |
| Frost Spike, Memorial Ground, Act of Glory … | 24 instant cards in the pool | each one ended your action phase |

**Coverage could not see any of it.** Every card above reads as tier `full` —
the text was read correctly and then *charged* wrongly, the same blind spot
the fairness sweep exists for (and the sweep is one-sided by design: this is a
card being weaker than printed, not stronger).

`DawnParser.costsAP` states the rule once and both trainer sites ask it.
The arithmetic is now spelled out rather than folded into a ternary —
`ap - apCost + (ga ? 1 : 0)` — because CR 5.3.5 is a **gain**, not a refund:
for an action that is spend-then-gain (the familiar "kept"), and for an instant
it is a genuine +1. Identical arithmetic to before for every action card.

**26 pool cards also carry an "Instant - …" activated ability** — Spellfire
Cloak, Talismanic Lens, Pouncing Paws, Seeker's Mitts and the rest. They answer
through the same helper via the `_instant` flag `parseHeroPower` already
stamped on their powCard, so equipment did not need its own branch.

**The double-faced type line is read front-face-first, and that guard is what
keeps the fix honest.** `isInstantT` tested the whole printed line, so
`Arcane Seeds // Life` and `Burn Up // Shock` — "Runeblade Action // Earth
Instant" — read as instants. You play the *front* face; the back is reachable
only by melding. Left alone, the fix would have handed two real action cards a
free action point: strictly stronger than printed, the direction that steals
games. `isAR` reads the front face for the same reason.

`advisor.js` returned "End turn — action point spent." the moment the point was
gone, which now coaches past a live instant. It builds its candidates either
way and filters to what is still legal (instants, plus the ally swing the
trainer models as free and says so).

Seven drills, each verified to bite by reintroducing the bug it names.

---

## v2.38 — a table number, and two devices at it

The sync layer is no longer headless. All four modules are in index.html's
script tags and in `test/sync.test.js`'s `MODULES`; `wire.test.js`'s `HEADLESS`
list is now empty.

**`engine/room.js` — the only file in the engine that knows a network exists.**
PeerJS rather than Trystero, for one reason: PeerJS ships a **UMD build** that
loads with a plain `<script src>`, and Trystero is ESM-only, which would mean
`type="module"` and no `file://`. It loads **lazily**, on the first tap of *Find
an opponent*, so the solo trainer and a `file://` page pay nothing for it.

The table number falls out of PeerJS's model instead of being bolted on: a peer
may claim a chosen id, so the host claims the table's and the guest dials it.
"That table is taken" and "nobody is sitting there" become real answers from the
relay rather than states we invent.

Three things that are not optional, each with a drill:

- **The id is namespaced** (`dawnblade-v1-<CODE>`). The public relay is shared
  with every other PeerJS app in the world; an unqualified "42" would collide
  with a stranger's project and look like a Dawnblade bug.
- **The channel is `{reliable:true}`.** PeerJS does not default to it, and
  `net.js` treats a sequence gap as a dead channel rather than reassembling — an
  unordered channel would resync in a loop.
- **A third phone is turned away** before its channel opens. A second guest
  would become a second actor whose intents the sequencer would interleave into
  somebody else's match.

The **table code is the match seed**, which is rng.js's own stated goal: both
peers derive the same seed from the same room code without exchanging it. The
code alphabet drops I, L, O, 0 and 1 — it is read off one phone and typed into
another across a table, so legibility beats entropy.

**The message sink buffers until somebody listens.** The channel opens before
there is a session to feed it, because the session needs the `send` the channel
provides. Anything arriving in that gap is held and flushed on `listen`; without
it the handshake is dropped and the guest sits on "connecting" with no error.

**`test/sync.test.js` caught a real collision on the first run.** `TableMatch`
declared `const seat = host ? 0 : 1` — and `priority.js` exports a `seat` helper
meaning "seat a game". Same name, different meaning: the exact trap that made
`tapTwice`'s `act` shadow the actor helper in v2.25. Renamed to `mySeat` rather
than pinned, per the standing rule.

**Played across two clients over the real public relay**, not just drilled:
table QZHF, both clients on hash `c048c95cd0709361` at the deal, an attack and a
defender declaration crossing the wire, damage resolving 5 − 3 = 2, and both
ending the chain on `5873c4d96a63e637` with clean consoles and both graveyards
filed.

### What the table cannot do yet, and why

**Two hero decks still cannot cross the wire, and that is a rules gap rather
than a network one.** `foeSwing` fabricates the opponent's attack as
`[3,4,5][(turn-1)%3]` — seat 1 emits a *number*, not a played card, so there is
nothing for a second human to occupy. `Battle` is also 22 `setG` closures rather
than a `reduce(state, action)`, so there is no reducer for `net.js` to drive
even once seat 1 can act. That is Phase A step 4 plus Phase B step 6, and it is
the same work whether the opponent is across the table or across the internet.

Until then the table runs the blank decks: a real two-player game of the CR turn
structure, priority and combat chain, just not of Flesh and Blood cards.

505 -> 522 drills.

---

## (engine only, no APP_VER bump) — the sync layer: two phones, one game

**`index.html` is untouched, so nothing ships to players and `APP_VER` stays
at v2.37.** This is `ROADMAP-MULTIPLAYER.md` Phase B steps 7 and 8 built
headless: three modules, 72 drills, no UI. `test/wire.test.js` pins that they
are *deliberately* not loaded — every `engine/*.js` file is either in
index.html's script tags or in its `HEADLESS` list, so wiring one up without
updating `test/sync.test.js`'s `MODULES` fails a drill by name.

### `engine/wire.js` — the game as one JSON object

Cards are interned as `[dictIndex, overrides, deletions?]`, the overrides
found by **structural diff** rather than a hardcoded field list — so `uid`,
`_gy`, gear's `curDef`/`destroyed` and the arsenal's `_faceUp`/`_arsPow`
stamps all ride automatically, and a card that grows a field ships it without
a code change. **Nothing here reads card text.** With a catalog (the loader's
own cache) definitions stay off the wire entirely: 8818 -> 3705 bytes on a
blank opening board, and far more on a real one where `name|pitch` repeats.

`decode` refuses four ways rather than guessing — wrong `WIRE_V`, a catalog
hash mismatch (**two clients on different `DATA_VER` are refused at the
handshake, not discovered on turn six**), a bare key with no catalog, and a
rebuild that does not match the sender's fingerprint.

**The hash excludes `log` and `feed`, and that is not an oversight.** Taunts
and trophy text are on `Math.random` by design, so two honest peers are
*guaranteed* to differ there and hashing them would report a desync on every
action. `inspect`/`boostOn` (per-client UI) and art URLs are out for the same
class of reason. `rng` is in — `rng.n` is the canary rng.js already names.

`JSON.stringify` could not be the fingerprint: it preserves insertion order,
so a peer rebuilt from a snapshot would hash differently from one that
reached the same game through the reducer, and **every reconnect would look
like a desync**.

`diffPaths` is the payoff — a mismatch arrives as `/sides/1/grave/0/uid`
instead of two hex strings.

### `engine/net.js` — the session

Transport-agnostic on purpose: it takes `send`, exposes `receive`, and a
drill scans it (comments stripped) for any transport name. **The
recommendation is WebRTC DataChannel** — GitHub Pages has no server to
terminate a WebSocket, so `ws://` is a backend to build, which is Phase C.
`wsAdapter` is written anyway so the Phase C seam is proven; `loopback()`
with `drop`/`delay` is what the drills run on.

**Priority is the lock — except in the defend step.** CR 7.3.2 makes
declaring defenders free and simultaneous while CR 7.3.3 gives the
turn-player priority in the same step, so there and only there both seats can
legally act at once. Hence a **sequencer**: one peer orders actions and
nothing else. It is not authoritative over outcomes — both peers run the
identical reducer and both verify — which keeps Phase C a relocation rather
than a rewrite.

**Two bugs found by the drills, not by eye:**

1. **An infinite repair loop.** A diverged peer is level on `seq`, so every
   cheap resync test concluded it needed nothing — or sent it a log replay,
   which reproduced the same wrong answer over the same wrong state, so it
   asked again. `force` is now checked *first* in the RESYNC handler.
2. **The race drill proved nothing.** A guest applying optimistically
   diverges, gets caught by the hash, and is snapped back — so the end states
   agree and the test went green. It now pins `desyncs === 0 && resyncs === 0`:
   ordering must make the divergence *impossible*, not survivable.

Three mutations were reintroduced and each makes its drill fail: dropping
`rng` from the hash, undoing the `force` ordering, and the optimistic apply.

### `engine/actions.js` — six blank actions

`pitch · pass · attack · defend · roll · endTurn` over cards with `tx: ""`
and no keywords. **No card from the pool is touched** — one drill reads every
card in a match and fails on any rules text, another fails if the module ever
imports the parser. It is a real driver of `priority.js` (nothing about
priority is restated) and explicitly *not* the game's rules; `judge.js`
replaces it wholesale, which is why `net.js` takes `reduce` as a parameter.

**The close step was a deadlock.** CR 7.7.1 gives nobody priority there, so
no player action can drive it out and the game parked in a step neither seat
could leave. `priority.js` already said so — `advance` is the one step it
lets through without checking `windowClosed` — and the caller has to honour
it. Also: chain cards are now filed to the graveyard at close, turn-stamped.
A card in *two* zones is what `invariants.js` catches; a card in *none* falls
out of the census entirely, so a drill counts cards before and after.

**Still true, and stated rather than papered over:** both peers hold full
state, including the opponent's hand. That is fact 4's deliberate Phase B
position and it is not fixable by redaction — a peer that cannot see the
state cannot run the reducer. Hidden information needs Phase C's server.

432 -> 505 drills.

---

## v2.37 — the preview gets out of the way, and priority gets its first consumer

### The preview sits above the hand now

v2.36 stopped `.peekwrap` *eating* the tap. It was still **hiding** it: a flat
`bottom:112px` cleared the action bar, but on a 393x852 phone the hand rail
landed directly underneath the preview, so the two-tap asked you to choose
between cards you could no longer see.

The offset is now **measured** off the live rail rather than guessed — the
rail's height depends on which screen is showing and on card size, so a
hardcoded number would be wrong again at the next layout change. A `uE`
measures `.phand`/`.chand`/`.hand`, sets `--peekbot` to the distance from the
viewport bottom to the rail's **top** edge plus a small gap, and re-measures on
resize so a rotation cannot strand it. The old flat 112px survives as the
fallback for the first frame and for screens with no rail.

Verified at 393x852: `--peekbot` resolves to 235px, the preview's bottom edge
lands at y617 against a rail top of y626 — it clears. The whole hand stays
visible under the preview with the tapped card highlighted, and the second tap
commits (played Lace with Bloodrot end to end, zero invariant violations).

### `playRx` is the first consumer off `mode`/`bphase`

Roadmap item 1's last step starts here. `playRx` hand-rolled its window as
`inAtk = s.mode==="stack"` plus an inline reaction test — and **that test
cannot express the rule it stands in for**: the reaction split follows the
ATTACKER, not the seat number. With one acting side those coincide, so it was
right by accident. It now asks `DawnPriority.speedAllowed(s, 0)`.

Behaviour-identical today, correct the moment seat 1 attacks. One deliberate
change falls out: a finished game now opens no window at all, where the old
`mode` test would still have let a reaction through with `mode:"stack"` after
the game ended.

Six drills pin the mapping per trainer state, and a seventh fails if `playRx`
reads `s.mode` or `s.bphase` again — proven to bite by restoring the old test.

**87 `mode`/`bphase` references remain.** The next consumer is the hand-dim
logic in `handCell`, which duplicates `playRx`'s old expressions verbatim
(`rxD`/`rxA`) — migrating it removes the duplication rather than moving it.

**413 drills**, green.

## v2.36 — hand cards were unplayable on a phone

Found by testing at a real **393x852** phone viewport instead of a tall
desktop window. It is invisible on a tall window, and it is a showstopper on
the only device this game is built for.

`.peekwrap` — the two-tap preview — is `position:fixed`, full width, and
mostly empty space. With `pointer-events:auto` that empty space sat **on top of
the hand rail**:

1. first tap arms the peek;
2. the peek panel renders over the rail;
3. second tap hits the wrapper's own `onClick={()=>setPeek(null)}` instead of
   the card — so it *dismisses* rather than commits.

Tap, peek, tap, peek, forever. **No card in hand could be played.** On a tall
window the rail sits below the panel and nothing overlaps, which is why every
previous session's testing missed it.

The CSS comment above the rule had said the right thing all along — *"the rail
underneath stays visible and the second tap has somewhere to land"* — it just
was not true. `.peekwrap` now takes no pointer events and `.peekwrap>*` takes
them back, so the visible preview still dismisses on tap while the empty area
falls through to the card.

Verified at 393x852 with the peek open: `elementFromPoint` at the card's centre
returns the card (was `DIV.peekwrap`), and the second tap reaches `tryPlay`.
Pinned by a drill, proven to bite. `.peekwrap` was the only mostly-empty
full-width overlay — `.modal`, `.psheet`, `.actbar` and `.bugwrap` are opaque
or all-controls by design.

**406 drills**, green.

## v2.35 — printings, the turn structure, and the arena

Three things the user asked for, none of which the drills could have found.

### Every card wears its Silver Age face

`resolveEntry` fell back to `pr._first` — whatever printing the card database
happened to list first, which is arbitrary order rather than a choice. That is
why an Azalea deck showed GEM, 1HP, PEN and DDD art side by side.

The order is now: an explicit code on the deck entry, then this hero's own
Silver Age set, then any Silver Age set, then `_first`. Measured across all
503 deck entries: **467 resolve to their own hero's precon set** and 34 to
another Silver Age set (deliberate explicit codes for cards not printed in
their own). Nineteen codes pointing outside Silver Age were removed.

**The Dawnblade is the only Marvel card in the pool**, and an explicit code now
*wins* over the set preference — without that fix it silently reverted to
SDO002, overriding the author's choice without a word. One honest exception
remains: Enigma Chimera at pitch 2 has no Silver Age printing at all, so it
falls through rather than being given a face that does not exist.

`DATA_VER` → `sage-v10`: cards carry a new `prs` map (image per set), and a
warm `sage-v9` cache has none of it.

### The end phase follows CR 4.4.3, in the CR's order

Grounded against `rules.fabtcg.com`. The procedure is **ordered**, and the
trainer ran `e → c → b → f` with two steps missing entirely:

| CR | step | before |
|---|---|---|
| a | allies reset to base life | **never happened anywhere** |
| b | turn-player may arsenal | ran after (c) |
| c | pitch to the bottom of the deck | ran before (b) |
| d | turn-player untaps | folded into *next* turn's setup |
| e | **all players** lose points | only the turn-player |
| f | turn-player draws to intellect | ✓ |

(d) and (e) are invisible while one seat acts and are real two-player bugs the
moment a second seat has a turn between yours — a permanent would stay tapped
through the opponent's turn, and a hero who banks a resource during your turn
would keep it. The action point also moved to the beginning of the **action**
phase where CR 4.3.2 puts it, behind a real start phase (CR 4.2).

**The arsenal set is an end-phase step, not an action.** `fromTrainer` mapped
`mode:"arsenal"` to the action phase with the player holding priority, which
CR 4.4.1 forbids — and which `PRIORITY-IN-CLOSED-PHASE` could never catch while
the mapping itself said otherwise.

### More log, and the turn structure narrates itself

Every CR 4.4.3 step now announces itself, including when it does nothing —
in a *training* sim the sequence is the lesson. Declaring or withdrawing a
defender used to be completely silent and now logs. The on-screen strip went
from 4 lines to 8.

### A permanent in the arena can be activated

The board's `onClick` opened the zoom modal for anything that was not an ally,
so **Energy Potion** and **Timesnap Potion** — both "Destroy this: …" — were
decoration. Board permanents now build a `powCard` the way gear does, routed
through the same pool-first-then-pitch-or-cancel flow, and `execute` pays the
destroy cost into the turn-stamped graveyard.

Allies keep `allySwing` for now: their attacks are costed (`{r}`, `{t}`) and
belong with the attack-target wiring (CR 1.4.5), which is a bigger job.

**403 → 405 drills**, fairness clean, pool unchanged at 265 full.

## v2.34 — the arsenal cluster closes

v2.33 built the face-up mechanism and one enabler. This finishes the other
two, and each was inert for a *different* reason:

- **Bull's Eye Bracers** — `parseHeroPower` refused any conditional effect, so
  the whole ability was dropped and the equipment had no button at all.
- **Death Dealer** — a Bow, so it took the weapon path; `weaponCost` requires
  `": attack"` and this ability is a put, so nothing claimed it. Weapons can
  now carry a non-attack activated ability, through a door deliberately narrow
  enough that no other weapon grows a button nothing is wired to run.

**Three bugs found on the way, none of which the coverage audit could see:**

1. **The Bracers were pumping themselves.** "It gains +1{p} until end of turn"
   — "it" is the **arrow that was just put**, not the equipment. Both the
   clause router and the whole-text self-pump fallback read it as the source's
   own pump. Same wrong-subject shape as v2.30's arrow buff landing on a sword.
2. **The stamp was being dropped entirely.** `buildPrompt` carries only the
   fields it knows, so `arsStamp` never reached `promptConfirm` and the +1
   would have silently done nothing. Caught by a drill, not by eye.
3. **Death Dealer's rider was filed unread**, holding it at `part` after it was
   genuinely wired. The clause ledger is corrected only when the ops are
   actually claimed.

**Arsenal capacity is modelled, not assumed.** Two printed wordings that are
not the same question: a plain put needs a **free slot**, while "if you have no
cards in your arsenal" means **zero**. They coincide at capacity 1, which is
exactly why hardcoding 1 would have hidden the difference. `arsCap` / `arsFree`
/ `arsEmpty` live in `parser.js` beside `runeCount`; the storage is unchanged.

**Measured:** 263 → **265 full**, 110 → 108 part. `npm run fairness` clean.
381 → **391 drills**, and the two that matter are proven to bite by
reintroducing the bug.

**Still unclaimed on purpose:** Entangling Shot (taps a hero, not modelled) and
Spire Sniping (a *reorder*, which `opt` is not — `opt` permits bottoming, which
would be strictly more powerful than printed).

## v2.33

THE ARSENAL GOES FACE UP — Azalea's engine, 3 cards none -> full. The trainer's
end-of-turn arsenal sets cards FACE DOWN; these arrows trigger on FACE UP, which
is a different event reached only by an enabler that says so. Conflating the two
would fire triggers the cards do not have. Built machinery-first so the parser
reading came on LAST — never parse ahead of wiring. A card put face up carries
`_faceUp`/`_upTurn` on the card itself (like a minted card's `_playTurn`), so no
new side field: the arrow's payload is STAMPED onto it (`_arsPow`, `_arsGA`)
rather than run immediately, because "+2{p} this turn" and "go again this turn"
must survive until the arrow is actually played later that same turn — and
expire if it is not. Dry Powder Shot 3 -> 5 power the turn it is set, back to 3
after; Swift Shot goes again that turn only. Enabler wired: Call in the Big Guns,
whose subject is read ("an arrow") so it cannot put a non-arrow, and whose FIRST
effect resolves whether or not the put happens (user ruling 2026-07-28: only the
put is skipped when a slot is occupied; arsenal capacity is a seam, normally 1
and two with New Horizon). Entangling Shot and Spire Sniping deliberately stay
unclaimed: tapping a hero is not modelled, and "put them back in any order" is a
REORDER, which `opt` is not — opt lets you bottom cards, which would be strictly
more powerful. Death Dealer and Bull's Eye Bracers are the two remaining
enablers.

## v2.32

THE FAIRNESS SWEEP — tools/fairness.js asks "is any card STRONGER than printed?", which is a different question from the audit's "how much did we read?" and the one that decides whether a game is fair. Three bugs shipped in a week with the audit reporting IDENTICAL tiers before and after each; every affected card said full. On its FIRST run the sweep found two more: Aether Quickening and Swiftwater Sloop x2 granted go again outright because their gated clause starts "Surge -" / "High Tide -" rather than "If", so the conditional handler never saw it and a rule matching the TAIL "it gets go again" fired — now anchored at both ends. And Emeritus Scolding x3 read "INSTEAD deal 4" as an ADDITION, dealing 6 where the card prints 4; "instead" now REPLACES, with execute suppressing the base op when the condition fires. The sweep is deliberately one-sided (too-weak is failstates.js's job) and test/fairness.test.js pins that it stays quiet, with each check backed by a real card — reintroducing the four bug classes makes it report 41/33/22/3.

## v2.31

PRINTED go again vs MENTIONED go again. The database's card_keywords is a keyword INDEX — it lists every keyword appearing on the card, including ones the text only grants conditionally — so keeping it apart from granted_keywords (the Kayo fix) was necessary but NOT sufficient. Seeding fx.ga from it gave 27 pool cards unconditional go again against their own printed text: Buckwild went again on an empty pitch zone, and Runerager Swarm logged "condition not met" and then went again anyway, which was visible in a play session and not noticed. Go again keeps your action point, so it is the most valuable keyword in the game to get wrong. The discriminator is the printed layout: a real keyword line stands alone in its own paragraph while a granted one sits inside a sentence; if the text never mentions it, trust the list. 77 cards keep it, 27 lose it, and the conditional path still grants it when the condition is MET.

## v2.30

NEXT-ATTACK BUFFS WERE WRONG TWICE OVER, and the coverage audit could see neither — every affected card reported tier full. They were read, and read WRONG. (1) The QUALIFIER was swallowed on 24 cards: "your next ARROW attack gets +3{p}" emitted a bare buffNext, so an arrow buff landed on a sword and a Runeblade buff on a Generic. attackQual now reads it off the printed type line, distinguishing "Brute or Warrior" (OR) from "Pirate ally" (AND), and qualified buffs ride on a new side field buffQ — where a buff that does not match is NOT spent, it waits for an attack it applies to. (2) The buff was COUNTED TWICE on 34 cards: fxParse's whole-text fallback for "gains +N{p}" matched the same clause the buffNext rule already took, and execute added both — Act of Glory granted +12 from a printed +6, the Lace cycle +6 from +3. The fallback now refuses when a buffNext op already read that pump, while still catching a genuine self-pump. Both regressions drilled and both drills proven to bite.

## v2.29

optFilter must consume the WHOLE subject phrase or refuse. v2.28 read it with loose substring tests, which shipped a real bug: Mounting Anger says "banish an attack action card from your hand WITH COST LESS THAN THE NUMBER OF DRACONIC CHAIN LINKS YOU CONTROL", the test saw "attack action card", returned {type:attack} and silently dropped the limit — so any attack card in hand became a legal banish, strictly better than printed. Its look-alike Rising Resentment escaped only because its PAYLOAD was unreadable, not its filter. Now three shapes refuse and are drilled: a dynamic limit, "ANOTHER aura" (an exclusion a field filter cannot express), and "a card with crush" (a rules-text qualifier). Mounting Anger correctly drops full -> part and the coverage baseline is repinned DOWN on purpose — the previous number was an over-claim.

## v2.28

OPTIONAL COSTS ARE READ. "You may banish an aura from your graveyard. If you do, deal 1 arcane damage" — 24 pool cards are shaped like this and NOT ONE was fully read, because the rider hangs off an optional cost and running it free is the bug v2.04 fixed. prompts.js's `pick` variant gains an `ops` rider that fires ONLY when cards actually moved, so declining costs nothing and grants nothing; the parser pairs the two clauses in fxParse (they arrive separately, split on the period) into fx.optCost and reads the cost's subject into a prompts filter from printed fields only, refusing anything it cannot read honestly rather than guessing. Wired for the `attacks` trigger, queued via promptQ and addressed to the ACTOR. Pool goes 258 -> 264 full, 35 -> 33 none. Also in this version, from a spun-off task: the runechant pop now credits hist.arc, so arcDealt and the "arcane dealt" pip finally see Viserai's primary arcane source.

## v2.27

THE PRIORITY MACHINE, IN SHADOW. Roadmap Phase A step 4 is the one that changes CONTROL FLOW rather than field names, so it lands in two moves; this is the first. DawnPriority.fromTrainer derives phase/step/priority/turnPlayer/attacker from the trainer's mode/bphase and setG merges them into every state, but nothing consumes them yet. Two payoffs: it turns FOUR dormant invariants on (BAD-PHASE, BAD-STEP, BAD-PRIORITY and PRIORITY-IN-CLOSED-PHASE all guard with != null, and the trainer carried none of those fields, so they had never fired on a real game since v2.21); and it proves the mapping before any control flow depends on it. The CR-counter-intuitive case is verified live: in the defend step the TURN-PLAYER holds priority (CR 7.3), so while the dummy swings canAct(you) is false while canDeclareDefenders(you) is true — declaring blockers is a free simultaneous game-state action (CR 7.3.2), not a priority action. Attack vs defense reaction windows now come out of speedAllowed correctly on both sides. The clock is deliberately NOT wired: priority.js counts player-turns while the trainer's turn counts only your own and feeds the escalation table and the score. ALSO: html-balance.test.js now rejects an orphaned comment terminator — a block comment closed twice, so the prose after it becomes code. That exact bug shipped during this version and broke the page completely while all 338 drills stayed green, because the orphaned prose had balanced brackets.

## v2.26

THE SEEDED RNG. engine/rng.js is a pure, serializable random source (mulberry32) carried IN game state as s.rng, and every game-affecting draw now comes off it: both opening shuffles, the pregame throw, Knucklehead's d6, intimidate's pick from the opponent's hand, and the dummy's graveyard recycle. A match now has ONE seed, stamped when the match begins and threaded Loadout -> Pregame -> Battle through cfg; the throw runs on a derived sub-stream so the opponent's hand does not correlate with anyone's deck. rng.seed is the replay key and rng.n a draw counter that doubles as a desync canary, and both now ride in the JUDGE!! report so "this looked wrong" becomes a reproducible game. The unseeded DawnGame.shuffle was DELETED rather than left beside the seeded one under a shorter name — the same reasoning that removed sides.js's you/foe in v2.24. Also fixes mkRune, which minted runechants and credited made/aura history to seat 0 whoever played the card — the same seat-hardcoding class as popRunechants. Cosmetic randomness (taunts, trophy text, the random-hero button) is deliberately left on Math.random.

## v2.25

THE RULES CORE SPEAKS IN ACTOR TERMS. Five of the seven functions ROADMAP-MULTIPLAYER.md names as the rules core — runOps, execute, resolveStack, tryPlay, takeIt — now resolve relative to s.actor instead of a hardcoded seat 0 (~430 call sites). Two genuine seat-hardcodings fixed on the way: popRunechants(n, 0, ...) popped SEAT 0's runechants whoever was swinging, and tapTwice's `act` parameter silently shadowed the global act() helper for that whole closure (renamed `commit`). A literal sides[0]/sides[1] inside a migrated function is now a drill failure — it is the same bug as you(), wearing a different hat. The ledger also grew an honest denominator: it tracks exactly the seven functions the roadmap names, so newTurn and foeSwing are visibly PENDING rather than quietly missing; both stay last on purpose because they encode the DUMMY specifically and get replaced when seat 1 gains a real action phase.

## v2.24

THE ACTOR SEAM — ROADMAP-MULTIPLAYER.md Phase A step 1, "the whole ballgame". you() means SEAT 0, not "the player acting", and the two readings only coincide because one seat ever acts; the moment a second human sits down, every rules function draws from the wrong deck. So perspective and actor come apart: you()/opp() stay as UI helpers, and act()/foe()/actMut()/foeMut() read a new shared s.actor for the RULES. actor defaults to 0, so act(s)===you(s) today and every swap is behaviour-identical NOW while being correct for seat 1 later — which is what makes this migratable a function at a time instead of big-bang. runOps is migrated (92 call sites); execute/resolveStack/tryPlay/takeIt are pinned as PENDING in the new test/actor.test.js ledger, which fails if a migrated function reaches for you( again. Also DELETED sides.js's dead seat-hardcoded you/foe rather than pinning them: the trainer's actor-relative foe would have collided with DIFFERENT semantics (sides[1] vs sides[1-actor]), so KNOWN_COLLISIONS SHRANK to [endTurn, other].

## v2.23

RUNECHANTS ARE AURAS, NOT A COUNTER. The printed token is a "Runeblade Token - Aura", and seven pool cards ask about auras generically ("if you control 3 or more auras", "you may destroy an aura you control", "whenever you play an aura") — none of which could ever see an integer. They are now real board permanents, so they render the actual token art instead of the text chip "Runechant ×2", and runeCount/auraCount read the board. Two rules fixes fall out: the trigger fires on PLAY, so a runechant the attack itself conjures (Viserai's rite) no longer pops on that same attack; and because a triggered ability sits above the attack on the stack, the arcane resolves at declaration BEFORE the attack's damage rather than after it. Also: attack targets (CR 1.4.5) — resolveEntry carries an ally's life, engine/game.js gains attackTargets/damageAlly/resetAllyLife and prompts.js a sixth `target` variant; an attack on an ally cannot be blocked (CR 7.3.2a). Trainer wiring for the target prompt is still to do — see CLAUDE.md.

## v2.22

JUDGE!! — a bug report written at the table. The button sits on the log pane and captures the whole board with the note (zones with uids, counters, chain, prompt, the feed, and any invariant violations), so the note can be one line; Copy or Save Report. Also fixes a real rules bug: CR 4.4.3f says "if it is the first turn of the game, all other players draw cards until the number of cards in their hand is equal to their hero's intellect" — the non-turn player refills on turn one only. The opponent-first opening never did it, so going second cost an extra swing AND left you short-handed for your first action phase. That is a large part of why opponent-first played harder than it should.

## v2.21

THE GUARD RAILS. engine/invariants.js is a judge that audits the STATE rather than the cards — a card in two zones at once, a per-side field written to the game object, a defending card re-declared on a second chain link (CR 7.3.2b), priority held in a phase that has none (CR 4.2.1/4.4.1). It is wired into setG, so every state change in a real game is audited; it never throws. Four genuine CR violations fixed in engine/priority.js: priority was granted during the start and end phases, the defend step handed priority to the defender instead of the turn-player (CR 7.3), only the turn player's floating resources fizzled instead of BOTH players' (CR 4.4.3e — a real two-player bug), and the action point was issued in the end phase instead of the action phase (CR 4.3.2). New: tools/failstates.js re-reads every card and asks how it goes WRONG at the table rather than how much text is unread, and feeds sweep.html a ranked section 4. It found the noop blind spot: phantasm and watery grave are filed as "does nothing", so Spears of Surreality, Enigma Chimera and five Gravy Bones allies report tier=FULL from coverage alone. CORRECTED in v2.23 — the tool now cross-checks the trainer by name the way the sweep does, because phantasm IS enforced (the trainer pops the attack at declaration) and reporting it ignored from parser status was an over-claim. Watery grave is the real half-built one: the permission to replay from the graveyard exists, the face-down rule does not.

## v2.20

THE MIRRORS ARE GONE — index.html now LOADS engine/*.js with plain script tags instead of carrying a hand-mirrored copy of every shared function. 51 duplicated definitions deleted (-55KB, ~20% of the file); one copy of each function now exists in the project and drift is impossible by construction. sync.test.js flips from "the two copies must match" to "there must be no second copy", and pins the three engine/trainer name collisions (endTurn, other, you) that wiring priority.js will have to resolve. Still no build step: plain UMD scripts, works over file://.

## v2.19

Two-tap hand — first tap peeks the card at a readable size, second commits (play, pitch, defend, react, arsenal all through one cell). Equipment abilities show their own art instead of a text placeholder. Fixes five v2.18 leftovers where ward/hist/blockH/blockG/blockRx/paySel were written to the game object instead of the side.

## v2.18

THE MIGRATION IS DONE — every counter and status joins the zones on sides[], both seats are built by one makeSide, and flatRemaining hits 0. Cost readers now take a SIDE, not the game.

## v2.17

The prompt sheet becomes general — pick-a-card, choose-one modal, pay-or-decline, reveal, plus opt, all as DATA specs in engine/prompts.js rather than a branch per card. Prompts are addressed to a SIDE, so a ruling can ask the opponent.

## v2.16

The player's zones and life join the opponent's on sides[] — both seats now declare an identical zone set, and the dummy gains the arsenal, pitch, banish and soul it never had. Reads via you()/opp(), writes via youMut()/oppMut(). Fixes a pre-existing bug where auras that crumbled at the top of your turn were restored to the board on the same line.

## v2.15

The opponent's deck, hand, graveyard, iron, board and life move off the flat d* stubs and onto sides[1].

## v2.14

Multiplayer groundwork — engine/sides.js (symmetric two-sided state + lossless legacy bridge), engine/priority.js (phases, chain steps, priority passing), and the rock-paper-scissors pregame whose winner CHOOSES the seating.

