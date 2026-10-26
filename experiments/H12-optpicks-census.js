const R=process.argv[2]; const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const T={};
for(let i=0;i<HEROES.length;i++) for(const j of [3,7]){ const k0=HEROES[i], k1=HEROES[(i+j)%15];
  for(const first of [0,1]){ const [a,b]=first?[k1,k0]:[k0,k1];
  let g=match(a,b,`${a}-${b}-0`,0), steps=0;
  while(!g.over && steps<3000){ let moved=false;
    for(const s of [0,1]){ const act=SP.act(g,s); if(!act) continue;
      const p=g.prompt; if(p && p.tag==="pick" && !(p.min>0) && (p.side||0)===s && !(p.sel||[]).length && act.t==="promptConfirm"){
        const k=`${p.src} | ${p.zone}->${p.to} ops:${(p.ops||[]).map(o=>o[0]).join("+")||"-"} cost:${p.cost||0} cands:${(p.cards||[]).length}`.replace(/cands:\d+/, m=>+m.slice(6)>0?"cands>0":"cands0");
        T[k]=(T[k]||0)+1; }
      const o=J.reduce(g,act,s); if(o.error) continue; g=o.state; steps++; moved=true; break; }
    if(!moved) break; } } }
Object.entries(T).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
