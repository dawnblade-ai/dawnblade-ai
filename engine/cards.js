/* ============================================================
   Dawnblade engine — cards.js (pool resolution)
   Deck-entry → database-record resolution, extracted verbatim
   from index.html so Node tools (the pool auditor) see exactly
   the cards the trainer plays with. Unique card = name|pitch.

   mapDbCard/buildMaps mirror the field mapping inside
   useCardDB's load loop (index.html, not extractable as a
   function) — if that loop changes, change these by hand.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory(require("./parser.js"));
  else root.DawnCards = factory(root.DawnParser);
})(typeof self!=="undefined" ? self : this, function(P){

const {norm} = P;
let CDN = "";
const setCDN = url => { CDN = url || ""; };

const cdnImg = code => code ? (CDN + code + ".webp") : null;
const toNum = v => { const n = parseInt(v,10); return isNaN(n) ? null : n; };

function resolveEntry(db, e){
  const k = norm(e.name);
  let cands = db.byName[k];
  if(!cands && e.name.includes("//")) cands = db.byName[norm(e.name.split("//")[0])];
  let card = null;
  if(!cands && e.code && db.byCode && db.byCode[e.code]) cands = [db.byCode[e.code]];
  if(cands){
    if(e.p>0) card = cands.find(c=>c.p===e.p) || null;
    if(!card && e.code) card = cands.find(c=>c.pr[e.code]) || null;
    if(!card) card = cands.slice().sort((a,b)=>(a.p??9)-(b.p??9))[0];
  }
  const img = cdnImg(e.code) || (card ? (card.pr[e.code]||card.pr._first) : null);
  const dbImg = card ? (card.pr._first||null) : null;
  return {
    name:e.name, q:e.q||1, code:e.code,
    pitch: card&&card.p!=null ? card.p : (e.p||0),
    cost: card?card.c:null, power: card?card.pw:null, def: card?card.d:null,
    tt: card?card.tt:"", kw: card?card.kw:[], gkw: card?(card.gkw||[]):[], tx: card?card.tx:"",
    img, dbImg, resolved: !!card
  };
}
function resolveHero(db, e){
  if(!db || db.status!=="ready") return null;
  const k = norm(e.name);
  let c = (db.byName[k]||[])[0] || null;
  if(!c && e.code && db.byCode) c = db.byCode[e.code] || null;
  if(!c){
    let best=null;
    Object.keys(db.byName).forEach(nm=>{
      if(!nm.includes(k)) return;
      db.byName[nm].forEach(x=>{
        if(!/hero/i.test(x.tt||"")) return;
        if(best==null || (x.hp!=null?x.hp:99) < (best.hp!=null?best.hp:99)) best=x;
      });
    });
    c = best;
  }
  return c;
}

/* --- mirrors of useCardDB's load loop (see header note) --- */
function mapDbCard(c){
  const prints = {};
  (c.printings||[]).forEach(pr=>{
    const id = pr.id || pr.identifier || pr.set_printing_unique_id || null;
    const url = pr.image_url || pr.image || null;
    if(url){ if(id) prints[id]=url; if(!prints._first) prints._first=url; }
  });
  return {
    n:c.name, p:toNum(c.pitch), c:toNum(c.cost), pw:toNum(c.power),
    d:toNum(c.defense), hp:toNum(c.health), int:toNum(c.intelligence),
    tt:c.type_text||((c.types||[]).join(" ")), kw:(c.card_keywords||[]), gkw:(c.granted_keywords||[]),
    tx:c.functional_text_plain||c.functional_text||"", pr:prints
  };
}
function buildMaps(cards){
  const byNP={}, byName={}, byCode={};
  cards.forEach(c=>{
    const k=norm(c.n);
    byNP[k+"|"+(c.p==null?0:c.p)]=c;
    (byName[k]=byName[k]||[]).push(c);
    Object.keys(c.pr||{}).forEach(id=>{ if(id!=="_first") byCode[id]=c; });
  });
  return {status:"ready", byNP, byName, byCode, count:cards.length};
}

return {setCDN, cdnImg, toNum, resolveEntry, resolveHero, mapDbCard, buildMaps};
});
