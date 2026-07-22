# DAWNBLADE POOL AUDIT

Generated 2026-07-22T04:41:11.132Z · app v1.20 · data sage-v6 · db 4862 records

## Summary

| | count |
|---|---|
| Unique cards in pool (name\|pitch) | 405 |
| Fully scripted | 62 |
| Partially scripted | 109 |
| Text-only (nothing parsed) | 234 |
| Cards with audit flags | 108 |

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
| charge | pending — Boltyn's soul engine | Beaming Bravado, Bolt of Courage, Engulfing Light, Light the Way, Roaring Beam, Take Flight, V of the Vanguard |
| clash | approx — dummy pantomimes its reveal instead of truly pitching | Clash of Agility, Clash of Might, Clash of Vigor, Stonewall Impasse, Test of Might, Test of Strength |
| cloaked | unreviewed — Arakni package | Uphold Tradition |
| crank | unreviewed — Dash — Mechanologist items | Boom Grenade |
| crush | partial — 4+ damage threshold checked at resolve; debuff payloads inert vs dummy | Boulder Drop, Buckling Blow, Cartilage Crush, Chokeslam, Crush the Weak, Debilitate, Disable, Fault Line, Flatten the Field, Short Shrift, Walk in My Shoes, Wee Wrecking Ball |
| dominate | inert-dummy — defender restricted to 1 card from hand — no hand to restrict | Macho Grande, Pulping |
| go again | live — printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule) | Aether Quickening, Arcane Seeds // Life, Avast Ye!, Blaze Headlong, Bolt'n' Shot, Booze!, Brand with Cinderclaw, Buckwild, Burn Up // Shock, Call in the Big Guns, Cinderskin Devotion, Cold Snap, Concoct Disorder, Condemn to Slaughter, Display Loyalty, Drop the Anchor, Duty Bound Blitz, Edict of Steel, Enflame the Firebrand, Entwine Lightning, Fire Tenet: Strike First, Fire that Burns Within, Flamecall Awakening, Fluid Motion, Flying High, Fry, Goblet of Bloodrun Wine, Golden Tipple, Hit and Run, Hot on Their Heels, Hyper Inflation, Jack Be Quick, Jittery Bones, Lace with Bloodrot, Lace with Frailty, Lace with Inertia, Lead with Speed, Light the Way, Lightning Surge, Loot the Arsenal, Loot the Hold, Malefic Incantation, Mauvrion Skies, Mounting Anger, Murderous Rabble, Nimblism, Orb-Weaver Spinneret, Path of Same Ends, Phoenix Flame, Pick Up the Point, Portside Exchange, Prime the Crowd, Pulping, Ravenous Rabble, Re-Charge!, Read the Glide Path, Release the Tension, Rise from the Ashes, Rising Resentment, Ronin Renegade, Rune Flash, Runerager Swarm, Sadistic Scowl, Saltwater Swell, Scar for a Scar, Scout the Periphery, Second Strike, Second Tenet of Chi: Wind, Sharpen Steel, Sigil of Silphidae, Sizzle, Spears of Surreality, Spectral Manifestations, Sprout Strength, Star Fall, Swift Shot, Take Aim, Trot Along, Up Sticks and Run, Villainous Pose, Warrior's Valor, Weave Lightning, Whisper of the Oracle, Wild Ride, Winter's Bite, Yo Ho Ho!, Zealous Belting |
| guardwell | live — defense drops to 0 at chain close | Beckoning Haunt, Blade Beckoner Boots, Blade Beckoner Gauntlets, Blade Beckoner Helm, Blade Beckoner Plating, Magmatic Carapace, Predatory Plating |
| heave | unreviewed — seen on Thunder Quake (Guardian) | Thunder Quake |
| high tide | unreviewed — 2+ blue cards in pitch zone rider (Gravy Bones) | Battalion Barque, Swiftwater Sloop |
| ice fusion | unreviewed — Iyslander — fusion cost rider | Aether Icevein, Brain Freeze, Ice Eternal, Polar Cap |
| intimidate | inert-dummy — banishes a card from defender's hand face-down — no hand | Sadistic Scowl, Smash Instinct |
| legendary | info — deckbuilding limit: 1 copy | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| lightning flow | unreviewed — Briar | Static Shock |
| lightning fusion | unreviewed — Briar — fusion cost rider | Arcanic Shockwave, Entwine Lightning |
| mark | unreviewed — marked-hero state (Arakni) | Hot on Their Heels, Lair of the Spider, Mark of the Huntsman, Mark the Prey |
| meld | unreviewed — split-effect cards (Arcane Seeds // Life, Briar) | Arcane Seeds // Life, Burn Up // Shock |
| opt | unreviewed — look at top N of deck, reorder | Aether Spindle, Cindering Foresight, Read the Glide Path, Ridge Rider Shot, Whisper of the Oracle |
| overpower | unreviewed — defense restriction; needs CR wording | Spectral Rider |
| phantasm | unreviewed — illusion pop on 6+ power non-illusion attack (Enigma) | Enigma Chimera, Phantasmal Haze, Spears of Surreality, Spectral Rider |
| piercing | unreviewed — seen in pool; needs CR wording | Drill Shot |
| quickstrike | unreviewed — seen on Rush of Power | Rush of Power |
| reload | pending — roadmap #4 — Azalea | Bolt'n' Shot, Take Aim |
| reprise | inert-dummy — needs a defending card from hand to check | Ironsong Response, Out for Blood, Overpower, Stroke of Foresight |
| retrieve | unreviewed — seen in pool; hero package TBD | Pick Up the Point, Up Sticks and Run |
| rupture | unreviewed — seen in pool; hero package TBD | Lava Burst |
| sharpen | unreviewed — seen in pool; hero package TBD | Edict of Steel |
| solflare | unreviewed — Boltyn package | Banneret of Salvation |
| specialization | info — hero-locked card (normalized from '<Hero> Specialization') | Crow's Nest, Ice Eternal, Knucklehead, V of the Vanguard |
| spellvoid | inert-dummy — destroy this to prevent N arcane — the dummy deals only physical | Halo of Illumination, Mask of the Swarming Claw |
| steal | unreviewed — Arakni package | Jack Be Quick |
| stealth | unreviewed — Arakni package | Art of Desire: Body, Art of Desire: Mind, Infect, Mark of the Black Widow, Mark of the Funnel Web, Mark the Prey, Reaper's Call |
| surge | unreviewed — bonus when dealing more than printed arcane (Blaze) | Aether Quickening, Open the Flood Gates |
| suspense | unreviewed — leaves-arena rider (Enigma) | Act of Glory, Edge of Their Seats, Tension in the Air, The Suspense is Killing Me |
| temper | live — -1 per block, destroyed at 0 | Basalt Boots, Gauntlets of Unity, Helm of Unity, Knucklehead, Mournful Casket, Steelbraid Buckler, Stonewall Impasse |
| the crowd boos | unreviewed — Bravo, Flattering Showman | Booze!, Concealed Object, Goon Beatdown, Mocking Blow, Prime the Crowd, Villainous Pose |
| the crowd cheers | unreviewed — Bravo, Flattering Showman | Prime the Crowd |
| transcend | unreviewed — seen on A Drop in the Ocean (Enigma) | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| unity | unreviewed — Boltyn package | Gauntlets of Unity, Helm of Unity |
| ward | live — soaks incoming; arcane ward tracked separately (awd) | Uphold Tradition, Waning Vengeance, Waxing Specter |
| watery grave | unreviewed — play from graveyard when a blue hit the graveyard this turn (Gravy Bones) | Barnacle, Cutty Shark, Quick Clip, Limpit, Hop-a-long, Oysten, Heart of Gold, Riggermortis, Swabbie |

## Granted keywords in pool (conditional grants — never merged with printed)

| keyword | ledger status | cards |
|---|---|---|
| freeze | unreviewed | Cold Snap |
| go again | live | Avast Ye!, Bolt'n Boots, Compass of Sunken Depths, Cosmo, Scroll of Ancestral Tapestry, Flying High, Hit and Run, Mage Master Boots, Mauvrion Skies, Refraction Bolters, Run Through, Stains of the Redback, Stalker's Steps, Trot Along, Warrior's Valor, Weave Lightning |
| mark | unreviewed | Den of the Spider, Scar Tissue, Two Sides to the Blade |
| piercing | unreviewed | Puncture |

## Heroes

### Kayo (Brute)
- ⚠ unrecognized: "You have 1 weapon zone"
- ⚠ unrecognized: "Attack action cards you own get +1{p} while they are in any zone other than the combat chain"
- ⚠ unrecognized: "The first time you discard a card with 6 or more {p} during each of your action phases, create a Might token."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Iyslander (Elemental Wizard)
- static: Iyslander — blue non-attacks from arsenal at instant speed
- static: Iyslander — Ice on opponent's turn → Frostbite

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
- ⚠ unrecognized: "You may start the game with a Phoenix Flame in your graveyard"
- ⚠ unrecognized: "Once per Turn Instant - {r}{r}{r}: Return a Phoenix Flame from your graveyard to your hand"
- ⚠ unrecognized: "This ability costs {r} less for each Draconic chain link you control."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Enigma (Mystic Illusionist)
- ⚠ unrecognized: "Your first Spectral Shield attack each turn costs {r} less to activate"
- ⚠ unrecognized: "Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Arakni, Web of Deceit (Chaos Assassin)
- ⚠ unrecognized: "Your attacks with stealth that are attacking a marked hero get +1{p} and "When this hits, this gets go again." At the beginning of your end phase, if an opponent is marked, you become a random Agent of Chaos."
- 🚩 1 hero-text clause(s) not recognized by any ability reader

### Blaze, Firemind (Wizard)
- ⚠ unrecognized: "Whenever you opt, put energy counters on Blaze equal to the number of cards looked at this way"
- ⚠ unrecognized: "Once per Turn Instant - Remove X energy counters from Blaze: Banish a Wizard non-attack action card from your hand with an effect that deals arcane damage equal to X"
- ⚠ unrecognized: "You may play it this turn as though it were an instant."
- 🚩 3 hero-text clause(s) not recognized by any ability reader

### Boltyn (Light Warrior)
- ⚠ unrecognized: "If you've charged this turn, your attacks get +1{p} while defended by an attack action card"
- ⚠ unrecognized: "Attack Reaction - Banish a card from Boltyn's soul: Target attack with {p} greater than its base {p} gains go again."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Briar (Elemental Runeblade)
- ⚠ unrecognized: "Essence of Earth and Lightning The first time an attack action card you control deals damage to an opposing hero, create an Embodiment of Earth token"
- ⚠ unrecognized: "Whenever you play your second 'non-attack' action card each turn, create an Embodiment of Lightning token."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Gravy Bones (Pirate Necromancer)
- ⚠ unrecognized: "Instant - {t}, destroy a Gold you control: Draw a card, then discard a card"
- ⚠ unrecognized: "If a blue card has been put into your graveyard this turn, you may play cards with watery grave from your graveyard."
- 🚩 2 hero-text clause(s) not recognized by any ability reader

### Lyath Goldmane (Reviled Guardian)
- ⚠ unrecognized: "The base {p} and {d} of cards you control are halved, rounded up"
- ⚠ unrecognized: "Instant - {r}{r}, {t}: The crowd boos you"
- ⚠ unrecognized: "Defending action cards you control get +1{d} this turn"
- ⚠ unrecognized: "Whenever the crowd boos you, create a Might token."
- 🚩 4 hero-text clause(s) not recognized by any ability reader

## Tokens

- Runechant: in database — “When you play an attack action card or activate a weapon attack, destroy this and deal 1 arcane damage to target opposing hero.”
- Frostbite: in database — “Cards and abilities cost you an additional {r} to play or activate.
At the beginning of your end phase or when you play a card or activate an ability, destroy Frostbite.”
- Seismic Surge: in database — “At the beginning of your action phase, destroy this, then the next Guardian attack action card you play this turn costs {r} less to play.”
- Vigor: in database — “At the start of your turn, destroy this, then gain {r}.”
- Bloodrot: **not found in database**
- Frailty: in database — “Your attack action cards played from arsenal and weapon attacks have -1{p}.
At the beginning of your end phase destroy Frailty.”

## Coverage gaps — every unparsed clause, verbatim

The fix for any of these is always to teach `classifyClause`/`fxParse`, never to special-case the card.

### A Drop in the Ocean (pitch 3) — part · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- ▶ Legendary Target attack gets -1{p}
- — If you've played another blue card this turn, transcend.
- 🚩 unreviewed keyword: "transcend"

### Absorb in Aether (pitch 1) — none · [iyslander, blaze]
- type: Wizard Defense Reaction
- — The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 2.

### Achilles Accelerator (pitch 0) — none · [dash]
- type: Mechanologist Equipment - Legs · printed: Arcane Barrier 1
- — Instant - Destroy Achilles Accelerator: Gain 1 action point
- — Activate this ability only if you have boosted this turn
- — Arcane Barrier 1

### Aether Icevein (pitch 1) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- ▶ Ice Fusion Deal 5 arcane damage to any target
- — If Aether Icevein was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Aether Icevein (pitch 2) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- ▶ Ice Fusion Deal 4 arcane damage to any target
- — If Aether Icevein was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Aether Icevein (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- ▶ Ice Fusion Deal 3 arcane damage to any target
- — If Aether Icevein was fused and deals damage to a hero, they discard a card unless they pay {r}{r}.
- 🚩 unreviewed keyword: "ice fusion"

### Aether Spindle (pitch 1) — part · [blaze]
- type: Wizard Action · printed: Opt X
- ▶ Deal 4 arcane damage to target opposing hero
- — Opt X, where X is the damage dealt by Aether Spindle.
- 🚩 unreviewed keyword: "opt"

### Aether Spindle (pitch 3) — part · [blaze]
- type: Wizard Action · printed: Opt X
- ▶ Deal 2 arcane damage to target opposing hero
- — Opt X, where X is the damage dealt by Aether Spindle.
- 🚩 unreviewed keyword: "opt"

### Aetherstorm Wellingtons (pitch 0) — none · [iyslander, blaze]
- type: Wizard Equipment - Legs · printed: Arcane Barrier 2
- — Arcane Barrier 2

### Agile Engagement (pitch 1) — none · [dorinthea]
- type: Warrior Attack Reaction
- — Target Warrior attack gets +3{p}
- — If it's defended by an attack action card, create an Agility token.

### Agile Windup (pitch 3) — none · [kayo]
- type: Brute / Warrior Action - Attack
- — Instant - Discard this: Create an Agility token.

### Amplify the Arknight (pitch 1) — none · [viserai]
- type: Runeblade Action - Attack
- — This costs {r} less to play for each Runechant you control.

### Arcane Lantern (pitch 0) — none · [lyath]
- type: Generic Equipment - Off-Hand · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Arcane Polarity (pitch 1) — none · [fai, blaze, briar]
- type: Generic Instant
- — Gain 1{h} If you've been dealt arcane damage this turn, instead gain 4{h}.

### Arcane Seeds // Life (pitch 1) — part · [briar]
- type: Runeblade Action // Earth Instant · printed: Meld, Go again
- ▶ Meld Create a Runechant token
- ▶ Create a Runechant token
- — Go again // Gain 1{h}
- 🚩 unreviewed keyword: "meld"

### Art of Desire: Body (pitch 1) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth When this hits a hero, banish the top card of their deck
- ▶ Whenever this banishes a red card, draw a card and gain 1{h}.
- 🚩 unreviewed keyword: "stealth"

### Art of Desire: Mind (pitch 3) — part · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth When this hits a hero, banish the top card of their deck
- ▶ Whenever this banishes a blue card, draw a card and gain 1{h}.
- 🚩 unreviewed keyword: "stealth"

### Art of the Dragon: Fire (pitch 1) — none · [fai]
- type: Ninja Action - Attack
- — When this attacks, if it is Draconic, deal 2 damage to any target.

### Astral Etchings (pitch 1) — none · [enigma]
- type: Illusionist Action
- — Put three +1{p} counters on target aura with ward you control
- — If you control a Spectral Shield, you may play this as though it were an instant.

### Avast Ye! (pitch 3) — none · [gravy]
- type: Pirate Necromancer Action · printed: Go again · granted: Go again
- — Your next Pirate ally attack this turn gets go again and "When this hits a hero, create a Gold token." Go again

### Back Alley Breakline (pitch 3) — none · [gravy]
- type: Generic Action - Attack
- — If an activated ability or action card effect puts Back Alley Breakline face up into a zone from your deck, gain 1 action point.

### Banneret of Salvation (pitch 2) — none · [boltyn]
- type: Light Warrior Action - Attack · printed: Solflare
- — Solflare - When this is charged to your hero's soul, the next time you hit this turn, gain 1{h}.
- 🚩 unreviewed keyword: "solflare"

### Bare Fangs (pitch 1) — none · [kayo]
- type: Brute Action - Attack
- — When this attacks, draw a card then discard a random card
- — If a card with 6 or more {p} is discarded this way, Bare Fangs gains +2{p}.

### Bare Fangs (pitch 2) — none · [kayo]
- type: Brute Action - Attack
- — When this attacks, draw a card then discard a random card
- — If a card with 6 or more {p} is discarded this way, Bare Fangs gains +2{p}.

### Barnacle (pitch 2) — none · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- — Action - {t}: Attack Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)

### Basalt Boots (pitch 0) — none · [bravo]
- type: Guardian Equipment - Legs · printed: Temper
- — If you control a Seismic Surge token, this gets +1{d}
- — Temper

### Beaming Bravado (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul
- — If a yellow card is charged this way, this gets +1{p}

### Beaming Bravado (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play this, you may charge your hero's soul
- — If a yellow card is charged this way, this gets +1{p}

### Bear Hug (pitch 3) — none · [kayo]
- type: Brute Action - Attack
- — Play this only if you've pitched a card with 6 or more {p} this turn.

### Beaten Trackers (pitch 0) — none · [kayo]
- type: Brute Equipment - Legs · printed: Battleworn
- — Whenever you discard a random card with 6 or more {p}, you may destroy this
- — If you do, gain 1 action point
- — Battleworn

### Beckoning Haunt (pitch 0) — none · [viserai]
- type: Runeblade Equipment - Arms · printed: Guardwell
- — Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand
- — Guardwell

### Big Bertha (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Blade Beckoner Boots (pitch 0) — part · [iyslander, viserai, dash, enigma, arakni, blaze, briar]
- type: Generic Equipment - Legs · printed: Guardwell
- ▶ This gets +1{d} while defending a weapon attack
- — Guardwell

### Blade Beckoner Gauntlets (pitch 0) — part · [kayo, iyslander, dash, bravo, blaze, briar]
- type: Generic Equipment - Arms · printed: Guardwell
- ▶ This gets +1{d} while defending a weapon attack
- — Guardwell

### Blade Beckoner Helm (pitch 0) — part · [iyslander, viserai, dash, bravo, azalea, fai, enigma, briar, lyath]
- type: Generic Equipment - Head · printed: Guardwell
- ▶ This gets +1{d} while defending a weapon attack
- — Guardwell

### Blade Beckoner Plating (pitch 0) — part · [lyath]
- type: Generic Equipment - Chest · printed: Guardwell
- ▶ This gets +1{d} while defending a weapon attack
- — Guardwell

### Blaze Headlong (pitch 1) — none · [fai]
- type: Draconic Action - Attack · printed: Go again
- — If you've played another red card this turn, this gets go again.

### Blood Scent (pitch 0) — none · [fai]
- type: Ninja Equipment - Chest · printed: Battleworn
- — Instant - Destroy this: Gain {r}
- — Activate this only if you've attacked with a Crouching Tiger this turn
- — Battleworn

### Blossom of Spring (pitch 0) — part · [viserai, dash, azalea, dorinthea, enigma, arakni, briar]
- type: Generic Equipment - Chest
- — Action - Destroy this: Gain {r}
- ▶ Go again

### Bolt'n Boots (pitch 0) — none · [azalea]
- type: Ranger Equipment - Legs · printed: Battleworn · granted: Go again
- — Attack Reaction - {r}, destroy this: Target arrow attack with {p} greater than its base gets go again
- — Battleworn
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Bolt'n' Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Go again, Reload
- — If Bolt'n' Shot's {p} is greater than its base {p}, it has go again and "If this hits, reload."

### Bolt of Courage (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Bolt of Courage, you may charge your hero's soul
- — If you've charged this turn, Bolt of Courage gains "If this hits, draw a card."

### Bolt of Courage (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Bolt of Courage, you may charge your hero's soul
- — If you've charged this turn, Bolt of Courage gains "If this hits, draw a card."

### Boom Grenade (pitch 1) — none · [dash]
- type: Mechanologist Action - Item · printed: Crank
- — Crank This enters the arena with a steam counter
- — At the start of your turn, destroy this unless you remove a steam counter from it
- — When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them.
- 🚩 unreviewed keyword: "crank"

### Booze! (pitch 3) — none · [lyath]
- type: Reviled Action - Aura · printed: Go again, The Crowd Boos
- — Go again When this enters or leaves the arena, the crowd boos you
- — At the start of your turn, destroy this.
- 🚩 unreviewed keyword: "the crowd boos"

### Boulder Drop (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, they put a card from their hand on top of their deck.

### Boulder Drop (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, they put a card from their hand on top of their deck.

### Brain Freeze (pitch 3) — none · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- — Ice Fusion Target opponent reveals their hand
- — If Brain Freeze was fused, put an action card with cost 0 from their hand on top of their deck.
- 🚩 unreviewed keyword: "ice fusion"

### Brand with Cinderclaw (pitch 1) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — Your next attack this combat chain is Draconic in addition to its other card types
- ▶ Go again

### Brand with Cinderclaw (pitch 2) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — Your next attack this combat chain is Draconic in addition to its other card types
- ▶ Go again

### Brand with Cinderclaw (pitch 3) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — Your next attack this combat chain is Draconic in addition to its other card types
- ▶ Go again

### Brothers in Arms (pitch 3) — none · [iyslander, lyath]
- type: Generic Action - Attack
- — When this defends, you may pay {r}
- — If you do, it gets +2{d}.

### Buckling Blow (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, put a -1{d} counter on an equipment they control.

### Buckling Blow (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, put a -1{d} counter on an equipment they control.

### Bull's Eye Bracers (pitch 0) — part · [azalea]
- type: Ranger Equipment - Arms · printed: Arcane Barrier 1
- — Action - Destroy Bull's Eye Bracers: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
- ▶ It gains +1{p} until end of turn
- — Go again Arcane Barrier 1
- 🚩 text mentions go again but no clause parses it

### Call in the Big Guns (pitch 1) — part · [azalea]
- type: Ranger Action · printed: Go again
- ▶ Your next arrow attack this turn gets +3{p}
- — You may put an arrow from your hand face-up into your arsenal
- ▶ Go again

### Carrion Crown (pitch 0) — part · [gravy]
- type: Necromancer Equipment - Head · printed: Blade Break
- ▶ Action - Discard an ally, destroy this: Draw a card
- — Go again Blade Break
- 🚩 text mentions go again but no clause parses it

### Cartilage Crush (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, their first action during their next turn costs an additional {r} to play or activate.

### Chokeslam (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, attack action cards they control can't gain {p} during their next action phase.

### Chokeslam (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, attack action cards they control can't gain {p} during their next action phase.

### Cindering Foresight (pitch 1) — none · [blaze]
- type: Wizard Action · printed: Opt 3
- — If it's not your turn, you may play Cindering Foresight as though it were an instant
- — The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1
- — Opt 3
- 🚩 unreviewed keyword: "opt"

### Cindering Foresight (pitch 2) — none · [blaze]
- type: Wizard Action · printed: Opt 2
- — If it's not your turn, you may play Cindering Foresight as though it were an instant
- — The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1
- — Opt 2
- 🚩 unreviewed keyword: "opt"

### Cindering Foresight (pitch 3) — none · [blaze]
- type: Wizard Action · printed: Opt 1
- — If it's not your turn, you may play Cindering Foresight as though it were an instant
- — The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1
- — Opt 1
- 🚩 unreviewed keyword: "opt"

### Cinderskin Devotion (pitch 3) — none · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — If you control 2 or more Draconic chain links, this gets go again.

### Clash of Agility (pitch 1) — none · [kayo]
- type: Brute / Warrior Action - Attack · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates an Agility token.

### Clash of Might (pitch 1) — none · [kayo]
- type: Brute / Guardian Action - Attack · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates a Might token.

### Clash of Might (pitch 2) — none · [kayo]
- type: Brute / Guardian Action - Attack · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates a Might token.

### Clash of Vigor (pitch 3) — none · [bravo]
- type: Guardian / Warrior Action - Attack · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates a Vigor token.

### Cloud Cover (pitch 1) — none · [briar]
- type: Lightning Instant
- — The next time you would be dealt damage this turn, prevent 3 of that damage.

### Cold Snap (pitch 3) — part · [iyslander]
- type: Ice Action · printed: Go again · granted: Freeze
- — Target hero may pay {r}
- — If they don't, freeze a card in their arsenal or an ally they control until the start of your next turn
- — If Cold Snap is played from arsenal, draw a card
- ▶ Go again
- 🚩 unreviewed keyword: "freeze"

### Compass of Sunken Depths (pitch 0) — none · [gravy]
- type: Pirate Necromancer Equipment - Off-Hand · granted: Go again
- — Instant - {t}: Look at the top card of your deck
- — The first card with watery grave you play from your graveyard each turn gets go again.
- 🚩 tap cost {t} — not enforced (see ledger)
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Concealed Object (pitch 3) — none · [lyath]
- type: Reviled Instant - Item · printed: The Crowd Boos
- — When this enters the arena, the crowd boos you
- — Instant - {t}: Target attack gets +1{p}
- — At the beginning of your end phase, destroy this.
- 🚩 unreviewed keyword: "the crowd boos"
- 🚩 tap cost {t} — not enforced (see ledger)

### Concoct Disorder (pitch 1) — none · [arakni]
- type: Chaos Action - Attack · printed: Go again
- — When this attacks, each hero puts the top card of their deck face-down into their arsenal
- — If 2 or more cards are put into arsenals this way, this gets go again.

### Condemn to Slaughter (pitch 1) — part · [viserai]
- type: Runeblade Action · printed: Go again
- ▶ Your next Runeblade attack this turn gets +3{p}
- — You may destroy an aura you control
- — If you do, each opponent destroys an aura permanent they control
- ▶ Go again

### Condemn to Slaughter (pitch 3) — part · [viserai]
- type: Runeblade Action · printed: Go again
- ▶ Your next Runeblade attack this turn gets +1{p}
- — You may destroy an aura you control
- — If you do, each opponent destroys an aura permanent they control
- ▶ Go again

### Cosmo, Scroll of Ancestral Tapestry (pitch 0) — none · [enigma]
- type: Illusionist Weapon - Scroll (2H) · granted: Go again
- — During your turn, auras you control with ward are weapons with base {p} equal to their ward and Once per Turn Action - {r}: Attack Your aura attacks with one or more +1{p} counters get go again.
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Courageous Steelhand (pitch 1) — none · [boltyn]
- type: Light Warrior Attack Reaction
- — If you've charged this turn, target attack gains +3{p}.

### Crankshaft (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Crankshaft (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost When this is banished from boosting, put a steam counter on a Hyper Driver you control.

### Crash and Bash (pitch 1) — none · [bravo]
- type: Guardian Block
- — When this defends, you may reveal a card with crush from your hand
- — If you do, create a Seismic Surge token.

### Crow's Nest (pitch 0) — none · [azalea]
- type: Ranger Equipment - Quiver · printed: Azalea Specialization
- — Azalea Specialization Whenever an arrow is put face up into your arsenal from your deck, you may pay {r}
- — If you do, put an aim counter on it.

### Crown of Dichotomy (pitch 0) — none · [viserai, briar]
- type: Runeblade Equipment - Head · printed: Arcane Barrier 1
- — Action - {r}, destroy Crown of Dichotomy: Put target Runeblade attack action card and target Runeblade 'non-attack' action card from your graveyard on top of your deck in any order
- — Arcane Barrier 1

### Crucible of Aetherweave (pitch 0) — none · [iyslander, blaze]
- type: Wizard Weapon - Staff (2H)
- — Once per Turn Instant - {r}: The next card you play this turn with an effect that deals arcane damage, instead deals that much arcane damage plus 1.

### Crush the Weak (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, they can't play attack action cards with 3 or less base {p} during their next action phase.

### Cutty Shark, Quick Clip (pitch 2) — part · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- ▶ Action - {r}, {t}: Attack Once per Turn Action - {r}: Your next ally attack this turn gets +1{p}
- — Go again Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)
- 🚩 text mentions go again but no clause parses it

### Danger Digits (pitch 0) — none · [arakni]
- type: Assassin / Ninja Equipment - Arms
- — Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
- — If damage is dealt this way, the dagger has hit
- — Destroy the dagger.

### Dawnblade (pitch 0) — none · [dorinthea]
- type: Warrior Weapon - Sword (2H)
- — Once per Turn Action - {r}: Attack The second time this hits each turn, put a +1{p} counter on it
- — At the beginning of your end phase, if this hasn't hit this turn, remove all +1{p} counters from it.

### Death Dealer (pitch 0) — part · [azalea]
- type: Ranger Weapon - Bow (2H)
- — Once per Turn Action - {r}: If you have no cards in your arsenal, you may put an arrow card from your hand face up into your arsenal
- — If you do, draw a card
- ▶ Go again

### Debilitate (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, their first attack during their next turn gets -2{p}.

### Debilitate (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, their first attack during their next turn gets -2{p}.

### Den of the Spider (pitch 1) — none · [arakni]
- type: Assassin / Warrior Action Defense Reaction - Trap · granted: Mark
- — When this defends an attack with {p} greater than its base, mark the attacking hero.
- 🚩 unreviewed keyword: "mark"

### Disable (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, put a card from their arsenal on the bottom of their deck.

### Display Loyalty (pitch 1) — none · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — If you control 2 or more Draconic chain links, this gets go again and "When this attacks a hero, create a Fealty token."

### Double Cross Strap (pitch 0) — none · [fai]
- type: Ninja Equipment - Chest · printed: Arcane Barrier 1
- — Instant - Destroy this: Gain {r}
- — Activate this only if you've hit 2 or more times this combat chain
- — Arcane Barrier 1

### Drag Down (pitch 1) — none · [lyath]
- type: Generic Defense Reaction
- — When this defends an attack, it gets -3{p}.

### Dragon Power (pitch 3) — none · [fai]
- type: Ninja Action - Attack
- — When this attacks, if it is Draconic, it gets +3{p}.

### Drill Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Piercing 1
- — If Drill Shot has an aim counter, it has piercing 1
- — When this hits a hero, put a -1{d} counter on an equipment they control.
- 🚩 unreviewed keyword: "piercing"

### Dry Powder Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When this is put face-up into your arsenal, it gets +2{p} this turn.

### Duty Bound Blitz (pitch 1) — part · [boltyn]
- type: Light Action - Attack · printed: Go again
- — Play this only if a yellow card has been put into your soul this turn
- ▶ Go again

### Duty Bound Blitz (pitch 2) — part · [boltyn]
- type: Light Action - Attack · printed: Go again
- — Play this only if a yellow card has been put into your soul this turn
- ▶ Go again

### Edict of Steel (pitch 1) — part · [boltyn]
- type: Warrior Action · printed: Sharpen, Go again
- — Sharpen target sword you control
- — If it has 1 or more +1{p} counters, create a Flurry token
- ▶ Go again
- 🚩 unreviewed keyword: "sharpen"

### Emeritus Scolding (pitch 1) — part · [blaze]
- type: Wizard Action
- ▶ Deal 4 arcane damage to target hero
- — If Emeritus Scolding is played during an opponents turn, instead deal 6 arcane damage to them.

### Emeritus Scolding (pitch 2) — part · [blaze]
- type: Wizard Action
- ▶ Deal 3 arcane damage to target hero
- — If Emeritus Scolding is played during an opponents turn, instead deal 5 arcane damage to them.

### Emeritus Scolding (pitch 3) — part · [iyslander, blaze]
- type: Wizard Action
- ▶ Deal 2 arcane damage to target hero
- — If Emeritus Scolding is played during an opponents turn, instead deal 4 arcane damage to them.

### Enclosed Firemind (pitch 0) — none · [bravo]
- type: Guardian Equipment - Head · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Energy Potion (pitch 3) — none · [dorinthea, fai]
- type: Generic Action - Item
- — Instant - Destroy this: Gain {r}{r}

### Enflame the Firebrand (pitch 1) — none · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — When this attacks, if you control 2 or more Draconic chain links, this gets go again, 3 or more, your attacks are Draconic this combat chain, 4 or more, this gets +2{p}.

### Engulfing Light (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Engulfing Light, you may charge your hero's soul
- — If you've charged this turn, Engulfing Light gains "If this hits, put it into your hero's soul."

### Engulfing Light (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Engulfing Light, you may charge your hero's soul
- — If you've charged this turn, Engulfing Light gains "If this hits, put it into your hero's soul."

### Enigma Chimera (pitch 1) — none · [enigma]
- type: Illusionist Action - Attack · printed: Phantasm
- — Phantasm
- 🚩 unreviewed keyword: "phantasm"

### Enigma Chimera (pitch 2) — none · [enigma]
- type: Illusionist Action - Attack · printed: Phantasm
- — Phantasm
- 🚩 unreviewed keyword: "phantasm"

### Entangling Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When this is put face-up into your arsenal, you may {t} target hero.
- 🚩 tap cost {t} — not enforced (see ledger)

### Fault Line (pitch 1) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — If you have a card in your arsenal, this gets +1{p}
- — Crush - When this deals 4 or more damage to a hero, put all cards in all arsenals on bottom of their owner's deck.

### Fender Bender (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost This gets +X{p}, where X is the number of equipment defending it.

### Fire Tenet: Strike First (pitch 1) — part · [fai]
- type: Ninja Action - Attack · printed: Go again
- — When this attacks, your next Draconic attack this combat chain gets +1{p}
- ▶ Go again

### Fire that Burns Within (pitch 1) — part · [fai]
- type: Draconic Action - Attack · printed: Go again
- — When this attacks, you may discard a Phoenix Flame
- — If you do, draw a card and this gets +2{p}
- ▶ Go again

### Flamecall Awakening (pitch 1) — part · [fai]
- type: Draconic Action - Attack · printed: Go again
- — When you attack with Flamecall Awakening, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle
- ▶ Go again

### Flat Trackers (pitch 0) — none · [boltyn]
- type: Brute / Warrior Equipment - Legs · printed: Blade Break
- — Action - Destroy this: Create an Agility token
- — Go again Blade Break
- 🚩 text mentions go again but no clause parses it

### Flatten the Field (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Crush
- — Crush - When this deals 4 or more damage to a hero, destroy a Seismic Surge token they control.

### Fluid Motion (pitch 3) — none · [enigma]
- type: Mystic Action - Attack · printed: Go again
- — If you've created a card this turn, this gets go again.

### Flying High (pitch 3) — part · [viserai, gravy]
- type: Generic Action · printed: Go again · granted: Go again
- — Your next attack this turn gets go again
- — If it's blue, it gets +1{p}
- ▶ Go again

### Frailty Trap (pitch 1) — none · [arakni]
- type: Assassin / Ranger Defense Reaction - Trap
- — When this defends an attack with go again, create a Frailty token under the attacking hero's control.
- 🚩 text mentions go again but no clause parses it

### Full of Bravado (pitch 3) — none · [lyath]
- type: Guardian Action - Attack
- — When this attacks or defends, if you control an aura of suspense, create a Confidence token.

### Fyendal's Fighting Spirit (pitch 1) — none · [iyslander, blaze]
- type: Generic Action - Attack
- — When this attacks or defends, if you have less {h} than an opposing hero, gain 1{h}.

### Garland of Spring (pitch 0) — part · [boltyn]
- type: Generic Equipment - Chest
- — Action - Destroy this: Gain {r}
- ▶ Go again

### Gauntlets of Unity (pitch 0) — part · [dorinthea, boltyn]
- type: Warrior Equipment - Arms · printed: Unity, Temper
- ▶ Unity - When this defends together with a card from hand, this gets +1{d} until end of turn
- — Temper
- 🚩 unreviewed keyword: "unity"

### Glisten (pitch 1) — none · [boltyn]
- type: Light Instant
- — Distribute up to four +1{p} counters among any number of weapons you control
- — At the beginning of your end phase, remove all +1{p} counters from weapons you control.

### Goblet of Bloodrun Wine (pitch 3) — part · [dorinthea]
- type: Warrior Action · printed: Go again
- — Create an Agility and a Vigor token
- ▶ Go again

### Golden Tipple (pitch 1) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, you may discard a yellow card
- — If you do, draw a card and create a Gold token
- ▶ Go again

### Golden Tipple (pitch 2) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, you may discard a yellow card
- — If you do, draw a card and create a Gold token
- ▶ Go again

### Golden Tipple (pitch 3) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, you may discard a yellow card
- — If you do, draw a card and create a Gold token
- ▶ Go again

### Goon Beatdown (pitch 3) — none · [lyath]
- type: Reviled Action - Attack · printed: The Crowd Boos
- — If you control 3 or more auras, this gets +3{p} and "When this hits a hero, the crowd boos you."
- 🚩 unreviewed keyword: "the crowd boos"

### Goon Tactics (pitch 3) — none · [lyath]
- type: Reviled Action - Attack
- — If you control 3 or more auras, this gets +3{p} and "When this hits a hero, destroy the top card of their deck."

### Halo of Illumination (pitch 0) — none · [boltyn]
- type: Light Equipment - Head · printed: Spellvoid 2
- — Instant - {r}, destroy Halo of Illumination: Put a card from your hand into your hero's soul
- — If it's a Light card, draw a card
- — Spellvoid 2

### Helm of Unity (pitch 0) — part · [dorinthea, boltyn]
- type: Warrior Equipment - Head · printed: Unity, Temper
- ▶ Unity - When this defends together with a card from hand, this gets +1{d} until end of turn
- — Temper
- 🚩 unreviewed keyword: "unity"

### High Pitched Howl (pitch 1) — none · [kayo]
- type: Brute Action - Attack
- — When this attacks, if there is a card with 6 or more {p} in your pitch zone, create a Vigor token.

### Hit and Run (pitch 3) — part · [dorinthea]
- type: Warrior Action · printed: Go again · granted: Go again
- — Your next weapon attack this turn gains go again
- — If you have attacked with a weapon this turn, your next attack this turn gains +1{p}
- ▶ Go again

### Hit the High Notes (pitch 1) — none · [viserai]
- type: Runeblade Action - Attack
- — If you've played or created an aura this turn, this gets +2{p}.

### Homage to Ancestors (pitch 3) — none · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- — Legendary Gain 1{h} If you've played another blue card this turn, transcend.
- 🚩 unreviewed keyword: "transcend"

### Hope Merchant's Hood (pitch 0) — none · [dash, fai]
- type: Generic Equipment - Head
- — Instant - Destroy this: Shuffle any number of cards from your hand into your deck, then draw that many cards.

### Hot on Their Heels (pitch 1) — none · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again, Mark
- — If you control 2 or more Draconic chain links, this gets go again and "When this hits a hero, mark them."
- 🚩 unreviewed keyword: "mark"

### Hyper Driver (pitch 1) — none · [dash]
- type: Mechanologist Action - Item
- — This enters the arena with 3 steam counters
- — When it has none, destroy it
- — Once per turn, when you boost a card, remove a steam counter from this and gain {r}.

### Hyper Inflation (pitch 1) — part · [arakni]
- type: Chaos Action - Attack · printed: Go again
- — When this attacks, cards cost {r} more to play this turn
- ▶ Go again

### Ice Eternal (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Iyslander Specialization, Ice Fusion
- ○ Iyslander Specialization Ice Fusion Create X Frostbite tokens under target hero's control
- — Then, if Ice Eternal was fused, deal arcane damage to that hero equal to the number of Frostbites they control.
- 🚩 unreviewed keyword: "ice fusion"

### Inertia Trap (pitch 1) — none · [arakni]
- type: Assassin / Ranger Defense Reaction - Trap
- — When this defends an attack with {p} greater than its base, create an Inertia token under the attacking hero's control.

### Infecting Shot (pitch 1) — part · [azalea]
- type: Ranger Action - Arrow Attack
- — If Infecting Shot has an aim counter, it has +1{p}
- ▶ When this hits a hero, create a Bloodrot Pox token under their control.

### Infecting Shot (pitch 2) — part · [azalea]
- type: Ranger Action - Arrow Attack
- — If Infecting Shot has an aim counter, it has +1{p}
- ▶ When this hits a hero, create a Bloodrot Pox token under their control.

### Ironrot Gauntlet (pitch 0) — none · [dummy]
- type: Generic Equipment - Arms · printed: Blade Break
- — Blade Break

### Ironrot Helm (pitch 0) — none · [dummy]
- type: Generic Equipment - Head · printed: Blade Break
- — Blade Break

### Ironrot Legs (pitch 0) — none · [dummy]
- type: Generic Equipment - Legs · printed: Blade Break
- — Blade Break

### Ironrot Plate (pitch 0) — none · [dummy]
- type: Generic Equipment - Chest · printed: Blade Break
- — Blade Break

### Ironsong Response (pitch 1) — none · [dorinthea]
- type: Warrior Attack Reaction · printed: Reprise
- — Reprise - If the defending hero has defended with a card from their hand this chain link, target weapon attack gains +3{p}.

### Ironsong Response (pitch 3) — none · [dorinthea]
- type: Warrior Attack Reaction · printed: Reprise
- — Reprise - If the defending hero has defended with a card from their hand this chain link, target weapon attack gains +1{p}.

### Jack Be Quick (pitch 1) — none · [briar]
- type: Generic Action - Attack · printed: Go again, Steal
- — When this attacks, you may banish a Nimblism from your graveyard
- — If you do, this gets +1{p} and go again
- — When this hits a hero, {u} an ally they control, then steal it until the end of this action phase.
- 🚩 unreviewed keyword: "steal"
- 🚩 untap {u} — not parsed (see ledger)

### Jittery Bones (pitch 3) — none · [gravy]
- type: Pirate Necromancer Action - Attack · printed: Go again
- — When this attacks, you may discard a card or destroy the top card of your deck
- — If that card has watery grave, this gets go again.

### Jump Start (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — If you control a Hyper Driver, this costs {r} less to play
- — Boost

### Jump Start (pitch 2) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — If you control a Hyper Driver, this costs {r} less to play
- — Boost

### Jump Start (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — If you control a Hyper Driver, this costs {r} less to play
- — Boost

### Knucklehead (pitch 0) — none · [kayo]
- type: Brute Equipment - Head · printed: Kayo Specialization, Temper
- — Kayo Specialization Action - Destroy this: Roll a 6-sided die
- — Until end of turn, your base {i} is the number rolled
- — Temper

### Lair of the Spider (pitch 1) — none · [arakni]
- type: Assassin / Ninja Action Defense Reaction - Trap · printed: Mark
- — When this defends an attack with go again, mark the attacking hero.
- 🚩 unreviewed keyword: "mark"
- 🚩 text mentions go again but no clause parses it

### Lava Burst (pitch 1) — none · [fai]
- type: Draconic Action - Attack · printed: Rupture
- — Rupture - If Lava Burst is played as chain link 4 or higher, it has +3{p}.
- 🚩 unreviewed keyword: "rupture"

### Lead with Speed (pitch 1) — part · [dorinthea]
- type: Brute / Warrior Action · printed: Go again
- ▶ Your next Brute or Warrior attack this turn gets +3{p}
- — Create an Agility token
- ▶ Go again

### Light the Way (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge, Go again
- ○ As an additional cost to play this, you may charge your hero's soul
- — When this hits, if a yellow card was charged this way, this gets go again.

### Light the Way (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge, Go again
- ○ As an additional cost to play this, you may charge your hero's soul
- — When this hits, if a yellow card was charged this way, this gets go again.

### Lightning Press (pitch 1) — none · [briar]
- type: Lightning Instant
- — Target attack action card with cost 1 or less gains +3{p}.

### Lightning Surge (pitch 1) — none · [briar]
- type: Lightning Action - Attack · printed: Go again
- — If this was played from arsenal, it gets go again.

### Limpit, Hop-a-long (pitch 2) — none · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- — Action - {r}, {t}: Attack
- — Go again Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)
- 🚩 text mentions go again but no clause parses it

### Line Crossers (pitch 0) — none · [lyath]
- type: Reviled Equipment - Arms · printed: Blade Break
- — If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you
- — Blade Break

### Look Tuff (pitch 1) — none · [iyslander, enigma, blaze]
- type: Generic Action - Attack
- — When this attacks, it gets -1{p} unless you pay {r}.

### Loot the Arsenal (pitch 3) — none · [gravy]
- type: Pirate Necromancer Action · printed: Go again
- — Your next Pirate ally attack this turn gets "When this hits a hero, destroy a card in their arsenal
- — If you do, create a Gold token." Go again

### Loot the Hold (pitch 3) — part · [gravy]
- type: Pirate Necromancer Action · printed: Go again
- ▶ Your next Pirate ally attack this turn gets "When this hits a hero, they discard a card
- — If they do, create a Gold token." Go again

### Magmatic Carapace (pitch 0) — none · [bravo]
- type: Guardian Equipment - Chest · printed: Guardwell
- — Whenever you play an aura, you may {t} this and pay {r}
- — If you do, create a Seismic Surge token
- — Guardwell
- 🚩 tap cost {t} — not enforced (see ledger)

### Malefic Incantation (pitch 1) — none · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- — Go again This enters the arena with 3 verse counters
- — When it has none, destroy it
- — Once per turn, when you play an attack action card, remove a verse counter from this
- — If you do, create a Runechant token.

### Malefic Incantation (pitch 2) — none · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- — Go again This enters the arena with 2 verse counters
- — When it has none, destroy it
- — Once per turn, when you play an attack action card, remove a verse counter from this
- — If you do, create a Runechant token.

### Mandible Claw (pitch 0) — none · [kayo]
- type: Brute Weapon - Claw (1H)
- — Once per Turn Action - {r}{r}: Attack If you have discarded a card with 6 or more {p} this turn, this card's attacks go again.
- 🚩 text mentions go again but no clause parses it

### Manifest Muscle (pitch 3) — none · [enigma]
- type: Mystic Action - Attack
- — If you've created a card this turn, this gets +1{p}.

### Mark of the Black Widow (pitch 1) — none · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth When this hits a marked hero, they banish a card from their hand.
- 🚩 unreviewed keyword: "stealth"

### Mark of the Black Widow (pitch 3) — none · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth When this hits a marked hero, they banish a card from their hand.
- 🚩 unreviewed keyword: "stealth"

### Mark of the Funnel Web (pitch 1) — none · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth When this hits a marked hero, banish a card in their arsenal.
- 🚩 unreviewed keyword: "stealth"

### Mark of the Huntsman (pitch 0) — none · [arakni]
- type: Assassin Weapon - Dagger (1H) · printed: Mark
- — Once per Turn Action - {r}{r}: Attack
- — Go again When this hits a hero, you may choose to destroy this and mark them
- — If this is attacking a marked hero, this gets +1{p}.
- 🚩 unreviewed keyword: "mark"
- 🚩 text mentions go again but no clause parses it

### Mark the Prey (pitch 1) — none · [arakni]
- type: Assassin Action - Attack · printed: Stealth, Mark
- — Stealth When this hits a hero, mark them.
- 🚩 unreviewed keyword: "stealth"
- 🚩 unreviewed keyword: "mark"

### Mask of the Swarming Claw (pitch 0) — none · [fai]
- type: Ninja Equipment - Head · printed: Arcane Barrier 1, Spellvoid X
- — Arcane Barrier 1 Spellvoid X, where X is the number of chain links you control.

### Memorial Ground (pitch 2) — none · [azalea]
- type: Generic Instant
- — Put target attack action card with cost 1 or less from your graveyard on top of your deck.

### Mocking Blow (pitch 1) — none · [lyath]
- type: Reviled Action - Attack · printed: The Crowd Boos
- — When this attacks a hero, if you have more {h} than them, the crowd boos you
- — If you've been booed this turn, this gets +4{p}.
- 🚩 unreviewed keyword: "the crowd boos"

### Mocking Blow (pitch 2) — none · [lyath]
- type: Reviled Action - Attack · printed: The Crowd Boos
- — When this attacks a hero, if you have more {h} than them, the crowd boos you
- — If you've been booed this turn, this gets +3{p}.
- 🚩 unreviewed keyword: "the crowd boos"

### Mocking Blow (pitch 3) — none · [lyath]
- type: Reviled Action - Attack · printed: The Crowd Boos
- — When this attacks a hero, if you have more {h} than them, the crowd boos you
- — If you've been booed this turn, this gets +2{p}.
- 🚩 unreviewed keyword: "the crowd boos"

### Mounting Anger (pitch 1) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — When Mounting Anger hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- — If you do, it gains +1{p} and you may play it this turn
- ▶ Go again

### Mournful Casket (pitch 0) — none · [gravy]
- type: Necromancer Equipment - Chest · printed: Temper
- — If an ally has been put into your graveyard this turn, this gets +1{d}
- — Temper

### Murderous Rabble (pitch 3) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, reveal the top card of your deck
- — This gets +X{p}, where X is the pitch value of the card revealed this way
- ▶ Go again

### Murkmire Grapnel (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — If Murkmire Grapnel has an aim counter, it has +1{p}
- — Damage that would be dealt by Murkmire Grapnel can't be prevented.

### Night's Embrace (pitch 3) — none · [arakni]
- type: Assassin Attack Reaction
- — Your attacks with stealth get +1{p} this turn.

### Nimblism (pitch 1) — part · [azalea, briar]
- type: Generic Action · printed: Go again
- — The next attack action card with cost 1 or less you play this turn gains +3{p}
- ▶ Go again

### Nimblism (pitch 2) — part · [briar]
- type: Generic Action · printed: Go again
- — The next attack action card with cost 1 or less you play this turn gains +2{p}
- ▶ Go again

### Nip at the Heels (pitch 3) — none · [dorinthea, fai]
- type: Generic Attack Reaction
- — Target attack with 3 or less base {p} gets +1{p}.

### Nullrune Boots (pitch 0) — none · [viserai, bravo, boltyn]
- type: Generic Equipment - Legs · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Nullrune Gloves (pitch 0) — none · [kayo, iyslander, viserai, dash, bravo, dorinthea, gravy]
- type: Generic Equipment - Arms · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Nullrune Hood (pitch 0) — none · [kayo, iyslander, dash, dorinthea, enigma, lyath]
- type: Generic Equipment - Head · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Nullrune Robe (pitch 0) — none · [kayo, bravo, dorinthea, enigma, arakni, boltyn, gravy, lyath]
- type: Generic Equipment - Chest · printed: Arcane Barrier 1
- — Arcane Barrier 1

### Oasis Respite (pitch 1) — part · [dorinthea, enigma, lyath]
- type: Generic Instant
- ▶ Prevent the next 4 damage that would be dealt to target hero this turn by a source of your choice
- — If they have less life than each other hero, they may gain 1{h}.

### On the Horizon (pitch 1) — none · [iyslander, enigma]
- type: Generic Block
- — When this defends, look at the top card of your deck.

### Orb-Weaver Spinneret (pitch 1) — part · [arakni]
- type: Assassin Action · printed: Go again
- — Equip a Graphene Chelicera token
- ▶ Your next attack with stealth this turn gets +3{p}
- ▶ Go again

### Out for Blood (pitch 1) — part · [dorinthea]
- type: Warrior Attack Reaction · printed: Reprise
- — Target weapon attack gains +3{p}
- ▶ Reprise - If the defending hero has defended with a card from their hand this chain link, your next attack this turn gains +1{p}.

### Out Pace (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost This can't be defended by equipment.

### Overblast (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack
- — Overblast gains +X{p}, where X is the number of times you have boosted this combat chain.

### Oysten, Heart of Gold (pitch 2) — none · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- — Action - {t}: Attack When this dies, create a Gold token
- — Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)

### Pass Over (pitch 3) — none · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- — Legendary Banish target card from an opposing hero's graveyard
- — If you've played another blue card this turn, transcend.
- 🚩 unreviewed keyword: "transcend"

### Path of Same Ends (pitch 1) — part · [briar]
- type: Lightning Runeblade Action - Attack · printed: Go again
- — When this attacks a hero, deal 1 arcane damage to them
- — If damage is dealt this way, this gets go again
- ▶ Instant - {r}: This gets go again.

### Phantasmal Haze (pitch 3) — none · [enigma]
- type: Illusionist Action - Attack · printed: Phantasm
- — Phantasm When Phantasmal Haze is destroyed, create a Spectral Shield token.
- 🚩 unreviewed keyword: "phantasm"

### Phoenix Flame (pitch 1) — part · [fai]
- type: Draconic Action - Attack · printed: Go again
- — If you control 2 or more Draconic chain links, this gets +1{p}
- ▶ Go again

### Pick Up the Point (pitch 1) — part · [arakni]
- type: Assassin / Ninja Action - Attack · printed: Go again, Retrieve
- — When this attacks, you may retrieve a dagger from your graveyard
- ▶ Go again
- 🚩 unreviewed keyword: "retrieve"

### Plasma Barrel Shot (pitch 0) — none · [dash]
- type: Mechanologist Weapon - Gun (2H)
- — Once per Turn Action - Remove a steam counter from Plasma Barrel Shot: Attack Action - {r}{r}: If there are no steam counters on Plasma Barrel Shot, put a steam counter on it
- — Go again X is equal to 1 plus the number of times you have boosted this combat chain.
- 🚩 text mentions go again but no clause parses it

### Polar Cap (pitch 1) — part · [iyslander]
- type: Elemental Wizard Action · printed: Ice Fusion
- ▶ Ice Fusion Deal 4 arcane damage to any target
- — If Polar Cap was fused and deals damage to a hero, create a Frostbite token under their control.
- 🚩 unreviewed keyword: "ice fusion"

### Portside Exchange (pitch 3) — part · [gravy]
- type: Pirate Action · printed: Go again
- ▶ Discard a card, then draw a card
- — If a yellow card is discarded this way, create a Gold token
- ▶ Go again

### Pouncing Paws (pitch 0) — none · [fai]
- type: Ninja Equipment - Legs · printed: Battleworn
- — Instant - Destroy this: Create a Crouching Tiger in your banished zone
- — You may play it this turn
- — Battleworn

### Power Play (pitch 3) — none · [lyath]
- type: Guardian Action - Attack
- — If this was played from arsenal, it gets +5{p}.

### Predatory Plating (pitch 0) — none · [kayo]
- type: Brute Equipment - Chest · printed: Guardwell
- — Instant - Destroy this: Gain {r}
- — Activate this only if you control a card with 6 or more {p}
- — Guardwell

### Preserve Tradition (pitch 3) — none · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- — Legendary Put target action card from your graveyard on the bottom of your deck
- — If you've played another blue card this turn, transcend.
- 🚩 unreviewed keyword: "transcend"

### Prey Spotters (pitch 0) — none · [arakni]
- type: Assassin Equipment - Head · printed: Battleworn
- — Attack Reaction - Destroy this: Mark target opposing hero
- — Battleworn

### Prime the Crowd (pitch 1) — part · [lyath]
- type: Generic Action · printed: The Crowd Cheers, The Crowd Boos, Go again
- — The next attack action card you play this turn gets +4{p}
- — The crowd cheers each Revered hero
- — The crowd boos each Reviled hero
- ▶ Go again
- 🚩 unreviewed keyword: "the crowd cheers"
- 🚩 unreviewed keyword: "the crowd boos"

### Pulping (pitch 1) — part · [kayo]
- type: Brute Action - Attack · printed: Dominate, Go again
- — When this attacks, draw a card then discard a random card
- — If a card with 6 or more {p} is discarded this way, this gets dominate
- ▶ If this is defended by fewer than 2 non-equipment cards, it gets go again.

### Pummel (pitch 1) — part · [bravo]
- type: Generic Attack Reaction
- — Choose 1; - Target club or hammer weapon attack gains +4{p}
- ▶ - Target attack action card with cost 2 or more gets +4{p} and "When this hits a hero, they discard a card."

### Puncture (pitch 1) — none · [dorinthea]
- type: Warrior Attack Reaction · granted: Piercing 1
- — Target sword or dagger attack gains +3{p} and piercing 1.
- 🚩 unreviewed keyword: "piercing"

### Puncture (pitch 3) — none · [dorinthea]
- type: Warrior Attack Reaction · granted: Piercing 1
- — Target sword or dagger attack gains +1{p} and piercing 1.
- 🚩 unreviewed keyword: "piercing"

### Put in Context (pitch 3) — none · [dorinthea, enigma]
- type: Generic Defense Reaction
- — This can only defend an attack with 3 or less base {p}.

### Pyroglyphic Protection (pitch 3) — none · [iyslander]
- type: Wizard Action - Aura
- — If your hero would be dealt arcane damage, prevent 1 arcane damage that source would deal
- — At the beginning of your action phase, destroy Pyroglyphic Protection.

### Quick Clicks (pitch 0) — part · [azalea, briar]
- type: Generic Equipment - Legs
- — Action - Destroy this: Your next attack this turn gets go again
- — Activate this only if you've played a Nimblism this turn
- ▶ Go again

### Rally the Coast Guard (pitch 3) — part · [kayo]
- type: Generic Action - Attack
- ▶ Once per Turn Instant - Discard a card: This gets +3{d}
- — Activate this only while this card is defending.

### Ravenous Rabble (pitch 1) — part · [azalea, briar]
- type: Generic Action - Attack · printed: Go again
- — When this attacks, reveal the top card of your deck
- — This gets -X{p}, where X is the pitch value of the card revealed this way
- ▶ Go again

### Raydn, Duskbane (pitch 0) — none · [boltyn]
- type: Light Warrior Weapon - Sword (2H)
- — Once per Turn Action - 0: Attack If you've charged this turn, Raydn gains +3{p}.

### Re-Charge! (pitch 1) — part · [dash]
- type: Mechanologist Action · printed: Go again
- — Put a steam counter on a Hyper Driver you control
- — The next attack you boost this turn gets +4{p}
- ▶ Go again

### Read the Glide Path (pitch 1) — part · [azalea]
- type: Ranger Action · printed: Opt 1, Go again
- ▶ Your next arrow attack this turn gains +3{p}
- — Opt 1 Go again
- 🚩 unreviewed keyword: "opt"

### Reaper's Call (pitch 3) — none · [arakni]
- type: Assassin Action - Attack · printed: Stealth
- — Stealth Instant - Discard this: Mark target opposing hero.
- 🚩 unreviewed keyword: "stealth"

### Reaping Blade (pitch 0) — none · [viserai]
- type: Runeblade Weapon - Sword (2H)
- — Once per Turn Action - {r}: Attack If a hero has more {h} than any other hero, they can't gain {h}.

### Reduce to Runechant (pitch 1) — part · [viserai]
- type: Runeblade Defense Reaction
- — Reduce to Runechant costs {r} less to play for each Runechant you control
- ▶ Create a Runechant token.

### Refraction Bolters (pitch 0) — none · [dorinthea]
- type: Warrior Equipment - Legs · printed: Battleworn · granted: Go again
- — When a weapon you control hits, you may destroy Refraction Bolters
- — If you do, the attack gains go again
- — Battleworn
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Reincarnate (pitch 3) — none · [kayo]
- type: Brute Action - Attack
- — When this is discarded at random, put it on the bottom of its owner's deck.

### Rev Up (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — If you control a Hyper Driver, this costs {r} less to play
- — Boost

### Ridge Rider Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Opt 1
- — If Ridge Rider Shot is put into your arsenal face up, opt 1.
- 🚩 unreviewed keyword: "opt"

### Riggermortis (pitch 2) — none · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- — Action - {r}, {t}: Attack Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)

### Rise from the Ashes (pitch 1) — part · [fai]
- type: Draconic Ninja Action · printed: Go again
- — The next Draconic or Ninja attack action card you play this turn gains +3{p}
- — You may return a Phoenix Flame from your graveyard to your hand
- ▶ Go again

### Rising Resentment (pitch 1) — part · [fai]
- type: Draconic Ninja Action - Attack · printed: Go again
- — When Rising Resentment hits, you may banish an attack action card from your hand with cost less than the number of Draconic chain links you control
- — If you do, it costs {r} less to play and you may play it this turn
- ▶ Go again

### Rising Sun, Setting Moon (pitch 3) — part · [enigma]
- type: Mystic Instant · printed: Legendary, Transcend
- ▶ Legendary Draw a card, then put a card from your hand on the bottom of your deck
- — If you've played another blue card this turn, transcend.
- 🚩 unreviewed keyword: "transcend"

### Roaring Beam (pitch 2) — none · [boltyn]
- type: Light Warrior Attack Reaction · printed: Charge
- — Create a Courage token
- — If there are no cards in your soul, return this to its owner's hand, then charge your soul.

### Rough Up (pitch 1) — none · [kayo]
- type: Brute Action - Attack
- — When this attacks, if there is a card with 6 or more {p} in your pitch zone, this gets +1{p}.

### Run Roughshod (pitch 3) — none · [kayo]
- type: Brute Action - Attack
- — Play this only if you've discarded a card with 6 or more {p} this turn.

### Run Through (pitch 2) — part · [dorinthea]
- type: Warrior Attack Reaction · granted: Go again
- — Target sword attack gains go again
- ▶ Your next sword attack this turn gets +2{p}.
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Rune Flash (pitch 1) — part · [viserai]
- type: Runeblade Action - Attack · printed: Go again
- — This costs {r} less to play for each Runechant token you control
- ▶ Go again

### Runebleed Robe (pitch 0) — part · [viserai]
- type: Runeblade Equipment - Chest · printed: Arcane Barrier 1
- ▶ Instant - Destroy this and a Runechant you control: Prevent the next 1 arcane damage that would be dealt to you this turn
- — Arcane Barrier 1

### Runerager Swarm (pitch 1) — none · [viserai]
- type: Runeblade Action - Attack · printed: Go again
- — If you've played or created an aura this turn, this gets go again.

### Runic Fellingsong (pitch 1) — none · [viserai]
- type: Runeblade Action - Attack
- — When this attacks, you may banish an aura from your graveyard
- — If you do, deal 1 arcane damage to target hero.

### Sadistic Scowl (pitch 1) — part · [lyath]
- type: Reviled Action · printed: Intimidate, Go again
- ▶ Your next attack this turn gets +5{p}
- — Intimidate target hero
- ▶ Go again

### Saltwater Swell (pitch 1) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, reveal the top card of your deck
- — If it's blue, pitch it
- ▶ Go again

### Saltwater Swell (pitch 3) — part · [gravy]
- type: Pirate Action - Attack · printed: Go again
- — When this attacks, reveal the top card of your deck
- — If it's blue, pitch it
- ▶ Go again

### Scar for a Scar (pitch 1) — none · [dorinthea, fai, briar]
- type: Generic Action - Attack · printed: Go again
- — When this is played, if you have less {h} than an opposing hero, it gets go again.

### Scar Tissue (pitch 1) — none · [arakni]
- type: Assassin / Warrior Attack Reaction · granted: Mark
- — Target dagger attack gets +3{p} and "When this hits a hero, mark them."
- 🚩 unreviewed keyword: "mark"

### Scorpio, Comet Tail (pitch 0) — part · [briar]
- type: Lightning Runeblade Weapon - Sword (2H)
- — Action - {t}: Attack
- — Activate this only if you control a Lightning attack
- ▶ When this hits a hero, deal 1 arcane damage to them.
- 🚩 tap cost {t} — not enforced (see ledger)

### Scout the Periphery (pitch 1) — part · [azalea]
- type: Generic Action · printed: Go again
- — Look at the top card of target hero's deck
- — The next attack action card you play from arsenal this turn gains +3{p}
- ▶ Go again

### Scuttle Toes (pitch 0) — none · [gravy]
- type: Necromancer Equipment - Legs · printed: Arcane Barrier 1
- — Instant - {r}{r}, destroy this: {u} target ally you control
- — Destroy it at the beginning of the end phase
- — Arcane Barrier 1
- 🚩 untap {u} — not parsed (see ledger)

### Searing Emberblade (pitch 0) — none · [fai]
- type: Draconic Ninja Weapon - Sword (2H)
- — Once per Turn Action - {r}{r}: Attack If you control 2 or more Draconic chain links, this card's attacks get go again.
- 🚩 text mentions go again but no clause parses it

### Searing Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — If Searing Shot hits a hero, they lose 1{h}.

### Second Strike (pitch 1) — none · [briar]
- type: Lightning Action - Attack · printed: Go again
- — When this attacks, if you've dealt damage this turn, this gets +1{p} and go again.

### Second Tenet of Chi: Wind (pitch 3) — none · [enigma]
- type: Mystic Action - Attack · printed: Go again
- — If you've transcended this turn, this gets go again.

### Seeker's Mitts (pitch 0) — part · [blaze]
- type: Generic Equipment - Arms
- ▶ Instant - {r}, destroy Seeker's Mitts: Prevent the next 1 damage that would be dealt to your hero this turn
- — Opt 1

### Short Shrift (pitch 2) — part · [lyath]
- type: Guardian Action - Attack · printed: Crush
- — If this has {p} greater than its base, it gets +1{p}
- ▶ Crush - When this deals 4 or more damage to a hero, they discard a card.

### Shred (pitch 3) — none · [arakni]
- type: Assassin Attack Reaction
- — Target card defending an Assassin attack gets -2{d} this combat chain.

### Shrill of Skullform (pitch 1) — none · [viserai]
- type: Runeblade Action - Attack
- — If you have played or created an aura this turn, Shrill of Skullform gains +3{p}.

### Shrill of Skullform (pitch 2) — none · [viserai]
- type: Runeblade Action - Attack
- — If you have played or created an aura this turn, Shrill of Skullform gains +3{p}.

### Shrill of Skullform (pitch 3) — none · [viserai]
- type: Runeblade Action - Attack
- — If you have played or created an aura this turn, Shrill of Skullform gains +3{p}.

### Sigil of Silphidae (pitch 3) — none · [viserai]
- type: Runeblade Action - Aura · printed: Go again
- — Go again When this enters or leaves the arena, you may banish another aura from your graveyard
- — If you do, deal 1 arcane damage to target hero
- — At the beginning of your action phase, destroy this.

### Sigil of Suffering (pitch 1) — part · [viserai, briar]
- type: Runeblade Defense Reaction
- ▶ Deal 1 arcane damage to the attacking hero
- — If you have dealt arcane damage this turn, Sigil of Suffering gains +1{d}.

### Silent Stilettos (pitch 0) — none · [enigma]
- type: Illusionist Equipment - Legs · printed: Arcane Barrier 1
- — Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
- — If you do, destroy Silent Stilettos and gain 1 action point
- — Arcane Barrier 1

### Sledge of Anvilheim (pitch 0) — none · [bravo]
- type: Guardian Weapon - Hammer (2H)
- — Action - {r}{r}{r}{r}: Attack

### Smash Instinct (pitch 3) — none · [kayo]
- type: Brute Action - Attack · printed: Intimidate
- — When this attacks, intimidate.

### Snapback (pitch 1) — part · [blaze]
- type: Wizard Action
- ▶ Deal 3 arcane damage to target hero
- — If you have played another Wizard 'non-attack' action card this turn, you may play Snapback as though it were an instant.

### Spears of Surreality (pitch 3) — none · [enigma]
- type: Illusionist Action - Attack · printed: Phantasm, Go again
- — Phantasm Go again
- 🚩 unreviewed keyword: "phantasm"

### Spectral Manifestations (pitch 1) — part · [enigma]
- type: Illusionist Action · printed: Go again
- — Create a Spectral Shield token, then if you control no other Illusionist auras, put three +1{p} counters on it
- ▶ Go again

### Spectral Rider (pitch 3) — none · [enigma]
- type: Illusionist Action - Attack · printed: Overpower, Phantasm
- — When you play Spectral Rider, if you control a Spectral Shield, this gains overpower
- — Phantasm
- 🚩 unreviewed keyword: "overpower"
- 🚩 unreviewed keyword: "phantasm"

### Spellfire Cloak (pitch 0) — none · [iyslander, blaze]
- type: Wizard Equipment - Chest · printed: Arcane Barrier 1
- — Instant - Destroy Spellfire Cloak: Gain {r}
- — Activate this ability only during an opponent's turn
- — Arcane Barrier 1

### Spire Sniping (pitch 2) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — When Spire Sniping is put or turned face up in arsenal, look at the top 2 cards of your deck, then put them back in any order.

### Springboard Somersault (pitch 2) — none · [dorinthea, enigma, boltyn]
- type: Generic Defense Reaction
- — If Springboard Somersault is played from arsenal, it gains +2{d}.

### Stains of the Redback (pitch 1) — none · [arakni]
- type: Assassin Attack Reaction · granted: Go again
- — If the defending hero is marked, this costs {r} less to play
- — Target attack with stealth gets +3{p} and go again.
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Stalker's Steps (pitch 0) — none · [arakni]
- type: Assassin Equipment - Legs · printed: Arcane Barrier 1 · granted: Go again
- — Attack Reaction - Destroy this: Target attack with stealth gets go again Arcane Barrier 1
- 🚩 granted go-again with no parsed grant path
- 🚩 text mentions go again but no clause parses it

### Stand Strong (pitch 0) — none · [lyath]
- type: Guardian Equipment - Legs · printed: Blade Break
- — Action - {r}{r}{r}, destroy this: Create a Confidence token
- — Activate this only if you control an aura of suspense
- — Go again Blade Break
- 🚩 text mentions go again but no clause parses it

### Star Fall (pitch 0) — none · [briar]
- type: Lightning Runeblade Weapon - Sword (2H) · printed: Go again
- — Once per Turn Action - {r}: Attack If you've played a Lightning card this turn, this card's attacks get +1{p} and go again.

### Staunch Response (pitch 1) — part · [bravo]
- type: Guardian Defense Reaction
- ○ As an additional cost to play Staunch Response you may pay {r}{r}{r}{r}
- — If you do, Staunch Response gains +3{d}.

### Steelbraid Buckler (pitch 0) — none · [bravo]
- type: Guardian Equipment - Off-Hand · printed: Temper
- — Temper

### Stir the Aetherwinds (pitch 3) — none · [iyslander]
- type: Wizard Action
- — You may play your next Wizard 'non-attack' action card this turn as though it were an instant and if it has an effect that deals arcane damage, instead that effect deals that much arcane damage plus 1.

### Stonewall Impasse (pitch 0) — none · [lyath]
- type: Guardian Equipment - Off-Hand · printed: Temper, Clash
- — When this defends, clash with the attacking hero
- — If you win, this gets +1{d} until end of turn
- — Temper

### Stroke of Foresight (pitch 1) — part · [dorinthea]
- type: Warrior Attack Reaction · printed: Reprise
- — Target weapon attack gains +3{p}
- ▶ Reprise - If the defending hero has defended with a card from their hand this chain link, draw a card, then put a card from your hand on the top or bottom of your deck.

### Swabbie (pitch 2) — none · [gravy]
- type: Pirate Necromancer Action - Ally · printed: Watery Grave
- — Action - {r}{r}, {t}: Attack Watery Grave
- 🚩 unreviewed keyword: "watery grave"
- 🚩 tap cost {t} — not enforced (see ledger)

### Swift Shot (pitch 1) — none · [azalea]
- type: Ranger Action - Arrow Attack · printed: Go again
- — When this is put face-up into your arsenal, it gets go again this turn.

### Swiftstrike Bracers (pitch 0) — part · [briar]
- type: Generic Equipment - Arms
- ▶ Action - Destroy this: Your next attack this turn gets +2{p}
- — Activate this only if you've played a Nimblism this turn
- ▶ Go again

### Take Aim (pitch 1) — none · [azalea]
- type: Ranger Action · printed: Reload, Go again
- — The next Ranger attack action card you play this turn, gains +3{p}
- — Reload Go again

### Take Flight (pitch 1) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Take Flight, you may charge your hero's soul
- — If you've charged this turn, Take Flight gains go again.
- 🚩 text mentions go again but no clause parses it

### Take Flight (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Charge
- ○ As an additional cost to play Take Flight, you may charge your hero's soul
- — If you've charged this turn, Take Flight gains go again.
- 🚩 text mentions go again but no clause parses it

### Talishar, the Lost Prince (pitch 0) — none · [dash]
- type: Generic Weapon - Sword (2H)
- — Once per Turn Action - {r}{r}, put a rust counter on Talishar, the Lost Prince: Attack At the beginning of your end phase, if Talishar, the Lost Prince has 3 or more rust counters on it, destroy it.

### Talismanic Lens (pitch 0) — none · [azalea, blaze]
- type: Generic Equipment - Head
- — Instant - Destroy Talismanic Lens: Opt 2

### Tearing Shuko (pitch 0) — none · [fai]
- type: Ninja Equipment - Arms · printed: Battleworn
- — Instant - Destroy this: The next Crouching Tiger you play this turn gains +2{p}
- — Battleworn

### Teklo Trebuchet 2000 (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — When this attacks, the next attack you boost this combat chain gets +2{p}
- — Boost

### Test of Might (pitch 1) — none · [kayo]
- type: Brute / Guardian Block · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates a Might token.

### Test of Strength (pitch 1) — none · [enigma]
- type: Generic Block · printed: Clash
- — When this defends, clash with the attacking hero
- — The winner creates a Gold token.

### The Suspense is Killing Me (pitch 3) — none · [bravo, lyath]
- type: Guardian Instant - Aura · printed: Suspense
- — Suspense Your first attack each turn gets +1{p}.
- 🚩 unreviewed keyword: "suspense"

### Throttle (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Throttle (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Throw Caution to the Wind (pitch 3) — none · [gravy]
- type: Pirate Instant
- — Reveal the top card of your deck
- — The next time you would be dealt damage this turn, prevent X of that damage, where X is the pitch value of the card revealed this way.

### Thunder Quake (pitch 3) — none · [bravo]
- type: Guardian Action - Attack · printed: Heave 3
- — Heave 3
- 🚩 unreviewed keyword: "heave"

### Timesnap Potion (pitch 3) — none · [gravy]
- type: Generic Action - Item
- — Action - Destroy this: Gain 2 action points.

### Titan's Fist (pitch 0) — none · [bravo, lyath]
- type: Guardian Weapon - Hammer (1H)
- — Once per Turn Action - {r}{r}{r}: Attack If there is a card with cost 3 or greater in your pitch zone, Titan's Fist has +1{p}.

### Toe the Line (pitch 1) — none · [boltyn]
- type: Warrior Instant
- — The next time you would be dealt damage this turn, prevent 2 of that damage
- — If you prevent damage this way, create a Flurry token.

### Topsy Turvy (pitch 0) — none · [arakni]
- type: Chaos Equipment - Head · printed: Arcane Barrier 1
- — Instant - Destroy this: Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom
- — Arcane Barrier 1

### Trot Along (pitch 3) — part · [viserai, dorinthea]
- type: Generic Action · printed: Go again · granted: Go again
- — Your next attack with 3 or less base {p} this turn gets go again
- ▶ Go again

### Turn to Mindfire (pitch 1) — part · [blaze]
- type: Wizard Action
- ▶ Deal 5 arcane damage to any target
- — If this deals damage, you may {t} your hero
- — If you do, create a Ponder token.
- 🚩 tap cost {t} — not enforced (see ledger)

### Two Sides to the Blade (pitch 1) — none · [arakni]
- type: Assassin Attack Reaction · granted: Mark
- — Choose 1; - Target dagger attack gets +3{p}
- — - Target attack action card with stealth gets +3{p} and "When this hits a hero, mark them."
- 🚩 unreviewed keyword: "mark"

### Under Loop (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost When this hits, put it on the bottom of its owner's deck.

### Unexpected Backhand (pitch 3) — none · [kayo]
- type: Brute Action - Attack
- — When you win a clash revealing this, deal 1 damage to the other hero.

### Unmovable (pitch 1) — none · [enigma]
- type: Generic Defense Reaction
- — If this was played from arsenal, it gets +1{d}.

### Unmovable (pitch 3) — none · [enigma]
- type: Generic Defense Reaction
- — If Unmovable is played from arsenal, it gains +1{d}.

### Up Sticks and Run (pitch 1) — part · [arakni]
- type: Assassin / Ninja Action · printed: Go again, Retrieve
- — You may retrieve a dagger from your graveyard
- ▶ Your next dagger attack this turn gets +4{p}
- ▶ Go again
- 🚩 unreviewed keyword: "retrieve"

### Uphold Tradition (pitch 0) — part · [enigma]
- type: Mystic Illusionist Equipment - Arms · printed: Cloaked, Ward 1
- — Cloaked Instant - {r}, turn this face-up: Put a +1{p} counter on an aura you control with ward
- ▶ Ward 1
- 🚩 unreviewed keyword: "cloaked"

### V of the Vanguard (pitch 2) — none · [boltyn]
- type: Light Warrior Action - Attack · printed: Boltyn Specialization, Charge
- — Boltyn Specialization As an additional cost to play V of the Vanguard, you may charge your hero's soul any number of times
- — Attacks on this combat chain gain +1{p} for each Light card charged this way.

### Valiant Thrust (pitch 2) — none · [boltyn]
- type: Light Warrior Action - Attack
- — If you've charged this turn, Valiant Thrust gains +3{p}.

### Villainous Pose (pitch 1) — part · [lyath]
- type: Reviled Action · printed: Go again, The Crowd Boos
- ▶ Your next attack this turn gets +4{p}
- — The crowd boos you
- ▶ Go again
- 🚩 unreviewed keyword: "the crowd boos"

### Walk in My Shoes (pitch 2) — none · [lyath]
- type: Reviled Guardian Action - Attack · printed: Crush
- — If this has {p} greater than its base, it gets +1{p}
- — Crush - When this deals 4 or more damage to a hero, until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up.

### Waning Vengeance (pitch 1) — part · [enigma]
- type: Mystic Illusionist Instant - Aura · printed: Ward 3
- — When this leaves the arena, if you've pitched a blue card this turn, create a Spectral Shield token
- ▶ Ward 3

### Washed Up Wave (pitch 0) — none · [gravy]
- type: Pirate Necromancer Equipment - Arms · printed: Blade Break
- — When this defends, you may discard a card or destroy the top card of your deck
- — If that card has watery grave, this gets +2{d}
- — Blade Break

### Waxing Specter (pitch 1) — part · [enigma]
- type: Mystic Illusionist Instant - Aura · printed: Ward 3
- — If you've pitched a blue card this turn, this enters the arena with a +1{p} counter
- ▶ Ward 3

### Weave Lightning (pitch 1) — part · [briar]
- type: Lightning Action · printed: Go again · granted: Go again
- — The next Lightning or Elemental attack action card you play this turn gains +3{p}
- — If it's fused, it gains go again
- ▶ Go again

### Wee Wrecking Ball (pitch 2) — none · [lyath]
- type: Guardian Action - Attack · printed: Crush
- — If this has {p} greater than its base, it gets +1{p}
- — Crush - When this deals 4 or more damage to a hero, destroy a card in their arsenal.

### Whisper of the Oracle (pitch 1) — none · [blaze]
- type: Generic Action · printed: Opt 4, Go again
- — Opt 4 Go again
- 🚩 unreviewed keyword: "opt"

### Whisper of the Oracle (pitch 2) — none · [blaze]
- type: Generic Action · printed: Opt 3, Go again
- — Opt 3 Go again
- 🚩 unreviewed keyword: "opt"

### Whisper of the Oracle (pitch 3) — none · [blaze]
- type: Generic Action · printed: Opt 2, Go again
- — Opt 2 Go again
- 🚩 unreviewed keyword: "opt"

### Widowmaker (pitch 2) — none · [azalea]
- type: Ranger Action - Arrow Attack
- — Defense reactions can't be played to Widowmaker's chain link
- — If Widowmaker is defended by fewer than 2 cards, it has +3{p}.

### Wild Ride (pitch 1) — part · [kayo]
- type: Brute Action - Attack · printed: Go again
- — When this attacks, draw a card then discard a random card
- ▶ If a card with 6 or more {p} is discarded this way, this gets go again.

### Wild Ride (pitch 2) — part · [kayo]
- type: Brute Action - Attack · printed: Go again
- — When this attacks, draw a card then discard a random card
- ▶ If a card with 6 or more {p} is discarded this way, this gets go again.

### Wounded Bull (pitch 1) — none · [iyslander, blaze]
- type: Generic Action - Attack
- — When you play this, if you have less {h} than an opposing hero, this gains +1{p}.

### Wreck Havoc (pitch 1) — none · [dorinthea]
- type: Generic Action - Attack
- — Defense reactions can't be played to this chain link
- — When this hits a hero, you may turn a card in their arsenal face up, then destroy a defense reaction in their arsenal.

### Zealous Belting (pitch 1) — none · [bravo]
- type: Generic Action - Attack · printed: Go again
- — While there is a card in your pitch zone with {p} greater than Zealous Belting's base {p}, Zealous Belting has go again.

### Zero to Sixty (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Zero to Sixty (pitch 2) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Zero to Sixty (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Zipper Hit (pitch 1) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Zipper Hit (pitch 2) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

### Zipper Hit (pitch 3) — none · [dash]
- type: Mechanologist Action - Attack · printed: Boost
- — Boost

## Flags on otherwise fully-scripted cards

- **Act of Glory** (pitch 1): unreviewed keyword: "suspense"
- **Aether Quickening** (pitch 3): unreviewed keyword: "surge"
- **Arcanic Shockwave** (pitch 1): unreviewed keyword: "lightning fusion"
- **Battalion Barque** (pitch 1): unreviewed keyword: "high tide"
- **Burn Up // Shock** (pitch 1): unreviewed keyword: "meld"
- **Drop the Anchor** (pitch 1): tap cost {t} — not enforced (see ledger)
- **Edge of Their Seats** (pitch 1): unreviewed keyword: "suspense"
- **Edge of Their Seats** (pitch 3): unreviewed keyword: "suspense"
- **Entwine Lightning** (pitch 1): unreviewed keyword: "lightning fusion"
- **Infect** (pitch 1): unreviewed keyword: "stealth"
- **Open the Flood Gates** (pitch 3): unreviewed keyword: "surge"
- **Rush of Power** (pitch 1): unreviewed keyword: "quickstrike" · text mentions go again but no clause parses it
- **Static Shock** (pitch 1): unreviewed keyword: "lightning flow"
- **Swiftwater Sloop** (pitch 1): unreviewed keyword: "high tide"
- **Swiftwater Sloop** (pitch 3): unreviewed keyword: "high tide"
- **Tension in the Air** (pitch 1): unreviewed keyword: "suspense"

## Fully scripted, no flags — the roll call

Aether Hail (3) · Arcane Twining (3) · Big Blue Sky (3) · Buckwild (1) · Buckwild (3) · Frost Spike (3) · Frosting (3) · Fry (1) · Ice Bolt (1) · Ice Bolt (3) · Illuminate (1) · Lace with Bloodrot (1) · Lace with Frailty (1) · Lace with Inertia (1) · Macho Grande (3) · Mage Master Boots (0) · Mauvrion Skies (1) · Mauvrion Skies (3) · Overpower (1) · Overpower (3) · Photon Splicing (3) · Radiant Touch (0) · Read the Runes (1) · Release the Tension (1) · Ronin Renegade (1) · Salt the Wound (2) · Savage Feast (1) · Sharpen Steel (1) · Sizzle (1) · Snatch (1) · Spellblade Assault (1) · Spellblade Assault (3) · Spike with Bloodrot (1) · Sprout Strength (1) · Strongest Survive (1) · Strongest Survive (2) · Strongest Survive (3) · Vexing Malice (3) · Voltic Bolt (1) · Voltic Bolt (3) · Warrior's Valor (1) · Warrior's Valor (2) · Warrior's Valor (3) · Wax On (1) · Winter's Bite (3) · Yo Ho Ho! (3)
