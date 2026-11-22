// At the end of Lyath's own turn: which instants were still LEGAL in hand (the turn passes with them unplayed)?
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"lyath", seeds=+process.argv[3]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, ex=[]; let games=0, wins=0, turns=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let last=null; let g=match(a,b,`ea-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      const r=J.reduce(g,x,sd); if(r.error) continue;
      if(sd===seat && g.turnPlayer===seat && !g.prompt && !J.pendingOf(g)) last={st:g,x};
      if(last && g.turnPlayer===seat && r.state.turnPlayer!==seat){
        const before=last.st, x=last.x; last=null;
        turns++;
        // the state just before the last action of the turn: what was legal then
        const S=before.sides[seat];
        const leg=(S.hand||[]).filter(c=>c&&c.uid!==x.uid&&!J.legal(before,{t:"play",uid:c.uid,from:"hand"},seat));
        leg.forEach(c=>{K[c.name]=(K[c.name]||0)+1;}); (S.hand||[]).forEach(c=>{const w=J.legal(before,{t:"play",uid:c.uid,from:"hand"},seat); const k="why "+(w&&(w.error||w.reason||w)); K[k]=(K[k]||0)+1;});
        if(ex.length<6) ex.push({turn:before.turn,phase:before.phase,step:before.step,x:x.t,why:SP.explain(before,seat).key,hand:S.hand.map(c=>c.name+"("+c.pitch+")"),legal:leg.map(c=>c.name),res:S.resources,life:[before.sides[0].life,before.sides[1].life]});
      }
      g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log({games,wins,turns},K); ex.forEach(e=>console.log(JSON.stringify(e)));
