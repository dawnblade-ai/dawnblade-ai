# HIDDEN HANDS — design for the two-phone table

Written 2026-11-07 on `research/hidden-hands` from `main` at v5.99.
RULING (user, 2026-11-07): *"Hidden hands is a must."* A ranked Elo ladder depends on it.

**Recommendation in one line:** build **one referee module** that holds the
full state and sends each seat `view(state, seat)` plus reveals. It runs **on
the host phone for casual play now**, and **in a neutral place (a third device
or a free-tier server) for ranked later**. It is the same code in both stages.
Do not build peer-to-peer mental poker unless trustless serverless play becomes
a requirement. The reasons are in §3 and the measurements in §5.

Every number below comes from a command. Rerun it and don't trust the prose:

```sh
node tools/hidden-census.js [--cards]     # §2: the parser's census of the pool
node tools/hidden-spike.js 30 hh2 [--ex]  # §5: self-play, every step judged from each seat's view
HHRNG=real node tools/hidden-spike.js 30 hh2   # same run, with the seed given back (isolates randomness)
node --test test/view.test.js             # the view drills (sabotaged: identity view fails 4/4)
```

---

## 1. Threat model

**The attacker** is the other player, holding their own phone with devtools,
a modified copy of the page (it is open source), and full control of
everything their phone sends. They cannot read the other phone's memory.

### Today (v5.99): `peers-hold-full-state`

Both phones run `judge.reduce` in lockstep over the same action log from the
same seed (`engine/net.js` header). So **each phone holds everything**:

| leak | where |
|---|---|
| the opponent's hand and face-down arsenal | `game.sides[o].hand`, `.arsenal` |
| **both decks' full order** | `sides[*].deck` |
| **every future draw, shuffle and random pick** | `game.rng`: the seed IS the future. Even with the decks redacted, a phone holding the seed can replay the shuffle |
| which card a uid is | uids are counted in **public decklist order** (`build.js`), so a uid alone names the card |
| the first-player throw | `lobby.js` THROW is sent seat to seat in the clear: a modified client can wait for the other throw and then answer it |
| private looks | `game.revealed` (Compass of Sunken Depths, Scout the Periphery) is ONE game-level field both seats read |

### What a phone must never learn
1. The opponent's **hand**, **face-down arsenal**, face-down banished cards
   (intimidate, CR 8.5.10), and face-down equipment.
2. **Either deck's order, its own included.** A player knows their deck's
   *composition* (the decklist minus every card they have seen), never its order.
3. **Any random outcome before it happens**: shuffles, random discards,
   intimidate's pick, die rolls, Arakni's random Agent. This means no phone may
   hold the seed of a stream that will decide one.
4. The opponent's throw before committing its own.

### What a phone may learn, and when
CR 3.0.4a: *"The arms, banished, chest, combat chain, graveyard, head, hero,
legs, permanent, pitch, stack, and weapon zones are public zones."*
CR 3.0.4b: *"The arsenal, deck, and hand zones are private zones."*
CR 3.0.4c: *"A public zone may contain a private object, if the object is made
private while in that zone, or if the object is moved into that zone as a
private object."* CR 3.0.4d covers the reverse: public objects in a private zone.

- **Always:** every public zone; every zone's **size** (hand count, deck count,
  arsenal occupied or not); both decklists (precons, public by format).
- **When a card is played, pitched, or declared as a defender:** that card. It
  moves to a public zone.
- **When an effect reveals:** the revealed cards, for as long as the reveal lasts.
  Examples: clash, fusion, Brain Freeze's "reveals their hand", boost's banish
  from the top, Strongest Survive's optional reveal.
- **Its own private looks:** the top N of its own deck under opt or Compass,
  and its own deck while searching it (Flamecall Awakening). The other phone
  learns only the count.
- **Known positions in a private zone.** If a card went to the bottom of a deck
  from a public zone (the pitch zone at end of turn, Preserve Tradition), both
  players know it is there. If a card went from a hand to the top of a deck
  where the other player saw it (Brain Freeze), they know it too. *The spike's
  view does not model known positions yet. See §4.1.*

---

## 2. Census: what touches hidden information

Asked of the **parser** (`fxParse` over every card in the 15 pinned precons:
op heads plus `hasKw`), and cross-checked against the printed text. Counts are
**printings** (name|pitch); 390 printings in the pool, gear and heroes included.

| class (parser op heads) | printings | examples |
|---|---|---|
| DRAW (`draw`) | 21 | plus the rules: opening hand, end-phase draw to intellect |
| LOOK/REORDER own top (`opt`, `lookOrder`) + kw **opt** | 11 / 12 | Blaze's Oracle, Cindering Foresight, Azalea's Spire Sniping |
| REVEAL from hand/deck (`reveal`, `revPitch`, `revColorPitch`, `revWard`, `foeReveal`, `foeDiscardUnlessReveal`) | 16 | Brain Freeze, Strongest Survive, Ravenous Rabble, Saltwater Swell |
| **RANDOM pick from a hand** (`discardRandom`, `intimidate`) + kw **intimidate** | 6 (2 kw) | Kayo's Pulping, Bare Fangs, Wild Ride; Lyath's Sadistic Scowl, Smash Instinct |
| Opponent discards (victim chooses) (`foeDiscard`) | 3 | Pummel, Loot the Hold, Short Shrift |
| Chooser picks from a revealed hand (`foePick`) | 2 | Brain Freeze (Pass Over is a graveyard target: a parser false positive) |
| Hand → deck (hidden destination) (`foeHandToDeck`, `bottomSelf`) | 3 | Boulder Drop, Under Loop |
| Hand → face-down arsenal (`reload`, `eachArsPut`) + kw **reload** | 3 | Take Aim, Bolt'n' Shot, Concoct Disorder |
| Face-down arsenal leaves or flips (`foeArs*`, `allArsBottom`) | 7 | Disable, Fault Line, Wreck Havoc, Loot the Arsenal |
| Top of a deck leaves face-up (`foeBanish*`, `foeDeckDestroy`) + kw **boost** | 5 + 20 | Arakni's Marks, Art of Desire, Goon Tactics; all of Dash's boost |
| Both deck tops revealed: kw **clash** | 8 | Kayo's Clash of Might/Agility/Vigor, Test of Might |
| Hand → soul: kw **charge** | 12 | Boltyn's deck (the soul is public: RULING 2026-11-07, §7) |
| Die roll (`intRoll`) | 1 | Knucklehead |
| **Text only** (the parser has no op head for them) | 9 | Flamecall Awakening (the pool's ONLY **search + shuffle**), Reincarnate and Beaten Trackers (react to a *random* discard), Savage Feast (random discard as a cost), Compass of Sunken Depths (look at top), Preserve Tradition and Rising Sun, Setting Moon (to the bottom of a deck), heroes Azalea (arsenal → bottom, top → face-up arsenal), Bravo (flip a face-down arsenal card), Arakni (becomes a *random* Agent of Chaos) |

**Total: 117 printings (87 distinct card names) touch hidden information or a
random/secret choice**, on top of the rules every game uses. Grouped into
**protocol cases**, the things a protocol must carry:

| # | protocol case | carried by | difficulty |
|---|---|---|---|
| P1 | **Own draw**: a private deal to its owner only | rules, 21 cards | easy for a referee; the core of mental poker |
| P2 | **Play / pitch / defend** from hand or face-down arsenal: the actor reveals | every turn | easy (the action carries the card) |
| P3 | **Commit without reveal**: hand → face-down arsenal, hand → top/bottom of deck, pitch → bottom of deck in a chosen order | rules + 6 cards | medium: the action must NOT name the card (a slot handle, not a uid) |
| P4 | **Private look and reorder of own top N** (opt, Compass, Spire Sniping) | 13+ | medium: reveal to the owner only, then commit a new order |
| P5 | **Public reveal from a deck top** (clash: BOTH decks, boost, Marks, Goon Tactics, Azalea) | 35+ | medium: reveal to both, mid-resolution |
| P6 | **Reveal from hand** (fusion, Brain Freeze, Strongest Survive: the victim's own choice) | 16+ | easy as data; the victim chooses, so it is a prompt to the hidden side |
| P7 | **Random pick from a hidden hand** (discard at random, intimidate → face-down banish) | 9 | **HARD** for P2P: joint randomness over cards one side cannot see |
| P8 | **Victim-chosen discard / chooser picks from a revealed hand** | 5 | easy (a prompt addressed to the hidden side) |
| P9 | **Search own deck + shuffle** (Flamecall Awakening) | 1 | **HARD** for P2P: the whole deck is opened to its owner, then a fresh joint shuffle |
| P10 | **Face-down arsenal or equipment flips or leaves** | 7 + gear | easy (reveal on flip or leave) |
| P11 | **Randomness over public things**: opening shuffle, die roll, random Agent, the throw | 4 | easy with a committed joint seed |
| P12 | **Known positions in a private zone** (pitched cards at the bottom, Brain Freeze's top) | rules | medium: the view must carry "known" slots |
| P13 | **Validating an action whose legality reads a hidden hand** (affordability before the pitch, "your hand holds an arrow") | engine | **HARD** for anyone who is not the authority (§5: 2.2% of steps) |

---

## 3. Options

### (a) P2P commit-reveal ("mental poker")
Each deck is encrypted with **both** players' commutative keys (SRA over
BigInt, which Safari supports) and shuffled by both. A draw means the opponent
releases its decryption share for one card to the owner. At game end both keys
are revealed and the whole game replays through `judge.reduce` on full
information as an **audit**.

- *Why not plain "each phone shuffles its own deck and commits hashes":* the
  owner would then know its own deck order (a cheat, §1.2), and could stack it.
  Mixing in an opponent seed after the commit stops the stacking but still lets
  the owner compute the order. Hiding the owner's own order needs two-key
  encryption or a third party.
- **P7 (random pick from a hidden hand):** a joint coin flip (both commit a
  seed hash, then both reveal) picks a **slot index**. The owner reveals that
  slot's card, and the opponent can verify it only at the audit.
- **P13 cannot be checked live.** The opponent cannot know an action was
  affordable until the pitch is revealed, and some actions not even then
  ("my hand holds an arrow"). Validation becomes **trust now, audit later**.
- **Engine cost: the biggest of the three.** Each phone runs the reducer on a
  *partial* state. Any resolution that needs a hidden card (a draw mid-effect,
  clash, boost, a random discard) must **suspend**, run a network round trip,
  and resume. The spike measured that need at 5.8% of seat-steps, in the middle
  of `effects.js` resolutions. All 13 protocol cases need their own message
  shapes plus an audit replayer.
- **Cost:** XL (estimate 8–12 sessions), and the highest rules risk. **Benefit:**
  trustless and serverless. **Cheating is detected only after the game.**

### (b) Host-authoritative
The host phone runs `judge.reduce` on the full state and sends the guest
`view(state, guest)` plus reveals. The guest sends intents only.

- The guest's devtools see nothing hidden. **The host sees everything,** and
  could alter outcomes undetected unless the log is audited.
- Fix the seed (P11) with a commit-reveal: the host commits `H(seedH)`, the
  guest replies `seedG`, the host reveals, and `seed = H(seedH‖seedG)`. The
  host can then no longer bias the shuffle, and a post-game log plus seed lets
  the guest replay and verify every outcome. Peeking cannot be fixed this way.
- Engine cost: small. `view`, a per-seat feed, and reveals on the commit.
  `judge.reduce` is unchanged because it always runs on full state. P13
  disappears because the authority validates.
- **Acceptable for casual play** if labelled honestly ("the host's phone holds
  the deck"). It is a strict improvement on today, where both phones see all.
  **Not acceptable for ranked.**

### (c) Neutral referee
Option (b) with the host role on a device neither player controls: a third
phone (a friend or a store judge), or a server. The engine is dependency-free
UMD and already runs under Node in `npm test`.

- Candidates: **Cloudflare Workers + Durable Objects** (one stateful object per
  room, WebSocket-native, free tier) or **Supabase Edge Function + Postgres +
  Realtime** (per-move state load and store; SUPABASE.md's Deno compatibility is
  *unproven*: "ought to" is the first thing to prove).
- The referee is also the **ranked result authority**: it alone writes the Elo
  result, runs the throw, holds disconnect and forfeit clocks, and publishes the
  end-of-game log for audit and replays.
- Cost: the server proof plus operations. The free tier fits casual-scale
  ranked play, but no paid service may ever be *required*: if the server
  disappears, casual play (b) still works.

### Verdict

| | casual (now) | ranked (later) | engine cost | trust |
|---|---|---|---|---|
| (a) mental poker | yes | yes, with audit-after | XL | none needed; cheats caught after the game |
| (b) host referee | **yes** | no | S–M | trust the host |
| (c) neutral referee | optional (third phone) | **yes** | (b) + M | trust the referee |

**(b) and (c) are one design in two stages.** Write the authority once as
`engine/referee.js` (`createReferee({seed, builds}) → {intent(seat, action) →
{commits per seat}}`) and choose where it runs: inside the host phone (casual),
a third tab or phone (tournament), or a server (ranked). `net.js` already
anticipated this: *"keeps Phase C's move to a real server a RELOCATION of the
sequencer rather than a rewrite"*. The difference is that the sequencer becomes
an authority and the follower stops running the reducer on full state.

---

## 4. Engine changes

### 4.1 `view(state, seat)`: `engine/view.js` (built in H1, v6.02)

**Status at v6.02:** on the page (sparring.js calls it). Items 1–4 below are
built and drilled in `test/view.test.js`: the census is `CARRIERS` in
view.js; the own deck is its composition (`_unordered`), the foe gets
`unseen`; the known slot built is the pitch-zone bottom block (`_kb`);
`laMask` is `determinize(view)`. Known slots NOT built: a revealed top card
that stayed on top (the table never clears `revealed`, so a stale reveal cannot
be told from a live one, and opt reorders unseen; it needs its own mark), a
card a reveal showed in a hand, and Brain Freeze's hand-to-top. The three §7
questions are switches in view.js (`SWITCHES`), set by the user's ruling of
2026-11-07 (§7).
The text below is the spike's design, kept as written.

Redacts, for seat S: the foe's hand, face-down arsenal, intimidated cards and
face-down gear; **both decks** (count kept); and **`game.rng`**. A placeholder
has no text and a **positional** uid (`?<seat><zone><i>`), because a real uid
is a decklist index (§1). The spike found that the view must also **show**
cards that judge.js keeps in the hand after they went public:

- **`blockH`**: declared defenders stay in the hand until damage (`judge.js`
  ~2577). The combat chain is public (CR 3.0.4a).
- **`paySel`**: a card picked to pitch. The pitch zone is public, and today the
  selection crosses the wire one card at a time.
- **`pending`**: the card being played and paid for is still in the hand.

To do before it ships:
1. **A card-carrier census, like `invariants.js`'s.** Several game fields copy
   card objects: `revealed`, `featured.card`, `pend.card`, `chainCards`,
   `_discWay`, `prompt`/`promptQ` option lists, `intimidated`, `hist.*Names`.
   Each needs a visibility rule. The drill is the scramble: the
   `test/lookahead.test.js` drill, generalized. Swap hidden cards and
   `view` must not change, over self-play positions for all 15 heroes.
2. **Composition, not just counts.** The rule policy legitimately weighs its
   deck's *composition* (`judge.boostShare`, sparring.js v5.37). The spike's
   view erased it, and Dash's boost call flipped in 22 of 13,231 decisions. Keep
   the own deck as a canonically sorted multiset flagged `_unordered`, and give
   the foe an `unseen` multiset (decklist minus public cards).
3. **Known slots** (P12): pitched-to-bottom and revealed-then-replaced cards
   stay face-up-to-both inside the placeholder list.
4. **One body with `laMask`.** `laMask(g, seat, k)` should become
   `determinize(view(g, seat), k)`. It already pools exactly the foe's hand,
   deck and face-down arsenal, and reseeds. The scramble drill then proves both.

### 4.2 Legal actions from a seat's own view
Measured (§5): `judge.legal(view(g, s), a, s)` accepted **every one** of 13,231
actor actions, and the rule policy run on its own view chose the same action
**99.8%** of the time (all 22 misses come from item 2 above). So **a phone can
propose from its view alone**: the AI seat and the "<Hero>'s call" advisor too.
**Validation stays with the authority.** The observer's view cannot validate
2.2% of steps (P13: affordability before the pitch, and a hero power that needs
a hand card).

### 4.3 Reveals on the wire (`WIRE_V` 33 → 34)
- `INTENT` stays `{action}`, but an action that moves a hidden card to a hidden
  place (P3: arsenal, hand → deck) names a **slot handle**, not a uid. The spike
  saw 156 `arsenal` intents that would have told the opponent which card went
  face-down.
- `COMMIT` becomes **per seat**: `{seq, seat, action (redacted for the
  receiver), reveals: [{owner, zone, i, card}], h: hash(view(state, receiver))}`.
  `view.reveal(v, r)` is the unit, and it is in the spike.
- `SNAPSHOT` becomes `view(state, receiver)`. The journal keeps per-seat
  redacted commits.
- The feed: today's feed lines name cards inside `effects.js`. Lines need a
  `to` (`"all"` or a seat) **at the source**. Filtering afterwards misses
  paraphrases. The spike's leak scan found 163 reader-line pairs naming a card
  hidden from the reader. The sample checked was legitimate reveals (clash,
  fusion, "shows a hand"), which is exactly why reveal lines must be marked as
  reveals, not guessed.
- `revealed` becomes `{to, cards, until}`. Compass's "look at the top card of
  your deck" currently shows on both phones.
- Pure-JS SHA-256 in `engine/` for commitments (seed, throw). `wire.hash` is a
  desync canary, not a commitment. Avoid `crypto.subtle`, which needs a secure
  context, and file:// on iOS is not a safe bet.

### 4.4 Invariants, draws and JUDGE!! when no phone has the full state
- `invariants.check` runs **at the referee** on full state. Each phone runs a
  *view census* (zone sizes sum to the deck size, no duplicate visible uid).
- `judge.stalemateCheck`'s `still` hashes the state. It must hash only what both
  seats see (or run only at the referee), or two views disagree on a draw.
- **JUDGE!! reports** carry the reporter's view plus the action log. At game
  end the referee publishes the seed and the full log, so `judge.reduce`
  **replays the whole game on full information**. A report filed during the
  game is completed after it, and stays as reproducible as today's.

### 4.5 Resync and reconnect
The referee holds the truth, so a reconnecting phone gets
`SNAPSHOT(view(state, seat))`. Cheap catch-up replays that seat's redacted
commits. **New in the casual stage:** if the host phone drops, the game
pauses. The guest cannot take over without the hidden state, which is the
whole point. The host persists the state locally so a backgrounded host
resumes. State this honestly in the UI.

---

## 5. Spike result

`engine/view.js` (headless; `test/wire.test.js` HEADLESS is the flag) and
`tools/hidden-spike.js`: 30 self-play games across the hero grid, **13,231
actions**. Each step was judged from **both** seats' views, giving 26,462
seat-steps. For each step: reduce `view(before, seat)`, plus the reveals the
action itself names, then compare to `view(after, seat)`.

| measurement | result |
|---|---|
| actor's action **legal on its own view** | **13,231 / 13,231** (0 refusals) |
| rule policy on own view picks the **same action** | 13,209 (99.8%). 22 misses, all Dash's boost (composition, §4.1 item 2) |
| step computable from the view alone (no reveal) | **24,351 (92.0%)** |
| step needs an **action-carried reveal** (the action names the card) | play from hand 755 · defend 724 · pitch pick 618 · play from arsenal 131 · charge 11 · face-down gear 10 · fuse 4 · pick from a deck 20 |
| action names a hidden card that must **stay hidden** (P3) | `arsenal` 156: needs a slot handle |
| step needs a **resolution reveal** | **1,536 (5.8%)**: own draws ≈ 646; prompts listing hidden options ≈ 140; engine carry fields copying hidden cards (`_discWay`, `featured.card`, `pend.card`, `chainCards`) ≈ 250; private looks in `revealed` 40; token outcomes behind a deck-top reveal (clash) ≈ 64; boost 26; the rest scattered |
| step **refused** when replayed on the observer's view (P13) | **575 (2.2%)**: affordability before the pitch 560 · Blaze/Enigma/Arakni hero-power costs 13 · Azalea's "hand holds an arrow" 5 |
| seed withheld vs returned (`HHRNG=real`) | 1,536 → 1,519: randomness itself is rare; hidden *cards* are the work |

**What this proves:** with `view` plus reveals, every seat can *propose* from
its own view, and 92% of steps need nothing more. **The hard protocol cases are
exactly the steps a non-authority cannot compute:**

1. **Mid-resolution reveals** (draws, clash, boost, random discards, deck-top
   banishes). Easy for a referee, which emits them as reveals. Each one is a
   suspend-and-resume network round trip for P2P.
2. **Validation that reads a hidden hand** (2.2%). Only an authority, or an
   after-game audit, can check it.
3. **Card carriers** in engine fields and prompts. A redaction problem, solved by
   the census in §4.1, not by protocol.

That is the measured case for the referee design.

---

## 6. Phased plan

| release | scope | estimate | proving drills |
|---|---|---|---|
| **H1 · the view, for real** (engine only, no UI) · **built v6.02** | `engine/view.js` on the page; card-carrier census; composition and known slots; `laMask = determinize(view)`; per-seat `revealed`; feed `to` tags at the source | **M** · 2 sessions | the scramble drill over self-play for 15 heroes; policy-on-view equals policy (0 misses); spike as a drill: 0 legal refusals on the actor's view; feed-leak drill: no line names a card hidden from its reader unless the line is a reveal |
| **H2 · Hidden hands, casual** (**first shippable**) | `engine/referee.js` run by the host; guest gets views plus per-seat commits; WIRE_V 35 (H1 took 34); the feed filtered by `feedTo`; slot handles for P3; desync canary on view hashes; seed and **throw** commit-reveal (pure-JS SHA-256); post-game seed and log reveal with a "verify this game" replay; honest UI line "host holds the deck" | **L** · 3–4 sessions | loopback drill: over a full game for all 15 heroes the guest's memory holds **no hidden uid or name**; guest view after every commit equals `view(hostState, guest)`; reconnect and host-drop pause drills; throw commit drill (a late throw is refused) |
| **H3 · Neutral referee** | the same `referee.js` in a third browser (judge mode for a store table) and proven server-side (Durable Object or Edge Function) behind `net.wsAdapter` | **M–L** · 2–3 sessions | the server suite runs `test/` referee drills under Deno or Workers unchanged; a two-phone loopback through the referee; both players' phones are blind |
| **H4 · Ranked** | accounts (SUPABASE.md steps 1–2), the referee writes results and Elo, throw at the referee, forfeit clocks, published game logs and replays | **L** · 3–4 sessions | result-authority drills (a client cannot write a result); disconnect forfeit; Elo math drills |
| H5 · (optional) trustless P2P | mental poker plus audit, only if serverless ranked becomes a requirement | XL · 8–12 | not recommended now |

**What the first shippable increment (H2) gives players:** on a casual
two-phone game the **guest cannot see the host's hand, deck or future draws,
even with devtools**. **Neither phone can predict draws from the seed**, and
**neither can stack the first-player throw**. After the game, either player can
verify every shuffle and random pick from the revealed seed. Today both phones
can see everything. The host still could, and the game says so.

---

## 7. Visibility rules questions (DECIDED)

**RULING (user, 2026-11-07)**, each asked and answered verbatim. Each is one
switch in `engine/view.js` (`SWITCHES`); drilled in `test/view.test.js`.

1. *"Is the soul public?"* — **"Yes."** `SOUL_PUBLIC: true`. Both seats see the
   cards in a hero's soul, so **charge** (12 printings, Boltyn) shows the charged
   card, and its feed line naming it is fine. CR 3.0.4a lists the *hero* zone as
   public; the zones chapter says *"A hero's soul refers to the collection of
   sub-objects under the hero card."*
2. *"May an owner look at their own face-down intimidated card?"* — **"Yes."**
   `OWNER_SEES_INTIMIDATED: true`. The owner's view shows its own intimidated
   cards; the opponent's view does not (CR 8.5.10, CR 3.0.4c).
3. *"Is the order of pitched cards on the deck bottom known to the opponent?"* —
   **"No."** `PITCH_ORDER_PUBLIC: false`. The known bottom block (CR 4.4.3's end
   phase) is a set to the opponent, in canonical order; its owner knows the order.
