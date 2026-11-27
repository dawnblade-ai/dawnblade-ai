# SCREENS-FLOW — the screens around the table (CRESCENDO, flow designer)

Mockups: `mockups/flow-1…9-*.html` (open `mockups/index.html`; flow pages are clickable end to end; `?v=` picks a variant,
`?w=375&h=548` another phone). Shots: `mockups/shots/flow-<n>[-variant]-393x660.jpg`. Styles: `mockups/flow.css` (component sheet,
follows `tokens.css`), `mockups/flow.js` (icons, variants, links, the dimmed table backdrop; mockup-only).
All boxes are `x, y, w, h` in CSS px inside the content frame at **393×660** (the stage minus safe areas). Rules for every screen:
the stage never scrolls; only the regions named below scroll (overscroll contained); every tap ≥ 44×44; nothing under 11 px; cards
are the public database's art; no identifiers, versions or card text of our own. Motion names are `--m-*` from MOTION.md; all motion is
transform/opacity and cut under reduced motion.

**Decisions that bind the build**
1. **One primary per screen, bone.** Everything else is secondary (mat-3) or ghost. The destructive choice is a secondary with a `--damage` ring, never the primary.
2. **The bout is never dimmed.** Every sheet over the table (prompts, pad, menu, result) starts its scrim at y = bout height (56): both life totals stay lit, same place, same size.
3. **A forced question has no close button.** Prompt sheets cannot be swiped away; only look-only sheets (reveal) and the menu/pad have a dismiss.
4. **Every ask names its source.** Prompt header = the asking card's thumbnail (tap = large glimpse), "ASKED BY", the card name, and the card's own printed clause (never a UI paraphrase of card text).
5. **Waiting is a horizon, not a spinner.** The dawn disc on a blade-light line (the title's and KO's motif), a few words, three breathing dots.
6. **The pad is the one light object** (cream paper, Caveat): a deliberate deviation from the dark palette (TABLE-TALK §5); tokens local to flow.css (`--paper`, `--pen`, `--pencil`).

## Flow map
```
F1 Title ──PLAY──────────────► F4 Sit down (last hero vs a hero drawn by fate) ──SHUFFLE UP──► TABLE
   │ tap hero art ► F3 ► (SIT DOWN) ► F4          ▲ tap either hero ► F3 (swap)
   ├ Ways to play ► F2 ──Dummy / AI hero──► F3 ─► F4
   │                    ├ Two phones ► (hero) ► F9 phone (code) ► F4
   │                    └ Find an opponent ► (hero) ► F9 server ► F4        F9 fail ► Try again | Play the AI ► F4
   └ gear ► F8 menu (sound, speed only)
TABLE ──⋯──► F8 menu ► JUDGE!! report | Concede ► F7 result
TABLE ──bout / pad button──► F6 pad          TABLE prompt ► F5 sheet ► (answer) ► TABLE
TABLE (their turn) ► F9 ai chip · (other phone drops) ► F9 quiet
Lethal hit ► F7 KO frame ──tap after 600 ms hold──► F7 result pad ──Rematch► F4 · New opponent ► F3 · Leave ► F1
```

## F1 Title  (`flow-1-title.html`, shot `flow-1-393x660.jpg`)
Brand moment: stacked wordmark DAWN / BLADE (BSD 900, 112 px at 393×660; 92 compact, 132 tall; DAWN bone, BLADE brass gradient), a sword laid
between the words (the "blade of dawn"), a brass sun disc behind it with faint rays, then **your last hero** in a full-bleed art band, one
PLAY. First-timers (no last hero) see the band as "Choose your hero ›" and PLAY opens F3.
| element | box | copy / spec |
|---|---|---|
| fan-made label | 10,20,172,13 | "FAN-MADE · FREE FOREVER" Mono 11, brass |
| settings | 339,4,44,44 | gear icon button → F8 (sound, speed) |
| wordmark DAWN / blade / BLADE | 10,52,383,94 · 0,150,393,22 · 10,174,383,94 | |
| tagline | 0,276,393,22 | "Spar the Silver Age precons. Your hero, your deck." (hidden on compact) |
| hero art band | 0,302,393,189 | tap = F3. Art from the hero card, masked top/bottom; label "YOUR HERO" + name BSD 800 34 at 10,436; chip "CHANGE ›" 305,459 |
| PLAY | 73,503,248,56 | primary, 26 px type |
| sub-line | 100,567,194,17 | "Against an AI hero, drawn by fate" |
| three links | 6,586, 3 × 127×44 | "Ways to play" → F2 · "Your record" · "Learn the rules" |
| footer | 0,630,393,30 | "FAN-MADE · NON-PROFIT · NO ADS, EVER" |
Motion in: the sword crosses (`scaleX 0→1` from centre, 320 ms `--m-ease-out`), then DAWN and BLADE slam in 40 ms apart (`--m-slam`,
`--m-ease-slam`), disc rises 24 px with opacity (`--m-emph`), art band fades (`--m-std`), PLAY rises last. PLAY is the audio unlock.
Out: PLAY press → art band expands to F4's lower half (shared element, `--m-emph`).

## F2 Ways to play  (`flow-2-ways.html`)
"How do you want to play?" Four big cards, flex to fill (≥ 92 tall; 124 at 393×660), gap 8 at x 10, w 373, from y 80. Each card: 68 pictogram
tile (original icons; the AI card shows its drawn hero with an orchid ring), title BSD 800 22, one sentence, one mono tag, chevron.
Back 10,16,44,44. Header "STEP 1 OF 3" + title at 64,18. Footer link "New here? Learn the rules in two minutes" 39,608,315,44 (opens the rules sheet; not mocked).
| card | copy | tag | goes to |
|---|---|---|---|
| Train on the Dummy (brass keyline) | "Learn your deck against an iron-armored dummy." | START HERE · COACH'S CALL ON | F3 |
| Play an AI hero | "A real precon, piloted by the computer." | PRACTICE · HERO'S CALL ON | F3 |
| Two phones, one table | "Share a four-letter code and play a friend." | FRIENDLY | F3 → F9 phone |
| Find an opponent | "Sit at the server table and climb the ladder." | FRIENDLY OR RANKED | F3 → F9 server |
Motion: cards stagger in 40 ms apart (`translateY 12→0` + opacity, `--m-std`); press sinks 2 px.

## F3 Choose your hero  (`flow-3-hero.html`; `?v=grid`, `?v=peek`)
Grid: 3 columns × 17 tiles, x 10, 120×160, gap 6, region 0,68→660 **scrolls vertically**; row 4 peeks at the bottom as the cue. Tile = the
hero's art cropped to the picture (frame hidden), name BSD 800 18 caps over a bottom gradient (display name only; "Viserai BW" for the
second Viserai). Your last hero has a brass ring and a "LAST" tag (43×20). Back 10,8,44,44; "STEP 2 OF 3" + "CHOOSE YOUR HERO".
**One tap = peek sheet** (0,92,393,568, `--e4`): art banner 0,92,393,230 with name BSD 800 40 and "ELEMENTAL WIZARD · CHAPTER 1"; close 341,100,44,44;
blurb 16,332 (the hero's own line); chips LIFE 18 · HAND 4 · 47 CARDS (16,390,h28); "THE DECK, AS PRINTED / TAP A CARD TO READ IT" 16,438;
deck strip 0,458,393,104, cards 56×78 with ×N badges, horizontal scroll (one per card name); **SIT DOWN AS IYSLANDER** primary 12,587,370,52 → F4.
Motion: sheet rises `--m-emph` `--m-ease-out`, scrim fades `--m-fast`; art cross-fades hero to hero (`--m-std`). The tile pressed scales .97 (instant).

## F4 Sit down  (`flow-4-sitdown.html`)
Two heroes art on art, full-bleed, split on a gently rising diagonal (left y = 54%, right y = 46%) with a brass seam. Them on top (name
BSD 900 48 at 233,62, orchid underline, "THEM · DRAWN BY FATE", "RUNEBLADE · LIFE 20"), you below (name at 10,489, jade underline,
"YOU", "ELEMENTAL WIZARD · LIFE 18"). The **coin** 84×84 at 155,288 on the seam: brass disc with the first player's portrait, ring in
their seat colour; slab "THE COIN / YOU GO FIRST" at 0,380,230,62 (left bar in seat colour). Hit areas (no overlap): their half 0,52,393,252 (tap = swap
opponent, chip "TAP TO SWAP ›" 258,248,125,44), your half = F3 (chip "TAP TO CHANGE ›"). Back 10,8,44,44. Hub: **GEAR** secondary 10,604,92,44 (loadout), **SHUFFLE UP** primary 112,600,271,52 → table.
Against the Dummy the top half is the iron dummy (no portrait) and the coin is skipped ("YOU GO FIRST" slab only).
Motion: MOTION 3.17 (heroes slide in from their sides `--m-emph`, coin rises 120 px and spins 600 ms, lands with 100 ms bounce, slab in); tap = skip (300 ms).

## F5 Prompt sheets  (`flow-5-prompts.html`; `?v=mode|target|order|reveal`)
**One sheet.** Bottom-anchored (`--e4`, r16 top, no grabber), scrim 0,56,393,604 (`rgba(4,6,8,.66)`, bout lit), max height = stage − bout − 10 (the body
scrolls if it must). Parts, top to bottom: **ask** (16,pad; 106 tall): source thumbnail 56×78 with brass keyline (tap = glimpse), "ASKED BY" Mono 11,
chip "YOUR CHOICE" (brass; "LOOK ONLY" for a reveal), card name BSD 800 24, the printed clause Spline 15/21 · **body** (variant) · **actions row** (opt only) · **foot** primary 10,594,373,52.
Primary stays disabled (outline) until the answer is valid; an option that cannot be chosen stays visible with its reason in a pink Mono line ("NEEDS A CLUB OR HAMMER ATTACK").
Other kinds on the same sheet: `pick` = card grid in the body (tap to mark, "PICK 2 · 1 CHOSEN" in the foot's reason line); `pay` = coins to pitch + "PAY" / "DON'T PAY" secondary;
`alloc` = rows with − / + 44×44 steppers; `soak` = the same rows with shield counts. Optional prompts add a secondary "No thanks" beside the primary.
| variant | source card | body | primary |
|---|---|---|---|
| mode (modal) | Pummel, "Choose one." | two option rows 10,405,373,76 (radio 26, bone ring when chosen, the mode's printed text with the power glyph) | CHOOSE |
| target | Ice Bolt, "Deal **5 arcane damage** to any target." | two hero tiles 10,406,183,153 (art, name, "HERO · LIFE 11", check) + note "You can also tap Viserai's portrait above." The legal portrait in the lit bout gets a brass ring (tap target 343,6,44,44) | TARGET VISERAI |
| order (opt) | Whisper of the Oracle, "Opt 4" | lane TOP OF YOUR DECK (cards 80×112, numbered 1-4 = draw order, selected card lifted with a bone ring), lane BOTTOM OF YOUR DECK (64×89); tap a card to select, then **◀ SOONER · LATER ▶ · ▼ BOTTOM** (3 × 119×44; the opposite of Bottom reads TOP) | DONE |
| reveal | Brain Freeze, "Viserai reveals their hand." | their cards face up 80×112 + "Everyone at the table sees this." | GOT IT |
Each variant borrows the real card from the precon that prints it, so the lit bout above shows that table's matchup (Bravo, Iyslander, Blaze).
Motion: scrim `--m-fast`, sheet `translateY(100%→0)` `--m-emph` `--m-ease-out`; selection press instant; an option's ring `--m-press`; a card moving between lanes flies `--m-std` `--m-ease-inout`. Out: sheet drops `--m-std`.

## F6 The pad  (`flow-6-pad.html`)
Opened by the bout or the pad button. Cream ruled paper (rules every 30 px, red margin line at x 35), perforated top, two tape strips, rotated −0.5°,
at 10,66,378,581, scrim behind (bout lit). Header at 54,101: "Iyslander vs Viserai" (Caveat 30) / "You went first · turn 6". Close 333,96,44,44 (pen-dark circle); a tap on the scrim also closes.
Columns (cols 53,162,327×435, **scroll, newest at the bottom, opens scrolled to the bottom**; column heads stick): YOU left, THEM right (as in the bout).
Each column: the total (Caveat 28), the old total struck in red pencil, between them one line "T4 Shrill of Skullform −4" (Caveat 17; wraps onto the next ruled line if long). The current total is 44 px, double-underlined.
Footer note: "Life totals and where they came from. Nothing else." No log, no cards, no phases (TRP 5.8).
Motion: rises `--m-emph`; a new line is written (opacity + 4 px `--m-std`) when a change lands while open.

## F7 The result  (`flow-7-result.html`; `?v=ko|lose|pad`)
**KO frame** (MOTION 3.18 at ≈ 850 ms): veil `rgba(0,0,0,.72)` 0,56,393,604 (bout stays lit: 7 and a red 0, the loser's portrait greyed); the blade of dawn 0,253,393,3 crosses the screen
**between the two halves of the word**: DAWN above, BREAK below, BSD 900 112 gold (`min(112px, 28.5vw)`), then "YOU WIN" (or "VISERAI WINS") BSD 800 36 at y 373 with a seat-colour bar; "TAP TO CONTINUE" 0,617 (Mono 11, brass) appears after the 600 ms hold. The word is the same word for either winner and either seat (`?v=lose`).
**Result pad** (`?v=pad`): the pad rises (paper 10,64,377,473): the winner's final total ringed in red pencil, "GG" (Caveat 64, red) at 301,86, header "You won · turn 6", the loser's column down to 0. Below: **NEW OPPONENT** 10,538,182,44 → F3, **LEAVE** (danger) 202,538,181,44 → F1, **REMATCH** primary 10,594,373,52 → F4. At a two-phone or server table Rematch becomes "Asking Viserai…" (F9 chip) until accepted.
Motion: per MOTION 3.18 (stop 260 ms, dim, blade `scaleX` 320 ms, word slam `--m-slam`+60); the pad `--m-emph`; the ring draws (stroke-dashoffset, 380 ms) then GG stamps in (`--m-ease-slam`).

## F8 Menu  (`flow-8-menu.html`; `?v=menu|report|concede`)
Opened by ⋯ (hub left). Sheet 0,131,393,529 (menu z), header 64 tall: "MENU", manners chip ("PRACTICE TABLE" / "FRIENDLY TABLE" / "RANKED TABLE"), close 44×44. Rows 373×56 at x 10 (body scrolls at compact):
| row | spec |
|---|---|
| Sound | switch 52×32 (brass when on) |
| Speed | "Both players, the same speed"; segmented STANDARD · QUICK · INSTANT, 3 × 111×44 (MOTION 4.4) |
| Game log | "Practice tables only" → log sheet (absent at ranked, TRP 5.1) |
| Coach's call | "Says the play it would make, and why"; switch (absent at friendly and ranked) |
| Classic board | "The older layout, from the next game" |
| JUDGE!! Report a problem | brass icon → report sheet |
| Concede and leave | `--damage` text → confirm |
**Report**: "Tell the judge what looked wrong. We save the whole board with your note." textarea 16 px (iOS never zooms), Cancel (secondary) + **SEND TO THE JUDGE** (primary); with the keyboard up the sheet pins under the bout and the textarea shrinks.
**Concede**: "CONCEDE THIS GAME?" "Your opponent wins and you leave the table. At a ranked table this counts as a loss." **KEEP PLAYING** primary (the safe default), **CONCEDE** danger secondary → F7 lose frame (no KO animation).
Title-screen gear opens the same sheet with only Sound and Speed. Motion: as F5.

## F9 Waiting  (`flow-9-waiting.html`; `?v=ai|phone|quiet|server|fail`)
Centre stack (between y 56 and the buttons): sun-on-horizon 393×132 (disc 112 half, 3 px blade-light line, a bright mote sliding on it, halo breathing 4.8 s, opacity/transform only), heading BSD 800 32, one sentence, content; buttons at the bottom. Seats pictogram (hidden at compact).
| variant | copy | actions |
|---|---|---|
| ai (on the table, not dimmed) | chip 92,170,208,32 under the bout's stage edge: "VISERAI IS THINKING ●●●" (appears after 600 ms of silence; hub primary reads THEIR TURN, disabled) | none |
| phone (host) | "WAITING FOR YOUR FRIEND" / "Tell them this code, or send it from your phone." code tiles 4 × 64×80 at 57,329 (4 characters, no I L O 0 1) | **SHARE THE CODE** 10,594,373,52; back 10,8,44,44 |
| quiet (mid-game) | panel "WAITING FOR VISERAI'S PHONE" / "Their connection dropped. The table keeps your place and carries on the moment they are back." | LEAVE THE TABLE (secondary) |
| server | "FINDING YOU A TABLE" / "The usual wait is about 20 seconds." (the server's own number) | **PLAY THE AI WHILE YOU WAIT** primary 10,538,373,52, STOP LOOKING secondary 10,594 |
| fail | "WE COULD NOT REACH THE SERVER" / "Check your connection. Nothing is lost, and the AI is always at the table." | TRY AGAIN primary, PLAY THE AI INSTEAD |
Motion: dots `opacity .3→1` 1.3 s staggered 160 ms; fail dims and lowers the sun 30 px (`--m-emph`). Reduced motion: static.

## Verified
Chromium, 375×548 · 393×660 · 430×932 (`?noframe`), every variant: nothing outside the stage, no overlapping tappables (a layer and its own dismiss excepted), all tappables ≥ 44×44, no text under 11 px, no page scroll. **Not verified (WebKit/iPhone):** `mask-image` and `color-mix()` rendering, `background-clip:text` gradients, Caveat metrics in Safari, `aspect-ratio`-free tile padding trick, the standalone safe-area frame. Use `../probe.html` on the phone.
