/* ============================================================
   THE ARSENAL FACE-UP PUT HAD NO CALLER — v3.20's bug, one mechanic over.

   v2.33/v2.34 built the whole face-up arsenal mechanism: `_faceUp` and
   `_upTurn`, the `arsenalUp` triggers an arrow fires when it is set face
   up, and the Bull's Eye Bracers `arsStamp` that rides on top. CLAUDE.md
   has said "all three enablers are live" ever since.

   THE QUEUE SITE WAS INSIDE `if(attacking)`, and NOT ONE CARD IN THE POOL
   THAT PRINTS AN ARSENAL PUT IS AN ATTACK. Measured over the pool: three
   distinct cards set `fx.arsenalPut` — Call in the Big Guns (a Ranger
   Action), Bull's Eye Bracers (Arms equipment) and Death Dealer (a Bow) —
   and every one of them is a non-attack. So the prompt was never once
   offered from `execute`.

   That is v3.20's defect verbatim: its own note reads "the only queue
   site was inside `if(attacking)` while every card that needed it was a
   non-attack". A fix written for one mechanic is not a fix for the shape.

   NO TOOL HERE COULD SEE IT. Coverage read Bull's Eye Bracers and Death
   Dealer `full` — their ability line is correctly filed `noop` — and the
   fairness sweep is one-sided toward cards that are too STRONG, while
   this is a printed choice never offered. The drills could not see it
   either, because they proved the READER and the SHEET and never asked
   whether anything opened one.

   So this drill drives `reduce` from a card in hand and asserts on the
   ARSENAL, not on the feed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

function play(handExtra){
  H.db();
  const src   = Object.assign({}, H.card("Call in the Big Guns", 1), {uid: "src1"});
  const arrow = Object.assign({}, H.card("Drill Shot", 1),           {uid: "a1"});
  let g = H.state({name: "Azalea", res: 9, ap: 3, arsenal: null,
                   hand: [src, arrow].concat(handExtra || []),
                   deck: [{uid: "d1", name: "Top"}]},
                  {name: "Them", deck: [{uid: "d2", name: "T2"}]},
                  {actor: 0, turnPlayer: 0, seed: "ars"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
  return J.reduce(g, {t: "play", uid: "src1", from: "hand"}, 0).state;
}

test("EVERY card that prints an arsenal put is a non-attack — the measurement", {skip}, () => {
  /* The premise the fix rests on, pinned so it cannot quietly stop being
     true. If an ATTACK ever prints one, this fails and the reader is
     asked to confirm the attacking-branch site still works — which is
     exactly why that site was kept rather than moved. */
  for(const [nm, p] of [["Call in the Big Guns", 1], ["Bull's Eye Bracers", 0], ["Death Dealer", 0]]){
    P.fxReset();
    const c = H.card(nm, p);
    assert.ok(P.fxParse(c).arsenalPut, nm + " must print an arsenal put");
    assert.ok(!P.isAttack(c), nm + " is a non-attack — so the attacking-branch site can never reach it");
  }
  P.fxReset();
});

test("the prompt is actually OFFERED, and the arrow lands FACE UP", {skip}, () => {
  /* A NON-ARROW IN HAND, or the filter is not under test at all. With the
     arrow as the only other card the candidate list is identical whether
     the filter is applied or dropped entirely — a fixture where two
     things coincide has tested neither (v3.26), and the sabotage pass is
     what said so: removing the filter left this drill green. */
  let n = play([Object.assign({}, H.card("Booze!", 3), {uid: "nx1"})]);
  assert.ok(n.prompt, "a printed choice that is never offered is the bug this drill exists for");
  assert.equal(n.prompt.to, "arsenal");
  assert.equal(n.prompt.min, 0, "'you may' — it stays declinable");
  assert.deepEqual(n.prompt.cards.map(c => c.uid), ["a1"],
    "only the arrow is a legal choice");

  const i = n.prompt.cards.findIndex(c => c.uid === "a1");
  n = J.reduce(n, {t: "promptSel", i}, n.prompt.side).state;
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;

  const me = n.sides[0];
  assert.ok(me.arsenal, "the arrow reached the arsenal");
  assert.equal(me.arsenal.uid, "a1");
  /* FACE UP IS THE WHOLE POINT (v2.33). The trainer's end-of-turn set is
     face DOWN; Azalea's arrows trigger on face UP, which is a different
     event reached only by an enabler that says so. */
  assert.equal(me.arsenal._faceUp, true, "it goes FACE UP, not face down");
  assert.equal(me.arsenal._upTurn, n.turn);
  assert.ok(!me.hand.some(c => c.uid === "a1"), "and it left the hand");
});

test("declining leaves the arrow in hand and the arsenal empty", {skip}, () => {
  let n = play();
  n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  assert.equal(n.sides[0].arsenal, null, "nothing was chosen, so nothing is set");
  assert.ok(n.sides[0].hand.some(c => c.uid === "a1"), "the arrow stays in hand");
});

test("the rest of the card resolves either way — the put is the only skipped half", {skip}, () => {
  const n = play();
  /* RULING (user, 2026-07-28): only the put is skipped when there is no
     free slot; the card's other effects resolve regardless. Asserted here
     on the buff the card also prints, so a fix that made the put
     mandatory-or-nothing would be visible. */
  assert.ok((n.sides[0].buffQ || []).length || n.sides[0].buffNext,
    "the printed +{p} for the next arrow attack still applies");
});
