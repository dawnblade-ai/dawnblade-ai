/* ============================================================
   arcrank.test.js — THE BIGGEST PRINTED ARCANE FIRST (v5.39)

   QUEUE v4 H5. With no attack to make, `sparring.offence` played its
   non-attacks cheapest first, so Iyslander spent her one action point on
   a 1-arcane Frosting while a 5-arcane Ice Bolt was legal in the same
   hand (79 of her 153 point-spending plays had a higher-arcane option).
   The rank is now the card's unconditional printed arcane, asked through
   `judge.arcaneOf` so `sparring.js` still reads no card text; ties fall
   back to the cheapest, then pitch, then uid.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
let _uid = 97000;
const card = (n, p) => { const c = H.card(n, p); c.uid = ++_uid; return c; };

function seat0(o){
  H.db();
  let g = H.state(Object.assign({res: 9, ap: 1, hand: []}, o), {hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  g.turnPlayer = 0; g.phase = "action"; g.step = "layer"; g.priority = 0;
  return g;
}

/* ---- 1. THE READER ------------------------------------------------------- */

test("arcaneOf answers the printed arcane of a card in that zone", {skip}, () => {
  const bolt = card("Ice Bolt", 1), frost = card("Frosting", 3);
  const g = seat0({hand: [bolt, frost]});
  assert.equal(J.arcaneOf(g, 0, bolt.uid, "hand"), 5);
  assert.equal(J.arcaneOf(g, 0, frost.uid, "hand"), 1);
});

test("arcaneOf counts the UNCONDITIONAL arcane only, never a gated 'instead'", {skip}, () => {
  /* Emeritus Scolding prints 4, and 6 "instead" on an opponent's turn. */
  const em = card("Emeritus Scolding", 1);
  assert.equal(J.arcaneOf(seat0({hand: [em]}), 0, em.uid, "hand"), 4);
});

test("arcaneOf answers 0 for a card that prints none, and for a card not in that zone", {skip}, () => {
  const big = card("Brutal Assault", 1), bolt = card("Ice Bolt", 1);
  const g = seat0({hand: [big], arsenal: bolt});
  assert.equal(J.arcaneOf(g, 0, big.uid, "hand"), 0, "prints no arcane");
  assert.equal(J.arcaneOf(g, 0, bolt.uid, "hand"), 0, "it is in the arsenal, not the hand");
  assert.equal(J.arcaneOf(g, 0, bolt.uid, "arsenal"), 5, "control: asked of its own zone");
});

/* ---- 2. THE POLICY ----------------------------------------------------------- */

test("the bigger printed arcane is played before the cheaper one", {skip}, () => {
  const frost = card("Frosting", 3), bolt = card("Ice Bolt", 1);
  const a = SP.act(seat0({hand: [frost, bolt]}), 0);
  assert.equal(a && a.uid, bolt.uid, "5-arcane Ice Bolt (cost 2) before 1-arcane Frosting (cost 0)");
});

test("an arcane tie falls back to the cheaper card", {skip}, () => {
  /* Aether Icevein and Ice Bolt(1) both print 5 and are both pitch 1, so
     ONLY the cost key separates them: dropped, the next keys (pitch, then
     uid) pick Icevein, because Ice Bolt is given the higher uid. A fixture
     where the cheaper card is also the lower pitch cannot see the cost key
     at all, which is how the first draft of this drill passed with it gone. */
  const ice = card("Aether Icevein", 1), bolt = card("Ice Bolt", 1);
  assert.ok(String(ice.uid) < String(bolt.uid) && ice.pitch === bolt.pitch, "fixture");
  const a = SP.act(seat0({hand: [ice, bolt]}), 0);
  assert.equal(a && a.uid, bolt.uid, "cost 2 before cost 3 at equal arcane");
});
