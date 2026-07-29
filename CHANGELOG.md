# Dawnblade — changelog

Extracted from the `APP_VER` comment in `index.html` at v2.32, where 19
versions of prose had accumulated on a single 14,723-character line that
shipped to every player on every page load. `index.html` now carries the
version and a one-line summary; the history lives here.

Newest first. `APP_VER` bumps by 0.01 per release (see CLAUDE.md).

---

## v2.32

THE FAIRNESS SWEEP — tools/fairness.js asks "is any card STRONGER than printed?", which is a different question from the audit's "how much did we read?" and the one that decides whether a game is fair. Three bugs shipped in a week with the audit reporting IDENTICAL tiers before and after each; every affected card said full. On its FIRST run the sweep found two more: Aether Quickening and Swiftwater Sloop x2 granted go again outright because their gated clause starts "Surge -" / "High Tide -" rather than "If", so the conditional handler never saw it and a rule matching the TAIL "it gets go again" fired — now anchored at both ends. And Emeritus Scolding x3 read "INSTEAD deal 4" as an ADDITION, dealing 6 where the card prints 4; "instead" now REPLACES, with execute suppressing the base op when the condition fires. The sweep is deliberately one-sided (too-weak is failstates.js's job) and test/fairness.test.js pins that it stays quiet, with each check backed by a real card — reintroducing the four bug classes makes it report 41/33/22/3.

## v2.31

PRINTED go again vs MENTIONED go again. The database's card_keywords is a keyword INDEX — it lists every keyword appearing on the card, including ones the text only grants conditionally — so keeping it apart from granted_keywords (the Kayo fix) was necessary but NOT sufficient. Seeding fx.ga from it gave 27 pool cards unconditional go again against their own printed text: Buckwild went again on an empty pitch zone, and Runerager Swarm logged "condition not met" and then went again anyway, which was visible in a play session and not noticed. Go again keeps your action point, so it is the most valuable keyword in the game to get wrong. The discriminator is the printed layout: a real keyword line stands alone in its own paragraph while a granted one sits inside a sentence; if the text never mentions it, trust the list. 77 cards keep it, 27 lose it, and the conditional path still grants it when the condition is MET.

## v2.30

NEXT-ATTACK BUFFS WERE WRONG TWICE OVER, and the coverage audit could see neither — every affected card reported tier full. They were read, and read WRONG. (1) The QUALIFIER was swallowed on 24 cards: "your next ARROW attack gets +3{p}" emitted a bare buffNext, so an arrow buff landed on a sword and a Runeblade buff on a Generic. attackQual now reads it off the printed type line, distinguishing "Brute or Warrior" (OR) from "Pirate ally" (AND), and qualified buffs ride on a new side field buffQ — where a buff that does not match is NOT spent, it waits for an attack it applies to. (2) The buff was COUNTED TWICE on 34 cards: fxParse's whole-text fallback for "gains +N{p}" matched the same clause the buffNext rule already took, and execute added both — Act of Glory granted +12 from a printed +6, the Lace cycle +6 from +3. The fallback now refuses when a buffNext op already read that pump, while still catching a genuine self-pump. Both regressions drilled and both drills proven to bite.

## v2.29

optFilter must consume the WHOLE subject phrase or refuse. v2.28 read it with loose substring tests, which shipped a real bug: Mounting Anger says "banish an attack action card from your hand WITH COST LESS THAN THE NUMBER OF DRACONIC CHAIN LINKS YOU CONTROL", the test saw "attack action card", returned {type:attack} and silently dropped the limit — so any attack card in hand became a legal banish, strictly better than printed. Its look-alike Rising Resentment escaped only because its PAYLOAD was unreadable, not its filter. Now three shapes refuse and are drilled: a dynamic limit, "ANOTHER aura" (an exclusion a field filter cannot express), and "a card with crush" (a rules-text qualifier). Mounting Anger correctly drops full -> part and the coverage baseline is repinned DOWN on purpose — the previous number was an over-claim.

## v2.28

OPTIONAL COSTS ARE READ. "You may banish an aura from your graveyard. If you do, deal 1 arcane damage" — 24 pool cards are shaped like this and NOT ONE was fully read, because the rider hangs off an optional cost and running it free is the bug v2.04 fixed. prompts.js's `pick` variant gains an `ops` rider that fires ONLY when cards actually moved, so declining costs nothing and grants nothing; the parser pairs the two clauses in fxParse (they arrive separately, split on the period) into fx.optCost and reads the cost's subject into a prompts filter from printed fields only, refusing anything it cannot read honestly rather than guessing. Wired for the `attacks` trigger, queued via promptQ and addressed to the ACTOR. Pool goes 258 -> 264 full, 35 -> 33 none. Also in this version, from a spun-off task: the runechant pop now credits hist.arc, so arcDealt and the "arcane dealt" pip finally see Viserai's primary arcane source.

## v2.27

THE PRIORITY MACHINE, IN SHADOW. Roadmap Phase A step 4 is the one that changes CONTROL FLOW rather than field names, so it lands in two moves; this is the first. DawnPriority.fromTrainer derives phase/step/priority/turnPlayer/attacker from the trainer's mode/bphase and setG merges them into every state, but nothing consumes them yet. Two payoffs: it turns FOUR dormant invariants on (BAD-PHASE, BAD-STEP, BAD-PRIORITY and PRIORITY-IN-CLOSED-PHASE all guard with != null, and the trainer carried none of those fields, so they had never fired on a real game since v2.21); and it proves the mapping before any control flow depends on it. The CR-counter-intuitive case is verified live: in the defend step the TURN-PLAYER holds priority (CR 7.3), so while the dummy swings canAct(you) is false while canDeclareDefenders(you) is true — declaring blockers is a free simultaneous game-state action (CR 7.3.2), not a priority action. Attack vs defense reaction windows now come out of speedAllowed correctly on both sides. The clock is deliberately NOT wired: priority.js counts player-turns while the trainer's turn counts only your own and feeds the escalation table and the score. ALSO: html-balance.test.js now rejects an orphaned comment terminator — a block comment closed twice, so the prose after it becomes code. That exact bug shipped during this version and broke the page completely while all 338 drills stayed green, because the orphaned prose had balanced brackets.

## v2.26

THE SEEDED RNG. engine/rng.js is a pure, serializable random source (mulberry32) carried IN game state as s.rng, and every game-affecting draw now comes off it: both opening shuffles, the pregame throw, Knucklehead's d6, intimidate's pick from the opponent's hand, and the dummy's graveyard recycle. A match now has ONE seed, stamped when the match begins and threaded Loadout -> Pregame -> Battle through cfg; the throw runs on a derived sub-stream so the opponent's hand does not correlate with anyone's deck. rng.seed is the replay key and rng.n a draw counter that doubles as a desync canary, and both now ride in the JUDGE!! report so "this looked wrong" becomes a reproducible game. The unseeded DawnGame.shuffle was DELETED rather than left beside the seeded one under a shorter name — the same reasoning that removed sides.js's you/foe in v2.24. Also fixes mkRune, which minted runechants and credited made/aura history to seat 0 whoever played the card — the same seat-hardcoding class as popRunechants. Cosmetic randomness (taunts, trophy text, the random-hero button) is deliberately left on Math.random.

## v2.25

THE RULES CORE SPEAKS IN ACTOR TERMS. Five of the seven functions ROADMAP-MULTIPLAYER.md names as the rules core — runOps, execute, resolveStack, tryPlay, takeIt — now resolve relative to s.actor instead of a hardcoded seat 0 (~430 call sites). Two genuine seat-hardcodings fixed on the way: popRunechants(n, 0, ...) popped SEAT 0's runechants whoever was swinging, and tapTwice's `act` parameter silently shadowed the global act() helper for that whole closure (renamed `commit`). A literal sides[0]/sides[1] inside a migrated function is now a drill failure — it is the same bug as you(), wearing a different hat. The ledger also grew an honest denominator: it tracks exactly the seven functions the roadmap names, so newTurn and foeSwing are visibly PENDING rather than quietly missing; both stay last on purpose because they encode the DUMMY specifically and get replaced when seat 1 gains a real action phase.

## v2.24

THE ACTOR SEAM — ROADMAP-MULTIPLAYER.md Phase A step 1, "the whole ballgame". you() means SEAT 0, not "the player acting", and the two readings only coincide because one seat ever acts; the moment a second human sits down, every rules function draws from the wrong deck. So perspective and actor come apart: you()/opp() stay as UI helpers, and act()/foe()/actMut()/foeMut() read a new shared s.actor for the RULES. actor defaults to 0, so act(s)===you(s) today and every swap is behaviour-identical NOW while being correct for seat 1 later — which is what makes this migratable a function at a time instead of big-bang. runOps is migrated (92 call sites); execute/resolveStack/tryPlay/takeIt are pinned as PENDING in the new test/actor.test.js ledger, which fails if a migrated function reaches for you( again. Also DELETED sides.js's dead seat-hardcoded you/foe rather than pinning them: the trainer's actor-relative foe would have collided with DIFFERENT semantics (sides[1] vs sides[1-actor]), so KNOWN_COLLISIONS SHRANK to [endTurn, other].

## v2.23

RUNECHANTS ARE AURAS, NOT A COUNTER. The printed token is a "Runeblade Token - Aura", and seven pool cards ask about auras generically ("if you control 3 or more auras", "you may destroy an aura you control", "whenever you play an aura") — none of which could ever see an integer. They are now real board permanents, so they render the actual token art instead of the text chip "Runechant ×2", and runeCount/auraCount read the board. Two rules fixes fall out: the trigger fires on PLAY, so a runechant the attack itself conjures (Viserai's rite) no longer pops on that same attack; and because a triggered ability sits above the attack on the stack, the arcane resolves at declaration BEFORE the attack's damage rather than after it. Also: attack targets (CR 1.4.5) — resolveEntry carries an ally's life, engine/game.js gains attackTargets/damageAlly/resetAllyLife and prompts.js a sixth `target` variant; an attack on an ally cannot be blocked (CR 7.3.2a). Trainer wiring for the target prompt is still to do — see CLAUDE.md.

## v2.22

JUDGE!! — a bug report written at the table. The button sits on the log pane and captures the whole board with the note (zones with uids, counters, chain, prompt, the feed, and any invariant violations), so the note can be one line; Copy or Save Report. Also fixes a real rules bug: CR 4.4.3f says "if it is the first turn of the game, all other players draw cards until the number of cards in their hand is equal to their hero's intellect" — the non-turn player refills on turn one only. The opponent-first opening never did it, so going second cost an extra swing AND left you short-handed for your first action phase. That is a large part of why opponent-first played harder than it should.

## v2.21

THE GUARD RAILS. engine/invariants.js is a judge that audits the STATE rather than the cards — a card in two zones at once, a per-side field written to the game object, a defending card re-declared on a second chain link (CR 7.3.2b), priority held in a phase that has none (CR 4.2.1/4.4.1). It is wired into setG, so every state change in a real game is audited; it never throws. Four genuine CR violations fixed in engine/priority.js: priority was granted during the start and end phases, the defend step handed priority to the defender instead of the turn-player (CR 7.3), only the turn player's floating resources fizzled instead of BOTH players' (CR 4.4.3e — a real two-player bug), and the action point was issued in the end phase instead of the action phase (CR 4.3.2). New: tools/failstates.js re-reads every card and asks how it goes WRONG at the table rather than how much text is unread, and feeds sweep.html a ranked section 4. It found the noop blind spot: phantasm and watery grave are filed as "does nothing", so Spears of Surreality, Enigma Chimera and five Gravy Bones allies report tier=FULL from coverage alone. CORRECTED in v2.23 — the tool now cross-checks the trainer by name the way the sweep does, because phantasm IS enforced (the trainer pops the attack at declaration) and reporting it ignored from parser status was an over-claim. Watery grave is the real half-built one: the permission to replay from the graveyard exists, the face-down rule does not.

## v2.20

THE MIRRORS ARE GONE — index.html now LOADS engine/*.js with plain script tags instead of carrying a hand-mirrored copy of every shared function. 51 duplicated definitions deleted (-55KB, ~20% of the file); one copy of each function now exists in the project and drift is impossible by construction. sync.test.js flips from "the two copies must match" to "there must be no second copy", and pins the three engine/trainer name collisions (endTurn, other, you) that wiring priority.js will have to resolve. Still no build step: plain UMD scripts, works over file://.

## v2.19

Two-tap hand — first tap peeks the card at a readable size, second commits (play, pitch, defend, react, arsenal all through one cell). Equipment abilities show their own art instead of a text placeholder. Fixes five v2.18 leftovers where ward/hist/blockH/blockG/blockRx/paySel were written to the game object instead of the side.

## v2.18

THE MIGRATION IS DONE — every counter and status joins the zones on sides[], both seats are built by one makeSide, and flatRemaining hits 0. Cost readers now take a SIDE, not the game.

## v2.17

The prompt sheet becomes general — pick-a-card, choose-one modal, pay-or-decline, reveal, plus opt, all as DATA specs in engine/prompts.js rather than a branch per card. Prompts are addressed to a SIDE, so a ruling can ask the opponent.

## v2.16

The player's zones and life join the opponent's on sides[] — both seats now declare an identical zone set, and the dummy gains the arsenal, pitch, banish and soul it never had. Reads via you()/opp(), writes via youMut()/oppMut(). Fixes a pre-existing bug where auras that crumbled at the top of your turn were restored to the board on the same line.

## v2.15

The opponent's deck, hand, graveyard, iron, board and life move off the flat d* stubs and onto sides[1].

## v2.14

Multiplayer groundwork — engine/sides.js (symmetric two-sided state + lossless legacy bridge), engine/priority.js (phases, chain steps, priority passing), and the rock-paper-scissors pregame whose winner CHOOSES the seating.

