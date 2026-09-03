/* VISERAI — "Whenever you play a Runeblade card, if you've played another
   non-attack action card this turn, create a Runechant token."

   A GATE, not a bare trigger (v2.12): the Runeblade card alone mints
   nothing, and the "another" is what makes the rite a two-card turn. */
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
  name: "the rite needs TWO cards — a Runeblade card alone mints nothing",
  why: "v2.12 — a trigger is not a gate. \"Whenever you play a Runeblade " +
       "card, IF you've played another non-attack action card this turn\" " +
       "is a bare `when` carrying a nested `if`, and reading it as the " +
       "trigger alone mints a Runechant off every Runeblade card he plays.",
  run(c){
    const b = built(c, "viserai");
    /* NAMED, NOT SEARCHED. The first draft took "the first Runeblade
       non-attack in his shuffled deck", which is a different card under a
       different seed — and it landed on Mauvrion Skies, whose OWN text
       queues a Runechant grant, so the scene measured that card instead
       of the rite. A fixture that depends on a shuffle has not named what
       it is testing. Condemn to Slaughter is a Runeblade Action whose
       text says nothing about Runechants. */
    const rb = b.deck.find(x => x.name === "Condemn to Slaughter");
    const play = nonBefore => {
      const hist = Object.assign({atk: 0, non: nonBefore, arc: 0, aura: 0, made: 0,
                                 booed: 0, blue: 0, red: 0, trans: 0, blueGY: 0,
                                 atkNames: []}, {});
      const g = c.state({hand: [], res: 9, ap: 1, board: [], hist},
                        {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      const n = c.H.execute(g, Object.assign({}, rb, {uid: 970}), "hand", 0, {});
      return P.runeCount(n.sides[0]);
    };
    return {
      "his passive is built":                    b.viseraiPassive,
      "the card he plays is a Runeblade non-attack": /runeblade/i.test(rb.tt || ""),
      "…and it mints nothing of its own":        !/runechant/i.test(rb.tx || ""),
      "played first this turn — no rite":        play(0),
      "…after another non-attack — a Runechant": play(1)
    };
  },
  want: {
    "his passive is built": true,
    "the card he plays is a Runeblade non-attack": true,
    "…and it mints nothing of its own": true,
    "played first this turn — no rite": 0,
    "…after another non-attack — a Runechant": 1
  }
},

{
  name: "a Runechant is an AURA on the board, not a counter",
  why: "v2.23 — the printed token is \"Runeblade Token - Aura\", and seven " +
       "pool cards ask about auras generically. While it was an integer on " +
       "the side none of them could see it: it could not be counted and it " +
       "could not be destroyed. `runeCount` derives from the board, and " +
       "there is no `sd.rune` field for a drill to find.",
  run(c){
    const b = built(c, "viserai");
    const g = c.state({hand: [], res: 9, ap: 1, board: []}, {hp: 20},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.H.runOps(g, [["token", "Runechant", 2, "self"]], "scene");
    const sd = n.sides[0];
    return {
      "two minted, and they are on the BOARD": (sd.board || []).length,
      "…counted off the board":                P.runeCount(sd),
      "…and they count as AURAS":              P.auraCount(sd),
      "there is no integer field for them":    sd.rune === undefined,
      "each is a real card with the token's own text":
        (sd.board || []).every(e => e.card && /arcane/i.test(e.card.tx || ""))
    };
  },
  want: {
    "two minted, and they are on the BOARD": 2,
    "…counted off the board": 2,
    "…and they count as AURAS": 2,
    "there is no integer field for them": true,
    "each is a real card with the token's own text": true
  }
}

];
