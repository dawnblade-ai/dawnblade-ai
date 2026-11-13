/* lyath2 census3: at own action points where a free Instant is eligible (judge.instantsFirst maxCost 0),
   what does Sharp do, and with what hand. SPXINST=none (rule without the hook).
   node experiments/lyath2/census3.js lyath 0 3 */
const root=__dirname+"/../../";
const {match, W, J, SP} = require(root+"tools/selfplay.js");
const hero=process.argv[2]||"lyath", from=+process.argv[3]||0, to=+process.argv[4]||3;
const keys=W.HEROES.map(h=>h.k).filter(k=>k!==hero);
const find=(S,uid)=>[].concat(S.hand,S.arsenal?[S.arsenal]:[],S.gear||[]).find(x=>x&&x.uid===uid);
const rows=[];
for(let s=from;s<to;s++) for(const o of keys) for(const [a,b] of [[hero,o],[o,hero]]){
  let g=match(a,b,`${a}-${b}-${s}`,s%2); const seat=a===hero?0:1; SP.LA.seats.length=0;
  for(let i=0;i<4000&&!g.over;i++){ let moved=false;
    for(const sd of [0,1]){ let act;
      if(sd===seat){
        const r=SP.explain(g,sd,{search:false}); act=r.action;
        if(act && g.step!=="defend" && !g.prompt && !g.pend && !(g.stack||[]).length){
          const ins=J.instantsFirst(g,sd,{maxCost:0});
          if(ins.length){
            const q=SP.explain(g,sd,{search:true}); const qa=q.action; const S=g.sides[sd];
            const sInst=qa&&qa.t==="play"&&ins.some(x=>x.uid===qa.uid);
            const c=x=>x&&find(S,x.uid);
            rows.push({sInst, same:JSON.stringify(qa)===JSON.stringify(act), turn:g.turn, ap:S.ap, res:S.res, hp:[g.sides[0].hp,g.sides[1].hp],
              hand:S.hand.map(c=>c.name+"/c"+c.cost+"/p"+c.pitch+(+c.power>0?"/"+c.power+"pw":"")),
              ins:ins.map(x=>c(x).name), rule:act.uid==="hpow"?"HERO":(c(act)||{}).name||act.t, rkey:r.key,
              sharp:qa.uid==="hpow"?"HERO":(c(qa)||{}).name||qa.t, skey:q.key, chain:(g.chain||[]).length});
          }
        }
      } else act=SP.act(g,sd,{search:false});
      if(!act) continue; const out=J.reduce(g,act,sd); if(out.error) continue; g=out.state; moved=true; break; }
    if(!moved) break; } }
console.log(JSON.stringify(rows));
