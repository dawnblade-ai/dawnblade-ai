/* THE BLANK-ACTION DRILLS (engine/actions.js).

   This reducer exists so the transport can be tested without the card
   pool anywhere near it. So the first drill is the one that keeps it
   honest: no card in this module carries a single word of rules text.
   If that ever stops being true, a sync failure and a parser failure
   become indistinguishable, which is the whole thing this avoids.

   The rest drive engine/priority.js through a full chain link and check
   the two properties a networked reducer has to have — it is PURE, and
   it is DETERMINISTIC from its seed. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const A = require("../engine/actions.js");
const P = require("../engine/priority.js");
const S = require("../engine/sides.js");
const I = require("../engine/invariants.js");

const run = (g, list) => list.reduce((st, [a, seat]) => {
  const r = A.reduce(st, a, seat);
  assert.equal(r.error, null, "unexpected refusal of " + a.t + " by seat " + seat + ": " + r.error);
  return r.state;
}, g);

/* Every card in the game, wherever it is. Used to prove nothing vanishes:
   a card in TWO zones is what invariants.js watches for, but a card in NO
   zone simply drops out of the census and is invisible to it. */
const allCards = g => g.sides.reduce((acc, s) => acc.concat(
  s.deck, s.hand, s.pitch, s.grave, s.banish, s.soul, s.arsenal ? [s.arsenal] : [],
  s.gear, (s.board || []).map(b => b.card)), []).concat(g.chain || [], g.stack || []);

/* ---- the constraint --------------------------------------------------- */

test("BLANK MEANS BLANK — no card here carries rules text or keywords", () => {
  const g = A.newMatch({seed: "blank-check"});
  for(const c of allCards(g)){
    assert.equal(c.tx, "", c.name + " has rules text — this module must stay card-free");
    assert.deepEqual(c.kw, [], c.name + " has keywords");
  }
});

test("actions.js never reaches for the parser or the card pool", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "actions.js"), "utf8");
  for(const banned of ["DawnParser", "fxParse", "classifyClause", "require(\"./parser", "DawnCards"]){
    assert.ok(src.indexOf(banned) < 0, "actions.js references " + banned);
  }
});

/* ---- purity and determinism ------------------------------------------ */

test("reduce never mutates the state it is given", () => {
  const g = A.newMatch({seed: "purity", first: 0});
  const before = JSON.stringify(g);
  A.reduce(g, {t: "pitch", uid: g.sides[0].hand[0].uid}, 0);
  A.reduce(g, {t: "attack", uid: g.sides[0].hand[0].uid}, 0);
  A.reduce(g, {t: "roll", sides: 6}, 0);
  assert.equal(JSON.stringify(g), before);
});

test("an illegal action leaves the state untouched and names the reason", () => {
  const g = A.newMatch({seed: "refuse", first: 0});
  const r = A.reduce(g, {t: "pass"}, 1);
  assert.equal(r.state, g, "the state object should come straight back");
  assert.match(r.error, /does not hold priority/);
});

test("the same seed deals the same game; a different seed does not", () => {
  const key = g => g.sides.map(s => s.hand.concat(s.deck).map(c => c.uid).join(",")).join("|");
  assert.equal(key(A.newMatch({seed: "room-7"})), key(A.newMatch({seed: "room-7"})));
  assert.notEqual(key(A.newMatch({seed: "room-7"})), key(A.newMatch({seed: "room-8"})));
});

test("a die roll advances the seeded stream, and only through state.rng", () => {
  const g = A.newMatch({seed: "dice", first: 0});
  const r = A.reduce(g, {t: "roll", sides: 6}, 0);
  assert.equal(r.state.rng.n, g.rng.n + 1, "the returned rng must be stored back");
  assert.ok(r.state.lastRoll >= 1 && r.state.lastRoll <= 6);
  /* Same state, same roll — twice. An implicit global source could not do this. */
  assert.equal(A.reduce(g, {t: "roll", sides: 6}, 0).state.lastRoll, r.state.lastRoll);
});

/* ---- priority, which is priority.js's answer and not this module's ---- */

test("a match opens in the action phase with the turn-player holding priority", () => {
  const g = A.newMatch({seed: "open", first: 1});
  assert.equal(g.phase, "action");
  assert.equal(g.turnPlayer, 1);
  assert.equal(g.priority, 1);
  /* CR 4.3.2 — the action point is issued on entering the action phase,
     to the turn-player and nobody else. */
  assert.equal(g.sides[1].ap, 1);
  assert.equal(g.sides[0].ap, 0);
});

test("passing slides priority, and the second pass advances the step", () => {
  let g = A.newMatch({seed: "pass", first: 0});
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  assert.equal(g.step, "attack");
  g = run(g, [[{t: "pass"}, 0]]);
  assert.equal(g.priority, 1, "priority slides to the other seat");
  assert.equal(g.step, "attack", "one pass does not end a step");
  g = run(g, [[{t: "pass"}, 1]]);
  assert.equal(g.step, "defend", "CR 7.2.4 — both passed, the attack step ends");
});

test("declaring defenders needs no priority, but does need the defend step", () => {
  /* CR 7.3.2 — free and simultaneous, not a priority action. CR 7.3.3
     gives the TURN-PLAYER priority in that same step, which is why these
     are two separate questions. */
  let g = A.newMatch({seed: "block", first: 0});
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  assert.match(A.legal(g, {t: "defend", uids: []}, 1), /not the defend step/);
  g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  assert.equal(g.step, "defend");
  assert.equal(g.priority, 0, "the turn-player holds priority in the defend step");
  assert.equal(A.legal(g, {t: "defend", uids: [g.sides[1].hand[0].uid]}, 1), null,
    "seat 1 may declare without holding priority");
});

test("a card already defending cannot be declared again (CR 7.3.2b)", () => {
  let g = A.newMatch({seed: "reuse", first: 0});
  const blk = g.sides[1].hand[0].uid;
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0],
              [{t: "pass"}, 0], [{t: "pass"}, 1],
              [{t: "defend", uids: [blk]}, 1]]);
  assert.match(A.legal(g, {t: "defend", uids: [blk]}, 1), /already defending/);
});

test("an attack needs an action point and an action-speed window", () => {
  let g = A.newMatch({seed: "ap", first: 0});
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  assert.equal(g.sides[0].ap, 0);
  /* In the attack step there is no action speed — CR 7.6.3a opens that
     window again in the resolution step, not before. */
  assert.match(A.legal(g, {t: "attack", uid: g.sides[0].hand[0].uid}, 0), /no action-speed window/);
});

/* ---- a whole chain link ---------------------------------------------- */

test("a chain link runs the full CR 7.0.1 sequence and deals its damage", () => {
  let g = A.newMatch({seed: "link", first: 0});
  const atk = g.sides[0].hand[0], blk = g.sides[1].hand[0];
  const steps = [];
  g = run(g, [[{t: "attack", uid: atk.uid}, 0]]);
  steps.push(g.step);
  g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  steps.push(g.step);
  g = run(g, [[{t: "defend", uids: [blk.uid]}, 1]]);
  for(let i = 0; i < 6 && g.chainOpen; i++){
    g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
    steps.push(g.step);
  }
  assert.deepEqual(steps.slice(0, 6), ["attack","defend","reaction","damage","resolution","layer"],
    "CR 7.0.1 order, ending back at the layer step once the chain closes");
  assert.equal(g.chainOpen, false);
  assert.equal(g.sides[1].hp, 20 - Math.max(0, atk.power - blk.def));
});

test("an unblocked link deals its full printed power", () => {
  let g = A.newMatch({seed: "unblocked", first: 0});
  const atk = g.sides[0].hand[0];
  g = run(g, [[{t: "attack", uid: atk.uid}, 0]]);
  for(let i = 0; i < 8 && g.chainOpen; i++) g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  assert.equal(g.sides[1].hp, 20 - atk.power);
});

test("THE CLOSE STEP IS NOT A DEADLOCK", () => {
  /* CR 7.7.1 — nobody holds priority in the close step, so no player
     action can drive it out. A settle loop that waits for a pass parks
     the game in a step neither seat can leave, which is exactly what this
     did until it was driven by hand. */
  let g = A.newMatch({seed: "close", first: 0});
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  for(let i = 0; i < 8 && g.chainOpen; i++) g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  assert.equal(g.step, "layer", "the close step ran to completion on its own");
  assert.notEqual(g.priority, null, "somebody must hold priority again");
  assert.equal(A.legal(g, {t: "pass"}, g.turnPlayer), null, "the game is playable again");
});

test("no card ever ends up in zero zones", () => {
  /* invariants.js catches a card in TWO zones; a card in NONE just falls
     out of the census, so it is checked by counting. */
  let g = A.newMatch({seed: "conserve", first: 0});
  const before = allCards(g).length;
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0],
              [{t: "pass"}, 0], [{t: "pass"}, 1],
              [{t: "defend", uids: [g.sides[1].hand[0].uid]}, 1]]);
  for(let i = 0; i < 8 && g.chainOpen; i++) g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  const after = allCards(g);
  assert.equal(after.length, before, "a card went missing");
  assert.equal(new Set(after.map(c => c.uid)).size, before, "a card is in two places");
  assert.equal(g.sides[0].grave.length, 1, "the attack was filed");
  assert.equal(g.sides[1].grave.length, 1, "the defender was filed");
  assert.ok(g.sides[0].grave[0]._gy != null, "the graveyard is turn-stamped");
});

test("the invariant judge stays clean through a whole link and a turn", () => {
  let g = A.newMatch({seed: "judge", first: 0});
  const check = where => assert.deepEqual(I.errors(g), [], "invariants at " + where);
  check("open");
  g = run(g, [[{t: "pitch", uid: g.sides[0].hand[0].uid}, 0]]); check("after a pitch");
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]); check("mid-chain");
  for(let i = 0; i < 8 && g.chainOpen; i++) g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  check("chain closed");
  g = run(g, [[{t: "endTurn"}, 0]]); check("after the handoff");
});

/* ---- the stack, which is a different question from the chain ---------- */

test("passing on a POPULATED stack resolves a layer and does not end the step", () => {
  /* priority.js's header calls this the most expensive kind of priority
     bug: a machine that cannot tell "resolve the top layer" from "the
     step ends" skips a whole reaction window whenever anything is on the
     stack, and the defending player never gets asked. */
  let g = A.newMatch({seed: "stack", first: 0});
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  g = {...g, stack: [{name: "Blank Layer"}]};
  assert.equal(P.passOutcome(P.pass(P.pass(g))), "resolve-layer");
  g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  assert.equal(g.step, "attack", "the step must NOT have advanced");
  assert.equal(g.stack.length, 0, "the top layer resolved");
  assert.equal(g.priority, g.turnPlayer, "priority returns to the turn-player");
});

/* ---- the turn handoff ------------------------------------------------- */

test("endTurn follows CR 4.4.3 and hands the seat over", () => {
  let g = A.newMatch({seed: "turn", first: 0});
  g = run(g, [[{t: "pitch", uid: g.sides[0].hand[0].uid}, 0]]);
  assert.equal(g.sides[0].pitch.length, 1);
  assert.ok(g.sides[0].res > 0);
  const deckWas = g.sides[0].deck.length;
  g = run(g, [[{t: "endTurn"}, 0]]);

  assert.equal(g.sides[0].pitch.length, 0, "CR 4.4.3c — pitch to the bottom of the deck");
  assert.equal(g.sides[0].deck.length, deckWas + 1);
  /* CR 4.4.3e — ALL players lose action and resource points, not just the
     turn-player. Invisible with one acting side, a real two-player bug. */
  assert.equal(g.sides[0].res, 0);
  assert.equal(g.sides[1].res, 0);
  assert.equal(g.turnPlayer, 1);
  assert.equal(g.sides[1].hand.length, g.sides[1].int, "CR 4.4.3f — draw to intellect");
  assert.equal(g.sides[1].ap, 1, "CR 4.3.2 — the incoming turn-player gets the action point");
  assert.equal(g.sides[0].ap, 0);
  assert.equal(g.priority, 1);
});

test("a seat cannot end a turn that is not theirs, or one with a chain open", () => {
  let g = A.newMatch({seed: "endguard", first: 0});
  assert.match(A.legal(g, {t: "endTurn"}, 1), /does not hold priority/);
  g = run(g, [[{t: "attack", uid: g.sides[0].hand[0].uid}, 0]]);
  g = run(g, [[{t: "pass"}, 0], [{t: "pass"}, 1]]);
  assert.match(A.legal(g, {t: "endTurn"}, 0), /chain is still open/);
});

test("the whole action set is exercised by these drills", () => {
  /* A new action that nothing drives is worse than no action at all. */
  assert.deepEqual([...A.ACTIONS].sort(), ["attack","defend","endTurn","pass","pitch","roll"]);
});

test("a side built by newMatch is the shape sides.js declares", () => {
  const g = A.newMatch({seed: "shape"});
  for(const i of [0, 1])
    assert.deepEqual(Object.keys(g.sides[i]).sort(), [...S.SIDE_FIELDS].sort(),
      "seat " + i + " must carry exactly the declared side fields");
});
