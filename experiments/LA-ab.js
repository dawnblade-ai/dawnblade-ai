/* LOOKAHEAD phase 1 (c): own-seat paired A/B.
     node experiments/LA-ab.js <hero> <seedFrom> <seedTo> [on|off|both]
   For each seed index s, the hero meets all 14 others in both seat orders
   (tourney.js's seeds `${a}-${b}-${s}`, first = s % 2), with the search OFF
   and then ON for the hero's seat only. Prints one JSON line per seed:
   wins of 28 off/on, plus refusals, violations, stalls and search stats. */
const {match, play, W, SP} = require("../tools/selfplay.js");
const [hero, from, to, mode] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] || "both"];
const keys = W.HEROES.map(h => h.k).filter(k => k !== hero);
function run(on, s){
  SP.LA.seats.length = 0; if(on) SP.LA.seats.push(hero);
  let w = 0, ref = 0, viol = 0, stall = 0, draw = 0;
  for(const o of keys) for(const [a, b] of [[hero, o], [o, hero]]){
    const r = play(match(a, b, `${a}-${b}-${s}`, s % 2));
    ref += r.errs.length; viol += r.viols.length;
    if(!r.game.over) stall++;
    else if(r.game.over.winner == null) draw++;
    else if((r.game.over.winner === 0) === (a === hero)) w++;
  }
  return {w, ref, viol, stall, draw};
}
for(let s = from; s < to; s++){
  const row = {hero, s};
  if(mode !== "on") row.off = run(false, s);
  if(mode !== "off"){ const st0 = {...SP.LA.stats}; const t0 = Date.now(); row.on = run(true, s); row.on.sec = (Date.now() - t0) / 1e3;
    row.on.searched = SP.LA.stats.searched - st0.searched; row.on.overruled = SP.LA.stats.overruled - st0.overruled;
    row.on.stepsPer = +((SP.LA.stats.steps - st0.steps) / Math.max(1, SP.LA.stats.searched - st0.searched)).toFixed(1);
    row.on.msPer = +((SP.LA.stats.ms - st0.ms) / Math.max(1, SP.LA.stats.searched - st0.searched)).toFixed(2);
    row.on.maxSteps = SP.LA.stats.maxSteps; }
  console.log(JSON.stringify(row));
}
