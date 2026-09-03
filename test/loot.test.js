/* ============================================================
   THE TWO LOOT CARDS — A GRANTED ABILITY IN TWO SENTENCES (v3.95)

     "Your next Pirate ally attack this turn gets \"When this hits a hero,
      DESTROY A CARD IN THEIR ARSENAL. If you do, create a Gold token.\""
                                              — LOOT THE ARSENAL
     "…\"When this hits a hero, THEY DISCARD A CARD. If they do, create a
      Gold token.\""                          — LOOT THE HOLD

   A RECORDED REFUSAL, COMING DUE. v3.45 built the rider-only grant reader
   and wrote down why these two still refused: `classifyClause` over the
   whole quoted string reads ONE of the two sentences and drops the other,
   INCONSISTENTLY — Loot the Hold gave the discard and lost the Gold, and
   Loot the Arsenal gave the GOLD and lost the destroy it is printed to
   pay for, which is the reward without the cost. Claiming half is worse
   than claiming nothing (v2.29), so the grant refused whole.

   WHAT WAS MISSING IS A TRACE, AND CHECKING FIRST IS THE RULE (v3.61).
   `_discWay` records what a resolution DISCARDED — the actor's own — and
   `_dmgWay` what it dealt. Neither can answer "did we take a card from
   the OPPONENT", which is what both riders ask, so `_tookWay` is a second
   record of a second fact rather than a widening of either.

   THE GATE IS `way:took` AND `thisWayMet` IS ITS ONE EVALUATOR (v3.60).
   The `condOnHit` loop routes every `way:` cond through it now, so the
   name cannot be read in one place and answered in another.

   AND IT IS RE-CHECKED AT THE HIT, not at declaration: "if you do" is a
   question about an op that has not run yet when the attack is declared
   (v3.60's whole lesson). `condOnHit` is the shape that already does
   this, so the grant rides in it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;

const junk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

/* A REAL PIRATE ALLY, out of the pool — the qualifier the cards print is
   "Pirate ALLY attack", and a synthetic that merely says so proves the
   matcher rather than the card (v3.42). */
const ally = () => Object.assign(H.card("Swabbie", 2), {uid: "ally1"});

function play(lootName, foe){
  P.fxReset();
  const loot = Object.assign(H.card(lootName, 3), {uid: "loot1"});
  let g = H.state({name: "Alice", hand: [loot], res: 9, ap: 2,
                   board: [{uid: "ally1", kind: "ally", spent: false, card: ally()}]},
                  Object.assign({name: "Bob", hp: 20}, foe || {}),
                  {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  return unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer"}),
                          loot, "hand", 0, {}));
}

function swing(n){
  const entry = n.sides[0].board.find(b => b.uid === "ally1");
  const out = unwrap(H.execute(Object.assign({}, n, {promptQ: [], prompt: null}),
                               entry.card, "ally", 0, {}));
  assert.ok(out.pend, "the ally swing opened a link");
  return unwrap(H.fx(out, (fx, m) => {
    const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
    return r.game || r;
  }));
}

const golds = g => (g.sides[0].board || []).filter(b => b.card.name === "Gold").length;
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

/* ---- 1. THE READER --------------------------------------------------- */

test("both cards are claimed, and the two halves are told apart", {skip}, () => {
  for(const [nm, op] of [["Loot the Arsenal", "foeArsDestroy"], ["Loot the Hold", "foeDiscard"]]){
    P.fxReset();
    const ops = P.fxParse(H.card(nm, 3)).ops;
    assert.equal(ops.length, 1, nm);
    const [k, amt, q, rider] = ops[0];
    assert.equal(k, "buffNext");
    assert.equal(amt, 0, "a rider-only grant carries no power of its own");
    assert.deepEqual(q, {g: [["pirate", "ally"]], atk: true}, "the printed qualifier");
    assert.deepEqual(rider.onHitHero, [[op, 1]], "the FIRST sentence is the ability");
    assert.deepEqual(rider.condOnHit,
      [{cond: "way:took", op: ["token", "gold", 1, "self"], heroOnly: true}],
      "and the second rides as a GATE, not as more ops");
    assert.equal(rider.onHit, undefined, '"hits a HERO" — never a bare hit (v3.45)');
  }
});

test("the two spellings of the gate name the same event", {skip}, () => {
  /* Loot the Arsenal destroys (so "IF YOU DO") and Loot the Hold makes
     them discard (so "IF THEY DO") — the same event from its two ends. */
  P.fxReset();
  const real = H.card("Loot the Hold", 3);
  const swap = P.fxParse(Object.assign({}, real, {name: "SYN-loot-youdo",
    tx: (real.tx || "").replace("If they do", "If you do")}));
  assert.deepEqual(swap.ops[0][3].condOnHit.map(x => x.cond), ["way:took"]);
});

test("what the whole-string reader USED to do, and why it refused", {skip}, () => {
  /* THE DEFECT, PINNED. Handed both sentences at once `classifyClause`
     answers with ONE of them — and picks a different one for each card.
     If this ever stops being true the split is unnecessary; while it is
     true, the split is the only faithful reading. */
  assert.deepEqual(
    P.classifyClause("when this hits a hero, destroy a card in their arsenal. if you do, create a gold token").ops,
    [["token", "gold", 1, "self"]], "the GOLD survives and the destroy is lost");
  assert.deepEqual(
    P.classifyClause("when this hits a hero, they discard a card. if they do, create a gold token").ops,
    [["foeDiscard", 1]], "…and here the discard survives and the Gold is lost");
});

/* ---- 2. THE TRACE ---------------------------------------------------- */

test("`_tookWay` is a SECOND record of a SECOND fact", {skip}, () => {
  /* v3.61's rule — check for the trace before you build one. `_discWay`
     is the ACTOR's own discard and `_dmgWay` is damage; neither can
     answer "did we take a card from the OPPONENT". */
  const g = H.state({name: "A"}, {name: "B", hand: [junk("x", "x1")]}, {turn: 3});
  const took = unwrap(H.runOps(g, [["foeDiscard", 1]], "drill"));
  assert.equal((took._tookWay || []).length, 1, "a discard that landed is recorded");
  assert.equal((took._discWay || []).length, 0, "and it is NOT the actor's own discard trace");

  const empty = unwrap(H.runOps(H.state({name: "A"}, {name: "B", hand: []}, {turn: 3}),
                                [["foeDiscard", 1]], "drill"));
  assert.equal((empty._tookWay || []).length, 0, "an empty hand records nothing");
});

test("`thisWayMet` is the ONE evaluator, and an unknown way answers FALSE",
     {skip}, () => {
  assert.equal(E.thisWayMet("way:took", {took: [{}]}), true);
  assert.equal(E.thisWayMet("way:took", {took: []}), false);
  assert.equal(E.thisWayMet("way:took", {}), false, "an absent trace answers no");
  /* the default is reachable only by NAME — the parser emits only
     conditions the evaluator knows (v3.26, v3.60) */
  assert.equal(E.thisWayMet("way:somethingNobodyBuilt", {took: [{}]}), false);
});

/* ---- 3. DRIVEN, THROUGH A REAL PIRATE ALLY ATTACK -------------------- */

test("driven: Loot the Hold — a hand to take from pays the Gold", {skip}, () => {
  const n = play("Loot the Hold", {hand: [junk("Junk", "j1")]});
  assert.equal((n.sides[0].buffQ || []).length, 1, "the grant is held, waiting");
  const out = swing(n);
  assert.deepEqual(out.sides[1].hand.map(c => c.name), [], "they discarded");
  assert.equal(golds(out), 1, "and the Gold is created");
});

test("driven: Loot the Hold — an EMPTY hand pays nothing", {skip}, () => {
  /* THE WHOLE POINT OF THE GATE. Read unconditionally the Gold arrives
     off a discard that never happened — stronger than printed, and the
     direction that steals games. */
  const out = swing(play("Loot the Hold", {hand: []}));
  assert.equal(golds(out), 0);
  assert.match(said(out), /hand is already empty/);
  assert.match(said(out), /condition not met/, "and the feed says why");
});

test("driven: Loot the Arsenal — an arsenal to take pays the Gold", {skip}, () => {
  const out = swing(play("Loot the Arsenal", {arsenal: junk("Set", "s1")}));
  assert.equal(out.sides[1].arsenal, null, "it was destroyed");
  assert.equal(golds(out), 1);
});

test("driven: Loot the Arsenal — an EMPTY arsenal pays nothing", {skip}, () => {
  const out = swing(play("Loot the Arsenal", {arsenal: null}));
  assert.equal(golds(out), 0);
  assert.match(said(out), /arsenal is empty/);
});

test("driven: neither card fires its payload ON PLAY", {skip}, () => {
  /* v3.45's original finding: read late, the grant is stolen by its own
     rider and the loose `foeDiscard` matcher fired it on play — no
     attack, no ally, no hit. */
  const a = play("Loot the Hold", {hand: [junk("A", "fa"), junk("B", "fb")]});
  assert.equal(a.sides[1].hand.length, 2, "nobody discarded");
  assert.equal(golds(a), 0, "and no Gold was minted");
  const b = play("Loot the Arsenal", {arsenal: junk("Set", "s1")});
  assert.ok(b.sides[1].arsenal, "the arsenal is untouched");
  assert.equal(golds(b), 0);
});

test("driven: the grant WAITS for a Pirate ally and is not spent by anything else",
     {skip}, () => {
  /* A qualified grant that does not match is not spent, it waits (v2.30,
     v3.31) — and go again is the most valuable keyword in the game to
     hand to the wrong card, so the same discipline governs a rider. */
  const n = play("Loot the Hold", {hand: [junk("Junk", "j1")]});
  const other = Object.assign(junk("Not A Pirate", "np1"), {tt: "Generic Action - Attack"});
  const mid = unwrap(H.execute(Object.assign({}, n, {promptQ: [], prompt: null,
    sides: [Object.assign({}, n.sides[0], {hand: [other], ap: 2}), n.sides[1]]}),
    other, "hand", 0, {}));
  assert.equal((mid.sides[0].buffQ || []).length, 1,
    "a Generic attack does not match, so the grant is still there");
  assert.deepEqual((mid.pend || {}).onHitHero, [], "and it carried nothing into the link");
});

test("the trace is CLEARED with the resolution", {skip}, () => {
  /* `_tookWay` is cleared where `_discWay` is, and for its stated reason:
     a trace that outlives its resolution is the NEXT card's condition
     reading something it never caused.

     THE FIRST DRAFT OF THIS DRILL BUILT A SECOND STATE and so could not
     see the clear at all — deleting it was SILENT. Driving two attacks in
     sequence cannot see it either, because declaring the second one goes
     through `execute`, which is where the clear lives. So the honest
     fixture puts a STALE trace on the state and asks whether `execute`
     wipes it.

     IT IS NOT BEHAVIOURALLY REACHABLE TODAY, and saying so is the point:
     no parser rule emits a `way:took` into `fx.conds` (only into
     `condOnHit`, which is read inside the same resolution that sets the
     trace). The field is cleared anyway because `_discWay` records what
     it costs when one is not — v3.61's gap, which came due sideways. */
  P.fxReset();
  const stale = [junk("Ghost", "g1")];
  const g = Object.assign(H.state({name: "A", hand: [junk("Any", "a1")], res: 9, ap: 1},
                                  {name: "B"}, {turn: 3, turnPlayer: 0}),
                          {phase: "action", step: "layer", _tookWay: stale});
  g.builds = [{}, {}];
  const out = unwrap(H.execute(g, g.sides[0].hand[0], "hand", 0, {}));
  assert.deepEqual(out._tookWay, [], "a stale trace does not survive into the next resolution");
});
