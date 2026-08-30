# THE STACK — rulings Dawnblade is waiting on

Generated 2026-08-30T01:17:30.710Z from `tools/audit.json`.

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
| 1 | `charge` | pending | 2 | 1 |

## charge  `charge`

*pending* — RULED 2026-07-25 (spec in tools/rulings.json) — Boltyn's soul engine

Decks affected: Boltyn

- **Roaring Beam** (pitch 2, Light Warrior Attack Reaction)  
  Create a Courage token.  
  If there are no cards in your soul, return this to its owner's hand, then charge your soul.
  - ⛔ unread: If there are no cards in your soul, return this to its owner's hand, then charge your soul.
  - ↳ **Courage** (Generic Token - Aura) — When you play an attack action card or activate a weapon attack, destroy this and the attack gets +1{p}.
- **V of the Vanguard** (pitch 2, Light Warrior Action - Attack)  
  Boltyn Specialization  
  As an additional cost to play this, you may charge your soul any number of times.  
  Your attacks this combat chain get +1{p} for each Light card charged this way.
  - ⛔ unread: Your attacks this combat chain get +1{p} for each Light card charged this way.

## One-off cards — 3 cards whose own text needs a reading

- **Halo of Illumination** (pitch 0, Light Equipment - Head) — Boltyn
  - ⛔ Instant - {r}, destroy this: Put a card from your hand into your soul
  - ⛔ If it's Light, draw a card.
- **Radiant Touch** (pitch 0, Light Equipment - Arms) — Boltyn
  - ⛔ Instant - Banish this and a card from your soul: Prevent the next 2 damage that would be dealt to you this turn.
- **Walk in My Shoes** (pitch 2, Reviled Guardian Action - Attack) — Lyath Goldmane
  - ⛔ Crush - When this deals 4 or more damage to a hero, until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up.
