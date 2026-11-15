/* ============================================================
   blooddebt.test.js — BLOOD DEBT (v6.38)

   The second reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md).
   CR 8.3.11 (verbatim, rules.fabtcg.com): "Blood Debt is a triggered-static
   ability. Blood debt means 'While this is in your banished zone, at the
   beginning of your end phase, lose 1 {h}.'"

   The cards are STAGED (data/staged.js), not in the pool, so this drill
   builds them from the staged records. What is driven:
     * the reader counts CARRIERS, not references (the Gate token says
       "with blood debt" and owes nothing);
     * one life per card, at the OWNER's end phase only, from the banished
       zone only (hand, graveyard and the other seat's turn owe nothing);
     * it is life loss: a prevention shield does not stop it;
     * a hero at 0 has lost, at the table, before the turn is handed over;
     * the shared body is what both boards call.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
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
const DEBTORS = ["Bloodfrenzy Gloomblade", "Cullingsong Gloomblade", "Demonbound Gloomblade",
                 "Murmuring Gloomblade", "Plundersong Gloomblade", "Vexing Gloomblade"];

const table = (g, seat) => ({...g, phase: "action", step: "layer", priority: seat || 0, passed: []});
/* pass until the turn has been handed over or the game is over */
function endTurn(g, seat){
  const t0 = g.turn;
  let out = J.reduce(g, {t: "endTurn"}, seat);
  assert.equal(out.error, null);
  g = out.state;
  for(let i = 0; i < 40 && !g.over && g.turn === t0; i++) g = H.move(g);
  return g;
}

test("the reader counts carriers, not references", () => {
  for(const nm of DEBTORS){
    const c = staged(nm);
    assert.equal(P.bloodDebt([c]).length, 1, nm + " carries the keyword and owes nothing");
    const cl = P.fxParse(c).clauses.find(x => /^blood debt/i.test(x.t));
    assert.ok(cl, nm + " lost the printed line");
    assert.notEqual(cl.st, "skip", nm + ": the keyword line is printed and reported unread");
  }
  const gate = staged("Gate to i'Arathael");
  assert.match(gate.tx, /blood debt/i, "the fixture no longer mentions the keyword");
  assert.equal(P.bloodDebt([gate]).length, 0, "a card that only names blood debt owes life");
  assert.equal(P.bloodDebt([staged("Runic Disposition")]).length, 0, "a Viserai card without the keyword owes life");
  assert.equal(P.bloodDebt(null).length, 0);
});

test("the shared end phase: one life per banished carrier, only its owner, only from banish", {skip}, () => {
  H.db();
  const a = staged("Demonbound Gloomblade", "bd1"), b = staged("Vexing Gloomblade", "bd2"),
        c = staged("Murmuring Gloomblade", "bd3"), d = staged("Cullingsong Gloomblade", "bd4"),
        gate = staged("Gate to i'Arathael", "gt1");
  const g = H.state({hp: 20, hand: [c], grave: [d], banish: [a, gate, b]}, {hp: 20, banish: []}, {turn: 3});
  const mine = E.beginEndPhase(g, 0, H.db());
  assert.equal(mine.game.sides[0].hp, 18, "two carriers in banish: two life");
  assert.equal(mine.game.sides[1].hp, 20, "the other seat paid");
  assert.equal(mine.game.sides[0].banish.length, 3, "the cards stay banished: the debt comes due again");
  const theirs = E.beginEndPhase(g, 1, H.db());
  assert.equal(theirs.game.sides[0].hp, 20, "it was billed at the OTHER seat's end phase");
  assert.equal(theirs.game.sides[1].hp, 20);
  /* and it comes due every turn it is left there */
  assert.equal(E.beginEndPhase(mine.game, 0, H.db()).game.sides[0].hp, 16);
});

test("CR 8.3.11a: a card banished face-down is not public and owes nothing", {skip}, () => {
  /* "Blood debt only triggers if its source is public in the banished zone
     at the beginning of the owner's end phase." The one face-down banish
     this engine has is intimidate's, held apart from the zone. */
  H.db();
  const a = staged("Demonbound Gloomblade", "bd1");
  const g = H.state({hp: 20, banish: [], intimidated: [a]}, {hp: 20}, {turn: 3});
  const out = E.beginEndPhase(g, 0, H.db());
  assert.equal(out.game.sides[0].hp, 20, "a face-down banished card billed its owner");
  assert.ok(out.game.sides[0].hand.some(c => c.uid === "bd1"), "the fixture's card was not the intimidated one");
  /* the control: the same card, face-up in the zone, does */
  assert.equal(E.beginEndPhase(H.state({hp: 20, banish: [a]}, {hp: 20}, {turn: 3}), 0, H.db()).game.sides[0].hp, 19);
});

test("it is life loss, not damage: a prevention shield does not stop it", {skip}, () => {
  H.db();
  const a = staged("Demonbound Gloomblade", "bd1");
  const shield = [{n: 3, src: "a shield"}];
  const g = H.state({hp: 20, banish: [a], wardNext: shield}, {hp: 20}, {turn: 3});
  assert.deepEqual(g.sides[0].wardNext, shield, "the fixture's shield was not armed");
  /* the control: the same shield DOES stop 1 damage, and is spent doing it */
  const hit = H.runOps(g, [["dmgSelf", 1]], "a control");
  assert.equal(hit.sides[0].hp, 20, "the fixture's shield stops nothing");
  assert.equal((hit.sides[0].wardNext || []).length, 0, "the control did not spend the shield");
  const out = E.beginEndPhase(g, 0, H.db());
  assert.equal(out.game.sides[0].hp, 19, "the shield swallowed a life loss");
  /* (the shield itself is gone afterwards either way: "this turn" expires in this same end phase) */
});

test("at the table: the debt is paid as the turn ends, and the turn goes on", {skip}, () => {
  H.db();
  const a = staged("Demonbound Gloomblade", "bd1");
  let g = table(H.state({hp: 20, hand: [], banish: [a]}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  g = endTurn(g, 0);
  assert.equal(g.over, undefined);
  assert.equal(g.sides[0].hp, 19);
  assert.equal(g.turnPlayer, 1, "the turn was not handed over");
});

test("at the table: a hero whose last life is owed has lost before the handoff", {skip}, () => {
  H.db();
  const a = staged("Demonbound Gloomblade", "bd1");
  let g = table(H.state({hp: 1, hand: [], banish: [a]}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  g = endTurn(g, 0);
  assert.ok(g.over, "a hero at 0 life plays on");
  assert.equal(g.over.winner, 1);
  assert.equal(g.over.how, "life");
  assert.equal(g.turn, 3, "the next turn began for a hero who had lost");
  /* the control: at 2 life the same end phase is survived */
  let h = table(H.state({hp: 2, hand: [], banish: [a]}, {hp: 20, hand: []}, {actor: 0, turnPlayer: 0, turn: 3}));
  h = endTurn(h, 0);
  assert.ok(!h.over);
  assert.equal(h.sides[0].hp, 1);
});
