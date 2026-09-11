/* ============================================================
   test/tournament.test.js — THE BRACKET'S OWN RULES

   `tools/tournament.js` is an INSTRUMENT, like `tools/selfplay.js`: it
   asserts nothing and it reports. What is drilled here is the handful of
   pure rules the event runs ON — the bracket, the chairs and the score —
   because each one is a place where a silent mistake produces a plausible
   champion. A bracket that drops a seed still crowns somebody; a coin that
   only lands one way still seats a decider; a tiebreak that reads the
   wrong chair's life still names a winner.

   THE GAMES ARE NOT DRIVEN HERE. `npm test` must stay fast and these
   rules are pure, so they are driven with synthetic legs — the games are
   the instrument's job, and its judges are what watch them.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const T = require("../tools/tournament.js");

/* ---- the bracket ----------------------------------------------------- */

/* A CENSUS THAT CANNOT PASS BY FINDING NOTHING (v2.47, v4.17). The order
   is DERIVED rather than typed precisely so a dropped number is possible,
   and a bracket missing a seed still produces a champion — it just
   produces the wrong one, silently, with the right number of rounds. */
test("the bracket order is a PARTITION of the field", () => {
  for(const n of [2, 4, 8, 16, 32]){
    const o = T.bracketOrder(n);
    assert.equal(o.length, n, `bracket of ${n} has ${o.length} slots`);
    assert.deepEqual([...o].sort((a, b) => a - b),
                     Array.from({length: n}, (_, i) => i + 1),
                     `bracket of ${n} is not a permutation of 1..${n}`);
  }
});

test("every first-round pair sums to n+1 — 1 meets 16, 2 meets 15", () => {
  const o = T.bracketOrder(16);
  for(let i = 0; i < o.length; i += 2)
    assert.equal(o[i] + o[i + 1], 17,
      `seeds ${o[i]} and ${o[i + 1]} met in round one`);
});

/* THE WHOLE POINT OF SEEDING. If 1 and 2 share a half they meet in a
   semi-final and the qualifier bought nothing. */
test("the top two seeds are in opposite halves and can only meet in the final", () => {
  const o = T.bracketOrder(16);
  const half = s => o.indexOf(s) < o.length / 2 ? "top" : "bottom";
  assert.notEqual(half(1), half(2));
  /* and one rung in: 1 and 4 share a half, 1 and 3 do not — the standard
     shape, stated so a "fix" to the recursion fails here. */
  assert.equal(half(1), half(4));
  assert.notEqual(half(1), half(3));
});

/* ---- the chairs ------------------------------------------------------ */

/* THE CHAIRS ALTERNATE ACROSS THE WHOLE TIE, not just the first two
   legs. Over a best-of-seven a rule that swapped once would hand five of
   the seven chairs to one entrant, and the chair is worth about 2:1 in a
   close matchup here (measured: Dorinthea beats Arakni 24 times with it
   and 12 without, over 80 games). */
test("the chairs alternate, leg by leg, for the whole tie", () => {
  const got = [0,1,2,3,4,5,6].map(i => T.chairOf(i).firstIsHi);
  assert.deepEqual(got, [true, false, true, false, true, false, true]);
});

/* THE ODD CHAIR IS THE HIGHER SEED'S, AND THAT IS WHAT THE QUALIFIER
   BOUGHT. It is deliberately NOT a coin: handing a decider worth 2:1 to
   a random draw puts back exactly the variance the longer formats exist
   to remove. A drill says so, so making it random again is a decision. */
test("an odd format gives the spare chair to the higher seed", () => {
  for(const bestOf of [3, 5, 7]){
    const chairs = Array.from({length: bestOf}, (_, i) => T.chairOf(i).firstIsHi);
    const hi = chairs.filter(Boolean).length;
    assert.equal(hi, Math.ceil(bestOf / 2),
      `best of ${bestOf}: the higher seed should hold ${Math.ceil(bestOf / 2)} chairs, held ${hi}`);
    assert.ok(hi > bestOf - hi, "the spare chair went to the lower seed");
  }
});

/* AND THE WHOLE EVENT IS A PURE FUNCTION of the card database and its own
   name: every game seed is derived from it and nothing draws from a
   random stream. `chairOf` taking an rng at all would reintroduce that. */
test("chairOf is pure — the event consumes no randomness of its own", () => {
  assert.equal(T.chairOf.length, 1, "chairOf grew an argument; is it an rng?");
  assert.deepEqual(T.chairOf(3), T.chairOf(3));
  assert.equal(/RNG\./.test(T.chairOf.toString()), false,
    "chairOf reached for the random stream");
});

/* ---- the score ------------------------------------------------------- */

const HI = {name: "Hi"}, LO = {name: "Lo"};
/* A leg as the event records it: who won, which chair the higher seed
   had, and the two life totals INDEXED BY CHAIR. */
const L = (winner, hi, hp) => ({winner, hi, hp});

test("two legs to one entrant settles the tie", () => {
  const s = T.settle([L(HI, 0, [7, 0]), L(HI, 1, [0, 5])], HI, LO);
  assert.equal(s.win, HI); assert.equal(s.out, LO);
  assert.deepEqual([s.a, s.b], [2, 0]);
  assert.equal(s.by, "legs");
});

test("a drawn leg is half a leg each — CR 4.5.3 has no deck-out loss", () => {
  const s = T.settle([L(null, 0, [4, 6]), L(HI, 1, [0, 9])], HI, LO);
  assert.deepEqual([s.a, s.b], [1.5, 0.5]);
  assert.equal(s.win, HI);
  assert.equal(s.by, "legs");
});

test("level after three legs is decided on life, and the report SAYS so", () => {
  /* 1-1 with a draw: a = b = 1.5. */
  const legs = [L(HI, 0, [9, 0]), L(LO, 1, [0, 3]), L(null, 0, [6, 2])];
  const s = T.settle(legs, HI, LO);
  assert.deepEqual([s.a, s.b], [1.5, 1.5]);
  assert.equal(s.by, "life",
    "a tiebreak the tournament invents must be named, never folded into the leg score");
  /* HI had the chair in legs 1 and 3 (seat 0) and seat 1 in leg 2:
     9 + 3 + 6 = 18 against 0 + 0 + 2 = 2. */
  assert.deepEqual(s.life, [18, 2]);
  assert.equal(s.win, HI);
});

/* THE BITER. `hp` is indexed by CHAIR and the chairs SWAP between legs,
   so a tiebreak that reads a fixed index reads the opponent's life on
   half the legs — and still names a winner, confidently. The fixture is
   built so the two readings disagree: read correctly HI wins on life,
   read by a fixed index LO does. */
test("the life tiebreak reads each leg's OWN chair, not a fixed index", () => {
  const legs = [L(HI, 0, [8, 1]), L(LO, 1, [1, 2])];   /* 1-1 */
  const s = T.settle(legs, HI, LO);
  assert.deepEqual([s.a, s.b], [1, 1]);
  assert.deepEqual(s.life, [8 + 2, 1 + 1], "HI is seat 0 in leg 1 and seat 1 in leg 2");
  assert.equal(s.win, HI);
  /* the fixed-index reading would be [8+1, 1+2] = [9, 3] — same winner,
     different numbers — so the assertion is on the LIFE, not the winner:
     a drill that only asked who won could not tell the two apart. */
});

/* ---- the field ------------------------------------------------------- */

test("the field is sixteen, and the sixteenth is the dummy", () => {
  assert.equal(T.ENTRANTS.length, 16, "a bracket of sixteen needs sixteen entrants");
  assert.equal(T.ENTRANTS.filter(e => e.key == null).length, 1,
    "exactly one seat is the vanilla pile — the 2026-08-16 ruling allows no other filler");
  assert.equal(new Set(T.ENTRANTS.map(e => e.name)).size, 16, "two entrants share a name");
});

/* THE TOURNAMENT'S RULING, PINNED. `build.buildVanilla` defaults the
   dummy to 42 life and its own header calls that "a training prop's
   number, not a rule". A competitor on double everybody else's life is
   not in the same event, so it enters at 20 — and that is a decision
   somebody made, which means changing it back should be a deliberate
   edit rather than a default drifting in. */
test("the dummy enters at 20 life, not the trainer's 42", () => {
  assert.equal(T.DUMMY.hp, 20);
});

/* ---- the format ------------------------------------------------------ */

/* THE NUMBER OF LEGS THAT WINS A TIE. It has its own name because a
   literal at the call site is a rule nothing can reach: sabotaged to a
   flat `2` it was SILENT against every drill in this file (v4.05). */
test("a tie is won by a majority of its legs", () => {
  assert.deepEqual([3, 5, 7].map(T.winsNeeded), [2, 3, 4]);
  assert.equal(T.winsNeeded(undefined), 2, "the default format is best of three");
});

/* EVERY FORMAT IS ODD, and the final is the longest. An even length can
   end level on legs, and a trophy handed over by the tournament's own
   life tiebreak is a worse answer than playing one more game. */
test("the format escalates and every round is an odd number of legs", () => {
  const lens = T.ROUNDS.map(r => r[1]).concat([T.THIRD_PLACE_BEST_OF]);
  for(const n of lens) assert.equal(n % 2, 1, `a best-of-${n} tie can end level`);
  const rounds = T.ROUNDS.map(r => r[1]);
  for(let i = 1; i < rounds.length; i++)
    assert.ok(rounds[i] >= rounds[i - 1], "the format got SHORTER as the stakes rose");
  assert.ok(rounds[rounds.length - 1] > rounds[0],
    "the final is no longer than the first round — the escalation is decoration");
  assert.deepEqual(T.ROUNDS.map(r => r[0]),
    ["ROUND OF 16", "QUARTER-FINALS", "SEMI-FINALS", "FINAL"]);
});
