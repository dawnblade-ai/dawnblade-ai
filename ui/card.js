/* ============================================================
   ui/card.js — DawnUICard: THE CARD OBJECT (docs/crescendo/DESIGN-SYSTEM.md 6; SCREENS-TABLE.md 1 DEV-1).
   A card is a box with a reserved size, its art, and the numbers re-stamped at the printed corners:
   cost TL, pitch TR, power BL, defence BR (hand size); power + defence only on the mat. A stamp restates
   a value the card HAS (the engine already read it from the card text) — it is never invented, and a value the
   card lacks is simply not drawn. Art is the card's own `img` (the pinned database's printing), falling back to
   its `dbImg`, then to the real name on the same box (PHONE rule 14). Faces only: a hidden card is a back.
   Pure helpers are exported for node; the Preact parts need window.htmPreact (play.html loads it first).
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUICard = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

const P = root.htmPreact || {};
const html = P.html;

/* pitch 1/2/3 -> the strip and chip colour; 0 / none -> no colour */
const PITCH_CLASS = {1: "red", 2: "yellow", 3: "blue"};
const pitchClass = c => (c && !c.hidden && PITCH_CLASS[c.pitch]) || "";

const has = n => n != null && n !== "" && !isNaN(+n);

/* which stamps a card carries at a place: "hand" all four, "mat" power + defence. `def` is passed in (equipment
   reads its CURRENT defence through DawnGame.gearDef, a battleworn piece is not its printed number). */
function stamps(c, place, def){
  if(!c || c.hidden) return [];
  const out = [];
  if(place === "hand"){
    if(has(c.cost)) out.push(["cost", c.cost]);
    if(has(c.pitch) && +c.pitch > 0) out.push(["pitch", c.pitch]);
  }
  if(has(c.power)) out.push(["pow", c.power]);
  const d = def != null ? def : c.def;
  if(has(d)) out.push(["def", d]);
  return out;
}

/* the art failed: try the database image once, then show the real name on the same box */
function artFailed(e, c){
  const img = e.target, box = img.parentNode;
  if(c && c.dbImg && img.getAttribute("data-fb") !== "1" && img.src !== c.dbImg){ img.setAttribute("data-fb", "1"); img.src = c.dbImg; return; }
  if(box && box.classList) box.classList.add("noimg");
  img.style.display = "none";
}

/* a face-up card. `cls` carries the place and state classes (cd hand ready ...); `b` is its box name (tests). */
function Face(p){
  const c = p.card, st = stamps(c, p.place, p.def), colour = pitchClass(c);
  return html`<div class=${"cd " + p.cls + (colour ? " " + colour : "")} data-tap=${p.tap ? "" : undefined} data-b=${p.b}
      aria-label=${c.name}>
    ${c.img ? html`<img alt=${c.name} src=${c.img} width=${p.w} height=${p.h} decoding="async" onError=${e => artFailed(e, c)}/>` : null}
    <span class="cname">${c.name}</span>
    ${p.place === "hand" && colour ? html`<span class="strip"></span>` : null}
    ${st.map(s => html`<span class=${"st " + s[0]}>${s[1]}</span>`)}
    ${p.children}
  </div>`;
}

/* a face-down card (their hand, a deck, an arsenal): the original card back */
function Back(p){
  return html`<div class=${"cd back " + (p.cls || "")} data-b=${p.b} data-tap=${p.tap ? "" : undefined} aria-label=${p.label || "Face down"}>${p.children}</div>`;
}

return {PITCH_CLASS, pitchClass, stamps, Face, Back};
});
