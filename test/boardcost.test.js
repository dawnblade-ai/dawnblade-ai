/* ============================================================
   boardcost.test.js — WHICH PERMANENT A DESTROY COST TAKES (v6.66)

   Runebleed Robe, verbatim: "Instant - Destroy this and a Runechant you
   control: Prevent the next 1 arcane damage that would be dealt to you this
   turn." CR 1.8.8 (verbatim): "An object that counts as another object for
   the purposes of rules and effects is considered to be that object, in
   addition to its other properties." Runechant of Lust and Sloth print
   "This counts as a Runechant", so either they or a token may pay — and
   which is the player's (closes `destroy-a-runechant-cost-unasked`, open
   since v6.42).

   Driven at the table:
     * a token AND Lust: the activation asks (`boardcost`, one uid per
       different card), and the answer is the entry destroyed — both ways;
     * tokens only: nothing is asked, a token pays (as before);
     * a wire answer naming something off the offer is refused;
     * the AI answers with Lust (its destroy line pays a token; the
       token keeps its pop), through `judge.boardCostAnswer`;
     * a payment cancel takes the answer with it.
   And the trainer has the sheet (source shape: its doors are a React
   component, test/page drives cover the screen).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const SP = require("../engine/sparring.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const tokE = uid => ({uid, card: {...H.tok("Runechant"), uid}, kind: "aura"});
const lustE = uid => ({uid, card: staged("Runechant of Lust", uid), kind: "aura", sd: "turn"});
const onBoard = (sd, uid) => (sd.board || []).some(b => b.uid === uid);
const tokN = sd => (sd.board || []).filter(b => b.card.name === "Runechant").length;

/* Viserai with the Robe, at the table, on his own action phase */
function robeGame(board, seed){
  const B = require("../engine/build.js"), G = require("../engine/game.js"), RNG = require("../engine/rng.js");
  const {loadData} = require("./helpers/extract.js");
  const W = loadData(), ctr = {n: 0};
  let rng = RNG.make(seed || "boardcost");
  const h0 = W.HEROES.find(x => x.k === "viserai"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSide(h0, G.parseDeck(W.DECKS.viserai), H.db(), {chest: "Runebleed Robe"}, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  const g0 = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sides = g0.sides.slice();
  sides[0] = {...sides[0], board, res: 0};
  const robe = (sides[0].gear || []).find(x => /Runebleed/.test(x.name));
  assert.ok(robe, "fixture: the Robe is not equipped");
  return {g: {...g0, sides}, robe};
}
const settle = n => { for(let i = 0; i < 8 && ((n.stack || []).length || n.pending); i++){ if(n.pending) break; n = H.move(n); } return n; };

test("a token and Lust: the Robe asks which, and the answer is what is destroyed", {skip}, () => {
  for(const pick of ["tk", "ls"]){
    const {g, robe} = robeGame([tokE("tk"), lustE("ls")]);
    const a = {t: "activate", uid: robe.uid};
    assert.equal(J.legal(g, a, 0), null, "the activation is legal");
    let n = J.reduce(g, a, 0).state;
    assert.ok(n.pending && n.pending.kind === "boardcost", "nothing asked which Runechant pays");
    assert.deepEqual([...n.pending.uids].sort(), ["ls", "tk"], "the offer is not one uid per different card");
    assert.ok(onBoard(n.sides[0], "tk") && onBoard(n.sides[0], "ls"), "a Runechant was spent before the answer");
    assert.notEqual(J.legal(n, {t: "boardcost", uid: "nope"}, 0), null, "an answer off the offer was accepted");
    assert.notEqual(J.legal(n, {t: "pass"}, 0), null, "the question can be walked past");
    const out = J.reduce(n, {t: "boardcost", uid: pick}, 0);
    assert.equal(out.error, null);
    n = settle(out.state);
    const other = pick === "tk" ? "ls" : "tk";
    assert.ok(!onBoard(n.sides[0], pick), pick + " was named and not destroyed");
    if(pick === "ls"){
      /* the token stays, and Lust's "When this is destroyed" makes another */
      assert.ok(onBoard(n.sides[0], other), "the token went too");
      assert.equal(tokN(n.sides[0]), 2, "Lust's destroy line did not pay");
    } else {
      assert.ok(onBoard(n.sides[0], other), "Lust went too");
      assert.equal(tokN(n.sides[0]), 0, "a token is left over");
    }
    assert.equal(n._destroyUid, undefined, "the answer outlived the activation");
  }
});

test("tokens only: nothing to choose, nothing asked, a token pays", {skip}, () => {
  const {g, robe} = robeGame([tokE("t1"), tokE("t2")]);
  let n = J.reduce(g, {t: "activate", uid: robe.uid}, 0).state;
  assert.ok(!n.pending || n.pending.kind !== "boardcost", "a board of identical tokens asked a question");
  n = settle(n);
  assert.equal(tokN(n.sides[0]), 1, "exactly one token pays");
  assert.equal(P.boardCostOffer({_destroyBoard: "Runechant"}, {board: [tokE("a"), tokE("b")]}), null);
  assert.equal(P.boardCostOffer({_destroyBoard: "Gold"}, {board: [tokE("a"), lustE("b")]}), null, "a Runechant paid for a Gold");
  assert.equal(P.boardCostOffer(null, {board: [tokE("a"), lustE("b")]}), null);
});

test("the AI spends Lust, and its call says why", {skip}, () => {
  /* the token's uid sorts FIRST, so a tie-break alone would spend it */
  const {g, robe} = robeGame([tokE("a-tok"), lustE("z-lust")]);
  const n = J.reduce(g, {t: "activate", uid: robe.uid}, 0).state;
  assert.equal(J.boardCostAnswer(n), "z-lust", "the policy spent the token, losing its pop and Lust's payout");
  const a = SP.act(n, 0);
  assert.deepEqual(a, {t: "boardcost", uid: "z-lust"});
  assert.equal(J.legal(n, a, 0), null, "the policy's answer is refused");
  assert.ok(SP.CALL_WHY.boardcost, "no reason for the call");
});

test("a cancelled payment takes the answer with it", {skip}, () => {
  const {g, robe} = robeGame([tokE("tk"), lustE("ls")]);
  const n = {...g, _destroyUid: "ls", pending: {kind: "pay", seat: 0, card: robe, from: "gear", need: 1, target: null}};
  const out = J.reduce(n, {t: "payCancel"}, 0);
  assert.equal(out.error, null);
  assert.equal(out.state._destroyUid, undefined, "a cancel kept the answer for the next activation");
  assert.ok(J.PENDING_KINDS.includes("boardcost") && J.ACTIONS.includes("boardcost"));
});

test("both boards ask: the table's sheet and the trainer's door", () => {
  const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(HTML, /const boardcost = kindIs\("boardcost"\);/, "the table's demux has no branch for the question");
  assert.match(HTML, /fire\(\{t:"boardcost",uid:u\}\)/, "the table's button answers with the wrong action");
  assert.match(HTML, /g\.mode==="boardpick" \? \(<>/, "the trainer's action bar has no buttons for the question");
  assert.equal((HTML.match(/askBoardCost\(s, card, from, idx(?:, "instant")?\)/g) || []).length, 2,
    "the trainer's two activation doors do not both ask");
  assert.match(HTML, /DawnParser\.boardCostOffer\(card, act\(s\)\)/, "the trainer asks its own reader, not the shared one");
});
