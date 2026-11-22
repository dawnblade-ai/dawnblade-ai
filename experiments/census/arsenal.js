const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"lyath", CARD=process.argv[3]||"Power Play";
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); const K={};
for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`ar-${a}-${b}-0`,0); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat&&g.arsenalFor===sd){ const S=g.sides[sd]; const has=(S.hand||[]).some(c=>c.name===CARD);
        const k=(has?"HAS ":"no  ")+(S.arsenal?"(ars full) ":"")+"-> "+(((S.hand||[]).find(c=>c.uid===x.uid)||{}).name||"skip"); K[k]=(K[k]||0)+1; }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
Object.entries(K).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([k,v])=>console.log(String(v).padStart(4),k));
