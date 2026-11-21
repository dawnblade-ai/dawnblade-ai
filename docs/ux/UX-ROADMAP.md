# UX ROADMAP — the graphical overhaul, phased

Audit taken 2026-11-19 at v6.46 by driving the real page offline (`node tools/page.js`'s
`open()`) at 393x852. Offline, card and hero art are grey stand-ins, so judge layout,
type and hierarchy here, not art. Before/after pairs sit beside this file
(`before-*.jpg` / `after-*.jpg`, deviceScaleFactor 2).

## 1. The audit, ranked by how much a phone player sees it

1. **The result screen was the weakest screen in the game.** The table's loss overlay
   was see-through: `.reveal` + `.lose` let the plain `.lose` panel rule
   (`background:rgba(196,48,43,.08)`) replace the overlay's dark ground, so the board
   showed through the words. The way out was "Tap anywhere." in 13px body text. The
   trainer's loss was not an overlay at all but a box under the board. Four hand-copies.
2. **Life totals and resources were hard to read.** The scorebar was one 11px mono strip
   ("20 you · R0 A1   kayo 20"), hand-copied on both boards; R and A were letters a
   new player cannot decode.
3. **Almost no control answered a finger.** Only `.judgebtn` had an `:active` state; a
   tap that lands looked identical to one that missed until the game moved.
4. **Status-line buttons ("skip", "✕ cancel") painted at 9px** with a faint border:
   the hit area was already finger-sized (an invisible `::after`), the paint was not.
5. **The empty arsenal was a stray lowercase word** ("arsenal", body font) next to
   dashed weapon slots that read as slots.
6. **Roster names at 8.5px** under 58px tiles; long names ellipsize ("LYATH GOLDMA…").
7. **The chain pane's empty "Most recently played lands here" box** holds ~290px of
   the pane while the hand rail below is cramped and clips its fifth card.
8. **Your-board pane overflows its flick height**: the WASTED / TURN / inspect pills
   sit under the pane's bottom edge at 393x852 (scroll inside the pane to reach them).
9. **Two primary-looking fight buttons on the loadout** (striped FIGHT and FIGHT THE
   NEW ENGINE — HARDER) with long prose between; the hierarchy says both are main.
10. **The duplicate arsenal label** ("ARSENAL" in the slot, "ARSENAL" under it), and
    the opponent pane's `arsenal —` in body type where every other slot label is mono.
11. **No motion language.** Panes snap, cards appear, damage pops (`.dmgpop`) exist but
    nothing ties a played card to where it went. No sound (POLISH §4, deliberately last).

## 2. What was built (this session)

| # | change | where |
|---|---|---|
| A | `EndPanel` — one result screen for every ending on both boards (trainer win/draw/loss, table win/loss/draw, the table's Dummy win). Opaque ground tinted by the outcome, a 44px headline in the outcome's colour with a short scale-in, the life left as a stat, a 51px full-width leave button ("Back to heroes" / "Leave the table"), "or tap anywhere" kept. The heading stays the overlay's first text line (page.js reads it). Fixes the see-through loss. | `index.html` script1, `EndPanel` above `DrawPanel`; CSS after `.reveal .rar` |
| B | `LifeHud` — shared life HUD replacing both hand-copied scorebars: both totals 30px display face, action points and floating resources as labelled chips (gold when non-zero), name ellipsized, a changed total pulses once (re-keyed span). Trainer still shows the Frostbite count. | `LifeHud` above `Ticker`; CSS before `.scorebar` |
| C | Press feedback: buttons sink 3% and brighten on `:active`; hand and hero tiles brighten only (their transform carries peek/selected). Off under `prefers-reduced-motion`. | end of `<style>` |
| D | Status-line buttons painted as gold-outlined mono chips (10.5px); the `::after` finger area unchanged. Empty arsenal drawn as a dashed 5:7 slot (`:has()`, CSS only). Roster names 9.5px. | CSS |
| E | §3 step 1 — `RailMore`, shared by both hand rails: the rail's last child, zero-width and sticky to its right edge, paints a fade and a gold "+N" chip counting the tiles not fully shown; gone at the rail's end; `pointer-events:none`, so a tap on it peeks the clipped card under it (no dead tap). The rail's "Hand" label now snaps into view. The empty featured slot is a faint 60% card silhouette (diamond, rounded edge, "Most recently played lands here" at its foot). A card face reserves its 5:7 box before the lazy image loads (`.cfw:not(.hz)>img`), so the rail no longer grows as art arrives and offline drives see online geometry (the stand-in PNG is 50x70: before this, offline rail tiles drew 72px tall instead of 111). | `RailMore` after `LifeHud`; CSS after `.phand .hc.dis`, `.centerslot .featempty`, `.cfw` |
| F | §3 step 2 — your board's footer (WASTED / TURN / SEAT / BOOST / inspect pills, `.mystat`, both boards) is sticky to the pane's bottom on the ink ground, so a board taller than the pane (tokens in play, a short phone) scrolls UNDER it instead of pushing it past the edge; its toggles take taps over 44px through an invisible `::after` inside the footer's own padding. Your empty arsenal says "empty" in the slot and "Arsenal" under it (it said "arsenal" twice); the opponent's `arsenal —` already wore the empty-slot style (row D). Measured: at rest the pills already fit at 393x852 and 360x740 once card faces reserve their box (row E); the overflow the audit saw was the jump caught mid-scroll plus the 50x70 stand-in, and a genuinely tall board (393x640) put them 49px under the pane. | CSS after `.vfillsp`; both `arscol`s |
| G | §3 step 3 — the loadout bar has ONE plate per mode, and the Foe picker decides it. The Dummy: "FIGHT THE DUMMY" (trainer) on the plate, "The dummy at the table — harder" as the plain `.bigbtn.alt` under it. Any AI hero or Random: "FIGHT KAYO — SHARP" (the table; the name and level follow the picker, set tighter so "Fight Lyath Goldmane — Steady" stays one line at 360px), "Train against the dummy instead" under it. Before, the striped FIGHT stayed the trainer with Kayo picked. Each button keeps its own handler (`onClick={start}` / `onClick={startTable}`) with `data-start="trainer"|"table"`; CSS `order` puts the plate first. The two paragraphs fold into a one-line `<details className="lowhy">` (summary 44px, "why?" / "less"); the bar went from 176px to 141px, and the Sharp / Steady tiles above it are no longer cut. Drivers (`tools/page.js`, `tools/page-audit.js`) start a board by `data-start`, not by the old button name; `phasebar` / `flow` drills re-anchored on the new markup (still sabotage-checked: the trainer note must say "tuned"). | `Loadout` action bar; CSS after `.lo .actbar .battlebtn` |
| H | §3 step 5, PART — `LifeNum`, shared: every life total on both boards (the four hero plates, `.hlife2`, and both `LifeHud` numbers) remembers the value it last drew; a drop re-keys with `lfdown` (a red flash and scale), a gain with `lfup` (green). The first draw and an unchanged total animate nothing; off under reduced motion. NOT built: the chain-link flash (hit / blocked) and the blue for prevention. A chain entry carries the attack's TOTAL (`dmg`), not whether it hit or what was prevented, so both need an engine field first (`effects.js`, which this session did not touch). | `LifeNum` above `LifeHud`; CSS before `</style>` |

Verified: both babel blocks compile; `node tools/page.js` 79/79 PASS (same as before);
box drive at 393x852 and 360x740 — HUD inside its box with the longest foe name, life
30px, result button 300x51, opaque result ground, heading first, button leaves to the
roster, status-line button owns its finger area above, below and beside, no scrollWidth
overflow, no page errors.

Step 1 verified: babel blocks compile; `node tools/page.js` 78/78 PASS (78 on this base, before and after); box drive on both boards at 393x852 and 360x740: chip reads "+3" / "+4" and equals the count of clipped tiles, sits inside the rail, takes no taps (a tap at its centre peeks the card under it), disappears at the rail's end, the silhouette is 60% of the slot and centred, no scrollWidth overflow, no page errors. `before-rail.jpg` / `after-rail.jpg`.

Step 2 verified: babel blocks compile; `node tools/page.js` 78/78 PASS; box drive on both boards at 393x852, 360x740 and 393x640 (content taller than the pane): every pill inside the pane, inspect takes taps over 44px and owns its centre, inspect still toggles, the arsenal is named once, no scrollWidth overflow, no page errors; sabotaged (footer `position:static`) the 393x640 rows fail (pills at 562..591 under a pane ending at 542). `before-board-fit.jpg` / `after-board-fit.jpg` (393x640).

Step 3 verified: babel blocks compile; `node tools/page.js` 78/78 PASS (its table rows now start by `data-start`; "Sharp / Steady clear the bar" passes); box drive at 393x852 and 360x740: one plate whose label follows the picker (Dummy, Kayo, Steady, Random, the two longest names one line at 45px), one secondary, every bar control >= 44px and owning its centre, the disclosure opens (bar 141 -> 222px) with the flick screen still ending above the bar (`--lochrome` re-measures), the hero plate opens the table against that hero, the Dummy plate the trainer, the Dummy secondary the table; no overflow, no page errors. `before-loadout.jpg` / `after-loadout.jpg` (Kayo picked), `after-loadout-dummy.jpg`.

Step 5 (part) verified: babel blocks compile; `node tools/page.js` 78/78 PASS; trainer drive at 393x852 and 360x740: nothing flashes on the first draw, the dummy's swings (20 -> 17 -> 13) flash `lfdown` on the plate and the HUD each time with the `lfdown` animation running, the plate number stays inside its plate, no overflow, no page errors. A gain was not forced in the drive (`lfup` is the same branch the other way). No screenshot: the flash lasts 0.6s.

| I | §3 step 4 — the roster tile shows the ILLUSTRATION (the art zoomed 1.42x past the card frame and printed name; the name label painted over the edge), names 10.5px, a name the tile cannot hold shows its first word ("Lyath"). `HeroBanner` under the roster for the picked hero: art at the left 42% fading into the panel, class and block with the block's colour as a swatch (the purple of block 4 failed contrast as text), the name 22px, the one-line pitch; Random gets a text-only banner. The legend is read off `HEROES` (`CH_COLOR`, `chapterName`): it names block 4. **Kept 6 across, not 4**: at 4 across the roster alone is ~590px and Battle leaves the first screen at 393x852. | `HeroBanner`, `CH_COLOR` above `HeroGrid`; CSS after `.hcard img.art` |
| J | §3 step 5, rest — an engine fact first: a chain entry carries `out` (`effects.linkOutcome(power, afterWall, dealt)`: hit / blocked / prevented / null for a 0-power swing), fed by judge's strike, the trainer's strike and the dummy's `takeIt`; WIRE_V 45. `LinkStamp` stamps the featured slot (red HIT n, bone BLOCKED, blue PREVENTED; scale-in, off under reduced motion) while `featOutcome` says the slot still shows that link; `ChainLink` dims a blocked tile and rings a prevented one blue (and says it in `title`). The trainer's dummy swing closes its chain at once, so its outcome lives on the link tile, not the slot. | `LinkStamp`/`featOutcome` above `ChainLink`; CSS after `.clink:not(:last-child)::after` |

Step 4 verified with REAL art (hero images fetched once into a scratch folder and served through `page.route`; `docs/ux/before-heroselect.jpg`, `after-heroselect.jpg`, `after-heroselect-360.jpg`): no name clipped at 393 or 360, banner 104-151px, Battle at y=470-518 (on the first screen), no sideways scroll, no page errors.
Step 5 verified: drill `test/linkout.test.js`; a trainer drive plays Clash of Agility into the dummy's wall and the slot stamps BLOCKED inside the centre slot (`after-linkstamp.jpg`).

## 3. The plan — one session each, in order

1. **DONE (see §2).** **Hand rail and peek polish.** Rail tiles are 80px and clip the fifth card with no
   hint. Add an edge fade + count chip ("+2") on the rail, and make the chain pane's
   empty featured slot a faint card silhouette at ~60% height so the rail can grow.
   Check: `--peekbot` still tracks (UI-GUIDE §5), page.js `peek` checks.
2. **DONE (see §2).** **Your-board pane fit.** Bring WASTED / TURN / inspect inside `--tv` at 393x852
   (fold them into `LifeHud`'s row or the pane header), dedupe the arsenal label, make
   the opponent pane's `arsenal —` use the same empty-slot style. Assert every pill's
   bottom <= the pane's bottom.
3. **DONE (see §2).** **Loadout hierarchy.** One primary action per mode: the AI-foe picker decides the
   button ("FIGHT THE DUMMY" vs "FIGHT KAYO — SHARP"), the second becomes `.bigbtn.alt`,
   prose collapses into a one-line disclosure. Keep page.js's button-name regexes or
   update them in the same commit.
4. **DONE (v6.48, see §2 rows I).** **Hero-select with art.** The roster is a 6-across grid of 58px tiles. Online they
   carry real art (`HeroArt`); give the selected hero a full-bleed banner on the sheet
   (art, class, chapter colour, one-line pitch) and grow tiles to 4 across with 11px
   names. Check online art loads at phone size (tools/phone/serve.sh) — offline is grey.
5. **DONE (v6.48: row H plates, row J the link outcome).** **Damage and block feedback on the boards.** Reuse `LifeHud`'s re-key trick on the
   hero plates (`.heroplate` life), and flash the chain link that hit / was blocked.
   Life drops red, prevention blue, gains green — three colours that mean three things
   (POLISH §4's sound rule, applied to sight first).
6. **Motion between panes.** A short slide on `.screennav` jumps (CSS `scroll-behavior`
   + snap is already there) and a card-to-zone glide on play (FLIP: measure the tile,
   animate a ghost to the featured slot). Budget: no frame over 16 ms at 4x throttle
   (`tools/perf-page.js`), off under reduced motion.
7. **DONE (v6.49: target cards, soak stat, tags off the pip).** **Prompt sheet pass.** Drive each `prompts.js` kind (opt pick modal pay reveal target
   alloc soak) to the sheet, screenshot, and give the sheet the same headline / stat /
   one-primary-button grammar `EndPanel` uses. `test/promptctl.test.js` must stay green.
8. **DONE (v6.50: `--fs-*` scale, 166 sizes named, every inline fontSize a class).** **Typography and token sweep.** Replace the remaining inline `style={{fontSize:…}}`
   on shared components with classes; add `--fs-*` size tokens to `:root` and use them
   in new CSS. Re-derive UI-GUIDE §4's class count after.
9. **DONE (v6.50: `Sfx`, synthesized with Web Audio — no files; ♪ toggle on the nav row).** **Sound (POLISH §4).** Three self-hosted sounds — hit, block, fizzle — behind a
   mute toggle, distinguishable with the screen off. Files under `data/` or `assets/`,
   no CDN.

## 4. Notes for the next UI worker

- Screenshots: `open()` from `tools/page.js`, then `page.screenshot({scale:"css"})` for
  1x review. The board opens on the OPPONENT pane; the hand rail and status line live in
  the Chain pane. `.screennav button` index 0 is LEAVE — don't click `.first()`.
- `EndPanel` and `LifeHud` are shared by both boards: change them once. `WinPanel` stays
  trainer-reward only (UI-GUIDE §2); it now renders through `EndPanel`.
- No engine change was needed for any of this.
- Start a board from the loadout by `.lo .actbar [data-start="trainer"]` / `[data-start="table"]`,
  never by button name: since step 3 the plate's label follows the Foe picker.
- Offline geometry now matches online: card faces reserve a 5:7 box (row E), so the
  page.js stand-in (a 50x70 PNG) no longer draws rail tiles 72px tall.
- Left for step 5: a chain entry needs a "hit" / "prevented" fact from the engine before the
  link can flash; then the blue for prevention is a third `LifeNum`-style class.
