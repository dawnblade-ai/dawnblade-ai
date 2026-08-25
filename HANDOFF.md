# Handoff — Dawnblade, at v3.46 · PHASE C · ALLY COMBAT COMPLETE

> **EVERYTHING ABOVE v3.05 IN THE PROSE BELOW IS HISTORY.** This block and
> `FINISH.md` are current; where they disagree with the older sections,
> they win. The older sections are kept because each records a bug shape
> that can come back, not because their numbers are live.

## THE PROMPT — paste this into a fresh Claude Code thread in this repo

> Read `CLAUDE.md` in full, then **`FINISH.md`** — the blueprint to done —
> then `POLISH.md` for the shipping bar. Most entries in all three exist
> because breaking that rule cost a real bug.
>
> **The two engines are merged, the pool is PINNED, Phase B is DONE, and
> the card semantics run on both boards.** `npm test` is **1458 drills**
> and **0 skipped**. Read the SKIP count, not just the fails — a fresh
> clone once skipped 304 drills silently, which is how 22 broken cards
> survived a green suite.
>
> Current at v3.46: coverage **333 full / 60 part / 12 none** (Oysten
> earned the +1 at v3.46; v3.42-45 all fixed things no coverage tool can
> see, which is the point), fairness **clean**, `tools/failstates.js`
> **0 UNFAIR**, `npm run crindex` **50 of
> 63 CR rules guarded** (the 3 UNGUARDED are section pointers).
>
> **YOUR JOB IS PHASE C — THE HEROES.** Kayo, Viserai, Bravo and
> **Iyslander** are complete (she finished at v3.37 — see below). **Briar is in progress**: her hero ability is BUILT (v3.21) and
> her 8 `part` cards are the remaining work — see below.
>
> ### v3.36 — IYSLANDER'S HERO ABILITY WAS HALF-BUILT, AND THIS FILE SAID SHE WAS DONE
>
> She was listed complete because her CARDS were. Her HERO was not:
> **clause 1 was trainer-only** and the table refused it by name —
> *"Aether Icevein is an action — it cannot be played during an
> instant-speed window"* — and **clause 2 was a closure in `Battle`**, so
> the table created no Frostbite when she played an Ice card on your turn.
> A hero is finished when the ABILITY runs on both boards, not when the
> deck parses. Check the other "complete" heroes against that bar.
>
> **The mechanic was worth more than the hero.** 14 pool records print
> "as though it were an instant" across three heroes and not one was read.
> `parser.playsAsInstant` is the one reader; see CLAUDE.md's "A SPEED
> GRANT IS A WINDOW, AND THE WINDOW PAYS THE COST".
>
> **STILL OPEN ON HER, and each is a recorded decision:**
>
> | card | why it stays |
> |---|---|
> | ~~Stir the Aetherwinds~~ | **BUILT at v3.37** — `instantNextQ`, the fourth qualified single-shot grant. Building it also found its amp landing on a card the line never named |
> | Snapback x3 (Blaze) | needs a CLASS-AWARE turn history — `hist` counts non-attacks and records no class. **BUILT at v3.38** (`hist.playTy`) |
> | Ice Eternal | X-cost + Ice Fusion. Unchanged, still honestly refused |
>
> **A MANUAL PRE-SHIP STEP EXISTS NOW.** Compile both `text/babel` blocks
> with `@babel/standalone` after any `index.html` edit — bracket balance
> is not a parse, and v2.27 shipped a page that was balanced and broken.
> Deliberately not a drill: no dependencies, so a fresh clone stays green.

> ### v3.37 — IYSLANDER IS FINISHED: 29 of 30 cards, one written refusal
>
> **Ice Eternal** is the only card left and it is a recorded decision, not
> work: the pool's only X-cost card. Her hero ability runs on both boards
> (v3.36), her deck resolves, and that is the bar — **a hero is finished
> when the ABILITY runs on both boards and every card is either built or
> has a written reason.**
>
> **The next heroes are the eight untouched ones.** Leave Arakni last
> (stealth-as-qualifier is filed `noop` by ruling). Blaze is the cheapest
> next step, because v3.36/v3.37 already built two of the three things his
> deck wants: his Cindering Foresight is `full`, and **Snapback** is the
> one remaining shape — it needs a CLASS-AWARE TURN HISTORY, which would
> **NOT** unblock Quick Clicks: Nimblism is a card NAME, not a type, so
> that one needs a name history (the non-attack twin of `hist.atkNames`)
> and `hist.playTy` cannot answer it. The v3.38 note claiming otherwise was
> wrong and is corrected in CLAUDE.md.

> ### v3.38 — BLAZE: his DECK is 22 of 23, and his HERO is entirely unbuilt
>
> Same shape as Iyslander: the cards are nearly done and the hero is the
> work. **Neither of his clauses exists** — no build passive, no
> `HERO_STATICS` entry, so the audit reports all three of his hero-text
> clauses unrecognised, honestly.
>
> ```
> Whenever you opt, put energy counters on Blaze equal to the number of
> cards looked at this way.
> Once per Turn Instant - Remove X energy counters from Blaze: Banish a
> Wizard non-attack action card from your hand with an effect that deals
> arcane damage equal to X. You may play it this turn as though it were
> an instant.
> ```
>
> **BOTH CLAUSES OR NEITHER.** Clause 1 was written in this cycle and
> deliberately REVERTED: energy counters that nothing can spend are
> v2.74's Frostbite bug exactly — a number on the hero row and no rule.
> Clause 2 is what spends them.
>
> **What clause 2 needs, and every piece has precedent:**
>
> | piece | precedent |
> |---|---|
> | `parseHeroPower` accepting a "remove N counters" cost | it refuses one today BY DESIGN ("never parse ahead of wiring") — relax it only once the route exists |
> | a `pick` over the hand with an arcane-amount filter | `promptFilter` reads printed FIELDS; this is a PARSED fact (`fxParse(c).ops`), so it is a deliberate, documented extension |
> | X coupled to the chosen card | the player picks the card, X is that card's arcane, the cost is X counters — so X is not a free variable and needs no X-cost machinery |
> | the dynamic bound (arcane <= counters held) | supplied at the QUEUE SITE, exactly as `notUid` is for `notSelf` (v3.20) |
> | banish + "playable this turn" | Crouching Tiger's `_playTurn`, already honoured by `playableFromZone` |
> | "as though it were an instant" | `playsAsInstant` (v3.36) — this would be a FIFTH printed source for the one reader |
>
> **`CARD_OVERRIDES` IS STILL EMPTY** and should stay that way if the
> generic route can take this. It was weighed for Blaze and declined: the
> only genuinely non-generic part is X binding the cost to the card's
> parsed effect, and the queue-site pattern covers it.
>
> **His other two `part` cards:** Arcane Polarity needs "if you have been
> DEALT arcane damage this turn" (`hist.arc` records arcane DEALT BY you,
> v3.28 — this is the other direction and is a new field); Turn to
> Mindfire needs a {t} cost on the HERO plus a Ponder token.

> ### START HERE — the things a new thread should pick up
>
> **1. ~~ALLY COMBAT~~ COMPLETE (v3.44-46).** Allies attack (v3.44), an
> attack on one decides which triggers fire (v3.45), and an ally that dies
> does what it prints (v3.46). Along the way: 34 records were firing
> hero-gated on-HIT triggers off an ally hit, 4 more were firing
> hero-gated on-ATTACK triggers, the clause splitter was cutting inside
> quoted granted abilities, and Oysten's Gold was going to whoever killed
> it. See CLAUDE.md's four sections from "AN ALLY IS A PERMANENT THAT
> ATTACKS" through "AN ALLY THAT DIES DOES WHAT IT PRINTS".
>
> **1b. A PLANNED JOB WAS DELETED, NOT DONE.** "The trainer cannot choose
> an attack-target" sat on this list for three versions. Measured: the
> trainer's opponent is `DUMMY_DECK` — 12 vanilla attacks, NO allies — and
> its swing is the `[3,4,5]` fabrication with no target choice. It can
> never field an ally against you nor attack one of yours, so a picker
> there is dead code and `heroHit: total > 0` is complete for that board.
> **Measure a list item before building it.**
>
> **1c. STILL OPEN, and each has a written reason:**
>
> | card | what it needs |
> |---|---|
> | Mournful Casket, Basalt Boots | the AT-REST display pass — a defensive buff true while sitting on the board would put a number on screen that disagrees with the number that blocked (v3.27's boundary) |
> | Silent Stilettos | an ally-death trigger for the CONTROLLER's own attacking ally, plus an "if you do" payload — the family this project does not read |
> | Cold Snap's freeze on an ally, Drop the Anchor's `{t}` on allies, Scuttle Toes' `{u}` | ally-targeting EFFECTS, distinct from attack-targeting; none is wired |
>
> **1d. FOUND, RECORDED, NOT FIXED — Cosmo is routed as a swinging
> weapon.** Unchanged from v3.44; `parser.allyAttack` guards `power > 0`,
> judge's weapon branch does not.
>
> **2. Turn to Mindfire — the last card on Blaze.** Four pieces, three of
> them general: the `hits` optional-cost trigger (unwired since v3.20), a
> TAP as a cost kind, a tapped HERO as a state, and the Ponder token. Full
> write-up in the v3.40 CHANGELOG entry. **It would be free in this pool
> and that is not a reason to fake it.**
>
> **3. The remaining heroes.** Dash, Azalea, Fai, Enigma, Boltyn, Gravy
> Bones, Lyath, and Briar's 8 `part` cards. **Lyath is cheapest**: v3.39
> un-truncated his hero powCard, so his second sentence ("Defending action
> cards you control get +1{d} this turn") now reaches `fxParse` and needs
> only a READER — it is close to `fx.defGrant` (v3.23). Leave **Arakni**
> last (stealth-as-qualifier is filed `noop` by ruling).
>
> **4. Read the method before the cards.** `CLAUDE.md` is long because
> every section is a bug that shipped. The four that pay off most often:
> *find the hero's ONE mechanic first*; *a hero ability is finished when it
> runs on BOTH boards*; *sabotage every new drill, and sabotage the guard
> too*; and *when you close a recorded gap, delete the record of it*
> (v3.41 — three stale claims, one of them hiding a real gap).
>
> ### THE SHIPPING LOOP, as actually run this cycle
>
> ```
> npm test                      # 1423 drills · 0 fail · 0 SKIPPED (read the skip count)
> npm run fairness              # must say "Nothing found"
> node tools/failstates.js      # UNFAIR must be 0
> npm run audit                 # read the diff card by card, never the totals
> node tools/audit.js --write-baseline    # only after reviewing that diff
> <babel compile check>         # MANUAL — see below; brackets balancing is not a parse
> # bump APP_VER · CHANGELOG entry · CLAUDE.md lesson · this file
> git push origin main          # that IS the deploy
> ```
>
> **`npm run audit` REWRITES ITS ARTIFACTS EVERY RUN.** `AUDIT.md` and
> `tools/audit.json` carry a `generated` timestamp, so running the audit as
> a final *check* — after committing — leaves the tree dirty with a
> timestamp-only diff and nothing else. Confirm with `git diff` that the
> only change is that line, then `git checkout` the two files rather than
> committing the churn. Run the audit BEFORE you commit, not after.
>
> **The babel check is not a drill and cannot become one** — the project has
> no dependencies and `npm test` must stay green on a fresh clone with no
> `npm install`. Run it in a scratch dir after any `index.html` edit:
>
> ```js
> const Babel = require("@babel/standalone");   // npm i --no-save in /tmp
> for(const [,code] of html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g))
>   Babel.transform(code, {presets:["react"], sourceType:"script"});
> ```
>
> **Verifying the deploy from a sandbox:** the Pages URL is often blocked by
> the agent proxy (403 on CONNECT). Check the `pages build and deployment`
> workflow run for your commit SHA through the GitHub tools instead, and say
> plainly that the live URL was not fetched.

> ### v3.39 — BLAZE'S HERO IS BUILT; his deck has two cards left
>
> Both clauses run on both boards, the ledger knows about all three of his
> printed sentences, and the energy pool is on screen. **X needed no
> X-cost machinery** — see CLAUDE.md, "A COST COUPLED TO THE CHOICE".
>
> **Arcane Polarity was built at v3.40** (`hist.arcTaken` — see CLAUDE.md,
> "TWO DIRECTIONS OF ONE EVENT ARE TWO RECORDS"). **Turn to Mindfire is
> the one card left, and it is THE NEXT THING TO BUILD** — its four pieces
> are written up in the v3.40 CHANGELOG entry, and three of them are
> general rather than his:
>
> | piece | state |
> |---|---|
> | the `hits` trigger for an optional cost | `optCost` is wired for `attacks`, `play` and `entersLeaves` only. v3.20 named `hits` as outstanding and it still is |
> | a TAP as an optional-cost KIND | the kinds are banish / discard / destroy / reveal. A tap is none of them |
> | a tapped **HERO** as a state | taps are per-permanent by uid through `weaponUsed`, and `perTurnCleared` looks the uid up in `sd.gear`. `weaponUsed["hpow"]` means *the ability was used*, which is a DIFFERENT fact — tapping Blaze's hero must not lock an ability that costs counters rather than `{t}` |
> | the Ponder token | trivial once the rest exists — a real database record whose `sd:"end"` text the existing reader already handles |
>
> **It would be free in this pool, and that is not a reason to fake it.**
> Turn to Mindfire is a Wizard card, so only Blaze and Iyslander can deck
> it and neither hero's ability costs `{t}` — so the tap costs them nothing
> observable. Building it as "the tap is free" is a fact about this pool
> rather than about the rules, which is the shape v2.74 removed from
> Frostbite.
>
> **Also recorded, and not his:** the hero-powCard truncation fix
> un-truncated **Lyath Goldmane's** ability, whose second sentence
> ("Defending action cards you control get +1{d} this turn") still has no
> reader. It is close to `fx.defGrant` (v3.23) — "non-attack action cards
> you control get +1{d} while defending" — so it is a READER, not new
> machinery, and it is the cheapest thing left on Lyath.
>
> **Remaining untouched heroes:** Dash, Azalea, Fai, Enigma, Boltyn, Gravy
> Bones, Lyath, and Briar's 8 `part` cards. Leave **Arakni** last
> (stealth-as-qualifier is filed `noop` by ruling).

> ### Viserai — DONE at v3.20
>
> **Sigil of Silphidae is built** (`notSelf` + `notUid`, and the
> enters/leaves trigger on both boards — see CLAUDE.md and the v3.20
> changelog). The remaining two are **recorded decisions, not work**, the
> same way Iyslander ends with two `part` cards:
>
> | card | why it stays |
> |---|---|
> | Beckoning Haunt | X-cost. Building it is a decision about X, not about this card — see Ice Eternal in `CLAUDE.md`. |
> | Crown of Dichotomy | a two-target ability with no reader. Recorded unread rather than guessed. |
>
> **A hero is finished when every card is either built or has a written
> reason.** Viserai: 30 full / 2 part / 0 none.
>
> ### The open question from v3.19 is CLOSED — answered from the data
>
> `2|Sigil of Suffering|0|` needed no trip to fabrary. The database
> settles it: pitch 1 is printed in **SVI019** and **SBA023** — Viserai's
> and Briar's own Silver Age sets — while pitch 2 and 3 exist only in
> ELE, which neither precon draws from. The resolver already picks 1.
>
> **And the claim that no drill catches it was wrong.** v3.14's oracle
> does: sabotaged to resolve the highest pitch, `decks.test.js` names both
> decks and both sets. Verified, then restored. Nothing to change.
>
> *The lesson, since it is the second time: try the data before booking a
> question. Card images and printing records are the printed product.*
>
> ### BRIAR — the ability is built, the deck is not
>
> **Her ONE mechanic is the Embodiments**, and both clauses of "Essence of
> Earth and Lightning" mint one. Both are now live on both boards, the
> tokens are in the pinned pool, and each carries its own printed destroy
> clock. What is left is her deck and the tokens' OWN text:
>
> | what | note |
> |---|---|
> | ~~Embodiment of Lightning's trigger~~ | **DONE at v3.22** — one reader, one pop site, four tokens (Runechant, Courage, Quicken, the Embodiment). The weapon half of the trigger is carried, so the Embodiment does not pop on a weapon swing. |
> | ~~Embodiment of Earth's buff~~ | **DONE at v3.23** — `effects.defendValue` is the one body and both walls ask it. It exposed a 23-card family below. |
> | her 8 `part` cards | fusion/meld (`Arcane Seeds // Life`, `Burn Up // Shock`, and Weave Lightning's *"if it's fused"*), turn-history predicates over card CLASS (Star Fall's *"played a Lightning card this turn"*, Arcane Polarity's *"been dealt arcane damage this turn"*), and Jack Be Quick's steal. |
>
> **Both tokens are currently inert and that is honest, not a gap.** Earth
> sits on the board doing nothing but counting as an aura (which is
> correct — seven pool cards count auras); Lightning does nothing yet.
> Neither is stronger than printed, which is the direction that matters.
>
> ### v3.35 — THE SPLIT-CARD DIVE, AND ONE GAP LEFT
>
> A player report ("making me pitch for burn up shock", cost 0) found the
> table demuxing `pending` by BLACKLIST — every kind that was not `boost`
> rendered as a PAYMENT, so the declaration opened a pitch sheet whose
> only exit was Cancel. `judge.PENDING_KINDS` is the census now.
>
> The dive also found the INSTANT half unplayable at instant speed. The
> DECLARED HALF decides the window now (union before you choose, that
> half's after, ACTION for meld), which reopens the printed line without
> reopening v2.39's free action point.
>
> **STILL OPEN — the trainer's reaction window.** `Shock` and `Life` can be
> played at instant speed at the TABLE and not in the trainer, because
> everything played through `playRx` is filed as a DEFENDER (`blockRx`) —
> right for a defence reaction, wrong for a plain instant. Untangling that
> is its own change; the refusal names the real reason meanwhile. This is
> the one place the two boards disagree about a split card.
>
> ### SPLIT CARDS ARE BUILT (v3.34) — and were playing themselves
>
> The two horizontal cards print **Meld (You may play 1 or both halves of
> this card. Each costs 0.)** and the engine ran BOTH halves, always,
> asking nothing — Burn Up // Shock dealt **five arcane on play** where its
> top half is a *delayed* four. It is **one card**: one pitch, one defence,
> one card in hand and in the graveyard; only the textbox is doubled.
>
> `played_horizontally` names them (the DB's own flag), `tt` tells the
> halves apart (`ty` flattens both faces), each half reads its OWN
> keywords, and the declaration is asked before the payment because
> melding doubles the base cost. Default is the LEFT half, never both.
>
> **Still an approximation, and stated:** the CR gives priority between a
> melded card's two sides; this runs them in printed order as one layer.
> Both pool cards' halves are independent so nothing is observable —
> revisit if a split card ever prints halves that interact.
>
> ### v3.31 — 13 CARDS WERE PUMPING WHATEVER WAS SWINGING
>
> `attackQual` read the words BEFORE "attack" and `[^.]*` ate the rest, so
> "target attack action card **with cost 1 or less**" restricted nothing.
> All 13 read `tier: full`. The qualifier is one object now
> (`{g, aac, nonAtk, kw, costLe, costGe, powLe, powGe, from, boosted}`),
> `qualMatches` is the one matcher and `qualLabel` the one namer, and an
> unreadable tail REFUSES the clause rather than matching anything.
>
> **Two things worth carrying forward.** "non-attack" contains "attack",
> which handed Mage Master Boots' go again to the next attack — v2.44's
> trap on the keyword that keeps your action point. And a drill was
> **passing because of the bug**: `reactions.test.js` used Stains of the
> Redback as its "no qualifier" fixture, which was only true while the
> restriction was being dropped. When a fix breaks a drill, read the
> FIXTURE before reshaping the assertion.
>
> ### STILL OPEN IN THIS FAMILY
>
> | card | what it needs |
> |---|---|
> | Night's Embrace | "your attacks with stealth get +1{p} **this turn**" — a turn-wide qualified buff, not a next-attack one. `gaNextQ`/`buffQ` are both single-shot. Its ruling is recorded. |
> | Mage Master Boots · Stalker's Steps | the clause sits behind an activation cost, so it goes to the equipment reader and is filed a noop. Both carry the audit's "no parsed grant path" flag. |
>
> ### BRAVO — five gaps, and each is a named mechanism
>
> | card | what it needs |
> |---|---|
> | Thunder Quake | **DONE at v3.32.** Built from the card's PRINTED reminder text, which the database does not carry and which is more precise than the July ruling — an empty-arsenal gate and a FACE-UP put, and it performs the arsenal action rather than replacing it. |
> | Crash and Bash | **DONE at v3.33** — a reveal is a cost that moves nothing, "with crush" is a printed field, and the `defends` trigger fires from `afterDefenders`. |
> | Magmatic Carapace | **DONE at v3.33** — the {t} is part of the pay-cost, and `playAura` fires in `execute` off the actor's GEAR as well as the board. |
> | Pummel | **DONE at v3.31** — its second mode is selectable now that the cost restriction can be read. |
>
> **AND SEISMIC SURGE IS DONE (v3.32)**, which was the real keystone: four
> of his cards create it, a fifth reads it, and it was `tier: none` on
> purpose because `selfDestruct … then X` refuses when X has no reader.
> Its payout is `costOff`, the third qualified single-shot grant beside
> `buffQ` and `gaNextQ`. The token has a clock now, so it stops inflating
> every "auras you control" count.
>
> **BRAVO'S ONE MECHANIC IS THE ARSENAL** — his hero ability turns a
> face-down arsenal card face up and rewards crush, and heave puts one
> there face up. His remaining two cards (Crash and Bash, Magmatic
> Carapace) both mint Seismic Surge, so they are now readers rather than
> new machinery.
> | Staunch Response | **DONE at v3.34** — an optional additional cost, asked before the card resolves (boost's precedent), with the rider reading `opts.addPaid` because the answer belongs to the PLAY. |
>
> ### THE FIVE CRUSH RIDERS — four built, one refusing
>
> `nextTurn` on the side (v3.29) is the schedule; v3.30 built the two
> RESTRICTIONS on it. **A restriction is not a debuff**, and the drills
> assert the difference off the printed words: a debuff carries an amount
> and is spent by the FIRST thing it touches (*"their first attack"*); a
> restriction carries none and is **never spent** (*"during their next
> action phase"*).
>
> | card | shape |
> |---|---|
> | Debilitate | debuff — first attack, -2{p} |
> | Cartilage Crush | debuff — first action, +{r} |
> | Chokeslam | restriction — CAPS an attack action card at printed {p}, never subtracts |
> | Crush the Weak | restriction — refuses the PLAY, before the card leaves the hand |
> | **Walk in My Shoes** | **still refuses** — halving base {p} AND {d} for a turn is neither a cap nor a gate |
>
> **Two lessons worth carrying.** The cap is applied at declaration AND in
> `linkPumps` (which re-adds reaction layers afterwards) — dropping either
> failed no drill until the sabotage pass. And `nextTurnBars` reads
> `isAtkActionCard`, never `isAttack`: **"Reaction" contains "action"**,
> so a `tt` predicate bars an attack reaction the card never names.
>
> ### v3.25 FOUND SOMETHING BIGGER UNDERNEATH THAT FAMILY
>
> **Every defence reaction in the pool blocked for zero at the table** —
> 15 cards, 39 copies, 11 of 15 heroes. `blockRx` was a field judge
> cleared and never wrote or read. Fixed and driven.
>
> **The lesson to carry:** the field existed and the clear existed, which
> made the plumbing look finished. When you find a side field, check both
> halves — who writes it and who reads it — not just that it is there.
>
> ### THE DEFENSIVE SELF-BUFF FAMILY — 13 built, 10 left
>
> Finishing Earth exposed it. The pool prints a whole family of *"this
> gets +N{d}"* defensive buffs and **not one is applied**, because both
> walls read the printed number:
>
> ```
> Blade Beckoner Boots/Gauntlets/Helm/Plating   DONE v3.24
> Wax On (x3)                                   +2{d} vs a cost-0 attack action
> Sigil of Suffering (x3)                       +1{d} if arcane dealt this turn
> Big Blue Sky                                  +1{d} per blue pitched this turn
> Gauntlets/Helm of Unity                       DONE v3.27
> Springboard Somersault · Unmovable            DONE v3.27 (from arsenal)
> Basalt Boots · Mournful Casket    AT-REST conditions — true sitting on the
>                                   board, so the wall alone puts a wrong
>                                   number on screen. Needs a display pass.
> Stonewall Impasse                 clash on defend
> Washed Up Wave                    a choice, plus watery grave
> Rally the Coast Guard · Staunch Response      paid
> ```
>
> **Most read `tier: full`** — the clause is consumed, the buff never
> reaches a wall — and every one is WEAKER than printed, so the one-sided
> fairness sweep is blind to them too.
>
> `defendValue` is where they go, so each is a READER rather than new
> machinery, and it now takes `{base, weaponAttack}` from the caller.
>
> **The gearDef trap turned out not to bite for Blade Beckoner**, and the
> reasoning is worth keeping: its condition is a property of the INCOMING
> attack, so out of combat there is no buffed number to display and the
> base shown on screen is correct. A buff gated on something knowable at
> rest — Basalt Boots' Seismic Surge token, Mournful Casket's graveyard —
> WOULD show wrong, so for those, do `gearDef` and the wall together.
>
> **Wax On is a DEFENCE REACTION**, played rather than declared, so it
> takes a third path through the wall — not the declared-defender loop.
> The rest gate on turn history, board state or a paid cost.
>
> ### NEXT — eleven heroes after her
>
> The user's own heuristic, and the data backs it: **a hero sharing a class
> with a finished one transfers the most work.** Blaze is `Wizard` like
> Iyslander; Boltyn is `Light/Warrior` like Dorinthea; Briar was
> `Elemental/Runeblade` — Viserai's class and Iyslander's talent, which is
> why she went first. **Leave Arakni last** — stealth-as-qualifier is filed
> `noop` by ruling, so his number is the least honest in the pool.
>
> ### The method, in one line each
>
> - **Find the hero's ONE mechanic first**, and **read the hero ability
>   before the cards** — Kayo's clause 2 was worth half his deck.
> - **Every bug this phase found reported `tier: full`.** They were read,
>   and read wrong. Coverage counts consumption, not faithfulness.
> - **Sabotage every new drill, and verify the sabotage changed the file.**
>   A sabotage that silently fails to apply is a false green.
> - **Assert on hands, life and zones — never on `feed` prose.**
> - **Build to print, or refuse.** Inert is honest; above-rate steals games.
> - Ship the loop: build → drive → drill → sabotage → `npm test` →
>   `npm run fairness` → `npm run audit` → bump `APP_VER` → `CHANGELOG.md`
>   → `CLAUDE.md` → push to `main`, which IS the deploy.
>
> ### Two recurring shapes worth holding in mind
>
> **A rule that exists on ONE BOARD ONLY.** v3.17 found three at once, all
> in the trainer and none at the table. `effects.beginEndPhase` is the
> pattern to copy: one pure, seat-relative body, both boards calling it and
> restating nothing. A comment saying "the order here matches the other
> board's" is not a mechanism.
>
> **A guard aimed at the wrong file, shape, scope or slice** — it passes by
> finding nothing. `failstates.js` scanned a file the semantics had left;
> the `makeEffects` guard excluded the only call form anyone writes; a rust
> guard tripped on Valiant Th*rust*. Sabotage the guard, not just the code.

## WHERE WE ARE — v3.16

`npm test` → **1160 drills, 0 failed** (0 skipped with a live DB cached;
4 drift drills skip without one) · `npm run fairness` clean ·
`npm run audit` → 405 pool cards, **308 full / 75 part / 22 none** ·
`tools/failstates.js` → **0 UNFAIR**.

**305 went to 304 and back, and the round trip is the point.** Cold Snap
reported `full` while doing nothing (v3.02 dropped it to the truth), and
now reports `full` because the card works. A number that goes down
because a lie was removed is the number improving.
`node` is at `~/node/bin`, **not on PATH** —
`export PATH="$HOME/node/bin:$PATH"`.
**A push to `main` IS the deploy** (standing authorization, 2026-08-03).

```
1. ENGINE   ✔ merged · ✔ pool pinned · ✔ drift guarded
2. PHASE B  ✔ DONE — 0 UNFAIR (watery grave + suspense, v3.01)
3. PHASE C  ✔ IYSLANDER — freeze (v3.03), equipment abilities (v3.04),
              hand abilities (v3.05), Brain Freeze (v3.06). 31/33 full;
              the two left are RECORDED DECISIONS, not work — see below
            ▸ NEXT HERO — 12 remain; Viserai is the gentlest curve
4. PHASE A  ☐ retire Battle — carries the tuning debt, needs a phone
```

### IYSLANDER IS DONE, AND TWO CARDS ARE STILL `part`

That is not a contradiction and it must not be read as one. Both are
**recorded decisions** with the reason written down, and building either
would make the card *wrong* rather than *more complete*:

| card | why it stays |
|---|---|
| **Ice Eternal** | the pool's only X-cost card. `create X ... tokens` is REFUSED rather than read as one — creating a single token for a card that charges for X is quietly weaker than printed, and coverage reads that as `full` |
| **Stir the Aetherwinds** | its bonus half IS read; the instant-speed grant is not. Its `full` at v2.99 was an unanchored regex swallowing a whole sentence and modelling half of it — the tier was lowered ON PURPOSE at v3.00 |

**A hero is finished when every card is either built or has a written
reason.** Chasing the last two tiers here buys a number and costs the
truth of the number.

### NEXT HERO — the shortlist, and why

Twelve remain. **Viserai** is the recommendation: his passive is already
built (`bAct(n).viseraiPassive`), runechants are real board auras since
v2.23, and his deck's one mechanic — the rite — has a live schedule to
hang off. **Lyath** is the best-covered on paper but his chapter-3 text
is the pool's densest. **Leave Arakni last**: stealth-as-qualifier is
filed `noop` by ruling, so his deck's coverage number is the least
honest one in the pool.

Find the hero's ONE mechanic first, and **read the hero ability before
the cards** — Kayo's clause 2 was worth half his deck.

### The five things v3.00–v3.01 found, and why no tool saw them

| find | why it was invisible |
|---|---|
| Under Loop in a deck AND on the chain | the census walk had parked against a boost pending it could not answer |
| 22 cards stopped resolving | the 22MB database is gitignored, so every card drill SKIPPED |
| phantasm inert at the table | the tool grading it counted mentions in a file the semantics left in v2.53 |
| every graveyard card playable at the table | the zone rule lived in the trainer's UI, where no reducer could reach it |
| suspense paid on the way IN | no arena-departure schedule existed on either board |

**All five are one family**: a guard aimed at the wrong thing reports
success by finding nothing, and a rule kept on one board is a rule the
other board does not have.

## RETIRING `Battle` — the standing detail (option A above)

> **This was "THE CURRENT JOB" through v2.84 and is now one of two.** The
> cost below is still accurate; what changed at v3.00 is that the reason
> to hold it became explicit — it carries the tuning debt, so sequence it
> with a play session. See `FINISH.md` Phase A step 2.

**The gate is PASSED (v2.80)** and the feature gap is measured, then
CLOSED (v2.83–v2.84). What is left is deleting the loser.

### Why it is worth finishing, concretely

**The CR 4.4.3 end phase is implemented TWICE** — `Battle.endPhaseCF`
and `judge.js` — and so is the combat path. That is what makes wiring a
card a two-place job: the semantics are one copy (`effects.js`), but the
*schedule the card fires on* is not. Every hero from here pays that tax
until `Battle` goes.

### The gap, censused v2.83 and closed at v2.84

| feature | verdict |
|---|---|
| Advisor | **DONE** — `advView` + both call sites explicit |
| score / trophy | **DONE** — local wins only; `wasted` was already tracked |
| boost | **done** (v2.84) — the semantics were already shared; only the question was missing |
| next-swing prediction | **drop** — reads the `[3,4,5]` fabrication; a card-playing seat has no such number |
| `[3,4,5]` tuning | recorded decision: retuning is a play session, not a drill |

### What it costs

`Battle` is **2,377 lines**, and **70 drill anchors resolve inside it**
across five files — `priority` 33, `mirror` 21, `dorinthea` 6, `kayo` 5,
`sides` 5. (An earlier note said "~100 references"; 70 is the measured
number of anchors that actually land in `Battle`, and the rest of the 109
scanned point elsewhere in `index.html`.) Whatever replaces `setG`
**must keep the invariant-judge funnel** or the guard rails go dark.
Budget the drill repointing as the real work; the deletion is the easy
half.

**Read `HANDOFF-MERGE.md`** for what the merge took and the eight things
it learned the hard way.

### Also open, and small

- **`engine/effects.js` has 44 second-person literals.** A log line is
  read by both seats and must name one; a *refusal* is returned to
  whoever acted and correctly says "you". Telling them apart is a
  judgement per line. Pinned as a ledger in `test/judge.test.js`.
- ~~the hardcoded dummy~~ **FIXED at v2.84** — six player-facing strings
  in `effects.js` named "the dummy" and now read `foe(n).name`; the one
  in `parser.js` is seat-neutral, because at parse time there is no game
  state to name anybody. Pinned, and the guard excludes the keyword
  LEDGER notes by name rather than tolerating them with a loose regex.
- **Those ledger notes are stale**, and that is a docs job: several say
  "the dummy pays no costs" / "has no action phase", both false since
  v2.71. They reach `AUDIT.md`, never a player.
- **The boost line lands in the feed AFTER the play it paid for**,
  because `execute` accumulates it into `declNote`. In a training sim the
  sequence is the lesson, so it belongs with the voice pass above.

---

## HOW A HERO GETS DONE (the Kayo method)

**Dorinthea confirmed the method and added one step.** Her whole deck is
"a WEAPON attack, swung twice" — the hero ability frees the blade for a
second swing, the Dawnblade rewards its *second* hit each turn, and the
Reprise family pays you for the opponent blocking from hand. Reading the
hero ability first explained the deck's go-again density before a line of
code was written.

**THE NEW STEP IS 3a: CENSUS THE SHAPE ACROSS THE WHOLE POOL BEFORE FIXING
IT.** Every fix this cycle turned out to be a rule with a list behind it,
and the list was always longer than the hero:

| the shape | on her deck | in the pool |
|---|---|---|
| a gated pump read twice | 6 cards | **7 cards, 4 heroes** |
| a printed `instead` summed | 4 cards | 4 cards, 3 keyword gates |
| a target restriction dropped | 9 cards | **13 cards, 6 heroes** |
| a quoted granted ability dropped | 6 cards | **7 cards, 3 heroes** |

One `node -e` over `tools/audit.json` gives the list in a minute, and it is
what turns "fix the card" into "fix the rule" — which is rule 4 below with
evidence attached rather than as an aspiration.

1. **Find the hero's ONE mechanic.** Kayo's whole deck is "a card with 6 or
   more {p}" wearing three different sets of words. Read the deck list and
   the hero's printed text together before touching code.
2. **Read the hero ability first.** Kayo's clause 2 was worth *half the
   deck* — 22 of 47 cards satisfied his own threshold before it, 45 after.
   A hero ability that looks like bookkeeping can be the engine.
3. **Diff what the card PRINTS against what the engine GRANTS**, card by
   card. Every real bug this cycle looked like this, and **every affected
   card reported tier `full`** — they were read, and read *wrong*.
4. **Fix the RULE, not the card.** Five separate spellings of
   `(c.power||0)>=6` became `parser.pow6`. Never special-case a card by
   name; a drill should fail if a card's name appears in the wiring.
5. **Write the drill, then SABOTAGE it.** Non-negotiable — see below.
6. **Play it.** Several bugs this cycle were invisible to every tool.

---

## THE RULES THAT CAUGHT EVERY BUG

**1. NEVER INVENT CARD EFFECTS.** Teach the parser to read the text; never
special-case by name.

**2. NEVER PARSE AHEAD OF WIRING.** Reading a clause marks it consumed,
which raises the card's tier and makes the audit claim it works.
(`fx.handAbility` deliberately does *not* touch `tier` for this reason.)

**3. READ THE WHOLE PHRASE OR REFUSE.** A loose substring silently drops
printed restrictions.

**4. SABOTAGE EVERY NEW DRILL.** Reintroduce the bug, watch it fail,
restore. **This caught three drills that proved nothing in one session** —
Strongest Survive shipped with no drill at all, Beaten Trackers' drill
grepped for a variable that survives deleting the gate, and a "never
reaches damage" guard keyword-matched a log string. **Pin the gate, not the
identifier.**

**4a. VERIFY THE SABOTAGE ACTUALLY CHANGED THE FILE.** Three sabotages in
the Dorinthea cycle silently matched nothing — a `==` written for a `===`, a
comment that did not match the comment in the file, a regex against text
that was never there. **A sabotage that edits nothing looks exactly like a
drill that does not bite**, and reads as a pass. Hash the file before and
after, or diff it.

**4b. A GREP IS SATISFIED BY A COMMENT — IN BOTH DIRECTIONS.** v2.68 shipped
a drill that stayed green with the gate replaced by `if(false)`, because the
identifier it searched for was sitting in the comment above the gate: a false
**pass**, which is worse than no drill. v2.66 hit the mirror image, where a
comment containing an example of a bug tripped a scan that was working
correctly — there the fix is to reword the prose, never to weaken the scan.
Prefer moving the decision into a pure engine function you can DRIVE
(`parser.idleCounterWipes`, `parser.rxPump` were both extracted for exactly
this); when you must scan source, strip comments first.

**4c. TAKE BACKUPS UNCONDITIONALLY.** `fairness | grep … && cp file /tmp/bak`
did not copy anything, because the summary line reads `4 finding(s)` and the
grep pattern said `findings`. The `&&` short-circuited, and the "restore"
afterwards reverted the file to a snapshot from an earlier round — silently
deleting a finished fix. Never chain a backup behind a test.

**5. ASSERT ON STATE, NEVER ON LOG PROSE.** Hands, life, zones, counters.

**6. THE USER READS CARDS FOR A LIVING. ASK THEM.** Every ruling this cycle
came from asking. They have explicitly invited it.

---

## THE TRAPS, IN ONE PLACE

- **A LOCAL MAY NEVER SHADOW `act`/`foe`/`you`/`opp`.** Block-scoped, it
  puts the global in the temporal dead zone for the *whole block including
  lines above it*. This shipped a crash (v2.54). `test/shadow.test.js`
  guards it.
- **THE TDZ BITES TWICE.** v2.63: `foeSwing` was called from a `useState`
  initializer — safe for a hoisted `function`, fatal once it reached for
  `gy` and `_EFX`, which are `const`s declared further down the component.
- **"YOUR ACTION PHASE" IS NOT `phase === "action"`.** In FaB the combat
  chain lives inside the TURN PLAYER's action phase, so defending on their
  turn is still "action". Gate on `turnPlayer === actorOf(n)` too.
- **WHEN A RULES FUNCTION MOVES, THE LEDGERS MUST FOLLOW IT.** A source
  guard aimed at the wrong file **passes by finding nothing**;
  `test/actor.test.js`'s anchors name their source file.
- **The database states the type twice** and they disagree on 5 records.
  `card.ty` is the authority; DFCs parse the front face of `tt`.
- **`youMut()`/`oppMut()` to write, always.** A per-side field written as a
  top-level game key silently does nothing.
- **Store the rng back** (`n.rng = rng`).
- **The browser caches `engine/*.js` hard.** Re-fetch with `cache:"reload"`
  then navigate with a fresh `?v=` before believing anything.
- **Driving the UI from JS needs one click per tool call** — two in a tick
  batch into one React render and the two-tap interaction re-arms.
- **Test at phone dimensions (393×852).**
- **`computer` clicks time out on the deployed page; `javascript_tool` works.**
  Drive taps with `document.querySelectorAll('button')[i].click()`, still one
  click per tool call. Find a card by its image `alt` and its class prefix
  (`g ` = gear, `hc ` = hand rail) rather than by index, which shifts.
- **A `dummyDefence` stub must return `{n, note}`, not the state.** The Kayo
  test ctx returns the bare state and gets away with it because those drills
  only ever drive `runOps`; the moment you drive `execute` it reads
  `undefined.log` and dies.

---

## WHAT IS STILL OPEN ON THE TWO FINISHED HEROES

**Both end in the same place, and it is one rule, not seven cards.**

| hero | card | the unread clause |
|---|---|---|
| Kayo | Beaten Trackers | "you may destroy this. **If you do**, gain 1 action point" |
| Dorinthea | Refraction Bolters | "you may destroy this. **If you do**, the attack gains go again" |

That is the **"If you do, …" family**, deliberately unread since v2.04
because running the rider without charging the cost is the free-ability bug
that version fixed. The machinery to ask properly now exists —
`engine/prompts.js`'s `pay` variant, and `pick` with `min:0` — so this is a
spec object plus a queue site, not new machinery. **Build it once and both
heroes close**, along with the rest of the 24-card family (see CLAUDE.md,
"Optional costs").

The rest are genuinely separate, and each is small:

- Kayo: Agile Windup (`Instant - Discard this:` on a card in HAND),
  Rally the Coast Guard (the `+3{d}` rider).
- Dorinthea: Agile Engagement ("defended by an attack action card"),
  Oasis Respite (a life comparison across heroes), Wreck Havoc (turning a
  card in an opponent's arsenal face up).

---

## WHICH HERO NEXT

Regenerate this table rather than trusting it — the snippet is in
`KAYO-GUIDE.md` §1, and a per-hero version is in this session's scratchpad
pattern (walk `W.DECKS[k]`, normalise `name|pitch`, read `A.cards[...].tier`).

```
hero          full part none   hero ability
  lyath         29    2    0   UNBUILT
  iyslander     28    3    0   UNBUILT
  viserai       25    4    0   built
  dorinthea     29    4    0   built    <- done
  briar         23    5    0   UNBUILT
  kayo          27    2    1   built    <- done
  ...
  azalea        19    3    3   UNBUILT
  arakni        11    9    2   UNBUILT  <- leave for last
```

**Recommended: IYSLANDER, and she is now UNBLOCKED.** 28 full / 3 part /
**0 unreadable** — the second-best-covered deck — and her hero ability is
genuinely unbuilt, so the "find the hero's one mechanic" exercise is real
rather than already done.

**Both axes she was going to test are now BUILT and verified in play**
(v2.71–v2.75), so plan around them existing rather than around discovering
them:

1. **playing at instant speed from the arsenal** (her clause 1) — live;
   driven in a real game by playing Cold Snap from arsenal during the
   opponent's turn.
2. **acting during the opponent's turn** (Ice → Frostbite) — live; the
   token lands on the opponent's board, taxes through `effCost`, and thaws
   in the shared end phase. `foeTurnIce` mints a real token.

What is left on her is **freeze (Cold Snap)** — ruled, not built, see
`HANDOFF-MERGE.md` — and **Aether Icevein's rider**, which sits behind the
unbuilt Ice Fusion condition.

Alternatives, both reasonable:
- **Viserai** (Runeblade, ch1) — 25/4/0, hero ability already built, tests
  runechants and arcane. The gentlest curve left.
- **Lyath** — the best-covered deck (29/2/0) but chapter 3, and its
  crowd/boo mechanic is the least conventional in the pool.

**Leave Arakni for last** — 11 full / 9 part / 2 none, and traps/marks are
their own subsystem.

---

## THE JOB

**Build carefully, one piece at a time, and never claim more than is true.**
Read `CLAUDE.md` first, in full. Most entries exist because breaking the
rule already cost a real bug.
