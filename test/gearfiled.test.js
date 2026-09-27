/* ============================================================
   A DESTROYED PIECE GOES TO THE GRAVEYARD NOW (v4.79)

   The CR files a destroyed permanent immediately. v3.54 filed destroyed
   GEAR at the beginning of its controller's end phase instead, and stated
   it as an approximation whose observable difference "needs both a destroy
   and a retrieve inside one turn cycle". Arakni's deck is that turn cycle:
   Mark of the Huntsman destroys ITSELF to mark a hero (v4.37), and Pick Up
   the Point retrieves "a dagger from your graveyard" — so with the Mark
   sitting in `gear` until the end phase, the retrieve found an empty
   graveyard every time the loop was played in one turn.

   The reason v3.54 gave is about WALLS — the trainer's `blockG` holds
   INDICES into `gear` — and it still holds there. So a seat with a
   declared wall is spared and everything else is filed by the end of the
   resolution that destroyed it: `effects.fileDestroyedGear`, run at the
   tail of `execute` and `applyAnswer` and wherever a combat wall is
   released (judge's `strike`, the trainer's `resolveStack` and
   `finishBlock`).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers/judged.js");
const J = H.J;
const INV = require("../engine/invariants.js");

const skip = !H.hasDb();
const ROOT = path.join(__dirname, "..");

/* a piece that wears to nothing when it blocks: Temper at 1 */
const temper = uid => ({uid, name: "Probe Greaves " + uid, tt: "Generic Equipment - Legs",
  ty: ["Generic", "Equipment", "Legs"], kw: ["Temper"], def: 1, curDef: 1, tx: "", pitch: 0});
const plain = uid => ({uid, name: "Probe Helm " + uid, tt: "Generic Equipment - Head",
  ty: ["Generic", "Equipment", "Head"], kw: [], def: 1, curDef: 1, tx: "", pitch: 0});
const swing = uid => ({uid, name: "Probe Swing " + uid, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], kw: [], tx: "", power: 4, def: 2, cost: 0, pitch: 1});
const gone = p => Object.assign({}, p, {destroyed: true});
const file = g => H.fx(g, (fx, s) => fx.fileDestroyedGear(s));

/* pass until the queue opens a sheet, or the link is over */
const passUntil = (n, done) => {
  for(let i = 0; i < 24 && !done(n); i++){
    if(n.priority == null) break;
    const r = J.reduce(n, {t: "pass"}, n.priority);
    if(r.error) break;
    n = r.state;
  }
  return n;
};

/* ---- 1. THE LOOP THE RECORD NAMED, DRIVEN THROUGH THE TABLE ----------- */

test("DRIVEN: the Mark destroys itself and Pick Up the Point retrieves it THE SAME TURN", {skip}, () => {
  H.db();
  const mark = Object.assign({}, H.card("Mark of the Huntsman", 0), {uid: 900});
  const pu = Object.assign({}, H.card("Pick Up the Point", 1), {uid: "pu"});
  let n = H.state({name: "Arakni", gear: [mark], res: 9, ap: 1, hand: [pu]},
                  {name: "Them", hp: 20, hand: [], deck: [{uid: "d1", name: "T"}]},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "gearfiled"});
  n = Object.assign({}, n, {phase: "action", step: "layer", priority: 0, passed: []});
  const act = (a, seat) => { const r = J.reduce(n, a, seat); assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error); n = r.state; };

  act({t: "activate", uid: 900}, 0);
  n = passUntil(n, s => !!s.prompt);
  assert.equal(n.prompt && n.prompt.src, "Mark of the Huntsman", "the hit offers the Mark's own price");
  act({t: "promptChoose", choice: "pay"}, 0);
  act({t: "promptConfirm"}, 0);
  assert.equal(n.sides[1].marked, true, "the mark lands");
  assert.ok(H.filed(n.sides[0], 900), "and the Mark is in the graveyard NOW, not at the end phase");
  assert.equal(n.sides[0].grave.find(c => c.uid === 900)._gy, 3, "…turn-stamped with THIS turn");
  assert.deepEqual(INV.errors(n), [], "the board is clean");

  n = passUntil(n, s => !s.pend && s.step !== "damage" && s.step !== "resolution");
  act({t: "play", uid: "pu", from: "hand"}, 0);
  n = passUntil(n, s => !!s.prompt);
  assert.equal(n.prompt && n.prompt.src, "Pick Up the Point");
  assert.deepEqual((n.prompt.cards || []).map(c => c.uid), [900],
    "the retrieve finds the Mark — with the old end-phase sweep the graveyard was EMPTY here");
  assert.equal(n.turn, 3, "all of it inside one turn");
});

/* ---- 2. WHERE AN INDEX IS HELD, THE PIECE WAITS ----------------------- */

test("a seat with a declared wall is SPARED — the trainer's `blockG` is indices", {skip: false}, () => {
  /* v3.54's whole reason. `blockG: [1]` means "the SECOND piece", so
     splicing the destroyed first piece would make it mean the third. */
  const g = H.state({gear: [gone(plain(1)), plain(2)], blockG: [1]}, {gear: [gone(plain(3))]});
  const n = file(g);
  assert.deepEqual(n.sides[0].gear.map(x => x.uid), [1, 2], "the walled seat keeps its array intact");
  assert.ok(H.filed(n.sides[1], 3), "the OTHER seat, holding no wall, is filed");
});

test("the trainer's `def` layers spare the DEFENDER's gear, and only it", {skip: false}, () => {
  /* The dummy's gear blocks are `{k:"def", gi}` stack layers: indices into
     the DEFENDING seat's gear, which is the foe of whoever declared. The
     attacker's own destroyed piece is in no wall and is filed. */
  const g = Object.assign(H.state({gear: [gone(plain(1))]}, {gear: [gone(plain(2)), plain(3)]}),
    {stack: [{k: "def", gi: 1}], pend: {card: swing("a"), by: 0, total: 4}});
  const n = file(g);
  assert.ok(H.filed(n.sides[0], 1), "the attacker's piece is filed");
  assert.deepEqual(n.sides[1].gear.map(x => x.uid), [2, 3], "the defender's indices are left alone");
});

test("nothing to file is nothing changed — the same object back", {skip: false}, () => {
  const g = H.state({gear: [plain(1)]}, {gear: [plain(2)]});
  assert.equal(file(g).sides, g.sides, "no side was rebuilt for a sweep with nothing in it");
});

/* ---- 3. THE COMBAT TAILS ---------------------------------------------- */

test("DRIVEN: judge's strike files a defender worn to nothing, once the wall is released", {skip}, () => {
  H.db();
  let n = H.state({name: "Arakni", res: 9, ap: 1, hand: [swing("sw")]},
                  {name: "Them", hp: 20, gear: [temper(70)], hand: [], deck: [{uid: "d1", name: "T"}]},
                  {actor: 0, turnPlayer: 0, turn: 3, seed: "gearfiled-strike"});
  n = Object.assign({}, n, {phase: "action", step: "layer", priority: 0, passed: []});
  let r = J.reduce(n, {t: "play", uid: "sw", from: "hand"}, 0);
  assert.equal(r.error, null, r.error);
  n = passUntil(r.state, s => s.step === "defend");
  r = J.reduce(n, {t: "defend", uid: 70}, 1);
  assert.equal(r.error, null, "the Temper piece may defend: " + r.error);
  n = passUntil(r.state, s => s.step === "resolution" || !s.pend);
  assert.equal(n.sides[1].hp, 17, "4 power into a wall of 1");
  assert.ok(H.filed(n.sides[1], 70), "Temper at 1 is destroyed by blocking, and filed at the strike");
  assert.deepEqual(INV.errors(n), [], "the board is clean");
});

test("DRIVEN: the trainer's resolveStack files it too, once the stack is cleared", {skip: false}, () => {
  const g = Object.assign(H.state({}, {gear: [temper(71)], hp: 20}, {turn: 3}),
    {pend: {card: swing("a"), from: "hand", total: 4, ga: false, by: 0,
            ops: [], onHit: [], condOnHit: [], lateConds: [], lateOps: []},
     stack: [{k: "def", gi: 0}]});
  const n = H.fx(g, (fx, s) => fx.resolveStack(s));
  assert.equal(n.sides[1].hp, 17);
  assert.ok(H.filed(n.sides[1], 71), "the dummy's worn piece is in its graveyard");
});

/* ---- 4. THE TRAINER'S BLOCK PATH, WHICH NO DRILL CAN DRIVE ------------ */

test("the trainer's finishBlock files AFTER it releases the wall", {skip: false}, () => {
  /* `finishBlock` is a closure inside `Battle`, so this is a source pin —
     bounded at the next same-indent declaration (v4.57's safer form), and
     asserting the ORDER: filed before `blockG` is emptied, the indices the
     wall still holds would be renumbered underneath it. */
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const a = src.indexOf("  const finishBlock = (s) => {");
  assert.ok(a > 0, "finishBlock moved — re-anchor this drill");
  const rest = src.slice(a + 1);
  const body = rest.slice(0, rest.search(/\n  const \w+ = /));
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "");
  const release = code.indexOf("defSide.blockG = []");
  const fileAt = code.indexOf("_EFX.fileDestroyedGear(n)");
  const wear = code.indexOf("gearBlockApply(gr)");
  assert.ok(release > 0 && wear > 0, "the wall's release and wear are both in the body");
  assert.ok(fileAt > release && fileAt > wear, "filed after the wall is released and the wear applied");
  assert.ok(code.indexOf("return foeStep(n)") > fileAt, "and before control goes back to seat 1");
});

/* ---- 5. THE CALL SITES, AS A SET -------------------------------------- */

test("the filing is called from exactly five places across three files", {skip: false}, () => {
  /* Each is a place a resolution or a combat wall ENDS. A sixth is a
     deliberate edit — and so is losing one, which the driven drills above
     and across the suite would see anyway. Comments are stripped, because
     this project's own prose names the function (v4.27, v4.32). */
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const count = f => (strip(fs.readFileSync(path.join(ROOT, f), "utf8"))
    .match(/fileDestroyedGear\(/g) || []).length;
  /* effects.js: the definition, the two entry-point wrappers, resolveStack */
  assert.equal(count("engine/effects.js"), 4);
  assert.equal(count("engine/judge.js"), 1, "strike");
  assert.equal(count("index.html"), 1, "finishBlock");
  /* the stripper's control, routed through the count: a comment naming it
     must not be counted. Built by concatenation so this file's own source
     is not the thing being tested. */
  const probe = "/* " + "fileDestroyedGear(" + " */ x";
  assert.equal((strip(probe).match(/fileDestroyedGear\(/g) || []).length, 0);
});
