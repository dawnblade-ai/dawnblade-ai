/* ============================================================
   BRAIN FREEZE — a fused rider that reaches into the other seat's hand.

   "Ice Fusion / Target opponent reveals their hand. If this was fused,
    put an action card with cost 0 from their hand on top of their deck."

   `fused` was already a real condition and the reveal was already built;
   what was missing was the PAYLOAD, so the card sat at `part` with its
   whole point unread.

   THE FILTER IS THE INTERESTING PART, and it is where the pool lays a
   trap. "An action card" read off `tt` — the printed display string —
   also matches Den of the Spider and Lair of the Spider, which `tt` calls
   "Assassin / Warrior Action Defense Reaction" and the STRUCTURED array
   calls Defense Reaction. Both are in this pool. A reaction is not an
   action, the array is the authority (RULING, user, 2026-08-02), and a
   `tt` read would offer either as a legal choice.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const Q = require("../engine/prompts.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

/* Three cards in the opponent's hand: one legal choice, one too costly,
   and the `tt`/`ty` trap — cost 0, and "Action" in its display string. */
const FOE_HAND = () => [
  {uid: "f1", name: "Zero Action",   cost: 0, pitch: 1, tt: "Generic Action", ty: ["Generic", "Action"]},
  {uid: "f2", name: "Costly Action", cost: 2, pitch: 1, tt: "Generic Action", ty: ["Generic", "Action"]},
  {uid: "f3", name: "Spider Trap",   cost: 0, pitch: 1,
   tt: "Assassin / Warrior Action Defense Reaction - Trap",
   ty: ["Assassin", "Warrior", "Defense Reaction", "Trap"]}];

function play(hand){
  H.db();
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand, deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", hand: FOE_HAND(), deck: [{uid: "d2", name: "Bottom"}]},
                  {actor: 0, turnPlayer: 0, seed: "bf"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
  return J.reduce(g, {t: "play", uid: "bf1", from: "hand"}, 0).state;
}
const answer = n => {
  n = J.reduce(n, {t: "promptSel", i: 0}, n.prompt.side).state;
  return J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
};

/* ---- THE READING ------------------------------------------------------- */

test("the rider reads as a FUSED-gated pick, and the card resolves in full", {skip}, () => {
  const bf = H.card("Brain Freeze", 3);
  P.fxReset();
  const fx = P.fxParse(bf);
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.conds.map(x => x.cond), ["fused"],
    "the payload hangs off the printed condition, not off the play");
  /* THE ZONE AND THE DESTINATION ARE PINNED, not just the filter. They are
     DATA on the op (v3.53 made `foePick` one body for every cross-seat
     pick) and the consumer ignored both for three versions — it moved
     hand -> deck top whatever it was told, which was right for this card
     and silently a no-op for the next one. Asserting the filter alone
     cannot tell a spec that says where from a spec that is obeyed. */
  const op = fx.conds[0].op;
  assert.equal(op[0], "foePick");
  assert.deepEqual(op[1].filter, {costLe: 0, costGe: 0, ty: "action"});
  assert.equal(op[1].zone, "hand", "it reaches into their HAND");
  assert.equal(op[1].to, "deckTop", "and puts the card on TOP of their deck");
  P.fxReset();
});

test("`with cost 0` is an EXACT cost, both bounds", {skip}, () => {
  /* Read as `costLe` alone it would also take a cost-1 card if one ever
     printed below it. The phrase says 0, so both bounds are set. */
  assert.deepEqual(P.optFilter("an action card with cost 0"),
    {costLe: 0, costGe: 0, ty: "action"});
  assert.deepEqual(P.optFilter("an attack action card with cost 1 or less"),
    {costLe: 1, type: "attack"}, "'or less' is still a different qualifier");
  assert.equal(P.optFilter("a card with cost 0"), null,
    "and a subject it cannot read is still refused, not flattened");
});

/* ---- THE TRAP ---------------------------------------------------------- */

test("'an action card' reads the STRUCTURED array — a defence reaction is not an action", {skip}, () => {
  const f = Q.promptFilter({ty: "action", costLe: 0, costGe: 0});
  const [zero, costly, trap] = FOE_HAND();
  assert.equal(f(zero), true);
  assert.equal(f(costly), false, "cost 2 is not cost 0");
  assert.equal(f(trap), false,
    "`tt` calls it an Action and the array calls it a Defense Reaction — the array wins");
  /* and the trap card would pass a naive tt read, or this proves nothing */
  assert.ok(/action/i.test(trap.tt), "the fixture must actually carry the trap");
});

/* ---- DRIVEN ------------------------------------------------------------ */

test("fused: the chosen card leaves their hand and becomes their next draw", {skip}, () => {
  const bf = {...H.card("Brain Freeze", 3), uid: "bf1"};
  const ice = {...H.card("Ice Bolt", 1), uid: "ice"};      /* an Ice card to reveal */
  let n = play([bf, ice]);
  assert.equal(n.prompt && n.prompt.tag, "pick", "fused, so the rider asks");
  assert.deepEqual(n.prompt.cards.map(c => c.name), ["Zero Action"],
    "only the legal choice is offered — the filter is the rule, not a hint");
  n = answer(n);
  assert.deepEqual(n.sides[1].hand.map(c => c.name), ["Costly Action", "Spider Trap"],
    "it left their hand");
  assert.equal(n.sides[1].deck[0].name, "Zero Action", "and is on TOP of their deck");
  assert.deepEqual(INV.errors(n), [], "one card, one zone");
});

test("not fused: the rider does not fire at all", {skip}, () => {
  const bf = {...H.card("Brain Freeze", 3), uid: "bf1"};
  const n = play([bf]);                                    /* nothing Ice to reveal */
  assert.ok(!n.prompt, "no fusion, no question");
  assert.deepEqual(n.sides[1].hand.map(c => c.name),
    ["Zero Action", "Costly Action", "Spider Trap"], "their hand is untouched");
  assert.equal(n.sides[1].deck[0].name, "Bottom", "and so is their deck");
});

test("nothing matching means nothing asked, and it is said", {skip}, () => {
  H.db();
  const bf = {...H.card("Brain Freeze", 3), uid: "bf1"};
  const ice = {...H.card("Ice Bolt", 1), uid: "ice"};
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand: [bf, ice], deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", hand: [FOE_HAND()[1]], deck: [{uid: "d2", name: "Bottom"}]},
                  {actor: 0, turnPlayer: 0, seed: "bf2"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
  const n = J.reduce(g, {t: "play", uid: "bf1", from: "hand"}, 0).state;
  assert.ok(!n.prompt, "an empty candidate list asks nothing rather than showing an empty sheet");
  assert.equal(n.sides[1].hand.length, 1, "and takes nothing");
});
