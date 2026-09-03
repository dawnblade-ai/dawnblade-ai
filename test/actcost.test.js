/* ============================================================
   AN ACTIVATION'S COST IS READ THREE TIMES (v3.80)

   `effCost` is asked three separate questions on one activation:

     judge.legal       could this seat RAISE it?  (pool + what it can pitch)
     judge.doActivate  must a PAYMENT open?       (pool alone)
     effects.execute   CHARGE it.

   Only the third used the effective number. The other two read the
   PRINTED cost, and the two are different the moment anything modifies
   one — Frostbite taxes +1, a runechant discounts, `costOff` and
   `boardRed` both move it.

   DRIVEN: Briar activating Scorpio, Comet Tail (printed `{t}`, so cost 0)
   under a Frostbite. `legal` said yes against 0, no payment opened
   because 0 > 0 is false, and `execute` charged 1 into a seat holding 0.
   **`res: -1`** — `NEGATIVE-RES`, CR 4.4.3e: points are lost, never owed.
   It is also the `legal`/`reduce` agreement `fuzz.test.js` exists to hold.

   v2.80 FOUND THIS EXACT DEFECT ON THE PLAY ROUTE and left it wrong on
   all three activation routes. Its own words: "`effCost` is READ TWICE
   and the reads are different questions."

   IT NEEDED THE POLICY FIX TO BECOME REACHABLE. Frostbite arrives on a
   NON-ATTACK, and until v3.80 `sparring.act` could not play one — so no
   self-play game had ever put a Frostbite on a board holding a {t}
   weapon. A guard rail is only as good as the states that reach it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const J = require("../engine/judge.js");
const PR = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("actcost"), {n: 0}).b;
  return _b[k];
}

/* A Frostbite token on the acting side's own board — it taxes the NEXT
   card or activation that seat pays for. */
function frostbite(uid){
  const rec = H.db().byName && H.db().byName["frostbite"];
  return {uid, kind: "aura", card: H.card("Frostbite", 0), spent: false};
}

/* A REAL MATCH, driven through `judge.reduce` — `H.state` builds an
   effects-shaped state and carries no CR machine at all, so a drill about
   `legal` and `doActivate` has to open a real game. Seat 0 is Briar,
   whose gear holds Scorpio, Comet Tail. */
function table(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("actcost");
  const h0 = W.HEROES.find(x => x.k === "briar"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.briar), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sc = (g.sides[0].gear || []).find(x => /Scorpio/.test(x.name));
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {
    res: 0,
    hand: o.hand === "empty" ? [] : sides[0].hand,
    board: o.iced ? [{uid: 990, kind: "aura", card: H.card("Frostbite", 0), spent: false}] : []
  });
  return {g: Object.assign({}, g, {sides}), uid: sc && sc.uid, sc};
}

test("the tax is real — effCost moves and the printed cost does not", {skip}, () => {
  /* THE PREMISE. Without this the two drills below could both pass on an
     engine where nothing taxes anything. */
  const b = build("briar");
  const sc = b.gear.find(g => /Scorpio/.test(g.name));
  assert.ok(sc, "Briar carries Scorpio, Comet Tail");
  assert.equal(sc.cost, 0, "its printed activation cost is {t} — no resources");
  const bare = {res: 0, board: [], counters: {}, hand: []};
  const iced = {res: 0, board: [frostbite(990)], counters: {}, hand: []};
  assert.equal(PR.effCost(sc, bare), 0);
  assert.equal(PR.effCost(sc, iced), 1, "a Frostbite taxes it by one");
});

test("with NO way to raise it, the activation is refused outright", {skip}, () => {
  /* `legal` ASKS WHETHER THE SEAT COULD RAISE IT — the pool plus what the
     hand can pitch. An empty hand raises nothing, so a taxed swing the
     seat cannot fund is not a legal activation at all, and the refusal
     must name the EFFECTIVE cost rather than the printed 0. */
  const t = table({iced: true, hand: "empty"});
  const why = J.legal(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(why != null, "it must be refused");
  assert.match(String(why), /costs 1/,
    "the refusal must name the effective cost, not the printed 0 — got: " + why);
});

test("with a card to pitch, a PAYMENT opens rather than a silent charge", {skip}, () => {
  /* THE OTHER HALF. `legal` says the seat can raise it, so `doActivate`
     must ask — and it decided off the PRINTED cost, so `0 > 0` was false,
     nothing opened, and `execute` charged 1 into a seat holding 0. */
  const t = table({iced: true});
  assert.ok(t.g.sides[0].hand.length > 0, "the fixture needs a hand to pitch from");
  assert.equal(J.legal(t.g, {t: "activate", uid: t.uid}, 0), null,
    "it is legal — the hand can cover it");
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(!out.error, String(out.error));
  assert.ok(out.state.pending, "a payment must open");
  assert.equal(out.state.pending.kind, "pay");
  assert.equal(out.state.pending.need, 1, "…and it must ask for the EFFECTIVE cost");
  assert.ok(out.state.sides[0].res >= 0, "and nothing is charged yet");
});

test("an UNTAXED swing still needs no payment — the fix moved nothing else", {skip}, () => {
  /* THE CONTROL. Reading `effCost` everywhere would look identical to
     this fix if every fixture carried a tax. */
  const t = table({iced: false});
  assert.equal(J.legal(t.g, {t: "activate", uid: t.uid}, 0), null);
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(!out.error, String(out.error));
  assert.ok(!out.state.pending, "no tax, no payment");
  assert.ok(out.state.sides[0].res >= 0);
});

test("DRIVEN: a taxed swing never leaves the seat owing resources", {skip}, () => {
  /* THE BUG, AS THE STATE SEES IT. CR 4.4.3e — points are lost, never
     owed — which `invariants` reports as NEGATIVE-RES at error severity. */
  const INV = require("../engine/invariants.js");
  for(const iced of [true, false]){
    const t = table({iced});
    const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
    if(out.error) continue;
    assert.deepEqual(INV.errors(out.state).filter(v => v.code === "NEGATIVE-RES"), [],
      "no seat may owe resources (iced: " + iced + ")");
  }
});

test("all three activation branches ask effCost, and the ALLY one does not", {skip}, () => {
  /* THE ALLY BRANCH STAYS PRINTED, deliberately: `execute` charges
     `allyAttack(card).cost` there rather than `effCost` (v3.44 — an
     ally's `.cost` is its PLAY cost, already spent deploying it), so
     asking `effCost` would disagree with the charge in the other
     direction. Each read asks what its own charge site asks. */
  const src = fs.readFileSync(__dirname + "/../engine/judge.js", "utf8");
  const doAct = src.slice(src.indexOf("function doActivate"));
  const body = doAct.slice(0, doAct.indexOf("\nfunction "));
  assert.match(body, /const acost = effCost\(ab, sd\);/, "the hero branch");
  assert.match(body, /piece\.powCard, acost = effCost\(ab, sd\)/, "the equipment-ability branch");
  assert.match(body, /const cost = effCost\(piece, sd\);/, "the weapon branch");
  assert.match(body, /aa\.cost/, "and the ally branch keeps the printed ability cost");
  assert.doesNotMatch(body, /effCost\(b\.card/, "…never effCost");
});
