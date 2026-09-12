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
},

{
  name: "the Hood shuffles her hand back and REDRAWS it",
  why: "v4.43. `applyPrompt` puts the chosen cards at the FRONT of the " +
       "deck, so with the shuffle dropped she draws back exactly what she " +
       "put down — every zone count correct, the feed saying the cards " +
       "went back, and the hand unchanged. A visible no-op wearing the " +
       "appearance of a card that worked. Drawing before shuffling is the " +
       "same bug spelled the other way. And the card read `tier: none` " +
       "for versions while its COST half was complete: hand the same " +
       "printed line a payload that reads and `parseHeroPower` answers " +
       "(v3.79's diagnostic) — reading the payload is what creates the " +
       "route (v3.47).",
  run(c){
    const hood = c.card("Hope Merchant's Hood", 0, "hd");
    /* A DECK BIG ENOUGH THAT DRAWING THREE CANNOT BE MISTAKEN FOR LUCK,
       and three named cards in hand so the redraw is identifiable. */
    const hand = [1,2,3].map(i => Object.assign({}, c.card("Sink Below", 1), {uid: "h"+i, name: "H"+i}));
    const deck = Array.from({length: 20}, (_, i) =>
      Object.assign({}, c.card("Sink Below", 1), {uid: "d"+i, name: "D"+i}));
    let g = c.acting(c.state({name: "Dash", res: 9, ap: 3, hand, deck, gear: []},
                             {name: "Them", hp: 20, deck: [c.card("Sink Below", 1)]},
                             {seed: "hood-scene", turn: 4}));
    const pw = c.P.parseHeroPower(hood.tx, true);
    const before = g.rng.n;
    g = c.ops(g, c.P.classifyClause(String(pw.eff).toLowerCase()).ops, "Hope Merchant's Hood");
    g = c.open(g);
    const offered = g.prompt ? g.prompt.max : -1;
    /* pick all three */
    let n = g;
    for(const i of [0,1,2]) n = c.J.reduce(n, {t: "promptSel", i}, 0).state;
    n = c.J.reduce(n, {t: "promptConfirm"}, 0).state;
    const drew = n.sides[0].hand.map(x => x.name);
    return {
      "the ability reads at all":      !!pw,
      "…at instant speed":             pw && pw.kind,
      "…paying with the piece":        !!(pw && pw.sd),
      "cards she may shuffle back":    offered,
      "cards in hand afterwards":      n.sides[0].hand.length,
      "cards left in the deck":        n.sides[0].deck.length,
      "the deck was SHUFFLED":         n.rng.n > before,
      "she drew back the same three, in order": drew.join(",") === "H1,H2,H3",
      "no card is in two zones":       new Set([...n.sides[0].deck, ...n.sides[0].hand]
                                         .map(x => x.uid)).size
    };
  },
  want: {
    "the ability reads at all": true,
    "…at instant speed": "instant",
    "…paying with the piece": true,
    "cards she may shuffle back": 3,
    "cards in hand afterwards": 3,
    "cards left in the deck": 20,
    "the deck was SHUFFLED": true,
    "she drew back the same three, in order": false,
    "no card is in two zones": 23
  }
}

];
