const root=__dirname+"/../../";
const {match,W,J}=require(root+"tools/selfplay.js");
const TY=require(root+"engine/types.js");
for(const h of W.HEROES){ const g=match(h.k,h.k==="bravo"?"lyath":"bravo","x",0); const S=g.sides[0];
  const all=[].concat(S.hand,S.deck,S.arsenal?[S.arsenal]:[]); const seen={}; const out=[];
  all.forEach(c=>{ if(!c||seen[c.name])return; seen[c.name]=1; if(TY.isInstant(c)&&!(+c.power>0)&&!TY.isAR(c)&&!TY.isDR(c)) out.push(c.name+"/c"+c.cost); });
  console.log(h.k, out.join("; "));
}
