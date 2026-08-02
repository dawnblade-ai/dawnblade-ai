# Dawnblade — changelog

Extracted from the `APP_VER` comment in `index.html` at v2.32, where 19
versions of prose had accumulated on a single 14,723-character line that
shipped to every player on every page load. `index.html` now carries the
version and a one-line summary; the history lives here.

Newest first. `APP_VER` bumps by 0.01 per release (see CLAUDE.md).

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

