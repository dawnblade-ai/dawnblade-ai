const r=JSON.parse(require("fs").readFileSync(process.argv[2]));
const [sc,rc]=[process.argv[3],process.argv[4]];
const c={};
r.filter(x=>(sc==="*"||x.sc===sc)&&(rc==="*"||rc.split(",").includes(x.rc))).forEach(x=>{const k=`${x.rule.replace(/\(.*/,"")} [${x.rkey}] => ${x.sharp.replace(/\(.*/,"")} [${x.skey}]`;c[k]=(c[k]||0)+1});
Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,+process.argv[5]||20).forEach(e=>console.log(e[1],e[0]));
