/* THE SEAT POLICY, DRILLED.

   `sparring.js` is the piece that stops the rules knowing who is driving
   a seat. The trainer's dummy is a BRANCH inside the rules — `foeSwing`
   fabricates the swing, `dummyDefence` picks the blocks — so there is
   nowhere for a second human to sit and the same CR procedure is written
   twice. Here a seat is just something that answers "what do you do", and
   solo, hotseat and network are the same game with different things
   calling `reduce`.

   The drills that matter most are the ones that hold the CONTRACT rather
   than the heuristics: every action it emits is legal, it reads no card
   text, it is deterministic, and it drives both seats identically. The
   heuristics themselves are policy and are expected to be retuned. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const J = require("../engine/judge");
const SP = require("../engine/sparring");
const B = require("../engine/build");
const C = require("../engine/cards");
const G = require("../engine/game");
const P = require("../engine/priority");
const RNG = require("../engine/rng");
const INV = require("../engine/invariants");
const { loadData } = require("./helpers/extract");

const CACHE = path.join(__dirname, "..", "tools", ".cache", "card.json");
const skip = !fs.existsSync(CACHE) && "no cached DB — run: node tools/audit.js";

const W = loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));
const heroBy = re => W.HEROES.find(h => re.test(h.n));

function match(o){
  o = o || {};
  const h0 = o.h0 || heroBy(/kayo/i), h1 = o.h1 || heroBy(/dorinthea/i);
  const ctr = {n: 0};
  let rng = RNG.make(o.seed || "spar");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: o.first != null ? o.first : 0,
                     tokSeq: ctr.n});
}

/* Every card the seats were dealt, in exactly one zone. A card in TWO
   zones is CARD-IN-TWO-ZONES; a card in NONE falls out of the census and
   is invisible to it, which is why the combat chain is a named zone. */
function censusClean(g){
  const ZONES = ["deck", "hand", "pitch", "grave", "banish", "soul"];
  for(let i = 0; i < 2; i++){
    const s = g.sides[i], seen = new Set();
    ZONES.forEach(z => (s[z] || []).forEach(c => seen.add(c.uid)));
    if(s.arsenal) seen.add(s.arsenal.uid);
    (s.board || []).forEach(b => seen.add(b.uid));
    (g.chainCards || []).filter(x => x.by === i).forEach(x => seen.add(x.card.uid));
    const n = ZONES.reduce((t, z) => t + (s[z] || []).length, 0)
      + (s.arsenal ? 1 : 0) + (s.board || []).length
      + (g.chainCards || []).filter(x => x.by === i).length;
    if(seen.size !== n) return false;
  }
  return true;
}

/* ---- THE CONTRACT ------------------------------------------------------ */

/* THE ONE FAILURE THIS MODULE CAN HAVE. It offers every action to
   `judge.legal` before returning it, so a refusal is always a bug here —
   which is exactly why `run` records refusals instead of swallowing
   them. Six matchups, both seatings, whole games. */
test("every action the policy emits is legal — no refusals in a whole game", {skip}, () => {
  const pairs = [[/kayo/i, /dorinthea/i], [/briar/i, /azalea/i], [/gravy/i, /bravo/i],
                 [/viserai/i, /dash/i], [/boltyn/i, /fai/i]];
  for(const [a, b] of pairs){
    for(const first of [0, 1]){
      const out = SP.run(match({h0: heroBy(a), h1: heroBy(b), seed: "legal" + first, first}));
      assert.deepEqual(out.errs, [],
        `the policy was refused an action it had already had approved (${out.errs.map(e => e.why)})`);
      assert.ok(out.game.over, "the game never ended — the policy ran out of things to do");
      assert.deepEqual(INV.errors(out.game), [], "a whole game left the state in a broken condition");
      assert.ok(censusClean(out.game), "a card ended the game in two zones, or in none");
    }
  }
});

/* IT READS NO CARD TEXT, and the discipline is `actions.js`'s: a sparring
   partner playing badly and a card being read wrong must never be
   confusable. The moment this imports the parser they are — a bad block
   and a misread keyword produce the same symptom, a card that did not do
   what it should. It ranks on printed NUMBERS and asks `legal` for
   everything else. */
test("the policy imports no parser and reads no rules text", {skip: false}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "sparring.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/require\(["'].\/parser/.test(code) && !/DawnParser/.test(code),
    "sparring.js reached for the parser");
  for(const name of ["fxParse", "effCost", "classifyClause", "weaponCost", "hasKw"])
    assert.ok(!new RegExp("\\b" + name + "\\b").test(code),
      "sparring.js called " + name + " — that is card text, and it is Phase 3");
  /* `tx` is the printed rules box; `kw` is the keyword index, which
     CLAUDE.md is explicit is an INDEX and not a claim of possession. */
  assert.ok(!/\.tx\b/.test(code), "sparring.js read a card's rules text directly");
  assert.ok(!/\.kw\b/.test(code), "sparring.js read the keyword index");
});

/* A POLICY THAT CONSUMED THE SEEDED STREAM WOULD BREAK REPLAY. Every
   later shuffle and deal would shift, so replaying the same seed would
   diverge the moment a human took over a seat the policy used to drive.
   It is also a lockstep requirement: two peers must choose the same card
   from the same state, which needs a TOTAL order, not just no randomness. */
test("the policy is deterministic and never touches the rng", {skip}, () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine", "sparring.js"), "utf8");
  assert.ok(!/Math\.random/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "Math.random in the policy — a replay would not reproduce");

  const a = SP.run(match({seed: "det"})).game;
  const b = SP.run(match({seed: "det"})).game;
  assert.equal(a.turn, b.turn, "the same seed produced two different games");
  assert.deepEqual(a.sides.map(s => [s.hp, s.deck.length, s.grave.length]),
                   b.sides.map(s => [s.hp, s.deck.length, s.grave.length]));
  assert.equal(a.rng.n, b.rng.n, "the rng draw counter diverged between identical runs");

  /* and asking is free: `act` is a question, not a move */
  const g = match({seed: "pure"});
  const before = JSON.stringify(g.rng);
  SP.act(g, 0); SP.act(g, 1);
  assert.equal(JSON.stringify(g.rng), before, "asking the policy for an action advanced the rng");
});

test("act() never mutates the state it is asked about", {skip}, () => {
  const g = match({seed: "pure2"});
  const snap = JSON.stringify(g);
  for(let i = 0; i < 40; i++){ SP.act(g, 0); SP.act(g, 1); }
  assert.equal(JSON.stringify(g), snap, "the policy wrote to the game while deciding");
});

/* ---- ONE POLICY, TWO SEATS --------------------------------------------- */

/* THE POINT OF THE WHOLE MODULE. The trainer's opponent is a branch in
   the rules, so seat 1 can pitch, pay, attack and arsenal only in the
   sense that the branch does those things for it. Here both seats run the
   same function and there is no branch to be in. */
test("both seats do the same things, through the same policy", {skip}, () => {
  const out = SP.run(match({seed: "symmetry"}), {trace: true});
  for(const seat of [0, 1]){
    const did = new Set(out.trace.filter(t => t.seat === seat).map(t => t.t));
    for(const need of ["play", "paySel", "payConfirm", "defend", "arsenal", "pass", "endTurn"])
      assert.ok(did.has(need), `seat ${seat} never performed "${need}" in a whole game`);
  }
});

/* AND NEITHER CHAIR IS PRIVILEGED. If seat 1 were still the weaker shape
   it used to be — a branch in the rules rather than a seat somebody
   occupies — it would lose regardless of what deck sat in it.

   THIS DRILL USED TO ASSERT SOMETHING IT COULD NOT SHOW, and v2.77 is
   what exposed it. It ran Kayo against Dorinthea both ways round and
   asserted Kayo won both, on the reasoning that "Kayo's precon out-powers
   Dorinthea's on printed numbers alone with no card text in play". Two
   things were wrong with that:

     1. THE PREMISE EXPIRED. Card text resolves at this table now, so the
        matchup is no longer settled by printed power and Dorinthea's deck
        — which is built to swing a weapon twice — takes some of them.
     2. THE TWO GAMES WERE NEVER MIRRORS. Both seats are built from one
        seeded stream in seat order, so swapping the heroes hands them
        each other's shuffles. They are two different games with the same
        two decks, and asserting one winner across both was only ever
        going to hold while the outcome was overdetermined.

   A MIRROR IS THE HONEST FORM OF THE QUESTION. Same hero in both chairs,
   so nothing but the chair differs, across six seeds and both seatings.
   A structurally weaker seat would lose all twelve; a structurally weaker
   chair would take a lopsided share. It splits 6-6. */
test("neither chair is privileged — a mirror splits its wins", {skip}, () => {
  const kayo = heroBy(/kayo/i);
  const wins = [0, 0];
  let played = 0;
  for(const seed of ["m1", "m2", "m3", "m4", "m5", "m6"]) for(const first of [0, 1]){
    const g = SP.run(match({h0: kayo, h1: kayo, seed, first})).game;
    assert.ok(g.over, `the mirror at ${seed}/first=${first} never finished`);
    wins[g.over.winner]++; played++;
  }
  assert.equal(played, 12, "the drill stopped driving games");
  /* A BAND, NOT A PINNED NUMBER, and the distinction is deliberate. These
     counts are an emergent property of what the cards do, so every honest
     card fix moves them by one or two — pinning 6-6 exactly would turn a
     correct parser change into a red drill and train the reader to edit
     the number without thinking, which is worse than no drill at all.

     What is NOT emergent is the shape of the failure this guards. A seat
     that is structurally weaker loses all twelve; a chair that is
     privileged takes ten or eleven. Four of twelve to each is well inside
     what seating alone explains and well outside either of those. */
  assert.ok(wins[0] >= 4 && wins[1] >= 4,
    "a mirror match must not favour a chair — it split " + wins[0] + "-" + wins[1] + ". " +
    "Seat 1 is a seat somebody occupies, not a weaker shape wearing a deck; that is the " +
    "whole point of the policy.");
});

/* ---- THE POLICY ITSELF ------------------------------------------------- */

/* Null means "nothing to do RIGHT NOW", which is the normal answer for
   most of the game because for most of the game it is the other seat's
   window. A policy that always returned something would have to invent a
   move, and inventing one is how an illegal action gets sent. */
test("a seat with no window is given nothing to do", {skip}, () => {
  const g = match({seed: "idle"});
  const off = P.other(g.turnPlayer);
  assert.equal(g.priority, g.turnPlayer);
  assert.equal(SP.act(g, off), null, "the policy found a move for a seat holding no priority");
  assert.ok(SP.act(g, g.turnPlayer), "the seat holding priority was given nothing to do");
  const over = {...g, over: {winner: 0, how: "life"}};
  assert.equal(SP.act(over, 0), null, "the policy kept playing after the game ended");
  assert.equal(SP.act(g, 7), null, "the policy answered for a seat that does not exist");
});

/* BLOCKING EVERYTHING IS NOT PLAYING WELL, IT IS A DEGENERATE HARNESS.
   The trainer's heuristic was written for a seat with no action phase,
   where a card in hand had no use but to block. Ported unchanged, both
   seats blocked 41 of 41 attacks and one of them finished a 21-turn game
   on full life — a regression run that never deals damage never exercises
   the damage step. */
test("small hits are taken, not blocked — a card in hand is worth something", {skip}, () => {
  const g = match({seed: "soak"});
  const seat = P.other(g.turnPlayer);
  const sd = g.sides[seat];
  const tiny = {...g, step: "defend", attacker: g.turnPlayer, priority: g.turnPlayer,
                chainOpen: true, pend: {name: "Pinprick", by: g.turnPlayer, total: 2,
                                        target: {kind: "hero", side: seat, uid: null}}};
  assert.equal(SP.nextBlocker(tiny, seat, SP.DEFAULTS), null,
    "the policy spent a card from hand to stop 2 damage");

  /* a swing worth answering IS answered */
  const big = {...tiny, pend: {...tiny.pend, name: "Haymaker", total: 7}};
  assert.ok(SP.nextBlocker(big, seat, SP.DEFAULTS), "a 7-power swing went unanswered");
});

/* AND NOTHING IN HAND IS WORTH MORE THAN BEING ALIVE. The take-it rule
   has to yield to lethal, or the policy politely concedes games it could
   have blocked out of. */
test("a lethal swing is blocked with everything, whatever the policy says", {skip}, () => {
  let g = match({seed: "lethal"});
  const seat = P.other(g.turnPlayer);
  g = J.put(g, seat, s => ({...s, hp: 3}));
  const kill = {...g, step: "defend", attacker: g.turnPlayer, priority: g.turnPlayer,
                chainOpen: true, pend: {name: "The Last One", by: g.turnPlayer, total: 3,
                                        target: {kind: "hero", side: seat, uid: null}}};
  /* 3 damage against 3 life: below `takeUpTo`, and fatal */
  assert.ok(SP.nextBlocker(kill, seat, SP.DEFAULTS),
    "the policy took a hit that killed it rather than spend a card");

  /* and it keeps going past the hand-blocker cap when its life is on it */
  const many = {...kill, pend: {...kill.pend, total: 12}};
  let n = many, declared = 0;
  for(let i = 0; i < 6; i++){
    const a = SP.nextBlocker(n, seat, SP.DEFAULTS);
    if(!a) break;
    n = J.reduce(n, a, seat).state; declared++;
  }
  assert.ok(declared > SP.DEFAULTS.handBlockers,
    "the policy stopped at its comfort cap while dying — lethal must override it");
});

/* `legal` calls a play affordable when the pool plus the ENTIRE hand can
   raise the cost, which is the right RULE and a bad plan: a seat that
   pitches four cards for one attack has nothing to block the answer with.
   The estimate uses the PRINTED cost, because reading a reduction means
   reading the card's text — reductions only reduce, so the policy's
   mistake is to skip a card it could have afforded, which is the safe
   direction. */
test("the policy will not empty its hand to pay for one card", {skip}, () => {
  const sd = {res: 0, hand: [
    {uid: "a", cost: 6, pitch: 0, power: 9},
    {uid: "b", pitch: 1}, {uid: "c", pitch: 1}, {uid: "d", pitch: 1},
    {uid: "e", pitch: 1}, {uid: "f", pitch: 1}, {uid: "g", pitch: 1}]};
  const card = sd.hand[0];
  assert.equal(SP.affordableWithin(sd, card, SP.DEFAULTS), false,
    "a 6-cost card was proposed off six one-pitch cards");
  assert.equal(SP.affordableWithin(sd, card, {...SP.DEFAULTS, maxPitch: 6}), true,
    "the restraint is not the knob it claims to be");

  /* two blues cover it, and that is a normal turn */
  const rich = {res: 0, hand: [card, {uid: "x", pitch: 3}, {uid: "y", pitch: 3}]};
  assert.equal(SP.affordableWithin(rich, card, SP.DEFAULTS), true,
    "two pitches for a 6-cost card was called extravagant");
  /* what is already floating counts first */
  assert.equal(SP.affordableWithin({res: 6, hand: [card]}, card, SP.DEFAULTS), true,
    "a card already paid for out of the pool was refused");
});

test("a card never pitches for itself, and never twice", {skip}, () => {
  const sd = {res: 0, paySel: ["b"], hand: [
    {uid: "self", pitch: 3}, {uid: "b", pitch: 3}, {uid: "c", pitch: 2}]};
  const pick = SP.pitchPick(sd, {uid: "self"}, SP.DEFAULTS);
  assert.equal(pick.uid, "c", "the policy reached for the card being played, or one already selected");
  assert.equal(SP.pitchPick({res: 0, paySel: ["b", "c"], hand: sd.hand}, {uid: "self"}, SP.DEFAULTS), null,
    "the policy kept selecting once the hand was exhausted — a payment that never confirms");
});
