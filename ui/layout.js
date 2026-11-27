/* ============================================================
   ui/layout.js — DawnUILayout: where things are, for the announcer (ui/announce-view.js `layout`) and the director's FLIP.
   `rect(place, a, b)` answers a box {x, y, w, h} in the announcer layer's own pixels (the stage's top-left is 0,0) and
   `el(name, seat)` the DOM element a beat animates. It is MEASUREMENT for choreography only: nothing here feeds back into a
   size or a position of the table (PHONE rule 3). Reads are made when a beat is BUILT, never inside one.

   Places: glimpse small hand oppHand deck(seat) chain pile(seat) grave(seat) arsenal(seat) wall(seat,i) bout(seat) loser(seat).
   The table renders three invisible anchors so the chain slot, the wall and the hand always have a box to read:
   [data-anchor=chain], [data-anchor=wall] (docs/crescendo/SCREENS-TABLE.md 0, 14). A hand card that has already left the row
   (an own play changes state at t=0) is found in the rectangles remembered at the last render.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUILayout = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){


/* stage: () -> the .stage element; me: the viewer's seat; remembered: Map uid -> rect, kept by the table after each render */
function create(stage, me, remembered){
  const st = () => stage();
  const box = (e, o) => {
    const s = st(), r = e && e.getBoundingClientRect(), b = s && s.getBoundingClientRect();
    return r && b && (r.width || r.height) ? {x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height} : null;
  };
  const q = sel => { const s = st(); return s ? s.querySelector(sel) : null; };
  const who = seat => seat === me ? "you" : "opp";
  const W = () => { const s = st(); return s ? s.clientWidth : 393; };
  /* the glimpse's sizes are tokens (--cw-glimpse, --ch-glimpse, --cw-glimpse-pitch, --ch-glimpse-pitch): read from the computed style,
     so tokens.css is the ONE source (no second table here to drift) */
  const tok = name => { const s = st(); return s ? parseFloat(root.getComputedStyle(s).getPropertyValue(name)) || 0 : 0; };
  const band = () => W() >= 414 ? "l" : W() < 380 ? "s" : "m";
  const fallback = {x: 0, y: 0, w: 64, h: 90};
  /* the glimpse is centred; with pitched cards beside it the PAIR is (SCREENS-TABLE T5: 30.5 at 393). `L.extras` is how many the
     descriptor being built has: the table sets it just before it hands the announcer that descriptor. */
  const glimpse = () => {
    const w = tok("--cw-glimpse") || 232, h = tok("--ch-glimpse") || 324, bout = box(q(".bout")), slab = band() === "s" ? 48 : 60;
    const pw = L.extras > 0 ? 8 + (tok("--cw-glimpse-pitch") || 92) : 0;
    /* below the slab, and never lower than the tray's top edge allows: at compact the glimpse must clear the hand (SCREENS-TABLE 14) */
    const tray = box(q(".tray")), y0 = (bout ? bout.y + bout.h : 56) + slab + 10;
    return {x: (W() - w - pw) / 2, y: tray ? Math.min(y0, tray.y - h) : y0, w, h};
  };
  const rect = (place, a, b) => {
    switch(place){
      case "glimpse": return glimpse();
      case "small": { const g = glimpse(), w = tok("--cw-glimpse-pitch") || 92, h = tok("--ch-glimpse-pitch") || 128; return {x: g.x + g.w + 8, y: g.y + (a || 0) * (h + 16), w, h}; }
      case "hand": {
        const uid = a && a.uid;
        const live = uid != null ? q(`[data-uid="${uid}"]`) : null, r = live && box(live);
        return r || (uid != null && remembered && remembered.get(uid)) || box(q(".handrow .cd")) || fallback;
      }
      case "oppHand": { const r = box(q(".hf")); return r ? {x: r.x + r.w / 2 - 14, y: r.y, w: 28, h: 39} : {x: W() / 2 - 14, y: 56, w: 28, h: 39}; }
      case "deck": return box(q(`[data-b="${who(a)}-slot-deck"]`)) || fallback;
      case "chain": return box(q('[data-anchor="chain"] .cd')) || fallback;
      case "pile": { const d = box(q(`[data-b="${who(a)}-slot-deck"]`)); return d ? {...d, y: d.y + (who(a) === "you" ? 16 : -16)} : fallback; }
      case "grave": return box(q(`[data-b="${who(a)}-slot-gy"]`)) || fallback;
      case "arsenal": return box(q(`[data-b="${who(a)}-slot-arsenal"]`)) || fallback;
      case "wall": { const w = box(q('[data-anchor="wall"] .cd')) || fallback, ov = W() >= 414 ? 30 : 26; return {...w, x: w.x + (b || 0) * (w.w - ov)}; }
      case "bout": return box(q(`.side.${who(a)}`)) || fallback;
      case "loser": return box(q(`.side.${who(a)} .por`)) || fallback;
      default: return glimpse();
    }
  };
  const el = (name, seat) => {
    const side = `.side.${who(seat)}`;
    switch(name){
      case "world": return q(".world");
      case "flash": return q(`${side} .bar .flash`);
      case "ghost": return q(`${side} .bar .ghost`);
      case "fill": return q(`${side} .bar .fill`);
      case "pop": return q(`${side} .pop`);
      case "medal": return q(".medal");
      case "glow": return q(`${side} .por`);
      case "apPip": return q(`[data-b="${seat === me ? "ap" : "opp-ap"}"]`);
      default: return null;
    }
  };
  const L = {rect, el, band, extras: 0};
  return L;
}

/* remember where the hand cards are (stage-relative) after a render: an own play has left the row by the time its flight is built */
function remember(stage, map){
  const b = stage.getBoundingClientRect();
  stage.querySelectorAll(".handrow .cd[data-uid]").forEach(e => {
    const r = e.getBoundingClientRect(), k = e.getAttribute("data-uid");
    if(r.width) map.set(isNaN(+k) ? k : +k, {x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height});
  });
}

return {create, remember};
});
