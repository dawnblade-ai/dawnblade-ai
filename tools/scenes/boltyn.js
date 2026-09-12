/* BOLTYN — the soul, the sword, and a chain that spans three versions.
   His hero ability is still unread (FINISH.md P1); what is drilled here is
   the Sharpen -> Flurry -> extra-swing chain his deck is built around, and
   the prevention his Instant grants. */
module.exports = [

{
  name: "charging Banneret arms its delayed grant, and the next hit pays it",
  why: "v4.21 refused this card's line and RECORDED what it was waiting on — " +
       "\"the TRIGGER and the SCHEDULE, not the payload\". A recorded refusal " +
       "is a debt (v3.38) and v4.41 discharges it: `onChargeSoul` is " +
       "`boostBanish`'s shape one cost over (v3.56) and `hitNext` is the " +
       "delay. Before that the card read `tier: none` and did nothing at all; " +
       "before v4.21 it granted the 1{h} unconditionally ON PLAY.",
  run(c){
    const bann = c.card("Banneret of Salvation", 2, 80);
    const bolt = c.card("Bolt of Courage", 1, 81);
    /* Bolt of Courage prints "as an additional cost to play this, you MAY
       charge your hero's soul" — so the charge is a real OFFER (v4.33) and
       the scene has to ANSWER it rather than assuming it was taken.

       AND BOLT IS ITSELF AN ATTACK, which is what makes this fixture the
       whole route in one play: it charges Banneret as its own cost, and
       its own swing is then the "next time you hit". The first draft of
       this scene passed to resolution BEFORE reading the state and then
       reported the payout as "life gained at the moment of charging" —
       check your own fixture (v3.70), and read the board at the moment
       you mean to. */
    let g = c.acting(c.state({res: 9, ap: 3, hp: 18, hand: [bolt, bann]},
      {hp: 20, hand: [], gear: []}, {actor: 0, turnPlayer: 0, turn: 3, seed: "bann"}));
    g = Object.assign({}, g, {builds: [{}, {}]});
    g = c.reduce(g, {t: "play", uid: 81, from: "hand"}, 0);
    const offered = !!(g.pending && g.pending.kind === "charge");
    if(offered) g = c.reduce(g, {t: "charge", uid: 80}, 0);
    const inSoul  = g.sides[0].soul.some(x => x && x.uid === 80);
    const armed   = (g.sides[0].hitNext || []).length;
    const hpArmed = g.sides[0].hp;

    /* THE HIT. Banneret prints a BARE "the next time you hit" — no hero
       gate — so the connecting swing is what pays it. */
    g = c.passTo(g, "resolution");

    return {
      "the charge was OFFERED": offered ? 1 : 0,
      "Banneret reached the soul": inSoul ? 1 : 0,
      "delayed grants armed": armed,
      "life gained at the moment of charging": hpArmed - 18,
      "life gained when the swing HITS": g.sides[0].hp - hpArmed,
      "and the grant is spent": (g.sides[0].hitNext || []).length
    };
  },
  want: {
    "the charge was OFFERED": 1,
    "Banneret reached the soul": 1,
    "delayed grants armed": 1,
    /* NOTHING on the charge itself — that is v3.07's suspense bug, and
       exactly what this card did before v4.21 refused the line. */
    "life gained at the moment of charging": 0,
    "life gained when the swing HITS": 1,
    "and the grant is spent": 0
  }
},

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
,

{
  name: "Radiant Touch banishes itself, and the prevention lands",
  why: "v3.79 — it read tier `none` and BOTH halves already existed: the " +
       "`ward 2` payload since v3.67, the soul cost since v3.74. All that " +
       "refused was the cost prefix, because the anchor demanded the soul " +
       "be the WHOLE cost and the card prints \"banish THIS AND a card " +
       "from your soul\". The self-banish is the drawback and it has to " +
       "land: a prevention pool you can raise every turn for one soul " +
       "card is a different card.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const E = require("../../engine/effects.js");
    const RNG = require("../../engine/rng.js");
    const P = require("../../engine/parser.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const db = c.H.db();
    const h = W.HEROES.find(x => x.k === "boltyn");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.boltyn), db, {},
                          RNG.make("scene-rt"), {n: 0}).b;
    const rt = b.gear.find(g => /Radiant Touch/.test(g.name));
    const soul = {name: "Soul Card", uid: 700, pitch: 1, tt: "Generic Action",
                  ty: ["Generic", "Action"], kw: [], tx: ""};
    const fire = souls => {
      const g = c.state({gear: [rt], res: 9, ap: 1, hand: [], soul: souls},
                        {hp: 20, hand: []},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      const n = c.H.execute(g, rt.powCard, "hero", 0, {});
      return {n, end: E.beginEndPhase(n, 0, db).game};
    };
    const paid = fire([soul]);
    const broke = fire([]);
    return {
      "the cost it reads":            P.abSoulCost(rt.powCard) + " soul, self-banish "
                                       + P.abSelfBanish(rt.powCard),
      "prevention raised":            paid.n.sides[0].ward,
      "soul spent":                   paid.n.sides[0].soul.length,
      "the piece leaves the gear zone": !paid.end.sides[0].gear.some(x => x.uid === rt.uid),
      "…to BANISH, not the graveyard": (paid.end.sides[0].banish || [])
                                         .some(x => x.uid === rt.uid),
      "with an EMPTY soul it is inert": broke.n.sides[0].ward || 0,
      "…and the piece is NOT spent":  broke.n.sides[0].gear.some(x => x.uid === rt.uid)
    };
  },
  want: {
    "the cost it reads": "1 soul, self-banish true",
    "prevention raised": 2,
    "soul spent": 0,
    "the piece leaves the gear zone": true,
    "…to BANISH, not the graveyard": true,
    "with an EMPTY soul it is inert": 0,
    "…and the piece is NOT spent": true
  }
}
,

{
  name: "the Halo puts a card in the soul, and draws only for Light",
  why: "v4.01 — the ability had NO ROUTE: `parseHeroPower` refuses a line " +
       "whose payload has no reader, so build.js built the piece no " +
       "powCard and neither board could offer it. `moveCards` has routed " +
       "a pick to the soul since prompts.js was written — v3.47's shape, " +
       "third outing: reading the PAYLOAD is what creates the route. And " +
       "\"it\" is the card that was PUT, never the equipment (v2.33, " +
       "v3.47, v3.92 — fourth time), so the rider rides on the pick.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "boltyn");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.boltyn), c.H.db(), {},
                          RNG.make("scene-halo"), {n: 0}).b;
    const halo = b.gear.find(g => g.name === "Halo of Illumination");
    const put = (cls) => {
      const card = {name: cls + " Card", uid: "h1", pitch: 1, cost: 0,
        tt: cls + " Action", ty: [cls, "Action"], tx: "", kw: [], gkw: []};
      const top = {name: "Drawn", uid: "h2", pitch: 1, cost: 0, tt: "Generic Action",
                   ty: ["Generic", "Action"], tx: "", kw: [], gkw: []};
      let g = c.acting(Object.assign(
        c.state({name: "Boltyn", res: 9, ap: 1, hand: [card], deck: [top], soul: []},
                {name: "Bob", hp: 20}, {turn: 3}), {builds: [b, {}]}));
      g = c.ops(g, [["pickPrompt", {zone: "hand", to: "soul", min: 1, max: 1,
                                    classRider: {cls: "light", ops: [["draw", 1]]}}]],
                "Halo of Illumination");
      g = c.open(g.game || g);
      g = c.answer(g, 0);
      return {soul: g.sides[0].soul.length, hand: g.sides[0].hand.map(x => x.name).join(",")};
    };
    const light = put("Light"), plain = put("Generic");
    return {
      "the ability is built at all":        !!(halo && halo.powCard),
      "a Light card reaches the soul":      light.soul,
      "…and the rider draws":               light.hand,
      "a non-Light card reaches it too":    plain.soul,
      "…and draws nothing — only the DRAW is gated": plain.hand
    };
  },
  want: {
    "the ability is built at all": true,
    "a Light card reaches the soul": 1,
    "…and the rider draws": "Drawn",
    "a non-Light card reaches it too": 1,
    "…and draws nothing — only the DRAW is gated": ""
  }
}
,

{
  name: "charge is OFFERED now, and declining charges nothing",
  why: "\"As an additional cost to play this, YOU MAY charge your hero's " +
       "soul\" — and `execute` used to auto-pick from hand whenever the hand " +
       "was non-empty, so the printed choice was never offered and a card " +
       "left the hand on the engine's judgement. Upstream's own keyword.csv " +
       "spells the refusal out: \"You may elect to not pay the additional " +
       "cost of charge - however this would mean you did not charge.\" The " +
       "block's stated reason - \"the trainer has no prompt wired for a cost " +
       "paid before the card's own total is struck\" - stopped being true at " +
       "v4.27, which built exactly that for fusion. Bolt of Courage is the " +
       "sharpest: charged, it gets \"when this hits, draw a card\", so a " +
       "blocked swing paid a card for nothing. It is a COST, so being unable " +
       "to refuse is WEAKER than printed - the one-sided sweep is blind, and " +
       "all nine records read `tier: full` throughout (v4.33).",
  run(c){
    const swing = answer => {
      const atk   = c.card("Bolt of Courage", 1, "ch");
      const spare = c.card("Bolt of Courage", 3, "sp");
      let g = c.acting(c.state({name: "Boltyn", hand: [atk, spare], res: 9, ap: 3},
                               {name: "Them", hp: 20}, {turn: 3}));
      let n = c.reduce(g, {t: "play", uid: "ch", from: "hand"}, 0);
      const asked = !!(n.pending && n.pending.kind === "charge");
      if(asked) n = c.reduce(n, {t: "charge", uid: answer}, 0);
      for(let i = 0; i < 4 && n.pending; i++){
        const k = n.pending.kind;
        n = c.reduce(n, k === "boost" || k === "addPay" ? {t: k, yes: false}
                      : k === "fuse" ? {t: "fuse", uid: null}
                      : {t: "payConfirm"}, n.pending.seat);
      }
      return {asked, n};
    };
    const took = swing("sp"), declined = swing(null);
    return {
      "the offer is made at all":              took.asked,
      "taking it puts the CHOSEN card in the soul": took.n.sides[0].soul.map(x => x.uid).join(","),
      "…and hist.charged records it":          took.n.sides[0].hist.charged,
      "declining leaves the soul empty":       declined.n.sides[0].soul.length,
      "…and the card is still in hand":        declined.n.sides[0].hand.map(x => x.uid).join(","),
      "…and nothing was charged":              !declined.n.sides[0].hist.charged
    };
  },
  want: {
    "the offer is made at all": true,
    "taking it puts the CHOSEN card in the soul": "sp",
    "…and hist.charged records it": 1,
    "declining leaves the soul empty": 0,
    "…and the card is still in hand": "sp",
    "…and nothing was charged": true
  }
}

];
