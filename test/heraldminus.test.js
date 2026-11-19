/* ============================================================
   test/heraldminus.test.js — "-1{p} WHILE DEFENDING" (v6.47, Prism reader 6)

   Staged, Prism's deck:
     Herald of Triumph   "Attack action cards get -1{p} while defending this." (phantasm)
     Herald of Victoria  "Instant - Discard this: Until end of turn, attack action cards your
                          opponents control get -1{p} while attacking and defending."

   A defender's power is read in one place, phantasm's pop: a 6{p} non-Illusionist attack
   action card pops a phantasm attack, a 5 does not. So Triumph met by a 6 is an ordinary
   block and met by a 7 still pops; Victoria discarded makes the opponent's 6 a 5 against any
   phantasm attack, and shaves their own attack by 1. Asserted on life, zones and hands.
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
const blocker = (uid, power) => ({uid, name: "Blocker " + uid, def: 3, power, pitch: 1, cost: 0,
                                  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: ""});

function table(hand0, hand1){
  const g = H.state({name: "You", res: 9, ap: 3, hand: hand0}, {name: "Them", res: 9, hand: hand1},
                    {actor: 0, turnPlayer: 0, seed: "heraldminus"});
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
function swing(g, uid, w, seat){
  seat = seat || 0;
  let n = J.reduce(g, {t: "play", uid, from: "hand"}, seat).state;
  if(n.pending && n.pending.kind === "boost") n = J.reduce(n, {t: "boost", yes: false}, seat).state;
  n = passTo(n, s => s.step === "defend");
  assert.equal(n.step, "defend", "fixture: the drill did not reach the defend step");
  if(w){ const d = J.reduce(n, {t: "defend", uid: w}, 1 - seat); assert.equal(d.error, null, "fixture: the block was refused: " + d.error); n = d.state; }
  return passTo(n, s => s.phase === "action" && s.step === "layer" && !s.pend && !(s.stack || []).length && !s.prompt);
}
const popped = (n, uid) => n.sides[0].grave.some(c => c.uid === uid);

test("the readers: Triumph's static and Victoria's discard instant read; a wording off the shape refuses", {skip}, () => {
  P.fxReset();
  assert.equal(P.fxParse({...staged("Herald of Triumph", 1), name: "Drill HT"}).defAtkPow, -1);
  const ha = P.fxParse({...staged("Herald of Victoria", 2), name: "Drill HV"}).handAbility;
  assert.deepEqual(ha && ha.ops, [["foeAtkBuff", -1, {aac: true}, "turn"]]);
  assert.equal(P.classifyClause("Attack action cards get -1{p} while attacking this."), null, "a different window was read");
});

test("Herald of Triumph: a 6{p} blocker meets it as a 5 and does not pop it; a 7 still does", {skip}, () => {
  const ht = staged("Herald of Triumph", 1, "ht1");
  assert.ok(ht.resolved && P.hasKw(ht, "phantasm"), "fixture: Herald of Triumph has no phantasm");
  const hp = 20;
  let n = swing(table([ht], [blocker("b6", 6)]), "ht1", "b6");
  assert.equal(hp - n.sides[1].hp, (+ht.power) - 3, "the 6{p} blocker popped Herald of Triumph");
  n = swing(table([{...ht}], [blocker("b7", 7)]), "ht1", "b7");
  assert.equal(n.sides[1].hp, hp, "control: a 7{p} blocker (6 while defending) did not pop it");
  /* the control on the card: a phantasm attack without the line pops on a 6 */
  const sp = {...H.card("Spears of Surreality", 1), uid: "sp1"};
  n = swing(table([sp], [blocker("b6", 6)]), "sp1", "b6");
  assert.equal(n.sides[1].hp, hp, "fixture: Spears of Surreality was not popped by a 6");
});

test("Herald of Victoria, discarded: the opponent's 6{p} blocker is a 5 against any phantasm attack this turn", {skip}, () => {
  const hv = staged("Herald of Victoria", 2, "hv1");
  const sp = {...H.card("Spears of Surreality", 1), uid: "sp1"};
  let g = table([hv, sp], [blocker("b6", 6)]);
  const A = {t: "activate", from: "hand", uid: "hv1"};
  assert.equal(J.legal(g, A, 0), null, "the table refused Victoria's discard instant");
  let n = passTo(J.reduce(g, A, 0).state, s => !(s.stack || []).length && !s.prompt);
  assert.ok(n.sides[0].grave.some(c => c.uid === "hv1"), "Victoria was not discarded");
  n = swing(n, "sp1", "b6");
  assert.equal(20 - n.sides[1].hp, 2, "the 6{p} blocker still popped Spears (5 against 3 lands 2)");
});

test("Herald of Victoria, discarded on their turn: their attack action card attacks for 1 less", {skip}, () => {
  const hv = staged("Herald of Victoria", 2, "hv1");
  const theirs = blocker("t5", 5);
  let g = H.state({name: "You", res: 9, ap: 1, hand: [hv]}, {name: "Them", res: 9, ap: 1, hand: [theirs]},
                  {actor: 1, turnPlayer: 1, seed: "heraldminus2"});
  g = {...g, phase: "action", step: "layer", priority: 1, passed: []};
  let n = J.reduce(g, {t: "play", uid: "t5", from: "hand"}, 1).state;
  n = passTo(n, s => s.step === "defend" || (s.priority === 0 && (s.step === "attack")));
  const act = J.reduce(n, {t: "activate", from: "hand", uid: "hv1"}, 0);
  assert.equal(act.error, null, "Victoria could not be discarded during their attack: " + act.error);
  n = passTo(act.state, s => s.phase === "action" && s.step === "layer" && !s.pend && !(s.stack || []).length && !s.prompt);
  assert.equal(20 - n.sides[0].hp, 4, "their 5{p} attack did not lose 1 while attacking");
  const bare = passTo(J.reduce(g, {t: "play", uid: "t5", from: "hand"}, 1).state, s => s.phase === "action" && s.step === "layer" && !s.pend && !(s.stack || []).length && !s.prompt);
  assert.equal(20 - bare.sides[0].hp, 5, "fixture: the attack does not land 5 unanswered");
});
