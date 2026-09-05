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
  assert.ok(EMITTED.length >= 7, `scan found ${EMITTED.length} kinds — aimed wrong`);
});

/* PINNED AS A SET (wire.test.js's HEADLESS, condcensus.test.js). A new
   counter fails here, and the edit that fixes it is the moment somebody
   says which half it belongs to — which is the only thing that can decide
   it, since no scan can tell a fault from a route. */
test("every event kind selfplay emits is pinned", () => {
  assert.deepEqual(EMITTED, [
    "MALFORMED", "SECOND-PERSON",
    "ally", "crush", "death", "gold", "layer", "reaction", "tap",
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
const ROUTES_PINNED = ["ally", "crush", "death", "gold", "layer", "reaction", "tap"];

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
