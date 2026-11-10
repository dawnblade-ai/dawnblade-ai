/* Sharp vs Steady on permanents: at each hero decision where Steady plays an Ally/Aura/Item card
   from hand or arsenal, does Sharp too? Probe only (reads type text; the policy never does). */
const R = "/home/user/dawnblade-ai";
const {match, W, SP, J} = require(R + "/tools/selfplay.js");
const HEROES = W.HEROES.map(h => h.k);
const kind = c => { const t = (c && (c.tt || "")) + " " + ((c && c.ty) || []).join(" "); return /\bAlly\b/.test(t) ? "ally" : /\bAura\b/.test(t) ? "aura" : /\bItem\b/.test(t) ? "item" : null; };
for(const hero of process.argv[2].split(",")){
  const st = {steadyPerm: 0, sharpSame: 0, sharpEnd: 0, sharpOther: 0, byKind: {}};
  for(const o of HEROES.filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]) for(let s = 0; s < 3; s++){
    let n = match(a, b, `${a}-${b}-cen${s}`, s % 2); const hs = a === hero ? 0 : 1;
    for(let i = 0; i < 6000 && !n.over; i++){
      let moved = false;
      for(const seat of [0, 1]){
        const a0 = SP.act(n, seat, {search: seat === hs}); if(!a0) continue;
        if(seat === hs){
          const st0 = SP.act(n, hs, {search: false}), me = n.sides[hs];
          const c = st0 && st0.t === "play" && (me.hand.concat(me.arsenal ? [me.arsenal] : [])).find(x => x && x.uid === st0.uid);
          const k = c && kind(c);
          if(k){ st.steadyPerm++; const bk = st.byKind[k] = st.byKind[k] || {n: 0, end: 0};
            bk.n++;
            if(a0.t === "play" && a0.uid === st0.uid) st.sharpSame++;
            else if(a0.t === "endTurn"){ st.sharpEnd++; bk.end++; }
            else st.sharpOther++; }
        }
        const r = J.reduce(n, a0, seat); if(r.error) continue; n = r.state; moved = true; break;
      }
      if(!moved) break;
    }
  }
  console.log(JSON.stringify({hero, ...st}));
}
