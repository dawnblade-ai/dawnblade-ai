/* In rule-policy games, at each decision of the hero, would Sharp choose differently? Tally by
   Steady's call key, and what Sharp chose instead. */
const R = "/home/user/dawnblade-ai";
const {match, W, SP, J} = require(R + "/tools/selfplay.js");
const HEROES = W.HEROES.map(h => h.k);
const hero = process.argv[2];
const T = {}, ex = {};
let decisions = 0;
for(const o of HEROES.filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]) for(let s = 0; s < 3; s++){
  let n = match(a, b, `${a}-${b}-cen${s}`, s % 2); const hs = a === hero ? 0 : 1;
  for(let i = 0; i < 6000 && !n.over; i++){
    let moved = false;
    for(const seat of [0, 1]){
      const a0 = SP.act(n, seat, {search: false}); if(!a0) continue;
      if(seat === hs){
        decisions++;
        const e = SP.explain(n, hs, {search: false});
        const sh = SP.act(n, hs, {search: true});
        if(JSON.stringify(sh) !== JSON.stringify(a0)){
          const se = SP.explain(n, hs, {search: true});
          const k = (e.key || a0.t) + " -> " + (se.key || (sh && sh.t));
          T[k] = (T[k] || 0) + 1;
          if(!ex[k]) ex[k] = {seed: `${a}-${b}-cen${s}`, turn: n.turn, hp: n.sides[hs].hp, steady: e.line, sharp: se.line};
        }
      }
      const r = J.reduce(n, a0, seat); if(r.error) continue; n = r.state; moved = true; break;
    }
    if(!moved) break;
  }
}
console.log(hero, "decisions", decisions);
for(const [k, v] of Object.entries(T).sort((x, y) => y[1] - x[1]).slice(0, 12)) console.log(String(v).padStart(5), k.padEnd(36), JSON.stringify(ex[k]));
