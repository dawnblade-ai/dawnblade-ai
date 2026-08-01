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

/* ---- THE PRINTING THIS GAME SHOWS (v2.35) ---------------------------
   Every card is printed in many sets, and `_first` is whatever the card
   database happened to list first — arbitrary order, not a choice. That is
   why an Azalea deck was showing GEM, 1HP, PEN and DDD art side by side.

   This is a Silver Age trainer, so a card should wear its Silver Age face.
   Measured over all 503 deck entries: every one but a single card has a
   printing in its OWN hero's Silver Age set (SAZ for Azalea, SDO for
   Dorinthea, …). So the order is:

     1. an explicit code on the deck entry  — an author's deliberate choice
     2. this hero's own Silver Age set      — the default, and it covers 502
     3. any other Silver Age set            — shared cards printed elsewhere
     4. `_first`                            — the honest last resort

   Step 1 is what keeps the Dawnblade on its Marvel printing (MPW156-MV),
   which is the one card that is meant to be Marvel. Step 4 is reached by
   exactly one card in the pool today: Enigma Chimera at pitch 2 has no
   Silver Age printing at all (MON and PSM only), and pretending otherwise
   would be inventing a printing that does not exist. */
const SA_SETS = ["SKA","SIY","SVI","SDA","SBR","SAZ","SDO","SFA","SEN","SAR","SBZ","SBL","SBA","SGB","SLY"];
function pickPrinting(card, code, prefer){
  /* AN EXPLICIT CODE ALWAYS WINS, even when the database has no record of
     that printing — the constructed CDN path is then the answer. Returning
     the set preference instead silently overrode the author's choice, which
     put the Dawnblade back on its Silver Age face (SDO002) when the whole
     point of the code is that this one card wears its Marvel printing. */
  if(code) return (card && card.pr[code]) || cdnImg(code);
  if(!card) return null;
  if(prefer && card.prs && card.prs[prefer]) return card.prs[prefer];
  if(card.prs){
    for(const s of SA_SETS) if(card.prs[s]) return card.prs[s];
  }
  return card.pr._first || null;
}
function resolveEntry(db, e, prefer){
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
  /* The chosen printing is the image. An explicit code that the database
     does not carry still falls back to the constructed CDN path, so a
     hand-written code keeps working even for a printing we have no record
     of — that is how MPW156-MV resolves. */
  const img = pickPrinting(card, e.code, prefer) || cdnImg(e.code) || null;
  const dbImg = card ? (pickPrinting(card, null, prefer) || card.pr._first || null) : null;
  return {
    name:e.name, q:e.q||1, code:e.code,
    pitch: card&&card.p!=null ? card.p : (e.p||0),
    cost: card?card.c:null, power: card?card.pw:null, def: card?card.d:null,
    /* An ally's LIFE. The database calls it `health` (mapDbCard puts it on
       `hp`) and this resolver used to drop it, so allies had no life at all
       in the trainer and could never be attacked — which made CR 1.4.5's
       mandatory attack-target choice impossible to offer. Heroes read their
       own health via resolveHero; this is what makes an ally a *living
       object* (CR 1.4.5a) and therefore attackable. */
    life: card&&card.hp!=null ? card.hp : null,
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
  const prints = {}, bySet = {};
  (c.printings||[]).forEach(pr=>{
    const id = pr.id || pr.identifier || pr.set_printing_unique_id || null;
    const url = pr.image_url || pr.image || null;
    if(url){
      if(id) prints[id]=url;
      /* FIRST printing per set wins. A set lists the same card several times
         for foiling and art variations; they share one image_url, so this is
         a stable pick rather than an arbitrary one. */
      if(pr.set_id && !bySet[pr.set_id]) bySet[pr.set_id]=url;
      if(!prints._first) prints._first=url;
    }
  });
  return {
    n:c.name, p:toNum(c.pitch), c:toNum(c.cost), pw:toNum(c.power),
    d:toNum(c.defense), hp:toNum(c.health), int:toNum(c.intelligence),
    tt:c.type_text||((c.types||[]).join(" ")), kw:(c.card_keywords||[]), gkw:(c.granted_keywords||[]),
    tx:c.functional_text_plain||c.functional_text||"", pr:prints, prs:bySet
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

return {setCDN, cdnImg, toNum, resolveEntry, resolveHero, mapDbCard, buildMaps,
        SA_SETS, pickPrinting};
});
