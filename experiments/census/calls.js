// Which calls touch a card, and on whose turn: `node calls.js <hero> <seeds> "<card>"`.
// Counts `<action> <own|opp> <reason key>` for every action of the hero's seat naming the card
// (played, pitched in a payment, arsenalled, fused...). Pairs with never.js (legal vs used) and
// instead.js (what was played instead). Written 2026-11-22 for Frost Spike (v6.68, SPXOPPICE).
// Env vars reach the policy as usual (e.g. SPXOPPICE=none for the A side of an A/B).
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"iyslander", seeds=+process.argv[3]||1, CARD=process.argv[4]||"Frost Spike";
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}; let games=0,wins=0;
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`calls-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
      if(sd===seat){ const S=g.sides[seat]; const c=(S.hand||[]).concat(S.arsenal?[S.arsenal]:[]).find(c=>c&&c.uid===x.uid);
        if(c&&c.name===CARD){ const e=SP.explain(g,seat); const k=x.t+" "+(g.turnPlayer===seat?"own":"opp")+" "+(e&&e.key); K[k]=(K[k]||0)+1; } }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log({games,wins},K);
