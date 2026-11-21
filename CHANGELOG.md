## v6.48 — every chain link says what became of it; the hero select shows the art

- **Hit, blocked or prevented, on the board (UX roadmap step 5, second half).** A resolved chain entry carries `out` — `"hit"` (damage was
  dealt), `"blocked"` (the wall stopped all of it) or `"prevented"` (damage got past the wall and a prevention took it all, CR 7.5.5) — from
  `effects.linkOutcome`, the one body: judge's strike, the trainer's own strike and the dummy's swing all feed it the numbers they already
  held (power, what got past the wall, what was dealt). The featured slot stamps the card that just resolved (red HIT n, bone BLOCKED, blue
  PREVENTED; `LinkStamp`, only while the slot still shows that link — `featOutcome`), and the chain tiles dim a blocked link and ring a
  prevented one blue. **WIRE_V 44 -> 45** (a chain entry gained a field). Drill: test/linkout.test.js (self-play at the table checks every
  new attack entry against the damage dealt and must see both a hit and a block; sabotaged twice).
- **The hero select (UX roadmap step 4).** Roster tiles show the illustration, not the whole card (zoomed past the frame and the printed
  name); names 10.5px, and a name the tile cannot hold shows its first word ("Lyath"). A picked hero gets a banner right under the roster —
  art, class and block with the block's colour, the name, the one-line pitch — where before the only sign was a gold outline and the sheet
  sat below the fold. The legend names every group on the roster (Usurp the Shadow Throne had no key). Kept at 6 across, not the roadmap's
  4: at 4 across Battle falls off the first screen at 393x852. Before/after: `docs/ux/before-heroselect.jpg`, `after-heroselect*.jpg`,
  `after-linkstamp.jpg`.

## v6.47 — Prism, Advent of Thrones opens; a new result screen, life display and hand rail

- **The seventeenth hero.** Prism, Advent of Thrones joins the roster (key `prism`), under the RULING (user, 2026-11-15) that a
  precon joins when the engine reads its whole list: the census reads 32 full / 0 part / 0 none. Gate: `node tools/staged-play.js prism 20`,
  640 seated games, 0 refusals / violations / stalls / draws, 281 won.
  Opening: `pin-pool.js --add-staged` (27 records, and it now brings a flip-card's back: Suraya), **DATA_VER sage-v18 -> sage-v19**, SAT a
  Silver Age set, `data/formats.json`. The pool census pins that moved were each read and noted in their drill (40 of them).
- **Readers built for her (one release, user's plan of 2026-11-18):** "put it into your soul and <rider>" is two ops; "with Herald in its
  name" is a qualifier; figments enter the arena as permanents (CR 8.2.16) and Prism's ability awakens one into Suraya (CR 8.5.43, 9.1.3;
  the front is filed off the arena, invariant BACK-FACE-OFF-ARENA); her Herald-to-soul trigger searches for a figment; Iris of Reality's aura
  grant; **Spectra** (CR 8.3.14, quoted): a Spectra permanent can be attacked, and attacking it destroys it and closes the chain
  (`effects.spectraStrike`; stated approximation `spectra-trigger-at-once`: no stack layer of its own); "loses and can't gain phantasm"
  (Passing Mirage, Dream Weavers); Pierce Reality's first-Illusionist-attack +2{p} (`hist.atkTy`); -1{p} while defending (Herald of Triumph)
  and Herald of Victoria's discard; Lay Low; Herald of Judgment's banished-zone lock (both boards); Luminaris' or-group.
  **Ironhide Gauntlet** (her arms) read `full` but dropped its quoted "When the combat chain closes, destroy this." (an unanchored +N{d}
  matcher): stronger than printed. Now `breakAtClose`; the pay answer marks the piece and `game.gearBlockApply` destroys it on both boards
  (test/ironhide.test.js, sabotaged twice). Drills: herald, figment, iris, spectra, phantasmlose, heraldminus, laylow, luminaris — each sabotaged.
- **The AI never awakens a figment** (next H-item). She still wins 44% of seated games, so she opens as an AI seat as well as for people.
- **The cup past sixteen heroes** (CEO default, for the user to overrule): every hero plays the qualifier; the bracket seats its top sixteen
  and prints who did not qualify.
- **The screen (docs/ux/UX-ROADMAP.md, before/after shots in docs/ux/):** one result screen for every ending on both boards (`EndPanel`:
  opaque, tinted by outcome, a large headline, life left, a full-width leave button); `LifeHud` shows both life totals at 30px with labelled
  action-point and resource chips, and every life total flashes red/green when it moves (`LifeNum`); buttons answer a press; the hand rail
  says how many cards are off-screen (`RailMore`); your board's bottom pills stay inside the pane on short phones; the loadout has ONE primary
  button, named for the foe you picked (it used to start the trainer even with an AI hero picked).
- **Cheaper sessions:** `npm run quick` (the inner loop; skips the server-referee family, ~60% of the suite's CPU); `node tools/supabase-deploy.js`
  (cut, deploy, stamp in one command); CHANGELOG.md keeps v6.30 on (older in `docs/archive/CHANGELOG-to-v6.29.md`); QUEUE.md's history moved to
  `QUEUE-ARCHIVE.md` on findings/queue.
- The roster legend counts its heroes (it said 15) and the format note no longer says "the fifteen precons".
- **Validation:** npm test 0 fail / 5 skipped; scenes 107/0; fairness clean; audit 455/455 full (baseline rewritten after reading);
  ladder `npm run play '' '' 3` = 816 games (17 heroes), 0 refusals / violations / stalls / draws, Prism 39 wins; `staged-play prism 20` =
  640 games, 0 / 0 / 0; page.js 78/78 + a drive with Prism seated (0 page errors, no sideways scroll); both babel blocks compile.
  No WIRE_V change (`hist.atkTy` rides inside `hist`; a gear piece's `brk` is a per-instance diff). The function is redeployed.

## v6.46 — Viserai, Between Worlds opens

- **The sixteenth hero.** The Usurp the Shadow Throne precon joins the roster (`HEROES`/`DECKS` key `viseraibw`, the list exactly as
  `data/newsets.json` pins it), under the RULING (user, 2026-11-15) that a precon joins when the engine reads its whole list. The census
  printed no gap for it, both hero faces included (v6.37-v6.45). The loadout names his block, "Usurp the Shadow Throne", instead of a
  chapter (`blk`; `ch: 4` only picks the stripe colour).
- **Two Viserais on one roster.** Every hero label cut the name at its comma, so both tiles read "VISERAI". One helper, `heroShort(h)`
  (`index.html`), reads an optional `short` and falls back to the old cut; his is "Viserai BW". Driven at 393x852: the tile, its SBW001 art,
  the block's stripe, the sheet, the decklist, the loadout's weapons and 18 trainer taps with him seated, 0 page errors, no sideways scroll.
- **The pool:** `node tools/pin-pool.js --add-staged` (new) adds the staged records the decks now need, and the other face of a needed
  hero, keeping every other record byte for byte: 27 records (797 -> 824), no live download, so no unreviewed upstream drift rode along.
  A full re-pin takes a needed name `develop` lacks from `data/staged.js` too. **DATA_VER sage-v17 -> sage-v18.** `cards.SA_SETS` gains SBW.
  `data/formats.json` fields him; `tools/silver-age.js` rederived (no new ban).
- **A bug found by dealing him:** Murmuring Gloomblade prints "When this attacks or hits, create a Runechant token" and only the hit half was
  read, so the attack made nothing (weaker than printed). Two occasions, one payload: the "enters or leaves" precedent (`alsoAtk`, the attack
  half on `fx.onAtk` at declaration). Drilled in `test/runechants.test.js`, sabotaged.
- **The keyword ledger** (`tools/ledger.js`) knows Blood Debt, Usurp and Traverse (each live, CR cited).
- **The audit** (`npm run audit`: 430 unique cards, all `full`) read his cards with two old blind spots, both fixed in the tool: its token
  scan still cut "Gate to i'Arathael" to "Arathael" (the pinner's v6.41 pattern now), and its go-again check looked only at the four
  top-level lists, so a go again carried on a cost's rider or a trigger's own list read as unparsed. Walking the whole parse cleared those
  and six OLDER false flags (Jack Be Quick, Jittery Bones, Light the Way x2, Refraction Bolters, Swift Shot), each checked: the `ga` sits
  on the clause that prints it. Flagged cards 13 -> 7. Baseline rewritten after reading the diff.
- **The AI's answer to the traverse sheet has its own reasons**, `traverseStay` / `traverseBack` (`judge.traverseOffer` names the modes; the
  AI reads no card text). Measured: turning back won 15 of 180 seated games and staying 17, noise, so it stays (gate `SPXTRAV`, off unless
  it names a seat).
- **HE IS A WEAK AI OPPONENT** (a person piloting him is unaffected): seated in self-play he wins about one game in nine. Measured, it is not
  the engine (the deck reads `full`, card by card) and mostly not sequencing (66% of his usurp attacks find a Runechant): his printed attacks
  average 2.6 power (the old Viserai's 3.6, Kayo's 5.6) and the deck lives on combos the rule policy does not plan. Policy work, queued.
- **The cup:** sixteen heroes now fill the bracket, so the dummy (seated by the 2026-08-16 ruling because fifteen heroes left a seat empty)
  enters only while the roster is short. **Self-play:** `npm run play '' '' 3` is 720 games now.
- **Repins, each read first and noted in place:** roster and deck counts, the pool size and type census, the journeys, the condition, fx,
  spec-field, on-hit, defends, hand-ability, tier, trigger and dead-reader censuses (each addition one of the readers built for his staged
  cards), the anchors' four "staged only" entries (reached now), the new-sets drills (turned to "in the pool exactly when its hero opened",
  plus a check that his deck IS the pinned list), the feed-leak drill (a DISCARD is a reveal: the sixteenth hero re-paired its games and a
  discarded Reincarnate going to the deck bottom read as a leak).
- No WIRE_V change. The function must be redeployed (`APP_VER`, `DATA_VER`, engine and data files).

## v6.45 — a 0 defence piece may defend; a blank one may not

- **RULING (user, 2026-11-16):** "0 defense can be declared as a blocker (blank cannot)". CR 7.3.2b (verbatim): "A card cannot be declared if (A) it does not
  have the defense property (0 is a value), ...". CR 2.3.2: "0 is a valid printed defense"; a card with no printed defence has no defence property.
- **Was:** both boards refused any equipment at 0 defence, printed or worn ("has no defence left"), so 27 dealt 0{d} pieces could never defend and the staged
  Olde Leather Boots' "+2{d} if attacked twice" was unreachable. **Is:** one reader, `game.gearDeclareWhy`, called by `judge.legal` and the trainer's
  `toggleBlock`, `gearBtn` and defend list: refuses a piece that prints no defence (a weapon, a blank equipment: 6 pool pieces) and a destroyed piece, nothing else.
  A piece worn down to 0 may be declared again too (it stops nothing, and Blade Break / battleworn still apply).
- **The AI did not move.** Its wall still picks only pieces with defence above 0, so it never throws a 0 piece in (drilled). It therefore never raises the
  Boots for their +2 either: policy work for when Viserai is an AI seat.
- **`tools/approx.js` `zero-defence-gear-refused` is CLOSED** (open 3 -> 2, closed 39 -> 40); its probe now drives the Boots on the second attack of a turn and
  reads the 2 they stop. `test/defcap.test.js`: the old "no defence left" pin is replaced by four drills (every 0{d} pool piece declarable, every blank refused,
  a driven Blade Break 0{d} block, the policy holds back). Sabotaged four ways, each bit. CR index 103 -> 104 cited / 93 -> 94 guarded (CR 2.3.2).
- **No WIRE_V change** (no payload or prompt shape moved). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.44 — the seventh reader for Viserai, Between Worlds: the double-faced hero and traverse

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`), and the LAST reader: `node tools/newdecks-census.js` prints no gap for
  Viserai's list, hero included, both faces (the census now reads a hero's other face too). `npm run audit`: the pool is unchanged.
- **The card** is two records sharing a print code (data/staged.js): Viserai, Between Worlds (Young, 20 life) "Whenever you create 1 or more Runechants, banish the
  top card of your deck. Then if you've created 3 or more Runechants this turn, traverse." and Viserai, Usurper (Demon, life "*") "The first attack action card with
  blood debt you play each turn gets go again." / "At the beginning of each end phase, if you've created or activated a Gate to i'Arathael this turn, you may traverse."
- **Traverse is CR 8.5.60 / 8.5.60a** (quoted verbatim at `effects.traverse`): the non-active face becomes the active one; it fails on a card with no other face, or
  when the ability that asked belongs to a face no longer active. One body, the brood's (v3.76): the ability half of the build is replaced by
  `build.heroAbilities` of the other face; deck, gear, intellect and the arena are untouched (CR 9.1.2c). `build.facesOf` finds the other face: a HERO record
  sharing a print code where exactly one of the two images is the back (`_BACK`). The pinned records carry no field linking faces, and a shared code alone is not
  enough: upstream has a promo code printed on two unrelated heroes (measured over 5,218 records). The build remembers the face it left (`_face`, beside `_brood`).
- **Four passives off the printed lines** (`build.heroAbilities`, `PASSIVES`, `tools/audit.js` `HERO_STATICS`): `runeBanish`, `runeTraverse` (the printed 3),
  `firstAtkGaKw` (the printed keyword), `endTraverse` (the printed token name).
- **Three per-turn facts** in `freshHist`, recorded in `effects.js` for every hero (the facts are the turn's, not the face's): `hist.runes` (Runechants created, the
  special ones included; one `runesMade` call per creation EVENT from the `rune` and `token` ops, Viserai's rite and the on-hit mint, so "1 or more" banishes one
  card), `hist.actNames` (arena permanents activated, by name), `hist.atkKws` (printed keywords of attack action cards played, so "first ... each turn" survives a
  mid-turn traverse).
- **The Usurper's go again** is granted in `execute` beside Compass's first-graveyard-play grant; `judge.keepsActionPoint` answers it for the AI (hand, arsenal and, for
  this grant only, the banished zone, where most blood debt attacks are played from; a banished card's own go again is still unread there, as before).
- **The end-phase "you may traverse"** is step (10) of `beginEndPhase`: EACH end phase, both seats asked, a two-mode sheet addressed to the hero's own seat
  (staying is the first mode, so the seat policy keeps its face; the end phase holds for the answer, v5.71's route).
- **LIFE CARRIES OVER: a reading, `tools/approx.js` `traverse-life-carries` (stated, probe driven).** The back prints life "*", which the CR does not define
  (CR 2.5.3c recalculates only from a new base value); the Agents of Chaos print the same and keep Arakni's life. The game starts on the front, the Silver Age legal face.
- **Drill `test/traverse.test.js`** (sabotaged twenty-four ways, each bit).
- **`tools/staged-play.js` (new) seats a staged hero for self-play**, the roadmap's gate before a hero opens: `node tools/staged-play.js viseraiBetweenWorlds 21` =
  630 games, 0 refusals, 0 violations, 0 stalls, 225 games ended on the other face. The gate is met. **The AI cannot pilot him yet: 72 won, 558 lost** (it plays
  1.1 cards a game from the banished zone and ends a quarter of his turns with the action point unspent); that is policy work, and a person piloting him is unaffected.
- **Pins repinned after reading:** `runOps` vocabulary 100 -> 101 (`traverse`, no parser emitter), CR index 97 -> 103 cited / 87 -> 93 guarded (8.5.60, 8.5.60a,
  9.1.1, 9.1.2, 9.1.2c, 2.5.3c), the approximation ledger 61 -> 62 (19 -> 20 stated), WIRE_V (dichotomy, wire).
- **WIRE_V 43 -> 44** (three `hist` facts, a build's `_face`, an op). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).
- **OWED BEFORE VISERAI OPENS:** the pool's `byCode` map lets the back face overwrite the front under the shared print code (a hero resolves by NAME first, so
  nothing breaks today); `pin-pool.js` must take BOTH faces; the trainer's route for the traverse sheet is undriven; the AI has no policy for when to turn back.

## v6.43 — the eighth reader for Viserai, Between Worlds: the small conditionals

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (851 parses, before and after): exactly
  SIX records read differently, all staged and all `part` -> `full`: Olde Leather Boots, Galaxxi Black, Bloodfrenzy Gloomblade (both printings), Plundersong Gloomblade,
  Looking for a Scrap. Census: Viserai 29 / 6 / 0 -> 35 / 0 / 0 (only the hero's own clauses, reader 7, are left).
- **Three per-turn facts** in `freshHist`, each recorded where it becomes true in `effects.js` (both boards): `hist.attacked` (`noteAttacked`, at the attack's
  declaration in `execute`, only when the attack-target is the hero, CR 1.4.5; the trainer's scripted dummy swing calls it too), `hist.heroDmg` (`creditHeroDmg`, where
  damage LANDS on the opposing hero after prevention, CR 6.4.10a quoted: combat on both boards, arcane, the soak answer, direct damage; CR 7.2.3b makes "the defending hero"
  the attack-target's controller, always the opponent with two seats), `hist.banPlay` (where a played card leaves the banished zone).
- **Olde Leather Boots** ("if you've been attacked 2 or more times this turn, this gets +2{d}"): `defSelf.when = "attackedN"`, answered by `defSelfMet`.
  **Galaxxi Black** (+2{p} after a card played from banish): cond `banPlayed`. **Bloodfrenzy Gloomblade** (go again after damage to the defending hero): cond `dealtHero`,
  its own record and deliberately NOT `dealtDmg`, which reads "an attack was played" (`hist.atk || hist.arc`). **Plundersong Gloomblade**: "they banish a card in their
  arsenal" is `foeArsBanish` with its subject printed.
- **Looking for a Scrap** ("As an additional cost to play this, you may banish a card with 1{p} from your graveyard. If you do, this gets +1{p} and go again."): a COST,
  so not `optCost` (a queued prompt, which drains after the card resolves). `fx.banCost` (subject pinned: printed power exactly N, else `optFilter`, which refuses a bare
  card), the rider's ops as `fx.conds` gated on `banCostPaid` (THIS play's payment). Asked before the card resolves on both boards off one reader
  (`prompts.banCostChoice`: every different card that could pay; "you may", so one candidate is a question and Decline is an answer): judge's `bancost` pending
  (`maybeBanCost`, between usurp and charge) and the trainer's `bancostpick` sheet. Paid at the top of `executeInner`, re-derived (`banCostPaid`). The AI answers through
  `judge.banCostAnswer` / `banCostWorth` (playable from banish +1, blood debt -1; pays at worth 0 or more), reason keys `bancost` / `bancostNo`.
- **Usurp open item (b) closed:** `effPowerNow` counts usurp's +2 (gate `usurp`) with the cost site's exclusion (never a weapon or ally swing, only when a Runechant
  can pay), and the Coach (`advCardOut`) counts +2 less the spent Runechant's arcane.
- **Drill `test/conditionals.test.js`** (sabotaged twenty ways, each bit).
- **OPEN (`tools/approx.js`, 59 -> 61 records, 1 -> 3 open):** `zero-defence-gear-refused` — CR 7.3.2b says "0 is a value", but both boards refuse to declare a 0{d}
  piece ("has no defence left"; `test/defcap.test.js` pins the worn-to-zero refusal), so the Boots' +2 is unreachable at the table today, and 27 pool 0{d} pieces
  cannot defend either (weaker than printed). `dealt-damage-reads-attacks` — Second Strike's "if you've dealt damage this turn" reads attacks PLAYED (stronger than
  printed after a blocked swing); left alone because Second Strike is a dealt card.
- **Pins repinned after reading:** WIRE_V (dichotomy, wire), the pending kinds the table demuxes (`split.test.js`, +`bancost`, window 560 -> 600), the trainer's busy
  lists (`soulcost.test.js`), the sheet doors (+`confirmBanCost`, an answer), `runechants.test.js` (usurp now hands on to `maybeBanCost`), the approximation ledger.
- **WIRE_V 42 -> 43** (a pending kind, an action, a held declaration, three `hist` counts). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.42 — the sixth reader for Viserai, Between Worlds: the special Runechants

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (851 parses, before and after): exactly TWO
  records read differently, Runechant of Lust and Runechant of Sloth (`part` -> `full`). `npm run audit`: the pool is unchanged. Census: Viserai 27 / 8 / 0 -> 29 / 6 / 0.
- **The cards** (Runeblade Instant - Aura): "This counts as a Runechant. When an attack usurps this, create a Runechant token. [Sloth: ... it gets go again.] When this is
  destroyed, create a Runechant token. At the beginning of your action phase or when you play an attack action card, destroy this."
- **"Counts as" is CR 1.8.8** (quoted verbatim at `fx.countsAs`): the card IS a Runechant to every rule and effect that asks, without gaining the token's text.
  `parser.isRunechant` is the one reader, so `runeCount` (the "{r} less for each Runechant you control" discounts, the pips, the report), usurp and Runebleed Robe's
  "destroy ... a Runechant you control" (`boardEntryNamed`) all see them, on both boards.
- **Usurp asks WHICH Runechant when the choice matters** (handoff's Usurp open item a). `parser.usurpTargets` (the candidates), `usurpOffer` (one uid per DIFFERENT card,
  null while every candidate is the same card: a board of plain tokens asks nothing, exactly as before) and `usurpTarget(sd, uid)`. The answer is a COST, so it is a `pending`
  settled before the card resolves: `judge.maybeUsurp` -> `usurp {uid}` (no decline: "if able"), and the trainer's `usurppick` sheet; it rides to `execute` as `_usurpUid`
  (a `HELD_DECL`), which re-derives it. The AI answers through `judge.usurpAnswer` / `usurpWorth` (what destroying it pays, less the arcane it would have dealt), reason key `usurp`.
- **"When an attack usurps this, ..."** (`fx.onUsurp`: a Runechant token, or go again for the attack), paid where usurp is paid, gated on the played card being an attack.
- **"At the beginning of your action phase or when you play an attack action card, destroy this"**: the attack-play trigger reads with an empty payload and the leading event
  becomes the start-of-turn schedule (`selfDestruct "turn"`, `sweepArena`), the one every "at the beginning of your action phase, destroy this" card rides on.
- **"When this is destroyed, create a Runechant token" did NOT already work** (ask the engine, not the note): it parsed, but `fx.onDestroy` was paid at one site only (an attack
  popped by phantasm). It is now paid wherever a permanent is destroyed — usurp, the attack-play trigger, the start-of-turn sweep and the Robe's cost — through
  `effects.fileDestroyed` (a real card goes to its owner's graveyard, turn-stamped; a token ceases to exist) and `effects.payDestroyed` (its controller's line). Usurped Lust
  pays two tokens; both are made below the firing-set capture, so neither pops on the attack that usurped it (v2.23's rule).
- **Drill `test/runechants.test.js`** (sabotaged twenty ways, each bit).
- **Pins repinned after reading:** WIRE_V (dichotomy, wire), the pending kinds the table demuxes (`split.test.js`, +`usurp`, window 520 -> 560), the trainer's busy-mode
  lists (`soulcost.test.js`), the sheet doors (+`confirmUsurp`, an answer), the policy census (`usurp` is driven by the drill, no pool deck reaches it), the `tryPlay` slice
  (26,993 -> 27,014: `usurppick` in the busy list, `maybeUsurp` at the payment's exit), CR index 93 / 83 -> 94 / 84 (CR 1.8.8), the approximation ledger (58 -> 59 records,
  0 -> 1 open).
- **OPEN (`tools/approx.js` `destroy-a-runechant-cost-unasked`):** Runebleed Robe takes a token before a special Runechant and does not ask; weaker than printed.
- **WIRE_V 41 -> 42** (a pending kind, an action, a held declaration). No DATA_VER change. The function must be redeployed (`APP_VER`, engine files).

## v6.41 — the fifth reader for Viserai, Between Worlds: the Gate to i'Arathael

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Measured over every pool and staged record (850 parses, before and after): exactly ONE
  record reads differently, the Gate itself (`none` -> `full`).
- **The card:** Gate to i'Arathael (Shadow Token - Aura), "Instant - {r}, destroy this: You may play target action card with blood debt from your banished zone this turn."
- **A CORRECTION to v6.40's stated limit, by asking the engine and not the note:** the token was ALREADY minted. Its record is in the pinned pool and Pull from Beyond's rider
  resolves it (driven: a red card banished puts a real Gate in the arena). What was missing was the Gate's ABILITY: the table refused the activation ("prints no attack or
  ability to activate") and the token sat there as a blank.
- **The reader is no new machinery.** The printed target is declared when the ability is activated, before the cost (`abTargetSpec`, v5.72, Beckoning Haunt's route; one legal
  target is declared on the spot, two are a question); with no legal target the activation is refused and nothing is paid (RULING 2026-11-13). The pick is over the banished zone
  and moves nothing; the answer stamps the chosen card playable for this turn (`_playTurn`, the window `parser.playZoneWhy` has read on both boards since v3.92). The card is
  then played by the ordinary route: its own speed, its own cost, an action point, and the graveyard afterwards (RULING 2026-10-31), with the permission stripped as it leaves.
  "You may play" is the permission, not an option on the target. The destroyed token ceases to exist.
- **Parser:** `RX_BAN_PLAY`, anchored whole (no window printed, another zone, an unreadable subject or a speed rider all refuse); "blood debt" joins the closed keyword
  vocabulary a printed "with <keyword>" may name (`KW_VOCAB_SRC`), answered by `printedKw`, so a card that only mentions blood debt is not a target.
- **The feed** says the card "may be played from the banished zone this turn"; the borrowed lines ("is banished", "revealed from") described a move that did not happen.
- **Both boards' target buttons** look in the banished zone as well as the graveyard (the trainer's `targetpick`, the table's `abtarget`).
- **The token-name scan reads the Gate's whole name** (`tools/pin-pool.js` `tokenNames`: a lowercase "to" and a word opening with a lowercase letter and an apostrophe). It read
  "arathael" before, which a re-pin would have gone looking for. Measured: the only name that moves. The probe in `test/staged.test.js` is now an assertion.
- **Drill `test/gate.test.js`** (sabotaged thirteen ways, each bit). The fixture is a twin, and has to be: every blood debt card in the staged list also prints "You may play
  this from your banished zone", so a staged card is playable with or without the Gate (asserted, so the day that changes the drill says so).
- **Pins repinned after reading:** the tokens reading nothing (6 -> 5), the arena activation census (the Gate moves from refuses to reads), the activation-pick family (seven),
  the own-card hazard (an arena permanent is allowed when the picked zone is not the arena), `applyPrompt`'s answer reads (+`banStamp`), the tier counts (762 / 24 / 11).
- **STATED LIMITS:** the trainer's route is the shared one but is undriven for the Gate (no deck can hold it yet); the AI seat declares a target when asked but has no policy for
  WHEN to open a Gate, and no reason key for it; "created or activated a Gate this turn" (Viserai, Usurper) has no per-turn fact yet: that is the hero's reader (7).
- **No WIRE_V change** (no new prompt or payload field: `banStamp`, `zone` and an absent `to` all existed). No DATA_VER change. The function is redeployed because
  `APP_VER` and engine files changed.

## v6.40 — the fourth reader for Viserai, Between Worlds: banish a card, then ask what it was

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`). Three staged cards print one idea three ways: the card banishes something and the rest of
  its text is about THAT card. Measured over the pinned pool: no record prints "banish a card from your hand", none has an op after an opt, and Soul Shackle (the one pool card
  printing "banish the top card of your deck", as a start-of-phase trigger) reads exactly as it did.
- **Pull from Beyond** ("Opt 2. Banish the top card of your deck. If it's red, create a Gate to i'Arathael token."): a new `banTop` op (the seat's own deck, `foeBanishTop`'s twin);
  the colour rider rides on the op and is answered off the banished card's printed pitch. **New engine fact: what a card prints after an opt waits for the opt.** The banish rides
  on the opt sheet (`op[2].then` -> the prompt's `ops`) and runs when the sheet is answered, on the deck the player arranged; before this an op beside an opt would have run first.
- **Embrace Ursur** ("When this attacks, you may banish a card from your hand. If it's Runeblade, create a Runechant token. If it's Shadow, this gets go again."): `optCost`'s offer
  with `classRiders`, the list form of Halo of Illumination's `classRider`; each is asked about the banished card, both can be true, and go again reaches the open chain link.
  The class words are a closed list (the two the card prints); every rider must read or the card stays unclaimed.
- **Corrupted Crown** ("When this defends, you may banish a card from your hand. If you do, this gets +1{d}."): a bare "card" is pinned by the printed hand (banish only); the +1
  lands on the defending piece (`defUid`, as the pay-cost family does); **a card declared as a defender is not offered as the cost** (the table keeps the wall's cards in `hand`).
- **Drill `test/banishif.test.js`** (sabotaged ten ways, each bit): the parses; the refusals (an unlisted class, a colour asked as a class, an unreadable payload, a bare card with
  no hand printed, a rider that is not the next clause); at the table, the opt is answered before the banish and the colour decides the payout; all four class cases and the
  decline for Embrace Ursur; the Crown paid (wall of 2) against declined (wall of 1), and the blocking card missing from the sheet.
- **STATED LIMITS:** the Gate to i'Arathael token is the next reader, so Pull from Beyond's payout names a token the engine cannot mint yet (it reports that and creates nothing);
  the trainer's wall and the AI's answer to these two sheets are undriven. Nobody can be dealt these cards.
- **WIRE_V 40 -> 41** (an opt prompt carries `ops`, a pick prompt carries `defUid`). No DATA_VER change. The function is redeployed because `APP_VER` and engine files changed.

## v6.39 — the third reader for Viserai, Between Worlds: Usurp

- **Nothing a player can be dealt changed.** Engine groundwork (`ROADMAP-NEWDECKS.md`): seven staged cards print Usurp (the six Gloomblades and Runic Disposition). Measured:
  `parser.usurps` answers no pool record.
- **The rule, verbatim (CR 8.3.49, rules.fabtcg.com):** "Usurp is a play-static ability that means 'As an additional cost to play this, destroy a Runechant if able. If you destroy a
  Runechant in this way, this gets +2 {p}.'" 8.3.49a: "If a player pays the additional cost to play a card with usurp, the player and the played card are considered to have usurped and
  Runechant that was destroyed is considered to have been usurped."
- **Built once, in the shared play path** (`effects.execute`, so both boards): the Runechant is destroyed BEFORE the attack-play auras are captured, so the usurped one deals no arcane
  damage and the others still pop; the +2 is a gain (under Chokeslam's cap, not base); the chain link carries `usurped`. "If able" is not "you may": nothing is asked, and with no
  Runechant the card is played at printed power. Readers: `parser.usurps` (`printedKw`), `parser.usurpTarget`.
- **Drill `test/usurp.test.js`** (sabotaged five ways, each bit): 0 / 1 / 3 Runechants at the table (power, Runechants left, arcane dealt); an attack without the keyword pays and gains
  nothing; the +2 lands as damage; the card's own discard ability does not usurp; a card that only names usurp, and an aura that is not a Runechant, are refused by the readers.
- **STATED LIMITS, for the readers that follow:** the special Runechants ("This counts as a Runechant", "when an attack usurps this") are unread, and when they are, choosing between
  two different Runechants is a choice the player is owed; the AI's power readers (`judge.effPowerNow`) and the trainer's Coach do not count the +2 yet. Nobody can be dealt these cards.
- **No WIRE_V, no DATA_VER change** (`pend.usurped` rides the link like its other optional facts). The function is redeployed because `APP_VER` and engine files changed.

## v6.38 — the second reader for Viserai, Between Worlds: Blood Debt

- **Nothing a player can be dealt changed.** Engine groundwork for the new decks (`ROADMAP-NEWDECKS.md`): six Gloomblades of *Viserai, Between Worlds* print Blood Debt, and they are
  staged (`data/staged.js`), not in the pool. Measured: `parser.bloodDebt` answers no pool record.
- **The rule, verbatim (CR 8.3.11, rules.fabtcg.com):** "Blood Debt is a triggered-static ability. Blood debt means 'While this is in your banished zone, at the beginning of your end
  phase, lose 1 {h}.'" 8.3.11a: "Blood debt only triggers if its source is public in the banished zone at the beginning of the owner's end phase."
- **Built once, for both boards:** `parser.bloodDebt(banish)` names the carriers (`printedKw`, so the Gate token's "with blood debt" is a reference and owes nothing);
  `effects.beginEndPhase` step (6a) takes one life per carrier in the seat's own banished zone. It is life loss, not damage (CR 8.5.12b): no prevention, no hit. Every card in `banish`
  is public here (intimidate's face-down card lives in its own field), which is 8.3.11a.
- **A beginning-of-end-phase trigger can now end the game.** `judge.doEndTurn` asks `winCheck` after the triggers and stops before step (a); the trainer's `endTurn` and `foeEnd` ask the
  same question at the same beat.
- **Drill `test/blooddebt.test.js`** (sabotaged five ways, each bit): carriers not references; one life per card, owner's end phase only, banish only; a prevention shield does not stop
  it (with a control that the same shield stops 1 damage); at the table the debt is paid and the turn goes on; a hero at 1 life with a debt has lost before the handoff, and at 2 survives.
- **Still unread on those cards:** Usurp (reader 3). **No WIRE_V, no DATA_VER change.** The function is redeployed because `APP_VER` and engine files changed.

## v6.37 — the first reader for Viserai, Between Worlds: "You may play this from your banished zone"

- **Nothing a player can be dealt changed.** This is engine groundwork for the new decks (`ROADMAP-NEWDECKS.md`): the six Gloomblades of *Viserai, Between Worlds* print the line, and
  they are staged (`data/staged.js`), not in the pool. Measured: no pool record sets the fact, before or after.
- **The clause is read now.** `classifyClause` answers the printed line and forwards the card fact `fromBan`. The ROUTE was built at v3.00 (`parser.playZoneWhy`, asked by both boards) and
  waited for a card to print it; until now the line reported unread. The census (`node tools/newdecks-census.js`) moved Viserai's rows from 12 full / 14 part / 9 none to 12 / 19 / 4.
- **Drill `test/banroute.test.js`** (sabotaged three ways): all six read the line; at the table a banished Gloomblade is played once, deals damage, files to the graveyard turn-stamped
  (RULING, user, 2026-10-31) and is refused from there; an attack that does not print the line is refused from banish; the Gate token, which only talks about banished-zone plays, grants
  itself nothing.
- **Still unread on those cards:** Usurp and Blood Debt (readers 2 and 3). A Gloomblade today is weaker than printed, and nobody can be dealt one.
- **No WIRE_V, no DATA_VER change.** The function is re-bundled and redeployed because `APP_VER` and `engine/parser.js` changed.

## After v6.36 (2026-11-15, not a release) — the pool may grow, and the two September precons are staged

- **RULING (user, 2026-11-15, "Yes to all"):** (1) Dawnblade is no longer frozen at fifteen: a new Silver Age precon joins the pool when the engine reads its whole list, and Silver Age's
  ban list and hero bench still never remove anything (`data/formats.json` `dawnblade.growth`, `test/formats.test.js`); (2) the text of *Prism, Advent of Thrones* (SAT) and *Viserai, Between
  Worlds* (SBW) is pinned now from the-fab-cube's unmerged `usurp-the-shadow-throne` branch instead of waiting for the merge into `develop`.
- **`data/staged.js`** (new; `tools/pin-staged.js`, source recorded as a commit) holds every record with a SAT or SBW printing, both faces of the two-faced cards, and their tokens. **The page
  does not load it**: no page, `APP_VER`, `DATA_VER`, `WIRE_V` or server function change, so nothing a player can see moved and the version did not bump.
- **`test/staged.test.js`** (sabotaged): every row of both lists resolves by its own print code (the pool alone must not); both faces present; a card the pool already holds reads the same in
  both files; the phone never sees the file. One probe records that the token-name scan reads "Gate to i'Arathael" as "arathael".
- **`tools/newdecks-census.js`** runs both lists through the real parser and prints what it cannot read. The plan and the reader order are `ROADMAP-NEWDECKS.md`: Viserai first, Prism second.
- **Checked this cycle:** `develop` re-fetched, `pin-pool.js --check` current, the live-wire drills in `drift.test.js` read with the cache present.

## v6.36 — the Pass button says what a pass costs; the Concede button is gone

- **The phone never passes for a player** (RULING, user, 2026-11-15: "Don't auto pass because it gives too much info to the opp"). A pass sent the instant the attacker has nothing to play
  would tell the defender the hand holds no instant. Instead the player's own Pass button shows it, and only their phone sees it.
- **Green: nothing else can be started.** When a player holds priority and no card can be played, no ability activated and no defender declared, Pass ("Pass", "Pass — let <hero> block",
  "Done defending") and End turn are green: passing gives nothing up. This is the attacker in the defend step with no instant, the case the forfeit clock was burning on.
- **Purple: an action point is unspent.** In the player's own action window, with an action point left and something that could still be started, Pass and End turn are purple, so the turn
  is not passed away by a mis-tap. The tap still works: it is a warning colour, not a lock.
- **`judge.moves(g, seat)`** (new, read-only) is the one list both colours ask: every play, activation and defender `legal` accepts for that seat now. Drill `test/moves.test.js` plays real games
  with every hero: whatever the AI proposes must be on the list, every entry must be accepted by the reducer, and the list must be seen both empty and full (sabotaged three ways).
- **The Concede button is removed** (RULING, user, 2026-11-15: "It has no place there completely remove it"). It appeared only in the defend step and asked no confirmation, so a mis-tap was
  a ranked loss. Closing a started ranked table is still a concession, and the engine's concede action (CR 4.5.3c) is unchanged.
- **Ruling recorded, nothing to build:** a player who runs out the forfeit clock loses, and the winner has to wait the clock out; "we are counting on people playing nice".
- **No WIRE_V, no DATA_VER change.** No payload, prompt or game key changed; the function is re-bundled and redeployed because `APP_VER` and `engine/judge.js` changed.

## v6.35 — the forfeit clock: seven and a half minutes, and the defend step says whose move it is

- **The limit is 7.5 minutes** (RULING, user, 2026-11-15: "sometimes there is a lot to consider"). One constant, `FORFEIT_MS` in `server/referee.js`; the page still reads it from the
  function's answer and now prints a half minute honestly ("has not moved for 7.5 minutes").
- **The clock sits on whoever must decide** (RULING, user, 2026-11-15: a chess clock, never paused). In the defend step the turn-player holds priority (CR 7.3.3), so the game waits on the
  attacker until it passes, and on the defender from then on while they choose blockers. The attacker's button used to read only "Pass"; it now reads **"Pass — let <hero> block"**, so a
  player who is politely waiting knows the table is waiting on that tap. An attack on an ally (which cannot be blocked) keeps the plain "Pass". No rule and no clock logic changed.
- **Rulings recorded, nothing to build:** the 0-turn lobby forfeit stays; very short ranked games count (an honour system); a phone that already has a name may still redeem a recovery code;
  the ladder keeps floor 3 / top 50 / last 10.

## v6.34 — the ladder: who stands where in ranked play, and the latest games

- **A public ladder.** From the first screen ("The ladder"), the server table screen and the name sheet ("See the ladder") a player opens a plain list of ranked players, best rating first: rank, name,
  rating, and the record (won, lost, drawn). Anyone can read it, **signed in or not, and looking never signs a phone in**. A player is listed once they have **a chosen name and three ranked games**
  (one constant, `LADDER_FLOOR` in `server/referee.js`); fewer games is "provisional": rated, not listed. Order is **rating, then more games, then name**, a total order; the top **50** are shown
  (`LADDER_CAP`). A player whose sign-in was left behind by a recovery (007's orphan) or who has no name never appears.
- **Your own line.** A phone that is already signed in also hears where it stands: its rank when it is listed (also below the top 50), otherwise its rating and "2 more ranked games and you are on the
  ladder" (or, for a player with games but no name, "Choose a player name and you are on the ladder"). Your row is highlighted. A phone with no sign-in, a forged or expired one, or a provider that is
  down simply gets the list without the line: the public read never fails for the caller's sake.
- **Latest games.** The same answer carries the last ten recorded ranked results, newest first: both names, both heroes, who won (or a draw), how it ended in plain words (won, conceded, forfeit, draw)
  and how long ago. No identifiers.
- **Cheap and read-only.** One function call, one database statement (`ladder_get`, STABLE, so it cannot write; the top list and the latest games through two indexes, the caller's rank one count).
  No row is written or made, not even a rating for a stranger who asks. **Not cached**: the answer is one indexed statement, and a ladder that did not show a game that has just ended would read as a bug.
- **Honest empty state and retry.** "No one is on the ladder yet. Be the first: play three ranked games."; a failure says so in a sentence and offers *Try again*. Names of 16 letters and four-digit ratings
  fit at 393 and 320 wide; the rows are not controls because they do nothing. The screen says what this is: a fan-made ladder, for fun and glory, no ads, forever.
- **No WIRE_V, no DATA_VER change.** No game payload, snapshot, prompt or game key changed (a new request op and a new engine call only); the function must still be re-bundled and redeployed because
  `APP_VER` changed (the build id both phones and the function must agree on).
- **To go live:** run `server/supabase/008_ladder.sql` (ends `dawnblade_ladder` / `ok`, safe to run twice, adds two indexes and one function; nothing 001-007 is edited) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the new ladder check is WRITTEN BUT NOT RUN on live). Optionally, once, `node tools/liveranked.js --go`: plays ONE ranked game between two fresh test players
  (it leaves two players with one game each and one result row behind: read its header). Drills: `test/serverladder.test.js`, `test/serverladderphone.test.js` (each with sabotage),
  `tools/sql-pglite.js` + `tools/sql-sab-008.js` (PGlite, 19 sabotages), the Deno rehearsal, `tools/serverpage.js` (the Ladder screen, and `liveranked.js` proved offline).

## v6.33 — ranked integrity: the forfeit clock, closing counts, recovery keeps a rating

- **An abandoned ranked game can be claimed.** On a RANKED server table the function stamps (server time, never a phone's clock) when the player the game is waiting on last
  made an accepted move. If that player makes no accepted move for **five minutes** (one constant, `FORFEIT_MS` in `server/referee.js`, a placeholder the user may rule on), the OTHER
  player's phone is offered **Claim the win**; the function checks the claim against its own stamp and its own notion of whose decision is pending, ends the game as a **win by
  forfeit** (the absent player loses) and records it once with the usual Elo move. Early claims, a claim by the player being waited on, a claim on a friendly table or a finished game,
  and a forged seat or key are each refused and change nothing; a claim racing the absent player's late move is decided by the row's version check (exactly one wins; drilled in both
  orders). **Who the game waits on** is `judge.waitingOn` (read-only, new): a pending cost, a live sheet's side, the arsenal choice, else the priority holder — never guessed from whose
  turn it is; no clock runs when the game waits on nobody or on both. The waited-on phone sees a calm countdown in the last two minutes; the waiting phone is told how long until it may
  claim. Neither says what is being decided. A ranked game nobody finishes or claims simply ages out with the table (48 hours) and records nothing. Friendly tables: no clock, no
  claim, byte for byte as before.
- **Closing a ranked table mid-game is a concession.** Once the match has been dealt, the creator's close counts as their loss (recorded exactly like Concede, the closer the loser) and the
  page says so before the player confirms ("Closing now counts as a loss…"). Closing before the game starts is free and records nothing; friendly tables are unchanged.
- **Recovery keeps a ranked rating** (`007_forfeit.sql`). A throwaway player that played a ranked game (or sits at an unfinished ranked table) is kept, orphaned but intact, when its
  phone redeems a recovery code; the recovered player's rating and record are never touched. A throwaway with no ranked games is deleted as before.
- **Row v5, WIRE_V 40, DATA_VER unchanged.** A ranked table is now a v5 row (clock, forfeit); v4 rows are still read. The clock rides as a sealed push frame and a join/resync answer key,
  the claim is a new request op: no game state, snapshot or prompt changed.
- **To go live:** run `server/supabase/007_forfeit.sql` (ends `dawnblade_forfeit` / `ok`, safe to run twice; re-run it after any re-run of 004 or 006) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the forfeit check is WRITTEN BUT NOT RUN on live). Drills: `test/serverforfeit.test.js`, `test/serverforfeitphone.test.js` (each with
  sabotage), `tools/sql-pglite.js` + `tools/sql-sab-007.js` (PGlite), the Deno rehearsal, `tools/serverpage.js`.

## v6.32 — ranked server tables: the result is recorded once, and ratings move

- **A ranked table is a choice at create.** On the server-table screen a switch reads *Friendly table* (the default, exactly as before) or *Ranked table*
  ("Counts toward both ratings"); the button then reads *Open a ranked table*. A ranked table needs two DIFFERENT signed-in players who each have a chosen
  name. A phone that cannot meet that is refused in a plain sentence: *"A ranked table needs a player name for both players. Choose yours under Playing as,
  then try again."* (no name), or *"A ranked table is for signed-in players, and this phone could not sign in just now..."* (no sign-in). Nothing is written by a refusal.
  The lobby line and the board say **Ranked** and show each player's rating beside their name.
- **Who goes first:** unchanged and already as ruled: every server table's lobby is the two-phone rock-paper-scissors (sealed throws, opened only once both
  are in, ties replay) and the WINNER CHOOSES who goes first. Nothing to build.
- **The result is written by the function only, exactly once.** When a ranked game ends (a win on life, a concession, or the engine's dead-position DRAW) the
  function reads who won, how and how many turns from its OWN game state, after the deciding move is saved, and calls `result_record`: one `results` row (game,
  both players, heroes, winner or draw, how it ended, turns, build, times, both ratings before/after) and both ratings updated in the SAME transaction.
  Idempotent on the game id (the table code plus the moment the table was made, so a code drawn again later is a new game): a replayed ending, a resync, a
  takeover or a retry answers the stored result and moves nothing. No request from a phone can name a winner (forgery drills). If recording fails the game is
  not undone: the next request of any kind records it. There is a Concede button on the board (`concede`); there is no leave/abandon op.
  **Gap (the forfeit clock closes it later):** a ranked table its creator closes before the game ended records NOTHING (so a creator can dodge a loss by
  closing). A decided game's table cannot be closed over, so close can never erase a result.
- **Ratings:** Elo, one per player (not per hero), start 1200, K 32, a draw is half a point, rounded to integers, computed IN SQL (`rating_start()`,
  `rating_k()` are the one place the constants live). Two simultaneous finishes of one player's two games both apply (one advisory lock per player, lower id first;
  proven on a real Postgres 16: with the locks 1231, without 1216). Records kept: games, wins, losses, draws.
- **What a player sees:** `me` now also returns rating and record; the name sheet shows them ("Your rating is 1312. 1 ranked game: 1 won, 0 lost, 0 drawn.");
  at the end of a ranked game each phone's end screen says "Well played. Your rating rose from 1300 → 1312 (+12)." / "Your rating moved from 1200 → 1184 (−16).
  Every game teaches something." / "Your rating stays at 1200.".
- **Privacy:** player ids, tokens and subjects still never leave the function; ratings, names and the result summary are public by design (scanned by the drills).
- **WIRE_V stays 40, DATA_VER unchanged:** no wire payload, prompt or game key changed; ranked rides the request envelope and the function's own answers and row.
  The stored row for a ranked table is **v4** (a v6.31 function refuses it as `wire`: a rollback cannot turn a ranked table into a casual one).
- **To go live (the CEO):** run `server/supabase/006_ratings.sql` (ends `[{"dawnblade_ratings":"ok"}]`, safe to run twice) BEFORE redeploying; re-bundle and redeploy
  `table`; `--stamp`; `node tools/livecheck.js` (the ranked check is WRITTEN BUT NOT RUN on live). A function redeployed before 006 refuses ranked creates with `internal`.
- **Drills:** `test/serverranked.test.js`, `test/serverrankedphone.test.js` (each with sabotage), `test/fixtures/elo-vectors.json` (the shared Elo table the fake and
  the SQL are both held to), `tools/sql-pglite.js` (006 twice, 20 sabotages, vectors), `tools/sql-race.sh rate|ratenolock`, the Deno rehearsal (ranked phase), `tools/serverpage.js` (ranked at 393x852).

## v6.31 — a player's name is on the board, and no player holds more than 5 open tables

- **Names on the board.** At a server table each seat's player name (when that player has one) is on the table board, small and dim, under that seat's hero
  name, on both phones: yours under your hero, theirs under theirs. A player with no name shows exactly what was shown before (nothing is drawn). It survives
  a reload (the claimed seat reads both names at once) and a seat takeover. A 16-letter name fits the box at 393 wide; on a narrower phone it is cut with an
  ellipsis, never wrapped, never pushing the row. Local tables and the trainer are unchanged.
  The names are the channel's, the same `names()` the lobby's "A vs B" line has read since v6.29 (the function's own answer envelope): they are NOT in the
  game state the rules or the AI read, nor in the report, nor in any wire payload. **WIRE_V stays 40** (no wire payload, prompt or game key changed).
- **At most 5 open tables per player** (ruling, user, 2026-11-14: "cap 5 open tables per player"). **Open** = a table this player CREATED while signed in,
  whose game is not finished, that its creator has not closed, and that has not been idle 48 hours (those are forgotten anyway). A finished game lets go of
  its slot (the referee marks the row `over` when the session ends); joining someone else's table never counts; casual (not signed-in) tables are exactly as
  before (no creator, v2 row, never counted, never refused). The sixth is refused `table-cap` and nothing is written.
  The page says: *"You already have 5 tables open, the most one player can have. Finish a game, or close one of the tables below, then open a new one."*,
  lists the five codes, and gives each a **Close** button.
- **Close** (`{op:"close"}`, creator only): the smallest way out of the cap (a table nobody sits at would otherwise count for two days). It marks the row over and
  closed; a closed table answers `no-table` to both seats. Another player, a casual table, a forged token and a missing table each get their own refusal.
- **How the count is atomic** (`005_table_cap.sql`, new, service_role only): `table_create_capped(id, row, creator, cap)` counts the creator's open rows and
  inserts in ONE transaction under a per-player advisory lock (`pg_advisory_xact_lock`), so two simultaneous creates at four open make exactly one more.
  Proven on a REAL Postgres 16 with ten simultaneous callers (`tools/sql-race.sh`: with the lock 1 created / 9 refused; the same file without the lock line 10 created),
  and on PGlite (twice, plus ten sabotages). A signed-in create on a store that cannot count is refused `unavailable`, never made unchecked.
- **Honest limits:** the cap binds signed-in creates. A phone that cannot sign in opens a casual table, and casual tables are by design uncapped (the
  stranger-opens-empty-tables exposure in DEPLOY.md is unchanged). A name is stored in the table row when a player sits down (as in the lobby), so a name
  the player changes mid-table shows at the next sit-down. Closing a table does not push a notice: the other phone finds out on its next request.
- **To go live (the CEO):** run `server/supabase/005_table_cap.sql` (ends `[{"dawnblade_table_cap":"ok"}]`; safe to run twice), re-bundle and redeploy the function
  (the build id moved with APP_VER), `--stamp`, then `node tools/livecheck.js` (now also asserts seat 0's name on both boards; WRITTEN BUT NOT RUN on live).
  Until 005 is run the new function answers a signed-in create with an internal error (the SQL function is missing): run the SQL first.
- **Drills:** `test/servertablecap.test.js` (the cap, joins, a whole finished game, close, a race, no leak, the phone) and `test/servernames.test.js` (game,
  reload, takeover, no name in state), each with its sabotage; `tools/serverpage.js` (names on the board, long names, a nameless opponent, the joiner's
  board, the cap refusal and Close at 393x852); the Deno rehearsal (cap phase, single + folder); `tools/sql-pglite.js` (005 twice).

## v6.30 — a lost phone is not a lost player: the recovery code

- **On the name sheet** (*Find an opponent* → *Join a server table* → *Choose a name*): **Get a recovery code** shows a code ONCE (three groups of five,
  e.g. `6RY9U-8HWT9-5QMG7`) with a plain line telling the player to write it down and that a new code replaces it; **I have a code** takes it on a
  NEW phone and the sheet answers "Welcome back, <name>. This phone is you now." The recovered phone has the player's name and takes the player's seat
  the usual way (sit down: last one wins, the old phone is told). The old phone keeps working: one player, two phones. The code is held in the page's
  memory only while it is on the screen, never in the phone's storage.
- **The code** (`server/referee.js`, ops `recovery-mint` and `recovery-redeem`): 15 characters from a 31-letter alphabet (no 0 O 1 I L) = 74 bits, drawn
  from `crypto.getRandomValues` with rejection sampling (never `Math.random`). Only its SHA-256 is stored (`recovery`, from 002). Read leniently on
  the way in (case, spaces, dashes). **Expiry two years** (730 days; it is a lost-phone code and must still work months later); a new code restarts it.
  **One live code per player**: minting retires the older unused ones.
- **Redeem** (`004_recovery.sql`, `recovery_redeem`, service_role only, ONE transaction): spends the code, re-points the new phone's sign-in to the code's
  player, and deletes the throwaway player it had if that leaves it with no sign-in (its name, if it chose one, is freed). **Wrong, used, expired,
  replaced and malformed codes are ONE answer** (`recovery`, and one plain sentence on the screen). A phone that is sitting at a table (the page names the
  tables it knows) is told to leave it first (`recovery-seated`), before anything changes, so a seat is never left to a player that no longer exists.
- **Brake:** eight wrong tries from one sign-in in an hour answer `recovery-limited` (a limited try does not look at the code, so a good code is not
  spent by it). Per sign-in, not global (a global brake would let anyone lock every player out); the defence is the code's size: ~10^15 years at 150 tries
  an hour from one address, and the auth service itself allows 30 anonymous sign-ins an hour per address.
- **Nothing leaks:** the code is in the mint's answer and nowhere else; no hash, token, provider id or player id in any other answer, broadcast, stored
  row or report (`test/serverrecover.test.js` scans them, with the leaks planted as sabotage).
- **To go live (the CEO):** run `server/supabase/004_recovery.sql` (ends `[{"dawnblade_recovery":"ok"}]`), re-bundle and redeploy the function, `--stamp`,
  then `node tools/livecheck.js` (which now also mints a code on seat 0 and redeems it on a third fresh browser; it was written but NOT run on live).
- **Drills:** `test/serverrecover.test.js` (18) and `test/serverrecoverphone.test.js` (6), each with its sabotage; `tools/serverpage.js` mints on one real
  page and redeems on a second at 393x852; `tools/supabase-rehearse.js` under Deno (single + folder); `tools/sql-pglite.js` (004 twice; ten sabotages).
- **WIRE_V not bumped** (still 40): no wire payload, prompt or game key changed; the two ops ride the request envelope and the function's own answers, as `me` did.
  The table's build id moved with APP_VER, so the function MUST be redeployed or the handshake refuses.
- **Honest list:** a code is only as safe as the paper it is on; anyone who has it can become the player (the same trust as a password). Losing the
  code AND the phone is still losing the player. The server only knows the tables the redeeming phone tells it of (an unlisted old seat stays with a
  player that no longer exists). A phone that already has a named player and redeems a code gives that player up if it had no other sign-in.


---
Older releases (v1 to v6.29): `docs/archive/CHANGELOG-to-v6.29.md` (grep it).
