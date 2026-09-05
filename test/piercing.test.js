/* ============================================================
   PIERCING N — A KEYWORD IN THE VOCABULARY THAT NOTHING CONSUMED (v4.20)

   `piercing` sat in `parser.js`'s `KW_VOCAB_SRC` — so `printedKw` could
   answer for it, and a card could be qualified "with piercing" — while
   NOTHING in the engine read it. `tools/ledger.js` said `unreviewed`,
   with the note "seen in pool; needs CR wording".

   TRY THE PRINTING BEFORE BOOKING A QUESTION (v3.32, v3.54, v3.66, v3.78,
   v3.99 — sixth time it has paid). The database carries no reminder text
   for any keyword, and `card.printings[].image_url` is in the pool record.
   The AAZ010 face of Drill Shot prints the parenthetical:

     "If this has an aim counter, it gets **piercing 1**.
      (If this is defended by an EQUIPMENT, this gets +1{p}.)"

   So piercing N is a conditional pump settled at the WALL, and it is
   `perEquipDef`'s FLAT twin — Fender Bender's is +N for EACH equipment,
   this is +N if there is at least one. The reader is the same site in
   `linkPumps`, and `equipDefenders` has been the caller's answer from
   BOTH boards since it was written.

   TWO POOL CARDS GRANT IT, BOTH DECKED, AND NEITHER DID ANYTHING:

     Drill Shot   Azalea      gated on an aim counter   read `tier: part`
     Puncture     Dorinthea   granted to the TARGET     read `tier: full`

   Puncture is the more dangerous of the two — the +3 landed and the
   piercing was silently dropped, so coverage called the card fully
   scripted. WEAKER than printed, which the one-sided fairness sweep is
   built not to look for.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* ---- 1. THE READER -------------------------------------------------- */

test("both printed shapes read, and the restriction rides on BOTH ops", {skip}, () => {
  /* DRILL SHOT — gated, granting to ITSELF. */
  P.fxReset();
  const ds = P.fxParse(H.card("Drill Shot", 1));
  assert.deepEqual(ds.conds.map(e => [e.cond, e.op]), [["aim", ["piercing", 1]]],
    "the aim gate carries the piercing, and the card leaves `part`");

  /* PUNCTURE — granting to the TARGET of an attack reaction. The printed
     restriction ("sword or dagger") must ride on the piercing as well as
     on the pump: a grant with no qualifier matches everything (v3.43), so
     dropping it here would pierce with a bow. */
  P.fxReset();
  const pu = P.fxParse(H.card("Puncture", 1));
  /* THE TWO OPS END UP IN DIFFERENT PLACES, and asserting `ops` alone
     misses half of it: `fxParse` lifts a targeted `self` into `fx.self` +
     `fx.selfQ` and leaves everything else in `ops`. The claim is that the
     printed restriction rides on BOTH carriers. */
  const Q = {g: [["sword"], ["dagger"]]};
  assert.equal(pu.self, 3, "the pump");
  assert.deepEqual(pu.selfQ, Q, "restricted");
  assert.deepEqual(pu.ops, [["piercing", 1, Q]],
    "and the piercing is a second op carrying the SAME restriction");
});

test('the "and" tail is a CLOSED set of two, never "and anything"', {skip}, () => {
  /* THE NEAR-MISSES ARE REAL POOL CARDS. Scar Tissue and Spike with
     Bloodrot print "gets +3{p} and \"When this hits a hero, …\"" — the
     same grammar with a QUOTED ABILITY after the "and", which has its own
     reader (v3.45) and must not be read as a keyword grant. */
  for(const nm of ["Scar Tissue", "Spike with Bloodrot"]){
    P.fxReset();
    const fx = P.fxParse(H.card(nm, 1));
    assert.ok(fx.self > 0, nm + " still reads its pump");
    assert.ok(!(fx.ops || []).some(o => o[0] === "piercing"),
      nm + " prints no keyword after its \"and\" and must not be granted one");
    assert.equal(fx.ga, false, nm + " gains no go again either");
  }
});

/* THE AMOUNT IS THE CARD'S OWN NUMBER. Both pool cards print 1, so no
   pool fixture can tell a read number from a hardcoded one — the drill is
   synthetic (v3.32, v3.55, v3.88; sixth outing of that rule). */
test("the magnitude is READ off the printed line", {skip}, () => {
  P.fxReset();
  const three = P.fxParse({name: "SYN-PIERCE-3", pitch: 1, cost: 1, power: 4,
    tt: "Ranger Action - Arrow Attack", ty: ["Ranger", "Action", "Attack"],
    tx: "If this has an aim counter, it gets piercing 3.", kw: [], gkw: []});
  assert.deepEqual(three.conds.map(e => e.op), [["piercing", 3]],
    "a card printing 3 grants 3");
});

/* ---- 2. DRIVEN — the whole truth table ------------------------------ */

const drill = (aim, eq) => {
  H.db();
  const atk = {...H.card("Drill Shot", 1), uid: 81};
  const g = H.state({res: 9, ap: 1, counters: aim ? {81: {aim: 1}} : {}},
                    {}, {turn: 3, actor: 0, turnPlayer: 0});
  const out = J.withEffects({...g, stack: [], chain: []},
    (fx, s) => fx.execute(s, atk, "hand", 0));
  const pre = J.withEffects(out, (fx, s) => fx.linkPumps(s, {equipDefenders: eq}));
  return {total: pre.total, base: atk.power};
};

test("DRIVEN: the aim gate AND the equipment gate both hold", {skip}, () => {
  /* SIX ROWS, BECAUSE THERE ARE TWO GATES. A drill that varies only one
     of them cannot tell "the piercing fired" from "the aim counter did" —
     v3.26's rule about a fixture that cannot separate two halves. */
  for(const [aim, eq, want] of [
    [false, 0, 0], [false, 1, 0], [false, 2, 0],
    [true,  0, 0], [true,  1, 1], [true,  2, 1],
  ]){
    const {total, base} = drill(aim, eq);
    assert.equal(total - base, want,
      `aim=${aim} equipment=${eq}: the printed line grants ${want}`);
  }
});

test("DRIVEN: piercing is FLAT, where Fender Bender's is PER equipment", {skip}, () => {
  /* THE ROW THAT SEPARATES THE TWO OPS. The printed parenthetical says
     "if this is defended by AN equipment", so the count is a yes/no —
     multiplying by it would be `perEquipDef`, which is a different card
     (Fender Bender) reading the same fact. A drill at 0 and 1 equipment
     agrees under both readings; only the 2-equipment row tells them
     apart. */
  assert.equal(drill(true, 1).total, drill(true, 2).total,
    "two blocking pieces grant no more than one");
  assert.equal(drill(true, 3).total - drill(true, 3).base, 1,
    "and three grant no more than one either");
});

test("DRIVEN: Puncture grants it to the TARGET, through the reaction route",
     {skip}, () => {
  /* v3.89 — a played attack reaction is routed by its WINDOW, so this
     goes through `execute` rather than being handed to `attackRx`
     directly: sixteen drills that called `attackRx` directly all passed
     while the card did nothing at the table. */
  H.db();
  const dagger = {name: "SYN-PIERCE-DAGGER", pitch: 0, cost: 0, power: 3,
    tt: "Assassin Weapon - Dagger", ty: ["Assassin", "Weapon", "Dagger"],
    tx: "", kw: [], gkw: [], uid: 91};
  const punc = {...H.card("Puncture", 1), uid: 92};
  const at = eq => {
    const g = {...H.state({res: 9, ap: 1}, {}, {turn: 3, actor: 0, turnPlayer: 0}),
      stack: [{k: "atk", label: "x"}],
      pend: {card: dagger, from: "weapon", by: 0, total: 3, ga: false, ops: [],
             onHit: [], onHitHero: [], condOnHit: [], lateConds: [], lateOps: [],
             _qCtx: {atk: true}}};
    const out = J.withEffects(g, (fx, s) => fx.execute(s, punc, "hand", 0));
    return J.withEffects(out, (fx, s) => fx.linkPumps(s, {equipDefenders: eq})).total;
  };
  assert.equal(at(0), 6, "no equipment defending — the +3 alone");
  assert.equal(at(1), 7, "an equipment blocks — the printed piercing lands too");
  assert.equal(at(2), 7, "and it is flat here as well");
});

test("piercing needs an attack of YOUR OWN in flight", {skip}, () => {
  /* `atkMinus` is the hostile twin one field over and tests the same
     thing with the opposite sign; a bonus landing on the opponent's swing
     would help them. A caller with no attack in flight gets a feed line
     and no grant — weaker than printed and visible (v3.24). */
  H.db();
  const g = H.state({res: 9}, {}, {turn: 3, actor: 0});
  const out = J.withEffects({...g, pend: null},
    (fx, s) => fx.runOps(s, [["piercing", 2]], "SRC"));
  assert.equal(out.pend, null, "nothing is invented to hold the grant");

  /* AND NOT ONTO THE OPPONENT'S. `pend.by` is the declarer. */
  const foeSwing = {...H.state({res: 9}, {}, {turn: 3, actor: 0}),
    pend: {card: {name: "THEIRS", power: 3}, by: 1, total: 3, lateOps: []}};
  const out2 = J.withEffects(foeSwing, (fx, s) => fx.runOps(s, [["piercing", 2]], "SRC"));
  assert.deepEqual(out2.pend.lateOps, [],
    "their attack does not collect a grant of ours");
});
