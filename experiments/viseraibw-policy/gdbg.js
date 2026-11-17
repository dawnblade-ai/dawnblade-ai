const R="/home/user/dawnblade-ai/";
const {match,W,J}=require(R+"tools/selfplay.js"); const SP=require(R+"engine/sparring.js");const BD=require(R+"engine/build.js");const PR=require(R+"engine/parser.js");
const all=W.HEROES.map(h=>h.k).filter(k=>k!=="viseraibw").slice(0,6);let shown=0;const T={};
for(const f of all) for(const vs of [0,1]){let g=match(vs?f:"viseraibw",vs?"viseraibw":f,`v-${f}-0-${vs}`,0);
 for(let i=0;i<4000&&!g.over;i++){let moved=false;for(const seat of [0,1]){
  const sd=g.sides[seat];const gate=seat===vs&&(sd.board||[]).find(b=>b&&/Gate to/.test((b.card||{}).name||""));
  if(gate&&g.turnPlayer===seat&&sd.ap>=1&&shown<400){shown++;
    const lg=J.legal(g,{t:"activate",uid:gate.uid},seat);const u=J.arenaUseful(g,seat,{kinds:["banPlay"]});
    if(!lg){const ban=(sd.banish||[]).map(c=>c.name+"/"+c.cost+(J.legal(g,{t:"play",uid:c.uid,from:"banish"},seat)?"":"*")).join(",");const pit=(sd.hand||[]).map(c=>c.name+"/p"+c.pitch).join(",");const k2="BAN["+ban+"] HAND["+pit+"] res="+sd.res;T[k2]=(T[k2]||0)+1; if(!global.DONE){global.DONE=1; console.log("U:",JSON.stringify(J.arenaUseful(g,seat,{kinds:["banPlay"]})), "boardAtk",!!J.boardAttackOf(g,seat,gate.uid), "pow",!!BD.boardPow(gate), JSON.stringify(PR.fxParse(BD.boardPow(gate)).ops).slice(0,80)); let r=J.reduce(g,{t:"activate",uid:gate.uid},seat);let st=r.state;console.log("err",r.error,"pend",JSON.stringify(st.pending&&{k:st.pending.kind,u:st.pending.uids}),"prompt",!!st.prompt,"stack",(st.stack||[]).length,"prio",st.priority,"res",st.sides[seat].res);for(let j=0;j<8;j++){const pp=st.pending;let a=pp&&pp.kind==="abtarget"?{t:"abtarget",uid:J.abTargetAnswer(st)}:pp?null:(st.stack||[]).length?{t:"pass"}:null; if(!a){console.log("stop pend",pp&&pp.kind,"prompt",st.prompt&&st.prompt.kind);break;} r=J.reduce(st,a,a.t==="pass"?st.priority:seat); console.log(JSON.stringify(a),r.error); if(r.error)break; st=r.state;} console.log("after:",(st.sides[seat].banish||[]).map(c=>c.name+":"+J.legal(st,{t:"play",uid:c.uid,from:"banish"},seat)).join(" | "));}}
    const k=(lg?"refused:"+String(lg).slice(0,60):"legal")+" | "+(u?"useful":"no")+" | ban="+(sd.banish||[]).length+" res="+sd.res+" hand="+(sd.hand||[]).length;T[k]=(T[k]||0)+1;}
  const a=SP.act(g,seat,{search:true});if(!a)continue;
  const out=J.reduce(g,a,seat);if(out.error)continue;g=out.state;moved=true;}if(!moved)break;}}
console.log(Object.entries(T).sort((a,b)=>b[1]-a[1]).filter(e=>e[0].startsWith("BAN")).slice(0,12));
