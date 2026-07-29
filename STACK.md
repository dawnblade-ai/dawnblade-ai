# THE STACK — rulings Dawnblade is waiting on

Generated 2026-07-29T16:06:54.756Z from `tools/audit.json`.

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
| 2 | `arsenal-triggers` | unmodelled | 7 | 3 |
| 3 | `high-tide` | unreviewed | 2 | 1 |
| 4 | `surge` | unreviewed | 1 | 1 |

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

## arsenal triggers  `arsenal-triggers`

*unmodelled* — effects conditional on the arsenal

Decks affected: Azalea, Dorinthea, Arakni

- **Bull's Eye Bracers** (pitch 0, Ranger Equipment - Arms)  
  Action - Destroy Bull's Eye Bracers: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. It gains +1{p} until end of turn. Go again  
  Arcane Barrier 1
  - ⛔ unread: Action - Destroy this: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
- **Death Dealer** (pitch 0, Ranger Weapon - Bow (2H))  
  Once per Turn Action - {r}: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal. If you do, draw a card. Go again
  - ⛔ unread: Once per Turn Action - {r}: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
  - ⛔ unread: If you do, draw a card
- **Call in the Big Guns** (pitch 1, Ranger Action)  
  Your next arrow attack this turn gets +3{p}.  
  You may put an arrow from your hand face-up into your arsenal.  
  Go again
  - ⛔ unread: You may put an arrow from your hand face-up into your arsenal.
- **Entangling Shot** (pitch 1, Ranger Action - Arrow Attack)  
  When this is put face-up into your arsenal, you may {t} target hero.
  - ⛔ unread: When this is put face-up into your arsenal, you may {t} target hero.
- **Wreck Havoc** (pitch 1, Generic Action - Attack)  
  Defense reactions can't be played to this chain link.  
  When this hits a hero, you may turn a card in their arsenal face up, then destroy a defense reaction in their arsenal.
  - ⛔ unread: When this hits a hero, you may turn a card in their arsenal face up, then destroy a defense reaction in their arsenal.
- **Concoct Disorder** (pitch 1, Chaos Action - Attack)  
  When this attacks, each hero puts the top card of their deck face-down into their arsenal. If 2 or more cards are put into arsenals this way, this gets go again.
  - ⛔ unread: When this attacks, each hero puts the top card of their deck face-down into their arsenal
  - ⛔ unread: If 2 or more cards are put into arsenals this way, this gets go again.
- **Mark of the Funnel Web** (pitch 1, Assassin Action - Attack)  
  Stealth  
  When this hits a marked hero, banish a card in their arsenal.
  - ⛔ unread: When this hits a marked hero, banish a card in their arsenal.

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

