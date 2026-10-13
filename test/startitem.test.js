/* ============================================================
   DASH'S PREGAME ITEM ENTERS LIKE ANY PERMANENT (v5.13)

   > "You may start the game with a Mechanologist item with cost 2 or less
   > in the arena." — DASH
   > "This enters the arena with 3 steam counters. … Once per turn, when you
   > boost a card, remove a steam counter from this and gain {r}." — HYPER
   > DRIVER · "Crank … This enters the arena with a steam counter. At the
   > start of your turn, destroy this unless you remove a steam counter
   > from it." — BOOM GRENADE

   `build.js` placed the item as a bare board entry, so it carried no
   counters and no schedule: a starting Hyper Driver paid no {r} on a boost
   (WEAKER), and a starting Boom Grenade was never swept at Dash's turn
   start (its printed drawback skipped — STRONGER). A card played from hand
   gets both through `execute`, a token through the mint; the pregame
   placement got neither (QUEUE item 2). `effects.placeStartItem` is the one
   body, and both boards place through it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const H = require("./helpers/judged.js");
const E = require("../engine/effects.js");
const SP = require("../tools/selfplay.js");

const skip = !H.hasDb() && "no cached card database";

/* Real matches, real builds: the shuffle decides WHICH item Dash starts
   with, so the seeds are the fixture. Measured: s1 deals a Hyper Driver,
   s2 a Boom Grenade. */
const opening = seed => SP.match("dash", "lyath", seed, 0);
const startEntry = g => g.sides[0].board[0];

test("a starting Hyper Driver enters with its three steam counters", {skip}, () => {
  const g = opening("s1"), b = startEntry(g);
  assert.equal(b && b.card.name, "Hyper Driver", "fixture: seed s1 must deal the Driver");
  assert.deepEqual(g.sides[0].counters[b.uid], {steam: 3},
    "the Driver entered with no counters — every boost would pay nothing");
  assert.equal(b.sd, null, "it prints no destroy schedule of its own");
});

test("a starting Boom Grenade enters with its counter AND its clock", {skip}, () => {
  const g = opening("s2"), b = startEntry(g);
  assert.equal(b && b.card.name, "Boom Grenade", "fixture: seed s2 must deal the Grenade");
  assert.deepEqual(g.sides[0].counters[b.uid], {steam: 1});
  assert.equal(b.sd, "turn", "no `sd` stamp — the start-of-turn sweep never looks at it");
});

test("…and the clock RUNS: the first turn start spends the counter, the second destroys it", {skip}, () => {
  /* DRIVEN through the shared start-of-turn sweep both boards call. The
     reprieve is taken without asking (v4.23 — nothing else spends the
     counter), so the Grenade survives one turn start and not two. */
  const g = opening("s2"), uid = startEntry(g).uid;
  const one = E.sweepArena(g, 0, "turn").game;
  assert.ok(one.sides[0].board.some(b => b.uid === uid), "the reprieve should spend the counter and keep it");
  assert.equal((one.sides[0].counters[uid] || {}).steam || 0, 0, "and the counter is gone");
  const two = E.sweepArena(one, 0, "turn").game;
  assert.ok(!two.sides[0].board.some(b => b.uid === uid), "with no counter left, the Grenade is destroyed");
  assert.ok(two.sides[0].grave.some(c => c.uid === uid), "…into the graveyard");
});

test("crank is NOT offered before turn one (a ruling this repo cannot source)", {skip}, () => {
  /* `start-item-crank-unasked`. The placement queues nothing; the record's
     probe asserts the same deviation from the other file. */
  const g = opening("s2");
  assert.ok(!g.prompt && !(g.promptQ || []).length, "a sheet opened before the first turn");
});

test("the trainer places its items through the same body (both seats)", () => {
  /* The trainer's opening state is a React closure, so this is a SOURCE
     scan, with its reach stated: it proves the call is there, the driven
     rows above prove what the body does. A bare `board:built.startItem`
     would be the bug coming back. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.equal((html.match(/DawnEffects\.placeStartItem\(makeSide\(/g) || []).length, 2,
    "both trainer seats must place through `placeStartItem`");
  /* AND EACH HANDS IN ITS OWN SEAT'S ITEM. Counting the calls alone passes
     a call handed `null` (the first sabotage of this drill was silent). */
  assert.match(html, /\}\), built\.startItem\), DawnEffects\.placeStartItem\(makeSide\(/,
    "seat 0 must hand in its own start item");
  assert.match(html, /\}\), built\.both\[1\]\.startItem\)\]/, "seat 1 must hand in its own start item");
  assert.doesNotMatch(html, /board:\s*built(?:\.both\[1\])?\.startItem/,
    "a bare start-item board entry is back in the trainer");
});
