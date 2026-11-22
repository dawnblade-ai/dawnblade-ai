// Cloak-perf probe (2026-11-22, SPXCLOAK). Scratch paths are the worker's; adjust before running.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const keys=W.HEROES.map(h=>h.k); const K={};const inc=k=>K[k]=(K[k]||0)+1;
for(const hero of ["dorinthea","fai"]) for(let s=0;s<3;s++) for(const o of keys.filter(k=>k!==hero)){ const seat=s%2;
  let g=match(seat?o:hero, seat?hero:o, `po-${hero}-${o}-${s}`, s%2);
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat){ const S=g.sides[seat]; const own=g.turnPlayer===seat?"own":"opp";
        const hp=(S.hand||[]).find(c=>c&&c.name==="Energy Potion"); if(hp&&x.t==="play"&&x.uid===hp.uid) inc(hero+" played "+own);
        if(hp&&x.t==="paySel"&&x.uid===hp.uid) inc(hero+" pitched "+own);
        const bp=(S.board||[]).find(c=>c&&c.name==="Energy Potion");
        if(bp){ inc(hero+" on board step "+own); if(!g.pending&&!g.prompt&&!J.legal(g,{t:"activate",uid:bp.uid},seat)) inc(hero+" legal "+own+" gain "+J.abPieceResGain(g,seat,bp.uid));
          if(x.t==="activate"&&x.uid===bp.uid) inc(hero+" ACTIVATED "+own+" "+SP.explain(g,seat).key); } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
console.log(K);
