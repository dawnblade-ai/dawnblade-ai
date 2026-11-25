# Desktop tasks

These tasks need something the cloud sandbox cannot reach. Each one says
what was blocked, what is already known, and where the answer goes.

---

## Silver Age legality — DONE from the upstream database (v6.23); one residual

`data/formats.json` → `silverAge.banned` is now derived by `tools/silver-age.js` from the pinned pool's
`silver_age_banned` / `silver_age_banned_start` fields (the-fab-cube), held by `test/formats.test.js`. After a
re-pin, rerun `node tools/silver-age.js`. The earlier snippet leads (Kayo benched, Entwine Lightning banned) are
superseded by the database: Kayo is not banned, and Entwine Lightning is Classic Constructed-banned only.

**Residual (desktop).** The official announcement pages on fabtcg.com were never read from the sandbox (403), so
the block is the database's word, not the announcement's. `benched` is `null`: the database has no hero-bench field
(Briar is recorded as banned since 2026-09-18) and carries no "until" dates. Reading the announcements
(`/articles/scheduled-banned-and-restricted-announcement-17-09-26/`, `/articles/silver-age-vote-iar-season/`)
would confirm the dates and fill the bench.

---|---|---|
| March | 2026-03-03 | `/articles/scheduled-banned-and-restricted-announcement-2-3-26/` |
| May | 2026-05-29 | `/articles/scheduled-banned-and-restricted-announcement-28-05-26/` |
| June | ? | `/articles/scheduled-banned-and-restricted-announcement-29-06-26/` |
| September | 2026-09-18 | `/articles/scheduled-banned-and-restricted-announcement-17-09-26/` |
| the hero vote, Usurp the Shadow Throne season | 2026-09-18 | `/articles/silver-age-vote-iar-season/` |

What the snippets claimed, and whether the named card is in our pool:

| claim | in the Dawnblade pool? |
|---|---|
| **May: Reaping Blade** banned in Silver Age | **yes — Viserai's weapon** |
| May: Phantom Tidemaw, Volzar, the Lightning Rod, Channel Lightning Valley, Electromagnetic Somersault, Skyward Serenade banned | no |
| **May: Kayo** benched for one season (with Ira, Crimson Haze and Kano) | **yes — our pilot hero** |
| **September: Entwine Lightning** banned (aimed at Oscilio) | **yes — Briar's** |
| **September: Brand with Cinderclaw** UNBANNED (so it was banned earlier; when?) | **yes — Fai's** |
| **September: Briar** benched by player vote (with Oscilio and Oldhim) | **yes** |
| September: Kayo, Kano and Ira return, with bans aimed at each | Kayo — which cards? |
| Star City Games headline: "Nine Cards Impacted In Flesh And Blood's Silver Age Format" | which nine? |
| Absorb in Aether, Beaten Trackers banned — **Classic Constructed**, not Silver Age | yes (Iyslander/Blaze; Kayo), but a CC ban does not touch Silver Age |

Next scheduled announcement: 2026-10-26, per the same snippets.

---

## Rules update 2026-09-17 — the start-of-game procedure

**Snippet, unverified:** from 2026-09-18, players choose and reveal their
arena cards (equipment and weapons) **before** choosing which cards start
in their main deck. Source to read:
`fabtcg.com/articles/rules-update-17-09-26/` and
`fabtcg.com/articles/start-game-procedure/`.

**What it would touch here.** `engine/lobby.js` negotiates hero → throw →
sideboard, and the loadout screen picks equipment and deck together. If
the update is confirmed, the sideboard step splits so that the loadout is
revealed to both seats before either commits a deck. That is a lobby and
UI change, not a rules-engine one. Recorded rather than guessed, because
the exact order (does the reveal come before or after the throw?) is what
the article settles.

**The CR itself.** The snippets name Comprehensive Rules **v2.14.0, dated
2026-06-10** (`rules.fabtcg.com/pdf/en-fab-cr.pdf`). This engine's CR
citations predate it. Diffing that PDF against the rule numbers in
`CR-INDEX.md` is a desktop task of its own: every guarded rule should be
checked for renumbering or rewording.

---

## The two new precons — being built (2026-11-15), nothing to do on a desktop

**Update 2026-11-15:** the user ruled that they are to be built, from the text on
the-fab-cube's unmerged `usurp-the-shadow-throne` branch. It is staged in
`data/staged.js`; the plan is `ROADMAP-NEWDECKS.md`. The paragraph below is the
state of `develop`, which still carries neither set.

### As recorded before the ruling

*Prism, Advent of Thrones* (SAT) and *Viserai, Between Worlds* (SBW) are
pinned as fetched lists in `data/newsets.json`. They stay unbuildable
until the-fab-cube's `develop` branch carries them. That was re-measured
from the sandbox on 2026-09-26, eight days after the street date: still 15
Silver Age sets, 0 SAT and 0 SBW printings. `test/drift.test.js` goes red
by itself the day they arrive. No desktop work is needed; this is here so
nobody goes looking.

---

## Two real phones over a real connection — never tested yet

Every two-phone check so far (v6.03–v6.07, Hidden hands H2) ran over a
stubbed network: two browser pages in one sandbox. Nobody has played the
two-phone table on two real phones over real PeerJS, and the sandbox cannot.

**What to do (about 15 minutes, two phones, any Wi-Fi or mobile data):**
1. On both phones open https://dawnblade-ai.github.io/dawnblade-ai/ and
   check the version in the corner matches.
2. Phone A: find an opponent, host. Phone B: join with A's code.
3. Play the throw, pick heroes, and play at least five turns.
4. Mid-game, lock phone B for a minute, unlock it: does it pause and
   **Rejoin**? Reload phone A's page: does **Resume** bring the table back?
5. Finish the game (concede is fine) and press **Verify this game** on
   phone B: it should say Verified.

**Report back:** which step failed (if any), the phones and browsers, and
whether it was Wi-Fi or mobile data. A failure here is a top-priority
S-item. The JUDGE!! button files a bug report from either phone.

## The online path on two real iPhones — Find a match, Rematch, practice while waiting (v6.85–v6.99)

Every server-table check runs headless (`tools/serverpage.js`, `tools/livecheck.js`). Nobody has yet walked the matchmaking
path on two real phones. **About 15 minutes, two phones, both on the live page (check the version in the corner):**
1. Both phones: *Find an opponent* → *Find a match*. They should meet within a few seconds and reach the hero pick.
2. Play a few turns, then concede on one phone. On both end screens, tap **Rematch**. The second tap should send both
   phones to a NEW table at the hero pick, with no code typed. Try it once with the other phone asking first, and once
   with **Take it back**.
3. On the end screen, tap **Find another match** on one phone only. Leave it searching for over a minute: **Play the AI
   while you wait** appears. Start a practice game, then tap *Find a match* on the other phone. The **Your match is
   ready** banner should appear over the practice game; **Join them** should seat both.
4. Open *How each table keeps hands hidden* and close it. Check every button is easy to hit with a thumb.
5. (v6.87–v6.92) After one phone asks for a rematch, tap **Leave** on it: the other phone should stop saying they want a
   rematch at once. While searching, the card (and the practice bar) may say *Players usually find a match in about N
   seconds*. It is blank until enough matches have been played that day. If you have five open tables, a rematch offers
   **Close** beside each one, then **Ask again**. On the smallest phone you have, open a few in-game choice sheets
   (pay, pick, order): every option should be thumb-sized and nothing should run off the side.
6. (v6.94–v6.98) Red words are now a coral red: do they still read as *red* (an attack, a loss) on a real screen?
   In step 3, does the **match found** sound play on the iPhone (iOS only allows sound after a tap — you will have tapped
   while practising), and does the banner count down (*join within 1:42*)? Tap **Not now** on it: the other phone
   should say it was given back and go back to looking. Then let a second one run out on its own. Finally, after a
   ranked game, open **The ladder**: *Your last ranked games* should list it.
7. (v6.99) Reload the page: the **title screen** should come first. Try each of its four choices and the *‹ Title* way
   back. *Play the AI* → pick a hero → *Battle*: the next screen should name a random opponent **before** the sideboard,
   and that hero should be the one you then play. *Train against the Dummy* → *Battle* should go straight to the coin.
8. (v7.00) On the board, the little type word on each card (ATTACK, BLOCK, …) should be readable and sit **above** the
   power and defense numbers, never over them. On the title, tap *Your record*: your games against the AI should be
   listed per hero; on a phone that has played a ranked table, *Show my ranked games* should show your rating, a small
   line of how it moved, and the heroes you played most.
9. (v7.01–v7.02) The smallest words on the board (hand-rail labels, chips on cards, the empty-arsenal word) should read
   comfortably and nothing should overlap. *Play the AI* → *Battle*: the opponent step should offer **no Dummy** tile.
   Finish a game against the AI, then open *Your record*: *Your heroes* should list the hero you piloted, with its W–L.
10. (v7.03–v7.04) On ONE phone alone, *Find a match*: the wait card should say *Nobody else is looking right now* and offer
   *Play the AI while you wait* at once. Then finish a friendly game between the two phones and open *Your record* on
   each: *Against people* should show one game, under the hero that phone piloted — once, even after a reload.

**Report back:** the step that failed (if any), the phones, and whether it was Wi-Fi or mobile data. JUDGE!! files a
report from either phone.
