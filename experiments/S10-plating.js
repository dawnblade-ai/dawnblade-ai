/* Repro: the OPPONENT's 6-power attack makes Kayo's Predatory Plating ability legal. */
const root = process.argv[2];
const {match, J, SP} = require(root + "/tools/selfplay.js");
let g = match("kayo", "dorinthea", 7, 1);           // seat 1 goes first
const pl = g.sides[0].gear.find(x => x.name === "Predatory Plating");
console.log("plating", !!pl, "kayo gear:", g.sides[0].gear.map(x=>x.name).join(", "));
/* hand seat 1 a 6-power, 0-cost vanilla attack and nothing else of size */
const big = {uid: 9001, name: "Probe Haymaker", tt: "Generic Action - Attack", ty: ["Generic","Action","Attack"],
  kw: [], tx: "", power: 6, def: 2, cost: 0, pitch: 1};
g = {...g, sides: g.sides.map((s,i) => i===1 ? {...s, hand: [big, ...s.hand]} : s)};
const st = g => `${g.phase}/${g.step} pri=${g.priority} tp=${g.turnPlayer} pend=${g.pend?g.pend.card.name+"("+(g.pend.by)+")":"-"}`;
const tryAb = g => { const a1 = {t:"activate", uid: pl.uid}, a2 = {t:"activate", uid: "gp"+pl.uid};
  return ["bare","gp"].map((k,i)=>k+":"+(J.legal(g, i?a2:a1, 0) || "LEGAL")).join(" | "); };
console.log("before play:", st(g), tryAb(g));
let r = J.reduce(g, {t:"play", uid: 9001, from:"hand", target:"hero"}, 1);
if(r.error){ console.log("play refused", r.error); process.exit(); }
g = r.state;
for(let i = 0; i < 14 && !g.over; i++){
  console.log(st(g), "|", tryAb(g), "| defend:", J.legal(g, {t:"defend", uid: pl.uid}, 0) || "LEGAL");
  if(g.prompt){ const a = J.autoAnswer(g); g = J.reduce(g, a, g.prompt.side||0).state; continue; }
  if(g.priority == null) break;
  const out = J.reduce(g, {t:"pass"}, g.priority); if(out.error){ console.log("pass err", out.error); break; } g = out.state;
  if(!g.pend) { console.log("chain over:", st(g)); break; }
}
