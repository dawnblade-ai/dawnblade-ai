/* ============================================================
   EVERY CONDITION THE POOL EMITS IS ANSWERED SOMEWHERE (v3.97)

   v3.96 found three cards whose granted on-hit ability was refused by a
   gate nobody had taught: the parser emitted `auras3` and `drac2` into
   `fx.condOnHit`, whose evaluator is a SECOND, much smaller copy of the
   vocabulary `execute`'s condition loop answers. An unknown condition
   answers FALSE — correctly and silently (v3.26) — so the card simply
   did nothing, while reading `tier: full` because its HEAD parses.

   THAT WAS FOUND BY HAND, ONCE. This file is the standing version: it
   walks the whole pinned pool, collects every condition the parser
   actually emits, and asserts each one is accounted for by an evaluator.

   IT IS A CENSUS, NOT A BLACKLIST — v3.35's `PENDING_KINDS` lesson, and
   v3.91's for the attack-reaction list. A condition arriving from a new
   parser rule fails here until somebody says where it is answered, which
   is the opposite of the failure v3.96 was: a new condition walking into
   a silent fallback.

   AND THE SETS ARE PINNED, so "the scan found nothing" cannot pass for
   "everything is accounted for" — the failure mode this project names on
   nearly every page (v3.21, v3.47, v2.47).
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const E = require("../engine/effects.js");
const H = require("./helpers/judged.js");

const skip = !H.hasDb() && "no cached card database";

const SRC = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");

/* THE PARAMETERISED CONDITIONS. Each carries a printed threshold in its
   NAME (v3.88's rule — the number travels rather than being known by the
   site that reads it), so the evaluator matches them with a pattern and a
   literal-branch scan cannot see them. */
const PATTERNED = [
  /^chargedPitch\d+$/, /^pitchBlue\d+$/, /^pitchCost\d+$/, /^surgeOver\d+$/,
  /^hit\d+$/, /^auras\d+$/, /^drac\d+$/, /^way:/, /^atkNamed:/, /^playedCls:/
];

/* Conditions answered somewhere other than the main `met` chain, each
   with the reason. A name here is a claim that something else runs it —
   and the drill below checks that claim by NAME, not by trusting it. */
const ELSEWHERE = {
  discard6:   /if\(cond==="discard6"\)/,                 /* its own early branch, above the chain */
  pumped:     /LATE_CONDS/,                              /* settled in linkPumps once the total is struck */
  defLt2:     /LATE_CONDS/,
  defLt2any:  /LATE_CONDS/,
  reprise:    /RX_CONDS/,                                /* the attack-reaction dispatcher */
  defAtkAction: /RX_CONDS/
};

function poolConds(){
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const conds = new Set(), onHit = new Set();
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    for(const e of (fx.conds || [])) conds.add(e.cond);
    for(const e of (fx.condOnHit || [])) onHit.add(e.cond);
  }
  return {conds, onHit};
}

/* The main condition loop's body — bounded by its own anchors, so a rule
   moving out of it is a failure here rather than a silently shorter
   slice (v2.53: a ledger that stops scanning keeps reporting green). */
function metChain(){
  const i = SRC.indexOf('const met = cond==="atk" ?');
  assert.ok(i > 0, "the condition loop moved — re-anchor this drill");
  const j = SRC.indexOf("      if(!met)", i);
  assert.ok(j > i, "…and so did its end");
  return SRC.slice(i, j);
}

test("every `fx.conds` condition the pool emits is answered somewhere", {skip}, () => {
  const {conds} = poolConds();
  const body = metChain();
  const unanswered = [];
  for(const c of conds){
    if(PATTERNED.some(rx => rx.test(c))) continue;
    if(ELSEWHERE[c]){
      assert.match(SRC, ELSEWHERE[c], c + " claims another evaluator that is not there");
      continue;
    }
    if(body.indexOf('cond==="' + c + '"') < 0 && body.indexOf('cond === "' + c + '"') < 0)
      unanswered.push(c);
  }
  assert.deepEqual(unanswered, [],
    "a condition the parser emits and nothing answers reads FALSE — silently, " +
    "correctly (v3.26), and with the card doing nothing while its tier says `full`");
});

test("the emitted SET is pinned, so a new condition is a deliberate edit", {skip}, () => {
  /* A CENSUS THAT QUIETLY STOPPED FINDING ANYTHING would pass by finding
     nothing, which is the failure mode this whole file guards against. */
  const {conds} = poolConds();
  assert.equal(conds.size, 49,
    "49 distinct conditions across the pool. A 50th is fine — add it here AND " +
    "give it an evaluator, which is the whole point of this file. It went 48 -> 49 " +
    "at v3.97, when `way:dealtFused` was built: this drill caught that change on " +
    "the version after it was written, which is what a census is for.");
  /* three spot checks, so the count cannot be met by a scan that
     collected the wrong thing */
  for(const c of ["auras3", "way:dealtFused", "chargedPitch2"])
    assert.ok(conds.has(c), c + " must be in the census");
});

test("every `condOnHit` condition is in that evaluator's own census", {skip}, () => {
  /* THE GAP v3.96 CLOSED, kept as the guard. `condOnHit` is re-checked at
     the HIT and so has its own, smaller evaluator; the parser emits into
     both and nothing was comparing them. */
  const {onHit} = poolConds();
  /* `fused` LEFT THIS LIST AT v3.97. Both cards that emitted it are
     NON-ATTACKS, which open no `pend` — so `condOnHit` could never be
     read for them, and the clause is routed to the late `way:` pass
     instead. A condition leaving is as deliberate an edit as one
     arriving. */
  assert.deepEqual([...onHit].sort(),
    ["auras3", "charged", "chargedPitch2", "drac2", "marked", "pumped"]);
  for(const c of onHit)
    assert.ok(E.condOnHitKnown(c), c + " has no pattern in CONDONHIT_CONDS");
});

test("the `condOnHit` census is a subset of what the main loop answers", {skip}, () => {
  /* A condition can only reach `condOnHit` by being emitted, and every
     emitted condition must be answerable — so anything the smaller
     evaluator names should be answerable by the bigger one too. Where it
     is NOT, that is a fact worth stating rather than a bug: `fused` is a
     declaration-time fact carried on `pend`, and the main loop answers it
     from a local it computed itself. */
  const body = metChain();
  const {onHit} = poolConds();
  for(const c of onHit){
    const inMain = body.indexOf('cond==="' + c + '"') >= 0
                || PATTERNED.some(rx => rx.test(c))
                || !!ELSEWHERE[c];
    assert.ok(inMain, c + " is answered at the hit and nowhere at declaration");
  }
});

test("the other three evaluators' vocabularies are closed too", {skip}, () => {
  /* Each of these is a small evaluator with its own vocabulary and its
     own documented default of FALSE (v3.26's rule, and each is a NAMED
     function so that default is reachable by a drill — no card fixture
     can drive it, because the parser only emits what the evaluator
     knows). Pinned so a fourth vocabulary cannot appear unnoticed. */
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const defSelf = new Set(), asInstant = new Set(), actIf = new Set();
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    if(fx.defSelf) defSelf.add(fx.defSelf.when);
    if(fx.asInstant && fx.asInstant.cond) asInstant.add(fx.asInstant.cond);
    if(fx.activateIf) actIf.add(fx.activateIf.kind);
  }
  assert.deepEqual([...defSelf].sort(),
    ["addCostPaid", "arcDealt", "atkActionCostLe", "fromArsenal", "weaponAttack", "withHandDefender"]);
  assert.deepEqual([...actIf].sort(),
    ["atkNamed", "boosted", "controlPow", "defending", "foeTurn", "hits", "playedNamed", "unreadable"],
    "`unreadable` is in the list on purpose — an activation condition with no " +
    "reader REFUSES rather than running unrestricted (v3.04)");
  /* and every `defSelf` name has a branch in its evaluator */
  for(const w of defSelf)
    assert.ok(SRC.indexOf('when === "' + w + '"') > 0 || SRC.indexOf('when==="' + w + '"') > 0,
      w + " has no branch in defSelfMet");
});
