# PHONE.md — the phone contract

Every CRESCENDO screen obeys these rules. Each has a **why** (what broke or would break on an iPhone in Safari)
and a **check** (how a drill proves it). "Static" checks run in `npm test` with no browser
(`test/ui-phone.test.js`); "drive" checks run in `tools/ui-drive.js` on Chromium **and** WebKit across the matrix in
`FRAMEWORK.md` §5 (375×548 · 393×660 · 430×932 · standalone 393×852 with safe areas). Evidence for the rules
that fix a *current* defect is cited as `index.html:line`.

The platform: iPhone Safari, WebKit, toolbars showing (visible ≈ 393×660, SE ≈ 375×548), sometimes standalone.
Calibrate to the user's device with `docs/crescendo/probe.html`.

## Viewport and units

1. **Viewport meta is exactly** `width=device-width, initial-scale=1, viewport-fit=cover` — no `maximum-scale`,
   no `user-scalable=no` (iOS ignores them for accessibility, and they hide real zoom bugs).
   *Why:* `viewport-fit=cover` is what makes `env(safe-area-inset-*)` non-zero; scale locks are ignored by iOS 10+.
   *Check:* static — `play.html` meta string equals the contract; drive — `visualViewport.scale === 1` after load
   and after focusing every input.

2. **Never size anything from `100vh`.** The stage height is `var(--vh)` set from `visualViewport.height` in one
   place (`ui/boot.js`), with CSS fallback `100%; 100svh`. `dvh/svh/lvh` appear only in `shell.css`'s stage rule.
   `vh` is banned in `ui/*.css` and `ui/*.js` outside `boot.js`.
   *Why:* in Safari `100vh` is the large viewport, taller than what is visible with toolbars out; 5 rules in the
   classic page use it (`index.html:45, 715, 954, 1031`, caps at 866, 1058, 1534), which Chromium emulation cannot
   reveal. *Check:* static — grep `\d+(\.\d+)?vh\b` and `innerHeight` in `ui/` fails the build; drive — at each
   viewport `stage.getBoundingClientRect().height === visualViewport.height` (±1).

3. **No component measures itself.** No `getBoundingClientRect`/`innerHeight`/`ResizeObserver` result feeds back
   into layout (`--peekbot`, `--lochrome` in `index.html:3417–3493, 8165–8205` are the anti-pattern). Layout is CSS
   units + flex; measurement is allowed only in the animation director for FLIP (rule 15).
   *Why:* `innerHeight` changes continuously while Safari's toolbar animates; a measure→write→measure loop
   thrashes and mixes two viewports. *Check:* static — grep for `--` custom properties written from JS other than
   `--vh` and the band attribute; drive — layout-shift observer sums to 0 after first paint.

4. **One unit.** Sizes are `calc(N * var(--u))` with `--u: min(calc(100vw / 390), calc(var(--vh) / 620))` (N = the
   design team's px at 390 wide). No raw `px` for layout in components (hairlines `1px`, tap floors, and type
   floors excepted). *Why:* one scale means the design team's numbers are what ships, and nothing overflows when the
   phone is smaller than the design box. *Check:* static — a raw-`px` allowlist lint over `ui/*.css`;
   drive — at 375×548 and 430×932 every box equals the 393×660 box × (u₂/u₁) within 1 px.

5. **The stage never scrolls.** `html,body{overflow:hidden;overscroll-behavior:none}`; the stage is
   `position:fixed; inset:0`. Only named regions scroll (the hand row, a sheet's body, the log), each with
   `overscroll-behavior:contain` and `-webkit-overflow-scrolling:touch` implied. *Why:* scrolling collapses
   Safari's toolbars and resizes the viewport under every unit (the classic setup screen's scrollHeight is
   732 at 375×548 and 741 at 393×660, measured). *Check:* drive — `documentElement.scrollHeight ===
   innerHeight` and `scrollWidth === innerWidth` on every screen; programmatic `window.scrollTo(0,50)` leaves
   `scrollY === 0`.

## Safe areas

6. **The stage pads the safe area once**, from `env(safe-area-inset-*)` (with the test shim's `--sat/--sab`
   fallbacks); inner components never touch `env()`. Fixed/sticky layers are children of the stage, not of
   `body`. *Why:* the classic sheet repeats `env()` in 14 places with different arithmetic
   (`index.html:65, 70, 382, 637, 681, 1058, 1109, 1143, 1204, 1321, 1477`). *Check:* static — `env(` appears only in
   `shell.css`'s stage rule; drive — standalone matrix: every interactive box inside
   `[inset-left, W-inset-right] × [inset-top, H-inset-bottom]`, the primary button's bottom ≥ 8 px above the
   home-indicator inset.

## Touch

7. **Touch targets ≥ 44×44 CSS px**, measured on the *hit area* (padding or a `::before` extension counts; the visible
   glyph may be smaller). Targets do not overlap except a layer and its dismiss. Primary action is in the bottom
   third. *Why:* Apple HIG; the classic `.advhead::after{inset:0 0 -18px}` hack (`index.html:337`) exists because
   this was patched per screen. *Check:* drive — `elementsFromPoint` over a 4 px grid of each target; box ≥ 44
   in both axes; pairwise-overlap scan.

8. **Declare touch behaviour globally:** `html{touch-action:manipulation}` (no double-tap-zoom, no 300 ms),
   `-webkit-touch-callout:none` and `-webkit-user-select:none; user-select:none` on the stage (re-enabled only
   on selectable code boxes), `-webkit-tap-highlight-color:transparent`, `-webkit-text-size-adjust:100%`.
   *Why:* the classic page has `touch-action` 0×, `-webkit-touch-callout` 0×, `text-size-adjust` 0×, `user-select`
   1× — long-press on a card shows the iOS callout, double-tap can zoom, rotation inflates text.
   *Check:* static — the five declarations exist in `shell.css`; drive — computed style on `html`/stage; dispatch a
   synthetic double-tap and assert `visualViewport.scale === 1`.

9. **Every tap answers within one frame.** Press feedback is a CSS `:active` state **plus** a `pointerdown` handler
   that adds a `.pressed` class (iOS `:active` is unreliable without a touch listener on the document; keep a no-op
   `touchstart` passive listener on `document`). Act on `pointerup` for commits, `pointerdown` only for press
   state; `click` is never the first reaction. A refused action says why, by name, inside the same frame budget.
   *Why:* Melee bar ("the tap is never lost", `BRIEF.md`); the classic sheet has 4 `:active` rules. *Check:* drive —
   `pointerdown` then read the class on the next `requestAnimationFrame`: `pressed` present for every interactive
   element class in a catalogue; assert tap→reason-toast for a seeded illegal play.

10. **Gestures are explicit.** Horizontal scrollers set `touch-action: pan-x`; draggable cards `touch-action: none`
    only while dragging. Nothing depends on hover, long-press, or a second finger. Edge-swipe back is not
    suppressed (do not capture the left 20 px). *Why:* a card game that also scrolls a hand row needs an
    unambiguous axis; hover does not exist. *Check:* static — grep `:hover` outside `@media (hover:hover)`;
    drive — a vertical touch drag on the hand row does not scroll it; a horizontal one does.

## Fonts

11. **Self-host and preload the fonts; no layout shift.** woff2 files under `ui/fonts/`, `@font-face` with
    `font-display: block` for a ≤ 100 ms block period on the display face and `swap` on body faces **with
    size-adjusted fallbacks** (`size-adjust`, `ascent-override`) so the swap moves nothing; `<link rel=preload
    as=font crossorigin>` for the two faces the first screen uses. *Why:* the classic page asks Google Fonts
    (render-blocking stylesheet, `index.html:31–33`; 4 families, 9 weights) and then re-measures when fonts land
    (`index.html:8182`). *Check:* drive — `PerformanceObserver('layout-shift')` sum = 0 from first paint to
    `document.fonts.ready`; `document.fonts` every face `loaded`; no request to `fonts.googleapis.com`.

12. **Type floors:** body ≥ 14 px, secondary ≥ 12 px, nothing under 11 px; **every `input`/`textarea`/`select` is
    ≥ 16 px** (iOS zooms the page on focus below 16 px and does not zoom back); set `font-family` and `font-size`
    explicitly on form controls (they do not inherit). Never use the `font:` shorthand with `inherit`.
    *Why:* `.bugta{font:13px/1.5 inherit}` (`index.html:1066`) is an invalid declaration → 13.33 px textarea with
    `autoFocus`; `--fs-xs/--fs-sm` are 10 px (`index.html:47`), and 29 setup-screen text nodes render under 11 px.
    *Check:* drive — walk every text node, computed `font-size ≥ 11`; for every form control `font-size ≥ 16`,
    then focus it and assert `visualViewport.scale === 1` (WebKit). Static — grep `font:[^;]*inherit`.

13. **Numbers are the loudest thing.** Life totals use tabular numerals (`font-variant-numeric: tabular-nums`) in a
    fixed-width box so a change never reflows; they are the largest computed font-size on every screen that shows
    them. *Why:* competitive fairness and Melee readability (`BRIEF.md` §2); proportional digits jitter when
    life ticks. *Check:* drive — `max(computed font-size)` element is a life total; its box width is identical
    across values 0…40.

## Images and cards

14. **A card is an object with a reserved box.** `<img>` always has `width`/`height` (or `aspect-ratio: 5/7`-style
    ratio ≈ 0.716), `decoding="async"`, `alt`; art for any card about to animate is awaited with `img.decode()`
    before its beat starts; `loading="lazy"` only for off-screen browse lists. Image `src` is the pinned art path;
    a missing image shows the card's real name and parsed text on the same box, never a collapse. *Why:* the
    classic images are `loading="lazy"` with no `decoding` or size (`index.html:2648, 2868, 3225`) — a card landing
    mid-animation can pop in and reflow. *Check:* drive — layout-shift sum 0 through a scripted deal; static —
    lint `<img` without width/height/decoding in `ui/`.

## Motion

15. **Animate only `transform` and `opacity`.** No transitions/keyframes on `width/height/top/left/margin/padding`,
    `box-shadow`, `filter`, `text-shadow`, `background-position`; glows are pre-rendered layers whose opacity
    animates. Use `will-change: transform` only while a beat runs (remove after `finish`); never on more than ~12
    elements. One `animation director` owns time (Web Animations API); a component never starts its own animation.
    *Why:* the classic sheet animates width (`index.html:565, 568, 1451, 1454`), `top` (`1419`), box-shadow
    (`571, 1406`), text-shadow (`1312–1315`); iOS repaints those on the main thread. *Check:* static — lint
    `@keyframes`/`transition` property lists against the allowlist; drive — frame-time budget drill (p95 ≤ 20 ms,
    no frame > 34 ms, no `longtask` > 50 ms during any beat at 4x CPU) and `layout-shift` = 0.

16. **Reduced motion is honoured and costs nothing.** `@media (prefers-reduced-motion: reduce)` swaps every beat
    for a ≤ 120 ms cross-fade and still announces every play (text is never skipped). The same event takes the same
    time otherwise (timing table in `MOTION.md`). *Why:* accessibility and rhythm. *Check:* drive —
    `emulateMedia({reducedMotion:'reduce'})` plays the scripted game with every beat ≤ 120 ms and the same
    announce lines.

## Audio

17. **Audio unlocks on the first user gesture and never blocks.** Create one `AudioContext`, `resume()` it inside a
    `pointerup` handler (iOS refuses before a gesture and re-suspends after the tab is backgrounded — resume on
    `visibilitychange`); a mute/volume setting persists; cues are scheduled on the audio clock, fire-and-forget; a
    failure is silent. The silent-switch mutes WebAudio on iOS: the UI never depends on sound to convey state.
    *Why:* the classic sound code resumes lazily (`index.html:3096–3110`); a missed unlock is a silent first game.
    *Check:* drive — `AudioContext.state === 'running'` after the first tap; after
    `visibilitychange` hidden→visible it returns to `running` on the next tap; no unhandled rejection.

## Performance and lifecycle

18. **Startup budget.** No `text/babel`, no render-blocking third-party stylesheet or script before first paint;
    first paint shows the real title screen (not a blank body) and the app mounts within 1,500 ms at 4x CPU;
    heap ≤ 40 MB; no `longtask` > 200 ms before first paint. *Why:* measured on the classic page — FCP 3.9 s at 1x,
    **17.5 s at 4x**, one uninterruptible 3.5 s/16.4 s task (Babel), vs 0.24 s / 0.75 s precompiled
    (`FRAMEWORK.md` §2). *Check:* drive — startup drill; static — no `type="text/babel"` in `play.html`; the only
    external hosts are the allowlisted ones.

19. **Background and resume are safe.** On `pagehide`/`visibilitychange:hidden` the session persists its state;
    on return the stage re-reads `visualViewport` (toolbar and orientation may have changed), re-resumes audio,
    and reconnects a server table without a user action. iOS may discard a backgrounded tab: a cold load
    restores the game from storage (every storage call in try/catch — private mode throws).
    *Why:* phones background constantly; a lost game is the worst tap. *Check:* drive — dispatch `pagehide` +
    reload mid-game and assert the same state hash; storage blocked (`Storage.prototype.setItem` throws) → still
    renders and plays.

20. **Orientation:** portrait is the design; landscape shows a single "turn your phone" state (no half-broken
    layout) and never loses game state. *Check:* drive — 660×393 shows the rotate state, no interactive
    elements outside it; rotating back restores the same DOM.

## Hygiene that keeps the rules true

21. **Every rule above has its drill in `test/ui-phone.test.js` (static) or `tools/ui-drive.js` (drive) before a
    screen ships;** a drill that cannot run on WebKit says so loudly (exit code, message) and is never counted as a
    pass. Sabotage each new drill once (as `CLAUDE.md` requires) and confirm it fails.

22. **Calibrate, don't guess.** Any new phone constant (band thresholds, the 620-unit design height, the tap-latency
    budget) is checked against a `probe.html` screenshot from the user's device and recorded in the commit that
    introduces it.
