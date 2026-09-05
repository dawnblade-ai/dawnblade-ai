/* ============================================================
   PLAIN WARD, AND IT WAS INERT AT THE TABLE.

   `ward` is added by a SHARED op (`runOps`) and was consumed in exactly
   one place: `index.html`'s `takeIt`. `judge.js` applies `hp - total` and
   read `.ward` NOWHERE AT ALL — so five pool cards that print a
   prevention did nothing there:

     Cloud Cover · Oasis Respite · Seeker's Mitts · Toe the Line
     · Radiant Touch (through its ability)

   v3.01's shape for the fifth time this cycle, and the arcane twin has
   been shared since `arcaneHit` was written, which is exactly what made
   this look wired.

   NO TOOL HERE COULD SEE IT. Coverage reads Cloud Cover `full` — the
   clause IS read; the fairness sweep is deliberately one-sided toward
   cards STRONGER than printed and this is a defence being too weak; and
   `failstates.js` grades unread text, not a value that evaporates.

   IT REDUCES WHAT IS **DEALT**, NOT ONLY WHAT LIFE LOSES (CR 7.5.5): if
   prevention means no damage is dealt, it is no longer a hit. A caller
   that subtracts ward from life while handing the unprevented number to
   its on-hit clauses fires every rider off damage that never landed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

/* ---- 1. the shared body -------------------------------------------- */

test("`preventDamage` returns what is DEALT, and drains the pool", () => {
  const g = H.state({}, {ward: 5}, {actor: 0});
  const out = J.withEffects(g, (fx, s) => fx.preventDamage(s, 1, 3, "probe"));
  assert.equal(out.dealt, 0, "3 into a pool of 5 lands nothing");
  assert.equal(out.prevented, 3);
  assert.equal(out.game.sides[1].ward, 2, "…and the pool drains by what it soaked");
});

test("…and a pool smaller than the hit lets the rest through", () => {
  const g = H.state({}, {ward: 2}, {actor: 0});
  const out = J.withEffects(g, (fx, s) => fx.preventDamage(s, 1, 5, "probe"));
  assert.equal(out.dealt, 3);
  assert.equal(out.prevented, 2);
  assert.equal(out.game.sides[1].ward, 0, "spent");
});

test("no ward is a no-op that still answers the amount", () => {
  const g = H.state({}, {}, {actor: 0});
  const out = J.withEffects(g, (fx, s) => fx.preventDamage(s, 1, 4, "probe"));
  assert.equal(out.dealt, 4);
  assert.equal(out.prevented, 0);
});

/* ---- 2. DRIVEN AT THE TABLE — where it did nothing ----------------- */

const swing = o => Object.assign({name: "Probe Swing", tt: "Generic Attack Action",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: 5, pitch: 1, cost: 0,
  def: 2, uid: 700}, o || {});

function tableSwing(defWard){
  const atk = swing();
  let g = H.state({res: 9, ap: 1, hand: [atk]}, {hp: 20, ward: defWard, hand: [], gear: []},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "ward"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], builds: [{}, {}]};
  let n = J.reduce(g, {t: "play", uid: 700, from: "hand"}, 0).state;
  /* walk the chain to the damage step: both seats pass in succession */
  for(let i = 0; i < 40 && !n.over && n.step !== "resolution" && n.step !== "close"; i++){
    const pri = n.priority;
    if(pri == null) break;
    const out = J.reduce(n, {t: "pass"}, pri);
    if(out.error) break;
    n = out.state;
  }
  return n;
}

test("DRIVEN: ward soaks at the TABLE — it read `.ward` nowhere at all", {skip}, () => {
  const bare = tableSwing(0);
  const warded = tableSwing(3);
  assert.equal(bare.sides[1].hp, 15, "a 5-power swing with no ward takes 5");
  assert.equal(warded.sides[1].hp, 18, "…and 3 of it must be prevented");
  assert.equal(warded.sides[1].ward, 0, "the pool is spent");
});

test("…and the prevention reduces what was DEALT, not only life (CR 7.5.5)", {skip}, () => {
  /* `pend.dealt` is what every on-hit clause, crush and the soul read. If
     ward were subtracted from life alone, all of them would fire off
     damage that never landed — the same rule `arcaneHit` keeps for its
     own credit (v3.28). */
  const n = tableSwing(3);
  assert.equal(n.pend && n.pend.dealt, 2,
    "dealt must be the post-prevention number, or every rider fires off prevented damage");
});

test("…and a swing fully prevented is NOT a hit", {skip}, () => {
  const n = tableSwing(9);
  assert.equal(n.sides[1].hp, 20, "nothing lands");
  assert.equal(n.pend && n.pend.dealt, 0,
    "CR 7.5.5 — if prevention means no damage is dealt, it is no longer a hit");
});

/* ---- 3. the rider that waits on the prevention --------------------- */

test("Toe the Line's two halves are PAIRED, and the rider rides on the op", {skip}, () => {
  P.fxReset();
  const pool = require("../data/pool.json");
  const r = pool.find(x => x.name === "Toe the Line");
  const fx = P.fxParse({name: "toe|pair|" + r.pitch, tx: r.functional_text || "",
                        tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                        pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  /* THE WINDOW RIDES BESIDE THE RIDER (v4.07), and this card is the one
     that proves the merge. Written as a fresh literal, `fxParse`'s rider
     merge DROPPED the "this turn" the matcher had just attached — so the
     single card printing BOTH a rider and a window was the one that lost
     one. v2.34's rule read at the consumer end (v3.53). */
  assert.deepEqual(fx.ops, [["ward", 2, {until: "turn", ops: [["token", "flurry", 1, "self"]]}]]);
  assert.equal(fx.tier, "full");
  P.fxReset();
});

test("…and a ward with NO rider keeps its plain shape", {skip}, () => {
  /* v3.58's rule: a field that is always present changes the shape of
     every `ward` op in the pool. Cloud Cover prints the same prevention
     and no rider, and its parse must not move. */
  P.fxReset();
  const pool = require("../data/pool.json");
  const r = pool.find(x => x.name === "Cloud Cover");
  const fx = P.fxParse({name: "cloud|pair|" + r.pitch, tx: r.functional_text || "",
                        tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                        pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  /* CHANGED DELIBERATELY AT v4.07 — Cloud Cover prints "this turn" too,
     so its op carries the window and no rider. What v3.58's rule protects
     is that the flag is OPT-IN: an aura's bare `Ward N` still parses to a
     two-element op, which `test/parser.test.js` pins. */
  assert.deepEqual(fx.ops, [["ward", 3, {until: "turn"}]]);
  P.fxReset();
});

test("DRIVEN: the rider fires where the damage is turned aside", {skip}, () => {
  H.db();                       /* the mint resolves the token against the db */
  const g = H.state({}, {}, {actor: 0, turn: 3});
  /* hold the ward and its rider, then take a hit */
  let n = J.withEffects(g, (fx, s) =>
    fx.runOps(s, [["ward", 2, {ops: [["token", "flurry", 1, "self"]]}]], "Toe the Line"));
  assert.equal(n.sides[0].ward, 2);
  assert.equal((n.sides[0].wardRider || []).length, 1, "the rider waits with the pool");
  n = J.withEffects(n, (fx, s) => fx.preventDamage(s, 0, 2, "a swing").game);
  assert.ok((n.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
    "prevention is the trigger — the token lands");
  assert.deepEqual(n.sides[0].wardRider, [], "…and it is spent (the card prints \"the NEXT time\")");
});

test("A PREVENTION THAT PREVENTS NOTHING TRIGGERS NOTHING", {skip}, () => {
  /* CR 7.5.5's shape, and the reason the rider fires from inside the
     shared body rather than from a call site — that is exactly how the
     arcane credit went wrong the first time (v3.28). With an empty pool
     no damage is turned aside, so the rider must still be waiting.

     `H.db()` IS LOAD-BEARING IN A NEGATIVE DRILL. The mint resolves its
     token against the registered database, so without it nothing lands
     whatever the engine does — the assertion below would pass by finding
     nothing, which is the shape this project keeps catching in its own
     drills. The positive control above registers it and proves the mint
     works; this one must run in the same state. */
  H.db();
  const g = H.state({ward: 0, wardRider: [{ops: [["token", "flurry", 1, "self"]]}]},
                    {}, {actor: 0, turn: 3});
  const n = J.withEffects(g, (fx, s) => fx.preventDamage(s, 0, 4, "a swing").game);
  assert.ok(!(n.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
    "nothing was prevented, so nothing may trigger");
  assert.equal((n.sides[0].wardRider || []).length, 1, "…and the rider still waits");
});

/* ---- 4. the ledgers ------------------------------------------------ */

test("a side field is not real until every ledger carries it", () => {
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "..", "engine", f), "utf8");
  assert.ok(Array.isArray(S.makeSide().wardRider), "makeSide must declare it");
  assert.ok(/"wardRider"/.test(rd("sides.js")), "SIDE_FIELDS");
  assert.ok(/"wardRider"/.test(rd("wire.js")),  "wire.js — a dropped field is a desync");
  assert.ok(/wardRider: sd\.wardRider/.test(rd("report.js")), "report.js seat()");
});

test("BOTH BOARDS ASK THE ONE BODY — neither keeps its own ward arithmetic", () => {
  /* The trainer's wall is a React closure, so this half is a source scan
     and says so. What it proves is that no second copy of the arithmetic
     survives: an inline `Math.min(ward, through)` in either file is the
     drift this whole version exists to delete. */
  const fs = require("fs"), path = require("path");
  const root = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const html = root("index.html"), judge = root("engine/judge.js");
  assert.ok(/_EFX\.preventDamage\(/.test(html), "the trainer must call the shared body");
  assert.ok(/fx\.preventDamage\(/.test(judge),  "and so must judge");
  assert.ok(!/Math\.min\(ward\s*,/.test(html), "no second copy of the arithmetic in the trainer");
  assert.ok(!/Math\.min\(ward\s*,/.test(judge), "…nor in judge");
});

/* ============================================================
   THE SAME REVEAL, A DIFFERENT POOL (v3.68)

   Three pool records print "X is the pitch value of the card revealed
   this way". The two Rabbles spend it on the attack's power; Throw
   Caution to the Wind spends it on a PREVENTION and read `part`.

   NO X MACHINERY IS NEEDED — v3.39's rule about Blaze. X is not a free
   variable the player picks, it is settled by the card the reveal turns
   up, so the reader is the reveal that already ran.
   ============================================================ */

test("Throw Caution's X is read off the reveal, not asked for", {skip}, () => {
  P.fxReset();
  const pool = require("../data/pool.json");
  const r = pool.find(x => x.name === "Throw Caution to the Wind");
  const fx = P.fxParse({name: "tc|x|" + r.pitch, tx: r.functional_text || "",
                        tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                        pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
  assert.deepEqual(fx.ops, [["reveal", 1], ["revWard", 1]],
    "the reveal must run first and leave the card for the ward to read");
  assert.equal(fx.tier, "full");
  P.fxReset();
});

test("…and the two Rabbles keep spending it on POWER", {skip}, () => {
  /* The control. One op for both consumers would make the destination a
     parameter of a card's text — which is why `revPitch` and
     `revColorPitch` already stay apart. */
  P.fxReset();
  const pool = require("../data/pool.json");
  for(const [nm, sign] of [["Murderous Rabble", 1], ["Ravenous Rabble", -1]]){
    const r = pool.find(x => x.name === nm);
    const fx = P.fxParse({name: nm + "|ctl|" + r.pitch, tx: r.functional_text || "",
                          tt: r.type_text || "", ty: r.types || [], kw: r.card_keywords || [],
                          pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense});
    assert.deepEqual(fx.ops, [["reveal", 1], ["revPitch", sign]], nm);
  }
  P.fxReset();
});

test("DRIVEN: the ward granted IS the revealed card's pitch", {skip}, () => {
  H.db();
  const run = topPitch => {
    const g = H.state({deck: [{uid: "t1", name: "Top Card", pitch: topPitch}]},
                      {}, {actor: 0, turn: 3});
    return J.withEffects(g, (fx, s) => fx.runOps(s, [["reveal", 1], ["revWard", 1]], "Throw Caution"));
  };
  /* THREE PITCHES, or a hardcoded 1 passes a test written against red
     alone — the same rule `rustDestroy` and heave follow. */
  assert.equal(run(1).sides[0].ward, 1);
  assert.equal(run(2).sides[0].ward, 2);
  assert.equal(run(3).sides[0].ward, 3);
});

test("…and it stacks onto a pool that is already there", {skip}, () => {
  H.db();
  const g = H.state({ward: 2, deck: [{uid: "t1", name: "Top", pitch: 3}]}, {}, {actor: 0, turn: 3});
  const n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reveal", 1], ["revWard", 1]], "Throw Caution"));
  assert.equal(n.sides[0].ward, 5, "ward is one draining pool, not a replacement");
});

test("a reveal that turned up nothing grants nothing", {skip}, () => {
  H.db();
  const g = H.state({deck: []}, {}, {actor: 0, turn: 3});
  const n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reveal", 1], ["revWard", 1]], "Throw Caution"));
  assert.equal(n.sides[0].ward, 0, "an empty deck reveals nothing — 0 is the honest answer");
});

test("DRIVEN: the granted ward actually prevents, through the shared body", {skip}, () => {
  /* End to end: the two halves of this version meet here. Without v3.67's
     `preventDamage` the pool would sit on the side doing nothing at the
     table, which is precisely the bug that version fixed. */
  H.db();
  const g = H.state({deck: [{uid: "t1", name: "Top", pitch: 3}]}, {}, {actor: 0, turn: 3});
  let n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reveal", 1], ["revWard", 1]], "Throw Caution"));
  const out = J.withEffects(n, (fx, s) => fx.preventDamage(s, 0, 5, "a swing"));
  assert.equal(out.dealt, 2, "3 of the 5 is prevented");
  assert.equal(out.game.sides[0].ward, 0, "and the pool is spent");
});
