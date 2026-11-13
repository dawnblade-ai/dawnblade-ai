/* node cmp.js off.jsonl on.jsonl [on2.jsonl ...]  : paired per-seed wins(on)-wins(off) */
const fs=require("fs");
const rd=f=>fs.readFileSync(f,"utf8").trim().split("\n").map(l=>JSON.parse(l));
const off=rd(process.argv[2]); const offBy={}; off.forEach(r=>offBy[r.s]=r.off||r.on);
for(const f of process.argv.slice(3)){
  const on=rd(f).map(r=>r.on?r:{...r,on:r.off}); const d=[]; let bad=0;
  on.forEach(r=>{ if(offBy[r.s]) d.push(r.on.w-offBy[r.s].w); bad+=r.on.ref+r.on.viol+r.on.stall; });
  const n=d.length, m=d.reduce((a,b)=>a+b,0)/n, sd=Math.sqrt(d.reduce((a,b)=>a+(b-m)*(b-m),0)/(n-1)), t=m/(sd/Math.sqrt(n));
  const up=d.filter(x=>x>0).length, dn=d.filter(x=>x<0).length;
  const offm=on.reduce((a,r)=>a+offBy[r.s].w,0)/n, onm=on.reduce((a,r)=>a+r.on.w,0)/n;
  console.log(f.replace(/.*\//,"").padEnd(14),`n=${n} off ${offm.toFixed(2)} on ${onm.toFixed(2)} delta ${m>=0?"+":""}${m.toFixed(2)} t ${t.toFixed(2)} up ${up} down ${dn} bad ${bad}`, process.env.V?JSON.stringify(d):"");
}
