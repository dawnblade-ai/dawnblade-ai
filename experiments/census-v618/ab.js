/* own-seat A/B: node ab.js <hero> <seed> <rule|sharp>; set SPXOBPRICE in env */
const {match, play, W, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const [hero, s, mode] = [process.argv[2], +process.argv[3], process.argv[4]];
SP.LA.seats.length = 0; if(mode === "sharp") SP.LA.seats.push(hero);
let w = 0, ref = 0, viol = 0, stall = 0, draw = 0;
for(const o of W.HEROES.map(h => h.k).filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]){
  const r = play(match(a, b, `${a}-${b}-${s}`, s % 2));
  ref += r.errs.length; viol += r.viols.length;
  if(!r.game.over) stall++; else if(r.game.over.winner == null) draw++; else if((r.game.over.winner === 0) === (a === hero)) w++;
}
console.log(JSON.stringify({hero, s, mode, gate: process.env[process.env.GATE] || "(on)", w, ref, viol, stall, draw}));
