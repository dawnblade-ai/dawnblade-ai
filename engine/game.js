/* ============================================================
   Dawnblade engine — game.js (Phase 1 extraction)
   Pure game-state helpers extracted verbatim from index.html:
   deck parsing, equipment block wear, gear slotting, shuffle.

   Phase 2 grows this into the two-player state machine
   (turns, chain, stack, priority). The trainer's runOps /
   execute / resolveStack still live inside index.html's
   Battle component — they come here when the dummy gets a hand.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnGame = factory();
})(typeof self!=="undefined" ? self : this, function(){

const shuffle = a => { const x=a.slice(); for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];} return x; };

function parseDeck(raw){
  const gear=[], deck=[]; let hero=null;
  raw.trim().split("\n").forEach(line=>{
    const [a,name,p,code] = line.split("|");
    const e = {name:name.trim(), p:parseInt(p,10)||0, code:(code||"").trim()||null};
    if(a==="H") hero=e; else if(a==="G") gear.push(e); else { e.q=parseInt(a,10)||1; deck.push(e); }
  });
  return {hero,gear,deck};
}

const gearDef = gr => gr.destroyed ? 0 : (gr.curDef!=null ? gr.curDef : (gr.def||0));
function gearBlockApply(gr){
  const kws = (gr.kw||[]).map(k=>String(k).toLowerCase());
  const d = gearDef(gr); const n = {...gr};
  if(kws.some(k=>k.includes("blade break"))) n.destroyed = true;
  else if(kws.some(k=>k.includes("guardwell"))){ n.curDef = 0; }
  else if(kws.some(k=>k.includes("temper"))){ n.curDef = Math.max(0,d-1); if(n.curDef===0) n.destroyed = true; }
  else if(kws.some(k=>k.includes("battleworn"))){ n.curDef = Math.max(0,d-1); }
  return n;
}

function slotOf(c){
  const t = ((c&&c.tt)||"").toLowerCase();
  if(/off[\s-]?hand/.test(t)) return {z:"off",h:1,lab:"off"};
  if(/\bquiver\b/.test(t)) return {z:"qvr",h:0,lab:"quiver"};
  if(/\b2h\b/.test(t)) return {z:"2h",h:2,lab:"2h"};
  if(/\b1h\b/.test(t)) return {z:"1h",h:1,lab:"1h"};
  if(/\bhead\b/.test(t)) return {z:"head",h:0,lab:"head"};
  if(/\bchest\b/.test(t)) return {z:"chest",h:0,lab:"chest"};
  if(/\barms\b/.test(t)) return {z:"arms",h:0,lab:"arms"};
  if(/\blegs\b/.test(t)) return {z:"legs",h:0,lab:"legs"};
  if(/weapon/.test(t) || (c&&c.power!=null)) return {z:"1h",h:1,lab:"1h?"};
  return {z:"misc",h:0,lab:"gear"};
}

return {shuffle, parseDeck, gearDef, gearBlockApply, slotOf};
});
