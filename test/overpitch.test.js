/* ============================================================
   A CARD IS PITCHED ONLY WHILE THE COST IS UNPAID (v4.93)

   RULING (user, 2026-08-01): "you cannot pitch to bank resources. The pool
   is filled only when an activation costs more than you hold." Both boards
   honoured the WHEN (a payment opens only when the cost exceeds the pool)
   and neither honoured the HOW MUCH: a payment confirmed any selection that
   covered the cost, so paying 1 with two blues floated 5 for later.

   The rule is sequential — each card is pitched while the cost is unpaid,
   and the last may overshoot — so a selection is legal exactly when some
   card in it was still needed. A Chi cost is a SECOND requirement (v4.54),
   which is why `parser.pitchExcessWhy` asks both.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const J = require("../engine/judge");
const S = require("../engine/sparring");
const INV = require("../engine/invariants");
const H = require("./helpers/judged.js");

const card = (uid, pitch, o) => Object.assign({name: "Fuel " + uid, uid, pitch, power: 2, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []}, o || {});
const why = (res, sel, need, chi, pitchZone) => P.pitchExcessWhy({res, pitch: pitchZone || []}, sel, need, chi);

test("the last card may overshoot; nothing may be pitched after it", () => {
  assert.equal(why(0, [card(1, 3)], 1), null, "one blue for a cost of 1 is one card — legal");
  assert.match(String(why(0, [card(1, 3), card(2, 3)], 1)), /more than the cost needs/,
    "two blues for a cost of 1 banks a whole card");
  /* ORDER-FREE: a red then a blue reaches 4, and the blue is the one that
     may overshoot — the red was pitched while short */
  assert.equal(why(0, [card(1, 3), card(2, 1)], 4), null);
  assert.equal(why(0, [card(1, 3), card(2, 3)], 4), null, "3 then 3 for 4 — the second was needed");
  /* SOME card needed, not EVERY card: a red then a blue for 3 — the blue
     alone would have paid, but the red was pitched while still short and
     the blue is the one that overshoots. A test that asked every card to be
     needed refuses a sequence the rule allows. */
  assert.equal(why(0, [card(1, 3), card(2, 1)], 3), null, "red then blue for 3 was refused");
  assert.match(String(why(0, [card(1, 3), card(2, 3), card(3, 1)], 4)), /more than the cost needs/,
    "every card could be dropped and the cost still paid — one was pitched after it was");
  /* what is already floating counts toward the cost */
  assert.match(String(why(1, [card(1, 3), card(2, 1)], 2)), /more than the cost needs/);
  assert.equal(why(0, [], 3), null, "an empty selection is the shortfall check's business, not this one's");
});

test("a CHI cost is a second requirement: an Inner Chi pitched for it is needed", {skip: !H.hasDb() && "no db"}, () => {
  H.db();
  const chi = H.card("Inner Chi", 0) || H.card("Inner Chi");
  assert.equal(P.chiValue(chi), 3, "fixture: Inner Chi pitches three Chi");
  /* Enigma's {c}{c}{c} with three ordinary resources ALREADY floating: the
     resource half is met before anything is pitched. A test of that half
     alone would refuse every Chi payment there is. */
  assert.equal(why(3, [chi], 3, 3), null, "the Inner Chi paying a Chi cost was read as excess");
  const chi2 = {...chi, uid: "C2"};
  assert.match(String(why(3, [chi, chi2], 3, 3)), /more than the cost needs/,
    "a second Inner Chi was not needed by either half");
});

/* ---- DRIVEN AT THE TABLE --------------------------------------------- */

function paying(hand, cost){
  const atk = card("ATK", 1, {name: "Synthetic Strike", cost, power: 5});
  const g = Object.assign(H.state({res: 0, ap: 1, hand: [atk, ...hand]}, {hp: 20, hand: []}, {turn: 5, actor: 0}),
    {phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null});
  const n = J.reduce(g, {t: "play", uid: "ATK", from: "hand"}, 0).state;
  assert.equal(J.pendingOf(n) && J.pendingOf(n).kind, "pay", "fixture: no payment opened");
  return n;
}

test("AT THE TABLE: two blues for a cost of 1 is refused, one is accepted", () => {
  let n = paying([card("B1", 3), card("B2", 3)], 1);
  n = J.reduce(n, {t: "paySel", uid: "B1"}, 0).state;
  n = J.reduce(n, {t: "paySel", uid: "B2"}, 0).state;
  assert.match(String(J.legal(n, {t: "payConfirm"}, 0)), /more than the cost needs/,
    "the table banked a card's worth of resources inside a payment");
  n = J.reduce(n, {t: "paySel", uid: "B2"}, 0).state;      /* takes it back */
  assert.equal(J.legal(n, {t: "payConfirm"}, 0), null);
  n = H.drain(J.reduce(n, {t: "payConfirm"}, 0).state);
  assert.ok(n.sides[0].hand.some(c => c.uid === "B2"), "the card taken back stays in hand");
  assert.deepEqual(INV.errors(n), []);
});

test("THE POLICY never over-pitches, so it proposes no refusal", () => {
  /* `sparring.payAction` pitches the highest pitch first and confirms the
     moment the cost is covered — minimal by construction. Driven, not
     argued: a refusal here is a policy bug by its own contract. */
  let n = paying([card("B1", 3), card("B2", 3), card("R1", 1)], 1);
  for(let i = 0; i < 6 && J.pendingOf(n); i++){
    const a = S.act(n, 0);
    assert.ok(a, "the policy had nothing to say mid-payment");
    assert.equal(J.legal(n, a, 0), null, "the policy proposed a refused action: " + JSON.stringify(a));
    n = J.reduce(n, a, 0).state;
  }
  assert.ok(!J.pendingOf(n), "the payment never finished");
  assert.equal(n.sides[0].hand.filter(c => /^(B1|B2|R1)$/.test(c.uid)).length, 2, "the policy pitched more than one card for a cost of 1");
});

/* ---- THE TRAINER ASKS THE SAME READER -------------------------------- */

test("the trainer's confirmPay refuses on the shared reader", () => {
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const HTML = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  const PAY = HTML.slice(HTML.indexOf("const confirmPay = () => setG"), HTML.indexOf("const cancelPay = () => setG"));
  assert.ok(PAY.length > 500, "the confirmPay anchors moved — re-anchor");
  assert.match(PAY, /const _ex = DawnParser\.pitchExcessWhy\([^;]*\);\s*if\(_ex\) return L\(s,/,
    "confirmPay accepts a pitch past the cost — the ruling has no reader on this board");
});
