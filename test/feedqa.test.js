/* ============================================================
   FEED TEXT FROM THE v5.85 QA SWEEP (v5.9x)

   The feed line IS the observable in every drill here: each one is a
   fault in what the player READS, not in state. Each is sabotaged below
   by asserting the old wording is absent AND a control case still prints.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers/judged.js");
const skip = !H.hasDb() && "no cached card database";
const feedOf = g => (g.feed || []).map(l => typeof l === "string" ? l : (l.t || l.text || JSON.stringify(l)));

test("a standing-fact noop prints nothing; an honest gap still prints (FEED-2)", {skip}, () => {
  const g = H.state({}, {});
  const quiet = H.runOps(g, [["noop", "printed keyword — applied by the rules when the card is used"]], "Zipper Hit");
  assert.deepEqual(feedOf(quiet), []);
  const loud = H.runOps(g, [["noop", "playable this turn — the flag is set when the card is created"]], "Zipper Hit");
  assert.equal(feedOf(loud).length, 1, "control: a noop that is a real gap still speaks");
  assert.ok(!/engine/i.test(feedOf(loud).join()));
});

test("a Next-attack rider says 'an Inertia', not 'a Inertia' (qa-b FEED-5)", {skip}, () => {
  const g = H.state({hand: []}, {});
  const c = H.card("Lace with Inertia", 1) || H.card("Lace with Inertia", 0);
  const out = H.execute(g, c, "hand", 0, {});
  const f = feedOf(out).join(" | ");
  assert.ok(/create an Inertia token/.test(f), f);
  assert.ok(!/\ba Inertia\b/.test(f), f);
});

test("the pitch line separates cards with 'and', so a comma in a name is not a list (qa-b FEED-3)", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(src, /"Pitched " \+ pitched\.map\(c => c\.name\)\.join\(" and "\)/);
});
