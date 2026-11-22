// Cloak-perf probe (2026-11-22, SPXCLOAK). Scratch paths are the worker's; adjust before running.
// Time DawnSparring.act on the REAL page at CPU throttle, on positions from cloaktime.js's dump.
const {open}=require("/home/user/dawnblade-ai/tools/page.js");
const pos=JSON.parse(require("fs").readFileSync(process.argv[2])); const RATE=+(process.argv[3]||4);
(async()=>{
  const kit=await open({w:393,h:852}); const {page}=kit;
  await page.waitForFunction(()=>window.DawnSparring&&window.DawnSparring.act,null,{timeout:60000});
  const cdp=await page.context().newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate",{rate:RATE});
  const res=await page.evaluate((pos)=>{ const SP=window.DawnSparring; const out={};
    for(const [name,opt] of [["rule",null],["sharp",{search:true}]]){ const t=[]; let cp=0;
      for(const p of pos){ SP.act(p.g,p.seat,opt); const t0=performance.now(); SP.act(p.g,p.seat,opt); t.push(performance.now()-t0);
        const e=SP.explain(p.g,p.seat,opt); if(e.key==="cloakPay") cp++; }
      t.sort((a,b)=>a-b); out[name]={n:t.length,cloakPay:cp,p50:+t[Math.floor(t.length*.5)].toFixed(1),p95:+t[Math.floor(t.length*.95)].toFixed(1),worst:+t[t.length-1].toFixed(1)}; }
    return out; }, pos);
  console.log("throttle",RATE,JSON.stringify(res)); await kit.close(); })().catch(e=>{console.error(e);process.exit(1);});
