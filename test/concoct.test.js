/* ============================================================
   EACH HERO PUTS THEIR TOP CARD IN THEIR ARSENAL (v3.88)

     "When this attacks, EACH HERO puts the top card of THEIR deck
      face-down into THEIR arsenal. If 2 OR MORE cards are put into
      arsenals THIS WAY, this gets go again."   — CONCOCT DISORDER

   It read `tier: none`, and the pool's ONLY cross-seat zone move.

   A WHOLE-CARD READER, because the two sentences reach across the clause
   split: "this way" names the puts the first sentence made and the
   splitter breaks on the period. Same place and reason `optCost` pairs
   its halves.

   AND THE PUT HAD TO MOVE TO DECLARATION. `execute` evaluates conditions
   BEFORE it runs ops (v3.60), and on an ATTACK card `fx.ops` ride all the
   way to RESOLUTION while `runWayConds` fires at DECLARATION — so the
   condition would be answered against an empty record on every copy,
   forever. v3.60's own answer names both halves: "pre-run when the op can
   safely move; the late pass when it cannot", and a zone move between two
   decks and two arsenals depends on nothing the attack does.

   IT IS ALSO THE CR-CORRECT MOMENT. "When this attacks" fires on
   DECLARATION; riding to `pend.ops` puts it at resolution, which is the
   standing approximation for the other 14 attack cards that print a bare
   when-this-attacks. Those are measured and deliberately left alone —
   this one moves because its own condition asks about it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const J = require("../engine/judge.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

const filler = (u, nm) => ({uid: u, name: nm, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 0, power: 3, def: 2, tx: "", kw: []});

/* Play the card at the table and report what it MOVED. */
function run(o){
  o = o || {};
  H.db(); P.fxReset();
  const cd = Object.assign({}, H.card("Concoct Disorder", 1), {uid: 901});
  const g = H.state(
    {hand: [cd], res: 9, ap: 1, deck: o.youDeckEmpty ? [] : [filler(910, "YouTop"), filler(911, "Y2")],
     arsenal: o.youArs ? filler(920, "YouArs") : null},
    {hp: 20, deck: o.foeDeckEmpty ? [] : [filler(930, "FoeTop"), filler(931, "F2")],
     arsenal: o.foeArs ? filler(940, "FoeArs") : null},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, cd, "hand", 0, {})}));
  const n = out.game || out;
  return {
    put: n._arsWay,
    youArs: n.sides[0].arsenal, foeArs: n.sides[1].arsenal,
    youDeck: n.sides[0].deck.length, foeDeck: n.sides[1].deck.length,
    ga: !!(n.pend && n.pend.ga),
    bad: INV.errors(n).length,
    feed: (n.feed || []).join(" | "),
    game: n
  };
}

/* ---- 1. THE READER -------------------------------------------------- */

test("Concoct Disorder reads in full, as ONE op and ONE condition", {skip}, () => {
  H.db(); P.fxReset();
  const fx = P.fxParse(H.card("Concoct Disorder", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.ops, [["eachArsPut"]]);
  assert.deepEqual(fx.conds, [{cond: "way:arsPut2", op: ["ga"], instead: false, atkHero: false}]);
  assert.deepEqual(fx.clauses.map(c => c.st), ["run", "run"],
    "both printed sentences are accounted for");
});

test("ONE op for both seats, not two", {skip}, () => {
  /* "2 or more cards are put into arsenals THIS WAY" counts ACROSS the
     seats, and two ops could not answer it without threading a total
     between them — state no op carries. Same reason Azalea's cycle is a
     whole-card reader (v3.71). */
  H.db(); P.fxReset();
  const fx = P.fxParse(H.card("Concoct Disorder", 1));
  assert.equal(fx.ops.length, 1);
});

test("the THRESHOLD is the card's own number, carried in the condition", {skip}, () => {
  /* A literal 2 in the evaluator is right for this printing and silently
     wrong for any other (v3.17, v3.32, v3.55). The number is in the
     condition NAME, so `thisWayMet` reads it rather than knowing it. */
  assert.equal(E.thisWayMet("way:arsPut2", {ars: 1}), false);
  assert.equal(E.thisWayMet("way:arsPut2", {ars: 2}), true);
  assert.equal(E.thisWayMet("way:arsPut3", {ars: 2}), false,
    "a card printing THREE would need three, and this reader can say so");
  assert.equal(E.thisWayMet("way:arsPut1", {ars: 1}), true);
});

test("the parser READS that number too — a synthetic prints three", {skip}, () => {
  /* HARDCODING THE CONDITION NAME IN THE PARSER WAS SILENT against every
     drill in this file, because Concoct Disorder is the pool's only card
     of the shape and it prints 2 — so no pool fixture can tell a read
     number from a literal. A synthetic card is what sees it, and this is
     the SIXTH time that rule has been needed (v3.32, v3.55, v3.74, v3.77,
     v3.81, v3.86).

     `fxParse` memoizes on `name|pitch`, so the fixture needs its own. */
  P.fxReset();
  const mk = (nm, n2) => P.fxParse({name: nm, pitch: 1, cost: 1, power: 4, def: 2,
    tt: "Chaos Action - Attack", ty: ["Chaos", "Action", "Attack"], kw: [],
    tx: "When this attacks, each hero puts the top card of their deck face-down "
      + "into their arsenal. If " + n2 + " or more cards are put into arsenals "
      + "this way, this gets go again."});
  assert.equal(mk("CD synth 2", 2).conds[0].cond, "way:arsPut2");
  assert.equal(mk("CD synth 3", 3).conds[0].cond, "way:arsPut3");
  assert.equal(mk("CD synth 1", 1).conds[0].cond, "way:arsPut1");
  /* …and the two halves meet: a card printing 3 is NOT satisfied by 2. */
  assert.equal(E.thisWayMet(mk("CD synth 3b", 3).conds[0].cond, {ars: 2}), false);
});

test("an unknown `way:` condition answers FALSE", {skip}, () => {
  /* v3.26's rule, and the function is NAMED so the default is reachable:
     the parser only emits conditions the evaluator knows, so no card
     fixture can drive this branch. */
  assert.equal(E.thisWayMet("way:somethingNobodyBuilt", {ars: 9, disc: [], dmg: 9}), false);
  assert.equal(E.thisWayMet("way:arsPut", {ars: 9}), false, "…including a malformed one");
});

/* ---- 2. THE MOVE ---------------------------------------------------- */

test("driven: both heroes put, and it goes again", {skip}, () => {
  const r = run();
  assert.equal(r.put, 2);
  assert.equal(r.youArs && r.youArs.name, "YouTop", "yours came off YOUR deck");
  assert.equal(r.foeArs && r.foeArs.name, "FoeTop", "and theirs off THEIRS");
  assert.equal(r.youDeck, 1); assert.equal(r.foeDeck, 1);
  assert.equal(r.ga, true, "two cards were put this way — go again");
  assert.equal(r.bad, 0);
});

test("the put is FACE-DOWN — read, never defaulted", {skip}, () => {
  /* v3.69: the face of an arsenal put is the caller's answer. Read as
     face UP this fires every arrow's put-face-up trigger for BOTH seats,
     off an attack that never says so — Azalea's whole deck. */
  const r = run();
  assert.ok(!r.youArs._faceUp, "no face-up stamp");
  assert.ok(!r.foeArs._faceUp);
  assert.equal(r.youArs._upTurn, undefined, "and no turn stamp to go with one");
  assert.match(r.feed, /face-down/, "and the feed says so");
});

test("a FULL arsenal puts nothing, and the go again is denied", {skip}, () => {
  const r = run({youArs: true});
  assert.equal(r.put, 1, "only the seat with room puts");
  assert.equal(r.youArs.name, "YouArs", "the held card is not displaced");
  assert.equal(r.youDeck, 2, "and nothing left the deck");
  assert.equal(r.ga, false, "fewer than 2 — no go again");
  assert.match(r.feed, /arsenal is full/);
});

test("an EMPTY DECK puts nothing either", {skip}, () => {
  const r = run({foeDeckEmpty: true});
  assert.equal(r.put, 1);
  assert.equal(r.foeArs, null);
  assert.equal(r.ga, false);
  assert.match(r.feed, /no deck left/);
});

test("both blocked — zero puts, and nothing crashes", {skip}, () => {
  const r = run({youArs: true, foeArs: true});
  assert.equal(r.put, 0);
  assert.equal(r.ga, false);
  assert.equal(r.bad, 0);
});

/* ---- 3. THE TIMING -------------------------------------------------- */

test("the put runs at DECLARATION, so the condition can see it", {skip}, () => {
  /* THE WHOLE REASON THIS CARD REFUSED. On an attack, `fx.ops` ride to
     `pend.ops` and run at RESOLUTION, while `runWayConds` fires at
     DECLARATION — so a this-way condition about its own ops is answered
     against an empty record, on every copy, forever (v3.60).

     The observable is that `pend` already carries the grant, and the
     arsenals have already moved, before anything resolves. */
  const r = run();
  assert.equal(r.game.pend && r.game.pend.ga, true, "the grant is on the link");
  assert.ok(r.youArs && r.foeArs, "and both arsenals moved before resolution");
  /* AND IT IS NOT RUN A SECOND TIME AT RESOLUTION. `preRan` is what keeps
     the op out of `pend.ops`; without it both seats put twice and the
     second put silently displaces the first. */
  assert.deepEqual((r.game.pend.ops || []).filter(o => o[0] === "eachArsPut"), [],
    "the op is not queued for resolution as well");
});

test("the trace is cleared per resolution", {skip}, () => {
  /* It is one card's own doing. Left on the state it is the NEXT card's
     condition reading puts it never made — v3.60's rule, and a drill that
     plays ONE card cannot see it. */
  H.db(); P.fxReset();
  const first = run();
  assert.equal(first.put, 2);
  const plain = Object.assign({}, filler(950, "Plain Swing"), {uid: 950});
  const out = J.withEffects(first.game, (fx, s) =>
    ({game: fx.execute(Object.assign({}, s, {pend: null, stack: []}), plain, "hand", 0, {})}));
  const n = out.game || out;
  assert.equal(n._arsWay, 0, "the next resolution starts from zero");
});

/* ---- 4. THE FEED ---------------------------------------------------- */

test("each line NAMES its seat, and agrees with the name it used", {skip}, () => {
  /* A log line is read by BOTH seats (v2.83), so a cross-seat op must say
     whose arsenal moved. Seat 0's name is literally "You", which makes
     "You puts the top card of THEIR deck" wrong in two places at once. */
  const r = run();
  assert.match(r.feed, /You put the top card of your deck face-down into your arsenal/);
  assert.match(r.feed, /Opponent puts the top card of their deck face-down into their arsenal/);
});
