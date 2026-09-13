/* test/charge.test.js — A COST THAT COULD NOT BE REFUSED (v4.33)
 *
 * > "As an additional cost to play this, YOU MAY charge your hero's soul."
 * >   — BOLT OF COURAGE · ENGULFING LIGHT · TAKE FLIGHT, nine records
 * >
 * > "As an additional cost to playing a card with charge you may put a
 * >  card from your hand into your hero's soul. … *You may elect to not
 * >  pay the additional cost of charge — however this would mean you did
 * >  not charge.*"
 * >   — the-fab-cube `csvs/english/keyword.csv`, `develop`
 *
 * THE PARSE HAS READ THE "YOU MAY" SINCE CHARGE WAS BUILT, and `execute`
 * ignored it: it auto-picked from hand whenever the hand was non-empty,
 * preferring whatever pitch the card's own rider asked for. Its own
 * comment said why — *"the trainer has no prompt wired for a cost paid
 * before the card's own total is struck"* — and that stopped being true
 * at **v4.27**, which built exactly that machinery for fusion. A
 * recorded reason is only as good as the day it was measured (v3.69,
 * v4.26); this is the fourth recorded refusal to come due this cycle.
 *
 * IT IS A COST, so being unable to refuse is WEAKER than printed for its
 * controller — which is why the one-sided fairness sweep is blind and
 * why all nine records read `tier: full`. Bolt of Courage is the
 * sharpest: charged, it gets *"when this hits, draw a card"*, so the
 * engine spent a card from hand for a CONDITIONAL draw on every copy and
 * a blocked swing paid it for nothing. In a training sim that is a
 * losing trade made quietly on the player's behalf — the same reason
 * `selfPayOr` never pitches for them (v3.09).
 *
 * THE ANSWER IS WHICH CARD, NOT YES/NO — fusion's shape one cost over,
 * and more so: a revealed card stays in the hand and a charged one is
 * GONE to the soul.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const S = require("../engine/sparring.js");
const INV = require("../engine/invariants.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
const gate = t => H.hasDb() ? t : { skip: true };

/* WIDENED 3 -> 6 AT v4.48, AND THE REASON IS AN ANCHOR NOT A NEW CARD.
   The database prints the subject TWO WAYS AT ONCE — nine records say "your
   HERO'S soul" and seven say "your soul" — and this reader required the word
   "hero", so those seven read NOTHING while v4.41 had already taught
   `onChargeSoul` both spellings (v3.53: a fix for one matcher is not a fix
   for the shape). Six of the seven read `tier: full` with a rider that could
   never fire: Beaming Bravado's +1{p} and Light the Way's GO AGAIN are both
   gated on "if a yellow card is charged THIS WAY", and no charge ever
   happened. Every one of the six is Boltyn's. */
const CARDS = ["Beaming Bravado", "Bolt of Courage", "Engulfing Light",
               "Light the Way", "Take Flight", "V of the Vanguard"];

/* ---- the pool census, pinned as a SET ------------------------------- */

const POOL = () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "pool.json"), "utf8"))
    .filter(c => c && c.name).map(C.mapDbCard);
  const maps = C.buildMaps(raw);
  const out = [], seen = new Set();
  for(const m of raw){
    const c = C.resolveEntry(maps, {name: m.n, p: m.p, code: null, q: 1});
    if(!c) continue;
    const k = c.name + "|" + c.pitch;
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
};

test("six pool cards print charge, and BOTH printed spellings read", () => {
  const hits = POOL().filter(c => P.fxParse(c).chargeCost);
  assert.ok(hits.length >= 6, "the scan is alive — it found " + hits.length + " records");
  assert.deepEqual([...new Set(hits.map(c => c.name))].sort(), CARDS,
    "pinned as a SET: six cards, all Boltyn's");
  assert.equal(hits.length, 16, "sixteen records");

  /* BOTH SPELLINGS, COUNTED. This is the measurement the widening rests on,
     so it is asserted rather than described: an anchor that knows one of two
     printed wordings is a card waiting to be found (v3.36), and the day
     upstream levels one away this drill says which half moved. */
  const spell = w => hits.filter(c => new RegExp(w, "i").test(c.tx || ""))
    .map(c => c.name + "|" + c.pitch).sort();
  assert.equal(spell("charge your hero'?s? soul").length, 9,
    "nine records print \"your HERO'S soul\"");
  assert.deepEqual(spell("charge your soul"),
    ["Beaming Bravado|1", "Beaming Bravado|2", "Beaming Bravado|3",
     "Light the Way|1", "Light the Way|2", "Light the Way|3",
     "V of the Vanguard|2"],
    "and seven print plain \"your soul\" — the seven that read NOTHING before v4.48");

  /* `multi` — "any number of times" — WAS PINNED EMPTY AT v4.33 with the
     reason that the day a card printed it somebody would decide rather than
     it being quietly charged once. THIS IS THAT DAY: widening the anchor
     brought V of the Vanguard in, and it is the pool's only `multi` record.

     THE DECISION IS TO OFFER **ONE** CHARGE, and to say so. `chargeOffer`
     still carries only `uids` — the field has no reader — so a card printing
     "any number of times" is offered a single charge: WEAKER than printed,
     visible in the audit (its own payload clause still reads `skip`), and
     recorded in `tools/approx.js` as `charged-this-way-count` with a probe
     that goes red the day the count is built. Charging more than once
     silently would be the other direction. */
  assert.deepEqual(hits.filter(c => P.fxParse(c).chargeCost.multi)
    .map(c => c.name + "|" + c.pitch),
    ["V of the Vanguard|2"],
    "one record prints `any number of times`, and the offer still asks ONCE");
});

/* ---- the offer is the one reader ------------------------------------ */

const mk = (nm, uid) => ({uid, name: nm, pitch: 1, cost: 0, def: 2,
                          tt: "Generic Action", ty: ["Generic", "Action"], tx: ""});

test("`chargeOffer` offers every card in hand except the one being played", () => {
  const card = {uid: "src", name: "Charger", pitch: 1, cost: 0,
                tt: "Light Warrior Action - Attack", ty: ["Light", "Warrior", "Action", "Attack"],
                tx: "As an additional cost to play this, you may charge your hero's soul."};
  P.fxReset();
  const sd = {hand: [card, mk("A", "a1"), mk("B", "b1")]};
  const off = P.chargeOffer(card, sd, "src");
  assert.deepEqual(off.uids, ["a1", "b1"], "the card paying its own cost is never on the offer");
  assert.deepEqual(Object.keys(off), ["uids"],
    "and the offer carries NOTHING else — `multi` has no reader, so forwarding it "
    + "would be a field nobody consumes (v3.55)");
  /* NO OTHER CARD IN HAND MEANS NO OFFER — the play goes straight
     through uncharged, which is `buildPrompt`'s rule for an empty spec
     and the reason an empty deck never shows a boost sheet. */
  assert.equal(P.chargeOffer(card, {hand: [card]}, "src"), null, "a lone card offers nothing");
  assert.equal(P.chargeOffer(card, {hand: []}, "src"), null, "an empty hand offers nothing");
  /* AND A CARD THAT DOES NOT PRINT CHARGE IS NEVER OFFERED. */
  P.fxReset();
  assert.equal(P.chargeOffer(mk("Plain", "p1"), sd, "p1"), null,
    "a card with no printed charge is never offered the cost");
  P.fxReset();
});

/* ---- driven, at the table ------------------------------------------- */

function playCharger(nm, answer, seed){
  const atk = {...C.resolveEntry(H.db(), {name: nm, p: 1, code: null, q: 1}), uid: "ch"};
  assert.ok(P.fxParse(atk).chargeCost, nm + " prints charge");
  const spare = {...C.resolveEntry(H.db(), {name: nm, p: 3, code: null, q: 1}), uid: "sp"};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk, spare]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const out = J.reduce(g, {t: "play", uid: "ch", from: "hand"}, 0);
  assert.equal(out.error, null, "the play was refused: " + out.error);
  let n = out.state;
  assert.ok(n.pending && n.pending.kind === "charge",
    nm + " must OPEN the charge offer — it printed \"you may\"");
  assert.deepEqual(n.pending.uids, ["sp"], "and offer the other card in hand");
  n = J.reduce(n, {t: "charge", uid: answer}, 0).state;
  /* boost/fusion/addPay may follow; drain any that open. */
  for(let i = 0; i < 4 && n.pending; i++){
    const k = n.pending.kind;
    n = J.reduce(n, k === "boost" || k === "addPay" ? {t: k, yes: false}
                  : k === "fuse" ? {t: "fuse", uid: null}
                  : {t: "payConfirm"}, n.pending.seat).state;
  }
  return n;
}

for(const nm of CARDS){
  test(gate(nm + ": the charge is OFFERED, and taking it moves the named card"), () => {
    const n = playCharger(nm, "sp", "chg-take-" + nm);
    assert.deepEqual(n.sides[0].soul.map(x => x.uid), ["sp"], "the CHOSEN card is in the soul");
    assert.equal(n.sides[0].hand.length, 0, "and it left the hand");
    assert.equal(n.sides[0].hist.charged, 1, "hist.charged records it, which is what the riders read");
    assert.deepEqual(INV.errors(n), [], "and the card lands in exactly one zone");
  });

  test(gate(nm + ": DECLINING charges nothing — the printed \"you may\""), () => {
    /* BOTH HALVES, or the drill proves nothing. A refusal that always
       declines passes the take-drill's inverse perfectly. */
    const n = playCharger(nm, null, "chg-decline-" + nm);
    assert.deepEqual(n.sides[0].soul, [], "nothing reached the soul");
    assert.deepEqual(n.sides[0].hand.map(x => x.uid), ["sp"], "the card is still in hand");
    assert.ok(!n.sides[0].hist.charged, "and hist.charged never fired, so the riders stay unmet");
  });
}

test(gate("a uid that is not on the offer is REFUSED, not silently declined"), () => {
  const atk = {...C.resolveEntry(H.db(), {name: "Take Flight", p: 1, code: null, q: 1}), uid: "ch"};
  const spare = {...C.resolveEntry(H.db(), {name: "Take Flight", p: 3, code: null, q: 1}), uid: "sp"};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk, spare]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "chg-bad"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const n = J.reduce(g, {t: "play", uid: "ch", from: "hand"}, 0).state;
  /* `legal` and `reduce` must agree about what a seat may send
     (fuzz.test.js), so a guest sending a card it cannot charge is TOLD
     so rather than having it read as a decline. */
  assert.match(String(J.legal(n, {t: "charge", uid: "nope"}, 0) || ""), /not in hand to charge/);
  assert.equal(J.legal(n, {t: "charge", uid: null}, 0), null, "and null — the decline — is always legal");
  /* AND `execute` RE-DERIVES IT ANYWAY, because reduce is fed by JSON off
     a wire (v2.48). Both halves are driven: a uid nothing holds, and the
     SOURCE CARD'S OWN — the one card the offer excludes. */
  for(const [uid, why] of [["nope", "a uid nothing holds charges nothing"],
                           ["ch",   "and the card paying its own cost can never be the payment"]]){
    const forged = J.withEffects({...n, pending: null, _chargeUid: uid, actor: 0},
      (fx, s) => fx.execute(s, atk, "hand", 0, {}));
    assert.deepEqual(forged.sides[0].soul, [], why);
  }
});

test(gate("the offer is not made when there is nothing to charge"), () => {
  const atk = {...C.resolveEntry(H.db(), {name: "Take Flight", p: 1, code: null, q: 1}), uid: "ch"};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [atk]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "chg-alone"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const n = J.reduce(g, {t: "play", uid: "ch", from: "hand"}, 0).state;
  assert.ok(!(n.pending && n.pending.kind === "charge"),
    "a lone card in hand cannot pay, so the play goes straight through");
});

/* ---- the policy declines, and that is a stated choice ---------------- */

test("`sparring.act` declines the charge — it cannot weigh the payoff", () => {
  /* v4.24's standing rule: DECLINE a price this policy cannot weigh.
     Fusion escaped it because nothing moves zones and its price is
     provably zero for a policy holding full state; charge's is not — a
     card LEAVES THE HAND, and a card in hand can always block. */
  const card = {uid: "src", name: "Charger", pitch: 1, cost: 0,
                tt: "Light Warrior Action - Attack", ty: ["Light", "Warrior", "Action", "Attack"],
                tx: "As an additional cost to play this, you may charge your hero's soul."};
  const g = H.state({name: "You", res: 9, ap: 1, hand: [card, mk("A", "a1")]},
                    {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "chg-policy"});
  const withPend = {...g, phase: "action", step: "layer", priority: 0, passed: [],
                    pending: {kind: "charge", seat: 0, card, from: "hand",
                              window: "action", target: null, uids: ["a1"]}};
  const a = S.act(withPend, 0);
  assert.deepEqual(a, {t: "charge", uid: null}, "it answers the pending, and it answers NO");
  /* A REFUSAL IS ALWAYS A BUG IN THAT FILE (its own contract), so the
     answer must be legal. */
  assert.equal(J.legal(withPend, a, 0), null, "and the answer is legal");
});

/* ---- the one reader, and the auto-pick is gone ---------------------- */

test("the played card is out of hand BEFORE the charge block, so it can never pay its own cost", () => {
  /* THE PREMISE A DELETION RESTS ON IS DRIVEN, NOT STATED (v4.11).
     `execute`'s re-derivation is `hand.find` alone — no `offer.uids`
     test, because at that point the offer IS the hand: the played card
     was removed three hundred lines earlier. Sabotaging that test open
     is SILENT for exactly this reason, so what is drilled is the fact it
     rested on. Move the charge block above the splice and this fails. */
  const src = SRC.indexOf('if(from==="hand"){ actMut(n).hand = act(n).hand.filter');
  const chg = SRC.indexOf("if(fx.chargeCost){");
  assert.ok(src > 0 && chg > 0, "both anchors are still in the file");
  assert.ok(src < chg,
    "the played card leaves the hand before the charge block — otherwise `hand.find` "
    + "would accept the card paying its own cost and the offer test would be load-bearing");
  /* AND BEHAVIOURALLY, not only by position: `chargeOffer` asked at that
     point returns an offer that does not contain the source card, because
     the source card is no longer in the hand to offer. */
  const card = {uid: "src", name: "Charger", pitch: 1, cost: 0,
                tt: "Light Warrior Action - Attack", ty: ["Light", "Warrior", "Action", "Attack"],
                tx: "As an additional cost to play this, you may charge your hero's soul."};
  P.fxReset();
  assert.deepEqual(P.chargeOffer(card, {hand: [mk("A", "a1")]}, "src").uids, ["a1"],
    "after the splice the offer is simply the hand");
  P.fxReset();
});

test("`execute` re-derives the answer and no longer picks a card itself", () => {
  const i = SRC.indexOf("if(fx.chargeCost){");
  assert.ok(i > 0, "the charge block moved — re-anchor this drill");
  /* COMMENTS STRIPPED FIRST. A source scan that reads its own
     documentation answers about the prose rather than the code — v4.27's
     `failstates.js` lesson, and its first draft here matched a comment
     mentioning `advValue` and then missed the `find` because the header
     had pushed it past the slice. */
  const body = SRC.slice(i, i + 2400).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(body, /n\._chargeUid/, "the answer rides on the state");
  assert.match(body, /act\(n\)\.hand\.find\(c2 => c2 && c2\.uid === n\._chargeUid\)/,
    "and is RE-DERIVED against the hand, because reduce is fed by JSON off a wire");
  /* THE AUTO-PICK IS THE DEFECT, and it must be gone rather than guarded:
     a scan for the flag alone passes on an engine that still ranks the
     hand and then ignores the ranking. */
  assert.doesNotMatch(body, /advValue/, "no advisor ranking picks the card for the player");
  assert.doesNotMatch(body, /chargedPitch\\\\d/, "and no pitch is preferred on their behalf");
});

test("the answer is cleared per resolution, so a spent charge cannot ride", () => {
  /* `_half`, `_doBoost`, `_addPaid` and `_fuseUid` all learned this the
     hard way: left on the state, the NEXT card printing the keyword is
     played as whatever the last one answered, without asking. */
  const jsrc = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(jsrc, /delete n\._fuseUid; delete n\._chargeUid;/,
    "judge strips it with its siblings");
  const htm = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(htm, /if\(n\._chargeUid !== undefined\)\{ n = \{\.\.\.n\}; delete n\._chargeUid; \}/,
    "and so does the trainer");
});

test("both boards offer it, and neither hard-codes what the other reads", () => {
  /* v3.01's shape is the recurring defect in exactly this area: a rule
     that exists on one board only. Both ask `chargeOffer`. */
  const htm = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const jsrc = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  /* PIN THE BRANCH, NOT THE CALL. A scan for the call alone stays green
     when the ternary's condition is changed to `false` — driven, that
     sabotage came back SILENT, which is v3.94's rule (a source slice
     rots where a rule moves) with the trainer's `tryPlay` unreachable
     from Node because it is a closure inside a React component. What a
     source scan can honestly carry here is the whole expression. */
  assert.match(htm, /return off \? \{\.\.\.s, mode:"chargepick", pending:\{card,from,idx,uids:off\.uids\}\}/,
    "the trainer opens the pending on the OFFER, not on a constant");
  assert.match(htm, /DawnParser\.chargeOffer\(card, act\(s\), card && card\.uid\)/,
    "and it asks the one reader");
  assert.match(jsrc, /PR\.chargeOffer\(card, at\(g, seat\), card && card\.uid\)/,
    "and so does judge");
  /* AND EVERY BOARD RENDERS A BRANCH FOR IT — a kind demuxed and never
     rendered is a screen with no exit (v3.35). `split.test.js` holds the
     census; this pins the two buttons a player actually taps. */
  assert.match(htm, /confirmCharge\(null\)/, "the trainer offers a decline");
  assert.match(htm, /fire\(\{t:"charge",uid:null\}\)/, "and so does the table");
});

/* ---- v4.48 — THE SIX RECORDS THE OLD ANCHOR COULD NOT REACH ---------- */

test("DRIVEN: Beaming Bravado's colour gate, all three rows", gate({}), () => {
  /* IT PRINTS "if a YELLOW card is charged this way, this gets +1{p}", read
     `run`, and could never once fire — the charge it is gated on never
     happened, because the anchor required "your HERO'S soul" and the card
     prints "your soul". `tier: full` throughout, so coverage was blind, and
     the loss is WEAKER than printed, which the one-sided sweep does not
     look for.

     THREE ROWS, AND THE THIRD IS THE ONE THAT BITES. A colour-blind reader
     passes the first two perfectly: declining grants nothing and charging a
     yellow grants +1 under either reading. Only charging a RED separates
     them (v3.26). */
  H.db();
  const run = (charge, pitch) => {
    P.fxReset();
    const atk = {...H.card("Beaming Bravado", 1), uid: 51};
    const pay = {...H.card("Beaming Bravado", pitch), uid: 52};
    const g = {...H.state({res: 9, ap: 1, hand: [atk, pay]}, {},
                          {turn: 3, actor: 0, turnPlayer: 0}),
               stack: [], chain: [], phase: "action", step: "layer",
               priority: 0, passed: []};
    let out = J.reduce(g, {t: "play", uid: 51, from: "hand"}, 0);
    assert.ok(!out.error, "the play was refused: " + out.error);
    const kind = out.state.pending && out.state.pending.kind;
    assert.equal(kind, "charge", "the charge offer must open — that is the whole fix");
    out = J.reduce(out.state, charge ? {t: "charge", uid: 52} : {t: "charge"}, 0);
    assert.ok(!out.error, "the answer was refused: " + out.error);
    return {total: out.state.pend.total, soul: out.state.sides[0].soul.length,
            pitch: out.state.pend.chargedPitch};
  };
  assert.equal(H.card("Beaming Bravado", 1).power, 3, "the printed power, so the sum is visible");
  assert.deepEqual(run(false, 2), {total: 3, soul: 0, pitch: null},
    "declined — the printed power and nothing in the soul");
  assert.deepEqual(run(true, 2), {total: 4, soul: 1, pitch: 2},
    "a YELLOW charged — the printed +1 lands for the first time");
  assert.deepEqual(run(true, 1), {total: 3, soul: 1, pitch: 1},
    "a RED charged — the cost is paid and the gate is NOT met");
});

test("the subject is CLOSED to your own soul — the near-miss is synthetic",
     gate({}), () => {
  /* THE WIDENING IS MEASURED, NOT GENEROUS. `charge your (hero's )? soul`
     admits both printed spellings and NOTHING ELSE — widened to
     `charge[^.]*soul` every sabotage comes back SILENT, because no pool
     card prints a different phrase in that position, so the guard's value
     is entirely latent and only a synthetic can see it (v3.73).

     WHAT IT PROTECTS IS THE SEAT. `chargeOffer` reads the ACTOR's hand and
     `execute` puts the card into the ACTOR's own soul, so a clause naming
     somebody else's soul read by this anchor would bill the wrong player —
     `tapFoeHero`'s inversion (v3.48) one cost over. And a charge out of a
     zone other than the hand is a different mechanic entirely. */
  const at = tx => { P.fxReset();
    return P.fxParse({name: "SYN-CHG-" + tx.length, pitch: 1, cost: 1, power: 3,
      tt: "Light Warrior Action - Attack", ty: ["Light", "Warrior", "Action", "Attack"],
      tx, kw: [], gkw: []}).chargeCost; };

  /* BOTH PRINTED FORMS — the positive controls, or a guard that refuses
     everything passes the refusals below perfectly (v3.98). */
  assert.deepEqual(at("As an additional cost to play this, you may charge your soul."),
    {multi: false}, "the plain printed form reads");
  assert.deepEqual(at("As an additional cost to play this, you may charge your hero's soul."),
    {multi: false}, "and so does the hero's form");
  assert.deepEqual(at("As an additional cost to play this, you may charge your soul any number of times."),
    {multi: true}, "and `multi` comes off the printed words");

  /* THE NEAR MISSES. */
  assert.equal(at("As an additional cost to play this, you may charge your opponent's soul."),
    undefined, "somebody ELSE's soul is a different cost, billed to a different seat");
  assert.equal(at("As an additional cost to play this, you may charge a card from your graveyard into your soul."),
    undefined, "a charge out of another zone is a different mechanic");
});

test("DRIVEN: Light the Way's rider is an ACTION POINT, and it was unreachable",
     gate({}), () => {
  /* "When this hits, if a yellow card was charged this way, this gets GO
     AGAIN" — CR 5.3.5 makes that a GAIN of one action point, which this
     project's own notes call the most valuable keyword in the game to get
     wrong. Same root: no charge, so the gate never met. */
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Light the Way", 1));
  assert.ok(fx.chargeCost, "its charge cost reads at all — the v4.48 half");
  const gate = (fx.condOnHit || []).find(e => /charg/i.test(e.cond || ""));
  assert.ok(gate, "and the rider is a gated ON-HIT, not an unconditional grant");
  assert.deepEqual(gate.op, ["ga"], "whose payload is the action point");
});

test("the offer's feed line names ONE seat, and agrees with it", gate({}), () => {
  /* Seat 0 is literally named "You" (v2.83), so the hardcoded "their" in
     this line read "You may put a card from hand into THEIR hero's soul" —
     naming one seat and agreeing with the other, on all 16 records. `sp`
     inflects the NAME (v4.22) rather than replacing it with "your", so a
     hero name keeps its apostrophe-s. */
  H.db();
  P.fxReset();
  const atk = {...H.card("Beaming Bravado", 1), uid: 55};
  const pay = {...H.card("Beaming Bravado", 2), uid: 56};
  const line = who => {
    const g = {...H.state({res: 9, ap: 1, hand: [atk, pay], name: who}, {},
                          {turn: 3, actor: 0, turnPlayer: 0}),
               stack: [], chain: [], phase: "action", step: "layer",
               priority: 0, passed: []};
    const out = J.reduce(g, {t: "play", uid: 55, from: "hand"}, 0);
    assert.ok(!out.error, out.error);
    return (out.state.feed || []).find(l => /has charge/.test(l)) || "";
  };
  assert.match(line("You"), /You may put a card from hand into your soul/,
    "a seat genuinely called \"You\" still reads in the second person");
  assert.ok(!/their/.test(line("You")), "and never disagrees with itself");
  assert.match(line("Boltyn, Breaker of Dawn"),
    /Boltyn, Breaker of Dawn may put a card from hand into Boltyn, Breaker of Dawn's soul/,
    "a named seat is NAMED, and its possessive keeps the apostrophe-s");
});
