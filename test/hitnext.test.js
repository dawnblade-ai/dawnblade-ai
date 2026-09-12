/* ============================================================
   THE DELAYED ON-HIT GRANT — `hitNext` (v4.41)

   > "The next time an attack you control hits a HERO this turn, deal 4
   >  arcane damage to them."               — BURN UP // SHOCK, Briar x2
   > "Solflare - When this is charged to your soul, the next time YOU HIT
   >  this turn, gain 1{h}."             — BANNERET OF SALVATION, Boltyn

   A GRANT THAT WAITS FOR A HIT IS NOT A GRANT THAT WAITS FOR AN ATTACK.
   v3.34 read the first as a `buffQ` entry of zero power carrying a rider,
   and wrote down the argument for it: such an entry "already waits rather
   than being spent by a card it does not name". TRUE of every other
   member of that family, because each carries a QUALIFIER — and false
   here, where the clause names no card at all, so `q` is null,
   `qualMatches` answers TRUE for everything (by design, v3.98) and the
   entry is spent by the next attack DECLARED. Driven before the fix:

     swing 1, blocked to nothing    buffQ 0 ... the grant is GONE
     swing 2, hits the hero         pend.onHit [] ... nothing fires

   WEAKER THAN PRINTED, so the one-sided fairness sweep is blind, and the
   card read `tier: full` throughout because the clause IS consumed — the
   pair of blindnesses v4.18 names. The second half was the printed "a
   HERO", filed into `pend.onHit` where a bare trigger lives, so 4 arcane
   landed off a swing at an ALLY (v3.45's whole distinction).

   AND BANNERET IS A RECORDED REFUSAL COMING DUE (v3.38). v4.21 refused
   its line and named what it was waiting on — "the TRIGGER and the
   SCHEDULE, not the payload". Both are built here.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const H = require("./helpers/judged.js");
const P = require("../engine/parser.js");
const J = H.J;
const E = require("../engine/effects.js");
const skip = H.hasDb() ? false : "needs the card database";

const BURN = "the next time an attack you control hits a hero this turn, deal 4 arcane damage to them";
const BANN = "the next time you hit this turn, gain 1{h}";

/* ---- 1. THE PARSE ---------------------------------------------------- */

test("both printed wordings read, and the HERO GATE is read off the clause", () => {
  /* BOTH CARDS ARE NAMED, and that is the only thing separating a gate
     that is READ from one that is DEFAULTED (v3.69). Asserted on Burn Up
     alone, hardcoding the flag to `true` passes; asserted on Banneret
     alone, hardcoding it to `false` passes. Defaulted true, Banneret
     loses a printed hit; defaulted false, Burn Up fires off an ally. */
  assert.deepEqual(P.classifyClause(BURN),
    {status: "run", ops: [["hitNext", [["arcane", 4]], true]]});
  assert.deepEqual(P.classifyClause(BANN),
    {status: "run", ops: [["hitNext", [["life", 1]], false]]});
});

test("the AMOUNT is the card's, not a literal", () => {
  /* Burn Up prints 4 at its one pitch and Banneret prints 1, so no pool
     fixture can tell a read number from a hardcoded one (v3.32, and this
     is its twelfth outing). A synthetic is what sees it. */
  assert.deepEqual(P.classifyClause(BURN.replace("4 arcane", "7 arcane")).ops,
    [["hitNext", [["arcane", 7]], true]]);
  assert.deepEqual(P.classifyClause(BANN.replace("1{h}", "3{h}")).ops,
    [["hitNext", [["life", 3]], false]]);
});

test("an UNKNOWN SUBJECT refuses — and the near-miss is the whole defect", () => {
  /* ANCHORED TO THE TWO PRINTED WORDINGS ALONE, A THIRD FELL THROUGH to
     the loose matchers below and read as an IMMEDIATE op fired on PLAY —
     the delay gone, which is stronger than printed. That is v3.59's rule
     about an activation prefix and v4.19's about an unreadable rung: a
     guard that stops a loose rule stealing a clause has to reach every
     wording of the shape, not only the ones with a reader.

     NO POOL CARD PRINTS A THIRD, so this fixture is synthetic (v3.73) —
     and it has to be one the loose matchers WOULD claim, or the drill
     passes against an engine with no guard at all. `gain 1{h}` is
     exactly such a payload, which is why it is the one used here. */
  assert.equal(P.classifyClause("the next time a weapon you control hits this turn, gain 1{h}"), null,
    "a third subject was read — as whichever of the two it resembles, or worse, on PLAY");
  assert.equal(P.classifyClause("the next time an attack you control hits an ally this turn, gain 1{h}"), null);
  /* THE POSITIVE CONTROL: the same payload behind a KNOWN subject reads,
     so the refusal above is about the subject and not about the tail. */
  assert.deepEqual(P.classifyClause("the next time you hit this turn, gain 1{h}").ops,
    [["hitNext", [["life", 1]], false]]);
});

test("an UNREADABLE PAYLOAD refuses the whole clause (v2.29)", () => {
  assert.equal(P.classifyClause("the next time you hit this turn, do a thing nobody reads"), null);
});

test("THE BOUND IS THE PRINTED WORD \"hit\", AND IT IS A MEASUREMENT", {skip}, () => {
  /* WRITTEN TO MATCH THE DELAY ALONE, THIS SWALLOWED A FAMILY THAT HAS
     ITS OWN READER. The pool prints SEVEN "the next time … this turn,"
     clauses and FIVE are PREVENTIONS — "the next time you WOULD BE DEALT
     DAMAGE this turn, prevent N of that damage" — so Cloud Cover x3, Toe
     the Line and Throw Caution all went `full` -> `none` in one edit, a
     working prevention deleted by a guard. v3.57 exactly: a reader that
     cannot read its own match must not CONSUME the clause.

     THE SPLIT IS PINNED AS A PARTITION, BOTH SIDES (v4.17) — pinning the
     hit family alone cannot see a prevention being swallowed, and
     pinning the preventions alone cannot see the hit family stop
     reading. */
  H.db();
  const hit = [], other = [];
  for(const rec of H.poolRecords ? H.poolRecords() : require("../data/pool.json")){
    const tx = String((rec.functional_text != null ? rec.functional_text : rec.tx) || "");
    for(const one of (tx.match(/the next time ([^,]*) this turn,/ig) || [])){
      const subj = one.replace(/^the next time /i, "").replace(/ this turn,$/i, "");
      (/\bhits?\b/i.test(subj) ? hit : other).push(rec.name + " :: " + subj);
    }
  }
  assert.equal(hit.length, 2, "the pool's delayed-HIT printings moved: " + JSON.stringify(hit));
  assert.equal(other.length, 5, "the pool's other printings of the shape moved: " + JSON.stringify(other));
  assert.ok(other.every(s => /would be dealt damage/i.test(s)),
    "every non-hit printing of the shape is a prevention — the bound rests on that");

  /* AND THE PREVENTION STILL READS, driven rather than asserted about. */
  assert.deepEqual(P.classifyClause(
    "the next time you would be dealt damage this turn, prevent 2 of that damage").ops,
    [["ward", 2, {until: "turn"}]]);
});

test("the pool emits `hitNext` from exactly two records, and both payloads RUN", {skip}, () => {
  /* v3.99's dispatcher census, one op over: a payload the parser emits
     and `runOps` cannot run is an op that does nothing, filed `full`. */
  H.db();
  P.fxReset();
  const seen = [];
  const walk = ops => (ops || []).filter(o => o && o[0] === "hitNext");
  const DB = H.db();
  for(const k of Object.keys(DB.byNP)){
    const c = DB.byNP[k];
    const rc = H.card(c.n, c.p == null ? 0 : c.p);
    if(!rc) continue;
    let fx; try { fx = P.fxParse(rc); } catch(e){ continue; }
    for(const op of walk(fx.ops).concat(walk(fx.chargeSoul)))
      seen.push({name: c.n, op});
  }
  assert.deepEqual(seen.map(s => s.name).sort(),
    ["Banneret of Salvation", "Burn Up // Shock"],
    "the set of records emitting hitNext moved");
  for(const s of seen){
    const g = H.state({res: 9, hp: 20}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
    const n = (o => o.game || o)(H.runOps(g, [s.op], s.name));
    assert.equal((n.sides[0].hitNext || []).length, 1,
      s.name + "'s hitNext op was not taken by runOps");
    const held = n.sides[0].hitNext[0];
    const out = (o => o.game || o)(H.runOps(n, held.ops, s.name));
    assert.notDeepEqual(JSON.stringify(out.sides), JSON.stringify(n.sides),
      s.name + "'s delayed payload runs but changes nothing — a no-op wearing a schedule");
  }
});

/* ---- 2. DRIVEN: WHICH HIT SPENDS IT ---------------------------------- */

const atk = (uid, name, power) => ({uid, name, tt: "Generic Action - Attack",
  ty: ["Generic", "Action", "Attack"], power, pitch: 1, cost: 0, def: 2,
  kw: [], gkw: [], tx: ""});

/* Resolve a swing with `hitNext` armed and read back what it cost. */
const land = (grants, total, heroHit) => {
  const pc = atk("z1", "Swing", 4);
  const g = H.state({res: 9, ap: 1, hitNext: grants}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  g.pend = {card: pc, from: "hand", by: 0, total, ga: false, ops: [],
            onHit: [], onHitHero: [], condOnHit: [], lateConds: [], lateOps: []};
  const out = (o => o.game || o)(H.fx(g, (f, n) => f.linkPayload(n,
    {total, pumps: 0, handBlockers: 0, defenders: 0, blkNote: "", heroHit})));
  return {hp: out.sides[1].hp, kept: (out.sides[0].hitNext || []).length};
};
const arc  = {ops: [["arcane", 4]], heroOnly: true,  src: "Burn Up // Shock"};
const bare = {ops: [["arcane", 4]], heroOnly: false, src: "A Bare Grant"};

test("DRIVEN: a hit on a HERO spends the grant and pays it", {skip}, () => {
  H.db();
  assert.deepEqual(land([arc], 4, true), {hp: 16, kept: 0});
});

test("DRIVEN: a hit on an ALLY spends the BARE grant and not the hero-gated one", {skip}, () => {
  /* THREE HALVES, NOT TWO (v4.16). A gate that refuses everything passes
     the hero case perfectly, and a gate that refuses nothing passes the
     ally case — only driving BOTH kinds of grant into the SAME event can
     tell a read gate from either. */
  H.db();
  assert.deepEqual(land([arc],  4, false), {hp: 20, kept: 1},
    "\"hits a HERO\" fired off a swing at an ally — the direction v3.45 exists to stop");
  assert.deepEqual(land([bare], 4, false), {hp: 16, kept: 0},
    "a BARE \"the next time you hit\" must fire on an ally hit — Banneret prints no hero");
});

test("DRIVEN: a fully blocked attack spends NOTHING — CR 7.5.5", {skip}, () => {
  /* If prevention or a wall means no damage is dealt, it is not a hit,
     so "the next time" has not happened yet. BOTH kinds, because a guard
     written on `heroHit` alone lets a bare grant through on a blocked
     swing (`heroHit` is false there too, but so is any hit at all). */
  H.db();
  assert.deepEqual(land([arc],  0, false), {hp: 20, kept: 1});
  assert.deepEqual(land([bare], 0, false), {hp: 20, kept: 1});
});

test("DRIVEN: it ACCUMULATES — two grants are two payouts", {skip}, () => {
  /* Briar decks Burn Up twice. Two copies in one turn are two grants,
     each spent by its own hit — which is why this is a LIST and `gaNext`
     is a boolean. The two payloads DIFFER, so an engine that fires one
     and drops the other is visible in the life total rather than in a
     length (v3.26: a fixture where two things coincide has tested
     neither). */
  H.db();
  const two = [{ops: [["arcane", 4]], heroOnly: true, src: "Burn Up // Shock"},
               {ops: [["arcane", 1]], heroOnly: true, src: "Burn Up // Shock"}];
  assert.deepEqual(land(two, 4, true), {hp: 15, kept: 0},
    "both grants must come due on one hit — 20 - 4 - 1");

  /* AND THE SECOND HALF IS THE ACCUMULATION ITSELF, WHICH THE FIXTURE
     ABOVE CANNOT SEE. Handed both entries by hand it drives the FIRE
     site, so `runOps` overwriting the list instead of appending to it is
     SILENT — measured, that sabotage came back silent against every
     assertion above. v3.20's rule: a drill that constructs its own
     fixture proves the fixture. So the grants are ARMED by running the op
     twice, which is what a second copy of Burn Up does. */
  const g = H.state({res: 9}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const one = (o => o.game || o)(H.runOps(g,   [["hitNext", [["arcane", 4]], true]], "Burn Up // Shock"));
  const both = (o => o.game || o)(H.runOps(one, [["hitNext", [["arcane", 1]], true]], "Burn Up // Shock"));
  assert.equal((both.sides[0].hitNext || []).length, 2,
    "a second copy of the card OVERWROTE the first grant instead of adding to it");
  assert.deepEqual(both.sides[0].hitNext.map(e => e.ops),
    [[["arcane", 4]], [["arcane", 1]]],
    "…and the payloads must be the two DIFFERENT ones, in arming order");
});

test("DRIVEN: the grant is NOT collected by the declaration", {skip}, () => {
  /* THE DEFECT ITSELF. As a `buffQ` entry with `q: null` it rode onto
     `pend.onHit` the moment anything was declared and was gone; an
     attack that then missed lost it for good. */
  H.db();
  P.fxReset();
  const a = {...H.card("Raging Onslaught", 1), uid: "a1"};
  const g = H.state({hand: [a], res: 9, ap: 1, hitNext: [arc]}, {hp: 20},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const out = (o => o.game || o)(H.execute(g, a, "hand", 0, {}));
  assert.deepEqual(out.pend.onHit, [], "the declaration collected the delayed grant");
  assert.equal((out.sides[0].hitNext || []).length, 1, "…and spent it");
});

test("DRIVEN: it survives a MISS and pays the NEXT hit", {skip}, () => {
  /* The whole printed sentence, end to end, and the case the old reading
     got wrong: miss, then hit. */
  H.db();
  const missed = land([arc], 0, false);
  assert.equal(missed.kept, 1, "a blocked swing consumed it");
  assert.deepEqual(land([arc], 4, true), {hp: 16, kept: 0},
    "…and the next attack that DID hit was paid nothing");
});

/* ---- 3. "THIS TURN" ENDS WITH THE TURN ------------------------------- */

test("it EXPIRES in the end phase, and is COUNTED by the gate that runs it", {skip}, () => {
  /* v4.07's rule, verbatim: step (8) skips a seat holding nothing, so a
     field swept INSIDE that branch but absent from `held` expires only on
     a turn when something ELSE expires — right by coincidence, and
     indistinguishable in a green suite from right.

     SO THE SEAT HOLDS NOTHING ELSE. With any other grant present the
     sweep runs for that one and takes this along, and the drill passes
     against an engine that never counted it. */
  H.db();
  const g = H.state({res: 0, ap: 0, hitNext: [arc], buffNext: 0, buffQ: [], gaNext: false,
                     gaNextQ: [], costOff: [], instantNextQ: [], defCapNext: [],
                     defActionBuff: 0, atkBuff: [], defMod: [], amp: 0, runeHitNext: 0,
                     wardTurn: 0, awdTurn: 0},
                    {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const out = (o => o.game || o)(E.beginEndPhase(g, 0));
  assert.deepEqual(out.sides[0].hitNext, [],
    "an unspent \"this turn\" grant followed its controller into the next turn");
});

test("BOTH SEATS expire it, not only the turn player", {skip}, () => {
  /* CR 4.4.3e loses points for ALL players and a grant is the same kind
     of thing. Burn Up is an INSTANT half, so a seat really can arm one
     during the opponent's turn. */
  H.db();
  const g = H.state({res: 0, hitNext: [arc]}, {res: 0, hitNext: [bare]},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const out = (o => o.game || o)(E.beginEndPhase(g, 0));
  assert.deepEqual(out.sides[0].hitNext, []);
  assert.deepEqual(out.sides[1].hitNext, [], "the non-turn seat kept its grant");
});

/* ---- 4. THE CHARGE TRIGGER ------------------------------------------- */

test("Banneret's payload is HELD OFF `fx.ops` — nothing fires on play", {skip}, () => {
  /* v3.07's suspense bug is the shape: a printed condition collected as
     a bonus. Left in `ops`, the 1{h} lands whenever the card is PLAYED as
     an attack, which is exactly what v4.21 found it doing. */
  H.db();
  P.fxReset();
  const fx = P.fxParse(H.card("Banneret of Salvation", 2));
  assert.deepEqual(fx.ops, []);
  assert.deepEqual(fx.chargeSoul, [["hitNext", [["life", 1]], false]]);
});

test("DRIVEN: charging Banneret arms the grant, and the next hit pays it", {skip}, () => {
  /* THE WHOLE ROUTE. `boostBanish`'s site one cost over (v3.56): the
     CHARGED card's own trigger, fired at the one place a card goes to the
     soul as an additional cost of some OTHER card. */
  H.db();
  P.fxReset();
  const bann = {...H.card("Banneret of Salvation", 2), uid: "bn1"};
  const bolt = {...H.card("Bolt of Courage", 1), uid: "bc1"};
  let g = H.state({hand: [bolt, bann], res: 9, ap: 2, hp: 18}, {hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3});
  g.builds = [{}, {}];
  const out = (o => o.game || o)(H.execute({...g, _chargeUid: "bn1"}, bolt, "hand", 0, {}));
  assert.ok(out.sides[0].soul.some(c => c && c.uid === "bn1"),
    "Banneret did not reach the soul — the charge itself did not happen");
  assert.deepEqual((out.sides[0].hitNext || []).map(e => e.ops), [[["life", 1]]],
    "being charged did not arm the delayed grant");
  assert.equal(out.sides[0].hp, 18, "and NO life was gained at the moment of charging");
});

test("THE TRIGGER IS THE CHARGED CARD'S, NOT THE PLAYED CARD'S", {skip}, () => {
  /* v3.56's own discriminator, one cost over. Read off the card being
     PLAYED, this fires whenever Banneret PAYS for something else — the
     opposite card. Charging an ordinary card must arm nothing. */
  H.db();
  P.fxReset();
  const plain = {...H.card("Raging Onslaught", 1), uid: "pl1"};
  const bolt  = {...H.card("Bolt of Courage", 1), uid: "bc2"};
  let g = H.state({hand: [bolt, plain], res: 9, ap: 2}, {hp: 20},
                  {actor: 0, turnPlayer: 0, turn: 3});
  g.builds = [{}, {}];
  const out = (o => o.game || o)(H.execute({...g, _chargeUid: "pl1"}, bolt, "hand", 0, {}));
  assert.ok(out.sides[0].soul.some(c => c && c.uid === "pl1"), "the plain card was charged");
  assert.deepEqual(out.sides[0].hitNext || [], [],
    "charging a card that prints no such trigger armed one anyway");
});

/* ---- 5. THE ENTRY CARRIES ITS OWN SOURCE ---------------------------- */

test("the entry names the card that GRANTED it, not the card that swings", {skip}, () => {
  /* `runOps` prints the source name into the feed, and the card that
     granted this is not the card now connecting — without `src`, Burn
     Up's 4 arcane is announced under the name of whatever attack happened
     to hit. Asserted on the STATE rather than on the prose (v2.45): the
     feed is downstream of this field, and a drill that reads the log
     cannot tell a right name from a plausible one. */
  H.db();
  P.fxReset();
  const burn = {...H.card("Burn Up // Shock", 1), uid: "b9"};
  const fx = P.fxParse(burn);
  const op = (fx.ops || []).find(o => o[0] === "hitNext");
  const g = H.state({res: 9}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3});
  const n = (o => o.game || o)(H.runOps(g, [op], "Burn Up // Shock"));
  assert.equal(n.sides[0].hitNext[0].src, "Burn Up // Shock");
});
