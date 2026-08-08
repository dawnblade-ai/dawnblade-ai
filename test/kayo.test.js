/* ============================================================
   KAYO — the "6 or more {p}" engine.

   Kayo's deck is one mechanic wearing three sets of words, and until
   v2.55 the engine got all three wrong in ways no tool here could see.

   CLAUSE 2 — "Attack action cards you own get +1{p} while they are in
   any zone other than the combat chain." The combat chain is where an
   attack STRIKES, so this is deliberately NOT a damage buff: it is a
   THRESHOLD rule. 22 of the 47 deck cards print 6 or more; 23 more are
   attack actions printing exactly 5 — and those 23 are precisely the
   pitch-2 and pitch-3 cards you pitch for resources. Without the clause
   the pitch-zone checks essentially never fire and the hero does
   nothing. RULING (user, 2026-08-08): every 6+ check reads the buffed
   value, the strike reads the printed one.

   THE DISCARD — "draw a card then discard a random card" parsed to
   `[["draw",1]]`. The discard was silently deleted, so the cards drew
   for free, and the riders that ask "if a card with 6 or more {p} is
   discarded THIS WAY" then read the whole graveyard instead. Since an
   attack card is put into the graveyard AT DECLARATION, that made the
   condition satisfiable by any 6-power attack already played — and by
   the attacking card itself.

   Assertions here are on HANDS, ZONES and NUMBERS. Two v2.45 bugs lived
   under drills that read the log while the engine did the wrong thing.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const P = require("../engine/parser.js");
const C = require("../engine/cards.js");
const B = require("../engine/build.js");
const GM = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const E = require("../engine/effects.js");
const { loadData } = require("./helpers/extract.js");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached card database";

let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const W = loadData();
const kayoHero = () => W.HEROES.find(h => h.k === "kayo");
const kayoDeck = () => GM.parseDeck(W.DECKS.kayo);
const kayoBuild = () => B.buildSideDefault(kayoHero(), kayoDeck(), DB(), RNG.make("kayo"), {n: 0}).b;
const card = nm => {
  const e = kayoDeck().deck.find(x => x.name === nm) || kayoDeck().gear.find(x => x.name === nm);
  return C.resolveEntry(DB(), e, "SKA");
};

/* ---- CLAUSE 2 --------------------------------------------------------- */

test("clause 2 is read off the hero's PRINTED text, with its own number", {skip}, () => {
  const b = kayoBuild();
  assert.equal(b.atkPowOffChain, 1,
    "the +1 must come from the printed clause, not from a constant in the engine");
  assert.equal(b.mightOnFirst6Discard, true, "clause 3 is read too");
});

test("clause 2 lifts a printed-5 ATTACK ACTION to 6 for a threshold", {skip}, () => {
  const b = kayoBuild();
  const backhand = card("Unexpected Backhand");          // pitch 3, printed power 5
  assert.equal(+backhand.power, 5, "fixture drifted — Unexpected Backhand should print 5");
  assert.equal(P.zonePow(backhand, b), 6);
  assert.equal(P.pow6(backhand, b), true, "a printed 5 counts as 6 while off the chain");
  /* and WITHOUT the hero it is still a 5 — the buff belongs to Kayo, not
     to the card, so nothing may bake it into the card itself */
  assert.equal(P.pow6(backhand, null), false);
  assert.equal(P.pow6(backhand, {atkPowOffChain: 0}), false);
});

test("clause 2 does NOT lift a Block — it says ATTACK ACTION cards", {skip}, () => {
  const b = kayoBuild();
  const tom = card("Test of Might");
  assert.ok(!P.isAtkActionCard(tom), "Test of Might is a Block, not an attack action");
  assert.equal(P.zonePow(tom, b), tom.power == null ? 0 : +tom.power,
    "a Block gets nothing from a clause about attack action cards");
});

/* THE CENSUS, pinned. A number moving here should be a deliberate edit —
   it is the difference between the deck's engine being on and off. */
test("clause 2 turns 22 of Kayo's 47 deck cards into 45", {skip}, () => {
  const b = kayoBuild(), d = kayoDeck();
  let printed = 0, effective = 0, total = 0;
  for(const e of d.deck){
    const c = C.resolveEntry(DB(), e, "SKA");
    total += e.q;
    if((c.power != null ? +c.power : 0) >= 6) printed += e.q;
    if(P.pow6(c, b)) effective += e.q;
  }
  assert.equal(total, 47, "Kayo's deck is 47 cards");
  assert.equal(printed, 22, "printed 6-or-more");
  assert.equal(effective, 45, "with clause 2 — the two that stay out are the Test of Might copies");
});

/* THE STRIKE IS UNAFFECTED. This is the half of the clause that is easiest
   to get wrong in the generous direction, and generous is the direction
   that steals games. */
test("clause 2 never reaches the damage path", {skip}, () => {
  const efx = fs.readFileSync(path.join(__dirname, "..", "engine", "effects.js"), "utf8");
  const dmgish = efx.split("\n")
    .filter(l => /zonePow\(/.test(l))
    .filter(l => /total|strike|dealt|hp *-|damage/i.test(l));
  assert.deepEqual(dmgish, [],
    "zonePow appears on a line that also computes damage. It is a THRESHOLD value: " +
    "the combat chain is exactly the zone the clause excludes, so an attack strikes " +
    "for its PRINTED power.");
});

/* ---- THE DISCARD ------------------------------------------------------ */

test("the parser reads BOTH halves of draw-then-discard", {skip}, () => {
  for(const nm of ["Bare Fangs", "Wild Ride"]){
    const fx = P.fxParse(card(nm));
    assert.deepEqual(fx.ops.filter(o => o[0] === "draw" || o[0] === "discardRandom"),
      [["draw", 1], ["discardRandom", 1]],
      `${nm}: the discard is the COST of the draw — dropping it made the card strictly better than printed`);
  }
});

test('"discarded this way" is a different condition from "this turn"', {skip}, () => {
  const way = P.classifyClause("If a card with 6 or more {p} is discarded this way, it gets go again");
  assert.equal(way.cond, "discard6way",
    "the resolution-scoped wording asks about the discard this card just made");

  /* The TURN-scoped wording reaches the engine by two other routes and
     deliberately not through this one: Run Roughshod is a `playIf` gate,
     and Mandible Claw's rider is read where the weapon is activated. Both
     answer `had6ThisTurn`. What matters here is only that the two wordings
     never collapse into each other — collapsing them is what let an
     unrelated earlier discard satisfy a "this way" rider. */
  const turn = P.classifyClause("If you have discarded a card with 6 or more {p} this turn, this gets go again");
  assert.notEqual(turn && turn.cond, "discard6way",
    "the turn-scoped wording must NOT be read as the resolution-scoped one");

  assert.equal(P.fxParse(card("Run Roughshod")).playIf.kind, "discard6",
    "Run Roughshod's play gate is turn-scoped");
});

/* `had6ThisTurn` is a trainer closure, so pin its SHAPE at the call site:
   it must ask for `_disc`, or it goes back to counting the whole graveyard. */
test("the trainer's turn-scoped check asks for a real discard", {skip}, () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/const had6ThisTurn = [^\n]*/);
  assert.ok(m, "had6ThisTurn moved — re-anchor this drill");
  assert.match(m[0], /_disc/,
    "it must require the _disc stamp: an attack reaches the graveyard at DECLARATION, so " +
    "counting the graveyard lets a played 6-power attack satisfy a discard condition, itself included");
  assert.match(m[0], /pow6\(/, "and read effective power, so Kayo's clause 2 applies");
  assert.ok(!/you\(/.test(m[0]), "a rules question belongs to the ACTOR, not to seat 0");
});

/* ---- THE OP ITSELF ---------------------------------------------------- */

function ctx(build){
  return {
    L: (s, m) => ({...s, log: [m, ...(s.log || [])], feed: [...(s.feed || []), m]}),
    act: s => s.sides[s.actor || 0],
    actMut: n => { n.sides = n.sides.slice(); const i = n.actor || 0; n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    actorOf: s => s.actor || 0,
    bAct: () => build,
    built: build, db: DB(), dummyDefence: s => s,
    foe: s => s.sides[1 - (s.actor || 0)],
    foeMut: n => { n.sides = n.sides.slice(); const i = 1 - (n.actor || 0); n.sides[i] = {...n.sides[i]}; return n.sides[i]; },
    gy: (t, ...cs) => cs.map(c => ({...c, _gy: t})),
    gyDisc: (t, ...cs) => cs.map(c => ({...c, _gy: t, _disc: true})),
    had6ThisTurn: () => false,
    mkRune: s => s, openPrompt: s => s,
    tokSeq: (() => { let i = 0; return () => ++i; })(),
    typeAbbr: () => "attack", winCheck: s => s
  };
}
const side = hand => ({name: "kayo", hp: 20, res: 0, ap: 1, amp: 0, ward: 0, awd: 0, buffNext: 0,
  hand, deck: [], grave: [], banish: [], pitch: [], board: [], soul: [], counters: {}, hist: {}});
const game = hand => ({sides: [side(hand), side([])], actor: 0, turn: 2,
  log: [], feed: [], rng: RNG.make("disc")});

test("discardRandom moves a card from HAND to GRAVEYARD, stamped as a discard", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const hand = [card("Buckwild"), card("Smash Instinct")];
  const out = runOps(game(hand), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].hand.length, 1, "one card left the hand");
  assert.equal(out.sides[0].grave.length, 1, "and reached the graveyard");
  assert.equal(out.sides[0].grave[0]._disc, true,
    "stamped _disc — without it a discard is indistinguishable from a card that was merely played");
  assert.equal(out.sides[0].grave[0]._gy, 2, "and turn-stamped");
});

test("discardRandom is SEEDED — same seed, same card", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const hand = () => [card("Buckwild"), card("Smash Instinct"), card("Bear Hug")];
  const a = runOps(game(hand()), [["discardRandom", 1]], "p");
  const c = runOps(game(hand()), [["discardRandom", 1]], "p");
  assert.equal(a.sides[0].grave[0].name, c.sides[0].grave[0].name,
    "two peers and a replay must discard the same card");
  assert.ok(a.rng.n > 0, "the seeded stream was consumed, not Math.random");
});

test("Reincarnate discarded at random goes to the DECK BOTTOM, not the graveyard", {skip}, () => {
  const b = kayoBuild();
  const { runOps } = E.makeEffects(ctx(b));
  const out = runOps(game([card("Reincarnate")]), [["discardRandom", 1]], "probe");
  assert.equal(out.sides[0].grave.length, 0, "it never reaches the graveyard — its own printed text says so");
  assert.equal(out.sides[0].deck.length, 1);
  assert.equal(out.sides[0].deck[0].name, "Reincarnate");
});

/* ---- THE BUG THIS WHOLE DISTINCTION EXISTS FOR ------------------------ */

test("a PLAYED attack in the graveyard does not count as a discard", {skip}, () => {
  /* An attack card is put into the graveyard at declaration. Counting the
     graveyard therefore let any 6-power attack already played satisfy
     "you've discarded a card with 6 or more {p} this turn" — and a
     6-power attack satisfied it for itself. */
  const b = kayoBuild();
  const played = {...card("Buckwild"), _gy: 2};        // reached the graveyard by being PLAYED
  const discarded = {...card("Bear Hug"), _gy: 2, _disc: true};
  const had6 = grave => grave.some(c => c._gy === 2 && c._disc && P.pow6(c, b));
  assert.equal(had6([played]), false, "played, not discarded — it must not count");
  assert.equal(had6([discarded]), true, "an actual discard does");
});
