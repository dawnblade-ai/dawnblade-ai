/* ============================================================
   tools/selfplay.js — THE TABLE, PLAYED (v3.49)

   `sparring.act` in BOTH seats, driven through `judge.reduce`, with
   `invariants.check` run against EVERY intermediate state rather than the
   end state — a game that finishes clean can still have passed through a
   broken board.

   IT IS A MEASURING INSTRUMENT, NOT A DRILL. Nothing here asserts; it
   reports. Anything it proves that should STAY proven belongs in `test/`,
   where `npm test` will run it — `test/intellect.test.js` is the worked
   example, and the bug it pins was found by this file.

       node tools/tourney.js                       # all 15 heroes, 210 games
       node tools/tourney.js kayo,gravy '' 3       # a slice, 3 seeds each

   Read the top three numbers first: policy refusals (always a bug in the
   policy, per sparring.js's contract), invariant violations, and STALLS.
   The stall count is the cheapest livelock detector this project has and
   it is what found v3.49. See PLAYNOTES.md.
   ============================================================ */

/* SELF-PLAY HARNESS — sparring.act in BOTH seats, driven through judge.reduce.
   Instrumented for the things drills cannot see: policy refusals (always a
   bug per sparring.js's contract), invariant violations on every state, and
   whether the new ally-combat routes are ever REACHED in a real game. */
const J   = require("../engine/judge.js");
const SP  = require("../engine/sparring.js");
const B   = require("../engine/build.js");
const G   = require("../engine/game.js");
const RNG = require("../engine/rng.js");
const INV = require("../engine/invariants.js");
const {loadData} = require("../test/helpers/extract.js");
const H = require("../test/helpers/judged.js");

const W = loadData();
const DB = H.db();   /* buildMaps + setDb — the same two steps every drill uses */

function match(k0, k1, seed, first){
  const h0 = W.HEROES.find(h => h.k === k0), h1 = W.HEROES.find(h => h.k === k1);
  const ctr = {n: 0};
  let rng = RNG.make(seed);
  const b0 = B.buildSideDefault(h0, G.parseDeck(W.DECKS[h0.k]), DB, rng, ctr); rng = b0.rng;
  const b1 = B.buildSideDefault(h1, G.parseDeck(W.DECKS[h1.k]), DB, rng, ctr); rng = b1.rng;
  return J.newMatch({builds: [b0.b, b1.b], names: [h0.n, h1.n],
                     heroKeys: [h0.k, h1.k], rng, first: first || 0, tokSeq: ctr.n});
}

/* Drive one game, auditing every state on the way. `sparring.run` returns
   only the end state, so the loop is inlined to get at the intermediates —
   a game that ends clean can still have passed through a broken board. */
function play(g, limit){
  limit = limit || 4000;
  let n = g, steps = 0;
  const errs = [], viols = [], events = [];
  const feedSeen = new Set();
  for(let i = 0; i < limit && !n.over; i++){
    let moved = false;
    for(const s of [0, 1]){
      const a = SP.act(n, s);
      if(!a) continue;
      const out = J.reduce(n, a, s);
      if(out.error){ errs.push({t: a.t, seat: s, why: out.error, turn: n.turn}); continue; }
      const before = n;
      n = out.state; steps++; moved = true;
      try {
        for(const v of INV.errors(n))
          viols.push({code: v.code, msg: v.msg, where: v.where, turn: n.turn, after: a.t});
      } catch(e){ viols.push({code: "JUDGE-THREW", msg: e.message, turn: n.turn, after: a.t}); }
      /* Which of the new routes actually FIRED. */
      const nf = (n.feed || []).slice((before.feed || []).length);
      for(const line of nf){
        if(/tapped|taps/i.test(line))            events.push(["tap", line]);
        if(/ally|allies/i.test(line))            events.push(["ally", line]);
        if(/dies|died/i.test(line))              events.push(["death", line]);
        if(/Gold token/i.test(line))             events.push(["gold", line]);
        if(/\bcrush\b/i.test(line))              events.push(["crush", line]);
        if(/undefined|NaN|\[object/i.test(line)) events.push(["MALFORMED", line]);
        feedSeen.add(line.replace(/\d+/g, "#"));
      }
      break;
    }
    if(!moved) break;
  }
  return {game: n, steps, errs, viols, events, feedSeen};
}

module.exports = {match, play, W, DB, J, SP};

if(require.main === module){
  const keys = W.HEROES.map(h => h.k);
  console.log("heroes:", keys.join(" "));
}
