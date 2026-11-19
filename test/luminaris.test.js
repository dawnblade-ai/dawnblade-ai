/* ============================================================
   test/luminaris.test.js — LUMINARIS, CELESTIAL FURY (v6.47, Prism reader 7)

   Staged, Prism's weapon: "Once per Turn Instant - {r}{r}: Target angel attack or attack
   action card with Herald in its name gets go again."

   The target is an OR-GROUP OF WHOLE QUALIFIERS (`{any: [...]}`): "angel attack" is one
   alternative, "attack action card with Herald in its name" the other, each with its own
   tail. Driven at the table: the ability on a Herald keeps the action point; on a plain
   attack it is refused. Asserted on legality, resources and action points.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (name, p, uid) => ({...C.resolveEntry(STAGED, {name, p: p || 0, code: null, q: 1}), uid});
const plain = uid => ({uid, name: "Plain " + uid, def: 2, power: 3, pitch: 1, cost: 0,
                       tt: "Light Illusionist Action - Attack", ty: ["Light", "Illusionist", "Action", "Attack"], tx: ""});
const passTo = (n, done) => {
  for(let i = 0; i < 30 && !done(n); i++){
    if(n.prompt){ const m = H.move(n); if(m === n) break; n = m; continue; }
    let moved = false;
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; moved = true; break; } }
    if(!moved) break;
  }
  return n;
};
const idle = s => s.phase === "action" && s.step === "layer" && !s.pend && !(s.stack || []).length && !s.prompt;

function swingWithLuminaris(atk){
  const lu = staged("Luminaris, Celestial Fury", 0, "lu1"); B.equipPiece(lu);
  let g = H.state({name: "You", res: 9, ap: 1, hand: [atk], gear: [lu]}, {name: "Them", hand: []},
                  {actor: 0, turnPlayer: 0, seed: "luminaris"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, 0).state;
  n = passTo(n, s => s.step === "reaction" && s.priority === 0);
  assert.equal(n.step, "reaction", "fixture: the reaction step never opened");
  const A = {t: "activate", uid: "gplu1"};
  const why = J.legal(n, A, 0);
  if(why) return {why};
  const res0 = n.sides[0].res;
  n = J.reduce(n, A, 0).state;
  const paid = res0 - n.sides[0].res;
  n = passTo(n, idle);
  return {n, paid};
}

test("the reader: the or-group reads both alternatives whole, and matches either", {skip}, () => {
  const r = P.classifyClause("Target angel attack or attack action card with Herald in its name gets go again.");
  const q = r && r.ops[0][2];
  assert.deepEqual(q, {any: [{g: [["angel"]]}, {aac: true, named: "herald"}]});
  assert.ok(P.qualMatches(q, {name: "Herald of Triumph", tt: "Light Illusionist Action - Attack", ty: ["Light", "Illusionist", "Action", "Attack"]}));
  assert.ok(P.qualMatches(q, {name: "Suraya", tt: "Light Illusionist Ally - Angel", ty: ["Light", "Illusionist", "Ally", "Angel"]}, {atk: true}));
  assert.equal(P.qualMatches(q, {name: "Plain", tt: "Light Illusionist Action - Attack", ty: ["Light", "Illusionist", "Action", "Attack"]}), false);
  /* an alternative that cannot be read refuses the clause */
  assert.equal(P.classifyClause("Target angel attack or attack action card with cost 9 banana gets go again."), null);
  P.fxReset();
  const lu = staged("Luminaris, Celestial Fury"); B.equipPiece(lu);
  assert.ok(lu.powCard, "Luminaris' ability did not build");
});

test("DRIVEN: on a Herald the ability costs {r}{r} and the action point is kept", {skip}, () => {
  const out = swingWithLuminaris(staged("Herald of Triumph", 3, "ht1"));
  assert.equal(out.why, undefined, "the table refused Luminaris on a Herald: " + out.why);
  assert.equal(out.paid, 2, "the ability did not cost {r}{r}");
  assert.equal(out.n.sides[0].ap, 1, "the Herald did not get go again");
});

test("on an attack that is neither an angel attack nor a Herald the ability is refused", {skip}, () => {
  const out = swingWithLuminaris(plain("p1"));
  assert.ok(out.why, "Luminaris granted go again to a plain Illusionist attack");
});
