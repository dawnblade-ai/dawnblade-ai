/* ======================================================================
   AN ARSENAL ABILITY WITH NOTHING TO DO IS REFUSED BEFORE IT IS PAID (v5.00)

   v4.59 refused a PICK with nothing to choose. The three activation lines
   whose WHOLE payload is the arsenal never open one, so they were paid for
   a log line — found by reading self-play feeds, where an Azalea game
   activated Death Dealer every turn with no arrow in hand:

     Death Dealer         {r}            "If you have no cards in your
                                          arsenal, you may put an arrow …"
     Bull's Eye Bracers   destroy this   the same put
     Azalea               0, once/turn   "Put a card from your arsenal on the
                                          bottom of your deck. If you do, …"

   `effects.arsNoOpWhy` is the one body; judge's `abCostWhy` and the
   trainer's door both ask it. DRIVEN through `judge.legal`, the real entry
   point, with the positive control beside every refusal (v3.98).
   ====================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const X = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const ent = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p: p, code: null, q: 1}), {uid});
const piece = (n, uid) => { const g = ent(n, 0, uid); P.fxReset(); B.equipPiece(g); P.fxReset(); return g; };
const ACT = {t: "activate", uid: 41, from: "gear"};
function board(gr, side){
  const g = H.state(Object.assign({gear: [gr], hand: [], grave: [], arsenal: null,
      deck: [ent("Wounding Blow", 1, 600)], res: 9, ap: 1, name: "You"}, side || {}),
    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}

test("DRIVEN: Death Dealer and the Bracers refuse with no arrow to put, and with an occupied arsenal", {skip}, () => {
  for(const nm of ["Death Dealer", "Bull's Eye Bracers"]){
    const gr = piece(nm, 41);
    assert.ok(gr.powCard, nm + " has no ability route — re-anchor this drill");
    const arrow = () => ent("Swift Shot", 1, 701);
    /* no arrow in hand — a NON-arrow is there, so the filter is what refuses */
    const none = J.legal(board(gr, {hand: [ent("Wounding Blow", 1, 702)]}), ACT, 0);
    assert.match(String(none), /hand holds no arrow to put in the arsenal/, nm + ": " + none);
    /* an arrow in hand, but the arsenal already holds a card */
    const full = J.legal(board(gr, {hand: [arrow()], arsenal: ent("Wounding Blow", 2, 703)}), ACT, 0);
    assert.match(String(full), /needs an empty arsenal, and your arsenal holds a card/, nm + ": " + full);
    /* POSITIVE CONTROL: an arrow and an empty arsenal is a real play */
    assert.equal(J.legal(board(gr, {hand: [arrow()]}), ACT, 0), null, nm + " is refused even when it can put");
  }
});

test("DRIVEN: Azalea's ability is refused on an empty arsenal, and legal on an occupied one", {skip}, () => {
  const W = X.loadData();
  const built = B.buildSideDefault(W.HEROES.find(h => h.k === "azalea"),
    G.parseDeck(W.DECKS.azalea), H.db(), RNG.make("az-500"), {n: 0});
  const pc = built.b.HPOW;
  assert.ok(pc, "Azalea's hero powCard is gone — re-anchor this drill");
  const side = ars => {
    const g = board(ent("Wounding Blow", 1, 41), {gear: [], arsenal: ars});
    g.builds = [built.b, {}];
    return g;
  };
  const why = J.legal(side(null), {t: "activate", uid: "hpow", from: "hero"}, 0);
  assert.match(String(why), /arsenal is empty — nothing to cycle/, String(why));
  assert.equal(J.legal(side(ent("Wounding Blow", 2, 703)), {t: "activate", uid: "hpow", from: "hero"}, 0), null,
    "…and with a card to cycle it is legal");
});

test("ONLY A WHOLE PAYLOAD — an ability that does something else is never refused here", () => {
  const sd = {hand: [], arsenal: {name: "X", uid: 9}, name: "You"};
  P.fxReset();
  /* the same put with a second payload beside it */
  const both = {name: "Synthetic Put And Draw — ability", pitch: 0, tt: "Equipment Ability",
    tx: "If you have no cards in your arsenal, you may put an arrow from your hand face-up into your arsenal. Draw a card."};
  assert.equal(E.arsNoOpWhy(sd, both), null, "a second payload made the whole ability a no-op");
  /* …and a GATED one: the life gain may land even when the put cannot */
  const gated = {name: "Synthetic Gated Put — ability", pitch: 0, tt: "Equipment Ability",
    tx: "If you have less {h} than an opposing hero, gain 1{h}. If you have no cards in your arsenal, you may put an arrow from your hand face-up into your arsenal."};
  assert.equal(E.arsNoOpWhy(sd, gated), null, "a gated second payload made the whole ability a no-op");
  const only = {name: "Synthetic Put Only — ability", pitch: 0, tt: "Equipment Ability",
    tx: "If you have no cards in your arsenal, you may put an arrow from your hand face-up into your arsenal."};
  assert.match(String(E.arsNoOpWhy(sd, only)), /needs an empty arsenal/, "control: the bare put refuses");
  assert.equal(E.arsNoOpWhy(null, only), null, "no side, no refusal — and no throw");
  assert.equal(E.arsNoOpWhy(sd, {}), null, "a nameless card off a wire answers null rather than throwing");
  P.fxReset();
});

test("the trainer's door asks the same body", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(html, /\{ const _an = DawnEffects\.arsNoOpWhy\(act\(s\), card\);\s*if\(_an\) return L\(s, _an \+ "\."\); \}/);
  const js = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(js, /\{ const _an = E\.arsNoOpWhy\(sd, ab\); if\(_an\) return _an; \}/);
});
