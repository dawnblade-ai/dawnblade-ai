/* ============================================================
   A DEFENCE REACTION IS HELD WHEN THE WALL ALREADY STOPS THE HIT (QUEUE v4 H22)
   The policy cast its cheapest legal defence reaction in every reaction step,
   whether or not anything was left to stop. After `blockSpare` (v5.63) had
   stopped a hit for free the seat also spent its Springboard Somersault,
   Oasis Respite or Trap on it: a card and its cost for a hit that was already
   dead. Self-play, four chip decks over every opponent: 37-51% of their
   defence reactions were cast against a link the declared blocks already
   stopped (Dorinthea 84 of 166).

   Own-seat A/B, 24 seeds paired by seed (wins of 28): Arakni 8.0 -> 10.1,
   Dorinthea 10.7 -> 11.8, Boltyn 7.3 -> 7.8, Lyath 6.8 -> 7.5.

   Driven on a real reaction step: seat 0 swings 6, seat 1 declares blockers
   (the wall), seat 0 passes, and seat 1 is asked. Asserted on the action, the
   reason key, and that `explain` returns the very action `act` does.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

const SWING = total => ({name: "Probe Swing", tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [],
  power: total, pitch: 1, cost: 0, def: 0, uid: "atk1", resolved: true});
/* a plain defender: printed defence, no power, no cost */
const wall = (uid, def) => ({uid, name: "Wall " + uid, pitch: 1, cost: 0, power: null, def,
  tt: "Generic Action", ty: ["Generic", "Action"], kw: [], tx: "", resolved: true});
/* a real defence reaction: Frailty Trap prints 3 defence and nothing that moves the wall */
const trap = uid => Object.assign({}, C.resolveEntry(H.db(), {name: "Frailty Trap", p: 1, code: null, q: 1}), {uid});

/* Seat 0 swings `total`; seat 1 declares the `blockers` it is given (the
   wall), plays any of `played` first, and is then asked in the reaction
   step with `hand` in hand. Returns the state at that moment. */
function reactionStep({total = 6, blockers = [], hand = [trap("dr1")], played = []}){
  H.db();
  let g = J.newMatch({builds: [null, null], names: ["A", "B"], heroKeys: [null, null], seed: "rxhold"});
  g.sides[0].hand = [SWING(total)]; g.sides[0].ap = 1; g.sides[0].res = 9; g.sides[0].gear = [];
  g.sides[1].hand = [...blockers, ...hand, ...played]; g.sides[1].res = 9; g.sides[1].gear = []; g.sides[1].hp = 20;
  g.phase = "action"; g.step = "layer"; g.priority = 0; g.turnPlayer = 0;
  const send = (a, seat) => { const r = J.reduce(g, a, seat); assert.ok(!r.error, JSON.stringify(a) + ": " + r.error); g = r.state; };
  send({t: "play", uid: "atk1", from: "hand"}, 0);
  for(let i = 0; i < 12 && g.step !== "defend" && g.step !== "reaction"; i++) send({t: "pass"}, g.priority);
  for(const b of blockers) send({t: "defend", uid: b.uid}, 1);
  for(let i = 0; i < 12 && !(g.step === "reaction" && g.priority === 0); i++) send({t: "pass"}, g.priority);
  /* seat 1 casts what it is told to before the question, as a policy would */
  for(const c of played){ send({t: "pass"}, 0); send({t: "play", uid: c.uid, from: "hand"}, 1); }
  for(let i = 0; i < 12 && !(g.step === "reaction" && g.priority === 1 && !(g.stack || []).length); i++){
    if(g.priority == null) break;
    send({t: "pass"}, g.priority);
  }
  assert.equal(g.step, "reaction", "control: the reaction step");
  assert.equal(g.priority, 1, "control: seat 1 holds priority");
  return g;
}
const said = g => SP.explain(g, 1);
const WHY = "an explained pass is the pass act proposes";

test("H22 control: the fixture is a defence reaction the judge lets seat 1 play", {skip}, () => {
  const g = reactionStep({});
  const dr = g.sides[1].hand.find(c => c.uid === "dr1");
  assert.equal(J.defendsNow(g, 1, "dr1", "hand"), true, "the reader says it defends");
  assert.equal(J.legal(g, {t: "play", uid: "dr1", from: "hand"}, 1), null, "and it is legal to play now");
  assert.equal(dr.def, 3);
});

test("H22: a hit nothing has stopped is met with the defence reaction, as before", {skip}, () => {
  const g = reactionStep({total: 6, blockers: []});
  assert.equal(SP.wallOf(g.sides[1]), 0);
  const x = said(g);
  assert.deepEqual(x.action, {t: "play", uid: "dr1", from: "hand"});
  assert.equal(x.key, "rxDefend");
  assert.deepEqual(x.action, SP.act(g, 1), WHY);
});

test("H22: a hit the declared blocks already stop leaves the card in hand", {skip}, () => {
  const g = reactionStep({total: 6, blockers: [wall("b1", 3), wall("b2", 3)]});
  assert.equal(SP.wallOf(g.sides[1]), 6, "control: the wall equals the swing");
  const x = said(g);
  assert.deepEqual(x.action, {t: "pass"});
  assert.equal(x.key, "rxHold", "under its own reason");
  assert.ok(SP.CALL_WHY.rxHold && x.why === SP.CALL_WHY.rxHold, "and the call says why");
  assert.deepEqual(x.action, SP.act(g, 1), WHY);
  assert.equal(J.legal(g, x.action, 1), null, "the judge accepts the pass");
  assert.ok(g.sides[1].hand.some(c => c.uid === "dr1"), "the card is still there to be played on a later link");
});

test("H22: a wall that stops MORE than the swing holds too", {skip}, () => {
  const g = reactionStep({total: 4, blockers: [wall("b1", 3), wall("b2", 3)]});
  assert.equal(said(g).key, "rxHold");
});

test("H22: a hit that leaks by one is still met (a one-point cushion measured worse)", {skip}, () => {
  const g = reactionStep({total: 7, blockers: [wall("b1", 3), wall("b2", 3)]});
  assert.equal(SP.wallOf(g.sides[1]), 6);
  const x = said(g);
  assert.equal(x.key, "rxDefend", "6 stops 6 of 7: the reaction covers the last point");
  assert.deepEqual(x.action, SP.act(g, 1), WHY);
});

test("H22: a defence reaction already played counts toward the wall", {skip}, () => {
  /* nothing declared, one Frailty Trap (3) already played against a swing of 3:
     the damage step will total 3 against 3, so a second trap has nothing to stop */
  const g = reactionStep({total: 3, blockers: [], hand: [trap("dr2")], played: [trap("dr1")]});
  assert.equal(SP.wallOf(g.sides[1]), 0, "control: wallOf reads declared blockers only");
  assert.equal((g.sides[1].blockRx || []).reduce((t, l) => t + l.def, 0), 3, "control: one DR is on the link");
  const x = said(g);
  assert.equal(x.key, "rxHold", "the played DR's printed defence is in the wall");
  assert.deepEqual(x.action, SP.act(g, 1), WHY);
});

test("H22: ...and a second one is still played when the first left a leak", {skip}, () => {
  const g = reactionStep({total: 6, blockers: [], hand: [trap("dr2")], played: [trap("dr1")]});
  const x = said(g);
  assert.equal(x.key, "rxDefend", "3 of 6 stopped: the second trap is needed");
  assert.deepEqual(x.action, {t: "play", uid: "dr2", from: "hand"});
});

test("H22: the attacker's own reaction is not held by the rule", {skip}, () => {
  /* seat 0 holds an attack reaction against a wall that stops its swing: the
     rule is the DEFENDER's, so the attacker's `rxAttack` is unchanged. */
  H.db();
  let g = J.newMatch({builds: [null, null], names: ["A", "B"], heroKeys: [null, null], seed: "rxhold-atk"});
  const pump = Object.assign({}, C.resolveEntry(H.db(), {name: "Oasis Respite", p: 1, code: null, q: 1}), {uid: "rx1"});
  g.sides[0].hand = [SWING(3), pump]; g.sides[0].ap = 1; g.sides[0].res = 9; g.sides[0].gear = [];
  g.sides[1].hand = [wall("b1", 3), wall("b2", 3)]; g.sides[1].gear = []; g.sides[1].hp = 20;
  g.phase = "action"; g.step = "layer"; g.priority = 0; g.turnPlayer = 0;
  const send = (a, seat) => { const r = J.reduce(g, a, seat); assert.ok(!r.error, r.error); g = r.state; };
  send({t: "play", uid: "atk1", from: "hand"}, 0);
  for(let i = 0; i < 12 && g.step !== "defend" && g.step !== "reaction"; i++) send({t: "pass"}, g.priority);
  send({t: "defend", uid: "b1"}, 1); send({t: "defend", uid: "b2"}, 1);
  for(let i = 0; i < 12 && !(g.step === "reaction" && g.priority === 0); i++) send({t: "pass"}, g.priority);
  /* give the ATTACKER's own side a wall bigger than its swing, so a rule that
     forgot who is defending would hold here */
  g = {...g, sides: g.sides.map((sd, i) => i === 0 ? {...sd, hand: [...sd.hand, wall("w0", 5)], blockH: ["w0"]} : sd)};
  assert.ok(SP.wallOf(g.sides[0]) >= g.pend.total, "control: seat 0's own wall covers the swing");
  const x = SP.explain(g, 0);
  assert.equal(x.key, "rxAttack", "the rule is the defender's: the attacker still pumps");
  assert.deepEqual(x.action, SP.act(g, 0), WHY);
});
