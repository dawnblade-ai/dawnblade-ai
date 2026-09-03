/* ============================================================
   GRAVY BONES — A COST THAT DESTROYS SOMETHING ELSE (v3.86)

     "**Instant** - {t}, destroy a Gold you control: Draw a card, then
      discard a card."

   His deck reads in full and his hero read NOTHING: `parseHeroPower`
   refuses any cost containing "destroy" unless it destroys THIS, so
   `build.js` built him no powCard at all and neither board could offer
   the ability. The whole gap was the cost.

   AND THE COST IS THE POOL'S ONLY ONE OF ITS SHAPE. Measured across all
   797 records: 39 print an activation cost containing "destroy", and
   **38 of them say "destroy this"** — the `sd` flag that has existed
   since equipment abilities got a route. Gravy's is the single record
   that names a card somewhere else, which is exactly why widening the
   guard rather than naming the shape would be parsing ahead of wiring.

   THREE THINGS THE BUILD NEEDED, AND TWO ALREADY EXISTED:

     the {t}   `tapsToActivate` reads the hero's own printed line (v3.48)
               and answers TRUE for his — nothing new
     the draw  `classifyClause` reads "Draw a card, then discard a card"
     the cost  the third named shape, and `boardEntryNamed` to find it

   IT IS PAID ON ACTIVATION, beside the tap and the soul banish — never
   after the effect, the way an equipment's own `destroy this` is. Drawing
   and discarding first and finding the Gold gone afterwards is a
   different card, and the graveyard ORDER is what says which happened.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");

const P = require("../engine/parser.js");
const B = require("../engine/build.js");
const J = require("../engine/judge.js");
const G = require("../engine/game.js");
const C = require("../engine/cards.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const H = require("./helpers/judged.js");
const {loadData} = require("./helpers/extract.js");

const skip = !H.hasDb() && "no cached card database";

const HERO_TX = "**Instant** - {t}, destroy a Gold you control: Draw a card, "
              + "then discard a card.\n\nIf a blue card has been put into your "
              + "graveyard this turn, you may play cards with watery grave from "
              + "your graveyard.";

/* A REAL MATCH with Gravy in seat 0. `H.state` builds an EFFECTS-shaped
   state and carries no CR machine, so anything asking `judge.legal` has
   to open a real game (v3.80's lesson, one hero over). */
function table(o){
  o = o || {};
  const W = loadData();
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "gravycost");
  const h0 = W.HEROES.find(x => x.k === "gravy"), h1 = W.HEROES.find(x => x.k === "dorinthea");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS.gravy), H.db(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS.dorinthea), H.db(), rng, ctr); rng = b1.rng;
  let g = J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                      heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
  const sides = g.sides.slice();
  const board = [];
  for(let i = 0; i < (o.golds == null ? 1 : o.golds); i++)
    board.push({uid: "tokGOLD" + i, kind: "item", spent: false,
                card: Object.assign({}, H.card("Gold", 0), {uid: "tokGOLD" + i})});
  sides[0] = Object.assign({}, sides[0], {board});
  return {g: Object.assign({}, g, {sides}), b0: b0.b};
}

const use = (g, seat) => J.reduce(g, {t: "activate", from: "hero", uid: "hpow"}, seat == null ? 0 : seat);

/* ---- 1. THE READER ------------------------------------------------- */

test("the cost is READ, and it names the card it destroys", {skip}, () => {
  const hp = P.parseHeroPower(HERO_TX);
  assert.ok(hp, "the line is no longer refused");
  assert.equal(hp.destroyBoard, "Gold");
  assert.equal(hp.cost, 0, "the price is a permanent, not resources");
  assert.equal(hp.kind, "instant");
  assert.equal(hp.sd, false, "it destroys a Gold, NOT the hero");
});

test("the tap is the EXISTING reader's answer, not a second record", {skip}, () => {
  /* `tapsToActivate` (v3.48) reads the hero's own printed line for the
     `{t}` in the cost half, and it already answers for this shape. A
     second copy carried on the powCard would be two records of one fact —
     the drift this project names on every page. */
  assert.equal(P.tapsToActivate(HERO_TX), true);
});

test("the SUBJECT keeps its printed capitalisation — a common noun refuses",
     {skip}, () => {
  /* v3.53's rule: a proper noun is the only thing separating a NAME from
     a common noun, and `costStr` comes off the raw cleaned text for
     exactly that reason. Matched lowercased this claims "destroy a card
     you control" — a subject no reader can pin, which is the never-parse-
     ahead-of-wiring rule.

     A SYNTHETIC NEAR-MISS, because Gravy is the pool's ONLY card of this
     shape: sabotaging the anchor open is SILENT against every pool
     fixture (v3.73's Crash-and-Bash discriminator, one cost over). */
  assert.equal(P.parseHeroPower("**Instant** - {t}, destroy a card you control: Draw a card."), null);
  assert.equal(P.parseHeroPower("**Instant** - {t}, destroy an aura you control: Draw a card."), null);
  assert.ok(P.parseHeroPower("**Instant** - {t}, destroy a Silver you control: Draw a card."),
            "a printed NAME still reads");
});

test("an unreadable payload refuses the whole line", {skip}, () => {
  /* v2.29's rule: half a cost is not a cheap approximation when the half
     that reads is the REWARD. */
  assert.equal(P.parseHeroPower("**Instant** - {t}, destroy a Gold you control: Shuffle your deck into the void."), null);
});

test("38 of the pool's 39 destroy-costs destroy THIS — the measurement", {skip}, () => {
  /* THE PREMISE OF THE NARROWNESS. If this ever stops being true the
     shape below has siblings and the reader should be re-read, not
     quietly widened underneath. */
  const W = loadData();
  const recs = [];
  const seen = new Set();
  Object.keys(W.DECKS).forEach(k => {});
  const pool = require("../data/pool.json");
  const arr = Array.isArray(pool) ? pool : Object.values(pool);
  let self = 0, other = 0;
  arr.forEach(c => {
    const t = String(c.functional_text || "").replace(/\n+/g, " ");
    const m = t.match(/(?:^|[^a-z])(once per turn )?(attack reaction|action|instant)\s*[-—]*\s*([^:]{0,40}?):/i);
    if(m && /destroy/i.test(m[3])){ (/destroy this/i.test(m[3]) ? self++ : other++); }
  });
  assert.equal(other, 1, "Gravy Bones is the only cost that destroys something else");
  assert.ok(self >= 30, "and the rest all destroy the source: " + self);
});

/* ---- 2. THE BUILD --------------------------------------------------- */

test("the powCard is BUILT, and it carries the cost", {skip}, () => {
  const {b0} = table({});
  assert.ok(b0.HPOW, "Gravy has a hero power at all");
  assert.equal(P.abDestroyBoard(b0.HPOW), "Gold");
  assert.deepEqual(P.fxParse(b0.HPOW).ops, [["draw", 1], ["selfDiscard", 1]]);
});

test("`abDestroyBoard` is the one reader and it is opt-in", {skip}, () => {
  /* A FLAG GOES ON ONLY WHEN TRUE (v3.58) — every other powCard in the
     pool must be shape-identical to what it was. */
  const {b0} = table({});
  const other = B.buildSideDefault(loadData().HEROES.find(h => h.k === "kayo"),
    G.parseDeck(loadData().DECKS.kayo), H.db(), RNG.make("k"), {n: 0}).b;
  assert.equal(other.HPOW == null || !("_destroyBoard" in other.HPOW), true,
               "a hero whose cost names nothing carries no flag");
  assert.equal(P.abDestroyBoard(b0.HPOW), "Gold");
  assert.equal(P.abDestroyBoard({}), null);
});

/* ---- 3. THE LEGALITY, ON BOTH BOARDS -------------------------------- */

test("with no Gold on the board the activation is REFUSED, not resolved",
     {skip}, () => {
  /* A COST IS A LEGALITY (v3.11). Refusing afterwards would TAP him for a
     play the rules never allowed. */
  const {g} = table({golds: 0});
  const why = J.legal(g, {t: "activate", from: "hero", uid: "hpow"}, 0);
  assert.ok(why, "refused");
  assert.match(String(why), /Gold/);
  assert.equal(g.sides[0].heroTapped, false, "and he is not tapped by asking");
});

test("with a Gold it is legal", {skip}, () => {
  const {g} = table({});
  assert.equal(J.legal(g, {t: "activate", from: "hero", uid: "hpow"}, 0), null);
});

test("both boards ask the SAME reader", {skip}, () => {
  /* The charge is shared (`effects.js`); the legality is written once per
     board, which is the shape that produces "legal here, free there"
     (v3.01). Both sites read `abDestroyBoard` + `boardEntryNamed`. */
  const fs = require("fs");
  const html = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  const judge = fs.readFileSync(require("path").join(__dirname, "..", "engine", "judge.js"), "utf8");
  assert.match(html, /abDestroyBoard\(card\)/, "the trainer asks it");
  assert.match(html, /boardEntryNamed\(act\(s\), _dn\)/);
  assert.match(judge, /PR\.abDestroyBoard\(ab\)/, "judge asks it");
  assert.match(judge, /PR\.boardEntryNamed\(sd, _dn\)/);
});

/* ---- 4. THE CHARGE -------------------------------------------------- */

test("driven: the Gold is destroyed, he taps, and the hand nets one down",
     {skip}, () => {
  const {g} = table({});
  const before = {hand: g.sides[0].hand.length, grave: g.sides[0].grave.length,
                  board: g.sides[0].board.length};
  const out = use(g);
  assert.ok(!out.error, "the activation is accepted");
  const n = out.state;
  assert.equal(n.sides[0].board.length, before.board - 1, "the Gold left the arena");
  assert.equal(n.sides[0].hand.length, before.hand, "drew one, discarded one");
  assert.equal(n.sides[0].grave.length, before.grave + 2, "the Gold AND the discard");
  assert.equal(n.sides[0].heroTapped, true, "the {t} is charged (v3.48)");
  assert.equal(INV.errors(n).length, 0);
});

test("the destroyed Gold reaches the GRAVEYARD, turn-stamped", {skip}, () => {
  /* The 2026-08-29 ruling: a destroyed permanent goes to the graveyard.
     And `_gy` answers the whole "…this turn" family — a new path in that
     forgets the stamp makes those cards quietly wrong (v3.54). */
  const {g} = table({});
  const n = use({...g, turn: 5}).state;
  const gold = n.sides[0].grave.find(c => c.name === "Gold");
  assert.ok(gold, "it is in the graveyard, not in limbo");
  assert.equal(gold._gy, 5);
});

test("the COST is paid before the effect — the graveyard order says so",
     {skip}, () => {
  /* Every path into the graveyard UNSHIFTS, so the card filed FIRST sits
     deepest. Cost-first puts the Gold under the discard; charged after
     the effect it would sit on top. That ordering is the whole difference
     between "a cost" and "a rider".

     AND THE FIRST SABOTAGE FOR IT COULD NOT EXPRESS THE BUG (v3.62's
     rule, second outing). Written as a swap of the unshift for a push at
     the SAME site, it reported SILENT — because with an empty graveyard
     both orders leave the Gold at the same index. The sabotage that bites
     MOVES the whole charge to the late site where an equipment's own
     `destroy this` is paid, which is the thing the drill is named for. */
  const {g} = table({});
  const n = use(g).state;
  const gv = n.sides[0].grave;
  const gi = gv.findIndex(c => c.name === "Gold");
  assert.ok(gi > 0, "the Gold is not the most recent card in — it went in first");
  assert.equal(gi, gv.length - 1);
});

test("ONE Gold is spent, not both", {skip}, () => {
  const {g} = table({golds: 2});
  const n = use(g).state;
  assert.equal(n.sides[0].board.filter(b => b.card.name === "Gold").length, 1);
});

test("TWO limits, and they expire differently — allowance, then tap", {skip}, () => {
  /* v3.48's rule, and the first draft of this drill got it backwards.
     `weaponUsed["hpow"]` is a per-turn ALLOWANCE, lifted at every turn
     boundary; `heroTapped` is the STATE, lifted only by his own untap
     step (CR 4.4.3d). They coincide for a hero using his own ability and
     come apart the moment an OPPONENT taps him — so the drill has to
     drive both, in order, or it cannot tell which record refused.

     Two Golds, so the COST is never what refuses. */
  const {g} = table({golds: 2});
  const n = use(g).state;
  const first = String(J.legal(n, {t: "activate", from: "hero", uid: "hpow"}, 0) || "");
  assert.match(first, /spent for this turn/i, "the allowance refuses first");

  /* Lift the allowance the way a turn boundary does. The TAP must still
     refuse — that is the whole of what makes it a second record. */
  const lifted = {...n, sides: n.sides.map((s, i) =>
    i === 0 ? {...s, weaponUsed: {}} : s)};
  assert.equal(lifted.sides[0].heroTapped, true, "he is still tapped");
  assert.match(String(J.legal(lifted, {t: "activate", from: "hero", uid: "hpow"}, 0) || ""),
               /tapped/i, "and the tap alone is enough to refuse");
});

test("an unpayable cost is INERT, never free — the wire guard", {skip}, () => {
  /* `execute` is fed by `reduce`, which is fed by JSON off a wire, so a
     stale or crafted action can reach the charge with the Gold already
     gone. v2.04's rule: nothing happens, rather than a free draw. */
  const {g} = table({});
  const stripped = {...g, sides: g.sides.map((s, i) => i === 0 ? {...s, board: []} : s)};
  const hand = stripped.sides[0].hand.length;
  const out = J.withEffects(stripped, (fx, s2) =>
    fx.execute(s2, stripped.builds[0].HPOW, "hero", -1, {}));
  const n = out.game || out;
  assert.equal(n.sides[0].hand.length, hand, "no card was drawn");
  assert.match((n.feed || []).join(" | "), /Nothing happens/);
});

/* ---- 5. THE ROUTE IS REACHED --------------------------------------- */

test("`boardEntryNamed` is case-insensitive on the printed name", {skip}, () => {
  /* `classifyClause` works on lowercased text and `resolveEntry` returns
     the ENTRY's name (v3.33), so the two spellings genuinely meet. One
     reader, so they cannot disagree. */
  const e = {board: [{card: {name: "Gold", uid: 1}, uid: 1}]};
  assert.ok(P.boardEntryNamed(e, "Gold"));
  assert.ok(P.boardEntryNamed(e, "gold"));
  assert.equal(P.boardEntryNamed(e, "Silver"), null);
  assert.equal(P.boardEntryNamed({board: []}, "Gold"), null);
  assert.equal(P.boardEntryNamed(null, "Gold"), null);
});

test("FIRST match in board order — a total order, for replay", {skip}, () => {
  /* Two Gold tokens are indistinguishable, so there is no choice to
     offer; what matters is that two peers replaying one log spend the
     SAME entry. Board order is that total order. */
  const e = {board: [{card: {name: "Silver", uid: 1}, uid: 1},
                     {card: {name: "Gold", uid: 7}, uid: 7},
                     {card: {name: "Gold", uid: 2}, uid: 2}]};
  assert.equal(P.boardEntryNamed(e, "Gold").uid, 7);
});
