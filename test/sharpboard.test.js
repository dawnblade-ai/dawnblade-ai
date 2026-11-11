/* test/sharpboard.test.js — SHARP PRICES THE BOARD (ship/sharp-board, census-v618 #2).

   Sharp's score (`laEval`) counted life and held cards only, and its "own" horizon ends
   before a permanent played this turn acts, so playing an ally, an aura or an item scored
   -mu and nothing else: Gravy's Sharp held a free, zero-defence ally at end of turn. With
   SPXLABOARD a permanent is worth its printed numbers (an ally its power plus half its
   defence, at least 1; any other permanent 1), the change from the root, mine minus
   theirs, at `bW` per point. Asserts on the score's terms; the gate-off run is the sabotage. */
const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");

const ally = (uid, power, def) => ({card: {uid, name: "Test Ally " + uid, power, def, tt: "Generic Action - Ally", ty: ["Generic", "Action", "Ally"]}, kind: "ally", uid, spent: true});
const aura = uid => ({card: {uid, name: "Test Aura " + uid, tt: "Generic Aura", ty: ["Generic", "Aura"]}, kind: "aura", uid});
function pair(){
  const root = H.state({hand: [{uid: "h1", name: "A"}, {uid: "h2", name: "B"}]}, {hand: [{uid: "f1", name: "C"}]}, {});
  /* the line played the ally out of hand: one card fewer held, an ally on the board */
  const end = {...root, sides: root.sides.map((sd, i) => i ? sd : {...sd, hand: sd.hand.slice(1), board: [ally("al1", 2, 0)]})};
  return {root, end};
}

test("an ally played this turn is worth its printed power (and half its defence), not only -mu", () => {
  const {root, end} = pair();
  /* the search compares lines from one root: holding the ally (the root as it stands)
     against playing it (one card fewer held, the ally on the board) */
  const hold = SP.laEval(root, 0, root), play = SP.laEval(end, 0, root);
  assert.equal(play.cards - hold.cards, -1, "one card fewer held");
  assert.equal(play.board - hold.board, 2, "a 2-power, 0-defence ally on the board");
  assert.equal(play.v - hold.v, -SP.LA.mu + SP.LA.bW * 2, "the card's price and the ally's worth");
  assert.ok(play.v > hold.v, "so playing the free ally now scores above holding it");
  assert.equal(SP.boardVal({board: [ally("a", 0, 0)]}), 1, "a permanent is worth at least 1");
  assert.equal(SP.boardVal({board: [aura("x"), aura("y")]}), 2, "any other permanent 1");
  assert.equal(SP.boardVal({board: [ally("a", 3, 4)]}), 5, "power plus half the defence");
});

test("the foe's board counts against: their new ally lowers the score by the same measure", () => {
  const {root} = pair();
  const end = {...root, sides: root.sides.map((sd, i) => i ? {...sd, board: [ally("fa", 3, 2)]} : sd)};
  assert.equal(SP.laEval(end, 0, root).board, -4);
});

test("SABOTAGE — with SPXLABOARD=none the same line scores the old way (board 0, -mu)", () => {
  const code = `const SP=require(${JSON.stringify(require.resolve("../engine/sparring.js"))});const H=require(${JSON.stringify(require.resolve("./helpers/judged.js"))});
    const ally={card:{uid:"al1",name:"T",power:2,def:0,tt:"Generic Action - Ally",ty:["Generic","Action","Ally"]},kind:"ally",uid:"al1"};
    const root=H.state({hand:[{uid:"h1",name:"A"},{uid:"h2",name:"B"}]},{hand:[{uid:"f1",name:"C"}]},{});
    const end={...root,sides:root.sides.map((sd,i)=>i?sd:{...sd,hand:sd.hand.slice(1),board:[ally]})};
    console.log(JSON.stringify([SP.laEval(root,0,root),SP.laEval(end,0,root)]));`;
  const r = spawnSync(process.execPath, ["-e", code], {env: {...process.env, SPXLABOARD: "none"}, encoding: "utf8"});
  const [hold, play] = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(play.board, 0);
  assert.equal(play.v - hold.v, -SP.LA.mu, "a held card lost and nothing for the ally: the census's -mu");
  assert.ok(play.v < hold.v, "holding scored higher: the misplay the census found");
});

test("the call names the board when it is the term that moved most", () => {
  assert.ok(SP.CALL_WHY.laBoard, "a CALL_WHY key for the board reason");
});

/* ---- a token minted under the opponent's control is its maker's (Azalea's Lace hits) ---- */
test("A DEBUFF IS THE MAKER'S — a token minted under their control carries madeBy, and the board term credits the maker", () => {
  H.db();
  const g = H.state({name: "Azalea"}, {name: "Kayo"}, {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.runOps(g, [["token", "bloodrot pox", 1, "foe"]], "Lace with Bloodrot");
  const e = (n.sides[1].board || []).find(b => b && b.kind === "token");
  assert.ok(e, "the token sits on the opponent's board");
  assert.equal(e.madeBy, 0, "stamped with the seat that made it");
  /* the score: Azalea's debuff is +1 for Azalea, not +1 for Kayo */
  const root = g, end = n;
  assert.equal(SP.laEval(end, 0, root).board - SP.laEval(root, 0, root).board, 1, "her hit's debuff counts for her");
  assert.equal(SP.laEval(end, 1, root).board - SP.laEval(root, 1, root).board, -1, "and against the seat it sits with");
  /* SABOTAGE: the same entry without the stamp reads as the victim's permanent (the v6.21 sign) */
  const bare = {...end, sides: end.sides.map((sd, i) => i ? {...sd, board: sd.board.map(b => { const {madeBy, ...r} = b; return r; })} : sd)};
  assert.equal(SP.laEval(bare, 0, root).board - SP.laEval(root, 0, root).board, -1, "unstamped it scored against the maker");
});
