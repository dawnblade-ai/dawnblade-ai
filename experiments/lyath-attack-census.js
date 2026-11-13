const path=__dirname+"/../";
const {match, W, J, SP} = require(path+"tools/selfplay.js");
const hero = process.argv[2]||"lyath", from=+process.argv[3]||0, to=+process.argv[4]||3;
const keys = W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const buckets = {}, ex = {}, cardPairs = {}; let pts=0, diffs=0;
const find = (S,uid)=>{ const all=[].concat(...["hand","arsenal","gear","board"].map(z=>{const v=S[z]; return Array.isArray(v)?v:v?[v]:[]})).map(e=>e&&e.card?Object.assign({},e.card,{uid:e.uid}):e); return all.find(x=>x&&x.uid===uid); };
const D = (g,seat,a)=>{
  if(!a) return "none";
  if(a.t==="endTurn"||a.t==="pass") return a.t;
  const S=g.sides[seat]; const c=find(S,a.uid); if(!c) return a.t+"?";
  const kap = a.t==="play" ? J.keepsActionPoint(g,seat,a.uid,a.from) : false;
  const atk = +c.power>0;
  const where = a.from||"";
  return `${a.t==="activate"?"act":"play"}:${atk?"ATK":"non"}${kap?"+GA":""}${where==="arsenal"?"@ars":""}`;
};
const nm = (g,seat,a)=>{ if(!a||a.uid==null) return a?a.t:"none"; const c=find(g.sides[seat],a.uid); return c?c.name+"("+(c.power||"")+"p,"+c.cost+"c)":a.t; };
for(let s=from;s<to;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g = match(a,b,`${a}-${b}-${s}`, s%2); const seat = a===hero?0:1;
  SP.LA.seats.length=0;
  for(let i=0;i<4000 && !g.over;i++){
    let moved=false;
    for(const sd of [0,1]){
      let act;
      if(sd===seat){
        const r = SP.explain(g,sd,{search:false});
        act = r.action;
        if(act && g.step!=="defend" && !g.prompt){
          pts++;
          const q = SP.explain(g,sd,{search:true});
          const qa=q.action;
          if(JSON.stringify(qa)!==JSON.stringify(act)){
            diffs++;
            const k = D(g,sd,act)+" => "+D(g,sd,qa);
            buckets[k]=(buckets[k]||0)+1;
            const cp = nm(g,sd,act)+" => "+nm(g,sd,qa); cardPairs[cp]=(cardPairs[cp]||0)+1; if(k==="play:ATK => play:ATK"){ const rc=find(g.sides[sd],act.uid), sc=find(g.sides[sd],qa.uid); const kk="cost "+rc.cost+"->"+sc.cost+" pow "+rc.power+"->"+sc.power+" res "+g.sides[sd].res+" "+q.key; cardPairs["@@"+kk]=(cardPairs["@@"+kk]||0)+1; }
            if(!ex[k]||Math.random()<0.03){ const S=g.sides[sd];
              ex[k]={turn:g.turn, step:g.step, hp:[g.sides[0].hp,g.sides[1].hp],
                hand:(S.hand||[]).map(c=>c.name+"/p"+(c.pitch||"")+"/c"+c.cost+"/"+(c.power||"")), arsenal:S.arsenal&&S.arsenal.name, board:(S.board||[]).map(b=>b.card&&b.card.name),
                keys:Object.keys(S).filter(k=>/res|^ap$|pool/i.test(k)).map(k=>k+"="+JSON.stringify(S[k])).join(" "),
                rule:nm(g,sd,act)+"["+r.key+"]", sharp:nm(g,sd,qa)+"["+q.key+"]", seed:`${a}-${b}-${s}`};}
          }
        }
      } else act = SP.act(g,sd,{search:false});
      if(!act) continue;
      const out=J.reduce(g,act,sd); if(out.error) continue; g=out.state; moved=true; break;
    }
    if(!moved) break;
  }
}
const rows=Object.entries(buckets).sort((x,y)=>y[1]-x[1]);
const cps=Object.entries(cardPairs).sort((x,y)=>y[1]-x[1]).slice(0,80);
console.log(JSON.stringify({hero,pts,diffs,rows:rows.slice(0,80),cps,ex:Object.fromEntries(rows.slice(0,8).map(r=>[r[0],ex[r[0]]]))}));
