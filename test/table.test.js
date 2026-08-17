/* THE TABLE, END TO END (Phase 2).

   Every other drill here tests one layer. This one drives the whole seam
   the table screen actually walks, because the layers were each correct
   and the JOIN between them was the thing that did not exist:

     lobby negotiation  ->  matchSpec  ->  buildMatch  ->  judge.newMatch
                        ->  net.js at two peers        ->  a finished game

   The property under test is the one that cannot be checked on one
   phone: TWO PEERS, GIVEN THE SAME FOUR SMALL VALUES, ARRIVE AT THE SAME
   GAME. Nothing about a card crosses the wire — each peer resolves its
   own database — so if `mapDbCard`, `resolveEntry`, the seeded shuffle or
   the uid counter ever stopped being a pure function of the spec, the
   two boards would differ while both looked perfectly reasonable.

   The two peers are run as genuinely separate lobbies over a loopback,
   not as one state read twice, because reading one state twice proves
   nothing about agreement.

   Skips cleanly without the cached DB, same as coverage.test.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const L = require("../engine/lobby.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const J = require("../engine/judge.js");
const N = require("../engine/net.js");
const SP = require("../engine/sparring.js");
const IV = require("../engine/invariants.js");
const WI = require("../engine/wire.js");
const { loadData } = require("./helpers/extract");

const CACHE = require("./helpers/extract").cardDbPath();
const ready = fs.existsSync(CACHE);
const skip = !ready && "no cached DB — run: node tools/audit.js";

let db = null;
const DB = () => db || (db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

const W = loadData();
const DATA_VER = W.DATA_VER || "sage-v11";
const opts = () => ({db: DB(),
  heroes: Object.fromEntries(W.HEROES.map(h => [h.k, h])),
  decks:  Object.fromEntries(W.HEROES.map(h => [h.k, G.parseDeck(W.DECKS[h.k])]))});
const picks = k => {
  const o = opts(), h = o.heroes[k];
  return B.defaultPicks(B.gearSlots(o.decks[k].gear.map(e =>
    C.resolveEntry(o.db, e, (h.code || "").slice(0, 3)))));
};

/* ---- two peers, two lobbies, one channel ------------------------------
   Deliberately separate states. A helper that kept one lobby and read it
   twice would pass on a design with no agreement property at all. */
function negotiate(o){
  o = o || {};
  const code = o.code || "K7QM";
  const keys = o.heroes || ["kayo", "dorinthea"];
  const peers = [L.newLobby({code}), L.newLobby({code})];
  const errs = [];
  /* Each message reaches BOTH peers, in the order given to each — which
     is what a reliable ordered channel delivers. */
  const send = m => peers.forEach((s, i) => {
    const r = L.reduce(s, m);
    if(r.error && !r.error.dup) errs.push({peer: i, m, ...r.error});
    peers[i] = r.state;
  });

  send(L.hello(0, o.build0 || DATA_VER));
  send(L.hello(1, o.build1 || DATA_VER));
  if(L.stepOf(peers[0]) === "fault") return {peers, errs};
  send(L.hero(0, keys[0]));
  send(L.hero(1, keys[1]));
  /* A tie first, on purpose: the replay path is the one with a round
     counter in it, and a lobby that only ever sees a clean throw never
     exercises it. */
  send(L.throwIt(0, 0, "rock"));
  send(L.throwIt(1, 0, "rock"));
  send(L.throwIt(0, 1, "paper"));
  send(L.throwIt(1, 1, "rock"));
  send(L.seating(0, o.choice || "first"));
  send(L.sideboard(0, picks(keys[0]), o.cuts0 || {}));
  send(L.sideboard(1, picks(keys[1]), o.cuts1 || {}));
  return {peers, errs};
}

const gameFrom = (spec) => {
  const m = B.buildMatch(spec, opts());
  return {m, g: J.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys,
                            first: m.first, seed: m.seed})};
};

/* ---- the negotiation --------------------------------------------------- */

test("two peers negotiate to the same lobby, with a tie replayed", {skip}, () => {
  const {peers, errs} = negotiate();
  assert.deepEqual(errs, [], "a legal negotiation was refused: " + JSON.stringify(errs));
  assert.equal(L.stepOf(peers[0]), "ready");
  assert.equal(JSON.stringify(peers[0]), JSON.stringify(peers[1]),
    "the two phones hold different lobbies");
  assert.equal(peers[0].ties, 1, "the tie-replay path was not exercised");
  assert.equal(peers[0].winner, 0);
  assert.equal(peers[0].first, 0);
});

test("the winner electing SECOND seats the other player", {skip}, () => {
  const {peers} = negotiate({choice: "second"});
  assert.equal(L.matchSpec(peers[0]).first, 1);
});

/* ---- the join ---------------------------------------------------------- */

test("BOTH PEERS BUILD THE SAME GAME from the negotiated spec", {skip}, () => {
  const {peers} = negotiate();
  const a = gameFrom(L.matchSpec(peers[0]));
  const b = gameFrom(L.matchSpec(peers[1]));
  assert.equal(JSON.stringify(a.g), JSON.stringify(b.g),
    "two phones dealt different games from one negotiation");
});

test("the dealt game is a real one: printed life, printed intellect, two full hands", {skip}, () => {
  const {peers} = negotiate();
  const {g} = gameFrom(L.matchSpec(peers[0]));
  assert.deepEqual(g.sides.map(s => s.name), ["Kayo", "Dorinthea"]);
  assert.equal(g.turn, 1);
  assert.equal(g.phase, "action");
  assert.equal(g.priority, 0, "the first player must open holding priority");
  g.sides.forEach((s, i) => {
    assert.equal(s.hand.length, s.int, "seat " + i + " was not dealt to intellect");
    assert.ok(s.hp > 0, "seat " + i + " was seated with no life");
    assert.ok(s.deck.length > 30, "seat " + i + " has no deck behind its hand");
    assert.ok(s.gear.length > 0, "seat " + i + " sat down wearing nothing");
  });
  assert.deepEqual(IV.errors(g), [], "the opening state breaks a rule: " + JSON.stringify(IV.errors(g)));
});

/* THE TWO SEATS ARE THE SAME SHAPE. A second human cannot occupy a seat
   built differently from the one across the table, and until v2.41 the
   opponent really was equipped by a different path (it wore all eight
   printed pieces). Here both go through one `buildMatch`. */
test("the two seats are symmetric and legally equipped", {skip}, () => {
  const {peers} = negotiate({heroes: ["azalea", "azalea"]});
  const {g} = gameFrom(L.matchSpec(peers[0]));
  assert.deepEqual(Object.keys(g.sides[0]).sort(), Object.keys(g.sides[1]).sort());
  assert.equal(g.sides[0].gear.length, g.sides[1].gear.length,
    "a mirror match equipped the two seats differently");
  assert.ok(g.sides[0].gear.length <= 6, "eight pieces of iron is the v2.41 bug returning");
});

/* ---- the whole thing, played out --------------------------------------- */

/* Both seats driven by the sparring policy, each through its OWN net.js
   session, so every action really crosses the loopback and is sequenced.
   `refusals` must be zero: sparring.js asks `legal` before it proposes,
   so a refusal is a disagreement between the two peers' reducers, which
   is the desync this whole layer exists to prevent. */
function playOut(o){
  o = o || {};
  const {peers} = negotiate(o);
  const {g} = gameFrom(L.matchSpec(peers[0]));
  const lb = N.loopback();
  const ev = [];
  const mk = (seat, host, state, end) => N.createSession({
    seat, host, reduce: J.reduce, legal: J.legal, build: DATA_VER, state,
    send: m => end.send(m), onState: () => {},
    onEvent: e => { if(e.t === "desync" || e.t === "refused-by-host" || e.t === "snapshot-failed") ev.push(e); }
  });
  const host = mk(0, true, g, lb.a), guest = mk(1, false, null, lb.b);
  lb.a.session = host; lb.b.session = guest;
  guest.join();

  let steps = 0, refusals = 0, stuck = null;
  while(!host.state().over && steps < 6000){
    const st = host.state();
    const seat = [0, 1].find(i => SP.act(st, i) != null);
    if(seat == null){ stuck = st.phase + "/" + st.step + " pri " + st.priority; break; }
    const why = (seat === 0 ? host : guest).submit(SP.act(st, seat));
    if(why){ refusals++; if(refusals > 3) break; }
    steps++;
  }
  return {host, guest, steps, refusals, stuck, ev, opening: g};
}

test("A WHOLE GAME crosses the wire, and the two peers agree at the end", {skip}, () => {
  const r = playOut();
  assert.equal(r.stuck, null, "the game deadlocked at " + r.stuck);
  assert.equal(r.refusals, 0,
    "the sequencer refused an action the guest's own reducer accepted — the peers have diverged");
  assert.deepEqual(r.ev, [], "the session reported " + JSON.stringify(r.ev));
  assert.ok(r.host.state().over, "the game did not finish in 6000 actions");
  assert.ok(r.steps > 100, "the game finished in " + r.steps + " actions — it barely played");
  assert.equal(r.host.hash(), r.guest.hash(),
    "the two phones ended the game holding different states");
});

test("the finish is a LIFE total, never an invented loss", {skip}, () => {
  const over = playOut().host.state().over;
  assert.equal(over.how, "life",
    "CR 4.5.3 lists three ways to lose and running out of deck is not one of them");
  assert.ok(over.winner === 0 || over.winner === 1);
});

/* THE WINNER FOLLOWS THE HERO, NOT THE CHAIR — sparring.js's own
   property, re-asserted here because this is the first place the seats
   are dealt by a NEGOTIATION rather than by a test harness. If seating
   the same two heroes the other way round flipped the result, seat 1
   would be a weaker shape wearing a deck rather than a seat somebody can
   occupy. */
/* THE CHAIR MUST NOT BE DECIDING — and this is a BAND, not a sample.

   It ran ONE matchup on ONE seed and asserted the winner flipped when the
   heroes swapped chairs. That is an emergent outcome, and v3.04 flipped it
   by making 17 equipment abilities activatable at the table: Kayo/Dorinthea
   became close enough that the seat on the play took both. Measured across
   five matchups at the same moment, seat 0 won 5 of 10 — no bias at all.

   HANDOFF-MERGE.md lesson 5, in a fresh disguise: "a pinned sample is not a
   pinned rule… pinning an emergent count turns every honest card fix into a
   red drill and trains the reader to edit the number without thinking." The
   other chair drill was already converted to a band for exactly this; this
   one had been missed.

   THE SHAPE IT GUARDS is "one chair wins everything", which no band of this
   width hides. `sparring.test.js` holds the stronger per-hero property. */
test("the chair is not deciding — neither seat sweeps", {skip}, () => {
  /* THREE MATCHUPS, SIX GAMES. Five cost 31s in a suite that is meant to
     run on every change; three still cannot hide a sweep, which is the
     only shape this guards. Measured over five at v3.04: seat 0 won 5 of
     10, no bias. */
  const PAIRS = [["kayo", "dorinthea"], ["viserai", "dash"], ["boltyn", "fai"]];
  let seat0 = 0, games = 0, heroFollows = 0;
  for(const [x, y] of PAIRS){
    const p = playOut({heroes: [x, y]}).host.state().over;
    const q = playOut({heroes: [y, x]}).host.state().over;
    assert.ok(p && q, x + " vs " + y + " never finished");
    seat0 += (p.winner === 0 ? 1 : 0) + (q.winner === 0 ? 1 : 0);
    games += 2;
    if([x, y][p.winner] === [y, x][q.winner]) heroFollows++;
  }
  assert.ok(seat0 > 0 && seat0 < games,
    "seat " + (seat0 ? 0 : 1) + " won all " + games + " games — the chair is deciding, not the hero");
  assert.ok(heroFollows > 0,
    "not one matchup was won by the same HERO from both chairs — the seating is the whole game");
});

test("the state stays clean under the invariant judge for a whole game", {skip}, () => {
  const r = playOut();
  assert.deepEqual(IV.errors(r.host.state()), [],
    "the finished state breaks a rule: " + JSON.stringify(IV.errors(r.host.state())));
});

/* ---- what must be refused ---------------------------------------------- */

/* A silent divergence caught before a card is resolved. net.js checks the
   build too, but by then both peers have already dealt two decks from the
   same spec — and if the databases differ those decks differ CONSISTENTLY,
   which is the one failure a state hash cannot usefully describe. */
test("a card-data skew faults the lobby before a deck is dealt", {skip}, () => {
  const {peers} = negotiate({build1: "sage-v10"});
  assert.equal(L.stepOf(peers[0]), "fault");
  assert.equal(L.stepOf(peers[1]), "fault");
  assert.equal(peers[0].fault, peers[1].fault, "the two phones report different faults");
  assert.equal(L.matchSpec(peers[0]), null, "a faulted lobby must not hand off a match");
});

test("a seat cannot play the other seat's cards across the wire", {skip}, () => {
  const {peers} = negotiate();
  const {g} = gameFrom(L.matchSpec(peers[0]));
  const theirs = g.sides[0].hand[0];
  assert.ok(theirs);
  const why = J.legal(g, {t: "play", uid: theirs.uid, from: "hand"}, 1);
  assert.ok(why, "seat 1 was allowed to play a card out of seat 0's hand");
});

/* ---- every hero can actually sit down ----------------------------------- */

test("all 15 heroes deal a legal opening from a negotiated lobby", {skip}, () => {
  for(const h of W.HEROES){
    const {peers, errs} = negotiate({heroes: [h.k, "kayo"]});
    assert.deepEqual(errs, [], h.k + " could not negotiate: " + JSON.stringify(errs));
    const {g} = gameFrom(L.matchSpec(peers[0]));
    assert.equal(g.sides[0].hand.length, g.sides[0].int, h.k + " was not dealt to intellect");
    assert.deepEqual(IV.errors(g), [], h.k + " opens on a broken state");
    /* And the opening seat can actually do something, which is the
       difference between "a game was dealt" and "a game can be played". */
    assert.ok(SP.act(g, g.turnPlayer) != null, h.k + " opens with no legal action at all");
  }
});

/* ---- THE SNAPSHOT HAS TO FIT DOWN THE PIPE -----------------------------

   This is the bug no drill in this project could see, and it was found by
   opening two browsers: the opening snapshot measured **97KB**, a WebRTC
   data channel dropped it with no error at either end, and the guest sat
   in `handshaking` forever holding a board that looked perfectly correct
   — because it had built the same opening itself from the lobby spec.
   Every existing test passed. The transport is not exercised by any of
   them, and "correct but too big to send" is not a shape they ask about.

   Two things fixed it, and both are pinned below because either one
   regressing brings the silent stall straight back:

     1. `newMatch` stops retaining the build's `deck`/`gear`. They are
        construction inputs, already dealt into `sides`, and they were
        62KB of the 67KB.
     2. the session is handed a CATALOG, so card definitions ship as bare
        `name|pitch` keys instead of in full.                            */

const WIRE_BUDGET = 16 * 1024;

test("the opening snapshot fits a data channel, for every matchup", {skip}, () => {
  const o = opts();
  const keys = W.HEROES.map(h => h.k);
  let worst = 0, worstPair = null;
  for(const a of keys){
    for(const b of keys){
      const spec = {heroes: [a, b], first: 0, seed: "K7QM",
                    boards: [{gearIdx: picks(a), cuts: {}}, {gearIdx: picks(b), cuts: {}}]};
      const m = B.buildMatch(spec, o);
      const g = J.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys,
                            first: m.first, seed: m.seed});
      const cat = WI.makeCatalog(m.builds.flatMap(x =>
        [...(x.deck || []), ...(x.gear || []), ...(x.startItem ? [x.startItem.card] : [])]));
      const size = WI.sizeOf(WI.encode(g, {catalog: cat}));
      if(size > worst){ worst = size; worstPair = a + " vs " + b; }
    }
  }
  assert.ok(worst > 2000, "the sizing drill measured almost nothing — did it stop building?");
  assert.ok(worst <= WIRE_BUDGET,
    "the opening snapshot is " + worst + " bytes (" + worstPair + "), over the "
    + WIRE_BUDGET + "-byte budget a WebRTC data channel carries reliably. "
    + "It will be DROPPED WITHOUT AN ERROR and the guest will hang in `handshaking` "
    + "on a board that looks correct. Check what newMatch is retaining.");
});

test("a build's deck and gear are construction inputs, not state", {skip}, () => {
  const {peers} = negotiate();
  const {m, g} = gameFrom(L.matchSpec(peers[0]));
  assert.ok(m.builds[0].deck.length > 30, "buildMatch must still return the dealt deck");
  g.builds.forEach((b, i) => {
    assert.equal(b.deck, undefined,
      "seat " + i + "'s deck is in the game twice — once in sides, once in builds");
    assert.equal(b.gear, undefined, "seat " + i + "'s gear is in the game twice");
  });
  /* And the half that must SURVIVE: a rules site reads a hero's printed
     passives through `bAct`, so dropping those would silently turn every
     hero ability off. */
  for(const p of B.PASSIVES)
    assert.equal(typeof g.builds[0][p], B.PASSIVE_TYPE[p],
      "the " + p + " passive was stripped with the deck");
  assert.ok(g.builds[0].hp > 0 && g.builds[0].int > 0);
});

test("the catalog is what does the compressing, and both peers derive the same one", {skip}, () => {
  const {peers} = negotiate();
  const a = gameFrom(L.matchSpec(peers[0])), b = gameFrom(L.matchSpec(peers[1]));
  const catOf = m => WI.makeCatalog(m.builds.flatMap(x =>
    [...(x.deck || []), ...(x.gear || []), ...(x.startItem ? [x.startItem.card] : [])]));
  const ca = catOf(a.m), cb = catOf(b.m);
  assert.equal(WI.catalogHash(ca), WI.catalogHash(cb),
    "two peers built different catalogs — decode refuses a mismatch, so the match would never start");
  const withCat = WI.sizeOf(WI.encode(a.g, {catalog: ca}));
  const without = WI.sizeOf(WI.encode(a.g));
  assert.ok(withCat < without * 0.6,
    "the catalog saved only " + (without - withCat) + " bytes — it is not doing its job");
});

/* A snapshot that will not decode is a match that cannot start, so the
   round trip is asserted rather than assumed. */
test("the opening snapshot round-trips through the wire unchanged", {skip}, () => {
  const {peers} = negotiate();
  const {m, g} = gameFrom(L.matchSpec(peers[0]));
  const cat = WI.makeCatalog(m.builds.flatMap(x =>
    [...(x.deck || []), ...(x.gear || []), ...(x.startItem ? [x.startItem.card] : [])]));
  const back = WI.decode(WI.encode(g, {catalog: cat}), {catalog: cat});
  assert.equal(WI.hash(back), WI.hash(g), "the snapshot did not survive its own encoding");
  assert.deepEqual(back.sides.map(s => s.hand.map(c => c.name)),
                   g.sides.map(s => s.hand.map(c => c.name)));
});
