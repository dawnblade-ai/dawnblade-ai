/* BRAVO — the Guardian. His deck read 100% and his hero ability read 0%,
   which was the sharpest illustration in the pool of why deck coverage was
   never the binding constraint. His hero landed at v3.72 and needed no new
   machinery: Azalea's v3.71 arsenal build already turns a card face up,
   fires its triggers and stamps a conditional bonus onto it.

   The rest of these drill the rule his deck leans on: how many cards may be
   declared against an attack. */
module.exports = [

{
  name: "dominate holds the wall to one card from hand",
  why: "v3.64 — `judge.legal`'s defend branch mentioned dominate NOWHERE AT " +
       "ALL, so at the table any number of cards could be declared against " +
       "it. The trainer's only cap was the dummy's own tuned heuristic. " +
       "Macho Grande reads `tier: full`, so no coverage tool could see it.",
  run(c){
    const atk = c.card("Macho Grande", 3, 60);
    const blk = uid => ({uid, name: "Blocker " + uid, tt: "Guardian Action",
                         pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []});
    const g0 = c.state({res: 9, ap: 1}, {hand: [blk(61), blk(62)], gear: []},
                       {actor: 0, turnPlayer: 0, turn: 3});
    const g = Object.assign({}, g0, {phase: "action", step: "defend", priority: 0,
      passed: [], attacker: 0, stack: [],
      pend: {card: atk, by: 0, target: {kind: "hero"}, total: atk.power || 6,
             ga: false, ops: [], onHit: []}});
    const first = c.reduce(g, {t: "defend", uid: 61}, 1);
    const why = c.J.legal(first, {t: "defend", uid: 62}, 1);
    return {
      "the printed keyword is active": c.P.hasKwNow(atk, "dominate"),
      "one blocker is legal":  c.J.legal(g, {t: "defend", uid: 61}, 1),
      "a second is refused":   /more than 1/.test(String(why)),
      "withdrawing stays legal": c.J.legal(first, {t: "defend", uid: 61}, 1)
    };
  },
  want: {
    "the printed keyword is active": true,
    "one blocker is legal": null,
    "a second is refused": true,
    "withdrawing stays legal": null
  }
},

{
  name: "a plain attack still takes two blockers",
  why: "the control. Without it the scene above passes just as well against " +
       "a judge that refused every second defender in the game.",
  run(c){
    const atk = {uid: 63, name: "Plain Swing", tt: "Guardian Action - Attack",
                 ty: ["Guardian", "Action", "Attack"], pitch: 1, cost: 0,
                 power: 6, def: 2, tx: "", kw: []};
    const blk = uid => ({uid, name: "Blocker " + uid, tt: "Guardian Action",
                         pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []});
    const g0 = c.state({res: 9, ap: 1}, {hand: [blk(64), blk(65)], gear: []},
                       {actor: 0, turnPlayer: 0, turn: 3});
    const g = Object.assign({}, g0, {phase: "action", step: "defend", priority: 0,
      passed: [], attacker: 0, stack: [],
      pend: {card: atk, by: 0, target: {kind: "hero"}, total: 6,
             ga: false, ops: [], onHit: []}});
    const first = c.reduce(g, {t: "defend", uid: 64}, 1);
    const both = c.reduce(first, {t: "defend", uid: 65}, 1);
    return {
      "a second blocker is legal": c.J.legal(first, {t: "defend", uid: 65}, 1),
      "the wall really holds two": (both.sides[1].blockH || []).length,
      "the attack carries no cap": (both.pend || {}).defCap || null
    };
  },
  want: {"a second blocker is legal": null, "the wall really holds two": 2,
         "the attack carries no cap": null}
},

{
  name: "Confidence caps the wall at two NON-BLOCK cards, and equipment counts",
  why: "v3.64 — Full of Bravado reads `tier: full` in lyath's deck and its " +
       "entire payoff is this token, which read `none` and did nothing. " +
       "Block is a TYPE, so a declared piece of equipment is a non-block card.",
  run(c){
    const atk = {uid: 66, name: "Plain Swing", tt: "Guardian Action - Attack",
                 ty: ["Guardian", "Action", "Attack"], pitch: 1, cost: 0,
                 power: 6, def: 2, tx: "", kw: []};
    const blk = c.card("Test of Might", 1, 67);
    const iron = {uid: 68, name: "Iron", tt: "Guardian Equipment - Chest", def: 2, gi: 0};
    const hand = {uid: 69, name: "Hand Card", tt: "Guardian Action",
                  pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []};
    const g0 = c.state({res: 9, ap: 1}, {hand: [hand, blk], gear: [iron]},
                       {actor: 0, turnPlayer: 0, turn: 3});
    const g = Object.assign({}, g0, {phase: "action", step: "defend", priority: 0,
      passed: [], attacker: 0, stack: [],
      pend: {card: atk, by: 0, target: {kind: "hero"}, total: 6, ga: false,
             ops: [], onHit: [], defCap: {n: 1, count: "nonBlock", q: null}}});
    /* the gear fills the cap … */
    const after = c.reduce(g, {t: "defend", uid: 68}, 1);
    return {
      "the fixture really is a Block card": /block/i.test(blk.tt || ""),
      "equipment fills the cap":  /more than 1 non-block/.test(String(c.J.legal(after, {t: "defend", uid: 69}, 1))),
      "a Block card is still declarable": c.J.legal(after, {t: "defend", uid: 67}, 1)
    };
  },
  want: {
    "the fixture really is a Block card": true,
    "equipment fills the cap": true,
    "a Block card is still declarable": null
  }
},

{
  name: "his hero ability turns a face-down card up and rewards CRUSH",
  why: "v3.72 — his deck read 100% and his hero read 0%: `parseHeroPower` " +
       "refused \"turn a face-down card in your arsenal face-up\", so " +
       "`build.js` built him no powCard and neither board could offer it. " +
       "The bonus is gated on the card CARRYING crush, not mentioning it.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "bravo");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.bravo), c.H.db(), {},
                          RNG.make("scene-bravo"), {n: 0}).b;
    const crush = b.deck.find(x => c.P.printedKw(x, "crush"));
    const turn = card => {
      const g = c.state({arsenal: Object.assign({}, card, {uid: 810}), deck: [],
                         res: 9, ap: 1, hand: []}, {},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      return c.exec(g, b.HPOW, "hero", -1);
    };
    const up = turn(crush);
    /* THE STAMPS ARE ONLY REAL IF THEY ARE SPENT. `pend.total` and
       `pend.defCap` are what the chain and both walls are built from. */
    const armed = Object.assign({}, up,
      {sides: up.sides.map((s, i) => i ? s : {...s, ap: 1, res: 9})});
    const swing = c.exec(armed, up.sides[0].arsenal, "arsenal", -1);
    /* Crash and Bash is the one pool card that MENTIONS crush and does not
       carry it — the fixture that tells `printedKw` from `hasKw`. */
    const bait = turn(c.card("Crash and Bash", 1)).sides[0].arsenal;
    return {
      "he has a hero power at all":     !!b.HPOW,
      "the card is turned face up":     up.sides[0].arsenal._faceUp === true,
      "a crush card gains +2 power":    up.sides[0].arsenal._arsPow,
      "…and dominate":                  up.sides[0].arsenal._arsKw,
      "it swings for base + 2":         swing.pend.total - (crush.power || 0),
      "…and the wall is held to one":   swing.pend.defCap,
      "he paid and tapped":             [up.sides[0].res, up.sides[0].heroTapped],
      "a card that only MENTIONS crush gains nothing": bait._arsPow
    };
  },
  want: {
    "he has a hero power at all": true,
    "the card is turned face up": true,
    "a crush card gains +2 power": 2,
    "…and dominate": ["dominate"],
    "it swings for base + 2": 2,
    "…and the wall is held to one": {n: 1, count: "hand"},
    "he paid and tapped": [7, true],
    "a card that only MENTIONS crush gains nothing": undefined
  }
}

];
