/* node experiments/LA-ladder.js <dir> — sum the sliced ladder (tourney.js <hero> '' 3, one file per
   hero as A, written ladder-on-<hero>.txt) into one 630-game ladder: per hero wins of 84, the
   per-seed columns, and the refusal / violation / fault / stall / draw totals. */
const fs = require("fs"), dir = process.argv[2];
const wins = {}, tot = {games: 0, stalls: 0, draws: 0, ref: 0, viol: 0}, faults = {};
for(const f of fs.readdirSync(dir).filter(f => /^ladder-on-.*\.txt$/.test(f))){
  const t = fs.readFileSync(dir + "/" + f, "utf8");
  let m = t.match(/GAMES (\d+) · stalls (\d+) · draws (\d+)/); if(m){ tot.games += +m[1]; tot.stalls += +m[2]; tot.draws += +m[3]; }
  m = t.match(/POLICY REFUSALS (\d+) · INVARIANT VIOLATIONS (\d+) · (.*)/);
  if(m){ tot.ref += +m[1]; tot.viol += +m[2]; m[3].split(" · ").forEach(x => { const [k, v] = x.trim().split(" "); faults[k] = (faults[k] || 0) + (+v || 0); }); }
  const per = t.split("PER SEED")[1] || "";
  for(const line of per.split("\n")){
    const r = line.match(/^\s{2}([a-z]+)\s+((?:\s*\d+){3})\s+[\d.]+\s+\d+$/); if(!r) continue;
    const v = r[2].trim().split(/\s+/).map(Number);
    wins[r[1]] = (wins[r[1]] || [0, 0, 0]).map((x, i) => x + v[i]);
  }
}
const rows = Object.entries(wins).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0), v]).sort((a, b) => b[1] - a[1]);
console.log(rows.map(([k, w]) => `${k} ${w}`).join(" · "));
rows.forEach(([k, w, v]) => console.log(`  ${k.padEnd(10)} ${String(w).padStart(3)}  [${v.join(" ")}]`));
const ws = rows.map(r => r[1]), mean = ws.reduce((a, b) => a + b, 0) / ws.length;
console.log(`stdev ${Math.sqrt(ws.reduce((a, b) => a + (b - mean) ** 2, 0) / ws.length).toFixed(1)} · spread ${Math.max(...ws) - Math.min(...ws)}`);
console.log(`GAMES ${tot.games} · REFUSALS ${tot.ref} · VIOLATIONS ${tot.viol} · stalls ${tot.stalls} · draws ${tot.draws} · faults ${JSON.stringify(faults)}`);
