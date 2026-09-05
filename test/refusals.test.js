/* ============================================================
   TWO REFUSALS DISCHARGED BY MACHINERY BUILT TWO VERSIONS AGO (v3.79)

   v3.47 states the rule: "When you build a mechanic, sweep the refusals
   that were waiting on it." Both of these cards read tier `none` and
   BOTH of their payloads already parsed perfectly — only the cost prefix
   and the trigger stood in the way, and each was waiting on something
   this project has since built.

     Radiant Touch        "Instant - Banish this and a card from your
                           soul: Prevent the next 2 damage that would be
                           dealt to you this turn."
       payload `ward 2`   built v3.67
       soul cost          built v3.74 (Boltyn)
       LIVE — it is in Boltyn's own gear.

     Back Alley Breakline "When an activated ability or action card effect
                           puts this face-up into a zone from your deck,
                           gain 1 action point."
       payload `ap 1`     has always read
       the EVENT           built v3.71 (Azalea's cycle, `from: "deck"`)
       LATENT, measured — Azalea's ability is the only thing in the pool
       that puts a card face-up from a deck, and this card is in GRAVY
       BONES' list, so no deck holds both halves. Read correctly anyway
       (v3.73).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const E = require("../engine/effects.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const pool = require("../data/pool.json");
const rec = n => pool.find(c => c.name === n);
const asCard = (n, uid) => {
  const r = rec(n);
  return {name: r.name, uid, pitch: r.pitch, tt: r.type_text, ty: r.types,
          kw: r.card_keywords, tx: r.functional_text, power: r.power,
          def: r.defense != null ? r.defense : r.defence, cost: r.cost};
};
const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("refuse"), {n: 0}).b;
  return _b[k];
}

/* ---- 1. RADIANT TOUCH — the cost prefix was the whole gap ------------ */

test("its payload has read since v3.67 — only the cost refused", {skip}, () => {
  /* THE DIAGNOSTIC THAT FOUND IT. A card at tier `none` whose payload
     parses in isolation is a card whose COST is the blocker, and that is
     a two-minute check worth making on every `none` card. */
  /* THE WINDOW IS CARRIED AT v4.07 — the clause prints "this turn" and
     the prevention pool now gives it back at the end phase. Changed
     deliberately; the payload is the same reading, one field wider. */
  assert.deepEqual(P.classifyClause(
    "prevent the next 2 damage that would be dealt to you this turn"),
    {status: "run", ops: [["ward", 2, {until: "turn"}]]});
});

test("\"banish this AND a card from your soul\" is one cost with two objects", {skip}, () => {
  const hp = P.parseHeroPower(rec("Radiant Touch").functional_text, true);
  assert.ok(hp, "the ability must be read at all");
  assert.equal(hp.kind, "instant");
  assert.equal(hp.soul, 1);
  assert.equal(hp.selfBanish, true, "the source is part of the price");
  assert.equal(hp.cost, 0, "it is paid in cards, not resources");
});

test("the plain soul cost still refuses no card — Boltyn is unmoved", {skip}, () => {
  /* THE NEGATIVE CONTROL FOR THE WIDENING. An optional middle in a regex
     is exactly the shape that quietly claims its neighbours; Boltyn's own
     line prints the cost WITHOUT "this and" and must parse identically. */
  const bo = pool.find(c => /^Boltyn/.test(c.name || "") && /Hero/.test(c.type_text || ""));
  const hp = P.parseHeroPower(bo.functional_text, true);
  assert.equal(hp.soul, 1);
  assert.ok(!hp.selfBanish, "he banishes from the soul and keeps his hero");
});

test("the EQUIPMENT powCard builder stamps the soul cost — it did not before", {skip}, () => {
  /* v3.63's RULE, SECOND OUTING: when you add a flag to one powCard
     builder, grep for the others. v3.74 taught `parseHeroPower` the soul
     banish and stamped `_soulCost` on the HERO powCard alone — so an
     EQUIPMENT ability printing the same cost was built with the cost
     silently DROPPED, which is the free-ability bug v2.04 fixed. */
  const rt = build("boltyn").gear.find(g => /Radiant Touch/.test(g.name));
  assert.ok(rt, "it is in his gear");
  assert.ok(rt.powCard, "and it has an ability at all");
  assert.equal(P.abSoulCost(rt.powCard), 1);
  assert.equal(P.abSelfBanish(rt.powCard), true);
  assert.equal(rt.powCard._banishGear, rt.uid, "and it knows which piece to banish");
  assert.equal(rt.powCard._instant, true);
});

test("DRIVEN: it prevents 2, spends the soul, and the piece is banished", {skip}, () => {
  const b = build("boltyn");
  const rt = b.gear.find(g => /Radiant Touch/.test(g.name));
  const soul = {name: "Soul Card", uid: 700, pitch: 1, tt: "Generic Action",
                ty: ["Generic", "Action"], kw: [], tx: ""};
  const g = H.state({gear: [rt], res: 9, ap: 1, hand: [], soul: [soul]}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, rt.powCard, "hero", 0, {});
  assert.equal(n.sides[0].ward, 2, "the prevention pool — built v3.67");
  assert.equal(n.sides[0].soul.length, 0, "the soul card is spent");
  const mark = n.sides[0].gear.find(x => x.uid === rt.uid);
  assert.equal(mark.destroyed, true);
  assert.equal(mark._banished, true, "marked, not spliced — v3.54's index hazard");
});

test("DRIVEN: an EMPTY soul is inert, and the piece is NOT spent", {skip}, () => {
  /* v2.04 — AN UNPAYABLE COST IS INERT, NEVER FREE. And the piece must
     survive it: charging the self-banish for an ability that never ran
     costs the player the card for a play the rules never allowed, which
     is v3.11's shape one cost over. */
  const b = build("boltyn");
  const rt = b.gear.find(g => /Radiant Touch/.test(g.name));
  const g = H.state({gear: [rt], res: 9, ap: 1, hand: [], soul: []}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, rt.powCard, "hero", 0, {});
  assert.ok(!n.sides[0].ward, "no prevention");
  const mark = n.sides[0].gear.find(x => x.uid === rt.uid);
  assert.ok(!mark.destroyed, "and the piece is still equipped");
  assert.ok(!mark._banished);
});

test("DRIVEN: the sweep files it to BANISH, never the graveyard", {skip}, () => {
  /* TWO DESTINATIONS, READ OFF THE MARK. A destroyed permanent goes to
     the graveyard (the 2026-08-29 ruling); a banished one is out of the
     game. They are different zones with different readers — the two
     `retrieve` cards fetch gear out of a GRAVEYARD, so filing a banished
     piece there hands back a card the text removed from the game. */
  const b = build("boltyn");
  const rt = b.gear.find(g => /Radiant Touch/.test(g.name));
  const soul = {name: "Soul Card", uid: 701, pitch: 1, tt: "Generic Action",
                ty: ["Generic", "Action"], kw: [], tx: ""};
  const g = H.state({gear: [rt], res: 9, ap: 1, hand: [], soul: [soul]}, {hp: 20, hand: []},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, rt.powCard, "hero", 0, {});
  const out = E.beginEndPhase(n, 0, H.db()).game;
  assert.ok(!out.sides[0].gear.some(x => x.uid === rt.uid), "it has left the gear zone");
  assert.ok((out.sides[0].banish || []).some(x => x.uid === rt.uid), "and it is in banish");
  assert.ok(!(out.sides[0].grave || []).some(x => x.uid === rt.uid),
    "…and NOT in the graveyard, where `retrieve` could fetch it back");
});

test("an ORDINARY destroyed piece still goes to the graveyard", {skip}, () => {
  /* THE CONTROL FOR THE SECOND DESTINATION. A sweep that sent everything
     to banish would pass the drill above perfectly. */
  const b = build("boltyn");
  const piece = Object.assign({}, b.gear[0], {uid: 777, destroyed: true});
  const g = H.state({gear: [piece], res: 9, ap: 1, hand: []}, {hp: 20, hand: []},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const out = E.beginEndPhase(g, 0, H.db()).game;
  assert.ok((out.sides[0].grave || []).some(x => x.uid === 777), "graveyard");
  assert.ok(!(out.sides[0].banish || []).some(x => x.uid === 777), "not banish");
});

/* ---- 2. BACK ALLEY BREAKLINE — the event was built at v3.71 ---------- */

test("the deck-face-up trigger is READ, and is not the arsenal one", {skip}, () => {
  const fx = P.fxParse(asCard("Back Alley Breakline", 900));
  assert.deepEqual(fx.deckFaceUp, [["ap", 1]]);
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.ops, [],
    "held off fx.ops — left there the action point is paid when the card is PLAYED");
  assert.ok(!fx.arsenalUp,
    "and it is NOT the generic face-up trigger: that one fires on a put from hand too");
});

test("DRIVEN: it fires off Azalea's cycle, which is the only event there is", {skip}, () => {
  /* THE REAL ROUTE. Azalea's hero ability puts the top card of the deck
     face-up into the arsenal — `from: "deck"` — which is the sole such
     event in the pool (v3.71). */
  const b = build("azalea");
  const g = H.state({deck: [asCard("Back Alley Breakline", 900)],
                     arsenal: asCard("Act of Glory", 901), hand: [], res: 9, ap: 1},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const n = H.execute(g, b.HPOW, "hero", 0, {});
  assert.equal(n.sides[0].arsenal.name, "Back Alley Breakline");
  assert.equal(n.sides[0].arsenal._faceUp, true);
  assert.equal(n.sides[0].ap, 2, "1 kept by her go again, +1 from its own trigger");
  /* THE SEQUENCE IS THE LESSON (v3.60): the card is seen arriving, THEN
     the trigger pays. Run the other way round the feed hands over an
     action point before the player has been told the card is there. */
  const iUp = n.feed.findIndex(l => /Back Alley Breakline set face up/.test(l));
  const iAp = n.feed.findIndex(l => /action point — the turn stretches/.test(l));
  assert.ok(iUp >= 0 && iAp > iUp, "face-up first, then the trigger");
});

test("DRIVEN: a put from the HAND pays nothing — the line says from your deck", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A trigger that never
     fires passes the hand half perfectly, so the deck half above is the
     positive control for this one. An action point is the most valuable
     thing in the game to hand out wrongly. */
  let g = H.state({hand: [asCard("Back Alley Breakline", 902)], arsenal: null,
                   res: 9, ap: 1}, {}, {actor: 0, turn: 3});
  g = Object.assign({}, g, {promptQ: [{tag: "pick", side: 0, src: "probe",
    zone: "hand", to: "arsenal", min: 0, max: 1, faceUp: true, title: "Put it up?"}]});
  let n = J.openPrompt(g);
  n = J.reduce(J.reduce(n, {t: "promptSel", i: 0}, 0).state, {t: "promptConfirm"}, 0).state;
  assert.equal(n.sides[0].arsenal.uid, 902, "the control — it really did go up face up");
  assert.equal(n.sides[0].arsenal._faceUp, true);
  assert.equal(n.sides[0].ap, 1, "and NO action point was paid");
});

test("MEASURED: no deck holds both halves, so it is latent", {skip}, () => {
  /* A PRINTED DISTINCTION IS READ CORRECTLY WHETHER OR NOT ANYTHING
     NOTICES (v3.73). This pins the measurement so that the day a deck
     does hold both, the claim in the docs is known to have changed. */
  const W = loadData();
  const holders = Object.keys(W.DECKS).filter(k =>
    G.parseDeck(W.DECKS[k]).deck.some(e => e.name === "Back Alley Breakline"));
  assert.deepEqual(holders, ["gravy"], "only Gravy Bones lists it");
  assert.equal(build("gravy").halveBase, false);
  /* ASKED OF THE PARSER, NOT OF A REGEX OVER HERO TEXT. The first draft
     of this measurement spelled "face up" and the card prints "face-up",
     so it found NOTHING and reported the event unreachable — which looks
     exactly like a correct latency measurement. Check your own fixture
     (sixth time), and prefer the field the engine actually sets. */
  const canPutFromDeck = Object.keys(W.DECKS).filter(k => {
    const pw = P.parseHeroPower(String((build(k).heroRec || {}).tx || ""), true);
    return !!(pw && /face.?up into your arsenal/i.test(pw.eff + " "
      + String((build(k).heroRec || {}).tx || "")));
  });
  assert.deepEqual(canPutFromDeck, ["azalea"],
    "and only Azalea's ability can cause the event — measure this again "
    + "before calling the card unreachable");
});
