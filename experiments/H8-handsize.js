const R = process.argv[2], HERO = process.argv[3];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const isAtk = c => (c.ty||[]).some(t=>/^attack$/i.test(t));
const H={}, T={}, inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;
for(const foe of HEROES){ if(foe===HERO) continue; for(const first of [0,1]){
  const [k0,k1] = first===0?[HERO,foe]:[foe,HERO]; const me = first===0?0:1;
  let g = match(k0,k1,`${k0}-${k1}-0`,0), steps=0, cur=-1;
  while(!g.over && steps<4000){ let moved=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue; const sd=g.sides[me];
      if(g.turnPlayer===me && g.phase==="action" && g.turn!==cur){ cur=g.turn; inc(H, sd.hand.length+(sd.arsenal?"+a":"")); }
      if(s===me && g.turnPlayer!==me){ // opponent's turn: what do I spend?
        if(a.t==="defend"){ const c=sd.hand.find(x=>x.uid===a.uid); inc(T, c?"block-hand:"+(isAtk(c)?"attack":"non"):"block-gear"); }
        if(a.t==="play"){ const c=[...sd.hand,...(sd.arsenal?[sd.arsenal]:[])].find(x=>x.uid===a.uid); inc(T,"play-on-foe-turn:"+(c&&isAtk(c)?"attack":"non")); if(c) inc(T,"  card:"+c.name+" ["+(c.ty||[]).join(" ")+"] @"+g.step); }
        if(a.t==="paySel") inc(T,"pitch-on-foe-turn");
      }
      const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; steps++; moved=true; break; }
    if(!moved) break; } } }
console.log(HERO, "hand at own action phase:", JSON.stringify(H)); console.log("  foe-turn spend:", JSON.stringify(T));
