const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="lyath", CARD="Power Play"; const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); let shown=0;
for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){ if(shown>=3) break;
  let g=match(a,b,`ar-${a}-${b}-0`,0); const seat=a===hero?0:1; let watch=null, log=[];
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const e=SP.explain(g,sd); const x=e.action; if(!x) continue;
      if(sd===seat&&g.arsenalFor===sd){ const c=(g.sides[sd].hand||[]).find(c=>c.uid===x.uid); if(c&&c.name===CARD){ watch=c.uid; log=["stored t"+g.turn]; } }
      if(watch && sd===seat && g.turnPlayer===sd && !g.prompt && !J.pendingOf(g) && g.sides[sd].arsenal && g.sides[sd].arsenal.uid===watch){
        const lg=J.legal(g,{t:"play",uid:watch,from:"arsenal"},sd); log.push("t"+g.turn+" legal:"+(lg||"yes")+" res"+g.sides[sd].res+" ap"+g.sides[sd].ap+" hand"+g.sides[sd].hand.length+" -> "+e.key+" "+x.t+(x.from?"@"+x.from:"")); }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
  if(watch){ shown++; console.log(a,b, log.slice(0,8).join(" | ")); } }
