const fs = require("fs"); const dir = process.argv[2];
const rd = f => fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const heroes = fs.readdirSync(dir).filter(f => f.endsWith(".off.jsonl")).map(f => f.replace(".off.jsonl", ""));
let tot = {ref: 0, viol: 0, stall: 0};
for(const h of heroes){
  const off = rd(`${dir}/${h}.off.jsonl`), on = rd(`${dir}/${h}.on.jsonl`);
  const same = off.every((r, i) => JSON.stringify(r.off) === JSON.stringify(on[i].off));
  on.forEach(r => { tot.ref += r.off.ref; tot.viol += r.off.viol; tot.stall += r.off.stall; });
  if(same){ console.log(h.padEnd(10), "byte-identical"); continue; }
  const d = off.map((r, i) => on[i].off.w - r.off.w), n = d.length, m = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)), t = sd ? m / (sd / Math.sqrt(n)) : 0;
  console.log(h.padEnd(10), "off", off.map(r => r.off.w).join(","), "| on", on.map(r => r.off.w).join(","), "| mean d", m.toFixed(2), "t", t.toFixed(2),
    "| off>on seeds", d.filter(x => x < 0).length, "on>off", d.filter(x => x > 0).length);
}
console.log("on-arm refusals/violations/stalls:", JSON.stringify(tot));
