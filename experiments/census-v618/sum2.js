const L=require("fs").readFileSync(process.argv[2],"utf8").trim().split("\n").filter(l=>l[0]==="{").map(JSON.parse); const by={};
for(const r of L){ (by[r.s]=by[r.s]||{})[r.gate==="none"?"off":"on"]=r; }
const d=[]; let off=0,on=0,bad=0; const rows=[];
for(const s of Object.keys(by).sort((a,b)=>a-b)){ if(!by[s].off||!by[s].on) continue; const a=by[s].off.w,b=by[s].on.w; off+=a;on+=b; d.push(b-a); bad+=["off","on"].reduce((t,k)=>t+by[s][k].ref+by[s][k].viol+by[s][k].stall,0); rows.push(s+":"+a+"→"+b); }
const n=d.length, m=d.reduce((x,y)=>x+y,0)/n, sd=Math.sqrt(d.reduce((x,y)=>x+(y-m)**2,0)/(n-1));
console.log(rows.join(" ")); console.log("n",n,"mean off",(off/n).toFixed(2),"on",(on/n).toFixed(2),"diff",m.toFixed(2),"t",(m/(sd/Math.sqrt(n))).toFixed(2),"faults",bad);
