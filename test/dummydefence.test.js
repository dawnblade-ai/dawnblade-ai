/* ============================================================
   THE TRAINER'S DUMMY DEFENDS UNDER THE TABLE'S CAP (v6.75)

   `dummyDefence` read the cap's NUMBER as a limit on hand cards and added
   the iron freely: against Confidence ("can't be defended by more than 2
   non-block cards" — equipment counts) it fielded three defenders where
   judge.legal refuses the third, and against overpower (1 ACTION card) a
   non-action hand defender spent the cap. It now asks `parser.defCapWhy`,
   the table's one body, for every candidate in its pick order.

   The wall is a React closure, so this runs the REAL source: the body is
   sliced out of index.html at its anchor (test/actor.test.js's ledger) and
   evaluated with the engine modules and the few closure names it reads.
   Observables: which defenders are put on the stack, and each one judged by
   `defCapWhy` against those before it. The 2-card heuristic stands (a plain
   swing still meets the iron and two cards).
   Sabotage checked, two ways: `capOK` always true fails Confidence and
   dominate; the OLD shortcut restored (`cap = min(2, _cap.n)` hand cards, no
   `capOK`) fails Confidence and overpower. The plain swing is the control.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const DawnParser = require("../engine/parser.js");
const GM = require("../engine/game.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function body(anchor){
  const a = SRC.indexOf(anchor); assert.ok(a > 0, "anchor found: " + anchor);
  const b = SRC.indexOf("\n  };\n", a); assert.ok(b > a, "end of body found");
  return SRC.slice(a, b + 5);
}
/* the closure names the body reads, and nothing else */
const opp = n => n.sides[1], L = (n, m) => ({...n, log: [m, ...(n.log || [])]});
const gearDef = GM.gearDef, hasKwNow = DawnParser.hasKwNow;
const dummyDefence = eval("(() => {" + body("  const dummyDefence = (s, total, card) => {")
  .replace("const dummyDefence =", "return") + "})()");

const card = (name, ty, def, extra) => Object.assign({uid: name, name, ty, tt: ty.join(" "), def, pitch: 1, cost: 0}, extra || {});
const atk = card("Drill Swing", ["Generic", "Action", "Attack"], 2, {power: 6, tx: "", kw: []});
const iron = {uid: "g1", name: "Drill Iron", tt: "Generic Equipment - Chest", ty: ["Generic", "Equipment", "Chest"], def: 2};
const aA = card("Drill Wall A", ["Generic", "Action", "Attack"], 3);
const aB = card("Drill Wall B", ["Generic", "Action", "Attack"], 3);
const blk = card("Drill Block", ["Generic", "Block"], 3);

function wall(hand, held, kwGrant){
  const s = {sides: [{name: "You", gear: [], hand: []}, {name: "Dummy", gear: [iron], hand, chainBlocked: []}],
             stack: [], log: [], feed: [], pend: {card: atk, defCap: held || null}, _kwGrant: kwGrant || []};
  const out = dummyDefence(s, 9, atk);
  const defs = out.n.stack.filter(l => l.k === "def")
    .map(l => l.gi != null ? {card: iron, gear: true} : {card: hand.find(c => c.uid === l.uid), gear: false});
  /* every declaration the table would take, in order */
  const pend = {card: atk, defCap: DawnParser.defCap(atk, held || null, {kwGrant: kwGrant || []})};
  const why = defs.map((d, i) => DawnParser.defCapWhy(pend, defs.slice(0, i), d.card, d.gear));
  return {names: defs.map(d => d.card.name), why};
}

test("the control: a plain swing meets the iron and two cards (the heuristic stands)", () => {
  const w = wall([aA, aB]);
  assert.deepEqual(w.names, ["Drill Iron", "Drill Wall A", "Drill Wall B"]);
});

test("Confidence: at most 2 non-block defenders, the iron counted", () => {
  const w = wall([aA, aB], {n: 2, count: "nonBlock"});
  assert.equal(w.names.length, 2, "two defenders: " + w.names.join(", "));
  assert.deepEqual(w.why, [null, null], "the table takes every one of them");
});

test("overpower: a Block card from hand does not spend the 1 ACTION-card cap", () => {
  const w = wall([blk, aA, aB], null, ["overpower"]);
  assert.deepEqual(w.names, ["Drill Iron", "Drill Block", "Drill Wall A"],
    "the Block card and ONE action card both defend");
  assert.deepEqual(w.why, [null, null, null]);
});

test("dominate: the iron and one card from hand", () => {
  const w = wall([aA, aB], null, ["dominate"]);
  assert.deepEqual(w.names, ["Drill Iron", "Drill Wall A"]);
  assert.deepEqual(w.why, [null, null]);
});

test("CR 4.4.3d: the trainer untaps arena permanents in the end phase, not at the next turn's start", () => {
  const ecf = SRC.slice(SRC.indexOf("  function endPhaseCF(s, si){"), SRC.indexOf("  function afterArsenal(s){"));
  assert.match(ecf, /actMut\(n\)\.board = \(act\(n\)\.board\|\|\[\]\)\.map\(b => b && b\.spent \? \{\.\.\.b, spent:false\} : b\)/);
  const nt = SRC.slice(SRC.indexOf("  function newTurn(s){"), SRC.indexOf("  function newTurn(s){") + 6000);
  const fb = SRC.slice(SRC.indexOf("  function foeBegin(s){"), SRC.indexOf("  function foeStep(s){"));
  for(const [name, b] of [["newTurn", nt], ["foeBegin", fb]])
    assert.ok(!/spent:\s*false/.test(b), name + " untaps at the start of a turn again");
});
