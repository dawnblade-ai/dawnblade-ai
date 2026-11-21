// What a seat played INSTEAD of a card that was legal (v6.59). node instead.js <hero> <seeds> "<card name>"
// When Gravy's turn ENDS (or he plays something else last) with Jittery Bones in hand: why?
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"gravy", seeds=+process.argv[3]||1, CARD=process.argv[4]||"Jittery Bones";
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, ex=[]; let games=0, wins=0, played=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`jb-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat && g.turnPlayer===sd && !g.prompt && !J.pendingOf(g)){
        const S=g.sides[sd]; const jb=(S.hand||[]).filter(c=>c&&c.name===CARD);
        if(jb.length){
          const legalJ=jb.filter(c=>!J.legal(g,{t:"play",uid:c.uid,from:"hand"},sd));
          if(x.t==="play"&&jb.some(c=>c.uid===x.uid)) played++;
          else if(legalJ.length){ const T=x.t+(x.uid!=null?":"+((S.hand.find(c=>c.uid===x.uid)||{}).name||x.from||x.uid):""); K["ACT "+T]=(K["ACT "+T]||0)+1;
            const e=SP.explain(g,sd); K[e.key]=(K[e.key]||0)+1;
            if(ex.length<6) ex.push({k:e.key,turn:g.turn,life:[g.sides[0].life,g.sides[1].life],hand:S.hand.map(c=>c.name+"("+c.pitch+")"),ap:S.ap??S.actionPoints, res:S.resources, x:x.t});
          }
        }
      }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log({games,wins,played},K); ex.forEach(e=>console.log(JSON.stringify(e)));
