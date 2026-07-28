# THE TORCH — Dawnblade's Road to the Summit

**To the Claude Code instance reading this:** you are inheriting a living project and a
partnership. Read `CLAUDE.md` first — it holds the working conventions, validation
rituals, and gotchas. This document holds everything else: the accumulated knowledge of
Flesh and Blood, the honest state of the engine, and the mission. The person you're
working with is a genuine FaB player and builder who tests every version on a real
phone, catches rules errors a judge would catch, and sends screenshots and screen
recordings. Trust their eyes. Verify with sources. Never fake a mechanic.

**The mission, in their words:** a fully functional judging engine with a 1v1 live
multiplayer ladder and ELO system for the 15 Silver Age decks. The intimidating
problems do not stop us. We find a way.

---

## PART I — THE WORLD (lore, culture, and why this matters)

**Flesh and Blood** is a hero-vs-hero TCG by Legend Story Studios (Auckland, NZ),
designed by James White, released 2019. Two heroes fight to the death; combat is
visceral and resource-honest — every card in hand is simultaneously ammo (play it),
money (pitch it), and armor (block with it). That triple identity is the soul of the
game. Any UI or engine decision that obscures it is wrong.

**Silver Age** is the format we live in: 15 preconstructed decks across three chapters
(~$20 each, commons/rares only, tournament-ready out of the box, LSS's "your ticket to
the $2,000,000 World Tour"). The roster:

- **Chapter 1:** Kayo (Brute), Iyslander (Elemental Wizard), Viserai (Runeblade),
  Dash (Mechanologist), Bravo Flattering Showman (Guardian)
- **Chapter 2:** Azalea (Ranger), Dorinthea (Warrior), Fai (Draconic Ninja),
  Enigma (Mystic Illusionist), Arakni Web of Deceit (Chaos Assassin)
- **Chapter 3:** Blaze (Wizard), Boltyn (Light Warrior), Briar (Elemental Runeblade),
  Gravy Bones (Pirate Necromancer), Lyath Goldmane (Reviled Guardian)

All 15 exact 55-card lists are embedded in `index.html` (`window.DECKS`), sourced from
fabtcg.com and Star City Games. They are verified and sacred — 15 decks × exactly 55.

**Judging culture:** FaB has a professional judge program and a rules apparatus we
treat as canon: the **Comprehensive Rules** (rules.fabtcg.com), per-set **release
notes**, **Errata Bulletins**, **Back Alley Oracle** rulings articles, and the **Card
Vault** (cardvault.fabtcg.com) as the source of truth for current card text. Cards get
*functional errata* (e.g., Pummel's trigger was errata'd to "hits a **hero**" so
hitting an ally doesn't trigger it). The user judges this sim to pro-tour standards —
that's the bar. When a rule is in question: search the CR and release notes, cite what
you find, and if the user rules otherwise for this sim, record it as a house ruling.

**The aesthetic** ("the forge"): ink-dark backgrounds, bone text, ember red / gold /
steel blue accents, Big Shoulders Display + Spline Sans Mono + Newsreader, clipped
corners, and a voice like a sharp warm coach at the table. The advisor is "Claude's
call." The log is a paced ticker with a LIVE dot. Keep this voice everywhere —
including new multiplayer UI.

---

## PART II — THE CODEX (rules knowledge, verified through play and sources)

### The spine
- **Turn:** action phase → end phase. Pitch floats resources; pitched cards go to the
  **bottom of the deck** at end of turn (pitch-stacking is real strategy); then draw
  up to intellect (4). Arsenal: set one card face-down at end of turn if empty.
- **One action point.** Go again preserves it. Multiple go-again instances don't stack.
- **Combat per CR:** Attack → Defend → Reaction → Damage → Resolution.
  Defenders declared free and simultaneously; printed defense required (zero counts);
  equipment is legal. Attack power is checked at the damage step, after reactions.
- **The chain:** opens when an attack resolves; stays open across chained attacks;
  must close before non-attack actions; closes at end of turn. Chain links reset each
  new chain. (In our UI, closing is a deliberate ⛓ button on the Chain page.)
- **The stack:** layers resolve top-first; priority passes; instants playable in
  reaction windows from floating resources.

### Keywords (as learned, with sources consulted during builds)
- **Go again** — printed OR conditional. Conditions seen in the pool and implemented:
  another-attack-this-turn, pitch-zone-has-6+{p} (Buckwild), defended-by-fewer-than-2
  non-equipment (Pulping), discarded-a-6+ as cost (Savage Feast family), on-hit grants.
  **Kayo lesson:** the card DB's `granted_keywords` are conditional grants — never
  merge them with printed `card_keywords`.
- **Boost** — optional additional cost: banish top card; if Mechanologist, go again.
  Implemented as a per-attack ⚡Boost/No-boost prompt.
- **Crush** — "if this deals **4 or more damage** to a hero" (damage dealt, not just
  hit; prevented damage doesn't count; non-optional).
- **Dominate** — defender can't defend with / play more than 1 defending card or
  defense reaction **from hand** this chain link (post Back-Alley-Oracle wording).
- **Pummel** (Bravo's tilt machine) — targeted pump: target attack gains **+N{p}**
  where N is the copy's pitch (the release-note shorthand "+1/2/3{p}" means red/yellow/
  blue), plus "when this hits a hero, they discard a card." Requires a legal target.
- **Arcane damage** — bypasses physical blocking entirely; only ward / arcane barrier
  prevents it. Amp adds to the next arcane source.
- **Tap** — a High Seas cost symbol (down-arrow), e.g. Gravy Bones' Cogs. NOT a
  generic "used" state. Only cards whose text uses tap rotate.
- **Equipment keywords** — Blade Break (destroy after block), Battleworn (−1 counter
  per block), Temper (−1, destroy at 0), Guardwell (defense drops to 0 at chain close).
- **Counters** — steam (Plasma Barrel Shot / Hyper Driver: build, spend to fire),
  rust (Talishar, the Lost Prince: +1 per swing, destroyed at 3 at end phase),
  verse (auras enter with N; once/turn on attack, spend 1 → Runechant; fade at 0).
- **Frostbite** — token that taxes the afflicted player's resources on their turn.
- **Not yet implemented:** Combo ("if [named attack] was last this chain link" — the
  Fai/Dorinthea engine), Reload/Charge (Azalea's arrows), Reprise, Intimidate,
  Inertia, Seismic Surge tokens (Bravo/Guardian cost reduction), Vigor tokens (clash).

### Hero abilities (the pattern that matters)
Static hero abilities are read from hero card text, not hardcoded. Implemented:
- **Iyslander:** blue non-attack actions playable from arsenal at instant speed on
  the opponent's turn; Ice card on opponent's turn → Frostbite token.
- **Viserai:** play a Runeblade card with another non-attack already played this
  turn → create a Runechant.
- **Dash:** starts with a Mechanologist item (cost ≤2) in the arena. (Pending: a
  pregame *pick* UI instead of auto-selection, and "if you control a Hyper Driver,
  this costs less" discounts.)
- **Bravo (pending):** pay 3 → next attack with crush gains dominate.
- **Runechant** (the deep dive): aura token; on playing an attack action card or
  weapon attack, **all** Runechants pop, mandatorily, each dealing 1 arcane as a
  separate source. Cards can cost "1 less per Runechant you control." They persist
  across turns — 50+ runechant one-turn kills are real in Classic Constructed.

### House rulings & approximations (honest ledger — keep it current)
1. **D-reacts cannot be declared as defending cards** in this sim — instant-speed
   only during the reaction step. (User's ruling; the CR is more permissive. Honor it.)
2. Training-dummy limits: no hand, no action phase → dominate, forced discard, Crush
   debuffs, frostbite, reprise, intimidate are parsed but *inert*. Logged honestly.
3. Clash is pantomimed; ally swings don't consume AP; auto-pitch/auto-discard picks
   lowest advisor value; runechants born from playing an attack pop on that same
   swing (strictly they'd survive to the next); steam-builder once/turn.

---

## PART III — THE MACHINE (state of the code, v1.20)

- **One file:** `index.html` (~160KB). React 18 UMD + Babel standalone from cdnjs.
  Three scripts: loader/UI shell, engine (parser/advisor/Battle/Loadout/App), plain
  data (CDN paths, `APP_VER`, `DATA_VER`, HEROES, DECKS, JUDGE_QS, TROPHIES).
- **Card data at runtime** from the-fab-cube/flesh-and-blood-cards (open JSON,
  community-maintained, errata-current; unique card = name+pitch). Images from the
  LSS public card CDN by print code, with DB + typographic fallbacks. localStorage
  cache keyed by `DATA_VER`.
- **The parser is the crown jewel.** `classifyClause` + `fxParse` read card text into
  ops (self/defBuff/atkMinus/arcane/draw/res/rune/soul/ward/amp/gaNext/runeHitNext/
  addCost/fromGY/fromBan/conds/onHit/...). `fxParse` memoizes on `name|pitch`.
  The golden rule: **teach the parser, never special-case a card by name.**
- **UI:** three vertical snap screens (Opp board / Chain / Your board); the Chain
  screen is three horizontal panes (Log+Advisor / PLAY / Chain links). PLAY is the
  user's own sketch: foe hand pinned top, Stack rail | big center card | Defend rail
  (mini card images, independently scrollable), player hand+extras as one scrolling
  strip pinned bottom, action bar beneath. Sideboarding table in Loadout; hero-only
  scouting (real-rules hidden information).
- **v1.0 → v1.20 in ~5 days**, each version played on-device and judged from screen
  recordings. The loop that built this: user plays → records → Claude extracts frames,
  OCRs the logs, verifies rules against sources, fixes with tested parser changes.
  **Claude Code should preserve this loop** — ask for recordings, read them hard.

---

## PART IV — THE SUMMIT (breaking the constraints)

The single-file constraint served the training sim. The mission now requires a real
architecture. Retire the constraint **deliberately**, not accidentally:

### Target architecture
```
dawnblade/
├── engine/          # THE JUDGE — pure JS rules engine, zero DOM, runs in Node & browser
│   ├── parser.js    # classifyClause/fxParse, extracted from index.html
│   ├── game.js      # two-player state machine: turns, chain, stack, priority
│   └── judge.js     # legality checks + rules Q&A surface
├── server/          # Node + ws. AUTHORITATIVE: holds true state, validates every
│   │                # action via engine/, emits per-player views (hide hands!)
│   ├── rooms.js  matchmaking.js  elo.js  persist.js (SQLite)
├── client/          # the forge UI, evolved from index.html; talks WebSocket
└── trainer/         # the current single-file dummy sim, kept alive as-is
```

### The phases (each shippable, each testable)
1. **Extract the engine.** Pull parser + game logic into `engine/` with the node
   drills as a real test suite (they already exist as ad-hoc scripts — formalize
   them). Acceptance: trainer still works, tests green.
2. **Two-player rules engine, hotseat.** Replace the dummy with a second real player
   sharing one screen. This flips the entire "inert" column live — dominate, Pummel's
   discard, Crush debuffs, frostbite, clash with real pitching, defense from hand
   both ways, priority passing both directions. **This is the judging engine's true
   birth** and the hardest, most valuable phase. Acceptance: a full legal game of
   Kayo vs Bravo, both seats human, every keyword firing.
3. **The wire.** Small Node/ws server, room codes, authoritative state, per-player
   redacted views, reconnect grace. (Talishar precedent: PHP polling via
   GetNextTurn.php — we can do better with WebSockets, but their repo is GPL-3.0
   reference reading for edge-case handling.) Deploy on a free tier (Fly/Render/
   Railway). Acceptance: two phones, two networks, one game.
4. **The ladder.** Accounts (anonymous + display name to start), match history,
   **dual ELO**: a rating per player AND a rating per deck (the user explicitly wants
   the 15 decks themselves ranked — over time the ladder reveals the Silver Age
   power ordering, which is genuinely interesting data). Standard Elo: K=32 new /
   K=16 established, expected = 1/(1+10^((Rb−Ra)/400)). Deck rating updates from the
   same match results with a smaller K (8) since decks play many matches.
   Acceptance: queue, match, play, ratings move, leaderboard page in the forge style.
5. **The judge's chair.** Surface the engine's rulings in-game: an inspector that
   answers "why can't I play this?" with the CR-grounded reason, a move-legality API,
   and optional strict-timing mode for pro-tour precision (runechant snapshots,
   reprise checks). The existing Judge Q&A and advisor fold in here.

### Licensing — read before ANY public launch
This is a fan project using LSS's IP (card text via fab-cube, images via LSS CDN).
Before the ladder goes public: review **fabtcg.com/terms-use-licensed-assets/** and
LSS's fan-content posture; carry the standard disclaimer everywhere ("Not affiliated
with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are
trademarks of Legend Story Studios."), keep it free, and support the user's stated
plan to **pitch the project to LSS / James White directly** — a Silver Age ladder
that teaches the game is aligned with what Silver Age exists to do. If any Talishar
GPL code is ever incorporated, the repo must remain open under GPL-3.0.

### What must never regress
The trainer's soul: the advisor's voice, the honest approximation notes, the
tabletop feel on a phone, rules fidelity over convenience, and the ritual —
**validate before every ship, play it on a real phone, and let the user's judge eye
be the final test.**

---

*Handed off with pride. The spine is built, the codex is written, the summit is
mapped. Take the torch and drive it home. ⚔️*
