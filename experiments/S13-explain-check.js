const R = process.argv[2];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const assert = require("assert");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const keys = {}, types = {}, bad = []; let states = 0, nulls = 0;
for(let i = 0; i < HEROES.length; i++){ const k0 = HEROES[i], k1 = HEROES[(i + 3) % HEROES.length];
  for(const first of [0,1]){
    let g = match(k0, k1, `${k0}-${k1}-ex`, first), steps = 0;
    while(!g.over && steps < 4000){ let moved = false;
      for(const s of [0,1]){
        const a = SP.act(g, s), e = SP.explain(g, s); states++;
        try { assert.deepStrictEqual(e.action, a); } catch(err){ bad.push(["mismatch", k0, k1, s, JSON.stringify(a), JSON.stringify(e.action)]); }
        if(!a){ nulls++; continue; }
        types[a.t] = (types[a.t]||0)+1; keys[e.key] = (keys[e.key]||0)+1;
        if(!e.why) bad.push(["no-why", a.t, e.key]);
        if(!e.line || e.line === a.t) bad.push(["no-line", a.t, JSON.stringify(a)]);
        const o = J.reduce(g, a, s); if(o.error) continue; g = o.state; steps++; moved = true; break; }
      if(!moved) break; } } }
console.log("states", states, "null", nulls, "bad", bad.length); bad.slice(0, 12).forEach(b => console.log("  ", b.join(" | ")));
console.log("types", JSON.stringify(types)); console.log("keys", JSON.stringify(keys));
const unused = Object.keys(SP.CALL_WHY).filter(k => !keys[k]); console.log("WHY keys never reached:", unused.join(", "));
