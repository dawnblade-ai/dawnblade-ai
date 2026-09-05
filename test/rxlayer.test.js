/* ============================================================
   A RESOLVED LAYER'S EFFECT HAS TO LAND SOMEWHERE (v4.03)

   `effects.attackRx` records an attack reaction's pump ON THE LAYER it
   pushes, and `linkPumps` sums the reaction layers at the damage step.
   That works on the TRAINER, which has no layer-resolution step at all —
   every reaction it has ever played is still sitting on the stack when
   the total is struck.

   THE TABLE POPS THEM, AND IT IS RIGHT TO. CR 4.2.2 resolves the top
   layer when both seats pass in succession, and `windowClosed` requires
   an EMPTY stack before the reaction step can end — so at the table every
   reaction layer is gone before `strike` runs, and summing the survivors
   summed nothing. **Every attack-reaction pump was dropped at the table,
   every time.**

   MEASURED: 13 distinct pool attack reactions carry a pump across 33
   printings, and all three activated attack-reaction abilities take the
   same route.

   v3.01's SHAPE WITH THE CR-CORRECT BOARD LOSING. Popping the layer is
   exactly what resolving one MEANS; the defect was that the pump lived
   only in the thing being destroyed.

   ---- WHY NOTHING CAUGHT IT ------------------------------------------

   v3.89 is the same lesson one layer out: *"sixteen drills that called
   `attackRx` DIRECTLY all passed"* while Shred did nothing in a real
   game. Here the sixteen became seventeen — `attackRx` returns the right
   pump and pushes the right layer, and it is the TURN STRUCTURE that
   deletes it two priority passes later. **Drive the real entry point, or
   pin nothing.**

   Coverage cannot see it (the cards read `full`), the fairness sweep is
   one-sided toward too-STRONG and this is weaker than printed, and
   `npm run play` cannot see it either — both seats lose the same bonus,
   so no invariant breaks and no game stalls.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const J  = require("../engine/judge.js");
const C  = require("../engine/cards.js");
const G  = require("../engine/game.js");
const BL = require("../engine/build.js");
const RNG= require("../engine/rng.js");
const PR = require("../engine/parser.js");
const E  = require("../engine/effects.js");
const W  = require("../engine/wire.js");
const H  = require("./helpers/judged.js");
const X  = require("./helpers/extract.js");

const DATA = X.loadData();
let _db = null;
const db = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(X.cardDbPath(), "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const heroBy = re => DATA.HEROES.find(h => re.test(h.n));

function table(seed, a, b){
  const d = db(); J.setDb(d);
  const ctr = {n: 0}; let rng = RNG.make(seed);
  const h0 = heroBy(a), h1 = heroBy(b);
  const b0 = BL.buildSideDefault(h0, G.parseDeck(DATA.DECKS[h0.k]), d, rng, ctr); rng = b0.rng;
  const b1 = BL.buildSideDefault(h1, G.parseDeck(DATA.DECKS[h1.k]), d, rng, ctr); rng = b1.rng;
  return J.newMatch({builds:[b0.b, b1.b], names:[h0.n, h1.n], heroKeys:[h0.k, h1.k],
                     rng, first:0, tokSeq:ctr.n});
}
function settle(n, skip){
  let g = 0;
  while(J.pendingOf(n) && g++ < 40){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    if(p.need - sd.res - J.paySum(sd) > 0){
      const pk = sd.hand.find(x => x.uid !== skip && (x.pitch || 0) > 0 && !(sd.paySel || []).includes(x.uid));
      if(!pk) break;
      n = J.reduce(n, {t:"paySel", uid:pk.uid}, p.seat).state;
    } else n = J.reduce(n, {t:"payConfirm"}, p.seat).state;
  }
  return n;
}

/* A real table, walked to the reaction step with an attack on the chain
   and a generically-targeted attack reaction in the attacker's hand.

   THE REACTION IS SPLICED IN AT THE WINDOW, and that is a fixture
   decision worth stating: getting one to survive the opening hand through
   a payment and a charge cost is a fight with the shuffle, and this drill
   is about what the TURN STRUCTURE does to a layer rather than about how
   the card arrived. The attack and the chain are entirely real. */
function reactionWindow(){
  let g = table("layerprobe1", /boltyn/i, /kayo/i);
  while(g.arsenalFor != null) g = J.reduce(g, {t:"arsenal", uid:null}, g.arsenalFor).state;
  const seat = g.turnPlayer;
  const atk = g.sides[seat].hand.find(x => PR.isAttack(x));
  assert.ok(atk, "fixture: no attack in the opening hand");
  /* resources, so the payment does not pitch the rest of the hand away */
  let sides = g.sides.slice(); sides[seat] = {...g.sides[seat], res:9}; g = {...g, sides};
  let n = settle(J.reduce(g, {t:"play", uid:atk.uid, from:"hand"}, seat).state, atk.uid);
  let k = 0;
  while(n.step !== "reaction" && k++ < 20){
    if(n.priority == null) break;
    n = J.reduce(n, {t:"pass"}, n.priority).state;
  }
  assert.equal(n.step, "reaction", "fixture: never reached the reaction step");
  const sd = {...n.sides[seat], res:9};
  const rx = (sd.deck || []).find(c => PR.isAR(c) && /^courageous steelhand$/i.test(c.name));
  assert.ok(rx, "fixture: Courageous Steelhand is not in Boltyn's deck any more");
  sd.hand = [rx, ...sd.hand]; sd.deck = (sd.deck || []).filter(c => c !== rx);
  sides = n.sides.slice(); sides[seat] = sd;
  /* THE CARD'S OWN GATE MUST BE MET, or this drill measures a conditional
     pump that never fires and reports the bug fixed while it is not.
     Steelhand reads "if you've charged this turn"; the seed is chosen so
     the declared attack charges, and the assertion below is what stops
     that becoming luck. */
  assert.ok(sd.hist && sd.hist.charged,
    "fixture: the attacker has not charged this turn, so Courageous Steelhand's " +
    "printed condition is unmet and its +3 would never fire whatever the engine does");
  return {g: {...n, sides}, seat, rx, atk};
}
const passOut = n => { let k = 0; while(n.pend && k++ < 40){ if(n.priority == null) break;
  n = J.reduce(n, {t:"pass"}, n.priority).state; } return n; };

/* ============================================================
   BOTH HALVES, OR THE DRILL PROVES NOTHING
   ============================================================ */

test("AT THE TABLE: the reaction's printed +3 reaches the hero", () => {
  const a = reactionWindow();
  const hp0 = a.g.sides[1 - a.seat].hp;

  /* the control: the same chain, resolved with no reaction played */
  const plain = passOut(a.g);
  const base = hp0 - plain.sides[1 - a.seat].hp;
  assert.ok(base > 0, "fixture: the control attack dealt nothing, so nothing can be compared");

  const b = reactionWindow();
  const r = J.reduce(b.g, {t:"play", uid:b.rx.uid, from:"hand"}, b.seat);
  assert.notEqual(r.state, b.g, "the reaction was refused: " + r.error);
  const withRx = passOut(settle(r.state, b.rx.uid));
  const dealt = hp0 - withRx.sides[1 - b.seat].hp;

  assert.equal(dealt, base + 3,
    "the reaction prints +3 and the hero took " + dealt + " against a base of " + base +
    ". A layer that resolves must carry its pump onto the open link — summing only " +
    "the layers still on the stack sums nothing here, because the reaction step " +
    "cannot end until the stack is empty.");
});

test("AND THE LAYER REALLY DOES RESOLVE — the CR half is not skipped", () => {
  const a = reactionWindow();
  const r = J.reduce(a.g, {t:"play", uid:a.rx.uid, from:"hand"}, a.seat);
  const played = settle(r.state, a.rx.uid);
  assert.equal((played.stack || []).length, 1,
    "a played reaction no longer becomes a layer — the opponent has lost their window");

  /* CR 4.2.2 — both seats hold priority over the layer before it resolves */
  const seats = new Set();
  let n = played, k = 0;
  while((n.stack || []).length && k++ < 8){
    if(n.priority == null) break;
    seats.add(n.priority);
    n = J.reduce(n, {t:"pass"}, n.priority).state;
  }
  assert.deepEqual([...seats].sort(), [0, 1],
    "both seats must get priority over a layer before it resolves (CR 4.2.2)");
  assert.equal((n.stack || []).length, 0, "the layer never resolved");
  assert.equal(n.pend.rxPump, 3, "the resolved layer did not carry its pump onto the link");
});

/* THE ONE-BOARD SHAPE, MADE CONCRETE. The trainer never pops a layer, so
   its reading was right by accident; asserting only the table would leave
   the two boards free to diverge again in the other direction. */
test("THE TRAINER'S READING IS UNCHANGED — the layer is still on the stack there", () => {
  const atk = {uid:1, name:"Rxlayer Swing", power:4, cost:0, pitch:1,
               tt:"Generic Attack Action", ty:["Generic","Attack","Action"], tx:"", kw:[]};
  const g = H.state({hand:[], res:9, ap:1}, {hp:20});
  const n = H.execute(g, atk, "hand", 0, {attacking:true, isAttack:true, target:"hero"});
  const waiting = {...n, stack:[...(n.stack || []), {k:"rx", label:"probe +3", pump:3}]};
  const out = J.withEffects(waiting, (f, s) => f.linkPumps(s,
    {equipDefenders:0, defenders:0, handBlockers:0, defAtkAction:false}));
  assert.equal(out.total, (n.pend.total || 0) + 3,
    "a layer still WAITING on the stack no longer contributes its pump — the trainer " +
    "has been broken in the other direction");
});

/* ============================================================
   ONE READER, CENSUSED
   ============================================================ */

test("`rxPumpTotal` is the ONE reader, and both consumers ask it", () => {
  assert.equal(typeof E.rxPumpTotal, "function", "the shared reader is gone");
  const EFX = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  /* DRIVE IT, DO NOT GREP IT — but the "no second copy" half is genuinely
     a claim about the source, so it is pinned precisely: nothing may sum
     the reaction layers by hand any more. */
  const hand = EFX.match(/filter\([^)]*k\s*===?\s*"rx"[^)]*\)\s*\n?\s*\.?\s*reduce/g) || [];
  assert.equal(hand.length, 1,
    "a second hand-rolled sum over the reaction layers exists — that is exactly the " +
    "shape that let `linkPumps` and `pendPumped` disagree, and the one copy lives " +
    "inside rxPumpTotal");

  /* and both answers move together */
  const s0 = {stack:[], pend:{card:{power:4}, total:4}};
  assert.equal(E.rxPumpTotal(s0), 0);
  assert.equal(E.pendPumped(s0), false, "an unpumped link reports pumped");
  const waiting = {stack:[{k:"rx", pump:2}], pend:{card:{power:4}, total:4}};
  assert.equal(E.rxPumpTotal(waiting), 2);
  assert.equal(E.pendPumped(waiting), true, "a link pumped by a WAITING layer reads as unpumped");
  const resolved = {stack:[], pend:{card:{power:4}, total:4, rxPump:2}};
  assert.equal(E.rxPumpTotal(resolved), 2,
    "a link pumped by a RESOLVED layer reads as unpumped — this is the table's case");
  assert.equal(E.pendPumped(resolved), true,
    "`pendPumped` is the SECOND reader and had the identical defect: after a layer " +
    "resolves at the table it answered FALSE, so an ability targeting 'an attack with " +
    "{p} greater than its base' was offered against a link it had already pumped");
});

test("the two records add rather than replacing each other", () => {
  /* A reaction that has resolved AND one still waiting are two different
     contributions to the same link. Reading either alone drops the other. */
  const both = {stack:[{k:"rx", pump:1}], pend:{card:{power:4}, total:4, rxPump:2}};
  assert.equal(E.rxPumpTotal(both), 3,
    "a waiting layer and a resolved one must both count — reading one record only is " +
    "the bug this function exists to remove");
});

test("`pend.rxPump` survives the wire", () => {
  const g = H.state({hand:[]}, {});
  const withPend = {...g, pend:{card:{name:"X", power:4}, total:4, rxPump:3, by:0}};
  const back = W.decode(W.encode(withPend));
  assert.equal(back.pend.rxPump, 3,
    "the resolved-layer record is dropped by the wire, so two peers would disagree " +
    "about how much an attack is pumped — a desync the hash would catch and nothing " +
    "would explain");
});
