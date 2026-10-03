/* ============================================================
   TWO RULES THE TRAINER HAD AND THE TABLE NEVER ASKED (v4.91)

   v4.90's lesson, applied as a census: every refusal in the trainer's
   `tryPlay` was read against `judge.legal`, and two had no twin there.

   1. AN ARROW IS PLAYED FROM THE ARSENAL.
      RULING (user, 2026-07-25): "all cards that are 'arrow attack's can
      ONLY be played from arsenal". The trainer refused an arrow from hand
      with its own one-line test; the table asked nothing, so all eleven of
      Azalea's arrows played straight out of her hand, and the self-play
      ladder has played them that way since the table existed.

   2. AN ADDITIONAL DISCARD COST MUST BE PAYABLE.
      > "As an additional cost to play this, discard a random card."
      >                                           — SAVAGE FEAST ×3, Kayo's
      With nothing else in hand the table swung it for its full power and
      `execute` logged the cost away. And the trainer's own test forgot the
      PITCH: one other card and nothing floating, and that card pays the
      resource cost, leaving the discard nothing to take.

   `parser.playZoneWhy` and `parser.addCostWhy` are the readers, and both
   boards ask them.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const J = require("../engine/judge");
const INV = require("../engine/invariants");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* seat 0 in its action phase; `card` in the zone named, `side` laid over */
function holding(card, zone, side){
  const c = {...card, uid: "UT"};
  const own = zone === "arsenal" ? {arsenal: c, hand: []} : {hand: [c]};
  return Object.assign(H.state(Object.assign({res: 9, ap: 1}, own, side || {}),
                               {hp: 20, hand: []}, {turn: 5, actor: 0}),
    {phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null});
}
const why = (g, from) => J.legal(g, {t: "play", uid: "UT", from}, 0);
const vanilla = (uid, pitch) => ({name: "Fuel " + uid, uid, pitch, power: 3, def: 2, cost: 0,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []});

/* ---- 1. THE ARROW ---------------------------------------------------- */

test("an arrow is REFUSED from the hand at the table, and says why", {skip}, () => {
  H.db();
  const shot = H.card("Swift Shot", 1) || H.card("Swift Shot", 2) || H.card("Swift Shot", 3);
  assert.ok(P.isArrowCard(shot), "fixture: Swift Shot is not an Arrow any more");
  assert.match(String(why(holding(shot, "hand"), "hand")), /an arrow is played only from the arsenal/,
    "the table played an arrow out of the hand — the ruling has no reader here");
});

test("…and the SAME arrow is legal from the arsenal (both halves, v3.45)", {skip}, () => {
  /* a refusal that refuses every arrow from every zone passes the drill
     above perfectly; only this half tells the rule from a ban */
  H.db();
  const shot = H.card("Swift Shot", 1) || H.card("Swift Shot", 2) || H.card("Swift Shot", 3);
  assert.equal(why(holding(shot, "arsenal"), "arsenal"), null);
  const out = J.reduce(holding(shot, "arsenal"), {t: "play", uid: "UT", from: "arsenal"}, 0);
  assert.ok(!out.error, "the arsenal play was refused: " + out.error);
  assert.deepEqual(INV.errors(out.state), []);
});

test("a non-arrow attack is untouched — the rule is the SUBTYPE, not 'attack'", {skip}, () => {
  H.db();
  const blow = H.card("Wounding Blow", 1);
  assert.equal(why(holding(blow, "hand"), "hand"), null, "an ordinary attack from hand was refused");
});

test("the subtype is read off the STRUCTURED array, never `tt` (v2.44)", () => {
  /* SYNTHETIC (v3.73): no pool record disagrees with itself here, so only a
     fixture can tell which field is read */
  const strayWord = {name: "Stray", tt: "Ranger Action - Arrow Attack", ty: ["Ranger", "Action", "Attack"]};
  const realArrow = {name: "Real", tt: "Ranger Action - Attack", ty: ["Ranger", "Action", "Arrow", "Attack"]};
  assert.equal(P.isArrowCard(strayWord), false, "a stray word in the printed line made it an arrow");
  assert.equal(P.isArrowCard(realArrow), true);
  /* and a NAME containing the word is not a subtype */
  assert.equal(P.isArrowCard({name: "Arrowhead", tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]}), false);
  /* the fallback for a record with no array reads the FRONT face, word-bounded */
  assert.equal(P.isArrowCard({name: "Old", tt: "Ranger Action - Arrow Attack"}), true);
  assert.equal(P.isArrowCard({name: "Old2", tt: "Ranger Action - Arrowhead Attack"}), false);
});

test("`playableFromZone` is `!playZoneWhy` — one body, two spellings", () => {
  const arrow = {name: "A", tt: "Ranger Action - Arrow Attack", ty: ["Ranger", "Action", "Arrow", "Attack"]};
  for(const z of ["hand", "arsenal", "grave", "banish", "weapon"])
    assert.equal(P.playableFromZone(arrow, z, {}), !P.playZoneWhy(arrow, z, {}), z);
  assert.equal(P.playableFromZone(arrow, "arsenal", {}), true);
  assert.equal(P.playableFromZone(arrow, "hand", {}), false);
  assert.equal(P.playableFromZone(null, "hand", {}), false, "no card is never playable");
});

test("THE POLICY inherits the rule: an arrow in hand is never proposed from there", {skip}, () => {
  /* `sparring.act` filters every proposal through `legal`, so it cannot
     propose a refusal (its own contract) — and it must still find the
     arsenal play when there is one. */
  H.db();
  const S = require("../engine/sparring");
  const shot = {...(H.card("Swift Shot", 1) || H.card("Swift Shot", 2)), uid: "AH"};
  const g = holding(shot, "hand");
  const a = S.act(g, 0);
  assert.ok(!(a && a.t === "play" && a.uid === "AH" && a.from === "hand"), "the policy proposed an arrow from hand");
  const g2 = holding(shot, "arsenal");
  const a2 = S.act(g2, 0);
  assert.ok(a2 && a2.t === "play" && a2.from === "arsenal", "the policy no longer plays an arrow from the arsenal: "
    + JSON.stringify(a2));
});

/* ---- 2. THE ADDITIONAL DISCARD --------------------------------------- */

test("Savage Feast with nothing else in hand is REFUSED at the table", {skip}, () => {
  H.db();
  const sf = H.card("Savage Feast", 1);
  assert.equal(P.fxParse(sf).addCost.discard, 1, "fixture: Savage Feast's additional cost moved");
  assert.match(String(why(holding(sf, "hand"), "hand")), /additional cost discards 1 at random/,
    "the table swings Savage Feast for nothing again");
});

test("…and the PITCH counts: one other card and nothing floating is still refused", {skip}, () => {
  /* the half the trainer's own copy missed — that card pays the resource
     cost, so there is nothing left for the discard */
  H.db();
  const sf = H.card("Savage Feast", 1);
  const g = holding(sf, "hand", {res: 0, hand: [{...sf, uid: "UT"}, vanilla("F1", 3)]});
  assert.match(String(why(g, "hand")), /after paying for it you would hold no cards/);
  /* the near-miss: the same hand with the cost already floating */
  const g2 = holding(sf, "hand", {res: 1, hand: [{...sf, uid: "UT"}, vanilla("F1", 3)]});
  assert.equal(why(g2, "hand"), null, "a floating resource leaves the card for the discard");
  /* and two other cards: one pitches, one is discarded */
  const g3 = holding(sf, "hand", {res: 0, hand: [{...sf, uid: "UT"}, vanilla("F1", 3), vanilla("F2", 1)]});
  assert.equal(why(g3, "hand"), null);
});

test("the payment cannot spend the card the discard needs", {skip}, () => {
  H.db();
  const sf = H.card("Savage Feast", 1);
  const g = holding(sf, "hand", {res: 0, hand: [{...sf, uid: "UT"}, vanilla("F1", 1), vanilla("F2", 1)]});
  let n = J.reduce(g, {t: "play", uid: "UT", from: "hand"}, 0).state;
  assert.equal(J.pendingOf(n) && J.pendingOf(n).kind, "pay", "fixture: no payment opened");
  n = J.reduce(n, {t: "paySel", uid: "F1"}, 0).state;
  n = J.reduce(n, {t: "paySel", uid: "F2"}, 0).state;
  assert.match(String(J.legal(n, {t: "payConfirm"}, 0)), /leaves no cards for Savage Feast's additional discard/,
    "a pitch that took both cards was accepted — the discard had nothing left");
  /* one pitched, one kept: confirmed, and the kept card is the one discarded */
  n = J.reduce(n, {t: "paySel", uid: "F2"}, 0).state;    /* toggles F2 back out */
  assert.equal(J.legal(n, {t: "payConfirm"}, 0), null);
  n = H.drain(J.reduce(n, {t: "payConfirm"}, 0).state);
  assert.ok(n.sides[0].grave.some(c => c.uid === "F2"), "the discard did not take the card the payment left");
  assert.deepEqual(INV.errors(n), []);
});

test("the played card is never its own discard, wherever it is played from", () => {
  /* the card is excluded BY UID: from the hand that removes it, from the
     arsenal it was never there — so the reader takes no zone at all */
  const sf = {name: "Synthetic Feast", uid: "S", pitch: 1, cost: 0, power: 6, def: 3,
              tt: "Brute Action - Attack", ty: ["Brute", "Action", "Attack"], kw: [],
              tx: "As an additional cost to play this, discard a random card."};
  P.fxReset();
  const sd = {res: 0, hand: [sf]};
  assert.match(String(P.addCostWhy(sd, sf, 0)), /no cards/, "from hand, the card is not its own discard");
  assert.equal(P.addCostWhy({res: 0, hand: [vanilla("X", 1)]}, sf, 0), null,
    "from the arsenal, the one card in hand pays the discard");
  P.fxReset();
});

/* ---- 3. THE TRAINER ASKS THE SAME READERS ---------------------------- */

const stripSrc = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HTML = stripSrc(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
const TRY = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx,half)"), HTML.indexOf("const confirmPay = () => setG"));
const PAY = HTML.slice(HTML.indexOf("const confirmPay = () => setG"), HTML.indexOf("const cancelPay = () => setG"));

test("the trainer's door asks the zone reader and REFUSES on it", () => {
  assert.ok(TRY.length > 5000, "the tryPlay anchors moved — re-anchor");
  /* THE WHOLE CONDITIONAL (v4.00, v4.55): a scan for the bare call cannot
     tell a live guard from a neutered one */
  assert.match(TRY, /const _zw = DawnParser\.playZoneWhy\(card, from,[^;]*\);\s*if\(_zw\) return L\(s,/,
    "tryPlay does not refuse on the shared zone reader");
  assert.ok(!/isArrow\(card\)/.test(TRY), "the trainer's private arrow test came back beside the reader");
  assert.match(TRY, /from==="hand" \|\| from==="arsenal" \|\| from==="grave" \|\| from==="banish"/,
    "the door must ask the reader for every zone a card is PLAYED from");
});

test("…and the additional-cost reader, and the payment refuses too", () => {
  assert.match(TRY, /const _ac = DawnParser\.addCostWhy\(act\(s\), card, payCost\(s, card, from\)\);\s*if\(_ac\) return L\(s,/,
    "tryPlay does not refuse on the shared additional-cost reader");
  assert.ok(PAY.length > 500, "the confirmPay anchors moved — re-anchor");
  assert.match(PAY, /if\(_left < _ac\.discard\)\s*return L\(s,/,
    "confirmPay accepts a pitch that leaves nothing for the additional discard");
});

/* ---- 4. THE HELD PLAY PAYS ITS DISCARD WHEN IT IS PLAYED -------------
   FOUND BY AN ADVERSARIAL REVIEW of this version, after every drill above
   and the ladder were green (two of four reviewers, independently). The
   table HOLDS a play on the stack (v4.66) and `execute` took the discard
   only as it resolved — so Kayo could answer his own Savage Feast with
   Agile Windup ("Instant - Discard this: …"), empty his hand, and let it
   resolve with nothing left to take. Costs are paid when a card is played,
   so `judge.holdPlay` pays it there now. */

function feast(hand, deck){
  return Object.assign(H.state({res: 0, ap: 1, hand, deck: deck || []}, {hp: 20, hand: []}, {turn: 5, actor: 0}),
    {phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null});
}
const playPaid = (g, pitchUid) => {
  let n = J.reduce(g, {t: "play", uid: "SF", from: "hand"}, 0).state;
  n = J.reduce(n, {t: "paySel", uid: pitchUid}, 0).state;
  return J.reduce(n, {t: "payConfirm"}, 0).state;
};

test("the discard is taken AT PLAY: an instant in hand cannot dodge it", {skip}, () => {
  H.db();
  const sf = {...H.card("Savage Feast", 1), uid: "SF"};
  const aw = {...H.card("Agile Windup", 3), uid: "AW"};
  assert.ok(/discard this/i.test(aw.tx || ""), "fixture: Agile Windup no longer discards itself as a cost");
  /* two spare cards: one is the random discard, taken BEFORE the window */
  const n = playPaid(feast([sf, aw, vanilla("F1", 1), vanilla("F2", 3)]), "F1");
  assert.equal((n.stack || []).length, 1, "fixture: the play did not wait on the stack");
  assert.equal(n.sides[0].grave.length, 1, "the additional discard was not paid when the card was played");
  assert.equal(n.sides[0].hand.length, 1, "exactly one spare card is left to answer with");
  assert.deepEqual(INV.errors(n), []);
  /* AND IT IS TAKEN ONCE: resolution reads the held discard, never pays again */
  const r = H.drain(n);
  assert.equal(r.sides[0].hand.length, 1, "the discard was paid a second time at resolution");
  assert.equal(r.sides[0].grave.length, 1);
  /* one spare card: it IS the cost, so there is nothing left to answer with */
  const m = playPaid(feast([sf, aw, vanilla("F1", 1)]), "F1");
  assert.ok(m.sides[0].grave.some(c => c.uid === "AW"), "the only spare card was not taken as the cost");
  assert.ok(!m.sides[0].hand.some(c => c.uid === "AW"), "Agile Windup survived to answer its own cost");
});

test("…and the rider still reads the card the HOLD discarded", {skip}, () => {
  /* "if a card with 6 or more {p} was discarded as an additional cost to
     play it, draw a card" — `_discWay` is cleared per resolution inside
     `execute`, so a discard paid before it must be re-credited there or the
     rider reads nothing (v4.09: check where the state you write is cleared) */
  H.db();
  const sf = {...H.card("Savage Feast", 1), uid: "SF"};
  const big = vanilla("BIG", 1); big.power = 7; big.name = "Seven Swing";
  const top = vanilla("TOP", 2);
  let n = playPaid(feast([sf, big, vanilla("F1", 1)], [top]), "F1");
  n = H.drain(n);
  assert.ok(n.sides[0].grave.some(c => c.uid === "BIG"), "fixture: the 7-power card was not the discard");
  assert.ok(n.sides[0].hand.some(c => c.uid === "TOP"),
    "the 6+-power discard paid at the hold did not reach the rider — no card drawn");
});

test("the table's pay sheet says WHY a covered pitch cannot confirm, the advisor coaches no refused play", () => {
  /* a covered sheet over a dead button reads as a broken screen (v2.83) */
  assert.match(HTML, /const why=short>0\?null:DawnJudge\.legal\(g,\{t:"payConfirm"\},mySeat\);/,
    "the table's pay statusline no longer asks legal why a covered pitch is refused");
  const ADV = stripSrc(fs.readFileSync(path.join(__dirname, "..", "engine", "advisor.js"), "utf8"));
  assert.match(ADV, /if\(P\.playZoneWhy\(c, "hand", \{\}\)\) return;/, "the advisor's hand candidates skip the zone rule");
  assert.match(ADV, /if\(P\.addCostWhy\(you\(g\), c, effCost\(c, you\(g\)\)\)\) return;/,
    "the advisor coaches a play whose additional cost cannot be paid");
});

test("the rider fires with ONE line — the feed no longer says 'not met' first (v3.60)", {skip}, () => {
  /* THE FEED IS THE OBSERVABLE WHEN THE STATE IS IDENTICAL: removing the
     condition loop's skip changes no zone, and the player is told the
     condition failed one line before the draw it grants. */
  H.db();
  const sf = {...H.card("Savage Feast", 1), uid: "SF"};
  const big = vanilla("BIG", 1); big.power = 7; big.name = "Seven Swing";
  const n = H.drain(playPaid(feast([sf, big, vanilla("F1", 1)], [vanilla("TOP", 2)]), "F1"));
  assert.ok(!(n.feed || []).some(m => /condition not met \(discard6way\)/.test(m)),
    "the feed says the rider's condition failed before the rider fires");
  assert.ok((n.feed || []).some(m => /a 6\+ power card was fed to the cost/.test(m)), "and it says why it fired");
});

test("PREMISE: Savage Feast is the pool's only additional discard, and its rider is the cost site's", {skip}, () => {
  /* why the held discard is NOT credited to `_discWay`: the one rider that
     reads it is asked at the cost site, off the cards the cost took. A card
     arriving with an additional discard AND a "this way" reader of it fails
     here, and that credit becomes observable and must be built. */
  H.db();
  const pool = require("../data/pool.json"), found = new Set();
  for(const r of pool){
    const c = {name: r.name, tx: r.functional_text || "", tt: r.type_text, ty: r.types, kw: r.card_keywords,
               pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense};
    const fx = P.fxParse(c);
    if(!fx.addCost || !fx.addCost.discard) continue;
    found.add(r.name);
    for(const k of fx.conds || [])
      assert.ok(!/^way:/.test(k.cond), r.name + " reads its additional discard as a 'this way' condition");
  }
  assert.deepEqual([...found], ["Savage Feast"], "the additional-discard family moved");
});
