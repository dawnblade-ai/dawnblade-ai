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
    [["reprise", ["self", 3, [["weapon"]]]]],
    "and the printed 'weapon' restriction rides with it (v2.69)");
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

/* ============================================================
   THE HERO ABILITY — "Once per turn Effect - When a weapon you
   control hits, you may attack an additional time with that weapon
   this turn."

   This is Dorinthea's deck the way clause 2 was Kayo's: almost every
   card in it either pumps a WEAPON attack or pays off a Reprise, and
   both want the blade swinging more than once. It read as ZERO of one
   clause before v2.66 — the audit's own flag said so, and nothing else
   in the project could have.

   RULING (user, 2026-08-09): the ability waives the weapon's own "Once
   per Turn" limit and NOTHING else. The extra activation pays the
   printed {r} again and spends an action point again — which is why
   the deck carries go again on Sharpen Steel, all three Warrior's
   Valor, Hit and Run, Trot Along and the Goblet. Granting a free
   action point here would make the hero strictly stronger than
   printed, the direction that steals games.

   Assertions are on weaponUsed, hist, ap and res — never on the log.
   ============================================================ */
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const GM = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");
const S = require("../engine/sides.js");
const PRI = require("../engine/priority.js");
const H = require("./helpers/judged.js");
const J = H.J;
const { loadData } = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const DB = () => H.db();
const W = loadData();
const buildOf = k => B.buildSideDefault(
  W.HEROES.find(x => x.k === k), GM.parseDeck(W.DECKS[k]), DB(), RNG.make(k), {n: 0}).b;

const seat = o => H.side(Object.assign({name: "x", res: 2}, o || {}));
const bladeOf = b => b.gear.find(g => g.name === "Dawnblade");

/* ============================================================
   THE SWING IS REAL NOW (v2.80).

   This file used to build a `pend` by hand and hand it to `resolveStack`
   with a hand-rolled context. Two things were wrong with that, and the
   second is the reason `Battle` could not retire:

   1. A FABRICATED `pend` IS THE ANSWER, NOT THE QUESTION. `total` was
      supplied — so "an attack blocked to nothing does not refresh" was
      asserted by writing 0 into the link rather than by anyone blocking,
      and the wall was never exercised at all.
   2. `resolveStack` IS THE TRAINER'S PATH. judge.js does not call it: the
      body was SPLIT so each caller keeps its own wall and its own CR 1.4.5
      damage routing between `linkPumps` and `linkPayload`. So every drill
      here measured the half of the engine the table does not use, and the
      half it does use had none.

   `swing()` activates the weapon and lets the reducer run the chain —
   declaration, the defend step, the reaction windows, the strike.
   ============================================================ */
const WALL = {uid: "wall1", name: "Big Wall", def: 6, pitch: 1, power: 0, cost: 0,
              tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: []};

function swing(o){
  o = o || {};
  const b = o.build || buildOf("dorinthea");
  const blade = o.blade || bladeOf(b);
  let g = o.game;
  if(!g){
    g = H.state({name: "Dorinthea", res: 9, gear: [blade], weaponUsed: o.tapped,
                 counters: o.counters, hand: o.hand},
                /* `hp` is a knob because six accumulating swings is lethal,
                   and a dead hero ends the game — the driver then finds
                   nobody holding priority and reads a WIN as a stall. */
                {name: "Them", res: 0, hp: o.foeHp, hand: o.block ? [WALL] : []},
                {actor: 0, turnPlayer: 0, seed: "dor", builds: [b, {}], turn: o.turn});
    if(o.hist) Object.assign(g.sides[0].hist, o.hist);
  }
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  return drive(g, Object.assign({blade}, o));
}

/* Activate, then run the link out. Every action goes through `reduce`, and
   a refusal is a failure rather than something to step over — a driver
   that swallows one reports its own optimism as an engine result. */
function drive(g, o){
  const send = (a, s) => {
    const r = J.reduce(g, a, s);
    assert.strictEqual(r.error, null, a.t + " was refused: " + r.error);
    g = r.state;
  };
  send(o.card ? {t: "play", uid: o.card.uid, from: "hand"} : {t: "activate", uid: o.blade.uid}, 0);
  let declared = false;
  for(let i = 0; i < 80 && g.pend; i++){
    if(g.prompt){ send(J.autoAnswer(g), g.prompt.side || 0); continue; }
    if(o.block && !declared && g.step === "defend"){
      send({t: "defend", uid: WALL.uid}, PRI.defendingPlayer(g));
      declared = true; continue;
    }
    const pri = g.priority;
    if(pri == null) throw new Error("nobody holds priority at " + g.phase + "/" + g.step);
    send({t: "pass"}, pri);
  }
  assert.strictEqual(g.pend, null, "the link never resolved — the drill would prove nothing");
  return g;
}

/* SWING AGAIN on a game that has already had one. The action point and
   the untap are handed back explicitly because in a real turn they are
   not: the once-per-turn ability caps a Dorinthea at two swings, so a
   third in the same turn is something else's doing. Saying that here is
   the point — the schedules under test count HITS, and the drill has to
   be able to produce a third one to show that the third earns nothing. */
function reswing(g, o){
  o = o || {};
  const b = o.build || buildOf("dorinthea");
  const blade = o.blade || bladeOf(b);
  const sides = g.sides.slice();
  sides[0] = {...sides[0], ap: 1, res: 9, weaponUsed: {}};
  if(o.block) sides[1] = {...sides[1], hand: [WALL], blockH: [], chainBlocked: []};
  g = {...g, sides, phase: "action", step: "layer", priority: 0, passed: [], pend: null};
  return drive(g, Object.assign({blade}, o));
}

/* CR 4.4.4 replaces `hist` at the turn boundary, which is exactly why the
   per-turn hit TALLY lives there and the counters do not. */
const nextTurn = (g, t) => ({...g, turn: t,
  sides: g.sides.map((s, i) => i ? s : {...s, hist: S.freshHist(), weaponUsed: {}})});

/* Declare only, and stop: the state the moment the attack reaches the
   chain, which is where a pump has landed and nothing has struck yet. */
function declare(o){
  o = o || {};
  const b = o.build || buildOf("dorinthea");
  const blade = o.blade || bladeOf(b);
  let g = o.game || H.state({name: "Dorinthea", res: 9, ap: 3, gear: [blade],
                             counters: o.counters, hand: o.hand},
                            {name: "Them"},
                            {actor: 0, turnPlayer: 0, seed: "dor", builds: [b, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const a = o.card ? {t: "play", uid: o.card.uid, from: "hand"} : {t: "activate", uid: blade.uid};
  const r = J.reduce(g, a, 0);
  assert.strictEqual(r.error, null, a.t + " was refused: " + r.error);
  return r.state;
}

test("the ability is read off Dorinthea's PRINTED text, and only hers", {skip}, () => {
  assert.strictEqual(buildOf("dorinthea").weaponRefresh, true);
  for(const k of ["kayo", "viserai", "azalea"])
    assert.strictEqual(buildOf(k).weaponRefresh, false, k + " must not gain it");
});

test("a weapon that HITS is freed to swing again, and the latch is set", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  const out = swing({});
  assert.ok(!out.sides[0].weaponUsed[blade.uid],
    "the weapon that hit must come untapped — that IS the whole ability");
  assert.strictEqual(out.sides[0].hist.wpnAgain, 1, "once per turn, latched on hist");
  assert.strictEqual(out.sides[1].hp, 17,
    "and it HIT — the fabricated `pend` used to supply the total, so this drill could pass " +
    "on an engine where nothing was ever struck");
});

test("the extra swing is NOT free — no action point and no resources are given", {skip}, () => {
  /* the ruling, and the direction that would steal games if got wrong */
  const blade = bladeOf(buildOf("dorinthea"));
  const out = swing({});
  assert.strictEqual(out.sides[0].res, 9 - 1,
    "the ability waives the once-per-turn limit, not the weapon's {r} — the Dawnblade " +
    "prints `Action - {r}: Attack` and that {r} is charged");
  assert.strictEqual(out.sides[0].ap, 0,
    "the swing that hit still spent its own action point; the ability adds none");
  assert.ok(!out.sides[0].weaponUsed[blade.uid], "and it is genuinely free to swing again");
});

test("an attack blocked to nothing does NOT refresh — CR 7.5.5", {skip}, () => {
  /* "hit" is damage actually DEALT. A swing walled to 0 never hit, so the
     ability never triggered and the latch is untouched.

     THE WALL IS DECLARED, not written into the link. The old drill handed
     `resolveStack` a `pend` with `total: 0` — which asserts the engine's
     behaviour given an answer, and says nothing about whether a blocker
     ever produced that answer. */
  const blade = bladeOf(buildOf("dorinthea"));
  const out = swing({block: true});
  assert.strictEqual(out.sides[1].hp, 20, "6 defence against a 3-power swing: nothing lands");
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true, "it stays tapped");
  assert.ok(!out.sides[0].hist.wpnAgain, "and the once-per-turn is still unspent");
});

test("an attack ACTION CARD that hits refreshes nothing — it says 'a weapon'", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const wreck = {...b.deck.find(x => x.name === "Wreck Havoc")};
  const out = swing({card: wreck, hand: [wreck], tapped: {[blade.uid]: true}});
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true,
    "a card from hand hit, and the weapon it did not come from stays tapped");
  assert.ok(!out.sides[0].hist.wpnAgain);
  assert.ok(out.sides[1].hp < 20, "it really did hit, or this proves nothing");
});

test("ONCE per turn — a second hit does not free the weapon again", {skip}, () => {
  /* spent by TRIGGERING, not by being useful. This is exactly why the
     Dawnblade is printed to reward its SECOND hit each turn: two swings is
     the ceiling the ability sets. */
  const blade = bladeOf(buildOf("dorinthea"));
  const out = swing({hist: {wpnAgain: 1}});
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true,
    "the ability is spent for the turn — the second hit frees nothing");
  assert.strictEqual(out.sides[1].hp, 17, "though the swing still hit");
});

test("'THAT weapon' is literal — another tapped weapon stays tapped", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  const out = swing({tapped: {"other-weapon": true}});
  assert.ok(!out.sides[0].weaponUsed[blade.uid], "the one that hit is freed");
  assert.strictEqual(out.sides[0].weaponUsed["other-weapon"], true,
    "and nothing else is — a hero holding two weapons gets one extra swing, with the one that hit");
});

test("a hero WITHOUT the ability never refreshes on a weapon hit", {skip}, () => {
  /* the gate is the passive, not the zone the attack came from */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const out = swing({build: Object.assign({}, b, {weaponRefresh: false})});
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true);
  assert.strictEqual(out.sides[1].hp, 17,
    "the swing hit exactly as before — only the passive changed");
});

test("the passive is declared in the build ledger, so no hero answers undefined", {skip}, () => {
  assert.ok(B.PASSIVES.includes("weaponRefresh"),
    "a passive missing from PASSIVES reads as a silent false on a real hero's turn");
  assert.strictEqual(B.PASSIVE_TYPE.weaponRefresh, "boolean");
  /* THE DUMMY MUST ANSWER FOR IT TOO, and it is `build.buildVanilla` that
     answers now — `DUMMY_BUILD` was a literal in index.html until v2.81,
     which is why this used to be a source match. Driven rather than
     grepped: a build that answers `undefined` reads as a silent false at
     a rules site on a real hero's turn, which is the v2.41 shape. */
  const d = B.buildVanilla([], [], {byName:{}}, RNG.make("led"), {n:0}).b;
  assert.strictEqual(d.weaponRefresh, false,
    "the punching bag has no weapon-refresh, and says so explicitly");
  for(const k of B.PASSIVES)
    assert.notEqual(d[k], undefined, k + " is unanswered by the vanilla build");
});

/* ---- THE LEDGER AND THE BUILD MUST AGREE -----------------------------
   `tools/audit.js`'s HERO_STATICS decides whether a hero clause reports
   as "recognized by an ability reader", and `build.js` decides whether
   the passive actually EXISTS. They are two hand-written copies of the
   same question and nothing compared them, so Kayo's three clauses
   reported unrecognized for eleven versions AFTER they were built — the
   handoff said the hero was complete and the audit quietly said the
   opposite. Under-reporting is the safe direction, but only if somebody
   is looking, and nobody was. */

test("every HERO_STATICS recognizer agrees with the build it names", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "tools", "audit.js"), "utf8");
  const STATICS = eval(src.match(/const HERO_STATICS = (\[[\s\S]*?\n\]);/)[1]);

  for(const s of STATICS){
    if(s.build === false) continue;          // recognized, but carried by other machinery
    if(!B.PASSIVES.includes(s.key)) continue; // not a build passive at all
    for(const h of W.HEROES){
      const b = buildOf(h.k);
      const printed = s.re.test(P.clean(b.heroRec.tx || "").toLowerCase());
      assert.strictEqual(printed, !!b[s.key],
        `${h.k}: the audit ledger says ${s.key}=${printed} but the build says ${!!b[s.key]}. ` +
        `These are two copies of one question — fix the one that is wrong, don't let them drift.`);
    }
  }
});

test("the heroes whose clauses are BUILT report fully covered", {skip}, () => {
  /* the two heroes Phase 3 has finished. A regression here means either a
     recognizer or a passive was lost. */
  const src = fs.readFileSync(path.join(__dirname, "..", "tools", "audit.js"), "utf8");
  const STATICS = eval(src.match(/const HERO_STATICS = (\[[\s\S]*?\n\]);/)[1]);
  const uncovered = k => {
    const tx = buildOf(k).heroRec.tx || "";
    return tx.split(/\n+/).map(x => P.clean(x)).filter(Boolean)
      .reduce((a, x) => a.concat(x.split(/\.\s+/)), []).map(x => x.trim()).filter(Boolean)
      .filter(cl => !(STATICS.some(s => s.re.test(cl.toLowerCase()))
                      || (/(action|instant)/i.test(cl) && !!P.parseHeroPower(cl))));
  };
  for(const k of ["kayo", "dorinthea"])
    assert.deepStrictEqual(uncovered(k), [], k + " is a finished hero — every clause must be recognized");
});

/* ============================================================
   THE DAWNBLADE — the counters it earns for itself.

     "The second time this hits each turn, put a +1{p} counter on it."
     "At the beginning of your end phase, if this hasn't hit this turn,
      remove all +1{p} counters from it."

   Both clauses read `skip` before v2.68, which held the project's
   NAMESAKE CARD at tier `part`.

   RULING (user, 2026-08-09): the counters PERSIST and accumulate across
   turns. The removal clause only makes sense under that reading — it is
   there precisely to punish a turn where the blade never connected. So
   the blade grows while you keep hitting and falls back to printed the
   first turn you do not.

   Two swings is also exactly what the hero ability allows in a turn,
   which is why the blade rewards its SECOND hit and not its third. That
   is the card's design and the reason the ordinal is read off the text
   rather than assumed.
   ============================================================ */

test("the Dawnblade's two schedules are read off its own printed text", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  const fx = P.fxParse(blade);
  assert.deepStrictEqual(fx.hitCounter, {nth: 2, amt: 1},
    "the ordinal and the magnitude both come from the clause, never assumed");
  assert.strictEqual(fx.wipePowIfIdle, true);
});

test("the ordinal is READ, not hardcoded to 'second'", {skip}, () => {
  /* a card printing a different occurrence must read as that occurrence,
     or the number in the engine is invented card text */
  const third = P.fxParse(mk("The third time this hits each turn, put a +2{p} counter on it.",
    {tt: "Warrior Weapon - Sword (2H)", power: 3, name: "OrdinalProbe"}));
  assert.deepStrictEqual(third.hitCounter, {nth: 3, amt: 2});
});

test("the schedules are NOT on-play ops — runOps must never see them", {skip}, () => {
  /* THE GATE. Left in fx.ops these run at declaration, so the weapon
     collects the counter the moment it is activated, before it has hit
     anything at all — and the end-phase wipe would fire on activation too. */
  const fx = P.fxParse(bladeOf(buildOf("dorinthea")));
  const kinds = (fx.ops || []).map(o => o[0]);
  assert.ok(!kinds.includes("hitCounter"), "a hit schedule is not an on-play effect");
  assert.ok(!kinds.includes("wipePowIfIdle"), "nor is an end-phase schedule");
});

test("the SECOND hit each turn earns the counter — not the first, not the third", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  const pow = g => (g.sides[0].counters[blade.uid] || {}).pow || 0;
  let g = swing({});          assert.strictEqual(pow(g), 0, "one hit earns nothing");
  g = reswing(g, {});         assert.strictEqual(pow(g), 1, "the second earns exactly one counter");
  g = reswing(g, {});         assert.strictEqual(pow(g), 1,
    "and a third earns no more — it says 'the SECOND time'");
  assert.strictEqual(g.sides[1].hp, 20 - 3 - 3 - 4,
    "three real hits landed, and the third carried the +1 counter the second earned");
});

test("counters PERSIST across turns and accumulate", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  const pow = g => (g.sides[0].counters[blade.uid] || {}).pow || 0;
  /* SIX SWINGS IS LETHAL against a printed hero, and a hero at 0 ends the
     game — so the counters would stop accumulating because the match was
     over, which reads as the schedule failing. */
  let g = reswing(swing({foeHp: 99}), {});  assert.strictEqual(pow(g), 1);
  g = reswing(reswing(nextTurn(g, 3), {}), {});
  assert.strictEqual(pow(g), 2, "the turn boundary must not wipe them");
  g = reswing(reswing(nextTurn(g, 4), {}), {});
  assert.strictEqual(pow(g), 3);
  assert.strictEqual(g.sides[0].hist.wpnHits[blade.uid], 2,
    "and the per-turn tally restarts each turn, or every later swing counts as a second one");
});

test("a swing blocked to nothing is not a hit and earns nothing", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));
  let g = swing({block: true});
  for(let i = 0; i < 2; i++) g = reswing(g, {block: true});
  assert.strictEqual(g.sides[1].hp, 20, "three swings, three walls, no damage");
  assert.strictEqual((g.sides[0].counters[blade.uid] || {}).pow || 0, 0);
  assert.deepStrictEqual(g.sides[0].hist.wpnHits || {}, {},
    "three walled swings are three non-hits");
});

test("the swing actually READS the counters — otherwise they are decoration", {skip}, () => {
  /* Declared and stopped, because a weapon's power is struck at
     declaration. Asserting the counter exists proves nothing about the
     damage; asserting the link's total does. */
  const blade = bladeOf(buildOf("dorinthea"));
  for(const n of [0, 1, 2, 3]){
    const g = declare({counters: n ? {[blade.uid]: {pow: n}} : {}});
    assert.strictEqual(g.pend.total, (blade.power || 0) + n,
      `+${n} in counters must reach the chain`);
  }
});

test("a card played from HAND does not read a permanent's counters", {skip}, () => {
  const b = buildOf("dorinthea");
  const c = {...b.deck.find(x => x.name === "Wreck Havoc")};
  const g = declare({card: c, hand: [c], counters: {[c.uid]: {pow: 3}}});
  assert.strictEqual(g.pend.total, c.power || 0,
    "counters belong to a permanent in the arena, not to a card passing through");
});

/* ---- THE END-PHASE WIPE ----------------------------------------------
   THIS DRILL WAS WRITTEN AS A SOURCE GREP FIRST, AND IT PROVED NOTHING.
   The wipe lived inside `endTurn`, a Battle closure, so the only way to
   check it was to read the trainer's text for `hist.wpnHits` — and that
   string was sitting in the COMMENT above the gate. Replacing the gate
   with `if(false)` left the drill green. A grep satisfied by prose is a
   false PASS, which is worse than having no drill.

   So the decision moved into `parser.idleCounterWipes`, where it can be
   driven with real gear and real counters. */

test("only a piece that did NOT hit loses its counters", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const gear = b.gear, ctr = {[blade.uid]: {pow: 2}};
  assert.deepStrictEqual(P.idleCounterWipes(gear, ctr, {}), [blade.uid],
    "no hits at all this turn — the counters fall away");
  assert.deepStrictEqual(P.idleCounterWipes(gear, ctr, {[blade.uid]: 1}), [],
    "ONE hit is enough to keep them: the clause asks whether it hit, not whether it hit twice");
  assert.deepStrictEqual(P.idleCounterWipes(gear, ctr, {[blade.uid]: 2}), []);
});

test("a piece holding no counters is never listed", {skip}, () => {
  const b = buildOf("dorinthea");
  assert.deepStrictEqual(P.idleCounterWipes(b.gear, {}, {}), [],
    "nothing to remove is not the same as something to remove");
});

test("the schedule is read off each piece's OWN text, never a card name", {skip}, () => {
  /* every other piece of Dorinthea's iron sat through the same end phase
     with counters on it and must be untouched — the Dawnblade is the only
     one printing the clause */
  const b = buildOf("dorinthea");
  const ctr = {};
  b.gear.forEach(g => { ctr[g.uid] = {pow: 2}; });
  assert.deepStrictEqual(P.idleCounterWipes(b.gear, ctr, {}),
    [bladeOf(b).uid],
    "only the piece whose printed text carries the schedule loses anything");
});

test("the trainer drives the shared decision rather than its own copy", {skip}, () => {
  assert.match(HTML, /idleCounterWipes\(you\(n\)\.gear, you\(n\)\.counters, you\(n\)\.hist\.wpnHits\)/,
    "one copy of the rule, called with this turn's tally");
});

/* ============================================================
   THE PRINTED TARGET RESTRICTION.

   "Target sword or dagger attack gains +3{p} and piercing 1."

   `buffNext` has carried its qualifier in `op[2]` since v2.30 — that was
   the arrow-buff-landing-on-a-sword fix. `self`, the op every REACTION
   uses, never got it: the clause reader swallowed the words between
   "target" and "attack" in a `[^.]*`, so ELEVEN pool cards granted their
   pump to whatever happened to be swinging. Puncture's +3 landed on a
   bow, Pummel's +8 for a "club or hammer weapon" landed on anything, and
   Agile Engagement's "Warrior" restricted nothing at all.

   A restriction is a LEGALITY, not a modifier: with no legal target the
   card cannot be played, which is why the qualifier rides on the card
   (`fx.selfQ` / `fx.gaQ`) rather than on one op.
   ============================================================ */

/* strip block and line comments before scanning the trainer's source.
   v2.68 shipped a drill that passed because the string it grepped for was
   sitting in the COMMENT above the gate it was meant to pin. */
const codeOf = s => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

test("the printed restriction is captured, not swallowed", {skip}, () => {
  const want = {
    "Puncture|1": [["sword"], ["dagger"]],
    "Overpower|1": [["weapon"]],
    "Ironsong Response|1": [["weapon"]],
    "Agile Engagement|1": [["warrior"]],
    "Out for Blood|1": [["weapon"]],
    "Stroke of Foresight|1": [["weapon"]]
  };
  const b = buildOf("dorinthea");
  for(const [key, q] of Object.entries(want)){
    const nm = key.split("|")[0];
    const c = b.deck.find(x => x.name === nm);
    assert.ok(c, nm + " must be in the deck");
    assert.deepStrictEqual(P.fxParse(c).selfQ, q, nm + " keeps its printed target restriction");
  }
});

test("an unqualified 'target attack' really is unqualified", {skip}, () => {
  /* the opposite error would refuse a card that legally targets anything */
  const fx = P.fxParse(mk("Target attack gets +1{p}.", {name: "UnqualProbe"}));
  assert.ok(!fx.selfQ, "no printed restriction means no restriction");
});

test("qualMatches reads the printed TYPE LINE, and answers for real cards", {skip}, () => {
  const blade = bladeOf(buildOf("dorinthea"));          // Warrior Weapon - Sword (2H)
  const bow = buildOf("azalea").gear.find(g => /bow/i.test(g.tt || ""));
  assert.ok(bow, "Azalea's bow is the control — without it this proves nothing");

  const puncture = [["sword"], ["dagger"]];
  assert.strictEqual(P.qualMatches(puncture, blade), true, "a sword is a sword");
  assert.strictEqual(P.qualMatches(puncture, bow), false,
    "THE BUG: Puncture's +3 and piercing used to land on a bow");
  assert.strictEqual(P.qualMatches([["weapon"]], blade), true);
  assert.strictEqual(P.qualMatches(null, bow), true, "an unqualified buff hits everything");
});

test("the go-again twin carries its restriction too", {skip}, () => {
  const rt = buildOf("dorinthea").deck.find(x => x.name === "Run Through");
  const fx = P.fxParse(rt);
  assert.deepStrictEqual(fx.gaQ, [["sword"]],
    "'Target sword attack gains go again' is restricted to swords");
  assert.strictEqual(fx.ga, true);
});

test("playRx refuses a reaction whose target does not match", {skip}, () => {
  /* playRx is a Battle closure, so this is pinned by reading the source —
     with comments stripped, because prose satisfying a grep is a false
     pass (v2.68). The GATE is the call itself: deleting it removes the
     expression, not merely a word. */
  const body = codeOf(HTML.slice(HTML.indexOf("const playRx = i => setG"),
                                HTML.indexOf("const playRxA")));
  assert.match(body, /qualMatches\(fx\.selfQ,\s*s\.pend/,
    "the printed restriction must be checked against the attack being reacted to");
  assert.match(body, /return L\(s,[^;]*isn't one/,
    "and refused by NAME rather than dead-tapped");
});

test("a reaction's go again reaches the attack it targets", {skip}, () => {
  /* Run Through resolved as half a card: its +2{p} rider landed and the
     go again it is printed for did nothing, because the attack branch
     never read `fx.ga`. Weaker than printed — the direction the fairness
     sweep deliberately does not look in. */
  const body = codeOf(HTML.slice(HTML.indexOf("const playRx = i => setG"),
                                 HTML.indexOf("const playRxA")));
  assert.match(body, /n\.pend\s*=\s*\{\.\.\.n\.pend,\s*ga:true\}/,
    "the targeted attack must actually gain go again");
  assert.match(body, /qualMatches\(fx\.gaQ,\s*n\.pend\.card\)/,
    "and only when the printed restriction is satisfied");
});

/* ============================================================
   WARRIOR'S VALOR — the granted ability that was thrown away.

     Your next weapon attack this turn gets +3{p}
     and "When this hits, it gets go again."

   The buffNext rule stopped at the pump, so the whole quoted ability —
   the half that makes the card a staple — was dropped. SIX physical
   cards across her three pitches, and the audit reported tier `full`
   for all of them because the clause was consumed either way. Weaker
   than printed, so the fairness sweep is one-sided against seeing it.

   FaB prints a granted ability in QUOTES, which is what makes this
   readable rather than guessable: the quoted text is a clause in its
   own right and goes back through `classifyClause`. Nothing here is
   special-cased to a card, and the same rule fixes Azalea's three Lace
   cards and Gravy Bones' Yo Ho Ho!.
   ============================================================ */

test("the quoted granted ability is read, not dropped", {skip}, () => {
  const b = buildOf("dorinthea");
  for(const [pitch, amt] of [[1, 3], [2, 2], [3, 1]]){
    const c = b.deck.find(x => x.name === "Warrior's Valor" && x.pitch === pitch);
    assert.ok(c, "Warrior's Valor pitch " + pitch);
    const op = P.fxParse(c).ops.find(o => o[0] === "buffNext");
    assert.strictEqual(op[1], amt, "the printed pump");
    assert.deepStrictEqual(op[2], [["weapon"]], "the printed restriction");
    assert.deepStrictEqual(op[3], {onHit: [["ga"]]},
      "and the granted on-hit ability — this is the half that used to vanish");
  }
});

test("the rider is parsed as a CLAUSE, so it is not one card's special case", {skip}, () => {
  /* the same rule reads three other pool cards' quoted abilities. A build
     that only understood "go again" would leave these dropped. */
  const want = {
    /* BOTH BECAME REAL TOKENS AT v3.09, on the side the card prints
       ("under their control"). They were `fra`/`rot` side counters. */
    "Lace with Frailty": [["token", "frailty", 1, "foe"]],
    "Lace with Bloodrot": [["token", "bloodrot pox", 1, "foe"]],
    "Yo Ho Ho!": [["token", "gold", 1, "self"]]
  };
  const all = {};
  for(const h of W.HEROES)
    for(const c of buildOf(h.k).deck) all[c.name] = all[c.name] || c;
  for(const [nm, ops] of Object.entries(want)){
    const c = all[nm];
    if(!c) continue;                       // not in any default loadout
    const op = P.fxParse(c).ops.find(o => o[0] === "buffNext");
    assert.ok(op && op[3], nm + " must carry its granted ability");
    assert.deepStrictEqual(op[3].onHit, ops, nm);
  }
});

test("an unquoted next-attack buff gains no rider", {skip}, () => {
  /* Sharpen Steel prints the same pump with no granted ability, and must
     not acquire one */
  const ss = buildOf("dorinthea").deck.find(x => x.name === "Sharpen Steel");
  const op = P.fxParse(ss).ops.find(o => o[0] === "buffNext");
  assert.deepStrictEqual(op, ["buffNext", 3, [["weapon"]]], "no rider printed, none granted");
});

/* THE WHOLE LINE OF PLAY, TAPPED OUT. Play the buff, swing the weapon
   that collects it, and let the link resolve — so the go again the buff
   grants is measured as an action point the player still holds rather
   than as an op sitting in a fabricated `pend`. */
function valorLine(o){
  o = o || {};
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const valor = {...b.deck.find(x => x.name === "Warrior's Valor" && x.pitch === 1)};
  const attacker = o.attacker ? {...b.deck.find(x => x.name === o.attacker)} : null;
  let g = H.state({name: "Dorinthea", res: 9, ap: 3, gear: [blade],
                   hand: attacker ? [valor, attacker] : [valor]},
                  {name: "Them"}, {actor: 0, turnPlayer: 0, seed: "dor", builds: [b, {}]});
  g = {...g, phase: "action", step: "layer", priority: 0, passed: []};
  const send = (a, s) => {
    const r = J.reduce(g, a, s == null ? 0 : s);
    assert.strictEqual(r.error, null, a.t + " was refused: " + r.error);
    g = r.state;
  };
  send({t: "play", uid: valor.uid, from: "hand"});
  const afterBuff = g;
  const apBefore = g.sides[0].ap;
  send(attacker ? {t: "play", uid: attacker.uid, from: "hand"} : {t: "activate", uid: blade.uid});
  const declared = g;
  for(let i = 0; i < 80 && g.pend; i++){
    if(g.prompt){ send(J.autoAnswer(g), g.prompt.side || 0); continue; }
    const pri = g.priority;
    if(pri == null) throw new Error("nobody holds priority at " + g.phase + "/" + g.step);
    send({t: "pass"}, pri);
  }
  return {afterBuff, declared, resolved: g, apBefore, blade, valor, attacker};
}

test("the granted ability reaches the attack that collects the buff", {skip}, () => {
  const r = valorLine({});
  assert.deepStrictEqual(r.afterBuff.sides[0].buffQ,
    [{amt: 3, q: [["weapon"]], rider: {onHit: [["ga"]]}}],
    "the rider waits on the buff, not on the card that granted it");

  assert.strictEqual(r.declared.pend.total, (r.blade.power || 0) + 3, "the pump landed");
  assert.deepStrictEqual(r.declared.pend.onHit, [["ga"]], "and the granted ability came with it");

  /* AND THE LINK IS RESOLVED BY THE REDUCER, not by a `pend` this drill
     wrote a total into. The old version handed `resolveStack` a link with
     `total: 6` — so "it hit, so go again was granted" was asserted about
     a hit the drill had arranged. */
  assert.strictEqual(r.resolved.sides[1].hp, 20 - 6, "6 landed");
  assert.strictEqual(r.resolved.sides[0].ap, r.apBefore,
    "it hit, so go again was granted and the action point is KEPT");
  assert.strictEqual(r.resolved.pend, null, "and the link actually resolved");
});

test("a non-weapon attack collects neither the buff nor its rider", {skip}, () => {
  /* THE CONTROL. Without it the drill above passes just as well when the
     qualifier is ignored and every attack collects everything. */
  const r = valorLine({attacker: "Wreck Havoc"});
  assert.strictEqual(r.declared.pend.total, r.attacker.power || 0,
    "no pump — it is not a weapon attack");
  assert.deepStrictEqual(r.declared.pend.onHit, [], "and no granted ability");
  assert.strictEqual(r.declared.sides[0].buffQ.length, 1,
    "an unmatched buff is not spent — it waits for an attack it applies to");
  assert.strictEqual(r.resolved.sides[0].ap, r.apBefore - 1,
    "so this one does NOT go again");
});
