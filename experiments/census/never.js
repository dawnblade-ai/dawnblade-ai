const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2], seeds=+process.argv[3]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const L={}, U={}; let games=0,wins=0;
const name=(sd,uid)=>{for(const z of ["hand","gear","board","banish","grave"]) for(const c of (sd[z]||[])){ if(!c) continue; const cc=c.card||c; if(c.uid===uid||cc.uid===uid) return z+":"+cc.name;} if(sd.arsenal&&sd.arsenal.uid===uid) return "ars:"+sd.arsenal.name; return uid;};
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`nv-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  const seenL={}, seenU={};
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ const x=SP.act(g,sd); 
      if(sd===seat && !g.prompt && !J.pendingOf(g)){
        const S=g.sides[sd]; const own=g.turnPlayer===sd?"own":"opp"; const cand=[];
        (S.hand||[]).forEach(c=>c&&cand.push({t:"play",uid:c.uid,from:"hand"}));
        if(S.arsenal) cand.push({t:"play",uid:S.arsenal.uid,from:"arsenal"});
        (S.grave||[]).forEach(c=>c&&cand.push({t:"play",uid:c.uid,from:"grave"}));
        (S.banish||[]).forEach(c=>c&&cand.push({t:"play",uid:c.uid,from:"banish"}));
        (S.gear||[]).forEach(c=>c&&cand.push({t:"activate",uid:c.uid}));
        (S.board||[]).forEach(c=>c&&cand.push({t:"activate",uid:c.uid}));
        cand.push({t:"activate",from:"hero",uid:"hpow"});
        for(const c of cand){ let ok=false; try{ ok=!J.legal(g,c,sd);}catch(e){}
          if(!ok){ // try with target
            if(c.t==="play"||c.t==="activate"){ try{ ok=!J.legal(g,{...c,target:"hero"},sd);}catch(e){} } }
          if(!ok) continue;
          const k=(c.from==="hero"?"HERO":c.t+" "+name(S,c.uid))+" ["+own+"]"; const tk=k+g.turn;
          if(!seenL[tk]){seenL[tk]=1; L[k]=(L[k]||0)+1;} }
        if(x && (x.t==="play"||x.t==="activate")){ const k=(x.from==="hero"?"HERO":x.t+" "+name(S,x.uid))+" ["+own+"]"; const tk=k+g.turn; if(!seenU[tk]){seenU[tk]=1; U[k]=(U[k]||0)+1;} }
      }
      if(!x) continue; const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; }
  if(g.over&&g.over.winner===seat) wins++;
}
console.log("games",games,"wins",wins);
Object.keys(L).map(k=>[k,L[k],U[k]||0]).filter(r=>r[1]>=8).sort((a,b)=>(b[1]-b[2])-(a[1]-a[2])).slice(0,30).forEach(r=>console.log(String(r[1]).padStart(5),String(r[2]).padStart(5),r[0]));
