/* ============================================================
   THE ROLLED INTELLECT SETTLES BACK (v3.49)

   Knucklehead prints:

     Action - Destroy this: Roll a 6 sided die. UNTIL END OF TURN, your
     base {i} is the number rolled.

   `effects.intRoll` stashes the printed value on `intWas` and **nothing
   at the table ever read it back**. The trainer restored it inline, in
   `index.html`, and `judge.js` did not — so a table game kept the rolled
   value for the rest of the game. A roll of 1 crippled the hero
   permanently; a roll of 6 was a permanent +2 intellect, which is the
   direction that steals games.

   A SCHEDULE IS WRITTEN PER BOARD (v3.01), and this one was written on
   one board. Same family as phantasm's pop and the graveyard gate.

   FOUND BY PLAYING, and no tool here could see it. Coverage reads the
   clause consumed; the fairness sweep is one-sided and models no
   schedules; `failstates.js` fills its "no schedule to fire on" category
   from UNREAD text, and this text reads perfectly. It surfaced as 14 of
   210 self-play games running past turn 1900 without ending — a hero on
   intellect 1 draws one card a turn and can never assemble a play.

   IT IS NOT A `beginEndPhase` STEP. The rolled value has to govern the
   (f) DRAW — that is the whole of what the card does, and the feed says
   so. `beginEndPhase` runs before (a)-(f), so restoring there would hand
   the draw the printed value and make the card do nothing at all. AFTER
   the draw, on the turn-player's own end phase.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");
const J = H.J;
const G = require("../engine/game.js");
const B = require("../engine/build.js");
const RNG = require("../engine/rng.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";
const W = loadData();

function match(k0, k1, seed){
  const db = H.db();
  const h0 = W.HEROES.find(h => h.k === k0), h1 = W.HEROES.find(h => h.k === k1);
  const ctr = {n: 0};
  let rng = RNG.make(seed || "int");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), db, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), db, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}
function passTurn(g){
  let n = J.reduce(g, {t: "endTurn"}, g.turnPlayer).state;
  if(n.phase === "action" && n.priority != null) n = J.reduce(n, {t: "pass"}, n.priority).state;
  while(n.arsenalFor != null) n = J.reduce(n, {t: "arsenal", uid: null}, n.arsenalFor).state;
  return n;
}

/* ---- 1. THE BODY ----------------------------------------------------- */

test("settleIntellect restores the stashed value and clears the die", () => {
  const g = {sides: [{name: "A", int: 1, intWas: 4}, {name: "B", int: 4, intWas: null}], lastRoll: 3};
  const out = E.settleIntellect(g, 0);
  assert.equal(out.game.sides[0].int, 4, "the printed value comes back");
  assert.equal(out.game.sides[0].intWas, null, "and the stash is spent");
  assert.equal(out.restored, 4);
  assert.equal(out.game.lastRoll, null,
    "a die left on the state is a later intRoll setting intellect from a roll nobody made");
  assert.match(out.msgs[0], /intellect settles back to 4/i);
});

test("it is a no-op when no die was rolled, and NAMES the seat", () => {
  const g = {sides: [{name: "A", int: 4, intWas: null}, {name: "B", int: 4, intWas: null}]};
  const out = E.settleIntellect(g, 0);
  assert.equal(out.restored, null);
  assert.deepEqual(out.msgs, [], "a no-op says nothing rather than announcing a restore");
  assert.equal(out.game.sides[0].int, 4);
  /* v2.83: a log line is read by BOTH seats, so it names the seat rather
     than saying "your". */
  const named = E.settleIntellect({sides: [{name: "A", int: 4, intWas: null},
                                           {name: "Them", int: 1, intWas: 5}]}, 1);
  assert.match(named.msgs[0], /^Them's/, "the feed must name the seat, not say \"you\"");
});

test("it never mutates the state handed in", () => {
  const sd = {name: "A", int: 1, intWas: 4};
  const g = {sides: [sd, {name: "B", int: 4, intWas: null}], lastRoll: 2};
  E.settleIntellect(g, 0);
  assert.equal(sd.int, 1, "the caller's side object is untouched");
  assert.equal(g.lastRoll, 2);
});

/* ---- 2. DRIVEN AT THE TABLE — the bug itself ------------------------- */

test("driven: the rolled intellect governs the draw, THEN settles back", {skip}, () => {
  let g = match("kayo", "dorinthea", "intdrill");
  const printed = g.sides[0].int;
  assert.equal(printed, 4, "Kayo's printed intellect");

  g = J.withEffects({...g, actor: 0, lastRoll: 1}, (f, n) => f.runOps(n, [["intRoll"]], "Knucklehead"));
  assert.equal(g.sides[0].int, 1, "the roll takes effect immediately");
  assert.equal(g.sides[0].intWas, 4, "and the printed value is stashed");

  g = passTurn(g);
  assert.equal(g.sides[0].int, printed,
    "AT THE TABLE the printed value must come back — it never did before v3.49");
  assert.equal(g.sides[0].intWas, null);
  assert.equal(g.lastRoll, null, "and the die is cleared with it");
});

test("driven: the ORDER is the point — the draw sees the rolled value", {skip}, () => {
  /* Restoring in `beginEndPhase` (before (a)-(f)) would hand the draw the
     PRINTED value and make the card do nothing at all. The whole of what
     Knucklehead does is change how many cards you draw. */
  let g = match("kayo", "dorinthea", "intorder");
  /* Empty the hand so the draw is the only thing filling it. */
  g = {...g, sides: g.sides.map((s, i) => i ? s : {...s, hand: []})};
  g = J.withEffects({...g, actor: 0, lastRoll: 2}, (f, n) => f.runOps(n, [["intRoll"]], "Knucklehead"));
  g = passTurn(g);
  assert.equal(g.sides[0].hand.length, 2,
    "it drew to the ROLLED intellect, not the printed one — restoring before (f) breaks this");
  assert.equal(g.sides[0].int, 4, "and only then did the printed value come back");
});

test("driven: it is the TURN-PLAYER's own end phase that settles it", {skip}, () => {
  /* An "until end of turn" effect ends at the end of the turn it was
     created in. Settling on the opponent's end phase would cut it a whole
     turn short; never settling is the bug this fixes. */
  let g = match("kayo", "dorinthea", "intseat");
  g = {...g, sides: g.sides.map((s, i) => i ? {...s, int: 1, intWas: 4} : s)};
  const tp = g.turnPlayer;
  assert.equal(tp, 0, "Kayo is on the play in this fixture");
  g = passTurn(g);
  assert.equal(g.sides[1].intWas, 4,
    "seat 1's stash must survive seat 0's end phase — it is not their turn ending");
  g = passTurn(g);
  assert.equal(g.sides[1].int, 4, "their own end phase settles it");
  assert.equal(g.sides[1].intWas, null);
});

/* ---- 3. ONE BODY, BOTH BOARDS ---------------------------------------- */

test("both boards call the shared body — neither restates it", () => {
  /* v3.01/v3.17: a schedule written per board is how this bug happened.
     A comment saying "the trainer does the same" is not a mechanism. */
  const jd = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const tr = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(jd, /E\.settleIntellect\(/, "judge.js must call it");
  assert.match(tr, /DawnEffects\.settleIntellect\(/, "the trainer must call it");
  for(const [nm, src] of [["judge.js", jd], ["index.html", tr]])
    assert.ok(!/intWas\s*!=\s*null|intWas\s*!==\s*null/.test(src),
      nm + " re-implements the restore — there is one body and it is effects.js's");
});

test("judge settles it AFTER the (f) draw, not before", {skip}, () => {
  const jd = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  const draw = jd.indexOf('for(const i of seats) n = drawTo(n, i);');
  const settle = jd.indexOf('E.settleIntellect(');
  assert.ok(draw > 0 && settle > 0, "both anchors must be present");
  assert.ok(settle > draw,
    "the rolled value governs the draw — settling first makes Knucklehead do nothing");
});
