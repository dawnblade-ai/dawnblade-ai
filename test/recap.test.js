/* ============================================================
   THE RECAP'S COUNT (v7.09) — what the end screen tells about a game.

   `judge.recapStep` keeps each seat's life lost and gained and its biggest
   single fall, from STATE (never the feed), inside `stalemateCheck`, the one
   function both boards pass every committed state through.

   ASKED BOTH WAYS:
     - by hand: a first look starts the count at zero; a fall adds to `lost`
       and sets `big` with its turn; a smaller fall leaves `big`; a rise adds
       to `gain`; a fall past zero counts only down to zero; an unchanged
       state is returned as it is;
     - over REAL games, both seats on the policy: at every state, each seat's
       life at the first look, less what was lost, plus what was gained, is
       its life now — and the loser's lost covers its whole life. A count that
       missed a fall (the sabotage: drop the `lost` addition) breaks the books
       on the first hit.
   Asserted on life and the count, never on prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const S = require("../tools/selfplay.js");
const J = S.J, SP = S.SP;

const two = (a, b, turn) => ({turn: turn || 1, sides: [{hp: a}, {hp: b}]});
const withHp = (g, a, b, turn) => ({...g, turn: turn || g.turn, sides: [{...g.sides[0], hp: a}, {...g.sides[1], hp: b}]});

test("recap: the count by hand — first look, falls, the biggest one, a rise, past zero", () => {
  let g = J.recapStep(two(20, 20));
  assert.deepStrictEqual(g.recap, {hp: [20, 20], lost: [0, 0], gain: [0, 0], big: [null, null]});
  assert.strictEqual(J.recapStep(g), g, "nothing moved: the same state back");
  g = J.recapStep(withHp(g, 20, 15, 2));
  assert.deepStrictEqual(g.recap.lost, [0, 5]); assert.deepStrictEqual(g.recap.big, [null, {amt: 5, turn: 2}]);
  g = J.recapStep(withHp(g, 17, 12, 3));
  assert.deepStrictEqual(g.recap.lost, [3, 8]);
  assert.deepStrictEqual(g.recap.big, [{amt: 3, turn: 3}, {amt: 5, turn: 2}], "a smaller fall keeps the biggest");
  g = J.recapStep(withHp(g, 19, 12, 4));
  assert.deepStrictEqual(g.recap.gain, [2, 0]);
  g = J.recapStep(withHp(g, 19, -4, 5));
  assert.deepStrictEqual(g.recap.lost, [3, 20], "a fall past zero counts down to zero");
  assert.deepStrictEqual(g.recap.big[1], {amt: 12, turn: 5});
  assert.deepStrictEqual(g.recap.hp, [19, 0]);
});

test("recap: stalemateCheck keeps the count, and counts the blow that ends the game", () => {
  const g = J.stalemateCheck({...two(20, 3), still: null});
  assert.ok(g.recap, "the first committed state starts the count");
  const end = J.stalemateCheck({...withHp(g, 20, 0, 4), over: {winner: 0, how: "life"}});
  assert.deepStrictEqual(end.recap.lost, [0, 3]);
  assert.deepStrictEqual(end.recap.big[1], {amt: 3, turn: 4});
});

function drive(g, seen){
  let n = g;
  for(let i = 0; i < 4000 && !n.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s);
      if(!a) continue;
      const out = J.reduce(n, a, s);
      assert.equal(out.error, null, "the judge refused " + JSON.stringify(a));
      n = out.state; moved = true; seen(n);
      break;
    }
    if(!moved) break;
  }
  return n;
}

for(const [a, b, seed] of [["kayo", "dorinthea", "recap-1"], ["arakni", "azalea", "recap-2"]]){
  test(`recap: the books balance at every state of a real game (${a} v ${b})`, () => {
    let first = null, checks = 0;
    const end = drive(S.match(a, b, seed, 0), n => {
      const r = n.recap; assert.ok(r, "every committed state carries the count");
      if(!first) first = r.hp.slice();
      n.sides.forEach((sd, i) => {
        assert.strictEqual(first[i] - r.lost[i] + r.gain[i], Math.max(0, sd.hp), `seat ${i}: first life - lost + gained = life now`);
        if(r.big[i]) assert.ok(r.big[i].amt > 0 && r.big[i].amt <= r.lost[i] && r.big[i].turn <= n.turn, "the biggest fall is one of the falls");
      });
      checks++;
    });
    assert.ok(end.over && checks > 50, "the game was played out: " + checks + " states");
    const r = end.recap;
    assert.ok(r.lost[0] + r.lost[1] > 0 && (r.big[0] || r.big[1]), "somebody lost life");
    if(end.over.winner === 0 || end.over.winner === 1){
      const l = 1 - end.over.winner;
      assert.strictEqual(r.hp[l], 0, "the loser's life ends at zero");
      assert.strictEqual(r.lost[l], first[l] + r.gain[l], "the loser lost all it had and all it gained");
    }
  });
}
