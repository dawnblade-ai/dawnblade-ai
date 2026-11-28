/* ============================================================
   A LIFE TOTAL IS NEVER NEGATIVE (v7.24, REVIEW-2 #3).

   CR 2.5.3e (verbatim, rules.fabtcg.com): "A living-card cannot have a
   negative life total. If the life total is calculated to be less than zero,
   instead it is considered zero."

   The damage sites subtract freely, so a hero hit for 4 on 3 life ended the
   game at -1 and both phones printed "-1" on the bout bar and the pad.
   `judge.winCheck` — the game-state action that ends the game (CR 2.5.3f,
   4.5.3a) — floors the downed hero at 0. These drills ask the engine: a unit
   position, then real self-played games that END IN OVERKILL (the fixture
   must contain one, or it proves nothing).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

test("winCheck floors the downed hero at 0 and leaves the winner's life alone", {skip}, () => {
  const g = H.state({hp: 7}, {hp: -3}, {turn: 5, actor: 0, turnPlayer: 0});
  const out = H.J.winCheck(g);
  assert.ok(out.over, "the game is over");
  assert.equal(out.over.winner, 0);
  assert.equal(out.over.how, "life");
  assert.equal(out.sides[1].hp, 0, "CR 2.5.3e: considered zero, not -3");
  assert.equal(out.sides[0].hp, 7, "the winner's total is untouched");
});

test("a hero at exactly 0 is down and stays 0; a hero above 0 is not down", {skip}, () => {
  const at0 = H.J.winCheck(H.state({hp: 0}, {hp: 4}, {turn: 5, actor: 1, turnPlayer: 1}));
  assert.equal(at0.over.winner, 1);
  assert.equal(at0.sides[0].hp, 0);
  const alive = H.J.winCheck(H.state({hp: 1}, {hp: 1}, {turn: 5, actor: 0, turnPlayer: 0}));
  assert.ok(!alive.over, "1 life is alive");
});

test("DRIVEN: self-played games that end on life finish with the loser on 0, never below", {skip}, () => {
  /* MEASURED (v7.24): with the floor sabotaged out of winCheck, 9 of these 12 games end below zero (-1 .. -5), so it holds
     overkill; with the floor in, every one reads 0. Sabotage it again if the fixture changes. */
  const SPL = require("../tools/selfplay.js");
  const pairs = [["iyslander", "viserai"], ["kayo", "dash"], ["bravo", "azalea"], ["dorinthea", "fai"]];
  let finished = 0;
  for(const [a, b] of pairs){
    for(const seed of [1, 2, 3]){
      const n = SPL.play(SPL.match(a, b, seed), 4000).game;
      if(!(n && n.over && n.over.how === "life")) continue;
      finished++;
      for(const s of [0, 1]) assert.ok(n.sides[s].hp >= 0, `${a} v ${b} seed ${seed}: seat ${s} ended on ${n.sides[s].hp}`);
      assert.equal(n.sides[1 - n.over.winner].hp, 0, `${a} v ${b} seed ${seed}: the loser reads 0`);
    }
  }
  assert.ok(finished >= 8, "the fixture finished at least eight games on life (" + finished + ")");
});
