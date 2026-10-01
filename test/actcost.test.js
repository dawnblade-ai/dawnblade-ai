/* ============================================================
   AN ACTIVATION'S COST IS READ THREE TIMES (v3.80)

   `effCost` is asked three separate questions on one activation:

     judge.legal       could this seat RAISE it?  (pool + what it can pitch)
     judge.doActivate  must a PAYMENT open?       (pool alone)
     effects.execute   CHARGE it.

   Only the third used the effective number. The other two read the
   PRINTED cost, and the two are different the moment anything modifies
   one — Frostbite taxes +1, a runechant discounts, `costOff` and
   `boardRed` both move it.

   DRIVEN: Briar activating Scorpio, Comet Tail (printed `{t}`, so cost 0)
   under a Frostbite. `legal` said yes against 0, no payment opened
   because 0 > 0 is false, and `execute` charged 1 into a seat holding 0.
   **`res: -1`** — `NEGATIVE-RES`, CR 4.4.3e: points are lost, never owed.
   It is also the `legal`/`reduce` agreement `fuzz.test.js` exists to hold.

   v2.80 FOUND THIS EXACT DEFECT ON THE PLAY ROUTE and left it wrong on
   all three activation routes. Its own words: "`effCost` is READ TWICE
   and the reads are different questions."

   IT NEEDED THE POLICY FIX TO BECOME REACHABLE. Frostbite arrives on a
   NON-ATTACK, and until v3.80 `sparring.act` could not play one — so no
   self-play game had ever put a Frostbite on a board holding a {t}
   weapon. A guard rail is only as good as the states that reach it.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const J = require("../engine/judge.js");
const PR = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const _b = {};
function build(k){
  if(_b[k]) return _b[k];
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  _b[k] = B.buildSide(h, G.parseDeck(W.DECKS[k]), H.db(), {}, RNG.make("actcost"), {n: 0}).b;
  return _b[k];
}

/* A Frostbite token on the acting side's own board — it taxes the NEXT
   card or activation that seat pays for. */
function frostbite(uid){
  const rec = H.db().byName && H.db().byName["frostbite"];
  return {uid, kind: "aura", card: H.card("Frostbite", 0), spent: false};
}

/* A REAL MATCH, driven through `judge.reduce` — `H.state` builds an
   effects-shaped state and carries no CR machine at all, so a drill about
   `legal` and `doActivate` has to open a real game. Seat 0 is Boltyn,
   whose gear holds Raydn, Duskbane — a cost-0 swing.

   IT WAS BRIAR AND SCORPIO UNTIL v4.89, and that fixture was valid only
   while the table never asked a swing's printed gate: Scorpio prints
   "Activate this only if you control a Lightning attack", which judge now
   asks and refuses (unread, `scorpio-lightning-attack`). Raydn carries the
   same property — a printed cost of 0 that a Frostbite makes 1 — with no
   gate in front of it. */
function table(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make("actcost");
  const h0 = W.HEROES.find(x => x.k === "boltyn"), h1 = W.HEROES.find(x => x.k === "kayo");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.boltyn), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.kayo), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sc = (g.sides[0].gear || []).find(x => /Raydn/.test(x.name));
  const sides = g.sides.slice();
  sides[0] = Object.assign({}, sides[0], {
    res: 0,
    hand: o.hand === "empty" ? [] : sides[0].hand,
    board: o.iced ? [{uid: 990, kind: "aura", card: H.card("Frostbite", 0), spent: false}] : []
  });
  return {g: Object.assign({}, g, {sides}), uid: sc && sc.uid, sc};
}

test("the tax is real — effCost moves and the printed cost does not", {skip}, () => {
  /* THE PREMISE. Without this the two drills below could both pass on an
     engine where nothing taxes anything. */
  const b = build("boltyn");
  const sc = b.gear.find(g => /Raydn/.test(g.name));
  assert.ok(sc, "Boltyn carries Raydn, Duskbane");
  assert.equal(sc.cost, 0, "its printed activation cost is 0 — no resources");
  assert.equal(PR.fxParse(sc).activateIf, undefined, "and no printed gate stands in front of it");
  const bare = {res: 0, board: [], counters: {}, hand: []};
  const iced = {res: 0, board: [frostbite(990)], counters: {}, hand: []};
  assert.equal(PR.effCost(sc, bare), 0);
  assert.equal(PR.effCost(sc, iced), 1, "a Frostbite taxes it by one");
});

test("with NO way to raise it, the activation is refused outright", {skip}, () => {
  /* `legal` ASKS WHETHER THE SEAT COULD RAISE IT — the pool plus what the
     hand can pitch. An empty hand raises nothing, so a taxed swing the
     seat cannot fund is not a legal activation at all, and the refusal
     must name the EFFECTIVE cost rather than the printed 0. */
  const t = table({iced: true, hand: "empty"});
  const why = J.legal(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(why != null, "it must be refused");
  assert.match(String(why), /costs 1/,
    "the refusal must name the effective cost, not the printed 0 — got: " + why);
});

test("with a card to pitch, a PAYMENT opens rather than a silent charge", {skip}, () => {
  /* THE OTHER HALF. `legal` says the seat can raise it, so `doActivate`
     must ask — and it decided off the PRINTED cost, so `0 > 0` was false,
     nothing opened, and `execute` charged 1 into a seat holding 0. */
  const t = table({iced: true});
  assert.ok(t.g.sides[0].hand.length > 0, "the fixture needs a hand to pitch from");
  assert.equal(J.legal(t.g, {t: "activate", uid: t.uid}, 0), null,
    "it is legal — the hand can cover it");
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(!out.error, String(out.error));
  assert.ok(out.state.pending, "a payment must open");
  assert.equal(out.state.pending.kind, "pay");
  assert.equal(out.state.pending.need, 1, "…and it must ask for the EFFECTIVE cost");
  assert.ok(out.state.sides[0].res >= 0, "and nothing is charged yet");
});

test("an UNTAXED swing still needs no payment — the fix moved nothing else", {skip}, () => {
  /* THE CONTROL. Reading `effCost` everywhere would look identical to
     this fix if every fixture carried a tax. */
  const t = table({iced: false});
  assert.equal(J.legal(t.g, {t: "activate", uid: t.uid}, 0), null);
  const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
  assert.ok(!out.error, String(out.error));
  assert.ok(!out.state.pending, "no tax, no payment");
  assert.ok(out.state.sides[0].res >= 0);
});

test("DRIVEN: a taxed swing never leaves the seat owing resources", {skip}, () => {
  /* THE BUG, AS THE STATE SEES IT. CR 4.4.3e — points are lost, never
     owed — which `invariants` reports as NEGATIVE-RES at error severity. */
  const INV = require("../engine/invariants.js");
  for(const iced of [true, false]){
    const t = table({iced});
    const out = J.reduce(t.g, {t: "activate", uid: t.uid}, 0);
    if(out.error) continue;
    assert.deepEqual(INV.errors(out.state).filter(v => v.code === "NEGATIVE-RES"), [],
      "no seat may owe resources (iced: " + iced + ")");
  }
});

test("all three activation branches ask effCost, and the ALLY one does not", {skip}, () => {
  /* THE ALLY BRANCH STAYS PRINTED, deliberately: `execute` charges
     `allyAttack(card).cost` there rather than `effCost` (v3.44 — an
     ally's `.cost` is its PLAY cost, already spent deploying it), so
     asking `effCost` would disagree with the charge in the other
     direction. Each read asks what its own charge site asks. */
  const src = fs.readFileSync(__dirname + "/../engine/judge.js", "utf8");
  const doAct = src.slice(src.indexOf("function doActivate"));
  const body = doAct.slice(0, doAct.indexOf("\nfunction "));
  /* THE HERO BRANCH GAINED A THIRD ARGUMENT AT v3.86 — the Draconic chain
     link count, which is game state rather than a fact about the side, so
     `effCost` takes it from the caller. It is still the ONE cost reader:
     the dynamic half went inside it rather than becoming a fourth site
     subtracting after the fact.

     AND AT v3.96 THAT ARGUMENT CAME FROM ONE READER. It was built inline
     at two sites and omitted at the other three, so a SECOND game-level
     input — Stains of the Redback's discount against a marked defending
     hero — would have had to be threaded by hand at every one of them,
     which is v3.80's bug waiting to happen again. `parser.costCtx` is
     that reader, and every branch here asks it. */
  /* RE-ANCHORED AT v4.85, the property unchanged: the discard-cost question
     (`askDiscCost`) now sits between each branch's `ab` and its cost read,
     so the equipment branch's one-line `piece.powCard, acost = …` became
     two statements. Each branch is found off its own `ab` binding. */
  assert.match(body, /HPOW;[\s\S]{0,120}const acost = effCost\(ab, sd, PR\.costCtx\(g, seat\)\)/, "the hero branch");
  assert.match(body, /const ab = piece\.powCard;[\s\S]{0,120}const acost = effCost\(ab, sd, PR\.costCtx\(g, seat\)\)/,
    "the equipment-ability branch");
  assert.match(body, /const cost = effCost\(piece, sd, PR\.costCtx\(g, seat\)\);/, "the weapon branch");
  /* THE ALLY BRANCH PRICES THE ATTACK'S OWN LINE, WITH ITS TAXES (v4.86).
     It never read `effCost` and still does not; what changed is that the
     taxes an activated ability owes are added by `boardAtkCost`, the one
     reader `legal`, `doActivate` and the policy's view all ask. */
  assert.match(body, /const _abc = boardAtkCost\(g, seat, b\.card, aa, route\);/,
    "and the ally branch keeps the printed ability cost, taxed through the one reader");
  assert.match(src, /function boardAtkCost\(g, seat, card, aa, route\)\{\n  return \(\(aa && aa\.cost\) \|\| 0\) \+ PR\.costTaxes\(card, at\(g, seat\), PR\.costCtx\(g, seat\), route\);/,
    "the board attack's cost is its printed line plus `costTaxes` — never `effCost`, which reads the PLAY cost");
  assert.doesNotMatch(body, /effCost\(b\.card/, "…never effCost");
  /* NO SITE MAY BUILD THE OPTS BY HAND. A second inline literal is the
     no-mirror rule broken inside one file, and it is how these three
     branches came to disagree in the first place. */
  const whole = fs.readFileSync(__dirname + "/../engine/judge.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(whole, /effCost\([^)]*\{\s*dracLinks/,
    "the game's half of a cost comes from `costCtx`, never from a literal");
  /* and EVERY `effCost` in the file asks it — the ally branch is the one
     deliberate exception and it does not call `effCost` at all */
  const calls = whole.match(/effCost\([^;]*?\)/g) || [];
  for(const call of calls)
    assert.match(call, /PR\.costCtx\(g, seat\)/, "unthreaded cost read: " + call);
});
