# The Sweep

Generated 2026-09-12 from `tools/audit.json`.
The card stack is empty — every pool card has a ruling. These are the
axes it never covered.

| area | entries | note |
|---|---|---|
| Hero abilities | 3 heroes, 3 unread clauses | never charged by the stack |
| Tokens | 2 | 1 barely named in the trainer |
| Ruled but not built | 13 cards | understood ≠ built |
| **Fail states** | 44 entries, 0 break a rule | how cards go *wrong* at the table |

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

### Frostbite — fx `part`, 7 mentions in the trainer (named in the trainer — verify it is carried, not just a refusal string)
> Cards and abilities cost you an additional {r} to play or activate.
When you play a card or activate an ability, destroy this.
At the beginning of your end phase, destroy this.

## 3. Ruled but not built

Cards whose ruling exists but which still do not resolve in full.

- **Ice Eternal** (part, 2/4 unread)
- **Plasma Barrel Shot** (part, 2/4 unread)
- **Silent Stilettos** (part, 2/3 unread)
- **Beckoning Haunt** (part, 1/2 unread)
- **Crown of Dichotomy** (part, 1/2 unread)
- **Flamecall Awakening** (part, 1/2 unread)
- **Jack Be Quick** (part, 1/3 unread)
- **Line Crossers** (part, 1/2 unread)
- **Roaring Beam** (part, 1/2 unread)
- **Topsy Turvy** (part, 1/2 unread)
- **V of the Vanguard** (part, 1/3 unread)
- **Walk in My Shoes** (part, 1/2 unread)
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
| Keyword filed as no-op — but the trainer names it (verify) | 28 |
| Choice never offered | 6 |
| No schedule to fire on | 5 |
| Earned value denied | 5 |
| Displayed total is wrong | 4 |
| Unread, effect unknown | 4 |
| Ability inert — cost not modelled | 4 |
| Keyword filed as no-op, but it has meaning | 1 |

### WRONG — 13 entries

- **Flamecall Awakening** (1) · tier `part` · fai
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
- **Ice Eternal** (3) · tier `part` · iyslander
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Then if this was fused, deal arcane damage to that hero equal to the number of Frostbites they control.
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Create X Frostbite tokens under target hero's control
- **Jack Be Quick** (1) · tier `part` · briar
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > When this hits a hero, {u} an ally they control, then steal it until the end of this action phase.
- **Plasma Barrel Shot** · tier `part` · dash
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > This card's {p} is equal to 1 plus the number of times you've boosted this combat chain.
- **Roaring Beam** (2) · tier `part` · boltyn
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > If there are no cards in your soul, return this to its owner's hand, then charge your soul.
- **Silent Stilettos** · tier `part` · enigma
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > If you do, destroy this and gain 1 action point.
- **Topsy Turvy** · tier `part` · arakni
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Instant - Destroy this: Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom.
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Instant - Destroy this: Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom.
- **Uphold Tradition** · tier `full` · enigma
  - *Keyword filed as no-op, but it has meaning* — The parser records "Cloaked" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it only 2 time(s). Your ruling describes real behaviour: CLOAKED - EQUIPPED FACE DOWN - SHOW CARD BACK ON THE PLAYERS BOARD INSTANT ABILITY - ALWAYS ACTIVE - COST 1 RESOURCE - POP UP - SHOW AURAS IN PLAY - SELECT 1 - ADD A +1 ATTACK POWER COUNTER TO IT
    > Cloaked
- **V of the Vanguard** (2) · tier `part` · boltyn
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Your attacks this combat chain get +1{p} for each Light card charged this way.
- **Briar** · tier `hero` · briar
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > Essence of Earth and Lightning
- **Enigma** · tier `hero` · enigma
  - *Displayed total is wrong* — This modifies power, defense or damage. Unread, the total shown to the player is arithmetically wrong — and they will trust it.
    > Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter.
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter.
- **Iyslander** · tier `hero` · iyslander
  - *Unread, effect unknown* — Part of this card resolves and part is unread, so the outcome is some unknown fraction of the printed card.
    > Essence of Ice
- **Walk in My Shoes** (2) · tier `part` · lyath
  - *No schedule to fire on* — A delayed or continuous effect (CR 6.3/6.4) with nowhere to live — it fires early, late, or never. This is the 'macro' register the rulings keep asking for.
    > Crush - When this deals 4 or more damage to a hero, until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up.
  - *Earned value denied* — This penalty lands on the OPPONENT, so skipping it denies the player a payoff and spares the opponent a cost.
    > Crush - When this deals 4 or more damage to a hero, until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up.

### LOST VALUE — 30 entries

- **Act of Glory** (1) · tier `full` · lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 11 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Aether Icevein** (1) · tier `full` · iyslander
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Aether Icevein** (2) · tier `full` · iyslander
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Aether Icevein** (3) · tier `full` · iyslander
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Arcane Seeds // Life** (1) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Meld" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: These are tricky - these are 2 cards with the same cost and same pitch but different effects. the 'meld' popup will allow the player to choose 1 or both sides of the card to player - the cost must be paid for each side c
    > Meld
- **Arcanic Shockwave** (1) · tier `full` · briar
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Lightning Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: similar to ice fusion - fusion pop up will show the cards in hand that have the 'lightning' talent in the players hand - they choose one and the opponent will get a pop up to see it - if they are able to do so the card h
    > Lightning Fusion
- **Barnacle** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Beckoning Haunt** · tier `part` · viserai
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
  - *Earned value denied* — The player earned this and does not get it. Visible and honest — they can see the card did nothing.
    > Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
- **Boom Grenade** (1) · tier `full` · dash
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Crank" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 3 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: crank - this takes place after it enters with a steam counter - the player should get a pop up if they want to 'crank' - if they do - remove the steam counter and give the player an action point. it is destroyed at start
    > Crank
- **Brain Freeze** (3) · tier `full` · iyslander
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Burn Up // Shock** (1) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Meld" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: These are tricky - these are 2 cards with the same cost and same pitch but different effects. the 'meld' popup will allow the player to choose 1 or both sides of the card to player - the cost must be paid for each side c
    > Meld
- **Crown of Dichotomy** · tier `part` · viserai, briar
  - *Ability inert — cost not modelled* — The cost cannot be charged, so the whole ability is deliberately inert (the v2.04 fix). Safe, but the player simply cannot use it — and the `pay` prompt variant now exists to build it.
    > Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade non-attack action card from your graveyard on top of your deck in any order.
  - *Choice never offered* — A decision that belongs to a player is never offered; the engine silently takes one branch.
    > Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade non-attack action card from your graveyard on top of your deck in any order.
- **Cutty Shark, Quick Clip** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Edge of Their Seats** (3) · tier `full` · bravo, lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 11 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Edge of Their Seats** (1) · tier `full` · lyath
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Suspense" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 11 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: just like the other 'counters' these are often represented by dice and 'tick' down at the beginning of the turn. unlike steam-powered it is destroyed immediately when it has none. The effect activates when the aura is de
    > Suspense
- **Enigma Chimera** (1) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Entwine Lightning** (1) · tier `full` · briar
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Lightning Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: similar to ice fusion - fusion pop up will show the cards in hand that have the 'lightning' talent in the players hand - they choose one and the opponent will get a pop up to see it - if they are able to do so the card h
    > Lightning Fusion
- **Limpit, Hop-a-long** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Oysten, Heart of Gold** (2) · tier `full`
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Phantasmal Haze** (3) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Polar Cap** (1) · tier `full` · iyslander
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Ice Fusion" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 0 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: to gain an extra effect on these cards you must reveal an ice card from your hand - if your opponent uses this effect you will get a popup with their card in it and you'll have to hit 'ok'
    > Ice Fusion
- **Riggermortis** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- **Spears of Surreality** (3) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Spectral Rider** (3) · tier `full` · enigma
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Phantasm" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 5 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: phantasm is a drawback for these above rate illusionist cards - if the opponent is able to block with a card that has 6+ power - the attack is destroyed and no further blocks are needed. update - check the attack power -
    > Phantasm
- **Swabbie** (2) · tier `full` · gravy
  - *Keyword filed as no-op — but the trainer names it (verify)* — The parser records "Watery Grave" as doing nothing, so this card reports as fully scripted from coverage alone. The trainer names it 14 times, so it is probably enforced by name (phantasm is: fxParse calls it a no-op and the trainer still pops the attack). Verify it is carried, not just mentioned.Your ruling describes real behaviour: Because gravy can often play allies from the grave - they must be turned face down when they die so they can not be used infinitely. allow the player to check their own faced down cards but not their opponents update - g
    > Watery Grave
- … and 5 more (see the station)

### INERT — 1 entries

- **Line Crossers** · tier `part` · lyath
  - *Unread, effect unknown* — Nothing on this card resolves. It is inert, and at least visibly so.
    > If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you.

