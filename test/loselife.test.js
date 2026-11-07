/* ============================================================
   LIFE LOSS IS NOT DAMAGE (S-4, QA-A, v5.85).

   Searing Shot: "When this hits a hero, they lose 1{h}." Arakni, Tarantula:
   "Whenever a dagger you own hits a hero, they lose 1{h}". Both parsed as
   `dmg`, ran through `preventDamage`, and the feed said "1 damage".
   CR 8.5.12a (verbatim, rules.fabtcg.com): "If a living-card lose {h}, its
   life total is decreased by the specified amount." CR 8.5.12b: "Losing life
   is not considered as damage being dealt, unless it is the result of a
   damage effect.[8.5.3] Losing life is not considered as a hit, unless it is
   the result of damage being dealt by an attack during the damage step of
   combat.[7.5.5]"
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

test("the clause reads as life loss, not damage", () => {
  assert.deepEqual(P.classifyClause("they lose 1{h}").ops, [["loseLife", 1]]);
  assert.deepEqual(P.classifyClause("target hero loses 2{h}").ops, [["loseLife", 2]]);
});

test("DRIVEN: a waiting prevention shield does not touch life loss", () => {
  const shield = [{n: 3, src: "Shield probe", ops: []}];
  const g = H.state({}, {hp: 20, wardNext: shield}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = H.runOps(g, [["loseLife", 1]], "Searing Shot");
  assert.equal(out.sides[1].hp, 19, "CR 8.5.12b: the life total drops by 1");
  assert.deepEqual(out.sides[1].wardNext, shield, "…and the shield is still waiting, unspent");
  /* the control: the same shield DOES stop damage */
  const dmg = H.runOps(g, [["dmg", 1]], "Probe");
  assert.equal(dmg.sides[1].hp, 20, "damage is prevented by the same shield");
});

test("DRIVEN: Searing Shot's on-hit is the loseLife op", {skip}, () => {
  H.db();
  const c = H.card("Searing Shot", 1);
  const fx = P.fxParse(c);
  const all = JSON.stringify([fx.ops, fx.onHit, fx.onHitHero].filter(Boolean));
  assert.ok(/loseLife/.test(all), "the parse carries loseLife — got " + all);
  assert.ok(!/"dmg"/.test(all), "and no dmg");
});
