/* ============================================================
   test/tapcount.test.js — A TAP, NOT THE WORD "tap" (v4.46)

   THREE FINDINGS, ONE THREAD, AND THEY ARRIVED IN THIS ORDER — which is
   the argument for the middle one:

   1. THE COUNTER MEASURED THE OPPOSITE OF ITS FEATURE.
      `tools/selfplay.js` read `/tapped|taps/i` over the feed. Measured
      over 15 driven games: **335 firings, every single one "(d) <name>
      untaps."** — the end-phase step that announces itself unconditionally
      every turn, in which "un-TAPS" contains "taps". Not one was a tap.
      v3.81 records a counter that spelled the wrong word and reported
      zero; this is that defect with the sign flipped, in the block where a
      number means a FEATURE FIRED (v4.17).

   2. THE TAP WAS CHARGED IN SILENCE.
      Aimed properly there was nothing to aim at: **zero** feed lines in 15
      games mentioned a tap other than that announcement, while
      `heroTapped` was true across **83 states of one Bravo game**. The
      only line the whole mechanic produced was the REFUSAL ("<name> is
      already tapped"), so a player learned their hero was tapped by being
      refused a play. In a training sim the feed IS the lesson (v3.60), and
      `heroTapped` is a STATE only the controller's own untap step lifts
      (CR 4.4.3d) — a cost still being paid on the opponent's turn.

   3. AND ANNOUNCING IT EXPOSED A RULES DEFECT INSIDE A MINUTE.
      `from === "hero"` is not "the hero acted": `judge.js` calls it "THE
      ABILITY ROUTE (v3.04)" and commits every non-weapon EQUIPMENT ability
      down it. So the branch fired for a Compass of Sunken Depths and then
      asked whether the HERO's line prints `{t}`. Measured, **35 of 41 hero
      taps were an equipment ability tapping the hero for a cost it never
      printed** — and since `heroTapped` blocks a later `{t}` (v3.48's
      ruling), Gravy Bones activating a Compass locked himself out of his
      own hero ability for the turn. WEAKER than printed, so the one-sided
      fairness sweep is blind, and the clause was READ throughout, so
      coverage is blind too.

   That is the whole case for making a mechanic legible before trusting it.
   ============================================================ */
const {test} = require("node:test");
const assert = require("node:assert");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const SP = require("../tools/selfplay.js");

/* The engine's own lines, verbatim from a driven game. */
const TAPPED = "Bravo — hero power: Bravo, Flattering Showman taps to pay — "
             + "tapped until their own untap step (CR 4.4.3d).";
const UNTAP  = "(d) Bravo, Flattering Showman untaps.";
const POWER  = "Kayo tapped to power Turn to Mindfire — the rider resolves.";

/* Asked of the SOURCE's own pattern rather than restated, or this drill is
   a second copy of the thing it checks (v4.25). */
const tapPattern = () => {
  const src = require("fs").readFileSync(require.resolve("../tools/selfplay.js"), "utf8");
  const m = src.match(/if\((\/[^\n]*?\/)[\s\n]*\.?test\(line\)\)[\s\n]*events\.push\(\["tap"/)
         || src.match(/if\((\/[^\n]*?\/)\.test\(line\)\)[\s\n]*\n?\s*events\.push\(\["tap"/);
  assert.ok(m, "no pattern found for the tap counter — scan aimed wrong");
  return eval(m[1]);
};

test("the tap counter spells the engine's own tap lines", () => {
  const rx = tapPattern();
  assert.ok(rx.test(TAPPED), "the activation route's line must count");
  assert.ok(rx.test(POWER),  "the pay sheet's line is the same event by another route");
});

/* BOTH HALVES (v3.98) — a pattern that counts nothing passes the refusal
   below perfectly, so the positive above is what makes this mean anything. */
test("the end-phase UNTAP announcement is not counted", () => {
  assert.ok(!tapPattern().test(UNTAP),
    '"un-taps" contains "taps" — that is the whole original defect');
});

/* ---- THE RULES HALF, DRIVEN ----------------------------------------- */

const gate = () => {
  const src = require("fs").readFileSync(require.resolve("../engine/effects.js"), "utf8");
  return src;
};

test("only the hero's OWN powCard taps the hero", () => {
  const src = gate();
  assert.match(src, /from==="hero"\s*&&\s*card\.uid === "hpow"/,
    "the route name is shared with every equipment ability — the card is the discriminator");
});

/* AND THE PREMISE THE GATE RESTS ON IS MEASURED, not assumed: `hpow` is
   `build.js`'s own name for the hero powCard, and an equipment ability's
   is "gp"+uid. If build ever renames one the gate silently stops firing. */
test("build names the hero powCard hpow, and gear abilities gp+uid", () => {
  const b = require("fs").readFileSync(require.resolve("../engine/build.js"), "utf8");
  assert.match(b, /uid:\s*"hpow"/, "the hero powCard's uid is what the gate reads");
  assert.match(b, /"gp"\s*\+/, "and a gear ability's is a different namespace");
});

/* THE THREE HEROES ARE A MEASUREMENT (v3.48's own count), so the day a
   fourth prints a tap somebody decides rather than it arriving silently. */
test("exactly three pool heroes print a {t} activation cost", () => {
  if(!H.hasDb()) return;
  const B = require("../engine/build.js"), G = require("../engine/game.js");
  const RNG = require("../engine/rng.js"), DB = H.db();
  const tapping = SP.W.HEROES.filter(h => {
    const ctr = {n: 0};
    const b = B.buildSideDefault(h, G.parseDeck(SP.W.DECKS[h.k]), DB, RNG.make("t"), ctr);
    return P.tapsToActivate((b.b.heroRec || {}).tx || "");
  }).map(h => h.n).sort();
  assert.deepEqual(tapping,
    ["Bravo, Flattering Showman", "Gravy Bones", "Lyath Goldmane"]);
});

/* DRIVEN, AND IT IS THE REGRESSION. A Gravy Bones game activates his
   Compass repeatedly; before the gate, every one of those tapped him. */
test("driven: an equipment ability never taps the hero", () => {
  if(!H.hasDb()) return;
  const r = SP.play(SP.match("gravy", "bravo", "tapprobe:gravy", 0), 4000, {});
  const lines = (r.game.feed || []).filter(l => /taps to pay — tapped until/.test(l));
  assert.ok(lines.length > 0, "fixture must actually tap a hero at least once");
  /* THE PREFIX IS THE CARD, NOT THE SEAT — and checking the wrong half is
     how the first draft of this drill failed against a correct engine
     (v4.09's "check your own fixture"). `build.js` names a hero powCard
     "<short hero name> — hero power" and an equipment ability
     "<piece> — ability" (v4.38), so the card prefix is the discriminator
     and the seat name after it is a different string: "Bravo — hero power:
     Bravo, Flattering Showman taps to pay". */
  for(const l of lines){
    assert.match(l, /^[^:]+ — hero power:/,
      `an equipment ability tapped the hero: ${l}`);
    assert.ok(!/ — ability:/.test(l.split(":")[0] + ":"),
      `that is a gear ability, not a hero power: ${l}`);
  }
});

/* AND THE ANNOUNCEMENT NAMES THE SEAT WITH AN AGREEING VERB (v2.83, v4.15).
   Seat 0 called "You" must read "You tap"; a hero must read "<name> taps". */
test("the tap line names the seat and the verb agrees", () => {
  const src = gate();
  assert.match(src, /sv\(act\(n\), "tap"\)/,
    "sv reads the side, so \"You tap\" and \"Bravo taps\" both come out right");
  assert.ok(!/\$\{act\(n\)\.name\} taps/.test(src),
    "a hand-built third person reads \"You taps\" on the board a player uses");
});
