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
  defAtkAction: /RX_CONDS/,
  hasGa:      /LATE_CONDS/                               /* quickstrike, settled with `pumped` (v3.99) */
};

/* THE PARAMETERISED HALF OF `ELSEWHERE` (v3.99). `chainLinkGe4` carries
   its printed threshold in its name, so it cannot be a literal key — and
   skipping it as merely PATTERNED would be weaker than this census is
   meant to be, because that list asserts nothing about who answers.
   Each entry claims an evaluator BY NAME and the drill checks the claim. */
const PATTERNED_ELSEWHERE = [
  [/^chainLinkGe\d+$/, /isLateCond/]                     /* rupture, settled in linkPumps (v3.99) */
];

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
    const pe = PATTERNED_ELSEWHERE.find(([rx]) => rx.test(c));
    if(pe){
      assert.match(SRC, pe[1], c + " claims another evaluator that is not there");
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
  assert.equal(conds.size, 50,
    "50 distinct conditions across the pool. A 51st is fine — add it here AND " +
    "give it an evaluator, which is the whole point of this file. It went 48 -> 49 " +
    "at v3.97 (`way:dealtFused`) and 49 -> 51 at v3.99 (`hasGa` and `chainLinkGe4` — " +
    "two keyword-gated lines whose gate the loose matchers were eating): this drill " +
    "caught BOTH on the version after they were written, which is what a census is " +
    "for. IT ALSO GOES DOWN, and that is the same signal: 51 -> 50 at v4.12, when " +
    "`revBlue` lost its only claimant. Flying High was its ONE emitter and \"it\" " +
    "there is the next attack rather than a revealed card, so the condition had never " +
    "once been asked about the thing it names — retired rather than left as a rule " +
    "nobody can reach (v3.77, v3.82).");
  /* spot checks, so the count cannot be met by a scan that
     collected the wrong thing */
  for(const c of ["auras3", "way:dealtFused", "chargedPitch2", "hasGa", "chainLinkGe4"])
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

/* ---- THE QUALIFIER ATOMS, CENSUSED THE SAME WAY (v3.98) -------------- */

test("every qualifier atom the pool emits is tested by `qualMatches`", {skip}, () => {
  /* THE SAME QUESTION, ONE READER OVER. `qualMatches` is the single
     matcher for five families of single-shot grant (v3.31, v3.37, v3.64),
     and the parser fills their qualifiers from `attackQual` and its
     neighbours. An atom the parser emits and the matcher does not test is
     a printed RESTRICTION silently dropped — v2.30's arrow buff landing
     on a sword, which is the direction that steals games.

     IT FOUND ONE, AND IT WAS A SHAPE PROBLEM RATHER THAN A MISSING TEST:
     `instantNextQ` entries used to be `{...qualifier, amp}`, mixing the
     grant's PAYLOAD into the object being matched. `amp` is not a
     question about the card, and every other family in the group has kept
     the two apart since it was built. The entry is `{q, amp}` now. */
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const atoms = new Set();
  const take = q => { if(q && typeof q === "object" && !Array.isArray(q))
    for(const k of Object.keys(q)) atoms.add(k); };
  for(const c of arr){
    P.fxReset();
    const fx = P.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    take(fx.selfQ);
    for(const m of (fx.modes || [])) take(m.q);
    for(const o of (fx.ops || [])){
      if(o[0] === "buffNext")    take(o[2]);
      if(o[0] === "gaNext")      take(o[1]);
      if(o[0] === "costOff")     take(o[2]);
      if(o[0] === "atkBuff")     take(o[2]);
      if(o[0] === "defCapNext")  take(o[1]);
      if(o[0] === "instantNext") take(o[1] && o[1].q);
    }
  }
  assert.deepEqual([...atoms].sort(),
    ["aac", "atk", "boosted", "costGe", "costLe", "from", "g", "kw", "nonAtk",
     "pitch", "powLe"],
    "eleven qualifier atoms across the pool. A twelfth needs a test in " +
    "`qualMatches` — an atom the matcher ignores is a printed restriction dropped. " +
    "`pitch` arrived at v4.12 with Flying High, and it is the one atom no tail " +
    "reader sets: a printed COLOUR is a condition on the card the head sentence " +
    "already named, not a restriction on which card the grant waits for.");

  /* AND EVERY ONE IS TESTED. The matcher is read as source because the
     tests are a straight-line chain of early returns; a missing one is a
     key that simply falls through, which is the silent shape. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "parser.js"), "utf8");
  const i = src.indexOf("function qualMatches(qual, card, opts){");
  assert.ok(i > 0, "qualMatches moved — re-anchor this drill");
  const body = src.slice(i, src.indexOf("\nfunction ", i + 10));
  for(const a of atoms)
    assert.ok(body.indexOf("qual." + a) > 0, a + " is emitted and `qualMatches` never asks it");
});

test("a grant entry with no qualifier matches NOTHING", {skip}, () => {
  /* v3.43's rule, and the reason the guard lives at the TAKER rather than
     in the matcher: `qualMatches` answers TRUE for an ABSENT qualifier by
     design — that is correct for a genuinely unqualified grant — so an
     entry that must ALWAYS carry one needs its own guard, or a stale
     entry off a wire silently matches everything.

     THIS IS THE SHAPE CHANGE'S OWN HAZARD: a v4 client writes
     `{...qualifier, amp}`, a v5 client reads `entry.q` as undefined, and
     without the guard the grant would fire on the next card played. The
     handshake refuses the mismatch first (WIRE_V went 4 → 5), and this is
     the second line of defence. */
  const bolt = H.card("Ice Bolt", 1);
  const stale = {g: [["wizard"]], nonAtk: true, amp: 1};   /* the OLD shape */
  const g = H.state({res: 19, ap: 3, hand: [bolt], instantNextQ: [stale]}, {},
                    {actor: 0, turnPlayer: 0, turn: 3});
  const out = H.execute(g, bolt, "hand", 0, {});
  assert.equal((out.sides[0].instantNextQ || []).length, 1,
    "a stale entry is not spent — and, more importantly, not honoured");
  assert.equal(out.sides[0].amp || 0, 0, "and its payload never landed");
  /* the control: the CURRENT shape is honoured */
  const g2 = H.state({res: 19, ap: 3, hand: [H.card("Ice Bolt", 1)],
                      instantNextQ: [{q: {g: [["wizard"]], nonAtk: true}, amp: 1}]}, {},
                     {actor: 0, turnPlayer: 0, turn: 3});
  const out2 = H.execute(g2, g2.sides[0].hand[0], "hand", 0, {});
  assert.equal((out2.sides[0].instantNextQ || []).length, 0, "…so the refusal is the SHAPE");
});

test("the three ALWAYS-qualified grants guard their entries; the three that may be bare do not",
     {skip}, () => {
  /* v3.43's rule, and it had been unlearned FIVE TIMES OVER by the time
     anyone counted. `qualMatches` answers TRUE for an ABSENT qualifier BY
     DESIGN — that is correct for a genuinely unqualified grant, and wrong
     for an entry that is qualified by construction, where an absent `q`
     means a STALE entry off a wire or a replay and honouring it applies
     the grant to everything.

     THE TWO GROUPS, AND THE DIFFERENCE IS THE PRINTED CARD:

       may be bare   `buffQ` `atkBuff` `costOff` — "your next attack gets
                     +3{p}" is printed with no restriction at all, so
                     `q: null` is the FAITHFUL reading
       never bare    `gaNextQ` `instantNextQ` `defCapNext` — every card
                     that writes one names a card type, so no `q` is a
                     stale entry and never a grant

     `takeDefCap` was missing its guard until v3.98, and its own header
     cites `takeGaNext` as "same shape and same rule" — it copied the
     shape and not the guard, which is exactly what v3.43 warns about. */
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const par = fs.readFileSync(path.join(__dirname, "..", "engine", "parser.js"), "utf8");
  const takerBody = nm => {
    const i = src.indexOf("const " + nm + " = (n, card, ctx) => {");
    assert.ok(i > 0, nm + " moved — re-anchor this drill");
    return src.slice(i, src.indexOf("\n  };", i));
  };
  for(const nm of ["takeDefCap", "takeGaNext", "takeInstantNext"])
    assert.match(takerBody(nm), /x && x\.q && qualMatches\(x\.q,/,
      nm + " takes an ALWAYS-qualified grant and must refuse an entry with no qualifier");
  /* AND THE OTHER THREE MUST NOT GROW THE GUARD, or a genuinely
     unqualified grant stops working — "your next attack gets +3{p}" is
     printed with no restriction, and `q: null` is what says so. */
  assert.match(src, /buffQ\|\|\[\]\)\.filter\(b=>qualMatches\(b\.q, card, qCtx\)\)/,
    "buffQ reads `b.q` straight — a null qualifier is the printed reading");
  assert.match(src, /atkBuff\|\|\[\]\)\.filter\(b => qualMatches\(b\.q, n\.pend\.card, _sq\)\)/);
  assert.match(par, /costOff\) \|\| \[\]\)\.find\(x => x && qualMatches\(x\.q, c\)\)/);
});

test("driven: a stale defCap entry caps NOTHING", {skip}, () => {
  /* The observable, not the source: without the guard a stale entry with
     no qualifier caps EVERY attack's wall rather than the one its card
     names — a printed restriction applied to cards that never printed it,
     which is the sev-3 direction. */
  const atk = () => Object.assign(H.card("Wounded Bull", 1), {uid: "a1"});
  const play = entry => {
    const g = H.state({res: 19, ap: 3, hand: [atk()], defCapNext: [entry]}, {},
                      {actor: 0, turnPlayer: 0, turn: 3});
    return H.execute(g, g.sides[0].hand[0], "hand", 0, {});
  };
  const stale = play({n: 2, kind: "nonBlock"});                 /* the pre-guard shape */
  assert.equal((stale.sides[0].defCapNext || []).length, 1, "not spent");
  assert.equal(stale.pend.defCap, null, "and, more importantly, not honoured");

  const live = play({q: {aac: true}, n: 2, kind: "nonBlock"});   /* the current shape */
  assert.equal((live.sides[0].defCapNext || []).length, 0, "spent");
  assert.deepEqual(live.pend.defCap, {n: 2, count: "hand"},
    "…so the refusal above is the SHAPE, not the reader giving up");
});
