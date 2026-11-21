const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const keys=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw");
const T={legal:0, unlock:0, hist:{}, why:{}}; let shown=0;
for(const o of keys) for(const [a,b] of [["viseraibw",o],[o,"viseraibw"]]){
  let g=match(a,b,`gt-${a}-${b}`,0); const seat=a==="viseraibw"?0:1; const seen={};
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd);
      if(sd===seat&&!g.prompt&&!J.pendingOf(g)&&g.turnPlayer===sd){ const S=g.sides[sd];
        const gate=(S.board||[]).find(b=>b&&(b.card||b).name==="Gate to i'Arathael");
        if(gate && !J.legal(g,{t:"activate",uid:gate.uid},sd) && !seen[g.turn]){ seen[g.turn]=1; T.legal++;
          const bd=(S.banish||[]).filter(c=>c&&(c.kw||[]).includes("Blood Debt"));
          const locked=bd.filter(c=>J.legal(g,{t:"play",uid:c.uid,from:"banish",target:"hero"},sd));
          if(locked.length){ T.unlock++; const w=String(J.legal(g,{t:"play",uid:locked[0].uid,from:"banish",target:"hero"},sd)).slice(0,80); T.why[w]=(T.why[w]||0)+1; }
          T.hist[bd.length+"bd/"+locked.length+"locked res"+S.res+" hand"+S.hand.length+" ap"+S.ap]=(T.hist[bd.length+"bd/"+locked.length+"locked res"+S.res+" hand"+S.hand.length+" ap"+S.ap]||0)+1;
          if(shown<2 && locked.length){shown++; console.log("x=",JSON.stringify(x), "locked", locked.map(c=>c.name+" c"+c.cost));}
        } }
      if(!x) continue; const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
console.log(JSON.stringify(T,null,1));
