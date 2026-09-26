/* ============================================================
   SPELLVOID X — "WHERE X IS THE NUMBER OF CHAIN LINKS YOU CONTROL" (v4.75)

   Mask of the Swarming Claw, Fai's Head piece, and the pool's only
   printing. Refused since v2.32 on the grounds that "the chain belongs to
   the ATTACKER rather than to the hero being hit" — true, and exactly
   what "you CONTROL" answers: every link on a chain is the turn-player's,
   so X is the wearer's links while they are attacking, and 0 on the
   opponent's turn.

   THE COUNT IS THE GAME'S, taken when the arcane damage is dealt
   (`parser.linksControlled`), never stored in the parse — `fxParse`
   memoizes on `name|pitch` (v3.39).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const LINE = "spellvoid x, where x is the number of chain links you control";

/* ---- 1. THE READER --------------------------------------------------------- */

test("the where-clause is accounted for, in the player's voice", () => {
  const r = P.classifyClause(LINE);
  assert.ok(r && r.status === "noop");
  assert.doesNotMatch(r.ops[0][1], /dummy|v\d|\.js|linksControlled|arcaneSoaks/,
    "a noop's reason is printed into the feed (v4.24)");
});

test("only the printed where-clause makes an X a link count", () => {
  const card = tx => ({name: "Probe Hood", tt: "Generic Equipment - Head", ty: ["Generic", "Equipment"],
                       kw: ["Spellvoid X"], tx, uid: "h"});
  assert.equal(P.spellvoidX(card("Spellvoid X, where X is the number of chain links you control.")), true);
  assert.equal(P.spellvoidX(card("Spellvoid X, where X is the number of cards in your hand.")), false,
    "a different X was read as a chain-link count");
  assert.deepEqual(P.arcaneSoaks({gear: [card("Spellvoid X, where X is the number of cards in your hand.")]},
    {links: 3}), [], "an X nothing reads was offered at the link count");
  /* a PRINTED Spellvoid N is not an X, whatever its text */
  assert.equal(P.spellvoidX({...card("Spellvoid X, where X is the number of chain links you control."),
                             kw: ["Spellvoid 2"]}), false);
});

test("the links a seat controls: the resolved ones and the one being answered", () => {
  const strip = [{kind: "atk"}, {kind: "arc"}, {kind: "atk"}];
  assert.equal(P.linksControlled({turnPlayer: 0, chain: strip, pend: {by: 0}}, 0), 3,
    "two resolved attack links and the one being answered — an arcane entry is not a link");
  assert.equal(P.linksControlled({turnPlayer: 0, chain: strip, pend: {by: 0}}, 1), 0,
    "the defender controls no chain link");
  assert.equal(P.linksControlled({turnPlayer: 0, chain: strip}, 0), 2, "no attack being answered");
  assert.equal(P.linksControlled({turnPlayer: 1, chain: [], pend: {by: 1}}, 1), 1,
    "a chain's first link counts from its declaration (CR 7.2)");
  assert.equal(P.linksControlled(null, 0), 0);
});

/* ---- 2. DRIVEN THROUGH AN ARCANE HIT ---------------------------------------- */

function hit(turnPlayer, links, res){
  H.db();
  const mask = {...H.card("Mask of the Swarming Claw", 0), uid: "mk"};
  let g = H.state({hp: 20, gear: [mask], res: res == null ? 1 : res, hand: []}, {hp: 20, res: 9},
                  {turn: 3, actor: 1, turnPlayer});
  const chain = Array.from({length: links}, () => ({kind: "atk"}));
  g = {...g, pend: {by: turnPlayer, total: 3, card: {name: "Probe Swing"}}, chain};
  return J.openPrompt(H.runOps(g, [["arcane", 3]], "Probe Bolt"));
}

test("on the wearer's own turn the Spellvoid is the links they control", {skip}, () => {
  const n = hit(0, 1);
  assert.ok(n.prompt && n.prompt.tag === "soak", "no soak sheet was raised");
  assert.deepEqual(n.prompt.options.map(o => o.kind + " " + o.amount).sort(), ["barrier 1", "spellvoid 2"]);
});

test("paying it prevents X and destroys the Mask", {skip}, () => {
  let n = hit(0, 1, 0);
  const i = n.prompt.options.findIndex(o => o.kind === "spellvoid");
  n = J.reduce(n, {t: "promptSel", i}, 0).state;
  n = J.reduce(n, {t: "promptConfirm"}, 0).state;
  assert.equal(n.sides[0].hp, 19, "3 arcane, 2 prevented — X was not what was paid");
  assert.ok(n.sides[0].gear.every(x => x.uid !== "mk" || x.destroyed), "the Mask survived its own Spellvoid");
});

test("on the OPPONENT's turn X is 0, and only the barrier is offered", {skip}, () => {
  const n = hit(1, 3);
  assert.deepEqual(((n.prompt || {}).options || []).map(o => o.kind), ["barrier"],
    "the wearer was credited with links the attacker controls");
});
