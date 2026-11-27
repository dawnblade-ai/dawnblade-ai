# CRESCENDO — the release UI, the brief every worker reads first

**What this is.** The user's "last hurrah" (CEO thread, 2026-11-27): a new graphical framework for the RELEASE
version of Dawnblade, designed first in great detail, then built, sparing no expense. It supersedes the *look* of
both the classic board and Table Talk (`docs/TABLE-TALK.md`); it keeps Table Talk's *vision* (§0–§10 there are
user-approved). The folder `docs/crescendo/` holds the whole mission; its handoff is `README.md`.

## The user's words (2026-11-27)

> "We will continue to perfect the ui. … The screen needs to feel perfectly polished — remember our high water
> mark — super smash bros melee over 20 years later and it facilitates fair competitive games. I'm understanding
> extreme difficulty in polishing the output on the actual phone. Start the graphical framework from scratch if you
> need to. Focus one team on how things *should* look in great detail before trying to bring the designs to life.
> Then have the development team work out the intricacies of the graphical design, sparing no expense to bring the
> vision from the design team to life. This is the last hurrah. A blank new canvas to lay a new framework for the
> release version of the game — the crescendo of all your hard work. Bring the game to life for the fans of flesh
> and blood world wide, for James and LSS and for the people of the future who will discover this amazing game."

Standing directions that still bind (user, 2026-11-25/26): **gameplay first, as simple as possible; focus on the
cards and the experience of playing in real life; the fighting-game health bars (the bout) are the one piece of
fighting-game chrome; the hand is a FLAT row that scrolls the phone's own way — never an arc or wheel; no log in
ranked — a scratch pad of life changes; every play is announced, bold, one at a time; every card played or pitched
is glimpsed large, once, then lands where it lives.** "The little details are everything."

## What "Melee" means here (POLISH.md has the full bar)

1. **Feel is a number.** Input → visible response within one frame (16 ms); every animation transform/opacity only,
   locked 60 fps on a mid iPhone at 4x CPU throttle; nothing jitters, nothing reflows mid-animation.
2. **Readable at a glance, competitively fair.** Both players always see the same public facts, in the same place,
   at the same size. Life totals are the biggest numbers on screen. Hidden information is never hinted.
3. **The stage is clean.** Final Destination, not a busy level: bare mat, the cards are the stars, chrome is minimal
   and consistent. One primary button. Every pixel has a job.
4. **Timing is consistent.** The same event always takes the same time and looks the same way, so players build
   rhythm. Fast enough for experts (skippable / tap-through), legible for newcomers.
5. **The tap is never lost.** Every tap answers (a press state within a frame); a refused play says why, by name.

## The phone is the platform — the hard truth

It is played in **iPhone Safari**. Design and build against the VISIBLE area, not the device:
- iPhone 15/16 (393×852 device): Safari with toolbars ≈ **393×660** visible; toolbars collapse on scroll — the
  game must not depend on scroll. Also hold at **375×667** (SE, ≈375×548 visible) and **430×932** (Pro Max).
- Safe areas (notch / Dynamic Island / home indicator) when added to the home screen; `env(safe-area-inset-*)`.
- WebKit, not Chromium: fonts, sub-pixel rounding, `backdrop-filter` cost, 100vh vs `dvh/svh`, tap highlight,
  long-press callouts, double-tap zoom, text-size-adjust, overscroll bounce all differ. The drives so far ran
  Chromium at 393×852; what the user sees has not matched.
- Touch targets ≥ 44 pt; thumbs live in the bottom third.

## The hard constraints (CLAUDE.md — never break)

- **No build step, ever.** No bundler, no ES modules, no package.json build. GitHub Pages serves the repo as
  authored; it must run from `file://`. Libraries only from CDN `<script>` tags at an exact version. (Babel
  standalone compiling JSX in the browser is today's choice, not a law — plain JS, `React.createElement`, or `htm`
  tagged templates also satisfy "no build".)
- **The engine is the engine.** `engine/*.js` (rules, AI, view, announce, wire) stays; a new UI is a new SHELL over
  `view(state, seat)`, `judge.legal`, `prompts.js` specs, `announce.js`. One copy of every shared function
  (the no-mirror rule). Never invent or hardcode card text — cards show their real art and parsed text.
- **What each seat may see** is `HIDDEN-HANDS.md` + `view.js`; ranked manners are TABLE-TALK.md §1.1/§7.
- Card art is the public card database's (FaB card images, portrait ≈ 0.716 width/height). Fan-made, non-profit,
  respectful of Legend Story Studios' art and trade dress — no imitation of official LSS branding.

## How the mission runs

1. **Design team** writes how everything SHOULD look and move, in px and ms, at the phone sizes above:
   `DESIGN-SYSTEM.md` + `tokens.css` (the visual language, the card object), `MOTION.md` (feel, timing, sound),
   `SCREENS.md` + `mockups/*.html` (every screen and state, static HTML a phone can open).
2. **Development team** first proves the foundation on the real platform (`PHONE.md`, `FRAMEWORK.md`, a probe page),
   then builds the new shell to the design, behind a switch, until it passes every gate and the user makes it the
   default.
3. Mockups are plain HTML/CSS that open from `file://` and from GitHub Pages
   (`https://dawnblade-ai.github.io/dawnblade-ai/docs/crescendo/mockups/`) so the user can judge them ON THE PHONE.
