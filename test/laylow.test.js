/* ============================================================
   test/laylow.test.js — LAY LOW and HERALD OF JUDGMENT (v6.47, Prism reader 7)

   Staged, Prism's deck:
     Lay Low             "If you are marked, you can't play this." ||
                         "If the attacking hero is marked, their next attack this turn gets -1{p}."
     Herald of Judgment  "When this hits, put it into your soul and the defending hero can't
                         play cards from their banished zone until the end of their next turn."

   Driven at the table; asserted on legality, life, zones and the side's schedule.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const STAGED = C.buildMaps(require("../data/staged.js").filter(c => c && c.name).map(C.mapDbCard));
const staged = (name, p, uid) => ({...C.resolveEntry(STAGED, {name, p: p || 0, code: null, q: 1}), uid});
const plain = (uid, power) => ({uid, name: "Plain " + uid, def: 2, power, pitch: 1, cost: 0,
                                tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: ""});
const passTo = (n, done) => {
  for(let i = 0; i < 30 && !done(n); i++){
    if(n.prompt){ const m = H.move(n); if(m === n) break; n = m; continue; }
    let moved = false;
    for(const seat of [0, 1]){ const out = J.reduce(n, {t: "pass"}, seat); if(!out.error){ n = out.state; moved = true; break; } }
    if(!moved) break;
  }
  return n;
};
const idle = s => s.phase === "action" && s.step === "layer" && !s.pend && !(s.stack || []).length && !s.prompt;

/* Them (seat 1) on turn, two plain attacks; You (seat 0) hold Lay Low. */
function table(o){
  o = o || {};
  const g = H.state({name: "You", res: 9, ap: 0, hand: [staged("Lay Low", 2, "ll1")], marked: !!o.youMarked},
                    {name: "Them", res: 9, ap: 3, hand: [plain("a1", 4), plain("a2", 4)], marked: !!o.themMarked},
                    {actor: 1, turnPlayer: 1, seed: "laylow"});
  return {...g, phase: "action", step: "layer", priority: 1, passed: []};
}
/* swing a1, answer it with Lay Low when the reaction step opens, then swing a2 unanswered */
function drive(o){
  let n = J.reduce(table(o), {t: "play", uid: "a1", from: "hand"}, 1).state;
  n = passTo(n, s => s.step === "reaction" && s.priority === 0);
  assert.equal(n.step, "reaction", "fixture: the reaction step never reached You");
  const L = {t: "play", uid: "ll1", from: "hand"};
  const why = J.legal(n, L, 0);
  if(why) return {why};
  n = passTo(J.reduce(n, L, 0).state, idle);
  const hp1 = n.sides[0].hp;
  n = J.reduce(n, {t: "play", uid: "a2", from: "hand"}, 1).state;
  n = passTo(n, idle);
  return {n, second: hp1 - n.sides[0].hp};
}

test("the readers: Lay Low's gate and effect, Judgment's rider; a wording off the shape refuses", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse({...staged("Lay Low", 2), name: "Drill LL"});
  assert.deepEqual(fx.playIf && fx.playIf.kind, "notMarked");
  assert.equal(fx.tier, "full");
  const hj = P.fxParse({...staged("Herald of Judgment", 2), name: "Drill HJ"});
  assert.deepEqual(hj.onHit, [["soulSelf"], ["foeNextTurn", "noBanPlay", 0]]);
  assert.equal(P.classifyClause("If the attacking hero is marked, their next attack this turn gets +1{p}."), null);
});

test("Lay Low: a marked hero can't play it; an unmarked one can", {skip}, () => {
  assert.ok(drive({youMarked: true}).why, "a marked hero played Lay Low");
  assert.equal(drive({}).why, undefined, "an unmarked hero was refused Lay Low");
});

test("Lay Low: against a marked attacker their next attack lands 1 less; against an unmarked one it does not", {skip}, () => {
  const marked = drive({themMarked: true}), bare = drive({});
  assert.equal(bare.second, 4, "fixture: the second attack does not land its 4");
  assert.equal(marked.second, 3, "the marked attacker's next attack did not get -1{p}");
});

test("Herald of Judgment: the hit locks the defending hero's banished zone through their next turn", {skip}, () => {
  const hj = staged("Herald of Judgment", 2, "hj1");
  let g = H.state({name: "You", res: 9, ap: 1, hand: [hj]}, {name: "Them", hand: []}, {actor: 0, turnPlayer: 0, seed: "judgment"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  let n = passTo(J.reduce(g, {t: "play", uid: "hj1", from: "hand"}, 0).state, idle);
  assert.ok(n.sides[1].hp < 20, "fixture: Herald of Judgment did not hit");
  const lock = (n.sides[1].nextTurn || []).filter(e => e && e.kind === "noBanPlay");
  assert.equal(lock.length, 1, "the hit did not lock the defending hero's banished zone");
  /* on their turn, armed: a card they may play from banish is refused; without the lock it is not */
  const onTheirTurn = entries => {
    let s = H.state({name: "You", hp: 20}, {name: "Them", res: 9, ap: 1, hand: [], nextTurn: entries},
                    {actor: 1, turnPlayer: 1, turn: 4});
    s.builds = [{}, {}];
    s = J.withEffects({...s, actor: 1}, (f, x) => f.runOps(x, [["mkBanish", "crouching tiger"]], "probe"));
    s = {...s, phase: "action", step: "layer", priority: 1, passed: []};
    const ct = s.sides[1].banish[0];
    return J.legal(s, {t: "play", uid: ct.uid, from: "banish"}, 1);
  };
  H.db();
  assert.equal(onTheirTurn([]), null, "fixture: the banished card is not playable at all");
  assert.ok(onTheirTurn(lock.map(e => ({...e, ready: true}))), "the lock did not hold on their next turn");
  assert.ok(onTheirTurn(lock), "the lock did not hold for the rest of this turn");
});
