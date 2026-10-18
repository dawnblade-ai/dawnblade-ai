/* ============================================================
   boostshare.test.js — THE AI SEAT BOOSTS WHEN ITS DECK PAYS (v5.37)

   QUEUE v4 H3. `sparring.payAction` declined every boost because the
   banished card is the top of the seat's own deck, hidden from it. The
   ORDER is hidden; the COMPOSITION is not. `judge.boostShare` answers the
   share of the REMAINING DECK a boost pays off for (never the hand, never
   `deck[0]`), and the seat boosts at a share of 1/2 or more.

   `parser.boostPays` is the one reader of "does this banished card pay
   boost", asked by `execute` at the banish and by `boostShare`, off the
   structured array (v2.39).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const J = require("../engine/judge");
const SP = require("../engine/sparring");
const B = require("../engine/build");
const C = require("../engine/cards");
const G = require("../engine/game");
const RNG = require("../engine/rng");
const PR = require("../engine/parser");
const { loadData, cardDbPath } = require("./helpers/extract");

const ROOT = path.join(__dirname, "..");
const CACHE = cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB";
const W = loadData();
let _db = null;
const DB = () => _db || (_db = (() => {
  const m = C.buildMaps(JSON.parse(fs.readFileSync(CACHE, "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard));
  J.setDb(m);
  return m;
})());
const heroBy = re => W.HEROES.find(h => re.test(h.n));
function match(h0, h1, seed){
  const ctr = {n: 0};
  let rng = RNG.make(seed || "boost");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}

let _u = 9500;
const mech = () => ({uid: ++_u, name: "Probe Gear " + _u, ty: ["Mechanologist", "Action"], tt: "Mechanologist Action", pitch: 1, tx: ""});
const plain = () => ({uid: ++_u, name: "Probe Plain " + _u, ty: ["Generic", "Action"], tt: "Generic Action", pitch: 1, tx: ""});
const withSeat0 = (g, deck, hand) => ({...g, sides: g.sides.map((s, i) => i ? s : {...s, deck, hand: hand || s.hand})});

test("parser.boostPays reads the structured array, with the printed line as a fallback", () => {
  assert.equal(PR.boostPays({ty: ["Mechanologist", "Action"], tt: "Generic Action"}), true,
    "the array is the authority (v2.39), not the type line");
  assert.equal(PR.boostPays({ty: ["Generic", "Action"], tt: "Mechanologist Action"}), false);
  assert.equal(PR.boostPays({tt: "Mechanologist Action - Attack"}), true, "no array: read the printed line");
  assert.equal(PR.boostPays(null), false);
});

test("boostPays agrees with the printed type line on every pinned pool record", {skip}, () => {
  const recs = JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard);
  assert.ok(recs.length > 700, "the pool scan is alive");
  const off = recs.filter(c => PR.boostPays(c) !== /mechanologist/i.test(c.tt || "")).map(c => c.name);
  assert.deepEqual(off, [], "tt and ty disagree about Mechanologist — the reader move changed an answer");
});

test("execute asks the one reader, and never tests the type line itself", () => {
  const fx = fs.readFileSync(path.join(ROOT, "engine/effects.js"), "utf8");
  assert.ok(fx.indexOf("const mech = P.boostPays(top);") >= 0, "the banish site does not ask parser.boostPays");
  assert.ok(!/\/mechanologist\/i\.test\(top\./.test(fx), "the banish site still reads the type line by hand");
});

test("boostShare counts the remaining deck and not the hand", {skip}, () => {
  const g0 = match(heroBy(/dash/i), heroBy(/kayo/i));
  assert.equal(J.boostShare(withSeat0(g0, [plain(), plain()], [mech(), mech(), mech()]), 0), 0,
    "Mechanologist cards in HAND do not pay a boost off the deck");
  assert.equal(J.boostShare(withSeat0(g0, [mech(), plain()], [plain()]), 0), 0.5);
  assert.equal(J.boostShare(withSeat0(g0, [], []), 0), 0, "an empty deck answers 0");
});

test("the seat boosts at a share of 1/2 and declines just below it", {skip}, () => {
  const g0 = match(heroBy(/dash/i), heroBy(/kayo/i));
  const card = g0.sides[0].hand[0];
  const ask = deck => SP.act({...withSeat0(g0, deck),
    pending: {kind: "boost", seat: 0, card, from: "hand", window: "action", target: "hero"}}, 0);
  assert.deepEqual(ask([mech(), plain()]), {t: "boost", yes: true}, "a share of exactly 1/2 boosts");
  assert.deepEqual(ask([mech(), mech(), plain(), plain(), plain()]), {t: "boost", yes: false},
    "a share of 2/5 declines");
  assert.deepEqual(ask([mech(), mech(), mech(), plain(), plain()]), {t: "boost", yes: true});
});

test("PREMISE: only Dash's deck prints boost, and its share at the deal is 1", {skip}, () => {
  const holders = [];
  for(const h of W.HEROES){
    const d = G.parseDeck(W.DECKS[h.k]);
    const b = B.buildSideDefault(h, d, DB(), RNG.make("prem-" + h.k), {n: 0}).b;
    if((b.deck || []).some(c => PR.printedKw(c, "boost"))) holders.push(h.k);
  }
  assert.deepEqual(holders.sort(), ["dash"],
    "a second boost deck arrived: re-measure BOOST_SHARE in sparring.js (QUEUE v4 H3)");
  const g = match(heroBy(/dash/i), heroBy(/kayo/i));
  assert.equal(J.boostShare(g, 0), 1, "Dash's share at the deal moved off 1.0: re-measure the threshold");
});

test("the boost route counter spells the engine's own phrase (v3.81)", () => {
  const fx = fs.readFileSync(path.join(ROOT, "engine/effects.js"), "utf8");
  const sp = fs.readFileSync(path.join(ROOT, "tools/selfplay.js"), "utf8");
  assert.ok(fx.indexOf("declNote += ` Boost: ${top.name} banished") >= 0, "the engine's boost line moved");
  assert.ok(sp.indexOf('/(?:^| )Boost: .+ banished/') >= 0, "the selfplay counter no longer spells it");
});

/* DRIVEN, because the first draft pinned two STRINGS and both were right
   while the counter read 0 over 630 games: judge trims the declaration
   note, so the feed line OPENS with "Boost:" and a leading space never
   matches. A string pin cannot see that; a game can. */
test("a driven Dash game fires the boost route counter", {skip}, () => {
  DB();
  const SPL = require("../tools/selfplay.js");
  const r = SPL.play(SPL.match("dash", "kayo", "boost-route", 0), 4000);
  assert.ok(r.events.some(e => e[0] === "boost"), "Dash boosted and the counter saw nothing");
});
