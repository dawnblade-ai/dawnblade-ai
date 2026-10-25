/* For each spec field, the first census leg (pairing, chair, seed) that reaches it. */
const R = process.argv[2], WANT = process.argv[3].split(",");
const PM = require(R + "/engine/prompts.js");
let seen = new Set(); const real = PM.buildPrompt;
PM.buildPrompt = function(game, spec){ if(spec && typeof spec === "object") for(const k of Object.keys(spec)) seen.add(k); return real.apply(this, arguments); };
const T = require(R + "/tools/tournament.js"); const E = T.ENTRANTS; const found = {};
outer: for(let i = 0; i < E.length; i++) for(let j = 0; j < E.length; j++){ if(i === j) continue;
  for(const first of [0, 1]){ seen = new Set(); const seed = `fs-${i}-${j}-${first}`; T.leg(E[i], E[j], seed, first);
    for(const f of WANT) if(!found[f] && seen.has(f)) found[f] = `T.leg(E[${i}], E[${j}], "${seed}", ${first})  // ${E[i].name} v ${E[j].name}`;
    if(WANT.every(f => found[f])) break outer; } }
for(const f of WANT) console.log(f.padEnd(9), found[f] || "NONE");
