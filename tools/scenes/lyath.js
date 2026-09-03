/* LYATH GOLDMANE — the halving, which was the project's ONLY UNFAIR entry
   from v3.21 to v3.78: the one unbuilt DRAWBACK in the pool, so he played
   strictly better than printed while `npm run sweep` said so every run and
   CLAUDE.md said the count was zero.

   These scenes ask the question the audit cannot: not "was the clause
   read" but "does the card DO what it prints". */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const E = require("../../engine/effects.js");
const RNG = require("../../engine/rng.js");
const {loadData} = require("../../test/helpers/extract.js");

function lyath(c){
  const W = loadData();
  const h = W.HEROES.find(x => x.k === "lyath");
  return B.buildSide(h, G.parseDeck(W.DECKS.lyath), c.H.db(), {},
                     RNG.make("scene-lyath"), {n: 0}).b;
}

module.exports = [

{
  name: "every card he controls is dealt at half its printed base",
  why: "v3.78 — unbuilt, this was the only UNFAIR entry `npm run sweep` " +
       "has ever carried, and the only DRAWBACK among them. He played " +
       "strictly better than printed for nineteen versions. The database " +
       "drops the reminder text; the SLY001 card face prints \"(5 becomes " +
       "3.)\", which is what rules out floor.",
  run(c){
    const b = lyath(c);
    const of = n => b.deck.find(x => x.name === n);
    const fist = b.gear.find(g => /Titan/.test(g.name));
    const others = ["kayo", "bravo", "dorinthea"].map(k => {
      const W = loadData();
      const h = W.HEROES.find(x => x.k === k);
      return B.buildSide(h, G.parseDeck(W.DECKS[k]), c.H.db(), {},
                         RNG.make("scene-" + k), {n: 0}).b;
    });
    return {
      "Full of Bravado — the printing's own example": of("Full of Bravado")._printedPow
        + " becomes " + of("Full of Bravado").power,
      "Goon Beatdown's defence":  of("Goon Beatdown")._printedDef + " becomes " + of("Goon Beatdown").def,
      "a 1-power attack does NOT round to nothing": of("Goon Beatdown").power,
      "his weapon halves too":    fist._printedPow + " becomes " + fist.power,
      "nothing is worn at the deal, so wear counts down from the halved base":
        b.gear.every(g => g.curDef === undefined),
      "and no other hero's list moves at all":
        others.every(x => x.deck.every(k => k._printedPow == null && k._printedDef == null))
    };
  },
  want: {
    "Full of Bravado — the printing's own example": "5 becomes 3",
    "Goon Beatdown's defence": "3 becomes 2",
    "a 1-power attack does NOT round to nothing": 1,
    "his weapon halves too": "3 becomes 2",
    "nothing is worn at the deal, so wear counts down from the halved base": true,
    "and no other hero's list moves at all": true
  }
},

{
  name: "…and the crowd buys some of it back",
  why: "v3.78 clause 2 — \"Defending action cards you control get +1{d} " +
       "this turn\", the rider on his boo. THE TWO CLAUSES COMPOSE, which " +
       "is the whole design of the hero: Goon Beatdown prints 3{d}, is " +
       "dealt at 2, and the boo lifts it back to 3. A scene that drove " +
       "either half alone would never see that the numbers have to meet.",
  run(c){
    const b = lyath(c);
    const pick = (n, u) => Object.assign({}, b.deck.find(x => x.name === n), {uid: u});
    const goon = pick("Goon Beatdown", 801);   /* Reviled Action - Attack */
    const drag = pick("Drag Down", 802);       /* Generic Defense Reaction */
    const g0 = c.state({hand: [], res: 9, ap: 1}, {hp: 20},
                       {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const dv = (g, card) => E.defendValue(g.sides[0], card, {});
    const g1 = c.H.runOps(g0, [["defActBuff", 1]], "Lyath");
    const g2 = c.H.runOps(g1, [["defActBuff", 1]], "Lyath");
    const end = E.beginEndPhase(g1, 0, c.H.db()).game;
    return {
      "printed":                       goon._printedDef,
      "dealt (halved)":                dv(g0, goon),
      "booed — back where it started": dv(g1, goon),
      "a second action card gets it too, it is a WINDOW not a charge":
        dv(g1, pick("Goon Tactics", 803)),
      "…and the grant is not spent":   g1.sides[0].defActionBuff,
      "two sources stack":             dv(g2, goon),
      "a Defense Reaction is not an action card": dv(g1, drag),
      "and it expires with the turn":  end.sides[0].defActionBuff
    };
  },
  want: {
    "printed": 3,
    "dealt (halved)": 2,
    "booed — back where it started": 3,
    "a second action card gets it too, it is a WINDOW not a charge": 3,
    "…and the grant is not spent": 1,
    "two sources stack": 4,
    "a Defense Reaction is not an action card": 0,
    "and it expires with the turn": 0
  }
},

{
  name: "Stonewall Impasse clashes from the GEAR zone, and braces until end of turn",
  why: "v3.94 — it is the pool's only clasher on EQUIPMENT, and one of " +
       "the four gear \"when this defends\" records v3.90 found that " +
       "NEITHER board could reach. Its payoff prints \"until end of turn\" " +
       "where Shred's `defMod` prints \"this combat chain\", so a bonus " +
       "filed without its window is weaker than printed the moment a " +
       "second chain opens the same turn (v3.87). The sabotage that drops " +
       "the gear wall from the clash scan is SILENT against every " +
       "hand-declared fixture.",
  run(c){
    const E = require("../../engine/effects.js");
    const top = (nm, power) => ({name: nm, uid: nm, pitch: 1, cost: 0, power,
      tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: []});
    const piece = Object.assign(c.card("Stonewall Impasse", 0), {uid: "gp1"});
    const g = c.state({name: "Alice", deck: [top("mine", 1)]},
                      {name: "Bob", gear: [Object.assign({}, piece)], deck: [top("theirs", 9)]},
                      {turn: 3, actor: 0});
    g.builds = [{}, {}];
    /* THE ATTACKER IS THE ACTOR on this route, and `afterDefenders` is
       handed both kinds of declared defender (v3.90). */
    const out = c.J.withEffects(Object.assign({}, g, {_declared: {card: top("atk", 5)}}),
      (fx, n) => fx.afterDefenders(n, [], [Object.assign({}, piece)]));
    const won = out.game || out;
    const printed = piece.def || 0;
    return {
      "a GEAR clasher fires at all":        (won.sides[1].defMod || []).length,
      "…and it carries its printed window": (won.sides[1].defMod || []).map(x => x.until),
      "the wall counts the bonus":          E.defendValue(won.sides[1], piece, {base: printed}) - printed,
      "the chain closing does not clear it": (E.closeChainGrants(won).sides[1].defMod || []).length,
      "…but the end phase does":            ((r => (r.game || r))(E.beginEndPhase(
                                               Object.assign({}, E.closeChainGrants(won), {phase: "end"}),
                                               1, c.H.db())).sides[1].defMod || []).length
    };
  },
  want: {
    "a GEAR clasher fires at all": 1,
    "…and it carries its printed window": ["turn"],
    "the wall counts the bonus": 1,
    "the chain closing does not clear it": 1,
    "…but the end phase does": 0
  }
}

];
