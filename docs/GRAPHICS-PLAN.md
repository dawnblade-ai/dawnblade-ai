# GRAPHICS PLAN — the next phase (drafted 2026-11-25, at v7.10)

**Status: DIRECTION GIVEN (user, 2026-11-25). G1a SHIPPED v7.12** (the always-on life-bar HUD, both boards; `docs/ux/before-hud.jpg` / `after-hud.jpg` / `after-hud-320.jpg`). **G1b the wheel SHIPPED v7.13; G1c part one, the hub, SHIPPED v7.14** (`HubBar`, `hubJudge`; `docs/ux/after-hub.jpg`). **Next: G1c part two, one screen.** The user's answer to §2: *"I don't
think there is enough room to show the equipment on the main screen with the hand. Reference our old
mockup with the health bars and the hand wheel - make sure the equipment is showing up in the hand
wheel when it can be blocked with."* The old mockup is `design/STAGE.md` + `design/prototype/` on the
branch `design/stage` (2026-10-14..25: §2.1 the phone table, §3 the health bars, Appendix C.1 the hand
wheel and the thumb lane). §2 below is rewritten to it. Phase 1 of the visual work
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

## 2. The board's shape — DECIDED: the Stage table (user, 2026-11-25)

One screen, the old mockup's bands (`design/STAGE.md` §2.1, Appendix C.1 on `design/stage`):

```
┌───────────────────────────────┐
│[P1]◢▰▰▰▰▰▱┐17  T7  14┌▱▰▰▰▰◣[P2]│  HUD: two skewed fighting-game LIFE BARS, the numeral BESIDE
│ ●●●●● hand pips      pips ●●● │  each bar (never over it), chip trail, hand pips, turn
├───────────────────────────────┤
│ their strip: counts · auras · │  arsenal / deck / pitch / graveyard as COUNTS and chips;
│ allies · tokens  (+N)         │  hold a chip → the zone sheet. NO equipment tiles
├───────────────────────────────┤
│          THE STAGE            │  the attack in flight, its power vs the wall,
│  links · [ATTACK] · wall row  │  the declared defenders (gear included) in the wall row,
│  caption lane (feed headline) │  the status line's hint
├───────────────────────────────┤
│ your strip: counts · chips    │  NO equipment tiles here either
│     ╭──── HAND WHEEL ────╮     │  the hand AND every other play: the top card magnified,
│   ▭  ▭  [ TOP ]  ▭  ▭        │  spin to choose, tap the top card to commit
│ res·AP   [ HUB: PASS ]  ⋯    │  the primary button in the thumb lane (x 96..297)
└───────────────────────────────┘
```

**Equipment lives in the wheel, not on the screen.** The strips do not draw gear tiles. A piece
joins the wheel whenever it has a legal play: a weapon to swing, an ability to activate, and —
the user's rule — **a piece that can block, in the defend step**, outlined ⛨ DEF once declared.
The whole loadout (worn, broken, counters) is one tap away in the board sheet. Gear in the
defending wall shows in the stage's wall row, where the block is read.
- Already true on the trainer (`playables()` lists declarable pieces in the defend step since v2).
- **v7.11** made it true at the table (`railPlays` lists every piece `judge.legal` lets you declare,
  first; page.js row, sabotaged), so the wheel inherits a complete source on both boards.

The three panes become sheets (opponent board, the chain history + log + call, your board), so
nothing a pane shows today is lost. Both boards get it through shared components.

## 3. The work, in order (each a release; workers in parallel only where they do not share a screen)

| # | step | touches | parallel with |
|---|---|---|---|
| G1a | **The HUD**: two skewed life bars with the numeral beside each, chip trail, hand pips, turn; replaces `LifeHud` on both boards (STAGE §3.1; no text under a transformed ancestor) | `LifeHud`, both boards' top band | nothing |
| G1b | **The hand wheel** (SHIPPED v7.13; the hub moved to G1c): one shared `HandWheel` fed by the rail's entries (hand + `playables()` / `railPlays()` + arsenal), top card magnified, spin + snap, tap top = commit, tap other = spin to top; the hub holds the primary button (STAGE App. C.1) | `.phand` on both boards, `.actbar` primary, `PeekDock` | nothing |
| G1c | **One screen** (the hub SHIPPED v7.14 as part one; the primary button in the thumb lane x 96..297, from G1b): strips (counts and chips, no gear tiles) + the stage; the three panes become sheets; equipment only in the wheel and the wall row | `Battle`, `TableBoard`, page.js/serverpage rows | nothing |
| G2 | **Cards in the hand**: a fanned, overlapping hand; pitch colour, cost, power, defence legible at the 9 px floor; the peek grows from the fan | hand rail components, `PeekDock` | G4, G5 |
| G3 | **Motion that means something**: an attack lunges to the chain, a hit shakes the target strip, a block clanks onto it, prevention glows blue — each paired with the existing `Sfx` sound; off under reduced motion; no frame over 16 ms at 4x throttle | CSS + `Glide`/`LifeNum` | G4, G5 |
| G4 | **Menus, one grammar**: title, hero sheet, loadout, table lobby, record — same header, panel and button rhythm; the hero sheet shows the deck's art large | off-board screens | G2, G3 |
| G5 | **The end screen as a moment**: the recap card (v7.09) styled into the result, the winner's art behind the title | `EndPanel`, `Recap` | G2, G3 |

Workers: `experiments/WORKER-PROMPT-UI.txt` on `findings/queue` (update its CEO session id), one
`ship/AG-…` branch each; the CEO merges, gates and ships. G1a–G1c run in order and alone, because
every other step sits on the board they build. G2's fan is superseded by the wheel (G1b); G2 is now
the card face legible at wheel size.

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
