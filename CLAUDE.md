# Dawnblade — Flesh and Blood AI Training Sim

A single-file browser game: a Flesh and Blood sparring simulator where the player
pilots a real hero deck against an iron-armored training dummy, with an AI advisor
("Claude's call") reading the board.

**Live at:** dawnblade-ai.github.io (GitHub Pages)
**Current version:** v2.26

---

## The one hard constraint

**No build step. Ever.** No bundler, no ES modules, no framework CLI, no
`package.json` build. The site is served directly by GitHub Pages and opened on an
iPhone; React and Babel come from CDN `<script>` tags. Everything must run exactly
as authored, including from `file://`.

**What ships is `index.html` + `engine/*.js`** (changed in v2.20 — before that it
was literally one file). The engine modules are plain UMD scripts loaded with
ordinary `<script src>` tags, which is *not* a build step and costs nothing at
runtime. What it buys is that a shared function exists **once**. Until v2.20 every
shared function was hand-copied into `index.html` and a test kept the two copies
textually identical; that guard caught real drift (`boardRed`) but the duplication
was a permanent tax on every engine change, and it silently missed anything nobody
remembered to list (`makeSide`, `freshHist`).

Load order (`parser.js` must precede `advisor` / `cards` / `prompts`, which take it
as their factory argument), then a small plain-JS **bridge** lifts the engine's
exports into the bare names the babel blocks call. `test/sync.test.js` guards all
of this — see "The no-mirror rule" below.

File structure inside `index.html`:
- one `<style>` block (single `</style>` — CSS is appended before it)
- a plain data `<script>` — CDN paths, `APP_VER`, `DATA_VER`, `HEROES`, `DECKS`, etc.
- the `engine/*.js` `<script src>` tags + the bridge (plain JS, **not** `text/babel`,
  so there is no ambiguity about scope — it declares real globals with `var`)
- `script0` (`text/babel`) — loader, card resolver, UI shell
- `script1` (`text/babel`) — trainer: Ticker, ChainLink, CardFrame, Battle, WinPanel,
  Loadout, Pregame, App

Both babel blocks are compiled as *scripts*, not modules, so their top-level `const`
becomes a global `var` — which is how `script1` sees names declared in `script0` and
in the bridge. Do not "fix" this into modules; it is load-bearing.

---

## Card data — the golden rule

**Never invent or hardcode card effects.** Card text streams at runtime from the
public Flesh and Blood card database and is parsed by `classifyClause` / `fxParse`.
If a card does something new, the fix is *always* to teach the parser to read its
text — never to special-case the card by name.

- `DATA_VER` (e.g. `"sage-v6"`) keys the localStorage cache. **Bump it whenever the
  loader's schema or card-field handling changes**, or users will run on stale data.
- Printed keywords (`card_keywords`) and *granted* keywords (`granted_keywords`) must
  stay separate. Merging them caused the Kayo bug: conditional go-again was granted
  unconditionally.

---

## Versioning & release

- `APP_VER` bumps by 0.01 per release. It is displayed in-game.
- **v2.0x line starts at v2.01** (2026-07-22): marks the engine/ extraction +
  pool audit system. Below 2.0 = single-file-only history; 2.0+ = engine/ and
  index.html co-exist under the sync-guard rule (see below).
- After any change: validate (below), then the file is uploaded/pushed to the Pages repo.
- Keep a one-line summary of what each version changed.

---

## Validation — run before every ship

Fast path, no network, run on every change:
```
npm test
```
This is `node --test "test/*.test.js"` — currently 326 drills:
1. **Bracket balance** on both `text/babel` blocks (`test/html-balance.test.js`).
   String- and template-literal-aware, not regex-literal-aware — the three
   regexes with apostrophes are pre-neutralized inside the checker.
2. **Deck integrity** (`test/decks.test.js`): exactly 15 decks, each deck +
   gear summing to exactly 55 cards.
3. **Parser/game/advisor drills** (`test/parser.test.js`, `game.test.js`,
   `advisor.test.js`): `weaponCost`, `classifyClause` conditionals, the `{p}`
   pump parser, the Kayo printed-vs-granted regression, equipment wear, the
   fxParse memo gotcha.
4. **No-mirror guard** (`test/sync.test.js`): every engine module is loaded,
   `parser.js` loads before its dependents, the bridge lifts every name the
   trainer calls bare, and — the real check — **no engine export is re-declared
   inside `index.html`**, which would silently shadow the module. It also pins
   the engine/trainer **name collisions** (`endTurn`, `other` — `you` was
   retired in v2.24); see "The no-mirror rule" below.
5. **Multiplayer groundwork** (`test/sides.test.js`, `test/priority.test.js`,
   `test/rps.test.js`) — see "The two-player migration" below.
   **`test/actor.test.js`** is the actor/perspective ledger: it fails if a
   MIGRATED rules function still reaches for `you(`/`opp(`, and if a PENDING
   one has quietly stopped — see "ACTOR vs PERSPECTIVE" below.
6. **Marker sweep** — grep for the new identifiers to confirm every edit landed.

Slower path, needs network the first time, run before shipping any card-text
or parser change:
```
npm run audit          # regenerate AUDIT.md — read it, look for new gaps/flags
node tools/audit.js --write-baseline   # only once you've reviewed the diff —
                                        # repins the coverage floor so future
                                        # runs fail if a card's tier regresses
```
`test/coverage.test.js` then checks every pool card still resolves and no
card's `fxParse` tier dropped below the pinned baseline (skips cleanly if
`tools/.cache/card.json` / `tools/coverage-baseline.json` aren't present).

### The stack — what the pool is still waiting on

```
npm run stack                       # ranked list + STACK.md + tools/review.html
npm run stack <slug>                # dossier: every card, verbatim text, unread clauses
npm run stack explain <slug> "..."  # record a ruling -> tools/rulings.json
npm run stack done                  # everything answered so far
npm run stack --html                # regenerate the review station only
```

**`tools/review.html` is the review station** — the card-by-card way to work the
stack. Open it with a double-click (`open tools/review.html`); it is a single
self-contained page with the stack data inlined, so it needs no server and works
offline. One entry per screen: real card art from the printing URLs, verbatim
rules text, the unread clauses called out in red, and a text box for the ruling.
`tools/rulings.json` holds the answers (84 recorded 2026-07-25, including 6 follow-up answers). Each ruling is a
**spec**, not a patch: the ledger row for a ruled mechanic is annotated
`RULED <date> (spec in tools/rulings.json)` so the gap between "understood" and
"built" stays visible. Built out of that batch: tokens, opt, mark, aim counters,
stealth-as-qualifier, and the arsenal / life-race / Draconic-chain-link conditions.
Also built from the late batch: reveal-and-shift (Ravenous Rabble), the d6
intellect swing (Knucklehead), and printed defender limits (Put in Context).
**The prompt UI those were waiting on now exists (v2.17)** — see "Wiring a
ruling to a prompt" below. Fusion reveals, meld, retrieve, reload, graveyard
picks and Look Tuff's pay-or-shrink are no longer blocked on machinery; each is
now a spec object plus whatever parser work its card text needs. Still genuinely
open: Hope Merchant's Hood's shuffle-and-redraw and Quick Clicks' "played a
Nimblism this turn" macro, which need deck manipulation and a turn-history
predicate rather than a choice.

### Fail states — how cards go WRONG at the table (v2.21)

```
node tools/failstates.js     # ranked report
npm run sweep                # feeds section 4 of SWEEP.md + tools/sweep.html
```

The audit answers a **coverage** question: how much of this card's text does the
parser read? That is right for building the parser and wrong for judging a game.
A card can be 90% read and still hand a player a win they did not earn.
`tools/failstates.js` asks the judge's question instead — *if this card is played
tonight, what happens that should not?* — and ranks by damage to a game judged at
pro-tour standards, which is a **different order** from "most unread text":

| sev | category | why it ranks there |
|---|---|---|
| 3 | illegal play allowed · drawback skipped · **keyword filed as no-op but is a drawback** | the player wins games they should lose; the sim teaches wrong play |
| 2 | displayed total is wrong · no schedule to fire on | insidious — the player *trusts* the number on screen |
| 1 | ability inert (cost not modelled) · choice never offered · earned value denied | honest and visible; they can see the card did nothing |
| 0 | inert | does nothing, looks like it does nothing |

**"Ability inert" is NOT a free lunch and must not be reported as one.** v2.04
deliberately made unpayable costs inert rather than free, and "If you do, …" is
intentionally unread for the same reason. Those cards are listed because the `pay`
prompt variant now exists to build them, not because they are broken.

#### THE NO-OP BLIND SPOT — the most dangerous thing this found

The audit files a clause as `noop` to mean "parsed, and genuinely does nothing on
its own" — correct for stealth, mark and the crowd's boo, where the ruling says so
in as many words. But **a keyword filed as `noop` that actually has rules meaning
is invisible to every coverage tool**, because `noop` counts as accounted for:

```
Spears of Surreality   tier = FULL   kw = [Phantasm, Go again]
Barnacle               tier = FULL   kw = [Watery Grave]
```

Both report as **fully scripted** with their entire mechanic ignored. Phantasm
destroys an attack blocked by a 6+ power card; watery grave turns a dead ally
face-down *specifically so it cannot be replayed infinitely*. Eleven cards are in
this state across Enigma's and Gravy Bones's identities.

The honest test is the ruling's own words: where a ruling says a keyword "does
nothing on its own", `noop` is right; where it describes real behaviour, `noop` is
a mis-filing. **A coverage audit can never surface this. Don't trust `tier: full`
on a card whose keywords are noops.**

### The sweep — the axes the stack never looked at

```
npm run sweep            # ranked summary + SWEEP.md + tools/sweep.html
npm run sweep --html     # regenerate the station only
```

**The card stack is empty as of 2026-07-26** — 119 rulings, 0 open. That does
not mean the pool is understood, because `stack.js` only ever charged *pool
cards*. `tools/sweep.js` covers the three axes it never touched:

1. **Hero abilities** — 13 of 15 heroes have unread ability clauses, **32 in
   total**. The stack never charged a hero, so none of this was ever asked.
2. **Tokens** — of 17, five have unread text and are barely named in the
   trainer (`Confidence`, `Fealty`, `Flurry`, `Graphene Chelicera`, `Courage`).
   Five more are unread but *named* often (`Runechant`, `Frostbite`,
   `Bloodrot Pox`, `Frailty`, `Seismic Surge`).
3. **Ruled but not built** — 147 cards carry a ruling and still do not resolve
   in full (35 read nothing, 112 partial). Understood ≠ built, and that
   distance is invisible in the stack once every card is answered.

**The mention count is a signal, not a verdict.** A high count is *consistent*
with dedicated handling — runechant and frostbite really do have counters — but
it is not proof: "Seismic Surge" appears only inside a refusal message. Only
`zero mentions + unread text` reliably means absent. The tool reports the
number and lets you judge; it must not assert design intent from a grep.

Notes autosave to localStorage and export to **`tools/sweep-notes.json`** —
deliberately a *different file* from `rulings.json`, because a note here is an
engineering observation rather than a rules ruling, and nothing the sweep does
can put the 119 rulings at risk. Its export merges from the whole prior file,
same discipline as the review station.

**The export can no longer lose a ruling.** It used to build the download from
the OPEN entries only — answered slugs aren't in that list, so a re-export dropped
every previously-answered ruling (37 of them, once). The page now embeds the whole
prior file and the export starts from a copy of it. If a partial export ever turns
up again, **merge, don't replace**.

**`tools/followups.json` closes the loop the other way.** When a ruling exists but
building from it hits a specific wall, add the slug there with three fields — what
got built, where it stuck, and the narrow question. That entry comes BACK into the
stack flagged *needs detail*, and the review station shows the question in a red
callout above the cards with the prior ruling underneath, so the narrow thing gets
asked instead of the broad one. Delete the slug once the answer lands. Before adding
one, try to answer it from the data: card **images** carry reminder text that
`functional_text` does not — reading Clash of Agility's printing settled the
clash-comparison question without asking.

**Tokens resolve, they are never asked about.** A token is a card, so all 17 the
pool references are looked up in the database and their own text is printed under
every card that creates one (CLI dossier, `STACK.md` and the review station share
one registry, so they cannot disagree). The token question is therefore not "what
does it do" but "how should the engine carry it".
Answers autosave to `localStorage` and never leave the page until **Export JSON**,
which downloads a drop-in `tools/rulings.json`. `Ctrl`+`Enter` saves and advances.
Regenerate it after any audit — it is a build artifact, not a source file.
`tools/stack.js` reads the audit and charges every unscripted card to the
**mechanic** that blocks it — an unsettled keyword, else a concept probe over
its unread text — so one human ruling unblocks a whole list of cards rather
than one. A mechanic is in the stack precisely because neither the card text
nor the card database defines it: the database carries no reminder text for
any of them, so guessing the semantics would break the golden rule at the
keyword level. Answer one, then teach the parser and re-run the audit.

Always, regardless of what the tests say:
7. **On a real phone.** Type checking and drills verify the parser is
   correct, not that the feature is fun or legible — validate on-device
   per the roadmap's loop (play → record → extract frames → fix) before
   calling anything shipped.

### Drill gotcha
`fxParse` memoizes on `name|pitch`. Test cards **must have unique `name` fields**
or results silently collide in the cache and produce misleading passes.

---

## Wiring a ruling to a prompt (v2.17)

A quarter of the recorded rulings describe the same shape: *stop, show a side
something, let them choose.* `engine/prompts.js` is that machinery, and it is
**data, not code** — a ruling becomes a spec object, never a new branch per card.
That is the golden rule applied one level up: the parser reads the card's text,
the spec describes the choice, and nobody special-cases a card by name.

**Queue, never open inline.** The action has to finish resolving first:

```js
n.promptQ = [...(n.promptQ||[]), {tag:"pick", src:card.name, zone:"grave",
                                  to:"hand", filter:{type:"attack"}, min:1, max:1}];
```

`openPrompt` drains the queue at the tail of `execute` / `resolveStack`. If a
spec has nothing to ask — empty zone, fewer than two modes — `buildPrompt`
returns `null` and it politely skips itself instead of showing an empty sheet.

### The five variants

| tag | what it asks | spec fields | unlocks |
|---|---|---|---|
| `opt` | reorder the top N of a deck | `n` | opt (already live) |
| `pick` | choose cards from a zone | `zone`, `to`, `filter`, `min`, `max` | retrieve, reload, graveyard picks, fusion reveals, Arcane Twining |
| `modal` | choose one printed mode | `options:[{label,ops}]` | Pummel, meld |
| `pay` | pay a cost, or decline | `cost`, `avail`, `ops` | Look Tuff, Cold Snap, crank, heave, and the whole "If you do, …" family |
| `reveal` | information both players see | `cards` or `zone`+`n` | Ravenous Rabble, Knucklehead, intimidate's random pick |

`min:0` makes a `pick` optional and adds a **Choose none** button. `to` is the
destination zone and accepts `deckTop` / `deckBottom` as well as the named zones;
omit it and the pick is a reveal that moves nothing.

### Two rules that keep it honest

**Prompts are addressed to a SIDE.** `spec.side` is 0 (you) or 1 (the opponent) —
the same indices `engine/sides.js` and the pregame throw use. Cold Snap's ruling
has the *opponent* choosing whether to pay; intimidate shows the opponent's hand.
The sheet shows an "opponent's call" badge whenever `side !== 0`, which in
multiplayer is the difference between "your call" and "waiting on them".

**The module runs no effects and touches no resources.** `applyPrompt` returns
`{game, msgs, ops, pay}` — the trainer logs `msgs`, feeds `ops` to `runOps` and
charges `pay`. This is what keeps an unpaid optional cost from firing its payload,
which is exactly the bug v2.04 fixed; there is a drill named after it. It is also
what makes the whole thing drillable without a deck.

`avail` on a `pay` spec is what the asked side can actually spend. `openPrompt`
fills it from `s.res` when omitted — a seam that disappears once resources
migrate onto `sides[]` (the counters pass).

### Filters

`filter` reads printed card **fields**, never rules text: `type` (`attack` /
`nonAttack`), `tt` (regex on the type line), `pitch`, `costLe`/`costGe`,
`powerGe`/`powerLe`, `defGe`, `name` (regex). Every key present must match, so
`{pitch:3, type:"attack"}` means "a blue attack".

---

## The two-player migration (v2.14 groundwork)

Roadmap item 1 — "make the state symmetric" — now has a shape to migrate *to*
and a bridge to migrate *across*, so it can proceed a function at a time
instead of as one big-bang rewrite.

**`engine/sides.js` — the shape a second human can occupy.**
`makeSide()` defines the 47 fields a player needs in order to *be* a player;
both seats get all of them, so giving the dummy an action phase becomes
filling in blanks rather than inventing plumbing. `makeGame()` wraps
`sides[0]` (you) and `sides[1]` (opponent) with the genuinely shared state.

The migration ledger is **data, not prose**: `P_MAP` maps each flat player
field to its side field, `O_MAP` does the same for the dummy's `d*` stubs,
and `GAME_KEYS` lists what is truly shared. `toSides(flat)` / `fromSides(game)`
round-trip losslessly, which is what lets one function at a time move over
while the rest of `Battle` keeps reading the flat state.

**Two numbers, and they answer different questions.** `symmetryGap()` reports
both and `test/sides.test.js` pins both. Moving either should be a **deliberate
edit to that drill**, the way the coverage baseline works.

**DONE as of v2.18.** Both seats carry all 47 fields, both are built by a single
`makeSide` call, and `flatRemaining` is **0** — nothing a hero owns lives on the
game object any more.

| | fields | native | still flat |
|---|---|---|---|
| player | 47 / 47 | 47 | 0 |
| opponent | 47 / 47 | 47 | 0 |

`P_MAP` and `O_MAP` are now empty. They stay as the ledger's shape: if a flat
per-side field is ever reintroduced it belongs in one of them, and the drills
hold it to that. The dummy's resources, action point, arsenal, pitch, banish,
soul and `hist` sit at their defaults because it pays no costs and takes no
action phase yet — inert-but-present is the point, and it is what lets a second
human occupy slot 1 without a single new field.

### The seeded RNG (v2.26) — `engine/rng.js`

Roadmap Phase A step 2, and its own words: *"Do not skip the seed. It is
thirty lines and it unlocks replay, drills for `Battle`, and lockstep all at
once."* Three payoffs, only one of which is netcode:

1. **Replay** — a game is its seed plus its action log.
2. **Drills** — you cannot assert on a shuffled deck; with a pinned seed you can.
3. **Lockstep** — two peers must deal the same decks from the same seed.

**Every function is pure and returns a NEW rng beside its value.** Nothing in
the module mutates and nothing calls `Math.random`.

```js
const {rng, v} = rngRoll(n.rng, 6);
n.rng = rng;            // ALWAYS store it back
```

Forgetting to store it back means the next draw repeats the last one. `rng.n`
(the draw counter) is what makes that visible — it only goes up, so a stalled
`n` between two states that should differ is the tell. It doubles as a **desync
canary**: two peers at the same action with different `n` have already diverged.

**One seed per match**, stamped in `App` when the match begins and threaded
`Loadout → Pregame → Battle` through `cfg`. The pregame throw runs on a
*derived* sub-stream (`seed + ":rps"`) so the opponent's hand cannot correlate
with the first card of anyone's deck.

Seeded: both opening shuffles, the throw, Knucklehead's d6, intimidate's pick,
the dummy's graveyard recycle. **Deliberately left on `Math.random`:** taunts,
trophy text and the random-hero button — none of them touch game state.

`rng.seed` + `rng.n` ride in the **JUDGE!!** report, so a one-line bug note is
now a reproducible game rather than a screenshot to squint at.

**`DawnGame.shuffle` is gone** (v2.26). An unseeded shuffle sitting beside the
seeded one under a *shorter* name is a trap: someone reaches for it and silently
breaks replay and lockstep with no test able to notice. Same reasoning that
deleted `sides.js`'s `you`/`foe`. Use `rngShuffle(rng, arr)`.

**Known, and left alone:** `addRunechants`'s `mkUid` fallback in
`engine/game.js` still uses `Math.random`, but every real caller and every
drill passes `tokSeq`, so it never fires. Making it deterministic would risk
uid collisions in a path that does not execute.

### ACTOR vs PERSPECTIVE — the seam (v2.24, migration v2.25)

`ROADMAP-MULTIPLAYER.md` Phase A step 1, "the whole ballgame". `you()` means
**seat 0**, not "the player acting", and today those two readings coincide only
because one seat ever acts. Two concepts have to come apart:

| | question | helpers |
|---|---|---|
| **perspective** | whose board does THIS CLIENT render? | `you()` / `opp()` / `youMut()` / `oppMut()` — **UI only** |
| **actor** | whose effect is RESOLVING right now? | `act()` / `foe()` / `actMut()` / `foeMut()` — **rules only** |

```js
const actorOf = s => s.actor||0;
const act    = s => s.sides[actorOf(s)];
const foe    = s => s.sides[1-actorOf(s)];
const actMut = n => actorOf(n)===0 ? youMut(n) : oppMut(n);   // one clone path
const foeMut = n => actorOf(n)===0 ? oppMut(n) : youMut(n);
```

`s.actor` defaults to 0, so **`act(s) === you(s)` today** and every `you`→`act`
swap is behaviour-identical *now* while being correct the moment seat 1 acts.
That is what makes this migratable a function at a time instead of big-bang.
`actor` is in `GAME_KEYS` (shared, not per-side — it *names* a seat).

**The ledger is `test/actor.test.js`**, and it works like `flatRemaining`:
`MIGRATED` functions must contain **no** perspective helper; `PENDING` ones are
pinned so the remaining work is a number, not folklore. Moving a name between
the lists must be a deliberate edit.

The ledger covers **exactly the seven functions the roadmap names** as the rules
core. Keeping that denominator honest matters — a ledger that quietly omits two
makes the remaining work look smaller than it is.

| | |
|---|---|
| MIGRATED (5/7) | `runOps`, `execute`, `resolveStack`, `tryPlay`, `takeIt` |
| PENDING (2/7) | `newTurn`, `foeSwing` |

`newTurn` and `foeSwing` are last on purpose: both are entangled with the
**dummy specifically** rather than a generic opponent (`foeSwing` *is* the
scripted `[3,4,5]` escalation; `newTurn` refills the dummy to `DUMMY_INT` every
turn to stand in for the turn it never takes). Migrate them together with
giving seat 1 a real action phase — that work replaces both behaviours anyway.

Not yet in the ledger, and smaller: `confirmPay`, `allySwing`, `dummyDefence`
also write side state. They are seat-0-only today; fold them in as they come up.

The drill slices function bodies by **anchor pairs, not brace matching** — a
brace counter that is not regex-literal-aware miscounts inside `execute`'s
regexes (the same hazard `html-balance.test.js` documents). `ANCHORS` must stay
in true file order; a drill enforces exactly that.

**A seat index hardcoded in a rules call is the same bug wearing a different
hat.** `popRunechants(n, 0, …)` popped **seat 0's** runechants whoever was
swinging — fixed in v2.25 to `popRunechants(n, actorOf(n), …)`, and a drill now
fails any migrated function that writes `sides[0]` / `sides[1]` literally.

**Watch for local names that shadow the helpers.** `tapTwice`'s third parameter
was called `act`, silently shadowing the global `act()` for that whole closure
— harmless while it is pure UI, a real trap the moment anything in there needs
the acting side. Renamed to `commit` in v2.25. Same-name-different-meaning is
the bug class `test/sync.test.js` pins for the engine; keep it out of the UI too.

**`built.*` is still the PLAYER's hero build** (`built.viseraiPassive`,
`built.runeDmg`, `built.iceFrostbite`, `built.arsenalInstant`), captured in
closure. When seat 1 acts for real, each side needs its own build — that is the
next layer after the helper migration, not part of it.

Two dead engine helpers were **deleted** in v2.24 rather than pinned:
`sides.js` exported a seat-hardcoded `you`/`foe` pair that nothing called.
Introducing the trainer's actor-relative `foe` would have made `foe` a
collision with *different semantics* (engine `sides[1]` vs trainer
`sides[1-actor]`) — the dangerous kind. So `KNOWN_COLLISIONS` **shrank** to
`["endTurn","other"]`. Prefer deleting a dead engine export over adding a name
to that list.

### Cost readers take a SIDE, not the game

`effCost(c, sd)` and `boardRed(c, sd)` are handed **one side**, because the
runechants and the board that discount a card belong to whoever is *playing* it.
Call them `effCost(card, you(s))` — passing the game would silently read side 0
for both players.

This one bit already: `boardRed` was not in the old sync guard's SHARED list and
**drifted silently** during the migration — `index.html` read `sides[0].board`
while `engine/parser.js` read the raw object, and no drill noticed. That whole
failure mode was retired in v2.20; there is only one `boardRed` now.

### The no-mirror rule (v2.20) — replaces the lockstep rule

**There is one copy of every shared function, and it lives in `engine/`.** If you
need to change the parser, the advisor, the prompt machinery or the card resolver,
**edit `engine/*.js` and only that.** `index.html` no longer contains any of it.

Historic note, because the old rule is quoted in several places: until v2.20 each
shared function existed twice — once in `engine/`, once copy-pasted into
`index.html` — and `test/sync.test.js` asserted the two bodies were textually
identical ("edit one side, mirror the other"). **That rule is dead.** It did real
work, but it only covered names someone remembered to list, which is how `makeSide`
and `freshHist` ended up mirrored and unguarded, and it doubled the cost of every
engine change. v2.20 deleted 51 duplicated definitions (−55KB, ~20% of the file).

What replaces it, all enforced by `test/sync.test.js`:

- every `engine/*.js` module is loaded by a `<script src>` tag, `parser.js` first;
- the **bridge** (plain JS, right after the data script) lifts each engine export
  into the bare name the babel blocks call — add a new export there or the trainer
  gets a `ReferenceError` no other drill would catch;
- **no engine export may be re-declared in `index.html`.** A stray
  `const fxParse = …` in the trainer would shadow the module and put us back to two
  copies with nothing watching them. This is the guard that matters.

**Two names collide on purpose** (three until v2.24), and the drill pins them so
a fourth cannot appear unnoticed: the trainer's `endTurn` (a `setG` reducer) vs
`priority.endTurn` (pure seat handoff), and the trainer's `other` (off-pitch
cards in `DeckView`) vs `priority.other` (the other seat). `you` left the list
when `sides.js`'s dead seat-hardcoded `you`/`foe` were deleted. They never meet today because the
trainer calls its own bare and would reach the engine's as `DawnPriority.endTurn`.
**Resolve them by renaming when `priority.js` is wired in** — that wiring replaces
exactly those functions, so a silent bridge there would be a genuine bug.

### The access rule — `you()`/`opp()` read, `youMut()`/`oppMut()` write

**This is a real trap, not a style preference.** The trainer copies state with
`let n = {...s}`, which is *shallow*: `n.sides` and the side objects inside it
are still the very objects React already rendered. Writing `n.sides[0].hp -= 4`
reaches back and corrupts a previous state.

```js
you(s).hand          // read  — always safe
opp(s).gear          // read  — always safe
youMut(n).hp -= 4    // write — clones side 0 into a fresh array first
oppMut(n).hp -= 4    // write — clones side 1
```

The Mut helpers return the fresh side, so
`const o = youMut(n); o.hand = …; o.grave = …` works too. Clone once at the top
of a function and every later write in it is safe — `L()` spreads only the top
level, so it carries the fresh array forward untouched. Calling a Mut twice is
harmless, just a wasted copy.

**A side field written as a top-level KEY is the other half of this bug, and
it is invisible to a read-guard.** `{...s, ward, blockH:[]}` writes to the game
object; the side keeps its old value and the write silently does nothing. Five
shipped that way in v2.18 — `ward`, `hist`, `blockH`, `blockG`, `blockRx` in
`takeIt` (so **stale defenders were never cleared after a block**) and `paySel`
in `tryPlay` (so a new payment inherited the previous pitch selection). Both
were found in v2.19 by reading the code, not by a drill.

There is a drill for it now, and it must stay **brace-aware**: a naive regex
cannot see a key that sits past a nested literal like `pending:{card,from,idx}`,
which is exactly how `paySel` hid. Write to a side only through
`youMut()` / `oppMut()`.

**When migrating more fields, whitelist the holders — never blacklist.** The
holders that carry state are `s`, `n`, `g`, `clashState`, `st`. A blacklist
would rewrite `card.pitch` / `c.pitch` (a card's pitch *value*, not the zone)
and the PARSED `d.deck` / `d.gear` (deck *definitions*). Both are landmines and
both are live in the file today.

Four drills hold this line: two fail if any flat player or opponent zone/life
reference reappears in `index.html`, one checks `NATIVE` against the trainer's
real side literals so the ledger cannot become fiction, and one asserts the two
seats declare the same keys. (`built.deck` / `built.gear` / `built.dDeck` /
`built.dGear` are the deck *builder's* locals and are exempt — not state.)

**A new field cannot escape the migration.** `test/sides.test.js` scans the
top-level keys of Battle's real state literal out of `index.html` and fails if
any one of them is unclassified. Add a field to `Battle`, give it a home in
`P_MAP` / `O_MAP` / `GAME_KEYS`.

**`engine/priority.js` — who may act, right now.**
The trainer never needed this: with one acting side, "your turn" and "your
priority" are the same thing and both are implied by `mode`. They are separate
fields here because in a two-player game the *defending* player holds priority
during the *attacking* player's turn on every link of every chain.

- Phases `start → action → end`; chain steps
  `layer → attack → defend → reaction → damage → resolution → link`.
- `pass()` slides priority; `allPassed()` reports the window closing. It never
  advances on its own, because what "advance" means depends on the step.
- `speedAllowed(g,i)` names the window (`action` / `attack-reaction` /
  `defense-reaction` / `instant`) — the rule the player's hand-dim logic and
  `playRx` currently enforce by hand, stated once so both sides share it.
- Defenders are declared free and simultaneously, so `canDeclareDefenders` is
  deliberately a *separate* question from `canAct`.
- **Clock caution:** `turn` here counts player-turns (it ticks on every
  handoff, per the CR) and `round` ticks when seating wraps. The trainer's flat
  `turn` counts only the player's own turns, so it maps to `round`. The
  escalation table and the score both read it — mind this when wiring the
  dummy's action phase.

This module owns *no* zones: it never draws, never moves a card, never reads
card text. Keeping that line clean is what makes it testable without a deck.

**`engine/rps.js` + the pregame — seating is decided, not assigned.**
The winner of the throw **chooses** who goes first; they are not handed the
first turn. Ties are replayed rather than counted. `Pregame` sits between the
loadout and the first draw and passes `first` (0 = you, 1 = opponent) into
`Battle` — the same indices `sides[]` uses, so the screen already speaks the
two-player vocabulary.

---

## Editing conventions

When making many edits in one pass, apply them **resiliently**: record misses to a
list and continue, then write the file and print the misses. Never abort the whole
batch on one bad anchor — that discards all the good edits. (With Claude Code editing
files directly this matters less, but the principle stands for scripted passes.)

---

## The two-tap card interaction (v2.19)

A card in the rail is 80px wide — unreadable on the phone this is played on.
So **every tappable card peeks first and commits second**:

1. first tap → the card renders large above the action bar, with its name and
   a verb telling you exactly what the second tap will do;
2. second tap on the *same* card → commits.

One helper, `tapTwice(card, verb, action)`, serves all of it, and `peekables()`
is the lookup the preview uses — it must span **every zone a tap can originate
in** (hand, arsenal, gear, powCards, board) or the preview silently fails to
render while the tap still arms. The verb is captured at tap time and the peek
is dropped on any `mode` / `bphase` / `turn` change, so it can never go stale.

Verbs in use: *play · pitch · unpitch · defend · react · set in arsenal ·
swing · activate · use the hero power · play from the graveyard · play from
banish · full card*. Peeking is allowed on cards you cannot legally play —
looking is free — the second tap simply does nothing.

Two deliberate exceptions: with **inspect** on, one tap opens the full modal
(that is what inspect is for); and the **opponent's** gear opens its card on a
single tap, because it is not actionable and there is nothing to commit to.

An **equipment ability peeks as its `powCard`, not the piece** — the ability's
text is what you are deciding about. Those powCards also inherit the parent
piece's art (`img`/`dbImg`), so the rail shows iron rather than a text
placeholder.

---

## The guard rails (v2.21) — `engine/invariants.js`

**A judge that audits the STATE, not the cards.** Every bug that shipped this
cycle was found by eye or in play, never by a red test — crumbling auras that
came back, defenders never cleared, a pitch selection carried into the next
payment. They share a shape: the state reached a condition the rules of Flesh
and Blood do not permit, and detecting it needed no card text at all. It needed
somebody to look at the board and say *that card is in two places at once*.

```js
DawnInvariants.check(game)   // [{code, severity, msg, where}]
DawnInvariants.errors(game)  // severity "error" only — a rule is broken NOW
DawnInvariants.assertClean(game, "takeIt")   // throws, for drills
```

**It is wired into `setG`**, which is the single funnel every state change in
`Battle` passes through, so every play in a real game is audited. It **never
throws** in the trainer — a violation must not cost a player their game, so it
logs, records to `window.__dawnJudge`, and keeps running. Read the console.

What it enforces, with citations where the CR is the source:

| code | what |
|---|---|
| `CARD-IN-TWO-ZONES` | the crumbling-aura bug, exactly |
| `CARD-DUP-IN-ZONE` | same uid twice in one zone |
| `SIDE-FIELD-ON-GAME` | the v2.18/v2.19 bug class: a per-side field written as a top-level game key, so the side kept its old value |
| `DEFENDER-REUSED-ON-CHAIN` | CR 7.3.2b — a card already defending cannot be re-declared |
| `PRIORITY-IN-CLOSED-PHASE` | CR 4.2.1 / 4.4.1 — no priority in the start or end phase |
| `NEGATIVE-RES` / `NEGATIVE-AP` | CR 4.4.3e — points are lost, never owed |
| `SIDES-ASYMMETRIC` | a second human cannot occupy a seat of a different shape |
| `ZONE-NOT-ARRAY`, `ARSENAL-SHAPE`, `NAN-FIELD`, `BAD-PHASE`/`BAD-STEP` | structural |

Verified against real state, not just fixtures: driven to turn 3 in a live game
it censused 86 actual cards and reported clean, and duplicating one real card
into the graveyard produced the exact `CARD-IN-TWO-ZONES` report. **When adding
a zone or a per-side field, check the census still sees it** — a zone the census
misses is a false negative, which is worse than no guard at all.

---

## Rules fidelity

This is a rules-accurate sim, judged to pro-tour standards. Combat follows the
Comprehensive Rules: Attack → Defend → Reaction → Damage → Resolution.

### Four CR violations fixed in v2.21 — read these before touching `priority.js`

Found by grounding `engine/priority.js` against the actual CR
(`rules.fabtcg.com/en/cr/04-game-structure/` and `/07-combat/`):

1. **No priority in the start or end phase** (CR 4.2.1, 4.4.1). `priority` is
   now legitimately `null` there — that is a real value meaning "nobody may
   act", not "unset". `give()` refuses to grant it in a closed phase, and
   `toPhase("action")` is what hands it over (CR 4.3.3).
2. **The defend step gives priority to the TURN-PLAYER, not the defender**
   (CR 7.3). Counter-intuitive but explicit: declaring defenders *is not
   playing* them (CR 7.3.2) — it is a free, simultaneous game-state action, so
   it is not a priority action at all. That is exactly why
   `canDeclareDefenders` is a separate question from `canAct`.
3. **BOTH players' floating resources fizzle** (CR 4.4.3e: "All players lose
   action/resource points"). Only the turn player's did. Invisible today (the
   dummy never floats a resource) and a **real two-player bug**: a Wizard who
   banks a resource off Spellfire Cloak during *your* turn must lose it at the
   end of *your* turn.
4. **The action point is issued at the beginning of the ACTION phase**
   (CR 4.3.2), not handed out in the end phase. `makeGame` therefore opens with
   neither seat holding one.

The CR's end-phase procedure is a **fixed order** (CR 4.4.3) worth checking
`newTurn` against: ally life resets → arsenal → *all* players' pitch to deck
bottom → untap → *all* players lose points → turn player draws to intellect.

### The first-turn draw (CR 4.4.3f) — fixed in v2.22

> "If it is the first turn of the game, **all other players** draw cards until
> the number of cards in their hand is equal to their hero's intellect."

On turn one **only**, the non-turn player refills too. This is what pays the
second player back for blocking the opening swing, and the opponent-first
opening never did it — so going second cost an extra swing **and** left you
short-handed for your first action phase. That is a large part of why
opponent-first played harder than it should; retune with a play session.

The dummy's side of this is over-generous rather than missing: `newTurn`
refills it to `DUMMY_INT` every turn, which stands in for the turn it never
takes. When it gets a real action phase (roadmap item 3), that refill must move
to the end of *its* turn and this rule becomes turn-1-only for both seats.

---

## Runechants are AURAS, not a counter (v2.23)

The printed token, verbatim:

> **Runechant** — "Runeblade Token - Aura"
> "When you play an attack action card or activate a weapon attack, destroy
> this and deal 1 arcane damage to target opposing hero."

**It is an aura in the arena, and that is load-bearing rather than flavour.**
Seven pool cards ask about auras generically — "if you control 3 or more auras"
(Goon Beatdown, Goon Tactics), "you may destroy an aura you control" (Condemn to
Slaughter ×2), "whenever you play an aura" (Magmatic Carapace), "if you've
played or created an aura this turn" (Runerager Swarm, Shrill of Skullform, Hit
the High Notes). While a runechant was a bare integer on the side, **none of
them could see it**: it could not be counted and it could not be destroyed.

So the **board is the single source of truth** and the count is derived:
`DawnParser.runeCount(sd)` / `auraCount(sd)` read `sd.board`. There is no
`sd.rune` field any more — a drill would fail if one came back. `effCost` reads
the board too, so "costs {r} less for each Runechant" still works.

That they now render the **real token art** on the board instead of the text
chip "Runechant ×2" is a *consequence* of the model being right, not a separate
fix — the board renders its entries with `CardFrame`. `built.runeCard` is the
token built from the database record (never invented), and `runeApprox` still
reports when the token is missing from the pool.

### Two rules fixes that fall out of the printed text

1. **The trigger fires on PLAY.** "When you *play* an attack action card…" — a
   runechant that did not exist at that instant never triggered for it. So one
   created *by* the attack (Viserai's rite on a Runeblade attack, a verse
   counter unwinding, an on-hit forge) **survives to the next swing**.
   `execute` captures `runeAtPlay` before the card does anything and pops only
   that many. This was a known approximation for several versions.
2. **The arcane resolves BEFORE the attack's damage.** A triggered ability goes
   onto the stack *above* the attack that triggered it, so it resolves first —
   before the defend step even. The pop therefore happens at **declaration** in
   `execute`, not in `resolveStack` where it used to land after the attack's own
   damage. Arcane bypasses equipment, so it goes straight past the block wall.

Each token is its own source and there is no "you may" in the text: they all
pop, mandatorily, each dealing its own printed damage.

### Token uids must be namespaced

`tokSeq` counts from 1 and so does the loadout's card numbering, so a raw
counter **collides with a real card**. The first runechant minted took uid 1 and
shared it with a deck card; the invariant judge caught it in live play as
`CARD-IN-TWO-ZONES` — exactly the job it was built for. `addRunechants` now
prefixes the uid itself (`"rune"+seq`) so no call site can repeat it, and there
is a regression drill. The other token sites prefix by hand (`"tok"`, `"chi"`,
`"mk"`); keep that convention.

**Still counters, deliberately:** Frostbite, Bloodrot Pox and Frailty. They sit
on the *opponent* and nothing in the pool counts them as auras yet. Revisit if a
card ever asks.

---

## Attack targets (CR 1.4.5) — engine done, trainer NOT wired (v2.23)

**With an ally in the arena, declaring an attack is a choice, and it is
mandatory.** CR 1.4.5: "If a player plays, activates, or triggers an attack or
attack-layer, the player **must** declare an attackable object controlled by an
opponent as the attack-target." CR 1.4.5a: attackable = a **living object** —
which is what makes an ally attackable, because an ally has life.

The consequence that matters is in the defend step. CR 7.3.2a: "If the
attack-target is a hero, their controller may declare any number of
non-defense-reaction cards … **Otherwise**, a player may only declare cards for
an attack-target if a rule or effect specifies it."

> **An attack on an ally cannot be blocked.** It always connects, and it kills.

That is what makes it a real decision rather than a worse way to hit the hero.
Allies heal every turn (CR 4.4.3a resets ally life to base in the end phase), so
ally damage is a per-turn race, not attrition.

**Built and drilled** (`test/targets.test.js`, 21 drills):
- `resolveEntry` now carries an ally's **`life`** (the DB's `health`). It used to
  drop it, so allies had no life and *could not be attacked at all*. This is a
  loader schema change — `DATA_VER` went to `sage-v9`.
- `engine/game.js` — `attackTargets(game, defIdx, heroCard)` (hero first, then
  every ally with life > 0), `targetCanBeDefended(t)` (CR 7.3.2a),
  `damageAlly()` (kills to its controller's graveyard, never spills onto the
  hero), `resetAllyLife()` (CR 4.4.3a).
- `engine/prompts.js` — a sixth variant, **`target`**. Candidates are supplied by
  the caller so the module stays data-driven. With one legal target
  `buildPrompt` returns `null` and the sheet skips itself, so an attack into an
  empty arena never shows a prompt. No decline — the choice is mandatory.

**Still to do — the trainer wiring.** `execute` declares the attack and calls
`dummyDefence` in one pass, so the target must be chosen *before* that. Follow
the **boost** precedent: `maybeBoost`/`confirmBoost` already pause before
executing and re-enter `execute`, which is exactly the shape a target choice
needs (`mode:"targetpick"`). Then:
1. if the target is an ally, **skip the defend step entirely** (CR 7.3.2a);
2. route damage in `resolveStack` through `damageAlly` instead of
   `oppMut(n).hp -= total`;
3. call `resetAllyLife` in `newTurn`.

**Honest caveat:** none of this is observable in solo play yet. The dummy's deck
is 30 vanilla attacks and it creates no allies, so the opponent never has one to
target. It is a **multiplayer requirement** (and needed the moment the dummy can
hold an ally). The mirror case — the dummy choosing to attack *your* Gravy Bones
allies — is a strategic decision the dummy is deliberately not built to make.

---

## JUDGE!! — bug reports from the table (v2.22)

A button on the log pane. Every fix this cycle came from playing and noticing,
so the expensive part was never noticing — it was reconstructing the board
afterwards from a screenshot. So the report captures the board:

- both sides' zones as `name#uid` lists, with the graveyard's `_gy` stamps
- every counter and status, `hist`, the chain, stack, pending and prompt
- the whole feed, plus `invariantsNow` and every violation seen this game

The note can therefore be one line ("this looked wrong"). **Copy** or **Save
report** → `dawnblade-bug-<hero>-t<turn>-<ts>.json`. The button also shows
`⚠ N` when the invariant judge has flagged anything, so a broken state is
visible on the phone rather than only in the console.

Written by `judgeReport()` in `Battle`. **When adding a zone or a per-side
field, add it there too** — a report that silently omits state is worse than
no report.

Also confirmed from the CR and not yet modelled: **simultaneous triggers are
ordered by the first-turn-player** (CR 4.1.8a), and the chain closes
automatically at the resolution step once all pass with no queued attack
(CR 7.6/7.7) — the trainer's deliberate ⛓ button is a UI approximation of that.
"Hit" is defined precisely (CR 7.5.5): if prevention means no damage is dealt,
**it is no longer a hit**, so on-hit effects must not fire.

Key implemented rules:
- Defenders are declared free and simultaneously; printed defense required; zero counts.
- Defense reactions **cannot** be declared as defending cards — instant speed only,
  during the reaction step.
- The combat chain stays open after an attack; non-attack actions require closing it.
- Arcane damage bypasses equipment; only ward/arcane barrier stops it.
- Runechants pop **all at once and mandatorily** on any attack, each a separate source.
- Crush = "deals 4+ damage to a hero"; dominate = defender limited to 1 card from hand.
- Tapping is a High Seas cost (the down-arrow symbol) — **not** a generic "weapon used"
  state. Only rotate cards whose text actually uses tap.

---

## The dummy (v2.05) — it holds cards now

`DUMMY_DECK` is a 30-card pile of real Silver-Age-legal **Generic attack actions with
no rules text at all** (Raging Onslaught / Brutal Assault / Critical Strike / Wounding
Blow at pitch 1-3). That choice is deliberate: the dummy blocks with printed defense
and nothing about its cards needs the parser, so none of its behavior is faked. Give
it carded effects only once the engine can actually read them.

- Draws to `DUMMY_INT` (4); refills at the end of its turn in `newTurn`.
- Declares defenders free and simultaneously — equipment first, then cards from hand,
  spending from hand only while the swing still threatens.
- **Now live because of the hand:** dominate (really holds it to one blocker),
  intimidate (really banishes one of its cards), forced discard (`foeDiscard` hits the
  real hand), Crush's hand payload, and `defLt2` ("defended by fewer than 2
  non-equipment cards") which counts actual hand blockers.
- `dBlockedHand` records how many cards from hand met the last attack. **Reprise is
  live from v2.09** — `playRx` had never evaluated conditions at all, so every
  conditional attack reaction was silently doing nothing.
- **Intimidate is a one-turn tax, not a theft** (corrected v2.10): a card is pulled
  from the dummy's hand *at random*, banished face-down, and handed back at the
  beginning of the end phase via `dIntimidated`. The first pass banished it forever.

## Known approximations — state these honestly, never paper over them

- The dummy still has **no action phase**: its swing is the scripted
  `[3,4,5][(turn-1)%3]` escalation, not a card played from its hand. Effects that
  target an opponent's *turn* (frostbite, inertia, Crush's next-turn debuffs) stay
  inert until it takes a real turn. The escalation now lives alone in `foeSwing`,
  which is the seam a real played card slots into (roadmap item 3).
- **Crumbling auras used to come back (fixed v2.16).** `newTurn` filtered auras
  with `sd==="turn"` off the board, logged them, and moved them to the graveyard
  — and then the return statement rebuilt the board from `s.board`, the *pre-filter*
  copy, restoring the very cards it had just buried. They stayed on the board while
  also sitting in the graveyard. Found while migrating the board onto `sides[0]`;
  the fix is that the rebuild now reads `you(n).board`, the filtered one. Worth
  knowing because the shape of the bug — a later `{...n, field:s.field}` silently
  reverting earlier work on `n` — is easy to reintroduce anywhere in this file.
- **`soul` is the one migrated zone never exercised in live play.** Every other
  zone was driven in a real game and inspected in React state; the on-hit soul
  trigger needs an attack to actually connect, and the dummy blocked everything
  the scripted player threw ("resolves for 0"). Its write path is the same
  `youMut` idiom as `banish`, which *was* verified — but it is untested, not
  proven. Drive Gravy Bones by hand when convenient.
- **`engine/priority.js` is not wired into `Battle` yet.** The trainer still
  gates windows with `mode` / `bphase` and the player still holds priority by
  construction. The module is the target shape and is drilled on its own; the
  adoption is roadmap item 1, and it should land together with the `sides[]`
  collapse rather than ahead of it.
- **Going second costs an extra swing.** If the opponent wins the throw and
  elects to go first, its opening swing lands before your first action phase.
  That opening deliberately does **not** tick the clock (`_opening` in `takeIt`),
  because score is `turns + wasted` and ticking would silently tax you a point
  and skew the escalation table. The consequence is that the dummy's turn-1
  swing value (3) is used twice. That is honest — going second really does mean
  eating one more attack over the game — but it is untuned: the difficulty
  curve was built around going first, so treat opponent-first as the harder
  mode until a play session says otherwise.
- **The dummy's seating call is a rule, not a bluff**: if it wins the throw it
  always elects to swing first, and the log says so. It is not evaluating the
  matchup, and it should not pretend to.
- The dummy pays no costs, so it never pitches; its hand is spent only on blocks.
- Its graveyard reshuffles when it would deck out — a sparring partner that decked
  out would stop sparring. Logged when it happens.
- **Cards can be minted at runtime.** Crouching Tiger (into the banished zone,
  playable that turn) and Inner Chi (transcend) are real database records, not
  tokens — both are in `NEEDED` so the loader fetches them even though no deck
  lists them. Anything else minted by an effect must be added there too, and
  `DATA_VER` bumped, or a warm cache will not have it.
- **Ephemeral** is enforced in the `gy()` helper — the single path into the
  graveyard — straight off Crouching Tiger's printed reminder text: "if it would
  be put into a graveyard from anywhere, instead it ceases to exist."
- **Clash resolves on DEFENCE** (fixed v2.12). Every clash card in the pool reads
  "When this defends, clash with the attacking hero" — it fires when the card blocks.
  It used to fire when the card was played as an attack, which is simply the wrong
  trigger. It lives in `takeIt` now.
- **Two structural faults in `classifyClause` hid a lot of working machinery**
  (found in the v2.12 deep dive, both guarded by drills):
  1. the `if/when/while` handler ran *before* whole-clause rules, so it split
     "If you control a Hyper Driver, this costs {r} less" and gave up — cost
     reductions, clash payoffs and Reincarnate were all invisible for this reason.
     Whole-clause patterns must be declared ABOVE that handler.
  2. it rejected any clause whose inner half was a `noop`, which killed
     "When this attacks, intimidate." even though intimidate is live. A noop inner
     is already accounted for; pass it through.
  Also: FaB prints "gains +1{p}", "gets +1{p}" AND "has +1{p}" — accept all three.
- **Spent equipment can't re-block the same chain** (`chainBlocked`, v2.11). A piece
  that has already been declared as a defender is unavailable until the chain breaks;
  the list clears in `newTurn`. Before this the dummy could raise the same helm on
  every link of a chain.
- **Cost reductions read the board by name** (`boardRed`): "If you control a Hyper
  Driver, this costs {r} less" is matched off the card's own text, so it works for
  any such card. `effCost` is always called with full game state, which is what makes
  the board visible — keep it that way.
- **The graveyard is turn-stamped.** Every card entering the graveyard gets `_gy`
  set to the current turn (helper `gy(turn, ...cards)` in `Battle`). That single
  characteristic answers the whole "discarded a card with 6 or more {p} this turn"
  family — `discard6`, Mandible Claw's go-again rider, Run Roughshod's play gate —
  and it is per-player data, so it carries straight into multiplayer. If you add a
  new path into the graveyard, stamp it or those cards go quietly wrong.
- **"Play this only if …" is a gate, not an effect** (`fx.playIf`). `tryPlay`
  refuses and names the reason. Bear Hug reads the pitch zone, Run Roughshod the
  stamped graveyard, and a soul variant is parsed but untested.
- **`tools/ledger.js` can be rebuilt from `AUDIT.md`.** A scripted edit truncated it
  once; because the audit prints every keyword with its status and note, AUDIT.md is
  a complete backup. Regenerating from it took one pass — but prefer small, asserted
  edits to that file over regex surgery.
- Clash is honest as of v2.07: both sides reveal a real top card and **power** decides
  it (confirmed from the printed reminder text, not guessed). A tie counts as no
  winner — that reading is still awaiting confirmation.
- Ally swings are simplified (no action point consumed).
- Auto-pitch/auto-discard picks the lowest advisor-valued card rather than prompting.
- **Equipment abilities keep their riders.** `parseHeroPower` stops at the first
  period, which used to orphan the second sentence of an ability — Knucklehead rolled
  its d6 but never set intellect. The powCard now carries the ability's whole printed
  line (cost prefix stripped), so riders resolve with it.
- **Declaration-time ops.** An attack's ops normally wait for `resolveStack`, but a
  reveal that changes *that* attack's power must land before the total is struck, so
  `reveal`/`revPitch` run at declaration and are filtered out of `pend.ops`.
- **Opt** now opens a real prompt sheet (`.psheet`, docked above the action bar so the
  hand stays visible, per the ruling). Effects **queue** prompts via `n.promptQ` and
  `openPrompt` drains the queue at the end of `execute`/`resolveStack` — never inline,
  because the action must finish resolving first. One component, many flows: the other
  six prompt-shaped rulings should reuse it rather than growing their own.
- **"If you do, …" is deliberately unread.** It hangs off an optional cost the engine
  can't model; running it would re-introduce the free-ability bug v2.04 fixed. Cards
  like Magmatic Carapace therefore stop at the cost line.
- Tokens handed to the dummy land on its board and are logged as idle: it pays no
  costs and takes no action phase, so Frostbite/Inertia-style taxes do nothing yet.
  Runechant, Frostbite, Bloodrot and Frailty keep their older dedicated counters
  rather than becoming board tokens.
- A runechant created by *playing* an attack pops on that same swing; strictly it should
  survive to the next.
- The steam-builder is once-per-turn in the model.
- "When this leaves/enters the arena, …" fires its payload when the card is *played*.
  The trainer has no arena-departure schedule, so a Suspense aura's +{p} lands early.
  Flagged `approx` by the parser so the ledger keeps counting it honestly.
- Activated abilities whose cost the readers can't model (discard-, banish- or
  soul-cost lines such as `Instant - Discard this: Amp 1`) are deliberately **inert**
  rather than free. Before v2.04 their effects fired on play at no cost.

---

## Roadmap (highest leverage first)

> **See `ROADMAP-MULTIPLAYER.md`** — as of v2.20 the road to online play is
> planned there in full (the actor/perspective split, the seeded RNG, the pure
> reducer, and the three phases: hotseat → P2P friend play → hosted ladder).
> The items below remain accurate; that document sequences them and explains
> *why* this order. **Item 1's remaining step is not just wiring `priority.js`
> — it is that `you()` means `sides[0]`, not "the acting player", at 458 call
> sites.** Read that section before starting any two-player work.

**Decision 2026-07-25: no AI opponent.** The goal is real multiplayer — two humans,
each piloting a deck. The dummy stays as the solo trainer and as the proving ground
for symmetric state; do not build a deck-piloting AI.

**Decision 2026-07-26: multiplayer is phased** — serverless friend-vs-friend
(WebRTC room codes, no backend) first, then a hosted backend for the ELO ladder.

1. **Make the state symmetric.** *Groundwork landed in v2.14 — see "The two-player
   migration" above.* `engine/sides.js` defines the shape, `toSides`/`fromSides`
   bridge to it losslessly, `engine/priority.js` holds the turn/priority machine,
   and the drills pin the gap at player 35 / opponent 12 of 47 fields.
   **What is left is the adoption**, and the order that keeps it safe:
   1. ~~The opponent's zones and life.~~ **Done in v2.15** — `hp`, `deck`,
      `hand`, `grave`, `gear`, `board` are native to `sides[1]`, reached via
      `opp()` / `oppMut()`. Verified in play, not just by drills.
   2. ~~The player's zones and life.~~ **Done in v2.16** — 188 reads and 41
      writes moved, `you()` / `youMut()` added, and the dummy gained the
      arsenal, pitch, banish and soul it never had. Both seats now declare an
      identical zone set. Nine of the ten zones were driven in a real game.
   3. ~~The counters.~~ **Done in v2.18** — 234 reads and 59 writes for the
      player, 15/6 for the opponent. `flatRemaining` is 0 and both seats are
      built by one `makeSide` call. The dummy already carries `res`, `ap` and
      `hist`, so its action phase needs no new state.
   4. **Wire `engine/priority.js` into `Battle` — the last step.** Replace the
      `mode`/`bphase` gates with the phase/step machine and real priority
      passing. This is the one that changes control flow rather than field
      names, which is why it went last. Mind the clock: `priority.js` counts
      player-turns in `turn` and rounds in `round`, while the trainer's `turn`
      counts only your own turns and both the escalation table and the score
      read it.
   Do this BEFORE adding more per-side features, or every new one doubles the
   migration.
2. ~~**The prompt sheet is the multiplayer chokepoint.**~~ **Done in v2.17** —
   `engine/prompts.js` has all five variants (`opt`, `pick`, `modal`, `pay`,
   `reveal`), they are addressed to a side, and every one was driven in the real
   UI. See "Wiring a ruling to a prompt". What remains is per-card work: pick
   a ruling, write its spec, teach the parser whatever its text needs.
3. **Give the dummy an action phase.** Swing with a real card from hand instead of
   the scripted `[3,4,5][(turn-1)%3]` escalation. This retunes difficulty, so change
   it with a play session, not just drills.
4. **Dash** is mostly online as of v2.11 — Hyper Driver discounts, Out Pace,
   Fender Bender, Overblast, Under Loop. What's left is **crank** (prompt to spend
   the entering steam counter for an action point) and Boom Grenade's on-hit rider,
   which needs a hook that runs before every attack resolves. Then **Bravo**
   (pay-to-dominate, Seismic Surge tokens).
5. **Combo** keyword — unlocks Fai (Ninja) and Dorinthea (Warrior).
6. **Reload / Charge** — brings Azalea and Boltyn online.
7. Remaining hero abilities: Briar, Lyath. Timing-precision pass.

---

## Tone

The advisor and log speak like a sharp, warm coach at the table — concise, evocative,
never patronizing. Keep that voice in any new game text.
