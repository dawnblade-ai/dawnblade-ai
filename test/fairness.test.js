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

/* ---- v3.31: THE RESTRICTION AFTER THE SUBJECT ----------------------
   Check 3c. Checks 3 and 3b read the words BEFORE "attack", which is the
   only place a restriction could live while `attackQual` took one
   argument — so thirteen pool cards dropped a printed restriction with
   the sweep reporting CLEAN, exactly as eleven did before 3b existed.

   A CHECK IS ONLY WORTH ADDING IF IT WOULD HAVE SHOUTED, so the three
   halves of the bug are reintroduced here rather than argued about. The
   counts are pinned: a check that quietly stopped matching would
   otherwise pass by finding nothing, which is this project's most
   frequent tool defect. */
test("3c exists, and each atom it names is one the parser can carry", () => {
  /* The sweep runs as a subprocess over the real pool, so a fixture card
     cannot reach it. What IS pinnable is that the check is there and that
     its vocabulary matches the parser's — a check naming an atom nothing
     produces would be quiet forever and look exactly like a clean sweep.

     REINTRODUCING THE BUG MAKES IT REPORT 10 / 13 / 3 findings for the
     three halves (target-attack tail, buffNext tail, gaNext qualifier).
     Verified by sabotage, not assumed. */
  const src = require("fs").readFileSync(
    require("path").join(ROOT, "tools", "fairness.js"), "utf8");
  const i = src.indexOf("3c. A RESTRICTION IN THE TAIL");
  assert.ok(i > 0, "check 3c moved — re-anchor this drill");
  const body = src.slice(i, src.indexOf("3b. A MODAL CHOICE", i));
  assert.ok(body.length > 800, "slice too small to be the check");
  for(const atom of ["aac", "kw", "costLe", "costGe", "powLe", "powGe", "from", "boosted"])
    assert.ok(body.indexOf('"' + atom + '"') > 0, "3c must know about " + atom);
  /* AND EVERY ONE OF THOSE IS A KEY THE PARSER ACTUALLY EMITS. */
  const emitted = new Set();
  for(const t of [
    "Target attack action card with cost 1 or less gets +3{p}.",
    "Target attack action card with cost 2 or more gets +3{p}.",
    "Target attack with 3 or less base {p} gets +1{p}.",
    "Target attack with 3 or more base {p} gets +1{p}.",
    "Target attack with stealth gets +3{p}.",
    "Your next attack action card you play from arsenal this turn gets +2{p}.",
    "Your next attack you boost this turn gets +4{p}."
  ]) for(const k of Object.keys(P.classifyClause(t).ops[0][2])) emitted.add(k);
  for(const atom of ["aac", "kw", "costLe", "costGe", "powLe", "powGe", "from", "boosted"])
    assert.ok(emitted.has(atom), "the parser must emit " + atom + " or 3c guards nothing");
});

test("3c: a condition about the DEFENDER is not a target restriction", () => {
  /* Agile Engagement prints "if it's DEFENDED BY an attack action card".
     A whole-text scan read that as a dropped restriction and accused a
     card that is read correctly — the tool's model going stale, which
     looks identical to a real finding in a report (v3.12's lesson). It is
     a pool card, so the CLEAN drill above is what holds the line; this
     pins the parser half, which is what makes the card innocent. */
  const fx = P.fxParse({name: "FS defended-by", pitch: 1, tt: "Warrior Attack Reaction",
    def: 3, cost: 1,
    tx: "Target Warrior attack gets +3{p}. If it's defended by an attack action card, create an Agility token."});
  assert.deepEqual(fx.selfQ, {g: [["warrior"]]}, "the TARGET restriction is the head only");
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
  assert.deepEqual(fx.conds[0].op, ["self", 3, {g: [["weapon"]]}],
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

/* ============================================================
   THE CHECK IS ONLY AS WIDE AS ITS OP LIST (v3.87)

   `VALUE-DOUBLED` compares a printed "+N{p}" against the ops that carry
   one, and that list named exactly two kinds. Night's Embrace prints
   "your attacks with stealth get +1{p} this turn" — a STANDING grant read
   into a new `atkBuff` op — and `fxParse`'s whole-text self-pump fallback
   read the same +1 a SECOND time into `fx.self`. The card granted its
   printed +1 to every stealth attack AND queued a bare, unqualified +1
   for the next attack of any kind; driven at the table, a 3-power stealth
   attack dealt 5.

   THE SWEEP REPORTED CLEAN. That is v3.12's `MODAL-SUMMED` lesson
   restated: the tool's model going stale looks exactly like the card
   being right, and the two are indistinguishable in a report.
   ============================================================ */
test("VALUE-DOUBLED knows every op kind that carries a printed +N{p}", () => {
  const src = require("fs").readFileSync(
    path.join(ROOT, "tools", "fairness.js"), "utf8");
  const m = src.match(/const PUMP_OPS = (\[[^\]]*\]);/);
  assert.ok(m, "the list is named, so it can be pinned");
  const KINDS = eval(m[1]);
  /* PINNED AS A SET, the way `wire.test.js`'s HEADLESS list is: moving one
     is a deliberate edit, and a kind added to the parser without being
     added here silently narrows the one check built for this bug. */
  assert.deepEqual(KINDS.slice().sort(), ["atkBuff", "buffNext", "self"],
    "when you add an op that carries a printed value, add it here too");

  /* AND EVERY ONE OF THEM IS REAL — a list naming a kind the parser never
     emits is a check that widens nothing. */
  const emitted = new Set();
  const P2 = require("../engine/parser.js");
  for(const [nm, tt, tx] of [
    ["FS pumpop self", "Generic Action - Attack", "This gets +2{p}."],
    ["FS pumpop next", "Generic Action", "Your next attack this turn gets +2{p}."],
    ["FS pumpop stand", "Assassin Attack Reaction",
     "Your attacks with stealth get +1{p} this turn."]
  ]){
    const fx = P2.fxParse({name: nm, pitch: 1, tt, tx, kw: [], cost: 1});
    if(fx.self) emitted.add("self");
    (fx.ops || []).forEach(o => { if(KINDS.indexOf(o[0]) >= 0) emitted.add(o[0]); });
  }
  assert.deepEqual([...emitted].sort(), ["atkBuff", "buffNext", "self"],
    "each kind in the list is one the parser actually emits");
});
