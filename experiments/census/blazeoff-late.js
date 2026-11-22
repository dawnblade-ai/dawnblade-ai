// LAST window of each opponent turn where Blaze's hero ability is legal (no prompt/pend/stack):
// the best affordable taker + the hand cards that would pay for it (greedy biggest pitch);
// then the first thing the hero's seat does with each before the end of its NEXT own turn.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"blaze", seeds=+process.argv[3]||1, s0=+process.argv[4]||0;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const num=(c,k)=>+(c&&c[k])||0, inc=(o,k)=>o[k]=(o[k]||0)+1;
const payers=(sd,card)=>{const need=num(card,"cost")-(sd.res||0); if(need<=0) return [];
  const pool=(sd.hand||[]).filter(c=>c&&c.uid!==card.uid&&num(c,"pitch")>0).sort((a,b)=>num(b,"pitch")-num(a,"pitch"));
  let got=0,out=[]; for(const c of pool){ if(out.length>=3) break; out.push(c); got+=num(c,"pitch"); if(got>=need) return out;} return null;};
const T={games:0,wins:0,oppTurns:0,lastWin:0,withAff:0,chainOpenAtLast:0,taker:{},payer:{},nPay:{},handAtLast:{},enAtLast:{}};
for(let s=s0;s<s0+seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`late-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; T.games++;
  let last=null, curTurn=null; const tracks=[];
  const close=(tr,why)=>{ if(tr.done) return; tr.done=1; inc(tr.kind==="t"?T.taker:T.payer, why); };
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    if(g.turnPlayer!==seat){ if(curTurn!==g.turn){ curTurn=g.turn; T.oppTurns++; last=null; }
      if(!g.prompt && !g.pend && !(g.stack||[]).length && !J.legal(g,{t:"activate",from:"hero",uid:"hpow"},seat)) last=g; }
    else if(last){ // turn flipped to us: evaluate the last opp window
      T.lastWin++; const L=last, sd=L.sides[seat]; last=null;
      const en=((sd.counters||{}).hero||{}).energy||0; inc(T.enAtLast,en); inc(T.handAtLast,(sd.hand||[]).filter(Boolean).length);
      if((L.chain||[]).length) T.chainOpenAtLast++;
      const tk=(J.ctrPickTakers(L,seat)||[]).map(t=>({t,p:payers(sd,t.card)})).filter(x=>x.p).sort((x,y)=>(y.t.arc-x.t.arc)||(x.t.cost-y.t.cost));
      if(tk.length){ T.withAff++; inc(T.nPay,tk[0].p.length);
        const h=new Set((g.sides[seat].hand||[]).filter(Boolean).map(c=>c.uid));
        tracks.push({uid:tk[0].t.uid,kind:"t",turn:g.turn}); for(const c of tk[0].p) tracks.push({uid:c.uid,kind:"p",turn:g.turn});
        for(const tr of tracks) if(!tr.done && !h.has(tr.uid)) close(tr,"gone before own turn");
      }
      curTurn=null;
    }
    for(const x of [0,1]){ const ac=SP.act(g,x); if(!ac) continue;
      if(x===seat){ const str=JSON.stringify(ac); for(const tr of tracks) if(!tr.done && str.indexOf(JSON.stringify(tr.uid))>=0){ const e=SP.explain(g,seat); close(tr, ac.t+(ac.from?"/"+ac.from:"")+" "+(g.turnPlayer===seat?"own":"opp")+" "+(e&&e.key)); } }
      const r=J.reduce(g,ac,x); if(r.error) continue; g=r.state; mv=true; break; }
    const S=g.sides[seat];
    for(const tr of tracks){ if(tr.done) continue;
      const inH=(S.hand||[]).some(c=>c&&c.uid===tr.uid)||(S.arsenal&&S.arsenal.uid===tr.uid);
      if(!inH){ const inBan=(S.banish||[]).some(c=>c&&c.uid===tr.uid); close(tr, inBan?"banished own (energy)":"left hand other"); }
      else if(g.turnPlayer!==seat && g.turn>tr.turn) close(tr,"held into next opp turn"); }
    if(!mv) break; }
  for(const tr of tracks) close(tr,"game over");
  if(g.over&&g.over.winner===seat) T.wins++;
}
for(const k of ["taker","payer"]) T[k]=Object.entries(T[k]).sort((x,y)=>y[1]-x[1]);
console.log(JSON.stringify(T));
