/* Lyath (rule policy): block decisions where Steady declines and Sharp blocks. */
const R = "/home/user/dawnblade-ai";
const {match, W, SP, J} = require(R + "/tools/selfplay.js");
const P = require(R + "/engine/priority.js");
const num = (c, f) => (c && +c[f]) || 0;
const hero = process.argv[2] || "lyath";
const HEROES = W.HEROES.map(h => h.k);
const rows = [], why = {}, cardDef = {}, leakHist = {};
let decisions = 0;
for(const o of HEROES.filter(k => k !== hero)) for(const [a, b] of [[hero, o], [o, hero]]) for(let s = 0; s < 3; s++){
  let n = match(a, b, `${a}-${b}-cen${s}`, s % 2); const hs = a === hero ? 0 : 1;
  for(let i = 0; i < 6000 && !n.over; i++){
    let moved = false;
    for(const seat of [0, 1]){
      const a0 = SP.act(n, seat, {search: false}); if(!a0) continue;
      if(seat === hs && P.canDeclareDefenders(n, hs) && n.pend){
        decisions++;
        const sd = n.sides[hs], wall = SP.wallOf(sd), leak = (n.pend.total || 0) - wall;
        if(a0.t !== "defend" && leak > 0){
          const sh = SP.act(n, hs, {search: true});
          if(sh && sh.t === "defend"){
            const c = sd.hand.find(x => x.uid === sh.uid) || (sd.gear || []).find(x => x.uid === sh.uid);
            const isGear = (sd.gear || []).some(x => x.uid === sh.uid);
            const free = J.handFree(sd).length, blocked = (sd.blockH || []).length;
            /* which line of nextBlocker declined */
            const lethal = leak >= sd.hp, spare = free > SP.DEFAULTS.maxPitch + 1;
            const r = isGear ? "gear-below-ironAt" : (!lethal && leak <= SP.DEFAULTS.takeUpTo && !spare) ? "takeUpTo(leak<=3, hand not spare)"
              : (!lethal && blocked >= SP.DEFAULTS.handBlockers) ? "handBlockers cap"
              : (!lethal && leak <= SP.DEFAULTS.takeUpTo) ? "spare card leaves a leak" : "other";
            why[r] = (why[r] || 0) + 1;
            const k = (isGear ? "gear d" : "card d") + (isGear ? "?" : num(c, "def"));
            cardDef[k] = (cardDef[k] || 0) + 1;
            leakHist[leak] = (leakHist[leak] || 0) + 1;
            if(rows.length < 6) rows.push({seed: `${a}-${b}-cen${s}`, turn: n.turn, hp: sd.hp, leak, total: n.pend.total, wall, hand: sd.hand.map(x => x.name + "/d" + num(x, "def") + "/p" + num(x, "pitch")), sharp: c && c.name, why: r});
          }
        }
      }
      const rr = J.reduce(n, a0, seat); if(rr.error) continue; n = rr.state; moved = true; break;
    }
    if(!moved) break;
  }
}
console.log(hero, "block decisions", decisions);
console.log("declining line:", JSON.stringify(why));
console.log("Sharp's card:", JSON.stringify(cardDef));
console.log("leak:", JSON.stringify(leakHist));
rows.forEach(r => console.log(JSON.stringify(r)));
