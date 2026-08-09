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

/* CHANGED DELIBERATELY — this drill used to assert speedAllowed was [] in
   the defend step, reasoning that declaring defenders is free and
   simultaneous. That is true about DECLARING (CR 7.3.2) and is not a
   statement that the step has no priority window. CR 7.3.3 is explicit:
   "the turn-player gains priority", and CR 7.3.4 ends the step only "when
   the stack is empty and all players pass in succession" — there is
   nothing to pass if nobody may act. Instants are legal here. */
test("window: the defend step DOES have a priority window, and it is instants only (CR 7.3.3)", () => {
  const g = P.toDefend(P.declareAttack(P.toPhase(fresh(0), "action"), 0));
  assert.deepEqual(P.speedAllowed(g, 0), ["instant"],
    "the turn-player holds priority in the defend step and may play an instant");
  assert.deepEqual(P.speedAllowed(g, 1), [], "the defender holds no priority here");
  /* reaction cards are NOT legal yet — those belong to the reaction step */
  assert.ok(!P.speedAllowed(g, 0).includes("defense-reaction"));
  assert.ok(!P.speedAllowed(g, 0).includes("attack-reaction"));
  /* ...and declaring defenders remains a separate, non-priority question */
  assert.equal(P.canDeclareDefenders(g, 1), true, "the defender declares");
  assert.equal(P.canDeclareDefenders(g, 0), false, "the attacker does not");
});

/* ---- the chain ------------------------------------------------------- */
test("chain: the defending player is the other side, stated once", () => {
  const g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  assert.equal(P.attackingPlayer(g), 0);
  assert.equal(P.defendingPlayer(g), 1);
});

/* Pass twice — the CR's "all players pass in succession" — then advance. */
const bothPass = g => P.pass(P.pass(g));

test("chain: a link walks attack -> defend -> reaction -> damage -> resolution -> close (CR 7.0.1)", () => {
  let g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  assert.equal(g.step, "attack");

  /* EVERY step waits for its own window now, not just the reaction step.
     CR 7.3.4 / 7.6.4 word it identically for each: "when the stack is
     empty and all players pass in succession, the X Step ends". Four of
     these six windows used to be granted and then advanced straight past. */
  assert.equal(P.advance(g).step, "attack", "the attack step holds its window (CR 7.2)");
  g = P.advance(bothPass(g)); assert.equal(g.step, "defend");

  /* CR 7.3.3 — the DEFENDING player declares the defending cards, but the
     TURN-PLAYER gains priority in the defend step. Declaring is not
     playing (CR 7.3.2): it is a free, simultaneous game-state action, not
     a priority action. */
  assert.equal(g.priority, 0, "the turn-player holds priority in the defend step");
  assert.equal(P.canDeclareDefenders(g, 1), true, "but the defender is who declares");
  assert.equal(P.canDeclareDefenders(g, 0), false);
  assert.equal(P.advance(g).step, "defend", "the defend step holds its window (CR 7.3.4)");
  g = P.advance(bothPass(g)); assert.equal(g.step, "reaction");

  assert.equal(g.priority, 0, "CR 7.4 — the turn-player, not the attacker");
  assert.equal(P.advance(g).step, "reaction", "reactions wait for both to pass");
  g = P.advance(bothPass(g)); assert.equal(g.step, "damage");

  assert.equal(P.advance(g).step, "damage", "the damage step holds its window (CR 7.5)");
  g = P.advance(bothPass(g)); assert.equal(g.step, "resolution");

  assert.equal(P.advance(g).step, "resolution", "the resolution step holds its window (CR 7.6.4)");
  g = P.advance(bothPass(g)); assert.equal(g.step, "close");
  /* CR 7.7.1 — "Players do not get priority during the Close Step." */
  assert.equal(g.priority, null, "nobody holds priority in the close step");
  assert.equal(g.chainOpen, true, "the chain has not closed yet — that is CR 7.7.7");

  /* CR 7.7.7 — the close step ends and the action phase continues. */
  g = P.advance(g);
  assert.equal(g.step, "layer");
  assert.equal(g.chainOpen, false, "now it is closed");
  assert.equal(g.priority, 0, "and the turn-player has their action window back");
});

test("chain: a queued attack sends the resolution step back to attack, not to close (CR 7.6.3b)", () => {
  let g = P.declareAttack(P.toPhase(fresh(0), "action"), 0);
  g = {...g, step:"resolution", queue:[{n:"Head Jab"}]};
  g = P.advance(bothPass(g));
  assert.equal(g.step, "attack", "CR 7.6.4 requires the stack AND queue to be empty to close");
  assert.equal(g.priority, 0);
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

/* ===================================================================
   PASSING ON AN EMPTY STACK vs A POPULATED ONE.

   The edge case this machine could not see at all. Every "the step ends"
   rule in the CR is a CONJUNCTION and both halves matter:

     CR 7.3.4 — "when the stack is empty and all players pass in
                 succession, the Defend Step ends"
     CR 7.6.4 — "when the stack and queue are empty and all players pass
                 in succession, the Resolution Step ends"
     CR 4.3.4 — "when the stack is empty, the combat chain is closed, and
                 both players pass priority in succession, the action
                 phase ends"

   With a layer on the stack, all-passing resolves the top layer and the
   turn-player gets priority again (CR 4.2.2 / 7.7.4) — the window
   reopens. Treating the two alike skips a whole reaction window whenever
   anything is on the stack, which is the worst kind of priority bug: the
   defending player never gets asked.
   =================================================================== */
const withStack = (g, n) =>
  ({...g, stack: Array.from({length:n}, (_,i)=>({layer:i}))});

test("stack: all passing on an EMPTY stack ends the window", () => {
  const g = bothPass(P.toReaction(P.declareAttack(active(0), 0)));
  assert.equal(P.stackEmpty(g), true);
  assert.equal(P.allPassed(g), true);
  assert.equal(P.windowClosed(g), true);
  assert.equal(P.passOutcome(g), "advance");
});

test("stack: all passing on a POPULATED stack resolves a layer instead (CR 4.2.2)", () => {
  const g = bothPass(withStack(P.toReaction(P.declareAttack(active(0), 0)), 1));
  assert.equal(P.allPassed(g), true, "everyone has passed...");
  assert.equal(P.windowClosed(g), false, "...but the window is NOT closed");
  assert.equal(P.passOutcome(g), "resolve-layer");
});

test("stack: a populated stack does not let the step advance", () => {
  const g = bothPass(withStack(P.toReaction(P.declareAttack(active(0), 0)), 1));
  assert.equal(P.advance(g).step, "reaction",
    "CR 7.3.4/7.6.4 gate the step end on an EMPTY stack — a layer must resolve first");
});

test("stack: once the layer is gone, the same all-passed state advances", () => {
  /* The caller resolves the layer (zone work this module deliberately does
     not do) and hands priority back per CR 4.2.2; then the window closes
     normally. This is the whole reason the two outcomes are named. */
  let g = bothPass(withStack(P.toReaction(P.declareAttack(active(0), 0)), 1));
  g = bothPass(P.reset({...g, stack: []}));
  assert.equal(P.passOutcome(g), "advance");
  assert.equal(P.advance(g).step, "damage");
});

test("stack: nobody may act in a window that has already closed", () => {
  /* `pass` leaves priority resting with the last passer so it does not
     bounce forever. Without this, that player still read as able to act
     while `windowClosed` said the step was over — a contradiction, and
     the kind that makes a state machine non-deterministic to drive. */
  const g = bothPass(active(0));
  assert.equal(P.windowClosed(g), true);
  assert.deepEqual(P.speedAllowed(g, g.priority), []);
  assert.equal(P.canAct(g, 0), false);
  assert.equal(P.canAct(g, 1), false);
});

test("stack: canAct never contradicts windowClosed, in any step", () => {
  for(const step of P.STEPS){
    const g = bothPass({...active(0), step, attacker:0, chainOpen:true});
    for(const i of [0,1])
      assert.ok(!(P.canAct(g, i) && P.windowClosed(g)),
        "a closed window opened a play in step " + step);
  }
});

test("action phase: it ends on an empty stack with the chain closed (CR 4.3.4)", () => {
  const open = active(0);
  assert.equal(P.actionPhaseEnds(open), false, "nobody has passed yet");
  assert.equal(P.actionPhaseEnds(bothPass(open)), true);
  assert.equal(P.actionPhaseEnds(bothPass(withStack(open, 1))), false,
    "a layer on the stack keeps the phase alive");
  assert.equal(P.actionPhaseEnds(bothPass({...open, chainOpen:true})), false,
    "so does an open combat chain");
});

/* ===================================================================
   WHO HOLDS THE WINDOW: the turn-player, in every combat step.

   CR 7.1.x/7.2.x/7.3.3/7.4.x/7.5.x/7.6.3 all say "the turn-player gains
   priority". This module used to hand it to the ATTACKING player in the
   reaction, damage, resolution and link steps. Those coincide while one
   side ever attacks, so the bug was invisible — the same shape as act()
   vs you() in ROADMAP-MULTIPLAYER.md Phase A step 1.
   =================================================================== */
test("holder: every combat step gives priority to the turn-player (CR 7.1-7.6)", () => {
  /* Seat 1 is the turn-player and the attacker throughout. */
  let g = P.declareAttack(active(1), 1);
  const seen = [];
  for(let i = 0; i < 6 && g.step !== "close"; i++){
    seen.push([g.step, g.priority]);
    assert.equal(g.priority, g.turnPlayer, "step " + g.step + " must hand it to the turn-player");
    g = P.advance(bothPass(g));
  }
  assert.deepEqual(seen.map(s => s[0]),
    ["attack","defend","reaction","damage","resolution"]);
});

test("holder: the turn-player keeps the window even when the ATTACKER is the other seat", () => {
  /* Divergent by construction — the trainer cannot produce it today, and
     that is exactly why it needs a drill rather than a play session. A
     card that lets a non-turn-player control an attack must not move the
     priority window with it. */
  let g = {...active(0), attacker: 1, chainOpen: true};
  for(const step of ["reaction","damage","resolution"]){
    const to = {reaction:P.toReaction, damage:P.toDamage, resolution:P.toResolution}[step];
    const n = to(g);
    assert.equal(n.step, step);
    assert.equal(n.turnPlayer, 0);
    assert.equal(P.attackingPlayer(n), 1, "the attacker is still seat 1");
    assert.equal(n.priority, 0,
      step + " must give priority to the TURN-PLAYER (0), not the attacker (1)");
  }
});

test("holder: the reaction SPLIT still follows the attacker, not the turn-player", () => {
  /* The two questions come apart here, and both must stay right: the
     turn-player holds the window, and the attacker decides which KIND of
     reaction each seat may play. */
  const g = P.toReaction({...active(0), attacker: 1, chainOpen: true});
  assert.equal(g.priority, 0, "turn-player holds it");
  assert.deepEqual(P.speedAllowed(g, 0), ["defense-reaction","instant"],
    "seat 0 is the turn-player but is DEFENDING, so it gets defense reactions");
  assert.deepEqual(P.speedAllowed(P.pass(g), 1), ["attack-reaction","instant"],
    "seat 1 is attacking, so it gets attack reactions");
});

/* ===================================================================
   THE CLOSE STEP (CR 7.7) — and that the link step is gone.
   =================================================================== */
test("close: nobody may be handed priority in the close step (CR 7.7.1)", () => {
  const g = P.toClose(P.toResolution(P.declareAttack(active(0), 0)));
  assert.equal(g.step, "close");
  assert.equal(g.priority, null);
  /* and it must be structurally impossible, not merely unasked-for */
  assert.equal(P.give(g, 0).priority, null, "give() must refuse in the close step");
  assert.equal(P.give(g, 1).priority, null);
  assert.equal(P.reset(g).priority, null, "and so must reset()");
});

test("close: the invariant judge rejects priority held in the close step", () => {
  const I = require("../engine/invariants.js");
  const g = Object.assign(S.makeGame({seed:1}), {phase:"action", step:"close", priority:0});
  const codes = I.errors(g).map(v => v.code);
  assert.ok(codes.includes("PRIORITY-IN-CLOSE-STEP"),
    "CR 7.7.1 must be guarded — the phase check cannot see it, the close step sits inside the action phase");
  /* the clean case must stay quiet */
  const ok = Object.assign(S.makeGame({seed:1}), {phase:"action", step:"close", priority:null});
  assert.ok(!I.errors(ok).map(v => v.code).includes("PRIORITY-IN-CLOSE-STEP"));
});

test("close: leaving the close step restores the action window (CR 7.7.7)", () => {
  const g = P.breakChain(P.toClose(P.toResolution(P.declareAttack(active(0), 0))));
  assert.equal(g.step, "layer");
  assert.equal(g.priority, 0,
    "the step must be set before priority is asked for, or give() refuses and the window is silently lost");
  assert.equal(g.chainOpen, false);
});

test("close: the retired link-step API is gone, not aliased", () => {
  assert.equal(P.closeLink, undefined,
    "the CR has no link step; an alias would keep the retired concept reachable");
  assert.equal(typeof P.toClose, "function");
});

/* ===================================================================
   DETERMINISM. The machine is a pure function of its state: same input,
   same output, and no transition mutates what it was handed.
   =================================================================== */
test("determinism: transitions are pure — nothing mutates its input", () => {
  const base = P.declareAttack(active(0), 0);
  const snap = JSON.stringify(base);
  const fns = [g=>P.pass(g), g=>P.reset(g), g=>P.give(g,1), g=>P.advance(g),
               g=>P.toDefend(g), g=>P.toReaction(g), g=>P.toDamage(g),
               g=>P.toResolution(g), g=>P.toClose(g), g=>P.breakChain(g),
               g=>P.endTurn(g), g=>P.toPhase(g,"end")];
  for(const f of fns){
    f(base);
    assert.equal(JSON.stringify(base), snap, "a transition mutated the state it was given");
  }
});

test("determinism: the same state always produces the same next state", () => {
  const walk = () => {
    let g = P.toPhase(P.seat(S.makeGame({seed:7}), 0), "action");
    const trace = [];
    g = P.declareAttack(g, 0);
    for(let i = 0; i < 8; i++){
      trace.push(g.step + ":" + g.priority + ":" + g.passed.join(","));
      g = P.advance(bothPass(g));
    }
    return trace.join(" | ");
  };
  assert.equal(walk(), walk(), "two identical walks must produce identical traces");
});

test("determinism: every reachable state is one the judge accepts", () => {
  const I = require("../engine/invariants.js");
  let g = Object.assign(S.makeGame({seed:3}), P.seat(S.makeGame({seed:3}), 0));
  g = P.toPhase(g, "action");
  g = P.declareAttack(g, 0);
  for(let i = 0; i < 10; i++){
    const bad = I.errors(g).filter(v => /PHASE|STEP|PRIORITY/.test(v.code));
    assert.deepEqual(bad, [], "judge rejected step " + g.step + ": " + JSON.stringify(bad));
    assert.ok(P.STEPS.indexOf(g.step) >= 0, "unknown step " + g.step);
    g = P.advance(bothPass(g));
  }
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

/* ===================================================================
   THE TRAINER BRIDGE (v2.27) — priority derived from mode/bphase.

   This mapping is carried in SHADOW: it describes the trainer's real
   windows without driving them yet, so it has to be pinned before
   anything is allowed to depend on it. Each drill states the CR rule it
   encodes, because the counter-intuitive ones (who holds priority in the
   defend step) are exactly where a plausible-looking mapping goes wrong.
   =================================================================== */
const T = (mode, extra) => Object.assign({mode}, extra || {});

test("bridge — the action phase opens with the turn player holding priority (CR 4.3.3)", () => {
  const p = P.fromTrainer(T("act"), false);
  assert.equal(p.phase, "action");
  assert.equal(p.step, "layer");
  assert.equal(p.turnPlayer, 0);
  assert.equal(p.priority, 0, "the turn player acts in their own action phase");
  assert.equal(p.attacker, null, "nothing is attacking yet");
});

/* CHANGED DELIBERATELY — there is no link step. CR 7.0.1 lists Layer,
   Attack, Defend, Reaction, Damage, Resolution; the link step was removed
   and the go again check moved into the Resolution Step (CR 7.6.2). An
   open chain is therefore `resolution`: the link has resolved, the
   turn-player holds priority (CR 7.6.3), and playing another attack
   starts a new link (CR 7.6.3a). */
test("bridge — an open chain is the RESOLUTION step (CR 7.6.3), not the deleted link step", () => {
  assert.equal(P.fromTrainer(T("act", {chainOpen:true}), false).step, "resolution");
  assert.equal(P.fromTrainer(T("act", {chainOpen:false}), false).step, "layer");
  assert.ok(P.STEPS.indexOf("link") < 0, "the link step must not come back");
});

test("bridge — the open-chain window still lets the player act (CR 7.6.3a)", () => {
  /* The regression this guards: mapping an open chain to `close` would be
     CR-shaped and would silently make every hand card unplayable mid-chain,
     because nobody holds priority in the close step. */
  const g = P.fromTrainer(T("act", {chainOpen:true}), false);
  assert.equal(g.priority, 0);
  assert.deepEqual(P.speedAllowed(g, 0), ["action","instant"],
    "an open chain is where the second attack of a chain gets played");
});

test("bridge — the trainer's UI sub-modes are all still the action phase", () => {
  /* `arsenal` LEFT THIS LIST in v2.35 — see the drill below. It is an end
     phase step, not a UI sub-mode of the action phase. */
  for(const m of ["act","pay","boostpick"]){
    const p = P.fromTrainer(T(m), false);
    assert.equal(p.phase, "action", m + " must stay in the action phase");
    assert.equal(p.priority, 0, m + " must leave priority with the player");
  }
});

test("bridge — the arsenal set is the END phase, and nobody holds priority", () => {
  /* CR 4.4.3b puts the arsenal set inside the end-phase procedure, and
     CR 4.4.1 says "Players do not get priority during the End Phase."
     Mapping it to the action phase reported a player holding priority in a
     closed phase — exactly what PRIORITY-IN-CLOSED-PHASE exists to catch,
     which could never fire while the mapping itself said otherwise. */
  const p = P.fromTrainer(T("arsenal"), false);
  assert.equal(p.phase, "end");
  assert.equal(p.priority, null, "no priority in the end phase (CR 4.4.1)");
  assert.equal(P.canAct(p, 0), false, "and therefore nobody may act");
});

test("bridge — YOUR attack: the reaction step gives YOU priority first", () => {
  const p = P.fromTrainer(T("stack"), false);
  assert.equal(p.step, "reaction");
  assert.equal(P.attackingPlayer(p), 0, "you are the attacker");
  assert.equal(p.priority, 0, "CR: the attacking player receives priority first");
  assert.ok(P.canAct(p, 0), "so you may react");
});

test("bridge — the DUMMY's swing is the dummy's turn, and it is the attacker", () => {
  const p = P.fromTrainer(T("block", {bphase:"defend"}), false);
  assert.equal(p.turnPlayer, 1, "the dummy swinging is the dummy's turn");
  assert.equal(P.attackingPlayer(p), 1);
  assert.equal(P.defendingPlayer(p), 0, "you are defending");
  assert.equal(p.step, "defend");
});

test("bridge — CR 7.3: the DEFEND step gives priority to the TURN-PLAYER, not the defender", () => {
  const p = P.fromTrainer(T("block", {bphase:"defend"}), false);
  assert.equal(p.priority, 1,
    "counter-intuitive but explicit: the attacking turn-player holds priority in the defend step");
  /* ...and yet you may still declare blockers, because declaring is NOT a
     priority action (CR 7.3.2). This pair is the whole reason
     canDeclareDefenders exists separately from canAct. */
  assert.ok(P.canDeclareDefenders(p, 0), "you may still declare defenders");
  assert.ok(!P.canAct(p, 0), "but you hold no priority to PLAY anything");
});

test("bridge — defending, the reaction step slides priority to you once the dummy passes", () => {
  const p = P.fromTrainer(T("block", {bphase:"react"}), false);
  assert.equal(p.step, "reaction");
  assert.equal(P.attackingPlayer(p), 1, "the dummy is still the attacker");
  assert.equal(p.priority, 0, "it has no reactions, so it passes and the window is yours");
  const speeds = P.speedAllowed(p, 0);
  assert.ok(speeds.indexOf("defense-reaction") >= 0,
    "defending, you may play DEFENSE reactions — got " + JSON.stringify(speeds));
  assert.ok(speeds.indexOf("attack-reaction") < 0, "but not attack reactions");
});

test("bridge — attacking, your reaction window is ATTACK reactions", () => {
  const speeds = P.speedAllowed(P.fromTrainer(T("stack"), false), 0);
  assert.ok(speeds.indexOf("attack-reaction") >= 0, "got " + JSON.stringify(speeds));
  assert.ok(speeds.indexOf("defense-reaction") < 0);
});

test("bridge — a finished game holds no priority (CR 4.4.1)", () => {
  const p = P.fromTrainer(T("act", {over:{win:true}}), false);
  assert.equal(p.phase, "end");
  assert.equal(p.priority, null, "nobody may act once the game is over");
});

test("bridge — the pregame seating is carried through", () => {
  assert.equal(P.fromTrainer(T("act"), true).firstPlayer, 1, "opponent-first");
  assert.equal(P.fromTrainer(T("act"), false).firstPlayer, 0, "player-first");
});

test("bridge — the mapping is TOTAL and never yields an invalid state", () => {
  /* Every combination the trainer can actually be in must produce a state
     the invariant judge accepts, or turning those dormant checks on would
     start reporting violations that are really mapping bugs. */
  const I = require("../engine/invariants.js");
  const modes = ["act","pay","arsenal","stack","block","boostpick"];
  for(const mode of modes)
    for(const bphase of ["defend","react"])
      for(const chainOpen of [false,true])
        for(const over of [null,{win:true}])
          for(const foeFirst of [false,true]){
            const p = P.fromTrainer({mode,bphase,chainOpen,over}, foeFirst);
            const where = JSON.stringify({mode,bphase,chainOpen,over:!!over,foeFirst});
            assert.ok(P.PHASES.indexOf(p.phase) >= 0, "bad phase for " + where);
            assert.ok(P.STEPS.indexOf(p.step) >= 0, "bad step for " + where);
            assert.ok(p.priority === null || p.priority === 0 || p.priority === 1,
              "bad priority for " + where);
            /* the exact rule the judge enforces */
            if(p.phase === "start" || p.phase === "end")
              assert.equal(p.priority, null, "priority in a closed phase for " + where);
            /* THE TRAINER MUST NEVER DERIVE A CLOSED WINDOW. `speedAllowed`
               now returns [] once everyone has passed on an empty stack,
               and playRx reads it for every reaction — so if any trainer
               state mapped to passed:[true,true], reactions would go dead
               in the live game. fromTrainer only ever passes once (the
               dummy sliding its reaction window over), and this pins it. */
            assert.ok(!(p.passed[0] && p.passed[1]),
              "fromTrainer derived a CLOSED priority window for " + where +
              " — playRx would refuse every reaction");
            /* and it must survive the real judge, wired to real sides */
            const g = Object.assign(S.makeGame({seed:1}), p);
            const bad = I.errors(g).filter(v => /PHASE|STEP|PRIORITY/.test(v.code));
            assert.deepEqual(bad, [], "judge rejected " + where + ": " + JSON.stringify(bad));
          }
});

test("bridge — PRI_FIELDS names exactly what fromTrainer returns", () => {
  const p = P.fromTrainer(T("act"), false);
  for(const k of P.PRI_FIELDS)
    assert.ok(k in p, `PRI_FIELDS lists ${k} but fromTrainer does not return it`);
  /* the trainer merges PRI_FIELDS and nothing else, so anything fromTrainer
     invents beyond them would be silently dropped */
  for(const k of ["phase","step","priority","passed","turnPlayer","firstPlayer","attacker"])
    assert.ok(P.PRI_FIELDS.indexOf(k) >= 0, `${k} must be in PRI_FIELDS or it never reaches the trainer`);
});

/* ===================================================================
   THE END PHASE PROCEDURE (CR 4.4.3) — order, and who it applies to.

   These pin the SHAPE the trainer's endTurn/afterArsenal must follow.
   The procedure is ordered and the order is load-bearing; before v2.35
   the trainer ran e -> c -> b -> f, never did (a) or (d) in the end
   phase at all, and lost only the turn-player's resources.
   =================================================================== */
const fs = require("node:fs");
const path = require("node:path");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("end phase — the CR 4.4.3 steps appear in the trainer in the CR's order", () => {
  const body = HTML.slice(HTML.indexOf("const endTurn = () => setG"),
                          HTML.indexOf("function foeSwing"));
  const at = tag => body.indexOf("CR 4.4.3" + tag + " —");
  const a = at("a"), b = at("b"), c = at("c"), d = at("d"), e = at("e"), f = at("f");
  for(const [nm,v] of [["a",a],["b",b],["c",c],["d",d],["e",e],["f",f]])
    assert.ok(v > -1, "step " + nm + " must be present and marked");
  assert.ok(a < b && b < c && c < d && d < e && e < f,
    "CR 4.4.3 is an ORDERED procedure — a,b,c,d,e,f. Reordering these is a rules change.");
});

test("end phase — losing resources is ALL players, not the turn-player", () => {
  /* CR 4.4.3e: "All players lose all action points and resource points."
     Invisible today because the dummy floats nothing, and a real bug the
     moment a second hero can bank a resource during your turn. */
  const body = HTML.slice(HTML.indexOf("CR 4.4.3e"), HTML.indexOf("CR 4.4.3f"));
  assert.match(body, /for\(const si of \[0,1\]\)/,
    "the fizzle must loop over both seats, not reach for youMut alone");
});

test("end phase — the untap happens HERE, not in next turn's setup", () => {
  /* CR 4.4.3d. It used to be folded into newTurn, which is the same thing
     while one seat acts and is NOT once a second seat has a turn between
     yours: the permanents would stay tapped through the opponent's turn. */
  const nt = HTML.slice(HTML.indexOf("function newTurn"), HTML.indexOf("uE(()=>{ if(g.over"));
  assert.ok(!/weaponUsed\s*=\s*\{\}/.test(nt),
    "newTurn must no longer untap — CR 4.4.3d puts it in the end phase");
  const et = HTML.slice(HTML.indexOf("CR 4.4.3d"), HTML.indexOf("CR 4.4.3e"));
  assert.match(et, /weaponUsed\s*=\s*\{\}/, "and the end phase must actually do it");
});

test("action phase — the action point is issued there, not at turn setup", () => {
  /* CR 4.3.2: "the turn-player has 1 action point" at the beginning of the
     ACTION phase, after the start phase (CR 4.2) has run its triggers. */
  const nt = HTML.slice(HTML.indexOf("function newTurn"), HTML.indexOf("uE(()=>{ if(g.over"));
  assert.match(nt, /Start phase \(CR 4\.2\)/, "the start phase must be announced");
  assert.match(nt, /Action phase \(CR 4\.3\)/, "and so must the action phase");
  assert.ok(nt.indexOf("Start phase (CR 4.2)") < nt.indexOf("Action phase (CR 4.3)"),
    "start phase precedes action phase");
  assert.ok(nt.indexOf("Action phase (CR 4.3)") < nt.indexOf("ap = 1"),
    "the action point is issued AT the action phase, not before it");
});

/* ===================================================================
   ACTIVATING A CARD IN THE ARENA (v2.35).

   Gear has carried a `powCard` for a long time; a permanent on the
   board never did, so an item reading "Action - Destroy this: …" was
   decoration — the board's onClick only ever opened the zoom modal for
   anything that was not an ally. Two pool cards were fully inert.
   =================================================================== */
test("arena — the two destroy-cost items parse as real activated abilities", () => {
  const P2 = require("../engine/parser.js");
  const ep = P2.parseHeroPower("Instant - Destroy this: Gain {r}{r}", true);
  assert.ok(ep, "Energy Potion has an ability");
  assert.equal(ep.sd, true, "its cost is destroying itself");
  assert.equal(ep.kind, "instant");
  assert.deepEqual(P2.classifyClause(ep.eff).ops, [["res",2]]);

  const tp = P2.parseHeroPower("Action - Destroy this: Gain 2 action points", true);
  assert.ok(tp, "Timesnap Potion has an ability");
  assert.equal(tp.sd, true);
  assert.deepEqual(P2.classifyClause(tp.eff).ops, [["ap",2]]);
});

test("arena — the trainer offers board abilities and pays their destroy cost", () => {
  /* The wiring itself is inside a React component, so this is a textual
     guard the way the CR-order drills above are: it fails if the path is
     removed, which is what would silently make these cards decoration again. */
  assert.match(HTML, /const boardPow = b => \{/, "the board powCard builder must exist");
  assert.match(HTML, /tapTwice\(bp, "activate", \(\)=>tryPlay\(bp,"board",i\)\)/,
    "the board must offer its ability through the two-tap commit");
  /* the destroy-cost payment lives in `execute`, which moved to
     engine/effects.js in v2.53 — the other two anchors are still UI. */
  assert.match(require("./helpers/extract.js").effects(), /if\(from==="board" && card\.sd\)\{/,
    "and execute must actually pay the destroy cost");
  /* peekables must span every zone a tap can originate in, or the preview
     silently fails to render while the tap still arms. */
  const pk = HTML.slice(HTML.indexOf("const peekables = () =>"), HTML.indexOf("First tap previews"));
  assert.match(pk, /boardPow\(b\)/, "peekables must include board abilities");
});

/* ===================================================================
   THE PEEK OVERLAY MUST NOT EAT THE TAP (v2.36).

   Found on a 393x852 phone viewport, invisible on a tall window.
   `.peekwrap` is position:fixed, full width, and mostly empty space.
   With pointer-events:auto that empty space sat on top of the hand rail:
   the first tap armed the peek, the peek covered the rail, and the
   second tap hit the wrapper's own dismiss handler instead of the card.
   Tap, peek, tap, peek — hand cards were UNPLAYABLE on a phone, which is
   the only device this game is built for.
   =================================================================== */
test("peek — the overlay lets taps through to the rail underneath", () => {
  const css = HTML.slice(HTML.indexOf(".peekwrap{"), HTML.indexOf(".peekcard{"));
  assert.match(css, /pointer-events:\s*none/,
    ".peekwrap must not take pointer events — it covers the hand rail on a phone");
  assert.match(HTML, /\.peekwrap>\*\{pointer-events:auto\}/,
    "but the visible preview itself must stay tappable, so its dismiss still works");
});

/* ===================================================================
   THE FIRST CONSUMER MOVES OFF mode/bphase (v2.37).

   `playRx` hand-rolled its window as `inAtk = s.mode==="stack"` plus an
   inline reaction test. That cannot express the rule it stood in for —
   the reaction split follows the ATTACKER, not the seat number — so it
   was right only by accident, because one side ever attacks. These pin
   the mapping playRx now depends on, per trainer state.
   =================================================================== */
test("playRx window — YOUR attack gives you the ATTACK-reaction window", () => {
  const g = P.fromTrainer(T("stack"), false);
  assert.deepEqual(P.speedAllowed(g, 0), ["attack-reaction","instant"]);
});

test("playRx window — the dummy's swing, reaction step, gives you DEFENSE reactions", () => {
  const t = T("block"); t.bphase = "react";
  const g = P.fromTrainer(t, false);
  assert.deepEqual(P.speedAllowed(g, 0), ["defense-reaction","instant"]);
});

test("playRx window — the DEFEND step allows nothing to be played (CR 7.3.2)", () => {
  const t = T("block"); t.bphase = "defend";
  const g = P.fromTrainer(t, false);
  assert.deepEqual(P.speedAllowed(g, 0), [], "declaring defenders is not a priority action");
  assert.equal(g.step, "defend", "and playRx keys its refusal message off this");
});

test("playRx window — the action phase is not a reaction window", () => {
  for(const m of ["act","pay","boostpick"]){
    const w = P.speedAllowed(P.fromTrainer(T(m), false), 0);
    assert.ok(!w.includes("attack-reaction") && !w.includes("defense-reaction"),
      m + " must not open a reaction window");
  }
});

test("playRx window — a finished game opens no window at all", () => {
  /* A behaviour CHANGE, and a correct one: the old mode test would still
     have let a reaction through with mode:"stack" after the game ended. */
  const t = T("stack"); t.over = {win:true};
  assert.deepEqual(P.speedAllowed(P.fromTrainer(t, false), 0), []);
});

test("playRx — the trainer no longer decides the window from mode/bphase", () => {
  /* Slice playRx's OWN body only: from its declaration to the next
     same-indent `const` that follows it. A wider slice picks up the
     arsenal-instant handlers, which legitimately still read mode/bphase
     until their own turn to migrate comes. Comments are stripped because
     this file documents the old test in prose right above the new one. */
  const start = HTML.indexOf("const playRx = i => setG");
  const end = HTML.indexOf("\n  const ", start + 10);
  const body = HTML.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(body, /DawnPriority\.speedAllowed\(s, 0\)/,
    "the window must come from the priority machine");
  assert.ok(!/s\.mode/.test(body), "playRx must not read s.mode at all any more");
  assert.ok(!/s\.bphase/.test(body), "nor s.bphase");
});

test("peek — the preview is positioned ABOVE the hand, measured not guessed", () => {
  /* v2.36 stopped the overlay eating the tap; v2.37 stops it HIDING the hand.
     A flat `bottom:112px` cleared the action bar but landed the preview right
     on top of the rail at 393x852 — you could not see the cards you were
     choosing between. The offset is measured off the live rail because its
     height depends on which screen is showing; a hardcoded number would be
     wrong again on the next layout change.

     THE MEASUREMENT MUST LIVE IN `PeekDock` (v2.52). While it sat in a `uE`
     inside `Battle` this drill passed and the TABLE was broken anyway: that
     board renders the same component and never ran the effect, so it fell
     back to the flat 112px, the preview landed inside the rail, and — since
     `.peekwrap>*` takes pointer events — a tap on a covered card bubbled to
     the wrapper's dismiss handler. Reported from a real table (2026-08-04)
     as "pitching from the 3rd/4th card silently does nothing". Slicing the
     component rather than a board is what makes this drill cover both. */
  const css = HTML.slice(HTML.indexOf(".peekwrap{"), HTML.indexOf(".peekwrap>*"));
  assert.match(css, /bottom:var\(--peekbot,\s*112px\)/,
    "the offset must come from the measured custom property, with the old flat value as fallback");
  const dock = HTML.slice(HTML.indexOf("function PeekDock("),
                          HTML.indexOf("function ", HTML.indexOf("function PeekDock(") + 10));
  assert.match(dock, /--peekbot/,
    "the component that IS positioned must be the one that measures — a board "
  + "cannot forget a step it does not own");
  assert.match(dock, /querySelector\("\.phand, \.chand, \.hand"\)/,
    "it must measure whichever hand rail is on screen");
  assert.match(dock, /window\.innerHeight - r\.top/,
    "the offset is the distance from the viewport bottom to the rail's TOP edge");
  /* MEASURING ONCE IS NOT ENOUGH, AND NEITHER IS LISTENING. The rail is
     still moving when the tap that opens the preview lands — measured in
     that tick the offset came out 146px against a rail that settled at 628,
     44px of overlap, the same bug at a different instant. A scroll listener
     did not cover it either: the rail slid 86px with `scrollTop` UNCHANGED,
     moved by content above it settling rather than by a scroll. So it is
     tracked per frame while the preview is open. */
  assert.match(dock, /raf = requestAnimationFrame\(place\)/,
    "the offset must be TRACKED per frame while the preview is open — there is "
  + "no complete list of events that move the rail, and this was tried");
  assert.match(dock, /cancelAnimationFrame\(raf\)/,
    "and the loop must stop when the preview closes");
  assert.match(dock, /if\(bot !== last\)/,
    "writing only on change, so a per-frame loop costs a rect and nothing else");
  assert.match(dock, /r\.bottom <= 0 \|\| r\.top >= window\.innerHeight/,
    "a rail that has flicked off screen must fall back to the flat clearance, "
  + "not be chased off the top of the viewport");

  /* THE MIRROR IS THE BUG, NOT THE MISSING LINE. The table lost the
     measurement because `Battle` hand-copied the dock's markup instead of
     rendering the component, so the two drifted with nothing watching —
     exactly what the no-mirror rule exists to stop. One `.peekwrap` in the
     file, and every board reaches it through `<PeekDock`. */
  const wrappers = HTML.match(/className="peekwrap"/g) || [];
  assert.equal(wrappers.length, 1,
    "`.peekwrap` markup must exist exactly once, inside PeekDock — a second "
  + "copy is how the measurement went missing from the table");
  const renders = HTML.match(/<PeekDock\b/g) || [];
  assert.equal(renders.length, 2,
    "both boards must render the shared dock: the trainer and the table");
});

/* ===================================================================
   THE ACTION POINT IS AN *ACTION'S* COST — CR 8.1.1 / 8.1.6 / 5.3.5.

   Reported from the table (2026-08-01): instants consumed the turn's
   action point. Two sites, one rule, and both were hand-rolled:
   `tryPlay` refused any play at 0 action points, and `execute` charged
   every non-attack that resolved through it. Energy Potion's "Instant -
   Destroy this: Gain {r}{r}" therefore cost you your action, and
   Achilles Accelerator's "Instant - Destroy this: Gain 1 action point"
   netted to exactly nothing.

   The engine answers it once, in costsAP; these pin that both trainer
   sites ask it rather than answering it again themselves.
   =================================================================== */

test("action point — the play gate exempts instants (CR 8.1.6)", () => {
  const body = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx)"),
                          HTML.indexOf("const confirmPay = () => setG"));
  const gate = body.match(/^.*ap<1.*$/m);
  assert.ok(gate, "tryPlay must still refuse an ACTION with no action point");
  assert.match(gate[0], /costsAP\(card\)\s*&&/,
    "CR 8.1.6 — an instant may be played any time the player has priority, "
  + "so the 0-action-point refusal must ask costsAP first");
});

test("action point — resolution charges an action, not an instant (CR 8.1.1)", () => {
  /* `execute` moved to engine/effects.js in v2.53. Reading it out of
     index.html now finds NOTHING, and a source guard that finds nothing
     passes — so this is repointed rather than left to quietly stop
     asserting. (It could become a behavioural drill now that execute is
     callable; that is a bigger change than repointing it.) */
  const EFFECTS = require("./helpers/extract.js").effects();
  const body = EFFECTS.slice(EFFECTS.indexOf("const execute = (s,card,from,idx)"),
                             EFFECTS.indexOf("\n  return {runOps, execute, afterDiscard};"));
  /* the arithmetic that runs for every non-attack resolution. CR 5.3.5 — go
     again GAINS an action point; it is not a refund. For an action that is
     spend-then-gain (the familiar "kept"); for an instant it is a genuine
     +1, and only the spelled-out arithmetic gets both right. */
  assert.match(body, /const apCost = costsAP\(card\) \? 1 : 0;/,
    "the charge must be gated on costsAP — `ga ? keep : -1` charges instants too");
  assert.match(body, /actMut\(n\)\.ap = act\(n\)\.ap - apCost \+ \(ga \? 1 : 0\);/,
    "CR 5.3.5 — go again gains 1 action point, so the two rules compose "
  + "rather than being folded into a ternary");
  assert.ok(!/ga \? act\(n\)\.ap : act\(n\)\.ap-1/.test(body),
    "the old ternary charged every non-attack, instants included");
  /* the ONE bare -1 left in execute is the phantasm teardown, and it is an
     ATTACK being popped: the point was spent on play and its go again never
     resolves, so there is nothing to gain back. */
  const bare = body.match(/actMut\(n\)\.ap = act\(n\)\.ap - 1;/g) || [];
  assert.equal(bare.length, 1, "only phantasm's attack teardown may charge bare");
  assert.ok(body.indexOf("hasKw(card,\"phantasm\")") < body.indexOf("actMut(n).ap = act(n).ap - 1;"),
    "and it must be the one inside the phantasm branch");
});

test("action point — an attack still pays for itself", () => {
  /* attacks are action cards (CR 8.1.1) and settle in resolveStack, which
     the fix deliberately did not touch. A regression here would be an
     attack going free. */
  const body = HTML.slice(HTML.indexOf("const resolveStack = () => setG"),
                          HTML.indexOf("const maybeBoost = "));
  assert.match(body, /actMut\(n\)\.ap = n\.pend\.ga \? act\(n\)\.ap : act\(n\)\.ap-1;/,
    "an attack costs an action point whether or not it is an instant-typed card");
});

/* ===================================================================
   A REACTION BELONGS TO THE REACTION STEP, AND TO ONE SEAT IN IT.
   CR 8.1.2a / 8.1.3a. The trainer had five hand-rolled copies of "does
   this card fit this window"; `rxAllowed` is the one statement, and
   these pin that every site asks it.
   =================================================================== */

test("reactions — tryPlay refuses one in the action phase (CR 8.1.2a / 8.1.3a)", () => {
  const body = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx)"),
                          HTML.indexOf("const confirmPay = () => setG"));
  assert.match(body, /if\(isRx\(card\)\)/,
    "tryPlay is only reached in the action phase, which is not the reaction step");
  /* and it must name the window, not dead-tap: the trainer's own rule is
     that a refusal says why */
  assert.match(body, /reaction step/, "the refusal must name where the card does belong");
  assert.ok(body.indexOf("if(isRx(card))") < body.indexOf("costsAP(card) && act(s).ap<1"),
    "refuse the card before charging or gating on resources");
});

test("reactions — playRx splits the window by seat and asks rxAllowed", () => {
  const body = HTML.slice(HTML.indexOf("const playRx = i => setG"),
                          HTML.indexOf("const playRxA = () => setG"));
  assert.match(body, /rxAllowed\(c, rxWin\)/, "the card half of the rule comes from the engine");
  assert.match(body, /inAtk \? "attack-reaction" : "defense-reaction"/,
    "CR 8.1.2a/8.1.3a — the attacking player's window is not the defending player's");
  /* the disjunct that let three plain action cards into the reaction step */
  assert.ok(!/!isAttack\(c\)&&\(fx\.self\|\|0\)>0/.test(body),
    "a non-attack carrying a pump is still an ACTION card — illegal in the reaction step");
});

test("reactions — no site in the trainer hand-rolls the window test any more", () => {
  /* Five copies of `fx.dr || (isInstantT(c) && fx.ops.length>0)` is five
     chances to drift, and the dim in handCell drifting from playRx is a card
     that looks playable and refuses when tapped. */
  const babel = HTML.slice(HTML.indexOf("const playRx = i => setG"));
  assert.ok(!/isInstantT\([a-z()g.]*\)\s*&&\s*fx\.ops\.length/.test(babel),
    "rxAllowed owns this test — do not restate it in the trainer");
  const cell = HTML.slice(HTML.indexOf("const handCell = (c,i)"), HTML.indexOf("const playables = "));
  assert.match(cell, /rxAllowed\(c, "defense-reaction"\)/);
  assert.match(cell, /rxAllowed\(c, "attack-reaction"\)/,
    "the hand dim must ask exactly what playRx asks");
});
