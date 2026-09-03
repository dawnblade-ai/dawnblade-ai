/* ============================================================
   TWO REFUSALS THAT WERE WAITING ON MACHINERY ALREADY BUILT (v3.91)

   v3.47's rule: when you build a mechanic, sweep the refusals that were
   waiting on it. Both of these needed NOTHING new — what they needed was
   for somebody to ask.

     Agile Engagement   "Target Warrior attack gets +3{p}. If it is
                         defended by an attack action card, create an
                         Agility token."
     Turn to Mindfire   "Deal 5 arcane damage to any target. If this deals
                         damage, you may {t} your hero. If you do, create
                         a Ponder token."

   AGILE ENGAGEMENT asks the wall the identical question Boltyn's clause 1
   asks (v3.74), and both boards already compute it — what was missing is
   that `attackRx` was handed the wall as a COUNT and not as CARDS, which
   v3.89 fixed for Shred.

   TURN TO MINDFIRE needs two records that both existed: `_dmgWay` (v3.62,
   set INSIDE `arcaneHit`'s `left > 0` branch, so CR 7.5.5's "prevented is
   not dealt" governs it without being restated) and `heroTapped` (v3.48).

   A HERO TAP IS NOT A PERMANENT'S TAP. `weaponUsed[uid]` is a per-turn
   ALLOWANCE lifted at every turn boundary; `heroTapped` is a STATE only
   the controller's own untap step lifts (CR 4.4.3d). They coincide for a
   hero using its own ability and come apart the moment an opponent taps
   you — using the wrong one makes this cost payable again on their turn.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const J = require("../engine/judge.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

/* ---- AGILE ENGAGEMENT ----------------------------------------------- */

test("Agile Engagement reads in full, at every printed pitch", {skip}, () => {
  H.db();
  const got = [1, 2, 3].map(p => { P.fxReset(); return P.fxParse(H.card("Agile Engagement", p)); });
  assert.deepEqual(got.map(f => f.tier), ["full", "full", "full"]);
  /* THE PUMP IS READ, AND THE POOL PROVES IT: +3 / +2 / +1 by pitch. */
  assert.deepEqual(got.map(f => f.self), [3, 2, 1]);
  got.forEach(f => assert.deepEqual(f.conds,
    [{cond: "defAtkAction", op: ["token", "agility", 1, "self"], instead: false, atkHero: false}]));
});

function agile(defs){
  H.db(); P.fxReset();
  const ae = Object.assign({}, H.card("Agile Engagement", 1), {uid: 1201});
  const warAtk = Object.assign({}, H.card("Wounding Blow", 1),
    {uid: 1202, tt: "Warrior Action - Attack", ty: ["Warrior", "Action", "Attack"]});
  const g0 = H.state({hand: [ae], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: warAtk, by: 0, total: warAtk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) => {
    const r = fx.attackRx(s, ae, {handBlockers: defs.length, defenders: defs});
    return {game: r.game, _p: r.pump, _w: r.why};
  });
  const n = out.game || out;
  return {pump: out._p, why: out._w,
          board: (n.sides[0].board || []).map(b => b.card.name), game: n};
}

test("the token lands only when an ATTACK ACTION card defends", {skip}, () => {
  H.db();
  const atkAction = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 1203});
  const plainAction = {uid: 1204, name: "Plain Action", tt: "Generic Action",
    ty: ["Generic", "Action"], pitch: 1, cost: 1, power: 0, def: 3, tx: "", kw: []};
  assert.ok(P.isAtkActionCard(atkAction), "the premise");
  assert.ok(!P.isAtkActionCard(plainAction), "…and the control is not one");

  const hit = agile([atkAction]), miss = agile([plainAction]), none = agile([]);
  assert.deepEqual(hit.board, ["Agility"]);
  assert.deepEqual(miss.board, [], "a defender that is not an attack action grants nothing");
  assert.deepEqual(none.board, [], "and neither does an empty wall");
  /* THE PUMP IS UNCONDITIONAL — it lands whatever the wall is. Without
     this the drill above passes just as well against a reaction that
     refuses outright. */
  assert.equal(hit.pump, 3);
  assert.equal(miss.pump, 3);
  assert.equal(none.pump, 3);
});

test("a caller that says nothing answers NO", {skip}, () => {
  /* WHICH CARDS DEFEND is the caller's answer (v3.11, v3.24, v3.27), and
     the absent answer is the weaker, VISIBLE one. */
  H.db(); P.fxReset();
  const ae = Object.assign({}, H.card("Agile Engagement", 1), {uid: 1205});
  const warAtk = Object.assign({}, H.card("Wounding Blow", 1),
    {uid: 1206, tt: "Warrior Action - Attack", ty: ["Warrior", "Action", "Attack"]});
  const g0 = H.state({hand: [ae], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: warAtk, by: 0, total: warAtk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.attackRx(s, ae, {}).game}));
  assert.deepEqual(((out.game || out).sides[0].board || []), []);
});

test("the generic condition loop does NOT answer it", {skip}, () => {
  /* It is given no wall at all, so it could only ever answer FALSE — and
     then say so, before the route that CAN answer runs. That is v3.60's
     sev-2 category, so `defAtkAction` is in `RX_CONDS` beside `reprise`
     and `charged`. */
  H.db(); P.fxReset();
  const ae = Object.assign({}, H.card("Agile Engagement", 1), {uid: 1207});
  const atkAction = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 1208});
  const warAtk = Object.assign({}, H.card("Wounding Blow", 1),
    {uid: 1209, tt: "Warrior Action - Attack", ty: ["Warrior", "Action", "Attack"]});
  const g0 = H.state({hand: [ae], res: 9, ap: 1}, {hp: 20},
                     {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: warAtk, by: 0, total: warAtk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  const out = J.withEffects(g, (fx, s) =>
    ({game: fx.execute(s, ae, "hand", 0, {handBlockers: 1, defenders: [atkAction]})}));
  const feed = ((out.game || out).feed || []).join(" | ");
  assert.doesNotMatch(feed, /condition not met \(defAtkAction\)/);
  assert.match(feed, /an attack action card defends/);
  assert.deepEqual(((out.game || out).sides[0].board || []).map(b => b.card.name), ["Agility"],
    "…and the whole thing works through the real entry point");
});

/* ---- TURN TO MINDFIRE ------------------------------------------------ */

test("Turn to Mindfire reads in full", {skip}, () => {
  H.db(); P.fxReset();
  const fx = P.fxParse(H.card("Turn to Mindfire", 1));
  assert.equal(fx.tier, "full");
  assert.deepEqual(fx.ops, [["arcane", 5]]);
  assert.deepEqual(fx.tapCost, {when: "dealt", ops: [["token", "ponder", 1, "self"]]});
});

test("a payload that is not RUNNABLE refuses the whole clause", {skip}, () => {
  /* TWO WAYS TO FAIL, AND THE GUARD MUST CATCH BOTH — the same fixture
     flaw v3.90's mill drill had. A payload `classifyClause` cannot read
     comes back NULL; one it reads as a `noop` comes back WITH a status,
     and a noop payload is a cost with no reward. Testing only the null
     case leaves the status test SILENT under sabotage. */
  P.fxReset();
  const mk = (nm, pay) => P.fxParse({name: nm, pitch: 1, cost: 2, power: null, def: 2,
    tt: "Wizard Action", ty: ["Wizard", "Action"], kw: [],
    tx: "Deal 5 arcane damage to any target.\nIf this deals damage, you may {t} your "
      + "hero. If you do, " + pay + "."});
  assert.equal(P.classifyClause("banish your opponent's imagination"), null);
  assert.equal(mk("TM null", "banish your opponent's imagination").tapCost, null);
  assert.equal(P.classifyClause("intimidate").status, "noop");
  assert.equal(mk("TM noop", "intimidate").tapCost, null,
    "a noop payload is a cost with no reward");
});

function mindfire(o){
  o = o || {};
  H.db(); P.fxReset();
  const tm = Object.assign({}, H.card("Turn to Mindfire", 1), {uid: 1301});
  const g = H.state({hand: [tm], res: 9, ap: 1, heroTapped: !!o.tapped},
                    {hp: 20, arcShield: o.shield || 0},
                    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const out = J.withEffects(g, (fx, s) => ({game: fx.execute(s, tm, "hand", 0, {})}));
  let n = out.game || out;
  const opened = !!n.prompt;
  if(opened){
    n = o.decline
      ? J.reduce(n, {t: "promptDecline"}, n.prompt.side).state
      : J.reduce(n, {t: "promptChoose", choice: "pay"}, n.prompt.side).state;
    n = J.reduce(n, {t: "promptConfirm"}, n.prompt.side).state;
  }
  return {opened, hp: n.sides[1].hp, tapped: !!n.sides[0].heroTapped,
          board: (n.sides[0].board || []).map(b => b.card.name),
          allowance: n.sides[0].weaponUsed || {}, game: n};
}

test("driven: pay the tap and take the token", {skip}, () => {
  const r = mindfire();
  assert.equal(r.opened, true);
  assert.equal(r.hp, 15, "the arcane lands first");
  assert.equal(r.tapped, true);
  assert.deepEqual(r.board, ["Ponder"]);
});

test("declining spends nothing and grants nothing", {skip}, () => {
  const r = mindfire({decline: true});
  assert.equal(r.tapped, false, "a 'you may' may be refused");
  assert.deepEqual(r.board, []);
  assert.equal(r.hp, 15, "and the card's own damage still happened");
});

test("a hero already tapped is never offered the sheet", {skip}, () => {
  /* v3.48's ruling is exactly this narrow: a tapped hero "cannot be
     tapped again to pay a cost". A sheet with no legal answer is a tap
     that teaches nothing. */
  const r = mindfire({tapped: true});
  assert.equal(r.opened, false);
  assert.deepEqual(r.board, []);
});

test("PREVENTED IS NOT DEALT — a fully shielded hit offers nothing", {skip}, () => {
  /* CR 7.5.5, and it is not restated here: `_dmgWay` is recorded INSIDE
     `arcaneHit`'s `left > 0` branch (v3.62), so the gate falls out of
     where the trace lives rather than out of a second check. */
  const r = mindfire({shield: 9});
  assert.equal(r.hp, 20, "nothing landed");
  assert.equal(r.game._dmgWay, 0);
  assert.equal(r.opened, false, "…so there is nothing to pay for");
});

test("the tap is `heroTapped`, NOT the per-turn allowance", {skip}, () => {
  /* THE TWO RECORDS EXPIRE DIFFERENTLY (v3.48). `weaponUsed[uid]` comes
     back at every turn boundary, for BOTH seats; `heroTapped` is lifted
     only by the controller's own untap step (CR 4.4.3d). Writing the
     wrong one makes this cost payable again on the opponent's turn. */
  const r = mindfire();
  assert.equal(r.tapped, true);
  assert.deepEqual(Object.keys(r.allowance), [],
    "nothing was written to the per-turn allowance");
});

test("`tapHero` is carried by buildPrompt — a dropped field is a free cost",
     {skip}, () => {
  /* A SPEC ONLY CARRIES FIELDS `buildPrompt` KNOWS ABOUT (v2.34, v3.33,
     v3.53). Threaded through and forgotten there, the tap is free and the
     rider fires anyway. */
  const PM = require("../engine/prompts.js");
  const g = {sides: [{res: 9, hand: []}, {}], turn: 1};
  const p = PM.buildPrompt(g, {tag: "pay", side: 0, src: "X", cost: 0,
                               tapHero: true, ops: [["draw", 1]]});
  assert.equal(p.tapHero, true);
  const paid = PM.applyPrompt(g, {...p, choice: "pay"});
  assert.equal(paid.tapHero, true, "and the answer reports it");
  const dec = PM.applyPrompt(g, {...p, choice: "decline"});
  assert.ok(!dec.tapHero, "…only when it was actually paid");
});
