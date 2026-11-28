# CRESCENDO — the release UI (handoff: START HERE)

*(Rewritten by each CRESCENDO session. Keep it under ~80 lines; history goes in the session log at the bottom.)*

**What this is.** The user's "last hurrah" (2026-11-27): a NEW graphical framework for the release version, designed
first in great detail by a design team, then built by a development team, "sparing no expense". Read `BRIEF.md`
first (the user's words, the Melee bar, the phone truth, the constraints). It supersedes the LOOK of the classic
board and of Table Talk; it keeps Table Talk's vision (`docs/TABLE-TALK.md` §0–§10). The user said: walk step by
step, keep the CEO's context lean, use teams of Sonnet workers (one for design, one for development).

## The design (done in session 1 — the "should")

| file | what it fixes | owner |
|---|---|---|
| `BRIEF.md` | the mission, binding for every worker | CEO |
| `DESIGN-SYSTEM.md` + `tokens.css` | the visual language in px at 393×660: mood ("armory after closing, one lamp left on"), slate felt, jade (you) / orchid (them), type, THE CARD OBJECT at every size/state, the bout, icons, buttons, band heights at 375/393/430 | art director |
| `MOTION.md` | every event's choreography in ms, the `--m-*` tokens (merged into tokens.css), hit-stop, pace and fairness, WebAudio sound recipes | motion director |
| `SCREENS-TABLE.md` + `mockups/table-*.html` | every table state, element boxes, taps, manners | table designer |
| `SCREENS-FLOW.md` + `mockups/flow-*.html` + `mockups/index.html` | title → how to play → hero → sit down → prompt sheets → pad → result → menu; the gallery | flow designer |
| `mockups/style-tile.html`, `mockups/motion-lab.html` | the language and the motion, live | design team |
| `mockups/stage.js` | the phone contract in miniature: one `--vh` from visualViewport, `data-band`, a phone frame on desktop (`?w=375&h=548`) | CEO |
| `mockups/shots/*.jpg` | 393×660 shots of every mockup (2x) | design team |

**On the phone:** `https://dawnblade-ai.github.io/dawnblade-ai/docs/crescendo/mockups/` (the gallery) and
`…/docs/crescendo/probe.html` (shows the phone's REAL viewport, safe areas, fonts, fps, tap latency — ask the user
for a screenshot of it; it calibrates everything).

## The foundation (development scout, session 1) — `FRAMEWORK.md`, `PHONE.md`

Why the phone fights back (evidence in FRAMEWORK.md §1): every drive ran Chromium at 393×852 while Safari shows
≈393×660, and nothing has ever run on WebKit; heights trust `100vh` + JS measurements; **in-browser Babel compiles
≈610k chars on every load: first paint 3.9 s at 1x and 17.5 s at 4x CPU throttle; precompiled it is 0.24 s / 0.75 s**
(Babel ≈ 93% of load); no unit system, 107 rules at ≤ 11 px; touch left to browser defaults.

**CEO decisions (session 1):**
1. **The new shell is a second page, `play.html` + `ui/*.js`, Preact 10 + `htm` tagged templates — no Babel at
   all** (FRAMEWORK.md §4). It reads the engine only through namespaced exports (view, legal, prompts, announce,
   local, servertable) — nothing new in `engine/`, so sync/wire drills are untouched; a new `test/ui-sync.test.js`
   guards play.html's load order and the no-mirror rule. `index.html` stays the default (a `?ui=crescendo`
   redirect before Babel runs) until the USER makes play.html the default.
2. **Layout:** FRAMEWORK.md §4.3 — one unit `--u = min(100vw/393, var(--vh)/620)` so DESIGN-SYSTEM's px at 393 map
   1:1 (the SE then scales to ≈0.88, matching the art director's SE values); `--vh` from visualViewport in ONE place;
   the stage is fixed, never scrolls, pads the safe areas once; bands compact/regular/tall change only what the
   design says. Tap targets `max(44px, …)`, type `max(11px, …)`.
3. **Motion:** one director (`ui/director.js`) owns every Web Animation; transform/opacity only; MOTION.md's tokens.
4. Libraries from CDN at an exact version (today's rule) UNLESS the user rules to vendor (Q below).

## Built (sessions 2–3) — `play.html` + `ui/`, LIVE since v7.21 beside the classic page (still the default)

| file | job |
|---|---|
| `ui/boot.js` · `ui/data.js` | the stage, `--vh`, bands · GENERATED from index.html's data block (`node tools/ui-data.js --check`) |
| `ui/session.js` · `ui/worker/ai.js` | ONE adapter `{state, legal, submit, onStep}`: local AI, the Dummy (`?foe=dummy`), server table, two phones (`openNetworked`), rematch, the roll/throw seam, `modes()` · Sharp's search in a Worker (main-thread fallback wherever one is refused, e.g. Chrome file://) |
| `ui/table.*` `layout.js` `card.js` `pad.js` | the table T1–T10 (two-faced medallion, HIT FOR / NO HIT from the engine's `pend.total` + `rxPumpTotal` − `sparring.wallNow`) |
| `ui/director.js` `audio.js` · `sheets.*` `panels.js` · `announce-view.*` | every animation (MOTION beats, exact end poses) and WebAudio · prompt sheets (F5), inspect, menu · the announcer's slab + glimpse |
| `ui/circuit.js` · `circuit-view.js` `circuit-play.js` `circuit.css` | THE CIRCUIT (v7.22, `SCREENS-CIRCUIT.md`): the local store and rules P1–P10 (`test/ui-circuit.test.js`) · C1–C4 record/heroes/games/ladder · C5 plate, C6 home, C7 road, C8 daily |
| `ui/flow.*` `app.js` | F1–F9 and the router: every table the session can seat is lit; THE ROLL (die) locally, THE THROW networked; Learn the rules (CR keyword rows from `data/crkw.js`) |

**Drives** (deps: `PAGE_DEPS=<scratch>/pagedeps NODE_PATH=/opt/node-tools/node_modules`, see each header; WebKit at
`/opt/pw-webkit`, installed by the environment's setup script): `tools/ui-drive.js` (table box-match vs the mockups,
both engines × 4 viewports, play drives, 4x-CPU frames; `--art --shots DIR`), `tools/ui-flow-drive.js`,
`tools/ui-circuit-drive.js` (C1–C9 and the daily/road flows, both engines), `tools/ui-chaos.js` (random taps through whole games, every hero; `--coach 1` makes the player win). Drills: `test/ui-*.test.js`.
The design review with real art (20 items, most fixed) was a scratch file; its open items are below.

## Next (in order)

1. **`REVIEW-2.md`** — the second design review with real art (25 findings, none fixed). Biggest: the table is ~45%
   empty while gear/arena read as ~30 px thumbnails (revisit Q9's 44×61 with the design team), HIT FOR / ANY BLOCKS? are
   tiny, life shows -1 at the end (check the CR before clamping), the result pad lacks a "one more" hook, C2's portraits
   are washed out, F2's Circuit icon is empty and "Step 1 of 3" is wrong, F4's die collides with its pill. A design
   pass (one Sonnet team) then a build (another), files split table · flow · circuit.
2. **The real iPhone** on `…/play.html` (the user): frame time, safe areas, fonts, sound, the Worker, file://.
3. **Ask the user to make play.html the default** (they lean yes: "out with the old, in with the new").
4. Engine perf: the AI tick's worst is ~400 ms at 4x, on the Sharp bound; the profile is flat (search spends it in
   `legal`, `settle`, `stalemateCheck`); the Worker parses `data/pool.js` a second time.
5. Open UI: a two-phone rematch protocol · the gear loadout (F4's live "Deck" button meanwhile) · WebKit T1's
   box-match flakes under CPU load (passes quiet) · the AI (H): the coach loses slow attrition games to the Dummy.
Use Sonnet workers per the user (one team designs or reviews, one builds); give each the files it owns, a ≤250-word
report. Run release gates in a clean `git worktree` of the release commit.

## Questions for the user (defaults standing until answered)

Q1 Seat colours jade (you) / orchid (them) — default yes. Q2 Menu and pad live in the hub, not the bout — default yes.
Q3 A bone-white primary button (replaces purple/green) — default yes. Q4 Sound on at half volume by default, or off
until turned on — default on at 0.5. Q5 The result word: "DAWNBREAK" with a blade-of-light sweep — default yes.
Q6 Vendor the 13 KB Preact+htm file and self-host fonts (works offline/file://; amends CLAUDE.md's CDN rule) —
default no (CDN pinned). Q7 Allow the two Playwright download hosts for WebKit drives — asked at the next start.
Q8 (standing) Add to Home Screen stays decision C.
Q9 Mat cards 44×61 (8 equal columns per half: weapon, 4 gear, graveyard, deck, arsenal — the design system's 56×78
cannot fit 8 zones), or drop weapon/equipment as full-lane cards — default 44×61. Q10 Inspect a hand card by a
400 ms hold (not a tappable name-plate) — default the hold.
Q11 The KO word split DAWN / BREAK by the blade of dawn (flow designer; MOTION.md has it on one line) — default the
split. Q12 PLAY on the title goes straight to sit-down with the last choices (not always through "how to play") —
default straight.
Q13 (session 2) F4's first player: "THE ROLL" with a die locally (FaB rolls a die; engine/rps.js), "THE THROW" at networked
tables (the lobby's protocol) — default as built. Q14 F4's GEAR (loadout, undesigned) shows a live "Deck" button until a
loadout is designed — default yes.
Q15 (session 3) SCREENS-CIRCUIT.md Q1–Q20 stand at their defaults (the name "The Circuit"; the road's tiers ARMORY /
SKIRMISH / THE CALLING / THE SUMMIT adapt LSS event names; the daily's day is UTC; a streak, informational only; an open
road; only wins over the full-strength AI count). Q16 The coach is absent at friendly AND ranked tables (F8) — applied.



## Session log

### 2026-11-27 — CEO thread, the design (session_013xG9x8ois1huSReX34RriM)
Five Sonnet workers: art director, motion director, foundation scout (development), table designer, flow designer.
All five delivered; every mockup box-checked clean at 375×548 / 393×660 / 430×932 (Chromium only). Loose ends for the
builders: the pad needs paper/pencil tokens (flow-6 has them locally); earlier chain links and tokens on cards are
specced, not mocked; mat cards are 44×61 (SCREENS-TABLE.md overrides DESIGN-SYSTEM.md's 56×78 — Q9); the two
screen designers paused at the account's 5-hour usage limit and were resumed with SendMessage after the reset.
The CEO wrote BRIEF.md, stage.js, merged the motion tokens, reviewed the style tile. No code shipped; live stays v7.20.

### 2026-11-27/28 — CEO thread, the build (session_013xG9x84b3jca3ZpKGRmHXL)
Q7 answered by approval: the two Playwright hosts were added and WebKit installed (setup script on the environment).
Three Sonnet builders (table, flow, session) and one design reviewer built steps 0–9: skeleton → T1–T10 → director +
sound → sheets + announcer → flow F1–F9 → server tables / Dummy / two phones → chaos on the new shell. Every table
state and flow screen box-matches its mockup (0.00 px) in Chromium AND WebKit at 375×548 / 393×660 / 430×932 / 393×852.
CEO rulings: HIT FOR numerals always under the life numerals; the compact glimpse is 190×265 (SCREENS-TABLE §14 over
the token); a fully blocked attack reads NO HIT (CR 7.5.5); "Defense" as FaB prints it; no number the server did not
give. Engine: `prompts.js` refuses a selection index the sheet does not hold (a wire hole, drilled); `sparring.js`
exports `wallNow` (the UI no longer re-derives the wall). Chaos found and fixed a KO beat that never played after an
unpaced game; the review found a mirrored turn medallion (fixed: two faces). Live stays v7.20 until the release.

### 2026-11-28 — CEO thread, the framework (session_013xG9xA6vFW9WwQ3FBuhVEU)
Shipped v7.21 (the build lands on main), v7.22 (THE CIRCUIT: a design worker wrote SCREENS-CIRCUIT.md + 9 mockups;
builder A the pure store/rules with every rule sabotaged; builder B the screens and hooks; engine effects context
built once, self-play identical) and v7.23 (ranked from play.html). A design reviewer with real art wrote REVIEW-2.md.
Lessons: a shared-tree drive while a worker edits `ui/` tests nothing — gate in a clean worktree; WebKit box checks
flake under CPU load; worktree isolation branches from main, not the session branch.

