/* KAYO — the reference. He is the one hero built end to end (v2.55-v2.63),
   so his scenes are here to prove the INSTRUMENT catches a working mechanic
   as readily as a broken one. A suite that only ever describes bugs is a
   suite nobody trusts to say a hero works.

   His whole deck is one idea wearing three sets of words: "a card with 6 or
   more {p}". And his hero ability is why — clause 2 gives attack action
   cards +1{p} outside the combat chain, which moved his own threshold from
   22 of 47 cards to 45. Read the hero ability before the cards. */
module.exports = [

{
  name: "his hero ability lifts attack cards OFF the chain, not on it",
  why: "the zone exclusion is what makes this a THRESHOLD rule rather than a " +
       "damage buff — the card counts as 6-power in hand, in the pitch zone " +
       "and in the graveyard, and reverts the moment it is the attack. " +
       "Reading it as a flat buff would hand him +1 damage on every swing.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const RNG = require("../../engine/rng.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "kayo");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.kayo), c.H.db(), {}, RNG.make("scene"), {n: 0}).b;
    /* a five-power attack action card is a SIX for every "6 or more" reader */
    const five = b.deck.find(x => c.P.isAttack(x) && (x.power || 0) === 5);
    /* THE ZONE IS THE CALLER'S ANSWER, not a field on the card. `pow6`
       takes the BUILD, and a site asking about a card that is currently
       the attack passes null — which is what makes this a threshold rule
       rather than a damage buff. (The first draft of this scene invented a
       `{zone}` argument the function does not take, and failed for that
       rather than for the engine.) */
    return {
      "the passive is read off his printed line": b.atkPowOffChain,
      "a 5-power attack counts as 6 off the chain": five ? c.P.pow6(five, b) : null,
      "…and as 5 once it IS the attack":           five ? c.P.pow6(five, null) : null
    };
  },
  want: {
    "the passive is read off his printed line": 1,
    "a 5-power attack counts as 6 off the chain": true,
    "…and as 5 once it IS the attack": false
  }
},

{
  name: "discarding a 6-power card mints Might, once per action phase",
  why: "his clause 3 is a per-ACTION-PHASE latch, not a per-turn one — a " +
       "discard in the end phase or on the opponent's turn does not make " +
       "Might (RULING, user 2026-08-08). A `>= 1` reading would mint on " +
       "every discard after the first, which is stronger than printed.",
  run(c){
    const big = {uid: 100, name: "Heavy Swing", tt: "Brute Action - Attack",
                 ty: ["Brute", "Action", "Attack"], tx: "", kw: [],
                 power: 6, pitch: 1, cost: 0, def: 2};
    const g = Object.assign({}, c.state({hand: [big, {...big, uid: 101}], res: 9, ap: 1,
      board: [], deck: [{uid: "d1", name: "T"}]}, {}, {actor: 0, turnPlayer: 0, turn: 3}),
      {builds: [{mightOnFirst6Discard: true}, {}], phase: "action"});
    const once  = c.ops(g, [["selfDiscard", 1]], "probe");
    const twice = c.ops(once, [["selfDiscard", 1]], "probe");
    const mights = s => (s.sides[0].board || []).filter(b => /might/i.test(b.card.name)).length;
    return {"one Might after the first discard": mights(once),
            "still one after the second":        mights(twice)};
  },
  want: {"one Might after the first discard": 1, "still one after the second": 1}
}

];
