// Embrace Ursur census (v6.59): its sheet answers and what led instead. node ursur.js <seeds>
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero="viseraibw", seeds=+process.argv[2]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}; let shown=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`eu-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const e=SP.explain(g,sd); const x=e.action; if(!x) continue;
      if(sd===seat && g.prompt && g.prompt.side===sd && /Embrace/.test(JSON.stringify(g.prompt).slice(0,600))){
        const S=g.sides[sd]; const k="PROMPT "+g.prompt.kind+" -> "+JSON.stringify(x).slice(0,80)+" | "+e.key;
        K[k]=(K[k]||0)+1; if(shown<1){shown++; const P=Object.assign({},g.prompt); P.cards=P.cards.map(c=>c.name); console.log(JSON.stringify(P,null,0)); console.log("hand",S.hand.map(c=>c.name+"/"+c.uid)); console.log("ans",JSON.stringify(x));}
      }
      if(sd===seat && g.turnPlayer===sd && !g.prompt && !J.pendingOf(g)){
        const S=g.sides[sd]; const eu=(S.hand||[]).filter(c=>c&&c.name==="Embrace Ursur" && !J.legal(g,{t:"play",uid:c.uid,from:"hand"},sd));
        const glooms=(S.hand||[]).filter(c=>c&&/Gloomblade|Runechant of|Vexing/.test(c.name)).length;
        if(eu.length && !(x.t==="play"&&eu.some(c=>c.uid===x.uid))){ const nm=(S.hand.find(c=>c.uid===x.uid)||{}).name||x.from||x.uid; const k="INSTEAD("+(glooms?"withShadowInHand":"noShadow")+") "+e.key+" "+x.t+":"+nm; K[k]=(K[k]||0)+1; }
        if(eu.length && (x.t==="play"&&eu.some(c=>c.uid===x.uid))) K["PLAYED EU "+e.key]=(K["PLAYED EU "+e.key]||0)+1;
      }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
Object.entries(K).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k));
