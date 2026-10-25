const R = process.argv[2], HERO = process.argv[3];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","blaze","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
const T={}, inc=(k,n=1)=>T[k]=(T[k]||0)+n; const atkPerTurn={};
const isAtk = c => (c.ty||[]).some(t=>/^attack$/i.test(t));
for(const foe of HEROES){ if(foe===HERO) continue; for(const first of [0,1]){
  const [k0,k1] = first===0?[HERO,foe]:[foe,HERO]; const me = first===0?0:1;
  let g = match(k0,k1,`${k0}-${k1}-0`,0), steps=0, curTurn=-1, atks=0;
  const flush=()=>{ if(curTurn>=0){ atkPerTurn[atks]=(atkPerTurn[atks]||0)+1; } };
  while(!g.over && steps<4000){ let moved=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue;
      if(s===me && g.turnPlayer===me && g.turn!==curTurn){ flush(); curTurn=g.turn; atks=0;
        const h=g.sides[me].hand; inc("turns"); inc("handAtk", h.filter(isAtk).length); inc("handNon", h.filter(c=>!isAtk(c)).length); }
      const sd=g.sides[me];
      if(s===me && a.t==="paySel"){ const c=sd.hand.find(x=>x.uid===a.uid); if(c) inc(g.turnPlayer===me?"pitchOwnTurn:"+(isAtk(c)?"attack":"non"):"pitchFoeTurn:"+(isAtk(c)?"attack":"non")); }
      if(s===me && g.turnPlayer===me && (a.t==="play"||a.t==="activate")){ const c=[...sd.hand,...(sd.arsenal?[sd.arsenal]:[])].find(x=>x.uid===a.uid); if((c&&isAtk(c))||(a.t==="activate"&&a.uid!=="hpow")) atks++; if(c&&!isAtk(c)) inc("playNon"); }
      const o=J.reduce(g,a,s); if(o.error) continue; g=o.state; steps++; moved=true; break; }
    if(!moved) break; }
  flush(); } }
console.log(HERO, JSON.stringify(T)); console.log("attacks per own turn:", JSON.stringify(atkPerTurn));
console.log("avg hand: atk", (T.handAtk/T.turns).toFixed(2), "non", (T.handNon/T.turns).toFixed(2));
