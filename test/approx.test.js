/* ============================================================
   THE APPROXIMATION LEDGER IS NOT PROSE — it is driven.

   `tools/approx.js` enumerates every place this engine knowingly differs
   from the Comprehensive Rules. This file asks the ENGINE about each one,
   which is the only thing that keeps such a list from rotting.

   IT ROTS FAST, AND THAT IS MEASURED RATHER THAN FEARED. CLAUDE.md's
   "Known approximations" section was the list before this file, and the
   sweep that produced this one found SEVEN of its entries had stopped
   being true — six closed by later work with nobody deleting the record,
   and one whose stated REASON had gone false while its conclusion held.
   `tools/ledger.js` has now cost twelve the same way. v3.41's rule is
   "when you close a recorded gap, delete the record"; v3.69's twin is
   "when a record says a thing is unbuilt, go and ask the engine". This
   file asks, every run.

   ---- THE TWO PROBE DIRECTIONS ---------------------------------------

     stated / open   the deviation IS still in place, so the probe
                     asserts THE DEVIATION. The drill goes RED the day
                     somebody builds it — which is the point: closing a
                     gap should force the record to be deleted, not leave
                     a stale sentence behind.

     closed          the record was stale and the prose is corrected, so
                     the probe asserts THE THING IS BUILT. A regression
                     is red.

   Getting the direction backwards is the failure mode to watch for: a
   probe pointed the wrong way passes both before and after the work.

   ---- EVERY RECORD HAS A PROBE, AND EVERY PROBE HAS A RECORD ---------

   The census is asserted in BOTH directions (v2.47's rule — a one-sided
   census is a coverage tool wearing a judge's coat). A record with no
   probe is a claim nothing checks; a probe with no record is a check
   nobody can find.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const A = require("../tools/approx.js");
const {APPROX, STATUSES} = A;

const X  = require("./helpers/extract.js");
const H  = require("./helpers/judged.js");
const C  = require("../engine/cards.js");
const PR = require("../engine/parser.js");
const TY = require("../engine/types.js");
const E  = require("../engine/effects.js");
const P  = require("../engine/priority.js");
const PM = require("../engine/prompts.js");
const S  = require("../engine/sides.js");
const W  = require("../engine/wire.js");
const J  = require("../engine/judge.js");

const HTML = X.html();

/* The pinned pool, in the shape everything above `mapDbCard` reasons
   about. `resolveEntry`'s output is what a card IS at the table; this is
   one step below it and is the right level for a pool-wide TEXT census. */
let _pool = null;
const pool = () => _pool || (_pool = JSON.parse(fs.readFileSync(X.POOL, "utf8"))
  .filter(c => c && c.name).map(C.mapDbCard)
  .map(m => ({name:m.n, pitch:m.p, cost:m.c, power:m.pw, def:m.d,
              tt:m.tt, ty:m.ty, tx:m.tx, kw:m.kw, gkw:m.gkw})));

const byName = nm => pool().filter(c => c.name === nm);
const one    = nm => { const r = byName(nm); assert.ok(r.length, "pool has no " + nm); return r[0]; };

/* ---- A REAL TABLE, because some of these are questions about the TURN
   STRUCTURE and only `judge.reduce` answers those. Two real precons off
   one seeded stream, seat 0's shuffle then seat 1's — the order matters or
   two peers deal different decks from the same table code (v2.49). */
const G  = require("../engine/game.js");
const BL = require("../engine/build.js");
let _tdb = null;
const tdb = () => _tdb || (_tdb = C.buildMaps(
  JSON.parse(fs.readFileSync(X.cardDbPath(), "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
function table(o){
  o = o || {};
  const W2 = X.loadData();
  const heroBy = re => W2.HEROES.find(h => re.test(h.n));
  const h0 = heroBy(/kayo/i), h1 = heroBy(/dorinthea/i);
  const db = tdb(); J.setDb(db);
  const ctr = {n: 0}; let rng = H.RNG.make(o.seed || "approx");
  const b0 = BL.buildSideDefault(h0, G.parseDeck(W2.DECKS[h0.k]), db, rng, ctr); rng = b0.rng;
  const b1 = BL.buildSideDefault(h1, G.parseDeck(W2.DECKS[h1.k]), db, rng, ctr); rng = b1.rng;
  return J.newMatch({builds:[b0.b, b1.b], names:[h0.n, h1.n], heroKeys:[h0.k, h1.k],
                     rng, first:0, tokSeq:ctr.n});
}
/* Settle whatever payment a declaration opened, pitching from hand when
   the pool cannot cover it. Not a policy — a way to make the machine run. */
function settle(n, skipUid){
  let guard = 0;
  while(J.pendingOf(n) && guard++ < 40){
    const p = J.pendingOf(n), sd = n.sides[p.seat];
    if(p.need - sd.res - J.paySum(sd) > 0){
      const pick = sd.hand.find(x => x.uid !== skipUid && (x.pitch || 0) > 0 &&
                                     !(sd.paySel || []).includes(x.uid));
      if(!pick) break;
      n = J.reduce(n, {t:"paySel", uid:pick.uid}, p.seat).state;
    } else n = J.reduce(n, {t:"payConfirm"}, p.seat).state;
  }
  return n;
}

/* Every probe registers itself here, so the census below can compare the
   two sets rather than trusting that a `test(...)` call was written. */
const PROBED = new Set();
const probe = (id, fn) => {
  PROBED.add(id);
  test("approx · " + id + " — " + (APPROX[id] ? APPROX[id].status : "NO RECORD"), fn);
};

/* ============================================================
   THE CENSUS — pinned in both directions
   ============================================================ */

test("every record has a probe, and every probe has a record", () => {
  const recorded = new Set(Object.keys(APPROX));
  const missing  = [...recorded].filter(k => !PROBED.has(k));
  const orphan   = [...PROBED].filter(k => !recorded.has(k));
  assert.deepEqual(missing, [], "records with no probe — a claim nothing checks");
  assert.deepEqual(orphan,  [], "probes with no record — a check nobody can find");
});

test("every record carries a status the probes know how to point at", () => {
  for(const [k, v] of Object.entries(APPROX)){
    assert.ok(STATUSES.includes(v.status), k + " has unknown status " + v.status);
    assert.ok(["both","trainer","table"].includes(v.board), k + " has unknown board " + v.board);
    assert.ok(v.claim && v.claim.length > 40, k + " has no real claim");
    assert.ok(v.why && v.why.length > 40, k + " has no argument or waiting-on");
    assert.ok(/^v\d+\.\d+$/.test(v.swept), k + " has no sweep version");
  }
});

/* A LEDGER IS ONLY WORTH HAVING IF THE SHAPE OF IT IS PINNED (v3.21,
   v4.00). "The scan found nothing" must not be able to pass for
   "everything is accounted for", so the counts are asserted. Moving one
   is a deliberate edit to this line — the same discipline as
   `wire.test.js`'s HEADLESS list and the symmetry ledger. */
/* EVERY PROBE REACHES SOMETHING REAL (v4.35).

   v4.02 built this ledger and named the failure in its own header — "the
   probes must DRIVE" — listing four that did not, one of them "a
   hand-written state answering its own question (v2.80)". A fifth slipped
   through and was found the hard way: `aura-ward-prevention-pool` built a
   side, put an aura on its board and asserted `sd.ward === 0`, a field
   `makeSide` had just defaulted, with nothing driven in between. It
   therefore passed identically before and after v4.34 ANSWERED the
   ruling, and the record outlived its own version.

   FIX THE FAMILY, NOT THE ONE YOU FOUND (v4.21). This is the standing
   version: every probe body must reach an engine module, a helper that
   drives one, or a real source file. It is a coarse check and says so —
   it cannot tell a driven assertion from a decorative call — but it is
   the half that IS mechanical, and the sabotage below proves the scan
   alive rather than passing by finding nothing (v3.00, v3.81, v4.07). */
test("every probe reaches the engine or a real source file", () => {
  const src = fs.readFileSync(__filename, "utf8");
  const rx = /probe\("([a-z0-9-]+)",\s*\(\)\s*=>\s*\{/g;
  const spans = []; let m;
  while((m = rx.exec(src))) spans.push({id: m[1], at: m.index});
  assert.ok(spans.length >= 25, "the probe scan is aimed wrong — it found almost nothing");

  const REACHES = /\b(E|PR|P|G|GM|PM|W|S|X)\.[a-zA-Z]|H\.(J\.)?(withEffects|execute|runOps|fx|state)\(|J\.(reduce|withEffects|newMatch|legal)\(|\btable\(|\bone\(|\bbyName\(|\bpool\(\)|HTML|readFileSync/;
  const inert = [];
  for(let i = 0; i < spans.length; i++){
    const body = src.slice(spans[i].at, i + 1 < spans.length ? spans[i + 1].at : src.length)
      .replace(/\/\*[\s\S]*?\*\//g, "");
    if(!REACHES.test(body)) inert.push(spans[i].id);
  }
  assert.deepEqual(inert, [],
    "a probe that reaches nothing is a claim nothing checks — it will pass on both " +
    "sides of the change it exists to watch");

  /* THE SCAN IS PROVED ALIVE. A probe body with no engine call must be
     reported, or "found nothing" is indistinguishable from "aimed
     wrong". */
  /* BUILT BY CONCATENATION ON PURPOSE. Written as a literal it appears in
     the very file the scan reads, so the census above reports the CONTROL
     as an inert probe — which is what the first draft of this drill did.
     Check your own fixture. */
  const fake = "pro" + "be(\"control-nothing\", () => {\n  assert.equal(1, 1);\n});\n";
  const rx2 = /probe\("([a-z0-9-]+)",\s*\(\)\s*=>\s*\{/g;
  const hit = rx2.exec(fake);
  assert.equal(hit && hit[1], "control-nothing", "the probe pattern no longer matches a probe");
  assert.ok(!REACHES.test(fake), "the reach pattern claims a body that reaches nothing");
});

test("the ledger's shape is pinned — moving a record is a deliberate edit", () => {
  const n = s => Object.values(APPROX).filter(v => v.status === s).length;
  assert.equal(Object.keys(APPROX).length, 30, "record count moved");
  /* 10 -> 12 stated AT v4.34: `ward-spend-order` (the CR gives the
     controller the order two wards apply in) and `ward-does-not-stop-
     arcane` (unchanged by that version and recorded rather than left as
     prose, because a doc claim is a test with no assertion — v3.41). */
  /* 12 -> 11 stated, 9 -> 10 closed AT v4.35: `ward-does-not-stop-arcane`
     was built one version after it was recorded and is
     `prevention-is-per-damage-type` now. Its probe turned round. */
  /* 11 -> 12 stated AT v4.36: `prevention-target-and-source`, which no
     tool here can see — the fairness sweep's three RESTRICTION-DROPPED
     checks are all about attack buffs. */
  assert.equal(n("stated"), 12, "stated count moved");
  /* 9 -> 8 open, 8 -> 9 closed AT v4.26: `trainer-fatigue-loss` was
     built. That is the reversal a `stated`/`open` record exists to force
     (v4.02) — its probe went RED the moment the gap closed, and closing
     it is a deliberate edit to this line rather than a stale sentence. */
  /* 8 -> 7 open, 10 -> 11 closed AT v4.35: `aura-ward-prevention-pool`
     was ANSWERED at v4.34 and the record survived its own version by one,
     because its probe drove nothing. */
  assert.equal(n("open"),    7, "open count moved");
  assert.equal(n("closed"), 11, "closed count moved");
});

/* ============================================================
   A. THE RULES MACHINE
   ============================================================ */

/* CR 7.1.2 — an attack should sit on the STACK as a layer before it
   becomes a chain link. Here it goes straight onto the chain, so the
   observable is that nothing is ever on `stack` while a link exists. */
probe("layer-step-window", () => {
  /* CHECK YOUR OWN FIXTURE (v3.82, and this one bit). The first draft drove
     `effects.execute` and asserted `stack` was empty — but `stack` is the
     TRAINER's representation of the chain display, so it came back holding
     an `{k:"atk"}` layer and the probe reported the deviation closed. The
     question is about the TABLE's turn structure, so it has to be asked of
     `judge.reduce`. */
  let g = table();
  while(g.arsenalFor != null) g = J.reduce(g, {t:"arsenal", uid:null}, g.arsenalFor).state;
  assert.equal(g.step, "layer", "a fresh action phase no longer opens in the layer step");
  const seat = g.turnPlayer;
  const c = g.sides[seat].hand.find(x => PR.isAttack(x));
  assert.ok(c, "fixture: the opening hand holds no attack");
  let n = J.reduce(g, {t:"play", uid:c.uid, from:"hand"}, seat).state;
  n = settle(n, c.uid);
  /* THE DEVIATION, DRIVEN: one action took the step from `layer` to
     `attack` with the card already a chain link and nothing on the stack.
     In the CR it would rest as a layer first and both seats could respond
     before it became one. */
  assert.equal(n.step, "attack",
    "declaring an attack no longer goes straight to the attack step — a layer " +
    "window may have been built, and the record must move");
  assert.equal((n.chainCards || []).length, 1, "the attack is not on the chain");
  assert.deepEqual(n.stack || [], [],
    "the attack now rests on the stack as a layer — CR 7.1.2 is BUILT and the " +
    "ledger record must be deleted");
});

/* CR 4.1.8a hands the order of simultaneous triggers to the turn-player.
   The observable is that no mechanism exists to ASK: `buildPrompt`'s tag
   vocabulary has no ordering variant, so a caller that wanted one gets
   null rather than a sheet. */
probe("simultaneous-trigger-order", () => {
  const g = H.state({hand:[], deck:[]}, {});
  assert.equal(PM.buildPrompt(g, {tag:"trigorder", side:0, options:[1,2]}), null,
    "an ordering prompt now builds — CR 4.1.8a is BUILD-ABLE and the record must move");
  /* And the end phase's order is FIXED: two runs of the same state agree. */
  const a = E.beginEndPhase(H.state({hand:[{uid:1,name:"X",tt:"Generic Action",ty:["Generic","Action"],tx:"",kw:[]}]}, {}), 0);
  const b = E.beginEndPhase(H.state({hand:[{uid:1,name:"X",tt:"Generic Action",ty:["Generic","Action"],tx:"",kw:[]}]}, {}), 0);
  assert.deepEqual(a.msgs, b.msgs, "the end-phase order is no longer deterministic");
});

/* Oasis Respite names a TARGET HERO and a SOURCE and the engine reads
   neither. DRIVEN: the pool lands on the actor and soaks two different
   sources, which one locked to a named source could not. */
probe("prevention-target-and-source", () => {
  const oa = one("Oasis Respite");                            /* prevents 4 */
  const g = H.state({hand: [{...oa, uid: 71}], res: 9, ap: 1, hp: 20}, {hp: 20}, {turn: 4});
  const played = H.execute(g, {...oa, uid: 71}, "hand", 0, {});
  assert.equal(played.sides[0].ward, 4, "fixture: the prevention must actually be granted");
  /* THE DEVIATION, BOTH HALVES. The pool is the ACTOR's, though the card
     says "target hero"; and it soaks a second, different source, though
     the card says "a source of your choice". */
  assert.equal(played.sides[1].ward || 0, 0, "the target is no longer defaulted to the actor");
  const a = H.J.withEffects(played, (fx, s2) => fx.preventDamage(s2, 0, 2, "First Source").game);
  const b = H.J.withEffects(a,      (fx, s2) => fx.preventDamage(s2, 0, 2, "Second Source").game);
  assert.equal(b.sides[0].ward, 0,
    "the pool now refuses a second source — the printed restriction is READ and " +
    "the record must move");
});

/* CR gives the controller the order two replacement effects apply in.
   DRIVEN: the fixed order is observable — a seat holding a pool AND two
   permanents of different ward spends them in exactly one sequence, and a
   prompt would let it spend them in another. */
probe("ward-spend-order", () => {
  const spec = one("Waxing Specter"), shield = one("Spectral Shield");  /* Ward 3 · Ward 1 */
  const ent = (c, u) => ({uid:u, card:c, sd:null});
  const g = H.state({board:[ent(spec,"b3"), ent(shield,"b1")], ward:1, wardTurn:1, hp:20}, {}, {turn:7});
  const out = H.J.withEffects(g, (fx, s2) => {
    const r = fx.preventDamage(s2, 0, 2, "probe");
    return Object.assign({}, r.game, {_d:r.dealt});
  });
  assert.equal(out._d, 0, "fixture: two points, and three sources that cover them");
  /* THE DEVIATION: the pool went first and the Ward 1 followed, with no
     choice put to the seat. A build that asks would leave `promptQ`
     non-empty here — which is what makes this probe fail the day it is
     built rather than leaving a stale sentence (v4.02). */
  assert.equal(out.sides[0].ward, 0, "the pool was spent first, unasked");
  assert.deepEqual(out.sides[0].board.map(b => b.card.name), ["Waxing Specter"],
    "…and the Ward 1 followed it, not the Ward 3");
  assert.deepEqual(out.promptQ || [], [],
    "nothing asked the seat which ward to spend — the record must move");
});

/* CLOSED AT v4.35 — the probe TURNED ROUND, which is what a `stated`
   record exists to force (v4.02): it asserted the deviation, went RED the
   day `preventDamage` became the choke point, and now asserts the thing is
   BUILT so a regression is a failure. All four routes are driven. */
probe("prevention-is-per-damage-type", () => {
  /* THE WARD MUST BE WHERE THE DAMAGE LANDS. `arcane` is dealt to the
     OTHER seat, so the fixture arms SEAT 1 — armed at seat 0 the probe
     would pass against a fixed engine, which is the shape this project
     keeps catching in its own drills. */
  const spec = one("Waxing Specter");                          /* Ward 3 */
  const armed = () => H.state({}, {board:[{uid:"b3", card:spec, sd:null}], ward:2, wardTurn:2, hp:20},
                              {turn:7});
  /* (1) ARCANE — the pool first, then the permanent. */
  const arc = H.J.withEffects(armed(), (fx, s2) => fx.runOps(s2, [["arcane", 3]], "probe"));
  assert.equal(arc.sides[1].hp, 20, "arcane is prevented now");
  assert.equal(arc.sides[1].ward, 0, "…the pool paid what it could");
  assert.equal(arc.sides[1].board.length, 0, "…and the permanent paid the rest");

  /* (2) DIRECT damage — Boom Grenade's 4, Danger Digits' 1, a clash payoff. */
  const dir = H.J.withEffects(armed(), (fx, s2) => fx.runOps(s2, [["dmg", 3]], "probe"));
  assert.equal(dir.sides[1].hp, 20, "`dmg` took life with nothing in between");

  /* (3) DAMAGE TO YOURSELF — Bloodrot Pox's "it deals 2 damage to YOU". */
  const own = H.state({board:[{uid:"b3", card:spec, sd:null}], ward:2, wardTurn:2, hp:20}, {}, {turn:7});
  const self = H.J.withEffects(own, (fx, s2) => fx.runOps(s2, [["dmgSelf", 3]], "probe"));
  assert.equal(self.sides[0].hp, 20, "`dmgSelf` did too");

  /* (4) AND A PREVENTION THAT RUNS OUT STILL LETS THE REST THROUGH — a
     probe that only ever sees zero passes against an engine that prevents
     everything (v3.98: ask for the refusal). */
  const over = H.J.withEffects(armed(), (fx, s2) => fx.runOps(s2, [["arcane", 9]], "probe"));
  assert.equal(over.sides[1].hp, 16, "2 from the pool and 3 from the aura, and the other 4 land");
});

/* The CR files a destroyed permanent immediately; this files it at the
   beginning of the controller's end phase. DRIVEN: the piece is still in
   `gear` after being destroyed, and reaches the graveyard only when
   `beginEndPhase` runs. */
probe("gear-sweep-timing", () => {
  const piece = {uid:7, name:"Probe Helm", def:2, curDef:0, destroyed:true,
                 tt:"Generic Equipment - Head", ty:["Generic","Equipment"], tx:"", kw:[]};
  const g = H.state({gear:[piece], grave:[]}, {});
  assert.equal(g.sides[0].gear.length, 1, "fixture: the piece must start in gear");
  assert.equal(g.sides[0].grave.length, 0, "fixture: the graveyard must start empty");
  const swept = E.sweepGear(g, 0);
  assert.equal(swept.game.sides[0].gear.length, 0, "the sweep did not file the piece");
  assert.equal(swept.game.sides[0].grave.length, 1, "the piece did not reach the graveyard");
  /* THE DEVIATION: nothing files it at the moment of destruction. A
     destroyed piece sitting in `gear` is what makes the wall's indices
     survive the resolution that destroyed it. */
  const inPlace = H.state({gear:[piece], grave:[]}, {});
  assert.equal(inPlace.sides[0].gear.length, 1,
    "gear is now filed at the moment of destruction — the record must move");
});

/* CR 4.4.1 gives nobody priority in the end phase, so heave is offered at
   the arsenal step instead. The observable is that `heaveOffer` answers
   and `beginEndPhase` does not make the offer itself. */
probe("heave-window", () => {
  assert.equal(typeof E.heaveOffer, "function", "heaveOffer is gone");
  assert.equal(typeof E.heave, "function", "heave is gone");
  const tq = one("Thunder Quake");
  const card = {...tq, uid:3};
  const g = H.state({hand:[card], arsenal:null, res:3}, {});
  const offer = E.heaveOffer(g, 0);
  assert.ok(offer, "heave no longer offers with an empty arsenal and the cost in hand");
  const ep = E.beginEndPhase(g, 0);
  assert.ok(!/heave/i.test(ep.msgs.join(" ")),
    "the end phase now makes the heave offer itself — CR 4.4.1's problem is " +
    "solved or reintroduced, and either way the record must move");
});

/* CR 4.2.1 gives nobody priority in the start phase, so no state rests
   there: neither seat may act. */
probe("start-phase-passthrough", () => {
  /* TWO FIXTURES WERE WRONG BEFORE THE ENGINE WAS.

     The first hand-wrote `{phase:"start", priority:null}` and then
     asserted priority was null — a fabricated state answering its own
     question (v2.80), so opening the start phase to both seats was SILENT.

     The second asked the module's own `makeGame`, which is better and
     still not the claim: "nobody may act in the start phase" is CR 4.2.1
     and is GUARDED elsewhere. THE APPROXIMATION IS THAT NO STATE EVER
     RESTS THERE — so it has to be driven through a real turn handoff. */
  const start = S.makeGame({sides:[S.makeSide({id:0}), S.makeSide({id:1})]});
  assert.equal(start.phase, "start", "a fresh game no longer opens in the start phase");
  assert.equal(P.canAct(start, 0), false, "seat 0 may act in the start phase");

  let g = table();
  while(g.arsenalFor != null) g = J.reduce(g, {t:"arsenal", uid:null}, g.arsenalFor).state;
  const seen = [];
  let n = J.reduce(g, {t:"endTurn"}, g.turnPlayer).state;           seen.push(n.phase);
  if(n.phase === "action" && n.priority != null)
    n = J.reduce(n, {t:"pass"}, n.priority).state;                  seen.push(n.phase);
  let guard = 0;
  while(n.arsenalFor != null && guard++ < 5){
    n = J.reduce(n, {t:"arsenal", uid:null}, n.arsenalFor).state;   seen.push(n.phase);
  }
  assert.equal(n.turnPlayer, 1, "the handoff no longer reaches the other seat");
  assert.equal(n.phase, "action",
    "a state now RESTS in the start phase — the pass-through is closed and the " +
    "record must move (which is the right outcome the day a start-of-turn " +
    "trigger needs a pause)");
  assert.deepEqual(seen.filter(p => p === "start"), [],
    "the handoff now stops in the start phase, where CR 4.2.1 gives nobody priority");
});

/* CR 4.5.3 has three ways to lose and no more. judge.js removed the
   invented fatigue loss at v2.45 and the trainer kept it for four dozen
   versions — v3.01's shape with the invented rule on the board a PLAYER
   USES. CLOSED AT v4.26, and this probe is REVERSED: it asserted the
   deviation while the record was `open`, went red the day it was built,
   and now asserts the fix. That reversal is what a `stated`/`open`
   record is FOR (v4.02).

   THE JUDGE HALF IS DRIVEN. The trainer half is a claim about a babel
   block no drill can execute, so it is pinned as source — in BOTH
   directions (v3.98), because "the invented line is gone" is satisfied
   perfectly by a block that draws nothing and says nothing. */
probe("trainer-fatigue-loss", () => {
  /* judge: an empty deck is not a loss. */
  const g = H.state({deck:[], hand:[], hp:12}, {hp:12});
  assert.ok(!g.over, "fixture");
  const drawn = H.runOps(g, [["draw", 1]], "probe");
  assert.ok(!drawn.over, "judge.js now ends the game on an empty deck — CR 4.5.3 " +
                         "has three ways to lose and this would be a fourth");
  /* the trainer: the invented loss is GONE… */
  assert.ok(!/fatigued/.test(HTML) && !/wins by attrition/.test(HTML),
    "the invented fatigue loss is back in index.html");
  assert.ok(!/n\.over\s*=\s*\{win:\s*false\}\s*;\s*return\s*\{\.\.\.L\(n,\s*`Deck empty/.test(HTML),
    "…and so is the assignment that ended the game");
  /* …AND THE CR-CORRECT LINE IS THERE. Both halves, or a block that
     silently stopped drawing satisfies the first perfectly. */
  assert.ok(/CR 4\.5\.3: that is not a loss/.test(HTML),
    "the trainer no longer tells the player what an empty deck means — in a " +
    "training sim the sequence is the lesson");
  const J2 = fs.readFileSync(path.join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.ok(/CR 4\.5\.3: that is not a loss/.test(J2),
    "…and the two boards no longer say it the same way");
});

/* On an ATTACK card, `fx.ops` ride to RESOLUTION while the printed
   trigger fires on DECLARATION. MEASURED over the pinned pool rather
   than asserted, because the doc's number is the whole claim. */
probe("attack-ops-at-resolution", () => {
  /* THE FIRST VERSION OF THIS PROBE CLASSIFIED BY OP KIND AND WAS WRONG
     (v4.03). It read `fx.ops`, excluded the pre-run and the reveal family
     by NAME, and pinned ELEVEN — a number derived from a list of op kinds
     rather than from the engine. Driven, the answer is different: the
     pre-run in `execute` already runs `draw`/`discardRandom` at
     declaration, so three of the eleven were never late at all.

     DRIVE IT. Declare each card as a real attack and ask what has ALREADY
     happened by the time `pend` exists — an op still sitting in
     `pend.ops` is one that rides to RESOLUTION, which is the deviation
     this record is about. */
  H.db();
  const seen = new Set(); const rows = [];
  for(const c of pool()){
    if(!/when this attacks/i.test(c.tx || "")) continue;
    if(!TY.isAttack(c)) continue;
    if(/when this attacks[^.]*,\s*if\b/i.test(c.tx)) continue;   /* a nested gate is a different shape */
    if(seen.has(c.name)) continue; seen.add(c.name);
    const fx = PR.fxParse(c);
    if(!(fx.ops || []).length || fx.optCost) continue;
    const card = {...c, uid: 5000 + rows.length, cost: 0};
    const g = H.state({hand:[card], res:9, ap:1,
      deck:[{uid:8001, name:"Approx Filler A", tt:"Generic Action", ty:["Generic","Action"], tx:"", kw:[], pitch:1},
            {uid:8002, name:"Approx Filler B", tt:"Generic Action", ty:["Generic","Action"], tx:"", kw:[], pitch:1}],
      hist:{atk:0, non:0, arc:0, aura:0, made:0, booed:0, blue:0, red:0, trans:0, blueGY:0, atkNames:[]}},
      {hp:20}, {turn:3});
    let n;
    try { n = H.execute(g, card, "hand", 0, {attacking:true, isAttack:true, target:"hero"}); }
    catch(e){ assert.fail("declaring " + c.name + " threw: " + e.message); }
    const pendOps = ((n.pend && n.pend.ops) || []).map(o => o[0]);
    const kinds = (fx.ops || []).map(o => o[0]);
    const late = kinds.filter(k => pendOps.includes(k));
    rows.push({name:c.name, kinds, late});
  }
  const lateRows = rows.filter(r => r.late.length);
  const observable = lateRows.filter(r => !r.late.every(k => k === "noop"));

  /* 17 -> 15 AND 9 -> 7 AT v4.08, AND THE PROBE IS WHAT FORCED THE EDIT.
     Vexing Malice and Spellblade Assault left this census by being BUILT:
     their bare trigger routes to `fx.onAtk` and fires at declaration, so
     they no longer carry a payload in `fx.ops` at all. That is exactly
     what a `stated` record's probe is for — closing part of a gap turns
     it RED and the record has to be updated rather than left to rot
     (v4.02). */
  assert.equal(rows.length, 15,
    "the number of bare when-this-attacks ATTACK cards with a payload moved");
  assert.equal(lateRows.length, 7,
    "the number whose payload rides to RESOLUTION moved");
  assert.deepEqual(observable.map(r => r.name).sort(),
    ["Brand with Cinderclaw", "Fire Tenet: Strike First", "Hyper Inflation",
     "Pick Up the Point", "Teklo Trebuchet 2000"],
    "the set of cards whose payload is OBSERVABLY late moved. Down means one " +
    "was moved to declaration and the ledger must say so; up is a regression. " +
    "(Two more are late and carry only a `noop`, which is not observable.)");

  /* AND THE CONTROL: the pre-run really does fire at declaration, so this
     probe can tell a late op from an early one rather than reporting
     everything late. */
  const early = rows.filter(r => !r.late.length).map(r => r.name);
  assert.ok(early.includes("Bare Fangs") && early.includes("Concoct Disorder"),
    "the declaration-time cards are no longer landing at declaration — this " +
    "probe can no longer tell the two moments apart");
});

probe("trainer-priority-machine", () => {
  assert.ok(/\bbphase\b/.test(HTML), "index.html no longer speaks bphase — the " +
    "trainer has been migrated onto priority.js and this record is closed");
  assert.equal(typeof P.fromTrainer, "function", "the shadow derivation is gone");
  assert.ok(/fromTrainer/.test(HTML), "the trainer no longer derives the CR machine at all");
  /* TWO FIXTURES WERE WRONG BEFORE THE ENGINE WAS, and both are shapes
     this project already names.

     A FLAT SCAN OF priority.js IS A FALSE POSITIVE: `fromTrainer` reads
     `t.bphase` legitimately — it is the shadow derivation and takes the
     TRAINER's state as its argument.

     AND `makeGame` REALLY DOES CARRY `bphase`. Every game carries both
     state vocabularies on purpose (v2.83), so asking the shape proves
     nothing. The claim that matters is that the CR machine never WRITES
     it: judge seeds the field and then freezes it, which is exactly the
     trap v2.83 records — a field that is present, plausible and never
     updated reads as an answer. */
  assert.deepEqual(P.PRI_FIELDS.filter(f => /^(mode|bphase)$/.test(f)), [],
    "priority.js's merged field list now carries a trainer field — the split is gone");
  let t0 = table();
  const seeded = t0.bphase;
  while(t0.arsenalFor != null) t0 = J.reduce(t0, {t:"arsenal", uid:null}, t0.arsenalFor).state;
  const seat = t0.turnPlayer;
  const atk = t0.sides[seat].hand.find(x => PR.isAttack(x));
  let t1 = settle(J.reduce(t0, {t:"play", uid:atk.uid, from:"hand"}, seat).state, atk.uid);
  assert.equal(t1.bphase, seeded,
    "judge.js now WRITES `bphase` — there are two rules vocabularies live at the " +
    "table again, and the record must move");
});

/* CR 1.4.5 makes choosing an attack-target mandatory, and the trainer
   never asks. THE MEASUREMENT IS THE ARGUMENT: its opponent is
   DUMMY_DECK, which holds no ally, so there is never a target to choose.
   This goes red the day the dummy deck gains one. */
probe("trainer-attack-target", () => {
  const W2 = X.loadData();
  assert.ok(Array.isArray(W2.DUMMY_DECK) && W2.DUMMY_DECK.length,
    "DUMMY_DECK is gone — the trainer's opponent changed shape");
  const names = W2.DUMMY_DECK.map(e => Array.isArray(e) ? e[0] : e.name);
  const allies = names.filter(nm => {
    const r = byName(nm)[0];
    return r && /\bAlly\b/i.test(r.tt || "");
  });
  assert.deepEqual(allies, [],
    "the trainer's dummy deck now holds an ally, so an attack-target choice is " +
    "reachable there and CR 1.4.5 must be built on that board");
});

/* ============================================================
   B. CARD SEMANTICS
   ============================================================ */

/* An X cost and an X quantity are refused rather than guessed. */
probe("x-cost", () => {
  const ice = byName("Ice Eternal")[0];
  assert.ok(ice, "Ice Eternal left the pool");
  const fx = PR.fxParse(ice);
  const mints = (fx.ops || []).filter(o => o[0] === "token");
  assert.deepEqual(mints, [],
    "an X quantity is now read as a token mint — either X costs are BUILT (delete " +
    "the record) or a card is being created for free");
  assert.notEqual(fx.tier, "full", "Ice Eternal reports fully scripted with an unread X");
});

/* Mask of the Swarming Claw's parametrised spellvoid is refused; the
   piece keeps its printed Arcane Barrier. DRIVEN through `arcaneSoaks`,
   which is the one reader that offers a soak. */
probe("spellvoid-x", () => {
  const mask = byName("Mask of the Swarming Claw")[0];
  assert.ok(mask, "Mask of the Swarming Claw left the pool");
  const sd = S.makeSide({id:0});
  sd.gear = [{...mask, uid:5}];
  const soaks = PR.arcaneSoaks(sd);
  const kinds = soaks.map(s => s.kind).sort();
  assert.deepEqual(kinds, ["barrier"],
    "the piece now offers a spellvoid soak — X is being read, and the record must move");
  /* THE OTHER HALF: plain spellvoid and plain arcane barrier are LIVE.
     The keyword ledger called both `inert-dummy` until v4.02, on a reason
     — "the dummy deals only physical" — that named a training prop
     retired at v2.71. */
  const L = require("../tools/ledger.js");
  const KW = L.KEYWORDS || L;
  assert.notEqual(KW["arcane barrier"].status, "inert-dummy",
    "the keyword ledger still calls arcane barrier inert — it is paid at the point " +
    "arcane damage is dealt, on both boards");
  assert.notEqual(KW["spellvoid"].status, "inert-dummy",
    "the keyword ledger still calls spellvoid inert");
});

/* Walk in My Shoes' crush rider halves the opponent's base values for a
   turn and has no reader — so it arms no next-turn entry. */
probe("crush-halving-rider", () => {
  /* THE FIRST DRAFT PASSED VACUOUSLY. It read `(fx.crush && fx.crush.ops)`
     and filtered for a halve op — but Walk in My Shoes sets no `fx.crush`
     AT ALL, so the filter ran over `[]` and the assertion held whatever
     the engine did. ASK FOR THE REFUSAL (v3.98), and carry the control
     that tells a working reader from a dead one.

     MEASURED over the pinned pool: twelve cards print a `Crush -` rider,
     ELEVEN are read, and this is the one that refuses. */
  const rows = [];
  const seen = new Set();
  for(const c of pool()){
    const cl = (PR.fxParse(c).clauses || []).find(x => /^crush\s*[-—]/i.test(x.t));
    if(!cl || seen.has(c.name)) continue; seen.add(c.name);
    rows.push({name:c.name, st:cl.st, armed: !!PR.fxParse(c).crush});
  }
  assert.equal(rows.length, 12, "the number of pool cards printing a Crush rider moved");
  const refused = rows.filter(r => r.st !== "run").map(r => r.name);
  assert.deepEqual(refused, ["Walk in My Shoes"],
    "the set of REFUSED crush riders moved — if this one was built, the record " +
    "must move; if another joined it, that is a regression");
  /* THE CONTROL: a reader that refused everything would pass the line above
     perfectly. Boulder Drop's rider is read and armed. */
  const ctrl = rows.find(r => r.name === "Boulder Drop");
  assert.ok(ctrl && ctrl.st === "run" && ctrl.armed,
    "the control crush rider stopped being read — this probe can no longer tell " +
    "a refusal from a dead reader");
});

/* Surge is evaluated as `amp > 0` rather than as the arcane damage
   actually dealt. The observable: a side holding an amp with NO damage
   dealt this turn satisfies the condition. */
probe("surge-approximated", () => {
  const names = new Set();
  for(const c of pool()){
    const fx = PR.fxParse(c);
    for(const cd of (fx.conds || [])) if(/^surgeOver/.test(String(cd.cond))) names.add(c.name);
  }
  assert.ok(names.size, "no pool card emits a surgeOver condition any more");
  /* the approximation itself: the condition reads `amp`, never a damage record */
  const src = fs.readFileSync(path.join(X.ROOT, "engine", "effects.js"), "utf8");
  const i = src.indexOf("surgeOver");
  assert.ok(i > 0, "effects.js no longer answers surgeOver");
  const window = src.slice(i, i + 400);
  assert.ok(/amp/.test(window),
    "surge is no longer answered off `amp` — it may be reading the damage dealt, " +
    "in which case the approximation is closed and the record must move");
});

/* A forced pitch or discard with no printed choice is auto-picked rather
   than prompted. DRIVEN: a forced discard opens no sheet. */
probe("auto-pitch-discard", () => {
  const c1 = {uid:1, name:"Probe A", power:6, pitch:1, tt:"Generic Attack Action",
              ty:["Generic","Attack","Action"], tx:"", kw:[]};
  const c2 = {uid:2, name:"Probe B", power:1, pitch:3, tt:"Generic Attack Action",
              ty:["Generic","Attack","Action"], tx:"", kw:[]};
  const g = H.state({hand:[c1, c2], grave:[]}, {});
  const n = H.runOps(g, [["discardRandom", 1]], "probe");
  assert.equal(n.sides[0].hand.length, 1, "the forced discard did not happen");
  assert.deepEqual(n.promptQ || [], [],
    "a forced discard now queues a prompt — the record is closed and must move");
});

/* Four pool DECK cards read tier `none`. */
probe("unbuilt-three", () => {
  /* +Banneret of Salvation AT v4.21, AND IT ARRIVED AS A CORRECTION.
     Its "Solflare -" keyword prefix was eaten by the loose matchers, so
     the card read `tier: full` while granting 1{h} UNCONDITIONALLY ON
     PLAY — the charge trigger and the "next time you hit this turn"
     delay both dropped. Refusing the clause is weaker than printed and
     VISIBLE; the tier going down is the number improving (v3.16). */
  const want = ["Glisten", "Danger Digits", "Hope Merchant's Hood",
                "Banneret of Salvation"];
  /* A HERO IS NOT A DECK CARD AND NEITHER IS A TOKEN, and the pool holds
     all three (v3.21 keeps tokens by TYPE, v3.76 put Arakni's six Agents in
     the same way). The audit's headline "3 none" is over DECK cards; a flat
     census reports twenty and reads as seventeen regressions that are in
     fact the pool being complete. So all three sets are pinned SEPARATELY
     — which is worth more than the one number, because it says where an
     arrival landed. */
  const kind = c => {
    const ty = (c.ty || []).join(" ") + " " + (c.tt || "");
    if(/\bDemi-Hero\b|\bHero\b/i.test(ty)) return "hero";
    if(/\bToken\b/i.test(ty))                return "token";
    return "deck";
  };
  const none = {deck:[], hero:[], token:[]};
  for(const c of pool()){
    if(PR.fxParse(c).tier !== "none") continue;
    const k = kind(c);
    if(!none[k].includes(c.name)) none[k].push(c.name);
  }
  assert.deepEqual(none.deck.sort(), want.slice().sort(),
    "the set of DECK cards reading NOTHING moved — a card built here must leave " +
    "the ledger, and a card arriving here is a regression");
  /* 9 -> 5 AT v4.09, AND EVERY ONE OF THE FOUR IS AN AGENT OF CHAOS.
     Five printed `Attack Reaction - Discard an Assassin card: …`, a cost
     `parseHeroPower` declined by design — so the transformation swapped
     Arakni's whole ability half for one nothing could read (v3.77's
     no-op blind spot wearing a hero's face). A discard from hand is the
     fifth NAMED cost now, and four of them read. The fifth, Orb-Weaver,
     still refuses on its PAYLOAD (a token equip), which is v2.29 working
     rather than a gap in that build. */
  assert.equal(none.hero.length, 5,
    "the set of HEROES reading nothing moved. Exactly ONE is now an Agent of " +
    "Chaos — Trap-Door, refusing on its PAYLOAD (a deck search) rather than on " +
    "the cost; the rest are Arakni's own base form and heroes whose whole " +
    "printed line is read elsewhere, by `parseHeroPower` off the build");
  assert.equal(none.token.length, 7,
    "the set of TOKENS reading nothing moved. It was EIGHT at v4.02 and the " +
    "eighth was INERTIA — a token that WORKED while reading nothing, because " +
    "`effects.isInertia` matched it by NAME (v3.22's Runechant shape exactly, " +
    "and the golden rule broken). v4.03 taught the parser its printed wipe and " +
    "the by-name match is gone. The remaining seven are the honest kind: their " +
    "text has no reader and they do nothing. A tier that says `none` on a card " +
    "that WORKS is a LEAD (v3.93) — check the next one that leaves this set is " +
    "leaving because it was built, not because something started matching a name");
});

/* ============================================================
   C. RECORDS THIS SWEEP FOUND STALE — probes point the other way
   ============================================================ */

/* A runechant created BY playing an attack must NOT pop for that swing:
   the token's own trigger is "when you PLAY an attack action card", and
   one that did not exist at that instant never triggered. */
/* CLOSED AT v4.05. The probe asserts the thing IS BUILT — a card put
   face-up into the arsenal BY HEAVE fires its face-up trigger — so a
   regression is red. STILL LATENT in the pool (Thunder Quake is Guardian,
   no arrow deck holds it), which is exactly why nothing else would ever
   notice the wiring coming back out. */
probe("heave-faceup-trigger", () => {
  H.db();
  const both = {
    uid:"apx-hv", name:"Approx Heave Arrow", pitch:1, cost:0, power:3,
    tt:"Ranger Attack Action - Arrow", ty:["Ranger","Attack","Action"],
    kw:[], gkw:[],
    tx:"Heave 3\nWhen this is put face-up into your arsenal, it gets +2{p} this turn."
  };
  const g = H.state({hand:[both], res:3, ap:0}, {}, {turn:3, actor:0});
  const offer = E.heaveOffer(g, 0);
  assert.ok(offer, "fixture: the synthetic card is not heaveable");
  const h = E.heave(g, 0, offer.uid);

  /* THE READER MUST BE REACHABLE FROM OUTSIDE `makeEffects` — that is
     the whole of what v4.05 changed, and it is what a regression would
     undo first. */
  const fxq = J.withEffects({...h.game, actor:0}, fx => fx);
  assert.equal(typeof (fxq && fxq.faceUpArsenal), "function",
    "`faceUpArsenal` is no longer exposed, so no arsenal step can fire the trigger");

  const after = J.withEffects({...h.game, actor:0},
    (fx, s) => fx.faceUpArsenal(s, [], "Heave", "hand", true));
  assert.equal(after.sides[0].arsenal._arsPow, 2,
    "heave's face-up put fires no trigger again — v3.71's third site, reopened");
});

probe("runechant-same-swing", () => {
  /* SABOTAGE FOUND THIS PROBE, NOT THE ENGINE. The first draft grepped
     effects.js for `runeAtPlay` — and renaming the DECLARATION left the
     name standing in three comments, so the scan passed against an engine
     with the capture removed. A textual scan cannot tell a test from a
     NEUTERED one; drive it.

     VISERAI'S RITE IS THE ONE CARD THAT SEPARATES THE TWO READINGS. It
     mints INSIDE `execute`, before the pop site, so the new token is on
     the board when the pop runs and survives only because the firing set
     was captured by uid before the card acted. */
  H.db();
  const rune = byName("Runechant")[0];
  assert.ok(rune, "Runechant left the pool");
  const g = H.state({hand:[], res:9, ap:1,
                     board:[{uid:"r1", kind:"aura", card:rune}],
                     hist:{atk:0, non:1, arc:0, aura:0, made:0, booed:0, blue:0,
                           red:0, trans:0, blueGY:0, atkNames:[]}},
                    {hp:20}, {turn:3});
  g.builds = [{viseraiPassive:true, runeCard:rune}, {}];
  const c = {uid:90, name:"Approx Rite Swing", power:3, cost:0, pitch:1,
             tt:"Runeblade Attack Action", ty:["Runeblade","Action","Attack"],
             tx:"", kw:[], gkw:[]};
  const n = H.execute(g, c, "hand", 0, {});
  assert.equal(n.sides[1].hp, 19, "the token that WAS on the board did not pop for its printed 1");
  const left = (n.sides[0].board || []).map(b => b.card.name);
  assert.deepEqual(left, ["Runechant"],
    "the runechant the rite just conjured did not survive — the firing set is being " +
    "read AFTER the card acts, and the record must reopen");
  assert.ok(!(n.sides[0].board || []).some(b => b.uid === "r1"),
    "specifically: the survivor must be the NEW token, not the one that fired");
});

/* An ally attack is charged: its ability's own cost, and the action
   point. `allySwing` — which took the printed power off the hero's life
   for free — is gone from the live trainer. */
probe("ally-swing-free", () => {
  const live = HTML.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/\ballySwing\s*\(/.test(live),
    "index.html calls allySwing again — the free ally swing is back");
  assert.equal(typeof PR.allyAttack, "function", "parser.allyAttack is gone");
  /* and the route exists on the shared path */
  const src = fs.readFileSync(path.join(X.ROOT, "engine", "effects.js"), "utf8");
  assert.ok(/from\s*===\s*"ally"|"ally"/.test(src), "the ally attack route is gone from effects.js");
});

/* "If you do, …" is READ. `thisWayMet` is its evaluator and answers a
   `way:` condition after the ops have run. */
probe("if-you-do-unread", () => {
  assert.equal(typeof E.thisWayMet, "function", "thisWayMet is gone");
  /* both spellings reach a reader */
  let both = 0;
  for(const c of pool()){
    const fx = PR.fxParse(c);
    if((fx.conds || []).some(cd => /^way:/.test(String(cd.cond)))) both++;
  }
  assert.ok(both > 0, "no pool card routes an if-you-do rider through a way: condition " +
                      "— the reader has been lost and the record must reopen");
});

/* A "when this leaves the arena" payload fires on the DEPARTURE, not on
   the play. `sweepArena` is the schedule and both boards call it. */
probe("arena-payload-on-play", () => {
  assert.equal(typeof E.sweepArena, "function", "sweepArena is gone");
  assert.equal(typeof E.tickSuspense, "function", "tickSuspense is gone");
  const might = byName("Might")[0];
  assert.ok(might, "the Might token left the pool");
  const fx = PR.fxParse(might);
  const kinds = (fx.ops || []).map(o => o[0]);
  assert.ok(kinds.indexOf("selfDestruct") >= 0,
    "Might no longer carries its own destroy — the schedule was swallowed again");
  assert.ok(kinds.indexOf("selfDestruct") < kinds.indexOf("buffNext"),
    "the payload no longer rides AFTER the destroy in printed order");
});

/* Inertia is a hand wipe at the beginning of its controller's end phase,
   and the parser's `noop` reason names the reader that runs it. */
probe("inertia-noop", () => {
  assert.equal(typeof E.resolveInertia, "function", "resolveInertia is gone");
  const cl = PR.classifyClause("inertia");
  assert.ok(cl, "the inertia clause is no longer read at all");
  assert.ok(/resolveInertia/.test(JSON.stringify(cl)),
    "the inertia noop no longer names its reader — v3.16: a noop must describe the " +
    "clause in front of it");
  /* driven: a hand is wiped */
  const g = H.state({hand:[{uid:1,name:"A",tt:"Generic Action",ty:["Generic","Action"],tx:"",kw:[]},
                           {uid:2,name:"B",tt:"Generic Action",ty:["Generic","Action"],tx:"",kw:[]}],
                     deck:[],
                     /* the ENTRY, not the card — `isInertia` reads `b.card.name` */
                     board:[{uid:9, kind:"aura", card:one("Inertia")}]}, {});
  const out = E.resolveInertia(g, 0);
  assert.ok(out && out.game, "resolveInertia no longer returns a game");
  assert.equal(out.game.sides[0].hand.length, 0, "Inertia no longer wipes the hand");
});

/* The soul is a driven zone: it is charged, it is read, and an EMPTY one
   refuses a soul-cost ability rather than granting it free. */
probe("soul-unexercised", () => {
  const g = H.state({soul:[], hand:[]}, {});
  const charged = H.runOps(g, [["soulTop", 1]], "probe");
  assert.ok(charged, "the soul op route is gone");
  assert.equal(typeof PR.abSoulCost, "function",
    "parser.abSoulCost is gone — nothing reads a soul cost");
  /* both boards refuse an empty soul before the ability resolves */
  const jsrc = fs.readFileSync(path.join(X.ROOT, "engine", "judge.js"), "utf8");
  assert.ok(/abSoulCost|abCostWhy/.test(jsrc), "judge no longer refuses an empty soul");
});

/* Seat 1 has a real action phase at the TABLE: it is issued an action
   point at the beginning of its own action phase (CR 4.3.2). */
probe("dummy-no-action-phase", () => {
  /* `makeGame` is sides.js's, not priority.js's — the first draft asked the
     wrong module and threw, which is a fixture failing rather than a record
     being wrong. */
  let h = S.makeGame({sides:[S.makeSide({id:0}), S.makeSide({id:1})]});
  h = P.endTurn(h);
  assert.equal(h.turnPlayer, 1, "the seat handoff no longer reaches seat 1");
  h = P.toPhase(h, "action");
  assert.equal(h.priority, 1, "seat 1 does not hold priority in its own action phase");
  assert.equal(P.canAct(h, 1), true, "seat 1 may not act in its own action phase");
});

/* ============================================================
   D. OPEN DESIGN QUESTIONS
   ============================================================ */

/* A board aura's printed Ward does NOT feed the prevention pool. */
probe("aura-ward-prevention-pool", () => {
  /* CLOSED AT v4.34, AND THE PROBE HAD TO BE REWRITTEN TO SEE IT. The old
     one built a side, put the aura on its board and asserted `sd.ward === 0`
     — a field `makeSide` had just defaulted to 0, with nothing driven in
     between — so it passed identically before and after the answer, and the
     record outlived its own version. A hand-written state answering its own
     question (v2.80), which is one of the four shapes v4.02 caught when this
     ledger was built. This one RESOLVES the card and then hits the hero. */
  const spec = one("Waxing Specter");                         /* Ward 3 */
  const g = H.state({hand: [{...spec, uid: 61}], res: 9, ap: 1}, {}, {turn: 5});
  const played = H.execute(g, {...spec, uid: 61}, "hand", 0, {});
  assert.equal(played.sides[0].ward || 0, 0,
    "playing a ward aura banks a prevention POOL again — the permanent carries it");
  assert.equal((played.sides[0].board || []).length, 1, "fixture: the aura must reach the arena");

  const hit = H.J.withEffects(played, (fx, s2) => {
    const r = fx.preventDamage(s2, 0, 1, "probe");
    return Object.assign({}, r.game, {_p: r.prevented});
  });
  assert.equal(hit._p, 1, "…and it is what prevents");
  assert.deepEqual(hit.sides[0].board, [],
    "…by destroying itself, which is what SEN037's reminder text prints");
});

/* A face-down (Cloaked) piece keeps its printed values: nothing changes
   them, which is the deliberate narrowness. */
probe("cloaked-face-down-values", () => {
  const eng = pool().find(c => /cloaked/i.test((c.kw || []).join(" ")) ||
                               /\bcloaked\b/i.test(c.tx || ""));
  assert.ok(eng, "no cloaked card in the pool");
  const G = require("../engine/game.js");
  const down = {...eng, uid:31, _faceDown:true, curDef:null};
  const up   = {...eng, uid:32, curDef:null};
  assert.equal(G.gearDef(down), G.gearDef(up),
    "a face-down piece is now worth a different defence — that is a RULING and the " +
    "record must say it was made");
});

/* The Cloaked ruling's display half is not built. A claim about a shared
   component, pinned as source. */
probe("cloaked-display", () => {
  /* THE FILE-WIDE SCAN IS THE WRONG SHAPE and reported this closed on its
     first run: index.html DOES read `_faceDown`, once, in the flip-cost
     LEGALITY (v3.99) — a rules read, not a display one. Ask the component
     that would have to change. */
  const i = HTML.indexOf("function ArmorGrid");
  assert.ok(i > 0, "ArmorGrid is gone — the shared cell moved and this pin is stale");
  const body = HTML.slice(i, HTML.indexOf("\n}", i));
  assert.ok(!/_faceDown|faceDown|cardBack/.test(body),
    "ArmorGrid now renders a face-down piece differently — the Cloaked display " +
    "half is BUILT and the record must move (and the UI-pass note with it)");
});

/* Both peers hold the full state, the opponent's hand included. */
probe("peers-hold-full-state", () => {
  const hand = [{uid:1, name:"Secret", pitch:1, tt:"Generic Action",
                 ty:["Generic","Action"], tx:"", kw:[]}];
  const g = H.state({hand:[]}, {hand});
  /* A NAME IN THE PAYLOAD PROVES NOTHING: cards are INTERNED, so the
     dictionary carries every definition whatever zone references it.
     Sabotaging the hand out of the wire's field list came back SILENT
     against a `/Secret/` scan of the encoded JSON. Round-trip it and ask
     the ZONE. */
  const back = W.decode(W.encode(g));
  const oppHand = (back.sides[1].hand || []).map(c => c.name);
  assert.deepEqual(oppHand, ["Secret"],
    "the wire no longer carries the opponent's hand — hidden information has been " +
    "built and the Phase B record must move");
});
