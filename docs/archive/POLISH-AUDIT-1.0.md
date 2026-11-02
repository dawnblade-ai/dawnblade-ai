# POLISH-AUDIT-1.0 — the 1.0 polish pass

> **STATUS (2026-11-02, branch `ship/polish` on v5.78):** 16 of 18 findings shipped, 2 open.
> **#1** (P0, the trainer's block) shipped in **v5.76**. **#2, #3, #7** (table results and copy) in
> **v5.79**. **#4, #5, #8, #9, #13** (layout and tap targets) and decision **B** (#16: the jump row
> and the advisor header take taps over 44px through invisible hit areas; the other sub-44px controls
> in the table below are unchanged) in **v5.80**. **#6, #10, #12, #14, #15** (feed and voice) in
> **v5.81**. Decision **C** (#17, Add to Home Screen: a name and an original self-hosted icon, no
> standalone mode) in **v5.82**. **OPEN: decision A** (#11, the coin's "the throw returns for
> launch" line: waits on the user) and **decision D** (#18, what a win over an AI hero earns:
> deferred until after 1.0). Below is the audit as written at v5.74; the commit shas it cites are
> on `polish/one-oh`, and each fix's drill shipped with it.

Audited 2026-11-02 against live **v5.74** (origin/main `aa15b16`), on branch `polish/one-oh`.
The bar is `POLISH.md`; the map is `UI-GUIDE.md`. Everything here was **driven**, at 393×852, on the
real `index.html` offline (`tools/page.js`'s `open()`), and judged on element boxes, not pixels.

## How it was driven (and how to rerun it)

```sh
# deps outside the repo — see the header of tools/page.js
export PAGE_DEPS=<scratch>/pagedeps NODE_PATH=$(npm root -g)
node tools/page.js            # the smoke check: PASS/FAIL per screen, now with this pass's assertions
node tools/page-audit.js      # the full drive: every hero, both boards (HEROES=0,4 STEPS=30 to narrow)
```

`tools/page-audit.js` (new, not part of `npm test`) walks every hero on the roster as the player's
pick, on **both boards**:

- **the trainer** vs the dummy — taps through 30 moves (two-tap hand cards, the prompt sheet, the
  action bar), measuring every few taps, then opens **JUDGE!!**;
- **the table** vs an AI hero — seat 0 is driven by the seat policy through the page's own session
  (`window.__dawnTable`), so a **whole game** plays out on the real board; every prompt addressed to
  seat 0 is measured while it is on screen; the game-over panel is measured.

Each measurement asks: horizontal scroll (scrollWidth ≤ 393), controls under 44px, overlapping
controls, a control whose centre tap lands on something else, text wider than its box, page and
console errors. The feed and the advisor's lines are harvested for voice. One full run measured
**642 screens**; 13 of the 15 table games played to a game-over panel (wins and losses), 2 ran out of
the step budget mid-game. Severity: **P0** the page breaks · **P1** the screen tells the player
something false · **P2** a lost tap, developer text or raw tokens a player reads, a control off screen
· **P3** grammar, wrap, cosmetic.

**Reached:** the roster, hero sheet, decklist, Judge and Trophies tabs, the coin and seat pick, the
loadout (scout / loadout / deck panes, AI-foe picker), both boards' three screens, the peek dock,
prompts `pick` `opt` `pay`, game over (table win and loss over an AI hero, and a win over the Dummy at
the table, which is the trainer's own `WinPanel`), JUDGE!! on both boards, the two-phone lobby (Find an
opponent, Open a table — offline it reports "Cannot reach the matchmaking relay", Join a table).
**Not reached in this pass:** prompts `modal` `reveal` `target` `alloc` `soak` on screen (none was
caught addressed to seat 0 in 15 driven games; Azalea's call "Choose Bull's Eye Bracers" shows a soak
was answered, between two measurements); a draw (the dead-position draw needs both decks empty for 20
turns); the trainer's own win and loss panels (30 trainer taps end no game).

## Findings — 18 (P0 1 · P1 1 · P2 9 · P3 7); 15 fixed, 3 need a decision

| # | sev | board / screen | what the drive showed | status |
|---|---|---|---|---|
| 1 | **P0** | trainer, every hero — the block | Defend with a hand card, tap **Resolve damage**: the page goes **blank**. `pageerror: TypeError: _EFX.defendValue is not a function` at `finishBlock`. `defendValue` is a module export, never a member of the `makeEffects` context. Repro: any hero → Battle → *It goes first* → Fight → wait for TAKE IT → tap a hand card twice → DEFEND → REACTIONS → RESOLVE DAMAGE. **Live on v5.74.** | **fixed** `7a2aaec` (+ drills `7f92821`) |
| 2 | P1 | table vs an AI hero — game over | Kayo beat Azalea: "**DUMMY DESTROYED** · MAJESTIC PULL ENLIGHTENED STRIKE · Efficiency score 28" — a trophy pulled and the dummy best score written for a win over a hero. | **fixed** `6f0bc3f` |
| 3 | P2 | lobby — Find an opponent | Note: "Card text does not resolve yet: the parser's effects still live in the solo trainer." False since `effects.js`; and an identifier's words. | **fixed** `218e7b5` |
| 4 | P2 | trainer, arsenal step / paying | With a card peeked, the dock's name bar sat over the status line: `skip [250,644 31x15]` under `span.pkhint "TAP AGAIN TO SET IN ARSENAL"` — the tap closed the preview. | **fixed** `ba9bf56` |
| 5 | P2 | both boards | JUDGE!! drawn **58×18**; the status line's `skip` / `✕ cancel` **31×15** / **50×15**. | **fixed** `85f5b57` (hit areas 42px / 32px) |
| 6 | P2 | both boards — feed, advisor | Raw card-text pips: "Bare Fangs: discarded Bare Fangs (7{p}) at random.", "the first card with 6 or more {p} Kayo has discarded…", "can take a +1{p} counter". | **fixed** `c914deb` |
| 7 | P2 | lobby — table room | Hero-pick note: "through engine/judge.js … the same engine/effects.js"; mismatch screen: "the database is cached under its version key, so a reload re-fetches it" (no cache since v5.74). | **fixed** `8b7ac49` |
| 8 | P2 | lobby | `Back` rendered as bare text **377×16** (class `.a` is styled only in the action bar); same for the room's three "Leave the table". | **fixed** `911248f` |
| 9 | P2 | table, Boltyn — a soul-cost picker | One button per soul card in the action bar: `button.a.go "BANISH LIGHT THE WAY" [348,721 62x121]` — off the right edge, a word per line. | **fixed** `4681601` |
| 10 | P2 | table feed, Bravo | "Thunder Quake: printed keyword — the arsenal-step offer, carried by **heaveOffer/heave**." Three more noop reasons named a function (`arcaneSoaks`, `resolveInertia`, `frailtyCount`). | **fixed** `c1e08d4` |
| 11 | P2 | the coin, every game | Player-facing: "**Coin for speed while testing — the throw returns for launch.**" 1.0 is launch. | **NEEDS A DECISION** (A) |
| 12 | P3 | trainer advisor, Bravo · table read, Iyslander | "Play Bravo — **hero power — hero power** (pitch Pummel + Crash and Bash) → go again."; "Iyslander's read: … 24 arcane, **1 permanents**." | **fixed** `76813ed` |
| 13 | P3 | table, vs Lyath Goldmane | Jump row "▲ LYATH GOLDMANE" wrapped: the row **36px** instead of 25px, the board pushed 11px down. | **fixed** `8118e91` |
| 14 | P3 | table feed, Dorinthea | "Dawnblade resolves for 1 (**+1 reactions**)." — the number is power, not cards. | **fixed** `01ddffb` |
| 15 | P3 | trainer advisor, Blaze | "Pitch Whisper of the Oracle — exactly 3 (**2 floats: spend it** before end of turn)." | **fixed** `114ad32` |
| 16 | P3 | all screens | Tap targets under 44px (list below). | **NEEDS A DECISION** (B) |
| 17 | P3 | iPhone home screen | No `apple-touch-icon`, no `apple-mobile-web-app-title`: Add to Home Screen gets a screenshot icon and the page title. | **NEEDS A DECISION** (C) |
| 18 | P3 | table vs an AI hero — game over | With #2 fixed, a win over an AI hero earns nothing at all (no pull, no record). Whether it should is a design call. | **NEEDS A DECISION** (D) |

### Tap targets under 44px (measured, after the fixes above)

| control | box | where |
|---|---|---|
| jump row `✕ LEAVE` `▲ OPP` `CHAIN` `YOU ▼` | 69–98 × **25** | both boards, loadout |
| bottom tabs `HEROES` `JUDGE` `TROPHIES` | 126 × **34** | home |
| advisor header `✦ COACH'S CALL ▾` | 357 × **26** | both boards |
| `← BACK TO THE ROSTER` | 156 × **25** | the coin |
| opt reorder arrows `◀` `▶` | 38 × **30** | prompt sheet (opt) |
| JUDGE!! sheet `CLOSE` `COPY` `SAVE REPORT` | 116–118 × **39** | both boards |
| `FIND AN OPPONENT`, `FIGHT THE NEW ENGINE`, `FIGHT` | 377 × **42–43** | home, loadout |
| dummy portrait `✕ ✕` | **42** × 59 | roster |

## NEEDS A DECISION

- **(A) The coin or the throw at 1.0.** `Pregame` runs a coin (`window.THROW_MODE !== "rps"`) and tells
  every player it is "for speed while testing — the throw returns for launch". Either restore the
  rock-paper-scissors throw for 1.0, or keep the coin and drop the sentence. Not built: it changes
  what the first screen of every game is.
- **(B) A 44px floor for every tap target.** UI-GUIDE does not ask for one. The big offenders are the
  jump row (25px) and the advisor header (26px), and both sit inside a fixed-height board
  (`--tv: calc(100vh - 152px)`): raising them costs board height or needs `--tv` re-measured. This
  pass only gave invisible hit areas to the two worst (JUDGE!! and the status-line buttons), which
  changes no layout. A rule ("every control ≥ 44px tall, or a ≥ 44px hit area") would make it a
  drill.
- **(C) Add to Home Screen.** An icon needs a self-hosted asset (POLISH.md §4: every asset
  self-hosted), and `apple-mobile-web-app-capable` (standalone, no Safari chrome) is a behaviour
  change — iOS keeps a standalone app's storage separate, so trophies and loadouts would not carry
  over from Safari. The README tells players how to add it today.
- **(D) What a win over an AI hero earns.** After #2 it earns nothing, which follows the existing rule
  ("a trophy handed out for a real match would quietly devalue the case"). A separate record per
  matchup, or a pull, is a design call.

## Seen and left (not defects)

- **The loadout's gear picks "under" the jump row** (`button.pick [15,-24 86x120] under span.brand`,
  every table loadout): a driver artifact — the card had scrolled inside its pane and the box check
  measured the part the pane clips.
- **"Spill" on JUDGE!! / skip / cancel** after #5: the invisible `::after` hit area widens
  `scrollWidth`; no text spills.
- **The prompt sheet covers the hand and the action bar** (trainer, Blaze's opt): the sheet is
  modal by design; the board under it is not meant to take taps.
- **"Priority to you", "You draw 1 back up to intellect 4"** in the trainer feed: seat 0 is named
  "You" (UI-GUIDE §9.6); these name the seat.
- **The advisor's no-window refusal** speaks developer text ("advise() reads ctx.window — see
  advView"): deliberately visible, and only reachable by a board forgetting to pass the window — it
  is a bug report, not coaching. No board does today.
- The advisor's voice otherwise reads as the coach: short, concrete, warm ("Fodder first — feed the
  fire with the cards you'd least like to swing.", "Biggest clean hit on the table; anything smaller
  wastes the turn.", "Hold it. Your blocks already stop this whole hit, so the card stays in your
  hand.").

## Final numbers (this branch, at the commit that adds this file)

- `npm test`: **fail 0, skipped 5** (3909 tests).
- `npm run scenes`: 107 passing, 0 failing. `npm run fairness`: nothing found.
- `npm run anchors` / `npm run unanchored`: exit 0; `npm run audit`: unchanged but its timestamp.
- `npm run play '' '' 1`: 210 games, 0 policy refusals, 0 invariant violations, 0 stalls (no policy
  change in this pass; run because feed text in `effects.js` / `parser.js` moved).
- `node tools/page.js`: **48/48 screens clean, 0 page errors** — it now also asserts a player block
  in the trainer, three table endings, the preview over the status line, the JUDGE!! and status-line
  hit areas, the lobby's buttons, the jump row on one line, a crowded action bar, and no raw pip.
- Both `text/babel` blocks compile with `@babel/standalone` (`presets:["react"], sourceType:"script"`).
