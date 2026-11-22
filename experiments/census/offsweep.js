// THE OFF-TURN LESSON SWEEP (2026-11-22): `node offsweep.js <hero> <seeds>` -> JSON.
// Every action the hero's seat takes on the OPPONENT's turn that plays or activates something
// (any zone, any reason key) is counted under its reason key. Hand cards pitched to pay for it
// (the paySel calls of the payment that follows) are counted, and their counterfactual is
// measured: the game is FORKED at the state before the action, the seat passes instead (that
// action is refused to it for the rest of that opponent turn), the policy plays on through
// the seat's NEXT own turn, and the first thing the seat does with each of those pitched cards
// in the fork is recorded (played / pitched / arsenalled own turn = "next turn's card";
// blocked or cast on their turn; still held at the end of its next own turn).
// `defending`: the action came while the seat was being attacked (a defence window).
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const hero=process.argv[2], seeds=+process.argv[3]||1;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const R={}; let games=0, wins=0;
const row=k=>R[k]||(R[k]={n:0,defending:0,zones:{},paid:0,pitched:0,fate:{},saved:0,savedN:0,savedHist:{}});
const inc=(o,k,v)=>o[k]=(o[k]||0)+(v||1);
const same=(a,b)=>a&&b&&a.t===b.t&&a.uid===b.uid&&(a.from||"")===(b.from||"");
function fork(g0, seat, banned, uids){
  let g=g0; const turn0=g0.turn, left=new Set(uids), fate={}; let seenOwn=false, hpOwn=null;
  const done=(u,f)=>{ if(left.has(u)){ left.delete(u); fate[u]=f; } };
  for(let i=0;i<3000&&!g.over&&(left.size||hpOwn==null);i++){ let mv=false;
    if(g.turnPlayer===seat){ if(!seenOwn) hpOwn=g.sides[seat].hp; seenOwn=true; }
    else if(seenOwn){ for(const u of [...left]) done(u,"held after next own turn"); break; }
    if(seenOwn && !left.size) break;
    for(const sd of [0,1]){ let x=SP.act(g,sd); if(!x) continue;
      if(sd===seat && g.turn===turn0 && same(x,banned)) x={t:"pass"};
      if(sd===seat){ const s=JSON.stringify(x); for(const u of [...left]) if(s.indexOf(JSON.stringify(u))>=0 && x.t!=="pass")
        done(u, (x.t==="paySel"?"pitched":x.t==="play"?"played":x.t==="arsenal"?"arsenalled":x.t==="defend"?"blocked":x.t)+" "+(g.turnPlayer===seat?"own":"opp")); }
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break;
    const S=g.sides[seat];
    for(const u of [...left]) if(!(S.hand||[]).some(c=>c&&c.uid===u) && !(S.arsenal&&S.arsenal.uid===u)) done(u,"left hand otherwise");
  }
  for(const u of [...left]) done(u, g.over?"game over":"unresolved");
  if(hpOwn==null && g.over) hpOwn = g.sides[seat].hp;
  return {fate, hpOwn};
}
for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`sweep-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; games++;
  let open=null; // {g0, key, act, uids}
  const waitHp=[]; // {key, hpFork}: life the fork had at the start of the seat's next turn
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const sd of [0,1]){ let x, key;
      if(sd===seat){ const e=SP.explain(g,sd); x=e&&e.action; key=e&&e.key; } else x=SP.act(g,sd);
      if(!x) continue;
      if(sd===seat && !open && g.turnPlayer!==seat && !g.pending && !g.prompt && (x.t==="play"||x.t==="activate")){
        const r0=row(key); r0.n++; inc(r0.zones, x.t==="activate"?"act:"+(x.from||"gear"):x.from||"?");
        if(g.pend && g.pend.by!=null && g.pend.by!==seat) r0.defending++;
        open={g0:g, key, act:x, uids:[], started:false};
      } else if(sd===seat && open && x.t==="paySel") open.uids.push(x.uid);
      const r=J.reduce(g,x,sd); if(r.error) continue; g=r.state; mv=true;
      if(open){ if(g.pending) open.started=true;
        if(!g.pending && (open.started || sd!==seat || x!==open.act)){ // payment over (or none)
          const r0=row(open.key);
          if(open.uids.length){ r0.paid++; r0.pitched+=open.uids.length;
            const F=fork(open.g0, seat, open.act, open.uids); for(const u in F.fate) inc(r0.fate, F.fate[u]);
            if(F.hpOwn!=null) waitHp.push({key:open.key, hp:F.hpOwn, k:open.uids.length}); }
          open=null; } }
      break; }
    if(!mv) break;
    if(g.turnPlayer===seat && waitHp.length) for(const w of waitHp.splice(0)){ const r0=row(w.key), d=g.sides[seat].hp-w.hp;
      r0.saved+=d; r0.savedN++; inc(r0.savedHist, String(Math.max(-3,Math.min(6,d)))); } }
  if(g.over&&g.over.winner===seat) wins++;
}
for(const k in R){ R[k].fate=Object.fromEntries(Object.entries(R[k].fate).sort((x,y)=>y[1]-x[1])); }
console.log(JSON.stringify({hero,games,wins,keys:R}));
