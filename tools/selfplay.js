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
        /* THE COUNTER MUST SPELL WHAT THE FEED SPELLS (v3.81). This read
           /dies|died/ and the engine prints "<name> takes N and GOES
           DOWN" — so `death 0` was reported for three versions while the
           route worked, and the ally gap it was built to detect had
           already been closed. A scan aimed at the wrong WORD reports
           zero exactly as a missing feature does; v3.00 records the same
           defect with the opposite sign (a scan aimed at the wrong FILE).
           Anchored on the engine's own phrasing, with the old spellings
           kept so a future rewording of either is still counted. */
        if(/goes down|dies|died/i.test(line))     events.push(["death", line]);
        if(/\bGold\b.*\bcreated\b|Gold token/i.test(line)) events.push(["gold", line]);
        if(/\bcrush\b/i.test(line))              events.push(["crush", line]);
        /* THE REACTION WINDOW (v4.03). `sparring.js` contained the word
           "reaction" exactly once, in a comment, so the whole reaction
           step had ZERO coverage — 20 attack reactions and 15 defence
           reactions in the pool, driven never. That is why this harness
           reported byte-identical results either side of a fix that
           restored EVERY attack-reaction pump at the table.

           TWO PHRASES, because they are two different events: the layer
           going ON (the reaction was played) and the layer RESOLVING
           (both seats passed over it, CR 4.2.2). A counter that watched
           only the first would report a number while the resolution was
           broken, which is the bug v4.03 fixed. */
        if(/on the stack \(/i.test(line))          events.push(["reaction", line]);
        if(/layer resolves/i.test(line))           events.push(["layer", line]);
        if(/undefined|NaN|\[object/i.test(line)) events.push(["MALFORMED", line]);
        /* SEAT 0 IS LITERALLY NAMED "You" (v2.83, v3.90), so a feed line
           that NAMES the seat and then uses a third-person verb reads
           "You discards Barnacle". `effects.isSecondPerson` has existed
           since v3.90 to answer exactly that, and the lines written since
           were never swept — v4.15 found two by DRIVING the engine and
           reading the feed, which no parse assertion can do.

           IT IS ITS OWN FAULT, NOT `MALFORMED` (v3.81): that one catches
           structural corruption (`undefined`, `NaN`), and folding a
           grammar fault into it would hide which of the two a number
           means. The phrase is spelled here and in the engine, so a
           rewording of either breaks a drill rather than zeroing a
           count. */
        if(/\bYou [a-z]+s\b/.test(line)) events.push(["SECOND-PERSON", line]);
        feedSeen.add(line.replace(/\d+/g, "#"));
      }
      break;
    }
    if(!moved) break;
  }
  return {game: n, steps, errs, viols, events, feedSeen};
}

/* THE FAULT LIST IS A CENSUS, AND IT LIVES BESIDE THE COUNTERS (v4.17).
   `tourney.js` derives its ROUTE list from whatever `events` carries and
   excluded exactly ONE name — so `SECOND-PERSON`, added at v4.15, was
   reported under "ROUTE COVERAGE (times a feed line matched)", where a
   number means a FEATURE FIRED. Driven against a sabotaged `svName`:
   **78 faults, and the summary line read three zeroes.**

   That is v3.81 with the sign flipped — there a fault counter spelled
   the wrong word and reported nothing; here it reports a real number in
   the column that means the opposite. And it is the v4.03 lesson on the
   other half of the same split: the route list was made DERIVED because
   a hardcoded one in the report cannot see a counter added here. The
   exclusion was still typed, so it under-named by one the day this
   file grew a second fault.

   One spelling, here, where the counters are. A fault added below and
   not named here is caught by `test/selfplay.test.js`, which drives a
   line of each kind rather than reading this list. */
const FAULTS = ["MALFORMED", "SECOND-PERSON"];

/* AND THE TWO DECISIONS THE REPORT MAKES ABOUT THAT CENSUS LIVE HERE TOO,
   beside the thing they read. Both were a hardcoded list in `tourney.js`
   that under-named by one, and neither was drillable while it printed
   inline — a source slice rots where a rule moves (v3.22, v3.28, v3.94),
   so `test/tourney.test.js` DRIVES these with synthetic counts, and asks
   for BOTH halves: a check that only ever sees a fault at ZERO passes
   vacuously (v3.98).

   EVERY FAULT IS ON THE SUMMARY LINE, because those numbers are what
   CLAUDE.md tells a reader to read; one visible only in a detail block
   further down is a fault nobody is told about. And a fault is never a
   ROUTE — a number under "times a feed line matched" means a FEATURE
   FIRED, which is the opposite of what a fault count means. */
const summaryLine = (refusals, viols, faults) =>
  `POLICY REFUSALS ${refusals.length} · INVARIANT VIOLATIONS ${viols.length} · `
  + FAULTS.map(k => `${k} ${(faults[k] || []).length}`).join(" · ");
const routeNames = evts => Object.keys(evts).filter(k => !FAULTS.includes(k)).sort();

module.exports = {match, play, W, DB, J, SP, FAULTS, summaryLine, routeNames};

if(require.main === module){
  const keys = W.HEROES.map(h => h.k);
  console.log("heroes:", keys.join(" "));
}
