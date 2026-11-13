const r=JSON.parse(require("fs").readFileSync(process.argv[2]));
const grp=(name,pred,keyf)=>{ const rows=r.filter(pred); const c={}; rows.forEach(x=>{const k=keyf(x);c[k]=(c[k]||0)+1}); console.log("\n## "+name+" n="+rows.length); Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,14).forEach(e=>console.log("  "+e[1]+"  "+e[0])); };
const costOf=s=>{const m=/,(\d+)c,/.exec(s);return m?+m[1]:"?"};
grp("HERO sharp, by rule class/key/skey", x=>x.sc==="HERO", x=>`${x.rc} ${x.rkey} => ${x.skey}`);
grp("WPN sharp", x=>x.sc==="WPN", x=>`${x.rc} ${x.rkey} => ${x.skey}`);
grp("ACT sharp", x=>x.sc==="ACT", x=>`${x.rc} ${x.rkey} => ${x.skey}`);
grp("ATK=>non by sharp card cost/kap", x=>x.rc==="ATK"&&x.sc==="non", x=>`cost${costOf(x.sharp)} kap=${x.skap} skey=${x.skey} rkey=${x.rkey}`);
grp("non=>* ", x=>x.rc==="non", x=>`${x.sc} rkap=${x.rkap} rkey=${x.rkey} skey=${x.skey}`);
