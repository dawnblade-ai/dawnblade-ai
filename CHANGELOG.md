# Dawnblade — changelog

Extracted from the `APP_VER` comment in `index.html` at v2.32, where 19
versions of prose had accumulated on a single 14,723-character line that
shipped to every player on every page load. `index.html` now carries the
version and a one-line summary; the history lives here.

Newest first. `APP_VER` bumps by 0.01 per release (see CLAUDE.md).

---

## v3.76 — the Agents of Chaos

> **Arakni** *"At the beginning of your end phase, if an opponent is
> **marked**, you become a random **Agent of Chaos**."*
> **an Agent** *"At the beginning of your end phase, **return to the
> brood**."*

Two printed lines, one cycle: her end phase turns her into an Agent, she
holds it through the opponent's turn and her own, and her next end phase
sends it home — where her own clause fires again and a **different** Agent
takes the seat. She is somebody else for most of the game.

### THE DATABASE CANNOT NAME ITS OWN SET

No `types` entry, no `subtypes` entry and **no `type_text` anywhere in
4,952 live records** contains the word "Agent". A hand-written list would
be inventing card text at the SET level — the golden rule broken one layer
above the card.

So the set is derived from the two things that ARE printed:

| | |
|---|---|
| the **class** | *"Agent of **Chaos**"* — captured off the sentence and carried on the build as a string, the way Briar's token names are (v3.21). A boolean would move "Chaos" into `effects.js` |
| the **type** | `Demi-Hero`, read off the STRUCTURED ARRAY, this project's stated authority over `tt` (v2.44) |

Measured over the whole live database: **exactly six** Demi-Heroes carry
Chaos, and they are exactly the six Arakni's own `referenced_cards` names.

### BECOMING ONE SWAPS THE ABILITY AND NOTHING ELSE

Every Agent prints `health: "*"` and **intellect 4**; Arakni prints life 20
and intellect 4. So life, intellect, deck and gear are untouched, and what
changes is the printed ability line — which means the build's passives, its
powCard and the card the hero row shows.

`build.heroAbilities` is that half, extracted so the deal and the swap call
**one body**. Her own stealth passive is GONE while she is an Agent, which
is what the cards say: you have the Agent's ability, not your own.

**THE PICK COMES OUT OF THE SEEDED STREAM** and the rng is stored back
(v2.26), and `agentsOf` returns the set **sorted** — "random" has to be
reproducible, or two peers replaying one log become different Agents.

**RETURN RUNS BEFORE BECOME**, which is what makes it a cycle rather than a
one-way door. Reversed, she would become an Agent and immediately return,
and the mechanic would be invisible.

### THE POOL AND THE PHONE KEEP A DEMI-HERO BY ITS TYPE

The six Agents are records no deck lists. `tools/pin-pool.js` keeps them by
type the way it already keeps a token, and `index.html`'s loader keeps them
by the identical test — one rule, two readers, because a pool the Node
tools can see and the phone cannot is v3.21's fixture-and-production split.
**`DATA_VER` moves to `sage-v13`**: a warm cache has no Agent to become.

Their own activated abilities still **refuse** — five print `Discard an
Assassin card`, a cost `parseHeroPower` declines by design, and Trap-Door's
is a deck search. That is deliberately visible rather than quiet: the
Agents are in the POOL now, so the audit counts their unread text every
run. Two of the six carry a readable STATIC that is not yet built —
Tarantula's dagger drain and Orb-Weaver's Chelicera discount — and both are
recorded in HANDOFF.md.

### THE TRAINER'S BUILD LEDGER WAS A CLOSURE

**The first rule that ever CHANGED a hero, and it found a board that could
not express one.** `bAct` read `built.both` — a `useMemo` constant,
immutable by construction — so the swap on `game.builds` was invisible
there. The feed would have announced the transformation while every passive
kept answering for the hero she used to be: v3.01's one-board shape,
created deliberately rather than found, and the sev-2 category where the
feed and the state disagree.

`builds` is a `GAME_KEY` now (it has always been shared state at the
table), the trainer seeds it with the construction inputs stripped exactly
as `judge.newMatch` strips them, and **all three build helpers take the
state**. `bOf` used to close over `g`, which inside a `setG` reducer is the
PREVIOUS state — harmless while the only thing it read was `_dummy`, and a
stale read waiting to matter.

**Measured:** pool 788 → **797 records**; hero abilities 7 heroes / 10
unread clauses → **6 / 9**. Six heroes finished. 1773 drills, 0 failing, 4
skipped. Fairness clean. 29 scenes passing. 210 self-play games: 0
refusals, 0 violations, 7 stalls. Both babel blocks compile. Eleven
sabotages; all eleven bite — one was SILENT first, and the drill that fixed
it needed a synthetic build because no reachable state produces the case.

---

## v3.75 — Arakni, clause 1: stealth into a marked hero

> *"Your attacks with **stealth** that are attacking a **marked** hero get
> +1{p} and \"When this hits, this gets **go again**.\""*

Her whole deck is stealth and the mark — 18 pool cards print stealth, and
Mark of the Huntsman destroys itself to put the mark on a hero — and the
hero read nothing at all.

**THREE GATES, ALL SETTLED AT DECLARATION**, which is why this is not a
late condition (v3.71): the mark is already on the opposing hero, stealth
is a printed fact, and the attack-target is the caller's answer. There is
nothing here the wall can change.

| gate | reader |
|---|---|
| the card CARRIES stealth | `printedKw` |
| the hero is marked | `foe.marked` |
| it is attacking a HERO | `heroTarget` (CR 1.4.5) |

**`printedKw`, AND THAT IS MEASURED RATHER THAN ASSUMED.** 18 pool cards
print stealth; **seven more only NAME it** — Night's Embrace, Stalker's
Steps, Stains of the Redback, Orb-Weaver Spinneret, Spike with Bloodrot,
Two Sides to the Blade and her own hero line — and **nothing in the pool
grants it**. `hasKw` would hand her bonus to all seven. The measurement is
itself a drill: a card that ever GRANTS stealth fails it, and the answer
then is `hasKwNow` plus `_kwGrant`, which is a decision rather than a
silent widening.

**THE RIDER IS AN ON-HIT `ga`**, joined into `pend.onHit` beside the other
granted riders — so it fires only on a hit, and `linkPayload` folds
`_gaGrant` onto the link, which means both boards carry it. Filed
unconditionally it would be a free action point on a swing that was fully
blocked.

### Clause 2 — the Agents of Chaos, measured

*"At the beginning of your end phase, if an opponent is marked, you become
a random Agent of Chaos."* Not built this version, and the measurement is
in `HANDOFF.md` rather than a guess: the six Agents are `Chaos Assassin
Demi-Hero` records, all Silver Age legal, all **life `*` and intellect 4**
— the same intellect Arakni prints — so becoming one swaps the hero's
ABILITY and nothing else. They are named on her own record's
`referenced_cards`.

**Measured:** hero abilities 7 heroes / 11 unread clauses → 7 / **10**.
1760 drills, 0 failing, 4 skipped. Fairness clean. 28 scenes passing. 210
self-play games: 0 refusals, 0 violations, 7 stalls. Both babel blocks
compile. Nine sabotages; all nine bite — one was SILENT first, and the
fixture that fixed it pumped itself by 1 on the first attempt.

---

## v3.74 — Boltyn, and a free action point three abilities were taking

> *"If you've charged this turn, your attacks get +1{p} while defended by
> an attack action card.*
> *Attack Reaction - Banish a card from your soul: Target attack with {p}
> greater than its base gets go again."*

**HIS ONE MECHANIC IS THE SOUL** (v2.55's rule, third payout). Five cards
in his deck plus both hero clauses are soul-shaped — Radiant Touch banishes
from it, Halo of Illumination puts into it, Roaring Beam reads whether it
is empty, V of the Vanguard counts what was charged into it. And the hero
read **nothing at all**.

### Clause 1 — two gates, settled in two places

*"You've charged this turn"* is his own turn history. *"While defended by
an attack action card"* is a fact about the **WALL**, so it can only be
answered once defenders are declared — `linkPumps`, beside the late
conditions that moved there at v3.71.

**WHICH CARDS DEFEND IS THE CALLER'S ANSWER** (v3.11, v3.24, v3.27): the
trainer holds them as `{k:"def"}` stack layers and judge on `blockH`, and a
body that reads either is a body the other cannot call. A caller that says
nothing answers NO.

The magnitude comes off the printed line, like Kayo's — and he prints 1, so
**no pool fixture can tell a read number from a hardcoded one**. Sabotaging
the capture to a literal was SILENT against every driven drill; it takes a
synthetic hero record to see it (v3.32's Thunder Quake lesson).

### Clause 2 — a soul banish is a cost

It is **Bolt'n Boots' shape one cost over**: the `pumped` atom and the
whole attack-reaction route already existed (v3.63). The only thing between
Boltyn and the ability was `parseHeroPower` refusing a soul cost — a
refusal recorded in `test/rxability.test.js`'s own assertion text (*"his
cost is a soul banish nothing builds"*). That is what a recorded refusal is
FOR (v3.38), and it is the **third** to come due this fortnight.

`parser.abSoulCost` is the one reader, and **both boards refuse an empty
soul before the ability resolves** (v3.11) — refusing afterwards costs the
player an activation the rules never allowed. `execute` guards it too, and
an unpayable cost is INERT rather than free (v2.04), because `reduce` is
fed by JSON off a wire.

### THE FREE ACTION POINT, WHICH WAS TWO VERSIONS OLD

> *"Target attack with {p} greater than its base **gets go again**."*

That grants it to the **ATTACK**. `fx.ga` read it as the ability's own, so
activating one handed its controller an **action point** (CR 5.3.5 makes go
again a GAIN, not a refund). **Three of the pool's four attack-reaction
abilities print that shape** — Bolt'n Boots, Stalker's Steps and Boltyn's
hero — and **not one** prints a go again of its own. The first two have
done it since v3.63 built this route.

Stronger than printed, the direction that steals games, and invisible to
every tool here: a powCard is built by `build.js` out of a printed line and
is **not a pool card**, so neither the audit nor the fairness sweep ever
looks at one (v3.73's lesson, two versions running). The ability's own go
again arrives as a KEYWORD from `parseHeroPower`, so reading `kw` keeps a
real one and drops the payload's — and there is a drill with a synthetic
powCard for exactly that control.

### AND THE TRAINER'S HERO BUTTON WAS DEAD IN BOTH DIRECTIONS

Its enabled test was `kind === "instant"` with no case for an attack
reaction — so Boltyn's ability was **enabled in the action phase**, where
`tryPlay` refuses it, and **disabled in the stack window**, where it is the
only legal play. `parser.abWindow` is the one reader of which window an
ability has (v3.63); what lives in the trainer now is its mapping from that
window to its own `mode` vocabulary, stated once. v3.63's *"when you add a
flag to one powCard builder, grep for the others"*, one site further out:
there it was the builders, here the places that OFFER what they built.

**Measured:** the sweep's hero list 8 heroes → **7**, 13 unread clauses →
**11**. 1752 drills, 0 failing, 4 skipped. Fairness clean. 27 scenes
passing. 210 self-play games: 0 refusals, 0 violations, 7 stalls — Boltyn
10 wins → **15**. Both babel blocks compile. Ten sabotages; all ten bite
(one was SILENT first, and it was the hardcoded magnitude).

---

## v3.73 — Bravo, and the machinery he needed already existed

> **Action - {r}{r}, {t}:** Turn a face-down card in your arsenal face-up.
> If it has **crush**, it gets +2{p} and **dominate** this turn. **Go again**

His deck read **100%** and his hero read **0%** — the sharpest illustration
in the pool of why deck coverage was never the binding constraint. Third
hero finished end to end.

**AND IT NEEDED NO NEW MACHINERY.** Azalea's v3.71 build already turns a
card face up, fires its triggers and stamps a conditional bonus onto it;
the `{t}` route has charged a hero tap since v3.48. What was missing was
the **event** and the **keyword test**. Before building machinery for a
shape, check whether the machinery is the shape you already have (v3.58,
again).

### ONE READER FOR TWO HEROES' GRANT SENTENCE

| | prints |
|---|---|
| Azalea | *"If it's an **arrow**, it gets dominate until end of turn."* |
| Bravo | *"If it **has crush**, it gets +2{p} and dominate this turn."* |

One is a TYPE test and the other a KEYWORD test; the payload is a power
stamp, a keyword stamp, or both. So it is one matcher with a discriminator
rather than two nearly-identical regexes — the second copy is where the
drift starts (v3.41's `quotedText`, written twice, where sabotaging one
copy left the other correct).

**AND IT IS MATCHED ON THE LEVELLED CLAUSE.** A whole-card reader scans
`fx.clauses` RAW, so `SYNONYMS` has not reached it — and `it's` levels to
`it is` (v3.36), which the database already prints **both ways**. An anchor
spelling only the contraction works today and dies the moment upstream
levels the other way.

`printedKw` is the keyword predicate, not `hasKw` (v2.84's three
questions). **Crash and Bash** is the one pool card that tells them apart —
it prints *"you may reveal a card **with crush** from your hand"* and
carries no crush of its own. Written against an ordinary non-crush card the
drill is SILENT under sabotage, because the two predicates agree on every
other card in the pool.

### TURNING IS NOT PUTTING

Spire Sniping alone prints *"put **or turned** face up"*; every other
arsenal trigger in the pool says *"put"*, and Bravo's ability is the pool's
only card that TURNS one. Read off the clause rather than defaulted either
way: defaulted true, four of Azalea's arrows gain a bonus their text never
grants; defaulted false, Spire Sniping loses a printed line of play.

**Measured before it was carried:** no deck holds both a turn-up and a
put-only trigger (Bravo is Guardian, the arrows are Ranger), so it is
**latent** — and it is a printed distinction, so a reader that ignores it is
reading the card wrong whether or not anything notices today. Same
treatment v3.65 gave the ally-attack route.

### THE +2{p} WAS BEING READ TWICE

`fxParse`'s whole-text self-pump fallback scans for `gains/gets +N{p}` and
read Bravo's grant a **second** time, queueing it as a pump for his next
attack — **whether or not the card had crush**. v2.33's Bull's Eye Bracers
trap ("it" is the card in the arsenal, not the source) one hero over, and
`VALUE-DOUBLED` on the fairness sweep's own terms.

**NO TOOL HERE WOULD HAVE SEEN IT.** A hero powCard is not a pool card, so
neither the audit nor the fairness sweep ever looks at one. Driving the
ability is what showed it. The fallback's existing magnitude test is what
suppresses it, so a card printing two different pumps still gets its unread
one (v2.30).

### TWO PINS SHRANK, AND ONE STOPPED NAMING A CARD

- `test/tapped.test.js`'s `{t}` flag list went 3 → 2: Bravo's payload has a
  reader now, so the tap is charged by the hero route like any other.
- `test/dorinthea.test.js`'s "the census is not vacuous" control **named
  Bravo**, and a drill that names a card rots the moment you fix that card
  (v3.55). It is a synthetic hero record now, plus a measurement that
  *some* hero still reports — neither of which can quietly stop biting.

**Measured:** coverage unchanged at 361 full (his deck was already there);
the sweep's hero list 9 heroes → **8**, 16 unread clauses → **13**. 1740
drills, 0 failing, 4 skipped. Fairness clean. 26 scenes passing. 210
self-play games: 0 refusals, 0 violations, 7 stalls. Both babel blocks
compile. Ten sabotages against the new drills; all ten bite — two were
SILENT first and both were weak drills, not weak engine.

---

## v3.72 — Azalea finished: a reorder that is not an opt, and a Quiver with an event at last

Her deck is **31 of 32** now. The one card left is Drill Shot, blocked on
`piercing` — a keyword `tools/ledger.js` records as unbuilt, which is an
honest gap rather than a miss. She is the second hero finished end to end.

### Spire Sniping — a recorded refusal, come due

> *"When this is put or turned face-up in arsenal, look at the top 2 cards
> of your deck, then put them back **in any order**."*

`test/parser.test.js` had carried the reason in its own assertion text for
two versions: *"'put them back in any order' is a REORDER, which opt is not
— opt lets you BOTTOM cards, which is strictly more powerful than the card
prints."* That is what a recorded refusal is FOR (v3.38), and the drill
went red the moment the payload got a reader.

**READING IT AS `opt` IS WRONG IN BOTH DIRECTIONS AT ONCE.** Stronger,
because a card could be buried — and it would fire **Blaze's** *"whenever
you OPT, put energy counters on Blaze"* off a card that does not opt. A
card does not opt because it looks.

`lookOrder` is its own op. It shares the opt SHEET behind a `keepTop` flag
— one line in `applyPrompt` — and nothing else. With one card there is no
order to choose, so the sheet skips itself (v3.55); unlike an opt there is
no "or the bottom" alternative to make it a decision.

### Crow's Nest — the specialization that had no event

> *"Whenever an arrow is put face-up into your arsenal **from your deck**,
> you may pay {r}. If you do, put an aim counter on it."*

**Nothing in the pool could put a card face-up into the arsenal from the
DECK until v3.71 built her hero ability.** It is also the pool's **only
source of aim counters**, which Drill Shot, Infecting Shot and Murkmire
Grapnel all read — a whole family dead behind one hero ability.

- **THE WATCHER IS NOT THE CARD BEING PUT.** It is a Quiver in the gear
  zone, so a board-only scan finds nothing — v3.33's Magmatic Carapace and
  v3.55's counter family, third outing. Both zones.
- **THE SOURCE ZONE IS THE CALLER'S ANSWER**, and a caller that says
  nothing gets no trigger. `applyAnswer`'s route puts from HAND and so does
  `heave`; a default of `"deck"` would fire this off every reload, which is
  the exact shape of the v3.69 bug one trigger over.
- **"IT" IS THE ARROW THAT WAS PUT**, not the Quiver watching it. Read off
  the piece alone, `["aim",1]` lands on whatever is on the chain — a
  different card, on a different turn. The destination is decided in
  `fxParse`, where the whole card is visible (v3.66, v2.33).

### BUILDING THE SOURCE MADE A CONDITION REACHABLE — AND WRONG

*"If **this** has an aim counter"* was evaluated as *"does ANY counter bag
on my side hold an aim counter"*. A single aimed arrow would have pumped
**every other arrow in the deck**.

It was unreachable for as long as it was wrong, because no aim counter
could exist. **v3.57's rule read from the other end: when you build a
CONDITION, ask what it just made readable — and when you build a SOURCE,
ask which conditions it just made reachable.**

**Measured:** 359 → **361 full**, 11 → **10 none**, 35 → **34 part**.
1728 drills, 0 failing, 4 skipped. Fairness clean. 25 scenes passing.
210 self-play games: 0 refusals, 0 violations, 7 stalls. Both babel blocks
compile. Nine sabotages against the new drills; all nine bite.

---

## v3.71 — Azalea, and four things her hero ability was hiding

**READ THE HERO ABILITY BEFORE THE CARDS** (v2.55, Kayo). Her deck read 28
of 32 `full`; her hero read **nothing at all**, and the hero is the deck.

> **Once per Turn Action - 0:** Put a card from your arsenal on the bottom
> of your deck. If you do, put the top card of your deck **face-up** into
> your arsenal. If it's an arrow, it gets **dominate** until end of turn.
> **Go again**

Swift Shot, Dry Powder Shot and Entangling Shot each print *"when this is
put face-up into your arsenal"*; Bull's Eye Bracers, Call in the Big Guns
and Death Dealer are enablers; **Crow's Nest watches for an arrow put
face-up FROM YOUR DECK**, and nothing in the pool could do that. The whole
package was waiting on one ability that `parseHeroPower` refused — so
`build.js` built her no powCard and neither board could offer it.

**THREE SENTENCES, ONE OP.** Two of them reach across the clause split:
*"if you DO"* names the first sentence's put and *"IT"* names the card the
second one moved. Three independent ops would need `runOps` to thread "did
the last one fire" and "which card was it" between them, which is state no
op carries — so the reader is a whole-card one in `fxParse`, the same place
`optCost` pairs its halves and Sharpen folds its wipe.

**"IF YOU DO" IS LOAD-BEARING.** With an empty arsenal nothing goes to the
bottom, so nothing comes off the deck: the ability does nothing and says
so. Read unconditionally it would be strictly better than printed on the
one board state where the cost cannot be paid. (With an EMPTY DECK the same
card comes straight back — face up. That is the literal reading and it is
right; the first drill written for it expected the opposite.)

**THE FACE-UP WALK IS ONE BODY NOW.** It was written inline in
`applyAnswer` because a `pick` from hand was the only route that existed.
A second copy is how one board comes to fire Swift Shot's go again and the
other does not — v3.17's rule: the event is one body or it is not an event.

**THE GRANTED-KEYWORD VOCABULARY IS CLOSED.** `dominate` is the one keyword
an arsenal stamp can be spent on (`parser.defCap` is its only reader), so
an unknown keyword drops the GRANT and keeps the cycle. A keyword nothing
consumes is a no-op wearing a name — v3.55's rule about counter kinds.

### Bolt'n' Shot: `none` → `full`, on an anchor

> *"If this card's {p} is greater than its base, it gets go again and
> \"When this hits, **reload**.\""*

The pool prints **two wordings of one shape**: three Guardian attacks say
*"this HAS {p} greater than its base"* and this one says *"this CARD'S {p}
IS greater than its base"*. v3.65's rule, and v3.36's — the database prints
both spellings simultaneously.

**AND THE ANCHOR MUST BE WRITTEN AGAINST THE LEVELLED TEXT.** `SYNONYMS`
rewrites *"this card's"* to *"this's"* before `classifyClause` sees a word
of it, so a pattern spelling the printed form matches nothing and looks
exactly like a pattern that is simply wrong. That table is the first place
to look when a widening you have verified in isolation does not fire.

The rider had always parsed. `reload` has been live since v3.69. The whole
card was one alternation away.

### THE LATE CONDITIONS ADDED TO A NUMBER NOBODY SPENT

Three printed shapes cannot be answered when the card is played:

| | |
|---|---|
| `pumped` | *"if this has {p} greater than its base"* |
| `defLt2any` | *"…defended by fewer than 2 cards"* |
| `defLt2` | *"…by fewer than 2 non-equipment cards"* |

They were evaluated inside **`linkPayload`**, which is handed the damage
**DEALT** and is called *after* both boards have already subtracted it from
life. So a `+N{p}` there moved the crush threshold and the on-hit gate and
**never once touched a hero**:

```
Short Shrift · Wee Wrecking Ball · Walk in My Shoes   +1{p} when pumped
Widowmaker  (Azalea's own)                            +3{p} vs one defender
```

Twelve records, every one **WEAKER than printed** — the direction the
one-sided fairness sweep is built not to look in — and all reading
`tier: full`, because the clause really was consumed.

They live in **`linkPumps`** now, whose whole job is the attack's power
before the wall. The arithmetic is unchanged (`(power + N) - wall`), and it
is the only placement under which `heroHit` can be right: a swing blocked
to nothing that the bonus lifts back over the wall has now hit, and the old
ordering had already decided it had not.

**AND `pumped` ASKED THE WRONG NUMBER.** It compared the dealt damage with
the printed base, so an attack pumped from 4 to 6 and met by a wall of 3
was told it was *"not pumped above base"*.

**AND THE FEED CONTRADICTED ITSELF.** `execute`'s condition loop had no
case for any of the three, so they fell through to the default `false` and
printed *"condition not met (pumped)"* four lines before *"pumped above
base — +1 power"*. v3.60's sev-2 category. `LATE_CONDS` is one list with
two readers now — the skip and `pend.lateConds` — because two copies of it
drift into a condition that is skipped and then never run.

### A GRANTED dominate NEVER REACHED THE TABLE'S WALL

`parser.defCap` merges a held grant with the card's printed keyword and
both walls call it — but `_kwGrant` is resolution-scoped and `judge.js`
calls `defCap` with no `kwGrant` at all. **Pulping** is the pool's only
such card (*"if a card with 6 or more {p} is discarded this way, this gets
dominate"*) and its restriction was dropped at the table for as long as the
table has resolved card text. v3.01's shape.

It is folded onto `pend` at DECLARATION, which is the only moment both
facts exist, and it is idempotent for a card that prints the keyword.

### TWO LEDGERS TOLD

- **`tools/audit.js` reported a built hero ability as three unread
  clauses.** `parseHeroPower` answers about the ability's FIRST sentence;
  everything after it is read by `fxParse` over the powCard's whole printed
  line. The audit now asks that reader, through `build.heroAbilityLine` —
  one body, two readers. v3.21's one-sided ledger, and Azalea drops off the
  sweep's hero list entirely (10 heroes → 9, 19 unread clauses → 16).
  `analyzeHero` is exported so `test/dorinthea.test.js` can stop
  re-deriving the covered-test inline, with Bravo as the control that the
  census is not vacuous.
- **`test/sparring.test.js` never registered the card database.** Every
  game it drove ran with tokens minting nothing — Kayo's Might, every
  Runechant, every Frostbite. The mirror-balance drill was measuring a game
  no player can play, and it was the failure that surfaced it: enforcing
  Pulping's dominate swung the reduced game 10-2 and moves the real one not
  at all (7-5 either way). **When a band breaks, look at what the fixture
  is playing before you widen it.**

**Measured:** 358 → **359 full**, 12 → **11 none**, flagged 45 → 44.
1707 drills, 0 failing, 4 skipped. Fairness clean. 210 self-play games:
0 refusals, 0 violations, 7 stalls (was 10). 23 scenes passing.

---

## v3.70 — the instrument that drives a card and checks what happened

Every other tool here answers a question about **text**:

| | asks | reads card text |
|---|---|---|
| `npm run audit` | was the clause READ? | yes |
| `npm run fairness` | is the reading too generous? | yes, one direction |
| `tools/failstates.js` | is unread text dangerous? | yes |
| `npm run play` | does the machine stay legal? | **no — by contract** |

**Nothing drove a card and checked what happened.** Six live defects went
through that hole in seven releases and **five were in cards the audit
called `full`** — see FINISH.md §0.

### `npm run scenes`

Per-hero scripted scenarios: set up a real judge-shaped board, play the
hero's actual mechanic, and observe **hands, life, zones, counters and
action points**. Never the feed — two of v2.45's nine bugs lived under green
drills that read the log, where the end phase really did print (a) through
(f) in order while drawing for the wrong hero.

```
npm run scenes            arakni 4/4 · azalea 4/4 · boltyn 5/5
npm run scenes azalea     bravo 3/3 · briar 3/3 · kayo 2/2
```

**The scenes are DATA with two readers** — `tools/scenes.js` prints the
report and `test/scenes.test.js` runs the same objects as drills, so a green
suite and a green report cannot disagree. That is the no-mirror rule; this
repo has the scar that made it one.

**It answers a question the drills cannot.** `test/` is organised per
MECHANIC, which is right for building a reader and useless for "does Azalea
work". The hero comes from the FILENAME, so a scene cannot claim to be about
a hero whose file it is not in.

**Each scene carries its own `why`**, naming the defect it exists for — that
is a re-sabotage instruction, not documentation. Two rules are drilled: a
scene observes at least two things (one observation is usually asserting
that nothing crashed), and an observation returned but never checked is a
failure, not a silence.

### All eight defects were reintroduced, and all eight were caught

| reintroduced | scenes failing |
|---|---|
| reload puts the card face UP (v3.69) | 1 |
| ward stops reaching the table (v3.67) | 2 |
| dominate unenforced (v3.64) | 2 |
| reaction abilities at action speed (v3.63) | 4 |
| Sharpen loses its reader (v3.66) | 2 |
| Flurry's payload unread (v3.65) | 1 |
| the Embodiment pops on a weapon swing (v3.22) | 1 |
| `selfDiscard` stops crediting the discard event | 1 |

That last one was **found by building the instrument**, which is the point of
building it.

### `selfDiscard` credited no discard event

v3.61 wired that op into `_discWay` and quoted the gap it was closing —
*"every discard path should call this"* — while **`afterDiscard`, the body
that mints Kayo's Might, kept its three older call sites and not this one.**
Half a gap closed reads exactly like a whole one.

`{random: false}` is the whole of the distinction the shared body already
draws: Beaten Trackers prints *"whenever you discard a **random** card"* and
is gated on it, while Kayo's clause 3 fires on any discard at all — reading
them as one event hands out a free action point every time a cost is paid by
choice.

**LATENT, AND MEASURED BEFORE WIRING IT.** Exactly one pool card emits
`selfDiscard` (Portside Exchange, in Gravy Bones' deck), so no hero holds
both it and a 6-power discard payoff today. The route exists all the same.

### And the first scene I wrote was wrong, not the engine

The Kayo scene invented a `{zone}` argument `pow6` does not take — it takes
the BUILD, and a site asking about a card that IS the attack passes null,
which is what makes the passive a threshold rule rather than a damage buff.
**Check your own fixture before believing a new instrument**: four of eight
sabotages at v3.50 found a weak drill rather than a weak engine.

CI runs `npm run scenes` on every push. 1692 drills, 0 fail, 4 skipped.
Fairness clean. 210 self-play games: 0 refusals, 0 violations.


---

## v3.69 — reload put the card face UP, and face up is a different event

The database carries no reminder text for any keyword. The **1HP237
printing of Take Aim** does:

> **Reload** *(If you have no cards in your arsenal, you may put a card
> from your hand **face down** into your arsenal.)*

`applyAnswer` treated **every** `to:"arsenal"` pick as a face-UP put. That
is right for the three cards v2.33/v2.34 built — Call in the Big Guns,
Bull's Eye Bracers and Death Dealer all print *"face up"*, and the trigger
that fires when they do is their whole mechanism — and wrong for reload,
which prints the opposite.

**IT IS LIVE.** Azalea's deck holds Take Aim beside four arrows with
face-up triggers:

| arrow | trigger |
|---|---|
| Swift Shot | **go again** |
| Entangling Shot | taps the opposing hero |
| Dry Powder Shot | +2{p} |
| Ridge Rider Shot | opt 1 |

So reloading Swift Shot handed her a free **action point** and reloading
Entangling Shot tapped the opposing hero, off a card that grants neither.
**And the prompt's own title said "face-down" while the code set
`_faceUp: true`** — the feed and the state disagreeing, which is the sev-2
category the player TRUSTS.

**THE FACE IS THE CALLER'S ANSWER**, read off the printed word and opt-in
(v3.58), so a spec that says nothing gets the printed default — face down,
which is what an ordinary arsenal set is. **And `buildPrompt` had to be
told about the field explicitly**, or every put arrives face down
including the three whose mechanism depends on the opposite: v2.34's
`arsStamp` rule, and the fourth field to prove it.

### The keyword was already built, and the RECORD was stale

`reload`'s parser rule, its op, its `arsEmpty` gate (**not** `arsFree` —
the printed word is "no cards", and the two coincide at capacity 1, which
is why the wrong one stays invisible) and its optional prompt had all
existed for versions. `tools/ledger.js` still called it `pending`.

That is the reverse of the usual failure and just as costly:
`failstates.js` grades a keyword's severity against its **status** rather
than a grep (v3.00), so a stale `pending` is load-bearing. Moved to
`live`, and the ruling marked answered — **when you close a recorded gap,
delete the record** (v3.41). Its twin: *when a record says a thing is
unbuilt, go and ask the engine.*

**Fifth time the printing has paid** — Clash of Agility, Thunder Quake,
Pick Up the Point, Sharpen, and now this.

358 full / 35 part. 1664 drills, 0 fail. Fairness clean. 210 self-play
games: 0 refusals, 0 violations. 5 sabotages, all biting. Both
`text/babel` blocks compile.


---

## v3.68 — the same reveal, a different pool

Three pool records print *"X is the pitch value of the card revealed this
way"*. Two of them — Murderous Rabble and Ravenous Rabble — spend it on the
attack's power and have read since `revPitch` was written. **Throw Caution
to the Wind spends it on a PREVENTION and read `part`**: the reveal
resolved, and the whole second sentence was dropped.

**NO X MACHINERY IS NEEDED** — v3.39's rule about Blaze, one card over. X
here is not a free variable the player chooses, it is **settled by the card
the reveal turns up**, so the reader is the reveal that already ran and left
`n.revealed` on the state. Nothing is asked for, and the pool's only genuine
X-cost card (Ice Eternal) stays refused for its own reasons.

**TWO OPS, NOT ONE.** `revPitch` feeds the attack's power and `revWard`
feeds the prevention pool. Folding them into one op with a destination
parameter would make a card's text decide where a value lands, which is
exactly what `revPitch` and `revColorPitch` already stay apart to avoid.

**A reveal that turned up nothing grants nothing** — an empty deck leaves
`n.revealed` unset and a ward of 0 is the honest answer rather than a
default. Same guard `revPitch` keeps one branch up.

**NO RIDER ON THIS FORM.** `ward`'s third element carries Toe the Line's
*"if you prevent damage this way"* (v3.67); measured, no pool card prints a
rider on the revealed-X shape, so claiming one would be parsing ahead of
wiring.

**And it only does anything because of v3.67.** Before that the pool sat on
the side doing nothing at the table, which is the bug that version fixed —
a driven drill takes the granted ward all the way through
`effects.preventDamage` so the two halves are proven together rather than
each in isolation.

Throw Caution to the Wind: `part` → **full**. 358 full / 35 part. 1658
drills, 0 fail. Fairness clean. 210 self-play games: 0 refusals, 0
violations. 5 sabotages, all biting. Both `text/babel` blocks compile.


---

## v3.67 — plain ward was inert at the table

`ward` is added by a **shared** op and was consumed in exactly one place:
`index.html`'s `takeIt`. `judge.js` applies `hp - total` and read `.ward`
**nowhere at all** — so five pool cards that print a prevention did nothing
there:

> Cloud Cover · Oasis Respite · Seeker's Mitts · Toe the Line
> · Radiant Touch (through its ability)

v3.01's shape for the fifth time this cycle, and the **arcane** twin has
been shared since `arcaneHit` was written, which is exactly what made this
look wired: half the mechanic was in the right place.

No tool here could see it. Coverage reads Cloud Cover `full` — the clause
IS read; the fairness sweep is one-sided toward cards STRONGER than printed
and this is a defence being too weak; and `failstates.js` grades unread
text, not a value that evaporates.

### It reduces what is DEALT, not only what life loses

CR 7.5.5 — if prevention means no damage is dealt, **it is no longer a
hit**. A caller that subtracts ward from life while handing the
unprevented number downstream fires `pend.dealt`, every on-hit clause,
crush and the soul off damage that never landed. So `preventDamage`
returns the number, and that number is what the rest of the resolution
uses. `effects.preventDamage` is the one body; neither board keeps its own
arithmetic, and a drill fails on an inline `Math.min(ward, …)` in either.

**It sits before CR 1.4.5's routing**: an attack on an ALLY is damage to a
board object, and the hero's ward does not stand in front of it.

### "If you prevent damage this way" is not a `way:` condition

Toe the Line prints *"The next time you would be dealt damage this turn,
prevent 2 of that damage. **If you prevent damage this way**, create a
Flurry token."*

v3.60's late pass answers *what did THIS resolution just do*, and its
traces are cleared with the resolution that set them — correctly, or the
next card reads a discard it never made. **This prevention happens on a
LATER resolution**, possibly on the opponent's turn, so the rider waits
with the pool and fires from inside `preventDamage`, where the damage is
actually turned aside. Same place and same reason `hist.arc`'s credit
lives inside `arcaneHit` (v3.28).

**A prevention that prevents nothing triggers nothing**, and the guard for
that is the early return rather than a second test beside the rider — that
second test read as belt-and-braces and was **dead**: past the early
return both numbers are positive, so the amount soaked is always at least
1. Sabotage is what showed it; dead rules code is worse than dead code
elsewhere.

**Whose prevention was it?** The pool is one number, so a side holding two
wards cannot say which absorbed — and does not have to: both soak from the
same pool at the same moment. Stated as an approximation rather than
derived.

### Two drills of mine that passed by finding nothing

The rider drill never registered the card database, so the token mint
resolved nothing whatever the engine did — and its **negative** twin
("nothing prevented triggers nothing") passed for the same reason, which
is the worse half. A negative assertion needs the positive control to run
in the same state, or it is satisfied by the fixture rather than by the
rule.

Toe the Line: `part` → **full**. 357 full / 36 part. 1652 drills, 0 fail.
Fairness clean. 210 self-play games: 0 refusals, 0 violations. 11
sabotages, all biting. Both `text/babel` blocks compile.


---

## v3.66 — Sharpen, and the printed card is the oracle for the fourth time

The database carries no reminder text for any keyword. The ruling recorded
2026-07-25 said *"ADD +1 ATTACK POWER COUNTER … AT END OF TURN, REMOVE ALL
+1 ATTACK POWER COUNTERS"*. **The MPW103 printing of Edict of Steel prints
it in parentheses and is more precise in the way that matters:**

> **Sharpen** target sword you control. *(Put a +1{p} counter on it.
> **Remove all +1{p} counters from it** at end of turn.)*

**All** of them, and only **from it** — so a sword sharpened after Glisten
has distributed counters loses those too. Clash of Agility, Thunder Quake,
Pick Up the Point and now this: **reading the printing is the FIRST thing
to try, not the last.**

### It is `ctrPut`, not new machinery

v3.55 built the targeted counter put: the kind is `pow`, which is the
printed spelling `+1{p}` already maps to; the candidate scan already covers
the board AND the gear, which is where a sword lives; and the pick sheet
already exists for two or more. **Before building machinery for a shape,
check whether the machinery is the shape you already have** (v3.58, again).

What the keyword adds is the **wipe**, and it is a STAMP rather than a
predicate. `idleCounterWipes` asks the PIECE's own printed line
(`wipePowIfIdle`), and a sharpened sword's text says nothing about sharpen
— the schedule belongs to the card that sharpened it, so deriving it from
the piece answers false forever. **The stamp is cleared with the counters**,
or a one-turn buff becomes a permanent ban on ever holding one (the same
rule `_discWay` and `lastRoll` follow).

### "It" is the sharpened sword

*"Sharpen target sword you control. **If it has N or more +1{p} counters**,
create a Flurry token."* — "it" is the sword the first clause targeted, not
the resolving card: v2.33's Bull's Eye Bracers and v3.47's Scuttle Toes for
the third time. So the rider is folded onto the spec in `fxParse`, where the
whole card is visible, which is where `optCost` and Stir the Aetherwinds
pair their halves too.

**THE THRESHOLD IS THE CARD'S OWN NUMBER** — upstream prints 1 / 2 / 3
across the three pitches, so a literal is right for one printing and
silently wrong for two. A drill asserts the printings actually differ,
because a hardcoded 1 would otherwise pass a test written against the red
face alone.

**ONE BODY, TWO LANDING SITES.** The counter lands on the direct path when
one candidate needs no choice, and in `applyAnswer` when a sheet opened.
Dropped from `ctrStamp`, the wipe and the rider fire on the first and
silently vanish the moment a second sword is equipped — v2.34's `arsStamp`
rule. And the two new stamp fields are **opt-in** (v3.58): always present
they change the shape of every `ctrStamp` in the pool and a drill that
`deepEqual`s the whole stamp — which it is right to do — goes red on a card
printing no sharpen at all.

### A closed subtype vocabulary, measured

`optFilter` had no reading for *"target **sword** you control"*. Added as a
**closed** list, because an open "any word before `you control`" would claim
every dynamic and rules-text subject this reader exists to refuse — and
would do it silently. Measured across the pool: the printed subjects of that
shape are **sword** (Edict of Steel), **dagger** (Danger Digits, which
refuses earlier for its own reasons) and **ally** (Scuttle Toes, which has
its own reader). Exactly three records changed parse, all Edict of Steel.
Sabotaging the list open was **silent against every other drill in the
file**, which is why the closure has one of its own.

### The chain closes

v3.65 read Flurry's trigger and payload and reported honestly that the token
**worked and could not be created**. It can now: Edict of Steel sharpens,
the token lands, and a driven drill spends the sword and watches Flurry free
it for one more swing. `tools/ledger.js` moves sharpen `unreviewed` → `live`
and the ruling is marked answered — **when you close a recorded gap, delete
the record** (v3.41).

356 full / 37 part. Flagged cards 48 → 47. 1640 drills, 0 fail. Fairness
clean. 210 self-play games: 0 refusals, 0 violations. 15 sabotages, all
biting. Both `text/babel` blocks compile.


---

## v3.65 — a fixed wording is not a fixed shape, at the level of a family

v3.22 built `fx.atkTrigger` for four tokens printing *"when you play an
attack action card[ or activate a weapon attack], destroy this and X"* —
and never asked which OTHER printed subjects the pool gives that shape.
**Three more tokens print it and read `tier: none`. They did nothing at
all:**

| token | trigger | payload |
|---|---|---|
| **Blade Dance** | *"when you **activate a weapon attack**"* — no play half | the attack gets go again |
| **Flurry** | the same | *"you may attack with the weapon twice this turn"* |
| **Eloquence** | *"when you play a **non-attack** action card"* | the card gets go again |

That is v3.60's rule ("when you anchor a reader to a wording, ask which
other printed wordings of that shape it still has to reach") one level up:
about a FAMILY rather than a matcher.

The trigger now carries **`on`, a list of routes read off the printed
words**, in place of v3.22's single `weaponToo` boolean.

**THE PAYLOAD'S SUBJECT MUST MATCH THE TRIGGER'S.** *"The attack"* and
*"the card"* name the same object on their own route, but a non-attack
trigger cannot pay out to "the attack" and an attack one cannot pay out to
"the card". Reading either onto the other is the wrong-subject shape v2.33
and v3.47 both name; an unreadable payload refuses instead.

**AN ALLY ATTACK MATCHES NO ROUTE.** The fire test was `weaponToo || from
!== "weapon"`, which answers TRUE for `from === "ally"` — so an ally's
activated attack popped every one of these as though an attack action card
had been played. **Latent rather than live, and that was measured across
all fifteen decks before it was changed**: none holds both a minter and an
attacking ally. The route has existed since v3.44 all the same.

**ELOQUENCE NEEDED THE POP SITE'S SIBLING.** The attack branch has had one
since v3.22 and the non-attack branch had none, so a `nonAtk` trigger could
never fire — v3.53's shape exactly. The site dispatches go again and
nothing else, which is complete *because* of the subject rule above, and a
drill pins that measurement so a token printing something else fails there
rather than quietly doing nothing.

**FLURRY'S PAYLOAD IS A MECHANIC THIS ENGINE ALREADY HAS.** Dorinthea's
hero ability is *"you may attack an additional time with that weapon this
turn"*, and `weaponRefresh` models it by lifting the weapon's Once-per-Turn
allowance and nothing else — so the extra swing walks the ordinary path and
pays its printed cost and an action point like any other activation. A free
action point would be strictly stronger than printed. *"That weapon"* is
literal: lifting the whole map hands a hero holding two weapons a free
swing with the other. **Before building machinery for a shape, check
whether the machinery is the shape you already have** (v3.58, again).

**FLURRY WORKS AND STILL CANNOT BE CREATED**, and that is stated rather
than glossed: its two minters — Edict of Steel and Toe the Line, both in
boltyn's deck — are `part`. Edict needs **Sharpen**, which has a recorded
ruling (2026-07-25) and is `unreviewed` in the ledger; that is the next
job. Blade Dance and Eloquence have no minter in this pool at all, which is
a fact about the pool rather than about the engine — the route exists on
both boards, so reading them is honest.

1628 drills, 0 fail. Fairness clean. 210 self-play games: 0 refusals, 0
violations. 11 sabotages, all biting. Both `text/babel` blocks compile.


---

## v3.64 — how many cards may defend, and dominate was enforced by nothing at the table

**`judge.legal`'s defend branch mentioned dominate NOWHERE AT ALL.** At the
table any number of cards could be declared against a dominate attack — an
illegal play allowed, in the direction that makes the attacker weaker than
printed. The trainer's only cap was `dummyDefence`'s `dominating ? 1 : 2`,
which is the DUMMY'S OWN HEURISTIC about how many cards it chooses to spend.
v3.01's shape: a rule that exists on one board, and barely on that one.

No tool here could see it. Coverage reads Macho Grande `full` — the keyword
IS read; the fairness sweep is one-sided toward cards STRONGER than printed;
and `sparring.act` reads no card text by contract, so it cannot know about
dominate and relies on `legal` to refuse. **That is why the gap is `legal`'s
and not the policy's.**

### Two printed sources, two counted sets, one reader

`parser.defCap` combines them and the TIGHTEST wins — two restrictions do not
cancel:

| | caps | counts |
|---|---|---|
| **dominate** | 1 | cards **from hand**. The database prints no reminder text for any keyword (which is why `tools/rulings.json` exists); this project's recorded reading is the hand limit, and changing it is a RULING |
| **Confidence** | 2 | **non-block** cards — and Block is a TYPE, so a declared piece of EQUIPMENT counts against it |

The counted set is read off the printed word rather than defaulted to
dominate's, because they genuinely differ and defaulting either way changes
what may block.

**A GRANTED dominate is the CALLER'S ANSWER.** Pulping prints *"if a card
with 6 or more {p} is discarded this way, this gets dominate"* — `hasKwNow`
correctly drops it and `_kwGrant` is how the clause hands it over when the
gate fires, which is a fact about the resolution no reader of the card alone
can see. A caller that does not say answers no.

### `defCapNext` — the fifth qualified single-shot grant

Beside `buffQ` (power), `gaNextQ` (go again), `costOff` (cost) and
`instantNextQ` (the window). Same `attackQual` tail reader, same "a grant that
does not match WAITS rather than being spent" rule, same expiry in the shared
end phase. Building it invented no vocabulary — the fourth time that has been
true of this family.

Taken at DECLARATION and riding on `pend`, because the wall is built from
`pend` on both boards.

### The rule CAPS the heuristic, it does not replace it

Two different numbers live in `dummyDefence` and folding them together would
silently change a TUNED opponent: `Math.min(2, cap.n)`, never an assignment.

### The check sits BELOW both branches, and that is the whole of it

The gear branch used to `return null` on its own — so a cap that counts
EQUIPMENT was bypassed by the one kind of defender it needed to count.
`defCounts` decides which declarations count against which cap, and the check
must see them all. **Withdrawing a declared defender is always legal**: the
cap limits how many may be DECLARED, so a toggle that removes one can never
breach it.

### Three weak drills, all found by sabotage

- the equipment case declared the **hand card first**, so a cap of 1 was
  already full and the drill could not tell whether the tally ever looked at
  `blockG`. **A fixture where two things coincide has tested neither** (v3.26).
- the same case needed its **mirror**: one drill proves the tally COUNTS
  gear, another that the check APPLIES to gear. Sabotaging the check to skip
  equipment was silent against the first alone.
- *"a grant that does not match is not spent"* used a **non-attack**, which
  never reaches `takeDefCap` at all — so it passed against a sabotaged
  matcher. It has to be an attack the QUALIFIER rejects.

**And restructuring the branch found a rule with no drill anywhere in 1618.**
`gearDef <= 0` — a battleworn piece worn to zero cannot be declared — was
silent under sabotage while its neighbour `chainBlocked` (CR 7.3.2b) was
covered. Silver Age equipment is nearly all battleworn, so that is reachable
rather than theoretical. Both are drilled now.

**Confidence went `none` → `full`, and it was inert in a LIVE DECK**: Full of
Bravado sits in lyath's deck reading `tier: full`, and its entire payoff is
this token. The no-op blind spot with a token on the end.

1620 drills, 0 fail. Fairness clean. 210 self-play games: 0 refusals, 0
violations. 19 sabotages. Both `text/babel` blocks compile.


---

## v3.63 — REACTION CONTAINS ACTION, and three abilities were live in the wrong window

Six pool records print `Attack Reaction - <cost>:` as an **activated
ability**. v3.59 guarded `classifyClause` so the loose matchers could not
eat the line including its cost, and asserted here that *"none has a
route"*. **That assertion was about the wrong function.**

`parseHeroPower` runs its OWN regex over the raw text; `clean` collapses
the newlines, so it cannot anchor on `^` and never did — and **"REACTION"
contains "ACTION"**. Three abilities were therefore BUILT as action-speed
and offered in the action phase:

| card | what it did |
|---|---|
| Prey Spotters | marked a hero for free, any time |
| Stalker's Steps | granted **go again** — an action point — with no attack to target |
| Danger Digits | dealt 1 damage from nothing, its printed *"Destroy the dagger"* dropped with its subject |

Sev-3 *illegal play allowed*. v2.44 named the Reaction-contains-action
trap and v3.30 hit it again in `nextTurnBars`; this is its third outing,
and the first where the refusal had been **asserted in one function and
never driven in the other**.

**No lookbehind.** This ships to a phone as authored, so the preceding
character is CONSUMED instead: `(?:^|[^a-z])`, which under `/i` excludes
upper case too — the `e` of "Reaction" must not qualify.

### The route, since the anchor had to read the prefix anyway

`_attackRx` rides the powCard beside `_instant`, because a powCard's `tt`
is *"Equipment Ability"* and carries no printed type at all.

- **`parser.abWindow` is the ONE reader** of which window an activated
  ability happens in. Four sites ask it — judge's hero branch, judge's
  equipment branch and both of the trainer's gear taps — and two of them
  were already hand-rolled ternaries kept in step by hand.
- **It costs no action point.** CR 8.1.1 charges the point to an ACTION,
  and `costsAP`'s own note already said *"a card played in a reaction
  window is not being played as one"* — the reading that makes Den of the
  Spider cost a point as an Action and none as a Defense Reaction.
- **The printed target is a LEGALITY** (v3.11's rule, one route over),
  refused **before** the piece is destroyed to pay for it.
- **It resolves through `effects.attackRx`**, which already did everything
  these payloads need — target legality, the go-again grant onto
  `pend.card`, riders, modes. Its ops are held back from `execute`'s own
  run, or they fire twice.

### `with {p} greater than its base` — the atom the LINK answers

Four records print it. The two TRAPS ask it of the attack they defend and
have `defPumped`; **Bolt'n Boots and Boltyn ask it of the attack they are
buffing**, and no qualifier could say so. `pumped` joins `from` and
`boosted` as an atom the caller supplies — **an absent one answers NO**.

`effects.pendPumped` is the one body, and it counts the `{k:"rx"}` layers
still waiting on the stack: `linkPumps` folds those in at SETTLE time, so
read off `pend.total` alone a link pumped by one reaction reads unpumped
to the next.

### Two refusals, each for its own reason

- **Danger Digits.** *"Target dagger you control that isn't on the active
  chain link **deals** 1 damage…"* — the unanchored `dmg` matcher read
  that as a bare `[["dmg",1]]` from the EQUIPMENT: the chosen dagger, the
  *"has hit"* fiction and a printed **drawback** all gone. Measured over
  the pool, exactly two records print the third-person *"deals"* and
  Bloodrot Pox's subject is *"it"*, which IS the resolving card. So a
  third-person subject that is not this/it refuses.
- **Bait.** *"This gets +1{p} and go again"* on a Ranger Token **Aura**.
  On a reaction route *"this"* is the SOURCE, not the attack, so pumping
  the link with it decides what "this" refers to — v2.33's Bull's Eye
  Bracers and v3.47's Scuttle Toes, on an activation line. It refuses, and
  nothing in the pool can create Bait anyway.

Boltyn's ability line still refuses too: its cost is a **soul banish**,
a cost shape nothing builds.

### `pend.by` existed on one board

Written by `judge.declareAttack` and by nothing else — so on the TRAINER
it was `undefined`, and every reader guards on `by != null`, which made
`execute`'s own attack-reaction branch **unreachable there**. The actor at
declaration IS the declarer. Measured before changing it: both `hostile`
tests ask `by !== actorOf(n)`, false with `by` absent and false now for
your own swing, and the dummy's swing opens no pend at all — so no trainer
behaviour moves.

### The tier says read only when something reads it

`fxParse` credits the `Attack Reaction - …` clause **conditionally on
`parseHeroPower` answering**, the same shape and guard as `handAbility`.
Under-reporting a card that works is v3.21's one-sided ledger; crediting
one that does not is the no-op blind spot, and the guard is the whole
difference.

**AND THE DRILL FOR THAT WAS WRITTEN AGAINST `fx.tier` FIRST, AND WAS
SILENT UNDER SABOTAGE** — all three refusing cards carry ANOTHER unread
clause that pins them at `part` whatever the credit does. **A derived
aggregate that other facts also determine cannot see a change to one of
them.** Asserting the CLAUSE STATUS bites, and rewriting it that way is
what found that Bait was being credited.

**Measured:** 352 → **355 full**, 41 → **38 part**. 20 sabotages, all
biting. Both `text/babel` blocks compile.


## v3.62 — the late "this way" pass reaches the attack branch

Path of Same Ends: *"When this attacks a hero, deal 1 arcane damage to
them. **If damage is dealt this way**, this gets go again."*

### THE TRACE IS RECORDED WHERE THE DAMAGE LANDS

Not at the call site — **inside `arcaneHit`, in the `left > 0` branch.**
That is what makes CR 7.5.5's *prevented is not dealt* govern it without
being restated: a hit turned entirely aside records nothing and grants
nothing. `creditArc` already leans on the same guard one line up, and
v3.28 is the version that had to move it there after crediting a fully
prevented hit.

Driven both ways: the arcane lands → `pend.ga` true; the arcane is fully
turned aside by an arcane shield → hp unchanged, `pend.ga` false.

### `pend` IS BUILT BEFORE THE TRIGGER FIRES

`n.pend` is constructed at ~2086 and the `onAtkHero` trigger runs at
~2150 — and `pend` already carries **its own copy of `ga`**. A grant that
set only the local would be invisible to the resolution the chain link
actually runs on, so it goes to both. A drill asserts on `pend`, not the
local, because that is what resolves.

### ONE BODY, TWO BRANCHES

A non-attack's ops run late; an attack's on-attack trigger fires earlier
and its `pend` is already built. Two copies of the condition loop is the
drift this file names on nearly every page, so **the difference between
the branches is expressed as a `grantGa` callback and nothing else**.

Go again is the one op that cannot simply `runOps`: it is a GAIN of an
action point (CR 5.3.5) that the surrounding code tracks in a local, and
on the attack path it has already been copied. Each caller says how to
apply it.

### TWO OF TEN SABOTAGES FOUND WEAK DRILLS — AND ONE WAS MY OWN HARNESS

- **"the damage trace is recorded even when prevented"** applied *inside*
  the `left > 0` guard, so it changed only the amount and never the
  prevented case. Re-targeted to move the record onto the `else` branch —
  where it bites. **A sabotage that cannot express the bug proves
  nothing**, and this is the second time this fortnight the harness rather
  than the drill was at fault.
- **the damage trace's per-resolution clear** had no drill: resolving ONE
  card cannot see a leak. It resolves two now, the second fully
  prevented, so a carried-over trace would grant go again off the first
  card's damage.

### Measured

- **351 → 352 full**, 42 → 41 `part`. Flagged cards 49 → 48.
- `npm test` **1582 drills, 0 fail, 4 skipped**. Fairness clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Ten sabotages, all ten bite** after two were re-targeted.

## v3.61 — the trace v3.60 built already existed

**`_discWay` has recorded "what this resolution discarded" since
`discard6way` was written.** It is cleared per resolution in `execute`, at
the same point and for the same stated reason — *"leaving it to accumulate
would silently turn 'this way' back into 'this turn'"*.

v3.60 added a private `_thisWay` beside it. **Two records of one fact —
the no-mirror rule broken inside a single file**, and by exactly the habit
this fortnight keeps paying for: *before building anything, check whether
it already exists.* Four findings came from that check and this one was
missed.

Unified onto `_discWay`, which is strictly better: one trace, two readers
(`discard6way` and the new colour condition).

### AND IT CLOSED A GAP THAT WAS ALREADY WRITTEN DOWN

The comment on `creditDiscard` says it in as many words:

> Every discard path should call this. Today that is `discardRandom`; an
> additional-cost discard is the other one and is not wired yet, **which is
> a gap rather than a decision.**

`selfDiscard` was not feeding `_discWay` either — so a card with 6 or more
{p} discarded by one could never satisfy `discard6way`. Now it does. **A
recorded gap is a debt, and this one came due sideways**, through a
refactor that was not looking for it.

### THE LATE PASS STAYS, AND HERE IS WHY

The existing answer to "conditions run before ops" is a **pre-run**:
`execute` runs a card's `draw`/`discardRandom` ops ahead of the condition
loop and filters them out of the later lists. That works when the fact is a
DISCARD.

It does not generalise. Path of Same Ends asks *"if damage is dealt this
way"* about an arcane that fires from `fx.onAtkHero` at declaration —
pre-running that would deal damage before the attack is properly declared.
So the two mechanisms cover different shapes and both earn their place:
**pre-run when the op can safely move; the late pass when it cannot.**

### Measured

- No tier movement (351 full) — this is a correction, not a feature.
- `npm test` **1577 drills, 0 fail, 4 skipped**. Fairness clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Eight sabotages re-targeted at the unified code; all eight bite.** A
  sabotage written against the old shape proves nothing about the new one.

## v3.60 — a card that drew for free, and the "…this way" record

First item of the new week's plan, and the mechanism turned out to be
sitting on top of a live bug.

### THE DISCARD WAS BEING DROPPED

`classifyClause` has compound rules for a **random** draw-and-discard, and
the comment above them says why in as many words:

> the unanchored plain-draw rule below claimed the whole clause, returned
> `[["draw",1]]` and filed it `run` — tier `full`, with the cost silently
> deleted. **Five Kayo rows drew for free and never paid.**

**There was no rule for the non-random wording**, so the same unanchored
rule claimed it the same way. Portside Exchange's *"Discard a card, then
draw a card"* returned the **draw alone**, and so did Gravy Bones' hero
ability. A dropped drawback is strictly stronger than printed.

**The clause read `run` the whole time**, so no coverage number ever
moved and the fairness sweep stayed clean: read, and read wrong — the same
blind spot as v2.30's arrow buff.

**The printed ORDER is read, not normalised.** Which card you may discard
depends on whether you have drawn yet, and the two printings genuinely
differ.

### "…THIS WAY" IS THIS CARD'S OWN RESOLUTION

**Measured: 17 pool cards print the phrase. 8 already read** — each
hand-built with its own condition name (`discard6way`, `chargedPitch`, the
reveal ops) — **7 unfinished, 2 heroes.** This is the first to go through a
shared per-resolution TRACE rather than a bespoke condition.

**THE STRUCTURAL BLOCKER, AND IT IS THE WHOLE DESIGN.** `execute`
evaluates `fx.conds` **before** it runs `fx.ops` — the loop is at ~1583
and the ops at ~2175. So a condition asking what its own ops just did
reads an empty trace: **false on every card, forever.**

The `way:` prefix is what lets the main loop skip these and a **late pass**
answer them once the ops have run. `pend.lateConds` is the precedent on the
attack path (`defLt2`, `pumped`); this is its non-attack twin, and
deliberately the narrower of the two — an attack's ops ride to resolution,
so a this-way condition on an attack card is a different problem and is
left refusing rather than half-built.

**`thisWayMet` IS A NAMED FUNCTION SO ITS DEFAULT IS REACHABLE.** The
parser only emits conditions the evaluator knows, so no card fixture can
drive the unknown branch — exactly what v3.26 records for `defSelfMet` and
v3.36 for `asInstantMet`. An unknown condition answers FALSE: weaker than
printed and visible.

**And the trace is cleared with the resolution.** "This way" is one card's
own doing; a trace left on the state is the *next* card's condition reading
a discard it never made.

### THREE OF EIGHT SABOTAGES FOUND WEAK DRILLS

- **the trace not cleared** — a drill that plays ONE card cannot see a
  leak. It plays two now, and the second must earn nothing.
- **the unknown-condition default** — unreachable from any fixture, which
  is why the evaluator was extracted and is asked by name.
- **the main loop not skipping** — the state comes out *identical* (the
  late pass still fires), so every zone assertion passed. What differs is
  that the player is told **"condition not met"** and then handed the bonus
  anyway. In a training sim the sequence is the lesson and a feed that
  contradicts itself is the sev-2 category the player TRUSTS — so that one
  drill asserts on prose, deliberately, and says why.

### Measured

- **350 → 351 full**, 43 → 42 `part`. Portside Exchange closes; Gravy
  Bones' hero ability stops drawing for free.
- `npm test` **1577 drills, 0 fail, 4 skipped**. Fairness clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Eight sabotages, all eight bite** — after three were rewritten and two
  re-targeted at the extracted function. A sabotage that no longer applies
  proves nothing.

## v3.59 — a card that reported finished and could not be activated at all

`classifyClause` guards `action` and `instant` activation prefixes for a
precise reason: *"Instant - Destroy this: Gain {r}" is a cost you pay, not
an effect that fires on its own — matching it against the generic effect
rules below would hand out the resource for free.*

**The pool prints a third prefix on five records and it was never
guarded.**

| card | line |
|---|---|
| Prey Spotters | Attack Reaction - Destroy this: **Mark target opposing hero** |
| Stalker's Steps | Attack Reaction - Destroy this: Target attack with stealth gets go again |
| Bolt'n Boots | Attack Reaction - {r}, destroy this: Target arrow attack … gets go again |
| Danger Digits | Attack Reaction - Destroy this: Target dagger … deals 1 damage … |
| Boltyn (hero) | Attack Reaction - Banish a card from your soul: … |

**Prey Spotters read `tier: full` and could not be activated at all.** The
loose `mark` matcher claimed the whole line — cost included — so the audit
counted the clause as read. Meanwhile `parseHeroPower` refuses the line, so
`build.js` builds **no powCard**, and neither board offers the ability.

A card that reports finished and is inert is the no-op blind spot, and this
is its unanchored-match half: v3.00's Stir the Aetherwinds, on an
activation line.

### IT REFUSES OUTRIGHT, AND THE FIRST ATTEMPT PROVED WHY

Written to defer to the equipment reader like the two prefixes above it,
this made things **worse**: `parseHeroPower`'s PROBE form answers truthily
for these lines, but `build.js` builds a powCard only from an
`action`/`instant` line — so the `noop` said *"read by the equipment
reader"* about a reader that does not run, and **Stalker's Steps went from
`part` straight to `full` while staying completely inert.** The same blind
spot, re-created one line further down.

`null` is the truth: nothing reads these yet.

**Anchored on the dash**, exactly like the existing prefixes. Widowmaker
and Wreck Havoc print *"Defense reactions can't be played to this chain
link"* — a restriction on the opponent, not an activation, and it must
still be read. A drill pins that.

### THE BASELINE WAS REVIEWED, NOT WIDENED

Two cards degrade deliberately — `prey spotters full → part` and `danger
digits part → none` — and `coverage.test.js` failed exactly as designed.
The diff was read card by card before `--write-baseline`, which is what
that flag is for: a downgrade that corrects over-reporting is a decision,
not a regression.

**Building the route is a real job** — parser, `build.js`, `judge`'s window
gating, and the trainer's own offering path, none of which can be validated
without a phone. `_instant` already shows the shape a `_attackRx` flag
would take, and `speedAllowed` has distinguished the attack-reaction window
since v2.27. Recorded in HANDOFF.md rather than half-built.

### Measured

- **352 → 350 full**, and that is the number improving: two cards stopped
  claiming what they cannot do.
- `npm test` **1566 drills, 0 fail, 4 skipped**. Fairness clean, UNFAIR 0.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Three sabotages, all three bite** — including the one that restores the
  lying `noop`.

## v3.58 — two readers that each replaced an inline one

Both of this version's cards were **already firing**. Both reported unread.
Both were read by a private regex rather than by the parser — which is the
cached-card-fact shape v3.22 named, twice over.

### "WHEN THIS IS DESTROYED, …" — Phantasmal Haze

The phantasm pop site has read this trigger since v3.01, with **its own
regex over the card's raw text**. So the token was minted correctly and the
clause still reported UNREAD, leaving the card at `part` with a mechanic
that works — the same under-reporting Call in the Big Guns had at v3.53.

Measured before replacing it: that inline regex matches **exactly one pool
card** (Phantasmal Haze, three printings), so `fx.onDestroy` is an exact
swap rather than a widening. Held off `fx.ops` like every schedule — the
card is an ATTACK, and a payload left in `ops` would mint the token every
time it was *played*.

### "IF X, THIS CARD'S ATTACKS GET Y" — a card special-cased BY NAME

Three pool cards print this and all three are weapons:

| card | condition |
|---|---|
| Mandible Claw | you've discarded a 6+ {p} card this turn |
| Searing Emberblade | you control 2 or more Draconic chain links |
| Star Fall | you've played a Lightning card this turn |

**Mandible Claw's was an inline `from === "weapon"` regex in `execute`**,
with a matching `noop` in `classifyClause` whose *reason pointed at that
line*. The golden rule broken twice: a card handled by name, and a `noop`
filed for text that has real behaviour. The other two were dead.

**NOTHING NEW RUNS IT.** `execute`'s condition loop already treats `ga` and
`self` specially, and a weapon swing goes through `execute` with
`attacking` true — so the payload reads as ordinary ops and the existing
gate machinery applies them at the swing, which is exactly when the card
says. Two of the three conditions already existed; only Star Fall's needed
writing, and `hist.playTy` (v3.38) already held the answer.

**`wpnOnly` rides on the clause**, because *"this card's ATTACKS"* is not
*"this card"* — the same piece can be activated for a non-attack ability,
and the bonus must not follow it there. `from` is the route, the
distinction v3.44 had to make for allies.

**And it is added to a cond entry only when TRUE.** `instead` and
`atkHero` are always present, so a fourth always-present key changes the
shape of *every* cond in the pool — five drills that `deepEqual`
`fx.conds` went red on cards printing no weapon static at all. Those
drills are right to compare the whole object.

### `discard6` LEARNED THE OTHER PRINTED ORDER

Every other pool card says *"a card **with 6 or more {p}** is
**discarded**"*; Mandible Claw says *"you've **discarded** a card **with 6
or more {p}** this turn"* — the same question with the halves swapped,
which the existing pattern could not see. Anchored on **6**, not `\d+`,
because `discard6` names its threshold in the cond itself.

### Measured

- **348 → 351 full**, 46 → 43 `part`. Flagged cards 52 → 49.
- `npm test` **1561 drills, 0 fail, 4 skipped**. Fairness clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Eight sabotages, all eight bite.** One only after the drill stopped
  asserting on feed prose: removing the `wpnOnly` gate left it green,
  because the ability route prints no "goes again" line either way. Go
  again is a GAIN (CR 5.3.5), so the observable is the **action point** —
  with the gate gone, the met and unmet cases diverge there. **Fourth weak
  drill this cycle, and the third caught by asserting on the log.**

## v3.57 — a condition, a dropped gate the sweep cannot see, and a reader that stole a clause

### THE CONDITION MAPS ONTO AN EVALUATOR THAT ALREADY EXISTED

*"If you've pitched a blue card this turn"* is the Illusionist package's
own gate, and `pitchBlue<N>` has been in the engine since High Tide —
reachable only through that keyword's wording.

**The equivalence is the CR, not an approximation.** CR 4.4.3c sends the
pitch zone to the bottom of the deck in the end phase, so during a turn
that zone holds exactly the cards pitched **this** turn. "Pitched a blue
card this turn" and "a blue card is in your pitch zone" are one question
asked twice — which is why this reuses the evaluator rather than adding a
`hist` field. A second record of one fact is a second thing to keep in
step.

**It is a different question from `blue`**, which asks what you PLAYED.
Pitched and played are two fates of one card.

### AND IT EXPOSED A GATE THAT VANISHES

Building the condition made **Waning Vengeance**'s gate readable for the
first time — *"when this leaves the arena, if you've pitched a blue card
this turn, create a Spectral Shield token."*

`fxParse`'s op dispatcher files an `onLeave` payload into `fx.onLeave` and
has **no branch for a condition riding with it**. The gate was silently
DROPPED and the token minted unconditionally.

**The fairness sweep does not catch this**, and that is worth recording:
`COND-BYPASSED` looks for a condition gating an effect the engine ALSO
grants unconditionally, so it needs an unconditional twin to compare
against. Here the condition simply *vanishes*, leaving nothing to compare.
The sweep reported clean.

**Measured before acting:** Waning Vengeance is the ONLY pool card
printing a gated leave-trigger, so nothing had shipped wrong — this is a
latent hole closed before a card fell into it.

**And `fx.onLeave` has exactly one caller** — `tickSuspense`, for an aura
whose suspense counters run out. This card prints no suspense, and its
Ward is a side-level pool rather than counters on the aura, so nothing in
this engine can make it leave the arena at all. Reading the clause would
file it `full` with a dropped gate on a trigger that cannot fire: **two
ways wrong at once.** It refuses, and the card stays honestly `part`. The
ungated wording is untouched — Booze!, Lyath's boo and the
enters-or-leaves pair all still read.

### WAXING SPECTER — THE GATED ENTERS-WITH COUNTER

*"If you've pitched a blue card this turn, this enters the arena with a
+1{p} counter."* An **op, not an `fx` field**, because a field would land
unconditionally and make the printed gate decoration. **Stashed, not
applied** — the card is not on the board when the op runs, so the
board-placement site stamps it, the pattern `_selfDestruct` has followed
since v3.07.

### A READER THAT CANNOT READ ITS OWN MATCH MUST NOT CONSUME THE CLAUSE

Written as match-then-refuse, the enters-with rule matched Malefic
Incantation's *"this enters the arena with 3 **verse** counters"* — a kind
it does not know — and returned `null`, **killing a clause the existing
verse reader further down was already handling.** The card went `full` →
`part`.

**`coverage.test.js`'s pinned baseline is what caught it**, which is
exactly what that baseline is for: no tool that only counts totals would
have flagged one card moving down while others moved up.

The kind is tested in the **guard** now, so an unknown kind falls through
and both properties survive — "glitter" still refuses because nothing else
claims it, and "verse" reaches the reader that wants it.

### Measured

- **347 → 348 full**, 47 → 46 `part`. The counters family drops 4 → 3.
- `npm test` **1553 drills, 0 fail, 4 skipped**. Fairness clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Six sabotages, all six bite** — one only after being rewritten, because
  the first version appended a comment and changed no behaviour. A
  sabotage that does not apply proves nothing.

## v3.56 — a trigger that fires from the deck, and two probes that asked the wrong function

Boost banishes the top card of your deck to pay for the card you are
playing. **Three pool records print a trigger on that event** — Crankshaft
at two pitches and Big Bertha — *"when this is banished from boosting, put
a steam counter on a Hyper Driver you control."*

The payload has read correctly since v3.55. **What was missing was the
SCHEDULE**, and it fires from the DECK, on a card its controller never
played.

### IT IS HELD OFF `fx.ops`, AND THAT IS THE WHOLE POINT

Crankshaft is an **attack card**. Left in `ops`, its steam counter would
land every time the card was PLAYED — a printed delay collected as a bonus,
which is v3.07's suspense bug exactly. `fx.boostBanish` is read at the one
site that banishes a card for boosting.

**The payload goes back through `classifyClause`**, so it shares every
reader rather than growing its own vocabulary, and **an unreadable payload
refuses** the whole trigger — `atkTrigger` makes the same call one shape
over.

### THE TRIGGER BELONGS TO THE BANISHED CARD, NOT THE PLAYED ONE

Read off `card` instead of `top`, it would fire every time Big Bertha was
*boosted with* — the opposite card. **Crankshaft prints Boost itself**, so
it can be the card being played while something else pays, and that is the
fixture the drill uses: in the straightforward test Crankshaft is both
halves and the two readings are indistinguishable.

The actor needs no borrowing: the card came off this seat's deck and *"a
Hyper Driver you control"* is this seat's.

### A RECORDED REFUSAL CAME DUE, ON PURPOSE

v3.55 shipped a drill asserting **"Crankshaft still REFUSES — its trigger
does not exist"**, with the reason written into the assertion. Building the
trigger turned it red, and retiring it had to be a deliberate edit rather
than a quiet one. That is what a recorded refusal is FOR (v3.38) — and per
that same rule the refusal PROPERTY is kept alive as its own probe: an
unknown trigger and an unreadable payload both still refuse.

### AND TWO OF THOSE PROBES WERE ASKING THE WRONG FUNCTION

Written first as `classifyClause("When this is destroyed, put a steam
counter…") === null`, they passed against a **sabotaged engine that claimed
every "when this is …" trigger**. The boost-banish reader is a WHOLE-CARD
reader living in `fxParse`, so `classifyClause` returns null for those
shapes no matter what the reader does: the probes were asserting a
different function's refusal.

**Sabotage is the only reason anyone found out** — both were green, twice,
against a broken engine. They drive `fxParse` over synthetic fixtures now
(unique names, because it memoizes on `name|pitch`).

**Third weak drill this cycle**, after the arsenal fixture whose only hand
card was the arrow and the seat-relative sweep check that asserted on the
wrong side's zone. The engine has been right every time; the drills have
not.

### Measured

- **344 → 347 full**, 50 → 47 `part`. The counters family drops 7 → 4.
- `npm test` **1546 drills, 0 fail, 4 skipped**. Fairness sweep clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Five sabotages; all five bite** — two only after the probes were
  repointed at the function that actually holds the reader.

## v3.55 — a targeted counter put, and the tool stops overselling its families

`counters` has been a per-side map keyed by uid for a long time, and `aim`
was the one worked example of putting one on a chosen object. This is the
general form — the family label `npm run gaps` reported that **survived
being re-measured against the parser**.

| card | printed |
|---|---|
| Re-Charge! | *"Put a steam counter on a Hyper Driver you control."* |
| Astral Etchings | *"Put three +1{p} counters on target aura with ward you control."* |
| Uphold Tradition | *"Instant - {r}, turn this face-up: Put a +1{p} counter on an aura you control with ward."* |

### BOTH NUMBERS COME OFF THE LINE

Astral Etchings prints **three / two / one** across its three pitches, so a
hardcoded amount is right for one printing and silently wrong for the other
two — the same reason `rustDestroy` reads its threshold (v3.17) and Thunder
Quake's heave reads both of its (v3.32).

### THE KIND VOCABULARY IS CLOSED, AND THAT IS THE SAFETY PROPERTY

`steam`, `rust`, `aim` and `pow` — each is genuinely consumed somewhere
(`needSteam`, `rustedThrough`, the `aim` condition, `powCtr` and the idle
wipe). **`+1{p}` is the printed spelling of `pow`**; mapping a printed form
onto an existing field is reading, and adding a fifth key with no reader
would be parsing ahead of wiring.

**An unrecognised kind REFUSES.** A counter nothing consumes is a counter
that does nothing, filed `full` — the no-op blind spot at its purest.

### CANDIDATES COME FROM THE BOARD *AND* THE GEAR

A steam counter goes on a Hyper Driver, which is an **Item** and lives on
the board; rust and +1{p} counters go on **Equipment**. A scan of either
zone alone finds nothing for half the family — v3.33's Magmatic Carapace
lesson, where a board-only scan missed a Chest piece.

**With one legal target it just happens**; with two or more the choice is
real and is put to the player. A sheet offering a single forced choice is a
tap that teaches nothing.

**`ctrStamp` is DATA the answer applies** — `untapStamp`'s shape (v3.47),
`arsStamp`'s rule (v2.34): a spec only carries fields `buildPrompt` knows
about. That is now the third time this release cycle.

### "YOU CONTROL" IS CONSUMED — AND ONLY THAT

The op is actor-relative and searches the actor's own permanents, so the
words restate what the target zone already says (v3.18 settled exactly this
for `optFilter`'s destroy costs). Everything else still has to be read
whole, so *"target aura **with ward**"* keeps its ward. `ward` joined
`optFilter`'s keyword list, and the blast radius was **measured**: exactly
three pool cards print "with ward", two of which are the cards this reader
exists for.

### CRANKSHAFT AND BIG BERTHA STILL REFUSE, AND THAT IS THE POINT

They print the same payload behind *"when this is banished from boosting"*,
and **no such trigger exists**. The when-handler's trigger vocabulary is
CLOSED, so the whole clause refuses and both cards stay `part`. A payload
that parses with no schedule to fire on is the one shape `failstates.js`
cannot reach (v3.07) — and here it is avoided by the wrapper refusing
rather than by anything the new reader does.

### THE TOOL STOPS OVERSELLING ITS OWN FAMILIES

`gaps.js`'s `needs:` line is a **claim about machinery**, and the clustering
can only see what a card SAYS. All five were re-measured against the parser
in v3.53 and two did not survive. Every `needs:` line now says what is
actually left, and the header says why the check matters:

> the pattern is text and the `needs` is a claim about machinery, and those
> are not the same kind of statement.

**And the dossier drill stopped rotting.** It hardcoded *Astral Etchings*
as its fixture — so closing that card failed the drill, for the best
possible reason. It takes its fixture from the live report now. (Written
carelessly the first time: the regex matched the identically-indented
`needs:` line, and `includes()` then passed against the report's own header
while the real assertion failed. Fixed.)

### Measured

- **341 → 344 full**, 53 → 50 `part`. The counters family drops 10 → 7.
- `npm test` **1542 drills, 0 fail, 4 skipped**. Fairness sweep clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**.
- **Nine sabotages, all nine bite** — including "the chosen target is
  ignored and the first candidate takes it", which is why the driven drill
  picks the SECOND of two identical Hyper Drivers.
- One sabotage did not apply on the first attempt (regex escaping) and was
  re-run rather than believed: **check that a sabotage applied before
  concluding a drill is weak.**

## v3.54 — destroyed gear reaches the graveyard, and `retrieve` with it

**RULING (user, 2026-08-29): a destroyed piece of gear goes to the
graveyard, as the CR says of any destroyed permanent.**

Until now it was flagged `destroyed:true` and left in the gear zone
**forever**. That approximation was invisible for the best possible
reason — measured, the only pool cards that read gear in a graveyard are
the two `retrieve` cards themselves, and `retrieve` was unbuilt. So the
gap and the card that would expose it were hiding each other.

### THE PRINTING ANSWERED A QUESTION THAT LOOKED LIKE IT HAD TO BE ASKED

The database carries no reminder text for any keyword, and upstream's own
`keyword.json` lists **Retrieve with an empty description**. The recorded
ruling (user, 2026-07-25) gave the price — *"a player will need to pitch if
they do not have 1 resource"* — and never named the destination, which is
the one thing a reader cannot guess.

The SAR017 face of Pick Up the Point prints it in parentheses:

> When this attacks, you may **retrieve** a dagger from your graveyard.
> *(Pay {r} to equip it.)*

So retrieve is a graveyard pick costing {r} whose destination is the **gear
zone** — it comes back *equipped*, not to hand. **Third time reading the
printing has closed a booked question** (Clash of Agility, Thunder Quake,
this), and it is now the first thing to try, not the last.

And the loop is designed: **Mark of the Huntsman destroys ITSELF** to mark
a hero, which is exactly what puts a dagger in the graveyard for these two
cards to fetch. Against the old model that graveyard was always empty of
daggers and the ability could never do anything.

### IT IS A SWEEP, AND THAT IS THE WHOLE SAFETY ARGUMENT

**The two boards hold their wall differently.** The trainer's `blockG` is
a list of INDICES into `gear`; the table's is a list of uids. Removing an
entry while a wall is declared renumbers the defenders underneath it — and
`gearBlockApply` destroys a battleworn piece during exactly that
resolution.

So marking stays where it is, every existing wear and display read is
untouched, and the FILING is one shared body called from one point where
no wall can be live:

```
effects.sweepGear(game, seat) -> {game, msgs, moved}
```

Pure and seat-relative, the same contract `sweepArena` keeps, called from
step (4b) of `beginEndPhase` — so both boards get it without either
restating it. **The order inside that body is load-bearing:** it runs after
rust (which sets `destroyed` this turn) and after the idle wipe (which
reads `gear` by uid), the same specific-before-generic rule step (2)
states for Frostbite.

**WHEN it happens is a stated approximation.** The CR files a destroyed
permanent immediately; this files it at the beginning of the controller's
end phase. The observable difference is a destroy and a retrieve inside one
turn cycle. Recorded rather than hidden — the alternative was an inline
move that can renumber a live wall, which is a rules bug in a place no card
text would explain.

**Turn-stamped on the way in.** `_gy` is what answers the whole *"…this
turn"* family, and CLAUDE.md says in as many words that a new path into the
graveyard which forgets it makes those cards quietly wrong.

### THE PICK LEARNED A PRICE

`prompts.js` gained `cost` and `equipStamp` on a `pick`, declared
explicitly because **a spec only carries fields `buildPrompt` knows about**
— v2.34's `arsStamp` rule, and v3.53 had just been bitten by its mirror
image at the consumer. The cost is returned as `out.pay` **only when a card
actually moved**, so declining pays nothing: the v2.04 rule, applied to a
pick that carries its own cost.

**The re-equip fixup clears `destroyed` and `curDef`** — paying {r} for a
shield that still blocks for zero is the card doing nothing. **`weaponUsed`
is deliberately NOT cleared**: it is a per-turn allowance keyed by uid and
this engine keeps the piece's uid across the trip, so clearing it would
hand back a Once-per-Turn swing already spent. Weaker than printed and
visible, which is the direction v2.04 settled.

### Measured

- **339 → 341 full**, 55 → 53 `part` (Pick Up the Point, Up Sticks and Run).
- `npm test` **1533 drills, 0 fail, 4 skipped**. Fairness sweep clean.
- `npm run play`: 210 games, **0 refusals, 0 invariant violations, 0
  malformed feed**, and the win distribution is unchanged from before the
  gear model moved — which is the evidence that it did not perturb balance.
- **Eight sabotages against the new drill; all eight bite.** One found a
  weak drill rather than a weak engine, for the second time this week: the
  seat-relative check asserted on the *other* seat's GEAR, which a
  cross-seat leak into *this* seat's graveyard passes perfectly. Assert the
  destination, not only the source.
- Three existing rust drills were edited deliberately: they asserted
  `gear[0].destroyed`, which is the old model. They now assert the piece
  **left the gear zone and arrived in the graveyard**, which a flag set in
  place cannot satisfy.

## v3.53 — the readers the week asked for, and a mechanic with no caller

**Four cards closed, and the interesting half is what the hunt turned up.**
`WEEK.md` said the remaining work is "readers nobody has written" over
machinery that already exists. That was right — and the first family had a
worse case hiding inside it than the one it was scoped for.

### THE ARSENAL FACE-UP PUT HAS NEVER FIRED FROM `execute`

v2.33/v2.34 built the whole face-up arsenal mechanism: `_faceUp`/`_upTurn`,
the `arsenalUp` triggers an arrow fires when it is set face up, the Bull's
Eye Bracers `arsStamp` that rides on top, `arsCap`/`arsFree`/`arsEmpty` and
the two-gates ruling behind them. `CLAUDE.md` has said **"all three enablers
are live"** ever since.

**The queue site was inside `if(attacking)`, and not one card in the pool
that prints an arsenal put is an attack.** Measured — three distinct cards
set `fx.arsenalPut`:

| card | type |
|---|---|
| Call in the Big Guns | Ranger **Action** (non-attack), 3 printings |
| Bull's Eye Bracers | Ranger **Equipment** — Arms |
| Death Dealer | Ranger **Weapon** — Bow |

So the prompt was never once offered. **This is v3.20's defect verbatim,
one mechanic over** — its own note reads *"the only queue site was inside
`if(attacking)` while every card that needed it was a non-attack"*. A fix
written for one mechanic is not a fix for the shape, and the shape is what
recurs (v3.43: a guard belongs to the SHAPE, not to the version that wrote
it).

**Kept as two call sites over one body, following the `optCost` precedent.**
An attack that printed an arsenal put would work, and the else-branch — the
line that tells the player their arsenal was full — exists once. A drill
pins the measurement itself, so if an attack ever prints one it fails and
asks for the attacking-branch site to be re-checked rather than silently
relying on it.

**No tool here could see it.** Coverage reads Bull's Eye Bracers and Death
Dealer `full` — their ability line is correctly `noop` — and the fairness
sweep is one-sided toward cards that are too STRONG, while this is a printed
choice never offered. The drills could not either: they proved the reader
and they proved the sheet, and nothing asked whether anything opened one.

### `moveFoe` CARRIED `{from, to}` AND ITS CONSUMER IGNORED BOTH

The cross-seat move has taken a `{from, to}` spec since v3.03 and
`applyAnswer` moved **hand → deck top whatever it was told** — correct for
Brain Freeze, the only card that existed, and silently a no-op for the next
one. Pass Over banishes from the opponent's *graveyard*: against that body
the sheet opened, the right card was offered, the feed said it was banished,
and nothing moved.

**That is v2.34's `arsStamp` rule from the other end — a spec only carries
fields its consumer READS.** Fixed in the consumer, because the queue site
was already telling the truth.

### THREE PRINTED WORDINGS, THREE READERS, NO NEW MACHINERY

| card | printed | reads as |
|---|---|---|
| Preserve Tradition | *"put target action card from your graveyard on the bottom of your deck"* | `pickPrompt` → `deckBottom` |
| Rise from the Ashes | *"you may return a Phoenix Flame from your graveyard to your hand"* | `pickPrompt` → `hand`, `min:0` |
| Pass Over | *"banish target card from an opposing hero's graveyard"* | `foePick` → their `banish` |

**The destination is the printed half that varies**, so Memorial Ground's
"on top" and Preserve Tradition's "on the bottom" are one reader with one
word read, not two readers waiting to drift.

**`foePickTop` became `foePick`, one body for every cross-seat pick.** A
`foePickBanish` beside a `foePickTop` is two bodies for one shape, and the
second one drifts — v3.41's matcher written twice, v3.50's guard without its
sibling.

### THE SUBJECT KEEPS ITS PRINTED CAPITALISATION

`classifyClause` works on the **lowercased** clause; `optFilter`'s
NAMED-CARD branch is anchored on a **proper noun**, because that is the only
thing separating a name from a common noun. Handed lowercased text it
answers `null` — so Rise from the Ashes refused, and looked exactly like a
pattern that had not matched. The shape is matched on the levelled clause
and the SUBJECT recovered from the raw one, with the pattern declared once
so the two reads cannot drift.

v3.33's lesson from the other end: there, lowercasing put a mis-named token
on the board; here it silently REFUSES.

### A ZONE PICK'S SUBJECT IS NOT A COST'S SUBJECT

`optFilter` refuses a bare *"card"*, and that is right where it lives — its
callers read the subject of a **cost**. Pass Over prints *"banish target
CARD"*, where an empty filter is the faithful reading rather than a widened
guess. `pickSubject` adds exactly that one phrase and defers everything else,
so there is still one subject reader.

**The widening is deliberately not in `optFilter`, and the blast radius was
measured rather than reasoned about** (v3.33's rule): a bare "card" subject
appears **19 times across 11 pool cards**, most of them costs on hero
abilities — Boltyn's and Blasmophet's charges, Nasreth's banish, Azalea's
put. Widening `optFilter` would claim every one for readers nobody has
wired.

### Beckoning Haunt still refuses, on purpose

It prints *"return target aura **with cost X**"* against an `{x}{x}{r}`
cost. `optFilter` cannot consume "with cost x", so the whole subject fails
and the clause stays unclaimed. Flattening it to "an aura" would drop a
printed restriction — v3.31's shape, and the direction that steals games.
X-costs are refused across this engine on purpose (Ice Eternal); this is
that refusal arriving through the subject reader rather than as a special
case. Pinned by a drill.

### `npm run play` no longer throws away its own report

`tools/.cache/` is gitignored, so on a fresh clone the 210-game run finished,
printed its summary, and **then** died with `ENOENT` writing `games.json`.
Four minutes of work and the machine-readable half lost to a missing mkdir.

### Measured

- **335 → 339 full**, 59 → 55 `part` (Preserve Tradition, Rise from the
  Ashes, Pass Over, Call in the Big Guns).
- `npm test` **1527 drills, 0 fail, 4 skipped** (the drift drills, as designed).
- Fairness sweep clean. `npm run play`: 210 games, **0 refusals, 0 invariant
  violations, 0 malformed feed**.
- **Ten sabotages run against the two new drill files; all ten bite.** One
  of them found a weak drill rather than a weak engine — the arsenal fixture
  held nothing but the arrow, so dropping the filter entirely left the
  candidate list identical and the drill green. A fixture where two things
  coincide has tested neither (v3.26).

## v3.52 — `npm run gaps`, and the week planned from it

**The tools answered two questions and not the one a session opens with.**
The audit says how much of a card is read; the stack says which *ruling* is
missing. Neither says **what one reader would finish the most cards** —
and that turned out to be the most useful view of the remaining work in the
project.

**Measured over the 405-card pool:** 70 cards are unfinished, and **52 of
them are ONE clause away.** Those clauses cluster into five families that
cut straight across the hero list:

| cards | family | machinery |
|---|---|---|
| 12 | pick from a zone (graveyard / deck / banish) | **built** — `prompts.js`, v2.17 |
| 10 | counters on a permanent | half — `counters` exist, keyed by uid |
| 9 | create a token on a trigger | **built** — v3.33 |
| 8 | *"you may …, if you do …"* | **built** — `optCost`, two queue sites unwired since v3.20 |
| 5 | a granted / conditional keyword | **built** |
| 26 | unclustered one-offs | — |

**Four of the five are machinery that was built, documented, and never
wired to a reader.** That is v3.50's lesson at the level of a whole phase:
*a feature with no caller looks exactly like a feature that works, until
you count.* `prompts.js` has had the `pick` variant since v2.17 and no
parser rule emits the spec; `optCost.trigger` has named `hits` and
`defends` as "still to wire" for thirty versions.

**So Phase C stops going hero-by-hero and goes family-by-family** — see
`WEEK.md`. Four readers close roughly 46 of the 70, and the rulings are
effectively done: `npm run stack` reports **4 open, 5 cards.** The distance
left is the one CLAUDE.md has always named — *understood ≠ built* — and it
is engineering, not rules questions.

### The tool

`tools/gaps.js` reads `tools/audit.json` and ranks the families, with a
per-card dossier (`npm run gaps -- Astral`). It is a **report, not a
claim**: a card lands in the first family it matches, `unclustered` is an
honest answer, and the counts are printed — so a pattern that rots shows up
as a family collapsing rather than as a clean sweep.

Four properties are drilled, each because of a failure this project has
already had:

- **the families PARTITION the unfinished set.** A family that stopped
  matching moves its cards to `unclustered`; one that matched twice
  double-counts. Either way the sum stops equalling the total — the one
  check that cannot be satisfied by finding nothing.
- **it finds something.** A scan aimed at the wrong shape passes by
  finding nothing (v2.80, v3.21, v3.36 — three times now).
- **a stale read is VISIBLE.** It reads a build artifact, so it compares
  its own `appVer` against `index.html` and warns. A report a month older
  than the code is a confident answer about a codebase that no longer
  exists.
- **two printings of one card are named apart** — the audit is keyed
  `name|pitch`, so a bare list printed *"Crankshaft · Crankshaft"* and read
  as a bug in the report itself.

**And it honours `NO_COLOR` and a pipe.** Hardcoded escape codes made the
output unparseable by anything but a human — found by a drill that could
not read its own tool.

**1513 drills, 0 fail, 4 skipped.** Six new drills, five sabotages, all
biting after the first was found too weak to bite (it broke one alternation
of five).

## v3.51 — the two fight buttons say what a player gets

**Reported from a real table**, on the first session after going live:
*"there are 2 buttons on the sideboard, a red 'fight' and a brown 'fight at
the table — one engine' — confused by what's going on, but when I hit the
brown button things don't work quite as well."*

Both halves of that were right, and they are two different problems.

**THE LABEL DESCRIBED THE ARCHITECTURE.** *"One engine"* is the Phase 1
rebuild's merged `judge.js` / `effects.js` path — it is true, it is the
thing this project spent twenty versions building, and it answers a
question no player asked. A button label is not a place to put an
engineering milestone.

**AND THE OTHER HALF IS REAL, MEASURED, AND WAS UNDOCUMENTED ON SCREEN.**
What differs between the two boards is the opponent's brain:

| button | opponent |
|---|---|
| **Fight** | the trainer — the scripted, **tuned** `[3,4,5]` escalation |
| **Fight the new engine — harder** | `sparring.act` — the same 30-card pile played as a real seat: it holds a hand, pays costs and blocks like a person, and is **untuned** |

Measured this version over the exact build the button makes (hero vs the
vanilla dummy, three seeds each, both seatings): **the dummy wins 29 of
45**, and nine of fifteen heroes go 0–3 against it. CLAUDE.md has recorded
that state since v2.81; the SCREEN never did. A player who loses nine
straight is owed the reason before the game rather than after it, so both
buttons now carry a one-line note and the second says *harder* on its
face.

*(That number is an upper bound on the difficulty a person faces: it has
`sparring.act` piloting the hero seat too, and PLAYNOTES.md's finding 3 is
that the policy plays attack decks well and control decks not at all.)*

**AND THE TABLE BUILD FELL THROUGH TO THE TRAINER IN SILENCE.** If
`buildMatch` threw, the player tapped one board and was seated at the
other with no indication — so every difference they then noticed was
attributed to the wrong thing. Not dead-ending is still right; doing it
quietly is **v2.51's "never dress a failed copy as a success"** in the one
place the two boards are hardest to tell apart. It warns, records
`window.__dawnTableFail`, and says so on screen.

**A DRILL CAUGHT ITSELF ON "UNTUNED" CONTAINING "TUNED"** — the
whole-block assertion stayed green with the trainer's note deleted, which
is v2.44's *Reaction-contains-action* trap in a drill rather than in the
parser. Scoped to the trainer's own region, and the sabotage that finds it
is deleting the word from the first note only.

**1507 drills, 0 fail, 4 skipped.** Two new drills, three sabotages, all
biting.

## v3.50 — the seat learns to use its allies, and that found a two-zone bug

v3.49's self-play run reported the gap and this closes it. **`sparring.js`
contained zero occurrences of `board`, `arena` or `ally`** — so everything
v3.44 through v3.48 built had **no driver**:

```
states with an untapped ally on the acting board   1077
ally attacks PROPOSED by the policy                   0
hero-ability activations proposed                     0
v3.46's death / Gold triggers fired                    0
```

**A feature with no caller looks exactly like a feature that works, until
you count.**

**ALLIES ARE RANKED WITH THE HAND, NOT AFTER IT.** An ally's swing and a
card from hand both cost the turn's one action point, so they compete for
the same thing; a blanket "allies last" would be a rule this file has no
business inventing. Printed power decides, exactly as it does for a card.
The hero's own ability goes last, behind the attacks, because every
printed hero ability in this pool digs or buffs rather than dealing
damage — and deciding otherwise would mean reading the card.

**THE ENTRY IS NOT THE CARD.** A board entry is `{card, kind, uid, …}`, so
the power lives on `.card` and the uid on the **entry**. Reading
`num(b,"power")` returns 0 for every ally and silently ranks them last —
the same bug wearing a different hat. `GM.isAlly` reads the entry's kind
rather than a printed type line, which is what keeps this inside
sparring.js's founding no-card-text contract.

### GIVING IT A DRIVER IMMEDIATELY LIT THE GUARD RAILS

The first 210-game run with the arena branch reported **3761
`CARD-IN-TWO-ZONES` violations**:

```
"Barnacle" (uid 65) is in 2 zones at once: sides[1].board + chain
```

An attacking ally was on the **board** and in **`chainCards`** at the same
time. `declareAttack` already excluded a weapon from that list, and its
comment states the rule correctly:

> *Equipment is NOT filed here: a weapon stays equipped and is spent, so
> it never leaves the gear zone.*

An ally is the identical case — v3.44 says so in as many words, *"an ally
stays in the arena exactly as a weapon stays equipped"* — and that version
added the second activation route **without giving this guard its
sibling**. That is **v3.43's lesson exactly: a guard belongs to the SHAPE,
not to the version that wrote it.** `fileAttack` was checked and needed no
change; `chainCards` is a different list with the same requirement, and
nobody asked it.

**Nothing could have caught it**, because until this version nothing in a
self-play game ever attacked with an ally. The invariant judge has been
wired into every state change since v2.21 and had never once been given
the state that breaks.

**The guard excludes the two activation routes and nothing else.** Widening
it to every attack loses the chain zone entirely — and a card in NO zone
falls silently out of the census, which is worse than the bug. A drill
pins both directions.

### Measured over the same 210 matchups

| | before | after |
|---|---|---|
| invariant violations | 3761 | **0** |
| stalls | 13 | **10** |
| Gravy Bones wins | 5 | **19** |
| policy refusals | 0 | 0 |

Driven, in one game: *"Gravy Bones attacks with Swabbie for 7"* — costed,
blockable and repeatable, seventeen times.

**`death` and `gold` are still 0, and now for a stated reason.** The policy
always names the hero as its attack-target: CR 1.4.5 makes the choice
mandatory, the hero is the one answer always available, and choosing an
ally instead is a judgement about playing well — allies heal every turn
(CR 4.4.3a), so it is a per-turn race rather than attrition. A policy that
reads no card text should not be guessing at it. Recorded in
`PLAYNOTES.md` rather than faked.

**1505 drills, 0 fail, 4 skipped.** 9 new drills, every one sabotaged —
and **four of the eight sabotages found a weak drill rather than a weak
engine**, including a tie-break fixture whose entry and card uids
coincided, so it could not tell `byUid(a,b)` from `byUid(a.c,b.c)` and
passed against both.

## v3.49 — the rolled intellect settles back, and how playing found it

**This one was found by PLAYING, not by a drill.** 210 self-play games —
every hero against every other, `sparring.act` in both seats, driven
through `judge.reduce` with the invariant judge auditing every
intermediate state. The engine came through clean: **0 policy refusals, 0
invariant violations, 0 malformed feed lines** across 210 complete games.

**But 14 of them ran past turn 1900 and never ended.** Pulling one apart:

```
turn 1955   Iyslander hp 5, hand 4, deck 40
            Kayo      hp 19, hand 1, deck 42   ← intellect 1
both seats: pass, endTurn, pass, endTurn, forever
```

**Kayo's intellect was 1.** Knucklehead prints:

> Action - Destroy this: Roll a 6 sided die. **Until end of turn**, your
> base {i} is the number rolled.

`effects.intRoll` stashes the printed value on `intWas`, and **nothing at
the table ever read it back.** The trainer restored it inline in
`index.html`; `judge.js` did not. So at a table the rolled value was
**permanent** — a roll of 1 crippled the hero for the rest of the game,
and a roll of 6 was a permanent +2 intellect, which is the direction that
steals games.

**A SCHEDULE IS WRITTEN PER BOARD (v3.01), and this one was written on one
board.** Same family as phantasm's pop, the graveyard-play gate and the
three end-phase events v3.17 pulled into `beginEndPhase`.

**IT IS NOT A `beginEndPhase` STEP, and that is the whole of getting it
right.** The rolled value has to govern the **(f) draw** — that is what
the card is FOR, and `intRoll`'s own feed line says so ("that many cards
at the draw step"). `beginEndPhase` runs *before* (a)-(f), so restoring
there would hand the draw the printed value and make Knucklehead do
nothing at all. `effects.settleIntellect(game, seat)` is the one body and
both boards call it **after** the draw, on the turn-player's own end
phase, exactly where the trainer always had it. `lastRoll` is cleared with
it — a die left on the state is a later `intRoll` reading a roll nobody
made this turn.

**NO TOOL HERE COULD SEE IT.** Coverage reads Knucklehead's clause
consumed. The fairness sweep is deliberately one-sided and models no
schedules — and on a roll of 5-6 this genuinely IS stronger than printed.
`failstates.js` has a "no schedule to fire on" category and fills it by
looking for UNREAD text, so a schedule that parses and then evaporates is
the one case it cannot reach. And no drill caught it because the trainer
had the restore, so anything measuring that board passed.

**The fix is worth 4 wins.** Kayo went 23 → 27 across the same 210
matchups, and one stalled game (`iyslander-kayo`) now finishes.

### WHAT ELSE THE SELF-PLAY FOUND — recorded, not fixed

See `PLAYNOTES.md` for the full session. The three that matter:

| finding | shape |
|---|---|
| **`sparring.act` has no arena branch** | v3.44-48 built ally combat and **nothing drives it**. 0 ally attacks across 549 opportunities; `death` and `gold` triggers never fired once in 210 games. The policy also proposes **0** hero-ability activations |
| **`sparring.act` cannot pilot a control hero** | Iyslander scored **0 wins in 210 games** and is in all 13 remaining stalls. Driven: she holds four LEGAL cards and an action point, and the policy proposes `endTurn` — it plays attacks, and her deck is nearly all non-attacks |
| **Cosmo swings for 0 power, 413 times** | judge routes on `types.isWeaponType` where `build.js` routes on `parser.isWeapon`. The pinned split says the powerless four take the ABILITY route. Tested as a fix and it did **not** help the stalls, so it is recorded rather than rushed |

**1496 drills, 0 fail, 4 skipped.** 8 new drills, every one sabotaged
seven ways. Fairness clean, coverage unchanged.

## v3.48 — a tapped hero, and the one thing it means

**RULING (user, 2026-08-25), verbatim:**

> "Tapping a hero doesn't mean much on its own — when tapped it mainly
>  means it cannot be tapped again to pay a cost. The tapping mechanism
>  was added in later sets and older heroes are often unaffected by being
>  tapped."

**THE NARROWNESS IS THE RULING, NOT A SHORTCUT.** A tapped hero keeps its
life, its intellect, its defence and its windows. Inventing a penalty here
would be the golden rule broken at the keyword level — and the ruling says
in as many words that most heroes are unaffected. Measured against the
pool: exactly **three of fifteen heroes** print a `{t}` cost on themselves
(Bravo, Gravy Bones, Lyath), so for the other twelve the tap is a
correctly-read **no-op**, and the feed says which — *"nothing happened"*
and *"nothing was supposed to happen"* are different lessons.

**IT IS A DIFFERENT RECORD FROM `weaponUsed["hpow"]`**, which is v2.46's
"two limits that expire differently" one zone further in:

| | is | lifted by |
|---|---|---|
| `weaponUsed["hpow"]` | a per-turn **ALLOWANCE** | every turn boundary, for both seats |
| `heroTapped` | the **STATE** | the controller's own untap step (CR 4.4.3d) |

They coincide for a hero using its own ability and **come apart the moment
an OPPONENT taps you** — which is exactly what the two cards this
unblocked do. So a hero tapped during your turn stays tapped for the rest
of it and no longer, and a drill drives a whole turn to prove the
allowance comes back while the tap does not.

**TWO CARDS, AND NEITHER NEEDED NEW MACHINERY:**

| card | was | is |
|---|---|---|
| **Entangling Shot** | `tier: none` | `full` — *"you may {t} target hero"* on its arsenal-up trigger. `parseHeroPower` refuses a line whose payload has no reader (v3.04), so **reading the payload is what created the route**, for the second version running |
| **Drop the Anchor** | rider in `quotedUnread` | read, and **hero-gated** — *"When this hits a **hero**, {t} them and all allies they control"* must not fire off a hit on an ally (v3.45) |

**THE ALLY HALF IS WHY THE CARD IS PLAYED.** Allies tap to attack (v3.44),
so tapping theirs stops a swing where tapping the hero mostly does not.
One printed sentence naming two targets is **one op with a flag**, not two
clauses — and Entangling Shot prints no ally half, so it gets none.

**AND THE BUILD READ MUST BE THE TAPPED SIDE'S.** `tapFoeHero` taps the
OTHER seat, so `bAct` there asks whether the **tapper's** hero has a `{t}`
ability — the wrong hero, and right by accident only in the self branch.
That is `arcTaken`'s inversion (v3.40) in a feed line, and the sabotage
that finds it is Blaze tapping Lyath rather than the reverse.

### A LIVE BUG, FOUND ON THE WAY — `clean` COLLAPSES THE NEWLINES

`tapsToActivate` split `clean(tx)` on `/\n+/`, and **`clean` collapses the
very newlines the split depends on** — the same trap `printedKw` and
`kwGated` each carry a comment about. The whole card arrived as one line,
so the `.find` only ever matched a card whose activated ability is its
**FIRST printed line**, and answered FALSE for any other.

Two live casualties: **Lyath Goldmane**, whose `Instant - {r}{r}, {t}:`
sits under his halving static, and **Concealed Object**, whose tap sits
under its own destroy clock. For both, the flag was filed as a per-turn
**allowance** instead of a **tap**, so `perTurnCleared` lifted it at the
turn boundary rather than at the controller's untap step. Split the raw
text, clean each line.

### A BLANKET AUDIT FLAG IS A CLAIM THAT CAN STOP BEING TRUE

The audit flagged *"tap cost {t} — not enforced (see ledger)"* on **every
card whose text contains the symbol**, and by this version it was wrong
about **fourteen of the pool's seventeen**: an ally's tap has been charged
since v3.44, a weapon's since v2.46, an equipment or item ability's by
`tapsToActivate` + `perTurnCleared`, a triggered *"you may {t} this"* since
v3.33, and a hero's as of now.

It asks the **CLAUSE** now, exactly as the `{u}` flag beside it does —
and `noop` is the right state for an activation LINE, because the tap is
charged by the **ROUTE**, not by an op. Three cards keep the flag and all
three are one shape: the ability's **payload** has no reader, so there is
no ability for a tap to be charged against (Bravo's *"turn a face-down
card face-up"*, Goldkiss Rum, Turn to Mindfire's Ponder rider). Flagged
cards **65 → 54**.

`tools/ledger.js`'s `{t}` and `{u}` entries both still said *"not
parsed"*. That is not prose — `failstates.js` grades a keyword's severity
against its **status** rather than a grep (v3.00), so a stale `pending` is
load-bearing. Both are corrected: **v3.41's rule, that when you close a
recorded gap you delete the record.**

**Coverage 334 → 335 full, 12 → 11 none.** Fairness clean, UNFAIR 0.
Symmetry ledger 43 → 44. 21 new drills, every one sabotaged.

## v3.47 — untap, and why refusing it was right until now

`{u}` has been flagged *"not parsed (see ledger)"* for as long as that flag
has existed, and **refusing it was correct the whole time**: until v3.44
allies did not tap, so untapping one bought nothing, and reading it would
have been a card doing nothing dressed as a card that works.

`{t}` is now what an ally spends to attack. So **Scuttle Toes** — Gravy
Bones' Legs piece, in the deck list — went from a card with no route to
the only way an ally swings twice in a turn.

> **Instant - {r}{r}, destroy this: {u} target ally you control. Destroy
> it at the beginning of the end phase.**

**READING THE PAYLOAD IS WHAT CREATED THE ROUTE.** `parseHeroPower`
refuses a line whose payload has no reader — v3.04's "never parse ahead of
wiring" — so `build.js` gave the piece **no `powCard` at all** and neither
board could activate it. It read `tier: part` with its whole ability
unread. One reader, and the existing v3.04 equipment route picked it up on
both boards with no wiring at all.

**"IT" IS THE ALLY, NOT THE SOURCE.** The splitter breaks on the period,
so *"Destroy it at the beginning of the end phase"* arrives alone and
reads as `selfDestruct end` — which destroys the SOURCE. The source is
Scuttle Toes, already destroyed to pay the cost, so the printed drawback
would land on nothing and the untapped ally would live for free. That is
**v2.33's Bull's Eye Bracers trap** exactly, and it takes the same fix: the
clock is held back in `fxParse` and rides on the op that knows which card
"it" is. An ordinary self-destruct is untouched, and a drill pins that.

**A DESTROYED ALLY HAS DIED.** "Destroy" and "dies" are the same event for
a living object, so the sweep now fires `onDeath` — which closes a chain
built across four versions:

```
an ally attacks and taps        (v3.44)
Scuttle Toes untaps it, stamped for the end phase   (v3.47)
it attacks again — 14 from one ally in a turn
the sweep destroys it          (v3.47)
"when this dies" pays out      (v3.46)
```

**Gated on `isAlly`, not on the op's presence.** "Dies" is printed about a
LIVING object; an aura or item on the same clock is destroyed but does not
die, and reading the trigger off anything that happened to print one would
be inventing a rule the CR does not have. A drill holds both halves.

**AND THE PICK SUPPLIES ITS OWN CANDIDATES.** Written first as
`zone:"board"` + a `{tt:"ally"}` filter, the sheet reported *"Swabbie
revealed from board"* — and `prompts.js`'s own comment says a zone it was
not really read from "is a feed line that lies". This is a TARGET choice,
not a reveal. Cold Snap's freeze supplies candidates for the same reason,
and it is more precise besides: `G.isAlly` reads the board ENTRY's kind,
where a `tt` filter re-asks the question of the printed type line.

`untapStamp` is DATA the answer applies, not ops — the `arsStamp` lesson
(v2.34), and a drill checks it survives `buildPrompt`, because a field the
sheet has never heard of is dropped in silence.

**THE AUDIT FLAG IS ACCURATE AGAIN.** `{u}` was flagged unconditionally,
which stopped being true for Scuttle Toes. The test is now the CLAUSE
rather than the ops — the card's untap lives on its powCard, and what
changed is that its ability line went from `skip` (no reader, hence no
powCard) to `noop` (read by the equipment reader). **Jack Be Quick still
flags**, honestly: its `{u}` untaps an OPPOSING ally and then steals it,
which is a control change nothing models.

Coverage **333 → 334 full**. Seven sabotages, all biting.

## v3.46 — the on-attack twin, and the last live ally gap

Two pieces, both finishing what v3.44/45 started, and **one scoping
decision that deleted a planned job**.

### The planned job that turned out to be dead code

HANDOFF listed "the trainer cannot choose an attack-target" as the next
step. Measured before building it: the trainer's opponent is
`DUMMY_DECK` — **12 vanilla attack actions, no allies** — and its swing is
`foeSwing`'s `[3,4,5]` fabrication with no target choice in it. So the
trainer can never field an ally against you, and can never choose to
attack one of yours. A target picker there would be **dead code**, and its
`heroHit: total > 0` is not an approximation waiting to be fixed — it is
complete and correct *for that board*. Recorded rather than built.

### "When this attacks a HERO" — the twin of v3.45

v3.45 gated the on-HIT triggers. The on-ATTACK ones were deferred with a
reason, and the reason is now discharged.

| card | did | prints |
|---|---|---|
| **Path of Same Ends** | dealt 1 arcane to the hero while attacking an **ally** | *"deal 1 arcane damage to **them**"* |
| **Mocking Blow** ×3 | booed the crowd off an attack on an ally | *"when this attacks a **hero**"* |

The wrapper was being consumed and thrown away — `classifyClause` split on
the first comma, recursed into the inner gate, and the subject went with
it. It survives as `atkHero` now, set before the cond dispatch so every
branch carries it. **32 pool clauses print a bare "when this attacks" and
are untouched**: a bare trigger fires on any target, which is v2.12's "a
trigger is not a gate".

**IT IS A DIFFERENT QUESTION FROM `heroHit`.** An attacks-trigger fires
when the attack is **declared**, whether or not it goes on to connect — so
a swing blocked to nothing still attacked a hero. `heroTarget` is its own
answer, derived once at the top of `execute` from the caller's target, and
judge now hands that target in (it already had it, and was applying it
*after* the fact in `declareAttack`).

The payload fires **at declaration**, which is where the Runechant pop
already sits and for the same stated reason: a triggered ability goes on
the stack above the attack that triggered it, so it resolves first.

### An ally that dies does what it prints

**Oysten, Heart of Gold** — *"When this dies, create a Gold token."* The
pool's **only** death trigger, in the Gravy Bones deck, and unreachable
until allies could attack (v3.44) and be attacked (v3.45). It read
`tier: part` with the clause skipped.

**THE TRIGGER BELONGS TO THE ALLY'S CONTROLLER, NOT TO WHOEVER KILLED
IT.** Inside a combat link the actor is the ATTACKER, so running the ops
as they stand hands Oysten's Gold to the player who just shot it down.
`effects.allyDeath` borrows the controller's seat for the payload and
**gives it back** — the same inversion `arcTaken` documents on the
deferred soak path (v3.28). `game.js` still owns the zone move and reports
the corpse; this owns what the card says.

Coverage **332 → 333 full**, and it is exactly Oysten — the first earned
tier move in five versions, because everything since v3.42 fixed things
coverage cannot see.

### And a feed line that became a lie the moment a seat could be borrowed

`runOps`' token message read *"created on **your** board"*, which is the
v2.83 second-person debt. Harmless while the actor was always the player;
actively misleading the instant a token could be minted under a borrowed
actor, because Oysten's Gold appeared in a shared feed as the attacker's.
It names the seat now (and still reads "your board" in the trainer, whose
seat 0 is literally named "You"). The pinned ledger is a ceiling, so it
went down rather than needing an edit.

### Sabotage found three holes in my own drills

Nine sabotages, and the first pass caught only six:

* removing judge's `target` hand-off failed nothing — every drill called
  the shared bodies directly. **Drive the real entry point.**
* removing judge's death-trigger call site: the same.
* and the worst one — the drill written to catch the first was **passing
  against a sabotaged engine**, because Gravy Bones wears **Nullrune
  Gloves** and Arcane Barrier 1 soaks Path of Same Ends' single point of
  arcane completely. Its "hero half" was measuring the 3-power swing, not
  the 1 arcane. The drill strips the defender's iron now and asserts
  `hp0 - power - 1`, which isolates the trigger.

## v3.45 — whose hit was it? the attack-target decides which triggers fire

v3.44 let allies attack. This is the other half of the same mechanism, and
it is the bigger one: **an ally can be attacked**, and the moment that is
true, *"hits"* and *"hits a **hero**"* stop being the same event.

**DRIVEN AT THE TABLE, BEFORE ANY CODE.** Infecting Shot prints *"When
this hits a HERO, create a Bloodrot Pox token under their control."* Aimed
at Barnacle — an ALLY — the feed read:

```
Barnacle takes 5 and goes down — face-down in the graveyard…
Bloodrot Pox created on Gravy Bones's board
```

The pool partitions cleanly, and **both halves matter**:

| trigger | printed | count | was |
|---|---|---|---|
| on-hit | **"hits a hero"** / "hits them" | 19 | ✗ fired on an ally hit |
| on-hit | bare "when this hits" | 13 | ✓ correct — Illuminate ascends on ANY hit |
| crush | *"damage to a **hero**"* | **15 of 15** | ✗ crushed allies |
| on-attack | "attacks a hero" | 5 | deferred — see below |

**34 records were firing a hero-gated trigger off an ally hit.** No tool
here could see it: coverage counts the clause consumed either way, and the
fairness sweep does not model attack-targets at all.

**THE GATE ALREADY EXISTED — NOTHING WAS ASKING IT.** `heroHit` has been
the caller's answer since v3.21 (judge routes CR 1.4.5 damage and knows
the target kind; the trainer wires no ally targeting and answers "any
damage is a hero hit", which is true *for it*). It was consumed by exactly
one reader — Briar's Earth latch. It now gates four, from one named local,
and the trainer's behaviour is unchanged by construction.

**TWO LISTS, NOT A TAG ON THE OP.** An op is a bare array
(`["token","gold",1,"self"]`), so a flag on it sits where another reader
expects a parameter. `fx.onHitHero` mirrors `condOnHit`, which is already
a separate list for the same reason. `condOnHit` entries and the quoted
**riders** carry the subject too — Avast Ye! and Yo Ho Ho! both print
*"When this hits a hero, create a Gold token"*, so the grant they hand
over is gated as well.

**CRUSH IS GATED BY ITS OWN ANCHOR, NOT BY A CLAIM ABOUT THE KEYWORD.**
The reader's pattern already *requires* the printed words "damage to a
hero", so every card reaching `fx.crush` printed them. A drill pins the
anchor, because widening it would silently turn the read into an
assumption.

### And the splitter was cutting inside quoted abilities

Chasing the ally-attack riders turned up a structural defect one layer
down. The clause splitter broke on `". "` — **including inside a quoted
granted ability**, which FaB prints in quotes precisely to delimit it. So
clause 1 ended holding an *unterminated* quote, `quotedText` found no
closing mark, and the payload fell through to the loose matchers:

| card | did | prints |
|---|---|---|
| **Loot the Hold** | opponent discards **on play** — no attack, no ally, no hit | a rider on your next Pirate ally attack |
| **Loot the Arsenal** | minted its **Gold token** on play | Gold only *if* the destroy happens |

Loot the Arsenal is the worse direction: the reward with the printed cost
dropped. Both read `tier: part`, so nothing was looking.

Three things came out of it, and each is measured:

* **the splitter is quote-aware.** Only a quoted span containing a
  sentence break is affected; the other 26 quoted riders in the pool are
  single sentences and split identically. Coverage moved **not at all**
  (332/61/12 before and after), which is the correct result and is also
  exactly why this class hides.
* **a trailing period is not a sentence break.** The first cut treated
  end-of-string as one and ate the final `.` — caught by an existing drill
  pinning an override's exact clause text.
* **`quotedText` no longer needs the word "and".** A rider-only grant has
  no head, so the anchor every other shape leans on is absent. Widened to
  double quotes only (v3.41's apostrophe hazard lives in the other
  branch); measured across the pool first: **22 extractions identical, 6
  newly found, 0 changed.**

**THE RIDER-ONLY GRANT is the family's fifth member**, and it reuses
`buffQ` whole as a grant of ZERO power carrying a rider — the entry shape
is already `{amt, q, rider}`. It sits with the WHOLE-CLAUSE patterns, and
that placement is the rule rather than a convenience: the loose payload
matchers run first and a grant's quoted payload is made of payload
language by construction, so read late a grant is stolen by its own rider.

**AND AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE.** Both Loot cards
carry an *"if you do"* tail, the family this project deliberately does not
read, so they claim **nothing** — which is weaker than printed and honest,
where reading half was stronger than printed and silent.

### Deferred, with the reason

**"When this attacks a HERO"** — 5 records, of which only Mocking Blow
(×3) is live; the other two are already-honest refusals. The target is not
known inside `execute` at declaration time, so gating it means changing
that contract. Written up in HANDOFF.md rather than half-built.

Two new drill files' worth of coverage; **six sabotages, and two found
holes in my own drills** — removing the crush gate and accepting an
unreadable payload each failed nothing until the missing case was *driven*
rather than asked of the parser.

## v3.44 — allies attack, and the parser had been ready for years

Went down the Avast Ye! rabbit hole. It bottoms out here: the card names
a *Pirate ally attack*, and **no ally could attack on either board**.

**"Allies do not attack" was half true, and the half that was false was
worse than the half that was true.** The table genuinely could not: there
was no arena branch in `judge.legal` at all, so `find(sd.gear, uid)`
missed and it answered *"no such equipment"* — v3.04's shape for the third
time (a route that exists on one board because `Battle` built it as UI).
The trainer *could*, through `allySwing`, and that was a **fabrication** in
the same family as `foeSwing`'s `[3,4,5]`:

| it did | the card prints |
|---|---|
| `oppMut(n).hp -= b.card.power` — straight off the hero's life | an attack, which goes to a **defend step** |
| charged nothing | `{r}{r}` for Swabbie, `{r}` for Limpit and Riggermortis |
| one blanket `spent` | `{t}` on six, `Once per Turn` on four — **two limits that expire differently** |
| dropped the go again | Limpit and Cintari Sellsword print `Attack. Go again` |
| took no action point, and said so in the log | an activated ability costs one (CR 8.1.1) |

So a 7-power Swabbie was **unblockable, free and repeatable every turn**.
No tool here could see it: the fairness sweep does not model board
activations, and coverage read every ally `full` because its ability line
was correctly NOOP'd by the weapon-cost reader.

**THE PARSER WAS NEVER THE GAP.** Every ally that attacks prints a
weapon's grammar exactly —

```
Swabbie             Action - {r}{r}, {t}: Attack
Limpit, Hop-a-long  Action - {r}, {t}: Attack. Go again
Cintari Sellsword   Once per Turn Action - {r}: Attack. Go again
```

— so `weaponCost` already answered cost, `taps` and `oncePerTurn`
correctly for all eleven, and had done for years while nothing asked it.
`parser.allyAttack` is the named question rather than a second parse of
the same line, and it keeps `parser.isWeapon` false for an ally, which is
the two-names-two-questions split pinned since v2.44.

**`execute` LEARNED `from: "ally"` AND THE REST CAME FREE.** The whole
combat path is shared: a real `pend`, the wall, on-hit text, CR 1.4.5
targeting, the action point (charged at resolution, kept on go again), and
every next-attack grant that names the ally — including `atk: true`, the
atom v3.43 added. `fileAttack` needed no change at all: it files nothing
on an activation route, so an ally stays in the arena exactly as a weapon
stays equipped. Driven, Swabbie's 7 into a 3-defence wall is now 4
through, where the fabrication dealt all 7.

**A KEYWORD ON AN ABILITY LINE IS THE ABILITY'S, NOT THE CARD'S.** Limpit
prints `Action - {r}, {t}: Attack. Go again`; the clause splitter breaks
on the period, so `Go again` arrives as a clause of its own and set
`fx.ga` — the CARD's. Driven, **deploying Limpit kept its action point**: a
free ally out of Gravy Bones' own deck. The fix is **route-aware**, not a
blanket change: a weapon is never played from hand, so Mark of the
Huntsman's identical line must keep setting `fx.ga` or a real card
silently loses its keyword. And on the ally *attack* route the answer is
the attack ability's own line, never `fx.ga` — Cutty Shark prints its go
again on a **different** ability, and handing that to the attack would be
reading one ability's text onto another.

**THE COST IS THE ABILITY'S TOO.** `build.js` folds a weapon's activation
cost onto its gear entry's `.cost`, which is how `effCost` charges a swing
without `effects.js` knowing what a weapon is. An ally's `.cost` is its
**play** cost — Swabbie 3, already spent deploying it. The first cut
charged both and took 5 for a 2-cost attack; there is one charge site now.

**THE PAYOFF.** Avast Ye! → deploy a Pirate ally → attack with it: the
grant fires, the rider rides, Swabbie's 7 lands and the Gold token
appears. v3.42 built the rider, v3.43 stopped a deploy eating the grant,
and this is the first version where all three halves meet — drilled with
the real cards out of the deck they share, not a synthetic fixture.
**Yo Ho Ho!** becomes real by the same route.

`allySwing` is **deleted**, and its anchor removed from
`test/actor.test.js`'s ledger as a deliberate edit — the rule it bounded
did not vanish, it moved into `tryPlay`, which that ledger already covers.

13 new drills in `test/allies.test.js`; seven sabotages, and **one of them
found a hole in a drill of mine** — reading `fx.ga` on the ally route
failed nothing until the Cutty Shark case was *driven* rather than asked
of the parser.

**Found, recorded, NOT fixed:** judge routes **Cosmo, Scroll of Ancestral
Tapestry** as a swinging weapon though it prints no power, because
`weaponCost` matches a *quoted granted ability* inside its text and
judge's weapon branch tests `types.isWeaponType` where the swing needs a
printed power. `allyAttack` guards `power > 0` deliberately for exactly
this reason. Written up in HANDOFF.md rather than half-fixed mid-thread.

## v3.43 — what v3.42 left behind, in the grant it had just reshaped

v3.42 built Avast Ye!'s rider and shipped two defects doing it. Both are
shapes this file already names, which is the point of writing them down.

**1. IT RETIRED A SHAPE AND LEFT THE GUARD BEHIND.** v3.31 changed the
qualifier from a bare array to an object and wrote the guard in as many
words — *"a bare array is the old shape, and it matches NOTHING … every
field test passes vacuously on one, so a stale caller would silently get
'matches everything', the exact direction that steals games."* v3.42 made
the identical move one shape later — `gaNextQ` entries went from a bare
qualifier to `{q, rider}` — and did not carry the guard across. On a stale
entry `x.q` is `undefined`, and `qualMatches` answers **TRUE** for an
absent qualifier *by design* ("unqualified buffs hit everything"). So a
pre-v3.42 grant arriving off a wire or a replay granted go again to any
card in the game and spent itself doing it. Driven and confirmed before
the fix.

The guard belongs in `takeGaNext`, not in `qualMatches`: "absent means
everything" is *correct* for the matcher and wrong only for an ENTRY that
must always carry one. A drill pins that premise so the two cannot drift.

**2. THE ANCHOR IS NOT AN ATOM.** These readers match ON the printed word
"attack" — it is the regex anchor, not a captured qualifier — so no
qualifier could ever *say* it. `attackQual` unpicks `non-attack` into
`nonAtk: true` and had no symmetric case for `attack`.

Two of the pool's six qualified go-again grants therefore carried nothing
that excluded a non-attack:

| card | printed | collected by |
|---|---|---|
| **Avast Ye!** | your next Pirate ally **attack** | **DEPLOYING** a Pirate ally |
| Hit and Run | your next weapon **attack** | latent — see below |

Avast Ye! was live and in the worst possible place: it and **six Pirate
allies sit in the same deck**, and deploying one is the natural follow-up
to the card. An ally card is an `Action - Ally` whose type line reads
"Pirate … Ally", so it matched `{g:[["pirate","ally"]]}` exactly. The
non-attack taker (v3.31, added for Mage Master Boots) spent the grant on
the deploy and discarded the rider v3.42 had just built. **The card read
`tier: full` before and after.**

Hit and Run escaped only because a powCard carries no type line for
`{g:[["weapon"]]}` to match — an accident, not a rule, exactly like the
`maybeBoost` escape recorded at v2.84.

**`gaNextQ` IS THE ONLY GRANT THAT NEEDED THIS**, and that is the whole
explanation: it is the one with a **non-attack taker**. Its three siblings
are attack-only by *where they are read* — which is why Yo Ho Ho! prints
the identical "Pirate ally attack" phrase into `buffQ` and is safe. Six
`gaNext` ops, two moved; the other four families measured and unmoved.

**`atk` IS THE CALLER'S ANSWER, NEVER DERIVED** — and deriving it is the
tempting bug. `isAttack` reads the type line, and a **weapon's line
carries no "Attack" at all** (`isAttack(Dawnblade)` is false), so a
derived atom refuses every weapon swing, which is the whole of Hit and
Run. `execute` already decides this once to pick its branch
(`isAttack(card) || from === "weapon"`) and hands the verdict down, the
same way it hands down `from` and `boosted`. A caller that does not say
answers **no**. That sabotage is a drill.

**AND A SYNTHETIC FIXTURE PROVED THE READER, NOT THE TABLE.** v3.42's
drill built a Pirate-ally fixture *with "Attack" added to its type line*
so `execute` would take the attack branch — the fixture shaped to fit the
code. It proved the reader honestly and could not ask the question a real
game asks. The drill now plays the **real allies out of the real deck**
and asserts the grant survives, which is the half that was missing.

Avast Ye! still does not *fire* today, because ally combat is unwired on
both boards — but it now **waits** instead of being eaten, which is the
honest gap rather than a wrong answer.

## v3.42 — Avast Ye!, and the rider `fx.quotedUnread` could not see

HANDOFF.md named this one directly: "the ONE card v3.41's new audit flag
deliberately cannot see, because that flag asks 'is there a reader' and
here there is."

> Your next Pirate ally attack this turn gets go again and "When this
> hits a hero, create a Gold token."

The quoted half parses fine — `quotedOnHit` is the one reader every other
granted-ability shape in this family already shares (v3.10, v3.12). It was
just never ASKED at this call site: the go-again head consumed the whole
clause and the rider was silently thrown away. Driven, the card granted
go again and nothing else, forever `tier: full`.

**`gaNextQ` had no field to carry a rider.** `buffQ` (the qualified power
grant) has carried one since v3.10 — `{amt, q, rider}` — but its cousin
`gaNextQ` (the qualified go-again grant, v3.31) only ever stored the bare
qualifier. Entries are `{q, rider}` now, same shape, same reason: a
granted ability rides with the grant, not with the card that handed it
over, because it has to wait for whatever attack actually collects the go
again. `takeGaNext` returns the whole entry; the caller in `execute` reads
`.rider.onHit` and joins it into `pend.onHit` beside `buffQ`'s own
`qRider` — two lists, one place they both land.

**Mutually exclusive with Mauvrion Skies' `runeHitNext` count on purpose.**
Mauvrion Skies prints the identical shape ("…gets go again and \"When
this hits, create N Runechant tokens.\"") and its rider was already read,
by name, into a dedicated counter. Asking `quotedOnHit` there too would
mint the same runechants twice — `VALUE-DOUBLED`, the fairness sweep's own
category. The two paths are guarded to be exclusive and a drill pins that
Mauvrion Skies' parsed ops are unchanged.

**Driven end to end.** `test/riders.test.js` arms the grant off the real
card, plays a synthetic Pirate-ally attack that matches its qualifier, and
resolves the hit through `resolveStack` — the Gold token really lands on
the board. Real Pirate allies attack through an activated ability neither
board wires yet (CLAUDE.md's "allies do not attack"), so the fixture
proves the READER, the same thing `test/qualifier.test.js`'s own synthetic
`atkCard` already does for this family. Both new drills were sabotaged
(the rider-storage line, and the parser's rider-attach guard) and caught
the regression before being trusted.

The granted-rider census in `test/riders.test.js` moves 19 → 20 of the
28 pool cards that print a quoted ability — the eight left are honest
refusals (an `attacks` trigger rather than a hit, or a payload with no
reader), not gaps of this shape.

## v3.41 — housekeeping, and what the docs were lying about

A pass over the standing claims in `CLAUDE.md` and the engine comments,
checking each against what the code actually does rather than trusting it.
Three had gone stale, and one of them was hiding a real gap.

**THE REAL FIND: v3.10 claimed a refusal was visible, and it was not.**

> *"An unreadable rider **refuses** and the head still lands … That leaves
> the gap visible in the audit instead of behind a guess."*

`quotedOnHit` returns null on a payload it cannot read — that half is true
and right. But the clause is still consumed by its HEAD, so it reports
`run` and the card comes out **`tier: full` with a printed ability doing
nothing**. Measured across the pool: **four records** — Display Loyalty,
Drop the Anchor, Goon Tactics, Release the Tension.

No tool could see it, by construction. Coverage counts the clause consumed;
the fairness sweep is deliberately one-sided toward too-strong and all four
are **weaker** than printed. It is the no-op blind spot with a quote around
it.

`fx.quotedUnread` records them and `tools/audit.js` flags each by name.

**RECORDED, NOT DOWNGRADED — and the first attempt lied the other way.**
Marking the clause unread makes Display Loyalty report `none`, which says
its go again does not work either. It does. The tier stays accurate about
the HEAD and the flag carries the rider: both facts, neither hidden.

**IT ASKS "IS THERE A READER", NOT "DID IT LAND."** A rider can ride
somewhere other than `fx.onHit` — Mauvrion Skies' Runechants are the COUNT
`runeHitNext` (v3.10) — so a landing-check demoted three cards that work,
and enumerating the carriers would put card knowledge inside a generic
guard. **Avast Ye! is the one this deliberately cannot see:** its "create a
Gold token" READS perfectly and is then dropped by the `gaNext` path, which
carries a qualifier and no rider. That is a missing feature, it is recorded
in `HANDOFF.md`, and a tier check should not paper over it.

**ONE MATCHER, FOUND BY SABOTAGE.** The quoted text was matched by two
copies of one regex — `quotedOnHit` and the recorder — so sabotaging one
left the other correct and the drill stayed green. `quotedText` is the one
body now. The closing quote is also BACKREFERENCED to the opening one: a
bare character class let a mid-word apostrophe close the quote, so
*"defense reactions can't be played…"* captured `defense reactions can`,
and the audit printed that truncation as its finding.

**The two other stale claims:**

| claim | truth |
|---|---|
| `parser.js`: **Cold Snap** "IS UNREAD ON PURPOSE", with a four-item list of what it would need | it has been BUILT for several versions — `payOr` with `freeze` as its else-payload, the `_frozenBy` stamp on both boards, and the thaw. A long confident note saying a card is deliberately unbuilt, sitting directly above the code that builds it, sends the next reader looking for finished work |
| `parser.js`: a `pick` "REPORTS the chosen object structurally (today it reports only in `msgs`)" | `out.picked` exists and this version relies on it |
| `HANDOFF.md` (v3.38): a class-aware turn history "would also unblock Quick Clicks" | **wrong.** *Nimblism* is a card NAME — three printings of a Generic Action — so `hist.playTy` can never answer it however class-aware it is. It needs a NAME history, the non-attack twin of `hist.atkNames` |

**When you close a recorded gap, delete the record of it.** Every one of
these cost nothing to write and would have cost the next reader real time.

1417 → 1423 drills, 0 failed, 0 skipped. Coverage unmoved at 332 / 61 / 12
— deliberately, since the tiers were already telling the truth about the
heads. Flagged 63 → 66. Fairness clean, 0 UNFAIR.

## v3.40 — the other direction of arcane

`hist.arc` records what the **dealer** did (v3.28). Arcane Polarity asks
the mirror question — *"if you've **been dealt** arcane damage this turn,
instead gain N{h}"* — and nothing could answer it. Reading it as `arcDealt`
would pay a hero for burning the opponent rather than for being burned,
which is the card backwards.

`hist.arcTaken` is the record, and **both halves are credited from ONE
body**, so CR 7.5.5's *prevented is not dealt* governs them together: a hit
turned entirely aside by a shield, a ward or a barrier credits **neither**
side. That falls out of the existing `if(left > 0)` guard rather than being
restated, which is the point of putting it in one place.

**The amount is the CARD'S OWN** — red 4, yellow 3, blue 2 — and `instead`
REPLACES (v2.32), so the card gains N rather than 1 + N.

**The victim's seat is the awkward one, and only on the deferred path.**
When the threatened hero holds a barrier the damage rides out on the soak
answer, which is given by the side being HIT — so there the actor *is* the
victim, the exact inversion the dealer's half already documents, read from
the other end.

Shared by **Blaze, Fai and Briar**, so it pays out past the hero that
motivated it.

**BLAZE STOPS AT 22 OF 23, with one written reason.** Turn to Mindfire is
recorded rather than half-built — see below and `HANDOFF.md`.

Measured: **331 → 332 full, 62 → 61 part**. 1413 → 1417 drills, 0 failed,
0 skipped. Fairness clean, 0 UNFAIR. 6 sabotages, all biting.

### What Turn to Mindfire needs, and why it is not in this version

> "Deal 5 arcane damage to any target. If this deals damage, you may **{t}
> your hero**. If you do, create a **Ponder** token."

Four pieces, three of them general, and none of them present:

| piece | state |
|---|---|
| the `hits` trigger for an optional cost | `optCost` is wired for `attacks`, `play` and `entersLeaves` only — v3.20 named `hits` as outstanding and it still is |
| a TAP as an optional-cost KIND | the kinds are banish / discard / destroy (v3.18) / reveal (v3.33). A tap is none of them |
| a tapped **HERO** as a state | taps are modelled per-permanent by uid through `weaponUsed`, and `perTurnCleared` looks the uid up in `sd.gear` — a hero is in neither. `weaponUsed["hpow"]` is *the ability was used*, which is a different fact: tapping Blaze's hero must not lock an ability that costs counters rather than `{t}` |
| the Ponder token | trivial once the rest exists — it is a real database record whose own text ("at the beginning of your end phase, destroy this and draw a card") the `sd:"end"` reader already handles |

**It would be free in this pool and that is not a reason to fake it.** Turn
to Mindfire is a Wizard card, so only Blaze and Iyslander can deck it, and
neither hero's ability costs `{t}` — so the tap costs them nothing
observable. Building it as "the tap is free" would be a fact about this
pool rather than about the rules, which is exactly the shape v2.74 removed
from Frostbite. It waits for the real state.

## v3.39 — Blaze's engine: opt fills the pool, the pool banishes a spell

**Neither clause of his hero ability existed** — no build passive, no
ledger entry, no route — so the audit reported all three of his hero-text
clauses unrecognised. Honestly, for once: nothing claimed to work.

> **Whenever you opt**, put energy counters on Blaze equal to the number of
> cards **looked at** this way.
>
> **Once per Turn Instant - Remove X energy counters from Blaze:** Banish a
> Wizard non-attack action card from your hand with an effect that deals
> arcane damage **equal to X**. You may play it this turn as though it were
> an instant.

**BOTH CLAUSES OR NEITHER.** Clause 1 was written in v3.38 and deliberately
reverted, because clause 2 is what spends the counters and energy nothing
can spend is v2.74's Frostbite bug exactly — *a number on the hero row and
no rule*.

**THE COUNT IS CARDS LOOKED AT, NOT THE PRINTED NUMBER.** Opt 3 into a
two-card deck looks at two and pays two. The `Math.min` was already at the
opt site for the prompt; reading the printed number would pay above rate on
exactly the turns a deck is running out, which is when the ability matters
most. One site, so the trigger cannot exist on one board only.

**X IS NOT A FREE VARIABLE, and that is why this needed no X-cost
machinery.** The player picks a card and X is that card's own arcane
damage, so the coupling lives in the FILTER: the ability offers only what
the pool can pay for, and the price is settled by the choice.

**THE POOL BOUND IS SUPPLIED AT THE QUEUE SITE**, never baked into the
parse — `fxParse` memoizes on `name|pitch`, so one parse serves every copy
in a match and a number stored there would freeze at whatever the counters
were the first time. Exactly the rule `notUid` follows for `notSelf`
(v3.20), and a drill asserts the parse carries no bound at all.

**`arcAmount` READS THE UNCONDITIONAL OPS ONLY**, because this number is
the PRICE. Emeritus Scolding prints 4 with a conditional 6; charging 6 for
a card that deals 4 is the wrong direction, and a gated amount is not one
the engine can promise. One copy, in `parser.js`, because the filter and
the cost both ask it.

**Three things found on the way, none of them Blaze's:**

| | |
|---|---|
| the HERO powCard was truncated at the first period | v2.34 fixed this for EQUIPMENT and never here. **Lyath Goldmane's ability lost a whole sentence** — "Defending action cards you control get +1{d} this turn" — and carried only the boo. Latent rather than live, because that clause still has no reader, and now recorded |
| the table had NO route to an activated hero ability | `doActivate` handled hand abilities and gear and had no `"hero"` branch. Same one-board shape v3.04 found for the 17 equipment abilities; Blaze is the pool's only such hero, which is why nothing noticed |
| the trainer gated ⚡ USE on `mode === "act"` | the ACTION phase only — so a hero ability printed **Instant** could not be used on the opponent's turn, which for Blaze is half of what it is for |

**A DEAD TAP IS REFUSED BY NAME.** With an empty pool the filter admits
nothing, `buildPrompt` returns null and the sheet skips itself — having
already burned the once-per-turn. `legal` asks the same filter the queue
site will build, so the two cannot disagree about which cards are legal.

**AND THE COUNTER IS ON SCREEN, both boards.** An ability whose entire cost
is a pool the player cannot see is a cost they cannot plan around.

**A PROMPT SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT** (v2.34,
paid again): `ctrSpend` and `playThisTurn` were dropped the first time this
was driven, so the banish was FREE and the card was never marked playable.

`optFilter` learned a **leading class word** — "a WIZARD non-attack action
card" — and `ty` now takes a LIST so the class and the type are asked
together. **The whole phrase is tried FIRST**: ordered the other way,
"ATTACK ACTION CARD" splits as class *attack* plus *action card*, a subject
the reader already knows read as two things it is not. Three existing
drills caught that immediately, which is the whole-phrase discipline
working on a change to itself.

1403 → 1413 drills, 0 failed, 0 skipped. Fairness clean, 0 UNFAIR.
**17 sabotages, all biting** — two of which found fixtures that could not
discriminate: an action-point gate drilled with a seat holding one, and a
once-per-turn guard never asked a second time.

## v3.38 — a turn history that knows what CLASS you played

**Snapback was the one condition v3.36 refused**, and the reason was
recorded rather than guessed at:

> *"If you have played another **Wizard** non-attack action card this turn,
> you may play this as though it were an instant."*

`hist` counts non-attacks (`non`) and records no CLASS, so the question
could not be asked at all. Reading it as the bare count would have granted
the instant-speed window off **any** non-attack — stronger than the card's
own text, on the most valuable kind of permission in the game — so it
waited for the record instead of being approximated. This is that record.

**`hist.playTy` — one entry per play, the STRUCTURED type words.** Not
`tt`: the display string calls Den of the Spider an "Action Defense
Reaction" and the array does not (v2.44's ruling).

**AN ARRAY OF ENTRIES, NOT A FLAT SET OF WORDS**, and that is the whole
design. The question pairs a class with a type — Wizard **and** action
**and** not attack — so a flat set answers TRUE for a Wizard *attack* plus
an unrelated non-attack: two cards contributing half the condition each.
Drilled explicitly, and the sabotage that flattens the set fails it.

**RECORDED AFTER THE CARD RESOLVES**, in the same breath as `hist.non` and
for the same reason: *"another"* must not count the card asking the
question. The speed grant is asked at LEGALITY time — before the card is
played — so there is no self-counting subtlety there either way, which
keeps both readings honest.

**A DELIBERATE LEDGER EDIT.** `test/asinstant.test.js` pinned Snapback as
UNREAD with the reason written into the assertion; that reason is gone, so
the drill now pins the read. The refusal property it was protecting is
kept by a separate probe with a gate that has no reader — the vocabulary
stays closed, and an unrecognised condition still leaves the card in its
printed window.

**Blaze's HERO ability is deliberately not in this version.** Both his
clauses are unbuilt — no build passive, no ledger entry — and clause 1
("whenever you opt, put energy counters on Blaze") was written and then
**reverted**, because clause 2 is what spends them and is a version's work
on its own. Energy counters that nothing can spend are v2.74's Frostbite
bug exactly: *a number on the hero row and no rule*. It gets its own
version rather than half of this one.

Measured: **330 → 331 full, 63 → 62 part** (Snapback ×1 in the pool).
1400 → 1403 drills, 0 failed, 0 skipped. Fairness clean, 0 UNFAIR.
**7 sabotages, all biting.**

## v3.37 — Stir the Aetherwinds, and an amp that was landing on the wrong card

The fourth qualified single-shot grant, and the last card standing between
Iyslander and a finished deck. `buffQ` holds qualified power, `gaNextQ`
qualified go again, `costOff` qualified cost — **`instantNextQ` holds a
qualified WINDOW**. All four wait for the card the printed line names, all
four ask one qualifier reader, and building the fourth invented no
vocabulary at all, which is the third time that has been true of this family.

**TWO SENTENCES, ONE CARD.**

> "You may play your next **Wizard non-attack action card** this turn as
> though it were an instant. If **it** has an arcane damage effect,
> instead it deals that much arcane damage plus 1."

Both are about the same card, and they arrive as separate clauses because
the splitter breaks on the period. They are paired in `fxParse`, where the
whole card is visible — the same place and the same reason `optCost` pairs
its two halves (v2.28).

**UNPAIRED, THE AMP LEAKED.** `amp` is a bare number on the side meaning
*"the next arcane, whatever it is"*, so Stir's +1 applied to any next
arcane at all. Driven: it amped **Sigil of Suffering**, a Runeblade
*Defense Reaction* — neither Wizard nor a non-attack action card.
`RESTRICTION-DROPPED`, stronger than printed, and the fairness sweep could
not see it because that check does not model `amp`. Same shape as v2.30's
arrow buff landing on a sword, and the same fix: **the qualifier rides
with the payload.**

**THE BARE OP IS STILL RIGHT FOR ITS OWN CARD.** Cindering Foresight
prints *"THE NEXT CARD you play this turn with an arcane damage effect"* —
genuinely unqualified — so it keeps the loose `amp` it has always had. Two
cards, one op, two printed scopes; folding only where a grant is present
is what keeps both faithful.

**READ, NEVER SPENT.** `playsAsInstant` consults the held grants to decide
whether the window is open, and it is asked on every dim and every
legality check — so a grant consumed there would be burned by *looking at
your hand*. `takeInstantNext` is the one place that spends it, when the
card is actually played. Same read/spend split `effCost` keeps for
`costOff` (v3.32).

**AND IT IS SPENT WHATEVER WINDOW IT WAS PLAYED IN.** The card names *"your
NEXT Wizard non-attack action card this turn"* — that card was your next
one whether or not you exercised the instant-speed permission, and the amp
rider is printed about the same card. Holding the grant back for a later
card would be strictly stronger than printed.

**THE TAKE PRECEDES THE OPS**, because the payload is an amp and `arcane`
reads `sd.amp` as it resolves. Taken after, the grant would be spent on the
very card its bonus was printed for and pay nothing.

**AN UNREADABLE TAIL REFUSES THE WHOLE CLAUSE** (v3.31's rule, on the
fourth member): `attackQual` returning false means *"there is a restriction
here I cannot read"*, which is a different answer from *"nothing restricts
this"*. Collapsing them yields a grant qualified only by `nonAtk` — one
that frees every non-attack action card at instant speed. Drilled with
synthetic text, because no pool card prints that shape and so no fixture
can reach the branch.

**Side field, three places** (v3.29's rule): `SIDE_FIELDS`, `wire.js` and
`report.js`'s `seat()`. The symmetry ledger moves **42 → 43**, deliberately,
and it expires in `beginEndPhase` with the other five "this turn" grants —
for both seats.

**Both boards.** `judge` passes the held grants into the reader; the
trainer's two bespoke opponent-turn routes reach `runOps` directly and
never pass through `execute`, so they take the grant themselves — the same
reason they call `foeTurnIce`. Asking only about the printed type refused a
granted card in the trainer's hand window, which is the half-built shape
v3.36 found in the arsenal route beside it.

**IYSLANDER IS DONE.** 29 of 30 cards full; **Ice Eternal** is the pool's
only X-cost card and stays honestly refused, with the reason written down.
Her hero ability runs on both boards as of v3.36.

Measured: **329 → 330 full, 64 → 63 part**. 1390 → 1400 drills, 0 failed,
0 skipped. Fairness clean, 0 UNFAIR. **11 sabotages, all biting** — one of
which found a missing drill rather than a missing rule: nothing covered the
unreadable-tail refusal, because no card in the pool can reach it.

## v3.36 — Iyslander acts on your turn, and 14 cards learn how

**Her whole identity is one mechanic, and neither clause was fully
built.** Both sentences of Essence of Ice are about acting on the
opponent's turn, and reading the hero ability first — the Kayo method —
found that the thing they need is shared by two other heroes' cards.

**14 POOL RECORDS PRINT "AS THOUGH IT WERE AN INSTANT" AND NOT ONE WAS
READ.** Iyslander, Cindering Foresight ×3, Snapback ×3, Astral Etchings
×3, Stir the Aetherwinds ×3, and Blaze's hero ability. `playsAsInstant`
is the one reader now: pure, with the game's half supplied by the caller,
exactly as `playableFromZone` is. `asInstantCond` reads the printed gate
off the card and `asInstantMet` answers it against the state — the same
split `defSelf`/`defSelfMet` keep, because neither board can answer these
from the card alone. An unknown condition answers FALSE (v3.26's rule):
the card keeps its printed window, which is weaker than printed and
visible, where the other direction opens a window nobody built.

**CLAUSE 1 WAS TRAINER-ONLY, AND THE TABLE REFUSED IT BY NAME.** Driven:
*"Aether Icevein is an action — it cannot be played during an
instant-speed window."* A refusal that reads perfectly correct, on the
board she is meant to be played on, for every version she has existed.
Her line frees blue non-attack ACTION CARDS from her ARSENAL when it is
not her turn, and every one of those words is a gate — each pinned by a
drill, each proven by sabotage.

**WIDENING THE WINDOW IN ONE PLACE PUT HER ON A NEGATIVE ACTION POINT.**
`playableWhy` decides whether the play is legal; `playWindowFor` decides
which window it happens in, and therefore whether an action point is
charged. Widened in the first and not the second, the play was ALLOWED in
the instant window and then CHARGED as an action — driven, `ap: -1`,
which is `NEGATIVE-AP` (CR 4.4.3e: points are lost, never owed) and is
also the `legal`/`reduce` agreement `fuzz.test.js` exists to hold.
`windowsNow` is the one body both ask.

The action point then follows for free: `costsAP` charges one only in the
`action` window, so a card played through the grant is charged nothing.
That is the recorded ruling (user, 2026-08-10) rather than a special case
— and the reductio is that it could not be otherwise, since a seat holds
NO action point during the opponent's turn, so a grant that still charged
one could never once be used.

**CLAUSE 2 LEFT `Battle`.** "Whenever you play an Ice card during an
opponent's turn, create a Frostbite token under their control" was a
closure in `index.html`, so the table had none of it. `execute` calls the
shared body, and so do the trainer's two bespoke opponent-turn routes —
those reach `runOps` directly and never pass through `execute`, so a body
living only in `execute` would have taken the rule AWAY from the board
that had it. The talent is read off `ty`, the structured array: the
trainer asked `/ice/i.test(tt)`, which is clean across this pool only by
accident, and that is the "Reaction contains action" trap with a
different substring.

**`it's` IS LEVELLED TO `it is`, AND IT WAS LEVELLED LATE.** The database
prints BOTH FORMS TODAY — ten clauses say "if it's blue", two say "if it
is Draconic" — so the anchors had drifted to match whichever they were
written against, `/^it'?s blue$/` on one line and `/^it is draconic$/`
three lines below it. Either would stop dead the moment upstream levelled
the other way, which is v3.00's whole lesson wearing a contraction.
Measured over all 788 records before and after: **zero cards moved**, and
both wordings now read for both anchors.

**ONE READER, BOTH BOARDS — the trainer had a second copy.** Its arsenal
route hand-rolled her printed line as `isAttack(c)` plus a pitch test,
beside the table's copy in `judge.legal`, and the two read DIFFERENT
FIELDS: `tt` against the structured array. It asks the shared reader now.
The first draft of that de-duplication asked about the grant ALONE and so
refused a blue INSTANT set in the arsenal — Frost Spike, out of her own
deck — with *"is an attack"*: a lost line of play and a wrong message,
out of a change that was otherwise pure. An instant needs no grant
(CR 8.1.6); both reasons are asked, and it is drilled.

**WHAT IS DELIBERATELY LEFT UNREAD, and why each is honest:**

| | |
|---|---|
| Snapback ×3 | *"if you have played another WIZARD non-attack action card this turn"* needs a class-aware turn history; `hist` counts non-attacks but records no class. Reading it as the bare count would grant the window off any non-attack at all — stronger than the card's own text |
| Stir the Aetherwinds ×3 | grants to a FUTURE card, which is the fourth qualified single-shot grant (`buffQ`, `gaNextQ`, `costOff`) and needs a side field and a symmetry-ledger move — its own diff |
| Ice Eternal | the pool's only X-cost card, and Ice Fusion. Unchanged, and still honestly refused |

Measured: **326 → 329 full, 66 → 64 part, 13 → 12 none** — Cindering
Foresight ×3 part → full, Astral Etchings none → part, and the diff was
read card by card rather than inferred from the totals. 1378 → 1390
drills, 0 failed, 0 skipped. Fairness clean, 0 UNFAIR. **18 sabotages,
all biting** — including two that found real defects in this version's
own work: a non-attack gate whose fixture was a RED attack (so the blue
gate refused it and the drill passed against a sabotaged engine), and a
source guard with no word boundary, which a rename walked straight
through.

---

## v3.35 — the split-card dive: a pitch sheet with no exit, and a lost line of play

Reported from a real table on turn 1, with the note *"Making me pitch for
burn up shock"* — for a card that costs **0**.

### A BLACKLIST, where the rule is whitelist

```js
const pay = myPend && myPend.kind !== "boost" ? myPend : null;
```

`pending` is one field with **four** kinds, and everything that was not
`boost` rendered as a **payment**. So the split-card declaration opened a
pitch sheet that read *"covered ✓"* for a cost-0 card, and **Pitch & play**
then sent `payConfirm`, which `legal` refuses with *"declare which half
first."* The only way out was Cancel. `addPay` (Staunch Response, shipped
the same day) would have done exactly the same thing.

Now a whitelist, with `judge.PENDING_KINDS` exported so the census is the
guard rather than the memory: a kind with no branch in the demux **or in
the action bar** fails a drill. The next kind added walks into the same
fallback otherwise.

### The dive: the INSTANT half could never be played at instant speed

`types.playWindows` reads the **front face** of a `//` card — v2.39 made
it do that so the whole card would stop reading as an Instant and
collecting a free action point. Correct while the card was played as one
lump, and it also meant `Shock` and `Life` were unreachable at instant
speed. A printed line of play, gone.

**The declaration is what makes both true at once:**

| declared | windows |
|---|---|
| nothing yet | the **union** — so the card is offered in either window |
| half 0 or 1 | that half's, and nothing else |
| both (meld) | **action** if either side is one — the CR plays a melded card with an Action side on an empty stack for an action point even though the other side is an Instant |

Driven, on the opponent's turn with **zero action points**: the card is
offered, `Shock` resolves for 1 arcane and costs nothing, and declaring
`Burn Up` there is refused **by name** — *"Burn Up is an action — not
legal in this window."* v2.39's hazard is closed by the declaration rather
than by pretending the card is not an instant: Burn Up declared alone has
only the action window to be played in.

**And "affordable" is a different question before you have declared.** The
check runs ahead of the choice, so it asks whether *any* half could be
played — not what melding would cost. Asking the front face refuses a seat
with no action point a card whose Instant half costs none. Meld is `OR`
across the halves; an undeclared card is `AND`.

### The face is turned to be read

The database ships the art portrait with its content sideways. Split cards
now render rotated **counter-clockwise** in every frame — hand, peek,
modal, arena. Checked by rendering both directions and looking: `+90deg`
comes out upside down. The frame goes landscape at the card's real aspect
the other way up (546×763 → 1.3974) and the image box is the frame's own
dimensions swapped, so the face fills it with no crop; a drill pins the
three numbers together, because a drift between them crops the art.

### One gap, recorded rather than half-built

**The trainer still cannot play the instant half in its reaction window.**
Everything played through that path is filed as a **defender** (`blockRx`),
which is right for a defence reaction and wrong for a plain instant —
untangling it is its own change. The refusal now names that reason instead
of claiming the card has no instant on it: *a refusal a player cannot
believe is worse than one they cannot act on.*

**And a guard pointed at the wrong scope for the fourth time this week** —
it sliced the **trainer's** action bar looking for the table's branches.
Anchor on something unique to the thing under test, every time.

**Measured:** 1370 → **1378 drills**, 0 skipped. Coverage unchanged at
**326 full / 66 part / 13 none**. Fairness clean, 0 UNFAIR. 11 sabotages,
all biting.

---

## v3.34 — Bravo is complete, and the split cards were playing themselves

### Staunch Response — an optional additional cost

> As an additional cost to play this, you may pay {r}{r}{r}{r}.
> If the additional cost is paid, this gets +3{d}.

**It is a COST, not a trigger**, and that decides where it lives. A cost is
settled at play time beside the printed resource cost, so it cannot be a
queued prompt — those drain after the card has already resolved, which is
the timing wall Charge and Fusion still sit behind. **Boost is the
precedent on both boards:** pause, ask, and let the answer ride to
`execute` on the state.

It is asked **only when there is a real choice** — enough floating for
both the printed cost and the addition. Otherwise it plays through unpaid
and the rider does not fire, the same rule `buildPrompt` follows for a
spec with nothing to ask. And the rider's answer belongs to the **play**,
not the card: by the time the wall asks what the card is worth the payment
is long settled, so `defSelf.when === "addCostPaid"` reads `opts.addPaid`,
the split `fromArsenal` already keeps.

Driven: 6 floating → asked; pay → blocks for **10**, decline → **7**.

**Bravo is finished. Zero gaps.**

### THE FAULT UNDER IT: the trainer's own wall never called `defendValue`

`defendValue` was reached from `resolveStack` alone — the wall the **dummy**
raises when you attack. When the **player** blocked, which in the trainer
is most of the game, every defensive self-buff built since v3.23 did
nothing. Sigil of Suffering blocked for **3** on one board and **4** on the
other from the same board state — and that is the card whose ruling the
user gave personally.

Three walls now ask the one reader: the hand wall, the gear wall (passing
its wear in as `base`, so `gearDef` stays the only copy of the wear rules)
and the played defence reaction. What the trainer genuinely **cannot**
answer stays honestly unmet: the dummy's swing is the `[3,4,5]`
escalation, not a card, so the two conditions that ask about the incoming
card read false rather than being guessed.

### AND ANOTHER: at the table, "this turn" never ended

Five single-shot grants wait for a matching card — `buffNext`/`buffQ`,
`gaNext`/`gaNextQ`, `costOff` — and every one is printed *"this turn"*.
The trainer cleared **two of the five, for one seat**; judge cleared
**nothing at all**. A next-attack buff at the table survived every later
turn of the game. Now expired in `beginEndPhase`, the shared event, for
**both seats** — CR 4.4.3e loses points for all players and a grant is the
same kind of thing.

---

## The split cards — read every word, and the CR

The two horizontal cards print their own rule in reminder text:

> **Meld** *(You may play 1 or both halves of this card. Each costs 0.)*

**IT IS ONE CARD.** One pitch value, one defence value, one card in hand,
one card in the graveyard. What is doubled is the **textbox**. The CR is
explicit: a melded split card is a *single card played as a single layer*
with the properties of both sides.

**WHAT THE ENGINE DID:** it ran **both halves, unconditionally, asking
nothing**. `Burn Up // Shock` dealt **five arcane damage on play** and kept
its action point. Four of those five are printed as a *delayed* trigger —
*"the next time an attack you control hits a hero this turn"* — and the
whole prefix was swallowed, so it read as immediate damage. The card sat
at `tier: part`, so no coverage tool ever looked at it, and the fairness
sweep's captures stop at the word "attack".

| what | now |
|---|---|
| which card is split | `played_horizontally`, the database's own flag — `//` in the type line is a **rendering**, not a fact. `DATA_VER` → `sage-v12` |
| the halves | told apart by `tt`, the **only** place the boundary survives — `ty` flattens both faces into one list (v2.39's note) |
| a half's keywords | its **own textbox**. `card_keywords` is `["Meld","Go again"]` for the whole card and Go again is on the top half only — v2.31's index rule, on the keyword most expensive to misplace |
| the declaration | asked **first**, before the payment, because melding doubles the base cost |
| the default | the **left** half, never both — defaulting to meld hands a player a textbox they never asked for, which is exactly what shipped |
| the action point | the **declared** half's. Meld costs one if *either* side is an Action, even though the other is an Instant |
| Burn Up's trigger | a `buffQ` rider with **no power** — an entry that already waits for the next attack, already carries an on-hit payload, and already expires with the turn |

**Resolution order for a meld is a stated approximation.** The CR resolves
one side then the other with priority between; this runs them in printed
order as one layer. Both pool cards' halves are independent — two
Runechants and 1 life; a delayed rider and 1 arcane — so no order is
observable on either.

**And `Meld` is filed a `noop` only now that the choice exists.** Filed
before it, that would have been the no-op blind spot at its purest: the
keyword counted as accounted for while the engine played both halves of
every split card for free.

**Measured:** 323 → **326 full**, 69 → **66 part**. 1339 → **1370
drills**, 0 skipped. Fairness clean, 0 UNFAIR. 18 sabotages, all biting.

---

## v3.33 — Bravo's last two minters, and two faults underneath them

Both of his remaining cards create Seismic Surge, which v3.32 made real.
Each needed one small thing the engine could not yet say — and each is a
habitat rather than a cage, because the thing it needed is now available
to every card that prints the same shape.

| card | what it needed |
|---|---|
| **Crash and Bash** | a **reveal** cost, a `with <keyword>` filter, and the **defends** trigger |
| **Magmatic Carapace** | a **{t}** inside a pay-cost, and the **playAura** trigger |

### A reveal is a cost that moves nothing

The card is shown and stays exactly where it was — the cost is the
information. That makes it the one member of the optional-cost family
with **no destination**, so `to` is omitted rather than defaulted:
sending it to the graveyard would spend a card the printed text never
spends. `prompts.js` has treated a pick with no `to` as a reveal since
v2.17; this is the first card to use it.

### "With crush" is a printed field, not free rules text

`optFilter` refused this phrase, and the pin gave the reason: *"a
rules-text qualifier; promptFilter reads fields only."* That was honest
while nothing could answer it. `printedKw` can, and it asks the precise
question — does the card **carry** the keyword as printed rules text.
`hasKw` stays the wrong predicate: it is deliberately loose, and a card
that merely *names* crush in a sentence must not be a legal reveal.

**The keyword list is closed.** Widening it to any word after "with"
would re-open exactly the hole the old refusal was protecting — a dynamic
limit would read as a keyword and be silently dropped.

### THE FAULT UNDERNEATH: printedKw was FALSE for every crush card

`printedKw`'s layout rule demanded the keyword be *the whole line*. The
database writes a **triggered** keyword with its rider on the same line:

```
Crush - When this deals 4 or more damage to a hero, …
```

So `printedKw(c, "crush")` was false for all twelve crush cards, and the
same for reprise, high tide, surge and heave — **21 answers wrong**. The
widening is the dash, not a substring: the keyword must still start the
line, so *"when you boost a card"* and *"your attacks with stealth"* —
the references the function exists to exclude — are untouched. Measured
across the pool and every keyword before the change: 21 answers move, all
of them cards that genuinely carry the keyword, none for boost, go again,
stealth or dominate.

### The tap is part of the cost

*"You may {t} this and pay {r}"* — reading only the {r} makes the ability
repeatable, and a tapped permanent does not untap until CR 4.4.3d. That
is what makes Magmatic Carapace **once per turn on a card that never
prints "Once per Turn"**: the Scorpio-vs-Sledge shape from v2.42.

`taps` rides on the spec, and it had to be added to `buildPrompt`
explicitly — **a spec only carries fields `buildPrompt` knows about**
(the `arsStamp` lesson, v2.34). Without that the {t} is free.

### Two triggers, each out of ONE body

- **defends** fires from `effects.afterDefenders`, which is where phantasm
  already lives, already takes the wall as the **caller's** answer, and is
  already called by both boards. It is addressed to the **defender**:
  inside a link the actor is the *attacker*, so billing `actorOf` would
  offer the attacking hero a choice printed on their opponent's blocker.
- **playAura** fires in `execute`, and the watcher is **not the card being
  played** — every other trigger there asks the resolving card about
  itself, while this one asks what is watching. Magmatic Carapace is a
  Chest piece, so a scan of the board alone finds nothing.

**And it drains only what it queued.** A blanket `openPrompt` in
`afterDefenders` opened whatever else was waiting, mid-combat, and stalled
three drills at the damage step on cards printing no defends trigger at
all. A prompt is drained by whoever queued it.

### THE OTHER FAULT: every minted token was lowercased

`classifyClause` works on the lowercased clause and `resolveEntry` returns
the **entry's** name by design (v2.48), so every token the parser minted
reached the board as `"seismic surge"`, `"might"`, `"frostbite"` — **12
token names across a dozen cards**, including Kayo's Might, Iyslander's
Frostbite and Briar's Embodiments. Shown to the player. It is v3.21's
shape exactly: a lowercased capture riding onto the board.

`resolveEntry` now also answers `dbName` — what the **database** calls the
card — and the token mint uses it. `name` still means the entry's name,
because a deck list names its own cards and v2.48 pins that.

### And a heading is not a clause

`Choose 1;` reported unread on both modal cards while **both of their
modes were built**, the same way Briar's *"Essence of Earth and
Lightning"* does. Filed as a `noop` — which is only honest because the
modes exist and a mode whose restriction cannot be read is still refused
(v3.12). Filed earlier it would have been the no-op blind spot.

**Bravo is down to ONE card.** Staunch Response needs an *optional
additional cost* decided at play time — the timing wall Charge and Fusion
already hit — which is its own piece of machinery, not a reader.

**Measured:** 319 → **323 full**, 14 → **13 none**, 72 → **69 part**.
1323 → **1339 drills**, 0 skipped. Fairness clean, 0 UNFAIR.

---

## v3.32 — heave, and Bravo's keystone

**Bravo's ONE mechanic is the arsenal.** His hero ability turns a
face-down arsenal card face up and rewards crush; **heave puts a card face
up into the arsenal**. Reading the hero before the cards, as always.

### The printed product is the oracle

Thunder Quake's entire rules text in the database is `**Heave 3**`. There
is no reminder text in any field. The **card** has it:

> Heave 3 *(At the beginning of your end phase, if Thunder Quake is in
> your hand and you have an empty arsenal zone, you may pay {r}{r}{r} and
> put Thunder Quake **face up** into your arsenal. If you do, create 3
> Seismic Surge tokens.)*

That is materially more precise than the ruling recorded 2026-07-25, which
had heave **replacing** the arsenal action rather than performing one, and
knew nothing of the empty-arsenal gate or the face-up put. Same lesson as
Clash of Agility: **try the printing before booking a question.**

**Both numbers are the keyword's parameter.** The cost and the token count
are each N. Hardcoding either would be inventing card text the moment a
second heave printing exists — and no pool fixture could tell, because
Thunder Quake prints 3 for both. The drills use a synthetic Heave 2.

**The gate is `arsEmpty`, not `arsFree`** (v2.34's distinction). They
coincide at the normal capacity of 1, which is exactly why reading the
wrong one stays invisible until a second slot exists.

**Pitching for it is not offered.** CR 4.4.3c sends the pitch zone to the
bottom of the deck two steps later and CR 4.4.3e fizzles what is left, so
a seat that pitched here would be spending cards for a discount it cannot
bank. The resources it *can* spend are ones it is about to lose anyway.

### Where the player is asked — a stated approximation

It is offered at the **arsenal step**, not at the beginning of the end
phase. CR 4.4.1 gives nobody priority in the end phase, so the only place
a choice can be put to a player there is a pause the turn structure
already owns — and this effect **is** an arsenal set: it requires an empty
arsenal and it fills the arsenal, so it lands in the step it competes
with. The one observable difference is a hand-sweep (Inertia) firing
first, which already precedes the *ordinary* arsenal set on both boards.
CR 4.1.8a hands the order of simultaneous triggers to the turn player and
this engine does not model that choice. **Recorded, not papered over.**

### Seismic Surge was `tier: none` on purpose, and now it is not

Four Bravo cards create the token and a fifth reads it, so it is the
keystone of his deck — and it was deliberately unread: `selfDestruct …
then X` **refuses** when X has no reader, precisely so a schedule could
not be filed `full` with its payout missing (v3.07). Its payout is

> your next Guardian attack action card this turn costs {r} less to play

which is the **third qualified single-shot grant**:

| field | grants | since |
|---|---|---|
| `buffQ` | power | v2.30 |
| `gaNextQ` | go again | v3.31 |
| **`costOff`** | **cost** | **v3.32** |

All three wait for the card the printed line names, all three ask **one**
qualifier reader, and none of them is spent by a card that does not match.
Building the third invented no vocabulary: *"your next **Guardian** attack
**action card** this turn"* is a head, a subject and a tail, and v3.31
taught `attackQual` all three. Symmetry ledger 41 → 42.

**`effCost` is PURE and consumes nothing.** It is read twice and only one
of those reads takes resources (v2.80), so the grant is spent at the
**charge**, exactly where the next-turn tax is spent (v3.29). A reader
that consumed would discount the affordability check and then charge full
price, or the reverse.

**"Your NEXT" is one card per grant.** Two Seismic Surges resolving on the
same turn are two grants against two cards, not {r}{r} off one.

**And the token now has a clock.** It carries `sd:"turn"` and crumbles at
the top of its controller's action phase, paying out as it goes — instead
of sitting on the board forever inflating every "auras you control" count,
which is the v3.07 hazard this repairs.

### The keyword ledger caught up

`heave` was `unreviewed` and is `live`. The parser files `Heave N` as a
`noop` **only because the keyword is now carried** — filing it there
beforehand would have been the no-op blind spot exactly, a keyword with
real rules meaning counted as accounted for. `tools/ledger.js` is what
keeps that honest: `failstates.js` grades a keyword against the claim
rather than against a grep of the source.

`crush` was still described as *"arsenal/next-turn payloads still inert"*,
three versions after v3.16, v3.29 and v3.30 built them. Corrected.

**Measured:** 318 → **319 full**, 15 → **14 none** (Thunder Quake;
Seismic Surge is a token and sits outside the 405). 1305 → **1323
drills**, 0 skipped. Fairness clean, 0 UNFAIR.

---

## v3.31 — the restriction after the subject

> **Target attack action card WITH COST 1 OR LESS gets +3{p}.**

Every reader of that family captured the words *before* the word
"attack" and let `[^.]*` swallow everything after it. **Thirteen pool
cards printed a restriction there and applied to any attack at all.**
Lightning Press pumped a **cost-3** attack where it prints "cost 1 or
less" — driven, confirmed, not inferred.

**All of them read `tier: full`,** because the clause *was* consumed.
Coverage counts consumption, never faithfulness. And the fairness sweep
was blind for the same reason the parser was: its captures stopped at the
same word.

### The five atoms the tail prints

| printed | read as | cards |
|---|---|---|
| `action card` | `aac` — `isAtkActionCard` | Prime the Crowd, Rise from the Ashes, Take Aim, Weave Lightning, Nimblism, Scout the Periphery, Mauvrion Skies |
| `with stealth` | `kw` — `printedKw` | Spike with Bloodrot, Stains of the Redback, Orb-Weaver Spinneret |
| `with cost N or less/more` | `costLe` / `costGe` | Lightning Press, Nimblism, Pummel |
| `with N or less base {p}` | `powLe` | Nip at the Heels, Trot Along |
| `you play from arsenal` · `you boost` | `from` / `boosted` | Scout the Periphery, Re-Charge!, Teklo Trebuchet 2000 |

**A window is not a restriction.** "this turn" and "this combat chain"
say how long a buff waits, never which attack it may land on, so they are
consumed and dropped rather than refused.

**An unreadable tail refuses the whole clause.** The atoms are stripped in
turn and anything left over means the restriction is not understood —
`attackQual` returns `false`, which is a different answer from `null`
("nothing restricts this"). Collapsing those two is how the bug shipped.
Refusing is weaker than printed and visible; pumping an illegal target is
the direction that steals games. Same call v2.04 made for unpayable costs.

### "NON-ATTACK" CONTAINS "ATTACK"

Mage Master Boots prints *"the next **non-attack action card** you play
this turn gets go again"*, and the `gaNext` rule tested for the bare
substring — so the grant went to the next **attack**. Go again keeps your
action point, which makes it the most valuable keyword in the game to
hand to the wrong card. It is the Reaction-contains-action trap (v2.44) on
the worst possible payload.

`gaNext` was also a bare boolean, spent by whatever came next — right for
the unqualified wording and strictly stronger than printed for the four
cards that name a target. **`gaNextQ` is its `buffQ`**: a qualified grant
that does not match is **not spent**, it waits for the card it names
(v2.30's rule). The symmetry ledger moved 40 → 41, deliberately.

**One taker, two branches.** An attack settles on the combat chain and a
non-attack settles at the action point, and Mage Master Boots grants to a
non-attack — so a taker in the attack branch alone would have built half
the rule.

### One shape, one matcher, one namer

The qualifier used to BE an array of word groups. The tail atoms have
nowhere to live in an array, and an array that sometimes carries extra
properties is the same-name-different-meaning trap `KNOWN_COLLISIONS`
polices — so it is one object, `{g, aac, nonAtk, kw, costLe, costGe,
powLe, powGe, from, boosted}`.

- **`qualMatches` is the one matcher**, and a bare array now matches
  **nothing**: every field test passes vacuously on one, so a stale caller
  would silently get "matches everything". It refuses instead, and does
  not throw — `reduce` is fed by JSON off a wire, and one bad qualifier
  must cost a buff, never a session.
- **`qualLabel` is the one namer.** Five sites formatted the qualifier by
  hand as `q.map(g => g.join(" ")).join(" or ")` — a second reader of the
  shape, and it threw the moment the shape gained a field.
- **Two atoms are about the PLAY, not the card**, so `qualMatches` takes
  them from the caller: an absent answer is "no", and the buff waits. The
  same split `defendValue` keeps.
- **A card printing no cost satisfies no cost comparison.** Equipment,
  Weapons and Blocks carry `cost: null`; reading that as 0 hands every
  "cost 1 or less" buff to a weapon swing.
- **Stealth asks `printedKw`, per the 2026-07-25 ruling** that it "does
  nothing on its own — other cards check to see if an attack HAS stealth".
  Seven pool cards carry it on its own line and seven only name it in a
  sentence; `hasKw` says yes to both.

### The sweep learned to see it, and was verified by sabotage

Check **3c** reads the grant CLAUSE (not the whole card) and asks whether
the parse carries each atom the text names. Reintroducing the three halves
of the bug makes it report **10 / 13 / 3** findings. Two things it had to
learn not to say:

- *"If it's **defended by** an attack action card"* (Agile Engagement) is a
  condition about the wall, not a restriction on the target.
- A clause behind an **activation cost** goes to the equipment reader and
  is filed a noop, so nothing is granted — Mage Master Boots and Stalker's
  Steps are the audit's business, and flagging them would be the tool
  reporting its own model rather than the engine.

### A drill that was passing because of the bug

`test/reactions.test.js` used Stains of the Redback as its *"+3, no
qualifier"* fixture. The card prints *"target attack **with stealth**"*;
the fixture was only valid while the restriction was being dropped. It
drives a real stealth attack now, with a vanilla one as the control.

Pummel's second mode became selectable for the same reason, so the modal
refusal drill needed a fixture that clears **neither** printed line.

**Measured:** coverage unchanged at **318 full / 72 part / 15 none** —
which is the point: the clauses were already consumed. What changed is
that they are now true. 1284 → **1305 drills**, 0 skipped. Fairness clean.

---

## v3.30 — a restriction is not a debuff

v3.29 built the schedule and two of the five crush riders that ride on
it. The two it left were the RESTRICTIONS, and they are a different shape
in a way that is easy to get backwards:

|  | carries | consumed by | printed window |
|---|---|---|---|
| a **debuff** | an amount | the FIRST thing it touches | *"their first attack during their next turn"* |
| a **restriction** | nothing | **nothing — it is never spent** | *"during their next action phase"* |

Reading either as the other has a direction. A debuff that lasts the
whole phase is stronger than printed; a restriction spent by the first
play is weaker. The printed words are what separate them, so the drills
assert them off the card rather than off the code.

### Chokeslam — *"attack action cards they control can't gain {p}"*

It **CAPS at the card's printed power. It never subtracts.** The clause
forbids GAINING, so an attack already below its printed power — frailty,
Debilitate's own rider — must not be lifted back up to it. `Math.min`,
not an assignment, and a drill arms Debilitate and Chokeslam together to
prove a 6-power attack still resolves for 4.

**Two sites, one rule.** The cap is applied at declaration *and* in
`linkPumps`, because `linkPumps` re-adds every `{k:"rx"}` layer after the
declaration — so a cap applied only once is undone by any attack
reaction. Dropping either site failed **no drill** until the sabotage
pass said so; the second one now drives a real reaction layer and reads
`linkPumps`'s **returned** total, because the pend it leaves alone is the
declaration measured a second time.

**And it is applied LAST of the declaration-time modifiers.** Placed
before Courage's pop or Debilitate's debuff it caps a number that is not
the one being declared. It happened to give the right answer there, which
is worse than giving the wrong one.

### Crush the Weak — *"they can't play attack action cards with 3 or less base {p}"*

A **LEGALITY, not a modifier.** `parser.nextTurnBars` is the one reader
and both boards ask it before the card leaves the hand — refusing after
it has left costs the player a card for a play the rules never allowed,
which is the reasoning that put v3.11's reaction-target restriction in
`judge.legal`.

Three things the printed words decide, each a way to be wrong:

- **`isAtkActionCard`, never `isAttack`.** The latter tests `tt`, and
  **"Reaction" contains "action"** — so an attack REACTION would be
  barred by a card that never names one. That is the trap CLAUDE.md has
  named since v2.44, and the sabotage pass caught it here.
- **BASE {p}.** A buff must not lift a card over the line and a debuff
  must not push one under it.
- **The threshold is read off the clause**, not a literal 3. A literal is
  inventing card text one level up.

### The two ledgers were updated deliberately

`test/crush.test.js`'s *"TWO of the five are built; THREE still refuse"*
and the matching assertions in `test/parser.test.js` are pins, so they go
red on purpose when the count moves — the same discipline as the symmetry
gap and the coverage baseline. They now read **four built, one refusing**.

**Walk in My Shoes still refuses**, and for its own reason rather than a
shared shrug: halving base {p} AND base {d} for a whole turn is a
modifier on every attack action card they control, which is neither a cap
nor a gate and has nowhere to live. Claiming it would file a card `full`
that does nothing, which is the tier lie this project keeps finding.

**Measured:** 315 → **318 full**, 18 → **15 none**. Fairness clean.
1273 → **1283 drills**, 0 skipped.

---

## v3.29 — an effect armed against their next turn

Bravo's deck holds the pool's biggest unreadable block, and it is one
missing mechanism rather than eight broken cards. Five names print a
crush rider that reaches **forward**:

```
Debilitate         their FIRST attack during their next turn gets -2{p}
Cartilage Crush    their FIRST action during their next turn costs an extra {r}
Chokeslam          attack action cards they control can't gain {p}
Crush the Weak     they can't play attack action cards with 3 or less base {p}
Walk in My Shoes   base {p} and {d} of their attack action cards are halved
```

v3.16 refused all five, honestly, "because no such schedule exists".
There is one now.

### Why it needed a field of its own

`hist` is the natural home for a per-turn fact — and it is **cleared for
the incoming seat at CR 4.4.4**, which is the exact moment an effect
aimed at that seat's turn has to still be there. So `nextTurn` is a real
side field, and the lifecycle is the rule:

| | |
|---|---|
| **armed** | created on my turn, does nothing yet |
| **ready** | turned on at the start of *their* turn |
| **spent** | consumed by the FIRST attack / FIRST action |
| **expired** | dropped at the end of that turn, fired or not |

**Armed is not live.** An effect created during their own turn would
otherwise fire immediately — a whole turn early. **Spent is not
optional**: both cards print *"their FIRST"*, and a debuff lasting the
whole turn is strictly stronger than printed.

Driven end to end: their first attack goes 6 → **4**, their second stays
**6**; a 2-cost card costs **3**, and the next costs **2** again.

### Two built, three still refusing — each for its own reason

Chokeslam and Crush the Weak are **restrictions** (*"can't gain {p}"*,
*"can't play"*) that belong in `legal` and in every pump path; Walk in My
Shoes halves base {p} and {d} across a whole turn. Claiming any of them
here would file a card `full` that does nothing, which is the tier lie
this project keeps finding.

### Two things the new field had to be told to

The tax is spent at the **charge**, never at the affordability check —
`effCost` is read twice and only one of those reads actually takes
resources (v2.80). And a side field is not real until the wire carries it
(a dropped field is a desync) and the report names it (a report that
omits state is worse than none).

The symmetry ledger moved **39 → 40**, deliberately. A field arriving is
as deliberate an edit as one leaving.

```
npm test          1273 drills, 0 failed, 0 skipped
npm run audit     405 cards — 315 full / 72 part / 18 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

---

## v3.28 — prevented arcane is not dealt arcane

**RULING (user, 2026-08-22):** Sigil of Suffering's own arcane satisfies
its own condition — *"as long as it's not prevented."*

The first half was already right. The second half was not, and the
qualifier is what exposed it.

### The credit was added before anything could stop it

`hist.arc` — the field behind *"if you've dealt arcane damage this
turn"* — was incremented **at the call site, before `arcaneHit` ran**. So
a point of arcane turned entirely aside by an arcane shield, an arcane
ward or a barrier still counted as dealt. CR 7.5.5 says prevented damage
is not dealt; the user's ruling says the same about the card that asks.

It is credited where the damage **lands** now:

```
arcane lands            dealer hist.arc = 1
fully shielded          dealer hist.arc = 0     <- the ruling
partially prevented     dealer hist.arc = 1     <- some of it landed
```

And Sigil reads it correctly off that: 3 printed, 4 when its own arcane
got through, 3 when it did not.

### The deferred path credits the dealer, not the victim

When the threatened hero holds a barrier, `arcaneHit` does not apply the
damage — it queues a soak prompt and the damage rides out on the answer
as an `arcTaken` op. **That answer is given by the side being hit**, and
`promptConfirm` borrows their seat, so at `arcTaken` time the actor *is*
the victim. Crediting `act` there hands the arcane to the hero taking it.

Which seat dealt it rides on the spec as `by`, passed through
`buildPrompt` explicitly — a spec only carries the fields it knows about,
which is the `arsStamp` lesson from v2.34.

**Sabotage is the only reason that got built.** On the immediate path the
dealer and the actor are the same seat, so replacing the dealer lookup
with `actMut` failed *nothing*. The soak path is drilled now, end to end:
the spec records `by`, `buildPrompt` carries it, `applyPrompt` puts it on
the op, and running the op with the victim as actor still credits the
dealer.

### Three source-slice drills became driven ones

`runechant.test.js` sliced the pop block and grepped it for the credit —
written when `execute` lived inside the React component and no drill
could call it. That has not been true for a long time, and the credit has
now left the pop entirely. **A source check pinned to a location stops
meaning anything the moment the rule moves**, which happened to these
twice (v3.22, v3.28).

The same three properties — that it credits, that it counts one instance
per *source* rather than per point, and that it writes to the side rather
than the game object — are driven now, plus the two the ruling added.

```
npm test          1264 drills, 0 failed, 0 skipped
npm run audit     405 cards — 312 full / 72 part / 21 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

---

## v3.27 — Unity, the arsenal reactions, and a guard that could not see

Two more printed defence conditions, and a free third the rule found on
its own.

| card | printed condition |
|---|---|
| **Gauntlets / Helm of Unity** | *"when this defends together with a card from hand"* |
| **Springboard Somersault** | *"if this was played from arsenal"* |
| **Unmovable** | the same clause, with its own number |

**Unmovable was not on the list this cycle set out to build.** It prints
Springboard's clause with +1 where Springboard prints +2, so the reader
found it for free — which is the whole point of fixing the RULE rather
than the card, and the reason every amount is read off the clause rather
than hardcoded.

### Why these two and not the others

Both conditions are true only **during a block**. That keeps them clear of
the at-rest display problem v3.24 recorded: Basalt Boots (*"if you control
a Seismic Surge token"*) and Mournful Casket (*"if an ally has been put
into your graveyard this turn"*) are true sitting on the board, so
buffing them at the wall alone would put a number on screen that
disagrees with the number that blocked. They still wait for a display
pass.

### The wall has to count before it sums

*"Together with a card from hand"* is a fact about the **rest of the
wall**, so both walls count their hand defenders before either loop
starts. judge loops gear first — a running total would read zero for
every piece.

### A source guard could not see this, and sabotage said so

The ordering check asserted the count is declared before it is used.
Replacing either count with a literal `0` **still declares it before use**,
so the guard passed on a wall that had stopped counting entirely.

Both walls are **driven** now, with a real block:

```
helm alone                       20 - (6 - 1) = 15
helm + a card from hand          20 - (6 - 5) = 19     wall (1+1) + 3
a wall that stopped counting     20 - (6 - 4) = 18     <- now fails
```

judge's is driven through `reduce`; the trainer's through `resolveStack`,
which judge never calls — a drill on one board says nothing about the
other, which is exactly why CLAUDE.md records that judge's wall once had
no drill at all. The *declaration* is constructed in both, and that is
legitimate: which cards are defending is the caller's answer on either
board. What is measured is what the wall makes of them.

```
npm test          1261 drills, 0 failed, 0 skipped
npm run audit     405 cards — 312 full / 72 part / 21 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

**13 of the 23 built.** What is left: the two at-rest equipment
conditions, Big Blue Sky (counts blue cards **pitched** — nothing tracks
pitches today, so it needs a new hist field), Stonewall Impasse (clash on
defend), Washed Up Wave (a choice plus watery grave), and the two paid
ones.

---

## v3.26 — two more defence conditions, and a default that refuses

v3.25 made a *played* defence reaction reach the wall. That is what made
these reachable at all — before it, building them would have been
building a buff onto a number nobody read.

| card | printed condition | answered from |
|---|---|---|
| **Sigil of Suffering** ×3 | *"if you've dealt arcane damage this turn"* | the defending side's own turn history |
| **Wax On** ×3 | *"while this is defending an attack action card with cost 0"* | the incoming attack card |

`fx.defSelf` carries the condition instead of a bare flag, and
`defSelfMet` answers it. Three shapes, three different sources — which is
exactly why it is a function and not a boolean.

**Every unknown condition returns FALSE.** A `when` the evaluator does not
recognise leaves the card at its printed value. That is the guard against
the drift where a fourth condition is added to the parser and forgotten
here, and it is the honest direction: a defender that blocks for more than
it prints steals games; one that blocks for its printed number is merely
incomplete, and visible.

**The cost threshold is read off the clause**, not hardcoded to 0. The
card names its own number.

### Sabotage found three drills that proved nothing

Worth recording, because two of the three were mine from the same session:

1. **Wax On vs a weapon swing** was the wrong fixture. A weapon carries
   neither Action nor Attack, so it is refused by *either* half of the
   test — dropping the Attack check alone still excluded it. Only a
   **non-attack action card at cost 0** tells the two apart.
2. **Dropping `atkCard`** from judge's hand wall failed no drill: v3.24's
   call-site guard required `weaponAttack` and said nothing about which
   card. Both are required now.
3. **The unbuilt-condition default** could not be reached from a card
   fixture at all — the parser only emits the three `when` values the
   evaluator knows, so `if(self && …)` short-circuited and the sabotage
   changed nothing. `defSelfMet` is exported and asked directly, with the
   three built conditions asserted alongside so it cannot pass by
   refusing everything.

### One recorded assumption

Sigil of Suffering deals its own arcane and then asks whether arcane has
been dealt this turn. **Its own damage satisfies its own condition** —
that is what the CR ordering gives (the card resolves, then its defence is
totalled), and it leaves the clause meaningful rather than vacuous,
because a turn where the arcane never lands is a turn where it does not
apply. Flagged in the drill for the user to correct if the intent is
"arcane dealt *before* this card".

```
npm test          1254 drills, 0 failed, 0 skipped
npm run audit     405 cards — 312 full / 72 part / 21 none   (Wax On: none -> full)
npm run fairness  clean
tools/failstates  0 UNFAIR
```

---

## v3.25 — the defence reaction that stopped nothing

Chasing the last of v3.23's self-buff family turned up something much
larger sitting underneath it.

> **Every defence reaction in the pool blocked for zero at the table.**
> 15 unique cards, 39 copies, across **11 of the 15 heroes**.

### What was actually broken

A defence reaction is not *declared* the way a card from hand or a piece
of equipment is — it is **played**, at instant speed, in the reaction
step. The trainer has always handled that: it pushes the card onto
`blockRx` and its wall subtracts `drx`.

`blockRx` has been a field on every side since **v2.14** and has been
cleared in judge's `strike` since **v2.46**. It was never *written* and
never *read* there. So at the table the card resolved its text, went to
the graveyard, and the number printed on it was thrown away.

**Driven before it was believed.** Sigil of Suffering prints 3 defence:
played legally into a 6-power attack, it dealt its 1 arcane to the
attacker and the defender still took the full 6.

```
before   seat1 hp 14   (6 through)      after   seat1 hp 17   (3 stopped)
         seat0 hp 19   (arcane landed)          seat0 hp 19   (unchanged)
```

The ops were never the broken half. Both are pinned together now, so a
future fix cannot trade one for the other.

### Why no tool could see it

`journey.test.js` proves a defence reaction can never be **declared** as a
defender (CR 8.1.3a) — correct, and it is the *other* half of the rule.
Nothing asked whether one that was *played* did anything. Coverage reads
these cards `full` because their text parses and resolves; the fairness
sweep is one-sided toward too-strong and this is as weak as a card gets.

It is the shape v3.17 named and this project keeps paying for: **a rule
that exists on one board only.** The field was there, the clear was there,
and the two halves that would have used it were not.

### Where the fix lives, and why there

The wall reads `blockRx`; `commitPlay` records it. Recorded in `judge.js`
rather than in `effects.js` because *"is this card defending"* is a
question about the combat structure this file owns — the trainer answers
it from its own `mode`/`bphase`, and `effects.js` is phase-free on
purpose.

The NUMBER comes from `defendValue`, the body v3.23 built, so a
conditional buff will land on a played reaction exactly as it does on a
declared defender. Only the **defender's** card counts, and only against a
live attack (CR 8.1.3a). The entry is cleared in `strike` with the rest of
the wall — a leftover would defend the next chain link for free, which is
v2.46's bug in a third zone.

```
npm test          1248 drills, 0 failed, 0 skipped
npm run audit     405 cards — 311 full / 72 part / 22 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

Four guards sabotaged and confirmed to bite, including the two that would
let the attacker's own reaction count and one that would let a reaction
defend with no attack in flight.

---

## v3.24 — four pieces that printed a promise they never kept

v3.23 built the seam and measured a 23-card family it did not build.
This takes the first four off that list.

> **Blade Beckoner Boots / Gauntlets / Helm / Plating** —
> *"This gets +1{d} while defending a weapon attack."*

All four read `tier: full` and all four blocked for their printed number,
because both walls summed `gearDef(piece)` — wear, and nothing else. The
number in the audit did not change this version; **what changed is that
it is now true.**

### The condition belongs to the attack, not to the card

*"While defending a weapon attack"* is not answerable from the piece. It
is a property of the thing coming at you, so `defendValue` takes it from
the caller — the same split `heroHit` and the wall itself already keep,
and for the same reason: judge routes combat one way and the trainer
another, so a body that guessed would be right on one board and wrong on
the other.

**Absent, the buff does not apply.** A caller that forgets to say what it
is defending gets the printed value, never the buffed one. Weaker than
printed and visible; the other direction is a wall that quietly stops
more than the cards grant.

**The wear stays `gearDef`'s.** It owns Guardwell, Temper, battleworn and
destruction, and re-deriving any of that inside `defendValue` would be a
second copy of the wear rules. The caller passes the base.

**A destroyed piece gains nothing** — `gearDef` answers 0 for one, and
without an explicit guard the buff lifted that back to 1: a piece that
has left the arena blocking for a point. **Found by driving it, not by a
drill.**

### The drill that let it through

Sabotage is the point of sabotage. Removing `weaponAttack` from judge's
gear wall — which silently stops the buff applying on that board — failed
**no drill at all**, because v3.23's guard matched the *call*
(`E.defendValue(sd, piece`) and a dropped third argument still matches it
perfectly.

That is the family this project keeps paying for: **a guard aimed at the
wrong shape passes by finding nothing**, this time in a guard I had just
written. Every `defendValue` call site is now checked for saying what it
defends, the definition is excluded from that scan (it matches the same
text and has no arguments), and all four call sites were re-sabotaged to
confirm each one bites.

```
npm test          1242 drills, 0 failed, 0 skipped
npm run audit     405 cards — 311 full / 72 part / 22 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

**19 of the 23 remain**, and the reasons are recorded rather than vague:
Wax On is a *Defence Reaction*, which is played rather than declared and
takes a third path through the wall; the rest gate on turn history, board
state, or a paid cost, and each needs its own reader. `defendValue` is
where they go.

---

## v3.23 — a defender is worth its printed number plus what modifies it

**Briar's engine is complete**, and finishing it opened a 23-card family
nobody had looked at.

### Embodiment of Earth did nothing, on both boards

> "Non-attack action cards you control get +1{d} while defending."

Both walls summed `c.def || 0` — the **printed** number — so a card whose
defence is modified while it defends blocked for the wrong value on the
trainer *and* at the table. The aura sat on the board doing nothing.

`effects.defendValue(defSide, card)` is the one body now. The **wall
stays the caller's** — the trainer holds defenders on the hand, judge on
`blockH`, and that split is deliberate — but what a single card is
*worth* is card semantics and belongs in one place, or the two boards
disagree about a number.

**The subject is read off the structured type array**, and each exclusion
is a way to be wrong:

| card | gets it? | why |
|---|---|---|
| non-attack action card | **yes** | the printed subject |
| attack action card | no | carries Attack as well as Action |
| defence reaction | no | *"Reaction"* contains the substring *"action"*, and a reaction is not an action card |

Two Embodiments stack. A card printing no defence comes back 0 + 1, not
`NaN`. Only the defender's own board is consulted, because the printed
phrase is *"cards **you** control"*.

### And the family it exposed — 23 cards, measured, not built

The pool prints a whole *defensive self-buff* family and **not one of
them is applied**, because both walls read the printed value:

```
Blade Beckoner Boots/Gauntlets/Helm/Plating   +1{d} while defending a weapon attack
Wax On (x3)                                   +2{d} vs a cost-0 attack action card
Sigil of Suffering (x3)                       +1{d} if you've dealt arcane this turn
Big Blue Sky                                  +1{d} per blue pitched this turn
Basalt Boots · Mournful Casket                +1{d} on a board/graveyard condition
Gauntlets/Helm of Unity                       +1{d} defending alongside a hand card
Rally the Coast Guard · Staunch Response      paid
```

**Most of them read `tier: full`.** The clause is consumed, so coverage
counts it; the buff simply never reaches a wall. And every one is
*weaker* than printed, so the fairness sweep — deliberately one-sided
toward too-strong — cannot see them either. This is the shape Phase 3
keeps finding: *they were read, and read wrong.*

They are **not built here, on purpose.** `defendValue` is where they go,
so each is a reader rather than new machinery — but Blade Beckoner is
EQUIPMENT and equipment defence flows through `gearDef`, which the UI and
the advisor also read. A buff applied at the wall alone would make the
number on screen disagree with the number that blocked, which is the
sev-2 category the player *trusts*. Half-building it is worse than the
honest gap.

```
npm test          1237 drills, 0 failed, 0 skipped
npm run audit     405 cards — 311 full / 72 part / 22 none
npm run fairness  clean
tools/failstates  0 UNFAIR
```

Six guards sabotaged and confirmed to bite, including both walls
individually — a wall that drifts back to `c.def` is a board where the
aura silently does nothing, which is exactly the state this found.

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

