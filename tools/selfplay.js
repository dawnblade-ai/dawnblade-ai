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
  const errs = [], viols = [], warns = [], events = [];
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
        /* `invariants.js` produces TWO severities and this project has only
           ever read one. `errors()` filters the warnings out, and every
           drill, every scene, the trainer's own `setG` funnel and this
           harness all call `errors()` — so `HP-ABOVE-START`,
           `CHAIN-CLOSED-WITH-LINKS` and `DEAD-BUT-RUNNING` have been
           produced and consulted by NOBODY, ever. The last of those is
           CR 4.5.3's life-to-zero loss not having been applied, which is
           not a cosmetic complaint.

           THEY ARE COLLECTED SEPARATELY, NEVER FOLDED INTO `viols`. Folding
           them in would move the violation count in every existing report
           and make "a warning" and "a rule is broken NOW" the same number —
           v3.81's rule about a grammar fault and a corruption counter, one
           severity over. Opt-in (v3.58): nothing that reads `viols` moves,
           and `tools/tournament.js` is the first caller to read the other
           half. */
        const all = INV.check(n);
        for(const v of all){
          const row = {code: v.code, msg: v.msg, where: v.where, turn: n.turn, after: a.t};
          (v.severity === "error" ? viols : warns).push(row);
        }
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
        /* A MANDATORY WATCHER ON SOMEBODY ELSE'S HIT (v4.25). Boom Grenade
           is the pool's only one and it is in DASH's list, so this counter
           is how "the route works" is told apart from "no deck can reach
           it" — v3.84's rule: when you build a route, go and count how
           often it fires. The engine prints "goes off —" for BOTH halves
           of the shape, destroy or no destroy, so the count cannot be
           silently halved by the printed drawback (v3.81). */
        if(/goes off —/.test(line))                events.push(["hitwatch", line]);
        /* THE DELAYED ON-HIT GRANT (v4.41). Two pool records print it —
           Burn Up // Shock (Briar x2) and Banneret of Salvation (Boltyn) —
           and read as a `buffQ` entry with a null qualifier it was spent
           by whatever was DECLARED next and lost if that attack missed.
           v3.84's rule: when you build a route, go and count how often it
           fires. The phrase is the engine's own (v3.81) and
           test/hitnext.test.js pins the two spellings against each other.

           IT COUNTS THE ARMING, NOT THE PAYOUT, and deliberately: the
           payout runs the granted card's OWN ops through `runOps`, so it
           prints whatever that payload prints (an arcane line, a life
           line) and has no phrase of its own to watch. What this number
           answers is whether any deck reaches the clause at all.

           AND IT READS ZERO, WHICH IS A FACT ABOUT THIS POLICY AND NOT
           ABOUT THE ROUTE — measured both ways rather than assumed:

             Burn Up   28 feed lines in 14 games, every one at INSTANT
                       speed. In the ACTION phase BOTH halves are legal
                       and `payAction` tries half 0 first, so that route
                       would arm it; in a REACTION window half 0 is
                       refused ("Burn Up is an action") and only Shock is
                       legal. v4.03 gave the reaction branch priority and
                       v3.80 ranks a non-attack LAST in the action phase,
                       so an instant-speed non-attack is always spent in a
                       reaction window before the action phase offers it.
             Banneret  the charge is OFFERED 14 times and TAKEN 0. That is
                       v4.33's recorded decision: a price this policy
                       cannot weigh is declined, and it measured the cost
                       at about two games in fourteen.

           NEITHER IS FIXED HERE. Playing the Action half instead of the
           Instant half is a TIMING judgement — the grant is worth more
           only if an attack later connects — and v4.24's standing rule is
           that this policy does not make one; v4.38 measured what happens
           when it is allowed to (three heroes with no attack reaction at
           all went 22 -> 4, 16 -> 3, 15 -> 2). So the number stays a 0
           that says something true, the way v4.29's forced-exit half and
           v4.31's mirror limit do, and the DRILLS and the two SCENES are
           what cover the route. */
        if(/this turn, it pays off/.test(line))     events.push(["hitnext", line]);
        /* FUSION'S REVEAL (v4.27). The printed "you MAY reveal" is a real
           additional cost now rather than something the engine took for
           itself, so this counts the times a seat actually paid it — 16
           pool records across six cards, live in Iyslander's and Briar's
           lists. v3.84: when you build a route, go and count. */
        if(/is fused \(Fusion\)/.test(line))        events.push(["fusion", line]);
        /* LEAVING THE ARENA (v4.29). "When this leaves the arena, X"
           fired on two of the arena's seven exits, and both were exits a
           card SCHEDULES FOR ITSELF. This counts the times a card actually
           PAID for leaving, by any route. The phrase is the engine's own
           (v3.81: a counter that spells the wrong word reports zero
           exactly as a missing feature does) and test/leavearena.test.js
           pins the two spellings against each other.

           IT COUNTS EVERY EXIT DELIBERATELY, and the FORCED half reads
           ZERO here — measured over 224 games, where Condemn to Slaughter
           is named 88 times in 24 of them and every one is a PITCH or a
           BLOCK. `sparring.act` ranks non-attacks last (v3.80's printed-
           numbers argument) and never reaches it as a play, so the routes
           v4.29 built are exercised by drills rather than here. Narrowing
           the counter to that half would print a 0 that is about the
           POLICY, and a number in this block means a FEATURE FIRED
           (v4.17). v3.84: when you build a route, go and count. */
        if(/leaves the arena — and it pays out/.test(line)) events.push(["leave", line]);
        /* A WARD SPENDS ITS PERMANENT (v4.34). SEN037 prints "destroy this
           to prevent 1 of that damage" and the engine banked a standing
           pool at play instead, so the permanent was immortal and its ward
           outlived it. This counts the times one actually paid.

           IT IS ITS OWN COUNTER RATHER THAN A SHARE OF `leave`, because
           `leave` counts a PAYOUT and only Waning Vengeance has one — a
           Spectral Shield destroying itself pays nothing and would be
           invisible there. The phrase is the engine's own (v3.81) and
           test/ward.test.js pins the two spellings against each other. */
        if(/destroys itself — ward soaks/.test(line)) events.push(["ward", line]);
        /* v4.37 — a DESTROY-COST sheet answered. Both outcomes are
           counted, because the seat DECLINES by standing rule (v4.24: a
           price this policy cannot weigh is not no price), so a counter
           narrowed to the accept half would print a 0 that is about the
           POLICY rather than about the route (v4.29). The two phrases are
           `prompts.payVerb`'s own and are pinned against it (v3.81). */
        if(/ destroyed .+ — the rider resolves\.| rather than destroy it\./.test(line))
          events.push(["destroycost", line]);
        /* v4.38 — Danger Digits' targeted jab. The phrase is
           `effects.jabResolve`'s own and is pinned against it (v3.81:
           a counter that spells the wrong word reports zero exactly as a
           missing feature does). */
        if(/ lashes out at /.test(line)) events.push(["jab", line]);
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
  return {game: n, steps, errs, viols, warns, events, feedSeen};
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
