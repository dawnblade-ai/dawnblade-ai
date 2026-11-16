/* ============================================================
   traverse.test.js — THE DOUBLE-FACED HERO AND TRAVERSE (v6.44)

   The seventh reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md),
   and the last one before the staged deck can open. Verbatim (data/staged.js):

     Viserai, Between Worlds   "Whenever you create 1 or more Runechants,
     (Shadow Runeblade Hero -   banish the top card of your deck. Then if
      Young; Traverse)          you've created 3 or more Runechants this
                                turn, traverse."
     Viserai, Usurper          "The first attack action card with blood debt
     (Shadow Runeblade Hero -   you play each turn gets go again."
      Demon; Traverse)         "At the beginning of each end phase, if you've
                                created or activated a Gate to i'Arathael
                                this turn, you may traverse."

   CR 8.5.60 (verbatim): "Traverse is a discrete effect. To traverse a
   double-faced card, its non-active face becomes its active face.[9.1]"
   CR 8.5.60a (verbatim): "If the card is not a double-faced card,  the
   traverse effect was generated an ability on the non-active face, or the
   non-active face can otherwise not be made active, the traverse effect
   fails."
   CR 9.1.1 (verbatim): "A double-faced card is a card with two sets of
   properties - each set printed as a separate face on the card."
   CR 4.4.2 (verbatim): "First, the "beginning of the end phase" event occurs
   and effects that trigger at the beginning of the end phase are
   triggered."

   Quoted at the build sites and held here: CR 4.1.2 (the hero is face up, so
   the face is public), CR 6.6.5b (one creation event, one trigger), CR 6.6.6
   and 6.6.6b (the triggered-layer and its order, not modelled: resolved
   inline), CR 9.1.2 and 9.1.2c (each face's own properties), CR 9.1.3,
   9.1.4b and 9.1.5 (the three kinds, none naming a hero), CR 2.5.3c (base
   life) and CR 6.6.5d ("first ... each turn") — the last three are the open
   questions in tools/approx.js.

   The faces are two upstream records linked by a shared print code
   (`cards.otherFace`); `sd.face` is the active face's name; traverse swaps
   the build's ability half (`effects.traverse`). Asserts on faces, zones,
   counters, action points and life; never on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const IV = require("../engine/invariants.js");
const W = require("../engine/wire.js");
const V = require("../engine/view.js");
const R = require("../engine/report.js");
const SP = require("../engine/sparring.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const POOL = C.buildMaps(require("../data/pool.js").filter(c => c && c.name).map(C.mapDbCard));
const BW = "Viserai, Between Worlds", US = "Viserai, Usurper", GATE = "Gate to i'Arathael";
const hero = nm => { const h = C.resolveHero(STAGED, {name: nm}); assert.ok(h && h.n === nm, nm + " is not staged"); return h; };
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
const pool = (nm, p, uid) => ({...H.card(nm, p), uid});
const names = z => (z || []).map(c => c.name);

/* THE SEAT'S BUILD, THE WAY `buildSide` MAKES IT: the deck's face first. */
function buildOf(startName){
  const d = {hero: {name: startName, code: "SBW001"}, deck: [], gear: []};
  const b = B.buildSide({code: "SBW001"}, d, STAGED, {}, RNG.make("tv"), {n: 0}).b;
  const {deck, gear, ...rest} = b;
  return {...rest, runeDmg: 1};
}
function world(startName, a, b2, o){
  const bd = buildOf(startName);
  const g = H.state(Object.assign({res: 9, ap: 1, hand: [], face: bd.heroRec.n, hero: bd.heroRec.n}, a || {}),
    Object.assign({hp: 20, hand: []}, b2 || {}), Object.assign({actor: 0, turnPlayer: 0, turn: 3, builds: [bd, {}]}, o || {}));
  return {...g, phase: "action", step: "layer", priority: 0, passed: []};
}
const fx = r => r.game || r;
const deck3 = (k) => [pool("Brutal Assault", 3, (k || "k") + "1"), pool("Wounding Blow", 2, (k || "k") + "2"),
  pool("Critical Strike", 1, (k || "k") + "3"), pool("Brutal Assault", 1, (k || "k") + "4")];
function act(g, a, seat){
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " refused: " + out.error);
  return out.state;
}

/* ---- the data: two records, one card -------------------------------- */

test("the faces are paired by their shared print code, both ways, and no pool hero has a second face", () => {
  const bw = hero(BW), us = hero(US);
  assert.equal(C.otherFace(STAGED, bw), us);
  assert.equal(C.otherFace(STAGED, us), bw);
  /* the pool carries two-faced records (Inner Chi's transcends, a Demi-Hero twin,
     double-sided tokens) and not one is a hero with a second hero face */
  let faced = 0;
  for(const list of Object.values(POOL.byName)) for(const r of list) if(C.otherFace(POOL, r)) faced++;
  assert.equal(faced, 0, "a pool hero grew a second face");
  /* a double-sided TOKEN shares a code too: the hero test is what keeps it out */
  const rune = POOL.byName.runechant[0];
  assert.ok(Object.keys(rune.pr).some(k => k !== "_first" && Object.values(POOL.byName).flat()
    .some(r => r !== rune && r.n !== rune.n && Object.keys(r.pr || {}).indexOf(k) >= 0)), "fixture: the Runechant shares no code");
  assert.equal(C.otherFace(POOL, rune), null, "a token was read as a hero's face");
});

test("the build carries both faces, the deck's first, and the deal shows the deck's face", () => {
  const b = buildOf(BW);
  assert.deepEqual(b.faces.map(f => f.n), [BW, US]);
  assert.equal(b.heroRec.n, BW);
  assert.equal(b.heroCode, "SBW001");
  const g = J.newMatch({builds: [buildOf(BW), buildOf(US)], seed: "tv"});
  assert.equal(g.sides[0].face, BW);
  assert.equal(g.sides[1].face, US);
  /* a one-faced hero carries no face */
  assert.equal(S.makeSide({}).face, null);
  assert.ok(S.SIDE_FIELDS.includes("face"), "the field is not a side field");
});

/* ---- the readers ---------------------------------------------------- */

test("each face's text is read into its own passives, and only that face's", () => {
  const bw = B.heroAbilities(hero(BW), BW), us = B.heroAbilities(hero(US), US);
  assert.deepEqual(bw.runeTrigger, {ops: [["banTop", 1]], traverseAt: 3});
  assert.equal(bw.firstKwGa, "");
  assert.equal(bw.endTraverse, "");
  assert.equal(us.runeTrigger, null);
  assert.equal(us.firstKwGa, "blood debt");
  assert.equal(us.endTraverse, GATE);
  assert.equal(bw.heroPow, null, "a passive face grew an activated ability");
  assert.equal(us.heroPow, null);
});

test("an unreadable effect refuses: no trigger at all, and the audit reports the clause", () => {
  const AU = require("../tools/audit.js");
  const twin = tx => ({...hero(BW), n: "Drill Faced Hero", tx});
  const ok = B.heroAbilities(twin("Whenever you create 1 or more Runechants, banish the top card of your deck. Then if you've created 5 or more Runechants this turn, traverse."));
  assert.deepEqual(ok.runeTrigger, {ops: [["banTop", 1]], traverseAt: 5}, "the printed number was not read");
  const bad = B.heroAbilities(twin("Whenever you create 1 or more Runechants, transmogrify a goat. Then if you've created 3 or more Runechants this turn, traverse."));
  assert.equal(bad.runeTrigger, null, "an unread effect was given a trigger");
  const a = AU.analyzeHero(hero(BW), BW), u = AU.analyzeHero(hero(US), US);
  assert.deepEqual(a.clauses.filter(c => !c.covered).map(c => c.t), [], "Between Worlds reports an unread clause");
  assert.deepEqual(u.clauses.filter(c => !c.covered).map(c => c.t), [], "Usurper reports an unread clause");
  const n = AU.analyzeHero({n: "Nobody", tt: "Generic Hero", tx: "Whenever you blink, traverse."}, "nobody");
  assert.equal(n.clauses.filter(c => !c.covered).length, 1, "a traverse line nothing reads reported covered");
});

/* ---- traverse itself (CR 8.5.60 / 8.5.60a) --------------------------- */

test("traverse turns the face, swaps the text in force, and keeps life and intellect", () => {
  const g = world(BW, {hp: 17, int: 4});
  const r = E.traverse(g, 0, BW);
  assert.equal(r.ok, true);
  const n = r.game;
  assert.equal(n.sides[0].face, US);
  assert.equal(n.sides[0].hero, US, "the seat still shows the old face");
  assert.equal(n.builds[0].heroRec.n, US);
  assert.equal(n.builds[0].runeTrigger, null, "Between Worlds' trigger is still in force");
  assert.equal(n.builds[0].firstKwGa, "blood debt");
  assert.equal(n.builds[0].HZOOM.name, US);
  assert.deepEqual(n.builds[0].faces.map(f => f.n), [BW, US], "the faces were lost in the swap");
  assert.equal(n.builds[0].runeDmg, 1, "the shared Runechant stamp was lost");
  assert.equal(n.sides[0].hp, 17);
  assert.equal(n.sides[0].int, 4);
  assert.deepEqual(IV.errors(n), []);
  /* and back: the deck's face, with the deck's art */
  const back = E.traverse(n, 0, US);
  assert.equal(back.ok, true);
  assert.equal(back.game.sides[0].face, BW);
  assert.deepEqual(back.game.builds[0].runeTrigger, {ops: [["banTop", 1]], traverseAt: 3});
  assert.equal(back.game.builds[0].HZOOM.img, C.cdnImg("SBW001"));
});

test("traverse fails when the hero is not double-faced, or when the non-active face generated it", () => {
  const one = H.state({face: null}, {}, {builds: [{}, {}]});
  const r1 = E.traverse(one, 0, null);
  assert.equal(r1.ok, false);
  assert.equal(r1.game, one, "a failed traverse changed the state");
  const g = world(BW);
  const r2 = E.traverse(g, 0, US);
  assert.equal(r2.ok, false, "an ability on the non-active face turned the hero");
  assert.equal(r2.game.sides[0].face, BW);
  /* the op form fails the same way, and the control succeeds */
  assert.equal(fx(H.runOps(g, [["traverse", {face: US}]], "drill")).sides[0].face, BW);
  assert.equal(fx(H.runOps(g, [["traverse", {face: BW}]], "drill")).sides[0].face, US);
});

test("the invariant judge sees a face the build does not run", () => {
  const g = world(BW);
  assert.deepEqual(IV.errors(g), []);
  const drift = {...g, sides: [{...g.sides[0], face: US}, g.sides[1]]};
  assert.deepEqual(IV.errors(drift).map(v => v.code), ["FACE-BUILD-DRIFT"]);
  const unknown = {...g, sides: [{...g.sides[0], face: "Nobody, Anywhere"}, g.sides[1]]};
  assert.deepEqual(IV.errors(unknown).map(v => v.code), ["FACE-UNKNOWN"]);
});

/* ---- Between Worlds: the Runechant trigger --------------------------- */

test("one creation of Runechants banishes ONE card, and the third Runechant this turn traverses", {skip}, () => {
  H.db();
  let g = world(BW, {deck: deck3()});
  g = fx(H.runOps(g, [["rune", 2]], "drill"));
  assert.equal(P.runeCount(g.sides[0]), 2);
  assert.deepEqual(names(g.sides[0].banish), ["Brutal Assault"], "two Runechants in one event banished twice");
  assert.equal(g.sides[0].deck.length, 3);
  assert.equal(g.sides[0].hist.runes, 2);
  assert.equal(g.sides[0].face, BW, "two Runechants traversed");
  g = fx(H.runOps(g, [["rune", 1]], "drill"));
  assert.equal(g.sides[0].hist.runes, 3);
  assert.equal(g.sides[0].banish.length, 2, "the second creation did not banish");
  assert.equal(g.sides[0].face, US, "the third Runechant this turn did not traverse");
  /* Usurper prints no trigger: a fourth Runechant banishes nothing */
  g = fx(H.runOps(g, [["rune", 1]], "drill"));
  assert.equal(g.sides[0].banish.length, 2, "the back face banished");
  assert.equal(g.sides[0].hist.runes, 4);
  assert.deepEqual(IV.errors(g), []);
});

test("a Runechant minted by name counts and triggers; another token does neither", {skip}, () => {
  H.db();
  let g = world(BW, {deck: deck3()});
  g = fx(H.runOps(g, [["token", "Might", 1]], "drill"));
  assert.equal(g.sides[0].board.length, 1, "fixture: the Might token was not minted");
  assert.equal(g.sides[0].hist.runes, 0, "a Might counted as a Runechant");
  assert.equal(g.sides[0].banish.length, 0, "a Might triggered the hero");
  g = fx(H.runOps(g, [["token", "Runechant", 1]], "drill"));
  assert.equal(g.sides[0].hist.runes, 1);
  assert.equal(g.sides[0].banish.length, 1, "a Runechant minted by name did not trigger");
  /* the count is the turn's: a fresh turn starts at none */
  assert.equal(S.freshHist().runes, 0);
});

test("a one-faced hero, and the opponent, are untouched by the trigger", {skip}, () => {
  H.db();
  const g = H.state({res: 9, deck: deck3()}, {deck: deck3("f")}, {builds: [{}, buildOf(BW)]});
  const n = fx(H.runOps(g, [["rune", 3]], "drill"));
  assert.equal(n.sides[0].banish.length, 0, "a hero with no such text banished");
  assert.equal(n.sides[1].banish.length, 0, "the OTHER seat's hero triggered on my Runechants");
  assert.equal(n.sides[1].face, null);
});

/* ---- Usurper: the first blood debt attack goes again ------------------ */

const debt = (uid, nm) => ({...staged("Vexing Gloomblade", uid, 1), name: nm, tx: "Blood Debt"});
function playToLink(g, uid){
  g = act(g, {t: "play", uid, from: "hand"}, 0);
  for(let i = 0; i < 12 && !g.pend; i++) g = H.move(g);
  assert.ok(g.pend, "no chain link opened");
  return g;
}

test("Usurper: the first attack action card with blood debt each turn gets go again, the second does not", {skip}, () => {
  H.db();
  const g0 = world(US, {res: 20, hand: [debt("d1", "Drill Debt One"), debt("d2", "Drill Debt Two")]});
  assert.ok(P.printedKw(g0.sides[0].hand[0], "blood debt"), "fixture: the twin carries blood debt");
  assert.ok(!P.fxParse(g0.sides[0].hand[0]).ga, "fixture: the twin goes again on its own");
  let g = playToLink(g0, "d1");
  assert.equal(g.pend.ga, true, "the first blood debt attack did not go again");
  assert.equal(g.sides[0].hist.atkKw.length, 1, "the play was not recorded");
  assert.ok(g.sides[0].hist.atkKw[0].includes("blood debt"), "the record lost the keyword");
  /* the second, on the same turn: the record says the first has been played */
  const second = playToLink({...g, pend: null, chainOpen: false, chain: [], chainCards: [], stack: [],
    phase: "action", step: "layer", priority: 0, passed: [], sides: [{...g.sides[0], ap: 1}, g.sides[1]]}, "d2");
  assert.equal(second.pend.ga, false, "the second blood debt attack went again");
  /* Between Worlds prints no such grant */
  const bw = playToLink(world(BW, {res: 20, hand: [debt("d1", "Drill Debt One")]}), "d1");
  assert.equal(bw.pend.ga, false, "the front face granted Usurper's go again");
  /* an attack without the keyword is not the first one */
  const plain = {...pool("Brutal Assault", 3, "p1")};
  const pg = playToLink(world(US, {res: 20, hand: [plain]}), "p1");
  assert.equal(pg.pend.ga, false, "an attack without blood debt went again");
  assert.deepEqual(pg.sides[0].hist.atkKw, [[]]);
});

test("a blood debt attack played before the face turned was still the first this turn", {skip}, () => {
  H.db();
  const g = world(US, {res: 20, hand: [debt("d2", "Drill Debt Two")]});
  const seen = {...g, sides: [{...g.sides[0], hist: {...g.sides[0].hist, atkKw: [["blood debt"]]}}, g.sides[1]]};
  assert.equal(playToLink(seen, "d2").pend.ga, false, "an earlier blood debt attack this turn was forgotten");
  assert.equal(playToLink(g, "d2").pend.ga, true, "control: with none before, it is the first");
});

/* ---- Usurper: "at the beginning of each end phase … you may traverse" -- */

test("activating a Gate is recorded by the permanent's name, at the table", {skip}, () => {
  H.db();
  const gateEntry = uid => ({uid, kind: "token", spent: false, card: {...staged(GATE), uid}});
  let g = world(US, {board: [gateEntry("gt1")], banish: [debt("b1", "Drill Debt Banished")]});
  g = act(g, {t: "activate", uid: "gt1"}, 0);
  for(let i = 0; i < 6 && !g.prompt && (g.stack || []).length; i++) g = act(g, {t: "pass"}, g.priority);
  assert.deepEqual(g.sides[0].board, [], "fixture: the Gate was not used");
  assert.deepEqual(g.sides[0].hist.actNames, [P.norm(GATE)]);
  assert.deepEqual(g.sides[1].hist.actNames, [], "the other seat was credited");
});

test("each end phase asks the seat whose Gate it was — its own and the opponent's — and only then", () => {
  const g = world(US);
  const made = {...g, sides: [{...g.sides[0], hist: {...g.sides[0].hist, madeNames: [P.norm(GATE)]}}, g.sides[1]]};
  const used = {...g, sides: [{...g.sides[0], hist: {...g.sides[0].hist, actNames: [P.norm(GATE)]}}, g.sides[1]]};
  for(const [lbl, s] of [["created", made], ["activated", used]]){
    for(const endSeat of [0, 1]){
      const r = E.beginEndPhase(s, endSeat, null);
      const q = (r.game.promptQ || []).filter(p => (p.options || []).some(o => (o.ops || []).some(x => x[0] === "traverse")));
      assert.equal(q.length, 1, lbl + ", end phase of seat " + endSeat + ": not asked");
      assert.equal(q[0].side, 0, "the sheet is addressed to the wrong seat");
      assert.equal(q[0].optional, true, "\"you may\" became mandatory");
      assert.equal(r.game.sides[0].face, US, "the end phase traversed without asking");
    }
  }
  /* no Gate this turn, another token, or the front face: no question */
  const none = E.beginEndPhase(g, 0, null);
  assert.equal((none.game.promptQ || []).length, 0);
  const other = {...g, sides: [{...g.sides[0], hist: {...g.sides[0].hist, madeNames: ["runechant"], actNames: ["might"]}}, g.sides[1]]};
  assert.equal((E.beginEndPhase(other, 0, null).game.promptQ || []).length, 0, "another token opened the question");
  const bw = world(BW);
  const bwMade = {...bw, sides: [{...bw.sides[0], hist: {...bw.sides[0].hist, madeNames: [P.norm(GATE)]}}, bw.sides[1]]};
  assert.equal((E.beginEndPhase(bwMade, 0, null).game.promptQ || []).length, 0, "the front face asked Usurper's question");
});

function endTurnWith(g, answer){
  const t0 = g.turn;
  g = act(g, {t: "endTurn"}, 0);
  let asked = false;
  for(let i = 0; i < 40 && !g.over && g.turn === t0; i++){
    if(g.prompt && (g.prompt.options || []).some(o => (o.ops || []).some(x => x[0] === "traverse"))){
      asked = true;
      g = answer(g);
      continue;
    }
    g = H.move(g);
  }
  return {g, asked};
}

test("at the table: declining keeps the face; the seat's policy takes it, with its own reason", {skip}, () => {
  H.db();
  const base = world(US, {deck: deck3()}, {deck: deck3("f")});
  const g = {...base, sides: [{...base.sides[0], hist: {...base.sides[0].hist, actNames: [P.norm(GATE)]}}, base.sides[1]]};
  const no = endTurnWith(g, s => act(act(s, {t: "promptChoose", choice: "decline"}, 0), {t: "promptConfirm"}, 0));
  assert.equal(no.asked, true, "the end phase never asked");
  assert.equal(no.g.sides[0].face, US, "a declined traverse happened");
  const yes = endTurnWith(g, s => {
    const e = SP.explain(s, 0);
    assert.equal(e.key, "traverseYes", "the policy answered without its reason key");
    assert.ok(SP.CALL_WHY.traverseYes, "the reason key has no line");
    let n = act(s, e.action, 0);
    if(n.prompt) n = act(n, {t: "promptConfirm"}, 0);
    return n;
  });
  assert.equal(yes.asked, true);
  assert.equal(yes.g.sides[0].face, BW, "taken, the hero did not traverse");
  assert.equal(yes.g.builds[0].heroRec.n, BW);
  assert.deepEqual(IV.errors(yes.g), []);
});

/* ---- the face is public state that travels --------------------------- */

test("the face survives the wire, is public in a view, and is in the report", () => {
  const g = E.traverse(world(BW), 0, BW).game;
  const back = W.decode(JSON.parse(JSON.stringify(W.encode(g))));
  assert.equal(back.sides[0].face, US);
  assert.equal(back.builds[0].heroRec.n, US);
  assert.equal(W.hash(back), W.hash(g));
  const other = {...g, sides: [{...g.sides[0], face: BW}, g.sides[1]]};
  assert.notEqual(W.hash(other), W.hash(g), "the face is not in the fingerprint");
  assert.equal(V.view(g, 1).sides[0].face, US, "the opponent cannot see which face is up");
  assert.equal(V.CARRIERS["sides.face"], "names");
  assert.equal(R.build(g, {source: "table"}).sides[0].face, US);
  assert.ok(W.WIRE_V >= 44, "the payload shape changed and WIRE_V did not move");
});
