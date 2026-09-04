/* ============================================================
   THE FIRST GRAVEYARD PLAY OF A KEYWORD EACH TURN (v4.01)

   > **Instant** - {t}: Look at the top card of your deck.
   > The first card with **watery grave** you play from your graveyard
   > each turn gets **go again**.   — COMPASS OF SUNKEN DEPTHS

   v3.85's shape one card over, and the pool's ONLY unbuilt member:
   measured, three records print "the first … each turn" and the other two
   are Briar's and Dorinthea's HERO passives, both built. This one is on
   EQUIPMENT, so it had no reader at all and the clause read `skip`.

   IT IS ALL SIX OF GRAVY BONES' ALLIES. Every record in the pool carrying
   watery grave is one of his, and replaying them out of the graveyard is
   his whole engine — so the grant is an ACTION POINT on the play he makes
   most.

   READ BEFORE THE ATTACK/NON-ATTACK SPLIT, and that is the whole of why
   it works: his allies are NON-ATTACKS, so a grant read where `gaNext` is
   taken — inside the attacking branch — would fire for none of the cards
   it exists for. v3.53's lesson (a queue site in the wrong branch) stated
   about a grant.

   THE KEYWORD IS READ OFF THE PRINTED LINE (v3.21) and the vocabulary is
   CLOSED (v3.55): a grant keyed on a keyword nothing carries is a card
   filed `full` that does nothing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const S = require("../engine/sides.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";
const unwrap = o => (o && o.game) || o;
const said = g => g.feed.map(f => (typeof f === "string" ? f : (f && f.t) || "")).join(" | ");

const COMPASS = "**Instant** - {t}: Look at the top card of your deck.\n\n" +
  "The first card with **watery grave** you play from your graveyard each turn gets **go again**.";

let _b = null;
function gravy(){
  if(_b) return _b;
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "gravy");
  _b = B.buildSide(h, G.parseDeck(W.DECKS.gravy), H.db(), {}, RNG.make("compass"), {n: 0}).b;
  return _b;
}

test("the clause is READ, and the keyword comes off the printed line", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse({name: "Compass probe", pitch: 0, tt: "Pirate Necromancer Equipment - Off-Hand",
    ty: ["Pirate", "Necromancer", "Equipment", "Off-Hand"], tx: COMPASS, kw: [],
    cost: null, power: null, def: null});
  assert.equal(fx.gyFirstGa, "watery grave");
  assert.equal(fx.tier, "full", "the card was `part` with this clause unread");
});

/* THE KEYWORD IS NOT HARDCODED, and no pool fixture can say so — Compass
   is the only record of the shape and it prints one keyword. A synthetic
   naming a DIFFERENT one is what sees it (v3.32, and every outing since). */
test("a different keyword is read as that keyword", {skip}, () => {
  P.fxReset();
  const fx = P.fxParse({name: "Synthetic Compass", pitch: 0, tt: "Generic Equipment - Head",
    ty: ["Generic", "Equipment", "Head"],
    tx: "The first card with **crush** you play from your graveyard each turn gets **go again**.",
    kw: [], cost: null, power: null, def: null});
  assert.equal(fx.gyFirstGa, "crush");
});

/* THE VOCABULARY IS CLOSED. An unknown word refuses the whole clause
   rather than filing a grant nothing can ever satisfy — v3.55's rule
   about counter kinds, one mechanic over, and it is what keeps a DYNAMIC
   limit ("with cost 2 or less") from reading as a keyword and being
   silently dropped (v3.33's refusal, still standing). */
test("an unreadable qualifier refuses the clause", {skip}, () => {
  /* THE FIXTURE MUST REACH THE VOCABULARY TEST. The first draft used
     "with cost 2 or less", which contains a DIGIT — the outer pattern's
     `[a-z' ]+` never matched it, so the clause refused for a different
     reason entirely and opening the vocabulary was SILENT. v3.62: a
     sabotage that cannot express the bug proves nothing, and here the
     fault was the drill's.

     "an arcane damage effect" is a phrase the pool really prints (Absorb
     in Aether, Cindering Foresight, Crucible of Aetherweave), it is all
     letters and spaces, and it is not a keyword. */
  P.fxReset();
  const fx = P.fxParse({name: "Synthetic Effect Compass", pitch: 0, tt: "Generic Equipment - Head",
    ty: ["Generic", "Equipment", "Head"],
    tx: "The first card with an arcane damage effect you play from your graveyard each turn gets **go again**.",
    kw: [], cost: null, power: null, def: null});
  assert.equal(fx.gyFirstGa, undefined, "a printed phrase that is not a keyword is refused");
  assert.equal(fx.tier, "none", "…and the clause is refused rather than half-claimed");

  /* AND A DYNAMIC LIMIT IS REFUSED TOO — it never reaches the vocabulary,
     which is the older half of the same guard (v3.33). */
  P.fxReset();
  const dyn = P.fxParse({name: "Synthetic Dynamic Compass", pitch: 0, tt: "Generic Equipment - Head",
    ty: ["Generic", "Equipment", "Head"],
    tx: "The first card with cost 2 or less you play from your graveyard each turn gets **go again**.",
    kw: [], cost: null, power: null, def: null});
  assert.equal(dyn.gyFirstGa, undefined, "a dynamic limit is not a keyword");
});

/* AND THE WIDENING WAS MEASURED (v3.33's rule: measure a predicate
   change, do not reason about it). `watery grave` joined the closed
   `with <keyword>` vocabulary, which `optFilter`'s reveal branch also
   reads — so the question is what ELSE moved. */
test("the vocabulary widening moved exactly one record", {skip}, () => {
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : (pool.cards || Object.values(pool));
  const hits = [];
  for(const c of arr){
    const tx = (c.functional_text || "").replace(/\*\*/g, "");
    if(/\bwith watery grave\b/i.test(tx)) hits.push(c.name);
  }
  assert.deepEqual([...new Set(hits)].sort(), ["Compass of Sunken Depths", "Gravy Bones"],
    "two records print the phrase — this card's clause, and his hero line, " +
    "which is a PASSIVE rather than a cost and so reaches no filter");
  /* ONE READER FOR THE CLOSED LIST. v3.33 wrote it inline in optFilter and
     v4.01 asked the same question of a different clause; two spellings of
     one closed vocabulary is the drift this project names on every page. */
  const src = require("fs").readFileSync(__dirname + "/../engine/parser.js", "utf8");
  assert.equal((src.match(/crush\|stealth\|dominate\|go again/g) || []).length, 1,
    "the keyword vocabulary is spelled ONCE");
});

test("`gyFirstGaKw` scans the gear AND the arena", {skip}, () => {
  const piece = {name: "Compass of Sunken Depths", uid: "c1", pitch: 0,
    tt: "Pirate Necromancer Equipment - Off-Hand",
    ty: ["Pirate", "Necromancer", "Equipment", "Off-Hand"], tx: COMPASS, kw: []};
  assert.equal(P.gyFirstGaKw({gear: [piece], board: []}), "watery grave");
  /* THE WATCHER IS NOT THE CARD BEING PLAYED (v3.33, v3.55, v3.93). Compass
     is an Off-Hand, so a board-only scan finds nothing — and a gear-only
     scan would miss a future record printing the same static on a
     permanent. Both, for the same reason those three versions give. */
  assert.equal(P.gyFirstGaKw({gear: [], board: [{uid: "b1", kind: "item", card: piece}]}),
    "watery grave", "an arena permanent carrying it answers too");
  assert.equal(P.gyFirstGaKw({gear: [], board: []}), null);
  assert.equal(P.gyFirstGaKw({gear: [{...piece, destroyed: true}], board: []}), null,
    "a destroyed piece grants nothing");
});

/* ------------------------------------------------------------------
   DRIVEN — and the observable is the ACTION POINT (v3.58)
   ------------------------------------------------------------------ */

function play(o){
  o = o || {};
  const b = gravy();
  const compass = b.gear.find(g => g.name === "Compass of Sunken Depths");
  assert.ok(compass, "his loadout takes the Compass");
  const ally = Object.assign({}, H.card("Barnacle", 2), {uid: "al1"});
  const hist = Object.assign({}, S.freshHist(), o.hist || {});
  let g = H.state({name: "Gravy", res: 9, ap: 1, hist,
                   gear: o.noCompass ? [] : [compass],
                   grave: [ally], hand: []},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [b, {}]});
  const out = unwrap(H.execute(g, ally, o.from || "grave", 0, {}));
  return {game: out, ap: out.sides[0].ap, hist: out.sides[0].hist};
}

test("driven: the first watery-grave card out of the graveyard goes again", {skip}, () => {
  const first = play({});
  assert.equal(first.ap, 1,
    "CR 5.3.5 — go again is a GAIN, so the point the play spent comes back");
  assert.deepEqual(first.hist.gyFirstKw, ["watery grave"],
    "…and the turn records that the grant is spent");
  assert.match(said(first.game), /first watery grave card out of the graveyard/i);
});

test("driven: the SECOND does not — that is what \"first\" means", {skip}, () => {
  const second = play({hist: {gyFirstKw: ["watery grave"]}});
  assert.equal(second.ap, 0, "the grant is spent for the turn");
  assert.deepEqual(second.hist.gyFirstKw, ["watery grave"], "and is not recorded twice");
});

test("driven: no Compass, no grant", {skip}, () => {
  /* THE POSITIVE CONTROL'S TWIN. A drill that only ever asserts the grant
     lands passes against an engine that grants unconditionally (v3.45:
     both halves, or it proves nothing). */
  const none = play({noCompass: true});
  assert.equal(none.ap, 0);
  assert.deepEqual(none.hist.gyFirstKw, []);
});

test("driven: a play from HAND gets nothing", {skip}, () => {
  /* THE ZONE IS PRINTED — "from your graveyard" — and it is the half a
     loose reading drops. Barnacle played from hand is the same card in
     the same state; only the zone differs. */
  const b = gravy();
  const compass = b.gear.find(g => g.name === "Compass of Sunken Depths");
  const ally = Object.assign({}, H.card("Barnacle", 2), {uid: "al2"});
  let g = H.state({name: "Gravy", res: 9, ap: 1, gear: [compass], hand: [ally]},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [b, {}]});
  const out = unwrap(H.execute(g, ally, "hand", 0, {}));
  assert.equal(out.sides[0].ap, 0, "the graveyard is where the card must come from");
  assert.deepEqual(out.sides[0].hist.gyFirstKw, []);
});

test("driven: the keyword must be PRINTED, not mentioned", {skip}, () => {
  /* v2.84's three questions. `hasKw` answers TRUE for a card whose text
     merely names the keyword, and granting an ACTION POINT off a mention
     is the most valuable keyword in the game to get wrong. No pool card
     tells the two predicates apart here — all six watery-grave records
     carry it — so the discriminator is a synthetic near-miss (v3.73's
     Crash and Bash, one keyword over). */
  const b = gravy();
  const compass = b.gear.find(g => g.name === "Compass of Sunken Depths");
  const mention = {name: "Mentions Watery Grave", uid: "mn1", pitch: 2, cost: 0,
    tt: "Pirate Action", ty: ["Pirate", "Action"], kw: [], gkw: [],
    tx: "Your allies with watery grave get +1{p}."};
  let g = H.state({name: "Gravy", res: 9, ap: 1, gear: [compass], grave: [mention]},
                  {name: "Bob", hp: 20}, {turn: 3, turnPlayer: 0});
  g = Object.assign({}, g, {phase: "action", step: "layer", builds: [b, {}]});
  const out = unwrap(H.execute(g, mention, "grave", 0, {}));
  assert.equal(out.sides[0].ap, 0, "a mention is not a printing");
  assert.deepEqual(out.sides[0].hist.gyFirstKw, [],
    "…and nothing is spent, so the real card can still take it");
});

test("\"each turn\" needs no bookkeeping beyond `hist`", {skip}, () => {
  /* CR 4.4.4 clears `hist` at the turn boundary, which is the whole of the
     window (v3.85). A drill that only played twice in one turn cannot say
     that — it would pass with a permanent side flag. */
  assert.deepEqual(S.freshHist().gyFirstKw, [],
    "a fresh turn starts with the grant unspent");
  const S2 = require("../engine/sides.js");
  assert.ok("gyFirstKw" in S2.freshHist(),
    "the field is DECLARED, so both seats carry it and the wire ships it " +
    "with the rest of `hist` (v2.18: a field one seat lacks is asymmetric)");
});
