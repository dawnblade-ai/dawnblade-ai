/* ============================================================
   THE POWER THE WALL WAS SUBTRACTED FROM (v5.31)

   `strike` totals the wall against what `linkPumps` returns, and that
   number was on no field. `pend.total` is the DECLARED power and
   `pend._struck` is stamped before the late conditions add theirs, so an
   equation `power - wall -> dealt` read off the link was wrong whenever a
   reaction or a late condition moved the swing (QUEUE v3 S1: 282 of 4,224
   hero strikes against `total`, 97 against `_struck`). `pend.power` is the
   number itself.

   > "If this is defended by fewer than 2 cards, it gets +3{p}."
   > — WIDOWMAKER, Azalea's

   Widowmaker pumped by an attack reaction and blocked by one card tells
   all three apart: declared 4, struck 5, power 8.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const blk = (nm, uid, def) => ({name: nm, uid, pitch: 1, cost: 0, power: 3, def,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const nudge = () => ({name: "Synthetic Nudge Power", uid: "N", pitch: 1, cost: 0, def: 2,
  tt: "Generic Attack Reaction", ty: ["Generic", "Attack Reaction"],
  tx: "Target attack gets +1{p}.", kw: [], gkw: []});

function strikeOf(walls, react){
  const atk = {...H.card("Widowmaker", 1), uid: "W"};
  let g = {...H.state({res: 9, ap: 1, arsenal: atk, hand: react ? [react] : [],
                       deck: [blk("Top", "t0", 2)]},
                      {hand: walls, hp: 20, deck: [blk("Deck", "d1", 2)]}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, JSON.stringify(a) + ": " + o.error); g = o.state; };
  go({t: "play", uid: "W", from: "arsenal"}, 0);
  g = H.answerAll(H.drain(g));
  for(let i = 0; i < 10 && g.step !== "defend"; i++) go({t: "pass"}, g.priority);
  for(const w of walls) go({t: "defend", uid: w.uid}, 1);
  for(let i = 0; i < 10 && g.step !== "reaction"; i++) go({t: "pass"}, g.priority);
  if(react){
    for(let i = 0; i < 4 && g.priority !== 0; i++) go({t: "pass"}, g.priority);
    go({t: "play", uid: react.uid, from: "hand"}, 0);
    g = H.answerAll(H.drain(g));
  }
  for(let i = 0; i < 12 && g.step !== "resolution" && g.step !== "close"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break; g = H.answerAll(o.state);
  }
  return g;
}

test("pend.power is the number the wall was subtracted from — not the declared or the struck power", {skip}, () => {
  H.db(); P.fxReset();
  const g = strikeOf([blk("Wall", "w1", 2)], nudge());
  const p = g.pend;
  assert.ok(p, "the link is still open after the damage step");
  assert.equal(p.total, 4, "fixture: declared at Widowmaker's printed 4");
  assert.equal(p._struck, 5, "fixture: the reaction's +1 is in the struck power");
  assert.equal(p.power, 8, "the reaction's +1 AND the late +3 (one defender) are in the power");
  assert.equal(p.wall, 2);
  assert.equal(p.dealt, p.power - p.wall, "power - wall -> dealt, with no prevention");
  assert.equal(g.sides[1].hp, 20 - p.dealt, "and the dealt damage is what the hero lost");
  P.fxReset();
});

test("…and with the late condition unmet (two defenders), power is declared + reaction only", {skip}, () => {
  H.db(); P.fxReset();
  const g = strikeOf([blk("Wall A", "w1", 1), blk("Wall B", "w2", 1)], nudge());
  assert.equal(g.pend.power, 5, "no +3 against two defenders");
  assert.equal(g.pend.dealt, 3, "5 - a wall of 2");
  P.fxReset();
});

test("a blocked-to-nothing swing still records the power it was struck at", {skip}, () => {
  H.db(); P.fxReset();
  const g = strikeOf([blk("Big A", "w1", 9)], null);
  assert.equal(g.pend.power, 7, "4 + the late +3 against one defender");
  assert.equal(g.pend.dealt, 0, "the wall stopped all of it");
  P.fxReset();
});
