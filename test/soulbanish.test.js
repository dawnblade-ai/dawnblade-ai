/* ============================================================
   soulbanish.test.js — A SOUL BANISH GOES TO THE BANISHED ZONE,
   AND "PUT INTO YOUR SOUL THIS TURN" IS AN EVENT (v5.40)

   QUEUE v4 S8. Boltyn's ability ("Attack Reaction - Banish a card from
   your soul: …") sliced the card off the soul into NO zone, and
   `soulSpend` had the same shape. invariants.js catches a card in two
   zones and cannot see one in none. And Duty Bound Blitz's "a yellow card
   has been put into your soul this turn" asked whether one was STILL in
   the soul, so charging a yellow and banishing it to that ability shut the
   gate. `tools/selfplay.js` now reports a card that leaves every zone
   (`NO-ZONE`), which is how this family stops recurring.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const S = require("../engine/sides.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const SPL = require("../tools/selfplay.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

let _b = null;
function boltyn(){
  if(_b) return _b;
  const W = loadData();
  _b = B.buildSide(W.HEROES.find(x => x.k === "boltyn"), G.parseDeck(W.DECKS.boltyn), H.db(), {},
                   RNG.make("soulbanish"), {n: 0}).b;
  return _b;
}
let _u = 98000;
const mk = (nm, p) => Object.assign({}, H.card(nm, p), {uid: ++_u});

/* Bolt of Courage charges `charge`, then Boltyn's ability banishes a soul card */
function chargeThenBanish(charge, soul){
  const b = boltyn();
  const bolt = mk("Bolt of Courage", 1);
  let g = H.state({hand: [bolt, charge], res: 9, ap: 1, soul: soul || []}, {hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  g = Object.assign({}, g, {_chargeUids: [charge.uid]});
  const charged = H.execute(g, bolt, "hand", 0, {});
  return {charged, after: H.execute(charged, b.HPOW, "hero", 0, {}), bolt};
}

/* ---- 1. THE ZONE ----------------------------------------------------------- */

test("DRIVEN: Boltyn's soul cost puts the card in the BANISHED zone", {skip}, () => {
  const yel = mk("Raging Onslaught", 2);
  const {charged, after} = chargeThenBanish(yel);
  assert.ok(charged.sides[0].soul.some(c => c.uid === yel.uid), "fixture: the yellow was charged");
  assert.equal(after.sides[0].soul.some(c => c.uid === yel.uid), false, "it left the soul");
  assert.ok(after.sides[0].banish.some(c => c.uid === yel.uid),
    "the banished soul card is in no zone — it never reached the banished zone");
});

test("DRIVEN: soulSpend banishes the cards it spends", {skip}, () => {
  const a = mk("Raging Onslaught", 1), b = mk("Raging Onslaught", 3);
  const g = H.state({soul: [a, b]}, {}, {actor: 0, turn: 3});
  const n = H.runOps(g, [["soulSpend", 1, []]], "Test");
  assert.deepEqual(n.sides[0].soul.map(c => c.uid), [b.uid]);
  assert.deepEqual(n.sides[0].banish.map(c => c.uid), [a.uid], "the spent soul card went nowhere");
});

/* ---- 2. THE EVENT ---------------------------------------------------------- */

test("DRIVEN: a yellow charged and then banished still opens Duty Bound Blitz", {skip}, () => {
  const dbb = H.card("Duty Bound Blitz", 1);
  const {charged, after} = chargeThenBanish(mk("Raging Onslaught", 2));
  assert.equal(E.playIfOk(charged, dbb), true, "control: charged, the gate is open");
  assert.equal(after.sides[0].soul.length, 0, "fixture: the soul is empty again");
  assert.equal(E.playIfOk(after, dbb), true,
    "the gate read the soul's CONTENTS — a yellow was put in this turn and banished since");
});

test("DRIVEN: it stays shut when no yellow was put in this turn", {skip}, () => {
  const dbb = H.card("Duty Bound Blitz", 1);
  /* a RED charge, and a yellow already sitting in the soul from before */
  const old = mk("Raging Onslaught", 2);
  const {after} = chargeThenBanish(mk("Raging Onslaught", 1), [old]);
  assert.ok(after.sides[0].soul.some(c => c.uid === old.uid), "fixture: an old yellow is in the soul");
  assert.equal(E.playIfOk(after, dbb), false, "a red put in, or a yellow from an earlier turn, opened it");
});

test("the event record starts every turn empty", () => {
  assert.deepEqual(S.freshHist().soulPut, [], "CR 4.4.4 clears hist, so the record must live there");
});

/* ---- 3. THE INSTRUMENT ------------------------------------------------------ */

const sd = o => Object.assign({hand: [], deck: [], grave: [], pitch: [], banish: [], soul: [], board: [], gear: [], arsenal: null}, o);
const gm = (a, o) => Object.assign({sides: [sd(a), sd({})], chainCards: [], stack: []}, o || {});
const C = (uid, extra) => Object.assign({uid, name: "Card " + uid, ty: ["Generic", "Action"]}, extra || {});

test("NO-ZONE: a card held in one state and in no zone in the next is lost", () => {
  const c = C(1);
  assert.deepEqual(SPL.lostCards(gm({soul: [c]}), gm({})).map(x => x.uid), [1]);
  assert.deepEqual(SPL.lostCards(gm({soul: [c]}), gm({banish: [c]})), [], "moved, not lost");
  assert.deepEqual(SPL.lostCards(gm({hand: [c]}), gm({}, {chainCards: [{card: c}]})), [], "the chain is a zone");
  assert.deepEqual(SPL.lostCards(gm({hand: [c]}), gm({}, {stack: [{k: "play", lifted: true, card: c}]})), [],
    "a lifted play is on the stack");
  assert.deepEqual(SPL.lostCards(gm({hand: [c]}), gm({intimidated: [c]})), [], "intimidate holds it until the end phase");
});

test("NO-ZONE: a token, an ephemeral card and a finished game are not faults", () => {
  const tok = C(2, {ty: ["Generic", "Token", "Aura"]});
  assert.deepEqual(SPL.lostCards(gm({board: [{card: tok, uid: 2}]}), gm({})), [], "a token ceases to exist");
  const eph = C(3, {kw: ["Ephemeral"], tx: "Ephemeral"});
  assert.deepEqual(SPL.lostCards(gm({hand: [eph]}), gm({})), [], "an ephemeral card ceases to exist");
  assert.deepEqual(SPL.lostCards(gm({hand: [C(4)]}), gm({}, {over: {winner: 0}})), [], "the game ended");
  assert.deepEqual(SPL.lostCards(gm({hand: [C(5)]}), gm({})).length, 1, "control: an ordinary card is lost");
});

test("NO-ZONE is a FAULT, and it names the card and the action", () => {
  assert.ok(SPL.FAULTS.includes("NO-ZONE"));
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "tools", "selfplay.js"), "utf8");
  assert.match(src, /events\.push\(\["NO-ZONE", `\$\{c\.name\}#\$\{c\.uid\} left every zone after \$\{a\.t\}`\]\)/);
});

test("DRIVEN: a transcended card keeps its uid as Inner Chi", {skip}, () => {
  /* The back face of every transcend printing IS Inner Chi; a fresh uid made
     the card leave every zone under its own identity. */
  const drop = mk("A Drop in the Ocean", 3);
  const g = H.state({hand: [drop], res: 9, ap: 1, hist: Object.assign(S.freshHist(), {blue: 1})}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, drop, "hand", 0, {});
  const chi = n.sides[0].hand.find(c => c.name === "Inner Chi");
  assert.ok(chi, "fixture: it transcended");
  assert.equal(chi.uid, drop.uid);
  assert.deepEqual(SPL.lostCards(g, n), []);
});
