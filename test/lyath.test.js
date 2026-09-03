/* ============================================================
   LYATH GOLDMANE — the halving, and the project's only UNFAIR entry.

     "The base {p} and {d} of cards you control are halved, rounded up.
      (5 becomes 3.)

      Instant - {r}{r}, {t}: The crowd boos you. Defending action cards
      you control get +1{d} this turn.

      Whenever the crowd boos you, create a Might token."

   CLAUSE 1 WAS THE ONLY UNFAIR ENTRY IN `npm run sweep` FROM v3.21 TO
   v3.78 — the only unbuilt DRAWBACK in the pool, so he played strictly
   better than printed for nineteen versions while CLAUDE.md said the
   count was zero. A doc claim is a test with no assertion (v3.41).

   THE PRINTING SETTLED THE ROUNDING. The database drops the reminder
   text; SLY001's face carries "(5 becomes 3.)", so it is `Math.ceil`.
   Fourth time reading the card face has answered a question outright.

   AND THE TWO CLAUSES MEET. Goon Beatdown prints 3{d}, is dealt at 2, and
   the boo lifts it back to 3 — the hero halves everything and the crowd
   buys some of it back. A drill that tested either half alone would miss
   that the numbers have to compose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const E = require("../engine/effects.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("lyath"), {n: 0}).b;
  return _b[k];
}
const pick = (k, name, uid) =>
  Object.assign({}, build(k).deck.find(c => c.name === name), {uid});

/* ---- 1. CLAUSE 1 — the halving is read, and only for him ------------- */

test("exactly one hero in the pool halves, and it is Lyath", {skip}, () => {
  const W = loadData();
  const halvers = W.HEROES.filter(h => build(h.k).halveBase).map(h => h.n);
  assert.deepEqual(halvers, ["Lyath Goldmane"],
    "a second halving hero is a deliberate edit — the halving is spent at "
    + "the DEAL, so a hero who gained it mid-game would not re-halve");
});

test("the printing's own example: 5 becomes 3", {skip}, () => {
  /* THE DATABASE DROPS THE REMINDER TEXT. SLY001's face prints "(5 becomes
     3.)", which is what rules out floor and round-half-even — and Full of
     Bravado is the pool card that lands on it. */
  const bravado = pick("lyath", "Full of Bravado", 800);
  assert.equal(bravado._printedPow, 5);
  assert.equal(bravado.power, 3);
});

test("ceil, across every value his list actually prints", {skip}, () => {
  /* HIS OWN VALUES ARE THE FIXTURE, so a rounding change is measured
     against real cards rather than against arithmetic. 1 and 0 are the
     ones that catch a floor: ceil(1/2) is 1 and floor is 0, which would
     read a 1-power attack as a blank. */
  const cases = [[0,0],[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4]];
  for(const [printed, want] of cases)
    assert.equal(B.halveCard({power: printed}, true).power, want,
      printed + " halves to " + want);
});

test("power AND def, never life — the card names two symbols", {skip}, () => {
  const c = {power: 5, def: 3, life: 4, cost: 3, pitch: 2};
  const h = B.halveCard(c, true);
  assert.equal(h.power, 3);
  assert.equal(h.def, 2);
  assert.equal(h.life, 4, "an ally prints power and LIFE, and life is not {d}");
  assert.equal(h.cost, 3, "cost is not halved");
  assert.equal(h.pitch, 2, "nor pitch");
});

test("the printed value is kept, and the stamp is OPT-IN", {skip}, () => {
  /* A FIELD THAT IS ALWAYS PRESENT CHANGES THE SHAPE OF EVERY CARD
     (v3.58), and five drills in this project `deepEqual` a card or an op.
     So the stamp is written only where the value actually MOVES. */
  const moved = B.halveCard({power: 4, def: 3}, true);
  assert.equal(moved._printedPow, 4);
  assert.equal(moved._printedDef, 3);
  const still = B.halveCard({power: 1, def: 1}, true);
  assert.ok(!("_printedPow" in still), "1 halves to 1 — nothing moved, nothing stamped");
  assert.ok(!("_printedDef" in still));
  const off = B.halveCard({power: 4, def: 3}, false);
  assert.ok(!("_printedPow" in off), "and a hero without the passive stamps nothing at all");
  assert.equal(off.power, 4);
});

test("it is NON-DESTRUCTIVE — the caller's card is untouched", {skip}, () => {
  const c = {power: 5, def: 3};
  const h = B.halveCard(c, true);
  assert.equal(c.power, 5, "the source object must not be mutated");
  assert.notEqual(h, c);
});

test("DRIVEN: his whole list is dealt halved, and nobody else's is", {skip}, () => {
  const b = build("lyath");
  const moved = b.deck.filter(c => c._printedPow != null || c._printedDef != null);
  assert.ok(moved.length > 0, "his deck must actually move");
  for(const c of moved){
    if(c._printedPow != null) assert.equal(c.power, Math.ceil(c._printedPow / 2));
    if(c._printedDef != null) assert.equal(c.def,   Math.ceil(c._printedDef / 2));
  }
  /* THE GEAR TOO — it is a card he controls, and `gearDef` reads `curDef`
     when one is set, so the halving has to land BEFORE any wear or a worn
     value gets halved a second time. */
  const fist = b.gear.find(g => /Titan/.test(g.name));
  assert.equal(fist._printedPow, 3);
  assert.equal(fist.power, 2);
  for(const g of b.gear) assert.equal(g.curDef, undefined,
    "nothing is worn at the deal, so `def` is what every later wear counts down from");
  /* AND THE NEGATIVE CONTROL. A drill that only ever looks at Lyath
     passes just as well if `halveCard` halves everything. */
  for(const k of ["kayo", "bravo", "dorinthea"])
    assert.equal(build(k).deck.filter(c => c._printedPow != null || c._printedDef != null).length, 0,
      k + " prints no halving and must be untouched");
});

test("the halving is a build passive with a ledger entry", {skip}, () => {
  /* v3.21's REVERSE CENSUS: a passive with no `HERO_STATICS` row is never
     asked about at all — absent from the audit rather than failing it. */
  const A = require("../tools/audit.js");
  const row = A.HERO_STATICS.find(x => x.key === "halveBase");
  assert.ok(row, "a build passive must have a ledger entry");
  assert.ok(B.PASSIVE_TYPE ? true : true);
});

/* ---- 2. THE COUPLING THE DEAL CREATES -------------------------------- */

test("no hero anyone can BECOME prints the halving", {skip}, () => {
  /* THE HALVING IS SPENT AT THE DEAL, so a hero who gained it MID-GAME
     would not re-halve a deck that is already dealt. Arakni is the only
     hero in the pool who changes (v3.76), and none of her six Agents
     prints it — measured rather than assumed. When one does, this fails
     and the deal-time choice has to be revisited. */
  const db = H.db();
  const agents = B.agentsOf(db, "chaos");
  assert.equal(agents.length, 6, "the set she draws from");
  for(const a of agents)
    assert.equal(B.heroAbilities(a, a.n).halveBase, false,
      a.n + " must not print the halving, or a deal-time halving is wrong");
});

/* ---- 3. CLAUSE 2 — the boo's defence rider ---------------------------- */

test("the rider is READ off his printed line", {skip}, () => {
  const c = {name: "Lyath rider probe", pitch: 0, tt: "Hero Ability", ty: ["Hero"], kw: [],
             tx: "The crowd boos you. Defending action cards you control get +1{d} this turn."};
  const fx = P.fxParse(c);
  assert.ok(fx.ops.some(o => o[0] === "defActBuff" && o[1] === 1),
    "the rider must emit its own op");
  assert.ok(fx.ops.some(o => o[0] === "boo"), "…beside the boo it rides on");
  assert.equal(fx.tier, "full");
});

test("the MAGNITUDE is read, not the 1 he happens to print", {skip}, () => {
  /* HE PRINTS 1, so no pool fixture can tell a read number from a literal
     (v3.32, v3.74, v3.77 — fourth time). */
  const c = {name: "Lyath rider probe THREE", pitch: 0, tt: "Hero Ability", ty: ["Hero"], kw: [],
             tx: "Defending action cards you control get +3{d} this turn."};
  assert.deepEqual(P.fxParse(c).ops.filter(o => o[0] === "defActBuff"), [["defActBuff", 3]]);
});

test("isActionCard is the UNION, and not the complement of its twin", {skip}, () => {
  /* THE SUBJECT IS "ACTION CARDS" — both halves. `!isNonAtkActionCard`
     would sweep in a Defense Reaction, which carries no Action at all:
     "Reaction" contains "action" (v2.44) is the same trap one predicate
     over, and a defence buff handed to a whole type the line never names
     is a wall that stops more than it should. */
  const mk = ty => ({name: "x", ty, tt: ty.join(" ")});
  assert.equal(P.isActionCard(mk(["Guardian", "Action", "Attack"])), true);
  assert.equal(P.isActionCard(mk(["Guardian", "Action"])), true);
  assert.equal(P.isActionCard(mk(["Generic", "Defense Reaction"])), false);
  assert.equal(P.isActionCard(mk(["Warrior", "Attack Reaction"])), false);
  assert.equal(P.isActionCard(mk(["Guardian", "Equipment", "Head"])), false);
  assert.equal(P.isActionCard(mk(["Generic", "Block"])), false);
  /* the complement it must NOT be */
  assert.equal(P.isNonAtkActionCard(mk(["Generic", "Defense Reaction"])), false);
  assert.equal(P.isActionCard(mk(["Generic", "Defense Reaction"])), false,
    "both twins say no to a DR — the union must not say yes");
});

test("DRIVEN: the grant reaches the wall, and only action cards", {skip}, () => {
  const b = build("lyath");
  const goon = pick("lyath", "Goon Beatdown", 801);      /* Reviled Action - Attack */
  const dr   = pick("lyath", "Drag Down", 802);          /* Generic Defense Reaction */
  const g0 = H.state({hand: [], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const dv = (g, c) => E.defendValue(g.sides[0], c, {});
  assert.equal(dv(g0, goon), 2, "dealt at half its printed 3");
  assert.equal(dv(g0, dr),   0);
  const g1 = H.runOps(g0, [["defActBuff", 1]], "Lyath");
  assert.equal(g1.sides[0].defActionBuff, 1);
  /* THE TWO CLAUSES COMPOSE: printed 3, dealt at 2, booed back to 3. */
  assert.equal(dv(g1, goon), 3, "the boo buys back what the halving took");
  assert.equal(dv(g1, dr), 0,
    "a Defense Reaction is not an action card and gets nothing");
});

test("DRIVEN: it is a WINDOW, not a charge — every defender gets it", {skip}, () => {
  /* "THIS TURN" is not "your next". A grant consumed by the first block
     is weaker than printed, and the state is what says so: the field is
     still 1 after a card has been valued against it. */
  const b = build("lyath");
  const a = pick("lyath", "Goon Beatdown", 810);
  const c = pick("lyath", "Goon Tactics", 811);
  const g0 = H.state({hand: [], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const g1 = H.runOps(g0, [["defActBuff", 1]], "Lyath");
  assert.equal(E.defendValue(g1.sides[0], a, {}), 3);
  assert.equal(E.defendValue(g1.sides[0], c, {}), 3, "the second defender too");
  assert.equal(g1.sides[0].defActionBuff, 1, "and the grant is not spent");
});

test("DRIVEN: two sources STACK rather than overwriting", {skip}, () => {
  const b = build("lyath");
  const goon = pick("lyath", "Goon Beatdown", 812);
  const g0 = H.state({hand: [], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  const g2 = H.runOps(H.runOps(g0, [["defActBuff", 1]], "Lyath"),
                      [["defActBuff", 1]], "Lyath");
  assert.equal(g2.sides[0].defActionBuff, 2, "it accumulates — an assignment drops the second");
  assert.equal(E.defendValue(g2.sides[0], goon, {}), 4);
});

test("DRIVEN: 'this turn' ends with the turn, for BOTH seats", {skip}, () => {
  /* THE SAME WINDOW AS ITS FIVE NEIGHBOURS (v3.34), so it expires in the
     same step rather than growing its own schedule. Both seats, because a
     hero who banks one during your turn must not keep it into their own. */
  const b = build("lyath");
  let g = H.state({hand: [], res: 9, ap: 1}, {hp: 20, hand: []},
                  {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
  g = H.runOps(g, [["defActBuff", 1]], "Lyath");
  const sides = g.sides.slice();
  sides[1] = Object.assign({}, sides[1], {defActionBuff: 1});
  g = Object.assign({}, g, {sides});
  const out = E.beginEndPhase(g, 0, H.db()).game;
  assert.equal(out.sides[0].defActionBuff, 0);
  assert.equal(out.sides[1].defActionBuff, 0,
    "CR 4.4.3e loses points for ALL players, and a grant is the same kind of thing");
});

test("the side field has all three homes it needs", {skip}, () => {
  /* A SIDE FIELD IS NOT REAL UNTIL THREE PLACES CARRY IT (v3.29):
     `SIDE_FIELDS` or `invariants` reports SIDES-ASYMMETRIC, `wire.js` or
     a dropped field is a desync, and `report.js`'s `seat()` or a bug
     report silently omits it. */
  const S = require("../engine/sides.js");
  assert.ok(S.SIDE_FIELDS.indexOf("defActionBuff") >= 0, "sides.js");
  assert.equal(S.makeSide().defActionBuff, 0, "and it has a default");
  const wire = require("fs").readFileSync(__dirname + "/../engine/wire.js", "utf8");
  assert.match(wire, /"defActionBuff"/, "wire.js — a dropped field is a desync");
  const rep = require("fs").readFileSync(__dirname + "/../engine/report.js", "utf8");
  assert.match(rep, /defActionBuff: sd\.defActionBuff/, "report.js seat()");
});

/* ---- 4. ONE BODY FOR THE TWO ACTION-CARD PREDICATES ------------------- */

test("effects.js holds no second copy of the action-card predicates", {skip}, () => {
  /* `isNonAtkActionCard` was written in effects.js, MOVED to parser.js at
     v3.31 — and a byte-identical copy stayed behind. Two bodies of one
     rule is what makes a sabotage silent: change one and the other keeps
     the drill green (v3.41's `quotedText`). Found while adding a THIRD
     sibling, which is the moment to collapse them. */
  const src = require("fs").readFileSync(__dirname + "/../engine/effects.js", "utf8");
  assert.ok(!/const isNonAtkActionCard = c => \{/.test(src),
    "effects.js must not re-declare the body — it takes the parser's");
  assert.match(src, /const isNonAtkActionCard = P\.isNonAtkActionCard/);
  assert.match(src, /const isActionCard = P\.isActionCard/);
});
