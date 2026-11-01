/* ============================================================
   A GRANT WAITS FOR AN ATTACK IT CAN PAY FOR, AND ITS PAYMENT KEEPS THAT ATTACK (H29)

   Found by watching Lyath lose. Villainous Pose and Prime the Crowd print "your next
   attack gets +N" with a boo beside it, so `judge.grantTakers` read them as something
   else and they were played whether or not an attack could take the +N; and
   `grantOK` checked the attack against the hand WITHOUT the grant's own payment,
   so the one attack in hand was pitched to pay for the card that pumps it. Lyath
   played a grant on 315 of 817 turns in 84 games and 61 of them (19%) had no attack
   at all: the hand spent, the +N unused. A weapon or an ally taker was never asked
   about cost.

   Three halves, all asked through judge so `sparring.js` still reads no card text:
     the reader   `judge.grantTakers` counts a boo as a rider; `judge.grantReserve`
                  names the hand attacks a grant being paid for would still take;
     the hold     `jointly`: the grant's cost AND the attack's, out of what floats and
                  the hand that is neither of them (a weapon's and an ally's cost too);
     the pitch    the best such attack is passed over while anything else can pay.

   Driven on real states and asserted on the action chosen, the reason key, and that
   `explain` returns the very action `act` does.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
let _uid = 97000;
const card = (n, p) => { const c = H.card(n, p); c.uid = ++_uid; return c; };

function seat0(o){
  H.db();
  let g = H.state(Object.assign({res: 0, ap: 1, hand: []}, o), {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return g;
}
const said = (g, s) => SP.explain(g, s == null ? 0 : s);
const same = (g, s) => assert.deepEqual(said(g, s).action, SP.act(g, s == null ? 0 : s), "explain returns the action act proposes");

/* ---- 1. THE READERS ------------------------------------------------------------ */

test("a grant with a boo beside it is still a grant: Villainous Pose and Prime the Crowd", {skip}, () => {
  const pose = card("Villainous Pose", 1), prime = card("Prime the Crowd", 1), ss = card("Short Shrift", 2);
  const g = seat0({hand: [pose, prime, ss], res: 9});
  assert.deepEqual(J.grantTakers(g, 0, pose.uid, "hand").map(t => t.uid), [ss.uid], "Pose's taker is the attack in hand");
  assert.deepEqual(J.grantTakers(g, 0, prime.uid, "hand").map(t => t.uid), [ss.uid], "and Prime the Crowd's");
});

test("a card that prints a boo and no grant is not one, and neither is an attack", {skip}, () => {
  const bz = card("Booze!", 3), ss = card("Short Shrift", 2), dd = card("Drag Down", 1);
  const g = seat0({hand: [bz, ss, dd], res: 9});
  assert.equal(J.grantTakers(g, 0, bz.uid, "hand"), null, "Booze! is a boo, with nothing to take");
  assert.equal(J.grantTakers(g, 0, ss.uid, "hand"), null);
  assert.equal(J.grantReserve(g, 0, bz), null);
  assert.equal(J.grantReserve(g, 0, ss), null);
  assert.equal(J.grantReserve(g, 0, dd), null, "a defence reaction is not a grant");
});

test("grantReserve names the hand attacks a grant admits, never itself, and no card that is not one", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2), dd = card("Drag Down", 1);
  const g = seat0({hand: [pose, ss, dd]});
  const r = J.grantReserve(g, 0, pose);
  assert.deepEqual(r.map(k => k.uid), [ss.uid], "the attack only");
  assert.equal(r[0].cost, 0); assert.equal(r[0].power, 3);
  assert.deepEqual(J.grantReserve(seat0({hand: [pose, dd]}), 0, pose), [], "a grant with no attack: an empty list, not null");
});

/* ---- 2. THE HOLD ----------------------------------------------------------------- */

test("the only attack in hand would have to pay for the grant: the grant waits and the attack is swung", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2);
  const g = seat0({hand: [pose, ss]});
  const x = said(g);
  assert.equal(x.action && x.action.t, "play", JSON.stringify(x.action));
  assert.equal(x.action.uid, ss.uid, "Short Shrift is swung; Pose stays");
  assert.equal(x.key, "grantWait", "under its own reason");
  assert.ok(SP.CALL_WHY.grantWait && x.why === SP.CALL_WHY.grantWait, "and the call says why");
  same(g);
  assert.equal(J.legal(g, x.action, 0), null, "the judge accepts it");
});

test("the same hand with a pitch to spare plays the grant first", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2), dd = card("Drag Down", 1), ox = card("Oasis Respite", 1);
  const g = seat0({hand: [pose, ss, dd, ox]});
  const x = said(g);
  assert.equal(x.action && x.action.uid, pose.uid, "two 1-pitch cards pay the 2, the attack stays");
  assert.equal(x.key, "keepsAP");
  same(g);
});

test("a held grant is not counted when it is played from floating resources", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2);
  const g = seat0({hand: [pose, ss], res: 2});
  assert.equal(said(g).action.uid, pose.uid, "cost covered: no card is pitched, so nothing is in the way");
  assert.equal(said(g).key, "keepsAP");
});

test("a weapon's cost counts: Titan's Fist needs 3 beside Pose's 2", {skip}, () => {
  /* Full of Bravado costs 3 and cannot be paid beside Pose; the weapon was always counted payable */
  const pose = card("Villainous Pose", 1), fob = card("Full of Bravado", 3);
  /* the build lifts the swing's printed {r}{r}{r} onto the weapon as its cost */
  const fist = Object.assign(card("Titan's Fist", 0), {cost: 3});
  const g = seat0({hand: [pose, fob], gear: [fist]});
  assert.ok(J.grantTakers(g, 0, pose.uid, "hand").some(t => t.from === "weapon"), "control: the weapon is a taker");
  const x = said(g);
  assert.notEqual(x.action && x.action.uid, pose.uid, "5 resources cannot be raised from one pitch-3 card");
  assert.equal(x.action && x.action.t, "activate", "the weapon is swung instead: " + JSON.stringify(x.action));
  assert.equal(x.action.uid, fist.uid);
  same(g);
  const rich = seat0({hand: [pose, fob], gear: [fist], res: 2});
  assert.equal(said(rich).action.uid, pose.uid, "control: with Pose's 2 floating the 3 is still there to pay");
  assert.equal(said(rich).key, "keepsAP");
});

/* ---- 3. THE PITCH ------------------------------------------------------------------ */

test("paying for the grant passes over the attack it is for", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2), dd = card("Drag Down", 1), ox = card("Oasis Respite", 1);
  let g = seat0({hand: [pose, ss, dd, ox]});
  const play = SP.act(g, 0);
  assert.equal(play.uid, pose.uid);
  const o = J.reduce(g, play, 0);
  assert.ok(!o.error, o.error);
  g = o.state;
  const x = said(g);
  assert.equal(x.action && x.action.t, "paySel", JSON.stringify(x.action));
  assert.notEqual(x.action.uid, ss.uid, "the 2-pitch attack is not the card paid with");
  assert.equal(x.key, "grantKeep", "under its own reason");
  assert.ok(SP.CALL_WHY.grantKeep && x.why === SP.CALL_WHY.grantKeep);
  same(g);
  assert.equal(J.legal(g, x.action, 0), null);
});

test("the payment is plain when no attack is in the way", {skip}, () => {
  const pose = card("Villainous Pose", 1), dd = card("Drag Down", 1), ox = card("Oasis Respite", 1), edge = card("Edge of Their Seats", 3);
  /* no attack to take it: Pose is held, so pay for it by hand to see the plain pick */
  let g = seat0({hand: [pose, dd, ox, edge], res: 0});
  const o = J.reduce(g, {t: "play", uid: pose.uid, from: "hand"}, 0);
  assert.ok(!o.error, o.error);
  const x = said(o.state);
  assert.equal(x.action.uid, edge.uid, "the highest pitch, as before");
  assert.equal(x.key, "pitch");
});

test("the keep gives way when nothing else can pay", {skip}, () => {
  const pose = card("Villainous Pose", 1), ss = card("Short Shrift", 2);
  /* the pending is opened by hand (the policy would not play Pose here): the attack is the only card
     that can pay, so it is pitched rather than leaving the cost unmet */
  const g = seat0({hand: [pose, ss]});
  const o = J.reduce(g, {t: "play", uid: pose.uid, from: "hand"}, 0);
  assert.ok(!o.error, o.error);
  const x = said(o.state);
  assert.equal(x.action.t, "paySel");
  assert.equal(x.action.uid, ss.uid, "pitching it is better than a payment that cannot be made");
  assert.equal(x.key, "pitch");
});
