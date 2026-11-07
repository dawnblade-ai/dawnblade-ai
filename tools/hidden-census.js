/* tools/hidden-census.js — HIDDEN HANDS research (HIDDEN-HANDS.md §2).
   Asks the PARSER, not a person: every card of every pinned precon is run
   through fxParse, and every op head its parse emits is collected and
   classed by whether it touches hidden information or a random/secret choice.
   The text sweep beside it is a CROSS-CHECK only (a clause the parser refuses
   still needs a protocol case once it is built). Measuring instrument, not a drill.
       node tools/hidden-census.js            # summary
       node tools/hidden-census.js --cards    # every card per class      */
const S  = require("./selfplay.js");
const PR = require("../engine/parser.js");
const W = S.W;

/* op head -> protocol class. Heads not listed are public-information ops. */
const CLASS = {
  draw: "DRAW (top of own deck -> hand)", drawFoe: "DRAW", draws: "DRAW",
  opt: "LOOK/REORDER top of deck", lookTop: "LOOK/REORDER top of deck", reorder: "LOOK/REORDER top of deck",
  reveal: "REVEAL (hand/deck)", revealTop: "REVEAL (top of deck)", revealHand: "REVEAL (hand/deck)",
  search: "SEARCH a deck", tutor: "SEARCH a deck", shuffle: "SHUFFLE",
  discardRandom: "RANDOM pick from a hand", intimidate: "RANDOM pick from a hand (intimidate)",
  banishTop: "TOP OF DECK leaves face-up", mill: "TOP OF DECK leaves face-up", millTop: "TOP OF DECK leaves face-up",
  bottom: "PUT ON BOTTOM (hidden destination)", toBottom: "PUT ON BOTTOM (hidden destination)",
  discard: "DISCARD from hand (chooser)", discardFoe: "DISCARD from hand (chooser)",
  arsenal: "TO ARSENAL face-down", toArsenal: "TO ARSENAL face-down",
  roll: "RANDOM roll (die)", d6: "RANDOM roll (die)", random: "RANDOM",
  steal: "TAKE opponent's card", peek: "LOOK at a hand",
  foeDiscard: "RANDOM/CHOSEN discard from the OPPONENT's hand", foeDiscardUnlessReveal: "REVEAL (hand/deck)",
  foePick: "OPPONENT chooses from its hidden hand", foeHandToDeck: "HAND -> DECK (hidden destination)",
  revPitch: "REVEAL (hand/deck)", revColorPitch: "REVEAL (hand/deck)", revWard: "REVEAL (hand/deck)", foeReveal: "REVEAL (hand/deck)",
  foeBanish: "TOP OF DECK leaves face-up", foeBanishTop: "TOP OF DECK leaves face-up", foeDeckDestroy: "TOP OF DECK leaves face-up",
  intRoll: "RANDOM roll (die)", bottomSelf: "PUT ON BOTTOM (hidden destination)", foeArsBottom: "FACE-DOWN ARSENAL leaves/flips",
  allArsBottom: "FACE-DOWN ARSENAL leaves/flips", foeArsUp: "FACE-DOWN ARSENAL leaves/flips", foeArsBanish: "FACE-DOWN ARSENAL leaves/flips",
  foeArsDestroy: "FACE-DOWN ARSENAL leaves/flips", eachArsPut: "TO ARSENAL face-down", lookOrder: "LOOK/REORDER top of deck",
  charge: "HAND -> SOUL (charge: a hand card leaves)", selfDiscard: "DISCARD from hand (chooser)", reload: "TO ARSENAL face-down"
};
const TEXT = [
  ["reveal", /\breveals?\b/i], ["random", /\brandom/i], ["search", /\bsearch/i],
  ["shuffle", /\bshuffle/i], ["top of", /\btop (?:card )?of\b|\btop \w+ cards?\b/i],
  ["bottom of", /\bbottom of\b/i], ["face down", /face[- ]down/i], ["look at", /\blook at\b/i],
  ["intimidate", /\bintimidate/i], ["opponent's hand", /(?:opponent|hero)'s hand|their hand/i],
  ["draw", /\bdraws?\b/i], ["roll", /\broll\b|\bd6\b|six-sided/i], ["arsenal", /\barsenal\b/i]
];
const heads = (v, out) => {
  if(Array.isArray(v)){ if(typeof v[0] === "string" && v[0].length < 24) out.add(v[0]); v.forEach(x => heads(x, out)); }
  else if(v && typeof v === "object") Object.values(v).forEach(x => heads(x, out));
  return out;
};
const seen = new Map();                 /* card name|pitch -> {card, decks} */
for(const h of W.HEROES){
  if(!W.DECKS[h.k]) continue;
  let g; try { g = S.match(h.k, h.k, "census", 0); } catch(e){ continue; }
  const sd = g.sides[0];
  const all = [].concat(sd.deck, sd.hand, sd.gear || [], sd.arsenal ? [sd.arsenal] : []);
  for(const c of all){ if(!c) continue; const k = c.name + "|" + (c.pitch || 0);
    if(!seen.has(k)) seen.set(k, {c, decks: new Set()}); seen.get(k).decks.add(h.k); }
  const hr = g.builds[0] && g.builds[0].heroRec; if(hr) seen.set("HERO " + h.n, {c: hr, decks: new Set([h.k])});
}
const byClass = {}, byText = {}, allHeads = {}, byKw = {};
/* keywords whose RULES touch hidden information (CR 8.3): asked of the parser's predicate */
const KW = ["boost", "clash", "opt", "intimidate", "reload", "charge", "crush", "blade break", "unfreeze", "spellvoid"];
for(const [k, {c, decks}] of seen){
  let fx = null; try { fx = PR.fxParse(c); } catch(e){}
  const hs = fx ? heads(fx, new Set()) : new Set();
  for(const w of KW) { let hit = false; try { hit = PR.hasKw(c, w); } catch(e){} if(hit) (byKw[w] = byKw[w] || []).push(k); }
  hs.forEach(x => (allHeads[x] = (allHeads[x] || 0) + 1));
  for(const x of hs) if(CLASS[x]) (byClass[CLASS[x]] = byClass[CLASS[x]] || []).push(k + " [" + [...decks].join(",") + "] <" + x + ">");
  const txt = String(c.tx || c.text || "");
  for(const [lab, re] of TEXT) if(re.test(txt)) (byText[lab] = byText[lab] || []).push(k);
}
const out = {cards: seen.size, byClass, byText, byKw, allHeads};
if(process.argv.includes("--json")) { console.log(JSON.stringify(out, null, 1)); return; }
console.log("distinct cards (name|pitch, incl. gear/hero):", seen.size);
console.log("\n== PARSER: hidden-information op classes ==");
for(const [k, v] of Object.entries(byClass).sort()) { console.log(String(v.length).padStart(4), k); if(process.argv.includes("--cards")) v.forEach(x => console.log("       ", x)); }
console.log("\n== PARSER: keywords (hasKw) ==");
for(const [k, v] of Object.entries(byKw).sort()) { console.log(String(v.length).padStart(4), k); if(process.argv.includes("--cards")) v.forEach(x => console.log("       ", x)); }
console.log("\n== TEXT cross-check (cards whose printed text says it) ==");
for(const [k, v] of Object.entries(byText).sort()) { console.log(String(v.length).padStart(4), k); if(process.argv.includes("--cards")) v.forEach(x => console.log("       ", x)); }
if(process.argv.includes("--heads")) console.log("\nall op heads:", Object.entries(allHeads).sort((a,b)=>b[1]-a[1]).map(([k,n])=>k+":"+n).join(" "));
