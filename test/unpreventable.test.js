/* ============================================================
   "DAMAGE THAT WOULD BE DEALT BY THIS CAN'T BE PREVENTED" (v5.26)
   — MURKMIRE GRAPNEL x3, Azalea's

   QUEUE item 12 [N7], re-verified: the clause was an op setting
   `n._unpreventable`, which nothing read, and an attack's ops ride to
   RESOLUTION (v4.08), after the damage. So a ward or a one-event shield
   stopped the arrow against its printed text. A card fact now
   (`fx.unpreventable`), read where the attack's damage meets
   `preventDamage`, on both boards.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const blk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

test("the parse: a card fact, and no op", {skip}, () => {
  P.fxReset();
  for(const p of [1, 2, 3]){
    const fx = P.fxParse(H.card("Murkmire Grapnel", p));
    assert.equal(fx.unpreventable, true, "pitch " + p);
    assert.ok(!fx.ops.some(o => o[0] === "unpreventable"), "no op rides to resolution");
  }
  assert.ok(!P.fxParse(blk("Plain", "x")).unpreventable, "a card that does not print it");
});

test("CENSUS: Murkmire Grapnel is the pool's only record printing it", () => {
  const pool = require("../data/pool.json");
  const recs = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const hits = recs.filter(r => /can'?t be prevented/i.test(r.functional_text || ""));
  assert.deepEqual([...new Set(hits.map(r => r.name))], ["Murkmire Grapnel"]);
});

/* THE TABLE: seat 0 fires the arrow from arsenal, nobody blocks. */
function table(atk, foe){
  let g = {...H.state({res: 9, ap: 1, arsenal: atk, deck: [blk("Top", "t0")]},
                      Object.assign({hand: [], hp: 20, deck: [blk("Deck", "d1")]}, foe),
                      {turn: 3, actor: 0}),
           phase: "action", step: "layer", priority: 0, passed: [], turnPlayer: 0,
           firstPlayer: 0, round: 1, over: null};
  const o = J.reduce(g, {t: "play", uid: atk.uid, from: "arsenal"}, 0);
  assert.equal(o.error, null, o.error);
  g = H.answerAll(H.drain(o.state));
  for(let i = 0; i < 20 && g.step !== "resolution" && g.step !== "close" && g.phase === "action"; i++){
    const r = J.reduce(g, {t: "pass"}, g.priority);
    if(r.error) break; g = H.answerAll(r.state);
  }
  return g;
}
const shield = n => ({n, src: "Cloud Cover"});

test("TABLE: a ward pool does not stop it, and is not spent", {skip}, () => {
  const g = table(Object.assign(H.card("Murkmire Grapnel", 1), {uid: "mg"}), {ward: 9});
  const pow = H.card("Murkmire Grapnel", 1).power;
  assert.equal(g.sides[1].hp, 20 - pow, "every point landed");
  assert.equal(g.sides[1].ward, 9, "and the pool is still there for something else");
});

test("TABLE: …while the same ward stops an ordinary arrow (positive control)", {skip}, () => {
  /* A clear that never runs passes the row above's spend half and fails
     nothing else; this is what proves the ward is live in the fixture. */
  const g = table(Object.assign({}, H.card("Murkmire Grapnel", 1),
                  {uid: "mg2", name: "Grapnel Probe", tx: "", kw: []}), {ward: 9});
  assert.equal(g.sides[1].hp, 20, "prevented in full");
});

test("TABLE: a one-event shield does not stop it either, and keeps waiting", {skip}, () => {
  const g = table(Object.assign(H.card("Murkmire Grapnel", 2), {uid: "mg3"}),
                  {wardNext: [shield(5)]});
  assert.equal(g.sides[1].hp, 20 - H.card("Murkmire Grapnel", 2).power);
  assert.equal((g.sides[1].wardNext || []).length, 1);
});

test("TRAINER: the same answer in `resolveStack`", {skip}, () => {
  H.db();
  const atk = Object.assign(H.card("Murkmire Grapnel", 3), {uid: 900});
  const g = H.state({hand: [atk], res: 9, ap: 1}, {hp: 20, ward: 9},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  const out = J.withEffects(n, (fx, st) => fx.resolveStack(st));
  assert.equal(out.sides[1].hp, 20 - atk.power);
  assert.equal(out.sides[1].ward, 9);
});
