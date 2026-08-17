/* ============================================================
   SUSPENSE — the keyword is a DELAY, and it was a bonus.

   Five Guardian auras print it. RULING 2026-07-25: "just like the other
   'counters' these are often represented by dice and 'tick' down at the
   beginning of the turn. unlike steam-powered it is destroyed immediately
   when it has none. The effect activates when the aura is destroyed" —
   plus "suspense always comes in with 2 counters - that number is in the
   rules text and is the same for every suspense card".

   Until v3.00 there was no arena-departure schedule anywhere, so the
   payload was queued ON PLAY: Act of Glory handed you +6{p} the moment
   the aura landed rather than two turns later. Every one of the five
   reported `tier: full`, because the bare keyword parses to a `noop` and
   a noop counts as accounted for — the no-op blind spot, and the reason
   `tools/failstates.js` was the only tool that could see any of it.

   THE SCHEDULE HAS TO EXIST ON BOTH BOARDS. `effects.tickSuspense` is
   pure and shared; the trainer calls it at the top of its turn and
   judge.js calls it in the START PHASE, whose own comment predicted this
   ("it becomes a real pause the moment one of them exists"). A schedule
   written into one board's turn boundary is a schedule the other board
   does not have — which is exactly how phantasm was inert at the table
   for three versions.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const card = (nm, p) => C.resolveEntry(H.db(), {name: nm, p: p == null ? 0 : p, code: null, q: 1});

const boardWith = (c, susp) => ({card: c, kind: "aura", spent: false, uid: c.uid, susp});

/* ---- THE CARDS ---------------------------------------------------------- */

test("five pool auras PRINT suspense; the two that ask about it do not", {skip}, () => {
  H.db();
  for(const [nm, p] of [["Act of Glory", 1], ["Edge of Their Seats", 1], ["Edge of Their Seats", 3],
                        ["Tension in the Air", 1], ["The Suspense is Killing Me", 3]]){
    const c = card(nm, p);
    assert.ok(c.resolved, nm + " must resolve");
    assert.ok(P.printedKw(c, "suspense"), nm + " (" + p + ") prints the keyword");
  }
  /* Same split as watery grave: these two ASK whether you control one. */
  for(const [nm, p] of [["Full of Bravado", 3], ["Stand Strong", 0]]){
    const c = card(nm, p);
    assert.ok(P.hasKw(c, "suspense"), nm + " mentions it");
    assert.ok(!P.printedKw(c, "suspense"), nm + " must not be treated as an aura of suspense itself");
  }
});

/* ---- THE COUNTERS ------------------------------------------------------- */

test("it ticks down at the beginning of the turn and is destroyed at zero", {skip}, () => {
  const aog = {...card("Act of Glory", 1), uid: "s1"};
  let g = {turn: 3, sides: [{board: [boardWith(aog, 2)], grave: []}, {board: [], grave: []}]};

  const t1 = E.tickSuspense(g, 0);
  assert.equal(t1.game.sides[0].board.length, 1, "two counters — it survives the first turn");
  assert.equal(t1.game.sides[0].board[0].susp, 1);
  assert.deepEqual(t1.fired, [], "and it has NOT paid out yet — that is the whole drawback");
  assert.deepEqual(t1.ops, []);

  const t2 = E.tickSuspense(t1.game, 0);
  assert.deepEqual(t2.fired, ["Act of Glory"], "the second tick empties it");
  assert.equal(t2.game.sides[0].board.length, 0, "destroyed immediately at zero, unlike steam-powered");
  assert.deepEqual(t2.game.sides[0].grave.map(c => c.name), ["Act of Glory"], "and it lands in a zone");
  assert.equal(t2.game.sides[0].grave[0]._gy, 3, "turn-stamped like every other path into the graveyard");
  assert.deepEqual(t2.ops, [["buffNext", 6]], "the effect activates when the aura is destroyed");

  const t3 = E.tickSuspense(t2.game, 0);
  assert.deepEqual(t3.msgs, [], "and nothing keeps ticking after it is gone");
});

test("it ticks only its OWN controller's auras", {skip}, () => {
  const aog = {...card("Act of Glory", 1), uid: "s1"};
  const g = {turn: 3, sides: [{board: [boardWith(aog, 2)], grave: []},
                              {board: [boardWith({...aog, uid: "s2"}, 2)], grave: []}]};
  const out = E.tickSuspense(g, 0);
  assert.equal(out.game.sides[0].board[0].susp, 1, "mine ticked");
  assert.equal(out.game.sides[1].board[0].susp, 2, "theirs did not — it ticks on THEIR turn");
});

/* ---- ON THE BOARD THE MERGE MAKES DEFAULT ------------------------------- */

test("an aura of suspense enters play with 2 counters, and pays nothing on the way in", {skip}, () => {
  H.db();
  const aog = {...card("Act of Glory", 1), uid: "s1"};
  let g = H.state({name: "You", res: 9, ap: 3, hand: [aog]}, {name: "Them"},
                  {actor: 0, turnPlayer: 0, seed: "susp"});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};

  const r = J.reduce(g, {t: "play", uid: "s1", from: "hand"}, 0);
  assert.equal(r.error, null, "the aura was refused: " + r.error);
  const n = r.state;
  const ent = n.sides[0].board.find(b => b.uid === "s1");
  assert.ok(ent, "it reached the arena");
  assert.equal(ent.susp, 2, "RULING: suspense always enters with 2 counters");
  assert.equal(n.sides[0].buffNext || 0, 0,
    "AND IT PAID NOTHING ON PLAY — this is the bug: +6{p} the moment it landed");
});

test("the payload lands at the table when the last counter goes, and only then", {skip}, () => {
  H.db();
  const aog = {...card("Act of Glory", 1), uid: "s1"};
  /* Seated mid-game with the aura already down and one counter left, so
     the next turn boundary is the one that pays out. */
  let g = H.state({name: "You", res: 0, ap: 0, board: [boardWith(aog, 1)], hand: [], deck: [{uid: "d1", name: "F"}]},
                  {name: "Them", deck: [{uid: "d2", name: "F2"}]},
                  {actor: 0, turnPlayer: 1, seed: "susp2"});
  g = {...g, phase: "action", step: "layer", priority: 1, passed: [], turn: 4};

  assert.equal(g.sides[0].buffNext || 0, 0, "nothing banked before the turn passes");

  /* end seat 1's turn — CR 4.3.4 takes two actions, and the handoff runs
     the start phase where suspense ticks. */
  let n = J.reduce(g, {t: "endTurn"}, 1).state;
  for(let i = 0; i < 6 && n.turnPlayer !== 0; i++){
    const out = J.reduce(n, {t: "pass"}, n.priority != null ? n.priority : 1);
    if(out.error) break;
    n = out.state;
    while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  }
  assert.equal(n.turnPlayer, 0, "the turn has to actually pass or this drill proves nothing");
  assert.ok(!n.sides[0].board.some(b => b.uid === "s1"), "the aura left the arena");
  assert.equal(n.sides[0].buffNext, 6, "and paid out +6{p} to the hero whose aura it was");
});
