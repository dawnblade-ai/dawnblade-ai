const root=__dirname+"/../../";
const H=require(root+"test/helpers/judged.js"); const J=H.J; const {match}=require(root+"tools/selfplay.js");
const g0=match("lyath","kayo","if-dbg",0); const pick=n=>g0.sides[0].deck.find(x=>x.name===n);
const mb=pick("Mocking Blow"), bz=pick("Booze!"), co=pick("Concealed Object");
const mk=(hand,res)=>({...g0,sides:g0.sides.map((s,k)=>k?s:{...s,hand,arsenal:null,res,ap:1})});
for(const [nm,c,res] of [["booze",bz,0],["co",co,0],["co cost1 res1",{...co,cost:1},1],["co cost1 res0",{...co,cost:1},0]]){
  const st=mk([c,mb],res); const a={t:"play",uid:c.uid,from:"hand"};
  console.log(nm,"legal",J.legal(st,a,0));
  const o=J.reduce(st,a,0); if(o.error){console.log(" err",o.error);continue;}
  const s=o.state; console.log(" pending",!!J.pendingOf(s),"prompt",!!s.prompt,"stack",(s.stack||[]).length,"booed",s.sides[0].hist&&s.sides[0].hist.booed, "eff", JSON.stringify(J.effPowerNow(s,0,mb.uid,"hand")));
}
