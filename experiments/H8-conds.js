const R = process.argv[2], HERO = process.argv[3];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const T = {}, inc = (k,n=1)=>T[k]=(T[k]||0)+n; let atk=0, dealt=0, walled=0, pow=0;
for(const foe of HEROES){ if(foe===HERO) continue; for(const first of [0,1]){
  const [k0,k1] = first===0?[HERO,foe]:[foe,HERO]; const me = first===0?0:1;
  let g = match(k0,k1,`${k0}-${k1}-0`,0), steps=0, lf=0;
  while(!g.over && steps<4000){ let moved=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue; const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; steps++; moved=true;
      const f=g.feed||[]; for(const l of f.slice(lf)){ if(g.turnPlayer!==me) continue;
        let m;
        if(m=l.match(/^(.+?): condition not met \((.+)\)/)) inc("unmet: "+m[1]+" — "+m[2]);
        if(m=l.match(/resolves for (\d+)\. Wall of (\d+)/)){ atk++; dealt+=+m[1]; walled+=+m[2]; }
        if(m=l.match(/— (\d+) power on the chain/)){ pow+=+m[1]; }
        if(/hears the crowd (boo|cheer)/.test(l)) inc("crowd: "+l.replace(/^.*hears the crowd /,"").slice(0,20));
      } lf=f.length; break; }
    if(!moved) break; } } }
console.log(`${HERO}: attacks ${atk}, avg power ${(pow/atk).toFixed(1)}, avg wall ${(walled/atk).toFixed(1)}, avg dealt ${(dealt/atk).toFixed(1)}`);
Object.entries(T).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log(String(v).padStart(5),k));
