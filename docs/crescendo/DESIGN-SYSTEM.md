# CRESCENDO — Design System (how the release version LOOKS)

Author: lead art director, 2026-11-27. Binding inputs: `BRIEF.md`, `docs/TABLE-TALK.md` §0/2/3/5/6/9, `POLISH.md`.
Values live in `tokens.css` (same names as here); the proof is `mockups/style-tile.html`
(shot: `mockups/shots/style-tile-393x660.png`). Every number is CSS px. **Design size is the visible Safari
area 393×660; everything else is derived.** Motion is NOT here: every `--m-*` in tokens.css is a placeholder owned by
`MOTION.md`.

---

## 1. Art direction

**Mood: a quiet armory after closing, one lamp left on.** The table is slate felt, almost black, lit from above
by a single warm lamp; the only things that glow are the cards (their own art) and the two life bars. Chrome is
bone-white, brass and two seat colours, nothing else. It must feel like a *place where a serious game is being
played*, not an app: still, close, confident, a little ceremonial. "Dawnblade" is the dawn: warm light on cold
steel — warm bone and brass against cool slate.

Touchstones (what to steal, and what not to):
1. **Melee's stage and clarity.** Final Destination: one flat plane, nothing busy, every pixel has a job; the
   percent numerals are the biggest thing on screen; menus are a few bold shapes. Steal the *hierarchy*, not the
   spectacle.
2. **A playmat at a FaB armory night.** Neoprene/felt grain under a lamp, a stitched centre seam, a darker table
   edge the hand rests on, sleeves catching light on their edges. Steal the *materials and the light*.
3. **A fighter-select poster / arcade cabinet header.** Condensed athletic caps (Big Shoulders Display), hex
   medallion, angled bars, ring-lit portraits. Steal the *type voice*, used sparingly: the bout and the announcer
   only.

Originality: card back, medallion, gems, coins, icons and the pad are original. No LSS branding, frame or back is
imitated (the card FACES are the public database's art, unaltered, never re-framed or recoloured).

---

## 2. Materials and light

| layer | spec |
|---|---|
| **Mat** (`--mat-bg`) | `--mat-1` #11171A + 6%-opacity fractal-noise grain (120 px SVG tile, painted once; fallback: flat colour) + a warm lamp radial (`--lamp` 255,226,176 at 8.5%, ellipse 120%×70% centred 50% 38%) + a vignette (transparent 55% → 55% black at the corners). Never animated. |
| **Seam** | `--seam` 1px dashed white 7% between the halves and the stage = the stitched centre line. Two lines, nothing else on the mat is drawn. |
| **Table edge / tray** (`--tray-bg`) | hand + hub sit on a darker ledge: 1px top lip `rgba(255,255,255,.07)`, gradient `#0C1012 → #080B0D`, an upward shadow `0 -10px 24px rgba(0,0,0,.45)` so it reads as raised toward you. |
| **Light** | ONE source, top-centre. Shadows fall DOWN (+y), cool black, never coloured. Lit edges: 1px `rgba(255,255,255,.10)` on the TOP of every card/button. |
| **Elevation** | `--e0` flat on mat · `--e1` card at rest (1/2px + 2/4px) · `--e2` lifted: chain, blockers, pressed hub (2/6/12) · `--e3` selected card (4/12/24) · `--e4` glimpse, sheets (8/28/56). A thing may only rise one level per state change. |
| **Brass** | the only metallic: AP gem, medallion trim, counter rim, focus ring. `#D8A23E` mid, `#F2C66E` lit, `#8A6420` shade. |

Performance note: no `backdrop-filter` anywhere in the table (WebKit cost); scrims are plain rgba. The grain tile
is a background-image on ONE element (`.table`), not per zone.

---

## 3. Color

### 3.1 Palette (contrast = WCAG ratio vs the stated ground)

| token | hex | job | ratio |
|---|---|---|---|
| `--mat-0 / 1 / 2 / 3` | #0A0E10 / #11171A / #172024 / #202B30 | deep / mat / well / raised surface | — |
| `--rail` `--tray` | #2C3940 / #080B0D | hairline / ledge | rail 1.5 (decorative only) |
| `--ink-0` bone | #F5F0E4 | primary text, numerals | 15.9 on mat-1, 12.7 on mat-3 |
| `--ink-1` | #CFCABD | secondary text | 11.1 |
| `--ink-2` | #97A2A6 | muted labels, disabled text (≥ 11px) | 6.9 on mat-1, 5.5 on mat-3 |
| `--ink-inv` | #0A0E10 | text on bone/yellow/jade/orchid/silver | bone 17.0, jade 10.8, orchid 8.0, yellow 13.3, btn 14.7 |
| `--brass` / `-hi` | #D8A23E / #F2C66E | chrome accent / lit | 7.9 / 11.3 |
| **`--you` jade** | #4FD8A4 (lo #1D7A5A) | the seat at the BOTTOM / left bar | 10.1 (lo 3.4, fills only) |
| **`--opp` orchid** | #B794FF (lo #5E3FB3) | the seat at the TOP / right bar | 7.5 (lo 2.4, fill shade only: the lit top 70% carries the 3:1) |
| `--pitch-red` | chip #C9302A, hi #F0493D | white text 5.3; hi on mat 4.9 |
| `--pitch-yellow` | #FFD12E | dark text 13.3; on mat 12.4 |
| `--pitch-blue` | chip #2A6FD0, hi #4A9BFF | white text 4.9; hi on mat 6.4 |
| `--pitch-none` | #6F7C82 | no pitch (weapons, gear) | 4.2 |
| `--damage` | #FF4F6D | damage pop, low-life numeral/rim | 5.7 (large text) |
| `--damage-lo` | #7A1F33 | (reserve) drained ghost shade |
| `--prevent` | #BFD0DB | prevention, defence, blocking ring, shield | 11.4 |
| `--gain` | #9DF2C8 | life gained `+N` | 13.8 |
| `--goagain` | = brass-hi | go-again glyph | 11.3 |
| `--refused` | #FF8A99 | the refusal ring + reason chip (dark text 8.0) | 8.1 |

Rules: body/label text ≥ 4.5:1, numerals and ≥ 14px bold ≥ 3:1 (all pass, see ratios). **Colour never carries a
fact alone**: pitch = colour + the numeral on the stamp (1/2/3) + the top strip; seat = colour + position (you
bottom/left, them top/right) + the name; damage = red + a minus sign; refused = ring + words.

### 3.2 Seat identity
You are **jade**, they are **orchid**; both are cool, both are away from the pitch triad (red, yellow, blue) so a
pitch chip is never confused with a seat. Seat colour appears ONLY on: bout bar + portrait ring, the turn
medallion ring and pointer, the announcer's bar, a "ready" underline in your hand, your AP/arsenal count dot. Never
on cards.

### 3.3 State colours at a glance
Damage rose-red · prevention silver · go again brass · gain mint · refused pink-rose · pitch red/yellow/blue ·
turn = the turn player's seat colour. Primary button = bone (not a colour, so it never competes).

---

## 4. Typography

Keep all four families (Google Fonts only), re-roled:

| family | role | why |
|---|---|---|
| **Big Shoulders Display** 800/900 | life, announcer, buttons, titles, stamps, medallion | condensed + heavy = readable at 14px on a card corner and poster-big at 34px; the fighting-game voice; tabular figures via `font-variant-numeric: tabular-nums` |
| **Spline Sans** 400–600 | all sentences (body, small) | friendly, open counters, good on OLED at 13–15px |
| **Spline Sans Mono** 600 | labels (uppercase, tracked), pile counts | machine-small, distinct from sentences; **the 11px minimum lives here** |
| **Caveat** 700 | the pad ONLY | the one hand-written object on the table |

Replacing nothing keeps the payload (≈ 4 families already loaded); `font-display: swap` is in the Google URL;
preconnect both hosts.

### Scale (size / line / weight / tracking)

| token | spec | use |
|---|---|---|
| `--t-life` | BSD 800 **34**/34, 0, tabular (SE 30, Pro Max 38) | the bout numerals — the biggest type on the screen |
| `--t-announce` | BSD 800 **30**/32, +0.02em, UPPERCASE (SE 26) | "PLAYS WOUNDING BLOW"; one line, never wraps (fit with `font-size` step-down to 22 min) |
| `--t-title` | BSD 800 22/26, +0.04em, UPPERCASE | sheet titles, "DEFEND STEP" |
| `--t-btn` | BSD 800 20/24, +0.06em, UPPERCASE | primary button; secondary 16 |
| `--t-stamp` | BSD 800 14/16 | card stamps, pile counts, badges |
| `--t-body` | Spline 500 15/21 | card text in sheets, prompts |
| `--t-small` | Spline 500 13/17 | reasons, helper lines |
| `--t-label` | Mono 600 **11**/13, +0.08em, UPPERCASE | names under bars, zone labels, "HIT FOR" |
| `--t-pad` | Caveat 700 22/24 | the pad's totals (19px for source lines) |

**Minimum size 11 px**, only in Mono caps; no text under 13 px in sentence case. Life numerals are always
tabular and never animate width (the column is fixed, `--bout-life-w`). Announcer: speaker label above (Mono 11,
seat colour), the line below (BSD 30, bone), on a left-anchored dark scrim `rgba(0,0,0,.85→0)` with a 4px seat-colour
bar on the left edge — the opponent "dictating".

---

## 5. Spacing, radii, borders, z-order

- **Grid: 4 px.** Steps 4/8/12/16/24/32. Side gutter `--gut` **10** (393), 8 (375), 12 (430). Gap between hand cards 8.
  Zone content never closer than 6 px to a seam.
- **Touch targets ≥ 44** (`--tap`): the hub's secondary buttons are 44×44, primary 52 tall. Hand cards are 80×112 (full
  card is the target; the 8px gap is dead space by design so adjacent taps do not collide).
- **Radii:** cards ≈ 5% of width (hand 4, mat 3, chain 6, glimpse 11) · chips 6 · primary button 26 (pill) ·
  secondary 22 · sheets 16.
- **Borders:** hairline `1px --rail`; rings 2px (+1.5px dark gap) on portraits/medallion/selection.
- **Z-order** (`--z-*`): mat 0 · cards 10 · chain 20 · tray 30 · hub 40 · bout 50 · announce 60 · scrim 70 ·
  glimpse 75 · sheet/pad 80 · menu 90 · toast 100.

---

## 6. THE CARD OBJECT

**Decision: the art is the face; numbers are re-stamped at the printed corners.** A printed 546-px card at 80 px
wide has its cost/power/defence at ≈ 6 px — unreadable. So at hand/mat/block size we overlay four stamps exactly over
the printed positions (cost TL, pitch TR, power BL, defence BR), larger and higher-contrast than print, and a
4-px pitch strip across the top edge. At chain size and above the printed face is legible and only the power stamp
(attack) stays. **At glimpse size no stamps at all — the card is shown exactly as printed.** Reason: faces stay
honest and recognisable (the player knows the art), while the numbers the game turns on are readable in one glance at
arm's length; stamps only restate values the engine already reads from the card (never invented).

The card NAME is not readable at hand size (80 px); it appears as a bone name-plate above the card when selected
(`.name`, Mono 11 caps) — selecting is the "peek".

### 6.1 Sizes (w×h, ratio 0.716; h = round(w/0.716))

| place | 393×660 | 375×548 | 430 wide | radius |
|---|---|---|---|---|
| hand row | **80×112** | 70×98 | 92×128 | 4 |
| on the mat: gear, weapon, arsenal, piles | **56×78** | 48×67 | 64×89 | 3 |
| the attack on the chain | **112×156** (128×179 when stage ≥ 260) | 92×128 | 130×182 (150×209 tall) | 6 |
| blockers, stack items | **64×89** | 52×73 | 74×103 | 4 |
| earlier chain links, pitch fan | **40×56** | 34×47 | 46×64 | 3 |
| their hand (face down), fan step 14 | **28×39** | 24×34 | 32×45 | 2 |
| the glimpse | **232×324** (≈ 59% w) | 210×293 | 262×366 | 11 |
| glimpse's pitched cards (beside) | **92×128** | 80×112 | 104×145 | 8 |
| stamp chip | **20** | 18 | 22 | — |

Tapped/exhausted: the card rotates 90° about its centre inside a slot of `h×h` footprint width reserved only for
weapons (gear never rotates). Pitched cards rest as a fan of 40×56 backs-up-faces at 6-px steps in the pile; a
graveyard/banish pile shows its top card face-up.

### 6.2 Edge, frame, shadow
`background:#000`, `box-shadow: var(--e1), inset 0 0 0 1px rgba(0,0,0,.65)`, plus `::after` inner highlight
`inset 0 1px 0 rgba(255,255,255,.10)`. The image fills (`object-fit:cover`), clipped by the radius. A pile is the top
card with a 2px offset shadow-card behind it (`.pile.s`) — never a stack of drawn layers.

### 6.3 Stamps (at hand size; mat/block show power + defence only, 16px)

| corner | shape | fill / text | meaning |
|---|---|---|---|
| TL | circle 20, 1.5px brass ring | mat-0 / bone | cost (`X` for variable) |
| TR | rounded square r5 | pitch chip colour / white (yellow: dark) | pitch value 1/2/3 |
| BL | rounded square r5 | bone / dark | power |
| BR | shield (clip-path) | silver `--prevent` / dark | defence |
Stamps show only values the card has; a missing one is simply not drawn. Text BSD 800 14.

### 6.4 States

| state | look |
|---|---|
| **playable** | at rest raised 4px with a 3px **jade underline** (8% inset, `--you`, soft glow). |
| **unplayable** | stays down, `filter: brightness(.58) saturate(.7)` — still readable. No underline. |
| **selected** | lift 12px, scale 1.04, `--e3`, 2px bone ring, name-plate above. Never more than one. |
| **refused** | 2px `--refused` ring + a pink reason chip above ("NEEDS 2 MORE", Mono 11 caps) with a 4px tail; reason is by name (POLISH §1). Shake/timing: motion director (hook class `.is-refused`). |
| **exhausted** | rotated 90°, otherwise unchanged. |
| **destroyed / broken** | `brightness(.45) saturate(.2)` + two dark hairline cracks (diagonal). Then it moves to its pile. |
| **blocking** | 2px `--prevent` ring, offset toward the middle, silver shield badge below with the defence value. |
| **counters / tokens** | a brass-rimmed hexagon badge (counter glyph + number) centred on the bottom edge, overlapping 9px; plain pile counts are a dark 20px pill at bottom-right. Tokens (Runechant…) are mat-size cards, same frame. |
| **pitch strip** | 4px, top edge, full width: red `#F0493D`, yellow `#FFD12E`, blue `#4A9BFF`; none = no strip. |
| **face down** | the original back, same radius/edge. |

### 6.5 The card back (original)
Indigo-black gradient (`#1A2338 → #0B1019`) with a 45° brass lattice at 10%; a double brass keyline (1.2 + 0.6 at
45%); at the centre a **dawn disc** (brass, 9 r) inside a brass ring, eight short rays, and a **blade** laid across
it (bone, tapered both ends). Reads as "sun on a blade". Defined once as `--card-back` (inline SVG, ~1.3 KB) and
used for every face-down card at every size.

---

## 7. The bout (the one piece of fighting-game chrome)

One strip across the top, height **56** (SE 52, Pro Max 60), over a `rgba(0,0,0,.55 → 0)` top shade, z 50.

Left to right (393): portrait 36 · bar 90 (overlapping the portrait by 8) · numeral 38 · medallion 50×52 ·
numeral 38 · bar 90 · portrait 36; gutter 10. Total 390. (SE: portrait 32, bar 90, numeral 36, medal 42; 430: 40,
98, 42, 50.) Menu and pad live in the hub, not the bout.

- **Portrait:** circle cropped from the hero's art (`background-size:310%`, face near 50% 18%); ring 2px seat colour +
  1.5px mat-0 gap. Turn player: full opacity + a seat-colour glow (`0 0 14px`); the other: 78% opacity.
- **Bar:** 14 tall (SE 12, PM 16), skewed 14° (you −14°, they +14°), track `--mat-0` with an inset shadow and a 1px
  white-10% rim; segment notches every 25% of max life (1px black 45%). Fill gradient = lit top 22% (seat colour
  blended 30% white), body = seat colour, shade `*-lo`. **Anchored at the portrait, drains toward the middle** (TABLE-TALK
  §5). Name under the bar: Mono 11 caps, `--ink-1`.
- **Numeral:** BSD 800 34, fixed 38-px column, `text-shadow: 0 2px 0 rgba(0,0,0,.6)`.
- **Damage hooks (visuals only; timing is MOTION.md's):** `.ghost` = a `--damage` segment from the new life edge to the
  old one, shrinking away after the hit; `.pop` = "−4" BSD 800 26 `--damage` with a rose glow above the numeral;
  a **drain** is the fill's `transform: scaleX()` (origin at the portrait) — never `width`.
- **Low life (≤ 25% of max):** numeral → `--damage`, bar rim → 1px `--damage` + 10px rose glow. Seat colour stays on
  the fill (identity never changes).
- **Medallion** (turn/round): octagon 50×52, 3px ring in the TURN PLAYER's seat colour, dark inner gradient, the
  turn number BSD 900 24 over "TURN" Mono 11, a 5px pointer on the side of the turn player. It is the only
  turn/round indicator.

---

## 8. Iconography (original, inline SVG, 24 grid, `<symbol>`s in the tile)

| icon | form | use | size |
|---|---|---|---|
| action point | brass **diamond gem**, lit upper half, dark keyline, inner outline | your/their AP, one per point | 20 on mat |
| resource | silver **coin**, ring + inner ring + `+` | one per floating resource | 22 |
| go again | two curved arrows chasing (loop), 2.4 stroke, `--goagain` | on go-again text and the chain | 16–24 |
| counter | brass hexagon with a `+` | counters on cards | 13–16 in a badge |
| defence | shield, `--prevent` | blocking badge, defence stamp | 12 / stamp |
| power | sword, bone | reserved (not drawn by default; the stamp is the numeral) | 16 |
| hand size / intellect | two fanned cards | shown only in the hero sheet, not the table | 20 |
| deck | card with a stacked edge | hero sheet | 20 |
| menu / pad | three dots / lined sheet | hub secondary buttons | 24 |
Stroke icons: 2 px, round caps, colour from `currentColor`. AP and resources stack bottom-right of your half
(gems above coins), shown only when non-zero; theirs mirror top-right.

---

## 9. Buttons (the hub)

- **Primary — ONE per screen.** 52 tall (SE 48, PM 54), min-width 176, pill r26, **bone** face (`#FBF7EC → #E8E0CC`),
  BSD 800 20 caps, `--ink-inv` text (14.7:1), a 4px "lip" (`0 4px 0 #8f8671`) + `--e2` shadow so it reads as a
  physical key. Says the line you'd say: END TURN · DONE DEFENDING · PLAY WOUNDING BLOW · PASS.
- **Press: instantly (`--m-press:0`)** — the key sinks 3px (`top:3px`), face darkens to `#E3DBC6 → #D3CBB5`, lip
  collapses to 1px. Within one frame of touchstart (use `:active` + `touchstart` class; never a transition).
- **Secondary:** 44×44 or 44 tall pill, `--mat-3` face, bone text/icon, 3px lip `#0b1013`; sinks 2px. Hub left = menu
  (⋯), right = pad. Pass (when it is not the primary) is a secondary.
- **Disabled** = nothing legal exists right now: transparent, 1.5px `--rail` outline, `--ink-2` text, no lip, no press.
- **Refused** = a legal-looking tap on something not allowed: the button keeps its full face and gains a 2px
  `--refused` ring + a reason chip above it. Never grey out something that could be explained instead.
- Focus: 2px `--focus` ring, offset 2 (keyboard/switch access; invisible to touch).

---

## 10. The table layout grid

Fixed-height bands; the **middle band (the stage) is `flex:1`** and takes every px that grows. Nothing scrolls
except the hand row (horizontal). `100dvh` for height; no `100vh`.

### 10.1 Band heights

| band | 393×660 | 375×548 | 430×740 | 393×852 standalone | 430×932 standalone |
|---|---|---|---|---|---|
| safe top (`env`) | 0 | 0 | 0 | 59 | 59 |
| **bout** | 56 | 52 | 60 | 56 | 60 |
| **their half** | 100 | 84 | 112 | 108 | 120 |
| **stage (centre)** | **202** | **150** | **236** | **277** | **311** |
| **your half** | 100 | 84 | 112 | 108 | 120 |
| **hand row** | 134 | 116 | 148 | 142 | 156 |
| **hub** | 68 | 62 | 72 | 68 | 72 |
| safe bottom (`env`) | 0 | 0 | 0 | 34 | 34 |
| total | 660 | 548 | 740 | 852 | 932 |

Standalone rule: at `min-height:760px` halves and hand gain 8px and the chain card steps up (128×179 / 150×209).
The hub's bottom padding is `env(safe-area-inset-bottom)`; the bout's top padding is the top inset.

### 10.2 Inside each band (393)
- **Their half (100):** left, gear/weapon at 56×78 (face-up, tapped weapon rotates); right, their hand as a 14-px-step
  fan of 28×39 backs, then arsenal (56×78 back, count dot only when yours) and deck (56×78 back, count pill). Empty
  zones are bare mat (no dashed slots). Their AP/resources mirror yours, shown only when non-zero.
- **Stage (202):** bare mat when idle. The chain: attack 112×156 centred; blockers 64×89 overlapped −14/−26 on its right, a
  bit offset up/down so each is visible; earlier links 40×56 stacked left at 18 px steps. The "hit for N" figure right
  (BSD 900 44, `--damage`). The announcer slab (60 tall) sits at the stage's top edge z 60; the glimpse scrim and card
  (232×324, e4) centre over the stage and may cover the halves, never the bout or hub.
- **Your half (100):** mirror of theirs; right of it, AP gems (20) over resource coins (22), then your arsenal and deck.
- **Hand row (134):** a flat, native-scrolling row, scroll-snap start with `scroll-padding-left:var(--gut)`; card
  80×112 at the bottom of the band; 22 px above for the ready lift (4), selected lift (12) and name-plate; **4 cards +
  25 px of the 5th visible** (affordance to scroll).
- **Hub (68):** `[menu 44] [PRIMARY 52 × flex] [pad 44]`, 10 gutter; everything in the thumb third (y ≥ 440).

### 10.3 Thumb zone
Hand + hub = bottom 202 px (31%). Everything you can tap often lives there; the stage is read-and-tap-to-peek; the
bout is read-only (a tap opens the pad).

---

## 11. Responsive rules (summary)
1. Cards scale by WIDTH (3 steps: ≤379, 380–413, ≥414). Heights follow from 0.716.
2. Bands are fixed except the stage. Never shrink a card to fit: shrink the stage (it has the slack).
3. Standalone adds safe-area padding to bout (top) and hub (bottom) only.
4. Type steps: life 30/34/38, announcer 26/30/30; nothing else changes.
5. Landscape is not supported in v1 (lock to portrait: show a rotate hint).

---

## 12. Verified vs not
Verified in Chromium (Playwright) at 393×660, 375×548, 430×740: layout fits with no horizontal overflow; real card
images and all four fonts load. **Not verified (WebKit/iPhone):** font rendering and tabular figures in Safari, the
SVG-noise grain cost, `color-mix()` (used for bar gradient and portrait glow — needs iOS 16.2+; fallback = solid seat
colour), `clip-path` stamps, and notch/standalone insets on a real device. The probe page must check these.
