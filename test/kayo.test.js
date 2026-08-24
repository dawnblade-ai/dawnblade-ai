/* ============================================================
   KAYO — the "6 or more {p}" engine.

   Kayo's deck is one mechanic wearing three sets of words, and until
   v2.55 the engine got all three wrong in ways no tool here could see.

   CLAUSE 2 — "Attack action cards you own get +1{p} while they are in
   any zone other than the combat chain." The combat chain is where an
   attack STRIKES, so this is deliberately NOT a damage buff: it is a
   THRESHOLD rule. 22 of the 47 deck cards print 6 or more; 23 more are
   attack actions printing exactly 5 — and those 23 are precisely the
   pitch-2 and pitch-3 cards you pitch for resources. Without the clause
   the pitch-zone checks essentially never fire and the hero does
   nothing. RULING (user, 2026-08-08): every 6+ check reads the buffed
   value, the strike reads the printed one.

   THE DISCARD — "draw a card then discard a random card" parsed to
   `[["draw",1]]`. The discard was silently deleted, so the cards drew
   for free, and the riders that ask "if a card with 6 or more {p} is
   discarded THIS WAY" then read the whole graveyard instead. Since an
   attack card is put into the graveyard AT DECLARATION, that made the
   condition satisfiable by any 6-power attack already played — and by
   the attacking card itself.

   Assertions here are on HANDS, ZONES and NUMBERS. Two v2.45 bugs lived
   under drills that read the log while the engine did the wrong thing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;
const B = require("../engine/build.js");
const GM = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");
const { loadData } = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
/* ONE DATABASE, AND IT IS REGISTERED WITH THE JUDGE. `effectsFor` reaches
   the card records through `judge.setDb`, not through a context key, so a
   file holding its own copy builds a context whose `db` is EMPTY — and an
   empty db does not throw, it refuses in a log line. Clause 3's Might
   token then resolves to nothing and the drill reads a bare board. */
const DB = () => H.db();

const W = loadData();
const kayoHero = () => W.HEROES.find(h => h.k === "kayo");
const kayoDeck = () => GM.parseDeck(W.DECKS.kayo);
const kayoBuild = () => B.buildSideDefault(kayoHero(), kayoDeck(), DB(), RNG.make("kayo"), {n: 0}).b;
const card = nm => {
  const e = kayoDeck().deck.find(x => x.name === nm) || kayoDeck().gear.find(x => x.name === nm);
  return C.resolveEntry(DB(), e, "SKA");
};

/* ---- CLAUSE 2 --------------------------------------------------------- */

test("clause 2 is read off the hero's PRINTED text, with its own number", {skip}, () => {
  const b = kayoBuild();
  assert.equal(b.atkPowOffChain, 1,
    "the +1 must come from the printed clause, not from a constant in the engine");
  assert.equal(b.mightOnFirst6Discard, true, "clause 3 is read too");
});

test("clause 2 lifts a printed-5 ATTACK ACTION to 6 for a threshold", {skip}, () => {
  const b = kayoBuild();
  const backhand = card("Unexpected Backhand");          // pitch 3, printed power 5
  assert.equal(+backhand.power, 5, "fixture drifted — Unexpected Backhand should print 5");
  assert.equal(P.zonePow(backhand, b), 6);
  assert.equal(P.pow6(backhand, b), true, "a printed 5 counts as 6 while off the chain");
  /* and WITHOUT the hero it is still a 5 — the buff belongs to Kayo, not
     to the card, so nothing may bake it into the card itself */
  assert.equal(P.pow6(backhand, null), false);
  assert.equal(P.pow6(backhand, {atkPowOffChain: 0}), false);
});

test("clause 2 does NOT lift a Block — it says ATTACK ACTION cards", {skip}, () => {
  const b = kayoBuild();
  const tom = card("Test of Might");
  assert.ok(!P.isAtkActionCard(tom), "Test of Might is a Block, not an attack action");
  assert.equal(P.zonePow(tom, b), tom.power == null ? 0 : +tom.power,
    "a Block gets nothing from a clause about attack action cards");
});

/* THE CENSUS, pinned. A number moving here should be a deliberate edit —
   it is the difference between the deck's engine being on and off. */
test("clause 2 turns 22 of Kayo's 47 deck cards into 45", {skip}, () => {
  const b = kayoBuild(), d = kayoDeck();
  let printed = 0, effective = 0, total = 0;
  for(const e of d.deck){
    const c = C.resolveEntry(DB(), e, "SKA");
    total += e.q;
    if((c.power != null ? +c.power : 0) >= 6) printed += e.q;
    if(P.pow6(c, b)) effective += e.q;
  }
  assert.equal(total, 47, "Kayo's deck is 47 cards");
  assert.equal(printed, 22, "printed 6-or-more");
  assert.equal(effective, 45, "with clause 2 — the two that stay out are the Test of Might copies");
});

/* THE STRIKE IS UNAFFECTED. This is the half of the clause that is easiest
   to get wrong in the generous direction, and generous is the direction
   that steals games. */
test("clause 2 never reaches the damage path", {skip}, () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* Keyword-matching the LINE was too blunt: it flagged a log string that
     happens to contain the word "dealt", and a `zonePow` reading a card in
     the defender's HAND — a perfectly legal threshold. What actually
     matters is narrower and checkable: zonePow must never feed a value that
     BECOMES damage. So look for it on the left of an assignment to one of
     the quantities that do. */
    const offenders = efx.split("\n").filter(l => {
    if(!/zonePow\(/.test(l)) return false;
    const code = l.replace(/`[^`]*`/g, '""');        // drop template strings
    if(!/zonePow\(/.test(code)) return false;         // it was only in a log line
    return /(?:total|_condSelf|lastDmg|\.hp)\s*[-+]?=/.test(code)
        || /\bdmg\s*=/.test(code);
  });
  assert.deepEqual(offenders, [],
    "zonePow feeds a damage quantity. It is a THRESHOLD value: the combat chain is " +
    "exactly the zone Kayo's clause 2 excludes, so an attack strikes for its PRINTED " +
    "power. A 6 that hits for 7 is the direction that steals games.");

  /* And the positive half, so the drill cannot pass by finding nothing:
     the strike total must still be built from the card's printed power. */
  assert.match(efx, /let total = base \+ bonus;/,
    "execute still builds the strike from the card's printed base plus its bonuses");
});

/* ---- THE DISCARD ------------------------------------------------------ */

test("the parser reads BOTH halves of draw-then-discard", {skip}, () => {
  for(const nm of ["Bare Fangs", "Wild Ride"]){
    const fx = P.fxParse(card(nm));
    assert.deepEqual(fx.ops.filter(o => o[0] === "draw" || o[0] === "discardRandom"),
      [["draw", 1], ["discardRandom", 1]],
      `${nm}: the discard is the COST of the draw — dropping it made the card strictly better than printed`);
  }
});

test('"discarded this way" is a different condition from "this turn"', {skip}, () => {
  const way = P.classifyClause("If a card with 6 or more {p} is discarded this way, it gets go again");
  assert.equal(way.cond, "discard6way",
    "the resolution-scoped wording asks about the discard this card just made");

  /* The TURN-scoped wording reaches the engine by two other routes and
     deliberately not through this one: Run Roughshod is a `playIf` gate,
     and Mandible Claw's rider is read where the weapon is activated. Both
     answer `had6ThisTurn`. What matters here is only that the two wordings
     never collapse into each other — collapsing them is what let an
     unrelated earlier discard satisfy a "this way" rider. */
  const turn = P.classifyClause("If you have discarded a card with 6 or more {p} this turn, this gets go again");
  assert.notEqual(turn && turn.cond, "discard6way",
    "the turn-scoped wording must NOT be read as the resolution-scoped one");

  assert.equal(P.fxParse(card("Run Roughshod")).playIf.kind, "discard6",
    "Run Roughshod's play gate is turn-scoped");
});

/* `had6ThisTurn` is a trainer closure, so pin its SHAPE at the call site:
   it must ask for `_disc`, or it goes back to counting the whole graveyard. */
test("the trainer's turn-scoped check asks for a real discard", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/const had6ThisTurn = [^\n]*/);
  assert.ok(m, "had6ThisTurn moved — re-anchor this drill");
  assert.match(m[0], /_disc/,
    "it must require the _disc stamp: an attack reaches the graveyard at DECLARATION, so " +
    "counting the graveyard lets a played 6-power attack satisfy a discard condition, itself included");
  assert.match(m[0], /pow6\(/, "and read effective power, so Kayo's clause 2 applies");
  assert.ok(!/you\(/.test(m[0]), "a rules question belongs to the ACTOR, not to seat 0");
});

/* ---- THE OP ITSELF ---------------------------------------------------- */

/* THE BUILD LIVES ON THE STATE, WHERE `bAct` READS IT (v2.80).

   This file used to hand a build into a context literal, with `bAct` and
   `bFoe` both returning it — so no drill here could tell the two seats
   apart, and the one drill whose whole subject IS the distinction said so
   in a comment and asserted on the source instead. `judged.js` goes
   through judge's own `effectsFor`, where `bAct(g)` is `g.builds[actor]`
   and `bFoe(g)` is the other seat's. Pass `builds` and they differ. */
const game = (hand, o) => {
  o = o || {};
  const g = H.state({name: "kayo", hand}, {name: "kayo", hand: o.foeHand || []},
                    {seed: "disc", builds: o.builds || [kayoBuild(), {}]});
  return {...g, ...(o.over || {})};
};
const runOps = (g, ops, src) => H.runOps(g, ops, src);

test("discardRandom moves a card from HAND to GRAVEYARD, stamped as a discard", {skip}, () => {
  const b = kayoBuild();
  const hand = [card("Buckwild"), card("Smash Instinct")];
  const out = runOps(game(hand), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].hand.length, 1, "one card left the hand");
  assert.equal(out.sides[0].grave.length, 1, "and reached the graveyard");
  assert.equal(out.sides[0].grave[0]._disc, true,
    "stamped _disc — without it a discard is indistinguishable from a card that was merely played");
  assert.equal(out.sides[0].grave[0]._gy, 2, "and turn-stamped");
});

test("discardRandom is SEEDED — same seed, same card", {skip}, () => {
  const b = kayoBuild();
  const hand = () => [card("Buckwild"), card("Smash Instinct"), card("Bear Hug")];
  const a = runOps(game(hand()), [["discardRandom", 1]], "p");
  const c = runOps(game(hand()), [["discardRandom", 1]], "p");
  assert.equal(a.sides[0].grave[0].name, c.sides[0].grave[0].name,
    "two peers and a replay must discard the same card");
  assert.ok(a.rng.n > 0, "the seeded stream was consumed, not Math.random");
});

test("Reincarnate discarded at random goes to the DECK BOTTOM, not the graveyard", {skip}, () => {
  const b = kayoBuild();
  const out = runOps(game([card("Reincarnate")]), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].grave.length, 0, "it never reaches the graveyard — its own printed text says so");
  assert.equal(out.sides[0].deck.length, 1);
  assert.equal(out.sides[0].deck[0].name, "Reincarnate");
});

/* ---- THE WHOLE HERO, ON ONE TAP ---------------------------------------
   Every drill in this file measures one op, one clause or one number.
   This one plays a card. Bare Fangs is the right card because its single
   printed sentence exercises all three of Kayo's parts at once:

     "When this attacks, draw a card then discard a random card. If a card
      with 6 or more {p} is discarded this way, create a Might token."

   the draw, the discard that was silently deleted before v2.55, the
   `_disc` stamp that separates a discard from a card merely played, the
   6+ threshold clause 2 lifts, and clause 3's token. Driven through
   `judge.reduce`, so it is the line of play a player actually taps.
   ------------------------------------------------------------------- */

test("one tap of Bare Fangs runs the whole engine: draw, discard, threshold, token", {skip}, () => {
  const b = kayoBuild();
  const fangs = {...card("Bare Fangs"), uid: "bf1"};
  const buck  = {...card("Buckwild"), uid: "bk1"};       // printed 7 — over the bar
  const ride  = {...card("Wild Ride"), uid: "wr1"};
  assert.equal(+fangs.power, 6, "fixture drifted — Bare Fangs should print 6");

  let g = H.state({name: "Kayo", res: 9, hand: [fangs, buck], deck: [ride]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "kayo", builds: [b, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "bf1", from: "hand"}, 0);
  assert.equal(out.error, null, "the swing was refused: " + out.error);
  const n = out.state;

  assert.deepEqual(n.sides[0].hand.map(c => c.name), ["Wild Ride"],
    "the draw happened and the discard took the OTHER card — Buckwild was the only " +
    "candidate, so the seeded pick cannot be what makes this pass");
  assert.equal(n.sides[0].deck.length, 0, "and it came off the deck");

  assert.deepEqual(n.sides[0].grave.map(c => c.name), ["Buckwild"],
    "Bare Fangs itself is on the CHAIN, not in the graveyard — an attack that files itself " +
    "at declaration is the CARD-IN-TWO-ZONES the merge found");
  assert.equal(n.sides[0].grave[0]._disc, true, "the discard is stamped");
  assert.equal(n.sides[0].grave[0]._gy, n.turn, "and turn-stamped");

  assert.deepEqual(n.sides[0].board.map(e => e.card && e.card.name), ["Might"],
    "a 7-power card was discarded this way, so clause 3 pays out — and the token is " +
    "resolved from the database, which only happens because the db is registered with " +
    "the judge rather than held privately by this file");
});

test("under the bar, the same tap makes no token — the CONTROL", {skip}, () => {
  /* Without this the drill above passes just as well on an engine that
     mints a Might for any discard at all. A printed 3 is under the bar
     even for Kayo, whose clause 2 lifts it only to 4. */
  const b = kayoBuild();
  const fangs = {...card("Bare Fangs"), uid: "bf1"};
  const small = {name: "tiny", uid: "t1", pitch: 1, power: 3, cost: 0,
                 tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []};
  let g = H.state({name: "Kayo", res: 9, hand: [fangs, small],
                   deck: [{...card("Wild Ride"), uid: "wr1"}]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "kayo", builds: [b, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const n = J.reduce(g, {t: "play", uid: "bf1", from: "hand"}, 0).state;
  assert.deepEqual(n.sides[0].grave.map(c => c.name), ["tiny"], "it was still discarded");
  assert.deepEqual(n.sides[0].board, [], "but 3 is not 6, so nothing is created");
});

/* ---- THE TOKENS, AND CLAUSE 3 ----------------------------------------- */

/* THE SCHEDULE AND THE PAYLOAD, IN PRINTED ORDER (v3.07).

   This used to expect the payload ALONE — `[["buffNext",1]]` — which is
   what "At the start of your turn, destroy this, then your next attack
   this turn gets +1{p}" parsed to. The destroy was being swallowed by the
   generic temporal-prefix handler, so the card carried a payload with no
   schedule and reported `full`; the trainer papered over it by re-reading
   the raw printed line, and the table had no start-of-turn trigger at all.

   Expecting the schedule FIRST is the load-bearing half: `sweepArena`
   pays the ops that follow the destroy, which is what keeps an on-play
   static (Pyroglyphic Protection's `arcShield`) out of the payout. */
test("Might / Agility / Vigor each parse to a schedule AND a payload", {skip}, () => {
  const want = {Might: [["selfDestruct", "turn"], ["buffNext", 1]],
                Agility: [["selfDestruct", "turn"], ["gaNext"]],
                Vigor: [["selfDestruct", "turn"], ["res", 1]]};
  for(const [nm, ops] of Object.entries(want)){
    const tok = C.resolveEntry(DB(), {name: nm, p: 0, code: null, q: 1});
    assert.ok(tok.resolved, `${nm} must resolve from the database — never invent a token`);
    assert.deepEqual(P.fxParse(tok).ops, ops, `${nm}`);
    assert.equal(P.fxParse(tok).ops[0][0], "selfDestruct",
      `${nm}: the destroy must come FIRST — sweepArena pays what follows it`);
    assert.match(P.clean(tok.tx || ""), /at the start of your turn, destroy this/i);
  }
});

/* THE SCHEDULE IS A PURE FUNCTION NOW, SO DRIVE IT (v3.07).

   This drill used to read `newTurn` out of index.html and look for the
   printed trigger line, and its own comment said why: "the schedule is in
   `newTurn`, a closure inside Battle … the alternative is no check at
   all". That stopped being true when `sweepArena` moved the rule into
   `effects.js` — so the check is now a DRIVE, and the source scan that
   remains asserts the opposite of what it used to: that the trainer no
   longer carries a second description of the rule. */
test("a start-of-turn token is destroyed and pays out — driven", {skip}, () => {
  const E = require("../engine/effects");
  const H = require("./helpers/judged.js");
  H.db();
  const might = H.card("Might", 0);
  const sd = P.fxParse(might).ops[0][1];
  assert.equal(sd, "turn", "Might's own printed schedule");

  const g = H.state({board: [{card: might, kind: "token", spent: false, uid: might.uid, sd}]},
                    {}, {turn: 4});
  const out = E.sweepArena(g, 0, "turn");
  assert.deepEqual(out.game.sides[0].board, [], "the token leaves the arena");
  assert.deepEqual(out.game.sides[0].grave.map(c => c.name), ["Might"], "and lands in the graveyard");
  assert.deepEqual(out.ops, [["buffNext", 1]],
    "and pays the ops AFTER the destroy — never the whole parse");
  assert.equal(g.sides[0].board.length, 1, "the input game is untouched");
});

test("the token mint stamps the token's own printed clock", {skip}, () => {
  const H = require("./helpers/judged.js");
  H.db();
  const g = H.state({}, {}, {turn: 2, tokSeq: 0});
  const n = H.runOps(g, [["token", "Might", 1, "self"]], "drill");
  assert.equal(n.sides[0].board.length, 1, "a Might was created");
  assert.equal(n.sides[0].board[0].sd, "turn",
    "an unstamped token is a permanent that never leaves — and for an Aura " +
    "token it also inflates every 'auras you control' count on the board");
});

test("neither board carries a second description of the sweep", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* The rule lives in effects.js and nowhere else. A board that re-reads
     the printed line to find these tokens is the second sweep coming
     back — which is how the table came to have neither. */
  /* COMMENTS STRIPPED ON BOTH — the claim is about code, and the comment
     that explains the rule necessarily quotes the printed line it stopped
     reading. Same reason the retired-picker drills strip before scanning. */
  const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/at the start of your turn, destroy this/i.test(decomment(efx)),
    "effects.js works off the `sd` stamp, not off a re-read of the printed line");
  const live = decomment(html);
  assert.ok(!/\.board\s*\|\|\s*\[\]\)\.filter\(b\s*=>\s*\/at the start of your turn/i.test(live),
    "the trainer must not re-grow its own start-of-turn sweep");
  assert.ok(/DawnEffects\.sweepArena/.test(live),
    "the trainer reaches the shared sweep");
});

/* Slice to the END of the function, not a fixed byte count: adding the
   Beaten Trackers trigger pushed clause 3 past a hardcoded 900 and the
   drill started reporting a bug that was not there. */
const afterDiscardBody = () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const i = efx.indexOf("const afterDiscard");
  assert.ok(i > 0, "afterDiscard moved — re-anchor this drill");
  const j = efx.indexOf("\n  const runOps", i);
  assert.ok(j > i, "afterDiscard's end anchor moved");
  return efx.slice(i, j);
};

test("clause 3 is gated on the ACTION phase and latches once", {skip}, () => {
  const body = afterDiscardBody();
  assert.match(body, /phase !== "action"/,
    'RULING: "during each of your action phases" — an end-phase discard makes no Might');
  assert.match(body, /hist\.might6/, "and it must latch, so only the FIRST one fires");
  assert.match(body, /pow6\(/, "the 6+ test is the shared one, so clause 2 applies to it");
});

/* FOUND IN PLAY (v2.61): paying Rally the Coast Guard's discard cost to
   block on the OPPONENT'S turn minted a Might token. `phase === "action"`
   does not mean "your action phase" — in FaB the combat chain lives inside
   the TURN PLAYER's action phase, so while you defend against their swing
   the phase is still "action", just not yours. */
test("clause 3 requires YOUR OWN turn, not merely the action phase", {skip}, () => {
  const body = afterDiscardBody();
  assert.match(body, /turnPlayer !== actorOf\(n\)/,
    "a discard made while DEFENDING on the opponent's turn is still in an action phase — " +
    "the turn has to be the actor's own");

  /* and behaviourally, both ways round */
  const b = kayoBuild();
  const mine = game([card("Buckwild")]);
  mine.phase = "action"; mine.turnPlayer = 0;          // my turn
  const a = runOps(mine, [["discardRandom", 1]], "probe");
  assert.equal(a.sides[0].board.length, 1, "my own action phase makes Might");

  const theirs = game([card("Buckwild")]);
  theirs.phase = "action"; theirs.turnPlayer = 1;      // defending on their turn
  const c2 = runOps(theirs, [["discardRandom", 1]], "probe");
  assert.equal(c2.sides[0].board.length, 0,
    "blocking on their turn is still the action phase — but not YOUR action phase");
});

/* ---- BEATEN TRACKERS --------------------------------------------------- */

test("Beaten Trackers triggers only on a RANDOM discard", {skip}, () => {
  const bt = card("Beaten Trackers");
  assert.match(P.clean(bt.tx || ""), /whenever you discard a random card with 6 or more \{p\}/i,
    "the card says RANDOM, and the hero ability does not");
  const body = afterDiscardBody();
  /* Pin the GATE, not merely the presence of the variable: deleting
     `&& atRandom` from the condition leaves the declaration behind, and a
     drill that only greps the name passes over exactly that edit. */
  assert.match(body, /if\(big && atRandom\)/,
    "clause 3 fires on ANY discard; Beaten Trackers only on a random one. Reading the two " +
    "as the same event hands out a free action point every time a cost is paid by choice.");
  assert.match(body, /whenever you discard a random card with/,
    "matched on the piece's PRINTED TEXT, not by name");
  assert.match(body, /tag:"modal"/,
    'RULING: "you may destroy this" is a real decision — prompt every time it triggers');
  assert.ok(!/"Beaten Trackers"/.test(body), "no card is special-cased by name");
});

test("the trigger only fires when a random 6+ is actually discarded", {skip}, () => {
  const b = kayoBuild();
  const gear = [card("Beaten Trackers")];
  const withGear = hand => { const g = game(hand); g.sides[0].gear = gear; g.phase = "action"; return g; };

  /* a printed-3 card is under the bar even for Kayo — nothing should queue */
  const small = {name:"tiny", uid:"t1", pitch:1, power:3, cost:0,
    tt:"Generic Action - Attack", ty:["Generic","Action","Attack"], tx:"", kw:[]};
  const quiet = runOps(withGear([small]), [["discardRandom", 1]], "probe");
  assert.equal((quiet.promptQ || []).length, 0, "3 power is not 6 — no offer");

  /* a real 6+ discard offers the choice */
  const loud = runOps(withGear([card("Buckwild")]), [["discardRandom", 1]], "probe");
  assert.equal((loud.promptQ || []).length, 1, "a 6+ random discard offers the action point");
  assert.equal(loud.promptQ[0].tag, "modal");
  assert.equal(loud.promptQ[0].options.length, 2, "destroy, or keep the iron");
});

/* CLASH compares the power of the top card of each deck, and the deck is a
   zone other than the combat chain — so clause 2 reaches it, and each card
   must be read with ITS OWN owner's build. Seven of Kayo's cards clash. */
test("clash reads effective power, each side with its own build", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const i = html.indexOf("const myTop = act(clashState).deck[0]");
  assert.ok(i > 0, "the clash loop moved — re-anchor this drill");
  const body = html.slice(i, i + 500);
  assert.match(body, /zonePow\(myTop, bAct\(/, "your revealed card uses YOUR build");
  assert.match(body, /zonePow\(foeTop, bFoe\(/,
    "and theirs uses THEIRS — one shared build would apply the revealer's buff to both cards");
  assert.ok(!/\(myTop\.power\|\|0\)/.test(body), "printed power must not decide a clash any more");
});

/* ---- A KEYWORD THE CARD ONLY GRANTS CONDITIONALLY --------------------- */

test("Pulping's dominate is GATED, and Smash Instinct's intimidate is not", {skip}, () => {
  const pulping = card("Pulping"), smash = card("Smash Instinct");
  assert.equal(P.hasKw(pulping, "dominate"), true, "it is on the card somewhere");
  assert.equal(P.kwGated(pulping, "dominate"), true,
    'but only inside "IF a card with 6 or more {p} is discarded this way"');
  assert.equal(P.hasKwNow(pulping, "dominate"), false,
    "so the engine must not hand it over unconditionally — that is v2.31's lesson, " +
    "applied to fx.ga in 2.31 and never to hasKw");

  /* A TRIGGER IS NOT A GATE. "When this attacks, intimidate" fires on every
     swing; treating it as conditional would turn the card off instead. */
  assert.equal(P.kwGated(smash, "intimidate"), false);
  assert.equal(P.hasKwNow(smash, "intimidate"), true);
});

test("the gate can still fire — the clause grants the keyword", {skip}, () => {
  const cl = P.classifyClause("If a card with 6 or more {p} is discarded this way, this gets dominate");
  assert.equal(cl.cond, "discard6way");
  assert.deepEqual(cl.ops, [["gainKw", "dominate"]],
    "refusing the unconditional grant without building the conditional one would " +
    "just turn the card off, which is the opposite error");
});

test("the trainer asks whether dominate is ACTIVE, not whether it is mentioned", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const dominating = hasKwNow\(card,"dominate"\) \|\| \(n\._kwGrant\|\|\[\]\)/,
    "dummyDefence must read hasKwNow plus this resolution's granted keywords");
  assert.ok(!/hasKw\(card,"dominate"\)/.test(html),
    "the bare hasKw reading is what held the defender to one card on every Pulping swing");
});

/* ---- A BLOCK HAS NO PLAY ---------------------------------------------- */

test("Test of Might cannot be played as an action", {skip}, () => {
  const tom = card("Test of Might");
  const T = require("../engine/types.js");
  assert.equal(T.isBlock(tom), true, "Test of Might is a Block");
  assert.equal(T.isPlayable(tom), false, "and a Block has no play at all");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /DawnTypes\.isBlock\(card\)/,
    "tryPlay must refuse a Block — otherwise it is a free 0-cost play that spends " +
    "an action point and does nothing. judge.js has refused it since v2.47; the " +
    "trainer never did, and Kayo runs two copies.");
});

/* ---- A CARD IN HAND WITH AN ACTIVATED ABILITY -------------------------- */

test("Agile Windup and Rally the Coast Guard both read their ability", {skip}, () => {
  const aw = P.fxParse(card("Agile Windup")).handAbility;
  assert.ok(aw, "Instant - Discard this: Create an Agility token");
  assert.equal(aw.cost, "self", "it spends ITSELF");
  assert.deepEqual(aw.ops, [["token", "agility", 1, "self"]]);

  const rc = P.fxParse(card("Rally the Coast Guard")).handAbility;
  assert.ok(rc, "Once per Turn Instant - Discard a card: This gets +3{d}");
  assert.equal(rc.cost, "card", "it spends ANOTHER card — a different cost, and a choice");
  assert.equal(rc.oncePerTurn, true);
  assert.deepEqual(rc.ops, [["defBuff", 3]]);
  assert.equal(P.fxParse(card("Rally the Coast Guard")).activateIf.kind, "defending",
    "and it may only be activated while it is defending");
});

/* FOUND BY PLAYING THE MIRROR (v2.64). Rally's +3{d} was written to
   `s.defBonus` and then thrown away one line before the wall was totalled:
   `takeIt`'s no-pause path called `finishBlock(s, clashDef, {})`. A 2+3
   defender locked the defence at 3, and the whole suite was green — the
   bonus map had only ever been produced and consumed inside a single
   defpay cycle, so nothing had reason to check the other path. */
test("a defence bonus raised before the block reaches the wall", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /return finishBlock\(s, clashDef, s\.defBonus \|\| \{\}\);/,
    "the no-pause path must pass the accrued bonus, not an empty object — an " +
    "activated ability can raise a defender before takeIt is ever reached");
  assert.match(html, /defBonus:\{\.\.\.\(s\.defBonus\|\|\{\}\)\}/,
    "and entering the defpay pause must carry it rather than wiping a cost already paid");
  /* and it must not outlive the wall it was raised on */
  const fb = html.slice(html.indexOf("const finishBlock = (s, clashDef, defBonus) => {"),
                        html.indexOf("const takeIt = () => setG"));
  assert.match(fb, /n\.defBonus = \{\};/,
    "cleared where blockH/blockG clear, or a defender carries its +{d} into the next link");
});

test("the hand-ability route is wired, and nothing is named", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /const handPow = c =>/, "the synthetic ability card");
  assert.match(html, /const handAbilityOK = \(s, c\) =>/, "and the question of whether it is live now");
  assert.match(html, /const activateHand = c => setG/, "and the reducer");
  assert.match(html, /y\.hand\.forEach\(c => \{ const hp = handPow\(c\)/,
    "peekables must span it, or the preview fails silently while the tap still arms");
  assert.match(html, /hand\.flatMap\(handCell\)/,
    "the ability is its own cell — one tap target cannot mean two things");
  /* the defence buff must NOT go through runOps: finishBlock reads a
     per-uid bonus map, and runOps cannot raise one specific defender */
  assert.match(html, /n\.defBonus = \{\.\.\.\(n\.defBonus\|\|\{\}\), \[c\.uid\]/,
    "Rally's +3{d} reaches the wall through defBonus, the way confirmDefPay already routes one");
  for(const nm of ["Agile Windup", "Rally the Coast Guard"])
    assert.ok(!new RegExp('"' + nm + '"').test(html), `${nm} must not be special-cased by name`);
});

test("the ability reader claims exactly the cards that print one", {skip}, () => {
  /* Five pool cards, found by reading text — three of them nothing to do
     with Kayo, which is the golden rule working rather than a coincidence. */
  const hits = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(DB(), e, sa);
      if(c.resolved && P.fxParse(c).handAbility) hits.push(c.name + "|" + c.pitch);
    }
  }
  assert.deepEqual([...new Set(hits)].sort(),
    ["Agile Windup|3", "Arcane Twining|3", "Photon Splicing|3",
     "Rally the Coast Guard|3", "Reaper's Call|3"]);
});

/* ---- STRONGEST SURVIVE: the defender's escape hatch -------------------- */

test("Strongest Survive reads its 'unless they reveal' half", {skip}, () => {
  for(const p of [1, 2, 3]){
    const c = C.resolveEntry(DB(), {name: "Strongest Survive", p, code: null, q: 1}, "SKA");
    const fx = P.fxParse(c);
    /* `onHitHero` at v3.45 — Strongest Survive prints "when this hits a
       HERO", so an ally hit makes nobody discard. The clause is read the
       same way; only which list it lands in changed. */
    assert.deepEqual(fx.onHitHero, [["foeDiscardUnlessReveal", 1]],
      `pitch ${p}: classifyClause returned BYTE-IDENTICAL output with and without the ` +
      `"unless they reveal…" clause, so all six copies discarded unconditionally — ` +
      `stronger than printed`);
  }
  /* the plain wording must be untouched — other heroes rely on it */
  assert.deepEqual(P.classifyClause("they discard a card").ops, [["foeDiscard", 1]]);
});

test("the reveal beats the DAMAGE DEALT, not the printed power", {skip}, () => {
  const b = kayoBuild();
  const mk = (nm, pow) => ({name: nm, uid: nm, pitch: 1, power: pow, cost: 0,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

  /* a 7-power swing stopped to 3 is beaten by a 4 */
  const g = game([]);
  g.sides[1].hand = [mk("spare", 4)];
  g.lastDmg = 3;
  const dodged = runOps(g, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(dodged.sides[1].hand.length, 1, "they revealed and kept the card");
  assert.equal(dodged.sides[1].grave.length, 0, "nothing was discarded");

  /* and when nothing in hand beats it, the discard lands */
  const g2 = game([]);
  g2.sides[1].hand = [mk("small", 2)];
  g2.lastDmg = 5;
  const hit = runOps(g2, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(hit.sides[1].hand.length, 0, "nothing beat 5, so a card goes");
  assert.equal(hit.sides[1].grave.length, 1);
  assert.equal(hit.sides[1].grave[0]._disc, true, "and it is stamped as a discard");
});

test("the revealed card is read with the DEFENDER's own build", {skip}, () => {
  /* THE TWO SEATS HOLD DIFFERENT BUILDS, and until v2.80 no drill in this
     file could say so: the context handed one build to both `bAct` and
     `bFoe`, so this drill passed on an engine that read the ATTACKER's
     build for the defender's hand and had to assert on the source instead.
     Judge's own context reads `g.builds[seat]`, so the two can differ —
     and here they deliberately do.

     Seat 1 is the Kayo. Seat 0 is NOT, so an engine reaching for the
     attacker's build finds no clause 2 at all and the escape fails. */
  const g = game([], {builds: [{}, kayoBuild()]});
  g.sides[1].hand = [card("Unexpected Backhand")];   // printed 5 -> 6 for a Kayo
  g.lastDmg = 5;
  const out = runOps(g, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(out.sides[1].hand.length, 1,
    "printed 5 is not greater than 5, but THEIR clause 2 makes it a 6 — they escape, " +
    "and the attacker has no clause 2 to lend them");
  assert.equal(out.sides[1].grave.length, 0);

  /* THE CONTROL, or the drill passes just as well on an engine that never
     discards at all: the same card, the same damage, and no clause 2 on
     either seat — now nothing beats 5 and the card goes. */
  const bare = game([], {builds: [{}, {}]});
  bare.sides[1].hand = [card("Unexpected Backhand")];
  bare.lastDmg = 5;
  const hit = runOps(bare, [["foeDiscardUnlessReveal", 1]], "Strongest Survive");
  assert.equal(hit.sides[1].hand.length, 0, "without their hero the printed 5 does not beat 5");
  assert.equal(hit.sides[1].grave.length, 1);

  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.match(efx, /zonePow\(c, bFoe\(n\)\) > dmg/,
    "the defender's hand must be read with bFoe, never bAct");
});

/* ---- SAVAGE FEAST: a cost that was never paid ------------------------- */

test("Savage Feast's additional cost is read, and it is RANDOM", {skip}, () => {
  const fx = P.fxParse(card("Savage Feast"));
  assert.ok(fx.addCost, "the card NAMES ITSELF rather than saying 'this', and there is no comma after the name");
  assert.equal(fx.addCost.discard, 1);
  assert.equal(fx.addCost.random, true,
    "printed 'a random card' — the engine's auto-discard picks your lowest-value card, " +
    "which is strictly better than printed");
  assert.ok((fx.conds || []).some(c => c.cond === "discard6way"),
    '"discarded as an additional cost to play it" is the same scoping as "this way" — ' +
    "the discard this card just made, not the turn's history");
});

test("the additional-cost discard is stamped and counts as this way", {skip}, () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.ok(!/actMut\(n\)\.grave = \[\.\.\.gy\(n\.turn, \.\.\._toGrave\)/.test(efx),
    "the additional-cost discard must use gyDisc — with plain gy it is indistinguishable " +
    "from a card that was merely played, and no discard check can see it");
  assert.match(efx, /actMut\(n\)\.grave = \[\.\.\.gyDisc\(n\.turn, \.\.\._toGrave\)/);
  assert.match(efx, /n\._discWay = \[\.\.\.\(n\._discWay\|\|\[\]\), \.\.\.pool\.map/,
    "and record it, or the card's own rider cannot see the card it just fed the cost");
});

/* ---- PREDATORY PLATING ------------------------------------------------ */

/* DRIVEN, NOT GREPPED (v3.04). This read `index.html` for the gate's
   source, and the gate moved to `engine/effects.js` when it was shared
   with judge.js — a source guard aimed at the wrong file passes by
   finding nothing, so it is asked of the function instead. */
test('"control a card with 6 or more {p}" includes the live attack', {skip}, () => {
  const gate = {kind: "controlPow", n: 6};
  const bare = H.state({name: "Kayo", board: [], gear: []}, {name: "Them"}, {actor: 0});
  assert.equal(E.activateIfOk(bare, gate), false,
    "nothing over 6 anywhere — without this the drill passes on a gate that always says yes");

  /* RULING (user, 2026-08-08): arena + equipment + the attack currently on
     the COMBAT CHAIN. Board and gear alone left Kayo with nothing over 3
     power, so Predatory Plating was unactivatable in his own deck. */
  const big = {...card("Buckwild"), uid: "big"};
  assert.ok((big.power || 0) >= 6, "the fixture card must actually print 6+");
  assert.equal(E.activateIfOk({...bare, pend: {card: big}}, gate), true,
    "the live attack on the chain counts");
  assert.equal(E.activateIfOk({...bare, sides: [{...bare.sides[0], gear: [big]}, bare.sides[1]]}, gate), true,
    "and so does equipment");
});

/* ---- THE BUG THIS WHOLE DISTINCTION EXISTS FOR ------------------------ */

test("a PLAYED attack in the graveyard does not count as a discard", {skip}, () => {
  /* An attack card is put into the graveyard at declaration. Counting the
     graveyard therefore let any 6-power attack already played satisfy
     "you've discarded a card with 6 or more {p} this turn" — and a
     6-power attack satisfied it for itself. */
  const b = kayoBuild();
  const played = {...card("Buckwild"), _gy: 2};        // reached the graveyard by being PLAYED
  const discarded = {...card("Bear Hug"), _gy: 2, _disc: true};
  const had6 = grave => grave.some(c => c._gy === 2 && c._disc && P.pow6(c, b));
  assert.equal(had6([played]), false, "played, not discarded — it must not count");
  assert.equal(had6([discarded]), true, "an actual discard does");
});
