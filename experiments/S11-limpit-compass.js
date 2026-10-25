const root = process.argv[2];
const {match, J} = require(root + "/tools/selfplay.js");
for(const keepCompass of [true, false]){
  let g = match("gravy", "dorinthea", 3, 0);
  const sd = g.sides[0];
  console.log("gear:", sd.gear.map(x=>x.name).join(", "));
  const lim = [...sd.deck, ...sd.hand].find(c => /limpit/i.test(c.name));
  if(!lim){ console.log("no Limpit"); process.exit(); }
  const gear = keepCompass ? sd.gear : sd.gear.filter(x => !/Compass/.test(x.name));
  g = {...g, sides: g.sides.map((s,i)=> i ? s : {...s, gear,
       deck: s.deck.filter(c=>c.uid!==lim.uid), hand: s.hand.filter(c=>c.uid!==lim.uid),
       grave: [{...lim, _gy: 0}, ...s.grave], res: 5, hist: {...s.hist, blueGY: 1}})};
  const before = g.sides[0].ap;
  let r = J.reduce(g, {t:"play", uid: lim.uid, from:"grave"}, 0);
  if(r.error){ console.log("refused:", r.error); continue; }
  g = r.state;
  for(let i=0;i<6 && (g.stack||[]).some(l=>l.k==="play");i++){ const o=J.reduce(g,{t:"pass"},g.priority); if(o.error) break; g=o.state; }
  console.log(`compass ${keepCompass}: ap ${before} -> ${g.sides[0].ap}; feed tail:`, (g.feed||[]).slice(-4).join(" | "));
}
