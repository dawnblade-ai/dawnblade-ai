/* ============================================================
   Dawnblade engine — advisor.js (Phase 1 extraction)
   "Claude's call" — pure move evaluation, extracted verbatim
   from index.html. No DOM, no React: state in, coaching out.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"));
  else root.DawnAdvisor = factory(root.DawnParser);
})(typeof self!=="undefined" ? self : this, function(P){

const {fxParse, effCost, isAttack, isArrow, isWeapon, isAR, isInstantT, hasKw} = P;

function advPitchPotential(hand, excl){ return hand.reduce((a,c,i)=> i===excl ? a : a+(c.pitch||0), 0); }
function advCardOut(c, g, ctx){
  const fx = fxParse(c);
  let dmg = 0;
  if(isAttack(c)){
    dmg = (c.power||0) + (fx.self||0) + g.buffNext + g.rune*ctx.runeDmg;
    fx.conds.forEach(cd=>{ if(cd.op[0]==="self" && ((cd.cond==="atk"&&g.hist.atk>0)||(cd.cond==="non"&&g.hist.non>0))) dmg += cd.op[1]; });
    if((ctx.dBlk||0)>0 && dmg>=4) dmg = Math.max(0, dmg-(ctx.dDef||1));
  }
  fx.ops.concat(isAttack(c)?fx.onHit:[]).forEach(op=>{ if(op[0]==="arcane") dmg += op[1] + g.amp; });
  return dmg;
}
function advValue(c, g, ctx){
  const fx = fxParse(c);
  let v = advCardOut(c,g,ctx);
  fx.ops.concat(isAttack(c)?fx.onHit:[]).forEach(op=>{
    if(op[0]==="draw") v += 1.6*op[1];
    else if(op[0]==="res") v += op[1];
    else if(op[0]==="rune") v += ctx.runeDmg*op[1]*0.9;
    else if(op[0]==="buffNext") v += op[1]*0.6;
    else if(op[0]==="life") v += op[1]*0.4;
    else if(op[0]==="ward") v += op[1]*0.4;
    else if(op[0]==="awd") v += op[1]*0.1;
    else if(op[0]==="amp") v += op[1]*0.7;
    else if(op[0]==="rot") v += 2;
  });
  if(fx.perm==="ally") v += (c.power||0)*1.5;
  if(hasKw(c,"boost") && ctx.boostOn!==false) v += 0.8;
  return v - effCost(c,g)*0.15;
}
function advBestPitch(hand, need, exclIdx, valueOf){
  if(need<=0) return {idxs:[],gain:0,waste:0,loss:0};
  const n = hand.length; let best=null;
  for(let m=1;m<(1<<n);m++){
    if(exclIdx!=null && (m>>exclIdx&1)) continue;
    let gain=0, loss=0, idxs=[];
    for(let i=0;i<n;i++) if(m>>i&1){ gain+=hand[i].pitch||0; loss+=valueOf(hand[i]); idxs.push(i); }
    if(gain<need) continue;
    const waste = gain-need;
    if(!best || waste<best.waste || (waste===best.waste && loss<best.loss) || (waste===best.waste && loss===best.loss && idxs.length<best.idxs.length))
      best = {idxs,gain,waste,loss};
  }
  return best;
}
function advise(g, ctx){
  const V = c => advValue(c,g,ctx);
  const PV = c => (isAttack(c)&&isArrow(c)) ? V(c)*0.3 : V(c);
  const nm = c => c.name;
  if(g.mode==="pay" && g.pending){
    const need = effCost(g.pending.card,g)-g.res;
    const set = advBestPitch(g.hand, need, g.pending.from==="hand"?g.pending.idx:null, PV);
    if(!set) return {line:"Cancel — you can't cover this cost.", why:"Not enough pitch in hand. Pick a cheaper line."};
    const names = set.idxs.map(i=>nm(g.hand[i])).join(" + ");
    return {line:`Pitch ${names} — exactly ${set.gain}${set.waste?` (${set.waste} floats: spend it before end of turn)`:""}.`,
            why:"Fodder first — feed the fire with the cards you'd least like to swing."};
  }
  if(g.mode==="stack"){
    const rx = g.hand.map(c=>({c,fx:fxParse(c)})).filter(x=>(isAR(x.c)||(isInstantT(x.c)&&x.fx.ops.length>0)) && (x.c.cost||0)<=g.res)
      .map(x=>({...x,p:(x.fx.self||0)+x.fx.ops.filter(o=>o[0]==="buffNext").reduce((a,o)=>a+o[1],0)}))
      .sort((a,b)=>b.p-a.p)[0];
    if(rx && rx.p>0) return {line:`React with ${rx.c.name} (+${rx.p}), then pass.`, why:"Reactions land before the iron — every point punches through."};
    return {line:"Pass — let it resolve.", why:"No profitable reaction in hand; keep your cards for the swing back."};
  }
  if(g.mode==="arsenal"){
    const arrows = g.hand.map((c,i)=>({c,i})).filter(x=>isAttack(x.c)&&isArrow(x.c));
    if(arrows.length){ const b=arrows.sort((a,z)=>V(z.c)-V(a.c))[0]; return {line:`Arsenal ${nm(b.c)} — arrows only fire from there.`, why:"Ranger law: the arsenal is your bowstring."}; }
    if(!g.hand.length) return {line:"Skip — nothing to stash.", why:""};
    const b = g.hand.map((c,i)=>({c,i})).sort((a,z)=>V(z.c)-V(a.c))[0];
    return {line:`Arsenal ${nm(b.c)} — it swings again tomorrow.`, why:"Bank your best card; you'll draw back to full anyway."};
  }
  if(g.mode==="block"){
    const inc = g.incoming, hp = g.myHP;
    const atkEsts = g.hand.filter(isAttack).map(c=>advCardOut(c,g,ctx)).sort((a,b)=>b-a);
    const est = Math.max(3, ((atkEsts[0]||0)+(atkEsts[1]||0)) / (atkEsts.length>1?1.4:1));
    const myTTK = Math.max(1, Math.ceil(g.dHP/Math.max(3,est)));
    const dTTK = Math.max(1, Math.ceil(hp/4.2));
    const target = hp<=8 ? 0 : hp<=14 ? 1 : 2;
    const cards = g.hand.map((c,i)=>({t:"h",i,d:c.def||0,v:V(c),n:nm(c)})).filter(x=>x.d>0).sort((a,b)=>(a.v-b.v)||(b.d-a.d));
    const gearB = g.gear.map((c,i)=>({t:"g",i,d:c.def||0,used:c.used,n:nm(c)})).filter(x=>x.d>0&&!x.used);
    const pool = hp<=14 ? gearB.concat(cards) : cards.concat(gearB);
    let sum=0, picks=[];
    for(const p of pool){ if(inc-sum<=target) break; picks.push(p); sum+=p.d; }
    if(inc-sum>target && sum===0) picks=[], sum=0;
    if(!picks.length) return {line:`Take the ${inc} on the chin.`, why:`Race math: you fell the dummy in ~${myTTK} turns; it needs ~${dTTK} to fell you. Cards hit harder than they block.`};
    return {line:`Block with ${picks.map(p=>p.n).join(" + ")} (${sum}) — take ${Math.max(0,inc-sum)}.`,
            why: hp<=8 ? "You're deep in the red — armor up, survive the round." : `Race math: ~${myTTK} turns to kill, ~${dTTK} to die. Shed the cheap defense, keep the damage.`};
  }
  // act mode
  if(g.ap<1) return {line:"End turn — action point spent.", why:"Set your arsenal on the way out and draw back up."};
  const cands=[];
  g.hand.forEach((c,i)=>{
    const fx=fxParse(c); const atk=isAttack(c);
    if(atk&&isArrow(c)) return;
    if(!atk&&!fx.playable) return;
    if(effCost(c,g) > g.res + advPitchPotential(g.hand,i)) return;
    cands.push({c,from:"hand",idx:i,excl:i});
  });
  if(g.arsenal && (isAttack(g.arsenal)||fxParse(g.arsenal).playable) && (g.arsenal.cost||0)<=g.res+advPitchPotential(g.hand,null))
    cands.push({c:g.arsenal,from:"arsenal",idx:0,excl:null});
  g.gear.forEach((w,i)=>{ if(isWeapon(w)&&!g.weaponUsed[w.uid]&&(w.cost||0)<=g.res+advPitchPotential(g.hand,null)) cands.push({c:w,from:"weapon",idx:i,excl:null}); });
  if(ctx.hpow && !g.weaponUsed["hpow"] && (ctx.hpow.cost||0)<=g.res+advPitchPotential(g.hand,null))
    cands.push({c:ctx.hpow,from:"hero",idx:0,excl:null});
  g.board.forEach((b,i)=>{ if(b.kind==="ally"&&!b.spent&&b.card.power>0) cands.push({c:b.card,from:"ally",idx:i,excl:null,free:true}); });
  if(!cands.length){
    return {line: g.res>0 ? `End turn — but ${g.res} will fizzle. If anything costs ≤${g.res}, squeeze it in.` : "End turn. Nothing profitable left — don't force it.",
            why:"Wasted resources scar your score; empty swings scar your hand."};
  }
  let best=null;
  cands.forEach(cd=>{
    const fx=fxParse(cd.c);
    const need=Math.max(0,(cd.c.cost||0)-g.res);
    const set = need>0 ? advBestPitch(g.hand,need,cd.excl,PV) : {idxs:[],gain:0,waste:0,loss:0};
    if(!set) return;
    let v = advValue(cd.c,g,ctx);
    if(fx.ga){
      const rest = g.hand.filter((c,i)=> i!==cd.idx || cd.from!=="hand").filter(c=>!set.idxs.includes(g.hand.indexOf(c)));
      const next = rest.filter(c=>(isAttack(c)&&!isArrow(c)) || fxParse(c).ops.concat(fxParse(c).onHit).some(o=>o[0]==="arcane"))
        .map(c=>advCardOut(c,g,ctx)).sort((a,b)=>b-a)[0]||0;
      v += 0.9 + next*0.5;
      cd.next = next;
    }
    if(cd.free) v += 0.5;
    v -= 0.55*set.loss + 0.9*set.waste;
    cd.v=v; cd.set=set;
    if(!best || v>best.v) best=cd;
  });
  if(!best || best.v < 0.4) return {line:"End turn — save the hand for blocks and tomorrow.", why:"Every play from here trades down."};
  const fx=fxParse(best.c);
  const out = advCardOut(best.c,g,ctx);
  const pitchTxt = best.set.idxs.length ? ` (pitch ${best.set.idxs.map(i=>nm(g.hand[i])).join(" + ")})` : "";
  const srcTxt = best.from==="arsenal" ? " from arsenal" : best.from==="hero" ? " — hero power" : best.from==="weapon" ? " — weapon swing" : best.from==="ally" ? " — send the ally in" : "";
  const bits=[]; if(out>0) bits.push(out+" dmg"); if(fx.ga) bits.push("go again");
  fx.ops.forEach(op=>{ if(op[0]==="draw") bits.push("draw "+op[1]); if(op[0]==="rune") bits.push("+"+op[1]+" runechant"); if(op[0]==="amp") bits.push("amp "+op[1]); });
  const why = fx.ga ? `Chain it: go again keeps your action point${best.next?` — ${Math.round(best.next)} more damage is waiting behind it`:""}.`
    : g.rune>0 && isAttack(best.c) ? `Your ${g.rune} runechant${g.rune>1?"s":""} pop on this swing — cash them in.`
    : out>=5 ? "Biggest clean hit on the table; anything smaller wastes the turn."
    : "Best value line available right now.";
  return {line:`Play ${nm(best.c)}${srcTxt}${pitchTxt} → ${bits.join(", ")||"effect"}.`, why};
}

return {advPitchPotential, advCardOut, advValue, advBestPitch, advise};
});
