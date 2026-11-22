// Bravo: at each use of his hero ability, what is face-down in his arsenal (crush or not)?
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const PR=require("/home/user/dawnblade-ai/engine/parser.js");
const hero="bravo", seeds=+process.argv[2]||3, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, T={turnsWithArs:0, crushArs:0, turns:0};
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`bh-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; let seen=null;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    if(g.turnPlayer===seat&&seen!==g.turn){ seen=g.turn; T.turns++; const A=g.sides[seat].arsenal; if(A){ T.turnsWithArs++; if(PR.hasKw(A,"crush")) T.crushArs++; } }
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat && x.t==="activate" && x.from==="hero"){ const A=g.sides[seat].arsenal; const k=(A?(A.name+(PR.hasKw(A,"crush")?" [crush]":"")):"(empty)")+(A&&A.faceUp?" faceUp":""); K[k]=(K[k]||0)+1; }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log(T, Object.entries(K).sort((x,y)=>y[1]-x[1]).slice(0,12));
