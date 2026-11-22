/* ============================================================
   A HELD PLAY PAYS THE PRICE IT WAS PLAYED AT (v6.65)

   The table holds an action-speed play on the stack (v4.66) and `execute`
   charged its cost as the layer RESOLVED, reading the board again. v6.64
   found one case (a Frostbite made in the window taxed a paid play); this
   is the rest of the class. Rune Flash (pinned): "This costs {r} less to
   play for each Runechant you control." Waiting with one Runechant, a second
   made at instant speed (Runic Disposition's "Instant - Discard this: Create
   a Runechant token", Arcane Seeds) made it a resource cheaper at resolution
   — a refund no invariant sees; a Runechant destroyed in the window
   (Runebleed Robe's "Instant - Destroy this and a Runechant you control")
   charged it a resource more. CR 5.1.6 calculates the asset-costs and CR
   5.1.7 pays them, both before CR 5.1.10's "the card is now considered
   played". `holdPlay` records the `price`; `execute` charges it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H  = require("./helpers/judged.js");
const J  = require("../engine/judge.js");
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached DB";
const c = (nm, p, uid) => ({...H.card(nm, p), uid});
const rune = uid => ({card: {...H.tok("Runechant"), uid}, kind: "aura", spent: false, uid});
const runes = k => Array.from({length: k}, (_, i) => rune("rc" + i));

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
const resolve = n => step(step(n, {t: "pass"}, 0), {t: "pass"}, 1);

/* Rune Flash played with `before` Runechants and `res` floating; the board then holds `after` */
function run(before, after, res){
  const atk = c("Rune Flash", 1, "rf");
  const g = table({hand: [atk], res, board: runes(before)}, {hand: [c("Oasis Respite", 1, "oas")]});
  let n = step(g, {t: "play", uid: "rf", from: "hand"}, 0);
  assert.ok(held(n), "fixture: Rune Flash did not wait on the stack");
  const price = Math.max(0, (+atk.cost || 0) - before);
  assert.equal(held(n).price, price, "the layer records the price as played");
  n = J.put(n, 0, s => ({...s, board: runes(after)}));
  n = resolve(n);
  assert.ok(!held(n), "fixture: Rune Flash did not resolve");
  assert.ok((n.chainCards || []).concat(n.pend ? [n.pend.card] : []).some(x => x && x.uid === "rf")
            || n.pend, "fixture: Rune Flash is not the attack");
  return {n, price};
}

test("a Runechant made while it waits does not refund the price", {skip}, () => {
  const {n, price} = run(1, 2, 9);
  assert.ok(price > 0, "fixture: Rune Flash must cost something with one Runechant");
  assert.equal(n.sides[0].res, 9 - price, "charged exactly the price it was played at");
});

test("a Runechant destroyed while it waits does not charge it again", {skip}, () => {
  const {n, price} = run(2, 1, 1);
  assert.equal(price, 1, "fixture: Rune Flash costs 1 with two Runechants");
  assert.equal(n.sides[0].res, 0, "paid the 1 it was played at, never owed a second");
  assert.ok(!INV.errors(n).some(e => e.code === "NEGATIVE-RES"), "NEGATIVE-RES");
});

test("nothing changed in the window: the price is the board's, as before", {skip}, () => {
  const {n, price} = run(1, 1, 9);
  assert.equal(n.sides[0].res, 9 - price);
});

test("the declaration does not outlive the resolution", {skip}, () => {
  const {n} = run(1, 2, 9);
  assert.equal(n._heldPrice, undefined, "_heldPrice must not ride on the state after the play resolves");
});
