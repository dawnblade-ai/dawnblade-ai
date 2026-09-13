/* ============================================================
   test/allycount.test.js — AN ALLY EVENT, NOT THE WORD "ally" (v4.46)

   `tools/selfplay.js`'s ally counter read `/ally|allies/i` over the feed.
   Measured over 15 games it fired **350 times**:

     335   "(a) Allies recover."  — the end-phase step that announces
           itself EVERY turn whether or not an ally exists, deliberately
           (judge.js: "a step that announces itself and does nothing is
           worse than one that is missing")
       3   a card NAMED **Rally** the Coast Guard — v2.44's *"Reaction"
           contains "action"* trap, third outing, in an instrument
      12   a real ally reaching the arena
       0   an ally ATTACK — v3.44's whole build, and the route this
           counter's own header says it measures

   95.7% NOISE IS WORSE THAN A ZERO, because the number sits in the block
   where a number means a FEATURE FIRED (v4.17). v3.81 records the same
   defect with the sign flipped: there a counter spelled the wrong word
   and reported nothing.

   WHAT THIS DRILL PINS is the pair of spellings against the ENGINE's own
   (v3.81), in BOTH directions (v3.98): the two event phrases must be
   counted, and the two known non-events must NOT be. Driven, never
   grepped (v3.20) — the fixtures are real games at pinned seeds, which
   works because a driven game is a pure function of the database and its
   seeds (v4.39).
   ============================================================ */
const {test} = require("node:test");
const assert = require("node:assert");
const SP = require("../tools/selfplay.js");

/* The engine's own two lines, quoted verbatim from a driven game. Kept as
   literals so a rewording of either side breaks a test rather than
   silently zeroing a count. */
const DEPLOY = "Swabbie enters play (ally).";
const ATTACK = "Gravy Bones sends Swabbie — 7 power on the chain.";
/* And the two that must NOT count. The first is judge.js:2676, printed
   unconditionally; the second is a real pool card's name. */
const STEP_A = "(a) Allies recover.";
const RALLY  = "Pitched Rally the Coast Guard for 3.";

const kinds = lines => {
  const out = [];
  /* The counter is inside `play`'s loop and cannot be called on a bare
     line, so the phrases are asked of the SOURCE's own patterns — read
     out of the file rather than restated here, or this drill is a second
     copy of the thing it is checking (v4.25). */
  const src = require("fs").readFileSync(require.resolve("../tools/selfplay.js"), "utf8");
  const one = (name) => {
    const m = src.match(new RegExp(
      "if\\((/[^\\n]*?/)\\.test\\(line\\)\\)[\\s\\n]*events\\.push\\(\\[\"" + name + "\""));
    assert.ok(m, `no pattern found for the ${name} counter — scan aimed wrong`);
    return eval(m[1]);
  };
  for(const name of ["ally", "allyatk"])
    for(const l of lines) if(one(name).test(l)) out.push([name, l]);
  return out;
};

test("the ally counters spell the engine's own two phrases", () => {
  const got = kinds([DEPLOY, ATTACK]).map(r => r[0]);
  assert.deepEqual(got.sort(), ["ally", "allyatk"],
    "the deploy line and the attack line must each be counted, once, by their own kind");
});

/* BOTH HALVES, OR THE DRILL PROVES NOTHING (v3.98). A pattern that counts
   nothing satisfies the refusals below perfectly. */
test("the end-phase announcement is counted by NEITHER", () => {
  assert.deepEqual(kinds([STEP_A]), [],
    "(a) Allies recover prints every turn whether or not an ally exists");
});

test("a card NAMED Rally is counted by neither — the word boundary", () => {
  assert.deepEqual(kinds([RALLY]), [],
    '"Rally" contains "ally" — v2.44s trap, and the fix is an EVENT phrase');
});

/* DRIVEN, AND WITH THE NOISE LINE PRESENT IN THE SAME GAME — a fixture in
   which the end-phase step never printed could not tell a narrowed counter
   from a broken one. */
test("driven: both ally routes fire and the noise line is uncounted", () => {
  const r = SP.play(SP.match("gravy", "iyslander", "s:gravy", 1), 4000, {});
  const c = {};
  for(const [k] of r.events) c[k] = (c[k] || 0) + 1;
  const noise = (r.game.feed || []).filter(l => /\(a\) Allies recover/.test(l)).length;
  assert.ok(noise > 0, "fixture must contain the end-phase announcement");
  assert.ok(c.ally    > 0, `an ally reached the arena — counted ${c.ally || 0}`);
  assert.ok(c.allyatk > 0, `an ally attacked — counted ${c.allyatk || 0}`);
  /* The whole point: the counts are the EVENTS, not the noise. */
  assert.ok(c.ally + c.allyatk < noise,
    "the two real counts are smaller than the announcement they used to be buried under");
});
