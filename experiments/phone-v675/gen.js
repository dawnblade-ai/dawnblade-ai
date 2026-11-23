// Phone-bound positions (v6.74): per hero, decision points where the hero's seat acts (the AI seat
// would be asked), split own turn / opponent's turn, sampled evenly. Writes <out>/<hero>.json.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const out = process.argv[2], N = +(process.argv[3] || 30), only = process.argv[4];
const fs = require("fs");
for(const hero of W.HEROES.map(h => h.k).filter(h => !only || only.split(",").includes(h))){
  const foes = W.HEROES.map(h => h.k).filter(k => k !== hero); const pool = {own: [], opp: []};
  for(let gi = 0; gi < 12; gi++){ const foe = foes[gi % foes.length], seat = gi % 2;
    let g = match(seat ? foe : hero, seat ? hero : foe, `ph-${hero}-${gi}`, gi % 2);
    for(let i = 0; i < 4000 && !g.over; i++){ let mv = false;
      for(const s of [0, 1]){ const x = SP.act(g, s); if(!x) continue;
        if(s === seat && x.t !== "pass") pool[g.turnPlayer === seat ? "own" : "opp"].push({g, seat});
        const r = J.reduce(g, x, s); if(r.error) continue; g = r.state; mv = true; break; }
      if(!mv) break; } }
  const pick = a => { const k = Math.max(1, Math.floor(a.length / N)); return a.filter((_, i) => i % k === 0).slice(0, N); };
  const ps = pick(pool.own).map(p => Object.assign(p, {side: "own"})).concat(pick(pool.opp).map(p => Object.assign(p, {side: "opp"})));
  fs.writeFileSync(`${out}/${hero}.json`, JSON.stringify(ps));
  console.log(hero, "own", pool.own.length, "opp", pool.opp.length, "->", ps.length, (fs.statSync(`${out}/${hero}.json`).size / 1e6).toFixed(1) + "MB");
}
