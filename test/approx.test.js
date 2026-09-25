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
  /* 30 -> 31 AT v4.45: `arena-ability-no-table-route`. v3.01's shape and
     the last of that family standing — the trainer's `boardPow` (v2.35)
     is UI, so judge has no branch and an arena permanent's activated
     ABILITY cannot be activated at the table at all. Recorded rather than
     half-built, because the four defects that version fixed were all
     UI-to-reducer wiring against routes the reducer already had, and this
     one is an engine build. */
  /* 31 -> 32 AT v4.47: `arena-ability-no-table-route` was BUILT and is
     `arena-ability-routed-at-the-table` (closed, probe turned round), and
     `arena-ability-policy-declines` is the new `stated` record beside it —
     the route works and the POLICY declines it, which is v4.24's standing
     rule and a number about the policy rather than the route. */
  /* 32 -> 33 AT v4.48: `charged-this-way-count`. V of the Vanguard is the
     pool's NINTH "+N{p} for each …" record and the one member of that family
     the new reader refuses — its subject is a STANDING grant over a window
     rather than a pump on the resolving card, and its countable ("Light
     cards charged THIS WAY") is a number nothing keeps. Recorded rather
     than half-built, and the record's own first draft named the wrong
     blocker until the engine was asked (v4.09). */
  /* 33 -> 34 AT v4.49: `steam-build-powcard-handwritten`. Making Plasma
     Barrel Shot swingable at all made its OTHER printed ability reachable,
     and that one is a powCard `build.js` writes by hand because the payload
     has no parser reader (three readers' worth of work). The behaviour is
     right — the printed gate is enforced at resolution AND, from this
     version, as a legality — so what is recorded is that the CLAUSE is
     unread and the card honestly reports `part`. */
  /* 34 -> 35 AT v4.52: `paycost-defends-trainer-only`. Found sideways
     while merging the two `payTrigger` readers into one — Brothers in
     Arms emits a `defends` payCost, reads `tier: full`, and `offerPayCost`
     is never called with that trigger, so the sheet exists on the TRAINER
     alone. v3.01's shape, and v4.21's rule finding it: census the family,
     not the member in front of you. */
  /* 35 -> 36 AT v4.53: `paycost-defends-trainer-only` was BUILT and is
     `paycost-defends-at-the-table` (closed, probe turned round), and
     building it measured a SECOND one-board wall — the trainer's own
     player-blocks path reaches no shared `defends` body at all, so Crash
     and Bash and Washed Up Wave are dead on the wall the player raises.
     One record closed, one opened, net +1. */
  /* 36 -> 37 AT v4.54: `chi-floating-is-a-bound`. There is no `sd.chi` —
     the floating Chi is DERIVED as `min(res, Chi pitched this turn)`,
     which is a BOUND rather than the exact number: spend all your Chi,
     then pitch an ordinary card, and the bound reads the new points as
     Chi. Unreachable in this pool and that is MEASURED — {c} has one
     claimant in 797 records and it prints Once per Turn — so the record
     carries the measurement and the probe asserts the deviation. */
  /* 37 -> 38 AT v4.59: `multi-target-pick-all-or-nothing`. */
  /* 38 -> 39 AT v4.60: `drx-bar-from-arsenal-unread`. */
  /* 39 holds AT v4.63: `steam-build-powcard-handwritten` was BUILT and is
     `steam-build-powcard-read` — renamed, closed, probe turned round. */
  /* 39 -> 40 AT v4.66: `layer-step-window` was built and renamed
     `play-held-on-the-stack`, and `instant-speed-plays-resolve-on-play`
     records what the table stack still collapses. */
  /* 40 -> 41 AT v4.68: `control-change-steal`, Jack Be Quick. */
  assert.equal(Object.keys(APPROX).length, 41, "record count moved");
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
  /* 12 -> 13 stated AT v4.47: `arena-ability-policy-declines`. */
  /* 13 -> 14 AT v4.49: `steam-build-powcard-handwritten`. */
  /* 14 -> 15 AT v4.54: `chi-floating-is-a-bound`. */
  /* 15 -> 16 AT v4.59: `multi-target-pick-all-or-nothing`. What the CR says
     about a partially-legal target set is not SOURCED here — the site is
     unreachable from this sandbox and the repo carries no verbatim quote — so
     the direction is the conservative one under both readings and the record
     is what forces the decision the day somebody can check. */
  /* 16 -> 17 AT v4.60: `drx-bar-from-arsenal-unread` — the NARROWER third
     wording of the family v4.60 built. Read by the unconditional anchor it
     would bar a defence reaction from the HAND too, which is stronger than
     printed, so it refuses and the card keeps the `quotedUnread` flag. */
  /* 17 -> 16 AT v4.63: `steam-build-powcard-handwritten` was BUILT — its
     probe went RED the moment the three readers landed, which is the
     reversal a `stated` record exists to force (v4.02). */
  /* 16 -> 17 AT v4.66: `instant-speed-plays-resolve-on-play` — what the
     table stack still collapses, recorded the version it was built. */
  /* 17 -> 16 stated, 18 -> 19 closed AT v4.69: `drx-bar-from-arsenal-unread`
     was BUILT and is `drx-bar-from-arsenal-read`, its probe turned round. */
  assert.equal(n("stated"), 16, "stated count moved");
  /* 9 -> 8 open, 8 -> 9 closed AT v4.26: `trainer-fatigue-loss` was
     built. That is the reversal a `stated`/`open` record exists to force
     (v4.02) — its probe went RED the moment the gap closed, and closing
     it is a deliberate edit to this line rather than a stale sentence. */
  /* 8 -> 7 open, 10 -> 11 closed AT v4.35: `aura-ward-prevention-pool`
     was ANSWERED at v4.34 and the record survived its own version by one,
     because its probe drove nothing. */
  /* 7 -> 6 open, 12 -> 13 closed AT v4.47: the arena-ability route was
     built one version after it was recorded, and its probe went RED the
     moment the branch landed — which is the reversal an `open` record
     exists to force (v4.02). */
  /* 6 -> 7 AT v4.48: `charged-this-way-count`, and 7 -> 6 at v4.56 when it
     was BUILT — the probe went red the moment the site landed, and the
     record is `closed` with its probe turned round (v4.02). */
  /* 7 -> 8 AT v4.52: `paycost-defends-trainer-only` — found sideways
     while merging the two `payTrigger` readers, which is what a census
     of a family is for (v4.21). */
  /* 8 open holds AT v4.53: one closed (`paycost-defends-at-the-table`),
     one opened (`trainer-blocks-wall-no-defends-body`) — which is why the
     RECORD count is the one that moves and the open count does not. */
  /* 8 -> 7 AT v4.56: `charged-this-way-count` was BUILT. And the record it
     closed had a STATED REASON THAT WAS WRONG in the half it was most
     confident about — it named a missing MECHANISM for the standing grant,
     which has had a reader since v3.87, when what refused was four words of
     printed word order. Asking the engine is what corrected it (v3.69,
     v4.09), which is the second record this project has closed that way. */
  /* 7 -> 6 AT v4.57: `trainer-blocks-wall-no-defends-body` was BUILT, and
     closing it closed a SECOND defect the record did not name — the pause it
     replaced paid out of FLOATING resources only, which CR 4.4.3e makes 0 on
     the one turn that wall is ever raised. So Brothers in Arms' +2{d}, built
     at v4.53 for this exact wall, was unreachable there. Second cycle running
     in which a record's own stated reason was narrower than the defect. */
  /* 6 -> 5 AT v4.66: `layer-step-window` was BUILT and is
     `play-held-on-the-stack`, closed with its probe turned round. */
  /* 5 -> 6 AT v4.68: `control-change-steal`, recorded rather than
     half-built (HANDOFF's call). */
  assert.equal(n("open"),    6, "open count moved");
  /* 16 -> 17 AT v4.63: `steam-build-powcard-read`. 17 -> 18 AT v4.66:
     `play-held-on-the-stack`. */
  assert.equal(n("closed"), 19, "closed count moved");
});

/* ============================================================
   A. THE RULES MACHINE
   ============================================================ */

/* CR 7.1.2 — an attack should sit on the STACK as a layer before it
   becomes a chain link. Here it goes straight onto the chain, so the
   observable is that nothing is ever on `stack` while a link exists. */
/* BUILT AT v4.53, AND THE PROBE IS TURNED ROUND. It was `open` at v4.52
   and asserted the DEVIATION — that `effects.js` had no `defends` site —
   which is exactly what made closing it a deliberate edit here rather
   than a stale sentence (v4.02). `closed` now, so it asserts the thing is
   BUILT and goes red if it regresses. */
probe("chi-floating-is-a-bound", () => {
  /* THE PREMISE THE RECORD RESTS ON, MEASURED RATHER THAN ASSERTED IN
     PROSE (v3.41): one claimant, and it is Once per Turn. */
  const pool = require("../data/pool.json");
  const prints = pool.filter(r => /\{c\}/.test(r.functional_text_plain || r.functional_text || ""));
  assert.deepEqual([...new Set(prints.map(r => r.name))], ["Enigma"],
    "a second {c} cost makes the bound reachable — close the record or bank the count");
  assert.ok(/Once per Turn Instant - \{c\}\{c\}\{c\}/.test(prints[0].functional_text_plain || ""),
    "…and the once-per-turn limit is what stops a second payment inside one turn");

  /* THE DEVIATION, DRIVEN. Spend the Chi, then raise the pool with an
     ordinary card: the bound reads the new points as Chi. A `sd.chi`
     field would answer 0 here, which is what turns this record round. */
  H.db();
  const chi  = Object.assign({}, H.card("Inner Chi", 3), {uid: 7701});
  const blue = Object.assign({}, H.card("Unmovable", 3), {uid: 7702});
  const spent = {res: 0, pitch: [chi]};
  assert.equal(PR.chiFloating(spent), 0, "with the pool empty the bound is right");
  const refilled = {res: 3, pitch: [chi, blue]};
  assert.equal(PR.chiFloating(refilled), 3,
    "AND HERE IT OVER-REPORTS: the three points came from the blue card, and " +
    "the bound cannot tell, because the exact answer depends on the ORDER of " +
    "the spends and neither zone records it");
});

probe("paycost-defends-at-the-table", () => {
  /* THE PREMISE, DRIVEN: a real pool record emits the trigger. */
  PR.fxReset();
  const bia = PR.fxParse(H.card("Brothers in Arms", 1));
  assert.equal(bia.tier, "full", "the clause IS consumed — which is why coverage could not see this");
  assert.deepEqual(bia.payCost,
    {cost: 1, taps: false, ops: [["defBuff", 2]], trigger: "defends"});
  PR.fxReset();

  /* THE TABLE HAS THE ROUTE, DRIVEN END TO END through the shared body —
     the sheet, the charge, and the number reaching what the card is
     WORTH at the wall. A source scan cannot tell a live render from a
     dead one (v4.00), and this is the half that was missing. */
  const card = Object.assign({}, H.card("Brothers in Arms", 1), {uid: 3301});
  const atk  = Object.assign({}, H.card("Raging Onslaught", 1), {uid: 3302});
  const g0 = H.state({res: 9, ap: 1},
    {hp: 20, res: 5, hand: [card], blockH: [3301], deck: [{uid: 3310, name: "F"}]},
    {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
  const g = Object.assign({}, g0, {
    pend: {card: atk, by: 0, total: atk.power, ga: false, ops: [], onHit: [],
           _qCtx: {from: "hand", atk: true}},
    stack: [{k: "atk", label: "x"}]});
  let n = J.withEffects(g, (fx, st) => ({game: fx.afterDefenders(st, [card], [])})).game;
  assert.ok(n.prompt, "the sheet opens off the declared wall at the table");
  assert.equal(n.prompt.side, 1, "addressed to the DEFENDER");
  const printed = E.defendValue(n.sides[1], card, {});
  n = J.reduce(n, {t: "promptChoose", choice: "pay"}, 1).state;
  n = J.reduce(n, {t: "promptConfirm"}, 1).state;
  assert.equal(n.sides[1].res, 4, "the printed cost is charged");
  assert.equal(E.defendValue(n.sides[1], card, {}) - printed, 2,
    "and the +{d} reaches `defendValue`, which is the one reader both walls use");

  /* AND THE TRAINER'S OWN PAUSE IS GONE (v4.57). This used to assert the
     opposite — that `index.html` kept its own `defends` scan and its own
     `mode: "defpay"` — which was true and was the OTHER gap:
     `trainer-blocks-wall-no-defends-body`, one wall over. Both walls call
     `effects.defendsTriggers` now and both sheets are the shared one, so
     the trainer has no private copy of either. See `test/defwall.test.js`. */
  /* COMMENTS STRIPPED. Both of these read the RAW source in their first
     draft and both PASSED-then-FAILED on prose: the note recording the
     retirement names `mode: "defpay"` in as many words, so a raw scan
     reports the pause still there. v4.27's own defect, inside this probe,
     and the control is routed through the scan rather than sitting beside
     it (v4.32). */
  const bare = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
  const ctl = "/* " + "defpay" + " */";
  assert.equal(bare("x " + ctl + " y").indexOf("defpay"), -1, "the stripper works");
  const live = bare(HTML);
  assert.ok(!/px\.trigger\s*===\s*"defends"/.test(live),
    "no hand-rolled defends scan survives in the trainer");
  assert.ok(!/mode:\s*"defpay"/.test(live),
    "…and no private pause either — the queue carries all four families");

  /* THE DESTROY VERB IS STILL WITHHELD, AND ON PURPOSE. Measured: no pool
     record prints a `defends` payCost carrying `destroySelf`, and
     `applyAnswer` resolves a `destroyUid` against the GEAR and the ARENA
     — a card in the HAND wall would pay nothing. Vocabulary with no
     claimant is dead rules code that reads like a rule (v4.52). */
  assert.ok(PR.OFFER_TRIGGERS.indexOf("defends") < 0,
    "the destroy cost verb stays away from this trigger until a record prints one");
});

/* THE TRAINER HAS TWO WALLS AND ONE OF THEM REACHES NO SHARED `defends`
   BODY (v4.53). An `open` record, so the probe asserts the DEVIATION: it
   goes red the day `takeIt` reaches `afterDefenders`, which is what forces
   the record to be deleted rather than left to rot (v4.02). */
probe("trainer-blocks-wall-no-defends-body", () => {
  /* TURNED ROUND AT v4.57. It used to assert the DEVIATION — that `takeIt`
     never reached `afterDefenders` — and it went RED the moment the site
     landed, which is exactly what an `open` record's probe is for (v4.02).
     `closed` now, so it asserts the thing is BUILT.

     THE PREMISE STAYS DRIVEN: two pool families emit a `defends` trigger
     that is NOT the payCost the trainer's old scan handled. */
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const orphan = new Set();
  for(const c of arr){
    PR.fxReset();
    const fx = PR.fxParse({name: c.name, pitch: +(c.pitch || 0), tt: c.type_text || "",
      ty: c.types || [], tx: c.functional_text || "", kw: c.card_keywords || [],
      cost: c.cost, power: c.power, def: c.defense});
    for(const k of ["optCost", "millCost"])
      if(fx[k] && fx[k].trigger === "defends") orphan.add(c.name);
  }
  PR.fxReset();
  assert.deepEqual([...orphan].sort(), ["Crash and Bash", "Washed Up Wave"],
    "the two families that could not reach the player-blocks wall");

  /* THE BUILD. Bounded at the next same-indent declaration, never by a byte
     count — a bound too WIDE hides findings and one too NARROW invents them
     (v4.05), and this probe's own first draft used `i + 6000`, which
     swallowed `confirmDefPay` and reported the deviation closed. */
  const i = HTML.indexOf("const takeIt = () => setG");
  assert.ok(i > 0, "takeIt moved — re-anchor this probe");
  const j = HTML.indexOf("\n  const ", i + 10);
  assert.ok(j > i, "the next declaration moved — re-anchor this probe");
  /* COMMENTS STRIPPED, WITH THE STRIPPER'S CONTROL ROUTED THROUGH THE SCAN
     (v4.27, v4.32). This body's prose names the shared function, so a raw
     scan would pass on the strength of a sentence rather than a call. The
     control is built by CONCATENATION, because written as a literal it would
     appear in THIS file rather than in the one being scanned. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
  const ctrl = "/* " + "defendsTriggers" + " */";
  assert.equal(strip("x " + ctrl + " y").indexOf("defendsTriggers"), -1,
    "the stripper works, proved through the scan rather than beside it");
  const body = strip(HTML.slice(i, j));
  assert.match(body, /_EFX\.defendsTriggers\(s, actorOf\(s\),/,
    "the block wall calls the ONE body, naming its OWN seat as the defender");
  assert.ok(!/trigger\s*===\s*"defends"/.test(body),
    "and keeps no private scan — that copy is what made the other three families a gap");
  /* AND THE PAUSE IS THE HALF THIS RECORD SAID WOULD COST A CONTROL-FLOW
     CHANGE. It was right; the change is `_wallPending`, which generalises
     `defpay`'s private pause to the whole queue. */
  assert.match(body, /return openPrompt\(\{\.\.\.dt\.game, _wallPending: true\}\);/,
    "a queued sheet holds the wall until it is answered");
  /* AGAINST THE STRIPPED SOURCE, for the reason two lines of this file's own
     prose demonstrate: the note recording the retirement names the function. */
  assert.ok(!strip(HTML).includes("confirmDefPay"),
    "…and the family-specific pause it replaces is gone");
});

/* BUILT AT v4.66, AND THE PROBE IS TURNED ROUND. It was `layer-step-window`,
   `open`, and asserted the DEVIATION — one action took the step from `layer`
   to `attack` with nothing on the stack. It stayed green through the build
   because its fixture (an opening hand) held no instant-speed answer, and a
   window nobody can use resolves at once: CR-identical, and invisible to that
   probe. What tells the two engines apart is a seat that CAN answer. */
const stackTable = (defHand) => {
  H.db();
  const c = (nm, p, uid) => ({...H.card(nm, p), uid});
  return {...H.state({res: 9, ap: 1, hand: [c("Raging Onslaught", 1, "atk")]},
                     {res: 9, hand: defHand.map((x, i) => c(x[0], x[1], "d" + i))},
                     {turn: 3, actor: 0, turnPlayer: 0}),
          phase: "action", step: "layer", priority: 0, passed: [false, false],
          stack: [], chain: [], chainCards: []};
};
probe("play-held-on-the-stack", () => {
  let n = J.reduce(stackTable([["Oasis Respite", 1]]), {t: "play", uid: "atk", from: "hand"}, 0).state;
  const top = (n.stack || [])[n.stack.length - 1];
  assert.ok(top && top.k === "play" && top.card.uid === "atk",
    "an attack the defender could answer went straight to the chain — the layer step regressed");
  assert.equal((n.chainCards || []).length, 0, "…and it is not a chain link yet");
  assert.ok(!n.sides[0].hand.some(x => x.uid === "atk"), "…and it has left the hand for the stack");
  /* THE WINDOW IS REAL: the defender answers BEFORE it resolves. */
  n = J.reduce(n, {t: "pass"}, 0).state;
  assert.equal(n.priority, 1, "the defender never got priority over the waiting card");
  assert.equal(J.legal(n, {t: "play", uid: "d0", from: "hand"}, 1), null,
    "the defender's instant is not playable in the window");
  /* CONTROL: with nothing to answer it, it resolves at once — the one
     outcome a window nobody can use has. */
  const quiet = J.reduce(stackTable([]), {t: "play", uid: "atk", from: "hand"}, 0).state;
  assert.equal(quiet.step, "attack", "an unanswerable play waited anyway");
  assert.deepEqual(quiet.stack || [], []);
});

/* THE HALVES STILL COLLAPSED (v4.66). An instant resolves on the spot, so
   the probe plays one while the other seat holds an instant-speed answer
   and finds nothing on the stack afterwards. The day instants are held,
   this goes red and the record must move. */
probe("instant-speed-plays-resolve-on-play", () => {
  const g = stackTable([["Oasis Respite", 1]]);
  const c = {...H.card("Oasis Respite", 1), uid: "mine"};
  const g2 = J.put(g, 0, s => ({...s, hand: [c, ...s.hand]}));
  const out = J.reduce(g2, {t: "play", uid: "mine", from: "hand"}, 0);
  assert.equal(out.error, null, "fixture: the instant was refused — " + out.error);
  assert.deepEqual(out.state.stack || [], [],
    "an INSTANT now rests on the stack — the response-to-a-response half is built " +
    "and the record must move");
});

/* THE POOL'S ONLY CONTROL CHANGE (v4.68). Driven: Jack Be Quick hits a
   hero whose side holds an ally, and the ally is still theirs afterwards.
   The day the steal is built this goes red and the record must move. */
probe("control-change-steal", () => {
  H.db();
  const c = (nm, p, uid) => ({...H.card(nm, p), uid});
  const ally = {...c("Swabbie", 2, "al"), life: 3};
  let g = {...H.state({res: 9, ap: 1, hand: [c("Jack Be Quick", 1, "jbq")]},
                      {hand: [], board: [{card: ally, kind: "ally", spent: true, uid: "al", life: 3}]},
                      {turn: 3, actor: 0, turnPlayer: 0}),
           phase: "action", step: "layer", priority: 0, passed: [false, false],
           stack: [], chain: [], chainCards: []};
  const hp = g.sides[1].hp;
  let n = H.drain(J.reduce(g, {t: "play", uid: "jbq", from: "hand"}, 0).state);
  for(let i = 0; i < 20 && n.step !== "resolution" && n.priority != null; i++){
    if(n.prompt){ n = J.reduce(n, J.autoAnswer(n), n.prompt.side || 0).state; continue; }
    n = J.reduce(n, {t: "pass"}, n.priority).state;
  }
  assert.ok(n.sides[1].hp < hp, "fixture: Jack Be Quick never HIT the hero, so its clause was never reached");
  assert.ok(n.sides[1].board.some(b => b.uid === "al"),
    "the ally left its controller — a steal has been built and the record must move");
  assert.ok(!n.sides[0].board.some(b => b.uid === "al"), "…and it is not on the thief's board");
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
/* An arena permanent's activated ABILITY is trainer-only. */
probe("arena-ability-routed-at-the-table", () => {
  /* THE PROBE IS TURNED ROUND AT v4.47 (v4.02's two directions). It used
     to assert the DEVIATION — `legal` refusing "prints no attack to
     activate" — and went red the day the branch arrived, which is the
     whole point of an `open` record. It asserts the BRANCH now, so a
     regression is a red drill.

     IT DRIVES `legal`, not a grep (v4.36's census): a source scan would
     pass by finding nothing exactly as a real gap does. The fixture is an
     Energy Potion — an Item whose whole printed line is `Instant - Destroy
     this: Gain {r}{r}`, which `parseHeroPower` reads in full, so what was
     refusing was the ROUTE and not the text. */
  const pot = {uid: 9403, name: "Energy Potion", tt: "Generic Item",
               ty: ["Generic", "Item"], tx: "Instant - Destroy this: Gain {r}{r}"};
  const g0 = H.state({res: 3}, {hp: 20});
  const g = {...g0, phase: "action", step: "layer", priority: 0, turnPlayer: 0, actor: 0};
  g.sides[0] = {...g.sides[0], ap: 1, board: [{uid: 9403, kind: "item", card: pot}]};
  assert.equal(J.legal(g, {t: "activate", uid: 9403}, 0), null,
    "the table has lost the arena-ability route again — v3.01's shape, restored");
  /* AND IT RESOLVES, because a `legal` that permits and a `reduce` that
     does nothing is the sev-1 category wearing a legal move's clothes
     (v3.50, and `fuzz.test.js`'s own agreement property). */
  const out = J.reduce(g, {t: "activate", uid: 9403}, 0);
  assert.equal(out.error, null, "…and `reduce` agrees with `legal`");
  assert.equal(out.state.sides[0].res, 5, "the ability RESOLVED — +2 resource");
  assert.equal(out.state.sides[0].board.length, 0, "…and the destroy cost was paid");
  /* AND THE ATTACK ROUTE BESIDE IT STILL WORKS, which is the control: a
     `legal` that permits everything in the arena satisfies the assertion
     above and says nothing (v3.98 — ask for the refusal too). */
  const ally = {uid: 9404, name: "Probe Ally", tt: "Pirate Ally", ty: ["Pirate", "Ally"],
                power: 2, life: 3, cost: 0, tx: "Action - {r}: Attack"};
  const g2 = {...g};
  g2.sides = g.sides.slice();
  g2.sides[0] = {...g.sides[0], board: [{uid: 9404, kind: "ally", card: ally, life: 3}]};
  assert.equal(J.legal(g2, {t: "activate", uid: 9404}, 0), null,
    "the arena ATTACK route stopped working");
  /* AND A PERMANENT THAT PRINTS NEITHER IS STILL REFUSED — the other half,
     or the branch is a widening rather than a reading. */
  const inert = {uid: 9405, name: "Probe Sigil", tt: "Generic Token - Aura",
                 ty: ["Generic", "Aura"], tx: "Ward 1"};
  const g3 = {...g};
  g3.sides = g.sides.slice();
  g3.sides[0] = {...g.sides[0], board: [{uid: 9405, kind: "token", card: inert}]};
  assert.match(String(J.legal(g3, {t: "activate", uid: 9405}, 0)),
    /prints no attack or ability to activate/,
    "a permanent printing neither must still refuse, and the refusal must name both");
});

probe("arena-ability-policy-declines", () => {
  /* THE DEVIATION IS THAT `sparring.js` NEVER PROPOSES ONE, and that is a
     stated choice (v4.24) rather than a gap. What this asserts is the
     STATE the claim describes: the policy reads no card text, so it cannot
     price a cost paid with the permanent, and the file names no such
     route. It goes red the day somebody wires one — which is the moment to
     re-measure the ladder on both sides (v4.40).

     A SOURCE SCAN IS HONEST HERE because the claim is about ABSENCE, and
     absence is the one thing a driven probe cannot show: a policy that
     returns nothing for a board with an ability on it is indistinguishable
     from one that never looked. Both halves are asked. */
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "engine", "sparring.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/boardAbilityOf/.test(src),
    "the policy now asks for an arena ABILITY — close this record and re-measure the " +
    "ladder at three seeds on BOTH sides before quoting any move (v4.40)");
  /* THE CONTROL: it DOES ask for the arena ATTACK, so the scan is alive
     and the absence above is about this route rather than about the scan
     (v4.00, v3.81 — a scan aimed at the wrong shape reports nothing
     exactly as a real absence does). */
  assert.ok(/boardAttackOf/.test(src),
    "the policy stopped asking for the arena ATTACK either — the scan is aimed wrong");
});

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
probe("multi-target-pick-all-or-nothing", () => {
  /* DRIVEN, and it asserts the DEVIATION — so it goes RED the day somebody
     builds partial resolution, which is what a `stated` record is for (v4.02).
     The piece SURVIVING is half the claim: refusing before the destroy is the
     whole reason this direction is the conservative one. */
  const db = H.db();
  if(!db) return;
  const ent = (n, p, uid) => Object.assign({}, C.resolveEntry(db, {name: n, p: p, code: null, q: 1}), {uid});
  const gr = Object.assign({}, C.resolveEntry(db, {name: "Crown of Dichotomy", p: 0, code: null, q: 1}), {uid: 41});
  const BD = require("../engine/build.js");
  PR.fxReset(); BD.equipPiece(gr); PR.fxReset();
  const board = grave => Object.assign(
    H.state({gear: [gr], hand: [], grave: grave, deck: [ent("Wounding Blow", 1, 600)], res: 9, ap: 1},
      {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}),
    {phase: "action", step: "layer", priority: 0, passed: []});
  const half = board([ent("Arcanic Shockwave", 1, 701)]);
  const why = J.legal(half, {t: "activate", uid: 41, from: "gear"}, 0);
  assert.ok(why, "the half-available activation is allowed — partial resolution exists now, "
    + "so this record is stale: read it and close it");
  assert.match(String(why), /BOTH its targets/);
  const out = J.reduce(half, {t: "activate", uid: 41, from: "gear"}, 0);
  const kept = ((out.state || half).sides[0].gear || []).find(x => x.uid === 41);
  assert.ok(!kept.destroyed, "the piece was destroyed by a refused activation");
});

probe("drx-bar-from-arsenal-read", () => {
  /* TURNED ROUND AT v4.69: it asserts the BUILD now, in the three halves the
     stated probe asked about — the narrow wording reads WITH ITS ZONE (never
     `true`, which would bar the hand), the unconditional one is unchanged,
     and the card's grant carries the bar where the rider was unread. */
  const narrow = PR.classifyClause("defense reactions can't be played from arsenal this chain link");
  assert.equal(narrow && narrow.noDrx, "arsenal",
    "the 'from arsenal' wording regressed — refused again, or widened onto the HAND door");
  const yes = PR.classifyClause("defense reactions can't be played to this chain link");
  assert.equal(yes && yes.noDrx, true, "the unconditional wording stopped reading");
  const db = H.db();
  if(!db) return;
  PR.fxReset();
  const rt = C.resolveEntry(db, {name: "Release the Tension", p: 1, code: null, q: 1});
  const fx = PR.fxParse(rt);
  const op = fx.ops.find(o => o[0] === "buffNext");
  assert.deepEqual(op && op[3], {noDrx: "arsenal"}, "the grant no longer carries the bar");
  const dr = C.resolveEntry(db, {name: "Put in Context", p: 3, code: null, q: 1});
  const link = {card: {name: "Arrow", tt: "Ranger Action - Arrow Attack", power: 3, tx: ""},
                noDrx: [{from: "arsenal", src: "Release the Tension"}]};
  assert.ok(PR.drxBarWhy(link, dr, "arsenal"), "the granted bar no longer closes the arsenal");
  assert.equal(PR.drxBarWhy(link, dr, "hand"), null, "the granted bar closes the HAND — stronger than printed");
});

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
probe("steam-build-powcard-read", () => {
  /* A `closed` PROBE ASSERTS THE THING IS **BUILT**, so it goes red when it
     REGRESSES (v4.02). The `stated` probe this replaces asserted the three
     readers were missing and went red the moment v4.63 built them — which
     is the whole point of the two directions.

     THE WHOLE SENTENCE READS, AS A GATE AND AN OP. */
  assert.deepEqual(PR.classifyClause("if this has no steam counters, put a steam counter on it"),
    {status: "run", ops: [["ctrSrc", {kind: "steam", n: 1, label: "steam"}]], cond: "noCtr:steam"});
  /* AND THE PRONOUN ALONE STILL REFUSES — the pool prints "on it" meaning
     three OTHER objects (Crow's Nest's arrow, a created token, a sharpened
     sword), so a bare reading would guess. `on this` has no claimant and
     no reader, which is v4.52's rule about unclaimed vocabulary. */
  for(const t of ["put a steam counter on this", "put a steam counter on it"])
    assert.equal(PR.classifyClause(t), null, "`" + t + "` must not be read without its gate");
  const pw = PR.parseHeroPower(
    "Action - {r}{r}: If this has no steam counters, put a steam counter on it. Go again", true);
  assert.ok(pw && pw.cost === 2 && pw.ga === true && pw.kind === "action",
    "parseHeroPower answers the printed line: cost 2, go again, action speed");

  /* IT IS STILL ONE CARD — the measurement the named shape rests on. */
  const steam = pool().filter(c => { const wc = PR.weaponCost(c.tx || "");
    return !!(wc && wc.needSteam); }).map(c => c.name).sort();
  assert.deepEqual(steam, ["Plasma Barrel Shot"], "the set of `needSteam` records moved");

  /* THE CARD REPORTS FINISHED, and the powCard is the ordinary builder's —
     no hand-written text and no stamp for anything to read instead. */
  PR.fxReset();
  const card = one("Plasma Barrel Shot");
  assert.equal(PR.fxParse(card).tier, "full", "the card reads in full");
  const gr = {...card, uid: 41}; BL.equipPiece(gr);
  assert.ok(gr.powCard, "the piece has its ability");
  assert.equal(gr.powCard._buildSteam, undefined, "no hand-written stamp");
  assert.equal(gr.powCard.tx, "If this has no steam counters, put a steam counter on it. Go again",
    "the powCard carries the PRINTED line, cost prefix stripped");

  /* DRIVEN, BOTH HALVES OF THE GATE, through the real reducer. */
  H.db(); PR.fxReset();
  const g0 = {...H.state({res: 20, ap: 9, gear: [gr], counters: {}}, {},
                         {turn: 3, actor: 0, turnPlayer: 0}),
              stack: [], chain: [], boostChain: 0,
              phase: "action", step: "layer", priority: 0, passed: []};
  let out = J.reduce(g0, {t: "activate", uid: "gp41"}, 0);
  assert.ok(!out.error, "the first activation is legal: " + out.error);
  assert.equal(((out.state.sides[0].counters || {})[41] || {}).steam, 1,
    "and it puts the counter on the GUN, keyed by the piece's uid");
  const again = {...out.state,
    sides: out.state.sides.map((s, i) => i === 0 ? {...s, weaponUsed: {}, ap: 9} : s)};
  out = J.reduce(again, {t: "activate", uid: "gp41"}, 0);
  assert.ok(out.error && /already carries a steam counter/.test(out.error),
    "a second is refused BEFORE it is paid, off the same parse");
});

probe("charged-this-way-count", () => {
  /* A `closed` PROBE ASSERTS THE THING IS **BUILT**, so it goes red when it
     REGRESSES (v4.02) — the probe this replaces asserted the deviation and
     went red the moment v4.56 landed, which is the whole point of the two
     directions. The POSITIVE CONTROL is still the eight records v4.48 read:
     a reader that claimed everything would satisfy the line below perfectly
     (v3.98: ask for both halves). */
  const rows = [];
  for(const c of pool()){
    if(!(c.tx && /\+\d+\{[pd]\} for each /i.test(c.tx))) continue;
    PR.fxReset();
    const fx = PR.fxParse(c);
    const read = (fx.ops || []).some(o => Object.values(PR.PER_COUNT["{p}"]).includes(o[0])
                                       || (o[0] === "atkBuff" && !!o[4]))
              || !!(fx.defSelf && fx.defSelf.per);
    rows.push({name: c.name + "|" + c.pitch, read, tier: fx.tier});
  }
  assert.equal(rows.length, 9, "the number of pool records printing FOR-EACH moved");
  assert.deepEqual(rows.filter(r => !r.read).map(r => r.name), [],
    "every for-each record is read since v4.56 — one arriving here is a regression");

  /* THE WINDOW POSITION WAS THE HALF THIS RECORD GOT WRONG, so it is the
     half driven hardest: the standing grant has read since v3.87 and the
     database simply prints its window in the other position. */
  PR.fxReset();
  const vov = PR.fxParse(pool().find(c => c.name === "V of the Vanguard"));
  assert.equal(vov.tier, "full", "the card reads in full");
  assert.deepEqual((vov.ops || []).find(o => o[0] === "atkBuff"),
    ["atkBuff", 1, null, "chain", "perChargedLight"],
    "one printed pip, the printed window, and the countable");
  assert.ok(!vov.self, "and no flat pump is granted in its place");

  /* AND THE COUNT HALF WAS REAL. `multi` has a reader now, the offer carries
     it, and the offer SHRINKS as cards are chosen — which cannot be derived
     from the hand, because a charge is settled in `execute` long after the
     last answer. */
  const multi = pool().filter(c => { PR.fxReset();
    const cc = PR.fxParse(c).chargeCost; return !!(cc && cc.multi); })
    .map(c => c.name + "|" + c.pitch).sort();
  assert.deepEqual(multi, ["V of the Vanguard|2"],
    "the set of records whose charge cost reads `multi` moved — V of the "
    + "Vanguard is the only one");
  PR.fxReset();
  const vovC = pool().find(c => c.name === "V of the Vanguard");
  const mk = (uid, nm, pitch, ty) => ({uid, name: nm, pitch, tt: "Generic Action",
                                       ty: ty || ["Generic", "Action"], tx: ""});
  const hand = [{...vovC, uid: "src"}, mk("a1", "A", 2), mk("a2", "B", 1)];
  const off = PR.chargeOffer({...vovC, uid: "src"}, {hand}, "src");
  assert.deepEqual(Object.keys(off || {}).sort(), ["multi", "uids"],
    "the offer carries the count");
  assert.equal(off.multi, true, "and reads it as a repeated charge");
  assert.deepEqual(PR.chargeOffer({...vovC, uid: "src"}, {hand}, "src", ["a1"]).uids, ["a2"],
    "a card already chosen is off the next offer");
  /* AND THE COUNTABLE IS DRIVEN off the trace, with a non-Light card
     charged alongside as the row that separates a class test from a count. */
  assert.equal(E.powPer({_chgWay: [mk(1, "L", 2, ["Light", "Action"]),
                                   mk(2, "G", 1, ["Generic", "Action"])]},
    "perChargedLight"), 1, "only the Light card counts");
});

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

/* EVERY pool DECK card reads something. The probe is turned round. */
probe("pool-deck-complete", () => {
  /* THE HISTORY IS KEPT BECAUSE EACH DEPARTURE TAUGHT THE SAME LESSON.
     -Danger Digits AT v4.38, -Banneret of Salvation AT v4.41,
     -Hope Merchant's Hood AT v4.43: each time this drill went RED the
     moment the card was built, which is what an `open` record is FOR
     (v4.02), and each time it corrected the record's own stated REASON,
     because a recorded reason is only as good as the day it was measured
     (v3.69). Banneret's blocker was the TRIGGER and the DELAY, not the
     payload; the Hood's was one sentence in the parser and not "machinery
     prompts.js does not have".

     -GLISTEN AT v4.44, and it is the ONE whose blocker was named
     correctly: an ALLOCATOR, a prompt variant that APPORTIONS. So the
     record is CLOSED and this probe asserts the ABSENCE — a deck card
     arriving at `none` is a regression now, not a backlog item. */
  const want = [];
  /* A HERO IS NOT A DECK CARD AND NEITHER IS A TOKEN, and the pool holds
     all three (v3.21 keeps tokens by TYPE, v3.76 put Arakni's six Agents in
     the same way). The audit's headline "none" is over DECK cards; a flat
     census reports twelve and reads as twelve regressions that are in
     fact the pool being complete. So all three sets are pinned SEPARATELY
     — which is worth more than the one number, because it says where an
     arrival landed.

     AND THE OTHER TWO SETS ARE THIS DRILL'S POSITIVE CONTROL (v4.00,
     v3.98). An empty set is exactly what a census that stopped censusing
     returns, so a drill asserting only the empty half passes by finding
     nothing. Those two are non-empty and pinned by COUNT, so the walk is
     proved alive by the same pass that reports the deck set clean. */
  const kind = c => {
    const ty = (c.ty || []).join(" ") + " " + (c.tt || "");
    if(/\bDemi-Hero\b|\bHero\b/i.test(ty)) return "hero";
    if(/\bToken\b/i.test(ty))                return "token";
    return "deck";
  };
  const none = {deck:[], hero:[], token:[]};
  let seen = 0;
  for(const c of pool()){
    seen++;
    if(PR.fxParse(c).tier !== "none") continue;
    const k = kind(c);
    if(!none[k].includes(c.name)) none[k].push(c.name);
  }
  assert.ok(seen > 700,
    "only " + seen + " records were walked — an empty deck set off a census that " +
    "stopped censusing is the one way this drill passes by finding nothing");
  assert.deepEqual(none.deck.sort(), want.slice().sort(),
    "a DECK card reads NOTHING again. This set was emptied at v4.44 and a card " +
    "arriving in it is a regression — check whether a reader stopped matching");
  /* 9 -> 5 AT v4.09, AND FOUR OF THE FOUR THAT LEFT ARE AGENTS OF CHAOS.
     Five printed `Attack Reaction - Discard an Assassin card: …`, a cost
     `parseHeroPower` declined by design — so the transformation swapped
     Arakni's whole ability half for one nothing could read (v3.77's
     no-op blind spot wearing a hero's face). A discard from hand is the
     fifth NAMED cost now, and four of them read. The fifth, Orb-Weaver,
     still refuses on its PAYLOAD (a token equip), which is v2.29 working
     rather than a gap in that build. */
  /* 5 -> 4 AT v4.54, AND THE ONE THAT LEFT IS ENIGMA. Her clause 2 —
     "Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token
     WITH a +1{p} counter" — was the LAST unread hero clause in the pool,
     and the blocker was the PAYLOAD: the token matcher's tail had no
     ` with`, so the clause matched nothing, `parseHeroPower` refused the
     line and `build.js` built her no powCard at all (v3.47, seventh
     outing). The {c} cost read ZERO beside it, so reading the payload
     alone would have shipped a free Spectral Shield every turn. */
  assert.equal(none.hero.length, 4,
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
