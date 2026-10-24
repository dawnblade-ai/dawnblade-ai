const R = process.argv[2];
const {match, J, SP} = require(R + "/tools/selfplay.js");
let g = match("boltyn", "dorinthea", "boltyn-dorinthea-0", 0), steps = 0;
const census = s => [...s.hand, ...s.deck, ...s.grave, ...s.pitch, ...(s.banish||[]), ...(s.soul||[]), ...(s.arsenal?[s.arsenal]:[]), ...(s.board||[]).map(b=>b.card), ...(s.gear||[])].length;
let base = null, reported = 0;
while(!g.over && steps < 2000){ let moved = false;
  for(const st of [0,1]){ const a = SP.act(g, st); if(!a) continue;
    const before = g.sides[0]; const out = J.reduce(g, a, st); if(out.error) continue;
    const after = out.state.sides[0];
    const lost = (before.soul||[]).filter(c => !(after.soul||[]).some(x => x.uid === c.uid));
    if(lost.length && reported < 3){
      const where = lost.map(c => { const z = ["hand","deck","grave","pitch","banish"].find(k => (after[k]||[]).some(x => x.uid === c.uid)); return `${c.name}#${c.uid}(pitch ${c.pitch}) -> ${z || "NO ZONE"}`; });
      console.log("turn", out.state.turn, "action", JSON.stringify(a), "soul lost:", where.join("; ")); reported++;
      // is a yellow put into the soul this turn, per the printed event, and does legal refuse a soulPitch-gated card?
      const ars = after.arsenal; if(ars) console.log("   arsenal:", ars.name, "legal:", J.legal(out.state, {t:"play", uid: ars.uid, from:"arsenal", target:"hero"}, 0) || "LEGAL");
      const dbb = (after.hand||[]).filter(c => /Duty Bound Blitz/.test(c.name)); dbb.forEach(c => console.log("   hand", c.name, "legal:", J.legal(out.state, {t:"play", uid:c.uid, from:"hand", target:"hero"}, 0) || "LEGAL"));
    }
    g = out.state; steps++; moved = true; }
  if(!moved) break; }
