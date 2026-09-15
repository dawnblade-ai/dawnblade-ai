# UI-GUIDE — the reference for a session working on the SCREEN

**Written 2026-09-15 at v4.54, against the source rather than from memory.**
Every line number, count and measurement here was taken by asking the file;
each one names how to re-derive it, because a stated count rots (v4.17) and
this project has been bitten by exactly that four times.

You are working on `index.html`. The rules engine is finished enough that the
screen is now the binding constraint — **394 of 405 pool cards read in full,
every hero clause is built, and the last three tools report clean.** What is
left to make this a game people play is presentation.

> **Read `POLISH.md` first.** It is 123 lines and it is the *bar* — the five
> conditions this project calls "good", with Melee as the worked example.
> This file is the *map*: what exists, where, and how to change it without
> breaking the engine underneath.

---

## 0. THE FOUR THINGS THAT WILL BREAK THE BUILD

These are not style preferences. Each one has broken the page in production.

1. **NO BUILD STEP. EVER.** React 18.2, ReactDOM and Babel Standalone come
   from `cdnjs` `<script>` tags (lines 10–12). There is no bundler, no
   `package.json` build, no ES modules, no JSX toolchain. The page must run
   **from `file://`**. If a change needs `npm install` to render, it is wrong.

2. **ONE `<style>` BLOCK, ONE CLOSING TAG.** Lines 13–788. CSS is *appended
   before* `</style>`. `test/html-balance.test.js` fails on a second one.

3. **THE TWO `text/babel` BLOCKS COMPILE AS SCRIPTS, NOT MODULES.**
   - `script0` — lines **1528–1847**: loader, card resolver, UI shell
   - `script1` — lines **1849–7245**: the trainer and the table
   Their top-level `const` becomes a global `var`, which is how `script1` sees
   names from `script0` and from the bridge. **Do not "fix" this into
   modules** — it is load-bearing. A `<script type="module">` also cannot run
   from `file://`.

4. **BRACKETS AND COMMENT TERMINATORS.** `test/html-balance.test.js` checks
   both blocks are balanced *and* rejects an orphaned `*/`. v2.27 shipped a
   page that was perfectly balanced and completely broken, with 338 drills
   green, because prose after a double-closed comment happened to parse.

**Verify any edit compiles before you believe it** — see §8.

---

## 1. THE FILE MAP

`index.html` is 7,250 lines. Re-derive these landmarks with
`grep -n '<style>\|</style>\|type="text/babel"\|^function [A-Z]' index.html`.

| lines | what |
|---|---|
| 10–12 | the three CDN tags (React, ReactDOM, Babel) |
| 13–788 | the single `<style>` block |
| 789–1383 | plain data script — `APP_VER`, `DATA_VER`, `HEROES`, `DECKS`, `DBSRC` |
| 1390–1454 | the 21 `engine/*.js` `<script src>` tags |
| 1455–1527 | the **bridge** (plain JS, not babel) — lifts engine exports to bare names |
| 1528–1847 | `script0` |
| 1849–7245 | `script1` |

### The components, in source order

```
CardImg 1663 · CardModal 1675 · DbBanner 1692 · HeroGrid 1706 · VsStrip 1750
HeroArt 1779 · HeroSheet 1788 · DeckView 1820 · FxDot 1950 · FxChip 1951
FxCoverage 1964 · ChainLink 1982 · CardFrame 1993 · ArmorGrid 2036
DeckPitchCol 2054 · InPlayRow 2077 · GravePane 2092 · usePeek 2133
PeekDock 2184 · PromptSheet 2297 · JudgeSheet 2420 · Ticker 2506
Advisor 2524 · ZoneStrip 2541 · Battle 2578 · WinPanel 5352 · Judge 5368
Trophies 5393 · Loadout 5450 · Pregame 5743 · TableScreen 5890
TableRoom 6038 · TableThrow 6228 · TableBoard 6295 · App 7118
```

`Battle` is 2,774 lines and `TableBoard` is 823. **They are the two boards.**

---

## 2. THE TWO BOARDS — the single most important thing in this file

```
SOLO play  ->  Battle       (index.html)  speaks  mode / bphase
TABLE play ->  TableBoard   (judge.js)    speaks  phase / step / priority
```

Both resolve card text through the **same** `engine/effects.js`. What differs
is the turn structure driving it and the state vocabulary each reads.

**The recurring defect in this project is a rule that exists on one board
only** (v3.01, and it has recurred at least a dozen times). The UI version of
it is a *component* that exists on one board only, or a shared component one
board renders and the other hand-copies.

### What is genuinely shared — verified 2026-09-15

| component | line | shape |
|---|---|---|
| `CardFrame` | 1993 | the card face — both boards |
| `ChainLink` | 1982 | the chain strip |
| `ArmorGrid` | 2036 | props-only; `cell` supplies the tile so each board keeps its own tap |
| `DeckPitchCol` | 2054 | props-only; `hidden` shows a pile's SIZE, not its contents |
| `InPlayRow` | 2077 | the arena |
| `GravePane` | 2092 | graveyard / banish / soul |
| `PeekDock` | 2184 | the docked preview **and** the `--peekbot` measurement |
| `PromptSheet` | 2297 | props-only; renders for BOTH seats at the table |
| `Ticker` | 2506 | the feed |

### What is deliberately NOT shared — also verified

- **`usePeek` (2133) is TABLE ONLY.** `Battle` keeps its own `peek` state and
  its own `tapTwice`, because it reads `g.inspect` and zooms differently.
  Both boards have their own `peekables()` (`Battle` 4881, `TableBoard` 6519).
- **`WinPanel` (5352) is trainer only** — it says "DUMMY DESTROYED" and pulls
  a random trophy. A trophy for beating a *person* would devalue the case.
- **`Advisor` (2524) is seat 0 and local sessions only** — it reads its own
  hand through `you(g)` and prices your line against the opponent's gear.
- **The `Loadout` action bar is a COLUMN** (`.lo .actbar`, line ~458) while
  the board's is a row. Same class, two directions, and that is written down
  where it happens.

> **A row in a "shared" table has been FICTION here before.** v2.52: `PeekDock`
> was listed as shared while `Battle` rendered a hand-copied duplicate, so the
> measurement that positions it was added to one and not the other and the
> table's preview sat on top of its own hand rail. **Check the call site
> before trusting any claim of sharing, including this one.**

---

## 3. THE SCREENS

### The shell

`.shell` (line 20) — `max-width:560px`, centred, with
`padding: max(10px, env(safe-area-inset-top)) 12px calc(64px + env(safe-area-inset-bottom))`.
`.tabs` is a fixed bottom nav (`z-index:40`).

### The board: three vertical flick screens

Both boards use the same structure — `.tablewrap` with
`scroll-snap-type: y mandatory`, holding three `.vscreen` panes of height
`var(--tv)` = `calc(100vh - 152px)`. Each pane has a horizontal `.hscroll`
swipe to its graveyard.

| pane | `Battle` | `TableBoard` |
|---|---|---|
| 1 — opponent board | 4983 | 6660 |
| 2 — chain / command centre | 5036 | 6704 |
| 3 — your board | 5166 | 6858 |

`.screennav` is the ▲ Opp / Chain / You ▼ jump row.

### The rest of the flow

`App` (7118) → tabs → `HeroGrid` (roster, smash-style, 6 across) →
`HeroSheet` → `DeckView` → `Loadout` (5450, its own three `.vscreen` panes at
5581/5624/5666) → `Pregame` (5743, the throw) → `Battle`.

The table flow is `TableScreen` (5890) → `TableRoom` (6038) →
`TableThrow` (6228) → `TableBoard` (6295).

---

## 4. THE DESIGN SYSTEM

### Tokens — `:root`, line 14

```css
--r:#C4302B   red      (danger, the fight tab, refusals)
--y:#E8B33C   gold     (the brand em, the active tab, highlights)
--b:#3B6FB0   blue     (pitch / defence)
--ink:#14100E          the page ground
--forge:#241B16        panel
--forge2:#2E241D       panel, one step up
--bone:#E8DFD0         text
--bone-dim:#B8AC98     secondary text
--line:#4A3B2E         borders
--ok:#7BA05B   green
--tv: calc(100vh - 152px)      the flick-pane height
--peekbot                      MEASURED per frame — see §5
--lochrome                     MEASURED on the loadout — see §5
```

**There is no dark/light split.** The page is one committed dark-forge look.

### Type

- **`Big Shoulders Display`** — `h1,h2,h3,.disp`, uppercase, `letter-spacing:.02em`.
  The display face. Brand, tabs, buttons, headings.
- **`Spline Sans`** — body, 15px / 1.45.
- **`Spline Sans Mono`** — `.mono`, numbers, counters, codes.

### The signature idiom

`.clip` / `.clip-sm` — a chamfered `clip-path` corner cut (12px / 8px). It is
on nearly every panel and tile and it is what makes the look cohere. Keep it.

### Class vocabulary

**205 classes**, re-derive with
`sed -n '13,788p' index.html | grep -oE '^\.[a-z][a-zA-Z0-9_-]*' | sort -u | wc -l`.
The style block is sectioned by comment (`/* shell */`, `/* battle */`,
`/* card frame overlay */`, `/* tabletop */`, …) — `grep -n '^/\* ' index.html`
gives the map. Several sections are labelled by the version that added them
(`v1.08 sideboarding table`, `v2.19 — the two-tap hand`); those comments carry
the *reason*, and several of them are the only record of a bug's fix.

---

## 5. THE INTERACTION CONTRACT

### Two-tap: peek, then commit (v2.19)

A card in the rail is 80px wide and unreadable on the phone this is played on.
So **every tappable card peeks first**:

1. first tap → the card renders large above the action bar, with its name and
   a **verb** saying exactly what the second tap will do;
2. second tap on the *same* card → commits.

`tapTwice(card, verb, action)` is the helper. The verbs in use: *play · pitch ·
unpitch · defend · react · set in arsenal · swing · activate · use the hero
power · play from the graveyard · play from banish · full card*.

**`peekables()` must span every zone a tap can originate in** — hand, arsenal,
gear, powCards, board. A tap that arms with no preview is the failure this
project has shipped **twice**. Two deliberate exceptions: with **inspect** on
one tap opens the modal, and the opponent's gear opens on a single tap because
it is not actionable.

### The two measured CSS variables

Both exist because a **hardcoded offset was wrong the moment the layout moved.**

- **`--peekbot`** — set per frame by a `uE` inside `PeekDock` (line ~2213).
  `.peekwrap` is `position:fixed; bottom:var(--peekbot,112px)`. The flat
  `112px` fallback is *not* a safe resting value: at 393×852 the rail spans
  y 628..754 and the correct offset is **233px**, so the fallback puts the
  preview inside the rail. It is **tracked, not sampled once** — the rail is
  still settling when the tap lands (measured mid-tick it came out 146px
  against a rail that settled at 628), and a scroll listener does not cover it
  (the rail slid 86px with `scrollTop` unchanged).
- **`--lochrome`** — measured off the live chrome in `Loadout`. The reserve
  was `calc(100vh - 236px)`, written when the bar was one button tall; with
  two options and their disclosure the bar stands **163px** at 393×852.

### `.peekwrap` must not take pointer events

`pointer-events:none` on the wrapper, `auto` on its children. It is fixed and
full-width and mostly empty; with `auto` that empty space covered the hand rail
at 393×852 and **no card in hand could be played.** Invisible on a tall desktop
window.

### No dead taps

A card that cannot be played is **refused by name**, never silently inert.
CR 7.3.3 gives the turn-player priority in the defend step, so the defender
genuinely cannot pass yet — the bar says *"declare your blockers — {them} still
holds priority"* rather than greying a button. **A dead control reads as a
broken screen, not as a rule.**

---

## 6. THE PHONE IS THE PLATFORM

**393 × 852.** Test there, not in a tall desktop window — three shipped bugs
existed *only* at phone width:

| version | what |
|---|---|
| v2.36 | `.peekwrap` took pointer events and covered the rail — no card playable |
| v2.37 | the dock sat *over* the rail rather than above it (hardcoded offset) |
| v4.28 | the loadout's two fight options laid out as four **columns** — the striped Fight button 66px wide, its disclosure a 51px ribbon ~6 characters across |

v4.28 is the one to learn from: **`.actbar` is shared and `display:flex` with
no direction is a ROW.** Right for the board (four buttons side by side), wrong
for a loadout that puts a *stack* in it. And every drill was green, because
**a text pin cannot see a layout.**

---

## 7. HOW TO VERIFY A UI CHANGE

### a. The drills — `npm test` (2,856; `# fail` must read 0, `# skipped` 5)

These bite on UI edits specifically:
- `test/html-balance.test.js` — brackets + orphaned comment terminators
- `test/sync.test.js` — the bridge, and **no engine export re-declared in
  `index.html`** (a stray `const fxParse =` would shadow the module)
- `test/phasebar.test.js` — the two phase labels, lifted out of the source
- `test/mirror.test.js`, `test/table.test.js` — the table's own contracts
- `test/keycensus.test.js` — which parser readers each board asks
- `test/actor.test.js` — slices function bodies by **anchor pairs**; renaming
  or reformatting a rules function in `index.html` will break its anchor

### b. The compile check — a manual pre-ship step, one second

`html-balance` proves the brackets balance; v2.27 shipped a page that was
balanced AND broken. Install into a scratch directory so `npm test` stays
green on a fresh clone with no `npm install`:

```sh
npm install --no-save --prefix "$SCRATCH" @babel/standalone
# then transform each <script type="text/babel"> body with
# {presets:["react"], sourceType:"script"}
```

### c. The page can be DRIVEN at phone dimensions (v4.28)

The three CDN tags and `DBSRC` are the only things a sandbox cannot fetch, and
each is a one-line substitution into a **scratch copy** — `index.html` itself
is never touched, so what runs is the real page with the real engine:

```sh
npm install --no-save --prefix "$SCRATCH" react@18.2.0 react-dom@18.2.0 \
                                          @babel/standalone playwright
curl -o "$SCRATCH/serve/card.json" "$DBSRC"      # the live database, ~23MB
cp -r engine "$SCRATCH/serve/"                    # UMD modules, as authored
sed -e 's|https://cdnjs[^"]*react.production.min.js|vendor/react.js|' … index.html \
    > "$SCRATCH/serve/index.html"
python3 -m http.server -d "$SCRATCH/serve"
# chromium at /opt/pw-browsers/chromium, viewport 393x852
```

**ASSERT ON BOXES, NEVER ON A SCREENSHOT.** A picture says a layout is wrong
and cannot say why; `getBoundingClientRect` says the note is 51px wide and the
bar overlaps the pane by 29px. The three numbers worth taking: the **overlap**
between a fixed bar and the box above it, the **narrowest child** of a flex
container, and the computed **`flex-direction`**.

**And measure more than one viewport.** `--lochrome` comes out 284px at
393×852, 301px at 360×740 and 267px at 820×1180 — a single reading is
indistinguishable from the hardcoded number it replaces.

### d. On a real phone

Type checking and drills verify the parser is correct, not that the feature is
legible. The loop is: play → record → extract frames → fix.

---

## 8. WHAT IS OPEN — verified 2026-09-15

Ordered by how visible it is to a player.

### 8.1 The trainer's opponent pane lies about the arsenal — READY TO FIX

`index.html:4992`

```jsx
<div className="arscol"><div className="slot clip-sm">arsenal —</div>
  <span className="zlbl">holds {opp(g).hand.length} · blocks from hand</span></div>
```

**`arsenal —` is a hardcoded literal.** It never reads `opp(g).arsenal`. But
the dummy's own end phase genuinely sets a card there every turn
(`index.html:4441`, `os.arsenal = set;`) and *announces it in the feed*
(`4442`: `(b) <name> sets a card face down in arsenal.`).

So the feed says the opponent just set a card in their arsenal and the screen
says the arsenal is empty. **That is the sev-2 category the player TRUSTS.**
The TABLE renders it correctly (`index.html:~6673` reads `them.arsenal` and
falls back to the literal only when it is empty) — so this is v3.01's
one-board shape at the UI layer, with the fix already written one board over.

Note also: the comment at `index.html:1859` still says *"The dummy's
arsenal/pitch/banish/soul sit empty because it takes [no action phase]"*. That
stopped being true at **v2.71**.

### 8.2 The trainer's opponent weapon slots are literals too

`index.html:4996` and `5016` — `<span className="wempty">weapon —</span>`,
never reading the opponent's gear. **Latent**: `DUMMY_GEAR` has no weapon
today, so nothing is visibly wrong. It is wrong the day one is added, and the
table's `gearTile` is the shape to copy.

### 8.3 Cloaked has no display half — recorded, deliberate

`tools/approx.js`: `cloaked-display`, **open**. The ruling's display half —
*"SHOW CARD BACK ON THE PLAYERS BOARD"* — is not built. Uphold Tradition is
equipped face-down and the board shows its face. Its sibling record
`cloaked-face-down-values` (also open) is a **rules** question, not a UI one:
whether a face-down piece keeps its printed defence and its Ward is undecided,
and **half-building a value change is worse than the honest gap** (v3.23), so
do not "fix" it while doing the display.

### 8.4 Everything in `POLISH.md` §4 — sound and one-thing-ness

Deliberately last, because it ages worst if the foundation moves. The one hard
constraint that governs it: **every asset self-hosted, no build step.**

### 8.5 `ARCHITECTURE.md` was badly stale — FIXED at v4.54

It described `engine/state.js`, an `engine/engine.js` with
`getView`/`processInput`, and *"cards never contain code; effects.js is the
association layer"*. **None of that was true** — it accurately described a
prototype deleted around v2.0 and never revisited. It is rewritten against the
source now and carries the command that reproduces every count it states, so
read it for orientation; `CLAUDE.md` is still the working manual.

What that rewrite turned up, and is still open: **four files from that
prototype are in the tree and none of them is reachable** — `demo.js` and
`sim/demo.js` (byte-identical, and they throw `ERR_MODULE_NOT_FOUND` on
import), `data/demo-cards.js` (**invented placeholder cards**, the one file
here with hand-typed card data) and `data/ingest-fab-cube.js` (emits a file
that does not exist). Nothing in `index.html`, `engine/`, `test/` or `tools/`
references any of them. Not a UI job; see `ARCHITECTURE.md`, "The prototype
this file used to describe".

---

## 9. WHAT NOT TO TOUCH

1. **`engine/*.js`.** 21 modules, 2,856 drills. A UI session should be
   changing markup, CSS and the components in `script1`. If a screen needs a
   fact the engine does not expose, **ask the engine for it** — there are
   readers for almost everything (`parser.js` alone exports ~140).

2. **The golden rule.** *Never invent or hardcode card effects.* Card text
   streams at runtime from the public FaB database. A screen that special-cases
   a card by name breaks this at the UI layer — v3.22's Runechant and v4.04's
   Inertia are both that bug.

3. **The no-mirror rule.** One copy of every shared function, in `engine/`.
   `test/sync.test.js` fails if `index.html` re-declares an engine export. At
   the UI layer the same rule is why `PeekDock` is a component and not
   hand-copied markup (v2.52).

4. **`setG`.** Every state change in `Battle` goes through it, and
   `invariants.check` is wired into that funnel. **Whatever replaces it must
   keep the funnel or the guard rails go dark.**

5. **The access rule.** `you()`/`opp()` READ, `youMut()`/`oppMut()` WRITE.
   `let n = {...s}` is shallow — writing `n.sides[0].hp -= 4` corrupts a state
   React has already rendered. And a per-side field written as a top-level game
   key silently does nothing (five shipped that way in v2.18).

6. **The feed's voice.** `say(...)` reaches a feed BOTH seats read, so it
   **names the seat**; `return "reason"` goes back to whoever attempted the
   action, so *"you"* is right there. `game.sv` inflects a verb for a named
   seat and `game.sp` a possessive — seat 0 is literally called **"You"**, so
   `${name}'s board` reads *"You's board"* without them.

---

## 10. THE VOICE

The advisor and the log speak like **a sharp, warm coach at the table** —
concise, evocative, never patronising. Keep that in any new copy.

Two rules that are not style:

- **In a training sim the sequence IS the lesson.** Every end-phase step
  announces itself *including when it does nothing*, because a step that is
  silent teaches nothing. Do not "tidy" those lines away.
- **A refusal names the window and the reason.** *"Enigma — hero power costs
  3 Chi, and you can reach 0 — only a Chi pays a Chi cost"* is the register.
  Not *"illegal move"*.

---

## 11. THE FASTEST WAY IN

```sh
npm test                    # 2856 drills, ~35s, must be 0 fail / 5 skipped
grep -n '^function [A-Z]' index.html      # the component map
grep -n '^/\* ' index.html | sed -n '1,60p'   # the style block's sections
```

Then open `index.html` at **line 4983** (the trainer's opponent pane) and
**line 6660** (the table's). Reading those two side by side is the shortest
path to understanding this file: same screen, two boards, and one of them
currently tells the truth about the arsenal.
