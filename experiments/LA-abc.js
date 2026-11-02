/* LOOKAHEAD phase (c): own-seat paired A/B against the SHIPPED search.
     node experiments/LA-abc.js <hero> <seedFrom> <seedTo> base|trial
   `base`: the hero's seat runs v5.77's search (action decisions only; blocks
   and arsenal forced off, every other setting at its default — env ignored).
   `trial`: the hero's seat runs the search as configured by the SPXLA_* env.
   Output rows match LA-ab.js (`off` for base, `on` for trial) so LA-pair.js
   pairs them. Extra per-decision-type counts: bS/bO (blocks searched /
   overruled), aS/aO (arsenal). */
const {match, play, W, SP} = require("../tools/selfplay.js");
const [hero, from, to, mode] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] || "trial"];
const keys = W.HEROES.map(h => h.k).filter(k => k !== hero);
if(mode === "base"){ Object.assign(SP.LA, {blocks: 0, arsenal: 0, horizon: "own", mu: 1.5, margin: 0.5, dets: 1, budget: 300}); }
SP.LA.seats.length = 0; SP.LA.seats.push(hero);
function run(s){
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
  const st0 = JSON.parse(JSON.stringify(SP.LA.stats)), t0 = Date.now();
  const r = run(s), st = SP.LA.stats, d = k => (st[k] || 0) - (st0[k] || 0);
  r.sec = (Date.now() - t0) / 1e3; r.searched = d("searched"); r.overruled = d("overruled"); r.over = d("over");
  r.stepsPer = +(d("steps") / Math.max(1, r.searched)).toFixed(1); r.msPer = +(d("ms") / Math.max(1, r.searched)).toFixed(2);
  r.maxSteps = st.maxSteps; r.bS = d("bSearched"); r.bO = d("bOverruled"); r.aS = d("aSearched"); r.aO = d("aOverruled");
  r.hist = Object.fromEntries(Object.entries(st.hist).map(([k, v]) => [k, v - ((st0.hist || {})[k] || 0)]).filter(e => e[1]));
  console.log(JSON.stringify({hero, s, [mode === "base" ? "off" : "on"]: r}));
}
