/* count the explain() reason keys the hero seat uses (rule policy) over seeds. node keys.js hero from to */
const root=__dirname+"/../../";
const {match, W, J, SP} = require(root+"tools/selfplay.js");
const hero=process.argv[2]||"lyath", from=+process.argv[3]||0, to=+process.argv[4]||2;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero); const cnt={};
for(let s=from;s<to;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let moved=false;
    for(const sd of [0,1]){ let act;
      if(sd===seat){ const r=SP.explain(g,sd,{search:false}); act=r.action; if(act) cnt[r.key]=(cnt[r.key]||0)+1; } else act=SP.act(g,sd,{search:false});
      if(!act) continue; const out=J.reduce(g,act,sd); if(out.error) continue; g=out.state; moved=true; break; }
    if(!moved) break; } }
console.log(JSON.stringify(Object.entries(cnt).sort((x,y)=>y[1]-x[1])));
