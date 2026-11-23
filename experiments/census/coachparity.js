// COACH PARITY (2026-11-23): for each of today's table-AI lines, the trainer Coach's advice
// (engine/advisor.js advise) on the same position, hero at seat 0 (the trainer's `you()`), ctx as
// index.html builds it. Read-only. Prints the Coach line beside what the table's AI (sparring) does.
const SPL=require("/home/user/dawnblade-ai/tools/selfplay.js"); const {J,SP}=SPL;
const A=require("/home/user/dawnblade-ai/engine/advisor.js"); const E=require("/home/user/dawnblade-ai/engine/effects.js");
const clone=x=>JSON.parse(JSON.stringify(x));
function find(hero, hit){ const foes=SPL.W.HEROES.map(h=>h.k).filter(k=>k!==hero);
  for(let gi=0;gi<64;gi++){ let n=SPL.match(hero,foes[gi%foes.length],"cp-"+gi,gi%2);
    for(let i=0;i<3000&&!n.over;i++){ if(hit(n)) return n; let mv=false; for(const s of [0,1]){ const x=SP.act(n,s); if(!x) continue; const o=J.reduce(n,x,s); if(o.error) continue; n=o.state; mv=true; break; } if(!mv) break; } }
  return null; }
const take=(sd,name)=>{ for(const z of ["deck","hand","grave","pitch","banish"]){ const k=(sd[z]||[]).findIndex(c=>c&&c.name===name); if(k>=0) return sd[z].splice(k,1)[0]; } return null; };
const ctxOf=n=>{ const b=J.bOf(n,0); const v=A.advView(n,0); return Object.assign({}, v, {runeDmg:b.runeDmg||1, hpow:b.HPOW, wateryGrave:b.wateryGrave, noOpWhy:E.arsNoOpWhy}); };
const coach=n=>{ const r=A.advise(n, ctxOf(n)); return r.line; };
const ai=n=>{ const e=SP.explain(n,0); return (e&&e.key)+" "+JSON.stringify(e&&e.action); };
const actHit=n=>n.turnPlayer===0&&!n.prompt&&!n.pending&&!n.pend&&!(n.stack||[]).length&&(n.sides[0].ap||0)>=1&&!(n.chain||[]).length;
const out=[];
function hand(n, names){ const sd=n.sides[0]; sd.deck.push(...sd.hand.filter(Boolean)); sd.hand=[]; for(const nm of names){ const c=take(sd,nm); if(c) sd.hand.push(c); } return sd.hand; }

// SPXFLIPCRUSH: Bravo, Macho Grande face-down in arsenal, no hand, {r}{r} floating
{ const n0=find("bravo",n=>actHit(n)&&n.sides[0].arsenal&&!n.sides[0].arsenal._faceUp&&!J.legal(n,{t:"activate",from:"hero",uid:"hpow"},0));
  for(const [lbl,card] of [["no crush (Macho Grande)","Macho Grande"],["crush (Chokeslam)","Chokeslam"]]){
    const n=clone(n0), sd=n.sides[0]; const c=take(sd,card); if(sd.arsenal) sd.deck.push(sd.arsenal); sd.arsenal=Object.assign({},c,{_faceUp:false});
    hand(n,[]); sd.res=2; out.push(["SPXFLIPCRUSH "+lbl, coach(n), ai(n)]); } }
// SPXARSPAY: Bravo arsenal step, hand Macho Grande + Cartilage Crush
{ const n0=find("bravo",n=>n.arsenalFor===0&&!n.sides[0].arsenal); const n=clone(n0); const h=hand(n,["Macho Grande","Cartilage Crush"]);
  out.push(["SPXARSPAY arsenal step [Macho Grande, Cartilage Crush]", coach(n), ai(n)]); }
// SPXCONDGA: Fai behind on life, Scar for a Scar + Art of the Dragon: Fire
{ const n0=find("fai",actHit); const n=clone(n0); hand(n,["Scar for a Scar","Art of the Dragon: Fire"]); const sd=n.sides[0]; if(sd.arsenal){sd.deck.push(sd.arsenal); sd.arsenal=null;} sd.res=8; sd.hp=10; n.sides[1].hp=15;
  out.push(["SPXCONDGA Fai behind on life [Scar for a Scar (gated ga), Art of the Dragon: Fire]", coach(n), ai(n)]); }
// SPXBOOSELF: Lyath ahead on life, Mocking Blow + Full of Bravado
{ const n0=find("lyath",n=>actHit(n)&&!((n.sides[0].hist||{}).booed)); const n=clone(n0); hand(n,["Mocking Blow","Full of Bravado"]); const sd=n.sides[0]; if(sd.arsenal){sd.deck.push(sd.arsenal); sd.arsenal=null;} sd.res=6; sd.hp=18; n.sides[1].hp=10;
  out.push(["SPXBOOSELF Lyath ahead on life [Mocking Blow, Full of Bravado]", coach(n), ai(n)]); }
// SPXCLOAK: Iyslander paying on the opponent's turn with Spellfire Cloak equipped
{ const n0=find("iyslander",n=>n.pending&&n.pending.seat===0&&n.turnPlayer!==0&&(n.sides[0].gear||[]).some(g=>g&&g.name==="Spellfire Cloak"));
  out.push(["SPXCLOAK Iyslander pays off-turn, Cloak equipped", n0?coach(n0):"(no position found)", n0?ai(n0)+" | need "+n0.pending.need+" res "+n0.sides[0].res:""]); }
// SPXSTIRIDLE: Iyslander, opponent's turn, Stir the Aetherwinds in arsenal, a window she holds priority in
{ const n0=find("iyslander",n=>n.turnPlayer!==0&&!n.pend&&!n.prompt&&!n.pending&&n.priority===0&&!(n.stack||[]).some(l=>l&&l.seat===0));
  if(n0){ const n=clone(n0), sd=n.sides[0]; const c=take(sd,"Stir the Aetherwinds"); if(sd.arsenal) sd.deck.push(sd.arsenal); sd.arsenal=c;
    out.push(["SPXSTIRIDLE Iyslander off-turn, Stir in arsenal (window "+A.advView(n,0).window+")", coach(n), ai(n)]); } }
for(const [k,c,a] of out) console.log("## "+k+"\n   COACH: "+c+"\n   AI:    "+a);
