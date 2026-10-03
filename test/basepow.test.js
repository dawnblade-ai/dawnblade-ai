/* ============================================================
   AN ATTACK'S BASE POWER IS ONE READER (v4.92)

   "Base {p}" is printed on four kinds of attack and only one keeps it in
   `card.power`: an aura Cosmo turns into a weapon has its printed WARD as
   its base (v3.84), and Plasma Barrel Shot has a printed DEFINITION
   ("1 plus the number of times you've boosted this combat chain", v4.49).

   Five sites asked "what is this attack's base" and four wrote
   `card.power || 0` — so against an aura attack or the Gun the base read
   ZERO and every "with {p} greater than its base" answered TRUE:
   Arakni's Den of the Spider and Inertia Trap fired off an attack nobody
   had pumped. `effects.basePowOf` / `effects.attackBase` are the reader.

   AND ONE OF THE FOUR MISSED A PUMP: the traps' `defPumped` compared the
   link's declared total alone, so an attack REACTION that had already
   resolved onto the link (`pend.rxPump`, v4.03) did not count, at the
   table. It asks `pendPumped` now.

   AND PUT IN CONTEXT'S LIMIT WAS ENFORCED ON NEITHER BOARD.
   > "This can only defend an attack with 3 or less base {p}."
   The trainer checked it in `toggleBlock` — the declaration door — below an
   early return for every defence reaction, and the card IS one. The table
   never asked. `effects.defLimitWhy` is asked by `judge.legal` and by both
   of the trainer's reaction doors.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../engine/parser");
const E = require("../engine/effects");
const J = require("../engine/judge");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached DB — run: node tools/audit.js";

/* ---- 1. THE READER --------------------------------------------------- */

test("basePowOf: printed power, an aura's WARD, the Gun's DEFINITION", {skip}, () => {
  H.db();
  const blow = H.card("Wounding Blow", 1);
  assert.equal(E.basePowOf(blow, "hand", {}), blow.power, "an attack action card's base is its power");
  const shield = H.tok("Spectral Shield");
  assert.equal(P.wardValue(shield), 1, "fixture: Spectral Shield prints Ward 1");
  assert.equal(E.basePowOf(shield, "aura", {}), 1, "an aura attack's base is its ward, not its 0 power");
  /* SYNTHETIC (v3.32): Spectral Shield prints 1 and so does the token's
     power-less read, so only a ward that is not 1 can tell them apart */
  P.fxReset();
  const ward3 = {name: "Synthetic Ward Three", tt: "Generic Token - Aura", ty: ["Generic", "Token", "Aura"],
                 tx: "**Ward 3**", kw: ["Ward"], pitch: 0};
  assert.equal(E.basePowOf(ward3, "aura", {}), 3, "the ward is READ, never a hardcoded 1");
  P.fxReset();
  const gun = H.card("Plasma Barrel Shot", 0) || H.card("Plasma Barrel Shot");
  assert.ok(gun && P.fxParse(gun).powFormula, "fixture: the Gun no longer prints its base as a definition");
  assert.equal(E.basePowOf(gun, "weapon", {boostChain: 0}), 1);
  assert.equal(E.basePowOf(gun, "weapon", {boostChain: 2}), 3, "the Gun's base counts this chain's boosts");
  assert.equal(E.basePowOf(null, "hand", {}), null);
});

test("a nameless card never throws — the reader is reached from `legal` (v4.59)", () => {
  assert.doesNotThrow(() => E.basePowOf({power: 4}, "hand", {}));
  assert.equal(E.basePowOf({power: 4}, "hand", {}), 4);
  assert.doesNotThrow(() => J.legal({pend: {card: {power: 4}}, sides: [{}, {}]}, {t: "pass"}, 0));
});

test("`pendPumped` reads the base off the reader: an aura swinging at its ward is NOT pumped", {skip}, () => {
  H.db();
  const shield = H.tok("Spectral Shield");
  const at = total => ({stack: [], pend: {card: shield, from: "aura", total, by: 1}});
  assert.equal(E.pendPumped(at(1)), false, "an aura attack at its own ward read as pumped — its base was zero");
  assert.equal(E.pendPumped(at(2)), true, "and one pumped above its ward reads as pumped");
});

/* ---- 2. THE TRAPS ---------------------------------------------------- */

/* Seat 1 declared the attack; seat 0 plays the trap (traps.test.js's shape) */
function trapVs(trapName, atk, from, total, extra){
  const trap = H.card(trapName, 1);
  const g = {...H.state({hand: [trap]}, {}, {turn: 3, actor: 0}),
    pend: Object.assign({card: atk, from, by: 1, total, ga: false, ops: [], onHit: []}, extra || {})};
  return H.execute(g, trap, "hand", 0, {});
}

test("Den of the Spider against an AURA attack: its ward is the base", {skip}, () => {
  H.db();
  const shield = H.tok("Spectral Shield");
  assert.ok(!trapVs("Den of the Spider", shield, "aura", 1).sides[1].marked,
    "the trap marked an aura attack swinging at exactly its ward — the base read as 0");
  assert.equal(trapVs("Den of the Spider", shield, "aura", 2).sides[1].marked, true,
    "and an aura attack pumped above its ward still marks (both halves)");
});

test("Inertia Trap against the GUN: its printed definition is the base", {skip}, () => {
  H.db();
  const gun = H.card("Plasma Barrel Shot", 0) || H.card("Plasma Barrel Shot");
  const has = n => (n.sides[1].board || []).some(b => /inertia/i.test(b.card.name));
  assert.ok(!has(trapVs("Inertia Trap", gun, "weapon", 1)), "the Gun at its base (1, no boosts) read as pumped");
  assert.ok(has(trapVs("Inertia Trap", gun, "weapon", 2)), "and the Gun above its base creates the token");
});

test("a pump an attack REACTION already landed on the link counts (`pend.rxPump`)", {skip}, () => {
  H.db();
  const atk = H.card("Raging Onslaught", 1);
  assert.equal(trapVs("Den of the Spider", atk, "hand", atk.power, {rxPump: 2}).sides[1].marked, true,
    "a link pumped by a resolved reaction read as unpumped — the trap's copy ignored `rxPump`");
  assert.ok(!trapVs("Den of the Spider", atk, "hand", atk.power, {rxPump: 0}).sides[1].marked,
    "and an unpumped link still does not mark");
});

/* ---- 3. PUT IN CONTEXT ----------------------------------------------- */

/* the defence-reaction window at the table: seat 1 attacks, seat 0 holds
   priority in the reaction step */
function window(atk, from, total, zone){
  const pic = {...H.card("Put in Context", 3), uid: "PIC"};
  const own = zone === "arsenal" ? {arsenal: pic, hand: []} : {hand: [pic]};
  return {...H.state(Object.assign({res: 3}, own), {}, {turn: 3, actor: 0}),
    phase: "action", step: "reaction", turnPlayer: 1, attacker: 1, priority: 0,
    passed: [false, false], firstPlayer: 1, round: 1, over: null, stack: [],
    pend: {card: atk, from: from || "hand", by: 1, total: total != null ? total : atk.power, ops: [], onHit: []}};
}
const playWhy = (g, zone) => J.legal(g, {t: "play", uid: "PIC", from: zone || "hand"}, 0);

test("AT THE TABLE: Put in Context refuses an attack with more than 3 base power", {skip}, () => {
  H.db();
  const big = H.card("Raging Onslaught", 1);
  assert.ok(big.power > 3, "fixture: the big attack is not big");
  assert.match(String(playWhy(window(big))), /can only defend an attack with 3 or less base power — this one's base is \d+/,
    "the table played Put in Context against a big attack");
  /* from the ARSENAL too — a defence reaction may come from either */
  assert.match(String(playWhy(window(big, "hand", null, "arsenal"), "arsenal")), /3 or less base power/);
});

test("…and accepts one at 3 or less, PUMPED OR NOT — it is the BASE that is measured", {skip}, () => {
  H.db();
  const small = H.card("Wounding Blow", 3);
  assert.ok(small.power <= 3, "fixture: the small attack is not small");
  assert.equal(playWhy(window(small)), null, "a 3-or-less attack was refused");
  /* pumped well above 3: the base is still small, and the card prints BASE */
  assert.equal(playWhy(window(small, "hand", 9)), null, "a pump was read as the base");
});

test("the limit reads the BASE through the one reader: an aura at its ward", {skip}, () => {
  H.db();
  const shield = H.tok("Spectral Shield");
  assert.equal(playWhy(window(shield, "aura", 1)), null, "an aura attack (base = Ward 1) was refused");
});

test("`defLimitWhy`: no number to measure refuses rather than waves through", () => {
  P.fxReset();
  const pic = {name: "Synthetic Context", tt: "Generic Defense Reaction", ty: ["Generic", "Defense Reaction"],
               tx: "This can only defend an attack with 3 or less base {p}.", kw: [], pitch: 3, def: 3, cost: 0};
  assert.match(String(E.defLimitWhy(pic, null)), /no attack to measure/);
  assert.equal(E.defLimitWhy(pic, 3), null);
  assert.match(String(E.defLimitWhy(pic, 4)), /base is 4/);
  /* the number is READ — a synthetic printing 5 is the only thing that can
     tell it from a hardcoded 3 (v3.32) */
  const five = {...pic, name: "Synthetic Context Five",
                tx: "This can only defend an attack with 5 or less base {p}."};
  assert.equal(E.defLimitWhy(five, 5), null, "the printed 5 was read as 3");
  assert.equal(E.defLimitWhy({name: "Plain", tt: "Generic Defense Reaction", ty: ["Generic", "Defense Reaction"],
                              tx: "", kw: [], pitch: 1}, 99), null, "a card with no limit is never refused");
  P.fxReset();
});

test("PREMISE: every pool card printing the limit is a DEFENCE REACTION", {skip}, () => {
  /* why the limit lives in the reaction doors and nowhere in the
     declaration door: a declarable card printing it would meet no check.
     The day one arrives, this fails and somebody builds that half. */
  H.db();
  const pool = require("../data/pool.json");
  const with_ = [];
  for(const r of pool){
    const c = {name: r.name, tx: r.functional_text || "", tt: r.type_text, ty: r.types, kw: r.card_keywords,
               pitch: r.pitch, cost: r.cost, power: r.power, def: r.defense};
    if(P.fxParse(c).defLimit != null) with_.push([r.name, P.isDR(c)]);
  }
  assert.ok(with_.length >= 1, "the census found no card printing the limit — aimed wrong");
  for(const [nm, dr] of with_) assert.ok(dr, nm + " prints the limit and is not a defence reaction");
});

/* ---- 4. THE TRAINER, AND NO SECOND COPY ------------------------------ */

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HTML = strip(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));
const EFX = strip(fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8"));

test("both trainer reaction doors refuse on the shared limit, and the dead copy is gone", () => {
  const hand = HTML.slice(HTML.indexOf("const playRx = (i, addPaid) => setG"), HTML.indexOf("const playRxA = () => setG"));
  const ars  = HTML.slice(HTML.indexOf("const playRxA = () => setG"), HTML.indexOf("const playArsenalInstant = () => setG"));
  assert.ok(hand.length > 2000 && ars.length > 1000, "the door anchors moved — re-anchor");
  assert.match(hand, /const _lim = DawnEffects\.defLimitWhy\(c, [^;]*s\.incoming\);\s*if\(_lim\) return L\(s,/,
    "the hand door does not refuse on the shared limit");
  assert.match(ars, /const _limA = DawnEffects\.defLimitWhy\(c, [^;]*s\.incoming\);\s*if\(_limA\) return L\(s,/,
    "the arsenal door does not refuse on the shared limit");
  const tb = HTML.slice(HTML.indexOf("const toggleBlock = (kind,v) => setG"), HTML.indexOf("const moveToReact = () => setG"));
  assert.ok(tb.length > 300, "the toggleBlock anchors moved");
  assert.ok(!/defLimit/.test(tb), "the declaration door carries a copy of the limit again — it could never run");
});

test("no site in effects.js reads the open link's base as `card.power` by hand", () => {
  /* the census of the family (v4.21): the four copies are gone, and a
     fifth arriving fails here rather than reading an aura's base as 0 */
  const hits = EFX.match(/pend\.card\.power|pend\.card && n\.pend\.card\.power|\(pc\.power\s*\|\|\s*0\)/g) || [];
  assert.deepEqual(hits, [], "a hand-rolled base read of the open link is back");
  /* and the scan is alive: the reader's own body is what reads card.power */
  assert.ok(/function basePowOf\(card, from, s\)\{[\s\S]*?return card\.power \|\| 0;/.test(EFX),
    "basePowOf moved or stopped reading the printed power — re-aim this scan");
});
