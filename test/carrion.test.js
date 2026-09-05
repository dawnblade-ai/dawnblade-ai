/* ============================================================
   AN ACTIVATION COST WITH TWO OBJECTS — CARRION CROWN (v4.14)

     "Action - Discard an ally, DESTROY THIS: Draw a card. Go again"

   The pool's ONLY compound activation cost. Measured across every
   record, four distinct discard-bearing costs are printed:

     Discard this            x12   a card in HAND destroying itself
     Discard an Assassin card x5   the Agents — BUILT at v4.09
     Discard a card           x3   Rally the Coast Guard, a hand ability
     Discard an ally, destroy this  x1   THIS

   v3.79's Radiant Touch is the same shape from the other end — "Banish
   THIS AND a card from your soul" — and its ruling is the one here:
   *one optional middle; it is the same cost with a second object, not a
   second reader.*

   LIVE, NOT LATENT. Gravy Bones decks Carrion Crown as GEAR and his deck
   is built out of allies, so the cost is payable in a real game and the
   ability was INERT there — `parseHeroPower` refused the line, so
   `build.js` built no powCard and neither board could offer it (v3.47's
   shape: reading the COST is what creates the route).
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract");

const skip = H.db() ? false : "no card database";
const LINE = "Action - Discard an ally, destroy this: Draw a card. Go again";

/* ---- THE READING -------------------------------------------------- */

test("the compound cost reads BOTH objects", {skip}, () => {
  const pw = P.parseHeroPower(LINE, true);
  assert.ok(pw, "the line still refuses — the ability is inert");
  assert.deepEqual(pw.discardCost, {filter: {tt: "ally"}, subject: "ally"},
    "the discard half was dropped, so the ability is FREE — v2.04's bug");
  assert.equal(pw.sd, true,
    "the self-destroy half was dropped, so the printed DRAWBACK is free");
  assert.equal(pw.cost, 0, "a resource cost was invented");
  assert.equal(pw.eff, "Draw a card", "the payload moved");
});

test("the second object is `destroy this` and NOTHING else", {skip}, () => {
  /* ANYTHING WIDER RE-OPENS THE GUARD BELOW IT, which refuses a destroy
     cost that does not name the source — v3.86 measured 38 of the pool's
     39 as "destroy this", and the one that is not is Gravy Bones' named
     permanent with a reader of its own. Synthetic, because the pool
     prints exactly one card of this shape (v3.73). */
  for(const bad of ["Action - Discard an ally, destroy a Gold you control: Draw a card",
                    "Action - Discard an ally, banish this: Draw a card",
                    "Action - Discard an ally, pay {r}: Draw a card"])
    assert.equal(P.parseHeroPower(bad, true), null,
      "a second object nobody built was accepted: " + bad);
  /* and the plain form still reads, so the widening did not cost it */
  const plain = P.parseHeroPower("Attack Reaction - Discard an Assassin card: " +
                                 "Target Assassin attack gets +3{p}", true);
  assert.ok(plain && plain.discardCost && !plain.sd,
    "the Agents' plain discard cost regressed");
});

test("`allowDestroy` still gates it — a HERO printing this is refused", {skip}, () => {
  /* THE FLAG DECIDES WHETHER A SELF-DESTROY IS PAYABLE AT ALL, and the
     HERO builder passes false. This reader must not be the door around
     it: a hero destroying "this" destroys the hero. */
  assert.equal(P.parseHeroPower(LINE), null,
    "a self-destroy cost was accepted where the caller said it may not be");
  assert.ok(P.parseHeroPower(LINE, true), "…and the equipment route lost it too");
});

test("an ALLY is a printed type the cost reader can pin", {skip}, () => {
  /* MEASURED over the pinned pool: `tt` says "ally" on exactly the
     records whose structured `types` array says Ally, and on nothing
     else — so the filter needs no word boundary and none is invented. */
  assert.deepEqual(P.optFilter("an ally"), {tt: "ally"});
  const raw = require("../data/pool.json");
  const arr = Array.isArray(raw) ? raw : (raw.cards || Object.values(raw));
  const ttSays = arr.filter(c => /ally/i.test(c.type_text || ""));
  const tySays = arr.filter(c => (c.types || []).some(t => /^ally$/i.test(t)));
  assert.ok(tySays.length >= 10, "the scan stopped finding allies — it is aimed wrong");
  assert.deepEqual(ttSays.map(c => c.name).sort(), tySays.map(c => c.name).sort(),
    "a card's type line says `ally` and its structured array does not — the filter " +
    "now offers a card that is not an Ally, so add the word boundary");
});

/* ---- THE BUILD ------------------------------------------------------ */

test("GRAVY BONES gets the powCard, with both halves stamped", {skip}, () => {
  /* DRIVE THE REAL BUILD (v3.20). A hand-rolled powCard proves the
     parser; only `build.js` proves the card reaches a board. */
  const W = loadData();
  const hero = W.HEROES.find(h => h.k === "gravy");
  const b = B.buildSideDefault(hero, G.parseDeck(W.DECKS.gravy), H.db(),
                               RNG.make("carrion"), {n: 0}).b;
  const piece = (b.gear || []).find(g => /Carrion Crown/.test(g.name));
  assert.ok(piece, "Carrion Crown is not in Gravy Bones' gear — re-anchor this drill");
  assert.ok(piece.powCard, "the piece built NO powCard — the ability is unreachable");
  assert.deepEqual(piece.powCard._discardCost, {tt: "ally"},
    "the discard half did not reach the powCard (v3.63: grep the other builders)");
  assert.equal(piece.powCard.sd, true, "the self-destroy half did not reach it");
  assert.ok(piece.pow, "`gr.pow` is unset, so judge's gear branch refuses it by name");
});

/* ---- DRIVEN, BOTH HALVES -------------------------------------------- */

function board(hand){
  const db = H.db();
  const cc = C.resolveEntry(db, {name: "Carrion Crown", p: 0, code: null, q: 1});
  const pw = P.parseHeroPower(cc.tx, true);
  const pc = {name: "Carrion Crown — ability", pitch: 0, cost: 0, power: null, def: null,
    tt: "Equipment Ability", kw: ["Go again"], gkw: [], tx: "Draw a card. Go again",
    sd: true, _discardCost: pw.discardCost.filter,
    _discardSubject: pw.discardCost.subject, uid: "gp901"};
  const gear = Object.assign({}, cc, {uid: 901, pow: pw, powCard: pc});
  const deckC = C.resolveEntry(db, {name: "Wounding Blow", p: 1, code: null, q: 1});
  const g = H.state({gear: [gear], hand: hand.map((c, i) => Object.assign({}, c, {uid: 500 + i})),
                     deck: [Object.assign({}, deckC, {uid: 600})], res: 9, ap: 1},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const ALLY = () => C.resolveEntry(H.db(), {name: "Barnacle", p: 2, code: null, q: 1});
const PLAIN = () => C.resolveEntry(H.db(), {name: "Brutal Assault", p: 1, code: null, q: 1});

test("DRIVEN: a seat holding no ally is REFUSED before the ability resolves", {skip}, () => {
  H.db();
  /* v3.11: refusing AFTER it resolves spends the piece and the seat's
     once-per-turn allowance on a play the rules never allowed. And the
     real entry point is `legal`, not `abCostWhy` (v3.20). */
  const why = J.legal(board([PLAIN()]), {t: "activate", uid: 901, from: "gear"}, 0);
  assert.ok(why, "a seat with no ally in hand was allowed to activate");
  assert.match(String(why), /ally/i, "the refusal does not name the cost: " + why);
  assert.match(String(why), /\ban ally\b/,
    "the article disagrees with the printed subject — \"a ally\" (v4.14)");
});

test("DRIVEN: with an ally, BOTH halves of the cost are paid and the payload lands", {skip}, () => {
  H.db();
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45): a reader that
     charged only the discard would pass a draw-count assertion perfectly
     while the printed DRAWBACK — the piece shattering — was free. */
  const g = board([ALLY(), PLAIN()]);
  assert.equal(J.legal(g, {t: "activate", uid: 901, from: "gear"}, 0), null,
    "a payable cost was refused");
  const s = J.reduce(g, {t: "activate", uid: 901, from: "gear"}, 0).state;

  assert.deepEqual(s.sides[0].grave.map(c => c.name), ["Barnacle"],
    "the ally was not discarded — the ability is FREE (v2.04)");
  assert.ok(!s.sides[0].hand.some(c => /Barnacle/.test(c.name)),
    "…and it is still in hand, so the card was copied rather than moved");
  assert.equal(s.sides[0].grave[0]._gy, s.turn,
    "the discarded card is not turn-stamped — every \"…this turn\" clause goes wrong (v3.54)");

  assert.equal((s.sides[0].gear || []).find(x => x.uid === 901).destroyed, true,
    "the piece survived its own printed cost — the drawback is free");

  assert.ok(s.sides[0].hand.some(c => /Wounding Blow/.test(c.name)),
    "the payload did not resolve — the cost was charged for nothing");
});

test("DRIVEN: the feed's verb agrees with the seat it names", {skip}, () => {
  H.db();
  /* SEAT 0 IS CALLED "You" (v2.83, v3.88, v3.90), so a bare `discards`
     reads "You discards Barnacle". `isSecondPerson` has existed since
     v3.90; the v4.09 line never asked it. In a training sim the
     sequence IS the lesson, so this asserts on prose deliberately —
     the exception v3.60 names, not a licence. */
  const s = J.reduce(board([ALLY(), PLAIN()]),
                     {t: "activate", uid: 901, from: "gear"}, 0).state;
  const line = (s.feed || []).find(l => /Barnacle/.test(l) && /cost is paid/.test(l));
  assert.ok(line, "the discard is not announced at all");
  assert.ok(!/\bYou discards\b/.test(line), "\"You discards\" — " + line);
  assert.match(line, /\bYou discard\b/, "the verb does not agree: " + line);
});
