/* ============================================================
   WHICH SOUL CARD AN ACTIVATION'S SOUL BANISH TAKES (v5.59)

     "Attack Reaction - Banish a card from your soul: …"   — BOLTYN
     "Instant - Banish this and a card from your soul: …"  — RADIANT TOUCH

   `soul-banish-cost-auto-picked` (tools/approx.js, stated since v3.74)
   recorded that the cost took the FRONT of the soul and never asked. The
   soul is public (ruling R4, 2026-10-31) and the cost is the player's, so
   the player chooses — and a cost is paid before the ability resolves, so
   the question is a PENDING (v3.34), `discost`'s shape (v4.85) one zone over.

   It asks only when the soul holds MORE than the cost needs, in two
   different cards. `prompts.soulCostChoice` is the one reader; the answer
   rides on the state as `_soulCostUids` into `execute`, which re-derives it
   because `reduce` is fed by JSON off a wire. The AI answers through
   judge's `soulCostAnswer`, which reads a printed pitch and no card text.

   WHAT THE CHOICE DOES NOT TOUCH is the EVENT (v5.40): "a yellow card has
   been put into your soul this turn" is recorded in `hist.soulPut` when a
   card goes IN, so which card leaves cannot move it.

   THE TRAINER'S HALF is a source scan, stated as one: `tryPlay` and
   `activateInstant` are closures inside `Battle`. It is driven on the real
   page at phone size in tools/page.js's neighbour, not here.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const E = require("../engine/effects.js");
const PM = require("../engine/prompts.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const JUDGE = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");

/* ---- fixtures ------------------------------------------------------ */

let _b = null;
function boltyn(){
  if(_b) return _b;
  const W = loadData();
  _b = B.buildSide(W.HEROES.find(x => x.k === "boltyn"), G.parseDeck(W.DECKS.boltyn), H.db(), {},
                   RNG.make("soulcost"), {n: 0}).b;
  return _b;
}
const sc = (uid, name, pitch) => ({uid, name, tt: "Light Action", ty: ["Light", "Action"], pitch, tx: "", kw: []});
const R = (g, a, seat) => {
  const r = J.reduce(g, a, seat == null ? 0 : seat);
  assert.equal(r.error, null, JSON.stringify(a) + ": " + r.error);
  return r.state;
};
const ids = zone => zone.map(c => c.uid);

/* Radiant Touch in Boltyn's own gear, at its seat's action phase. */
function rtBoard(soul, extra){
  const b = boltyn();
  const rt = b.gear.find(x => /Radiant Touch/.test(x.name));
  assert.ok(rt && rt.powCard, "fixture: Radiant Touch is in his gear");
  const g = H.state(Object.assign({gear: [rt], res: 9, ap: 1, soul}, extra || {}), {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  return {rt, g: Object.assign(g, {phase: "action", step: "layer", priority: 0, passed: []})};
}
const RT_ACT = rt => ({t: "activate", uid: rt.uid, from: "gear"});

/* Boltyn's hero ability, in the reaction step of his own pumped attack.
   `hpow` swaps the powCard (a synthetic price); `seat` seats him at 1. */
function reactionBoard(soul, o){
  o = o || {};
  const seat = o.seat || 0;
  const b = boltyn();
  const bb = o.hpow ? Object.assign({}, b, {HPOW: o.hpow}) : b;
  const atk = Object.assign({}, H.card("Brutal Assault", 1), {uid: 601});
  const mine = Object.assign({hand: [atk], res: 9, ap: 1, soul, buffNext: 2}, o.mine || {});
  let g = seat === 0
    ? H.state(mine, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [bb, {}]})
    : H.state({hp: 20}, mine, {actor: 1, turnPlayer: 1, turn: 3, builds: [{}, bb]});
  g = Object.assign(g, {phase: "action", step: "layer", priority: seat, passed: []});
  g = R(g, {t: "play", uid: 601, from: "hand"}, seat);
  for(let i = 0; i < 10 && g.step !== "reaction"; i++) g = H.move(g);
  assert.equal(g.step, "reaction", "fixture: the attack did not reach its reaction step");
  assert.equal(g.priority, seat, "fixture: the attacker does not hold priority in the reaction step");
  return g;
}
const HPOW_ACT = {t: "activate", uid: "hpow", from: "hero"};

/* ---- 1. THE READER -------------------------------------------------- */

test("soulCostChoice asks only when the soul holds MORE than the cost needs, in two different cards", () => {
  const one = {name: "Probe — ability", _soulCost: 1};
  const two = {name: "Probe — ability", _soulCost: 2};
  const soul = [sc(1, "A", 1), sc(2, "B", 2), sc(3, "C", 3)];
  assert.deepEqual(PM.soulCostChoice(one, {soul}), [1, 2, 3], "three different cards are a choice, FRONT first");
  assert.equal(PM.soulCostChoice(one, {soul: [sc(1, "A", 1)]}), null,
    "exactly as many as the cost needs is nothing to choose");
  assert.equal(PM.soulCostChoice(one, {soul: []}), null, "an empty soul is the legality's refusal, not a question");
  assert.equal(PM.soulCostChoice(one, {soul: [sc(1, "A", 1), sc(2, "A", 1)]}), null,
    "two copies of one card are the same card (v3.55)");
  assert.deepEqual(PM.soulCostChoice(one, {soul: [sc(1, "A", 1), sc(2, "A", 3)]}), [1, 2],
    "…but one NAME at two pitches is two cards: the colour is what stays in the soul");
  assert.equal(PM.soulCostChoice({name: "Probe", tx: "Draw a card"}, {soul}), null,
    "an ability with no soul cost is never asked");
  assert.equal(PM.soulCostChoice(two, {soul: [sc(1, "A", 1), sc(2, "B", 2)]}), null,
    "a cost of two over a soul of two takes both: no choice");
  assert.deepEqual(PM.soulCostChoice(two, {soul}), [1, 2, 3], "a cost of two over three is asked");
  assert.deepEqual(PM.soulCostChoice(two, {soul}, [2]), [1, 3], "…and asked again for the remainder, minus what is chosen");
  assert.equal(PM.soulCostChoice(two, {soul}, [2, 3]), null, "…and not once the cost is named in full");
});

/* ---- 2. DRIVEN AT THE TABLE ----------------------------------------- */

test("DRIVEN: Radiant Touch — the seat is ASKED, and the card it names is the one banished", {skip}, () => {
  const {rt, g} = rtBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1), sc(703, "Soul C", 3)]);
  const asked = R(g, RT_ACT(rt));
  assert.equal(asked.pending && asked.pending.kind, "soulcost", "no question was asked");
  assert.deepEqual(asked.pending.uids, [701, 702, 703], "the candidates are the soul, front first");
  assert.deepEqual(ids(asked.sides[0].soul), [701, 702, 703], "nothing leaves the soul while the question is open");
  assert.equal(asked.sides[0].ward || 0, 0, "and the ability has not resolved");
  const n = R(asked, {t: "soulcost", uid: 702});
  assert.equal(n.pending, null);
  assert.deepEqual(ids(n.sides[0].soul), [701, 703], "the named card left the soul and the OTHERS stayed");
  assert.ok(ids(n.sides[0].banish).includes(702), "it lands in the banished zone");
  assert.ok(!ids(n.sides[0].banish).includes(701), "the front card was banished anyway — the engine's pick, not the seat's");
  assert.equal(n.sides[0].ward, 2, "the ability itself resolved");
  assert.equal(n._soulCostUids, undefined, "the answer outlived its activation");
});

test("DRIVEN: the FRONT is still a legal answer, and so is the BACK — nothing is steered", {skip}, () => {
  for(const [pick, left] of [[701, [702, 703]], [703, [701, 702]]]){
    const {rt, g} = rtBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1), sc(703, "Soul C", 3)]);
    const n = R(R(g, RT_ACT(rt)), {t: "soulcost", uid: pick});
    assert.deepEqual(ids(n.sides[0].soul), left, "uid " + pick + " was not the card banished");
    assert.ok(ids(n.sides[0].banish).includes(pick));
  }
});

test("DRIVEN: exactly enough in the soul — nothing to choose, nothing asked", {skip}, () => {
  const {rt, g} = rtBoard([sc(701, "Soul A", 2)]);
  const n = R(g, RT_ACT(rt));
  assert.ok(!(n.pending && n.pending.kind === "soulcost"), "a forced choice was put to the seat");
  assert.deepEqual(ids(n.sides[0].soul), [], "the only card was not banished");
  assert.ok(ids(n.sides[0].banish).includes(701));
  assert.equal(n.sides[0].ward, 2, "and the ability resolved at once");
  /* AND TWO COPIES OF ONE CARD — more than the cost needs, but one choice */
  const {rt: rt2, g: g2} = rtBoard([sc(711, "Soul A", 2), sc(712, "Soul A", 2)]);
  const m = R(g2, RT_ACT(rt2));
  assert.ok(!(m.pending && m.pending.kind === "soulcost"), "two copies of one card were put to the seat as a choice");
  assert.deepEqual(ids(m.sides[0].soul), [712], "the engine took the first copy");
});

test("DRIVEN: Boltyn's ability asks too — in the reaction window", {skip}, () => {
  const g = reactionBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1), sc(703, "Soul C", 3)]);
  assert.equal(J.legal(g, HPOW_ACT, 0), null, "fixture: the ability is refused for another reason");
  const asked = R(g, HPOW_ACT);
  assert.equal(asked.pending && asked.pending.kind, "soulcost", "the reaction window asked nothing");
  assert.deepEqual(ids(asked.sides[0].soul), [701, 702, 703]);
  const n = R(asked, {t: "soulcost", uid: 703});
  assert.deepEqual(ids(n.sides[0].soul), [701, 702], "the named card was not the one spent");
  assert.ok(ids(n.sides[0].banish).includes(703));
  assert.equal(n.pend && n.pend.ga, true, "and the ability resolved — the attack has go again");
  assert.equal(n.step, "reaction", "an activated attack reaction leaves the window open");
  assert.equal(n._soulCostUids, undefined, "the answer outlived the ability that asked it");
});

test("DRIVEN: a cost that banishes TWO is asked twice, and the third card stays", {skip}, () => {
  /* No pool card prints it (Teklovossen does, and is not in the pool), so
     the price is synthetic: Boltyn's own ability at a cost of two. */
  const hp = Object.assign({}, boltyn().HPOW, {_soulCost: 2});
  const g = reactionBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1), sc(703, "Soul C", 3)], {hpow: hp});
  const first = R(g, HPOW_ACT);
  assert.equal(first.pending.kind, "soulcost");
  assert.deepEqual(first.pending.uids, [701, 702, 703]);
  const second = R(first, {t: "soulcost", uid: 703});
  assert.equal(second.pending && second.pending.kind, "soulcost", "the second card of the cost was not asked");
  assert.deepEqual(second.pending.uids, [701, 702], "the card already chosen was offered again");
  assert.deepEqual(ids(second.sides[0].soul), [701, 702, 703], "nothing leaves the soul until the cost is named in full");
  assert.match(String(J.legal(second, {t: "soulcost", uid: 703}, 0)), /not one the cost can banish/,
    "the same card was accepted for both halves of the cost");
  const n = R(second, {t: "soulcost", uid: 701});
  assert.deepEqual(ids(n.sides[0].soul), [702], "the card neither answer named is the one that stays");
  assert.deepEqual(ids(n.sides[0].banish).sort(), [701, 703]);
  assert.equal(n.pend && n.pend.ga, true);
});

test("the answer is LEGAL only as one of the named candidates, only from the asked seat, and only while asked", {skip}, () => {
  const {rt, g} = rtBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1)]);
  const asked = R(g, RT_ACT(rt));
  assert.match(String(J.legal(asked, {t: "soulcost", uid: 999}, 0)), /not one the cost can banish/,
    "a card that is not in the soul was accepted as the answer");
  assert.match(String(J.legal(asked, {t: "pass"}, 0)), /banishes first/, "the game went on around an open question");
  assert.match(String(J.legal(asked, {t: "soulcost", uid: 701}, 1)), /mid-decision/, "the other seat answered the question");
  assert.equal(J.legal(asked, {t: "soulcost", uid: 701}, 0), null, "…and the asked seat could not");
  assert.match(String(J.legal(g, {t: "soulcost", uid: 701}, 0)), /nothing is asking/,
    "an answer with nothing asking was accepted");
  const forced = rtBoard([sc(701, "A", 1)]);
  assert.match(String(J.legal(R(forced.g, RT_ACT(forced.rt)), {t: "soulcost", uid: 701}, 0)),
    /nothing is asking/, "a forced banish left a question behind");
});

test("a declared uid that cannot pay FALLS BACK — `reduce` is fed JSON off a wire", {skip}, () => {
  /* v2.04: the answer is re-derived at the charge. A uid that is not in
     the soul, or one named twice, takes nothing — and the front fills what
     is left, so the cost is paid in full and never with a card that is not
     there, and never free. */
  for(const bad of [[999], [], [702, 702], [999, 702]]){
    const {rt, g} = rtBoard([sc(701, "Soul A", 2), sc(702, "Soul B", 1), sc(703, "Soul C", 3)]);
    const n = R(Object.assign(g, {_soulCostUids: bad}), RT_ACT(rt));
    assert.equal(n.sides[0].soul.length, 2, JSON.stringify(bad) + ": the cost was not paid exactly once");
    assert.equal(n.sides[0].ward, 2, JSON.stringify(bad) + ": the ability did not resolve");
    const gone = [701, 702, 703].filter(u => !ids(n.sides[0].soul).includes(u));
    assert.equal(gone.length, 1);
    assert.equal(gone[0], bad.includes(702) ? 702 : 701,
      JSON.stringify(bad) + ": a declared card that is in the soul is taken, otherwise the front");
  }
});

test("a declaration rides the layer while an ability waits, and a cancelled payment takes it", () => {
  /* HELD_DECL is the list `holdPlay` carries on the layer (v4.66) and the
     list a cancel clears (v4.72); a declaration missing from it survives
     one and is dropped by the other. */
  assert.match(JUDGE, /HELD_DECL = \[[^\]]*"_soulCostUids"/, "_soulCostUids is not a held declaration");
  assert.match(HTML, /const cancelPay = [^\n]*delete n\._soulCostUids;/, "the trainer's cancel leaves the soul card declared");
});

/* ---- 3. THE EVENT IS NOT THE CHOICE --------------------------------- */

test("DRIVEN: which card leaves does not move 'a yellow card was put into your soul this turn'", {skip}, () => {
  /* v5.40: the gate reads the EVENT, written when the card went in. Duty
     Bound Blitz stays open whichever of the two cards the seat banishes —
     the yellow charged this turn, or the red that was already there. */
  const dbb = H.card("Duty Bound Blitz", 1);
  for(const pick of [701, 702]){
    const {rt, g} = rtBoard([sc(701, "Charged Yellow", 2), sc(702, "Old Red", 1)],
      {hist: Object.assign(require("../engine/sides.js").freshHist(), {soulPut: [2]})});
    const n = R(R(g, RT_ACT(rt)), {t: "soulcost", uid: pick});
    assert.deepEqual(n.sides[0].hist.soulPut, [2], "uid " + pick + ": the banish rewrote the soul-put record");
    assert.equal(E.playIfOk(n, dbb), true, "uid " + pick + ": the gate read the soul's CONTENTS");
  }
  /* …and it stays SHUT when no yellow was put in this turn, whichever card
     the seat keeps: a yellow already sitting in the soul from before is no event */
  const {rt, g} = rtBoard([sc(701, "Old Yellow", 2), sc(702, "Old Red", 1)]);
  const n = R(R(g, RT_ACT(rt)), {t: "soulcost", uid: 702});
  assert.ok(ids(n.sides[0].soul).includes(701), "fixture: the old yellow is still in the soul");
  assert.equal(E.playIfOk(n, dbb), false, "an old yellow in the soul opened the gate");
});

/* ---- 4. THE AI ------------------------------------------------------- */

test("DRIVEN: the seat with nobody in it answers the LOWEST PITCH, then the uid — deterministic and legal", {skip}, () => {
  /* The front is pitch 3 and the lowest is in the middle, so the answer is
     the RULE and not the old front-of-the-soul pick. */
  const g = rtBoard([sc(701, "Soul A", 3), sc(702, "Soul B", 1), sc(703, "Soul C", 2)]);
  const asked = R(g.g, RT_ACT(g.rt));
  const a = SP.act(asked, 0);
  assert.deepEqual(a, {t: "soulcost", uid: 702}, "the lowest-pitch soul card is not the answer");
  assert.equal(J.legal(asked, a, 0), null, "the policy proposed an answer judge refuses");
  assert.deepEqual(SP.act(asked, 0), a, "the answer is not repeatable");
  assert.deepEqual(SP.act(Object.assign({}, asked, {rng: RNG.make("another seed")}), 0), a,
    "the answer moved with the game's rng");
  /* TIES BREAK ON THE UID, a total order (v2.46): two cards at one pitch */
  const t = rtBoard([sc(710, "Tie B", 1), sc(705, "Tie A", 1), sc(720, "High", 3)]);
  assert.deepEqual(SP.act(R(t.g, RT_ACT(t.rt)), 0), {t: "soulcost", uid: 705}, "the tie was not broken on the uid");
  /* THE REASON, and the line the coach shows */
  const why = SP.explain(asked, 0);
  assert.equal(why.key, "soulcost");
  assert.ok(why.why && /soul/i.test(why.why), "the call has no reason");
  assert.match(why.line, /Banish Soul B from the soul/, "the call does not name the card");
});

test("DRIVEN: the AI seated at the table answers its own question — seat 1, Boltyn's ability", {skip}, () => {
  const g = reactionBoard([sc(701, "Soul A", 3), sc(702, "Soul B", 1), sc(703, "Soul C", 2)], {seat: 1});
  const asked = R(g, HPOW_ACT, 1);
  assert.equal(asked.pending && asked.pending.kind, "soulcost");
  assert.equal(asked.pending.seat, 1);
  const a = SP.act(asked, 1);
  assert.deepEqual(a, {t: "soulcost", uid: 702});
  assert.equal(J.legal(asked, a, 1), null);
  const n = R(asked, a, 1);
  assert.deepEqual(ids(n.sides[1].soul), [701, 703], "the policy's own answer did not banish its card");
  assert.ok(ids(n.sides[1].banish).includes(702));
  assert.equal(SP.act(asked, 0), null, "the seat that is not asked proposed an answer");
});

test("the policy's branch reads judge's reader and no card text", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "sparring.js"), "utf8");
  const line = src.split("\n").find(l => /p\.kind === "soulcost"/.test(l));
  assert.ok(line, "payAction has no branch for `soulcost`");
  assert.match(line, /J\.soulCostAnswer\(g\)/, "the answer is not judge's");
  assert.doesNotMatch(line, /fxParse|\.tx\b|P\./, "the branch reads card text");
  assert.ok(J.PENDING_KINDS.includes("soulcost") && J.ACTIONS.includes("soulcost"));
});

/* ---- 5. THE TRAINER, WHICH NO DRILL CAN DRIVE ------------------------ */

const TRY = HTML.slice(HTML.indexOf("const tryPlay = (card,from,idx,half)"), HTML.indexOf("const confirmPay = () => setG"));
const INST = HTML.slice(HTML.indexOf("const activateInstant = (card, from, idx) => setG"),
                        HTML.indexOf("const activateIfOk = (s, g2, card)"));
const ASK = HTML.slice(HTML.indexOf("const askSoulCost = (s, card, from, idx, redo) => {"),
                       HTML.indexOf("const activateInstant = (card, from, idx) => setG"));

test("both trainer doors open the question through ONE body, which asks the one reader", () => {
  assert.ok(ASK.length > 200, "askSoulCost moved — re-anchor this drill");
  /* THE WHOLE STATEMENT, not the name (v4.55): `null && DawnPrompts.…`
     keeps the name intact and never asks. */
  assert.match(ASK, /const uids = DawnPrompts\.soulCostChoice\(card, act\(s\)\);\n    if\(!uids\) return null;/,
    "the trainer's question does not come from the reader both boards ask");
  assert.match(ASK, /mode:"soulpick", soulPick:\{card, from, idx, uids, picked:\[\], back:s\.mode, redo, name\}/,
    "the question does not carry the door it came from and the window to return to");
  /* test/mirror.test.js pins `activateInstant` free of a `mode:` write, which is why this is a body of its own */
  assert.doesNotMatch(INST.replace(/\/\*[\s\S]*?\*\//g, ""), /mode\s*:/, "the instant door writes a mode again");
});

test("tryPlay asks the one reader, after every legality and the discard's question, before the payment", () => {
  /* THE WHOLE STATEMENT, not the name (v4.55): `null && DawnPrompts.…`
     keeps the name intact and never asks. */
  const ask = TRY.indexOf("const _scq = askSoulCost(s, card, from, idx);\n      if(_scq) return _scq;");
  assert.ok(ask > 0, "tryPlay never asks which soul card the cost banishes");
  assert.ok(ask > TRY.indexOf("DawnParser.abSoulCost(card)"),
    "asked before the refusal for an unpayable cost — a refused activation would be asked a question");
  assert.ok(ask > TRY.indexOf("const _dcq = DawnPrompts.discCostChoice(card, act(s));"),
    "asked before the discard's question — the two are asked in the judge's order");
  assert.ok(TRY.indexOf("const cost = payCost(s, card, from);") > 0, "tryPlay's cost line moved — re-anchor this drill");
  assert.ok(ask < TRY.indexOf("const cost = payCost(s, card, from);"),
    "asked after the payment opens — the cost is settled before the payment");
  assert.match(TRY, /if\(s\._soulCostUids == null\)\{/, "the question must be asked once, not again after it is answered");
  assert.match(TRY, /s\.mode==="soulpick"\|\|/, "a tap during the question plays a card");
});

test("activateInstant asks too — Radiant Touch in the defend step is the other trainer door", () => {
  assert.ok(INST.length > 500, "activateInstant moved — re-anchor this drill");
  const ask = INST.indexOf("const _scq = askSoulCost(s, card, from, idx, \"instant\");\n      if(_scq) return _scq;");
  assert.ok(ask > 0, "the instant door never asks which soul card the cost banishes");
  assert.ok(ask < INST.indexOf("const cost = effCost(card, act(s)"), "asked after the payment");
  assert.match(INST, /askSoulCost\(s, card, from, idx, "instant"\)/,
    "the answer would re-enter tryPlay and PLAY the ability from the wrong door");
  assert.match(INST, /s\.mode === "soulpick"\) return s;/, "a tap during the question activates it again");
  assert.match(INST, /delete back\._soulCostUids;/, "a refused activation leaves the soul card declared");
});

test("the answer re-enters the door it came from, and the cancels take it back", () => {
  const conf = HTML.slice(HTML.indexOf("const confirmSoulCost = uid =>"), HTML.indexOf("const cancelSoulCost = () =>"));
  assert.ok(conf.length > 100, "confirmSoulCost moved — re-anchor this drill");
  assert.match(conf, /_soulCostUids:picked/, "the answer does not ride on the state");
  assert.match(conf, /tryPlay\(pk\.card, pk\.from, pk\.idx\)/, "the answer does not re-enter tryPlay — every gate above it is skipped");
  assert.match(conf, /if\(pk\.redo === "instant"\) activateInstant\(pk\.card, pk\.from, pk\.idx\)/, "the instant door's answer does not come back to it");
  assert.match(conf, /\(pk\.uids\|\|\[\]\)\.indexOf\(uid\) < 0/, "an answer naming a card nobody offered is accepted");
  assert.match(conf, /DawnPrompts\.soulCostChoice\(pk\.card, act\(g\), picked\)/, "a two-card cost is not asked for the rest");
  assert.match(HTML, /g\.mode==="soulpick" \? \(<>/, "the action bar has no buttons for the question");
  assert.match(HTML, /g\.mode==="soulpick" && g\.soulPick && <div className="statusline">/, "the status line does not say what is asked");
  assert.match(HTML, /const cancelSoulCost = \(\) => setG\(s => s\.mode === "soulpick"/, "the question has no cancel");
});

test("the table demuxes the pending and the trainer's busy lists name the new mode", () => {
  assert.match(HTML, /const soulcost = kindIs\("soulcost"\);/);
  assert.match(HTML, /: soulcost \? <>/, "the table's action bar has no branch for the question");
  assert.match(HTML, /fire\(\{t:"soulcost",uid:u\}\)/, "the table's button answers with the wrong action");
  const lists = HTML.match(/\["pay","arsenal","boostpick","fusepick","chargepick","discpick"(?:,"soulpick")?\]/g) || [];
  assert.equal(lists.length, 2, "a hand-ability busy list moved — re-anchor this drill");
  for(const l of lists) assert.match(l, /"soulpick"/, "a sheet is open and the hand ability may still start: " + l);
});
