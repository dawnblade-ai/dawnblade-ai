// Blaze off-turn energy census: on each OPPONENT turn, the first window where the hero ability is legal
// with no prompt: energy held, ctrPickTakers, affordable takers (res + hand pitch). Then follow the best
// taker's uid: the first thing the hero's seat does with it (own/opp turn), or where it ends.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"blaze", seeds=+process.argv[3]||1, s0=+process.argv[4]||0;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const num=(c,k)=>+(c&&c[k])||0;
const aff=(sd,card)=>{const need=num(card,"cost")-(sd.res||0); if(need<=0) return true;
  const pool=(sd.hand||[]).filter(c=>c&&c.uid!==card.uid&&num(c,"pitch")>0).map(c=>num(c,"pitch")).sort((a,b)=>b-a);
  let got=0; for(let i=0;i<pool.length&&i<3;i++){got+=pool[i]; if(got>=need) return true;} return false;};
const T={games:0,wins:0,oppTurns:0,legalOpp:0,withTaker:0,withAffTaker:0,energyHist:{},arcHist:{},fate:{},nextOwnApUsed:{},
  handAtNext:[],endHandLeft:[],energyEnd:[],nextOwnPlaysOfHand:[], takerFrom:{}};
const inc=(o,k)=>o[k]=(o[k]||0)+1;
for(let s=s0;s<s0+seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`off-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; T.games++;
  const seen={}; let track=null;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    const sd=g.sides[seat];
    if(g.turnPlayer!==seat && !seen[g.turn]){ seen[g.turn]=1; T.oppTurns++; }
    if(g.turnPlayer!==seat && !g.prompt && !seen["L"+g.turn] && !J.legal(g,{t:"activate",from:"hero",uid:"hpow"},seat)){
      seen["L"+g.turn]=1; T.legalOpp++;
      const en=((sd.counters||{}).hero||{}).energy||0; inc(T.energyHist,en);
      const tk=J.ctrPickTakers(g,seat)||[];
      if(tk.length){ T.withTaker++;
        const af=tk.filter(t=>aff(sd,t.card)).sort((x,y)=>(y.arc-x.arc)||(x.cost-y.cost));
        if(af.length){ T.withAffTaker++; inc(T.arcHist,af[0].card.name+" "+af[0].card.pitch+" arc"+af[0].arc+" cost"+af[0].cost);
          if(!track) track={uid:af[0].uid,turn:g.turn,name:af[0].card.name}; }
      }
    }
    for(const x of [0,1]){ const ac=SP.act(g,x); if(!ac) continue;
      if(x===seat && track && !track.done){
        const str=JSON.stringify(ac);
        if(str.indexOf(JSON.stringify(track.uid))>=0){ const e=SP.explain(g,seat); inc(T.fate,ac.t+(ac.from?"/"+ac.from:"")+" "+(g.turnPlayer===seat?"own":"opp")+" "+(e&&e.key)); track.done=1; }
      }
      const r=J.reduce(g,ac,x); if(r.error) continue; g=r.state; mv=true; break; }
    if(track && !track.done){ const S=g.sides[seat];
      const inHand=(S.hand||[]).some(c=>c&&c.uid===track.uid);
      if(!inHand && !(S.arsenal&&S.arsenal.uid===track.uid)){ inc(T.fate,"left hand silently"); track.done=1; }
      else if(g.turn>=track.turn+2 && g.turnPlayer!==seat){ inc(T.fate,"still held after next own turn"); track.done=1; }
    }
    if(track && track.done) track=null;
    if(!mv) break; }
  if(track && !track.done) inc(T.fate,"game over first");
  const S=g.sides[seat]; T.energyEnd.push(((S.counters||{}).hero||{}).energy||0);
  if(g.over&&g.over.winner===seat) T.wins++;
}
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2); T.energyEnd=avg(T.energyEnd);
for(const k of ["arcHist","fate"]) T[k]=Object.entries(T[k]).sort((x,y)=>y[1]-x[1]);
delete T.handAtNext; delete T.endHandLeft; delete T.nextOwnPlaysOfHand; delete T.nextOwnApUsed; delete T.takerFrom;
console.log(JSON.stringify(T,null,1));
