# SCREENS-CIRCUIT — the meta layer: your record, the road, the daily challenge, the ladder (CRESCENDO design team)

Mockups: `mockups/circuit-1…9-*.html` (static, `tokens.css` + `flow.css`; `?v=` picks a state, `?w=375&h=548` another phone, `?noframe` full-bleed;
every page is clickable into the F-screens and back). All boxes are `x, y, w, h` in CSS px inside the content frame at **393×660**, as SCREENS-FLOW.md.
Rules that bind every screen here are SCREENS-FLOW.md's: the stage never scrolls, only the regions named below scroll (overscroll contained),
tappables ≥ 44×44, nothing under 11 px, one primary per screen (bone), no new colour (the palette is DESIGN-SYSTEM §3 — see "Colour" below),
motion is transform/opacity from MOTION.md's `--m-*`, cut under reduced motion. All numbers and names on the mockups are **sample data**.

**Why this exists.** F1 promises "Your record" and F2 promises "climb the ladder"; nothing behind them was designed. The user's brief (2026-11-28):
*establish the framework that elevates this to a timeless, addicting competitive game, in the spirit of the source material.* The answer here is
**THE CIRCUIT**: four things a player can come back to, none of which needs a server to be worth opening —

| | what it is | needs the server? | the reason to return |
|---|---|---|---|
| **Your record** (C1–C3) | your own story: rating and its movement, W–L–D, every game, per-hero mastery, personal bests | ranked card only | "how am I doing, and with what?" |
| **The road** (C7) | one rung per AI hero, in order, Armory to the Summit | no | a path with a next step, always |
| **Today's challenge** (C8) | one seeded deal a day, the same for everyone | no | a daily game worth a few minutes, and a line to compare with friends |
| **The ladder** (C4, C5) | public standings, your row, the rating move after a ranked game | yes (read signed-out) | competition between people |

**The honesty contract (what makes it fair, and what it will never do).** Every number on every Circuit screen is *derived from a game that was finished*
(by this phone's own store, or by the server's own rows). So: no currency, no points, no levels or XP, no login bonus, no "streak freeze", no loot,
no countdown that scolds, no badge dot, no push, no pop-up asking to be opened, no ad, no comparison that cannot be checked. Marks are earned by beating the
**Sharp** AI (the strongest seat, deterministic, seeded) at real decks as printed; nothing is ever awarded for losing, for opening the app, or for time.
A loss never shows a consolation prize; it shows the record it joins, factually. Rating arithmetic is the server's (Elo, start 1200, K 32); the client never
invents or "estimates" a rating. *For fun and glory, no ads, forever* (CLAUDE.md mission) is the test every line of copy passes.

---

## 0. Where the Circuit joins F1–F9 (the only edits to existing screens)

| screen | change | box / copy |
|---|---|---|
| **F1 Title** | "Your record" (the existing middle link, 133,586,127×44) opens **C1**. Nothing else changes: **no badge, no dot, no "new" on the title** — the Circuit never asks to be opened. | |
| **F2 Ways to play** | **a fifth card, between "Play an AI hero" and "Two phones"**: pictogram `m-circuit` (sun over a road, original), title "The Circuit", sentence "Your road, today's challenge, your record and the ladder.", tag "SOLO PROGRESS · NO SIGN-IN", goes to **C6**. Cards stay flex-filled: 5 × 97 at 393×660 (≥ 92 ✓). At 375×548 the sentence hides, the cards are 78 tall (min 70) and the pictogram 52 (`mockups/circuit-9-ways.html`). | `circuit-9-ways.html` |
| **F3 Choose your hero** | tile: **mastery pips** top-right (5 gems 8 px, step 11, right-aligned 8 px from the tile edge, y+7), shown only at rank ≥ SPARRED (no pips = untried, never a greyed row). Peek sheet: above the hero name, at 16,250: pips 14 px + the rank word (Mono 11, brass) — e.g. ◆◆◆◇◇ PROVEN. When F3 is opened from the road, the foe is already fixed (a brass chip "FOE · ENIGMA", Mono 11, right-aligned in the header at 253,20,130×28) and the sheet's button reads **SIT DOWN AS IYSLANDER**. | tile 120×160; sheet as F3 |
| **F4 Sit down** | **from the road**: their half is the fixed foe (no "TAP TO SWAP"), header label "THE ROAD · RUNG 9 OF 17". **From today's challenge**: both halves fixed (no swap, no change), GEAR hidden (decks as printed), label "TODAY'S CHALLENGE", the coin lands on its seed-decided side with **no choice**: slab "THE COIN / FAI GOES FIRST". | |
| **F7 Result** | the pad's lower part gives way to **the plate** (§C5) at ranked tables, and after any solo game that earned something. Buttons per variant in §C5. | 10,396,373,132 |
| **F8 Menu** | manners chip: "TODAY'S CHALLENGE" at the daily table. Concede copy at the daily: "Your opponent wins. **This counts as today's official try.**" Coach's call is absent at the daily (Q5). | |
| **F9 Waiting / server** | none. (The ladder is one tap away from F2 → The Circuit → Your standing; the ranked result's plate also opens it.) | |

**Flow**
```
F1 ─ Your record ─────────────► C1 You ◄─seg─► C2 Heroes ◄─seg─► C3 Games         (C1 ranked card → C4 · C1 recent → C3)
F2 ─ The Circuit ─► C6 ─┬─ Today's challenge ► C8 ─ PLAY TODAY'S DEAL ► F4 (fixed) ► TABLE ► F7 + plate
                        ├─ The road ► C7 ─ FIGHT <FOE> ► F3 (foe fixed) ► F4 ► TABLE ► F7 + plate ─ NEXT: <FOE> ► F4
                        ├─ Your standing ► C4 (ladder) ◄─ F7 ranked plate
                        └─ Your record ► C1 · Heroes ► C2 ─ tap a hero ► C2 sheet ─ SIT DOWN AS <HERO> ► F4
```

**Colour (no new colour; the existing roles, said once).** Gain/win = `--gain` (mint) + a ▲ + "+N"/"UP N"/"WON" · loss = `--damage` + ▼ + "−N"/"DOWN N"/"LOST" ·
draw/level = `--ink-1` + "±0"/"DREW" · progress, marks, today = `--brass` · muted = `--ink-2` · refusal/offline note = `--refused` ring + words. Jade/orchid appear **only**
where a seat is named (C8's two faces, as F4). **Colour never carries a fact alone**: every result has a word (WON/LOST/DREW), every rating move a sign and a triangle and a
spoken label (`aria-label="Rating up 12"`), every mastery rank pips **and** the word, every road cell a check or a name.

---

## C1 Your record  (`circuit-1-record.html`; `?v=you|signedout|offline|new|manage|erase`)

**Opens from** F1 "Your record"; C6; C3/C2 via the segmented control. **Segmented control** (shared by C1/C2/C3): 10,64,373,44 (3 × 124×44; tabs at x 10, 134, 259), labels YOU · HEROES · GAMES (BSD 800 15), active = `--mat-3` face + 3 px brass underline. Header: back 10,8,44,44; "KEPT ON THIS PHONE" (Mono 11) / "YOUR RECORD" (title) at 64,11. Scroll region 0,116,393,544 (padding 10, gap 10), top to bottom:

| block | box (y inside the region, h) | content | reads |
|---|---|---|---|
| **Ranked card** | 0 · 245 | label RANKED; right "#12 ON THE LADDER" (Mono). Rating numeral BSD 900 64 (`aria-label="Rating 1248"`); right the **move chip** (36/40 tall: ▲ + "+32", mint ring) with "OVER 10 GAMES" under; sparkline 353×64 (brass line, last point a 4.5 r dot, first/last numerals under it, Mono 11); line "**7** won · **4** lost · peak **1248** on this phone"; secondary **LADDER** 267,+187,102×44 → C4 | server `you`, `mine` (via cache); local ranked receipts (peak) |
| **The record** | 255 · 280 | three numerals (BSD 900 44) WON · LOST · DRAWN, then four 44-tall rows: Against the AI · Against people · Ranked (*from the server*) · The Dummy, each `W–L–D` (BSD 800 22; the D part only when > 0) | §Store `games` + legacy `dawnblade.aiRecord` (read live, never written) |
| **Personal bests** | 545 · 324 | label + six tiles 2 × 3 (min 76 tall): Fastest win (N TURNS, "Iyslander vs Kayo") · Closest win (N LIFE LEFT) · Longest winning run (N GAMES) · Peak rating ("seen on this phone") · Dummy, fastest clear (N TURNS, hero) · Daily, best run (N DAYS). A best that does not exist yet reads "–" and its caption "Not yet" | `marks.best`, `dawnblade.best`, `marks.streak` |
| **Recent games** | 879 · 366 | label + "All games ›" (link 289,+0,90×44 → C3) + the last 5 as C3's rows | `games` (newest 5) + ranked rows from cache |
| **Manage** | 1255 · 110 | "Everything above is kept only on this phone. Ranked games are kept by the server." **SAVE A COPY** 24,+52,168×44 → copy sheet; **ERASE** 202,+52,168×44 (`--damage` text) → confirm sheet | |

**Game row** (shared C1/C3): min-height 64, padding 0 10; result block 46×36 (WON/LOST/DREW, BSD 800 15, ring in the result colour); title "IYSLANDER vs BLAZE" (BSD 800 18, ellipsis, **always the player's hero first**); sub (Mono 11, wraps to a second line, never ellipsis): `<kind> · turn N · N left · <when>`; right: a tag (DAILY · ROAD, brass) or the move chip (ranked). Kinds read: "Sharp AI" (ai), "Training" (dummy), "Daily", "Road", "Friendly table", "Ranked". When = "just now" / "N min ago" / "N h ago" up to 48 h / "N d ago" — the same words as the classic page's `ladAgo`.

**States**
- `you` — as above. `signedout` — **never a blank**: the ranked card becomes "NOT RATED YET", numeral 1200 muted, "Where everyone starts", one honest paragraph ("Open a ranked table and pick a player name. Your rating, your place on the ladder and your last ten ranked games gather here. It is free, and always will be."), two secondaries FIND AN OPPONENT (→ F9 server) and SEE THE LADDER (→ C4 signed-out). Everything else shows what is on the phone.
- `offline` — a `--refused`-ringed note "SHOWING YOUR RANKED GAMES AS OF 2 HOURS AGO / The server is not answering right now. Everything else here is kept on this phone and is current." + TRY AGAIN; the ranked card shows the cached numbers with "· AS OF 2 HOURS AGO" in its label (age from `cache.at`), never a spinner and never an empty card. With no cache: the signed-out card.
- `new` — nothing played at all: one card with the dawn-on-horizon mark, "YOUR RECORD STARTS HERE / Every game you finish is kept on this phone: who you played, who won, and how it went. Nothing is counted that you did not play." + the ranked card in its signed-out words; the screen's primary **PLAY A GAME** 10,594,373,52 → F2.
- `manage` — copy sheet (SAVE A COPY): "Copies your whole record as plain text. Paste it into a note to keep it, or to move to another phone later. It holds heroes, results and dates, no names." COPY MY RECORD (primary) / NOT NOW. `erase` — "ERASE YOUR RECORD? This clears every game, mastery mark, road clear and daily result kept on this phone. Ranked games and your rating are kept by the server and stay. This cannot be undone." **KEEP MY RECORD** is the primary (the safe default), **ERASE EVERYTHING** the danger secondary (F8's concede pattern).
- **No request on open** (the title's standing rule): C1 reads the cache and shows its age; a quiet **REFRESH** (the offline note's link, or the ranked card's caption tap) asks the server once. C4 is an explicit destination and loads on open (Q11).

**Motion** — screen in: cards `translateY 12→0` + opacity, 40 ms apart (`--m-std`, as F2); a freshly changed number is never counted up (MOTION §1.2). Reduced motion: none.

## C2 Heroes and mastery  (`circuit-2-heroes.html`; `?v=list|sheet|empty`)

**Opens from** the segmented control (C1/C3), C6 "Heroes". Header "MASTERY, FROM YOUR SIDE" / "HEROES"; seg as C1; summary line 10,114,373,30 "PLAYED WITH 7 OF 17 · 2 PROVEN OR BETTER" (Mono 11). Region 0,152,393,508 scrolls; **hero row** 393×76: portrait 44 at x 14 (the ring-and-gap of the bout, neutral), name BSD 800 20, class (Mono 11), **pips (5 × 12 px) + rank word** (Mono 11, brass when rank ≥ 1), right the record "17–5" (BSD 800 24) and "9 OF 17 FOES" (Mono 11); chevron. **Order**: games played with the hero (desc), then roster order — tried heroes float up, untried sit below, dimmed (`--card-dim`) but fully readable, labelled "NOT PLAYED". No hero is ever hidden, gated or "locked".
**Mastery sheet** (tap a row): scrim `rgba(4,6,8,.66)` from y 0 (this is not a table — no bout to keep lit); sheet 0,92,393,568: art banner 0,92,393,150 with name BSD 800 40 and "ELEMENTAL WIZARD · CHAPTER 1"; close 341,100,44,44; scroll region 0,246,393,328: **rank row** (5 gems 26 px, the rank word BSD 800 26, record at right), **threshold row** (5 columns: SPARRED 1 GAME · BLOODED 1 WIN · PROVEN 6 FOES · MASTER 12 FOES · DAWNBLADE 17 FOES; reached ones brass), the sentence "**9 of 17** foes beaten with Iyslander against the Sharp AI. **3 more** for Master." and **your book**: 5-column grid of every hero's portrait 44 with the first name under (Mono 11; the mirror reads "MIRROR"), a **tick** on every foe beaten with this hero (the others dimmed, no tick, no lock). Primary **SIT DOWN AS IYSLANDER** 12,587,370,52 → F4 with the first foe not yet beaten preselected (F4's top half; tap still swaps).
**States** — `empty`: "NO HERO HAS YOUR MARK YET / Sit down with any hero. Beat every other hero's deck with it, one by one, and it earns its marks, up to the Dawnblade." + six untried rows. A foe that is not pilotable by the AI is simply absent from every grid and count (Q15).
**Motion** — a pip that has just been earned (arriving here from C5) fills with a scale `1.3→1` pop (`--m-press`, `--m-ease-slam`); the sheet rises as F3's peek (`--m-emph`); nothing else.

## C3 Games  (`circuit-3-games.html`; `?v=all|ranked|empty|detail`)

**Opens from** the seg, C1 "All games". Filter chips 0,112,393,48 (one row, horizontal scroll, snap, 8 gap, 10 pad; each 44 tall, BSD 800 15 caps): ALL · AI · PEOPLE · RANKED · DAILY · ROAD · DUMMY (active = brass ring). List region 0,164,393,496; **day headers** 30 tall (Mono 11: TODAY · YESTERDAY · SAT 22 NOV, local calendar days) then rows; windowed (the store holds up to 2000; render 40 and append 40 near the end — "Older games load as you scroll").
- **RANKED filter**: the server's last ten (`mine`) — a `--mat-2` note "The server keeps your last **ten** ranked games. Older ones count in your rating but cannot be listed." (Q10), rows show `how` as "ON LIFE · THEY CONCEDED · YOU CONCEDED · A DEAD POSITION · THEY LEFT THE TABLE" + the foe's player name + the move chip. A local ranked receipt that the server list already holds (same two heroes, same result, within 120 s) is shown once, server row first.
- **Detail sheet** (tap a row; `?v=detail`): row header + five label/value lines (HOW IT ENDED · TURNS · LIFE AT THE END "You 7 · Fai 0" · WHO WENT FIRST "Fai, by the coin" · OPPONENT "The Sharp AI"); for games that have a seed (ai, road, daily, dummy) the primary **PLAY THIS DEAL AGAIN** → F4 with `{hero, foe, seed, first}` (same shuffle, same coin; "A practice game: it does not change your record." — it is recorded as a game with `official:false` for dailies and counts nowhere that needs fresh skill, see P8); CLOSE secondary. People and ranked rows have no replay.
- `empty`: "NO GAMES HERE YET / Finished games land here the moment they end, one line each, from your side of the table." + PLAY A GAME primary. A filter with no games shows the same card with that filter's noun ("No ranked games yet. Open a ranked table and they gather here, with how your rating moved.").
**Reads** `games`, the cache's `mine`. **Motion** none (a list is a list).

## C4 The ladder  (`circuit-4-ladder.html`; `?v=you|provisional|signedout|latest|empty|loading|fail`)

**Public and readable signed-out** (server `ladder` takes no identity). **Opens from** C6 "Your standing", C1 ranked card, the ranked plate in C5. Header "RANKED TABLES · FOR FUN AND GLORY" / "THE LADDER". Two-tab seg 10,64,373,44 (STANDINGS · LATEST GAMES, 187 each). Rules line 10,112,373 (13 px): "Ranked server tables only. The best **50** by rating are listed; a player name and **3** ranked games put you on it. Friendly tables never count." — **50 and 3 are the server's `cap` and `floor`, never constants in the UI.** Region 0,180,393,480:
- **Your place** card (lead, brass keyline) 10,180,373,89: label YOUR PLACE (brass), "7 WON · 4 LOST", rank numeral "#12" and rating "1248" (BSD 900 44, both `aria-label`led in words). Pinned at the top of the region and *also* highlighted in the list when you are in it (row inset brass ring + a "YOU" chip).
- **Rows** (60 min): rank numeral BSD 900 26 (top three brass), player name (Spline 600 16), "14 WON · 3 LOST[ · 1 DRAWN]" (Mono 11), rating BSD 900 28. Read-only — a row is not a profile (no tap, no name search, no private data: the server sends names only).
- Footer hint "Standings from the server · a fan-made ladder, for fun and glory".
**States**: `provisional` (rated, below the floor; `you.listed=false, toGo>0`): "RATED, NOT YET LISTED / **1 more game** · 1216 · Rated after 2 ranked games. One more and you are on the ladder." · `signedout`: the card reads "NOT RATED YET / Anyone can read the ladder. To be on it, open a ranked table, choose a player name and play 3 ranked games. You start at 1200." + FIND AN OPPONENT · a *named* player with no games: "Choose a player name and you are on the ladder" is the classic's words — keep them · `latest`: the server's `recent` list ("**Orrin K.** (Blaze) beat **Kestrel** (Iyslander) — WON ON LIFE · 3 MIN AGO"; draws "… and … drew — A DEAD POSITION") · `empty`: "NO ONE IS ON THE LADDER YET / Be the first: play 3 ranked games and your name stands at the top." + primary FIND AN OPPONENT · `loading`: skeleton rows + "READING THE LADDER ●●●" (the dots are F9's) · `fail` (**the server is off or not answering**, `SERVER_TABLE.on=false` included): `--refused`-ringed note "THE LADDER IS NOT ANSWERING / Check your connection, then try again. Nothing is lost: your games and your rating are kept by the server." + primary TRY AGAIN. Never a blank, never a fake row.
**Reads** `DawnServerTable.ladder({transport, identity?})` → `{floor, cap, ladder[], recent[], you, mine?}`; the identity is passed **only** when the phone already has a sign-in (`who.known()`), exactly as the classic `SrvLadder` — looking never signs anyone in. **Placeholder names on the mockup are invented.**

## C5 The result, with progress  (`circuit-5-result.html`; `?v=ranked-win|ranked-loss|ranked-new|ranked-wait|solo-rung|solo-rank|daily-win|daily-loss|plain`)

**Adds to F7's result pad; the KO frame, the bout, the veil and the pad's ring and GG are F7's, unchanged.** The pad gives up height: **paper 10,64,373,316** (was 470; compact 240; its columns still scroll, opening at the bottom). Below it, in the slot **10,396,373,132** (compact 10,312,373,106), one **plate** (`#1d272c → #121a1e`, `--e3`, r16 — dark, so the paper stays the one light object). Buttons keep F7's places: two secondaries 10,538 and 202,538 (182×44), the primary 10,594,373,52 (compact: as F7's bottom-anchored stack).

**Ranked plate** (a button → C4): "RATED GAME · THE SERVER'S NUMBERS" (Mono 11); **old numeral** BSD 800 34 muted → chevron → **new numeral** BSD 900 60 bone; right the move chip (40 tall, sign + triangle: `▲ +12` mint ring / `▼ −15` rose ring / `= ±0`); bottom line: "**#12** on the ladder · was #14 when you last looked" (13 px; "was" only when the cache holds a rank from the last 7 days) and a chevron. The move is `rank().result.change[mySeat]` = the server's `{from, to}`; the sign is `to − from`; nothing is computed here. Variants: `ranked-loss` (▼ −15, "#13 … was #12") · `ranked-new` (placement: "YOUR FIRST RATED GAMES · 1200 → 1216 · Rated game **2 of 3**. One more and you are on the ladder.") · `ranked-wait` (the result arrives with the answer to the move that ended the game; until then the plate shows a skeleton and "RECORDING THE RESULT ●●●" — the buttons already work; **if the server never answers**: "The server has the result. Your rating shows on the ladder when it answers." and the plate becomes a link to C4). The standing line needs one `ladder` read after the result (identity known): while it is loading the line shows "Reading the ladder…"; on failure "Your new standing shows on the ladder."
**Solo plate** ("WHAT THIS GAME DID", at most **two** beats, 48 tall each: 40 px icon disc, title BSD 800 19, sentence 13 px): the beats of the game, by priority — summit › tier › mastery rank › daily result › road rung › personal best › new foe beaten (see §Rules P9). `solo-rung` "ROAD: ENIGMA CLEARED / 9 of 17 on the Road · Skirmish 4 of 5" + "IYSLANDER: 10 FOES BEATEN / 2 more for Master"; `solo-rank` "IYSLANDER IS NOW MASTER / 12 of 17 foes beaten with Iyslander · 5 more for the Dawnblade" + "FASTEST WIN: 6 TURNS / Was 9 turns, with Viserai"; `daily-win` "WON IN 9 TURNS / Three days running · your fastest daily win so far is 7" + "GRAVY BONES: 1 FOE BEATEN"; `daily-loss` one beat "LOST ON TURN 10 / That is today's result. Play it again for practice: same deal, nothing changes." A loss shows **no** consolation beat, only the day's own fact (`daily-loss`). `plain` (nothing earned — friendly, practice, a repeat): one centred line "Saved to your record on this phone." at 10,404 (13 px, `--ink-1`) and no plate. At compact only the first beat shows (all beats are on C1/C2).
**Buttons by variant** — ranked: NEW OPPONENT · LEAVE · **REMATCH**; solo-rung: REMATCH · LEAVE · **NEXT: ARAKNI** (→ F4 with the next uncleared rung's foe); solo-rank: NEW OPPONENT · LEAVE · REMATCH; daily-win: SHARE (copies the text of C8) · LEAVE · **BACK TO THE CIRCUIT** (→ C6); daily-loss: SHARE · LEAVE · **PRACTICE THIS DEAL** (→ F4, same seed, `official:false`); the pad's own title line stays F7's ("You won · turn 9").
**Motion** (new; all `--m-*`): plate rises 24 px + opacity, `--m-emph`, `--m-ease-out`, starting when F7's GG stamps; old numeral shown at once; at +420 ms the new numeral **replaces** the text with a scale pop `1→1.12→1` (`--m-slam`, `--m-ease-slam`; **never counted up**); the chip stamps `scale .6→1` + opacity at +520 ms (`--m-slam`); the standing line fades in at +700 ms (`--m-std`). Solo beats fade up 40 ms apart (`--m-std`). A tap anywhere on the plate before it ends jumps to the final pose. Reduced motion: final pose, no animation. **No new sound** (the existing result cue only).
**Reads** `rank()`; the store's `record()` return value (`events[]`, §Rules P9); one `ladder` read (ranked). The store is written **once** when the table reports `over` (same moment the classic board calls `DawnLocal.recordResult`), idempotent on the game id.

## C6 The Circuit  (`circuit-6-home.html`; `?v=midway|done|fresh|offline`)

**Opens from** F2's fifth card; back → F2. Header "ROAD · DAILY · LADDER" / "THE CIRCUIT". A flex column 10,68,373 down to the hub (gap 8): three cards, a tile row, the primary.
| block | box (393×660) | content |
|---|---|---|
| **Today's challenge** (lead) | 10,68,373,152 (compact 120) | label (brass) + status pill (**NOT PLAYED YET** / ✓ **WON · TURN 9** / LOST · TURN 10); both heroes as two overlapping 52 px portraits (jade / orchid rings), "GRAVY BONES vs FAI", "Same deal for everyone."; footer (Mono 11): "Last played yesterday · new in 6 h 12 m" / "Three days running · best 4" (hidden at compact). Tap → C8 |
| **The road** | 10,228,373,142 (compact 122) | label + "SKIRMISH · 3 OF 5"; **17 dots in four groups** (filled brass = cleared, brass ring = next, grey ring = to go; the groups are the tiers) with `aria-label="8 of 17 foes cleared"`; next foe portrait 44 (brass ring) + "NEXT UP / ENIGMA". At the summit: "YOU REACHED THE SUMMIT / Replay any rung". Tap → C7 |
| **Your standing** | 10,378,373,96 (compact 80) | label + "7 WON · 4 LOST"; rating (BSD 900 44) + "#12 ON THE LADDER" + the move chip over the last ten; tap → C4. `fresh`/signed-out: "NOT RATED YET · 1200 · Everyone starts here. Open a ranked table to be rated." `offline`: the cached numbers + "As of 2 hours ago. The server is not answering." |
| **Tiles** | 10,482,182,56 and 202,482,182,56 (compact 48) | YOUR RECORD → C1 · HEROES → C2 |
| **Primary** | 10,594,373,52 | what to do next, in order: **PLAY TODAY'S CHALLENGE** (if unplayed) › **FIGHT ENIGMA ON THE ROAD** (daily done, road not finished) › **PLAY** → F2 |
States: `fresh` (no road clears, no rating): dots all empty, next = the first hero, "Armory · 0 of 5", standing = not rated · `done` (daily played) · `offline` (standing cached). **No notification, badge or banner anywhere says the daily is unplayed** — the card and the primary are the whole nudge.
**Motion** — cards in 40 ms apart (`--m-std`, as F2). **Reads** `dailyDeal`, `marks.days`, `marks.road`, `cache.ranked`, `games` (tallies).

## C7 The road  (`circuit-7-road.html`; `?v=mid|fresh|summit`)

**Opens from** C6, the NEXT button on C5. Header "EVERY FOE, ONE AT A TIME" / "THE ROAD"; progress bar 10,66,373,30 ("8 OF 17 CLEARED" + a 8 px track; the fill is `scaleX`, origin left). Region 0,100,393,484 scrolls (opens scrolled so the **next** rung is in view): a vertical line at x 33, then per tier a **tier row** 48 tall (BSD 800 20 name, "5 OF 5" Mono, a brass **✓ CLEARED** stamp when complete) and **rung rows** 64 tall: node = hero portrait 44 on the line (cleared: ✓ disc, mint, bottom-right; next: brass ring; to go: dimmed, readable), name BSD 800 20, sub (Mono 11) "CLEARED · WITH IYSLANDER · TURN 9" / "NEXT UP" / "NOT YET". **Tap a rung to select it** (brass inset ring, a "FIGHT" tag right; default = next); the primary **FIGHT ENIGMA** 10,594,373,52 → F3 with that foe fixed. Any rung, cleared or not, can be fought any time: the road is a record, not a lock (Q8). Tiers are the distinct `ch` of `HEROES` ascending; names §Naming. `summit`: the top of the region gains the sun-on-horizon card "YOU REACHED THE SUMMIT / All 17 foes beaten, one by one. The road is yours to walk again, and every hero has its own book to fill." and the primary reads PICK A RUNG. When a new hero joins the roster the road gains a rung at its end and one line "1 new foe has joined the road" appears under the progress bar; the summit mark, once earned, stays.
**Motion** — arriving from a win: the new rung's ✓ pops (`--m-slam`), the bar's `scaleX` moves old→new (`--m-emph`), a completed tier's stamp slams in (`--m-ease-slam`); the summit sun rises 24 px + halo opacity once (`--m-emph`). **Reads** `marks.road`, `HEROES`.

## C8 Today's challenge  (`circuit-8-daily.html`; `?v=open|won|lost`)

**Opens from** C6. Header "28 NOV · RESETS IN 6 H 12 M" / "TODAY'S CHALLENGE" (the date is the UTC day key; the reset time is shown as the player's own countdown). Stack 10,66,373 → hub.
- `open`: **two faces** 10,66,373,208 (2 × 181 hero art, name BSD 900 26 over a bottom gradient, label "YOU PLAY" under jade / "AGAINST" under orchid, a 3 px seat-colour underline, the brass **VS** disc 40 on the seam); three rule lines (icon + 14 px): "**Same deal for everyone today:** the same two decks, the same shuffle, the same coin." · "Decks as printed. The AI plays at its sharpest. **Fai goes first** by the coin." · "**One official try a day.** Your first finished game is today's result. After that, play it again for practice." — box 10,284,373,157; **last seven days** 10,451,373,62 (7 cells ≈ 49×62: weekday letter + **W / L / D / –**, today ringed brass; each `aria-label`led "Monday: lost"); stats line 10,523 (Mono 11) "TWO DAYS RUNNING · BEST 4 · 6 WON OF 9 PLAYED"; primary **PLAY TODAY'S DEAL** 10,594,373,52 → F4 (fixed).
- `won` / `lost`: faces shrink to 150; **result card** 10,226,373,95 (lead): WON/LOST block, "WON IN 9 TURNS" / "LOST ON TURN 10", "YOU FINISHED ON 7 LIFE", and "Your fastest daily win so far is 7 turns." / "That is today's result. A new deal arrives in 6 h 12 m."; **share text** box 10,331,373,74 (Mono 12.5) showing exactly what will be copied; week strip 10,415; stats 10,487; secondary **PRACTICE THIS DEAL** 10,544,373,44; primary **COPY MY RESULT** 10,594,373,52 (a "Copied" toast, `--z-toast`, `--m-fast`, then the label returns). At compact (375×548) the faces are dropped and the heroes move into the result card's mono line.
**Share text** (plain, spoiler-free, no tracking): `Dawnblade Daily · 28 Nov⏎Gravy Bones vs Fai⏎Won in 9 turns · 7 life left` (loss: `Lost on turn 10`). No links, no ids.
**Motion** — the result cell in the week strip stamps `scale .6→1` (`--m-slam`); nothing else.
**Offline**: the daily needs no server at all; there is no global scoreboard (Q13 asks for one later); nothing on this screen ever says "offline".

---

## The local store (new): `dawnblade.circuit`

One JSON value under the page's existing storage seam (`store.get("circuit")`, key `dawnblade.circuit`), **versioned, read and written inside try/catch behind a thunk** (merely reading `window.localStorage` throws in some browsers — `engine/local.js`'s `loadRecord` convention), working from `file://`. If storage is unavailable the Circuit **runs from memory for the session and C1 shows one line** "This phone is not letting the game save. Your record will not be kept after you close the page." — never a crash, never a silent loss.

```jsonc
{ "v": 1,                      // unknown/newer v => read as empty AND never overwritten (a newer build owns it)
  "device": "d_7f3k9x2a",      // random, local; never sent anywhere unless sync is opted into (Q13)
  "created": 1796000000000,    // ms of the first write
  "games": [ Game, … ],        // oldest first, id-unique, at most 2000 (oldest dropped into `folded`)
  "marks": {                   // MONOTONE: written when a game is recorded, never recomputed downward
    "beat":  { "iyslander": ["kayo","viserai"] },                   // per MY hero: distinct foe hero keys beaten by a Sharp win
    "road":  { "kayo": {"at":…, "me":"iyslander", "turns":6, "id":"…"} },   // rung -> first clear
    "days":  { "2026-11-28": {"r":"w", "turns":9, "life":7, "me":"gravy", "foe":"fai", "id":"…"} },  // daily: the OFFICIAL result
    "best":  { "fastWin":{"turns":6,"me":"iyslander","foe":"kayo","at":…}, "closeWin":{"life":1,…}, "run":7, "peak":{"rating":1248,"at":…} },
    "streak":{ "best": 4 },    // current streak is derived from `days` and today's date
    "summit": null             // {at} once every rung was cleared
  },
  "folded": { "ai": {"iyslander":{"w":0,"l":0,"d":0}}, … },        // counts of games dropped by the cap, by kind then my hero
  "sync":   { "at": null }     // reserved (below)
}
```
```jsonc
Game = { "id": "421873.iyslander.kayo.mf3k2a",  // kind-appropriate unique id: seeded games = seed.me.foe.endedAt(base36); people = the existing table game id (code + seed halves); <= 120 chars
         "at": 1796000123456,                    // ms when the game ended (device clock)
         "kind": "ai"|"dummy"|"daily"|"road"|"friend"|"ranked",
         "me": "iyslander",                      // HEROES key
         "foe": "kayo" | "dummy",                // HEROES key, or "dummy"
         "level": "sharp"|"steady"|null,         // the AI's level; null for dummy and for people
         "result": "w"|"l"|"d",                  // from MY side (engine/local.js outcomeOf)
         "how": "life"|"concession"|"stalemate"|"forfeit",
         "turns": 9, "life": [7, 0],             // final life, [mine, theirs]
         "first": 1,                             // 1 if I took the first turn, else 0
         "seed": "421873" | null,                // the match seed (replay with the same decks); null for people
         "day": "2026-11-28" | null, "official": true,   // daily only: the deal's UTC day; official = the first finished game that day
         "rating": {"from":1236,"to":1248} | null,       // ranked only: the server's own pair, copied once (a receipt)
         "dv": "sage-v19" }                      // DATA_VER when played (a replay is only valid on the same data)
```
**Never stored**: a person's name, a table code beyond the existing game id, a card, a hand, a log line — *opponents are filed by hero only* (the classic record's rule). "Save a copy" = `DAWNBLADE-RECORD 1 ` + the JSON on one line.
**Clean on load** (`engine/local.js`'s `cleanRecord` discipline): unknown fields dropped, counts non-negative integers, anything half-written reads as empty rather than as a number nobody counted; a game with an unknown `kind`/`result`/`how` is dropped alone, the rest survive. **Write** = one `setItem` of the whole value after recording (the commit of the game and its marks together, so a game is never counted without its marks or the reverse). Size ≈ 150 B/game → 2000 games ≈ 300 KB (the quota is ≥ 5 MB). **Reads from neighbours, never writes**: `dawnblade.aiRecord` (legacy tallies, merged into C1/C2's totals live so a player who alternates the classic page loses nothing and nothing is counted twice — CRESCENDO does not write it), `dawnblade.best` (the Dummy's fastest clears), `dawnblade.crescendo.last`. **Server cache** `dawnblade.circuit.cache` `{v:1, at, you, mine}` — a copy of the last `ladder` read (ranked card offline, "was #14", C3's RANKED filter); separate so SAVE A COPY excludes it and ERASE clears both.
**Ranked games** are *not* in the W–L–D tallies of the store (the server owns them; the classic record's rule: counting them here would show one game twice): the ranked row of C1 is the server's `you` (or the cache, labelled with its age). They are kept as **receipts** (`kind:"ranked"` with `rating`) so the phone has a rating path longer than the server's ten, a peak, and an offline list.
**Designed to sync later** (nothing here syncs): games are immutable and id-unique, so a future `history_put(games[])` is an **append-only set union by `id`**, idempotent like `result_record`; `marks` are recomputable from `games ∪ folded`, so two devices converge by union then recompute; `device` says where a game came from; `sync.at` is the last pushed `at`. A sign-in would be required and the player would opt in (Q13); until then a copy-and-paste export is the whole bridge.

## The rules (exact and testable)

Let `N = HEROES.length` (derive it; 17 today), `foes = HEROES.map(k)` in array order, `now` = device clock. A **Sharp win** = a game with `kind ∈ {ai, road, daily}`, `level = "sharp"`, `result = "w"` (hence `how = "life"`). Each rule below is a drill in `test/ui-circuit.test.js` (pure functions, no DOM; **sabotage each one and see the drill fail**).

| id | rule |
|---|---|
| **P1 Record** | `record(store, game)` appends the game unless its `id` is already present (then returns `null` and changes nothing), applies P2–P8, trims `games` to 2000 by folding the oldest into `folded`, and returns `{store', events[]}`. A game with no result (unfinished, abandoned) is never recorded. Nothing is awarded for opening the app, for time, for losing, or for a streak. |
| **P2 Tallies** | C1's rows: *Against the AI* = games `ai ∪ road ∪ daily` (+ legacy `aiRecord.foes`); *Against people* = `friend` (+ legacy `pvp`); *Ranked* = the server (`you.wins/losses/draws`), else the cache; *The Dummy* = `dummy`. Totals = the four rows. A concession by the player is a loss; a stalemate a draw. |
| **P3 Pair** | on a Sharp win, `beat[me]` gains `foe` (set semantics; the mirror counts as the foe equal to `me`). |
| **P4 Mastery** | for hero `H`: `games(H)` = games with `me=H` (any kind, ranked receipts included), `wins(H)` = wins with `me=H` and `kind ≠ dummy`, `b(H) = |beat[H]|`. **Rank 0 UNTRIED** if `games=0`; **1 SPARRED** if `games ≥ 1`; **2 BLOODED** if `wins ≥ 1`; **3 PROVEN** if `b ≥ ceil(N/3)`; **4 MASTER** if `b ≥ ceil(2N/3)`; **5 DAWNBLADE** if `b = N`. The rank is the highest satisfied (at N=17: 1 game, 1 win, 6, 12, 17 foes). Marks never decrease, so a rank is never lost when the roster grows (it shows "16 of 18"). |
| **P5 Road** | rung `foe` clears on the **first** Sharp win against it by any hero: `marks.road[foe] = {at, me, turns, id}` (never overwritten). `next` = the first uncleared rung in roster order (none → summit). A **tier** = the heroes sharing a `ch`; a tier is cleared when all its rungs are; `marks.summit = {at}` is set when every rung is cleared. |
| **P6 Daily deal** | `dailyDeal(day, heroes)` (pure): `base = "dawnblade-daily|" + day`; `r0 = DawnRNG.make(seedFrom(base + "|pair"))`; `a = int(r0, N)`; `b = int(a.rng, N-1)`; `me = heroes[a.v]`; `foe = heroes[b.v ≥ a.v ? b.v+1 : b.v]` (never a mirror); `seed = base + "|match"`; `first = int(make(seedFrom(seed + ":rps")), 2).v` (the table coin's winner takes the first turn, **no choice**: 0 = me, 1 = them). `day` = the UTC date `YYYY-MM-DD` of `now`. Decks as printed, Sharp, no gear changes. **Vectors** (the current 17-hero roster; a roster change re-deals only future days): `2026-11-28 gravy fai first=1` · `2026-11-29 kayo blaze 1` · `2026-11-30 fai iyslander 1` · `2026-12-01 viserai azalea 1` · `2026-12-02 iyslander lyath 0` · `2026-12-03 enigma iyslander 1` · `2026-12-04 boltyn blaze 1` · `2027-01-01 blaze arakni 1` (computed with `engine/rng.js` as it stands; 730 days: first-player split 343/387, no mirror, every hero dealt 35–56 times). |
| **P7 Daily result** | the first **finished** game with `day = D` is *official*: `official:true`, and `marks.days[D] = {r, turns, life, me, foe, id}` (never overwritten). Later games on D are practice (`official:false`): they are real games (P2) and real Sharp wins (P3, P5) **but never touch `days`, `streak` or any best** (P8) — so the same deal cannot be replayed into a record. Conceding is an official loss. Closing the app mid-game is *not* a try (honour system, Q6). |
| **P8 Streak and bests** | `streak.cur` = the count of consecutive UTC days ending today (if `days[today]` exists) or yesterday (if not) that each have a `days` entry — **a loss counts as showing up**; a missing day resets it to 0 without comment. `streak.best = max(streak.best, cur)` on record. Bests consider games `ai, road, daily (official), friend, ranked` only, never practice replays: `fastWin` = fewest `turns` among wins with `how="life"`; `closeWin` = fewest `life[0] ≥ 1` among the same wins; `run` = the longest chain of consecutive such wins in `at` order (any non-win breaks it); `peak.rating` = the max of receipts' `rating.to` and any `you.rating` read; Dummy's fastest clear is `dawnblade.best`'s minimum. A tie keeps the earlier. |
| **P9 Events** (what C5 shows) | `record` returns `events` in this priority: `summit` › `tier{ch}` › `rank{hero,from,to}` (only for BLOODED and above: SPARRED fills its pip quietly on C2) › `daily{r,turns}` › `rung{foe}` › `best{which,value,was}` › `pair{hero,beaten}`; C5 shows the first two. Each event is a pure fact derived from the diff of `marks` (no event without a change). |
| **P10 Honesty** | no rule above takes a number from anywhere but a finished game or the server's own rows; no rule has a bonus, multiplier, decay, expiry or random element; `level:"steady"` games (reachable only by `?search=0` drives) count as games and never as Sharp wins. |

**Worked fixture (the first drill).** Empty store, N=17. (1) `ai` Iyslander beats Kayo, Sharp, T6 → events `rank{iyslander 0→2 BLOODED}`, `rung{kayo}`, `best{fastWin 6}`, `pair{iyslander 1}`; shown: rank + rung. (2) the same game again with a new id → no events but the tally; `fastWin` unchanged. (3) `dummy` Iyslander wins T5 → no marks. (4) `daily 2026-11-28` Gravy Bones loses to Fai (official) → `days` set, `streak.cur = 1`, event `daily{l,10}` only. (5) practice replay of that deal, Gravy Bones wins → no `days`/`best` change; events `rank{gravy 1→2}`, `rung{fai}`, `pair{gravy 1}`. (6) re-record (5) → `null`.

## Reads and calls (what each field takes from where)

| Circuit field | source | call |
|---|---|---|
| rating, record, listed, rank, `toGo` | server `ladder().you` | `DawnServerTable.ladder({transport, identity?})` — `identity` only when `who.known()` |
| last ten ranked games (hero, foe hero, foe name, result, how, change, at) | `ladder().mine` (0 rows ⇒ "No ranked games yet"; absent key ⇒ older function: show nothing new) | same |
| standings, floor, cap, latest games | `ladder().ladder / floor / cap / recent` | same, public |
| rating move after a ranked game | `rank().result.change[mySeat] = {from,to}` (and `ratings` before) | the networked table's `rank()` / `onRank` |
| everything else | `dawnblade.circuit` + the neighbours above | `ui/circuit.js` |
Server tables the build may not have (`SERVER_TABLE.on=false`) or that do not answer behave as "fail"; the Circuit's solo half (C1 without ranked, C2, C3, C6 solo, C7, C8) never calls the server.
**One ask for the server team (Q10):** `012_my_games.sql` returns the newest **10**; raising its limit to 50 completes C3's RANKED filter and the sparkline. Not required to ship.

## Naming and flavour (questions marked ⚑ are in the list below)

The layer is **THE CIRCUIT** (⚑Q1). Road stages borrow Flesh and Blood's own organized-play ladder as plain words, in the order a player climbs it: **ARMORY** (Chapter 1's five heroes) → **SKIRMISH** (Chapter 2) → **THE CALLING** (Chapter 3) → **THE SUMMIT** (the newest precons, `ch` 4: Viserai, Between Worlds and Prism). The last distinct `ch` is always THE SUMMIT; earlier ones take the names by index and any extra tier reads "CHAPTER n" (so a new precon block slots in without a rewrite). THE SUMMIT is TORCH.md's own phrase ("the Road to the Summit"); we chose it **instead of "Pro Tour"** so the final rung never implies an official event (⚑Q2). Rank words are plain and ours: UNTRIED · SPARRED · BLOODED · PROVEN · MASTER · **DAWNBLADE** (a hero that has beaten every foe — the project's name, and the sword in Dorinthea's hand). Voice: the sharp, warm coach of TORCH.md — "Next up", "Not yet", "Nothing is lost" — never "You're so close!", never loss framing, never a countdown that scolds ("New one in 6 h 12 m" is information, not pressure). The standard non-affiliation line stays in the footer of F1 and in the Circuit's C6 settings sheet when one exists.

## Build notes (Preact + htm, no build step)

- `ui/circuit.js` — UMD, plain script, **no DOM, no engine import beyond `DawnRNG`**: `load/save/record/summary/mastery/road/dailyDeal/dailyState/share/ladderView`, all pure over a store object; `test/ui-circuit.test.js` drills P1–P10 and the vectors; `test/ui-sync.test.js` gets its load-order line.
- `ui/circuit.view.js` + `ui/circuit.css` — the screens as htm components on the router's existing pattern (`ui/flow.js`): the seg control, game row, plate, rung, pips are one component each; tokens from `ui/tokens.css`, no new colour variable. Segmented tabs are real routes (`#/circuit/record`, `/heroes`, `/games`, `/ladder`, `/road`, `/daily`) so back works.
- The session adapter (`ui/session.js`) gains **one** call: on `over` → `Circuit.record(...)`, then hands `events[]` to F7's plate. The daily/road launch is `openLocal({query:{hero, foe, seed, first, search:"1"}})` — the URL contract the adapter already has (`?hero&foe&seed&first`).
- Every dynamic number is `font-variant-numeric: tabular-nums` in a fixed-width cell; rating moves replace text (no animated counting); the chips' `aria-label`s are generated from the same value as the visible text.
- Offline: nothing in C1–C3, C6–C8 loads anything from the network; the ladder's failure states are first-class (above).
- Drives to add: `tools/ui-flow-drive.js` box-matches `mockups/circuit-*.html` (the boxes in this file) × 4 viewports × both engines; a chaos pass that finishes random games and asserts P1–P10 on the live store.

## Open questions (default stands until the user answers)

Q1 The name "The Circuit" for the layer (vs "Career", "The Climb") — default **The Circuit**.
Q2 Tier names ARMORY / SKIRMISH / THE CALLING / THE SUMMIT adapt LSS organized-play event names. Unsure: whether using them as plain words is welcome, whether "Skirmish"/"The Calling" are protected, the true order and spelling of the ladder (Armory → Skirmish → Battle Hardened → The Calling → Pro Quest → Pro Tour → Nationals → Worlds), and whether you want the last tier called "Pro Tour". Default: the four above, THE SUMMIT last, non-affiliation line standing.
Q3 The daily's day boundary: **UTC** (default; one shared deal worldwide, midnight at a different clock time per place) vs the player's local midnight (the "same for everyone" claim breaks) vs Auckland time (LSS's home).
Q4 Daily first player: the seed's coin decides, **no choice** (default) vs "you always go first".
Q5 Coach/Hero's call at the daily table: **absent** (default: it is a test, like friendly and ranked) vs present.
Q6 Leaving the daily by closing the app: **not a try** (default, honour system) vs recorded as an official loss on next open.
Q7 A streak at all? Default **yes, informational only** (a loss counts as showing up, no freeze, no reminder, no copy when it breaks) vs omit it entirely.
Q8 Road gating: **none, an open road** (default) vs sealing THE SUMMIT until the other three tiers are cleared.
Q9 Do wins over people count toward foes beaten? Default **no** — only the Sharp AI (deterministic, the same opponent for everyone, nothing a friend can throw).
Q10 Keep ranked **receipts** locally (default yes) and ask the server to return 50 `mine` rows instead of 10 (default: ask, ship without).
Q11 C1 makes **no request on open** (the title's rule; shows the cache with its age, REFRESH asks once) — default yes; vs request on open like C4.
Q12 "Save a copy" now, **import later** (default) vs design import now.
Q13 Sync, and a **global daily scoreboard**: default neither now; both would need a sign-in and opt-in, and a daily board needs a server rule for "same seed, honest result" (the referee would have to replay it).
Q14 The daily's share line as plain text copy — default yes.
Q15 The brief says the AI pilots 16 hero decks; `HEROES` lists 17. Which one the AI cannot yet pilot (Prism's awakened figment)? Default: every hero in `HEROES` is a rung and a foe; a hero flagged unpilotable is simply absent from the road, the grids and the thresholds.
Q16 The mirror (Iyslander vs Iyslander) counts as a distinct foe for mastery and the road — default yes.
Q17 Practice replays of a daily deal never touch bests, days or the streak (P7) — default yes.
Q18 Both an F2 card **and** the F1 link — default yes. Q19 Legacy `aiRecord` tallies merged live into C1/C2 — default yes. Q20 THE SUMMIT being two heroes (`ch` 4) — default yes; alternative: regroup the roster 5/5/5/2 differently.

## Verified / not verified

Chromium (system Chrome, the real fonts from `@fontsource`), 375×548 · 393×660 · 430×932 (and 393×852 for the stack-fit check), **every variant of every page**: no horizontal page scroll, nothing outside the stage, no tappable under 44×44 (the fills of the closed sheets excepted: a scrim covers the layer under it), no overlapping tappables (a sheet over its own screen excepted), no text under 11 px, no ellipsis on any row copy, the flex stacks (C6, C8) fit between the header and the hub at every size (`fit.js`-style scrollHeight check). **Not verified**: WebKit/iPhone (`color-mix()`, `mask-image` on the summit sun, Caveat in Safari — as SCREENS-FLOW), the real card art (the sandbox answers images with a grey tile; `data-href` flows are clickable), the daily vectors on a second JS engine (the FNV/`Math.imul` code is the engine's own), 4x-CPU frame times of the plate animation, and anything about real players' behaviour (whether a daily is a habit or a chore is learned only on the user's phone).
