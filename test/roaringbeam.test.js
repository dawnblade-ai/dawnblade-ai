/* ============================================================
   ROARING BEAM — RETURN IT, THEN CHARGE (v4.64)

     Create a Courage token.
     If there are no cards in your soul, return this to its owner's hand,
     then charge your soul. (Put a card from your hand under your hero.)
                                     — ROARING BEAM, SBL032, Boltyn's list

   Its second clause read NOTHING: the gate, the return and the charge
   each refused. It is the pool's only record of all three shapes, and the
   printing is what settles what "charge" means as an EFFECT — the database
   carries no reminder text, and every other charge in the pool is an
   additional COST (v4.33).

   "THEN" IS LOAD-BEARING: the card is back in the hand before the charge
   asks, so it is one of the cards that may be charged.

   AND BUILDING IT ON THE FILING SITE FOUND TRANSCEND'S DEFECT. That site's
   "undo the grave push made above" ran BEFORE the push it undid, so a
   transcended card left Inner Chi in the hand AND itself in the graveyard
   — one card in two zones under two uids, which the census cannot see.

   ASSERT ON HANDS, SOULS AND ZONES — NEVER ON FEED PROSE.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const J  = require("../engine/judge.js");
const C  = require("../engine/cards.js");
const G  = require("../engine/game.js");
const BL = require("../engine/build.js");
const RNG= require("../engine/rng.js");
const PR = require("../engine/parser.js");
const H  = require("./helpers/judged.js");
const X  = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached DB";

/* ---- 1. THE READER --------------------------------------------------- */

test("the clause reads WHOLE: a soul gate over a return, THEN a charge", () => {
  assert.deepEqual(PR.classifyClause(
    "If there are no cards in your soul, return this to its owner's hand, then charge your soul"),
    {status: "run", ops: [["returnSelf", 1], ["charge", 1]], cond: "soulEmpty"});
  /* the long spelling of the same zone (v4.48's two charge spellings) */
  assert.equal(PR.classifyClause(
    "If there are no cards in your hero's soul, return this to your hand, then charge your hero's soul").cond,
    "soulEmpty");
});

test("each half ALONE refuses — vocabulary with no claimant is not built", () => {
  /* Measured over 797 records, Roaring Beam is the only card printing
     either shape; a bare half would be a rule nothing reaches (v4.52). */
  for(const t of ["return this to its owner's hand", "charge your soul",
                  "return this to your hand, then charge your deck"])
    assert.equal(PR.classifyClause(t), null, "must not read: " + t);
});

test("the card reports FULL, and it is the pool's only claimant", {skip}, () => {
  const pool = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "data", "pool.json"), "utf8"));
  const hits = [];
  for(const r of pool){
    const m = C.mapDbCard(r);
    const c = {name: m.n, pitch: m.p, cost: m.c, power: m.pw, def: m.d, tt: m.tt,
               ty: m.ty, kw: m.kw, gkw: m.gkw, tx: m.tx};
    PR.fxReset(); const fx = PR.fxParse(c);
    if((fx.conds || []).some(x => x.cond === "soulEmpty")) hits.push(c.name + "|" + c.pitch);
    if(c.name === "Roaring Beam") assert.equal(fx.tier, "full");
  }
  assert.deepEqual([...new Set(hits)], ["Roaring Beam|2"]);
});

/* ---- 2. DRIVEN AT A REAL TABLE, THROUGH THE REDUCER ------------------ */

const DATA = X.loadData();
const heroBy = re => DATA.HEROES.find(h => re.test(h.n));
function table(seed){
  const d = H.db(); J.setDb(d);
  const ctr = {n: 0}; let rng = RNG.make(seed);
  const h0 = heroBy(/boltyn/i), h1 = heroBy(/kayo/i);
  const b0 = BL.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), d, rng, ctr); rng = b0.rng;
  const b1 = BL.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), d, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n], heroKeys: [h0.k, h1.k],
                     rng, first: 0, tokSeq: ctr.n});
}
function settle(n){
  let k = 0;
  while(J.pendingOf(n) && k++ < 40){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    if(p.kind === "charge"){ n = J.reduce(n, {t: "charge", uid: null}, p.seat).state; continue; }
    if(p.need - sd.res - J.paySum(sd) > 0){
      const pk = sd.hand.find(x => (x.pitch || 0) > 0 && !(sd.paySel || []).includes(x.uid));
      if(!pk) break;
      n = J.reduce(n, {t: "paySel", uid: pk.uid}, p.seat).state;
    } else n = J.reduce(n, {t: "payConfirm"}, p.seat).state;
  }
  return n;
}
/* THE REACTION IS SPLICED IN AT THE WINDOW — `rxlayer.test.js`'s fixture
   decision, for its reason: the drill is about what the card does, not how
   it survived the shuffle. The attack, the chain and the window are real. */
function window(soul){
  let g = table("roaringbeam1");
  while(g.arsenalFor != null) g = J.reduce(g, {t: "arsenal", uid: null}, g.arsenalFor).state;
  const seat = g.turnPlayer;
  const atk = g.sides[seat].hand.find(x => PR.isAttack(x));
  assert.ok(atk, "fixture: no attack in the opening hand");
  let sides = g.sides.slice(); sides[seat] = {...g.sides[seat], res: 9}; g = {...g, sides};
  let n = settle(J.reduce(g, {t: "play", uid: atk.uid, from: "hand"}, seat).state);
  let k = 0;
  while(n.step !== "reaction" && k++ < 20){
    if(n.priority == null) break;
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  }
  assert.equal(n.step, "reaction", "fixture: never reached the reaction step");
  const sd = {...n.sides[seat], res: 9};
  const rb = {...H.card("Roaring Beam", 2), uid: "rb1"};
  sd.hand = [rb, ...sd.hand];
  sd.soul = soul ? [{...H.card("Raging Onslaught", 1), uid: "soul1"}] : [];
  sides = n.sides.slice(); sides[seat] = sd;
  return {g: {...n, sides}, seat, rb};
}
const play = w => settle(J.reduce(w.g, {t: "play", uid: w.rb.uid, from: "hand"}, w.seat).state);

test("an EMPTY soul: the card goes back to the hand and a charge is asked", {skip}, () => {
  const w = window(false);
  const n = play(w);
  const sd = n.sides[w.seat];
  assert.ok(sd.hand.some(c => c.uid === "rb1"), "Roaring Beam is back in the hand");
  assert.ok(!sd.grave.some(c => c.uid === "rb1"), "and NOT in the graveyard as well");
  assert.ok(sd.board.some(b => /courage/i.test(b.card.name)), "the Courage token still lands");
  assert.ok(n.prompt && n.prompt.tag === "pick" && n.prompt.charge, "a charge sheet is live");
  assert.equal(n.prompt.side, w.seat, "addressed to the controller");
  assert.equal(n.prompt.min, 1, "and it is MANDATORY — the card prints no 'you may'");
  assert.ok(n.prompt.cards.some(c => c.uid === "rb1"),
    "\"THEN\": the card just returned is one of the cards that may be charged");
});

test("…and charging it puts the chosen card under the hero, CREDITED", {skip}, () => {
  const w = window(false);
  let n = play(w);
  const i = n.prompt.cards.findIndex(c => c.uid === "rb1");
  const before = n.sides[w.seat].hist.charged || 0;
  n = J.reduce(n, {t: "promptSel", i}, w.seat).state;
  n = J.reduce(n, {t: "promptConfirm"}, w.seat).state;
  const sd = n.sides[w.seat];
  assert.ok(sd.soul.some(c => c.uid === "rb1"), "in the soul");
  assert.ok(!sd.hand.some(c => c.uid === "rb1"), "and out of the hand");
  assert.equal(sd.hist.charged, before + 1,
    "a charge made as an effect is a charge — \"if you've charged this turn\" must see it");
  assert.equal(n.prompt, null, "the sheet is answered");
});

test("a soul that already holds a card: no return, no charge", {skip}, () => {
  const w = window(true);
  const n = play(w);
  const sd = n.sides[w.seat];
  assert.ok(sd.grave.some(c => c.uid === "rb1"), "it resolves to the graveyard like any reaction");
  assert.ok(!sd.hand.some(c => c.uid === "rb1"), "and does not come back");
  assert.ok(!(n.prompt && n.prompt.charge), "and nothing is charged");
  assert.ok(sd.board.some(b => /courage/i.test(b.card.name)), "the Courage token is unconditional");
});

test("the charged card's OWN trigger fires on the effect route too", {skip}, () => {
  /* BANNERET OF SALVATION: "Solflare - When this is charged to your soul,
     the next time you hit this turn, gain 1{h}." — one body credits both
     routes (`creditCharge`), so the trigger reads the same whichever put
     the card there. */
  const w = window(false);
  const ban = {...H.card("Banneret of Salvation", 2), uid: "ban1"};
  const sides = w.g.sides.slice();
  sides[w.seat] = {...sides[w.seat], hand: [ban, ...sides[w.seat].hand]};
  let n = play({...w, g: {...w.g, sides}});
  const i = n.prompt.cards.findIndex(c => c.uid === "ban1");
  assert.ok(i >= 0, "fixture: Banneret is a candidate");
  const held = (n.sides[w.seat].hitNext || []).length;
  n = J.reduce(n, {t: "promptSel", i}, w.seat).state;
  n = J.reduce(n, {t: "promptConfirm"}, w.seat).state;
  assert.equal((n.sides[w.seat].hitNext || []).length, held + 1,
    "Banneret's own \"when this is charged\" trigger armed its grant");
});

/* ---- 3. TRANSCEND, ON THE SAME FILING SITE --------------------------- */

test("a transcended card leaves Inner Chi in the hand and NOTHING in the graveyard", {skip}, () => {
  H.db(); PR.fxReset();
  const drop = {...H.card("A Drop in the Ocean", 3), uid: 501};
  const g = H.state({res: 9, ap: 1, hand: [drop]}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  g.sides[0].hist = {...g.sides[0].hist, blue: 1};    /* "another blue card" — its own gate */
  const out = H.execute({...g, phase: "action", step: "layer", priority: 0, stack: [], chain: []},
                        drop, "hand", 0, {});
  const sd = out.sides[0];
  assert.equal(sd.hist.trans, 1, "fixture: it did transcend");
  assert.ok(sd.hand.some(c => c.name === "Inner Chi"), "Inner Chi is in the hand");
  assert.ok(!sd.grave.some(c => c.uid === 501),
    "and the card it flipped FROM is not in the graveyard as well — one card, one zone");
  /* THE CONTROL: the same card, its gate unmet, resolves to the graveyard
     — a filing site that never files passes the half above perfectly. */
  PR.fxReset();
  const g2 = H.state({res: 9, ap: 1, hand: [drop]}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const out2 = H.execute({...g2, phase: "action", step: "layer", priority: 0, stack: [], chain: []},
                         drop, "hand", 0, {});
  assert.ok(out2.sides[0].grave.some(c => c.uid === 501), "an untranscended one is filed");
});

test("`returnSelf` with no resolving card refuses rather than guessing", {skip}, () => {
  const g = H.state({res: 9, hand: []}, {}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = H.runOps(g, [["returnSelf", 1]], "Somebody");
  assert.equal(out._returnSelf, undefined, "nothing is stashed without a card to name");
});

test("a STALE return stash is cleared with the resolution", {skip}, () => {
  /* The stash is keyed by uid, so it can only ever match the card that set
     it — which is exactly the case that matters: a stash left from an
     earlier resolution that never reached the filing site would send the
     SAME card home on its next play, past a gate that is now unmet. */
  const w = window(true);                    /* a soul that holds a card */
  const g = {...w.g, _returnSelf: "rb1"};    /* left over, naming this card */
  const n = play({...w, g});
  assert.ok(n.sides[w.seat].grave.some(c => c.uid === "rb1"),
    "the gate is unmet, so it is filed — a leftover stash must not carry it home");
});

test("the charge sheet survives the wire, which is what the bump is ABOUT", {skip}, () => {
  /* `WIRE_V` went 12 -> 13 because every live pick prompt gained `charge`
     and `hash` fingerprints the whole rules state. THE OTHER HALF: the
     field really rides — a bump for a field the wire drops is a version
     number with nothing behind it (dichotomy.test.js's rule). */
  const W = require("../engine/wire.js");
  const w = window(false);
  const n = play(w);
  assert.ok(n.prompt && n.prompt.charge, "fixture: the charge sheet is live");
  const back = W.decode(W.encode(n));
  assert.equal(back.prompt.charge, true, "`charge` did not survive the round trip");
  assert.equal(W.hash(back), W.hash(n), "the fingerprint moved across a round trip");
});
