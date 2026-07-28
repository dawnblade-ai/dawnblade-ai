/* THE SEEDED RNG — ROADMAP-MULTIPLAYER.md Phase A step 2.

   What actually needs proving is not "is it random" (it does not need to
   be good) but "is it REPRODUCIBLE and PURE". Those two properties are
   what buy replay, drills for Battle, and lockstep; randomness quality is
   irrelevant to a card game at this scale. So the drills lean on
   determinism, immutability and distribution-is-not-degenerate, in that
   order of importance. */
const test = require("node:test");
const assert = require("node:assert");
const R = require("../engine/rng.js");

/* ---- determinism: the whole point --------------------------------- */
test("the same seed produces the same sequence", () => {
  const seq = seed => {
    let rng = R.make(seed), out = [];
    for(let i = 0; i < 25; i++){ const r = R.next(rng); rng = r.rng; out.push(r.v); }
    return out;
  };
  assert.deepEqual(seq(12345), seq(12345), "same seed must replay identically");
  assert.notDeepEqual(seq(12345), seq(12346), "different seeds must diverge");
});

test("a shuffle is reproducible from its seed", () => {
  const deck = Array.from({length: 60}, (_, i) => i);
  const a = R.shuffle(R.make("dawnblade"), deck);
  const b = R.shuffle(R.make("dawnblade"), deck);
  assert.deepEqual(a.arr, b.arr, "same seed must deal the same opening deck");
  assert.deepEqual(a.rng, b.rng, "and must leave the rng in the same position");
  const c = R.shuffle(R.make("dawnblade-2"), deck);
  assert.notDeepEqual(a.arr, c.arr, "a different seed must deal a different deck");
});

/* ---- purity: what makes it replayable ----------------------------- */
test("nothing mutates its input", () => {
  const rng = R.make(7);
  const frozen = {...rng};
  const deck = [1,2,3,4,5,6,7,8];
  const before = deck.slice();

  R.next(rng); R.int(rng, 10); R.roll(rng, 6); R.pick(rng, deck);
  const sh = R.shuffle(rng, deck);

  assert.deepEqual(rng, frozen, "the rng passed in must be untouched");
  assert.deepEqual(deck, before, "the array passed in must be untouched");
  assert.notEqual(sh.arr, deck, "shuffle must return a NEW array");
});

test("every draw advances the counter by exactly one", () => {
  let rng = R.make(1);
  assert.equal(rng.n, 0);
  rng = R.next(rng).rng;  assert.equal(rng.n, 1, "next() is one draw");
  rng = R.int(rng, 5).rng; assert.equal(rng.n, 2, "int() is one draw");
  rng = R.roll(rng, 6).rng; assert.equal(rng.n, 3, "roll() is one draw");
  rng = R.pick(rng, [1,2,3]).rng; assert.equal(rng.n, 4, "pick() is one draw");
  /* Fisher-Yates over k elements is exactly k-1 swaps, so k-1 draws. */
  rng = R.shuffle(rng, [1,2,3,4,5]).rng;
  assert.equal(rng.n, 4 + 4, "shuffle of 5 is 4 draws");
});

test("the seed is carried unchanged as the replay key", () => {
  let rng = R.make("room-XYZ");
  const seed = rng.seed;
  for(let i = 0; i < 50; i++) rng = R.next(rng).rng;
  assert.equal(rng.seed, seed, "seed must survive every draw — it is how a game is replayed");
  assert.notEqual(rng.s, seed, "but the live position must have moved");
});

test("restore resumes a game exactly where it stopped", () => {
  let rng = R.make(99);
  for(let i = 0; i < 10; i++) rng = R.next(rng).rng;
  const saved = JSON.parse(JSON.stringify(rng));   // as a bug report would carry it
  const a = [], b = [];
  let x = rng, y = R.restore(saved);
  for(let i = 0; i < 5; i++){ const p = R.next(x), q = R.next(y); x = p.rng; y = q.rng; a.push(p.v); b.push(q.v); }
  assert.deepEqual(b, a, "a restored rng must continue the same sequence");
});

/* ---- ranges: off-by-one here corrupts a game quietly --------------- */
test("int stays in [0,max) and roll in [1,sides]", () => {
  let rng = R.make(4242);
  let loI = 99, hiI = -1, loR = 99, hiR = -1;
  for(let i = 0; i < 4000; i++){
    const a = R.int(rng, 5); rng = a.rng;
    assert.ok(Number.isInteger(a.v) && a.v >= 0 && a.v < 5, "int out of range: " + a.v);
    loI = Math.min(loI, a.v); hiI = Math.max(hiI, a.v);
    const b = R.roll(rng, 6); rng = b.rng;
    assert.ok(Number.isInteger(b.v) && b.v >= 1 && b.v <= 6, "roll out of range: " + b.v);
    loR = Math.min(loR, b.v); hiR = Math.max(hiR, b.v);
  }
  /* both ends must actually occur, or a d6 that never rolls 1 or 6 would
     pass a naive range check while being wrong */
  assert.equal(loI, 0, "int must reach 0"); assert.equal(hiI, 4, "int must reach max-1");
  assert.equal(loR, 1, "a d6 must be able to roll 1"); assert.equal(hiR, 6, "a d6 must be able to roll 6");
});

test("a degenerate draw still burns exactly one draw", () => {
  /* An empty zone must not let one peer skip a draw the other takes —
     that is a desync, and it is invisible until the boards disagree. */
  const rng = R.make(3);
  const e = R.pick(rng, []);
  assert.equal(e.i, -1, "picking from nothing reports no index");
  assert.equal(e.v, undefined);
  assert.equal(e.rng.n, 1, "and still advances the counter");
  assert.equal(R.int(rng, 0).rng.n, 1, "int(0) still advances");
});

/* ---- not degenerate ------------------------------------------------ */
test("the distribution is not obviously broken", () => {
  let rng = R.make(2026);
  const counts = [0,0,0,0,0,0];
  const N = 12000;
  for(let i = 0; i < N; i++){ const r = R.roll(rng, 6); rng = r.rng; counts[r.v-1]++; }
  const expect = N/6;
  for(let f = 0; f < 6; f++)
    assert.ok(Math.abs(counts[f]-expect) < expect*0.15,
      `face ${f+1} came up ${counts[f]} of ${N}, expected ~${expect}`);
});

test("a shuffle actually permutes and loses nothing", () => {
  const deck = Array.from({length: 52}, (_, i) => i);
  const {arr} = R.shuffle(R.make(8), deck);
  assert.equal(arr.length, deck.length, "no card may be lost");
  assert.deepEqual(arr.slice().sort((a,b)=>a-b), deck, "no card may be duplicated or invented");
  assert.notDeepEqual(arr, deck, "a 52-card shuffle that changes nothing is broken");
});

/* ---- it has to live IN the game state ------------------------------
   An rng that sits outside the state cannot be replayed, cannot be put in
   a bug report, and cannot be compared between two peers. These pin that
   it is carried as shared state and survives the sides bridge intact. */
test("makeGame seeds deterministically and carries the rng", () => {
  const S = require("../engine/sides.js");
  const a = S.makeGame({seed: "match-1"});
  const b = S.makeGame({seed: "match-1"});
  assert.ok(a.rng, "a game must open with an rng");
  assert.deepEqual(a.rng, b.rng, "the same seed must open the same game");
  assert.notDeepEqual(a.rng, S.makeGame({seed: "match-2"}).rng, "different seeds must differ");
  assert.equal(a.rng.n, 0, "a fresh game has drawn nothing yet");
});

test("rng is shared game state, never per-side", () => {
  const S = require("../engine/sides.js");
  assert.ok(S.GAME_KEYS.includes("rng"),
    "rng must be in GAME_KEYS or toSides/fromSides drops it and replay dies");
  assert.ok(!S.SIDE_FIELDS.includes("rng"),
    "there is ONE stream for the match — a per-side rng would desync by construction");
});

test("the rng survives the flat <-> sides round trip", () => {
  const S = require("../engine/sides.js");
  let g = S.makeGame({seed: 4242});
  for(let i = 0; i < 7; i++) g = Object.assign({}, g, {rng: R.next(g.rng).rng});
  const back = S.toSides(S.fromSides(g));
  assert.deepEqual(back.rng, g.rng,
    "a round trip must not reset the stream — position AND seed both matter");
  assert.equal(back.rng.n, 7, "the draw count must survive too; it is the desync canary");
});

/* ---- seeding ------------------------------------------------------- */
test("seedFrom is stable and distinguishes inputs", () => {
  assert.equal(R.seedFrom("abc"), R.seedFrom("abc"), "same string, same seed");
  assert.notEqual(R.seedFrom("abc"), R.seedFrom("abd"), "different strings must differ");
  assert.equal(R.seedFrom(123), 123, "a number passes through");
  assert.ok(R.seedFrom("x") >= 0 && R.seedFrom("x") <= 0xFFFFFFFF, "must be uint32");
  /* Phase B: both peers derive the same seed from the room code alone */
  assert.equal(R.make("ROOM-7").seed, R.make("ROOM-7").seed);
});
