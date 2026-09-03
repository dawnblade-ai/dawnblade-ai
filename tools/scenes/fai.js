/* FAI — "You may start the game with a Phoenix Flame in your graveyard."

   BOTH of his clauses landed at v3.86 and neither was the ability's
   payload: the graveyard PICK has read for versions. What refused was
   everything around it — he opened with an empty graveyard, so the return
   had nothing to fetch until he had drawn and spent a Phoenix Flame, and
   the discount was simply dropped, so the ability cost 3 on the turn its
   whole point is that it costs 0.

   The rest pin EPHEMERAL, which his deck is the only user of — and which
   was being read three different ways across two files, two of them
   against reminder text the database has never carried. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const P = require("../../engine/parser.js");
const S = require("../../engine/sides.js");
const RNG = require("../../engine/rng.js");
const {loadData} = require("../../test/helpers/extract.js");

module.exports = [

{
  name: "he opens with a Phoenix Flame ALREADY in the graveyard",
  why: "v3.86 — the pool prints exactly TWO \"you may start the game " +
       "with\" lines and this is the second; Dash's puts an ITEM in the " +
       "ARENA and nobody had built the graveyard twin. Without it his own " +
       "ability has nothing to fetch on turn one, which is the whole of " +
       "what the hero does.",
  run(c){
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "fai");
    const ctr = {n: 0};
    let rng = RNG.make("scene-fai");
    const b0 = B.buildSideDefault(h, G.parseDeck(W.DECKS.fai), c.H.db(), rng, ctr);
    rng = b0.rng;
    const hd = W.HEROES.find(x => x.k === "dorinthea");
    const b1 = B.buildSideDefault(hd, G.parseDeck(W.DECKS.dorinthea), c.H.db(), rng, ctr);
    const g = c.J.newMatch({builds: [b0.b, b1.b], names: [h.n, hd.n],
      heroKeys: ["fai", "dorinthea"], rng: b1.rng, first: 0, tokSeq: ctr.n});
    const seen = new Set(); let dup = 0;
    ["deck", "hand", "pitch", "grave", "banish", "soul"].forEach(z =>
      (g.sides[0][z] || []).forEach(x => { if(seen.has(x.uid)) dup++; seen.add(x.uid); }));
    return {
      "cards in his graveyard at the deal": (g.sides[0].grave || []).length,
      "…and it is the card his line NAMES": (g.sides[0].grave[0] || {}).name,
      "stamped as NOT put there this turn": (g.sides[0].grave[0] || {})._gy,
      "the opponent gets nothing":          (g.sides[1].grave || []).length,
      /* SPLICED OUT OF THE DECK. A card in the graveyard AND in the deck
         is CARD-IN-TWO-ZONES, which the census works by uid to catch. */
      "no card is in two zones":            dup,
      "the board is clean":                 require("../../engine/invariants.js").errors(g).length
    };
  },
  want: {
    "cards in his graveyard at the deal": 1,
    "…and it is the card his line NAMES": "Phoenix Flame",
    "stamped as NOT put there this turn": 0,
    "the opponent gets nothing": 0,
    "no card is in two zones": 0,
    "the board is clean": 0
  }
},

{
  name: "the ability costs 3, then 1, then nothing — per Draconic chain link",
  why: "v3.86 — the rider was dropped entirely, so the ability charged its " +
       "printed {r}{r}{r} on the turn its whole point is that a Draconic " +
       "chain has made it free. And it is charged through `judge.reduce` " +
       "rather than read: `effCost` is asked three DIFFERENT questions on " +
       "one activation (v3.80 — could the seat raise it, must a payment " +
       "open, charge it), and a discount threaded into one of the three " +
       "is what put a seat on negative resources.",
  run(c){
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "fai");
    const hd = W.HEROES.find(x => x.k === "dorinthea");
    const spend = links => {
      const ctr = {n: 0};
      let rng = RNG.make("scene-fai-cost");
      const b0 = B.buildSideDefault(h, G.parseDeck(W.DECKS.fai), c.H.db(), rng, ctr);
      rng = b0.rng;
      const b1 = B.buildSideDefault(hd, G.parseDeck(W.DECKS.dorinthea), c.H.db(), rng, ctr);
      const g0 = c.J.newMatch({builds: [b0.b, b1.b], names: [h.n, hd.n],
        heroKeys: ["fai", "dorinthea"], rng: b1.rng, first: 0, tokSeq: ctr.n});
      const chain = [];
      for(let i = 0; i < links; i++) chain.push({n: "L" + i, dmg: 1, drac: true, kind: "atk"});
      const g = Object.assign({}, g0, {chain,
        sides: g0.sides.map((s, i) => i === 0 ? Object.assign({}, s, {res: 9}) : s)});
      const n = c.reduce(g, {t: "activate", from: "hero", uid: "hpow"}, 0);
      return {spent: 9 - n.sides[0].res, bad: require("../../engine/invariants.js").errors(n).length};
    };
    const a = spend(0), b = spend(1), d = spend(3);
    return {
      "printed pips on his ability":  B.buildSideDefault(h, G.parseDeck(W.DECKS.fai),
                                        c.H.db(), RNG.make("x"), {n: 0}).b.HPOW.cost,
      "resources spent with no chain": a.spent,
      "…with one Draconic link":       b.spent,
      "…with three":                   d.spent,
      "and nobody ever owes any":      a.bad + b.bad + d.bad
    };
  },
  want: {
    "printed pips on his ability": 3,
    "resources spent with no chain": 3,
    "…with one Draconic link": 2,
    "…with three": 0,
    "and nobody ever owes any": 0
  }
},

{
  name: "EPHEMERAL is read off the printed KEYWORD, not off reminder text",
  why: "v3.82 — the trainer tested the keyword list and judge tested the " +
       "printed reminder sentence, and measured across all 797 records " +
       "ONE card is ephemeral by keyword and NOT ONE prints the reminder " +
       "text. The database carries no reminder text for any keyword — " +
       "this project says so in four places — so judge's reader matched " +
       "nothing, ever, on BOTH of its graveyard paths.",
  run(c){
    const pool = require("../../data/pool.json");
    const EPH = /if it would be put into a graveyard from anywhere, instead it ceases to exist/i;
    const ct = pool.find(x => /Crouching Tiger/.test(x.name || ""));
    const card = {name: ct.name, tt: ct.type_text, ty: ct.types,
                  kw: ct.card_keywords, tx: ct.functional_text, pitch: ct.pitch};
    const plain = {name: "Plain", tt: "Generic Action", ty: ["Generic", "Action"],
                   kw: ["Go again"], tx: "**Go again**", pitch: 1};
    return {
      "its whole printed text":            JSON.stringify(ct.functional_text),
      "records ephemeral by KEYWORD":      pool.filter(x =>
        (x.card_keywords || []).some(k => /ephemeral/i.test(k))).length,
      "records printing the REMINDER text": pool.filter(x =>
        EPH.test(x.functional_text || "")).length,
      "the one reader says yes":           P.isEphemeral(card),
      "…and no to everything else":        P.isEphemeral(plain),
      /* `printedKw`, NEVER `hasKw` (v2.84's three questions). The two
         agree on every card in the pool — Crouching Tiger carries the
         keyword AND lists it — so only a synthetic near-miss can tell
         them apart, which is v3.73's Crash-and-Bash discriminator one
         keyword over. A card that MENTIONS ephemeral in a sentence does
         not have it, and removing it from the game would be the golden
         rule broken at the keyword level. */
      "a card that only MENTIONS it is not ephemeral":
        P.isEphemeral({name: "Ephemeral Namer", tt: "Generic Action",
                       ty: ["Generic", "Action"], kw: [], pitch: 1,
                       tx: "Banish a card with ephemeral from your graveyard."}),
      "…and hasKw would have said otherwise":
        P.hasKw({name: "Ephemeral Namer 2", tt: "Generic Action",
                 ty: ["Generic", "Action"], kw: [], pitch: 1,
                 tx: "Banish a card with ephemeral from your graveyard."}, "ephemeral")
    };
  },
  want: {
    "its whole printed text": "\"**Ephemeral**\\n\\n**Go again**\"",
    "records ephemeral by KEYWORD": 1,
    "records printing the REMINDER text": 0,
    "the one reader says yes": true,
    "…and no to everything else": false,
    "a card that only MENTIONS it is not ephemeral": false,
    "…and hasKw would have said otherwise": true
  }
},

{
  name: "…and BOTH boards drop it now — the table used to keep it",
  why: "v3.01's shape, on the board that is supposed to be the CR-exact " +
       "one: Crouching Tiger reached the graveyard at the table while the " +
       "trainer correctly dropped it, so a card the rules REMOVE FROM THE " +
       "GAME was handed back to the player. Judge had TWO graveyard paths " +
       "and both carried the dead regex.",
  run(c){
    const pool = require("../../data/pool.json");
    const ct = pool.find(x => /Crouching Tiger/.test(x.name || ""));
    const card = {name: ct.name, uid: 990, pitch: ct.pitch, cost: ct.cost,
                  power: ct.power, def: ct.defense, tt: ct.type_text,
                  ty: ct.types, kw: ct.card_keywords, tx: ct.functional_text};
    const plain = {name: "Plain Card", uid: 991, pitch: 1, cost: 1, power: 3,
                   def: 2, tt: "Generic Action - Attack",
                   ty: ["Generic", "Action", "Attack"], kw: [], tx: ""};
    /* the shared body both boards hand to the card semantics */
    const g = c.state({hand: [card, plain], res: 9, ap: 1}, {hp: 20},
                      {actor: 0, turnPlayer: 0, turn: 3});
    const out = c.H.fx(g, (fx, n) => ({game: fx.runOps(n,
      [["selfDiscard", 2]], "scene")}));
    const grave = ((out.game || out).sides[0].grave || []).map(x => x.name);
    const src = require("fs").readFileSync(__dirname + "/../../engine/judge.js", "utf8");
    return {
      "the ordinary card reaches the graveyard": grave.indexOf("Plain Card") >= 0,
      "…and the ephemeral one does not":         grave.indexOf("Crouching Tiger") < 0,
      "judge holds no reminder-text regex any more":
        !/if it would be put into a graveyard from anywhere/.test(src),
      "both of its paths ask the one reader":
        (src.match(/PR\.isEphemeral/g) || []).length,
      /* AND THE TRAINER MUST NOT KEEP ITS OWN. It held the keyword-list
         test inline, which is the no-mirror rule broken across the two
         boards — the shape that let the two answers drift in the first
         place. */
      "the trainer holds no private copy either":
        !/kw\|\|\[\]\)\.some\(k=>\/ephemeral/i.test(
          require("fs").readFileSync(__dirname + "/../../index.html", "utf8"))
    };
  },
  want: {
    "the ordinary card reaches the graveyard": true,
    "…and the ephemeral one does not": true,
    "judge holds no reminder-text regex any more": true,
    "both of its paths ask the one reader": 2,
    "the trainer holds no private copy either": true
  }
}

];
