// After Iyslander casts Stir the Aetherwinds on the opponent's turn: what her seat does next that turn.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="iyslander", seeds=+process.argv[2]||3, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, F={}; let casts=0, hold=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`calls-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; let watch=null;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat){ const S=g.sides[seat];
        if(watch && watch.turn===g.turn && x.t!=="pass"){ const e=SP.explain(g,seat); const c=(S.hand||[]).concat(S.arsenal?[S.arsenal]:[]).find(c=>c&&c.uid===x.uid); const k=x.t+" "+(e&&e.key)+" "+(c?c.name:""); K[k]=(K[k]||0)+1; }
        if(x.t==="play" && g.turnPlayer!==seat && S.arsenal && S.arsenal.uid===x.uid && S.arsenal.name==="Stir the Aetherwinds"){ casts++; watch={turn:g.turn};
          const m=(S.hand||[]).filter(c=>c&&/Wizard/.test(c.type_text||c.tt||"")&&!/Attack/.test(c.type_text||"")).map(c=>c.name); F[m.length?"wizard non-atk in hand":"none in hand"]=(F[m.length?"wizard non-atk in hand":"none in hand"]||0)+1; } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log({casts},F,K);
