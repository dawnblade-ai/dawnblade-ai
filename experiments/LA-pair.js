/* node experiments/LA-pair.js <offDir> <onDir> [label] — pairs a search-OFF run with a search-ON run
   by hero and seed (LA-ab.js `off` and `on` modes, written apart so one OFF arm serves every setting).
   Per hero: mean wins of 28 off/on, paired diff, t, seeds up/down; then pooled diff, refusals/violations/
   stalls/draws in the ON arm, and the step distribution of searched decisions (p50/p95/max, over-budget share). */
const fs = require("fs");
const [offD, onD, label] = process.argv.slice(2);
const load = f => fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
const rows = [], all = [], hist = {}; let tot = {ref: 0, viol: 0, stall: 0, draw: 0, searched: 0, over: 0, overruled: 0};
for(const f of fs.readdirSync(onD).filter(f => f.endsWith(".jsonl"))){
  const off = new Map(load(offD + "/" + f).map(r => [r.s, r.off])), on = load(onD + "/" + f).filter(r => off.has(r.s));
  if(!on.length) continue;
  const d = on.map(r => r.on.w - off.get(r.s).w), n = d.length, m = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  const t = sd ? m / (sd / Math.sqrt(n)) : (m ? Infinity : 0);
  on.forEach(r => { for(const k of ["ref", "viol", "stall", "draw", "searched", "over", "overruled"]) tot[k] += r.on[k] || 0;
    for(const [k, v] of Object.entries(r.on.hist || {})) hist[k] = (hist[k] || 0) + v; });
  all.push(...d);
  rows.push({hero: f.replace(".jsonl", ""), n, off: +(on.reduce((a, r) => a + off.get(r.s).w, 0) / n).toFixed(2),
             on: +(on.reduce((a, r) => a + r.on.w, 0) / n).toFixed(2), diff: +m.toFixed(2), t: +t.toFixed(1),
             up: d.filter(x => x > 0).length, down: d.filter(x => x < 0).length});
}
rows.sort((a, b) => b.diff - a.diff);
console.log("== " + (label || onD));
console.table(rows);
const m = all.reduce((a, b) => a + b, 0) / all.length;
const sdp = Math.sqrt(all.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, all.length - 1));
const ks = Object.keys(hist).map(Number).sort((a, b) => a - b), N = ks.reduce((a, k) => a + hist[k], 0);
const q = p => { let c = 0; for(const k of ks){ c += hist[k]; if(c >= p * N) return k; } return ks[ks.length - 1]; };
console.log(`pooled ${m.toFixed(2)} of 28 per hero-seed (t ${(m / (sdp / Math.sqrt(all.length))).toFixed(1)}, ${all.length} hero-seeds), heroes t>2: ${rows.filter(r => r.t > 2).length}/${rows.length}, negative: ${rows.filter(r => r.diff < 0).length}`);
console.log(`ON arm: refusals ${tot.ref} violations ${tot.viol} stalls ${tot.stall} draws ${tot.draw}; searched ${tot.searched}, overruled ${(100 * tot.overruled / tot.searched).toFixed(0)}%, over budget ${(100 * tot.over / tot.searched).toFixed(1)}%`);
console.log(`steps per searched decision: p50 ~${q(.5)} p95 ~${q(.95)} p99 ~${q(.99)} max ~${ks[ks.length - 1]} (10-step buckets)`);
