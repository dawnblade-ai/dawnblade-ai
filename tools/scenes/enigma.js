/* ENIGMA — the hero with NOTHING read, and the two things blocking her.

   "Your first Spectral Shield attack each turn costs {r} less to activate.
    Once per Turn Instant - {c}{c}{c}: Create a Spectral Shield token with
    a +1{p} counter."

   THESE SCENES PIN WHY, so the next session does not re-derive it. Her
   whole engine is Spectral Shields turned into weapons by COSMO, and her
   clause 2 is priced in a symbol that appears on exactly one record in
   the pool — her own — for which the database prints no reminder text. */
const P = require("../../engine/parser.js");

module.exports = [

{
  name: "the {c} symbol is unruled, and refusing it is the honest answer",
  why: "The golden rule at the keyword level. `{c}` appears on ONE record " +
       "in 797 — hers — and the database prints no reminder text for it. " +
       "The SEN001 card face shows three blue-grey spirals, visually " +
       "distinct from the red {r} pip on the line above, and names them " +
       "nowhere. Guessing what resource it is would be inventing card " +
       "text; creating a Spectral Shield for free would be strictly " +
       "stronger than printed. It is booked as a question, not built.",
  run(c){
    const pool = require("../../data/pool.json");
    const withC = pool.filter(x => /\{c\}/.test(x.functional_text || ""));
    const her = pool.find(x => x.name === "Enigma" && /Hero/.test(x.type_text || ""));
    const hp = P.parseHeroPower(her.functional_text, true);
    return {
      "records in the pool printing {c}": withC.length,
      "…and the only one is":             withC.map(x => x.name).join(","),
      "no reminder text explains it":     !/\{c\}[^]*\(/.test(her.functional_text || ""),
      "so her ability is REFUSED rather than made free": hp === null
    };
  },
  want: {
    "records in the pool printing {c}": 1,
    "…and the only one is": "Enigma",
    "no reminder text explains it": true,
    "so her ability is REFUSED rather than made free": true
  }
},

{
  name: "her clause 1 waits on COSMO, which is what makes a Shield attack",
  why: "\"Your first Spectral Shield ATTACK each turn costs {r} less to " +
       "ACTIVATE\" — and the Spectral Shield token's entire printed text " +
       "is \"Ward 1\". It has no attack. Cosmo, Scroll of Ancestral " +
       "Tapestry is what grants one: \"during your turn, auras you control " +
       "with ward are weapons with base {p} equal to their ward and 'Once " +
       "per Turn Action - {r}: Attack'\". Build Cosmo and the clause " +
       "becomes reachable; until then there is no such attack to discount.",
  run(c){
    const pool = require("../../data/pool.json");
    const shield = pool.find(x => x.name === "Spectral Shield");
    const cosmo = pool.find(x => /^Cosmo/.test(x.name || ""));
    const cx = {name: cosmo.name, tt: cosmo.type_text, ty: cosmo.types,
                kw: cosmo.card_keywords, tx: cosmo.functional_text,
                pitch: cosmo.pitch, power: cosmo.power};
    return {
      "the token's whole text":        (shield.functional_text || "").replace(/\*/g, ""),
      "…so it prints no attack":       !/attack/i.test(shield.functional_text || ""),
      "Cosmo grants one":              /are weapons with base/i.test(cosmo.functional_text || ""),
      "…and Cosmo READS now (v3.84)":  P.fxParse(cx).tier,
      "a POWERLESS card is still not a swing itself (v3.44)": P.allyAttack(cx) == null,
      "the Shield's ward is its base {p}":
        P.auraAttackOf({name: shield.name, tt: shield.type_text, ty: shield.types,
                        kw: shield.card_keywords, tx: shield.functional_text},
                       {gear: [cx]}, {yourTurn: true}).power
    };
  },
  want: {
    "the token's whole text": "Ward 1",
    "…so it prints no attack": true,
    "Cosmo grants one": true,
    "…and Cosmo READS now (v3.84)": "full",
    "a POWERLESS card is still not a swing itself (v3.44)": true,
    "the Shield's ward is its base {p}": 1
  }
}

];
