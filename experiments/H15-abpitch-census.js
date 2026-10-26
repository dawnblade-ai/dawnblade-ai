const R=process.argv[2];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const T={}; const inc=(h,k)=>{T[h]=T[h]||{}; T[h][k]=(T[h][k]||0)+1;};
for(let i=0;i<15;i++) for(const j of [1,4,8,11]){ const HERO=HEROES[i], foe=HEROES[(i+j)%15];
  for(const first of [0,1]){ const [k0,k1]=first===0?[HERO,foe]:[foe,HERO]; const me=first;
  let g=match(k0,k1,`${k0}-${k1}-0`,0), st=0;
  while(!g.over && st<4000){ let m=false;
    for(const s of [0,1]){ const e=SP.explain(g,s); const a=e.action; if(!a) continue;
      if(s===me && (e.key==="heroAbility"||e.key==="gearAbility")){
        const o=J.reduce(g,a,s); const pitched=!o.error && o.state.pending && o.state.pending.seat===s;
        inc(HERO, `${e.key}${g.turnPlayer===me?"":" (opp turn)"} ap${g.sides[me].ap>0?">0":"0"} ${pitched?"PITCH":"free"}`);
        if(e.key==="gearAbility") inc(HERO, "  gear: "+e.line+(pitched?" PITCH":" free"));
      }
      const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; st++; m=true; break; }
    if(!m) break; } } }
for(const [h,t] of Object.entries(T)) { console.log(h); Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log("   ",String(v).padStart(4),k)); }
