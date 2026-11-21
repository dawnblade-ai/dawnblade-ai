const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const keys=W.HEROES.map(h=>h.k).filter(k=>k!=="prism");
const T={atk:0, withAlly:0, atAlly:0, byFoe:{}, allyLife:{}, prismLife:{}};
for(let s=0;s<2;s++) for(const o of keys) for(const [a,b] of [["prism",o],[o,"prism"]]){
  let g=match(a,b,`sy-${a}-${b}-${s}`,s%2); const ps=a==="prism"?0:1, fs=1-ps;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===fs && x.target!=null && (x.t==="play"||x.t==="activate")){
        const ally=(g.sides[ps].board||[]).find(b=>b&&b.kind==="ally");
        T.atk++; if(ally){ T.withAlly++; const tgt=String(x.target);
          if(tgt!=="hero"&&tgt!=="0"&&tgt!=="1"&&!/hero/.test(tgt)){ T.atAlly++; T.byFoe[o]=(T.byFoe[o]||0)+1; const lf=g.sides[ps].life; const k=lf>12?"prism>12":lf>6?"prism7-12":"prism<=6"; T.prismLife[k]=(T.prismLife[k]||0)+1; }
          else { const lf=g.sides[ps].life; const k=lf>12?"prism>12":lf>6?"prism7-12":"prism<=6"; T.allyLife["hero:"+k]=(T.allyLife["hero:"+k]||0)+1; } } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
console.log(JSON.stringify(T));
