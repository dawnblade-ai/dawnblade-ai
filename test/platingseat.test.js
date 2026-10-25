/* ============================================================
   platingseat.test.js — "YOU CONTROL" IS NOT THE OPPONENT'S ATTACK (v5.43)

   QUEUE v4 S10(b). Predatory Plating prints "Activate this only if you
   control a card with 6 or more {p}", and `activateIfOk`'s `controlPow`
   counted the live attack on the chain (RULING 2026-08-08: that is what
   makes the piece reachable at all) WHOEVER declared it. So a 6-power
   swing by Dorinthea made Kayo's "Destroy this: Gain {r}" legal for him
   on HER turn, in every step of the chain.

   The attack counts only when `pend.by` is the asking seat, the test
   `chainAtkOf` already makes. Driven at the table: refused in all five
   steps with the card's own sentence, and Kayo's own 6-power swing still
   enables it (the positive control, or a gate that refuses everything
   passes the first half perfectly).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const SP = require("../tools/selfplay.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const BIG = {uid: 9001, name: "Probe Haymaker", tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], kw: [], tx: "", power: 6, def: 2, cost: 0, pitch: 1};

function opening(first){
  H.db();
  const g = SP.match("kayo", "dorinthea", 7, first);
  const pl = g.sides[0].gear.find(x => x.name === "Predatory Plating");
  assert.ok(pl, "fixture: Kayo wears Predatory Plating");
  return {g, pl};
}
const withHand = (g, seat, c) => ({...g, sides: g.sides.map((s, i) => i === seat ? {...s, hand: [c, ...s.hand]} : s)});

test("an OPPONENT's 6-power attack does not satisfy the Plating's gate, in any step", {skip}, () => {
  let {g, pl} = opening(1);
  assert.equal(g.turnPlayer, 1, "fixture: Dorinthea's turn");
  g = withHand(g, 1, {...BIG});
  const r = J.reduce(g, {t: "play", uid: BIG.uid, from: "hand", target: "hero"}, 1);
  assert.equal(r.error, null);
  g = r.state;
  const seen = new Set();
  for(let i = 0; i < 20 && g.pend; i++){
    if(g.prompt){ g = J.reduce(g, J.autoAnswer(g), g.prompt.side || 0).state; continue; }
    if(g.priority === 0){
      for(const uid of [pl.uid, "gp" + pl.uid]){
        const why = J.legal(g, {t: "activate", uid}, 0);
        assert.match(String(why), /6 or more power/,
          `step ${g.step}: the ability must be refused with its own sentence, got ${why}`);
      }
      seen.add(g.step);
    }
    if(g.priority == null) break;
    const out = J.reduce(g, {t: "pass"}, g.priority);
    assert.equal(out.error, null);
    g = out.state;
  }
  assert.deepEqual([...seen].sort(), ["attack", "damage", "defend", "reaction", "resolution"],
    "Kayo held priority in all five steps of her chain, and was refused in each");
});

test("positive control: Kayo's OWN 6-power attack makes the Plating legal", {skip}, () => {
  let {g, pl} = opening(0);
  assert.equal(g.turnPlayer, 0, "fixture: Kayo's turn");
  g = withHand(g, 0, {...BIG});
  const r = J.reduce(g, {t: "play", uid: BIG.uid, from: "hand", target: "hero"}, 0);
  assert.equal(r.error, null);
  g = r.state;
  let legalSomewhere = false;
  for(let i = 0; i < 20 && g.pend; i++){
    if(g.prompt){ g = J.reduce(g, J.autoAnswer(g), g.prompt.side || 0).state; continue; }
    if(g.priority === 0 && J.legal(g, {t: "activate", uid: pl.uid}, 0) === null) legalSomewhere = true;
    if(g.priority == null) break;
    g = J.reduce(g, {t: "pass"}, g.priority).state;
  }
  assert.ok(legalSomewhere, "his own swing is a card he controls with 6 or more power");
});
