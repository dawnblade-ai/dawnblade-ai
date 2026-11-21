const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const T = require("/home/user/dawnblade-ai/engine/types.js");
const seeds=+process.argv[2]||1; const only=process.argv[3]||"";
const keys=W.HEROES.map(h=>h.k);
const C={};
for(let s=0;s<seeds;s++) for(const a of keys) for(const b of keys){ if(a===b) continue; if(only && a!==only && b!==only) continue;
  let g=match(a,b,`rx-${a}-${b}-${s}`,s%2);
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const e=SP.explain(g,sd); const x=e.action;
      const why=e.key;
      if(!x) continue;
      if(why==="rxAttack"){ const S=g.sides[sd]; const c=[...(S.hand||[]),S.arsenal].find(c=>c&&c.uid===x.uid);
        const hk=(sd===0?a:b); const k=hk+" | "+(c?c.name:"?")+" | "+(c&&(c.types||c.ty||[]).join? (c.types||c.ty).join("/"):""); C[k]=(C[k]||0)+1; }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
Object.entries(C).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(5),k));
