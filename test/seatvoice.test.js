/* ============================================================
   THE ENGINE NAMES THE SEAT, NEVER "YOU" (v5.33, QUEUE v3 S3+S4)

   The feed is read by BOTH seats (v2.83), so a line in the second person
   is addressed to whoever happens to be reading it. Seat 0 is literally
   named "You", which is what hid these: in the trainer they read fine,
   and at a table they told the opponent it was behind on life.

   Driven, not scanned: every condition the pool emits is put to `condWhy`
   with a NAMED actor, and no phrase may say you/your. A seat genuinely
   called "You" must still agree ("You are", "You have"), and the hero
   ability line names the ability off the hero card.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const J = require("../engine/judge");
const G = require("../engine/game");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

function poolConds(){
  const conds = new Set(), seen = new Set();
  const walk = (o, d) => {
    if(!o || typeof o !== "object" || d > 8) return;
    if(Array.isArray(o)){ o.forEach(x => walk(x, d + 1)); return; }
    if(typeof o.cond === "string") conds.add(o.cond);
    for(const k in o) walk(o[k], d + 1);
  };
  for(const r of require("../data/pool.json")) for(const p of [0, 1, 2, 3]){
    let c; try { c = H.card(r.name, p); } catch(e){ continue; }
    if(!c || !c.name || seen.has(c.name + "|" + c.pitch)) continue;
    seen.add(c.name + "|" + c.pitch);
    walk(P.fxParse(c), 0);
  }
  return conds;
}

test("EVERY condWhy PHRASE names the seat: no you/your for a named actor", {skip}, () => {
  H.db();
  const conds = poolConds();
  assert.ok(conds.size > 40, "the walk found " + conds.size + " conditions — it is aimed wrong");
  const bad = [];
  J.withEffects(H.state({name: "Alice"}, {name: "Bob"}), (fx, n) => {
    for(const c of conds) for(const atHit of [false, true]){
      const w = String(fx.condWhy(n, c, [], atHit));
      if(/\byour?\b/i.test(w)) bad.push(c + (atHit ? " @hit" : "") + " -> " + w);
    }
    return n;
  });
  assert.deepEqual(bad, [], "a second-person phrase would reach a feed both seats read");
});

test("A SEAT NAMED 'You' still agrees: 'You are', 'You have'", {skip}, () => {
  H.db();
  J.withEffects(H.state({name: "You", hp: 20}, {name: "Bob", hp: 10}), (fx, n) => {
    assert.equal(fx.condWhy(n, "lifeLt", [], false), "You are not behind on life");
    return n;
  });
  J.withEffects(H.state({name: "Alice", hp: 20}, {name: "Bob", hp: 10}), (fx, n) => {
    assert.equal(fx.condWhy(n, "lifeLt", [], false), "Alice is not behind on life");
    return n;
  });
  assert.equal(G.sv({name: "You"}, "are"), "You are");
  assert.equal(G.sv({name: "Alice"}, "are"), "Alice is");
});

test("A NAMED-CARD BUFF keeps the printed capitalisation of the name", () => {
  P.fxReset();
  const r = P.classifyClause("The next Crouching Tiger you play this turn gets +1{p}");
  assert.ok(r && r.status === "run", "the clause reads");
  assert.deepEqual(r.ops[0], ["namedBuff", "Crouching Tiger", 1]);
});
