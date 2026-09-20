/* VISERAI — "Whenever you play a Runeblade card, if you've played another
   non-attack action card this turn, create a Runechant token."

   A GATE, not a bare trigger (v2.12): the Runeblade card alone mints
   nothing, and the "another" is what makes the rite a two-card turn. */
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
  name: "the rite needs TWO cards — a Runeblade card alone mints nothing",
  why: "v2.12 — a trigger is not a gate. \"Whenever you play a Runeblade " +
       "card, IF you've played another non-attack action card this turn\" " +
       "is a bare `when` carrying a nested `if`, and reading it as the " +
       "trigger alone mints a Runechant off every Runeblade card he plays.",
  run(c){
    const b = built(c, "viserai");
    /* NAMED, NOT SEARCHED. The first draft took "the first Runeblade
       non-attack in his shuffled deck", which is a different card under a
       different seed — and it landed on Mauvrion Skies, whose OWN text
       queues a Runechant grant, so the scene measured that card instead
       of the rite. A fixture that depends on a shuffle has not named what
       it is testing. Condemn to Slaughter is a Runeblade Action whose
       text says nothing about Runechants. */
    const rb = b.deck.find(x => x.name === "Condemn to Slaughter");
    const play = nonBefore => {
      const hist = Object.assign({atk: 0, non: nonBefore, arc: 0, aura: 0, made: 0,
                                 booed: 0, blue: 0, red: 0, trans: 0, blueGY: 0,
                                 atkNames: []}, {});
      const g = c.state({hand: [], res: 9, ap: 1, board: [], hist},
                        {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
      const n = c.H.execute(g, Object.assign({}, rb, {uid: 970}), "hand", 0, {});
      return P.runeCount(n.sides[0]);
    };
    return {
      "his passive is built":                    b.viseraiPassive,
      "the card he plays is a Runeblade non-attack": /runeblade/i.test(rb.tt || ""),
      "…and it mints nothing of its own":        !/runechant/i.test(rb.tx || ""),
      "played first this turn — no rite":        play(0),
      "…after another non-attack — a Runechant": play(1)
    };
  },
  want: {
    "his passive is built": true,
    "the card he plays is a Runeblade non-attack": true,
    "…and it mints nothing of its own": true,
    "played first this turn — no rite": 0,
    "…after another non-attack — a Runechant": 1
  }
},

{
  name: "a Runechant is an AURA on the board, not a counter",
  why: "v2.23 — the printed token is \"Runeblade Token - Aura\", and seven " +
       "pool cards ask about auras generically. While it was an integer on " +
       "the side none of them could see it: it could not be counted and it " +
       "could not be destroyed. `runeCount` derives from the board, and " +
       "there is no `sd.rune` field for a drill to find.",
  run(c){
    const b = built(c, "viserai");
    const g = c.state({hand: [], res: 9, ap: 1, board: []}, {hp: 20},
                      {actor: 0, turnPlayer: 0, turn: 3, builds: [b, {}]});
    const n = c.H.runOps(g, [["token", "Runechant", 2, "self"]], "scene");
    const sd = n.sides[0];
    return {
      "two minted, and they are on the BOARD": (sd.board || []).length,
      "…counted off the board":                P.runeCount(sd),
      "…and they count as AURAS":              P.auraCount(sd),
      "there is no integer field for them":    sd.rune === undefined,
      "each is a real card with the token's own text":
        (sd.board || []).every(e => e.card && /arcane/i.test(e.card.tx || ""))
    };
  },
  want: {
    "two minted, and they are on the BOARD": 2,
    "…counted off the board": 2,
    "…and they count as AURAS": 2,
    "there is no integer field for them": true,
    "each is a real card with the token's own text": true
  }
},

{
  name: "the Robe spends a Runechant — the second half of its printed cost",
  why: "v4.55 — \"Instant - Destroy this AND A RUNECHANT YOU CONTROL: " +
       "Prevent the next 1 arcane damage…\" parsed BYTE-IDENTICALLY to a " +
       "control printing only \"Destroy this:\". The second half of the " +
       "cost was silently dropped, so the ability shattered the piece and " +
       "left the Runechant on the board — and in the hero whose engine IS " +
       "Runechants, each one kept is a point of arcane damage on the next " +
       "swing the card had already charged for. `tier: full` throughout, " +
       "and the one-sided sweep models a payload read too generously, " +
       "never a COST that was skipped. Found by censusing the cost atoms.",
  run(c){
    const W = loadData();
    const h = W.HEROES.find(x => x.k === "viserai");
    const hk = W.HEROES.find(x => x.k === "kayo");
    const ctr = {n: 0};
    let rng = RNG.make("scene-robe");
    /* SEATED EXPLICITLY. `defaultPicks` ranks a chest by printed defence
       and takes Beckoning Haunt (2) over the Robe (0), so a driven game
       never wears it — v4.43's Hood, v4.49's Gun, v4.52's Stilettos. A
       player picks it on the loadout screen, which is this route. */
    const b0 = B.buildSide(h, G.parseDeck(W.DECKS.viserai), c.H.db(),
      {chest: "Runebleed Robe"}, rng, ctr); rng = b0.rng;
    const b1 = B.buildSideDefault(hk, G.parseDeck(W.DECKS.kayo), c.H.db(), rng, ctr);
    const g0 = c.J.newMatch({builds: [b0.b, b1.b], names: [h.n, hk.n],
      heroKeys: ["viserai", "kayo"], rng: b1.rng, first: 0, tokSeq: ctr.n});
    const robe = (g0.sides[0].gear || []).find(x => /Runebleed/.test(x.name));
    const rune = Object.assign({}, c.card("Runechant", 0), {uid: "runeSC"});
    const withRune = Object.assign({}, g0, {turn: 4, sides: g0.sides.map((s, i) =>
      i === 0 ? Object.assign({}, s, {res: 0, board: [{uid: "runeSC", kind: "aura",
                                       spent: false, card: rune}]}) : s)});
    /* WITH NO RUNECHANT IT IS REFUSED, and refused BEFORE the piece
       shatters — a cost is a legality (v3.11). */
    const broke = c.J.legal(g0, {t: "activate", uid: robe && robe.uid}, 0);
    const n = c.reduce(withRune, {t: "activate", uid: robe.uid}, 0);
    const sd = n.sides[0];
    return {
      "the cost names the permanent it spends": c.P.abDestroyBoard(robe && robe.powCard),
      "…and still destroys the piece itself":   !!(robe && robe.powCard && robe.powCard.sd),
      "with no Runechant it is refused":        /Runechant/.test(String(broke || "")),
      "…and the piece survives that refusal":   (g0.sides[0].gear || [])
                                                 .some(x => x.destroyed),
      "the Runechant leaves the arena":         (sd.board || []).length,
      "…for the GRAVEYARD, turn-stamped":      (sd.grave.find(x => x.name === "Runechant") || {})._gy,
      "none survives to pop on the next swing": P.runeCount(sd),
      "the printed prevention lands":           sd.awd,
      "…carrying its printed window":           sd.awdTurn,
      "and the piece shatters too":             (sd.gear || [])
                                                 .some(x => /Runebleed/.test(x.name) && x.destroyed),
      /* AN INSTANT COSTS NO ACTION POINT (CR 8.1.6). */
      "action points spent":                    withRune.sides[0].ap - sd.ap,
      "the board is clean":                     require("../../engine/invariants.js").errors(n).length
    };
  },
  want: {
    "the cost names the permanent it spends": "Runechant",
    "…and still destroys the piece itself": true,
    "with no Runechant it is refused": true,
    "…and the piece survives that refusal": false,
    "the Runechant leaves the arena": 0,
    "…for the GRAVEYARD, turn-stamped": 4,
    "none survives to pop on the next swing": 0,
    "the printed prevention lands": 1,
    "…carrying its printed window": 1,
    "and the piece shatters too": true,
    "action points spent": 0,
    "the board is clean": 0
  }
},

{
  name: "the Crown puts BOTH targets back, in the order the player taps them",
  why: "v4.59 — \"Put target Runeblade attack action card AND target Runeblade " +
       "non-attack action card from your graveyard on top of your deck in any " +
       "order.\" `RX_GY_DECK`'s single-target reader could not have it (a greedy " +
       "capture swallowed \"and target …\"), so `parseHeroPower` refused the line " +
       "and `build.equipPiece` built the piece NO powCard — inert on both boards. " +
       "And one filter cannot say \"one of each\": read as the union it accepts " +
       "TWO attacks, deleting the printed second target.",
  run(c){
    const gr = Object.assign({}, c.card("Crown of Dichotomy", 0), {uid: 41});
    c.P.fxReset(); B.equipPiece(gr); c.P.fxReset();
    const atk = Object.assign({}, c.card("Arcanic Shockwave", 1), {uid: 701});
    const non = Object.assign({}, c.card("Malefic Incantation", 1), {uid: 702});
    const board = grave => c.acting(c.state(
      {gear: [gr], hand: [], grave: grave, deck: [Object.assign({}, c.card("Wounding Blow", 1), {uid: 600})],
       res: 9, ap: 1}, {hp: 20}, {actor: 0, turnPlayer: 0, turn: 3}));
    /* THE ORDER IS THE DECISION, so it is driven BOTH WAYS. A reader that
       always put the attack on top would pass one of these rows perfectly. */
    const run = first => {
      let n = c.reduce(board([atk, non]), {t: "activate", uid: 41, from: "gear"}, 0);
      const at = nm => n.prompt.cards.findIndex(x => x.name === nm);
      const other = first === atk.name ? non.name : atk.name;
      n = c.reduce(n, {t: "promptSel", i: at(first)}, 0);
      n = c.reduce(n, {t: "promptSel", i: at(other)}, 0);
      return c.reduce(n, {t: "promptConfirm"}, 0);
    };
    const a = run(atk.name), b = run(non.name);
    /* AND THE PIECE CANNOT BE SPENT FOR NOTHING. With only one of the two
       types in the graveyard the sheet would skip itself, so the activation
       is refused BEFORE the destroy — v2.04's mirror (v3.11, v4.49). */
    const half = board([atk]);
    return {
      "the piece has an ability at all":      !!gr.powCard,
      "deck top, attack tapped first":        a.sides[0].deck.map(x => x.name).slice(0, 2).join(" then "),
      "deck top, non-attack tapped first":    b.sides[0].deck.map(x => x.name).slice(0, 2).join(" then "),
      "cards left in the graveyard":          a.sides[0].grave.length,
      "the Crown is destroyed by its cost":   !!a.sides[0].gear.find(x => x.uid === 41).destroyed,
      "resources left of 9":                  a.sides[0].res,
      "one type only — refused":              String(c.J.legal(half, {t: "activate", uid: 41, from: "gear"}, 0) || "ALLOWED")
                                                .replace(/^.*needs BOTH/, "needs BOTH")
    };
  },
  want: {
    "the piece has an ability at all": true,
    "deck top, attack tapped first": "Arcanic Shockwave then Malefic Incantation",
    "deck top, non-attack tapped first": "Malefic Incantation then Arcanic Shockwave",
    "cards left in the graveyard": 0,
    "the Crown is destroyed by its cost": true,
    "resources left of 9": 8,
    "one type only — refused": "needs BOTH its targets, and your graveyard cannot supply them"
  }
}

];
