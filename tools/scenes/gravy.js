/* GRAVY BONES — watery grave, and the DRAWBACK that is the whole reason
   the keyword's ruling exists.

   "If a blue card has been put into your graveyard this turn, you may
    play cards with watery grave from your graveyard."

   The upside was live long before the drawback: he replays allies out of
   the graveyard, and until v3.01 nothing turned a dead ally face-down, so
   six allies were an infinite loop. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const E = require("../../engine/effects.js");
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
  name: "an ally that dies is turned FACE DOWN — it cannot be replayed",
  why: "The blind spot at its purest (v3.00). Watery grave was filed as a " +
       "keyword `noop` while its UPSIDE was live and its DRAWBACK was not, " +
       "so Gravy Bones replayed the same six allies out of his graveyard " +
       "forever. `failstates.js` holds a DRAWBACK to a higher bar than an " +
       "upside for exactly this reason: half a keyword is fine for a bonus " +
       "and is the wrong shape for a penalty.",
  run(c){
    const b = built(c, "gravy");
    const oy = b.deck.find(x => /Oysten/.test(x.name));
    const ally = Object.assign({}, oy, {uid: 980});
    const g = c.state({board: [{uid: 980, kind: "ally", spent: false, life: 1, card: ally}],
                       res: 9, ap: 1, hand: [], grave: []},
                      {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const out = G.damageAlly(g, 0, 980, 5);
    const n = out.game;
    const corpse = (n.sides[0].grave || []).find(x => x.uid === 980);
    return {
      "it prints watery grave":       /watery grave/i.test(ally.tx || ""),
      "killed, it leaves the board":  (n.sides[0].board || []).length,
      "…and reaches the graveyard":   !!corpse,
      "…FACE DOWN, so it cannot be replayed": !!(corpse && corpse._fd),
      "the feed says so":             (out.msgs || []).some(m => /face-down/i.test(m))
    };
  },
  want: {
    "it prints watery grave": true,
    "killed, it leaves the board": 0,
    "…and reaches the graveyard": true,
    "…FACE DOWN, so it cannot be replayed": true,
    "the feed says so": true
  }
},

{
  name: "…and its death trigger still pays out",
  why: "v3.46 — Oysten's is the pool's ONLY death trigger, and it was " +
       "unreachable until allies could attack (v3.44) and be attacked " +
       "(v3.45). The Gold belongs to the ally's CONTROLLER, not to " +
       "whoever shot it down: inside a combat link the actor is the " +
       "ATTACKER, so `allyDeath` borrows the controller's seat and GIVES " +
       "IT BACK — a body that leaves the actor moved corrupts every rule " +
       "after it in the same resolution.",
  run(c){
    const b = built(c, "gravy");
    const oy = b.deck.find(x => /Oysten/.test(x.name));
    /* the ATTACKER is seat 1; the ally is seat 0's */
    const g = c.state({board: [], res: 9, ap: 1, hand: []}, {hp: 20, board: []},
                      {actor: 1, turnPlayer: 1, turn: 3, builds: [b, b]});
    const out = c.H.fx(g, (fx, n) => ({game: fx.allyDeath(n, oy, 0).game}));
    const n = out.game || out;
    return {
      "the Gold lands on the ally's controller": (n.sides[0].board || [])
        .filter(e => /Gold/.test((e.card || {}).name || "")).length,
      "…and NOT on the attacker who shot it":   (n.sides[1].board || []).length,
      "the actor is handed back":               n.actor
    };
  },
  want: {
    "the Gold lands on the ally's controller": 1,
    "…and NOT on the attacker who shot it": 0,
    "the actor is handed back": 1
  }
}

];
