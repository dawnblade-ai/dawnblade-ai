const R = process.argv[2];
const {match, J, SP} = require(R + "/tools/selfplay.js");
const HEROES = ["arakni","azalea","boltyn","bravo","briar","dash","dorinthea","enigma","fai","gravy","iyslander","kayo","lyath","viserai"];
outer: for(const foe of HEROES){
  const seed=`blaze-${foe}-0`; let g = match("blaze",foe,seed,0); let steps=0;
  while(!g.over && steps<4000){ let moved=false;
    for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue;
      const o=J.reduce(g,a,s); if(o.error) continue;
      if(a.t==="play" && a.from==="banish"){
        const c=(o.state.sides[s].banish||[]).find(x=>x.uid===a.uid);
        const again = c && J.legal(o.state,{t:"play",uid:a.uid,from:"banish"},s)==null;
        if(again){ console.log(`${seed} turn ${g.turn}: ${c.name}#${a.uid} played from banish, back in banish with _playTurn=${c._playTurn}, legal to play AGAIN: ${again}; res ${o.state.sides[s].res}`); break outer; }
      }
      g=o.state; steps++; moved=true; }
    if(!moved) break; }
}
