## v7.09 — The recap

- **End-of-game recap (QUEUE NEXT 2, CEO).** Every end screen — the trainer's win, loss and draw, and every table's
  (AI, Dummy, friend, server, ranked) — carries one small card: how many turns, then two columns (*You* first) with
  *Life lost*, *Most at once* (the biggest single fall and its turn) and, when anyone gained life, *Life gained*. The
  numbers are kept from STATE, never the feed: `judge.recapStep` keeps `recap` ({hp, lost, gain, big}) on the game, run
  inside `stalemateCheck`, the one function both boards pass every committed state through, before `over`, so the
  finishing blow counts. A fall past zero counts down to zero. "Life lost" is any loss, damage or not.
- **WIRE_V 49 → 50**: `recap` is a new top-level game key (`sides.js` GAME_KEYS); a v49 peer would drop it.
- Drills: `test/recap.test.js` (the count by hand; the books balance — first life − lost + gained = life now — at every
  state of two real policy games; sabotage, dropping the `lost` addition, FAILS all four); page.js's three table endings
  check the card shows the game's own count, "You" first, inside 393.
- Gates: see the release commit.

## v7.08 — Join from the link

- **Join from the link (QUEUE NEXT 1, CEO).** The shared text now carries the table number in the address
  (`…/?join=CODE`, "Tap <link> to sit down."). Opening it skips the title and lands on the right join screen with the
  number filled in: a 4-character number is a direct table (*Two phones, one table*), a 6-character one a server table
  (*Enter a table code*); any other length opens the page as usual. The parameter is read once (`JOIN_ASK`, script0) and
  taken out of the address at once, so a reload or a home-screen relaunch does not sit down again, and App forgets it as
  soon as the code screen is left. Nothing is sat at until the player taps *Sit down*. Back returns to the title. Page
  only. Drill: three page.js join-link rows (lower-case direct number, server number, a junk length); sabotage (the
  TableScreen effect that reads `join` removed) FAILS the first two.
- Gates: see the release commit.

## v7.07 — Share the table number

- **Share the table number (QUEUE NEXT 2, CEO).** A direct host's screen and an unranked server host's screen gain a
  button under the number: *Share the table number* hands it to the phone's share sheet (Messages, WhatsApp…) with this
  page's address and how to join; where there is no share sheet it reads *Copy the table number* and copies the same
  text (`copyText`, which never claims a copy that did not happen). A cancelled sheet says nothing. The address is left
  out when the page was opened from a file. Ranked host screens do not show it (ranked is the queue, not friends).
  Page only (`ShareCode`, script1b). Drill: two page.js rows (a stand-in share sheet and a stand-in clipboard: the number
  is in what was handed, 44 px, fits 393; the copy path says so).
- Gates: see the release commit.

## v7.06 — The screen stays awake

- **Keep the screen awake (QUEUE NEXT 1, CEO).** While a board is up — the trainer, or any table (AI, friend, direct,
  ranked, server) — the page holds a Screen Wake Lock, so the phone does not dim while the other seat thinks. The browser
  drops the lock when the page is hidden; the page asks again when it comes back, and lets it go when the board is left.
  Where the API is missing (iOS before 16.4, some `file://` opens) or refuses, nothing happens and nothing is said. One
  hook (`useWakeLock`, script0), called by `Battle` and `TableBoard`. Page only. Drill: page.js's wake-lock row (a
  stand-in `navigator.wakeLock` counts asks and holds across grid → trainer → hide/return → leave → AI table).
- Gates: see the release commit.

## v7.05 — Against whom?

- **Against whom (QUEUE NEXT 3, CEO).** *Against people* on the Record tab gains an *Against whom?* button (shown when a
  game is kept): a tap lists the same games by the hero ACROSS the table (`pvp.foes`, stored since v7.04, shown now),
  most games first, "vs <hero> ×n" and W–L(–D); a second tap hides it. Page only: no engine, record shape, wire or SQL
  change, so the function is not redeployed. Drill: page.js's three *against people* rows tap it (hidden before the tap,
  one row, fits 393, 44 px tap; the empty records show no button).
- Gates: see the release commit.

## v7.04 — Your record keeps games against people

- **Against people (QUEUE NEXT 3; worker AF).** A finished friendly or direct table game against a person is now kept
  on this phone too, apart from the AI's: the Record tab gains an *Against people* section (hidden when empty) — a
  total line, then one row per hero you played, most games first, a draw only when there is one. Opponents are filed
  by HERO only, never a name or id. Ranked games are NOT recorded locally (the Ranked card already lists them from the
  server, so nothing shows twice). The record's stored shape is `v:3` (`v:2` plus `pvp:{mine, foes, seen}`); v1/v2
  migrate on load with no write. Each game counts once per phone: the game's id (table + deal seeds, last 40) is kept
  inside the record and written in the same store as the count, so a rejoin, reload or replayed end state cannot count
  it twice; a rematch is a new deal and counts. The judge's-table hub device never mounts the board, so it never
  records. Drills: `test/pvprecord.test.js` (9; five sabotages), `test/airecord.test.js` on v3, three page.js rows.
  `engine/local.js` ships in the function bundle, so the function was redeployed.
- Gates: see the release commit.

## v7.03 — The wait says who else is looking

- **Who else is looking (QUEUE NEXT 2; worker AE).** A waiting *Find a match* seek now hears an approximate word from
  the referee — none / one / few (2–4) / many (5+) other live, untaken seeks of the same kind (the caller's own seek,
  stale and taken seeks left out) — and the seek card says it in plain words ("Nobody else is looking right now.",
  "Someone else is looking.", "A few players are looking.", "Plenty of players are looking."): never a number, a name
  or an id. When nobody else is looking, the card says it may be a quiet hour and offers *Play the AI while you wait*
  at once (the search keeps going) instead of after the quiet minute. Built on the existing `seek_count` (SQL 009): no
  new SQL, no new endpoint; WIRE_V unchanged (a seek answer key, not a game payload). An older function simply sends
  no word and the line is not shown. Note: a FRIENDLY seeker almost always hears "nobody", by construction — another
  untaken friendly seek would already have matched them; the bigger words appear for ranked seekers outside each
  other's rating window. Drills: `test/serverseek.test.js` (buckets, boundaries, exclusions, failures; 8 sabotages),
  three serverpage rows. Function redeployed.
- Gates: see the release commit.

## v7.02 — Your record remembers the heroes you played

- **Your heroes (QUEUE NEXT 4; worker AD).** The record kept on this phone now knows the hero YOU piloted, not only
  the AI hero you faced. The Record tab gains a *Your heroes* list under the AI record: hero, games, won–lost (a draw
  shows only when there is one), most played first. The record's stored shape is now `v:2` (`foes` as before, plus
  `mine` by your hero); a v1 record migrates on load with nothing lost — its games stay in the per-foe totals and are
  counted under an "unknown" bucket that is never shown as a hero. Nothing is rewritten on load; the next finished
  game writes v2. Local only: no wire or server change, though `engine/local.js` ships in the function bundle, so the
  function was redeployed. Drills in `test/airecord.test.js` (bump, migrate, clean, call site; each sabotaged) and
  page.js's record rows.
- Gates: see the release commit.

## v7.01 — Nine pixels at the least, and Play the AI means an AI

- **Text floor 9 px (QUEUE NEXT 3; worker AC).** Every font size under 9 px on the page is now 9 px (19 rules: the
  card-type and zone chips on cards, the hand-rail labels, empty-arsenal text, opponent-step names, loadout pane flags,
  the deck box, counters, hero life label, card-art fallback, and the rest). Nothing was shrunk to make room; tapsweep's
  overlap, clip and stolen-tap rows are clean at 393 and 320 wide. The zone chip on hand cards measured at most 66 px
  ("graveyard") inside an 80 px card. tapsweep's `TEXT_FLOOR` now defaults to 9; `TEXT_FLOOR=10` is its sabotage.
- **Play the AI no longer offers the Dummy (QUEUE NEXT 2; worker AB).** Coming through the title's *Play the AI* door,
  the opponent step shows only the random tile and the heroes. The Dummy door still skips the step, and with the title
  skipped (`?title=0`) the Dummy tile is still offered. Every page drive now picks opponent tiles by their label, not
  by position (page.js, tapsweep, promptsweep, page-audit); new page.js rows at both widths, sabotaged.
- Gates: see the release commit.

## v7.00 — A text floor on the board, and a page of your own record

- **The text floor (QUEUE NEXT 1).** The smallest text a player is asked to read is now 8 px. Measured on the real
  board at 393 and 320 wide: only the card-type chip was under it (7 px on hand cards, 6 px on small ones). At 8 px
  it is wider than the gap between a card's power and defense badges (it already covered their edges at 6–7 px), so
  on a card that prints either it now sits just above them; a card with neither keeps it at the bottom. Zero
  overlaps at both widths. Gated: tapsweep's new `text floor` row fails any text under 8 px on every swept screen
  (both sizes); `TEXT_FLOOR=9` is its sabotage and fails on 48 texts.
- **Your record (QUEUE NEXT 3).** A fourth door under the title's modes (the four now sit two by two) and a *Record*
  tab: the record against each AI hero kept on this phone (Sharp and Steady together, most games first, with a
  total), how many heroes have cleared the Dummy, and, for a phone with a server sign-in, *Show my ranked games*:
  rating, ladder place or game count, won–lost, a line of the rating over the last ranked games (read backwards from
  today's rating, one point per game) and the heroes played most. No new table and no new request shape — it reads
  the ladder answer the Ladder already reads, and only on the button; opening the page asks nothing of the server,
  and a phone with no sign-in is told how to get a rating. page.js and serverpage rows drive both, each sabotaged.
- Not changed, on purpose: *Play the AI*'s opponent step still offers the Dummy tile (harmless; a dozen drives pick
  tiles by position).
- The page builds the server's transport in one place (`srvTransport`), which the table screen and the ranked card share.
- Gates: npm test 4609/4604/0/5; page.js 295/295; serverpage 488/0; four babel blocks compile. trainchaos not run
  (no trainer logic changed; the board change is CSS).

## v6.99 — A title screen, and you know your opponent before you sideboard

- **The title screen (user request; worker Z).** The page now opens on a title: the DAWNBLADE wordmark, one line saying
  what this is, and four big choices, each with a one-line description: *Train against the Dummy*, *Play the AI*,
  *Find an opponent* (online, friendly or ranked, and the ladder) and *Two phones, one table* (a direct table, or judging
  one from a third device). *How to play*, *Judge's quiz* and *Trophies* sit beneath, and the format note moved here.
  The two table choices open only their half of the table screen; every screen has a *‹ Title* way back. It shows on
  every load, asks nothing of the server while a player only looks, and practising while a search runs still lands on
  the hero grid. `?title=0` skips it (the drives use it).
- **The opponent before the sideboard (user request; worker Y).** The opponent has its own step after *Battle*, before
  the throw and the sideboard: the Dummy, a hero, or Random — drawn the moment it is tapped and named ("Your opponent:
  <hero> — drawn at random"), and that same hero is the one dealt, so you board knowing the matchup and the play or draw.
  The sideboard shows the chosen foe with a quiet *Change opponent*; Sharp / Steady moves to the step and is still
  remembered; the opponent is still not remembered between matches. The networked sideboard is unchanged.
- **Joined (CEO):** *Play the AI* opens the step with a random hero already drawn and named; *Train against the Dummy*
  skips the step and goes straight to the throw (Back returns to the hero grid); with no mode chosen the step opens on
  the Dummy. page.js rows prove all three at 393x852 and 320x568, each sabotaged.
- **The found-match window's silence path is driven (worker AA):** serverpage closes the practising player's page
  mid-window and the waiting player is back looking (same kind, clock carried on) within window + 10 s. The found
  window and the rematch wait read one 2-minute constant; no behaviour change.
- Gates: npm test 4609/4604/0/5; page.js 286/286; serverpage 483/0; trainchaos clean; four babel blocks compile.

## v6.98 — The found-match window is honest on both sides

- **What was wrong (worker X).** A player practising against the AI when a match was found is the table's creator, so
  the matched player sat alone in an empty lobby with nothing but "may have dropped" after 45 s; if the seat was ever
  given back they read "This phone's seat at the table is gone" with no way back to looking. The banner itself never
  expired and had no way to say no.
- **The practising player:** "Your match is ready — join within 1:42" counts down live beside *Join them* and a quiet
  *Not now* (both 44 px). *Not now*, or the clock reaching 0:00, closes their table through the existing close (a ranked
  table not yet dealt closes with no result) and a short bar says the match was given back and the opponent has gone
  back to looking (hides after 12 s). One constant drives the window, the title flash and the expiry (2 minutes).
- **The waiting player:** the lobby says their opponent was practising and has up to 2 minutes to take the seat. When
  the table closes — or the window plus 10 s passes with nobody heard, as when the other page was closed — they go
  straight back to the search card, same kind (ranked or friendly), and their waiting clock carries on. The table channel
  gains `refresh()` so the close is noticed within about 3 s. No SQL: the server queue position is not kept (the waiting
  player was matched on arrival, so there was little to keep).
- serverpage.js: a new block drives *Not now*, the expiry and the other side re-seeking, each sabotaged.

## v6.97 — The server screens are readable too

- **Contrast on the server screens (worker W).** `tools/serverpage.js` now runs v6.94's contrast judge at 393x852 and
  320x568 on the hands sheet, the players-looking line, the waiting card and its clock, the usual-wait line, the practice
  bar while still looking, the match-found banner, the rematch ask / waiting / table-cap Close / Ask again, and the
  Ladder with and without *Your last ranked games*: 18 `readability` rows and a sabotage row (seek-card text painted the
  line colour must be caught).
- **Two fixes.** "Your open tables are full…" read 3.92:1: the red text ink `--rt` #EC6560 -> #F5817B (about 5.1:1;
  every red word gets a touch lighter). The coin-toss note under the practice game read 4.2:1: its inline opacity .65 -> .8.
- **Reported, not gated:** text under 10 px on these screens is the board's own small labels showing under the end panel
  (life, arsenal, card-type badges), not the server screens' copy.

## v6.96 — A found match you can't miss, and your own ranked history

- **Match found while practising (QUEUE item 3, worker T).** A new `found` cue in the sound module (two rising sine notes,
  660 -> 880 Hz, about half a second; follows the sound toggle, on by default) plays when a match is found, beside the
  existing short buzz. If the player was practising against the AI, the tab title alternates "Match found! · Dawnblade"
  with the real title every second while the tab is hidden, and is restored exactly when the tab comes back, the player
  joins, the screen closes, or the two-minute window ends. Once per match; never for the AI game's own sounds or on the
  first screen. A match that seats the player at once keeps the old five-second title, now with the chime. serverpage.js
  gains rows for every stop path, each sabotaged.
- **Your last ranked games on the Ladder (QUEUE item 5, worker V).** A named player sees "Your last ranked games" under
  their own line: up to 10, newest first, each from their seat ("Won with Kayo against Dash", the opponent's name, how it
  ended, how long ago) with a signed rating move (+16 / −14 / ±0, labelled, not colour alone). No games yet: one warm
  line. Unnamed or signed out: nothing new. The global `recent` list could not give this (it is everyone's and carries no
  rating move), so **SQL 012** replaces `ladder_get` (same signature; adds `mine` for a named caller; no new table, 006's
  indexes serve it), proven on PGlite twice and by `tools/sql-sab-012.js` (15 sabotages); `server/referee.js` validates
  and rebuilds `mine`; the Deno rehearsal passes both variants. The function and the SQL may land in either order.

## v6.95 — The trainer's prompt sheets, swept like the table's

- **A drill door into the trainer (QUEUE item 2, worker S).** A page opened with `?drill=1` gets `window.__battle`
  (read the live state; raise a real `prompts.js` spec through Battle's own `openPrompt`). Without the flag the effect
  returns before touching anything; a page.js row proves the normal page carries no handle.
- **`tools/promptsweep.js --trainer`:** all 8 prompt kinds, longest realistic lists, 17 heroes, 393x852 and 320x568 —
  612 sheets, 0 findings. No CSS was needed: v6.93's scrolling-list rule already reaches the trainer's sheet. page.js
  gains 3 rows (no handle without the flag; 18 injected trainer sheets at 320 clean; a sabotage fails 4 of 4).
- **A weekly sweep (QUEUE item 6).** `.github/workflows/tapsweep-weekly.yml` (Mondays, plus a manual dispatch; no
  secrets, no live wire; page deps into the runner's temp dir) runs the tap sweep and both prompt sweeps. Its first run
  proves the install step.

## v6.94 — Every word on every screen is readable

- **A contrast measure on the real page (QUEUE item 4, worker U).** New `tools/contrast.js` takes each text element's
  computed colour (alpha and ancestor opacity folded in) and composites the real background under it (walks up to the
  first opaque layer; a gradient is judged at its worst stop). WCAG AA: 4.5:1, or 3:1 for large text. The tap sweep
  runs it on every screen it visits (22 per phone, at 393x852 and 320x568), one `readability` row each; page.js holds a
  sabotage row (a dimmed roster must be caught). Skipped and counted: disabled controls, text over art, clipped text,
  glyph-only text.
- **Before: 12 of 22 screens failed per phone.** Red and blue words on the forge panels read 2.7-3.3:1; bone text on
  the red buttons 4.18:1. **After: 0 of 22.**
- **Fixed in the tokens, not per element.** `--r` (fills) #C4302B -> #BA2C27; new text inks `--rt` #EC6560 and `--bt`
  #6595D2 for red and blue words (every text `color` that read `--r`/`--b` now reads them; fills and borders keep the
  originals); `--fs-xs` 9px -> 10px. There is one theme, so one pass.
- **Not yet measured:** the server screens (seek card, practice bar, rematch, ladder) — serverpage.js does not run the
  sweep. Text under 10 px (literal sizes on mini-card faces and small labels) is reported with `READ_SMALL=1`, not gated.

## v6.93 — Every prompt kind, every hero, forced onto a small screen

- **`tools/promptsweep.js --inject` (worker R).** The sweep plays a real table game to seat 0's first move. The answer
  carries a state whose prompt queue holds a real `prompts.js` spec, built from that hero's own deck cards through
  `openPrompt`/`buildPrompt`, with the longest realistic lists:
  - opt 4 (reorder and send down);
  - pick 8;
  - modal 3, with decline;
  - pay 3, unaffordable;
  - reveal 7 and 1;
  - target 6 and 2;
  - alloc over 5;
  - soak 4 and 1.

  That is 18 sheets per hero, 17 heroes, at 393x852 and 320x568: 612 sheets, all clean after the fix. All 8 prompt kinds
  are now covered for every hero.
- **The one real failure: CONFIRM pushed off screen.** A soak with 4 barriers at 320x568 drew 472 px of content in a
  364 px sheet, and nothing scrolled. The sheet's list now scrolls (`.psheet .pmodal`), and the header and the action
  row stay put.
- **tapjudge.** A control half-hidden by a scroller is judged on its drawn size, as its header always said.
- **A page.js drill:** 18 injected sheets at 320, 0 findings, plus a sabotage (the list stops scrolling and the options
  shrink) that fails 4 of 4. page.js is now 153 screens.

## v6.92 — Every prompt sheet holds the tap floor, hero by hero

- **The prompt sweep (QUEUE item 6, worker R).** New `tools/promptsweep.js` plays real table games, with seat 0 against
  AI foes at engine speed, and stops on every prompt the page would show. It also plays trainer games by random taps.
  It judges each first sheet per hero, board and kind, at 393x852 and 320x568:
  - the tap judge (44 px floor, stolen taps, overlap);
  - nothing off-screen and no sideways scroll;
  - a tall sheet scrolls;
  - no text under 9 px outside a card face.
- **Fixes it found:** all CSS, no JSX.
  - Prompt options drew 42 px; now 44.
  - The opt reorder arrows were 38x30; now 44x44, in a column widened from 86 to 94.
  - Prompt tags were 8.5 px; now the xs font size.
  - The card-zoom modal sat under an open prompt sheet, hiding its CLOSE; it now sits above.
- **The jump row's 43 px was real, not a probe artifact.** The `::after` inset counts from the padding box, so the 1 px
  border cost 2 px. It now measures 45 at quarter-pixel steps at both sizes.
- **Coverage.** All 17 heroes on the table at both sizes.
  - Reached: pay, pick, modal, opt, soak.
  - Not reached by any hero in self-play: reveal, target, alloc. They need a state-injection harness; it is in QUEUE.
  - Trainer sheets were reached for 4 heroes; all clean.
- Gates: tapsweep 44/44, page.js 133/133, serverpage 401/0.

## v6.91 — The practice bar says how long players wait; room to grow

- **The typical wait on the practice bar too (worker Q).** While a player practises during a search, the *Still
  looking* bar carries the same quiet line as the seek card: *Players usually find a match in about N seconds*.
  - App holds the number and `TableScreen` reports it up, so one source feeds both screens through one sentence helper.
  - serverpage rows at 393 and 320, sabotaged: removing the line fails exactly those 4 rows.
- **livecheck's wait-log cleanup is pinned.** `probeWaitQuery(t0)` builds the delete. `test/livecheckwait.test.js` pins
  its shape: friendly only, 2 s or less, since the probe began, one statement, no OR. 7 sabotages each fail it.
- **The trainer's babel block is split in three (worker P).** Q's line pushed it past Babel's 500,000-character limit.
  It is now three consecutive blocks cut at top-level function seams, with no code moved:
  - **trainer:** about 331k characters;
  - **server table UI:** about 158k;
  - **App plus the mount:** about 12k. The mount stays last.

  `test/html-balance.test.js` checks the layout:
  - exactly 4 blocks, each balanced;
  - every block at most 450,000 characters;
  - the mount exactly once, in the last block.

  Both new guards are sabotaged. Load time at 4x throttle did not change beyond noise: a median of 12.1 s and 12.7 s
  before, 12.8 s and 12.5 s after.
- **A rule for new page code:** a top-level statement may use only names from earlier blocks. Component references are
  render-time, so they are fine. Put new components in the smaller blocks.

## v6.90 — Close a full table right on the rematch screen

- **The cap no longer strands a rematch (worker P, the v6.87 follow-up).** When a rematch is refused because the
  player's open tables are full, the end screen now lists those tables, each with a 44 px *Close* button.
  - *Close* first warns that it counts as a loss if that table is a ranked game under way, with *Yes* and *Keep*.
  - *Yes* closes that one table. The main button then reads *Ask again*, and the rematch opens without leaving the screen.
  - Under the hood it is `servertable` `handle.closeOwn(code)`, the existing close path. No referee change.
  - serverpage: 16 new rows at 393 and 320; 392 rows pass.
- **Feed voice audited (worker O).** All 19 second-person literals in `effects.js` are prompt text addressed to that
  side, refusals returned to the actor, or code. None is a feed line, so the pin stays at 19 and the drill records the audit.
- **Watch: the trainer's babel block is at 499,004 characters.** Babel deoptimises above 500,000, and that console
  error crashes the page drives. A retired comment was trimmed to make room (history in LESSONS.md), and
  slicecensus's dummydefence slice was repinned to 8643. The next page addition must make room first (QUEUE).

## v6.89 — Find a match says how long players usually wait

- **Matchmaking visibility (QUEUE item 5, worker Q).** The *Finding a match* card shows one quiet line under the
  clock: *Players usually find a match in about 50 seconds* (from 90 s on it says minutes).
  - **Where the number comes from.** It is the median wait of the last 24 hours' completed seeks of that kind (ranked
    and friendly counted apart), rounded up to 5 s.
  - **When it hides.** With fewer than 5 completed seeks it shows nothing rather than a made-up number. It is gone
    when the search ends.
  - **No new request.** It rides the existing seek and heartbeat answer (`typical`), and the first screen still makes
    no request while a player only looks.
- **`server/supabase/011_seek_wait.sql`** (run on live 2026-11-24): `seek_wait_log` holds only the kind and the
  seconds (no player, no table; RLS forced). A trigger on `seeks` fills it the first time `taken_at` is set, and
  `seek_step` is untouched. Rows prune at 7 days. Cancelled and stale seeks are never counted.
  `seek_wait_stats(p_ranked) -> {n, typical}`.
  - The referee adds `typical` only for a sane answer. A missing table, an error or nonsense means no key, and the
    seek never fails because of it.
  - `tools/sql-sab-011.js`: 15 sabotages, all caught. PGlite runs 001..011. Deno rehearsal passes in both variants.
    The serverseek drill gains row 10.
- **Not built, deliberately:** "players looking near your rating". While you wait, anyone inside your window would
  already have been matched, so that count would always read 0.

## v6.88 — Practice while waiting: tidy, and measured

- **Tidy (QUEUE item 3, worker O).** While the *Still looking* bar is up, the practice hero grid no longer carries the
  lobby's format note or *How to play* underneath. serverpage +3 rows: both are out of sight, and the practice screen
  passes the tap judge at 393 and 320 (44 px floor, no overlap, bar and back button on screen, no sideways scroll).
  Sabotaged: with the guard removed, the note row and the 320 row fail.
- **Measured (item 2).** New `tools/perf-practice.js` (not in npm test): 4x CPU throttle, 120 taps of one seeded
  trainer game with the seek heartbeating. Per-tap main-thread ms, p50/p95/worst:
  - no search: 27/102/156;
  - the real 20 s heartbeat: 30/90/209;
  - a 2 s heartbeat (10x the real rate): 29/80/138.

  All inside run-to-run noise. Every long task came from the game's own moves; none came from a beat. A beat on the idle
  grid costs about 6 ms/s and causes no DOM mutations. The *match is ready* banner costs about 50 ms, with no long task.
  Nothing needed fixing.

## v6.87 — Leaving takes the rematch ask back; a live rematch probe

- **Leave takes the ask back (QUEUE item 4, worker P).** Every *Leave* button on a finished server table now withdraws
  a pending rematch ask at once (`servertable` `close()` sends `op:"rematch", cancel:true`, best effort). The other
  player's end screen stops saying "they want a rematch" right away. Before, the ask went stale only after two minutes.
  No referee change: cancel and its push already existed.
- **The full-tables refusal reads plainly.** A ranked player at the open-table cap who says yes to a rematch is told:
  *Your open tables are full… Close one from Find an opponent, then you and your opponent can ask for a rematch again.*
  serverpage "rematch cap" rows (5 filler tables, no new table opened, the button keeps its 44 px).
- **`tools/rematchprobe.js`.** Two scripted seats go through a whole rematch over HTTPS: concede, ask, the other seat
  learns on resync, the asker leaves (ask withdrawn), re-sits, both ask, the same new code, both sit, every table closed.
  livecheck.js and the Deno rehearsal (both variants) run it. `test/rematchprobe.test.js` runs it offline, sabotaged.
- Follow-up (open): inline *Close* buttons for the cap's open codes in the rematch row (the refusal already carries them).

## v6.86 — The tap is never lost: a 44 px floor on every screen, and an end panel that scrolls

- **POLISH.md condition 1, swept (NEXT 5 and 6).** Every screen was measured at 393x852 and 320x568 by the area a tap
  actually hits (`elementFromPoint`, so an `::after` hit area counts), not by the drawn box. Hit areas raised to 44 px:
  - the tab bar: 34 px (its padding moved into the buttons; the bar is still 47 px);
  - the quiet big buttons and the sheet's CONFIRM: 40–42 px;
  - the judge quiz's options and *back to roster*;
  - the hero sheet's keyword chips: 26 px;
  - the sound button: 33 px wide at 320;
  - *✕ clear fighter*: 12 px, now an `::after` hit area;
  - the dummy slot's ✕✕;
  - the status line's SKIP / ✕ CANCEL: 34 px;
  - JUDGE!!.

  *✕ LEAVE* no longer spills its box at 320. All of it is one CSS block; no JSX changed.
- **The end panel scrolls when it has to.** At 320x568 a ranked end panel (rating change, Rematch, Find another match,
  Verify, Leave) no longer fits. `.reveal` was fixed, centred and unscrollable, so the title went above the screen and
  *Leave* below it, with no way back. It now scrolls: centred when it fits, top-aligned and scrollable when it does not.
- **Tools:** `tools/tapjudge.js` measures hit areas, stolen centre taps, clipping and overlap, with scroll passes.
  `tools/tapsweep.js` walks every screen (~2 min). `tools/page-audit.js` takes AUDIT_W/AUDIT_H. UI-GUIDE.md notes the floor.
- **Drills:** `tools/page.js` +44 rows (22 screens at two sizes). `tools/serverpage.js` +10 rows: the ranked end panel at
  320 for the creator and the joiner, plus one injected extra button, so the panel must scroll. Sabotage: with the CSS
  reverted, 26 tap-floor rows fail; with the panel's scroll removed, both extra-button rows fail. Worker M built it.
  `test/slicecensus.test.js` is 94,193.
- **Validation:** npm test 4589 / 4584 pass / 0 fail / 5 skipped; both babel blocks compile; `tools/page.js` 133/133 screens;
  `tools/serverpage.js` 364 / 0. No engine, rule, wire, AI or SQL change.

## v6.85 — Waiting is lonely: play the AI while Find a match keeps searching

- **Play the AI while you wait (NEXT 2).** A player who has waited a minute on *Find a match* with nobody around now sees a
  calm line ("Nobody has sat down yet…") and a button: **Play the AI while you wait**. It opens the hero grid with a *Still
  looking for a match* bar and a way back to the search. The search keeps running behind the practice game: the same ~20 s
  heartbeat, no new requests, and the screen's one-second clock pauses while hidden. `TableScreen` stays mounted and hidden;
  nothing is lifted to App. When a match arrives mid-practice, a banner, **Your match is ready — an opponent is waiting**,
  sits over the game with **Join them**. The practice game is never taken away on its own. An unanswered match behaves
  exactly as it does today: 009 has no acceptance timeout, so the table stays open with both chairs held. The waiting clock
  (m:ss) was already in. The 60 s threshold reads `window.SERVER_TABLE.quietMs`, so the drives can shorten it. Worker N
  built it.
- **Drills:** `tools/serverpage.js` K1b, 11 rows: no offer before the quiet minute; the offer is thumb-sized and plain; the
  search survives practice; the banner lands over the game; an ignored match stands; Join them reaches the lobby on both
  phones; no errors. Sabotaged twice and seen to fail: the 60 s gate removed, and banner delivery made immediate.
  `test/tapdoor.test.js`'s plain-arrow count is 20 (the Join them button). `test/slicecensus.test.js` is 92,440 with
  v6.83's CSS.
- **Open:** the phone cost of practising while the search heartbeats was reasoned, not measured: one POST per ~20 s plus
  the channel's existing poll. A 4x-throttle number is still worth taking. The hero grid in practice mode still carries the
  lobby's format note and How to play below the grid.
- **Validation:** npm test 4589 / 4584 pass / 0 fail / 5 skipped; both babel blocks compile; `tools/page.js` 89/89 screens;
  `tools/serverpage.js` 354 / 0. No engine, rule, wire, AI or SQL change.

## v6.84 — Ranked pairing by rating: a window that widens while you wait

- **Ranked pairing by rating (NEXT 3).** Find a ranked match paired the oldest seeker first, whatever the two ratings.
  `server/supabase/010_rating_window.sql` replaces `seek_step`. Now a ranked seek pairs only with a ranked seek whose rating
  is within a window: ±100 at first, +50 for every 20 s waited. The window uses the **longer** of the two waits, so a fresh
  arrival's narrow window never holds back someone who has waited longer. From **180 s** of waiting it **opens fully**
  (CEO decision, a default the user may overrule: a small community needs a game more than a perfect pairing). Among
  seekers inside the window, the oldest goes first, under 009's lock. An unrated player counts as 1200. Friendly seeks are
  unchanged. The function's calls are unchanged; the rule lives in SQL alone. **Run on the project 2026-11-24, before this
  function.**
- **livecheck knows Rematch.** Its queue check now sits the first seeker down and asks for a rematch before any game. The
  live function answers `rematch-playing` and writes nothing. That proves the deployed referee carries v6.83's op.
- **Drills:** a self-check inside 010 (the window's numbers, 400 apart not paired at once or at 100 s but paired by 140 s,
  600 apart paired only once it opens). `tools/sql-sab-010.js`: 15 sabotages, all caught (window ignored, never widens,
  never opens fully, opens at 300 s, casual windowed, narrower of the two waits, either wait ignored, unrated as 0, newest
  first, kind ignored, a taken seek re-matched, a 10 s step, base 200, anon may call). `test/serverseek.test.js` drill 9
  over the mirrored fake queue (`serverfakes.withSeek` with `rate`): 400 apart pair only after enough heartbeats, 50 apart
  at once, friendly 400 apart at once, 1000 apart not at 160 s but by 180 s. 3 sabotages each fail it. Worker L built it.
- **Validation:** npm test 4589 / 4584 pass / 0 fail / 5 skipped; both babel blocks compile; PGlite 001..010 ok, sql-sab-010 15/15 caught. Page unchanged but for APP_VER; no engine, rule, wire or AI change.

## v6.83 — Rematch: both players say yes, and the same two sit down again

- **Rematch (NEXT 1, second half).** A server game's end screen now offers **Rematch** above *Find another match*. One tap
  asks. The other player's phone hears it from a sealed push: "*Rival One* wants a rematch." Their button becomes
  **Rematch — say yes**. While a player waits, the screen says so with a calm two-minute count and offers *Take it back*.
  When both have said yes, the referee opens a **new table of the same kind** (ranked after ranked, friendly after
  friendly), hands both phones its code, and both phones sit down there by themselves: back to the hero pick, both seed
  halves fresh. A ranked rematch is a new ranked game, recorded under its own game id. If the other player does not answer
  within two minutes, the ask is taken back on both sides and the screen says so plainly.
- **The referee (`server/referee.js`, `op:"rematch"`).** Who may ask: a seat with its own key, once the game is over (read
  from the rehydrated hub, so a casual table whose row never says `over` works too) and once both chairs were dealt. The row
  keeps `rematch:{at:[ms|null, ms|null], table|null}`. An ask older than `REMATCH_MS` (2 min) is forgotten. The player who
  completes the pair opens the new table: with a sign-in it counts against their open tables (005) like any table they
  open; a ranked rematch needs that sign-in. A friendly table nobody signed in to rematches as a casual table. A lost
  version race answers `conflict` and closes the table it had just opened (nobody holds its code). Every join and resync
  answer carries `rematch:{want, table}` once anybody has asked, so a missed push heals on the next resync. No SQL change.
  No WIRE_V bump: the game's wire payload is unchanged. The new push rides its own sealed channel (`rematch`), which an
  older page skips like any channel it does not know.
- **The phone (`engine/servertable.js`).** `rematch()`, `onRematch(fn)` and `askRematch(cancel)`. The push is read on its own
  channel, and join and resync answers are read too. A known code is never taken back.
- **Drills:** `test/serverrematch.test.js` (7 checks over the referee: both ask, one new table of the same kind, the same
  code for both, both chairs taken there, its own game id; mid-game, wrong key and a ranked rematch with no sign-in are
  refused and write nothing; asks go stale; cancel; resync carries the state; a casual rematch; a lost race closes its
  orphan). Each check has a sabotage that fails it. `test/serverrematchphone.test.js` plays two phones over the real
  referee: the ask arrives by push alone; both phones hold the new code; the rematch is dealt, conceded and recorded as a
  second ranked game, both ratings moved twice; a dropped push heals on a resync. Sabotaged three ways.
  `tools/serverpage.js` +10 rows (RM): the button and its place, the opponent's ask and take-back seen on the page, the
  waiting words and count, no table opened on one ask, the page sitting down at the new ranked table by itself, no jargon,
  no overflow.
- **Every secondary big button is thumb-sized.** `.bigbtn.alt` (*Find another match*, *Take it back*, *Verify this game*, and
  every other quiet big button) was 42 px tall; it now has a 44 px minimum (POLISH.md condition 1). The rematch drive's thumb
  rows found it: they failed at 42 px and pass at 44. `test/slicecensus.test.js` repins one slice (phasebar's, +73 characters:
  the CSS).
- **Validation:** npm test 4588 / 4583 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile;
  `tools/page.js` 89/89 screens; `tools/serverpage.js` 343 / 0. No engine rule, wire, AI or SQL change.

## v6.82 — Find an opponent is short: the honest lines are one sheet

- **How each table keeps hands hidden (NEXT 4).** Four paragraphs sat under *Find an opponent*'s buttons: the "two real hero
  decks" note and three honest lines saying who holds the deck at a server, direct and judged table. The three honest lines
  are now one sheet behind a quiet button (*Who can see your hand? How each table keeps hands hidden*), in How to play's
  style; their words are unchanged. The screen is now the choices, and the honest lines are one tap away for every player.
  The "two real hero decks" line stays on the screen (`test/tablecopy.test.js` reads it).
- **Every sheet's button row is thumb-sized.** `.bugrow .bigbtn` (*Got it* on How to play and the new sheet, the JUDGE!!
  sheet's buttons) was 37 px tall; it now has a 44 px minimum (POLISH.md condition 1). The new sheet's drive found it.
- **Drills:** `tools/serverpage.js` +3 rows and 1 rewritten (closed, the screen holds none of the three honest lines and
  offers the button; open, all three are there, inside 393 wide, every button thumb-sized; Got it closes it); the door's
  jargon row reads the sheet, and now fails if the server line is missing instead of passing on an empty match.
  `tools/page.js` and `tools/twophone.js` open the sheet before they read the judged table's line. Sabotage: with the sheet
  never rendered, the sheet rows fail.
  `test/slicecensus.test.js` repins one slice (phasebar's, +16 characters: the CSS line).
- **Validation:** npm test 4580 / 4575 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile;
  `tools/page.js` 89/89 screens; `tools/serverpage.js` 330 / 0. No engine, rule, wire or AI change.

## v6.81 — Play again: one tap from a server game's end screen back into the queue

- **Find another match (NEXT 1, first half).** A server game's end screen now offers **Find another match** (or **Find
  another ranked match** after a ranked game) above *Leave the table*. One tap leaves the finished table and opens the
  server table screen already searching for the same kind of match; *Stop looking* lands on that screen with the switch
  still on Ranked. Before this, a player walked back through three screens. Only the page changed: a finished table no longer
  counts toward the open-table cap (005), so the new search is never refused because of it, and the queue is 009's. The
  other half of NEXT 1, a *Rematch* at the same table that both players agree to, needs the referee and is still open.
- **Fixed in the tools (the v6.80 open finding):** `tools/serverpage.js`'s card-database probe now sums three seeded games
  (`probe`, `probe-1`, `probe-2`). The single seed's game no longer reached a token made through the database, so the
  sabotage read 0 missing; the three together read 3 missing with the sabotage on and 0 with it off.
- **Drills:** `tools/serverpage.js` +6 rows in the ranked drives (the button and its words on a ranked end screen; one tap
  queues a RANKED seek with the waiting card up and nothing queued before; Stop looking leaves the queue and keeps Ranked).
  The ranked fake world now also carries the queue (`withSeek`).
- **Validation:** npm test 4580 / 4575 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile;
  `tools/serverpage.js` 326 / 0 (sabotage: with the button not passed to the board, 7 rows fail). No engine, rule, wire or AI
  change: no ladder, no chaos.

## v6.80 — Find a match: the server pairs you with the next player looking

- **Matchmaking (SERVER S6.1).** *Find an opponent* now leads with **Find a match**, and the server table screen offers it
  too (**Find a ranked match** with the switch on). The referee keeps a queue (`op:"seek"`, `server/supabase/009_seek.sql`):
  with nobody waiting, the function opens a table for the seeker, who sits in chair one and waits on a ticking clock (asking
  again every 20 s; a seek not seen for 60 s is forgotten); the next seeker is sent to THAT table and both phones reach the
  lobby together. Ranked never meets friendly, and a ranked search needs a player name like any ranked table. *Stop looking*
  leaves the queue and closes the waiting table; a seek already taken is not cancelled (the phone is told where to go).
  A queued table that closed meanwhile is never handed out; two seekers who both found the queue empty are joined on the next
  heartbeat (the newer one's table is closed). `op:"looking"` is a public count, shown as "1 player is looking for a match
  right now" when the screen opens. A found match buzzes the phone where it can and flags the tab title for five seconds.
  The queue is one table and three service-role functions under one advisory lock; run on the live project (self-check `ok`
  twice on real Postgres) before the function. No rating window yet (oldest seek first).
- **Drills:** test/serverseek.test.js (8: the meeting, kinds, cancel, the heartbeat's table, stale matches, the race, the
  edges, the count; each sabotaged). `tools/sql-sab-009.js`: 15 sabotages of the SQL, each caught by its own self-check.
  `tools/serverpage.js` gains 22 rows (two real pages meet through the queue; Stop looking; ranked beside friendly; the
  nameless refusal; two page sabotages seen; the count is read on the server table screen only, so the first screen still
  makes no request while a player only looks). `tools/livecheck.js` gains a live match through the queue (two signed-in
  phones; the table is closed after); `tools/supabase-rehearse.js` runs it against the generated function.
- **Fixed in the tools:** `tools/supabase-rehearse.js`'s forfeit phase aged a table 301 s against a limit that is now 450 s
  (it failed on clean v6.79); it now reads the referee's `FORFEIT_MS`.
- **Direction (user, 2026-11-24):** the AI logic goes on the back burner; graphical UI/UX polish and matchmaking lead.
- **Open finding (not this release):** `tools/serverpage.js`'s card-database probe ("a token goes missing when the judge has no
  database") reads 0 missing: its seeded Viserai game, played by the rule policy, no longer reaches a token the sabotage removes.
  The probe needs a new seed or a direct token check.
- **Validation:** npm test 4580 / 4575 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; PGlite 001..009 twice `ok`;
  `sql-sab-009` 15/15; Deno rehearsal single + folder ALL PASS; `tools/serverpage.js` 319 / 1 (the probe above); both babel
  blocks compile. No engine rule or AI change: no ladder, no chaos.

## v6.79 — the AI weighs every target for an attack (search shape, measured)

- **AI strength (Sharp): every attack from hand or arsenal is also proposed at the hero and at each of the opponent's
  allies** (`SPXLATGT`, `laCands`). An attack's target is declared as it is played (CR 1.4.5); the rule policy's
  `targetFor` names one (the ally the swing can kill, else the hero) and the search proposed only that one, so it never
  asked whether the face beat a killable ally, or whether chipping an ally beat the face. The rule's pick still comes
  first, so A0 and its ties are unchanged; each extra declaration is one more rollout inside the same step budget (the
  phone bound is a step cap, so the v6.78 timing holds by construction). A/B, each hero's own seat against every hero:
  seeds 0-11 1590 -> 1609, seeds 12-23 1655 -> 1664 (+28 of 6528, both samples positive, no hero down by more than 3;
  bravo +7, blaze +3, azalea +6). A fresh base from the probe engine reproduced v6.78 game for game (890 = 890), so the
  first sample is clean. Drill test/latarget.test.js (no ally: one declaration; an ally out: both; sabotaged with the gate off).
- **Search levers measured and NOT taken** (evidence `experiments/search-shape-v678b/` on findings/queue; a new `laX`
  probe overrides any `LA` field for one hero's seat): horizon "opp" at the new budget -53 on 9 heroes (Kayo -24) — dead;
  held-card worth 1.0 -9, 2.25 +29 then -25 (24 seeds +4) — flat; a gear term in the score (standing equipment defence,
  mine minus theirs) +13 then -17 — flat.
- **Chaos d12 and d13** (289 games each; 32,559 and 32,627 random legal moves): 0 findings.
- **Validation:** npm test 4572 / 4567 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games 0 refusals /
  violations / stalls (3 draws).

## v6.78 — the AI thinks twice as far on its own turn (the speed headroom spent on strength)

- **AI strength (Sharp): the own-turn action search gets 600 engine steps per decision, not 300** (`LA.budgetOwn`, env
  `SPXLA_BO`; the defend-step search keeps 300). A larger budget only spends steps where 300 used to give up and let the rule
  policy's move stand. A/B, each hero's own seat against every hero, 24 seeds (two honest samples of 12 — `TOURNEY_S0=12` is new in
  `tools/tourney.js`): 300 won 3215 of 6528, 600 won 3300; both samples positive (+44, +41), no hero down by more than one game; Fai
  +23, Gravy +18, Azalea +16, Dash +12, Arakni +7. Two determinizations at 600 won about as much (3303) for twice the steps and cost
  Arakni 18 (215 -> 197): not taken. Every arm 0 refusals / violations. **Phone bound still met** (page, 4x CPU throttle, one cloud box,
  80 own + 80 opp positions per hero): max p95 110 ms (arakni; own-turn max p95 123, fai), worst 194 (dorinthea, a defend step);
  bound 150 / 400.
- **A drill that a budget bail-out was passing.** "Sharp does not bin a known arrow for a flip that won on one deal" held on az6
  only because the four-deal check ran OUT of its 300 steps (A0 stood by default): with room to finish, the flip held on 4, 6 and 8
  deals there. The fixture is now az10, where the verify itself turns the flip down, and the drill asserts `over` 0 and
  `unverified` >= 1 (sabotaged: at 300 steps it fails on the bail-out). The explain memo key now carries `budgetOwn`.

## v6.77 — the AI thinks a third faster, every decision unchanged; the shared feed's last "you" is gone

- **AI speed (phone bound), decision-identical.** `types.cardType` is memoised per card object (a WeakMap, re-used while `tt`/`ty`
  are unchanged) — it was the top hotspot (~18% self time) of Sharp's rollouts — and `parser`'s pure string readers `norm` and
  `clean` share a bounded Map memo. Sharp's budget counts engine steps, never time, so nothing it decides can move: the full action
  log (sha256) of 4 heroes x 3 seeds is identical before and after, as is the 816-game ladder; one full `npm test` ran with a check
  that every cache hit equals a fresh parse. On one cloud box (node, no throttle), 4,474 Sharp decisions: total 16-17 s -> 10.5-11.5 s;
  own-turn p95 19 -> 12-13 ms, opp-turn p95 31-33 -> 19-22 ms; worst ~unchanged (noisy). The real-iPhone measurement is still open.
- **Feed voice (POLISH.md condition 2).** The 20 second-person literals in `effects.js` were classified one by one: 11 prompts
  addressed to one side, 5 refusals, 3 code (inflection), and ONE feed line — an ally hit quoted "the next time you hit a hero";
  it now reads "<card> hit an ally — a waiting grant for hitting a hero still waits." The drill's 20/12 ceiling is now an exact
  allow-list (kind + count per literal): any new second-person literal fails it, as does an entry that stops matching. judge.js's 20
  such literals are all refusals returned to the actor.
- **Chaos d11** (salt d11, 289 games, 33,504 random legal moves; and EPS=0.6, 105,693): 0 findings. **trainchaos** 54 games, every
  hero: clean.

## v6.76 — the Coach says "activate the Cloak first"; Sharp's block search fits the phone again

- **Coach (trainer): activate Spellfire Cloak, then play the card.** On the opponent's turn (their action phase or your reaction
  step), when your arsenal reaction or instant costs more than your pool and a resource-only gear piece covers the difference, the
  Coach now says to activate the piece first so nothing is pitched — the line the table's AI has played since v6.69 (SPXCLOAK).
  One new judge reader, `judge.cloakFor(g, seat, owe, except)`, answers it for both: `sparring.cloakFirst` now asks it (same
  behaviour) and the trainer hands it to the Coach through ctx. Scope: the arsenal card only; the Coach still has no off-turn
  advice for hand cards. Drill test/coachcloak.test.js (table state and a trainer-shaped state, both windows; sabotaged three ways).
- **AI (Sharp, phone bound): the defend-step search keeps 2 block sets besides the rules' wall and taking it, not 4**
  (`SPXBLOCKCAP`; `none` = old). Each set is one rollout. p95 at 4x CPU throttle on one box, before -> after: azalea 234->158,
  prism 195->164, boltyn 260->154, viseraibw 226->187, fai 223->144, blaze 149->116, iyslander 105->72; worst fai 355->154,
  azalea 296->233 (bound 400). That box measured ~1.3x slower than v6.75's, so azalea, prism and viseraibw likely remain near or
  over 150 there: cap 1 is being measured. Strength flat: Sharp A/B at 12 seeds per chair for the five heroes, net -2 wins of
  1920, every run 0 refusals / violations. Evidence: `experiments/phone-blockcap/` (driver, timings, ab.sh).
- **Chaos d10** (salt d10, 289 games, 33,697 random legal moves): 0 findings.
- **Validation:** npm test 4571 / 4566 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games 0 refusals /
  violations / stalls (3 draws); chaos 0 findings; both babel blocks compile (worker D); trainchaos Iyslander and Blaze clean.

## v6.75 — the trainer's dummy defends under the table's cap; allies untap at the end phase on both boards

- **Rules (trainer): the dummy asks `parser.defCapWhy` for every defender, in its pick order.** It read a defence cap's number as
  a limit on HAND cards and added its iron freely: against a Confidence attack ("can't be defended by more than 2 non-block
  cards", equipment counts) it fielded three non-block defenders (driven: Beaten Trackers + Bear Hug + Rough Up against Lyath's
  Mocking Blow), where the table refuses the third; and against overpower (one ACTION card) any hand card spent the cap. Now the
  one body the table's defend door and the player's toggleBlock already ask judges each candidate (gear first, then hand) against
  those declared; the dummy's own 2-card heuristic still caps it from above. Dominate (iron + 1 hand card) is unchanged.
- **Rules (trainer): allies and other permanents untap at the turn-player's end phase (CR 4.4.3d).** "The turn-player untaps all
  permanents they control." The trainer untapped them at the start of the controller's next turn, the table at the end phase;
  the start-of-turn untaps are removed, so both boards untap at the same beat. Latent today (no ally in the pool prints an Instant
  {t} ability), now one rule.
- **Found by a sweep of the trainer's inline rules logic against judge/effects** (worker B): every other declare, damage,
  prevention, end-phase and play-door decision already goes through an engine body or agrees with it.
- **Drill:** test/dummydefence.test.js runs the trainer's REAL `dummyDefence` source against the engine (control, Confidence,
  overpower, dominate, plus a source pin for the end-phase untap); sabotaged two ways.
- **Validation:** npm test 4567 / 4562 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile;
  trainer chaos on Lyath and Enigma (3 games each) clean; table chaos salt d8 (289 games, 41,270 random moves) 0 findings. No
  engine, wire or data change.

## v6.74 — the trainer's Coach gives the advice the table's AI now plays

- **Coach parity: the trainer's Coach's call asks the same judge readers the table's AI asks.** v6.69–v6.73 taught the AI
  (sparring.js) four lines the trainer's Coach (engine/advisor.js, a separate module) still advised the old way. Driven on
  real positions, before -> after: Bravo with Macho Grande face-down, "Play Bravo — hero power" -> no flip (`arsTurnPays`);
  the arsenal step, "Arsenal Macho Grande" -> "Arsenal Cartilage Crush" (`arsenalPayable`); Fai behind on life, "Play Art of
  the Dragon: Fire" -> "Play Scar for a Scar → 4 dmg, go again" (`condGaNow`); Lyath ahead on life, "Play Full of Bravado" ->
  "Play Mocking Blow → 4 dmg" (`effPowerNow` with its own boo). One body each: the trainer passes the readers in the Coach's
  ctx (as it already passed `arsNoOpWhy`), and advisor.js only consults them; a missing reader gives the old line. Checked
  first that every reader answers the trainer's own state. Spellfire Cloak: not applicable — the trainer's pay sheet has no
  gear route (filed as a UI item). Drill: test/coachparity.test.js (wiring scan + before/after per line; sabotaged).
- **Validation:** npm test 4562 / 4557 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile;
  trainer chaos on Bravo, Fai, Lyath and Iyslander clean; the Coach renders in the real page with the readers. No engine rule,
  wire or data change (the AI and the table are untouched).

## v6.73 — Mocking Blow is ranked at the power it actually attacks with

- **AI: the attack ranking reads a card's own on-attack boo when its gate holds now (SPXBOOSELF; correctness fix).** Lyath's
  Mocking Blow: "When this attacks a hero, if you have more {h} than them, the crowd boos you. If you've been booed this
  turn, this gets +4{p}". Ahead on life the engine resolves the link at 4 (driven: 18 v 10 life), but `effPowerNow` asked
  before the attack saw "booed" false and predicted 1, so the call ranked it below Full of Bravado's printed 3. New
  `effects.selfBooNow` / `asBooed`: a played card (not a weapon or ally swing) whose `boo` rider is decidable and true now
  is read as booed for its own gates, behind an opt-in `selfBoo` option only the attack ranking passes, so every other
  reader and every other hero is unchanged. The prediction now equals the engine's link total in both states. Measured,
  Lyath own seat + other chair, 24 seeds: 225 -> 227 of 768 (noise); shipped because the call showed a player the wrong
  number. Drill: test/booself.test.js (sabotaged three ways); test/effpower.test.js's gate-shut fixture now puts Lyath
  behind on life (ahead, Mocking Blow correctly boos itself).
- **Measured NO, not shipped:** Dorinthea's Hit and Run swing-first ordering (her list runs only the blue +1, and Dawnblade's
  swing never keeps the action point while Hit and Run is legal: 0 chances in 96 games).
- **Validation:** npm test 4557 / 4552 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (3 engine draws); chaos 289 games 0 findings. No wire, data or page change beyond `APP_VER`.

## v6.72 — Out Pace can't be defended by equipment at the table either

- **Rules: "This can't be defended by equipment" is enforced on BOTH boards (CR 1.0.2).** Out Pace (Dash) set
  `fx.noEquipDefend`, but only the trainer's dummy read it: at the table (`judge.legal`'s defend door — the server, the
  two-phone game and the AI hero) an Out Pace attack could be defended by equipment, 18 times in Dash's 48 self-play games at
  3 seeds. CR 1.0.2, quoted verbatim at the reader: "A restriction is a rule or effect that states something cannot happen.
  ... A restriction takes precedence over any requirement or allowance", with the rulebook's own example "'They can't defend
  this with equipment' is a restriction" — so it beats CR 7.3.2a's allowance to declare equipment. One body,
  `parser.noEquipDefendWhy`, asked by the table's defend door, the trainer's dummy and the Coach's block advice; the refusal
  reads "Out Pace can't be defended by equipment". The AI's blockers go through `legal`, so they never declare the iron.
  Drill: test/outpace.test.js (every equipment piece refused against Out Pace, a hand card accepted, the same piece legal
  against a plain attack; sabotaged). No wire shape change.
- **Tools:** `tools/failstates.js` counts a keyword the ledger marks live (drill-backed in the engine) as carried, not a
  fail state; it only searched the trainer page, so the engine's move to `effects.js` had left 44 stale false alarms.
  `SWEEP.md`: 46 fail-state entries -> 3.
- **Validation:** npm test 4554 / 4549 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (3 engine draws); chaos 289 games 0 findings; both babel blocks compile; trainer chaos on Dash and
  Kayo (3 games each) clean. No wire or data change.

## v6.71 — the AI sees a card's own conditional go again

- **AI: a card's own gated go again counts when its gate holds now (SPXCONDGA).** `judge.keepsActionPoint` read printed go
  again, the face-up arsenal stamp, the hero's grant and waiting grants, but never a card's OWN "if ... this gets go again":
  Fai's Cinderskin Devotion / Hot on Their Heels / Enflame the Firebrand / Display Loyalty ("If you control 2 or more Draconic
  chain links"), Scar for a Scar ("If you have less {h} than an opposing hero"), and gated go again on 24 cards across 13
  heroes. New `effects.gatesMetNow` (effPowerNow's own gate loop, for any op; only gates the engine can settle NOW count, so
  a payment, way-of-play or "if this hits" gate never does; the attack's own Draconic link counts, RULING user 2026-10-31)
  and judge reader `condGaNow`; the policy's four action-point sites ask both. `keepsActionPoint` itself is unchanged, so its
  judge-side callers are too. **Measured, Fai own seat + other chair, 24 seeds: 431 -> 464 of 768 (+33)**; 12 seeds of 384:
  Briar 315 -> 321, Enigma 195 -> 201, Dorinthea 253 -> 258, Viserai 173 -> 174, Boltyn 125 -> 125, Viserai BW 114 -> 112.
  0 refusals / violations / stalls. Drill: test/condga.test.js (sabotaged four ways).
- **Found on the way:** Fai's Fealty token ("the next card you play this turn is Draconic", 221 legal / 0 used) changed
  nothing when spent, because of this blindness; re-measured on top of SPXCONDGA it is still noise (219 -> 224 / 222 of 384)
  and is not shipped (patch in experiments/ on findings/queue).
- **Measured NO, not shipped:** ranking arcane by landed damage against an attack's power minus the expected block (Blaze
  136 -> 109, Iyslander 134 -> 116 of 384): a blocked attack still costs the defender hand cards.
- **Validation:** npm test 4552 / 4547 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (3 engine draws), Fai 48 -> 55 of 96; chaos 289 games (32,942 random moves) 0 findings. No wire,
  data or page change beyond `APP_VER`.

## v6.70 — Bravo stores a card he can pay for, and turns it face-up only when crush pays

- **AI: the arsenal step never stores a card next turn cannot pay for (SPXARSPAY).** It stored the hand's biggest printed
  attack whatever its cost, and the policy's own affordability rule then refused to play it: Bravo's Macho Grande (cost 7,
  Dominate) was arsenalled 20 times in 96 games, played from the arsenal 2 of 85 legal times, and sat there at the start of
  205 of 1171 turns (the slot's #1 occupant). New judge reader `arsenalPayable` asks the same `maxPitch` rule of next turn's
  hand (the kept cards, plus draws up to intellect counted at the mean pitch of the seat's own deck; no order is read). It
  changes 18 of 96 Bravo arsenal steps and 0-4 for every other hero.
- **AI: Bravo's hero ability turns the arsenal card face-up only when crush makes it pay, and before it attacks
  (SPXFLIPCRUSH, new reason `flipFirst`).** "{r}{r}, {t}: Turn a face-down card in your arsenal face-up. If it has crush, it
  gets +2{p} and dominate this turn. Go again" was the last-resort action and aimed blind: 33 of 65 uses turned a card
  without crush ({r}{r} for nothing). New judge reader `arsTurnPays` reads the ability's parsed rider; the rider test is now
  ONE body, `parser.arsGrantMet`, shared by `effects.applyArsGrant` (no behaviour change). Wasted flips 33 -> 0, crush flips
  32 -> 119 per 96 games.
- **Measured, Bravo own seat + other chair, 24 seeds (768 games): 309 -> 371 (+62)**; SPXARSPAY alone 355 (+46), and the
  flip adds +16 on top (more crush cards now sit in the slot). Dash (the other hero the arsenal step touches most), 12 seeds:
  218 -> 215, neutral. 0 refusals / violations / stalls in every run. Drill: test/bravoarsenal.test.js (4 tests, sabotaged
  each way).
- **Validation:** npm test 4549 / 4544 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (3 engine draws), Bravo 42 -> 52 of 96; chaos 289 games (33,413 random moves) 0 findings; trainer
  chaos on v6.69 (54 games, every hero) clean. No wire, data or page change beyond `APP_VER`.

## v6.69 — Spellfire Cloak pays on the opponent's turn; Stir the Aetherwinds is no longer thrown away

- **AI: a piece that pays on the opponent's turn pays instead of a pitched card (SPXCLOAK, new reason `cloakPay`).**
  Spellfire Cloak ("Instant - Destroy this: Gain {r}. Activate this only during an opponent's turn") was legal on 251 of
  Iyslander's and 276 of Blaze's opponent turns and spent on none. A census found 70 of Iyslander's 130 off-turn pitches
  (Blaze 32 of 37) were one card for one last point with the Cloak up. Before an off-turn play or activation whose payment
  the piece covers, the seat plays its own line out both ways (the opponent only passes, so nothing hidden is read) and
  spends the piece only when that line pitches fewer cards. The first cut spent it on any covered payment; its drill caught
  the waste (an amp then an arsenal Ice Bolt is paid by ONE blue, so a Cloak on the amp saved nothing). Not asked inside
  Sharp's search. **Measured, 24 seeds per chair (768 games a hero): Iyslander 287 -> 308, Blaze 246 -> 270**, positive in
  all four chairs, 0 refusals / violations / stalls. Drill: test/cloakpay.test.js (sabotaged both ways). A spent Cloak
  takes its Arcane Barrier 1 with it, so `soak`, `soakCard` and `arsenalSkip` are no longer reached in the explain pin.
- **AI: a pure instant-speed grant with nothing to take it is held (SPXSTIRIDLE; advice fix).** Stir the Aetherwinds
  ("your next Wizard non-attack card this turn as though it were an instant") was cast from Iyslander's arsenal on the
  opponent's turn 16 times in 96 games; every cast pitched hand cards and none was followed by a Wizard card. New judge
  reader `instantNextTakers` (counts the OTHER cards the grant's qualifier admits, by zone, through `qualMatches`); the
  off-turn arsenal cast now waits for an arsenal taker. Win-noise (24 seeds 287 -> 284 of 768), shipped because the call
  showed a player a play that spends next turn's cards for nothing. Drill: test/stiridle.test.js.
- **Measured NO, not shipped (QUEUE.md on findings/queue, patches in experiments/):** Blaze's energy -> off-turn arcane
  cast (~95% of what it spends is next turn's card; 125 -> 97 / 107 of 384); Viserai BW's Runechant of Lust/Sloth off-turn
  (114 -> 94 / 100; destroyed at his action phase, never usurped); Boltyn keeping charge-riders out of the soul
  (238 -> 244 of 768, noise). The off-turn lesson — a hand card spent on their turn is missing from yours — held each time.
- **Chaos:** table salt d7 (EPS 0.3, 289 games, 41,680 random legal moves): 0 findings.
- **Validation:** npm test 4545 / 4540 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws); chaos 289 games (EPS 0.25, 33,268 random moves) 0 findings. Cloak at 4x CPU
  throttle on the real page: rule policy p95 8.0 / worst 21.6 ms, Sharp p95 9.2 / worst 14.1 ms (bound 150 / 400). No wire,
  data or page change beyond `APP_VER`.

## v6.68 — Iyslander casts an arsenal Frost Spike on the opponent's turn

- **AI: an Ice instant in the arsenal goes on the opponent's turn (SPXOPPICE, new reason `oppIce`).** Frost Spike (0-cost
  Ice instant): "Create a Frostbite token in an exposed head, chest, arms, or legs zone." Iyslander: "Whenever you play an
  Ice card during an opponent's turn, create a Frostbite token under their control." Off-turn it makes two Frostbites; the
  `never.js` census had it legal on the opponent's turn 41 times in 32 games and cast 0. New judge readers
  `oppTurnTrigger` (the seat carries `iceFrostbite` and the card is an Ice INSTANT by type — the same two facts
  `effects.foeTurnIce` asks) and `oppTurnTriggerPlay` (the arsenal card, legal now); the policy casts it at the first
  window outside a defence, like SPXOPPARS. **Measured, and narrowed by the measurement:** a first cut that held every Ice
  card on her own turn took her own seat 75 -> 21 of 192 (it held Ice Bolt too); casting a HAND Spike off-turn cost
  75 -> 67 and 60 -> 57 (a blue hand card is the 3-pitch her own turn needed). From the arsenal, where a card cannot be
  pitched: own seat 75 -> 79, other chair 60 -> 62 (12 seeds each, 0 refusals) — noise, shipped as the hero's printed play
  the call never made. Rare (about 4 casts in 96 games). Drill: test/oppice.test.js (an arsenal Spike is cast and the
  opponent gains two Frostbites; a hand Spike is kept; sabotaged both ways).
- **Census closed, no gap (handoff item 1):** Gravy's Timesnap Potion (legal 62 / played 2) is a blue 3-pitch card and
  Gravy ends almost every turn with an empty hand (`endaura.js`: no spare action point ever met it); blue Jittery Bones
  (67/8) is a pitch-and-block card. Neither is advice the call is missing.
- **Tools:** `tools/trainchaos.js` (random taps on the real page through whole trainer games) merged from the tools
  branch. Table chaos salt d6 (EPS 0.3, 289 games, 41,070 random legal moves): 0 engine / 0 policy findings.
- **Validation:** npm test 4540 / 4535 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws), Iyslander 33 -> 35 of 96; chaos on Iyslander (EPS 0.4, 48 games, 7,680 random
  moves) 0 findings. No wire, data or page change beyond `APP_VER`.

## v6.67 — the AI takes back an over-pitch; chaos reaches the wire, the view and Sharp

- **AI: an over-pitched payment is taken back, not confirmed (new reason `payBack`).** Found by `tools/chaos.js`: a payment
  selected PAST the cost (a person taps one card too many, then the seat is handed to the AI — or Sharp, whose payment is
  the rule policy's) left the policy proposing `payConfirm`, which `legal` refuses ("a card is pitched only while the cost
  is unpaid", ruling 2026-08-01). It now takes back the first selected card the rest still covers without, then pays. The
  policy never over-pitches on its own: the ladder is byte-identical to v6.66's. Drill: test/payback.test.js (sabotaged).
- **Tool: chaos reaches three more surfaces.** At every random move it now also (1) round-trips the state through
  `wire.encode` -> JSON -> `decode` and replays the action on the decoded copy, comparing hashes (`WIRE-REPLAY`: what the two
  phones of a table would do; sabotaged by shifting a life total on the copy), (2) builds `view(g, seat)` for both seats, and
  (3) every 25th move asks Sharp for its move and checks it is legal (a Sharp refusal is a POLICY finding). Exit code 1 on
  any engine or policy finding. Run: 289 games at EPS 0.25 (34,060 random moves) and 289 at EPS 0.6 — 0 engine findings on
  every surface; the only policy finding was the over-pitch above.
- Drills moved: test/explain.test.js (`payBack` unreached in self-play — it follows a person's taps).
- **Validation:** npm test 4538 / 4533 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws), byte-identical to v6.66's; chaos at EPS 0.6 on the fixed policy: 103,434 random
  moves, 0 engine / 0 policy findings.

## v6.66 — Runebleed Robe asks which Runechant pays

- **Rules: a destroy cost with two different cards that could pay asks which (closes the ledger's last open record,
  `destroy-a-runechant-cost-unasked`).** Runebleed Robe: "Instant - Destroy this and a Runechant you control: Prevent the
  next 1 arcane damage that would be dealt to you this turn." Runechant of Lust and Sloth print "This counts as a
  Runechant", and CR 1.8.8 (verbatim): "An object that counts as another object for the purposes of rules and effects is
  considered to be that object, in addition to its other properties." Since v6.42 the cost reader took a token first and
  asked nothing, so a player holding a token and Lust could never spend Lust (whose "When this is destroyed, create a
  Runechant token" pays, while the token would keep its arcane pop) — weaker than printed. Now `parser.boardCostOffer`
  (one uid per DIFFERENT card that could pay; null while every candidate is the same card, so two Gold or three tokens
  still ask nothing) is asked before the payment on both boards: judge's new `boardcost` pending on the hero, gear and
  arena activation routes, the trainer's `boardpick` sheet on both of its activation doors. The answer rides to
  `execute` as `_destroyUid` (a held declaration, so a cancelled payment takes it with it). The AI answers through
  `judge.boardCostAnswer` (usurp's worth, without the usurp line) and spends Lust; new reason `boardcost`. Neither built
  deck carries the Robe beside a special Runechant today (the Robe is Viserai's; Lust and Sloth are Viserai, Between
  Worlds'), so the question waits for the board where they meet. **WIRE_V 48 -> 49.** Drill: test/boardcost.test.js
  (asks with both kinds, the answer is what is destroyed both ways, silent with tokens only, an off-offer answer refused,
  the AI's pick, a cancel clears it; sabotaged: the reader ignoring the answer, the AI's ordering flattened to a uid
  tie-break — the fixture's token uid sorts first so a tie-break alone fails).
- The approximation ledger now holds **0 open** records (21 stated, 42 closed).
- **Tool: `tools/chaos.js` — the table played badly on purpose.** v6.64's and v6.65's bugs were reachable by a person and
  never by the rule policy. This driver mixes uniformly random LEGAL actions (every play, activation, pass, odd pitch,
  cancelled payment, declined cost and prompt answer `judge.legal` accepts) into self-play at rate `EPS`, and reports
  `legal`/`reduce` disagreements, throws, invariant violations and cards in no zone (stalls are expected and not counted).
  First run: 289 games at EPS 0.25 (34,060 random moves) and 578 at EPS 0.6 (213,132) — 0 engine findings. The one policy refusal it
  meets (`payConfirm` after a random over-pitch) is a state only a mixed hand on one seat makes. `selfplay.play` takes
  `opts.act` for it.
- Drills moved: test/approx.test.js (the record closed, its probe turned round), test/split.test.js (the table demuxes
  `boardcost`), test/explain.test.js (`boardcost` unreached in the 30-game census — Viserai's), test/sheetdoors.test.js
  (`cancelBoardCost`, an answer), test/slicecensus.test.js (`tryPlay` 27,065 -> 27,318), test/soulcost.test.js (the busy
  lists name `boardpick`), the two WIRE_V pins.
- **Validation:** npm test 4537 / 4532 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws); page.js 89/89 at 393x852.

## v6.65 — a play waiting on the stack pays the price it was played at; Iyslander amps her off-turn casts

- **Rules: a held play's cost is locked when it is played (the rest of v6.64's class).** The table holds an action-speed play on
  the stack (v4.66) and `execute` charged its cost as the layer RESOLVED, reading the board again. CR 5.1.6 ("all asset-costs of
  the proposed card are calculated") and CR 5.1.7 ("the player pays all asset-costs") both come before CR 5.1.10's "the card is
  now considered played". Driven: Rune Flash ("This costs {r} less to play for each Runechant you control") waiting with one
  Runechant, a second made at instant speed (Runic Disposition, Arcane Seeds), resolved a resource cheaper — a refund no invariant
  sees; a Runechant destroyed in the window (Viserai's Runebleed Robe) charged it a resource more. `holdPlay` records the `price`
  on the layer and `execute` charges exactly it (`_heldPrice`, cleared after the resolution). The audit behind it: `costOff` is
  made only by Seismic Surge (start of the action phase) and a `nextTurn` tax is born not ready, so neither can appear in the
  window; the board-dependent discounts (Runechants, Hyper Driver, marks, Draconic links) are what the lock covers. A probe over
  the full ladder (816 games) found no held play whose price moved, so the rule policy never hit it: a person (or Sharp) could.
  The trainer has no stack. **WIRE_V 47 -> 48.** Drill: test/heldprice.test.js (made / destroyed / unchanged / the declaration
  does not outlive the play; sabotaged: the charge re-reading the board fails both window rows).
- **AI: Iyslander amps the arsenal card she casts on the opponent's turn (gate `SPXOPPAMP`).** Crucible of Aetherweave: "Once per
  Turn Instant - {r}: The next card you play this turn with an arcane damage effect, instead deals that much arcane damage plus 1."
  Legal on ~275 of her off-turn windows, used on 0. When the arsenal cast (v6.64's `oppArs`) is one the amp reaches
  (`judge.abAmpTakers`) and both are affordable, the Crucible goes first (new reason `oppArsAmp`). Own seat, 24 seeds each chair,
  wins of 768: 266 -> 279 (135 -> 141 and 131 -> 138), 0 refusals / violations. Drill: test/oppamp.test.js (found in self-play;
  the amp lands, the cast follows and takes it; sabotaged with the gate off).
- **Measured, not shipped — Spellfire Cloak paying for those casts.** "Instant - Destroy this: Gain {r}. Activate this only during
  an opponent's turn." Its {r} never made an arsenal cast affordable that the hand could not (0 of 111 windows with the Cloak and an
  arsenal card); on vs off identical over 384 games. Deleted. Its real use is saving a pitched card, which is a payment-policy
  question, not this branch.
- Drills moved: test/costtax.test.js (the charge and the additional-cost check share one read now, so the scan finds one
  `effCost` call), test/crindex.test.js (CR 5.1.6, 5.1.7, 5.1.10 cited and guarded), the two WIRE_V pins.
- **Validation:** npm test 4532 / 4527 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws).

## v6.64 — Iyslander plays her hero; a Frostbite cannot tax a card already paid for

- **Rules: a Frostbite made while a play waits on the table's stack no longer taxes it.** Frostbite: "Cards and abilities cost
  you an additional {r} to play or activate" / "When you play a card or activate an ability, destroy this" — both at the PLAY. The
  table holds an action-speed play on the stack (v4.66) and `execute` charges as the layer resolves, so a Frostbite made in the
  window (Iyslander's Ice card at instant speed) taxed a card already paid for: Kayo's Buckwild resolved with his resources at -1
  (NEGATIVE-RES, 784 times in 192 games once Iyslander cast on the opponent's turn). `holdPlay` records the Frostbites there at the
  play (`frostAt` on the layer) and `resolveHeld` sets the late ones aside: no tax, not destroyed, still there for the next card. The
  trainer has no stack, so it has no such window. **WIRE_V 46 -> 47** (the layer's new field). Drill: test/frostheld.test.js (a late
  Frostbite neither taxes nor shatters; one there at the play still does — v2.74's ruling stands; sabotaged).
- **AI: Iyslander casts her arsenal on the opponent's turn (`judge.grantedInstant`, gate `SPXOPPARS`).** Her hero: "If it's not
  your turn, you may play blue non-attack action cards from your arsenal as though they were instants. Whenever you play an Ice card
  during an opponent's turn, create a Frostbite token under their control." The census: those casts legal ~80 times in 32 games,
  made 0. The reader names an arsenal card that is not an instant or reaction by type yet `legal` lets its seat play on the
  opponent's turn — one a hero grant made castable — and the policy casts it at the first window it holds outside a defence, so the
  Frostbite taxes the rest of their turn. Own seat, wins of 768 at 24 seeds each chair: 263 -> 266 (noise; the LAST window instead,
  where the Frostbite dies unused at their end phase: 128 of 384, the same as off). Ships for the advice: it is the hero's printed play
  and the call never offered it (new reason `oppArs`).
- **AI: the payment pitches around the card a discard cost named.** Five Frostbites made Carrion Crown's free draw cost 5; Gravy named
  Cutty Shark for the discard and the pitch reached for the same card — a policy refusal (`legal`: "already spent on the discard").
  Drill: test/discpitch.test.js (sabotaged).
- **Measured, not shipped — Lyath's Suspense auras cast in the opponent's last window.** The clock ticks at the start of his turn, so
  a leave-payout aura (Act of Glory, Tension in the Air, Edge of Their Seats) cast then pays out a turn sooner. It lost: 127 -> 112 of
  384 (113 with The Suspense is Killing Me included). The cards pitched to pay 2-4 for the aura on the opponent's turn are the cards he
  swings with on his. Deleted. Also settled: Brothers in Arms (47 legal / 8 played) is a blocker that loses a fair ranking, and Act of
  Glory is pitched, never stranded (Lyath ends 291 of 291 turns with no castable card left in hand).
- Drills moved: test/speccensus.test.js (`freezeSide` reached: Cold Snap's freeze from the arsenal), test/explain.test.js
  (`arsenalSkip` reached), test/keycensus.test.js (`isFrostbite` is judge's: the trainer has no stack), the two WIRE_V pins.
- **Validation:** npm test 4527 / 4522 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws).
## v6.63 — the peek names a card's keywords

- **The in-game peek (`PeekDock`, both boards) names the card's keywords** under its name ("Go again · Intimidate", "Phantasm",
  "Blood Debt · Usurp") — a newcomer meets them there first. Plain text, not chips: the whole dock is one tap-to-close surface (POLISH
  condition 1), so a tap on the line closes the peek like any other; the full card, one more tap away, keeps the chips that open each
  keyword's Comprehensive Rules sentence (`CardKw`). Same reader and filter as `CardKw` (`PeekKw`), so the two never disagree.
  Measured at 393x852 over every hero's opening hand (117 peeks, 66 with keywords): the line always inside the screen and above the
  hand rail, and a tap on it always closes the preview.
- Drills: `tools/page.js` peeks trainer hand cards until one carries a keyword and checks the line is inside, takes no tap, and closes
  the peek (89/89; sabotaged: making the line a button fails it). test/slicecensus.test.js repinned (`.peekbar .pkkw`).
- **Validation:** npm test 4524 / 4519 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile; page 89/89;
  no engine change (no ladder needed).
## v6.62 — the arsenal keeps the card that swings biggest from there

- **AI: the arsenal step ranks on power FROM the arsenal (`judge.arsenalPower`, gate `SPXARSPOW`).** A census of Lyath's turns (1 seed)
  found Power Play ("If this was played from arsenal, it gets +5{p}") legal on 36 of his decisions and never once played: the arsenal
  step stored the hand's biggest PRINTED attack, so a 1-power card that is 6 from the arsenal sat behind a 3. `arsenalPower` is the base
  the engine plays (`effects.basePowOf`; Lyath's halving is already on the dealt card) plus every self-pump gated on "played from
  arsenal" (`cond: arsenal`, the gate `execute` reads); other gates are facts of a turn not yet started, so they add nothing. Now Power
  Play is stored (5 times in 32 games) and swung from the arsenal. Lyath, own seat, 12 seeds each chair (wins of 384): 126 -> 127
  (noise: the card is in 2 copies and blue, so it is usually pitched; it ships because it corrects what the call tells a player at the
  arsenal step). Drill: test/freepick.test.js (Power Play, 3 + 5, is stored over Brothers in Arms, 6; a printed 9 still beats it; the
  reader answers null for a card not in hand; sabotaged: the printed sort fails it). Cold Snap and Lightning Surge also gate on
  the arsenal, but on a draw and a go again, not on power, so they rank as before.
- **Validation:** npm test 4524 / 4519 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws); both babel blocks compile.
## v6.61 — a zoomed card explains its keywords; the sheet prints the hero

- **A zoomed card's keywords open their rules.** The card zoom (the decklist, the loadout, both boards) shows the card's keywords
  as chips under its text — the same reader as the hero banner (`deckKeywords` of one copy, `crKeyword` over the pinned chapter) —
  and a tap opens the Comprehensive Rules sentence beneath. The zoom's text now tints its pips like the feed (`PipLine`), and the
  zoom scrolls inside itself when the rule makes it taller than the phone. `tools/page.js` walks the decklist until a card carries a
  keyword, taps it, reads the rule (88/88 at 393x852).
- **The hero sheet prints the hero.** Under the keyword row, "Hero ability": the hero card's own text, verbatim off the pinned card,
  one paragraph per printed line (Bravo: "Action - 2 resources, tap: Turn a face-down card in your arsenal face-up. If it has crush, it
  gets +2 power and dominate this turn. Go again"). What the hero does every game, which the blurb only gestures at.
- **Measured and settled (no change): Sharp is not worse than the rule policy on Viserai BW.** v6.59's "Sharp 104" had Sharp in
  EVERY seat; on his own seat only (`SPXLA=viseraibw`), 12 seeds each chair, he wins **277 of 384** against the rule policy's 115.
  The wall search is most of it: with `SPXLA_BLK=0` he wins 208.
- Drills moved: test/slicecensus.test.js (the style block grew by `.herotx` and the zoom's scroll).
- **Validation:** npm test 4523 / 4518 pass / 0 fail / 5 skipped; both babel blocks compile; page 88/88 at 393x852; no engine change
  (no ladder needed).

## v6.60 — each hero shows its keywords and what they mean; damage dealt means damage that landed

- **The keywords a deck uses, and what each one means.** A newcomer picking a hero read a one-line blurb and nothing about how
  the deck plays. The banner under the roster now shows the deck's three most-used keywords with copy counts (Kayo: Go again
  ×10 · Clash ×7 · Dominate ×2; Viserai BW: Go again ×22 · Usurp ×19 · Blood Debt ×18), and the sheet shows six. They are
  counted off the pinned cards (`cards.deckKeywords`, from the database's own keyword index): a parameter folds into its keyword
  ("Opt 1" and "Opt 3" are one Opt), and the deck-building keywords (Legendary, Specialization, Unlimited) are left out. **Tap
  one and its Comprehensive Rules definition opens beneath**, verbatim with its rule number ("Go again is a special resolution
  ability that means "Gain 1 action point."" — 8.3.5); a second tap folds it. The definitions are pinned like the pool:
  `tools/pin-crkw.js` reads chapter 8 of rules.fabtcg.com (130 ability, label and effect keywords) into `data/crkw.js`, a
  `<script src>` the page loads, so a phone never fetches the rules site. `cards.crKeyword` finds the rule for every keyword all
  17 decks use, including "Ice Fusion" (written "[SUPERTYPES] Fusion") and "The Crowd Boos". Drills: test/crkw.test.js (the pin's
  shape; every deck keyword has a rule; the counter and the lookup with their refusals; the bridge; sabotaged three ways).
  `tools/page.js` taps a keyword on the banner: the rule opens full width under it and folds on a second tap (86/86 at 393x852).
  Rerun `node tools/pin-crkw.js --check` each release cycle beside the pool's re-pin.
- **Rules: "if you've dealt damage this turn" reads damage that LANDED (approx `dealt-damage-reads-attacks`, closed).** Second
  Strike (Briar's list): "When this attacks, if you've dealt damage this turn, this gets +1{p} and **go again**." Since v6.43 the
  gate was answered by "an attack or arcane was played this turn", so a swing blocked to nothing, or prevented in full, still bought
  the +1 and the go again: stronger than printed. Now each seat's `hist.dmg` counts damage events that landed after prevention (CR
  6.4.10a), on a hero (`effects.creditHeroDmg`, every site both boards already call) or on an ally (`effects.creditDmg`, judge's
  attack-target branch). WIRE_V 45 -> 46 (`hist` gains `dmg`). Briar, own seat, 6 seeds each chair (wins of 192): **164 -> 156**
  (81 -> 76 first-named, 83 -> 80 second-named); she is still the strongest seat. Drills: test/conditionals.test.js (blocked
  swing: no damage, no go again; landed: go again; a swing at an ally: credited as damage but not as damage to the hero; a ward that
  prevents it all: none; sabotaged both halves), test/approx.test.js (the probe turned round: open 2 -> 1, closed 40 -> 41),
  test/keywordgate.test.js and the Briar scene seed `hist.dmg` and assert the attack-only control now refuses.
- **AI: a tie goes to the banished zone (`SPXBANFIRST`).** A census of Viserai BW's turns with a Gloomblade playable from banish
  (2 seeds) found him never ending a turn with one unplayed — every miss was another play that ranked higher — but on a power and
  cost tie he sometimes played the same Gloomblade from HAND, on a uid tie-break. A card played from the banished zone is not a
  held card, so the banished copy goes first and the hand keeps its copy to pitch or defend. Viserai BW, own seat, 12 seeds each
  chair (wins of 384): 114 -> 115 (noise; it ships because it corrects what the call would tell a player in that seat).
- **Measured and ruled out (no change):** Sharp and the Embrace Ursur lead (QUEUE item 1). At every point where the rule policy leads
  with Embrace Ursur (`judge.riderLead`), Sharp keeps it 13 of 16 times (1 seed); the 3 overrules each score a Runechant of Lust line
  or a banished Gloomblade higher, and are fair. Sharp's smaller gain from SPXRIDER is not a missed rider.
- Drills moved: test/crindex.test.js (118 cited rules, 108 guarded: the deck-building rule and Fusion's written form, cited in
  engine/cards.js and driven by the new drill), test/slicecensus.test.js (the style block grew by the keyword chips), Briar's
  scene (seeds `hist.dmg`), test/wire.test.js and test/dichotomy.test.js (WIRE_V 46).
- **Validation:** npm test 4523 / 4518 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder 816 games, 0 refusals /
  0 violations / 0 stalls (2 engine draws); both babel blocks compile; page 86/86 at 393x852.

## v6.59 — Viserai BW feeds Embrace Ursur, and the first game points at the call

- **AI: a banish that keeps the card (`judge.riderPick` / `judge.riderLead`, gate `SPXRIDER`).** Embrace Ursur: "When this
  attacks, you may banish a card from your hand. If it's Runeblade, create a Runechant token. If it's Shadow, this gets go
  again." A census of Viserai BW's calls (32 games) found the sheet declined 15 of 15 times, and the policy swinging a
  Gloomblade *before* Embrace Ursur, so the turn ended on it. Every Gloomblade prints "You may play this from your banished
  zone": banished for the riders it costs no card and buys a Runechant and the go again to play it from there. `riderPick`
  names a card that fires a rider (the sheet's `classRider` data) and still plays from banish (`fxParse.fromBan`), never a card
  that would be gone; `riderLead` ranks the attack that asks for it with the attacks that keep the point, when a payable
  Gloomblade is in hand. New reasons `riderPick`, `riderFirst`. Measured on his own seat, gate on vs off, 12 seeds each chair
  (wins of 384): **rule policy 76 -> 114** (33 -> 55 first-named, 43 -> 59 second-named); **Sharp in every seat (`SPXLA=all`)
  92 -> 104** (42 -> 45, 50 -> 59). Ladder (816 games, every seat on): 0 refusals, 0 violations, 0 stalls, 2 engine draws.
  Drill: test/embraceursur.test.js (reader rows with refusals; self-play: Embrace Ursur leads with a Gloomblade waiting, and
  the sheet banishes one for a Runechant and go again; sabotaged: SPXRIDER=none fails both drives).
- **The first game points at the Coach's call.** A newcomer met a gold box and no word on what it was for. Until both seats have
  had a turn in a phone's first game, the box ends with one line: what it is, that it names the play and why, and how to fold
  it away (`store` "coachSeen"; the table's "<Hero>'s call" box says it too). `tools/page.js` asserts the line inside its box on
  a new phone's first trainer game and gone once seen (83/83 screens at 393x852).
- **Measured and ruled out (no change):** Gravy's Jittery Bones (legal on 69 of his turns, played 8) — he never ended a turn
  with it playable; every time it stayed in hand the action point went to a bigger attack or a card that keeps the point.
- Drills moved: test/explain.test.js (the census's unreached keys gain `riderFirst` / `riderPick`, driven by the new drill);
  test/slicecensus.test.js (the style block grew by `.advnew`).
- **Validation:** npm test 4517 / 4512 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile.

## v6.58 — a new phone sees the way in

- **How to play is a button until it has been opened.** On a phone that has never opened the sheet and has no game recorded, the
  roster's "New to Flesh and Blood? How to play" wears a gold frame; the first tap records it (`store`, "howSeen"; storage that
  throws reads as not seen, which only frames it) and after that it is quiet text, out of a regular's way. `tools/page.js` asserts
  framed before, unframed after (81/81 screens at 393x852).
- **Measured and ruled out (no change):** Gravy's Timesnap Potion (legal 62 of his turns, played 2) — in every one of those states
  the competing play is an attack for the same action point, and the potion pitches for 3; Runechant of Lust / Sloth on the
  opponent's turn — turning into a plain Runechant at the start of her turn throws away the usurp rider the card prints.
- Drills: test/tapdoor.test.js's plain-arrow census 18 -> 19 (the button sets state, returns no handler); test/slicecensus.test.js
  (the style block grew by the frame).
- **Validation:** npm test 4514 / 4509 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; both babel blocks compile; no
  engine change (no ladder needed).

## v6.57 — How to play, a link that shows itself, and the AI spends its cards where they count

A thread about the stranger: the first person who opens the link and has never held a Flesh and Blood card.

- **How to play.** Under the roster, "New to Flesh and Blood? **How to play**" opens a sheet (the Judge sheet's frame, in gold):
  the goal, the three uses of a card (play, pitch, defend), the action point and go again, combat and the reactions, the end
  of turn (arsenal, pitch to the bottom, draw to intellect, and the swing-or-hold question it leaves), and how this app is driven
  (Fight the dummy first, the two-tap, the Coach's call, JUDGE!!). Six short paragraphs; every rule in them is one the engine
  plays. Driven at 393x852: no horizontal scroll, the sheet scrolls inside itself, "Got it" closes it. `tools/page.js` walks it
  (6 sections, closes). README says where it is.
- **The link shows itself.** The page had no description and no link-preview tags, so a shared link arrived bare. Now: a
  description, Open Graph and a large Twitter card, with `icons/share.png` (1200x630, original art: the icon's blade and sun beside
  the name and one line), written by `tools/icon.js` in the page's own fonts (it refuses without them).
- **AI: the attacking reaction window casts only what is worth it there (`judge.pumpsNow`, gate `SPXRXPUMP`).** The defending side
  was filtered in QUEUE v4 H8 (`defendsNow`); the attacking side cast the cheapest legal instant as a "pump", whatever it did. A
  census over every pairing (1 seed) found Oasis Respite, Cloud Cover and Toe the Line preventing damage on a turn nobody was hitting
  the seat, Arcane Polarity gaining 1, Memorial Ground and Enigma's transcend instants spent for nothing on the swing, and the call
  told a player in that seat to do the same ("React with your cheapest card to pump this attack"). `pumpsNow` admits an attack
  reaction, a card that pumps the attack (`self`, a mode's or an `if`'s) or rides on its hit (`hitNext`), and a permanent.
  **Measured on the way:** without the permanent clause Lyath fell 133 -> 95 of 384 (his Suspense auras belong in the arena on his
  own turn), so auras and items still go down. Shipped, each hero's own seat, gate on vs off, 12 seeds each chair (wins of 384):
  Enigma 191 -> 199, Dorinthea 257 -> 260, Viserai BW 80 -> 82, Lyath 133 -> 134, Boltyn 117 -> 118, Fai 216 -> 217, Briar 326 ->
  326, Azalea 219 -> 219, Blaze 129 -> 128, Gravy 157 -> 156, Iyslander 127 -> 126: all inside the band (sum 1872 -> 1885). It ships
  as a noise-level change that corrects the advice the call shows. Drill: test/rxpump.test.js (reader rows with refusals; self-play:
  the seat never casts a refused, legal card into its own reaction window, and still casts pumps — sabotaged: SPXRXPUMP=none fails
  the policy row, the reader answering true fails the refusals, dropping the permanent clause fails the Suspense row).
- **AI: a free piece that makes its own token goes before the attack (`judge.tokenPiece`, gate `SPXTOKENPIECE`).** Runehold
  Release ("Destroy this: Create a Runechant token. Go again", 0 defence) was legal on 157 of Viserai BW's turns and used on 23:
  the gear fallback sits after the attacks, and the attack had spent the action point the ability needs. The reader answers an
  equipment ability that costs no resource, spends the piece, has go again and pays out only its controller's tokens, on a piece
  of at most 1 defence. Own seat, 24 seeds each chair (wins of 768): **Viserai BW 136 -> 141** (noise-level; the play costs
  nothing). Allowing the 1-defence piece: **Boltyn's Flat Trackers (Agility token) 224 -> 253** (+18 and +11 a chair, outside the
  band). Lyath's Stand Strong costs {r}{r}{r} and is not admitted (measured identical). Drill: test/gearpolicy.test.js (Runehold
  goes, a Runechant lands, the action point stays; Flat Trackers likewise with an Agility token; the reader's bound and refusals —
  sabotaged: SPXTOKENPIECE=none fails both drives, the reader answering false fails its rows). Its SPXPIECE fixture moved with
  Boltyn's games (the first Garland found is now a layer made before the play) and is resolved before it is read.
- Drills moved by the new trajectories (re-anchored, not weakened): test/rxhold.test.js's attacker fixture pumps with Nip at the
  Heels (it was Oasis Respite, which the window now keeps); test/explain.test.js — `grantKeep` is reached by the census now;
  test/slicecensus.test.js — the style block grew by the How to play rules.

## v6.56 — The AI spends what it held

The never-used census (`experiments/census/never.js` on findings/queue: per card or ability, the turns `legal` offered it vs the turns
the AI used it) ran on the three bottom heroes and found five holds. Each is fixed behind its own gate, measured on the hero's own
seat, gate on vs off, 12 seeds each chair (wins of 384).

- **SPXPIECE: a 0-defence resource piece pays for the play about to be paid.** Garland of Spring ("Destroy this: Gain {r}. Go again")
  was legal on 555 of Boltyn's turns and spent on 9. QUEUE v4 H11 holds a resource-only piece unless it unlocks an attack, but a piece
  that prints no defence blocks nothing: its {r} is its whole worth, and it is worth a card when the next play costs more than the
  pool holds and the piece covers the difference. After: 30 of 83 legal turns. Boltyn **95 -> 106**, Viserai BW 77 -> 79 (both noise-
  positive; the play is the correct one and the call shows it).
- **SPXGLISTEN: Glisten before the swing, and the swing ranks on its counters.** Glisten's four +1{p} counters were played on 17 of 79
  own turns; when they were, a 3-power hand attack spent the action point and Raydn (printed 0) never swung on them. A new judge
  reader, `weaponPumpOf`, answers the shape (a card whose whole payout is +1{p} counters on weapons) and names a weapon `legal` lets
  the seat swing now; the policy plays it first, and a weapon carrying +1{p} counters ranks on printed power plus counters. After: 41 of
  42. Boltyn **107 -> 118**. Ruled out on the way: Glisten at the close of the OPPONENT's turn is worth no more than at the start of
  Boltyn's own (the counters last until his end phase either way, same hand, same pitch), so it is not chased.
- **SPXBOOTS: Mage Master Boots buys the go again for the ally, then the attack.** "{r}, destroy this: the next non-attack action card
  you play this turn gets go again" was legal on 766 of Gravy's turns and spent on 5: attacks are picked first, so the ally waited
  behind the swing that ended the turn. Two steps (`judge.gaNextPiece`, `judge.nonAtkHeld`): with an attack about to be made and a
  held non-attack that would end the turn, the piece is spent when all three fit the hand; with the grant waiting, the card it admits
  (`keepsActionPoint` sees it) goes first. Gravy **132 -> 154** (+10, +12 a chair: outside the band).
- **SPXCROWN: Carrion Crown's draw goes first when the ally it discards still plays from the graveyard.** "Discard an ally, destroy
  this: Draw a card. Go again" — 72 / 1. `judge.discardDrawPiece` asks `legal` of a copy of the state with each candidate moved to the
  graveyard: Gravy's watery grave makes the discard free and the draw a card. Gravy **154 -> 165**.
- **SPXPOLARITY: a life gain is played when its "instead" is true.** Arcane Polarity gains 1, or 4 "if you've been dealt arcane damage
  this turn", and was never played on the opponent's turn, where that damage is dealt. `effects.lifeNow` (`condMetNow`, the loop's own
  gate reader, as `effPowerNow` uses it) and `judge.lifeGainOf` answer the gain now and its best; at its best any instant window plays
  it. Level (80 -> 81). **Measured and NOT shipped:** holding it below its best (and out of the attacking reaction window, which casts
  any cheapest instant as a "pump") cost **80 -> 64**: it sat in hand and arsenal for an upgrade that came on 5 of 52 opposing turns.
- **Measured and NOT shipped — Gravy deploys allies before hand attacks:** 165 -> 143. Allies keep ranking with attacks on printed power.
- Drill: test/gearpolicy.test.js (each branch found in self-play and its observable checked: the pool rises by the piece's {r}; four
  counters on Raydn and it swings that turn; the Boots are paid and the non-attack keeps the action point; the Crown leaves the hand
  the same size with the ally playable from the graveyard; Polarity reads 1 then 4; the readers refuse other gear and cards —
  sabotaged: each gate "none" fails its own drive, each reader stubbed fails its rows).
- Drills moved by the new trajectories (re-anchored, not weakened): test/arspay.test.js's "affordable attack" now asserts SPXPIECE
  (Blossom pays, the card in hand is kept — the old answer pitched it); test/explain.test.js lets `pieceRes` spend a resource piece
  beside `resUnlock`, and `gateFirst` / `pitchChi` are reached by the census now; test/freepick.test.js's Golden Tipple leg 8 -> "8b"
  and Blaze leg 10 -> "10d"; test/misplays.test.js's rxFit fixture enigma-kayo-0 -> enigma-kayo-2.
- Ladder `npm run play '' '' 3`: 816 games, 0 refusals / violations / stalls (3 engine-ended draws). Against the same ladder with the
  five gates off: **Gravy 30 -> 40, Boltyn 23 -> 28, Viserai BW 18 -> 21**; Arakni 47 -> 38 (she holds a Blossom: her own seat A/B'd
  level, 164 -> 163 of 384, so it is the field), everyone else within the band.
- **Validation:** npm test 4508 / 4503 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder above (the page changed only
  its version line).

## v6.55 — Gravy takes the Tipple

- **AI: Golden Tipple's rider is taken (`judge.cyclePick`, gate `SPXCYCLE`).** "When this attacks, you may discard a yellow card. If you
  do, draw a card and create a Gold token." The sheet is an optional self-discard whose rider (`ops`, carried by `optCostSpec`) draws
  the card back, and the structural "decline what is optional" turned down all 49 in the decline census (272 games): a Gold, the fuel
  Gravy's hero ability spends, refused for a hand of the same size. `cyclePick` names the card to give up (the lowest-power one the
  sheet admits) only for the seat's own one-card discard from hand whose rider draws at least one.
  Measured on his own seat, gate on vs off, 12 seeds each chair: **103 -> 135 of 384** (52 -> 70 first-named, 51 -> 65 second-named).
  Ladder `npm run play '' '' 3`: 816 games, 0 refusals / violations / stalls (1 engine-ended draw); Gravy 24 -> 30 against the same
  ladder gate-off, everyone else within the band.
- **Measured and NOT shipped — Arakni's dagger retrieves are right to decline.** Taking "you may retrieve a dagger" ({r}, graveyard to
  gear) whenever the seat could reach the price cost her **174 -> 143 of 384** (12 seeds each chair): the {r} is usually a pitched
  card, worth more than a 1-power dagger back. Taking it only from floating resources was level (172 vs 174). The structural decline
  stands; Corrupted Crown / Embrace Ursur (a whole card for +1) and Condemn to Slaughter are trade-offs, not leaks, and stay declined.
- Drill: test/goldtipple.test.js (the classifier with its exclusions; self-play finds the first Tipple sheet, it is taken, the card is
  in the graveyard, the hand is the same size and a Gold is on the board — sabotaged: `cyclePick` refusing fails both).
- **Validation:** npm test 4502 / 4497 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder above; both babel blocks compile
  (the page changed only its version line).

## v6.54 — Prism takes her figment

- **AI: Prism's Herald search is taken (`judge.freePick` class "put", gate `SPXPUT`).** "Whenever a card with Herald in its name is put
  into your soul during an action phase, you may search your deck for a figment, put it into the arena, then shuffle." The sheet is an
  optional pick from the deck into the arena, which none of H12's free classes (dead, rev, ars) covered, so the AI declined it every
  time (157 in 272 games) and her figments never left the deck. "put" is that class: free, nothing filtered, deck to arena. Taken, her
  hero ability awakens the figment into Suraya (an ally with Ward 4) and the deck plays as built.
  Measured on her own seat, gate on vs off, 12 seeds each chair: **170 -> 307 of 384** (84 -> 154 first-named, 86 -> 153 second-named;
  up on all 24 seeds). Ladder `npm run play '' '' 3`: 816 games, 0 refusals / violations / stalls / draws; Prism 38 -> 81 (2nd, behind
  Briar 85); every other hero within the band (each gives up a game or two to her).
- Drill: test/figmentput.test.js (the classifier with its exclusions; self-play finds the first figment sheet, it is taken, the figment
  is on her board and out of her deck — sabotaged: the class removed fails both).
- **Validation:** npm test 4500 / 4495 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder above; both babel blocks compile
  (the page changed only its version line).

## v6.53 — Blaze spends his energy

- **AI: Blaze's hero ability actually does something (`energyBanish` / `energyPick`, gate `SPXENERGY`).** "Remove X energy counters:
  banish a Wizard non-attack ... that deals arcane damage equal to X. You may play it this turn as though it were an instant." The
  policy activated it (93 times in 32 games) and then answered the banish sheet, an OPTIONAL pick, with the structural "decline what is
  optional": no card was ever banished and ~10 energy counters sat unspent at the end of every game. A new judge reader,
  `ctrPickTakers(g, seat)`, names what a counter-spending hero pick admits now (the same filter `legal` and the queue site build);
  the policy activates only when one of those cards is affordable, takes the biggest arcane it can still pay for, and plays a banished
  card that is playable now before the hand ("this turn" only). `arcaneOf` also reads the banished zone.
  After: 55 banishes in 32 games, every one played; energy left at the end 10.4 -> 5.2.
  Measured on his own seat, gate on vs off, 12 seeds each chair: **113 -> 136 of 384** (52 -> 65 first-named, 61 -> 71 second-named;
  first chair up on 9 of 12 seeds, down on 1). Ladder `npm run play '' '' 3`: 816 games, 0 refusals / violations / stalls / draws;
  Blaze 32 -> 40, nobody else outside the band.
- **The census that found it generalises** (`decline` probe: every optional pick the AI declined, by source). Still declined, for the
  next steps: Prism's free figment search on a Herald into her soul (157 in 272 games), Arakni's dagger retrieves (76, priced {r}),
  Golden Tipple's discard-for-draw-and-Gold (51), Corrupted Crown's hand banish (32), Condemn to Slaughter (18).
- Drill: test/energy.test.js (self-play finds the first `energyBanish`; the sheet is answered, X = the card's arcane is removed, the card
  is played from the banished zone the same turn with no action point spent — sabotaged twice: no reader, no pick branch).
- **Validation:** npm test 4498 / 4493 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder above; both babel blocks compile
  (the page changed only its version line).

## v6.52 — Lyath boos while he is the wall

- **AI: Lyath's hero ability, used where it pays (`rxBoo`, gate `SPXBOO`).** "{r}{r}, {t}: The crowd boos you. Defending action cards
  you control get +1{d} this turn" (and a Might token for his next attack) was only ever offered on his OWN turn, as the policy's last
  resort, where nothing of his defends: the wall half was wasted on all 50 uses in 212 measured turns. A new judge reader,
  `defActGainNow(g, seat, uid)`, says what an ability's `defActBuff` adds to the block declared right now (the amount times the action
  cards declared; 0 while the seat is not defending), so `sparring.js` still reads no card text. While damage would still get through,
  the reaction step boos first when the boo alone stops the leak, else after the defence-reaction cards for what they leave.
  Measured on his own seat, gate on vs off, 12 seeds each chair: **117 -> 140 of 384** (54 -> 66 first-named, 63 -> 74 second-named).
  Ladder `npm run play '' '' 3`: 816 games, 0 refusals / violations / stalls / draws; Lyath 30 -> 35, nobody else outside the band.
- Census leads ruled out on the way (so nobody chases them): Lyath's wall is NOT overstated (his halving is applied to the cards at
  build time, so `wallOf`'s printed numbers are already halved); the bottom heroes' "ended the turn with a legal play" cases are
  deliberate holds of resource gear (Blossom of Spring, Garland of Spring, Crucible of Aetherweave), not route gaps like Gravy's.
- Drill: test/boo.test.js (self-play finds the first `rxBoo`; reader = defending action cards; resolving it sets the grant and mints
  Might; on his own turn the reader answers 0 — sabotaged twice, and it says which guard it does NOT prove). Pins: allyseat's
  "hero ability after the attacks" re-anchored on the offence branch's own tag; keycensus records `isActionCard` as judge-only.
- **Validation:** npm test 4497 / 4492 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder above; both babel blocks compile
  (the page changed only its version line).

## v6.51 — the card you play flies to the slot; the coach looks in the graveyard

- **Motion (UX roadmap step 6, the last open step).** The pane jumps already slid (`scrollIntoView` smooth, snap). New: the commit tap of
  the two-tap hand (`tapTwice`, both boards) marks the tile's box (`Glide.mark`), and when the featured slot next shows THAT card it plays
  itself back from the tile to its own box (`FeatCard`: FLIP, one 240 ms compositor transform through the Web Animations API, no ghost
  element). Only the committed card glides (an opponent's play never does), a mark is used once and is stale after 2.5 s, and reduced
  motion turns it off. The slot scrolls, so its overflow is lifted for the flight and restored. Measured at 393x852 under 4x CPU throttle:
  every frame of the glide 17 ms; the one long frame (33–50 ms) is the play's own re-render and is there with the glide off.
- **The coach looks in the graveyard (`advisor.advise`).** The trainer's Coach's call listed hand, arsenal, weapon, hero and allies, so
  for Gravy Bones it never named a watery-grave replay (v6.50 taught the table's AI). It now asks `playZoneWhy` with the hero's flag
  (`ctx.wateryGrave`) and this turn's graveyard: "Play Swabbie from your graveyard".
- Drills: test/glide.test.js (both commits mark; both slots are `FeatCard`; reduced motion; one mark, once — each sabotaged);
  bluegy.test.js gains the coach row (with the no-watery-grave control; sabotaged).
- **Validation:** npm test 4496 / 4491 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; page.js 78/78 (0 page errors) plus
  the glide drive above; both babel blocks compile. No policy change (the coach is the trainer's advice, not the AI seat): no ladder.

## v6.50 — three sounds that mean three things; a type scale; Gravy replays his dead

- **Sound (UX roadmap step 9, POLISH §4).** A resolved link is heard as well as stamped: a hit is a low falling thud, a block a short
  bright clank, a prevention a falling hiss, three different shapes so they read with the screen off. All three are synthesized with Web
  Audio in the page (`Sfx`): no file, no CDN, nothing to license. `LinkSfx` sits beside `LinkStamp` on both boards and plays once when the
  last link gains its `out` (never for a board as it already stands when it mounts). A ♪ toggle on the board's nav row mutes it,
  remembered as `dawnblade.sound`; a phone keeps the audio context asleep until the first tap. Driven in the page: mount silent, an open
  link silent, its resolution one `hit`, a re-render silent, a new chain's prevention one `prevented`, muted nothing; every voice builds
  in Chromium without an error. Drill: test/sfx.test.js (voices = the engine's three outcomes; both boards listen; no audio file).
- **A type scale (UX roadmap step 8).** `--fs-xs … --fs-big` on `:root` (9/10/11/12/13/15/22/26px), and the 166 CSS sizes that matched
  one now name it; half-pixel steps stay literals. Every inline `fontSize` in the markup (12) became a class (`.fs-md` … `.fs-big`,
  `!important` so they keep the inline style's precedence over `.sheet h2`, `.heroplate .hact`, `.note`).
- **Rules: Gravy Bones' watery grave saw only blue ATTACKS.** "If a blue card has been put into your graveyard this turn" was a counter
  bumped in one place, `effects.fileAttack`. A blue non-attack (Portside Exchange, Avast Ye!, Loot the Hold, Loot the Arsenal, Flying
  High), a blue instant (Throw Caution to the Wind), a discard, a milled card and a blue block never counted, so in 16 measured games Gravy
  was offered a graveyard play ONCE. `parser.playZoneWhy` now also reads the graveyard (any blue card stamped `_gy` this turn — the same
  scan `allyDied` uses), and both boards pass it. Offers: 1 -> 17 in the same 16 games.
- **AI: a card the judge lets you play from the graveyard is a card you hold (`gravePlays`, gate `SPXGRAVE`).** The policy listed hand,
  arsenal and banished zone; with Oysten (cost 0) playable from the graveyard and the action point unspent its call was "Nothing you hold
  is worth playing". Measured on Gravy's own seat, same engine, gate on vs off: 41 -> 56 of 192 (12 seeds, Gravy first-named) and 20 -> 23
  of 96 (6 seeds, second-named): 61 -> 79 of 288, the same direction in every slice. Other heroes do not move (Briar and Kayo identical).
- Drills: test/bluegy.test.js (the parser's three rows; the table's `legal` with a blue non-attack filed this turn vs last turn vs a
  non-blue card; the AI plays a free ally from the graveyard rather than pass — each sabotaged). Width pins: the trainer's `tryPlay` slice
  27044 -> 27065, the style block 87035 -> 89304.
- **Validation:** npm test 4492 / 4487 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; audit unchanged; ladder
  `npm run play '' '' 3` = 816 games, 0 refusals / violations / stalls / draws; page.js 78/78 (0 page errors); both babel blocks compile.
- **Census (the new angle the handoff asked for): `npm run play '' '' 6`**, 1632 games, before this release: Gravy 7.2 of 32 a seed,
  Viserai BW 7.5, Boltyn 8.2, Lyath 9.2, Blaze 10.5 at the bottom; Briar 28.3, Kayo 25.3, Dorinthea 24.5 at the top.

## v6.49 — the prompt sheet pass (UX step 7)

- **A target sheet drew no cards.** `buildPrompt` deals `cards` for a `target` prompt and `promptChoose` takes an index into them, but
  `PromptSheet` rendered only the title and hint, so Confirm stayed dark forever (no card produces one today, so this was a livelock waiting
  for its first producer). It now draws the cards; a tap chooses, the chosen card is tagged TARGET.
- **The soak sheet printed a literal "{r}"** ("costs 1{r} of 4 reachable" — a template literal outside `PipLine`). The running total is
  now the sheet's stat (`PStat`, EndPanel's headline / stat / one primary button at sheet scale): a big "2/3 still gets through" in red,
  green at "all prevented", the cost line through `PipLine`.
- **Selection tags moved off the pitch pip.** "1st draw", "✓ chosen", "+2" sat over the card's top-left corner; they sit bottom-centre now.
- **Measured, not shipped: an instant hero ability first (`SPXAWAKE`).** Prism's awaken is an Instant, so the policy's
  last-resort branch spent no action point on it anyway. Offering it at the head of the turn fired earlier (15 of 20 activations with an
  action point left, vs 6 of 17) but Prism's seat won 82 vs 86 of 192 games (12 seeds): noise, so nothing ships: the patch is `experiments/awaken-first/` on `findings/queue`.
- **Wire budget: the opening snapshot 15821 -> 15202 bytes** (worst pair Iyslander v Blaze, budget 16384). `newMatch`'s `rulesBuild`
  keeps the hero record's print map (`pr`) only as far as it is read: `facesOf` asks which codes exist and whether each image is a back
  face, `heroAbilities` reads `_first` when an Agent goes home; every other URL becomes "" or a "_BACK" marker (`build.isBackImg`
  answers the same). Traverse, brood and wire drills unchanged. Next cut if needed: HZOOM (~500 bytes a seat).
- Drill: promptctl "a target sheet draws the cards it offers" (sabotaged: dropping the tap fails it). Width pins moved for the deliberate
  growth (sheet slice < 6400; phasebar 87035).
- **Validation:** npm test 4486 / 4479 pass before the last two pins (both fixed and rerun: slicecensus repin; allyseat's order pin,
  which retired the SPXAWAKE code); `npm run quick` 4238 / 0 fail / 5 skipped after; scenes 107/0; fairness clean; ladder 816 games,
  0 refusals / violations / stalls / draws; page.js 78/78 + every prompt kind driven at 393x852 (0 page errors); both babel blocks compile.

## v6.48 — every chain link says what became of it; the hero select shows the art

- **Hit, blocked or prevented, on the board (UX roadmap step 5, second half).** A resolved chain entry carries `out` — `"hit"` (damage was
  dealt), `"blocked"` (the wall stopped all of it) or `"prevented"` (damage got past the wall and a prevention took it all, CR 7.5.5) — from
  `effects.linkOutcome`, the one body: judge's strike, the trainer's own strike and the dummy's swing all feed it the numbers they already
  held (power, what got past the wall, what was dealt). The featured slot stamps the card that just resolved (red HIT n, bone BLOCKED, blue
  PREVENTED; `LinkStamp`, only while the slot still shows that link — `featOutcome`), and the chain tiles dim a blocked link and ring a
  prevented one blue. **WIRE_V 44 -> 45** (a chain entry gained a field). Drill: test/linkout.test.js (self-play at the table checks every
  new attack entry against the damage dealt and must see both a hit and a block; sabotaged twice).
- **The hero select (UX roadmap step 4).** Roster tiles show the illustration, not the whole card (zoomed past the frame and the printed
  name); names 10.5px, and a name the tile cannot hold shows its first word ("Lyath"). A picked hero gets a banner right under the roster —
  art, class and block with the block's colour, the name, the one-line pitch — where before the only sign was a gold outline and the sheet
  sat below the fold. The legend names every group on the roster (Usurp the Shadow Throne had no key). Kept at 6 across, not the roadmap's
  4: at 4 across Battle falls off the first screen at 393x852. Before/after: `docs/ux/before-heroselect.jpg`, `after-heroselect*.jpg`,
  `after-linkstamp.jpg`.
- **Measured, not built: the AI does awaken a figment.** The v6.47 note said it never did; a probe of 12 seated Prism games saw 10 awakenings
  (the hero ability is the policy's last-resort play, legal at 315 of 3014 decisions). A stronger awaken timing is an open H-item lead.
- **Validation:** npm test 4485 / 4480 pass / 0 fail / 5 skipped; scenes 107/0; fairness clean; ladder `npm run play '' '' 3` = 816 games,
  0 refusals / violations / stalls / draws; page.js 78/78 + drives (trainer link stamp; hero select with real art at 393x852 and 360x740,
  no clipped name, no sideways scroll, 0 page errors); both babel blocks compile. WIRE_V 45; the function is redeployed.

## v6.47 — Prism, Advent of Thrones opens; a new result screen, life display and hand rail

- **The seventeenth hero.** Prism, Advent of Thrones joins the roster (key `prism`), under the RULING (user, 2026-11-15) that a
  precon joins when the engine reads its whole list: the census reads 32 full / 0 part / 0 none. Gate: `node tools/staged-play.js prism 20`,
  640 seated games, 0 refusals / violations / stalls / draws, 281 won.
  Opening: `pin-pool.js --add-staged` (27 records, and it now brings a flip-card's back: Suraya), **DATA_VER sage-v18 -> sage-v19**, SAT a
  Silver Age set, `data/formats.json`. The pool census pins that moved were each read and noted in their drill (40 of them).
- **Readers built for her (one release, user's plan of 2026-11-18):** "put it into your soul and <rider>" is two ops; "with Herald in its
  name" is a qualifier; figments enter the arena as permanents (CR 8.2.16) and Prism's ability awakens one into Suraya (CR 8.5.43, 9.1.3;
  the front is filed off the arena, invariant BACK-FACE-OFF-ARENA); her Herald-to-soul trigger searches for a figment; Iris of Reality's aura
  grant; **Spectra** (CR 8.3.14, quoted): a Spectra permanent can be attacked, and attacking it destroys it and closes the chain
  (`effects.spectraStrike`; stated approximation `spectra-trigger-at-once`: no stack layer of its own); "loses and can't gain phantasm"
  (Passing Mirage, Dream Weavers); Pierce Reality's first-Illusionist-attack +2{p} (`hist.atkTy`); -1{p} while defending (Herald of Triumph)
  and Herald of Victoria's discard; Lay Low; Herald of Judgment's banished-zone lock (both boards); Luminaris' or-group.
  **Ironhide Gauntlet** (her arms) read `full` but dropped its quoted "When the combat chain closes, destroy this." (an unanchored +N{d}
  matcher): stronger than printed. Now `breakAtClose`; the pay answer marks the piece and `game.gearBlockApply` destroys it on both boards
  (test/ironhide.test.js, sabotaged twice). Drills: herald, figment, iris, spectra, phantasmlose, heraldminus, laylow, luminaris — each sabotaged.
- **The AI never awakens a figment** (next H-item). She still wins 44% of seated games, so she opens as an AI seat as well as for people.
- **The cup past sixteen heroes** (CEO default, for the user to overrule): every hero plays the qualifier; the bracket seats its top sixteen
  and prints who did not qualify.
- **The screen (docs/ux/UX-ROADMAP.md, before/after shots in docs/ux/):** one result screen for every ending on both boards (`EndPanel`:
  opaque, tinted by outcome, a large headline, life left, a full-width leave button); `LifeHud` shows both life totals at 30px with labelled
  action-point and resource chips, and every life total flashes red/green when it moves (`LifeNum`); buttons answer a press; the hand rail
  says how many cards are off-screen (`RailMore`); your board's bottom pills stay inside the pane on short phones; the loadout has ONE primary
  button, named for the foe you picked (it used to start the trainer even with an AI hero picked).
- **Cheaper sessions:** `npm run quick` (the inner loop; skips the server-referee family, ~60% of the suite's CPU); `node tools/supabase-deploy.js`
  (cut, deploy, stamp in one command); CHANGELOG.md keeps v6.30 on (older in `docs/archive/CHANGELOG-to-v6.29.md`); QUEUE.md's history moved to
  `QUEUE-ARCHIVE.md` on findings/queue.
- The roster legend counts its heroes (it said 15) and the format note no longer says "the fifteen precons".
- **Validation:** npm test 0 fail / 5 skipped; scenes 107/0; fairness clean; audit 455/455 full (baseline rewritten after reading);
  ladder `npm run play '' '' 3` = 816 games (17 heroes), 0 refusals / violations / stalls / draws, Prism 39 wins; `staged-play prism 20` =
  640 games, 0 / 0 / 0; page.js 78/78 + a drive with Prism seated (0 page errors, no sideways scroll); both babel blocks compile.
  No WIRE_V change (`hist.atkTy` rides inside `hist`; a gear piece's `brk` is a per-instance diff). The function is redeployed.

## v6.46 — Viserai, Between Worlds opens

- **The sixteenth hero.** The Usurp the Shadow Throne precon joins the roster (`HEROES`/`DECKS` key `viseraibw`, the list exactly as
  `data/newsets.json` pins it), under the RULING (user, 2026-11-15) that a precon joins when the engine reads its whole list. The census
  printed no gap for it, both hero faces included (v6.37-v6.45). The loadout names his block, "Usurp the Shadow Throne", instead of a
  chapter (`blk`; `ch: 4` only picks the stripe colour).
- **Two Viserais on one roster.** Every hero label cut the name at its comma, so both tiles read "VISERAI". One helper, `heroShort(h)`
  (`index.html`), reads an optional `short` and falls back to the old cut; his is "Viserai BW". Driven at 393x852: the tile, its SBW001 art,
  the block's stripe, the sheet, the decklist, the loadout's weapons and 18 trainer taps with him seated, 0 page errors, no sideways scroll.
- **The pool:** `node tools/pin-pool.js --add-staged` (new) adds the staged records the decks now need, and the other face of a needed
  hero, keeping every other record byte for byte: 27 records (797 -> 824), no live download, so no unreviewed upstream drift rode along.
  A full re-pin takes a needed name `develop` lacks from `data/staged.js` too. **DATA_VER sage-v17 -> sage-v18.** `cards.SA_SETS` gains SBW.
  `data/formats.json` fields him; `tools/silver-age.js` rederived (no new ban).
- **A bug found by dealing him:** Murmuring Gloomblade prints "When this attacks or hits, create a Runechant token" and only the hit half was
  read, so the attack made nothing (weaker than printed). Two occasions, one payload: the "enters or leaves" precedent (`alsoAtk`, the attack
  half on `fx.onAtk` at declaration). Drilled in `test/runechants.test.js`, sabotaged.
- **The keyword ledger** (`tools/ledger.js`) knows Blood Debt, Usurp and Traverse (each live, CR cited).
- **The audit** (`npm run audit`: 430 unique cards, all `full`) read his cards with two old blind spots, both fixed in the tool: its token
  scan still cut "Gate to i'Arathael" to "Arathael" (the pinner's v6.41 pattern now), and its go-again check looked only at the four
  top-level lists, so a go again carried on a cost's rider or a trigger's own list read as unparsed. Walking the whole parse cleared those
  and six OLDER false flags (Jack Be Quick, Jittery Bones, Light the Way x2, Refraction Bolters, Swift Shot), each checked: the `ga` sits
  on the clause that prints it. Flagged cards 13 -> 7. Baseline rewritten after reading the diff.
- **The AI's answer to the traverse sheet has its own reasons**, `traverseStay` / `traverseBack` (`judge.traverseOffer` names the modes; the
  AI reads no card text). Measured: turning back won 15 of 180 seated games and staying 17, noise, so it stays (gate `SPXTRAV`, off unless
  it names a seat).
- **HE IS A WEAK AI OPPONENT** (a person piloting him is unaffected): seated in self-play he wins about one game in nine. Measured, it is not
  the engine (the deck reads `full`, card by card) and mostly not sequencing (66% of his usurp attacks find a Runechant): his printed attacks
  average 2.6 power (the old Viserai's 3.6, Kayo's 5.6) and the deck lives on combos the rule policy does not plan. Policy work, queued.
- **The cup:** sixteen heroes now fill the bracket, so the dummy (seated by the 2026-08-16 ruling because fifteen heroes left a seat empty)
  enters only while the roster is short. **Self-play:** `npm run play '' '' 3` is 720 games now.
- **Repins, each read first and noted in place:** roster and deck counts, the pool size and type census, the journeys, the condition, fx,
  spec-field, on-hit, defends, hand-ability, tier, trigger and dead-reader censuses (each addition one of the readers built for his staged
  cards), the anchors' four "staged only" entries (reached now), the new-sets drills (turned to "in the pool exactly when its hero opened",
  plus a check that his deck IS the pinned list), the feed-leak drill (a DISCARD is a reveal: the sixteenth hero re-paired its games and a
  discarded Reincarnate going to the deck bottom read as a leak).
- No WIRE_V change. The function must be redeployed (`APP_VER`, `DATA_VER`, engine and data files).

## v6.45 — a 0 defence piece may defend; a blank one may not

- **RULING (user, 2026-11-16):** "0 defense can be declared as a blocker (blank cannot)". CR 7.3.2b (verbatim): "A card cannot be declared if (A) it does not
  have the defense property (0 is a value), ...". CR 2.3.2: "0 is a valid printed defense"; a card with no printed defence has no defence property.
- **Was:** both boards refused any equipment at 0 defence, printed or worn ("has no defence left"), so 27 dealt 0{d} pieces could never defend and the staged
  Olde Leather Boots' "+2{d} if attacked twice" was unreachable. **Is:** one reader, `game.gearDeclareWhy`, called by `judge.legal` and the trainer's
  `toggleBlock`, `gearBtn` and defend list: refuses a piece that prints no defence (a weapon, a blank equipment: 6 pool pieces) and a destroyed piece, nothing else.
  A piece worn down to 0 may be declared again too (it stops nothing, and Blade Break / battleworn still apply).
- **The AI did not move.** Its wall still picks only pieces with defence above 0, so it never throws a 0 piece in (drilled). It therefore never raises the
  Boots for their +2 either: policy work for when Viserai is an AI seat.
- **`tools/approx.js` `zero-defence-gear-refused` is CLOSED** (open 3 -> 2, closed 39 -> 40); its probe now drives the Boots on the second attack of a turn and
  reads the 2 they stop. `test/defcap.test.js`: the old "no defence left" pin is replaced by four drills (every 0{d} pool piece declarable, every blank refused,
  a driven Blade Break 0{d} block, the policy holds back). Sabotaged four ways, each bit. CR index 103 -> 104 cited / 93 -> 94 guarded (CR 2.3.2).
- **No WIRE_V change** (no payload or prompt shape moved). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.44 — the seventh reader for Viserai, Between Worlds: the double-faced hero and traverse

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`), and the LAST reader: `node tools/newdecks-census.js` prints no gap for
  Viserai's list, hero included, both faces (the census now reads a hero's other face too). `npm run audit`: the pool is unchanged.
- **The card** is two records sharing a print code (data/staged.js): Viserai, Between Worlds (Young, 20 life) "Whenever you create 1 or more Runechants, banish the
  top card of your deck. Then if you've created 3 or more Runechants this turn, traverse." and Viserai, Usurper (Demon, life "*") "The first attack action card with
  blood debt you play each turn gets go again." / "At the beginning of each end phase, if you've created or activated a Gate to i'Arathael this turn, you may traverse."
- **Traverse is CR 8.5.60 / 8.5.60a** (quoted verbatim at `effects.traverse`): the non-active face becomes the active one; it fails on a card with no other face, or
  when the ability that asked belongs to a face no longer active. One body, the brood's (v3.76): the ability half of the build is replaced by
  `build.heroAbilities` of the other face; deck, gear, intellect and the arena are untouched (CR 9.1.2c). `build.facesOf` finds the other face: a HERO record
  sharing a print code where exactly one of the two images is the back (`_BACK`). The pinned records carry no field linking faces, and a shared code alone is not
  enough: upstream has a promo code printed on two unrelated heroes (measured over 5,218 records). The build remembers the face it left (`_face`, beside `_brood`).
- **Four passives off the printed lines** (`build.heroAbilities`, `PASSIVES`, `tools/audit.js` `HERO_STATICS`): `runeBanish`, `runeTraverse` (the printed 3),
  `firstAtkGaKw` (the printed keyword), `endTraverse` (the printed token name).
- **Three per-turn facts** in `freshHist`, recorded in `effects.js` for every hero (the facts are the turn's, not the face's): `hist.runes` (Runechants created, the
  special ones included; one `runesMade` call per creation EVENT from the `rune` and `token` ops, Viserai's rite and the on-hit mint, so "1 or more" banishes one
  card), `hist.actNames` (arena permanents activated, by name), `hist.atkKws` (printed keywords of attack action cards played, so "first ... each turn" survives a
  mid-turn traverse).
- **The Usurper's go again** is granted in `execute` beside Compass's first-graveyard-play grant; `judge.keepsActionPoint` answers it for the AI (hand, arsenal and, for
  this grant only, the banished zone, where most blood debt attacks are played from; a banished card's own go again is still unread there, as before).
- **The end-phase "you may traverse"** is step (10) of `beginEndPhase`: EACH end phase, both seats asked, a two-mode sheet addressed to the hero's own seat
  (staying is the first mode, so the seat policy keeps its face; the end phase holds for the answer, v5.71's route).
- **LIFE CARRIES OVER: a reading, `tools/approx.js` `traverse-life-carries` (stated, probe driven).** The back prints life "*", which the CR does not define
  (CR 2.5.3c recalculates only from a new base value); the Agents of Chaos print the same and keep Arakni's life. The game starts on the front, the Silver Age legal face.
- **Drill `test/traverse.test.js`** (sabotaged twenty-four ways, each bit).
- **`tools/staged-play.js` (new) seats a staged hero for self-play**, the roadmap's gate before a hero opens: `node tools/staged-play.js viseraiBetweenWorlds 21` =
  630 games, 0 refusals, 0 violations, 0 stalls, 225 games ended on the other face. The gate is met. **The AI cannot pilot him yet: 72 won, 558 lost** (it plays
  1.1 cards a game from the banished zone and ends a quarter of his turns with the action point unspent); that is policy work, and a person piloting him is unaffected.
- **Pins repinned after reading:** `runOps` vocabulary 100 -> 101 (`traverse`, no parser emitter), CR index 97 -> 103 cited / 87 -> 93 guarded (8.5.60, 8.5.60a,
  9.1.1, 9.1.2, 9.1.2c, 2.5.3c), the approximation ledger 61 -> 62 (19 -> 20 stated), WIRE_V (dichotomy, wire).
- **WIRE_V 43 -> 44** (three `hist` facts, a build's `_face`, an op). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).
- **OWED BEFORE VISERAI OPENS:** the pool's `byCode` map lets the back face overwrite the front under the shared print code (a hero resolves by NAME first, so
  nothing breaks today); `pin-pool.js` must take BOTH faces; the trainer's route for the traverse sheet is undriven; the AI has no policy for when to turn back.

## v6.43 — the eighth reader for Viserai, Between Worlds: the small conditionals

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (851 parses, before and after): exactly
  SIX records read differently, all staged and all `part` -> `full`: Olde Leather Boots, Galaxxi Black, Bloodfrenzy Gloomblade (both printings), Plundersong Gloomblade,
  Looking for a Scrap. Census: Viserai 29 / 6 / 0 -> 35 / 0 / 0 (only the hero's own clauses, reader 7, are left).
- **Three per-turn facts** in `freshHist`, each recorded where it becomes true in `effects.js` (both boards): `hist.attacked` (`noteAttacked`, at the attack's
  declaration in `execute`, only when the attack-target is the hero, CR 1.4.5; the trainer's scripted dummy swing calls it too), `hist.heroDmg` (`creditHeroDmg`, where
  damage LANDS on the opposing hero after prevention, CR 6.4.10a quoted: combat on both boards, arcane, the soak answer, direct damage; CR 7.2.3b makes "the defending hero"
  the attack-target's controller, always the opponent with two seats), `hist.banPlay` (where a played card leaves the banished zone).
- **Olde Leather Boots** ("if you've been attacked 2 or more times this turn, this gets +2{d}"): `defSelf.when = "attackedN"`, answered by `defSelfMet`.
  **Galaxxi Black** (+2{p} after a card played from banish): cond `banPlayed`. **Bloodfrenzy Gloomblade** (go again after damage to the defending hero): cond `dealtHero`,
  its own record and deliberately NOT `dealtDmg`, which reads "an attack was played" (`hist.atk || hist.arc`). **Plundersong Gloomblade**: "they banish a card in their
  arsenal" is `foeArsBanish` with its subject printed.
- **Looking for a Scrap** ("As an additional cost to play this, you may banish a card with 1{p} from your graveyard. If you do, this gets +1{p} and go again."): a COST,
  so not `optCost` (a queued prompt, which drains after the card resolves). `fx.banCost` (subject pinned: printed power exactly N, else `optFilter`, which refuses a bare
  card), the rider's ops as `fx.conds` gated on `banCostPaid` (THIS play's payment). Asked before the card resolves on both boards off one reader
  (`prompts.banCostChoice`: every different card that could pay; "you may", so one candidate is a question and Decline is an answer): judge's `bancost` pending
  (`maybeBanCost`, between usurp and charge) and the trainer's `bancostpick` sheet. Paid at the top of `executeInner`, re-derived (`banCostPaid`). The AI answers through
  `judge.banCostAnswer` / `banCostWorth` (playable from banish +1, blood debt -1; pays at worth 0 or more), reason keys `bancost` / `bancostNo`.
- **Usurp open item (b) closed:** `effPowerNow` counts usurp's +2 (gate `usurp`) with the cost site's exclusion (never a weapon or ally swing, only when a Runechant
  can pay), and the Coach (`advCardOut`) counts +2 less the spent Runechant's arcane.
- **Drill `test/conditionals.test.js`** (sabotaged twenty ways, each bit).
- **OPEN (`tools/approx.js`, 59 -> 61 records, 1 -> 3 open):** `zero-defence-gear-refused` — CR 7.3.2b says "0 is a value", but both boards refuse to declare a 0{d}
  piece ("has no defence left"; `test/defcap.test.js` pins the worn-to-zero refusal), so the Boots' +2 is unreachable at the table today, and 27 pool 0{d} pieces
  cannot defend either (weaker than printed). `dealt-damage-reads-attacks` — Second Strike's "if you've dealt damage this turn" reads attacks PLAYED (stronger than
  printed after a blocked swing); left alone because Second Strike is a dealt card.
- **Pins repinned after reading:** WIRE_V (dichotomy, wire), the pending kinds the table demuxes (`split.test.js`, +`bancost`, window 560 -> 600), the trainer's busy
  lists (`soulcost.test.js`), the sheet doors (+`confirmBanCost`, an answer), `runechants.test.js` (usurp now hands on to `maybeBanCost`), the approximation ledger.
- **WIRE_V 42 -> 43** (a pending kind, an action, a held declaration, three `hist` counts). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.42 — the sixth reader for Viserai, Between Worlds: the special Runechants

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (851 parses, before and after): exactly TWO
  records read differently, Runechant of Lust and Runechant of Sloth (`part` -> `full`). `npm run audit`: the pool is unchanged. Census: Viserai 27 / 8 / 0 -> 29 / 6 / 0.
- **The cards** (Runeblade Instant - Aura): "This counts as a Runechant. When an attack usurps this, create a Runechant token. [Sloth: ... it gets go again.] When this is
  destroyed, create a Runechant token. At the beginning of your action phase or when you play an attack action card, destroy this."
- **"Counts as" is CR 1.8.8** (quoted verbatim at `fx.countsAs`): the card IS a Runechant to every rule and effect that asks, without gaining the token's text.
  `parser.isRunechant` is the one reader, so `runeCount` (the "{r} less for each Runechant you control" discounts, the pips, the report), usurp and Runebleed Robe's
  "destroy ... a Runechant you control" (`boardEntryNamed`) all see them, on both boards.
- **Usurp asks WHICH Runechant when the choice matters** (handoff's Usurp open item a). `parser.usurpTargets` (the candidates), `usurpOffer` (one uid per DIFFERENT card,
  null while every candidate is the same card: a board of plain tokens asks nothing, exactly as before) and `usurpTarget(sd, uid)`. The answer is a COST, so it is a `pending`
  settled before the card resolves: `judge.maybeUsurp` -> `usurp {uid}` (no decline: "if able"), and the trainer's `usurppick` sheet; it rides to `execute` as `_usurpUid`
  (a `HELD_DECL`), which re-derives it. The AI answers through `judge.usurpAnswer` / `usurpWorth` (what destroying it pays, less the arcane it would have dealt), reason key `usurp`.
- **"When an attack usurps this, ..."** (`fx.onUsurp`: a Runechant token, or go again for the attack), paid where usurp is paid, gated on the played card being an attack.
- **"At the beginning of your action phase or when you play an attack action card, destroy this"**: the attack-play trigger reads with an empty payload and the leading event
  becomes the start-of-turn schedule (`selfDestruct "turn"`, `sweepArena`), the one every "at the beginning of your action phase, destroy this" card rides on.
- **"When this is destroyed, create a Runechant token" did NOT already work** (ask the engine, not the note): it parsed, but `fx.onDestroy` was paid at one site only (an attack
  popped by phantasm). It is now paid wherever a permanent is destroyed — usurp, the attack-play trigger, the start-of-turn sweep and the Robe's cost — through
  `effects.fileDestroyed` (a real card goes to its owner's graveyard, turn-stamped; a token ceases to exist) and `effects.payDestroyed` (its controller's line). Usurped Lust
  pays two tokens; both are made below the firing-set capture, so neither pops on the attack that usurped it (v2.23's rule).
- **Drill `test/runechants.test.js`** (sabotaged twenty ways, each bit).
- **Pins repinned after reading:** WIRE_V (dichotomy, wire), the pending kinds the table demuxes (`split.test.js`, +`usurp`, window 520 -> 560), the trainer's busy-mode
  lists (`soulcost.test.js`), the sheet doors (+`confirmUsurp`, an answer), the policy census (`usurp` is driven by the drill, no pool deck reaches it), the `tryPlay` slice
  (26,993 -> 27,014: `usurppick` in the busy list, `maybeUsurp` at the payment's exit), CR index 93 / 83 -> 94 / 84 (CR 1.8.8), the approximation ledger (58 -> 59 records,
  0 -> 1 open).
- **OPEN (`tools/approx.js` `destroy-a-runechant-cost-unasked`):** Runebleed Robe takes a token before a special Runechant and does not ask; weaker than printed.
- **WIRE_V 41 -> 42** (a pending kind, an action, a held declaration). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.41 — the fifth reader for Viserai, Between Worlds: the Gate to i'Arathael

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (850 parses, before and after): exactly ONE
  record reads differently, the Gate itself (`none` -> `full`).
- **The card:** Gate to i'Arathael (Shadow Token - Aura), "Instant - {r}, destroy this: You may play target action card with blood debt from your banished zone this turn."
- **A CORRECTION to v6.40's stated limit, by asking the engine and not the note:** the token was ALREADY minted. Its record is in the pinned pool and Pull from Beyond's rider
  resolves it (driven: a red card banished puts a real Gate in the arena). What was missing was the Gate's ABILITY: the table refused the activation ("prints no attack or
  ability to activate") and the token sat there as a blank.
- **The reader is no new machinery.** The printed target is declared when the ability is activated, before the cost (`abTargetSpec`, v5.72, Beckoning Haunt's route; one legal
  target is declared on the spot, two are a question); with no legal target the activation is refused and nothing is paid (RULING 2026-11-13). The pick is over the banished zone
  and moves nothing; the answer stamps the chosen card playable for this turn (`_playTurn`, the window `parser.playZoneWhy` has read on both boards since v3.92). The card is
  then played by the ordinary route: its own speed, its own cost, an action point, and the graveyard afterwards (RULING 2026-10-31), with the permission stripped as it leaves.
  "You may play" is the permission, not an option on the target. The destroyed token ceases to exist.
- **Parser:** `RX_BAN_PLAY`, anchored whole (no window printed, another zone, an unreadable subject or a speed rider all refuse); "blood debt" joins the closed keyword
  vocabulary a printed "with <keyword>" may name (`KW_VOCAB_SRC`), answered by `printedKw`, so a card that only mentions blood debt is not a target.
- **The feed** says the card "may be played from the banished zone this turn"; the borrowed lines ("is banished", "revealed from") described a move that did not happen.
- **Both boards' target buttons** look in the banished zone as well as the graveyard (the trainer's `targetpick`, the table's `abtarget`).
- **The token-name scan reads the Gate's whole name** (`tools/pin-pool.js` `tokenNames`: a lowercase "to" and a word opening with a lowercase letter and an apostrophe). It read
  "arathael" before, which a re-pin would have gone looking for. Measured: the only name that moves. The probe in `test/staged.test.js` is now an assertion.
- **Drill `test/gate.test.js`** (sabotaged thirteen ways, each bit). The fixture is a twin, and has to be: every blood debt card in the staged list also prints "You may play
  this from your banished zone", so a staged card is playable with or without the Gate (asserted, so the day that changes the drill says so).
- **Pins repinned after reading:** the tokens reading nothing (6 -> 5), the arena activation census (the Gate moves from refuses to reads), the activation-pick family (seven),
  the own-card hazard (an arena permanent is allowed when the picked zone is not the arena), `applyPrompt`'s answer reads (+`banStamp`), the tier counts (762 / 24 / 11).
- **STATED LIMITS:** the trainer's route is the shared one but is undriven for the Gate (no deck can hold it yet); the AI seat declares a target when asked but has no policy for
  WHEN to open a Gate, and no reason key for it; "created or activated a Gate this turn" (Viserai, Usurper) has no per-turn fact yet: that is the hero's reader (7).
- **No WIRE_V change** (no new prompt or payload field: `banStamp`, `zone` and an absent `to` all existed). No DATA_VER change. The function is redeployed because
  `APP_VER` and engine files changed.

## v6.40 — the fourth reader for Viserai, Between Worlds: banish a card, then ask what it was

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Three staged cards print one idea three ways: the card banishes something and the rest of
  its text is about THAT card. Measured over the pinned pool: no record prints "banish a card from your hand", none has an op after an opt, and Soul Shackle (the one pool card
  printing "banish the top card of your deck", as a start-of-phase trigger) reads exactly as it did.
- **Pull from Beyond** ("Opt 2. Banish the top card of your deck. If it's red, create a Gate to i'Arathael token."): a new `banTop` op (the seat's own deck, `foeBanishTop`'s twin);
  the colour rider rides on the op and is answered off the banished card's printed pitch. **New engine fact: what a card prints after an opt waits for the opt.** The banish rides
  on the opt sheet (`op[2].then` -> the prompt's `ops`) and runs when the sheet is answered, on the deck the player arranged; before this an op beside an opt would have run first.
- **Embrace Ursur** ("When this attacks, you may banish a card from your hand. If it's Runeblade, create a Runechant token. If it's Shadow, this gets go again."): `optCost`'s offer
  with `classRiders`, the list form of Halo of Illumination's `classRider`; each is asked about the banished card, both can be true, and go again reaches the open chain link.
  The class words are a closed list (the two the card prints); every rider must read or the card stays unclaimed.
- **Corrupted Crown** ("When this defends, you may banish a card from your hand. If you do, this gets +1{d}."): a bare "card" is pinned by the printed hand (banish only); the +1
  lands on the defending piece (`defUid`, as the pay-cost family does); **a card declared as a defender is not offered as the cost** (the table keeps the wall's cards in `hand`).
- **Drill `test/banishif.test.js`** (sabotaged ten ways, each bit): the parses; the refusals (an unlisted class, a colour asked as a class, an unreadable payload, a bare card with
  no hand printed, a rider that is not the next clause); at the table, the opt is answered before the banish and the colour decides the payout; all four class cases and the
  decline for Embrace Ursur; the Crown paid (wall of 2) against declined (wall of 1), and the blocking card missing from the sheet.
- **STATED LIMITS:** the Gate to i'Arathael token is the next reader, so Pull from Beyond's payout names a token the engine cannot mint yet (it reports that and creates nothing);
  the trainer's wall and the AI's answer to these two sheets are undriven. Nobody can be dealt these cards.
- **WIRE_V 40 -> 41** (an opt prompt carries `ops`, a pick prompt carries `defUid`). No DATA_VER change. The function is redeployed because `APP_VER` and engine files changed.

## v6.39 — the third reader for Viserai, Between Worlds: Usurp

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`): seven staged cards print Usurp (the six Gloomblades and Runic Disposition). Measured:
  `parser.usurps` answers no pool record.
- **The rule, verbatim (CR 8.3.49, rules.fabtcg.com):** "Usurp is a play-static ability that means 'As an additional cost to play this, destroy a Runechant if able. If you destroy a
  Runechant in this way, this gets +2 {p}.'" 8.3.49a: "If a player pays the additional cost to play a card with usurp, the player and the played card are considered to have usurped and
  Runechant that was destroyed is considered to have been usurped."
- **Built once, in the shared play path** (`effects.execute`, so both boards): the Runechant is destroyed BEFORE the attack-play auras are captured, so the usurped one deals no arcane
  damage and the others still pop; the +2 is a gain (under Chokeslam's cap, not base); the chain link carries `usurped`. "If able" is not "you may": nothing is asked, and with no
  Runechant the card is played at printed power. Readers: `parser.usurps` (`printedKw`), `parser.usurpTarget`.
- **Drill `test/usurp.test.js`** (sabotaged five ways, each bit): 0 / 1 / 3 Runechants at the table (power, Runechants left, arcane dealt); an attack without the keyword pays and gains
  nothing; the +2 lands as damage; the card's own discard ability does not usurp; a card that only names usurp, and an aura that is not a Runechant, are refused by the readers.
- **STATED LIMITS, for the readers that follow:** the special Runechants ("This counts as a Runechant", "when an attack usurps this") are unread, and when they are, choosing between
  two different Runechants is a choice the player is owed; the AI's power readers (`judge.effPowerNow`) and the trainer's Coach do not count the +2 yet. Nobody can be dealt these cards.
- **No WIRE_V, no DATA_VER change** (`pend.usurped` rides the link like its other optional facts). The function is redeployed because `APP_VER` and engine files changed.

## v6.38 — the second reader for Viserai, Between Worlds: Blood Debt

- **Nothing a player can be dealt changed.** Engine groundwork for the new decks (`ROADMAP-NEWDECKS.md`): six Gloomblades of *Viserai, Between Worlds* print Blood Debt, and they are
  staged (`data/staged.js`), not in the pool. Measured: `parser.bloodDebt` answers no pool record.
- **The rule, verbatim (CR 8.3.11, rules.fabtcg.com):** "Blood Debt is a triggered-static ability. Blood debt means 'While this is in your banished zone, at the beginning of your end
  phase, lose 1 {h}.'" 8.3.11a: "Blood debt only triggers if its source is public in the banished zone at the beginning of the owner's end phase."
- **Built once, for both boards:** `parser.bloodDebt(banish)` names the carriers (`printedKw`, so the Gate token's "with blood debt" is a reference and owes nothing);
  `effects.beginEndPhase` step (6a) takes one life per carrier in the seat's own banished zone. It is life loss, not damage (CR 8.5.12b): no prevention, no hit. Every card in `banish`
  is public here (intimidate's face-down card lives in its own field), which is 8.3.11a.
- **A beginning-of-end-phase trigger can now end the game.** `judge.doEndTurn` asks `winCheck` after the triggers and stops before step (a); the trainer's `endTurn` and `foeEnd` ask the
  same question at the same beat.
- **Drill `test/blooddebt.test.js`** (sabotaged five ways, each bit): carriers not references; one life per card, owner's end phase only, banish only; a prevention shield does not stop
  it (with a control that the same shield stops 1 damage); at the table the debt is paid and the turn goes on; a hero at 1 life with a debt has lost before the handoff, and at 2 survives.
- **Still unread on those cards:** Usurp (reader 3). **No WIRE_V, no DATA_VER change.** The function is redeployed because `APP_VER` and engine files changed.

## v6.37 — the first reader for Viserai, Between Worlds: "You may play this from your banished zone"

- **Nothing a player can be dealt changed.** This is engine groundwork for the new decks (`ROADMAP-NEWDECKS.md`): the six Gloomblades of *Viserai, Between Worlds* print the line, and
  they are staged (`data/staged.js`), not in the pool. Measured: no pool record sets the fact, before or after.
- **The clause is read now.** `classifyClause` answers the printed line and forwards the card fact `fromBan`. The ROUTE was built at v3.00 (`parser.playZoneWhy`, asked by both boards) and
  waited for a card to print it; until now the line reported unread. The census (`node tools/newdecks-census.js`) moved Viserai's rows from 12 full / 14 part / 9 none to 12 / 19 / 4.
- **Drill `test/banroute.test.js`** (sabotaged three ways): all six read the line; at the table a banished Gloomblade is played once, deals damage, files to the graveyard turn-stamped
  (RULING, user, 2026-10-31) and is refused from there; an attack that does not print the line is refused from banish; the Gate token, which only talks about banished-zone plays, grants
  itself nothing.
- **Still unread on those cards:** Usurp and Blood Debt (readers 2 and 3). A Gloomblade today is weaker than printed, and nobody can be dealt one.
- **No WIRE_V, no DATA_VER change.** The function is re-bundled and redeployed because `APP_VER` and `engine/parser.js` changed.

## After v6.36 (2026-11-15, not a release) — the pool may grow, and the two September precons are staged

- **RULING (user, 2026-11-15, "Yes to all"):** (1) Dawnblade is no longer frozen at fifteen: a new Silver Age precon joins the pool when the engine reads its whole list, and Silver Age's
  ban list and hero bench still never remove anything (`data/formats.json` `dawnblade.growth`, `test/formats.test.js`); (2) the text of *Prism, Advent of Thrones* (SAT) and *Viserai, Between
  Worlds* (SBW) is pinned now from the-fab-cube's unmerged `usurp-the-shadow-throne` branch instead of waiting for the merge into `develop`.
- **`data/staged.js`** (new; `tools/pin-staged.js`, source recorded as a commit) holds every record with a SAT or SBW printing, both faces of the two-faced cards, and their tokens. **The page
  does not load it**: no page, `APP_VER`, `DATA_VER`, `WIRE_V` or server function change, so nothing a player can see moved and the version did not bump.
- **`test/staged.test.js`** (sabotaged): every row of both lists resolves by its own print code (the pool alone must not); both faces present; a card the pool already holds reads the same in
  both files; the phone never sees the file. One probe records that the token-name scan reads "Gate to i'Arathael" as "arathael".
- **`tools/newdecks-census.js`** runs both lists through the real parser and prints what it cannot read. The plan and the reader order are `ROADMAP-NEWDECKS.md`: Viserai first, Prism second.
- **Checked this cycle:** `develop` re-fetched, `pin-pool.js --check` current, the live-wire drills in `drift.test.js` read with the cache present.

## v6.36 — the Pass button says what a pass costs; the Concede button is gone

- **The phone never passes for a player** (RULING, user, 2026-11-15: "Don't auto pass because it gives too much info to the opp"). A pass sent the instant the attacker has nothing to play
  would tell the defender the hand holds no instant. Instead the player's own Pass button shows it, and only their phone sees it.
- **Green: nothing else can be started.** When a player holds priority and no card can be played, no ability activated and no defender declared, Pass ("Pass", "Pass — let <hero> block",
  "Done defending") and End turn are green: passing gives nothing up. This is the attacker in the defend step with no instant, the case the forfeit clock was burning on.
- **Purple: an action point is unspent.** In the player's own action window, with an action point left and something that could still be started, Pass and End turn are purple, so the turn
  is not passed away by a mis-tap. The tap still works: it is a warning colour, not a lock.
- **`judge.moves(g, seat)`** (new, read-only) is the one list both colours ask: every play, activation and defender `legal` accepts for that seat now. Drill `test/moves.test.js` plays real games
  with every hero: whatever the AI proposes must be on the list, every entry must be accepted by the reducer, and the list must be seen both empty and full (sabotaged three ways).
- **The Concede button is removed** (RULING, user, 2026-11-15: "It has no place there completely remove it"). It appeared only in the defend step and asked no confirmation, so a mis-tap was
  a ranked loss. Closing a started ranked table is still a concession, and the engine's concede action (CR 4.5.3c) is unchanged.
- **Ruling recorded, nothing to build:** a player who runs out the forfeit clock loses, and the winner has to wait the clock out; "we are counting on people playing nice".
- **No WIRE_V, no DATA_VER change.** No payload, prompt or game key changed; the function is re-bundled and redeployed because `APP_VER` and `engine/judge.js` changed.

## v6.35 — the forfeit clock: seven and a half minutes, and the defend step says whose move it is

- **The limit is 7.5 minutes** (RULING, user, 2026-11-15: "sometimes there is a lot to consider"). One constant, `FORFEIT_MS` in `server/referee.js`; the page still reads it from the
  function's answer and now prints a half minute honestly ("has not moved for 7.5 minutes").
- **The clock sits on whoever must decide** (RULING, user, 2026-11-15: a chess clock, never paused). In the defend step the turn-player holds priority (CR 7.3.3), so the game waits on the
  attacker until it passes, and on the defender from then on while they choose blockers. The attacker's button used to read only "Pass"; it now reads **"Pass — let <hero> block"**, so a
  player who is politely waiting knows the table is waiting on that tap. An attack on an ally (which cannot be blocked) keeps the plain "Pass". No rule and no clock logic changed.
- **Rulings recorded, nothing to build:** the 0-turn lobby forfeit stays; very short ranked games count (an honour system); a phone that already has a name may still redeem a recovery code;
  the ladder keeps floor 3 / top 50 / last 10.

## v6.34 — the ladder: who stands where in ranked play, and the latest games

- **A public ladder.** From the first screen ("The ladder"), the server table screen and the name sheet ("See the ladder") a player opens a plain list of ranked players, best rating first: rank, name,
  rating, and the record (won, lost, drawn). Anyone can read it, **signed in or not, and looking never signs a phone in**. A player is listed once they have **a chosen name and three ranked games**
  (one constant, `LADDER_FLOOR` in `server/referee.js`); fewer games is "provisional": rated, not listed. Order is **rating, then more games, then name**, a total order; the top **50** are shown
  (`LADDER_CAP`). A player whose sign-in was left behind by a recovery (007's orphan) or who has no name never appears.
- **Your own line.** A phone that is already signed in also hears where it stands: its rank when it is listed (also below the top 50), otherwise its rating and "2 more ranked games and you are on the
  ladder" (or, for a player with games but no name, "Choose a player name and you are on the ladder"). Your row is highlighted. A phone with no sign-in, a forged or expired one, or a provider that is
  down simply gets the list without the line: the public read never fails for the caller's sake.
- **Latest games.** The same answer carries the last ten recorded ranked results, newest first: both names, both heroes, who won (or a draw), how it ended in plain words (won, conceded, forfeit, draw)
  and how long ago. No identifiers.
- **Cheap and read-only.** One function call, one database statement (`ladder_get`, STABLE, so it cannot write; the top list and the latest games through two indexes, the caller's rank one count).
  No row is written or made, not even a rating for a stranger who asks. **Not cached**: the answer is one indexed statement, and a ladder that did not show a game that has just ended would read as a bug.
- **Honest empty state and retry.** "No one is on the ladder yet. Be the first: play three ranked games."; a failure says so in a sentence and offers *Try again*. Names of 16 letters and four-digit ratings
  fit at 393 and 320 wide; the rows are not controls because they do nothing. The screen says what this is: a fan-made ladder, for fun and glory, no ads, forever.
- **No WIRE_V, no DATA_VER change.** No game payload, snapshot, prompt or game key changed (a new request op and a new engine call only); the function must still be re-bundled and redeployed because
  `APP_VER` changed (the build id both phones and the function must agree on).
- **To go live:** run `server/supabase/008_ladder.sql` (ends `dawnblade_ladder` / `ok`, safe to run twice, adds two indexes and one function; nothing 001-007 is edited) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the new ladder check is WRITTEN BUT NOT RUN on live). Optionally, once, `node tools/liveranked.js --go`: plays ONE ranked game between two fresh test players
  (it leaves two players with one game each and one result row behind: read its header). Drills: `test/serverladder.test.js`, `test/serverladderphone.test.js` (each with sabotage),
  `tools/sql-pglite.js` + `tools/sql-sab-008.js` (PGlite, 19 sabotages), the Deno rehearsal, `tools/serverpage.js` (the Ladder screen, and `liveranked.js` proved offline).

## v6.33 — ranked integrity: the forfeit clock, closing counts, recovery keeps a rating

- **An abandoned ranked game can be claimed.** On a RANKED server table the function stamps (server time, never a phone's clock) when the player the game is waiting on last
  made an accepted move. If that player makes no accepted move for **five minutes** (one constant, `FORFEIT_MS` in `server/referee.js`, a placeholder the user may rule on), the OTHER
  player's phone is offered **Claim the win**; the function checks the claim against its own stamp and its own notion of whose decision is pending, ends the game as a **win by
  forfeit** (the absent player loses) and records it once with the usual Elo move. Early claims, a claim by the player being waited on, a claim on a friendly table or a finished game,
  and a forged seat or key are each refused and change nothing; a claim racing the absent player's late move is decided by the row's version check (exactly one wins; drilled in both
  orders). **Who the game waits on** is `judge.waitingOn` (read-only, new): a pending cost, a live sheet's side, the arsenal choice, else the priority holder — never guessed from whose
  turn it is; no clock runs when the game waits on nobody or on both. The waited-on phone sees a calm countdown in the last two minutes; the waiting phone is told how long until it may
  claim. Neither says what is being decided. A ranked game nobody finishes or claims simply ages out with the table (48 hours) and records nothing. Friendly tables: no clock, no
  claim, byte for byte as before.
- **Closing a ranked table mid-game is a concession.** Once the match has been dealt, the creator's close counts as their loss (recorded exactly like Concede, the closer the loser) and the
  page says so before the player confirms ("Closing now counts as a loss…"). Closing before the game starts is free and records nothing; friendly tables are unchanged.
- **Recovery keeps a ranked rating** (`007_forfeit.sql`). A throwaway player that played a ranked game (or sits at an unfinished ranked table) is kept, orphaned but intact, when its
  phone redeems a recovery code; the recovered player's rating and record are never touched. A throwaway with no ranked games is deleted as before.
- **Row v5, WIRE_V 40, DATA_VER unchanged.** A ranked table is now a v5 row (clock, forfeit); v4 rows are still read. The clock rides as a sealed push frame and a join/resync answer key,
  the claim is a new request op: no game state, snapshot or prompt changed.
- **To go live:** run `server/supabase/007_forfeit.sql` (ends `dawnblade_forfeit` / `ok`, safe to run twice; re-run it after any re-run of 004 or 006) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the forfeit check is WRITTEN BUT NOT RUN on live). Drills: `test/serverforfeit.test.js`, `test/serverforfeitphone.test.js` (each with
  sabotage), `tools/sql-pglite.js` + `tools/sql-sab-007.js` (PGlite), the Deno rehearsal, `tools/serverpage.js`.

## v6.32 — ranked server tables: the result is recorded once, and ratings move

- **A ranked table is a choice at create.** On the server-table screen a switch reads *Friendly table* (the default, exactly as before) or *Ranked table*
  ("Counts toward both ratings"); the button then reads *Open a ranked table*. A ranked table needs two DIFFERENT signed-in players who each have a chosen
  name. A phone that cannot meet that is refused in a plain sentence: *"A ranked table needs a player name for both players. Choose yours under Playing as,
  then try again."* (no name), or *"A ranked table is for signed-in players, and this phone could not sign in just now..."* (no sign-in). Nothing is written by a refusal.
  The lobby line and the board say **Ranked** and show each player's rating beside their name.
- **Who goes first:** unchanged and already as ruled: every server table's lobby is the two-phone rock-paper-scissors (sealed throws, opened only once both
  are in, ties replay) and the WINNER CHOOSES who goes first. Nothing to build.
- **The result is written by the function only, exactly once.** When a ranked game ends (a win on life, a concession, or the engine's dead-position DRAW) the
  function reads who won, how and how many turns from its OWN game state, after the deciding move is saved, and calls `result_record`: one `results` row (game,
  both players, heroes, winner or draw, how it ended, turns, build, times, both ratings before/after) and both ratings updated in the SAME transaction.
  Idempotent on the game id (the table code plus the moment the table was made, so a code drawn again later is a new game): a replayed ending, a resync, a
  takeover or a retry answers the stored result and moves nothing. No request from a phone can name a winner (forgery drills). If recording fails the game is
  not undone: the next request of any kind records it. There is a Concede button on the board (`concede`); there is no leave/abandon op.
  **Gap (the forfeit clock closes it later):** a ranked table its creator closes before the game ended records NOTHING (so a creator can dodge a loss by
  closing). A decided game's table cannot be closed over, so close can never erase a result.
- **Ratings:** Elo, one per player (not per hero), start 1200, K 32, a draw is half a point, rounded to integers, computed IN SQL (`rating_start()`,
  `rating_k()` are the one place the constants live). Two simultaneous finishes of one player's two games both apply (one advisory lock per player, lower id first;
  proven on a real Postgres 16: with the locks 1231, without 1216). Records kept: games, wins, losses, draws.
- **What a player sees:** `me` now also returns rating and record; the name sheet shows them ("Your rating is 1312. 1 ranked game: 1 won, 0 lost, 0 drawn.");
  at the end of a ranked game each phone's end screen says "Well played. Your rating rose from 1300 → 1312 (+12)." / "Your rating moved from 1200 → 1184 (−16).
  Every game teaches something." / "Your rating stays at 1200.".
- **Privacy:** player ids, tokens and subjects still never leave the function; ratings, names and the result summary are public by design (scanned by the drills).
- **WIRE_V stays 40, DATA_VER unchanged:** no wire payload, prompt or game key changed; ranked rides the request envelope and the function's own answers and row.
  The stored row for a ranked table is **v4** (a v6.31 function refuses it as `wire`: a rollback cannot turn a ranked table into a casual one).
- **To go live (the CEO):** run `server/supabase/006_ratings.sql` (ends `[{"dawnblade_ratings":"ok"}]`, safe to run twice) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the ranked check is WRITTEN BUT NOT RUN on live). A function redeployed before 006 refuses ranked creates with `internal`.
- **Drills:** `test/serverranked.test.js`, `test/serverrankedphone.test.js` (each with sabotage), `test/fixtures/elo-vectors.json` (the shared Elo table the fake and
  the SQL are both held to), `tools/sql-pglite.js` (006 twice, 20 sabotages, vectors), `tools/sql-race.sh rate|ratenolock`, the Deno rehearsal (ranked phase), `tools/serverpage.js` (ranked at 393x852).

## v6.31 — a player's name is on the board, and no player holds more than 5 open tables

- **Names on the board.** At a server table each seat's player name (when that player has one) is on the table board, small and dim, under that seat's hero
  name, on both phones: yours under your hero, theirs under theirs. A player with no name shows exactly what was shown before (nothing is drawn). It survives
  a reload (the claimed seat reads both names at once) and a seat takeover. A 16-letter name fits the box at 393 wide; on a narrower phone it is cut with an
  ellipsis, never wrapped, never pushing the row. Local tables and the trainer are unchanged.
  The names are the channel's, the same `names()` the lobby's "A vs B" line has read since v6.29 (the function's own answer envelope): they are NOT in the
  game state the rules or the AI read, nor in the report, nor in any wire payload. **WIRE_V stays 40** (no wire payload, prompt or game key changed).
- **At most 5 open tables per player** (ruling, user, 2026-11-14: "cap 5 open tables per player"). **Open** = a table this player CREATED while signed in,
  whose game is not finished, that its creator has not closed, and that has not been idle 48 hours (those are forgotten anyway). A finished game lets go of
  its slot (the referee marks the row `over` when the session ends); joining someone else's table never counts; casual (not signed-in) tables are exactly as
  before (no creator, v2 row, never counted, never refused). The sixth is refused `table-cap` and nothing is written.
  The page says: *"You already have 5 tables open, the most one player can have. Finish a game, or close one of the tables below, then open a new one."*,
  lists the five codes, and gives each a **Close** button.
- **Close** (`{op:"close"}`, creator only): the smallest way out of the cap (a table nobody sits at would otherwise count for two days). It marks the row over and
  closed; a closed table answers `no-table` to both seats. Another player, a casual table, a forged token and a missing table each get their own refusal.
- **How the count is atomic** (`005_table_cap.sql`, new, service_role only): `table_create_capped(id, row, creator, cap)` counts the creator's open rows and
  inserts in ONE transaction under a per-player advisory lock (`pg_advisory_xact_lock`), so two simultaneous creates at four open make exactly one more.
  Proven on a REAL Postgres 16 with ten simultaneous callers (`tools/sql-race.sh`: with the lock 1 created / 9 refused; the same file without the lock line 10 created),
  and on PGlite (twice, plus ten sabotages). A signed-in create on a store that cannot count is refused `unavailable`, never made unchecked.
- **Honest limits:** the cap binds signed-in creates. A phone that cannot sign in opens a casual table, and casual tables are by design uncapped (the
  stranger-opens-empty-tables exposure in DEPLOY.md is unchanged). A name is stored in the table row when a player sits down (as in the lobby), so a name
  the player changes mid-table shows at the next sit-down. Closing a table does not push a notice: the other phone finds out on its next request.
- **To go live (the CEO):** run `server/supabase/005_table_cap.sql` (ends `[{"dawnblade_table_cap":"ok"}]`; safe to run twice), re-bundle and redeploy the function
  (the build id moved with APP_VER), `--stamp`, then `node tools/livecheck.js` (now also asserts seat 0's name on both boards; WRITTEN BUT NOT RUN on live).
  Until 005 is run the new function answers a signed-in create with an internal error (the SQL function is missing): run the SQL first.
- **Drills:** `test/servertablecap.test.js` (the cap, joins, a whole finished game, close, a race, no leak, the phone) and `test/servernames.test.js` (game,
  reload, takeover, no name in state), each with its sabotage; `tools/serverpage.js` (names on the board, long names, a nameless opponent, the joiner's
  board, the cap refusal and Close at 393x852); the Deno rehearsal (cap phase, single + folder); `tools/sql-pglite.js` (005 twice).

## v6.30 — a lost phone is not a lost player: the recovery code

- **On the name sheet** (*Find an opponent* → *Join a server table* → *Choose a name*): **Get a recovery code** shows a code ONCE (three groups of five,
  e.g. `6RY9U-8HWT9-5QMG7`) with a plain line telling the player to write it down and that a new code replaces it; **I have a code** takes it on a
  NEW phone and the sheet answers "Welcome back, <name>. This phone is you now." The recovered phone has the player's name and takes the player's seat
  the usual way (sit down: last one wins, the old phone is told). The old phone keeps working: one player, two phones. The code is held in the page's
  memory only while it is on the screen, never in the phone's storage.
- **The code** (`server/referee.js`, ops `recovery-mint` and `recovery-redeem`): 15 characters from a 31-letter alphabet (no 0 O 1 I L) = 74 bits, drawn
  from `crypto.getRandomValues` with rejection sampling (never `Math.random`). Only its SHA-256 is stored (`recovery`, from 002). Read leniently on
  the way in (case, spaces, dashes). **Expiry two years** (730 days; it is a lost-phone code and must still work months later); a new code restarts it.
  **One live code per player**: minting retires the older unused ones.
- **Redeem** (`004_recovery.sql`, `recovery_redeem`, service_role only, ONE transaction): spends the code, re-points the new phone's sign-in to the code's
  player, and deletes the throwaway player it had if that leaves it with no sign-in (its name, if it chose one, is freed). **Wrong, used, expired,
  replaced and malformed codes are ONE answer** (`recovery`, and one plain sentence on the screen). A phone that is sitting at a table (the page names the
  tables it knows) is told to leave it first (`recovery-seated`), before anything changes, so a seat is never left to a player that no longer exists.
- **Brake:** eight wrong tries from one sign-in in an hour answer `recovery-limited` (a limited try does not look at the code, so a good code is not
  spent by it). Per sign-in, not global (a global brake would let anyone lock every player out); the defence is the code's size: ~10^15 years at 150 tries
  an hour from one address, and the auth service itself allows 30 anonymous sign-ins an hour per address.
- **Nothing leaks:** the code is in the mint's answer and nowhere else; no hash, token, provider id or player id in any other answer, broadcast, stored
  row or report (`test/serverrecover.test.js` scans them, with the leaks planted as sabotage).
- **To go live (the CEO):** run `server/supabase/004_recovery.sql` (ends `[{"dawnblade_recovery":"ok"}]`), re-bundle and redeploy the function, `--stamp`,
  then `node tools/livecheck.js` (which now also mints a code on seat 0 and redeems it on a third fresh browser; it was written but NOT run on live).
- **Drills:** `test/serverrecover.test.js` (18) and `test/serverrecoverphone.test.js` (6), each with its sabotage; `tools/serverpage.js` mints on one real
  page and redeems on a second at 393x852; `tools/supabase-rehearse.js` under Deno (single + folder); `tools/sql-pglite.js` (004 twice; ten sabotages).
- **WIRE_V not bumped** (still 40): no wire payload, prompt or game key changed; the two ops ride the request envelope and the function's own answers, as `me` did.
  The table's build id moved with APP_VER, so the function MUST be redeployed or the handshake refuses.
- **Honest list:** a code is only as safe as the paper it is on; anyone who has it can become the player (the same trust as a password). Losing the
  code AND the phone is still losing the player. The server only knows the tables the redeeming phone tells it of (an unlisted old seat stays with a
  player that no longer exists). A phone that already has a named player and redeems a code gives that player up if it had no other sign-in.


---
Older releases (v1 to v6.29): `docs/archive/CHANGELOG-to-v6.29.md` (grep it).
