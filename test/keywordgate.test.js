/* ============================================================
   A KEYWORD PREFIX EATS ITS OWN GATE (v3.99)

   `classifyClause` guards the ACTIVATION prefixes ("Action - <cost>:",
   "Instant - …", "Attack Reaction - …") precisely so the loose matchers
   below cannot claim a line INCLUDING its cost — that is v3.59. The pool
   prints a second family of prefixes with the identical hazard, and only
   three of its five members had ever been given the same treatment:

     reprise / surge / high tide   read here, gate carried      OK
     quickstrike / rupture         claimed by the loose matcher  BARE

   So Rush of Power ("Quickstrike - If this HAS GO AGAIN, it gets +1{p}")
   and Lava Burst ("Rupture - If this is played as CHAIN LINK 4 OR
   HIGHER, it gets +3{p}") both granted their pump UNCONDITIONALLY. Four
   records, every one `tier: full`, every one STRONGER than printed —
   the direction that steals games.

   NO TOOL HERE COULD SEE IT, and each for its own reason. Coverage counts
   the clause consumed. And `npm run fairness`'s `COND-BYPASSED` needs an
   unconditional TWIN to compare a gate against: when the gate simply
   DISAPPEARS there is nothing to compare, which is v3.57's lesson stated
   about a keyword prefix rather than an op dispatcher.

   AND THE SAME PASS FOUND THE ADJACENT DROP. "This gets +1{p} and GO
   AGAIN" was read as the pump alone, so Second Strike (three printings,
   `tier: full`) lost a printed ACTION POINT — CR 5.3.5, and this
   project's own "most valuable keyword in the game to get wrong".
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

const parse = c => { P.fxReset(); return P.fxParse(c); };
const pool = () => { const p = require("../data/pool.json");
                     return Array.isArray(p) ? p : (p.cards || Object.values(p)); };
const rec = (nm, pitch) => pool().find(c => c.name === nm && (pitch == null || +c.pitch === pitch));
const asCard = r => ({name: r.name, pitch: +(r.pitch || 0), tt: r.type_text || "",
  ty: r.types || [], tx: r.functional_text || "", kw: r.card_keywords || [],
  cost: r.cost, power: r.power, def: r.defense});

const junk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3,
  tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});

/* DRIVE THE SWING AND STOP WHERE THE POWER IS STRUCK. These are LATE
   conditions, settled in `linkPumps` — the piece whose whole job is "what
   is this attack's power before the wall" (v3.71) — so a drill that stops
   at `execute` measures the number before the gate has been asked, and
   one that runs `linkPayload` measures the DAMAGE DEALT, which is the
   very mistake v3.71 was written to correct. */
function swing(card, o){
  o = o || {};
  const c = Object.assign({}, card, {uid: "atk1"});
  const chain = [];
  for(let i = 0; i < (o.links || 0); i++) chain.push({n: "L" + i, kind: "atk"});
  let g = H.state({name: "Alice", hand: [c], res: 9, ap: 1, gaNext: !!o.gaNext},
                  {name: "Bob", hp: 40, deck: [junk("Top", "t1"), junk("Next", "t2")]},
                  {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain}),
                               c, "hand", 0, {}));
  assert.ok(out.pend, (card.name || "the card") + " opened a link");
  let total = null;
  const after = unwrap(H.fx(out, (fx, m) => {
    const r = fx.linkPumps(m, {equipDefenders: 0, handBlockers: 0, defenders: []});
    total = r.total;
    return r.game || r;
  }));
  return {game: after, total, ap: after.sides[0].ap, ga: after.pend && after.pend.ga};
}

/* AND THE WHOLE SWING, when the observable is the ACTION POINT. An
   attack's point is charged at RESOLUTION, not at declaration (v3.44), so
   a drill that stops at `linkPumps` reads the point the seat still holds
   and cannot tell a granted go again from a spent one. */
function resolve(card, o){
  const s = swing(card, o);
  const g = unwrap(H.fx(s.game, (fx, m) => {
    const r = fx.linkPayload(m, {total: s.total, pumps: 0, heroHit: true});
    return r.game || r;
  }));
  return {game: g, ap: g.sides[0].ap, total: s.total, ga: s.ga};
}

/* ------------------------------------------------------------------
   QUICKSTRIKE — Rush of Power
   ------------------------------------------------------------------ */

test("Rush of Power's gate is READ, not dropped", {skip}, () => {
  for(const pitch of [1, 2, 3]){
    const fx = parse(asCard(rec("Rush of Power", pitch)));
    const e = (fx.conds || []).filter(x => x.cond === "hasGa");
    assert.equal(e.length, 1, "pitch " + pitch + ": the quickstrike gate must survive the prefix");
    assert.deepEqual(e[0].op, ["self", 1]);
    /* AND IT MUST NOT ALSO BE UNCONDITIONAL. `fx.self` is the whole-text
       self-pump fallback's home, and v3.87 is the third time a new op
       arrived without `pumpRead` being told — a gate that is read AND
       granted unconditionally is `VALUE-DOUBLED` with extra steps. */
    assert.equal(fx.self, 0, "pitch " + pitch + ": the pump must not ALSO land unconditionally");
  }
});

test("driven: no go again, no bonus — go again, bonus", {skip}, () => {
  const c = H.card("Rush of Power", 1);            /* printed power 3 */
  const off = swing(c, {});
  const on  = swing(c, {gaNext: true});            /* a waiting grant, taken at declaration */
  assert.equal(off.total, c.power, "without go again it swings for its printed power");
  assert.equal(on.total, c.power + 1, "with go again the printed +1 applies");
  assert.match(said(off.game), /no go again/i, "and the feed says which way the gate went");
});

/* THE AMOUNT IS THE CARD'S. Rush of Power prints +1 at ALL THREE
   pitches, so no pool fixture can tell a read number from a hardcoded 1
   (v3.32, and every outing since). A synthetic printing 3 is what sees
   it — and it carries a UNIQUE NAME because `fxParse` memoizes on
   `name|pitch`. */
test("the quickstrike bonus is read off the line, never assumed", {skip}, () => {
  const fx = parse({name: "Synthetic Quickstrike", pitch: 1, power: 4,
    tt: "Lightning Runeblade Action - Attack",
    ty: ["Lightning", "Runeblade", "Action", "Attack"],
    tx: "**Quickstrike** - If this has go again, it gets +3{p}.", kw: ["Quickstrike"],
    cost: 1, def: 3});
  const e = (fx.conds || []).find(x => x.cond === "hasGa");
  assert.ok(e, "the synthetic parses the same shape");
  assert.deepEqual(e.op, ["self", 3], "3, because that is what it prints");
});

/* ------------------------------------------------------------------
   RUPTURE — Lava Burst
   ------------------------------------------------------------------ */

test("Lava Burst's chain-link gate is READ", {skip}, () => {
  const fx = parse(asCard(rec("Lava Burst", 1)));
  const e = (fx.conds || []).filter(x => x.cond === "chainLinkGe4");
  assert.equal(e.length, 1, "the rupture gate must survive the prefix");
  assert.deepEqual(e[0].op, ["self", 3]);
  assert.equal(fx.self, 0, "and must not ALSO be unconditional");
});

/* THE OFF-BY-ONE IS THE WHOLE TEST (v3.92). `linkPayload` pushes this
   attack's own link and `linkPumps` runs BEFORE it, so the attack is link
   `chain.length + 1`. A fixture at 0 links and one at 6 agree under BOTH
   readings; only the pair either side of the printed threshold can tell
   `>= 4` from `>= 3`. */
test("driven: link 3 gets nothing, link 4 gets the printed +3", {skip}, () => {
  const c = H.card("Lava Burst", 1);               /* printed power 2, +3 at link 4 */
  const three = swing(c, {links: 2});              /* two prior links → this is link 3 */
  const four  = swing(c, {links: 3});              /* three prior links → this is link 4 */
  assert.equal(three.total, c.power, "as chain link 3 it is just a 2-power attack");
  assert.equal(four.total,  c.power + 3, "as chain link 4 the rupture bonus applies");
  assert.match(said(three.game), /chain link 3, needs 4/,
    "and the feed names the number it wanted, so the player can see why");
});

test("the rupture THRESHOLD is read off the line, never assumed", {skip}, () => {
  /* Lava Burst is the pool's only Rupture record and prints 4, so a
     hardcoded 4 is silent against every pool fixture. */
  const fx = parse({name: "Synthetic Rupture", pitch: 1, power: 2,
    tt: "Draconic Action - Attack", ty: ["Draconic", "Action", "Attack"],
    tx: "**Rupture** - If this is played as chain link 2 or higher, it gets +1{p}.",
    kw: ["Rupture"], cost: 1, def: 2});
  const e = (fx.conds || []).find(x => /^chainLinkGe/.test(x.cond));
  assert.ok(e, "the synthetic parses the same shape");
  assert.equal(e.cond, "chainLinkGe2", "2, because that is what it prints");
  assert.deepEqual(e.op, ["self", 1]);
});

test("driven: a synthetic threshold of 2 fires one link earlier", {skip}, () => {
  const c = {name: "Synthetic Rupture Driven", uid: "sr1", pitch: 1, cost: 0, power: 2,
    tt: "Draconic Action - Attack", ty: ["Draconic", "Action", "Attack"],
    tx: "**Rupture** - If this is played as chain link 2 or higher, it gets +1{p}.",
    kw: ["Rupture"], gkw: [], def: 2};
  assert.equal(swing(c, {links: 0}).total, 2, "as link 1 it prints 2 and gets 2");
  assert.equal(swing(c, {links: 1}).total, 3, "as link 2 its own threshold is met");
});

/* ------------------------------------------------------------------
   "…AND GO AGAIN" IS A SECOND GRANT
   ------------------------------------------------------------------ */

test("Second Strike keeps its printed go again", {skip}, () => {
  for(const pitch of [1, 2, 3]){
    const fx = parse(asCard(rec("Second Strike", pitch)));
    const on = (fx.conds || []).filter(x => x.cond === "dealtDmg");
    assert.deepEqual(on.map(x => x.op), [["self", 1], ["ga"]],
      "pitch " + pitch + ": ONE printed sentence, TWO grants, one condition");
  }
});

/* THE OBSERVABLE IS THE ACTION POINT (v3.58). Go again is a GAIN — CR
   5.3.5 — so asserting on a feed line would pass with the grant deleted;
   what separates the two engines is a point the seat still holds. */
test("driven: the go again is an action point, not a log line", {skip}, () => {
  const c = H.card("Second Strike", 1);
  /* the UNMET control, from the same card in the same state — a drill
     that only ever asserts the met case passes against an engine that
     grants unconditionally (v3.45: both halves, or it proves nothing) */
  const unmet = resolve(c, {});
  assert.equal(unmet.ga, false, "no damage dealt this turn — no go again");
  assert.equal(unmet.ap, 0, "…and the action point the attack spent stays spent");
  /* CHECK YOUR OWN FIXTURE. The first draft seeded `hist.dmg`, which no
     evaluator reads — `dealtDmg` asks `hist.atk || hist.arc`, the two
     records that actually count a hit. A fixture that seeds a field
     nothing reads reports the gate unmet and looks exactly like a gate
     that is broken. */
  const withDmg = (() => {
    const cc = Object.assign({}, c, {uid: "ss1"});
    let g = H.state({name: "Alice", hand: [cc], res: 9, ap: 1,
                     hist: Object.assign({}, require("../engine/sides.js").freshHist(), {atk: 1})},
                    {name: "Bob", hp: 40, deck: [junk("T", "t1")]}, {turn: 3, turnPlayer: 0});
    g.builds = [{}, {}];
    return unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}),
                            cc, "hand", 0, {}));
  })();
  assert.equal(withDmg.pend.ga, true,
    "damage was dealt this turn, so the printed go again is granted");
  const done = unwrap(H.fx(withDmg, (fx, m) => {
    const r = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
    return r.game || r;
  }));
  assert.equal(done.sides[0].ap, 1,
    "…and CR 5.3.5 makes that a GAIN, so the seat still holds a point where the " +
    "unmet control holds none — which is the whole observable, because both states " +
    "print the identical feed either way");
});

/* ------------------------------------------------------------------
   THE ANCHOR IS THE ADJACENCY
   ------------------------------------------------------------------ */

test("a `go again` elsewhere in the clause is NOT a second grant", {skip}, () => {
  /* MEASURED OVER THE POOL: five clauses match the pump matcher and
     contain the phrase, and only two of them grant both. Testing for the
     phrase anywhere hands three of the five a keyword their text does not
     grant them THERE — stronger than printed. */
  const rop = parse(asCard(rec("Rush of Power", 1)));
  assert.equal((rop.conds || []).filter(x => x.op[0] === "ga").length, 0,
    "Rush of Power's go again is the GATE, never a grant");

  const enf = parse(asCard(rec("Enflame the Firebrand", 1)));
  assert.equal((enf.conds || []).filter(x => x.op[0] === "ga" && x.cond === "drac4").length, 0,
    "Enflame's go again belongs to a DIFFERENT threshold from its +2{p}");
});

/* AND THE POOL CANNOT EXPRESS THE HAZARD, so this is a SYNTHETIC pair.
   MEASURED: with quickstrike and rupture read above the loose matcher,
   the only three pool clauses reaching it with a `go again` anywhere are
   the three that print the ADJACENT form — so widening the anchor to
   `[\s\S]*go again` is silent against every card in the game today.
   That makes the narrowness LATENT (v3.73's turn-vs-put distinction), and
   a printed distinction a reader ignores is still read wrong. */
test("a widened anchor would turn a QUESTION into a grant", {skip}, () => {
  const cl = "it gets +1{p} if it gets go again";        /* Rush of Power's words, reordered */
  const r = P.classifyClause(cl, {name: "Postposed Probe", pitch: 1, power: 3,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: cl, kw: []});
  assert.deepEqual(r.ops, [["self", 1]],
    "the phrase is the clause's CONDITION — granting go again off it is stronger " +
    "than printed, on the most valuable keyword in the game to get wrong");
});

test("a widened anchor would grant it to the wrong subject", {skip}, () => {
  const cl = "this gets +2{p} and the defending hero gets go again";
  const r = P.classifyClause(cl, {name: "Other Subject Probe", pitch: 1, power: 3,
    tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: cl, kw: []});
  assert.deepEqual(r.ops, [["self", 2]],
    "the go again names somebody else — v2.33's and v3.47's wrong-subject shape, " +
    "one keyword over");
});

test("the two gates are answered where they are claimed to be", {skip}, () => {
  /* A REFUSAL ASSERTED IN ONE FUNCTION IS NOT A REFUSAL (v3.63): the
     claim is that these are LATE conditions, so the main loop must SKIP
     them — otherwise the player is told "condition not met" four lines
     before the bonus lands (v3.60, and the feed is the lesson). */
  const c = H.card("Lava Burst", 1);
  const g = swing(c, {links: 0}).game;
  assert.doesNotMatch(said(g), /condition not met \(chainLinkGe/,
    "the main condition loop must not answer a late condition and then be overruled");
});

/* ------------------------------------------------------------------
   A PUMP THAT ARRIVES THROUGH `runOps` — Jack Be Quick
   ------------------------------------------------------------------ */

test("Jack Be Quick's rider carries BOTH printed grants", {skip}, () => {
  const fx = parse(asCard(rec("Jack Be Quick", 1)));
  assert.ok(fx.optCost, "the optional cost is read");
  assert.deepEqual(fx.optCost.ops, [["self", 1], ["ga"]],
    "\"this gets +1{p} and go again\" is TWO grants — the pump alone is half " +
    "the printed reward for a cost that is paid in full");
});

/* THE RIDER'S OPS COME BACK FROM `applyPrompt` AND GO STRAIGHT TO
   `runOps`, which had no `self` case at all — so the cost was charged and
   NOTHING was granted. v2.04's free-ability bug read from the other end:
   pay, receive nothing. */
test("driven: a rider's self pump lands on the open link", {skip}, () => {
  const c = Object.assign(H.card("Jack Be Quick", 1), {uid: "jbq"});
  let g = H.state({name: "Alice", hand: [c], res: 9, ap: 1},
                  {name: "Bob", hp: 40}, {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const out = unwrap(H.execute(Object.assign({}, g, {phase: "action", step: "layer", chain: []}),
                               c, "hand", 0, {}));
  assert.ok(out.pend, "the attack opened a link");
  const before = out.pend.total;
  const after = unwrap(H.fx(out, (f, m) => f.runOps(m, [["self", 1]], "Jack Be Quick")));
  assert.equal(after.pend.total, before + 1,
    "the rider's +1 reaches the attack rather than falling through the dispatcher");
  assert.match(said(after), /\+1 power to the attack/);
});

test("a rider's pump refuses when no attack of yours is in flight", {skip}, () => {
  /* WEAKER THAN PRINTED AND VISIBLE (v3.24) — and it must not land on the
     OPPONENT's swing, which is what `atkMinus` tests with the opposite
     sign one field over. */
  let g = H.state({name: "Alice", res: 9, ap: 1}, {name: "Bob", hp: 40},
                  {turn: 3, turnPlayer: 0});
  g.builds = [{}, {}];
  const none = unwrap(H.fx(g, (f, m) => f.runOps(m, [["self", 2]], "Nothing")));
  assert.match(said(none), /no attack of yours is in flight/);

  const theirs = Object.assign({}, g, {pend: {card: {name: "Theirs", power: 4}, by: 1, total: 4}});
  const out = unwrap(H.fx(theirs, (f, m) => f.runOps(m, [["self", 2]], "Nothing")));
  assert.equal(out.pend.total, 4, "their swing is not mine to pump");
});
