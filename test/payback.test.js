/* ============================================================
   payback.test.js — THE POLICY TAKES BACK AN OVER-PITCH (v6.66)

   Found by tools/chaos.js (a random legal move mixed into self-play): a
   payment already selected PAST the cost (a person tapped one card too
   many, then the seat was handed to the AI) left the policy proposing
   `payConfirm`, which `legal` refuses — "a card is pitched only while the
   cost is unpaid" (ruling 2026-08-01). A refusal is always a policy bug.
   Driven: the over-pitched payment gets a `paySel` taking back a card the
   rest covers without; then the confirm is legal and the play resolves.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

test("an over-pitched payment: the policy takes a card back, then pays", {skip}, () => {
  H.db();
  const atk = {...H.card("Brutal Assault", 3), uid: "atk"};
  assert.ok((atk.cost || 0) >= 1, "fixture: the attack must cost something");
  const blues = ["b1", "b2", "b3"].map(u => ({...H.card("Brutal Assault", 3), uid: u}));
  let g = {...H.state({res: 0, ap: 1, hand: [atk, ...blues]}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}),
           phase: "action", step: "layer", priority: 0, passed: []};
  g = J.reduce(g, {t: "play", uid: "atk", from: "hand"}, 0).state;
  assert.ok(g.pending && g.pending.kind === "pay", "fixture: no payment opened");
  /* select every card in hand: far past the cost */
  for(const b of blues){ const o = J.reduce(g, {t: "paySel", uid: b.uid}, 0); assert.equal(o.error, null); g = o.state; }
  assert.notEqual(J.legal(g, {t: "payConfirm"}, 0), null, "fixture: the over-pitch is not refused");
  for(let i = 0; i < 4 && g.pending && g.pending.kind === "pay"; i++){
    const a = SP.act(g, 0);
    assert.equal(J.legal(g, a, 0), null, "the policy proposed a refused action: " + JSON.stringify(a));
    g = J.reduce(g, a, 0).state;
  }
  assert.ok(!g.pending || g.pending.kind !== "pay", "the payment never settled");
  assert.ok(g.sides[0].hand.length >= 1, "every card was pitched");
});
