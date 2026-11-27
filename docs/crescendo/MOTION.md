# MOTION — how Dawnblade moves, sounds and feels (CRESCENDO)

Author: the Motion & Feel Director. Authority for every `--m-*` token and every millisecond below.
Companion: `mockups/motion-lab.html` (every key choreography, playable on a phone; its `:root` holds these tokens and its
JS builds the timelines from them, so the lab and this file cannot drift). Binding context: `BRIEF.md`, `POLISH.md`,
`docs/TABLE-TALK.md` §4/§6/§10. Times are milliseconds from the event's **t=0** (the frame the engine state changes).

**The rule above all rules.** The *state* changes at t=0 and is correct from t=0 (life number, zones, legality, the
action the player may take next). Motion is a **presentation of a state that already exists**; it may delay what is
*shown as a story*, never what is *true*, and never the player's ability to respond (§4.4).

---

## 1. The frame budget and performance rules

### 1.1 The bar
- **No frame over 16.7 ms** on a mid iPhone (iPhone 12-class A14, Safari). Proxy in the lab: Chromium at CDP
  `Emulation.setCPUThrottlingRate 4`, frame intervals measured with `requestAnimationFrame`; pass = zero intervals > 17.5 ms
  across a whole choreography. 60 fps is the floor; on 120 Hz ProMotion phones the same timelines run (they are time-based,
  never frame-counted).
- **Input response ≤ 1 frame.** A press paints its pressed state in the same frame as `pointerdown` (CSS `:active`,
  never waiting on React). Total tap → visible change ≤ 80 ms for everything (`--m-press`).
- **Everything is time-based**, never "N frames". A dropped frame costs smoothness, never duration or order.

### 1.2 What may animate
- **`transform` and `opacity` only.** Nothing else is ever animated, transitioned or keyframed: not `width`, `height`,
  `top/left`, `margin`, `box-shadow`, `filter`, `border`, `background-position`, `clip-path`, `letter-spacing`.
  - The health bar is a full-width element scaled with `transform: scaleX(f)` from `transform-origin: 0 50%` (a second one
    is the ghost). Its end-cap is not scaled (draw it as a separate element positioned by `translateX`, or don't have one).
  - A number "changes" by replacing its text at t=0 (instant), with a `scale`/`opacity` **pop** laid over it — never by
    counting up and never with a layout-changing width. Numerals use `font-variant-numeric: tabular-nums` so the swap does
    not reflow.
  - A glow is a pre-rendered radial-gradient layer whose `opacity` animates, not an animated `box-shadow`/`filter: blur`.
  - Screen shake moves one wrapper (`.world`) with `translate3d` + a tiny `rotate`. Never shake individual cards.
- **Prefer the Web Animations API (`el.animate`) or CSS keyframes** over JS-driven per-frame style writes: transform/opacity
  WAAPI animations run on the compositor thread, so a busy main thread (engine, Sharp AI search, React render) cannot
  stutter them. A `requestAnimationFrame` loop that writes `style.transform` is allowed only for the shake if WAAPI
  keyframes prove insufficient (they did not in the lab: the shake is generated keyframes).
- **One layer per mover.** Each flying card is its own element already at its final pixel size (never scaled up
  from a thumbnail → blurry; never re-laid-out). Size the card element once at the **largest** size it will show
  (glimpse size) and reach smaller sizes with `scale()` so the GPU texture is reused. (Lab: cards are 236×330 and
  scaled to 64×90 in the hand.)

### 1.3 `will-change` and layers
- `will-change: transform, opacity` is applied **only to elements about to animate** (set one frame before, removed on
  `animationend`/`finished`), and never to more than ~12 elements at once. Permanent `will-change` on every card in a hand
  eats memory on Safari and causes the blurry-text-after-scale bug. Exception: the persistent layers the choreographies
  always use — the `.world` shake wrapper, the announcement slab, the glimpse layer, the pad — which are few and fixed.
- No `backdrop-filter` and no `filter: blur()` inside any animated region (the BRIEF already flags `backdrop-filter` cost
  on WebKit). The dim behind a glimpse is a flat black `opacity` layer.
- Images: every card art is `decode()`d (`img.decode()` or `new Image()`) **before** its flight starts; a flight never
  starts on an undecoded image (a decode mid-flight is the classic dropped frame). The announcer's glimpse card is
  pre-decoded the moment the engine state arrives, which is already ≥ 60 ms before the slab lands (§3.5 starts the card at
  t=60 for exactly this reason).

### 1.4 No layout work in a frame
- **No layout read and no layout write during a choreography.** No `getBoundingClientRect`, `offsetWidth`,
  `scrollTop`, `getComputedStyle().<layout prop>` and no style change that alters layout (class toggles that change size,
  inserting/removing a node in flow) between t=0 and the last keyframe.
- Positions are **measured once before** (at layout time, cached: slot rectangles of hand, chain, pitch, graveyard, pad,
  bars are stored when the table lays out and on resize/orientation) and flights are computed from the cache.
- DOM changes that the choreography ends in (the card is now in the chain) happen **at the end frame of the flight**, in
  one batch, with the flying clone removed in the same frame (clone-and-fly; the real node is `visibility:hidden` while its
  clone flies — never `display:none`, which reflows the hand).
- The gap a played card leaves in the hand closes by transforming neighbours (§3.2), and the hand's row layout is committed
  once, after.

### 1.5 `prefers-reduced-motion`
When `matchMedia("(prefers-reduced-motion: reduce)")` matches (and in an in-game "Reduce motion" switch, which the OS
setting seeds):
- **Every flight, slam, shake, pop, sweep and flip becomes a cut**: the end state appears in one frame.
- **Hit-stop is dropped; shake is off.** Damage is shown by the number swap, the bar `scaleX` set (no ghost), and a 120 ms
  `opacity` flash on the bar (opacity-only, no movement).
- The **announcement is kept** (it is information, not decoration): the slab appears with an opacity fade of
  `--m-fast`, holds the same 1.5 s (tap to skip), no slide, no thud-scale. The glimpse card appears at its glimpse spot with
  the same fade; leaves with the same fade.
- Sound is independent of reduced motion (it has its own switch).
- The lab's checkbox exercises this path (`rm` → every `anim()` has duration 0, state changes still happen).

### 1.6 Verifying (the gate for the dev team)
A choreography test drives the real page at 393×660 under 4× throttle, runs every §3 event, records rAF intervals and
`PerformanceObserver({type:"longtask"})`, and fails on any frame > 17.5 ms or any long task > 50 ms inside a choreography.
Honest limit: Chromium's CPU throttle does not throttle the compositor, and WebKit is not Chromium; the final number
is taken on a real iPhone (screen-record 60 fps, or Safari Web Inspector Timelines) — see "What the lab can't prove" in §7.

---

## 2. The timing vocabulary — the `--m-*` tokens

Small on purpose. If a new animation needs a new duration, it is wrong or this table is.

### 2.1 Durations

| token | value | use |
|---|---|---|
| `--m-press` | **70ms** | input feedback: press state, lift, selection, a pip filling. Never longer than 80. |
| `--m-fast` | **120ms** | small state changes, fades, a chip appearing, an element leaving |
| `--m-std` | **220ms** | standard travel: a card moving zone to zone, a bar slide, a hand gap closing |
| `--m-emph` | **380ms** | emphatic: a big flight (to the glimpse), the turn medallion, the result slab |
| `--m-slam` | **260ms** | the announcement slab's slam-in (ease with overshoot) |
| `--m-glimpse-own` | **560ms** | how long YOUR own played card holds in its glimpse (a confirmation echo; tap skips) |
| `--m-hold-announce` | **1500ms** | how long the OPPONENT's announcement + glimpse holds (tap skips, press-and-hold keeps) |
| `--m-ghost-delay` | **420ms** | the bar's ghost segment waits this long before draining |
| `--m-ghost-drain` | **380ms** | the ghost's drain to the new life |

Hit-stop (§3.9) — Melee's freeze frames, the world holds still on contact:

| token | value | damage |
|---|---|---|
| `--m-hitstop-light` | **50ms** (≈3 frames) | 1–2 |
| `--m-hitstop-mid` | **90ms** (≈5–6 frames) | 3–6 |
| `--m-hitstop-heavy` | **150ms** (≈9 frames) | 7+ |
| `--m-hitstop-ko` | **260ms** | the lethal hit |

Hit-stop is a **hold**, not an animation: at t=0 the impact pose and flash are shown, the number and bar have already
changed, and the world waits N ms before the shake and the drain begin. It is capped (heavy 150, KO 260) so a 20-damage hit
is never longer than a 7.

Derived, not tokens: stagger between simultaneous items = 40 ms; shake duration = `min(160 + 28·dmg, 420)` ms; shake
amplitude = `min(2.5 + 1.5·dmg, 13)` px (a decaying sine, squared falloff; rotation ±1.1° only for dmg ≥ 6).

### 2.2 Easings

| token | value | feel / use |
|---|---|---|
| `--m-ease-out` | `cubic-bezier(.16,.84,.24,1)` | things ARRIVING: fast start, soft landing. The default. |
| `--m-ease-in` | `cubic-bezier(.55,0,.85,.35)` | things LEAVING or lunging into an impact: they accelerate (the attack lunge). |
| `--m-ease-inout` | `cubic-bezier(.45,0,.2,1)` | zone-to-zone moves and the turn flip: both ends soft. |
| `--m-ease-slam` | `cubic-bezier(.3,1.45,.5,1)` | overshoot-and-settle: the slab, pips, chips, the result word. |

Linear is used only for shake keyframes (their shape is baked into the keyframes) and opacity-only crossfades under 120 ms.

### 2.3 Rhythm rule
Same event ⇒ same duration, always, for both seats, every game. The only variable is damage (hit-stop and shake scale by a
fixed formula, so a "7" always *feels* like a 7). No random jitter, no easing variants.

---

## 3. The choreographies

Coordinates are in the table's own 393-wide space; positions are cached slot rectangles (§1.4). "Hand → X" flights go
along a straight line with `--m-ease-out` unless stated. **S** = sound cue from §6. `‖` = runs in parallel.

### 3.1 A press (every button and tappable)
| t | what |
|---|---|
| 0 | `pointerdown`: pressed state paints (scale .96, +8% lightness; opacity/transform only). **S tap** (very quiet, optional) |
| 0–70 | transition back on release, `--m-press` / `--m-ease-out` |
| — | the action fires on `pointerup` (never on `click` after a 300 ms delay: `touch-action: manipulation`) |
A **refused** tap (illegal play) does not press-and-nothing: it plays a **nudge**: the card shakes ±4 px for 140 ms (3
half-cycles) and the table says why, by name (BRIEF §5). No sound for a refusal beyond the same quiet tick.

### 3.2 Selecting a hand card
| t | what |
|---|---|
| 0 | the card lifts: `translateY(-22px) scale(1.06)`, 70 ms `--m-press`. **S select** |
| 0 | its legal destinations/pitch-cost chips fade in, 120 ms |
| tap again / elsewhere | settle back, 120 ms |
The hand stays a flat row; neighbours do **not** move on selection (nothing reflows).

### 3.3 Playing a card — hand → glimpse → zone (your play, ≈ 1.2 s, skippable)
| t (ms) | what |
|---|---|
| 0 | state commits (card is now on the chain / resolved per rules). The clone lifts 70 ms (as 3.2 if not already lifted). |
| 70–330 | flight hand → glimpse (centre, ≈ 54% width), 260 ms `--m-ease-out`, scale to 1.04 |
| 330 | **S slap** · settle to 1.00 over 80 ms (a small bounce-less land) |
| 410–970 | HOLD, `--m-glimpse-own` 560 ms (tap = skip to next row) |
| 970–1190 | settle into its zone (chain slot), `--m-std` `--m-ease-inout`, scale to slot size |
| 970–1190 | ‖ the hand's neighbours slide to close the gap, `--m-std` `--m-ease-inout` (transform only) |
| 1190 | clone removed, real node revealed in the zone, in one frame |
Your own glimpse is shorter than the opponent's: you chose the card; it is confirmation, not news. **Pitched cards played
as cost** glimpse small beside the card (they glimpse *with* it, same hold) — see 3.4.
The player may act again at **t=0 if the rules allow** (§4.4): the glimpse is not a lock.

### 3.4 Pitching — card to the pitch zone, the resource gained
| t | what |
|---|---|
| 0 | state commits (resource +N). The pitch pip (resource counter) **fills the same frame** — truth first |
| 0–70 | lift (as 3.2) |
| 70–280 | flight → pitch pile, 210 ms `--m-ease-out`; the card shrinks to pile size en route |
| 280 | **S pitch** (a clink) · the pip pops: scale 1 → 1.7 → 1 over `--m-std` `--m-ease-slam` |
| 280–500 | the card settles on the pile |
Pitching to pay for a card (the common case): the pitched cards fly to the pile **first, 70 ms apart (stagger 40 ms ok if
three)**, then the played card begins 3.3. The pitch glimpse is the *small* version (each pitched card shows ≈ 28% width,
tagged with its pitch colour) alongside the played card, per TABLE-TALK §6.

### 3.5 The opponent's play announced — bold slab + glimpse, ONE at a time (the product's signature)
| t (ms) | what |
|---|---|
| 0 | state commits; announcement enqueued (§4). **S thud** |
| 0–260 | the SLAB slams in from THEIR side (top-left of the opponent's end): `translateX(-100% → +10px → 0)`, `--m-slam` `--m-ease-out` with the overshoot at 70% |
| 60–440 | the card flies from the opponent's hand (a card back at their edge) to the glimpse spot: 380 ms `--m-emph` `--m-ease-out`; the face is revealed at 60 ms in (pre-decoded) |
| 440 | **S slap** |
| 440–1940 | HOLD `--m-hold-announce` (1500). Tap = skip. Press-and-hold = keep until release |
| 1940–2100 | slab leaves (translateX → the far side + opacity 0), 160 ms `--m-ease-in` |
| 1940–2160 | ‖ the card goes to where it lives (chain / graveyard / pitch pile), `--m-std` `--m-ease-inout` |
| 2160 | next announcement may start (strict queue, §4). Pitched cards ride the same slot as small tagged chips beside the card |
**Skipped** (tap): both the slab and card jump to their leave poses in `--m-fast` (120 ms) — never a hard cut mid-flight,
never a swallowed state. The next item starts 40 ms later.
Headline text, sub-line and glimpse contents come from `engine/announce.js` (TABLE-TALK §4.1); hidden cards are card
backs. The slab's *geometry* is the same for both seats' sides; only the entry side differs.

### 3.6 An attack — onto the chain
| t | what |
|---|---|
| 0 | state commits (attack on the chain; legal blockers now computed — **the defender's response window opens at t=0**) |
| 0–330 | the play flight/glimpse as 3.3 or 3.5 (above), but its destination is the chain's attack slot; the attack power badge (a number, set at t=0) pops with the landing: scale 1 → 1.25 → 1, `--m-std` |
| landing | the card tilts 1.5° toward the defender (static pose; no loop) to read "pointing at you" |
The chain is a column of cards, newest on the end; each addition slides the column 24 px with `--m-std` (transform).

### 3.7 Go again
| t | what |
|---|---|
| 0 | state commits (AP +1) |
| 0–120 | the attack card nudges up 6 px and a GO AGAIN chip pops beside it: `scale(.8→1.08→1)`, `--m-std` `--m-ease-slam`. **S goagain** |
| 0–380 | a ring (circle, opacity .9→0, scale 1→3.2, `--m-emph`) expands from the action-point pip |
| 380 | the AP pip refills: pop 1 → 1.8 → 1, `--m-std` `--m-ease-slam` |
| 380–… | chip holds while the attack resolves, fades 120 ms when it leaves |
Go again is always a **gain**; it never blocks input (the player may already be acting with the new point — the pip is
already true at t=0, the pop is flavour).

### 3.8 Defending — blockers move up
| t | what |
|---|---|
| 0 | state commits (blockers declared). The defender's own blockers lift out of the hand: 70 ms |
| 70–290 | blockers fly to the front of their hero (between hand and the attack), `--m-std` `--m-ease-out`, stagger 40 ms each |
| 290 | **S block** (a metallic double tick) once, regardless of how many blockers; each blocker's defence number pops 1 → 1.25 → 1 over `--m-std` |
| 290–… | total defence badge updates on the chain (text swap at t=0; pop at 290) |
The opponent's blockers: announced as in 3.5 (BLOCKING · with 2; the glimpse shows them side by side) then move up as above.

### 3.9 Damage — the hit (Melee's moment)
Contact is the instant the engine says damage is dealt. **t=0 is contact.** (Lab: `hit1`, `hit3`, `hit7`.)

| t (ms) | what |
|---|---|
| −210…−90 | wind-up: the attack's card on the chain draws back 8 px (120 ms `--m-fast`) |
| −90…0 | lunge toward the victim's bar: 90 ms `--m-ease-in` (it accelerates into the hit; ease-IN is what gives impact) |
| **0** | **CONTACT.** In this one frame: life number text = new total · the `fill` bar jumps to the new `scaleX` (no tween) · a white `flash` layer on the bar peaks (`opacity .9 → 0` over 140 ms) · the hit sound **S hit1/hit3/hit7** · the damage pop element is created. |
| 0 → HS | **HIT-STOP**: the world holds its pose. HS = `--m-hitstop-light` (1–2), `-mid` (3–6), `-heavy` (7+), `-ko` (lethal). Nothing moves; the flash still fades (it is the only thing allowed to move). |
| HS | the **shake** begins on `.world`: duration `min(160+28·dmg, 420)`, amplitude `min(2.5+1.5·dmg, 13)` px decaying; 7+ adds ±1.1° |
| HS | ‖ the **number pop**: `-N` scales .4 → (1.1+0.06·dmg, max 1.7) → 1 while rising 40 px and fading out over 720 ms |
| HS | ‖ the attacker card fades/slides away, `--m-std` `--m-ease-out` |
| HS + `--m-ghost-delay` | the **ghost** segment (a lighter second bar behind the fill, at the OLD width) begins to drain to the new `scaleX`, `--m-ghost-drain` `--m-ease-inout`. Until then it holds, so the eye reads exactly how much was lost. |
| HS + 800 | all done; the world is at rest |
Totals from contact to rest: the hit-stop + max(shake, ghost drain 800 ms): about 0.85 s (1 dmg), 0.9 s (3), 0.95 s (7),
plus the 210 ms wind-up/lunge before contact.
**Why hit-stop works:** the numbers have already updated; the stop is purely a held frame that lets the brain register
"that landed", then the shake releases the energy. It never delays the next *legal action* (§4.4).
**Multiple hits in the same moment** (e.g. a two-damage-step resolution): each plays in order, but a hit that starts
within 150 ms of the previous one joins it: one hit-stop for the sum (still capped), one shake, one pop that reads the sum
(`-9`), the ghost drains once to the final total.
**Life gain** (`+1 LIFE`): no hit-stop, no shake; the bar fill `scaleX` tween 220 ms and a green pop `+N`.

### 3.10 Prevention
Prevented damage is not a hit (CR 7.5.5): **no hit-stop, no shake, no number pop.**
| t | what |
|---|---|
| 0 | state commits; a pale-blue ring flash on the bar (`opacity .5 → 0`, 220 ms) · **S block** |
| 120 | **S prevent** (a soft shimmering fifth) |
| 0–700 | **PREVENTED** word rises 20 px and fades (scale .7 → 1.05 → 1), `--m-std`-based |
So prevention is silent-ish and gentle, visibly the *opposite* of a hit.

### 3.11 A reaction (attack reaction / defence reaction / instant)
A reaction is a play that interrupts a resolving chain, so it must look *different* from a main-phase play: it never gets
the full glimpse hold.
| t | what |
|---|---|
| 0 | state commits |
| 0–220 | flight hand → the chain at the spot it affects, `--m-std` `--m-ease-out`, scale 1.0 (a **short glimpse**: 300 ms hold at 0.7 glimpse size), **S slap** (quieter, −3 dB) |
| landing | the affected attack's power/defence number pops; the card then settles into the chain slot, 220 ms |
Opponent reactions are announced like 3.5 with the sub-line "attack reaction"/"defense reaction"/"instant", but the hold
is `--m-hold-announce × 0.6` (900 ms): reactions are fast at a real table, and the responder's window must not stall.
Tap still skips; the strict queue still holds.

### 3.12 The chain resolving and closing
| t | what |
|---|---|
| 0 | the chain's top link resolves (state) |
| 0–120 | the resolving link brightens (overlay `opacity` .0 → .5 → 0, 120 ms) |
| 120–340 | the link's cards go to graveyard/banish: flight `--m-std` `--m-ease-inout`, stagger 40 ms, newest first |
| after the last link | **CLOSE**: the chain column collapses (transform) and the combat chain's slot dims for 120 ms; no sound |
The graveyard receives with a 6% scale bump (1.06 → 1, 120 ms), no sound (the slap was the landing sound).

### 3.13 Drawing up — cards dealt into the hand
End-phase draw: the deck is a stack on the right; N cards are dealt **one at a time, 90 ms apart**:
| t (ms) per card | what |
|---|---|
| 0 | the card back flies deck → its hand slot, `--m-std` `--m-ease-out`, the hand row *already contains the slot* (the row's layout is committed at t=0; the card arrives into a reserved space — no reflow) |
| 160 | the card flips face-up **only for the owner**: `rotateY(180° → 0°)`, 140 ms (the opponent's hand stays backs: see HIDDEN-HANDS.md) |
| each | **S draw** (a soft swish), −6 dB each after the first so five draws are not five loud sounds |
Total for 4 cards: 4×90 + 220 + 140 ≈ 720 ms. The opponent's draw: backs only, same timing, no flip. Game start's opening
draw is the same, slower by 40 ms per card (§3.16).

### 3.14 The arsenal
Setting a card in the arsenal: a face-down card flies hand → arsenal slot (`--m-std` `--m-ease-out`), **S slap**, then
settles with a 4 px `translateY` bounce (80 ms). The opponent's is **always a card back** and announced "ARSENAL · a card,
face down" (the glimpse shows a back; your own arsenal glimpse is skipped — you know it). Playing a card FROM the arsenal
flies it out of the slot (3.3 from the arsenal position; the face is revealed on lift, opponent included — it is now
public).

### 3.15 Gear destroyed
The piece breaks, it does not fall: at t=0 state commits; the gear card flashes white (overlay `opacity .7 → 0`, 100 ms), then
`scale(1 → 1.08)` while `opacity 1 → 0` over `--m-std` (a soft burst), then a copy goes to the graveyard as a normal flight
(`--m-std`, from t=120). **S block**, lower in pitch (the recipe's `f` ×0.7). No shake (it is not damage to a hero).
Tokens ceasing to exist (an aura expiring): the same fade without the white flash, no sound.

### 3.16 The turn passing — the medallion
The medallion is a round disc by the middle of the table, showing whose turn it is.
| t (ms) | what |
|---|---|
| 0 | state commits (turn player); phase UI re-keys |
| 0–500 | the medallion flips: `rotateY(0 → 180°)` with a scale hump 1 → 1.9 → 1 (the "toss"), `--m-emph`+120 `--m-ease-inout` (it shows YOU on one face, the opponent's hero on the other) · **S turn** |
| 0–900 | a full-width banner slab ("FAI'S TURN" / "YOUR TURN", small) sweeps across: in over 38%, holds, out over 30% — total 900 ms (it never needs a tap; the queue lets it interleave only at the end of a turn, never inside an announcement) |
| 700 | the new turn player's side lights: a bottom/top edge glow layer opacity 0 → .6, `--m-fast` |
It lands in under a second and never blocks input: the first legal action of the new turn is enabled at t=0 for the turn
player (and, at your turn, your hand is tappable immediately).

### 3.17 Game start — sitting down, the coin
| t (ms) | what |
|---|---|
| 0 | the mat appears, empty (`opacity 0 → 1`, `--m-std`) |
| 120–660 | both heroes' cards slide in from their sides to their places (`--m-emph` `--m-ease-out`), bar fills slide in (scaleX 0 → 1 over `--m-std`, 40 ms after) · **S slap** ×2 at 120/200 |
| 800–1500 | **THE COIN**: a disc rises 120 px, spins (`rotateX` 0 → 1080°, 600 ms `--m-ease-out`), lands with a bounce at centre (`scale 1.15 → 1`, 100 ms) · **S coin** (a bright ring-down) |
| 1500–2300 | the winner's name slab, "FAI GOES FIRST" / "YOU GO FIRST", the medallion settles to that side (as 3.16, 60% scale) |
| 2300–3000 | both hands are dealt, 3.13 slowed to 130 ms/card. Input is enabled from t=0 for anything legal (nothing is) |
Opening is ≈ 3 s the first time; **skip-all** (tap) fast-forwards the whole sequence in 300 ms. The "expert speed" setting
(§4.4) shortens it to ≈ 1.2 s. No decks being shuffled on screen (mulligan/shuffle is a text beat, no motion).

### 3.18 The KO / result — the climax ("DAWNBREAK")
Melee's "GAME!" is a freeze, a flash and one word. Ours is original and on-brand: the lethal hit, a held breath, then dawn.
| t (ms) | what |
|---|---|
| −210…0 | wind-up + lunge as 3.9 |
| **0** | contact: life → 0, bar → 0, flash, **S hit7 variant (ko)** |
| 0–260 | **KO HIT-STOP** `--m-hitstop-ko` 260 ms: *total stillness* (the longest in the game; the only time the whole world waits) |
| 260 | max shake (amp 12 px, ±1.1°, 420 ms) ‖ ghost drains over `--m-ghost-drain` ‖ the loser's hero card begins to fall: `translateY +90 px`, `rotate 6°`, `opacity 1 → 0`, 520 ms `--m-ease-in` |
| 260–760 | the world dims: a black overlay `opacity 0 → .72`, `--m-emph`+120 `--m-ease-out` · **S ko** (a low boom, then a rising bright triad) |
| 480–1000 | **THE BLADE OF DAWN**: a thin line of light crosses the screen at the middle, `scaleX 0 → 1` from centre over 320 ms, then fades (opacity) 200 ms |
| 700–1020 | **DAWNBREAK** (or the match's own word) slams in: `scale 1.6 → 0.96 → 1`, `--m-slam`+60 `--m-ease-slam`, gold, huge condensed type, with the winner's name beneath ("FAI WINS"). One rule: the word is always the same word, for either winner, for both seats. |
| 1020–2200 | HOLD (the result is not skippable for the first 600 ms of this hold, then tap = proceed) |
| after | the pad becomes the result sheet (rises from the bottom, `--m-emph`), the primary button reads "Rematch" |
Nothing on the KO is hidden info: the final state is public. Reduced motion: cut to the dimmed table + the word, no
shake/sweep/stop (§1.5).

---

## 4. Pace and fairness

### 4.1 The queue (strict)
- **One announcement at a time. Ever.** A single FIFO of "beats" (announcement + glimpse, hit, medallion, KO). A beat begins
  only when the previous beat's *leave* phase has finished (or been skipped). Two announcements never overlap on screen; a
  hit that follows a play (the very common "attack, then take 4") starts after the attack's glimpse leaves.
- **State is never behind the queue.** The queue animates; it does not gate. The engine's state is what the player may
  act on *now*, the queue is only the telling of it. If the player can already respond, they respond; the queue keeps
  playing in the background (and is skipped by their very response, see 4.3).
- **Coalescing.** Beats that are the same fact are merged: pitches into the card they pay for (3.4); simultaneous hits
  (3.9); a skipped beat's tail is collapsed. A queue deeper than 3 beats **auto-accelerates**: every beat in it plays at
  0.6× durations (holds 0.5×) until the queue is ≤ 1 deep, so a long chain never leaves the player waiting.

### 4.2 The AI seat at a human pace
`engine/local.js` `pace` applies the AI's actions one per tick. Targets (design, for the dev team to feed `pace(prev, a, next)`):

| the AI's action | think time before it, ms | then the beat |
|---|---|---|
| pass (most steps) | **110** | none (passes are not announced) |
| the first non-pass action of its turn | 500 | 3.5 announcement (2160 total) |
| later non-pass actions | 320 | 3.5 announcement |
| a reaction | 250 | 3.11 (900 hold) |
| blockers | 400 | 3.8 |
| a trivially forced action (only one legal) | 150 | as above |
The next think-time clock starts **when the beat's leave phase completes** (or on skip), never during the hold, so the
sum is "beat + think", never overlapping and never stalling behind a held press. Think times are deterministic (a function
of the action kind, never random and never "the AI's compute time"): a Sharp search that finishes in 40 ms and one that takes
400 ms look identical. (Fixed jitter-free rhythm is the fairness feature: nobody can read the AI's confidence from its speed.)

### 4.3 Tap to skip, hold to keep
- **Tap anywhere** on the table during a beat: it jumps to its leave phase in `--m-fast` and the queue advances in 40 ms.
- **Press-and-hold** (≥ 150 ms) on the glimpse/slab: keeps it up until release (to read the card). While held the queue is
  frozen and the think-time clock is paused.
- **Taking an action** (tapping a hand card, a button) while a beat plays **skips the beat** and performs the action (the
  tap is never lost): the action's own choreography starts at t=0.
- **Skip is never a hard cut mid-flight** (it plays the leave in `--m-fast`) and never skips *state*.

### 4.4 Expert speed
A setting (Settings → Speed: Standard / Quick / Instant), persisted per device:
| | Standard | Quick | Instant |
|---|---|---|---|
| durations | ×1 | ×0.6 | ×0 (cuts) |
| holds (glimpse/announce) | 1500 / 560 | 700 / 250 | 0 / 0 |
| think times | table 4.2 | ×0.5 | 0 for passes, 120 otherwise |
| hit-stop and shake | full | full | **kept (it is feel, 50–150 ms, and not a delay that costs a player anything)** |
Instant is "reduced motion plus the feel of the hit"; the announcement slab still appears for 400 ms so the opponent's plays
are *read*, not just resolved. The setting scales **both seats equally** — it is the table's speed, not the player's.

### 4.5 The fairness rules (non-negotiable)
1. **Identical timing for both seats.** Every beat takes the same time whether it's your play or theirs, whichever seat is
   the AI, whichever seat is the viewer (the only intentional asymmetry is the shorter own-play glimpse of 3.3 — and that is
   the same for both players about their *own* plays, mirrored). The AI never gets a faster or slower animation.
2. **Animation never hides information.** A card is never concealed or revealed by motion: the announcer's glimpse shows
   exactly what the rules make public, a card back otherwise; face-down flips only for the owner; the hit's shake never
   obscures a number (the life number is *outside* the shaking layer's blur — nothing is blurred — and is stable text, 13
   → 6 is readable under the shake: ≤ 13 px amplitude, ≤ 420 ms).
3. **Animation never eats a response window.** From t=0 of every state change, the player who must answer may answer: no
   input is disabled during a flight, a hit-stop, a slab or the medallion. The *only* input gate in the whole game is the
   KO hold's first 600 ms (the game is over; nothing to answer).
4. **The state is first.** The numbers and zones are correct at t=0 of every beat; no animation ever shows a stale value
   after t=0 (the pop is an overlay; the ghost is *explicitly* a record of the old value and never confused with the fill).
5. **No hidden-information leak through timing.** Think time is a function of the action's kind (4.2), never its
   consequence; a card played from hand vs arsenal looks identical until its reveal; passes are never animated differently
   by what is in a hand.

---

## 6. Sound — a minimal set, all synthesized

**Principle (POLISH condition 4):** every sound means one thing; a sound you can hear and not identify is deleted. 14 cues.
No audio files: pure WebAudio, zero bytes of assets, nothing to load on `file://`. Source of truth: `CUE` in
`mockups/motion-lab.html`.

### 6.1 The graph
`cue → (osc/noise → gain env) → master GainNode (0.5) → DynamicsCompressor (threshold −14 dB, ratio 6) → destination`.
Envelopes are `setValueAtTime(0.0001)` → `linearRampToValueAtTime(peak, attack)` → `exponentialRampToValueAtTime(0.0001, dur)`:
never a hard stop (clicks). Noise is a shared 0.6 s white-noise `AudioBuffer` through a `BiquadFilter`. Every cue is
**fire-and-forget**, scheduled `+5 ms` ahead of `currentTime` (so it is sample-accurate with the frame that triggers it);
overlapping cues are fine, but **never more than 6 voices at once** (drop the quietest cue past that).

### 6.2 The cues
Times are length in ms; "osc" = OscillatorNode; Hz are start → end of an exponential ramp.

| cue | trigger | character | length | recipe |
|---|---|---|---|---|
| `tap` | a press (optional, quiet) | a dry tick | 30 | sine 1800→1200 Hz, peak .16 |
| `select` | a card lifts | a soft rising blip | 70 | triangle 520→700, peak .18 |
| `slap` | a card lands (glimpse, arsenal, chain) | a card on felt | 100 | noise → bandpass 1800→500 Hz Q.8, 70 ms, peak .5 + sine 170→70 Hz, 100 ms, peak .5 |
| `pitch` | a card lands on the pitch pile | a clink | 220 | sine 2400 Hz, 220 ms, peak .22 + sine 3600 Hz, 140 ms, peak .1 |
| `thud` | an announcement slab slams | a low drum hit | 320 | sine 110→45 Hz, 320 ms, peak .8, attack 6 ms + noise → lowpass 600→200 Hz, 50 ms, peak .25 |
| `hit1` | contact, 1–2 damage | a slap | 90 | noise → bandpass 1400→600 Q.9, 90 ms, peak .5 + square 220→110 Hz, 70 ms, peak .18 |
| `hit3` | contact, 3–6 | a thump | 200 | noise bandpass 1000→350, 140 ms, peak .7 + sawtooth 160→60, 140 ms, peak .28 + sine 90→45, 200 ms, peak .6 |
| `hit7` | contact, 7+ | a heavy blow | 420 | noise → lowpass 3000→200, 260 ms, peak .9 + sawtooth 120→38, 300 ms, peak .4 + sine 70→28, 420 ms, peak .9 + square 900→200, 50 ms, peak .2 (crack) |
| `block` | blockers land; gear breaks (×0.7 f) | a metallic double tick | 120 | square 620 Hz 120 ms peak .18 + square 930 Hz 100 ms peak .1 + highpass noise 30 ms peak .4 |
| `prevent` | damage prevented | a soft shimmering fifth | 500 | sine 1318 (att 20 ms, 400 ms), +50 ms sine 1976, +100 ms sine 2637; peaks .16/.12/.08 |
| `goagain` | go again | a quick upward chirp | 200 | triangle 440→880, 180 ms, peak .22 + (+60 ms) triangle 660→1320, 200 ms, peak .16 |
| `turn` | the medallion flips | two warm notes (G4 → D5) | 500 | sine 392 Hz 300 ms; +120 ms sine 587 Hz 400 ms (peaks .3) + triangle 196 Hz 500 ms peak .2 |
| `draw` | a card is dealt | a swish | 120 | noise → bandpass 2400→5200 Hz Q1.2, 120 ms, peak .18 |
| `ko` | the KO/result | a low boom, then dawn: a bright rising triad | 2300 | sine 60→30 Hz 1200 ms peak 1.0 + noise lowpass 2000→100 500 ms peak .5; at +700 ms triangle C5 523 / E5 659 / G5 784 / C6 1047 Hz (staggered 50 ms, 1600 ms each, peak .16, attack 50 ms) |
`coin` (game start) is a bright 1.2 kHz → 800 Hz triangle ring-down, 300 ms, peak .2, plus the `slap` on landing; the
game-start sequence also reuses `slap` for the heroes landing.
(That is 14 named cues plus the coin's reuse of `slap` — if a cue has no trigger in §3 it is cut.)

**Layering rules**: a hit plays exactly one `hit*` (chosen by damage); the `thud` of an announcement never co-fires with its
`slap` (the slap is at +440 ms); `draw` ducks −6 dB per card after the first; a reaction's `slap` is −3 dB.

### 6.3 iOS audio-unlock and policy
- iOS Safari starts an `AudioContext` **suspended** until a *user gesture* resumes it. Create the context lazily and call
  `ctx.resume()` inside the first `pointerdown`/`touchend` (a real `click` handler is the safest on iOS; `touchstart` does
  **not** count for unlocking on current iOS — use `pointerup`/`click`). The lab does both on every press while sound is on.
- Playing a 1-sample silent buffer in the same gesture is the belt-and-braces unlock; do it once.
- Re-`resume()` on `visibilitychange` → visible (a phone call or tab switch can suspend again; `state` may read
  `"interrupted"` on iOS).
- **The ringer switch (silent mode) mutes WebAudio** on iOS Safari. A game that is silent in silent mode is correct:
  *do not* work around it (an `<audio>` element hack changes the category, but the user's silent switch is theirs).
- No sound until the user has pressed *something* (the title screen's Play button is the natural unlock). Sound is a
  **setting, default ON at volume 0.5** for a game session (the CEO may flip to "off until asked"; TABLE-TALK §4.3 chose
  off-by-default for *speech*, which is a different thing from effects) — remembered per device in `localStorage`
  (try/catch it).
- Master volume 0.5 (`master.gain`), user-adjustable 0–1 in Settings; the cues' peaks are mixed so that the **loudest
  (`hit7`, `ko`) is ≈ −8 dBFS at master 0.5** after the compressor; headphones are not assumed.
- **Haptics: `navigator.vibrate` is not available on iOS Safari** (it is on Android Chrome). Do not build features that
  depend on it. Where it exists (Android/desktop), the same hit/pop tiers may vibrate `[10]` / `[20]` / `[40]` ms as a pure
  bonus; on iOS, **sound + hit-stop + shake carry the feel** by design. (The only iOS haptic route is a native wrapper;
  out of scope — and note it as a "could not verify" in §7.)

---

## 7. Acceptance checklist and what the lab proves

### 7.1 Acceptance (what "done" means for the dev team)
- [ ] All §3 beats exist, with the listed durations within ±1 frame, at 393×660, 375×548 and 430×~750.
- [ ] Zero frames > 17.5 ms and zero long tasks > 50 ms in any beat at 4× CPU throttle (§1.6).
- [ ] Only `transform`/`opacity` animated (a CI grep for `transition:`/`@keyframes`/`.animate(` properties other than those
      two fails the build). No layout reads in a beat (§1.4).
- [ ] `prefers-reduced-motion` path cuts everything and keeps the announcement (§1.5).
- [ ] Queue never shows two announcements (a drill drives 5 AI actions in one tick and asserts one slab on screen at a time).
- [ ] Both seats' beats measured with identical timings (the drill diffs the two).
- [ ] A tap during a beat is never lost (the drill taps a hand card mid-glimpse; the card plays).
- [ ] Sound: nothing plays before a gesture; `resume()` is called inside the gesture; ≤ 6 voices.

### 7.2 Measured in the lab (Chromium, 393×852, DSF 3, this build)
Every choreography (`play`, `pitch`, `opp`, `hit1/3/7`, `prevent`, `goagain`, `turn`, `ko`) at 1× and 4× CPU throttle,
rAF intervals: max 16.8 ms (one vsync), 0 frames over 17.5 ms, in all but the medallion flip, which on a cold page
sometimes dropped a single frame (33–67 ms) when its 3D-transformed layer was first promoted; the lab now pre-promotes it
(`will-change: transform` on that one persistent element) and the build must too (§1.3). Over three further 4× passes (30 choreography runs) one run (`ko`) still showed a single 33 ms frame; the KO is the heaviest beat (full-screen dim + shake + fall + sweep), so the build must profile it first on a real iPhone.

### 7.3 What the lab cannot prove
- WebKit/iOS compositor behaviour (Chromium's CPU throttle does not slow the compositor, so "no frame over 16.7 ms" at 4×
  is partly a statement about main-thread independence). A real-iPhone run is the gate (§1.6).
- WebAudio recipes were verified to *run* (no exceptions, nodes connect) and are tuned by ear on a desktop, not a phone speaker;
  phone speakers have no bass below ≈ 200 Hz, so the low thuds read as a click/crack there — the mid-range partials in
  `hit3/hit7` (the noise band and the square crack) are there for that reason. Tune on the device.
- Haptics on iOS: unavailable from web content; unverifiable here.
