/* ============================================================
   aiseat.test.js — AN AI SEAT WEARS A HERO (v5.35)

   RULING (user, 2026-10-18): "Yes it is time for the ai to learn to play
   the heroes - I'm confident the cards are suitable :)"

   The table's local opponent may now be any of the fifteen heroes, piloted
   by `sparring.act`. `npm run play` has measured that policy against
   itself for a long time, but through `selfplay.js`, which drives
   `judge.reduce` directly. A player reaches it through `local.js`, so this
   plays one game per hero THROUGH THE SESSION, built exactly as the board
   builds it: `buildMatch` with the AI seat on `build.defaultBoard`.

   What is asserted is the contract, never a win rate: no policy refusal,
   no stall, no invariant error, and the game ends. The opponent is UNTUNED.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

const L = require("../engine/local.js");
const J = require("../engine/judge.js");
const SP = require("../engine/sparring.js");
const B = require("../engine/build.js");
const C = require("../engine/cards.js");
const G = require("../engine/game.js");
const INV = require("../engine/invariants.js");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached card database";
const DATA = skip ? null : require("./helpers/extract.js").loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  JSON.parse(fs.readFileSync(CACHE, "utf8")).filter(c => c && c.name).map(C.mapDbCard)));

/* The board's own call, one hero per seat. */
function tableMatch(k0, k1, seed){
  const heroes = Object.fromEntries(DATA.HEROES.map(h => [h.k, h]));
  const decks = Object.fromEntries(DATA.HEROES.map(h => [h.k, G.parseDeck(DATA.DECKS[h.k])]));
  const m = B.buildMatch({
    heroes: [k0, k1],
    boards: [B.defaultBoard(heroes[k0], decks[k0], DB()), B.defaultBoard(heroes[k1], decks[k1], DB())],
    first: 0, seed
  }, {db: DB(), heroes, decks});
  return J.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys,
                     first: m.first, seed: m.seed, tokSeq: m.uidHigh});
}

test("defaultBoard is a legal loadout, not every printed piece", {skip}, () => {
  for(const h of DATA.HEROES){
    const d = G.parseDeck(DATA.DECKS[h.k]);
    const b = B.defaultBoard(h, d, DB());
    assert.ok(Array.isArray(b.gearIdx), h.k + ": no gear picks");
    assert.ok(b.gearIdx.length < d.gear.length || d.gear.length <= 4,
      h.k + ": the AI seat wears every printed piece — v2.41's eight-gear bug");
    const g = tableMatch(h.k, h.k, "board-" + h.k);
    assert.ok(g.sides[1].gear.length <= 6, h.k + ": seat 1 dealt " + g.sides[1].gear.length + " gear pieces");
  }
});

test("one game per hero through local.js: no refusal, no stall, no violation", {skip}, () => {
  const keys = DATA.HEROES.map(h => h.k);
  assert.equal(keys.length, 15, "the roster is not fifteen heroes");
  for(let i = 0; i < keys.length; i++){
    const ai = keys[i], me = keys[(i + 7) % keys.length];
    const g = tableMatch(me, ai, "aiseat-" + ai);
    assert.equal(g.sides[1].heroKey, ai, "seat 1 is not the chosen hero");
    let viol = [];
    const s = L.createLocal({seat: 0, state: g, reduce: J.reduce, legal: J.legal,
      policy: (st, k) => SP.act(st, k),
      onState: st => { if(!viol.length) viol = INV.errors(st); }});
    s.start();
    for(let n = 0; n < 6000 && !s.state().over; n++){
      const a = SP.act(s.state(), 0);
      if(!a) break;
      const why = s.submit(a);
      assert.equal(why, null, ai + ": the player's approved action was refused: " + why);
    }
    const end = s.state();
    assert.deepEqual(viol, [], ai + ": an intermediate state broke an invariant");
    assert.deepEqual(INV.errors(end), [], ai + ": the final state broke an invariant");
    assert.equal(s.stats().policyRefused, 0, ai + ": POLICY REFUSALS");
    assert.equal(s.stats().stalls, 0, ai + ": the session stalled");
    assert.ok(end.over, ai + ": the game never ended (turn " + end.turn + ")");
  }
});
