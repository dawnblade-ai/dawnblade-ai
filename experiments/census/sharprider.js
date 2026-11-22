// Sharp vs the rule policy where Embrace Ursur leads (riderLead). node sharprider.js <seeds>
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="viseraibw", seeds=+process.argv[2]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}; const ex=[];
const nm=(g,sd,x)=>{const S=g.sides[sd]; const c=[...(S.hand||[]),S.arsenal,...(S.banish||[]).map(b=>b&&b.card||b)].find(c=>c&&c.uid===x.uid); return x.t+":"+(c?c.name:(x.from||x.uid||""))+(x.from?"@"+x.from:"");};
function roll(n,seat,root){ const stop=root.turn+1; let st=0; while(st<400&&!n.over&&n.turn<stop){let mv=false; for(const s of [0,1]){const a=SP.actBase(n,s); if(!a)continue; const o=J.reduce(n,a,s); if(o.error)continue; n=o.state; st++; mv=true; break;} if(!mv)break;} return n;}
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`sr-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd,sd===seat?{search:true}:undefined); if(!x) continue;
      if(sd===seat && g.turnPlayer===sd && !g.prompt && !J.pendingOf(g)){
        const a0=SP.actBase(g,sd); const S=g.sides[sd];
        const c0=a0&&(S.hand||[]).find(c=>c.uid===a0.uid);
        if(a0&&a0.t==="play"&&c0&&c0.name==="Embrace Ursur"&&J.riderLead(g,sd,a0.uid,a0.from)){
          const same=x.t===a0.t&&x.uid===a0.uid;
          const k=same?"KEPT EU":"OVERRULED -> "+nm(g,sd,x); K[k]=(K[k]||0)+1;
          if(!same&&ex.length<8){ const root=SP.laMask(g,sd,0); const cs=SP.laCands(g,sd,a0);
            const rows=cs.map(c=>{const o=J.reduce(root,c,sd); if(o.error) return [nm(g,sd,c),"ERR"]; const n=roll(o.state,sd,root); const e=SP.laEval(n,sd,root); return [nm(g,sd,c),+e.v.toFixed(2),e.dealt,e.taken,e.cards,e.board];});
            ex.push({turn:g.turn,hand:S.hand.map(c=>c.name+"("+c.pitch+")"),res:S.res,rows}); }
        }
      }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log(K); ex.forEach(e=>console.log(JSON.stringify(e)));
