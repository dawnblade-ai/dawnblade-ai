const R=process.argv[2], HERO=process.argv[3];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const T={}; const inc=(k)=>T[k]=(T[k]||0)+1;
for(const foe of HEROES){ if(foe===HERO) continue; for(const first of [0,1]){
  const [k0,k1]=first===0?[HERO,foe]:[foe,HERO]; const me=first;
  let g=match(k0,k1,`${k0}-${k1}-0`,0), st=0;
  while(!g.over && st<4000){ let m=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue;
      if(s===me && g.turnPlayer===me && a.t==="endTurn"){ const sd=g.sides[me];
        if(sd.ap>0) for(const c of [...(sd.hand||[]).map(c=>[c,"hand"]), ...(sd.arsenal?[[sd.arsenal,"arsenal"]]:[])]){
          const why=J.legal(g,{t:"play",uid:c[0].uid,from:c[1]},me);
          inc(`${c[0].name} [${c[1]}] :: ${why?String(why).replace(/\d+/g,"N").slice(0,90):"LEGAL"}`); } }
      const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; st++; m=true; break; }
    if(!m) break; } } }
Object.entries(T).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log(String(v).padStart(4),k));
