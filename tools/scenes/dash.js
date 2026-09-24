/* DASH — "You may start the game with a Mechanologist item with cost 2 or
   less in the arena."

   A PREGAME choice, and the one hero passive that changes the opening
   board rather than a rule. Her deck is the steam engine underneath it. */
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
  name: "she opens with an item, and it LEAVES the deck",
  why: "A start-of-game permanent is the one passive that changes the " +
       "opening board. The card must be SPLICED out of the deck as well " +
       "as placed — left in both it is a card in two zones, which is the " +
       "`CARD-IN-TWO-ZONES` the invariant judge exists for.",
  run(c){
    const b = built(c, "dash");
    const it = b.startItem;
    const dupes = it ? b.deck.filter(x => x.uid === it.uid).length : -1;
    return {
      "she starts with something":  !!it,
      "…and it is an Item":         !!(it && /\bitem\b/i.test(it.card.tt || "")),
      "…costing 2 or less":         !!(it && (it.card.cost || 0) <= 2),
      "…and it is not ALSO in the deck": dupes,
      "no other hero starts with one":
        ["kayo", "bravo", "briar"].every(k => !built(c, k).startItem)
    };
  },
  want: {
    "she starts with something": true,
    "…and it is an Item": true,
    "…costing 2 or less": true,
    "…and it is not ALSO in the deck": 0,
    "no other hero starts with one": true
  }
},

{
  name: "two limits on a weapon swing, and they expire differently",
  why: "v2.46's rule, and her deck is where it bites. A blanket \"already " +
       "swung\" flag makes the Sledge WEAKER than printed (pay four again, " +
       "swing again); reading only `oncePerTurn` makes Scorpio STRONGER " +
       "(the TAP is a state, and a tapped permanent does not untap until " +
       "CR 4.4.3d). `weaponCost` returns both and both must be honoured.",
  run(c){
    const pool = require("../../data/pool.json");
    const line = n => (pool.find(x => x.name === n) || {}).functional_text || "";
    const sledge = P.weaponCost(line("Sledge of Anvilheim"));
    const scorpio = P.weaponCost(line("Scorpio, Comet Tail"));
    return {
      "the Sledge is once per turn": !!(sledge && sledge.oncePerTurn),
      "…and it does not tap":        !!(sledge && sledge.taps),
      "Scorpio is NOT once per turn": !!(scorpio && scorpio.oncePerTurn),
      "…it TAPS instead":            !!(scorpio && scorpio.taps)
    };
  },
  want: {
    "the Sledge is once per turn": false,
    "…and it does not tap": false,
    "Scorpio is NOT once per turn": false,
    "…it TAPS instead": true
  }
},

{
  name: "the Hood shuffles her hand back and REDRAWS it",
  why: "v4.43. `applyPrompt` puts the chosen cards at the FRONT of the " +
       "deck, so with the shuffle dropped she draws back exactly what she " +
       "put down — every zone count correct, the feed saying the cards " +
       "went back, and the hand unchanged. A visible no-op wearing the " +
       "appearance of a card that worked. Drawing before shuffling is the " +
       "same bug spelled the other way. And the card read `tier: none` " +
       "for versions while its COST half was complete: hand the same " +
       "printed line a payload that reads and `parseHeroPower` answers " +
       "(v3.79's diagnostic) — reading the payload is what creates the " +
       "route (v3.47).",
  run(c){
    const hood = c.card("Hope Merchant's Hood", 0, "hd");
    /* A DECK BIG ENOUGH THAT DRAWING THREE CANNOT BE MISTAKEN FOR LUCK,
       and three named cards in hand so the redraw is identifiable. */
    const hand = [1,2,3].map(i => Object.assign({}, c.card("Sink Below", 1), {uid: "h"+i, name: "H"+i}));
    const deck = Array.from({length: 20}, (_, i) =>
      Object.assign({}, c.card("Sink Below", 1), {uid: "d"+i, name: "D"+i}));
    let g = c.acting(c.state({name: "Dash", res: 9, ap: 3, hand, deck, gear: []},
                             {name: "Them", hp: 20, deck: [c.card("Sink Below", 1)]},
                             {seed: "hood-scene", turn: 4}));
    const pw = c.P.parseHeroPower(hood.tx, true);
    const before = g.rng.n;
    g = c.ops(g, c.P.classifyClause(String(pw.eff).toLowerCase()).ops, "Hope Merchant's Hood");
    g = c.open(g);
    const offered = g.prompt ? g.prompt.max : -1;
    /* pick all three */
    let n = g;
    for(const i of [0,1,2]) n = c.J.reduce(n, {t: "promptSel", i}, 0).state;
    n = c.J.reduce(n, {t: "promptConfirm"}, 0).state;
    const drew = n.sides[0].hand.map(x => x.name);
    return {
      "the ability reads at all":      !!pw,
      "…at instant speed":             pw && pw.kind,
      "…paying with the piece":        !!(pw && pw.sd),
      "cards she may shuffle back":    offered,
      "cards in hand afterwards":      n.sides[0].hand.length,
      "cards left in the deck":        n.sides[0].deck.length,
      "the deck was SHUFFLED":         n.rng.n > before,
      "she drew back the same three, in order": drew.join(",") === "H1,H2,H3",
      "no card is in two zones":       new Set([...n.sides[0].deck, ...n.sides[0].hand]
                                         .map(x => x.uid)).size
    };
  },
  want: {
    "the ability reads at all": true,
    "…at instant speed": "instant",
    "…paying with the piece": true,
    "cards she may shuffle back": 3,
    "cards in hand afterwards": 3,
    "cards left in the deck": 20,
    "the deck was SHUFFLED": true,
    "she drew back the same three, in order": false,
    "no card is in two zones": 23
  }
}

,

/* ---- v4.48 — HER TWO MULTIPLIERS, AND THEY WERE FLAT ---------------- */
{
  name: "Overblast multiplies by the boosts on this chain",
  why: "It prints \"+1{p} for each time you've boosted this combat chain\" " +
       "and the loose `this gets +N{p}` matcher claimed the clause, dropping " +
       "everything after the pip — so all three printings granted a FLAT +1 " +
       "whatever the count. WRONG IN BOTH DIRECTIONS at once: a point the " +
       "card does not grant at zero boosts, and less than printed at two or " +
       "more. `tier: full` throughout, so coverage was blind, and the " +
       "one-sided fairness sweep only looks for too-STRONG. The two readings " +
       "AGREE at exactly one boost, which is why a scene must watch more " +
       "than one count.",
  run(c){
    const swing = n => {
      c.P.fxReset();
      const atk = c.card("Overblast", 1, 61);
      const g = Object.assign(c.acting(c.state({res: 9, ap: 1}, {},
                                {turn: 3, actor: 0, turnPlayer: 0})),
                              {chain: [], boostChain: n});
      const out = c.exec(g, atk, "hand", 0);
      return c.J.withEffects(out, (fx, s) => fx.linkPumps(s, {})).total;
    };
    return {
      "printed power":                    c.card("Overblast", 1).power,
      "swings for, with no boosts":       swing(0),
      "…after one boost":                 swing(1),
      "…after two":                       swing(2),
      "…after three":                     swing(3)
    };
  },
  want: {
    "printed power": 5,
    "swings for, with no boosts": 5,
    "…after one boost": 6,
    "…after two": 7,
    "…after three": 8
  }
},

{
  name: "Fender Bender multiplies by the equipment defending it",
  why: "The same defect on the same reader, and the count is only knowable " +
       "once defenders are declared — so it rides on `pend.lateOps` and is " +
       "struck in `linkPumps`. `perEquipDef` has existed since v2.11 and had " +
       "ZERO pool emitters: its anchor spelled \"where X is the number of\", " +
       "a wording no record prints. A fire site nothing can reach is dead " +
       "rules code that reads like a rule (v4.11). It is also the card " +
       "v4.20 compared `piercing` against — 'Fender Bender's is +N for EACH " +
       "equipment, this is +N if there is at least one' — a comparison drawn " +
       "against a reader with no card.",
  run(c){
    const swing = eq => {
      c.P.fxReset();
      const atk = c.card("Fender Bender", 1, 62);
      const g = Object.assign(c.acting(c.state({res: 9, ap: 1}, {},
                                {turn: 3, actor: 0, turnPlayer: 0})), {chain: []});
      const out = c.exec(g, atk, "hand", 0);
      return c.J.withEffects(out, (fx, s) => fx.linkPumps(s, {equipDefenders: eq})).total;
    };
    return {
      "printed power":                       c.card("Fender Bender", 1).power,
      "swings for, unblocked by iron":       swing(0),
      "…through one piece of equipment":     swing(1),
      "…through two":                        swing(2),
      "…through three":                      swing(3)
    };
  },
  want: {
    "printed power": 4,
    "swings for, unblocked by iron": 4,
    "…through one piece of equipment": 5,
    "…through two": 6,
    "…through three": 7
  }
}

,

/* ---- v4.49 — THE GUN WITH NO BUTTON -------------------------------- */
{
  name: "Plasma Barrel Shot swings at all, for 1 plus the boosts",
  why: "It is in her gear list, prints three lines, and had NO ROUTE ON " +
       "EITHER BOARD. `parser.isWeapon` asked whether a weapon carries a " +
       "PRINTED POWER — a proxy for \"does this swing\" — and this card's " +
       "power is a printed FORMULA, so it carries none: the predicate that " +
       "decides whether it swings refused it BECAUSE of the very line that " +
       "says what it swings for. `parseHeroPower` refuses a payload of " +
       "\"Attack\" too, so the ability branch built nothing either. A Gun in " +
       "the gear zone with not one button. And the formula was an inline " +
       "regex over raw text in `build.js` (v3.58), dead TWICE over: gated on " +
       "`isWeapon`, and spelling \"you have boosted\" where the card prints " +
       "\"you've\" — `SYNONYMS` never reaches a raw scan (v3.36).",
  run(c){
    const B = require("../../engine/build.js");
    const swing = (boosts, ctrs) => {
      c.P.fxReset();
      const gr = Object.assign({}, c.card("Plasma Barrel Shot", 0), {uid: 41});
      B.equipPiece(gr);
      const g = Object.assign(c.acting(c.state(
        {res: 9, ap: 1, gear: [gr],
         counters: {41: Object.assign({steam: 1}, ctrs ? {pow: ctrs} : {})}},
        {}, {turn: 3, actor: 0, turnPlayer: 0})),
        {chain: [], boostChain: boosts});
      const out = c.exec(g, gr, "weapon", 0);
      return {total: c.J.withEffects(out, (fx, s) => fx.linkPumps(s, {})).total,
              ga: !!(out.pend && out.pend.ga)};
    };
    const gr = Object.assign({}, c.card("Plasma Barrel Shot", 0), {uid: 41});
    B.equipPiece(gr);
    return {
      "printed power":                       c.card("Plasma Barrel Shot", 0).power,
      "is it routed as a weapon at all":     c.P.isWeapon(c.card("Plasma Barrel Shot", 0)),
      "it gets a steam button":              !!(gr.pow && gr.powCard),
      "swings for, with no boosts":          swing(0).total,
      "…after two boosts":                   swing(2).total,
      "…and with two +1{p} counters on top": swing(2, 2).total,
      "does the swing keep an action point": swing(2).ga
    };
  },
  want: {
    "printed power": null,
    "is it routed as a weapon at all": true,
    "it gets a steam button": true,
    "swings for, with no boosts": 1,
    "…after two boosts": 3,
    "…and with two +1{p} counters on top": 5,
    "does the swing keep an action point": false
  }
},

{
  name: "the Gun's two routes are both reachable at the table",
  why: "A piece can print BOTH a weapon attack and an activated ability, " +
       "and judge chose by ELIMINATION — `isWeapon` false meant the " +
       "ability. Right for 32 of the pool's 33 ability-bearing pieces and " +
       "wrong for the one with both, so whichever branch it landed in the " +
       "OTHER button did not exist: the swing needs a steam counter that " +
       "only the ability puts there, which makes the card unplayable by " +
       "construction. And the steam cost was refused on the TRAINER only " +
       "(v3.01), so at the table the swing was free and REPEATABLE.",
  run(c){
    const B = require("../../engine/build.js");
    const seat = ctrs => {
      c.P.fxReset();
      const gr = Object.assign({}, c.card("Plasma Barrel Shot", 0), {uid: 41});
      B.equipPiece(gr);
      return Object.assign(c.acting(c.state(
        {res: 20, ap: 9, gear: [gr], counters: ctrs || {}}, {},
        {turn: 3, actor: 0, turnPlayer: 0})), {chain: [], boostChain: 0});
    };
    const why = (g, a) => { const o = c.J.reduce(g, a, 0); return o.error || null; };
    const built = c.J.reduce(seat({}), {t: "activate", uid: "gp41"}, 0);
    return {
      "swinging with no steam is refused":
        /steam counter/.test(String(why(seat({}), {t: "activate", uid: 41, target: "hero"}))),
      "the steam button is reachable":       !built.error,
      "…and it puts one counter on":
        ((built.state && built.state.sides[0].counters || {})[41] || {}).steam,
      "then the swing is legal":
        why(seat({41: {steam: 1}}), {t: "activate", uid: 41, target: "hero"}),
      "and building a SECOND is refused before it is paid":
        /already carries a steam counter/.test(String(
          why(Object.assign({}, built.state, {sides: built.state.sides.map(
            (s, i) => i === 0 ? Object.assign({}, s, {weaponUsed: {}, ap: 9}) : s)}),
            {t: "activate", uid: "gp41"})))
    };
  },
  want: {
    "swinging with no steam is refused": true,
    "the steam button is reachable": true,
    "…and it puts one counter on": 1,
    "then the swing is legal": null,
    "and building a SECOND is refused before it is paid": true
  }
},

/* ---- v4.63 — THE STEAM LINE IS READ, NOT PARAPHRASED ---------------- */
{
  name: "the Gun's steam cycle runs off its own printed line: build, swing, build",
  why: "For fourteen versions the steam-build ability was a powCard " +
       "`build.js` wrote BY HAND — \"Put a steam counter on this. Go " +
       "again.\" — which dropped the printed gate (\"If this has no steam " +
       "counters\") and had `effects.js` re-impose it off a stamp. The line " +
       "reads now, as a gated `ctrSrc` on the PIECE. What the card is FOR is " +
       "the cycle: a counter built is a counter a swing spends, and a spent " +
       "one lets the build run again. A put keyed by the powCard's own uid " +
       "would build a counter the swing can never find, and a gate read off " +
       "the powCard would never refuse — so the round trip is the observable.",
  run(c){
    const B = require("../../engine/build.js");
    c.P.fxReset();
    const gr = Object.assign({}, c.card("Plasma Barrel Shot", 0), {uid: 41});
    B.equipPiece(gr);
    const g0 = Object.assign(c.acting(c.state(
      {res: 20, ap: 9, gear: [gr], counters: {}}, {},
      {turn: 3, actor: 0, turnPlayer: 0})), {chain: [], boostChain: 0});
    const steam = g => (((g.sides[0].counters || {})[41]) || {}).steam || 0;
    const b1 = c.J.reduce(g0, {t: "activate", uid: "gp41"}, 0);
    const sw = b1.state && c.J.reduce(Object.assign({}, b1.state, {sides: b1.state.sides.map(
      (s, i) => i === 0 ? Object.assign({}, s, {weaponUsed: {}}) : s)}),
      {t: "activate", uid: 41, target: "hero"}, 0);
    /* THE SWING OPENS A COMBAT CHAIN, and an ACTION-speed ability has no
       window while one is open — so the chain is closed by hand here. What
       this scene watches is the counter, which the swing spent at
       declaration; driving a whole defend step would test the defender's
       policy instead (v3.85: a fixture driven through a policy is one the
       policy can consume). */
    const closed = sw && sw.state && Object.assign({}, sw.state, {
      pend: null, stack: [], chain: [], chainCards: [], passed: [],
      phase: "action", step: "layer", priority: 0,
      sides: sw.state.sides.map((s, i) => i === 0 ? Object.assign({}, s, {weaponUsed: {}}) : s)});
    const b2 = closed && c.J.reduce(closed, {t: "activate", uid: "gp41"}, 0);
    return {
      "the ability carries its printed text":  gr.powCard.tx,
      "after the first build":                 b1.error || steam(b1.state),
      "the swing declares":                    sw.error || !!sw.state.pend,
      "…and spends the counter":               sw.error || steam(sw.state),
      "so the build runs again":               b2.error || steam(b2.state)
    };
  },
  want: {
    "the ability carries its printed text": "If this has no steam counters, put a steam counter on it. Go again",
    "after the first build": 1,
    "the swing declares": true,
    "…and spends the counter": 0,
    "so the build runs again": 1
  }
}

];
