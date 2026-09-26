/* ============================================================
   THE TABLE STACK — A PLAY WAITS FOR THE OTHER SEAT (v4.66)

     CR 7.1.2   the attack is put on the stack as a layer, and players
                receive priority before it becomes a chain link
     CR 4.2.2   the top layer resolves when all players pass in succession

   Until v4.66 the table resolved every play the moment it was made, and
   the approximation ledger said the distinction was one "no card in this
   pool asks about". Measured over 210 driven games that was false: 12
   times a seat holding an instant prevention took damage from a play it
   never had a window to answer.

   WHAT THIS FILE HOLDS THE BUILD TO:
     - a held card has LEFT its zone for the stack, and the census sees it
     - the other seat really can answer before it resolves, and the answer
       changes the outcome (Oasis Respite against Vexing Malice's arcane)
     - the settled declarations and the locked resources come back intact
     - nothing at action speed can be stacked on top, and the turn cannot
       be ended over it
     - a window NOBODY can use resolves at once, and "can use" is `legal`'s
       answer, affordability included
     - the policy passes on it, the wire carries it
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H  = require("./helpers/judged.js");
const J  = require("../engine/judge.js");
const W  = require("../engine/wire.js");
const SP = require("../engine/sparring.js");
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached DB";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});

/* Seat 0 is the turn-player in its action phase with priority, and the
   defender holds whatever the drill hands it. */
function table(you, foe){
  H.db();
  return {...H.state(Object.assign({res: 9, ap: 1}, you || {}),
                     Object.assign({res: 9}, foe || {}),
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const held = g => (g.stack || []).find(l => l && l.k === "play");
const play = (g, uid, seat, from) => {
  const out = J.reduce(g, {t: "play", uid, from: from || "hand"}, seat == null ? 0 : seat);
  assert.equal(out.error, null, "fixture: the play was refused — " + out.error);
  return out.state;
};

/* ---- 1. THE HOLD ---------------------------------------------------------- */

test("an attack the defender could answer WAITS on the stack, out of its zone", {skip}, () => {
  const n = play(table({hand: [c("Raging Onslaught", 1, "atk")]},
                       {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  const L = held(n);
  assert.ok(L, "nothing is on the stack");
  assert.equal(L.card.uid, "atk");
  assert.equal(L.lifted, true, "a card played from hand is lifted onto the stack");
  assert.ok(!n.sides[0].hand.some(x => x.uid === "atk"), "…and is no longer in the hand");
  assert.equal((n.chainCards || []).length, 0, "…and is not a chain link yet");
  assert.ok(!n.pend, "…so no attack is in flight");
  assert.equal(n.step, "layer", "the step does not move until it resolves");
  assert.equal(n.priority, 0, "the seat that played it receives priority first");
  assert.deepEqual(INV.errors(n), [], "a held card breaks no invariant");
});

test("THE CENSUS SEES A HELD CARD — a card on the stack is in a zone", {skip}, () => {
  /* A card in NO zone falls out of the census silently (v2.21), so the
     proof that the stack counts is to put the same card somewhere else as
     well and watch the judge name it. */
  const n = play(table({hand: [c("Raging Onslaught", 1, "atk")]},
                       {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  const dup = J.put(n, 0, s => ({...s, grave: [...s.grave, held(n).card]}));
  assert.ok(INV.errors(dup).some(e => e.code === "CARD-IN-TWO-ZONES" && /stack/.test(e.msg)),
    "the census did not see the card on the stack");
});

test("THE ANSWER LANDS FIRST: Oasis Respite stops Vexing Malice's arcane", {skip}, () => {
  /* The printed reason this was built. "When this attacks, deal 2 arcane
     damage to target hero" resolves as the attack does, so a prevention
     played in the window is already in place when it lands. */
  const g = table({hand: [c("Vexing Malice", 3, "vm")]},
                  {hand: [c("Oasis Respite", 1, "oas"), c("Raging Onslaught", 3, "fuel")], res: 0});
  const hp = g.sides[1].hp;
  let n = play(g, "vm");
  assert.ok(held(n), "fixture: Vexing Malice did not wait");
  n = J.reduce(n, {t: "pass"}, 0).state;
  assert.equal(n.priority, 1, "the defender was never asked");
  n = play(n, "oas", 1);
  /* pitch for it if a payment opened */
  if(J.pendingOf(n)){
    n = J.reduce(n, {t: "paySel", uid: "fuel"}, 1).state;
    n = J.reduce(n, {t: "payConfirm"}, 1).state;
  }
  assert.ok(held(n), "the instant resolved and the attack is still waiting");
  n = H.drain(n);
  assert.ok(n.pend && n.pend.card.uid === "vm", "Vexing Malice never resolved");
  assert.equal(n.sides[1].hp, hp, "the arcane landed through a prevention played in time");

  /* CONTROL — the same play with no answer in hand deals its 2 at once. */
  const bare = play(table({hand: [c("Vexing Malice", 3, "vm")]}, {hand: []}), "vm");
  assert.equal(bare.sides[1].hp, hp - 2, "fixture: Vexing Malice deals nothing");
});

/* ---- 2. WHAT RIDES ON THE LAYER --------------------------------------------- */

test("the seat's floating resources are LOCKED with the card and come back to pay for it", {skip}, () => {
  const n = play(table({hand: [c("Raging Onslaught", 1, "atk")], res: 5},
                       {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  assert.equal(n.sides[0].res, 0, "the resources that pay for it could be spent in its window");
  assert.equal(held(n).res, 5, "the layer does not carry them");
  const r = H.drain(n);
  assert.equal(r.sides[0].res, 5 - 3, "it did not pay its printed 3 on resolving");
});

test("a SETTLED DECLARATION rides on the layer — a charge chosen at play lands at resolution", {skip}, () => {
  let n = J.reduce(table({hand: [c("Bolt of Courage", 1, "boc"), c("Raging Onslaught", 1, "chg")]},
                         {hand: [c("Oasis Respite", 1, "oas")]}),
                   {t: "play", uid: "boc", from: "hand"}, 0).state;
  assert.equal((J.pendingOf(n) || {}).kind, "charge", "fixture: no charge was offered");
  n = J.reduce(n, {t: "charge", uid: "chg"}, 0).state;
  assert.ok(held(n), "fixture: the charged attack did not wait");
  assert.deepEqual(held(n).decl._chargeUids, ["chg"], "the charge answer is not on the layer");
  /* `commitPlayBoosted` strips the declarations off what it returns, so a
     waiting card cannot leave one on the state for the next card. */
  assert.equal(n._chargeUids, undefined, "…and must not be left on the state for another card");
  n = H.drain(n);
  assert.ok(n.sides[0].soul.some(x => x.uid === "chg"), "the charge chosen at play was dropped");
  assert.equal(n.sides[0].hist.charged, 1);
});

/* ---- 3. WHAT CANNOT HAPPEN WHILE IT WAITS -------------------------------------- */

test("nothing at action speed goes on top of it, and the turn cannot end over it", {skip}, () => {
  /* FUEL IN HAND, or the second attack is refused for its COST — the
     locked resources leave nothing floating — and the speed rule is never
     what answers (this drill's first draft, silent under its sabotage). */
  const n = play(table({hand: [c("Raging Onslaught", 1, "atk"), c("Raging Onslaught", 2, "atk2"),
                               c("Raging Onslaught", 3, "f1"), c("Raging Onslaught", 3, "f2")], ap: 2},
                       {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  assert.match(String(J.legal(n, {t: "play", uid: "atk2", from: "hand"}, 0)), /instant-speed window/,
    "a second attack was allowed on top of the first — action speed needs an empty stack");
  assert.match(J.legal(n, {t: "endTurn"}, 0), /on the stack/,
    "the turn could be ended over a card that had not resolved");
  assert.equal(J.legal(n, {t: "pass"}, 0), null, "passing is always the way out");
});

/* ---- 4. WHEN NOBODY CAN ANSWER ----------------------------------------------- */

test("a window NOBODY can use resolves at once — and 'can use' includes paying for it", {skip}, () => {
  /* The defender's only card is the instant itself: nothing to pitch for
     it and nothing floating, so `legal` refuses it and the play goes
     straight through. Asking the HAND instead of `legal` would open a
     window here that only a pass can close. */
  const g = table({hand: [c("Raging Onslaught", 1, "atk")]},
                  {hand: [c("Oasis Respite", 1, "oas")], res: 0});
  const n = play(g, "atk");
  assert.equal(held(n), undefined, "an unanswerable play waited anyway");
  assert.equal(n.step, "attack", "…and the attack did not reach the chain");
  /* with the resource to pay for it, the same hand opens the window */
  assert.ok(held(play({...g, sides: [g.sides[0], {...g.sides[1], res: 1}]}, "atk")),
    "an affordable answer did not open a window");
});

/* ---- 5. THE POLICY AND THE WIRE ------------------------------------------------ */

/* NOT A GUARD IN THE POLICY — ITS STRUCTURE. `sparring.act` proposes only
   at ACTION speed and in the REACTION step, and a waiting card leaves both
   seats an instant-speed window in neither, so it passes. Answering a card
   before it resolves is a timing judgement v4.24 says it does not make; a
   policy that grows an instant-speed branch must fail here first. */
test("the policy PASSES on a waiting card rather than answering it", {skip}, () => {
  let n = play(table({hand: [c("Raging Onslaught", 1, "atk")]},
                     {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  assert.deepEqual(SP.act(n, 0), {t: "pass"});
  n = J.reduce(n, {t: "pass"}, 0).state;
  assert.deepEqual(SP.act(n, 1), {t: "pass"},
    "the policy answered at instant speed — a timing judgement it does not make (v4.24)");
});

test("a waiting card survives the wire, and a round trip does not move the fingerprint", {skip}, () => {
  const n = play(table({hand: [c("Raging Onslaught", 1, "atk")]},
                       {hand: [c("Oasis Respite", 1, "oas")]}), "atk");
  const back = W.decode(W.encode(n));
  assert.equal(held(back).card.uid, "atk");
  assert.equal(W.hash(back), W.hash(n));
});
