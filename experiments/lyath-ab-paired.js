// node ab2.js offFile onFile  (rows with .off.w each) -> paired
const fs=require("fs");const L=f=>fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const a=L(process.argv[2]),b=L(process.argv[3]);
const m=new Map(a.map(r=>[r.s,r.off]));const d=[];const rows=[];
for(const r of b){const o=m.get(r.s);if(!o)continue;const w=(r.off||r.on);d.push(w.w-o.w);rows.push(o.w+">"+w.w);}
const n=d.length,mu=d.reduce((x,y)=>x+y,0)/n,sd=Math.sqrt(d.reduce((x,y)=>x+(y-mu)**2,0)/Math.max(1,n-1));
const bad=b.reduce((t,r)=>t+((r.off||r.on).ref+(r.off||r.on).viol+(r.off||r.on).stall),0);
console.log(rows.join(" "),"| mean diff",mu.toFixed(2),"t",(sd?mu/(sd/Math.sqrt(n)):0).toFixed(1),"n",n,"ref/viol/stall",bad);
