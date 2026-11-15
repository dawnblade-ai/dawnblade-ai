/* ============================================================
   banroute.test.js — "YOU MAY PLAY THIS FROM YOUR BANISHED ZONE" (v6.37)

   The first reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md). His
   six Gloomblades print the line; the cards are STAGED (data/staged.js),
   not in the pool, so nobody can be dealt one yet and this drill builds
   them from the staged records.

   The route itself is old: `parser.playZoneWhy` has asked `fx.fromBan`
   since v3.00, and no pool card ever set it. So what is driven here is
   that the first card to print the line really does play from banish at
   the table, ONCE, and that the permission is the card's own:
     * it files to the graveyard (RULING, user, 2026-10-31), turn-stamped;
     * it is refused from the graveyard, where nothing lets it be played;
     * a card that does not print the line is refused from banish;
     * a card that only TALKS about banished-zone plays (the Gate token)
       does not grant itself the route.
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
const GLOOM = ["Bloodfrenzy Gloomblade", "Cullingsong Gloomblade", "Demonbound Gloomblade",
               "Murmuring Gloomblade", "Plundersong Gloomblade", "Vexing Gloomblade"];

const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
function settle(g){
  for(let i = 0; i < 40; i++){
    if(g.phase === "action" && g.step === "layer" && g.priority === 0 && !g.pend
       && !g.prompt && !(g.stack || []).length) return g;
    g = H.move(g);
  }
  return g;
}

test("the six Gloomblades read the line, and the clause says so", () => {
  for(const nm of GLOOM){
    const c = staged(nm), fx = P.fxParse(c);
    assert.equal(fx.fromBan, true, nm + " does not grant itself the banished-zone route");
    const cl = fx.clauses.find(x => /^you may play this from your banished zone/i.test(x.t));
    assert.ok(cl, nm + " lost the printed line");
    assert.equal(cl.st, "run", nm + ": the line is printed and reported unread");
    assert.equal(P.playZoneWhy(c, "banish", {turn: 3}), null, nm + " is refused from banish");
    assert.ok(P.playZoneWhy(c, "grave", {turn: 3}), nm + " is playable from the graveyard");
  }
});

test("a card that only talks about banished-zone plays does not grant itself the route", () => {
  /* the Gate lets ANOTHER card be played from banish; it is a token and is never played */
  const gate = staged("Gate to i'Arathael");
  assert.match(gate.tx, /from your banished zone/i, "the fixture no longer mentions the zone");
  assert.ok(!P.fxParse(gate).fromBan, "the Gate grants itself the route");
  assert.ok(P.playZoneWhy(gate, "banish", {turn: 3}));
});

test("at the table: a banished Gloomblade is played once, lands in the graveyard, and is not played from there", {skip}, () => {
  H.db();
  const gb = staged("Demonbound Gloomblade", "gb1");
  let g = table(H.state({res: 9, ap: 1, hand: [], banish: [gb]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}));
  const PLAY = {t: "play", uid: "gb1", from: "banish"};
  assert.equal(J.legal(g, PLAY, 0), null, "the play from banish is legal");
  const out = J.reduce(g, PLAY, 0);
  assert.equal(out.error, null);
  g = settle(out.state);
  assert.ok(!(g.sides[0].banish || []).some(c => c.uid === "gb1"), "it left the banished zone");
  const gone = (g.sides[0].grave || []).find(c => c.uid === "gb1");
  assert.ok(gone, "it is in the graveyard");
  assert.equal(gone._gy, g.turn, "turn-stamped");
  assert.ok(g.sides[1].hp < 20, "and the attack was a real attack: it dealt damage");
  assert.ok(J.legal(g, PLAY, 0), "a second play from banish is refused: it is not there");
  assert.ok(J.legal({...g, sides: [{...g.sides[0], ap: 1, res: 9}, g.sides[1]]}, {t: "play", uid: "gb1", from: "grave"}, 0),
    "and nothing lets it be played from the graveyard");
});

test("at the table: an attack that does not print the line is refused from banish", {skip}, () => {
  H.db();
  const ba = {...H.card("Brutal Assault", 3), uid: "ba1"};
  assert.ok(!P.fxParse(ba).fromBan, "the control prints the line");
  const g = table(H.state({res: 9, ap: 1, hand: [], banish: [ba]}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}));
  assert.ok(J.legal(g, {t: "play", uid: "ba1", from: "banish"}, 0), "a card with no permission played from banish");
});
