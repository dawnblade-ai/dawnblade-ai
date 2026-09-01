/* BOLTYN — the soul, the sword, and a chain that spans three versions.
   His hero ability is still unread (FINISH.md P1); what is drilled here is
   the Sharpen -> Flurry -> extra-swing chain his deck is built around, and
   the prevention his Instant grants. */
module.exports = [

{
  name: "Edict sharpens a sword, and the Flurry token lands",
  why: "v3.66 — Sharpen had a recorded ruling and no reader. The MPW103 " +
       "PRINTING carries the reminder text the database omits, and its " +
       "threshold differs by pitch (1/2/3), so a hardcoded number is right " +
       "for one printing and silently wrong for two.",
  run(c){
    const sword = {uid: 80, name: "Probe Sword", tt: "Warrior Weapon - Sword (2H)",
                   ty: ["Warrior", "Weapon"], kw: [], tx: "", power: 4, def: null,
                   pitch: 0, cost: 0, gi: 0};
    const edict = c.card("Edict of Steel", 1, 81);
    let g = c.acting(c.state({name: "Boltyn", hand: [edict], gear: [sword],
      board: [], counters: {}, res: 9, ap: 3, deck: [{uid: "d1", name: "T"}]},
      {name: "Them", deck: [{uid: "d2", name: "T2"}]},
      {actor: 0, turnPlayer: 0, turn: 4}));
    g = c.reduce(g, {t: "play", uid: 81, from: "hand"}, 0);
    return {
      "the sword takes a +1 power counter": (g.sides[0].counters[80] || {}).pow,
      "a Flurry token is on the board": (g.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
      "the counters are marked to expire": (g.sides[0].gear || []).some(x => x._powEnd === true)
    };
  },
  want: {
    "the sword takes a +1 power counter": 1,
    "a Flurry token is on the board": true,
    "the counters are marked to expire": true
  }
},

{
  name: "the blue Edict prints a threshold of 3, and one counter is not enough",
  why: "the printings genuinely differ. A scene written against the red face " +
       "alone passes with a hardcoded 1 — which is the whole reason to read " +
       "the number off the printed line.",
  run(c){
    const sword = {uid: 82, name: "Probe Sword", tt: "Warrior Weapon - Sword (2H)",
                   ty: ["Warrior", "Weapon"], kw: [], tx: "", power: 4, def: null,
                   pitch: 0, cost: 0, gi: 0};
    const edict = c.card("Edict of Steel", 3, 83);
    let g = c.acting(c.state({name: "Boltyn", hand: [edict], gear: [sword],
      board: [], counters: {}, res: 9, ap: 3, deck: [{uid: "d1", name: "T"}]},
      {name: "Them", deck: [{uid: "d2", name: "T2"}]},
      {actor: 0, turnPlayer: 0, turn: 4}));
    g = c.reduce(g, {t: "play", uid: 83, from: "hand"}, 0);
    return {
      "the counter still lands": (g.sides[0].counters[82] || {}).pow,
      "no token at 1 of 3":      (g.sides[0].board || []).some(b => /flurry/i.test(b.card.name))
    };
  },
  want: {"the counter still lands": 1, "no token at 1 of 3": false}
},

{
  name: "Flurry frees THAT weapon for one more swing",
  why: "v3.65 — the token's trigger names a route the reader could not " +
       "express, so Flurry read `tier: none` and did nothing. Its payload " +
       "turned out to be a mechanic already built: Dorinthea's " +
       "`weaponRefresh`, which lifts the once-per-turn allowance and nothing " +
       "else, so the extra swing still pays its printed cost.",
  run(c){
    const wpn = {uid: 84, name: "Probe Weapon", tt: "Warrior Weapon - Sword (2H)",
                 ty: ["Warrior", "Weapon"], tx: "", kw: [], power: 4, pitch: 0, cost: 0};
    const tok = c.card("Flurry", 0);
    const g = c.state({hand: [], board: [{card: Object.assign({}, tok, {uid: "t1"}),
                                          kind: "aura", uid: "t1"}],
                       res: 9, ap: 1, weaponUsed: {84: true, 85: true}},
                      {hp: 20}, {turn: 3});
    const out = c.exec(Object.assign({}, g, {builds: [{}, {}]}), wpn, "weapon", 0);
    return {
      "the token pops":              (out.sides[0].board || []).length,
      "the swung weapon is freed":   out.sides[0].weaponUsed[84],
      "the OTHER weapon stays spent": out.sides[0].weaponUsed[85]
    };
  },
  want: {"the token pops": 0, "the swung weapon is freed": undefined,
         "the OTHER weapon stays spent": true}
},

{
  name: "Toe the Line prevents damage, and the prevention mints the token",
  why: "v3.67 — plain ward was consumed in ONE place, `index.html`'s " +
       "`takeIt`. judge.js read `.ward` nowhere at all, so five pool cards " +
       "printing a prevention did nothing at the table. The rider cannot be " +
       "a `way:` condition: the prevention happens on a LATER resolution.",
  run(c){
    let g = c.state({res: 9, ap: 1}, {}, {actor: 0, turn: 3});
    g = c.ops(g, [["ward", 2, {ops: [["token", "flurry", 1, "self"]]}]], "Toe the Line");
    const held = (g.sides[0].wardRider || []).length;
    const out = c.J.withEffects(g, (fx, s) => fx.preventDamage(s, 0, 5, "a swing"));
    return {
      "the rider waits with the pool": held,
      "damage that gets through":      out.dealt,
      "damage prevented":              out.prevented,
      "a Flurry token is minted": (out.game.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
      "the rider is spent":            (out.game.sides[0].wardRider || []).length
    };
  },
  want: {"the rider waits with the pool": 1, "damage that gets through": 3,
         "damage prevented": 2, "a Flurry token is minted": true, "the rider is spent": 0}
},

{
  name: "a prevention that prevents nothing triggers nothing",
  why: "CR 7.5.5's shape. With an empty pool no damage is turned aside, so " +
       "the rider must still be waiting — and this runs in the same state as " +
       "the scene above, whose token actually lands, or a negative " +
       "observation passes by finding nothing.",
  run(c){
    const g = c.state({ward: 0, wardRider: [{ops: [["token", "flurry", 1, "self"]]}]},
                      {}, {actor: 0, turn: 3});
    const out = c.J.withEffects(g, (fx, s) => fx.preventDamage(s, 0, 4, "a swing"));
    return {
      "damage that gets through":  out.dealt,
      "a token was minted": (out.game.sides[0].board || []).some(b => /flurry/i.test(b.card.name)),
      "the rider still waits":     (out.game.sides[0].wardRider || []).length
    };
  },
  want: {"damage that gets through": 4, "a token was minted": false, "the rider still waits": 1}
},

{
  name: "his hero ability, both clauses — the soul pays and the buff lands",
  why: "v3.74 — his deck's five soul cards and both hero clauses are one " +
       "mechanic, and the hero read NOTHING: clause 1 had no passive and " +
       "clause 2 was refused on its cost (\"a soul banish nothing builds\", " +
       "recorded in a drill's own assertion text since v3.63).",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "boltyn");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.boltyn), c.H.db(), {},
                          RNG.make("scene-boltyn"), {n: 0}).b;
    /* CLAUSE 1 — two gates, both settled at the WALL. */
    const atkDef = {uid: 610, name: "Attack Blocker", tt: "Generic Action - Attack",
                    ty: ["Generic", "Action", "Attack"], pitch: 1, cost: 1,
                    power: 2, def: 3, tx: "", kw: []};
    const swing = charged => {
      const atk = c.card("Brutal Assault", 1, 600);
      const g = c.state({hand: [atk], res: 9, ap: 1}, {hand: [atkDef], hp: 20},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      if(charged) g.sides[0].hist = {...g.sides[0].hist, charged: 1};
      let n = c.exec(g, atk, "hand", 0);
      n = Object.assign({}, n, {stack: [...n.stack, {k: "def", uid: 610}]});
      return 20 - c.J.withEffects(n, (fx, st) => fx.resolveStack(st)).sides[1].hp;
    };
    /* CLAUSE 2 — the soul as a cost, and the action point it must NOT gain. */
    const atk = c.card("Brutal Assault", 1, 601);
    const soul = [{uid: 700, name: "Soul", tt: "Light Action", pitch: 1, tx: "", kw: []}];
    const g = c.state({hand: [atk], res: 9, ap: 1, soul, buffNext: 2}, {hp: 20},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const before = c.exec(g, atk, "hand", 0);
    const after = c.exec(before, b.HPOW, "hero", 0);
    return {
      "he has a hero power at all":        !!b.HPOW,
      "it is an attack reaction":          c.P.abWindow(b.HPOW),
      "charged, an attack card defends":   swing(true),
      "…and uncharged it is one lower":   swing(false),
      "the soul pays for it":              after.sides[0].soul.length,
      "the attack goes again":             after.pend.ga,
      "and he gains NO action point":      after.sides[0].ap - before.sides[0].ap
    };
  },
  want: {
    "he has a hero power at all": true,
    "it is an attack reaction": "attack-reaction",
    "charged, an attack card defends": 4,
    "…and uncharged it is one lower": 3,
    "the soul pays for it": 0,
    "the attack goes again": true,
    "and he gains NO action point": 0
  }
}

];
