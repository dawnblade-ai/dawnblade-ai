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

**The user's direction (2026-11-26, second design session), still standing:** "We are currently focused on polishing the
design. Things need to be as simple as possible — focus on the cards and the experience of playing in real life — but
still with the health bar callout to a fighting game." And at the third (2026-11-26): "This is the most artistic phase —
we need to bring the experience of playing a game in the flesh and blood to the screen and the little details are
everything!" Every next step answers to both: fewer things, bigger cards, real-table details, the bout as the one piece
of fighting-game chrome.

**State (end of the third design session, v7.20):** TT0 + TT1a + most of TT1 are built, behind the switch, plus TT3's
first piece. The table: the bout across the top; each side's **gear as small real cards** with a die for the defence it
blocks for now (a blocker lifts, a broken piece greys, a swung weapon turns sideways); the zones as faint printed
outlines; the **turn token is the turn player's medallion**, sliding to their half (the number is the bout's alone);
**your play flies** from the hand to the stack/chain (and a paid-for play now does, on both boards); each hit pops on
its own; the pay and arsenal asks are short. **The result is the pad**: "DASH WINS" is said, then the end panel holds the
scratch sheet with the winner ringed in red pencil and GG. **Try it:** `https://dawnblade-ai.github.io/dawnblade-ai/?talk=1`.
Screens: `docs/ux/talk-gear-*.jpg`, `talk-gear-blocked-*`, `talk-chain-mine-*`, `talk-result-*` (v7.20, real art);
`talk-bout-*` v7.19; the rest TT0.

**What exists:** §12 is the code map; `docs/design/flow.html` mocks up the flow around the table (title → sit down →
the pad as the result, §8). `engine/announce.js` says what an action said and writes the pad;
`engine/local.js` paces the AI seat (`pace`) and hears every action (`onStep`); `TalkTable` and its parts sit just
below `TableBoard` in index.html; `tools/talk.js` is the drill (page.js runs it at three sizes).

**How to run the shop for this mission** (deps as tools/page.js's header, incl. `@fontsource/caveat`; `PAGE_DEPS=<scratch>/pagedeps
NODE_PATH=/opt/node22/lib/node_modules`; `open({query:"?talk=1"})` — the leading `?` matters):
- `node tools/talk.js` — the new table's drill, three phones (~4 min); `SAB=pad|private|glimpse|result` must FAIL a row.
- `node --test test/announce.test.js test/local.test.js test/glide.test.js` — the announcer, the pace, the flight.
- To LOOK at it with real card art: `page.route(/amazonaws\.com/, …)` fetching each URL with `curl` into a scratch
  cache and fulfilling it, then `page.reload()` and wait for `.hgrid .hcard`; then `talkTo(page)`. A loop that clicks the
  hub's buttons by label (/no response|any blocks|no block|end turn|leave it empty|pass/) while no `[data-talk-call]` is
  up walks a whole turn cycle; to PLAY, tap a `.phand .hc:not(.dis)` twice, then tap unselected hand cards until
  "Pitch & play" enables. To see the end, `window.__dawnTable.session.submit({t:"concede"})` and wait for
  `[data-talk-result]` plus ~2 s (the ring and GG draw in late). To check a flight, wrap `Element.prototype.animate`
  and record `this.className`. Shots at 393x660 first. (The third session's tour script was `tour.js` in its scratchpad:
  rebuild it from these lines in ~40.)
- A release is the usual CLAUDE.md gate set; with the switch OFF the classic board must not move (page.js,
  serverpage.js), and with it ON `tools/talk.js` must be clean.

**Next, in order (simplicity first):**
1. **Ask the user** how it feels on the phone (the gear cards, the medallion, the flight, the result pad), and §13
   Q2–Q7 (still open).
2. **TT1 rest:** the combat-step marker (TRP 5.8 allows one; keep it tiny or make the hub's words carry it); the
   remaining classic-voice asks (boost, fuse, charge, usurp, the additional costs) in a player's words, talk only.
3. **TT3, the flow:** title → sit down (both heroes art-on-art, the coin) → table → the pad (built). `docs/design/flow.html`.
4. TT2 (announcements at two-phone and server tables; ranked manners in both layouts), TT4 (sound and motion pass).

**Known rough edges:** a hand-to-stack flight needs the payment to finish within 2.5 s of the last pitch tap
(`Glide.keep` refreshes the mark each render while paying; a long idle pay can still land without the flight); the
weapon flies only if it was tapped from the hand row's gear tile; the pitch made apart from a play shows as its own call;
the hand row opens scrolled at 320 px (the first card cut, pre-existing); voice untested on a real iPhone; an ally
attack-target rail is drawn as the classic rail; the WinPanel (beating the Dummy at a table) is still classic.

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
│ ≡ (◐)YOU ▰▰▰▰▰▱ 18 ⬡2 20 ▱▰▰▰▰▰ DASH(◑)│  THE BOUT (v7.19): menu · you, bar, life · the turn · their life, bar, them
├───────────────────────────────────────┤ ~56
│ ▯1▯1▯1▯0▯4  ◆        ▮▮▮▮ ▯ars ▣42   │  THEIR SIDE: gear (cards, a die each) · markers · backs · arsenal · piles
│ ✦Fealty                               │  their permanents (only when there are any)
├───────────────────────────────────────┤ ~150
│                                       │
│        THE MIDDLE                     │  the combat chain: the attack (its power stamped),
│   ┌──────┐  ┌───┐┌───┐                │  the blockers beside it (defence on each), earlier links
│   │ATTACK│  │blk││blk│                │  stacked small to the left. The STAGE for announcements
│   │  7   │  └───┘└───┘                │  and the glimpse (it starts below the bout: the bars
│   └──────┘   wall 3                   │  stay in view, as in a fighting game).
│                   (◉ medallion)       │  The turn token (the turn player's hero) lies on their half.
├───────────────────────────────────────┤ ~376
│ ▯1▯1▯0▯0▯⚔  ✦Runechant×3  ▣38 ▤4      │  YOUR SIDE: gear (cards) · weapon · permanents · piles
│ (you) ● AP  ◉◉ 2 res                  │  your markers: the action point gem, resource coins
├───────────────────────────────────────┤ ~444
│ ▭  ▭  ▭  ▭  ▭ ▸   (hand, flat row)    │  YOUR HAND: the v7.16 HandRow, unchanged in behaviour
├───────────────────────────────────────┤ ~590
│ ⋯         [  END TURN  ]          ⋯  │  YOUR LINE: the hub; the primary button says what you'd say
└───────────────────────────────────────┘ 660
```

- **Their side** is what you see across the table: how many cards they hold (backs, not a number
  in caps), a face-down arsenal card if there is one, their gear as small cards with a die for each piece's defence
  (v7.20: a blocker lifts, a broken piece greys, a swung weapon lies sideways — TRP 5.8's "turning permanents
  sideways"), their weapon,
  their permanents, and their piles. Their markers (action points, floating resources) show only when
  non-zero.
- **The middle** is the combat chain laid out as on a mat, and the stage where announcements and glimpses
  happen. When the chain is closed it is bare mat with the turn token on it: the turn player's medallion, on their
  half, sliding across when the turn passes (v7.20). Your own play flies here from your hand.
- **The bout** is life at a glance, as a fighting game draws it; **the pad** (a tap on the bout) is the only record (§5).
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
- **The bout (v7.19) — the user's answer to Q1:** "as simple as possible — focus on the cards and the experience of
  playing in real life — but still with the health bar callout to a fighting game" (2026-11-26). So the fighting-game
  bars came back as ONE strip across the top of the table (`TalkBout`): you left, them right, bars draining to the
  middle, the numeral at the inner end, the turn as a round timer, each change popping off its bar. They READ the
  pad's marks; a tap on them opens the pad. The collapsed pad left the mat (the chain has the full width). The pad is
  now the history (a tap) and, at TT3, the result screen.
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
   Rematch / New opponent / Leave. **Built (v7.20)** inside the end panel (its buttons unchanged), after the game's last
   call is said.

---

## 9. What goes (the fluff list) and what replaces it

| today | Table Talk |
|---|---|
| the jump row: ✕ Leave · ▲ Opp · Chain · You ▼ · ♪ | ≡ menu (leave, sound, voice); tap their side or yours to look closer |
| the two life bars + numerals + hand pips + "YOU 1 AP 0 res" | the bout (both bars in one strip, v7.19); hand backs (their hand); markers (AP, resources) |
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
- [x] **TT1a — the bout** (v7.19): the fighting-game bars across the top (§5); the mat left to the cards; "Any
  blocks?" / "No response" on the hub; the stack's ask line gone; the defend ask shortened.
- [x] **TT1b — the little details** (v7.20): gear as cards with dice (blocker lifts, broken greys, swung weapon
  sideways); zones as printed outlines; the turn medallion (one turn number); your play flying in (and the per-card
  glide marks, both boards); each hit its own pop; the pay and arsenal asks in a player's words.
- [ ] **TT1 — your line and the ask (the rest):** the hub's remaining labels as speech ("Take 4" only from the engine's own
  projection); the other ask lines' words (shorter, in the coach's voice); the combat-step marker (TRP 5.8 allows one); the turn token's travel; your own play flying from the hand
  to the middle (FLIP; `Glide` exists); the pad's write animation tuned on a phone.
- [ ] **TT2 — every table:** announcements at two-phone and server tables (net.js `onState` carries the action
  per commit; the announcer is already a pure function of action + states); **Tournament manners enforced on
  ranked tables in BOTH layouts** (the classic board hides its log in ranked too — the user's brief applies to
  ranked, not to a layout).
- [ ] **TT3 — the flow:** title → sit down → table → the pad as result (§8; the result BUILT in v7.20, `TalkResult`).
  The loadout behind "Change gear".
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
  `talkSay` (the optional voice), and the components `TalkTable` (the layout), `TalkBout` (v7.19: the fighting-game
  strip, reusing the classic HUD's `LifeBar` and `LifeNum`; carries `data-talk-pad` and `data-talk-life`), `TalkSide`,
  `TalkBacks`, `TalkMarks`, `TalkGear` (v7.20: the pieces as cards, `.tk-gcard` + `.tk-gdie`), `TalkPiles`, `TalkChain`
  (the medallion `[data-talk-token]`; `useGlideIn` on the stack card and the attack), `TalkPadGrid` (the sheet's columns,
  shared), `TalkPadSheet`, `TalkResult` (v7.20: the pad on the end panel, `[data-talk-result]`, `data-col`, `.ring`,
  `.tk-gg`; `EndPanel`'s `pad` prop), `TalkLook` (a side's gear or piles, looked through), `TalkCall` (what is said + the
  glimpse), `TalkMenu`. The flight: `Glide` (one mark per card; `keep` while paying) and `useGlideIn(ref, uid, ms, land)`
  just above `FeatCard` (script0). `TableBoard` builds `askEl`, `pipsEl`, `targetEl`,
  `handRowEl`, `adviceEl`, `myBoardCell`, `hubEl`, `overlaysEl` once; `if(talk) return <TalkTable …/>` sits right
  above the classic return. Its state: `talk`, `calls` (the queue), `pad` ({start, marks}), `hearRef` (fed by
  local.js `onStep` and by net.js `onState(st, info)`). `TalkSwitch` (script1c) is the title's switch. CSS: the block
  headed "TABLE TALK" at the end of the one `<style>`; the pad's face is Google's Caveat (font link; page.js maps it
  to @fontsource/caveat offline).
- Drives: `tools/talk.js` (`talkJudge`, `talkTo`; `SAB=pad|private|glimpse` proves it bites), run by page.js at the
  three sizes. Screenshots of the first build: `docs/ux/talk-*.jpg`.

## 13. Open questions for the user (defaults standing until answered)

1. ~~The pad replaces the life bars?~~ **ANSWERED (user, 2026-11-26): keep "the health bar callout to a fighting
   game", as simple as possible.** Built as the bout (v7.19, §5).
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

### 2026-11-26 — CEO thread, the bout (session_013xG9xAG79cJkbJ6nxVKsk3)

The user: "as simple as possible — focus on the cards and the experience of playing in real life — but still with the
health bar callout to a fighting game." Built **v7.19**: `TalkBout` (the classic HUD's `LifeBar`/`LifeNum` reused, read
off the pad's marks, a damage pop, the round marker, the turn player's portrait lit; a tap opens the pad); the collapsed
pad removed from the mat; the heroes moved out of both side rows; the call starts below the bout so the bars stay
in view under it; "Any blocks?" / "No response"; the stack's ask line dropped and the defend ask shortened (talk only).
`tools/talk.js` follows the bout. Looked at with real art at 393x660 through a full turn cycle (attack, defend, hit,
pop): no page errors.
Gates: npm test 4642/4637/0/5 · babel 4/4 · page.js 370/372 on the first cut — the two FAILs were the glimpse at
145 px (393x660) / 99 px (320x568) once the call started below the bout; fixed by laying the slab over the glimpse's top
border (163 / 203 / 116 px, talk.js clean at all three) · `SAB=pad` fails 3 rows · serverpage 490/0 (switch off) ·
livecheck ALL PASS · function v190. Not run (no engine, rules, AI or trainer change): scenes, fairness, play, chaos,
trainchaos. The LIVE new table was not driven this time (the first session's proxy pattern does it).

### 2026-11-26/27 — CEO thread, the little details (session_013xG9xBYWuEHp34d66jY8vF)

The user: "the most artistic phase — we need to bring the experience of playing a game in the flesh and blood to the
screen and the little details are everything." Toured v7.19 with real art at 393x660 first: the gear's chip box was
the last app-looking thing and the mat was bare. Built **v7.20**: the gear as small cards with dice (and the real-table
cues: a blocker lifts, a broken piece greys, a swung weapon lies sideways); printed zone outlines; the turn medallion
(the hero's face, sliding between halves; the number left to the bout) and the bout's portraits cropped to the art; your
play flying in — which found an old defect on both boards (one glide mark, overwritten by the first pitch tap, so no
paid-for play ever flew; now per card + `Glide.keep`); stacked pops; short pay/arsenal asks; and the result as the pad,
after the last call ("DASH WINS") is said.
Lessons: (1) a flex item whose content is absolutely positioned has a max-content of ~0 in Chrome, so `flex-basis`
alone collapses the row (the first gear cut was squeezed at 393 px with room to spare): give it a `width`; (2) a UI
effect that "never fired" may be a single-slot memo overwritten by the next tap — record `Element.prototype.animate`
calls to know; (3) a result screen that waits on the call queue appears late: shoot it after its selector, not a timer.
Gates: npm test 4644/4639/0/5 · babel 4/4 · talk.js clean ×3 (the new result row; `SAB=result` fails it ×3) ·
page.js 375/375 · serverpage 490/0 (switch off). Not run (no engine, rules, AI or trainer change): scenes, fairness, play, chaos, trainchaos.

