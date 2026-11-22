// Table from offsweep-out/*.json: one row per hero x reason key, sorted by "next turn's card" share.
const fs=require("fs"), dir=__dirname+"/offsweep-out"; const rows=[];
for(const f of fs.readdirSync(dir)){ const d=JSON.parse(fs.readFileSync(dir+"/"+f,"utf8"));
  for(const [k,r] of Object.entries(d.keys)){ const F=r.fate; let next=0, tot=0;
    for(const [fk,v] of Object.entries(F)){ if(/game over|unresolved/.test(fk)) continue; tot+=v; if(/ own$/.test(fk)) next+=v; }
    rows.push({hero:d.hero,key:k,n:r.n,def:r.defending,paid:r.paid,pitched:r.pitched,ftot:tot,next,share:tot?next/tot:0,zones:r.zones,fate:F}); } }
rows.sort((a,b)=>b.pitched-a.pitched);
const pct=x=>(100*x).toFixed(0)+"%";
console.log("hero        key            n  def paid pitch  next/fork  share  zones");
for(const r of rows) console.log(r.hero.padEnd(11),r.key.padEnd(14),String(r.n).padStart(3),String(r.def).padStart(4),String(r.paid).padStart(4),String(r.pitched).padStart(5),(r.next+"/"+r.ftot).padStart(10),pct(r.share).padStart(6)," ",JSON.stringify(r.zones), r.share>0.7&&r.def<r.n/2&&r.pitched>=10?"  <== FLAG":"");
if(process.argv[2]==="-v") for(const r of rows) if(r.pitched) console.log(r.hero,r.key,JSON.stringify(r.fate));
