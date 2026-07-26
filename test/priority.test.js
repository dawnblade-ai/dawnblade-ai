/* The priority machine (roadmap items 1 & 3). The trainer has never
   needed it — with one acting side, "your turn" and "your priority" are
   the same thing. These drills pin them apart, because in a two-player
   game the defending player holds priority during the attacking player's
   turn on every single link. */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/priority.js");
const S = require("../engine/sides.js");

/* `fresh` opens a turn, which per CR 4.2 means the START phase — where
   nobody holds priority. `active` walks it into the action phase, which is
   where a priority drill actually belongs. */
const fresh  = first => P.seat(S.makeGame({}), first == null ? 0 : first);
const active = first => P.toPhase(fresh(first), "action");

test("seating: the throw decides the turn, and the start phase holds no priority", () => {
  const a = fresh(0), b = fresh(1);
  assert.equal(a.turnPlayer, 0); assert.equal(a.firstPlayer, 0);
  assert.equal(b.turnPlayer, 1); assert.equal(b.firstPlayer, 1);
  assert.equal(a.turn, 1); assert.equal(a.round, 1);
  /* CR 4.2.1 — "Players do not get priority during the Start Phase." */
  assert.equal(a.phase, "start");
  assert.equal(a.priority, null, "nobody may hold priority in the start phase");
  assert.equal(P.holder(a), null);
  assert.equal(P.canAct(a, 0), false);
});

test("seating: entering the action phase is what grants priority (CR 4.3.3)", () => {
  assert.equal(active(0).priority, 0);
  assert.equal(active(1).priority, 1);
});

test("action phase: the turn-player is issued exactly 1 action point (CR 4.3.2)", () => {
  const g = active(1);
  assert.equal(g.sides[1].ap, 1, "the turn-player has 1 action point");
  assert.equal(g.sides[0].ap, 0, "the non-turn-player has none");
});

test("priority: a closed phase refuses to be handed priority at all", () => {
  const g = P.give(fresh(0), 1);
  assert.equal(g.priority, null, "give() must not grant priority in the start phase");
  const e = P.give({...fresh(0), phase:"end"}, 0);
  assert.equal(e.priority, null, "nor in the end phase (CR 4.4.1)");
});

test("priority: passing with nobody holding it is a no-op", () => {
  const g = fresh(0);
  assert.deepEqual(P.pass(g).passed, [false,false]);
});

test("priority: passing slides it to the other player", () => {
  const g = P.pass(active(0));
  assert.equal(g.priority, 1);
  assert.equal(P.allPassed(g), false);
});

test("priority: both passing ends the window", () => {
  const g = P.pass(P.pass(active(0)));
  assert.equal(P.allPassed(g), true);
});

test("priority: the second passer keeps priority rather than bouncing forever", () => {
  const g = P.pass(P.pass(active(0)));
  assert.equal(g.priority, 1, "priority should rest with whoever passed last");
});

test("priority: acting resets the pass count — that is why a chain can run long", () => {
  let g = P.pass(active(0));           /* you pass, opponent holds */
  assert.equal(P.allPassed(g), false);
  g = P.give(g, 0);                    /* opponent acts, priority back to you */
  assert.deepEqual(g.passed, [false,false]);
  g = P.pass(g);
  assert.equal(P.allPassed(g), false, "an earlier pass must not still count");
});

test("priority: reset hands it back to the turn player", () => {
  const g = P.reset(P.pass(active(1)));
  assert.equal(g.priority, 1);
});

test("priority: a finished game holds nobody", () => {
  const g = {...fresh(0), over:{win:true}};
  assert.equal(P.holder(g), null);
  assert.equal(P.hasPriority(g, 0), false);
  assert.equal(P.canAct(g, 0), false);
});

/* ---- windows --------------------------------------------------------- */
test("window: the turn player may take actions; the other may not", () => {
  const g = P.toPhase(fresh(0), "action");
  assert.deepEqual(P.speedAllowed(g, 0), ["action","instant"]);
  assert.deepEqual(P.speedAllowed(g, 1), [], "no priority, no window");
});

test("window: the defending player gets defense reactions, the attacker gets attack reactions", () => {
  let g = P.toReaction(P.declareAttack(P.toPhase(fresh(0), "action"), 0));
  assert.equal(g.priority, 0, "the attacking player receives priority first");
  assert.deepEqual(P.speedAllowed(g, 0), ["attack-reaction","instant"]);
  g = P.pass(g);
  assert.equal(g.priority, 1);
  assert.deepEqual(P.speedAllowed(g, 1), ["defense-reaction","instant"]);
});

test("window: the reaction split follows the ATTACKER, not the seat number", () => {
  /* opponent's turn, opponent attacking: now YOU hold the defense reactions */
  let g = P.toReaction(P.declareAttack(P.toPhase(fresh(1), "action"), 1));
  assert.deepEqual(P.speedAllowed(g, 1), ["attack-reaction","instant"]);
  g = P.pass(g);
  assert.deepEqual(P.speedAllowed(g, 0), ["defense-reaction","instant"]);
});

test("window: nothing is played during the defend step — declaration is free and simultaneous", () => {
  const g = P.toDefend(P.declareAttack(P.toPhase(fresh(0), "action"), 0));
  assert.deepEqual(P.speedAllowed(g, 0), []);
  assert.deepEqual(P.speedAllowed(g, 1), []);
  assert.equal(P.canDeclareDefenders(g, 1), true, "the defender declares");
  assert.equal(P.canDeclareDefenders(g, 0), false, "the attacker does not");
});

/* ---- the chain ------------------------------------------------------- */
test("chain: the defending player is the other side, stated once", () => {
  const g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  assert.equal(P.attackingPlayer(g), 0);
  assert.equal(P.defendingPlayer(g), 1);
});

test("chain: a link walks attack -> defend -> reaction -> damage -> resolution -> link", () => {
  let g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  assert.equal(g.step, "attack");
  g = P.advance(g); assert.equal(g.step, "defend");
  /* CR 7.3 — the DEFENDING player declares the defending cards, but the
     TURN-PLAYER gains priority in the defend step. Declaring is not
     playing (CR 7.3.2): it is a free, simultaneous game-state action, not
     a priority action. This drill used to assert the defender held
     priority here, which reads naturally and is not the rule. */
  assert.equal(g.priority, 0, "the turn-player holds priority in the defend step");
  assert.equal(P.canDeclareDefenders(g, 1), true, "but the defender is who declares");
  assert.equal(P.canDeclareDefenders(g, 0), false);
  g = P.advance(g); assert.equal(g.step, "reaction");
  assert.equal(g.priority, 0);
  g = P.advance(g); assert.equal(g.step, "reaction", "reactions wait for both to pass");
  g = P.advance(P.pass(P.pass(g)));
  assert.equal(g.step, "damage");
  g = P.advance(g); assert.equal(g.step, "resolution");
  g = P.advance(g); assert.equal(g.step, "link");
  assert.equal(g.chainOpen, true, "the chain stays open after a link resolves");
});

test("chain: breaking it banks the links and reopens the action window", () => {
  let g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  g = {...g, chain:[{n:"Head Jab"},{n:"Head Jab"}]};
  g = P.breakChain(g);
  assert.equal(g.chainOpen, false);
  assert.equal(g.step, "layer");
  assert.deepEqual(g.chain, []);
  assert.equal(g.chainHist.length, 1);
  assert.equal(g.chainHist[0].links.length, 2);
  assert.equal(g.attacker, null);
  assert.equal(g.priority, 0, "the turn player gets the window back");
});

test("chain: breaking an empty chain banks no history", () => {
  const g = P.breakChain(P.declareAttack(P.toPhase(fresh(0), "action"), 0));
  assert.deepEqual(g.chainHist, []);
});

/* ---- the clock ------------------------------------------------------- */
test("turn: the seat passes and the player-turn clock ticks", () => {
  const g = P.endTurn(active(0));
  assert.equal(g.turnPlayer, 1);
  assert.equal(g.turn, 2);
  assert.equal(g.round, 1, "the round only ticks when seating wraps");
  assert.equal(g.phase, "start");
  /* the new turn opens in the start phase, so nobody holds priority yet */
  assert.equal(g.priority, null);
  assert.equal(P.toPhase(g, "action").priority, 1, "granted when their action phase opens");
});

test("turn: the round ticks when the seat comes back to the first player", () => {
  const g = P.endTurn(P.endTurn(fresh(0)));
  assert.equal(g.turnPlayer, 0);
  assert.equal(g.turn, 3);
  assert.equal(g.round, 2);
});

test("turn: floating resources fizzle into wasted, and the action point moves", () => {
  let g = active(0);
  g = S.withSide(g, 0, {res: 3, wasted: 1, ap: 1});
  g = P.endTurn(g);
  assert.equal(g.sides[0].res, 0);
  assert.equal(g.sides[0].wasted, 4, "3 fizzled on top of the 1 already wasted");
  assert.equal(g.sides[0].ap, 0);
  assert.equal(g.sides[1].ap, 0, "no action point until their action phase (CR 4.3.2)");
  assert.equal(P.toPhase(g, "action").sides[1].ap, 1);
});

/* CR 4.4.3e — "All players lose action/resource points." BOTH seats.
   Invisible in the trainer (the dummy never floats a resource) and a real
   bug the moment a human sits in seat 1: a Wizard who banks a resource off
   Spellfire Cloak during YOUR turn must lose it at the end of your turn. */
test("turn: the NON-turn player's floating resources fizzle too (CR 4.4.3e)", () => {
  let g = active(0);
  g = S.withSide(g, 1, {res: 2, wasted: 0});
  g = P.endTurn(g);
  assert.equal(g.sides[1].res, 0, "the non-turn player does not keep floating resources");
  assert.equal(g.sides[1].wasted, 2, "and they are counted as wasted");
});

test("turn: the handoff clears any open chain", () => {
  let g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  g = P.endTurn({...g, chain:[{n:"Head Jab"}]});
  assert.equal(g.chainOpen, false);
  assert.deepEqual(g.chain, []);
  assert.equal(g.attacker, null);
});

test("turn: endTurn tolerates a game with no sides yet", () => {
  const bare = P.seat({turn:1, round:1}, 0);
  assert.equal(P.endTurn(bare).turnPlayer, 1);
});
