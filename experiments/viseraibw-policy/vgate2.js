const R="/home/user/dawnblade-ai/";
const {match,W,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");
const all=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw");const A={};let gateTurns=0;
for(const f of all) for(const vs of [0,1]){let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-0-${vs}`,0);
 for(let i=0;i<4000&&!g.over;i++){let moved=false;for(const seat of [0,1]){const a=SP.act(g,seat,{search:true});if(!a)continue;
  if(seat===vs&&a.t==="activate"){const sd=g.sides[seat];const b=(sd.board||[]).find(x=>x&&x.uid===a.uid);const k=(b?"board:"+(b.card||b).name:(sd.gear||[]).find(x=>x.uid===a.uid)?"gear":String(a.from));A[k]=(A[k]||0)+1;}
  const out=J.reduce(g,a,seat);if(out.error)continue;g=out.state;moved=true;}if(!moved)break;}}
console.log(A);
