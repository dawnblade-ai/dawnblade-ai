/* `judge.moves` — WHAT A SEAT COULD START NOW, OTHER THAN PASSING.

   RULING (user, 2026-11-15): the page never passes for a player who has
   nothing to do, because the speed of that pass would tell the opponent the
   hand holds no instant. The player's own Pass button shows it instead
   (green: nothing else to do; purple: an action point would go unused), and
   this reader is what the button asks. Two ways it can be wrong, and each
   misleads a player:

     it MISSES a move   the button turns green while a card could be played
     it INVENTS a move  the button never turns green

   Real games are driven through the policy. At every state, for both seats:
   whatever the policy proposes that is not a pass must be in the list (the
   list is at least as wide as everything the AI ever finds), and every
   entry must be accepted by `reduce` (nothing invented). Then the list must
   actually have been EMPTY for a seat that held priority, and non-empty for
   one, or the drill measured nothing. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const J = require("../engine/judge");
const SP = require("../engine/sparring");
const B = require("../engine/build");
const C = require("../engine/cards");
const G = require("../engine/game");
const RNG = require("../engine/rng");
const { loadData } = require("./helpers/extract");

const CACHE = require("./helpers/extract").cardDbPath();
const skip = !fs.existsSync(CACHE) && "no cached DB — run: node tools/audit.js";
const W = loadData();
let _db = null;
const DB = () => _db || (_db = C.buildMaps(
  require("./helpers/extract").readCards(CACHE).filter(c => c && c.name).map(C.mapDbCard)));

function match(i0, i1, seed){
  const h0 = W.HEROES[i0], h1 = W.HEROES[i1], ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB(), rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB(), rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: 0, tokSeq: ctr.n});
}
const STARTS = ["play", "activate", "defend"];
const same = (a, b) => a.t === b.t && String(a.uid) === String(b.uid)
  && (a.t !== "play" || (a.from || "hand") === (b.from || "hand"));

/* `movesOf` is the reader under test, so a sabotaged copy can be driven too */
function drive(movesOf){
  const bad = [], seen = {empty: 0, full: 0, states: 0, kinds: {}};
  const n = W.HEROES.length;
  for(let k = 0; k < n; k++){
    let g = match(k, (k + 1) % n, "moves" + k);
    for(let i = 0; i < 700 && !g.over; i++){
      let step = null;
      for(const s of [0, 1]){
        const ms = movesOf(g, s);
        if(!g.pending && !g.prompt && g.priority === s){ seen.states++; ms.length ? seen.full++ : seen.empty++; }
        for(const m of ms){
          seen.kinds[m.t] = (seen.kinds[m.t] || 0) + 1;
          if(J.reduce(g, m, s).error) bad.push("invented: " + JSON.stringify(m));
        }
        const a = SP.act(g, s);
        if(!a) continue;
        if(STARTS.indexOf(a.t) >= 0 && !ms.some(m => same(m, a)) && J.legal(g, a, s) === null)
          bad.push("missed: " + JSON.stringify(a) + " in " + g.phase + "/" + g.step);
        if(!step){ const r = J.reduce(g, a, s); if(!r.error) step = r.state; }
      }
      if(!step) break;
      g = step;
    }
  }
  return {bad, seen};
}

test("moves lists every start the policy finds, invents none, and is sometimes empty", {skip}, () => {
  const {bad, seen} = drive(J.moves);
  assert.deepEqual(bad.slice(0, 5), []);
  assert.ok(seen.states > 2000, "only " + seen.states + " priority states were reached");
  assert.ok(seen.empty > 50, "a seat with priority and nothing to start was reached only " + seen.empty + " times");
  assert.ok(seen.full > 500, "a seat with something to start was reached only " + seen.full + " times");
  for(const t of STARTS) assert.ok(seen.kinds[t] > 20, "no '" + t + "' was ever listed: " + JSON.stringify(seen.kinds));
});

test("sabotage: a reader that forgets a zone is caught", {skip}, () => {
  for(const drop of [m => m.t === "play" && m.from === "arsenal", m => m.t === "activate", m => m.t === "defend"]){
    const {bad} = drive((g, s) => J.moves(g, s).filter(m => !drop(m)));
    assert.ok(bad.some(b => /^missed/.test(b)), "a dropped kind of move went unnoticed");
  }
});

test("a finished game and a bad seat have no moves", {skip}, () => {
  const g = match(0, 1, "over");
  assert.deepEqual(J.moves(J.reduce(g, {t: "concede"}, 0).state, 1), []);
  assert.deepEqual(J.moves(g, 2), []);
  assert.deepEqual(J.moves(null, 0), []);
});
