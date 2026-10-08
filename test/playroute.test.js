/* ============================================================
   A CARD PLAYED, NOT AN ABILITY ACTIVATED (v5.05)

     "Whenever you PLAY a Runeblade card, if you've played another
      NON-ATTACK ACTION CARD this turn, create a Runechant token." — VISERAI
     "The second time you PLAY a non-attack action card each turn, create
      an Embodiment of Lightning token."                          — BRIAR

   `execute` is reached by every route, and both clauses were answered off
   routes that play nothing. Driven:

     * Reaping Blade's SWING fired the rite — a weapon is activated;
     * `hist.non` counted every non-attack that resolved, so Blossom of
       Spring's ABILITY and Arcane Polarity (an INSTANT) each satisfied
       "another non-attack action card".

   `parser.isCardPlay(from)` reads the route off an allow-list of play
   zones, and `isNonAtkActionPlay(card, from, half)` the type of what was
   played — for a split card, the HALF it was played as.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const B = require("../engine/build");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const runes = g => P.runeCount(g.sides[0]);

function viserai(o){
  const g = H.state(Object.assign({res: 9, ap: 3, name: "Viserai"}, o || {}), {hp: 20},
                    {turn: 3, actor: 0, turnPlayer: 0});
  g.builds = [{viseraiPassive: true}, {}];
  return g;
}

test("the READER: the play zones are an allow-list, and the activation routes are not in it", () => {
  assert.deepEqual(P.PLAY_ROUTES, ["hand", "arsenal", "grave", "banish"]);
  for(const r of ["weapon", "ally", "aura", "hero", "board"])
    assert.equal(P.isCardPlay(r), false, r + " is an activation route");
  assert.equal(P.isCardPlay(undefined), false, "a route nobody named plays nothing");
});

test("VISERAI: a weapon SWING does not fire the rite — and playing a Runeblade card does", {skip}, () => {
  H.db();
  const blade = {...H.card("Reaping Blade", 0), uid: "RB"}; B.equipPiece(blade);
  const swung = H.execute(viserai({gear: [blade], hist: {non: 1}}), blade, "weapon", 0);
  assert.equal(runes(swung), 0, "the swing conjured a Runechant");
  /* CONTROL: a Runeblade attack PLAYED from hand, with the same history */
  const rf = {...H.card("Rune Flash", 1), uid: "RF"};
  const played = H.execute(viserai({hand: [rf], hist: {non: 1}}), rf, "hand", 0);
  assert.equal(runes(played), 1, "a Runeblade card played after a non-attack action card conjures one");
});

test("VISERAI: an ACTIVATED ABILITY and an INSTANT are not 'another non-attack action card'", {skip}, () => {
  H.db();
  const bl = {...H.card("Blossom of Spring", 0), uid: "BS"}; B.equipPiece(bl);
  let g = H.execute(viserai({gear: [bl]}), bl.powCard, "hero", 0);
  assert.equal(g.sides[0].hist.non, 0, "an equipment ability is not a card played");
  const ap = {...H.card("Arcane Polarity", 1), uid: "AP"};
  g = H.execute({...g, sides: [{...g.sides[0], hand: [ap]}, g.sides[1]]}, ap, "hand", 0);
  assert.equal(g.sides[0].hist.non, 0, "an Instant is not an action card");
  const rf = {...H.card("Rune Flash", 1), uid: "RF"};
  g = H.execute({...g, sides: [{...g.sides[0], hand: [rf]}, g.sides[1]]}, rf, "hand", 0);
  assert.equal(runes(g), 0, "so the Runeblade attack after them conjures nothing");
  /* CONTROL: a real non-attack action card does count */
  const ms = {...H.card("Mauvrion Skies", 1), uid: "MS"};
  assert.ok(P.isNonAtkActionCard(ms), "fixture: Mauvrion Skies is a non-attack action card");
  const m = H.execute(viserai({hand: [ms]}), ms, "hand", 0);
  assert.equal(m.sides[0].hist.non, 1);
});

test("A SPLIT CARD is the type of the half it was played as", {skip}, () => {
  H.db();
  const bs = {...H.card("Burn Up // Shock", 1), uid: "BU"};
  const hs = P.splitHalves(bs);
  assert.deepEqual(hs.map(h => P.isNonAtkActionCard(h)), [true, false], "fixture: Burn Up an Action, Shock an Instant");
  assert.equal(P.isNonAtkActionPlay(bs, "hand", 0), true, "Burn Up alone is a non-attack action card");
  assert.equal(P.isNonAtkActionPlay(bs, "hand", 1), false, "Shock alone is an Instant");
  assert.equal(P.isNonAtkActionPlay(bs, "hand", "both"), true, "melded it carries both halves");
  assert.equal(P.isNonAtkActionPlay(bs, "weapon", 0), false, "and nothing played by an activation route");
});
