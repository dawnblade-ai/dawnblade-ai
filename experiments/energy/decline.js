const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const H=W.HEROES.map(h=>h.k); const T={};
for(let s=0;s<1;s++) for(const a of H) for(const b of H){ if(a===b) continue;
  let g=match(a,b,`${a}-${b}-${s}`,s%2);
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const e=SP.explain(g,sd); const x=e.action; if(!x) continue;
      if(g.prompt && g.prompt.tag==="pick" && (g.prompt.side||0)===sd){
        const k=g.sides[sd].heroKey+" | "+g.prompt.src+" | "+(g.prompt.zone)+"->"+g.prompt.to+" | "+e.key;
        if(x.t==="promptConfirm") T[k]=(T[k]||0)+1; }
      const o=J.reduce(g,x,sd); if(o.error) continue; g=o.state; mv=true; break; }
    if(!mv) break; } }
Object.entries(T).filter(([k])=>/declineOptional/.test(k)).sort((x,y)=>y[1]-x[1]).slice(0,40).forEach(r=>console.log(r[1],r[0]));
