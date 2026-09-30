/* ============================================================
   WHICH CARD AN ACTIVATION'S DISCARD COST SPENDS (v4.85)

     "Action - Discard an ally, destroy this: Draw a card. Go again"
                                                  — CARRION CROWN
     "Attack Reaction - Discard an Assassin card: …"
                                                  — five Agents of Chaos

   v4.81 made a discard with no randomness the DISCARDER's choice, and
   recorded the half it could not reach as `cost-discard-auto-picked`: an
   activation's discard is a COST, paid before the ability resolves, so a
   queued sheet (which opens after resolution, v3.34) is the wrong shape.
   `execute` took the FIRST matching card in hand, on both boards.

   It is a PENDING now, the `xval` pending's shape (v4.72): asked before
   the payment, answered with a uid, and the answer rides on the state as
   `_discCostUid` into `execute`. `prompts.discCostChoice` is the one
   reader of what could pay, and it answers only when two DIFFERENT cards
   could (two copies of one card are one choice, and one card is none).

   THE TRAINER'S HALF IS A SOURCE SCAN, stated as one: `tryPlay` is a
   closure inside `Battle`. It was driven on the page at phone dimensions
   instead — Gravy Bones, two allies, the second one chosen and filed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const PM = require("../engine/prompts.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* ---- fixtures ------------------------------------------------------ */

const card = (n, p, uid) => Object.assign({}, C.resolveEntry(H.db(), {name: n, p, code: null, q: 1}), {uid});

/* Carrion Crown in the gear of a seat at its own action phase — the same
   board `test/carrion.test.js` drives, so both files ask one shape. */
function crownBoard(hand){
  const cc = C.resolveEntry(H.db(), {name: "Carrion Crown", p: 0, code: null, q: 1});
  const pw = P.parseHeroPower(cc.tx, true);
  const pc = {name: "Carrion Crown — ability", pitch: 0, cost: 0, power: null, def: null,
    tt: "Equipment Ability", kw: ["Go again"], gkw: [], tx: "Draw a card. Go again",
    sd: true, _discardCost: pw.discardCost.filter,
    _discardSubject: pw.discardCost.subject, uid: "gp901"};
  const gear = Object.assign({}, cc, {uid: 901, pow: pw, powCard: pc});
  const g = H.state({gear: [gear], hand, deck: [card("Wounding Blow", 1, 600), card("Wounding Blow", 2, 601)],
                     res: 9, ap: 1}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  return Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []});
}
const ACT = {t: "activate", uid: 901, from: "gear"};
const R = (g, a, seat) => {
  const r = J.reduce(g, a, seat == null ? 0 : seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  return r.state;
};

function agentPow(frag){
  const a = B.agentsOf(H.db(), "chaos").find(x => new RegExp(frag, "i").test(x.n));
  assert.ok(a, "fixture: no Agent matching " + frag);
  return B.heroAbilities(a, a.n).HPOW;
}
const ASN = (uid, name) => ({uid, name, tt: "Assassin Action - Attack",
  ty: ["Assassin", "Action", "Attack"], power: 3, pitch: 1, cost: 1, def: 2, kw: [], tx: ""});

/* ---- 1. THE READER -------------------------------------------------- */

test("discCostChoice asks only when two DIFFERENT cards could pay", {skip}, () => {
  H.db();
  const pw = agentPow("Tarantula");
  const plain = {uid: 9, name: "Plain", tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"],
                 power: 3, pitch: 1, cost: 1, def: 2, kw: [], tx: ""};
  assert.deepEqual(PM.discCostChoice(pw, {hand: [ASN(1, "A"), plain, ASN(2, "B")]}), [1, 2],
    "two different Assassin cards are a choice, in HAND ORDER");
  assert.equal(PM.discCostChoice(pw, {hand: [ASN(1, "A"), plain]}), null,
    "one card that can pay is no question (v3.55)");
  assert.equal(PM.discCostChoice(pw, {hand: [ASN(1, "A"), ASN(2, "A")]}), null,
    "two copies of one card are the same card for this purpose");
  const twoPitches = [ASN(1, "A"), Object.assign(ASN(2, "A"), {pitch: 3})];
  assert.deepEqual(PM.discCostChoice(pw, {hand: twoPitches}), [1, 2],
    "…but one NAME at two pitches is two cards: the pitch is what the player keeps");
  assert.equal(PM.discCostChoice({name: "Probe", tx: "Draw a card"}, {hand: [ASN(1, "A"), ASN(2, "B")]}), null,
    "an ability with no discard cost is never asked");
});

/* ---- 2. DRIVEN AT THE TABLE ----------------------------------------- */

test("DRIVEN: two allies — the seat is ASKED, and the card it names is the one spent", {skip}, () => {
  H.db();
  const g = crownBoard([card("Barnacle", 2, 500), card("Brutal Assault", 1, 501), card("Swabbie", 2, 502)]);
  const asked = R(g, ACT);
  assert.equal(asked.pending && asked.pending.kind, "discost", "no question was asked");
  assert.deepEqual(asked.pending.uids, [500, 502], "the candidates are the two allies, in hand order");
  assert.equal(asked.sides[0].hand.length, 3, "nothing is spent while the question is open");
  const n = H.drain(R(asked, {t: "discost", uid: 502}));
  const gy = n.sides[0].grave.map(c => c.uid);
  assert.ok(gy.includes(502), "Swabbie was named and not discarded");
  assert.ok(!gy.includes(500) && n.sides[0].hand.some(c => c.uid === 500),
    "Barnacle was discarded anyway — the engine's pick, not the seat's (the v4.81 record)");
  assert.ok(H.filed(n.sides[0], 901), "…and the other half of the cost, the Crown, is still paid");
  assert.equal(n._discCostUid, undefined, "the answer outlived its activation");
});

test("DRIVEN: the FIRST candidate is still the old answer — the question changed nothing else", {skip}, () => {
  H.db();
  const n = H.drain(R(R(crownBoard([card("Barnacle", 2, 500), card("Swabbie", 2, 502)]), ACT), {t: "discost", uid: 500}));
  assert.ok(n.sides[0].grave.some(c => c.uid === 500));
  assert.ok(n.sides[0].hand.some(c => c.uid === 502));
});

test("DRIVEN: no choice, no question — one ally, or two copies of one", {skip}, () => {
  H.db();
  for(const hand of [[card("Barnacle", 2, 500), card("Brutal Assault", 1, 501)],
                     [card("Barnacle", 2, 500), card("Barnacle", 2, 503)]]){
    const n = R(crownBoard(hand), ACT);
    assert.ok(!(n.pending && n.pending.kind === "discost"), "a forced choice was put to the seat");
    const d = H.drain(n);
    assert.ok(d.sides[0].grave.some(c => c.uid === 500), "the only answer was not taken");
  }
});

test("DRIVEN: while the ability WAITS, the answer rides on the layer, not the state", {skip}, () => {
  /* v4.66 holds an action-speed play on the stack until both seats pass,
     and `HELD_DECL` is what it carries there. An activation reaches
     `holdPlay` without going through `commitPlayBoosted`, which is what
     strips a declaration off every other play, so the answer would sit on
     the STATE while the ability waited, for any other resolution in the
     window to spend. The opponent holding Cloud Cover is what makes the
     window usable, and so what makes the ability wait. */
  H.db();
  let g = crownBoard([card("Barnacle", 2, 500), card("Swabbie", 2, 502)]);
  g = Object.assign(g, {sides: [g.sides[0], Object.assign({}, g.sides[1], {hand: [card("Cloud Cover", 3, 700)], res: 3})]});
  let n = R(R(g, ACT), {t: "discost", uid: 502});
  assert.equal((n.stack || []).length, 1, "fixture: the ability did not wait — nothing is being tested");
  assert.equal(n._discCostUid, undefined, "the answer sat on the state while the ability waited");
  n = H.drain(n);
  assert.ok(n.sides[0].grave.some(c => c.uid === 502), "the answer did not survive the wait");
  assert.ok(n.sides[0].hand.some(c => c.uid === 500));
});

test("the answer is LEGAL only as one of the named candidates, and only while asked", {skip}, () => {
  H.db();
  const asked = R(crownBoard([card("Barnacle", 2, 500), card("Brutal Assault", 1, 501), card("Swabbie", 2, 502)]), ACT);
  assert.match(String(J.legal(asked, {t: "discost", uid: 501}, 0)), /not one the cost can spend/,
    "a card the cost excludes was accepted as the answer");
  assert.match(String(J.legal(asked, {t: "pass"}, 0)), /discards first/,
    "the game went on around an open question");
  assert.ok(J.legal(asked, {t: "discost", uid: 502}, 1), "the other seat answered the question");
  assert.match(String(J.legal(crownBoard([card("Barnacle", 2, 500)]), {t: "discost", uid: 500}, 0)),
    /nothing is asking/, "an answer with nothing asking was accepted");
});

test("DRIVEN: an Agent's attack-reaction ability asks too — in the reaction window", {skip}, () => {
  H.db();
  /* Redback, because it targets an ASSASSIN attack; Tarantula's target is
     a dagger attack, which the probe swing is not. */
  const pw = agentPow("Redback");
  const atk = {uid: 7300, name: "Probe Dagger Swing", tt: "Assassin Action - Attack",
    ty: ["Assassin", "Action", "Attack"], power: 3, pitch: 1, cost: 0, def: 2, kw: [], tx: ""};
  let g = H.state({hand: [atk, ASN(7301, "Art Probe A"), ASN(7302, "Art Probe B")], res: 9, ap: 1},
                  {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  g = Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: [], builds: [{HPOW: pw}, {}]});
  g = R(g, {t: "play", uid: 7300, from: "hand"});
  for(let i = 0; i < 8 && g.step !== "reaction"; i++) g = R(g, {t: "pass"}, g.priority);
  assert.equal(g.step, "reaction", "fixture: the attack did not reach its reaction step");
  const why = J.legal(g, {t: "activate", uid: "hpow", from: "hero"}, 0);
  if(why && !/discard|assassin/i.test(why)){
    /* the Agent's own target restriction may refuse a probe attack; that is
       not the question here, so it is said rather than hidden */
    assert.fail("fixture: the Agent's ability is refused for another reason: " + why);
  }
  const asked = R(g, {t: "activate", uid: "hpow", from: "hero"});
  assert.equal(asked.pending && asked.pending.kind, "discost", "the reaction window asked nothing");
  const n = R(asked, {t: "discost", uid: 7302});
  assert.ok(n.sides[0].grave.some(c => c.uid === 7302), "the named Assassin card was not the one spent");
  assert.ok(n.sides[0].hand.some(c => c.uid === 7301), "…and the other left the hand anyway");
  /* AN ATTACK REACTION RESOLVES ON PLAY (it is not held, v4.66), so the
     clear inside `execute` is the only one this route passes through — the
     held route has `resolveHeld`'s second. Left behind, the answer names a
     card for the next activation that never asked. */
  assert.equal(n._discCostUid, undefined, "the answer outlived the ability that asked it");
});

test("a declared uid that cannot pay FALLS BACK — `reduce` is fed JSON off a wire", {skip}, () => {
  /* v2.04: the answer is re-derived at the charge. A uid that is not in
     the hand, or does not pass the filter, is the first card that does —
     never a free activation and never a card the cost excludes. */
  H.db();
  for(const bad of [999, 501]){
    const g = Object.assign(crownBoard([card("Brutal Assault", 1, 501), card("Barnacle", 2, 500)]), {_discCostUid: bad});
    const n = H.drain(R(g, ACT));
    assert.ok(n.sides[0].grave.some(c => c.uid === 500), "uid " + bad + ": the cost was not paid");
    assert.ok(n.sides[0].hand.some(c => c.uid === 501), "uid " + bad + ": a card the cost excludes was spent");
  }
});

test("a cancelled payment takes the declared discard with it", {skip}, () => {
  H.db();
  /* HELD_DECL is the list a cancel clears (v4.72) and a held play carries
     (v4.66); a declaration missing from it survives one and is dropped by
     the other. */
  assert.ok(J.HELD_DECL ? J.HELD_DECL.includes("_discCostUid")
                        : /HELD_DECL = \[[^\]]*"_discCostUid"/.test(fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8")),
    "_discCostUid is not a held declaration");
  const g = crownBoard([card("Barnacle", 2, 500), card("Swabbie", 2, 502)]);
  const asked = R(Object.assign(g, {sides: [Object.assign({}, g.sides[0], {res: 0}), g.sides[1]]}), ACT);
  if(asked.pending && asked.pending.kind === "discost"){
    const paying = R(asked, {t: "discost", uid: 502});
    if(paying.pending && paying.pending.kind === "pay"){
      const c = R(paying, {t: "payCancel"});
      assert.equal(c._discCostUid, undefined, "the declaration outlived the cancelled payment");
    }
  }
});

test("DRIVEN: the seat with nobody in it answers the first candidate — the old pick", {skip}, () => {
  /* v4.81's rule for a chosen discard, one cost over: the policy keeps
     the answer the engine gave before the question existed, so the ladder
     measures the route rather than a new judgement about which card to
     lose. `sparring.act` reads no card text; the candidates are judge's. */
  H.db();
  const asked = R(crownBoard([card("Barnacle", 2, 500), card("Swabbie", 2, 502)]), ACT);
  assert.deepEqual(SP.act(asked, 0), {t: "discost", uid: 500});
  assert.equal(J.legal(asked, SP.act(asked, 0), 0), null, "the policy proposed an answer judge refuses");
});

/* ---- 3. THE TRAINER, WHICH NO DRILL CAN DRIVE ------------------------ */

const TRY = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx,half)"), HTML.indexOf("const confirmPay = () => setG"));

test("the trainer asks the one reader, after every legality and before the payment", () => {
  /* THE WHOLE STATEMENT, not the name (v4.55): `null && DawnPrompts.…`
     keeps the name intact and never asks. */
  const ask = TRY.indexOf("const _dcq = DawnPrompts.discCostChoice(card, act(s));\n      if(_dcq) return L({...s, mode:\"discpick\"");
  assert.ok(ask > 0, "tryPlay never asks which card the discard cost spends");
  assert.ok(ask > TRY.indexOf("DawnParser.abDiscardCost(card)"),
    "asked before the refusal for an unpayable cost — a refused activation would be asked a question");
  assert.ok(ask < TRY.indexOf("const cost = from===\"ally\""),
    "asked after the payment opens — the cost is settled before the payment");
  assert.match(TRY, /if\(s\._discCostUid == null\)\{/, "the question must be asked once, not again after it is answered");
  assert.match(TRY, /s\.mode==="discpick"\|\|/, "a tap during the question plays a card");
});

test("the answer re-enters tryPlay, and the cancels take it back", () => {
  const conf = HTML.slice(HTML.indexOf("const confirmDiscCost = uid =>"), HTML.indexOf("const cancelDiscCost = () =>"));
  assert.match(conf, /_discCostUid:uid/, "the answer does not ride on the state");
  assert.match(conf, /tryPlay\(pk\.card, pk\.from, pk\.idx\)/, "the answer does not re-enter tryPlay — every gate above it is skipped");
  assert.match(conf, /\(pk\.uids\|\|\[\]\)\.indexOf\(uid\) < 0/, "an answer naming a card nobody offered is accepted");
  assert.match(HTML, /const cancelPay = [^\n]*delete n\._discCostUid;/, "a cancelled payment leaves the discard declared");
  assert.match(HTML, /g\.mode==="discpick" \? \(<>/, "the action bar has no buttons for the question");
});
