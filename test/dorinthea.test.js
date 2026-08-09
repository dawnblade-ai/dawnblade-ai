/* ============================================================
   DORINTHEA — the weapon that swings twice.

   Her whole deck is one printed sentence wearing many sets of words:
   "Once per turn Effect - When a weapon you control hits, you may
   attack an additional time with that weapon this turn." Everything
   else is either a pump aimed at a WEAPON attack, or a Reprise rider
   that pays you for the opponent blocking from hand.

   The reaction family is where this hero's bugs live, and every one
   of them reported tier `full` — they were read, and read wrong:

     THE FALLBACK READ THE SAME WORDS TWICE. `fxParse`'s whole-text
     self-pump exists for a "+N{p}" that no op consumed. Its guard
     named ONE place an op can live (`fx.ops`), so a pump the parser
     had already routed to `fx.conds` was read again into `fx.self`
     — which both DOUBLES it and DELETES its gate. Ironsong Response
     is a single conditional clause and granted +3 with the reprise
     unmet (printed: nothing) and +6 with it met (printed: +3).
     Seven cards across four heroes.

     "INSTEAD" WAS NOT READ INSIDE A KEYWORD GATE. The generic
     if/when/while handler has marked `instead` since v2.32; Reprise,
     High Tide and Surge each hand-rolled their own two lines and
     none of them did. Overpower prints +6 with reprise and granted
     +10.

   `npm run fairness` was CLEAN through both, and that is structural
   rather than bad luck: its COND-BYPASSED and VALUE-DOUBLED checks
   both read `uncondOps(fx)`, and `fx.self` is a first-class grant
   that does not live in `fx.ops` at all. The sweep built for exactly
   this bug class could not see it in the one field it never read.

   Every drill below was proven to bite by reintroducing the bug it
   describes and watching it go red.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* fxParse memoizes on name|pitch — every fixture needs a unique name or
   results collide in the cache and produce a misleading pass. */
let seq = 0;
const mk = (tx, extra) => Object.assign({
  name: "DorinFixture" + (++seq), pitch: 1, tt: "Warrior Attack Reaction",
  tx, cost: 1, power: null, def: 3, kw: [], gkw: []
}, extra || {});

/* ---- THE FALLBACK MUST NOT RE-READ A GATED PUMP ---------------------- */

test("a pump the parser routed to fx.conds is NOT read again into fx.self", () => {
  const fx = P.fxParse(mk(
    "Reprise - If the defending hero has defended with a card from their " +
    "hand this chain link, target weapon attack gains +3{p}."));

  /* the whole printed clause is conditional, so there is no unconditional
     grant at all — this is the gate, and it is what deleting the fix undoes */
  assert.strictEqual(fx.self, 0,
    "the entire clause is gated; an unconditional +3 means the fallback read it twice");
  assert.deepStrictEqual((fx.conds || []).map(c => [c.cond, c.op]),
    [["reprise", ["self", 3]]]);
});

test("the guard covers onHit and condOnHit too, not just conds", () => {
  /* fx.ops was the only place the original guard looked. A pump can be
     sitting in any of four, and naming them one at a time is how this
     came back. */
  const oh = P.fxParse(mk("When this hits a hero, it gets +2{p}.",
    {tt: "Warrior Action - Attack", power: 4}));
  const all = [...(oh.onHit || []), ...(oh.conds || []).map(c => c.op),
               ...(oh.condOnHit || []).map(c => c.op), ...oh.ops];
  const carried = all.some(o => o && (o[0] === "self" || o[0] === "buffNext") && o[1] === 2);
  if (carried) assert.strictEqual(oh.self, 0,
    "an op already carries the +2; the fallback must not add a second one");
});

test("a genuinely unread +N{p} STILL gets the fallback", () => {
  /* deleting the fallback outright would break a different set of cards.
     Refusing when an op read it is the rule — refusing always is not. */
  const fx = P.fxParse(mk("Target attack gains +3{p}.", {tt: "Warrior Action"}));
  assert.strictEqual(fx.self, 3,
    "no op consumed this +3, so the fallback is exactly what should catch it");
});

test("a card printing two DIFFERENT pumps keeps the unread one", () => {
  /* the guard matches the MAGNITUDE rather than the mere presence of an
     op, so a second, genuinely unconsumed pump is not collateral damage */
  const fx = P.fxParse(mk(
    "Reprise - If the defending hero has defended with a card from their " +
    "hand this chain link, target weapon attack gains +3{p}."));
  assert.strictEqual(fx.self, 0);
  const two = P.fxParse(mk("Target attack gains +5{p}.", {tt: "Warrior Action"}));
  assert.strictEqual(two.self, 5);
});

/* ---- "INSTEAD" REPLACES, INSIDE A KEYWORD GATE TOO -------------------- */

test("Reprise reads `instead` in its payload", () => {
  const fx = P.fxParse(mk(
    "Target weapon attack gains +4{p}.\nReprise - If the defending hero has " +
    "defended with a card from their hand this chain link, instead it gains +6{p}."));
  assert.strictEqual(fx.self, 4, "the printed unconditional +4 is real");
  const rep = (fx.conds || []).find(c => c.cond === "reprise");
  assert.ok(rep, "the reprise rider must be read");
  assert.strictEqual(rep.instead, true,
    "'instead' REPLACES — without this the two are summed and the card grants +10");
});

test("all three keyword gates read `instead`, not just the one that broke", () => {
  /* Reprise, High Tide and Surge are one shape wearing three names. The
     bug was that each hand-rolled its own two lines; a shared helper is
     what stops a fourth gate reintroducing it. */
  const gates = [
    ["Reprise - If the defending hero has defended with a card from their hand " +
     "this chain link, instead it gains +6{p}.", "reprise"],
    ["High Tide - If there are 2 or more blue cards in your pitch zone, " +
     "instead it gains +6{p}.", "pitchBlue2"],
    ["Surge - If this deals more than 3 damage, instead it gains +6{p}.", "surgeOver3"]
  ];
  for (const [tx, cond] of gates) {
    const fx = P.fxParse(mk("Target weapon attack gains +4{p}.\n" + tx));
    const c = (fx.conds || []).find(x => x.cond === cond);
    assert.ok(c, `${cond} must be read`);
    assert.strictEqual(c.instead, true, `${cond} must carry instead`);
  }
});

test("a gated payload WITHOUT the word instead still adds", () => {
  /* the opposite error is just as wrong: Out for Blood's reprise rider is
     a genuine addition on top of its printed +3 */
  const fx = P.fxParse(mk(
    "Target weapon attack gains +3{p}.\nReprise - If the defending hero has " +
    "defended with a card from their hand this chain link, your next attack " +
    "this turn gains +1{p}."));
  assert.strictEqual(fx.self, 3);
  const rep = (fx.conds || []).find(c => c.cond === "reprise");
  assert.strictEqual(rep.instead, false, "no 'instead' printed, so it stacks");
});

/* ---- THE REACTION PUMP ARITHMETIC ------------------------------------ */

test("rxPump: an `instead` cond REPLACES the printed base", () => {
  const fx = P.fxParse(mk(
    "Target weapon attack gains +4{p}.\nReprise - If the defending hero has " +
    "defended with a card from their hand this chain link, instead it gains +6{p}."));
  assert.strictEqual(P.rxPump(fx, []).pump, 4, "reprise unmet — the printed +4");
  const met = P.rxPump(fx, ["reprise"]);
  assert.strictEqual(met.pump, 6, "reprise met — +6 REPLACES +4, it is not 4+6");
  assert.strictEqual(met.replaced, true);
});

test("rxPump: a plain cond ADDS to the printed base", () => {
  const fx = {self: 3, conds: [{cond: "reprise", op: ["self", 2], instead: false}], ops: []};
  assert.strictEqual(P.rxPump(fx, []).pump, 3);
  assert.strictEqual(P.rxPump(fx, ["reprise"]).pump, 5);
});

test("rxPump: a wholly-gated reaction adds NOTHING until its gate fires", () => {
  const fx = P.fxParse(mk(
    "Reprise - If the defending hero has defended with a card from their " +
    "hand this chain link, target weapon attack gains +3{p}."));
  assert.strictEqual(P.rxPump(fx, []).pump, 0,
    "the condition is the whole card — unmet, the reaction is worth nothing");
  assert.strictEqual(P.rxPump(fx, ["reprise"]).pump, 3);
});

test("rxPump: only a POWER pump may be replaced by an instead", () => {
  /* an `instead` cond running some other kind of op has no business
     deleting the printed pump — replacement is per kind (v2.32) */
  const fx = {self: 3, conds: [{cond: "reprise", op: ["draw", 1], instead: true}], ops: []};
  const r = P.rxPump(fx, ["reprise"]);
  assert.strictEqual(r.replaced, false);
  assert.strictEqual(r.pump, 3, "a drawn card does not replace a power bonus");
});

test("rxPump: a cond that did not fire contributes nothing", () => {
  const fx = {self: 0, conds: [{cond: "charged", op: ["self", 3], instead: false}], ops: []};
  assert.strictEqual(P.rxPump(fx, []).pump, 0);
  assert.strictEqual(P.rxPump(fx, ["reprise"]).pump, 0, "a different cond firing is not this one");
  assert.strictEqual(P.rxPump(fx, ["charged"]).pump, 3);
});

/* ---- THE TRAINER USES IT ---------------------------------------------
   `playRx` is a closure inside `Battle`, so this is pinned by reading the
   source — the same compromise test/mirror.test.js and test/actor.test.js
   already make, and stated rather than hidden. The gate is that the
   arithmetic is NOT hand-rolled here: a second copy is what drifted. */

test("playRx computes its pump with rxPump, not by hand", () => {
  const i = HTML.indexOf("const playRx = i => setG");
  assert.ok(i > 0, "playRx must still be findable");
  const body = HTML.slice(i, HTML.indexOf("const playRxA", i));
  assert.ok(/rxPump\(fx,\s*fired\)/.test(body),
    "playRx must call the engine's rxPump");
  assert.ok(!/\(fx\.self\s*\|\|\s*0\)\s*\+/.test(body),
    "a hand-rolled sum over fx.self is the bug: it cannot express 'instead'");
});

test("rxPump is bridged into the trainer's bare namespace", () => {
  /* an engine export the babel blocks call bare needs a bridge line, or
     the trainer throws a ReferenceError no other drill would catch */
  assert.ok(/rxPump\s*=\s*DawnParser\.rxPump/.test(HTML));
});
