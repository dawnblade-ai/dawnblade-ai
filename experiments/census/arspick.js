// Per hero: arsenal steps, and how often the SPXARSPAY rule would change the pick (the old pick unpayable next turn).
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const seeds=+process.argv[2]||1, out={};
for(const hero of W.HEROES.map(h=>h.k)){ const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); let steps=0, changed=0; const names={};
  for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
    let g=match(a,b,`ap-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
    for(let i=0;i<4000&&!g.over;i++){ let mv=false;
      for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
        if(sd===seat && g.arsenalFor===seat && x.t==="arsenal" && x.uid!=null){ steps++;
          if(!J.arsenalPayable(g,seat,x.uid,2)){ changed++; const c=g.sides[seat].hand.find(c=>c&&c.uid===x.uid); names[c.name+" c"+c.cost]=(names[c.name+" c"+c.cost]||0)+1; } }
        const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
      if(!mv) break; } }
  out[hero]={steps,changed,top:Object.entries(names).sort((x,y)=>y[1]-x[1]).slice(0,3)}; }
for(const [h,v] of Object.entries(out).sort((x,y)=>y[1].changed-x[1].changed)) console.log(h.padEnd(10),v.steps,v.changed,JSON.stringify(v.top));
