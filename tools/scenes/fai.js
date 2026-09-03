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
},

{
  name: "Mounting Anger's banish is priced by the chain, and the +1 lands on the CARD",
  why: "v3.92 — v2.29 REFUSED both this and Rising Resentment because " +
       "\"with cost less than the number of Draconic chain links you " +
       "control\" is a dynamic bound no printed field expresses, and a " +
       "loose read that dropped the limit made ANY attack in hand a legal " +
       "banish (sev-3, illegal play allowed). The refusal stopped being " +
       "right at v3.86, when `dracLinks` was built for Fai's OWN " +
       "discount — the reader was already in the same deck box. And 'it' " +
       "is the BANISHED card, not the attacker: read as ops the +1{p} " +
       "pumps the attack that just hit (v2.33's Bull's Eye Bracers trap).",
  run(c){
    const hand = [
      {uid: 901, name: "Cheap Swing", cost: 0, pitch: 1, power: 3,
       tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
      {uid: 902, name: "Edge Swing", cost: 1, pitch: 1, power: 4,
       tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
      {uid: 903, name: "Dear Swing", cost: 3, pitch: 1, power: 7,
       tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []},
      {uid: 904, name: "Not An Attack", cost: 0, pitch: 1,
       tt: "Generic Action", ty: ["Generic","Action"], tx: "", kw: [], gkw: []}
    ];
    const real = c.card("Mounting Anger", 1, 900);
    /* A REAL SWING THAT CONNECTS, so `linkPayload` runs its own trigger.
       Building the sheet by hand would measure the SHEET and say nothing
       about whether anything opens one (v3.20). */
    const drac = () => ({n: "x", kind: "atk", drac: true});
    const swing = links => {
      const g0 = c.state({hand: hand.slice(), banish: [], res: 9}, {hp: 20}, {turn: 3});
      return c.J.withEffects(g0, (fx, n) => {
        n = Object.assign({}, n, {chain: links.slice(),
          pend: {card: real, total: 4, ops: [], onHit: [], onHitHero: [],
                 ga: false, by: 0, lateConds: []}});
        const r = fx.linkPayload(n, {total: 4, pumps: 0, heroHit: true});
        return r.game || r;
      });
    };
    const offered = g => {
      const q = (g.promptQ || [])[0];
      const built = q && c.PM.buildPrompt(g, q);
      return built ? built.cards.map(x => x.name) : null;
    };
    /* THE ATTACK'S OWN LINK IS ON THE CHAIN by the time its trigger
       resolves, so a seeded chain of N gives N+1 and the bound is
       "cost < N+1". Written with two seeded links this scene asked for
       the cost-3 card at a bound of 2, selected nothing, and threw two
       lines later — check your own fixture, ninth time. */
    const one = swing([]), four = swing([drac(), drac(), drac()]);
    /* PAY IT, through the real selection route. */
    const built = c.PM.buildPrompt(four, four.promptQ[0]);
    const idx = built.cards.findIndex(x => x.name === "Dear Swing");
    const paid = c.J.withEffects(
      Object.assign({}, four, {promptQ: [], prompt: c.PM.promptToggleSel(built, idx)}),
      (fx, n) => fx.applyAnswer(n, n.prompt));
    const g2 = paid.game || paid;
    const got = (g2.sides[0].banish || [])[0] || {};
    /* AND SPEND IT — a stamp nothing spends is the no-op blind spot
       wearing a number. Printed 7, so the swing must strike for 8. */
    const played = c.exec(Object.assign({}, g2, {pend: null, chain: [], promptQ: [], prompt: null}),
                          got, "banish", 0, {});
    const g3 = played.game || played;
    return {
      "one Draconic link — only the cost-0 attack": offered(one),
      "four links — the cost-1 and cost-3 come in":  offered(four),
      "a non-attack is never offered":              (offered(four) || []).indexOf("Not An Attack"),
      "the chosen card really left the hand":       g2.sides[0].hand.some(x => x.uid === 903),
      "…and is in the banish zone":                 got.name,
      "the +1{p} rides on the card that MOVED":     got._banPow,
      "the ATTACKER was not pumped":                real._banPow == null,
      "it may be played this turn":                 c.P.playableFromZone(got, "banish", {turn: g2.turn}),
      "and the swing strikes for printed 7 plus 1": g3.pend && g3.pend.total
    };
  },
  want: {
    "one Draconic link — only the cost-0 attack": ["Cheap Swing"],
    "four links — the cost-1 and cost-3 come in": ["Cheap Swing", "Edge Swing", "Dear Swing"],
    "a non-attack is never offered": -1,
    "the chosen card really left the hand": false,
    "…and is in the banish zone": "Dear Swing",
    "the +1{p} rides on the card that MOVED": 1,
    "the ATTACKER was not pumped": true,
    "it may be played this turn": true,
    "and the swing strikes for printed 7 plus 1": 8
  }
},

{
  name: "Rising Resentment's rider is a DISCOUNT, and it reaches effCost",
  why: "v3.92 — the two cards share every word but the rider, which is " +
       "exactly the look-alike hazard v2.29 pinned them for. A discount " +
       "read as a pump (or either read onto the other) is a card doing " +
       "something its text never says. It rides on the CARD rather than " +
       "on the side, because the printed line names one specific card; " +
       "`costOff` is the side-level qualified grant and would land on " +
       "whatever matched next.",
  run(c){
    const hand = [{uid: 911, name: "Dear Swing", cost: 3, pitch: 1, power: 7,
      tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"], tx: "", kw: [], gkw: []}];
    const real = c.card("Rising Resentment", 1, 910);
    const g0 = c.state({hand: hand.slice(), banish: [], res: 0}, {hp: 20}, {turn: 3});
    const hit = c.J.withEffects(g0, (fx, n) => {
      n = Object.assign({}, n, {chain: [{n:"x",kind:"atk",drac:true},{n:"y",kind:"atk",drac:true},{n:"z",kind:"atk",drac:true}],
        pend: {card: real, total: 4, ops: [], onHit: [], onHitHero: [], ga: false, by: 0, lateConds: []}});
      const r = fx.linkPayload(n, {total: 4, pumps: 0, heroHit: true});
      return r.game || r;
    });
    const built = c.PM.buildPrompt(hit, hit.promptQ[0]);
    const paid = c.J.withEffects(
      Object.assign({}, hit, {promptQ: [], prompt: c.PM.promptToggleSel(built, 0)}),
      (fx, n) => fx.applyAnswer(n, n.prompt));
    const g2 = paid.game || paid;
    const got = (g2.sides[0].banish || [])[0] || {};
    return {
      "the rider is a cost reduction, not a pump": got._banCostOff,
      "nothing pumped the card's power":           got._banPow == null,
      "a printed 3 now costs":                     c.P.effCost(got, g2.sides[0]),
      "and it may be played this turn":            c.P.playableFromZone(got, "banish", {turn: g2.turn})
    };
  },
  want: {
    "the rider is a cost reduction, not a pump": 1,
    "nothing pumped the card's power": true,
    "a printed 3 now costs": 2,
    "and it may be played this turn": true
  }
}

];
