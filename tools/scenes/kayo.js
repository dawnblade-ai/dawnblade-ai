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
},

{
  name: "Beaten Trackers reads its own threshold, and only a RANDOM discard",
  why: "v3.93 — it FIRED for versions and still reported `part`, because " +
       "an inline regex in effects.js read it rather than the parser " +
       "(v3.58). **A tier that says `part` on a card that works is a " +
       "lead.** The regex matched `\\d+` and then tested `pow6`, a " +
       "hardcoded 6 — so a piece printing 8 would have fired on a 6, and " +
       "no pool fixture can see that because Beaten Trackers is the only " +
       "record of the shape (v3.32, tenth outing). Its sibling Refraction " +
       "Bolters prints the identical cost and was completely dead.",
  run(c){
    /* PRINTED 6, EFFECTIVE 7 under Kayo's clause 2 — the one power that
       clears a threshold of 6 and misses one of 8. Buckwild prints 7 and
       would meet both. */
    const six = () => ({uid: 11, name: "SYN-six", pitch: 1, power: 6, cost: 0,
      tt: "Generic Action - Attack", ty: ["Generic", "Action", "Attack"], tx: "", kw: [], gkw: []});
    const real = c.card("Beaten Trackers", 0);
    const eight = Object.assign({}, real, {name: "SYN-Trackers-8", uid: "gx",
      tx: (real.tx || "").replace("6 or more", "8 or more")});
    const at = (piece, ops) => {
      const g = Object.assign(c.state({hand: [six()], gear: [piece], res: 5, ap: 1},
                                      {hp: 20}, {turn: 3, turnPlayer: 0}), {phase: "action"});
      g.builds = [{atkPowOffChain: 1}, {}];
      const out = c.ops(g, ops, "scene");
      return out.game || out;
    };
    const rnd = at(Object.assign(c.card("Beaten Trackers", 0), {uid: "g1"}), [["discardRandom", 1]]);
    const chosen = at(Object.assign(c.card("Beaten Trackers", 0), {uid: "g1"}), [["selfDiscard", 1]]);
    const high = at(eight, [["discardRandom", 1]]);
    const sheet = rnd.promptQ && rnd.promptQ[0] && c.PM.buildPrompt(rnd, rnd.promptQ[0]);
    const paid = (o => o.game || o)(c.J.withEffects(
      Object.assign({}, rnd, {promptQ: [], prompt: c.PM.promptChoose(sheet, "pay")}),
      (fx, n) => fx.applyAnswer(n, n.prompt)));
    const no = (o => o.game || o)(c.J.withEffects(
      Object.assign({}, rnd, {promptQ: [], prompt: c.PM.promptChoose(sheet, "decline")}),
      (fx, n) => fx.applyAnswer(n, n.prompt)));
    return {
      "a RANDOM discard of a 6+ offers the piece": (rnd.promptQ || []).length,
      "a discard BY CHOICE is a different event":  (chosen.promptQ || []).length,
      "7 effective misses a printed threshold of 8": (high.promptQ || []).length,
      "the price is the piece, not resources":     sheet && sheet.cost,
      "…and the sheet names which piece":          sheet && sheet.destroyUid,
      "paying gains the printed action point":     paid.sides[0].ap,
      "…and spends the iron":                      !!paid.sides[0].gear[0].destroyed,
      "declining gains nothing":                   no.sides[0].ap,
      "…and keeps the iron (v2.04)":               !!no.sides[0].gear[0].destroyed
    };
  },
  want: {
    "a RANDOM discard of a 6+ offers the piece": 1,
    "a discard BY CHOICE is a different event": 0,
    "7 effective misses a printed threshold of 8": 0,
    "the price is the piece, not resources": 0,
    "…and the sheet names which piece": "g1",
    "paying gains the printed action point": 2,
    "…and spends the iron": true,
    "declining gains nothing": 1,
    "…and keeps the iron (v2.04)": false
  }
},

{
  name: "clash resolves at the table, and it did not exist there at all",
  why: "v3.94 — SEVEN pool cards print clash, every one reads `tier: full`, " +
       "and the whole mechanic lived in index.html: 31 mentions there, ONE " +
       "in judge.js and it is a COMMENT. v3.01's shape at the scale of a " +
       "mechanic, and the same family as phantasm (v3.00) and ephemeral " +
       "(v3.82). Every clash clause was filed `noop` with a reason naming " +
       "\"the clash block\" — a reader in the trainer — which is the no-op " +
       "blind spot at its purest. Four of these cards are Kayo's.",
  run(c){
    const top = (nm, power) => ({name: nm, uid: nm, pitch: 1, cost: 0, power,
      tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: []});
    const cm = Object.assign(c.card("Clash of Might", 1), {uid: "cm1"});
    const ub = Object.assign(c.card("Unexpected Backhand", 3), {uid: "ub1"});
    const run = (defenders, mine, theirs) => {
      const g = c.state({name: "Alice", deck: [top("mine", mine)]},
                        {name: "Bob", deck: [top("theirs", theirs)]},
                        {turn: 3, actor: 0});
      g.builds = [{}, {}];
      const out = c.J.withEffects(g, (fx, n) => fx.resolveClash(n, 0, defenders));
      const o = out.game || out;
      return {me: (o.sides[0].board || []).map(b => b.card.name),
              foe: (o.sides[1].board || []).map(b => b.card.name),
              hp0: o.sides[0].hp, hp1: o.sides[1].hp, actor: o.actor};
    };
    const won = run([cm], 6, 3), lost = run([cm], 3, 6), tied = run([cm], 4, 4);
    /* THE CARD THAT ONLY MENTIONS A CLASH. `hasKw` claims it — its whole
       text is a REVEAL payoff — and any non-block card may be declared as
       a defender, so the trainer ran a clash off it. */
    const mention = run([ub], 9, 1);
    /* …and as the REVEALED card on a win it really does pay off */
    const revealed = run([cm], 9, 1);
    const rv = (() => {
      const g = c.state({name: "Alice", deck: [Object.assign({}, ub, {uid: "ubDeck"})]},
                        {name: "Bob", deck: [top("t", 1)]}, {turn: 3, actor: 0});
      g.builds = [{}, {}];
      const o = c.J.withEffects(g, (fx, n) => fx.resolveClash(n, 0, [cm]));
      return (o.game || o).sides[1].hp;
    })();
    return {
      "winning the clash creates the token":      won.me,
      "…and the opponent gets nothing":           won.foe,
      "LOSING hands the token to the winner":     lost.foe,
      "a tie creates nothing at all":             [tied.me.length, tied.foe.length],
      "a card that only MENTIONS clash runs none": [mention.me.length, mention.foe.length],
      "…and deals nobody anything":               [mention.hp0, mention.hp1],
      "the revealed card lashes out on a win":    rv,
      "the borrowed seat is handed back":         revealed.actor
    };
  },
  want: {
    "winning the clash creates the token": ["Might"],
    "…and the opponent gets nothing": [],
    "LOSING hands the token to the winner": ["Might"],
    "a tie creates nothing at all": [0, 0],
    "a card that only MENTIONS clash runs none": [0, 0],
    "…and deals nobody anything": [20, 20],
    "the revealed card lashes out on a win": 19,
    "the borrowed seat is handed back": 0
  }
}

];
