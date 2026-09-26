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
,

{
  name: "Concealed Object taps to pay, once, and the second use is refused",
  why: "v4.47 — his card, twice in his list, and the printed {t} was " +
       "charged on NEITHER board. Driven three times on one turn it queued " +
       "+1, +2, +3 for free: it is the pool's only readable arena record " +
       "with a {t} cost AND the only one that does not print \"destroy " +
       "this\", so nothing else limited it. The clause reads `full` " +
       "throughout, so coverage is blind, and it is STRONGER than printed, " +
       "which is the half the one-sided sweep is built not to see. Found by " +
       "building the table's arena-ability route and then driving it.",
  run(c){
    const co = c.card("Concealed Object", 3, 9901);
    let g = c.acting(c.state({res: 0, ap: 1, name: "Lyath Goldmane",
      board: [{uid: 9901, kind: "token", card: co, spent: false}]}, {hp: 20}));
    g = Object.assign({}, g, {turnPlayer: 0});
    const first = c.reduce(g, {t: "activate", uid: 9901}, 0);
    const why   = c.J.legal(first, {t: "activate", uid: 9901}, 0);
    return {
      "the printed line carries {t}":        c.P.tapsToActivate(co.tx || ""),
      "the pump lands once":                 first.sides[0].buffNext,
      "…and the permanent is tapped":        first.sides[0].board[0].spent,
      "it is NOT filed as an allowance":     Object.keys(first.sides[0].weaponUsed || {}).length,
      "a second use is refused by name":     /is tapped until your end phase/.test(String(why)),
      "and the feed says the tap was paid":  (first.feed || [])
        .some(l => /Concealed Object: Lyath Goldmane taps it to pay/.test(l))
    };
  },
  want: {
    "the printed line carries {t}": true,
    "the pump lands once": 1,
    "…and the permanent is tapped": true,
    "it is NOT filed as an allowance": 0,
    "a second use is refused by name": true,
    "and the feed says the tap was paid": true
  }
}
,

{
  name: "LINE CROSSERS: a tie counts as a lead for him and a deficit for them",
  why: "v4.51 — his Arms piece prints \"if you have the same {h} as a hero, it " +
       "also counts as you having more {h} than them, and them having less {h} " +
       "than you\", and the clause read NOTHING since the card was dealt. Wrong " +
       "in BOTH directions at once, which is why neither the coverage audit nor " +
       "the one-sided sweep could see it: he lost Mocking Blow's boo on a tie " +
       "(and the Might token his own hero passive makes of one), while the " +
       "opponent lost every \"if you have less {h}\" clause they hold. And the " +
       "asymmetry is the card — nothing makes HIM count as behind.",
  run(c){
    const lc = c.card("Line Crossers", 0, 5);
    const mb = c.card("Mocking Blow", 1, 11);
    const wb = c.card("Wounded Bull", 1, 12);

    /* HIS OWN HALF: Mocking Blow's `lifeGt`, at 20 v 20. */
    const boo = wear => {
      const g = c.acting(c.state({hp: 20, res: 9, ap: 2, name: "Lyath Goldmane",
        hand: [mb], gear: wear ? [lc] : []}, {hp: 20}, {turnPlayer: 0}));
      return c.exec(g, mb, "hand", 0, {target: "hero"}).sides[0].hist.booed || 0;
    };

    /* THEIR HALF: the opponent's Wounded Bull grows, because the piece says
       they count as BEHIND. It prints 7. */
    const bull = wear => {
      const g = c.acting(c.state({hp: 20, res: 9, ap: 2, hand: [wb], gear: []},
        {hp: 20, name: "Lyath Goldmane", gear: wear ? [lc] : []}, {turnPlayer: 0}));
      return c.exec(g, wb, "hand", 0, {target: "hero"}).pend.total;
    };

    const C = {hp: 20, board: [], gear: [lc]}, O = {hp: 20, board: [], gear: []};
    return {
      "the static is read off the printed line": JSON.stringify(c.P.fxParse(lc).lifeTie),
      "no piece, a tie: the crowd says nothing": boo(false),
      "worn, a tie: the crowd boos him":         boo(true),
      "no piece: their Wounded Bull is its 7":   bull(false),
      "worn: theirs counts as behind, so 8":     bull(true),
      "he is never BEHIND on a tie":             c.E.lifeBehind(C, O),
      "they are never AHEAD on a tie":           c.E.lifeAhead(O, C)
    };
  },
  want: {
    "the static is read off the printed line": "{\"ahead\":true,\"behind\":true}",
    "no piece, a tie: the crowd says nothing": 0,
    "worn, a tie: the crowd boos him": 1,
    "no piece: their Wounded Bull is its 7": 7,
    "worn: theirs counts as behind, so 8": 8,
    "he is never BEHIND on a tie": false,
    "they are never AHEAD on a tie": false
  }
},

{
  name: "Walk in My Shoes halves THEIR attack action cards from the crush to the end of their next turn",
  why: "v4.73 — the last of twelve crush riders, refused for thirty-four " +
       "versions because `halveCard` runs once at the DEAL and a halving " +
       "that starts and ends mid-game had nowhere to live. It lives on the " +
       "CARD, exactly as the deal leaves it, re-stamped when the window " +
       "opens and when it closes — so every reader of a base value sees it " +
       "untold. \"UNTIL the end of their next turn\" includes the rest of " +
       "this one: the halving is live at the crush, not armed for later.",
  run(c){
    const swing = (u, pw, df) => ({name: "Their Swing " + u, tt: "Generic Action - Attack",
      ty: ["Generic", "Action", "Attack"], tx: "", kw: [], power: pw, def: df, pitch: 1, cost: 0, uid: u});
    const rite = {name: "Their Rite", tt: "Generic Action", ty: ["Generic", "Action"],
      tx: "", kw: [], def: 3, pitch: 1, cost: 0, uid: "tr"};
    const game = buff => {
      c.P.fxReset();
      const w = c.card("Walk in My Shoes", 2, "w");
      let g = Object.assign(c.state({res: 3, ap: 1, hand: [w], buffNext: buff},
        {hp: 20, res: 0, hand: [swing("t1", 6, 3), rite], deck: [swing("t3", 5, 2)], board: []},
        {turn: 3, actor: 0, turnPlayer: 0}),
        {phase: "action", step: "layer", priority: 0, passed: [false, false],
         stack: [], chain: [], chainCards: []});
      g = c.H.drain(c.reduce(g, {t: "play", uid: "w", from: "hand"}, 0));
      for(let i = 0; i < 40 && !(g.chain || []).length; i++) g = c.reduce(g, {t: "pass"}, g.priority);
      return g;
    };
    const hit = game(1), miss = game(0);
    const hand = hit.sides[1].hand;
    const after = c.E.beginEndPhase(c.E.armNextTurn(hit, 1).game, 1).game.sides[1].hand;
    return {
      "5 to the hero crushes":                     20 - hit.sides[1].hp,
      "their 6-power attack is halved on the spot": [hand[0].power, hand[0].def],
      "…the card they will draw too":             hit.sides[1].deck[0].power,
      "…and their non-attack is untouched":        hand[1].def,
      "3 to the hero halves nothing":              miss.sides[1].hand[0].power,
      "the end of their next turn restores it":    [after[0].power, after[0].def]
    };
  },
  want: {
    "5 to the hero crushes": 5,
    "their 6-power attack is halved on the spot": [3, 2],
    "…the card they will draw too": 3,
    "…and their non-attack is untouched": 3,
    "3 to the hero halves nothing": 6,
    "the end of their next turn restores it": [6, 3]
  }
}

];
