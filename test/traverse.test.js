/* ============================================================
   traverse.test.js — THE DOUBLE-FACED HERO (v6.44)

   The seventh reader for Viserai, Between Worlds (ROADMAP-NEWDECKS.md), and
   the last one: the hero himself. Two records, one card, verbatim
   (data/staged.js):

     Viserai, Between Worlds  "Whenever you create 1 or more Runechants,
       (front, Young, 20)      banish the top card of your deck. Then if
                               you've created 3 or more Runechants this
                               turn, traverse."
     Viserai, Usurper         "The first attack action card with blood debt
       (back, Demon, life *)   you play each turn gets go again."
                              "At the beginning of each end phase, if you've
                               created or activated a Gate to i'Arathael this
                               turn, you may traverse."

   CR 8.5.60 (verbatim): "Traverse is a discrete effect. To traverse a
   double-faced card, its non-active face becomes its active face. [9.1]"
   CR 8.5.60a (verbatim): "If the card is not a double-faced card, the
   traverse effect was generated an ability on the non-active face, or the
   non-active face can otherwise not be made active, the traverse effect
   fails." CR 9.1.1 (verbatim): "A double-faced card is a card with two sets
   of properties - each set printed as a separate face on the card."
   CR 9.1.2 (verbatim): "Each face of a double-faced card has its own set of
   printed properties." CR 9.1.2c: an effect keeps applying across the change
   of face. CR 2.5.3c (verbatim): "If the base life of an living-card changes,
   then the life total is recalculated using the new base life value of the
   object." The back prints no value to recalculate with.

   LIFE CARRIES OVER — a reading, recorded in tools/approx.js
   (`traverse-life-carries`): the back prints life "*".

   Asserted on builds, zones, life, action points and per-turn facts. The
   one place a feed line is read says so.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const BD = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const STAGED_RECS = require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard);
const STAGED = C.buildMaps(STAGED_RECS);
const FRONT = "Viserai, Between Worlds", BACK = "Viserai, Usurper", GATE = "Gate to i'Arathael";
const rec = nm => { const r = (STAGED.byName[P.norm(nm)] || [])[0]; assert.ok(r, nm + " is not staged"); return r; };
const staged = (nm, uid, p) => {
  const c = C.resolveEntry(STAGED, {name: nm, p: p || 0, code: null, q: 1});
  assert.ok(c.resolved, nm + " is not a staged card");
  return uid ? {...c, uid} : c;
};
/* THE JUDGE'S DATABASE IS THE POOL, and the back face is not in it until the
   hero opens. The drills that traverse register the pool PLUS the staged
   records, and put the pool back. */
function withStaged(body){
  const pool = H.db();
  const both = C.buildMaps(require("./helpers/extract").readPool()
    .filter(c => c && c.name).map(C.mapDbCard).concat(STAGED_RECS));
  J.setDb(both);
  try { return body(both); } finally { J.setDb(pool); }
}
const build = nm => BD.heroAbilities(rec(nm), nm);
const hist = o => Object.assign(S.freshHist(), o);
const filler = (uid, nm) => ({...H.card("Fry", 3), uid, name: nm || "Filler " + uid});
const deck = n => Array.from({length: n}, (_, i) => filler("dk" + i));
const table = g => ({...g, phase: "action", step: "layer", priority: 0, passed: []});
const world = (b0, a, o) => table(H.state(Object.assign({res: 9, ap: 1, hand: [], deck: deck(6), hp: 17}, a || {}),
  {hp: 20, hand: []}, Object.assign({actor: 0, turnPlayer: 0, turn: 3, builds: [b0, {}]}, o || {})));
const hero = g => g.builds[0].heroRec.n;
const you = g => g.sides[0];
function act(g, a, seat){
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, JSON.stringify(a) + " refused: " + out.error);
  return out.state;
}
function settle(g){ for(let i = 0; i < 40 && (g.pend || (g.stack || []).length || g.prompt); i++){ const m = H.move(g); if(m === g) break; g = m; } return g; }

/* ------------------------------------------------------------------ */

test("the builder reads both faces, and each face only its own lines", () => {
  const f = build(FRONT), b = build(BACK);
  assert.equal(f.runeBanish, 1);
  assert.equal(f.runeTraverse, 3, "the threshold comes off the printed line");
  assert.equal(f.firstAtkGaKw, "");
  assert.equal(f.endTraverse, "");
  assert.equal(b.runeBanish, 0);
  assert.equal(b.runeTraverse, 0);
  assert.equal(b.firstAtkGaKw, "blood debt", "the keyword comes off the printed line");
  assert.equal(b.endTraverse, GATE, "the name keeps its printed capitalisation");
  /* the number is read, not assumed */
  const five = BD.heroAbilities({...rec(FRONT), tx: rec(FRONT).tx.replace("3 or more", "5 or more")}, "Drill Five");
  assert.equal(five.runeTraverse, 5);
  /* the traverse half alone is not the trigger */
  const lone = BD.heroAbilities({...rec(FRONT), tx: "Then if you've created 3 or more Runechants this turn, traverse."}, "Drill Lone");
  assert.equal(lone.runeTraverse, 0, "a threshold with no trigger to ask it");
});

test("the faces find each other by print code, and nothing else is a face", {skip}, () => {
  assert.deepEqual(BD.facesOf(STAGED, rec(FRONT)).map(c => c.n), [BACK]);
  assert.deepEqual(BD.facesOf(STAGED, rec(BACK)).map(c => c.n), [FRONT]);
  assert.deepEqual(BD.facesOf(STAGED, rec("Prism, Advent of Thrones")), [], "a one-faced hero found a face");
  /* a non-hero sharing a code (a token printed on a card's back) is not a hero's face */
  assert.deepEqual(BD.facesOf(STAGED, rec(GATE)), [], "a token was read as a double-faced hero");
  /* ...and a hero's face is a HERO: a token printed on the back of the same card is not one */
  const lone = C.buildMaps([rec(FRONT), {...rec(GATE), pr: {...rec(FRONT).pr}}]);
  assert.deepEqual(BD.facesOf(lone, rec(FRONT)), [], "a non-hero sharing the print code was read as the other face");
  /* ...and two heroes sharing a print code are faces only when ONE image is the back.
     Upstream has such a pair: a promo code printed on two unrelated heroes. */
  const promo = {...rec(BACK), n: "Drill Promo Twin", pr: {...rec(FRONT).pr}};
  assert.deepEqual(BD.facesOf(C.buildMaps([rec(FRONT), promo]), rec(FRONT)), [],
    "two front images under one print code were read as two faces of one card");
  /* census: no hero the pool seats today has a second face, and none reads a new passive */
  const pool = H.db();
  let heroes = 0;
  for(const k of Object.keys(pool.byName)) for(const c of pool.byName[k]){
    if(!(c.ty || []).some(t => /^hero$/i.test(t))) continue;
    heroes++;
    assert.deepEqual(BD.facesOf(pool, c), [], c.n + " has a second face in the pool");
    const a = BD.heroAbilities(c, c.n);
    assert.equal(a.runeBanish, 0, c.n); assert.equal(a.firstAtkGaKw, "", c.n); assert.equal(a.endTraverse, "", c.n);
  }
  assert.ok(heroes >= 15, "the census read no heroes");
});

test("each creation event banishes one card; the third Runechant of the turn traverses; life carries", {skip}, () => withStaged(() => {
  let g = world(build(FRONT));
  g = H.runOps(g, [["rune", 1]], "drill");
  assert.equal(you(g).hist.runes, 1);
  assert.deepEqual(you(g).banish.map(c => c.uid), ["dk0"], "the TOP card is the one banished");
  assert.equal(you(g).deck.length, 5);
  assert.equal(hero(g), FRONT, "one Runechant is not three");
  /* ONE event of two: one banish, and the count reaches three */
  g = H.runOps(g, [["rune", 2]], "drill");
  assert.equal(you(g).hist.runes, 3);
  assert.equal(you(g).banish.length, 2, "an event of two Runechants banished two cards");
  assert.equal(hero(g), BACK, "three Runechants this turn and no traverse");
  assert.equal(g.builds[0]._face.n, FRONT, "the build forgot the face it left");
  assert.equal(you(g).hp, 17, "life moved on a traverse");
  assert.equal(you(g).deck.length, 4);
  assert.equal(P.runeCount(you(g)), 3, "the Runechants did not survive the change of face (CR 9.1.2c)");
  assert.equal(g.builds[0].firstAtkGaKw, "blood debt", "the back face's ability half was not built");
  assert.equal(g.builds[0].runeBanish, 0, "the front face's trigger is still listening");
  /* the back face does not banish */
  g = H.runOps(g, [["rune", 1]], "drill");
  assert.equal(you(g).banish.length, 2, "the Usurper banished off a Runechant");
  assert.equal(you(g).hist.runes, 4, "the count is the turn's, whoever the hero is");
  assert.equal(hero(g), BACK);
}));

test("two Runechants this turn is not three, and the count is the TURN's", {skip}, () => withStaged(() => {
  let g = world(build(FRONT), {hist: hist({runes: 1})});
  g = H.runOps(g, [["rune", 1]], "drill");
  assert.equal(hero(g), FRONT, "traversed at two");
  g = H.runOps(g, [["rune", 1]], "drill");
  assert.equal(hero(g), BACK, "the earlier Runechant of the turn was not counted");
  /* a fresh turn starts from nothing */
  let h = world(build(FRONT), {hist: S.freshHist()});
  h = H.runOps(h, [["rune", 2]], "drill");
  assert.equal(hero(h), FRONT);
}));

test("every way of creating a Runechant is heard, and nothing else is", {skip}, () => withStaged(() => {
  /* the token op, by name */
  let g = H.runOps(world(build(FRONT)), [["token", "Runechant", 1, "self"]], "drill");
  assert.equal(you(g).hist.runes, 1, "a Runechant minted by name was not counted");
  assert.equal(you(g).banish.length, 1);
  /* a special Runechant counts as one (CR 1.8.8) */
  g = H.runOps(world(build(FRONT)), [["token", "Runechant of Lust", 1, "self"]], "drill");
  assert.equal(you(g).hist.runes, 1, "a special Runechant was not counted");
  assert.equal(you(g).banish.length, 1);
  /* any other token is not a Runechant */
  g = H.runOps(world(build(FRONT)), [["token", "Might", 3, "self"]], "drill");
  assert.equal(you(g).hist.runes, 0, "a Might token was counted as a Runechant");
  assert.equal(you(g).banish.length, 0);
  assert.equal(hero(g), FRONT);
  /* a real card: Otherworldly Sins prints "Create a Runechant token." */
  g = world(build(FRONT), {hand: [staged("Otherworldly Sins", "os", 1)]});
  g = settle(act(g, {t: "play", uid: "os", from: "hand"}, 0));
  assert.equal(you(g).hist.runes, 1, "a played card's Runechant was not counted");
  assert.deepEqual(you(g).banish.map(c => c.uid), ["dk0"]);
}));

test("a hero who prints no such line counts the Runechants and banishes nothing", {skip}, () => {
  let g = world({});
  g = H.runOps(g, [["rune", 3]], "drill");
  assert.equal(you(g).hist.runes, 3);
  assert.equal(you(g).banish.length, 0);
  assert.equal(you(g).deck.length, 6);
});

test("an empty deck banishes nothing and the traverse is still asked", {skip}, () => withStaged(() => {
  let g = world(build(FRONT), {deck: []});
  g = H.runOps(g, [["rune", 3]], "drill");
  assert.equal(you(g).banish.length, 0);
  assert.equal(hero(g), BACK);
}));

test("CR 8.5.60a: a traverse fails with no other face, and from a face that is no longer active", {skip}, () => withStaged(db => {
  const g = world(build(FRONT));
  /* not a double-faced card */
  const prism = BD.heroAbilities(rec("Prism, Advent of Thrones"), "Prism");
  let out = E.traverse(world(prism), 0, db);
  assert.equal(out.ok, false);
  assert.equal(out.game.builds[0].heroRec.n, "Prism, Advent of Thrones");
  /* the pool alone does not hold the back face: the effect fails rather than inventing one */
  out = E.traverse(g, 0, H.db());
  assert.equal(out.ok, false, "a face was found in a database that does not hold it");
  assert.equal(out.game.builds[0].heroRec.n, FRONT);
  /* generated by the face that is not active */
  out = E.traverse(g, 0, db, BACK);
  assert.equal(out.ok, false, "an ability of the non-active face traversed");
  out = E.traverse(g, 0, db, FRONT);
  assert.equal(out.ok, true);
  assert.equal(out.game.builds[0].heroRec.n, BACK);
  /* and back again, to the face the seat came from */
  out = E.traverse(out.game, 0, db);
  assert.equal(out.game.builds[0].heroRec.n, FRONT);
  assert.equal(out.game.builds[0].runeBanish, 1);
  assert.equal(g.builds[0].heroRec.n, FRONT, "traverse mutated the state it was handed");
}));

/* a blood debt attack action card with no go again of its own */
const blade = (uid, nm) => ({...staged("Cullingsong Gloomblade", uid, 1), name: nm || "Drill Debt Blade " + uid, tx: "Blood Debt", kw: ["Blood Debt"]});
function swing(g, uid){
  g = act(g, {t: "play", uid, from: "hand"}, 0);
  return settle(g);
}

test("the fixture bites: the drill blade carries blood debt and no go again", {skip}, () => {
  const b = blade("b1");
  assert.ok(P.printedKw(b, "blood debt"));
  assert.ok(!P.fxParse(b).ga, "the drill blade has go again of its own");
  assert.ok(P.isAttack(b));
});

test("the Usurper's first blood debt attack each turn gets go again; the second does not", {skip}, () => {
  let g = world(build(BACK), {hand: [blade("b1"), blade("b2")]});
  assert.equal(J.keepsActionPoint(g, 0, "b1", "hand"), true, "the AI's reader does not see the grant");
  g = swing(g, "b1");
  assert.equal(you(g).ap, 1, "the first blood debt attack spent the action point");
  assert.deepEqual(you(g).hist.atkKws, ["blood debt"]);
  assert.equal(J.keepsActionPoint(g, 0, "b2", "hand"), false, "the reader offers the grant twice");
  g = swing(g, "b2");
  assert.equal(you(g).ap, 0, "the second blood debt attack kept the action point");
});

test("the grant is the back face's, and an attack without the keyword neither takes nor spends it", {skip}, () => {
  /* the front face prints no such line */
  let g = world(build(FRONT), {hand: [blade("b1")]});
  assert.equal(J.keepsActionPoint(g, 0, "b1", "hand"), false);
  g = swing(g, "b1");
  assert.equal(you(g).ap, 0, "Between Worlds granted go again");
  assert.deepEqual(you(g).hist.atkKws, ["blood debt"], "the play was not recorded for a hero who was not listening");
  /* an attack that does not carry blood debt */
  const plain = {...H.card("Brutal Assault", 3), uid: "pa"};
  assert.ok(!P.printedKw(plain, "blood debt"));
  g = world(build(BACK), {hand: [plain, blade("b1")], ap: 2});
  g = swing(g, "pa");
  assert.equal(you(g).ap, 1, "an attack without blood debt got go again");
  g = swing(g, "b1");
  assert.equal(you(g).ap, 1, "the plain attack spent the blood debt grant");
});

test("the grant reaches a blood debt attack played from the banished zone, and the reader says so", {skip}, () => {
  /* the staged card prints its own banished-zone line and no go again */
  const real = staged("Cullingsong Gloomblade", "cg", 1);
  assert.ok(P.fxParse(real).fromBan, "fixture: the staged card no longer prints its banished-zone line");
  assert.ok(!P.fxParse(real).ga, "fixture: the staged card has go again of its own");
  let g = world(build(BACK), {banish: [real, {...real, uid: "cg2"}]});
  assert.equal(J.keepsActionPoint(g, 0, "cg", "banish"), true, "the reader does not see the grant on a banished card");
  g = settle(act(g, {t: "play", uid: "cg", from: "banish"}, 0));
  assert.equal(you(g).ap, 1, "a blood debt attack played from banish spent the action point");
  assert.equal(J.keepsActionPoint(g, 0, "cg2", "banish"), false, "the reader offers the grant twice from banish");
  /* and the front face gets nothing from there either */
  const f = world(build(FRONT), {banish: [real]});
  assert.equal(J.keepsActionPoint(f, 0, "cg", "banish"), false);
});

test("first means first this TURN: a blood debt attack played before the traverse has spent it", {skip}, () => {
  let g = world(build(BACK), {hand: [blade("b2")], hist: hist({atkKws: ["blood debt"]})});
  assert.equal(J.keepsActionPoint(g, 0, "b2", "hand"), false);
  g = swing(g, "b2");
  assert.equal(you(g).ap, 0, "the Usurper granted go again to the turn's second blood debt attack");
});

/* ---- the end phase ------------------------------------------------- */
const gateEntry = uid => ({uid, kind: "token", spent: false, card: {...staged(GATE), uid}});
const usurper = () => Object.assign({}, build(BACK), {_face: rec(FRONT)});
const gateFact = {madeNames: [P.norm(GATE)]};
function endTurn(g, seat){
  const out = J.reduce(g, {t: "endTurn"}, seat);
  assert.equal(out.error, null, "endTurn refused: " + out.error);
  let n = out.state;
  /* both seats pass until the end phase asks or the turn is handed over */
  for(let i = 0; i < 12 && !n.prompt && n.turn === g.turn && n.priority != null; i++) n = act(n, {t: "pass"}, n.priority);
  return n;
}

test("no Gate this turn, no question", {skip}, () => withStaged(db => {
  const g = world(usurper(), {hist: hist({madeNames: ["runechant"], actNames: ["energy potion"]})});
  const be = E.beginEndPhase(g, 0, db);
  assert.equal((be.game.promptQ || []).length, 0, "the Usurper was asked without a Gate");
  /* and the front face is never asked */
  const f = E.beginEndPhase(world(build(FRONT), {hist: hist(gateFact)}), 0, db);
  assert.equal((f.game.promptQ || []).length, 0, "Between Worlds was offered the Usurper's traverse");
}));

test("a Gate created this turn: the end phase holds, staying is the first answer, and the policy stays", {skip}, () => withStaged(() => {
  let g = endTurn(world(usurper(), {hist: hist(gateFact)}), 0);
  assert.ok(g.prompt, "the end phase did not ask");
  assert.equal(g.prompt.tag, "modal");
  assert.equal(g.prompt.side, 0);
  assert.equal(g.endHold, 0, "the end phase ran on past the question");
  assert.equal(g.prompt.options.length, 2);
  assert.deepEqual(g.prompt.options[0].ops, [], "the first mode does something");
  const a = J.autoAnswer(g);
  assert.deepEqual(a, {t: "promptChoose", choice: 0});
  let stay = act(g, a, 0);
  for(let i = 0; i < 6 && stay.prompt; i++) stay = act(stay, J.autoAnswer(stay), 0);
  assert.equal(hero(stay), BACK, "the policy traversed");
  assert.ok(stay.endHold == null, "the end phase never resumed");
  assert.notEqual(stay.turnPlayer, 0, "the turn was never handed over after staying");
  /* the person who takes it */
  let go = act(g, {t: "promptChoose", choice: 1}, 0);
  for(let i = 0; i < 6 && go.prompt; i++) go = act(go, {t: "promptConfirm"}, 0);
  assert.equal(hero(go), FRONT, "the traverse was chosen and the face did not change");
  assert.equal(go.builds[0].runeBanish, 1);
  assert.equal(go.builds[0]._face.n, BACK);
  assert.equal(go.sides[0].hp, 17, "life moved on the way back");
  assert.notEqual(go.turnPlayer, 0, "the turn was never handed over");
}));

test("activating a real Gate is the other fact, recorded where the ability resolves", {skip}, () => withStaged(db => {
  const debt = {...staged("Vexing Gloomblade", "d1", 1), name: "Drill Debt Target", tx: "Blood Debt"};
  let g = world(usurper(), {board: [gateEntry("gt1")], banish: [debt]});
  g = act(g, {t: "activate", uid: "gt1"}, 0);
  if(g.pending && g.pending.kind === "abtarget") g = act(g, {t: "abtarget", uid: "d1"}, 0);
  g = settle(g);
  assert.deepEqual(you(g).hist.actNames, [P.norm(GATE)], "the activation left no fact");
  assert.equal(you(g).hist.madeNames.indexOf(P.norm(GATE)), -1, "the fixture created a Gate as well: two facts coincide");
  const be = E.beginEndPhase(g, 0, db);
  assert.equal((be.game.promptQ || []).length, 1, "an activated Gate did not open the question");
  assert.equal(be.game.promptQ[0].side, 0);
  /* a card PLAYED is not an activation */
  assert.deepEqual(world({}).sides[0].hist.actNames, []);
}));

test("EACH end phase: the Usurper in the other seat is asked on the turn-player's end phase", {skip}, () => withStaged(db => {
  const g = table(H.state({hp: 20, hand: []}, {hp: 11, hist: hist(gateFact)},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, usurper()]}));
  const be = E.beginEndPhase(g, 0, db);
  assert.equal(be.game.promptQ.length, 1);
  assert.equal(be.game.promptQ[0].side, 1, "the question went to the wrong seat");
  /* answered at the table by seat 1, and only seat 1's hero turns */
  let n = endTurn(g, 0);
  assert.equal(n.prompt.side, 1);
  assert.ok(J.legal(n, {t: "promptChoose", choice: 1}, 0), "seat 0 may answer seat 1's traverse");
  n = act(n, {t: "promptChoose", choice: 1}, 1);
  for(let i = 0; i < 6 && n.prompt; i++) n = act(n, {t: "promptConfirm"}, 1);
  assert.equal(n.builds[1].heroRec.n, FRONT);
  assert.equal(n.sides[1].hp, 11);
}));

test("the per-turn facts start empty and are public", () => {
  const h = S.freshHist();
  assert.equal(h.runes, 0);
  assert.deepEqual(h.actNames, []);
  assert.deepEqual(h.atkKws, []);
});
