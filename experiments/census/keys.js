const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"blaze", seeds=+process.argv[3]||1, want=(process.argv[4]||"energyOff,energyOffPlay,energyPick").split(",");
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); const K={}; let games=0,wins=0,errs=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`k-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ let x;
      if(sd===seat){ const e=SP.explain(g,sd); x=e&&e.action; if(e&&want.indexOf(e.key)>=0){const k=e.key+" "+(g.turnPlayer===seat?"own":"opp"); K[k]=(K[k]||0)+1;} }
      else x=SP.act(g,sd);
      if(!x) continue; const r=J.reduce(g,x,sd); if(r.error){ if(sd===seat) errs++; continue;} g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log({games,wins,errs},K);
