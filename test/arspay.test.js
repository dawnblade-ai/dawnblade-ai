/* ======================================================================
   AN ARSENAL PUT THAT ITS OWN PAYMENT EMPTIES IS REFUSED, AND A RESOURCE
   PIECE UNLOCKS THE ATTACK IT PAYS FOR

   Two self-play games (`node tools/tourney.js '' '' 6`) never ended. One
   was a DEAD position: Arakni (1 life) held a dagger that costs {r}{r}
   and ONE Blossom of Spring; Dash (2 life) held a 3-cost Rev Up and ONE
   Blossom. Nothing to raise the price with, nothing to draw. That one is
   not a bug and no rule ends it (CR 4.5.3: there is no deck-out loss).

   The other, azalea-gravy-3, was two faults in a row:

   1. DEATH DEALER PAID FOR ITSELF WITH THE ARROW IT WAS TO PUT. Azalea
      held one card, Widowmaker. The ability prints "{r}: If you have no
      cards in your arsenal, you may put an arrow card from your hand
      face-up into your arsenal" and the only way to raise {r} was to pitch
      that same arrow, so the put had nothing to take. v5.00's refusal
      (`effects.arsNoOpWhy`) asked about the hand BEFORE the payment, and
      the seat spent its action point on a log line every turn for ~650
      turns. It is v4.91's `addCostWhy` lesson one payload over: the pitch
      is spent out of the same hand the payload reads.

   2. A RESOURCE PIECE WAS NEVER SPENT FOR THE ATTACK IT PAYS FOR. With the
      loop gone Azalea ends her turn with Widowmaker in the arsenal, where
      it costs {r} she cannot raise - while Blossom of Spring ("Destroy
      this: Gain {r}") sat in her gear, held by QUEUE v4 H11 (a piece that
      pays with itself is not a spare action). H11 is right about a
      resource with nothing to spend on; here the resource IS what makes
      the attack playable, and the attack is lethal.

   DRIVEN through `judge.legal` and `sparring.act`, the real entry points,
   with a positive control beside every refusal (v3.98).
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, H.card(n, p), {uid});
const piece = (n, uid) => { const g = ent(n, 0, uid); P.fxReset(); B.equipPiece(g); P.fxReset(); return g; };
const ACT = {t: "activate", uid: 41};

/* DEATH DEALER'S TABLE: the put's own payment is the question, so the
   floating resource and the hand are the only things that vary. */
function dealer(side){
  const g = H.state(Object.assign({gear: [piece("Death Dealer", 41)], hand: [], grave: [], arsenal: null,
      res: 0, ap: 1, name: "You"}, side || {}),
    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const arrow = (uid, p) => ent("Swift Shot", p == null ? 1 : p, uid);
const other = (uid, p) => ent("Wounding Blow", p == null ? 1 : p, uid);

test("DRIVEN: Death Dealer is refused when paying for it would pitch the only arrow in hand", {skip}, () => {
  const lone = J.legal(dealer({hand: [arrow(701)]}), ACT, 0);
  assert.match(String(lone), /would have to pitch the only arrow in hand to pay for it/, String(lone));
});

test("DRIVEN: …and it stays legal whenever some payment leaves an arrow to put", {skip}, () => {
  /* another card pays: the arrow stays */
  assert.equal(J.legal(dealer({hand: [arrow(701), other(702)]}), ACT, 0), null, "a second card pays for it");
  /* the cost is already floating: nothing is pitched */
  assert.equal(J.legal(dealer({hand: [arrow(701)], res: 1}), ACT, 0), null, "a floating resource pays for it");
  /* two arrows and nothing else: one pays, one is put */
  assert.equal(J.legal(dealer({hand: [arrow(701), arrow(703)]}), ACT, 0), null, "one arrow pays, the other is put");
  /* the hand pays with the non-arrow even when the arrow is the bigger pitch */
  assert.equal(J.legal(dealer({hand: [arrow(701, 3), other(702, 1)]}), ACT, 0), null, "the small card pays, the big arrow stays");
});

test("the refusal is the cost's own: a seat that cannot pay at all is not told this", () => {
  /* `abCostWhy` has no word for an unpayable cost here - `legal` refuses it
     after, with its own sentence - so this body must not claim it. */
  const sd = {hand: [{name: "A", uid: 1, pitch: 1, tt: "Ranger Action - Arrow Attack", ty: ["Ranger", "Action", "Arrow", "Attack"]}],
    arsenal: null, res: 0, name: "You"};
  const ab = ent("Death Dealer", 0, 9);
  P.fxReset(); B.equipPiece(ab); P.fxReset();
  assert.match(String(E.arsNoOpWhy(sd, ab.powCard, 1)), /pitch the only arrow/, "control: a cost of 1 refuses");
  assert.equal(E.arsNoOpWhy(sd, ab.powCard, 3), null, "a cost the hand cannot raise is `legal`'s refusal, not this one");
  assert.equal(E.arsNoOpWhy(sd, ab.powCard), null, "an old caller that names no cost asks the old question");
  assert.equal(E.arsNoOpWhy(sd, ab.powCard, 0), null, "a free put pitches nothing");
});

/* ---- THE POLICY HALF ----------------------------------------------- */

/* Azalea's last position: a Widowmaker in the arsenal, Blossom in the gear,
   an empty hand and nothing floating; the foe has no hand to block with. */
const widow = uid => Object.assign(ent("Widowmaker", 2, uid), {});
function pinned(mine, theirs){
  const g = H.state(Object.assign({name: "Azalea", gear: [piece("Blossom of Spring", 41)], hand: [], arsenal: widow(60),
      res: 0, ap: 1}, mine || {}),
    Object.assign({hp: 6, hand: []}, theirs || {}), {actor: 0, turnPlayer: 0, turn: 5});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const isBlossom = a => a && a.t === "activate" && a.uid === 41;
const isWidow = a => a && a.t === "play" && a.uid === 60;

test("H11 stays: Blossom is NOT spent when nothing is waiting on the resource", {skip}, () => {
  const g = pinned({arsenal: null});
  assert.equal(J.legal(g, ACT, 0), null, "control: Blossom is legal");
  assert.ok(!isBlossom(SP.act(g, 0)), "no attack to pay for, so it is held: " + JSON.stringify(SP.act(g, 0)));
});

test("the attack the piece pays for: Blossom first, then the arrow, and it is the kill", {skip}, () => {
  let g = pinned();
  assert.notEqual(J.legal(g, {t: "play", uid: 60, from: "arsenal"}, 0), null, "control: the arrow cannot be raised yet");
  const x = SP.explain(g, 0);
  assert.ok(isBlossom(x.action), "spends the piece: " + JSON.stringify(x.action));
  assert.equal(x.key, "resUnlock", "under its own reason");
  assert.ok(SP.CALL_WHY.resUnlock);
  let r = J.reduce(g, x.action, 0);
  assert.ok(r.state && !r.error, JSON.stringify(r).slice(0, 150));
  g = H.drain(r.state);
  assert.equal(g.sides[0].res, 1, "Blossom paid its resource");
  assert.equal(g.sides[0].ap, 1, "…and its go again kept the action point");
  assert.ok((g.sides[0].gear || []).every(x => x.uid !== 41), "…and the piece is gone");
  const next = SP.act(g, 0);
  assert.ok(isWidow(next), "now the arrow is affordable and is played: " + JSON.stringify(next));
  r = J.reduce(g, next, 0);
  assert.ok(r.state && !r.error, JSON.stringify(r).slice(0, 150));
  let n = r.state;
  /* both seats play on with the policy until the chain has run its course */
  for(let i = 0; i < 40 && !n.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s);
      const o = a && J.reduce(n, a, s);
      if(o && !o.error){ n = o.state; moved = true; break; }
    }
    if(!moved) break;
  }
  assert.equal(n.sides[1].hp, 0, "Widowmaker's 3, and 3 more for an undefended link, is the foe's 6");
  assert.ok(n.over, "…and that is the game");
});

test("the piece is not spent when it still would not pay for the attack", {skip}, () => {
  /* Rev Up costs 3; Blossom brings one. Destroying the piece would buy nothing. */
  const g = pinned({arsenal: ent("Rev Up", 1, 60)});
  assert.notEqual(J.legal(g, {t: "play", uid: 60, from: "arsenal"}, 0), null, "control: unaffordable");
  const hyp = Object.assign({}, g, {sides: g.sides.map((s, i) => i === 0 ? Object.assign({}, s, {res: 1}) : s)});
  assert.notEqual(J.legal(hyp, {t: "play", uid: 60, from: "arsenal"}, 0), null, "control: still unaffordable with the resource");
  assert.ok(!isBlossom(SP.act(g, 0)), "held: " + JSON.stringify(SP.act(g, 0)));
});

test("a piece the judge would refuse is not proposed, however much the attack wants it", {skip}, () => {
  /* Predatory Plating pays {r} but prints "Activate this only if you control
     a card with 6 or more {p}": with none, the piece cannot be activated while
     the arrow WOULD be playable with its payout, so the unlock has to ask
     `legal` of the piece itself and not only of the attack. */
  const g = pinned({gear: [piece("Predatory Plating", 41)]});
  assert.equal(J.abPieceForRes(g, 0, 41), true, "control: it is a resource piece");
  assert.ok(J.abPieceResGain(g, 0, 41) > 0, "control: with a payout");
  assert.notEqual(J.legal(g, ACT, 0), null, "control: the judge refuses it here");
  const hyp = Object.assign({}, g, {sides: g.sides.map((s, i) => i === 0 ? Object.assign({}, s, {res: 1}) : s)});
  assert.equal(J.legal(hyp, {t: "play", uid: 60, from: "arsenal"}, 0), null, "control: the arrow would be playable with the payout");
  assert.ok(!isBlossom(SP.act(g, 0)), "not proposed: " + JSON.stringify(SP.act(g, 0)));
});

test("an affordable attack is played as before; the piece waits", {skip}, () => {
  const g = pinned({arsenal: ent("Widowmaker", 2, 60), hand: [other(70, 3)]});
  const a = SP.act(g, 0);
  assert.ok(isWidow(a), "plays the arrow, paying with the card in hand: " + JSON.stringify(a));
});
