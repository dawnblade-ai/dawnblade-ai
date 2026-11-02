/* LOOKAHEAD phase 1 (a): feasibility. Self-play games with the base policy;
   time J.reduce per step (no invariants), steps per turn, and count the
   distinct legal candidates at each own-turn action decision. */
const {match, J, SP, W} = require("../tools/selfplay.js");
const P = require("../engine/priority.js");
const keys = W.HEROES.map(h => h.k);
let steps = 0, tReduce = 0, tAct = 0, tLegal = 0, nLegal = 0;
const cands = [], turnSteps = [];
function candidates(g, seat){
  const sd = g.sides[seat], out = [];
  const add = a => { const t0 = process.hrtime.bigint(); const ok = J.legal(g, a, seat) == null; tLegal += Number(process.hrtime.bigint() - t0); nLegal++; if(ok) out.push(a); };
  (sd.hand || []).forEach(c => add({t: "play", uid: c.uid, from: "hand"}));
  if(sd.arsenal) add({t: "play", uid: sd.arsenal.uid, from: "arsenal"});
  (sd.gear || []).forEach(c => c && add({t: "activate", uid: c.uid}));
  (sd.board || []).forEach(b => b && add({t: "activate", uid: b.uid}));
  add({t: "activate", from: "hero", uid: "hpow"});
  add({t: "endTurn"});
  const seen = new Set();   /* same name, same zone -> same outcome */
  return out.filter(a => { const c = a.uid && ((sd.hand||[]).concat(sd.arsenal?[sd.arsenal]:[]).find(x => x.uid === a.uid));
    const k = a.t + "|" + (a.from||"") + "|" + (c ? c.name + "/" + c.pitch : a.uid); if(seen.has(k)) return false; seen.add(k); return true; });
}
const GAMES = +(process.argv[2] || 30);
for(let i = 0; i < GAMES; i++){
  const a = keys[i % 15], b = keys[(i * 7 + 3) % 15];
  let g = match(a, b, `probe-${i}`, i % 2), lastTurn = g.turn, ts = 0;
  for(let k = 0; k < 4000 && !g.over; k++){
    let moved = false;
    for(const s of [0, 1]){
      if(P.hasPriority(g, s) && !g.prompt && !J.pendingOf(g) && P.speedAllowed(g, s).indexOf("action") >= 0)
        cands.push(candidates(g, s).length);
      let t0 = process.hrtime.bigint();
      const act = SP.act(g, s); tAct += Number(process.hrtime.bigint() - t0);
      if(!act) continue;
      t0 = process.hrtime.bigint();
      const out = J.reduce(g, act, s); tReduce += Number(process.hrtime.bigint() - t0);
      if(out.error) continue;
      g = out.state; steps++; ts++; moved = true;
      if(g.turn !== lastTurn){ turnSteps.push(ts); ts = 0; lastTurn = g.turn; }
      break;
    }
    if(!moved) break;
  }
}
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const hist = {}; cands.forEach(n => hist[n] = (hist[n]||0) + 1);
console.log(`games ${GAMES} steps ${steps}`);
console.log(`reduce ${(tReduce/steps/1e3).toFixed(1)} us/step · act ${(tAct/steps/1e3).toFixed(1)} us/call · legal ${(tLegal/nLegal/1e3).toFixed(1)} us/call`);
console.log(`steps per player-turn: mean ${avg(turnSteps).toFixed(1)} max ${Math.max(...turnSteps)}`);
console.log(`action decisions ${cands.length}, distinct legal candidates mean ${avg(cands).toFixed(2)}; histogram`, hist);
console.log(`nodes/s (reduce+act per step): ${(1e9*steps/(tReduce+tAct)).toFixed(0)}`);
