/* ============================================================
   A FAULT IS NOT A ROUTE, AND `npm run play` REPORTED ONE AS ONE.

   `tools/tourney.js` prints two things a reader is told to act on: a
   SUMMARY LINE of faults, and a ROUTE COVERAGE block counting how often
   each new route fired. The two mean opposite things — a number under
   "times a feed line matched" says a FEATURE FIRED; a fault count says
   something is WRONG — and the split between them was a hardcoded list
   of one name.

   v4.03 already fixed the other half of exactly this: the ROUTE list was
   made DERIVED after `reaction` and `layer` were counted in
   `selfplay.js`, named nowhere in the report, and printed NOTHING. The
   exclusion beside it stayed typed, so when v4.15 added a second fault
   (`SECOND-PERSON`) it landed in the route block.

   DRIVEN AGAINST A SABOTAGED `svName` — every seat-0 feed line reading
   "You soaks", "You controls" — the report said:

     POLICY REFUSALS 0 · INVARIANT VIOLATIONS 0 · MALFORMED FEED 0
     ROUTE COVERAGE (times a feed line matched):
       SECOND-PERSON 78

   Three zeroes on the line a reader reads, and the fault sorted to the
   TOP of the features-working list. That is v3.81 with the sign flipped:
   there a fault counter spelled the wrong word and reported zero; here it
   reports a real number in the column that means the opposite.

   THE TWO DECISIONS ARE DRIVEN HERE, NOT GREPPED. They print inline in
   the report, and a source slice rots where a rule moves (v3.22, v3.28,
   v3.94) — so they were named and moved beside the census they read, and
   these drills call them with synthetic counts.

   AND BOTH HALVES ARE ASKED. A check that only ever sees a fault at ZERO
   passes vacuously (v3.98: ask for the refusal) — every fault below is
   driven PRESENT and non-empty, and the route half is the positive
   control, because an exclusion that refuses everything satisfies the
   fault half perfectly.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const SP = require("../tools/selfplay.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "tools", "selfplay.js"), "utf8");

/* The kinds `play()` can actually emit, read off its own pushes. Proved
   ALIVE by its count before anything is concluded from its gaps (v4.00) —
   a scan aimed at the wrong shape passes by finding nothing. */
const EMITTED = [...new Set(
  [...SRC.matchAll(/events\.push\(\["([A-Z-]+|[a-z]+)"/g)].map(m => m[1])
)].sort();

test("the emitted-kind scan is alive", () => {
  assert.ok(EMITTED.length >= 9, `scan found ${EMITTED.length} kinds — aimed wrong`);
});

/* PINNED AS A SET (wire.test.js's HEADLESS, condcensus.test.js). A new
   counter fails here, and the edit that fixes it is the moment somebody
   says which half it belongs to — which is the only thing that can decide
   it, since no scan can tell a fault from a route. */
test("every event kind selfplay emits is pinned", () => {
  assert.deepEqual(EMITTED, [
    "MALFORMED", "SECOND-PERSON",
    "ally", "crush", "death", "destroycost", "fusion", "gold", "hitnext", "hitwatch",
    "jab", "layer", "leave", "reaction", "tap", "ward",
  ]);
});

/* A FAULT NAMED BUT NEVER EMITTED REPORTS ZERO FOREVER — v3.81's defect,
   in the list rather than in the regex. */
test("every name in FAULTS is a kind selfplay actually emits", () => {
  for(const f of SP.FAULTS)
    assert.ok(EMITTED.includes(f), `FAULTS names ${f}, which nothing emits`);
});

/* AND THE SPLIT IS PINNED AS A PARTITION, both sides.

   Pinning the faults alone cannot see a name LEAVING the list: every
   drill below builds its fixture FROM `SP.FAULTS`, so a shrunken census
   is one the drills stop asking about — which is the defect this file
   exists for, wearing the drill's own clothes. Pinning the ROUTES too is
   what makes a removal fail, because the name has to land somewhere.

   WHICH SIDE A KIND BELONGS ON IS A JUDGEMENT and no scan can make it, so
   this is a pin rather than a derivation: moving a name is a deliberate
   edit here, which is the moment somebody states what the counter means. */
const FAULTS_PINNED = ["MALFORMED", "SECOND-PERSON"];
/* `destroycost` is a ROUTE (v4.37): a number there means the offer was
   MADE and answered. It counts BOTH outcomes deliberately, because the
   seat declines by standing rule (v4.24) and a counter narrowed to the
   accept half would print a 0 that is about the POLICY (v4.29). */
/* `hitnext` is a ROUTE (v4.41) and it reads ZERO on the ladder, which is a
   fact about this POLICY and not about the route — Burn Up is always
   reached at INSTANT speed where only its Shock half is legal, and
   Banneret's charge is offered 14 times and declined 14 by v4.33's
   standing rule. A route counter at 0 is still a route counter: `destroycost`
   above makes the same argument from the other end, and the drills and two
   scenes are what cover this one. */
const ROUTES_PINNED = ["ally", "crush", "death", "destroycost", "fusion", "gold",
                       "hitnext", "hitwatch", "jab", "layer", "leave", "reaction",
                       "tap", "ward"];

test("faults and routes partition the emitted kinds", () => {
  assert.deepEqual([...SP.FAULTS].sort(), FAULTS_PINNED);
  assert.deepEqual(SP.routeNames(Object.fromEntries(EMITTED.map(k => [k, []]))), ROUTES_PINNED);
  assert.deepEqual([...FAULTS_PINNED, ...ROUTES_PINNED].sort(), EMITTED);
});

test("every fault is on the summary line, with its count", () => {
  /* NON-EMPTY, or the assertion cannot tell a reported fault from an
     omitted one — both read "0" nowhere in the string. */
  const faults = Object.fromEntries(SP.FAULTS.map((k, i) => [k, Array(i + 3).fill(k)]));
  const line = SP.summaryLine([1, 2], [3], faults);
  for(const [k, v] of Object.entries(faults))
    assert.ok(line.includes(`${k} ${v.length}`), `summary omits ${k}: ${line}`);
  assert.ok(/REFUSALS 2\b/.test(line) && /VIOLATIONS 1\b/.test(line), line);
});

test("a fault kind is never counted as a route", () => {
  const evts = Object.fromEntries([...SP.FAULTS, "tap", "ally"].map(k => [k, ["x"]]));
  const routes = SP.routeNames(evts);
  for(const f of SP.FAULTS)
    assert.ok(!routes.includes(f), `${f} is reported as a route`);
  /* THE POSITIVE CONTROL. Without it a `routeNames` that returns [] — an
     exclusion refusing everything — passes the half above perfectly, and
     the report loses the route coverage v4.03 built. */
  assert.deepEqual(routes, ["ally", "tap"]);
});

/* THE REPORT MUST STILL BE THE THING THAT READS THEM. Both decisions
   moved out of `tourney.js`; a copy left behind there is the no-mirror
   rule broken between a tool and the census it consumes. */
test("tourney reads the census rather than restating it", () => {
  const t = fs.readFileSync(path.join(__dirname, "..", "tools", "tourney.js"), "utf8");
  assert.ok(/require\("\.\/selfplay\.js"\)[\s\S]{0,80}?/.test(t));
  assert.ok(/summaryLine\(refusals, viols, faults\)/.test(t), "summary line restated");
  assert.ok(/routeNames\(evts\)/.test(t), "route list restated");
  assert.equal((t.match(/"MALFORMED"|'MALFORMED'/g) || []).length, 0,
    "tourney names a fault literally — the list is a census, not a spelling");
});

/* ============================================================
   THE LADDER'S OWN DISPERSION (v4.40)

   `npm run play` has taken a seed count since it was written and POOLED
   the samples into one win figure, so the instrument could take five
   readings of a hero and report their sum with no dispersion anywhere in
   the output. Measured over twelve identical ladders on an UNCHANGED
   engine, a hero's count moves by a median of 6 and has been observed at
   10 — Lyath ran 0 to 8, Dorinthea 19 to 27 — so a version-to-version
   move smaller than that is not resolvable by a single ladder.

   THE ARITHMETIC IS DRIVEN WITH SYNTHETIC COUNTS, not with 630 games:
   v4.17 moved `summaryLine` and `routeNames` out of the report for this
   exact reason — a rule that lives inline in a report is a rule no drill
   can reach, and a source slice rots where it moves.
   ============================================================ */
const TY = require("../tools/tourney.js");

test("seedRows reports the mean and the spread of each hero's samples", () => {
  /* THE NAMES ARE GIVEN IN THE WRONG ORDER ON PURPOSE. Listed as ["a","b"]
     with `a` also winning most, the input order and the sorted order
     coincide and deleting the sort is SILENT — a fixture where two things
     coincide has tested neither (v3.26). `low` is asked for first and must
     come out second. */
  const rows = TY.seedRows([{low: 2, high: 10}, {low: 3, high: 14}, {low: 1, high: 12}],
                           ["low", "high"]);
  assert.deepEqual(rows.map(r => r.k), ["high", "low"], "rows sort by mean, highest first");
  assert.deepEqual(rows[0].v, [10, 14, 12]);
  assert.equal(rows[0].mean, 12);
  assert.equal(rows[0].spread, 4, "spread is max minus min, not a variance");
  assert.equal(rows[1].spread, 2);
});

/* THE LOAD-BEARING HALF. A hero that won NOTHING in one sample has no key
   in that tally, and reading the absence as "no sample" drops exactly the
   reading that makes the band wide — Lyath ran 0 in two of twelve
   ladders, which is half of its own observed spread. */
test("a hero absent from a sample counts as ZERO, never as no sample", () => {
  const rows = TY.seedRows([{x: 8}, {}, {x: 4}], ["x"]);
  assert.deepEqual(rows[0].v, [8, 0, 4], "the empty ladder dropped out of the sample");
  assert.equal(rows[0].spread, 8);
});

/* THE BAND IS THE SPREADS' MEDIAN AND MAX, NEVER THEIR MEAN. Fourteen
   well-behaved heroes and one that swings by 10 is exactly the shape this
   pool produces, and a mean would report that as ~1 — a number that reads
   as "the ladder is precise" while the instrument is not. */
test("the band is the spreads' median and MAX, not their mean", () => {
  const rows = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,10].map((sp, i) => ({k: "h" + i, spread: sp}));
  const b = TY.band(rows);
  assert.equal(b.max, 10, "the widest hero is the band");
  assert.equal(b.median, 0);
  assert.notEqual(b.max, rows.reduce((t, r) => t + r.spread, 0) / rows.length,
    "the band collapsed into an average");
});

test("the band is an observation of the rows in front of it", () => {
  assert.deepEqual(TY.band([]), {min: 0, median: 0, max: 0},
    "an empty sample must answer zeros rather than throw or invent a band");
  const b = TY.band([{spread: 3}, {spread: 1}, {spread: 7}]);
  assert.deepEqual([b.min, b.median, b.max], [1, 3, 7]);
});

/* AND THE REPORT PRINTS A BAND ONLY WHEN IT MEASURED ONE. With a single
   sample there is no dispersion to observe, so the one-sample branch
   quotes the STANDING measurement and says where it came from — quoting
   it as though this run had produced it would be a claim wearing an
   observation's clothes (v4.39, one instrument over). */
test("a band is printed only where it was measured", () => {
  const t = require("fs").readFileSync(require("path").join(__dirname, "..", "tools", "tourney.js"), "utf8");
  assert.ok(/if\(SEEDS > 1\)\{[\s\S]*?NOISE BAND/.test(t),
    "the measured band escaped its SEEDS > 1 guard");
  assert.ok(/ONE SAMPLE PER PAIRING/.test(t), "the single-sample branch says so");
  assert.ok(/UNCHANGED/.test(t), "the standing measurement is not attributed to this run");
});
