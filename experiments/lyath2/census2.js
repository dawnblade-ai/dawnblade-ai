/* lyath2 census v2: sub-buckets of rule-vs-Sharp diffs at own action points (v6.24).
   node experiments/lyath2/census2.js <hero> <from> <to>  -> JSON rows on stdout */
const path=__dirname+"/../../";
const {match, W, J, SP} = require(path+"tools/selfplay.js");
const hero = process.argv[2]||"lyath", from=+process.argv[3]||0, to=+process.argv[4]||3;
const keys = W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const find = (S,uid)=>{ const all=[].concat(...["hand","arsenal","gear","board"].map(z=>{const v=S[z]; return Array.isArray(v)?v:v?[v]:[]})).map(e=>e&&e.card?Object.assign({},e.card,{uid:e.uid}):e); return all.find(x=>x&&x.uid===uid); };
const cls = (g,seat,a)=>{
  if(!a) return "none";
  if(a.t==="endTurn"||a.t==="pass") return a.t;
  if(a.t==="activate"&&a.uid==="hpow") return "HERO";
  const c=find(g.sides[seat],a.uid); if(!c) return a.t+"?";
  if(a.t==="activate") return (+c.power>0?"WPN":"ACT");
  return (+c.power>0?"ATK":"non")+(a.from==="arsenal"?"@ars":"");
};
const nm = (g,seat,a)=>{ if(!a) return "none"; if(a.uid==="hpow") return "HERO-ABILITY"; if(a.uid==null) return a.t; const c=find(g.sides[seat],a.uid); return c?c.name+"("+(c.power||"")+"p,"+c.cost+"c,"+(c.pitch||"")+"pi"+(a.t==="activate"?",act":"")+")":a.t; };
const probe = (g,seat,a)=>{ try{ const o=J.reduce(g,a,seat); if(o.error) return {err:String(o.error)}; const s=o.state, S=s.sides[seat], S0=g.sides[seat];
  return {ap:S.ap-S0.ap, res:S.res-S0.res, pay: !!(s.pend||s.pending), handD:S.hand.length-S0.hand.length}; }catch(e){return {err:String(e)}} };
const TY=require(path+"engine/types.js");
const insOf=(g,seat,a)=>{ if(!a||a.uid==null||a.uid==="hpow") return null; const c=find(g.sides[seat],a.uid); return c?!!TY.isInstant(c):null; };
const costOf=(g,seat,a)=>{ if(!a||a.uid==null||a.uid==="hpow") return null; const c=find(g.sides[seat],a.uid); return c?+c.cost:null; };
const rows=[];
for(let s=from;s<to;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g = match(a,b,`${a}-${b}-${s}`, s%2); const seat = a===hero?0:1;
  SP.LA.seats.length=0;
  for(let i=0;i<4000 && !g.over;i++){
    let moved=false;
    for(const sd of [0,1]){
      let act;
      if(sd===seat){
        const r = SP.explain(g,sd,{search:false}); act = r.action;
        if(act && g.step!=="defend" && !g.prompt){
          const q = SP.explain(g,sd,{search:true}); const qa=q.action;
          if(JSON.stringify(qa)!==JSON.stringify(act)){
            const S=g.sides[sd];
            const f={rc:cls(g,sd,act),sc:cls(g,sd,qa),turn:g.turn,seed:`${a}-${b}-${s}`,
              hand:(S.hand||[]).map(c=>c.name+"/c"+c.cost+"/p"+(c.pitch||"")+(+c.power>0?"/"+c.power+"pw":"")),
              ars:S.arsenal&&S.arsenal.name, res:S.res, ap:S.ap, hp:[g.sides[0].hp,g.sides[1].hp], chain:(g.chain||[]).length,
              rIns:insOf(g,sd,act), sIns:insOf(g,sd,qa), sCost:costOf(g,sd,qa), rule:nm(g,sd,act), rkey:r.key, sharp:nm(g,sd,qa), skey:q.key,
              rkap: act.t==="play"?J.keepsActionPoint(g,sd,act.uid,act.from):null,
              skap: qa.t==="play"?J.keepsActionPoint(g,sd,qa.uid,qa.from):null,
              rp:probe(g,sd,act), sp:probe(g,sd,qa)};
            rows.push(f);
          }
        }
      } else act = SP.act(g,sd,{search:false});
      if(!act) continue;
      const out=J.reduce(g,act,sd); if(out.error) continue; g=out.state; moved=true; break;
    }
    if(!moved) break;
  }
}
console.log(JSON.stringify(rows));
