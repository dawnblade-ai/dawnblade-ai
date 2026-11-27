# CRESCENDO FOUNDATION — why the phone fights back, and what to build on

Scout report, 2026-11-27. Everything below is measured or grepped in this repo today; commands and numbers
are given so a later session can rerun them. Numbers from the sandbox are **relative** (4x CPU throttle is the
project's phone proxy, `POLISH.md`), never claimed as an iPhone's wall clock — `probe.html` exists to
calibrate that on the user's real device.

---

## 1. Why polishing on the phone is so hard (evidence)

### 1.1 Nothing we test is WebKit, and nothing we test is the size Safari shows
- Every drive is headless **Chromium** at **393×852** (`tools/page.js` `open()`: `isMobile:true`, default
  `h = 852`). The phone is **WebKit** with toolbars: visible ≈ 393×660 (≈375×548 on an SE). The brief says so
  (`BRIEF.md`, "The phone is the platform"); the drive tooling does not.
- WebKit is **not obtainable in this sandbox**. `require('playwright').webkit.executablePath()` points at
  `/opt/pw-browsers/webkit-2359/pw_run.sh`, which does not exist (only chromium builds are installed).
  `PLAYWRIGHT_BROWSERS_PATH=<scratch> npx playwright@1.63.0 install webkit` fails: the egress proxy answers
  `403 request blocked: no rule or allowlist entry allows host` for both `cdn.playwright.dev` and
  `playwright.download.prss.microsoft.com` (the only two hosts the installer uses). **Allowing those two hosts
  in the `dawnblade-ai` cloud environment (or running WebKit on the user's Mac, `DESKTOP-TASKS.md`) is the
  single highest-value unblock for this mission.** Until then every "looks right" is a Chromium statement.

### 1.2 The height model trusts `100vh` and JS measurements — both lie on iOS Safari
- `grep -c -E '[0-9]dvh|svh|lvh' index.html` → **0**. Height is `100vh` at lines 45 (`--tv`), 715 (`.lo .tablewrap`),
  954 (`.peekcard`), 1031 (`.foestep`), and `vh` caps at 866 (64vh), 1058 (88vh), 1534 (86vh), 1551, 1569.
  In Safari `100vh` is the **large** viewport (toolbars retracted), taller than what is visible with them out.
  Anything sized `calc(100vh - X)` is therefore taller than the screen exactly when the user is looking at it
  fresh. Chromium emulation sets 100vh == innerHeight, so the drills cannot see this.
- The workaround is **JS reserves measured from `window.innerHeight` + `getBoundingClientRect`**:
  `--lochrome` (8165–8205), `--peekbot` (3417–3493). `innerHeight` changes continuously while Safari's toolbar
  animates, the `ResizeObserver`/`resize` loop re-measures mid-animation, and the number they write is
  consumed by `calc(100vh - var(--lochrome))`, i.e. **a measured visible-height minus a layout-viewport 100vh**
  — two different viewports in one formula. This is the mechanism behind "fixed after the fact" regressions
  (`--peekbot` shipped broken in v2.52 for the same reason, comment at 707–712).
- Even the non-game screen depends on scroll at phone size: driving the setup screen offline
  (Chromium, `?talk=1`), `documentElement.scrollHeight` = **732 at 375×548** and **741 at 393×660**
  (viewport 548 / 660). Scrolling makes Safari collapse its toolbars, which resizes the viewport under every
  `vh` rule — the exact thing `BRIEF.md` says the game must not do.

### 1.3 Startup is dominated by in-browser Babel, and the first paint waits for it
Details in §2. Short form: ~610,000 characters of JSX are compiled on the phone on every load, before the
first meaningful paint, and three render-blocking CDN scripts (React, ReactDOM, **Babel 2.8 MB / 602 KB gzip**)
plus the Google Fonts stylesheet sit in `<head>` (index.html 31–36). Fonts then land after first paint
(`display=swap`) and re-flow text; the page knows it — `index.html` 8182 re-measures "when a web font landing"
changes a box.

### 1.4 There is no unit system; type is below the floor; one bug that is certainly real
- Sizes are literal px everywhere; `--fs-xs/--fs-sm` are **10 px**, `--fs-md` 11 px (line 47). 107 lines use ≤ 11 px
  sizes; on the setup screen alone 29 text nodes render under 11 px (measured at 375/393/430 widths).
- **`.bugta{ font:13px/1.5 inherit }` (line 1066) is an invalid shorthand** (`inherit` cannot be the family
  inside `font:`), so the whole declaration is dropped and the JUDGE!! textarea renders at the UA's 13.33 px —
  below 16 px, with `autoFocus` (line 3829): iOS Safari **zooms the page on focus** and does not zoom back.
  (The `.tbl*` inputs are 20/22/34 px, fine.) Chromium never zooms on focus, so no drill saw it.
- `-webkit-text-size-adjust` appears **0** times (landscape rotation inflates text on iOS).

### 1.5 Touch behaviour is left to browser defaults
- `touch-action`: **0** occurrences — double-tap-zoom and the pan/zoom gesture arbitration are the browser's.
- `-webkit-touch-callout`: **0**; `user-select`: **1** (a code box). Long-press on a card image or a label shows
  the iOS callout / selection loupe; a card is a long-press target in a card game.
- `:active` rules: **4** in the whole sheet. The Melee bar ("every tap answers within a frame") has no
  guaranteed press state; on iOS `:active` also needs a touch listener on the page to fire reliably.
- 14 `position:fixed` layers each anchored differently (`bottom:0`, `bottom:calc(10px + env())`, `top:max(8px, env())`,
  `inset:0`, `bottom:var(--peekbot)`), z-index 20–90. Safe-area env is used in 14 places, but the viewport is
  **not** standalone (by a user decision, index.html 7–11), so Safari's own bars are always present and the
  `bottom` anchors sit on the *layout* viewport, which moves while the toolbar animates.

### 1.6 Motion is mostly right, with specific offenders
`@keyframes`: 32, almost all `transform`/`opacity` (good). Offenders that animate layout or paint:
`transition: width` on the life-bar trail (565, 568, 1451, 1454), `transition: top` on the token chip (1419),
`box-shadow` keyframes (`shdanger` 571, `tkglow` 1406), `text-shadow`+`color` keyframes (1312–1315),
`filter: drop-shadow` on the peek card (954; 11 `filter:` uses). Card images are `loading="lazy"` with no `decoding`
and no intrinsic size attributes (2648, 2868, 3225), so a card landing mid-animation can decode on the main thread.

### 1.7 What is *not* a problem
`backdrop-filter`: **1** use (1480, a 2 px blur — fine). Viewport meta is correct (`width=device-width,
initial-scale=1.0, viewport-fit=cover`, line 5). `overscroll-behavior:none` is set on `body`. `-webkit-tap-highlight-color`
is cleared. No `<select>`. The engine side (view / announce / local `pace`/`onStep`) is already UI-agnostic — the
problem is the shell, not the game.

---

## 2. Startup measurements (Chromium, 393×852, DPR 2, hasTouch; page served by `tools/page.js`'s offline router)

CDNs answer from local files, so **network time is zero here** — on a phone the 2.8 MB Babel download is extra.
Same machine, same page, three variants (the copies live only in the scratch dir; the repo is untouched):
`orig` = today's `index.html`; `pre-env` = the four `text/babel` blocks precompiled with the same `env,react`
presets and Babel removed; `pre-react` = precompiled with the `react` preset only (modern-browser output).

| variant | CPU | first-contentful-paint | app mounted | main-thread long tasks | JS heap |
|---|---|---|---|---|---|
| orig | 1x | **3,864 ms** | 3,940 ms | one task of **3,498 ms** | 60 MB |
| orig | **4x** | **17,484 ms** | 17,604 ms | one task of **16,397 ms** (+352, +80) | 116 MB |
| pre-env | 1x | 236 ms | 276 ms | none | 13 MB |
| pre-env | 4x | 748 ms | 908 ms | 243 ms total | 13 MB |
| pre-react | 1x | 228 ms | 271 ms | none | 13 MB |
| pre-react | 4x | 656 ms | 806 ms | 89 ms total | 13 MB |

- **Babel's share of the load is ~93 %.** Compiling the blocks inside the page, `Babel.transform` per block
  (chars → ms at 1x / 4x): 28,002 → 142 / 836 · **347,563 → 1,091 / 5,097** · **204,653 → 1,124 / 6,286** ·
  28,178 → 174 / 1,289; **total 2.5 s at 1x, 13.5 s at 4x**, plus Babel's own 2.8 MB parse. (The in-page first
  compile is the long task above; it is one uninterruptible block, so the phone shows a blank dark screen for
  its whole length — first-paint at 276 ms is only the `body` background.)
- Precompiling is a **~14x** startup win at 1x and **~20x** at 4x, with identical behaviour (the page mounts and
  shows the title screen; same global-script semantics). Heap drops from 60–116 MB to 13 MB, which also matters
  on iOS where Safari reloads a tab it has to evict.
- Block sizes (chars): 28,077 · 349,157 · 205,195 · 28,246 (total ≈ 610 k). The 450 k-per-block cap in
  `test/html-balance.test.js` exists because Babel itself chokes — a symptom of the same cause.
- Not measured here: real-network CDN time, iOS JIT/parse speed. `probe.html`'s frame and tap meters give the
  device's own numbers for the animation side.

**Is in-browser Babel a major phone cost? Yes — the dominant one.** It is also a fixable one *without* a build
step *at runtime*: "no build" in `CLAUDE.md` means GitHub Pages serves what is authored. A tagged-template
framework (`htm`) needs no compile at all.

---

## 3. Options compared

Criteria weights reflect the brief: Melee-grade feel (60 fps, tap-in-a-frame) and phone startup first;
maintainability by future AI sessions and testability next; coexistence/guards last (all options can satisfy them).

| | A. React 18 + Babel standalone (today) | B. React 18 or Preact + **htm** (no compile) | C. Plain DOM + tiny renderer | D. Canvas / WebGL (PixiJS) for the table |
|---|---|---|---|---|
| Phone startup | 3.9 s / 17.5 s @4x (measured) | **~80 ms ready @4x** for a Preact+htm spike (13 KB lib, 5.4 KB gz); React+htm ≈ 47 KB gz | best (0 KB) | worst of the three: Pixi ≈ 450 KB gz + texture upload |
| Locked 60 fps | possible, but React reconciliation re-runs 600 k chars of closures per state change | **yes**: spike animated 40 cards with the Web Animations API at 4x CPU — **60.3 fps, p95 16.7 ms, worst 16.8 ms** (compositor transforms) | yes (you write the diffing) | yes for sprites; text, a11y and card-text legibility cost more |
| AI-session maintainability | familiar JSX, but one 349 k-char block is not editable by search-and-replace safely | **JSX-like** templates, plain `.js` files, normal tooling; any model writes htm well | highest risk: a bespoke renderer is a second framework to document | low: layout, hit-testing, text, focus all hand-built |
| Page-drive testability | DOM elements, fine | **DOM elements** → the same `page.js` element-box asserts | DOM, fine | **poor**: one `<canvas>`; no element boxes to assert (needs a parallel scene-graph API) |
| Coexists behind a switch | yes (already) | **yes**, as a separate page (§4) | yes | yes |
| `sync.test.js` / `wire.test.js` | untouched | untouched (new page and folder are outside `engine/` and outside `index.html`) | untouched | untouched |
| Text, selection, a11y, VoiceOver | native | **native** | native | none without work |
| Risk | Babel stays; startup cannot be fixed | CDN path to confirm on first build; hooks idiom | owning a framework | art/text fidelity, fonts, drive blind |

**Decision: B — Preact 10 + htm, in a new page.** Preact is the right half of B (11 KB, same hooks API as React,
`class`/`onClick` both accepted, no synthetic-event layer to fight iOS touch with), but the call is two-way
reversible: htm renders to either (`htm.bind(React.createElement)`), so if the CEO prefers React 18 (already
cached in users' browsers from today's page), the components do not change.

Why not D: the table is mostly **text and cards that must be legible and tappable** (hand row scrolls the phone's
own way — a native scroller, `BRIEF.md`); canvas would rebuild scrolling, hit-testing and type rendering, and
remove element-box asserts, the project's main UI regression tool. WebGL may still serve **one decorative layer**
later (impact flashes) behind a feature flag; it is not the foundation.

---

## 4. The recommended foundation

### 4.1 Where the code lives
A **second entry page**, not a mode inside `index.html`:

```
play.html                     the new shell's page (title: Dawnblade); loads data/, engine/ scripts exactly as
                              index.html does, then ui/ scripts. NOT babel. No <script type="text/babel"> at all.
ui/
  lib/htm-preact.js           pinned copy of htm@3.1.1 /preact/standalone.umd.js (13 KB) — see "CEO decides" in §6
  tokens.css                  design tokens from the design team (:root vars incl. --u, --safe-*)
  shell.css                   stage, bands, safe areas, layers (z-index table), card object
  boot.js                     viewport var script (§4.3), engine handshake, mounts <App/>
  app.js                      screen router (title / setup / table / trainer / result)
  table.js  hand.js  card.js  bout.js  pad.js  announce-view.js  sheets.js   components
  director.js                 the animation director (§4.4): the only file that touches Web Animations
  session.js                  adapters: local session, server table, trainer → one {state, legal, submit, onStep}
  audio.js                    unlock + cue player (PHONE.md rule 17)
test/ui-*.test.js             headless unit drills for pure parts (director queue, session adapters)
tools/ui-drive.js             WebKit + Chromium drives for the matrix in §5 (extends tools/page.js)
```

- **Switch with the classic page:** `index.html` stays the default until the user says otherwise. Entry is
  `play.html` (also `?ui=crescendo` on `index.html` does `location.replace("play.html" + location.search)` —
  one line, in the plain `<script>` before Babel runs, so a switched user never pays Babel). `play.html` carries
  a "classic board" link back. Same origin ⇒ the same `localStorage` keys (saved games, name, settings are
  shared; the shell reads them through one `ui/session.js` wrapper, try/catch'd).
- **Guards:** `test/sync.test.js` and `test/wire.test.js` read **only `index.html`** and `engine/*.js`:
  - no-mirror: new code lives in `ui/`, outside `engine/`; it re-declares **no engine export** and uses
    namespaced access (`DawnView.view`, `DawnJudge.legal`, `DawnAnnounce.say`, `DawnLocal.createLocal`,
    `DawnServerTable`, `DawnPrompts`) — never the `index.html` bridge (the bridge does not exist on `play.html`;
    a new drill, `test/ui-sync.test.js`, asserts `ui/*.js` and `play.html` name no bridged bare global, and that
    every engine script `play.html` loads is also loaded in `index.html`, in the same order).
  - load order: `play.html`'s engine `<script src>` list is generated-checked against `index.html`'s by that
    drill (parser before dependents; `data/pool.js`, `data/crkw.js` first). `wire.test.js`'s "every `engine/*.js`
    is loaded by index.html or HEADLESS" is unaffected: no new file lands in `engine/`.
  - the 450 k babel cap: irrelevant to `play.html` (no Babel); each `ui/*.js` is a normal file, so the cap
    stops being a design constraint. Add a `ui/*.js ≤ 60 KB` guard to keep modules readable.
  - `WIRE_V` is untouched: the shell adds no payload shape.

### 4.2 How the shell reads the engine (no new rules, no copies)
- **State in:** `DawnView.view(state, seat)` is the only input to rendering — the shell never reads hidden zones
  (`HIDDEN-HANDS.md`); components take `v` (the seat's view) and `legal = DawnJudge.legal(state, seat)`.
- **Choices:** `promptQ` entries (`prompts.js` specs: `opt pick modal pay reveal target alloc soak`) render
  through one `<Sheet spec>` component per kind; `test/promptctl.test.js` and `speccensus.test.js` already pin the
  field/answer set, and a new `test/ui-prompts.test.js` makes the shell cover every kind the module accepts.
- **Voice and pad:** `DawnAnnounce.say(step, viewer)` → lines for the director; `marks(step)` → the life pad.
- **Local / AI seat:** `DawnLocal.createLocal({... pace, onStep, later, cancel})` — `pace` makes the AI seat act
  one action per tick; `onStep({seat, action, prev, next})` feeds announce and the director, and a board push after
  each. The shell's session adapter exposes `{state(), submit(a), subscribe(fn), onStep}` — the shape local.js
  documents ("exactly the surface TableBoard already drives").
- **Server tables:** `engine/servertable.js` (`DawnServerTable`, ranked, clock, ladder) behind the same adapter;
  the shell never talks to Supabase directly. `DawnHub` / `DawnRoom` (two-phone) likewise.
- **The trainer** (`Battle`, the dummy) is closed over `index.html`'s babel block today. Phase 1 of the new shell
  is the **table** (judge.js, which already seats a person vs the AI hero, and the dummy via `buildVanilla`);
  the trainer's tuned `[3,4,5]` dummy stays on the classic page until it is ported to the merged path
  (`CLAUDE.md`: "the trainer does not retire until the merged path passes the same drills").

### 4.3 Layout system — decision: **width-scaled units on an elastic stage with named height bands**
Considered: (1) a **fixed design canvas** (e.g. 390×844) scaled by `transform: scale()` to the visible
viewport; (2) **fluid** `clamp()` everywhere.

- (1) gives literal pixel-perfect art direction, but heights on iPhones vary by 1.7x (548 → 932 visible), so a
  single canvas either letterboxes badly (bars of dead mat at 430×932) or crops (SE). `transform:scale` also
  blurs text on iOS when the scale is non-integer, makes `position:fixed` and scrolling inside a scaled node
  unreliable in Safari, and forces every hit target to be reasoned about in two coordinate systems.
- (2) pure fluid is how the current sheet drifted: every rule picks its own clamp, nothing is reviewable.

**Chosen:** one unit and three rules, so the designer's px map 1:1 and the stage is never scrolled:
1. **One CSS unit:** `--u: min(calc(100vw / 390), calc(var(--vh) / 620))`. Design values are written as
   `calc(N * var(--u))` — N is the design team's px at 390 wide, and 1u = 1 design px at 390×620. A phone
   narrower or shorter than the design box scales *everything* down together (no overflow, no wrap); a phone
   wider only scales up. Minimum tap target is enforced in `max(44px, …)`, never in `u` (a 44-pt floor does not
   scale down). Type is `max(11px, …)`; no text under 11 px.
2. **Elastic height, banded:** the stage is `height: var(--vh)` (never `100vh`), a flex column with the table
   mat as the one `flex:1` region. The design box is 390×620 (the shortest visible area that fits all chrome and
   one card row); height beyond 620u becomes mat, never gaps between chrome. Three bands, set as `data-band` on
   the stage by `boot.js` from `--vh/--u`: `compact` (≤ 580u-equivalent: SE, landscape-less), `regular`, `tall`
   (≥ 760u-equivalent) — the design team specifies the few things that *change* per band (card-row size, whether
   the hero art shows), nothing else.
3. **`--vh` is one number, from one place:** `boot.js` sets `--vh` from `visualViewport.height` (fallback
   `innerHeight`) in a single rAF-throttled `resize` listener, **and** every use has a CSS fallback chain
   `height: 100%; height: 100svh; height: var(--vh)`. The stage is `position:fixed; inset:0` with
   `overflow:hidden`, `html,body{overflow:hidden; overscroll-behavior:none}` — there is nothing to scroll, so
   Safari's toolbars never collapse mid-game (the user can still collapse them, the stage follows through
   `visualViewport`). No component reads `innerHeight` or `getBoundingClientRect` to size itself; measurement is
   for tests only (this removes the `--lochrome/--peekbot` class of bug).
4. **Safe areas:** the stage pads itself once with `padding: env(safe-area-inset-top) env(safe-area-inset-right)
   env(safe-area-inset-bottom) env(safe-area-inset-left)`; no inner component uses `env()` itself.

Pixel snapping: sizes that become sub-pixel at a given `--u` are rounded with `round(…, 0.5px)` where supported
(Safari 15.4+ for `round()`; others fall through to the unrounded value) for borders/hairlines; hairlines are
`1px` (device px via `border-width:1px`), not `calc(u)`.

### 4.4 Animation approach
- **Everything animated is `transform` or `opacity`**, on elements pre-promoted with `will-change` only while
  animating (not left on — iOS memory). No `width/height/top/left/box-shadow/filter` animation. The life-bar trail
  animates `transform: scaleX()` from a fixed-width track with `transform-origin:left` (replaces `transition:width`).
- **One director** (`ui/director.js`) owns time: it consumes `announce.say` lines and board pushes as a **queue of
  named beats** with fixed durations (`MOTION.md` from the design team supplies the table), runs them with the
  **Web Animations API** (`element.animate`, compositor-driven, cancel/finish/`playbackRate` for skip/tap-through),
  and exposes `idle()` as a promise. Components never call `animate`. The same event always takes the same time.
- **FLIP for movement** (card from hand → chain → graveyard): measure first/last once per beat (outside any
  running animation), animate the delta with a transform. Cards are DOM nodes with a stable `key = uid`; the
  renderer must move nodes, never recreate them mid-flight.
- **Render discipline:** state changes render once per accepted engine step; the director then plays beats against
  the freshly rendered DOM. Press feedback is CSS `:active` + a `pointerdown` class on the element (PHONE.md rule 9),
  independent of any render.
- **Budget:** at 4x CPU, p95 frame ≤ 16.7 ms (+ 1 frame tolerance), no frame > 33 ms during any beat; input→press
  state ≤ 1 frame. Enforced by the drill in §5. The spike (40 animated cards, Preact+htm, 4x) measured 60.3 fps /
  worst 16.8 ms in Chromium; the same drill on WebKit (once available) is the arbiter.
- **Images:** `<img decoding="async" width height>` with the card box reserved, art pre-decoded
  (`img.decode()`) before its beat starts; a card never pops from empty to full in a beat.
- **Audio:** one `AudioContext` created and resumed on the first `pointerdown` (iOS rule), `audio.js` plays cues
  scheduled on its clock; sounds are best-effort, never block a beat.

### 4.5 No-build mechanics
- Libraries: one pinned UMD (`htm@3.1.1/preact/standalone.umd.js`, 13 KB) — vendored under `ui/lib/` (zero extra
  hosts, works from `file://`, survives CDN outages) **or** a `<script>` from `cdn.jsdelivr.net/npm/htm@3.1.1/...`
  (permitted CDN, exact version). Fonts: self-hosted woff2 under `ui/fonts/` (§PHONE.md rule 11) instead of Google.
- Files are classic `<script src>` in dependency order, each an IIFE assigning one `window.DawnUI*` namespace
  (the same UMD discipline as `engine/`). No ES modules (they fail from `file://` in Safari).
- `tools/page.js` already routes CDNs from `node_modules`; add `htm` to its dep list only if the CDN route is
  chosen. With vendoring, `play.html` needs no routing.

---

## 5. Test plan

All drives live in `tools/ui-drive.js`, built on `tools/page.js` `open()` (deps in a scratch dir). Element-box
asserts, not screenshots.

**Engines:** Chromium (always) **and WebKit** (blocked here, §1.1; the drive must *skip loudly* with the exact
reason, never silently pass). Run the whole matrix in both. Chromium uses `isMobile`, `hasTouch`, `deviceScaleFactor 3`;
WebKit uses `devices['iPhone 15']` overridden to each viewport.

**Viewport matrix (visible size, CSS px):** 375×548 (SE with toolbars) · 393×660 (iPhone 15/16 with toolbars) ·
430×932 (Pro Max, toolbars collapsed) · **standalone 393×852 with safe areas** (emulate insets by injecting
`:root{--test-sat:59px;--test-sab:34px}` and a `safe-area-inset-*` shim: Chromium cannot set `env()`, so the
stage reads `var(--sat, env(safe-area-inset-top))`-style fallbacks only in the test build via `?safe=59,0,34,0`;
WebKit on a real device or via the probe confirms the real `env()`), plus landscape 660×393 (must show a
"rotate" state, not break).

**Per screen × viewport, assert (boxes in CSS px):**
1. no horizontal scroll; `scrollHeight == innerHeight` (nothing to scroll) on every stage screen;
2. every interactive element ≥ 44×44 and fully inside the safe rectangle; no two interactive boxes overlap
   (except a deliberate layer and its dismiss target);
3. life totals are the largest text on screen (computed font-size comparison);
4. hand row: cards fully visible at rest, scrollable by native scroll, scroll-snap off; no card < the band's min;
5. text ≥ 11 px computed (walk the DOM; the check `sizes.js` in this scout's scratch is the prototype);
6. both seats' public facts at the same size and place (mirror box equality within 1 px);
7. every input/textarea computed `font-size ≥ 16px`; viewport scale stays `1` after focusing each (WebKit only
   for the scale assertion; the font-size assertion runs in both).

**Frame-time budget drill:** with CDP `Emulation.setCPUThrottlingRate(4)` (Chromium) — the director plays a fixed
script of beats (play, pitch, block, hit, life change, turn change) while a rAF recorder logs frame deltas;
fail if p95 > 20 ms or any frame > 34 ms or `longtask` > 50 ms during a beat; WebKit has no CPU-throttle CDP, so
the same script runs unthrottled there with a 16.7+4 ms p95 bound, and `probe.html` supplies the device truth.
Also: `PerformanceObserver('layout-shift')` sum during a full game start→finish must be 0 after first paint (fonts
are self-hosted and preloaded, so no swap shift).

**Startup drill:** time to app mounted at 4x ≤ 1,500 ms (spike: ~80 ms bare; budget leaves room for the pool
parse), no `longtask` over 200 ms before first paint, heap ≤ 40 MB.

**Interaction drills:** tap latency (`pointerdown` → next frame shows a press state class) ≤ 1 frame; a refused
play shows its reason by name (assert the toast text equals the engine refusal string, per `BRIEF.md`); every
prompt kind in `prompts.js` is answerable by tap alone; `trainchaos`-style random taps through whole games on the
new shell (extend `tools/trainchaos.js` to `play.html`).

**Static drills (`npm test` family, no browser):** `test/ui-sync.test.js` (no engine re-declare, load-order parity
with `index.html`, no bridged bare globals, no `vh` unit/`innerHeight` use in `ui/*.css|js` except `boot.js`);
`test/ui-phone.test.js` implementing the grep-able rules of `PHONE.md` (each rule names its check).

---

## 6. What the CEO must decide
1. **Unblock WebKit:** allow `cdn.playwright.dev` and `playwright.download.prss.microsoft.com` in the
   `dawnblade-ai` cloud environment (smallest change; or run WebKit drives on the user's Mac). Without it no worker
   can verify the one thing the user complained about.
2. **A separate `play.html` (recommended) vs. replacing `index.html`'s shell.** Separate = classic page untouched,
   zero Babel for new-shell users, no 450 k cap; cost = two entry pages until the switch flips.
3. **Vendor the 13 KB library and self-host fonts under the repo (recommended)** vs. CDN-only. `CLAUDE.md` says
   libraries come from CDN `<script>` tags; vendoring a pinned file is still "no build" but it is a rule-text
   amendment the user should bless.
4. **Standalone (Add to Home Screen) as an opt-in for the new shell.** Today it is deliberately off
   (index.html 7–11: iOS keeps separate storage for standalone apps). Standalone removes Safari's toolbars (the
   cleanest canvas for Melee polish) but splits saved games; a one-time "import from Safari" flow or
   server-side saves (Supabase) would be needed. Design for both either way.
5. **Should the classic page also be fixed meanwhile?** Cheap, independent wins: `font:13px/1.5 inherit` bug,
   `touch-action:manipulation`, `-webkit-touch-callout:none`, `dvh` fallbacks, and precompiling the babel blocks
   (14x startup) — but each is a change to `index.html`, so it is a scoped decision outside this mission.
