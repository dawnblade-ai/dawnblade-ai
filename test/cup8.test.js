/* ============================================================
   test/cup8.test.js — THE BOOTH IS A READER, NOT AN AUTHOR (v4.46)

   `tools/cup8.js` puts two commentators on seven games, and that is the
   one thing in this project that could go wrong QUIETLY. A commentator
   that narrates reads exactly like one that reports: it is
   `failstates.js` counting a keyword named in a comment (v4.27) wearing a
   headset, and a report is a test with no assertion until somebody checks
   what produced it (v4.25).

   SO THE CONTRACT IS DRILLED RATHER THAN STATED:

     TALLY  may say only what is on the ROW — its feed lines, and life
            totals it can reach by comparing with the row before.
     LEDGER may add a REASON, and only for something the row carries: a
            route it actually fired, its CR step, its own hand size.

   DRIVEN WITH SYNTHETIC ROWS (v3.73), because a real timeline cannot
   express the near-miss — every real row's numbers are consistent with
   the game, so a voice inventing one would be indistinguishable from a
   voice reading one. A row whose life totals are 20-20 and whose lines
   mention no number at all is what tells a reader from an author.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const CUP = require("../tools/cup8.js");

const row = o => ({i: 0, turn: 1, seat: 0, act: "pass", phase: "action",
                   step: "layer", tp: 0, hp: [20, 20], hand: [4, 4],
                   deck: [40, 40], lines: [], routes: [], ...o});
const NAMES = ["Kayo", "Dorinthea"];

/* ---- TALLY ---------------------------------------------------------- */

test("Tally speaks the row's own feed lines", () => {
  const r = row({lines: ["Kayo plays Buckwild — 7 power on the chain."]});
  assert.match(CUP.tally(r, null, NAMES), /Buckwild — 7 power on the chain/);
});

test("Tally reads a life change off the two rows and gets the direction right", () => {
  const prev = row({hp: [20, 20]}), now = row({i: 1, hp: [20, 13]});
  const said = CUP.tally(now, prev, NAMES);
  assert.match(said, /Dorinthea down to 13/);
  assert.ok(!/Kayo down/.test(said), "seat 0 did not move — saying so is an invention");
});

test("Tally says UP for a gain, not down", () => {
  const said = CUP.tally(row({i: 1, hp: [24, 20]}), row({hp: [20, 20]}), NAMES);
  assert.match(said, /Kayo up to 24/);
});

/* THE ONE THAT MATTERS. A silent row carries no number, so a Tally that
   invents one is caught here and nowhere else. */
test("Tally invents no number on a row that carries none", () => {
  const said = CUP.tally(row({act: "pass"}), row({}), NAMES);
  const nums = said.match(/\d+/g) || [];
  assert.deepEqual(nums, [], `spoke a number off a silent row: ${said}`);
  assert.match(said, /Kayo pass/, "and it still says who did what");
});

test("Tally's numbers all come from the row", () => {
  const prev = row({hp: [20, 20]}), now = row({i: 1, hp: [17, 11],
    lines: ["Wounded Bull resolves for 3."]});
  const said = CUP.tally(now, prev, NAMES);
  for(const n of said.match(/\d+/g) || [])
    assert.ok(["3", "17", "11"].includes(n),
      `${n} is on neither row — Tally is narrating`);
});

/* ---- LEDGER --------------------------------------------------------- */

test("Ledger glosses only the routes the row actually fired", () => {
  const said = new Set();
  const got = CUP.ledger(row({routes: ["crush"]}), row({}), NAMES, 0, said);
  assert.equal(got.length, 1);
  assert.match(got[0], /crush/);
  const none = CUP.ledger(row({i: 1, routes: []}), row({}), NAMES, 0, new Set());
  assert.deepEqual(none, [], "no route, no gloss");
});

test("Ledger says nothing at all about a row with nothing to say", () => {
  assert.deepEqual(CUP.ledger(row({}), row({}), NAMES, 0, new Set()), [],
    "a colour commentator with no fact is a colour commentator who is quiet");
});

test("Ledger's swing number is the row's own", () => {
  const got = CUP.ledger(row({i: 1, hp: [20, 12]}), row({hp: [20, 20]}), NAMES, 0, new Set());
  const swing = got.find(s => /life in one action/.test(s));
  assert.ok(swing, "8 life in one action is worth saying");
  assert.match(swing, /\b8\b/, "and the number is 20 - 12, not a flourish");
});

/* AN EXPLANATION IS NEWS ONCE, and the drill is what keeps that from
   being re-implemented as a taste. Without it the booth prints the same
   CR citation beside all forty declarations in a game. */
test("a gloss is spoken once per tie, and the row's own facts are not", () => {
  const said = new Set();
  const a = CUP.ledger(row({routes: ["crush"]}), row({}), NAMES, 0, said);
  const b = CUP.ledger(row({i: 1, routes: ["crush"]}), row({}), NAMES, 0, said);
  assert.equal(a.length, 1); assert.deepEqual(b, [], "the second crush needs no second lesson");
  /* but a swing is a fact about THIS row and must recur */
  const s1 = CUP.ledger(row({i: 2, hp: [13, 20]}), row({hp: [20, 20]}), NAMES, 0, said);
  const s2 = CUP.ledger(row({i: 3, hp: [6, 20]}), row({i: 2, hp: [13, 20]}), NAMES, 0, said);
  assert.ok(s1.some(x => /life in one action/.test(x)));
  assert.ok(s2.some(x => /life in one action/.test(x)), "a second big swing is a second event");
});

/* ---- WHICH ROWS GET CALLED ------------------------------------------ */

test("a row is called for a printed line, a life move, a route or a flag", () => {
  const none = new Set();
  assert.equal(CUP.called(row({}), row({}), none), false, "a silent pass is not news");
  assert.ok(CUP.called(row({lines: ["x"]}), row({}), none));
  assert.ok(CUP.called(row({routes: ["crush"]}), row({}), none));
  assert.ok(CUP.called(row({hp: [19, 20]}), row({hp: [20, 20]}), none));
  assert.ok(CUP.called(row({i: 7}), row({}), new Set([7])), "a judge's flag is always news");
});

/* ---- THE OBSERVATIONS ----------------------------------------------- */

test("an idle run is consecutive rows that changed nothing", () => {
  const tl = [];
  for(let i = 0; i < 12; i++) tl.push(row({i}));
  tl.push(row({i: 12, lines: ["something happened"]}));
  const o = CUP.observe(tl);
  assert.equal(o.idle.length, 1, "eleven dead rows is one run");
  assert.ok(o.idle[0].len >= 8);
});

test("a game that keeps moving reports no idle run", () => {
  const tl = [];
  for(let i = 0; i < 12; i++) tl.push(row({i, hp: [20 - i, 20]}));
  assert.deepEqual(CUP.observe(tl).idle, []);
});

test("the swing names the row it happened on", () => {
  const tl = [row({i: 0}), row({i: 1, hp: [20, 9], act: "payConfirm"}), row({i: 2, hp: [20, 9]})];
  const o = CUP.observe(tl);
  assert.equal(o.swing.n, 11);
  assert.equal(o.swing.row.i, 1, "a swing with no row is a number nobody can check");
});

test("silent actions are reported per KIND, not as a count", () => {
  const o = CUP.observe([row({i: 0, act: "pass"}), row({i: 1, act: "pass"}),
                         row({i: 2, act: "paySel"}), row({i: 3, act: "play", lines: ["x"]})]);
  assert.equal(o.silent.get("pass"), 2);
  assert.equal(o.silent.get("paySel"), 1);
  assert.equal(o.silent.get("play"), undefined, "a row that printed is not silent");
});

/* ---- THE FIELD ------------------------------------------------------ */

test("the draw is eight distinct entrants and replays from the name", () => {
  const a = CUP.drawField("Dawnblade Eight").field;
  const b = CUP.drawField("Dawnblade Eight").field;
  const c = CUP.drawField("Something Else").field;
  assert.equal(a.length, 8);
  assert.equal(new Set(a.map(e => e.name)).size, 8, "no entrant twice — a mirror is not a tie");
  assert.deepEqual(a.map(e => e.name), b.map(e => e.name), "the draw must reproduce");
  assert.notDeepEqual(a.map(e => e.name), c.map(e => e.name),
    "a different event is a different draw, or the name is decoration");
});

/* Every route the booth can gloss must be a kind `selfplay` actually
   emits — a gloss for a name nothing pushes is dead prose that reads like
   coverage (v3.55's counter with no reader, one layer out). */
test("every glossed route is a kind selfplay emits", () => {
  const src = require("fs")
    .readFileSync(require.resolve("../tools/selfplay.js"), "utf8");
  const emitted = new Set([...src.matchAll(/events\.push\(\["([A-Za-z][A-Za-z-]*)"/g)]
    .map(m => m[1]));
  for(const k of Object.keys(CUP.ROUTE_GLOSS))
    assert.ok(emitted.has(k), `the booth glosses "${k}" and nothing emits it`);
});
