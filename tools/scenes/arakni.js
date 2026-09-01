/* ARAKNI — the Assassin, and the three activated ABILITIES that were being
   offered in the wrong window. His hero ability is still unread (FINISH.md
   P1); what is drilled here is the equipment route his deck is built on. */
const B = require("../../engine/build.js");

/* Build a piece's ability the way `build.js` does, so a scene exercises the
   real powCard rather than a hand-written stand-in. */
function ability(P, piece, uid){
  const pw = P.parseHeroPower(piece.tx || "", true);
  if(!pw) return null;
  const line = (piece.tx || "").split(/\n+/).map(l => P.clean(l))
    .find(l => /^(?:once per turn )?(?:attack reaction|action|instant)\s*[-—]/i.test(l)) || "";
  return {name: piece.name + " — ability", pitch: 0, cost: pw.cost, power: null, def: null,
          tt: "Equipment Ability", kw: pw.ga ? ["Go again"] : [],
          tx: line.replace(/^[^:]*:\s*/, "") || pw.eff, sd: pw.sd,
          _instant: pw.kind === "instant", _attackRx: pw.kind === "attackRx",
          uid: "gp" + uid};
}

module.exports = [

{
  name: "an attack reaction is refused in the action phase",
  why: "v3.63 — `parseHeroPower`'s match was unanchored and \"REACTION\" " +
       "contains \"ACTION\", so Prey Spotters, Stalker's Steps and Danger " +
       "Digits were BUILT as action-speed abilities and offered in the action " +
       "phase. Sev-3 illegal-play-allowed, live, in a card reporting `full`.",
  run(c){
    const piece = c.card("Prey Spotters", 0, 70);
    const ab = ability(c.P, piece, 70);
    const gr = Object.assign({}, piece, {uid: 70, pow: true, powCard: ab, gi: 0});
    const g0 = c.state({res: 9, ap: 1, gear: [gr]}, {}, {actor: 0, turnPlayer: 0, turn: 3});
    const inAction = Object.assign({}, g0, {phase: "action", step: "layer",
      priority: 0, passed: [], pend: null});
    const why = c.J.legal(inAction, {t: "activate", uid: 70, from: "gear"}, 0);
    return {
      "it is built for the reaction window": ab ? ab._attackRx : null,
      "the action phase refuses it":         /attack-reaction/.test(String(why))
    };
  },
  want: {"it is built for the reaction window": true, "the action phase refuses it": true}
},

{
  name: "…and its printed target is checked BEFORE the piece is destroyed",
  why: "v3.11's rule one route over. Stalker's Steps targets \"attack with " +
       "stealth\"; refusing after the piece is destroyed to pay for it costs " +
       "the player the piece for a play the rules never allowed.",
  run(c){
    const piece = c.card("Stalker's Steps", 0, 71);
    const ab = ability(c.P, piece, 71);
    const gr = Object.assign({}, piece, {uid: 71, pow: true, powCard: ab, gi: 0});
    const plain = {uid: 72, name: "Plain Swing", tt: "Assassin Action - Attack",
                   ty: ["Assassin", "Action", "Attack"], pitch: 1, cost: 0,
                   power: 4, def: 2, tx: "", kw: []};
    const g0 = c.state({res: 9, ap: 1, gear: [gr]}, {}, {actor: 0, turnPlayer: 0, turn: 3});
    const g = Object.assign({}, g0, {phase: "action", step: "reaction", priority: 0,
      passed: [], attacker: 0, stack: [],
      pend: {card: plain, by: 0, total: 4, ga: false, ops: [], onHit: []}});
    const why = c.J.legal(g, {t: "activate", uid: 71, from: "gear"}, 0);
    return {
      "the fixture prints no stealth": c.P.printedKw(plain, "stealth"),
      "the ability is refused":        /isn't one/.test(String(why)),
      "the piece survives the refusal": g.sides[0].gear[0].destroyed !== true
    };
  },
  want: {"the fixture prints no stealth": false, "the ability is refused": true,
         "the piece survives the refusal": true}
},

{
  name: "…and it resolves onto the open link when the target IS legal",
  why: "the control. A gate that refuses everything passes the two scenes " +
       "above perfectly — and go again is a GAIN, so `pend.ga` is what to " +
       "observe rather than a feed line.",
  run(c){
    const piece = c.card("Stalker's Steps", 0, 73);
    const ab = ability(c.P, piece, 73);
    const pool = require("../../data/pool.json");
    const rec = pool.find(r => c.P.isAttack({tt: r.type_text || "", ty: r.types || [], power: r.power})
      && c.P.printedKw({tx: r.functional_text || "", kw: r.card_keywords || []}, "stealth"));
    const stealthy = c.card(rec.name, rec.pitch, 74);
    const g0 = c.state({res: 9, ap: 1}, {}, {actor: 0, turnPlayer: 0, turn: 3});
    const g = Object.assign({}, g0, {stack: [],
      pend: {card: stealthy, by: 0, total: stealthy.power || 3, ga: false,
             ops: [], onHit: [], onHitHero: [], condOnHit: []}});
    const out = c.exec(g, ab, "hero", 0);
    return {
      "the fixture prints stealth": c.P.printedKw(stealthy, "stealth"),
      "the attack goes again":      !!out.pend.ga
    };
  },
  want: {"the fixture prints stealth": true, "the attack goes again": true}
},

{
  name: "Danger Digits has no route at all, and that is the honest state",
  why: "v3.63 — its payload names a SUBJECT (\"target dagger you control that " +
       "isn't on the active chain link\") that the unanchored `dmg` matcher " +
       "dropped along with the printed \"Destroy the dagger\". A drawback " +
       "silently deleted, so it must refuse rather than half-read.",
  run(c){
    const piece = c.card("Danger Digits", 0, 75);
    return {
      "an ability is parsed": c.P.parseHeroPower(piece.tx || "", true) !== null,
      "the damage clause reads": c.P.classifyClause(
        "target dagger you control that isn't on the active chain link deals 1 damage to the defending hero") !== null
    };
  },
  want: {"an ability is parsed": false, "the damage clause reads": false}
},

{
  name: "a stealth attack on a MARKED hero hits harder and goes again",
  why: "v3.75 — her hero read nothing at all, and stealth+marked is the " +
       "whole deck: 18 pool cards print stealth and Mark of the Huntsman " +
       "destroys itself to put the mark on. Three gates, and `printedKw` " +
       "rather than `hasKw` because seven pool cards NAME stealth without " +
       "carrying it.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "arakni");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.arakni), c.H.db(), {},
                          RNG.make("scene-arakni"), {n: 0}).b;
    const stealthy = b.deck.find(x => c.P.printedKw(x, "stealth") && c.P.isAttack(x));
    const plain    = b.deck.find(x => !c.P.printedKw(x, "stealth") && c.P.isAttack(x));
    const swing = (card, marked, wallDef) => {
      const atk = Object.assign({}, card, {uid: 600});
      const wall = wallDef ? {uid: 610, name: "Wall", tt: "Generic Action", pitch: 1,
                              cost: 1, power: 0, def: wallDef, tx: "", kw: []} : null;
      let g = c.state({hand: [atk], res: 9, ap: 1},
                      {hp: 20, marked: marked ? 1 : 0, hand: wall ? [wall] : []},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      let n = c.exec(g, atk, "hand", 0);
      if(wall) n = Object.assign({}, n, {stack: [...n.stack, {k: "def", uid: 610}]});
      return c.J.withEffects(n, (fx, st) => fx.resolveStack(st));
    };
    const base = stealthy.power || 0;
    return {
      "she has the passive at all":       b.stealthMarkedBuff,
      "stealth into a marked hero":       20 - swing(stealthy, true, 0).sides[1].hp,
      "…and unmarked it is one lower":    20 - swing(stealthy, false, 0).sides[1].hp,
      "a non-stealth attack gets nothing": 20 - swing(plain, true, 0).sides[1].hp === (plain.power || 0),
      "the hit keeps her action point":   swing(stealthy, true, 0).sides[0].ap,
      "…and a full block does not":       swing(stealthy, true, 9).sides[0].ap
    };
  },
  want: {
    "she has the passive at all": 1,
    "stealth into a marked hero": 4,
    "…and unmarked it is one lower": 3,
    "a non-stealth attack gets nothing": true,
    "the hit keeps her action point": 1,
    "…and a full block does not": 0
  }
}

];
