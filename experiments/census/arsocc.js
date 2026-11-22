// At the start of each of the hero's own turns: what sits in its arsenal, and for how many own turns in a row.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2], seeds=+process.argv[3]||1, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const occ={}, runs={}, used={}; let turns=0, games=0, goldLegal=0, goldUsed=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`ao-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++; let last=null, lastUid=null, run=0, seenT=null;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    if(g.turnPlayer===seat && seenT!==g.turn){ seenT=g.turn; turns++; const A=g.sides[seat].arsenal; const nm=A?A.name+"("+A.pitch+")":"(empty)";
      occ[nm]=(occ[nm]||0)+1; if(A&&A.uid===lastUid) run++; else { if(last) { const k=last+" x"+Math.min(run,5); runs[k]=(runs[k]||0)+1; } run=1; } last=nm; lastUid=A?A.uid:null; }
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue; const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,14);
console.log({games,turns},"\nOCC",top(occ),"\nRUNS(own turns held in a row)",top(runs));
