const R="/home/user/dawnblade-ai/";
const {match,W,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");
const all=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw");const N={},P={};let ends=0,hc=0,hres=0;
for(const f of all) for(const vs of [0,1]){let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-0-${vs}`,0);
 for(let i=0;i<4000&&!g.over;i++){let moved=false;for(const seat of [0,1]){const a=SP.act(g,seat,{search:true});if(!a)continue;
  if(seat===vs&&a.t==="endTurn"&&g.phase==="action"){const sd=g.sides[seat];ends++;(sd.banish||[]).forEach(c=>{N[c.name]=(N[c.name]||0)+1;});
    (sd.banish||[]).forEach(c=>{const e=J.legal(g,{t:"play",uid:c.uid,from:"banish"},seat);const k=c.name+" :: "+(e?String(e).replace(/costs \d+/,"costs N").slice(0,70):"LEGAL");P[k]=(P[k]||0)+1;});}
  const out=J.reduce(g,a,seat);if(out.error)continue;g=out.state;moved=true;}if(!moved)break;}}
console.log("ends",ends);Object.entries(P).sort((a,b)=>b[1]-a[1]).slice(0,22).forEach(x=>console.log(x[1],x[0]));
