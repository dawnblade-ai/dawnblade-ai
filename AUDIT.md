# DAWNBLADE POOL AUDIT

Generated 2026-07-28T19:04:43.790Z · app v2.30 · data sage-v9 · db 4862 records

## Summary

| | count |
|---|---|
| Unique cards in pool (name\|pitch) | 405 |
| Fully scripted | 263 |
| Partially scripted | 109 |
| Text-only (nothing parsed) | 33 |
| Cards with audit flags | 69 |

## Symbols found in pool text

| symbol | ledger status | cards using it |
|---|---|---|
| `{d}` | live — defense — defBuff ops | 22 |
| `{h}` | live — life | 14 |
| `{i}` | display — intellect — stat display only, no parsed ops use it | 1 |
| `{p}` | live — power / pitch pips — pump parser reads +N{p} and the +1/2/3{p} shorthand | 126 |
| `{r}` | live — resource — costs and gains | 53 |
| `{t}` | pending — TAP cost symbol. AUDIT FINDING 2026-07-22: no pool text spells the word 'tap', so the trainer's /\btap\b/ rotation checks never fire — tap detection must key on {t}; parser does not enforce tap costs | 13 |
| `{u}` | pending — UNTAP — seen on Jack Be Quick, Scuttle Toes; not parsed | 2 |
| `{x}` | display — variable X cost (Beckoning Haunt) — no parsed ops | 1 |

## Printed keywords in pool

| keyword | ledger status | cards |
|---|---|---|
| arcane barrier | inert-dummy — prevents arcane damage — the dummy deals only physical | Achilles Accelerator, Aetherstorm Wellingtons, Arcane Lantern, Bull's Eye Bracers, Crown of Dichotomy, Double Cross Strap, Enclosed Firemind, Mask of the Swarming Claw, Nullrune Boots, Nullrune Gloves, Nullrune Hood, Nullrune Robe, Runebleed Robe, Scuttle Toes, Silent Stilettos, Spellfire Cloak, Stalker's Steps, Topsy Turvy |
| battleworn | live — -1 counter per block, survives at 0 | Beaten Trackers, Blood Scent, Bolt'n Boots, Pouncing Paws, Prey Spotters, Refraction Bolters, Tearing Shuko |
| blade break | live — equipment destroyed after blocking | Carrion Crown, Flat Trackers, Ironrot Gauntlet, Ironrot Helm, Ironrot Legs, Ironrot Plate, Line Crossers, Stand Strong, Washed Up Wave |
| boost | live — per-attack prompt; banish top, Mechanologist grants go again | Big Bertha, Crankshaft, Fender Bender, Jump Start, Out Pace, Rev Up, Teklo Trebuchet 2000, Throttle, Under Loop, Zero to Sixty, Zipper Hit |
| charge | pending — RULED 2026-07-25 (spec in tools/rulings.json) — Boltyn's soul engine | Beaming Bravado, Bolt of Courage, Engulfing Light, Light the Way, Roaring Beam, Take Flight, V of the Vanguard |
| clash | live — RULED 2026-07-25: both sides reveal for real, greatest POWER wins, a tie is no winner. Fires when the card DEFENDS, which is how every clash card is printed | Clash of Agility, Clash of Might, Clash of Vigor, Stonewall Impasse, Test of Might, Test of Strength |
| cloaked | unreviewed — Arakni package | Uphold Tradition |
| crank | pending — RULED 2026-07-25: the item enters with a steam counter; crank prompts to spend it for an action point. Needs the prompt sheet | Boom Grenade |
| crush | partial — 4+ threshold checked at resolve; hand payload live from v2.05, arsenal/next-turn payloads still inert | Boulder Drop, Buckling Blow, Cartilage Crush, Chokeslam, Crush the Weak, Debilitate, Disable, Fault Line, Flatten the Field, Short Shrift, Walk in My Shoes, Wee Wrecking Ball |
| dominate | live — v2.05: the dummy holds cards, so this really does hold it to one blocker from hand | Macho Grande, Pulping |
| go again | live — printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule) | Aether Quickening, Arcane Seeds // Life, Avast Ye!, Blaze Headlong, Bolt'n' Shot, Booze!, Brand with Cinderclaw, Buckwild, Burn Up // Shock, Call in the Big Guns, Cinderskin Devotion, Cold Snap, Concoct Disorder, Condemn to Slaughter, Display Loyalty, Drop the Anchor, Duty Bound Blitz, Edict of Steel, Enflame the Firebrand, Entwine Lightning, Fire Tenet: Strike First, Fire that Burns Within, Flamecall Awakening, Fluid Motion, Flying High, Fry, Goblet of Bloodrun Wine, Golden Tipple, Hit and Run, Hot on Their Heels, Hyper Inflation, Jack Be Quick, Jittery Bones, Lace with Bloodrot, Lace with Frailty, Lace with Inertia, Lead with Speed, Light the Way, Lightning Surge, Loot the Arsenal, Loot the Hold, Malefic Incantation, Mauvrion Skies, Mounting Anger, Murderous Rabble, Nimblism, Orb-Weaver Spinneret, Path of Same Ends, Phoenix Flame, Pick Up the Point, Portside Exchange, Prime the Crowd, Pulping, Ravenous Rabble, Re-Charge!, Read the Glide Path, Release the Tension, Rise from the Ashes, Rising Resentment, Ronin Renegade, Rune Flash, Runerager Swarm, Sadistic Scowl, Saltwater Swell, Scar for a Scar, Scout the Periphery, Second Strike, Second Tenet of Chi: Wind, Sharpen Steel, Sigil of Silphidae, Sizzle, Spears of Surreality, Spectral Manifestations, Sprout Strength, Star Fall, Swift Shot, Take Aim, Trot Along, Up Sticks and Run, Villainous Pose, Warrior's Valor, Weave Lightning, Whisper of the Oracle, Wild Ride, Winter's Bite, Yo Ho Ho!, Zealous Belting |
| guardwell | live — defense drops to 0 at chain close | Beckoning Haunt, Blade Beckoner Boots, Blade Beckoner Gauntlets, Blade Beckoner Helm, Blade Beckoner Plating, Magmatic Carapace, Predatory Plating |
| heave | unreviewed — seen on Thunder Quake (Guardian) | Thunder Quake |
| high tide | unreviewed — 2+ blue cards in pitch zone rider (Gravy Bones) | Battalion Barque, Swiftwater Sloop |
| ice fusion | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — Iyslander — fusion cost rider | Aether Icevein, Brain Freeze, Ice Eternal, Polar Cap |
| intimidate | live — v2.05: banishes a card from the dummy's hand face-down on attack — a real cost now | Sadistic Scowl, Smash Instinct |
| legendary | info — deckbuilding limit: 1 copy | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| lightning flow | unreviewed — Briar | Static Shock |
| lightning fusion | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — Briar — fusion cost rider | Arcanic Shockwave, Entwine Lightning |
| mark | live — RULED 2026-07-25: qualifier only; the marked state now rides on g.dMarked | Hot on Their Heels, Lair of the Spider, Mark of the Huntsman, Mark the Prey |
| meld | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — split-effect cards (Arcane Seeds // Life, Briar) | Arcane Seeds // Life, Burn Up // Shock |
| opt | partial — RULED 2026-07-25: top N, any order, top or bottom. Auto-sorted by advisor value; the choose-and-order popup is still pending | Aether Spindle, Cindering Foresight, Read the Glide Path, Ridge Rider Shot, Whisper of the Oracle |
| overpower | unreviewed — defense restriction; needs CR wording | Spectral Rider |
| phantasm | live — RULED 2026-07-25: a drawback — one blocker with 6+ printed POWER pops the attack; destroyed, so no go again and no action-point refund | Enigma Chimera, Phantasmal Haze, Spears of Surreality, Spectral Rider |
| piercing | unreviewed — seen in pool; needs CR wording | Drill Shot |
| quickstrike | unreviewed — seen on Rush of Power | Rush of Power |
| reload | pending — RULED 2026-07-25 (spec in tools/rulings.json) — roadmap #4 — Azalea | Bolt'n' Shot, Take Aim |
| reprise | live — RULED 2026-07-25: live since the dummy blocks from hand — counts the non-equipment defenders declared this chain link | Ironsong Response, Out for Blood, Overpower, Stroke of Foresight |
| retrieve | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — seen in pool; hero package TBD | Pick Up the Point, Up Sticks and Run |
| rupture | unreviewed — seen in pool; hero package TBD | Lava Burst |
| sharpen | unreviewed — seen in pool; hero package TBD | Edict of Steel |
| solflare | unreviewed — Boltyn package | Banneret of Salvation |
| specialization | info — hero-locked card (normalized from '<Hero> Specialization') | Crow's Nest, Ice Eternal, Knucklehead, V of the Vanguard |
| spellvoid | inert-dummy — destroy this to prevent N arcane — the dummy deals only physical | Halo of Illumination, Mask of the Swarming Claw |
| steal | unreviewed — Arakni package | Jack Be Quick |
| stealth | live — RULED 2026-07-25: does nothing alone — a qualifier other cards test for | Art of Desire: Body, Art of Desire: Mind, Infect, Mark of the Black Widow, Mark of the Funnel Web, Mark the Prey, Reaper's Call |
| surge | unreviewed — bonus when dealing more than printed arcane (Blaze) | Aether Quickening, Open the Flood Gates |
| suspense | pending — RULED 2026-07-25: enters with 2 counters (same on every suspense card), ticks at start of turn, destroyed at 0 and the payload fires then — not built yet | Act of Glory, Edge of Their Seats, Tension in the Air, The Suspense is Killing Me |
| temper | live — -1 per block, destroyed at 0 | Basalt Boots, Gauntlets of Unity, Helm of Unity, Knucklehead, Mournful Casket, Steelbraid Buckler, Stonewall Impasse |
| the crowd boos | live — RULED 2026-07-25: leaves a per-turn booed state; the boo itself does nothing and Reviled is a static talent | Booze!, Concealed Object, Goon Beatdown, Mocking Blow, Prime the Crowd, Villainous Pose |
| the crowd cheers | info — RULED 2026-07-25: Revered is a static talent — nothing to resolve | Prime the Crowd |
| transcend | live — RULED 2026-07-25: the card flips to Inner Chi and returns to hand instead of the graveyard | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| unity | unreviewed — Boltyn package | Gauntlets of Unity, Helm of Unity |
| ward | live — soaks incoming; arcane ward tracked separately (awd) | Uphold Tradition, Waning Vengeance, Waxing Specter |
| watery grave | live — RULED 2026-07-25: Gravy Bones' ability — playable from the graveyard once a blue card has hit it this turn | Barnacle, Cutty Shark, Quick Clip, Limpit, Hop-a-long, Oysten, Heart of Gold, Riggermortis, Swabbie |

## Granted keywords in pool (conditional grants — never merged with printed)

| keyword | ledger status | cards |
|---|---|---|
| freeze | unreviewed | Cold Snap |
| go again | live | Avast Ye!, Bolt'n Boots, Compass of Sunken Depths, Cosmo, Scroll of Ancestral Tapestry, Flying High, Hit and Run, Mage Master Boots, Mauvrion Skies, Refraction Bolters, Run Through, Stains of the Redback, Stalker's Steps, Trot Along, Warrior's Valor, Weave Lightning |
| mark | live | Den of the Spider, Scar Tissue, Two Sides to the Blade |
| piercing | unreviewed | Puncture |

## Heroes

### Kayo (Brute)
- ⚠ unrecognized: "You have 1 weapon zone."
- ⚠ unrecognized: "Attack action cards you own get +1{p} while they are in any zone other than the combat chain."
- ⚠ unrecognized: "The first time you discard a card with 6 or more {p} during each of your action phases, create a Might token."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Iyslander (Elemental Wizard)
- static: Iyslander — blue non-attacks from arsenal at instant speed
- static: Iyslander — Ice on opponent's turn → Frostbite
- ⚠ unrecognized: "Essence of Ice"
- 🚩 1 hero-text clause(s) not recognized by any ability reader

### Viserai (Runeblade)
- static: Viserai — Runeblade after a non-attack → Runechant

### Dash (Mechanologist)
- static: Dash — pregame item (auto-picked; pick UI pending)

### Bravo, Flattering Showman (Guardian)
- ⚠ unrecognized: "Action - {r}{r}, {t}: Turn a face-down card in your arsenal face-up"
- ⚠ unrecognized: "If it has crush, it gets +2{p} and dominate this turn"
- ⚠ unrecognized: "Go again"
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Azalea (Ranger)
- ⚠ unrecognized: "Once per Turn Action - 0: Put a card from your arsenal on the bottom of your deck"
- ⚠ unrecognized: "If you do, put the top card of your deck face up into your arsenal"
- ⚠ unrecognized: "If it's an arrow card, it gains dominate until end of turn"
- ⚠ unrecognized: "Go again"
- 🚩 4 hero-text clause(s) not recognized by any ability reader

### Dorinthea (Warrior)
- ⚠ unrecognized: "Once per turn Effect - When a weapon you control hits, you may attack an additional time with that weapon this turn."
- 🚩 1 hero-text clause(s) not recognized by any ability reader

### Fai (Draconic Ninja)
- ⚠ unrecognized: "You may start the game with a Phoenix Flame in your graveyard."
- ⚠ unrecognized: "Once per Turn Instant - {r}{r}{r}: Return a Phoenix Flame from your graveyard to your hand"
- ⚠ unrecognized: "This ability costs {r} less for each Draconic chain link you control."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Enigma (Mystic Illusionist)
- ⚠ unrecognized: "Your first Spectral Shield attack each turn costs {r} less to activate."
- ⚠ unrecognized: "Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Arakni, Web of Deceit (Chaos Assassin)
- ⚠ unrecognized: "Your attacks with stealth that are attacking a marked hero get +1{p} and "When this hits, this gets go again.""
- ⚠ unrecognized: "At the beginning of your end phase, if an opponent is marked, you become a random Agent of Chaos."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Blaze, Firemind (Wizard)
- ⚠ unrecognized: "Whenever you opt, put energy counters on Blaze equal to the number of cards looked at this way."
- ⚠ unrecognized: "Once per Turn Instant - Remove X energy counters from Blaze: Banish a Wizard non-attack action card from your hand with an effect that deals arcane damage equal to X"
- ⚠ unrecognized: "You may play it this turn as though it were an instant."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Boltyn (Light Warrior)
- ⚠ unrecognized: "If you've charged this turn, your attacks get +1{p} while defended by an attack action card."
- ⚠ unrecognized: "Attack Reaction - Banish a card from Boltyn's soul: Target attack with {p} greater than its base {p} gains go again."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Briar (Elemental Runeblade)
- ⚠ unrecognized: "Essence of Earth and Lightning"
- ⚠ unrecognized: "The first time an attack action card you control deals damage to an opposing hero, create an Embodiment of Earth token."
- ⚠ unrecognized: "Whenever you play your second 'non-attack' action card each turn, create an Embodiment of Lightning token."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Gravy Bones (Pirate Necromancer)
- ⚠ unrecognized: "Instant - {t}, destroy a Gold you control: Draw a card, then discard a card."
- ⚠ unrecognized: "If a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Lyath Goldmane (Reviled Guardian)
- hero power: The crowd boos you [2r]
- ⚠ unrecognized: "The base {p} and {d} of cards you control are halved, rounded up."
- ⚠ unrecognized: "Defending action cards you control get +1{d} this turn."
- ⚠ unrecognized: "Whenever the crowd boos you, create a Might token."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

## Tokens

- Agility: in database — “At the start of your turn, destroy this, then your next attack this turn gets go again.”
- Bloodrot Pox: in database — “At the beginning of your end phase, destroy Bloodrot Pox, then it deals 2 damage to you unless you pay {r}{r}{r}.”
- Confidence: in database — “At the start of your turn, destroy this, then the next attack card you play this turn can't be defended by more than 2 non-block cards.”
- Courage: in database — “When you play an attack action card or activate a weapon attack, destroy this and the attack gets +1{p}.”
- Fealty: in database — “Instant - Destroy this: The next card you play this turn is Draconic. At the beginning of your end phase, if you haven't created a Fealty token or played a Dragonic card this turn, destroy this.”
- Flurry: in database — “When you activate a weapon attack, destroy this and you may attack with the weapon twice this turn.”
- Frailty: in database — “Your attack action cards played from arsenal and weapon attacks have -1{p}.
At the beginning of your end phase destroy Frailty.”
- Frostbite: in database — “Cards and abilities cost you an additional {r} to play or activate.
At the beginning of your end phase or when you play a card or activate an ability, destroy Frostbite.”
- Gold: in database — “Action - {r}{r}, destroy this: Draw a card. Go again”
- Graphene Chelicera: in database — “Stealth
Once per Turn Action - {r}: Attack
When this attacks a marked hero, the attack gets go again.”
- Inertia: in database — “At the beginning of your end phase, destroy Inertia, then put all cards from your hand and arsenal on the bottom of your deck.”
- Might: in database — “At the start of your turn, destroy this, then your next attack this turn gets +1{p}.”
- Ponder: in database — “At the beginning of your end phase, destroy Ponder and draw a card.”
- Runechant: in database — “When you play an attack action card or activate a weapon attack, destroy this and deal 1 arcane damage to target opposing hero.”
- Seismic Surge: in database — “At the beginning of your action phase, destroy this, then the next Guardian attack action card you play this turn costs {r} less to play.”
- Spectral Shield: in database — “Ward 1”
- Vigor: in database — “At the start of your turn, destroy this, then gain {r}.”

## Coverage gaps — every unparsed clause, verbatim

The fix for any of these is always to teach `classifyClause`/`fxParse`, never to special-case the card.

### Act of Glory (pitch 1) — part · [lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense
- ▶ When this leaves the arena, your next attack this turn gets +6{p}.

### Aether Icevein (pitch 1) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion
- ▶ Deal 5 arcane damage to any target
- — If this was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Aether Icevein (pitch 2) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion
- ▶ Deal 4 arcane damage to any target
- — If this was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Aether Icevein (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion
- ▶ Deal 3 arcane damage to any target
- — If this was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Agile Engagement (pitch 1) — part · [dorinthea]
- type: Warrior Attack Reaction
- ▶ Target Warrior attack gets +3{p}
- — If it's defended by an attack action card, create an Agility token.

### Agile Windup (pitch 3) — none · [kayo]
- type: Brute / Warrior Action - Attack
- — Instant - Discard this: Create an Agility token.

### Arcane Polarity (pitch 1) — part · [fai, blaze, briar]
- type: Generic Instant
- ▶ Gain 1{h}
- — If you've been dealt arcane damage this turn, instead gain 4{h}.

### Arcane Seeds // Life (pitch 1) — part · [briar]
- type: Runeblade Action // Earth Instant · printed: Meld, Go again
- — Meld
- ▶ Create a Runechant token
- ▶ Create a Runechant token.
- ▶ Go again
- — //
- ▶ Gain 1{h}
- 🚩 unreviewed keyword: "meld"

### Arcane Twining (pitch 3) — part · [iyslander, blaze]
- type: Wizard Action
- ▶ Deal 1 arcane damage to any target.
- — Instant - Discard this: Amp 1

### Arcanic Shockwave (pitch 1) — none · [briar]
- type: Elemental Runeblade Action - Attack · printed: Lightning Fusion
- — Lightning Fusion
- — When you attack with this, if it was fused, deal 1 arcane damage to target hero.
- 🚩 unreviewed keyword: "lightning fusion"

### Astral Etchings (pitch 1) — none · [enigma]
- type: Illusionist Action
- — Put three +1{p} counters on target aura with ward you control.
- — If you control a Spectral Shield, you may play this as though it were an instant.

### Back Alley Breakline (pitch 3) — none · [gravy]
- type: Generic Action - Attack
- — If an activated ability or action card effect puts this face up into a zone from your deck, gain 1 action point.

### Beaming Bravado (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If a yellow card is charged this way, this gets +1{p}

### Beaming Bravado (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If a yellow card is charged this way, this gets +1{p}

### Beaten Trackers (pitch 0) — part · [kayo]
- type: Brute Equipment - Legs · printed: Battleworn
- — Whenever you discard a random card with 6 or more {p}, you may destroy this
- — If you do, gain 1 action point.
- ○ Battleworn

### Beckoning Haunt (pitch 0) — part · [viserai]
- type: Runeblade Equipment - Arms · printed: Guardwell
- — Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
- ○ Guardwell

### Big Bertha (pitch 3) — part · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- ○ Boost
- — When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Bolt'n Boots (pitch 0) — part · [azalea]
- type: Ranger Equipment - Legs · printed: Battleworn · granted: Go again
- — Attack Reaction - {r}, destroy this: Target arrow attack with {p} greater than its base gets go again.
- ○ Battleworn
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Bolt'n' Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Go again, Reload
- — If this's {p} is greater than its base {p}, it has go again and "If this hits, reload."
- 🚩 text mentions go again but no clause parses it

### Bolt of Courage (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains "If this hits, draw a card."

### Bolt of Courage (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains "If this hits, draw a card."

### Boom Grenade (pitch 1) — part · [dash]
- type: Mechanologist Action - Item · printed: Crank
- — Crank
- ▶ This enters the arena with a steam counter
- — At the start of your turn, destroy this unless you remove a steam counter from it.
- ▶ When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them.

### Brain Freeze (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion
- ▶ Target opponent reveals their hand
- — If this was fused, put an action card with cost 0 from their hand on top of their deck.
- 🚩 unreviewed keyword: "ice fusion"

### Brothers in Arms (pitch 3) — none · [iyslander, lyath]
- type: Generic Action - Attack
- — When this defends, you may pay {r}
- — If you do, it gets +2{d}.

### Bull's Eye Bracers (pitch 0) — part · [azalea]
- type: Ranger Equipment - Arms · printed: Arcane Barrier 1
- — Action - Destroy this: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
- ▶ It gains +1{p} until end of turn
- ▶ Go again
- ○ Arcane Barrier 1

### Burn Up // Shock (pitch 1) — part · [briar]
- type: Runeblade Action // Lightning Instant · printed: Go again, Meld
- — Meld
- ▶ The next time an attack you control hits a hero this turn, deal 4 arcane damage to them.
- ▶ Go again
- — //
- ▶ Deal 1 arcane damage to any target.
- 🚩 unreviewed keyword: "meld"

### Call in the Big Guns (pitch 1) — part · [azalea]
- type: Ranger Action · printed: Go again
- ▶ Your next arrow attack this turn gets +3{p}.
- — You may put an arrow from your hand face-up into your arsenal.
- ▶ Go again

### Carrion Crown (pitch 0) — part · [gravy]
- type: Necromancer Equipment - Head · printed: Blade Break
- — Action - Discard an ally, destroy this: Draw a card
- ▶ Go again
- ○ Blade Break

### Cindering Foresight (pitch 1) — part · [blaze]
- type: Wizard Action · printed: Opt 3
- — If it's not your turn, you may play this as though it were an instant.
- ▶ The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1.
- ▶ Opt 3

### Cindering Foresight (pitch 2) — part · [blaze]
- type: Wizard Action · printed: Opt 2
- — If it's not your turn, you may play this as though it were an instant.
- ▶ The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1.
- ▶ Opt 2

### Cindering Foresight (pitch 3) — part · [blaze]
- type: Wizard Action · printed: Opt 1
- — If it's not your turn, you may play this as though it were an instant.
- ▶ The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1.
- ▶ Opt 1

### Cold Snap (pitch 3) — part · [iyslander]
- type: Ice Action · printed: Go again · granted: Freeze
- — Target hero may pay {r}
- — If they don't, freeze a card in their arsenal or an ally they control until the start of your next turn.
- ▶ If this is played from arsenal, draw a card.
- ▶ Go again
- 🚩 unreviewed keyword: "freeze"

### Compass of Sunken Depths (pitch 0) — part · [gravy]
- type: Pirate Necromancer Equipment - Off-Hand · granted: Go again
- ○ Instant - {t}: Look at the top card of your deck.
- — The first card with watery grave you play from your graveyard each turn gets go again.
- 🚩 tap cost {t} — not enforced (see ledger)
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Concoct Disorder (pitch 1) — none · [arakni]
- type: Chaos Action - Attack · printed: Go again
- — When this attacks, each hero puts the top card of their deck face-down into their arsenal
- — If 2 or more cards are put into arsenals this way, this gets go again.
- 🚩 text mentions go again but no clause parses it

### Condemn to Slaughter (pitch 1) — part · [viserai]
- type: Runeblade Action · printed: Go again
- ▶ Your next Runeblade attack this turn gets +3{p}.
- — You may destroy an aura you control
- — If you do, each opponent destroys an aura permanent they control.
- ▶ Go again

### Condemn to Slaughter (pitch 3) — part · [viserai]
- type: Runeblade Action · printed: Go again
- ▶ Your next Runeblade attack this turn gets +1{p}.
- — You may destroy an aura you control
- — If you do, each opponent destroys an aura permanent they control.
- ▶ Go again

### Cosmo, Scroll of Ancestral Tapestry (pitch 0) — none · [enigma]
- type: Illusionist Weapon - Scroll (2H) · granted: Go again
- — During your turn, auras you control with ward are weapons with base {p} equal to their ward and Once per Turn Action - {r}: Attack
- — Your aura attacks with one or more +1{p} counters get go again.
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Courageous Steelhand (pitch 1) — none · [boltyn]
- type: Light Warrior Attack Reaction
- — If you've charged this turn, target attack gains +3{p}.

### Crankshaft (pitch 1) — part · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- ○ Boost
- — When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Crankshaft (pitch 3) — part · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- ○ Boost
- — When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Crash and Bash (pitch 1) — none · [bravo]
- type: Guardian Block
- — When this defends, you may reveal a card with crush from your hand
- — If you do, create a Seismic Surge token.

### Crow's Nest (pitch 0) — part · [azalea]
- type: Ranger Equipment - Quiver · printed: Azalea Specialization
- ○ Azalea Specialization
- — Whenever an arrow is put face up into your arsenal from your deck, you may pay {r}
- — If you do, put an aim counter on it.

### Crown of Dichotomy (pitch 0) — part · [viserai, briar]
- type: Runeblade Equipment - Head · printed: Arcane Barrier 1
- — Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade 'non-attack' action card from your graveyard on top of your deck in any order.
- ○ Arcane Barrier 1

### Danger Digits (pitch 0) — part · [arakni]
- type: Assassin / Ninja Equipment - Arms
- ▶ Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
- — If damage is dealt this way, the dagger has hit
- — Destroy the dagger.

### Dawnblade (pitch 0) — part · [dorinthea]
- type: Warrior Weapon - Sword (2H)
- ○ Once per Turn Action - {r}: Attack
- — The second time this hits each turn, put a +1{p} counter on it.
- — At the beginning of your end phase, if this hasn't hit this turn, remove all +1{p} counters from it.

### Death Dealer (pitch 0) — part · [azalea]
- type: Ranger Weapon - Bow (2H)
- — Once per Turn Action - {r}: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
- — If you do, draw a card
- ▶ Go again

### Den of the Spider (pitch 1) — none · [arakni]
- type: Assassin / Warrior Action Defense Reaction - Trap · granted: Mark
- — When this defends an attack with {p} greater than its base, mark the attacking hero.

### Drill Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Piercing 1
- — If this has an aim counter, it has piercing 1.
- — When this hits a hero, put a -1{d} counter on an equipment they control.
- 🚩 unreviewed keyword: "piercing"

### Dry Powder Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When this is put face-up into your arsenal, it gets +2{p} this turn.

### Edge of Their Seats (pitch 1) — part · [lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense
- ▶ When this leaves the arena, your next attack this turn gets +5{p}.

### Edge of Their Seats (pitch 3) — part · [bravo, lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense
- ▶ When this leaves the arena, your next attack this turn gets +3{p}.

### Edict of Steel (pitch 1) — part · [boltyn]
- type: Warrior Action · printed: Sharpen, Go again
- — Sharpen target sword you control.
- — If it has 1 or more +1{p} counters, create a Flurry token.
- ▶ Go again
- 🚩 unreviewed keyword: "sharpen"

### Engulfing Light (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains "If this hits, put it into your hero's soul."

### Engulfing Light (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains "If this hits, put it into your hero's soul."

### Entangling Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When this is put face-up into your arsenal, you may {t} target hero.
- 🚩 tap cost {t} — not enforced (see ledger)

### Entwine Lightning (pitch 1) — none · [briar]
- type: Elemental Action - Attack · printed: Lightning Fusion, Go again
- — Lightning Fusion
- — If this was fused, it gains go again.
- 🚩 unreviewed keyword: "lightning fusion"
- 🚩 text mentions go again but no clause parses it

### Flamecall Awakening (pitch 1) — part · [fai]
- type: Draconic Action - Attack · printed: Go again
- — When you attack with this, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
- ▶ Go again

### Frailty Trap (pitch 1) — none · [arakni]
- type: Assassin / Ranger Defense Reaction - Trap
- — When this defends an attack with go again, create a Frailty token under the attacking hero's control.
- 🚩 text mentions go again but no clause parses it

### Full of Bravado (pitch 3) — none · [lyath]
- type: Guardian Action - Attack
- — When this attacks or defends, if you control an aura of suspense, create a Confidence token.

### Glisten (pitch 1) — none · [boltyn]
- type: Light Instant
- — Distribute up to four +1{p} counters among any number of weapons you control.
- — At the beginning of your end phase, remove all +1{p} counters from weapons you control.

### Halo of Illumination (pitch 0) — part · [boltyn]
- type: Light Equipment - Head · printed: Spellvoid 2
- — Instant - {r}, destroy this: Put a card from your hand into your hero's soul
- — If it's a Light card, draw a card.
- ○ Spellvoid 2

### Hope Merchant's Hood (pitch 0) — none · [dash, fai]
- type: Generic Equipment - Head
- — Instant - Destroy this: Shuffle any number of cards from your hand into your deck, then draw that many cards.

### Ice Eternal (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Iyslander Specialization, Ice Fusion
- ○ Iyslander Specialization
- — Ice Fusion
- ○ Create X Frostbite tokens under target hero's control
- — Then, if this was fused, deal arcane damage to that hero equal to the number of Frostbites they control.
- 🚩 unreviewed keyword: "ice fusion"

### Inertia Trap (pitch 1) — none · [arakni]
- type: Assassin / Ranger Defense Reaction - Trap
- — When this defends an attack with {p} greater than its base, create an Inertia token under the attacking hero's control.

### Jack Be Quick (pitch 1) — part · [briar]
- type: Generic Action - Attack · printed: Go again, Steal
- ▶ When this attacks, you may banish a Nimblism from your graveyard
- ▶ If you do, this gets +1{p} and go again.
- — When this hits a hero, {u} an ally they control, then steal it until the end of this action phase.
- 🚩 unreviewed keyword: "steal"
- 🚩 untap {u} — not parsed (see ledger)
- 🚩 text mentions go again but no clause parses it

### Jittery Bones (pitch 3) — none · [gravy]
- type: Pirate Necromancer Action - Attack · printed: Go again
- — When this attacks, you may discard a card or destroy the top card of your deck
- — If that card has watery grave, this gets go again.
- 🚩 text mentions go again but no clause parses it

### Lair of the Spider (pitch 1) — none · [arakni]
- type: Assassin / Ninja Action Defense Reaction - Trap · printed: Mark
- — When this defends an attack with go again, mark the attacking hero.
- 🚩 text mentions go again but no clause parses it

### Light the Way (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge, Go again
- ○ As an additional cost to play this, you may charge your hero's soul.
- — When this hits, if a yellow card was charged this way, this gets go again.
- 🚩 text mentions go again but no clause parses it

### Light the Way (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge, Go again
- ○ As an additional cost to play this, you may charge your hero's soul.
- — When this hits, if a yellow card was charged this way, this gets go again.
- 🚩 text mentions go again but no clause parses it

### Line Crossers (pitch 0) — part · [lyath]
- type: Reviled Equipment - Arms · printed: Blade Break
- — If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you.
- ○ Blade Break

### Look Tuff (pitch 1) — none · [iyslander, enigma, blaze]
- type: Generic Action - Attack
- — When this attacks, it gets -1{p} unless you pay {r}.

### Loot the Arsenal (pitch 3) — part · [gravy]
- type: Pirate Necromancer Action · printed: Go again
- — Your next Pirate ally attack this turn gets "When this hits a hero, destroy a card in their arsenal
- — If you do, create a Gold token."
- ▶ Go again

### Loot the Hold (pitch 3) — part · [gravy]
- type: Pirate Necromancer Action · printed: Go again
- ▶ Your next Pirate ally attack this turn gets "When this hits a hero, they discard a card
- — If they do, create a Gold token."
- ▶ Go again

### Magmatic Carapace (pitch 0) — part · [bravo]
- type: Guardian Equipment - Chest · printed: Guardwell
- — Whenever you play an aura, you may {t} this and pay {r}
- — If you do, create a Seismic Surge token.
- ○ Guardwell
- 🚩 tap cost {t} — not enforced (see ledger)

### Malefic Incantation (pitch 1) — part · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- ▶ Go again
- ▶ This enters the arena with 3 verse counters
- ○ When it has none, destroy it.
- — Once per turn, when you play an attack action card, remove a verse counter from this
- — If you do, create a Runechant token.

### Malefic Incantation (pitch 2) — part · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- ▶ Go again
- ▶ This enters the arena with 2 verse counters
- ○ When it has none, destroy it.
- — Once per turn, when you play an attack action card, remove a verse counter from this
- — If you do, create a Runechant token.

### Mark of the Black Widow (pitch 1) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- ○ Stealth
- — When this hits a marked hero, they banish a card from their hand.

### Mark of the Black Widow (pitch 3) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- ○ Stealth
- — When this hits a marked hero, they banish a card from their hand.

### Mark of the Funnel Web (pitch 1) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- ○ Stealth
- — When this hits a marked hero, banish a card in their arsenal.

### Memorial Ground (pitch 2) — none · [azalea]
- type: Generic Instant
- — Put target attack action card with cost 1 or less from your graveyard on top of your deck.

### Mounting Anger (pitch 1) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- — If you do, it gains +1{p} and you may play it this turn.
- ▶ Go again

### Night's Embrace (pitch 3) — none · [arakni]
- type: Assassin Attack Reaction
- — Your attacks with stealth get +1{p} this turn.

### Oasis Respite (pitch 1) — part · [dorinthea, enigma, lyath]
- type: Generic Instant
- ▶ Prevent the next 4 damage that would be dealt to target hero this turn by a source of your choice
- — If they have less life than each other hero, they may gain 1{h}.

### Orb-Weaver Spinneret (pitch 1) — part · [arakni]
- type: Assassin Action · printed: Go again
- — Equip a Graphene Chelicera token.
- ▶ Your next attack with stealth this turn gets +3{p}.
- ▶ Go again

### Oysten, Heart of Gold (pitch 2) — part · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- ○ Action - {t}: Attack
- — When this dies, create a Gold token.
- ○ Watery Grave
- 🚩 tap cost {t} — not enforced (see ledger)

### Pass Over (pitch 3) — part · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- ○ Legendary
- — Banish target card from an opposing hero's graveyard.
- ▶ If you've played another blue card this turn, transcend.

### Path of Same Ends (pitch 1) — part · [briar]
- type: Lightning Runeblade Action - Attack · printed: Go again
- ▶ When this attacks a hero, deal 1 arcane damage to them
- — If damage is dealt this way, this gets go again.
- ○ Instant - {r}: This gets go again.
- 🚩 text mentions go again but no clause parses it

### Phantasmal Haze (pitch 3) — part · [enigma]
- type: Illusionist Action - Attack · printed: Phantasm
- ○ Phantasm
- — When this is destroyed, create a Spectral Shield token.

### Photon Splicing (pitch 3) — part · [iyslander, blaze]
- type: Wizard Action
- ▶ Deal 2 arcane damage to any target.
- — Instant - Discard this: Amp 1

### Pick Up the Point (pitch 1) — part · [arakni]
- type: Assassin / Ninja Action - Attack · printed: Go again, Retrieve
- — When this attacks, you may retrieve a dagger from your graveyard.
- ▶ Go again
- 🚩 unreviewed keyword: "retrieve"

### Plasma Barrel Shot (pitch 0) — part · [dash]
- type: Mechanologist Weapon - Gun (2H)
- ○ Once per Turn Action - Remove a steam counter from this: Attack
- — Action - {r}{r}: If there are no steam counters on this, put a steam counter on it
- ▶ Go again
- — X is equal to 1 plus the number of times you have boosted this combat chain.

### Polar Cap (pitch 1) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion
- ▶ Deal 4 arcane damage to any target
- ○ If this was fused and deals damage to a hero, create a Frostbite token under their control.
- 🚩 unreviewed keyword: "ice fusion"

### Portside Exchange (pitch 3) — part · [gravy]
- type: Pirate Action · printed: Go again
- ▶ Discard a card, then draw a card
- — If a yellow card is discarded this way, create a Gold token.
- ▶ Go again

### Preserve Tradition (pitch 3) — part · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- ○ Legendary
- — Put target action card from your graveyard on the bottom of your deck.
- ▶ If you've played another blue card this turn, transcend.

### Pulping (pitch 1) — part · [kayo]
- type: Brute Action - Attack · printed: Dominate, Go again
- ▶ When this attacks, draw a card then discard a random card
- — If a card with 6 or more {p} is discarded this way, this gets dominate.
- ▶ If this is defended by fewer than 2 non-equipment cards, it gets go again.

### Pummel (pitch 1) — part · [bravo]
- type: Generic Attack Reaction
- — Choose 1;
- ▶ - Target club or hammer weapon attack gains +4{p}.
- ▶ - Target attack action card with cost 2 or more gets +4{p} and "When this hits a hero, they discard a card."

### Radiant Touch (pitch 0) — none · [boltyn]
- type: Light Equipment - Arms
- — Instant - Banish this and a card from your hero's soul: Prevent the next 2 damage that would be dealt to your hero this turn.

### Rally the Coast Guard (pitch 3) — part · [kayo]
- type: Generic Action - Attack
- — Once per Turn Instant - Discard a card: This gets +3{d}
- ○ Activate this only while this card is defending.

### Raydn, Duskbane (pitch 0) — part · [boltyn]
- type: Light Warrior Weapon - Sword (2H)
- ○ Once per Turn Action - 0: Attack
- — If you've charged this turn, Raydn gains +3{p}.

### Re-Charge! (pitch 1) — part · [dash]
- type: Mechanologist Action · printed: Go again
- — Put a steam counter on a Hyper Driver you control.
- ▶ The next attack you boost this turn gets +4{p}.
- ▶ Go again

### Reaper's Call (pitch 3) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- ○ Stealth
- — Instant - Discard this: Mark target opposing hero.

### Refraction Bolters (pitch 0) — part · [dorinthea]
- type: Warrior Equipment - Legs · printed: Battleworn · granted: Go again
- — When a weapon you control hits, you may destroy this
- — If you do, the attack gains go again.
- ○ Battleworn
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Ridge Rider Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Opt 1
- — If this is put into your arsenal face up, opt 1.

### Rise from the Ashes (pitch 1) — part · [fai]
- type: Draconic Ninja Action · printed: Go again
- ▶ The next Draconic or Ninja attack action card you play this turn gains +3{p}.
- — You may return a Phoenix Flame from your graveyard to your hand.
- ▶ Go again

### Rising Resentment (pitch 1) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — When this hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- — If you do, it costs {r} less to play and you may play it this turn.
- ▶ Go again

### Roaring Beam (pitch 2) — part · [boltyn]
- type: Light Warrior Attack Reaction · printed: Charge
- ▶ Create a Courage token.
- — If there are no cards in your soul, return this to its owner's hand, then charge your soul.

### Saltwater Swell (pitch 1) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- ▶ When this attacks, reveal the top card of your deck
- — If it's blue, pitch it.
- ▶ Go again

### Saltwater Swell (pitch 3) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- ▶ When this attacks, reveal the top card of your deck
- — If it's blue, pitch it.
- ▶ Go again

### Scuttle Toes (pitch 0) — part · [gravy]
- type: Necromancer Equipment - Legs · printed: Arcane Barrier 1
- — Instant - {r}{r}, destroy this: {u} target ally you control
- ▶ Destroy it at the beginning of the end phase.
- ○ Arcane Barrier 1
- 🚩 untap {u} — not parsed (see ledger)

### Searing Emberblade (pitch 0) — part · [fai]
- type: Draconic Ninja Weapon - Sword (2H)
- ○ Once per Turn Action - {r}{r}: Attack
- — If you control 2 or more Draconic chain links, this card's attacks get go again.
- 🚩 text mentions go again but no clause parses it

### Shred (pitch 3) — none · [arakni]
- type: Assassin Attack Reaction
- — Target card defending an Assassin attack gets -2{d} this combat chain.

### Sigil of Silphidae (pitch 3) — part · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- ▶ Go again
- — When this enters or leaves the arena, you may banish another aura from your graveyard
- — If you do, deal 1 arcane damage to target hero.
- ▶ At the beginning of your action phase, destroy this.

### Silent Stilettos (pitch 0) — part · [enigma]
- type: Illusionist Equipment - Legs · printed: Arcane Barrier 1
- — Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
- — If you do, destroy this and gain 1 action point.
- ○ Arcane Barrier 1

### Snapback (pitch 1) — part · [blaze]
- type: Wizard Action
- ▶ Deal 3 arcane damage to target hero.
- — If you have played another Wizard 'non-attack' action card this turn, you may play this as though it were an instant.

### Spectral Rider (pitch 3) — part · [enigma]
- type: Illusionist Action - Attack · printed: Overpower, Phantasm
- — When you play this, if you control a Spectral Shield, this gains overpower.
- ○ Phantasm
- 🚩 unreviewed keyword: "overpower"

### Spire Sniping (pitch 2) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When this is put or turned face up in arsenal, look at the top 2 cards of your deck, then put them back in any order.

### Stains of the Redback (pitch 1) — part · [arakni]
- type: Assassin Attack Reaction · granted: Go again
- — If the defending hero is marked, this costs {r} less to play.
- ▶ Target attack with stealth gets +3{p} and go again.
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Stalker's Steps (pitch 0) — part · [arakni]
- type: Assassin Equipment - Legs · printed: Arcane Barrier 1 · granted: Go again
- — Attack Reaction - Destroy this: Target attack with stealth gets go again
- ○ Arcane Barrier 1
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Star Fall (pitch 0) — part · [briar]
- type: Lightning Runeblade Weapon - Sword (2H) · printed: Go again
- ○ Once per Turn Action - {r}: Attack
- — If you've played a Lightning card this turn, this card's attacks get +1{p} and go again.
- 🚩 text mentions go again but no clause parses it

### Staunch Response (pitch 1) — part · [bravo]
- type: Guardian Defense Reaction
- ○ As an additional cost to play this you may pay {r}{r}{r}{r}
- — If you do, this gains +3{d}.

### Swift Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Go again
- — When this is put face-up into your arsenal, it gets go again this turn.
- 🚩 text mentions go again but no clause parses it

### Take Aim (pitch 1) — part · [azalea]
- type: Ranger Action · printed: Reload, Go again
- ▶ The next Ranger attack action card you play this turn, gains +3{p}.
- — Reload
- ▶ Go again

### Take Flight (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains go again.
- 🚩 text mentions go again but no clause parses it

### Take Flight (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul.
- — If you've charged this turn, this gains go again.
- 🚩 text mentions go again but no clause parses it

### Tension in the Air (pitch 1) — part · [lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense
- ▶ When this leaves the arena, your next attack this turn gets +4{p}.

### The Suspense is Killing Me (pitch 3) — part · [bravo, lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense
- ▶ Your first attack each turn gets +1{p}.

### Throw Caution to the Wind (pitch 3) — part · [gravy]
- type: Pirate Instant
- ▶ Reveal the top card of your deck
- — The next time you would be dealt damage this turn, prevent X of that damage, where X is the pitch value of the card revealed this way.

### Thunder Quake (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Heave 3
- — Heave 3
- 🚩 unreviewed keyword: "heave"

### Toe the Line (pitch 1) — part · [boltyn]
- type: Warrior Instant
- ▶ The next time you would be dealt damage this turn, prevent 2 of that damage
- — If you prevent damage this way, create a Flurry token.

### Topsy Turvy (pitch 0) — part · [arakni]
- type: Chaos Equipment - Head · printed: Arcane Barrier 1
- — Instant - Destroy this: Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom.
- ○ Arcane Barrier 1

### Turn to Mindfire (pitch 1) — part · [blaze]
- type: Wizard Action
- ▶ Deal 5 arcane damage to any target.
- — If this deals damage, you may {t} your hero
- — If you do, create a Ponder token.
- 🚩 tap cost {t} — not enforced (see ledger)

### Two Sides to the Blade (pitch 1) — part · [arakni]
- type: Assassin Attack Reaction · granted: Mark
- — Choose 1;
- ▶ - Target dagger attack gets +3{p}.
- ▶ - Target attack action card with stealth gets +3{p} and "When this hits a hero, mark them."

### Up Sticks and Run (pitch 1) — part · [arakni]
- type: Assassin / Ninja Action · printed: Go again, Retrieve
- — You may retrieve a dagger from your graveyard.
- ▶ Your next dagger attack this turn gets +4{p}.
- ▶ Go again
- 🚩 unreviewed keyword: "retrieve"

### Uphold Tradition (pitch 0) — part · [enigma]
- type: Mystic Illusionist Equipment - Arms · printed: Cloaked, Ward 1
- ○ Cloaked
- — Instant - {r}, turn this face-up: Put a +1{p} counter on an aura you control with ward.
- ▶ Ward 1
- 🚩 unreviewed keyword: "cloaked"

### V of the Vanguard (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Boltyn Specialization, Charge
- ○ Boltyn Specialization
- ○ As an additional cost to play this, you may charge your hero's soul any number of times.
- — Attacks on this combat chain gain +1{p} for each Light card charged this way.

### Valiant Thrust (pitch 2) — none · [boltyn]
- type: Light Warrior Action - Attack
- — If you've charged this turn, this gains +3{p}.

### Waning Vengeance (pitch 1) — part · [enigma]
- type: Mystic Illusionist Instant - Aura · printed: Ward 3
- — When this leaves the arena, if you've pitched a blue card this turn, create a Spectral Shield token.
- ▶ Ward 3

### Washed Up Wave (pitch 0) — part · [gravy]
- type: Pirate Necromancer Equipment - Arms · printed: Blade Break
- — When this defends, you may discard a card or destroy the top card of your deck
- — If that card has watery grave, this gets +2{d}.
- ○ Blade Break

### Wax On (pitch 1) — none · [fai]
- type: Ninja Defense Reaction
- — While this is defending an attack action card with cost 0, it gains +2{d}.

### Waxing Specter (pitch 1) — part · [enigma]
- type: Mystic Illusionist Instant - Aura · printed: Ward 3
- — If you've pitched a blue card this turn, this enters the arena with a +1{p} counter.
- ▶ Ward 3

### Weave Lightning (pitch 1) — part · [briar]
- type: Lightning Action · printed: Go again · granted: Go again
- ▶ The next Lightning or Elemental attack action card you play this turn gains +3{p}
- — If it's fused, it gains go again.
- ▶ Go again

### Wreck Havoc (pitch 1) — part · [dorinthea]
- type: Generic Action - Attack
- ○ Defense reactions can't be played to this chain link.
- — When this hits a hero, you may turn a card in their arsenal face up, then destroy a defense reaction in their arsenal.

## Flags on otherwise fully-scripted cards

- **Aether Quickening** (pitch 3): unreviewed keyword: "surge"
- **Banneret of Salvation** (pitch 2): unreviewed keyword: "solflare"
- **Barnacle** (pitch 2): tap cost {t} — not enforced (see ledger)
- **Battalion Barque** (pitch 1): unreviewed keyword: "high tide"
- **Concealed Object** (pitch 3): tap cost {t} — not enforced (see ledger)
- **Cutty Shark, Quick Clip** (pitch 2): tap cost {t} — not enforced (see ledger)
- **Display Loyalty** (pitch 1): text mentions go again but no clause parses it
- **Drop the Anchor** (pitch 1): tap cost {t} — not enforced (see ledger)
- **Enflame the Firebrand** (pitch 1): text mentions go again but no clause parses it
- **Gauntlets of Unity** (pitch 0): unreviewed keyword: "unity"
- **Helm of Unity** (pitch 0): unreviewed keyword: "unity"
- **Hot on Their Heels** (pitch 1): text mentions go again but no clause parses it
- **Lava Burst** (pitch 1): unreviewed keyword: "rupture"
- **Limpit, Hop-a-long** (pitch 2): tap cost {t} — not enforced (see ledger)
- **Mandible Claw** (pitch 0): text mentions go again but no clause parses it
- **Open the Flood Gates** (pitch 3): unreviewed keyword: "surge"
- **Puncture** (pitch 1): unreviewed keyword: "piercing"
- **Puncture** (pitch 3): unreviewed keyword: "piercing"
- **Riggermortis** (pitch 2): tap cost {t} — not enforced (see ledger)
- **Rush of Power** (pitch 1): unreviewed keyword: "quickstrike" · text mentions go again but no clause parses it
- **Scorpio, Comet Tail** (pitch 0): tap cost {t} — not enforced (see ledger)
- **Second Strike** (pitch 1): text mentions go again but no clause parses it
- **Static Shock** (pitch 1): unreviewed keyword: "lightning flow"
- **Swabbie** (pitch 2): tap cost {t} — not enforced (see ledger)
- **Swiftwater Sloop** (pitch 1): unreviewed keyword: "high tide"
- **Swiftwater Sloop** (pitch 3): unreviewed keyword: "high tide"

## Fully scripted, no flags — the roll call

A Drop in the Ocean (3) · Absorb in Aether (1) · Achilles Accelerator (0) · Aether Hail (3) · Aether Spindle (1) · Aether Spindle (3) · Aetherstorm Wellingtons (0) · Amplify the Arknight (1) · Arcane Lantern (0) · Art of Desire: Body (1) · Art of Desire: Mind (3) · Art of the Dragon: Fire (1) · Avast Ye! (3) · Bare Fangs (1) · Bare Fangs (2) · Basalt Boots (0) · Bear Hug (3) · Big Blue Sky (3) · Blade Beckoner Boots (0) · Blade Beckoner Gauntlets (0) · Blade Beckoner Helm (0) · Blade Beckoner Plating (0) · Blaze Headlong (1) · Blood Scent (0) · Blossom of Spring (0) · Booze! (3) · Boulder Drop (1) · Boulder Drop (3) · Brand with Cinderclaw (1) · Brand with Cinderclaw (2) · Brand with Cinderclaw (3) · Buckling Blow (1) · Buckling Blow (3) · Buckwild (1) · Buckwild (3) · Cartilage Crush (1) · Chokeslam (1) · Chokeslam (3) · Cinderskin Devotion (3) · Clash of Agility (1) · Clash of Might (1) · Clash of Might (2) · Clash of Vigor (3) · Cloud Cover (1) · Crucible of Aetherweave (0) · Crush the Weak (3) · Debilitate (1) · Debilitate (3) · Disable (3) · Double Cross Strap (0) · Drag Down (1) · Dragon Power (3) · Duty Bound Blitz (1) · Duty Bound Blitz (2) · Emeritus Scolding (1) · Emeritus Scolding (2) · Emeritus Scolding (3) · Enclosed Firemind (0) · Energy Potion (3) · Enigma Chimera (1) · Enigma Chimera (2) · Fault Line (1) · Fender Bender (1) · Fire Tenet: Strike First (1) · Fire that Burns Within (1) · Flat Trackers (0) · Flatten the Field (3) · Fluid Motion (3) · Flying High (3) · Frost Spike (3) · Frosting (3) · Fry (1) · Fyendal's Fighting Spirit (1) · Garland of Spring (0) · Goblet of Bloodrun Wine (3) · Golden Tipple (1) · Golden Tipple (2) · Golden Tipple (3) · Goon Beatdown (3) · Goon Tactics (3) · High Pitched Howl (1) · Hit and Run (3) · Hit the High Notes (1) · Homage to Ancestors (3) · Hyper Driver (1) · Hyper Inflation (1) · Ice Bolt (1) · Ice Bolt (3) · Illuminate (1) · Infecting Shot (1) · Infecting Shot (2) · Infect (1) · Ironrot Gauntlet (0) · Ironrot Helm (0) · Ironrot Legs (0) · Ironrot Plate (0) · Ironsong Response (1) · Ironsong Response (3) · Jump Start (1) · Jump Start (2) · Jump Start (3) · Knucklehead (0) · Lace with Bloodrot (1) · Lace with Frailty (1) · Lace with Inertia (1) · Lead with Speed (1) · Lightning Press (1) · Lightning Surge (1) · Macho Grande (3) · Mage Master Boots (0) · Manifest Muscle (3) · Mark of the Huntsman (0) · Mark the Prey (1) · Mask of the Swarming Claw (0) · Mauvrion Skies (1) · Mauvrion Skies (3) · Mocking Blow (1) · Mocking Blow (2) · Mocking Blow (3) · Mournful Casket (0) · Murderous Rabble (3) · Murkmire Grapnel (1) · Nimblism (1) · Nimblism (2) · Nip at the Heels (3) · Nullrune Boots (0) · Nullrune Gloves (0) · Nullrune Hood (0) · Nullrune Robe (0) · On the Horizon (1) · Out for Blood (1) · Out Pace (1) · Overblast (1) · Overpower (1) · Overpower (3) · Phoenix Flame (1) · Pouncing Paws (0) · Power Play (3) · Predatory Plating (0) · Prey Spotters (0) · Prime the Crowd (1) · Put in Context (3) · Pyroglyphic Protection (3) · Quick Clicks (0) · Ravenous Rabble (1) · Read the Glide Path (1) · Read the Runes (1) · Reaping Blade (0) · Reduce to Runechant (1) · Reincarnate (3) · Release the Tension (1) · Rev Up (1) · Rising Sun, Setting Moon (3) · Ronin Renegade (1) · Rough Up (1) · Run Roughshod (3) · Run Through (2) · Rune Flash (1) · Runebleed Robe (0) · Runerager Swarm (1) · Runic Fellingsong (1) · Sadistic Scowl (1) · Salt the Wound (2) · Savage Feast (1) · Scar for a Scar (1) · Scar Tissue (1) · Scout the Periphery (1) · Searing Shot (1) · Second Tenet of Chi: Wind (3) · Seeker's Mitts (0) · Sharpen Steel (1) · Short Shrift (2) · Shrill of Skullform (1) · Shrill of Skullform (2) · Shrill of Skullform (3) · Sigil of Suffering (1) · Sizzle (1) · Sledge of Anvilheim (0) · Smash Instinct (3) · Snatch (1) · Spears of Surreality (3) · Spectral Manifestations (1) · Spellblade Assault (1) · Spellblade Assault (3) · Spellfire Cloak (0) · Spike with Bloodrot (1) · Springboard Somersault (2) · Sprout Strength (1) · Stand Strong (0) · Steelbraid Buckler (0) · Stir the Aetherwinds (3) · Stonewall Impasse (0) · Stroke of Foresight (1) · Strongest Survive (1) · Strongest Survive (2) · Strongest Survive (3) · Swiftstrike Bracers (0) · Talishar, the Lost Prince (0) · Talismanic Lens (0) · Tearing Shuko (0) · Teklo Trebuchet 2000 (3) · Test of Might (1) · Test of Strength (1) · Throttle (1) · Throttle (3) · Timesnap Potion (3) · Titan's Fist (0) · Trot Along (3) · Under Loop (1) · Unexpected Backhand (3) · Unmovable (1) · Unmovable (3) · Vexing Malice (3) · Villainous Pose (1) · Voltic Bolt (1) · Voltic Bolt (3) · Walk in My Shoes (2) · Warrior's Valor (1) · Warrior's Valor (2) · Warrior's Valor (3) · Wee Wrecking Ball (2) · Whisper of the Oracle (1) · Whisper of the Oracle (2) · Whisper of the Oracle (3) · Widowmaker (2) · Wild Ride (1) · Wild Ride (2) · Winter's Bite (3) · Wounded Bull (1) · Yo Ho Ho! (3) · Zealous Belting (1) · Zero to Sixty (1) · Zero to Sixty (2) · Zero to Sixty (3) · Zipper Hit (1) · Zipper Hit (2) · Zipper Hit (3)
