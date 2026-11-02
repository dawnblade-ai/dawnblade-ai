/* node experiments/LA-sum.js <dir> [dir…] (runs merged per hero) — per hero: off/on mean wins of 28 per seed, paired diff, t, up/down seeds */
const fs = require("fs"), dirs = process.argv.slice(2);
let tot = {ref: 0, viol: 0, stall: 0, draw: 0, searched: 0, ms: 0, steps: 0}, rows = [], allD = [];
for(const f of fs.readdirSync(dirs[0]).filter(f => f.endsWith(".jsonl"))){
  const L = [].concat(...dirs.filter(d => fs.existsSync(d + "/" + f)).map(d => fs.readFileSync(d + "/" + f, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)));
  if(!L.length) continue;
  const d = L.map(r => r.on.w - r.off.w), n = d.length, m = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  const t = sd ? m / (sd / Math.sqrt(n)) : (m ? Infinity : 0);
  L.forEach(r => { for(const k of ["ref", "viol", "stall", "draw"]) tot[k] += r.on[k] + r.off[k];
    tot.searched += r.on.searched; tot.ms += r.on.msPer * r.on.searched; tot.steps += r.on.stepsPer * r.on.searched; });
  allD.push(...d);
  const mx = Math.max(...L.map(r => r.on.maxSteps));
  rows.push({hero: L[0].hero, n, off: (L.reduce((a, r) => a + r.off.w, 0) / n).toFixed(2), on: (L.reduce((a, r) => a + r.on.w, 0) / n).toFixed(2),
             diff: m.toFixed(2), t: t.toFixed(1), up: d.filter(x => x > 0).length, down: d.filter(x => x < 0).length,
             overruled: (L.reduce((a, r) => a + r.on.overruled, 0) / L.reduce((a, r) => a + r.on.searched, 0) * 100).toFixed(0) + "%", maxSteps: mx});
}
rows.sort((a, b) => b.diff - a.diff);
console.table(rows);
const m = allD.reduce((a, b) => a + b, 0) / allD.length;
console.log(`pooled diff ${m.toFixed(2)} of 28 per hero-seed over ${allD.length} hero-seeds; refusals ${tot.ref} violations ${tot.viol} stalls ${tot.stall} draws ${tot.draw}`);
console.log(`search: ${tot.searched} decisions, ${(tot.ms / tot.searched).toFixed(1)} ms and ${(tot.steps / tot.searched).toFixed(0)} engine steps per searched decision`);
