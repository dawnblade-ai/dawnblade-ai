/* ============================================================
   Dawnblade engine — rps.js (Phase 2)

   THE PREGAME THROW.

   Flesh and Blood decides seating with a die roll; this sim decides it
   with rock-paper-scissors, and the important part is the second half of
   the rule: **the winner does not go first, the winner CHOOSES who goes
   first.** That is a real decision — going first trades a card of tempo
   for initiative, and which side of that trade you want depends on the
   matchup — so it is modelled as a choice, not a consequence.

   Pure and RNG-injectable so the drills are deterministic. Mirrored into
   index.html under the lockstep rule; `test/sync.test.js` guards it.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnRPS = factory();
})(typeof self!=="undefined" ? self : this, function(){

const RPS_THROWS = ["rock","paper","scissors"];
const RPS_BEATS = {rock:"scissors", paper:"rock", scissors:"paper"};

/* 1 = a takes it, -1 = b takes it, 0 = tie. null if either throw is not
   a throw, so a bad call fails loudly instead of silently tying. */
function rpsResolve(a,b){
  if(RPS_BEATS[a] === undefined || RPS_BEATS[b] === undefined) return null;
  if(a === b) return 0;
  return RPS_BEATS[a] === b ? 1 : -1;
}

/* A series of throws. Ties are replayed rather than counted, so a series
   only concludes when someone is actually ahead — `winner` is null while
   it is still level and the caller throws again. */
function rpsSeries(rounds){
  let a = 0, b = 0, ties = 0;
  for(const r of (rounds||[])){
    const v = rpsResolve(r[0], r[1]);
    if(v === null) continue;
    if(v === 0) ties++; else if(v === 1) a++; else b++;
  }
  return {a, b, ties, rounds:(rounds||[]).length,
    winner: a === b ? null : (a > b ? 0 : 1)};
}

function rpsThrow(rand){
  const r = typeof rand === "function" ? rand() : Math.random();
  return RPS_THROWS[Math.min(RPS_THROWS.length-1, Math.floor(r*RPS_THROWS.length))];
}

/* The winner's decision, turned into seating. `choice` is "first" or
   "second" and names what the WINNER takes; the return value is the index
   of whoever actually starts the game. */
function rpsSeat(winner, choice){
  if(winner !== 0 && winner !== 1) return null;
  if(choice !== "first" && choice !== "second") return null;
  return choice === "first" ? winner : (winner === 0 ? 1 : 0);
}

return {RPS_THROWS, RPS_BEATS, rpsResolve, rpsSeries, rpsThrow, rpsSeat};
});
