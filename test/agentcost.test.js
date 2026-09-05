/* ============================================================
   A DISCARD FROM HAND IS THE FIFTH NAMED ACTIVATION COST (v4.09)

   v3.76 gave Arakni six Agents of Chaos to become. v3.77 recorded that
   **every one of their abilities REFUSED** — five on exactly this cost —
   so the mechanic fired, announced itself in the feed, swapped her whole
   ability half, and left her with an ability nothing reads. In v3.77's
   own words: *the no-op blind spot wearing a hero's face*, and worse
   than an unbuilt card, because the game TELLS the player something
   happened.

     "Once per Turn Attack Reaction - Discard an Assassin card:
      Target Assassin attack gets +3{p}."      — four of the six Agents

   **THE COST WAS THE WHOLE BLOCKER.** Handed the same line with a
   payable cost, `parseHeroPower` answers in full: `kind: "attackRx"`,
   the window reads, the powCard builds, and `effects.attackRx` has
   resolved a targeted pump onto the open link since v3.63. Nothing else
   was missing.

   ---- NAMED, NOT RELAXED -------------------------------------------

   The fifth beside v3.39's counter, v3.74's soul banish, v3.86's named
   permanent and v3.99's turn-this-face-up — each NAMED for the same
   reason: a blanket relaxation raises the tier of cards nothing wires,
   which is the never-parse-ahead-of-wiring rule.

   **THE SUBJECT MUST BE ONE `optFilter` CAN PIN.** A cost whose subject
   the reader cannot name is a cost a player could pay wrongly (v3.53) —
   so the class-qualified "card" is a CLOSED vocabulary, measured: the
   words the pool prints in this position are `assassin`, `shadow`,
   `random` and `yellow`, and only the first two are classes.

   ---- AND A GREEN SUITE SAID NOTHING ABOUT ANY OF IT -----------------

   Two of the three call sites in the first draft named functions that do
   not exist — `creditDiscard`, taken from a COMMENT, and
   `P.promptFilter`, which lives in `prompts.js` and is CURRIED. Both
   would have thrown from inside a reducer whose contract is that it
   never throws, and 2246 drills stayed green because **no drill reached
   the path**. That is the whole argument for driving it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const B = require("../engine/build.js");
const H = require("./helpers/judged.js");
const J = H.J;

const skip = !H.hasDb() && "no cached card database";

const ASSASSIN = {uid: 7101, name: "Agent Probe Assassin", tt: "Assassin Action - Attack",
                  ty: ["Assassin", "Action", "Attack"], power: 3, pitch: 1, cost: 1, def: 2, kw: [], tx: ""};
const GENERIC  = {uid: 7102, name: "Agent Probe Generic", tt: "Generic Action - Attack",
                  ty: ["Generic", "Action", "Attack"], power: 3, pitch: 1, cost: 1, def: 2, kw: [], tx: ""};

function agentPow(frag){
  const a = B.agentsOf(H.db(), "chaos").find(x => new RegExp(frag, "i").test(x.n));
  assert.ok(a, "fixture: no Agent matching " + frag);
  return B.heroAbilities(a, a.n).HPOW;
}

/* ============================================================
   A. THE COST IS READ
   ============================================================ */

test("the cost was the only blocker — everything after it was already built", {skip}, () => {
  /* THE DIAGNOSTIC THAT FOUND IT, kept as the drill. Hand the same line
     a payable cost and `parseHeroPower` answers in full — so the window,
     the powCard and `attackRx`'s targeted pump were never the gap. */
  const withRes = P.parseHeroPower(
    "Once per Turn Attack Reaction - {r}: Target dagger attack gets +3{p}.");
  assert.ok(withRes && withRes.kind === "attackRx",
    "fixture: the line no longer reads even with a payable cost — the gap has moved");

  const withDiscard = P.parseHeroPower(
    "Once per Turn Attack Reaction - Discard an Assassin card: Target dagger attack gets +3{p}.");
  assert.ok(withDiscard, "the discard cost refuses again — four Agents go dark");
  assert.equal(withDiscard.kind, "attackRx");
  assert.equal(withDiscard.cost, 0, "a discard is not a resource cost");
  assert.deepEqual(withDiscard.discardCost.filter, {ty: ["assassin"]});
});

test("the class-qualified subject is a CLOSED vocabulary", {skip}, () => {
  /* MEASURED over the pinned pool: the words printed as "<word> card" in
     a cost position are assassin, shadow, random and yellow. Only the
     first two are CLASSES — `random` is a different mechanic entirely
     (`discardRandom`) and admitting it here builds a filter matching
     nothing, which is an unpayable cost dressed as a payable one; and
     `yellow` is a pitch value that already reads. */
  assert.deepEqual(P.optFilter("an assassin card"), {ty: ["assassin"]});
  assert.deepEqual(P.optFilter("a shadow card"), {ty: ["shadow"]});
  assert.equal(P.optFilter("a random card"), null,
    "'a random card' read as a class — that is a filter matching nothing, so the cost " +
    "becomes unpayable and the ability inert");
  assert.equal(P.optFilter("a nimblism card"), null,
    "an open 'any word before card' re-opens the hole the bare-card refusal protects " +
    "(v3.53) — Nimblism is a card NAME, not a class");
  assert.equal(P.optFilter("a card"), null,
    "the BARE subject still refuses — what makes this one readable is the class");
});

test("an unreadable subject still refuses the whole line", {skip}, () => {
  /* v2.29: half a cost is worse than none. A subject `optFilter` cannot
     pin falls through to the refusal that was always there. */
  assert.equal(P.parseHeroPower(
    "Once per Turn Attack Reaction - Discard a card: Target dagger attack gets +3{p}."), null,
    "a bare-'card' cost was accepted — a player could pay the wrong thing");
  assert.equal(P.parseHeroPower(
    "Once per Turn Attack Reaction - Discard a Nimblism card: Target dagger attack gets +3{p}."), null,
    "a NAME was read as a class");
});

/* ============================================================
   B. THE POWCARD, ON BOTH BUILDERS
   ============================================================ */

test("four Agents build a powCard that carries the cost", {skip}, () => {
  H.db();
  const built = [];
  for(const a of B.agentsOf(H.db(), "chaos")){
    const pw = B.heroAbilities(a, a.n).HPOW;
    if(pw && P.abDiscardCost(pw)) built.push(a.n);
  }
  assert.equal(built.length, 4,
    "the number of Agents whose ability carries its discard cost moved — a cost not " +
    "stamped on the powCard is a cost the ability is never charged (v3.79)");
  const pw = agentPow("Tarantula");
  assert.deepEqual(P.abDiscardCost(pw), {ty: ["assassin"]});
  assert.equal(P.abWindow(pw), "attack-reaction", "the window came free with the cost");
});

test("the filter admits an Assassin card and refuses everything else", {skip}, () => {
  H.db();
  const f = PM.promptFilter(P.abDiscardCost(agentPow("Tarantula")));
  assert.equal(f(ASSASSIN), true);
  assert.equal(f(GENERIC), false,
    "a Generic card pays an Assassin cost — the printed restriction is dropped");
});

/* ============================================================
   C. DRIVEN — REFUSED, THEN CHARGED
   ============================================================ */

function board(hand){
  const g = H.state({hand: hand.slice(), res: 9, ap: 1}, {hp: 20}, {actor: 0, turn: 3});
  return g;
}

test("DRIVEN: an empty-handed seat is REFUSED before the ability resolves", {skip}, () => {
  H.db();
  /* v3.11: refusing AFTER the ability resolves spends the seat's
     once-per-turn allowance on a play the rules never allowed. Both
     boards ask, through `judge.abCostWhy` and the trainer's own block. */
  const pw = agentPow("Tarantula");
  const g = board([GENERIC]);
  /* DRIVE THE REAL ENTRY POINT (v3.20). `abCostWhy` is judge's internal
     one body; what a seat actually meets is `legal`, so that is what is
     asked — a drill that calls the helper proves the helper. */
  const empty = {...g, phase: "action", step: "layer", priority: 0, passed: [],
                 builds: [{HPOW: pw}, {}]};
  const why = J.legal(empty, {t: "activate", uid: "hpow", from: "hero"}, 0);
  assert.ok(why, "a seat holding no Assassin card was allowed to activate");
  assert.match(String(why), /discard|assassin/i,
    "the refusal does not name the cost it refused for: " + why);

  const held = board([ASSASSIN]);
  const ok = J.legal({...held, phase: "action", step: "layer", priority: 0, passed: [],
                      builds: [{HPOW: pw}, {}]}, {t: "activate", uid: "hpow", from: "hero"}, 0);
  assert.ok(!/discard|assassin/i.test(String(ok || "")),
    "a seat HOLDING one was refused for the COST — the control fails, so the refusal " +
    "above proves nothing: " + ok);
});

test("DRIVEN: the discard is actually charged, and it is turn-stamped", {skip}, () => {
  H.db();
  /* THE PATH NO DRILL REACHED. Two of the first draft's three call sites
     named functions that do not exist and 2246 drills stayed green,
     because nothing drove the charge. */
  const pw = agentPow("Tarantula");
  const g = board([ASSASSIN, GENERIC]);
  let out = H.execute(g, pw, {from: "hero", ability: true});
  const n = out.game || out;

  assert.equal((n.sides[0].hand || []).length, 1, "the cost was not charged — the ability is free");
  assert.equal(n.sides[0].hand[0].name, GENERIC.name,
    "the WRONG card paid — the filter is not consulted at the charge, so a player can " +
    "pay something the printed cost excludes");
  const gy = n.sides[0].grave || [];
  assert.equal(gy.length, 1, "the paid card did not reach the graveyard");
  assert.equal(gy[0].name, ASSASSIN.name);
  assert.equal(gy[0]._gy, n.turn,
    "the discard is not turn-stamped — every '…put into a graveyard this turn' clause " +
    "then reads it wrong (v2.23)");
  /* AND IT IS DELIBERATELY NOT IN `_discWay`. That trace answers a
     "…discarded THIS WAY" clause, and "this way" names the way the
     EFFECT describes rather than the way its cost was paid — a cost is
     not the effect. The first draft credited it and the write was
     silently WIPED anyway, because `execute` clears the trace per
     resolution below the charge: two facts, one bug. */
  assert.ok(!(n._discWay || []).some(c => c.name === ASSASSIN.name),
    "a card spent as a PRICE was credited to `_discWay` — a 6-power card paid as a cost " +
    "would then satisfy a clause about what the card DID");
});

test("DRIVEN: an unpayable cost is INERT, never free", {skip}, () => {
  H.db();
  /* v2.04, and it is still guarded even though both boards refuse first:
     `execute` is fed by `reduce`, which is fed by JSON off a wire. */
  const pw = agentPow("Tarantula");
  const g = board([GENERIC]);
  let out = H.execute(g, pw, {from: "hero", ability: true});
  const n = out.game || out;
  assert.equal((n.sides[0].hand || []).length, 1, "a card was discarded that the cost excludes");
  assert.equal((n.sides[0].grave || []).length, 0, "something was paid out of an unpayable cost");
});

test("and the two that stay dark refuse on their PAYLOAD, not their cost", {skip}, () => {
  H.db();
  /* A REFUSAL IS ONLY HONEST IF ITS REASON IS TRUE (v3.41). The cost was
     the reason for five and is the reason for none: Orb-Weaver's payload
     is a token EQUIP and Trap-Door's is a deck SEARCH, neither of which
     has a reader — v2.29 working rather than a gap in this build. */
  const names = B.agentsOf(H.db(), "chaos").map(a => a.n);
  for(const n of names){
    const a = B.agentsOf(H.db(), "chaos").find(x => x.n === n);
    const pw = B.heroAbilities(a, a.n).HPOW;
    if(pw) continue;
    assert.match(String(a.tx), /equip a graphene|search your deck/i,
      n + " refuses for a reason that is neither its payload nor recorded — check WHY");
  }
});

/* ============================================================
   D. THE WHOLE PRINTED LINE (v4.10)
   ============================================================ */

test("`heroAbilityLine` knows every activation prefix, not two of three", {skip}, () => {
  H.db();
  /* v3.39 BUILT THIS READER so a hero's powCard carries the ability's
     WHOLE printed line — `parseHeroPower` answers about the first
     sentence only, and everything after it is re-read by `fxParse` off
     the powCard (v3.71). It matched `action` and `instant` and not
     `attack reaction`, so for the four Agents it found NO line at all
     and fell back to `heroPow.eff` — which is truncated at the first
     period, which is the exact defect it exists to fix.

     v3.63's rule one reader over: when a route learns a third window,
     grep for the readers that ENUMERATE windows. `classifyClause`
     (v3.59) and `parseHeroPower` (v3.63) each had to be told; this is
     the third. */
  const widow = B.agentsOf(H.db(), "chaos").find(a => /Black Widow/.test(a.n));
  assert.ok(widow, "fixture: Black Widow left the Agent set");
  const line = B.heroAbilityLine(widow, P.parseHeroPower(widow.tx));
  assert.match(line, /gets \+3\{p\}/, "the head is gone — the reader now finds no line at all");
  assert.match(line, /if it has stealth/i,
    "the RIDER is truncated away again — the audit cannot see a clause that never " +
    "reaches the powCard, so the gap is invisible rather than visible (v3.41)");

  /* THE COST PREFIX IS STILL STRIPPED, which is what the line is FOR. */
  assert.ok(!/discard an assassin/i.test(line),
    "the cost prefix is on the powCard — `execute` would re-read it as payload");
});

test("the rider is READ, and it narrows the head's restriction", {skip}, () => {
  H.db();
  P.fxReset();
  /* v4.10 CARRIED THESE RIDERS TO THE POWCARD AND LEFT THEM `skip`, with
     a drill saying "check WHAT it built before moving this". v4.11 built
     them, and the reading is that "it" is the attack the FIRST sentence
     targeted — so the rider's qualifier is the head's PLUS the printed
     keyword, which `qualMatches` has answered since v3.31 made "with
     stealth" one of its five tail atoms. No new evaluator. */
  const want = {
    "Redback":     {field: "gaQ",     get: fx => fx.ga && fx.gaQ},
    "Black Widow": {field: "onHitQ",  get: fx => (fx.onHitHero || []).length && fx.onHitQ},
    "Funnel Web":  {field: "onHitQ",  get: fx => (fx.onHitHero || []).length && fx.onHitQ}
  };
  for(const f of Object.keys(want)){
    const a = B.agentsOf(H.db(), "chaos").find(x => new RegExp(f).test(x.n));
    const fx = P.fxParse(B.heroAbilities(a, a.n).HPOW);
    assert.equal(fx.clauses.length, 2, f + ": the rider is not a clause on the powCard");
    assert.equal(fx.clauses[1].st, "run", f + ": the rider is not read");
    const q = want[f].get(fx);
    assert.ok(q, f + ": nothing carries the rider's payload");
    assert.equal(q.kw, "stealth",
      f + ": the printed keyword restriction is DROPPED — the ability is granted to " +
      "every legal target, which is v2.30's arrow buff on a sword");
    assert.deepEqual(q.g, [["assassin"]],
      f + ": the HEAD's restriction is lost — the rider must narrow it, not replace it");
  }
  P.fxReset();
});

test("the keyword vocabulary is CLOSED, and Bravo does not move", {skip}, () => {
  H.db();
  P.fxReset();
  /* AN OPEN "any word after has" reads a card NAME or a type as a
     keyword and silently grants off it (v3.55, v3.66). Measured: the
     pool prints four records of this shape — three Agents (`stealth`)
     and Bravo (`crush`), whose own is an ARSENAL grant read elsewhere
     since v3.73 and MUST NOT move. */
  const probe = {name: "Rider Vocab Probe", pitch: 0, cost: 0, power: null, def: null,
                 tt: "Hero Ability", ty: [], kw: [], gkw: [],
                 tx: 'Target Assassin attack gets +3{p}. If it has nimblism, it gets go again.'};
  const fx = P.fxParse(probe);
  assert.equal(fx.clauses[1].st, "skip",
    "an unknown word was read as a keyword — a card NAME now grants an ability");
  assert.ok(!fx.ga, "…and the grant landed anyway");

  /* AND AN UNREADABLE PAYLOAD REFUSES THE WHOLE RIDER (v2.29). */
  const probe2 = Object.assign({}, probe, {name: "Rider Payload Probe",
    tx: 'Target Assassin attack gets +3{p}. If it has stealth, it gets nothing in particular.'});
  assert.equal(P.fxParse(probe2).clauses[1].st, "skip",
    "an unreadable payload was claimed — half a grant is not a cheap approximation");

  /* AND A `noop` PAYLOAD REFUSES TOO, WHICH IS THE HALF A `null` CANNOT
     REACH (v3.91, second time in this file's own family). A payload
     `classifyClause` answers NULL for never reaches the take loop at all,
     so the fixture above cannot say anything about a clause that IS read
     and has nothing to stamp — and `ops.length` is 1 on a noop, so a
     length test is silent (v3.93). `inertia` is a keyword this engine
     deliberately reads somewhere else, so as a rider payload there is
     nothing to put on the attack: claiming it files the clause `run`
     with NOTHING BUILT, which is the no-op blind spot at its purest. */
  const probe3 = Object.assign({}, probe, {name: "Rider Noop Probe",
    tx: 'Target Assassin attack gets +3{p}. If it has stealth, it gets inertia.'});
  const nf = P.fxParse(probe3);
  assert.equal(P.classifyClause("it gets inertia").status, "noop",
    "the fixture no longer reaches the noop half — pick a payload that READS " +
    "and stamps nothing, or this drill cannot express the bug (v3.62)");
  /* THE CLAUSE STATUS IS NOT THE OBSERVABLE HERE, and saying so is the
     point: the if/when handler recurses into the inner half and PASSES A
     NOOP INNER THROUGH (v2.12), so the whole clause reads `noop` whatever
     the rider does. What must not happen is a GRANT. */
  assert.notEqual(nf.clauses[1].st, "run", "a noop payload was filed as read");
  assert.ok(!nf.ga && !nf.gaQ && !nf.onHitQ && !(nf.onHitHero || []).length &&
            !(nf.onHit || []).length,
    "a noop payload was granted — the attack carries an op that does nothing");
  P.fxReset();
});

test("classifyClause answers exactly two shapes, and the rider leans on it", {skip}, () => {
  H.db();
  P.fxReset();
  /* THE PREMISE THE RIDER'S REFUSAL RESTS ON. v4.11 deleted a
     `pay.status !== "run" || !pay.ops.length` guard beside the take loop
     because it could not express a bug: a NOOP answer is
     `[["noop", why]]`, so it carries no `ga` and no on-hit op and the
     loop refuses it already, and no `run` answer has zero ops. That is a
     property of `classifyClause`, not of the rider — so it is DRIVEN
     over the pinned pool here rather than asserted in prose, and a third
     answer shape fails this drill on the day it is added. */
  const raw = require("../data/pool.json");
  const pool = (Array.isArray(raw) ? raw : (raw.cards || Object.values(raw))).map(c => ({
    name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "", ty: c.types || [],
    tx: c.functional_text || "", kw: c.card_keywords || [],
    cost: c.cost, power: c.power, def: c.defense}));
  let run = 0, noop = 0;
  const seen = new Set();
  for(const r of pool){
    P.fxReset();
    for(const cl of (P.fxParse(r).clauses || [])){
      const t = String(cl.t || "");
      if(!t || seen.has(t)) continue;
      seen.add(t);
      let a = null;
      try { a = P.classifyClause(t.toLowerCase().trim()); } catch(e) { continue; }
      if(a == null) continue;
      if(a.status === "run"){
        run++;
        assert.ok((a.ops || []).length > 0,
          "a `run` answer with no ops: " + t);
      } else {
        noop++;
        assert.equal(a.status, "noop", "a THIRD answer shape: " + a.status + " — " + t);
        assert.deepEqual((a.ops || []).map(o => o[0]), ["noop"],
          "a `noop` answer carrying a real op — the rider's take loop would claim it: " + t);
      }
    }
  }
  /* PROVE THE SCAN ALIVE BEFORE TRUSTING WHAT IT DID NOT FIND (v4.00): a
     scan aimed at the wrong shape passes by finding nothing. Measured at
     v4.11: 686 distinct clauses, 389 `run`, 120 `noop`, 177 refused. */
  assert.ok(run > 300, "the scan stopped finding run clauses (" + run + ") — it is aimed wrong");
  assert.ok(noop > 90, "the scan stopped finding noop clauses (" + noop + ") — it is aimed wrong");
  P.fxReset();
});

test("a hero whose line was already found keeps its reading", {skip}, () => {
  H.db();
  /* THE CONTROL. Widening a prefix list is a change to every hero the
     reader already answered for, so the one whose printed line ALSO ends
     in a period is the one to check: Boltyn's is an attack reaction too,
     and his qualifier must be untouched. */
  const C2 = require("../engine/cards.js");
  const bo = C2.resolveEntry(H.db(), {name: "Boltyn", p: 0, code: null, q: 1});
  const fx = P.fxParse(B.heroAbilities(bo, "Boltyn").HPOW);
  assert.deepEqual(fx.gaQ, {pumped: true},
    "Boltyn's target restriction moved — the widening changed a hero it should not have");
  assert.equal(fx.clauses.length, 1, "his line grew a clause it does not print");
});

test("four Agents do not share one parse — the powCard name IS the memo key", {skip}, () => {
  H.db();
  /* `fxParse` MEMOIZES ON `name|pitch`. CLAUDE.md has documented that as
     a DRILL gotcha since v2.20; here it was a production defect. Four
     Agents built an ability under the name "Arakni — hero power", so
     whichever parsed first decided the TARGET QUALIFIER for all four —
     become Tarantula (target DAGGER), then become Black Widow, and her
     ability still targets daggers.

     LATENT UNTIL v4.09 BUILT THE COST: with every Agent ability refusing
     there was no powCard to collide (v3.72 — building a SOURCE can make
     a defect reachable that was wrong the whole time it could not be).

     DRIVEN IN ORDER, because that is the whole bug: parsing Tarantula
     FIRST is what poisons the key, so a drill that parses Widow alone
     passes against the broken engine. */
  P.fxReset();
  const pow = f => {
    const a = B.agentsOf(H.db(), "chaos").find(x => new RegExp(f, "i").test(x.n));
    assert.ok(a, "fixture: no Agent matching " + f);
    return B.heroAbilities(a, a.n).HPOW;
  };
  const t = pow("Tarantula"), w = pow("Black Widow");
  assert.notEqual(t.name, w.name,
    "two Agents build a powCard under ONE name — `fxParse` memoizes on it, so they " +
    "share a parse and the second Agent inherits the first's target restriction");

  assert.deepEqual(P.fxParse(t).selfQ, {g: [["dagger"]]}, "Tarantula targets a dagger");
  assert.deepEqual(P.fxParse(w).selfQ, {g: [["assassin"]]},
    "Black Widow inherited Tarantula's DAGGER restriction — the memo key collided");
  P.fxReset();
});

test("…and the fifteen playable heroes keep their short powCard name", {skip}, () => {
  H.db();
  /* THE CONTROL, and the reason the fix is not simply "use the full
     name": the comma-split is RIGHT where the part before the comma is
     the identity. The shortest name used is the shortest one that is
     UNIQUE among the heroes a match can hold. */
  const C2 = require("../engine/cards.js");
  for(const n of ["Blaze, Firemind", "Gravy Bones"]){
    const c = C2.resolveEntry(H.db(), {name: n, p: 0, code: null, q: 1});
    const pw = B.heroAbilities(c, n).HPOW;
    assert.ok(pw, "fixture: " + n + " builds no powCard");
    assert.equal(pw.name, n.split(",")[0] + " — hero power",
      n + "'s powCard name moved — the widening reached a hero it should not have");
  }
});

test("DRIVEN: the rider attaches to a stealth target and REFUSES a plain one", {skip}, () => {
  H.db();
  P.fxReset();
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A gate that
     refuses everything passes the plain half perfectly, so the same
     ability is driven at two targets that differ in exactly one printed
     keyword. */
  const E = require("../engine/effects.js");
  const a = B.agentsOf(H.db(), "chaos").find(x => /Black Widow/.test(x.n));
  const pw = B.heroAbilities(a, a.n).HPOW;

  const base = {uid: 7301, name: "Rider Target Plain", tt: "Assassin Action - Attack",
                ty: ["Assassin", "Action", "Attack"], power: 4, pitch: 1, cost: 1,
                def: 2, kw: [], gkw: [], tx: ""};
  const sneaky = Object.assign({}, base, {uid: 7302, name: "Rider Target Stealth",
                 kw: ["Stealth"], tx: "Stealth"});

  const run = tgt => {
    const g = H.state({hand: [ASSASSIN], res: 9, ap: 1}, {hp: 20}, {actor: 0, turn: 3});
    const withPend = Object.assign({}, g, {pend: {card: tgt, by: 0, total: tgt.power,
                                                 ops: [], onHit: [], onHitHero: []}});
    let out = J.withEffects(withPend, (fx, st) => fx.attackRx(st, pw, {hand: 0}));
    return (out.game || out);
  };

  const hit = run(sneaky);
  assert.equal(((hit.pend || {}).onHitHero || []).length, 1,
    "a STEALTH target did not receive the rider — the grant is dead");

  const miss = run(base);
  assert.equal(((miss.pend || {}).onHitHero || []).length, 0,
    "a target with NO stealth received the rider — the printed restriction is dropped, " +
    "which is v2.30's arrow buff on a sword");

  /* THE HEAD LANDS EITHER WAY, which is what makes the two halves
     comparable: the +3 is printed for any Assassin attack and only the
     RIDER is gated.

     AND THE PUMP IS A LAYER, NOT `pend.total` (v4.03) — `attackRx` pushes
     an `{k:"rx"}` layer and `rxPumpTotal` is the one reader of both the
     waiting and the resolved record. The first draft asserted on
     `pend.total` and failed against a correct engine: check what the
     function you are driving actually writes. */
  assert.equal(E.rxPumpTotal(hit), 3, "the head's pump did not land on the stealth target");
  assert.equal(E.rxPumpTotal(miss), 3,
    "the head's pump was gated too — the rider's restriction has leaked onto the printed +3");
  P.fxReset();
});
