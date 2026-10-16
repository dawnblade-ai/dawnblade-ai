// Records one self-play game for the Stage prototype. Reads state only.
const R=require("path").resolve(__dirname,"../..")+"/";
const SP=require(R+"tools/selfplay.js"), C8=require(R+"tools/cup8.js"), INV=require(R+"engine/invariants.js");
let audited=0, errs=0, warns=0;
const [A,B,SEED,FIRST,OUT]=process.argv.slice(2);
let n=SP.match(A,B,SEED,+FIRST);
const IMG="https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/";
const cards={};
const reg=c=>{ if(!c||!c.name) return null; if(!cards[c.name]) cards[c.name]={img:c.img||c.dbImg||null,pitch:c.pitch,power:c.power,def:c.def,cost:c.cost,tt:c.tt}; return c.name; };
const heroes=[0,1].map(i=>{const h=n.builds[i].HZOOM||{};return {name:n.sides[i].name, hero:h.name, img:h.img?(/^https?:/.test(h.img)?h.img:IMG+h.img):null, tt:h.tt||null, hp:n.sides[i].hp, int:n.sides[i].int};});
const side=sd=>({hp:sd.hp,res:sd.res||0,ap:sd.ap||0,hand:(sd.hand||[]).map(reg),deck:sd.deck.length,
  ars:sd.arsenal?{n:reg(sd.arsenal),up:!!sd.arsenal._faceUp}:null,
  pitch:(sd.pitch||[]).map(reg), grave:sd.grave.length, board:(sd.board||[]).map(b=>reg(b.card)),
  gear:(sd.gear||[]).filter(g=>!g.destroyed).map(reg), marked:!!sd.marked, ward:sd.ward||0,
  blockH:(sd.blockH||[]).slice(), blockG:(sd.blockG||[]).slice()});
const uidName=(g,u)=>{for(const sd of g.sides){for(const z of ["hand","gear"]){for(const c of (sd[z]||[])) if(c.uid===u) return reg(c);} for(const b of (sd.board||[])) if(b.uid===u) return reg(b.card);} return null;};
// THE PROJECTION: "if both seats pass now" — the real reducer on a copy, never the live state
function project(g){
  if(!g.pend||g.pend.dealt!=null||!["attack","defend","reaction"].includes(g.step)) return null;
  let h=g;
  for(let k=0;k<10;k++){
    if(h.prompt||h.pending) return {q:true};
    const s=h.priority; if(s==null) break;
    const r=SP.J.reduce(h,{t:"pass"},s); if(r.error) return null; h=r.state;
    if(h.pend&&h.pend.dealt!=null) return {atk:h.pend._struck!=null?h.pend._struck:h.pend.total,wall:h.pend.wall,dealt:h.pend.dealt};
    if((h.chain||[]).length>(g.chain||[]).length){const e=h.chain[h.chain.length-1]; return {dealt:e.dmg,atk:null,wall:null};}
  }
  return null;
}
const rows=[]; let prevC=null; const said=new Set(); const names=heroes.map(h=>h.name);
for(let i=0;i<6000&&!n.over;i++){ let moved=false;
  for(const s of [0,1]){ const a=SP.SP.act(n,s); if(!a) continue;
    const before=n; const out=SP.J.reduce(n,a,s); if(out.error) continue; n=out.state; moved=true;
    const lines=(n.feed||[]).slice((before.feed||[]).length);
    { const all=INV.check(n); audited++; errs+=all.filter(v=>v.severity==="error").length; warns+=all.filter(v=>v.severity!=="error").length; }
    const actCard=a.uid!=null?(uidName(before,a.uid)||(()=>{for(const sd of before.sides) if(sd.arsenal&&sd.arsenal.uid===a.uid) return reg(sd.arsenal); return null;})()):null;
    const P=n.pend;
    const pend=P?{card:reg(P.card),by:P.by,total:P.total,struck:P._struck!=null?P._struck:null,from:P.from,target:P.target&&P.target.kind,dealt:P.dealt,wall:P.wall,
      wallH:(n.sides[1-P.by].blockH||[]).map(u=>uidName(n,u)),wallG:(n.sides[1-P.by].blockG||[]).map(u=>uidName(n,u)),
      rx:(n.stack||[]).filter(l=>l&&l.k==="rx").length, proj:project(n)}:null;
    const row={i:rows.length,turn:n.turn,seat:s,act:a.t,card:actCard,phase:n.phase,step:n.step,tp:n.turnPlayer,pri:n.priority,
      sides:[side(n.sides[0]),side(n.sides[1])],pend,chain:(n.chain||[]).map(e=>({n:e.n,dmg:e.dmg,ga:!!e.ga,kind:e.kind})),
      stack:(n.stack||[]).map(l=>l&&(l.label||l.name||(l.card&&l.card.name)||l.k)),lines,over:n.over||null};
    const crow={i:row.i,turn:row.turn,seat:s,act:a.t,step:row.step,hp:[row.sides[0].hp,row.sides[1].hp],hand:[row.sides[0].hand.length,row.sides[1].hand.length],deck:[row.sides[0].deck,row.sides[1].deck],lines,routes:[]};
    row.tally=C8.tally(crow,prevC,names); row.ledger=C8.ledger(crow,prevC,names,row.chain.length,said);
    prevC=crow; rows.push(row); break; }
  if(!moved) break; }
// keep every row that printed something, moved life, or moved the wall; passes with nothing are the "never staged" set
const keep=rows.filter((r,i)=>{const p=rows[i-1]; if(!p) return true; return r.lines.length||r.act==="defend"||p.sides[0].hp!==r.sides[0].hp||p.sides[1].hp!==r.sides[1].hp||!!r.over;});
const passes=rows.filter(r=>r.act==="pass").length;
const outp={match:{a:A,b:B,seed:SEED,first:+FIRST,winner:n.over&&n.over.winner,how:n.over&&n.over.how,turns:n.turn,actions:rows.length,passes,audited,errs,warns},heroes,cards,rows:keep};
require("fs").writeFileSync(OUT,JSON.stringify(outp));
console.log("actions",rows.length,"passes",passes,"kept",keep.length,"cards",Object.keys(cards).length,"over",JSON.stringify(n.over),"bytes",JSON.stringify(outp).length);
const pr=keep.filter(r=>r.pend&&r.pend.proj); console.log("rows with projection",pr.length, JSON.stringify(pr.slice(0,3).map(r=>[r.turn,r.act,r.pend.card,r.pend.total,r.pend.proj])));
