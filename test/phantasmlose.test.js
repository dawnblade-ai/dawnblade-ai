/* ============================================================
   test/phantasmlose.test.js — "LOSES AND CAN'T GAIN PHANTASM" and Pierce Reality
   (v6.47, Prism reader 5b/5c)

   Staged, Prism's deck:
     Passing Mirage  "Your first Illusionist attack each turn loses and can't gain phantasm."
     Dream Weavers   "Action - Destroy this: The next Illusionist attack action card you play
                      this turn loses and can't gain phantasm. Go again"
     Pierce Reality  "The first Illusionist attack action card you play each turn gets +2{p}."

   Driven at the table on judge.test.js's phantasm fixture: Spears of Surreality (an
   Illusionist attack action card with phantasm) met by a 6-power non-Illusionist blocker
   pops; with the static or the grant it is an ordinary block. Asserted on life, zones and
   action points, never the feed.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (name, p) => C.resolveEntry(STAGED, {name, p: p || 0, code: null, q: 1});
const aura = (c, uid) => ({card: {...c, uid}, kind: "aura", spent: false, uid});

const spear = uid => ({...H.card("Spears of Surreality", 1), uid});
const six = uid => ({uid, name: "Six Power " + uid, def: 3, power: 6, pitch: 1,
                     tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"]});

function table(o){
  o = o || {};
  let g = H.state({name: "You", res: 9, ap: 3, hand: o.hand || [spear("ph1"), spear("ph2")], board: o.board || [],
                   gear: o.gear || []},
                  {name: "Them", hand: [six("w1"), six("w2")]},
                  {actor: 0, turnPlayer: 0, seed: "phantasmlose"});
  return {...g, phase: "action", step: "layer", priority: 0, passed: []};
}
const passTo = (n, done) => {
  for(let i = 0; i < 24 && !done(n); i++){
    if(n.prompt){ const m = H.move(n); if(m === n) break; n = m; continue; }
    let moved = false;
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; moved = true; break; } }
    if(!moved) break;
  }
  return n;
};
/* one swing of `uid`, met by blocker `w` when one is named; returns the state back in the layer step */
function swing(g, uid, w){
  let n = J.reduce(g, {t: "play", uid, from: "hand"}, 0).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, 0).state;
  n = passTo(n, s => s.step === "defend");
  assert.equal(n.step, "defend", "fixture: the drill did not reach the defend step");
  if(w){ const d = J.reduce(n, {t: "defend", uid: w}, 1); assert.equal(d.error, null, "fixture: the block was refused"); n = d.state; }
  return passTo(n, s => s.phase === "action" && s.step === "layer" && !s.pend);
}

test("the readers: the static, the grant and the first-play buff each read; a wording off the shape refuses", {skip}, () => {
  P.fxReset();
  const pm = P.fxParse({...staged("Passing Mirage", 3), name: "Drill PM"});
  assert.deepEqual(pm.firstLoseKw, [{q: {g: [["illusionist"]]}, kw: "phantasm"}]);
  const pr = P.fxParse({...staged("Pierce Reality", 3), name: "Drill PR"});
  assert.deepEqual(pr.firstPlayBuff, [{q: {aac: true, g: [["illusionist"]]}, n: 2}]);
  assert.equal(P.classifyClause("Your first Illusionist attack each turn loses and can't gain dominate."), null,
    "a keyword the sentence was not built for was read");
  const dw = P.classifyClause("The next Illusionist attack action card you play this turn loses and can't gain phantasm");
  assert.deepEqual(dw && dw.ops, [["buffNext", 0, {aac: true, g: [["illusionist"]]}, {loseKw: "phantasm"}]]);
});

test("the control: Spears of Surreality met by six power pops, twice", {skip}, () => {
  let n = swing(table(), "ph1", "w1");
  assert.equal(n.sides[1].hp, 20, "fixture: the bare attack was not popped");
  n = swing(n, "ph2", "w2");
  assert.equal(n.sides[1].hp, 20, "fixture: the second bare attack was not popped");
});

test("Passing Mirage: the first Illusionist attack is an ordinary block; the second still pops", {skip}, () => {
  const pm = staged("Passing Mirage", 3);
  assert.ok(pm && pm.resolved, "fixture: Passing Mirage did not resolve");
  let n = swing(table({board: [aura(pm, "pm1")]}), "ph1", "w1");
  assert.equal(n.sides[1].hp, 18, "the first Illusionist attack still popped: 5 against 3 should land 2");
  n = swing(n, "ph2", "w2");
  assert.equal(n.sides[1].hp, 18, "the SECOND Illusionist attack lost phantasm too — only the first does");
  assert.ok(n.sides[0].grave.some(c => c.uid === "ph2"), "the popped second attack was not destroyed");
});

test("Passing Mirage counts Illusionist attacks only: a Generic attack first does not use it up", {skip}, () => {
  const pm = staged("Passing Mirage", 3);
  const gen = {uid: "gen1", name: "Plain Swing", cost: 0, power: 1, def: 2, pitch: 1,
               tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: ""};
  let n = swing(table({board: [aura(pm, "pm1")], hand: [gen, spear("ph1")]}), "gen1", null);
  const hp = n.sides[1].hp;
  n = swing(n, "ph1", "w1");
  assert.equal(hp - n.sides[1].hp, 2, "the first ILLUSIONIST attack popped after a Generic one");
});

test("Dream Weavers: destroy it, and the next Illusionist attack action card is an ordinary block", {skip}, () => {
  const dw = {...staged("Dream Weavers"), uid: "dw1"}; B.equipPiece(dw);
  assert.ok(dw.resolved, "fixture: Dream Weavers did not resolve");
  let g = table({gear: [dw]});
  const A = {t: "activate", uid: "gpdw1"};
  const why = J.legal(g, A, 0);
  assert.equal(why, null, "the table refused Dream Weavers' ability: " + why);
  let n = passTo(J.reduce(g, A, 0).state, s => !(s.stack || []).length && !s.prompt);
  assert.equal((n.sides[0].gear || []).some(x => x.uid === "dw1"), false, "Dream Weavers was not destroyed");
  assert.equal(n.sides[0].ap, 3, "the ability's go again did not keep the action point");
  n = swing(n, "ph1", "w1");
  assert.equal(n.sides[1].hp, 18, "the granted attack still popped");
  n = swing(n, "ph2", "w2");
  assert.equal(n.sides[1].hp, 18, "the grant was not spent by the card it matched");
});

test("Pierce Reality: +2{p} on the first Illusionist attack action card played, not the second", {skip}, () => {
  const pr = staged("Pierce Reality", 3);
  let n = swing(table({board: [aura(pr, "pr1")]}), "ph1", null);
  assert.equal(20 - n.sides[1].hp, 7, "the first Illusionist attack action card did not get +2 (5 + 2)");
  n = swing(n, "ph2", null);
  assert.equal(20 - n.sides[1].hp, 12, "the second got the +2 as well (or the first lost it)");
  const bare = swing(table(), "ph1", null);
  assert.equal(20 - bare.sides[1].hp, 5, "fixture: Spears of Surreality does not swing for 5");
});
