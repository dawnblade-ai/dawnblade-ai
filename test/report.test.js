/* JUDGE!! — the bug report, drilled.

   This was a closure inside `Battle` until v2.51, which meant no drill
   could reach it and the table board could not produce one at all. It is
   the tool the Phase 3 card-text pass runs on — hundreds of small
   semantic changes, all found by playing — so the properties that make a
   report USEFUL are worth pinning rather than assuming:

     1. it never throws, especially on a broken board
     2. the replay key survives
     3. both state languages come through
     4. every zone is named, not just counted
     5. it is JSON-serializable — a report that will not stringify is
        not a report

   Property 1 is the one that matters most and is the least obvious: a
   report that throws while describing a broken state fails on exactly
   the board you most needed described. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const R = require("../engine/report.js");
const S = require("../engine/sides.js");
const RNG = require("../engine/rng.js");

const mkGame = (over) => {
  const g = S.makeGame({sides: [S.makeSide({id:0, name:"Kayo", heroKey:"kayo", hp:20, int:4}),
                                S.makeSide({id:1, name:"Dorinthea", heroKey:"dorinthea", hp:20, int:4})],
                        firstPlayer: 0, seed: "K7QM"});
  return {...g, ...(over||{})};
};
const card = (name, o) => ({name, uid: (o&&o.uid)||1, pitch:2, cost:1, power:4, def:3, tt:"Attack", tx:"", ...(o||{})});

/* ---- 1. it never throws ------------------------------------------------ */

test("a report survives a state the invariant judge cannot read", () => {
  /* A board broken enough to break the judge is precisely the board you
     most need described, so the failure is CAPTURED, not propagated. */
  const junk = {turn: 3, sides: [null, undefined], chain: "not a list", feed: null};
  let rep;
  assert.doesNotThrow(() => { rep = R.build(junk, {note:"everything is on fire"}); });
  assert.equal(rep.note, "everything is on fire");
  assert.equal(rep.turn, 3);
  assert.deepEqual(rep.sides, [null, null], "a missing seat must report as null, not crash");
});

test("it never throws on an empty, null or nonsense game", () => {
  for(const g of [undefined, null, {}, 0, "game", [], {sides: 7}, {sides: [{}, {}]}]){
    let rep;
    assert.doesNotThrow(() => { rep = R.build(g, {}); }, "threw on " + JSON.stringify(g));
    assert.ok(rep && rep._what, "produced no report for " + JSON.stringify(g));
  }
});

test("it never throws with no context at all", () => {
  assert.doesNotThrow(() => R.build(mkGame()));
  assert.doesNotThrow(() => R.text(mkGame()));
  assert.doesNotThrow(() => R.filename(mkGame()));
});

/* ---- 2. the replay key -------------------------------------------------- */

/* rng.js: "a game is its seed plus its action log". Drop the seed or the
   draw counter and the report becomes a story instead of evidence. */
test("THE REPLAY KEY SURVIVES — seed, stream position and draw count", () => {
  let g = mkGame();
  const r1 = RNG.next(g.rng); g = {...g, rng: r1.rng};
  const r2 = RNG.next(g.rng); g = {...g, rng: r2.rng};
  const rep = R.build(g, {});
  assert.equal(rep.rng.seed, g.rng.seed);
  assert.equal(rep.rng.s, g.rng.s);
  assert.equal(rep.rng.draws, 2, "the draw counter is the desync canary — it must travel");
});

test("a game with no rng reports null rather than throwing", () => {
  assert.equal(R.build({turn:1, sides:[]}, {}).rng, null);
});

/* ---- 3. both state languages -------------------------------------------- */

/* The trainer speaks mode/bphase, judge.js speaks phase/step/priority.
   A report that hid which engine it came from would send the reader
   looking in the wrong one. */
test("the trainer's vocabulary comes through", () => {
  const m = R.build(mkGame({mode:"block", bphase:"defend", incoming:5}), {source:"trainer"}).machine;
  assert.equal(m.mode, "block");
  assert.equal(m.bphase, "defend");
  assert.equal(m.incoming, 5);
});

test("the CR machine's vocabulary comes through", () => {
  const m = R.build(mkGame({phase:"action", step:"defend", priority:0, arsenalFor:1}), {source:"table"}).machine;
  assert.equal(m.phase, "action");
  assert.equal(m.step, "defend");
  assert.equal(m.priority, 0);
  assert.equal(m.arsenalFor, 1);
});

test("the source is named, so a reader knows which engine produced it", () => {
  assert.equal(R.build(mkGame(), {}).source, "trainer", "an unlabelled report defaults to the trainer");
  assert.equal(R.build(mkGame(), {source:"table"}).source, "table");
});

/* ---- 4. every zone is NAMED, not just counted --------------------------- */

/* A count says a card is missing; a name says WHICH. Every bug this
   project has had needed the second. */
test("every zone reports its cards by name and uid", () => {
  const g = mkGame();
  g.sides[0] = {...g.sides[0],
    hand:[card("Pummel",{uid:11})], deck:[card("Wild Ride",{uid:12})],
    grave:[card("Bare Fangs",{uid:13,_gy:2})], pitch:[card("Reincarnate",{uid:14,pitch:3})],
    banish:[card("Crouching Tiger",{uid:15})], soul:[card("Bone Head",{uid:16})],
    arsenal:card("Agile Windup",{uid:17}),
    gear:[card("Knucklehead",{uid:18,def:2})],
    board:[{uid:19, kind:"ally", life:3, card:card("Barnacle",{uid:19})}]};
  const s = R.build(g, {}).sides[0];
  assert.deepEqual(s.hand, ["Pummel#11"]);
  assert.equal(s.arsenal, "Agile Windup#17");
  assert.deepEqual(s.pitch, ["Reincarnate p3"]);
  assert.deepEqual(s.banish, ["Crouching Tiger"]);
  assert.deepEqual(s.soul, ["Bone Head"]);
  assert.match(s.gear[0], /Knucklehead/);
  assert.match(s.board[0], /Barnacle/);
  assert.match(s.board[0], /ally/);
  assert.match(s.board[0], /life 3/);
  assert.equal(s.counts.deck, 1);
});

/* `_gy` answers the whole "discarded a card with 6 or more {p} this
   turn" family, so a graveyard without its stamps cannot debug them. */
test("the graveyard keeps its turn stamps", () => {
  const g = mkGame();
  g.sides[0] = {...g.sides[0], grave:[card("Sand Sketching",{uid:20,_gy:4})]};
  assert.deepEqual(R.build(g, {}).sides[0].grave, ["Sand Sketching _gy4"]);
});

test("both seats are reported, and `you`/`opponent` follow mySeat", () => {
  const g = mkGame();
  const asHost  = R.build(g, {mySeat:0});
  const asGuest = R.build(g, {mySeat:1});
  assert.equal(asHost.sides.length, 2);
  assert.equal(asHost.you.name, "Kayo");
  assert.equal(asHost.opponent.name, "Dorinthea");
  assert.equal(asGuest.you.name, "Dorinthea", "seat 1's report must call seat 1 'you'");
  assert.equal(asGuest.opponent.name, "Kayo");
  /* and `sides` stays in SEAT order regardless of who is reading */
  assert.deepEqual(asGuest.sides.map(s=>s.name), ["Kayo","Dorinthea"]);
});

/* ---- 5. it must serialize ----------------------------------------------- */

/* A report that will not stringify is not a report. Card objects carry
   cycles nowhere today, but the whole point is to survive a state nobody
   anticipated. */
test("the report is JSON-serializable, even holding real card objects", () => {
  const g = mkGame();
  const c = card("Pummel",{uid:30});
  c.self = c;                                   /* a cycle, on purpose */
  g.sides[0] = {...g.sides[0], hand:[c], grave:[c]};
  let txt;
  assert.doesNotThrow(() => { txt = R.text(g, {note:"cycles"}); },
    "a cyclic card object must not break the report — zones are flattened to strings");
  assert.ok(txt.length > 200);
  assert.doesNotThrow(() => JSON.parse(txt));
});

test("the filename names the hero and the turn", () => {
  const f = R.filename(mkGame({turn:7}), {hero:"kayo"});
  assert.match(f, /^dawnblade-bug-kayo-t7-\d+\.json$/);
});

test("the filename falls back to the seated hero when no context is given", () => {
  assert.match(R.filename(mkGame({turn:2}), {}), /^dawnblade-bug-kayo-t2-/);
});

/* ---- what a caller staples on ------------------------------------------- */

test("net counters ride along, so a table bug names which peer saw it", () => {
  const rep = R.build(mkGame(), {source:"table", mySeat:1, table:"K7QM",
    net:{seq:11, hash:"1e04a3e8", desyncs:0, resyncs:0}});
  assert.equal(rep.mySeat, 1);
  assert.equal(rep.table, "K7QM");
  assert.equal(rep.net.hash, "1e04a3e8");
  assert.equal(rep.net.seq, 11);
});

test("the invariants seen this game ride along with the ones seen now", () => {
  const rep = R.build(mkGame(), {invariantsSeen:[{turn:2, code:"CARD-IN-TWO-ZONES", msg:"x"}]});
  assert.equal(rep.invariantsSeen.length, 1);
  assert.ok(Array.isArray(rep.invariantsNow));
});

test("a clean opening board reports no invariant violations", () => {
  assert.deepEqual(R.build(mkGame(), {}).invariantsNow, []);
});

test("the feed travels — the sequence IS the lesson in a training sim", () => {
  const rep = R.build(mkGame({feed:["Kayo takes the first turn.","Pitched Bare Fangs for 2."]}), {});
  assert.equal(rep.feed.length, 2);
});

/* ---- the discipline ------------------------------------------------------ */

test("report.js reads no card TEXT — it describes a board, it does not judge cards", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "report.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  for(const banned of ["fxParse", "classifyClause", "effCost", "resolveEntry", "./cards.js", "./judge.js"]){
    assert.ok(src.indexOf(banned) < 0, "report.js reached for " + banned);
  }
});

/* EVERY GAME CARRIES BOTH VOCABULARIES, so neither being present tells
   you which engine is driving: `sides.js`'s makeGame seeds mode/bphase
   into judge's state too, and the trainer has carried a derived
   phase/step since v2.27's shadow pass. A table report showing
   `bphase:"defend"` would send a reader into the trainer looking for a
   bug that is not there. */
test("the report NAMES which state vocabulary is authoritative", () => {
  const g = mkGame({mode:"act", bphase:"defend", phase:"action", step:"layer"});
  assert.equal(R.build(g, {source:"table"}).machine.lang, "phase");
  assert.equal(R.build(g, {source:"trainer"}).machine.lang, "mode");
  assert.equal(R.build(g, {}).machine.lang, "mode", "an unlabelled report is the trainer's");
  /* and NOTHING is hidden — both blocks still travel */
  const m = R.build(g, {source:"table"}).machine;
  assert.equal(m.bphase, "defend");
  assert.equal(m.step, "layer");
});
