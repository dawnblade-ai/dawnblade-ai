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

## Next — the development team (in order; each step ships behind the switch with the CLAUDE.md gates)

0. **WebKit for drives:** the proxy refused `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`.
   At the next session's start (user present), propose adding exactly those two hosts (get_environment →
   update_environment), then install webkit into a scratch `PLAYWRIGHT_BROWSERS_PATH` (never /opt/pw-browsers).
1. **Skeleton:** `play.html` + `ui/boot.js` (the stage/`--vh`/bands from `mockups/stage.js`, tokens.css → `ui/`),
   `ui/session.js` (one adapter: local game, trainer, server table → `{state, legal, submit, onStep}`),
   `test/ui-sync.test.js`, `tools/ui-drive.js` (Chromium + WebKit at 375×548 / 393×660 / 430×932 / standalone).
2. **T1 for real:** the resting table from a live local game, matched box-for-box to `mockups/table-1-*.html`.
3. The card object + hand row (T2, T3 pay) · the bout · the hub · 4. the director + glimpse + announcements
   (T5, T8) · 5. defend / reaction / arsenal (T6, T7, T9) · 6. prompt sheets (F5) · 7. flow screens (F1–F9) ·
   8. server tables · 9. parity drills (talk.js-class drive, chaos on the new shell) → ask the user to make it default.
Use Sonnet workers per the user (one team designs or reviews, one builds); give each a file it owns, a ≤250-word report.

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

## Session log

### 2026-11-27 — CEO thread, the design (session_013xG9x8ois1huSReX34RriM)
Five Sonnet workers: art director, motion director, foundation scout (development), table designer, flow designer.
All five delivered; every mockup box-checked clean at 375×548 / 393×660 / 430×932 (Chromium only). Loose ends for the
builders: the pad needs paper/pencil tokens (flow-6 has them locally); earlier chain links and tokens on cards are
specced, not mocked; mat cards are 44×61 (SCREENS-TABLE.md overrides DESIGN-SYSTEM.md's 56×78 — Q9); the two
screen designers paused at the account's 5-hour usage limit and were resumed with SendMessage after the reset.
The CEO wrote BRIEF.md, stage.js, merged the motion tokens, reviewed the style tile. No code shipped; live stays v7.20.
