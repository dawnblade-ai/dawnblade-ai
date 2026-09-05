/* ============================================================
   TWO GRANTS NOTHING SPENT, AND ONE NOTHING READ (v4.06)

   Both were found by asking a question the approximation ledger's own
   record invited: it named `costTax` and `dracNext` as two of the four
   op kinds that COULD move from resolution to declaration. Before moving
   an op, go and ask what READS it — v3.69's rule, and the answer was
   that one of them had no reader at all and the other had no expiry.

   ---- HYPER INFLATION DID NOTHING, AND SAID IT HAD ------------------

     "When this attacks, cards cost {r} more to play this turn."

   `runOps` wrote `game.costTax` and printed "Cards cost 1 more for the
   rest of this turn." **Nothing anywhere read that field**, on either
   board, and nothing cleared it either. A COUNTER WITH NO READER IS A
   NO-OP WEARING A NUMBER (v3.55) — and this one came with a feed line
   asserting the opposite, which is the sev-2 category the player TRUSTS.

   Three printings, `tier: full`, and invisible to every tool here:
   coverage counts the clause consumed, and the fairness sweep is
   one-sided toward too-STRONG while this is as weak as a card gets.

   IT NAMES NO SEAT, so it is GAME state and taxes both players. That is
   the printed reading — "cards", unqualified — and it is why the tax
   rides in `parser.costCtx` (the game's half of a cost, v3.96) rather
   than on a side beside Frostbite's.

   ---- "YOUR NEXT ATTACK" IS ONE ATTACK ------------------------------

     "When this attacks, your next attack this combat chain is Draconic."
                                        — BRAND WITH CINDERCLAW

   `dracNext` was a boolean that nothing ever SPENT and, at the table,
   nothing ever CLEARED. So one Brand made every later attack Draconic
   for the rest of the game. v3.87's standing-vs-single-shot split read
   from the other end, and it compounds: `parser.dracLinks` counts
   Draconic chain links, and that number is Fai's discount, the `dracN`
   gates and Mounting Anger's banish bound.

   The trainer's only clear was `youMut(n).dracNext = false` in
   `newTurn` — WRONG BOARD, WRONG SEAT AND WRONG BOUNDARY at once, since
   the card prints "this combat CHAIN".
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const C = require("../engine/cards.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";
const ROOT = path.join(__dirname, "..");
const card = (n, p) => C.resolveEntry(H.db(), {name: n, p, code: null, q: 1});

/* ============================================================
   A. THE TAX HAS A READER
   ============================================================ */

test("Hyper Inflation prints a tax, and the tax is charged", {skip}, () => {
  H.db();
  const hyper = card("Hyper Inflation", 1);
  assert.match(String(hyper.tx), /cards cost \{r\} more to play this turn/i,
    "fixture: Hyper Inflation no longer prints the tax");
  assert.deepEqual(P.fxParse(hyper).ops, [["costTax", 1]],
    "the parser stopped reading the clause");

  /* THE VICTIM IS A CARD WITH A PRINTED COST, and its cost is read the
     way every real caller reads it — through `costCtx` (v3.96, v4.00). */
  const victim = card("Vexing Malice", 1);
  const g0 = H.state({hand: [victim], res: 9, ap: 1}, {}, {turn: 3, actor: 0});
  const before = P.effCost(victim, g0.sides[0], P.costCtx(g0, 0));

  let n = H.runOps(g0, [["costTax", 1]], "Hyper Inflation");
  n = n.game || n;
  const after = P.effCost(victim, n.sides[0], P.costCtx(n, 0));

  assert.equal(before, victim.cost, "fixture: the victim was already discounted");
  assert.equal(after, before + 1,
    "the tax is not charged — `costTax` is a no-op wearing a number again, " +
    "and the feed still tells the player it worked");
});

test("it taxes BOTH seats — the card names none", {skip}, () => {
  H.db();
  const victim = card("Vexing Malice", 1);
  const g = H.state({hand: [victim], res: 9}, {hand: [victim], res: 9}, {turn: 3, actor: 0});
  let n = H.runOps(g, [["costTax", 2]], "Hyper Inflation"); n = n.game || n;

  /* SEAT 1 IS THE HALF THAT BITES. A tax read off the acting side would
     pass the seat-0 assertion perfectly — the same shape v2.83 names for
     a feed line, one field over. */
  assert.equal(P.effCost(victim, n.sides[0], P.costCtx(n, 0)), victim.cost + 2, "seat 0 untaxed");
  assert.equal(P.effCost(victim, n.sides[1], P.costCtx(n, 1)), victim.cost + 2,
    "seat 1 is untaxed — the tax has become a side grant, and the card names no seat");
});

test("a tax is added AFTER the floor, so a free card is still taxed", {skip}, () => {
  H.db();
  /* A DISCOUNT CANNOT TAKE A COST BELOW ZERO and a tax on a 0-cost card
     is still a tax. Folded inside the `Math.max(0, …)` the two cancel,
     which is silently weaker than printed on exactly the cards a tax
     matters most against. */
  /* AND A COST-0 CARD CANNOT SEE THIS. `max(0, 0) + 1` and `max(0, 0+1)`
     are both 1, so the first fixture came back SILENT under the sabotage
     that folds the tax inside the floor — check your own fixture. What
     discriminates is a discount BIGGER than the printed cost, where the
     floor has real work to do: `max(0, 1-3) + 1` is 1 and
     `max(0, 1-3+1)` is 0. */
  const cheap = {name: "CostTax Floor Probe", pitch: 1, cost: 1, power: 3,
                 tt: "Generic Attack Action", ty: ["Generic", "Attack", "Action"],
                 tx: "", kw: [], gkw: [], _banCostOff: 3};
  const g = H.state({res: 9}, {}, {turn: 3, actor: 0});
  assert.equal(P.effCost(cheap, g.sides[0], P.costCtx(g, 0)), 0,
    "fixture: the discount does not exceed the printed cost, so the floor is idle");
  const taxed = Object.assign({}, g, {costTax: 1});
  assert.equal(P.effCost(cheap, taxed.sides[0], P.costCtx(taxed, 0)), 1,
    "an over-discounted card escapes the tax — it has been folded inside the floor, " +
    "where a discount silently eats it");
});

test("the tax expires with the turn, through the one shared body", {skip}, () => {
  H.db();
  const victim = card("Vexing Malice", 1);
  const g = H.state({res: 9}, {}, {turn: 3, actor: 0});
  const taxed = Object.assign({}, g, {costTax: 1});
  assert.equal(P.effCost(victim, taxed.sides[0], P.costCtx(taxed, 0)), victim.cost + 1,
    "fixture: the tax is not on");

  /* `beginEndPhase` IS THE SHARED BODY BOTH BOARDS CALL (v3.17), so
     asserting on it is a statement about the table AND the trainer. */
  const out = E.beginEndPhase(taxed, 0, H.db());
  assert.equal(out.game.costTax, 0,
    "'this turn' never ends — the tax follows both players into every " +
    "later turn, and it had no expiry at all because it had no reader");
  assert.equal(P.effCost(victim, out.game.sides[0], P.costCtx(out.game, 0)), victim.cost,
    "the cost is still taxed after the end phase");
  assert.ok(out.msgs.some(m => /inflation subsides/i.test(m)),
    "the end phase does not announce it — in a training sim the sequence is the lesson");
});

test("and a turn with no tax says nothing about one", {skip}, () => {
  H.db();
  const g = H.state({res: 9}, {}, {turn: 3, actor: 0});
  const out = E.beginEndPhase(g, 0, H.db());
  assert.ok(!out.msgs.some(m => /inflation/i.test(m)),
    "the end phase announces an expiry that never happened");
});

test("`costTax` is a registered GAME key, not an unclassified stray", {skip}, () => {
  const S = require("../engine/sides.js");
  assert.ok(S.GAME_KEYS.indexOf("costTax") >= 0,
    "`costTax` is not in GAME_KEYS — an unclassified top-level field, which is " +
    "the SIDE-FIELD-ON-GAME family and a dropped field on the wire");
  assert.ok(S.SIDE_FIELDS.indexOf("costTax") < 0,
    "`costTax` is BOTH per-side and shared — the card names no seat, so it is one " +
    "or the other, never both");
});

/* ============================================================
   B. THE DRACONIC GRANT IS SPENT, AND EXPIRES
   ============================================================ */

/* DRIVE TWO SWINGS. One swing cannot tell a single-shot grant from a
   standing one — both readings mark the first link — which is v3.26's
   fixture rule and the reason the old bug survived every drill here. */
function swing(g, c){
  let n = H.execute(g, c, {from: "hand", attacking: true});
  n = n.game || n;
  n = J.withEffects(n, (fx, s) => fx.linkPumps(s, [], 0));
  n = n.game || n;
  n = J.withEffects(n, (fx, s) => fx.linkPayload(s, (s.pend && s.pend.total) || 0, 0, {heroHit: true}));
  n = n.game || n;
  n.pend = null;
  return n;
}

test("the Draconic grant is SPENT by the next attack, not left standing", {skip}, () => {
  H.db();
  const brand = card("Brand with Cinderclaw", 1);
  assert.match(String(brand.tx), /your next attack this combat chain is draconic/i,
    "fixture: Brand no longer prints the grant");
  assert.deepEqual(P.fxParse(brand).ops, [["dracNext", 1]], "the parser stopped reading it");

  /* THE VICTIM MUST NOT BE DRACONIC BY TYPE, or every reading agrees and
     the drill tests nothing. */
  const plain = card("Vexing Malice", 1);
  assert.ok(!/draconic/i.test(plain.tt || ""),
    "fixture: the probe attack is Draconic by type, so the grant is invisible");

  const a = Object.assign({}, plain, {uid: 77001});
  const b = Object.assign({}, plain, {uid: 77002});
  let g = H.state({hand: [a, b], res: 9, ap: 3, dracNext: true}, {}, {turn: 3, actor: 0});

  g = swing(g, a);
  assert.equal(P.dracLinks(g.chain), 1, "the granted attack did not count as Draconic");
  assert.equal(g.sides[0].dracNext, false, "the grant was not spent by the attack it names");

  g = swing(g, b);
  assert.equal(P.dracLinks(g.chain), 1,
    "a SECOND attack counted as Draconic — 'your NEXT attack' is one attack, and a " +
    "standing grant compounds through `dracLinks` into Fai's discount, the `dracN` " +
    "gates and Mounting Anger's banish bound");
});

test("it is spent even when the attack was already Draconic by type", {skip}, () => {
  H.db();
  /* THE PRINTED LINE NAMES THAT ATTACK EITHER WAY, so the grant applies
     to it redundantly and is used up — exactly as `buffQ` is spent by
     the card its qualifier names. Left unspent here, a Draconic deck
     could never consume it at all. */
  /* AND BRAND CANNOT BE ITS OWN VICTIM — check your own fixture. The
     first draft swung Brand into a pre-set grant, and Brand's own ops
     RE-GRANT at resolution, so the field came back true and the drill
     failed against a correct engine. A synthetic Draconic attack that
     prints nothing is what separates the two facts (v3.73). */
  const drac = {name: "CostTax Draconic Probe", pitch: 1, cost: 0, power: 3, uid: 77101,
                tt: "Draconic Ninja Action - Attack", ty: ["Draconic", "Ninja", "Attack", "Action"],
                tx: "", kw: [], gkw: []};
  assert.match(drac.tt, /draconic/i, "fixture: the probe is not Draconic by type");
  assert.deepEqual(P.fxParse(drac).ops, [], "fixture: the probe prints an op of its own");
  let g = H.state({hand: [drac], res: 9, ap: 3, dracNext: true}, {}, {turn: 3, actor: 0});
  g = swing(g, drac);
  assert.equal(g.sides[0].dracNext, false,
    "a Draconic attack did not consume the grant, so it survives to a later one");
});

test("and it expires with the CHAIN, for both seats", {skip}, () => {
  H.db();
  /* "THIS COMBAT CHAIN" is the printed window, so `closeChainGrants` is
     the body — the one both boards already call (v3.87). BOTH SEATS,
     because a seat that never closes its own grant keeps it forever, and
     that was literally the table's behaviour. */
  const g = H.state({dracNext: true}, {dracNext: true}, {turn: 3, actor: 0});
  const out = E.closeChainGrants(g);
  assert.equal(out.sides[0].dracNext, false, "seat 0 keeps the grant past the chain it names");
  assert.equal(out.sides[1].dracNext, false, "seat 1 keeps it — the sweep reads one seat");
});

test("the trainer grew no second clear of its own", {skip}, () => {
  /* A CLAIM ABOUT A BABEL BLOCK no drill can execute, so it is pinned as
     source — and the POSITIVE half is driven above. The clear that used
     to live here was seat 0 only, on one board, at a TURN boundary for a
     grant printed "this combat chain"; a second clear left standing is
     dead rules code, which reads as a rule somebody can reach (v3.82). */
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/dracNext\s*=/.test(code),
    "index.html assigns `dracNext` again — the expiry belongs to " +
    "`effects.closeChainGrants`, which both boards call");
  assert.match(html, /closeChainGrants/,
    "the trainer no longer calls the shared close-step sweep at all");
});

/* ============================================================
   C. THE COST IS READ ONCE
   ============================================================ */

test("the additional-cost check asks the GAME's half too", {skip}, () => {
  /* v3.80: `effCost` is read at several sites and they are different
     questions — but they must agree about the PRICE. This one sat SEVEN
     LINES below the charge that already had `_costO` in hand and asked
     without it, so under a Frostbite or this tax the affordability test
     passed on a price the charge did not use. */
  const ef = fs.readFileSync(path.join(ROOT, "engine", "effects.js"), "utf8");
  const code = ef.replace(/\/\*[\s\S]*?\*\//g, "");
  /* AND THE SCAN'S OWN FIRST DRAFT WAS AIMED WRONG. `/effCost\([^)]*\)/`
     stops at the first `)`, which is the one inside `act(s)` — so every
     call came back truncated to "effCost(card, act(s)" and the third
     argument was invisible. One level of nesting is enough here and the
     count is asserted, because a scan that matches nothing passes. */
  const bare = code.match(/effCost\((?:[^()]|\([^()]*\))*\)/g) || [];
  assert.ok(bare.length >= 2, "the scan found no `effCost` call at all — it is aimed wrong");
  assert.ok(bare.every(c => /\(/.test(c.slice(8))),
    "the scan is truncating its matches again — it must span the nested call");
  const missing = bare.filter(c => !/_costO/.test(c));
  assert.deepEqual(missing, [],
    "an `effCost` call in effects.js does not pass the game's half — that is a cost " +
    "read two ways at two sites, which is how a seat ends up on NEGATIVE-RES (v3.80)");
});
