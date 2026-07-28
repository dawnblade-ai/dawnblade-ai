/* ============================================================
   Dawnblade engine — rng.js

   A SEEDED, PURE, SERIALIZABLE random source.

   ROADMAP-MULTIPLAYER.md, Phase A step 2. The roadmap is blunt about why
   this is worth thirty lines: "Do not skip the seed. It is thirty lines
   and it unlocks replay, drills for `Battle`, and lockstep all at once."

   Three payoffs, and only one of them is netcode:

     1. REPLAY.   A game is its seed plus its action log. Same seed, same
                  shuffle, same d6, same everything.
     2. DRILLS.   `Battle` is ~1500 lines of reducer that no test covers,
                  because you cannot assert on a shuffled deck. With a
                  pinned seed you can.
     3. LOCKSTEP. Two clients must derive the SAME shuffle from the SAME
                  seed or the boards diverge on turn one.

   THE DISCIPLINE: every function is pure and returns a NEW rng alongside
   its value. Nothing here mutates, and nothing here calls Math.random.
   That is what makes a game replayable — an implicit global source is
   exactly what you cannot replay.

       const {rng, v} = DawnRNG.roll(game.rng, 6);
       n.rng = rng;            // ALWAYS store the returned rng back

   Forgetting to store it back means the next draw repeats the last one.
   `n` (the draw counter) exists to make that visible: it only ever goes
   up, so a stalled `n` in two states that should differ is the tell. It
   doubles as a cheap desync canary for Phase B — two peers at the same
   action with different `n` have already diverged.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnRNG = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* mulberry32 — one multiply-shift round. Chosen because it is exact in
   32-bit integer JS on every engine (Math.imul), needs no BigInt, and is
   short enough to audit by eye. Quality is far beyond what a card game
   needs; determinism is the actual requirement. */
function step(s){
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return {s, v: ((t ^ (t >>> 14)) >>> 0) / 4294967296};
}

/* FNV-1a over a string, so a room code or a date can become a seed.
   Numbers pass through as themselves. Phase B wants both peers to derive
   the same seed from the same room code without exchanging it. */
function seedFrom(x){
  if(typeof x === "number" && isFinite(x)) return x >>> 0;
  const str = String(x == null ? "" : x);
  let h = 0x811c9dc5;
  for(let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* `seed` is the immutable original — the replay key, and what a bug
   report has to carry. `s` is the live position, `n` the draw count. */
function make(seed){
  const sd = seedFrom(seed == null ? Date.now() : seed);
  return {seed: sd, s: sd, n: 0};
}

/* A game reloaded from a report resumes exactly where it left off. */
function restore(o){
  if(!o || typeof o !== "object") return make(0);
  const sd = seedFrom(o.seed == null ? 0 : o.seed);
  return {seed: sd, s: (o.s == null ? sd : o.s|0), n: o.n|0};
}

/* v in [0,1). The primitive everything else is built from. */
function next(rng){
  const r = rng || make(0);
  const {s, v} = step(r.s|0);
  return {rng: {seed: r.seed, s, n: (r.n|0) + 1}, v};
}

/* 0 .. max-1. max <= 0 yields 0 and still burns a draw, so that a guard
   like `if(!hand.length)` upstream cannot desync two peers by making one
   of them skip a draw the other took. */
function int(rng, max){
  const {rng: r2, v} = next(rng);
  const m = Math.floor(max);
  return {rng: r2, v: m > 0 ? Math.floor(v * m) : 0};
}

/* 1 .. sides — a die, not an index. Knucklehead's d6 wants this. */
function roll(rng, sides){
  const {rng: r2, v} = int(rng, sides);
  return {rng: r2, v: v + 1};
}

/* Pick one element; returns the index too, because callers usually need
   to remove it from the zone it came from. */
function pick(rng, arr){
  const list = arr || [];
  const {rng: r2, v: i} = int(rng, list.length);
  return {rng: r2, i: list.length ? i : -1, v: list.length ? list[i] : undefined};
}

/* Fisher-Yates, top-down, one draw per swap. Deterministic for a given
   rng, and it never mutates the input array. */
function shuffle(rng, arr){
  const x = (arr || []).slice();
  let r = rng;
  for(let i = x.length - 1; i > 0; i--){
    const out = int(r, i + 1);
    r = out.rng;
    const j = out.v;
    const t = x[i]; x[i] = x[j]; x[j] = t;
  }
  return {rng: r, arr: x};
}

return {step, seedFrom, make, restore, next, int, roll, pick, shuffle};
});
