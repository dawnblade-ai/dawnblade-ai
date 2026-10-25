/* Read one game: per Lyath turn, his hand at the start of the action phase, every action, and the feed. */
const R = process.argv[2], HERO = process.argv[3], FOE = process.argv[4], FIRST = +(process.argv[5]||0);
const {match, J, SP} = require(R + "/tools/selfplay.js");
const [k0,k1] = FIRST===0 ? [HERO,FOE] : [FOE,HERO]; const me = FIRST===0?0:1;
let g = match(k0,k1,`${k0}-${k1}-0`,0), steps=0, lastFeed=0, lastTurn=-1;
const nm = (sd,uid)=>{const c=[...sd.hand,...(sd.arsenal?[sd.arsenal]:[]),...sd.gear,...sd.grave,...(sd.banish||[])].find(x=>x&&x.uid===uid); return c?c.name+"/"+c.pitch:String(uid);};
while(!g.over && steps<4000){ let moved=false;
  for(const s of [0,1]){ const a=SP.act(g,s); if(!a) continue;
    if(g.turnPlayer===me && g.turn!==lastTurn && s===me){ lastTurn=g.turn; const sd=g.sides[me];
      console.log(`\n=== T${g.turn} ${HERO} hp ${sd.hp} v ${g.sides[1-me].hp} | res ${sd.res} ap ${sd.ap} | hand: ${sd.hand.map(c=>c.name+"/"+c.pitch+(c.power!=null?" p"+c.power:"")).join(", ")} | ars: ${sd.arsenal?sd.arsenal.name:"-"}`); }
    const o=J.reduce(g,a,s); if(o.error){ continue; }
    if(s===me && a.t!=="pass") console.log(`  [${g.phase}/${g.step}] ${a.t} ${a.uid!=null?nm(g.sides[me],a.uid):""}${a.from?" from "+a.from:""}`);
    g=o.state; steps++; moved=true;
    const f=g.feed||[]; if(g.turnPlayer===me) for(const l of f.slice(lastFeed)) console.log("     · "+l); lastFeed=f.length; break; }
  if(!moved) break; }
console.log("\nRESULT", JSON.stringify(g.over), "turn", g.turn);
