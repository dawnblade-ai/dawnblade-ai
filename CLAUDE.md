# Dawnblade — Flesh and Blood AI Training Sim

A single-file browser game: a Flesh and Blood sparring simulator where the player
pilots a real hero deck against an iron-armored training dummy, with an AI advisor
("Claude's call") reading the board.

**Live at:** https://dawnblade-ai.github.io/dawnblade-ai/ (GitHub Pages)
**Current version:** v3.29

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

- `DATA_VER` (e.g. `"sage-v6"`) keys the localStorage cache. **Bump it whenever the
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
  URL returns 200 *and* that all 15 `engine/*.js` files do.
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
This is `node --test "test/*.test.js"` — currently **1197 drills**.
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
open: Hope Merchant's Hood's shuffle-and-redraw and Quick Clicks' "played a
Nimblism this turn" macro, which need deck manipulation and a turn-history
predicate rather than a choice.

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

**THREE OF THE FIVE STILL REFUSE**, each for its own reason: Chokeslam
and Crush the Weak are RESTRICTIONS ("can't gain {p}", "can't play") that
belong in `legal` and in every pump path, and Walk in My Shoes halves
base {p} and {d} for a turn. Claiming one would file a card `full` that
does nothing.

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

UNFAIR is **0** as of v3.01. It went 16 → 11 when the tool stopped
reading the wrong file, and 11 → 0 when the two keywords that actually
remained were built (see Phase B in `FINISH.md`). The four phantasm cards
left first, because they were fixed rather than reclassified.

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
means something changed that nobody decided. Renaming parser's belongs
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
- **allies do not attack.** They are attackABLE; swinging one needs the
  activation cost and a target of its own. **CR 4.4.3d's arena untap is
  built ahead of it** (a board permanent's `spent` clears at the turn
  player's untap step), because the untap has to exist before the tap.
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
that says so. All three enablers are live; the face-up card carries
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

**Still to wire:** the `hits` and `defends` triggers (`play` and `attacks`
are live). The parser reads them already — `fx.optCost.trigger` names
which — so each is a queue site, not new machinery.

**Measured:** 258 → **264 full**, 35 → **33 none**. Runic Fellingsong and
Mounting Anger went none/part → full; Golden Tipple (×3) and Fire that Burns
Within → full.

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
