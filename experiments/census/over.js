// Every Sharp overrule for a hero: a0 -> pick (why). node over.js <hero> <seeds>
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"viseraibw", seeds=+process.argv[3]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}; let games=0,wins=0;
const nm=(g,sd,x)=>{ if(!x) return "null"; const S=g.sides[sd]; const all=[...(S.hand||[]),S.arsenal,...(S.banish||[]).map(b=>b&&b.card||b),...(S.grave||[]),...(S.gear||[]),...(S.board||[]).map(b=>b&&b.card)]; const c=all.find(c=>c&&c.uid===x.uid); return x.t+":"+(c?c.name:(x.uid||""))+(x.from&&x.from!=="hand"?"@"+x.from:"");};
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`ov-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ let x;
      if(sd===seat){ const e=SP.explain(g,sd,{search:true}); x=e.action; if(x&&/^la/.test(e.key)){ const a0=SP.actBase(g,sd); const k=e.key+" "+nm(g,sd,a0)+" => "+nm(g,sd,x); K[k]=(K[k]||0)+1; } }
      else x=SP.act(g,sd);
      if(!x) continue;
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log({games,wins}); Object.entries(K).sort((a,b)=>b[1]-a[1]).slice(0,45).forEach(([k,v])=>console.log(String(v).padStart(4),k));
