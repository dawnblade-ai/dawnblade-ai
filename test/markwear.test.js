/* ============================================================
   A HIT WEARS THE MARK OFF (R1, v5.25)

   RULING (user, 2026-10-14): "Marks wear off when the hero is hit by an
   opponent's attack or an effect but otherwise sticks around — I'd say
   even if a hero transforms the mark will stay on!"
   RULING (user, 2026-10-14), on the effect half: "the effect would
   specifically need to remove a mark."

   Until v5.25 nothing cleared `marked`. A hit clears it, after the board
   at the hit is snapshotted (v5.09) and before the on-hit triggers run:
   "when this hits a MARKED hero" still fires, and a "mark them" rider
   leaves the hero marked again. Both halves are driven, because a
   two-case drill cannot tell clear-then-trigger from trigger-then-clear.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const E = require("../engine/effects.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const junk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

function hit(nm, o){
  P.fxReset();
  const c = nm ? Object.assign(H.card(nm, 1), {uid: "atk1"}) : junk("Plain Swing", "atk1");
  const g = H.state({name: "Alice", hand: [c], res: 9, ap: 1},
                    {name: "Bob", hp: 20, marked: !!o.marked,
                     hand: [junk("Kept", "h1"), junk("Spare", "h2")], deck: [junk("Top", "t1")]},
                    {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  let out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}),
                             c, "hand", 0, {}));
  if(o.grant)
    out = H.J.withEffects(out, (fx, s) =>
      fx.attackRx(s, H.card("Two Sides to the Blade", 1), {handBlockers: 0}).game);
  return unwrap(H.fx(out, (fx, m) => {
    const total = o.total != null ? o.total : m.pend.total;
    const heroHit = o.heroHit != null ? o.heroHit : total > 0;
    const r = fx.linkPayload(m, {total, pumps: 0, heroHit});
    return r.game || r;
  }));
}

test("a hit from an opponent's attack wears the mark off", {skip}, () => {
  assert.equal(hit(null, {marked: true}).sides[1].marked, false);
});

test("…and nothing else does: a full block, an ally hit, an unmarked hero", {skip}, () => {
  /* CR 7.5.5: a swing blocked to nothing is not a hit. A hit on an ALLY
     is not a hit on the hero. The positive control above is what keeps
     these rows from passing against a clear that never runs. */
  assert.equal(hit(null, {marked: true, total: 0, heroHit: false}).sides[1].marked, true,
    "fully blocked — still marked");
  assert.equal(hit(null, {marked: true, total: 3, heroHit: false}).sides[1].marked, true,
    "an ally was hit — the hero keeps the mark");
  assert.equal(!!hit(null, {marked: false}).sides[1].marked, false);
});

test("ORDER: the marked-hero trigger fires off the snapshot, and the clear lands", {skip}, () => {
  /* Black Widow alone: marked at the hit, so the banish fires; nothing
     re-marks, so the hero ends unmarked. Trigger-then-clear and
     clear-then-trigger agree HERE, which is why the next row exists. */
  const out = hit("Mark of the Black Widow", {marked: true});
  assert.equal(out.sides[1].hand.length, 1, "the banish fired off the mark at the hit");
  assert.equal(out.sides[1].marked, false, "and the hit wore the mark off");
});

test("ORDER: a \"mark them\" rider re-marks AFTER the clear", {skip}, () => {
  /* Two Sides to the Blade grants "When this hits a hero, mark them". A
     clear that ran after the triggers would leave this hero unmarked. */
  const out = hit("Mark of the Black Widow", {marked: true, grant: true});
  assert.equal(out.sides[1].hand.length, 1, "the banish still fired");
  assert.equal(out.sides[1].marked, true, "and the hero ends the hit marked again");
});

test("non-attack damage does not clear a mark (the effect must SAY so)", {skip}, () => {
  const g = H.state({name: "Alice"}, {name: "Bob", hp: 20, marked: true}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.runOps(g, [["arcane", 2], ["dmg", 1]], "Probe"));
  assert.ok(out.sides[1].hp < 20, "the damage landed");
  assert.equal(out.sides[1].marked, true, "and the mark stayed");
});

test("CENSUS: no pool record removes a mark", () => {
  /* The effect half of the ruling has nothing to build because nothing
     prints it. The day a card does, this fails and it is a decision. */
  const pool = require("../data/pool.json");
  const recs = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const txt = r => r.functional_text || r.tx || "";
  const mention = recs.filter(r => /\bmark/i.test(txt(r)));
  assert.ok(mention.length >= 20, "the scan reads card text (" + mention.length + ")");
  const RX = /(remove|lose|loses|clear|unmark)[^.]*\bmark|\bmark[^.]*(removed|wears)/i;
  assert.ok(RX.test("Remove a mark from target hero."), "the pattern is alive");
  assert.deepEqual(mention.filter(r => RX.test(txt(r))).map(r => r.name), []);
});

/* ---- the hit fiction: Danger Digits' "the dagger has hit" ---------- */
function jabBoard(o){
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("mark-jab"), {n: 0}).b;
  const dd = Object.assign({}, bd.gear.find(g => /Danger Digits/.test(g.name)));
  const dagger = {uid: 50, name: "Probe Dagger", tt: "Assassin Weapon - Dagger (1H)",
                  ty: ["Assassin", "Weapon", "Dagger"], power: 1, tx: "", kw: []};
  const atk = junk("Plain Swing", 800);
  const g = H.state({gear: [dd, dagger], res: 9, ap: 1, hand: [atk]},
                    {hp: 20, hand: [], marked: true, ward: o.ward || 0},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]});
  const n = H.execute(g, atk, "hand", 0, {});
  return H.execute(n, dd.powCard, "hero", 0, {});
}

test("the FICTION is a hit: a jab that lands wears the mark off", {skip}, () => {
  const n = jabBoard({});
  assert.equal(n.sides[1].hp, 19, "the jab landed");
  assert.equal(n.sides[1].marked, false);
});

test("…and a jab turned aside is not a hit (CR 7.5.5)", {skip}, () => {
  const n = jabBoard({ward: 9});
  assert.equal(n.sides[1].hp, 20, "fully prevented");
  assert.equal(n.sides[1].marked, true);
});

/* ---- transformation ------------------------------------------------ */
test("the mark survives Arakni becoming an Agent and returning to the brood", {skip}, () => {
  H.db();
  const W = require("./helpers/extract.js").loadData();
  const h = W.HEROES.find(x => x.k === "arakni");
  const bd = B.buildSide(h, G.parseDeck(W.DECKS.arakni), H.db(), {},
                         RNG.make("mark-brood"), {n: 0}).b;
  let g = H.state({}, {marked: true}, {actor: 0, turnPlayer: 0, turn: 3,
    builds: [bd, {}], seed: "mark-brood"});
  for(let t = 0; t < 4; t++){
    const out = E.beginEndPhase(g, 0, H.db());
    g = out.game;
    assert.notEqual(g.builds[0].heroRec.n, "Arakni, Web of Deceit", "she transformed");
    assert.equal(g.sides[1].marked, true, "pass " + t + ": the opponent is still marked");
  }
});
