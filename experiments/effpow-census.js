/* census of conditional self-pumps over the cards the 15 precons hold:  node experiments/effpow-census.js */
const fs = require("fs"), path = require("path");
const {match, W} = require("../tools/selfplay.js"); const P = require("../engine/parser.js");
const src = fs.readFileSync(path.join(__dirname, "../engine/effects.js"), "utf8");
const i = src.indexOf("const EFF_DECIDABLE"), j = src.indexOf("function effPowerNow");
const DEC = eval("(" + src.slice(i, j).replace(/^const EFF_DECIDABLE = /, "").replace(/;\s*$/, "") + ")");
const seen = {}, byKind = {};
for(const h of W.HEROES){
  const g = match(h.k, h.k === "kayo" ? "dash" : "kayo", "census", 0);
  for(const c of g.sides[0].deck.concat(g.sides[0].hand || [])){
    if(!c || !c.name || seen[c.name + "|" + c.pitch]) continue; seen[c.name + "|" + c.pitch] = 1;
    const fx = P.fxParse(c);
    for(const e of (fx.conds || [])){
      if(!e || !e.op || e.op[0] !== "self" || !(+e.op[1] > 0)) continue;
      const kind = e.cond.replace(/[:\d].*$/, "") + (/^(playedCls|board|noCtr|atkNamed)/.test(e.cond) ? ":" : "");
      const k = byKind[kind] = byKind[kind] || {cards: new Set(), dec: 0, undec: 0, ex: e.cond};
      k.cards.add(c.name);
      DEC(e.cond, "hand") ? k.dec++ : k.undec++;
    }
  }
}
let cards = new Set(); let d = 0, u = 0;
for(const [k, v] of Object.entries(byKind).sort((a, b) => b[1].cards.size - a[1].cards.size)){
  v.cards.forEach(c => cards.add(c)); d += v.dec; u += v.undec;
  console.log(k.padEnd(14), "cards", String(v.cards.size).padStart(3), "decides", v.dec, "printed", v.undec, " e.g.", v.ex);
}
console.log("distinct unique card printings in pool decks:", Object.keys(seen).length, "| with a conditional self-pump:", cards.size, "| conds decidable:", d, "undecidable:", u);
