// Cloak-perf probe (2026-11-22, SPXCLOAK). Scratch paths are the worker's; adjust before running.
// Time act() at off-turn decisions where Iyslander/Blaze wear the Cloak and an off-turn play/activation is proposed.
const path=require("path"); const ROOT=process.env.ROOT||"/home/user/dawnblade-ai";
const {match, W, J, SP} = require(ROOT+"/tools/selfplay.js");
const out=[]; const N=+process.argv[2]||200; const dump=process.argv[3];
const keys=W.HEROES.map(h=>h.k);
for(const hero of ["iyslander","blaze"]) for(let gi=0; gi<64 && out.length<N; gi++){
  const foe=keys.filter(k=>k!==hero)[gi%16], seat=gi%2;
  let g=match(seat?foe:hero, seat?hero:foe, `ct-${hero}-${gi}`, gi%2);
  for(let i=0;i<4000&&!g.over;i++){ let mv=false;
    for(const s of [0,1]){ const x=SP.act(g,s); if(!x) continue;
      if(s===seat && g.turnPlayer!==seat && !g.pending && !g.prompt && (g.sides[seat].gear||[]).some(c=>c&&c.name==="Spellfire Cloak") && (x.t==="play"||x.t==="activate")) out.push({g:JSON.parse(JSON.stringify(g)),seat});
      const r=J.reduce(g,x,s); if(r.error) continue; g=r.state; mv=true; break; }
    if(!mv) break; } }
const pct=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(2);};
for(const opt of [null,{search:true}]){ const t=[]; let cp=0;
  for(const {g,seat} of out){ SP.act(g,seat,opt); const t0=process.hrtime.bigint(); const a=SP.act(g,seat,opt); t.push(Number(process.hrtime.bigint()-t0)/1e6);
    const e=SP.explain(g,seat,opt); if(e.key==="cloakPay") cp++; }
  console.log(opt?"sharp":"rule", "n",out.length,"cloakPay",cp,"p50",pct(t,.5),"p95",pct(t,.95),"worst",Math.max(...t).toFixed(2));
}
if(dump) require("fs").writeFileSync(dump, JSON.stringify(out));
