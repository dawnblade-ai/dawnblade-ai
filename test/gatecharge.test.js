/* ============================================================
   A CARD THAT WAITS ON A CHARGE IS GIVEN ITS CHARGE (QUEUE v4 H23)

   Duty Bound Blitz prints "Play this only if a yellow card has been put into
   your soul this turn", and the policy never set the gate up: its charge took
   the lowest-pitch card, its payment pitched the highest (the yellow, or the
   gated card itself), and the attack that spent the turn's one action point
   was picked on power. Over 84 ladder games Boltyn held the card at the start
   of 476 of 852 turns, and played it on 0.28 of them per lost game.

   Three small rules, each a reader in `judge.js` and its own reason:
     gateColour  the charge takes the colour the held card waits on;
     gateKeep    the payment before it passes over that colour and the held
                 card while the rest of the hand can still pay;
     gateFirst   an attack that same colour pumps goes first, so the hero's
                 ability can give it go again and the held card follows.

   Own-seat A/B, 48 seeds paired by seed (wins of 28): Boltyn 5.92 -> 7.19
   (t 5.9, 34 seeds up, 7 down).

   Every drill is a fire / don't-fire pair on real cards, asserted on the
   action, the reason key and `explain` deep-equalling `act`; the last one
   drives a whole turn and asserts the card is PLAYED.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
let _uid = 97000;
const card = (n, p) => { const c = H.card(n, p); c.uid = ++_uid; return c; };
/* the gated card, and a plain probe of a chosen pitch */
const dbb = () => card("Duty Bound Blitz", 1);
const probe = (name, pitch) => Object.assign({}, H.card("Snatch", 1), {name, pitch, uid: ++_uid});
const opened = () => Object.assign(S.freshHist(), {soulPut: [2]});

function seat0(o){
  H.db();
  let g = H.state(Object.assign({res: 0, ap: 1, hand: []}, o), {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return g;
}
/* the charge window of a card the seat has just played, with these cards on offer */
function chargeWindow(played, hand, extra){
  const g = seat0(Object.assign({hand}, extra || {}));
  g.pending = {kind: "charge", card: played, uids: hand.map(c => c.uid), picked: [], seat: 0};
  return g;
}
const explained = (g, seat) => {
  const x = SP.explain(g, seat || 0);
  assert.deepEqual(x.action, SP.act(g, seat || 0), "explain returns the very action act does");
  return x;
};

/* ---- 1. THE READERS ------------------------------------------------------ */

test("playGate: the held card's gate is read, closed until a yellow is put into the soul", {skip}, () => {
  const d = dbb(), plain = probe("Plain", 1);
  const g = seat0({hand: [d, plain]});
  assert.deepEqual(J.playGate(g, 0, d.uid), {kind: "soulPitch", pitch: 2, open: false});
  assert.equal(J.playGate(g, 0, plain.uid), null, "a card with no gate has none");
  assert.equal(J.playGate(seat0({hand: [d], hist: opened()}), 0, d.uid).open, true, "control: a yellow put this turn opens it");
});

test("gateColourWanted: the colour of a closed gate in hand or arsenal; null once open or with none", {skip}, () => {
  const d = dbb();
  assert.equal(J.gateColourWanted(seat0({hand: [d, probe("Plain", 3)]}), 0), 2, "in hand: yellow");
  assert.equal(J.gateColourWanted(seat0({hand: [probe("Plain", 3)], arsenal: d}), 0), 2, "in the arsenal");
  assert.equal(J.gateColourWanted(seat0({hand: [probe("Plain", 3)]}), 0), null, "nothing waits");
  assert.equal(J.gateColourWanted(seat0({hand: [d], hist: opened()}), 0), null, "already open this turn");
});

/* ---- 2. THE CHARGE TAKES THE COLOUR ------------------------------------------ */

test("charge: with Duty Bound Blitz held, the yellow is charged", {skip}, () => {
  const red = probe("Red", 1), yel = probe("Yellow", 2), blu = probe("Blue", 3);
  const g = chargeWindow(card("Bolt of Courage", 1), [red, yel, blu, dbb()]);
  assert.equal(J.chargePitchWanted(g), null, "Bolt of Courage asks for no colour of its own");
  const x = explained(g);
  assert.equal(x.action.uid, yel.uid);
  assert.equal(x.key, "gateColour");
  assert.match(x.why, /yellow/);
});

test("charge: nothing held, or the gate already open, leaves the lowest pitch", {skip}, () => {
  const red = probe("Red", 1), yel = probe("Yellow", 2), blu = probe("Blue", 3);
  const none = explained(chargeWindow(card("Bolt of Courage", 1), [red, yel, blu]));
  assert.equal(none.action.uid, red.uid); assert.equal(none.key, "charge");
  const open = explained(chargeWindow(card("Bolt of Courage", 1), [red, yel, blu, dbb()], {hist: opened()}));
  assert.equal(open.action.uid, red.uid, "the gate is open already"); assert.equal(open.key, "charge");
});

test("charge: the held card itself is never the colour card", {skip}, () => {
  const red = probe("Red", 1), held = card("Duty Bound Blitz", 2);
  const x = explained(chargeWindow(card("Bolt of Courage", 1), [red, held]));
  assert.equal(x.action.uid, red.uid, "the only yellow is the card that waits, and it stays");
  assert.equal(x.key, "charge");
  /* control: a second yellow that waits on nothing is taken */
  const yel = probe("Yellow", 2);
  const y = explained(chargeWindow(card("Bolt of Courage", 1), [red, held, yel]));
  assert.equal(y.action.uid, yel.uid);
  assert.equal(y.key, "gateColour");
});

/* ---- 3. THE PAYMENT KEEPS THEM ------------------------------------------------ */

/* Take Flight is played and the payment is open: what does the seat pitch? */
function payment(hand){
  const tf = card("Take Flight", 1);
  const g = seat0({hand: [tf, ...hand]});
  const out = J.reduce(g, {t: "play", uid: tf.uid, from: "hand", target: "hero"}, 0);
  assert.ok(out.state && out.state.pending && out.state.pending.kind === "pay", "a payment is open: " + JSON.stringify(out.error));
  return out.state;
}

test("payment: the colour card and the held card are passed over for one that is not needed", {skip}, () => {
  const d = card("Duty Bound Blitz", 2), yel = probe("Yellow", 2), red = probe("Red", 1);
  const g = payment([d, yel, red]);
  const x = explained(g);
  assert.equal(x.action.uid, red.uid, "the red pays, not the yellow it would have chosen");
  assert.equal(x.key, "gateKeep");
  /* control: the same hand without the gated card pitches the yellow, as before */
  const y = explained(payment([yel, red, probe("Other", 1)]));
  assert.equal(y.action.uid, yel.uid);
  assert.equal(y.key, "pitch");
});

test("payment: when only those cards can pay, it pays as before", {skip}, () => {
  const d = card("Duty Bound Blitz", 2), yel = probe("Yellow", 2);
  const x = explained(payment([d, yel]));
  assert.equal(x.key, "pitch", "nothing else to pitch, so no reason is claimed");
});

test("payment: a card that prints no charge does not reserve anything", {skip}, () => {
  const d = card("Duty Bound Blitz", 2), yel = probe("Yellow", 2), red = probe("Red", 1);
  const plain = Object.assign({}, H.card("Snatch", 1), {name: "Pricey", cost: 1, uid: ++_uid});
  const g0 = seat0({hand: [plain, d, yel, red]});
  const out = J.reduce(g0, {t: "play", uid: plain.uid, from: "hand", target: "hero"}, 0);
  assert.ok(out.state && out.state.pending && out.state.pending.kind === "pay");
  assert.equal(J.gateReserve(out.state, 0, out.state.pending.card), null);
  assert.equal(explained(out.state).key, "pitch");
});

/* ---- 4. THE ATTACK THE COLOUR PUMPS GOES FIRST -------------------------------- */

test("order: with the gate held, Beaming Bravado leads a Bolt of Courage that would have gone first", {skip}, () => {
  const bolt = card("Bolt of Courage", 1), bb = card("Beaming Bravado", 1);
  assert.ok(bolt.uid < bb.uid, "the tie on every printed number falls to the lower uid");
  const base = explained(seat0({hand: [bolt, bb, probe("Y", 2)]}));
  assert.equal(base.action.uid, bolt.uid, "control: nothing held, the tie is Bolt of Courage's");
  assert.equal(base.key, "chargeFirst");
  const x = explained(seat0({hand: [bolt, bb, probe("Y2", 2), dbb()]}));
  assert.equal(x.action.uid, bb.uid, "Beaming Bravado: yellow charged makes it 4, so the ability can give it go again");
  assert.equal(x.key, "gateFirst");
  const d = dbb(), open = explained(seat0({hand: [bolt, bb, probe("Y3", 2), d], hist: opened()}));
  assert.equal(open.action.uid, d.uid, "control: the gate is open, so the held card is simply played");
  assert.equal(open.key, "atkKeepsAP");
});

test("order: Take Flight keeps its own reason; an attack the colour does not pump is not reordered", {skip}, () => {
  const tf = card("Take Flight", 1), bolt = card("Bolt of Courage", 1);
  const x = explained(seat0({hand: [bolt, tf, probe("Y", 2), dbb()]}));
  assert.equal(x.action.uid, tf.uid, "its charge turns on its own go again");
  assert.equal(x.key, "chargeFirst");
  assert.equal(J.gateRaises(seat0({hand: [bolt, probe("Y2", 2), dbb()]}), 0, bolt.uid, "hand"), false, "Bolt of Courage's pump is not a colour one");
});

/* ---- 5. THE WHOLE TURN: THE HELD CARD IS PLAYED ------------------------------- */

/* drive seat 0 through its turn (seat 1 only ever passes) and report where Duty Bound Blitz ended up */
function playTurn(hand){
  let g = seat0({hand});
  g.sides[0].heroKey = "boltyn";
  for(let i = 0; i < 80 && !g.over; i++){
    const a = SP.act(g, 0) || SP.act(g, 1);
    if(!a) break;
    const seat = SP.act(g, 0) ? 0 : 1;
    if(a.t === "endTurn" && seat === 0) break;
    const r = J.reduce(g, a, seat);
    if(r.error) break;
    g = H.drain(r.state);
  }
  return g;
}

test("a turn: Take Flight, a yellow charged, and the held Duty Bound Blitz is played", {skip}, () => {
  const d = card("Duty Bound Blitz", 2);
  const g = playTurn([card("Take Flight", 1), d, probe("Yellow", 2), probe("Red", 1)]);
  assert.ok(g.sides[0].grave.some(c => c.uid === d.uid), "Duty Bound Blitz was played this turn and is spent");
  assert.equal((g.sides[0].soul || []).some(c => c.name === "Yellow"), true, "the yellow went into the soul");
  assert.equal((g.sides[0].grave || []).some(c => c.name === "Red") || (g.sides[0].pitch || []).some(c => c.name === "Red"), true, "the red paid for Take Flight");
});
