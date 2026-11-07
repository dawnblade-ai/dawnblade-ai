/* ============================================================
   "INTIMIDATE TARGET HERO" ON A NON-ATTACK RUNS (S-2, QA-A, v5.85).

   Sadistic Scowl: "Your next attack this turn gets +5{p}. / Intimidate
   target hero. / Go again". The clause parsed as a NOOP whose text described
   the trainer dummy, and nothing ran: the opposing hand kept every card.
   CR 8.5.10 (verbatim, rules.fabtcg.com): "To intimidate a player, they
   banish a random card from their hand face-down, and then at the beginning
   of the end phase, it returns it to their hand." CR 8.5.10a: "The player is
   considered to have been intimidated, even if they did not banish a card
   from their hand." CR 8.5.10b: "If a player is not specified, the intimidate
   is a targeted effect." One body, `effects.intimidateFoe`, for the keyword on an
   attack and for this op; both boards resolve card text through it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const blank = (uid) => ({uid, name: "Hand card " + uid, tt: "Generic Action - Attack", pitch: 1, cost: 0, power: 1, def: 2, tx: "", kw: []});

test("the clause is an op, and no feed text names the dummy", () => {
  const r = P.classifyClause("intimidate target hero");
  assert.deepEqual(r.ops, [["intimidate"]]);
});

test("DRIVEN: Sadistic Scowl banishes one opposing hand card face-down, and it comes back", {skip}, () => {
  H.db();
  const scowl = {...H.card("Sadistic Scowl", 1), uid: 50};
  assert.ok(/intimidate target hero/i.test(scowl.tx || ""), "the fixture must print the clause");
  const g = H.state({res: 9, ap: 1}, {hand: [blank(1), blank(2), blank(3)]}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = H.execute(g, scowl, "hand");
  const foe = out.sides[1];
  assert.equal(foe.hand.length, 2, "one card leaves the opposing hand");
  assert.equal((foe.intimidated || []).length, 1, "…face-down into the intimidate pile");
  const all = [...foe.hand, ...foe.intimidated].map(c => c.uid).sort();
  assert.deepEqual(all, [1, 2, 3], "and it is one of THEIR cards, nothing minted or lost");
  assert.equal(out.sides[0].hand.length, 0, "the caster's own hand is untouched");
  const back = E.beginEndPhase(out, 0).game.sides[1];
  assert.equal(back.hand.length, 3, "CR 8.5.10: it returns at the beginning of the end phase");
  assert.deepEqual(back.intimidated, []);
});

test("an empty opposing hand: nothing to banish, nothing breaks (CR 8.5.10a)", {skip}, () => {
  H.db();
  const scowl = {...H.card("Sadistic Scowl", 1), uid: 51};
  const g = H.state({res: 9, ap: 1}, {hand: []}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = H.execute(g, scowl, "hand");
  assert.deepEqual(out.sides[1].hand, []);
  assert.deepEqual(out.sides[1].intimidated || [], []);
});
