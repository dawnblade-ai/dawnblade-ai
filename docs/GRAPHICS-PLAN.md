# GRAPHICS PLAN — the next phase (drafted 2026-11-25, at v7.10)

**Status: WAITING FOR THE USER'S YES on §2.** Nothing here is built. Phase 1 of the visual work
(`docs/ux/UX-ROADMAP.md`, all nine steps DONE by v6.51) polished the screens we have. This phase
changes the board itself. It follows the standing direction (user, 2026-11-25): gameplay first,
then "the major graphical interface changes", keep it simple.

Read with: `UI-GUIDE.md` (the contract: two boards, the peek, `--peekbot`, the 44 px tap, what not
to touch) and `POLISH.md` (the bar: the tap is never lost, nothing jitters, it looks like one thing).

## 1. What a player sees today (393x852, driven offline)

- **The board is three flick panes**: the opponent's board, the chain with your hand, your board.
  You see one at a time and jump with the ▲ OPP / CHAIN / YOU ▼ row. The fight is never on one
  screen: to see the swing coming at you, your life and your hand together you flick twice.
  This is the single biggest gap between Dawnblade and a phone card game people already know.
- Much of each pane is empty frame: dashed slots, a large "Most recently played lands here" box,
  labels in 9–10 px caps. The information is there; the hierarchy is flat.
- Menus (title, hero sheet, loadout, table lobby) are in good shape after phase 1: one primary
  button per screen, chamfered panels, the forge palette. They need consistency, not a redesign.
- Online, cards and heroes carry real art; offline drives show grey stand-ins, so judge layout
  and type offline and art on a phone.

## 2. The decision I need — the board's shape

**Recommended: A. One screen, "the mat".** The whole fight on one 393x852 screen:

```
┌───────────────────────────────┐
│ opp hero · LIFE · AP/res · ⚔ │  opponent strip: hero, life, weapon/equipment as icons,
│ [auras/allies row, compact]   │  arsenal and hand as counts
├───────────────────────────────┤
│        THE CHAIN              │  centre: the attack in flight, its power vs your block,
│   [link] → [link] → [link]    │  defenders; empty = last card played
├───────────────────────────────┤
│ [your auras/allies, compact]  │
│ you · LIFE · AP/res · arsenal │  your strip
│ ╭hand fan, 5–7 cards, overlap╮│  the hand, fanned; tap = peek (the two-tap contract stays)
│ [   primary action button   ] │
└───────────────────────────────┘
```

The three panes do not disappear: each strip opens its full zone view (graveyard, banish, soul,
the whole board) as a sheet on tap, so nothing a pane shows today is lost. Both boards get it
through shared components (`Battle` and `TableBoard` already share `LifeHud`, `EndPanel`, `RailMore`,
`PeekDock`), and every page.js box assertion moves with it.

**B. Keep the three panes, restyle them** (bigger type, fewer empty frames, a sticky life strip
on every pane). Cheaper and safer, but the fight stays split across flicks.

**C. A hybrid**: the mat as the default view, the three panes one swipe away for detail.
Most work; probably what A becomes in practice.

## 3. The work, in order (each a release; workers in parallel only where they do not share a screen)

| # | step | touches | parallel with |
|---|---|---|---|
| G1 | **The mat** (A above), trainer first, then the table; panes become sheets | `Battle`, `TableBoard`, shared board components, page.js/serverpage rows | nothing (it owns the board) |
| G2 | **Cards in the hand**: a fanned, overlapping hand; pitch colour, cost, power, defence legible at the 9 px floor; the peek grows from the fan | hand rail components, `PeekDock` | G4, G5 |
| G3 | **Motion that means something**: an attack lunges to the chain, a hit shakes the target strip, a block clanks onto it, prevention glows blue — each paired with the existing `Sfx` sound; off under reduced motion; no frame over 16 ms at 4x throttle | CSS + `Glide`/`LifeNum` | G4, G5 |
| G4 | **Menus, one grammar**: title, hero sheet, loadout, table lobby, record — same header, panel and button rhythm; the hero sheet shows the deck's art large | off-board screens | G2, G3 |
| G5 | **The end screen as a moment**: the recap card (v7.09) styled into the result, the winner's art behind the title | `EndPanel`, `Recap` | G2, G3 |

Workers: `experiments/WORKER-PROMPT-UI.txt` on `findings/queue` (update its CEO session id), one
`ship/AG-…` branch each; the CEO merges, gates and ships. G1 runs alone first because every other
step sits on the board it builds.

## 4. What does not change

- No build step; React from the CDN; one `<style>` block; it runs from `file://`.
- The dark forge palette, the three display/body/mono faces, the chamfered `.clip` corner.
- The two-tap peek, the 44 px tap floor, the 9 px text floor, both boards fed by one engine.
- No card text in the UI: every number on a card comes from the parsed card.

## 5. How each step is checked

`npm test` (fail 0, skipped 5) · babel 4/4 · `tools/page.js` and `tools/serverpage.js` clean ·
`tools/tapsweep.js` and `tools/trainchaos.js` after board changes · `tools/perf-page.js` for
motion · new rows assert boxes at 393x852 AND 320x568, each sabotaged. A screenshot strip of
before/after goes in `docs/ux/` for the user.
