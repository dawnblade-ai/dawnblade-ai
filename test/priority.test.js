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

test("bridge — an open chain is the link step, not layer", () => {
  assert.equal(P.fromTrainer(T("act", {chainOpen:true}), false).step, "link");
  assert.equal(P.fromTrainer(T("act", {chainOpen:false}), false).step, "layer");
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
  assert.match(HTML, /if\(from==="board" && card\.sd\)\{/,
    "and execute must actually pay the destroy cost");
  /* peekables must span every zone a tap can originate in, or the preview
     silently fails to render while the tap still arms. */
  const pk = HTML.slice(HTML.indexOf("const peekables = () =>"), HTML.indexOf("First tap previews"));
  assert.match(pk, /boardPow\(b\)/, "peekables must include board abilities");
});
