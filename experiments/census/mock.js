// Lyath's Mocking Blow at each play: already booed this turn? more life than the foe (the on-attack boo)? its engine power now.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="lyath", seeds=+process.argv[2]||3, keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); const K={}; let others={};
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`mb-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat&&x.t==="play"){ const S=g.sides[seat]; const c=(x.from==="arsenal"?[S.arsenal]:S.hand||[]).find(c=>c&&c.uid===x.uid);
        if(c&&c.name==="Mocking Blow"){ const ep=J.effPowerNow(g,seat,c.uid,x.from); const more=S.hp>g.sides[1-seat].hp;
          const k=(ep&&ep.gates.includes("booed")?"booed":"not booed")+" / "+(more?"more life (boos on attack)":"not more life")+" / power "+(ep?ep.power:"?");
          K[k]=(K[k]||0)+1;
          const alt=(S.hand||[]).filter(h=>h&&h.uid!==c.uid&&+h.power>0).map(h=>h.name); if(!(ep&&ep.gates.includes("booed"))&&!more) others[alt.length?"other attack held":"no other attack"]=(others[alt.length?"other attack held":"no other attack"]||0)+1; } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
console.log(K, "\nbare 1-power plays:", others);
