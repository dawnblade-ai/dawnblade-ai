// For each hero card with a DECIDABLE gated op other than self/ga: at every play of it by the hero
// (own or opponent's turn), is the gate true at that moment (effects.gatesMetNow)? Plus the held-
// card view: own-turn decisions where the card is held, gate true NOW, and it is not the play.
const {match, W, J, SP} = require("/home/user/dawnblade-ai/tools/selfplay.js");
const PR=require("/home/user/dawnblade-ai/engine/parser.js");
const seeds=+process.argv[2]||1, heroes=(process.argv[3]||"").split(",").filter(Boolean);
const R={};
for(const hero of (heroes.length?heroes:W.HEROES.map(h=>h.k))){ const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
  for(let s=0;s<seeds;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
    let g=match(a,b,`gt-${a}-${b}-${s}`,s%2); const seat=a===hero?0:1;
    for(let i=0;i<4000&&!g.over;i++){ let mv=false;
      for(const sd of [0,1]){ const x=SP.act(g,sd); if(!x) continue;
        if(sd===seat&&x.t==="play"&&(x.from==="hand"||x.from==="arsenal")){ const S=g.sides[seat]; const c=(x.from==="arsenal"?[S.arsenal]:S.hand).find(c=>c&&c.uid===x.uid);
          if(c){ const conds=(PR.fxParse(c).conds||[]).filter(e=>e&&e.op&&!["self","ga"].includes(e.op[0]));
            if(conds.length){ const met=J.effectsFor(g).fx.gatesMetNow(g,seat,c,x.from);
              for(const e of conds){ const k=hero+" | "+c.name+" | "+e.op[0]+"@"+e.cond; const r=R[k]||(R[k]={plays:0,met:0,own:0,opp:0}); r.plays++; g.turnPlayer===seat?r.own++:r.opp++; if(met.some(m=>m[0]===e.cond&&m[1]===e.op[0])) r.met++; } } } }
        const rr=J.reduce(g,x,sd); if(rr.error) continue; g=rr.state; mv=true; break; }
      if(!mv) break; } } }
for(const [k,r] of Object.entries(R).sort((a,b)=>b[1].plays-a[1].plays)) console.log(k.padEnd(62), "plays",r.plays,"(own",r.own,"opp",r.opp+")","gate true at play",r.met);
