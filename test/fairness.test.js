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
