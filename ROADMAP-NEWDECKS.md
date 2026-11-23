# ROADMAP — the new precons

Written 2026-11-15 by the CEO thread, at v6.36, on the user's request ("several new decks
have released … make a plan to add all the new decks"). **Status 2026-11-15: the user answered "Yes to all" — both
rulings are given, Phase 0 and Phase 1 are DONE, Phase 2 is next.**

Every number below was measured on 2026-11-15. Re-derive before trusting:
`node tools/newdecks-census.js` (reads `data/staged.js`, no network).

## What has released, and what can be built

| deck | set | street | list | card text |
|---|---|---|---|---|
| Prism, Advent of Thrones | SAT | 2026-09-18 | pinned in `data/newsets.json` | upstream branch `usurp-the-shadow-throne`: every row resolves, with its printing |
| Viserai, Between Worlds | SBW | 2026-09-18 | pinned in `data/newsets.json` | same branch: every row resolves |
| Mortimer, Living Virus | SLV | announced 2027-02 (Outbreak) | none | upstream branch `outbreak` (fa8e6bd, 2026-11-23): 4 SLV cards (hero + 3 tokens), plus a 41-card OBK set |
| α-01, First Cogwarden | SFC | announced 2027-02 (Outbreak) | none | upstream branch `outbreak`: the hero (SFC), plus OBK |

- **The blocker recorded since v4.32 has moved.** `develop` (the branch this project pins
  from) still lists fifteen Silver Age sets. But the-fab-cube now carries both September
  sets, complete, on an unmerged feature branch. `test/drift.test.js` watches `develop`
  only, so it has not fired.
- **Probe 2026-11-23: `docs/OUTBREAK-PROBE.md`** (census, missing readers in build order, hosts). OBK holds both heroes
  again plus Azalea, Huxley, Min, Vyle; whether the precon lists use OBK cards is unknown until they publish.
- **The Outbreak pair is not buildable**: no deck lists exist and the text is a handful of
  spoilers. They stay a probe, as the September pair was.
- **No environment change is needed today.** `raw.githubusercontent.com` (card text) and
  `rules.fabtcg.com` (the CR, whose keyword section already defines Usurp, Traverse, Awaken,
  Phantasm, Spectra, Ward, Spellvoid, Blood Debt) are both reachable. `fabrary.net`, where
  the September lists were read, is blocked: it will be needed when the Outbreak lists
  publish, and that is the day to ask for it.

## How far each deck is from playable

`fxParse` over each list, against the branch text (rows by tier; a "full" row can still
hide a keyword with no reader, so read this as a floor on the work, not a ceiling):

- **Viserai, Between Worlds** — 12 full / 14 part / 9 none; 19 names not in the pool.
  Missing readers, in build order:
  1. **DONE v6.37** — play a card from the banished zone ("You may play this from your
     banished zone"; `test/banroute.test.js`). The route was already built (`playZoneWhy`,
     `fx.fromBan`); only the clause was unread. The soul zone also already exists (Boltyn).
  2. **DONE v6.38** — Blood Debt (end-phase life loss while it sits in banish; `parser.bloodDebt`,
     `effects.beginEndPhase` step (6a), `test/blooddebt.test.js`)
  3. **DONE v6.39** (`parser.usurps`, `effects.execute`, `test/usurp.test.js`) — Usurp (in the keyword section of the rules: an additional cost that destroys a Runechant, +2 power, and the
     "usurped" fact other cards ask about)
  4. **DONE v6.40** (`banTop`, `optCost.classRiders`, `test/banishif.test.js`) — "banish the top card of your deck / if it's red|blue" and "banish a card from your
     hand / if it's Runeblade|Shadow" conditionals, and Corrupted Crown's "if you do"
  5. **DONE v6.41** (`RX_BAN_PLAY`, `test/gate.test.js`) — the Gate to i'Arathael token and its grant (a declared target in the
     banished zone, stamped playable this turn; the token record was already in the pinned pool)
  6. **DONE v6.42** (`fx.countsAs`, `parser.usurpOffer`, `effects.payDestroyed`, `test/runechants.test.js`) — the special
     Runechants ("counts as a Runechant", CR 1.8.8; "when an attack usurps this"; usurp asks which Runechant)
  7. **DONE v6.44** (`effects.traverse`, `build.facesOf`, `effects.runesMade`, `test/traverse.test.js`) — the hero: a
     trigger on creating Runechants, a per-turn count, and **traverse** — the hero is double-faced (Viserai, Usurper on
     the back, a Demon with its own text). Census after: no gap, both faces. Life carries over on a traverse (a stated
     reading, `tools/approx.js` `traverse-life-carries`)
  8. **DONE v6.43** (`hist.attacked` / `heroDmg` / `banPlay`, `fx.banCost` + the `bancost` pending,
     `test/conditionals.test.js`) — the small conditionals (attacked twice this turn, dealt damage to
     the defending hero this turn, played from banish this turn, "they banish a card in their arsenal",
     an optional graveyard banish as an additional cost). Census after: 35 full / 0 part / 0 none; only
     the hero (7) is left. Owed: Olde Leather Boots cannot be declared (0{d}, `tools/approx.js`
     `zero-defence-gear-refused`)
- **Prism, Advent of Thrones** — 32 full / 0 part / 0 none (2026-11-19; was 21 / 4 / 7). OPENED v6.47: every name is in the pool.
  Missing readers: the **soul** (a new zone: `sides.js`, `invariants.js` census, `view.js`
  visibility), Herald-named triggers, figments and **Awaken** (double-faced cards in the
  arena), auras that are weapons during the action phase, Phantasm, Spectra, Ward,
  Spellvoid, "loses and can't gain", power reductions while defending, marked.

Viserai goes first: he reuses the Runechant machinery the pool already has, and his
banish and double-face work is smaller than Prism's new zone.

## The phases (one reader per release, as always)

**Phase 0 — rulings. DONE (2026-11-15).** `data/formats.json` (`dawnblade.growth`),
`test/formats.test.js`, CLAUDE.md's format paragraph.

**Phase 1 — pin the text. DONE (2026-11-15), and differently from the first draft.**
- The text is NOT in `data/pool.js`. It is staged in `data/staged.js`, written by
  `tools/pin-staged.js` from one upstream COMMIT (recorded in the tool and in
  `data/newsets.json`'s `staged` block), held by `test/staged.test.js`.
- Why: the pool is what the phone plays and what every pool-wide census counts. Cards
  nobody can be dealt do not belong on the phone, and they would have moved those counts.
  So this step changed no page, no `DATA_VER` and no server function: it is not a release.
- The day a hero opens, its `DECKS` entry makes `pin-pool.js` reach its cards by name.
  `pin-pool.js` reads `develop` only today, so that release must teach it to take a
  record `develop` lacks from the staged file. That is the release with the `DATA_VER` bump.
- `drift.test.js`'s probe still watches `develop`: when upstream merges, it says to diff
  the staged text against the merged text before anything else.
- Readers are built and drilled against staged records (`require("../data/staged.js")`).
- Found while staging: the token-name scan reads "Gate to i'Arathael token" as
  "arathael" (held as a probe in `test/staged.test.js`); reader 5 must read the whole name.

**Phase 2 — Viserai, Between Worlds. OPENED v6.46** (`pin-pool.js --add-staged`, `HEROES`/`DECKS` key `viseraibw`, DATA_VER sage-v18; the AI pilots him poorly: see CHANGELOG v6.46). The eight readers above, each its own release with
a drill that bites, a scene, fairness, and a CR quote in the source. The hero stays out of
the loadout until the census prints no gap for his list and 630 self-play games with him
seated show 0 refusals, 0 violations, 0 stalls. Then: `DECKS`/`HEROES` entry, art path,
the AI seat's policy keys (measured per CLAUDE.md), and the release that opens him.

**Phase 3 — Prism, Advent of Thrones. OPENED v6.47** (`pin-pool.js --add-staged`, which now also
brings a flip-card's back (Suraya, Archangel of Endless Hope, SAT023); `HEROES`/`DECKS` key `prism`,
DATA_VER sage-v19; the gate: `node tools/staged-play.js prism 20` = 640 games, 0 refusals / violations /
stalls / draws, 281 won). She opens for people AND as an AI seat (decision 2026-11-19: she wins 44%
without awakening). **Next H-item: the AI never awakens a figment** (it holds Figment of Hope as an
instant and never pays Prism's {r}{r} Awaken; nor does it ever target a Spectra aura). Started 2026-11-17 (user: "move along to prism";
the AI-policy work for Viserai is on the back burner). The soul zone already exists (Boltyn's
`soul`, `soulSelf`, `soulSpend`), so the order is by what stands on what:
  1. **DONE (unreleased)** — "put it into your soul and <rider>" (`classifyClause`'s split,
     `test/herald.test.js`). Found by the census: three Heralds were `full` with the soul half
     dropped, and Herald of Judgment `full` with its rider dropped (now `part`, honest).
  2. **HALF DONE (unreleased)** — "with Herald in its name" is a qualifier atom (`attackTail` `named`,
     `qualMatches`; Angelic Wrath driven in `test/herald.test.js`). Luminaris' "angel attack or attack
     action card with Herald in its name" still refuses (the or-group plus a tail). The hero's
     trigger is DONE (2026-11-18): `build` `soulNamedTrig`, `effects.soulEntered` at all three soul
     writers (charge cost, ascend on hit, answered pick); the deck search reads "put it into the
     arena" (`to: "arena"`, filed by its own permanent kind) and "a figment" (`ty`).
  3. **MOSTLY DONE (unreleased)** — a figment resolves into the arena as a permanent (CR 8.2.16;
     `types` PERMANENT_SUBTYPES, `fx.perm` "figment"); Prism's "{r}{r}, banish a card from Prism's
     soul: Awaken target figment you control" builds (`parseHeroPower` pips + named soul) and
     awakens it into Suraya (`effects.awaken`, `build.flipBackOf`, `fx.onAwaken`); the front is
     filed when it leaves (`parser.offArenaFace`, invariant BACK-FACE-OFF-ARENA);
     `test/figment.test.js`. The hero's Herald-to-soul search and Suraya as an ally ("{r}{r}: Attack",
     Ward 4; the readers already answered) are DONE and driven (2026-11-18). LEFT: the AI never awakens. Was:
     "search your deck for a figment, put it into the arena" (Figment of Hope, an
     Instant - Figment) and **Awaken** (the hero's instant; the back face is Suraya, Archangel of
     Endless Hope, sharing print code SAT023 — `build.facesOf`'s pattern, for a non-hero).
  4. **DONE (unreleased, 2026-11-18)** — Iris of Reality: `parser.auraWeaponGrant` reads a class
     subject, a printed base {p} and the quoted go again beside Cosmo's ward grant (`test/iris.test.js`).
  5. **DONE (unreleased, 2026-11-19)** — Spectra (CR 8.3.14): a Spectra permanent is an
     attack-target (`game.attackTargets`' `attackable` predicate, judge `ATTACKABLE`); targeting
     it destroys it (`effects.spectraStrike`) and the attack is cleared, CR 7.2.2c (no attack
     event, no link, the chain closes); the trigger resolves at once (`tools/approx.js`
     `spectra-trigger-at-once`, stated; the trainer offers no targets). "Loses and can't gain
     phantasm": Passing Mirage's board static (`fx.firstLoseKw`) and Dream Weavers' one-shot
     (`buffNext` rider `loseKw`) land on `pend.loseKw`, read at the pop. Pierce Reality's
     `fx.firstPlayBuff`. "First … each turn" reads `hist.atkTy` (this turn's declared attacks).
     `test/spectra.test.js`, `test/phantasmlose.test.js`. The AI never targets a Spectra aura.
  6. **DONE (unreleased, 2026-11-19)** — Herald of Triumph's `fx.defAtkPow` and Herald of
     Victoria's `foeAtkBuff` (a `def` entry on the opponent's `atkBuff`): `linkPumps` while
     attacking, the phantasm pop while defending (the only reader of a defender's power).
     `test/heraldminus.test.js`.
  7. **DONE (unreleased, 2026-11-19)** — Lay Low (`playIf` `notMarked`; `markedFoeNext` on the
     attacking hero's `buffNext`); Herald of Judgment's lock (`foeNextTurn` `noBanPlay`, read by
     `nextTurnBars` with the zone, both boards); Luminaris' or-group target (`{any: [...]}` in
     `qualMatches`, refused by `playTargetWhy` without a matching attack). Silent Stilettos was
     already built (v4.52). `test/laylow.test.js`, `test/luminaris.test.js`. Census: 32 full /
     0 part / 0 none. LEFT: the AI never awakens (the next H-item, above). 640 seated games and the
     opening: DONE v6.47.

**Phase 4 — Outbreak (2027-02).** When the lists publish: ask for `fabrary.net`, pin the
lists into `data/newsets.json`, run the census, extend this file.

## Asked of the user — ANSWERED "Yes to all" (2026-11-15)

1. **The format.** Dawnblade was declared FROZEN at fifteen (2026-09-26). Adding decks
   changes that declaration. Proposed wording: "the pool is every Silver Age precon this
   project has built, as printed; it still ignores Silver Age's ban list and hero bench."
   Two Viserais would both be legal heroes.
2. **The source.** Pin the September text from upstream's unmerged branch now (recommended:
   the text is the printed cards', and the drift drill will catch any change at the merge),
   or wait for the merge into `develop` (no date known; it has been two months).

## What this plan does not promise

Dates. The fifteen took the engine from v1 to v6; each reader above is a release. Viserai
is roughly eight to twelve releases, Prism more.
