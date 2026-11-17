// usage: node vprobe2.js [foes] [seeds]  -- all seats search:true. Dumps every viseraibw pass-with-AP.
const R="/home/user/dawnblade-ai/";
const {match,W,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");
const all=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw");
const foes=(process.argv[2]||all.join(",")).split(",").filter(Boolean); const SEEDS=+(process.argv[3]||1);
const nm=c=>c&&c.name+"("+(c.cost!=null?c.cost:"?")+"c"+(c.pitch||0)+"p"+(c.power!=null?c.power:"")+")";
const T={turnsOwn:0,passAP:0,passAPhandEmpty:0,passAPhandHeld:0,reasons:{},keys:{},cardHeld:{},banishCardsAtPass:{},plays:{},banishPlayed:{},unspentRes:0,pitchedUnused:0};
const rows=[];
for(const f of foes) for(let s=0;s<SEEDS;s++) for(const vs of [0,1]){
  let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-${s}-${vs}`,s%2);
  for(let i=0;i<4000&&!g.over;i++){let moved=false;
    for(const seat of [0,1]){
      const o={search:true}; const a=SP.act(g,seat,o); if(!a)continue; const isV=seat===vs;
      if(isV){ if(a.t==="play"){const sd=g.sides[seat];const c=[...(sd.hand||[]),...(sd.banish||[]),...(sd.arsenal?[sd.arsenal]:[])].find(x=>x&&x.uid===a.uid); const k=(c?c.name:"?")+"@"+a.from; T.plays[k]=(T.plays[k]||0)+1; if(a.from==="banish")T.banishPlayed[c&&c.name]=(T.banishPlayed[c&&c.name]||0)+1;}
        if(a.t==="endTurn"){T.turnsOwn++; const sd=g.sides[seat];
          if(sd.ap>0&&!(g.stack||[]).length){T.passAP++; const hand=sd.hand||[];
            if(!hand.length&&!sd.arsenal)T.passAPhandEmpty++; else T.passAPhandHeld++;
            const e=SP.explain(g,seat,o); T.keys[e.key]=(T.keys[e.key]||0)+1;
            const info=[...hand.map(c=>({c,from:"hand"})),...(sd.arsenal?[{c:sd.arsenal,from:"arsenal"}]:[]),...(sd.banish||[]).map(c=>({c,from:"banish"}))].map(x=>({n:nm(x.c),from:x.from,err:J.legal(g,{t:"play",uid:x.c.uid,from:x.from},seat),kap:J.keepsActionPoint(g,seat,x.c.uid,x.from)}));
            const bl=info.filter(x=>x.from==="banish"&&!x.err); const banAll=info.filter(x=>x.from==="banish");
            info.filter(x=>x.from!=="banish").forEach(x=>{const r=x.err||"LEGAL"; const key=x.n.split("(")[0]+" :: "+String(r).slice(0,60); T.reasons[key]=(T.reasons[key]||0)+1;});
            if(rows.length<400)rows.push({turn:g.turn,foe:f,res:sd.res,ap:sd.ap,key:e.key,hp:g.sides.map(x=>x.hp||x.myHP),hand:info.filter(x=>x.from!=="banish"),banishLegal:bl.length,banishTotal:banAll.length});
          }}}
      const out=J.reduce(g,a,seat); if(out.error)continue; g=out.state; moved=true;}
    if(!moved)break;}
}
const top=(o,n=25)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n);
console.log(JSON.stringify({turnsOwn:T.turnsOwn,passAP:T.passAP,handEmpty:T.passAPhandEmpty,handHeld:T.passAPhandHeld,keys:T.keys,banishPlayed:T.banishPlayed},null,1));
console.log("REASONS (cards held at pass-with-AP, legality of play):");top(T.reasons,40).forEach(x=>console.log(x[1],x[0]));
console.log("TOP PLAYS:");top(T.plays,30).forEach(x=>console.log(x[1],x[0]));
require("fs").writeFileSync(__dirname+"/vrows.json",JSON.stringify(rows));
