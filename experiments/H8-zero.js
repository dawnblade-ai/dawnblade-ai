const R = process.argv[2], HERO = process.argv[3], LIMIT=+(process.argv[4]||14);
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const isAtk = c => (c.ty||[]).some(t=>/^attack$/i.test(t));
const sh = c => c.name.split(",")[0]+"/"+c.pitch+(isAtk(c)?"A"+(c.power||0)+"c"+(c.cost||0):"N"+"c"+(c.cost||0));
let shown=0; const why={};
for(const foe of HEROES){ if(foe===HERO) continue; for(const first of [0,1]){
  const [k0,k1] = first===0?[HERO,foe]:[foe,HERO]; const me = first===0?0:1;
  let g = match(k0,k1,`${k0}-${k1}-0`,0), steps=0, cur=-1, atks=0, log=[], start="";
  const flush=()=>{ if(cur>=0 && atks===0){ const k=start.includes("A")?"zero-with-attack-in-hand":"zero-no-attack"; why[k]=(why[k]||0)+1; if(shown<LIMIT && k==="zero-with-attack-in-hand"){ shown++; console.log(`${k0}-${k1} T${cur}: ${start}\n   ${log.join(" | ")}`);} } };
  while(!g.over && steps<4000){ let moved=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue; const sd=g.sides[me];
      if(s===me && g.turnPlayer===me && g.phase==="action" && g.turn!==cur){ flush(); cur=g.turn; atks=0; log=[];
        start=`res ${sd.res} hand [${sd.hand.map(sh).join(", ")}] ars ${sd.arsenal?sh(sd.arsenal):"-"} wpn ${sd.gear.filter(x=>x.power!=null).map(x=>x.name).join(",")}`; }
      if(s===me && g.turnPlayer===me && a.t!=="pass"){ const c=[...sd.hand,...(sd.arsenal?[sd.arsenal]:[]),...sd.gear].find(x=>x.uid===a.uid); log.push(a.t+(c?" "+sh(c):a.uid?" "+a.uid:"")); if((c&&isAtk(c))||(a.t==="activate"&&a.uid!=="hpow")) atks++; }
      const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; steps++; moved=true; break; }
    if(!moved) break; } flush(); } }
console.log(JSON.stringify(why));
