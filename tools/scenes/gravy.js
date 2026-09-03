/* GRAVY BONES — the ability that was INERT, and the drawback that is the
   whole reason watery grave's ruling exists.

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
  name: "the watery-grave cost is a real CHOICE, and it pays only when it lands",
  why: "v3.90 — Jittery Bones read NOTHING and Washed Up Wave read `part`. " +
       "Both print the SAME modal optional cost with different triggers and " +
       "different payloads, so one reader closes both. `fx.optCost` " +
       "describes ONE cost with a zone and a filter and cannot say \"either " +
       "of these two different things\"; reading it as a plain discard " +
       "deletes a printed line of play, because milling is the branch you " +
       "take when your hand holds nothing with the keyword.",
  run(c){
    c.H.db(); c.P.fxReset();
    const jb = c.card("Jittery Bones", 3, 1001);
    const wg = c.card("Barnacle", 0, 1010);
    const plain = c.card("Wounding Blow", 1, 1011);
    const play = (mode, top, hand) => {
      const g = c.state({hand: [jb, ...(hand || [])], res: 9, ap: 1,
                         deck: [top, Object.assign({}, plain, {uid: 1099})]},
                        {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [{}, {}]});
      const out = c.exec(g, jb, "hand", 0, {});
      let n = c.open(out.game || out) || (out.game || out);
      if(!n.prompt) return {err: "no sheet"};
      n = mode === "decline"
        ? c.reduce(n, {t: "promptDecline"}, n.prompt.side)
        : c.reduce(n, {t: "promptChoose", choice: mode}, n.prompt.side);
      n = c.reduce(n, {t: "promptConfirm"}, 0);
      return {ga: !!(n.pend && n.pend.ga), deck: n.sides[0].deck.length,
              grave: n.sides[0].grave.map(x => x.name).join(","),
              gy: (n.sides[0].grave[0] || {})._gy};
    };
    const milled  = play(1, Object.assign({}, wg, {uid: 1020}));
    const missed  = play(1, Object.assign({}, plain, {uid: 1021}));
    const declined = play("decline", Object.assign({}, wg, {uid: 1022}));
    const fromHand = play(0, Object.assign({}, plain, {uid: 1023}),
                          [Object.assign({}, wg, {uid: 1024})]);
    return {
      "what the card asks for":        JSON.stringify(c.P.fxParse(jb).millCost),
      "mill a watery-grave card":      milled.grave,
      "…and it goes again":            milled.ga,
      /* THE GRANT REACHES THE LINK, not just a local (v3.62) — this sheet
         is answered AFTER the attack is already on the chain. */
      "…turn-stamped in the graveyard": milled.gy,
      "mill an ordinary card":         missed.ga,
      /* DECLINING SPENDS NOTHING. A "you may" that cannot be refused is
         stronger than printed — v2.04's free-ability rule, read from the
         other end. */
      "declining leaves the deck alone": declined.deck,
      "…and grants nothing":            declined.ga,
      /* THE DISCARD BRANCH IS A REAL SECOND MODE: the card in HAND was
         spent and the deck is untouched. */
      "discard from hand instead":      fromHand.grave,
      "…deck untouched":                fromHand.deck,
      "…and it goes again":             fromHand.ga
    };
  },
  want: {
    "what the card asks for": "{\"trigger\":\"attacks\",\"kw\":\"watery grave\",\"ops\":[[\"ga\"]]}",
    "mill a watery-grave card": "Barnacle",
    "…and it goes again": true,
    "…turn-stamped in the graveyard": 3,
    "mill an ordinary card": false,
    "declining leaves the deck alone": 2,
    "…and grants nothing": false,
    "discard from hand instead": "Barnacle",
    "…deck untouched": 2,
    "…and it goes again": true
  }
},

{
  name: "his ability costs a Gold — and the Gold really leaves the board",
  why: "v3.86 — `parseHeroPower` refuses any activation cost containing " +
       "\"destroy\" unless it destroys THIS, so `build.js` built him NO " +
       "powCard at all and neither board could offer the ability. His deck " +
       "read in full while his hero did nothing. Measured across all 797 " +
       "records: 39 print a destroy in an activation cost and 38 of them " +
       "destroy the source — his is the only one that names a card " +
       "somewhere else, which is why the shape is NAMED rather than the " +
       "guard widened.",
  run(c){
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "gravy");
    const hd = W.HEROES.find(x => x.k === "dorinthea");
    const ctr = {n: 0};
    let rng = RNG.make("scene-gravy-cost");
    const b0 = B.buildSideDefault(h, G.parseDeck(W.DECKS.gravy), c.H.db(), rng, ctr);
    rng = b0.rng;
    const b1 = B.buildSideDefault(hd, G.parseDeck(W.DECKS.dorinthea), c.H.db(), rng, ctr);
    const g0 = c.J.newMatch({builds: [b0.b, b1.b], names: [h.n, hd.n],
      heroKeys: ["gravy", "dorinthea"], rng: b1.rng, first: 0, tokSeq: ctr.n});
    const gold = Object.assign({}, c.card("Gold", 0), {uid: "tokGOLD"});
    const withGold = Object.assign({}, g0, {turn: 4, sides: g0.sides.map((s, i) =>
      i === 0 ? Object.assign({}, s, {board: [{uid: "tokGOLD", kind: "item",
                                              spent: false, card: gold}]}) : s)});
    /* WITH NO GOLD IT IS REFUSED, and refused BEFORE he taps — a cost is a
       legality (v3.11), or the player pays for a play the rules never
       allowed. */
    const broke = c.J.legal(g0, {t: "activate", from: "hero", uid: "hpow"}, 0);
    const hand0 = withGold.sides[0].hand.length;
    const n = c.reduce(withGold, {t: "activate", from: "hero", uid: "hpow"}, 0);
    const gv = n.sides[0].grave;
    return {
      "the cost names the card it destroys": c.P.abDestroyBoard(b0.b.HPOW),
      "with no Gold it is refused":          /Gold/.test(String(broke || "")),
      "…and asking does not tap him":        g0.sides[0].heroTapped,
      "the Gold leaves the arena":           (n.sides[0].board || []).length,
      "…for the GRAVEYARD, turn-stamped":    (gv.find(x => x.name === "Gold") || {})._gy,
      "he drew one and discarded one":       n.sides[0].hand.length - hand0,
      "the {t} is charged":                  n.sides[0].heroTapped,
      /* AN INSTANT COSTS NO ACTION POINT (CR 8.1.6). */
      "action points spent":                 withGold.sides[0].ap - n.sides[0].ap,
      /* THE COST IS PAID FIRST. Every path in UNSHIFTS, so the card filed
         first sits deepest — cost-first puts the Gold under the discard. */
      "the Gold went in BEFORE the discard": gv.length - 1 - gv.findIndex(x => x.name === "Gold"),
      "the board is clean":                  require("../../engine/invariants.js").errors(n).length
    };
  },
  want: {
    "the cost names the card it destroys": "Gold",
    "with no Gold it is refused": true,
    "…and asking does not tap him": false,
    "the Gold leaves the arena": 0,
    "…for the GRAVEYARD, turn-stamped": 4,
    "he drew one and discarded one": 0,
    "the {t} is charged": true,
    "action points spent": 0,
    "the Gold went in BEFORE the discard": 0,
    "the board is clean": 0
  }
},

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
},

{
  name: "the two Loot cards grant a TWO-SENTENCE ability, and the second is a gate",
  why: "v3.95 — v3.45 built the rider-only grant reader and recorded why " +
       "these two still refused: handed both sentences at once, " +
       "`classifyClause` reads ONE and drops the other INCONSISTENTLY — " +
       "Loot the Hold gave the discard and lost the Gold, Loot the " +
       "Arsenal gave the GOLD and lost the destroy it is printed to pay " +
       "for, which is the reward without the cost. Claiming half is worse " +
       "than claiming nothing (v2.29). The sentences are split now and " +
       "the second rides as `way:took`, because an empty hand discards " +
       "nothing and an empty arsenal destroys nothing — the rider is the " +
       "whole difference.",
  run(c){
    const P = require("../../engine/parser.js");
    const junk = (nm, uid) => ({name: nm, uid, pitch: 1, cost: 0, power: 3,
      tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []});
    const play = (nm, foe) => {
      P.fxReset();
      const loot = Object.assign(c.card(nm, 3), {uid: "loot1"});
      const ally = Object.assign(c.card("Swabbie", 2), {uid: "ally1"});
      const g = Object.assign(c.state(
        {name: "Alice", hand: [loot], res: 9, ap: 2,
         board: [{uid: "ally1", kind: "ally", spent: false, card: ally}]},
        Object.assign({name: "Bob", hp: 20}, foe), {turn: 3, turnPlayer: 0}),
        {phase: "action", step: "layer"});
      g.builds = [{}, {}];
      const o1 = c.exec(g, loot, "hand", 0, {});
      const n1 = o1.game || o1;
      const entry = n1.sides[0].board.find(b => b.uid === "ally1");
      const o2 = c.exec(Object.assign({}, n1, {promptQ: [], prompt: null}), entry.card, "ally", 0, {});
      const n2 = o2.game || o2;
      if(!n2.pend) return {gold: -1, played: n1};
      const r = c.J.withEffects(n2, (fx, m) => {
        const x = fx.linkPayload(m, {total: m.pend.total, pumps: 0, heroHit: true});
        return x.game || x;
      });
      const out = r.game || r;
      return {gold: (out.sides[0].board || []).filter(b => b.card.name === "Gold").length,
              foeHand: (out.sides[1].hand || []).length,
              foeArs: out.sides[1].arsenal ? 1 : 0,
              played: n1};
    };
    const holdFull = play("Loot the Hold", {hand: [junk("Junk", "j1")]});
    const holdNone = play("Loot the Hold", {hand: []});
    const arsFull  = play("Loot the Arsenal", {arsenal: junk("Set", "s1")});
    const arsNone  = play("Loot the Arsenal", {arsenal: null});
    return {
      "a hand to take from pays the Gold":       holdFull.gold,
      "…and they really did discard":            holdFull.foeHand,
      "an EMPTY hand pays nothing":              holdNone.gold,
      "an arsenal to take pays the Gold":        arsFull.gold,
      "…and it really was destroyed":            arsFull.foeArs,
      "an EMPTY arsenal pays nothing":           arsNone.gold,
      "and NOTHING fires when the card is played": (holdFull.played.sides[1].hand || []).length
    };
  },
  want: {
    "a hand to take from pays the Gold": 1,
    "…and they really did discard": 0,
    "an EMPTY hand pays nothing": 0,
    "an arsenal to take pays the Gold": 1,
    "…and it really was destroyed": 0,
    "an EMPTY arsenal pays nothing": 0,
    "and NOTHING fires when the card is played": 1
  }
}

];
