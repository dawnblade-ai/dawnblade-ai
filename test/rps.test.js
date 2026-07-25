/* The pregame throw. The rule that matters is the second half of it:
   the winner CHOOSES the seating rather than being handed the first turn. */
const test = require("node:test");
const assert = require("node:assert/strict");
const {RPS_THROWS, rpsResolve, rpsSeries, rpsThrow, rpsSeat} = require("../engine/rps.js");

test("rock-paper-scissors: every pairing resolves the printed way", () => {
  assert.equal(rpsResolve("rock","scissors"), 1);
  assert.equal(rpsResolve("scissors","paper"), 1);
  assert.equal(rpsResolve("paper","rock"), 1);
  assert.equal(rpsResolve("scissors","rock"), -1);
  assert.equal(rpsResolve("paper","scissors"), -1);
  assert.equal(rpsResolve("rock","paper"), -1);
});

test("rock-paper-scissors: same throw is a tie, not a win", () => {
  for(const t of RPS_THROWS) assert.equal(rpsResolve(t,t), 0);
});

test("rock-paper-scissors: a non-throw fails loudly instead of tying", () => {
  assert.equal(rpsResolve("lizard","rock"), null);
  assert.equal(rpsResolve("rock",undefined), null);
});

test("rock-paper-scissors is antisymmetric across the whole table", () => {
  /* summed rather than negated: strict equality separates 0 from -0 */
  for(const a of RPS_THROWS) for(const b of RPS_THROWS)
    assert.equal(rpsResolve(a,b) + rpsResolve(b,a), 0, `${a} vs ${b}`);
});

test("series: ties are replayed, so a level series has no winner yet", () => {
  const s = rpsSeries([["rock","rock"],["paper","paper"]]);
  assert.equal(s.ties, 2);
  assert.equal(s.winner, null);
});

test("series: the first decisive throw settles it", () => {
  const s = rpsSeries([["rock","rock"],["rock","scissors"]]);
  assert.equal(s.a, 1);
  assert.equal(s.b, 0);
  assert.equal(s.ties, 1);
  assert.equal(s.winner, 0);
});

test("series: the opponent can win it", () => {
  assert.equal(rpsSeries([["rock","paper"]]).winner, 1);
});

test("throw: the injected RNG picks deterministically across the table", () => {
  assert.equal(rpsThrow(()=>0), "rock");
  assert.equal(rpsThrow(()=>0.5), "paper");
  assert.equal(rpsThrow(()=>0.99), "scissors");
  /* a degenerate rand() of exactly 1 must not index past the end */
  assert.equal(rpsThrow(()=>1), "scissors");
});

test("seating: the winner CHOOSES — winning does not mean going first", () => {
  assert.equal(rpsSeat(0,"first"), 0);
  assert.equal(rpsSeat(0,"second"), 1);
  assert.equal(rpsSeat(1,"first"), 1);
  assert.equal(rpsSeat(1,"second"), 0);
});

test("seating: an unresolved throw or a junk choice seats nobody", () => {
  assert.equal(rpsSeat(null,"first"), null);
  assert.equal(rpsSeat(0,"maybe"), null);
});
