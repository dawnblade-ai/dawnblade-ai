# Dawnblade AI — Architecture

Dawnblade AI is a fan-made, non-commercial training tool for the Flesh and Blood
Silver Age (SAGE) format: single player versus a training dummy. It is in no way
affiliated with Legend Story Studios. Flesh and Blood™ and set names are
trademarks of Legend Story Studios®. All card names, card text, characters, and
artwork are © Legend Story Studios.

## How we use FaB materials (the Talishar logic)

Talishar holds no special license. It operates as an unaffiliated fan project
under LSS's published Terms of Use for game and studio assets: it credits every
card image "© Legend Story Studios," displays a clear non-affiliation
disclaimer, is free to play, and sells nothing bearing LSS assets. Dawnblade AI
follows the same posture. Concretely: the disclaimer above appears in the app
and every repo README; card images, if displayed, are credited to LSS and never
baked into merchandise or paid features; the project stays free. The rules
engine itself is the safest layer of all, because game mechanics are not
copyrightable — the code here is entirely original and implements procedures,
not card text. (Orientation, not legal advice.)

## What we take from Talishar's workflow

Talishar is split into a backend that owns all game logic and a thin frontend
that renders state. The backend exposes two operations: one that serializes the
current game state for the client (their `GetNextTurn.php`) and one that applies
a single player input and advances the game (`ProcessInput.php`). Card data
lives apart from the engine, and each card is wired to engine behavior rather
than containing logic itself. We mirror that contract in `engine/engine.js` as
`getView(state)` and `processInput(state, input)`. Because the whole game is a
pure state + input-reducer loop, the same engine can back a React UI, a CLI
simulator, or an AI self-play harness without modification.

## Engine layout

`engine/state.js` defines the game state: the player's zones (deck, hand,
arsenal, pitch, graveyard, banished), resources, action points, the combat
chain, and the dummy. RNG is seeded so any game can be replayed exactly —
important later for AI training and bug reports.

`engine/engine.js` is the state machine. A turn moves through ACTION →
(PAY_COSTS when a card is announced and short on resources) → END → next turn.
Attacks resolve on a combat chain; because the opponent is a training dummy,
the defense and reaction steps are skipped and every attack simply connects.
Go again grants an action point; on-hit triggers fire when damage lands; the
end phase bottoms pitched cards, offers an arsenal choice, and draws up to
intellect.

`engine/effects.js` is the association layer. Cards never contain code. A card
definition lists abilities as `{ trigger, effect, params }` tuples pointing at
a small vocabulary of primitives (draw, gainResources, buffActivePower,
dealArcane, gainLife, addCounter, and so on). Implementing the card pool means
growing this vocabulary plus the per-card association table — not writing
per-card code. The keyword registry also records which keywords are inert
against a dummy (dominate, intimidate, overpower, piercing) so they cost
nothing now but light up automatically in a future PvP mode.

## Card data pipeline

Card stats are never typed from memory. `data/ingest-fab-cube.js` consumes the
community-maintained machine-readable FaB card dataset
(the-fab-cube/flesh-and-blood-cards on GitHub), filters to the SAGE pool,
normalizes stats, attaches our effect associations, and emits a coverage
report: every card is classified as vanilla, keyword-only, associated, or
needs-association. Unimplemented text is an explicit TODO, never a silent
misplay. `data/demo-cards.js` is a clearly-labeled placeholder pool used only
to exercise the engine until real data is ingested.

## Current simplifications (dummy mode)

The dummy never attacks, defends, or holds cards, so there is no defense step,
no defense reactions, no attack reactions, and no opposing turn. Equipment,
weapons, and hero abilities are stubbed. Opt is peek-only pending an
interactive choice input. These are deliberate: the state machine has the slots
for each (the chain structure already records links for combo checks), so they
are additive work, not rewrites.

## Roadmap

Next steps in rough order: ingest the real SAGE pool and generate the coverage
report; implement hero abilities and weapons for the fifteen precon heroes;
add interactive choice inputs (opt, targeting) to `processInput`; connect the
character-select screen so Start Match creates a game with the chosen precon
list; then a simple coach layer that critiques pitch and sequencing decisions
against the greedy baseline in `sim/demo.js`.
