/* ============================================================
   "YOUR NEXT SWORD ATTACK" IS A LATER ONE (v5.20)

   > "Target sword attack gets go again. Your next sword attack this turn
   > gets +N{p}." — RUN THROUGH ×3, Dorinthea's (+3 / +2 / +1)

   An attack reaction is played on an attack that is already on the chain,
   so "your NEXT sword attack" names a LATER one, and Dorinthea's hero hands
   her exactly that second sword swing. `parser.rxPump` folded every
   unconditional `buffNext` op into the reaction's pump, so the +N landed on
   the swing Run Through targeted and nothing waited for the next one
   (QUEUE item 6). The op runs as itself now: a sword-qualified grant on the
   side, which waits for a sword attack (v2.30) and expires with the turn.

   ASSERT ON POWER AND THE GRANT, NEVER ON THE FEED (v2.45).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const swordAtk = (uid, power) => ({name: "Practice Sword Strike " + uid, uid, pitch: 1, cost: 0, power: power || 4, def: 2,
  tt: "Warrior Action - Sword Attack", ty: ["Warrior", "Action", "Sword", "Attack"], tx: "", kw: [], gkw: []});
const plainAtk = (uid, power) => ({name: "Plain Swing " + uid, uid, pitch: 1, cost: 0, power: power || 4, def: 2,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

test("CENSUS: the attack reactions that print a \"your next attack\" grant", {skip}, () => {
  /* Pinned both ways. An unconditional one runs through `attackRx`'s
     `runOps`; a gated one runs inside its gate's branch. Neither is a pump
     on the attack the reaction targets. */
  const DB = H.db(), plain = new Set(), gated = new Set();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k], r = H.card(c.n, c.p == null ? 0 : c.p);
    if(!r || !P.isAR(r)) continue;
    const fx = P.fxParse(r);
    if((fx.ops || []).some(o => o[0] === "buffNext")) plain.add(r.name);
    if((fx.conds || []).some(e => e.op && e.op[0] === "buffNext")) gated.add(r.name);
  }
  assert.deepEqual([...plain], ["Run Through"]);
  assert.deepEqual([...gated], ["Out for Blood"]);
});

test("rxPump: a \"your next attack\" op is no part of the pump on THIS attack", () => {
  const fx = {self: 0, conds: [], ops: [["buffNext", 3, {g: [["sword"]]}]]};
  assert.equal(P.rxPump(fx, []).pump, 0);
  /* CONTROL: the printed targeted pump still is */
  assert.equal(P.rxPump({self: 2, conds: [], ops: []}, []).pump, 2);
});

test("Run Through on the attack it targets: go again, no pump, and the +N waits", {skip}, () => {
  H.db();
  for(const pitch of [1, 2, 3]){
    const rt = H.card("Run Through", pitch);
    const amt = P.fxParse(rt).ops.find(o => o[0] === "buffNext")[1];
    const atk = swordAtk("a1");
    const g = {...H.state({hand: [], res: 9}, {}, {turn: 3, actor: 0}),
               pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: []}, stack: []};
    const out = J.withEffects(g, (f, s) => f.attackRx(s, rt, {handBlockers: 0}).game);
    assert.equal(out.pend.ga, true, "the target goes again");
    assert.equal(E_total(out), atk.power, "pitch " + pitch + ": the targeted swing keeps its printed power");
    assert.deepEqual(out.sides[0].buffQ.map(b => b.amt), [amt], "pitch " + pitch + ": the +" + amt + " waits on the side");
    assert.deepEqual(out.sides[0].buffQ[0].q, {g: [["sword"]]}, "for a SWORD attack");
  }
});
const E_total = n => n.pend.total + require("../engine/effects.js").rxPumpTotal(n);

test("DRIVEN at the table: the NEXT sword attack collects it, a non-sword one does not", {skip}, () => {
  H.db();
  const rt = {...H.card("Run Through", 1), uid: "rt"};
  const amt = P.fxParse(rt).ops.find(o => o[0] === "buffNext")[1];
  const run = second => {
    const first = swordAtk("a1");
    let g = {...H.state({hand: [first, rt, second], res: 9, ap: 3}, {hp: 40}, {turn: 3, actor: 0}),
             phase: "action", step: "layer", priority: 0, passed: [], firstPlayer: 0, round: 1, over: null, turnPlayer: 0};
    const go = (a, s) => { const o = J.reduce(g, a, s); assert.equal(o.error, null, JSON.stringify(a) + ": " + o.error); g = o.state; };
    go({t: "play", uid: "a1", from: "hand"}, 0); g = H.drain(g);
    for(let i = 0; i < 10 && g.step !== "reaction"; i++) go({t: "pass"}, g.priority);
    for(let i = 0; i < 4 && g.priority !== 0; i++) go({t: "pass"}, g.priority);
    go({t: "play", uid: "rt", from: "hand"}, 0); g = H.answerAll(H.drain(g));
    for(let i = 0; i < 14 && g.step !== "resolution"; i++) go({t: "pass"}, g.priority);
    assert.equal(g.sides[1].hp, 40 - first.power, "the first swing dealt its PRINTED power — the +N was not its");
    for(let i = 0; i < 6 && !(g.step === "layer" || g.step === "resolution") ; i++) go({t: "pass"}, g.priority);
    go({t: "play", uid: second.uid, from: "hand"}, 0); g = H.drain(g);
    return g;
  };
  const sw = run(swordAtk("a2", 5));
  assert.equal(sw.pend.total, 5 + amt, "the next SWORD attack collects the +" + amt);
  assert.deepEqual(sw.sides[0].buffQ, [], "and the grant is spent");
  const pl = run(plainAtk("a3", 5));
  assert.equal(pl.pend.total, 5, "a non-sword attack does not take it");
  assert.equal(pl.sides[0].buffQ.length, 1, "…and it keeps waiting (v2.30)");
});
