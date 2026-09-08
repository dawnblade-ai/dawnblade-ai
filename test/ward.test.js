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

/* ============================================================
   §5 — THE `Ward N` KEYWORD IS THE PERMANENT (v4.34)

   > "Ward 1 (If you would be dealt damage, DESTROY THIS to prevent 1 of
   >  that damage.)"  — SEN037, the Silver Age Spectral Shield this
   >  project deals, whose reminder text the database omits
   >
   > "If your hero would be dealt damage, prevent X of that damage and
   >  destroy this."  — the-fab-cube `csvs/english/keyword.csv`, develop

   The parser read the keyword as `[["ward", N]]` — the op that fills a
   side's prevention POOL when a card resolves — so the number was banked
   at PLAY and the permanent then outlived it. Stronger than printed three
   ways at once: the aura survived (still a Cosmo weapon, still counted by
   every "auras you control" clause), its ward outlived it when anything
   else destroyed it, and a partial spend wasted nothing.

   AND UNREACHABLE A FOURTH WAY. Uphold Tradition prints `Ward 1` on
   EQUIPMENT, and a gear piece is dealt straight into the gear zone and
   never resolves — so its op never ran at all and Enigma's Arms piece
   printed a prevention worth exactly zero.

   NO TOOL HERE COULD SEE ANY OF IT. All eight records read `tier: full`,
   because the clause WAS consumed; the fairness sweep is one-sided toward
   cards stronger than printed *in the parse* and this was the rules
   machine; and the equipment half is weaker than printed, the direction
   the sweep is built not to look in.
   ============================================================ */

const wardPool = () => {
  const raw = require("../data/pool.json");
  const seen = new Set(), out = [];
  for(const r of raw){
    if(!r || !r.name) continue;
    const k = r.name + "|" + (r.pitch || 0); if(seen.has(k)) continue; seen.add(k);
    const c = {name: r.name, pitch: +(r.pitch || 0), tt: r.type_text || "", ty: r.types || [],
               tx: r.functional_text || "", kw: r.card_keywords || [],
               cost: r.cost, power: r.power, def: r.defense};
    if(P.wardValue(c) > 0) out.push(c);
  }
  return out;
};

test("THE POOL CENSUS, pinned as a SET — eight records, and one is GEAR", () => {
  /* A COUNT ALONE SAYS NOTHING (v3.21, v4.17). What matters is which
     records, and that exactly one of them is an EQUIPMENT — because the
     gear half is the one that was doing nothing, and a scan that quietly
     lost it would look identical to a scan that found everything. */
  const all = wardPool().map(c => c.name + "|" + c.pitch + "=" + P.wardValue(c)).sort();
  assert.deepEqual(all, [
    "Spectral Shield|0=1",
    "Uphold Tradition|0=1",
    "Waning Vengeance|1=3", "Waning Vengeance|2=2", "Waning Vengeance|3=1",
    "Waxing Specter|1=3",   "Waxing Specter|2=2",   "Waxing Specter|3=1"
  ]);
  const gear = wardPool().filter(c => /equipment/i.test(c.tt));
  assert.deepEqual(gear.map(c => c.name), ["Uphold Tradition"],
    "the gear half is one record and it is the one a board-only scan loses");

  /* AND THE AMOUNT IS READ, WHICH THE POOL ITSELF PROVES (v3.32, and for
     once no synthetic is needed): both Wa* cards print 3 / 2 / 1 across
     their three pitches, so a hardcoded 1 is right for one printing and
     wrong for two. */
  const spectre = wardPool().filter(c => c.name === "Waxing Specter").map(c => P.wardValue(c)).sort();
  assert.deepEqual(spectre, [1, 2, 3], "three printings, three numbers");
});

test("…and NOT ONE of them fills the prevention pool any more", () => {
  /* THE WHOLE PARSER HALF. An op here is the v4.34 bug: the number would
     be banked when the card resolved and the permanent would keep it. */
  for(const c of wardPool()){
    P.fxReset();
    const fx = P.fxParse(c);
    assert.equal((fx.ops || []).filter(o => o[0] === "ward" || o[0] === "awd").length, 0,
      c.name + " still banks a pool at play");
    assert.ok((fx.ops || []).some(o => o[0] === "noop" && /^ward \d+ —/.test(String(o[1]))),
      c.name + " stopped accounting for its keyword at all");
  }
});

/* ---- the scan --------------------------------------------------------- */

const auraEnt = (c, uid) => ({uid: uid, card: c, sd: null});

test("`wardBearers` scans BOARD **and** GEAR", {skip}, () => {
  H.db();
  const shield = H.tok("Spectral Shield"), arms = H.card("Uphold Tradition", 0);
  const boardOnly = P.wardBearers({board: [auraEnt(shield, "b1")], gear: []});
  const gearOnly  = P.wardBearers({board: [], gear: [{...arms, uid: 41}]});
  assert.deepEqual(boardOnly.map(x => x.where), ["board"]);
  assert.deepEqual(gearOnly.map(x => x.where), ["gear"],
    "a board-only scan finds seven of the eight, and loses the one that was inert");
  assert.equal(gearOnly[0].ward, 1);
});

test("…and a DESTROYED gear piece carries nothing", {skip}, () => {
  /* `sweepGear` files it at the end phase (v3.54's index hazard), so it
     is still in the array while this scan runs — the same guard
     `auraAttackOf` and `gearDef` keep. */
  H.db();
  const arms = H.card("Uphold Tradition", 0);
  assert.deepEqual(P.wardBearers({gear: [{...arms, uid: 41, destroyed: true}]}), []);
});

test("the order is TOTAL, and its middle key is an argument", {skip}, () => {
  H.db();
  const shield = H.tok("Spectral Shield"), arms = H.card("Uphold Tradition", 0);
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const got = P.wardBearers({board: [auraEnt(spec, "b3"), auraEnt(shield, "b1")],
                             gear: [{...arms, uid: 41}]});
  assert.deepEqual(got.map(x => x.card.name),
    ["Spectral Shield", "Uphold Tradition", "Waxing Specter"],
    "ward ascending, then BOARD before GEAR — an equipment also carries a printed " +
    "defence and an ability, so losing one gives up strictly more");

  /* A RANKING THAT LEAVES TIES UNBROKEN IS A DESYNC WAITING FOR TWO EQUAL
     WARDS (`sparring.js` states the same rule for two equal blockers), so
     the same side scanned twice must answer the same way — and the uid
     key is what makes it total. */
  const a = {board: [auraEnt(shield, "z9"), auraEnt(shield, "a1")], gear: []};
  const b = {board: [auraEnt(shield, "a1"), auraEnt(shield, "z9")], gear: []};
  assert.deepEqual(P.wardBearers(a).map(x => x.uid), P.wardBearers(b).map(x => x.uid),
    "two peers holding the same board must destroy the same permanent");
});

/* ---- driven ----------------------------------------------------------- */

function hit(g, amount, seat){
  return J.withEffects(g, (fx, s) => {
    const r = fx.preventDamage(s, seat == null ? 0 : seat, amount, "The attack");
    return Object.assign({}, r.game, {_dealt: r.dealt, _prev: r.prevented});
  });
}

test("DRIVEN: the permanent is DESTROYED to pay for the prevention", {skip}, () => {
  H.db();
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const g = H.state({board: [auraEnt(spec, "b3")], hp: 20}, {}, {turn: 7});
  const n = hit(g, 3);
  assert.equal(n._dealt, 0, "3 of 3 prevented");
  assert.deepEqual(n.sides[0].board, [], "the aura is gone");
  assert.deepEqual(n.sides[0].grave.map(c => c.name), ["Waxing Specter"]);
  assert.equal(n.sides[0].grave[0]._gy, 7,
    "…turn-stamped, or every \"put into a graveyard this turn\" clause goes quietly wrong");
  assert.equal(n.sides[0].ward, 0, "and nothing was ever banked in the pool");
});

test("…and a PARTIAL spend wastes the rest, because the price is the whole card", {skip}, () => {
  H.db();
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const n = hit(H.state({board: [auraEnt(spec, "b3")], hp: 20}, {}, {turn: 7}), 1);
  assert.equal(n._prev, 1, "one point is all that was coming");
  assert.deepEqual(n.sides[0].board, [], "…and the Ward 3 is spent for it anyway");
});

test("…and a GEAR piece is MARKED, never spliced", {skip}, () => {
  /* v3.54: a wall is declared out of the gear zone by INDEX on one board
     and by uid on the other, so removing an entry mid-resolution
     renumbers the defenders underneath it. `sweepGear` files it. */
  H.db();
  const arms = H.card("Uphold Tradition", 0);
  const n = hit(H.state({gear: [{...arms, uid: 41}], hp: 20}, {}, {turn: 7}), 1);
  assert.equal(n._dealt, 0);
  assert.equal(n.sides[0].gear.length, 1, "still in the array");
  assert.equal(n.sides[0].gear[0].destroyed, true, "…and marked");
  assert.deepEqual(n.sides[0].grave, [], "the end phase files it, not this");
});

test("…and NOTHING is spent when there is nothing to prevent", {skip}, () => {
  /* CR 7.5.5's shape: a swing already blocked to nothing costs no ward.

     BOTH HALVES, AND THE POOL HALF IS THE ONE THAT BITES. The permanents
     are guarded a second time by `while(left > 0)`, so a drill that only
     watches the board passes with the early return DELETED — which is
     exactly what the first draft of this drill did (v3.62: a sabotage
     that cannot express the bug proves nothing, and here it was the
     fixture). With the return gone the pool logs "ward soaks 0" and FIRES
     ITS RIDER off damage that never existed. */
  H.db();
  const spec = H.card("Waxing Specter", 1);
  const g = H.state({board: [auraEnt(spec, "b3")], ward: 2, wardTurn: 2,
                     wardRider: [{ops: [["token", "flurry", 1, "self"]]}], hp: 20}, {}, {turn: 7});
  const n = hit(g, 0);
  assert.equal(n.sides[0].board.length, 1, "the aura stands");
  assert.equal(n.sides[0].ward, 2, "…and the pool is untouched");
  assert.equal((n.sides[0].wardRider || []).length, 1, "…and the rider is still waiting");
  assert.ok(!(n.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
    "nothing was prevented, so nothing may trigger");
});

test("DRIVEN: the POOL is spent before any permanent", {skip}, () => {
  /* A STATED CHOICE, not a rule — CR gives the controller the order, and
     the pool is the half CR 4.4.3e takes back at the end of the turn
     either way, so spending it first gives up strictly less.
     `tools/approx.js` carries the record. */
  H.db();
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const n = hit(H.state({board: [auraEnt(spec, "b3")], ward: 2, wardTurn: 2, hp: 20}, {}, {turn: 7}), 2);
  assert.equal(n._dealt, 0);
  assert.equal(n.sides[0].ward, 0, "the pool paid");
  assert.equal(n.sides[0].board.length, 1, "…and the permanent is still standing");
});

test("DRIVEN: the smallest ward that COVERS the hit goes first", {skip}, () => {
  H.db();
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const shield = H.tok("Spectral Shield");           /* Ward 1 */
  const board = [auraEnt(spec, "b3"), auraEnt(shield, "b1")];

  const one = hit(H.state({board, hp: 20}, {}, {turn: 7}), 1);
  assert.deepEqual(one.sides[0].board.map(b => b.card.name), ["Waxing Specter"],
    "one damage takes the Shield, not the Ward 3");

  const three = hit(H.state({board, hp: 20}, {}, {turn: 7}), 3);
  assert.deepEqual(three.sides[0].board.map(b => b.card.name), ["Spectral Shield"],
    "three damage takes the Ward 3 alone rather than both — fewest permanents destroyed");

  const four = hit(H.state({board, hp: 20}, {}, {turn: 7}), 4);
  assert.deepEqual(four.sides[0].board, [], "and four takes them both");
  assert.equal(four._dealt, 0);

  const five = hit(H.state({board, hp: 20}, {}, {turn: 7}), 5);
  assert.equal(five._dealt, 1, "…while a fifth point gets through, because the wards ran out");
});

test("DRIVEN: Waning Vengeance's ward IS its exit, and the gate still gates", {skip}, () => {
  /* THE LOOP THE CARD IS DESIGNED AROUND. "When this leaves the arena, if
     you've pitched a blue card this turn, create a Spectral Shield token"
     — and until v4.34 nothing could make its ward destroy it, so the one
     exit the card prints for itself never fired. The eighth route into
     `payLeave` (v4.29's one body).

     BLUE IS PITCH 3, and the first draft of this drill put a pitch-1 card
     in the pitch zone and read the trigger as dead. Check your own
     fixture. */
  H.db();
  const wv = H.card("Waning Vengeance", 3);          /* Ward 1 */
  const blue = H.card("Oasis Respite", 3);
  const met = hit(H.state({board: [auraEnt(wv, "b9")], pitch: [blue], hp: 20}, {}, {turn: 4}), 1);
  assert.deepEqual(met.sides[0].board.map(b => b.card.name), ["Spectral Shield"],
    "the ward destroys it and its printed leave trigger pays out");
  assert.deepEqual(met.sides[0].grave.map(c => c.name), ["Waning Vengeance"]);

  const unmet = hit(H.state({board: [auraEnt(wv, "b9")], pitch: [], hp: 20}, {}, {turn: 4}), 1);
  assert.deepEqual(unmet.sides[0].board, [],
    "…and with nothing blue pitched the aura still leaves and pays NOTHING — " +
    "the gate is on the PAYLOAD, not on the exit (v4.30)");
});

test("DRIVEN: the candidate set is captured BEFORE any of it is spent", {skip}, () => {
  /* v2.23's rule for the Runechant pop, one replacement over. Waning
     Vengeance's own leave trigger MINTS a Spectral Shield carrying Ward 1
     of its own, so a set re-derived each pass would let a token created by
     one prevention soak the very damage that created it — and it is what
     bounds the loop, which matters for a reducer fed by JSON off a wire. */
  H.db();
  const wv = H.card("Waning Vengeance", 3);          /* Ward 1 */
  const blue = H.card("Oasis Respite", 3);
  const n = hit(H.state({board: [auraEnt(wv, "b9")], pitch: [blue], hp: 20}, {}, {turn: 4}), 2);
  assert.equal(n._dealt, 1, "the minted Shield must NOT soak the hit that minted it");
  assert.deepEqual(n.sides[0].board.map(b => b.card.name), ["Spectral Shield"],
    "…and it is still there afterwards");
});

test("DRIVEN AT THE TABLE: a real swing spends a real permanent", {skip}, () => {
  /* Sixteen drills calling `preventDamage` directly all pass against an
     engine whose `strike` never reaches it (v3.89, v4.03). Drive the real
     entry point, or pin nothing. */
  H.db();
  const spec = H.card("Waxing Specter", 1);          /* Ward 3 */
  const atk = swing();
  let g = H.state({res: 9, ap: 1, hand: [atk]},
                  {hp: 20, hand: [], gear: [], board: [auraEnt(spec, "b3")]},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "ward34"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], builds: [{}, {}]};
  let n = J.reduce(g, {t: "play", uid: 700, from: "hand"}, 0).state;
  for(let i = 0; i < 40 && !n.over && n.step !== "resolution" && n.step !== "close"; i++){
    const pri = n.priority; if(pri == null) break;
    const out = J.reduce(n, {t: "pass"}, pri); if(out.error) break;
    n = out.state;
  }
  assert.equal(n.sides[1].hp, 18, "a 5-power swing into a Ward 3 lands 2");
  assert.deepEqual(n.sides[1].board, [], "and the aura paid for it");
  assert.equal(n.pend && n.pend.dealt, 2,
    "CR 7.5.5 — `dealt` is the post-prevention number, or every rider fires off prevented damage");
});

/* ---- what the screen says --------------------------------------------- */

test("`wardTotal` is the pool PLUS the permanents", {skip}, () => {
  /* THREE SITES PUT A `ward N` PIP ON THE SCREEN and all three read the
     side field, which now holds only the windowed family — so a seat
     holding a Ward 3 aura showed NOTHING. A number on screen that
     disagrees with what happens is the sev-2 category the player TRUSTS. */
  H.db();
  const spec = H.card("Waxing Specter", 1), arms = H.card("Uphold Tradition", 0);
  const sd = S.makeSide({id: 0});
  assert.equal(P.wardTotal(Object.assign({}, sd, {ward: 2})), 2, "the pool alone");
  assert.equal(P.wardTotal(Object.assign({}, sd, {board: [auraEnt(spec, "b3")]})), 3,
    "the permanent alone — the number that used to render as nothing");
  assert.equal(P.wardTotal(Object.assign({}, sd, {ward: 2, board: [auraEnt(spec, "b3")],
    gear: [{...arms, uid: 41}]})), 6, "and they are additive, because they are spent in turn");
  assert.equal(P.wardTotal(Object.assign({}, sd, {gear: [{...arms, uid: 41, destroyed: true}]})), 0);
});

test("the trainer's three ward pips all ask it", {skip}, () => {
  const html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const raw = (html.match(/\b(?:me|you\(g\))\.ward\b/g) || []);
  assert.deepEqual(raw, [],
    "a pip reading the side field alone shows nothing for a seat whose ward is on the board");
  assert.ok((html.match(/wardTotal\(/g) || []).length >= 3,
    "…and the scan is alive: three sites ask the one reader");
});

/* ---- the windowed family, and the writer that forgot it --------------- */

test("`revWard` carries its printed window", {skip}, () => {
  /* v4.07 built `wardTurn` so the end phase could sweep exactly the
     "prevent the next N damage THIS TURN" family, and this writer reaches
     `.ward` directly rather than through the `ward` op — so it was never
     told, while its own feed line said "this turn". */
  H.db();
  const g = H.state({deck: [{uid: "t1", name: "Top", pitch: 3}]}, {}, {actor: 0, turn: 3});
  const n = J.withEffects(g, (fx, s) => fx.runOps(s, [["reveal", 1], ["revWard", 1]], "Throw Caution"));
  assert.equal(n.sides[0].ward, 3);
  assert.equal(n.sides[0].wardTurn, 3, "the feed said \"this turn\" and the state kept it forever");

  const end = E.beginEndPhase(n, 0);
  assert.equal(end.game.sides[0].ward, 0, "…and the end phase takes it back");
});

/* ---- the two things measured rather than assumed ---------------------- */

test("the GEAR half pays no leave trigger, MEASURED", {skip}, () => {
  /* "Leaves the ARENA" is a statement about that zone and a gear piece was
     never in it, so `payLeave` is called for board entries only. That is
     lossless because the one ward-bearing equipment prints no such clause
     — and this fails the day one does, rather than the clause going
     quietly unpaid. */
  H.db();
  for(const c of wardPool().filter(x => /equipment/i.test(x.tt))){
    P.fxReset();
    assert.deepEqual(E.leavePayout(c, S.makeSide({id: 0})), [],
      c.name + " prints a leave payout and this route drops it — call payLeave for gear too");
  }
});

test("no ward permanent holds up an `arcShield` or a `lifeLock`, MEASURED", {skip}, () => {
  /* `sweepArena` RE-DERIVES those two when a card leaves, because they are
     side fields caching a board fact (v3.07). This route does not, and it
     is lossless for the same measured reason — the day a ward permanent
     grants one, that re-derivation has to be shared out of `sweepArena`
     rather than this drill going quietly stale. */
  H.db();
  for(const c of wardPool()){
    P.fxReset();
    const fx = P.fxParse(c);
    const all = [...(fx.ops || []), ...((fx.conds || []).flatMap(x => x.ops || []))];
    assert.deepEqual(all.filter(o => o[0] === "arcShield" || o[0] === "lifeLock"), [],
      c.name + " holds up a side field that this route does not re-derive");
  }
});

test("the feed phrase and the self-play counter are pinned TOGETHER", () => {
  /* v3.81: a counter that spells the wrong word reports zero exactly as a
     missing feature does, and this project has believed that instrument
     twice. */
  const fs = require("fs"), path = require("path");
  const eff = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const sp  = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.ok(/destroys itself — ward soaks/.test(eff), "the engine's phrase moved");
  assert.ok(/destroys itself — ward soaks/.test(sp),  "…and the counter did not follow it");
});
