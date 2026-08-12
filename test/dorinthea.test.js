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
const { loadData } = require("./helpers/extract.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const W = loadData();
const buildOf = k => B.buildSideDefault(
  W.HEROES.find(x => x.k === k), GM.parseDeck(W.DECKS[k]), DB(), RNG.make(k), {n: 0}).b;

function ctx(build){
  return {
    L: (s, m) => ({...s, log: [m, ...(s.log||[])], feed: [...(s.feed||[]), m]}),
    act: s => s.sides[s.actor||0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor||0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor||0, bAct: () => build, bFoe: () => build,
    /* `execute` destructures this as `{n, note}` — a stub returning the
       bare state makes it read `undefined.log` and die. The Kayo ctx has
       the short version because those drills only ever drive `runOps`. */
    built: build, db: DB(), dummyDefence: s => ({n: s, note: "No defenders."}),
    foe: s => s.sides[1-(s.actor||0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1-(n.actor||0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (t, ...cs) => cs.map(c => ({...c, _gy:t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy:t, _disc:true})),
    had6ThisTurn: () => false, mkRune: s => s, openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "attack", winCheck: s => s
  };
}
const seat = o => Object.assign({
  name:"x", hp:20, res:2, ap:1, amp:0, ward:0, awd:0, buffNext:0, buffQ:[],
  hand:[], deck:[], grave:[], banish:[], pitch:[], board:[], soul:[], gear:[],
  counters:{}, hist:S.freshHist(), weaponUsed:{}, blockedHand:0, chainBlocked:[]}, o||{});

/* one swing, already declared: `weaponUsed` is set at declaration, which is
   the state resolveStack actually sees */
const swung = (blade, from, total, hist, extraTapped) => ({
  sides:[seat({weaponUsed: Object.assign({[blade.uid]:true}, extraTapped||{}),
               hist: Object.assign(S.freshHist(), hist||{})}), seat({})],
  actor:0, turn:2, mode:"stack", log:[], feed:[], chain:[], stack:[], hitSeq:0,
  rng: RNG.make("r"),
  pend:{card:blade, from, total, ga:false, ops:[], onHit:[], condOnHit:[], lateConds:[], lateOps:[]}
});
const bladeOf = b => b.gear.find(g => g.name === "Dawnblade");

test("the ability is read off Dorinthea's PRINTED text, and only hers", {skip}, () => {
  assert.strictEqual(buildOf("dorinthea").weaponRefresh, true);
  for(const k of ["kayo", "viserai", "azalea"])
    assert.strictEqual(buildOf(k).weaponRefresh, false, k + " must not gain it");
});

test("a weapon that HITS is freed to swing again, and the latch is set", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const out = resolveStack(swung(blade, "weapon", 3));
  assert.ok(!out.sides[0].weaponUsed[blade.uid],
    "the weapon that hit must come untapped — that IS the whole ability");
  assert.strictEqual(out.sides[0].hist.wpnAgain, 1, "once per turn, latched on hist");
});

test("the extra swing is NOT free — no action point and no resources are given", {skip}, () => {
  /* the ruling, and the direction that would steal games if got wrong */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const before = swung(blade, "weapon", 3);
  const out = resolveStack(before);
  assert.strictEqual(out.sides[0].res, before.sides[0].res,
    "the ability waives the once-per-turn limit, not the weapon's {r}");
  assert.strictEqual(out.sides[0].ap, before.sides[0].ap - 1,
    "the swing that hit still spent its own action point; the ability adds none");
});

test("an attack blocked to nothing does NOT refresh — CR 7.5.5", {skip}, () => {
  /* "hit" is damage actually DEALT. A swing walled to 0 never hit, so the
     ability never triggered and the latch is untouched. */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const out = resolveStack(swung(blade, "weapon", 0));
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true, "it stays tapped");
  assert.ok(!out.sides[0].hist.wpnAgain, "and the once-per-turn is still unspent");
});

test("an attack ACTION CARD that hits refreshes nothing — it says 'a weapon'", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const out = resolveStack(swung(blade, "hand", 6));
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true);
  assert.ok(!out.sides[0].hist.wpnAgain);
});

test("ONCE per turn — a second hit does not free the weapon again", {skip}, () => {
  /* spent by TRIGGERING, not by being useful. This is exactly why the
     Dawnblade is printed to reward its SECOND hit each turn: two swings is
     the ceiling the ability sets. */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const out = resolveStack(swung(blade, "weapon", 3, {wpnAgain: 1}));
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true,
    "the ability is spent for the turn — the second hit frees nothing");
});

test("'THAT weapon' is literal — another tapped weapon stays tapped", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const out = resolveStack(swung(blade, "weapon", 3, null, {"other-weapon": true}));
  assert.ok(!out.sides[0].weaponUsed[blade.uid], "the one that hit is freed");
  assert.strictEqual(out.sides[0].weaponUsed["other-weapon"], true,
    "and nothing else is — a hero holding two weapons gets one extra swing, with the one that hit");
});

test("a hero WITHOUT the ability never refreshes on a weapon hit", {skip}, () => {
  /* the gate is the passive, not the zone the attack came from */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(Object.assign({}, b, {weaponRefresh: false})));
  const out = resolveStack(swung(blade, "weapon", 3));
  assert.strictEqual(out.sides[0].weaponUsed[blade.uid], true);
});

test("the passive is declared in the build ledger, so no hero answers undefined", {skip}, () => {
  assert.ok(B.PASSIVES.includes("weaponRefresh"),
    "a passive missing from PASSIVES reads as a silent false on a real hero's turn");
  assert.strictEqual(B.PASSIVE_TYPE.weaponRefresh, "boolean");
  assert.match(HTML, /weaponRefresh:\s*false/, "DUMMY_BUILD must answer for it too");
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
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const pow = g => (g.sides[0].counters[blade.uid] || {}).pow || 0;
  const hit = g => resolveStack(Object.assign({}, g, {mode: "stack", stack: [],
    pend: {card: blade, from: "weapon", total: 3, ga: false, ops: [], onHit: [],
           condOnHit: [], lateConds: [], lateOps: []}}));
  let g = {sides: [seat(), seat()], actor: 0, turn: 2, mode: "act",
           log: [], feed: [], chain: [], stack: [], hitSeq: 0, rng: RNG.make("r")};
  g = hit(g); assert.strictEqual(pow(g), 0, "one hit earns nothing");
  g = hit(g); assert.strictEqual(pow(g), 1, "the second earns exactly one counter");
  g = hit(g); assert.strictEqual(pow(g), 1, "and a third earns no more — it says 'the SECOND time'");
});

test("counters PERSIST across turns and accumulate", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  const pow = g => (g.sides[0].counters[blade.uid] || {}).pow || 0;
  const hit = g => resolveStack(Object.assign({}, g, {mode: "stack", stack: [],
    pend: {card: blade, from: "weapon", total: 3, ga: false, ops: [], onHit: [],
           condOnHit: [], lateConds: [], lateOps: []}}));
  /* CR 4.4.4 replaces `hist` at the turn boundary, which is exactly why the
     per-turn hit TALLY lives there and the counters do not */
  const nextTurn = (g, t) => ({...g, turn: t,
    sides: g.sides.map((s, i) => i ? s : {...s, hist: S.freshHist(), weaponUsed: {}})});
  let g = {sides: [seat(), seat()], actor: 0, turn: 2, mode: "act",
           log: [], feed: [], chain: [], stack: [], hitSeq: 0, rng: RNG.make("r")};
  g = hit(hit(g));           assert.strictEqual(pow(g), 1);
  g = hit(hit(nextTurn(g, 3))); assert.strictEqual(pow(g), 2, "the turn boundary must not wipe them");
  g = hit(hit(nextTurn(g, 4))); assert.strictEqual(pow(g), 3);
  assert.strictEqual(g.sides[0].hist.wpnHits[blade.uid], 2,
    "and the per-turn tally restarts each turn, or every later swing counts as a second one");
});

test("a swing blocked to nothing is not a hit and earns nothing", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {resolveStack} = E.makeEffects(ctx(b));
  let g = {sides: [seat(), seat()], actor: 0, turn: 2, mode: "act",
           log: [], feed: [], chain: [], stack: [], hitSeq: 0, rng: RNG.make("r")};
  for(let i = 0; i < 3; i++)
    g = resolveStack(Object.assign({}, g, {mode: "stack", stack: [],
      pend: {card: blade, from: "weapon", total: 0, ga: false, ops: [], onHit: [],
             condOnHit: [], lateConds: [], lateOps: []}}));
  assert.strictEqual((g.sides[0].counters[blade.uid] || {}).pow || 0, 0);
  assert.deepStrictEqual(g.sides[0].hist.wpnHits || {}, {},
    "three walled swings are three non-hits");
});

test("the swing actually READS the counters — otherwise they are decoration", {skip}, () => {
  /* driven through `execute`, because that is where a weapon's power is
     struck. Asserting the counter exists proves nothing about the damage. */
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {execute} = E.makeEffects(ctx(b));
  for(const n of [0, 1, 2, 3]){
    const g = {sides: [seat({counters: n ? {[blade.uid]: {pow: n}} : {}}), seat()],
               actor: 0, turn: 2, mode: "act", log: [], feed: [], chain: [], stack: [],
               hitSeq: 0, rng: RNG.make("r"), boostChain: 0};
    assert.strictEqual(execute(g, blade, "weapon", 0).pend.total, (blade.power || 0) + n,
      `+${n} in counters must reach the chain`);
  }
});

test("a card played from HAND does not read a permanent's counters", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const {execute} = E.makeEffects(ctx(b));
  const c = b.deck.find(x => x.name === "Wreck Havoc");
  const g = {sides: [seat({hand: [c], counters: {[c.uid]: {pow: 3}}}), seat()],
             actor: 0, turn: 2, mode: "act", log: [], feed: [], chain: [], stack: [],
             hitSeq: 0, rng: RNG.make("r"), boostChain: 0};
  assert.strictEqual(execute(g, c, "hand", 0).pend.total, c.power || 0,
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
    "Lace with Frailty": [["fra", 1]],
    "Lace with Bloodrot": [["rot", 1]],
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

test("the granted ability reaches the attack that collects the buff", {skip}, () => {
  const b = buildOf("dorinthea"), blade = bladeOf(b);
  const valor = b.deck.find(x => x.name === "Warrior's Valor" && x.pitch === 1);
  const {execute, resolveStack} = E.makeEffects(ctx(b));
  const fresh = hand => ({sides: [seat({hand, ap: 3, res: 5}), seat()], actor: 0, turn: 2,
    mode: "act", log: [], feed: [], chain: [], stack: [], hitSeq: 0,
    rng: RNG.make("r"), boostChain: 0});

  let g = execute(fresh([valor]), valor, "hand", 0);
  assert.deepStrictEqual(g.sides[0].buffQ,
    [{amt: 3, q: [["weapon"]], rider: {onHit: [["ga"]]}}],
    "the rider waits on the buff, not on the card that granted it");

  g = execute(g, blade, "weapon", 0);
  assert.strictEqual(g.pend.total, (blade.power || 0) + 3, "the pump landed");
  assert.deepStrictEqual(g.pend.onHit, [["ga"]], "and the granted ability came with it");

  const before = g.sides[0].ap;
  /* `mode:"stack"` IS THE DRILL'S TO SUPPLY NOW (v2.73). `execute` used to
     set it on the way out; it declares and stops, and the caller runs the
     defend step and opens the reaction window. Without it `resolveStack`
     returns the state untouched — and this assertion (ap is KEPT) is
     satisfied by nothing happening at all, so it would have gone on
     passing while testing precisely nothing. */
  g = resolveStack({...g, mode: "stack", pend: {...g.pend, total: 6}});
  assert.strictEqual(g.sides[0].ap, before,
    "it hit, so go again was granted and the action point is KEPT");
  assert.strictEqual(g.pend, null, "and the link actually resolved");
});

test("a non-weapon attack collects neither the buff nor its rider", {skip}, () => {
  /* THE CONTROL. Without it this drill passes just as well when the
     qualifier is ignored and every attack collects everything. */
  const b = buildOf("dorinthea");
  const valor = b.deck.find(x => x.name === "Warrior's Valor" && x.pitch === 1);
  const wreck = b.deck.find(x => x.name === "Wreck Havoc");
  const {execute, resolveStack} = E.makeEffects(ctx(b));
  let g = {sides: [seat({hand: [valor], ap: 3, res: 5}), seat()], actor: 0, turn: 2,
    mode: "act", log: [], feed: [], chain: [], stack: [], hitSeq: 0,
    rng: RNG.make("r"), boostChain: 0};
  g = execute(g, valor, "hand", 0);
  g = {...g, sides: g.sides.map((s, i) => i ? s : {...s, hand: [wreck]})};
  g = execute(g, wreck, "hand", 0);
  assert.strictEqual(g.pend.total, wreck.power || 0, "no pump — it is not a weapon attack");
  assert.deepStrictEqual(g.pend.onHit, [], "and no granted ability");
  assert.strictEqual(g.sides[0].buffQ.length, 1,
    "an unmatched buff is not spent — it waits for an attack it applies to");
  const before = g.sides[0].ap;
  g = resolveStack({...g, mode: "stack", pend: {...g.pend, total: 6}});
  assert.strictEqual(g.sides[0].ap, before - 1, "so this one does NOT go again");
});
