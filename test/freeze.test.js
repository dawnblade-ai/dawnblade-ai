/* ============================================================
   FREEZE — Cold Snap, and the seats it is easy to invert.

   RULING 2026-07-25: "this gives the opponent a pop up that allows them
   to pay 1 resource to avoid the negative effect of the card. if they
   don't pay the player gets a pop up and they can choose the arsenal or
   an ally - whatever they choose cannot be played or activated until the
   start of your next turn."

   Until v3.02 both printed halves were filed `noop` with reasons about a
   training prop that stopped existing in v2.71 ("the dummy pays no
   costs"), so Iyslander's signature card reported `tier: full` while
   doing nothing at all — the no-op blind spot, third time this cycle.

   TWO SEATS, AND THEY ARE NOT THE SAME ONE. `payOr`'s `elseOps` resolve
   at the side that was ASKED, so inside the freeze the actor is the
   DECLINING hero: the objects to freeze are theirs, and the choice
   belongs to the other seat. Written the other way round it read the
   caster's own board and reported "Iyslander has nothing to freeze".
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (nm, p) => C.resolveEntry(H.db(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});

/* Iyslander with Cold Snap in hand; the opponent holding an arsenal card
   and whatever resources the case needs. */
function table(oppRes){
  H.db();
  const cs = {...card("Cold Snap", 3), uid: "cs1"};
  const ars = {...card("Ice Bolt", 1), uid: "ar1"};
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand: [cs], deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", res: oppRes, arsenal: ars, deck: [{uid: "d2", name: "F2"}]},
                  {actor: 0, turnPlayer: 0, seed: "cold"});
  return {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
}
const answer = (n, choice) => {
  const side = n.prompt.side;
  if(choice != null) n = J.reduce(n, {t: "promptChoose", choice}, side).state;
  return J.reduce(n, {t: "promptConfirm"}, side).state;
};

/* ---- THE OFFER --------------------------------------------------------- */

test("the pay offer is addressed to the OPPONENT, not the caster", {skip}, () => {
  const n = J.reduce(table(0), {t: "play", uid: "cs1", from: "hand"}, 0).state;
  assert.equal(n.prompt.tag, "pay");
  assert.equal(n.prompt.side, 1, "the ruling has the OPPONENT choosing whether to pay");
  assert.equal(n.prompt.cost, 1);
});

test("paying it off means no freeze at all", {skip}, () => {
  let n = J.reduce(table(3), {t: "play", uid: "cs1", from: "hand"}, 0).state;
  n = answer(n, "pay");
  assert.equal(n.sides[1].res, 2, "they paid 1 of their 3");
  assert.equal(n.prompt, null, "and nothing else is asked — the freeze never happens");
  assert.equal(n.sides[1].arsenal._frozenBy, undefined, "their arsenal is untouched");
  assert.ok(P.playableFromZone(n.sides[1].arsenal, "arsenal", {}), "and still playable");
});

/* ---- THE FREEZE -------------------------------------------------------- */

test("declining hands the CHOICE to the caster, over the DECLINER's objects", {skip}, () => {
  let n = J.reduce(table(0), {t: "play", uid: "cs1", from: "hand"}, 0).state;
  n = answer(n, "decline");
  assert.equal(n.prompt.tag, "pick");
  assert.equal(n.prompt.side, 0, "the Cold Snap player chooses — the elseOps' actor is the OTHER seat");
  assert.deepEqual(n.prompt.cards.map(c => c.name), ["Ice Bolt"],
    "and the candidates are the DECLINER's objects, not the caster's");
});

test("a frozen card cannot be played, and the judge names the reason", {skip}, () => {
  let n = J.reduce(table(0), {t: "play", uid: "cs1", from: "hand"}, 0).state;
  n = answer(n, "decline");
  n = J.reduce(n, {t: "promptSel", i: 0}, 0).state;
  n = answer(n, null);

  const froze = n.sides[1].arsenal;
  assert.equal(froze._frozenBy, 0, "the mark records WHOSE freeze it is — the thaw reads it back");
  assert.equal(P.playableFromZone(froze, "arsenal", {}), false);
  const why = J.legal({...n, turnPlayer: 1, priority: 1, phase: "action", step: "layer"},
                      {t: "play", uid: "ar1", from: "arsenal"}, 1);
  assert.match(String(why), /cannot be played from your arsenal/);
  assert.deepEqual(INV.errors(n), [], "and freezing a card leaves the board legal");
});

/* ---- THE THAW ---------------------------------------------------------- */

test("it lifts at the start of the FREEZING player's turn, and nobody else's", {skip}, () => {
  let n = J.reduce(table(0), {t: "play", uid: "cs1", from: "hand"}, 0).state;
  n = answer(n, "decline");
  n = J.reduce(n, {t: "promptSel", i: 0}, 0).state;
  n = answer(n, null);
  assert.equal(n.sides[1].arsenal._frozenBy, 0, "frozen before we start — or this proves nothing");

  /* THE WRONG SEAT'S TURN DOES NOT LIFT IT. Without this the drill passes
     on an engine that thaws on any turn boundary, which is a freeze that
     lasts no time at all. */
  assert.deepEqual(E.thawFreeze(n, 1).thawed, [], "their own turn does not free it");
  const th = E.thawFreeze(n, 0);
  assert.deepEqual(th.thawed, ["Ice Bolt"]);
  assert.equal(th.game.sides[1].arsenal._frozenBy, undefined, "the mark is gone");
  assert.ok(P.playableFromZone(th.game.sides[1].arsenal, "arsenal", {}), "and it is playable again");
});

test("nothing to freeze is said, not crashed", {skip}, () => {
  H.db();
  const cs = {...card("Cold Snap", 3), uid: "cs1"};
  let g = H.state({name: "Iyslander", res: 9, ap: 3, hand: [cs], deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", res: 0, deck: [{uid: "d2", name: "F2"}]},   /* no arsenal, no allies */
                  {actor: 0, turnPlayer: 0, seed: "cold2"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4};
  let n = J.reduce(g, {t: "play", uid: "cs1", from: "hand"}, 0).state;
  n = answer(n, "decline");
  assert.equal(n.prompt, null, "no sheet for a choice with no options");
  assert.deepEqual(INV.errors(n), []);
});
