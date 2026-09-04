/* ============================================================
   THE SECOND, SMALLER COPY OF A CONDITION VOCABULARY (v3.96)

   `fx.condOnHit` is a conditionally GRANTED on-hit ability (v3.10), and
   it is re-checked at the HIT rather than at declaration — so it has its
   own evaluator inside `linkPayload`, a much smaller copy of the
   vocabulary `execute`'s condition loop answers. The parser emits into
   both, and NOTHING WAS COMPARING THEM.

   MEASURED BY ASKING THE PARSER, not by reading either list: SEVEN
   conditions reach `condOnHit` across the pool, and the evaluator knew
   FOUR. Three cards were granted an ability that then refused itself:

     Goon Beatdown      `auras3`  the crowd never booed
     Goon Tactics       `auras3`  the mill never happened
     Hot on Their Heels `drac2`   the mark was never applied

   ALL THREE READ `tier: full`, because the HEAD parses — the +3{p}, the
   go again. The no-op blind spot, one layer inside a granted ability.

   `CONDONHIT_CONDS` IS THE CENSUS NOW, and a drill fails if the pool ever
   emits a condition it does not name. That is v3.35's fix for
   `PENDING_KINDS` and v3.91's for the attack-reaction condition list: a
   census catches the next arrival, where a blacklist walks into the same
   silent fallback.

   AND THE THREE PAYLOADS ARE THIS VERSION'S OTHER HALF — `foeArsBanish`
   (Mark of the Funnel Web) and `foeDeckDestroy` (Goon Tactics' rider),
   the twins of ops that were already there.
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

const aura = i => ({uid: "au" + i, kind: "aura", spent: false,
  card: {name: "A" + i, uid: "au" + i, tt: "Generic Token - Aura",
         ty: ["Generic", "Token", "Aura"], tx: "", kw: []}});

/* A REAL PLAY, then a real hit — the whole point is that these gates are
   answered where the ability actually fires, not where a drill says so. */
function hit(nm, pitch, o){
  o = o || {};
  P.fxReset();
  const c = Object.assign(H.card(nm, pitch), {uid: "atk1"});
  const board = []; for(let i = 0; i < (o.auras || 0); i++) board.push(aura(i));
  const chain = []; for(let i = 0; i < (o.drac || 0); i++) chain.push({n: "d" + i, kind: "atk", drac: true});
  let g = H.state({name: "Alice", hand: [c], res: 9, ap: 1, board},
                  Object.assign({name: "Bob", hp: 20, marked: !!o.marked,
                                 deck: [junk("Top", "t1"), junk("Next", "t2")]}, o.foe || {}),
                  {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain}),
                               c, "hand", 0, {}));
  assert.ok(out.pend, nm + " opened a link");
  return unwrap(H.fx(out, (fx, m) => {
    const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
    return r.game || r;
  }));
}
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

/* ---- 1. THE CENSUS ---------------------------------------------------- */

test("every condition the POOL puts into condOnHit is in the census", {skip}, () => {
  /* THE MEASUREMENT THAT FOUND THE GAP, kept as the guard. A condition
     the parser emits and the evaluator does not know answers FALSE —
     silently, correctly (v3.26), and with the card doing nothing. */
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const seen = new Set();
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    for(const e of (fx.condOnHit || [])) seen.add(e.cond);
  }
  /* SIX AS OF v3.97, not seven: `fused` left when both cards that emitted
     it were routed to the late `way:` pass instead, because a NON-ATTACK
     opens no `pend` for `condOnHit` to be read from. A condition LEAVING
     is as deliberate an edit as one arriving. */
  assert.deepEqual([...seen].sort(),
    ["auras3", "charged", "chargedPitch2", "drac2", "marked", "pumped"],
    "six conditions reach condOnHit — a SEVENTH is a deliberate edit here " +
    "and a branch in the evaluator");
  /* AND `fused` KEEPS ITS BRANCH, because the pattern list is what makes a
     condition answerable if it ever routes here again — a census that
     shrinks its own vocabulary to match today's pool re-opens the hole. */
  assert.ok(E.condOnHitKnown("fused"), "the evaluator still knows it");
  for(const cond of seen)
    assert.ok(E.condOnHitKnown(cond), cond + " has no pattern in CONDONHIT_CONDS");
});

test("the census refuses what it does not name", {skip}, () => {
  /* Without this it could be widened to `/^/` and pass by matching
     everything — a census that finds nothing, inverted. */
  assert.equal(E.condOnHitKnown("auras3"), true);
  assert.equal(E.condOnHitKnown("drac2"), true);
  assert.equal(E.condOnHitKnown("fused"), true);
  assert.equal(E.condOnHitKnown("way:took"), true);
  assert.equal(E.condOnHitKnown("somethingNobodyBuilt"), false);
  assert.equal(E.condOnHitKnown("auras"), false, "the threshold is part of the name");
  assert.equal(E.condOnHitKnown(""), false);
});

/* ---- 2. THE THREE GATES THAT ANSWERED FALSE -------------------------- */

test("driven: Goon Beatdown's boo fires at three auras and not at one", {skip}, () => {
  const on = hit("Goon Beatdown", 3, {auras: 3});
  assert.equal((on.sides[0].hist || {}).booed, 1, "the crowd boos");
  const off = hit("Goon Beatdown", 3, {auras: 1});
  assert.ok(!(off.sides[0].hist || {}).booed, "and does not, below the threshold");
  assert.match(said(off), /3 or more auras on your board/,
    "and the feed names the gate it actually failed");
});

test("driven: Goon Tactics mills the top of THEIR deck at three auras", {skip}, () => {
  const on = hit("Goon Tactics", 3, {auras: 3});
  assert.deepEqual(on.sides[1].deck.map(c => c.name), ["Next"], "one card left the deck");
  assert.deepEqual(on.sides[1].grave.map(c => c.name), ["Top"], "…and reached the GRAVEYARD");
  const off = hit("Goon Tactics", 3, {auras: 1});
  assert.equal(off.sides[1].deck.length, 2, "and nothing at one aura");
});

test("driven: Hot on Their Heels marks at two Draconic links", {skip}, () => {
  const on = hit("Hot on Their Heels", 1, {drac: 2});
  assert.equal(on.sides[1].marked, true);
  const off = hit("Hot on Their Heels", 1, {drac: 0});
  assert.ok(!off.sides[1].marked);
  assert.match(said(off), /2 or more Draconic chain links/);
});

test("FUSED rides on `pend` — it is a declaration-time fact", {skip}, () => {
  /* No board state can answer "was this card fused" at the hit; it is how
     the card was PLAYED. It rides for `chargedPitch`'s reason, and a link
     built without it answers FALSE — weaker than printed and visible. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  assert.match(src, /condOnHit:\[\.\.\.\(fx\.condOnHit\|\|\[\]\), \.\.\.qRiderCond\], chargedPitch, fused,/,
    "the declaration folds it onto the link");
  assert.match(src, /cond==="fused" \? !!n\.pend\.fused/, "and the hit-time gate reads it from there");
});

/* ---- 3. THE TWO PAYLOADS ---------------------------------------------- */

test("BANISH is not DESTROY, and the two arsenal ops differ", {skip}, () => {
  /* Mark of the Funnel Web prints the same sentence as its own sibling
     one verb over, and the verb decides which ZONE the card lands in — a
     destroyed card is in the graveyard, where `retrieve` and every "from
     your graveyard" reader can find it; a banished one is out. */
  assert.deepEqual(P.classifyClause("banish a card in their arsenal"),
    {status: "run", ops: [["foeArsBanish", 1]]});
  assert.deepEqual(P.classifyClause("destroy a card in their arsenal"),
    {status: "run", ops: [["foeArsDestroy", 1]]});
});

test("driven: the two arsenal ops land in DIFFERENT zones", {skip}, () => {
  const base = () => H.state({name: "A"}, {name: "B", arsenal: junk("Set", "s1")}, {turn: 3});
  const ban = unwrap(H.runOps(base(), [["foeArsBanish", 1]], "drill"));
  assert.equal(ban.sides[1].arsenal, null);
  assert.deepEqual(ban.sides[1].banish.map(c => c.name), ["Set"], "banish, not graveyard");
  assert.deepEqual(ban.sides[1].grave.map(c => c.name), []);

  const des = unwrap(H.runOps(base(), [["foeArsDestroy", 1]], "drill"));
  assert.deepEqual(des.sides[1].grave.map(c => c.name), ["Set"], "and the twin still files to the graveyard");
  assert.deepEqual(des.sides[1].banish.map(c => c.name), []);
});

test("driven: Mark of the Funnel Web needs the MARK, and its sibling proves the trigger",
     {skip}, () => {
  /* Mark of the Black Widow has read `full` since the marked trigger was
     built — same hero, same stealth line, same gate — so the ONE gap was
     this payload. Both halves are driven, because a gate that refuses
     everything passes the unmarked case perfectly (v3.45). */
  const on = hit("Mark of the Funnel Web", 1, {marked: true, foe: {arsenal: junk("Set", "s1")}});
  assert.equal(on.sides[1].arsenal, null);
  assert.deepEqual(on.sides[1].banish.map(c => c.name), ["Set"]);

  const off = hit("Mark of the Funnel Web", 1, {marked: false, foe: {arsenal: junk("Set", "s1")}});
  assert.ok(off.sides[1].arsenal, "unmarked, the arsenal is untouched");
  assert.match(said(off), /the target to be marked/);

  const empty = hit("Mark of the Funnel Web", 1, {marked: true, foe: {arsenal: null}});
  assert.equal(empty.sides[1].arsenal, null);
  assert.deepEqual(empty.sides[1].banish.map(c => c.name), [], "an empty arsenal banishes nothing");
});

test("foeDeckDestroy is the FOE twin, and it is not `deckDestroy`", {skip}, () => {
  /* Whose deck is milled is the whole of what the card says, so they are
     two ops rather than one with a side parameter — the same reason
     `revPitch` and `revColorPitch` stay apart. */
  const g = H.state({name: "A", deck: [junk("Mine", "m1")]},
                    {name: "B", deck: [junk("Theirs", "t1")]}, {turn: 3});
  const foe = unwrap(H.runOps(g, [["foeDeckDestroy", 1]], "drill"));
  assert.equal(foe.sides[0].deck.length, 1, "my deck is untouched");
  assert.deepEqual(foe.sides[1].grave.map(c => c.name), ["Theirs"]);

  const mine = unwrap(H.runOps(g, [["deckDestroy", 1]], "drill"));
  assert.deepEqual(mine.sides[0].grave.map(c => c.name), ["Mine"], "and the twin still mills my own");
  assert.equal(mine.sides[1].deck.length, 1);
});

/* ---- 4. THE COST READERS, AND THE MARK DISCOUNT ---------------------- */

test("Stains of the Redback's discount is READ, and the amount is off the line",
     {skip}, () => {
  const c = H.card("Stains of the Redback", 1);
  assert.equal(P.markRed(c), 1, "one pip");
  /* the pool prints one card of the shape, so a synthetic is what tells a
     read number from a literal (v3.32 — eleventh outing) */
  assert.equal(P.markRed(Object.assign({}, c,
    {tx: (c.tx || "").replace("costs {r} less", "costs {r}{r} less")})), 2);
  assert.equal(P.markRed({tx: "this costs {r} less to play"}), 0, "a different discount is not this one");
});

test("the discount is the CALLER's answer, and combat is what makes it exist",
     {skip}, () => {
  const c = H.card("Stains of the Redback", 1);
  const sd = {board: [], counters: {}};
  const ctx = g => P.costCtx(g, 0);
  assert.equal(P.effCost(c, sd, ctx({})), 1, "no combat, full price");
  assert.equal(P.effCost(c, sd, ctx({pend: {}, sides: [{}, {marked: true}]})), 0,
    "a marked DEFENDING hero pays the discount");
  assert.equal(P.effCost(c, sd, ctx({pend: {}, sides: [{}, {marked: false}]})), 1,
    "an unmarked one does not");
  assert.equal(P.effCost(c, sd, ctx({sides: [{}, {marked: true}]})), 1,
    "and a mark with no attack in flight has no defending hero — full price");
  /* A CALLER THAT SAYS NOTHING PAYS FULL PRICE (v3.24) — weaker than
     printed and visible, where the other direction is a cheaper card. */
  assert.equal(P.effCost(c, sd), 1);
});

test("costCtx reads the seat it is asked about", {skip}, () => {
  /* "the DEFENDING hero" is the other seat from the one paying, so the
     answer must flip with the seat — a helper that always looked at
     `sides[1]` would price seat 1's cards off its own mark. */
  const g = {pend: {}, sides: [{marked: true}, {marked: false}], chain: []};
  assert.equal(P.costCtx(g, 0).foeMarked, false, "seat 0's foe is seat 1, who is unmarked");
  assert.equal(P.costCtx(g, 1).foeMarked, true, "and seat 1's foe is seat 0, who is marked");
});

/* ---- 5. RECORDED: the two arcane fusion cards ------------------------- */

test("a NON-ATTACK's gated on-hit clause is routed to the LATE pass", {skip}, () => {
  /* RECORDED AT v3.96, DISCHARGED AT v3.97 — one version, which is what a
     refusal written down in a drill is FOR (v3.38).

     Aether Icevein and Polar Cap print "If this was FUSED and deals damage
     to a hero, …" and both parsed into `condOnHit` — which is read at
     exactly one site, inside `linkPayload`, and a non-attack never opens a
     `pend` at all. The gate was not unknown; the ROUTE was missing.

     THE MACHINERY WAS ALREADY THERE: `_dmgWay` records whether an arcane
     resolution dealt anything (v3.62, inside `arcaneHit`'s `left > 0`
     branch, so CR 7.5.5's "prevented is not dealt" governs it without
     being restated) and `runWayConds` is the late pass that reads it
     (v3.60). What was missing was the parser routing the clause there. */
  for(const nm of ["Aether Icevein", "Polar Cap"]){
    P.fxReset();
    const fx = P.fxParse(H.card(nm, 1));
    assert.equal(P.isAttack(H.card(nm, 1)), false, nm + " is a NON-ATTACK");
    assert.equal((fx.condOnHit || []).length, 0, "…so it does not go where nothing reads it");
    assert.deepEqual((fx.conds || []).map(x => x.cond), ["way:dealtFused"],
      "it rides in the late pass instead");
  }
  /* ONE COMPOUND NAME, NOT TWO CONDS. `fx.conds` entries pair ONE
     condition with ONE op — there is nowhere for an AND to live — and a
     card whose second half was dropped would fire off any arcane at all. */
  assert.equal(E.thisWayMet("way:dealtFused", {dmg: 3, fused: true}), true);
  assert.equal(E.thisWayMet("way:dealtFused", {dmg: 3, fused: false}), false, "unfused, nothing");
  assert.equal(E.thisWayMet("way:dealtFused", {dmg: 0, fused: true}), false,
    "and CR 7.5.5 — damage fully prevented is not dealt");
});

test("an ATTACK with the same gate keeps the `condOnHit` route", {skip}, () => {
  /* THE `isAttack` GUARD, AND WHY IT IS NOT DECORATION. On an ATTACK,
     `fx.conds` are evaluated at DECLARATION — before the attack has hit
     anything at all (v3.60's whole lesson, and v3.88's) — so routing a
     gated ON-HIT clause there would answer it against a swing that has
     not happened. `condOnHit` is re-checked at the hit, which is the only
     moment the question means anything.

     NO POOL CARD IS AN ATTACK WITH A FUSION-GATED ON-HIT CLAUSE, so the
     guard is measured-latent and the sabotage that drops it comes back
     SILENT against every pool fixture (v3.62). Measured across all 797
     records: five print "if this was fused", and the one that IS an
     attack — Entwine Lightning — prints a plain conditional op with no
     on-hit at all, so it takes the main loop and is untouched. */
  P.fxReset();
  const real = H.card("Polar Cap", 1);
  const atk = Object.assign({}, real, {name: "SYN-fused-attack",
    tt: "Elemental Wizard Action - Attack", ty: ["Elemental", "Wizard", "Action", "Attack"],
    power: 4,
    tx: "Ice Fusion\nWhen this hits a hero, if this was fused, create a Frostbite token under their control."});
  const fx = P.fxParse(atk);
  assert.equal(P.isAttack(atk), true, "the fixture really is an attack");
  assert.deepEqual((fx.conds || []).map(x => x.cond), [],
    "an attack's gated ON-HIT clause must NOT go to the late pass — its conds " +
    "are answered at declaration, before the swing has hit anything");
  assert.deepEqual((fx.condOnHit || []).map(x => x.cond), ["fused"],
    "it keeps the route that is re-checked at the hit");

  /* and the real attack-typed fusion card is untouched, because its
     clause is not an on-hit at all */
  P.fxReset();
  const el = P.fxParse(H.card("Entwine Lightning", 1));
  assert.deepEqual(el.conds.map(x => [x.cond, x.op]), [["fused", ["ga"]]],
    "Entwine Lightning takes the main loop, as it always has");
  assert.deepEqual(el.condOnHit || [], []);
});

test("driven: the fusion riders fire only when both halves are true", {skip}, () => {
  const ice = uid => ({name: "Ice Junk" + uid, uid, pitch: 3, cost: 0,
    tt: "Elemental Ice Wizard Action", ty: ["Elemental", "Ice", "Wizard", "Action"], tx: "", kw: []});
  const plain = uid => ({name: "Plain" + uid, uid, pitch: 3, cost: 0,
    tt: "Generic Action", ty: ["Generic", "Action"], tx: "", kw: []});
  const play = (nm, extra) => {
    P.fxReset();
    const c = Object.assign(H.card(nm, 1), {uid: "c1"});
    const g = Object.assign(H.state({name: "Alice", hand: [c, extra], res: 9, ap: 1, board: []},
                                    {name: "Bob", hp: 20, hand: [plain("j1")], board: []},
                                    {turn: 3, turnPlayer: 0}),
                            {phase: "action", step: "layer"});
    g.builds = [{}, {}];
    return unwrap(H.execute(g, c, "hand", 0, {}));
  };
  /* POLAR CAP — the token half */
  const pcOn = play("Polar Cap", ice("i1"));
  assert.deepEqual((pcOn.sides[1].board || []).map(b => b.card.name), ["Frostbite"]);
  assert.equal(pcOn.sides[1].hp, 20 - 4, "and the arcane landed either way");
  const pcOff = play("Polar Cap", plain("p1"));
  assert.deepEqual((pcOff.sides[1].board || []).map(b => b.card.name), []);
  assert.equal(pcOff.sides[1].hp, 20 - 4);

  /* AETHER ICEVEIN — the pay-or-discard half, which opens a real sheet */
  const aiOn = play("Aether Icevein", ice("i1"));
  assert.ok(aiOn.prompt, "fused, the opponent is asked to pay");
  assert.equal(aiOn.prompt.side, 1, "and it is THEIR call (v2.75's `payOr`)");
  const aiOff = play("Aether Icevein", plain("p1"));
  assert.ok(!aiOff.prompt, "unfused, nobody is asked");
});
