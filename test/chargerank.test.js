/* ============================================================
   chargerank.test.js — CHARGE FIRST, THEN THE WEAPON IT PUMPED (v5.41)

   QUEUE v4 H6. Boltyn's deck turns on "if you've charged this turn", and
   `sparring.offence` ranked attacks on printed power alone, so his turn
   was one uncharged attack. Before the seat has charged, an attack that
   offers a charge (and leaves a card in hand to charge) now goes first,
   the one whose go again the charge turns on ahead of the rest; once
   charged, a weapon the charge pumped above its base swings before a hand
   attack that keeps nothing. Every fact comes from `judge.chargeView`, so
   `sparring.js` still reads no card text.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
let _uid = 96000;
const card = (n, p) => { const c = H.card(n, p); c.uid = ++_uid; return c; };
const charged = () => Object.assign(S.freshHist(), {charged: 1});

function seat0(o){
  H.db();
  let g = H.state(Object.assign({res: 9, ap: 1, hand: []}, o), {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return g;
}

/* ---- 1. THE READER ------------------------------------------------------- */

test("chargeView: Take Flight offers a charge and its go again turns on it", {skip}, () => {
  const tf = card("Take Flight", 1);
  const v = J.chargeView(seat0({hand: [tf]}), 0, tf.uid, "hand");
  assert.deepEqual(v, {charged: false, offers: true, gaIf: true, base: 4, power: 4});
});

test("chargeView: a charge-gated pump counts only once the seat HAS charged", {skip}, () => {
  const vt = card("Valiant Thrust", 1);
  assert.equal(J.chargeView(seat0({hand: [vt]}), 0, vt.uid, "hand").power, 4, "uncharged: printed");
  const v = J.chargeView(seat0({hand: [vt], hist: charged()}), 0, vt.uid, "hand");
  assert.equal(v.charged, true);
  assert.equal(v.power, 7, "charged: +3{p}");
  assert.equal(v.offers, false, "it prints no charge of its own");
});

test("chargeView: a weapon is read off the gear zone, and a card elsewhere is null", {skip}, () => {
  const ry = card("Raydn, Duskbane", 0), tf = card("Take Flight", 1);
  const g = seat0({gear: [ry], hand: [], arsenal: tf, hist: charged()});
  const v = J.chargeView(g, 0, ry.uid, "weapon");
  assert.ok(v.power > v.base, "the charge pumped the swing above its base");
  assert.equal(J.chargeView(g, 0, ry.uid, "hand"), null, "it is not in the hand");
  assert.equal(J.chargeView(g, 0, tf.uid, "hand"), null, "it is in the arsenal");
  assert.equal(J.chargeView(g, 0, tf.uid, "arsenal").offers, true, "control: its own zone");
});

/* ---- 2. THE POLICY ---------------------------------------------------------- */

test("uncharged: the charge-offering attack goes before a bigger plain one", {skip}, () => {
  const ba = card("Brutal Assault", 1), bolt = card("Bolt of Courage", 1);
  const a = SP.act(seat0({hand: [ba, bolt, card("Raging Onslaught", 3)]}), 0);
  assert.equal(a && a.uid, bolt.uid, "3-power Bolt of Courage (offers a charge) before 6-power Brutal Assault");
});

test("uncharged: with no card left to charge, the offer does not reorder", {skip}, () => {
  /* The hand is Take Flight alone, so playing it leaves nothing to charge
     and Brutal Assault (from the arsenal, 6 power) ranks on power as before.
     The second half adds one card and the order turns round. */
  const ba = card("Brutal Assault", 1), tf = card("Take Flight", 1);
  assert.equal(SP.act(seat0({hand: [tf], arsenal: ba}), 0).uid, ba.uid, "no room to charge");
  const tf2 = card("Take Flight", 1), ba2 = card("Brutal Assault", 1);
  assert.equal(SP.act(seat0({hand: [tf2, card("Raging Onslaught", 3)], arsenal: ba2}), 0).uid, tf2.uid,
    "control: with a card to charge, the charge goes first");
});

test("charged: the weapon the charge pumped swings before a hand attack", {skip}, () => {
  const ry = card("Raydn, Duskbane", 0), ba = card("Brutal Assault", 1);
  const a = SP.act(seat0({hand: [ba], gear: [ry], hist: charged()}), 0);
  assert.deepEqual(a, {t: "activate", uid: ry.uid});
});

test("uncharged: the same weapon is NOT promoted, and the hand attack goes", {skip}, () => {
  const ry = card("Raydn, Duskbane", 0), ba = card("Brutal Assault", 1);
  const a = SP.act(seat0({hand: [ba], gear: [ry]}), 0);
  assert.equal(a && a.uid, ba.uid);
  assert.equal(a.t, "play");
});

test("charged: a go again that turned on the charge keeps the point and goes first", {skip}, () => {
  const ba = card("Brutal Assault", 1), tf = card("Take Flight", 1);
  const a = SP.act(seat0({hand: [ba, tf], hist: charged()}), 0);
  assert.equal(a && a.uid, tf.uid, "4-power Take Flight with go again before 6-power Brutal Assault");
});
