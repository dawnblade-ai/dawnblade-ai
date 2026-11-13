const r=JSON.parse(require("fs").readFileSync(process.argv[2]));
const B=x=>{
  if(x.sc==="HERO") return "A1 hero ability";
  if(x.sc==="WPN") return "A2 weapon swing";
  if(x.sc==="ACT") return "A3 board activation";
  if(x.sc==="non"||x.sc==="non@ars") return x.sCost===0&&x.sIns ? "B1 free Instant non-attack" : x.sIns ? "B2 paid Instant non-attack" : "B3 non-instant non-attack";
  if(x.sc==="ATK"||x.sc==="ATK@ars") return x.rc.startsWith("ATK")?"C attack->attack":"D go-again non->attack";
  return "E other:"+x.sc;
};
const c={}; r.forEach(x=>{const k=B(x); c[k]=c[k]||{n:0,byRule:{}}; c[k].n++; const rr=x.rc.replace("@ars",""); c[k].byRule[rr]=(c[k].byRule[rr]||0)+1;});
Object.keys(c).sort().forEach(k=>console.log(k.padEnd(30),String(c[k].n).padStart(4),JSON.stringify(c[k].byRule)));
console.log("total",r.length);
const want=process.argv[3]; if(want){ r.filter(x=>B(x).startsWith(want)&&(!process.argv[4]||x.rc===process.argv[4])).slice(+process.argv[5]||0,(+process.argv[5]||0)+2).forEach(x=>console.log(JSON.stringify({hand:x.hand,ars:x.ars,res:x.res,ap:x.ap,turn:x.turn,rule:x.rule,rkey:x.rkey,sharp:x.sharp,skey:x.skey}))); }
