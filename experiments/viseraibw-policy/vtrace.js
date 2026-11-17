// usage: node vtrace.js foe seed vs  -> feed lines of the whole game, annotated with who acts
const R="/home/user/dawnblade-ai/";
const {match,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");
const [f,s,vs]=[process.argv[2]||"dorinthea",process.argv[3]||"0",+(process.argv[4]||0)];
let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-${s}-${vs}`,(+s)%2); let seen=0;
for(let i=0;i<4000&&!g.over;i++){let moved=false;for(const seat of [0,1]){const a=SP.act(g,seat,{search:true});if(!a)continue;
 const isV=seat===vs; const out=J.reduce(g,a,seat); if(out.error)continue;
 if(isV&&["play","activate","endTurn"].includes(a.t)){const sd=g.sides[seat];const c=[...(sd.hand||[]),...(sd.banish||[]),...(sd.arsenal?[sd.arsenal]:[]),...(sd.gear||[])].find(x=>x&&x.uid===a.uid);console.log("  >>V",a.t,c?c.name:"",a.from||"","res",sd.res,"ap",sd.ap,"hand",(sd.hand||[]).length,"ban",(sd.banish||[]).length);}
 g=out.state;moved=true; const nf=(g.feed||[]).slice(seen); seen=(g.feed||[]).length; nf.forEach(l=>console.log(typeof l==="string"?l:JSON.stringify(l)));}
 if(!moved)break;}
console.log("OVER",JSON.stringify(g.over),"hp",g.sides.map(x=>x.hp||x.myHP));
