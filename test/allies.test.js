/* ============================================================
   AN ALLY IS A PERMANENT THAT ATTACKS (v3.44)

   "Allies do not attack" sat under Known approximations for a dozen
   versions. It was half true: the TABLE could not attack with one at all
   (`judge.legal` had no arena branch, so `find(sd.gear, uid)` missed and
   it answered "no such equipment"), and the trainer had `allySwing` — a
   FABRICATION in the same family as `foeSwing`'s [3,4,5]:

     * it took the printed power straight off the opposing hero's life,
       so there was NO DEFEND STEP and a 7-power Swabbie was unblockable;
     * it charged nothing, though every ally in the pool prints a cost;
     * it set a blanket `spent`, collapsing `{t}` (a STATE, lifted at CR
       4.4.3d) and `Once per Turn` (an ALLOWANCE) into one flag;
     * it dropped the printed go again on Limpit and Cintari Sellsword;
     * it took no action point, and said so in the log.

   THE PARSER WAS NEVER THE GAP. Every ally that can attack prints a
   weapon's grammar exactly — "Action - {r}{r}, {t}: Attack" — so
   `weaponCost` already answered cost, `taps` and `oncePerTurn` correctly
   for all eleven, and had done for years while nothing asked it. The
   ROUTE was missing, on both boards. That is v3.04's shape for the third
   time.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../engine/parser");
const H = require("./helpers/judged.js");
const J = H.J;
const INV = require("../engine/invariants.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* An ally seated in the arena, untapped, with its printed life. */
const arena = (c, o) => {
  const g = H.state(Object.assign({res: 9, ap: 1,
    board: [{card: c, kind: "ally", uid: c.uid, spent: false, life: c.life}]}, o || {}),
    {}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  return g;
};

/* ---- 1. THE READER ---------------------------------------------------- */

test("allyAttack reads every printed ally attack, and refuses one with none", {skip}, () => {
  H.db();
  /* Cost, tap and once-per-turn all come off the printed line — the same
     body `weaponCost` uses for a weapon, because it is the same grammar. */
  assert.deepEqual(P.allyAttack(H.card("Swabbie", 2)),
    {cost: 2, taps: true, oncePerTurn: false, ga: false}, "Action - {r}{r}, {t}: Attack");
  assert.deepEqual(P.allyAttack(H.card("Limpit, Hop-a-long", 2)),
    {cost: 1, taps: true, oncePerTurn: false, ga: true}, "…: Attack. Go again");
  assert.deepEqual(P.allyAttack(H.card("Oysten, Heart of Gold", 2)),
    {cost: 0, taps: true, oncePerTurn: false, ga: false}, "a free tap");

  /* Aether Ashwing prints only "Arcane Barrier 1" — an ally with no
     attack to activate. A reader that answered for it would offer a swing
     that does not exist. */
  const ash = H.card("Aether Ashwing", 0);
  if(ash) assert.equal(P.allyAttack(ash), null, "no printed attack, no attack");
});

test("a card with NO printed power is refused, whatever its line says", {skip}, () => {
  H.db();
  /* Cosmo's text QUOTES a granted ability — "auras you control … are
     weapons with \"Once per Turn Action - {r}: Attack\"" — and
     `weaponCost` matches that quoted text. The power test is what stops a
     powerless card being routed as a swing; judge's own weapon branch
     lacks it and does route Cosmo as one (recorded in HANDOFF.md). */
  const cosmo = H.card("Cosmo, Scroll of Ancestral Tapestry", 0);
  assert.ok(P.weaponCost(cosmo.tx || ""), "the premise: weaponCost DOES match its quoted text");
  assert.equal(P.allyAttack(cosmo), null, "but it prints no power, so it has no attack");
});

/* ---- 2. THE GO AGAIN BELONGS TO THE ABILITY --------------------------- */

test("the ability line's go again does not leak onto the DEPLOY", {skip}, () => {
  H.db();
  /* Limpit prints "Action - {r}, {t}: Attack. Go again". The clause
     splitter breaks on the period, so "Go again" arrives as a clause of
     its own and set `fx.ga` — the CARD's. Driven before the fix,
     DEPLOYING Limpit kept its action point: a free ally out of Gravy
     Bones' own deck, and stronger than printed. */
  P.fxReset();
  const limpit = H.card("Limpit, Hop-a-long", 2);
  const out = H.execute(H.state({hand: [limpit], res: 9, ap: 1}, {}, {turn: 3, actor: 0}),
                        limpit, "hand", 0, {});
  assert.equal(out.sides[0].ap, 0, "the deploy spends the action point like any other play");
});

test("a WEAPON's identical line still goes again — the fix is route-aware", {skip}, () => {
  H.db();
  /* Mark of the Huntsman prints "Once per Turn Action - {r}{r}: Attack.
     Go again" and relies on exactly the `fx.ga` the deploy must not
     inherit. A weapon is never played from hand, so the two cases are
     told apart by the ROUTE and not by the card. Suppressing this is the
     tempting over-fix and it silently costs a real card its keyword. */
  P.fxReset();
  const w = H.card("Mark of the Huntsman", 0);
  const g = arena(w, {board: [], gear: [{...w, uid: "w1"}]});
  assert.equal(H.execute(g, {...w, uid: "w1"}, "weapon", 0, {}).pend.ga, true);
});

test("one ability's go again is not read onto a sibling ability", {skip}, () => {
  H.db();
  /* Cutty Shark prints TWO abilities and only the SECOND carries the
     keyword: "Action - {r}, {t}: Attack" and "Once per Turn Action - {r}:
     Your next ally attack this turn gets +1{p}. Go again". */
  const cs = H.card("Cutty Shark, Quick Clip", 2);
  assert.equal(P.allyAttack(cs).ga, false, "its ATTACK does not go again");
  assert.equal(P.abilityGa(cs), true, "though the card does carry one on an ability line");
  /* AND IT IS DRIVEN, because asking the parser alone cannot tell the two
     apart: `fx.ga` is TRUE for this card (the sibling ability sets it), so
     an ally route that read `fx.ga` instead of the attack ability's own
     line would hand Cutty Shark's ATTACK a go again it does not print —
     stronger than printed, and invisible to a parser-only assertion.
     Sabotaging that line failed no drill until this one existed. */
  P.fxReset();
  assert.equal(P.fxParse(cs).ga, true, "the premise: the CARD carries a go again");
  const out = H.execute(arena(cs), cs, "ally", 0, {});
  assert.equal(out.pend.ga, false, "but its attack does not go again");
});

/* ---- 3. DRIVEN — the attack is a REAL attack -------------------------- */

test("an ally attack costs its printed cost, not the card's deploy cost", {skip}, () => {
  H.db();
  /* `build.js` folds a weapon's activation cost onto its gear entry's
     `.cost`, which is how `effCost` charges a swing. An ally's `.cost` is
     its PLAY cost — Swabbie 3, already spent deploying it — and its
     attack prints {r}{r} on top. Charging both took 5 for a 2-cost
     attack, driven, on the first cut of this. */
  const swab = H.card("Swabbie", 2);
  assert.equal(swab.cost, 3, "the premise: Swabbie's PLAY cost is 3");
  const out = H.execute(arena(swab), swab, "ally", 0, {});
  assert.equal(out.sides[0].res, 7, "9 - 2 for the attack; 6 would be the deploy price again");
});

test("an ally attack goes through the WALL — the fabrication did not", {skip}, () => {
  H.db();
  const swab = H.card("Swabbie", 2);
  const blk = {name: "Plain Blocker", tt: "Generic Action - Attack",
    ty: ["Generic", "Action", "Attack"], tx: "", kw: [], def: 3, uid: "blk1"};
  let g = H.state({res: 9, ap: 1,
      board: [{card: swab, kind: "ally", uid: swab.uid, spent: false, life: 3}]},
    {hand: [blk], hp: 20}, {turn: 3, actor: 0});
  g.builds = [{}, {}];
  let d = H.execute(g, swab, "ally", 0, {});
  assert.equal(d.pend.total, 7, "it declares a real link, not a number off the hero's life");
  d.stack = [...d.stack, {k: "def", uid: "blk1"}];
  const r = H.fx(d, (f, n) => f.resolveStack(n));
  assert.equal(r.sides[1].hp, 16, "7 into a 3 wall is 4 through — the old path dealt all 7");
});

test("the ally stays in the arena and taps; it is never filed to a graveyard", {skip}, () => {
  H.db();
  const swab = H.card("Swabbie", 2);
  const out = H.execute(arena(swab), swab, "ally", 0, {});
  assert.equal(out.sides[0].board.length, 1, "a permanent stays a permanent");
  assert.equal(out.sides[0].board[0].spent, true, "{t} taps it");
  assert.equal(out.sides[0].grave.length, 0,
    "`fileAttack` files nothing on an activation route — same as a weapon staying equipped");
});

test("the action point is charged at RESOLUTION, and go again keeps it", {skip}, () => {
  H.db();
  /* Both fall out of the shared `pend` path rather than being restated —
     the old `allySwing` charged no action point at all and said so. */
  for(const [nm, wantAp] of [["Swabbie", 0], ["Limpit, Hop-a-long", 1]]){
    const c = H.card(nm, 2);
    const r = H.fx(H.execute(arena(c), c, "ally", 0, {}), (f, n) => f.resolveStack(n));
    assert.equal(r.sides[0].ap, wantAp, nm + ": ap after resolving");
  }
});

/* ---- 4. THE ROUTE EXISTS AT THE TABLE --------------------------------- */

test("judge routes an ally attack, and the state stays legal", {skip}, () => {
  H.db();
  const swab = H.card("Swabbie", 2);
  let g = arena(swab, {name: "Gravy", deck: [{uid: "d1", name: "F"}], ap: 3});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4, turnPlayer: 0};
  assert.equal(J.legal(g, {t: "activate", uid: swab.uid}, 0), null,
    "refused: " + J.legal(g, {t: "activate", uid: swab.uid}, 0));
  const r = J.reduce(g, {t: "activate", uid: swab.uid}, 0);
  assert.equal(r.error, null);
  assert.equal(r.state.sides[0].res, 7, "the table charges the attack's cost");
  assert.equal(r.state.pend.total, 7, "and declares a real link");
  assert.deepEqual(INV.errors(r.state), [], "no invariant is broken by an ally leaving no zone");
});

test("a tapped ally is refused, and the refusal names the reason", {skip}, () => {
  H.db();
  const swab = H.card("Swabbie", 2);
  let g = arena(swab, {name: "Gravy", deck: [{uid: "d1", name: "F"}], ap: 3});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4, turnPlayer: 0};
  g.sides[0].board[0].spent = true;
  assert.match(String(J.legal(g, {t: "activate", uid: swab.uid}, 0)), /tapped/,
    "a tap is lifted at CR 4.4.3d, not by a per-turn allowance");
});

test("an unaffordable ally attack is refused, never offered", {skip}, () => {
  H.db();
  /* v2.45's rule: an unaffordable play declared legal opens a payment
     whose only exit is cancel. `payCeiling` is what makes "cannot raise
     it" mean it. */
  const swab = H.card("Swabbie", 2);
  let g = arena(swab, {name: "Gravy", deck: [], hand: [], res: 0, ap: 3});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: [], turn: 4, turnPlayer: 0};
  assert.match(String(J.legal(g, {t: "activate", uid: swab.uid}, 0)), /cannot raise it/);
});

/* ---- 5. THE PAYOFF ---------------------------------------------------- */

test("Avast Ye! finally fires: its grant AND its rider reach a real ally attack", {skip}, () => {
  H.db();
  /* The card this whole thread started from. v3.42 built its rider,
     v3.43 stopped a DEPLOY eating the grant, and until an ally could
     attack there was still nothing for it to land on. This is the first
     time all three halves meet — and it uses the real cards, in the deck
     they share, rather than a synthetic fixture. */
  P.fxReset();
  const avast = H.card("Avast Ye!", 3), swab = H.card("Swabbie", 2);
  let g = arena(swab, {hand: [avast]});
  g = H.execute(g, avast, "hand", 0, {});
  assert.equal(g.sides[0].gaNextQ.length, 1, "the grant waits");

  const hit = H.execute(g, swab, "ally", 0, {});
  assert.equal(hit.pend.ga, true, "a Pirate ally ATTACK is what the line named");
  assert.deepEqual(hit.pend.onHit, [["token", "gold", 1, "self"]], "and the rider rides with it");

  const landed = H.fx(hit, (f, n) => f.resolveStack(n));
  assert.equal(landed.sides[1].hp, 13, "Swabbie's 7 lands");
  assert.ok(landed.sides[0].board.some(b => /gold/i.test(b.card.name)),
    "and the Gold token the rider promised is really on the board");
});
