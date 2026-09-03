/* ============================================================
   FAI — A PREGAME ZONE, AND A COST THE CHAIN MOVES (v3.86)

     "You may start the game with a **Phoenix Flame** in your graveyard.

      **Once per Turn Instant** - {r}{r}{r}: Return a Phoenix Flame from
      your graveyard to your hand. This ability costs {r} less to activate
      for each **Draconic chain link** you control."

   TWO CLAUSES, AND NEITHER WAS BUILT. The ability's PAYLOAD has read
   since the graveyard pick landed — what refused was everything around
   it: he opened with an empty graveyard, so the return had nothing to
   fetch until he had drawn and spent a Phoenix Flame, and the discount
   was simply dropped, so the ability cost 3 on the turn its whole point
   is that it costs 0.

   THE PREGAME HALF IS DASH'S SHAPE, ONE ZONE OVER — the pool prints
   exactly two "you may start the game with" lines and this is the second.
   His puts an ITEM in the ARENA; this puts a NAMED card in the GRAVEYARD.

   THE DISCOUNT IS THE CALLER'S ANSWER. The combat chain is game state,
   not a fact about the side, so `effCost` takes the count in — a caller
   that says nothing pays full price, which is weaker than printed and
   visible (v3.24's rule). It lands INSIDE `effCost` rather than at the
   call sites, because v3.80's whole lesson is that a cost subtracted at
   three sites is subtracted three different ways.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const build = k => {
  const W = loadData();
  return B.buildSideDefault(W.HEROES.find(x => x.k === k),
    G.parseDeck(W.DECKS[k]), H.db(), RNG.make("fai"), {n: 0}).b;
};

function table(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "faitable");
  const h0 = W.HEROES.find(x => x.k === "fai"), h1 = W.HEROES.find(x => x.k === "dorinthea");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.fai), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.dorinthea), H.db(), rng, ctr); rng = b1.rng;
  const g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                        heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  return {g, b0: b0.b};
}

/* ---- 1. THE PREGAME GRAVEYARD --------------------------------------- */

test("Fai's build carries a Phoenix Flame for the graveyard", {skip}, () => {
  const b = build("fai");
  assert.ok(b.startGrave, "the pregame card exists");
  assert.equal(b.startGrave.name, "Phoenix Flame");
  assert.equal(b.startGrave._gy, 0,
    "turn-stamped 0 — it was NOT put there this turn, and `_gy` answers that whole family");
});

test("it is SPLICED out of the deck — never in two zones", {skip}, () => {
  /* A card in the graveyard AND in the deck is CARD-IN-TWO-ZONES, which
     the census works by uid to catch. Same reason Dash's item is spliced. */
  const b = build("fai");
  assert.equal(b.deck.filter(c => c.uid === b.startGrave.uid).length, 0);
  const W = loadData();
  const listed = G.parseDeck(W.DECKS.fai).deck
    .filter(e => /Phoenix Flame/i.test(e.name)).reduce((a, e) => a + (e.q || 1), 0);
  assert.ok(listed >= 1, "his list holds Phoenix Flames at all: " + listed);
  assert.equal(b.deck.filter(c => c.name === "Phoenix Flame").length, listed - 1,
    "exactly one left the deck");
});

test("a hero printing no such line gets NO pregame graveyard", {skip}, () => {
  /* Opt-in (v3.58). The pool prints exactly two "start the game with"
     lines and only one names a graveyard. */
  assert.equal(build("kayo").startGrave || null, null);
  assert.equal(build("dash").startGrave || null, null, "Dash's is an ITEM in the ARENA");
  assert.ok(build("dash").startItem, "…and he still gets that");
});

test("the NAME is read off the printed line, not hardcoded", {skip}, () => {
  /* v3.21's rule: a name stored in the engine is card text invented one
     level up. Fai prints exactly one name, so no pool fixture can tell a
     read name from a literal — a SYNTHETIC hero is what sees it (v3.32,
     v3.74, and this is the fifth time). */
  const W = loadData();
  const real = W.HEROES.find(x => x.k === "fai");
  const db = H.db();
  /* SHADOW THE DATABASE RECORD, which is where `buildSide` reads the
     printed line from — patching the HEROES entry changes nothing,
     because the hero is resolved out of the db by name. */
  const rec = db.byName["fai"][0];
  const fakeDb = Object.assign({}, db, {byName: Object.assign({}, db.byName, {
    fai: [Object.assign({}, rec,
      {tx: "You may start the game with a Snatch in your graveyard."})]})});
  const b = B.buildSideDefault(real, G.parseDeck(W.DECKS.fai), fakeDb, RNG.make("syn"), {n: 0}).b;
  assert.ok(b.startGrave, "the synthetic line is read");
  assert.equal(b.startGrave.name, "Snatch", "and it fetched the card the line NAMES");
  assert.equal(b.deck.filter(c => c.name === "Phoenix Flame").length,
    build("fai").deck.filter(c => c.name === "Phoenix Flame").length + 1,
    "and the Phoenix Flame stayed in the deck");
});

test("the match opens with it in the graveyard, and the census is clean", {skip}, () => {
  const {g} = table({});
  assert.equal(g.sides[0].grave.length, 1);
  assert.equal(g.sides[0].grave[0].name, "Phoenix Flame");
  assert.equal(g.sides[1].grave.length, 0, "and seat 1 gets nothing");
  assert.equal(INV.errors(g).length, 0);
  const seen = new Set();
  let dup = 0;
  ["deck", "hand", "pitch", "grave", "banish", "soul"].forEach(z =>
    (g.sides[0][z] || []).forEach(c => { if(seen.has(c.uid)) dup++; seen.add(c.uid); }));
  assert.equal(dup, 0, "no uid appears twice");
});

test("`makeSide` carries a seeded graveyard through", {skip}, () => {
  /* IT HARDCODED `[]` AND SILENTLY DROPPED THE SEED. Found by driving
     Fai's opening rather than by reading the field list — every other
     zone `newMatch` seeds happened to be one `makeSide` already took. */
  const S = require("../engine/sides.js");
  const c = {name: "X", uid: 1};
  assert.deepEqual(S.makeSide({id: 0, grave: [c]}).grave, [c]);
  assert.deepEqual(S.makeSide({id: 0}).grave, []);
});

/* ---- 2. THE DRACONIC DISCOUNT --------------------------------------- */

test("the discount is READ off the printed pips", {skip}, () => {
  const b = build("fai");
  assert.ok(b.HPOW, "he has a hero power");
  assert.equal(b.HPOW.cost, 3, "printed {r}{r}{r}");
  assert.equal(b.HPOW._dracDiscount, 1, "{r} less PER LINK — one pip");
});

test("a hero printing no such rider carries no stamp", {skip}, () => {
  const b = build("kayo");
  assert.equal(b.HPOW == null || !("_dracDiscount" in b.HPOW), true);
});

test("`dracLinks` counts Draconic ATTACK links and nothing else", {skip}, () => {
  /* One reader — it was inline in `effects.js`'s `dracN` gate and Fai's
     discount is its second consumer. An `arc` link is a chain ENTRY for
     arcane damage, not a chain LINK you control. */
  assert.equal(P.dracLinks([]), 0);
  assert.equal(P.dracLinks(null), 0);
  assert.equal(P.dracLinks([{drac: true, kind: "atk"}, {drac: true, kind: "atk"}]), 2);
  assert.equal(P.dracLinks([{drac: false, kind: "atk"}, {drac: true, kind: "arc"}]), 0);
});

test("the MAGNITUDE is read off the pips — a synthetic prints two", {skip}, () => {
  /* HE PRINTS ONE `{r}`, so no pool fixture can tell a read number from a
     literal `1` — sabotaging the capture to a hardcoded 1 was SILENT
     against every other drill in this file. A synthetic hero record is
     what sees it (v3.32, v3.74, v3.77, v3.81 — fifth time). */
  const W = loadData();
  const real = W.HEROES.find(x => x.k === "fai");
  const db = H.db();
  const rec = db.byName["fai"][0];
  const mk = pips => {
    const fakeDb = Object.assign({}, db, {byName: Object.assign({}, db.byName, {
      fai: [Object.assign({}, rec, {tx:
        "**Once per Turn Instant** - {r}{r}{r}{r}: Return a Phoenix Flame from your "
        + "graveyard to your hand. This ability costs " + pips
        + " less to activate for each Draconic chain link you control."})]})});
    return B.buildSideDefault(real, G.parseDeck(W.DECKS.fai), fakeDb, RNG.make("syn2"), {n: 0}).b;
  };
  assert.equal(mk("{r}").HPOW._dracDiscount, 1);
  assert.equal(mk("{r}{r}").HPOW._dracDiscount, 2, "two pips is two per link");
  const bare = {res: 9, board: [], counters: {}, hand: []};
  assert.equal(P.effCost(mk("{r}{r}").HPOW, bare, {dracLinks: 2}), 0,
    "…and two links clears a four-cost ability");
});

test("`legal` ASKS THE DISCOUNTED PRICE — the read that v3.80 names", {skip}, () => {
  /* `effCost` is asked three questions on one activation (v3.80): could
     this seat RAISE it, must a PAYMENT open, and CHARGE it. A discount
     threaded into the charge alone is invisible while the seat is rich —
     sabotaging `legal` back to the printed cost was SILENT against every
     driven drill above, because `res: 9` raises 3 either way.

     The state that tells them apart is a seat holding EXACTLY the
     discounted price with an empty hand: nothing to pitch, so a `legal`
     reading the printed 3 refuses a play the rules allow. */
  const {g} = table({});
  const chain = [0, 1].map(i => ({n: "L" + i, dmg: 1, drac: true, kind: "atk"}));
  const poor = {...g, chain, sides: g.sides.map((s, i) =>
    i === 0 ? {...s, res: 1, hand: [], arsenal: null} : s)};
  assert.equal(J.legal(poor, {t: "activate", from: "hero", uid: "hpow"}, 0), null,
    "one resource covers a discounted price of one");
  const bare = {...poor, chain: []};
  assert.ok(J.legal(bare, {t: "activate", from: "hero", uid: "hpow"}, 0),
    "…and with no links it is correctly refused at the printed 3");
});

test("effCost applies it, and a caller that says nothing pays FULL", {skip}, () => {
  /* v3.24's discipline: the weaker, visible answer is the default. */
  const b = build("fai");
  const bare = {res: 9, board: [], counters: {}, hand: []};
  assert.equal(P.effCost(b.HPOW, bare), 3, "no answer -> printed price");
  assert.equal(P.effCost(b.HPOW, bare, {}), 3);
  assert.equal(P.effCost(b.HPOW, bare, {dracLinks: 1}), 2);
  assert.equal(P.effCost(b.HPOW, bare, {dracLinks: 3}), 0);
  assert.equal(P.effCost(b.HPOW, bare, {dracLinks: 9}), 0, "it floors at zero, never negative");
});

test("a card with no stamp is untouched by the answer", {skip}, () => {
  const b = build("fai");
  const any = b.deck.find(c => (c.cost || 0) > 0);
  assert.ok(any, "his deck holds a card with a printed cost");
  const bare = {res: 9, board: [], counters: {}, hand: []};
  assert.equal(P.effCost(any, bare, {dracLinks: 5}), P.effCost(any, bare),
    "the discount belongs to the ABILITY that prints it");
});

test("driven: the same activation costs 3 on an empty chain and 1 on two links",
     {skip}, () => {
  /* THE MEASUREMENT, through `judge.reduce` rather than through the
     reader — `legal`, `doActivate` and `execute` each ask `effCost` its
     own question (v3.80), and a discount threaded into one of the three
     is the shape that put a seat on negative resources. */
  const run = links => {
    const {g} = table({});
    const chain = [];
    for(let i = 0; i < links; i++) chain.push({n: "L" + i, dmg: 1, drac: true, kind: "atk"});
    const seeded = {...g, chain,
      sides: g.sides.map((s, i) => i === 0 ? {...s, res: 9} : s)};
    const out = J.reduce(seeded, {t: "activate", from: "hero", uid: "hpow"}, 0);
    assert.ok(!out.error, "activation accepted with " + links + " links: " + out.error);
    return 9 - out.state.sides[0].res;
  };
  assert.equal(run(0), 3, "no Draconic links — the printed price");
  assert.equal(run(2), 1, "two links — {r}{r} off");
});

test("it is FREE at three links, and the ability still resolves", {skip}, () => {
  const {g} = table({});
  const chain = [0, 1, 2].map(i => ({n: "L" + i, dmg: 1, drac: true, kind: "atk"}));
  const seeded = {...g, chain, sides: g.sides.map((s, i) => i === 0 ? {...s, res: 0} : s)};
  const before = seeded.sides[0].hand.length;
  const out = J.reduce(seeded, {t: "activate", from: "hero", uid: "hpow"}, 0);
  assert.ok(!out.error, "legal on an empty pool: " + out.error);
  const n = out.state;
  assert.equal(n.sides[0].res, 0, "nothing was charged, and nothing is owed");
  assert.ok(n.sides[0].hand.length > before
            || (n.prompt && n.prompt.tag === "pick"),
            "the Phoenix Flame comes back, or the sheet to pick it opens");
  assert.equal(INV.errors(n).length, 0, "no NEGATIVE-RES");
});
