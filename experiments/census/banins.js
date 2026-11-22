// When a card is playable from BANISH but something else is chosen: what, and why. node banins.js <hero> <seeds> "<card>"
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2]||"viseraibw", seeds=+process.argv[3]||1, CARD=process.argv[4]||"Murmuring Gloomblade";
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const K={}, ex=[]; let played=0, endWith=0;
const nm=(S,x)=>{ const all=[...(S.hand||[]),S.arsenal,...(S.banish||[]).map(b=>b&&b.card||b),...(S.gear||[]),...(S.board||[]).map(b=>b&&b.card)]; const c=all.find(c=>c&&c.uid===x.uid); return x.t+":"+(c?c.name:(x.uid||""))+(x.from&&x.from!=="hand"?"@"+x.from:""); };
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`bi-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const e=SP.explain(g,sd); const x=e.action; if(!x) continue;
      if(sd===seat && g.turnPlayer===sd && !g.prompt && !J.pendingOf(g) && !(g.stack||[]).length && !g.pend){
        const S=g.sides[sd]; const bc=(S.banish||[]).map(b=>b&&b.card||b).filter(c=>c&&c.name===CARD&&!J.legal(g,{t:"play",uid:c.uid,from:"banish"},sd));
        if(bc.length){
          if(x.t==="play"&&x.from==="banish"&&bc.some(c=>c.uid===x.uid)) played++;
          else { const k=(x.t==="endTurn"?"END ":"")+e.key+" "+nm(S,x); K[k]=(K[k]||0)+1; if(x.t==="endTurn") endWith++;
            if(x.t==="endTurn"&&ex.length<6) ex.push({turn:g.turn,ap:S.ap,res:S.res,hand:S.hand.map(c=>c.name+"("+c.pitch+")"),cost:bc[0].cost}); }
        }
      }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
}
console.log({played,endWith}); Object.entries(K).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,v])=>console.log(String(v).padStart(4),k)); ex.forEach(e=>console.log(JSON.stringify(e)));
