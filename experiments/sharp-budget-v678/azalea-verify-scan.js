const {match,SP,J}=require("/home/user/dawnblade-ai/tools/selfplay.js");
const keep={...SP.LA};
for(const foe of ["viserai","kayo","bravo","dash"]) for(let i=0;i<40;i++){
  const g0 = match("azalea", foe, "az"+i, 0), sd = g0.sides[0];
  const arr = sd.hand.find(c => /Arrow/.test(c.tt || "")); if(!arr) continue;
  const g = {...g0, sides: [{...sd, arsenal: arr, hand: sd.hand.filter(c => c !== arr)}, g0.sides[1]]};
  const run=o=>{Object.assign(SP.LA,keep,o,{stats:{decisions:0,searched:0,overruled:0,steps:0,ms:0,maxSteps:0,over:0,hist:{}}}); const a=SP.act(g,0,{search:true}); return [a&&a.uid, SP.LA.stats.over, SP.LA.stats.unverified||0];};
  const r1=run({verify:1,bW:0}), r4=run({verify:4}), r4b=run({verify:4,bW:0});
  if(r1[0]==="hpow" && (r4[0]!=="hpow"||r4b[0]!=="hpow")) console.log(foe,"az"+i, "v1",r1,"v4",r4,"v4bW0",r4b);
}
