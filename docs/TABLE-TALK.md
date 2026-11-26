# TABLE TALK — the design mission

**What this is.** The user's "extra effort" design mission (CEO thread, 2026-11-26): reimagine the whole
interface — simpler, more spacious, more fun — around the real experience of sitting across a table from
someone. It is a separate track from the release busy work in `QUEUE.md` (on `findings/queue`). **A session
works this file only when the user asks for the design mission.** Its handoff is the section right below;
the vision follows it.

---

## HANDOFF — start here

*(Rewritten by each design session. Keep it under ~60 lines; history goes in the session log at the bottom.)*

**To continue the mission:** the user starts a session and asks for the design mission (or "Table Talk"). That session
reads this file top to bottom, checks §13 for the user's answers, and works the next unchecked phase of §11 — shipping
behind the switch, release by release, with the usual CLAUDE.md gates.

**State (2026-11-26, end of the first design session, v7.18):** TT0 is built and live behind a switch. The new table
plays every game the classic board plays (it is a layout over TableBoard's own controls, not a second board), against
the AI, a friend or the server. **Try it:** the live site's title screen → "Try the new table" (kept on the phone), or
`https://dawnblade-ai.github.io/dawnblade-ai/?talk=1`. Screens: `docs/ux/talk-*.jpg` (393x660 is the iPhone's
real Safari height; design there first); `talk-live-glimpse-pitch.jpg` is the LIVE site (real fonts and art). Note: the
switch sits under the four mode cards on the title, below the fold at 660 — the `?talk=1` link is the quick way in.

**What exists:** §12 is the code map; `docs/design/flow.html` mocks up the flow around the table (title → sit down →
the pad as the result, §8). `engine/announce.js` says what an action said and writes the pad;
`engine/local.js` paces the AI seat (`pace`) and hears every action (`onStep`); `TalkTable` and its parts sit just
below `TableBoard` in index.html; `tools/talk.js` is the drill (page.js runs it at three sizes).

**How to run the shop for this mission** (deps as tools/page.js's header; `PAGE_DEPS=<scratch>/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`, plus `@fontsource/caveat` for the pad's face):
- `node tools/talk.js` — the new table's drill, three phones (~3 min); `SAB=pad|private|glimpse` must FAIL a row.
- `node --test test/announce.test.js test/local.test.js` — the announcer and the pace (~1 min).
- To LOOK at it with real card art: route the art hosts through curl (the first session's
  `scratchpad/artroute.js` pattern: `context.route` the S3 host, fetch with curl, cache, fulfil) and `page.reload()`
  after installing the route (the hero art is otherwise cached as stand-ins). Shots at 393x660 first.
- A release is the usual CLAUDE.md gate set; with the switch OFF the classic board must not move (page.js,
  serverpage.js, tapsweep), and with it ON `tools/talk.js` must be clean.

**Next, in order:** §11 TT1 (your line and the ask), then TT2 (every table; Tournament manners on ranked — see Q7),
then TT3 (the flow: title → sit down → table → the pad as the result). Ask the user §13's questions first if they have
not answered them; the first session's message to the user asked them.

**Known rough edges (TT0):** the pitch made apart from a play shows as its own call; the end screen is still the
classic EndPanel (TT3 makes the pad the result); the opponent's permanents are mini cards (their text unreadable until
tapped); voice is untested on a real iPhone; the hub's other labels are still the classic ones ("Pass — let X
block"); an ally attack-target rail (`targetEl`) is drawn as the classic rail.

## 0. The brief, in the user's words

> "We need to reimagine the entire interface. Simplified, streamlined more fun. … Explore spacing things
> out better and removing 'fluff' — explore the CR — note taking is not allowed — imagine the actual
> experience of playing a game in real life — for ranked mode we want to mimic this as close as possible —
> no log of game actions just a simple scratch sheet of life total changes. A quick opportunity to see each
> card played and pitched. Bold announcements of game actions as if the opp is dictating their plays.
> Stray from the path here and be creative. Do a deep dive into possibilities and try to make strides
> toward the eventual finished product. You're a visionary — now is your time to make art."
> — user, 2026-11-26

Standing directions this keeps: gameplay first, keep it simple (2026-11-25); the hand is a flat row that
scrolls the phone's own way, never a wheel (2026-11-26); Melee as the bar for feel (`POLISH.md`).

---

## 1. What a real table is (the research)

### 1.1 The rules of what a player may know

The answer is not in the Comprehensive Rules but in the **Tournament Rules and Policy** (TRP) and the
**Penalty and Procedure Guide** (PPG), on the same site (`https://rules.fabtcg.com/en/`; its search index is
`/en/search/search_index.json`, which is how these were read). Verbatim:

**TRP 5.8 Note-Taking.** "Note-taking is a broad term that refers to the use of aids to record information
relating to the game. In general, Players may not take notes during games. … Players may record hero life
totals and changes to hero life totals in order to maintain the correct game state. Additionally, markers
may be used to temporarily represent visible or public information (except information concerning a
Player's deck), but they must be updated or removed when they no longer represent that information." Its
acceptable examples include: "Recording meta-game information such as the opponent's name and hero, who
went first, and the winner of the game. Using a marker to represent the current turn-player, phase of the
turn, or step of combat. Recording the life total, changes to the life total, and the source of the change
(i.e. the source of the damage or effect). Using markers or dice, to represent remaining resource and action
points. Turning permanents sideways or placing markers on them, to represent the use of activated abilities
or triggered effects for the turn. Using dice to represent the power of an attack."

**PPG 3.2 Note Taking and Outside Assistance.** "Illegal notes are any record of the game that is not
specifically allowed by the TRP. In particular, recording historical or private information. Pitched cards,
cards in hand, and an opponent's face down cards are all examples of historical or private information."
Its first example of the infraction: "A player records all the cards that are pitched throughout a game in
a notepad."

**TRP 5.1 Game Information** sorts everything into six kinds — the design's spine:

| kind | what it is (TRP 5.1) | may a player know it? |
|---|---|---|
| **Visible** | "information about that game state that is physically represented": state of cards, zone/location of cards, printed properties of public cards, counters, life totals | **yes** |
| **Public** | "not physically represented": modified properties, "details of current public decisions, effects, or events that define the current game state", unspent action and resource points, turn player / phase / step of combat, the match score | **yes** |
| **Unverified** | e.g. a card's cloaked ability that allowed a face-down equip | **yes** |
| **Assisted** | "Printed properties of any card or token in Flesh and Blood. Game rules. Tournament rules and policy." | **yes, on request** (a judge must provide it) |
| **Historical** | "previously public … but does not affect the current game state": cards revealed and now private, past public events that no longer matter | **no** |
| **Private** | "not, or can not be, known by all Players" | **no** |

"Players have the privilege to know Visible, Public, Unverified, and Assisted information, but not
Historical or Private information." — TRP 5.1. **That sentence is the ranked screen's specification.**

### 1.2 The zones (CR 3)

Public: banished (3.4.1), combat chain (3.6.1), graveyard (3.8.1), hero (3.11.1), permanent (3.13.1),
pitch (3.14.1), stack (3.15.1), weapon (3.16.1). Private: arsenal (3.3.1), deck (3.7.1), hand (3.9.1).
The pitch zone empties at end of turn: "Each player puts all cards in their pitch zone (if any) on the
bottom of their deck in any order. … The order cards are put on the bottom of the deck this way is hidden
information." (CR 4.4.3c). So what an opponent pitched is **visible for the rest of that turn** and then
**gone** — historical. No screen may keep it.

Every play starts with an announcement: "5.1.2 Announce: First, the player proposes the card to be played.
The card moves to the stack zone under that player's control" (CR 5.1.1–5.1.2). Talking is the rule, not a
flourish.

### 1.3 The experience, minute by minute

You sit down and shake hands. Heroes face each other. A coin. Shuffle, present, draw. "Your go."

Your opponent slides a card into their pitch zone — "pitching a blue" — and pushes another into the middle:
"Snatch, attacking for four." You look at your hand, you look at their gear. "Block with one." You put a card
in front of their attack. "Any reactions?" "No." "Take one." You both write on your pads: 20, 19. Their attack
and your block go to the graveyards. "Arsenal one, pass." A card goes face down. They draw. "Your go."

What it feels like: hidden hands, cards slapping down, short phrases in a rhythm, a pencil scratching a
number, and a face across the table. Nobody keeps a transcript. You remember, or you don't.

**That is the product.** Everything below serves it.

---

## 2. The five principles

1. **The table, not the app.** Everything on screen is something a real table holds: cards, piles, a pad,
   markers for action points and resources, a turn token. No tabs, no panes, no label that repeats what a
   picture already shows. Anything not on a real table needs a reason to exist.
2. **Every play is spoken.** The opponent's plays arrive as announcements — big, bold, in their voice, one at
   a time, at the pace of a person (CR 5.1.2: a play *is* an announcement). Your own button says your line.
3. **The privilege line.** Ranked shows exactly what TRP 5.1 lets a player know: Visible, Public, Unverified,
   and Assisted on request. Never Historical, never Private. **No log.** The pad holds what TRP 5.8 allows and
   nothing else.
4. **Glimpse, then table.** Every card played or pitched is shown large, once — the glimpse — then lands where
   it lives. Anything public can be picked up and read again *where it lies*. Nothing is kept anywhere else.
5. **Space is the luxury.** Empty zones are bare mat. A pile shows only when it holds cards; a count only on a
   pile. One primary button. Fewer, bigger things.

---

## 3. The table — anatomy (393 × 660, an iPhone's real Safari view)

The drives ran at 393×852 and 320×568 for months; the phone it is played on shows **~660 px** of height in
Safari. Design at 660 first. (Measured 2026-11-26: the v7.15–v7.16 board at 660 had a 170-px stage and hid
the preview card outright — "the card previews broke".)

```
┌───────────────────────────────────────┐ 0
│ ≡  (Fai) FAI · ◆1          ▮▮▮▮  ▯ars │  THEIR SIDE: menu · hero · their markers · hand backs · arsenal
│ ⛨1 ⛨1 ⛨1 ⛨0  ⚔  ✦Fealty     ▣42 ▤6 ▥2│  their gear (defence on each) · weapon · permanents · deck/grave/pitch piles
├───────────────────────────────────────┤ ~96
│                                  ┌───┐│
│        THE MIDDLE                │FAI││  the combat chain: the attack (its power stamped),
│   ┌──────┐  ┌───┐┌───┐           │ 15││  the blockers beside it (defence on each), earlier links
│   │ATTACK│  │blk││blk│           │~17││  stacked small to the left. The STAGE for announcements
│   │  7   │  └───┘└───┘           │───││  and the glimpse.
│   └──────┘   wall 3 → take 4      │YOU││  THE PAD (right edge): their total on top, yours below,
│                                  │ 12││  old totals struck through, the last change and its source.
│                    ( turn 4 )    └───┘│  The turn token lies on the mat on the turn player's side.
├───────────────────────────────────────┤ ~376
│ ⛨1 ⛨1 ⛨0 ⛨0  ⚔  ✦Runechant×3  ▣38 ▤4  │  YOUR SIDE: gear · weapon · permanents · piles
│ (you) ● AP  ◉◉ 2 res                  │  your markers: the action point gem, resource coins
├───────────────────────────────────────┤ ~444
│ ▭  ▭  ▭  ▭  ▭ ▸   (hand, flat row)    │  YOUR HAND: the v7.16 HandRow, unchanged in behaviour
├───────────────────────────────────────┤ ~590
│ ⋯         [  END TURN  ]          ⋯  │  YOUR LINE: the hub; the primary button says what you'd say
└───────────────────────────────────────┘ 660
```

- **Their side** is what you see across the table: their hero, how many cards they hold (backs, not a number
  in caps), a face-down arsenal card if there is one, their gear with each piece's defence, their weapon,
  their permanents, and their piles. Their markers (action points, floating resources) show only when
  non-zero.
- **The middle** is the combat chain laid out as on a mat, and the stage where announcements and glimpses
  happen. When the chain is closed it is bare mat with the turn token on it.
- **The pad** is the only record. It replaces the life bars (§5).
- **Your side** mirrors theirs, plus your markers — the action-point gem and the resource coins (TRP 5.8:
  "Using markers or dice, to represent remaining resource and action points").
- **Your hand** is the flat, native-scrolling `HandRow` (the user's standing ruling). Cards show their printed
  faces with numbers at the printed corners; the type label across the art goes.
- **Your line** is the hub (`HubBar`, v7.14): the primary button in the thumb lane.
- Piles are tapped to look through them (graveyard, banished, this turn's pitch, the chain's earlier links) —
  the way you'd ask to see a graveyard. Gear and permanents are tapped to read.

---

## 4. Table talk — the announcer

### 4.1 What is said, and how it looks

Each action the opponent takes is read off the engine (the action plus the state before and after it — see
§12, `engine/announce.js`) and **said**: a slab of bold condensed type that slams onto the middle from their
side, with the card itself large beneath it (the glimpse, §6). It holds 1.5 s, or until a tap; press and
hold to keep it while you read. Then the card lands where it lives and the next play comes.

| what happened (engine) | headline | the glimpse shows |
|---|---|---|
| an attack card played | **SNATCH** · *attacking for 4* (· *go again*) | the card, large; what they pitched, small, tagged PITCH |
| a weapon or ally attack | **DAWNBLADE** · *swinging for 6* | the weapon |
| a non-attack action / instant / reaction | **WARRIOR'S VALOR** (· *instant* / *defense reaction* / *attack reaction*) | the card; the pitch |
| an activated ability | **BLOSSOM OF SPRING** · *activates* | the source card |
| the hero's ability | **FAI** · *hero ability* | the hero |
| blockers declared | **BLOCKING** · *with 2* | the blocking cards, side by side |
| no blockers | **NO BLOCK** | — |
| damage | **TAKE 4** (stamped on the attack) | — (the pad writes it) |
| prevention | **PREVENTED** | — |
| life gained | **+1 LIFE** | — |
| a card set in the arsenal | **ARSENAL** · *a card, face down* | a card back (it is private) |
| their turn begins / ends | **FAI'S TURN** / **YOUR TURN** (small) | — |
| the game ends | **GAME** · *Fai wins* | — (the pad becomes the result, §8) |

**Passes are not announced.** They are most of the CR's steps (self-play: ~2 of every 3 actions); voicing
them would be noise. A real player knows the opponent passed because the game moved on — so does this one.

**Never said:** anything private (a card set face down is "a card"; a card in their hand is a back), anything
the state does not hold, any card text (names and engine numbers only — the golden rule).

### 4.2 Your line

Your plays get a smaller, quicker echo from the bottom (you know what you did — it confirms the tap). The hub's
primary button is phrased as what you would say across the table: *End turn*, *Pass*, *Block*, *Pitch & play*.
(TT0 already says "Block with 2" / "No block" in the defend step; TT1 rewords the rest.)

### 4.3 The voice (optional)

`speechSynthesis` reads the opponent's headline aloud — literally dictating their plays. Off by default (a menu
toggle), because sound that starts on its own surprises people; iOS needs the first utterance inside a tap,
which the toggle provides.

### 4.4 Pace

A person takes a moment per play. The AI seat is **paced**: `engine/local.js`'s `pace` option applies its
actions one per tick and pushes the board after each, so each play is seen and said before the next. Passes
tick fast (110 ms); an action waits for every call it made, in turn (a play's glimpse 1.5 s; `talkHold`). Any tap on
a call moves on at once and brings the next action forward (`nudge`). At a
two-phone or server table the pace is the person's own.

---

## 5. The pad — the scratch sheet

TRP 5.8 allows exactly: life totals, changes to them, and the source of each change (plus meta-game facts:
the opponent's name and hero, who went first, the winner). The pad holds those and **nothing else**.

- **Look:** a sheet of ruled pad paper (cream, blue rules, a red margin) on the dark mat — the one light object
  on the table, so it reads at a glance. Numbers in a hand-written face. Each change is written below the last;
  the superseded total is struck through in red pencil.
- **Collapsed** (always on screen, right edge of the middle): their current total on top, yours below (where
  each of you sits), each with the total before it struck through and the last change's amount and source
  in small writing.
- **Open** (a tap): the whole sheet — two columns, every change since the start, with its source. Close with a
  tap. This is the only history a ranked player has, as at a real table.
- **The life bars go** in Table Talk: the pad is where life lives. (§13 Q1 asks the user to confirm.)
- **At game end** the pad is the result screen: final totals, the winner circled, "GG" (§8).

## 6. The glimpse

"A quick opportunity to see each card played and pitched." When the opponent plays or pitches, the card is
shown large — as large as the phone allows above your hand (≈ 60% of the width) — with the cards they pitched
beside it, smaller, each tagged with its pitch colour. Then it shrinks to where it lives: the chain, the
graveyard, the pitch pile.

After that, it is still on the table and **public**, so it can be read again where it lies — tap the chain's
card, the graveyard, the pitch pile (until the end phase empties it). What cannot happen is reading it again
*after it has left the public zones*: no log, no replay, no list. That is the privilege line.

---

## 7. Manners — one table, four sets of rules for what it shows

| manners | where | log | coach's call | pad | announcements |
|---|---|---|---|---|---|
| **Tournament** | ranked server tables | **none** (TRP 5.1) | **never** (TRP 5.9: outside assistance) | yes | yes |
| **Friendly** | friendly server / two-phone tables | in the menu | never (a person is deciding) | yes | yes |
| **Practice** | the AI table | in the menu | in the menu | yes | yes |
| **Trainer** | the Dummy (`Battle`) | as today | as today | — | — (until the trainer adopts the table) |

The menu (≡, top-left, the only chrome) holds: leave, sound, voice, the log (where allowed), the coach (where
allowed), JUDGE!!, how to play, and the classic table.

---

## 8. The whole flow, reimagined

Today: title (4 mode cards, 4 buttons, a paragraph) → hero grid (+ banner, Battle, a second "Find an opponent",
How to play, the format paragraph, a VS strip, the hero sheet) → opponent step → coin → seat → loadout (three
panes) → board: **six screens and ~9 taps** before a card is played.

Table Talk's flow: **three screens, three taps.** Mocked up, with real hero art, in `docs/design/flow.html` (served
beside the game: `https://dawnblade-ai.github.io/dawnblade-ai/docs/design/flow.html`); TT3 builds from it.

1. **Title.** The wordmark, your last hero standing large, one primary **Play** (the AI, your last hero, fate's
   opponent), and three quiet doors: Ranked, Friends, Train. Record / How to play / Judge's quiz in a row.
2. **Sit down.** Both heroes face each other full-bleed, art on art. Tap either to change it (a carousel of hero
   art — the art is the best thing in the app; let it be big). The coin flips on screen. Your gear is last
   time's; "Change gear" opens the loadout. One button: **Shuffle up**.
3. **The table.**
4. **The result** is the pad: both columns as they were written, the winner circled, the turn count, GG.
   Rematch / New opponent / Leave.

---

## 9. What goes (the fluff list) and what replaces it

| today | Table Talk |
|---|---|
| the jump row: ✕ Leave · ▲ Opp · Chain · You ▼ · ♪ | ≡ menu (leave, sound, voice); tap their side or yours to look closer |
| the two life bars + numerals + hand pips + "YOU 1 AP 0 res" | the pad (life); hand backs (their hand); markers (AP, resources) |
| strips of counts in caps: "HAND 4 ARS 0 DECK 42 PITCH 0 GRAVE 1" | the piles themselves, only when they hold cards |
| "CHAIN" / "DEFEND" / "STACK" column labels | the chain laid out: attack, blockers beside it |
| "Most recently played lands here" | bare mat |
| "Your window — play, or pass" and the status line at rest | nothing at rest; a slim "ask" line only when something is asked (paying, arsenal, defending) |
| "ACTION POINT", "floating 2", "chain link 1" chips | the AP gem, resource coins, the links as cards |
| a type label ("ATTACK", "NON-ATTACK") across every hand card's art | the printed face; numbers at the printed corners |
| the "HAND" label beside the hand | — (it is your hand) |
| the log pane, the ticker, the LIVE line | nothing (ranked); a tap away (practice) |
| seat / host / guest / inspect pills | JUDGE!! report |
| "swipe → graveyard", "nothing yet — tokens … land here" | tap the pile; empty is empty |

## 10. Motion and sound

Cards fly from hand to middle and land with a small bounce and a slap; their announcement slams in with a low
thud; pitched cards slide into the pitch pile with a clink; the pad writes — the old number struck in red, the
new one appearing as if written — with a pencil scratch. A hit shakes the attack and stamps it. The existing
`Sfx` hit / block / prevent sounds stay (POLISH condition 4: three sounds that mean three things).
`prefers-reduced-motion` turns every flight and slam into a cut.

---

## 11. Build order

Each phase ships behind the Table Talk switch until TT5 makes it the default. Gates per phase: `npm test`
(fail 0, skipped 5), babel, `tools/page.js` + `tools/serverpage.js` clean with the switch OFF (the classic
board unchanged), and the Table Talk drives (§12) at 393×660, 393×852 and 320×568 with it ON.

- [x] **TT0 — the seam and a first table** (2026-11-26, v7.17–v7.18): the preview fix; this document;
  `local.js` pace + `onStep`; `engine/announce.js`; TableBoard's pieces hoisted; the Talk layout v0 (their
  side, middle + chain + glimpse + announcements, the pad, your side + markers, the hand, the hub, the menu,
  no log); the switch on the title and `?talk=1`; "Block with 2" / "No block" on the hub. See the session log.
- [ ] **TT1 — your line and the ask:** the rest of the hub's labels as speech ("Take 4" only from the engine's own
  projection; "No response" where a pass answers a card on the stack); the ask line's words (shorter, in the coach's
  voice); the combat-step marker (TRP 5.8 allows one); the turn token's travel; your own play flying from the hand
  to the middle (FLIP; `Glide` exists); the pad's write animation tuned on a phone.
- [ ] **TT2 — every table:** announcements at two-phone and server tables (net.js `onState` carries the action
  per commit; the announcer is already a pure function of action + states); **Tournament manners enforced on
  ranked tables in BOTH layouts** (the classic board hides its log in ranked too — the user's brief applies to
  ranked, not to a layout).
- [ ] **TT3 — the flow:** title → sit down → table → the pad as result (§8). The loadout behind "Change gear".
- [ ] **TT4 — motion, sound, voice** (§10); perf at 4× CPU throttle (`tools/perf-page.js`), no frame over 16 ms.
- [ ] **TT5 — default:** Table Talk is the table; the classic layout stays one menu item away for a season; the
  trainer adopts the table (the Dummy as an opponent like any other).

## 12. Code map (keep current)

- `docs/TABLE-TALK.md` — this file (vision + handoff + session log). `docs/design/flow.html` — the §8 flow, mocked
  up (static, no script; hero art cropped from the card images by CSS, the card's art band ~12%..58% of its height).
- `engine/local.js` — `pace` (ms or `(prev, action, next) => ms`) and `onStep({seat, action, prev, next})`:
  the AI seat acts one action per tick and the board is pushed after each. Off unless passed.
- `engine/announce.js` (`DawnAnnounce`) — pure: `lines(prev, action, seat, next, viewer)` → what to say and
  show; `lifeMarks(prev, next, action)` → pad entries. Reads names and engine numbers only; never card text;
  never names a card that is not public in `next` from the viewer's seat. Drills: `test/announce.test.js`.
- `index.html` (script1b, just above `TableBoard`) — `talkOn` (the switch: `?talk=1|0`, else `store` key `talk`),
  `talkShows` / `talkMerge` / `talkHold` / `talkPace` (what the table shows of a line, how long, and the AI's pace),
  `talkSay` (the optional voice), and the components `TalkTable` (the layout), `TalkSide`, `TalkBacks`, `TalkMarks`,
  `TalkGear`, `TalkPiles`, `TalkChain`, `TalkPad`, `TalkPadSheet`, `TalkLook` (a side's gear or piles, looked
  through), `TalkCall` (what is said + the glimpse), `TalkMenu`. `TableBoard` builds `askEl`, `pipsEl`, `targetEl`,
  `handRowEl`, `adviceEl`, `myBoardCell`, `hubEl`, `overlaysEl` once; `if(talk) return <TalkTable …/>` sits right
  above the classic return. Its state: `talk`, `calls` (the queue), `pad` ({start, marks}), `hearRef` (fed by
  local.js `onStep` and by net.js `onState(st, info)`). `TalkSwitch` (script1c) is the title's switch. CSS: the block
  headed "TABLE TALK" at the end of the one `<style>`; the pad's face is Google's Caveat (font link; page.js maps it
  to @fontsource/caveat offline).
- Drives: `tools/talk.js` (`talkJudge`, `talkTo`; `SAB=pad|private|glimpse` proves it bites), run by page.js at the
  three sizes. Screenshots of the first build: `docs/ux/talk-*.jpg`.

## 13. Open questions for the user (defaults standing until answered)

1. **The pad replaces the life bars** in Table Talk (the fighting-game bars were the user's October ask). Keep
   them anywhere? *Default: the pad only.*
2. **The pad writes the source** of each change (TRP 5.8 allows it): "−4 Snatch". *Default: yes, small.*
3. **Voice** reads the opponent's plays aloud. *Default: off, a menu toggle.*
4. **Practice (vs the AI)** hides the log by default for the real-table feel, with the log and the coach a tap
   away in the menu. *Default: yes.*
5. **The clock** (STAGE.md's 15 minutes a seat) for ranked — part of "mimic real life"? *Default: not yet.*
6. **The glimpse's hold** — 1.5 s for a play, tap to skip (it brings the next play forward), hold to keep. *Default as
   stated; tune on the phone.*
7. **Ranked and the switch.** The brief says ranked should mimic a real table, no log. Today a ranked game shows the
   new table (no log, no coach) only on a phone whose switch is on. Make ranked tables ALWAYS use the new table (or
   at least drop the classic board's log in ranked)? *Default: not while it is a preview; ask after the user has
   played it.*

---

## Session log

### 2026-11-26 — CEO thread, the mission starts (session_013xG9xC2gp6ZU3xUkekmsVm)

Researched TRP 5.1 / 5.8 / PPG 3.2 / CR 3, 4.4.3c, 5.1 (quoted in §1); toured the v7.16 page at 393×660 with
real card art (`docs/ux/before-peek-393x660.jpg`: a tapped card showed its name alone). Found and fixed the broken
preview (**v7.17**: the peek card was hidden under 700 px tall, which is every iPhone in Safari; `peekJudge` now runs
at 393x660). Wrote this vision. Built **TT0 (v7.18)**:
- the engine seams first, each drilled on whole self-play games with sabotages: `engine/announce.js` (privacy from
  both seats, the engine's numbers, an exact pad) and `local.js` `pace` / `onStep` / `nudge` / `dispose` (paced play
  reaches exactly the unpaced states);
- `TableBoard`'s pieces hoisted (the classic board renders the identical DOM: page.js and serverpage.js unchanged
  with the switch off), then `TalkTable` laid over them, a switch on the title, `?talk=1`;
- `tools/talk.js`, run by page.js at 393x660 / 393x852 / 320x568. Its first run found two real defects (a 37-px
  piles button; a glimpse sized by its image, 43 px with the offline stand-in), both fixed before release.
- Played whole games on it at all three sizes with real art: no page errors, the end screen over it as before.
- Shipped v7.18 through every gate (page.js 372/372 with the 18 talk rows, serverpage 490/0 with the switch off,
  trainchaos CLEAN 18, function v188, livecheck ALL PASS), then drove the new table ON THE LIVE SITE through the proxy:
  real fonts (Caveat included), real art, six glimpses with their pitch, no errors.
Lessons: (1) design and drive at 393x660 — every earlier drive missed the iPhone's real height; (2) never size an
image box by its image (offline stand-ins are 50 px); (3) a slice drill bounded by two function anchors breaks when
code is inserted between them: put new components AFTER the function they serve, not before it.
