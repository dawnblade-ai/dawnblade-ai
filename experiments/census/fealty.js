// Fai: own-turn windows where she holds a Fealty token and plays an attack; was that attack Draconic already,
// and which non-Draconic attacks went out while a Fealty sat unused (Dragon Power gets +3 if Draconic).
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="fai", seeds=+process.argv[2]||3, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, T={games:0, fealtyTurns:0, fealtyExpired:0, plays:0};
const isDrac=c=>/Draconic/.test(c.type_text||c.tt||"");
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`fe-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; T.games++; let seen=null;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false; const S=g.sides[seat];
    const fe=(S.board||[]).filter(b=>b&&b.card&&b.card.name==="Fealty").length;
    if(g.turnPlayer===seat&&seen!==g.turn&&fe){ seen=g.turn; T.fealtyTurns++; }
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat&&g.turnPlayer===seat&&x.t==="play"&&fe){ const c=(S.hand||[]).concat(S.arsenal?[S.arsenal]:[]).find(c=>c&&c.uid===x.uid);
        if(c){ T.plays++; const k=(isDrac(c)?"drac ":"NON-drac ")+c.name; K[k]=(K[k]||0)+1; } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log(T, Object.entries(K).sort((x,y)=>y[1]-x[1]).slice(0,16));
