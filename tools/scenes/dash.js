/* DASH — "You may start the game with a Mechanologist item with cost 2 or
   less in the arena."

   A PREGAME choice, and the one hero passive that changes the opening
   board rather than a rule. Her deck is the steam engine underneath it. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const P = require("../../engine/parser.js");
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
  name: "she opens with an item, and it LEAVES the deck",
  why: "A start-of-game permanent is the one passive that changes the " +
       "opening board. The card must be SPLICED out of the deck as well " +
       "as placed — left in both it is a card in two zones, which is the " +
       "`CARD-IN-TWO-ZONES` the invariant judge exists for.",
  run(c){
    const b = built(c, "dash");
    const it = b.startItem;
    const dupes = it ? b.deck.filter(x => x.uid === it.uid).length : -1;
    return {
      "she starts with something":  !!it,
      "…and it is an Item":         !!(it && /\bitem\b/i.test(it.card.tt || "")),
      "…costing 2 or less":         !!(it && (it.card.cost || 0) <= 2),
      "…and it is not ALSO in the deck": dupes,
      "no other hero starts with one":
        ["kayo", "bravo", "briar"].every(k => !built(c, k).startItem)
    };
  },
  want: {
    "she starts with something": true,
    "…and it is an Item": true,
    "…costing 2 or less": true,
    "…and it is not ALSO in the deck": 0,
    "no other hero starts with one": true
  }
},

{
  name: "two limits on a weapon swing, and they expire differently",
  why: "v2.46's rule, and her deck is where it bites. A blanket \"already " +
       "swung\" flag makes the Sledge WEAKER than printed (pay four again, " +
       "swing again); reading only `oncePerTurn` makes Scorpio STRONGER " +
       "(the TAP is a state, and a tapped permanent does not untap until " +
       "CR 4.4.3d). `weaponCost` returns both and both must be honoured.",
  run(c){
    const pool = require("../../data/pool.json");
    const line = n => (pool.find(x => x.name === n) || {}).functional_text || "";
    const sledge = P.weaponCost(line("Sledge of Anvilheim"));
    const scorpio = P.weaponCost(line("Scorpio, Comet Tail"));
    return {
      "the Sledge is once per turn": !!(sledge && sledge.oncePerTurn),
      "…and it does not tap":        !!(sledge && sledge.taps),
      "Scorpio is NOT once per turn": !!(scorpio && scorpio.oncePerTurn),
      "…it TAPS instead":            !!(scorpio && scorpio.taps)
    };
  },
  want: {
    "the Sledge is once per turn": false,
    "…and it does not tap": false,
    "Scorpio is NOT once per turn": false,
    "…it TAPS instead": true
  }
}

];
