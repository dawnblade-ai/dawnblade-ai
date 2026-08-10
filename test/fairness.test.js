/* THE FAIRNESS SWEEP — tools/fairness.js.

   The audit asks "how much of this card did we read?". This asks "does the
   engine grant MORE than the card prints?", which is the question that
   decides whether a game is fair. Three bugs shipped in one week with the
   audit reporting IDENTICAL tiers before and after every one of them.

   A sweep that reports clean is only worth having if it would shout when
   the bugs come back, so that is what these drills pin: the sweep is quiet
   on the fixed engine, and every check has at least one real card behind it.  */
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("path");
const P = require("../engine/parser.js");

const ROOT = path.join(__dirname, "..");
const sweep = () => {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT,"tools","fairness.js"), "--json"],
      {cwd:ROOT, encoding:"utf8"});
    return JSON.parse(out);
  } catch(e){
    /* exits non-zero when it finds something — that is the report, not a crash */
    return JSON.parse(e.stdout);
  }
};

test("the sweep is CLEAN on the current engine", () => {
  const r = sweep();
  assert.deepEqual(r.findings, [],
    "a card grants more than it prints:\n" +
    r.findings.map(f=>`  [${f.code}] ${f.name} — ${f.why}`).join("\n"));
});

/* ---- each check has a real card behind it -------------------------- */

test("go again stays gated — the v2.31 class", () => {
  const fx = P.fxParse({name:"FS buckwild", pitch:1, tt:"Generic Action - Attack", power:4,
    kw:["Go again"], tx:"If there is a card with 6 or more {p} in your pitch zone, this gets go again."});
  assert.equal(fx.ga, false, "the keyword index must not grant it outright");
});

test("go again stays gated when the clause does not START with 'if'", () => {
  /* Aether Quickening ("Surge - If ...") and Swiftwater Sloop ("High Tide -
     If ...") were never seen by the conditional handler, and a rule matching
     the TAIL "it gets go again" granted it outright. */
  for(const tx of [
    "Deal 2 arcane damage to target hero.\nSurge - If this deals more than 2 damage, it gets go again.",
    "High Tide - If there are 2 or more blue cards in your pitch zone, this gets go again."
  ]){
    const fx = P.fxParse({name:"FS tail "+tx.length, pitch:1, tt:"Generic Action - Attack",
      power:4, kw:["Go again"], tx});
    assert.equal(fx.ga, false, "a gated tail must not grant go again: " + tx.slice(0,40));
  }
});

test("a value is not counted twice — the v2.30 class", () => {
  const fx = P.fxParse({name:"FS double", pitch:1, tt:"Ranger Action",
    tx:"Your next arrow attack this turn gains +3{p}."});
  assert.equal(fx.self, 0, "printed +3 must not also become a self-pump");
});

test("a type qualifier survives — the v2.30 class", () => {
  const op = P.classifyClause("your next arrow attack this turn gets +3{p}").ops[0];
  assert.ok(op[2], "the arrow restriction must be carried, not swallowed");
});

test("'instead' REPLACES rather than adds — the v2.32 class", () => {
  /* Emeritus Scolding: "Deal 2 arcane damage. If played during an opponent's
     turn, INSTEAD deal 4." Parsed as an addition it dealt 6 — 50% over, and
     in a game of margins that decides races. */
  const fx = P.fxParse({name:"FS instead", pitch:3, tt:"Wizard Action",
    tx:"Deal 2 arcane damage to target hero. If FS instead is played during an opponents turn, instead deal 4 arcane damage to them."});
  assert.deepEqual(fx.ops, [["arcane",2]], "the base op is still the printed base");
  assert.equal(fx.conds.length, 1);
  assert.equal(fx.conds[0].instead, true,
    "the conditional payload must be marked as REPLACING, so execute suppresses the base");
});

/* ---- v2.66: THE TWO SHAPES THE SWEEP ITSELF COULD NOT SEE -------------
   Both checks above read `uncondOps(fx)`, i.e. `fx.ops`. `fx.self` is a
   first-class grant that lives nowhere near it, so the sweep reported
   CLEAN through seven doubled cards and two summed replacements. Adding
   a check is only worth it if the check would have shouted, so each of
   these keeps a real card behind it and was verified by reintroducing
   the bug rather than assumed. */

test("a gated pump is not ALSO granted unconditionally — the v2.66 class", () => {
  /* Ironsong Response is ONE conditional clause. The whole-text fallback
     read the same words a second time into `fx.self`, which both doubles
     the pump and deletes its gate: +3 with the reprise unmet, where the
     card prints nothing at all. */
  const fx = P.fxParse({name:"FS gated pump", pitch:1, tt:"Warrior Attack Reaction",
    def:3, cost:0, tx:"Reprise - If the defending hero has defended with a card " +
    "from their hand this chain link, target weapon attack gains +3{p}."});
  assert.equal(fx.self, 0, "the pump belongs to the condition, and only to it");
  assert.equal(fx.conds.length, 1);
  assert.deepEqual(fx.conds[0].op, ["self", 3, [["weapon"]]],
    "and it keeps the printed 'weapon' target restriction (v2.69)");
});

test("'instead' is read inside a KEYWORD gate too — the v2.66 class", () => {
  /* Overpower prints "Target weapon attack gains +4{p}. Reprise - ...
     INSTEAD it gains +6{p}" and granted +10. Reprise, High Tide and Surge
     each hand-rolled their own gate; the generic handler had read
     `instead` since v2.32 and none of the three did. */
  for(const [tx, cond] of [
    ["Reprise - If the defending hero has defended with a card from their hand " +
     "this chain link, instead it gains +6{p}.", "reprise"],
    ["High Tide - If there are 2 or more blue cards in your pitch zone, " +
     "instead it gains +6{p}.", "pitchBlue2"],
    ["Surge - If this deals more than 3 damage, instead it gains +6{p}.", "surgeOver3"]
  ]){
    const fx = P.fxParse({name:"FS kwgate "+cond, pitch:1, tt:"Warrior Attack Reaction",
      def:3, cost:1, tx:"Target weapon attack gains +4{p}.\n"+tx});
    const g = fx.conds.find(x => x.cond === cond);
    assert.ok(g, cond + " must be read");
    assert.equal(g.instead, true, cond + " must mark the payload as REPLACING");
  }
});

test("the reaction pump REPLACES on instead and ADDS otherwise", () => {
  /* the arithmetic that consumes the flag. It was one hand-rolled line
     inside a React closure until v2.66, which is why nothing could pin it. */
  const rep = {self:4, ops:[], conds:[{cond:"reprise", op:["self",6], instead:true}]};
  assert.equal(P.rxPump(rep, []).pump, 4, "unmet — the printed base");
  assert.equal(P.rxPump(rep, ["reprise"]).pump, 6, "met — 6 REPLACES 4, it is not 10");
  const add = {self:3, ops:[], conds:[{cond:"reprise", op:["self",2], instead:false}]};
  assert.equal(P.rxPump(add, ["reprise"]).pump, 5, "no 'instead' printed, so it stacks");
});
