/* ============================================================
   AN AMP-ONLY ABILITY WAITS FOR AN ARCANE CARD (QUEUE v4 H18, v5.52)
   Crucible of Aetherweave's whole payout is "the next card you play this
   turn with an arcane damage effect ... plus 1". `judge.abAmpTakers` names
   such a piece and the arcane cards that could take it; the seat only
   activates it when it can pay for both. Driven on real cards, asserted on
   the action chosen, its reason key, and damage dealt.

   LIGHT THE WAY reads its colour off the ON-HIT condition (`condOnHit`),
   which `chargePitchWanted` did not look at.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, H.card(n, p), {uid});
const piece = (n, uid) => { const g = ent(n, 0, uid); P.fxReset(); B.equipPiece(g); P.fxReset(); return g; };
const atk = (uid, pitch, power) => ({uid, name: "Probe " + uid, pitch, power: power || 3, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const plain = uid => ({uid, name: "Plain " + uid, pitch: 1, cost: 0, power: null, def: 2,
  tt: "Generic Action", ty: ["Generic", "Action"], kw: [], tx: ""});
const table = (mine, extra) => Object.assign(
  H.state(Object.assign({name: "Iyslander", res: 0, ap: 1, deck: [atk("d1", 3)]}, mine), {hp: 20, hand: [], deck: [atk("t1", 3)]},
    {actor: 0, turnPlayer: 0, turn: 3}),
  {phase: "action", step: "layer", priority: 0, passed: []}, extra || {});
const isCrucible = a => a && a.t === "activate" && a.uid === "cru";

test("H18: Crucible with only a non-arcane card left is NOT activated", {skip}, () => {
  const g = table({res: 4, hand: [plain("pl")], gear: [piece("Crucible of Aetherweave", "cru")]});
  assert.equal(J.legal(g, {t: "activate", uid: "cru"}, 0), null, "control: the ability is legal");
  const v = J.abAmpTakers(g, 0, "cru");
  assert.deepEqual(v.takers, [], "no arcane card could take it");
  assert.ok(!isCrucible(SP.act(g, 0)), "waits: " + JSON.stringify(SP.act(g, 0)));
});

test("H18: with an affordable arcane card it IS activated, and that card deals +1", {skip}, () => {
  const bolt = ent("Ice Bolt", 3, "ib");
  let g = table({res: 4, hand: [bolt], gear: [piece("Crucible of Aetherweave", "cru")]});
  const x = SP.explain(g, 0);
  assert.ok(isCrucible(x.action), "activated: " + JSON.stringify(x.action));
  assert.equal(x.key, "gearAmp", "under its own reason");
  assert.ok(SP.CALL_WHY.gearAmp);
  let r = J.reduce(g, {t: "activate", uid: "cru"}, 0);
  assert.ok(r.state && !r.error, JSON.stringify(r).slice(0, 150));
  g = H.drain(r.state);
  r = J.reduce(g, {t: "play", uid: "ib", from: "hand"}, 0);
  assert.ok(r.state && !r.error, JSON.stringify(r).slice(0, 150));
  let n = r.state;
  for(let i = 0; i < 40 && (n.stack || []).length + (n.prompt ? 1 : 0) + (n.pending ? 1 : 0); i++){
    if(n.prompt || n.pending){ const a = SP.act(n, 0); n = J.reduce(n, a, 0).state; }
    else n = H.move(n);
  }
  assert.equal(20 - n.sides[1].hp, 4, "Ice Bolt's 3 plus the Crucible's 1");
});

test("H18: an arcane card it cannot also pay for does not release the ability", {skip}, () => {
  const bolt = ent("Ice Bolt", 3, "ib");   /* costs 2; the Crucible costs a card too */
  const g = table({res: 0, hand: [bolt], gear: [piece("Crucible of Aetherweave", "cru")]});
  assert.ok(!isCrucible(SP.act(g, 0)), "nothing left to pitch for the ability and the bolt together");
});

test("H18: Spellfire Cloak and Talismanic Lens are not amp-only, so unaffected", {skip}, () => {
  const g = table({res: 4, hand: [plain("pl")], gear: [piece("Spellfire Cloak", "cl"), piece("Talismanic Lens", "tl")]});
  assert.equal(J.abAmpTakers(g, 0, "cl"), null);
  assert.equal(J.abAmpTakers(g, 0, "tl"), null);
});

test("Light the Way charges the yellow", {skip}, () => {
  const g = table({name: "Boltyn", hand: [atk("red", 1), atk("yel", 2), atk("blu", 3)], soul: []});
  g.pending = {kind: "charge", card: ent("Light the Way", 1, "pc"), uids: ["red", "yel", "blu"], picked: [], seat: 0};
  assert.equal(J.chargePitchWanted(g), 2, "the rider's colour is found");
  assert.equal(SP.act(g, 0).uid, "yel");
  assert.equal(SP.explain(g, 0).key, "chargeColour");
});
