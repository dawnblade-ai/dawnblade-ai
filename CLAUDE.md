# Dawnblade — Flesh and Blood AI Training Sim

A single-file browser game: a Flesh and Blood sparring simulator where the player
pilots a real hero deck against an iron-armored training dummy, with an AI advisor
("Claude's call") reading the board.

**Live at:** https://dawnblade-ai.github.io/dawnblade-ai/ (GitHub Pages)
**Current version:** v3.84

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

### THE TEXT IS UPSTREAM'S, AND IT MOVES UNDER YOU (v3.00)

The corollary of the golden rule, and it cost 22 cards before anyone priced
it. The database is the-fab-cube's **`develop` branch**: it is edited, and
the game fetches it live. Between v2.84 and v3.00 an editorial pass reworded
**138 of this pool's 405 cards** — contractions expanded, "it" resolved to
"this", "its owner's deck" to "your deck", "or greater" to "or more". The
parser survived 116 of them. **22 stopped resolving, in production, and every
tool here reported success**: coverage printed a lower number without
comparing it to anything, the fairness sweep is one-sided toward cards that
are too STRONG, and `npm test` skipped.

- **`data/pool.json` is the pinned pool** — 764 records, every card the pool
  can reach, written by `tools/pin-pool.js`. **Fetched data, never authored.**
  The whole drill suite reads it, which is why the suite now needs no network
  and skips nothing.
- **The GAME still streams the live database.** Pinning the fixture must not
  pin the player, or errata stop reaching anybody.
- **`test/drift.test.js` is the ONE drill allowed to read the live wire.** It
  compares what the PARSER makes of each database rather than the text, so a
  rewording read identically is not an event, and it covers cards, **hero
  passives and tokens** — written for deck entries alone it would have missed
  Dorinthea, whose ability stopped being recognised entirely. Refresh with
  `node tools/audit.js --refresh` at the start of a release cycle.
- **READ BOTH WORDINGS.** `DATA_VER` keys a localStorage cache, so a player
  who opened the game last week holds the OLD text while a player opening it
  today gets the new; the two populations coexist until every cache turns
  over. `parser.js`'s `SYNONYMS` table levels the recurring idioms in one
  place — **every entry a synonym of one printed form, never a change of
  meaning**, which is why `has` is levelled only where it governs a pump and
  never where it asks a question ("if this has 3 rust counters"). Where the
  two wordings are genuinely not synonyms, widen the anchor instead.
- **An UNANCHORED match hides an unbuilt clause.** Stir the Aetherwinds read
  `full` because one loose regex consumed a whole sentence and modelled half
  of it; upstream splitting that sentence in two is the only reason anyone
  found out. Its tier is `part` now, on purpose.

- `DATA_VER` (e.g. `"sage-v13"`) keys the localStorage cache. **Bump it whenever the
  loader's schema or card-field handling changes**, or users will run on stale data.
- Printed keywords (`card_keywords`) and *granted* keywords (`granted_keywords`) must
  stay separate. Merging them caused the Kayo bug: conditional go-again was granted
  unconditionally.
- **`card_keywords` is a keyword INDEX, not a claim of unconditional possession
  (v2.31).** It lists every keyword *appearing* on the card, including ones the
  text only grants conditionally — so keeping it apart from `gkw` is necessary
  but **not sufficient**. Seeding `fx.ga` straight from it gave **27 pool cards
  unconditional go again against their own printed text**: Buckwild went again on
  an empty pitch zone, and Runerager Swarm logged *"condition not met"* and then
  went again anyway. Go again keeps your action point, so it is the most valuable
  keyword in the game to get wrong.

  The discriminator is the printed **layout**: the database puts real keyword
  lines in their own paragraph, so a printed go again stands alone on a line
  while a granted one sits inside a sentence. If the text never mentions it at
  all, trust the list. 77 cards keep it, 27 lose it, and the conditional path
  still grants it when the condition is actually met.

### THREE KEYWORD PREDICATES, THREE QUESTIONS (v2.84)

Reaching for the wrong one is how a keyword gets granted off raw text.

| | asks |
|---|---|
| `hasKw` | it appears ANYWHERE — list or text. **Deliberately loose and load-bearing**: 58 pool cards grant go again inside a sentence and really do gain it |
| `hasKwNow` | …and no `if`/`unless` gates every mention of it |
| `printedKw` | the card **CARRIES** it as printed rules text — nothing about whether it currently applies |

**An ADDITIONAL COST cannot be conditionally granted**, which is what
`printedKw` exists for. Boost is printed on the card or it is not — so
*"when you boost a card"* (Hyper Driver) and *"the next attack you boost
this turn"* (Re-Charge!) are **references to the mechanic**, and `hasKw`
answers TRUE for both. Offering their controller boost's cost is strictly
stronger than printed.

The trainer escaped only because `maybeBoost` also tests `isAttack` and
both cards are Mechanologist **non-attacks** — an accident, not the rule.
A non-attack that genuinely printed Boost would be wrong there.

---

## Versioning & release

- `APP_VER` bumps by 0.01 per release. It is displayed in-game.
- **v2.0x line starts at v2.01** (2026-07-22): marks the engine/ extraction +
  pool audit system. Below 2.0 = single-file-only history; 2.0+ = engine/ and
  index.html co-exist under the sync-guard rule (see below).
- After any change: validate (below), then **`git push origin main` — that IS the
  deploy.** `origin` is `git@github.com:dawnblade-ai/dawnblade-ai.git` over SSH,
  and GitHub Pages serves `main` at the root of the repo, so a push is live in
  about a minute. There is no build and no upload step.
  **Verify the push, not just the tests:** a Pages site can serve `index.html`
  and 404 every script, which looks fine until a tap does nothing. Check the
  URL returns 200 *and* that **every script the page actually loads** does.

  **DERIVE THE COUNT, NEVER STATE IT.** This line read "all 15 `engine/*.js`
  files" for a long time and the real number was 21 — the ledger grew and
  the sentence did not, which is a doc claim rotting (v3.41). The page loads
  every module except the HEADLESS ones, so ask the file:

  ```sh
  grep -o '<script src="engine/[a-z]*\.js"' index.html | sed 's/.*src="//;s/"//' | sort -u
  ```

  **AND WHEN THE LIVE URL IS UNREACHABLE, SAY SO** rather than reporting the
  deploy verified. A sandbox whose egress policy denies `github.io` can still
  check the half that causes those 404s — that every script tag resolves to a
  file in the PUSHED commit (`git cat-file -e origin/main:<path>`), and that
  `.nojekyll` is present, which is what makes Pages serve the files as-is.
  That is a real subset of the check, not the whole of it, and the difference
  belongs in the report.
  (Until 2026-08-03 this repo had no remote and the file was hand-uploaded
  through GitHub's web UI, which is why 55 commits read "Add files via upload".)
- **The per-version summary lives in `CHANGELOG.md`, not in `index.html`.** Until
  v2.32 it accumulated inside the `APP_VER` comment, which reached 14,723
  characters on one line and shipped to every player on every page load. Add a
  new section at the top of `CHANGELOG.md` and keep the `APP_VER` comment to a
  single sentence.

---

## Validation — run before every ship

Fast path, no network, run on every change:
```
npm test
```
This is `node --test "test/*.test.js"` — currently **1773 drills**.
`# skipped` must read **0** with a live database cached, and **4** without
one: those four are `test/drift.test.js`, which reads the live wire on
purpose. Anything else skipping means a fixture went missing.

**READ THE SKIP COUNT, NOT ONLY THE FAIL COUNT (v3.00).** Until v3.00 a
fresh clone ran this as **749 passes and 304 SILENT SKIPS**: every drill
that needs a card gated on `tools/.cache/card.json`, a 22MB download that
is gitignored. "1053 green" therefore meant "green on the machine that had
happened to fetch" — and on a clean clone it was hiding 22 pool cards that
had stopped resolving and a card sitting in two zones on the merged path.
The pool is pinned in `data/pool.json` now (`tools/pin-pool.js`), so the
suite needs no network and skips nothing. **A drill that skipped is not a
drill that passed.**
1. **Bracket balance** on both `text/babel` blocks (`test/html-balance.test.js`).
   String- and template-literal-aware, not regex-literal-aware — the
   offending regexes are pre-neutralized inside the checker.
   It also rejects an **orphaned comment terminator** (a block comment
   closed twice, so the prose after the first close becomes code). That is
   not hypothetical: it shipped in v2.27 and broke the page completely
   while all 338 drills stayed green, because the orphaned prose happened
   to contain balanced brackets. **Bracket balance alone cannot see it.**
   A regex ending in a star-slash looks identical to that, so add any new
   one to the pre-neutralize list rather than weakening the check.
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
   **It scans raw source, comments included**, so English prose that reads
   like a call trips it: a comment saying "both refusals it can give (…"
   made the guard report `give` as an unbridged bare call. Reword the prose
   rather than weakening the scan — same discipline as
   `html-balance.test.js`'s pre-neutralize list.
5. **Multiplayer groundwork** (`test/sides.test.js`, `test/priority.test.js`,
   `test/rps.test.js`) — see "The two-player migration" below.
   **`test/actor.test.js`** is the actor/perspective ledger: it fails if a
   MIGRATED rules function still reaches for `you(`/`opp(`, and if a PENDING
   one has quietly stopped — see "ACTOR vs PERSPECTIVE" below.
6. **The sync layer** (`test/wire.test.js`, `test/net.test.js`,
   `test/actions.test.js`) — serialization round-trips, the rules
   fingerprint, and two sessions driven at each other over a loopback
   with packet loss, desync and reconnect. See "The sync layer" below.
6b. **The Phase 1 rebuild** (`test/build.test.js`, `test/judge.test.js`,
   `test/types.test.js`, `test/sparring.test.js`, `test/journey.test.js`, `test/loader.test.js`,
   `test/fuzz.test.js`).
   `build.test.js` asks the two questions the eight-gear bug proved
   nobody was asking: is the loadout LEGAL, and is the build SYMMETRIC.
   `judge.test.js` drives **two real precons at each other** and watches
   a whole game — the first drills here that see a game rather than a
   clause. `sparring.test.js` holds the seat policy to its contract:
   every action legal, no card text, deterministic, and the winner
   following the hero rather than the chair. All skip cleanly without
   the cached DB.
   **ASSERT ON HANDS, LIFE AND ZONES — NEVER ON `feed` PROSE.** Two of
   v2.45's nine bugs lived under green drills that read the log: the end
   phase really did print (a) through (f) in order, and it really did
   say "draws to intellect". It was drawing for the wrong hero.
7. **Marker sweep** — grep for the new identifiers to confirm every edit landed.

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

### `npm run scenes` — DOES THE CARD *DO* WHAT IT PRINTS? (v3.70)

```
npm run scenes            every hero
npm run scenes azalea     one hero, or any name fragment
npm run scenes --all      every observation, not just the failures
```

**EVERY OTHER TOOL HERE ANSWERS A QUESTION ABOUT TEXT.** The audit asks
whether a clause was READ; the fairness sweep whether the reading is too
generous; `failstates.js` whether unread text is dangerous; `npm run play`
watches behaviour and **reads no card text by contract**. Nothing drove a
card and checked what HAPPENED — and six live defects went through that
hole in seven releases, **five of them in cards the audit called `full`**
(reload face-up, ward inert at the table, dominate unenforced, and the two
reaction abilities offered at action speed).

A scene sets up a real judge-shaped board, plays the mechanic, and returns
**named observations** — hands, life, zones, counters, action points.
**Never the feed** (v2.45: two of nine bugs lived under drills that read
the log, where the end phase really did print (a)–(f) in order while
drawing for the wrong hero).

**THE SCENES ARE DATA WITH TWO READERS.** `tools/scenes.js` prints the
report and `test/scenes.test.js` runs the same objects as drills, so a
green suite and a green report cannot disagree — the no-mirror rule, in
the place a report would otherwise rot.

**IT ANSWERS A QUESTION THE DRILLS CANNOT.** `test/` is organised per
MECHANIC, which is right for building a reader and useless for *"does
Azalea work"*. The hero comes from the **filename**, so a scene cannot
claim to be about a hero whose file it is not in.

**EACH SCENE CARRIES ITS `why`** — the defect it exists for, which is a
re-sabotage instruction rather than documentation. All eight defects the
first scenes were written against were reintroduced and all eight were
caught.

**TWO RULES ARE DRILLED**: a scene observes at least two things (one
observation is usually asserting that nothing crashed), and an observation
returned but never checked is a FAILURE rather than a silence.

**AND THE FIRST SCENE WAS WRONG, NOT THE ENGINE.** It invented a `{zone}`
argument `pow6` does not take. Check your own fixture before believing a
new instrument — v3.50's sabotage pass found four weak drills to four real
bugs.

### AN ATTACK REACTION'S GO AGAIN IS THE TARGET'S (v3.74)

> *"Target attack with {p} greater than its base **gets go again**."*

`fx.ga` read that as the ABILITY's own, so activating one handed its
controller an **action point** (CR 5.3.5 — go again is a GAIN, not a
refund). **Three of the pool's four attack-reaction abilities print the
shape** — Bolt'n Boots, Stalker's Steps, Boltyn's hero — and **not one**
prints a go again of its own. The first two have done it since v3.63
built the route.

**INVISIBLE TO EVERY TOOL HERE**, for v3.73's reason two versions
running: a powCard is built by `build.js` out of a printed line and is
NOT a pool card, so neither the audit nor the fairness sweep looks at
one. Driving the ability is the only thing that does.

The ability's OWN go again arrives as a **keyword**, put on the powCard by
`build.js` from `parseHeroPower`'s trailing read — so reading `kw` keeps a
real one and drops the payload's. Its ops were already held back one line
down, for the identical reason.

### A DEAD BUTTON IN BOTH DIRECTIONS AT ONCE (v3.74)

The trainer's hero-power button tested `heroPow.kind === "instant"` and had
no case for an ATTACK REACTION — so Boltyn's ability was **enabled in the
action phase**, where `tryPlay` refuses it, and **disabled in the stack
window**, where it is the only legal play.

`parser.abWindow` is the one reader of which window an ability has (v3.63);
what belongs in the trainer is its mapping from that window to its own
`mode` vocabulary, stated once in `heroPowWindowOK`. **v3.63's rule one
site further out**: there it was the powCard BUILDERS that needed grepping,
here it is the places that OFFER what they built.

### BOLTYN — THE SOUL, AND A COST NOTHING CHARGED (v3.74)

Five deck cards and both hero clauses are soul-shaped, and the hero read
nothing.

**CLAUSE 1 IS TWO GATES ANSWERED IN TWO PLACES.** *"You've charged this
turn"* is his own turn history; *"while defended by an attack action
card"* is a fact about the WALL, so it lives in `linkPumps` beside the
late conditions — and **which cards defend is the CALLER's answer**, the
same split the wall itself keeps. A caller that says nothing answers no.

**HE PRINTS 1, SO NO POOL FIXTURE CAN TELL A READ NUMBER FROM A HARDCODED
ONE.** Sabotaging the capture to a literal was SILENT against every driven
drill; a synthetic hero record is what sees it (v3.32).

**CLAUSE 2 IS BOLT'N BOOTS' SHAPE ONE COST OVER.** `parser.abSoulCost` is
the one reader, both boards refuse an empty soul BEFORE the ability
resolves (v3.11), and `execute` guards it too — an unpayable cost is
INERT, never free (v2.04), because `reduce` is fed by JSON off a wire.

**THE REFUSAL WAS RECORDED, AND IT CAME DUE.** `test/rxability.test.js`
carried the reason in its own assertion text — *"his cost is a soul banish
nothing builds"*. Third recorded refusal discharged this fortnight, and
the drill keeps him as its POSITIVE control now: one that only ever
asserts `skip` passes against a credit that was deleted outright.

### BRAVO — AND THE MACHINERY HE NEEDED ALREADY EXISTED (v3.73)

> *"Action - {r}{r}, {t}: Turn a face-down card in your arsenal face-up.
> If it has crush, it gets +2{p} and dominate this turn. Go again"*

His deck read **100%** and his hero read **0%** — the sharpest
illustration in the pool of why deck coverage was never the binding
constraint. And Azalea's v3.71 build already turns a card face up, fires
its triggers and stamps a conditional bonus onto it; the `{t}` route has
charged a hero tap since v3.48. **What was missing was the EVENT and the
keyword test.** Before building machinery for a shape, check whether the
machinery is the shape you already have (v3.58, again).

**ONE READER FOR TWO HEROES' GRANT SENTENCE.** Azalea tests a TYPE and
stamps a keyword; Bravo tests a KEYWORD and stamps power AND a keyword.
`arsGrant` is the one matcher with a discriminator — two nearly-identical
regexes is where the drift starts.

**AND IT IS MATCHED ON THE LEVELLED CLAUSE.** A whole-card reader scans
`fx.clauses` RAW, so `SYNONYMS` has not reached it, and `it's` levels to
`it is` (v3.36) — which the database already prints BOTH ways. An anchor
spelling only the contraction works today and dies the moment upstream
levels the other way.

**`printedKw`, NEVER `hasKw`** (v2.84's three questions). **Crash and
Bash is the one pool card that tells them apart** — it prints *"reveal a
card WITH CRUSH from your hand"* and carries none. Drilled against an
ordinary non-crush card the assertion is SILENT under sabotage, because
the two predicates agree on every other card in the pool (v3.26).

### TURNING IS NOT PUTTING (v3.73)

Spire Sniping alone prints *"put **or turned** face up"*; every other
arsenal trigger in the pool says *"put"*, and Bravo's ability is the
pool's only card that TURNS one. Read off the clause rather than
defaulted either way: defaulted true, four of Azalea's arrows gain a
bonus their text never grants; defaulted false, Spire Sniping loses a
printed line of play.

**Measured before it was carried** — no deck holds both (Bravo is
Guardian, the arrows are Ranger), so it is LATENT. It is still a printed
distinction, and a reader that ignores one is reading the card wrong
whether or not anything notices today. Same treatment v3.65 gave the
ally-attack route.

### A HERO POWCARD IS NOT A POOL CARD (v3.73)

`fxParse`'s whole-text self-pump fallback read Bravo's *"it gets +2{p}"* a
**second** time and queued it as a pump for his next attack — whether or
not the card had crush. v2.33's Bull's Eye Bracers trap ("it" is the card
in the ARSENAL) one hero over, and VALUE-DOUBLED on the fairness sweep's
own terms.

**NO TOOL HERE WOULD HAVE SEEN IT.** The audit and the sweep both walk the
POOL, and a hero powCard is built by `build.js` out of the hero's printed
line — it is in neither. **Driving the ability is the only thing that
looks at one.** The fallback's existing magnitude test is what suppresses
it, so a card printing two different pumps still gets its unread one.

### A REORDER IS NOT AN OPT (v3.72)

Spire Sniping prints *"look at the top 2 cards of your deck, then put them
back **in any order**"*. Opt lets you send cards to the **BOTTOM**, so
reading it as opt is wrong in both directions at once: stronger, because
a card could be buried — and it would fire **Blaze's** *"whenever you
OPT"* energy trigger off a card that does not opt. **A card does not opt
because it looks.**

`lookOrder` is its own op, sharing the opt SHEET behind a `keepTop` flag
(one line in `applyPrompt`) and nothing else. **With one card there is no
order to choose**, so the sheet skips itself — and unlike an opt there is
no "or the bottom" alternative to make it a decision.

**IT WAS A RECORDED REFUSAL, AND THE DRILL WENT RED THE MOMENT IT WAS
BUILT.** `test/parser.test.js` carried the reason in its own assertion
text for two versions. That is what a recorded refusal is FOR (v3.38),
and it is the second one this fortnight to come due by building the
payload rather than by loosening a reader.

### A TRIGGER WITH NO EVENT, AND THE FAMILY BEHIND IT (v3.72)

Crow's Nest — her SPECIALIZATION — reads *"whenever an arrow is put
face-up into your arsenal **from your deck**, you may pay {r}. If you do,
put an aim counter on it."* **Nothing in the pool could do that** until
v3.71 built her hero ability. It is also the pool's **ONLY source of aim
counters**, which three of her arrows read: a whole family dead behind
one hero ability.

- **THE WATCHER IS NOT THE CARD BEING PUT** — a Quiver in the GEAR zone,
  so a board-only scan finds nothing (v3.33, v3.55: both zones).
- **THE SOURCE ZONE IS THE CALLER'S ANSWER.** `applyAnswer`'s route puts
  from HAND and so does `heave`; a default of `"deck"` fires this off
  every reload, which is v3.69's bug one trigger over. A caller that says
  nothing gets no trigger — weaker than printed and visible.
- **"IT" IS THE ARROW THAT WAS PUT**, so the destination is decided in
  `fxParse` where the whole card is visible. Read off the piece alone,
  `["aim",1]` lands on whatever is on the chain — a different card, on a
  different turn.

### WHEN YOU BUILD A SOURCE, ASK WHICH CONDITIONS IT JUST MADE REACHABLE (v3.72)

*"If **this** has an aim counter"* was evaluated as *"does ANY counter bag
on my side hold an aim counter"* — so one aimed arrow would have pumped
**every other arrow in the deck**. It was unreachable for exactly as long
as it was wrong, because Crow's Nest is the only card that can make one
and its trigger had no event to fire on.

**v3.57 states this rule about a CONDITION** (a new gate can expose
payload paths that were never asked to carry one). This is the same
sentence about a SOURCE, and it is the more dangerous direction: a
condition nobody can reach is an approximation with no cost, right up
until the turn somebody builds the thing that reaches it.

### AN AURA THAT IS A WEAPON (v3.84)

> *"During your turn, auras you control with **ward** are weapons with
> base {p} equal to their **ward** and \"Once per Turn Action - {r}:
> Attack\". Your aura attacks with one or more +1{p} counters get go
> again."*

**ENIGMA'S WHOLE ENGINE.** The Spectral Shield token's entire printed text
is *"Ward 1"* — no attack at all — and her hero's clause 1 prices *"your
first Spectral Shield ATTACK each turn"*. Cosmo is what makes that attack
exist.

**THE ROUTE IS `from: "aura"`, `from: "ally"`'s TWIN** (v3.44), so
everything after the seam came free. What is new is that **the grant comes
from a DIFFERENT CARD** — an ally prints its own attack, an aura is handed
one by whatever is equipped — so `parser.auraAttackOf` takes the SIDE, and
*"during your turn"* is the caller's answer **with no default**.

**THE POWER IS THE PRINTED WARD**, and Cosmo's own text is what settles
that reading: *"base {p} equal to their WARD"* is a number the aura
CARRIES, not the side's prevention pool. Spectral Shield prints 1 and
Waxing Specter prints 3, so a hardcoded 1 is right for one and wrong for
the other — fifth time that fixture rule has been needed.

**WHETHER A BOARD AURA'S WARD ALSO FEEDS THE PREVENTION POOL IS OPEN** and
is deliberately not decided — see HANDOFF.md.

### A GUARD BELONGS TO THE SHAPE — THIRD OUTING (v3.84)

`declareAttack`'s `inPlay` guard was written for weapons (*"a weapon stays
equipped, so it never leaves the gear zone"*), told about allies at v3.44,
and had to be told a **third** time. Measured before it was: **3182
`CARD-IN-TWO-ZONES` violations in 210 self-play games**, the board and the
chain both holding the same aura.

**The shape is "an ACTIVATION route leaves its card where it is"**, and
every new source of attacks belongs there the day it is built. A drill
asserts the guard names every route.

### A ROUTE WITH NO CALLER IS NOT BUILT — THIRD TIME IN ONE CYCLE (v3.84)

`sparring.js` reads no card text by contract, and an aura's power is its
printed WARD rather than a `power` field — so the route existed and
nothing could propose it. v3.50's allies, v3.80's non-attacks, and now
this.

**ASKING JUDGE IS IN CONTRACT.** `judge.boardAttackOf` answers for both
routes and the policy asks judge, which keeps ONE reader (judge asks the
parser) and leaves `sparring.js` free of card text. **Measured: Enigma 3
wins → 24, and the first 210-game run with ZERO stalls.**

**WHEN YOU BUILD A ROUTE, GO AND COUNT HOW OFTEN IT FIRES.** Three times
in one cycle the answer was zero.

### EPHEMERAL WAS READ THREE WAYS ACROSS TWO FILES (v3.82)

| reader | tested |
|---|---|
| the trainer's `gy()` | the **keyword list** |
| judge's `toGrave` | a printed **reminder sentence** |
| judge's `effectsFor` stamp | the same reminder sentence again |

**Measured over all 797 records: ONE card is ephemeral by keyword and NOT
ONE prints the reminder text.** The database carries no reminder text for
any keyword — this file says so in four other places — so both of judge's
readers matched **nothing, ever**, and Crouching Tiger reached the
graveyard at the table while the trainer correctly dropped it. A card the
rules REMOVE FROM THE GAME, handed back to the player, on the board that
is supposed to be the CR-exact one.

v3.01's shape, with the twist that the strict board is the one that had it
wrong and its reader was written against text that has never existed.

**`parser.isEphemeral` is the one reader, and it asks `printedKw`** —
v2.84's three questions. A card that merely MENTIONS ephemeral does not
have it, and removing it from the game would be the golden rule broken at
the keyword level. No pool card tells the two predicates apart, so the
drill uses a **synthetic near-miss** (v3.73's Crash-and-Bash
discriminator, one keyword over).

**WHEN A READER TESTS REMINDER TEXT, GO AND COUNT THE RECORDS THAT PRINT
IT.** Twice now that count has been zero.

### THE DEAD `rune` FIELD, AND TWO DOC CLAIMS THAT WERE BOTH FALSE (v3.82)

This file said from v2.23: *"There is no `sd.rune` field any more — a
drill would fail if one came back."* **Both halves were false.** The field
was still declared in `makeSide`, still shipped down the wire, and **read
by nothing at all for sixty versions** — while `sides.js`'s own comment
two lines above cited `rune` as an example of a field *already retired*,
reasoning from the thing it stood next to.

Dead rules STATE is worse than dead code elsewhere: it reads as a rule
somebody can reach. Retired from `SIDE_FIELDS`, `makeSide` and `wire.js`
(`WIRE_V` → 2, because the payload shape changed), symmetry ledger **47 →
46**, and the promised drill now exists — it holds every derived count
(`rune`, `frost`, `rot`, `fra`) to having no stored twin.

### A SCENE'S FIXTURE MUST NAME ITS CARD (v3.82)

Three of the eight new scenes were wrong before the engine was:

- the Viserai rite scene took *"the first Runeblade non-attack in his
  SHUFFLED deck"* — a different card under a different seed, and it landed
  on **Mauvrion Skies**, whose own text queues a Runechant. **A fixture
  that depends on a shuffle has not named what it is testing.**
- the Iyslander scene omitted **`notYourTurn`**, the clause's own first
  gate and the entire point of the card, and read the grant as dead.
- the Fai scenes asserted two things that had not been measured.

**Check your own fixture — sixth, seventh and eighth time.**

### NAMING THE HERO IS A JUDGEMENT TOO (v3.81)

`sparring.offence` returned `target: "hero"` unconditionally, and the note
above it said choosing was *"a judgement about playing well that this
policy does not make"*. **Naming the hero is a judgement too, just an
invisible one** — and it left the whole ally-combat branch, built across
v3.44, v3.45 and v3.46, with ZERO coverage. Driven: the old target
produces **0 ally deaths in 20 games**, the choice produces **57**.

**THE RULE IS TWO CR FACTS AND TWO PRINTED NUMBERS**, which is what keeps
it inside the no-card-text contract:

| | |
|---|---|
| CR 7.3.2a | an attack on an ally **cannot be blocked** — it always connects, so `power >= life` is a guaranteed kill |
| CR 4.4.3a | ally life **resets** at end of turn, so anything short of a kill is thrown away |

Take an ally when this swing kills it outright AND it prints power of its
own; otherwise the hero, still the answer that is always available. **The
uid is the ENTRY's, not the card's** (v3.50's coincident-fixture trap).

### A COUNTER THAT SPELLS THE WRONG WORD REPORTS ZERO (v3.81)

`tools/selfplay.js` counted ally deaths with `/dies|died/` and the engine
prints *"…takes 6 and **goes down**"*; it counted Gold with `/Gold token/`
and the mint prints *"**Gold created** on your board"*. So `death 0, gold
0` stood for three versions — **the last of them after the route already
worked.**

**A SCAN AIMED AT THE WRONG WORD REPORTS ZERO EXACTLY AS A MISSING
FEATURE DOES.** v3.00 records the same defect with the opposite sign: a
source scan aimed at the wrong FILE *passes* by finding nothing, and this
one *failed* by finding nothing. v3.50's own lesson — *"`death 0, gold 0`
is how the ally gap announced itself"* — was written about this counter,
which makes it the second time the same instrument has been believed.

A drill pins the counter's phrase and the engine's phrase **together**, so
a rewording of either breaks a test rather than silently zeroing a count.
**death 0 → 167 · gold 0 → 24.**

### THE POLICY COULD NOT PLAY A NON-ATTACK (v3.80)

`sparring.offence` filtered its candidates on **`num(x.c, "power") > 0`**,
and a non-attack prints no power — so the policy could not play one from
any zone in any state, and never had. Measured over the fifteen precons,
the share of each deck it could never touch: **Dorinthea 91%, Blaze 88%,
Iyslander 85%**, Enigma 62%, Gravy 55%, Viserai/Arakni/Lyath 52%, Briar
48%, Azalea 45%, Kayo 4%.

**THREE SYMPTOMS NOBODY HAD CONNECTED.** Iyslander and Enigma won ZERO of
210 games and Blaze won 2; every one of the 7 stalls was between two of
those three; and a stalled game was literally **both seats passing forever
with four LEGAL plays in hand**. v3.50's sentence one source over: *a
feature with no caller looks exactly like a feature that works, until you
count.*

**AND THE HARNESS WAS EXERCISING HALF THE ENGINE.** Every arcane, aura,
token mint and pump in the pool rides on a non-attack.

**IT SITS LAST, AND THE ORDER IS A PRINTED-NUMBERS ARGUMENT.** Everything
above it deals damage or spends no card; a non-attack spends a card AND
the action point, and a card in hand can always block. `cost` and `pitch`
are printed numbers and `legal` answers the rest, so the no-card-text
contract is untouched. Stalls **7 → 1**, and every hero wins games.

### AN ACTIVATION READS ITS COST THREE TIMES (v3.80)

| reader | asks |
|---|---|
| `judge.legal` | could this seat **raise** it? (pool + what it can pitch) |
| `judge.doActivate` | must a **payment** open? (pool alone) |
| `effects.execute` | **charge** it |

**Only the third used `effCost`.** Driven: Briar activating Scorpio, Comet
Tail (printed `{t}`, so 0) **under a Frostbite**, which taxes +1. `legal`
said yes against 0, `doActivate` saw `0 > 0` and opened no payment, and
`execute` charged 1 into a seat holding 0 — **`res: -1`**, `NEGATIVE-RES`,
CR 4.4.3e, and the `legal`/`reduce` agreement `fuzz.test.js` exists to
hold.

**v2.80 FOUND THIS ON THE PLAY ROUTE AND LEFT IT WRONG ON ALL THREE
ACTIVATION ROUTES.** Its own words: *"`effCost` is READ TWICE and the reads
are different questions."*

**THE ALLY BRANCH STAYS PRINTED, DELIBERATELY** — `execute` charges
`allyAttack(card).cost` there, not `effCost` (v3.44). **Each read asks
what its own charge site asks**, and a sabotage switching the ally branch
fails two drills.

**IT NEEDED THE POLICY FIX TO BECOME REACHABLE**, because a Frostbite
arrives on a NON-ATTACK. A guard rail is only as good as the states that
reach it — which is the argument for `npm run play` stated from the third
end now.

### `PENDING_KINDS` IS A CENSUS, AND THE POLICY WAS A THIRD BLACKLIST (v3.80)

v3.35 made `judge.PENDING_KINDS` a census because the TABLE's demux was a
blacklist. `sparring.payAction` was the same shape: it branched on `boost`
and fell through to a `paySel` that `legal` REFUSES. Unreachable until
now, and for a precise reason — **`split` and `addPay` are both opened by
non-attack plays**. Measured: 21 refusals in 210 games, every one Burn Up
// Shock. **When a census exists, grep for every consumer of it.**

### THE ONE REMAINING STALL IS A REAL DRAW (v3.80)

`iyslander-boltyn-0` runs to turn 1566 with **both decks empty**, two
cards in each hand, and `Raydn, Duskbane resolves for 0` forever. CR 4.5.3
has no deck-out loss — three ways to lose and no more — so it is a genuine
unwinnable board, not an engine defect. Recorded rather than "fixed" by
inventing a rule.

### A CARD AT `none` WHOSE PAYLOAD PARSES IS A COST OR A TRIGGER (v3.79)

**The cheapest diagnostic in this project, and it moved two cards.** Both
Radiant Touch and Back Alley Breakline read tier `none` while their
payloads — `ward 2` and `ap 1` — parsed perfectly on their own. Only the
COST PREFIX and the TRIGGER refused, and each was waiting on machinery
built two versions earlier and never gone back for.

v3.47's rule, restated from the other end: *when you build a mechanic,
sweep the refusals that were waiting on it* — and the way to find them is
to run every `none` card's payload through `classifyClause` by itself.

**RADIANT TOUCH.** *"Instant - Banish **this and** a card from your soul:
Prevent the next 2 damage…"* — the `ward` pool is v3.67's, the soul cost
v3.74's, and the anchor demanded the soul be the WHOLE cost. One optional
middle: it is the same cost with a second object, not a second reader.
**The self-banish is the drawback and it lands** — a prevention pool you
can raise every turn for one soul card is a different card.

**AND THE EQUIPMENT POWCARD BUILDER HAD NEVER STAMPED A SOUL COST.** v3.74
taught the parser and stamped the HERO builder alone, so an equipment
ability printing the identical cost was built with the cost silently
DROPPED — the free-ability bug v2.04 fixed. **v3.63's rule, second
outing: when you add a flag to one powCard builder, grep for the others.**

**`sweepGear` HAS TWO DESTINATIONS NOW, READ OFF THE MARK.** A destroyed
permanent goes to the graveyard (the 2026-08-29 ruling); a **banished**
one is out of the game, and the two `retrieve` cards fetch gear out of a
GRAVEYARD — so filing a banished piece there hands back a card the text
removed from play. One sweep, because v3.54's index hazard is the same for
both, and it is **marked rather than spliced** for that reason: this is an
Instant, playable during exactly the block whose `blockG` holds indices.

**BACK ALLEY BREAKLINE.** *"…puts this face-up into a zone **from your
deck**, gain 1 action point."* v3.71 built that event for Azalea's cycle.
**A DIFFERENT TRIGGER, NOT A VARIANT OF `arsenalUp`** — that one fires on
any face-up put, so routing it there pays an action point off a put from
the HAND. It fires AFTER the card is face up and after the line that says
so, because the sequence is the lesson (v3.60).

**LATENT, MEASURED, AND READ CORRECTLY ANYWAY.** Azalea's ability is the
pool's only source of the event and the card is in GRAVY BONES' list, so
no deck holds both halves — v3.73's rule. **And the measurement's own
fixture was wrong first**: it spelled *"face up"* where the card prints
*"face-up"*, found nothing, and reported the event unreachable — which
looks exactly like a correct latency result. **Check your own fixture,
sixth time**, and prefer the field the engine sets to a regex over text.

### LYATH — THE LAST UNFAIR ENTRY, AND WHY IT IS SPENT AT THE DEAL (v3.78)

> *"The base {p} and {d} of cards you control are halved, rounded up.
> **(5 becomes 3.)**"*

**THE ONLY UNBUILT DRAWBACK IN THE POOL.** `npm run sweep`'s UNFAIR block
carried exactly one entry from v3.21 to v3.78 and this was it, so he
played **strictly better than printed** for nineteen versions — the
direction that steals games — while the tool reported it every run.

**THE PRINTING SETTLED THE ROUNDING, FOURTH TIME.** `functional_text`
stops at *"rounded up"*; the **SLY001 card face** carries *"(5 becomes
3.)"*, which rules out floor and round-half-even on its own. Clash of
Agility, Thunder Quake, Pick Up the Point, and now this —
`card.printings[].image_url` is in the pool record. **The `ceil` matters
most at the BOTTOM of the range**: a 1-power attack halves to 1, and
floor reads it as a blank.

**IT IS SPENT AT THE DEAL, AND THAT IS THE WHOLE SAFETY ARGUMENT.** The
alternative was a `halve` flag threaded to every site that reads a base
value — the attack declaration, `linkPumps`, `defendValue`, `gearDef`,
the `pumped` condition, phantasm's 6-power popper, every prompt filter,
and every total shown to the player. **Thirty call sites is thirty chances
to leave one out**, and v3.23 already states that half-building a value
change is *worse than the honest gap*. `build.halveCard` runs once, over
the deck and the gear; one place cannot be half-built, and **the display
is right for free**.

- **Non-destructive**, printed value kept on `_printedPow`/`_printedDef`.
- **The stamp is opt-in** (v3.58) — only where the value actually MOVES.
- **Power and def only.** An ally prints power and **life**, and life is
  not {d}: the card names two symbols and neither is health.
- **The gear halves BEFORE any wear**, or `gearDef` halves a `curDef`
  that has already been counted down.
- **The counters are not the base.** `effects.js` folds a +1{p} counter
  into what it calls the swing's base — right there — but this line says
  BASE, so the printed number halves and the counter rides on top.

**A DEAL-TIME PASSIVE CREATES A COUPLING, SO DRILL IT.** A hero who
gained the halving MID-GAME would not re-halve an already-dealt deck.
Arakni is the only hero who changes (v3.76); measured, none of her six
Agents prints it, and a drill fails the day one does.

### A TURN-SCOPED GRANT IS NOT A BOARD STATIC (v3.78)

> *"Defending action cards you control get +1{d} this turn."*

Briar's `defGrant` sits in the arena and `defendValue` finds it by walking
the board. Lyath's is fired by an **activated ability**, applies to cards
nowhere near the board when it fires, and expires with the turn — **a
board walk cannot see it and a grant cannot be re-derived**. It lives on
the side (`defActionBuff`), and `defSide` is already the card's
CONTROLLER, so no caller can forget to say.

**IT IS A WINDOW, NOT A CHARGE.** Every action card he declares this turn
gets it; a grant consumed by the first block is weaker than printed. It
**accumulates** rather than being assigned, or a second source is dropped.

**AND THE SUBJECT IS THE UNION, NEVER THE COMPLEMENT.** `isActionCard` is
*not* `!isNonAtkActionCard`: a Defense Reaction carries no Action at all,
so the complement of one twin sweeps in a whole type the line never names
— v2.44's *"Reaction" contains "action"* one predicate over.

**THE TWO CLAUSES COMPOSE, AND THAT IS THE HERO.** Goon Beatdown prints
3{d}, is dealt at 2, and the boo lifts it back to 3. A drill testing
either half alone never sees that the numbers have to meet.

### ADDING A DUPLICATE BESIDE A DUPLICATE IS THE MOMENT TO LOOK (v3.78)

`isNonAtkActionCard` was written in `effects.js`, **MOVED** to
`parser.js` at v3.31 when `qualMatches` needed it — and a byte-identical
copy stayed behind. Two bodies of one rule is the no-mirror rule broken
inside the engine, and it is the shape that makes a sabotage silent:
change one copy and the other keeps the drill green (v3.41's
`quotedText`). Found only because a THIRD sibling was being added.

**Measured: 21 sabotages, 21 bite, 0 silent. Self-play Lyath 20 wins →
11** — the UNFAIR claim made concrete, and he lands mid-pack rather than
collapsing because the boo rider buys some back.

### TARANTULA — AND A TRANSFORMATION THAT WAS A DOWNGRADE (v3.77)

v3.76 gave Arakni six Agents to become and **every one of their abilities
REFUSED** — five on a `Discard an Assassin card` cost `parseHeroPower`
declines by design, Trap-Door's on a deck search. So the mechanic worked,
announced itself in the feed, swapped the hero's whole ability half, and
made her **strictly worse**: she lost the stealth passive she has and
gained an ability nothing reads.

**That is the no-op blind spot wearing a hero's face**, and it is worse
than an unbuilt card, because the game TELLS the player something
happened.

> *"Whenever a **dagger** you own hits a **hero**, they lose 1{h}."*

**THE EVENT IS ALREADY ON HER BOARD.** Mark of the Huntsman ×2 is in her
own gear and is a real swinging Dagger, so nothing had to be built for the
trigger to be reachable — `linkPayload` is the site, beside
`weaponRefresh`, and `heroHit` has been the caller's answer since v3.45.
*"Lose {h}"* is read as damage, the reading the parser already gives the
printed phrase one rule over.

**THE PRINTED SUBJECT IS AN OBJECT, NOT A ROUTE.** The first draft also
gated on `from === "weapon"`, which the card never says: *"a dagger you
own hits a hero"* is silent about HOW it hit. `pend.card` is the resolving
card on every route, so the type test is the only thing the line actually
restricts. **Measured before dropping it** — the pool prints exactly two
Dagger records and both are Weapons, so nothing moves today; a
Dagger-typed ally or attack card would have been silently refused, which
is v3.65's ally-attack route one card over.

**AND A `total > 0` BESIDE IT WAS DEAD — v3.67, IDENTICALLY.** Both
callers fold it into `heroHit` already (the trainer `total > 0`, judge
`total > 0 && not an ally`), so it could never fire on its own: a second
description of CR 7.5.5 sitting beside the one that governs. Sabotage
found it, as it found `off > 0`. **Dead RULES code is worse than dead code
elsewhere** — it reads as a rule somebody can reach.

Removing it also made the OTHER sabotage expressible: with `total > 0`
gone, dropping `heroHit` fires the drain off a fully blocked swing, so the
existing blocked-swing drill bites where before it could not. **A
redundant guard does not only fail to test anything — it hides the drill
that would.**

**FOUR SILENT SABOTAGES, FOUR BETTER FIXTURES.** Every one is a shape this
file already names, which is the point of running the pass at all:

| sabotage | silent because | seen by |
|---|---|---|
| the magnitude hardcoded to 1 | **she prints 1** | a synthetic Agent printing 3 (v3.32, v3.74) |
| `heroHit` dropped | the trainer wires no ally targeting | `linkPayload` driven directly, both halves (v3.45) |
| the route re-invented | no non-weapon Dagger exists | a synthetic Dagger-typed attack card, with a Sword control |
| the word boundary dropped | nothing real spells one subtype inside another | a *"Daggerfall Sword"* near-miss — v2.44's trap, third outing |

**AND THE FIXTURE WAS WRONG BEFORE THE ENGINE WAS.** The ally drill
expected the dealt damage in the life total; `linkPayload` is handed the
damage **already subtracted** — its own header says so — so what comes
back is the drain alone. Check your own fixture, fifth time.

### ARAKNI — A HERO THAT CHANGES MID-GAME (v3.76)

> *"At the beginning of your end phase, if an opponent is **marked**, you
> become a random **Agent of Chaos**."* — and every Agent prints *"At the
> beginning of your end phase, **return to the brood**."*

**THE DATABASE CANNOT NAME ITS OWN SET.** No `types` entry, no `subtypes`
entry and no `type_text` anywhere in 4,952 live records contains the word
"Agent". A hand-written list is inventing card text at the SET level, so
the set is derived from the two things that ARE printed: the **class** the
sentence names (captured as a STRING, v3.21's rule) and the **Demi-Hero
type**, read off the structured array. Exactly six records — the same six
her own `referenced_cards` lists.

**BECOMING ONE SWAPS THE ABILITY AND NOTHING ELSE**, and that is a
MEASUREMENT rather than a simplification: every Agent prints `health: "*"`
and intellect 4, and Arakni prints intellect 4. `build.heroAbilities` is
that half, extracted so the deal and the swap call one body.

**RETURN RUNS BEFORE BECOME.** Reversed, she becomes an Agent and
immediately returns, and the mechanic is invisible.

**THE PICK IS SEEDED AND THE SET IS SORTED.** "Random" has to be
reproducible: two peers replaying one log pick the same index out of the
same stream, and an unstable order makes them different Agents (v2.26).

**AND READ THE CLASS BEFORE THE SWAP** — the swap overwrites the very
field that named the set, because an Agent carries no `becomeAgent` of its
own. The first draft read it for the feed line afterwards and threw.

### A CLOSURE CANNOT HOLD A THING THAT CHANGES (v3.76)

The trainer read its build ledger out of `built.both`, a `useMemo`
constant — **immutable by construction**. Every rule up to now asked a
build a question whose answer never moved, so nothing noticed; the first
rule that CHANGES a hero could not reach that board at all. The feed would
have announced the transformation while every passive kept answering for
the hero she used to be: v3.01's one-board shape, created deliberately
rather than found.

`builds` is a `GAME_KEY` now — it has always been shared state at the
TABLE, where `judge.newMatch` puts it there — the trainer seeds it with the
construction inputs stripped exactly as judge strips them, and **all three
build helpers take the state**. `bOf` used to close over `g`, which inside
a `setG` reducer is the PREVIOUS state: harmless while the only thing it
read was `_dummy`, and a stale read waiting for the day a build moves.

**WHEN A NEW KIND OF THING BECOMES MUTABLE, GREP FOR WHO HOLDS IT.**

### A DEMI-HERO IS KEPT BY ITS TYPE, LIKE A TOKEN (v3.76)

The six Agents are records no deck lists. `tools/pin-pool.js` keeps them by
type and `index.html`'s loader keeps them by the identical test — one rule,
two readers, because a pool the Node tools can see and the phone cannot is
v3.21's fixture-and-production split. **`DATA_VER` moves with it**: a warm
cache has no Agent to become.

**THEIR ABILITIES STILL REFUSE, AND THAT IS THE POINT OF PUTTING THEM IN
THE POOL.** Five print `Discard an Assassin card` — a cost
`parseHeroPower` declines by design — and Trap-Door's is a deck search. A
transformation into an ability nothing reads is the no-op blind spot if it
ships quietly, and the opposite of it once the audit counts those clauses
every run.

### AZALEA — THE HERO ABILITY *IS* THE DECK (v3.71)

Her deck read **28 of 32 `full`** and her hero read **nothing at all**.
`parseHeroPower` refused the line, so `build.js` built her no powCard and
neither board could offer it — while every arrow in the deck triggers on
being put **face UP** into the arsenal and **Crow's Nest** watches for one
put face-up **from the DECK**, which nothing in the pool could do. Read
the hero ability before the cards (v2.55, Kayo), for the second time.

**THREE SENTENCES, ONE OP.** Two of them reach across the clause split —
*"if you DO"* names the first sentence's put, *"IT"* names the card the
second one moved. Three independent ops would need `runOps` to thread
"did the last one fire" and "which card was it" between them, which is
state no op carries, so the reader is a WHOLE-CARD one in `fxParse`.

**"IF YOU DO" IS LOAD-BEARING.** An empty arsenal puts nothing on the
bottom, so nothing comes off the deck. Read unconditionally it is
strictly better than printed on the one state where the cost cannot be
paid. (With an EMPTY DECK the same card comes straight back, face up —
the literal reading, and right. The first drill written for it expected
the opposite: **check your own fixture**, fourth time.)

**THE FACE-UP WALK IS ONE BODY NOW** (`faceUpArsenal`). It was inline in
`applyAnswer` because a `pick` from hand was the only route that existed;
a second copy is how one board fires Swift Shot's go again and the other
does not. `heave` is a THIRD site that sets `_faceUp` and fires no
trigger — measured (Thunder Quake is Guardian, no arrow deck holds it),
latent, and recorded rather than half-moved.

**`parseHeroPower` ACCEPTS A SECOND NAMED SHAPE**, never a relaxation.
The powCard carries the whole printed line and `execute` re-reads it, so
answering on the first sentence alone costs nothing — the same argument
v2.34 makes for the arsenal PUT, and the same narrowness.

**AND THE GRANTED-KEYWORD VOCABULARY IS CLOSED.** `dominate` is the one
keyword an arsenal stamp can be spent on — `parser.defCap` is its single
reader — so an unknown keyword drops the GRANT and keeps the cycle.
v3.55's rule about counter kinds, one mechanic over.

### THE LATE CONDITIONS ADDED TO A NUMBER NOBODY SPENT (v3.71)

Three printed shapes cannot be answered when the card is played:
`pumped` (*"if this has {p} greater than its base"*), `defLt2any`
(*"defended by fewer than 2 cards"*) and `defLt2` (*"…non-equipment
cards"*). They were evaluated inside **`linkPayload`**, which is handed
the damage **DEALT** and is called *after* both boards have already
subtracted it from life — so a `+N{p}` there moved the crush threshold
and the on-hit gate and **never once touched a hero**.

| card | printed |
|---|---|
| Short Shrift · Wee Wrecking Ball · Walk in My Shoes | +1{p} when pumped |
| **Widowmaker** (Azalea's) | +3{p} against one defender |

Twelve records, every one **WEAKER than printed** — the direction the
one-sided sweep is built not to look in — and all `tier: full`.

**THEY LIVE IN `linkPumps`**, whose whole job is the attack's power
before the wall. The arithmetic is unchanged (`(power + N) - wall`) and
it is the ONLY placement under which `heroHit` can be right: a swing
blocked to nothing that the bonus lifts back over the wall has now hit,
and the old ordering had already decided it had not.

**AND `pumped` ASKED THE WRONG NUMBER** — the dealt damage against the
printed base, so 4 pumped to 6 and met by a wall of 3 was "not pumped".

**AND THE FEED CONTRADICTED ITSELF.** `execute`'s loop had no case for
any of the three, so they fell through to `false` and printed *"condition
not met (pumped)"* four lines before *"pumped above base — +1 power"*.
**`LATE_CONDS` is one list with two readers** — the skip and
`pend.lateConds` — because two copies drift into a condition that is
skipped and then never run.

### AN ANCHOR IS WRITTEN AGAINST THE LEVELLED TEXT (v3.71)

The pool prints **two wordings of `pumped`**: three Guardian attacks say
*"this HAS {p} greater than its base"*, Bolt'n' Shot says *"this CARD'S
{p} IS greater than its base"* — v3.65's rule, and v3.36's.

**AND THE WIDENING DID NOT FIRE**, because `SYNONYMS` rewrites *"this
card's"* to *"this's"* before `classifyClause` sees a word of it. A
pattern spelling the PRINTED form matches nothing and looks exactly like
a pattern that is simply wrong. **That table is the first place to look
when a widening you verified in isolation does nothing.** v3.53 is the
same lesson from the other end, where the lowercasing ate a printed NAME.

Bolt'n' Shot went `none` → `full` on that alternation alone: its rider
(*"and \"When this hits, reload.\""*) had always parsed, and `reload` has
been live since v3.69.

### A GRANTED dominate NEVER REACHED THE TABLE'S WALL (v3.71)

`parser.defCap` merges a held grant with the card's PRINTED keyword and
both walls call it — but `_kwGrant` is resolution-scoped and `judge.js`
calls `defCap` with no `kwGrant` at all. **Pulping** is the pool's only
such card and its restriction was dropped at the table for as long as the
table has resolved card text. v3.01's shape.

Folded onto `pend` at **DECLARATION** — the only moment both facts exist
— and idempotent for a card that prints the keyword, so it adds the
granted case and changes nothing else.

**THE MESSAGE BELONGS TO THE TAKEN GRANT, NOT THE MERGED CAP.** Folded
together, an attack that simply PRINTS dominate announced itself as
*"what that restriction was waiting for"* — a feed line about a grant
that never existed.

### A DRILL THAT DRIVES A REDUCED ENGINE REPORTS ON THE REDUCED ONE (v3.71)

`test/sparring.test.js` built a card map for `buildSideDefault` and never
called `J.setDb` — so **every game it drove ran with no database
registered**, and `effects.js` resolves a token through `getDb()`: Kayo's
Might, every Runechant and every Frostbite silently minted nothing.

It surfaced as the mirror-balance band breaking. Enforcing Pulping's
dominate swung that thinner game **10-2**; with the database registered
the same fix moves it **not at all** (7-5 either way, measured both ways
round). **When a band like that breaks, look at what the fixture is
PLAYING before you widen it** — v3.00's silent-skip lesson wearing a
different hat.

### A ONE-SIDED HERO LEDGER, ONE LAYER IN (v3.71)

`tools/audit.js`'s `analyzeHero` asked `HERO_STATICS` and
`parseHeroPower` — and `parseHeroPower` answers about the ability's FIRST
sentence only. Everything after it is read by `fxParse` over the
powCard's whole printed line (v3.39's `_hEffFull`), so a fully built
ability reported as three unread clauses. v3.21's shape, one layer in.

The line comes from **`build.heroAbilityLine`**, exported for the
purpose: an audit that re-derived it is the no-mirror rule broken between
a tool and the engine. `analyzeHero` is exported too, so
`test/dorinthea.test.js` stops re-deriving the covered-test inline — its
copy already knew nothing about the riders and would have called Azalea
unfinished. **Bravo is the control**: his deck reads 100% and his hero
0%, so the census cannot pass by answering TRUE for everything.

### A STALE `pending` IS LOAD-BEARING, AND THE LEDGER IS DRILLED NOW (v3.70)

`test/ledger.test.js` pins the SET of keywords whose status claims nothing
is built, because `failstates.js` grades severity from that status rather
than from a grep. It found two on its first run, both confirmed by DRIVING
them rather than counting mentions:

| | was | is |
|---|---|---|
| `charge` | `pending` | **live** — `fx.chargeCost` parses, `execute` charges the soul, `hist.charged` records it, four cards read `full` |
| `surge` | `unreviewed` | **partial** — read into a `surgeOverN` condition and evaluated, but the condition is APPROXIMATED as `amp>0` rather than the damage dealt |

`reload` (v3.69) was the same shape. **A mention count is a signal and never
a verdict** — "Seismic Surge" is a token's name, not the keyword — so the
drill pins a SET the way `wire.test.js`'s `HEADLESS` list does, and moving
one is a deliberate edit.

### CI EXISTS (v3.70)

`.github/workflows/ci.yml`. Until now **nothing but a human ran `npm
test`** — the project has zero dependencies and the suite takes 31
seconds, so there was never a cost argument. It runs on a fresh clone with
no card-database cache (verified by moving `tools/.cache` aside), and it
**asserts the skip count is 4**, because v3.00's whole lesson is that a
silent skip is not a pass. It also runs `npm run scenes`, compiles both
`text/babel` blocks, and — after a push to `main` — curls the live URL,
every engine module the page loads (count DERIVED from `index.html`, never
stated) and checks the live `APP_VER` matches the repo. That closes the gap
between "pushed" and "live" which a session cannot check for itself.

### `npm run gaps` — WHAT ONE READER CLOSES THE MOST CARDS? (v3.52)

```
npm run gaps              # the families, ranked
npm run gaps -- Astral    # the dossier for one card
```

The audit answers *how much of this card is read*; the stack answers
*which RULING is missing*. **Neither answers the question a session opens
with**, and that question turned out to have the most useful answer in the
project: 70 cards unfinished, **52 of them ONE clause away**, clustering
into five families that cut across the hero list.

**FOUR OF THE FIVE FAMILIES ARE MACHINERY THAT WAS BUILT AND NEVER WIRED
TO A READER** — `prompts.js` has had the `pick` variant since v2.17 and no
parser rule emits the spec; `optCost.trigger` has named `hits` and
`defends` "still to wire" for thirty versions. **v3.50's lesson at the
level of a whole phase: a feature with no caller looks exactly like a
feature that works, until you count.** Before building anything, check
whether it already exists.

**SO PHASE C GOES FAMILY-BY-FAMILY, NOT HERO-BY-HERO.** One hero at a time
was right for Kayo, who was the pilot; the remaining work does not sort by
hero. See `WEEK.md`.

**IT IS A REPORT, NOT A CLAIM.** A card lands in the FIRST family it
matches, `unclustered` is an honest answer, and the counts are printed —
so a pattern that rots shows up as a family collapsing rather than as a
clean sweep. The drills pin that the families **partition** the unfinished
set (a family matching twice double-counts; one matching nothing moves its
cards to `unclustered` — either way the sum stops equalling the total,
which is the one check that cannot be satisfied by finding nothing), and
that a **stale read is visible**: it compares its own `appVer` against
`index.html`, because a report older than the code is a confident answer
about a codebase that no longer exists.

### The fairness sweep — is any card STRONGER than printed? (v2.32)

```
npm run fairness          # ranked report; exits non-zero on any finding
npm run fairness --json   # machine-readable
```

**The audit measures COVERAGE. This measures FAITHFULNESS, and they are not
the same question.** Three bugs shipped in one week and the audit reported
**identical tiers before and after every one of them** — every affected card
said `full`. They were read, and read *wrong*:

| ver | what | cards |
|---|---|---|
| 2.30 | a `+N{p}` read by two rules at once — Act of Glory printed +6 and gave **+12** | 34 |
| 2.30 | a type qualifier dropped — an **arrow** buff landing on a sword | 24 |
| 2.31 | go again granted unconditionally against the card's own text | 27 |
| 2.32 | `instead` treated as an ADDITION — Emeritus Scolding dealt **6** where it prints 4 | 3 |

Coverage cannot see any of that, by construction: it counts clauses consumed,
not whether the consumption was faithful.

The sweep is **deliberately one-sided** — it reports only cards that grant
*more* than they print. A card that is too weak is `tools/failstates.js`'s
business and is far less harmful; a card that is quietly too strong steals
games. What it checks:

| code | the shape |
|---|---|
| `COND-BYPASSED` | a condition gates an effect the engine also grants unconditionally, so the gate is decoration |
| `VALUE-DOUBLED` | one printed value applied by two paths |
| `RESTRICTION-DROPPED` | a printed limit (type, cost, "another") that no op carries |
| `KEYWORD-UNGATED` | a keyword indexed in `card_keywords` but only conditionally granted in the text |
| `COST-SKIPPED` | an optional cost's **rider** fires without the cost being paid |

**A clean sweep is only worth having if it would shout when the bugs return**,
so `test/fairness.test.js` pins that it is quiet on the fixed engine, and each
check keeps a real card behind it. Reintroducing the four bugs makes it report
41 / 33 / 22 / 3 findings respectively — verified, not assumed.

**`instead` REPLACES.** `classifyClause` marks a conditional payload containing
"instead", `fx.conds[].instead` carries it, and `execute` suppresses the
unconditional base op of the same kind when that condition fires.

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
open: Hope Merchant's Hood's shuffle-and-redraw (deck manipulation) and Quick
Clicks' *"activate this only if you've played a Nimblism this turn"*.

**NIMBLISM IS A CARD NAME, NOT A TYPE** — three printings of a Generic
Action — so `hist.playTy` (v3.38) can never answer it however class-aware
it is. It needs a NAME history, the non-attack twin of `hist.atkNames`.
Recorded because the opposite was written down at v3.38 and would have sent
the next reader building the wrong record.

### AN EFFECT CAN BE ARMED AGAINST A SIDE'S NEXT TURN (v3.29)

Five crush riders reach forward and all five refused for want of a
schedule. `nextTurn` on the side is it, and it needed its OWN field for a
precise reason: **`hist` is cleared for the incoming seat at CR 4.4.4**,
which is the exact moment an effect aimed at that seat's turn must still
be there.

| | |
|---|---|
| **armed** | created on my turn, does nothing yet |
| **ready** | turned on at the start of THEIR turn, by `armNextTurn` |
| **spent** | consumed by the FIRST attack / FIRST action |
| **expired** | dropped at the end of that turn, fired or not |

**ARMED IS NOT LIVE.** An entry created during their own turn would fire
immediately — a whole turn early. **SPENT IS NOT OPTIONAL**: both cards
print *"their FIRST"*, and a debuff lasting the whole turn is stronger
than printed.

**`armNextTurn` IS ITS OWN FUNCTION, not a branch in `tickSuspense`** —
that one returns early when nothing is suspended, so piggybacking would
arm nothing on most turns. Both boards call it.

**THE TAX IS SPENT AT THE CHARGE, never at the affordability check.**
`effCost` is read twice and only one of those reads takes resources
(v2.80); marking it spent at the wrong one taxes every card they play or
none.

**A SIDE FIELD IS NOT REAL UNTIL THREE PLACES CARRY IT** — `SIDE_FIELDS`
(or invariants reports SIDES-ASYMMETRIC), `wire.js` (a dropped field is a
desync), and `report.js`'s `seat()`. The symmetry ledger moved 39 → 40,
deliberately: a field arriving is as deliberate an edit as one leaving.

**THREE OF THE FIVE STILL REFUSED** at v3.29 — the two RESTRICTIONS
landed in v3.30 (below), and **ONE still refuses**: Walk in My Shoes
halves base {p} and {d} for a turn. Claiming it would file a card `full`
that does nothing.

### THE FACE OF AN ARSENAL PUT IS THE CALLER'S ANSWER (v3.69)

`applyAnswer` treated **every** `to:"arsenal"` pick as a face-UP put —
right for the three cards that PRINT *"face up"*, whose whole mechanism is
the trigger that fires when they do, and wrong for **reload**, whose
printed reminder text (1HP237 Take Aim) says *"face down"*.

**LIVE, AND IT STOLE REAL VALUE.** Azalea's deck holds Take Aim beside
Swift Shot (**go again**), Entangling Shot (taps their hero), Dry Powder
Shot and Ridge Rider Shot. Reloading one fired its face-up trigger — a
free ACTION POINT off a card that grants none. **And the prompt's own
title said "face-down"**: the feed and the state disagreeing, which is the
sev-2 category the player trusts.

Opt-in (v3.58), so an absent flag gets the printed default. **And
`buildPrompt` had to be told about the field explicitly** or every put
arrives face DOWN — v2.34's `arsStamp` rule, fourth field to prove it.

### A STALE `pending` IS LOAD-BEARING (v3.69)

`reload` was fully built — parser rule, op, `arsEmpty` gate, optional
prompt — and `tools/ledger.js` still called it **pending**. That is the
reverse of the usual failure and just as costly: `failstates.js` grades a
keyword against its STATUS rather than a grep (v3.00), so the tool was
scoring a gap that had been closed for versions.

v3.41's rule has a twin. *When you close a recorded gap, delete the
record* — **and when a record says a thing is unbuilt, go and ask the
engine.** It is the same two-minute check that moved three `npm run gaps`
family labels.

### THE SAME REVEAL, A DIFFERENT POOL (v3.68)

Three pool records print *"X is the pitch value of the card revealed this
way"*. The two Rabbles spend it on the attack's power and have read since
`revPitch` was written; **Throw Caution to the Wind spends it on a
PREVENTION and read `part`** — the reveal resolved and the second sentence
was dropped.

**NO X MACHINERY IS NEEDED** (v3.39, one card over): X is not a free
variable the player picks, it is settled by the card the reveal turns up,
so the reader is the reveal that already ran.

**TWO OPS, NOT ONE.** `revPitch` feeds power, `revWard` feeds the
prevention pool. One op with a destination parameter would let a card's
text decide where a value lands — the thing `revPitch` and
`revColorPitch` already stay apart to avoid.

### PLAIN WARD WAS INERT AT THE TABLE (v3.67)

The op that adds it is SHARED; it was consumed in exactly one place,
`index.html`'s `takeIt`. `judge.js` applies `hp - total` and read `.ward`
**nowhere at all** — five pool cards printing a prevention did nothing
there. v3.01's shape for the fifth time this cycle, and **the ARCANE twin
has been shared since `arcaneHit` was written**, which is what made it
look wired: half the mechanic was already in the right place.

**IT REDUCES WHAT IS DEALT, NOT ONLY WHAT LIFE LOSES.** CR 7.5.5 — if
prevention stops all of it, it is no longer a hit. Subtract ward from life
alone and `pend.dealt`, every on-hit clause, crush and the soul all fire
off damage that never landed. `effects.preventDamage` RETURNS the number,
and that number is what the rest of the resolution uses.

**A `way:` CONDITION CANNOT ANSWER A LATER RESOLUTION.** v3.60's late pass
clears its traces with the resolution that set them — correctly. Toe the
Line's prevention happens on a *later* one, possibly on the opponent's
turn, so its rider WAITS with the pool and fires from inside the shared
body. **When a trigger's event is not this resolution's, it is a schedule,
not a trace.**

**A PREVENTION THAT PREVENTS NOTHING TRIGGERS NOTHING**, and the guard is
the early return — a second `off > 0` beside the rider read as
belt-and-braces and was DEAD, because past that return both numbers are
positive. Sabotage found it. Dead rules code is worse than dead code
elsewhere: a second description of a rule nobody can reach.

**AND A NEGATIVE DRILL NEEDS ITS POSITIVE CONTROL IN THE SAME STATE.** The
rider drill never registered the database, so the mint resolved nothing
whatever the engine did — and the "nothing triggers" twin passed for that
reason rather than for the rule.

### TRY THE PRINTING BEFORE BOOKING A QUESTION — FOURTH TIME (v3.66)

The database carries no reminder text for any keyword. The ruling recorded
2026-07-25 for **Sharpen** was right about the end-of-turn wipe; the
MPW103 printing of Edict of Steel is more precise in the way that matters:

> *"Sharpen target sword you control. (Put a +1{p} counter on it.
> **Remove all +1{p} counters from it** at end of turn.)"*

**All** of them, and only **from it** — a sword sharpened after Glisten
has distributed counters loses those too. Clash of Agility, Thunder Quake,
Pick Up the Point and now this. `card.printings[].image_url` is in the pool
record; fetching and reading one takes a minute.

**IT IS `ctrPut`, NOT NEW MACHINERY.** The kind is `pow`, the candidate
scan already covers gear, and the sheet already exists for two or more.
What the keyword adds is a **WIPE**, and it is a **STAMP rather than a
predicate**: `idleCounterWipes` asks the PIECE's own printed line, and a
sharpened sword's text says nothing about sharpen — the schedule belongs
to the card that sharpened it. **The stamp is cleared with the counters**,
or a one-turn buff becomes a permanent ban on holding one.

**"IT" IS THE SHARPENED SWORD** (v2.33, v3.47 — third time), so the second
sentence folds onto the spec in `fxParse` where the whole card is visible.
**The threshold is the card's own number** — 1 / 2 / 3 across the three
printings — and a drill asserts the printings actually DIFFER, because a
hardcoded 1 passes a test written against the red face alone.

**ONE BODY, TWO LANDING SITES.** The direct path and `applyAnswer`. Dropped
from `ctrStamp`, the wipe and the rider fire on the first and vanish the
moment a second sword is equipped (v2.34). The two new stamp fields are
**opt-in** (v3.58), or every `deepEqual` on the shape breaks.

**A CLOSED SUBTYPE VOCABULARY, MEASURED.** *"Target SWORD you control"* is
read off `tt`, from a closed list — an open "any word before `you control`"
claims every dynamic subject this reader exists to refuse, silently. The
pool's printed subjects of that shape are **sword**, **dagger** and
**ally**; exactly three records changed parse. **Sabotaging the list open
was silent against every other drill in the file**, which is why the
closure has one of its own.

### A FIXED WORDING IS NOT A FIXED SHAPE — AT FAMILY LEVEL (v3.65)

v3.22 built `fx.atkTrigger` for the ONE printed subject it found and never
asked which others the pool gives the same shape. **Three more tokens
print it, read `tier: none`, and did nothing at all** — Blade Dance and
Flurry (*"when you **activate a weapon attack**"*, no play half) and
Eloquence (*"when you play a **non-attack** action card"*).

The trigger carries **`on`, a list of ROUTES read off the printed words**,
in place of the single `weaponToo` boolean. v3.60 states this rule about a
MATCHER; this is the same sentence about a FAMILY.

**THE PAYLOAD'S SUBJECT MUST MATCH THE TRIGGER'S.** *"The attack"* and
*"the card"* name the same object on their own route, and reading either
onto the other is v2.33's and v3.47's wrong-subject shape. An unreadable
payload refuses.

**AN ALLY ATTACK MATCHES NO ROUTE.** `weaponToo || from !== "weapon"`
answers TRUE for `from === "ally"`, so an ally's activated attack popped
every one of these. **Latent, and measured before changing it** — no deck
holds both a minter and an attacking ally — but the route has existed
since v3.44.

**AND THE NON-ATTACK BRANCH HAD NO POP SITE**, so a `nonAtk` trigger could
never fire: v3.53's shape a third time. **When you widen a reader's
subject, ask which BRANCH each new subject resolves in.**

**FLURRY'S PAYLOAD WAS ALREADY BUILT** — it is Dorinthea's `weaponRefresh`,
which lifts the weapon's Once-per-Turn allowance and nothing else, so the
extra swing pays its printed cost and an action point. *"That weapon"* is
literal.

**IT WORKS AND CANNOT YET BE CREATED.** Both minters are `part`; the
token's tier is about the token's own text, and saying so is the honest
report rather than a claim the card is playable.

### HOW MANY CARDS MAY DEFEND — TWO SOURCES, TWO COUNTED SETS (v3.64)

`judge.legal`'s defend branch mentioned dominate **nowhere at all**, so at
the table any number of cards could be declared against a dominate attack.
The trainer's only cap was `dummyDefence`'s `dominating ? 1 : 2` — the
DUMMY'S OWN HEURISTIC about how many cards it chooses to spend. v3.01's
shape, and barely present on the board that had it.

**`parser.defCap` is the one reader, and the TIGHTEST cap wins** — two
restrictions do not cancel:

| | caps | counts |
|---|---|---|
| **dominate** | 1 | cards **from hand** — this project's RECORDED reading. The database prints no reminder text for any keyword, so changing it is a ruling, not an engineering call |
| **Confidence** | 2 | **non-block** cards. Block is a TYPE, so a declared piece of EQUIPMENT counts |

**THE COUNTED SET IS READ OFF THE PRINTED WORD**, never defaulted to the
other's — they genuinely differ, and either default changes what may block.

**A GRANTED KEYWORD IS THE CALLER'S ANSWER.** `hasKwNow` drops a dominate
the text only grants under an `if`; `_kwGrant` is how the clause hands it
over when the gate fires, which is a fact about the resolution that no
reader of the card alone can see.

**THE RULE CAPS THE HEURISTIC, IT DOES NOT REPLACE IT.** `Math.min(2,
cap.n)`, never an assignment — the 2 is TUNED and folding the two numbers
together changes the opponent silently.

**AND THE CHECK SITS BELOW BOTH BRANCHES.** The gear branch used to
`return null` on its own, so a cap that counts EQUIPMENT was bypassed by
the one kind of defender it needed to count. **Withdrawing is always
legal** — the cap limits how many may be DECLARED.

**RESTRUCTURING THAT BRANCH FOUND A RULE WITH NO DRILL IN 1618.**
`gearDef <= 0` was silent under sabotage while its neighbour
`chainBlocked` (CR 7.3.2b) was covered. **When you move a rule, sabotage
the rules you moved past** — a refactor inherits their coverage, or their
lack of it.

### A REFUSAL ASSERTED IN ONE FUNCTION IS NOT A REFUSAL (v3.63)

v3.59 guarded `classifyClause` against the **"Attack Reaction - <cost>:"**
prefix, and this file said the cards therefore had no route: *"`build.js`
builds no powCard, and neither board can offer the ability."* A drill
asserted it. **Both were about the wrong function.**

`parseHeroPower` runs its OWN regex over the raw text, `clean` collapses
the newlines so it cannot anchor on `^`, and **"REACTION" CONTAINS
"ACTION"** — so the match landed on the `action` inside RE-ACTION and
three abilities were BUILT as action-speed and offered in the action
phase:

| card | did |
|---|---|
| Prey Spotters | marked a hero for free, any time |
| Stalker's Steps | granted **go again** — an action point — with no attack to target |
| Danger Digits | dealt 1 damage from nothing, its printed *"Destroy the dagger"* dropped |

Sev-3 *illegal play allowed*, live. v2.44 named this trap and v3.30 hit it
again in `nextTurnBars`; **third outing, and the first found by driving a
claim rather than reading one.** When you write "X refuses, so nothing
reaches Y", go and ask Y.

**NO LOOKBEHIND — THE PAGE SHIPS AS AUTHORED.** The preceding character is
CONSUMED instead (`(?:^|[^a-z])`), which under `/i` excludes upper case
too. That is the point: the `e` of "Reaction" must not qualify.

**AND `boardPow` HAD THE SAME HOLE ONE ROUTE OVER.** It stamps `_instant`
and stamped no window for the new flag, so an arena permanent printing the
prefix would be offered at action speed — the identical sev-3, waiting in a
third place. **When you add a flag to one powCard builder, grep for the
others.**

### AN ACTIVATED ABILITY HAS A WINDOW, AND THE FLAG IS IT (v3.63)

A powCard's `tt` is *"Equipment Ability"* / *"Hero Ability"* / *"Arena
Ability"* and carries **no printed type at all**, so the window cannot be
read off it. `parser.abWindow` is the one reader — `_attackRx` →
attack-reaction, `_instant` → instant, else action — and **four sites ask
it**, two of which were already hand-rolled ternaries kept in step by hand.

- **It costs NO action point.** CR 8.1.1 charges the point to an ACTION,
  and `costsAP`'s own note already said *"a card played in a reaction
  window is not being played as one"* — the reading that makes Den of the
  Spider cost a point as an Action and none as a Defense Reaction. The
  rule was already written down; only the flag was missing.
- **The printed target is a LEGALITY** (v3.11, one route over), refused
  **before** the piece is destroyed. Refusing after costs the player the
  piece for a play the rules never allowed.
- **`effects.attackRx` already did all of it** — target legality, the
  go-again grant onto `pend.card`, riders, modes. The whole build was a
  window and a flag. **Before building machinery for a shape, check
  whether the machinery is the shape you already have** (v3.58, again).
- **Its ops are held back from `execute`'s own run**, or they fire twice:
  `VALUE-DOUBLED` on the fairness sweep's own terms.

### `pend.by` EXISTED ON ONE BOARD (v3.63)

Written by `judge.declareAttack` and by nothing else. Every reader guards
on `by != null`, so on the TRAINER `execute`'s own attack-reaction branch
was **unreachable** — not a missing rule, a missing FIELD, which reads as
wired because the rule is right there.

The actor at declaration IS the declarer. **Measured before changing it:**
both `hostile` tests ask `by !== actorOf(n)`, which was false with `by`
absent and is false now for your own swing, and the dummy's swing opens no
pend at all — so no trainer behaviour moves. v3.01's *ask which board runs
it*, asked of a field instead of a schedule.

### A DERIVED AGGREGATE CANNOT SEE A CHANGE TO ONE OF ITS INPUTS (v3.63)

`fxParse` credits the reaction clause **conditionally on `parseHeroPower`
answering** — the same shape and guard as `handAbility`. Under-reporting a
card that works is v3.21's one-sided ledger; crediting one that does not is
the no-op blind spot, and that guard is the whole difference.

**THE DRILL FOR IT WAS WRITTEN AGAINST `fx.tier` AND WAS SILENT UNDER
SABOTAGE.** All three refusing cards carry ANOTHER unread clause that pins
them at `part` whatever the credit does. Assert on the **clause status** —
the thing the change writes — not on a number several other facts also
determine. Rewriting it that way is what found that **Bait was being
credited**: *"This gets +1{p}"* on a Ranger Token Aura, where on a reaction
route *"this"* is the SOURCE and not the attack. Reading it onto the link
decides what "this" refers to, which is v2.33's Bull's Eye Bracers and
v3.47's Scuttle Toes on an activation line. It refuses.

### A DAMAGE CLAUSE CAN NAME A SUBJECT (v3.63)

Danger Digits prints *"Target dagger you control that isn't on the active
chain link **deals** 1 damage to the defending hero. … **Destroy the
dagger.**"* The `dmg` matcher is unanchored, so it read a bare
`[["dmg",1]]` **from the equipment** — the chosen dagger, the *"has hit"*
fiction and a printed **DRAWBACK**, all gone at once.

**Measured before narrowing it:** exactly two pool records print the
third-person *"deals"*, and Bloodrot Pox's subject is *"it"*, which IS the
resolving card. Everything else is imperative. So a third-person subject
that is not this/it refuses, and nothing else moves.

### THE COMPILE CHECK CAN BE RUN (v3.63)

`html-balance.test.js` proves the brackets balance and v2.27 shipped a page
that was balanced AND broken, so compiling both `text/babel` blocks with
`@babel/standalone` is the stated manual pre-ship step. It stays out of
`npm test` because the project has no dependencies — but it can be
installed into a **scratch directory** and run against `index.html` from
there in about a second, which keeps `npm test` green on a fresh clone and
removes every excuse for skipping it:

```sh
npm install --no-save --prefix "$SCRATCH" @babel/standalone
# then transform each <script type="text/babel"> body with
# {presets:["react"], sourceType:"script"}
```

### A TRACE BELONGS WHERE THE FACT BECOMES TRUE (v3.62)

*"If damage is dealt this way"* is recorded **inside `arcaneHit`, in the
`left > 0` branch** — not at the call site. That is what makes CR 7.5.5's
*prevented is not dealt* govern it **without being restated**: a hit
turned entirely aside records nothing and grants nothing.

`creditArc` leans on the same guard one line up, and v3.28 is the version
that had to MOVE it there after a fully prevented hit was credited from
the call site. **Same rule, same function, second time.**

**`pend` IS BUILT BEFORE THE ON-ATTACK TRIGGER FIRES**, and it carries
its own copy of `ga`. A grant that set only the local is invisible to the
resolution the chain link runs on, so it goes to both — and the drill
asserts on `pend`, because that is what resolves.

**ONE BODY, TWO BRANCHES.** A non-attack's ops run late; an attack's
trigger fires earlier. The difference is expressed as a `grantGa`
callback and nothing else, because two copies of a condition loop is the
drift this file names on nearly every page. Go again is the one op that
cannot simply `runOps` — it is a GAIN (CR 5.3.5) tracked in a local.

### A SABOTAGE THAT CANNOT EXPRESS THE BUG PROVES NOTHING (v3.62)

The sabotage for "the damage trace is recorded even when PREVENTED" was
written by changing `+ left` to `+ 1` — **inside the `left > 0` guard**,
so it altered only the amount and never reached the prevented case at
all. It reported SILENT, which reads exactly like a weak drill.

Re-targeted to move the record onto the `else` branch, it bites. **Second
time this fortnight the HARNESS rather than the drill was at fault** —
check that a sabotage can actually express the bug it is named for, not
merely that it applied.

### CHECK FOR THE TRACE BEFORE YOU BUILD ONE (v3.61)

`_discWay` has recorded *"what this resolution discarded"* since
`discard6way` was written, cleared per resolution at the same point and
for the same stated reason. v3.60 added a private `_thisWay` beside it —
**two records of one fact, the no-mirror rule broken inside a single
file**, and by the very habit that found four other things this
fortnight.

**AND UNIFYING THEM CLOSED A GAP THAT WAS ALREADY WRITTEN DOWN.**
`creditDiscard`'s comment says *"every discard path should call this.
Today that is `discardRandom`… which is a gap rather than a decision."*
`selfDiscard` was not feeding `_discWay` either, so a 6-power card
discarded by one could never satisfy `discard6way`. **A recorded gap is a
debt, and this one came due sideways** — through a refactor that was not
looking for it.

**TWO MECHANISMS, TWO SHAPES, BOTH EARNED.** The pre-existing answer to
"conditions run before ops" is a PRE-RUN: `execute` runs a card's
`draw`/`discardRandom` ahead of the condition loop and filters them out
of the later lists. That works when the fact is a discard. It does not
generalise — an arcane that fires from `fx.onAtkHero` at declaration
cannot be moved earlier without dealing damage before the attack is
declared. **Pre-run when the op can safely move; the late pass when it
cannot.**

### "…THIS WAY" IS THE CARD'S OWN RESOLUTION, AND THE CONDS RUN TOO EARLY (v3.60)

**`execute` evaluates `fx.conds` BEFORE it runs `fx.ops`** — the loop is
at ~1583, the ops at ~2175. So a condition asking *what my own ops just
did* is answered against an empty record: **false on every card,
forever.** That is why `way:`-prefixed conditions are SKIPPED by the main
loop and answered by a **late pass** after the ops have run.

`pend.lateConds` is the precedent on the ATTACK path (`defLt2`,
`pumped`, settled in `linkPumps`); this is its non-attack twin, and
deliberately narrower — an attack's ops ride to resolution, so a this-way
condition on an attack card is a different problem, left refusing.

**MEASURED: 17 pool cards print "…this way", and 8 already read** — each
hand-built with its own condition name (`discard6way`, `chargedPitch`,
the reveal ops). The trace is what lets the rest share one reader.

**`thisWayMet` IS A NAMED FUNCTION SO ITS DEFAULT IS REACHABLE** — the
parser emits only conditions the evaluator knows, so no card fixture can
drive the unknown branch. Same call as `defSelfMet` (v3.26) and
`asInstantMet` (v3.36). Unknown answers FALSE.

**AND THE TRACE IS CLEARED WITH THE RESOLUTION.** It is one card's own
doing; left on the state it is the NEXT card's condition reading a
discard it never made. **A drill that plays ONE card cannot see that.**

### THE SAME UNANCHORED RULE, ONE WORDING OVER (v3.60)

The compound draw-and-discard rules carry a comment about the plain-draw
rule below them stealing the clause and dropping the cost — *"five Kayo
rows drew for free and never paid"*. **There was no rule for the
NON-random wording**, so the identical theft happened to Portside
Exchange and Gravy Bones' hero ability.

**A FIXED WORDING IS NOT A FIXED SHAPE.** When you anchor a rule to stop
a loose one stealing a clause, ask which OTHER printed wordings of the
same shape the loose rule still reaches. This is v3.53's
"a fix for one mechanic is not a fix for the shape", inside a single
matcher.

**AND IT MOVED NO COVERAGE NUMBER.** The clause read `run` throughout —
read, and read wrong — so the audit and the one-sided fairness sweep were
both blind, as they were for v2.30's arrow buff.

### THE FEED IS THE OBSERVABLE WHEN THE STATE IS IDENTICAL (v3.60)

Removing the main loop's `way:` skip changes NO state — the late pass
still fires and the token still lands, so every zone assertion passes.
What differs is that the player is told **"condition not met"** and then
handed the bonus anyway.

In a training sim the sequence IS the lesson, and a feed that contradicts
itself is the sev-2 category the player TRUSTS. **So that one drill
asserts on prose deliberately, and says why in the drill.** It is the
exception that proves the rule, not a licence: everywhere the state can
answer, assert on the state.

### AN ACTIVATION PREFIX MUST BE GUARDED, OR ITS COST IS EATEN (v3.59)

`classifyClause` guards `action` and `instant` prefixes so the generic
matchers below cannot claim a line INCLUDING ITS COST. The pool prints a
third — **"Attack Reaction - <cost>: <effect>"**, on five records — and
it was not guarded.

Prey Spotters' *"Attack Reaction - Destroy this: Mark target opposing
hero"* was claimed whole by the loose `mark` matcher, so the audit
counted the clause read and filed the card **`full`**, which is the no-op
blind spot wearing v3.00's unanchored-match disguise.

> **THE SENTENCE THAT USED TO FOLLOW HERE WAS FALSE, AND IT COST v3.63.**
> It read *"`parseHeroPower` refuses the line, `build.js` therefore builds
> no powCard, and neither board can offer the ability."* `parseHeroPower`
> runs its OWN unanchored regex over the raw text and matched the `action`
> inside **RE-ACTION** — so three of these were BUILT, at action speed,
> and offered in the action phase. A refusal asserted in one function and
> never driven in the other. See "A REFUSAL ASSERTED IN ONE FUNCTION IS
> NOT A REFUSAL"; the route is built now and the prefix is a real window.

**IT REFUSES OUTRIGHT, and the first attempt is why.** Written to defer
to the equipment reader like the two prefixes above it, the guard made
things WORSE: `parseHeroPower`'s PROBE form answers truthily for these
lines, but `build.js` only ever builds a powCard from an `action` or
`instant` line — so a `noop` there names a reader that does not run, and
Stalker's Steps went from `part` straight to `full` while staying
completely inert. **A `noop` is a CLAIM that something reads the clause;
`null` is the claim that nothing does.** Only one of them was true.

**ANCHORED ON THE DASH.** Widowmaker and Wreck Havoc print *"Defense
reactions can't be played to this chain link"* — a RESTRICTION on the
opponent, not an activation — and swallowing it would lose a real printed
rule. Same discipline as `printedKw`'s dash rule (v3.33).

**A DOWNGRADE THAT CORRECTS OVER-REPORTING IS A DECISION.**
`coverage.test.js` failed on two cards, the diff was read card by card,
and only then `--write-baseline`. That flag exists for exactly this;
running it without reading the diff is how a real regression gets pinned
as the new floor.

### AN INLINE READER IS A CARD SPECIAL-CASED BY NAME (v3.58)

Two cards this version were **already firing and still reported unread**,
because a private regex read the clause instead of the parser:

| | was |
|---|---|
| Phantasmal Haze | *"when this is destroyed"* read by a regex over raw text inside the phantasm pop site |
| Mandible Claw | *"this card's attacks get go again"* read by a `from === "weapon"` regex in `execute`, with a `noop` in the parser whose REASON POINTED AT THAT LINE |

The second is the golden rule broken twice over — a card handled by name,
and a `noop` filed for text that has real behaviour — and it cost the two
other pool weapons printing the identical shape, which were simply dead.

**MEASURE THE INLINE REGEX BEFORE REPLACING IT.** The destroy one matched
exactly one pool card, so `fx.onDestroy` is an exact swap rather than a
widening. **A tier that reports `part` on a card that works is a lead**:
something is reading the clause somewhere the ledger cannot see.

**AND NOTHING NEW RAN THE WEAPON STATIC.** `execute`'s condition loop
already treats `ga` and `self` specially, and a weapon swing goes through
`execute` with `attacking` true — so the payload reads as ordinary ops
and the EXISTING gate applies them at the swing. Before building
machinery for a shape, check whether the machinery is the shape you
already have.

**`wpnOnly` RIDES ON THE CLAUSE.** *"This card's ATTACKS get …"* is not
*"this card"*: the same piece can be activated for a non-attack ability
and the bonus must not follow it there. `from` is the route — v3.44's
ally distinction, one card type over.

**A FLAG GOES ON A COND ENTRY ONLY WHEN TRUE.** `instead` and `atkHero`
are always present, so a fourth always-present key changes the SHAPE of
every cond in the pool; five drills that `deepEqual` `fx.conds` went red
on cards printing no weapon static at all. Those drills are right to
compare the whole object — make the new field opt-in instead.

### GO AGAIN IS AN ACTION POINT, AND THAT IS WHAT TO ASSERT ON (v3.58)

A drill for the `wpnOnly` gate asserted that the feed carried no "goes
again" line on the ability route — and passed with **the gate removed**,
because that route prints no such line either way.

Go again is a **GAIN** (CR 5.3.5), so the observable is `ap`: with the
gate gone the met case keeps a point the unmet case spends, and the two
diverge. **Fourth weak drill this cycle and the third caught by asserting
on the log** — assert on hands, life, zones and points, never on prose.

### A GATE CAN VANISH, AND THE SWEEP CANNOT SEE THAT (v3.57)

`fxParse`'s op dispatcher has a branch for a gated ON-HIT (`condOnHit`,
v3.10) and **none for a gated ON-LEAVE**. A conditional leave-payload
therefore lost its condition entirely and fired unconditionally.

**`npm run fairness` REPORTS CLEAN ON IT.** `COND-BYPASSED` looks for a
condition gating an effect the engine ALSO grants unconditionally — it
needs an unconditional TWIN to compare against. A gate that simply
disappears leaves nothing to compare, so the sweep's model does not
reach it. **When a condition is dropped rather than duplicated, no tool
here is looking.**

Found only because building a new CONDITION made an existing clause
readable for the first time. **Measured before acting:** one pool card
prints a gated leave-trigger, so nothing had shipped wrong.

**IT REFUSES RATHER THAN CARRYING THE GATE, and the second reason is the
stronger one:** `fx.onLeave` has exactly ONE caller, `tickSuspense`, and
that card prints no suspense — its Ward is a side-level pool, not
counters on the aura, so nothing in this engine can make it leave the
arena. Reading the clause would file it `full` with a dropped gate on a
trigger that cannot fire. Two ways wrong at once; `part` is the truth.

**When you build a CONDITION, ask what it just made readable.** A new
gate does not only unlock cards — it can expose payload paths that were
never asked to carry one.

### A READER THAT CANNOT READ ITS OWN MATCH MUST NOT CONSUME THE CLAUSE (v3.57)

Written `if(m = c.match(RX)){ if(!KNOWN[m[2]]) return null; … }`, the
enters-with-counters rule matched Malefic Incantation's *"this enters the
arena with 3 VERSE counters"* — a kind it does not know — and returned
null, **killing a clause the existing verse reader further down already
handled.** The card went `full` → `part`.

**Test the vocabulary in the GUARD, not the body:**
`if((m = c.match(RX)) && KNOWN[m[2]])`. Both properties then survive — a
kind nobody owns still refuses at the end of `classifyClause`, and a kind
someone else owns reaches them.

**`coverage.test.js`'s PINNED BASELINE IS WHAT CAUGHT IT.** The pool
total went UP that run; one card moving down was invisible to every
count-based check. That baseline exists for exactly this, and it is the
reason to re-run `npm run audit` rather than trusting a green suite.

### A SCHEDULE THAT FIRES FROM THE DECK (v3.56)

Boost banishes your top card to pay for the card you are playing, so
*"when this is banished from boosting"* fires **on a card its controller
never played**, out of a zone nothing else triggers from. Three pool
records print it; their payload has read since v3.55, and the SCHEDULE
was the whole gap.

**IT IS HELD OFF `fx.ops`.** Crankshaft is an ATTACK card — left in
`ops`, its steam counter lands every time the card is PLAYED, which is
v3.07's suspense bug (a printed delay collected as a bonus). A whole-card
reader sets `fx.boostBanish` and marks the clause handled, exactly as
`atkTrigger` does.

**THE TRIGGER IS THE BANISHED CARD'S, NOT THE PLAYED CARD'S.** Read off
the played card it fires whenever Big Bertha is *boosted with* — the
opposite card. **Crankshaft prints Boost itself**, which is what makes a
drill able to tell them apart: play Crankshaft and let something else pay.
In the straightforward fixture Crankshaft is both halves and the two
readings are indistinguishable — v3.26's rule about a fixture that cannot
tell two halves apart.

**AND THE PAYLOAD GOES BACK THROUGH `classifyClause`**, so it shares every
reader; an unreadable payload refuses the whole trigger.

### A PROBE MUST ASK THE FUNCTION THAT HOLDS THE READER (v3.56)

Two refusal probes were written as `classifyClause(…) === null` for a
reader that lives in **`fxParse`** — a whole-card scan over `clauses`. So
`classifyClause` answers null for those shapes *whatever the reader does*,
and both probes passed against a sabotaged engine that claimed every
`when this is …` trigger and every unreadable payload.

**They were asserting a different function's refusal.** Sabotage is the
only reason anyone found out; they were green, twice, against a broken
engine.

**When you write a refusal probe, ask which function you are actually
testing** — a whole-card reader and a clause reader refuse for different
reasons, and only one of them is the one you built. Drive the whole-card
reader with a synthetic fixture, and give it a unique name: `fxParse`
memoizes on `name|pitch`, so a reused name silently returns the previous
answer.

### A COUNTER KIND WITH NO READER IS A NO-OP WEARING A NUMBER (v3.55)

`ctrPut` is the general form of `aim` — a KIND, an AMOUNT and a TARGET,
all read off the printed line. The safety property is that **the kind
vocabulary is CLOSED** to the four counters something actually consumes:

| kind | consumed by |
|---|---|
| `steam` | a weapon's `needSteam` activation, Plasma Barrel Shot |
| `rust` | `rustedThrough` — the piece shatters at its printed threshold |
| `aim` | the `aim` condition, Drill Shot's piercing |
| `pow` | `powCtr` on a weapon swing, and the idle-counter wipe |

**`+1{p}` IS THE PRINTED SPELLING OF `pow`.** Mapping a printed form onto
a field that already exists is READING; adding a fifth key with no reader
is parsing ahead of wiring. An unrecognised kind refuses, because a
counter nothing consumes is a counter that does nothing, filed `full` —
the no-op blind spot at its purest.

**BOTH NUMBERS COME OFF THE LINE.** Astral Etchings prints three / two /
one across its pitches, so a hardcoded amount is right for one printing
and silently wrong for two. Same rule as `rustDestroy` (v3.17) and
Thunder Quake's heave (v3.32).

**CANDIDATES COME FROM THE BOARD *AND* THE GEAR.** A steam counter goes
on a Hyper Driver, which is an **Item** on the board; rust and +1{p}
counters go on **Equipment**. A scan of either zone alone finds nothing
for half the family — v3.33's Magmatic Carapace, where a board-only scan
missed a Chest piece.

**WITH ONE LEGAL TARGET IT JUST HAPPENS.** A sheet offering a single
forced choice is a tap that teaches nothing.

**AND THE WRAPPER IS WHAT KEEPS IT HONEST.** Crankshaft and Big Bertha
print the same payload behind *"when this is banished from boosting"*,
and no such trigger exists. The when-handler's trigger vocabulary is
CLOSED, so those clauses refuse whole and both cards stay `part`. A
payload that parses with no schedule to fire on is the one shape
`failstates.js` cannot reach (v3.07) — **when you build a payload, check
what its trigger does with an unknown verb.**

### A FAMILY LABEL IS A CLAIM ABOUT MACHINERY (v3.53-v3.55)

`npm run gaps` clusters unfinished cards by what their TEXT says, and
each family carries a `needs:` line saying what one fix would close it.
**Those are two different kinds of statement**, and the second is a claim
a doc makes — which is a test with no assertion (v3.41).

All five were re-measured by asking the PARSER which records actually
carry the field the family names. **Two did not survive:**

| family | said | measured |
|---|---|---|
| *"you may …, if you do"* | the `hits`/`defends` queue sites | **none of the 8 sets `fx.optCost`.** `defends` was wired in v3.33 and `hits` has ZERO pool cards. The 8 need five different COST shapes |
| token on a trigger | wire the trigger | the mint is generic; each card needs its own CONDITION — nine readings, not one lever |

**BEFORE BUILDING A FAMILY, ASK THE PARSER WHICH RECORDS SET THE FIELD.**
It is a two-minute script and it moved two of five. The `needs:` lines in
`tools/gaps.js` now say what is actually left, and its header says why.

**AND A DRILL THAT NAMES A CARD ROTS WHEN YOU FIX THAT CARD.** The
dossier drill hardcoded *Astral Etchings* and failed the moment it was
closed — for the best possible reason, which is still a drill breaking
every time the project does its job. It takes its fixture from the live
report now.

### A DESTROYED PERMANENT GOES TO THE GRAVEYARD (v3.54)

**RULING (user, 2026-08-29): destroyed gear goes to the graveyard**, as
the CR says of any destroyed permanent. Until v3.54 it was flagged
`destroyed:true` and left in the gear zone **forever**.

**THE GAP AND THE CARD THAT WOULD EXPOSE IT WERE HIDING EACH OTHER.**
Measured: the only pool cards that read gear in a graveyard are the two
`retrieve` cards — and `retrieve` was unbuilt. An approximation is
invisible exactly as long as nothing asks, which is why *"nothing depends
on this yet"* is a statement about today and never about the model.

**IT IS A SWEEP, NOT AN INLINE MOVE, AND THAT IS THE WHOLE SAFETY
ARGUMENT.** The two boards hold their wall differently — **the trainer's
`blockG` is INDICES into `gear`, the table's is uids** — so removing an
entry while a wall is declared renumbers the defenders underneath it, and
`gearBlockApply` destroys a battleworn piece during exactly that
resolution. Marking stays where it is, every existing wear and display
read is untouched, and `effects.sweepGear` does the filing at one point
where no wall can be live. **When a change removes something from an
array, ask who is holding an INDEX into it.**

**WHEN it happens is a STATED APPROXIMATION** — the CR files immediately,
this files at the beginning of the controller's end phase. The observable
difference is a destroy and a retrieve inside one turn cycle.

**THE ORDER INSIDE `beginEndPhase` IS LOAD-BEARING.** It runs after rust
(which sets `destroyed` this turn) and after the idle wipe (which reads
`gear` by uid to find the counters it clears). Specific readers first,
the generic sweep last — the same rule step (2) states for Frostbite.

**AND IT IS TURN-STAMPED.** `_gy` answers the whole *"…this turn"*
family; a new path into the graveyard that forgets it makes those cards
quietly wrong.

### TRY THE PRINTING BEFORE BOOKING A QUESTION — THIRD TIME (v3.54)

The database carries no reminder text for keywords, and upstream's own
`keyword.json` lists **Retrieve with an EMPTY description**. The recorded
ruling gave the price and never named the DESTINATION, which is the one
thing a reader cannot guess. The SAR017 face of Pick Up the Point prints
it in parentheses:

> *"…you may **retrieve** a dagger from your graveyard. (Pay {r} to
> equip it.)"*

So retrieve is a graveyard pick costing {r} into the **GEAR** zone — it
comes back equipped, not to hand. Clash of Agility, Thunder Quake, and
now this: **reading the printed card is the FIRST thing to try, not the
last.** `card.printings[].image_url` is in the pool record already.

**AND THE LOOP IS DESIGNED.** Mark of the Huntsman destroys ITSELF to
mark a hero, which is what puts a dagger in the graveyard for these two
cards to fetch. A keyword whose enabler is another card in the same deck
is a good sign the model underneath it is missing something.

### A FIX FOR ONE MECHANIC IS NOT A FIX FOR THE SHAPE (v3.53)

v3.20 found its only `optCost` queue site inside `if(attacking)` while
every card that needed it was a NON-ATTACK, and wrote that down. **The
arsenal FACE-UP put was sitting in the same branch with the same
problem, and the v3.20 fix did not look for siblings.**

Measured: **three pool cards set `fx.arsenalPut` and all three are
non-attacks** — Call in the Big Guns (a Ranger Action, 3 printings),
Bull's Eye Bracers (Arms equipment), Death Dealer (a Bow). So v2.33 and
v2.34's whole face-up mechanism — `_faceUp`/`_upTurn`, `arsenalUp`, the
Bracers' `arsStamp`, the two-gates ruling behind `arsFree`/`arsEmpty` —
**was unreachable from `execute`**, while this file said in as many words
that all three enablers were live.

**A DOC CLAIM IS A TEST WITH NO ASSERTION** (v3.41), and this is the
second time that sentence has cost something. *"All three enablers are
live"* was written when they were built, not when they were last driven.

**KEPT AS TWO CALL SITES OVER ONE BODY**, following `optCost`'s
precedent: an attack that printed one would work, and the else-branch —
the line that tells the player their arsenal was full — exists once. **A
drill pins the MEASUREMENT**, so an attack printing an arsenal put fails
it and asks for the attacking-branch site to be re-checked, rather than
that site quietly being load-bearing again.

**WHEN YOU FIND A QUEUE SITE IN THE WRONG BRANCH, GREP THE BRANCH.**
The bug is never one mechanic's; it belongs to the branch, and v3.43's
rule — a guard belongs to the SHAPE, not to the version that wrote it —
is the same sentence about guards.

**AND NO TOOL HERE COULD SEE IT.** Coverage reads the two equipment
cards `full`, because their ability line is correctly `noop`; the
fairness sweep is one-sided toward too-STRONG and this is a printed
choice never offered; and the drills proved the READER and proved the
SHEET while nothing asked whether anything opened one — v3.20's
`condemn.test.js` lesson, unlearned.

### A SPEC ONLY CARRIES FIELDS ITS CONSUMER READS — FROM THE OTHER END (v3.53)

v2.34 states this as a rule about the queue site: `arsStamp` had to be
added to `buildPrompt` explicitly or it vanished. **`moveFoe` is the same
rule broken at the CONSUMER.** It has carried `{from, to}` since v3.03
and `applyAnswer` moved **hand → deck top whatever it was told** — right
for Brain Freeze, the only card that existed, and silently a no-op for
the next one.

Pass Over banishes from the opponent's GRAVEYARD. Against that body the
sheet opened, the right card was offered, the feed said it was banished,
and **nothing moved** — a lie in the one place a player cannot check.

**FIX IT WHERE THE LIE IS.** The queue site was already telling the
truth, so the consumer is what changed. And the drill now pins the ZONE
and the DESTINATION rather than the filter alone: **asserting the filter
cannot tell a spec that says where from a spec that is obeyed.**

### THE SUBJECT KEEPS ITS PRINTED CAPITALISATION (v3.53)

`classifyClause` works on the **lowercased** clause. `optFilter`'s
NAMED-CARD branch is anchored on a **proper noun**, because that is the
only thing that separates a name from a common noun — so handed
lowercased text it answers `null`, and Rise from the Ashes refused while
looking exactly like a pattern that had not matched.

So the SHAPE is matched on the levelled clause (the idiom table must
still reach it) and the SUBJECT is recovered from the raw one. **The
pattern is a named constant read by both**, because two spellings of one
pattern is v3.41's `quotedText` written twice, where sabotaging one copy
left the other correct.

v3.33 is the same lowercasing seen from the other end: there it put a
mis-named token on the board; here it silently REFUSES. **When a reader
needs a printed NAME, ask where the case went.**

### A ZONE PICK'S SUBJECT IS NOT A COST'S SUBJECT (v3.53)

`optFilter` refuses a bare *"card"*, and that refusal is correct where it
lives: its callers read the subject of a **COST**, and a cost whose
subject the reader cannot pin is a cost a player could pay wrongly.

A ZONE PICK asks a different question. Pass Over prints *"banish target
CARD from an opposing hero's graveyard"* — the subject genuinely is any
card in that zone, so an empty filter is the FAITHFUL reading rather than
a widened guess. `pickSubject` adds exactly that one phrase and defers
everything else to `optFilter`, so there is still ONE subject reader.

**THE WIDENING IS NOT IN `optFilter`, AND THE BLAST RADIUS WAS MEASURED**
(v3.33's rule): a bare "card" subject appears **19 times across 11 pool
cards**, most of them costs on hero abilities — Boltyn's and Blasmophet's
charges, Nasreth's banish, Azalea's put. Widening `optFilter` would claim
every one of them for readers nobody has wired, which is the
never-parse-ahead-of-wiring rule.

### A QUALIFIED GRANT NEEDS A RIDER FIELD BEFORE IT CAN CARRY ONE (v3.42)

v3.41's `fx.quotedUnread` flag asks "is there a reader", so it cannot see
Avast Ye!'s rider — `quotedOnHit` reads it fine. The bug was one layer
in: `gaNextQ` (the qualified go-again grant, v3.31) had no FIELD to carry
a rider on, so `quotedOnHit` was never even asked at that call site and
the parsed rider had nowhere to go. `buffQ` (v3.10) solved the identical
problem for its own family with `{amt, q, rider}`; `gaNextQ` just never
got the same treatment. Entries are `{q, rider}` now, and `takeGaNext`
returns the whole entry so the caller can join `.rider.onHit` into
`pend.onHit` beside `buffQ`'s own `qRider` — the exact shape, because it
is the exact same question asked of the sibling grant.

**A LOOK-ALIKE CARD IS THE HAZARD, AGAIN.** Mauvrion Skies prints the
identical wrapper ("…gets go again and \"When this hits, create N
Runechant tokens.\"") and its rider was already read, by NAME, into a
dedicated `runeHitNext` counter (v3.10). Reading it a second time through
the new generic path would mint the same runechants twice —
`VALUE-DOUBLED` on the fairness sweep's own terms. The two readers are
mutually exclusive by construction (the generic rider is only attempted
when the runechant-count match fails) and a drill pins Mauvrion Skies'
parsed ops unchanged.

**THE FIXTURE HAS TO PROVE THE READER, NOT THE WIRING.** Real Pirate
allies attack through an activated ability that neither board wires yet
(unbuilt on both boards until v3.44) — so a driven test against the real
card alone would have proved nothing ever fires. The
drill uses a synthetic Pirate-ally-attack fixture, same discipline as
`test/qualifier.test.js`'s own `atkCard`, and resolves the hit all the
way through `resolveStack` to see the Gold token actually land. Testing
the mechanism and testing the ally-combat gap are two different claims;
conflating them would either overclaim the fix or hide that the reader
now works.

> **AND THAT FIXTURE HID A LIVE BUG — see v3.43 below.** The paragraph
> above is true about what the drill *proved* and wrong about what it was
> therefore safe to skip. The fixture was built by adding "Attack" to a
> Pirate ally's type line so `execute` would take the attack branch: the
> fixture shaped to fit the code. The question a real game asks — what
> happens when you DEPLOY one of the six Pirate allies in the same deck —
> was the one it could not ask, and the answer was that the deploy ate the
> grant. **A synthetic fixture proves a reader; only the real card in the
> real deck proves the card.** Drill both.

### A LABEL IS NOT A PLACE FOR AN ENGINEERING MILESTONE (v3.51)

The loadout screen offers both boards and the second button read **"Fight
at the table — one engine"**. *One engine* is the Phase 1 rebuild's merged
`judge.js`/`effects.js` path: true, hard-won, and an answer to a question
no player asked. Reported from a real table as simply confusing.

**AND THE SECOND HALF OF THAT REPORT — "things don't work quite as well" —
WAS ALSO RIGHT.** What differs is the opponent's brain: the trainer swings
the tuned `[3,4,5]` escalation, the table seats `sparring.act`, which
holds a hand and blocks like a person and is UNTUNED. Measured over the
exact build the button makes: **the dummy wins 29 of 45**, nine of fifteen
heroes going 0-3. **That state had been recorded in this file since v2.81
and never once on the SCREEN.** A doc the player cannot read is not a
disclosure — put it on the button.

**MEASURE THE THING THE BUTTON ACTUALLY BUILDS.** The number above is not
`npm run play`'s hero-vs-hero ladder; it is hero-vs-the-vanilla-dummy
through `buildMatch({heroes:[k, null]})`, which is what the tap does. A
neighbouring measurement is not the measurement.

**AND A FALL-THROUGH MUST SAY SO.** The table build's `catch` seated the
player at the OTHER board in silence, so every difference they then
noticed was attributed to the wrong thing — v2.51's *never dress a failure
as a success*, in the one place the two boards are hardest to tell apart.

**"UNTUNED" CONTAINS "TUNED".** The drill asserting the trainer says it is
tuned matched the *other* note and stayed green with the trainer's own
deleted — v2.44's Reaction-contains-action trap, in a drill this time.
Scope a word-match to the region that must contain it.

### BUILD THE DRIVER, THEN THE GUARD RAILS CAN SPEAK (v3.50)

`sparring.js` contained **zero** occurrences of `board`, `arena` or
`ally`, so everything v3.44-v3.48 built had no caller: **0 ally attacks
in 549 opportunities**, 0 hero-ability activations, and v3.46's death and
Gold triggers fired **0 times in 210 games**. Giving the policy an arena
branch was ~15 lines, and the first run with it reported **3761
`CARD-IN-TWO-ZONES` violations**.

**AN ACTIVATION ROUTE LEAVES ITS CARD WHERE IT IS.** An attacking ally was
on the board AND in `chainCards`. `declareAttack` already excluded a
weapon — *"a weapon stays equipped, so it never leaves the gear zone"* —
and v3.44 added a second activation route **without giving that guard its
sibling**. v3.43's rule, a third time: **a guard belongs to the SHAPE, not
to the version that wrote it.** `fileAttack` was checked at v3.44 and
needed no change; `chainCards` is a DIFFERENT list with the same
requirement, and nobody asked it.

**THE INVARIANT JUDGE HAD BEEN RIGHT AND SILENT SINCE v2.21**, because
nothing had ever handed it the state that breaks. A guard rail is only as
good as the states that reach it — which is the argument for `npm run
play` stated from the other end.

**RANK A NEW SOURCE WITH THE OLD ONES, NOT AFTER THEM.** An ally's swing
and a card from hand both cost the turn's one action point, so they
compete for the same thing; "allies last" is a rule the policy has no
business inventing. And **the ENTRY is not the CARD** — power lives on
`.card`, the uid on the entry, and `num(b,"power")` on an entry returns 0
and silently ranks every ally last anyway.

**FOUR OF EIGHT SABOTAGES FOUND A WEAK DRILL, NOT A WEAK ENGINE.** The
worst was a tie-break fixture whose entry uid and card uid were the same
number, so it could not tell `byUid(a,b)` from `byUid(a.c,b.c)` and passed
against both. **A fixture where two things coincide has tested neither** —
v3.26's rule, and it costs a drill every time it is forgotten. Two others
were false negatives in the sabotage HARNESS (bash swallowed the `&&`), so
**check that a sabotage applied before believing the drill is weak.**

### PLAY THE GAME. IT FINDS WHAT NO TOOL HERE CAN (v3.49)

```
npm run play                    # all 15 heroes, 210 games, ~4 minutes
npm run play kayo,gravy '' 3    # a slice, 3 seeds each
```

`tools/selfplay.js` puts `sparring.act` in **both** seats and drives
`judge.reduce`, running `invariants.check` against **every intermediate
state** — a game that finishes clean can still have passed through a
broken board. The first session it ran found a bug that had survived
1488 drills, three sweeps and a coverage audit.

**READ THE TOP THREE NUMBERS: refusals, violations, STALLS.** A refusal is
always a bug in the policy (sparring.js's own contract); a violation is a
broken board; and the **stall count is the cheapest livelock detector this
project has.** 210 games came back with 0 refusals and 0 violations — and
**14 games that ran past turn 1900 without ending**, which is what found
Knucklehead.

**A DEGENERATE GAME IS A BUG REPORT.** Both stalls were real and neither
was visible to any tool here: one an engine bug, one a policy gap.

**IT IS AN INSTRUMENT, NOT A DRILL.** It asserts nothing; it reports.
Anything it proves that should STAY proven belongs in `test/` —
`test/intellect.test.js` is the worked example.

**AND ROUTE COVERAGE IS PART OF THE READING.** The report counts how often
each new route fired. `death 0, gold 0` across 210 games is how the ally
gap announced itself: **a feature with no caller looks exactly like a
feature that works, until you count.** See `PLAYNOTES.md`.

### A SCHEDULE'S SHARED HOME IS DECIDED BY WHAT MUST COME AFTER (v3.49)

Knucklehead prints *"**until end of turn**, your base {i} is the number
rolled"*. `intRoll` stashed the printed value on `intWas`, the trainer read
it back inline, and **judge.js never did** — so at the table the rolled
value was PERMANENT. A roll of 1 crippled the hero for the rest of the
game; a roll of 6 was a permanent +2, the direction that steals games.
v3.01's rule again: **a schedule is written per board, so ask which one
runs it.**

**`beginEndPhase` WAS THE OBVIOUS HOME AND WOULD HAVE BEEN WRONG.** The
rolled value has to govern the **(f) draw** — that is the whole of what the
card does, and `intRoll`'s own feed line says so. `beginEndPhase` runs
*before* (a)-(f), so restoring there hands the draw the printed value and
makes the card do nothing at all. `effects.settleIntellect` is called by
both boards **after** the draw, on the turn-player's own end phase. **When
you move a schedule into a shared body, check what it has to happen
AFTER** — "one body" and "the right moment" are two requirements, and
satisfying only the first is how a fix breaks a card in the other
direction.

**`lastRoll` IS CLEARED WITH IT.** A die left on the state is a later
`intRoll` setting intellect from a roll nobody made this turn.

**NO TOOL COULD SEE IT, AND EACH FOR ITS OWN REASON.** Coverage reads the
clause consumed. The fairness sweep is one-sided and models no schedules —
on a 5 or 6 this genuinely *is* stronger than printed. `failstates.js` has
a *"no schedule to fire on"* category and fills it from **UNREAD** text,
so a schedule that parses and then evaporates is the one case it cannot
reach. And no drill caught it because **the trainer had the restore**, so
anything measuring that board passed.

### A RULING'S NARROWNESS IS THE RULING (v3.48)

**RULING (user, 2026-08-25): a tapped hero "cannot be tapped again to pay
a cost", and "older heroes are often unaffected by being tapped."**

So `heroTapped` gates exactly that and nothing else. A tapped hero keeps
its life, intellect, defence and windows — anything more would be
inventing a rule at the keyword level, which is the golden rule broken one
layer above the card. Measured: **three of fifteen pool heroes** print a
`{t}` cost (Bravo, Gravy Bones, Lyath), so for the other twelve the tap is
a correctly-read **no-op** and the FEED says which. When a ruling tells you
a mechanic mostly does nothing, build the nothing.

**IT IS A DIFFERENT RECORD FROM THE ALLOWANCE** — v2.46's "two limits that
expire differently", one zone further in:

| | is | lifted by |
|---|---|---|
| `weaponUsed["hpow"]` | a per-turn **ALLOWANCE** | every turn boundary, both seats |
| `heroTapped` | the **STATE** | the controller's own untap step (CR 4.4.3d) |

They coincide for a hero using its own ability and **come apart the moment
an OPPONENT taps you**. Drive a whole turn to tell them apart: the
allowance comes back and the tap does not.

**THE BUILD READ MUST BE THE TAPPED SIDE'S.** `tapFoeHero` taps the OTHER
seat, so `bAct` there asks whether the **tapper's** hero has a `{t}`
ability — the wrong hero, and right by accident only in the self branch.
`arcTaken`'s inversion (v3.40) in a feed line; the sabotage that finds it
is Blaze tapping Lyath rather than the reverse.

**AND READING THE PAYLOAD CREATED THE ROUTE, AGAIN** (v3.47's shape, two
versions running). Entangling Shot went `none` → `full` with no wiring:
`parseHeroPower` refuses a line whose payload has no reader, so the
arsenal-up trigger simply appeared. Drop the Anchor's rider left
`quotedUnread` the same way — and is **hero-gated**, because *"when this
hits a hero"* must not fire off a hit on an ally (v3.45). One printed
sentence naming two targets (*"them and all allies they control"*) is
**one op with a flag**, not two clauses; Entangling Shot prints no ally
half and gets none.

**`clean` COLLAPSES THE NEWLINES A SPLIT DEPENDS ON.** `tapsToActivate`
split `clean(tx)` on `/\n+/`, so the whole card arrived as one line and
the `.find` only ever matched a card whose activated ability is its FIRST
printed line. Two live casualties — **Lyath Goldmane** (his ability sits
under the halving static) and **Concealed Object** (under its own destroy
clock) — filed a TAP as a per-turn allowance, so `perTurnCleared` lifted
it at the wrong boundary. `printedKw` and `kwGated` each carry a comment
about this trap; it is worth reading before any new line-wise scan. Split
the RAW text, clean each line.

**A BLANKET FLAG IS A CLAIM THAT CAN STOP BEING TRUE.** The audit flagged
*"tap cost {t} — not enforced"* on every card whose text contains the
symbol, and it was wrong about **14 of 17**: a tap is charged by the
**ROUTE** — an ally's attack (v3.44), a weapon swing (v2.46), an equipment
ability (`tapsToActivate` + `perTurnCleared`), a triggered *"you may {t}
this"* (v3.33), a hero's own (v3.48) — so `noop` is the correct state for
an activation LINE and only a `skip` means nothing enforces it. Three keep
the flag, all one shape: the ability's **payload** has no reader. Flagged
cards 65 → 54.

**AND `tools/ledger.js` IS NOT PROSE.** Its `{t}` and `{u}` entries both
still said *"not parsed"*. `failstates.js` grades a keyword's severity
against its **status** rather than a grep (v3.00), so a stale `pending` is
load-bearing — v3.41's rule, that when you close a recorded gap you delete
the record, applied to the file that gets graded.

### A REFUSAL CAN BE RIGHT FOR YEARS AND THEN STOP BEING (v3.47)

`{u}` was flagged *"not parsed"* for as long as that flag existed, and
refusing it was CORRECT the whole time: until v3.44 allies did not tap, so
untapping one bought nothing and reading it would have been a card doing
nothing dressed as a card that works. `{t}` is now what an ally spends to
attack, so the same words buy a SECOND attack.

**When you build a mechanic, sweep the refusals that were waiting on it.**
A recorded refusal is a debt (v3.38), and the thing that discharges it is
usually somewhere else entirely.

**READING THE PAYLOAD IS WHAT CREATES THE ROUTE.** `parseHeroPower`
refuses a line whose payload has no reader, so `build.js` gave Scuttle
Toes **no `powCard` at all** and neither board could reach it. One reader,
and the v3.04 equipment route picked it up on both boards with no wiring.
That is the shape to expect for any equipment ability: the gap is the
payload, not the plumbing.

**"IT" IS THE CARD ACTED ON, NOT THE SOURCE** — v2.33's Bull's Eye
Bracers trap, in a second card. The source was already destroyed to pay
the cost, so a `selfDestruct` read from the second sentence lands on
nothing and the printed drawback is free. Hold the schedule back in
`fxParse` and let it ride on the op that knows what "it" is.

**A DESTROYED ALLY HAS DIED**, so the arena sweep fires `onDeath` — gated
on `isAlly`, because "dies" is printed about a LIVING object and an aura
on the same clock is destroyed without dying. Reading the trigger off
anything that prints one would be inventing a rule the CR does not have.

**AND A PICK THAT IS A TARGET CHOICE SUPPLIES ITS OWN CANDIDATES.** With
`zone` set and no `to`, `applyPrompt` says "revealed from <zone>" — which
`prompts.js`'s own comment calls a feed line that lies. Cold Snap's freeze
supplies candidates for the same reason, and `G.isAlly` on the board ENTRY
is a better authority than a `tt` filter re-asking the printed type line.

### AN ATTACKS-TRIGGER IS NOT A HIT-TRIGGER (v3.46)

v3.45 gated the on-HIT triggers on `heroHit`. The on-ATTACK ones ask a
**different question**: an attacks-trigger fires when the attack is
DECLARED, whether or not it connects, so a swing blocked to nothing still
attacked a hero. `heroTarget` is its own answer — derived once at the top
of `execute` from the caller's target — and reusing `heroHit` there would
silently make every attacks-trigger conditional on connecting.

**THE WRAPPER WAS BEING EATEN.** `classifyClause` splits an if/when clause
on the first comma and recurses into the inner gate; the subject went with
it. So *"When this attacks a HERO, if you have more {h} than them…"* became
a bare `lifeGt`, and Mocking Blow booed the crowd off an attack on an ally.
`atkHero` is set BEFORE the cond dispatch, because every branch there
`Object.assign`s onto the same object.

**32 POOL CLAUSES PRINT A BARE "when this attacks" AND MUST NOT MOVE** —
a bare trigger fires on any target (v2.12: a trigger is not a gate). Only
the three that name a hero are gated.

**AND JUDGE ALREADY HAD THE TARGET** — it was applying it *after* the
fact, in `declareAttack`. A trigger that asks "am I attacking a hero" has
to be told before it fires. One extra key in `execute`'s opts.

### AN ALLY THAT DIES DOES WHAT IT PRINTS (v3.46)

Oysten, Heart of Gold is the pool's ONLY death trigger, and it was
unreachable until allies could attack (v3.44) and be attacked (v3.45) —
a card whose text became live because two other things were built.

**THE TRIGGER BELONGS TO THE ALLY'S CONTROLLER, NOT TO WHOEVER KILLED
IT.** Inside a combat link the actor is the ATTACKER, so running the
payload as it stands hands the Gold to the player who shot the ally down.
`effects.allyDeath` borrows the controller's seat and **gives it back**;
a body that leaves the actor moved corrupts every rule after it in the
same resolution. Same inversion `arcTaken` documents from the other end.

**AND A BORROWED SEAT MAKES A SECOND-PERSON FEED LINE A LIE.** The token
message read *"created on YOUR board"* — harmless while the actor was
always the player, and actively wrong the moment a token could be minted
under a borrowed one. Name the seat (v2.83's rule, and this is the
occasion that proves why it is a rule).

### MEASURE BEFORE BUILDING A PLANNED JOB — IT MAY BE DEAD CODE (v3.46)

HANDOFF listed "the trainer cannot choose an attack-target" as the next
step for three versions. The trainer's opponent is `DUMMY_DECK` — **12
vanilla attacks, no allies** — and its swing is the `[3,4,5]` fabrication
with no target choice. It can never field an ally against you and never
choose to attack one of yours, so a target picker there is **dead code**,
and its `heroHit: total > 0` is complete rather than an approximation.
**A task that has sat on a list for three versions is worth measuring
before it is worth doing.**

### WHOSE HIT WAS IT? THE ATTACK-TARGET DECIDES (v3.45)

CR 1.4.5 makes an ally an attack-target, and the moment one can be
attacked, *"hits"* and *"hits a **hero**"* stop being the same event.
Nothing was asking. Driven: Infecting Shot's *"When this hits a HERO,
create a Bloodrot Pox token under their control"* fired off a hit on
Barnacle, an ally. **34 records** were doing this — 19 on-hit payloads and
all 15 crush riders.

**THE GATE ALREADY EXISTED AND HAD ONE CONSUMER.** `heroHit` has been the
caller's answer since v3.21 and was read by Briar's Earth latch alone. It
gates four sites now, from one named local. **When you add a caller's
answer, grep for who else should be asking it** — a fact plumbed for one
reader is a fact the next reader will re-derive or ignore.

**TWO LISTS, NEVER A TAG ON THE OP.** An op is a bare array, so a flag on
it sits exactly where another reader expects a parameter. `fx.onHitHero`
mirrors `condOnHit`, which is a separate list for the same reason. The
subject travels with **riders** too — Avast Ye! and Yo Ho Ho! grant
*"when this hits a hero"*, so the grant they hand over is gated as well.

**BOTH HALVES OR THE DRILL PROVES NOTHING.** A gate that refuses
everything passes the ally half perfectly. Drive the same card at the same
board twice, once at the ally and once at the hero — written as two
fixtures first, the seeds picked different cards and the halves were not
comparable.

**AND COUNTING THE BOARD CANNOT SEE IT.** The ally leaves as the token
arrives, so `board.length` is unchanged and a naive check passes on a
broken engine. That is how the first probe missed it; the FEED is what
showed it. Ask for the thing by name.

### THE SPLITTER MUST NOT CUT INSIDE A QUOTE (v3.45)

FaB prints a granted ability in quotes precisely to delimit it, and the
clause splitter broke on `". "` regardless — leaving clause 1 holding an
**unterminated** quote, so `quotedText` found no closing mark and the
payload fell through to the loose matchers. Loot the Hold discarded a card
**on play** (no attack, no ally, no hit) and Loot the Arsenal minted its
**Gold token** with the destroy it is printed to pay for dropped — the
reward without the cost. Both read `tier: part`.

**A TRAILING PERIOD IS NOT A SENTENCE BREAK.** The rule replaced was
`split(/\.\s+/)`, which needs real whitespace after the dot; treating
end-of-string as a break ate the final `.` and an existing drill pinning
an override's exact clause text caught it.

**A GRANT MUST BE READ BEFORE THE LOOSE PAYLOAD MATCHERS.** A grant's
quoted payload is made of payload language *by construction*, so read late
it is stolen by its own rider — the `foeDiscard` matcher took Loot the
Hold. The rider-only reader sits with the WHOLE-CLAUSE patterns, and its
anchor is a quote IMMEDIATELY after gets/gains, which is what "rider-only"
means; a headed grant has its head in the way and keeps its own reader.

**AN UNREADABLE PAYLOAD REFUSES THE WHOLE CLAUSE** — v2.29's rule, applied
to a rider. Half a payload is not a cheap approximation when the half that
reads is the REWARD.

**AND `quotedText` NO LONGER NEEDS THE WORD "and".** A rider-only grant
has no head, so the anchor every other shape leans on is simply absent.
Widened to double quotes only — v3.41's mid-word-apostrophe hazard lives
in the other branch — and measured over the pool first: **22 extractions
identical, 6 newly found, 0 changed.** Measure a matcher change; do not
reason about it.

### AN ALLY IS A PERMANENT THAT ATTACKS (v3.44)

`weaponCost` is not a weapon reader. It is the one reader of **"Action -
<cost>: Attack"**, and every ally in the pool that can attack prints that
grammar exactly — so it had been answering cost, `taps` and `oncePerTurn`
correctly for all eleven **for years, while nothing asked it**. The parser
was never the gap; the ROUTE was, on both boards. `parser.allyAttack` is
the named question, and `parser.isWeapon` stays false for an ally (its
type line says no Weapon) — the two-names-two-questions split, again.

**A FABRICATION IS WORSE THAN A MISSING FEATURE, because it looks
finished.** `judge.legal` had no arena branch and said *"no such
equipment"* — visibly broken. The trainer's `allySwing` took the ally's
printed power straight off the opposing hero's life: no cost, no defend
step, one blanket `spent` for two limits that expire differently, and
Limpit's printed go again dropped. A 7-power Swabbie was **unblockable,
free and repeatable**. Neither sweep can see it — fairness does not model
board activations, and coverage reads every ally `full` because its
ability line is correctly NOOP'd.

**`from` IS THE SEAM, AND EVERYTHING ELSE CAME FREE.** Adding `from:
"ally"` to `execute`'s `attacking` bought the whole combat path: `pend`,
the wall, on-hit text, CR 1.4.5 targeting, the action point charged at
resolution and kept on go again, and every next-attack grant. **`fileAttack`
needed no change** — it files nothing on an activation route, so an ally
stays in the arena exactly as a weapon stays equipped. When a new source
of attacks appears, ask what `from` already buys before writing anything.

**A KEYWORD ON AN ACTIVATED-ABILITY LINE BELONGS TO THE ABILITY.** The
clause splitter breaks on the period, so Limpit's *"…: Attack. Go again"*
arrives as a clause of its own and set `fx.ga` — the CARD's. Driven,
**deploying Limpit kept its action point**. `printedKw` was already the
right discriminator (the keyword is mid-line, not its own paragraph) and
nothing was asking it.

**THE FIX IS ROUTE-AWARE, NOT A BLANKET CHANGE.** Measured first: 15 pool
cards set `fx.ga` without a printed keyword line and **13 are Equipment or
Weapons, never played from hand** — so suppressing it card-wide silently
costs Mark of the Huntsman its swing's go again. A weapon and an ally are
told apart by the ROUTE, not by the card. And on the ally *attack* route
the answer is the attack ability's OWN line, never `fx.ga`: Cutty Shark
prints its go again on a **different** ability, and reading one ability's
text onto another is its own bug.

**THE COST IS THE ABILITY'S, AND `.cost` IS NOT IT.** `build.js` folds a
weapon's activation cost onto its gear entry's `.cost`, which is how
`effCost` charges a swing without `effects.js` knowing what a weapon is —
so the trick does not generalise. An ally's `.cost` is its PLAY cost,
already spent deploying it. Charging both took 5 for a 2-cost attack.
**One charge site** (v2.80), and it asks which route it is on.

**A POWERLESS CARD IS NOT A SWING.** `allyAttack` requires a printed
`power > 0`, because `weaponCost` will happily match a **quoted granted
ability** inside a card's rules text — Cosmo's *"auras you control … are
weapons with \"Once per Turn Action - {r}: Attack\""*. judge's weapon
branch has no such guard and does route Cosmo as a swing; recorded in
HANDOFF.md rather than half-fixed.

### A RETIRED SHAPE TAKES ITS GUARD WITH IT, AND AN ANCHOR IS NOT AN ATOM (v3.43)

Two defects, both introduced by v3.42 in the grant it had just reshaped,
and both are shapes this file already names.

**A GUARD BELONGS TO THE SHAPE, NOT TO THE VERSION THAT WROTE IT.** v3.31
retired the bare ARRAY qualifier and wrote the guard in as many words:
*every field test passes vacuously on one, so a stale caller silently gets
"matches everything".* v3.42 made the identical move one shape later —
`gaNextQ` entries went from a bare qualifier to `{q, rider}` — and left the
guard behind. On a stale entry `x.q` is `undefined`, and `qualMatches`
answers **TRUE** for an absent qualifier *by design*. A pre-v3.42 grant off
a wire or a replay granted go again to every card and spent itself doing
it. **When you retire a shape, go and read the guard the last retirement
wrote, and ask whether it now needs a sibling.**

The guard goes in `takeGaNext`, not in `qualMatches`: *absent means
everything* is CORRECT for the matcher and wrong only for an ENTRY that
must always carry one. Putting it in the matcher would break every
genuinely unqualified caller. A drill pins the premise so the two cannot
drift.

**THE PRINTED WORD A REGEX MATCHES *ON* IS INVISIBLE TO THE QUALIFIER IT
BUILDS.** These readers anchor on "attack"; `attackQual` captures what
surrounds it. So `nonAtk` existed and `atk` did not, and **`qualLabel` was
already saying "a pirate ally attack" out loud while nothing tested it** —
the one namer and the one matcher, disagreeing about the same object. When
a namer asserts something, check the matcher enforces it.

**ONLY THE GRANT WITH TWO TAKERS NEEDED IT.** `gaNextQ` is the one whose
qualifier can meet a non-attack, because v3.31 gave it a non-attack taker
for Mage Master Boots; `buffQ`, `instantNextQ` and `costOff` are
attack-only by WHERE THEY ARE READ. That is why Yo Ho Ho! prints the
identical *"Pirate ally attack"* phrase into `buffQ` and is safe, and it
is a property of the call sites rather than of the cards — **add a second
taker to any of the three and that family needs the atom the same day.**

**AND IT IS THE CALLER'S ANSWER, NEVER DERIVED.** `isAttack` reads the
type line and a **WEAPON's line carries no "Attack"** — `isAttack` is
false for every weapon in the pool — so a derived atom refuses every
weapon swing, which is the whole of Hit and Run. `execute` already decides
it once to pick its branch (`isAttack(card) || from === "weapon"`) and
hands the verdict down beside `from` and `boosted`. A caller that does not
say answers **no**: weaker than printed and visible. The derived version
is a sabotage a drill catches.

### A REFUSAL NOBODY IS TOLD ABOUT IS A LIE (v3.41)

v3.10 built `quotedOnHit` to REFUSE a granted ability it cannot read — the
head still lands, the card is weaker than printed rather than guessed at,
and its note says *"that leaves the gap visible in the audit"*. The first
half was true. The second was not: the clause is still consumed by its
HEAD, so it reports `run` and the card comes out **`tier: full` with a
printed ability doing nothing**. Four pool records, for ten versions.

**NO TOOL COULD SEE IT.** Coverage counts the clause consumed; the fairness
sweep is deliberately one-sided toward too-strong and all four are WEAKER
than printed. The no-op blind spot with a quote around it.

**A REFUSAL IS ONLY HONEST IF SOMETHING REPORTS IT.** `fx.quotedUnread`
carries the unread riders and `tools/audit.js` flags each by name. When you
write "this refuses, so the gap stays visible", go and check that something
actually makes it visible.

**RECORDED, NOT DOWNGRADED.** Marking the clause unread lies the other way
— Display Loyalty's go again really does work and the card reported `none`.
The tier stays accurate about the HEAD and the flag carries the rider.

**"IS THERE A READER" IS ANSWERABLE; "DID IT LAND" IS NOT.** A rider can
ride somewhere other than `fx.onHit` — Mauvrion Skies' Runechants are the
count `runeHitNext` — so a landing-check demotes cards that work, and
enumerating the carriers puts card knowledge in a generic guard. Avast Ye!
is the case this cannot see: its payload READS and is dropped by the
`gaNext` path, which carries a qualifier and no rider. A missing feature,
recorded in HANDOFF.md rather than papered over by a tier.

**AND THE MATCHER WAS WRITTEN TWICE**, so sabotaging one copy left the
other correct and the drill stayed green. `quotedText` is the one body.
Its closing quote is BACKREFERENCED to the opening one — a bare character
class let a mid-word apostrophe close the quote, and the audit printed the
truncation as its finding.

### WHEN YOU CLOSE A RECORDED GAP, DELETE THE RECORD (v3.41)

Three standing claims had gone stale, and each would have cost the next
reader real time:

| claim | truth |
|---|---|
| Cold Snap "IS UNREAD ON PURPOSE", with a list of what it would need | BUILT several versions ago. A long confident note saying a card is deliberately unbuilt, sitting directly above the code that builds it, is worse than no note |
| a `pick` "reports only in `msgs`" | `out.picked` exists and v3.39 relies on it |
| a class-aware turn history "would also unblock Quick Clicks" | **wrong** — *Nimblism* is a card NAME, so `hist.playTy` can never answer it. It needs a NAME history, the twin of `hist.atkNames` |

**A doc claim is a test with no assertion.** Sweep them the way you sweep
the pool: take each sentence that says something is unbuilt, and ask the
code.

### TWO DIRECTIONS OF ONE EVENT ARE TWO RECORDS (v3.40)

`hist.arc` is what the DEALER did (v3.28). *"If you have **been dealt**
arcane damage this turn"* (Arcane Polarity x3) is the mirror question and
could not be asked at all — and reading it as `arcDealt` pays a hero for
burning the opponent rather than for being burned, which is the card
backwards. `hist.arcTaken` is the other record.

**BOTH ARE CREDITED FROM ONE BODY**, so CR 7.5.5's *prevented is not dealt*
governs them together: a hit turned entirely aside credits **neither**
side. That falls out of the existing `if(left > 0)` guard rather than being
restated — which is the whole reason to put the second credit there rather
than at a call site, and is how the first one went wrong in v3.28.

**THE VICTIM IS THE ACTOR ON THE DEFERRED PATH, and only there.** When the
threatened hero holds a barrier the damage rides out on the soak answer,
which is given by the side being HIT — the exact inversion the dealer's
half already documents, read from the other end.

**When a card asks about an event, ask WHOSE event it is.** Dealt/taken,
played/put, created/destroyed: each pair is two records, and the one that
already exists is the tempting wrong answer.

### A COST COUPLED TO THE CHOICE NEEDS NO X MACHINERY (v3.39)

Blaze prints *"Remove **X** energy counters: banish a Wizard non-attack
action card with an effect that deals arcane damage **equal to X**"*, and X
looks like the X-cost family this project refuses (Ice Eternal). It is not.
**The player picks a card and X is that card's own arcane**, so the
coupling lives in the FILTER — offer only what the pool can pay for — and
the price is settled by the choice. Nothing asks for a number.

**THE POOL BOUND IS THE QUEUE SITE'S, NEVER THE PARSE'S.** `fxParse`
memoizes on `name|pitch`, so one parse serves every copy in a match; a
number stored there freezes at whatever the counters were the first time it
was read. Same rule `notUid` follows for `notSelf` (v3.20), and a drill
asserts the parse carries no bound.

**`arcAmount` COUNTS THE UNCONDITIONAL OPS ONLY, because it is the PRICE.**
Emeritus Scolding prints 4 with a conditional 6. Charging 6 for a card that
deals 4 is the wrong direction, and a gated amount is not one the engine
can promise. One copy, in `parser.js` — the filter and the cost both ask.

**A DEAD TAP IS REFUSED BY NAME.** An empty pool means the filter admits
nothing, `buildPrompt` returns null and the sheet skips itself — after
burning the once-per-turn. `legal` asks the SAME filter the queue site will
build, so the two cannot disagree about what is a legal choice.

**AND A COUNTER THE ABILITY SPENDS MUST BE ON SCREEN.** A pool the player
cannot see is a cost they cannot plan around.

### THREE ROUTES A HERO ABILITY DID NOT HAVE (v3.39)

Found while building Blaze, and none of them his:

| | |
|---|---|
| the HERO powCard was **truncated at the first period** | v2.34 made exactly this fix for EQUIPMENT (`_effFull`) and never here, so **Lyath Goldmane's ability lost a whole sentence**. Latent — that clause still has no reader — and now recorded rather than waiting to surprise someone |
| the TABLE had no `"hero"` branch in `doActivate` | an ACTIVATED hero ability was unreachable there. The same one-board shape v3.04 found for 17 equipment abilities |
| the trainer gated ⚡ USE on `mode === "act"` | the ACTION phase only, so an ability printed **Instant** could not be used on the opponent's turn — which for Blaze is half of what it is for (CR 8.1.6) |

**A HERO ABILITY IS FINISHED WHEN IT RUNS ON BOTH BOARDS.** The deck
parsing is a different question, and Blaze's deck was 22 of 23 while his
hero did nothing at all.

**AND `optFilter` LEARNED A CLASS WORD.** "A WIZARD non-attack action card"
— `ty` takes a LIST now so the class and the type are asked together, since
*action* alone offers a Runeblade action and *wizard* alone offers a Wizard
attack. **The whole phrase is tried FIRST**: ordered the other way, "ATTACK
ACTION CARD" splits as class *attack* plus *action card* — a subject the
reader already knows, read as two things it is not. Three existing drills
caught it, which is the whole-phrase rule working on a change to itself.

### A TURN HISTORY THAT KNOWS THE CLASS (v3.38)

`hist.non` counts non-attacks and records no CLASS, so Snapback's *"if you
have played another **Wizard** non-attack action card this turn"* could not
be asked at all. v3.36 REFUSED it rather than reading it as the bare count,
which would have granted the instant-speed window off any non-attack —
stronger than the card's own text. `hist.playTy` is the record that removed
the reason.

**ONE ENTRY PER PLAY, NOT A FLAT SET OF WORDS.** The question pairs a class
with a type — Wizard AND action AND not attack — so a flat set answers TRUE
for a Wizard *attack* plus an unrelated non-attack: **two cards
contributing half the condition each**. That is the whole reason the record
has the shape it has, and the sabotage that flattens it fails a drill.

**THE STRUCTURED ARRAY, lowercased** (v2.44). `tt` calls Den of the Spider
an "Action Defense Reaction"; the array does not.

**RECORDED AFTER THE CARD RESOLVES**, beside `hist.non` and for its reason:
*"another"* must not count the card asking. The speed grant is asked at
LEGALITY time — before the play — so neither reading self-counts.

**A REFUSAL WITH A WRITTEN REASON IS A DEBT, AND IT CAME DUE.** The pin in
`asinstant.test.js` carried the reason in its own assertion text, so when
the reason stopped being true the drill failed and the edit was forced to
be deliberate. That is what a recorded refusal is FOR — the alternative is
a gap nobody revisits. Keep the refusal property alive with a separate
probe when you retire one: the vocabulary stays closed, and a gate with no
reader still leaves the card in its printed window.

### FIVE QUALIFIED SINGLE-SHOT GRANTS, ONE READER (v3.37, v3.64)

> **`defCapNext` JOINED THEM AT v3.64** — Confidence's *"your next attack
> action card this turn can't be defended by more than 2 non-block
> cards"*. Same `attackQual` tail reader, same waits-rather-than-spent
> rule, same expiry; building it invented no vocabulary, which is now the
> fourth time that has been true of this family. Symmetry ledger 44 → 45.

### FOUR QUALIFIED SINGLE-SHOT GRANTS, ONE READER (v3.37)

| field | grants | since |
|---|---|---|
| `buffQ` | power | v2.30 |
| `gaNextQ` | go again | v3.31 |
| `costOff` | cost | v3.32 |
| `instantNextQ` | the **WINDOW** | v3.37 |

All four **wait** for the card the printed line names, all four ask
`qualMatches`, and building the fourth invented no vocabulary — the third
time that has been true of this family. Symmetry ledger 42 → 43.

**TWO SENTENCES ABOUT ONE CARD MUST BE PAIRED.** Stir the Aetherwinds
prints *"your next Wizard non-attack action card … as though it were an
instant"* and then *"if **it** has an arcane damage effect, instead it
deals that much arcane damage plus 1."* They arrive as separate clauses —
the splitter breaks on the period — so they are folded in `fxParse` where
the whole card is visible, the same place and reason `optCost` pairs its
halves.

**UNPAIRED, THE AMP LEAKS ONTO A CARD THE LINE NEVER NAMED.** `amp` is a
bare number on the side meaning "the next arcane, whatever it is". Driven,
Stir's +1 amped **Sigil of Suffering** — a Runeblade *Defense Reaction*,
neither Wizard nor a non-attack action card. RESTRICTION-DROPPED, and the
fairness sweep is blind to it because that check does not model `amp`.
v2.30's arrow-buff-on-a-sword, one op further down.

**AND THE BARE OP IS STILL RIGHT FOR ITS OWN CARD.** Cindering Foresight
prints *"THE NEXT CARD you play this turn with an arcane damage effect"* —
genuinely unqualified. Two cards, one op, two printed scopes; fold only
where a grant is present.

**READ, NEVER SPENT.** `playsAsInstant` consults the held grants on every
dim and every legality check, so consuming there burns the grant on
*looking at your hand*. `takeInstantNext` spends it, once, at the play.
Same read/spend split `effCost` keeps for `costOff` (v3.32).

**SPENT WHATEVER WINDOW IT WAS PLAYED IN** — the card was your "next" one
either way, and the amp is printed about that same card. Holding it back
for a later card is stronger than printed.

**THE TAKE PRECEDES THE OPS**, because `arcane` reads `sd.amp` as it
resolves. Taken after, the grant is spent on the very card its bonus was
printed for and pays nothing.

**AN UNREADABLE TAIL REFUSES THE WHOLE CLAUSE** (v3.31, fourth member).
`attackQual` returning false means "a restriction I cannot read", not
"nothing restricts this"; collapsing them yields a grant qualified only by
`nonAtk`, which frees every non-attack action card at instant speed. **Its
drill uses synthetic text**, because no pool card prints that shape — the
same situation as `asInstantMet`'s unknown-`when`, one layer out.

### A SPEED GRANT IS A WINDOW, AND THE WINDOW PAYS THE COST (v3.36)

**14 pool records print *"as though it were an instant"* and not one was
read**, across three heroes. It is Iyslander's whole identity — both
sentences of Essence of Ice are about acting on the opponent's turn — and
finding it took reading the hero ability before the cards, which is the
Kayo method paying out for the second time.

`playsAsInstant(c, o)` is the ONE reader, pure, with the game's half
supplied by the caller, exactly as `playableFromZone` is. It answers for
TWO printed sources because they are the same question: the CARD's own
line (`fx.asInstant`) and the HERO's standing grant over a zone, which is
a build passive and cannot be read off a card at all.

**WIDENING THE WINDOW IN ONE PLACE PUT HER ON A NEGATIVE ACTION POINT.**

| | decides |
|---|---|
| `playableWhy` | whether the play is LEGAL |
| `playWindowFor` | which window it HAPPENS in — so whether an action point is charged |

Widened in the first and not the second, the play was allowed in the
instant window and then charged as an action: driven, `ap: -1`, which is
`NEGATIVE-AP` (CR 4.4.3e — points are lost, never owed) and is also the
`legal`/`reduce` agreement `fuzz.test.js` exists to hold. **`windowsNow`
is the one body both ask.**

**THE ACTION POINT THEN FOLLOWS FOR FREE.** `costsAP` charges one only in
the `action` window, so a card played through the grant is charged
nothing — the recorded ruling (user, 2026-08-10) rather than a special
case. And it could not be otherwise: a seat holds NO action point during
the opponent's turn (CR 4.4.3e takes it, CR 4.3.2 issues the next at the
start of their own action phase), so **a grant that still charged one
would be a grant nobody could ever use.**

**THE ZONE IS THE CALLER'S ANSWER**, like the wall and the incoming
attack. Her line frees blue non-attack action cards from her ARSENAL; by
the time the reader is asked, the card is just a card. A caller that says
nothing gets `"hand"`, which denies the grant — weaker than printed and
visible. A drill checks every call site names its zone.

**AN INSTANT NEEDS NO GRANT (CR 8.1.6).** The first draft of the
trainer's de-duplication asked about the grant ALONE, and so refused a
blue Instant set in the arsenal — Frost Spike, out of her own deck — with
*"is an attack"*: a lost line of play and a wrong message, out of a change
that was otherwise pure removal of a duplicate. Ask both reasons.

**WHAT REFUSES, AND WHY EACH REFUSAL IS HONEST.** Snapback's *"if you
have played another WIZARD non-attack action card this turn"* needs a
class-aware turn history; `hist` counts non-attacks (`non`) and records
no class. Reading it as the bare count grants the window off ANY
non-attack, which is stronger than the card's own text. An unknown
condition answers **FALSE** in `asInstantMet` (v3.26's rule) — and its
drill asks the function BY NAME, because the parser only emits conditions
the evaluator knows, so no card fixture can reach that default.

### THE DATABASE PRINTS BOTH WORDINGS AT ONCE (v3.36)

v3.00 said upstream expands contractions and moves under you. The sharper
form: **it prints both spellings simultaneously, today.** Ten pool clauses
say *"if it's blue"* and two say *"if it is Draconic"* — so the anchors
had drifted to match whichever they were written against, `/^it'?s blue$/`
on one line and `/^it is draconic$/` three lines below it. Either stops
dead the moment upstream levels the other way.

`it's` → `it is` is a SYNONYMS entry now, and the two anchors spelling the
contraction were retargeted. **Measured over all 788 records before and
after: zero cards moved** — which is the correct result and is also
indistinguishable from a change that never applied, so both wordings were
driven through `classifyClause` to prove the levelling actually fires.

**A RAW-CLAUSE SCAN MUST LEVEL FOR ITSELF.** `defSelf`, `asInstant` and
their neighbours scan `clauses[ci]` RAW with `/i`, not the lowercased text
`classifyClause` works on — so SYNONYMS does not reach them and every
contraction would have to be spelled twice. `asInstantCond` calls
`levelIdiom` itself. That is the drift the table exists to delete.

### SABOTAGE FOUND TWO DEFECTS IN THIS VERSION'S OWN DRILLS (v3.36)

Both are the shapes this file already names, which is the point:

- **a fixture that could not tell two gates apart.** The non-attack gate
  was drilled with Wounded Bull — a RED attack — so the BLUE gate refused
  it and dropping the non-attack gate changed nothing. The drill passed
  against a sabotaged engine. Brothers in Arms is blue AND an attack, out
  of her own deck, so only the half under test can refuse it. v3.31's
  *"pick a fixture that tells the two halves apart"*, cost a second time.
- **a source guard with no word boundary.** `/const playArsenalInstant[\s\S]*?/`
  matched `playArsenalInstantRENAMED` perfectly, so the anchor-moved
  assertion could never fire. **Sabotage the guard, not just the code** —
  and rename the thing it anchors on, which is the sabotage that finds it.

**A COMPILE CHECK SEES WHAT BRACKET BALANCE CANNOT.** `html-balance.test.js`
proves the brackets balance, and v2.27 shipped a page that was balanced
AND broken. Compiling both `text/babel` blocks with `@babel/standalone`
(`presets:["react"], sourceType:"script"`) catches a real syntax slip in
one second. It is a MANUAL pre-ship step, deliberately not a drill: the
project has no dependencies and `npm test` must stay green on a fresh
clone with no `npm install` (v3.00). Run it after any `index.html` edit.

### A PENDING IS ONE FIELD AND FOUR KINDS — WHITELIST IT (v3.35)

The table demuxed `pending` as `kind !== "boost"`, so **every other kind
rendered as a PAYMENT**. Reported from a real table on turn 1: the
split-card declaration opened a pitch sheet reading *"covered ✓"* for a
card costing **0**, and Pitch & play then sent `payConfirm`, which `legal`
refuses. **A screen whose only exit was Cancel.** `addPay` would have done
the same.

`judge.PENDING_KINDS` is the census now, and a kind with no branch in the
demux **or in the action bar** fails a drill. A blacklist is the bug: the
next kind added walks into the same fallback.

### THE DECLARED HALF DECIDES THE WINDOW (v3.35)

`types.playWindows` reads a `//` card's FRONT face — v2.39 made it, so the
whole card would stop reading as an Instant and taking a free action
point. True while the card was played as one lump, and it also meant **the
INSTANT half could never be played at instant speed**, which is a printed
line of play.

| declared | windows |
|---|---|
| nothing yet | the UNION — the card is offered in either |
| half 0 or 1 | that half's only |
| both (meld) | ACTION if either side is one (CR: empty stack, one action point) |

**v2.39's hazard is closed by the DECLARATION, not by pretending.** Burn
Up declared alone has only the action window, so `typeCostsAP` can never
be asked about it in a free one.

**"AFFORDABLE" IS A DIFFERENT QUESTION BEFORE YOU DECLARE.** The check runs
ahead of the choice and asks whether ANY half could be played; meld is
`OR` across the halves, an undeclared card is `AND`. Asking the front face
refuses a seat with no action point a card whose instant half costs none.
The two readings coincide in every state reachable today only because
`speedAllowed` opens the instant window beside the action one — a
coincidence, not a rule, so the site asks the correct reader and a drill
pins it BY NAME (v3.26's call for an unreachable default).

**A SPLIT CARD IS TURNED TO BE READ** — counter-clockwise; `+90deg` is
upside down, checked by rendering both. The frame goes landscape at the
card's real aspect the other way up and the image box is the frame's
dimensions swapped; a drift between the three crops the art.

### A SPLIT CARD IS ONE CARD WITH TWO TEXTBOXES (v3.34)

Two pool records are printed HORIZONTALLY and cut in half, and both print
the rule in reminder text:

> **Meld** *(You may play 1 or both halves of this card. Each costs 0.)*

**ONE card.** One pitch value, one defence value, one card in hand, one
card in the graveyard. What is doubled is the TEXTBOX — the CR is explicit
that a melded split card is a *single card played as a single layer* with
the properties of both sides. Dealing it as two cards would break the
55-card count, the pitch value, the wall and the census at once.

**THE ENGINE RAN BOTH HALVES, ALWAYS, ASKING NOTHING.** Burn Up // Shock
dealt **five arcane on play** and kept its action point, where the top
half is a DELAYED trigger — *"the next time an attack you control hits a
hero this turn"* — whose whole prefix was swallowed. It read `tier: part`,
so no coverage tool looked at it.

| | |
|---|---|
| which cards | `played_horizontally`, the DATABASE's flag. `//` in the type line is a RENDERING, not a fact |
| the halves | told apart by **`tt`** — the only place the boundary survives, because `ty` flattens both faces (v2.39) |
| a half's keywords | its OWN textbox. `card_keywords` lists the whole card's, and Go again is on the top half only (v2.31) |
| the declaration | asked FIRST, before the payment — melding doubles the base cost |
| the default | the LEFT half, **never both**. Defaulting to meld hands a player a textbox they never asked for |
| the action point | the DECLARED half's. Meld costs one if EITHER side is an Action |

**RESOLUTION ORDER FOR A MELD IS A STATED APPROXIMATION** — the CR gives
priority between the two sides; this runs them in printed order as one
layer. Both pool cards' halves are independent, so nothing is observable.

**AND `Meld` IS A `noop` ONLY NOW THAT THE CHOICE EXISTS** — filed earlier
it would have been the no-op blind spot at its purest.

### A COST IS SETTLED BEFORE THE CARD RESOLVES (v3.34)

Staunch Response's *"as an additional cost to play this, you MAY pay
{r}{r}{r}{r}"* cannot be a queued prompt: `openPrompt` drains after the
card has resolved, which is the wall Charge and Fusion still sit behind.
**Boost is the precedent on both boards** — pause, ask, and let the answer
ride to `execute` on the state (`_doBoost`, `_addPaid`, `_half`).

Asked only when there is a real choice (enough for BOTH costs), and the
rider's answer belongs to the PLAY rather than the card, so
`defSelf.when === "addCostPaid"` reads `opts.addPaid`.

### THREE WALLS, ONE READER — AND THE TRAINER HAD NONE (v3.34)

`defendValue` was reached from `resolveStack` alone, which is the wall the
DUMMY raises. **When the player blocked — most of the trainer — every
defensive self-buff built since v3.23 did nothing.** Sigil of Suffering
blocked for 3 on one board and 4 on the other from the same state.

What the trainer genuinely cannot answer stays honestly unmet: the dummy's
swing is the `[3,4,5]` escalation, not a card, so the conditions that ask
about the incoming CARD read false rather than being guessed.

**AND "THIS TURN" NEVER ENDED AT THE TABLE.** Five single-shot grants
(`buffNext`/`buffQ`, `gaNext`/`gaNextQ`, `costOff`) are all printed "this
turn"; the trainer cleared two of five for one seat and judge cleared
none. They expire in `beginEndPhase` now, for BOTH seats.

### A KEYWORD LINE MAY CARRY A RIDER (v3.33)

`printedKw`'s layout rule demanded the keyword be THE WHOLE LINE. The
database writes a **triggered** keyword with its rider attached:

> `Crush - When this deals 4 or more damage to a hero, …`

So `printedKw(c,"crush")` was **FALSE for all twelve crush cards**, and
the same for reprise, high tide, surge and heave — 21 answers wrong.

**THE WIDENING IS THE DASH, NOT A SUBSTRING.** The keyword must still
START the line, so *"when you boost a card"* and *"your attacks with
stealth"* — the references this predicate exists to exclude — are
untouched. Measured across the pool and every keyword before changing it:
21 answers move, all cards that genuinely carry the keyword, **none** for
boost, go again, stealth or dominate. Measure the blast radius of a
predicate change; do not reason about it.

### A REVEAL IS A COST THAT MOVES NOTHING (v3.33)

Crash and Bash reveals a card and the card **stays in the hand** — the
cost is the information. It is the one member of the optional-cost family
with **no destination**, so `to` is OMITTED rather than defaulted; filing
it to the graveyard spends a card the text never spends.

**"WITH <KEYWORD>" IS A PRINTED FIELD** once `printedKw` can answer it,
and the old refusal ("a rules-text qualifier") was honest only while
nothing could. **The keyword list is CLOSED** — widening it to any word
after "with" re-opens the hole the refusal was protecting, because a
dynamic limit would read as a keyword and be dropped.

**A {t} INSIDE A PAY-COST IS PART OF THE COST.** Magmatic Carapace's
*"you may {t} this and pay {r}"* is once per turn on a card that never
prints "Once per Turn" — a tapped permanent does not untap until CR
4.4.3d (v2.42's Scorpio-vs-Sledge). `taps` had to be added to
`buildPrompt` EXPLICITLY: a spec only carries fields it knows about
(v2.34's `arsStamp`), and a dropped one makes the tap free.

**TWO TRIGGERS, EACH OUT OF ONE BODY.** `defends` fires from
`afterDefenders` — where phantasm already lives, already taking the wall
as the CALLER's answer — and is addressed to the **defender**, because
inside a link the actor is the ATTACKER. `playAura` fires in `execute`,
and **the watcher is not the card being played**: every other trigger
there asks the resolving card about itself, while this one asks what is
WATCHING, and Magmatic Carapace is a Chest piece, so a board-only scan
finds nothing.

**AND IT DRAINS ONLY WHAT IT QUEUED.** A blanket `openPrompt` in
`afterDefenders` opened whatever else was waiting, mid-combat, and
stalled three drills at the damage step on cards printing no such
trigger. A prompt is drained by whoever queued it.

### A MINTED TOKEN WORE A LOWERCASED NAME (v3.33)

`classifyClause` works on the LOWERCASED clause and `resolveEntry`
returns the ENTRY's name by design (v2.48) — so every token the parser
minted reached the board as *"seismic surge"*, *"might"*, *"frostbite"*.
**12 token names across a dozen cards**, Kayo's Might and Iyslander's
Frostbite among them, shown to the player. v3.21's shape exactly.

`resolveEntry` answers **`dbName`** now — what the DATABASE calls the
card — and the mint uses it. `name` still means the entry's name, because
a deck list names its own cards.

**AND A HEADING IS NOT A CLAUSE.** `Choose 1;` reported unread on both
modal cards while both modes were built, like Briar's *"Essence of Earth
and Lightning"*. Filed `noop` — honest ONLY because the modes exist and
an unreadable mode is still refused (v3.12).

### THE PRINTED CARD IS THE ORACLE FOR A KEYWORD (v3.32)

Thunder Quake's entire database text is `**Heave 3**` — no reminder text
in any field. **The card has it**, and reading the printing settled the
whole build:

> *(At the beginning of your end phase, if Thunder Quake is in your hand
> and you have an empty arsenal zone, you may pay {r}{r}{r} and put
> Thunder Quake FACE UP into your arsenal. If you do, create 3 Seismic
> Surge tokens.)*

That is more precise than the ruling recorded 2026-07-25, which had heave
**replacing** the arsenal action rather than performing one and knew
nothing of the empty-arsenal gate or the face-up put. **Try the printing
before booking a question** — second time this has paid (Clash of Agility
was the first).

**BOTH NUMBERS ARE THE KEYWORD'S PARAMETER.** The cost and the token count
are each N, and Thunder Quake prints 3 for both — so no pool fixture can
tell a read number from a hardcoded one. Drill it with a synthetic.

**THE GATE IS `arsEmpty`, NOT `arsFree`** (v2.34). They coincide at
capacity 1, which is why the wrong one stays invisible.

**PITCHING FOR IT IS NOT OFFERED.** CR 4.4.3c sends the pitch zone to the
deck bottom two steps later and 4.4.3e fizzles the rest, so pitching here
spends cards for a discount that cannot be banked. What it may spend is
what it is about to lose.

**WHERE THE PLAYER IS ASKED IS A STATED APPROXIMATION.** CR 4.4.1 gives
nobody priority in the end phase, so the only place a choice can be put is
a pause the turn structure already owns — and this effect IS an arsenal
set. Offered at the arsenal step on both boards. The one observable
difference is a hand-sweep (Inertia) firing first, which already precedes
the ORDINARY arsenal set. CR 4.1.8a's trigger ordering is not modelled.

**A `noop` FOR A KEYWORD IS ONLY HONEST ONCE THE KEYWORD IS CARRIED.**
`Heave N` is filed `noop` now and would have been the blind spot exactly
if filed earlier. `tools/ledger.js` is the discriminator: heave is `live`
there, so `failstates.js` grades it against the claim, not a grep.

### THREE QUALIFIED SINGLE-SHOT GRANTS, ONE READER (v3.32)

> **SUPERSEDED BY v3.37 — there are FOUR.** `instantNextQ` joined them;
> see the section of that name above. Kept because the argument below for
> why a grant WAITS, and why `effCost` is pure, is unchanged.

| field | grants | since |
|---|---|---|
| `buffQ` | power | v2.30 |
| `gaNextQ` | go again | v3.31 |
| `costOff` | cost | v3.32 |

All three **wait** for the card the printed line names rather than being
spent by one that does not match, and all three ask `qualMatches`.
Building the third invented no vocabulary — v3.31's tail reader already
handles *"your next Guardian attack action card this turn"*.

**`effCost` IS PURE.** It is read twice and only one read takes resources
(v2.80), so the grant is spent at the **charge**, like the next-turn tax
(v3.29). **"Your NEXT" is one card per grant** — two tokens are two cards,
never {r}{r} off one.

**AND SEISMIC SURGE WAS `none` ON PURPOSE.** `selfDestruct … then X`
refuses when X has no reader, precisely so a schedule cannot be filed
`full` with its payout missing (v3.07). Building the payout is what gave
the token its clock; without one it sat on the board forever inflating
every "auras you control" count.

### THE RESTRICTION CAN COME AFTER THE SUBJECT (v3.31)

> **Target attack action card WITH COST 1 OR LESS gets +3{p}.**

Every reader of that family captured the words BEFORE "attack" and let
`[^.]*` swallow the rest, so **13 pool cards applied to any attack at
all** — Lightning Press pumped a cost-3 attack, driven and confirmed.
**All read `tier: full`**, because the clause WAS consumed; and the
fairness sweep was blind for the same reason the parser was — its
captures stopped at the same word.

Five atoms live in the tail: `action card` (`isAtkActionCard`), `with
stealth` (`printedKw`, per the 2026-07-25 ruling), `with cost N or
less/more`, `with N or less base {p}`, and the two about the PLAY —
`you play from arsenal` and `you boost`.

**A WINDOW IS NOT A RESTRICTION.** *"this turn"* and *"this combat
chain"* say how long a buff waits, never which attack it may land on.

**AN UNREADABLE TAIL REFUSES THE WHOLE CLAUSE.** `attackQual` returns
**`false`**, which is a different answer from `null` ("nothing restricts
this") — collapsing those two is how the bug shipped.

**"NON-ATTACK" CONTAINS "ATTACK."** Mage Master Boots' *"the next
non-attack action card you play this turn gets go again"* handed the
grant to the next ATTACK. That is v2.44's Reaction-contains-action trap
on the most valuable keyword in the game to get wrong. `gaNextQ` is
`gaNext`'s `buffQ`: a qualified grant that does not match is **not
spent**, it waits (v2.30). **One taker, two branches** — an attack
settles on the chain and a non-attack at the action point, so a taker in
the attack branch alone builds half the rule. Ledger 40 → 41.

**ONE SHAPE, ONE MATCHER, ONE NAMER.** The qualifier is an object, not an
array: the atoms have nowhere to live in an array, and an array carrying
extra properties is the same-name-different-meaning trap. `qualMatches`
is the one matcher and **a bare array now matches NOTHING** — every field
test passes vacuously on one, so a stale caller would silently get
"matches everything". It refuses rather than throwing, because `reduce`
is fed by JSON off a wire. `qualLabel` is the one namer; five sites had
hand-rolled `q.map(g=>g.join(" ")).join(" or ")` and every one of them
threw the moment the shape grew a field.

**A CARD PRINTING NO COST SATISFIES NO COST COMPARISON.** Equipment,
Weapons and Blocks carry `cost: null`; reading it as 0 hands every "cost
1 or less" buff to a weapon swing.

**AND A DRILL WAS PASSING BECAUSE OF THE BUG.** `reactions.test.js` used
Stains of the Redback as its *"+3, no qualifier"* fixture; the card
prints *"target attack with stealth"*, so the fixture was valid only
while the restriction was dropped. **When a fix breaks a drill, read the
fixture before reshaping the assertion.**

### A RESTRICTION IS NOT A DEBUFF (v3.30)

The other two crush riders on that schedule, and the difference is easy
to get backwards in a direction that matters:

| | carries | consumed by | printed window |
|---|---|---|---|
| a **debuff** | an amount | the FIRST thing it touches | *"their first attack during their next turn"* |
| a **restriction** | nothing | **nothing — never spent** | *"during their next action phase"* |

A debuff lasting the phase is stronger than printed; a restriction spent
on one play is weaker. **`nextTurnHas` asks by kind; `nextTurnDebuff`
sums.** Asking the summer for a restriction gives 0, and every `>= 0`
around it is a gate that gates nothing.

**CHOKESLAM CAPS, IT NEVER SUBTRACTS.** *"Can't gain {p}"* forbids
GAINING, so an attack already below its printed power (frailty,
Debilitate's own rider) must not be lifted back to it — `Math.min`, not
an assignment.

**TWO SITES, ONE RULE.** The cap is applied at declaration AND in
`linkPumps`, which re-adds every `{k:"rx"}` layer afterwards; a cap
applied once is undone by any attack reaction. Dropping either failed NO
drill until the sabotage pass said so — and the drill that covers the
second reads `linkPumps`'s **returned** total, because the pend it leaves
alone is the declaration measured a second time.

**AND THE CAP GOES LAST** of the declaration-time modifiers. Ahead of
Courage's pop or Debilitate's debuff it caps a number that is not the one
being declared; it happened to give the right answer there, which is
worse than giving the wrong one.

**CRUSH THE WEAK IS A LEGALITY, NOT A MODIFIER.** `parser.nextTurnBars`
is the one reader and both boards ask it before the card leaves the hand
— refusing after it has left costs the player a card for a play the rules
never allowed (v3.11's shape). It reads **`isAtkActionCard`, never
`isAttack`**: the latter tests `tt`, and **"Reaction" contains
"action"**, so an attack REACTION would be barred by a card that never
names one. The threshold and the BASE power are both the card's own
numbers.

### PREVENTED IS NOT DEALT, AND THE CREDIT MOVES WITH IT (v3.28)

**RULING (user, 2026-08-22): Sigil of Suffering's own arcane satisfies its
own condition — "as long as it's not prevented."**

`hist.arc`, the field behind *"if you've dealt arcane damage this turn"*,
was incremented at the CALL SITE before `arcaneHit` ran, so a point turned
entirely aside by a shield, a ward or a barrier still counted as dealt.
It is credited inside `arcaneHit`, where the damage lands, and a fully
prevented hit now credits nothing (CR 7.5.5).

**ONE INSTANCE PER SOURCE, never per point.** Three Runechants are three
threats a hero may answer three times; points and instances coincide only
while a token deals exactly 1.

**THE DEFERRED PATH CREDITS THE DEALER.** When the threatened hero holds a
barrier the damage is not applied — it rides out on the soak answer as
`arcTaken`, and that answer is given by the side being HIT
(`promptConfirm` borrows their seat), so the actor there is the victim.
The dealing seat rides on the spec as `by` and is passed through
`buildPrompt` explicitly — a spec only carries fields it knows about
(`arsStamp`, v2.34).

**SABOTAGE IS THE ONLY REASON THAT HALF EXISTS.** On the immediate path
the dealer IS the actor, so swapping the lookup for `actMut` failed
nothing at all. A drill that cannot tell two things apart has not tested
either.

**AND A SOURCE SLICE ROTS WHERE A RULE MOVES.** Three drills grepped the
pop block for this credit — written when `execute` was unreachable inside
the React component. The credit has now left that block entirely, for the
second time (v3.22, v3.28). They are driven now.

### A SOURCE GUARD CANNOT SEE A WALL THAT STOPPED COUNTING (v3.27)

Unity asks *"does a card from hand defend alongside me"*, so both walls
count their hand defenders BEFORE either loop starts — judge loops gear
first, and a running total reads zero for every piece.

The guard asserted the count is **declared before it is used**. Replacing
either count with a literal `0` still declares it before use, so the guard
passed on a wall that had stopped counting. **Both walls are driven now**,
with a real block: judge's through `reduce`, the trainer's through
`resolveStack`, which judge never calls — a drill on one board says
nothing about the other. The DECLARATION is constructed in both, and that
is legitimate: which cards defend is the caller's answer either way. What
is measured is what the wall makes of them.

**AT-REST vs WALL-TIME is the boundary for this family.** A condition true
only while blocking (Unity, Blade Beckoner, Wax On) has no at-rest number
to display, so building it at the wall alone is complete. A condition true
sitting on the board — Basalt Boots' Seismic Surge token, Mournful
Casket's graveyard — would put a number on screen that disagrees with the
number that blocked. Those wait for a display pass; the split is not
laziness, it is which half of the sev-2 category you land in.

### A DEFENCE CONDITION IS ANSWERED FROM THREE DIFFERENT PLACES (v3.26)

`fx.defSelf` carries a CONDITION, not a flag, and `defSelfMet` answers it:

| `when` | answered from |
|---|---|
| `weaponAttack` | the INCOMING attack — the caller's, nothing else knows |
| `arcDealt` | the defending side's own turn history |
| `atkActionCostLe` | the incoming attack CARD — its type and its cost |

**AN UNKNOWN `when` RETURNS FALSE.** A condition added to the parser and
forgotten in the evaluator leaves the card at its printed value. Weaker
than printed and visible; the other direction grants a buff nobody built.
Its drill asks `defSelfMet` DIRECTLY, because no card fixture can reach
that default — the parser only emits the three known values, so
`if(self && …)` short-circuits and a sabotage changes nothing.

**PICK A FIXTURE THAT TELLS THE TWO HALVES APART.** Testing Wax On's
*"attack action card"* against a WEAPON proves nothing: a weapon carries
neither Action nor Attack, so dropping either half of the test still
excludes it. A **non-attack action card** is the shape that bites.

### A DEFENCE REACTION IS PLAYED, NOT DECLARED — AND IT STILL BLOCKS (v3.25)

**Every defence reaction in the pool blocked for zero at the table** — 15
cards, 39 copies, 11 of 15 heroes. `blockRx` has been a side field since
v2.14 and cleared in judge's `strike` since v2.46, and was never WRITTEN
or READ there. The card resolved its text, reached the graveyard, and the
number printed on it was discarded.

The trainer always summed it (`drx`). **One board had the rule and the
other did not** — v3.17's shape, and the reason that entry says a comment
is not a mechanism. Here the *field* and the *clear* both existed, which
made it look wired.

**DRIVEN BEFORE IT WAS BELIEVED.** Sigil of Suffering prints 3: played
into a 6-power attack it dealt its 1 arcane and the defender still took
6. The OPS were never the broken half, and both are pinned together now
so a later fix cannot trade one for the other.

**No tool could see it.** `journey.test.js` proves a defence reaction is
never DECLARED (CR 8.1.3a) — the other half of the rule — and nothing
asked whether a PLAYED one did anything. Coverage reads them `full`
because the text resolves; the fairness sweep is one-sided toward
too-strong and this is as weak as a card gets.

**The record is `judge.js`'s, the number is `defendValue`'s.** Whether a
card is defending is a question about the combat structure each board
owns (`effects.js` is phase-free on purpose); what it is WORTH is card
semantics. Only the defender's card, only against a live attack, and the
entry clears in `strike` with the rest of the wall — a leftover defends
the next chain link for free, which is v2.46's bug in a third zone.

### THE CONDITION CAN BELONG TO THE ATTACK, NOT THE CARD (v3.24)

The four Blade Beckoner pieces print *"this gets +1{d} while defending a
weapon attack"*, all read `tier: full`, and all four blocked for their
printed number — both walls summed `gearDef(piece)` and nothing else. The
audit number did not move this version; **what changed is that it is
true.**

*"While defending a weapon attack"* cannot be answered from the piece, so
`defendValue` takes it from the CALLER — the same split `heroHit` and the
wall itself keep. **Absent, the buff does not apply**: a caller that
forgets to say what it defends gets the printed value. Weaker than
printed and visible; the other direction is a wall that quietly stops
more than the cards grant.

**The wear stays `gearDef`'s** — it owns Guardwell, Temper, battleworn and
destruction, and re-deriving any of it inside `defendValue` is a second
copy of the wear rules. **A destroyed piece gains nothing**, because
`gearDef` answers 0 and the buff would otherwise lift it back to 1.
Found by DRIVING it.

**AND THE GUARD I HAD JUST WRITTEN LET IT THROUGH.** Removing
`weaponAttack` from judge's gear wall failed NO drill, because v3.23's
guard matched the CALL (`E.defendValue(sd, piece`) and a dropped third
argument still matches perfectly. Every call site is checked for saying
what it defends now, with the DEFINITION excluded from the scan — it
matches the same text and has no arguments. **Sabotage the guard, not
just the code**, and re-sabotage after you widen it.

### A DEFENDER IS WORTH ITS PRINTED NUMBER PLUS WHAT MODIFIES IT (v3.23)

Both walls summed `c.def || 0`, so a card whose defence changes while it
defends blocked for the wrong value **on both boards**. Briar's
Embodiment of Earth — *"non-attack action cards you control get +1{d}
while defending"* — sat on the board doing nothing.

**`effects.defendValue(defSide, card)` is the one body.** The WALL stays
the caller's (the trainer holds defenders on the hand, judge on
`blockH`), because that split is deliberate; what a single card is WORTH
is card semantics and belongs in one place, or the two boards disagree
about a number.

**THE SUBJECT IS READ OFF `ty`.** An attack action card carries Action
AND Attack, so excluding Attack is what makes this *non-attack* action
cards; a Defense Reaction carries no Action at all and is correctly left
out. *"Reaction" contains the substring "action"* — a loose `tt` test
hands a defence reaction a buff its text never granted.

**23 MORE POOL CARDS PRINT A DEFENSIVE SELF-BUFF AND NONE OF THEM IS
APPLIED** — Blade Beckoner ×4, Wax On ×3, Sigil of Suffering ×3, Big Blue
Sky, Basalt Boots, Mournful Casket, the two Unity pieces, Rally, Staunch.
**Most read `tier: full`**: the clause is consumed, so coverage counts it,
and the buff simply never reaches a wall. Every one is WEAKER than
printed, so the one-sided fairness sweep cannot see them either.

They are deliberately **not built yet**. `defendValue` is where they go,
so each is a reader rather than new machinery — but Blade Beckoner is
EQUIPMENT, and equipment defence flows through `gearDef`, which the UI
and the advisor also read. Buffing at the wall alone makes the number on
screen disagree with the number that blocked, which is the sev-2 category
the player TRUSTS. **Half-building it is worse than the honest gap.**

### ONE TRIGGER, FOUR TOKENS, AND A NAME MATCH THAT HID THREE (v3.22)

Four pool tokens print *"when you play an attack action card[ or activate
a weapon attack], destroy this and X"*. **Runechant was built by NAME**
(`isRunechantEntry` plus a hardcoded pop) and the other three — Courage,
Quicken, Briar's Embodiment of Lightning — read `tier: none` and did
nothing. Building one would have left the same bug twice.

`fx.atkTrigger = {weaponToo, ops}` is the one reader; the pop is one site
and dispatches on the parsed payload.

**THE WEAPON HALF IS PART OF THE TRIGGER.** Three say *"or activate a
weapon attack"* and the Embodiment does not. Dropping it makes Briar's
token stronger than printed, so it is carried and checked — driven, the
Embodiment stays on the board through a weapon swing.

**THE POP MOVED BEFORE `pend`**, because two payloads MODIFY THE ATTACK
and after `pend` the total is already in the link and its label.
Runechant's arcane body was **moved, not rewritten** — per-source loop,
`hist.arc` credit, win check all intact.

**THE FIRING SET IS CAPTURED BEFORE THE CARD ACTS**, which is v2.23's rule
generalised. Load-bearing, not theoretical: Viserai's rite mints INSIDE
`execute` before the pop site, so the new token is on the board when the
pop runs and survives only because the set was captured by uid.

**A CACHED CARD FACT IS THE THING TO DELETE.** `bAct(n).runeDmg` is
parsed off the Runechant record by a second regex at build time — v3.07's
`arcShield`/`lifeLock` shape exactly. The pop asks each token's own
printed line instead. Its drill was rewritten to pin the property harder:
seat 1's tokens print THREE and seat 0 holds a decoy printing ONE.

**AND A TOKEN WITH NO TEXT NOW DOES NOTHING** — the golden rule working,
not a regression. Nothing can create one without the real database record
to copy, so this cannot happen outside a fixture.

### A ONE-SIDED LEDGER NEVER ASKS ABOUT WHAT IT OMITS (v3.21)

`tools/audit.js`'s `HERO_STATICS` decides whether a hero clause reports as
recognised; `build.js` decides whether the passive EXISTS. The drill that
compares them walks `HERO_STATICS` and asks the build about each entry —
so **a passive with no ledger entry is never asked about at all.** It is
absent from the census rather than failing it.

That is how Kayo's three clauses reported *"unrecognized by any ability
reader"* for eleven versions AFTER they were built, and Briar's two
repeated it exactly: the ability worked, every drill was green, and the
audit and the sweep both still called the hero unread. **Under-reporting
is the safe direction only while somebody is looking.**

The reverse check exists now — every build passive has a ledger entry —
and it is the same lesson as `journey.test.js`: **when you write a census,
write the other direction too.** A hero ability is finished when the
clause is BUILT *and* the ledger has been told.

**A named ability line is a HEADING, not a clause.** Briar's *"Essence of
Earth and Lightning"* and Iyslander's *"Essence of Ice"* both report
unread and neither is work — the audit splits on newlines and a bold
ability name looks like a sentence. Recorded so nobody chases it.

### BRIAR'S TOKENS ARE HER ENGINE, AND NEITHER SITE NAMES ONE (v3.21)

Both clauses of her hero ability mint a token, so the Embodiments are the
deck rather than decoration — the "find the hero's ONE mechanic first"
exercise answered by her printed text before any code.

**The token's NAME is read off her line and carried on the build**, which
is why `PASSIVE_TYPE` grew a `string`. Storing a boolean would move
"Embodiment of Earth" into `effects.js`, and that is inventing card text
one level up — the same reason `atkPowOffChain` is a number. The mint
sites name no token at all.

**AND IT IS CAPTURED WITH ITS PRINTED CAPITALISATION.** Every other
recogniser reads the lowercased hero text, and `resolveEntry` returns the
ENTRY's name rather than the database record's — so a lowercased capture
rides onto the board and deals the player a card called *"embodiment of
lightning"*. The suite was green; **driving it is what showed it.**

Earth's three gates are each a way to be wrong: an attack **action card**
(a weapon swing is not one), that **deals damage** (CR 7.5.5 — prevented
damage is not a hit), to an opposing **HERO**. That last one is the
CALLER's answer, like the wall: judge routes by CR 1.4.5 attack-target
and the trainer wires no ally targeting, so a body that guessed inside
`linkPayload` would be right on one board and wrong on the other. The
latch sits in the shared body, so both boards have it.

Lightning fires on **exactly the second** non-attack. A `>= 2` test mints
on every one after the first, which is stronger than printed.

### THE FIXTURE AND THE PHONE MUST AGREE ON WHAT A CARD IS (v3.21)

`data/pool.json` is what every tool and every drill reads; the browser
reads the live database. They therefore need the SAME rule for what to
keep, and for tokens they had two:

| | kept a token when |
|---|---|
| `index.html` (the phone) | the record's **TYPE** says Token |
| `tools/pin-pool.js` (the fixture) | a **NAME** it scraped out of card text matched |

The scrape required every word of the name to be capitalised, so Briar's
*"create an Embodiment of Earth token"* captured **`Earth`** — a name no
card has. It added it, matched nothing, and said nothing. **A scan aimed
at the wrong SHAPE passes by finding nothing**, the same family as the
`makeEffects` guard that excluded the only call form anyone writes.

So the phone could mint both of Briar's Embodiments while every Node tool
and all 1204 drills were blind to them — **the fixture and production
reasoning about different pools, each internally consistent.** That is
`mapDbCard`'s drift hazard one layer down, and it is why the fix is not
to widen the regex but to **keep a token by its TYPE, the way the loader
does**: one rule for what a token is, and no way for a name's spelling to
decide whether a card exists. It costs 24 records on 764.

The guard is in `test/loader.test.js` and it is the offline half:
**every token name the pool's own text can create must RESOLVE in the
pool.** It asserts the scan count too, because a scan that stops matching
returns an empty set and an empty set satisfies "all of them resolve"
perfectly. Its live-wire sibling compares against `liveDbPath()`, never
`cardDbPath()` — that returns the POOL when one exists, so the first draft
compared the pool with itself and passed by construction.

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

#### THE MENTION COUNT IS GRADED AGAINST THE LEDGER, NOT A GREP (v3.00)

`failstates.js` decides how bad a no-op keyword is partly by counting the
keyword's mentions in the source — and it counted them **in `index.html`
alone**, which is a file the card semantics left in **v2.53**. Measured with
the tool's own regex: phantasm **2** mentions there and **11** across the
engine, watery grave 2 and 13, suspense 2 and 11. All three sat under the
≥3 threshold, so **all 16 UNFAIR entries were one scan aimed at the wrong
file**. A source scan aimed at the wrong file *passes* by finding nothing;
this one *failed* by finding nothing, which is the same defect with the
opposite sign.

Repointing it alone would have been worse than leaving it — the count would
then have cleared the whole block, including two keywords nobody built. So:

- **the LEDGER outranks the grep.** `tools/ledger.js` records what this
  project claims to have BUILT. A keyword marked `pending` is never
  "likely handled", however often the source says its name — suspense has
  11 mentions and every one of them is in the parser.
- **a DRAWBACK is held to a higher bar than an upside.** `partial` counts as
  built for meaning and never for a drawback: half a keyword is fine for a
  bonus and is exactly the wrong shape for a penalty. Watery grave was
  recorded `live` when only its upside is — Gravy Bones replays allies out
  of the graveyard and **nothing turns a dead ally face-down**, which is the
  entire reason its ruling exists.

UNFAIR went 16 → 11 when the tool stopped reading the wrong file, and
11 → 0 when the two keywords that actually remained were built (see Phase
B in `FINISH.md`). The four phantasm cards left first, because they were
fixed rather than reclassified.

> **THIS PARAGRAPH SAID "UNFAIR IS 0 AS OF v3.01" FOR NINETEEN VERSIONS
> AND IT WAS NOT (v3.77).** Measured across every commit that touched
> `SWEEP.md`: it read **17** until v3.21 and has read **1** every version
> since. The keyword work really did land; what the sentence missed is
> that the tool's inputs kept moving under it — `analyzeHero` learned to
> read hero riders, and a hero clause is graded like any other text.
>
> The standing entry was **Lyath Goldmane's halving static** — *"the base
> {p} and {d} of cards you control are halved, rounded up"* — a real
> unbuilt DRAWBACK, so he played strictly better than printed. **BUILT AT
> v3.78, and UNFAIR is now genuinely 0**: the block is gone from the
> report for the first time in the project's history.
>
> **A doc claim is a test with no assertion** (v3.41), third time. Sweep
> the sentences that state a count the way you sweep the pool: take each
> one, and go and re-derive it. *(This one is re-derived at v3.78 — and
> the honest way to keep it true is to re-run `npm run sweep` rather than
> to trust this sentence.)*

#### A NOOP CAN CLAIM A WHOLE FAMILY (v3.16)

The blind spot below is about ONE keyword filed wrongly. The worse shape
is a noop **anchored to a prefix**, whose text asserts a payload:

> `/^crush\s*[-—]\s*when this deals \d+ or more damage to a hero/`
> → *"the keyword system forces a card from their hand onto their deck"*

That is Boulder Drop's rider, and it is true of **no other card**. Eleven
more pool cards print a different payload behind the same prefix — a
-1{d} counter, an arsenal destroyed, a discard, a next-turn tax — and the
trigger site pushed a card from hand to deck for all of them. **Not
unbuilt: SUBSTITUTED**, and all twelve read `tier: full`.

**A noop must describe the clause in front of it, never a sibling.** If
the reason names a payload, anchor the pattern to that payload. The
threshold is the card's printed number too — `crush.n`, not a literal 4.

Seven riders are read on their own terms now; the five reaching into the
opponent's NEXT TURN refuse, because no such schedule exists. Coverage
went **315 → 308 full**, which is the number improving.

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
face-down *specifically so it cannot be replayed infinitely*.

**ALL THREE ARE BUILT AS OF v3.01, and none was a mis-filing.** Phantasm
worked in the trainer and did nothing at the table — the keyword was
carried, on one board, which no coverage tool and no keyword ledger can
express. Watery grave's upside was live and its drawback was not, so six
allies were an infinite loop. Suspense fired its payload on PLAY, so a
printed delay was being paid as a bonus. **A `noop` keyword is still the
place to look first**: the blind spot is real, and it is the only one of
these three shapes a keyword ledger can catch on its own.

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

6b2. **SCENES** (`npm run scenes`) after any card or rules change — it is
   in `npm test` as drills and in CI, but run the REPORT when you want the
   per-hero answer. It is the only tool here that asks whether a reading
   was OBEYED rather than made; see "DOES THE CARD *DO* WHAT IT PRINTS?".
6c. **PLAY IT** (`npm run play`) after any rules change — 210 self-play
   games in about four minutes. Read refusals / violations / **stalls**;
   see "PLAY THE GAME" below. It found a bug 1488 drills had not.
Always, regardless of what the tests say:
7. **On a real phone.** Type checking and drills verify the parser is
   correct, not that the feature is fun or legible — validate on-device
   per the roadmap's loop (play → record → extract frames → fix) before
   calling anything shipped.

### Drill gotcha
`fxParse` memoizes on `name|pitch`. Test cards **must have unique `name` fields**
or results silently collide in the cache and produce misleading passes.

### THE DRILLS RUN ON THE REAL CONTEXT (v2.80) — `test/helpers/judged.js`

**A drill file must not build its own effects context.** `effects.js` is
the one copy of the card semantics and `judge.effectsFor` is the one
context a player's cards run in; a hand-rolled `ctx()` literal is the
no-mirror rule broken in the drills instead of in the engine, and it had
already drifted in every direction at once:

| stub | what it meant |
|---|---|
| `dummyDefence`, `built` | dead keys — out of `CTX_KEYS` since v2.73 / v2.77 |
| `mkRune: s => s` | a runechant was never minted |
| `openPrompt: s => s` | a prompt never opened |
| `winCheck: s => s` | nobody ever won |
| `had6ThisTurn: () => false` | a CONSTANT for the condition half of Kayo's deck turns on |
| `bAct` and `bFoe` returning ONE build | no drill could tell the two seats apart |

Use `test/helpers/judged.js`: `state(a, b, o)` builds a judge-shaped game
over `makeSide`'s shape, `runOps`/`execute`/`fx` go through
`judge.withEffects`, and `db()` registers the database with
`judge.setDb`. **The build goes on `g.builds`**, where `bAct` reads it —
a build handed to a context is seat-agnostic by construction and cannot
express "his hero ability, not theirs".

Three files may still hand-roll, because in each the context IS the
subject: `effects.test.js` (must pass an INCOMPLETE one to prove
`makeEffects` refuses it), `merge.test.js` (the clone property),
`mirror.test.js` (Battle's context, not judge's). `test/sync.test.js`
pins that list and fails any other file.

**AN EXPLICIT `undefined` IS DROPPED, not assigned.** `Object.assign`
copies a key whose value is undefined, so one optional field threaded
through a caller (`{hist: o.hist}` where the caller passed nothing)
deletes `freshHist()` and the first `hist.atkNames` read throws from
inside a reducer whose contract is that it never throws.

**Three things this found, none of which a card-level tool can see:**

1. **`effCost` is READ TWICE and the reads are different questions.**
   `execute` charges the cost; `doPlay` asks whether the seat can AFFORD
   it, and only that second read decides whether a payment opens.
   Replacing `doPlay`'s `effCost` with the printed cost left every drill
   in the project green.
2. **Judge's wall had NO drill.** `resolveStack` is the TRAINER's path —
   judge does not call it, because the body was split so each caller
   keeps its own wall and its own CR 1.4.5 routing between `linkPumps`
   and `linkPayload`. All 14 dorinthea drills measured the half of the
   engine the table does not use.
3. **A FABRICATED `pend` IS THE ANSWER, NOT THE QUESTION.** `total` was
   supplied by the fixture, so "an attack blocked to nothing does not
   refresh" was asserted by writing 0 into the link rather than by
   anyone blocking, and "it hit, so go again was granted" was asserted
   about a hit the drill had arranged.

**And the guard's own defect, found by sabotaging it.** It was written
`[^.\w]makeEffects\(` — the idiom borrowed from the bare-name guard
beside it, where excluding a property access is right — which **excluded
every call it existed to catch**, since the only form anyone writes is
`E.makeEffects(…)`. A source guard aimed at the wrong SHAPE passes by
finding nothing, exactly as one aimed at the wrong file does. Same
family as `html-balance.test.js`'s pre-neutralize list and the actor
ledger's prose false-positives: **sabotage the guard, not just the
code.**

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

## THE PHASE 1 REBUILD — `engine/judge.js` (v2.42, in progress)

**The plan is three phases: engine → multiplayer → card rulings.** Phase 2
made real progress and was deliberately stopped, because every remaining
multiplayer step is blocked on the same thing: `Battle` is 2,505 lines of
React closures rather than a pure reducer, and it grew 60% while the
roadmap was being written.

### What landed

| module | what | status |
|---|---|---|
| `engine/build.js` | how a seat becomes a hero: `buildSide`, `defaultPicks`, the equipment slot rules, and `buildMatch` (both seats from one spec, v2.49) | **live** — loaded, bridged, in `MODULES` |
| `engine/judge.js` | `reduce(state, action, seat)` — the rules as a pure function, and since v2.77 a CALLER of effects.js | **live, and it resolves card text** |
| `engine/types.js` | what a card IS, off its structured type array | **live**, loaded but deliberately not bridged |
| `engine/lobby.js` | the pre-game negotiation: hero, throw, sideboard (v2.49) | **live** — module-qualified, in `MODULES` |
| `engine/effects.js` | ALL the card semantics, out of `Battle` (v2.53, v2.62). One copy exists. | **live in BOTH** — the trainer and judge.js both call it (v2.77) |
| `engine/sparring.js` | `act(game, seat)` — a seat as a policy | **live** — `local.js` calls it (v2.79) |
| `engine/local.js` | a session with no network: the merged engine, played alone (v2.79) | **live** |

### ONE COMBAT PATH, NOT TWO — the thing this replaces

The trainer resolves the same CR procedure through two unrelated bodies
of code, and this is the single biggest reason a second human cannot sit
down:

```
you attack   tryPlay -> execute -> dummyDefence -> mode:"stack" -> resolveStack
they attack  foeSwing -> mode:"block" -> toggleBlock -> finishBlock -> takeIt
```

One **fabricates** the attack as `[3,4,5][(turn-1)%3]`; the other
**auto-picks** the blocks. A rule fixed in one silently stays broken in
the other — which is exactly how clash came to fire on the wrong trigger
for five versions. In `judge.js` there is one path and the swinging seat
is an argument:

```
declare -> ATTACK -> DEFEND -> REACTION -> DAMAGE -> RESOLUTION -> CLOSE
```

### `engine/types.js` — what a card IS, off its printed type line

The pool prints **138 distinct type lines** over 401 unique cards, and
they are regular: `[classes and talents] <TYPE>… [ - <SUBTYPE>… ]`. Where
a card may be played from, in which window, what it costs and where it
goes afterwards all fall out of the TYPE. **That is the half of Flesh and
Blood that needs no text box**, which is why it lands in Phase 1 and the
effects port does not.

`cardType(c)` returns `{classes, classGroups, types, subtypes, slot,
shape, hands}` and every question is asked of that — one parse, one
answer. The trainer asks type questions from five or six places with
ad-hoc regexes; `rxAllowed` exists precisely because five copies of "may
this be played here" had drifted apart, and the drift showed up as a card
that looked playable and did nothing when tapped.

#### THE STRUCTURED ARRAY IS THE AUTHORITY — `ty`, not `tt`

The database carries the card's types **twice**, and the two disagree on
**5 of its 4,862 records**:

| | |
|---|---|
| `types` (→ `card.ty`) | `["Assassin","Warrior","Defense Reaction","Trap"]` |
| `type_text` (→ `card.tt`) | `"Assassin / Warrior Action Defense Reaction - Trap"` |

**A reaction cannot be an action.** The structured array is right and the
printed line carries a stray word. Reading `tt` made Den of the Spider
and Lair of the Spider — both in the pool — playable in the **action
phase for an action point**: sev-3 "illegal play allowed", and invisible
to every card-level tool, because the card's TEXT parsed perfectly.

**RULING (user, 2026-08-02): where the two fields conflict, the
structured array wins — always.** All five conflicts in the database are
`type_text` errors. The third one, Comet Collision (`type_text` says
`Instant`, array says `Action`), was confirmed the same way: it is a
**Lightning Wizard Action**, an ordinary non-attack action whose Starfall
ability merely checks whether an instant reached the graveyard this turn.
Not in the Silver Age pool, so nothing depended on it — but the policy
does, and it is now settled rather than guessed.

**Class words say who may DECK a card, and how other cards refer to it.
They are not types.** `Assassin / Warrior` is deck legality, not a
statement that the card is two things.

`mapDbCard` and `resolveEntry` now carry `ty`, and **the loader in
`index.html` mirrors both — change all three, and bump `DATA_VER`**
(done: `sage-v11`; a warm `sage-v10` cache has no `ty` on any card).

**The one place the display string knows more: a DOUBLE-FACED card.**
`Arcane Seeds // Life` flattens to `["Runeblade","Action","Earth",
"Instant"]` — only `tt` keeps the `//` boundary. You play the FRONT
face, so a DFC falls back to parsing the front of the string. Reading
the flat array calls two real action cards instants and hands each a
free action point, which is v2.39's bug returning by another door.

**Three more things the pool prints that a naive reader gets wrong:**

1. **`Block` is a type and it has no play.** Test of Might, Test of
   Strength, On the Horizon, Crash and Bash — no printed cost, 4 defence,
   all reading "When this defends, …". They may be pitched or declared as
   defenders, nothing else. Treated as ordinary non-attacks they are free
   0-cost plays that do nothing.
2. **`Reaction` contains the substring `action`.** Any type scan that is
   not word-boundary-anchored and longest-first reads `Warrior Attack
   Reaction` as an Action. Only the fallback string path can hit this —
   one more reason the array is the authority.
3. **An ALLY prints power AND life**, because an ally swings and can be
   swung at. Six in the pool. A "power belongs to attacks and weapons"
   check reports all six as broken.

**And one that looks like a rule and is not: a null cost does NOT mean
unplayable.** Equipment, Weapons and Blocks print no cost, so "no cost
means no play" is tempting and wrong — `Ice Eternal` and `Night's
Embrace` carry `cost: null` because their cost is X or absent from the
record, and refusing them kills two real cards. **Playability is decided
by TYPE, always.**

**Permanents go to the ARENA.** An Aura, an Item or an Ally that resolves
to the graveyard is a card the player paid for and never receives. 12
auras, 5 items and 6 allies are in the pool; `destination()` routes them
and `permanentKind()` names them so `game.js`'s ally helpers agree.

**The census is a partition, and a drill proves it**: the seven card-type
counts sum to **exactly** the 401 unique cards, with no card typed twice
— which is how the "Action Defense Reaction" misread would be caught
again. `attack` (175) is a *subset* of `action` (267) rather than a peer,
so it is deliberately outside the sum.

#### `types.isWeaponType` vs `parser.isWeapon` — pinned, not fixed

`parser.isWeapon` is `/weapon/i.test(tt) && power != null`, so four
weapons that print no power do not answer to it: Death Dealer (Bow),
Plasma Barrel Shot (Gun), Cosmo (Scroll), Crucible of Aetherweave
(Staff). That looks exactly like the bow bug and **it is not the same
thing** — in `build.js` the predicate decides whether a piece is routed
as a swinging weapon or as an activated ability, and the powerless four
need the ability route. Crucible's "Once per Turn Instant - {r}: …" is
reached *only because* `isWeapon` says false; making it type-accurate
would take that ability away to fix nothing.

So two names mean two things, and both are right for their job:

```
types.isWeaponType(c)   is this card's TYPE Weapon
parser.isWeapon(c)      is this a weapon with a printed power
```

`test/types.test.js` pins the split at exactly those four cards. A fifth
means something changed that nobody decided.

> **AND `judge.js` ASKED THE WRONG ONE OF THE TWO, AT BOTH ACTIVATION
> SITES, UNTIL v3.83.** All four came out wrong, in opposite directions:
> Cosmo and Plasma Barrel Shot fell into the SWING branch, where
> `weaponCost` matched the **quoted granted ability inside their own rules
> text** (254 illegal 0-power swings measured in five Enigma games); Death
> Dealer and the Crucible fell there too and were refused *"prints no
> weapon attack"*, so **Azalea's arsenal put and Iyslander's amp were
> unreachable at the table** while working in the trainer.
>
> The trainer gates its swing on `isWeapon` and its ability on `gr.pow`,
> and `build.js` builds the powCard off the same predicate — three readers
> agreeing and judge asking the type. **When a file names two predicates
> to keep two questions apart, grep for every caller of each.** Measured
> after: Iyslander 12 wins → 22, Blaze 17 → 22. Renaming parser's belongs
with the Phase 3 pass over equipment abilities.

**`types.js` is LOADED but NOT bridged** (v2.49), and the second half is
deliberate: its natural names sit beside parser.js's and game.js's, and
two pairs mean different things (`game.isAlly` takes a board *entry*, not
a card). Bridging both sets into one bare namespace is the
same-name-different-meaning trap `KNOWN_COLLISIONS` polices. So it is
reached as `DawnTypes.*` and `judge.js` takes it as a factory argument —
the same treatment `DawnSides` and `DawnPriority` already get.

### Two limits on a weapon swing, and they are different rules

Of the pool's eleven swinging weapons, nine print `Once per Turn`. **Two
do not, and they are not the same case:**

| | printed | why it is limited |
|---|---|---|
| Sledge of Anvilheim | `Action - {r}{r}{r}{r}: Attack` | **it isn't.** Pay four again, swing again. |
| Scorpio, Comet Tail | `Action - {t}: Attack. …` | the **tap** — a tapped permanent does not untap until CR 4.4.3d. |

A blanket "already swung" flag makes the Sledge **weaker** than printed.
Reading only `oncePerTurn` makes Scorpio **stronger** than printed.
`weaponCost` returns both `oncePerTurn` and `taps`; honour both.

Neither sweep can see either: fairness is deliberately one-sided towards
too-strong, and coverage reads both as `full` because the text was read
correctly and then **charged** wrongly — the same shape as v2.39's
instant.

### It restates no priority rule

Every question about who may act comes from `engine/priority.js` —
`canAct`, `speedAllowed`, `canDeclareDefenders`, `passOutcome`,
`advance`, `endTurn`. **There is no `mode` and no `bphase`**, and a drill
fails if either appears in the file. That module is CR-grounded and
counter-intuitive where the CR is: in the defend step the TURN-PLAYER
holds priority (CR 7.3.3) while the DEFENDER declares (CR 7.3.2), which
is why "can I act" and "can I declare defenders" are separate questions.

### Phase and interaction are different things

The trainer's eight `mode` strings conflate them. Here:

- `phase`/`step`/`priority` — the CR machine, owned by `priority.js`
- `pending` — a half-finished **interaction** belonging to ONE seat (a
  payment being assembled). While it is set that seat may only finish or
  abandon it, and the other seat may do nothing. The CR has no "pay
  step", so it is not modelled as a phase.

### Two corrections to `actions.js`'s reference shape

1. **Damage lands on ENTERING the damage step, not on leaving it**
   (CR 7.5). `actions.js` strikes on the way out, which is fine for a
   blank game with nothing hanging off a hit and wrong for a real one:
   the step exists so there is a window in which the hit has *already
   happened*.
2. **THE COMBAT CHAIN IS A ZONE.** A declared attack has left its hand
   and not reached a graveyard. Held in a private `_` field it is in no
   zone at all — and `invariants.js` catches a card in *two* zones while
   a card in *none* falls silently out of the census. `g.chainCards` is
   now censused by `invariants.js`, and a drill duplicates a chain card
   into a graveyard to prove the judge names it. **When you add a zone,
   check the census still sees it.**

### It was HEADLESS on purpose. It is now LOADED — for the table only (v2.49)

`judge.js` models the turn structure, the combat chain and the costs. It
still does **not** model card EFFECTS: `runOps`/`execute`/`resolveStack`
are in the trainer. The original rule was that loading it would put a
second, quieter rules engine on the page beside the real one.

**THAT SPLIT IS CLOSED (v2.77-v2.79).** It was right while it lasted and
the reason it ended is that the customer for "one rules engine" changed:
it used to be the networked table, and it is now every hero of card text
that would otherwise have to be written into whichever engine you point
them at.

```
judge.reduce   the CR turn structure
effects.*      the card semantics          ONE engine, BOTH callers
sparring.act   seat 1 when it is not a person
local.js       the session, when there is no network
```

There are still TWO BOARDS, and that is deliberate:

```
SOLO  play  ->  Battle     (the tuned dummy, and the regression harness)
TABLE play  ->  judge.js   (a person, or sparring.act via local.js)
```

Both now resolve every card effect, through the same `effects.js`. What
`Battle` still owns is the `[3,4,5]` escalation, which is TUNED, and the
drills that prove the semantics are right.

**`Battle` does not retire until the merged path passes the same drills.**
It plays every card effect today and is the only proof the semantics are
right.

Nothing routes between them. The trainer is untouched by v2.49 and keeps
the `[3,4,5]` dummy; the table gets the one thing `Battle` cannot give,
which is a pure reducer two seats can both drive. It is the same
discipline that kept `actions.js` free of card text: **a control-flow bug
must never be confusable with a card being read wrong** — so keep the
split until the effects port makes one copy of the semantics that both
callers share.

`test/wire.test.js`'s `HEADLESS` list is the ledger. It was EMPTY from
v2.79 and is **`["actions"]`** again as of v3.15 — the blank reference
reducer went back off the page once `judge.reduce` had replaced it at both
session sites, because 20K of unreachable rules code on every page load is
the second-quiet-engine hazard this list exists to name. **The module and
its 21 drills stay**; only the script tag went.

Crossing this line in EITHER direction is one edit: onto `HEADLESS` and
out of `test/sync.test.js`'s `MODULES`, or the reverse. `judge`, `types`,
`lobby`, `sparring` and `local` all came off it that way; `actions` is the
first to go back.

### TWO CALLERS, ONE CARD — the shape v3.00 found twice (v3.00)

`effects.js` holds the semantics once and **two turn structures call it**,
and they file a spent attack at two different moments. Both are right for
their own board: the trainer files it to the graveyard **at declaration**,
`judge.js` holds it on the combat chain until the **close step**. Any card
text that touches the attack card itself therefore has to ask *which* zone
holds it, and v3.00 found the mistake in both directions.

**AS A WRITER — `bottomSelf`.** Under Loop ("when this hits, put it on the
bottom of its owner's deck") lifted the card out of the GRAVEYARD only. On
judge's path it found nothing there, pushed a second reference onto the
deck, and left the chain holding the first: `CARD-IN-TWO-ZONES`, and the
duplicate propagated into a graveyard. `soulSelf` had already learned this
and `bottomSelf` had not — the rule existed once and was missed once. It is
**`liftSelf`** now, matched by uid rather than reference, because a card
that has been through a spread is a different object with the same identity
and the census works by uid.

**AS A READER — `afterDefenders`.** Phantasm reads the cards declared
against the attack, and it looked the wall up *itself*, as `{k:"def"}`
entries on `stack` — the TRAINER's representation. judge.js holds
declarations on the defending side's `blockH`, so the lookup found an empty
wall and returned quietly. **Phantasm worked in the trainer and did nothing
at the table for three versions**, while the feed printed the drawback as
though it had applied. The wall is the **caller's** answer now, the same
split `linkPumps`/`linkPayload` already keep.

**So the rule for any new card text that touches the attack card:** ask what
holds it on each board, or hand the answer in from the caller. Never read
one board's representation from inside the shared semantics.

### THE EVENT IS ONE BODY, OR IT IS NOT AN EVENT (v3.17)

v3.01 said a schedule is written per board and told you to ask which one
runs it. That is necessary and it is not sufficient, because **asking is
a thing a person does once**. `beginEndPhase` existed in the trainer and
held Inertia and the arena sweep; three MORE beginning-of-end-phase
events sat OUTSIDE it, inline in `endTurn`, written against `you(n)`.
Seat 0, one board, and the table had none of them:

| event | card | the table |
|---|---|---|
| rust destruction | Talishar, the Lost Prince | swung on past the death it prints, forever |
| the idle counter wipe | Dawnblade | kept the +{p} counters it prints to lose |
| intimidate's return | any intimidate | **a permanent theft** — v2.10's bug, back |

All three fail STRONGER than printed. **`effects.beginEndPhase(game, seat)`
is the whole event now** — pure, seat-relative, six steps in a fixed
order, returning `{game, msgs, ops, fired}`. Both boards call it and
restate nothing, and a drill fails either board for reaching past it to
one step. A comment saying "the order here matches the trainer's" is not
a mechanism; a shared body is.

**THE THRESHOLD IS THE CARD'S NUMBER.** The rust clause was a `noop`
reading *"the end phase already destroys it at 3 counters"* — a reason
naming a payload in one board's inline filter, which is v3.16's shape one
level up. It is `fx.rustDestroy` off the printed line now, read by
`parser.rustedThrough` beside `idleCounterWipes`.

**TWO READERS OF ONE RULE, AND THE ORDER DECIDES WHICH SPEAKS.** Frostbite
prints "at the beginning of your end phase, destroy this", so the token is
minted with `sd:"end"` and `sweepArena` takes it — while `thawFrost` also
takes it. judge thawed first and got the specific line; the trainer swept
first and told the player a token *"is destroyed"* without saying what it
cost. State right, lesson silent. The specific reader goes first.

### `tools/crindex.js` — WHICH CR RULES DOES A DRILL ACTUALLY GUARD? (v3.17)

```
npm run crindex          # ranked report + CR-INDEX.md
node tools/crindex.js --check    # non-zero if a rule regressed to UNGUARDED
```

A rules revision does not arrive as a diff against this source; it arrives
as a renumbered, reworded CR. The cost of absorbing one is exactly *how
many places did we encode a rule where nothing would turn red*. So the
tool indexes every citation across `engine/`, `index.html`, the drills and
the docs, and scores each rule **guarded** / **UNGUARDED** / drill-only /
prose. 63 distinct rules, 866 citations, **50 guarded, 3 UNGUARDED** (all
section pointers). The gloss is HARVESTED from verbatim CR quotes already
in the source — nothing in it is restated from memory.

**AN `UNGUARDED` VERDICT IS A LEAD, NOT A FINDING**, and the first run
proved both directions. `CR 8.1.3` was cited where the rule is `8.1.3a`,
whose behaviour is driven over all fifteen of the pool's defence reactions
— guarded, loosely cited. `CR 4.1.8a` was the opposite, and reading its
two sites is what found v3.17. **Read the site, then ask whether a drill
drives the BEHAVIOUR under this rule's number or a neighbouring one.**

**A RANGE IS A RUN.** `CR 4.3.1-4.3.3` cites three rules; an alternation of
only `,` `/` `&` reads one and drops the far end of every range in the
source silently — a scan undercounting exactly the rules that travel in
company.

### A SCHEDULE IS WRITTEN PER BOARD — ask which one runs it (v3.01)

`effects.js` holds the semantics once. **The schedule a card fires on does
not.** Three of the last five bugs were the same sentence: a rule that
existed on one board only.

| rule | lived in | the table had |
|---|---|---|
| phantasm's pop | `effects.afterDefenders`, called from `index.html` alone | nothing |
| "may I play this from the graveyard" | `playables()` — the trainer's **UI** | nothing, so EVERY graveyard card was playable |
| the arena-departure payload | nowhere — it fired on play instead | nothing |

`effects.tickSuspense` is the shape to copy: **pure**, exported beside
`thawFrost` and `resolveInertia`, and it **returns the payload ops rather
than running them**, because "your next attack this turn gets +N{p}" is
actor-relative and the two boards reach `runOps` differently. The trainer
calls it at the top of its turn; `judge.js` calls it in the START PHASE.

**A ROUTE AND A GATE ARE PER BOARD TOO (v3.04).** The rule is not only
about schedules. `judge.legal` refused every non-weapon piece as "not a
weapon", so **17 equipment abilities across 12 heroes** were dead at the
table; and `activateIfOk` — the reader for every printed "Activate this
only …" — lived inside `Battle`, so no activation restriction was enforced
there at all. Both are now shared, and sharing the gate meant making it
board-agnostic first: two of its six cases asked `s.mode`, which judge
seeds and NEVER WRITES, so a straight port would have answered FALSE in
every step of every table game.

**AND AN UNREAD RESTRICTION MUST REFUSE.** Four of the pool's ten printed
activation conditions were not read — two because the pattern demanded a
word the card does not print (`activate this ABILITY only`, and the
contraction `you've`), two because no pattern existed and the gate was
left `undefined`, which let the ability run unrestricted. An unreadable
condition is filed `{kind:"unreadable"}` and refuses; v2.04 settled the
same question for costs, and inert is honest where free is above rate.

**ALL THREE ARE SHARED AS OF v3.07** — `thawFrost`, `resolveInertia` and
the aura sweep (now `effects.sweepArena`). The last one was not a function
at all, and finishing it turned up two more of the same shape and one
worse:

- **`sd:"end"` ran on NEITHER board.** Concealed Object is an Item whose
  tap pumps an attack and which prints "at the beginning of your end
  phase, destroy this"; never destroyed, step (d) untaps it and it pays
  again every turn forever. That is ABOVE rate, and coverage reads it
  `full` — the clause is read faithfully and the op *is* consumed by
  `runOps`. `failstates.js` has a "no schedule to fire on" category and
  fills it by looking for UNREAD text, so a schedule that parses and then
  evaporates is the one case it cannot reach.
- **A TOKEN CARRIED NO CLOCK.** `execute` stamps `sd` onto a permanent
  played from hand; the token mint skips that path, so 15 of the pool's
  tokens print a destroy schedule and none of them carried it. For a
  token typed `Aura` that also inflates every "auras you control" count.
- **"…destroy this, THEN X" SWALLOWED THE SCHEDULE.** Might parsed to
  `[["buffNext",1]]` — the payload with no destroy — because a generic
  temporal-prefix match ate the first half. Same shape as Stir the
  Aetherwinds at v3.00. The trainer had grown a SECOND sweep that
  re-reads the raw printed line to find these, which is why solo play
  worked and the table had no start-of-turn trigger at all.

**The payload rides AFTER the destroy, in printed order.** That is what
lets one sweep pay a departing card without re-running its on-play
statics: Pyroglyphic Protection reads `[arcShield 3, selfDestruct turn]`
and pays nothing on the way out; Might reads `[selfDestruct turn,
buffNext 1]` and pays. No card is named and no kind is stored.

**AND A TEARDOWN PREDICATE MUST ASK THE CARD, NOT A SECOND REGEX.** Both
of the trainer's were always FALSE. `arcShield` matched *"prevent N
arcane damage that source"*, a wording upstream stopped printing —
v3.00's drift, in a predicate instead of in a card. `lifeLock` scanned
the BOARD for Reaping Blade, which is a Sword and lives in `gear`, so any
aura crumbling on Viserai's turn silently unlocked life-gain while his
sword was still equipped. Both flags are a CACHE of a board fact, so
`sweepArena` re-derives them through `fxParse` over the board AND the
gear — one reader of a printed line, asked.

### "CHOOSE 1;" IS A CHOICE, NOT A SUM (v3.12)

Two pool cards print a modal choice and both modes were ADDED: Pummel
granted +8 where it prints +4, Two Sides to the Blade +6 where it prints
+3. Driven, Sledge of Anvilheim went 6 → **14** instead of 10.

**The fairness sweep could not see it, and that was a tool bug.**
`VALUE-DOUBLED` looks for one printed value applied by two PATHS; a modal
sum prints the value TWICE and consumes both, so there is one path and
nothing to compare. `MODAL-SUMMED` is check 3b and is verified by
sabotage. `RESTRICTION-DROPPED` also had to learn that a modal card parks
its qualifier on `fx.modes[].q` — without that it reported both cards as
unrestricted, which is **the tool's model going stale, not the card going
wrong**, and the two look identical in a report.

**The board picks the mode.** The printed targets are disjoint — a WEAPON
attack and an ATTACK ACTION CARD cannot be the same object — so no prompt
is needed. **Only a mode whose restriction was READ is selectable**:
`attackQual` cannot read "target attack action card with stealth", and
treating that as "matches anything" would let Pummel pump a card it cannot
legally target. Refusing is weaker than printed and honest; v2.04 settled
the same question for costs.

**A targeted grant's rider belongs to the ATTACK.** A reaction never hits
anything itself, so `attackRx` stamps it onto the open link. `quotedOnHit`
is a function DECLARATION for this — the targeted pump rule sits above it
in the file and a `const` arrow is in the temporal dead zone there.

### AN ATTACK REACTION RESOLVES ONTO THE OPEN LINK (v3.11)

`linkPumps` has read `{k:"rx"}` layers off the stack since v2.77 and **only
the trainer ever pushed one.** At the table a reaction was played legally,
paid, and its pump fell through to `buffNext` — landing on the player's
NEXT attack while the current one resolved for its base, with the feed
saying so. 14 pool cards, four heroes, eight of them Dorinthea's.

**The printed target restriction is a LEGALITY, not a modifier.**
`buffNext` asks no qualifier, so Puncture pumped whatever was swinging —
v2.30's shape on the board nobody had checked. It lives in `judge.legal`
now, because refusing after the card has left the hand costs the player a
card for a play the rules never allowed.

`effects.attackRx` is the third shared piece beside `linkPumps` and
`linkPayload`, and **the hand-blocker count is the caller's answer** — the
trainer files defenders as `{k:"def"}` layers, judge on `blockH`, and a
body that reads either is a body the other cannot call. A drill fails if
it ever goes looking.

### A GRANTED ABILITY RIDES ALONGSIDE — READ IT (v3.10)

FaB prints a granted ability in **quotes**, which is what makes it readable
rather than guessable: the quoted text is a clause in its own right and goes
back through `classifyClause`. `quotedOnHit` is the one reader; every shape
that grants an ability shares it.

**A MISSING ALTERNATION DOES NOT DROP A RULE, IT RELOCATES IT.** The anchor
spelled `gains?` and the cards print `gets`, so the quoted text fell past it
into the loose payload matchers, which found the payload inside and returned
it **with no `onHit`**. Bolt of Courage drew a card on PLAY; Hot on Their
Heels marked on play **and lost its go again** — weaker than printed in the
head, stronger in the rider, in one clause. Every affected card read `full`.
CLAUDE.md has said since v2.12 that FaB prints gains/gets/has and every
anchor must accept all three; that is not a style note, it is this bug.

**A GATED RIDER IS `condOnHit`, NEVER `onHit`.** `riderOnHit` is routed by
`fxParse` because that is the only place that can see whether the clause
also carried a condition. Filing a gated rider as a plain on-hit grants it
on every hit regardless of the gate — KEYWORD-UNGATED, which the fairness
sweep exists to catch.

**AND A COUNT IS NOT A FLAG.** Mauvrion Skies prints 3 / 2 / 1 Runechants by
pitch; the reader tested for the bare string "create a runechant" so only
blue matched, into a `boolean`. Red and yellow forged nothing.

An unreadable rider **refuses** and the head still lands — Display Loyalty's
triggers on *attacks* rather than hits, Goon Tactics' payload has no reader.
That leaves the gap visible in the audit instead of behind a guess.

### `perm` AND `destination` ANSWER THE SAME QUESTION (v3.08)

Where a resolved card goes is decided in two places — `parser.fxParse`'s
`fx.perm` (off the printed line) and `types.destination` (off the
structured array) — and **nothing compared them.** They disagreed on
exactly four cards, Arakni's Traps, and `types.js` was right every time:
a **Trap is a SUBTYPE of Defense Reaction**, so it resolves to the
graveyard like any reaction. Read off `tt`, all four resolved into the
ARENA and stayed there for the rest of the game, inflating every
permanent count on the board.

Same ruling as v2.39 — **where `tt` and `ty` conflict the structured
array wins** — one layer further down than anyone had looked. And the
reason it survived is worth keeping: **a card that does nothing is a card
nobody follows.** All four read `tier: none`, so no one ever asked where
they went; building their triggers is what made the zone visible.

**RULING (user, 2026-08-19): a Trap is played from HAND like any other
Defence Reaction** — the subtype carries no zone restriction, and the
database prints no reminder text for it. So v3.08's build is complete
rather than provisional, and nobody needs to re-open it.

The clear is on `fx.dr`, not on the word "trap". The defect is not that
the word was wrong, it is that **a reaction is not a permanent whatever
its subtype says** — a future DR printing "Aura" walks into the identical
bug. `test/traps.test.js` pins the pool-wide agreement, which is the
guard that would have caught it.

**A CONDITION ABOUT THE INCOMING ATTACK IS NOT `pumped`.** `pumped` asks
whether MY attack beat its own base and is settled in `linkPumps` once
the total is struck; `defGA`/`defPumped` ask about the attack being
DEFENDED, at the moment the trap resolves. A `pend` belongs to whoever
declared it, so both test `pend.by !== actorOf(n)` — the same test
`atkMinus` makes. Without it a trap reads its holder's own swing and
marks the wrong hero, and the feed looks perfectly correct.

### THE CR REVIEW (v2.45) — nine bugs, none of them a card

A pass over the turn structure and the priority windows, grounded against
the **published CR** rather than against the code's own memory of it.
Every affected card parsed perfectly; what was wrong was the machine the
cards run inside. **No tool in this project could see eight of the nine**
— the audit measures coverage, the fairness sweep looks for cards
stronger than printed, and neither asks whose hand refills at end of turn.

Read these before touching `judge.js`, because each is a shape that can
come back:

| CR | what was wrong |
|---|---|
| 4.4.3f | **the wrong hero drew.** (e) calls `priority.endTurn`, which does CR 4.4.4's *handoff* as well as 4.4.3e's fizzle — so `n.turnPlayer` at (f) is the INCOMING player. Use the `seat` argument. |
| 4.4.3a | ally life reset **ran only in the log**: `resetAllyLife` returns THE GAME, not `{game,msgs}`, so `out.game` was undefined and the `\|\|` fell back to the unchanged state |
| 4.5.3 | an **invented** deck-out loss. Three ways to lose and no more: life to zero / no hero, an effect says so, concede |
| 4.3.4 | the action phase **never ended** on a mutual pass — `advance` has no transition out of the layer step, so the window closed and nobody could act |
| 7.3.4 etc | **"in succession"** — a play or a declaration did not reset the pass record, so the attacker never got a window to answer a defence reaction |
| 1.4.5 / 7.3.2a | **allies could not be attacked** — they had reached the arena since v2.43 and nothing could touch them |
| 4.4.4 | `hist` cleared for the incoming seat only, so "…this turn" read the wrong turn during the opponent's |
| 8.x | an **unaffordable play was declared legal**, opening a payment whose only exit was cancel — a live-lock for anything that trusts `legal` |

**THE DRILL THAT READS THE LOG CANNOT SEE THE BUG.** Two of these lived
under green drills that asserted on `feed` messages: the end phase really
did print (a) through (f) in the CR's order, and it really did say
"draws to intellect". Assert on **hands, life and zones**, not on prose.

**A DRAW IS NOT COSMETIC.** You refill at the end of *your* turn so you
have cards to block with during *theirs*. Refilling the incoming player
instead means every hero opens their turn with a full grip and blocks
with nothing — block-or-hold stops being a decision, which is the game.

**Attack-targets ride on the ACTION**, not in a prompt:
`{t:"play", uid, from, target}` where `target` is an ally's uid or
`"hero"`. That keeps `reduce` pure and serializable — one action drives a
tap, a replay and a peer. `J.targets(g, defSeat)` is the list to offer.
Omitting it means the hero, always a legal choice; **making the choice
mandatory (CR 1.4.5) is the caller's half and is not built.**

Still deliberately not modelled, and each is honest rather than hidden:

- **the layer-step window (CR 7.1.2)**. An attack goes straight onto the
  chain; in the CR it sits on the stack first and both seats may respond
  before it becomes a chain link. Needs the stack/queue, which
  `priority.js` already has hooks for (`queueEmpty`). **The window itself
  is not lost** — the ATTACK step immediately after opens an equivalent
  instant window for both seats, verified in a driven game, so what is
  missing is the distinction between "on the stack" and "on the chain",
  which no Phase 1 rule asks about.
- **the START phase is passed through, not skipped.** `P.endTurn` leaves
  the incoming seat in `phase:"start"` and `endPhaseAfterArsenal` moves
  them on in the same breath, so no state ever RESTS there. That is
  correct rather than a shortcut: CR 4.2.1 gives nobody priority in the
  start phase, so the only thing that can happen in it is a start-of-turn
  trigger, and this reducer models no card effects. It becomes a real
  pause when one exists.
- ~~**allies do not attack.**~~ **BUILT at v3.44.** `parser.allyAttack` is
  the reader, `from: "ally"` is the route, and both boards share it — see
  "AN ALLY IS A PERMANENT THAT ATTACKS". The arena untap (CR 4.4.3d) was
  built ahead of it and is what `{t}` now rests on. Choosing an ally as an
  attack-target is judge's (CR 1.4.5, since v2.45) and is **deliberately
  absent from the trainer**: its opponent is 12 vanilla attacks with no
  allies and a fabricated swing, so there is never a target to choose —
  see "MEASURE BEFORE BUILDING A PLANNED JOB".
- **`index.html` still carries the invented fatigue loss.** Left alone on
  purpose: the dummy reshuffles its graveyard rather than decking out, so
  changing it is a decision about solo play, not a rules fix.

### `engine/sparring.js` (v2.46) — A SEAT IS A POLICY

`act(game, seat) -> action | null`. The trainer's opponent is not a seat
somebody occupies, it is a **branch inside the rules** — `foeSwing`
fabricates the swing, `dummyDefence` picks the blocks. That is why a
second human has nowhere to sit. Here a seat is just something that
answers *what do you do*, and solo / hotseat / network are the same game
with different things calling `reduce`.

Three properties, all drilled and all proven to bite:

1. **It proposes; the judge disposes.** Every action goes to
   `judge.legal` before it is returned, so **a refusal is always a bug in
   the policy** — which is why `run` records refusals rather than
   swallowing them. The heuristics can then stay simple: the policy never
   restates a rule in order to avoid breaking one.
2. **It reads NO card text.** Ranks on printed numbers (power, pitch,
   defence, cost) and asks `legal` for everything else. A drill fails on
   `require("./parser")`, on `fxParse`/`effCost`/`weaponCost`, and on
   reading `.tx` or `.kw`. Same discipline that kept `actions.js` free of
   card text: **a sparring partner playing badly and a card being read
   wrong must never be confusable.**
3. **Deterministic, and it never touches `game.rng`.** Every ranking is a
   TOTAL order with ties broken on uid — a ranking that leaves ties
   unbroken is a desync waiting for two equal blockers. Consuming the
   seeded stream would shift every later shuffle, so replaying a seed
   would diverge the moment a human took over a seat it used to drive.

**The winner follows the HERO, not the chair** — Kayo beats Dorinthea
from seat 0 and from seat 1. That is the property that says seat 1 is
genuinely occupiable rather than a weaker shape wearing a deck.

**PORTING `dummyDefence` UNCHANGED MADE THE GAME DEGENERATE.** Both seats
blocked **41 of 41 attacks** and one finished a 21-turn game on **full
life**. Not a tuning complaint — a regression run that never deals damage
never exercises the damage step. The cause is that the heuristic was
written for a seat with **no action phase**, where a card in hand had no
use but to block, so spending two on every swing cost nothing. Both seats
have an action phase now. `takeUpTo` is the damage a seat will simply
take rather than spend a card on; **lethal overrides it**, because
nothing in hand is worth more than being alive. Iron stays greedy —
equipment wears rather than leaving, so raising it costs no card.

It was **not an AI opponent** (standing decision 2026-07-25) — **that
decision was REVERSED on 2026-08-14**, and building the seat is now the
active direction; see the roadmap entry below and `HANDOFF.md`. What has
not changed is that it is **not a difficulty curve**: the `[3,4,5]`
escalation it replaces was *tuned* and real cards from a real hand are not.
Retuning is a play session, not a drill.

### THE POOL COMES IN FAITHFULLY (v2.48) — `test/loader.test.js`

Everything in this repo reasons about a card **after** two steps:
`mapDbCard` turns a database record into the engine's shape, and
`resolveEntry` turns a deck entry into the card actually played. If
either drops or mistypes a printed value, nothing above can notice — the
card is simply a different card, consistently, and it agrees with itself.

**`mapDbCard` IS THE ONE MIRROR v2.20 COULD NOT DELETE**, and not by
choice: the live copy lives inside `useCardDB`, a React hook, so it
cannot be loaded from `engine/`. "Change both" was a note to a human, and
notes to humans are what the sync guard exists because we stopped
trusting. Drift means the Node tools audit one pool while the phone plays
another, **both internally consistent**.

It is guarded as a **field map** (key → expression), not as text, since
the two blocks sit in different surroundings. The printing loop is
guarded too — drift there is fifteen decks showing four art treatments
side by side, only on the phone. The field list is pinned, so adding one
is a deliberate edit: **that is where the reminder to bump `DATA_VER`
lives.**

`resolveEntry` has silently narrowed the record **twice** — `life` (so
allies were not living objects and could not be attacked) and `ty` (so a
defence reaction was playable on its own turn). Both are now pinned, with
every hero's **printed** life and intellect: Iyslander 18, Blaze 17,
Lyath intellect 5 are named explicitly, because a defaulting bug looks
fine on the other twelve.

**Pitch is the one normalised value** — no printed pitch arrives as 0 —
and that is stated as a rule (*a card resolves to pitch 0 iff it is
Equipment or a Weapon*) rather than excused, so a real action card losing
its pitch cannot hide among the 73.

Checked and clean, no change needed: all **488 deck entries resolve**,
all 15 decks total exactly 55, every card has art, and the live parser's
`tt`-reading agrees with `types.js`'s `ty`-reading on `isAttack`, `isAR`,
`isDR` and `isInstant` across all 401 cards — so the `tt`/`ty` conflict is
a **latent hazard, not a live bug**.

### THE REDUCER IS A PUBLIC SURFACE (v2.48) — `test/fuzz.test.js`

`net.js` asks `legal` twice: once on the guest before sending, once on
the sequencer before committing. That makes `reduce` a surface fed by
**JSON off a wire** — a stale action from before a resync, a guest on an
older build, a crafted packet. Four properties, each a way a real session
dies:

| property | what breaks without it |
|---|---|
| never THROWS | an exception kills the session instead of refusing one move |
| never MUTATES on refusal | a bad packet costs the caller its state |
| `legal` and `reduce` AGREE | a guest sends what the sequencer refuses — the peers diverge |
| a seat cannot use the other's cards | seats are decoration |

**Two of these drills were written wrong first, and sabotage is what
found it.** A drill that accepts *any* refusal passes on a broken engine:
the non-priority seat is refused by "you do not hold priority" long
before ownership or the zone is ever read. Both now **give priority to
the seat under test and assert the REASON**, plus a control that the
seat's own hand is still reachable — without which the drill passes just
as well when nothing can be found at all.

`__proto__`, `constructor` and `toString` are all truthy on any object,
so a zone check that asks "is it there" walks into a function. `legal`
asks `Array.isArray`, and the drill pins the *zone* refusal specifically
rather than settling for a refusal.

### THE JOURNEY CENSUS (v2.47) — `test/journey.test.js`

**All 401 pool cards, every journey their type promises and every one it
forbids, driven through the real reducer.** The user's Phase 1 brief was
"the function of each different card type and their full usability from
pitch to play", and every other drill here asks about one card or one
clause. This asks four questions of all of them, off the printed TYPE:

| journey | count |
|---|---|
| pitched for its printed pitch value | 328 |
| played → **chain** / **arena** / **grave** | 175 / 23 / 91 |
| declared as a defender | 332 |
| **refused**, with a reason naming the card | 112 |

The 112 is a partition and it is pinned: Equipment 58, Weapon 15, Block
4, Attack Reaction 20, Defense Reaction 15. **The 15 weapons reconcile
with "eleven swinging weapons"** — four print no power and are activated
for a non-attack ability instead, which is the pinned
`types.isWeaponType` vs `parser.isWeapon` split counted from the other
end.

**A ONE-SIDED CENSUS IS A COVERAGE TOOL WEARING A JUDGE'S COAT.** Written
asking only "can this card do what its type promises", it reported a
clean **401 out of 401** while a Block card was a free 0-cost play and a
defence reaction could be declared as a defender — both sev-3 *illegal
play allowed*, the direction that steals games. It could not see either,
by construction, because a card doing MORE than its type allows still
does everything its type promises.

That is the same shape as the audit measuring consumption rather than
faithfulness, and as `fairness.js` being deliberately one-sided. **When
you write a census, write the refusals too.** Making a Block playable now
trips three drills instead of none.

It reads **no card text**: every expectation comes from `types.js` and
every answer from `judge.legal`, so a failure here is always the machine
getting a type wrong, never a card being read wrong.

**The counts are asserted, not reported.** A census that quietly stopped
driving anything would otherwise pass by finding nothing.

### Two more rules the CR review missed (v2.46)

**A WALL DEFENDS ONE CHAIN LINK, NOT THE CHAIN.** `chainBlocked` stopped
a spent piece being re-*declared* (CR 7.3.2b), but the declaration itself
stood until the chain **closed** — so `strike` re-read `blockG` on link 2
and counted the same iron again, with nothing declared and nothing paid.
`blockH`/`blockG` now clear in `strike`, where the wall has done its job;
`chainBlocked` is the one that outlives the link.

The pool hides this almost perfectly: **Silver Age equipment is nearly
all battleworn**, so it wears to 0 after one block and the second helping
is worth nothing. It takes a piece that does not wear to see it. Hand
blockers escaped by accident rather than by rule — they leave the hand at
the strike, so the link-2 lookup finds nothing. Two different reasons for
the same clean answer, and only one of them is a rule.

**`endTurn` SKIPPED THE OPPONENT'S LAST WINDOW (CR 4.3.4).** The action
ran the whole end phase on the spot — the turn player deciding, alone,
that the opponent had nothing to say. Invisible in a solo trainer,
because the dummy never had anything to say; with a human in seat 1 it
deletes their last instant window on **every turn of the game**.

`endTurn` is now a **PASS carrying intent** — identical machinery to
`pass`, refused where "end my turn" would be a lie (out of turn,
mid-chain, without priority). Ending a turn takes two actions, which is
what the CR says and what a table does. Drills that sent one `endTurn`
and expected the turn to be over were edited deliberately; `passTurn` in
`judge.test.js` is the shared helper.

**AND `weaponUsed` HELD TWO LIMITS THAT EXPIRE DIFFERENTLY.** A TAP is a
state the permanent is in and only its controller's untap step (CR
4.4.3d) lifts it; `Once per Turn` is a per-turn **allowance** that comes
back for both seats at every turn boundary. `perTurnCleared` unpicks them
by re-reading the piece's printed line rather than storing a kind on the
flag. They coincide for a weapon swing — action speed, so a seat reaches
it only on its own turn — and stop coinciding at the first `Instant -
Once per Turn` equipment ability.

### The remaining order

1. ~~**Port the effects**~~ **DONE (v2.53 + v2.62).** `runOps` (234),
   `execute` (455) and `resolveStack` (122) all live in
   `engine/effects.js`. **There is exactly ONE copy of the card semantics
   in the project.** The first two moved byte-identically by script; the
   third was `() => setG(s=>{…})`, so its BODY moved and the React wrapper
   stayed behind as `() => setG(_EFX.resolveStack)`.

   **WHAT THE TABLE STILL NEEDS IS NOT LOCATION.** `execute` does two jobs
   at once: it applies the card's effect *and* **advances the turn
   structure** — it calls `dummyDefence` inline and sets `mode:"stack"` —
   while `judge.js` drives combat through `phase`/`step`/`chainCards`.
   Separating *what the card does* from *what happens next* is the
   remaining structural job, and the inline `dummyDefence` call is the
   first knot in it.

   Historic note, because the shape matters: the port was safe because the
   live trainer plays every card effect and was therefore the regression
   harness for its own extraction. **Fixes went in their own commits** —
   smuggled into a move, no diff can tell a fix from the move.

   **THE BODIES WERE MOVED, NOT REWRITTEN**, extracted by script and
   verified byte-identical at the commit that moved them. That is the
   whole safety property of this port: the live trainer plays every card
   effect today, so it is the regression harness for its own extraction,
   and a port that CHANGES behaviour is wrong by definition. **Fixes go
   in their own commits** — smuggled into a move, no diff can tell a fix
   from the move, which is the one review a port actually gets.

   `makeEffects(ctx)` takes the trainer closures explicitly and **throws
   on a missing key** rather than letting a moved body capture a browser
   global. `test/effects.test.js` fails if the trainer's context literal
   and the module's `CTX_KEYS` drift apart, and pins the no-mirror rule
   per moved function.

   **When a rules function leaves `index.html`, the LEDGERS have to
   follow it.** `test/actor.test.js` slices bodies by anchor pairs out of
   a source file; two of its anchors left the file in v2.53, and a ledger
   that stops scanning a body **keeps reporting it green** — worse than
   never having scanned it. Anchors now name their source. Three other
   drills pinned a line of `execute` by reading `index.html`; a source
   guard aimed at the wrong file **passes by finding nothing**, so they
   were repointed rather than left to rot.

   **BOTH SEAMS ARE CLOSED.** `execute` stopped calling `dummyDefence`
   in v2.73 (it declares and stops), and the four `built.runeDmg` reads
   became `bAct(n).runeDmg` in v2.77 — which took `built` off the
   context entirely, 18 keys to 17. It was the last key that named a
   SEAT rather than a role, and supplying it would have written a
   seat-0 rules read into judge.js's brand-new caller.
2. ~~**The dummy becomes a policy**~~ **Done in v2.46** —
   `engine/sparring.js`, above. `foeSwing` and `dummyDefence` remain in
   the trainer until step 3 retires them with everything else.
3. ~~**The effects port**~~ **DONE (v2.77-v2.79).** judge.js supplies
   the context and calls `execute` / `linkPumps` / `linkPayload` /
   `applyAnswer`; `local.js` is the session that lets a player alone
   reach it; `sparring.act` sits in seat 1. `resolveStack` split into
   two shared pieces so each caller keeps its own wall and its own
   damage routing between them — that is the piece judge.js could never
   call, because it holds defenders on `blockG`/`blockH` and routes by
   CR 1.4.5 attack-target.
4. **Retire `Battle`'s rules** — the last step. The rule that governs it
   has not moved: **`Battle` is the regression harness and does not
   retire until the merged path passes the same drills.**

   **THE GATE IS PASSED (v2.80).** `test/kayo.test.js`,
   `test/dorinthea.test.js`, `test/frostbite.test.js`,
   `test/arcane.test.js` and `test/paytoll.test.js` all drive
   `judge.reduce` through `test/helpers/judged.js` — see "THE DRILLS RUN
   ON THE REAL CONTEXT" below. That **unblocks** the retirement; it does
   not perform it. What is left is `Battle`'s 97 `mode`/`bphase`
   references, and whatever replaces `setG` must keep the invariant-judge
   funnel or the guard rails go dark.

---

## PHASE 3 — the text boxes, one hero at a time

**Kayo is complete (v2.55–v2.63): every card in his deck and gear is
built.** He was the pilot, and the method is the deliverable as much as the
cards are. See `HANDOFF.md` for the short form and `KAYO-GUIDE.md` for the
field notes.

**FIND THE HERO'S ONE MECHANIC FIRST.** Kayo's entire deck is *"a card with
6 or more {p}"* wearing three sets of words. And **read the hero ability
before the cards**: his clause 2 (*"attack action cards you own get +1{p}
while they are in any zone other than the combat chain"*) was worth **half
the deck** — 22 of 47 cards satisfied his own threshold before it, **45
after**. A hero ability that reads like bookkeeping can be the engine.

**EVERY BUG THIS PHASE FOUND REPORTED TIER `full`.** They were read, and
read wrong. The audit measures consumption, not faithfulness; the fairness
sweep is one-sided; neither asks whose turn it is. The bug classes:

| shape | example |
|---|---|
| a clause **silently dropped** by an unanchored match | "draw a card **then discard a random card**" parsed to `[["draw",1]]` |
| **one event mistaken for another** | "discarded THIS WAY" ≠ "this turn" ≠ "in the graveyard" — and an attack reaches the graveyard AT DECLARATION |
| a **keyword granted off raw text** | `hasKw` gave Pulping dominate every swing from inside its own `if` sentence |
| a **printed escape hatch** that does not exist | Strongest Survive's "unless they reveal…" — byte-identical parse with and without it |
| **parsed perfectly, no schedule to fire on** | Might/Agility/Vigor were inert; seven clash payoffs were decoration |
| **no route at all** | `Instant - Discard this:` on a card in HAND — only gear and arena permanents ever got a `powCard` |

**A TRIGGER IS NOT A GATE.** *"When this attacks, intimidate"* fires every
swing; *"If X, this gets dominate"* may never fire. `if`/`unless` gate; a
bare `when`/`whenever` does not, unless the when-clause carries a nested
`if`. Getting this backwards turns a working card off, which is the
opposite error and just as wrong.

**"YOUR ACTION PHASE" IS NOT `phase === "action"`.** In Flesh and Blood the
combat chain lives inside the TURN PLAYER's action phase, so while you
defend against their swing the phase is still "action" — it is just not
yours. Gate on `turnPlayer === actorOf(n)` as well.

**SABOTAGE EVERY NEW DRILL.** Three drills in one session proved nothing
until they were sabotaged: a fix shipped with **no drill at all**, another
grepped for a variable that survives deleting the gate it lives in, and a
third keyword-matched a log string. **Pin the GATE, not the identifier.**

### The solo mirror (v2.63) — RETIRED in v2.81, BURNED in v2.83

**RULING (user, 2026-08-16): seat 1 is either a PERSON, who picks their
own hero when they join a table, or the dummy — and a seat the dummy
fills is ALWAYS the vanilla pile.** There is no hero the dummy plays as.
The picker is gone; so is `oppH`, and a drill fails if the name appears
in live code, because a picker comes back one branch at a time.

**`foePick`/`foePlay` ARE GONE (v2.83)** — 103 lines that had been
unreachable since v2.81 and still read as live rules. Dead rules code is
worse than dead code elsewhere: it is a second description of a rule that
nobody can reach and everybody can read.

The mechanics they recorded are not lost, because every one of them is
asked of the live path instead — the printed `playIf` gate, the
additional cost, and go-again-as-a-GAIN all belong to `execute`. The
three drills that pinned their internals were replaced the way v2.81
replaced the picker's, with the claim that matters (**none of it is
there**, scanned with comments stripped), except the go again
arithmetic, which was **repointed at `execute`** and is now asked of
`act(n)` rather than `opp(n)`. A rule with no drill is worse than a
drill aimed at a retired copy.

Worth keeping for the shape: the actor stayed 0 for the swing, because
the block path reads `act(s).blockH` and flipping it would ask the
attacker to block its own attack; the actor was borrowed only around
`runOps`; and only unconditional effects fired, because `fx.conds` is
`execute`'s to evaluate and copying that would have been a second copy
of the semantics.

**A SEAT THE DUMMY FILLS IS BUILT BY `build.buildVanilla`** — one copy of
the deal, reachable by a drill, taking the deck list as DATA. It used to
be written out inside `Battle`. `buildMatch` reads a **null hero key** as
the dummy, so the trainer and the local table face the same opponent and
the only thing that differs between them is which engine is driving —
which is what makes them comparable while `Battle` is the harness.

**The table's dummy is UNTUNED and currently wins 11 of 15.** At 20 life
it still wins 8, so it is not the life total: a deck with no rules text
suits a policy that reads no card text, and `sparring.act` plays 30
vanilla attacks better than it plays a real hero's deck. The TRAINER is
unaffected — it runs the tuned `[3,4,5]` escalation. Retuning is a play
session, not a drill.

`window.THROW_MODE = "coin"` is a testing affordance. `rps.js` and the
throw UI are untouched; set it to `"rps"` to restore the throw for launch.

### What must survive the rebuild

Each one cost a real bug. No build step, ever. Never invent card effects.
`you()`/`opp()` read and `youMut()`/`oppMut()` write, rules use
`act()`/`foe()`, builds use `bAct()`; **never write a side field as a
top-level game key**. Store the rng back. `instead` REPLACES, go again is
a **GAIN**, an instant costs **no** action point.

---

## The two-player migration (v2.14 groundwork)

Roadmap item 1 — "make the state symmetric" — now has a shape to migrate *to*
and a bridge to migrate *across*, so it can proceed a function at a time
instead of as one big-bang rewrite.

**`engine/sides.js` — the shape a second human can occupy.**
`makeSide()` defines the 48 fields a player needs in order to *be* a player;
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

### Next-attack buffs: two bugs, one clause (v2.30)

> "Your next **arrow** attack this turn gains **+3{p}**"

That single line was being read wrong twice over, and **the coverage audit
could not see either one** — every affected card reported tier `full`. They
were read, and read *wrong*. Same blind spot as the `noop` keywords above:
**a card can be 100% covered and still hand a player a win they did not earn.**

**1. The qualifier was swallowed — 24 cards.** The pattern used
`[^.+]{0,70}` and emitted a bare `buffNext`, so an *arrow* buff landed on a
sword and a *Runeblade* buff on a Generic. `attackQual` now reads the
qualifier off the printed **type line** and it rides in the op as `op[2]`.

Two shapes that look alike and are not:

| printed | meaning | matcher |
|---|---|---|
| `Brute or Warrior` | **OR** — either type | `[["brute"],["warrior"]]` |
| `Pirate ally` | **AND** — both words | `[["pirate","ally"]]` |

Qualified buffs live on a new side field **`buffQ`** (`{amt, q}` entries)
rather than the bare `buffNext` integer, and **a qualified buff that does not
match is not spent** — it waits for an attack it actually applies to.

**2. The buff was counted TWICE — 34 cards.** `fxParse` has a fallback that
scans the *whole text* of a non-attack for `gains/gets +N{p}` and queues it as
a self-pump. The same "+3{p}" matched there **and** in the `buffNext` rule, and
`execute` added both:

| card | printed | was granting |
|---|---|---|
| Act of Glory | +6 | **+12** |
| Up Sticks and Run · Re-Charge! | +4 | **+8** |
| Lace with Frailty / Bloodrot / Inertia | +3 | **+6** |

The fallback now refuses when a `buffNext` op already read that `+N{p}`. It
still fires for a genuine self-pump with no op — that safety net is drilled,
because deleting it outright would break a different set of cards.

**Both regressions are pinned, and both drills are proven to bite** by
reintroducing the bug and watching them fail.

### The hero BUILD is per-side too (v2.41)

The actor/perspective split (v2.24) fixed this for **zones**. It was still
wrong one layer up: `built.viseraiPassive` meant *the player's* Viserai,
because `built` was seat 0's build captured in closure.

```js
built.both[i]     // the ledger: [seat 0's build, seat 1's build]
bAct(s)           // RULES — the build of whoever is resolving
built.X           // UI ONLY — seat 0, because the UI renders seat 0
```

Five rules sites moved onto `bAct`: `viseraiPassive`, `lyathBoo`,
`iceFrostbite`, `arsenalInstant` (and `wateryGrave`/`HPOW` remain UI-side
in `playables()`). **A passive read as `built.X` inside a rules function
is the bug this fixed** — it fires for the wrong hero the moment seat 1
acts.

There is deliberately **no `bFoe`**. Nothing needs one — a passive fires
for its own hero — and a dead helper beside a live one is how `sides.js`'s
seat-hardcoded `you`/`foe` came to be deleted in v2.24. Add it when a rule
actually asks about the other hero.

`DUMMY_BUILD(deck, gear)` gives the dummy the same shape, with every
passive written out as `false` rather than defaulted — so a passive added
to `buildSide` and forgotten there reads `undefined` at the call site
instead of silently reading as false on a real hero's turn.

**Both seats equip through `defaultPicks`.** Passing `{}` for the
opponent's loadout handed Azalea all *eight* printed pieces where the slot
rules allow ~5 — and since `chainBlocked` only stops a piece re-blocking
the **same** chain, every extra piece was another free block later in the
turn. One set of slot rules governs both seats, or the opponent is
quietly stronger than printed.

**`DUMMY_INT` is gone from `newTurn`** — the refill reads `opp(s).int`
and is still the **only** refill site. When seat 1 gets a real end phase
that draw moves there and becomes turn-1-only for both seats (CR 4.4.3f);
adding it without removing this one draws twice. The **graveyard recycle
stays a dummy affordance**: a real opponent runs its deck down and has
fewer blockers, and does not yet lose for it.

### The arsenal, face up (v2.33–v2.34) — and whose "it" is it?

The trainer's end-of-turn arsenal sets cards **face DOWN**. Azalea's arrows
trigger on **face UP**, which is a different event reached only by an enabler
that says so. All three enablers are live **and, as of v3.53, actually
reachable** — the queue site sat inside `if(attacking)` and every card that
prints an arsenal put is a non-attack, so from v2.33 until v3.53 this
sentence was true about the parser and false about the game (see "A FIX FOR
ONE MECHANIC IS NOT A FIX FOR THE SHAPE"). The face-up card carries
`_faceUp`/`_upTurn` and the payload is **stamped** onto it (`_arsPow`,
`_arsGA`) so "+2{p} this turn" survives until the arrow is actually played.

**Arsenal capacity is modelled, not assumed.** Two wordings, two questions:

| printed | needs |
|---|---|
| "you may put an arrow ... into your arsenal" | a **free slot** — `arsFree(sd) > 0` |
| "**if you have no cards in your arsenal**, you may ..." | **zero** — `arsEmpty(sd)` |

They coincide at the normal capacity of 1, which is exactly why hardcoding 1
would hide the difference until a second slot existed. `arsCap`/`arsFree`/
`arsEmpty` live in `parser.js` beside `runeCount`; storage is still one card
or null, and `arsCap` is read off the side with a default so the seam costs
the migration ledger nothing.

**"IT" IS THE CARD THAT WAS PUT, NOT THE SOURCE.** Bull's Eye Bracers reads
"…into your arsenal. **It** gains +1{p} until end of turn." Both the clause
router and the whole-text self-pump fallback read that as the *equipment's*
own pump, so the bracers gained the power the arrow is printed to get — the
same wrong-subject shape as v2.30's arrow buff landing on a sword, and equally
invisible to the coverage audit, which counts the clause as consumed either
way. It is held back from `fx.self` and re-read as `arsenalPut.stamp`.

**A prompt spec only carries fields `buildPrompt` knows about.** `arsStamp`
had to be added there explicitly; until it was, the Bracers' +1 was silently
dropped. It is deliberately **not** `ops` — `prompts.js` runs no effects, and
returning it as ops would hand it to `runOps`, which applies to the *source*.
When adding a spec field, add it to `buildPrompt` or it vanishes.

**`parseHeroPower` accepts exactly one conditional shape**, the arsenal put.
It is safe because the powCard carries the ability's whole printed line and
`execute` re-reads it with `fxParse`, which does read the gate and the riders.
Do **not** loosen it further: a broad relaxation would raise the tier of cards
nothing wires, which is the "never parse ahead of wiring" rule that has already
cost a real bug. A drill pins that an unrelated conditional ability is still
refused.

**A weapon can carry a non-attack activated ability.** Death Dealer is a Bow
whose ability is a put, so `weaponCost` (which requires `": attack"`) never
claimed it and the `!isWeapon` gate skipped it. The extra door is narrow on
purpose — only an ability the arsenal reader recognises.

### Optional costs — "you may X. If you do, Y" (v2.28)

**24 pool cards are shaped like this and not one was fully read.** The rider
was deliberately skipped because paying nothing and collecting the payload is
the free-ability bug v2.04 fixed. The machinery to ask properly now exists, so
the text is read instead of skipped.

**`engine/prompts.js` — `pick` gained an `ops` rider.** With `min:0` a pick is
an optional cost; `ops` is the payload; `applyPrompt` returns it **only when
cards actually moved**. Decline and the rider does not fire — same rule the
`pay` variant already enforced, and there is a drill named for the v2.04 bug
that is proven to bite.

**`engine/parser.js` — `fx.optCost`.** The two halves arrive as *separate*
clauses (the splitter breaks on the period), so they are paired in `fxParse`
where the whole card is visible, not in `classifyClause` which sees one at a
time. The rider is classified by `classifyClause` itself, so `deal 1 arcane`
/ `draw a card` / `this gets +2{p}` all keep using the one reader.

```js
fx.optCost = {trigger, kind:"banish"|"discard", zone, filter, ops}
```

`optFilter` reads the cost's subject into a prompts.js filter from printed
**fields only** — `an aura` → `{tt:"aura"}`, `a yellow card` → `{pitch:2}`,
`a Nimblism` → `{name:"^Nimblism$"}` (anchored, so it cannot match
"Nimblism Adept"), `with cost 2 or less` → `{costLe:2}`.

**It returns `null` on anything it cannot read honestly, and the card is then
left unclaimed rather than guessed** — the golden rule applied to a cost. A
wrong guess would let a player pay the wrong thing, or pay nothing and collect.

**THE WHOLE SUBJECT PHRASE MUST BE CONSUMED, or it refuses (v2.29).** This is
the difference between reading a card and guessing at it, and getting it wrong
shipped a real bug:

> **Mounting Anger** — "banish an attack action card from your hand **with cost
> less than the number of Draconic chain links you control**"

A loose substring test saw `attack action card`, returned `{type:"attack"}` and
**silently dropped the limit**, so any attack card in hand became a legal
banish — strictly better than printed, the sev-3 "illegal play allowed"
category. Its look-alike Rising Resentment escaped only by accident, because
its *payload* was unreadable rather than its filter.

Three shapes now refuse, each pinned by a drill:

| phrase | why it is refused |
|---|---|
| `with cost less than the number of …` | a **dynamic** limit; no printed field expresses it |
| `another aura` | an **exclusion** — a field filter cannot say "not this one" |
| `a card with crush` | a **rules-text** qualifier; `promptFilter` reads fields only |

**Look-alike cards are the hazard here, not exotic ones.** Mounting Anger and
Rising Resentment share a cost clause verbatim and differ in the rider
(`it gains +1{p}` vs `it costs {r} less`) — and in both, "it" is the *banished*
card, not the attacker, so the existing `self` op is the wrong op for either.
Pinned so a future wiring pass cannot assume they are the same card.

**The printed zone wins, and it is not always at the end.** "an attack action
card **from your hand** with cost 2 or less" puts the zone mid-phrase; an
end-anchored read missed it and silently fell back to the graveyard, banishing
from a zone the text never named. Drilled.

Wired for the **`attacks`** trigger in `execute`, queued via `promptQ` (never
inline — the attack finishes resolving first) and addressed to `actorOf(n)` so
it asks whoever is swinging. `buildPrompt` returns `null` on an empty zone, so
a cost you cannot pay skips itself.

**A COST CAN BE PAID OUT OF THE ARENA (v3.18).** `destroy` joins `banish`
and `discard` as a cost verb, with the board as its zone — you cannot
destroy a card in a hand or a graveyard, and falling back to the graveyard
default would destroy a card the text never named. That makes *"an aura
**you control**"* the one phrase a seat-addressed board zone genuinely
restates, so it is consumed; `another aura`, a dynamic limit and a
rules-text qualifier all still refuse.

### "ANOTHER" IS AN EXCLUSION THE ENGINE CAN CARRY (v3.20)

`optFilter` refused `another <subject>`, which was honest while nothing
could express it. It rides as **`notSelf`** now — a STRUCTURAL fact, not a
printed field — and the discipline around it is the whole of why it is
safe:

- **the uid is NEVER in the parse.** `fxParse` memoizes on `name|pitch`,
  so one parse serves every copy of the card in a match; a uid stored
  there names whichever copy parsed first and excludes that one forever.
  The QUEUE SITE supplies it as `notUid`.
- **a `notSelf` filter with no uid REFUSES EVERY CANDIDATE.** Offering the
  source is stronger than printed; refusing is weaker and visible. Same
  question v2.04 settled for costs.
- **the uid is threaded only when the card prints "another"**, or the
  other optional-cost cards quietly lose their source as a legal choice.

**It is load-bearing on the LEAVE trigger and nowhere else.** By the time
Sigil of Silphidae's leave trigger asks, `sweepArena` has already filed
it into the graveyard it banishes FROM — an Aura among its own legal
choices. Without the exclusion it eats itself for a free arcane damage
every turn. And the exclusion is by **uid, never by name**: a second copy
of the same card is a different object and a legal choice.

**ONE PRINTED CLAUSE, TWO SCHEDULES.** "When this enters or leaves the
arena" is one sentence naming two events, so it maps to one trigger
(`entersLeaves`) that two sites answer to — `execute` when the aura
reaches the arena, `sweepArena` when its own printed clock removes it.
The name is shared; the schedules are per board, as always.

### A QUEUE SITE INSIDE `if(attacking)`, AND NOTHING THAT NEEDS IT ATTACKS (v3.20)

The only `optCost` queue site in `execute` sat inside the attacking
branch — and **every `play`-trigger optional-cost card in the pool is a
NON-ATTACK** (all three Condemn to Slaughter printings). Its printed
*"you may destroy an aura you control"* was never once offered at either
board between v3.18 and v3.20.

**No tool here could see it, and one of them was a drill.** Coverage read
the card `full` because the clause IS consumed — it counts consumption,
never whether anything asks. The fairness sweep is one-sided toward
too-strong. And `condemn.test.js` built the spec **by hand** and handed it
to `buildPrompt`, which measures the sheet rather than whether anything
opens it: **a drill that constructs its own fixture proves the fixture.**
Drive the real entry point, or pin nothing.

The three spec literals this would have created are one `optCostSpec` —
the no-mirror rule applied inside a single file.

**AND A RIDER CAN BE CROSS-SEAT.** Condemn to Slaughter's *"each opponent
destroys an aura permanent they control"* is THEIR choice, so
`foeDestroyAura` opens a prompt addressed to the other seat rather than
picking for them. That works because **`applyAnswer` ends in
`openPrompt`** — a prompt queued from inside a rider's ops opens like any
other. `min:1`, because there is no "you may" in the rider.

**~~Still to wire: the `hits` and `defends` triggers.~~ RETIRED at v3.53,
and it was stale in both halves.** `defends` was wired in v3.33 (the site
is in `afterDefenders`, addressed to the DEFENDER), and **`hits` has zero
pool cards** — measured by asking the parser which records actually set
`fx.optCost`, rather than by reading card text:

```
attacks: Fire that Burns Within · Golden Tipple · Jack Be Quick · Runic Fellingsong
defends: Crash and Bash          play: Condemn to Slaughter
entersLeaves: Sigil of Silphidae hits: (none)
```

So there was one unwired site with no customers, and a note telling the
next reader it was worth eight cards. **WHEN A NOTE SAYS A TRIGGER IS
UNWIRED, ASK WHICH CARDS SET IT** — a trigger with no card is not work,
and v3.41's rule (when you close a recorded gap, delete the record) has a
twin: when a recorded gap turns out to be empty, say so. The eight cards
`npm run gaps` files under this family are NOT `optCost` cards at all;
each needs a different COST shape — *"destroy **this**"*, *"pay
{r}{r}{r}"*, or a modal *"discard a card **or** destroy the top card of
your deck"*. See `WEEK.md`.

**Measured:** 258 → **264 full**, 35 → **33 none**. Runic Fellingsong went
none/part → full; Golden Tipple (×3) and Fire that Burns Within → full.

> **THIS SENTENCE NAMED MOUNTING ANGER TOO, AND IT IS `part` (v3.82).**
> Its trigger is `hits`, and v3.53's own measurement records that **zero
> pool cards** set `fx.optCost` on that trigger — so it never had one to
> gain. A doc claim is a test with no assertion (v3.41), fifth time; the
> way to keep a coverage sentence true is to re-run `npm run audit`, not
> to trust it.

### The priority machine, in SHADOW (v2.27)

Roadmap Phase A step 4 — *the* step that changes **control flow** rather than
field names, so it lands in two moves. This is the first.

`DawnPriority.fromTrainer(t, foeFirst)` derives the machine's state
(`phase`/`step`/`priority`/`passed`/`turnPlayer`/`firstPlayer`/`attacker`) from
the trainer's `mode`/`bphase`/`chainOpen`, and `withPriority` merges exactly
`PRI_FIELDS` into every state that passes through `setG`. **It drives nothing
yet** — `mode`/`bphase` are still the source of truth.

Two reasons that is worth a version on its own:

1. **It turned four dormant guards on.** `BAD-PHASE`, `BAD-STEP`,
   `BAD-PRIORITY` and `PRIORITY-IN-CLOSED-PHASE` all guard with `!= null`,
   and the trainer carried none of those fields — so since v2.21 they had
   **never once fired on a real game**. Now they audit every state change.
2. **It proves the mapping before anything depends on it.** Every bug this
   cycle was found by eye rather than by a red test; this is the change where
   that would have been most expensive.

`fromTrainer` lives in `engine/priority.js`, not the trainer: it is pure, it is
a statement about priority, and inside the React component no drill could reach
it. It builds state by **calling the module's own transitions** rather than
restating them, so there is one description of who holds priority when. It is
passed **no `sides`** — `toPhase` issues an action point when it sees one, and a
derivation must never touch resources.

The mapping, verified in live play:

| trainer | machine | why |
|---|---|---|
| `act`, no chain | action / **layer**, priority you | your open window |
| `act`, chain open | action / **resolution** | CR 7.6.3 — the link resolved, you may play another attack |
| `pay`,`arsenal`,`boostpick` | action / layer | UI sub-modes, still your window |
| `stack` | **reaction**, attacker you, priority you | you attacked → `attack-reaction` |
| `block`+`defend` | **defend**, turnPlayer **1**, priority **1** | CR 7.3 — see below |
| `block`+`react` | **reaction**, attacker 1, priority you | dummy passes, window slides to you |
| game over | **end**, priority `null` | CR 4.4.1 |

**The counter-intuitive one is load-bearing.** In the defend step the
*turn-player* holds priority (CR 7.3) — so while the dummy swings,
`canAct(g,0)` is **false** and `canDeclareDefenders(g,0)` is **true**.
Declaring blockers is a free, simultaneous game-state action (CR 7.3.2), not a
priority action. That pair is the whole reason the two questions are separate.

**The clock is deliberately NOT wired.** `priority.js`'s `turn` counts
player-turns and ticks on every handoff; the trainer's `turn` counts only your
own turns and is read by the escalation table *and* the score. That belongs
with seat 1's action phase, together with `newTurn`/`foeSwing`.

**What is left** is moving the consumers: replace `playRx`'s hand-rolled speed
gates and the hand-dim logic with `speedAllowed`/`canAct`, then retire
`mode`/`bphase`.

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

- Phases `start → action → end`; chain steps (CR 7.0.1)
  `layer → attack → defend → reaction → damage → resolution → close`.
  **There is no `link` step** — the CR removed it; the go again check moved
  into the resolution step (CR 7.6.2) and `close` (CR 7.7) is where the chain
  actually closes and nobody holds priority.
- `pass()` slides priority; `allPassed()` reports that everyone passed. It never
  advances on its own, because what "advance" means depends on the step.
- **`allPassed` is not the same question as "the window closed".** Every CR
  step-end rule is a conjunction — "when the stack is empty **and** all players
  pass in succession" (CR 7.3.4, 7.6.4, 4.3.4). Passing on a *populated* stack
  resolves the top layer and hands priority back (CR 4.2.2); it does not end the
  step. `windowClosed(g)` is the conjunction and `passOutcome(g)` names which of
  `hold` / `resolve-layer` / `advance` is happening. A machine that cannot tell
  the last two apart skips a whole reaction window whenever anything is on the
  stack — the defending player never gets asked.
- `speedAllowed(g,i)` names the window (`action` / `attack-reaction` /
  `defense-reaction` / `instant`) — the rule the player's hand-dim logic and
  `playRx` currently enforce by hand, stated once so both sides share it.
- Defenders are declared free and simultaneously, so `canDeclareDefenders` is
  deliberately a *separate* question from `canAct`.
- **EVERY combat step hands priority to the TURN-PLAYER** (CR 7.1.x, 7.2.x,
  7.3.3, 7.4.x, 7.5.x, 7.6.3), never to the attacking player. The module used to
  give it to the attacker in the reaction, damage and resolution steps; those
  coincide while one side ever attacks, so it was invisible — the same shape as
  `act()` vs `you()`. The **attacker** decides only *which kind* of reaction is
  legal (`speedAllowed`'s split), which is a genuinely different question from
  who holds the window.
- **The defend step has a priority window** (CR 7.3.3) and it is instants only.
  `speedAllowed` used to return `[]` there, reasoning that declaring defenders is
  free and simultaneous — true about *declaring* (CR 7.3.2), and not a statement
  that the step has no window. CR 7.3.4 ends the step only when players pass,
  and there is nothing to pass if nobody may act.
- **A closed window opens nothing.** Once `windowClosed` is true, `speedAllowed`
  returns `[]` for everyone, so `canAct` can never contradict it. `fromTrainer`
  is pinned to never derive a closed window, because `playRx` reads
  `speedAllowed` for every reaction.
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

## The sync layer — two phones, one game (Phase B)

`ROADMAP-MULTIPLAYER.md` Phase B steps 7 and 8, built **headless**: three
modules, 72 drills, and **not one line loaded by `index.html`**. Nothing in
the trainer calls them yet and no UI exists for them. `test/wire.test.js`
holds that as a ledger — every `engine/*.js` file is either in index.html's
script tags or in its `HEADLESS` list, so wiring one up without also adding
it to `test/sync.test.js`'s `MODULES` fails a drill by name.

| module | job |
|---|---|
| `engine/wire.js` | the game as one JSON object, and the fingerprint that proves two phones agree |
| `engine/net.js` | the session: handshake, sequencing, desync detection, resync, reconnect |
| `engine/actions.js` | six **blank** actions — a reference reducer with no cards in it |

### The transport: WebRTC, and why the module names neither

**GitHub Pages serves static files. There is nothing there to terminate a
WebSocket.** A `ws://` transport is not a different library, it is a backend
to build, pay for and keep awake — which is Phase C's job. WebRTC
DataChannel over a CDN-loaded P2P lib (Trystero, PeerJS) gets two phones
talking with a room code and no backend at all. Configure it **reliable and
ordered**: a turn-based game wants correctness, not latency, and `net.js`
treats a sequence gap as a dead channel rather than reassembling.

`net.js` mentions neither. It takes a `send` function and exposes `receive`;
that is the whole transport contract. `loopback()` (in-memory, with `drop`
and `delay` controls) is what the drills run on, and `wsAdapter` is Phase C's
adapter written now so the seam is proven rather than promised. A drill
scans the module — comments stripped — and fails if any transport name
appears in the code.

### Priority is the lock — except in exactly one step

Both peers run the same reducer over the same ordered log from the same
seed, which needs a **total order** on actions. The rules very nearly supply
one for free: only the priority holder may act, so there is normally nothing
to arbitrate.

**Except the defend step.** CR 7.3.2 makes declaring defenders free and
simultaneous, and CR 7.3.3 gives the *turn-player* a priority window in that
same step. So there, and only there, both seats can legally act at the same
instant. That is why one peer is the **sequencer**: it assigns the order and
nothing else. It is deliberately **not** authoritative over outcomes — both
peers run the identical reducer and both verify the result — which is what
keeps Phase C's move to a real server a *relocation of the sequencer* rather
than a client rewrite.

**No client-side prediction.** The guest waits for the commit. Prediction
buys ~100ms on a turn-based game and costs rollback.

**The drill for this has to assert PREVENTION, not recovery**, and it did not
at first. A guest that applies optimistically diverges in the defend race,
gets caught by the hash on the next commit, and is snapped back into line —
so the end states agree and a naive test goes green having proved nothing.
It now pins `desyncs === 0 && resyncs === 0`, and reintroducing the
optimistic apply makes it fail.

### What goes on the wire

Cards are **interned**, not repeated: `[dictIndex, overrides, deletions?]`,
where the overrides are exactly the fields that differ from the dictionary
entry — found by **structural diff**, not by a hardcoded field list. That is
where `uid` lives, and `_gy`, and gear's `curDef`/`destroyed`, and the
arsenal's `_faceUp`/`_arsPow` stamps. **`wire.js` reads no card text at
all**, which is what makes it survive the next parser change: a card that
grows a field ships it automatically.

With a **catalog** (`name|pitch` -> definition, i.e. the loader's own cache)
definitions do not travel and the payload drops by roughly 10x. That is also
the hazard, so it is pinned: `catalogHash` rides in the payload and `decode`
refuses a mismatch. **Two clients on different `DATA_VER` must be refused at
the handshake, not discovered on turn six.**

`decode` also refuses a wrong `WIRE_V`, a bare key with no catalog, and a
payload whose rebuild does not match the sender's fingerprint. Four
refusals, four silent desyncs that cannot happen.

### THE HASH IGNORES THE LOG, AND THAT IS NOT AN OVERSIGHT

`hash` fingerprints the **rules** state. The exclusions are load-bearing:

| excluded | why |
|---|---|
| `log`, `feed` | **the taunts are `Math.random` on purpose.** Two honest peers are *guaranteed* to differ here, so hashing them reports a desync on every single action |
| `inspect`, `boostOn` | per-client UI toggles — one player using inspect mode is not a divergence |
| `img`, `dbImg`, `prs` | art URLs: presentation, and catalog-derived anyway |

Everything else is in, `rng` included — `rng.n` is the desync canary rng.js
already names.

`JSON.stringify` cannot be the fingerprint: it preserves insertion order, so
a peer that rebuilt from a snapshot would hash differently from one that
reached the same game through the reducer, and **every reconnect would look
like a desync**. Keys are sorted and strings are length-prefixed, so no
amount of punctuation in a card's rules text can forge a structural boundary.

### `diffPaths` is the reason a desync is a five-minute fix

The roadmap: *"silent desync is the characteristic failure of lockstep
netcode and it is miserable to debug after the fact."* So when the hash
mismatches, the session keeps the state it no longer trusts, diffs it
against the snapshot that repairs it, and reports **`/sides/1/grave/0/uid`**
rather than two hex strings.

### Repair: cheap first, and `force` beats cheap

A peer that **missed** actions is sent those actions from the sequencer's
journal (~100 bytes). A peer that has **diverged** cannot be: replaying the
same log over the same wrong state reproduces the same wrong answer, and it
is already level on `seq`, so every cheap test concludes it needs nothing.
That was a real infinite repair loop — the diverged peer asked, got a
replay, failed identically, asked again. **`force` is therefore checked
first in the RESYNC handler**, before the journal branch, and a drill bites
if that ordering is undone.

### The blank actions

`pitch · pass · attack · defend · roll · endTurn`, over cards with `tx: ""`
and no keywords. **Not one card from the pool is touched**, and there is a
drill that reads every card in a match and fails on any rules text, plus one
that fails if `actions.js` ever imports the parser. A transport failure and
a card being read wrong must never be confusable.

It is a **real driver of `priority.js`** — every priority decision comes from
calling that module, nothing is restated. It is **not** the game's rules:
damage is `power - defence`, a pitch is free, and there is no cost payment.
When `judge.js` lands (Phase B step 6) it replaces this reducer wholesale;
`net.js` takes `reduce` as a parameter for exactly that reason.

**The close step is not a deadlock, and it was.** CR 7.7.1 gives nobody
priority in the close step, so **no player action can drive it** — a settle
loop that waits for a pass parks the game in a step neither seat can leave.
`priority.js` already says so (`advance` is the one step it lets through
without checking `windowClosed`); the caller has to honour it.

**Every card must land in a zone.** `invariants.js` catches a card in *two*
zones; a card in *none* just falls out of the census and is invisible to it.
So the chain's cards are filed to the graveyard at close, turn-stamped, and
a drill counts cards before and after.

### The table — `engine/room.js` and the Find opponent screen

**Wired and played across two clients over the real public relay.** The
sync layer is no longer headless: all four modules are in index.html's
script tags and in `test/sync.test.js`'s `MODULES`. As of v2.49
`judge.js`, `types.js` and `lobby.js` join them, so `wire.test.js`'s
`HEADLESS` list is **`["sparring"]`** — the policy stays off the page
because nothing calls it, and a thing that proposes actions sitting next
to a trainer with its own dummy is the second-quiet-engine hazard that
list exists to name.

**ONE CHANNEL, TWO PROTOCOLS.** The lobby and `net.js` both name a
message `hello`, so every frame is tagged `{ch:"lobby"|"net", m}` and
demuxed in `TableRoom`. An undemuxed channel hands each module the
other's handshake, and the failure reads as a transport bug rather than a
naming one.

**The net session cannot exist until the lobby readies, and the guest's
HELLO can beat it.** Both peers reach `ready` off the same message, but
one phone's React effect runs first — so `TableRoom` holds net frames in
a queue and `TableBoard` flushes them when it creates the session. Same
fix `room.js` already makes one layer down for its own sink.

`room.js` is **the only file in the engine that knows a network exists.**
It uses **PeerJS**, not Trystero, for one reason: PeerJS ships a UMD build
that loads with a plain `<script src>`, and Trystero is ESM-only, which
would mean `type="module"` and no `file://`. It is loaded **lazily**, on
the first tap of *Find an opponent*, so a `file://` page and the solo
trainer pay nothing for it.

**The table number falls out of PeerJS's model rather than being bolted
on.** A peer may claim a chosen id, so the host claims the table's id and
the guest dials it — which makes "that table is taken" and "nobody is
sitting there" real answers from the relay instead of states we invent.

Two things that are not optional:

- **The peer id is namespaced** (`dawnblade-v1-<CODE>`). The public relay
  is shared with every other PeerJS app in the world; an unqualified "42"
  would collide with a stranger's project and look like our bug.
- **The channel is opened `{reliable:true}`.** PeerJS does not default to
  it, and `net.js` treats a sequence gap as a dead channel rather than
  reassembling — an unordered channel would resync in a loop.

**The table code is the match seed** (`newMatch({seed: code})`), which is
rng.js's own stated goal: both peers derive the same seed from the same
room code without exchanging it.

**The message sink is replaceable and it buffers.** The channel opens
before there is a `net.js` session to feed, because the session needs the
`send` the channel provides — the ordering is unavoidable. Anything
arriving in that gap is held and flushed on `listen`, or the handshake is
dropped and the guest sits on "connecting" with no error to show.

**A third phone is turned away**, before its channel opens. A second guest
would become a second actor whose intents the sequencer would happily
interleave into somebody else's match.

**`mySeat`, never `seat`, in the trainer.** `priority.js` exports a `seat`
helper meaning "seat a game"; a local `seat` meaning "which chair is this
client in" is the same-name-different-meaning trap — `test/sync.test.js`
caught it on the first run of this build, exactly as it caught `tapTwice`'s
`act` in v2.25.

### THE LOBBY — `engine/lobby.js` and the four agreements (v2.49)

Between "two phones have a channel" and "two phones have a game" there
are four things to agree on, and until v2.49 there were none: the screen
connected and dropped straight into `actions.js`'s blank decks.

```
connect -> hero -> throw -> sideboard -> game
```

**IT IS NOT `net.js`, AND THE REASON IS THE WHOLE DESIGN.** `net.js`
needs a sequencer because CR 7.3.2 makes declaring defenders free and
simultaneous, so in the defend step both seats can legally act at the
same instant and somebody must assign an order. **Nothing in a lobby has
that problem.** Every message writes only its own seat's slot, and every
slot is **WRITE-ONCE** — so the reducer is a monotone accumulator: the
writes commute, a replay is refused, and two peers applying the same
messages in different orders land in the same state. No sequencer, no
journal, no sequence number. `test/lobby.test.js` enumerates all 16
interleavings and asserts one outcome rather than trusting the argument.

**Write-once is load-bearing, not fussiness.** Make a hero pick
overwritable and this diverges: seat 0 changes its mind at the same
moment seat 1 confirms, so seat 0 applies the change locally while it is
still choosing and seat 1 refuses it for arriving after the step closed.
Two phones, two heroes, **no error anywhere**. The UI holds the
unconfirmed pick in local state and sends nothing until a seat commits.

**The step is DERIVED (`stepOf`), never stored.** A stored step is a
transition, a transition has an order, and an order is the thing this
module is built not to need.

**The card-data check belongs HERE, before a hero is chosen.** `net.js`
compares builds at its handshake too, but by then both peers have already
dealt two decks from the same spec — and if the databases differ those
decks differ *silently and consistently*, which is the one failure a
state hash cannot describe usefully. A skew faults the lobby, identically
on both phones.

It **reads no card text and resolves no card**, drilled — same discipline
that keeps `actions.js` free of the parser and `sparring.js` free of
`fxParse`. A negotiation bug and a card being read wrong must never be
confusable. The caller builds the decks.

### `build.buildMatch` — two seats, one spec, two phones

Nothing about a card crosses the wire. The lobby ships two hero keys, two
loadouts, a seating call and the table code; each peer runs `build.js`
over its **own** database and arrives at an identical state. Three things
make that deterministic, and each is a real way to break it:

1. **the stream is SEAT-SPECIFIC** (`buildSeed(code, i)`). One stream for
   both seats is reproducible and still wrong — it makes seat 1's deck
   the continuation of seat 0's, so a change to seat 0's cuts reshuffles
   seat 1.
2. **the uid counter is SHARED and threaded in seat order**, so no card
   in the match repeats a uid. A repeat is `CARD-IN-TWO-ZONES` wearing a
   disguise — the census works by uid. The cost is that a cut on one seat
   renumbers the other's; that is invisible to both peers and pinned in
   both directions so neither half can be "fixed" without a decision.
3. **the seats are built in INDEX order, never the local client's.** A
   build order derived from who is hosting produces two different games
   from one spec, visible only as a turn-one hash mismatch. Drilled by
   reading the source for `host`/`mySeat`.

### THE SNAPSHOT HAS TO FIT DOWN THE PIPE (v2.49)

**The bug no drill in this project could see, found by opening two
browsers.** The opening snapshot measured **97KB**; a WebRTC data channel
drops a message that size **with no error at either end**; and the guest
then sat in `handshaking` forever holding a board that looked perfectly
correct — because it had built the same opening itself from the lobby
spec. All 765 drills passed. "Correct but too big to send" is not a shape
any of them ask about.

| what was wrong | cost |
|---|---|
| `newMatch` retained the build's `deck`/`gear` — **construction inputs**, already dealt into `sides`, so the same 43 cards were in the game twice | 62KB of 67KB |
| the session was given no **catalog**, so every card shipped its full definition rather than a bare `name\|pitch` key | the rest |

Worst case over all 225 matchups is now **13.7KB**, and
`test/table.test.js` pins a **16KB budget**. What a build is kept *for*
is the printed passives a rules site reads through `bAct`; those stay,
and a drill asserts they survived the strip.

**A handshake that stalls now says so on screen.** The failure was
invisible precisely because every visible thing was right, so the
session's status is polled onto the board and `window.__dawnTable.report()`
gives status, seq, hash and counters on either phone — the same reasoning
as JUDGE!! in the trainer.

### THE TABLE IS THE TRAINER'S BOARD (v2.50)

The table renders the same three flick screens, armour grid, hero row,
hand rail, two-tap peek and action bar as solo play. That is not polish:
**in a training sim the layout is the lesson**, and a player who learns
on one board and then sits at a debug panel learns the game twice.

**Drawing a seat twice is the no-mirror rule one layer up.** These are
pure, props-only, and BOTH boards render them — the trainer was migrated
onto them in the same pass and verified byte-identical against the
deployed build:

| component | what |
|---|---|
| `ArmorGrid({gear, cell})` | four slots, the empty-slot skeleton and the grid areas; `cell` supplies the occupied tile so each board keeps its own tap |
| `DeckPitchCol({deck, pitch, title, hidden})` | deck back + pitch list; `hidden` shows a pile's SIZE and not its contents |
| `InPlayRow({entries, chips, cell, empty})` | the arena |
| `GravePane({sd, who})` | graveyard / banish / soul |
| `usePeek(resetKey, inspect, onInspect)` | the two-tap peek, with the stale-peek drop. **TABLE ONLY — `Battle` still has its own `peek` state and its own `tapTwice`** |
| `PeekDock({card, verb, onClose})` | the docked preview: the `pointer-events:none` wrapper AND the `--peekbot` measurement that keeps it off the rail |

**THIS TABLE WAS PARTLY FICTION UNTIL v2.52, AND IT COST A BUG.** `PeekDock`
was listed as shared while `Battle` rendered a hand-copied duplicate of its
markup — so the measurement that positions it was added to one board and not
the other, and the table's preview sat on top of its own hand rail. `Battle`
now renders the component. **`usePeek` is still not shared**, and it is written
down as not shared rather than aspired to: `Battle` keeps its own `peek` state
and its own `tapTwice` (which reads `g.inspect` and zooms differently). A row
in this table is a claim about the source; check it before trusting it.

**WHAT IS NOT SHARED IS THE STATE LANGUAGE.** The trainer speaks
`mode`/`bphase`; the table speaks `phase`/`step`/`priority` out of
`priority.js`. Those are the two things the Phase 1 rebuild exists to
separate — sharing a few more lines of JSX by folding them back together
would undo it.

**THE ADVISOR IS AT THE TABLE AS OF v2.83**, and the reason it was not
is worth keeping because the shape recurs. This section used to say it
"would coach card text that does not resolve here" — false since v2.77.
What was actually missing was the **window**:

> `advise` read `g.mode`. **judge.js seeds `mode` into its opening state
> and never writes it again**, so a table game carries `mode:"act"` from
> the first draw to the last point of life. The advisor would therefore
> not FAIL — it would coach, confidently, off a frozen field, in every
> step of every turn. Sev-2, the category the player TRUSTS.

`advisor.advView(g, seat)` derives the window from the CR machine and
asks `priority.js` for `canDeclareDefenders` rather than restating it.
**Both boards pass the window explicitly and `advise` REFUSES without
one** — a fallback to `g.mode` relocates the silent wrongness rather
than removing it. `incoming` comes off `pend.total` for the same reason:
judge never writes `g.incoming` either.

**Local sessions and seat 0 only**, both stated in the source: `advise`
reads its own hand through `you(g)` = `sides[0]`, so deriving the window
for seat 1 would coach the wrong player's hand. Across a network the
seat opposite is a PERSON, and `advCardOut` prices your line against
their gear and hand — turn it on for a person only as a deliberate call.

**A LOCAL WIN SCORES AND PULLS A TROPHY (v2.83).** `WinPanel` stays out
of a *networked* game — "a trophy handed out for beating a person would
quietly devalue the case" — but v2.81 changed who sits opposite: a seat
the dummy fills is always the vanilla pile, so a local win is over the
same punching bag, scored the same way (`turn + wasted`, and `wasted`
has been kept for both seats since `priority.endTurn` fizzled both).

**BOOST IS AT THE TABLE AS OF v2.84** — judge asks the additional cost,
`effects.js` already resolved it, and `parser.printedKw` keeps a card
that only MENTIONS boost from being offered it. What stays trainer-only
is the boost TOGGLE (a UI affordance, not a rule) and the **next-swing
prediction**, which reads the `[3,4,5]` fabrication — a card-playing seat
has no such number, so it is dropped rather than ported.

**A DEAD BUTTON READS AS A BROKEN SCREEN, NOT AS A RULE.** CR 7.3.3 gives
the turn-player priority in the defend step while the defender declares,
so the defender genuinely cannot pass until the attacker has. A greyed
"Done defending" looks like a bug; the bar says *"declare your blockers —
{them} still holds priority"* instead. Same reasoning as naming a refusal
rather than dead-tapping.

**`gearDef` returns 0 for a piece that prints no defence**, so passing it
straight to `CardFrame` paints a blue `0` on every sword. Ask whether the
piece has a printed or current defence at all — `gearBtn` always did.

**`WinPanel` is deliberately NOT reused at the table.** It says "DUMMY
DESTROYED" and pulls a random trophy; a trophy handed out for beating a
person would quietly devalue the case.

### What the table does NOT do yet, and why

**CARD TEXT DOES NOT RESOLVE.** Worth stating plainly because the screen
looks finished:

**CARD TEXT RESOLVES AT THE TABLE AS OF v2.77.** The paragraph that used
to sit here said it did not, and that was true for three versions. The
table now calls `engine/effects.js` — the one copy of the semantics —
through `judge.js`, which supplies the context and adds none of its own.
Prompts are answerable there too (v2.78), which matters because several
cards defer their whole payload into the answer.

`Battle` is untouched by all of it and remains the regression harness.
Its retirement gate — those five drills passing while driving
`judge.reduce` — **is met as of v2.80**; what still stands between here
and deleting anything is `Battle`'s 97 `mode`/`bphase` references.

`foeSwing`'s `[3,4,5][(turn-1)%3]` escalation still drives the **solo**
dummy. It is untouched here and is retired by step 3 of the remaining
order, together with the rest of `Battle`'s combat closures.

### Known limitation, stated honestly

**Both peers hold full state, including the opponent's hand.** That is
`ROADMAP-MULTIPLAYER.md` fact 4's deliberate Phase B position — the social
contract does the work between friends — and it is not fixable by redaction
here, because a peer that cannot see the state cannot run the reducer.
Hidden information needs Phase C's authoritative server. Do not present the
current layer as cheat-resistant.

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

**A FULL-WIDTH OVERLAY MUST NOT TAKE POINTER EVENTS (v2.36).** `.peekwrap` is
fixed, full width and mostly empty; with `pointer-events:auto` that empty space
covered the hand rail on a **393x852 phone**, so the second tap hit the
wrapper's dismiss handler instead of the card and **no card in hand could be
played**. It is invisible on a tall window, which is why it survived so long.
The rule is `pointer-events:none` on the wrapper and `auto` on its children.
**And it must sit ABOVE the rail, not over it (v2.37)** — not eating the tap is
not the same as not hiding the cards. `--peekbot` is measured off the live rail;
a hardcoded offset was wrong the moment the layout changed, which is exactly how
this shipped.
**Test at phone dimensions, not a tall desktop window** — this class of bug
only exists there.

**THE MEASUREMENT BELONGS TO `PeekDock`, NOT TO A BOARD (v2.52).** It sat in a
`uE` inside `Battle`, and the table — which renders the same component — never
ran it, so its dock fell back to the CSS's flat `112px`. On the hand screen at
393x852 the rail spans y 628..754 and the right offset is **233px**; at 112px
the preview lands *inside* the rail, and `.peekwrap>*`'s pointer events (v2.36's
own fix) then hand the tap to the wrapper's dismiss handler. The card un-peeks
and nothing happens — reported from a real table as *"pitching from the 3rd/4th
card silently does nothing"*.

**The mirror was the defect.** `Battle` rendered a hand-copied duplicate of the
dock's markup rather than the shared component, which is how the positioning
came to exist in one and not the other with nothing watching. Same rule as the
engine's, one layer up: **one `.peekwrap` in the file, both boards render
`PeekDock`**, and a drill pins both counts.

**It is TRACKED per frame, not sampled once.** The rail is still moving when the
tap that opens the preview lands — measured in that tick the offset came out
146px against a rail that settled at 628. A scroll listener does not cover it
and this was tried: **the rail slid 86px with `scrollTop` unchanged**, moved by
content above it settling. There is no provably complete list of events that
move it, so while the preview is open it re-measures every frame and writes only
on change; a rail that has flicked off screen returns to the flat clearance
rather than being chased off the top of the viewport. (`requestAnimationFrame`
does not run in a hidden tab, so verifying this in a background browser pane
needs a forced frame — a screenshot will do it.)

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

## Printings — every card wears its Silver Age face (v2.35)

> **A GUARD THAT PINS AN ANOMALY LEGITIMISES IT (v3.13).** `printings.test.js`
> asserted exactly ONE non-Silver-Age card and named it — Enigma Chimera at
> pitch 2, "the single genuine exception". Accurate, and it was a SYMPTOM:
> SEN prints Chimera at red (SEN010) and blue (SEN021) and never at yellow,
> so the card was a **deck-list transcription error** displacing two blue
> copies. The deck still totalled 55, so every count-based check passed.
>
> **Reported by a player checking fabrary — no tool here could find it.**
> (v3.14 gave it partial coverage: `decks.test.js` now diffs every list
> against its hero's own set in both directions — a card at a pitch the set
> never printed, and a set card absent from its deck. Partial because a
> precon legitimately holds shared cards from OTHER Silver Age sets, so it
> can only speak about the hero's own. Still not a substitute for the
> printed product.)
> The audit reads card text, the fairness sweep compares a card to its own
> printing, `decks.test.js` counts to 55; a wrong card of the right count is
> invisible to all three. The only oracle for "is this the RIGHT card" is the
> printed product. The floor is zero exceptions now, and it bites.

`resolveEntry` used to fall back to `pr._first`, which is whatever printing the
card database listed first — arbitrary order, not a choice. An Azalea deck
showed GEM, 1HP, PEN and DDD art side by side.

`cards.js pickPrinting` resolves in this order, and each step earns its place:

1. **an explicit code on the deck entry** — the author's deliberate choice, and
   it wins even when the database has no record of that printing (the
   constructed CDN path is then the answer). This is what keeps the
   **Dawnblade** on `MPW156-MV`. Before the precedence fix it silently reverted
   to SDO002 — the choice overridden without a word.
2. **this hero's own Silver Age set**, read off its printed code (`SAZ001` →
   `SAZ`). 467 of 503 deck entries land here.
3. **any Silver Age set** — shared cards not printed in this hero's precon.
4. **`_first`** — the honest last resort. Exactly one card reaches it: Enigma
   Chimera at pitch 2 has no Silver Age printing at all, and inventing one
   would be inventing a card face that does not exist.

**The Dawnblade is the only Marvel card in the pool, and a drill enforces it.**
`mapDbCard` carries `prs` (one image per set, first printing per set wins since
foiling and art variations share a URL) — and the loader in `index.html`
mirrors it, so **change both**. Bump `DATA_VER` when you do.

## Rules fidelity

This is a rules-accurate sim, judged to pro-tour standards. Combat follows the
Comprehensive Rules: Attack → Defend → Reaction → Damage → Resolution.

### The turn structure, against the CR (v2.35)

Grounded against `rules.fabtcg.com/en/cr/04-game-structure/`. **CR 4.4.3 is an
ORDERED procedure and the order is load-bearing.** The trainer ran `e → c → b
→ f` with two steps missing entirely:

| CR 4.4.3 | step | before v2.35 |
|---|---|---|
| a | all allies' life resets to base | **never happened anywhere** — `resetAllyLife` was exported, bridged, and called by nothing |
| b | turn-player may arsenal | ran *after* (c) |
| c | pitch zones to the bottom of their decks | ran *before* (b) |
| d | turn-player untaps all permanents | folded into the *next* turn's setup |
| e | **ALL players** lose action and resource points | only the turn-player |
| f | turn-player draws to intellect | ✓ |

(d) and (e) are invisible while one seat acts and are **real two-player bugs**
the moment a second seat has a turn between yours: a permanent would stay
tapped through the opponent's turn, and a hero who banks a resource during your
turn would keep it.

Each step is marked `CR 4.4.3<letter> —` in `endTurn`/`afterArsenal` and a
drill asserts they appear **in that order**. Reordering them is a rules change,
so it must be a deliberate edit to that drill.

**The action point is issued at the beginning of the ACTION phase** (CR 4.3.2),
behind a real start phase (CR 4.2) where nobody holds priority (CR 4.2.1).

**The arsenal set is an END-PHASE step, not an action.** `fromTrainer` mapped
`mode:"arsenal"` to the action phase with the player holding priority, which
CR 4.4.1 forbids — and which `PRIORITY-IN-CLOSED-PHASE` could never catch while
the mapping itself said otherwise. A guard cannot fire against a derivation
that disagrees with it.

**Every end-phase step announces itself in the log, including when it does
nothing.** In a training sim the sequence *is* the lesson.

### Activating a card in the arena (v2.35)

Gear has carried a `powCard` for a long time; a permanent on the board never
did, so the board's `onClick` opened the zoom modal for anything that was not
an ally and **Energy Potion** and **Timesnap Potion** (both "Destroy this: …")
were decoration. `boardPow(b)` builds one lazily, keyed `"bp"+uid` so it cannot
collide with gear's `"gp"+uid`, and `execute` pays the destroy cost into the
turn-stamped graveyard. **`peekables()` must include it** or the preview
silently fails while the tap still arms.

Allies keep `allySwing`: their attacks are costed (`{r}`, `{t}`) and belong
with the attack-target wiring (CR 1.4.5), which is a bigger job.

### A reaction belongs to the reaction step, and to ONE SEAT in it (v2.40)

| CR | |
|---|---|
| 8.1.2a | an attack reaction "can only be played/activated by a player who **controls the attack** during the Reaction Step of combat" |
| 8.1.3a | a defense reaction "can only be played/activated by a player who **controls a hero as an attack-target** during the Reaction Step" |

**The reaction step is TWO windows, not one.** `engine/priority.js`'s
`speedAllowed` has split them by attacker since v2.27 — that is the *seat* half
of the rule and it was already right. `DawnParser.rxAllowed(card, window)` is
the *card* half, and it did not exist:

```js
rxAllowed(c, "attack-reaction")   // isAR(c) || a scripted instant
rxAllowed(c, "defense-reaction")  // isDR(c) || a scripted instant
```

Three things were wrong before it:

1. **`tryPlay` accepted a reaction in the ACTION phase — 23 pool cards.** It
   only asked whether `fxParse` found something playable and never read the
   printed type. Reduce to Runechant minted a runechant on your own turn; the
   Warrior reprise attack reactions fired with no attack to react to. Sev-3
   *illegal play allowed* — the player wins games they should lose.
2. **The attack window admitted any non-attack with a pump**
   (`!isAttack(c) && fx.self>0`), which let three plain **Action** cards —
   Flying High, Hit and Run, Cutty Shark — into the reaction step.
3. **Five hand-rolled copies of the same test** (`playRx`, `playRxA`,
   `handAct`, `handCell`'s dim, `playables`' arsenal row). **The dim drifting
   from `playRx` is a card that looks playable and does nothing when tapped**,
   which is the failure mode this codebase cares most about. All five now ask
   `rxAllowed`, and `fx.dr` is `isDR`'s answer rather than a second regex.

**The one line in `rxAllowed` that is not a citation** is `fx.ops.length > 0` on
the instant branch: an instant the parser reads nothing from would arm the tap
and then do nothing. That is a trainer decision about dead taps, not a rule, and
it is commented as such.

Refusals **name the window** in both directions rather than dead-tapping, and
`advisor.js` no longer offers a reaction as an action-phase candidate — coaching
a play the game then refuses is worse than not coaching it.

### The action point is an ACTION's cost, not a per-play tax (v2.39)

**An instant costs no action point, and until v2.39 every one of them ate the
turn's action.** Reported from the table. Three CR rules, and the engine now
states them in exactly one place — `DawnParser.costsAP`:

| CR | |
|---|---|
| 8.1.1 | "An action card/activated ability has the additional asset-cost of one action point to play/activate." |
| 8.1.6 | an instant "can be played/activated any time the player has priority" — **no such cost** |
| 5.3.5 | "If the layer has go again, the controlling player **gains** 1 action point." |

Two sites were hand-rolling the answer: `tryPlay` refused *any* play at 0
action points, and `execute` settled every non-attack with `ga ? keep : -1`.
Energy Potion ("Instant - Destroy this: Gain {r}{r}") therefore spent your
action to gain two resources, and Achilles Accelerator ("Instant - Destroy
this: **Gain 1 action point**") netted to zero — the equipment did nothing at
all. 24 instant cards and 26 "Instant - …" abilities are in the pool.

**Coverage cannot see this class of bug and neither can the fairness sweep.**
Every affected card reads tier `full`: the text was read correctly and then
*charged* wrongly. The sweep is deliberately one-sided (stronger-than-printed
only), and this was a card being **weaker** than printed.

The arithmetic is deliberately spelled out rather than folded back into a
ternary, because **go again is a GAIN, not a refund**:

```js
const apCost = costsAP(card) ? 1 : 0;
actMut(n).ap = act(n).ap - apCost + (ga ? 1 : 0);
```

For an action that is spend-then-gain — the familiar "kept", identical
arithmetic to before. For an instant it is a genuine **+1** (CR 5.3.5), which
no `keep`-shaped expression can say.

**THE DOUBLE-FACED TYPE LINE IS WHAT KEPT THE FIX HONEST.** `isInstantT` tested
the whole printed line, and both pool DFCs print *"Runeblade Action // Earth
Instant"* — so `Arcane Seeds // Life` and `Burn Up // Shock` read as instants.
You play the **front** face; the back is reachable only by melding. Exempting
them would have handed two real action cards a free action point: strictly
stronger than printed, which is the direction that steals games. `frontFace`
splits on `//` and `isAR` reads it too, for the same reason. When a helper
answers a question about *the card you are playing*, ask it of the front face.

`advisor.js` no longer returns "End turn — action point spent." the moment the
point is gone; it filters its candidates to what is still legal (instants, plus
the ally swing the trainer models as free and says so in the log).

### Pitching is on demand, never proactive

**Ruling (user, 2026-08-01):** you cannot pitch to bank resources. The pool is
filled only when an activation costs more than you hold — and then you are
given the chance to pitch **or to cancel the activation**. Resources in the
pool are spent first, and whatever is left clears in the end phase (CR 4.4.3e).
`tryPlay` → `mode:"pay"` → `confirmPay`/`cancelPay` is that flow, and every
activation route must go through it: cards, weapon swings, equipment abilities
and now arena abilities.

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

**FROSTBITE FOLLOWED IT IN v2.74** — same move, same reason, and the same
blindness beforehand: it was an integer `frost` on the side that NOTHING read
(not `effCost`, not effects.js), written by one hardcoded line in `foeTurnIce`,
so Frost Spike's "create a Frostbite token" resolved to nothing at all. It is
`parser.frostCount` off the board now, the tax lives in `effCost`, and the two
expiries — on any play or activation, and at the beginning of the controller's
end phase — are `execute` and `DawnEffects.thawFrost`.

**THEY ARE ALL BOARD AURAS AS OF v3.09.** Bloodrot Pox and Frailty were the
last two counters, and the note that used to sit here — "nothing in the pool
counts them as auras yet" — was the wrong test. Both print `Generic Token -
Aura`; the question is what the CARD says, not what another card asks about
it. Nine pool cards create them across three heroes, and every one says
"under their control", so **the token sits with the hero it hurts.**

Most of what building them took was DELETING the two parser lines that
intercepted them: the generic token rule underneath already routes the side
correctly. The counters were the thing taking the token's place.

Both were also wrong in the direction that steals games, and RULING (user,
2026-08-19) was to build both to print:

| | the counter did | the card prints |
|---|---|---|
| `fra` | a blanket −1 to ANY incoming swing | −1 to attack actions played **from arsenal** and to **weapon** attacks. From hand is untouched |
| `rot` | an unavoidable, **never-expiring** per-turn drain | a ONE-SHOT at your end phase, and you may pay `{r}{r}{r}` to shrug it off |

`fra` was never once SET in a real game — its only source, Frailty Trap, read
`none` until v3.08 — so the storage convention it used was untested rather
than settled, which is why replacing it cost nothing.

**A PAYMENT WITH NO WINDOW TO PAUSE IN RESOLVES INLINE.** CR 4.4.1 gives
nobody priority in the end phase, and `openPrompt` drains at the tail of
`execute`, which the end phase never calls — so a queued prompt there is
**silently** never shown. The first build of Bloodrot did exactly that: the
feed said "it pays out as it goes" and no damage landed. `selfPayOr` pays
from **floating resources only** and never pitches on the player's behalf:
three cards for 2 life is usually a losing trade, and a training sim that
quietly makes it is teaching bad play. Floating resources fizzle at CR
4.4.3e anyway, so spending them costs nothing the player was keeping.

**`selfPayOr` is not `payOr`.** `payOr` is Cold Snap's shape ("target hero
may pay") and bills `1-actorOf(n)`; this bills the actor. Same self/foe
pairing `selfDiscard`/`foeDiscard` keep, and mixing them up hands the bill
to the wrong player behind a plausible-looking prompt.

---

## Attack targets (CR 1.4.5) — wired in `judge.js` (v2.45), trainer NOT (v2.23)

> **`engine/judge.js` now declares, validates and resolves attack-targets**
> — see "THE CR REVIEW" above. The section below describes the original
> `game.js` groundwork and the TRAINER's remaining wiring, which is still
> outstanding: `execute` declares the attack and calls `dummyDefence` in
> one pass, so a target choice has to land before that.

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

**Written by `engine/report.js`, and BOTH boards produce one** (v2.51). It
was a closure inside `Battle`, which meant the table could not report at
all — the screen where a bug is hardest to reconstruct, because there are
two boards and the first question is which one is wrong. A table report
carries the seat, the table code and net.js's counters, so *"two peers on
different hashes at the same `seq`"* is a desync stated in one line.

**When adding a zone or a per-side field, add it to `report.js`'s `seat()`
too** — a report that silently omits state is worse than no report.
`test/report.test.js` pins the properties that make one useful: it never
throws (least obvious and most important — a report that dies describing a
broken board fails on exactly the board you needed), the replay key
survives, every zone is named rather than counted, and it serializes.

**THE CLIPBOARD IS A PERMISSION, AND IT IS OFTEN DENIED.**
`navigator.clipboard.writeText` rejects with `NotAllowedError` even on a
real tap in a secure context with the document focused — verified on the
deployed site. The old code had no fallback and dead-ended at *"copy
failed — use Download"*; worse, its `else` branch reported SUCCESS when
the API was absent entirely. `copyText` now tries the async API, falls
back to `execCommand` (which needs no permission), and if both fail says
so in red. **Never dress a failed copy as a success.**

**EVERY GAME CARRIES BOTH STATE VOCABULARIES**, so neither being present
says which engine is driving: `makeGame` seeds `mode`/`bphase` into
judge's state too, and the trainer has carried a derived `phase`/`step`
since v2.27's shadow. `machine.lang` names the authoritative one — without
it a table report showing `bphase:"defend"` sends the reader into the
trainer hunting a bug that is not there.

**AND THE SEEDED HALF IS FROZEN, WHICH IS WORSE THAN ABSENT (v2.83).**
`judge.js` seeds `mode`/`bphase` and then **never writes them again** —
so any consumer that reads `mode` off a judge state gets `"act"` for the
whole game. A field that is missing throws and gets fixed in a minute; a
field that is *present, plausible and never updated* reads as an answer.
The advisor was one line from shipping exactly that. **When you reach for
a state field at the table, check which engine maintains it**, and pass
it in rather than sniffing — `advisor.advView` is the worked example, and
`advise` refuses outright when it is not told.

`g.incoming` is the same trap without the disguise: judge never writes it
at all, and the table's incoming damage is `g.pend.total`.

### A LOG LINE IS READ BY BOTH SEATS; A REFUSAL IS NOT (v2.83)

Found by playing, not by a drill — the dummy's own payment appeared in
the shared feed as *"Brutal Assault costs 2 and **you** hold 0"*.

```
say(...)         -> feed, which BOTH seats read      -> NAME the seat
return "reason"  -> back to whoever attempted it     -> "you" is correct
```

It never mattered while seat 1 paid no costs; it has been wrong since
v2.71 gave that seat a real action phase. In judge.js 11 refusals were
already right and 3 log lines were not. **`engine/effects.js` still has
44 second-person literals** — a real share of them refusals — and that
is a pinned ledger in `test/judge.test.js`, not a clean bill.

**The ledger pins the SOURCE COUNT, not a driven feed's.** The driven
count is emergent (3 on one seed, 4 on the next), and pinning a sample
turns every honest card fix into a red drill.

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
  **`parser.defCap` is the one reader of that limit as of v3.64**, and it is
  enforced on both boards — `judge.legal` mentioned dominate nowhere at all
  before then. The hand-card reading is RECORDED rather than derived (the
  database prints no reminder text for any keyword), so changing it is a
  ruling. Confidence's *"no more than 2 non-block cards"* is the same reader's
  other source and counts a DIFFERENT set — equipment is not a Block card.
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
  it (confirmed from the printed reminder text, not guessed). **A tie counts as no
  winner — CONFIRMED (user, 2026-08-19)**, so this is settled rather than assumed.
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
- **The "handed to the dummy, therefore idle" note is RETIRED (v2.74).** It was
  true of a prop that paid no costs and took no action phase; seat 1 has had both
  since v2.71, and the log line that said so was deleted along with it. Runechant
  and Frostbite are real board auras; Bloodrot and Frailty keep their dedicated
  counters. **Inertia is still a `noop`** and its stated reason ("the dummy has no
  action phase") is now false — it is the same shape as Frostbite was and is the
  obvious next one to make real.
- **Ice Eternal is the pool's only X-cost card and is deliberately unbuilt.** Its
  printed cost is `XX`; nothing here models an X cost, so `create X ... tokens` is
  REFUSED rather than read as one. Creating a single token for a card that charges
  for X is quietly weaker than printed — which coverage reads as `full`, and the
  fairness sweep is one-sided against the other direction.
- **`Spellvoid X` (Mask of the Swarming Claw) is refused for the same reason** —
  "where X is the number of chain links you control", and the chain belongs to the
  attacker rather than to the hero being hit. The piece keeps its printed Arcane
  Barrier 1.
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

> **➡ `FINISH.md` is the blueprint to done** (written v2.83). It states what
> "finished" means as five measurable conditions, then orders the remaining
> work — **A** retire `Battle` · ~~**B** the UNFAIR fail states~~ **DONE
> at v3.01** · **C** the 13 remaining heroes ·
> **D** the lobby ready gate and the feed's voice · **E** tuning.
> Every number in it was measured, with the command to re-derive it. Read it
> before scoping a cycle; the items below remain accurate and this file
> explains *why* that order.
>
> **v3.00 refreshed those numbers and moved A's argument; v3.01 finished
> B.** A is still a multiplier, but retiring `Battle` retires the TUNED
> `[3,4,5]` escalation with it and the table's dummy wins 11 of 15 — so
> **A sequences with E, not before it**. B is done (0 UNFAIR), so the
> phase a session with no phone should take is now **C, starting with
> Iyslander**. See FINISH.md.

> **See `ROADMAP-MULTIPLAYER.md`** — as of v2.20 the road to online play is
> planned there in full (the actor/perspective split, the seeded RNG, the pure
> reducer, and the three phases: hotseat → P2P friend play → hosted ladder).
> The items below remain accurate; that document sequences them and explains
> *why* this order. **Item 1's remaining step is not just wiring `priority.js`
> — it is that `you()` means `sides[0]`, not "the acting player", at 458 call
> sites.** Read that section before starting any two-player work.

**~~Decision 2026-07-25: no AI opponent.~~ REVERSED 2026-08-14.** The original
note read: *"The goal is real multiplayer — two humans, each piloting a deck. The
dummy stays as the solo trainer and as the proving ground for symmetric state; do
not build a deck-piloting AI."*

**Decision 2026-08-14: build the seat.** The opponent becomes something that
*occupies* seat 1 and answers *what do you do*, instead of a branch inside the
rules (`foePick`/`foePlay`/`foeVanilla`/`dummyDefence`). Real multiplayer is still
the goal; a policy in seat 1 is now **also** a goal rather than a detour.

Both dates are kept because the old note is quoted elsewhere and a reader who
finds only one of them will re-litigate the other. `engine/sparring.js` is already
this shape — `act(game, seat) -> action | null`, 11 drills, and the only module
still in `test/wire.test.js`'s `HEADLESS` list. **See `HANDOFF.md`, "THE NEW
DIRECTION", for what unifying the two engines actually costs** — `effects.js` is
phase-free as of v2.73, but still takes ~19 trainer closures.

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
3. ~~**Give the dummy an action phase.**~~ **DONE in v2.71** — seat 1 has a
   start phase, an action point it spends, a window in which you hold priority,
   and the same shared end phase your turn runs (`endPhaseCF`). The vanilla
   dummy keeps the tuned `[3,4,5]` escalation; a real hero in seat 1 plays
   cards. **The successor is THE NEW DIRECTION (2026-08-14): unify the two
   engines and give seat 1 to a policy** — `engine/sparring.js` is already that
   shape and is the last headless module. See `HANDOFF.md`.
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
