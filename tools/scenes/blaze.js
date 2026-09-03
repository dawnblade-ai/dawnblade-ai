/* BLAZE, FIREMIND — energy counters, and a cost coupled to the choice.

   "Whenever you opt, put energy counters on Blaze equal to the number of
    cards looked at this way.
    Once per Turn Instant - Remove X energy counters from Blaze: Banish a
    Wizard non-attack action card from your hand with an effect that deals
    arcane damage equal to X. You may play it this turn as though it were
    an instant." */
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
  name: "X is not a free variable — the CHOSEN card settles it",
  why: "v3.39 — X looks like the X-cost family this project refuses (Ice " +
       "Eternal), and it is not. The player picks a card and X is that " +
       "card's OWN arcane, so the coupling lives in the FILTER and the " +
       "price is settled by the choice; nothing asks for a number. And " +
       "`arcAmount` counts the UNCONDITIONAL ops only, because it IS the " +
       "price: Emeritus Scolding prints 4 with a conditional 6, and " +
       "charging 6 for a card that deals 4 is the wrong direction.",
  run(c){
    const b = built(c, "blaze");
    const pool = require("../../data/pool.json");
    const es = pool.find(x => x.name === "Emeritus Scolding");
    const card = {name: "Emeritus Scolding probe", pitch: es.pitch, tt: es.type_text,
                  ty: es.types, kw: es.card_keywords, tx: es.functional_text};
    return {
      "his energy passive is built": b.energyOnOpt,
      "his ability is built at all": !!b.HPOW,
      "…and it is an INSTANT":       !!(b.HPOW && b.HPOW._instant),
      "it spends counters, not resources": (b.HPOW || {}).cost,
      "Emeritus Scolding's PRICE is its unconditional arcane":
        P.arcAmount(card)
    };
  },
  want: {
    "his energy passive is built": true,
    "his ability is built at all": true,
    "…and it is an INSTANT": true,
    "it spends counters, not resources": 0,
    "Emeritus Scolding's PRICE is its unconditional arcane": 4
  }
},

{
  name: "a REORDER is not an opt, so it feeds him nothing",
  why: "v3.72 — Spire Sniping prints \"look at the top 2 cards of your " +
       "deck, then put them back IN ANY ORDER\". Opt lets you send cards " +
       "to the BOTTOM, so reading it as opt is wrong in both directions " +
       "at once: stronger, because a card could be buried — and it would " +
       "fire THIS hero's \"whenever you OPT\" energy trigger off a card " +
       "that does not opt. A card does not opt because it looks.",
  run(c){
    const pool = require("../../data/pool.json");
    const ss = pool.find(x => x.name === "Spire Sniping");
    const fx = P.fxParse({name: "Spire Sniping probe", pitch: ss.pitch,
                          tt: ss.type_text, ty: ss.types, kw: ss.card_keywords,
                          tx: ss.functional_text});
    const ops = JSON.stringify(fx.arsenalUp || fx.ops || []);
    return {
      "it emits a lookOrder op": /lookOrder/.test(ops),
      "…and never an opt":       !/\["opt"/.test(ops)
    };
  },
  want: {"it emits a lookOrder op": true, "…and never an opt": true}
}

];
