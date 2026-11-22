// Fai: at each own-turn PLAY decision while a Fealty sits on her board: the card, and dracGrantFor's answer.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="fai", seeds=+process.argv[2]||1, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); const K={};
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`fe-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false; const S=g.sides[seat];
    for(const sd of [0,1]){ const e=sd===seat?SP.explain(g,sd):null; const x=sd===seat?e&&e.action:SP.act(g,sd); if(!x) continue;
      if(sd===seat&&g.turnPlayer===seat&&(S.board||[]).some(b=>b&&b.card&&b.card.name==="Fealty")&&(x.t==="play"||e.key==="fealtyFirst")){
        const c=x.t==="play"?(S.hand||[]).concat(S.arsenal?[S.arsenal]:[]).find(c=>c&&c.uid===x.uid):null;
        const k=e.key==="fealtyFirst"?"FEALTY FIRST":(c?c.name:"?")+" "+(c&&/Draconic/.test(c.tt||"")?"drac":"non")+" via "+x.from+" key "+e.key+" grant "+JSON.stringify(c?J.dracGrantFor(g,seat,c.uid,x.from):null);
        K[k]=(K[k]||0)+1; }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log(Object.entries(K).sort((x,y)=>y[1]-x[1]).slice(0,25));
