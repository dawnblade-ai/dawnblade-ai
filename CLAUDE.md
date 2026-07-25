# Dawnblade — Flesh and Blood AI Training Sim

A single-file browser game: a Flesh and Blood sparring simulator where the player
pilots a real hero deck against an iron-armored training dummy, with an AI advisor
("Claude's call") reading the board.

**Live at:** dawnblade-ai.github.io (GitHub Pages)
**Current version:** v2.18

---

## The one hard constraint

**Everything ships as a single `index.html`.** No build step, no bundler, no module
imports, no external project files. It is served directly by GitHub Pages and opened
on an iPhone. Do not split it into modules, do not add a package.json build, do not
introduce a framework CLI. React and Babel come from CDN `<script>` tags.

File structure inside `index.html`:
- one `<style>` block (single `</style>` — CSS is appended before it)
- `script0` (`text/babel`) — loader, card resolver, UI shell
- `script1` (`text/babel`) — engine: FX parser, advisor, Ticker, ChainLink, CardFrame,
  Battle, WinPanel, Loadout, App
- a plain data `<script>` — CDN paths, `APP_VER`, `DATA_VER`, `HEROES`, `DECKS`, etc.

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
This is `node --test "test/*.test.js"` — currently 252 drills:
1. **Bracket balance** on both `text/babel` blocks (`test/html-balance.test.js`).
   String- and template-literal-aware, not regex-literal-aware — the three
   regexes with apostrophes are pre-neutralized inside the checker.
2. **Deck integrity** (`test/decks.test.js`): exactly 15 decks, each deck +
   gear summing to exactly 55 cards.
3. **Parser/game/advisor drills** (`test/parser.test.js`, `game.test.js`,
   `advisor.test.js`): `weaponCost`, `classifyClause` conditionals, the `{p}`
   pump parser, the Kayo printed-vs-granted regression, equipment wear, the
   fxParse memo gotcha.
4. **Sync guard** (`test/sync.test.js`): the parser/game/advisor/cards logic
   now also lives in `engine/*.js` (Phase 1 extraction), textually identical
   to the copies inside `index.html`. **Edit one side, mirror the other** —
   this test fails on drift. (index.html is still what ships; engine/ is not
   yet imported by it.) `engine/rps.js` is mirrored too, because the pregame
   UI calls it; `sides.js` and `priority.js` are engine-only so far.
5. **Multiplayer groundwork** (`test/sides.test.js`, `test/priority.test.js`,
   `test/rps.test.js`) — see "The two-player migration" below.
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
`makeSide()` defines the 41 fields a player needs in order to *be* a player;
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

**DONE as of v2.18.** Both seats carry all 41 fields, both are built by a single
`makeSide` call, and `flatRemaining` is **0** — nothing a hero owns lives on the
game object any more.

| | fields | native | still flat |
|---|---|---|---|
| player | 41 / 41 | 41 | 0 |
| opponent | 41 / 41 | 41 | 0 |

`P_MAP` and `O_MAP` are now empty. They stay as the ledger's shape: if a flat
per-side field is ever reintroduced it belongs in one of them, and the drills
hold it to that. The dummy's resources, action point, arsenal, pitch, banish,
soul and `hist` sit at their defaults because it pays no costs and takes no
action phase yet — inert-but-present is the point, and it is what lets a second
human occupy slot 1 without a single new field.

### Cost readers take a SIDE, not the game

`effCost(c, sd)` and `boardRed(c, sd)` are handed **one side**, because the
runechants and the board that discount a card belong to whoever is *playing* it.
Call them `effCost(card, you(s))` — passing the game would silently read side 0
for both players.

This one bit already: `boardRed` was not in the sync guard's SHARED list and
**drifted silently** during the migration — `index.html` read `sides[0].board`
while `engine/parser.js` read the raw object, and no drill noticed. It is in the
list now. **Anything the trainer shares with `engine/` must be in that list**, or
the lockstep rule is decorative.

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

## Rules fidelity

This is a rules-accurate sim, judged to pro-tour standards. Combat follows the
Comprehensive Rules: Attack → Defend → Reaction → Damage → Resolution.

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

**Decision 2026-07-25: no AI opponent.** The goal is real multiplayer — two humans,
each piloting a deck. The dummy stays as the solo trainer and as the proving ground
for symmetric state; do not build a deck-piloting AI.

1. **Make the state symmetric.** *Groundwork landed in v2.14 — see "The two-player
   migration" above.* `engine/sides.js` defines the shape, `toSides`/`fromSides`
   bridge to it losslessly, `engine/priority.js` holds the turn/priority machine,
   and the drills pin the gap at player 35 / opponent 12 of 41 fields.
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
