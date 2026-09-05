# DAWNBLADE POOL AUDIT

Generated 2026-09-05T13:54:47.959Z · app v4.14 · data sage-v13 · db 797 records

## Summary

| | count |
|---|---|
| Unique cards in pool (name\|pitch) | 405 |
| Fully scripted | 384 |
| Partially scripted | 18 |
| Text-only (nothing parsed) | 3 |
| Cards with audit flags | 31 |

## Symbols found in pool text

| symbol | ledger status | cards using it |
|---|---|---|
| `{d}` | live — defense — defBuff ops | 22 |
| `{h}` | live — life | 14 |
| `{i}` | display — intellect — stat display only, no parsed ops use it | 1 |
| `{p}` | live — power / pitch pips — pump parser reads +N{p} and the +1/2/3{p} shorthand | 127 |
| `{r}` | live — resource — costs and gains | 53 |
| `{t}` | live — TAP cost symbol. AUDIT FINDING 2026-07-22: no pool text spells the word 'tap', so tap detection keys on {t} and never on the word. Charged by the ROUTE, per source: an ally's attack (v3.44), a weapon swing (v2.46 weaponCost.taps), an equipment or item ability (tapsToActivate + perTurnCleared), a triggered `you may {t} this` (v3.33), and a HERO's own ability (v3.48). RULING (user, 2026-08-25): a tapped hero cannot be tapped again to pay a cost, and is otherwise unaffected. 14 of the pool's 17 {t} cards enforce it; the 3 that do not have no reader for the ability's PAYLOAD | 13 |
| `{u}` | partial — UNTAP — BUILT v3.47 for Scuttle Toes (`{u} target ally you control`), which buys a second ally attack now that allies tap to attack. Jack Be Quick still refuses: its {u} untaps an OPPOSING ally and then steals it, and nothing models a control change | 2 |
| `{x}` | display — variable X cost (Beckoning Haunt) — no parsed ops | 1 |

## Printed keywords in pool

| keyword | ledger status | cards |
|---|---|---|
| arcane barrier | live — v4.02 — BUILT, and the record was stale by its own definition: `inert-dummy` means 'goes live in Phase 2', and Phase 2 landed at v2.71. arcaneSoaks offers it at the point arcane damage is dealt, on both boards; the trainer's vanilla dummy deals no arcane, which is a fact about that opponent | Achilles Accelerator, Aetherstorm Wellingtons, Arcane Lantern, Bull's Eye Bracers, Crown of Dichotomy, Double Cross Strap, Enclosed Firemind, Mask of the Swarming Claw, Nullrune Boots, Nullrune Gloves, Nullrune Hood, Nullrune Robe, Runebleed Robe, Scuttle Toes, Silent Stilettos, Spellfire Cloak, Stalker's Steps, Topsy Turvy |
| battleworn | live — -1 counter per block, survives at 0 | Beaten Trackers, Blood Scent, Bolt'n Boots, Pouncing Paws, Prey Spotters, Refraction Bolters, Tearing Shuko |
| blade break | live — equipment destroyed after blocking | Carrion Crown, Flat Trackers, Ironrot Gauntlet, Ironrot Helm, Ironrot Legs, Ironrot Plate, Line Crossers, Stand Strong, Washed Up Wave |
| boost | live — per-attack prompt; banish top, Mechanologist grants go again | Big Bertha, Crankshaft, Fender Bender, Jump Start, Out Pace, Rev Up, Teklo Trebuchet 2000, Throttle, Under Loop, Zero to Sixty, Zipper Hit |
| charge | live — v3.70 — BUILT, and the record was stale. fx.chargeCost is parsed, `execute` charges the chosen card into the soul and records hist.charged, and the chargedPitchN conditions resolve; Beaming Bravado, Bolt of Courage, Courageous Steelhand and Engulfing Light all read full. Boltyn's own HERO clause is still unread, which is a separate gap (FINISH.md P1) | Beaming Bravado, Bolt of Courage, Engulfing Light, Light the Way, Roaring Beam, Take Flight, V of the Vanguard |
| clash | live — RULED 2026-07-25: both sides reveal for real, greatest POWER wins, a tie is no winner. Fires when the card DEFENDS, which is how every clash card is printed | Clash of Agility, Clash of Might, Clash of Vigor, Stonewall Impasse, Test of Might, Test of Strength |
| cloaked | partial — v3.99 — build.js equips the piece face-down off the printed reminder line (ENG005: 'Equip this face-down') and the ability's flip cost spends it, so Uphold Tradition's +1{p} counter is the ONE-SHOT it prints. RULED 2026-07-25 and the ruling agrees with the printing: 'EQUIPPED FACE DOWN ... INSTANT ABILITY - ALWAYS ACTIVE - COST 1 RESOURCE - POP UP - SHOW AURAS IN PLAY - SELECT 1 - ADD A +1 ATTACK POWER COUNTER'. ('ALWAYS ACTIVE' is this user's shorthand for the instant WINDOW — they spell it out at length for Spellfire Cloak in the same batch — not a claim the ability repeats; the printed cost includes turning it face-up, which can be paid once.) UNBUILT: 'SHOW CARD BACK ON THE PLAYERS BOARD', a display half deferred with the rest of the UI pass | Uphold Tradition |
| crank | pending — RULED 2026-07-25: the item enters with a steam counter; crank prompts to spend it for an action point. Needs the prompt sheet | Boom Grenade |
| crush | partial — threshold and payload read off each card's own printed rider (v3.16); the two next-turn DEBUFFS built v3.29 and the two RESTRICTIONS v3.30. Partial for one card: Walk in My Shoes halves base {p} and {d} for a turn and has no reader | Boulder Drop, Buckling Blow, Cartilage Crush, Chokeslam, Crush the Weak, Debilitate, Disable, Fault Line, Flatten the Field, Short Shrift, Walk in My Shoes, Wee Wrecking Ball |
| dominate | live — v2.05: the dummy holds cards, so this really does hold it to one blocker from hand | Macho Grande, Pulping |
| go again | live — printed via card_keywords; conditional grants parsed from text (never merged — the Kayo rule) | Aether Quickening, Arcane Seeds // Life, Avast Ye!, Blaze Headlong, Bolt'n' Shot, Booze!, Brand with Cinderclaw, Buckwild, Burn Up // Shock, Call in the Big Guns, Cinderskin Devotion, Cold Snap, Concoct Disorder, Condemn to Slaughter, Display Loyalty, Drop the Anchor, Duty Bound Blitz, Edict of Steel, Enflame the Firebrand, Entwine Lightning, Fire Tenet: Strike First, Fire that Burns Within, Flamecall Awakening, Fluid Motion, Flying High, Fry, Goblet of Bloodrun Wine, Golden Tipple, Hit and Run, Hot on Their Heels, Hyper Inflation, Jack Be Quick, Jittery Bones, Lace with Bloodrot, Lace with Frailty, Lace with Inertia, Lead with Speed, Light the Way, Lightning Surge, Loot the Arsenal, Loot the Hold, Malefic Incantation, Mauvrion Skies, Mounting Anger, Murderous Rabble, Nimblism, Orb-Weaver Spinneret, Path of Same Ends, Phoenix Flame, Pick Up the Point, Portside Exchange, Prime the Crowd, Pulping, Ravenous Rabble, Re-Charge!, Read the Glide Path, Release the Tension, Rise from the Ashes, Rising Resentment, Ronin Renegade, Rune Flash, Runerager Swarm, Sadistic Scowl, Saltwater Swell, Scar for a Scar, Scout the Periphery, Second Strike, Second Tenet of Chi: Wind, Sharpen Steel, Sigil of Silphidae, Sizzle, Spears of Surreality, Spectral Manifestations, Sprout Strength, Star Fall, Swift Shot, Take Aim, Trot Along, Up Sticks and Run, Villainous Pose, Warrior's Valor, Weave Lightning, Whisper of the Oracle, Wild Ride, Winter's Bite, Yo Ho Ho!, Zealous Belting |
| guardwell | live — defense drops to 0 at chain close | Beckoning Haunt, Blade Beckoner Boots, Blade Beckoner Gauntlets, Blade Beckoner Helm, Blade Beckoner Plating, Magmatic Carapace, Predatory Plating |
| heave | live — BUILT v3.32 from the card's printed reminder text (the database carries none): at the arsenal step, with an empty arsenal and N floating, pay N to set it FACE UP and create N Seismic Surge tokens | Thunder Quake |
| high tide | live — a GATED pitchBlueN condition in classifyClause, evaluated in execute's condition loop; all 6 pool records read `full`. Was UNREVIEWED for versions after it was built — v3.69's rule: when a record says a thing is unbuilt, go and ask the engine | Battalion Barque, Swiftwater Sloop |
| ice fusion | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — Iyslander — fusion cost rider | Aether Icevein, Brain Freeze, Ice Eternal, Polar Cap |
| intimidate | live — v2.05: banishes a card from the dummy's hand face-down on attack — a real cost now | Sadistic Scowl, Smash Instinct |
| legendary | info — deckbuilding limit: 1 copy | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| lightning flow | unreviewed — Briar | Static Shock |
| lightning fusion | unreviewed — RULED 2026-07-25 (spec in tools/rulings.json) — Briar — fusion cost rider | Arcanic Shockwave, Entwine Lightning |
| mark | live — RULED 2026-07-25: qualifier only; the marked state now rides on g.dMarked | Hot on Their Heels, Lair of the Spider, Mark of the Huntsman, Mark the Prey |
| meld | live — v3.34 built the whole declaration — isSplit/splitFx/splitCostsAP, the half is chosen before the payment, and judge refuses half:"both" without the keyword. RULED 2026-07-25 (spec in tools/rulings.json) | Arcane Seeds // Life, Burn Up // Shock |
| opt | partial — v4.02 — the NOTE was stale, not the status. The sheet has existed since v2.17: an `opt` op queues a real {tag:"opt"} prompt and the player toggles each looked-at card to the bottom, so 'auto-sorted by advisor value, popup still pending' was false. It stays PARTIAL for the half the ruling names that is genuinely not offered — ordering the cards KEPT on top; `applyPrompt` preserves their printed order. With N=1 that is complete | Aether Spindle, Cindering Foresight, Read the Glide Path, Ridge Rider Shot, Whisper of the Oracle |
| overpower | unreviewed — defense restriction; needs CR wording | Spectral Rider |
| phantasm | live — RULED 2026-07-25: a drawback — one blocker with 6+ printed POWER pops the attack; destroyed, so no go again and no action-point refund | Enigma Chimera, Phantasmal Haze, Spears of Surreality, Spectral Rider |
| piercing | unreviewed — seen in pool; needs CR wording | Drill Shot |
| quickstrike | live — v3.99 — the printed gate ('if this has go again') is read into a hasGa condition and settled in linkPumps beside `pumped`. Was UNREVIEWED while the keyword prefix let the loose pump matcher eat the gate, so all three printings pumped unconditionally | Rush of Power |
| reload | live — v3.69 — the parser rule, the op, the arsEmpty gate and the prompt had all existed for versions and the RECORD was stale. The 1HP237 printing of Take Aim carries the reminder text the database omits: FACE DOWN, a different event from the face-UP put Azalea's arrows trigger on | Bolt'n' Shot, Take Aim |
| reprise | live — RULED 2026-07-25: live since the dummy blocks from hand — counts the non-equipment defenders declared this chain link | Ironsong Response, Out for Blood, Overpower, Stroke of Foresight |
| retrieve | live — RULED 2026-07-25 + the SAR017 PRINTING (v3.53): 'you may retrieve a dagger from your graveyard. (Pay {r} to equip it.)' — a graveyard pick costing {r} whose destination is the GEAR zone. Needed destroyed gear to reach the graveyard first (RULING 2026-08-29, effects.sweepGear) | Pick Up the Point, Up Sticks and Run |
| rupture | live — v3.99 — 'if this is played as chain link N or higher' read into chainLinkGeN, threshold carried in the name, settled in linkPumps. Same prefix defect as quickstrike | Lava Burst |
| sharpen | live — v3.66 — ctrPut{kind:pow,n:1}; the MPW103 PRINTING carries the reminder text the database omits: put a +1{p} counter on the target, remove ALL +1{p} counters from IT at end of turn | Edict of Steel |
| solflare | unreviewed — Boltyn package | Banneret of Salvation |
| specialization | info — hero-locked card (normalized from '<Hero> Specialization') | Crow's Nest, Ice Eternal, Knucklehead, V of the Vanguard |
| spellvoid | partial — v4.02 — the same stale `inert-dummy` as arcane barrier: plain Spellvoid N is offered by arcaneSoaks at the point arcane damage is dealt, on both boards (Halo of Illumination and Spellbane Aegis print it). PARTIAL for the parametrised printing — Mask of the Swarming Claw's 'Spellvoid X, where X is the number of chain links you control' is refused with the rest of the X family, so the piece keeps its printed Arcane Barrier 1 (tools/approx.js: spellvoid-x) | Halo of Illumination, Mask of the Swarming Claw |
| steal | unreviewed — Arakni package | Jack Be Quick |
| stealth | live — RULED 2026-07-25: does nothing alone — a qualifier other cards test for | Art of Desire: Body, Art of Desire: Mind, Infect, Mark of the Black Widow, Mark of the Funnel Web, Mark the Prey, Reaper's Call |
| surge | partial — v3.70 - PARTIAL, and the record said unreviewed. classifyClause reads the Surge dash line into a surgeOverN condition and effects evaluates it; Aether Quickening and Open the Flood Gates both read full. It is partial rather than live because the condition is APPROXIMATED as amp>0 rather than the damage actually dealt - partial counts as built for an upside and never for a drawback (v3.00) | Aether Quickening, Open the Flood Gates |
| suspense | live — RULED 2026-07-25: enters with 2 counters (same on every suspense card), ticks at the beginning of the turn, destroyed at 0 and the `when this leaves the arena` payload fires then | Act of Glory, Edge of Their Seats, Tension in the Air, The Suspense is Killing Me |
| temper | live — -1 per block, destroyed at 0 | Basalt Boots, Gauntlets of Unity, Helm of Unity, Knucklehead, Mournful Casket, Steelbraid Buckler, Stonewall Impasse |
| the crowd boos | live — RULED 2026-07-25: leaves a per-turn booed state; the boo itself does nothing and Reviled is a static talent | Booze!, Concealed Object, Goon Beatdown, Mocking Blow, Prime the Crowd, Villainous Pose |
| the crowd cheers | info — RULED 2026-07-25: Revered is a static talent — nothing to resolve | Prime the Crowd |
| transcend | live — RULED 2026-07-25: the card flips to Inner Chi and returns to hand instead of the graveyard | A Drop in the Ocean, Homage to Ancestors, Pass Over, Preserve Tradition, Rising Sun, Setting Moon |
| unity | live — v3.27 — 'when this defends together with a card from hand'; BOTH walls count their hand defenders before either loop starts, which is the whole of the rule | Gauntlets of Unity, Helm of Unity |
| ward | live — soaks incoming; arcane ward tracked separately (awd) | Uphold Tradition, Waning Vengeance, Waxing Specter |
| watery grave | live — RULED 2026-07-25: Gravy Bones' ability — playable from the graveyard once a blue card has hit it this turn, and a dead ally goes FACE-DOWN so it cannot be replayed | Barnacle, Cutty Shark, Quick Clip, Limpit, Hop-a-long, Oysten, Heart of Gold, Riggermortis, Swabbie |

## Granted keywords in pool (conditional grants — never merged with printed)

| keyword | ledger status | cards |
|---|---|---|
| freeze | live | Cold Snap |
| go again | live | Avast Ye!, Bolt'n Boots, Compass of Sunken Depths, Cosmo, Scroll of Ancestral Tapestry, Flying High, Hit and Run, Mage Master Boots, Mauvrion Skies, Refraction Bolters, Run Through, Stains of the Redback, Stalker's Steps, Trot Along, Warrior's Valor, Weave Lightning |
| mark | live | Den of the Spider, Scar Tissue, Two Sides to the Blade |
| piercing | unreviewed | Puncture |

## Heroes

### Kayo (Brute)
- static: Kayo — one weapon zone (no passive: the generic equipment slot rules already model this)
- static: Kayo — attack actions get +N{p} off the combat chain (a THRESHOLD rule, not a damage buff)
- static: Kayo — first 6+{p} discard per action phase → Might token

### Iyslander (Elemental Wizard)
- static: Iyslander — blue non-attacks from arsenal at instant speed
- static: Iyslander — Ice on opponent's turn → Frostbite
- ⚠ unrecognized: "Essence of Ice"  _(the ability's printed NAME — a heading, not a rule)_
- 🚩 1 hero-text clause(s) not recognized by any ability reader (1 of them the ability's printed NAME, not a rule)

### Viserai (Runeblade)
- static: Viserai — Runeblade after a non-attack → Runechant

### Dash (Mechanologist)
- static: Dash — pregame item (auto-picked; pick UI pending)

### Bravo, Flattering Showman (Guardian)
- hero power: Turn a face-down card in your arsenal face-up [2r]

### Azalea (Ranger)
- hero power: once/turn: Put a card from your arsenal on the bottom of your deck

### Dorinthea (Warrior)
- static: Dorinthea — a weapon that hits may swing again this turn (once per turn; pays {r} and an action point again)

### Fai (Draconic Ninja)
- hero power: once/turn: Return a Phoenix Flame from your graveyard to your hand [3r]
- static: Fai — pregame Phoenix Flame in the graveyard (spliced out of the deck, `_gy` 0)
- static: Fai — the ability costs {r} less per Draconic chain link (no passive: `_dracDiscount` rides on the powCard and `effCost` reads it)

### Enigma (Mystic Illusionist)
- static: Enigma — her first Spectral Shield attack each turn costs {r} less to activate
- ⚠ unrecognized: "Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with a +1{p} counter."
- 🚩 1 hero-text clause(s) not recognized by any ability reader

### Arakni, Web of Deceit (Chaos Assassin)
- static: Arakni — a stealth attack on a marked hero gets +1{p} and an on-hit go again
- static: Arakni — her end phase turns her into a random Agent of Chaos while an opponent is marked

### Blaze, Firemind (Wizard)
- hero power: once/turn: Banish a Wizard non-attack action card from your hand with an effect that deals arcane damage equal to X
- static: Blaze — opt fills the energy pool, by cards LOOKED AT rather than the printed number
- static: Blaze — the banished card is stamped playable-this-turn at instant speed (no passive: it rides on the ability's own pick spec)

### Boltyn (Light Warrior)
- hero power: banish 1 from your soul: Target attack with {p} greater than its base gets go again
- static: Boltyn — charged this turn: attacks get +1{p} while an attack action card defends

### Briar (Elemental Runeblade)
- static: Briar — first attack action card to damage a hero each turn → Embodiment of Earth
- static: Briar — the SECOND non-attack action card each turn → Embodiment of Lightning
- ⚠ unrecognized: "Essence of Earth and Lightning"  _(the ability's printed NAME — a heading, not a rule)_
- 🚩 1 hero-text clause(s) not recognized by any ability reader (1 of them the ability's printed NAME, not a rule)

### Gravy Bones (Pirate Necromancer)
- hero power: destroy a Gold: Draw a card, then discard a card
- static: Gravy Bones — blue-to-graveyard this turn unlocks watery grave (built.wateryGrave, already wired — this recognizer was simply missing)

### Lyath Goldmane (Reviled Guardian)
- hero power: The crowd boos you [2r]
- static: Lyath — booed → Might token
- static: Lyath — every card he controls is dealt at half its printed {p} and {d}, rounded up

## Tokens

- Agility: in database — “At the start of your turn, destroy this, then your next attack this turn gets go again.”
- Bloodrot Pox: in database — “At the beginning of your end phase, destroy this, then it deals 2 damage to you unless you pay {r}{r}{r}.”
- Confidence: in database — “At the start of your turn, destroy this, then the next attack action card you play this turn can't be defended by more than 2 non-block cards.”
- Courage: in database — “When you play an attack action card or activate a weapon attack, destroy this and the attack gets +1{p}.”
- Fealty: in database — “Instant - Destroy this: The next card you play this turn is Draconic.
At the beginning of your end phase, if you haven't created a Fealty token or played a Draconic card this turn, destroy this.”
- Flurry: in database — “When you activate a weapon attack, destroy this and you may attack with the weapon twice this turn.”
- Frailty: in database — “Attack action cards you've played from arsenal and your weapon attacks get -1{p}.
At the beginning of your end phase, destroy this.”
- Frostbite: in database — “Cards and abilities cost you an additional {r} to play or activate.
When you play a card or activate an ability, destroy this.
At the beginning of your end phase, destroy this.”
- Gold: in database — “Action - {r}{r}, destroy this: Draw a card. Go again”
- Graphene Chelicera: in database — “Stealth
Once per Turn Action - {r}: Attack
When this attacks a marked hero, the attack gets go again.”
- Inertia: in database — “At the beginning of your end phase, destroy this, then put all cards from your hand and arsenal on the bottom of your deck.”
- Might: in database — “At the start of your turn, destroy this, then your next attack this turn gets +1{p}.”
- Ponder: in database — “At the beginning of your end phase, destroy this and draw a card.”
- Runechant: in database — “When you play an attack action card or activate a weapon attack, destroy this and deal 1 arcane damage to target opposing hero.”
- Seismic Surge: in database — “At the beginning of your action phase, destroy this, then your next Guardian attack action card this turn costs {r} less to play.”
- Spectral Shield: in database — “Ward 1”
- Vigor: in database — “At the start of your turn, destroy this, then gain {r}.”

## Coverage gaps — every unparsed clause, verbatim

The fix for any of these is always to teach `classifyClause`/`fxParse`, never to special-case the card.

### Beckoning Haunt (pitch 0) — part · [viserai]
- type: Runeblade Equipment - Arms · printed: Guardwell
- — Action - {x}{x}{r}, destroy this: Return target aura with cost X from your graveyard to your hand.
- ○ Guardwell

### Boom Grenade (pitch 1) — part · [dash]
- type: Mechanologist Action - Item · printed: Crank
- — Crank
- ▶ This enters the arena with a steam counter
- — At the start of your turn, destroy this unless you remove a steam counter from it.
- ▶ When a Mechanologist attack action card you control hits a hero, destroy this and deal 4 damage to them.

### Crown of Dichotomy (pitch 0) — part · [viserai, briar]
- type: Runeblade Equipment - Head · printed: Arcane Barrier 1
- — Action - {r}, destroy this: Put target Runeblade attack action card and target Runeblade non-attack action card from your graveyard on top of your deck in any order.
- ○ Arcane Barrier 1

### Danger Digits (pitch 0) — none · [arakni]
- type: Assassin / Ninja Equipment - Arms
- — Attack Reaction - Destroy this: Target dagger you control that isn't on the active chain link deals 1 damage to the defending hero
- — If damage is dealt this way, the dagger has hit
- — Destroy the dagger.

### Drill Shot (pitch 1) — part · [azalea]
- type: Ranger Action - Arrow Attack · printed: Piercing 1
- — If this has an aim counter, it gets piercing 1.
- ▶ When this hits a hero, put a -1{d} counter on an equipment they control.
- 🚩 unreviewed keyword: "piercing"

### Flamecall Awakening (pitch 1) — part · [fai]
- type: Draconic Action - Attack · printed: Go again
- — When this attacks, if you've played another red card this turn, you may search your deck for a Phoenix Flame, reveal it, put it into your hand, then shuffle.
- ▶ Go again

### Glisten (pitch 1) — none · [boltyn]
- type: Light Instant
- — Distribute up to four +1{p} counters among any number of weapons you control.
- — At the beginning of your end phase, remove all +1{p} counters from weapons you control.

### Hope Merchant's Hood (pitch 0) — none · [dash, fai]
- type: Generic Equipment - Head
- — Instant - Destroy this: Shuffle any number of cards from your hand into your deck, then draw that many cards.

### Ice Eternal (pitch 3) — part · [iyslander]
- type: Elemental Wizard Action · printed: Iyslander Specialization, Ice Fusion
- ○ Iyslander Specialization
- ○ Ice Fusion
- — Create X Frostbite tokens under target hero's control
- — Then if this was fused, deal arcane damage to that hero equal to the number of Frostbites they control.
- 🚩 unreviewed keyword: "ice fusion"

### Jack Be Quick (pitch 1) — part · [briar]
- type: Generic Action - Attack · printed: Go again, Steal
- ▶ When this attacks, you may banish a Nimblism from your graveyard
- ▶ If you do, this gets +1{p} and go again.
- — When this hits a hero, {u} an ally they control, then steal it until the end of this action phase.
- 🚩 unreviewed keyword: "steal"
- 🚩 untap {u} — not parsed (see ledger)
- 🚩 text mentions go again but no clause parses it

### Line Crossers (pitch 0) — part · [lyath]
- type: Reviled Equipment - Arms · printed: Blade Break
- — If you have the same {h} as a hero, it also counts as you having more {h} than them, and them having less {h} than you.
- ○ Blade Break

### Oasis Respite (pitch 1) — part · [dorinthea, enigma, lyath]
- type: Generic Instant
- ▶ Prevent the next 4 damage that would be dealt to target hero this turn by a source of your choice
- — If they have less {h} than each other hero, they may gain 1{h}.

### Plasma Barrel Shot (pitch 0) — part · [dash]
- type: Mechanologist Weapon - Gun (2H)
- ○ Once per Turn Action - Remove a steam counter from this: Attack
- — Action - {r}{r}: If this has no steam counters, put a steam counter on it
- ▶ Go again
- — This card's {p} is equal to 1 plus the number of times you've boosted this combat chain.

### Roaring Beam (pitch 2) — part · [boltyn]
- type: Light Warrior Attack Reaction · printed: Charge
- ▶ Create a Courage token.
- — If there are no cards in your soul, return this to its owner's hand, then charge your soul.

### Silent Stilettos (pitch 0) — part · [enigma]
- type: Illusionist Equipment - Legs · printed: Arcane Barrier 1
- — Whenever an attacking ally you control dies or an attack action card you control is destroyed by phantasm, you may pay {r}{r}{r}
- — If you do, destroy this and gain 1 action point.
- ○ Arcane Barrier 1

### Spectral Rider (pitch 3) — part · [enigma]
- type: Illusionist Action - Attack · printed: Overpower, Phantasm
- — When this is played, if you control a Spectral Shield, this gets overpower.
- ○ Phantasm
- 🚩 unreviewed keyword: "overpower"

### Topsy Turvy (pitch 0) — part · [arakni]
- type: Chaos Equipment - Head · printed: Arcane Barrier 1
- — Instant - Destroy this: Until end of turn, if one or more cards would be put on top of a deck, instead they're put on the bottom.
- ○ Arcane Barrier 1

### V of the Vanguard (pitch 2) — part · [boltyn]
- type: Light Warrior Action - Attack · printed: Boltyn Specialization, Charge
- ○ Boltyn Specialization
- ○ As an additional cost to play this, you may charge your soul any number of times.
- — Your attacks this combat chain get +1{p} for each Light card charged this way.

### Walk in My Shoes (pitch 2) — part · [lyath]
- type: Reviled Guardian Action - Attack · printed: Crush
- ▶ If this has {p} greater than its base, it gets +1{p}.
- — Crush - When this deals 4 or more damage to a hero, until the end of their next turn, the base {p} and {d} of attack action cards they control are halved, rounded up.

### Waning Vengeance (pitch 1) — part · [enigma]
- type: Mystic Illusionist Instant - Aura · printed: Ward 3
- — When this leaves the arena, if you've pitched a blue card this turn, create a Spectral Shield token.
- ▶ Ward 3

### Wreck Havoc (pitch 1) — part · [dorinthea]
- type: Generic Action - Attack
- ○ Defense reaction cards can't be played this chain link.
- — When this hits a hero, you may turn a card in their arsenal face-up, then destroy a defense reaction in their arsenal.

## Flags on otherwise fully-scripted cards

- **Aether Icevein** (pitch 1): unreviewed keyword: "ice fusion"
- **Aether Icevein** (pitch 2): unreviewed keyword: "ice fusion"
- **Aether Icevein** (pitch 3): unreviewed keyword: "ice fusion"
- **Arcanic Shockwave** (pitch 1): unreviewed keyword: "lightning fusion"
- **Banneret of Salvation** (pitch 2): unreviewed keyword: "solflare"
- **Bolt'n Boots** (pitch 0): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Brain Freeze** (pitch 3): unreviewed keyword: "ice fusion"
- **Compass of Sunken Depths** (pitch 0): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Cosmo, Scroll of Ancestral Tapestry** (pitch 0): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Display Loyalty** (pitch 1): granted ability in quotes has NO reader: "when this attacks a hero, create a fealty token." — the head parses, this does not
- **Enflame the Firebrand** (pitch 1): text mentions go again but no clause parses it
- **Entwine Lightning** (pitch 1): unreviewed keyword: "lightning fusion"
- **Frailty Trap** (pitch 1): text mentions go again but no clause parses it
- **Jittery Bones** (pitch 3): text mentions go again but no clause parses it
- **Lair of the Spider** (pitch 1): text mentions go again but no clause parses it
- **Light the Way** (pitch 1): text mentions go again but no clause parses it
- **Light the Way** (pitch 2): text mentions go again but no clause parses it
- **Polar Cap** (pitch 1): unreviewed keyword: "ice fusion"
- **Puncture** (pitch 1): unreviewed keyword: "piercing"
- **Puncture** (pitch 3): unreviewed keyword: "piercing"
- **Refraction Bolters** (pitch 0): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Release the Tension** (pitch 1): granted ability in quotes has NO reader: "defense reactions can't be played from arsenal this chain link." — the head parses, this does not
- **Rush of Power** (pitch 1): text mentions go again but no clause parses it
- **Stains of the Redback** (pitch 1): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Stalker's Steps** (pitch 0): granted go-again with no parsed grant path · text mentions go again but no clause parses it
- **Static Shock** (pitch 1): unreviewed keyword: "lightning flow"
- **Swift Shot** (pitch 1): text mentions go again but no clause parses it

## Fully scripted, no flags — the roll call

A Drop in the Ocean (3) · Absorb in Aether (1) · Achilles Accelerator (0) · Act of Glory (1) · Aether Hail (3) · Aether Quickening (3) · Aether Spindle (1) · Aether Spindle (3) · Aetherstorm Wellingtons (0) · Agile Engagement (1) · Agile Windup (3) · Amplify the Arknight (1) · Arcane Lantern (0) · Arcane Polarity (1) · Arcane Seeds // Life (1) · Arcane Twining (3) · Art of Desire: Body (1) · Art of Desire: Mind (3) · Art of the Dragon: Fire (1) · Astral Etchings (1) · Avast Ye! (3) · Back Alley Breakline (3) · Bare Fangs (1) · Bare Fangs (2) · Barnacle (2) · Basalt Boots (0) · Battalion Barque (1) · Beaming Bravado (1) · Beaming Bravado (2) · Bear Hug (3) · Beaten Trackers (0) · Big Bertha (3) · Big Blue Sky (3) · Blade Beckoner Boots (0) · Blade Beckoner Gauntlets (0) · Blade Beckoner Helm (0) · Blade Beckoner Plating (0) · Blaze Headlong (1) · Blood Scent (0) · Blossom of Spring (0) · Bolt'n' Shot (1) · Bolt of Courage (1) · Bolt of Courage (2) · Booze! (3) · Boulder Drop (1) · Boulder Drop (3) · Brand with Cinderclaw (1) · Brand with Cinderclaw (2) · Brand with Cinderclaw (3) · Brothers in Arms (3) · Buckling Blow (1) · Buckling Blow (3) · Buckwild (1) · Buckwild (3) · Bull's Eye Bracers (0) · Burn Up // Shock (1) · Call in the Big Guns (1) · Carrion Crown (0) · Cartilage Crush (1) · Chokeslam (1) · Chokeslam (3) · Cindering Foresight (1) · Cindering Foresight (2) · Cindering Foresight (3) · Cinderskin Devotion (3) · Clash of Agility (1) · Clash of Might (1) · Clash of Might (2) · Clash of Vigor (3) · Cloud Cover (1) · Cold Snap (3) · Concealed Object (3) · Concoct Disorder (1) · Condemn to Slaughter (1) · Condemn to Slaughter (3) · Courageous Steelhand (1) · Crankshaft (1) · Crankshaft (3) · Crash and Bash (1) · Crow's Nest (0) · Crucible of Aetherweave (0) · Crush the Weak (3) · Cutty Shark, Quick Clip (2) · Dawnblade (0) · Death Dealer (0) · Debilitate (1) · Debilitate (3) · Den of the Spider (1) · Disable (3) · Double Cross Strap (0) · Drag Down (1) · Dragon Power (3) · Drop the Anchor (1) · Dry Powder Shot (1) · Duty Bound Blitz (1) · Duty Bound Blitz (2) · Edge of Their Seats (1) · Edge of Their Seats (3) · Edict of Steel (1) · Emeritus Scolding (1) · Emeritus Scolding (2) · Emeritus Scolding (3) · Enclosed Firemind (0) · Energy Potion (3) · Engulfing Light (1) · Engulfing Light (2) · Enigma Chimera (1) · Enigma Chimera (3) · Entangling Shot (1) · Fault Line (1) · Fender Bender (1) · Fire Tenet: Strike First (1) · Fire that Burns Within (1) · Flat Trackers (0) · Flatten the Field (3) · Fluid Motion (3) · Flying High (3) · Frost Spike (3) · Frosting (3) · Fry (1) · Full of Bravado (3) · Fyendal's Fighting Spirit (1) · Garland of Spring (0) · Gauntlets of Unity (0) · Goblet of Bloodrun Wine (3) · Golden Tipple (1) · Golden Tipple (2) · Golden Tipple (3) · Goon Beatdown (3) · Goon Tactics (3) · Halo of Illumination (0) · Helm of Unity (0) · High Pitched Howl (1) · Hit and Run (3) · Hit the High Notes (1) · Homage to Ancestors (3) · Hot on Their Heels (1) · Hyper Driver (1) · Hyper Inflation (1) · Ice Bolt (1) · Ice Bolt (3) · Illuminate (1) · Inertia Trap (1) · Infecting Shot (1) · Infecting Shot (2) · Infect (1) · Ironrot Gauntlet (0) · Ironrot Helm (0) · Ironrot Legs (0) · Ironrot Plate (0) · Ironsong Response (1) · Ironsong Response (3) · Jump Start (1) · Jump Start (2) · Jump Start (3) · Knucklehead (0) · Lace with Bloodrot (1) · Lace with Frailty (1) · Lace with Inertia (1) · Lava Burst (1) · Lead with Speed (1) · Lightning Press (1) · Lightning Surge (1) · Limpit, Hop-a-long (2) · Look Tuff (1) · Loot the Arsenal (3) · Loot the Hold (3) · Macho Grande (3) · Mage Master Boots (0) · Magmatic Carapace (0) · Malefic Incantation (1) · Malefic Incantation (2) · Mandible Claw (0) · Manifest Muscle (3) · Mark of the Black Widow (1) · Mark of the Black Widow (3) · Mark of the Funnel Web (1) · Mark of the Huntsman (0) · Mark the Prey (1) · Mask of the Swarming Claw (0) · Mauvrion Skies (1) · Mauvrion Skies (3) · Memorial Ground (2) · Mocking Blow (1) · Mocking Blow (2) · Mocking Blow (3) · Mounting Anger (1) · Mournful Casket (0) · Murderous Rabble (3) · Murkmire Grapnel (1) · Night's Embrace (3) · Nimblism (1) · Nimblism (2) · Nip at the Heels (3) · Nullrune Boots (0) · Nullrune Gloves (0) · Nullrune Hood (0) · Nullrune Robe (0) · On the Horizon (1) · Open the Flood Gates (3) · Orb-Weaver Spinneret (1) · Out for Blood (1) · Out Pace (1) · Overblast (1) · Overpower (1) · Overpower (3) · Oysten, Heart of Gold (2) · Pass Over (3) · Path of Same Ends (1) · Phantasmal Haze (3) · Phoenix Flame (1) · Photon Splicing (3) · Pick Up the Point (1) · Portside Exchange (3) · Pouncing Paws (0) · Power Play (3) · Predatory Plating (0) · Preserve Tradition (3) · Prey Spotters (0) · Prime the Crowd (1) · Pulping (1) · Pummel (1) · Put in Context (3) · Pyroglyphic Protection (3) · Quick Clicks (0) · Radiant Touch (0) · Rally the Coast Guard (3) · Ravenous Rabble (1) · Raydn, Duskbane (0) · Re-Charge! (1) · Read the Glide Path (1) · Read the Runes (1) · Reaper's Call (3) · Reaping Blade (0) · Reduce to Runechant (1) · Reincarnate (3) · Rev Up (1) · Ridge Rider Shot (1) · Riggermortis (2) · Rise from the Ashes (1) · Rising Resentment (1) · Rising Sun, Setting Moon (3) · Ronin Renegade (1) · Rough Up (1) · Run Roughshod (3) · Run Through (2) · Rune Flash (1) · Runebleed Robe (0) · Runerager Swarm (1) · Runic Fellingsong (1) · Sadistic Scowl (1) · Salt the Wound (2) · Saltwater Swell (1) · Saltwater Swell (3) · Savage Feast (1) · Scar for a Scar (1) · Scar Tissue (1) · Scorpio, Comet Tail (0) · Scout the Periphery (1) · Scuttle Toes (0) · Searing Emberblade (0) · Searing Shot (1) · Second Strike (1) · Second Tenet of Chi: Wind (3) · Seeker's Mitts (0) · Sharpen Steel (1) · Short Shrift (2) · Shred (3) · Shrill of Skullform (1) · Shrill of Skullform (2) · Shrill of Skullform (3) · Sigil of Silphidae (3) · Sigil of Suffering (1) · Sizzle (1) · Sledge of Anvilheim (0) · Smash Instinct (3) · Snapback (1) · Snatch (1) · Spears of Surreality (3) · Spectral Manifestations (1) · Spellblade Assault (1) · Spellblade Assault (3) · Spellfire Cloak (0) · Spike with Bloodrot (1) · Spire Sniping (2) · Springboard Somersault (2) · Sprout Strength (1) · Stand Strong (0) · Star Fall (0) · Staunch Response (1) · Steelbraid Buckler (0) · Stir the Aetherwinds (3) · Stonewall Impasse (0) · Stroke of Foresight (1) · Strongest Survive (1) · Strongest Survive (2) · Strongest Survive (3) · Swabbie (2) · Swiftstrike Bracers (0) · Swiftwater Sloop (1) · Swiftwater Sloop (3) · Take Aim (1) · Take Flight (1) · Take Flight (2) · Talishar, the Lost Prince (0) · Talismanic Lens (0) · Tearing Shuko (0) · Teklo Trebuchet 2000 (3) · Tension in the Air (1) · Test of Might (1) · Test of Strength (1) · The Suspense is Killing Me (3) · Throttle (1) · Throttle (3) · Throw Caution to the Wind (3) · Thunder Quake (3) · Timesnap Potion (3) · Titan's Fist (0) · Toe the Line (1) · Trot Along (3) · Turn to Mindfire (1) · Two Sides to the Blade (1) · Under Loop (1) · Unexpected Backhand (3) · Unmovable (1) · Unmovable (3) · Up Sticks and Run (1) · Uphold Tradition (0) · Valiant Thrust (2) · Vexing Malice (3) · Villainous Pose (1) · Voltic Bolt (1) · Voltic Bolt (3) · Warrior's Valor (1) · Warrior's Valor (2) · Warrior's Valor (3) · Washed Up Wave (0) · Wax On (1) · Waxing Specter (1) · Weave Lightning (1) · Wee Wrecking Ball (2) · Whisper of the Oracle (1) · Whisper of the Oracle (2) · Whisper of the Oracle (3) · Widowmaker (2) · Wild Ride (1) · Wild Ride (2) · Winter's Bite (3) · Wounded Bull (1) · Yo Ho Ho! (3) · Zealous Belting (1) · Zero to Sixty (1) · Zero to Sixty (2) · Zero to Sixty (3) · Zipper Hit (1) · Zipper Hit (2) · Zipper Hit (3)
