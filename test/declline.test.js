/* ============================================================
   ONE DECLARATION LINE, AND A WALL NAMED WHEN IT WAS RAISED (v5.34)

   QUEUE v3 S5: every attack at the table printed its declaration twice.
   `execute` says "<seat> plays <card> — N power on the chain" (with the
   printed power and go again beside it), and judge's `declareAttack` then
   said "<seat> attacks with <card> for N." about the same number.

   QUEUE v3 S6: `strike` gated the wall line on the wall's TOTAL, so a
   block whose pieces were worth 0 printed nothing, and the player could
   not tell a block that stopped 0 from no block at all.

   Both drills read the FEED, deliberately: the state is identical either
   way, and the observable is what the shared feed says (v3.60's exception).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const blk = (nm, uid, def) => ({name: nm, uid, pitch: 1, cost: 0, power: 3, def,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const atkCard = () => ({name: "Plain Swing Fixture", uid: "A", pitch: 1, cost: 0, power: 5, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});
const feedOf = g => (g.feed || g.log || []);

function swing(walls){
  let g = {...H.state({res: 9, ap: 1, hand: [atkCard()], deck: [blk("Top", "t0", 2)]},
                      {hand: walls, hp: 20, deck: [blk("Deck", "d1", 2)]}, {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, JSON.stringify(a) + ": " + o.error); g = o.state; };
  go({t: "play", uid: "A", from: "hand"}, 0);
  g = H.answerAll(H.drain(g));
  for(let i = 0; i < 10 && g.step !== "defend"; i++) go({t: "pass"}, g.priority);
  for(const w of walls) go({t: "defend", uid: w.uid}, 1);
  for(let i = 0; i < 12 && g.step !== "resolution" && g.step !== "close"; i++){
    const o = J.reduce(g, {t: "pass"}, g.priority);
    if(o.error) break; g = H.answerAll(o.state);
  }
  return g;
}

test("an attack at the table prints ONE declaration line, carrying the power", {skip}, () => {
  H.db(); P.fxReset();
  const f = feedOf(swing([]));
  const decl = f.filter(l => /Plain Swing Fixture/.test(l) && /power on the chain/.test(l));
  assert.equal(decl.length, 1, "the declaration with its power is printed exactly once");
  assert.ok(/— 5 power on the chain/.test(decl[0]), decl[0]);
  assert.ok(!f.some(l => /(?:attacks? with|swings?) Plain Swing Fixture for \d+/.test(l)),
    "a second 'attacks with … for N' line repeats the declaration");
  P.fxReset();
});

test("a wall worth 0 is still named; no wall is not", {skip}, () => {
  H.db(); P.fxReset();
  const zero = feedOf(swing([blk("Paper Wall", "w0", 0)])).join("\n");
  assert.ok(/Wall of 0 — Paper Wall 0 — stops 0\./.test(zero), "a declared wall worth 0 says nothing");
  const none = feedOf(swing([])).join("\n");
  assert.ok(!/Wall of/.test(none), "control: no defender, no wall line");
  const real = feedOf(swing([blk("Brick Wall", "w2", 2)])).join("\n");
  assert.ok(/Wall of 2 — Brick Wall 2 — stops 2\./.test(real), "control: a wall that stops something");
  P.fxReset();
});
