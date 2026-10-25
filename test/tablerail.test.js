/* ======================================================================
   THE TABLE'S RAIL, AND A TILE THAT DECLARES (v5.44, QUEUE v4 S11)

   Two defects in the table's hand rail and gear tile, both reached only
   by a tap:

   1. THE TILE PREFERRED THE ABILITY OVER DEFEND. `cellAct` tried the swing,
      then the ability, then the declaration, so a piece with an instant
      ability legal in the defend step answered a tap meant to BLOCK by
      activating instead. Measured below: Fai's Pouncing Paws and Tearing
      Shuko are both legal to defend AND to activate in the defend step
      with Fai holding priority. While `defend` is legal the tile declares
      now; the ability is on the rail.

   2. THE RAIL HAD THE HAND AND THE ARSENAL ONLY. The trainer's
      `playables()` adds each weapon swing, each equipment ability, the
      hero power and the cards playable from the graveyard or banish. The
      table had no route at all from the graveyard or banish (Gravy Bones
      could not replay a watery-grave ally here). `railPlays` is that list
      as ACTIONS, lit by `judge.legal`, and a graveyard or banish card is
      offered only when legal so a thirty-card graveyard cannot flood it.

   The React component cannot be loaded in Node, so the board is read as
   SOURCE (comments stripped) and the premises it rests on are DRIVEN.
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;

const RAW = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
const SRC = strip(RAW);
const TB0 = SRC.indexOf("function TableBoard(");
const TB = SRC.slice(TB0, SRC.indexOf("\nfunction App(", TB0));
const skip = !H.hasDb() && "no cached card database";

/* The first branch of the gear tile's `cellAct` ternary. */
function tileFirst(src){
  const a = src.indexOf("const gearTile = (own)");
  if(a < 0) return null;
  const m = src.slice(a).match(/const cellAct\s*=\s*([^?]+)\?/);
  return m ? m[1].trim() : null;
}

test("the scan is alive: TableBoard is bounded and holds the gear tile", () => {
  assert.ok(TB0 > 0, "TableBoard moved — re-anchor");
  assert.ok(TB.length > 20000 && TB.length < 120000, "TableBoard slice width " + TB.length);
  assert.ok(TB.includes("const gearTile = (own)"), "the gear tile is inside the slice");
});

test("the gear tile's FIRST choice is the declaration", () => {
  assert.equal(tileFirst(TB), "mine(defend)",
    "while defend (or stop defending) is legal, the tile's tap must declare");
  /* control routed THROUGH the reader: the shipped-before order is refused */
  const old = "const gearTile = (own) => { const cellAct = mine(swing) ? swing : mine(defend) ? defend : null; }";
  assert.notEqual(tileFirst(old), "mine(defend)");
});

test("the rail offers every route the trainer's playables does, as legal-gated actions", () => {
  const a = TB.indexOf("const railPlays = () =>");
  assert.ok(a > 0, "railPlays is defined in TableBoard");
  const body = TB.slice(a, TB.indexOf("const railCell", a));
  assert.ok(body.length > 200 && body.length < 2500, "railPlays body width " + body.length);
  /* the WHOLE conditional, opening paren included: a scan for the push
     alone passes `if(… && false)` (v4.55) */
  assert.match(body, /if\(isWeapon\(gr\)\) out\.push\(\{card:gr, a:actAct\(gr\.uid\)/, "a weapon swing, with its attack-target");
  assert.match(body, /if\(gr\.pow && gr\.powCard\) out\.push\(\{card:gr\.powCard, a:\{t:"activate", uid:"gp"\+gr\.uid\}/,
    "each equipment ability, named by its powCard uid");
  assert.match(body, /if\(liveBuild\.HPOW\) out\.push\(\{card:liveBuild\.HPOW, a:\{t:"activate", from:"hero", uid:"hpow"\}/,
    "the hero power");
  assert.match(body, /\["grave",/, "the graveyard");
  assert.match(body, /\["banish",/, "banish");
  assert.match(body, /const a = playAct\(c, z\);\s*if\(mine\(a\)\) out\.push/,
    "a graveyard or banish card is offered only when judge.legal accepts it");
  assert.match(body, /if\(gr\.destroyed\) continue;/, "a destroyed piece offers nothing");
  const cell = TB.slice(TB.indexOf("const railCell"), TB.indexOf("const railCell") + 700);
  assert.match(cell, /const ok = mine\(p\.a\)/, "the rail lights each entry off legal");
  assert.match(cell, /onClick=\{ok \? tapTwice\(p\.card, p\.verb, \(\)=>fire\(p\.a\)\) : \(\)=>setZoom\(p\.card\)\}/,
    "two-tap to commit, the zoom when dim");
  assert.match(TB, /\{me\.hand\.map\(handCell\)\}\s*\{railPlays\(\)\.map\(railCell\)\}/,
    "the rail renders after the hand");
});

test("the peek dock can find every card the rail can peek", () => {
  const a = TB.indexOf("const peekables = () =>");
  const body = TB.slice(a, TB.indexOf(";", a));
  for(const want of ["gr.powCard", "liveBuild.HPOW", "me.grave", "me.banish"])
    assert.ok(body.includes(want), "peekables carries " + want);
});

test("a peek armed on one route does not commit another route of the same card", () => {
  const a = SRC.indexOf("function usePeek(");
  const body = SRC.slice(a, SRC.indexOf("\n}", a));
  assert.match(body, /peek\.uid !== card\.uid \|\| peek\.verb !== verb/,
    "the tile and the rail share a uid, so the verb is part of what the second tap confirms");
});

/* ---- the premise, DRIVEN: the order is not academic --------------------- */
test("in the defend step, a piece can be both a legal defender AND a legal activation", {skip}, () => {
  H.db();
  const SP = require("../tools/selfplay.js");
  const BIG = {uid: 9001, name: "Probe Haymaker", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], kw: [], tx: "", power: 6, def: 2, cost: 0, pitch: 1};
  let g = SP.match("fai", "dorinthea", 7, 1);
  g = {...g, sides: g.sides.map((s, i) => i === 1 ? {...s, hand: [{...BIG}, ...s.hand]} : s)};
  g = J.reduce(g, {t: "play", uid: 9001, from: "hand", target: "hero"}, 1).state;
  for(let i = 0; i < 20 && !(g.step === "defend" && g.priority === 0); i++){
    if(g.prompt){ g = J.reduce(g, J.autoAnswer(g), g.prompt.side || 0).state; continue; }
    g = J.reduce(g, {t: "pass"}, g.priority).state;
  }
  assert.equal(g.step, "defend");
  assert.equal(g.priority, 0, "Fai holds priority in the defend step (CR 7.3.3)");
  const both = g.sides[0].gear.filter(gr => gr.powCard
    && J.legal(g, {t: "defend", uid: gr.uid}, 0) === null
    && J.legal(g, {t: "activate", uid: "gp" + gr.uid}, 0) === null).map(gr => gr.name).sort();
  assert.deepEqual(both, ["Pouncing Paws", "Tearing Shuko"],
    "the pieces whose tile would have activated instead of declaring");
});
