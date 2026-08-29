/* ============================================================
   A CONDITIONAL WEAPON STATIC — "if <X>, this card's attacks get <Y>".

   Three pool cards print it, and all three are weapons:

     Mandible Claw       if you've discarded a 6+ {p} card this turn
     Searing Emberblade  if you control 2 or more Draconic chain links
     Star Fall           if you've played a Lightning card this turn

   ONE OF THEM WAS SPECIAL-CASED BY NAME. Mandible Claw's rider was an
   inline `from === "weapon"` regex in `execute`, with a matching `noop`
   in `classifyClause` whose reason pointed at that line — so the clause
   fired and still reported unread, and the other two cards were dead.
   That is the golden rule broken twice: a card handled by name, and a
   `noop` filed for text that has real behaviour.

   NOTHING NEW RUNS IT. `execute`'s condition loop already treats `ga` and
   `self` specially, and a weapon swing goes through `execute` with
   `attacking` true — so the payload reads as ordinary ops and the
   existing gate machinery applies them at the swing.

   THESE ASSERT ON THE CHAIN LINK, not on feed prose.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const S = require("../engine/sides.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const cc = t => P.classifyClause(t);

/* ---- 1. THE READING ---------------------------------------------- */

test("all three printed conditions read, and carry `wpnOnly`", () => {
  const claw = cc("If you've discarded a card with 6 or more {p} this turn, this card's attacks get go again");
  assert.deepEqual(claw.ops, [["ga"]]);
  assert.equal(claw.cond, "discard6");
  assert.equal(claw.wpnOnly, true);

  const blade = cc("If you control 2 or more Draconic chain links, this card's attacks get go again");
  assert.equal(blade.cond, "drac2");

  const star = cc("If you've played a Lightning card this turn, this card's attacks get +1{p} and go again");
  assert.deepEqual(star.ops, [["self", 1], ["ga"]], "both halves of the payload");
  assert.equal(star.cond, "playedCls:lightning", "the CLASS is captured off the card");
});

test("an unreadable payload refuses the clause", () => {
  assert.equal(cc("If you control 2 or more Draconic chain links, this card's attacks get ineffable"), null,
    "the whole clause stays unclaimed rather than the gate firing a guess");
});

test("`wpnOnly` appears ONLY on the entries that carry it", {skip}, () => {
  /* `instead` and `atkHero` are on every cond entry; a fourth
     always-present key changes the shape of every cond in the pool, and
     five drills that deepEqual `fx.conds` went red on cards printing no
     weapon static at all. Those drills are right to compare the whole
     object. */
  P.fxReset();
  const star = P.fxParse(H.card("Star Fall", 0));
  assert.equal(star.conds.find(x => x.cond === "playedCls:lightning").wpnOnly, true);
  const other = P.fxParse(H.card("Wild Ride", 1));
  for(const c of (other.conds || []))
    assert.ok(!("wpnOnly" in c), "a card with no weapon static carries no such key");
  P.fxReset();
});

test("all three cards resolve in full", {skip}, () => {
  for(const nm of ["Mandible Claw", "Searing Emberblade", "Star Fall"]){
    P.fxReset();
    assert.equal(P.fxParse(H.card(nm, 0)).tier, "full", nm);
  }
  P.fxReset();
});

/* ---- 2. DRIVEN, THROUGH THE SHARED `execute` --------------------- */

function swing(playTy, from){
  H.db();
  const wep = Object.assign({}, H.card("Star Fall", 0), {uid: "sf1", cost: 1});
  const g = H.state({name: "Viserai", res: 9, ap: 3, gear: [wep], hand: [],
                     deck: [{uid: "d1", name: "T"}], counters: {},
                     hist: Object.assign(S.freshHist(), {playTy})},
                    {name: "Them", hp: 20, deck: [{uid: "d2", name: "T2"}]},
                    {actor: 0, turnPlayer: 0, seed: "sf", turn: 4});
  return H.execute(g, wep, from, 0, {});
}

test("driven: the bonus lands on the swing when the condition holds", {skip}, () => {
  const met = swing([["lightning", "instant"]], "weapon");
  assert.equal(met.pend.total, 2, "printed 1, +1{p} from the static");
  assert.equal(met.pend.ga, true);
});

test("driven: and NOT when it does not — the gate is real", {skip}, () => {
  const unmet = swing([], "weapon");
  assert.equal(unmet.pend.total, 1, "the printed power, unmodified");
  assert.equal(unmet.pend.ga, false);
});

test("driven: a class that is not the printed one does not satisfy it", {skip}, () => {
  /* AN EMPTY HISTORY CANNOT TELL "it checked the class" FROM "it checked
     for anything at all" — a fixture where two things coincide has tested
     neither (v3.26). */
  const wrong = swing([["ice", "instant"]], "weapon");
  assert.equal(wrong.pend.total, 1);
  assert.equal(wrong.pend.ga, false);
});

test("driven: `wpnOnly` — the same piece activated as a NON-attack gets nothing", {skip}, () => {
  /* "This card's ATTACKS get …" is about the swing, not the card. Without
     the gate the bonus would follow the piece onto its activated-ability
     route, which is the wrong route — the distinction v3.44 had to make
     for allies. */
  /* ASSERT ON THE ACTION POINT, NOT ON THE FEED. Written against feed
     prose this drill passed with the gate REMOVED — the ability route
     prints no "goes again" line either way, so the prose could not tell
     the two apart. Go again is a GAIN (CR 5.3.5), so the observable is
     `ap`: with the gate gone the met case would keep a point the unmet
     case spends, and the two diverge. */
  const met   = swing([["lightning", "instant"]], "hero");
  const unmet = swing([], "hero");
  assert.ok(!met.pend, "an ability activation opens no chain link");
  assert.equal(met.sides[0].ap, unmet.sides[0].ap,
    "the static must not fire on the ability route — go again is an action " +
    "point gained, so a leaked bonus shows up here");
});
