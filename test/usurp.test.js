/* ============================================================
   usurp.test.js — USURP (v6.39)

   The third reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).
   CR 8.3.49 (verbatim, rules.fabtcg.com): "Usurp is a play-static ability
   that means 'As an additional cost to play this, destroy a Runechant if
   able. If you destroy a Runechant in this way, this gets +2 {p}.'"
   CR 8.3.49a: "If a player pays the additional cost to play a card with
   usurp, the player and the played card are considered to have usurped
   and Runechant that was destroyed is considered to have been usurped."

   The cards are STAGED (data/staged.js). Driven at the table:
     * with a Runechant: exactly one is destroyed AS A COST (it deals no
       arcane damage), the attack is 2 stronger, and the link says so;
     * the other Runechants still pop for 1 arcane each;
     * with none ("if able"): the card is played at its printed power;
     * a card without the keyword destroys nothing as a cost (its
       Runechant pops for arcane as always) and gains nothing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (nm, uid) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const USURPERS = ["Bloodfrenzy Gloomblade", "Cullingsong Gloomblade", "Demonbound Gloomblade",
                  "Murmuring Gloomblade", "Plundersong Gloomblade", "Vexing Gloomblade", "Runic Disposition"];
const runes = k => Array.from({length: k}, (_, i) => ({uid: "rn" + i, card: {...H.tok("Runechant"), uid: "rn" + i}}));
const runeN = sd => (sd.board || []).filter(b => b.card.name === "Runechant").length;

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
/* declare the attack and stop while the link is still open, before defence */
function declare(card, k){
  let g = table(H.state({res: 9, ap: 1, hand: [card], board: runes(k)}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  const a = {t: "play", uid: card.uid, from: "hand"};
  assert.equal(J.legal(g, a, 0), null, "the play is legal");
  const out = J.reduce(g, a, 0);
  assert.equal(out.error, null);
  g = out.state;
  for(let i = 0; i < 10 && !g.pend; i++) g = H.move(g);
  assert.ok(g.pend, "no chain link opened");
  return g;
}

test("the readers: carriers, not references; a Runechant pays, nothing else does", {skip}, () => {
  H.db();
  for(const nm of USURPERS){
    const c = staged(nm);
    assert.equal(P.usurps(c), true, nm + " carries usurp and the reader says no");
    const cl = P.fxParse(c).clauses.find(x => /^usurp/i.test(x.t));
    assert.ok(cl && cl.st !== "skip", nm + ": the keyword line is printed and reported unread");
  }
  const lust = staged("Runechant of Lust");
  assert.match(lust.tx, /usurps/i, "the fixture no longer mentions the keyword");
  assert.equal(P.usurps(lust), false, "a card that only names usurp is read as carrying it");
  assert.equal(P.usurps(H.card("Brutal Assault", 3)), false);
  assert.equal(P.usurpTarget({board: runes(2)}).uid, "rn0");
  assert.equal(P.usurpTarget({board: [{uid: "q1", card: H.tok("Quicken")}]}), null, "an aura that is not a Runechant paid the cost");
  assert.equal(P.usurpTarget({board: []}), null);
});

test("at the table: one Runechant is destroyed as a cost, the attack is 2 stronger, the rest pop", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  const none = declare(card, 0);
  assert.equal(none.pend.total, card.power, "the fixture's printed power is not what the link reads");
  assert.ok(!none.pend.usurped, "no Runechant, and the link says it usurped");
  assert.equal(none.sides[1].hp, 20);

  const one = declare(card, 1);
  assert.equal(runeN(one.sides[0]), 0, "the Runechant was not destroyed");
  assert.equal(one.pend.total, card.power + 2, "usurping did not give +2");
  assert.equal(one.pend.usurped, true);
  assert.equal(one.sides[1].hp, 20, "the usurped Runechant also dealt its arcane damage");

  const three = declare(card, 3);
  assert.equal(runeN(three.sides[0]), 0);
  assert.equal(three.pend.total, card.power + 2, "it usurped more than once");
  assert.equal(three.sides[1].hp, 18, "the two Runechants that were not usurped did not pop for 1 each");
});

test("at the table: an attack without the keyword pays nothing and gains nothing", {skip}, () => {
  const ba = {...H.card("Brutal Assault", 3), uid: "ba1"};
  assert.equal(P.usurps(ba), false, "the control carries usurp");
  const g = declare(ba, 1);
  assert.equal(g.pend.total, ba.power);
  assert.ok(!g.pend.usurped);
  assert.equal(g.sides[1].hp, 19, "the Runechant did not pop for arcane on an ordinary attack");
});

test("the +2 is real damage when the attack lands", {skip}, () => {
  const card = staged("Demonbound Gloomblade", "us1");
  let g = declare(card, 1);
  for(let i = 0; i < 40 && g.pend && !g.over; i++) g = H.move(g);
  assert.equal(g.sides[1].hp, 20 - (card.power + 2));
});

test("a play cost is paid by a PLAY: the card's own discard ability does not usurp, and CR 8.3.49a marks only a paid cost", {skip}, () => {
  H.db();
  const rd = staged("Runic Disposition", "rd1");
  assert.equal(P.usurps(rd), true);
  let g = table(H.state({res: 0, ap: 1, hand: [rd], board: runes(1)}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  assert.ok(J.legal(g, {t: "play", uid: "rd1", from: "hand"}, 0), "the fixture can afford the play, so the ability is not the only route");
  const out = J.reduce(g, {t: "activate", uid: "rd1", from: "hand"}, 0);
  assert.equal(out.error, null);
  g = out.state;
  for(let i = 0; i < 6 && (g.stack || []).length; i++) g = H.move(g);
  assert.equal(runeN(g.sides[0]), 2, "the ability destroyed a Runechant, or did not create one");
  assert.ok((g.sides[0].grave || []).some(c => c.uid === "rd1"), "the card was not discarded");
  assert.equal(g.sides[1].hp, 20);
  assert.ok(!(g.pend && g.pend.usurped), "an ability is considered to have usurped");
});
