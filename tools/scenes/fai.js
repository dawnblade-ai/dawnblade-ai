/* FAI — "You may start the game with a Phoenix Flame in your graveyard."

   His ability's SECOND clause is unread (`npm run sweep`: 2 of 3). What
   these scenes pin is EPHEMERAL, which his deck is the only user of — and
   which was being read three different ways across two files, two of them
   against reminder text the database has never carried. */
const B = require("../../engine/build.js");
const G = require("../../engine/game.js");
const P = require("../../engine/parser.js");
const S = require("../../engine/sides.js");
const RNG = require("../../engine/rng.js");
const {loadData} = require("../../test/helpers/extract.js");

module.exports = [

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
