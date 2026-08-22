/* ============================================================
   AN EFFECT ARMED AGAINST THEIR NEXT TURN

   Five pool names print a crush rider that reaches forward, and all
   five refused until v3.29 because there was no schedule to fire on —
   the honest refusal v3.16 recorded. `nextTurn` on the side is that
   schedule.

   WHY IT NEEDED A NEW FIELD. `hist` is the natural home for a per-turn
   fact and is CLEARED for the incoming seat at CR 4.4.4 — which is the
   exact moment such an effect has to survive.

   THE LIFECYCLE IS THE RULE:
     armed        created on MY turn, does nothing yet
     ready        turned on at the start of THEIR turn
     spent        consumed by the FIRST attack / FIRST action
     expired      dropped at the end of that turn, fired or not
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const E = require("../engine/effects.js");
const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const atk = (u, pw) => ({name: "Swing" + u, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: pw, pitch: 1, cost: 0, uid: u});
const nonAtk = u => ({name: "Ritual" + u, tt: "Runeblade Action",
  ty: ["Runeblade", "Action"], tx: "", kw: [], cost: 2, pitch: 1, uid: u});

const armedOnFoe = ops => {
  P.fxReset();
  let g = H.state({}, {}, {turn: 3});
  g.builds = [{}, {}];
  return H.runOps(g, ops, "Debilitate");
};

/* ---- 1. it does NOT fire on the turn it was created ---------------- */

test("armed is not live — an effect for their NEXT turn waits", {skip: false}, () => {
  const g = armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]);
  assert.equal(g.sides[1].nextTurn.length, 1, "it lands on the FOE, not the actor");
  assert.equal(g.sides[1].nextTurn[0].ready, false);
  assert.equal(P.nextTurnDebuff(g.sides[1], "firstAtkMinus"), 0,
    "unarmed it reads as nothing — firing now would be a whole turn early");
  assert.equal((g.sides[0].nextTurn || []).length, 0, "the actor arms nothing on themselves");
});

test("arming at the start of their turn turns it on", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  assert.equal(P.nextTurnDebuff(g.sides[1], "firstAtkMinus"), 2);
});

/* ---- 2. Debilitate — the FIRST attack, and only the first --------- */

test("their first attack is weaker by the printed amount; the second is not", () => {
  let g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  g.actor = 1; g.builds = [{}, {}]; g.sides[1].res = 9; g.sides[1].ap = 1;

  const first = H.execute(g, atk("s1", 6), "hand", 0, {});
  assert.equal(first.pend.total, 4, "6 printed, 2 off — the crush still tells");

  const mid = {...first, actor: 1, builds: [{}, {}], pend: null, stack: []};
  mid.sides = first.sides.slice();
  mid.sides[1] = {...first.sides[1], res: 9, ap: 1};
  const second = H.execute(mid, atk("s2", 6), "hand", 0, {});
  assert.equal(second.pend.total, 6,
    "the SECOND attack is untouched — a whole-turn debuff is stronger than printed");
});

/* ---- 3. Cartilage Crush — the FIRST action, and only the first ---- */

test("their first action costs an extra {r}; the next does not", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstActionTax", 1]]), 1).game;
  assert.equal(P.effCost(nonAtk("a"), g.sides[1]), 3, "printed 2, taxed to 3");

  /* the tax is spent at the CHARGE, never at the affordability check —
     `effCost` is read twice and only one of those reads takes resources */
  let play = {...g, actor: 1, builds: [{}, {}]};
  play.sides = g.sides.slice();
  play.sides[1] = {...g.sides[1], res: 9, ap: 1};
  const after = H.execute(play, nonAtk("a"), "hand", 0, {});
  assert.equal(after.sides[1].res, 6, "9 - (2 printed + 1 tax)");
  assert.equal(P.effCost(nonAtk("b"), after.sides[1]), 2, "and the tax is spent");
});

/* ---- 4. it expires with the turn, fired or not -------------------- */

test("it is dropped at the end of that turn even if it never fired", () => {
  const g = E.armNextTurn(armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]), 1).game;
  const out = E.beginEndPhase(g, 1);
  assert.deepEqual(out.game.sides[1].nextTurn, [],
    "'their FIRST attack during their next turn' — if they never attacked it is spent all the same");
});

test("an effect armed DURING this turn survives it — it is aimed at the next", () => {
  /* only entries that were ready for THIS turn expire. One created here is
     for the turn after, and dropping it would delete the card's whole
     effect the moment it was played. */
  const g = armedOnFoe([["foeNextTurn", "firstAtkMinus", 2]]);   /* ready:false */
  const out = E.beginEndPhase(g, 1);
  assert.equal(out.game.sides[1].nextTurn.length, 1, "still armed for next turn");
  assert.equal(out.game.sides[1].nextTurn[0].ready, false);
});

/* ---- 5. BOTH BOARDS arm it ---------------------------------------- */

test("both boards call armNextTurn at the top of the turn", () => {
  /* A schedule is written per board — the field and the reader existing is
     not the same as something turning it on. Comments stripped: a grep is
     satisfied by a comment, in both directions. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const jud = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8"));
  const htm = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
  assert.match(jud, /E\.armNextTurn\(n, inc\)/, "judge must arm the incoming seat");
  assert.match(htm, /DawnEffects\.armNextTurn\(n, 0\)/, "the trainer must arm its seat too");
});

/* ---- 6. the side field is carried everywhere a side is ------------ */

test("nextTurn is a real side field, serialized and reported", () => {
  const S = require("../engine/sides.js");
  assert.ok(S.SIDE_FIELDS.includes("nextTurn"), "or invariants reports SIDES-ASYMMETRIC");
  const W = fs.readFileSync(path.join(__dirname, "..", "engine", "wire.js"), "utf8");
  assert.match(W, /"nextTurn"/, "a field the wire drops is a desync waiting to happen");
  const R = fs.readFileSync(path.join(__dirname, "..", "engine", "report.js"), "utf8");
  assert.match(R, /nextTurn/, "a report that omits state is worse than no report");
});
