# THE STACK — rulings Dawnblade is waiting on

Generated 2026-08-01T20:55:00.436Z from `tools/audit.json`.

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
  As an additional cost to play V of the Vanguard, you may charge your hero's soul any number of times.  
  Attacks on this combat chain gain +1{p} for each Light card charged this way.
  - ⛔ unread: Attacks on this combat chain gain +1{p} for each Light card charged this way.

## One-off cards — 0 cards whose own text needs a reading

