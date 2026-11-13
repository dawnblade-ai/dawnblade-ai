const r=JSON.parse(require("fs").readFileSync(process.argv[2]));
const c={};r.forEach(x=>{const k=x.rc+"=>"+x.sc;c[k]=(c[k]||0)+1});
console.log(r.length, Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,14).map(e=>e.join(" ")).join(" | "));
const f=process.argv[3], n=+process.argv[4]||5;
if(f){ const [a,b]=f.split("=>"); r.filter(x=>(a==="*"||a.split(",").includes(x.rc))&&(b==="*"||b.split(",").includes(x.sc))).slice(0,n).forEach(x=>console.log(JSON.stringify(x))); }
