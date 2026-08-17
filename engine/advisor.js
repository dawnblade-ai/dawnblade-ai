/* ============================================================
   Dawnblade engine — advisor.js (Phase 1 extraction)
   "Claude's call" — pure move evaluation, extracted verbatim
   from index.html. No DOM, no React: state in, coaching out.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports)
    module.exports = factory(require("./parser.js"), require("./priority.js"));
  else root.DawnAdvisor = factory(root.DawnParser, root.DawnPriority);
})(typeof self!=="undefined" ? self : this, function(P, PRI){

const {fxParse, effCost, isAttack, isArrow, isWeapon, isAR, isRx, isInstantT, costsAP, hasKw, runeCount} = P;

/* Side accessors, declared locally so this module keeps its own dependencies.
   The trainer defines the same two names globally, which is what lets the
   sync guard compare the function bodies below character for character. */
const you = s => s.sides[0];
const opp = s => s.sides[1];

function advPitchPotential(hand, excl){ return hand.reduce((a,c,i)=> i===excl ? a : a+(c.pitch||0), 0); }
function advCardOut(c, g, ctx){
  const fx = fxParse(c);
  let dmg = 0;
  if(isAttack(c)){
    dmg = (c.power||0) + (fx.self||0) + you(g).buffNext + runeCount(you(g))*ctx.runeDmg;
    fx.conds.forEach(cd=>{ if(cd.op[0]==="self" && ((cd.cond==="atk"&&you(g).hist.atk>0)||(cd.cond==="non"&&you(g).hist.non>0))) dmg += cd.op[1]; });
    if((ctx.dBlk||0)>0 && dmg>=4) dmg = Math.max(0, dmg-(ctx.dDef||1));
  }
  fx.ops.concat(isAttack(c)?fx.onHit:[]).forEach(op=>{ if(op[0]==="arcane") dmg += op[1] + you(g).amp; });
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
  return v - effCost(c, you(g))*0.15;
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
/* ---- WHICH WINDOW IS THIS SEAT IN (v2.83) ---------------------------
   THE ADVISOR IS TOLD WHICH WINDOW IT IS IN. IT NEVER SNIFFS, and the
   reason is specific rather than stylistic.

   `advise` was written against the trainer's `mode`. `judge.js` seeds
   `mode` into its opening state — every game carries both vocabularies,
   deliberately, so that neither being present says which engine is
   driving — and then never writes it again. So a table game carries
   `mode:"act"` from the first draw to the last point of life.

   Handing `advise` a judge state unchanged therefore does NOT fail. It
   coaches, confidently, off a frozen field: action-phase advice while
   you are being attacked, in every step of every turn. That is the
   "displayed value is wrong" category — sev-2, the one the player
   TRUSTS — and no drill that checks the advisor returns a line could
   see it.

   So the window is a parameter, and this derives it for a judge state
   off the CR machine and the fields judge actually maintains. The
   trainer passes its own `mode`, which is live and authoritative there
   and retires with `Battle`. */
function advView(g, seat){
  const me = seat || 0;
  /* A payment is an INTERACTION belonging to one seat (judge's `pending`):
     while it is set that seat may only finish or abandon it. */
  if(g.pending && g.pending.seat === me) return {window:"pay", incoming:0};
  /* CR 4.4.3b — the arsenal set is an END-PHASE step, and judge names the
     seat it is asking rather than leaving it to be inferred from turn. */
  if(g.arsenalFor === me) return {window:"arsenal", incoming:0};
  /* CR 7.3.2 — declaring defenders is free and simultaneous, which is why
     it is a different question from holding priority (CR 7.3.3 gives that
     to the TURN player in the very same step). Ask priority.js rather than
     restating it: five hand-rolled copies of "may this be played here" is
     how `rxAllowed` came to exist. */
  if(PRI.canDeclareDefenders(g, me))
    return {window:"block", incoming: g.pend ? (g.pend.total || 0) : 0};
  /* Your own attack is on the chain and the reaction window is open. The
     attacker decides which KIND of reaction is legal, which is a different
     question from who holds the window — so this asks who controls the
     attack, exactly as CR 8.1.2a does. */
  if(g.step === "reaction" && (g.attacker != null ? g.attacker : g.turnPlayer) === me)
    return {window:"stack", incoming:0};
  /* Everything else is the action phase, including their turn — where the
     honest coaching is about instants and blocks, which the act branch
     already filters to by asking `legal`-shaped questions of the hand. */
  return {window:"act", incoming:0};
}

function advise(g, ctx){
  const V = c => advValue(c,g,ctx);
  const PV = c => (isAttack(c)&&isArrow(c)) ? V(c)*0.3 : V(c);
  const nm = c => c.name;
  /* NO FALLBACK TO `g.mode`. A missing window would otherwise fall through
     every branch below and land on the action-phase advice, which reads as
     a real answer — the same silent-wrongness this parameter exists to
     stop, just relocated. It says so on screen instead. */
  const win = ctx.window;
  if(win == null) return {line:"(the advisor was not told which step this is)",
    why:"advise() reads ctx.window — see advView. Without it, every step of the game would be coached as an action phase."};
  const incoming = ctx.incoming != null ? ctx.incoming : 0;
  if(win==="pay" && g.pending){
    const need = effCost(g.pending.card, you(g))-you(g).res;
    const set = advBestPitch(you(g).hand, need, g.pending.from==="hand"?g.pending.idx:null, PV);
    if(!set) return {line:"Cancel — you can't cover this cost.", why:"Not enough pitch in hand. Pick a cheaper line."};
    const names = set.idxs.map(i=>nm(you(g).hand[i])).join(" + ");
    return {line:`Pitch ${names} — exactly ${set.gain}${set.waste?` (${set.waste} floats: spend it before end of turn)`:""}.`,
            why:"Fodder first — feed the fire with the cards you'd least like to swing."};
  }
  if(win==="stack"){
    const rx = you(g).hand.map(c=>({c,fx:fxParse(c)})).filter(x=>(isAR(x.c)||(isInstantT(x.c)&&x.fx.ops.length>0)) && (x.c.cost||0)<=you(g).res)
      .map(x=>({...x,p:(x.fx.self||0)+x.fx.ops.filter(o=>o[0]==="buffNext").reduce((a,o)=>a+o[1],0)}))
      .sort((a,b)=>b.p-a.p)[0];
    if(rx && rx.p>0) return {line:`React with ${rx.c.name} (+${rx.p}), then pass.`, why:"Reactions land before the iron — every point punches through."};
    return {line:"Pass — let it resolve.", why:"No profitable reaction in hand; keep your cards for the swing back."};
  }
  if(win==="arsenal"){
    const arrows = you(g).hand.map((c,i)=>({c,i})).filter(x=>isAttack(x.c)&&isArrow(x.c));
    if(arrows.length){ const b=arrows.sort((a,z)=>V(z.c)-V(a.c))[0]; return {line:`Arsenal ${nm(b.c)} — arrows only fire from there.`, why:"Ranger law: the arsenal is your bowstring."}; }
    if(!you(g).hand.length) return {line:"Skip — nothing to stash.", why:""};
    const b = you(g).hand.map((c,i)=>({c,i})).sort((a,z)=>V(z.c)-V(a.c))[0];
    return {line:`Arsenal ${nm(b.c)} — it swings again tomorrow.`, why:"Bank your best card; you'll draw back to full anyway."};
  }
  if(win==="block"){
    const inc = incoming, hp = you(g).hp;
    const atkEsts = you(g).hand.filter(isAttack).map(c=>advCardOut(c,g,ctx)).sort((a,b)=>b-a);
    const est = Math.max(3, ((atkEsts[0]||0)+(atkEsts[1]||0)) / (atkEsts.length>1?1.4:1));
    const myTTK = Math.max(1, Math.ceil(opp(g).hp/Math.max(3,est)));
    const dTTK = Math.max(1, Math.ceil(hp/4.2));
    const target = hp<=8 ? 0 : hp<=14 ? 1 : 2;
    const cards = you(g).hand.map((c,i)=>({t:"h",i,d:c.def||0,v:V(c),n:nm(c)})).filter(x=>x.d>0).sort((a,b)=>(a.v-b.v)||(b.d-a.d));
    const gearB = you(g).gear.map((c,i)=>({t:"g",i,d:c.def||0,used:c.used,n:nm(c)})).filter(x=>x.d>0&&!x.used);
    const pool = hp<=14 ? gearB.concat(cards) : cards.concat(gearB);
    let sum=0, picks=[];
    for(const p of pool){ if(inc-sum<=target) break; picks.push(p); sum+=p.d; }
    if(inc-sum>target && sum===0) picks=[], sum=0;
    if(!picks.length) return {line:`Take the ${inc} on the chin.`, why:`Race math: you fell the dummy in ~${myTTK} turns; it needs ~${dTTK} to fell you. Cards hit harder than they block.`};
    return {line:`Block with ${picks.map(p=>p.n).join(" + ")} (${sum}) — take ${Math.max(0,inc-sum)}.`,
            why: hp<=8 ? "You're deep in the red — armor up, survive the round." : `Race math: ~${myTTK} turns to kill, ~${dTTK} to die. Shed the cheap defense, keep the damage.`};
  }
  // act mode
  /* CR 8.1.6 — an instant may be played "any time the player has priority",
     so an empty action point pool ends your ACTIONS, not your turn. This used
     to return here unconditionally and coach "end turn" over a live instant.
     The candidates are still built; `live` below is what survives. */
  const apOut = you(g).ap<1;
  const cands=[];
  you(g).hand.forEach((c,i)=>{
    const fx=fxParse(c); const atk=isAttack(c);
    if(atk&&isArrow(c)) return;
    /* CR 8.1.2a / 8.1.3a — a reaction belongs to the reaction step, so it is
       not a candidate in the action phase. tryPlay refuses one; coaching a
       play the game then refuses is worse than not coaching it. */
    if(isRx(c)) return;
    if(!atk&&!fx.playable) return;
    if(effCost(c, you(g)) > you(g).res + advPitchPotential(you(g).hand,i)) return;
    cands.push({c,from:"hand",idx:i,excl:i});
  });
  if(you(g).arsenal && (isAttack(you(g).arsenal)||fxParse(you(g).arsenal).playable) && (you(g).arsenal.cost||0)<=you(g).res+advPitchPotential(you(g).hand,null))
    cands.push({c:you(g).arsenal,from:"arsenal",idx:0,excl:null});
  you(g).gear.forEach((w,i)=>{ if(isWeapon(w)&&!you(g).weaponUsed[w.uid]&&(w.cost||0)<=you(g).res+advPitchPotential(you(g).hand,null)) cands.push({c:w,from:"weapon",idx:i,excl:null}); });
  if(ctx.hpow && !you(g).weaponUsed["hpow"] && (ctx.hpow.cost||0)<=you(g).res+advPitchPotential(you(g).hand,null))
    cands.push({c:ctx.hpow,from:"hero",idx:0,excl:null});
  you(g).board.forEach((b,i)=>{ if(b.kind==="ally"&&!b.spent&&b.card.power>0) cands.push({c:b.card,from:"ally",idx:i,excl:null,free:true}); });
  /* With the action point gone, only the instants are still legal — plus the
     ally swing, which the trainer models as free and says so in the log. */
  const live = apOut ? cands.filter(cd => cd.free || !costsAP(cd.c)) : cands;
  if(!live.length){
    if(apOut) return {line:"End turn — action point spent.", why:"Set your arsenal on the way out and draw back up."};
    return {line: you(g).res>0 ? `End turn — but ${you(g).res} will fizzle. If anything costs ≤${you(g).res}, squeeze it in.` : "End turn. Nothing profitable left — don't force it.",
            why:"Wasted resources scar your score; empty swings scar your hand."};
  }
  let best=null;
  live.forEach(cd=>{
    const fx=fxParse(cd.c);
    const need=Math.max(0,(cd.c.cost||0)-you(g).res);
    const set = need>0 ? advBestPitch(you(g).hand,need,cd.excl,PV) : {idxs:[],gain:0,waste:0,loss:0};
    if(!set) return;
    let v = advValue(cd.c,g,ctx);
    if(fx.ga){
      const rest = you(g).hand.filter((c,i)=> i!==cd.idx || cd.from!=="hand").filter(c=>!set.idxs.includes(you(g).hand.indexOf(c)));
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
  const pitchTxt = best.set.idxs.length ? ` (pitch ${best.set.idxs.map(i=>nm(you(g).hand[i])).join(" + ")})` : "";
  const srcTxt = best.from==="arsenal" ? " from arsenal" : best.from==="hero" ? " — hero power" : best.from==="weapon" ? " — weapon swing" : best.from==="ally" ? " — send the ally in" : "";
  const bits=[]; if(out>0) bits.push(out+" dmg"); if(fx.ga) bits.push("go again");
  fx.ops.forEach(op=>{ if(op[0]==="draw") bits.push("draw "+op[1]); if(op[0]==="rune") bits.push("+"+op[1]+" runechant"); if(op[0]==="amp") bits.push("amp "+op[1]); });
  const why = fx.ga ? `Chain it: go again keeps your action point${best.next?` — ${Math.round(best.next)} more damage is waiting behind it`:""}.`
    : runeCount(you(g))>0 && isAttack(best.c) ? `Your ${runeCount(you(g))} runechant${runeCount(you(g))>1?"s":""} pop on this swing — cash them in.`
    : out>=5 ? "Biggest clean hit on the table; anything smaller wastes the turn."
    : "Best value line available right now.";
  return {line:`Play ${nm(best.c)}${srcTxt}${pitchTxt} → ${bits.join(", ")||"effect"}.`, why};
}

return {advPitchPotential, advCardOut, advValue, advBestPitch, advView, advise};
});
