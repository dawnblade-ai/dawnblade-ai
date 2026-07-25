# THE STACK — rulings Dawnblade is waiting on

Generated 2026-07-25T19:10:09.295Z from `tools/audit.json`.

Every gap below is charged to the *mechanic* that causes it, so one
answer lights up every card in its list. Nothing here is guessed:
these sit in the stack because neither the card text nor the card
database defines them, and the golden rule forbids inventing effects.

Answer one with:

```bash
node tools/stack.js explain <slug> "your ruling"
```

| # | mechanic | status | cards | decks |
|---|---|---|---|---|
| 1 | `fusion` | unmodelled | 1 | 1 |

## fusion  `fusion`

*unmodelled* — fusion — the elemental reveal/pitch cost

Decks affected: Briar

- **Weave Lightning** (pitch 1, Lightning Action)  
  The next Lightning or Elemental attack action card you play this turn gains +3{p}. If it's fused, it gains go again.  
  Go again
  - ⛔ unread: If it's fused, it gains go again.

## One-off cards — 9 cards whose own text needs a reading

- **Path of Same Ends** (pitch 1, Lightning Runeblade Action - Attack) — Briar
  - ⛔ If damage is dealt this way, this gets go again.
- **Carrion Crown** (pitch 0, Necromancer Equipment - Head) — Gravy Bones
  - ⛔ Action - Discard an ally, destroy this: Draw a card
- **Scuttle Toes** (pitch 0, Necromancer Equipment - Legs) — Gravy Bones
  - ⛔ Instant - {r}{r}, destroy this: {u} target ally you control
- **Washed Up Wave** (pitch 0, Pirate Necromancer Equipment - Arms) — Gravy Bones
  - ⛔ When this defends, you may discard a card or destroy the top card of your deck
  - ⛔ If that card has watery grave, this gets +2{d}.
- **Saltwater Swell** (pitch 1, Pirate Action - Attack) — Gravy Bones
  - ⛔ If it's blue, pitch it.
- **Jittery Bones** (pitch 3, Pirate Necromancer Action - Attack) — Gravy Bones
  - ⛔ When this attacks, you may discard a card or destroy the top card of your deck
  - ⛔ If that card has watery grave, this gets go again.
- **Saltwater Swell** (pitch 3, Pirate Action - Attack) — Gravy Bones
  - ⛔ If it's blue, pitch it.
- **Throw Caution to the Wind** (pitch 3, Pirate Instant) — Gravy Bones
  - ⛔ The next time you would be dealt damage this turn, prevent X of that damage, where X is the pitch value of the card revealed this way.
- **Line Crossers** (pitch 0, Reviled Equipment - Arms) — Lyath Goldmane
  - ⛔ If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you.
