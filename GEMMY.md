# Gemmy — tournament matchmaking, and a baby gem system

> **Written 2026-09-12 at v4.40**, from the user's brief: *"a system called
> 'Gemmy' that is a baby version of LSS' gem system. Instead of 1v1
> matchmaking we will have tournament matchmaking — players can select 8, 16
> or 32 players for best-of-1 challenges depending on how much time they
> have. They can even spectate the other games if their games end early.
> Obviously these are late game goals."*
>
> **This is a PLAN, not a build.** Nothing in it ships this fortnight. What
> it is for is to state, measured rather than guessed, **which half of Gemmy
> already exists** — because a surprising amount of it does — and which half
> is genuinely new, so that when the time comes nobody rebuilds the bracket.

---

## THE HALF THAT IS ALREADY BUILT, AND IT IS THE HALF THAT LOOKS HARDEST

`tools/tournament.js` (v4.39, `npm run cup`) runs a sixteen-seat bracket
today: every tie decided, chairs alternating, four judges watching every
intermediate state. **Three of Gemmy's four stated requirements fall out of
it with no new rules code at all**, and each is measured rather than assumed:

| Gemmy asks for | already true | measured |
|---|---|---|
| **8, 16 or 32 players** | `bracketOrder(n)` derives the standard seeding for any power of two | seeds are a partition for n ∈ {2,4,8,16,32} and every first-round pair sums to n+1 — 8→9, 16→17, 32→33. Pinned by `test/tournament.test.js` |
| **best-of-1** | `winsNeeded(1) === 1`, and `tie()` stops at the first decisive leg | no edit; the format table is data (`ROUNDS`) |
| **an event that fits the time you have** | rounds are log₂(n) — **3 · 4 · 5** | `npm run cup` plays 286 games in ~20 seconds; a Bo1 event is one leg per tie, so 7 · 15 · 31 games |

**So the bracket maths is done and drilled.** What is emphatically NOT done
is everything around it, and the plan below is honest about which parts are
cheap and which are Phase C.

---

## THE FORMAT IS A TIME BUDGET, AND THE SCREEN MUST SAY SO

v4.39 measured this and it is the sharpest thing the tournament taught:

> **Arakni beats Blaze 74–6 over 80 games (92%) — and 92% still loses a
> best-of-three about once in 180.** The first running of the cup produced
> exactly that: Blaze put the top qualifier out 2–0 in the quarters. At Bo5
> the same tie is 3–2 the other way.

**A short tie is a test of variance, not of decks.** Best-of-1 is therefore
a legitimate choice about how long you have, and it is *not* a claim about
who is better — and Gemmy is going to hand out gems on the strength of it.

So the format picker states the trade on the button, not in a document:
**v3.51's rule — a doc the player cannot read is not a disclosure.** The
loadout screen already carries a measured disclosure of exactly this shape
("the table's dummy is untuned and wins 11 of 15"), and it is the precedent
to copy. One line under **Bo1 · 8 players**: *"quickest — and a single game
is decided by the draw about as often as by the deck."*

**And the number in it is re-derived, never quoted from here** (v4.17). It
is one `npm run cup` run with `ROUNDS` set to Bo1 against the standing Bo3
figure; the ladder's own noise band (v4.40, median 6) says a single sample
would not settle it, so it is measured at three seeds on both formats.

---

## WHAT IS GENUINELY NEW, IN COST ORDER

### 1. SOLO GEMMY — a real event, no network, buildable now

**One human and 7 / 15 / 31 `sparring.act` entrants.** Nothing in it needs a
backend, a lobby or a second phone: `judge.reduce` drives the human's own
table exactly as it does today, and the other games in the bracket are the
ones `tools/tournament.js` already plays headless.

This is where Gemmy should start, and not only because it is cheap:

- **it makes SPECTATING free.** Your game ends, and the other seven games in
  your round have already been played — or can be, in milliseconds. There is
  no hidden-information problem and no live feed to build, because nothing
  is live. You watch a REPLAY.
- **it exercises the whole engine under a real player's hands**, which is
  what `npm run play` does headlessly and nothing does with a person in the
  loop.
- **it is the thing the user asked for, minus the matchmaking** — the format
  choice, the bracket, the spectating and the gems are all in it.

What it needs that does not exist: a bracket SCREEN (the report is text
today), a way to hand one seat to the player rather than to the policy, and
the gem ledger below.

### 2. THE GEM LEDGER — small, and it is the one piece that needs storage

A baby gem system is a persistent per-player record: gems earned, events
entered, a placing history. **That is the same blocker the ELO ladder has
had since v2.20** — GitHub Pages is static hosting and a page cannot hold
trusted state.

Two honest positions, and the first is worth shipping long before the
second:

- **local gems are real gems for one player.** `localStorage`, the same
  place the trophy case already lives. It cannot be compared between
  players and it does not need to be to make a solo event feel like one.
- **shared gems need Phase C** — a server that owns the record, which is
  `SUPABASE.md`'s subject and is deferred to the desktop pass.

**Do not blur them.** A gem count that looks global and is local is the
sev-2 category the player TRUSTS.

### 3. MULTIPLAYER GEMMY — and the two places it does not generalise

This is the late-game half, and it has two specific walls rather than a
vague one.

**`engine/lobby.js` is strictly two-seat, and its ARGUMENT generalises while
its SHAPE does not.** `isSeat = i => i === 0 || i === 1`, and all nine
fields are `[null, null]` pairs. What makes that module safe is that every
message writes only its own seat's slot and every slot is write-once — *"the
reducer is a monotone accumulator: the writes commute, a replay is refused,
and two peers applying the same messages in different orders land in the
same state."* **That property is not about the number two**; it is about
write-once. So an N-seat lobby is a re-parameterisation (pairs become
arrays of length N, `isSeat` becomes a bound, `stepOf` unchanged), and it
must keep the 16-interleaving drill generalised with it, or the property it
rests on is asserted for a shape that no longer exists.

**`engine/room.js` turns away a third phone on purpose, and that is
correct** — *"a second guest would become a second actor whose intents the
sequencer would happily interleave into somebody else's match."* A 32-player
event is **16 concurrent two-peer tables plus a registry**, not one
32-peer room. The registry is the new thing: who is in the event, which
table each pairing is at, and who advances. PeerJS gives one namespaced id
per table for free (`dawnblade-v1-<CODE>`), so the registry is a mapping,
not a mesh.

### 4. LIVE SPECTATING — the first thing here that needs redaction

The recorded Phase B limitation is exact and it bites here:

> **Both peers hold full state, including the opponent's hand.** *"It is not
> fixable by redaction here, because a peer that cannot see the state cannot
> run the reducer."*

A spectator is a third peer who **must not** hold full state — otherwise
watching your friend's game while yours is still live is a cheating channel
with a nice UI. The way out is that **a spectator does not need to run the
reducer at all.** What a watcher wants is the board and the story, and this
project already produces both:

- **the FEED is the lesson** (stated six ways in `CLAUDE.md`), and it is
  already a public, both-seats-read-it channel;
- **`engine/report.js` already serialises a whole board**, zone by zone, and
  is already the thing a table produces when something goes wrong.

So a spectator feed is a **redacted board snapshot plus the feed**, pushed
by the table, never a reducer the spectator drives. Hands are counted, not
listed — which is a thing `DeckPitchCol` already does (`hidden` shows a
pile's SIZE and not its contents). **Built that way it is a presentation
problem rather than a rules problem**, which is the whole difference between
"late-game goal" and "needs Phase C's server".

**In solo Gemmy it is free** (§1), and that ordering is deliberate: build
the watcher against replays, where redaction is trivially correct, before
it has to be correct against a live opponent.

---

## THE ORDER, AND WHY

1. **Solo Gemmy** — bracket screen, one human seat, replays for the other
   games, local gems. Needs no network and no new rules code.
2. **The gem ledger, locally.** Honest about being local.
3. **N-seat lobby** — re-parameterise the write-once accumulator and
   generalise its interleaving drill.
4. **The event registry** — N/2 concurrent tables over the existing room.
5. **Live spectating** — redacted snapshot + feed, never a third reducer.
6. **Shared gems** — Phase C, with `SUPABASE.md`.

**Steps 1 and 2 are worth doing on their own merits even if 3–6 never
happen**, which is the test this plan is written to pass. Everything after
step 2 is blocked on the same backend the ladder has always been blocked on,
and none of it should be started while there are still cards in the pool
that do not do what they print.

---

## WHAT THIS PLAN DELIBERATELY DOES NOT DECIDE

- **How many gems, for what.** That is a design question and inventing an
  economy here would be the golden rule broken one level up — it is the kind
  of thing to settle by playing, not by writing down.
- **Whether Gemmy events are seeded by gems.** A bracket seeded by a rating
  is a different instrument from one seeded by a qualifier, and v4.39's own
  finding was that **a trophy read as a ranking is the failure mode.**
- **The phone layout.** Deferred with the whole UI pass.
