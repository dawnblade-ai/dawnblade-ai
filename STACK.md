# THE STACK — rulings Dawnblade is waiting on

Generated 2026-08-01T00:45:36.903Z from `tools/audit.json`.

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
| 1 | `charge` | pending | 12 | 1 |
| 2 | `high-tide` | unreviewed | 2 | 1 |
| 3 | `surge` | unreviewed | 1 | 1 |

## charge  `charge`

*pending* — RULED 2026-07-25 (spec in tools/rulings.json) — Boltyn's soul engine

Decks affected: Boltyn

- **Beaming Bravado** (pitch 1, Light Warrior Action - Attack)  
  As an additional cost to play this, you may charge your hero's soul.  
  If a yellow card is charged this way, this gets +1{p}
  - ⛔ unread: If a yellow card is charged this way, this gets +1{p}
- **Bolt of Courage** (pitch 1, Light Warrior Action - Attack)  
  As an additional cost to play Bolt of Courage, you may charge your hero's soul.  
  If you've charged this turn, Bolt of Courage gains "If this hits, draw a card."
  - ⛔ unread: If you've charged this turn, this gains "If this hits, draw a card."
- **Engulfing Light** (pitch 1, Light Warrior Action - Attack)  
  As an additional cost to play Engulfing Light, you may charge your hero's soul.  
  If you've charged this turn, Engulfing Light gains "If this hits, put it into your hero's soul."
  - ⛔ unread: If you've charged this turn, this gains "If this hits, put it into your hero's soul."
- **Light the Way** (pitch 1, Light Warrior Action - Attack)  
  As an additional cost to play this, you may charge your hero's soul.  
  When this hits, if a yellow card was charged this way, this gets go again.
  - ⛔ unread: When this hits, if a yellow card was charged this way, this gets go again.
- **Take Flight** (pitch 1, Light Warrior Action - Attack)  
  As an additional cost to play Take Flight, you may charge your hero's soul.  
  If you've charged this turn, Take Flight gains go again.
  - ⛔ unread: If you've charged this turn, this gains go again.
- **Beaming Bravado** (pitch 2, Light Warrior Action - Attack)  
  As an additional cost to play this, you may charge your hero's soul.  
  If a yellow card is charged this way, this gets +1{p}
  - ⛔ unread: If a yellow card is charged this way, this gets +1{p}
- **Bolt of Courage** (pitch 2, Light Warrior Action - Attack)  
  As an additional cost to play Bolt of Courage, you may charge your hero's soul.  
  If you've charged this turn, Bolt of Courage gains "If this hits, draw a card."
  - ⛔ unread: If you've charged this turn, this gains "If this hits, draw a card."
- **Engulfing Light** (pitch 2, Light Warrior Action - Attack)  
  As an additional cost to play Engulfing Light, you may charge your hero's soul.  
  If you've charged this turn, Engulfing Light gains "If this hits, put it into your hero's soul."
  - ⛔ unread: If you've charged this turn, this gains "If this hits, put it into your hero's soul."
- **Light the Way** (pitch 2, Light Warrior Action - Attack)  
  As an additional cost to play this, you may charge your hero's soul.  
  When this hits, if a yellow card was charged this way, this gets go again.
  - ⛔ unread: When this hits, if a yellow card was charged this way, this gets go again.
- **Roaring Beam** (pitch 2, Light Warrior Attack Reaction)  
  Create a Courage token.  
  If there are no cards in your soul, return this to its owner's hand, then charge your soul.
  - ⛔ unread: If there are no cards in your soul, return this to its owner's hand, then charge your soul.
  - ↳ **Courage** (Generic Token - Aura) — When you play an attack action card or activate a weapon attack, destroy this and the attack gets +1{p}.
- **Take Flight** (pitch 2, Light Warrior Action - Attack)  
  As an additional cost to play Take Flight, you may charge your hero's soul.  
  If you've charged this turn, Take Flight gains go again.
  - ⛔ unread: If you've charged this turn, this gains go again.
- **V of the Vanguard** (pitch 2, Light Warrior Action - Attack)  
  Boltyn Specialization  
  As an additional cost to play V of the Vanguard, you may charge your hero's soul any number of times.  
  Attacks on this combat chain gain +1{p} for each Light card charged this way.
  - ⛔ unread: Attacks on this combat chain gain +1{p} for each Light card charged this way.

## high tide  `high-tide`

*unreviewed* — 2+ blue cards in pitch zone rider (Gravy Bones)

Decks affected: Gravy Bones

- **Swiftwater Sloop** (pitch 1, Pirate Action - Attack)  
  High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again.
  - ⛔ unread: High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again.
- **Swiftwater Sloop** (pitch 3, Pirate Action - Attack)  
  High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again.
  - ⛔ unread: High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again.

## surge  `surge`

*unreviewed* — bonus when dealing more than printed arcane (Blaze)

Decks affected: Blaze

- **Aether Quickening** (pitch 3, Wizard Action)  
  Deal 2 arcane damage to target hero.  
  Surge - If this deals more than 2 damage, it gets go again.
  - ⛔ unread: Surge - If this deals more than 2 damage, it gets go again.

## One-off cards — 0 cards whose own text needs a reading

