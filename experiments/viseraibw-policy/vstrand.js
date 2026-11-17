// node vstrand.js [foes] [seeds]: full own-turn logs for turns ending with a go-again card stranded unaffordable
const R="/home/user/dawnblade-ai/";
const {match,W,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");
const all=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw");
const foes=(process.argv[2]||all.join(",")).split(",").filter(Boolean); const SEEDS=+(process.argv[3]||1);
const nm=c=>c&&(c.name+"("+c.cost+"c/"+c.pitch+"p"+(c.power?"/"+c.power+"pw":"")+")");
let shown=0,total=0,stranded=0,strandedKap=0,strandedAfterPitch=0;
for(const f of foes) for(let s=0;s<SEEDS;s++) for(const vs of [0,1]){
 let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-${s}-${vs}`,s%2); let log=null,turn=-1,start=null;
 for(let i=0;i<4000&&!g.over;i++){let moved=false;for(const seat of [0,1]){const a=SP.act(g,seat,{search:true});if(!a)continue;
  if(seat===vs&&g.phase==="action"&&!g.pend&&!(g.stack||[]).length&&!g.prompt){const sd=g.sides[seat];
   if(g.turn!==turn&&sd.ap>0){turn=g.turn;log=[];start={hand:(sd.hand||[]).map(nm),ars:nm(sd.arsenal),ban:(sd.banish||[]).length,rc:(sd.board||[]).filter(b=>/Runechant/.test(b.card?b.card.name:b.name||"")).length};}
   const c=a.uid!=null&&[...(sd.hand||[]),...(sd.banish||[]),...(sd.arsenal?[sd.arsenal]:[]),...(sd.gear||[])].find(x=>x&&x.uid===a.uid);
   if(log)log.push(a.t+(c?" "+nm(c):"")+(a.from?"@"+a.from:"")+" [res"+sd.res+" ap"+sd.ap+" h"+(sd.hand||[]).length+"]");
   if(a.t==="endTurn"&&log){total++; if(sd.ap>0&&((sd.hand||[]).length||sd.arsenal)){stranded++;
     const held=[...(sd.hand||[]),...(sd.arsenal?[sd.arsenal]:[])]; const kap=held.some(c=>J.keepsActionPoint(g,seat,c.uid,sd.arsenal&&sd.arsenal.uid===c.uid?"arsenal":"hand"));
     if(held.length>=3&&!global.p3){global.p3=1;console.log("MULTI",g.phase,g.turn,"active",g.active,"opp",f,held.map(c=>nm(c)+" => "+J.legal(g,{t:"play",uid:c.uid,from:"hand"},seat)));} if(kap){strandedKap++; if(shown++<8)console.log("--- vs",f,"turn",g.turn,"start",JSON.stringify(start),"\n  "+log.join("\n  ")+"\n  END held:"+held.map(nm));}}}
  }
  const out=J.reduce(g,a,seat);if(out.error)continue;g=out.state;moved=true;}
  if(!moved)break;}
}
console.log({total,stranded,strandedKap});
