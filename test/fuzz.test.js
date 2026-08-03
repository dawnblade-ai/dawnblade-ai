/* THE REDUCER, FED GARBAGE — because a peer will feed it garbage.

   `judge.reduce` is not only driven by taps on this phone. `net.js`'s
   whole contract is that `legal` is asked twice: "a guest calls it before
   sending so an illegal tap never leaves the phone, and the sequencer
   calls it again before committing so a stale or buggy guest cannot push
   a bad action into the shared log."

   That makes the reducer a public surface. Everything arriving at it has
   been JSON on a wire, so it can be any shape at all — a stale action
   from before a resync, a guest on an older build, a crafted packet, or
   simply a bug in somebody's client. Four properties have to hold no
   matter what arrives, and each one is a way a real session dies:

     it never THROWS            an exception kills the session rather than
                                  refusing one move
     it never MUTATES on refusal the caller's state must survive a bad
                                  packet untouched
     `legal` and `reduce` AGREE  or a guest sends what the sequencer then
                                  refuses, and the two peers diverge
     one seat cannot act with the other's cards, or the whole point of
                                  seats is decoration

   The existing `legal()` drill in judge.test.js checks two states with
   string uids. This drives real games and throws non-strings, missing
   fields, wrong seats and crafted zone names at every state it passes
   through. */
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

function match(seed){
  const h0 = W.HEROES.find(h => /kayo/i.test(h.n)), h1 = W.HEROES.find(h => /dorinthea/i.test(h.n));
  const ctr = {n: 0};
  let rng = RNG.make(seed || "fuzz");
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}

/* STATES WORTH ATTACKING, sampled from a real game rather than built by
   hand: mid-payment, mid-chain, in the defend step, in the end phase
   waiting on an arsenal. A fuzz over the opening position only proves the
   opening position is safe. */
function statesFrom(seed, every){
  const out = [];
  let g = match(seed);
  for(let i = 0; i < 900 && !g.over; i++){
    if(i % (every || 7) === 0) out.push(g);
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(g, s);
      if(!a) continue;
      const r = J.reduce(g, a, s);
      if(r.error) continue;
      g = r.state; moved = true; break;
    }
    if(!moved) break;
  }
  out.push(g);
  return out;
}

/* Every shape a wire can deliver. Not exotic — a stale uid, a client that
   forgot a field, a number where a string belonged, and the two property
   names that reach Object.prototype. */
const HOSTILE = [
  null, undefined, 0, 1, "", "play", [], {},
  {t: null}, {t: 0}, {t: []}, {t: {}}, {t: "wat"}, {t: "PLAY"}, {t: " play"},
  {t: "play"}, {t: "play", uid: null}, {t: "play", uid: 0}, {t: "play", uid: {}},
  {t: "play", uid: [], from: []}, {t: "play", uid: "x", from: null},
  {t: "play", uid: "x", from: 7}, {t: "play", uid: "x", from: "nonsense"},
  /* the two that reach Object.prototype through a bare property read */
  {t: "play", uid: "x", from: "__proto__"},
  {t: "play", uid: "x", from: "constructor"},
  {t: "play", uid: "x", from: "toString"},
  {t: "play", uid: "x", from: "hand", target: {}},
  {t: "play", uid: "x", from: "hand", target: 0},
  {t: "activate"}, {t: "activate", uid: null}, {t: "activate", uid: {}},
  {t: "defend"}, {t: "defend", uid: null}, {t: "defend", uid: 12345},
  {t: "paySel"}, {t: "paySel", uid: null}, {t: "paySel", uid: {}},
  {t: "payConfirm"}, {t: "payCancel"},
  {t: "arsenal"}, {t: "arsenal", uid: {}}, {t: "arsenal", uid: 0},
  {t: "pass"}, {t: "endTurn"}, {t: "concede"},
  {t: "play", uid: "x", from: "hand", extra: {deeply: {nested: [1, 2, 3]}}}
];
const SEATS = [0, 1, -1, 2, 7, 1.5, "0", "1", null, undefined, NaN, {}, []];

test("no action of any shape makes the reducer throw", {skip}, () => {
  const states = statesFrom("throw");
  assert.ok(states.length > 8, "the fuzz only reached " + states.length + " states");
  let tried = 0;
  for(const g of states){
    for(const a of HOSTILE){
      for(const seat of SEATS){
        let out;
        try { out = J.reduce(g, a, seat); }
        catch(e){ assert.fail(`reduce threw on ${JSON.stringify(a)} @${String(seat)}: ${e.message}`); }
        assert.ok(out && typeof out === "object", "reduce returned a non-object");
        assert.ok("state" in out && "error" in out, "reduce broke its {state, error} contract");
        assert.ok(out.error === null || typeof out.error === "string",
          "the refusal was not a reason: " + JSON.stringify(out.error));
        tried++;
      }
    }
  }
  assert.ok(tried > 5000, "only " + tried + " combinations were tried");
});

test("a refused action leaves the caller's state untouched", {skip}, () => {
  /* THE REDUCER'S CONTRACT, and net.js depends on it: the sequencer runs
     `legal` again before committing, and a refusal there must cost the
     peer nothing. Identity, not deep equality — a refusal should not even
     have built a new object. */
  for(const g of statesFrom("untouched", 11)){
    const before = JSON.stringify(g);
    for(const a of HOSTILE){
      for(const seat of [0, 1]){
        const out = J.reduce(g, a, seat);
        if(!out.error) continue;
        assert.equal(out.state, g, "a refused action returned a rebuilt state");
        assert.equal(JSON.stringify(g), before, "a refused action mutated the state it was given");
      }
    }
  }
});

test("legal() and reduce() never disagree", {skip}, () => {
  /* If they can disagree, a guest sends what its own `legal` approved and
     the sequencer refuses it — or accepts something the guest never
     applied. Either way the two peers are running different games, which
     is the failure this whole layer exists to prevent. */
  let approved = 0, refused = 0;
  for(const g of statesFrom("agree", 5)){
    for(const a of HOSTILE){
      for(const seat of [0, 1, 2, null]){
        let why;
        try { why = J.legal(g, a, seat); }
        catch(e){ assert.fail("legal threw: " + e.message); }
        const out = J.reduce(g, a, seat);
        if(why == null){
          assert.equal(out.error, null,
            `legal approved ${JSON.stringify(a)} and reduce refused it: ${out.error}`);
          approved++;
        } else {
          assert.equal(out.error, why,
            `legal and reduce gave different reasons for ${JSON.stringify(a)}`);
          refused++;
        }
      }
    }
  }
  assert.ok(approved > 0 && refused > 0,
    `the drill never saw both outcomes (approved ${approved}, refused ${refused})`);
});

test("a crafted zone name cannot reach Object.prototype", {skip}, () => {
  /* `sd[zone]` is a bare property read on an object built from JSON that
     came off a wire. `__proto__`, `constructor` and `toString` all resolve
     to something truthy on any object, so a zone check that only asks
     "is it there" walks straight into a function. `legal` asks
     `Array.isArray`, which is the reason this is safe — and the reason it
     is pinned, because "truthy" is the tempting version. */
  const g = match("proto");
  /* ASKED OF THE SEAT THAT HOLDS PRIORITY. The other seat is refused
     earlier and correctly — "you do not hold priority" — which is a real
     refusal that never reaches the zone lookup at all, so asserting the
     zone message for both seats tests the wrong gate for one of them. */
  const holder = g.priority;
  assert.ok(holder === 0 || holder === 1, "nobody holds priority at the opening");
  for(const from of ["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]){
    {
      const seat = holder;
      const why = J.legal(g, {t: "play", uid: "x", from}, seat);
      /* NOT MERELY "a string". The refusal has to be the ZONE refusal —
         the one that says this is not a zone at all — because that is the
         `Array.isArray` path. Accepting any refusal passes just as
         happily when the guard is gone and the lookup has quietly walked
         into Object.prototype and come back empty-handed, which is one
         edit away from walking into it and throwing. */
      assert.match(String(why), new RegExp("there is no " + from + " to play from"),
        `from:"${from}" was refused for the wrong reason ("${why}") — the zone guard did not run`);
      const out = J.reduce(g, {t: "play", uid: "x", from}, seat);
      assert.equal(out.state, g);
    }
    /* the other seat must still be refused — just not necessarily here */
    const other = J.legal(g, {t: "play", uid: "x", from}, P.other(holder));
    assert.ok(typeof other === "string", `from:"${from}" was accepted for the non-priority seat`);
  }
  assert.equal({}.polluted, undefined, "the fuzz polluted Object.prototype");
  assert.equal([].polluted, undefined, "the fuzz polluted Array.prototype");
});

test("a seat cannot act with the other seat's cards", {skip}, () => {
  /* The one hostile action that LOOKS well-formed: a real uid, a real
     zone, a real action — belonging to somebody else. Nothing about its
     shape is wrong, so only an ownership check refuses it, and without
     one the seats are decoration. */
  const g = match("theirs");
  /* Every card and every piece of iron on the table, probed once from the
     wrong chair. Derived rather than a round number, so a seat that lost
     its hand cannot make this pass by having nothing to steal. */
  const want = [0, 1].reduce((t, i) => t + g.sides[i].hand.length + g.sides[i].gear.length, 0);
  let checked = 0;
  /* BOTH DIRECTIONS. Testing only the turn-player reaching across proves
     only that seat 0's lookups are seat-scoped; making `at()` ignore its
     index broke seat 1 alone and this drill did not notice. A seat is
     symmetric or it is not a seat. */
  for(const actor of [0, 1]){
    /* PRIORITY IS GIVEN TO THE ACTOR FIRST, and the refusal reason is
       asserted, because both halves are needed to test ownership at all:
       without priority the non-turn seat is refused by "you do not hold
       priority" long before any zone is read, and a drill that accepts
       any refusal then passes on an engine where every lookup reads seat
       0. Making `at()` ignore its index broke exactly that and this drill
       did not notice until the reason was pinned. */
    const armed = P.give(g, actor);
    const victim = armed.sides[P.other(actor)];
    for(const c of victim.hand){
      const why = J.legal(armed, {t: "play", uid: c.uid, from: "hand"}, actor);
      assert.match(String(why), /not in your hand/,
        `seat ${actor} was allowed to see seat ${P.other(actor)}'s ${c.name} in hand ("${why}")`);
      assert.equal(J.reduce(armed, {t: "play", uid: c.uid, from: "hand"}, actor).state, armed);
      checked++;
    }
    for(const piece of victim.gear){
      const why = J.legal(armed, {t: "activate", uid: piece.uid}, actor);
      assert.match(String(why), /no such equipment/,
        `seat ${actor} could reach seat ${P.other(actor)}'s ${piece.name} ("${why}")`);
      checked++;
    }
    /* The control: its OWN hand is reachable. Without this the drill
       passes just as well on an engine where nothing can be found at all. */
    const own = armed.sides[actor].hand[0];
    assert.doesNotMatch(String(J.legal(armed, {t: "play", uid: own.uid, from: "hand"}, actor)),
      /not in your hand/,
      `seat ${actor} cannot see its OWN hand — this drill would pass on a broken engine`);
  }
  assert.equal(checked, want, "not every card and piece was probed from the wrong chair");
  assert.ok(checked >= 16, "the table was suspiciously empty: " + checked);
});

test("an accepted action never leaves the state in a broken condition", {skip}, () => {
  /* The invariant judge, run after every action a fuzz manages to get
     ACCEPTED. Most of the hostile list is refused; the few that are not
     are the well-formed ones, and those must still land clean. */
  let accepted = 0;
  for(const g of statesFrom("clean", 5)){
    for(const a of HOSTILE){
      for(const seat of [0, 1]){
        const out = J.reduce(g, a, seat);
        if(out.error) continue;
        accepted++;
        assert.deepEqual(INV.errors(out.state), [],
          `${JSON.stringify(a)} @${seat} was accepted and broke a rule`);
      }
    }
  }
  assert.ok(accepted > 20, "only " + accepted + " actions were accepted — the fuzz proved little");
});
