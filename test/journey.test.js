/* EVERY POOL CARD, EVERY JOURNEY ITS TYPE PROMISES — AND EVERY ONE IT
   FORBIDS — driven through the real reducer.

   The user's Phase 1 brief: "ensure everything moves around properly in a
   2 player game … the function of each different card type and their full
   usability from pitch to play." Every other drill in this file's
   neighbourhood asks about one card or one clause. This asks the same
   four questions of all 401, off the TYPE alone:

     can it be PITCHED for its printed pitch value
     can it be PLAYED in a window its type opens, and does it LAND in the
       zone its type sends it to
     can it be DECLARED as a defender
     and — the half that matters more — is it REFUSED everywhere its type
       says it may not go

   ---- BOTH DIRECTIONS, AND THE SECOND ONE IS THE POINT ------------------

   Written one-sided first, this census reported a clean 401 while a Block
   card was a free 0-cost play and a defence reaction could be declared as
   a defender. Both are sev-3 "illegal play allowed" — the direction that
   steals games — and both were invisible, because asking only "can this
   card do what its type promises" cannot see a card doing MORE.

   That is the same shape as the audit measuring coverage rather than
   faithfulness, and as `fairness.js` being deliberately one-sided. A
   census that only counts what works is a coverage tool wearing a
   judge's coat.

   ---- IT READS NO CARD TEXT --------------------------------------------

   Every expectation comes from `types.js` — the printed type line — and
   every answer from `judge.legal`. No clause is parsed and no rules box
   is read, so a failure here is always the MACHINE getting a card type
   wrong, never a card being read wrong. That distinction is the whole
   reason Phase 1 is separate from Phase 3. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const J = require("../engine/judge");
const TY = require("../engine/types");
const PR = require("../engine/parser");
const GM = require("../engine/game");
const C = require("../engine/cards");
const B = require("../engine/build");
const P = require("../engine/priority");
const RNG = require("../engine/rng");
const INV = require("../engine/invariants");
const { loadData } = require("./helpers/extract");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB — run: node tools/audit.js";

const W = loadData();
let _db = null, _pool = null, _base = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

/* Every distinct card the fifteen precons deck, gear included. */
function pool(){
  if(_pool) return _pool;
  const db = DB(), seen = new Set(), out = [];
  for(const h of W.HEROES){
    const d = GM.parseDeck(W.DECKS[h.k]), sa = (h.code || "").slice(0, 3);
    for(const e of [...d.gear, ...d.deck]){
      const c = C.resolveEntry(db, e, sa);
      if(!c.resolved) continue;
      const k = c.name + "|" + c.pitch;
      if(seen.has(k)) continue;
      seen.add(k); out.push(c);
    }
  }
  return (_pool = out);
}

/* One real seated match, reused. Each probe forks it rather than dealing
   again — 401 cards times a fresh shuffle is a minute of nothing. */
function base(){
  if(_base) return _base;
  const h0 = W.HEROES.find(h => /kayo/i.test(h.n)), h1 = W.HEROES.find(h => /dorinthea/i.test(h.n));
  const ctr = {n: 0};
  let rng = RNG.make("journey");
  const b0 = B.buildSideDefault(h0, GM.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, GM.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return (_base = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
    heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n}));
}

const SEAT = 0, OPP = 1;
/* Vanilla fuel with no rules text at all: something to pitch, and
   something to be attacked with. Nothing here is a pool card, so a
   failure can never be the fuel being misread. */
const fuel = n => ({name: "Fuel" + n, uid: "F" + n, pitch: 3, power: null, def: 2, cost: 0,
                    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});
const VANILLA = {name: "Swing", uid: "SW", pitch: 0, power: 6, def: 0, cost: 0,
                 tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []};

/* The card under test in hand, with resources and action points to spare
   so nothing is refused for being unaffordable — this is a census of
   TYPES, and cost is a separate question with its own drills. */
function holding(card){
  const c = {...card, uid: "UT"};
  const g = J.put(base(), SEAT, s => ({...s, hand: [c, fuel(1), fuel(2), fuel(3), fuel(4)],
    ap: 3, res: 12, arsenal: null, paySel: [], pitch: [], grave: [], board: []}));
  return {g, c};
}

/* Stand in the defend step with the card under test in the defender's
   hand, so "may this block" can be asked of it. */
function inDefendStep(card){
  const {g} = holding(card);
  let n = J.put(g, OPP, s => ({...s, hand: [VANILLA], ap: 3, res: 9}));
  n = P.toPhase({...n, turnPlayer: OPP, actor: OPP}, "action");
  const out = J.reduce(n, {t: "play", uid: "SW", from: "hand"}, OPP);
  if(out.error) return null;
  n = out.state;
  for(let i = 0; i < 8 && n.step !== "defend"; i++) n = J.reduce(n, {t: "pass"}, n.priority).state;
  return n.step === "defend" ? n : null;
}

/* Resolve a play all the way through its payment. */
/* Every card in the pool that prints boost is asked, so the census
   records that it saw the question rather than merely tolerating it. */
const boostsAsked = [];

function settle(n){
  for(let i = 0; i < 12 && J.pendingOf(n); i++){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    /* BOOST IS AN ADDITIONAL COST (v2.84), so it belongs in the helper
       that resolves a play through its costs. Answered YES here, on
       purpose: the census is about where a card ENDS UP, and taking the
       boost is the branch that also moves a second card (the banished
       top of deck) — so it exercises the route that can put a card in
       two zones, which is the failure `invariants.js` exists to catch. */
    if(p.kind === "boost"){
      boostsAsked.push(p.card.name);
      n = J.reduce(n, {t: "boost", yes: true}, p.seat).state;
      continue;
    }
    if(p.need - sd.res - J.paySum(sd) > 0){
      const f = sd.hand.find(x => x.uid !== p.card.uid && !(sd.paySel || []).includes(x.uid));
      if(!f) return J.reduce(n, {t: "payCancel"}, p.seat).state;
      n = J.reduce(n, {t: "paySel", uid: f.uid}, p.seat).state;
    } else n = J.reduce(n, {t: "payConfirm"}, p.seat).state;
  }
  return n;
}
const whereIs = (n, uid) =>
  (n.chainCards || []).some(x => x.card.uid === uid) ? "chain"
  : (n.sides[SEAT].board || []).some(b => b.uid === uid) ? "arena"
  : (n.sides[SEAT].grave || []).some(x => x.uid === uid) ? "grave"
  : (n.sides[SEAT].hand || []).some(x => x.uid === uid) ? "hand" : "nowhere";

/* ---- CAN DO ------------------------------------------------------------ */

test("every pool card can be pitched for its printed pitch value", {skip}, () => {
  const bad = [], seenPitch = [];
  for(const card of pool()){
    if(!(card.pitch > 0)) continue;
    const {g} = holding(card);
    /* a real payment, opened by a card that costs more than the pool holds */
    const costly = {...VANILLA, uid: "CX", cost: 3, pitch: 0};
    const n = J.put(g, SEAT, s => ({...s, hand: [...s.hand, costly], res: 0}));
    const out = J.reduce(n, {t: "play", uid: "CX", from: "hand"}, SEAT);
    if(out.error){ bad.push(card.name + ": could not open a payment — " + out.error); continue; }
    const why = J.legal(out.state, {t: "paySel", uid: "UT"}, SEAT);
    if(why){ bad.push(card.name + " (p" + card.pitch + ") could not be pitched: " + why); continue; }
    const paid = J.reduce(out.state, {t: "paySel", uid: "UT"}, SEAT).state;
    if(J.paySum(paid.sides[SEAT]) !== card.pitch)
      bad.push(card.name + " pitched for " + J.paySum(paid.sides[SEAT]) + ", prints " + card.pitch);
    seenPitch.push(card.name);
  }
  assert.deepEqual(bad, []);
  assert.ok(seenPitch.length > 300, "the drill only exercised " + seenPitch.length + " cards");
});

test("a card played in an open window lands in the zone its TYPE sends it to", {skip}, () => {
  const bad = [], tally = {chain: 0, arena: 0, grave: 0};
  for(const card of pool()){
    const {g} = holding(card);
    const open = P.speedAllowed(g, SEAT);
    if(!TY.playWindows(card).some(w => open.includes(w))) continue;
    const why = J.legal(g, {t: "play", uid: "UT", from: "hand"}, SEAT);
    if(why){ bad.push(card.name + " is playable by type and was refused: " + why); continue; }
    const want = TY.destination(card);
    const got = whereIs(settle(J.reduce(g, {t: "play", uid: "UT", from: "hand"}, SEAT).state), "UT");
    if(got !== want) bad.push(`${card.name} [${TY.cardType(card).types.join("+")}] want ${want}, got ${got}`);
    else tally[want]++;
  }
  assert.deepEqual(bad, []);
  /* The counts are a partition and they are checked, so a census that
     quietly stopped driving anything cannot pass by reporting nothing. */
  assert.deepEqual(tally, {chain: 175, arena: 23, grave: 91},
    "the pool's play destinations moved — that is a rules change, so it is a deliberate edit here");
  /* AND THE BOOST QUESTION WAS ACTUALLY ASKED (v2.84). Without this the
     census passes just as well on an engine that never opens the pending
     — the cards still reach the chain, because declining and never being
     asked land in the same place.

     ELEVEN NAMES, NINETEEN PRINTINGS. The pool has 19 `name|pitch` cards
     printing Boost and 11 distinct names; this collects names, so it
     counts 11. Both numbers are correct and they are written down
     together because they otherwise read as a discrepancy — the same
     entries-vs-cards split that makes `sweep` say 17 where `failstates`
     says 16.

     AND IT IS A CENSUS OF WHAT *PRINTS* THE KEYWORD, not what mentions
     it. Hyper Driver ("when you boost a card") and Re-Charge! ("the next
     attack you boost this turn") both answer `hasKw` TRUE and neither
     prints it; offering them the cost is strictly stronger than printed.
     If either name appears in this list, `printedKw` has regressed to
     `hasKw`. */
  const names = [...new Set(boostsAsked)].sort();
  assert.equal(names.length, 11,
    "every card printing boost must be asked the question: " + names.join(", "));
  for(const ref of ["Hyper Driver", "Re-Charge!"])
    assert.ok(!names.includes(ref),
      ref + " only MENTIONS boost — it must never be offered the additional cost");
});

test("anything printing defence, bar a defence reaction, can be declared", {skip}, () => {
  const bad = [];
  let n = 0;
  for(const card of pool()){
    if(card.def == null || PR.isDR(card)) continue;
    const g = inDefendStep(card);
    if(!g){ bad.push(card.name + ": could not reach the defend step"); continue; }
    const why = J.legal(g, {t: "defend", uid: "UT"}, SEAT);
    if(why) bad.push(card.name + " (def " + card.def + ") was refused as a defender: " + why);
    else n++;
  }
  assert.deepEqual(bad, []);
  assert.ok(n > 300, "only " + n + " cards were actually offered as defenders");
});

/* ---- MUST NOT DO -------------------------------------------------------
   The half that a one-sided census cannot see. Written without these, this
   file reported a clean 401 while a Block card was a free 0-cost play and
   a defence reaction could be declared as a defender. */

test("a card with no open window is REFUSED, and told why", {skip}, () => {
  const bad = [];
  const kinds = {};
  for(const card of pool()){
    const {g} = holding(card);
    const open = P.speedAllowed(g, SEAT);
    if(TY.playWindows(card).some(w => open.includes(w))) continue;
    const why = J.legal(g, {t: "play", uid: "UT", from: "hand"}, SEAT);
    if(!why){ bad.push(card.name + " [" + TY.cardType(card).types.join("+") + "] was PLAYED with no window open"); continue; }
    /* A REFUSAL NOBODY CAN READ IS A DEAD TAP, which is the failure mode
       this codebase cares most about — indistinguishable from a bug. */
    if(!why.includes(card.name)) bad.push(card.name + ": refusal does not name the card — " + why);
    const k = TY.cardType(card).types.join("+") || "(none)";
    kinds[k] = (kinds[k] || 0) + 1;
  }
  assert.deepEqual(bad, []);
  /* Equipment is worn, a Weapon is activated, a Block may only be pitched
     or declared, and a reaction belongs to the reaction step (CR 8.1.2a /
     8.1.3a). Every one of the 112 is one of those.

     The 15 reconciles with CLAUDE.md's "eleven swinging weapons": four
     Weapon-typed cards print no power (Death Dealer, Plasma Barrel Shot,
     Cosmo, Crucible of Aetherweave) and are activated for a non-attack
     ability instead. That is the pinned `types.isWeaponType` vs
     `parser.isWeapon` split, counted from the other end. */
  assert.deepEqual(kinds, {"Equipment": 58, "Weapon": 15, "Block": 4,
                           "Attack Reaction": 20, "Defense Reaction": 15},
    "the set of cards with no action-phase play changed");
});

test("CR 8.1.3a — a defence reaction is never DECLARED as a defender", {skip}, () => {
  const bad = [];
  let n = 0;
  for(const card of pool()){
    if(!PR.isDR(card) || card.def == null) continue;
    const g = inDefendStep(card);
    if(!g){ bad.push(card.name + ": could not reach the defend step"); continue; }
    const why = J.legal(g, {t: "defend", uid: "UT"}, SEAT);
    if(!why) bad.push(card.name + " was declared as a defending card — CR 8.1.3a");
    else n++;
  }
  assert.deepEqual(bad, []);
  assert.equal(n, 15, "the pool's defence reactions changed in number");
});

test("a card cannot pitch for itself, whatever it is", {skip}, () => {
  const bad = [];
  for(const card of pool()){
    if(!(card.pitch > 0)) continue;
    const {g} = holding(card);
    const n = J.put(g, SEAT, s => ({...s, res: 0}));
    const out = J.reduce(n, {t: "play", uid: "UT", from: "hand"}, SEAT);
    if(out.error || !J.pendingOf(out.state)) continue;   /* it was free, or unplayable */
    if(!J.legal(out.state, {t: "paySel", uid: "UT"}, SEAT))
      bad.push(card.name + " was allowed to pitch for its own cost");
  }
  assert.deepEqual(bad, []);
});

/* THE POOL'S TYPE CENSUS IS A PARTITION, and that is what makes the
   numbers above trustworthy rather than decorative: every one of the 401
   is counted exactly once, so a card quietly changing type shows up as
   two counts moving rather than as nothing at all. */
test("the four journeys account for every card in the pool", {skip}, () => {
  let playable = 0, unplayable = 0, pitchable = 0, defendable = 0;
  for(const card of pool()){
    const {g} = holding(card);
    const open = P.speedAllowed(g, SEAT);
    if(TY.playWindows(card).some(w => open.includes(w))) playable++; else unplayable++;
    if(card.pitch > 0) pitchable++;
    if(card.def != null && !PR.isDR(card)) defendable++;
  }
  assert.equal(playable + unplayable, pool().length);
  assert.deepEqual({total: pool().length, playable, unplayable, pitchable, defendable},
    {total: 401, playable: 289, unplayable: 112, pitchable: 328, defendable: 332});
});

/* ===================================================================
   BOOST — THE ADDITIONAL COST (v2.84)

   Printed reminder text, read off the card image because the database
   carries none for keywords:

     Boost (As an additional cost to play this, YOU MAY banish the top
     card of your deck. If it's a Mechanologist card, this gains go again.)

   Three things do work in that sentence and each gets a drill: it is
   OPTIONAL, the banished card leaves the DECK for the BANISH zone, and
   the go again rides on the banished card's TYPE rather than on the
   attack's. Driven through `reduce`, never scanned — the whole point of
   the merge is that this is the path a player takes.
   =================================================================== */
const boostCard = () => pool().find(c => PR.printedKw(c, "boost"));

/* A Mechanologist card on top, so the go-again arm is reachable, and a
   non-Mechanologist one for the arm that is not. */
const topped = (card, top) => {
  const {g} = holding(card);
  return J.put(g, SEAT, s => ({...s, deck: [{...top, uid: "TOP"}, ...s.deck], banish: []}));
};
const MECH = {name: "Boost-drill Mech", uid: "TOP", pitch: 1, power: 3, cost: 0,
              tt: "Mechanologist Action - Attack", ty: ["Mechanologist","Action","Attack"], kw: [], tx: ""};
const PLAIN = {name: "Boost-drill Plain", uid: "TOP", pitch: 1, power: 3, cost: 0,
               tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], kw: [], tx: ""};

test("boost opens a pending, and it is OPTIONAL", {skip}, () => {
  const card = boostCard();
  assert.ok(card, "no card in the pool prints boost — the fixture is wrong, not the engine");
  let g = topped(card, PLAIN);
  const out = J.reduce(g, {t: "play", uid: "UT", from: "hand"}, SEAT);
  assert.equal(out.error, null);
  const p = J.pendingOf(out.state);
  assert.ok(p && p.kind === "boost", "playing a boost card must ask before it resolves");

  /* DECLINING IS A COMPLETE ANSWER, and it must cost nothing: the deck is
     untouched and nothing reaches the banish zone. */
  const no = J.reduce(out.state, {t: "boost", yes: false}, SEAT);
  assert.equal(no.error, null);
  assert.equal(no.state.sides[SEAT].deck[0].uid, "TOP", "declining must not banish the top card");
  assert.equal((no.state.sides[SEAT].banish || []).length, 0, "and must banish nothing at all");
  assert.equal(J.pendingOf(no.state), null, "the pending is spent either way");
});

test("accepting boost moves the top card DECK -> BANISH, exactly once", {skip}, () => {
  const card = boostCard();
  let g = topped(card, PLAIN);
  const before = g.sides[SEAT].deck.length;
  const asked = J.reduce(g, {t: "play", uid: "UT", from: "hand"}, SEAT).state;
  const yes = J.reduce(asked, {t: "boost", yes: true}, SEAT);
  assert.equal(yes.error, null);
  const sd = yes.state.sides[SEAT];
  assert.equal(sd.deck.length, before - 1, "exactly one card leaves the deck");
  assert.ok(!sd.deck.some(c => c.uid === "TOP"), "and it is the TOP one");
  assert.ok((sd.banish || []).some(c => c.uid === "TOP"), "which lands in the banish zone");
  /* A CARD IN TWO ZONES IS THE FAILURE THE JUDGE EXISTS FOR, and a
     banish that copied rather than moved would look correct in the log. */
  assert.deepEqual(INV.errors(yes.state).filter(v => /ZONE/.test(v.code)), []);
});

test("the go again rides on the BANISHED card's type, not the attack's", {skip}, () => {
  const card = boostCard();
  const swing = top => {
    const asked = J.reduce(topped(card, top), {t: "play", uid: "UT", from: "hand"}, SEAT).state;
    return J.reduce(asked, {t: "boost", yes: true}, SEAT).state;
  };
  const mech = swing(MECH), plain = swing(PLAIN);
  /* READ THE LINK, NOT THE ACTION POINT. The obvious observable is `ap`,
     and it is the wrong one: an attack's action point is charged when the
     link RESOLVES, in `linkPayload`, not when it is declared — so both
     arms read the same `ap` while the attack is still on the chain, and
     the drill passes on an engine where boost does nothing. (That is what
     it did when first written.) `pend.ga` is the flag boost actually
     sets, and it is state rather than prose. */
  assert.equal(mech.pend.ga, true, "a Mechanologist card banished grants go again");
  assert.equal(plain.pend.ga, false, "any other card does not");
  /* Both arms must genuinely have boosted, or the pair above is two
     readings of an attack that never paid the cost. */
  for(const [n, s] of [["mech", mech], ["plain", plain]])
    assert.ok((s.sides[SEAT].banish || []).some(c => c.uid === "TOP"),
      n + " never banished the top card — the arms are not comparable");
});

test("boost blocks the game until answered, for BOTH seats", {skip}, () => {
  const card = boostCard();
  const asked = J.reduce(topped(card, PLAIN), {t: "play", uid: "UT", from: "hand"}, SEAT).state;
  /* The asked seat may only answer... */
  assert.match(J.legal(asked, {t: "pass"}, SEAT) || "", /answer boost/,
    "the seat mid-decision may not do anything else");
  /* ...and the other seat may do nothing, because the card is mid-play. */
  assert.ok(J.legal(asked, {t: "pass"}, OPP), "the other seat is blocked too");
  /* And a boost answer with nothing pending is refused rather than silently
     dropped — without this the action is a no-op that reads as accepted. */
  assert.match(J.legal(topped(card, PLAIN), {t: "boost", yes: true}, SEAT) || "", /nothing to boost/);
});

test("an empty deck never asks a question with one answer", {skip}, () => {
  const card = boostCard();
  const g = J.put(topped(card, PLAIN), SEAT, s => ({...s, deck: []}));
  const out = J.reduce(g, {t: "play", uid: "UT", from: "hand"}, SEAT);
  assert.equal(out.error, null);
  assert.equal(J.pendingOf(out.state), null,
    "with nothing to banish the play resolves straight through — buildPrompt's own rule");
});

test("judge's state never retains the spent boost answer", {skip}, () => {
  const card = boostCard();
  const asked = J.reduce(topped(card, PLAIN), {t: "play", uid: "UT", from: "hand"}, SEAT).state;
  for(const yes of [true, false]){
    const out = J.reduce(asked, {t: "boost", yes}, SEAT).state;
    assert.equal(out._doBoost, undefined,
      "_doBoost must be stripped — a sticky answer boosts the NEXT card that prints the keyword");
  }
});
