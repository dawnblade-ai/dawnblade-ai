/* ============================================================
   A FROSTBITE MADE WHILE A PLAY WAITS DOES NOT TAX IT (v6.64)

   Frostbite (pinned): "Cards and abilities cost you an additional {r} to
   play or activate." / "When you play a card or activate an ability,
   destroy this." Both happen as the card is PLAYED. The table holds an
   action-speed play on the stack (v4.66) and `execute` charges its cost as
   the layer resolves, so a Frostbite made in the window (Iyslander's Ice
   card at instant speed, her hero's "create a Frostbite token under their
   control") taxed a card already paid for: found by the ladder as
   NEGATIVE-RES, Kayo's Buckwild resolving at -1 (an AI experiment that cast
   Iyslander's arsenal on the opponent's turn, 784 violations in 192 games).
   `holdPlay` records the Frostbites there at the play (`frostAt`) and
   `resolveHeld` sets the late ones aside: no tax, not destroyed, still there
   to tax the next card.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H  = require("./helpers/judged.js");
const J  = require("../engine/judge.js");
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached DB";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});
const frost = uid => ({card: {...H.tok("Frostbite"), uid}, kind: "aura", spent: false, uid});
const isFrost = b => b && b.card && b.card.name === "Frostbite";

function table(you, foe){
  H.db();
  return {...H.state(Object.assign({ap: 1}, you || {}), Object.assign({res: 9}, foe || {}),
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
}
const held = g => (g.stack || []).find(l => l && l.k === "play");
const step = (g, a, seat) => {
  const out = J.reduce(g, a, seat);
  assert.equal(out.error, null, "fixture: refused — " + out.error);
  return out.state;
};
/* play Raging Onslaught with exactly its cost floating, so a second {r} would be owed */
function waiting(board){
  const atk = c("Raging Onslaught", 1, "atk");
  const g = table({hand: [atk], res: +atk.cost || 0, board: board || []}, {hand: [c("Oasis Respite", 1, "oas")]});
  const n = step(g, {t: "play", uid: "atk", from: "hand"}, 0);
  assert.ok(held(n), "fixture: the attack did not wait on the stack");
  return n;
}
const resolve = n => step(step(n, {t: "pass"}, 0), {t: "pass"}, 1);

test("a Frostbite made while the play waits neither taxes it nor is destroyed by it", {skip}, () => {
  let n = waiting();
  assert.deepEqual(held(n).frostAt, [], "the layer records no Frostbite at the play");
  n = J.put(n, 0, s => ({...s, board: [...(s.board || []), frost("fb-late")]}));
  n = resolve(n);
  assert.ok(!held(n), "fixture: the attack did not resolve");
  assert.ok(n.sides[0].res >= 0, "a player cannot owe resources: res " + n.sides[0].res);
  assert.ok(!INV.errors(n).some(e => e.code === "NEGATIVE-RES"), "NEGATIVE-RES");
  assert.ok((n.sides[0].board || []).some(b => isFrost(b) && b.uid === "fb-late"),
    "the late Frostbite is still there, to tax the next card");
});

test("a Frostbite there AT the play still taxes it and shatters (the v2.74 ruling stands)", {skip}, () => {
  const atk = c("Raging Onslaught", 1, "atk");
  const g = table({hand: [atk, c("Raging Onslaught", 3, "fuel")], res: +atk.cost || 0, board: [frost("fb-early")]},
                  {hand: [c("Oasis Respite", 1, "oas")]});
  let n = J.reduce(g, {t: "play", uid: "atk", from: "hand"}, 0).state;
  /* the tax is owed now: the seat pitches for it */
  assert.ok(J.pendingOf(n), "fixture: the Frostbite's {r} was not owed at the play");
  n = step(step(n, {t: "paySel", uid: "fuel"}, 0), {t: "payConfirm"}, 0);
  assert.ok(held(n), "fixture: the attack did not wait on the stack");
  assert.deepEqual(held(n).frostAt, ["fb-early"]);
  n = resolve(n);
  assert.ok(!(n.sides[0].board || []).some(isFrost), "the Frostbite that met the play shatters");
  assert.ok(n.sides[0].res >= 0, "res " + n.sides[0].res);
});
