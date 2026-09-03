/* DORINTHEA — "The first time your weapon attack hits each turn, you may
   attack an additional time with that weapon this turn."

   The most heavily drilled hero in the project (50 drills) and the one
   with no scene, which is the gap this closes: every one of those drills
   asks about a clause or a state, and none of them plays a turn. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const RNG = require("../../engine/rng.js");
const {loadData} = require("../../test/helpers/extract.js");

function built(c, k){
  const W = loadData();
  const h = W.HEROES.find(x => x.k === k);
  return B.buildSide(h, G.parseDeck(W.DECKS[k]), c.H.db(), {},
                     RNG.make("scene-" + k), {n: 0}).b;
}

module.exports = [

{
  name: "a weapon that HITS is freed for one more swing — and only once",
  why: "v3.45's rule and v2.46's, meeting. The refresh is gated on the hit " +
       "(CR 7.5.5 — prevented is not dealt, so a swing blocked to nothing " +
       "is not a hit) and the allowance is spent by TRIGGERING rather than " +
       "by being used, which is exactly why the Dawnblade is printed to " +
       "reward its SECOND hit each turn and not its third.",
  run(c){
    const b = built(c, "dorinthea");
    const blade = Object.assign({}, b.gear.find(g => /Dawnblade/.test(g.name)), {uid: 950});
    const swing = wall => {
      const g = c.state({gear: [blade], res: 9, ap: 1, hand: []},
                        {hp: 20, hand: wall ? [wall] : []},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      let n = c.H.execute(g, blade, "weapon", 0, {});
      if(wall) n = Object.assign({}, n, {stack: [...n.stack, {k: "def", uid: wall.uid}]});
      const out = c.J.withEffects(n, (fx, s) => fx.resolveStack(s));
      return {used: Object.keys(out.sides[0].weaponUsed || {}).length,
              again: !!(out.sides[0].hist || {}).wpnAgain,
              dealt: 20 - out.sides[1].hp};
    };
    const hit = swing(null);
    const blocked = swing({uid: 960, name: "Wall", tt: "Generic Action",
                           ty: ["Generic", "Action"], pitch: 1, cost: 1,
                           power: 0, def: 9, tx: "", kw: []});
    return {
      "it hits, and the allowance is lifted": hit.again,
      "…so the weapon is free to swing again": hit.used,
      "a swing blocked to nothing deals":      blocked.dealt,
      "…and frees nothing (CR 7.5.5)":         blocked.again
    };
  },
  want: {
    "it hits, and the allowance is lifted": true,
    "…so the weapon is free to swing again": 0,
    "a swing blocked to nothing deals": 0,
    "…and frees nothing (CR 7.5.5)": false
  }
}

];
