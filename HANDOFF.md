# Handoff — Dawnblade, at v4.01 · PHASE C · THREE CARDS READ NOTHING

## ⚠ THE REMAINING THREE, AND WHAT EACH IS WAITING ON

`npm run audit`: **381 full / 21 part / 3 none**. Night's Embrace left that
list at v3.87. What is left, with the honest reason each still refuses:

| card | printed | waiting on |
|---|---|---|
| **Glisten** | *"distribute up to four +1{p} counters among any number of weapons"* | a DISTRIBUTION sheet. `ctrPut` and the sharpen wipe (v3.66) are both built |
| **Danger Digits** | *"target dagger you control that isn't on the active chain link deals 1 damage… the dagger has hit"* | a "has hit" FICTION for a card that never attacked |
| **Hope Merchant's Hood** | *"shuffle any number of cards from your hand into your deck, then draw that many"* | deck manipulation, and a rider whose count is the pick's own size |

**THE PATTERN, FOR THE SIXTH VERSION RUNNING: none of the three is
waiting on its payload.** Every effect reads. What refuses is a cost
shape, a prompt shape, or a zone move — which is what Phase C looks like
from here.

**v3.99 RAN THE CENSUS ON `runOps`' OP VOCABULARY — the third of the three
targets the last handoff named — and it found one real hole and a seam.**
Every op kind the parser emits over the pinned pool, against every kind
`runOps` dispatches: four unhandled, three of them dispatched elsewhere by
design (`pump` and `wpnAgain` at the atkTrigger pop site, `payOrLose` at
its own). `self` was the hole, and **Jack Be Quick's optional cost paid it
and received nothing.**

**AND THE SAME PASS FOUND A WHOLE PREFIX FAMILY.** `classifyClause` guards
the ACTIVATION prefixes so the loose matchers cannot eat a cost (v3.59);
the KEYWORD prefixes have the same hazard and only three of five members
were guarded. **Rush of Power and Lava Burst pumped unconditionally**,
four records, all `tier: full`, all stronger than printed. Second Strike
dropped a printed action point in the other direction, and **cloaked was
filed under stealth's noop reason**, which hid a flip cost that made
Uphold Tradition's ability repeatable.

### THE CENSUS PATTERN HAS PAID FIVE TIMES IN FIVE VERSIONS

**v4.00 ran the last three targets and the list is now empty.** Both
window censuses came back clean and are pinned in
`test/keycensus.test.js`; the BOARD-READER census — the third target,
which suggested itself when `abCostWhy` was hoisted by hand — found **two
more one-board rules**: `costCtx` (Fai's Draconic discount quoted at full
price on the trainer, display sites included) and `tapsToActivate` (judge
refuses a tapped hero, the trainer never asked).

**WHAT IS LEFT TO CENSUS.** Nothing obvious, and that is itself worth
saying rather than inventing a target. The pattern's value came from
places where **one description of a rule had two readers**; the ones that
remain are all single-reader by construction. The next one will present
itself the way this one did — by a bug being found by hand and the
question *"what would have caught this?"* being asked immediately.

**A CANDIDATE, HELD RATHER THAN BUILT**: `effects.js`'s 44 second-person
feed literals against the seat that reads them (v2.83's pinned ledger). It
is a REPORTING census rather than a rules one, so a miss costs a confusing
line and never a game — which is why it has not been done, and why saying
so beats leaving it on a list.

### THE CLOAKED DISPLAY HALF IS OPEN, AND IT IS THE ONLY HALF LEFT

RULING (user, 2026-07-25) says *"EQUIPPED FACE DOWN — **SHOW CARD BACK ON
THE PLAYERS BOARD**"*. The rules half is built (the piece equips
face-down, the flip is a cost, the ability is a one-shot); the **display**
half is not, and it is deferred with the rest of the UI pass rather than
forgotten. It is one shared component — `ArmorGrid`'s cell — so both
boards get it in one edit.

What is deliberately NOT decided: whether a face-down piece keeps its
printed defence and its **Ward 1**. The card does not say, the database
prints no CR text for it, and half-building a value change is worse than
the honest gap (v3.23). The ledger carries the gap as `partial` so
`failstates.js` grades it against the claim rather than a grep.

**AND ASK FOR THE REFUSAL, NOT THE MATCH.** `qualMatches` passes every
field test vacuously on an object with no qualifier keys, so a drill that
only asks whether a grant LANDS is blind to a matcher that has stopped
restricting anything. Two of three silent sabotages this version needed
exactly that fixture.

**v3.97 MADE THE v3.96 DIAGNOSTIC A STANDING DRILL, AND IT CAUGHT THE NEXT
CHANGE IMMEDIATELY.** `test/condcensus.test.js` walks the pool, collects
every condition the parser EMITS, and asserts each is answered somewhere.
It found nothing outstanding — worth having proved — and then went red on
the very next commit, which routed two cards' gates to a different
evaluator. **That is what a census is for.**

**THE SAME QUESTION IS WORTH ASKING OF THE OTHER PAIRED READERS.** Three
small evaluators now have pinned vocabularies (`defSelfMet`, the
as-instant gate, the activation gate). The ones NOT yet censused:
`playWindowFor` vs `playableWhy` (v3.36's negative-action-point bug lived
exactly there), and `qualMatches`' atom set against what `attackQual`
emits.

**v3.96 FOUND A SECOND, SMALLER COPY OF A CONDITION VOCABULARY.**
`condOnHit` is re-checked at the HIT, so it has its own evaluator — and
measured by asking the PARSER, seven conditions reach it and the evaluator
knew four. Three cards were granted an ability that then refused itself,
all reading `tier: full`.

**THE DIAGNOSTIC, AND IT IS THE CHEAPEST ONE LEFT: when a value has two
evaluators, ask the PARSER what reaches each — never read the lists.** It
took one script and moved five cards. The same question is worth asking of
`fx.conds` vs `pend.lateConds`, and of the activation-window readers.

**AND TWO CARDS ARE RECORDED, NOT BUILT.** Aether Icevein and Polar Cap
parse into `condOnHit` and are NON-ATTACKS, which open no `pend` — so the
gate is not unknown, the ROUTE is missing. `_dmgWay` (v3.62) and
`thisWayMet`'s `way:dealt` are the pieces that would discharge it; the
refusal is pinned in `test/condgate.test.js`.

**v3.95 CLOSED THE TWO LOOT CARDS — THE FIFTH RECORDED REFUSAL TO COME
DUE THIS FORTNIGHT.** Both grant a two-sentence quoted ability, and
`classifyClause` over the whole string reads ONE sentence and drops the
other inconsistently. The sentences are split now and the second rides as
a `way:took` gate, off a trace neither `_discWay` nor `_dmgWay` could
supply.

**THE HABIT THAT KEEPS PAYING: read the drills' own assertion TEXT for
recorded refusals.** Five have come due in a fortnight and every one was
written down in the drill that pinned it. `grep -rn "refus\|deliberately
not\|does not read" test/` is the sweep.

**v3.94 FOUND A WHOLE MECHANIC ON ONE BOARD — AND COVERAGE COULD NOT SEE
IT.** Seven pool cards print CLASH, every one reads `tier: full`, and at
the table not one of them did anything: `index.html` had 31 mentions,
`judge.js` had one and it is a comment. Coverage did not move a single
card this version, deliberately.

**THE DIAGNOSTIC THAT FOUND IT IS CHEAP AND HAS NOW PAID TWICE:** `grep`
the engine and `index.html` for regexes over `.tx`, and for each one ask
**which board runs it**. v3.93 found a card firing without the parser that
way; v3.94 found a mechanic. The remaining hits are listed by
`grep -n "\.tx" engine/*.js index.html` — most are display (`tapwrap`),
which is fine.

**AND A `noop` WHOSE REASON NAMES A READER IS THE SHAPE TO DISTRUST.**
Every clash clause said *"the clash block applies this"* — a reader that
existed in one file. **When a noop names a reader, go and ask which board
holds it.**

**v3.93 CLOSED BEATEN TRACKERS AND REFRACTION BOLTERS, AND ONE OF THEM
WAS ALREADY FIRING.** Beaten Trackers worked for versions through an
INLINE REGEX in `effects.js` — v3.58's "a card handled outside the parser
is a card special-cased" — and that is exactly why it reported `part`:
**a tier is a claim about the PARSER.** Its sibling, printing the
identical cost, was completely dead on both boards.

**SO THE CHEAPEST LEAD LEFT IS THE OPPOSITE OF THE USUAL ONE.** `npm run
gaps` lists cards whose TEXT is unread; this one was a card whose
BEHAVIOUR was already there. **Grep `engine/effects.js` for regexes over
`.tx` and ask which card each one is really about** — v3.58 found two that
way, this found a third, and each time the tier was the tell.

**v3.92 CLOSED MOUNTING ANGER AND RISING RESENTMENT — A RECORDED REFUSAL
FROM v2.29, DISCHARGED BY A READER BUILT FOR THEIR OWN HERO.** *"…with
cost less than the number of Draconic chain links you control"* was
refused because no printed field expresses the bound; `parser.dracLinks`
was built at v3.86 for **Fai's** discount, and Fai decks both cards. Fourth
recorded refusal to come due this fortnight.

**THE RULE WORTH CARRYING: A CENSUS CAN REPORT A FAMILY EMPTY FOR A REASON
ONE LAYER UP.** v3.53 measured the `hits` optional-cost trigger as having
**zero pool cards** and recorded its queue site as unwired *for that
reason*. Both halves were true — and the trigger had no cards **because
the FILTER refused**, so `fx.optCost` was never set on the two cards whose
trigger it is. When a census reports a family empty, ask what would have
to be true for it to be non-empty.

**v3.91 CLOSED TWO MORE `part` CARDS AND NEITHER NEEDED ANYTHING NEW** —
Agile Engagement's condition is Boltyn's one route over, and Turn to
Mindfire's two records (`_dmgWay`, `heroTapped`) both already existed.
**That is the shape to look for first**: `npm run gaps` lists the
unfinished cards, and a good share of them are waiting on something the
engine already has. Coverage is **379 full / 23 part / 3 none**.

**JITTERY BONES AND WASHED UP WAVE CLOSED AT v3.90**, and building them
found a third: FOUR pool records print *"when this defends"* on GEAR and
**neither board reached any of them** — judge built its wall from the hand
alone and the trainer filtered gear out, so Stonewall Impasse was inert on
both. That is the third consecutive version where a card refused because
of a ROUTE rather than a reading.

**SHRED CLOSED AT v3.89, AND BUILDING IT FOUND TWO LIVE TWO-BOARD
DEFECTS** — see the changelog. The lesson worth carrying: when a card
refuses, check which ROUTE it takes on each board before building
anything. Seven attack reactions were taking different routes on the two
boards and nothing here could see it.

**CONCOCT DISORDER CLOSED AT v3.88** and its lesson generalises: on an
attack card, an op whose own condition asks about it must be PRE-RUN at
declaration, because `execute` evaluates conditions before it runs ops
and an attack's ops ride to resolution.

## ⚠ ONE UNREAD HERO CLAUSE REMAINS IN THE WHOLE POOL

`npm run sweep`'s hero block is **3 heroes · 3 clauses**, and **two of
those three are the ability's printed NAME** — Briar's *"Essence of Earth
and Lightning"* and Iyslander's *"Essence of Ice"*, which the database
lists in its own `card_keywords` and the audit annotates as such (v3.86).
They are not work.

**The one genuine remaining clause is ENIGMA's `{c}{c}{c}`**, and it is a
RULING rather than an engineering call — see below.

### WHAT LANDED AT v3.86

| hero | clause | what actually refused |
|---|---|---|
| **Gravy Bones** | *"{t}, destroy a Gold you control: Draw a card, then discard a card"* | the COST. `parseHeroPower` refuses a destroy that is not `destroy this`, and 38 of the pool's 39 destroy-costs are. His ability was entirely inert. |
| **Fai** | *"start the game with a Phoenix Flame in your graveyard"* | nothing built the pregame graveyard — Dash's shape, one zone over |
| **Fai** | *"costs {r} less per Draconic chain link"* | the rider was dropped, so it charged 3 on the turn it should cost 0 |

**AND `makeSide` SILENTLY DROPPED A SEEDED GRAVEYARD** — it hardcoded
`grave: []`. Found by driving Fai's opening, not by reading the field
list. If you seed a new zone into `newMatch`, check `makeSide` takes it.


## ⚠ ONE UNREAD HERO CLAUSE REMAINS IN THE WHOLE POOL

`npm run sweep`'s hero block is **3 heroes · 3 clauses**, and **two of
those three are the ability's printed NAME** — Briar's *"Essence of Earth
and Lightning"* and Iyslander's *"Essence of Ice"*, which the database
lists in its own `card_keywords` and the audit now annotates as such
(v3.86). They are not work.

**The one genuine remaining clause is ENIGMA's `{c}{c}{c}`**, and it is a
RULING rather than an engineering call — see below. Every other printed
hero clause in the pool is built.

### WHAT LANDED AT v3.86

| hero | clause | what actually refused |
|---|---|---|
| **Gravy Bones** | *"{t}, destroy a Gold you control: Draw a card, then discard a card"* | the COST. `parseHeroPower` refuses a destroy that is not `destroy this`, and 38 of the pool's 39 destroy-costs are. His ability was entirely inert. |
| **Fai** | *"start the game with a Phoenix Flame in your graveyard"* | nothing built the pregame graveyard — Dash's shape, one zone over |
| **Fai** | *"costs {r} less per Draconic chain link"* | the rider was dropped, so it charged 3 on the turn it should cost 0 |

**None of the three was the payload.** Every effect had read for versions;
what refused was a cost, a placement, and a rider. That is the shape to
expect for the rest of Phase C.

**AND `makeSide` SILENTLY DROPPED A SEEDED GRAVEYARD** — it hardcoded
`grave: []`. Found by driving Fai's opening, not by reading the field
list. If you seed a new zone into `newMatch`, check `makeSide` takes it.


## ⚠ COSMO IS BUILT (v3.84) — AND ENIGMA IS ALIVE

`from: "aura"` is the third activated-attack route. Enigma goes **3 wins
→ 24**, and 210 self-play games came back with **zero stalls** for the
first time.

**HER CLAUSE 1 IS BUILT (v3.85)** — *"your first Spectral Shield attack
each turn costs {r} less to activate"*. She reads 1 of 2 now, and the
remaining half is the `{c}` ruling below. **Enigma 3 wins → 25, first in
the table.**

**HER CLAUSE 2 IS STILL BLOCKED ON `{c}`**, which is a RULING and not an
engineering call: the symbol appears on exactly one record in 797 (hers),
the database prints no reminder text for it, and the SEN001 card face
shows three blue-grey spirals it never names. See `tools/scenes/enigma.js`
— the scene pins the measurement so nobody re-derives it.

### AN OPEN QUESTION THIS RAISED

**Does a board aura's printed `Ward N` also feed the prevention pool?**
`fx.ops` gives Spectral Shield `[["ward",1]]` — the op that fills a side's
pool when a card RESOLVES — and a token minted onto the board never takes
that path, so today it does not. Cosmo's own text settles that ward is a
NUMBER the aura carries, which is what v3.84 reads; whether it is *also* a
standing prevention is unruled. Reading it as one would be inventing a
rule; the current state is weaker than printed and visible.

## ⚠ COSMO IS THE NEXT REAL BUILD, AND IT IS ENIGMA'S WHOLE ENGINE

> *"During your turn, auras you control with **ward** are weapons with
> base {p} equal to their **ward** and \"Once per Turn Action - {r}:
> Attack\"."*

The Spectral Shield token's entire printed text is **"Ward 1"** — it has
no attack. Cosmo is what gives one to every ward-bearing aura she
controls, which is what her clause 1 (*"your first Spectral Shield attack
each turn costs {r} less to activate"*) is discounting. Build Cosmo and
that clause becomes reachable; her clause 2 stays blocked on the **{c}**
symbol, which is a ruling and not an engineering call (see the enigma
scenes).

**v3.83 fixed the ROUTE, not the grant.** Cosmo is now correctly refused
("prints no activated ability") instead of being swung for 0 — weaker than
printed and visible, which is the honest state until the grant exists.

## ⚠ ALL FIFTEEN HEROES HAVE SCENES NOW (v3.82)

`npm run scenes` covers every hero — 49 scenes. Writing the eight that
were missing found two dead readers that no other tool could see, which
is the argument for the instrument restated. **When you touch a hero,
read its scene file first**: each scene carries the defect it exists for.

### THE DIAGNOSTIC THAT KEEPS PAYING

Three separate versions this stretch found the same shape from three
directions. It is worth running deliberately rather than stumbling on:

1. **A reader that tests REMINDER TEXT** — count the records that print
   it. Twice now the answer has been zero (ephemeral, v3.82).
2. **A card at tier `none` whose payload parses ALONE** — the blocker is
   the cost prefix or the trigger, not the effect (v3.79).
3. **A counter or a scan reporting ZERO** — check it spells what the
   source spells before believing the feature is missing (v3.81).

## ⚠ THE HARNESS ONLY STARTED PLAYING THE WHOLE GAME AT v3.80

`sparring.act` could not play a NON-ATTACK until v3.80 — 85-91% of three
heroes' decks, and every arcane, aura, token mint and pump in the pool.
So every `npm run play` number recorded before v3.80 was measured on
roughly half the engine, and the two bugs that fix immediately surfaced
(a whole `PENDING_KINDS` branch, and an activation charging more than
`legal` checked) had never been reachable.

**Re-run any measurement you are about to rely on.** The win table, the
route-coverage counts and the mirror balance all moved.

AND v3.81 ADDED THE ATTACK-TARGET CHOICE, so the ally-combat branch
(v3.44/v3.45/v3.46) is exercised for the first time: 0 ally deaths per 20
games became 57. Two route counters were also grepping words the feed
never prints — `death` and `gold` both read 0 while the routes worked.

**The numbers CLAUDE.md quotes from before v3.80 are all suspect**, the
loadout button's "the dummy wins 29 of 45" among them. Re-derive before
citing.

## ⚠ SEVEN HEROES FINISHED — WHAT IS LEFT

Kayo, Dorinthea, Azalea, Bravo, Boltyn, Arakni and Lyath. The sweep's hero
list is **5 heroes / 7 unread clauses**: Enigma 2/2, Fai 2/3, Briar 1/3,
Gravy Bones 1/2, Iyslander 1/3.

### UNFAIR IS 0 — FOR THE FIRST TIME

`npm run sweep`'s UNFAIR block carried Lyath's halving static from v3.21
to v3.78 and now carries nothing. **Re-derive it rather than trusting this
sentence** — the last one like it was wrong for nineteen versions.

### THE `none` LIST IS DOWN TO 8, AND THE DIAGNOSTIC THAT DID IT

Run every `none` card's payload through `classifyClause` ALONE. If it
parses, the blocker is the COST PREFIX or the TRIGGER, not the effect —
and both are usually waiting on machinery that already exists (v3.47,
v3.79). It moved Radiant Touch and Back Alley Breakline in one version.

The eight still reading nothing:

| card | the blocker |
|---|---|
| **Cosmo, Scroll of Ancestral Tapestry** | *"auras you control with ward are weapons with base {p} equal to their ward"* — **Enigma's whole engine**, and CLAUDE.md already records that judge routes Cosmo as a swing wrongly |
| **Hope Merchant's Hood** | shuffle-and-redraw — deck manipulation, a recorded open ruling |
| **Danger Digits** | built at v3.63; re-check why it still reads none |
| **Concoct Disorder** | a cross-seat arsenal put + a "…this way" COUNT condition |
| **Night's Embrace** | *"your attacks with stealth get +1{p} this turn"* — a turn-scoped QUALIFIED attack grant, i.e. the exact twin of v3.78's `defActionBuff`, with `attackQual` already built |
| **Shred** | *"target card defending an Assassin attack gets -4{d} this combat chain"* — a targeted debuff on a defender; `defendValue` is the reader |
| **Glisten** | distribute up to four +1{p} counters among any number of weapons, plus an end-phase wipe — `ctrPut` (v3.55) and `idleCounterWipes` (v3.66) both exist |
| **Jittery Bones** | a MODAL cost ("discard a card OR destroy the top card of your deck") with a rider on the chosen card |

**Night's Embrace is the cheapest of the eight** — it is v3.78's
`defActionBuff` with a qualifier instead of a type test, and both halves
are built.

### ENIGMA IS BLOCKED ON A SYMBOL, AND IT IS A RULING

Her clause 2 costs **{c}{c}{c}** — a symbol that appears on **exactly one
record in the pool, her own**, and for which the database prints no
reminder text. The SEN001 card face shows three blue-grey spirals,
visually distinct from the red {r} pip on the line above, and names them
nowhere. **Do not guess it** — that is the golden rule at the keyword
level. Book it in `tools/followups.json` with the narrow question: *what
resource is {c}, and how is it generated?*

Her clause 1 (*"your first Spectral Shield attack each turn costs {r} less
to activate"*) is blocked on something buildable instead: **Cosmo**, which
is what turns her ward-bearing auras into weapons that can attack at all.
Build Cosmo first and clause 1 becomes reachable.

### THE NEXT HEROES, EASIEST FIRST

- **Gravy Bones 1/2** — one clause. The recorded gap is that **watery
  grave's DRAWBACK is unbuilt**: he replays allies out of the graveyard
  and *nothing turns a dead ally face-down*, which is the entire reason
  the keyword's ruling exists. `tools/ledger.js` records it `live` when
  only the upside is.
- **Briar 1/3** — the unread clause is *"Essence of Earth and Lightning"*,
  a bold ability NAME that the audit's newline split reads as a sentence.
  **Recorded at v3.21 as not-work**; confirm before touching it.
- **Iyslander 1/3** — Snapback's *"another WIZARD non-attack action card"*
  is built (v3.38's `hist.playTy`); check what her remaining clause is.
- **Fai 2/3 · Enigma 2/2** — genuinely unread, and Enigma is the only
  hero with NOTHING read. Start there for the biggest single move.

### ARAKNI — WHAT IS STILL OPEN

**Tarantula is BUILT (v3.77)** — *"whenever a dagger you own hits a hero,
they lose 1{h}"*, in `linkPayload` beside `weaponRefresh`, gated on
`heroHit` and the piece's printed **Dagger** subtype. Becoming an Agent
now pays out rather than being a pure downgrade.

- **Arakni, Orb-Weaver** — *"Graphene Chelicerae cost you {r} less to
  activate."* Still open, and the blocker is not the discount: **Equip a
  Graphene Chelicera token** reads `skip` on Orb-Weaver Spinneret ×3, so
  nothing can put one on the board. The Chelicera is a Token Weapon -
  Dagger with Stealth and its own attack. **Slot legality is an open
  ruling** — Arakni already carries two Marks of the Huntsman, i.e. both
  hands. *Try the printing before booking a question* (v3.54, v3.66):
  `card.printings[].image_url` is in the pool record.
- **THE OTHER FIVE AGENTS refuse on their COST** — `Discard an Assassin
  card`, which `parseHeroPower` declines by design (v3.04). Building that
  cost shape would open all five at once, and it is the same optional-cost
  family `npm run gaps` files under *"you may …, if you do"*.

### RECORDED REFUSALS STILL STANDING

- **Stains of the Redback** — `effCost` takes ONE side by design (a card's
  discount belongs to whoever is playing it), and both of its readers must
  agree (v2.80: the cost is read twice and only one read takes resources).
  Recorded rather than half-moved.
- **Walk in My Shoes** — halves base {p} and {d} for a turn. Same machinery
  Lyath's static needs; do them together.
- **Thunder Quake's heave** sets `_faceUp` and fires no arsenal trigger —
  measured latent (Guardian card, no arrow deck holds it), recorded at
  v3.71 rather than half-moved.

## ⚠ ARAKNI'S AGENTS OF CHAOS — BUILT AT v3.76 (measured at v3.75)

> *"At the beginning of your end phase, if an opponent is **marked**, you
> become a random **Agent of Chaos**."*

Her clause 1 is built (v3.75). This is clause 2, and it is measured
rather than guessed — everything below was read out of the LIVE database
(4,952 records) on 2026-09-01, not recalled.

**THE DATABASE CANNOT NAME "AGENT OF CHAOS" AS A TYPE.** No `types`
entry, no `subtypes` entry and no `type_text` anywhere in 4,952 records
contains the word "Agent". A reader that guessed the set would be
inventing card text at the SET level, which is the golden rule broken one
layer above the card.

**IT CAN NAME THEM TWO OTHER WAYS, AND THEY AGREE.** Arakni's own record
carries `referenced_cards` — six unique ids — and every one of them is a
`Chaos Assassin Demi-Hero`. Those two answers are the same six cards:

| Agent | its own ability |
|---|---|
| Arakni, Black Widow | Once per Turn Attack Reaction - Discard an Assassin card: … |
| Arakni, Funnel Web | (the same shape, a different rider) |
| Arakni, Orb-Weaver | *"Graphene Chelicerae cost you {r} less to activate"* + an Instant |
| Arakni, Redback | (the same shape again) |
| Arakni, Tarantula | *"Whenever a dagger you own hits a hero, they lose 1{h}"* + an AR |
| Arakni, Trap-Door | *"When you become this, you may search your deck…"* |

**BECOMING ONE SWAPS THE ABILITY AND NOTHING ELSE.** Every Agent prints
`health: "*"` and `intelligence: 4`; Arakni prints life 20 and
**intellect 4**. So life does not change, intellect does not change, and
the gear and deck are untouched. What changes is the printed ability
line — which means the build's `PASSIVES` and its `HPOW` have to be
recomputed from the new line, and nothing else does.

**AND IT IS A CYCLE, NOT A ONE-WAY DOOR.** Every Agent prints *"At the
beginning of your end phase, **return to the brood**."* So: your end
phase turns you into an Agent, you hold it through the opponent's turn
and your own, and your next end phase returns you — and Arakni's clause
fires again. You are an Agent for most of the game, and a different one
each turn.

### WHAT IT COSTS TO BUILD

1. **The six Agents are NOT in `data/pool.json`.** They must go into
   `NEEDED` in `index.html` (the list of cards the loader fetches though
   no deck lists them — Crouching Tiger and Inner Chi are the precedent),
   the pool must be re-pinned, and **`DATA_VER` must be bumped** or a warm
   cache has no Agent to become.
2. **A hero-ability swap.** `buildSide` computes the passives and `HPOW`
   from `heroRec.tx` once; becoming an Agent needs that half as a function
   both the initial build and the swap call — one body, or the two drift.
3. **Both boards' end phase.** `effects.beginEndPhase` is the shared body
   (v3.17); a schedule written per board is v3.01's shape.
4. **The seeded stream.** *"A random Agent"* must use `rngInt` and store
   the rng back, or replay and lockstep break (v2.26).
5. **The hero row must say who you are**, or the mechanic is invisible.

### WHAT WILL STILL REFUSE, AND WHY THAT IS THE POINT

**All six Agents' activated abilities are refused by `parseHeroPower`
today** — five print `Discard an Assassin card` (a discard cost the
reader refuses by design, v3.04's never-parse-ahead-of-wiring) and
Trap-Door's is a deck search. So a player who becomes one gets an ability
that does nothing.

That is the **no-op blind spot** if it is shipped quietly — and it is the
opposite of it if the Agents are in the POOL, because then the audit
counts their unread text and says so every run. **Put them in the pool in
the same change that builds the transformation.**

Two of the six carry a STATIC clause that is readable and real, and both
are pointed straight at her deck: **Tarantula's** *"whenever a dagger you
own hits a hero, they lose 1{h}"* (Mark of the Huntsman ×2 is a dagger)
and **Orb-Weaver's** *"Graphene Chelicerae cost you {r} less to
activate"* (Orb-Weaver Spinneret equips one).

**Mask of Deceit** — her printed Specialization, which also transforms
(*"When this defends, become a random Agent of Chaos"*) — **is not in
this pool's gear list**. Recorded so nobody goes looking for it.

### ALSO RECORDED, NOT BUILT

**Stains of the Redback** prints *"If the defending hero is marked, this
costs {r} less to play"* — a cost reduction gated on a fact about the
OPPONENT. `effCost(c, sd)` takes ONE SIDE by design, so this needs the
caller's answer threaded through, and **both of its readers must agree**
(v2.80: `execute` charges and `doPlay` asks affordability — a discount
one of them can see and the other cannot is a payment screen whose only
exit is Cancel). Wider blast radius than the Agents; do it deliberately.

---

# Handoff — Dawnblade, at v3.63 · PHASE C · FAMILY-BY-FAMILY

## ⚠ WHERE THINGS STAND — v3.60 → v3.63 (2026-08-30)

**350 → 355 full · 43 → 38 `part`.** Four releases, committed straight to
`main` (the user authorised "commit to live"), each validated with
`npm test` + fairness + 210 self-play games (0 refusals, 0 invariant
violations, 0 malformed feed throughout).

| ver | what, in one line |
|---|---|
| **3.60** | the late `way:` condition pass — `execute` evaluates `fx.conds` BEFORE `fx.ops`, so *"…this way"* was answered against an empty record and was **false on every card, forever**. Also: the same unanchored draw-and-discard rule stealing a clause **one wording over** |
| **3.61** | `_discWay` already recorded the fact v3.60 had just built a second record for — **the no-mirror rule broken inside a single file**, and unifying them closed a gap `creditDiscard`'s own comment had recorded as a debt |
| **3.62** | the this-way pass reaches the ATTACK branch. The trace is recorded **inside `arcaneHit`'s `left > 0` branch**, so CR 7.5.5's *prevented is not dealt* governs it without being restated. **A sabotage that cannot express its bug proves nothing** — the first one applied inside the guard it was testing |
| **3.63** | **`Attack Reaction - <cost>:` was live in the WRONG WINDOW.** `parseHeroPower`'s match was unanchored and found the `action` inside RE-ACTION, so three abilities were built at ACTION speed. Sev-3, fixed, and the route built |

### THE FINDING THAT MATTERS MOST — v3.63

v3.59 guarded `classifyClause` against this prefix and **this repo then
recorded that "neither board can offer the ability."** That sentence was
about a different function. `parseHeroPower` runs its own regex over the
raw text, `clean` collapses the newlines so it cannot anchor on `^`, and
**"REACTION" contains "ACTION"**:

| card | did |
|---|---|
| Prey Spotters | marked a hero for free, any time |
| Stalker's Steps | granted **go again** — an action point — with no attack to target |
| Danger Digits | dealt 1 damage from nothing, its printed *"Destroy the dagger"* dropped |

**A REFUSAL ASSERTED IN ONE FUNCTION IS NOT A REFUSAL.** When you write
"X refuses, so nothing reaches Y", go and ask Y. Third outing for the
Reaction-contains-action trap (v2.44, v3.30) and the first found by
driving a claim rather than reading one.

### THE NEXT JOB — and it is NOT a card

**THE PHONE PASS, and it is now the top risk in the project.** Since the
last on-device session this has added **seven prompt sheets a player must
TAP** (the graveyard pick, retrieve, the counter target, the boost-banish
counter, the arsenal put, the Waxing Specter enters-with, and the
cross-seat destroy) **and, at v3.63, a gear tap that opens in a window it
never opened in before.**

The v3.63 trainer gate is validated by a **SOURCE SCAN**, and the drill
says so in its own body: a scan proves the gate exists and names the
window; it cannot prove the tap reaches it. `judge.legal` is driven, the
trainer is not. **A tap that does nothing is this project's worst failure
mode and only a phone finds it.**

After that, the card work left in `WEEK.md` item 2 is **Boltyn**, whose
attack-reaction ability refuses on its COST — a soul banish, a cost shape
nothing builds. That is a cost job, not a window one.

**DEPLOYED 2026-08-30 — `main` is at `07172a4` (v3.63).**

**THE LIVE CHECK IS PARTIAL, AND THAT IS STATED RATHER THAN GLOSSED.**
The session's egress policy denies `github.io` (403 on CONNECT), so the
URL could not be fetched from here. What WAS verified against the pushed
commit: all **21** `<script src="engine/…">` tags resolve to real files in
`origin/main`, `index.html` is present, and `.nojekyll` is there. That is
the subset that catches the "serves the page and 404s every script"
failure; **the actual 200s are still unconfirmed.** First person with a
browser should load the page and check the footer reads **v3.63**.

Both `text/babel` blocks were compiled with `@babel/standalone` installed
into a scratch directory — see CLAUDE.md, "THE COMPILE CHECK CAN BE RUN".
It takes a second and there is no longer a reason to skip it.

---

# Handoff — Dawnblade, at v3.59 · PHASE C · FAMILY-BY-FAMILY

## ⚠ WHERE THINGS STAND — v3.52 → v3.59 (2026-08-29)

**335 → 350 full · 59 → 43 `part`.** Seven releases, on the branch
`claude/dawnblade-weekly-plan-zg61nm`, each validated with `npm test` +
fairness + 210 self-play games (0 refusals, 0 invariant violations,
0 malformed feed throughout).

| ver | what, in one line |
|---|---|
| **3.53** | three `pick`-from-a-zone readers — **and the arsenal face-up put had never fired from `execute`** (queue site inside `if(attacking)`; all three cards that print one are non-attacks). `moveFoe` had carried `{from,to}` for three versions with a consumer that ignored both |
| **3.54** | **destroyed gear now goes to the graveyard** (RULING, user, 2026-08-29), then `retrieve` — settled by reading the SAR017 PRINTING: *"(Pay {r} to equip it.)"* |
| **3.55** | the **targeted counter put** (`ctrPut`); `gaps.js`'s family `needs:` lines corrected |
| **3.56** | the **boost-banish trigger** — a schedule that fires from the DECK, on a card its controller never played. Two of its own refusal probes were asking `classifyClause` about a reader that lives in `fxParse`, and passed against a sabotaged engine |
| **3.57** | the Illusionist `pitchBlue1` condition and a gated enters-with counter — **and a latent dropped gate `npm run fairness` structurally cannot see**: a condition that VANISHES leaves no unconditional twin for `COND-BYPASSED` to compare against |
| **3.58** | two readers that each replaced an **inline** one — a destroy trigger read by a private regex, and a weapon static with Mandible Claw special-cased BY NAME while two other cards printing the same shape were dead |
| **3.59** | **"Attack Reaction - …" was an unguarded activation prefix**, so Prey Spotters read `full` and could not be activated at all. Four cards report honestly now; the baseline was reviewed and repinned |

### THE NEXT JOB, SCOPED — the attack-reaction ability route

> **BUILT AT v3.63 — and step 2 below was WRONG, which is how the sev-3
> was found. Three of these five already HAD a route, at the wrong speed.
> Kept verbatim as the record of what was believed. See the v3.63 section
> at the top of this file.**

Five pool records print `Attack Reaction - <cost>: <effect>` and none has
a route. What it needs, all of it measured this session:

1. `parseHeroPower` to accept the prefix and return `kind:"attackRx"`;
2. `build.js`'s `_abLine` (it matches `action|instant` only) so a powCard
   is built at all;
3. a `_attackRx` flag on the powCard — `_instant` already shows the shape,
   and `judge.js`'s `playWindows`/`playWindowFor` are where it slots in;
4. `speedAllowed` already distinguishes `attack-reaction` (v2.27), so the
   window itself exists;
5. the payloads — *"target attack with <qualifier> gets go again"* — onto
   the open link via `effects.attackRx` (v3.11), which already does this
   for attack reaction CARDS;
6. the trainer's own offering path in `index.html`, which is the half no
   drill can validate. **This is why it was not built in v3.59.**

It closes Prey Spotters, Stalker's Steps, Bolt'n Boots, Danger Digits and
**Boltyn's hero ability**.

**THE METHOD FINDING, which is worth more than the thirteen cards:**
`npm run gaps` clusters by what a card's TEXT says, but its `needs:` line
is a CLAIM ABOUT MACHINERY. Re-measured against the parser, **two of five
families did not survive** — the *"you may"* family sets no `fx.optCost`
at all, and `defends` had been wired since v3.33 while `hits` has zero
pool cards. **Before building a family, ask the parser which records set
the field.** Two-minute script; it moved two of five. `WEEK.md` and
`tools/gaps.js` both now say what is actually left.

**DEPLOYED 2026-08-29 — `main` is at `b37d753`.** All seven versions
(v3.53–v3.59) are on `main`, fast-forwarded from the feature branch with
`origin/main` confirmed as an ancestor first, so nothing on the remote was
lost.

**THE LIVE CHECK IS PARTIAL, AND THAT IS STATED RATHER THAN GLOSSED.**
The session's egress policy denies `github.io`, so the URL itself could
not be fetched from here. What WAS verified against the pushed commit:
all **21** `<script src="engine/…">` tags resolve to real files in
`origin/main`, `index.html` is present, and `.nojekyll` is there (which
is what makes Pages serve the files as-is rather than running them
through Jekyll). That is the subset of the check that catches the
"serves the page and 404s every script" failure; **the actual 200s are
still unconfirmed.** First person with a browser should load the page and
check the footer reads **v3.59**.

**THE PHONE PASS IS STILL OWED, and it grew.** v3.42-v3.51 shipped on
drills and self-play; these three add prompt sheets that a player has to
TAP — the graveyard pick, the retrieve sheet, the counter-target sheet
and the arsenal put, which has *never once been offered in a real game
before now*. A tap that does nothing is this project's worst failure
mode and only a phone finds it.

---

# Handoff — Dawnblade, at v3.50 · PHASE C · THE TABLE HAS NOW BEEN PLAYED

> **EVERYTHING ABOVE v3.05 IN THE PROSE BELOW IS HISTORY.** This block and
> `FINISH.md` are current; where they disagree with the older sections,
> they win. The older sections are kept because each records a bug shape
> that can come back, not because their numbers are live.

## ⚠ READ `PLAYNOTES.md` FIRST — THE TABLE HAS NOW BEEN PLAYED

v3.49 added `npm run play`: `sparring.act` in **both** seats through
`judge.reduce`, invariants checked on every intermediate state. The first
run was **210 games, 0 policy refusals, 0 invariant violations, 0
malformed feed lines** — and **14 games that never ended**, which found a
bug 1488 drills had not (Knucklehead's intellect never settling back at
the table; fixed in v3.49).

**Two findings are OPEN and both are recorded rather than half-fixed:**

| | |
|---|---|
| ~~ally combat has no driver~~ | **FIXED at v3.50** — and giving it a driver immediately found **3761 `CARD-IN-TWO-ZONES` violations**: an attacking ally on the board AND in `chainCards`. Gravy Bones 5 → 19 wins. **Still open: nothing attacks an ALLY**, so Oysten's death trigger has no driver — the policy always names the hero (CR 1.4.5), which is a deliberate refusal to guess |
| **the policy cannot pilot a control hero** | Iyslander: **0 wins in 210 games**, and all 13 remaining stalls. Driven, she holds four LEGAL cards plus an action point and the policy proposes `endTurn` |

**The hero ladder in `PLAYNOTES.md` measures the POLICY, not the decks.**
Do not tune from it until the second finding is fixed.

## ✅ LIVE — v3.50 IS DEPLOYED (2026-08-28)

`main` is at **6ee5672** and GitHub Pages serves it at
https://dawnblade-ai.github.io/dawnblade-ai/ . Nine versions shipped in one
stretch, all of ally combat among them:

```
v3.42  Avast Ye!'s rider — gaNextQ had no field to carry one
v3.43  the two defects v3.42 left in the grant it had just reshaped
v3.44  ALLIES ATTACK — the parser had been ready for years, the ROUTE had not
v3.45  whose hit was it — 34 records fired hero-gated triggers off an ally hit
v3.46  the on-attack twin, and an ally that dies does what it prints
v3.47  untap — {u} refused correctly for years, then stopped being right
v3.48  a tapped hero, and the one thing it means (ruling, 2026-08-25)
v3.49  the rolled intellect settles back — FOUND BY PLAYING
v3.50  the seat learns to use its allies, and that found a two-zone bug
```

**THE ON-DEVICE PASS IS STILL OWED, and this is the record of it.** The
whole stretch was verified by drills and by `npm run play`; it has **not**
been played on a phone (CLAUDE.md's validation item 7). Ally combat is the
largest behaviour change here and the first thing to exercise: deploy a
Gravy Bones ally, tap it to swing, and watch the defend step, the action
point and the go again. **A tap that does nothing is the failure mode this
project cares most about**, and only a phone can find it.

**AND `curl` CANNOT REACH THE SITE FROM THE CLOUD SANDBOX** — the agent
proxy answers 403 to `dawnblade-ai.github.io:443`, so the HTTP half of the
ship check ("the URL returns 200 *and* so do all the engine scripts")
could not be run from here and was verified against the pushed TREE
instead: all 21 `<script src>` files are present in the deployed commit.
Run the real check from a machine that can reach it:

```sh
U=https://dawnblade-ai.github.io/dawnblade-ai
curl -s -o /dev/null -w "%{http_code} index\n" $U/
grep -o '<script src="engine/[a-z]*\.js"' index.html | sed 's/.*src="//;s/"//' \
  | while read f; do curl -s -o /dev/null -w "%{http_code} $f\n" $U/$f; done
```

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then **`FINISH.md`** — the blueprint to done —
> then `POLISH.md` for the shipping bar. Most entries in all three exist
> because breaking that rule cost a real bug.
>
> **The two engines are merged, the pool is PINNED, Phase B is DONE, and
> the card semantics run on both boards.** `npm test` is **1488 drills**
> and **0 skipped** (1505 at v3.50). Read the SKIP count, not just the fails — a fresh
> clone once skipped 304 drills silently, which is how 22 broken cards
> survived a green suite.
>
> Current at v3.48: coverage **335 full / 59 part / 11 none** (Oysten
> earned +1 at v3.46, Scuttle Toes +1 at v3.47 and Entangling Shot +1 at
> v3.48; v3.42-45 all fixed things no coverage tool can see), fairness
> **clean**,
> `tools/failstates.js` **0 UNFAIR**, `npm run crindex` **50 of 63 CR
> rules guarded** (the 3 UNGUARDED are section pointers).
>
> **YOUR JOB IS PHASE C — THE HEROES.** Kayo, Viserai, Bravo and
> **Iyslander** are complete (she finished at v3.37 — see below). **Briar is in progress**: her hero ability is BUILT (v3.21) and
> her 8 `part` cards are the remaining work — see below.
>
> ### v3.36 — IYSLANDER'S HERO ABILITY WAS HALF-BUILT, AND THIS FILE SAID SHE WAS DONE
>
> She was listed complete because her CARDS were. Her HERO was not:
> **clause 1 was trainer-only** and the table refused it by name —
> *"Aether Icevein is an action — it cannot be played during an
> instant-speed window"* — and **clause 2 was a closure in `Battle`**, so
> the table created no Frostbite when she played an Ice card on your turn.
> A hero is finished when the ABILITY runs on both boards, not when the
> deck parses. Check the other "complete" heroes against that bar.
>
> **The mechanic was worth more than the hero.** 14 pool records print
> "as though it were an instant" across three heroes and not one was read.
> `parser.playsAsInstant` is the one reader; see CLAUDE.md's "A SPEED
> GRANT IS A WINDOW, AND THE WINDOW PAYS THE COST".
>
> **STILL OPEN ON HER, and each is a recorded decision:**
>
> | card | why it stays |
> |---|---|
> | ~~Stir the Aetherwinds~~ | **BUILT at v3.37** — `instantNextQ`, the fourth qualified single-shot grant. Building it also found its amp landing on a card the line never named |
> | Snapback x3 (Blaze) | needs a CLASS-AWARE turn history — `hist` counts non-attacks and records no class. **BUILT at v3.38** (`hist.playTy`) |
> | Ice Eternal | X-cost + Ice Fusion. Unchanged, still honestly refused |
>
> **A MANUAL PRE-SHIP STEP EXISTS NOW.** Compile both `text/babel` blocks
> with `@babel/standalone` after any `index.html` edit — bracket balance
> is not a parse, and v2.27 shipped a page that was balanced and broken.
> Deliberately not a drill: no dependencies, so a fresh clone stays green.

> ### v3.37 — IYSLANDER IS FINISHED: 29 of 30 cards, one written refusal
>
> **Ice Eternal** is the only card left and it is a recorded decision, not
> work: the pool's only X-cost card. Her hero ability runs on both boards
> (v3.36), her deck resolves, and that is the bar — **a hero is finished
> when the ABILITY runs on both boards and every card is either built or
> has a written reason.**
>
> **The next heroes are the eight untouched ones.** Leave Arakni last
> (stealth-as-qualifier is filed `noop` by ruling). Blaze is the cheapest
> next step, because v3.36/v3.37 already built two of the three things his
> deck wants: his Cindering Foresight is `full`, and **Snapback** is the
> one remaining shape — it needs a CLASS-AWARE TURN HISTORY, which would
> **NOT** unblock Quick Clicks: Nimblism is a card NAME, not a type, so
> that one needs a name history (the non-attack twin of `hist.atkNames`)
> and `hist.playTy` cannot answer it. The v3.38 note claiming otherwise was
> wrong and is corrected in CLAUDE.md.

> ### v3.38 — BLAZE: his DECK is 22 of 23, and his HERO is entirely unbuilt
>
> Same shape as Iyslander: the cards are nearly done and the hero is the
> work. **Neither of his clauses exists** — no build passive, no
> `HERO_STATICS` entry, so the audit reports all three of his hero-text
> clauses unrecognised, honestly.
>
> ```
> Whenever you opt, put energy counters on Blaze equal to the number of
> cards looked at this way.
> Once per Turn Instant - Remove X energy counters from Blaze: Banish a
> Wizard non-attack action card from your hand with an effect that deals
> arcane damage equal to X. You may play it this turn as though it were
> an instant.
> ```
>
> **BOTH CLAUSES OR NEITHER.** Clause 1 was written in this cycle and
> deliberately REVERTED: energy counters that nothing can spend are
> v2.74's Frostbite bug exactly — a number on the hero row and no rule.
> Clause 2 is what spends them.
>
> **What clause 2 needs, and every piece has precedent:**
>
> | piece | precedent |
> |---|---|
> | `parseHeroPower` accepting a "remove N counters" cost | it refuses one today BY DESIGN ("never parse ahead of wiring") — relax it only once the route exists |
> | a `pick` over the hand with an arcane-amount filter | `promptFilter` reads printed FIELDS; this is a PARSED fact (`fxParse(c).ops`), so it is a deliberate, documented extension |
> | X coupled to the chosen card | the player picks the card, X is that card's arcane, the cost is X counters — so X is not a free variable and needs no X-cost machinery |
> | the dynamic bound (arcane <= counters held) | supplied at the QUEUE SITE, exactly as `notUid` is for `notSelf` (v3.20) |
> | banish + "playable this turn" | Crouching Tiger's `_playTurn`, already honoured by `playableFromZone` |
> | "as though it were an instant" | `playsAsInstant` (v3.36) — this would be a FIFTH printed source for the one reader |
>
> **`CARD_OVERRIDES` IS STILL EMPTY** and should stay that way if the
> generic route can take this. It was weighed for Blaze and declined: the
> only genuinely non-generic part is X binding the cost to the card's
> parsed effect, and the queue-site pattern covers it.
>
> **His other two `part` cards:** Arcane Polarity needs "if you have been
> DEALT arcane damage this turn" (`hist.arc` records arcane DEALT BY you,
> v3.28 — this is the other direction and is a new field); Turn to
> Mindfire needed a tapped HERO as a state, which **v3.48 built**, and
> still needs the `hits` optional-cost trigger and a Ponder token.

> ### v3.48 — A TAPPED HERO, AND THE ONE THING IT MEANS
>
> **RULING (user, 2026-08-25): a tapped hero "cannot be tapped again to
> pay a cost", and is otherwise largely unaffected.** So `heroTapped` gates
> exactly that. Three of fifteen pool heroes print a `{t}` cost, so for the
> other twelve the tap is a correctly-read no-op and the feed says so.
> **When a ruling tells you a mechanic mostly does nothing, build the
> nothing** — inventing a penalty is the golden rule broken at the keyword
> level.
>
> It is a **different record** from `weaponUsed["hpow"]`: an allowance
> comes back at every turn boundary for both seats, a TAP waits for the
> controller's untap step (CR 4.4.3d). They come apart the moment an
> OPPONENT taps you, which is the whole of what the two cards do.
>
> **Two things found on the way, and both are shapes CLAUDE.md already
> names:**
>
> - **`tapsToActivate` split `clean(tx)`**, and `clean` collapses the very
>   newlines the split depends on — so it only ever matched a card whose
>   activated ability is its FIRST printed line. **Lyath Goldmane** and
>   **Concealed Object** were filing a TAP as a per-turn allowance.
> - **The audit's blanket `{t}` flag was wrong about 14 of 17 cards.** A
>   tap is charged by the **ROUTE**, so `noop` is correct for an activation
>   line and only a `skip` means nothing enforces it. Flagged cards 65 →
>   54. `tools/ledger.js`'s `{t}` and `{u}` entries both still said "not
>   parsed"; `failstates.js` grades severity against that STATUS, so a
>   stale `pending` is load-bearing, not prose.

> ### START HERE — the things a new thread should pick up
>
> **1. ~~ALLY COMBAT~~ COMPLETE (v3.44-47).** Allies attack (v3.44), an
> attack on one decides which triggers fire (v3.45), and an ally that dies
> does what it prints (v3.46). Along the way: 34 records were firing
> hero-gated on-HIT triggers off an ally hit, 4 more were firing
> hero-gated on-ATTACK triggers, the clause splitter was cutting inside
> quoted granted abilities, and Oysten's Gold was going to whoever killed
> it. See CLAUDE.md's four sections from "AN ALLY IS A PERMANENT THAT
> ATTACKS" through "AN ALLY THAT DIES DOES WHAT IT PRINTS".
>
> **1b. A PLANNED JOB WAS DELETED, NOT DONE.** "The trainer cannot choose
> an attack-target" sat on this list for three versions. Measured: the
> trainer's opponent is `DUMMY_DECK` — 12 vanilla attacks, NO allies — and
> its swing is the `[3,4,5]` fabrication with no target choice. It can
> never field an ally against you nor attack one of yours, so a picker
> there is dead code and `heroHit: total > 0` is complete for that board.
> **Measure a list item before building it.**
>
> **1c. STILL OPEN, and each has a written reason:**
>
> | card | what it needs |
> |---|---|
> | Cutty Shark's SECOND ability | reads perfectly (`buffNext 1 {g:[["ally"]]}` — an ally-attack buff, and ally attacks now exist) and has NO ROUTE: an ally with two activated abilities cannot be told apart by uid alone. `boardPow` returns null for allies and judge's arena branch only does `allyAttack`. The `"bp"+uid` powCard pattern is the seam |
> | Mournful Casket, Basalt Boots | the AT-REST display pass — a defensive buff true while sitting on the board would put a number on screen that disagrees with the number that blocked (v3.27's boundary) |
> | Silent Stilettos | a death trigger for the CONTROLLER's own attacking ally, plus an "if you do" payload — the family this project does not read |
> | Jack Be Quick | `{u}` an OPPOSING ally and STEAL it — a control change nothing models. Still flagged by the audit, honestly |
> | Carrion Crown | "Discard an ally" as a COST — the optional-cost family reads zones, not board entries |
> | ~~Entangling Shot, Drop the Anchor~~ | **BUILT at v3.48** off the RULING (user, 2026-08-25). Entangling Shot went `none` → `full`; Drop the Anchor's rider left `quotedUnread`. See below |
> | Goldkiss Rum | still open, and **unreachable**: nothing in the pool creates the token. Its `{t} your hero` is an activation COST rather than a payload, which is the one shape the v3.48 reader does not cover |
>
> **1d. FOUND, RECORDED, NOT FIXED — Cosmo is routed as a swinging
> weapon.** Unchanged from v3.44; `parser.allyAttack` guards `power > 0`,
> judge's weapon branch does not.
>
> **2. Turn to Mindfire — the last card on Blaze, and now HALF built.**
> Of the four pieces, **v3.48 supplied two**: a tapped HERO is a real state
> (`heroTapped`) and `{t} your hero` reads as `tapSelfHero`. What is left
> is the `hits` optional-cost trigger (unwired since v3.20) and the
> **Ponder token**, whose printed text nothing has looked at. Full
> write-up in the v3.40 CHANGELOG entry. **It would be free in this pool
> and that is not a reason to fake it.**
>
> **3. The remaining heroes — and LYATH IS NOW THE OBVIOUS NEXT ONE.**
> Dash, Azalea, Fai, Enigma, Boltyn, Gravy Bones, Lyath, and Briar's 8
> `part` cards. Three separate versions have converged on Lyath without
> anyone aiming at him:
>
> | | |
> |---|---|
> | v3.39 | un-truncated his hero powCard, so his **second sentence** ("Defending action cards you control get +1{d} this turn") reaches `fxParse` at all |
> | v3.48 | fixed `tapsToActivate`, which had been answering FALSE for him — his ability sits under his halving static — so his `{t}` cost is now charged and lifted at the right boundary |
> | v3.23 | `fx.defGrant` is the shape that second sentence wants; it needs a READER, not new machinery |
>
> **Measured at v3.48, so nobody has to re-derive it.** `AUDIT.md` names
> both of his remaining hero clauses by name, and his build carries
> `lyathBoo` alone:
>
> ```
> HPOW ops:  [["boo",1]]
> clauses:   run[The crowd boos you]
>            skip[Defending action cards you control get +1{d} this turn.]
> AUDIT.md:  ⚠ unrecognized: "The base {p} and {d} of cards you control are halved, rounded up."
>            ⚠ unrecognized: "Defending action cards you control get +1{d} this turn."
> ```
>
> **The halving static is the hero's ONE mechanic** and it is worth reading
> before any of his cards — the Kayo method, whose clause 2 was worth half
> that deck. Note that halving a BASE value is a stronger claim than a
> buff: it has to reach `zonePow`/`gearDef` and every display that reads
> them, or the number on screen disagrees with the number that fought,
> which is v3.23's sev-2 boundary. **Do not half-build it.**
>
> Leave **Arakni** last (stealth-as-qualifier is filed `noop` by ruling).
>
> **4. Read the method before the cards.** `CLAUDE.md` is long because
> every section is a bug that shipped. The four that pay off most often:
> *find the hero's ONE mechanic first*; *a hero ability is finished when it
> runs on BOTH boards*; *sabotage every new drill, and sabotage the guard
> too*; and *when you close a recorded gap, delete the record of it*
> (v3.41 — three stale claims, one of them hiding a real gap).
>
> ### THE SHIPPING LOOP, as actually run this cycle
>
> ```
> npm test                      # 1488 drills · 0 fail · 0 SKIPPED (read the skip count)
> npm run fairness              # must say "Nothing found"
> node tools/failstates.js      # UNFAIR must be 0
> npm run audit                 # read the diff card by card, never the totals
> node tools/audit.js --write-baseline    # only after reviewing that diff
> <babel compile check>         # MANUAL — see below; brackets balancing is not a parse
> # bump APP_VER · CHANGELOG entry · CLAUDE.md lesson · this file
> git push origin main          # that IS the deploy
> ```
>
> **`npm run audit` REWRITES ITS ARTIFACTS EVERY RUN.** `AUDIT.md` and
> `tools/audit.json` carry a `generated` timestamp, so running the audit as
> a final *check* — after committing — leaves the tree dirty with a
> timestamp-only diff and nothing else. Confirm with `git diff` that the
> only change is that line, then `git checkout` the two files rather than
> committing the churn. Run the audit BEFORE you commit, not after.
>
> **The babel check is not a drill and cannot become one** — the project has
> no dependencies and `npm test` must stay green on a fresh clone with no
> `npm install`. Run it in a scratch dir after any `index.html` edit:
>
> ```js
> const Babel = require("@babel/standalone");   // npm i --no-save in /tmp
> for(const [,code] of html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g))
>   Babel.transform(code, {presets:["react"], sourceType:"script"});
> ```
>
> **Verifying the deploy from a sandbox:** the Pages URL is often blocked by
> the agent proxy (403 on CONNECT). Check the `pages build and deployment`
> workflow run for your commit SHA through the GitHub tools instead, and say
> plainly that the live URL was not fetched.

> ### v3.39 — BLAZE'S HERO IS BUILT; his deck has two cards left
>
> Both clauses run on both boards, the ledger knows about all three of his
> printed sentences, and the energy pool is on screen. **X needed no
> X-cost machinery** — see CLAUDE.md, "A COST COUPLED TO THE CHOICE".
>
> **Arcane Polarity was built at v3.40** (`hist.arcTaken` — see CLAUDE.md,
> "TWO DIRECTIONS OF ONE EVENT ARE TWO RECORDS"). **Turn to Mindfire is
> the one card left, and it is THE NEXT THING TO BUILD** — its four pieces
> are written up in the v3.40 CHANGELOG entry, and three of them are
> general rather than his:
>
> | piece | state |
> |---|---|
> | the `hits` trigger for an optional cost | `optCost` is wired for `attacks`, `play` and `entersLeaves` only. v3.20 named `hits` as outstanding and it still is |
> | a TAP as an optional-cost KIND | the kinds are banish / discard / destroy / reveal. A tap is none of them |
> | a tapped **HERO** as a state | taps are per-permanent by uid through `weaponUsed`, and `perTurnCleared` looks the uid up in `sd.gear`. `weaponUsed["hpow"]` means *the ability was used*, which is a DIFFERENT fact — tapping Blaze's hero must not lock an ability that costs counters rather than `{t}` |
> | the Ponder token | trivial once the rest exists — a real database record whose `sd:"end"` text the existing reader already handles |
>
> **It would be free in this pool, and that is not a reason to fake it.**
> Turn to Mindfire is a Wizard card, so only Blaze and Iyslander can deck
> it and neither hero's ability costs `{t}` — so the tap costs them nothing
> observable. Building it as "the tap is free" is a fact about this pool
> rather than about the rules, which is the shape v2.74 removed from
> Frostbite.
>
> **Also recorded, and not his:** the hero-powCard truncation fix
> un-truncated **Lyath Goldmane's** ability, whose second sentence
> ("Defending action cards you control get +1{d} this turn") still has no
> reader. It is close to `fx.defGrant` (v3.23) — "non-attack action cards
> you control get +1{d} while defending" — so it is a READER, not new
> machinery, and it is the cheapest thing left on Lyath.
>
> **Remaining untouched heroes:** Dash, Azalea, Fai, Enigma, Boltyn, Gravy
> Bones, Lyath, and Briar's 8 `part` cards. Leave **Arakni** last
> (stealth-as-qualifier is filed `noop` by ruling).

> ### Viserai — DONE at v3.20
>
> **Sigil of Silphidae is built** (`notSelf` + `notUid`, and the
> enters/leaves trigger on both boards — see CLAUDE.md and the v3.20
> changelog). The remaining two are **recorded decisions, not work**, the
> same way Iyslander ends with two `part` cards:
>
> | card | why it stays |
> |---|---|
> | Beckoning Haunt | X-cost. Building it is a decision about X, not about this card — see Ice Eternal in `CLAUDE.md`. |
> | Crown of Dichotomy | a two-target ability with no reader. Recorded unread rather than guessed. |
>
> **A hero is finished when every card is either built or has a written
> reason.** Viserai: 30 full / 2 part / 0 none.
>
> ### The open question from v3.19 is CLOSED — answered from the data
>
> `2|Sigil of Suffering|0|` needed no trip to fabrary. The database
> settles it: pitch 1 is printed in **SVI019** and **SBA023** — Viserai's
> and Briar's own Silver Age sets — while pitch 2 and 3 exist only in
> ELE, which neither precon draws from. The resolver already picks 1.
>
> **And the claim that no drill catches it was wrong.** v3.14's oracle
> does: sabotaged to resolve the highest pitch, `decks.test.js` names both
> decks and both sets. Verified, then restored. Nothing to change.
>
> *The lesson, since it is the second time: try the data before booking a
> question. Card images and printing records are the printed product.*
>
> ### BRIAR — the ability is built, the deck is not
>
> **Her ONE mechanic is the Embodiments**, and both clauses of "Essence of
> Earth and Lightning" mint one. Both are now live on both boards, the
> tokens are in the pinned pool, and each carries its own printed destroy
> clock. What is left is her deck and the tokens' OWN text:
>
> | what | note |
> |---|---|
> | ~~Embodiment of Lightning's trigger~~ | **DONE at v3.22** — one reader, one pop site, four tokens (Runechant, Courage, Quicken, the Embodiment). The weapon half of the trigger is carried, so the Embodiment does not pop on a weapon swing. |
> | ~~Embodiment of Earth's buff~~ | **DONE at v3.23** — `effects.defendValue` is the one body and both walls ask it. It exposed a 23-card family below. |
> | her 8 `part` cards | fusion/meld (`Arcane Seeds // Life`, `Burn Up // Shock`, and Weave Lightning's *"if it's fused"*), turn-history predicates over card CLASS (Star Fall's *"played a Lightning card this turn"*, Arcane Polarity's *"been dealt arcane damage this turn"*), and Jack Be Quick's steal. |
>
> **Both tokens are currently inert and that is honest, not a gap.** Earth
> sits on the board doing nothing but counting as an aura (which is
> correct — seven pool cards count auras); Lightning does nothing yet.
> Neither is stronger than printed, which is the direction that matters.
>
> ### v3.35 — THE SPLIT-CARD DIVE, AND ONE GAP LEFT
>
> A player report ("making me pitch for burn up shock", cost 0) found the
> table demuxing `pending` by BLACKLIST — every kind that was not `boost`
> rendered as a PAYMENT, so the declaration opened a pitch sheet whose
> only exit was Cancel. `judge.PENDING_KINDS` is the census now.
>
> The dive also found the INSTANT half unplayable at instant speed. The
> DECLARED HALF decides the window now (union before you choose, that
> half's after, ACTION for meld), which reopens the printed line without
> reopening v2.39's free action point.
>
> **STILL OPEN — the trainer's reaction window.** `Shock` and `Life` can be
> played at instant speed at the TABLE and not in the trainer, because
> everything played through `playRx` is filed as a DEFENDER (`blockRx`) —
> right for a defence reaction, wrong for a plain instant. Untangling that
> is its own change; the refusal names the real reason meanwhile. This is
> the one place the two boards disagree about a split card.
>
> ### SPLIT CARDS ARE BUILT (v3.34) — and were playing themselves
>
> The two horizontal cards print **Meld (You may play 1 or both halves of
> this card. Each costs 0.)** and the engine ran BOTH halves, always,
> asking nothing — Burn Up // Shock dealt **five arcane on play** where its
> top half is a *delayed* four. It is **one card**: one pitch, one defence,
> one card in hand and in the graveyard; only the textbox is doubled.
>
> `played_horizontally` names them (the DB's own flag), `tt` tells the
> halves apart (`ty` flattens both faces), each half reads its OWN
> keywords, and the declaration is asked before the payment because
> melding doubles the base cost. Default is the LEFT half, never both.
>
> **Still an approximation, and stated:** the CR gives priority between a
> melded card's two sides; this runs them in printed order as one layer.
> Both pool cards' halves are independent so nothing is observable —
> revisit if a split card ever prints halves that interact.
>
> ### v3.31 — 13 CARDS WERE PUMPING WHATEVER WAS SWINGING
>
> `attackQual` read the words BEFORE "attack" and `[^.]*` ate the rest, so
> "target attack action card **with cost 1 or less**" restricted nothing.
> All 13 read `tier: full`. The qualifier is one object now
> (`{g, aac, nonAtk, kw, costLe, costGe, powLe, powGe, from, boosted}`),
> `qualMatches` is the one matcher and `qualLabel` the one namer, and an
> unreadable tail REFUSES the clause rather than matching anything.
>
> **Two things worth carrying forward.** "non-attack" contains "attack",
> which handed Mage Master Boots' go again to the next attack — v2.44's
> trap on the keyword that keeps your action point. And a drill was
> **passing because of the bug**: `reactions.test.js` used Stains of the
> Redback as its "no qualifier" fixture, which was only true while the
> restriction was being dropped. When a fix breaks a drill, read the
> FIXTURE before reshaping the assertion.
>
> ### STILL OPEN IN THIS FAMILY
>
> | card | what it needs |
> |---|---|
> | Night's Embrace | "your attacks with stealth get +1{p} **this turn**" — a turn-wide qualified buff, not a next-attack one. `gaNextQ`/`buffQ` are both single-shot. Its ruling is recorded. |
> | Mage Master Boots · Stalker's Steps | the clause sits behind an activation cost, so it goes to the equipment reader and is filed a noop. Both carry the audit's "no parsed grant path" flag. |
>
> ### BRAVO — five gaps, and each is a named mechanism
>
> | card | what it needs |
> |---|---|
> | Thunder Quake | **DONE at v3.32.** Built from the card's PRINTED reminder text, which the database does not carry and which is more precise than the July ruling — an empty-arsenal gate and a FACE-UP put, and it performs the arsenal action rather than replacing it. |
> | Crash and Bash | **DONE at v3.33** — a reveal is a cost that moves nothing, "with crush" is a printed field, and the `defends` trigger fires from `afterDefenders`. |
> | Magmatic Carapace | **DONE at v3.33** — the {t} is part of the pay-cost, and `playAura` fires in `execute` off the actor's GEAR as well as the board. |
> | Pummel | **DONE at v3.31** — its second mode is selectable now that the cost restriction can be read. |
>
> **AND SEISMIC SURGE IS DONE (v3.32)**, which was the real keystone: four
> of his cards create it, a fifth reads it, and it was `tier: none` on
> purpose because `selfDestruct … then X` refuses when X has no reader.
> Its payout is `costOff`, the third qualified single-shot grant beside
> `buffQ` and `gaNextQ`. The token has a clock now, so it stops inflating
> every "auras you control" count.
>
> **BRAVO'S ONE MECHANIC IS THE ARSENAL** — his hero ability turns a
> face-down arsenal card face up and rewards crush, and heave puts one
> there face up. His remaining two cards (Crash and Bash, Magmatic
> Carapace) both mint Seismic Surge, so they are now readers rather than
> new machinery.
> | Staunch Response | **DONE at v3.34** — an optional additional cost, asked before the card resolves (boost's precedent), with the rider reading `opts.addPaid` because the answer belongs to the PLAY. |
>
> ### THE FIVE CRUSH RIDERS — four built, one refusing
>
> `nextTurn` on the side (v3.29) is the schedule; v3.30 built the two
> RESTRICTIONS on it. **A restriction is not a debuff**, and the drills
> assert the difference off the printed words: a debuff carries an amount
> and is spent by the FIRST thing it touches (*"their first attack"*); a
> restriction carries none and is **never spent** (*"during their next
> action phase"*).
>
> | card | shape |
> |---|---|
> | Debilitate | debuff — first attack, -2{p} |
> | Cartilage Crush | debuff — first action, +{r} |
> | Chokeslam | restriction — CAPS an attack action card at printed {p}, never subtracts |
> | Crush the Weak | restriction — refuses the PLAY, before the card leaves the hand |
> | **Walk in My Shoes** | **still refuses** — halving base {p} AND {d} for a turn is neither a cap nor a gate |
>
> **Two lessons worth carrying.** The cap is applied at declaration AND in
> `linkPumps` (which re-adds reaction layers afterwards) — dropping either
> failed no drill until the sabotage pass. And `nextTurnBars` reads
> `isAtkActionCard`, never `isAttack`: **"Reaction" contains "action"**,
> so a `tt` predicate bars an attack reaction the card never names.
>
> ### v3.25 FOUND SOMETHING BIGGER UNDERNEATH THAT FAMILY
>
> **Every defence reaction in the pool blocked for zero at the table** —
> 15 cards, 39 copies, 11 of 15 heroes. `blockRx` was a field judge
> cleared and never wrote or read. Fixed and driven.
>
> **The lesson to carry:** the field existed and the clear existed, which
> made the plumbing look finished. When you find a side field, check both
> halves — who writes it and who reads it — not just that it is there.
>
> ### THE DEFENSIVE SELF-BUFF FAMILY — 13 built, 10 left
>
> Finishing Earth exposed it. The pool prints a whole family of *"this
> gets +N{d}"* defensive buffs and **not one is applied**, because both
> walls read the printed number:
>
> ```
> Blade Beckoner Boots/Gauntlets/Helm/Plating   DONE v3.24
> Wax On (x3)                                   +2{d} vs a cost-0 attack action
> Sigil of Suffering (x3)                       +1{d} if arcane dealt this turn
> Big Blue Sky                                  +1{d} per blue pitched this turn
> Gauntlets/Helm of Unity                       DONE v3.27
> Springboard Somersault · Unmovable            DONE v3.27 (from arsenal)
> Basalt Boots · Mournful Casket    AT-REST conditions — true sitting on the
>                                   board, so the wall alone puts a wrong
>                                   number on screen. Needs a display pass.
> Stonewall Impasse                 clash on defend
> Washed Up Wave                    a choice, plus watery grave
> Rally the Coast Guard · Staunch Response      paid
> ```
>
> **Most read `tier: full`** — the clause is consumed, the buff never
> reaches a wall — and every one is WEAKER than printed, so the one-sided
> fairness sweep is blind to them too.
>
> `defendValue` is where they go, so each is a READER rather than new
> machinery, and it now takes `{base, weaponAttack}` from the caller.
>
> **The gearDef trap turned out not to bite for Blade Beckoner**, and the
> reasoning is worth keeping: its condition is a property of the INCOMING
> attack, so out of combat there is no buffed number to display and the
> base shown on screen is correct. A buff gated on something knowable at
> rest — Basalt Boots' Seismic Surge token, Mournful Casket's graveyard —
> WOULD show wrong, so for those, do `gearDef` and the wall together.
>
> **Wax On is a DEFENCE REACTION**, played rather than declared, so it
> takes a third path through the wall — not the declared-defender loop.
> The rest gate on turn history, board state or a paid cost.
>
> ### NEXT — eleven heroes after her
>
> The user's own heuristic, and the data backs it: **a hero sharing a class
> with a finished one transfers the most work.** Blaze is `Wizard` like
> Iyslander; Boltyn is `Light/Warrior` like Dorinthea; Briar was
> `Elemental/Runeblade` — Viserai's class and Iyslander's talent, which is
> why she went first. **Leave Arakni last** — stealth-as-qualifier is filed
> `noop` by ruling, so his number is the least honest in the pool.
>
> ### The method, in one line each
>
> - **Find the hero's ONE mechanic first**, and **read the hero ability
>   before the cards** — Kayo's clause 2 was worth half his deck.
> - **Every bug this phase found reported `tier: full`.** They were read,
>   and read wrong. Coverage counts consumption, not faithfulness.
> - **Sabotage every new drill, and verify the sabotage changed the file.**
>   A sabotage that silently fails to apply is a false green.
> - **Assert on hands, life and zones — never on `feed` prose.**
> - **Build to print, or refuse.** Inert is honest; above-rate steals games.
> - Ship the loop: build → drive → drill → sabotage → `npm test` →
>   `npm run fairness` → `npm run audit` → bump `APP_VER` → `CHANGELOG.md`
>   → `CLAUDE.md` → push to `main`, which IS the deploy.
>
> ### Two recurring shapes worth holding in mind
>
> **A rule that exists on ONE BOARD ONLY.** v3.17 found three at once, all
> in the trainer and none at the table. `effects.beginEndPhase` is the
> pattern to copy: one pure, seat-relative body, both boards calling it and
> restating nothing. A comment saying "the order here matches the other
> board's" is not a mechanism.
>
> **A guard aimed at the wrong file, shape, scope or slice** — it passes by
> finding nothing. `failstates.js` scanned a file the semantics had left;
> the `makeEffects` guard excluded the only call form anyone writes; a rust
> guard tripped on Valiant Th*rust*. Sabotage the guard, not just the code.

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
