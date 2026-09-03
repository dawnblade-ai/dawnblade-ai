/* AZALEA — arrows, the arsenal, and the difference between face up and
   face down. Her whole package hangs on one distinction, and it is the
   distinction the engine got wrong. */
module.exports = [

{
  name: "reload puts the card FACE DOWN",
  why: "v3.69 — `applyAnswer` treated every to:\"arsenal\" pick as a face-UP " +
       "put. Reloading Swift Shot fired its face-up trigger and handed her a " +
       "free action point off a card that grants none, while the prompt's own " +
       "title said \"face-down\". Take Aim read `tier: full` throughout.",
  run(c){
    const arrow = c.card("Swift Shot", 1, 50);
    let g = c.state({hand: [arrow], arsenal: null, res: 9, ap: 1}, {}, {actor: 0, turn: 3});
    g = c.ops(g, [["reload"]], "Take Aim");
    g = c.answer(c.open(g), 0);
    return {
      "the arrow is in the arsenal": g.sides[0].arsenal ? g.sides[0].arsenal.name : null,
      "it is face up":              g.sides[0].arsenal ? !!g.sides[0].arsenal._faceUp : null,
      "its go-again is stamped":    g.sides[0].arsenal ? !!g.sides[0].arsenal._arsGA : null,
      "action points":              g.sides[0].ap
    };
  },
  want: {
    "the arrow is in the arsenal": "Swift Shot",
    "it is face up": false,
    "its go-again is stamped": false,
    "action points": 1
  }
},

{
  name: "a card that PRINTS face up still goes up, and still triggers",
  why: "the control, and the half that matters most: Call in the Big Guns, " +
       "Bull's Eye Bracers and Death Dealer exist FOR that trigger. A fix " +
       "that turned every arsenal put face down would delete her package in " +
       "the other direction.",
  run(c){
    const arrow = c.card("Swift Shot", 1, 51);
    let g = c.state({hand: [arrow], arsenal: null, res: 9, ap: 1}, {}, {actor: 0, turn: 3});
    g = Object.assign({}, g, {promptQ: [{tag: "pick", side: 0, src: "Call in the Big Guns",
      zone: "hand", to: "arsenal", min: 0, max: 1, faceUp: true,
      title: "Put an arrow face up in your arsenal?"}]});
    g = c.answer(c.open(g), 0);
    return {
      "it is face up":           !!g.sides[0].arsenal._faceUp,
      "its go-again is stamped": !!g.sides[0].arsenal._arsGA
    };
  },
  want: {"it is face up": true, "its go-again is stamped": true}
},

{
  name: "reload is refused when the arsenal is occupied",
  why: "the printed reminder text is \"if you have NO CARDS in your arsenal\" " +
       "— `arsEmpty`, not `arsFree`. The two coincide at capacity 1, which is " +
       "exactly why the wrong one stays invisible.",
  run(c){
    const held = c.card("Swift Shot", 1, 52);
    const spare = c.card("Swift Shot", 2, 53);
    let g = c.state({hand: [spare], arsenal: held, res: 9, ap: 1}, {}, {actor: 0, turn: 3});
    g = c.ops(g, [["reload"]], "Take Aim");
    return {
      "a sheet opened":        !!(g.promptQ || []).length,
      "the arsenal is untouched": g.sides[0].arsenal.uid,
      "the hand still holds it":  g.sides[0].hand.length
    };
  },
  want: {"a sheet opened": false, "the arsenal is untouched": 52, "the hand still holds it": 1}
},

{
  name: "Bolt'n Boots only frees an arrow that is above its base power",
  why: "v3.63 — `attackQual` could not read \"with {p} greater than its base\", " +
       "so the qualifier was unreadable and the whole ability refused. The " +
       "`pumped` atom is the CALLER's answer: absent, it must mean no.",
  run(c){
    const arrow = c.card("Swift Shot", 1, 54);
    const boots = c.card("Bolt'n Boots", 0, 55);
    const B = require("../../engine/build.js");
    const pw = c.P.parseHeroPower(boots.tx, true);
    const ab = {name: "Bolt'n Boots — ability", pitch: 0, cost: pw.cost, tt: "Equipment Ability",
                kw: [], tx: (boots.tx || "").split(/\n+/)[0].replace(/^[^:]*:\s*/, ""),
                sd: pw.sd, _instant: pw.kind === "instant",
                _attackRx: pw.kind === "attackRx", uid: "gp55"};
    const link = total => {
      const g = c.state({hand: [], res: 9, ap: 1}, {}, {actor: 0, turn: 3});
      return Object.assign({}, g, {stack: [], pend: {card: arrow, by: 0, total,
        ga: false, ops: [], onHit: [], onHitHero: [], condOnHit: []}});
    };
    const base = arrow.power || 0;
    return {
      "the ability is built as an attack reaction": ab._attackRx,
      "an arrow at its base power goes again": !!c.exec(link(base), ab, "hero", 0).pend.ga,
      "an arrow above its base goes again":    !!c.exec(link(base + 2), ab, "hero", 0).pend.ga
    };
  },
  want: {
    "the ability is built as an attack reaction": true,
    "an arrow at its base power goes again": false,
    "an arrow above its base goes again": true
  }
},

{
  name: "her hero ability cycles the arsenal and turns the new card FACE UP",
  why: "v3.71 — her hero did nothing at all: `parseHeroPower` refused the " +
       "line, so `build.js` built her no powCard and neither board could " +
       "offer it. Her deck was 28 of 32 `full` while the thing the deck is " +
       "BUILT AROUND was inert — read the hero ability before the cards.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "azalea");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.azalea), c.H.db(), {},
                          RNG.make("scene-az"), {n: 0}).b;
    /* THE TWO CARDS DIFFER, or the scene cannot tell a cycle from a
       no-op (v3.26). Swift Shot prints "when this is put face-up into
       your arsenal, it gets go again this turn" — the trigger that makes
       the face-up/face-down distinction worth anything. */
    const held = c.card("Take Aim", 1, 900);
    const top  = c.card("Swift Shot", 1, 901);
    const g = c.state({arsenal: held, deck: [top, c.card("Nimblism", 1, 902)],
                       res: 9, ap: 1, hand: []}, {},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.exec(g, b.HPOW, "hero", -1);
    const a = n.sides[0].arsenal;
    return {
      "she has a hero power at all":   !!b.HPOW,
      "the new arsenal card":          a ? a.name : null,
      "it is face up":                 a ? !!a._faceUp : null,
      "…so its own trigger fired":     a ? !!a._arsGA : null,
      "the old one is on the BOTTOM":  n.sides[0].deck[n.sides[0].deck.length - 1].uid,
      "the action point is kept":      n.sides[0].ap
    };
  },
  want: {
    "she has a hero power at all": true,
    "the new arsenal card": "Swift Shot",
    "it is face up": true,
    "…so its own trigger fired": true,
    "the old one is on the BOTTOM": 900,
    "the action point is kept": 1
  }
},

{
  name: "an ARROW off the top gains dominate, and the wall obeys it",
  why: "\"If it's an arrow, it gets dominate until end of turn\" — the " +
       "subject is read off the printed type line, and the grant is only " +
       "real if it survives all the way to `pend.defCap`, which is what " +
       "BOTH walls are built from. A stamp nobody reads is a no-op.",
  run(c){
    const stamped = Object.assign(c.card("Swift Shot", 1, 800),
      {_faceUp: true, _upTurn: 3, _arsKw: ["dominate"]});
    const plain = Object.assign(c.card("Swift Shot", 1, 801),
      {_faceUp: true, _upTurn: 3});
    const play = arrow => {
      const g = c.state({arsenal: arrow, deck: [c.card("Nimblism", 1, 802)],
                         res: 9, ap: 1, hand: []}, {},
                        {actor: 0, turnPlayer: 0, turn: 3});
      return c.exec(g, arrow, "arsenal", -1);
    };
    const n = play(stamped);
    const blk = uid => ({uid, name: "Blocker " + uid, tt: "Guardian Action",
                         pitch: 1, cost: 1, power: 2, def: 3, tx: "", kw: []});
    const wall = Object.assign({}, n, {phase: "action", step: "defend", priority: 0,
      passed: [], attacker: 0, stack: [],
      pend: Object.assign({}, n.pend, {target: {kind: "hero"}}),
      sides: [n.sides[0], Object.assign({}, n.sides[1], {hand: [blk(61), blk(62)], gear: []})]});
    const first = c.reduce(wall, {t: "defend", uid: 61}, 1);
    return {
      "the arrow reaches the chain with a cap": (n.pend || {}).defCap,
      "an unstamped copy caps nothing":         (play(plain).pend || {}).defCap,
      "one blocker is legal":                   c.J.legal(wall, {t: "defend", uid: 61}, 1),
      "a second is refused":  /more than 1/.test(String(c.J.legal(first, {t: "defend", uid: 62}, 1)))
    };
  },
  want: {
    "the arrow reaches the chain with a cap": {n: 1, count: "hand"},
    "an unstamped copy caps nothing": null,
    "one blocker is legal": null,
    "a second is refused": true
  }
},

{
  name: "her specialization finally has an event to watch",
  why: "v3.72 — Crow's Nest reads \"whenever an arrow is put face-up into " +
       "your arsenal FROM YOUR DECK\", and until her hero ability was built " +
       "nothing in the pool could do that. It is also the pool's ONLY source " +
       "of aim counters, which three of her arrows read — a whole family " +
       "dead behind one hero ability.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "azalea");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.azalea), c.H.db(), {},
                          RNG.make("scene-nest"), {n: 0}).b;
    const board = top => c.state({
      arsenal: c.card("Take Aim", 1, 900),
      deck: [c.card(top, 1, 901), c.card("Nimblism", 1, 902)],
      gear: [c.card("Crow's Nest", 0, 950)], res: 9, ap: 1, hand: []}, {},
      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const asked = c.exec(board("Drill Shot"), b.HPOW, "hero", -1);
    const paid = c.reduce(c.reduce(asked, {t: "promptChoose", choice: "pay"}, 0),
                          {t: "promptConfirm"}, 0);
    const plain = c.exec(board("Nimblism"), b.HPOW, "hero", -1);
    /* the payoff, one card over: an aimed arrow really is bigger */
    const swing = (uid, counters) => {
      const arrow = c.card("Murkmire Grapnel", 1, uid);
      const g = c.state({hand: [arrow], res: 9, ap: 1, deck: [], counters}, {hp: 20},
                        {actor: 0, turnPlayer: 0, turn: 3});
      return c.exec(g, arrow, "hand", 0).pend.total;
    };
    return {
      "the Quiver asks when an arrow comes off the deck": !!asked.prompt,
      "…and stays quiet for anything else":  !(plain.prompt),
      "paying puts the counter on the ARROW": (paid.sides[0].counters[901] || {}).aim || 0,
      "…and actually costs a resource":       paid.sides[0].res,
      "an aimed arrow swings bigger":         swing(800, {800: {aim: 1}}),
      "an unaimed one does not":              swing(800, {})
    };
  },
  want: {
    "the Quiver asks when an arrow comes off the deck": true,
    "…and stays quiet for anything else": true,
    "paying puts the counter on the ARROW": 1,
    "…and actually costs a resource": 8,
    "an aimed arrow swings bigger": 5,
    "an unaimed one does not": 4
  }
},

{
  name: "Spire Sniping reorders the top two and buries nothing",
  why: "\"put them back in any order\" is a REORDER, and opt is not — opt " +
       "lets you send cards to the BOTTOM. Read as opt the card would be " +
       "stronger than printed AND would fire Blaze's \"whenever you opt\" " +
       "energy trigger off a card that does not opt.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "azalea");
    const b = B.buildSide(h, G.parseDeck(W.DECKS.azalea), c.H.db(), {},
                          RNG.make("scene-spire"), {n: 0}).b;
    const g = c.state({arsenal: c.card("Take Aim", 1, 900),
      deck: [c.card("Spire Sniping", 2, 901), c.card("Nimblism", 1, 902),
             c.card("Swift Shot", 1, 903), c.card("Widowmaker", 2, 904)],
      res: 9, ap: 1, hand: []}, {},
      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.exec(g, b.HPOW, "hero", -1);
    const out = c.reduce(c.reduce(n, {t: "promptSel", i: 0}, 0), {t: "promptConfirm"}, 0);
    return {
      "the sheet shows the top two":   n.prompt ? n.prompt.cards.map(x => x.uid) : null,
      "it is a reorder, not an opt":   n.prompt ? n.prompt.keepTop === true : null,
      "the tapped card goes second":   out.sides[0].deck.map(x => x.uid)
    };
  },
  want: {
    "the sheet shows the top two": [902, 903],
    "it is a reorder, not an opt": true,
    "the tapped card goes second": [903, 902, 904, 900]
  }
}
,

{
  name: "her cycle fires another hero's card, from the deck",
  why: "v3.79 — Back Alley Breakline reads \"when an activated ability or " +
       "action card effect puts THIS face-up into a zone FROM YOUR DECK, " +
       "gain 1 action point\", and her ability is the ONLY thing in the " +
       "pool that causes that event. The card is in Gravy Bones' list, so " +
       "no deck holds both halves — latent, measured, and read correctly " +
       "anyway (v3.73). The hand route is the negative control: an action " +
       "point is the most valuable thing in the game to hand out wrongly.",
  run(c){
    const B = require("../../engine/build.js");
    const G = require("../../engine/game.js");
    const RNG = require("../../engine/rng.js");
    const J = require("../../engine/judge.js");
    const {loadData} = require("../../test/helpers/extract.js");
    const pool = require("../../data/pool.json");
    const W = loadData();
    const db = c.H.db();
    const b = B.buildSide(W.HEROES.find(x => x.k === "azalea"),
                          G.parseDeck(W.DECKS.azalea), db, {},
                          RNG.make("scene-bab"), {n: 0}).b;
    const as = (nm, uid) => { const r = pool.find(x => x.name === nm);
      return {name: r.name, uid, pitch: r.pitch, tt: r.type_text, ty: r.types,
              kw: r.card_keywords, tx: r.functional_text, power: r.power,
              def: r.defense}; };
    /* the DECK route — her own ability */
    const g = c.state({deck: [as("Back Alley Breakline", 900)],
                       arsenal: as("Act of Glory", 901), hand: [], res: 9, ap: 1},
                      {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.H.execute(g, b.HPOW, "hero", 0, {});
    /* the HAND route — the same card, put face up out of a hand */
    let h0 = c.state({hand: [as("Back Alley Breakline", 902)], arsenal: null,
                      res: 9, ap: 1}, {}, {actor: 0, turn: 3});
    h0 = Object.assign({}, h0, {promptQ: [{tag: "pick", side: 0, src: "probe",
      zone: "hand", to: "arsenal", min: 0, max: 1, faceUp: true, title: "Up?"}]});
    let hn = J.openPrompt(h0);
    hn = J.reduce(J.reduce(hn, {t: "promptSel", i: 0}, 0).state,
                  {t: "promptConfirm"}, 0).state;
    const iUp = n.feed.findIndex(l => /Back Alley Breakline set face up/.test(l));
    const iAp = n.feed.findIndex(l => /action point — the turn stretches/.test(l));
    return {
      "it arrives face up out of the deck": n.sides[0].arsenal.name
                                             + "/" + !!n.sides[0].arsenal._faceUp,
      "action points after her cycle":      n.sides[0].ap,
      "the card is seen arriving BEFORE the trigger pays": iUp >= 0 && iAp > iUp,
      "and out of the HAND it goes up too": hn.sides[0].arsenal.uid,
      "…but pays nothing":                  hn.sides[0].ap
    };
  },
  want: {
    "it arrives face up out of the deck": "Back Alley Breakline/true",
    "action points after her cycle": 2,
    "the card is seen arriving BEFORE the trigger pays": true,
    "and out of the HAND it goes up too": 902,
    "…but pays nothing": 1
  }
}

];
