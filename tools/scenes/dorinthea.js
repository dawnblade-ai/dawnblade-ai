/* DORINTHEA — "The first time your weapon attack hits each turn, you may
   attack an additional time with that weapon this turn."

   The most heavily drilled hero in the project (50 drills) and the one
   with no scene, which is the gap this closes: every one of those drills
   asks about a clause or a state, and none of them plays a turn. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
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
  name: "a weapon that HITS is freed for one more swing — and only once",
  why: "v3.45's rule and v2.46's, meeting. The refresh is gated on the hit " +
       "(CR 7.5.5 — prevented is not dealt, so a swing blocked to nothing " +
       "is not a hit) and the allowance is spent by TRIGGERING rather than " +
       "by being used, which is exactly why the Dawnblade is printed to " +
       "reward its SECOND hit each turn and not its third.",
  run(c){
    const b = built(c, "dorinthea");
    const blade = Object.assign({}, b.gear.find(g => /Dawnblade/.test(g.name)), {uid: 950});
    const swing = wall => {
      const g = c.state({gear: [blade], res: 9, ap: 1, hand: []},
                        {hp: 20, hand: wall ? [wall] : []},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      let n = c.H.execute(g, blade, "weapon", 0, {});
      if(wall) n = Object.assign({}, n, {stack: [...n.stack, {k: "def", uid: wall.uid}]});
      const out = c.J.withEffects(n, (fx, s) => fx.resolveStack(s));
      return {used: Object.keys(out.sides[0].weaponUsed || {}).length,
              again: !!(out.sides[0].hist || {}).wpnAgain,
              dealt: 20 - out.sides[1].hp};
    };
    const hit = swing(null);
    const blocked = swing({uid: 960, name: "Wall", tt: "Generic Action",
                           ty: ["Generic", "Action"], pitch: 1, cost: 1,
                           power: 0, def: 9, tx: "", kw: []});
    return {
      "it hits, and the allowance is lifted": hit.again,
      "…so the weapon is free to swing again": hit.used,
      "a swing blocked to nothing deals":      blocked.dealt,
      "…and frees nothing (CR 7.5.5)":         blocked.again
    };
  },
  want: {
    "it hits, and the allowance is lifted": true,
    "…so the weapon is free to swing again": 0,
    "a swing blocked to nothing deals": 0,
    "…and frees nothing (CR 7.5.5)": false
  }
},

{
  name: "Refraction Bolters buys go again with the iron itself",
  why: "v3.93 — it read `part` and did NOTHING on either board, while its " +
       "sibling Beaten Trackers printed the identical cost and fired " +
       "through an INLINE REGEX in effects.js (v3.58's 'a card handled " +
       "outside the parser is a card special-cased'). And the timing is " +
       "the interesting half: `linkPayload` spends the layer's action " +
       "point on its last line, `openPrompt` drains at the tail of the " +
       "CALLER — so the grant can never be 'kept'. CR 5.3.5 makes go " +
       "again a GAIN of one action point, so the point IS the grant, and " +
       "the queue site says the layer has settled rather than the " +
       "consumer inferring it from board state (the two boards clear " +
       "`pend` at different moments — v3.01's shape).",
  run(c){
    const rb = Object.assign(c.card("Refraction Bolters", 0), {uid: "g9"});
    const blade = {uid: 50, name: "Test Blade", cost: 0, power: 4,
      tt: "Generic Weapon - Sword (1H)", ty: ["Generic", "Weapon"], tx: "", kw: [], gkw: []};
    const swing = total => {
      const g = Object.assign(c.state({gear: [Object.assign({}, rb)], res: 5, ap: 1},
                                      {hp: 20}, {turn: 3, turnPlayer: 0}), {phase: "action"});
      return c.J.withEffects(g, (fx, n) => {
        n = Object.assign({}, n, {chain: [], stack: [],
          pend: {card: blade, from: "weapon", total, ops: [], onHit: [], onHitHero: [],
                 ga: false, by: 0, lateConds: []}});
        const r = fx.linkPayload(n, {total, pumps: 0, heroHit: total > 0});
        return r.game || r;
      });
    };
    const hit = swing(4), blocked = swing(0);
    const open = c.J.openPrompt(hit);
    const pay = g => {
      const out = c.J.withEffects(g, (fx, n) => fx.applyAnswer(n, c.PM.promptChoose(n.prompt, "pay")));
      return out.game || out;
    };
    const no = g => {
      const out = c.J.withEffects(g, (fx, n) => fx.applyAnswer(n, c.PM.promptChoose(n.prompt, "decline")));
      return out.game || out;
    };
    const paid = pay(open), declined = no(open);
    return {
      "a weapon attack that HITS offers the piece": (hit.promptQ || []).length,
      "a swing blocked to nothing offers nothing":  (blocked.promptQ || []).length,
      "the point is already spent when it opens":   hit.sides[0].ap,
      "paying hands the action point back":         paid.sides[0].ap,
      "…and the chain link is marked go again":     paid.chain.map(l => l.ga),
      "…and the iron is destroyed":                 !!paid.sides[0].gear[0].destroyed,
      "nothing leaks onto the next attack":         paid._gaGrant === undefined,
      "declining keeps the iron":                   !!declined.sides[0].gear[0].destroyed,
      "…and the point stays spent":                 declined.sides[0].ap
    };
  },
  want: {
    "a weapon attack that HITS offers the piece": 1,
    "a swing blocked to nothing offers nothing": 0,
    "the point is already spent when it opens": 0,
    "paying hands the action point back": 1,
    "…and the chain link is marked go again": [true],
    "…and the iron is destroyed": true,
    "nothing leaks onto the next attack": true,
    "declining keeps the iron": false,
    "…and the point stays spent": 0
  }
},

{
  name: "Oasis Respite pays her back when she is behind — a line that read nothing",
  why: "\"Prevent the next 4 damage that would be dealt to TARGET HERO " +
       "this turn by a source of your choice. If THEY have less {h} than " +
       "each other hero, THEY may gain 1{h}.\" The second sentence has " +
       "read nothing since the card was dealt, in three decks — hers, " +
       "Enigma's and Lyath's — and it could not be fixed at clause level: " +
       "in `classifyClause` \"they\" means the OPPONENT everywhere else " +
       "(\"they discard a card\", \"they lose N{h}\"), so read there the " +
       "card pays the player who is AHEAD. The head sentence is what says " +
       "who \"they\" is, so it is a whole-card fold — v2.33's Bull's Eye " +
       "Bracers trap, seventh outing (v4.36).",
  run(c){
    const oa = c.card("Oasis Respite", 1, "o1");
    const play = (mine, theirs) => c.exec(
      c.state({hand: [oa], res: 9, ap: 1, hp: mine}, {hp: theirs}, {turn: 4}),
      oa, "hand", 0, {});
    const behind = play(14, 20), ahead = play(20, 14), level = play(17, 17);
    return {
      "behind on life, she gains 1":            behind.sides[0].hp,
      "…and the opponent gains nothing":        behind.sides[1].hp,
      "…and the prevention still lands":        behind.sides[0].ward,
      "…carrying its printed \"this turn\"":     behind.sides[0].wardTurn,
      "ahead on life, nothing happens":         ahead.sides[0].hp,
      "and LEVEL is not behind — the test is strict": level.sides[0].hp
    };
  },
  want: {
    "behind on life, she gains 1": 15,
    "…and the opponent gains nothing": 20,
    "…and the prevention still lands": 4,
    "…carrying its printed \"this turn\"": 4,
    "ahead on life, nothing happens": 20,
    "and LEVEL is not behind — the test is strict": 17
  }
}
,

{
  name: "Wreck Havoc turns their arsenal over, and takes only what it names",
  why: "v4.62 — the pool's LAST `part` deck card. Its clause 2 refused " +
       "entirely, and the diagnostic that found the gap is this project's " +
       "cheapest run from the head end (v3.79, v4.43): hand the same " +
       "trigger a payload that already has a reader and it parses in full, " +
       "hero gate and all. So the trigger and the printed \"you may\" were " +
       "never the blocker and BOTH halves of the payload were. Neither " +
       "needed new machinery — `faceUpArsenal` has turned an arsenal card " +
       "and fired its triggers since v3.71 and `foeArsDestroy` has emptied " +
       "the other seat's arsenal since v3.96 — so what is new is the SEAT " +
       "(the turn is the opponent's, so the actor is borrowed and handed " +
       "back), the printed TYPE filter, and the OFFER, which v4.61 made " +
       "possible by giving the optional modal a Decline control. " +
       "THE ROW THAT BITES IS THE NON-MATCHING CARD: a reader that " +
       "ignored the printed type destroys it too, and the two readings " +
       "agree on every Defense Reaction in the pool (v3.26, v3.98).",
  run(c){
    const dr    = c.card("Sigil of Suffering", 1, 901);
    const other = c.card("Spire Sniping", 2, 902);
    const play = ars => {
      const g = c.state({name: "Dorinthea", res: 9, ap: 9, deck: [{uid: 940, name: "F"}]},
                        {name: "Them", hp: 20, arsenal: ars ? Object.assign({}, ars) : null,
                         deck: [{uid: 941, name: "T"}, {uid: 942, name: "T2"}]},
                        {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
      /* the payload rides on `fx.onHitHero`, so drive `runOps` at the op the
         parse actually emits rather than re-deriving it here */
      const fx = c.P.fxParse(c.card("Wreck Havoc", 3));
      return c.ops(g, fx.onHitHero, "Wreck Havoc");
    };
    /* THE OFFER IS A SHEET, so each row answers it the way a player would. */
    const take = g => g.prompt ? c.reduce(c.reduce(g, {t: "promptChoose", choice: 0}, g.prompt.side),
                                          {t: "promptConfirm"}, g.prompt.side) : g;
    const drOut    = take(c.open(play(dr)));
    const otherOut = take(c.open(play(other)));
    const emptyOut = take(c.open(play(null)));
    return {
      "a defence reaction is destroyed":        drOut.sides[1].arsenal,
      "…into THEIR graveyard, not banished":    drOut.sides[1].grave.map(x => x.name).join(","),
      "anything else is turned up and lives":   otherOut.sides[1].arsenal
                                                  ? otherOut.sides[1].arsenal.name : null,
      "…face up, so both players can see it":   !!(otherOut.sides[1].arsenal || {})._faceUp,
      "…and nothing reaches the graveyard":     otherOut.sides[1].grave.length,
      "an empty arsenal offers nothing at all": !!emptyOut.prompt
    };
  },
  want: {
    "a defence reaction is destroyed": null,
    "…into THEIR graveyard, not banished": "Sigil of Suffering",
    "anything else is turned up and lives": "Spire Sniping",
    "…face up, so both players can see it": true,
    "…and nothing reaches the graveyard": 0,
    "an empty arsenal offers nothing at all": false
  }
}
];
