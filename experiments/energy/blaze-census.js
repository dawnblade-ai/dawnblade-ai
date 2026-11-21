const path="/home/user/dawnblade-ai/";
const {match, W, J, SP} = require(path+"tools/selfplay.js");
const hero = process.argv[2]||"blaze", seeds=+process.argv[3]||1;
const keys = W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const T = {games:0, wins:0, legalOwn:0, legalOpp:0, usedOwn:0, usedOpp:0, banPlayed:0, banStranded:0, keysWhenLegalOwn:{}, keysWhenLegalOpp:{}, apAtLegalOwn:{}, energyEnd:[], energyMax:[], banishedNames:{}, pickedNone:0};
const HP = "hpow";
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g = match(a,b,`${a}-${b}-${s}`, s%2); const seat = a===hero?0:1; T.games++;
  let emax=0; const seenTurn={};
  for(let i=0;i<4000 && !g.over;i++){
    let moved=false;
    for(const sd of [0,1]){
      let act, key;
      if(sd===seat){
        const r = SP.explain(g,sd); act=r.action; key=r.key;
        const S=g.sides[sd]; const en=((S.counters||{}).hero||{}).energy||0; emax=Math.max(emax,en);
        const L = !J.legal(g,{t:"activate",from:"hero",uid:HP},sd);
        if(!L && !g.prompt && g.turnPlayer===sd && g.step==="layer" && !g.chainOpen){ const r0=J.legal(g,{t:"activate",from:"hero",uid:HP},sd); T.why=T.why||{}; const w=String(r0).replace(/[0-9]+/g,"N").slice(0,90); T.why[w]=(T.why[w]||0)+1; }
        if(L && !g.prompt){
          const own = g.turnPlayer===sd;
          const tk = g.turn+":"+(own?"o":"p");
          if(!seenTurn[tk]){ seenTurn[tk]=1; own?T.legalOwn++:T.legalOpp++; }
          const bucket = own?T.keysWhenLegalOwn:T.keysWhenLegalOpp;
          const k2 = (act&&act.from==="hero"?"HERO":key)+(own?" ap"+(S.ap):"")+" "+(g.step||"");
          bucket[k2]=(bucket[k2]||0)+1;
          if(act && act.from==="hero" && act.t==="activate") own?T.usedOwn++:T.usedOpp++;
        }
        if(act && act.t==="play" && act.from==="banish") T.banPlayed++;
      } else act = SP.act(g,sd);
      if(!act) continue;
      const before=g;
      const out=J.reduce(g,act,sd); if(out.error) continue; g=out.state; moved=true;
      if(sd===seat){ const nf=(g.feed||[]).slice((before.feed||[]).length); for(const l of nf){ const m=String(l.t||l.text||l).match(/energy spent — (.+?) is banished/); if(m) T.banishedNames[m[1]]=(T.banishedNames[m[1]]||0)+1; } }
      break;
    }
    if(!moved) break;
  }
  const S=g.sides[seat]; T.energyEnd.push(((S.counters||{}).hero||{}).energy||0); T.energyMax.push(emax);
  T.banStranded += (S.banish||[]).filter(c=>c&&c._asInstant).length; T.banLeft=(T.banLeft||0)+(S.banish||[]).length;
  if(g.over && g.over.winner===seat) T.wins++;
}
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2);
T.energyEnd=avg(T.energyEnd); T.energyMax=avg(T.energyMax);
const srt=o=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,25);
T.keysWhenLegalOwn=srt(T.keysWhenLegalOwn); T.keysWhenLegalOpp=srt(T.keysWhenLegalOpp);
console.log(JSON.stringify(T,null,1));
