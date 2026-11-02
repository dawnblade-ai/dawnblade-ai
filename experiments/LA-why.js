/* node experiments/LA-why.js <hero> [seed] — when the search overrules the rules, what did the rules
   want (base key) and what did the search pick (its key, action type, the card's name)? */
const {match, W, J, SP} = require("../tools/selfplay.js");
const hero = process.argv[2], s = +(process.argv[3] || 0);
SP.LA.seats.push(hero);
const tally = {};
for(const o of W.HEROES.map(h => h.k).filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]){
  let g = match(a, b, `${a}-${b}-${s}`, s % 2); const me = a === hero ? 0 : 1;
  for(let i = 0; i < 4000 && !g.over; i++){
    let moved = false;
    for(const st of [0, 1]){
      const x = st === me ? SP.explain(g, st) : {action: SP.act(g, st)};
      if(!x.action) continue;
      if(st === me && /^la[A-Z]/.test(x.key || "")){
        SP.LA.seats.length = 0; const base = SP.explain(g, st); SP.LA.seats.push(hero);
        const nm = a => { const sd = g.sides[st]; const c = [...(sd.hand||[]), sd.arsenal, ...(sd.gear||[]), ...(sd.board||[]).map(e => e && e.card && {...e.card, uid: e.uid})].find(c => c && c.uid === a.uid); return a.t + ":" + (c ? c.name : a.uid || ""); };
        const k = `${base.key} ${nm(base.action)}  ->  ${x.key} ${nm(x.action)}`;
        tally[k] = (tally[k] || 0) + 1;
      }
      const out = J.reduce(g, x.action, st); if(out.error) continue;
      g = out.state; moved = true; break;
    }
    if(!moved) break;
  }
}
Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(String(v).padStart(4), k));
