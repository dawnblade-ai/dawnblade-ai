/* ============================================================
   AZALEA'S ARSENAL CYCLE (v3.71)

   "Once per Turn Action - 0: Put a card from your arsenal on the bottom
    of your deck. If you do, put the top card of your deck face-up into
    your arsenal. If it's an arrow, it gets dominate until end of turn.
    Go again"

   READ THE HERO ABILITY BEFORE THE CARDS (v2.55, Kayo). Her deck was 28
   of 32 `full` and her hero did NOTHING AT ALL: `parseHeroPower` refused
   the line, so `build.js` built her no powCard and neither board could
   offer it. What that ability is, is the ENGINE of the deck — Swift Shot,
   Dry Powder Shot and Entangling Shot each print "when this is put
   face-up into your arsenal", and Crow's Nest watches for an arrow put
   face-up FROM YOUR DECK, which nothing in the pool could do.

   THE THREE SENTENCES ARE ONE MECHANISM, and two of them reach across the
   clause split: "if you DO" names the first sentence's put, "IT" names the
   card the second one moved. So the reader is a WHOLE-CARD one in
   `fxParse` — the place `optCost` pairs its halves and Sharpen folds its
   wipe — and the op is one op rather than three.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const G = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const H = require("./helpers/judged.js");
const J = require("../engine/judge.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const AZ = "Once per Turn Action - 0: Put a card from your arsenal on the bottom of "
         + "your deck. If you do, put the top card of your deck face-up into your "
         + "arsenal. If it's an arrow, it gets dominate until end of turn. Go again";

/* Her real build, so the drills measure the powCard a player is handed
   rather than one the drill wrote. */
let _b = null;
function build(){
  if(_b) return _b;
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "azalea");
  _b = B.buildSide(h, G.parseDeck(W.DECKS.azalea), H.db(), {}, RNG.make("arscycle"), {n: 0}).b;
  return _b;
}

/* ---- 1. THE ROUTE ---------------------------------------------------- */

test("parseHeroPower answers Azalea's line — without it she has no powCard", () => {
  /* The refusal was CORRECT until the payload had a reader (v3.47): a
     powCard whose effect nothing can run is a tap that does nothing. What
     changed is the reader, so the route follows. */
  const hp = P.parseHeroPower(AZ);
  assert.ok(hp, "parseHeroPower must answer, or build.js builds no HPOW at all");
  assert.equal(hp.kind, "action");
  assert.equal(hp.cost, 0);
});

test("…and it is still narrow: an unrelated conditional ability is refused", () => {
  /* v2.34's rule. The guard accepts exactly two named shapes — the arsenal
     PUT and now the arsenal CYCLE — because a broad relaxation would raise
     the tier of cards nothing wires. A drill that only proves the new shape
     passes would pass just as well against a guard deleted outright. */
  assert.equal(P.parseHeroPower(
    "Action - {r}: If you control an aura, draw two cards and gain 3 life"), null);
  assert.equal(P.parseHeroPower(
    "Action - 0: Put a card from your hand on the bottom of your deck"), null);
});

test("the anchor cannot claim Iyslander's arsenal line", {skip}, () => {
  /* Two pool records print "from your arsenal" and the other one is
     Iyslander's "you may play blue non-attack action cards FROM YOUR
     ARSENAL as though they were instants". An unanchored pattern would
     claim it — so the whole sentence is matched, not a phrase inside it. */
  const iy = P.fxParse(Object.assign({}, H.card("Frost Spike", 1),
    {name: "IYS-PROBE", tx: "If it's not your turn, you may play blue non-attack "
      + "action cards from your arsenal as though they were instants."}));
  assert.equal(iy.ops.filter(o => o[0] === "arsCycle").length, 0);
});

/* ---- 2. WHAT THE POWCARD PARSES TO ---------------------------------- */

test("the built powCard reads FULL, with the cycle and its grant", {skip}, () => {
  const b = build();
  assert.ok(b.HPOW, "Azalea must have a hero powCard");
  const fx = P.fxParse(b.HPOW);
  assert.equal(fx.tier, "full");
  assert.ok(fx.ga, "the printed Go again rides on the powCard's own text");
  const cyc = fx.ops.filter(o => o[0] === "arsCycle");
  assert.equal(cyc.length, 1, "one op for three sentences");
  /* BOTH HALVES COME OFF THE PRINTED LINE. A hardcoded "arrow"/"dominate"
     is right for this card and silently wrong for the next one — the same
     rule `rustDestroy` and Thunder Quake's heave follow for their
     numbers, and Sharpen for its threshold. */
  assert.deepEqual(cyc[0][1], {tt: "arrow", kw: "dominate"});
});

test("BOTH HALVES ARE READ, not assumed — a synthetic line proves it", () => {
  /* No pool card prints another subject or another keyword, so a fixture
     taken from the pool alone cannot tell a READ value from a literal.
     `dominate` is the only keyword the vocabulary admits (below), so the
     half this can move is the SUBJECT. */
  const fx = P.fxParse({name: "CYC-SUBJ", pitch: 0, tt: "Hero Ability", kw: [],
    tx: "Put a card from your arsenal on the bottom of your deck. If you do, put "
      + "the top card of your deck face-up into your arsenal. If it's a dagger, it "
      + "gets dominate until end of turn."});
  assert.deepEqual(fx.ops.filter(o => o[0] === "arsCycle")[0][1],
    {tt: "dagger", kw: "dominate"});
});

test("HALF THE CARD IS NOT THE CARD: sentence 1 alone refuses", () => {
  /* v2.29. Read on its own, "put a card from your arsenal on the bottom of
     your deck" is a DRAWBACK with its payoff dropped — strictly worse than
     printed, and filed as though the card worked. */
  const fx = P.fxParse({name: "CYC-HALF", pitch: 0, tt: "Hero Ability", kw: [],
    tx: "Put a card from your arsenal on the bottom of your deck."});
  assert.equal(fx.ops.filter(o => o[0] === "arsCycle").length, 0);
  assert.equal(fx.tier, "none");
});

test("THE KEYWORD VOCABULARY IS CLOSED — an unknown grant is dropped", () => {
  /* v3.55's rule about counter kinds, one mechanic over: a keyword nothing
     consumes is a no-op wearing a name, and `parser.defCap` is the only
     reader an arsenal keyword stamp currently has. The CYCLE still reads —
     it is the mechanism and stands on its own — so the card is weaker than
     printed in exactly one clause rather than inert. */
  const fx = P.fxParse({name: "CYC-KW", pitch: 0, tt: "Hero Ability", kw: [],
    tx: "Put a card from your arsenal on the bottom of your deck. If you do, put "
      + "the top card of your deck face-up into your arsenal. If it's an arrow, it "
      + "gets overpower until end of turn."});
  const cyc = fx.ops.filter(o => o[0] === "arsCycle");
  assert.equal(cyc.length, 1, "the cycle still reads");
  assert.equal(cyc[0][1], null, "…and the unbuilt keyword is not carried");
  /* and the clause is left UNREAD, so the audit still reports the gap */
  assert.ok(fx.clauses.some(c => c.st === "skip" && /overpower/.test(c.t)));
});

/* ---- 3. DRIVEN: what actually happens ------------------------------- */

function board(arsName, topName, o){
  const b = build();
  const opt = o || {};
  const ars = arsName == null ? null
    : Object.assign({}, H.card(arsName, 1), {uid: 900});
  const deck = [Object.assign({}, H.card(topName, 1), {uid: 901}),
                Object.assign({}, H.card("Nimblism", 1), {uid: 902})];
  return H.state({arsenal: ars, deck: opt.emptyDeck ? [] : deck, res: 9, ap: 1, hand: []},
                 {}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
}
const fire = g => H.execute(g, build().HPOW, "hero", -1, {});

test("DRIVEN: the cycle moves BOTH cards, and in the printed direction", {skip}, () => {
  const n = fire(board("Take Aim", "Swift Shot"));
  /* The two cards are DIFFERENT records on purpose: a fixture where the
     arsenal card and the deck top coincide cannot tell a cycle from a
     no-op (v3.26). */
  assert.equal(n.sides[0].arsenal.uid, 901, "the deck top is now the arsenal");
  assert.equal(n.sides[0].deck[n.sides[0].deck.length - 1].uid, 900,
    "…and the old arsenal card is on the BOTTOM, not the top");
  assert.equal(n.sides[0].deck.length, 2);
});

test("DRIVEN: it goes up FACE UP, and the arrow's own trigger fires", {skip}, () => {
  /* THE SHARED BODY (v3.17: the event is one body or it is not an event).
     Swift Shot prints "when this is put face-up into your arsenal, it gets
     go again this turn" — if this route had its own copy of the walk, the
     stamp would be the thing that quietly went missing. */
  const n = fire(board("Take Aim", "Swift Shot"));
  assert.equal(n.sides[0].arsenal._faceUp, true);
  assert.equal(n.sides[0].arsenal._upTurn, 3);
  assert.equal(n.sides[0].arsenal._arsGA, true);
  /* the OTHER trigger shape, so the drill is not pinned to one op kind */
  const m = fire(board("Take Aim", "Dry Powder Shot"));
  assert.equal(m.sides[0].arsenal._arsPow, 2);
});

test("DRIVEN: an EMPTY arsenal does nothing at all", {skip}, () => {
  /* "IF YOU DO" IS LOAD-BEARING. Nothing is put on the bottom, so nothing
     comes off the deck. Reading the second sentence unconditionally makes
     her hero strictly stronger than printed on the one board state where
     the cost cannot be paid — a free face-up card off an empty arsenal. */
  const g = board(null, "Swift Shot");
  const n = fire(g);
  assert.equal(n.sides[0].arsenal, null, "nothing arrives");
  assert.deepEqual(n.sides[0].deck.map(c => c.uid), [901, 902], "and the deck is untouched");
});

test("DRIVEN: with an EMPTY deck the same card comes straight back, face up", {skip}, () => {
  /* THE LITERAL READING IS THE RIGHT ONE, and this drill was written
     expecting the opposite. The card goes to the bottom of a deck that is
     empty, so the deck now holds exactly it — and "the top card of your
     deck" is that same card. It comes back FACE UP, which is a real line
     of play and not a bug.

     Check your own fixture before believing a new instrument (v3.70): the
     engine was right and the expectation was invented. */
  const n = fire(board("Take Aim", "Swift Shot", {emptyDeck: true}));
  assert.equal(n.sides[0].arsenal.uid, 900, "the same card, back where it started");
  assert.equal(n.sides[0].arsenal._faceUp, true, "…but now face UP, which is the point");
  assert.deepEqual(n.sides[0].deck, [], "and the deck is empty again");
});

test("DRIVEN: the dominate grant reads the SUBJECT — a non-arrow gets none", {skip}, () => {
  /* BOTH HALVES OR THE DRILL PROVES NOTHING (v3.45). A grant that fires on
     nothing passes the negative half perfectly, so the same board is driven
     twice with only the deck top changed. */
  const arrow = fire(board("Take Aim", "Swift Shot"));
  const other = fire(board("Take Aim", "Nimblism"));
  assert.deepEqual(arrow.sides[0].arsenal._arsKw, ["dominate"]);
  assert.equal(other.sides[0].arsenal._arsKw, undefined);
  assert.equal(other.sides[0].arsenal._faceUp, true,
    "…and the non-arrow still goes up: only the GRANT is conditional");
});

/* ---- 4. THE GRANT IS SPENT WHERE IT MATTERS ------------------------- */

function playArrow(stamped, turn){
  const arrow = Object.assign({}, H.card("Swift Shot", 1),
    {uid: 800, _faceUp: true, _upTurn: 3}, stamped ? {_arsKw: ["dominate"]} : {});
  const g = H.state({arsenal: arrow, deck: [Object.assign({}, H.card("Nimblism", 1), {uid: 801})],
                     res: 9, ap: 1, hand: []}, {},
                    {actor: 0, turnPlayer: 0, turn: turn, builds: [build(), {}]});
  return H.execute(g, arrow, "arsenal", -1, {});
}

test("DRIVEN: the stamped arrow reaches the wall holding dominate", {skip}, () => {
  /* GO ALL THE WAY TO THE OBSERVABLE. `_arsKw` on the card is a stamp
     nobody reads; `pend.defCap` is what BOTH walls are built from. */
  assert.deepEqual(playArrow(true, 3).pend.defCap, {n: 1, count: "hand"});
  assert.equal(playArrow(false, 3).pend.defCap, null,
    "the control — without the stamp the same card caps nothing");
});

test("DRIVEN: …and it expires with the turn, like every other arsenal stamp", {skip}, () => {
  /* "UNTIL END OF TURN". `_upTurn` is the whole mechanism, shared with
     `_arsPow` and `_arsGA`: an arrow held over keeps the card and loses
     the keyword. */
  assert.equal(playArrow(true, 4).pend.defCap, null);
});

test("DRIVEN: the wall actually refuses the second defender", {skip}, () => {
  /* The cap is only real if `judge.legal` enforces it. */
  const n = playArrow(true, 3);
  const blk = uid => ({uid, name: "Blocker " + uid, tt: "Guardian Action",
                       pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []});
  const g = Object.assign({}, n, {phase: "action", step: "defend", priority: 0,
    passed: [], attacker: 0, stack: [],
    pend: Object.assign({}, n.pend, {target: {kind: "hero"}})});
  g.sides = g.sides.slice();
  g.sides[1] = Object.assign({}, g.sides[1], {hand: [blk(61), blk(62)], gear: []});
  const first = J.reduce(g, {t: "defend", uid: 61}, 1).state;
  assert.equal(J.legal(g, {t: "defend", uid: 61}, 1), null, "one is legal");
  assert.ok(/more than 1/.test(String(J.legal(first, {t: "defend", uid: 62}, 1))),
    "a second must be refused");
});

/* ---- 5. THE ONE-BOARD GAP THIS FOUND -------------------------------- */

test("DRIVEN: a GRANTED dominate rides on the link, not on the resolution", {skip}, () => {
  /* v3.01's shape, found while building the stamp. `parser.defCap` merges
     a held grant with the card's PRINTED dominate and both walls call it —
     but `_kwGrant` is resolution-scoped and `judge.js` calls `defCap` with
     no `kwGrant` at all, so a dominate the card was GRANTED reached the
     trainer's wall and never the table's.

     Pulping is the pool's only such card: "if a card with 6 or more {p} is
     discarded this way, this gets dominate". Folding the merge in at
     DECLARATION is the fix, and it is idempotent for a card that prints
     the keyword — the wall re-reads the same card and takes the tightest
     of two identical caps. */
  const big = uid => ({uid, name: "Heavy " + uid, tt: "Brute Action - Attack",
                       ty: ["Brute", "Action", "Attack"], tx: "", kw: [],
                       power: 6, pitch: 1, cost: 0, def: 2});
  const g = H.state({hand: [big(701), big(702)], deck: [big(703)], res: 9, ap: 1},
                    {}, {actor: 0, turnPlayer: 0, turn: 3});
  const n = H.execute(g, Object.assign({}, H.card("Pulping", 1), {uid: 700}), "hand", -1, {});
  assert.deepEqual(n._kwGrant, ["dominate"], "the gate fired");
  assert.deepEqual(n.pend.defCap, {n: 1, count: "hand"},
    "…so the restriction must be on the link, where the table's wall reads it");
});
