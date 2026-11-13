const fs=require("fs");const dir=process.argv[2];
const L=f=>fs.existsSync(f)?fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse):[];
let tot=0,N=0;const all=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".off.jsonl"))){
  const h=f.replace(".off.jsonl","");const a=L(dir+"/"+f),b=L(dir+"/"+h+".on.jsonl");
  const m=new Map(a.map(r=>[r.s,r.off]));const rows=[],d=[];let bad=0;
  for(const r of b){const o=m.get(r.s);if(!o)continue;d.push(r.off.w-o.w);rows.push(o.w+">"+r.off.w);bad+=r.off.ref+r.off.viol+r.off.stall;}
  if(!d.length)continue;const n=d.length,mu=d.reduce((x,y)=>x+y,0)/n,sd=Math.sqrt(d.reduce((x,y)=>x+(y-mu)**2,0)/Math.max(1,n-1));
  all.push(...d);
  console.log(h.padEnd(10),rows.join(" ").padEnd(40),"mean",mu.toFixed(2).padStart(6),"t",(sd?mu/(sd/Math.sqrt(n)):0).toFixed(1).padStart(5),"bad",bad);
}
const n=all.length,mu=all.reduce((x,y)=>x+y,0)/n;console.log("pooled mean",mu.toFixed(2),"hero-seeds",n);
