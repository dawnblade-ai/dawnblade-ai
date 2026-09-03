# The Sweep

Generated 2026-09-03 from `tools/audit.json`.
The card stack is empty — every pool card has a ruling. These are the
axes it never covered.

| area | entries | note |
|---|---|---|
| Hero abilities | 3 heroes, 3 unread clauses | never charged by the stack |
| Tokens | 4 | 3 barely named in the trainer |
| Ruled but not built | 34 cards | understood ≠ built |
| **Fail states** | 63 entries, 0 break a rule | how cards go *wrong* at the table |

## 1. Hero abilities

### Briar — 1/3 unread
- ❌ Essence of Earth and Lightning  _(the ability's printed NAME — a heading, not a rule)_
- ✅ The first time an attack action card you control deals damage to an opposing hero each turn, create an Embodiment of Earth token.
- ✅ The second time you play a non-attack action card each turn, create an Embodiment of Lightning token.

### Enigma — 1/2 unread
- ✅ Your first Spectral Shield attack each turn costs {r} less to activate.
- ❌ Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter.

### Iyslander — 1/3 unread
- ❌ Essence of Ice  _(the ability's printed NAME — a heading, not a rule)_
- ✅ If it's not your turn, you may play blue non-attack action cards from your arsenal as though they were instants.
- ✅ Whenever you play an Ice card during an opponent's turn, create a Frostbite token under their control.

## 2. Tokens

### Fealty — fx `none`, 0 mentions in the trainer — **likely a real gap**
> Instant - Destroy this: The next card you play this turn is Draconic.
At the beginning of your end phase, if you haven't created a Fealty token or played a Draconic card this turn, destroy this.

### Graphene Chelicera — fx `part`, 0 mentions in the trainer — **likely a real gap**
> Stealth
Once per Turn Action - {r}: Attack
When this attacks a marked hero, the attack gets go again.

### Inertia — fx `none`, 4 mentions in the trainer — **likely a real gap**
> At the beginning of your end phase, destroy this, then put all cards from your hand and arsenal on the bottom of your deck.

### Frostbite — fx `part`, 5 mentions in the trainer (named in the trainer — verify it is carried, not just a refusal string)
> Cards and abilities cost you an additional {r} to play or activate.
When you play a card or activate an ability, destroy this.
At the beginning of your end phase, destroy this.

## 3. Ruled but not built

Cards whose ruling exists but which still do not resolve in full.

- **Danger Digits** (none, 3/3 unread)
- **Glisten** (none, 2/2 unread)
- **Hope Merchant's Hood** (none, 1/1 unread)
- **Beaten Trackers** (part, 2/3 unread)
- **Boom Grenade** (part, 2/4 unread)
- **Halo of Illumination** (part, 2/3 unread)
- **Ice Eternal** (part, 2/4 unread)
- **Mounting Anger** (part, 2/3 unread)
- **Plasma Barrel Shot** (part, 2/4 unread)
- **Refraction Bolters** (part, 2/3 unread)
- **Rising Resentment** (part, 2/3 unread)
- **Silent Stilettos** (part, 2/3 unread)
- **Beckoning Haunt** (part, 1/2 unread)
- **Carrion Crown** (part, 1/3 unread)
- **Compass of Sunken Depths** (part, 1/2 unread)
- **Crown of Dichotomy** (part, 1/2 unread)
- **Drill Shot** (part, 1/2 unread)
- **Flamecall Awakening** (part, 1/2 unread)
- **Jack Be Quick** (part, 1/3 unread)
- **Line Crossers** (part, 1/2 unread)
- **Loot the Arsenal** (part, 1/2 unread)
- **Loot the Hold** (part, 1/2 unread)
- **Mark of the Funnel Web** (part, 1/2 unread)
- **Oasis Respite** (part, 1/2 unread)
- **Orb-Weaver Spinneret** (part, 1/3 unread)
- **Roaring Beam** (part, 1/2 unread)
- **Spectral Rider** (part, 1/2 unread)
- **Stains of the Redback** (part, 1/2 unread)
- **Topsy Turvy** (part, 1/2 unread)
- **V of the Vanguard** (part, 1/3 unread)
- **Walk in My Shoes** (part, 1/2 unread)
- **Waning Vengeance** (part, 1/2 unread)
- **Weave Lightning** (part, 1/3 unread)
- **Wreck Havoc** (part, 1/2 unread)

## 4. Fail states — how cards go WRONG at the table

Sections 1–3 measure *coverage* (how much text is unread). This one asks
the judge's question: if this card is played tonight, what happens that
should not? Ranked by damage to a game judged at pro-tour standards —
a different order from "most unread text".

**Every verdict here is inferred from clause text by pattern, not from
playing the card.** Each entry names the clause that triggered it so it
can be overruled. Same discipline as the mention count.

| category | entries |
|---|---|
| Keyword filed as no-op — but the trainer names it (verify) | 17 |
| Ability inert — cost not modelled | 16 |
| Earned value denied | 14 |
| No schedule to fire on | 13 |
| Keyword filed as no-op, but it has meaning | 11 |
| Choice never offered | 11 |
| Unread, effect unknown | 8 |
| Displayed total is wrong | 7 |

### WRONG — 35 entries

- **Aether Icevein** (1) · tier `full` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Aether Icevein** (2) · tier `full` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Aether Icevein** (3) · tier `full` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Arcane Seeds // Life** (1) · tier `full`
  - *Keyword filed as no-op, but it has meaning* — The parser records "Meld" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it only 12 time(s). Your ruling describes real behaviour: These are tricky - these are 2 cards with the same cost and same pitch but different effects. the 'meld' popup will allow the player to choose 1 or both sides of the card to player - the cost must be paid for each side c
    > Meld
- **Arcanic Shockwave** (1) · tier `full` · briar
  - *Keyword filed as no-op, but it has meaning* — The parser records "Lightning Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it only 5 time(s). Your ruling describes real behaviour: similar to ice fusion - fusion pop up will show the cards in hand that have the 'lightning' talent in the players hand - they choose one and the opponent will get a pop up to see it - if they are able to do so the card h
    > Lightning Fusion
- **Beaten Trackers** · tier `part` · kayo
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Whenever you discard a random card with 6 or more {p}, you may destroy this
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Whenever you discard a random card with 6 or more {p}, you may destroy this
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Whenever you discard a random card with 6 or more {p}, you may destroy this
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > If you do, gain 1 action point.
- **Boom Grenade** (1) · tier `part` · dash
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > At the start of your turn, destroy this unless you remove a steam counter from it.
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > At the start of your turn, destroy this unless you remove a steam counter from it.
- **Brain Freeze** (3) · tier `full` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Burn Up // Shock** (1) · tier `full`
  - *Keyword filed as no-op, but it has meaning* — The parser records "Meld" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it only 12 time(s). Your ruling describes real behaviour: These are tricky - these are 2 cards with the same cost and same pitch but different effects. the 'meld' popup will allow the player to choose 1 or both sides of the card to player - the cost must be paid for each side c
    > Meld
- **Danger Digits** · tier `none` · arakni
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
- **Drill Shot** (1) · tier `part` · azalea
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > If this has an aim counter, it gets piercing 1.
- **Entwine Lightning** (1) · tier `full` · briar
  - *Keyword filed as no-op, but it has meaning* — The parser records "Lightning Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it only 5 time(s). Your ruling describes real behaviour: similar to ice fusion - fusion pop up will show the cards in hand that have the 'lightning' talent in the players hand - they choose one and the opponent will get a pop up to see it - if they are able to do so the card h
    > Lightning Fusion
- **Flamecall Awakening** (1) · tier `part` · fai
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
- **Glisten** (1) · tier `none` · boltyn
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Distribute up to four +1{p} counters among any number of weapons you control.
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > At the beginning of your end phase, remove all +1{p} counters from weapons you control.
- **Ice Eternal** (3) · tier `part` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Then if this was fused, deal arcane damage to that hero equal to the number of Frostbites they control.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Create X Frostbite tokens under target hero's control
- **Jack Be Quick** (1) · tier `part` · briar
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > When this hits a hero, {u} an ally they control, then steal it until the end of this action phase.
- **Loot the Arsenal** (3) · tier `part` · gravy
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Your next Pirate ally attack this turn gets "When this hits a hero, destroy a card in their arsenal. If you do, create a Gold token."
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Your next Pirate ally attack this turn gets "When this hits a hero, destroy a card in their arsenal. If you do, create a Gold token."
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Your next Pirate ally attack this turn gets "When this hits a hero, destroy a card in their arsenal. If you do, create a Gold token."
- **Loot the Hold** (3) · tier `part` · gravy
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Your next Pirate ally attack this turn gets "When this hits a hero, they discard a card. If they do, create a Gold token."
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Your next Pirate ally attack this turn gets "When this hits a hero, they discard a card. If they do, create a Gold token."
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Your next Pirate ally attack this turn gets "When this hits a hero, they discard a card. If they do, create a Gold token."
- **Mounting Anger** (1) · tier `part` · fai
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > If you do, it gets +1{p} and you may play it this turn.
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > If you do, it gets +1{p} and you may play it this turn.
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- **Oasis Respite** (1) · tier `part` · dorinthea, enigma, lyath
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > If they have less {h} than each other hero, they may gain 1{h}.
- **Orb-Weaver Spinneret** (1) · tier `part`
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > Equip a Graphene Chelicera token.
- **Plasma Barrel Shot** · tier `part` · dash
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > This card's {p} is equal to 1 plus the number of times you've boosted this combat chain.
- **Polar Cap** (1) · tier `full` · iyslander
  - *Keyword filed as no-op, but it has meaning* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer never names it, so it is almost certainly absent. Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Rising Resentment** (1) · tier `part` · fai
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > If you do, it costs {r} less to play and you may play it this turn.
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- **Roaring Beam** (2) · tier `part` · boltyn
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > If there are no cards in your soul, return this to its owner's hand, then charge your soul.
- … and 10 more (see the station)

### LOST VALUE — 27 entries

- **Act of Glory** (1) · tier `full` · lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 4 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Barnacle** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Beckoning Haunt** · tier `part` · viserai
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
- **Carrion Crown** · tier `part` · gravy
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Action - Discard an ally, destroy this: Draw a card
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Action - Discard an ally, destroy this: Draw a card
- **Compass of Sunken Depths** · tier `part` · gravy
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > The first card with watery grave you play from your graveyard each turn gets go again.
- **Crown of Dichotomy** · tier `part` · viserai, briar
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade non-attack action card from your graveyard on top of your deck in any order.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade non-attack action card from your graveyard on top of your deck in any order.
- **Cutty Shark, Quick Clip** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Edge of Their Seats** (3) · tier `full` · bravo, lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 4 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Edge of Their Seats** (1) · tier `full` · lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 4 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Enigma Chimera** (1) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Halo of Illumination** · tier `part` · boltyn
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Instant - {r}, destroy this: Put a card from your hand into your soul
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Instant - {r}, destroy this: Put a card from your hand into your soul
- **Hope Merchant's Hood** · tier `none`
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Instant - Destroy this: Shuffle any number of cards from your hand into your deck, then draw that many cards.
- **Limpit, Hop-a-long** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Mark of the Funnel Web** (1) · tier `part` · arakni
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > When this hits a marked hero, banish a card in their arsenal.
- **Oysten, Heart of Gold** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Phantasmal Haze** (3) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Refraction Bolters** · tier `part` · dorinthea
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > When a weapon attack you control hits, you may destroy this
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > When a weapon attack you control hits, you may destroy this
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > If you do, the attack gets go again.
- **Riggermortis** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Spears of Surreality** (3) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Spectral Rider** (3) · tier `part` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Swabbie** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Tension in the Air** (1) · tier `full` · lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 4 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **The Suspense is Killing Me** (3) · tier `full` · bravo, lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 4 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Thunder Quake** (3) · tier `full` · bravo
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Heave 3" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Heave 3 is active when thunder quake is in your hand at the end of turn - instead of putting it into your arsenal as normal, the player will get a popup and have the option to pay 3 resources - if they do - add 3 seismic
    > Heave 3
- **Weave Lightning** (1) · tier `part` · briar
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > If it's fused, it gets go again.
- … and 2 more (see the station)

### INERT — 1 entries

- **Line Crossers** · tier `part` · lyath
  - *Unread, effect unknown* — Nothing on this card resolves. It is inert, and at least visibly so.
    > If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you.

