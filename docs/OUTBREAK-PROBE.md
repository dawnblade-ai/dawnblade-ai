# Outbreak readiness probe (SLV, SFC) — 2026-11-23

READ-ONLY. Nothing was pinned into `data/`; the scratch census ran `engine/parser.js` over a downloaded copy of the upstream card file.

## Upstream, today
- Repo `the-fab-cube/flesh-and-blood-cards` heads (`git ls-remote`; the GitHub API is 403 from this sandbox):
  `develop 3f16c0b`, `main 0533cae`, **`outbreak fa8e6bd7d7…`** (full: `fa8e6bd71d7f9a789aadf082920ea4760bd08ced`), `usurp-the-shadow-throne ec42d95` (the pinned September commit).
- `develop` card.json: 4965 records, **0** printings in SLV/SFC/OBK. `outbreak` card.json: 5361 records.
- `csvs/english/set.csv` on `outbreak` lists `SLV` "Silver Age - Mortimer, Living Virus", `SFC` "Silver Age - α-01, First Cogwarden", and a new set `OBK` "Outbreak".
- Distinct cards by printing set on `outbreak`: **SLV 4** (Mortimer hero + 3 disease tokens: Bloodrot Pox, Exertion, Inertia), **SFC 1** (α-01 hero), **OBK 41** (the Outbreak set; includes both heroes again plus other heroes and ~30 playable cards). The roadmap's "4 cards" undercounts: OBK is new since it was written.
- No precon deck lists reachable. `fabrary.net` still **403 at the proxy** (not bypassed); `fabtcg.com` 403; `fabdb.net`, `legendarystory.net` unreachable. The only text is the-fab-cube's.
- OBK is a booster set, not the precons: the SLV/SFC 60-card lists are still unknown. Heroes in OBK: Mortimer, α-01, Azalea (Ace of Spades / Lone Vigilante), Huxley (+Racketeer), Min (Genius/Half-Genius/Mad/Half-Mad), Vyle (+Catalyst of Collapse).

## Parser census (`fxParse` tiers; heroes via `audit.analyzeHero`)
Run with the repo's own census logic over SLV+SFC+OBK records and their tokens (script and raw output: kept in the session scratchpad, reproducible from the commit above).
Playable non-hero rows: 3 tokens + 28 distinct cards (counting each pitch). Tiers: **full** — Bloodrot Pox, Inertia, Cogwerx Dueling Pistol, Pauper's Knife; **part** — 15 rows; **none** — 11 rows (Back Alley ×3, Exertion Bloom, Extinction Level Event, Incubator Implanter, Quiet Streets, Swap Spit ×3). All 12 hero rows (every face) have unread clauses.

## Missing readers, in a likely build order
Disease is NOT a keyword in the CR page today (grep of 8-keywords: no `cure`, no `disease`); it is a label used in card text. Tokens Bloodrot Pox and Inertia are defined in CR 8.6 (verbatim: "A Bloodrot Pox token is a token with the name "Bloodrot Pox," the subtype aura, and the triggered ability "At the beginning of your end phase, destroy this, then it deals 2 damage to you unless you pay {r}{r}{r}."" / "A Inertia token is a token with the name "Inertia," the subtype aura, and the triggered ability "At the beginning of your end phase, destroy this, then put all cards from your hand and arsenal on the bottom of your deck.""). **Exertion** has no CR 8.6 entry yet. Upstream keyword list for the set: Cure (2 cards), Veil (1), Stealth (3, already read; CR: "Stealth is an ability that means nothing."), Boost, Go again. `Veil` appears in zero pinned-pool cards.

1. **Disease tokens as a class** — the whole set hangs on it. Needs: "disease token" as a subtype-class test in `types.js`/`parser`; "create X token under [attacking and defending heroes' / each hero's / each opponent's / target hero's] control" (Courier ×3, Exertion Bloom, Back Alley ×3, Mortimer's Lab, Mortimer hero); "give them a disease token you control" (Patient Zero ×3); "create a token copy of a disease token you control under each opponent's control" (Mortimer ability); Exertion's "whenever you play a card from hand, lose 1{h}" (token trigger, part-read today).
2. **Cure** — "cure a disease you control" as cost and effect (Curative Ceremony: additional cost + per-cure modal; Cure-All Elixir), "infected with Bloodrot Pox" (Incubator Implanter's granted trigger).
3. **Bank on-play triggers** — "When an activated ability or action card effect puts this face-up into a zone from your deck" (Back Alley ×3): needs a deck-to-arsenal-face-up event with a cause test.
4. **Face-up arsenal from deck** — "put the top card of your deck face-up into your arsenal" for each hero (Azalea, Vyle, Incite ×2), "If it's red/blue/arrow/stealth…" conditional on that card, Vyle's "opponent has a face-up card in their arsenal" static, One-Click Pinpointer (arsenal to deck bottom, arrow from hand to arsenal, cost +{r} if a tapped bow). Shares ground with Azalea/Boltyn work already in the pool.
5. **Veil** (new reader): granted keyword "gets veil" — check CR before reading; not yet in the section scrape.
6. **Random choice on a chain link** — "Choose a random non-equipment card on the active chain link. It gets ±3{p} ±3{d}" (Quiet/Raging Streets); needs the seeded RNG on both boards (`rng.js`) and a view rule.
7. **Random token swap** — Swap Spit ×3 (random disease on each side, give to each other).
8. **Reveal-top conditional** — Max-Tension Shot ("reveal the top card… If it's red, this gets go again"), Mortimer's Lab macro ("first time you hit each turn… reveal top card; red/yellow/blue → token"). The Macro type is CR 1.5 ("A macro is a non-card object in the arena") — a macro is a new object kind, defined by tournament rules.
9. **Boost bookkeeping** — "+2{p} for each non-Mechanologist card banished from boosting this" (Bootlegger Bust-Up ×3). Huxley: "banish an action card with stealth from boosting… play it as an instant". α-01: "an arrow you've banished from boosting this turn". Both need a per-turn boost-banish ledger.
10. **Win-condition + naming** — Extinction Level Event ("name a disease token", "33 or more disease tokens… you win"): naming prompt and a start-of-turn win trigger; the engine has none (deck-out is not a loss; this is a real win trigger).
11. **Min** (not a precon hero): "Cards you own are Mechanologist" / "lose and can't gain class and talent types" + flip at end phase — type-layer effect; defer, not needed for SLV/SFC.
Heroes' own unread clauses: Mortimer (item 1, "Activate this only during your turn" — read elsewhere? it printed unread, check), α-01 (item 9, plus "+1{p} counters on a card in arsenal" and "next arrow with a +1{p} counter gets go again"), Azalea/Vyle (item 4).

## Environment / hosts
- `raw.githubusercontent.com`, `rules.fabtcg.com`, `github.com` (git ls-remote): reachable now, no change needed.
- Needed when lists publish: `fabrary.net` (403 today — ask for it then); possibly `fabtcg.com` (official product pages, 403) as a second source. `api.github.com` is 403 (commit date / diff API) — raw files and `git ls-remote` are enough.

## Recommendation
Nothing hero-visible can start before the lists publish: there is no deck, and tools/pin-staged.js scopes to sets named in `data/newsets.json`, so pinning would stage dead text. But reader work is not blocked by the lists and does not touch the hero list: items 1–3 and 5 (disease tokens, Cure, deck-to-arsenal trigger, Veil) are exercised by named text in the 31 rows above and can be drilled from this branch's scratch copy under unique drill-card names, as an experiment on `findings/queue`. Pin the `outbreak` commit into `data/staged.js` only after the user opens the heroes (set `SLV`/`SFC` in `newsets.json`), and re-run this census then — OBK cards are only needed if the precon lists include them; unknown today, RULING (user, 2026-11-23): only cards actually in the precons — OBK-only cards are out unless a precon list prints them.

## Full census output (verbatim)

```

### Azalea, Ace of Spades  [OBK] Assassin Ranger Hero cost: pow: def:
text: Instant - {t}, put a card from your arsenal on the bottom of your deck: Put the top card of your deck face-up into your arsenal. If it has stealth, it gets +1{p} and go again this turn. If it's an arrow, it gets veil this turn.
HERO unread: Instant - {t}, put a card from your arsenal on the bottom of your deck: Put the top card of your deck face-up into your arsenal || If it has stealth, it gets +1{p} and go again this turn || If it's an arrow, it gets veil this turn.

### Azalea, Lone Vigilante  [OBK] Assassin Ranger Hero Young cost: pow: def:
text: Instant - {t}, put a card from your arsenal on the bottom of your deck: Put the top card of your deck face-up into your arsenal. If it has stealth, it gets +1{p} and go again this turn. If it's an arrow, it gets veil this turn.
HERO unread: Instant - {t}, put a card from your arsenal on the bottom of your deck: Put the top card of your deck face-up into your arsenal || If it has stealth, it gets +1{p} and go again this turn || If it's an arrow, it gets veil this turn.

### Back Alley Bilebank 2 [OBK] Chaos Action Attack cost:1 pow:4 def:3
text: When an activated ability or action card effect puts this face-up into a zone from your deck, create an Exertion token under a hero's control.
tier none SKIP: When an activated ability or action card effect puts this face-up into a zone from your deck, create an Exertion token under a hero's control.

### Back Alley Bloodbank 1 [OBK] Chaos Action Attack cost:1 pow:5 def:3
text: When an activated ability or action card effect puts this face-up into a zone from your deck, create a Bloodrot Pox token under a hero's control.
tier none SKIP: When an activated ability or action card effect puts this face-up into a zone from your deck, create a Bloodrot Pox token under a hero's control.

### Back Alley Plasmabank 3 [OBK] Chaos Action Attack cost:1 pow:3 def:3
text: When an activated ability or action card effect puts this face-up into a zone from your deck, create an Inertia token under a hero's control.
tier none SKIP: When an activated ability or action card effect puts this face-up into a zone from your deck, create an Inertia token under a hero's control.

### Bloodrot Courier 1 [OBK] Chaos Action Attack cost:2 pow:4 def:3
text: When this hits a hero, create a Bloodrot Pox token under the attacking and defending heroes' control. | Go again
tier part SKIP: When this hits a hero, create a Bloodrot Pox token under the attacking and defending heroes' control.

### Bloodrot Pox  [SLV] Generic Token Disease Aura cost: pow: def:
text: At the beginning of your end phase, destroy this, then it deals 2 damage to you unless you pay {r}{r}{r}.
tier full

### Bootlegger Bust-Up 1 [OBK] Mechanologist Action Attack cost:3 pow:6 def:3
text: Boost | This gets +2{p} for each non-Mechanologist card banished from boosting this.
tier part SKIP: This gets +2{p} for each non-Mechanologist card banished from boosting this.

### Bootlegger Bust-Up 2 [OBK] Mechanologist Action Attack cost:3 pow:5 def:3
text: Boost | This gets +2{p} for each non-Mechanologist card banished from boosting this.
tier part SKIP: This gets +2{p} for each non-Mechanologist card banished from boosting this.

### Bootlegger Bust-Up 3 [OBK] Mechanologist Action Attack cost:3 pow:4 def:3
text: Boost | This gets +2{p} for each non-Mechanologist card banished from boosting this.
tier part SKIP: This gets +2{p} for each non-Mechanologist card banished from boosting this.

### Cogwerx Dueling Pistol  [OBK] Mechanologist Weapon Pistol 1H cost: pow:2 def:
text: Action - {t}, remove a steam counter from this: Attack | Action - {r}, {t}: If this has no steam counters, put a steam counter on it. Go again
tier full

### Curative Ceremony 1 [OBK] Chaos Action Attack cost:0 pow:4 def:3
text: As an additional cost to play this, each hero cures a disease they control if able. Choose a mode for each disease cured this way; |  | This gets +2{p}. | This gets go again. | This gets veil.
tier part SKIP: Choose a mode for each disease cured this way; || This gets veil.

### Cure-All Elixir  [OBK] Generic Action cost:1 pow: def:3
text: Your next attack this turn gets +3{p}. | You may cure a disease you control. If you do, gain 1{h}. | Go again
tier part SKIP: You may cure a disease you control || If you do, gain 1{h}.

### Exertion  [SLV] Generic Token Disease Aura cost: pow: def:
text: Whenever you play a card from hand, lose 1{h}. | At the beginning of your end phase, destroy this.
tier part SKIP: Whenever you play a card from hand, lose 1{h}.

### Exertion Bloom 2 [OBK] Chaos Instant cost:3 pow: def:3
text: This costs {r}{r}{r} less to play during your turn. | Create an Exertion token under each hero's control.
tier none SKIP: This costs {r}{r}{r} less to play during your turn. || Create an Exertion token under each hero's control.

### Exertion Courier 2 [OBK] Chaos Action Attack cost:2 pow:3 def:3
text: When this hits a hero, create an Exertion token under the attacking and defending heroes' control. | Go again
tier part SKIP: When this hits a hero, create an Exertion token under the attacking and defending heroes' control.

### Extinction Level Event 1 [OBK] Chaos Action Aura cost:0 pow: def:3
text: When this enters the arena, name a disease token. Disease tokens with the chosen name lose and can't gain abilities while this is in the arena. | At the start of your turn, if there are 33 or more disease tokens in the arena, you win the game.
tier none SKIP: When this enters the arena, name a disease token || Disease tokens with the chosen name lose and can't gain abilities while this is in the arena. || At the start of your turn, if there are 33 or more disease tokens in the arena, you win the game.

### Huxley  [OBK] Assassin Mechanologist Hero Young cost: pow: def:
text: Whenever you banish an action card with stealth from boosting, you may {t} this. If you do, you may play the banished card as though it were an instant this turn.
HERO unread: Whenever you banish an action card with stealth from boosting, you may {t} this || If you do, you may play the banished card as though it were an instant this turn.

### Huxley, Racketeer  [OBK] Assassin Mechanologist Hero cost: pow: def:
text: Whenever you banish an action card with stealth from boosting, you may {t} this. If you do, you may play the banished card as though it were an instant this turn.
HERO unread: Whenever you banish an action card with stealth from boosting, you may {t} this || If you do, you may play the banished card as though it were an instant this turn.

### Incite Aggression 1 [OBK] Chaos Action cost:1 pow: def:3
text: Each hero puts the top card of their deck face-up into their arsenal. If a red card is put face-up into an arsenal this way, your next attack this turn gets go again. | Go again
tier part SKIP: Each hero puts the top card of their deck face-up into their arsenal

### Incite Resolve 3 [OBK] Chaos Action cost:1 pow: def:3
text: Each hero puts the top card of their deck face-up into their arsenal. If a blue card is put face-up into an arsenal this way, your next attack this turn gets +2{p}. | Go again
tier part SKIP: Each hero puts the top card of their deck face-up into their arsenal

### Incubator Implanter 1 [OBK] Ranger Action Arrow Attack cost:1 pow:3 def:3
text: When this attacks a hero, if they are infected with Bloodrot Pox, this gets "When this hits a hero, for the rest of the game, at the beginning of their end phase, create a Bloodrot Pox token under their control."
tier none SKIP: When this attacks a hero, if they are infected with Bloodrot Pox, this gets "When this hits a hero, for the rest of the game, at the beginning of their end phase, create a Bloodrot Pox token under their control."

### Inertia  [SLV] Generic Token Disease Aura cost: pow: def:
text: At the beginning of your end phase, destroy this, then put all cards from your hand and arsenal on the bottom of your deck.
tier full

### Inertia Courier 3 [OBK] Chaos Action Attack cost:2 pow:2 def:3
text: When this hits a hero, create an Inertia token under the attacking and defending heroes' control. | Go again
tier part SKIP: When this hits a hero, create an Inertia token under the attacking and defending heroes' control.

### Max-Tension Shot 1 [OBK] Ranger Action Arrow Attack cost:1 pow:5 def:3
text: When this attacks, reveal the top card of your deck. If it's red, this gets go again.
tier part SKIP: If it's red, this gets go again.

### Min, Genius  [OBK] Chaos Mechanologist Hero cost: pow: def:
text: Cards you own are Mechanologist. | At the beginning of your end phase, flip this.
HERO unread: Cards you own are Mechanologist. || At the beginning of your end phase, flip this.

### Min, Half-Genius  [OBK] Chaos Mechanologist Hero Young cost: pow: def:
text: Cards you own are Mechanologist. | At the beginning of your end phase, flip this.
HERO unread: Cards you own are Mechanologist. || At the beginning of your end phase, flip this.

### Min, Half-Mad  [OBK] Chaos Mechanologist Hero Young cost: pow: def:
text: Cards you own lose and can't gain class and talent types. | At the beginning of your end phase, flip this.
HERO unread: Cards you own lose and can't gain class and talent types. || At the beginning of your end phase, flip this.

### Min, Mad  [OBK] Chaos Mechanologist Hero cost: pow: def:
text: Cards you own lose and can't gain class and talent types. | At the beginning of your end phase, flip this.
HERO unread: Cards you own lose and can't gain class and talent types. || At the beginning of your end phase, flip this.

### Mortimer, Living Virus  [OBK/SLV] Chaos Assassin Hero Young cost: pow: def:
text: Instant - {r}, {t}: Create a token copy of a disease token you control under each opponent's control. Activate this only during your turn.
HERO unread: Instant - {r}, {t}: Create a token copy of a disease token you control under each opponent's control || Activate this only during your turn.

### Mortimer's Lab  [OBK] Outbreak Macro cost: pow: def:
text: The first time you hit an opposing hero each turn, they reveal the top card of their deck. If it's; | - Red, create a Bloodrot Pox token under their control. | - Yellow, create an Exertion token under their control. | - Blue, create an Inertia token under their control.
tier part SKIP: The first time you hit an opposing hero each turn, they reveal the top card of their deck || If it's;

### One-Click Pinpointer  [OBK] Ranger Weapon Bow 1H cost: pow: def:
text: Action - {t}: Put all cards from your arsenal on the bottom of your deck. Put an arrow from your hand face-up into your arsenal. If you control a tapped bow, this costs {r} more to activate. Go again
tier part SKIP: Action - {t}: Put all cards from your arsenal on the bottom of your deck || Put an arrow from your hand face-up into your arsenal || If you control a tapped bow, this costs {r} more to activate

### Patient Zero 1 [OBK] Assassin Action Attack cost:0 pow:3 def:3
text: Stealth | When this hits a hero, give them a disease token you control.
tier part SKIP: When this hits a hero, give them a disease token you control.

### Patient Zero 2 [OBK] Assassin Action Attack cost:0 pow:2 def:3
text: Stealth | When this hits a hero, give them a disease token you control.
tier part SKIP: When this hits a hero, give them a disease token you control.

### Patient Zero 3 [OBK] Assassin Action Attack cost:0 pow:1 def:3
text: Stealth | When this hits a hero, give them a disease token you control.
tier part SKIP: When this hits a hero, give them a disease token you control.

### Pauper's Knife  [OBK] Assassin Weapon Dagger 1H cost: pow:1 def:
text: Action - {r}{r}, {t}: Attack. Go again
tier full

### Quiet Streets 2 [OBK] Chaos Instant cost:0 pow: def:
text: Choose a random non-equipment card on the active chain link. It gets -3{p} -3{d} this chain link.
tier none SKIP: Choose a random non-equipment card on the active chain link || It gets -3{p} -3{d} this chain link.

### Raging Streets 2 [OBK] Chaos Instant cost:0 pow: def:
text: Choose a random non-equipment card on the active chain link. It gets +3{p} +3{d} this chain link.
tier part SKIP: Choose a random non-equipment card on the active chain link

### Swap Spit 1 [OBK] Chaos Defense Reaction cost:0 pow: def:3
text: When this defends, choose a disease token you control at random. Target opponent chooses a disease token they control at random. Give them to each other.
tier none SKIP: When this defends, choose a disease token you control at random || Target opponent chooses a disease token they control at random || Give them to each other.

### Swap Spit 2 [OBK] Chaos Defense Reaction cost:0 pow: def:2
text: When this defends, choose a disease token you control at random. Target opponent chooses a disease token they control at random. Give them to each other.
tier none SKIP: When this defends, choose a disease token you control at random || Target opponent chooses a disease token they control at random || Give them to each other.

### Swap Spit 3 [OBK] Chaos Defense Reaction cost:0 pow: def:1
text: When this defends, choose a disease token you control at random. Target opponent chooses a disease token they control at random. Give them to each other.
tier none SKIP: When this defends, choose a disease token you control at random || Target opponent chooses a disease token they control at random || Give them to each other.

### Vyle  [OBK] Chaos Ranger Hero Young cost: pow: def:
text: Instant - {r}{r}, {t}: Each hero puts the top card of their deck face-up into their arsenal. Activate this only during your turn. | If an opponent has a face-up card in their arsenal, your arrow attacks get +1{p}.
HERO unread: Instant - {r}{r}, {t}: Each hero puts the top card of their deck face-up into their arsenal || Activate this only during your turn. || If an opponent has a face-up card in their arsenal, your arrow attacks get +1{p}.

### Vyle, Catalyst of Collapse  [OBK] Chaos Ranger Hero cost: pow: def:
text: Instant - {r}{r}, {t}: Each hero puts the top card of their deck face-up into their arsenal. Activate this only during your turn. | If an opponent has a face-up card in their arsenal, your arrow attacks get +1{p}.
HERO unread: Instant - {r}{r}, {t}: Each hero puts the top card of their deck face-up into their arsenal || Activate this only during your turn. || If an opponent has a face-up card in their arsenal, your arrow attacks get +1{p}.

### α-01, First Cogwarden  [OBK/SFC] Mechanologist Ranger Hero Young cost: pow: def:
text: Instant - {r}, {t}: Put an arrow you've banished from boosting this turn face-up into your arsenal. If you do, put two +1{p} counters on it. | Instant - {r}, {t}: The next arrow with a +1{p} counter you play this turn gets go again.
HERO unread: Instant - {r}, {t}: Put an arrow you've banished from boosting this turn face-up into your arsenal || If you do, put two +1{p} counters on it. || Instant - {r}, {t}: The next arrow with a +1{p} counter you play this turn gets go again.

KEYWORDS {"Go again":9,"Boost":3,"Cure":2,"Veil":1,"Stealth":3}
```
