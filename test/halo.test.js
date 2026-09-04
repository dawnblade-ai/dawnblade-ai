/* ============================================================
   A SOUL PUT, AND "IT" IS THE CARD THAT WAS PUT (v4.01)

   > **Instant** - {r}, destroy this: Put a card from your hand into your
   > soul. If it's **Light**, draw a card.
   > **Spellvoid 2**            — HALO OF ILLUMINATION

   IT HAD NO ROUTE AT ALL. `parseHeroPower` refuses a line whose payload
   has no reader, so `build.js` built the piece NO powCard and neither
   board could offer the ability — while `moveCards` has routed a pick to
   the `soul` since prompts.js was written (`soul` is a real side array
   and the fallback branch handles it). v3.47's shape, third outing:
   **reading the payload is what creates the route**, and the plumbing was
   already there.

   "IT" IS THE CARD THAT WAS PUT, never the equipment — v2.33's Bull's Eye
   Bracers, v3.47's Scuttle Toes and v3.92's banish riders, fourth time.
   So the rider cannot be an `fx.conds` entry, which `execute` answers
   about the RESOLVING card; it rides on the pick's spec and is asked in
   `applyAnswer`, where the chosen card is in hand.

   AND THE TWO SENTENCES ARE PAIRED IN `fxParse`, where the whole card is
   visible — the splitter breaks on the period, so a clause reader sees
   one at a time. Same place and reason `optCost` pairs its halves.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const PM = require("../engine/prompts.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

let _b = null;
function boltyn(){
  if(_b) return _b;
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "boltyn");
  _b = B.buildSide(h, G.parseDeck(W.DECKS.boltyn), H.db(), {}, RNG.make("halo"), {n: 0}).b;
  return _b;
}
const halo = () => boltyn().gear.find(g => g.name === "Halo of Illumination");

test("the ability now HAS a route — the powCard exists", {skip}, () => {
  const h = halo();
  assert.ok(h, "Boltyn's loadout takes the Halo");
  assert.ok(h.powCard, "…and `parseHeroPower` answers, so build.js builds the ability");
  assert.equal(h.powCard._instant, true, "it is printed Instant");
  /* THE WHOLE PRINTED LINE RIDES ON THE POWCARD (v2.34's `_effFull`), or
     the rider is orphaned — `parseHeroPower`'s own `eff` stops at the
     first period. */
  assert.match(h.powCard.tx, /If it's Light, draw a card/,
    "the rider must survive onto the powCard, or fxParse can never pair it");
});

test("the put and its rider are ONE spec", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse(halo().powCard);
  const put = fx.ops.find(o => o[0] === "pickPrompt");
  assert.ok(put, "the put is a pick");
  assert.equal(put[1].zone, "hand");
  assert.equal(put[1].to, "soul");
  assert.equal(put[1].min, 1, "the card does not say \"you may\" — the put is mandatory");
  assert.deepEqual(put[1].classRider, {cls: "light", ops: [["draw", 1]]});
  assert.equal(fx.tier, "full", "both sentences read");
});

/* THE CLASS IS READ OFF THE PRINTED WORD. Halo prints one, so no pool
   fixture can tell a read class from a hardcoded "light" (v3.32, and
   every outing since) — a synthetic naming a different one is what sees
   it. It carries a UNIQUE NAME because fxParse memoizes on name|pitch. */
test("the class is read, never assumed", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse({name: "Synthetic Soul Halo", pitch: 0, tt: "Equipment Ability",
    ty: [], tx: "Put a card from your hand into your soul. If it's Draconic, draw a card.",
    kw: [], cost: 1, power: null, def: null});
  const put = fx.ops.find(o => o[0] === "pickPrompt");
  assert.equal(put[1].classRider.cls, "draconic");
});

test("an unreadable rider refuses the RIDER and keeps the put", {skip}, () => {
  /* v2.29/v3.10: the head still lands, the card is weaker than printed
     rather than guessed at, and the clause stays `skip` so the audit says
     so — which is v3.41's whole correction to "the gap stays visible". */
  P.fxReset();
  const fx = P.fxParse({name: "Synthetic Unreadable Halo", pitch: 0, tt: "Equipment Ability",
    ty: [], tx: "Put a card from your hand into your soul. If it's Light, do the impossible.",
    kw: [], cost: 1, power: null, def: null});
  const put = fx.ops.find(o => o[0] === "pickPrompt");
  assert.ok(put, "the put still reads");
  assert.equal(put[1].classRider, undefined, "…and the rider does not");
  assert.equal(fx.clauses.find(c => /impossible/.test(c.t)).st, "skip",
    "the unread clause reports unread");
});

test("`buildPrompt` carries the rider (v2.34's rule, fifth field)", {skip}, () => {
  const light = {name: "Light Card", uid: "l1", pitch: 1, tt: "Light Action",
                 ty: ["Light", "Action"], tx: "", kw: []};
  const sheet = PM.buildPrompt({sides: [H.side({name: "A", hand: [light]}, 0),
                                        H.side({name: "B"}, 1)]},
    {tag: "pick", src: "Halo", zone: "hand", to: "soul", min: 1, max: 1,
     classRider: {cls: "light", ops: [["draw", 1]]}});
  assert.ok(sheet, "a hand with a card opens the sheet");
  assert.deepEqual(sheet.classRider, {cls: "light", ops: [["draw", 1]]},
    "dropped here it vanishes silently and the sheet asks a question with " +
    "no consequence — the exact shape v2.34 named");
});

/* ------------------------------------------------------------------
   DRIVEN, BOTH BRANCHES — a gate that refuses everything passes the
   negative half perfectly (v3.45: both halves, or it proves nothing)
   ------------------------------------------------------------------ */

function answer(cls){
  const card = {name: cls === "light" ? "Light Card" : "Plain Card", uid: "c1", pitch: 1,
    tt: cls === "light" ? "Light Action" : "Generic Action",
    ty: cls === "light" ? ["Light", "Action"] : ["Generic", "Action"], tx: "", kw: [], gkw: []};
  const deckTop = {name: "Drawn", uid: "d1", pitch: 1, tt: "Generic Action",
                   ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
  let g = H.state({name: "Boltyn", res: 9, ap: 1, hand: [card], deck: [deckTop], soul: []},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [{}, {}]});
  g = unwrap(H.fx(g, (fx, s) => fx.runOps(s,
    [["pickPrompt", {zone: "hand", to: "soul", min: 1, max: 1,
                     classRider: {cls: "light", ops: [["draw", 1]]}}]], "Halo of Illumination")));
  g = H.J.openPrompt(g);
  assert.ok(g.prompt, "the sheet opened");
  g = H.J.reduce(g, {t: "promptSel", i: 0}, 0).state;
  g = H.J.reduce(g, {t: "promptConfirm"}, 0).state;
  return g;
}

test("driven: a Light card goes to the soul AND draws", {skip}, () => {
  const g = answer("light");
  assert.deepEqual(g.sides[0].soul.map(c => c.name), ["Light Card"],
    "the chosen card is in the soul");
  assert.equal(g.sides[0].hand.length, 1, "…and the rider drew one back");
  assert.equal(g.sides[0].hand[0].name, "Drawn");
  assert.match(said(g), /is light — the rider fires/i);
});

test("driven: a non-Light card goes to the soul and draws NOTHING", {skip}, () => {
  const g = answer("plain");
  assert.deepEqual(g.sides[0].soul.map(c => c.name), ["Plain Card"],
    "the put is unconditional — only the DRAW is gated");
  assert.equal(g.sides[0].hand.length, 0, "no card drawn");
  assert.equal(g.sides[0].deck.length, 1, "…and the deck is untouched");
  assert.match(said(g), /is not light — no rider/i);
});

test("driven: an empty hand puts nothing and draws nothing", {skip}, () => {
  /* A REWARD FOR A COST THAT WAS NOT PAID IS v2.04's BUG. `buildPrompt`
     returns null on an empty hand, so the sheet politely skips itself —
     which is the difference between "mandatory" and "impossible". */
  const deckTop = {name: "Drawn", uid: "d1", pitch: 1, tt: "Generic Action",
                   ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
  let g = H.state({name: "Boltyn", res: 9, ap: 1, hand: [], deck: [deckTop], soul: []},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [{}, {}]});
  g = unwrap(H.fx(g, (fx, s) => fx.runOps(s,
    [["pickPrompt", {zone: "hand", to: "soul", min: 1, max: 1,
                     classRider: {cls: "light", ops: [["draw", 1]]}}]], "Halo of Illumination")));
  g = H.J.openPrompt(g);
  /* THE PROPERTY IS "NO SHEET", not a particular spelling of absent —
     `openPrompt` leaves the key unset rather than nulling it, and pinning
     `null` tests the representation instead of the rule (v3.85's mirror
     image: there the drill had to stop accepting a null as undefined). */
  assert.ok(!g.prompt, "no sheet with nothing to put");
  assert.equal(g.sides[0].deck.length, 1, "and no draw");
  assert.equal(g.sides[0].soul.length, 0);
});

test("the class test is `promptFilter`'s, so one reader answers both", {skip}, () => {
  /* THE STRUCTURED ARRAY IS THE AUTHORITY (v2.39) — `tt` and `ty` disagree
     on five database records, and a rider reading the display string
     would call a card a class its own `ty` denies. */
  const f = PM.promptFilter({ty: "light"});
  assert.equal(f({name: "A", tt: "Light Action", ty: ["Light", "Action"]}), true);
  assert.equal(f({name: "B", tt: "Light Action", ty: ["Generic", "Action"]}), false,
    "the ARRAY decides, not the printed line");
});

test("driven: a DECLINED optional put fires no rider", {skip}, () => {
  /* THE GUARD IS `(r.picked||[]).length`, AND IT IS REACHABLE. Halo's own
     put is `min:1`, so its sheet can never be declined — but `runOps` is
     fed by `reduce`, which is fed by JSON off a wire (v2.48), and the
     next card printing "you MAY put a card … if you do" is a `min:0`
     spec through the same body. Paying nothing and collecting the payload
     is the free-ability bug v2.04 fixed, and there is a drill named for
     it one module over.

     THE FIRST VERSION OF THIS DRILL USED AN EMPTY HAND, which opens no
     sheet at all — so `applyAnswer` was never reached and deleting the
     guard was SILENT. A sabotage that cannot express the bug proves
     nothing (v3.62). */
  const light = {name: "Light Card", uid: "c1", pitch: 1, tt: "Light Action",
                 ty: ["Light", "Action"], tx: "", kw: [], gkw: []};
  const deckTop = {name: "Drawn", uid: "d1", pitch: 1, tt: "Generic Action",
                   ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
  let g = H.state({name: "Boltyn", res: 9, ap: 1, hand: [light], deck: [deckTop], soul: []},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [{}, {}]});
  g = unwrap(H.fx(g, (fx, s) => fx.runOps(s,
    [["pickPrompt", {zone: "hand", to: "soul", min: 0, max: 1,
                     classRider: {cls: "light", ops: [["draw", 1]]}}]], "Synthetic Optional Put")));
  g = H.J.openPrompt(g);
  assert.ok(g.prompt, "an optional sheet opens");
  g = H.J.reduce(g, {t: "promptDecline"}, 0).state;
  assert.equal(g.sides[0].soul.length, 0, "declined — nothing moved");
  assert.equal(g.sides[0].hand.length, 1, "…and nothing was drawn");
  assert.equal(g.sides[0].deck.length, 1);
});

test("driven: the rider reads the STRUCTURED ARRAY, not the type line", {skip}, () => {
  /* THE DATABASE'S TWO TYPE FIELDS DISAGREE ON FIVE RECORDS (v2.39), and
     the array is the authority — RULING (user, 2026-08-02). A fixture
     whose `tt` and `ty` AGREE cannot tell the two readers apart, which is
     why deleting `promptFilter` here was silent the first time. This card
     PRINTS "Light" in its type line and its array denies it. */
  const liar = {name: "Type Line Liar", uid: "c1", pitch: 1,
                tt: "Light Action", ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
  const deckTop = {name: "Drawn", uid: "d1", pitch: 1, tt: "Generic Action",
                   ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
  let g = H.state({name: "Boltyn", res: 9, ap: 1, hand: [liar], deck: [deckTop], soul: []},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [{}, {}]});
  g = unwrap(H.fx(g, (fx, s) => fx.runOps(s,
    [["pickPrompt", {zone: "hand", to: "soul", min: 1, max: 1,
                     classRider: {cls: "light", ops: [["draw", 1]]}}]], "Halo of Illumination")));
  g = H.J.openPrompt(g);
  g = H.J.reduce(g, {t: "promptSel", i: 0}, 0).state;
  g = H.J.reduce(g, {t: "promptConfirm"}, 0).state;
  assert.equal(g.sides[0].soul.length, 1, "it still goes to the soul");
  assert.equal(g.sides[0].hand.length, 0,
    "…and draws NOTHING: the array says Generic, whatever the printed line claims");
});

test("the CARD credits the rider only because the route exists", {skip}, () => {
  /* On the card's own parse the put lives INSIDE the activation line,
     which `classifyClause` files `noop` — so without this the rider's
     clause reports unread on a card whose ability is fully built. That is
     v3.21's one-sided ledger, and under-reporting is the safe direction
     only while somebody is looking.

     ASSERT ON THE CLAUSE STATUS, not the tier (v3.63): a tier is
     determined by several other facts, and a drill written against it can
     be silent under sabotage. */
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const c = arr.find(x => x.name === "Halo of Illumination");
  P.fxReset();
  const fx = P.fxParse({name: c.name, pitch: 0, tt: c.type_text, ty: c.types,
    tx: c.functional_text, kw: c.card_keywords, cost: c.cost, power: c.power, def: c.defense});
  const rider = fx.clauses.find(x => /Light, draw a card/.test(x.t));
  assert.ok(rider, "the rider is its own clause on the card");
  assert.equal(rider.st, "run", "…and it is credited, because the powCard carries it");

  /* THE CREDIT IS CONDITIONAL. A card printing the same rider with an
     ability `parseHeroPower` REFUSES has no powCard, so nothing reads the
     rider — crediting it would be the no-op blind spot arriving through
     the credit rather than through a `noop`. */
  P.fxReset();
  const dead = P.fxParse({name: "Synthetic Unroutable Halo", pitch: 0,
    tt: "Light Equipment - Head", ty: ["Light", "Equipment", "Head"],
    tx: "**Action** - Discard your hand: Put a card from your hand into your soul. " +
        "If it's Light, draw a card.", kw: [], cost: null, power: null, def: null});
  const dr = dead.clauses.find(x => /Light, draw a card/.test(x.t));
  assert.ok(dr, "the rider is still its own clause");
  assert.equal(dr.st, "skip",
    "…and it reports UNREAD, because `parseHeroPower` refuses that cost and " +
    "build.js therefore builds no powCard for anything to re-read");
});
