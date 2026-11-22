// Cloak-perf probe (2026-11-22, SPXCLOAK). Scratch paths are the worker's; adjust before running.
// Per hero: every gear/board piece judge.abPieceResGain says pays a resource; legal on the opponent's turn?; cloakPay hits.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const seeds=+process.argv[2]||3; const keys=W.HEROES.map(h=>h.k); const R={};
for(const hero of keys){ R[hero]={pieces:{},games:0,cloakPay:{}};
  for(let s=0;s<seeds;s++) for(const o of keys.filter(k=>k!==hero)) { const seat=s%2;
    let g=match(seat?o:hero, seat?hero:o, `rp-${hero}-${o}-${s}`, s%2); R[hero].games++;
    for(let i=0;i<4000&&!g.over;i++){ let mv=false;
      for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
        if(sd===seat){ const S=g.sides[seat]; const off=g.turnPlayer!==seat;
          for(const c of [...(S.gear||[]),...(S.board||[])]){ if(!c) continue; const gain=J.abPieceResGain(g,seat,c.uid); if(!(gain>0)) continue;
            const e=R[hero].pieces[c.name]||(R[hero].pieces[c.name]={gain,def:c.def,power:c.power,offLegal:0,ownLegal:0});
            if(!g.pending&&!g.prompt&&!J.legal(g,{t:"activate",uid:c.uid},seat)) off?e.offLegal++:e.ownLegal++; }
          if(off&&x.t==="activate"){ const c=[...(S.gear||[]),...(S.board||[])].find(c=>c&&c.uid===x.uid); if(c&&SP.explain(g,seat).key==="cloakPay") R[hero].cloakPay[c.name]=(R[hero].cloakPay[c.name]||0)+1; } }
        const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
      if(!mv) break; } } }
for(const [h,r] of Object.entries(R)){ const p=Object.entries(r.pieces); if(!p.length) continue;
  console.log(h, "games", r.games, p.map(([n,e])=>`${n}(gain ${e.gain}, def ${e.def}${e.power!=null?", weapon":""}: legal own ${e.ownLegal} / opp ${e.offLegal})`).join("; "), "cloakPay", JSON.stringify(r.cloakPay)); }
