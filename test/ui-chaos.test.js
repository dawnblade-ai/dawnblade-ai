/* ui-chaos.test.js — the PURE helpers of tools/ui-chaos.js (the drive itself needs a browser): the seeded rng, the plan (every hero once as
   "you", never against itself), the replay line and the candidate rules (what a thumb may tap, what chaos never does). */
const test = require("node:test");
const assert = require("node:assert/strict");
const X = require("../tools/ui-chaos.js");

test("the rng is seeded: the same seed is the same taps", () => {
  const a = X.rng(7), b = X.rng(7), c = X.rng(8);
  const A = [a(), a(), a()], B = [b(), b(), b()];
  assert.deepEqual(A, B); assert.notDeepEqual(A, [c(), c(), c()]);
  assert.ok(A.every(v => v >= 0 && v < 1));
  assert.equal(X.rng(7)(), 0.011704753153026104, "the generator is mulberry32, so a printed rseed replays on any machine");
});

test("the plan: every hero is 'you' once, never its own foe, seeds distinct and reproducible", () => {
  const keys = ["a", "b", "c", "d", "e", "f", "g"];
  const p = X.plan(keys, {seed: 3});
  assert.deepEqual(p.map(g => g.hero), keys);
  p.forEach(g => assert.notEqual(g.hero, g.foe));
  assert.equal(new Set(p.map(g => g.seed)).size, keys.length); assert.equal(new Set(p.map(g => g.rseed)).size, keys.length);
  assert.deepEqual(X.plan(keys, {seed: 3}), p, "deterministic");
  assert.equal(X.plan(keys, {seed: 3, hero: "c"}).length, 1);
  assert.equal(X.plan(keys, {games: 2}).length, keys.length * 2);
  assert.equal(X.plan(keys, {hero: "c", foe: "c"})[0].foe !== "c", true, "a hero never meets itself");
});

test("the replay line carries the exact URL, the chaos seed and the step", () => {
  const g = {hero: "fai", foe: "briar", seed: 1217, first: 1, rseed: 9};
  assert.equal(X.urlOf(g), "play.html?hero=fai&foe=briar&seed=1217&first=1&pace=0");
  const line = X.replayLine(g, 42);
  assert.ok(line.includes(X.urlOf(g)) && line.includes("--rseed 9") && line.includes("step 42"));
});

test("candidates: only visible, enabled controls; never concede, the report, a link or the classic board", () => {
  const ok = {vis: true, disabled: false, b: "primary", t: "PASS"};
  assert.equal(X.allowed(ok), true);
  assert.equal(X.allowed({...ok, vis: false}), false);
  assert.equal(X.allowed({...ok, disabled: true}), false);
  for(const b of ["row-concede", "concede", "report-send", "row-classic", "row-report", "gear"]) assert.equal(X.allowed({...ok, b}), false, b);
  assert.equal(X.allowed({...ok, b: "", t: "Concede"}), false);
  assert.equal(X.allowed({...ok, href: true}), false);
  /* the choice: coach when nothing is tappable, else a tap from the allowed set, deterministic in the seed */
  assert.deepEqual(X.choose(X.rng(1), [{...ok, disabled: true}]), {coach: true});
  const r1 = X.rng(5), r2 = X.rng(5), cs = [ok, {...ok, b: "hand-0"}, {...ok, b: "row-concede"}];
  assert.deepEqual(X.choose(r1, cs, 0), X.choose(r2, cs, 0));
  for(let i = 0; i < 50; i++){ const c = X.choose(X.rng(i), cs, 0); assert.ok(c.tap && c.tap.b !== "row-concede"); }
  assert.equal(X.stuck(60, 60), true); assert.equal(X.stuck(59, 60), false);
});

test("holds: a hand card must open the inspect panel; mat and chain cards may; buttons are never held", () => {
  const c = b => ({vis: true, disabled: false, b, t: ""});
  for(const b of ["hand-0", "hand-3"]){ assert.equal(X.holdable(c(b)), true, b); assert.equal(X.mustInspect(c(b)), true, b); }
  for(const b of ["you-slot-head", "opp-slot-weapon", "attack"]){ assert.equal(X.holdable(c(b)), true, b); assert.equal(X.mustInspect(c(b)), false, b); }
  for(const b of ["primary", "hub-left", "hub-right", "bout", "you-slot-gy", "row-concede"]) assert.equal(X.holdable(c(b)), false, b);
  assert.equal(X.holdable({...c("hand-0"), disabled: true}), false);
});
