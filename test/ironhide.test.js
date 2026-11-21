/* ============================================================
   test/ironhide.test.js — "WHEN THE COMBAT CHAIN CLOSES, DESTROY THIS" (v6.47)

   Ironhide Gauntlet (Generic Equipment - Arms, Prism's deck): "When this defends,
   you may pay {r}. If you do, it gets +2{d} and \"When the combat chain closes,
   destroy this.\"" Until v6.47 an unanchored +N{d} reader matched the head and
   dropped the quoted rider, so a paid Ironhide kept its +2 AND survived: stronger
   than printed. The rider is Blade Break's meaning, so it rides as `breakAtClose`,
   the answer marks the named gear piece (`brk`), and `game.gearBlockApply` — the
   one body both boards call as a block resolves — destroys it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const G = require("../engine/game.js");
const H = require("./helpers/judged.js");
const J = H.J;
const skip = !H.hasDb() && "no cached card database";
const LINE = "it gets +2{d} and \"When the combat chain closes, destroy this.\"";

test("the reader: both halves, and the plain +N{d} still reads alone", () => {
  assert.deepEqual(P.classifyClause(LINE).ops, [["defBuff", 2], ["breakAtClose"]]);
  assert.deepEqual(P.classifyClause("it gets +2{d}").ops, [["defBuff", 2]],
    "the rider leaked into a bare +2{d}");
});

test("the shared wear: a marked piece is destroyed as the block resolves; unmarked, it is not", () => {
  const piece = {uid: 7, name: "Drill Arms", def: 1, kw: []};
  assert.equal(!!G.gearBlockApply(piece).destroyed, false, "an unmarked keywordless piece broke");
  assert.equal(G.gearBlockApply({...piece, brk: true}).destroyed, true, "the mark did not break it");
});

function wallSheet(gear){
  H.db(); P.fxReset();
  const atk = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 2102});
  const g0 = H.state({res: 9, ap: 1},
    {hp: 20, res: 5, hand: [], gear: [gear], blockH: [], blockG: [0], deck: [{uid: 2110, name: "F"}]},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: [], _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  return J.withEffects(g, (fx, s) => ({game: fx.afterDefenders(s, [], [gear])})).game;
}

test("AT THE TABLE: paying marks THIS piece, and the block destroys it", {skip}, () => {
  const ih = Object.assign({}, H.card("Ironhide Gauntlet", 0), {uid: 2201});
  let n = wallSheet(ih);
  assert.ok(n.prompt && n.prompt.defUid === 2201, "the pay sheet opens off the gear wall, naming the piece");
  n = J.reduce(n, {t: "promptChoose", choice: "pay"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  const piece = n.sides[1].gear.find(x => x.uid === 2201);
  assert.equal(piece.brk, true, "the rider did not mark the piece");
  assert.deepEqual(n.sides[1].defMod, [{uid: 2201, d: 2}], "the +2{d} still lands");
  assert.equal(G.gearBlockApply(piece).destroyed, true, "and the block destroys it");
});

test("AT THE TABLE: declining leaves the piece whole", {skip}, () => {
  const ih = Object.assign({}, H.card("Ironhide Gauntlet", 0), {uid: 2202});
  let n = wallSheet(ih);
  n = J.reduce(n, {t: "promptDecline"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  const piece = n.sides[1].gear.find(x => x.uid === 2202);
  assert.ok(!piece.brk, "a declined rider marked the piece");
  assert.ok(!G.gearBlockApply(piece).destroyed, "a declined Ironhide broke");
});
